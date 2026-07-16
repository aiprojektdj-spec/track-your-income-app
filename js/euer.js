// ============================================
// EÜR Module - Income-Expense Report
// ============================================
const Euer = {
    _period: 'jahr',
    _selectedYear: new Date().getFullYear(),
    _selectedMonth: new Date().getMonth(),
    _customStart: '',
    _customEnd: '',
    _detailView: null,   // 'einnahmen' | 'ausgaben' | 'gewinn' | null
    _lastRenderData: {},

    render() {
        // Kapitalgesellschaften nutzen Bilanz, nicht EÜR
        if (typeof Rechtsform !== 'undefined' && Rechtsform.isKapitalgesellschaft()) {
            return `<div class="page-header"><h2><i class="ti ti-file-analytics" style="margin-right:6px;"></i> EÜR</h2></div>
            <div class="card" style="padding:40px;text-align:center;">
                <div style="font-size:48px;margin-bottom:12px;">📊</div>
                <div style="font-weight:700;font-size:16px;margin-bottom:8px;">EÜR nicht verfügbar</div>
                <div style="color:var(--text-muted);margin-bottom:16px;">Als ${Rechtsform.get()} bist du bilanzpflichtig.<br>Nutze stattdessen die Bilanz / GuV.</div>
                <button class="btn btn-primary" data-action="navigate" data-args=\'["bilanz"]\'>→ Bilanz / GuV öffnen</button>
            </div>`;
        }

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
            if (inv.typ !== 'rechnung' && inv.typ !== 'gutschrift') return false;
            if (syncedInvoiceIds.has(inv.id)) return false;
            const d = inv.bezahltAm || inv.datum;
            return Utils.isInPeriod(d, startDate, endDate);
        });
        const rechnungsEinnahmen = unsyncedInvoices.reduce((sum, inv) => {
            const sign = inv.typ === 'gutschrift' ? -1 : 1; // §17 UStG: Gutschrift mindert den Umsatz
            return sum + sign * (inv.positionen || []).reduce((s2, p) => s2 + (p.menge || 0) * (p.einzelpreis || 0), 0);
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
        const eigenbelegeRaw = (() => { try { const _ebCo = localStorage.getItem('oyi_active_company')||''; const _k = (_ebCo?_ebCo+'__':'')+'eigenbelege_belege'; return (typeof Store !== 'undefined' ? Store._syncReadRaw(_k) : JSON.parse(localStorage.getItem(_k) || '[]')) || []; } catch { return []; } })();
        const eigenbelegeAusgaben = eigenbelegeRaw
            .filter(b => !b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, startDate, endDate))
            .reduce((sum, b) => sum + (parseFloat(b.betragNetto) || parseFloat(b.betragBrutto) || 0), 0);

        // Ausgaben gesamt
        // Kleinunternehmer: Brutto-Ausgaben (USt ist echter Kostenfaktor, kein Vorsteuerabzug)
        // Regelbesteuerung: Netto-Ausgaben (USt wird als Vorsteuer abgezogen = Durchlaufposten)
        const abzugsfaehig = wareneinkauf + versandkosten + plattformgebuehren + fahrtkosten + materialKosten + sonstigeAusgaben + eigenbelegeAusgaben + afaKosten;

        // ── Vorsteuer: tatsächlicher USt-Satz pro Einkauf (Fix: war pauschal /1.19) ──
        // Purchases können jetzt ustSatz = 19 | 7 | 0 tragen.
        // Fallback: 19% wenn kein ustSatz gespeichert (Altdaten-Kompatibilität).
        const vorsteuer = isRegel ? (() => {
            // Einkäufe: nach tatsächlichem Satz gewichtet
            const vstPurch = periodPurchases
                .filter(p => !p.storniert)
                .reduce((sum, p) => {
                    const brutto = (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
                    const rate   = (p.ustSatz != null ? Number(p.ustSatz) : 19) / 100;
                    const factor = rate / (1 + rate); // extract USt from brutto
                    return sum + brutto * factor;
                }, 0);
            // Sonstige Ausgaben, Fahrtkosten, Eigenbelege: pauschal 19% (keine Satz-Info).
            // AfA NICHT enthalten: die Vorsteuer wurde bereits im Anschaffungsjahr in voller Höhe
            // gezogen, die AfA selbst ist eine vorsteuerfreie (Netto-)Abschreibung.
            const vstOther = (versandkosten + plattformgebuehren + fahrtkosten + materialKosten + sonstigeAusgaben + eigenbelegeAusgaben) / 1.19 * 0.19;
            return vstPurch + vstOther;
        })() : 0;
        // Bei Regelbesteuerung zählt nur Netto als abzugsfähige BA; USt ist Durchlaufposten
        const summeAusgaben = isRegel ? (abzugsfaehig - vorsteuer) : abzugsfaehig;

        const gewinn = summeEinnahmen - summeAusgaben;
        this._lastGewinn = gewinn; // für Gewerbesteuer-Live-Update

        // ── Chart-Daten ────────────────────────────────────────────────────────
        // Monatliche Einnahmen/Ausgaben für das gesamte Jahr (unabhängig vom Zeitraum-Filter)
        const monthlyData = Array.from({length: 12}, (_, m) => {
            const mS = `${year}-${String(m+1).padStart(2,'0')}-01`;
            const mE = (() => { const d = new Date(year, m+1, 0); return `${year}-${String(m+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
            const mSales = Store.getSales().filter(s => !s.storniert && Utils.isInPeriod(s.datum, mS, mE));
            const mPurch = Store.getPurchases().filter(p => !p.storniert && Utils.isInPeriod(p.datum, mS, mE));
            const mExp   = Store.getExpenses().filter(e => Utils.isInPeriod(e.datum, mS, mE));
            const ein = Math.round(mSales.reduce((s,x) => s+(parseFloat(x.verkaufspreis)||0)+(parseFloat(x.versandkostenKaeufer)||0), 0)*100)/100;
            const aus = Math.round((mPurch.reduce((s,p) => s+(parseFloat(p.einkaufspreis)||0)*(parseInt(p.anzahl)||1), 0)+mExp.reduce((s,e) => s+(parseFloat(e.betrag)||0),0))*100)/100;
            return { ein, aus };
        });

        // Donut-Daten: Ausgaben nach Kategorie
        const donutLabels = ['Wareneinkauf','Versandkosten','Plattformgebühren'];
        const donutValues = [wareneinkauf, versandkosten, plattformgebuehren];
        if (fahrtkosten     > 0) { donutLabels.push('Fahrtkosten');      donutValues.push(fahrtkosten); }
        if (materialKosten  > 0) { donutLabels.push('Verpackung');       donutValues.push(materialKosten); }
        if (afaKosten       > 0) { donutLabels.push('AfA');              donutValues.push(afaKosten); }
        if (sonstigeAusgaben> 0) { donutLabels.push('Betriebsausgaben'); donutValues.push(sonstigeAusgaben); }
        if (eigenbelegeAusgaben>0){ donutLabels.push('Eigenbelege');     donutValues.push(eigenbelegeAusgaben); }

        this._lastRenderData = { sales, periodPurchases, expenses, eigenbelegeRaw, startDate, endDate, periodLabel, summeEinnahmen, summeAusgaben, gewinn, wareneinkauf, versandkosten, plattformgebuehren, fahrtkosten, materialKosten, sonstigeAusgaben, eigenbelegeAusgaben, afaKosten, monthlyData, donutLabels, donutValues, chartYear: year };

        // GbR-Gewinnverteilung Block
        const gbrBlock = (typeof GbR !== 'undefined') ? GbR.renderEuerBlock(gewinn) : '';

        return `
            <div class="page-header">
                <h2>Einnahmen-Überschuss-Rechnung</h2>
                <p class="text-muted no-print" style="margin:-8px 0 16px;font-size:13px;">Deine Steuer-Zusammenfassung für das Finanzamt — als CSV für ELSTER exportieren oder deinem Steuerberater weitergeben.</p>
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

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px;" id="euerKpiGrid">
                <div class="card stat-card success" data-euer-detail="einnahmen" style="padding:14px 16px;border-left:3px solid var(--success,#22c55e);cursor:pointer;transition:transform .15s,box-shadow .15s;${this._detailView==='einnahmen'?'outline:2px solid var(--success);outline-offset:2px;':''}">
                    <div class="card-label" style="display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">
                        <span style="display:flex;align-items:center;gap:5px;"><i class="ti ti-trending-up"></i> Einnahmen</span>
                        <span style="font-size:10px;opacity:.6;">${this._detailView==='einnahmen'?'▲':'▼'}</span>
                    </div>
                    <div class="card-value" style="font-size:28px;font-weight:700;line-height:1;" id="euerKpiEin">${Utils.formatCurrency(summeEinnahmen)}</div>
                    <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:5px;">${periodLabel}</div>
                </div>
                <div class="card stat-card danger" data-euer-detail="ausgaben" style="padding:14px 16px;border-left:3px solid var(--danger,#ef4444);cursor:pointer;transition:transform .15s,box-shadow .15s;${this._detailView==='ausgaben'?'outline:2px solid var(--danger);outline-offset:2px;':''}">
                    <div class="card-label" style="display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">
                        <span style="display:flex;align-items:center;gap:5px;"><i class="ti ti-trending-down"></i> Ausgaben</span>
                        <span style="font-size:10px;opacity:.6;">${this._detailView==='ausgaben'?'▲':'▼'}</span>
                    </div>
                    <div class="card-value" style="font-size:28px;font-weight:700;line-height:1;" id="euerKpiAus">${Utils.formatCurrency(summeAusgaben)}</div>
                    <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:5px;">${periodPurchases.length} Einkäufe · ${expenses.length} BA</div>
                </div>
                <div class="card stat-card ${gewinn >= 0 ? 'success' : 'danger'}" data-euer-detail="gewinn" style="padding:14px 16px;border-left:3px solid ${gewinn >= 0 ? 'var(--success,#22c55e)' : 'var(--danger,#ef4444)'};cursor:pointer;transition:transform .15s,box-shadow .15s;${this._detailView==='gewinn'?'outline:2px solid '+(gewinn>=0?'var(--success)':'var(--danger)')+';outline-offset:2px;':''}">
                    <div class="card-label" style="display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">
                        <span style="display:flex;align-items:center;gap:5px;"><i class="ti ti-scale"></i> ${gewinn >= 0 ? 'Gewinn' : 'Verlust'}</span>
                        <span style="font-size:10px;opacity:.6;">${this._detailView==='gewinn'?'▲':'▼'}</span>
                    </div>
                    <div class="card-value" style="font-size:28px;font-weight:700;line-height:1;color:${gewinn >= 0 ? 'var(--success)' : 'var(--danger)'};" id="euerKpiGewinn">${Utils.formatCurrency(gewinn)}</div>
                    <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:5px;">${sales.length} Verkäufe</div>
                </div>
            </div>

            <div class="no-print" style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:16px;" id="euerChartsRow">
                <div class="card" style="padding:16px 16px 10px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;">
                        <i class="ti ti-chart-bar" style="color:var(--text-secondary);font-size:14px;"></i>
                        <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);">Monatsübersicht ${year}</span>
                    </div>
                    <div id="euerMonthChart"></div>
                </div>
                <div class="card" style="padding:16px 16px 10px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;">
                        <i class="ti ti-chart-donut" style="color:var(--text-secondary);font-size:14px;"></i>
                        <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);">Ausgaben-Aufteilung</span>
                    </div>
                    <div id="euerDonutChart"></div>
                </div>
            </div>

            <div id="euerDetailSection" style="margin-bottom:16px;">
                ${this._detailView ? this._renderDetailSection(this._detailView) : ''}
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
                            <tr class="euer-section-header" style="background:rgba(34,197,94,.07);"><td colspan="2" style="color:var(--success);padding:10px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.8px;"><i class="ti ti-trending-up" style="margin-right:5px;vertical-align:middle;font-size:13px;"></i>Einnahmen</td></tr>
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

                            <tr class="euer-section-header" style="background:rgba(239,68,68,.07);"><td colspan="2" style="color:var(--danger);padding:10px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.8px;"><i class="ti ti-trending-down" style="margin-right:5px;vertical-align:middle;font-size:13px;"></i>Ausgaben</td></tr>
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
                                    <a href="#" data-action="navigate" data-args=\'["afa"]\' style="font-size:11px;margin-left:6px;">→ Anlagenverzeichnis</a>
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
                                <td>Eigenbelege (Ersatzbelege) <span style="font-size:11px;color:var(--text-muted);">(${eigenbelegeRaw.filter(b => !b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, startDate, endDate)).length} Belege)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(eigenbelegeAusgaben)}</td>
                            </tr>` : ''}
                            ${isRegel ? `<tr style="opacity:0.8;">
                                <td style="padding-left:16px;font-size:12px;">↳ Vorsteuer <span style="color:var(--text-muted);">aus Brutto-Ausgaben (tatsächlicher Satz je Einkauf)</span></td>
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

            ${typeof DatevExport !== 'undefined' ? DatevExport.renderCard() : ''}
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
                                    data-action-input="euer-hebesatz">
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

    _renderDetailSection(type) {
        const d = this._lastRenderData;
        if (!d || !d.sales) return '';

        const thStyle = 'padding:8px 12px;font-size:11px;font-weight:700;color:var(--text-muted);text-align:left;border-bottom:2px solid var(--border);white-space:nowrap;';
        const tdStyle = 'padding:7px 12px;font-size:12px;border-bottom:1px solid var(--border);vertical-align:middle;';
        const tdR     = tdStyle + 'text-align:right;font-weight:600;';

        if (type === 'einnahmen') {
            const rows = d.sales.map(s => {
                const vk   = parseFloat(s.verkaufspreis)||0;
                const vkK  = parseFloat(s.versandkostenKaeufer)||0;
                return `<tr>
                    <td style="${tdStyle}">${Utils.formatDate(s.datum)}</td>
                    <td style="${tdStyle}"><strong>${Utils.escapeHtml(s.marke||'—')}</strong>${s.artikeltyp?' <span style="color:var(--text-muted);">'+Utils.escapeHtml(s.artikeltyp)+'</span>':''}</td>
                    <td style="${tdStyle};color:var(--text-muted);">${Utils.escapeHtml(s.beschreibung||s.groesse||'—')}</td>
                    <td style="${tdStyle}">${Utils.escapeHtml(s.plattform||s.verkaufsplattform||'—')}</td>
                    <td style="${tdR}">${Utils.formatCurrency(vk)}</td>
                    <td style="${tdR};color:var(--text-muted);">${vkK>0?Utils.formatCurrency(vkK):'—'}</td>
                    <td style="${tdR};color:var(--success);">${Utils.formatCurrency(vk+vkK)}</td>
                </tr>`;
            }).join('');
            return `<div class="card" style="padding:0;overflow:hidden;">
                <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-weight:700;font-size:13px;"><i class="ti ti-trending-up" style="color:var(--success);"></i> Einnahmen — ${d.periodLabel} <span style="color:var(--text-muted);font-weight:400;">(${d.sales.length} Verkäufe)</span></div>
                    <div style="font-weight:800;font-size:15px;color:var(--success);">${Utils.formatCurrency(d.summeEinnahmen)}</div>
                </div>
                ${d.sales.length === 0 ? '<div style="padding:24px;text-align:center;color:var(--text-muted);">Keine Einnahmen im Zeitraum</div>' :
                `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
                    <thead><tr>
                        <th style="${thStyle}">Datum</th>
                        <th style="${thStyle}">Artikel</th>
                        <th style="${thStyle}">Beschreibung</th>
                        <th style="${thStyle}">Plattform</th>
                        <th style="${thStyle};text-align:right;">VK-Preis</th>
                        <th style="${thStyle};text-align:right;">Versand</th>
                        <th style="${thStyle};text-align:right;">Gesamt</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table></div>`}
            </div>`;
        }

        if (type === 'ausgaben') {
            const einkaufRows = d.periodPurchases.filter(p => !p.eigenbeleg_id).map(p => `<tr>
                <td style="${tdStyle}">${Utils.formatDate(p.datum)}</td>
                <td style="${tdStyle};color:var(--text-muted);font-size:11px;">${Utils.escapeHtml(p.artikelNr||'—')}</td>
                <td style="${tdStyle}"><strong>${Utils.escapeHtml(p.marke||'—')}</strong>${p.artikeltyp?' <span style="color:var(--text-muted);">'+Utils.escapeHtml(p.artikeltyp)+'</span>':''}</td>
                <td style="${tdStyle};color:var(--text-muted);">${Utils.escapeHtml(p.beschreibung||p.groesse||'—')}</td>
                <td style="${tdStyle}">${Utils.escapeHtml(p.einkaufsquelle||'—')}</td>
                <td style="${tdR};color:var(--danger);">${Utils.formatCurrency((parseFloat(p.einkaufspreis)||0)*(parseInt(p.anzahl)||1))}</td>
            </tr>`).join('');

            const baRows = d.expenses.map(e => `<tr>
                <td style="${tdStyle}">${Utils.formatDate(e.datum)}</td>
                <td style="${tdStyle}"><span style="padding:2px 8px;border-radius:10px;background:rgba(99,102,241,.12);color:var(--accent);font-size:11px;">${Utils.escapeHtml(e.kategorie||'Sonstiges')}</span></td>
                <td style="${tdStyle};color:var(--text-muted);">${Utils.escapeHtml(e.beschreibung||'—')}</td>
                <td style="${tdR};color:var(--danger);">${Utils.formatCurrency(parseFloat(e.betrag)||0)}</td>
            </tr>`).join('');

            const filteredEB = d.eigenbelegeRaw.filter(b => !b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, d.startDate, d.endDate));
            const ebRows = filteredEB.map(b => `<tr>
                <td style="${tdStyle}">${Utils.formatDate(b.belegDatum)}</td>
                <td style="${tdStyle}"><span style="padding:2px 8px;border-radius:10px;background:rgba(245,158,11,.12);color:var(--warning);font-size:11px;">Eigenbeleg</span></td>
                <td style="${tdStyle};color:var(--text-muted);">${Utils.escapeHtml(b.beschreibung||b.belegNr||'—')}</td>
                <td style="${tdR};color:var(--danger);">${Utils.formatCurrency(parseFloat(b.betragNetto)||parseFloat(b.betragBrutto)||0)}</td>
            </tr>`).join('');

            return `<div class="card" style="padding:0;overflow:hidden;">
                <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-weight:700;font-size:13px;"><i class="ti ti-trending-down" style="color:var(--danger);"></i> Ausgaben — ${d.periodLabel}</div>
                    <div style="font-weight:800;font-size:15px;color:var(--danger);">${Utils.formatCurrency(d.summeAusgaben)}</div>
                </div>
                ${d.periodPurchases.filter(p=>!p.eigenbeleg_id).length > 0 ? `
                <div style="padding:10px 16px 6px;font-size:12px;font-weight:700;color:var(--text-secondary);border-bottom:1px solid var(--border);">🛒 Wareneinkauf (${d.periodPurchases.filter(p=>!p.eigenbeleg_id).length} Artikel)</div>
                <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
                    <thead><tr>
                        <th style="${thStyle}">Datum</th><th style="${thStyle}">Art.-Nr.</th>
                        <th style="${thStyle}">Artikel</th><th style="${thStyle}">Beschreibung</th>
                        <th style="${thStyle}">Quelle</th><th style="${thStyle};text-align:right;">Betrag</th>
                    </tr></thead>
                    <tbody>${einkaufRows}</tbody>
                </table></div>` : ''}
                ${d.expenses.length > 0 ? `
                <div style="padding:10px 16px 6px;font-size:12px;font-weight:700;color:var(--text-secondary);border-bottom:1px solid var(--border);">💼 Betriebsausgaben (${d.expenses.length})</div>
                <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
                    <thead><tr>
                        <th style="${thStyle}">Datum</th><th style="${thStyle}">Kategorie</th>
                        <th style="${thStyle}">Beschreibung</th><th style="${thStyle};text-align:right;">Betrag</th>
                    </tr></thead>
                    <tbody>${baRows}</tbody>
                </table></div>` : ''}
                ${filteredEB.length > 0 ? `
                <div style="padding:10px 16px 6px;font-size:12px;font-weight:700;color:var(--text-secondary);border-bottom:1px solid var(--border);">🧾 Eigenbelege (${filteredEB.length})</div>
                <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
                    <thead><tr>
                        <th style="${thStyle}">Datum</th><th style="${thStyle}">Typ</th>
                        <th style="${thStyle}">Beschreibung</th><th style="${thStyle};text-align:right;">Betrag</th>
                    </tr></thead>
                    <tbody>${ebRows}</tbody>
                </table></div>` : ''}
                ${d.periodPurchases.filter(p=>!p.eigenbeleg_id).length===0 && d.expenses.length===0 && filteredEB.length===0 ?
                    '<div style="padding:24px;text-align:center;color:var(--text-muted);">Keine Ausgaben im Zeitraum</div>' : ''}
            </div>`;
        }

        if (type === 'gewinn') {
            const isPos = d.gewinn >= 0;
            const rows = [
                ['Summe Einnahmen', d.summeEinnahmen, 'var(--success)'],
                ['− Wareneinkauf', -d.wareneinkauf, 'var(--danger)'],
                ['− Versandkosten', -d.versandkosten, 'var(--danger)'],
                ['− Plattformgebühren', -d.plattformgebuehren, 'var(--danger)'],
                d.fahrtkosten > 0   ? ['− Fahrtkosten', -d.fahrtkosten, 'var(--danger)'] : null,
                d.materialKosten > 0? ['− Verpackungsmaterial', -d.materialKosten, 'var(--danger)'] : null,
                d.afaKosten > 0     ? ['− AfA / Abschreibungen', -d.afaKosten, 'var(--danger)'] : null,
                d.sonstigeAusgaben > 0 ? ['− Betriebsausgaben', -d.sonstigeAusgaben, 'var(--danger)'] : null,
                d.eigenbelegeAusgaben > 0 ? ['− Eigenbelege', -d.eigenbelegeAusgaben, 'var(--danger)'] : null,
            ].filter(Boolean);
            const rowHtml = rows.map(([label, val, color]) => `<tr>
                <td style="${tdStyle}">${label}</td>
                <td style="${tdR};color:${color};">${val < 0 ? Utils.formatCurrency(Math.abs(val)) : Utils.formatCurrency(val)}</td>
            </tr>`).join('');
            return `<div class="card" style="padding:0;overflow:hidden;">
                <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-weight:700;font-size:13px;"><i class="ti ti-scale" style="color:${isPos?'var(--success)':'var(--danger)'};"></i> Gewinnzusammensetzung — ${d.periodLabel}</div>
                    <div style="font-weight:800;font-size:15px;color:${isPos?'var(--success)':'var(--danger)'};">${Utils.formatCurrency(d.gewinn)}</div>
                </div>
                <div style="overflow-x:auto;max-width:480px;"><table style="width:100%;border-collapse:collapse;">
                    <tbody>${rowHtml}
                    <tr style="border-top:2px solid var(--border);">
                        <td style="${tdStyle};font-weight:800;font-size:14px;">= ${isPos?'Gewinn':'Verlust'}</td>
                        <td style="${tdR};font-size:15px;font-weight:800;color:${isPos?'var(--success)':'var(--danger)'};">${Utils.formatCurrency(Math.abs(d.gewinn))}</td>
                    </tr>
                    </tbody>
                </table></div>
            </div>`;
        }
        return '';
    },

    init() {
        // ── ApexCharts ───────────────────────────────────────────────────────
        if (typeof ApexCharts !== 'undefined') {
            const d = this._lastRenderData;
            const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
            const textMuted = isDark ? '#71717a' : '#9ca3af';
            const borderColor = isDark ? '#27272a' : '#e4e4e7';

            // Monats-Balken
            const monthEl = document.getElementById('euerMonthChart');
            if (monthEl && d.monthlyData) {
                const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
                new ApexCharts(monthEl, {
                    chart: { type: 'bar', height: 200, toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit', animations: { enabled: true, speed: 500 } },
                    series: [
                        { name: 'Einnahmen', data: d.monthlyData.map(m => m.ein) },
                        { name: 'Ausgaben',  data: d.monthlyData.map(m => m.aus) }
                    ],
                    xaxis: { categories: months, labels: { style: { fontSize: '10px', colors: textMuted } }, axisBorder: { show: false }, axisTicks: { show: false } },
                    yaxis: { labels: { formatter: v => v >= 1000 ? (v/1000).toLocaleString('de-DE',{maximumFractionDigits:1})+'k€' : v+'€', style: { fontSize: '10px', colors: textMuted } } },
                    colors: ['#22c55e', '#ef4444'],
                    plotOptions: { bar: { borderRadius: 3, columnWidth: '65%', borderRadiusApplication: 'end' } },
                    dataLabels: { enabled: false },
                    grid: { borderColor, strokeDashArray: 3, padding: { left: 0, right: 0 } },
                    legend: { labels: { colors: textMuted }, fontSize: '11px', position: 'top', horizontalAlign: 'right', offsetY: -5 },
                    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => v.toLocaleString('de-DE',{style:'currency',currency:'EUR'}) } }
                }).render();
            }

            // Donut Ausgaben
            const donutEl = document.getElementById('euerDonutChart');
            if (donutEl && d.donutLabels && d.donutValues) {
                const total = d.donutValues.reduce((a,b) => a+b, 0);
                if (total > 0) {
                    new ApexCharts(donutEl, {
                        chart: { type: 'donut', height: 200, background: 'transparent', fontFamily: 'inherit', animations: { enabled: true, speed: 500 } },
                        series: d.donutValues,
                        labels: d.donutLabels,
                        colors: ['#ef5350','#f5a623','#3b82f6','#8b93f8','#ec4899','#10b981','#6b7280','#f97316'],
                        dataLabels: { enabled: false },
                        plotOptions: { pie: { donut: { size: '68%', labels: { show: true, total: { show: true, label: 'Gesamt', color: textMuted, fontSize: '11px', formatter: () => total.toLocaleString('de-DE',{style:'currency',currency:'EUR'}) } } } } },
                        legend: { position: 'bottom', fontSize: '10px', labels: { colors: textMuted }, itemMargin: { horizontal: 5, vertical: 2 } },
                        tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => v.toLocaleString('de-DE',{style:'currency',currency:'EUR'}) } }
                    }).render();
                } else {
                    donutEl.innerHTML = '<div style="height:180px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;">Keine Ausgaben im Zeitraum</div>';
                }
            }
        }

        // GSAP KPI card animation
        if (typeof gsap !== 'undefined') {
            const cards = document.querySelectorAll('#euerKpiGrid .stat-card');
            if (cards.length) {
                gsap.from(cards, { y: 16, opacity: 0, stagger: 0.08, duration: 0.45, ease: 'power2.out', clearProps: 'all' });
                cards.forEach(card => {
                    const valEl = card.querySelector('.card-value');
                    if (!valEl) return;
                    const raw = valEl.textContent.trim();
                    if (raw.includes('/')) return; // Skip ratio values
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

        // KPI-Karten Detail-Toggle
        document.querySelectorAll('[data-euer-detail]').forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.euerDetail;
                this._detailView = this._detailView === type ? null : type;
                const section = document.getElementById('euerDetailSection');
                if (section) {
                    section.innerHTML = this._detailView ? this._renderDetailSection(this._detailView) : '';
                }
                // Update outline + arrow indicators
                document.querySelectorAll('[data-euer-detail]').forEach(c => {
                    const t = c.dataset.euerDetail;
                    const isActive = t === this._detailView;
                    c.style.outline = isActive ? '2px solid var(--accent)' : '';
                    c.style.outlineOffset = isActive ? '2px' : '';
                    const arrow = c.querySelector('span');
                    if (arrow) arrow.textContent = isActive ? '▲' : '▼';
                });
            });
        });

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
                if (!sSales.length && !sPurch.length && !sExp.length && !sFahrt.length) {
                    Utils.showToast(`Keine Daten für ${sDate} bis ${eDate} — nichts zu exportieren`, 'warning');
                    return;
                }
                // Regelbesteuerer: Anlage EÜR verlangt Netto-Beträge (USt ist Durchlaufposten, kein Ertrag/Aufwand).
                // Kleinunternehmer (§19 UStG): keine USt ausgewiesen, brutto = netto.
                const isRegel = (Store.getSettings().ustMode || 'klein') === 'regel';
                const _netto19 = brutto => isRegel ? brutto / 1.19 : brutto;
                const z11brutto = sSales.reduce((s, x) => s + (parseFloat(x.verkaufspreis)||0) + (parseFloat(x.versandkostenKaeufer)||0), 0);
                // Retouren abziehen (§11 EStG)
                // Nur Retouren ohne verknüpften stornierten Verkauf — verhindert Doppelabzug
                const _storniertSaleIds = new Set(Store.getSales(true).filter(s => s.storniert).map(s => s.id));
                const sRetouren = Store.getRetouren()
                    .filter(r => Utils.isInPeriod(r.datum, sDate, eDate) && !(r.saleId && _storniertSaleIds.has(r.saleId)))
                    .reduce((s,r)=>s+(parseFloat(r.erstattungBetrag)||0),0);
                const z11 = _netto19(z11brutto - sRetouren);
                const z22brutto = sPurch.filter(p => !_elsterStorniertePurchaseIds.has(p.id)).reduce((s, p) => s + (parseFloat(p.einkaufspreis)||0) * (parseInt(p.anzahl)||1), 0);
                const z22 = _netto19(z22brutto);
                const z50brutto = sFahrt.reduce((s, f) => s + (parseFloat(f.kosten)||0), 0);
                const z50 = _netto19(z50brutto);
                const sonstAusg = sExp.reduce((s, e) => s + (parseFloat(e.betrag)||0), 0);
                const platGeb = sSales.reduce((s, x) => { const vk=parseFloat(x.verkaufspreis)||0; const vkK=parseFloat(x.versandkostenKaeufer)||0; const pct=parseFloat(x.plattformgebuehrProzent)||0; return s+(vk+vkK)*pct/100; }, 0);
                const versand = sSales.reduce((s, x) => s + (parseFloat(x.versandkostenVerkaufer)||0), 0);
                const sMat = Store.getMaterialVerbrauch().filter(v => !v.storniert && v.grund==='verkauf' && Utils.isInPeriod(v.datum, sDate, eDate)).reduce((s,v)=>s+(parseFloat(v.kosten)||0),0);
                const sEB = (() => { try { const _ebCo = localStorage.getItem('oyi_active_company')||''; const _k = (_ebCo?_ebCo+'__':'')+'eigenbelege_belege'; return (typeof Store !== 'undefined' ? Store._syncReadRaw(_k) : JSON.parse(localStorage.getItem(_k)||'[]')) || []; } catch{return[];} })()
                    .filter(b => !b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, sDate, eDate))
                    .reduce((s,b)=>s+(parseFloat(b.betragNetto)||parseFloat(b.betragBrutto)||0),0);
                const z64brutto = sonstAusg + platGeb + versand + sMat + sEB;
                const z64 = _netto19(z64brutto);
                // Z46: AfA aus dem Anlagenverzeichnis (bereits vorsteuerfreie Netto-Abschreibung, keine Umrechnung)
                const z46 = (() => {
                    if (typeof Store.getAfaAnlagen !== 'function' || typeof Afa === 'undefined') return 0;
                    return Store.getAfaAnlagen().filter(a => !a.storniert)
                        .reduce((s, a) => s + (Afa._calcJahresAfa ? Afa._calcJahresAfa(a, y) : 0), 0);
                })();
                const z91 = z11 - z22 - z46 - z50 - z64;
                const nettoHinweis = isRegel ? ' (netto, USt herausgerechnet /1,19)' : '';
                const rows = [
                    ['ELSTER Anlage EÜR Export', '', '', ''],
                    ['Zeitraum:', sDate + ' bis ' + eDate, '', ''],
                    ['USt-Modus:', isRegel ? 'Regelbesteuerung' : 'Kleinunternehmer (§19 UStG)', '', ''],
                    ['', '', '', ''],
                    ['Zeile', 'Bezeichnung', 'Betrag (€)', 'Hinweis'],
                    ['Z11', 'Betriebseinnahmen' + nettoHinweis, z11.toFixed(2), 'Erlöse inkl. Käufer-Versand, abzgl. Retouren' + (sRetouren > 0 ? ` (−${sRetouren.toFixed(2)} € Retouren)` : '')],
                    ['Z22', 'Wareneinkauf' + nettoHinweis, z22.toFixed(2), 'Einkäufe im Zeitraum'],
                    ['Z46', 'Absetzung für Abnutzung (AfA)', z46.toFixed(2), 'Aus Anlagenverzeichnis §7 EStG'],
                    ['Z50', 'Fahrtkosten' + nettoHinweis, z50.toFixed(2), 'Fahrtenbuch-Einträge'],
                    ['Z64', 'Sonstige Betriebsausgaben' + nettoHinweis, z64.toFixed(2), 'Plattformgeb. + Versand + Ausgaben'],
                    ['Z91', 'Gewinn (Überschuss)', z91.toFixed(2), 'Z11 - Z22 - Z46 - Z50 - Z64'],
                ];
                Utils.downloadCSV(rows, `elster_euer_${y}.csv`);
                Utils.showToast('ELSTER CSV exportiert', 'success');
            });
        }

        // DATEV Export card
        if (typeof DatevExport !== 'undefined') DatevExport.initCard();

        const syncBtn = document.getElementById('euerSync');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                const toSync = (Store.getRechInvoices ? Store.getRechInvoices() : []).filter(inv => {
                    if (inv.status !== 'bezahlt' || inv._storniert) return false;
                    if (inv.typ !== 'rechnung' && inv.typ !== 'gutschrift') return false;
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

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'euer-hebesatz': function (e, el) { Euer._updateHebesatz(el.value); }
});
