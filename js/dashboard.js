// ============================================
// Dashboard Module
// ============================================
const Dashboard = {
    _chart: null,
    _chartJahres: null,
    _chartGewinn: null,
    _selectedYear: new Date().getFullYear(),

    /** Diagramme erst bei Bedarf laden; die Datentabellen sind davon unabhängig. */
    _ensureApexCharts() {
        this._renderChart();
        this._renderGewinnChart();
        if (typeof ApexCharts !== 'undefined' || this._apexLoading) return;
        this._apexLoading = true;
        const script = document.createElement('script');
        script.src = '/js/vendor/apexcharts.min.js';
        script.onload = () => {
            this._apexLoading = false;
            this._renderChart();
            this._renderGewinnChart();
        };
        script.onerror = () => {
            this._apexLoading = false;
            console.warn('[Dashboard] Diagramme nicht verfügbar; Werte bleiben als Tabelle zugänglich.');
        };
        document.head.appendChild(script);
    },

    _chartPalette() {
        const css = getComputedStyle(document.documentElement);
        return {
            text: css.getPropertyValue('--text-primary').trim(),
            muted: css.getPropertyValue('--text-muted').trim(),
            border: css.getPropertyValue('--border').trim()
        };
    },

    _renderChartData(id, title, labels, series) {
        const host = document.getElementById(id);
        if (!host) return;
        host.innerHTML = `<details class="redesign-chart-data"><summary>Werte als Tabelle</summary>
            <div class="table-container redesign-table-scroll" role="region" aria-label="${Utils.escapeHtml(title)}" tabindex="0"><table>
                <caption>${Utils.escapeHtml(title)}</caption>
                <thead><tr><th scope="col">Zeitraum</th>${series.map(s => `<th scope="col" class="amount">${Utils.escapeHtml(s.name)}</th>`).join('')}</tr></thead>
                <tbody>${labels.map((label, i) => `<tr><th scope="row">${Utils.escapeHtml(String(label))}</th>${series.map(s => `<td class="amount">${Utils.formatCurrency(s.data[i])}</td>`).join('')}</tr>`).join('')}</tbody>
            </table></div></details>`;
    },

    /** Der Einstieg ohne Daten prüft alle Jahre. Ein leerer Zeitraum behält den Jahreswähler. */
    _isFirstRun() {
        if (Store.getPurchases().length || Store.getSales().length || Store.getExpenses().length) return false;
        const rech = Store.getRechInvoices ? Store.getRechInvoices() : [];
        return rech.length === 0;
    },

    /** Ohne Buchungen zeigen wir einen eindeutigen Einstieg ohne Beispieldaten. */
    _renderFirstRun() {
        const readonly = Store._isReadonlyCompany && Store._isReadonlyCompany();
        return `
            <div class="redesign-dashboard">
                <div class="page-header"><div><p class="redesign-eyebrow">Dein Geschäft im Blick</p><h2>Übersicht</h2></div></div>
                ${this._renderTrialHinweis()}
                <section class="redesign-empty">
                    <p class="redesign-eyebrow">Noch keine Buchungen</p>
                    <h3>Dein Überblick beginnt mit der ersten Buchung.</h3>
                    <p>Einnahmen, Ausgaben und deine nächsten Aufgaben werden hier zusammengeführt.</p>
                    ${readonly ? '<p class="redesign-status">Lesezugang</p>' : `<button class="btn btn-primary" data-action="navigate" data-args='["buchungen"]'>Buchung erfassen</button>`}
                </section>
                <details class="redesign-details"><summary>Weitere Einstiege</summary>
                    <div class="redesign-link-row">
                        <button class="btn btn-outline" data-action="navigate" data-args='["rechnungen"]'>Rechnungen</button>
                        ${readonly ? '' : `<button class="btn btn-outline" data-action="navigate" data-args='["ausgaben"]'>Ausgabe erfassen</button>
                        <button class="btn btn-outline" data-action="navigate" data-args='["bankimport"]'>Kontoauszug importieren</button>`}
                        <button class="btn btn-outline" data-action="navigate" data-args='["akademie"]'>Buchhaltung lernen</button>
                    </div>
                </details>
            </div>`;
    },

    // ── Trial-Hinweis (Fund N2, Monetarisierungs-Audit 2026-08-12) ───────────────────────────
    // Whop führt den Trial mit hinterlegter Karte: 7 Tage, Abbuchung am Tag 8. Der Server kannte
    // 'trialing' längst, gab es aber nicht an den Client weiter — die App zeigte "Pro aktiv" und
    // verschwieg die anstehende Zahlung. Das ist die Konstellation, aus der Rückbuchungen
    // entstehen: testen, vergessen, am Tag 8 überrascht werden.
    //
    // Der Hinweis bleibt außerhalb eingeklappter Details sichtbar. Zeit und Abo-Bedingungen
    // bleiben erhalten; die Darstellung verwendet dieselben neutralen Flächen wie die App.
    _renderTrialHinweis() {
        if (typeof UserPlan === 'undefined' || !UserPlan.isTrialActive || !UserPlan.isTrialActive()) return '';
        const tage = UserPlan.getTrialDaysLeft ? UserPlan.getTrialDaysLeft() : null;
        const bis  = UserPlan.getRenewsAt ? UserPlan.getRenewsAt() : null;
        const datum = bis ? new Date(bis).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : null;

        // Ohne bekannten Zeitpunkt keine Zahl erfinden — dann nur die Tatsache nennen.
        const kopf = (tage === null)
            ? 'Deine Testphase läuft'
            : (tage === 0 ? 'Deine Testphase endet heute'
                          : `Deine Testphase endet in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}`);
        const detail = datum
            ? `Am <strong>${datum}</strong> wird dein Abo automatisch fortgesetzt (15 €/Monat, sofern du monatlich gebucht hast). Du musst nichts tun, wenn du dabeibleiben willst.`
            : 'Danach wird dein Abo automatisch fortgesetzt. Du musst nichts tun, wenn du dabeibleiben willst.';

        return `
            <div class="redesign-notice">
                <div style="padding:14px 16px;display:flex;gap:12px;align-items:flex-start;">
                    <div style="font-size:13px;line-height:1.55;">
                        <strong>${kopf}</strong><br>${detail}
                        <div style="margin-top:8px;font-size:12px;color:var(--text-muted);">
                            Abo verwalten oder kündigen kannst du jederzeit über dein Whop-Konto — siehe Kontomenü oben rechts.
                        </div>
                    </div>
                </div>
            </div>`;
    },

    render() {
        if (this._isFirstRun()) return this._renderFirstRun();

        const year = this._selectedYear;
        const startDate = `${year}-01-01`;
        const endDate   = `${year}-12-31`;

        const allPurchases = Store.getPurchases();
        const allSales     = Store.getSales();
        const allExpenses  = Store.getExpenses();

        const purchases = allPurchases.filter(p => Utils.isInPeriod(p.datum, startDate, endDate));
        const sales     = allSales.filter(s => Utils.isInPeriod(s.datum, startDate, endDate));
        const expenses  = allExpenses.filter(e => Utils.isInPeriod(e.datum, startDate, endDate));

        // Rechnungen (aus Rechnungsbuch)
        const allRechnungen   = Store.getRechInvoices ? Store.getRechInvoices() : [];
        const settings        = Store.getSettings();
        const isKlein         = (settings.ustMode || 'klein') === 'klein';

        // Bezahlte Rechnungen die noch nicht via autoSync in Sales gelandet sind
        const syncedIds = new Set(allSales.filter(s => s._invoiceId).map(s => s._invoiceId));
        const unsyncedRechnungen = allRechnungen.filter(inv => {
            if (inv.status !== 'bezahlt' || inv._storniert) return false;
            if (inv.typ !== 'rechnung' && inv.typ !== 'gutschrift') return false;
            if (syncedIds.has(inv.id)) return false;
            return Utils.isInPeriod(inv.bezahltAm || inv.datum, startDate, endDate);
        });
        const unsyncedRevenue = unsyncedRechnungen.reduce((sum, inv) => {
            const sign = inv.typ === 'gutschrift' ? -1 : 1;
            return sum + sign * (inv.positionen || []).reduce((s2, p) => {
                const n = (p.menge || 0) * (p.einzelpreis || 0);
                return s2 + n + (isKlein ? 0 : n * (p.mwstSatz || 0) / 100);
            }, 0);
        }, 0);

        // Offene Rechnungen (offen / versendet / überfällig) — alle Jahre
        const offeneRechnungen = allRechnungen.filter(inv =>
            inv.typ === 'rechnung' && !inv._storniert &&
            ['offen', 'versendet', 'ueberfaellig'].includes(inv.status)
        );
        const offeneSumme = offeneRechnungen.reduce((sum, inv) => {
            const brutto = (inv.positionen || []).reduce((s2, p) => {
                const n = (p.menge || 0) * (p.einzelpreis || 0);
                return s2 + n + (isKlein ? 0 : n * (p.mwstSatz || 0) / 100);
            }, 0);
            const geleistet = (inv.teilzahlungen || []).reduce((s2, t) => s2 + (parseFloat(t.betrag) || 0), 0);
            return sum + Math.max(0, brutto - geleistet);
        }, 0);
        const ueberfaelligCount = offeneRechnungen.filter(inv => inv.status === 'ueberfaellig').length;

        // Year totals
        const yearRevenue = sales.reduce((sum, s) => sum + (parseFloat(s.verkaufspreis) || 0), 0) + unsyncedRevenue;
        const yearPurchaseCost = purchases.reduce((sum, p) => sum + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0);
        const yearExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0);
        const yearShipping = sales.reduce((sum, s) => sum + (parseFloat(s.versandkostenVerkaufer) || 0), 0);
        const yearPlatformFees = sales.reduce((sum, s) => {
            const vk = parseFloat(s.verkaufspreis) || 0;
            const vkK = parseFloat(s.versandkostenKaeufer) || 0;
            const pct = parseFloat(s.plattformgebuehrProzent) || 0;
            return sum + (vk + vkK) * pct / 100;
        }, 0);
        const yearAllExpenses = yearPurchaseCost + yearExpenses + yearShipping + yearPlatformFees;
        const yearProfit = yearRevenue - yearAllExpenses;

        // Current month (within selected year)
        const now = new Date();
        const curMonth = now.getMonth();
        const curYear  = now.getFullYear();
        const isCurrentYear = year === curYear;
        const monthStart = `${year}-${String(curMonth + 1).padStart(2, '0')}-01`;
        const nextM = new Date(year, curMonth + 1, 0);
        const monthEnd = `${year}-${String(curMonth + 1).padStart(2, '0')}-${String(nextM.getDate()).padStart(2, '0')}`;

        const monthSales     = sales.filter(s => Utils.isInPeriod(s.datum, monthStart, monthEnd));
        const monthPurchases = purchases.filter(p => Utils.isInPeriod(p.datum, monthStart, monthEnd));
        const monthExpenses2 = expenses.filter(e => Utils.isInPeriod(e.datum, monthStart, monthEnd));

        const monthRevenue  = monthSales.reduce((sum, s) => sum + (parseFloat(s.verkaufspreis) || 0), 0);
        const monthCost     = monthPurchases.reduce((sum, p) => sum + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0)
                            + monthExpenses2.reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0)
                            + monthSales.reduce((sum, s) => sum + (parseFloat(s.versandkostenVerkaufer) || 0), 0)
                            + monthSales.reduce((sum, s) => {
                                const vk = parseFloat(s.verkaufspreis) || 0;
                                const vkK = parseFloat(s.versandkostenKaeufer) || 0;
                                const pct = parseFloat(s.plattformgebuehrProzent) || 0;
                                return sum + (vk + vkK) * pct / 100;
                              }, 0);
        const monthProfit = monthRevenue - monthCost;

        // Inventory (all-time, not filtered by year)
        const available = allPurchases.filter(p => p.status === 'verfuegbar');
        const inventoryCount = available.reduce((sum, p) => sum + (parseInt(p.anzahl) || 1), 0);
        const inventoryValue = available.reduce((sum, p) => sum + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0);

        // Last 5 bookings in selected year
        const allBookings = [
            ...expenses.map(e => ({ ...e, _type: 'Ausgabe', _amount: -(parseFloat(e.betrag) || 0) })),
            ...purchases.map(p => ({ ...p, _type: 'Einkauf',  _amount: -(parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1) })),
            ...sales.map(s    => ({ ...s,  _type: s._typ === 'rechnung' ? 'Rechnung' : s._typ === 'gutschrift' ? 'Gutschrift' : 'Verkauf', _amount: parseFloat(s.verkaufspreis) || 0 })),
            ...unsyncedRechnungen.map(inv => ({
                datum: inv.bezahltAm || inv.datum, marke: 'Rechnung', artikeltyp: inv.nummer || '', beschreibung: '',
                _type: inv.typ === 'gutschrift' ? 'Gutschrift' : 'Rechnung',
                _amount: (inv.typ === 'gutschrift' ? -1 : 1) * (inv.positionen || []).reduce((s2, p) => s2 + (p.menge || 0) * (p.einzelpreis || 0), 0)
            }))
        ].sort((a, b) => (b.datum || '').localeCompare(a.datum || '')).slice(0, 5);

        let bookingsRows = '';
        if (allBookings.length === 0) {
            bookingsRows = `<tr><td colspan="5" class="table-empty">Keine Buchungen in ${year}</td></tr>`;
        } else {
            bookingsRows = allBookings.map(b => `
                <tr>
                    <td>${Utils.formatDate(b.datum)}</td>
                    <td><span class="badge ${b._type === 'Verkauf' ? 'badge-success' : b._type === 'Rechnung' ? 'badge-warning' : 'badge-info'}">${b._type}</span></td>
                    <td>${Utils.escapeHtml(b.marke || '')} ${Utils.escapeHtml(b.artikeltyp || '')}</td>
                    <td>${Utils.escapeHtml(b.beschreibung || '')}</td>
                    <td style="text-align:right">${Utils.formatCurrency(b._amount)}</td>
                </tr>
            `).join('');
        }

        // Year switcher dropdown
        const minYear = 2020;
        const maxYear = new Date().getFullYear() + 2;
        const yearOptions = Array.from({length: maxYear - minYear + 1}, (_, i) => minYear + i)
            .map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');
        const yearBtns = `<select class="year-select" id="yearSelect">${yearOptions}</select>`;

        // Derived metrics
        const monthsElapsed    = isCurrentYear ? (curMonth + 1) : 12;
        const avgMonthlyProfit = monthsElapsed > 0 ? yearProfit / monthsElapsed : 0;
        const marginPct        = yearRevenue > 0 ? (yearProfit / yearRevenue * 100) : 0;

        const readonly = Store._isReadonlyCompany && Store._isReadonlyCompany();
        const hasPeriodData = purchases.length + sales.length + expenses.length + unsyncedRechnungen.length > 0;
        const metric = (value) => hasPeriodData ? Utils.formatCurrency(value) : 'Noch keine Daten';

        return `
            <div class="redesign-dashboard">
                <div class="page-header redesign-page-heading">
                    <div><p class="redesign-eyebrow">Dein Geschäft im Blick</p><h2>Übersicht</h2></div>
                    <div class="page-header-actions">
                        <div class="redesign-period"><label for="yearSelect">Jahr</label>${yearBtns}</div>
                        ${readonly ? '<span class="redesign-status">Lesezugang</span>' : `<button class="btn btn-primary" data-action="navigate" data-args='["buchungen"]'>Buchung erfassen</button>`}
                    </div>
                </div>

                ${this._renderTrialHinweis()}

                <section class="redesign-kpis" aria-label="Geschäftszahlen ${year}">
                    <div class="redesign-kpi"><h3>Einnahmen</h3><p class="redesign-kpi-value amount">${metric(yearRevenue)}</p><p>Erfasste Einnahmen · ${year}</p></div>
                    <div class="redesign-kpi"><h3>Ausgaben</h3><p class="redesign-kpi-value amount">${metric(yearAllExpenses)}</p><p>Einkäufe und laufende Kosten · ${year}</p></div>
                    <div class="redesign-kpi"><h3>Gewinn</h3><p class="redesign-kpi-value amount">${metric(yearProfit)}</p><p>Einnahmen abzüglich erfasster Kosten</p></div>
                </section>
                <p class="redesign-caption">Betrieblicher Überblick, kein Kontostand. Die steuerliche Gewinnermittlung findest du unter <button class="redesign-text-link" data-action="navigate" data-args='["euer"]'>Jahresgewinn</button>.</p>

                ${this._renderNextTasks(offeneRechnungen, expenses)}

                <section class="redesign-section" aria-labelledby="dashRecentHeading">
                    <div class="redesign-section-heading"><h3 id="dashRecentHeading">Letzte Vorgänge</h3><button class="btn btn-outline" data-action="navigate" data-args='["buchungen"]'>Alle Buchungen</button></div>
                    ${allBookings.length ? `<div class="table-container redesign-table-scroll" role="region" aria-label="Letzte fünf Vorgänge ${year}" tabindex="0"><table>
                        <thead><tr><th scope="col">Datum</th><th scope="col">Art</th><th scope="col">Artikel</th><th scope="col">Beschreibung</th><th scope="col" class="amount">Betrag</th></tr></thead>
                        <tbody>${bookingsRows}</tbody>
                    </table></div>` : `<div class="redesign-empty redesign-empty-compact"><h4>Noch keine Vorgänge für ${year}</h4><p>Wähle ein anderes Jahr oder erfasse eine Buchung für diesen Zeitraum.</p></div>`}
                </section>

                <details class="redesign-details" id="dashAnalysis"><summary>Entwicklung ansehen</summary>
                    <div class="redesign-detail-content">
                        <section class="redesign-section"><h3>Einnahmen und Ausgaben ${year}</h3><p class="redesign-caption">Erfasste Verkäufe, Einkäufe und Kosten nach Buchungsdatum. Einnahmen: durchgezogene Linie. Ausgaben: gestrichelt.</p><div id="dashChart" class="redesign-chart" aria-hidden="true"></div><div id="dashChartData"></div></section>
                        <section class="redesign-section"><h3>Gewinn der letzten zwölf Monate</h3><p class="redesign-caption">Erfasste Verkäufe abzüglich Einkäufen und laufenden Kosten; Zeitraum unabhängig vom gewählten Jahr.</p><div id="dashChartGewinn" class="redesign-chart" aria-hidden="true"></div><div id="dashChartGewinnData"></div></section>
                        <section class="redesign-section"><h3>Jahresvergleich</h3><p class="redesign-caption">Werte aus der EÜR-Berechnung. Einnahmen: durchgezogene Linie. Ausgaben: gestrichelt. Gewinn: gepunktet.</p><div id="dashChartJahres" class="redesign-chart" aria-hidden="true"></div>${this._renderJahresvergleich(year)}</section>
                    </div>
                </details>

                <details class="redesign-details"><summary>Weitere Kennzahlen und Berechnungsbasis</summary>
                    <div class="redesign-detail-content">
                        <dl class="redesign-metric-list">
                            <div><dt>Gewinn ${Utils.getMonthName(curMonth)} ${year}</dt><dd>${Utils.formatCurrency(monthProfit)}</dd></div>
                            <div><dt>Durchschnittlicher Monatsgewinn (${monthsElapsed} Monate)</dt><dd>${Utils.formatCurrency(avgMonthlyProfit)}</dd></div>
                            <div><dt>Gewinn im Verhältnis zu Einnahmen</dt><dd>${marginPct.toFixed(1)} %</dd></div>
                            <div><dt>Verfügbare Artikel · alle Jahre</dt><dd>${inventoryCount} · ${Utils.formatCurrency(inventoryValue)}</dd></div>
                            <div><dt>Offene Rechnungen · alle Jahre</dt><dd>${offeneRechnungen.length} · ${Utils.formatCurrency(offeneSumme)}${ueberfaelligCount ? ` · ${ueberfaelligCount} überfällig` : ''}</dd></div>
                        </dl>
                        <p>Die Übersicht verwendet erfasste Verkaufsbeträge und noch nicht übernommene bezahlte Rechnungen. Kosten enthalten Einkäufe, Ausgaben, Verkäufer-Versand und Plattformgebühren. Monatliche Verläufe verwenden die bereits übernommenen Verkäufe.</p>
                        <p>Abschreibungen und weitere Fachmodule fließen in die steuerliche Gewinnermittlung ein. Die Zahlen dieser Übersicht können deshalb vom Jahresgewinn in der EÜR abweichen.</p>
                        ${(typeof GbR !== 'undefined') ? GbR.renderDashboardKacheln(yearProfit) : ''}
                        ${this._renderTopMarkenWidget(allSales, allPurchases, year)}
                        <div class="redesign-link-row"><button class="btn btn-outline" data-action="navigate" data-args='["statistiken"]'>Auswertungen öffnen</button><button class="btn btn-outline" data-action="navigate" data-args='["akademie"]'>Lernfortschritt ansehen</button></div>
                    </div>
                </details>
            </div>`;
    },

    // Hinweise stammen ausschließlich aus vorhandenen Daten; keine neue Pflichtenermittlung.
    _renderNextTasks(invoices, expenses) {
        const tasks = [];
        const overdue = invoices.filter(i => i.status === 'ueberfaellig');
        if (overdue.length) tasks.push({ title: 'Überfällige Rechnungen prüfen', detail: `${overdue.length} Rechnungen sind als überfällig markiert.`, page: 'rechnungen', action: 'Rechnungen ansehen' });
        const today = Utils.todayISO();
        const soon = new Date();
        soon.setDate(soon.getDate() + 14);
        const until = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
        const custom = Store.getSteuertermine ? Store.getSteuertermine() : [];
        const ust = typeof Steuertermine !== 'undefined' && Steuertermine._ustTermine ? Steuertermine._ustTermine(new Date().getFullYear()) : [];
        const next = custom.concat(ust).filter(t => t.datum >= today && t.datum <= until).sort((a, b) => a.datum.localeCompare(b.datum))[0];
        if (next) tasks.push({ title: 'Nächsten Termin vorbereiten', detail: `${Utils.formatDate(next.datum)} · ${next.beschreibung || 'Eigener Termin'}`, page: 'steuertermine', action: 'Termine ansehen' });
        const withoutReceipt = expenses.filter(e => !e.belegFoto && !e.belegNr);
        if (withoutReceipt.length) tasks.push({ title: 'Belegangaben prüfen', detail: `${withoutReceipt.length} Ausgaben im gewählten Jahr haben weder Belegnummer noch Belegfoto.`, page: 'ausgaben', action: 'Ausgaben ansehen' });
        if (!tasks.length && invoices.length) tasks.push({ title: 'Offene Rechnungen im Blick behalten', detail: `${invoices.length} Rechnungen mit offenem Zahlungsstatus.`, page: 'rechnungen', action: 'Rechnungen ansehen' });
        return `<section class="redesign-section" aria-labelledby="dashTasksHeading"><div class="redesign-section-heading"><h3 id="dashTasksHeading">Als Nächstes</h3><button class="redesign-text-link" data-action="navigate" data-args='["steuertermine"]'>Alle Termine</button></div>
            ${tasks.length ? `<ul class="redesign-task-list">${tasks.slice(0, 3).map(t => `<li><div><h4>${Utils.escapeHtml(t.title)}</h4><p>${Utils.escapeHtml(t.detail)}</p></div><button class="btn btn-outline" data-action="navigate" data-args='["${t.page}"]'>${t.action}</button></li>`).join('')}</ul>` : '<p class="redesign-quiet-state">Aus deinen erfassten Daten ergeben sich gerade keine nächsten Aufgaben.</p>'}</section>`;
    },

    init() {
        // Bezahlte Rechnungen immer synchronisieren wenn Dashboard geöffnet wird
        Store.autoSyncInvoices();

        // First-Run-Ansicht hat weder Chart-Container noch Jahreswähler. ApexCharts (~600 KB)
        // hier gar nicht erst nachladen — es gäbe nichts zu zeichnen.
        if (this._isFirstRun()) return;

        const yearSelect = document.getElementById('yearSelect');
        if (yearSelect) yearSelect.addEventListener('change', () => {
            this._selectedYear = parseInt(yearSelect.value);
            this._refresh();
        });

        const analysis = document.getElementById('dashAnalysis');
        if (analysis) analysis.addEventListener('toggle', () => {
            if (analysis.open) this._ensureApexCharts();
        });
        if (!this._themeBound && typeof window !== 'undefined') {
            this._themeBound = true;
            window.addEventListener('themechange', () => {
                const panel = document.getElementById('dashAnalysis');
                if (panel && panel.open) this._ensureApexCharts();
            });
        }
    },

    _refresh() {
        if (this._chart) { this._chart.destroy(); this._chart = null; }
        if (this._chartJahres) { this._chartJahres.destroy(); this._chartJahres = null; }
        if (this._chartGewinn) { this._chartGewinn.destroy(); this._chartGewinn = null; }
        const contentEl = document.getElementById('content');
        contentEl.innerHTML = this.render();
        this.init();
    },

    // Einnahmen, Ausgaben und Gewinn kommen aus der EÜR — hier wird nicht zweitgerechnet.
    //
    // Bis zum 2026-09-09 stand hier eine eigene Formel. Sie ließ AfA, Fahrtkosten, Eigenbelege,
    // Materialverbrauch und Retouren aus und zählte den vom Käufer gezahlten Versand nicht als
    // Einnahme, obwohl sie die Plattformgebühr sehr wohl auf ihn berechnete (Fund A1/A3,
    // plan/funde-vollaudit-2026-09-09.md). Die Spalte hieß trotzdem "Gewinn" und stand damit
    // neben einer EÜR, die für dasselbe Jahr etwas anderes sagte.
    //
    // Bei Regelbesteuerung sind die Werte damit NETTO (die vereinnahmte USt ist ein
    // Durchlaufposten und kein Gewinn) — vorher waren sie brutto.
    //
    // anzahl/avgVK bleiben Vertriebskennzahlen und werden weiter direkt aus den Verkäufen
    // gebildet: "Ø Verkaufspreis" ist der Verkaufspreis, nicht der anteilige Gewinn.
    _getYearStats(year) {
        if (typeof Euer === 'undefined' || typeof Euer._berechne !== 'function') {
            console.error('[Dashboard] js/euer.js nicht geladen — keine Jahreszahlen ermittelbar');
            return { einnahmen: 0, ausgaben: 0, gewinn: 0, marge: 0, anzahl: 0, avgVK: 0 };
        }
        const d = Euer._berechne(year, 0, 'jahr');
        const anzahl = d.sales.length;
        const vkSumme = d.sales.reduce((sum, s) => sum + (parseFloat(s.verkaufspreis) || 0), 0);
        return {
            einnahmen: d.summeEinnahmen,
            ausgaben:  d.summeAusgaben,
            gewinn:    d.gewinn,
            marge:     d.summeEinnahmen > 0 ? (d.gewinn / d.summeEinnahmen * 100) : 0,
            anzahl:    anzahl,
            avgVK:     anzahl > 0 ? vkSumme / anzahl : 0,
        };
    },

    _renderJahresvergleich(currentYear) {
        const years = [currentYear - 2, currentYear - 1, currentYear].filter(y => y >= 2020);
        if (years.length < 2) return '';
        const L = (typeof I18n !== 'undefined') ? I18n : { t: function(k) { return k; } };
        const stats = years.map(y => ({ year: y, ...this._getYearStats(y) }));
        const rows = [
            { label: L.t('table.revenue'), key: 'einnahmen', fmt: v => Utils.formatCurrency(v) },
            { label: L.t('table.expenses'), key: 'ausgaben', fmt: v => Utils.formatCurrency(v) },
            { label: L.t('table.profit'), key: 'gewinn', fmt: v => Utils.formatCurrency(v) },
            { label: L.t('table.margin'), key: 'marge', fmt: v => v.toFixed(1) + '%' },
            { label: L.t('table.sales'), key: 'anzahl', fmt: v => v },
            { label: L.t('table.avg.price'), key: 'avgVK', fmt: v => Utils.formatCurrency(v) }
        ];
        const headerCells = stats.map(s => `<th scope="col" class="amount">${s.year}</th>`).join('');
        const tableRows = rows.map(r => {
            const cells = stats.map(s => {
                const val = s[r.key];
                return `<td class="amount">${r.fmt(val)}</td>`;
            }).join('');
            return `<tr><th scope="row">${r.label}</th>${cells}</tr>`;
        }).join('');

        return `
            <div class="redesign-year-comparison">
                <div class="table-container redesign-table-scroll" role="region" aria-label="Jahresvergleich" tabindex="0">
                    <table><caption>Jahresvergleich aus der EÜR</caption>
                        <thead><tr><th scope="col">Kennzahl</th>${headerCells}</tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>`;
    },

    _renderGewinnChart() {
        const el = document.getElementById('dashChartGewinn');
        if (!el) return;
        if (this._chartGewinn) { this._chartGewinn.destroy(); this._chartGewinn = null; }

        // Theme.isDark() statt matchMedia: matchMedia kennt nur die Systemeinstellung
        // und liefert die falsche Palette, sobald jemand manuell umgeschaltet hat.
        const isDark    = (typeof Theme !== 'undefined') ? Theme.isDark()
                        : window.matchMedia('(prefers-color-scheme: dark)').matches;
        const palette = this._chartPalette();
        const textColor = palette.muted;
        const allSales = Store.getSales(), allPurchases = Store.getPurchases(), allExpenses = Store.getExpenses();

        const labels = [], gewinne = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d      = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
            const mEnd   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
            labels.push(Utils.getMonthShort(d.getMonth()) + ' ' + d.getFullYear().toString().substr(2));
            const mSales = allSales.filter(s => Utils.isInPeriod(s.datum, mStart, mEnd));
            const mPurch = allPurchases.filter(p => Utils.isInPeriod(p.datum, mStart, mEnd));
            const mExp   = allExpenses.filter(e => Utils.isInPeriod(e.datum, mStart, mEnd));
            const ein = mSales.reduce((s, x) => s + (parseFloat(x.verkaufspreis) || 0), 0);
            const aus = mPurch.reduce((s, x) => s + (parseFloat(x.einkaufspreis) || 0) * (parseInt(x.anzahl) || 1), 0)
                      + mExp.reduce((s, x) => s + (parseFloat(x.betrag) || 0), 0)
                      + mSales.reduce((s, x) => s + (parseFloat(x.versandkostenVerkaufer) || 0), 0)
                      + mSales.reduce((s, x) => { const vk = parseFloat(x.verkaufspreis)||0, vkK = parseFloat(x.versandkostenKaeufer)||0, pct = parseFloat(x.plattformgebuehrProzent)||0; return s + (vk+vkK)*pct/100; }, 0);
            gewinne.push(parseFloat((ein - aus).toFixed(2)));
        }

        this._renderChartData('dashChartGewinnData', 'Gewinn der letzten zwölf Monate', labels, [{ name: 'Gewinn', data: gewinne }]);
        if (typeof ApexCharts === 'undefined') return;
        this._chartGewinn = new ApexCharts(el, {
            chart: { type: 'line', height: 220, background: 'transparent', toolbar: { show: false }, fontFamily: 'inherit', animations: { enabled: false } },
            theme: { mode: isDark ? 'dark' : 'light' },
            series: [{ name: (typeof I18n !== 'undefined' ? I18n.t('chart.profit') : 'Gewinn'), data: gewinne }],
            colors: [palette.text],
            stroke: { curve: 'straight', width: 2 },
            markers: { size: 3, colors: [palette.text], strokeWidth: 0 },
            xaxis: { categories: labels, labels: { style: { colors: textColor, fontSize: '14px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
            yaxis: { labels: { style: { colors: textColor, fontSize: '14px' }, formatter: v => Utils.formatCurrency(v) } },
            grid: { borderColor: palette.border, strokeDashArray: 4 },
            tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => Utils.formatCurrency(v) } },
            dataLabels: { enabled: false }, legend: { show: false }
        });
        this._chartGewinn.render();

        // Jahresvergleich chart
        const elJ = document.getElementById('dashChartJahres');
        if (this._chartJahres) { this._chartJahres.destroy(); this._chartJahres = null; }
        if (elJ) {
            const cy    = this._selectedYear;
            const years = [cy - 2, cy - 1, cy].filter(y => y >= 2020);
            const stats = years.map(y => this._getYearStats(y));
            this._chartJahres = new ApexCharts(elJ, {
                chart: { type: 'line', height: 220, background: 'transparent', toolbar: { show: false }, fontFamily: 'inherit', animations: { enabled: false } },
                theme: { mode: isDark ? 'dark' : 'light' },
                series: [
                    { name: (typeof I18n !== 'undefined' ? I18n.t('chart.revenue')  : 'Einnahmen'), data: stats.map(s => parseFloat(s.einnahmen.toFixed(2))) },
                    { name: (typeof I18n !== 'undefined' ? I18n.t('chart.expenses') : 'Ausgaben'),  data: stats.map(s => parseFloat(s.ausgaben.toFixed(2)))  },
                    { name: (typeof I18n !== 'undefined' ? I18n.t('chart.profit')   : 'Gewinn'),    data: stats.map(s => parseFloat(s.gewinn.toFixed(2)))    }
                ],
                colors: [palette.text, palette.text, palette.text],
                stroke: { curve: 'straight', width: 2, dashArray: [0, 6, 2] },
                markers: { size: [3, 0, 0] },
                xaxis: { categories: years.map(String), labels: { style: { colors: textColor, fontSize: '14px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
                yaxis: { labels: { style: { colors: textColor, fontSize: '14px' }, formatter: v => Utils.formatCurrency(v) } },
                grid: { borderColor: palette.border, strokeDashArray: 4 },
                legend: { labels: { colors: textColor }, fontSize: '14px' },
                tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => Utils.formatCurrency(v) } },
                dataLabels: { enabled: false }
            });
            this._chartJahres.render();
        }
    },

    _renderTopMarkenWidget(allSales, allPurchases, year) {
        // Only use sales from the selected year
        const startDate = `${year}-01-01`;
        const endDate   = `${year}-12-31`;
        const sales = allSales.filter(s => Utils.isInPeriod(s.datum, startDate, endDate));
        if (!sales.length) return '';

        const brandMap = {};
        sales.forEach(s => {
            const brand = s.marke || 'Unbekannt';
            let ek = 0;
            if (s.purchaseIds && s.purchaseIds.length > 0) {
                s.purchaseIds.forEach(pid => {
                    const p = allPurchases.find(x => x.id === pid);
                    if (p) ek += parseFloat(p.einkaufspreis) || 0;
                });
            } else if (s.purchaseId) {
                const p = allPurchases.find(x => x.id === s.purchaseId);
                if (p) ek = parseFloat(p.einkaufspreis) || 0;
            }
            const net = Utils.calculateNetRevenue(s.verkaufspreis, s.versandkostenKaeufer, s.plattformgebuehrProzent, s.versandkostenVerkaufer);
            if (!brandMap[brand]) brandMap[brand] = { count: 0, totalNet: 0, totalGewinn: 0 };
            brandMap[brand].count++;
            brandMap[brand].totalNet    += net;
            brandMap[brand].totalGewinn += net - ek;
        });

        const top = Object.entries(brandMap)
            .sort((a, b) => b[1].totalGewinn - a[1].totalGewinn)
            .slice(0, 5);

        if (!top.length) return '';

        const rows = top.map(([brand, v]) => {
            const marge = v.totalNet > 0 ? v.totalGewinn / v.totalNet * 100 : 0;
            return `<tr><th scope="row">${Utils.escapeHtml(brand)}</th><td class="amount">${v.count}</td><td class="amount">${marge.toFixed(0)} %</td><td class="amount">${Utils.formatCurrency(v.totalGewinn)}</td></tr>`;
        }).join('');
        return `<section class="redesign-section"><div class="redesign-section-heading"><h3>Markenvergleich ${year}</h3><button class="redesign-text-link" data-action="navigate" data-args='["statistiken"]'>Auswertung ansehen</button></div>
            <div class="table-container redesign-table-scroll" role="region" aria-label="Markenvergleich ${year}" tabindex="0"><table>
                <thead><tr><th scope="col">Marke</th><th scope="col" class="amount">Verkäufe</th><th scope="col" class="amount">Marge</th><th scope="col" class="amount">Verkaufsergebnis</th></tr></thead><tbody>${rows}</tbody>
            </table></div></section>`;
    },

    _renderChart() {
        const el = document.getElementById('dashChart');
        if (!el) return;
        if (this._chart) { this._chart.destroy(); this._chart = null; }

        const year      = this._selectedYear;
        const sales     = Store.getSales();
        const purchases = Store.getPurchases();
        const expenses  = Store.getExpenses();
        // Theme.isDark() statt matchMedia: matchMedia kennt nur die Systemeinstellung
        // und liefert die falsche Palette, sobald jemand manuell umgeschaltet hat.
        const isDark    = (typeof Theme !== 'undefined') ? Theme.isDark()
                        : window.matchMedia('(prefers-color-scheme: dark)').matches;
        const palette = this._chartPalette();
        const textColor = palette.muted;

        const labels = [], einnahmen = [], ausgaben = [];
        for (let m = 0; m < 12; m++) {
            labels.push(Utils.getMonthShort(m));
            const monthStart = `${year}-${String(m + 1).padStart(2, '0')}-01`;
            const nextM      = new Date(year, m + 1, 1);
            const monthEnd   = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, '0')}-01`;
            const inPeriod   = d => d >= monthStart && d < monthEnd;
            const rev = sales.filter(s => inPeriod(s.datum)).reduce((sum, s) => sum + (parseFloat(s.verkaufspreis) || 0), 0);
            einnahmen.push(parseFloat(rev.toFixed(2)));
            const pc = purchases.filter(p => inPeriod(p.datum)).reduce((sum, p) => sum + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0);
            const ec = expenses.filter(e => inPeriod(e.datum)).reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0);
            const sc = sales.filter(s => inPeriod(s.datum)).reduce((sum, s) => sum + (parseFloat(s.versandkostenVerkaufer) || 0), 0);
            const fc = sales.filter(s => inPeriod(s.datum)).reduce((sum, s) => {
                const vk = parseFloat(s.verkaufspreis) || 0, vkK = parseFloat(s.versandkostenKaeufer) || 0, pct = parseFloat(s.plattformgebuehrProzent) || 0;
                return sum + (vk + vkK) * pct / 100;
            }, 0);
            ausgaben.push(parseFloat((pc + ec + sc + fc).toFixed(2)));
        }

        this._renderChartData('dashChartData', 'Einnahmen und Ausgaben ' + year, labels, [{ name: 'Einnahmen', data: einnahmen }, { name: 'Ausgaben', data: ausgaben }]);
        if (typeof ApexCharts === 'undefined') return;
        this._chart = new ApexCharts(el, {
            chart: { type: 'line', height: 220, background: 'transparent', toolbar: { show: false }, fontFamily: 'inherit', animations: { enabled: false } },
            theme: { mode: isDark ? 'dark' : 'light' },
            series: [{ name: 'Einnahmen', data: einnahmen }, { name: 'Ausgaben', data: ausgaben }],
            colors: [palette.text, palette.text],
            stroke: { curve: 'straight', width: 2, dashArray: [0, 6] },
            markers: { size: [3, 0] },
            xaxis: { categories: labels, labels: { style: { colors: textColor, fontSize: '14px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
            yaxis: { labels: { style: { colors: textColor, fontSize: '14px' }, formatter: v => Utils.formatCurrency(v) } },
            grid: { borderColor: palette.border, strokeDashArray: 4 },
            legend: { labels: { colors: textColor }, fontSize: '14px' },
            tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => Utils.formatCurrency(v) } },
            dataLabels: { enabled: false }
        });
        this._chart.render();
    },

    _animateIn() {
        if (typeof gsap === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const cards = document.querySelectorAll('.stat-card');
        if (!cards.length) return;
        gsap.from(cards, { y: 20, opacity: 0, stagger: 0.07, duration: 0.5, ease: 'power2.out', clearProps: 'all' });
        cards.forEach(card => {
            const valEl = card.querySelector('.card-value');
            if (!valEl) return;
            const raw = valEl.textContent.trim();
            // Skip ratio/mixed values like "10 / 27" or values without a single number
            if (raw.includes('/') || raw.includes(' ')) return;
            const num = parseFloat(raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
            if (isNaN(num) || num === 0) return;
            const isNeg = num < 0, hasCurrency = raw.includes('€');
            const obj = { val: 0 };
            gsap.to(obj, {
                val: Math.abs(num), duration: 1.2, ease: 'power2.out',
                onUpdate() {
                    valEl.textContent = hasCurrency
                        ? (isNeg ? '-' : '') + obj.val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
                        : Math.round(obj.val).toLocaleString('de-DE');
                },
                onComplete() { valEl.textContent = raw; }
            });
        });
    }
};
