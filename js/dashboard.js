// ============================================
// Dashboard Module
// ============================================
const Dashboard = {
    _chart: null,
    _chartJahres: null,
    _chartGewinn: null,
    _selectedYear: new Date().getFullYear(),

    /** Lazy-loads ApexCharts (~600KB) only when dashboard is opened, then renders charts */
    _ensureApexCharts() {
        if (typeof ApexCharts !== 'undefined') {
            this._renderChart();
            this._renderGewinnChart();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/apexcharts@3.54.1/dist/apexcharts.min.js';
        script.integrity = 'sha384-KNaFJ+EK516RuHsoycvreec5pD7BkTKJEkjMrVSQWu9KGTl7En4dhIDv7t1DFJ+g';
        script.crossOrigin = 'anonymous';
        script.onload = () => { this._renderChart(); this._renderGewinnChart(); };
        script.onerror = () => console.warn('[Dashboard] ApexCharts failed to load');
        document.head.appendChild(script);
    },

    /** Noch keinerlei Daten erfasst — dann ist die KPI-Ansicht sinnlos (sechs 0,00-€-Kacheln
     *  und zwei leere Diagramme direkt nach dem Onboarding). Bewusst über alle Jahre geprüft,
     *  nicht nur über das gewählte: wer 2025 gebucht hat und 2026 anschaut, will die Nullen
     *  sehen — er weiß, warum sie da stehen. */
    _isFirstRun() {
        if (Store.getPurchases().length || Store.getSales().length || Store.getExpenses().length) return false;
        const rech = Store.getRechInvoices ? Store.getRechInvoices() : [];
        return rech.length === 0;
    },

    /** Startbildschirm ohne Daten: drei konkrete nächste Schritte statt leerer Auswertung. */
    _renderFirstRun() {
        const firma = (Store.getSettings().firmenname || '').trim();
        return `
            <div class="page-header">
                <h2>${firma ? 'Willkommen, ' + Utils.escapeHtml(firma) : 'Willkommen bei Stackr'}</h2>
            </div>

            <div class="empty-state" style="padding:32px 20px 24px;">
                <div class="icon"><i class="ti ti-rocket"></i></div>
                <h3>Dein Konto ist eingerichtet — jetzt fehlen nur noch Daten</h3>
                <p style="max-width:520px;margin:0 auto;line-height:1.7;">
                    Sobald die ersten Buchungen erfasst sind, erscheint hier deine Auswertung:
                    Umsatz, Gewinn, offene Rechnungen und die Zahlen für EÜR und
                    Umsatzsteuer-Voranmeldung. Womit möchtest du anfangen?
                </p>
            </div>

            <div class="quick-actions" style="justify-content:center;margin-bottom:28px;">
                <button class="quick-action" data-action="navigate" data-args='["rechnungen"]' style="max-width:220px;">
                    <span class="icon"><i class="ti ti-file-invoice"></i></span>
                    <strong style="font-size:14px;color:var(--text-primary);">Erste Rechnung schreiben</strong>
                    <span>Kunde anlegen, Positionen erfassen, als PDF oder E-Rechnung ausgeben</span>
                </button>
                <button class="quick-action" data-action="navigate" data-args='["ausgaben"]' style="max-width:220px;">
                    <span class="icon"><i class="ti ti-receipt-2"></i></span>
                    <strong style="font-size:14px;color:var(--text-primary);">Ausgabe erfassen</strong>
                    <span>Betriebsausgaben mit Kategorie und Beleg — Grundlage der EÜR</span>
                </button>
                <button class="quick-action" data-action="navigate" data-args='["bankimport"]' style="max-width:220px;">
                    <span class="icon"><i class="ti ti-building-bank"></i></span>
                    <strong style="font-size:14px;color:var(--text-primary);">Kontoauszug importieren</strong>
                    <span>CAMT.053, MT940 oder CSV aus dem Online-Banking</span>
                </button>
            </div>

            <p style="text-align:center;color:var(--text-muted);font-size:12.5px;line-height:1.7;">
                Lieber erst verstehen, wie Buchhaltung funktioniert?
                <button class="btn btn-small" data-action="navigate" data-args='["akademie"]' style="margin-left:6px;">Zur Akademie</button>
            </p>
        `;
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

        // Akademie card (computed once, used below)
        const akademieCard = (() => {
            if (typeof Akademie === 'undefined') return '';
            try {
                const prog = Akademie._getProgress();
                const totalAch = Akademie.ACHIEVEMENTS.length;
                const totalLessons = Akademie.MODULES.reduce((s, m) => s + m.lessons.length, 0);
                const lessonPct = totalLessons > 0 ? Math.round(prog.completedLessons.length / totalLessons * 100) : 0;
                const L = (typeof I18n !== 'undefined') ? I18n : { t: function(k,v) { return k; } };
                return `<div class="card stat-card" id="dashAkademieWidget" style="cursor:pointer;">
                    <div class="card-label"><i class="ti ti-school"></i> ${L.t('dash.academy')}</div>
                    <div class="card-value">${prog.unlockedAchievements.length} / ${totalAch}</div>
                    <div class="card-subtitle">${L.t('dash.pct.learned', {n: lessonPct})}</div>
                </div>`;
            } catch(e) { return ''; }
        })();

        const L = (typeof I18n !== 'undefined') ? I18n : { t: function(k, v) { return k; } };

        return `
            <div class="page-header">
                <h2>Dashboard</h2>
            </div>

            <div class="year-switcher">
                ${yearBtns}
            </div>

            <!-- Primary KPIs: 4 main financial metrics -->
            <div class="stats-grid-primary">
                <div class="card stat-card success">
                    <div class="card-label"><i class="ti ti-trending-up"></i> ${L.t('dash.revenue')} ${year}</div>
                    <div class="card-value">${Utils.formatCurrency(yearRevenue)}</div>
                    <div class="card-subtitle">${L.t('dash.sales.count', {n: sales.length})}</div>
                </div>
                <div class="card stat-card danger">
                    <div class="card-label"><i class="ti ti-trending-down"></i> ${L.t('dash.expenses')} ${year}</div>
                    <div class="card-value">${Utils.formatCurrency(yearAllExpenses)}</div>
                    <div class="card-subtitle">${L.t('dash.buy.costs')}</div>
                </div>
                <div class="card stat-card ${monthProfit >= 0 ? 'success' : 'danger'}">
                    <div class="card-label"><i class="ti ti-calendar-stats"></i> ${L.t('dash.profit.month', {m: Utils.getMonthShort(curMonth)})}</div>
                    <div class="card-value">${Utils.formatCurrency(monthProfit)}</div>
                    <div class="card-subtitle">${Utils.getMonthName(curMonth)} ${year}</div>
                </div>
                <div class="card stat-card ${yearProfit >= 0 ? 'success' : 'danger'}">
                    <div class="card-label"><i class="ti ti-chart-bar"></i> ${L.t('dash.profit.year', {y: year})}</div>
                    <div class="card-value">${Utils.formatCurrency(yearProfit)}</div>
                    <div class="card-subtitle">${L.t('dash.annual.profit')}</div>
                </div>
            </div>

            <!-- Secondary metrics: smaller operational cards -->
            <div class="stats-grid-secondary">
                <div class="card stat-card ${avgMonthlyProfit >= 0 ? 'success' : 'danger'}">
                    <div class="card-label"><i class="ti ti-calendar-repeat"></i> ${L.t('dash.avg.profit')}</div>
                    <div class="card-value">${Utils.formatCurrency(avgMonthlyProfit)}</div>
                    <div class="card-subtitle">${L.t('dash.months.elapsed', {n: monthsElapsed})}</div>
                </div>
                <div class="card stat-card ${marginPct >= 20 ? 'success' : marginPct >= 0 ? 'warning' : 'danger'}">
                    <div class="card-label"><i class="ti ti-percentage"></i> ${L.t('dash.margin')}</div>
                    <div class="card-value">${marginPct.toFixed(1)}%</div>
                    <div class="card-subtitle">${L.t('dash.profit.revenue')}</div>
                </div>
                <div class="card stat-card info">
                    <div class="card-label"><i class="ti ti-package"></i> ${L.t('dash.inventory')}</div>
                    <div class="card-value">${inventoryCount}</div>
                    <div class="card-subtitle">${Utils.formatCurrency(inventoryValue)}</div>
                </div>
                ${offeneSumme > 0 ? `
                <div class="card stat-card ${ueberfaelligCount > 0 ? 'danger' : 'warning'}">
                    <div class="card-label"><i class="ti ti-file-invoice"></i> ${L.t('dash.open.invoices')}</div>
                    <div class="card-value">${Utils.formatCurrency(offeneSumme)}</div>
                    <div class="card-subtitle">${L.t('dash.invoices.count', {n: offeneRechnungen.length})}${ueberfaelligCount > 0 ? ` · <span style="color:var(--danger)">${L.t('dash.overdue', {n: ueberfaelligCount})}</span>` : ''}</div>
                </div>` : ''}
                ${akademieCard}
            </div>

            ${(typeof GbR !== 'undefined') ? GbR.renderDashboardKacheln(yearProfit) : ''}

            <!-- Mid row: Top Marken + Letzte Buchungen -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                ${this._renderTopMarkenWidget(allSales, allPurchases, year)}
                <div class="card">
                    <div class="card-header">
                        <div class="card-title" style="display:flex;align-items:center;gap:7px;"><i class="ti ti-history" style="font-size:15px;color:var(--text-muted);"></i> ${L.t('dash.recent.bookings', {y: year})}</div>
                    </div>
                    <div class="table-container" style="border:none;">
                        <table>
                            <thead>
                                <tr>
                                    <th>${L.t('field.date')}</th>
                                    <th>${L.t('book.category')}</th>
                                    <th>${L.t('book.article')}</th>
                                    <th>${L.t('field.description')}</th>
                                    <th style="text-align:right">${L.t('field.amount')}</th>
                                </tr>
                            </thead>
                            <tbody>${bookingsRows}</tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Charts + Jahresvergleich -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">${L.t('dash.rev.vs.exp', {y: year})}</div>
                    </div>
                    <div class="chart-container">
                        <div id="dashChart"></div>
                    </div>
                </div>
                ${this._renderJahresvergleich(year) || `<div class="card"><div class="card-header"><div class="card-title">${L.t('dash.year.comparison')}</div></div><div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;">${L.t('dash.no.data')}</div></div>`}
            </div>

            <!-- Jahresvergleich chart + Gewinn chart -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">${L.t('dash.year.chart')}</div>
                    </div>
                    <div class="chart-container">
                        <div id="dashChartJahres"></div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Monatsverlauf Gewinn (letzte 12 Monate)</div>
                    </div>
                    <div class="chart-container">
                        <div id="dashChartGewinn"></div>
                    </div>
                </div>
            </div>
        `;
    },

    init() {
        // Bezahlte Rechnungen immer synchronisieren wenn Dashboard geöffnet wird
        Store.autoSyncInvoices();

        // First-Run-Ansicht hat weder Chart-Container noch Jahreswähler. ApexCharts (~600 KB)
        // hier gar nicht erst nachladen — es gäbe nichts zu zeichnen.
        if (this._isFirstRun()) return;

        // Akademie-Achievements bei jedem Dashboard-Aufruf prüfen
        if (typeof Akademie !== 'undefined' && Akademie.checkNewAchievements) {
            Akademie.checkNewAchievements();
        }

        // Akademie-Widget Klick → Akademie öffnen
        const akadWidget = document.getElementById('dashAkademieWidget');
        if (akadWidget) akadWidget.addEventListener('click', () => App.navigate('akademie'));

        const yearSelect = document.getElementById('yearSelect');
        if (yearSelect) yearSelect.addEventListener('change', () => {
            this._selectedYear = parseInt(yearSelect.value);
            this._refresh();
        });

        this._ensureApexCharts();
        this._animateIn();
    },

    _refresh() {
        if (this._chart) { this._chart.destroy(); this._chart = null; }
        if (this._chartJahres) { this._chartJahres.destroy(); this._chartJahres = null; }
        if (this._chartGewinn) { this._chartGewinn.destroy(); this._chartGewinn = null; }
        const contentEl = document.getElementById('content');
        contentEl.innerHTML = this.render();
        this.init();
    },

    _getYearStats(year) {
        const startDate = `${year}-01-01`;
        const endDate   = `${year}-12-31`;
        const allPurchases = Store.getPurchases();
        const allSales     = Store.getSales();
        const allExpenses  = Store.getExpenses();
        const sales     = allSales.filter(s => Utils.isInPeriod(s.datum, startDate, endDate));
        const purchases = allPurchases.filter(p => Utils.isInPeriod(p.datum, startDate, endDate));
        const expenses  = allExpenses.filter(e => Utils.isInPeriod(e.datum, startDate, endDate));
        const einnahmen = sales.reduce((sum, s) => sum + (parseFloat(s.verkaufspreis) || 0), 0);
        const purchaseCost = purchases.reduce((sum, p) => sum + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0);
        const expCost = expenses.reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0);
        const shipping = sales.reduce((sum, s) => sum + (parseFloat(s.versandkostenVerkaufer) || 0), 0);
        const fees = sales.reduce((sum, s) => {
            const vk = parseFloat(s.verkaufspreis) || 0;
            const vkK = parseFloat(s.versandkostenKaeufer) || 0;
            const pct = parseFloat(s.plattformgebuehrProzent) || 0;
            return sum + (vk + vkK) * pct / 100;
        }, 0);
        const ausgaben = purchaseCost + expCost + shipping + fees;
        const gewinn = einnahmen - ausgaben;
        const marge = einnahmen > 0 ? (gewinn / einnahmen * 100) : 0;
        const avgVK = sales.length > 0 ? einnahmen / sales.length : 0;
        return { einnahmen, ausgaben, gewinn, marge, anzahl: sales.length, avgVK };
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
        const headerCells = stats.map(s => `<th style="text-align:right">${s.year}</th>`).join('');
        const tableRows = rows.map(r => {
            const cells = stats.map(s => {
                const val = s[r.key];
                const color = r.key === 'gewinn' ? (val >= 0 ? 'color:var(--success)' : 'color:var(--danger)') : '';
                return `<td style="text-align:right;${color}">${r.fmt(val)}</td>`;
            }).join('');
            return `<tr><td>${r.label}</td>${cells}</tr>`;
        }).join('');

        return `
            <div class="card">
                <div class="card-header"><div class="card-title">${L.t('dash.year.comparison')}</div></div>
                <div class="table-container" style="border:none;">
                    <table>
                        <thead><tr><th>${L.t('table.revenue').split('')[0] ? 'KPI' : 'KPI'}</th>${headerCells}</tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>`;
    },

    _renderGewinnChart() {
        const el = document.getElementById('dashChartGewinn');
        if (!el) return;
        if (this._chartGewinn) { this._chartGewinn.destroy(); this._chartGewinn = null; }
        if (typeof ApexCharts === 'undefined') return;

        const isDark    = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const textColor = isDark ? '#94a3b8' : '#64748b';
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

        this._chartGewinn = new ApexCharts(el, {
            chart: { type: 'area', height: 220, background: 'transparent', toolbar: { show: false }, fontFamily: 'inherit', animations: { enabled: true, speed: 800 } },
            theme: { mode: isDark ? 'dark' : 'light' },
            series: [{ name: (typeof I18n !== 'undefined' ? I18n.t('chart.profit') : 'Gewinn'), data: gewinne }],
            colors: ['#10b981'],
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.02, stops: [0, 100] } },
            stroke: { curve: 'smooth', width: 2 },
            markers: { size: 4, colors: gewinne.map(v => v >= 0 ? '#10b981' : '#ef4444'), strokeColors: gewinne.map(v => v >= 0 ? '#10b981' : '#ef4444'), strokeWidth: 0 },
            xaxis: { categories: labels, labels: { style: { colors: textColor, fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
            yaxis: { labels: { style: { colors: textColor, fontSize: '11px' }, formatter: v => Utils.formatCurrency(v) } },
            grid: { borderColor: isDark ? '#334155' : '#e2e8f0', strokeDashArray: 4 },
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
                chart: { type: 'bar', height: 220, background: 'transparent', toolbar: { show: false }, fontFamily: 'inherit', animations: { enabled: true, speed: 600 } },
                theme: { mode: isDark ? 'dark' : 'light' },
                series: [
                    { name: (typeof I18n !== 'undefined' ? I18n.t('chart.revenue')  : 'Einnahmen'), data: stats.map(s => parseFloat(s.einnahmen.toFixed(2))) },
                    { name: (typeof I18n !== 'undefined' ? I18n.t('chart.expenses') : 'Ausgaben'),  data: stats.map(s => parseFloat(s.ausgaben.toFixed(2)))  },
                    { name: (typeof I18n !== 'undefined' ? I18n.t('chart.profit')   : 'Gewinn'),    data: stats.map(s => parseFloat(s.gewinn.toFixed(2)))    }
                ],
                colors: ['#10b981', '#ef5350', '#8b93f8'],
                plotOptions: { bar: { columnWidth: '70%', borderRadius: 3 } },
                xaxis: { categories: years.map(String), labels: { style: { colors: textColor, fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
                yaxis: { labels: { style: { colors: textColor, fontSize: '11px' }, formatter: v => Utils.formatCurrency(v) } },
                grid: { borderColor: isDark ? '#334155' : '#e2e8f0', strokeDashArray: 4 },
                legend: { labels: { colors: textColor }, fontSize: '12px' },
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

        const maxGewinn = Math.max(...top.map(([, v]) => Math.abs(v.totalGewinn)), 1);

        const rankColors = [
            { bg: 'rgba(251,191,36,0.12)', color: '#f59e0b' },
            { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
            { bg: 'rgba(205,127,50,0.12)',  color: '#cd7f32' },
            { bg: 'var(--bg-card)',          color: 'var(--text-muted)' },
            { bg: 'var(--bg-card)',          color: 'var(--text-muted)' },
        ];

        const rows = top.map(([brand, v], i) => {
            const marge = v.totalNet > 0 ? v.totalGewinn / v.totalNet * 100 : 0;
            const barW  = Math.round(Math.abs(v.totalGewinn) / maxGewinn * 100);
            const barCol = v.totalGewinn >= 0 ? 'var(--success)' : 'var(--danger)';
            const rc = rankColors[i];
            return `<div style="display:grid;grid-template-columns:28px 1fr auto auto;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);">
                <div style="width:22px;height:22px;border-radius:6px;background:${rc.bg};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${rc.color};flex-shrink:0;">${i + 1}</div>
                <div>
                    <div style="font-size:13px;font-weight:600;color:var(--text-primary);">${Utils.escapeHtml(brand)}</div>
                    <div style="margin-top:4px;height:3px;border-radius:2px;background:var(--border);overflow:hidden;">
                        <div style="width:${barW}%;height:100%;background:${barCol};border-radius:2px;transition:width 0.4s ease;"></div>
                    </div>
                </div>
                <div style="text-align:right;font-size:12px;color:var(--text-muted);">${v.count} Stk.<br><span style="color:${marge >= 20 ? 'var(--success)' : marge >= 0 ? 'var(--warning)' : 'var(--danger)'};font-weight:600;">${marge.toFixed(0)}%</span></div>
                <div style="text-align:right;font-size:13px;font-weight:700;color:${v.totalGewinn >= 0 ? 'var(--success)' : 'var(--danger)'};">${Utils.formatCurrency(v.totalGewinn)}</div>
            </div>`;
        }).join('');

        return `
        <div class="card">
            <div class="card-header">
                <div class="card-title" style="display:flex;align-items:center;gap:7px;"><i class="ti ti-trophy" style="color:var(--warning);font-size:16px;"></i> Top Marken ${year}</div>
                <a href="#" data-action="navigate" data-args=\'["statistiken"]\' style="font-size:12px;color:var(--accent);">Analyse →</a>
            </div>
            <div style="display:flex;flex-direction:column;">
                ${rows}
            </div>
        </div>`;
    },

    _renderChart() {
        const el = document.getElementById('dashChart');
        if (!el) return;
        if (this._chart) { this._chart.destroy(); this._chart = null; }
        if (typeof ApexCharts === 'undefined') return;

        const year      = this._selectedYear;
        const sales     = Store.getSales();
        const purchases = Store.getPurchases();
        const expenses  = Store.getExpenses();
        const isDark    = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const textColor = isDark ? '#94a3b8' : '#64748b';

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

        this._chart = new ApexCharts(el, {
            chart: { type: 'bar', height: 220, background: 'transparent', toolbar: { show: false }, fontFamily: 'inherit', animations: { enabled: true, speed: 600 } },
            theme: { mode: isDark ? 'dark' : 'light' },
            series: [{ name: 'Einnahmen', data: einnahmen }, { name: 'Ausgaben', data: ausgaben }],
            colors: ['#10b981', '#ef4444'],
            plotOptions: { bar: { columnWidth: '60%', borderRadius: 3 } },
            xaxis: { categories: labels, labels: { style: { colors: textColor, fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
            yaxis: { labels: { style: { colors: textColor, fontSize: '11px' }, formatter: v => Utils.formatCurrency(v) } },
            grid: { borderColor: isDark ? '#334155' : '#e2e8f0', strokeDashArray: 4 },
            legend: { labels: { colors: textColor }, fontSize: '12px' },
            tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => Utils.formatCurrency(v) } },
            dataLabels: { enabled: false }
        });
        this._chart.render();
    },

    _animateIn() {
        if (typeof gsap === 'undefined') return;
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
