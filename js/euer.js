// ============================================
// EÜR Module - Income-Expense Report
// ============================================
const Euer = {
    _period: 'jahr',
    _selectedYear: new Date().getFullYear(),
    _selectedMonth: new Date().getMonth(),
    _customStart: '',
    _customEnd: '',

    render() {
        const settings = Store.getSettings();
        const ustMode = settings.ustMode || 'klein';
        const isRegel = ustMode === 'regel';

        const year = this._selectedYear;
        const month = this._selectedMonth;

        let startDate, endDate, periodLabel;

        if (this._period === 'monat') {
            startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const nextM = new Date(year, month + 1, 0);
            endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(nextM.getDate()).padStart(2, '0')}`;
            periodLabel = Utils.getMonthName(month) + ' ' + year;
        } else if (this._period === 'quartal') {
            const qStart = Math.floor(month / 3) * 3;
            startDate = `${year}-${String(qStart + 1).padStart(2, '0')}-01`;
            const qEnd = new Date(year, qStart + 3, 0);
            endDate = `${qEnd.getFullYear()}-${String(qEnd.getMonth() + 1).padStart(2, '0')}-${String(qEnd.getDate()).padStart(2, '0')}`;
            periodLabel = `Q${Math.floor(month / 3) + 1} ${year}`;
        } else if (this._period === 'custom') {
            startDate = this._customStart || `${year}-01-01`;
            endDate = this._customEnd || `${year}-12-31`;
            periodLabel = `${Utils.formatDate(startDate)} - ${Utils.formatDate(endDate)}`;
        } else {
            startDate = `${year}-01-01`;
            endDate = `${year}-12-31`;
            periodLabel = 'Jahr ' + year;
        }

        // Stornierte Rechnungen → zugehörige Verkäufe ausschließen (Orphan-Guard)
        const storniertInvIds = new Set(
            (Store.getRechInvoices ? Store.getRechInvoices() : [])
                .filter(inv => inv.status === 'storniert' || inv._storniert)
                .map(inv => inv.id)
        );
        const sales = Store.getSales().filter(s =>
            Utils.isInPeriod(s.datum, startDate, endDate) &&
            !(s._invoiceId && storniertInvIds.has(s._invoiceId))
        );
        const periodPurchases = Store.getPurchases().filter(p => Utils.isInPeriod(p.datum, startDate, endDate));
        // Einkäufe, deren Verkauf storniert wurde, dürfen NICHT als Ausgabe erscheinen
        // (da auch die Einnahme aus dem stornierten Verkauf entfällt → kein Vorgang in der EÜR)
        const _storniertePurchaseIds = new Set();
        Store.getSales(true).filter(s => s.storniert).forEach(s => {
            if (s.purchaseIds) s.purchaseIds.forEach(id => _storniertePurchaseIds.add(id));
            else if (s.purchaseId) _storniertePurchaseIds.add(s.purchaseId);
        });
        const expenses = Store.getExpenses().filter(e => Utils.isInPeriod(e.datum, startDate, endDate));

        // Bezahlte Rechnungen die noch nicht als Verkauf gesynct sind
        const syncedInvoiceIds = new Set(Store.getSales(true).filter(s => s._invoiceId).map(s => s._invoiceId));
        const unsyncedInvoices = (Store.getRechInvoices ? Store.getRechInvoices() : []).filter(inv => {
            if (inv.status !== 'bezahlt' || inv._storniert) return false;
            if (syncedInvoiceIds.has(inv.id)) return false;
            const d = inv.bezahltAm || inv.datum;
            return Utils.isInPeriod(d, startDate, endDate);
        });
        const rechnungsEinnahmen = unsyncedInvoices.reduce((sum, inv) => {
            return sum + (inv.positionen || []).reduce((s2, p) => s2 + (p.menge || 0) * (p.einzelpreis || 0), 0);
        }, 0);

        // Einnahmen: Bruttoerlöse = Verkaufspreis + Versand vom Käufer (§11 EStG Zufluss)
        const bruttoEinnahmen = sales.reduce((sum, s) => {
            return sum + (parseFloat(s.verkaufspreis) || 0) + (parseFloat(s.versandkostenKaeufer) || 0);
        }, 0) + rechnungsEinnahmen;

        // Ausgaben
        // Wareneinkauf: ALLE Einkäufe im Zeitraum (EÜR Abflussprinzip §4 Abs. 3 EStG – Ausgabe beim Bezahlen, nicht beim Verkaufen)
        // ACHTUNG: Eigenbeleg-Einkäufe (eigenbeleg_id gesetzt) werden NICHT hier gezählt, da der
        // Betrag bereits über eigenbelegeAusgaben (s.u.) erfasst wird. Verhindert Doppelzählung.
        const wareneinkauf = periodPurchases.filter(p => !p.eigenbeleg_id && !_storniertePurchaseIds.has(p.id)).reduce((sum, p) => {
            return sum + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
        }, 0);

        // Versandkosten (seller's shipping costs)
        const versandkosten = sales.reduce((sum, s) => sum + (parseFloat(s.versandkostenVerkaufer) || 0), 0);

        // Plattformgebühren
        const plattformgebuehren = sales.reduce((sum, s) => {
            const vk = parseFloat(s.verkaufspreis) || 0;
            const vkK = parseFloat(s.versandkostenKaeufer) || 0;
            const pct = parseFloat(s.plattformgebuehrProzent) || 0;
            return sum + (vk + vkK) * pct / 100;
        }, 0);

        // Fahrtkosten aus Fahrtenbuch
        const fahrtkosten = Store.getFahrten().filter(f => Utils.isInPeriod(f.datum, startDate, endDate))
            .reduce((sum, f) => sum + (parseFloat(f.kosten) || 0), 0);

        // Materialverbrauch (Verpackung) aus Materiallager
        const materialKosten = Store.getMaterialVerbrauch()
            .filter(v => !v.storniert && v.grund === 'verkauf' && Utils.isInPeriod(v.datum, startDate, endDate))
            .reduce((sum, v) => sum + (parseFloat(v.kosten) || 0), 0);

        // AfA / Abschreibungen (§7 EStG) — aus dem Anlagenverzeichnis
        // Bei Jahresauswertung: voller Jahres-AfA-Betrag; bei Teilzeitraum: zeitanteilig
        const afaAnlagen = (typeof Store.getAfaAnlagen === 'function') ? Store.getAfaAnlagen().filter(a => !a.storniert) : [];
        const daysInYear = 365;
        const periodStart = new Date(startDate);
        const periodEnd   = new Date(endDate);
        const daysInPeriod = Math.max(1, Math.round((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1);
        const afaRatio = this._period === 'jahr' ? 1 : (daysInPeriod / daysInYear);
        const afaKosten = afaAnlagen.reduce((sum, a) => {
            if (typeof Afa !== 'undefined' && Afa._calcJahresAfa) {
                return sum + Afa._calcJahresAfa(a, year) * afaRatio;
            }
            return sum;
        }, 0);

        // Retouren-Erstattungen mindern Einnahmen (§11 EStG – Rückfluss)
        // Wichtig: Wenn ein Verkauf über Retoure storniert wurde (saleId gesetzt + Verkauf storniert),
        // ist die Einnahme bereits entfernt → erstattungBetrag NICHT nochmals abziehen (Doppelabzug).
        const stornierteSaleIds = new Set(Store.getSales(true).filter(s => s.storniert).map(s => s.id));
        const retourenErstattungen = Store.getRetouren()
            .filter(r => Utils.isInPeriod(r.datum, startDate, endDate) && !(r.saleId && stornierteSaleIds.has(r.saleId)))
            .reduce((sum, r) => sum + (parseFloat(r.erstattungBetrag) || 0), 0);

        // Netto-Einnahmen nach Retouren
        const nettoEinnahmen = bruttoEinnahmen - retourenErstattungen;

        // ── USt-Berechnung (nur Regelbesteuerung) ──────────────────────────────
        // Nutzer geben Brutto-Marktplatzpreise ein (eBay, Vinted etc. zeigen Brutto).
        // Kleinunternehmer (§19 UStG): keine USt auf Einnahmen, keine Vorsteuer absetzbar.
        // Regelbesteuerung: USt ist im Brutto enthalten → herausrechnen per /1.19 × 0.19
        //   Bsp: 119 € Brutto → 100 € Netto + 19 € USt
        const ustEinnahmen = isRegel ? (nettoEinnahmen / 1.19 * 0.19) : 0;
        // Für die EÜR zählt bei Regelbesteuerung der Netto-Umsatz als Betriebseinnahme
        // + die vereinnahmte USt wird separat als Durchlaufposten gezeigt
        const summeEinnahmen = isRegel ? (nettoEinnahmen / 1.19) + ustEinnahmen : nettoEinnahmen;

        // Sonstige Betriebsausgaben
        const sonstigeAusgaben = expenses.reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0);

        // Category breakdown for Betriebsausgaben — dynamic (all actual categories)
        const catBreakdown = {};
        expenses.forEach(e => {
            const cat = e.kategorie || 'Sonstiges';
            catBreakdown[cat] = (catBreakdown[cat] || 0) + (parseFloat(e.betrag) || 0);
        });
        const kategorien = Object.keys(catBreakdown).sort();

        // Eigenbelege als Ausgaben (aus eigenbelege/index.html localStorage)
        // Felder: belegDatum (nicht datum), betragNetto (nicht betrag)
        const eigenbelegeRaw = (() => { try { return JSON.parse(localStorage.getItem('eigenbelege_belege') || '[]'); } catch { return []; } })();
        const eigenbelegeAusgaben = eigenbelegeRaw
            .filter(b => !b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, startDate, endDate))
            .reduce((sum, b) => sum + (parseFloat(b.betragNetto) || parseFloat(b.betragBrutto) || 0), 0);

        // Ausgaben gesamt
        // Kleinunternehmer: Brutto-Ausgaben (USt ist echter Kostenfaktor, kein Vorsteuerabzug)
        // Regelbesteuerung: Netto-Ausgaben (USt wird als Vorsteuer abgezogen = Durchlaufposten)
        const abzugsfaehig = wareneinkauf + versandkosten + plattformgebuehren + fahrtkosten + materialKosten + sonstigeAusgaben + eigenbelegeAusgaben + afaKosten;
        // Vorsteuer ist bei Regelbesteuerung ebenfalls im eingegebenen Brutto enthalten
        const vorsteuer = isRegel ? (abzugsfaehig / 1.19 * 0.19) : 0;
        // Bei Regelbesteuerung zählt nur Netto als abzugsfähige BA; USt ist Durchlaufposten
        const summeAusgaben = isRegel ? (abzugsfaehig / 1.19) + vorsteuer : abzugsfaehig;

        const gewinn = summeEinnahmen - summeAusgaben;
        this._lastGewinn = gewinn; // für Gewerbesteuer-Live-Update

        // GbR-Gewinnverteilung Block
        const gbrBlock = (typeof GbR !== 'undefined') ? GbR.renderEuerBlock(gewinn) : '';

        return `
            <div class="page-header">
                <h2>Einnahmen-Überschuss-Rechnung</h2>
                <div class="page-header-actions no-print">
                    ${unsyncedInvoices.length > 0 ? `<button class="btn btn-warning" id="euerSync" title="${unsyncedInvoices.length} bezahlte Rechnung(en) noch nicht synchronisiert"><i class="ti ti-refresh"></i> ${unsyncedInvoices.length} synchronisieren</button> ` : ''}
                    <button class="btn" id="euerSteuertermine"><i class="ti ti-calendar-event"></i> Steuertermine</button>
                    <button class="btn" id="euerElsterExport"><i class="ti ti-file-spreadsheet"></i> ELSTER CSV</button>
                    <button class="btn" id="euerPrint"><i class="ti ti-printer"></i> PDF / Drucken</button>
                </div>
            </div>

            <div class="card no-print" style="margin-bottom:20px;">
                <div class="form-row" style="align-items:flex-end;">
                    <div class="form-group">
                        <label class="form-label">Zeitraum</label>
                        <select class="form-select" id="euerPeriod">
                            <option value="monat" ${this._period === 'monat' ? 'selected' : ''}>Monat</option>
                            <option value="quartal" ${this._period === 'quartal' ? 'selected' : ''}>Quartal</option>
                            <option value="jahr" ${this._period === 'jahr' ? 'selected' : ''}>Jahr</option>
                            <option value="custom" ${this._period === 'custom' ? 'selected' : ''}>Benutzerdefiniert</option>
                        </select>
                    </div>
                    <div class="form-group" id="yearGroup" style="${this._period === 'custom' ? 'display:none' : ''}">
                        <label class="form-label">Jahr</label>
                        <select class="form-select" id="euerYear">
                            ${Array.from({length: 16}, (_, i) => 2020 + i).map(y =>
                                `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group" id="monthGroup" style="${this._period === 'monat' ? '' : 'display:none'}">
                        <label class="form-label">Monat</label>
                        <select class="form-select" id="euerMonth">
                            ${Array.from({length: 12}, (_, i) => i).map(m =>
                                `<option value="${m}" ${m === month ? 'selected' : ''}>${Utils.getMonthName(m)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group" id="quarterGroup" style="${this._period === 'quartal' ? '' : 'display:none'}">
                        <label class="form-label">Quartal</label>
                        <select class="form-select" id="euerQuarter">
                            ${[0,1,2,3].map(q =>
                                `<option value="${q}" ${Math.floor(month / 3) === q ? 'selected' : ''}>Q${q + 1}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group" id="customStartGroup" style="${this._period === 'custom' ? '' : 'display:none'}">
                        <label class="form-label">Von</label>
                        <input type="date" class="form-input" id="euerCustomStart" value="${this._customStart || `${year}-01-01`}">
                    </div>
                    <div class="form-group" id="customEndGroup" style="${this._period === 'custom' ? '' : 'display:none'}">
                        <label class="form-label">Bis</label>
                        <input type="date" class="form-input" id="euerCustomEnd" value="${this._customEnd || `${year}-12-31`}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">USt-Modus</label>
                        <select class="form-select" id="euerUstMode">
                            <option value="klein" ${ustMode === 'klein' ? 'selected' : ''}>Kleinunternehmer</option>
                            <option value="regel" ${ustMode === 'regel' ? 'selected' : ''}>Regelbesteuerung</option>
                        </select>
                    </div>
                </div>
                ${ustMode === 'klein' ? '<div class="form-hint">Kleinunternehmerregelung nach &sect;19 UStG - keine Umsatzsteuer wird ausgewiesen.</div>' : ''}
            </div>

            <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:16px;" id="euerKpiGrid">
                <div class="card stat-card success" style="padding:14px;">
                    <div class="card-label" style="font-size:11px;"><i class="ti ti-trending-up"></i> Einnahmen</div>
                    <div class="card-value" style="font-size:22px;" id="euerKpiEin">${Utils.formatCurrency(summeEinnahmen)}</div>
                    <div class="card-subtitle" style="font-size:11px;">${periodLabel}</div>
                </div>
                <div class="card stat-card danger" style="padding:14px;">
                    <div class="card-label" style="font-size:11px;"><i class="ti ti-trending-down"></i> Ausgaben</div>
                    <div class="card-value" style="font-size:22px;" id="euerKpiAus">${Utils.formatCurrency(summeAusgaben)}</div>
                    <div class="card-subtitle" style="font-size:11px;">${periodPurchases.length} Einkäufe · ${expenses.length} BA</div>
                </div>
                <div class="card stat-card ${gewinn >= 0 ? 'success' : 'danger'}" style="padding:14px;">
                    <div class="card-label" style="font-size:11px;"><i class="ti ti-scale"></i> ${gewinn >= 0 ? 'Gewinn' : 'Verlust'}</div>
                    <div class="card-value" style="font-size:22px;color:${gewinn >= 0 ? 'var(--success)' : 'var(--danger)'};" id="euerKpiGewinn">${Utils.formatCurrency(gewinn)}</div>
                    <div class="card-subtitle" style="font-size:11px;">${sales.length} Verkäufe</div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <div class="card-title">EÜR - ${periodLabel}</div>
                    <div style="font-size:12px;color:var(--text-muted);">Gemäß &sect;4 Abs. 3 EStG</div>
                </div>
                <div class="table-container" style="border:none;">
                    <table class="euer-table">
                        <thead>
                            <tr>
                                <th style="width:60%">Position</th>
                                <th style="text-align:right">Betrag</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="euer-section-header"><td colspan="2">Einnahmen</td></tr>
                            <tr>
                                <td>Bruttoerlöse aus Verkäufen <span style="font-size:11px;color:var(--text-muted);">(Verkaufspreis + Versand vom Käufer)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(bruttoEinnahmen - rechnungsEinnahmen)}</td>
                            </tr>
                            ${rechnungsEinnahmen > 0 ? `<tr>
                                <td>Einnahmen aus Rechnungen <span style="font-size:11px;color:var(--text-muted);">(${unsyncedInvoices.length} Dok. noch nicht synchronisiert)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(rechnungsEinnahmen)}</td>
                            </tr>` : ''}
                            ${retourenErstattungen > 0 ? `<tr>
                                <td style="color:var(--danger);">Abzgl. Retouren-Erstattungen <span style="font-size:11px;color:var(--text-muted);">(§11 EStG Rückfluss)</span></td>
                                <td style="text-align:right;color:var(--danger);">−${Utils.formatCurrency(retourenErstattungen)}</td>
                            </tr>
                            <tr style="opacity:0.8;">
                                <td style="font-size:12px;padding-left:16px;">Einnahmen nach Retouren</td>
                                <td style="text-align:right;font-size:12px;">${Utils.formatCurrency(nettoEinnahmen)}</td>
                            </tr>` : ''}
                            ${isRegel ? `<tr style="opacity:0.8;">
                                <td style="padding-left:16px;font-size:12px;">↳ davon Netto-Umsatz <span style="color:var(--text-muted);">(Brutto ÷ 1,19)</span></td>
                                <td style="text-align:right;font-size:12px;">${Utils.formatCurrency(nettoEinnahmen / 1.19)}</td>
                            </tr>
                            <tr style="opacity:0.8;">
                                <td style="padding-left:16px;font-size:12px;">↳ Umsatzsteuer vereinnahmt (19%) <span style="color:var(--text-muted);">Durchlaufposten</span></td>
                                <td style="text-align:right;font-size:12px;">${Utils.formatCurrency(ustEinnahmen)}</td>
                            </tr>` : ''}
                            <tr class="euer-total">
                                <td><strong>Summe Einnahmen</strong>${isRegel ? '' : ' <span style="font-size:11px;font-weight:400;color:var(--text-muted);">§19 UStG – keine Umsatzsteuer</span>'}</td>
                                <td style="text-align:right"><strong>${Utils.formatCurrency(summeEinnahmen)}</strong></td>
                            </tr>

                            <tr class="euer-section-header"><td colspan="2">Ausgaben</td></tr>
                            <tr>
                                <td>Wareneinkauf <span style="font-size:11px;color:var(--text-muted);">(${periodPurchases.length} Artikel im Zeitraum eingekauft)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(wareneinkauf)}</td>
                            </tr>
                            <tr>
                                <td>Versandkosten (Verkäufer)</td>
                                <td style="text-align:right">${Utils.formatCurrency(versandkosten)}</td>
                            </tr>
                            <tr>
                                <td>Plattformgebühren <span style="font-size:11px;color:var(--text-muted);">(aus Verkäufen)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(plattformgebuehren)}</td>
                            </tr>
                            ${fahrtkosten > 0 ? `<tr>
                                <td>Fahrtkosten <span style="font-size:11px;color:var(--text-muted);">(Fahrtenbuch – §9 EStG)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(fahrtkosten)}</td>
                            </tr>` : ''}
                            ${materialKosten > 0 ? `<tr>
                                <td>Verpackungsmaterial (verbraucht) <span style="font-size:11px;color:var(--text-muted);">(Materiallager)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(materialKosten)}</td>
                            </tr>` : ''}
                            ${afaKosten > 0 ? `<tr>
                                <td>Abschreibungen AfA <span style="font-size:11px;color:var(--text-muted);">(§7 EStG – ${afaAnlagen.length} Anlage(n)${this._period !== 'jahr' ? ', zeitanteilig' : ''})</span>
                                    <a href="#" onclick="event.preventDefault();App.navigate('afa')" style="font-size:11px;margin-left:6px;">→ Anlagenverzeichnis</a>
                                </td>
                                <td style="text-align:right">${Utils.formatCurrency(afaKosten)}</td>
                            </tr>` : afaAnlagen.length > 0 ? `<tr style="opacity:0.6;">
                                <td>Abschreibungen AfA <span style="font-size:11px;color:var(--text-muted);">(keine AfA in diesem Zeitraum)</span></td>
                                <td style="text-align:right">–</td>
                            </tr>` : ''}
                            <tr>
                                <td>
                                    <strong>Betriebsausgaben gesamt</strong>
                                    <span style="font-size:11px;color:var(--text-muted);margin-left:8px;">(${expenses.length} Posten)</span>
                                </td>
                                <td style="text-align:right"><strong>${Utils.formatCurrency(sonstigeAusgaben)}</strong></td>
                            </tr>
                            ${kategorien.filter(k => catBreakdown[k] > 0).map(k => `
                            <tr style="opacity:0.75;">
                                <td style="padding-left:24px;font-size:12px;">↳ ${k}</td>
                                <td style="text-align:right;font-size:12px;">${Utils.formatCurrency(catBreakdown[k])}</td>
                            </tr>
                            `).join('')}
                            ${eigenbelegeAusgaben > 0 ? `<tr>
                                <td>Eigenbelege (Ersatzbelege) <span style="font-size:11px;color:var(--text-muted);">(${eigenbelegeRaw.filter(b => !b.storniert && Utils.isInPeriod(b.datum, startDate, endDate)).length} Belege)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(eigenbelegeAusgaben)}</td>
                            </tr>` : ''}
                            ${isRegel ? `<tr style="opacity:0.8;">
                                <td style="padding-left:16px;font-size:12px;">↳ Vorsteuer (19%) <span style="color:var(--text-muted);">aus Brutto-Ausgaben herausgerechnet</span></td>
                                <td style="text-align:right;font-size:12px;">${Utils.formatCurrency(vorsteuer)}</td>
                            </tr>` : ''}
                            <tr class="euer-total">
                                <td><strong>Summe Ausgaben</strong></td>
                                <td style="text-align:right"><strong>${Utils.formatCurrency(summeAusgaben)}</strong></td>
                            </tr>

                            <tr class="euer-result">
                                <td><strong><i class="ti ${gewinn >= 0 ? 'ti-trending-up' : 'ti-trending-down'}" style="color:${gewinn >= 0 ? 'var(--success)' : 'var(--danger)'}"></i> ${gewinn >= 0 ? 'Gewinn (Überschuss)' : 'Verlust (Fehlbetrag)'}</strong></td>
                                <td style="text-align:right;font-size:1.15rem;color:${gewinn >= 0 ? 'var(--success)' : 'var(--danger)'}"><strong>${Utils.formatCurrency(gewinn)}</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style="padding:12px 16px;border-top:1px solid var(--border);font-size:11px;color:var(--text-muted);display:flex;gap:16px;flex-wrap:wrap;">
                    <span><i class="ti ti-clipboard-list"></i> Grundlage: §4 Abs. 3 EStG (Ist-Besteuerung / Zufluss-Abfluss)</span>
                    <span><i class="ti ti-box"></i> ${periodPurchases.length} Einkäufe · ${sales.length} Verkäufe · ${expenses.length} Ausgaben</span>
                    ${eigenbelegeRaw.filter(b => !b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, startDate, endDate)).length > 0
                        ? `<span><i class="ti ti-receipt"></i> ${eigenbelegeRaw.filter(b => !b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, startDate, endDate)).length} Eigenbelege</span>`
                        : ''}
                    <span style="color:var(--warning);"><i class="ti ti-alert-triangle"></i> Unverbindlich – Prüfung durch Steuerberater empfohlen</span>
                </div>
            </div>

            ${gbrBlock}

            ${this._period === 'jahr' ? this._renderGewerbesteuerBlock(gewinn) : ''}
        `;
    },

    // ── Gewerbesteuer-Rechner (nur für Jahresansicht) ──────────────────────
    _renderGewerbesteuerBlock(gewinn) {
        const freibetrag = 24500; // §11 GewStG
        const gewerbeertrag = Math.max(0, gewinn - freibetrag);
        const messzahl = 0.035; // §11 Abs. 2 GewStG
        const steuermessbetrag = gewerbeertrag * messzahl;
        // Hebesatz aus Settings (Standard 400%)
        const settings = Store.getSettings();
        const hebesatz = parseInt(settings.gewerbesteuerHebesatz) || 400;
        const gewerbesteuer = steuermessbetrag * (hebesatz / 100);
        const istGewPflichtig = gewinn > freibetrag;

        return `
        <div class="card" style="margin-top:20px;" id="euerGewStCard">
            <div class="card-header">
                <div class="card-title"><i class="ti ti-building-bank"></i> Gewerbesteuer-Rechner</div>
                <div style="font-size:12px;color:var(--text-muted);">§11 GewStG · Einzelunternehmen</div>
            </div>
            <div class="table-container" style="border:none;">
                <table class="euer-table">
                    <thead><tr><th style="width:60%">Position</th><th style="text-align:right">Betrag</th></tr></thead>
                    <tbody>
                        <tr><td>Gewinn aus Gewerbebetrieb (EÜR)</td><td style="text-align:right">${Utils.formatCurrency(gewinn)}</td></tr>
                        <tr><td>Freibetrag §11 GewStG (Einzelunternehmen)</td><td style="text-align:right;color:var(--success)">−${Utils.formatCurrency(freibetrag)}</td></tr>
                        <tr><td><strong>Gewerbeertrag (Bemessungsgrundlage)</strong></td><td style="text-align:right"><strong>${Utils.formatCurrency(gewerbeertrag)}</strong></td></tr>
                        <tr><td>Steuermesszahl §11 Abs. 2 GewStG (3,5%)</td><td style="text-align:right">${Utils.formatCurrency(steuermessbetrag)}</td></tr>
                        <tr>
                            <td>
                                Hebesatz der Gemeinde
                                <input type="number" id="gewstHebesatz" value="${hebesatz}" min="200" max="900" step="50"
                                    style="width:70px;margin-left:8px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg-secondary);color:var(--text-primary);"
                                    oninput="Euer._updateHebesatz(this.value)">
                                %
                                <span style="font-size:11px;color:var(--text-muted);margin-left:4px;">(Ø Deutschland: 400%)</span>
                            </td>
                            <td style="text-align:right">× ${hebesatz}%</td>
                        </tr>
                        <tr class="euer-result">
                            <td><strong><i class="ti ${istGewPflichtig ? 'ti-alert-circle' : 'ti-circle-check'}" style="color:${istGewPflichtig ? 'var(--danger)' : 'var(--success)'}"></i> ${istGewPflichtig ? 'Gewerbesteuer (geschätzt)' : 'Keine Gewerbesteuer'}</strong>
                                ${!istGewPflichtig ? `<span style="font-size:11px;font-weight:400;color:var(--success);">(Gewinn unter Freibetrag ${Utils.formatCurrency(freibetrag)})</span>` : ''}
                            </td>
                            <td style="text-align:right;font-size:1.15rem;color:${istGewPflichtig ? 'var(--danger)' : 'var(--success)'}">
                                <strong id="gewstBetrag">${Utils.formatCurrency(gewerbesteuer)}</strong>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style="padding:10px 16px;font-size:11px;color:var(--text-muted);">
                ⚠️ Schätzung ohne GewSt-Hinzurechnungen/Kürzungen (§§8–9 GewStG) · Freibetrag nur für natürl. Personen/Personenges.
                · Gewerbesteuer ist nach §35 EStG auf die ESt anrechenbar (bis 3,8 × Steuermessbetrag) ·
                Prüfung durch Steuerberater empfohlen.
            </div>
        </div>`;
    },

    _updateHebesatz(val) {
        const hs = parseInt(val) || 400;
        const settings = Store.getSettings();
        settings.gewerbesteuerHebesatz = hs;
        Store.saveSettings(settings);
        // Neuberechnung ohne Full-Refresh (nur Betrag aktualisieren)
        const gewinn = this._lastGewinn || 0;
        const freibetrag = 24500;
        const gewerbeertrag = Math.max(0, gewinn - freibetrag);
        const steuermessbetrag = gewerbeertrag * 0.035;
        const gewerbesteuer = steuermessbetrag * (hs / 100);
        const el = document.getElementById('gewstBetrag');
        if (el) el.textContent = Utils.formatCurrency(gewerbesteuer);
    },

    init() {
        // GSAP KPI card animation
        if (typeof gsap !== 'undefined') {
            const cards = document.querySelectorAll('#euerKpiGrid .stat-card');
            if (cards.length) {
                gsap.from(cards, { y: 16, opacity: 0, stagger: 0.08, duration: 0.45, ease: 'power2.out', clearProps: 'all' });
                cards.forEach(card => {
                    const valEl = card.querySelector('.card-value');
                    if (!valEl) return;
                    const raw = valEl.textContent.trim();
                    const num = parseFloat(raw.replace(/\./g,'').replace(',','.').replace(/[^\d.-]/g,''));
                    if (isNaN(num) || num === 0) return;
                    const isNeg = num < 0, hasCurrency = raw.includes('€');
                    const origColor = valEl.style.color;
                    const obj = { val: 0 };
                    gsap.to(obj, { val: Math.abs(num), duration: 1.0, ease: 'power2.out',
                        onUpdate() { valEl.textContent = (hasCurrency ? (isNeg?'−':'')+obj.val.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €' : Math.round(obj.val).toLocaleString('de-DE')); },
                        onComplete() { valEl.textContent = raw; if(origColor) valEl.style.color = origColor; }
                    });
                });
            }
        }

        // Sicherstellen dass alle bezahlten Rechnungen in Sales gesynct sind
        Store.autoSyncInvoices();

        const periodSelect = document.getElementById('euerPeriod');
        const yearGroup = document.getElementById('yearGroup');
        const monthGroup = document.getElementById('monthGroup');
        const quarterGroup = document.getElementById('quarterGroup');
        const customStartGroup = document.getElementById('customStartGroup');
        const customEndGroup = document.getElementById('customEndGroup');

        const updateVisibility = () => {
            const p = this._period;
            if (yearGroup)        yearGroup.style.display        = p === 'custom' ? 'none' : '';
            if (monthGroup)       monthGroup.style.display       = p === 'monat' ? '' : 'none';
            if (quarterGroup)     quarterGroup.style.display     = p === 'quartal' ? '' : 'none';
            if (customStartGroup) customStartGroup.style.display = p === 'custom' ? '' : 'none';
            if (customEndGroup)   customEndGroup.style.display   = p === 'custom' ? '' : 'none';
        };

        if (periodSelect) periodSelect.addEventListener('change', () => {
            this._period = periodSelect.value;
            updateVisibility();
            this._refresh();
        });

        const yearSelect = document.getElementById('euerYear');
        if (yearSelect) {
            yearSelect.addEventListener('change', () => {
                this._selectedYear = parseInt(yearSelect.value);
                this._refresh();
            });
        }

        const monthSelect = document.getElementById('euerMonth');
        if (monthSelect) {
            monthSelect.addEventListener('change', () => {
                this._selectedMonth = parseInt(monthSelect.value);
                this._refresh();
            });
        }

        const quarterSelect = document.getElementById('euerQuarter');
        if (quarterSelect) {
            quarterSelect.addEventListener('change', () => {
                this._selectedMonth = parseInt(quarterSelect.value) * 3;
                this._refresh();
            });
        }

        const customStart = document.getElementById('euerCustomStart');
        const customEnd = document.getElementById('euerCustomEnd');
        if (customStart) {
            customStart.addEventListener('change', () => {
                this._customStart = customStart.value;
                this._refresh();
            });
        }
        if (customEnd) {
            customEnd.addEventListener('change', () => {
                this._customEnd = customEnd.value;
                this._refresh();
            });
        }

        const ustModeSelect = document.getElementById('euerUstMode');
        if (ustModeSelect) ustModeSelect.addEventListener('change', () => {
            const settings = Store.getSettings();
            settings.ustMode = ustModeSelect.value;
            Store.saveSettings(settings);
            this._refresh();
        });

        const printBtn = document.getElementById('euerPrint');
        if (printBtn) printBtn.addEventListener('click', () => {
            // Achievement-Flag setzen: User hat EÜR exportiert
            try { localStorage.setItem('akademie_flag_eur_exported', '1'); } catch(e) {}
            if (typeof Akademie !== 'undefined' && Akademie.checkNewAchievements) Akademie.checkNewAchievements();
            window.print();
        });

        const steuerBtn = document.getElementById('euerSteuertermine');
        if (steuerBtn) steuerBtn.addEventListener('click', () => {
            App._cameFromEuer = true;
            App.navigate('steuertermine');
        });

        const elsterBtn = document.getElementById('euerElsterExport');
        if (elsterBtn) {
            elsterBtn.addEventListener('click', () => {
                // Build current period values for ELSTER Anlage EÜR mapping
                const y = this._selectedYear;
                const sDate = this._period === 'monat' ? (() => { const m = this._selectedMonth; return `${y}-${String(m+1).padStart(2,'0')}-01`; })()
                    : this._period === 'quartal' ? `${y}-${String(Math.floor(this._selectedMonth/3)*3+1).padStart(2,'0')}-01`
                    : this._customStart || `${y}-01-01`;
                const eDate = this._period === 'monat' ? (() => { const m = this._selectedMonth; const d = new Date(y,m+1,0); return `${y}-${String(m+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()
                    : this._period === 'quartal' ? (() => { const qE = new Date(y, Math.floor(this._selectedMonth/3)*3+3, 0); return `${qE.getFullYear()}-${String(qE.getMonth()+1).padStart(2,'0')}-${String(qE.getDate()).padStart(2,'0')}`; })()
                    : this._customEnd || `${y}-12-31`;
                const sSales = Store.getSales().filter(s => Utils.isInPeriod(s.datum, sDate, eDate));
                const sPurch = Store.getPurchases().filter(p => Utils.isInPeriod(p.datum, sDate, eDate));
                // Einkäufe mit storniertem Verkauf aus z22 herausfiltern
                const _elsterStorniertePurchaseIds = new Set();
                Store.getSales(true).filter(s => s.storniert).forEach(s => {
                    if (s.purchaseIds) s.purchaseIds.forEach(id => _elsterStorniertePurchaseIds.add(id));
                    else if (s.purchaseId) _elsterStorniertePurchaseIds.add(s.purchaseId);
                });
                const sExp = Store.getExpenses().filter(e => Utils.isInPeriod(e.datum, sDate, eDate));
                const sFahrt = Store.getFahrten().filter(f => Utils.isInPeriod(f.datum, sDate, eDate));
                const z11brutto = sSales.reduce((s, x) => s + (parseFloat(x.verkaufspreis)||0) + (parseFloat(x.versandkostenKaeufer)||0), 0);
                // Retouren abziehen (§11 EStG)
                // Nur Retouren ohne verknüpften stornierten Verkauf — verhindert Doppelabzug
                const _storniertSaleIds = new Set(Store.getSales(true).filter(s => s.storniert).map(s => s.id));
                const sRetouren = Store.getRetouren()
                    .filter(r => Utils.isInPeriod(r.datum, sDate, eDate) && !(r.saleId && _storniertSaleIds.has(r.saleId)))
                    .reduce((s,r)=>s+(parseFloat(r.erstattungBetrag)||0),0);
                const z11 = z11brutto - sRetouren;
                const z22 = sPurch.filter(p => !_elsterStorniertePurchaseIds.has(p.id)).reduce((s, p) => s + (parseFloat(p.einkaufspreis)||0) * (parseInt(p.anzahl)||1), 0);
                const z50 = sFahrt.reduce((s, f) => s + (parseFloat(f.kosten)||0), 0);
                const sonstAusg = sExp.reduce((s, e) => s + (parseFloat(e.betrag)||0), 0);
                const platGeb = sSales.reduce((s, x) => { const vk=parseFloat(x.verkaufspreis)||0; const vkK=parseFloat(x.versandkostenKaeufer)||0; const pct=parseFloat(x.plattformgebuehrProzent)||0; return s+(vk+vkK)*pct/100; }, 0);
                const versand = sSales.reduce((s, x) => s + (parseFloat(x.versandkostenVerkaufer)||0), 0);
                const sMat = Store.getMaterialVerbrauch().filter(v => !v.storniert && v.grund==='verkauf' && Utils.isInPeriod(v.datum, sDate, eDate)).reduce((s,v)=>s+(parseFloat(v.kosten)||0),0);
                const sEB = (() => { try { return JSON.parse(localStorage.getItem('eigenbelege_belege')||'[]'); } catch{return[];} })()
                    .filter(b => !b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, sDate, eDate))
                    .reduce((s,b)=>s+(parseFloat(b.betragNetto)||parseFloat(b.betragBrutto)||0),0);
                const z64 = sonstAusg + platGeb + versand + sMat + sEB;
                // Z46: AfA aus dem Anlagenverzeichnis
                const z46 = (() => {
                    if (typeof Store.getAfaAnlagen !== 'function' || typeof Afa === 'undefined') return 0;
                    return Store.getAfaAnlagen().filter(a => !a.storniert)
                        .reduce((s, a) => s + (Afa._calcJahresAfa ? Afa._calcJahresAfa(a, y) : 0), 0);
                })();
                const z91 = z11 - z22 - z46 - z50 - z64;
                const rows = [
                    ['ELSTER Anlage EÜR Export', '', '', ''],
                    ['Zeitraum:', sDate + ' bis ' + eDate, '', ''],
                    ['', '', '', ''],
                    ['Zeile', 'Bezeichnung', 'Betrag (€)', 'Hinweis'],
                    ['Z11', 'Betriebseinnahmen (Kleinunternehmer)', z11.toFixed(2), 'Bruttoerlöse inkl. Käufer-Versand, abzgl. Retouren' + (sRetouren > 0 ? ` (−${sRetouren.toFixed(2)} € Retouren)` : '')],
                    ['Z22', 'Wareneinkauf', z22.toFixed(2), 'Einkäufe im Zeitraum'],
                    ['Z46', 'Absetzung für Abnutzung (AfA)', z46.toFixed(2), 'Aus Anlagenverzeichnis §7 EStG'],
                    ['Z50', 'Fahrtkosten', z50.toFixed(2), 'Fahrtenbuch-Einträge'],
                    ['Z64', 'Sonstige Betriebsausgaben', z64.toFixed(2), 'Plattformgeb. + Versand + Ausgaben'],
                    ['Z91', 'Gewinn (Überschuss)', z91.toFixed(2), 'Z11 - Z22 - Z46 - Z50 - Z64'],
                ];
                Utils.downloadCSV(rows, `elster_euer_${y}.csv`);
                Utils.showToast('ELSTER CSV exportiert', 'success');
            });
        }

        const syncBtn = document.getElementById('euerSync');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                const toSync = (Store.getRechInvoices ? Store.getRechInvoices() : []).filter(inv => {
                    if (inv.status !== 'bezahlt' || inv._storniert) return false;
                    const ids = new Set(Store.getSales(true).filter(s => s._invoiceId).map(s => s._invoiceId));
                    return !ids.has(inv.id);
                });
                toSync.forEach(inv => Store.createSaleFromInvoice(inv, inv.verkaufsplattform || '', null, null));
                if (typeof Utils.showToast === 'function') Utils.showToast(toSync.length + ' Rechnung(en) synchronisiert!', 'success');
                this._refresh();
            });
        }
    },

    _refresh() {
        const contentEl = document.getElementById('content');
        contentEl.innerHTML = this.render();
        this.init();
    }
};
