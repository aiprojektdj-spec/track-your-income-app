// ============================================
// Bilanz / GuV — Vereinfachte Gewinn- und
// Verlustrechnung für bilanzpflichtige Unternehmen
// GmbH, UG, OHG, KG, GmbH & Co. KG
// ============================================
const Bilanz = {

    _year: new Date().getFullYear(),
    _tab:  'guv',

    // ── Daten ──
    _getData()   { return Store.get('bilanz_data') || {}; },
    _saveData(d) { Store.set('bilanz_data', d); },

    _getYearData(year) {
        const d = this._getData();
        return d[year] || { aktiva: {}, passiva: {}, guv_korrekturen: [] };
    },
    _saveYearData(year, yd) {
        const d = this._getData();
        d[year] = yd;
        this._saveData(d);
    },

    // ── GuV aus Buchungen berechnen ──
    _calcGuV(year) {
        const y = String(year);
        const sales     = (Store.getSales ? Store.getSales() : Store.get('sales') || []).filter(s => (s.datum || '').startsWith(y));
        const purchases = (Store.getPurchases ? Store.getPurchases() : Store.get('purchases') || []).filter(p => (p.datum || '').startsWith(y) && !p.storniert);
        const ausgaben  = (Store.getExpenses ? Store.getExpenses() : Store.get('ausgaben') || []).filter(a => (a.datum || '').startsWith(y));
        const retouren  = (Store.getRetouren ? Store.getRetouren() : Store.get('retouren') || []).filter(r => (r.datum || '').startsWith(y));

        // Umsatzerlöse (brutto → netto)
        const settings = Store.getSettings();
        const isRegel = (settings.ustMode || 'klein') === 'regel';

        let umsatzerloese = sales.reduce((s, v) => {
            const brutto = (parseFloat(v.verkaufspreis) || 0) + (parseFloat(v.versandkostenKaeufer) || 0);
            if (isRegel) {
                const rate = parseFloat(v.steuersatz) || 19;
                return s + brutto / (1 + rate / 100);
            }
            return s + brutto;
        }, 0);

        // Retouren abziehen
        const retourenSum = retouren.reduce((s, r) => s + (parseFloat(r.erstattungBetrag) || 0), 0);
        umsatzerloese -= retourenSum;

        // Wareneinsatz
        const wareneinsatz = purchases.reduce((s, p) => {
            const brutto = (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
            if (isRegel) {
                const rate = parseFloat(p.steuersatz) || 19;
                return s + brutto / (1 + rate / 100);
            }
            return s + brutto;
        }, 0);

        // Betriebsausgaben nach Kategorie
        const ausgabenKat = {};
        let betriebsausgabenGesamt = 0;
        ausgaben.forEach(a => {
            const kat = a.kategorie || 'Sonstiges';
            const brutto = parseFloat(a.betrag) || 0;
            let netto = brutto;
            if (isRegel) {
                const rate = parseFloat(a.ustSatz || a.steuersatz) || 19;
                if (rate > 0) netto = brutto / (1 + rate / 100);
            }
            ausgabenKat[kat] = (ausgabenKat[kat] || 0) + netto;
            betriebsausgabenGesamt += netto;
        });

        // AfA aus Anlagevermögen
        const afaItems = Store.get('afa_items') || [];
        const afaJahr = afaItems.reduce((s, item) => {
            if (!item.aktiv) return s;
            const nd = parseInt(item.nutzungsdauer) || 1;
            const ak = parseFloat(item.anschaffungskosten) || 0;
            return s + (ak / nd);
        }, 0);

        // Rohertrag
        const rohertrag = umsatzerloese - wareneinsatz;

        // Betriebsergebnis
        const betriebsergebnis = rohertrag - betriebsausgabenGesamt - afaJahr;

        // Manuelle Korrekturen (Zinsen, ao Erträge etc.)
        const yd = this._getYearData(year);
        const korrekturen = yd.guv_korrekturen || [];
        const korrekturSumme = korrekturen.reduce((s, k) => s + (parseFloat(k.betrag) || 0), 0);

        // Jahresüberschuss
        const jahresueberschuss = betriebsergebnis + korrekturSumme;

        return {
            umsatzerloese, retourenSum, wareneinsatz, rohertrag,
            ausgabenKat, betriebsausgabenGesamt, afaJahr,
            betriebsergebnis, korrekturen, korrekturSumme,
            jahresueberschuss
        };
    },

    // ── Render ──
    render() {
        const rf = typeof Rechtsform !== 'undefined' ? Rechtsform.getConfig() : null;
        if (rf && !rf.bilanzPflicht && !rf.bilanzOptional) {
            return `
            <div class="page-header"><h2><i class="ti ti-report-analytics" style="margin-right:6px;"></i> Bilanz / GuV</h2></div>
            <div class="card" style="padding:32px;text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">📊</div>
                <h3>Nicht verfügbar für diese Rechtsform</h3>
                <p style="color:var(--text-muted);">Freiberufler sind nicht bilanzpflichtig und nutzen die EÜR.</p>
            </div>`;
        }

        const year = this._year;
        const guv  = this._calcGuV(year);
        const form = typeof Rechtsform !== 'undefined' ? Rechtsform.get() : '?';
        const pflicht = rf && rf.bilanzPflicht;

        const yearOpts = Array.from({ length: 6 }, (_, i) => 2022 + i)
            .map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');

        const tabs = [
            ['guv', 'Gewinn- und Verlustrechnung'],
            ['aktiva', 'Aktiva (Vermögen)'],
            ['passiva', 'Passiva (Kapital)'],
        ];

        return `
        <div class="page-header">
            <h2><i class="ti ti-report-analytics" style="margin-right:6px;"></i> Bilanz / GuV</h2>
            <div class="page-header-actions no-print">
                <select class="form-select" id="bilanzYear" style="width:90px;">${yearOpts}</select>
                <button class="btn" data-action="bil-export">CSV Export</button>
            </div>
        </div>

        ${pflicht ? `
        <div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--text-secondary);">
            <strong style="color:var(--warning);">Bilanzpflicht:</strong> ${form} unterliegt der doppelten Buchführung (§238 HGB).
            Diese vereinfachte GuV ersetzt keine Buchführungssoftware — Steuerberater hinzuziehen.
        </div>` : `
        <div style="background:var(--info-bg);border:1px solid var(--info);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--text-secondary);">
            <strong style="color:var(--info);">Freiwillige Bilanz:</strong> ${form} kann freiwillig bilanzieren. Diese vereinfachte GuV zeigt Erträge und Aufwendungen.
        </div>`}

        <!-- KPI Cards -->
        <div class="stats-grid" style="margin-bottom:16px;">
            <div class="card stat-card">
                <div class="card-label">Umsatzerlöse</div>
                <div class="card-value">${Utils.formatCurrency(guv.umsatzerloese)}</div>
                <div class="card-subtitle">Netto ${year}</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Rohertrag</div>
                <div class="card-value">${Utils.formatCurrency(guv.rohertrag)}</div>
                <div class="card-subtitle">Umsatz − Wareneinsatz</div>
            </div>
            <div class="card stat-card ${guv.jahresueberschuss >= 0 ? 'success' : 'danger'}">
                <div class="card-label">Jahresüberschuss</div>
                <div class="card-value">${Utils.formatCurrency(guv.jahresueberschuss)}</div>
                <div class="card-subtitle">${guv.jahresueberschuss >= 0 ? 'Gewinn' : 'Verlust'}</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Marge</div>
                <div class="card-value">${guv.umsatzerloese > 0 ? (guv.rohertrag / guv.umsatzerloese * 100).toFixed(1) : '0'}%</div>
                <div class="card-subtitle">Rohertrag / Umsatz</div>
            </div>
        </div>

        <!-- Tab Bar -->
        <div style="display:flex;gap:2px;margin-bottom:16px;background:var(--bg-secondary);border-radius:10px;padding:4px;">
            ${tabs.map(([key, label]) => `
                <button class="bilanz-tab-btn" data-bilanz-tab="${key}" style="flex:1;padding:8px 10px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;
                    background:${this._tab === key ? 'var(--bg-card)' : 'transparent'};
                    color:${this._tab === key ? 'var(--accent)' : 'var(--text-secondary)'};
                    box-shadow:${this._tab === key ? '0 1px 4px rgba(0,0,0,.2)' : 'none'};">
                    ${label}
                </button>`).join('')}
        </div>

        <div id="bilanzTabContent">
            ${this._renderTab(guv, year)}
        </div>`;
    },

    _renderTab(guv, year) {
        switch (this._tab) {
            case 'guv':     return this._renderGuV(guv, year);
            case 'aktiva':  return this._renderAktiva(year);
            case 'passiva': return this._renderPassiva(year);
            default:        return this._renderGuV(guv, year);
        }
    },

    // ── GuV ──
    _renderGuV(guv, year) {
        const katRows = Object.entries(guv.ausgabenKat)
            .sort((a, b) => b[1] - a[1])
            .map(([kat, val]) => `<tr>
                <td style="padding-left:28px;font-size:12px;color:var(--text-secondary);">− ${Utils.escapeHtml(kat)}</td>
                <td style="text-align:right;color:var(--danger)">${Utils.formatCurrency(val)}</td>
            </tr>`).join('');

        return `
        <div class="card" style="padding:20px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:16px;">Gewinn- und Verlustrechnung ${year}</div>
            <div class="table-container" style="border:none;">
                <table class="euer-table">
                    <thead><tr><th>Position</th><th style="text-align:right;width:25%;">Betrag</th></tr></thead>
                    <tbody>
                        <tr><td colspan="2" style="font-weight:700;color:var(--text-muted);padding-top:10px;">ERTRÄGE</td></tr>
                        <tr><td>Umsatzerlöse (netto)</td><td style="text-align:right;color:var(--success)">${Utils.formatCurrency(guv.umsatzerloese)}</td></tr>
                        ${guv.retourenSum > 0 ? `<tr><td style="padding-left:28px;font-size:12px;color:var(--text-muted);">davon Retouren</td><td style="text-align:right;color:var(--danger)">− ${Utils.formatCurrency(guv.retourenSum)}</td></tr>` : ''}

                        <tr><td colspan="2" style="font-weight:700;color:var(--text-muted);padding-top:14px;">AUFWENDUNGEN</td></tr>
                        <tr><td>Wareneinsatz</td><td style="text-align:right;color:var(--danger)">− ${Utils.formatCurrency(guv.wareneinsatz)}</td></tr>
                        <tr style="font-weight:600;background:var(--bg-secondary);"><td>= Rohertrag (Bruttomarge)</td><td style="text-align:right">${Utils.formatCurrency(guv.rohertrag)}</td></tr>

                        <tr><td style="padding-top:10px;">Betriebsausgaben gesamt</td><td style="text-align:right;color:var(--danger)">− ${Utils.formatCurrency(guv.betriebsausgabenGesamt)}</td></tr>
                        ${katRows}
                        <tr><td>Abschreibungen (AfA)</td><td style="text-align:right;color:var(--danger)">− ${Utils.formatCurrency(guv.afaJahr)}</td></tr>

                        <tr style="font-weight:600;background:var(--bg-secondary);"><td>= Betriebsergebnis (EBIT)</td><td style="text-align:right">${Utils.formatCurrency(guv.betriebsergebnis)}</td></tr>

                        ${guv.korrekturen.length > 0 ? `
                        <tr><td colspan="2" style="font-weight:700;color:var(--text-muted);padding-top:14px;">KORREKTUREN / SONSTIGES</td></tr>
                        ${guv.korrekturen.map(k => `<tr>
                            <td style="font-size:12px;">${Utils.escapeHtml(k.bezeichnung || '—')}</td>
                            <td style="text-align:right;color:${(parseFloat(k.betrag) || 0) >= 0 ? 'var(--success)' : 'var(--danger)'};">${Utils.formatCurrency(parseFloat(k.betrag) || 0)}</td>
                        </tr>`).join('')}` : ''}

                        <tr class="euer-result">
                            <td><strong>${guv.jahresueberschuss >= 0 ? 'Jahresüberschuss' : 'Jahresfehlbetrag'}</strong></td>
                            <td style="text-align:right;font-size:1.15rem;font-weight:800;color:${guv.jahresueberschuss >= 0 ? 'var(--success)' : 'var(--danger)'};">
                                ${Utils.formatCurrency(guv.jahresueberschuss)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="margin-top:16px;display:flex;gap:8px;">
                <button class="btn btn-small" id="addGuvKorrekturBtn">+ Korrekturposten</button>
            </div>
        </div>`;
    },

    // ── Aktiva ──
    _renderAktiva(year) {
        const yd = this._getYearData(year);
        const a  = yd.aktiva || {};

        // AfA-Anlagevermögen
        const afaItems = Store.get('afa_items') || [];
        const anlagevermoegen = afaItems.reduce((s, item) => {
            if (!item.aktiv) return s;
            const ak = parseFloat(item.anschaffungskosten) || 0;
            const nd = parseInt(item.nutzungsdauer) || 1;
            const alter = new Date().getFullYear() - new Date(item.anschaffungsdatum || item.datum).getFullYear();
            const restwert = Math.max(0, ak - (ak / nd * Math.min(alter, nd)));
            return s + restwert;
        }, 0);

        // Manuelle Aktiva-Posten
        const posten = a.posten || [];
        const postenSum = posten.reduce((s, p) => s + (parseFloat(p.betrag) || 0), 0);

        // Kasse/Bank (manuell)
        const kasseBank = parseFloat(a.kasseBank) || 0;

        const total = anlagevermoegen + postenSum + kasseBank;

        return `
        <div class="card" style="padding:20px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:16px;">Aktiva (Vermögen) — ${year}</div>
            <div class="table-container" style="border:none;">
                <table class="euer-table">
                    <thead><tr><th>Position</th><th style="text-align:right;width:25%;">Betrag</th></tr></thead>
                    <tbody>
                        <tr><td colspan="2" style="font-weight:700;color:var(--text-muted);">ANLAGEVERMÖGEN</td></tr>
                        <tr><td>Sachanlagen (AfA-Restwerte)</td><td style="text-align:right">${Utils.formatCurrency(anlagevermoegen)}</td></tr>
                        ${afaItems.filter(i => i.aktiv).slice(0, 5).map(item => {
                            const ak = parseFloat(item.anschaffungskosten) || 0;
                            const nd = parseInt(item.nutzungsdauer) || 1;
                            const alter = new Date().getFullYear() - new Date(item.anschaffungsdatum || item.datum).getFullYear();
                            const rw = Math.max(0, ak - (ak / nd * Math.min(alter, nd)));
                            return `<tr><td style="padding-left:28px;font-size:11px;color:var(--text-muted);">${Utils.escapeHtml((item.bezeichnung || item.name || '').substring(0, 30))}</td><td style="text-align:right;font-size:11px;">${Utils.formatCurrency(rw)}</td></tr>`;
                        }).join('')}

                        <tr><td colspan="2" style="font-weight:700;color:var(--text-muted);padding-top:14px;">UMLAUFVERMÖGEN</td></tr>
                        ${posten.map(p => `<tr>
                            <td>${Utils.escapeHtml(p.bezeichnung)}</td>
                            <td style="text-align:right">${Utils.formatCurrency(parseFloat(p.betrag) || 0)}</td>
                        </tr>`).join('')}

                        <tr><td colspan="2" style="font-weight:700;color:var(--text-muted);padding-top:14px;">LIQUIDE MITTEL</td></tr>
                        <tr><td>Kasse / Bank</td><td style="text-align:right">${Utils.formatCurrency(kasseBank)}</td></tr>

                        <tr class="euer-result">
                            <td><strong>Bilanzsumme Aktiva</strong></td>
                            <td style="text-align:right;font-weight:800;font-size:1.1rem;">${Utils.formatCurrency(total)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-small" id="addAktivaPostenBtn">+ Umlaufvermögen</button>
                <button class="btn btn-small" id="editKasseBankBtn">Kasse/Bank setzen</button>
            </div>
        </div>`;
    },

    // ── Passiva ──
    _renderPassiva(year) {
        const yd = this._getYearData(year);
        const p  = yd.passiva || {};

        const eigenkapital = parseFloat(p.eigenkapital) || 0;
        const ruecklagen   = parseFloat(p.ruecklagen) || 0;
        const gewinnvortrag = parseFloat(p.gewinnvortrag) || 0;
        const guv = this._calcGuV(year);

        // Manuelle Verbindlichkeiten
        const verbindlichkeiten = p.verbindlichkeiten || [];
        const verbSum = verbindlichkeiten.reduce((s, v) => s + (parseFloat(v.betrag) || 0), 0);

        const total = eigenkapital + ruecklagen + gewinnvortrag + guv.jahresueberschuss + verbSum;

        return `
        <div class="card" style="padding:20px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:16px;">Passiva (Kapital) — ${year}</div>
            <div class="table-container" style="border:none;">
                <table class="euer-table">
                    <thead><tr><th>Position</th><th style="text-align:right;width:25%;">Betrag</th></tr></thead>
                    <tbody>
                        <tr><td colspan="2" style="font-weight:700;color:var(--text-muted);">EIGENKAPITAL</td></tr>
                        <tr><td>Stammkapital / Gezeichnetes Kapital</td><td style="text-align:right">${Utils.formatCurrency(eigenkapital)}</td></tr>
                        <tr><td>Rücklagen</td><td style="text-align:right">${Utils.formatCurrency(ruecklagen)}</td></tr>
                        <tr><td>Gewinnvortrag aus Vorjahren</td><td style="text-align:right">${Utils.formatCurrency(gewinnvortrag)}</td></tr>
                        <tr><td>Jahresüberschuss ${year}</td><td style="text-align:right;color:${guv.jahresueberschuss >= 0 ? 'var(--success)' : 'var(--danger)'}">${Utils.formatCurrency(guv.jahresueberschuss)}</td></tr>

                        <tr><td colspan="2" style="font-weight:700;color:var(--text-muted);padding-top:14px;">FREMDKAPITAL / VERBINDLICHKEITEN</td></tr>
                        ${verbindlichkeiten.length === 0
                            ? `<tr><td style="color:var(--text-muted);font-size:12px;">Keine Verbindlichkeiten erfasst</td><td></td></tr>`
                            : verbindlichkeiten.map(v => `<tr>
                                <td>${Utils.escapeHtml(v.bezeichnung)}</td>
                                <td style="text-align:right">${Utils.formatCurrency(parseFloat(v.betrag) || 0)}</td>
                            </tr>`).join('')}

                        <tr class="euer-result">
                            <td><strong>Bilanzsumme Passiva</strong></td>
                            <td style="text-align:right;font-weight:800;font-size:1.1rem;">${Utils.formatCurrency(total)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-small" id="editEigenkapitalBtn">Eigenkapital bearbeiten</button>
                <button class="btn btn-small" id="addVerbindlichkeitBtn">+ Verbindlichkeit</button>
            </div>
        </div>`;
    },

    // ── Modals ──
    _openGuvKorrektur() {
        App.showModal('GuV-Korrekturposten', `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-group">
                    <label class="form-label">Bezeichnung *</label>
                    <input type="text" class="form-input" id="gk_bez" placeholder="z.B. Zinserträge, a.o. Aufwand">
                </div>
                <div class="form-group">
                    <label class="form-label">Betrag (€) *</label>
                    <input type="number" step="0.01" class="form-input" id="gk_betrag" placeholder="Positiv = Ertrag, Negativ = Aufwand">
                </div>
            </div>`,
        `<button class="btn" data-action="close-modal">Abbrechen</button>
         <button class="btn btn-primary" id="saveGkBtn">Speichern</button>`);

        document.getElementById('saveGkBtn').addEventListener('click', () => {
            const bez = document.getElementById('gk_bez').value.trim();
            const betrag = parseFloat(document.getElementById('gk_betrag').value);
            if (!bez || isNaN(betrag)) { Utils.showToast('Pflichtfelder', 'warning'); return; }
            const yd = this._getYearData(this._year);
            if (!yd.guv_korrekturen) yd.guv_korrekturen = [];
            yd.guv_korrekturen.push({ id: Store.generateId(), bezeichnung: bez, betrag });
            this._saveYearData(this._year, yd);
            App.closeModal();
            this._refresh();
        });
    },

    _openEigenkapitalModal() {
        const yd = this._getYearData(this._year);
        const p = yd.passiva || {};
        App.showModal('Eigenkapital bearbeiten', `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-group">
                    <label class="form-label">Stammkapital (€)</label>
                    <input type="number" step="0.01" class="form-input" id="ek_stamm" value="${p.eigenkapital || ''}" placeholder="z.B. 25000">
                </div>
                <div class="form-group">
                    <label class="form-label">Rücklagen (€)</label>
                    <input type="number" step="0.01" class="form-input" id="ek_rueck" value="${p.ruecklagen || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Gewinnvortrag (€)</label>
                    <input type="number" step="0.01" class="form-input" id="ek_gv" value="${p.gewinnvortrag || ''}">
                </div>
            </div>`,
        `<button class="btn" data-action="close-modal">Abbrechen</button>
         <button class="btn btn-primary" id="saveEkBtn">Speichern</button>`);

        document.getElementById('saveEkBtn').addEventListener('click', () => {
            const yd = this._getYearData(this._year);
            if (!yd.passiva) yd.passiva = {};
            yd.passiva.eigenkapital = parseFloat(document.getElementById('ek_stamm').value) || 0;
            yd.passiva.ruecklagen = parseFloat(document.getElementById('ek_rueck').value) || 0;
            yd.passiva.gewinnvortrag = parseFloat(document.getElementById('ek_gv').value) || 0;
            this._saveYearData(this._year, yd);
            App.closeModal();
            Utils.showToast('Eigenkapital gespeichert', 'success');
            this._refresh();
        });
    },

    _openKasseBankModal() {
        const yd = this._getYearData(this._year);
        const a = yd.aktiva || {};
        App.showModal('Kasse / Bank', `
            <div class="form-group">
                <label class="form-label">Kasse + Bank Saldo (€)</label>
                <input type="number" step="0.01" class="form-input" id="kb_val" value="${a.kasseBank || ''}" placeholder="Gesamtsaldo">
            </div>`,
        `<button class="btn" data-action="close-modal">Abbrechen</button>
         <button class="btn btn-primary" id="saveKbBtn">Speichern</button>`);

        document.getElementById('saveKbBtn').addEventListener('click', () => {
            const yd = this._getYearData(this._year);
            if (!yd.aktiva) yd.aktiva = {};
            yd.aktiva.kasseBank = parseFloat(document.getElementById('kb_val').value) || 0;
            this._saveYearData(this._year, yd);
            App.closeModal();
            this._refresh();
        });
    },

    _openAddAktivaPosten() {
        App.showModal('Umlaufvermögen hinzufügen', `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-group">
                    <label class="form-label">Bezeichnung *</label>
                    <input type="text" class="form-input" id="ap_bez" placeholder="z.B. Forderungen, Vorräte">
                </div>
                <div class="form-group">
                    <label class="form-label">Betrag (€) *</label>
                    <input type="number" step="0.01" min="0" class="form-input" id="ap_betrag">
                </div>
            </div>`,
        `<button class="btn" data-action="close-modal">Abbrechen</button>
         <button class="btn btn-primary" id="saveApBtn">Speichern</button>`);

        document.getElementById('saveApBtn').addEventListener('click', () => {
            const bez = document.getElementById('ap_bez').value.trim();
            const betrag = parseFloat(document.getElementById('ap_betrag').value);
            if (!bez || isNaN(betrag)) { Utils.showToast('Pflichtfelder', 'warning'); return; }
            const yd = this._getYearData(this._year);
            if (!yd.aktiva) yd.aktiva = {};
            if (!yd.aktiva.posten) yd.aktiva.posten = [];
            yd.aktiva.posten.push({ id: Store.generateId(), bezeichnung: bez, betrag });
            this._saveYearData(this._year, yd);
            App.closeModal();
            this._refresh();
        });
    },

    _openAddVerbindlichkeit() {
        App.showModal('Verbindlichkeit hinzufügen', `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-group">
                    <label class="form-label">Bezeichnung *</label>
                    <input type="text" class="form-input" id="vb_bez" placeholder="z.B. Bankdarlehen, Lieferanten">
                </div>
                <div class="form-group">
                    <label class="form-label">Betrag (€) *</label>
                    <input type="number" step="0.01" min="0" class="form-input" id="vb_betrag">
                </div>
            </div>`,
        `<button class="btn" data-action="close-modal">Abbrechen</button>
         <button class="btn btn-primary" id="saveVbBtn">Speichern</button>`);

        document.getElementById('saveVbBtn').addEventListener('click', () => {
            const bez = document.getElementById('vb_bez').value.trim();
            const betrag = parseFloat(document.getElementById('vb_betrag').value);
            if (!bez || isNaN(betrag)) { Utils.showToast('Pflichtfelder', 'warning'); return; }
            const yd = this._getYearData(this._year);
            if (!yd.passiva) yd.passiva = {};
            if (!yd.passiva.verbindlichkeiten) yd.passiva.verbindlichkeiten = [];
            yd.passiva.verbindlichkeiten.push({ id: Store.generateId(), bezeichnung: bez, betrag });
            this._saveYearData(this._year, yd);
            App.closeModal();
            this._refresh();
        });
    },

    _exportCSV() {
        const year = this._year;
        const guv = this._calcGuV(year);
        const rows = [
            ['Gewinn- und Verlustrechnung', year],
            [''],
            ['Position', 'Betrag EUR'],
            ['Umsatzerlöse (netto)', guv.umsatzerloese.toFixed(2)],
            ['Wareneinsatz', guv.wareneinsatz.toFixed(2)],
            ['Rohertrag', guv.rohertrag.toFixed(2)],
            ['Betriebsausgaben', guv.betriebsausgabenGesamt.toFixed(2)],
            ['AfA', guv.afaJahr.toFixed(2)],
            ['Betriebsergebnis (EBIT)', guv.betriebsergebnis.toFixed(2)],
            ['Korrekturen', guv.korrekturSumme.toFixed(2)],
            ['Jahresüberschuss', guv.jahresueberschuss.toFixed(2)],
        ];
        Utils.downloadCSV(rows, `guv_${year}.csv`);
        Utils.showToast('CSV exportiert', 'success');
    },

    _refresh() {
        const el = document.getElementById('content');
        if (!el) return;
        el.innerHTML = this.render();
        this.init();
    },

    init() {
        const ySel = document.getElementById('bilanzYear');
        if (ySel) ySel.addEventListener('change', () => { this._year = parseInt(ySel.value); this._refresh(); });

        document.querySelectorAll('.bilanz-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => { this._tab = btn.dataset.bilanzTab; this._refresh(); });
        });

        const gkBtn = document.getElementById('addGuvKorrekturBtn');
        if (gkBtn) gkBtn.addEventListener('click', () => this._openGuvKorrektur());
        const ekBtn = document.getElementById('editEigenkapitalBtn');
        if (ekBtn) ekBtn.addEventListener('click', () => this._openEigenkapitalModal());
        const kbBtn = document.getElementById('editKasseBankBtn');
        if (kbBtn) kbBtn.addEventListener('click', () => this._openKasseBankModal());
        const apBtn = document.getElementById('addAktivaPostenBtn');
        if (apBtn) apBtn.addEventListener('click', () => this._openAddAktivaPosten());
        const vbBtn = document.getElementById('addVerbindlichkeitBtn');
        if (vbBtn) vbBtn.addEventListener('click', () => this._openAddVerbindlichkeit());
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'bil-export': function () { Bilanz._exportCSV(); }
});
