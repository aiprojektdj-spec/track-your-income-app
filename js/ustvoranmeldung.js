// ============================================
// USt-Voranmeldung (UVA)
// §18 UStG – Nur für Regelbesteuerung
// ============================================
const UstVoranmeldung = {
    _year:    new Date().getFullYear(),
    _quartal: Math.floor(new Date().getMonth() / 3), // 0-3

    _isRegel() {
        return (Store.getSettings().ustMode || 'klein') === 'regel';
    },

    // Berechnet Kennzahlen für einen Zeitraum
    _calcPeriode(startDate, endDate) {
        const sales     = Store.getSales().filter(s => Utils.isInPeriod(s.datum, startDate, endDate));
        const purchases = Store.getPurchases().filter(p => Utils.isInPeriod(p.datum, startDate, endDate));
        const expenses  = Store.getExpenses().filter(e => Utils.isInPeriod(e.datum, startDate, endDate));
        const retouren  = Store.getRetouren().filter(r => Utils.isInPeriod(r.datum, startDate, endDate));

        // Brutto-Umsätze nach Steuersatz aufteilen (Feld: steuersatz, Default: 19)
        const _rate = item => (parseFloat(item.steuersatz) || 19);
        const _brutto = item => (parseFloat(item.verkaufspreis) || 0) + (parseFloat(item.versandkostenKaeufer) || 0);

        const bruttoUmsatz7  = sales.filter(v => _rate(v) === 7)
            .reduce((s, v) => s + _brutto(v), 0);
        const bruttoUmsatz19 = sales.filter(v => _rate(v) !== 7)
            .reduce((s, v) => s + _brutto(v), 0)
            - retouren.reduce((s, r) => s + (parseFloat(r.erstattungBetrag) || 0), 0);

        const bruttoUmsatz = bruttoUmsatz19 + bruttoUmsatz7;

        // Kz. 81 + Kz. 83: Netto-Umsätze 19%
        const nettoUmsatz19 = bruttoUmsatz19 / 1.19;
        const ust19         = nettoUmsatz19 * 0.19;

        // Kz. 86 + Kz. 35: Netto-Umsätze 7%
        const nettoUmsatz7  = bruttoUmsatz7 / 1.07;
        const ust7          = nettoUmsatz7 * 0.07;

        // Vorsteuer aus Einkäufen + Ausgaben + §13b/EU: Kz. 66
        // Per-item Berechnung statt flat rate (nutzt Vorsteuer-Modul wenn verfügbar)
        let vorsteuer = 0;
        if (typeof Vorsteuer !== 'undefined') {
            const vstCalc = Vorsteuer._calcTotal(startDate, endDate);
            vorsteuer = vstCalc.totalVorsteuer;
        } else {
            // Fallback: per-item Berechnung
            purchases.forEach(p => {
                const rate = parseFloat(p.steuersatz) || 19;
                const brutto = (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
                vorsteuer += brutto - (brutto / (1 + rate / 100));
            });
            expenses.forEach(e => {
                const rate = parseFloat(e.ustSatz || e.steuersatz) || 19;
                const brutto = parseFloat(e.betrag) || 0;
                if (rate > 0) vorsteuer += brutto - (brutto / (1 + rate / 100));
            });
        }

        // Zahllast / Erstattung
        const zahllast = ust19 + ust7 - vorsteuer;

        return { bruttoUmsatz, bruttoUmsatz19, bruttoUmsatz7, nettoUmsatz19, nettoUmsatz7, ust19, ust7, vorsteuer, zahllast };
    },

    // Startdatum eines Quartals
    _qStart(year, q) {
        return `${year}-${String(q * 3 + 1).padStart(2, '0')}-01`;
    },
    _qEnd(year, q) {
        const d = new Date(year, q * 3 + 3, 0);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    render() {
        if (Store.getSettings().land === 'CH') {
            return `
            <div class="page-header"><h2><i class="ti ti-receipt-tax" style="margin-right:6px;"></i> USt-Voranmeldung</h2></div>
            <div class="card" style="padding:40px;text-align:center;">
                <div style="font-size:48px;margin-bottom:12px;">🇨🇭</div>
                <div style="font-weight:700;font-size:16px;margin-bottom:8px;">Nicht verfügbar im Schweiz-Modus</div>
                <div style="color:var(--text-muted);margin-bottom:16px;">Die deutsche USt-Voranmeldung (§18 UStG) gilt nicht in der Schweiz.<br>Für die MWST-Abrechnung nach MWSTG nutze das Schweiz-Modul.</div>
                <button class="btn btn-primary" onclick="App.navigate('schweiz')">→ Schweiz MWST-Abrechnung</button>
            </div>`;
        }

        if (!this._isRegel()) {
            return `
            <div class="page-header"><h2>🧾 USt-Voranmeldung</h2></div>
            <div class="card">
                <div style="padding:32px;text-align:center;">
                    <div style="font-size:48px;margin-bottom:16px;">📋</div>
                    <h3>Nur für Regelbesteuerer</h3>
                    <p style="color:var(--text-muted);margin:8px 0 20px;">
                        Du bist aktuell als <strong>Kleinunternehmer (§19 UStG)</strong> eingestellt.<br>
                        Die USt-Voranmeldung ist nur für Regelbesteuerer relevant.
                    </p>
                    <button class="btn btn-primary" onclick="App.navigate('euer')">Zur EÜR → USt-Modus ändern</button>
                </div>
            </div>`;
        }

        const year = this._year;
        const q    = this._quartal;
        const start = this._qStart(year, q);
        const end   = this._qEnd(year, q);
        const calc  = this._calcPeriode(start, end);

        // Alle 4 Quartale für Jahresübersicht
        const jahresUebersicht = [0, 1, 2, 3].map(qi => {
            const qs = this._qStart(year, qi);
            const qe = this._qEnd(year, qi);
            const c  = this._calcPeriode(qs, qe);
            const gesperrt = Store.getUstPerioden().find(p => p.year === year && p.quartal === qi);
            return { qi, c, gesperrt };
        });

        const jahresZahllast = jahresUebersicht.reduce((s, r) => s + r.c.zahllast, 0);

        const yearOptions = Array.from({ length: 8 }, (_, i) => 2020 + i)
            .map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');

        const qOptions = [0, 1, 2, 3].map(qi =>
            `<option value="${qi}" ${qi === q ? 'selected' : ''}>Q${qi + 1} (${this._qStart(year, qi).slice(0, 7)} – ${this._qEnd(year, qi).slice(0, 7)})</option>`
        ).join('');

        const gesperrt = Store.getUstPerioden().find(p => p.year === year && p.quartal === q);

        return `
        <div class="page-header">
            <h2>🧾 USt-Voranmeldung</h2>
            <div class="page-header-actions no-print">
                <select class="form-select" id="uvYear" style="width:90px;">${yearOptions}</select>
                <select class="form-select" id="uvQuartal">${qOptions}</select>
                <button class="btn" onclick="UstVoranmeldung._exportCSV()">ELSTER CSV</button>
            </div>
        </div>

        <div class="stats-grid" style="margin-bottom:20px;">
            <div class="card stat-card">
                <div class="card-label">Brutto-Umsatz Q${q + 1}/${year}</div>
                <div class="card-value">${Utils.formatCurrency(calc.bruttoUmsatz)}</div>
                <div class="card-subtitle">Inkl. 19% USt</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Netto-Umsatz (Kz. 81)</div>
                <div class="card-value">${Utils.formatCurrency(calc.nettoUmsatz19)}</div>
                <div class="card-subtitle">Steuerpflichtige Umsätze 19%</div>
            </div>
            <div class="card stat-card danger">
                <div class="card-label">USt auf Umsätze (Kz. 83)</div>
                <div class="card-value">${Utils.formatCurrency(calc.ust19)}</div>
                <div class="card-subtitle">19% von Netto-Umsatz</div>
            </div>
            <div class="card stat-card success">
                <div class="card-label">Vorsteuer (Kz. 66)</div>
                <div class="card-value">${Utils.formatCurrency(calc.vorsteuer)}</div>
                <div class="card-subtitle">Aus Einkäufen + Ausgaben</div>
            </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
            <div class="card-header">
                <div class="card-title">Kennzahlen Q${q + 1}/${year} (${Utils.formatDate(start)} – ${Utils.formatDate(end)})</div>
                ${gesperrt ? '<span class="badge badge-success">✅ Eingereicht</span>' : '<span class="badge badge-warning">⏳ Offen</span>'}
            </div>
            <div class="table-container" style="border:none;">
                <table class="euer-table">
                    <thead><tr><th style="width:20%">Kz.</th><th>Bezeichnung</th><th style="text-align:right;width:25%">Betrag</th></tr></thead>
                    <tbody>
                        <tr><td><strong>Kz. 81</strong></td><td>Steuerpflichtige Umsätze (19%) – Netto</td><td style="text-align:right">${Utils.formatCurrency(calc.nettoUmsatz19)}</td></tr>
                        <tr><td><strong>Kz. 83</strong></td><td>Umsatzsteuer darauf (19%)</td><td style="text-align:right">${Utils.formatCurrency(calc.ust19)}</td></tr>
                        ${calc.nettoUmsatz7 > 0 ? `
                        <tr><td><strong>Kz. 86</strong></td><td>Steuerpflichtige Umsätze (7%) – Netto</td><td style="text-align:right">${Utils.formatCurrency(calc.nettoUmsatz7)}</td></tr>
                        <tr><td><strong>Kz. 35</strong></td><td>Umsatzsteuer darauf (7%)</td><td style="text-align:right">${Utils.formatCurrency(calc.ust7)}</td></tr>
                        ` : ''}
                        <tr><td><strong>Kz. 66</strong></td><td>Vorsteuerbeträge (§15 UStG)</td><td style="text-align:right;color:var(--success)">−${Utils.formatCurrency(calc.vorsteuer)}</td></tr>
                        <tr class="euer-result">
                            <td></td>
                            <td><strong>${calc.zahllast >= 0 ? '🔴 Zahllast (Verbleibt zu zahlen)' : '🟢 Überschuss (Erstattung)'}</strong></td>
                            <td style="text-align:right;font-size:1.1rem;color:${calc.zahllast >= 0 ? 'var(--danger)' : 'var(--success)'}">
                                <strong>${Utils.formatCurrency(Math.abs(calc.zahllast))}</strong>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style="padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                ${!gesperrt ? `<button class="btn btn-primary" onclick="UstVoranmeldung._markEingereicht()">✅ Als eingereicht markieren</button>` : ''}
                ${gesperrt ? `<div style="color:var(--text-muted);font-size:12px;">Eingereicht am ${Utils.formatDate(gesperrt.eingereichtAm)}</div>` : ''}
                <div style="font-size:12px;color:var(--text-muted);">Abgabefrist: 10. des Folgemonats nach Quartalsende</div>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><div class="card-title">Jahresübersicht ${year}</div></div>
            <div class="table-container" style="border:none;">
                <table class="data-table">
                    <thead><tr><th>Quartal</th><th style="text-align:right">Netto-Umsatz</th><th style="text-align:right">USt</th><th style="text-align:right">Vorsteuer</th><th style="text-align:right">Zahllast</th><th>Status</th></tr></thead>
                    <tbody>
                        ${jahresUebersicht.map(({ qi, c, gesperrt: g }) => `
                        <tr style="cursor:pointer;" onclick="UstVoranmeldung._selectQuartal(${qi})">
                            <td><strong>Q${qi + 1}/${year}</strong><br><span style="font-size:11px;color:var(--text-muted)">${this._qStart(year,qi).slice(0,7)} – ${this._qEnd(year,qi).slice(0,7)}</span></td>
                            <td style="text-align:right">${Utils.formatCurrency(c.nettoUmsatz19)}</td>
                            <td style="text-align:right">${Utils.formatCurrency(c.ust19)}</td>
                            <td style="text-align:right;color:var(--success)">−${Utils.formatCurrency(c.vorsteuer)}</td>
                            <td style="text-align:right;color:${c.zahllast >= 0 ? 'var(--danger)' : 'var(--success)'};font-weight:600">${Utils.formatCurrency(c.zahllast)}</td>
                            <td>${g ? '<span class="badge badge-success">✅</span>' : '<span class="badge badge-warning">Offen</span>'}</td>
                        </tr>`).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight:600;background:var(--bg-secondary);">
                            <td>Jahressumme</td>
                            <td style="text-align:right">${Utils.formatCurrency(jahresUebersicht.reduce((s,r)=>s+r.c.nettoUmsatz19,0))}</td>
                            <td style="text-align:right">${Utils.formatCurrency(jahresUebersicht.reduce((s,r)=>s+r.c.ust19,0))}</td>
                            <td style="text-align:right;color:var(--success)">−${Utils.formatCurrency(jahresUebersicht.reduce((s,r)=>s+r.c.vorsteuer,0))}</td>
                            <td style="text-align:right;color:${jahresZahllast >= 0 ? 'var(--danger)' : 'var(--success)'}">${Utils.formatCurrency(jahresZahllast)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        <div class="card" style="margin-top:16px;">
            <div style="padding:12px 16px;font-size:13px;color:var(--text-muted);line-height:1.7;">
                <strong>Kz. 81:</strong> Netto-Umsätze aus Lieferungen und Leistungen zum Regelsteuersatz 19%.<br>
                <strong>Kz. 83:</strong> Steuerbetrag (19%) auf die Umsätze aus Kz. 81.<br>
                <strong>Kz. 86:</strong> Netto-Umsätze zum ermäßigten Steuersatz 7% (z.B. Bücher, Lebensmittel).<br>
                <strong>Kz. 35:</strong> Steuerbetrag (7%) auf die Umsätze aus Kz. 86.<br>
                <strong>Kz. 66:</strong> Abzugsfähige Vorsteuer aus Eingangsrechnungen (§15 UStG).<br>
                <strong>Abgabefrist:</strong> 10. des auf den Voranmeldungszeitraum folgenden Monats (§18 Abs. 1 UStG).<br>
                <strong>Dauerfreigabe:</strong> Auf Antrag kann eine Dauerfristverlängerung von 1 Monat gewährt werden.<br>
                <strong>⚠️ Unverbindlich</strong> – Abgabe über ELSTER (elster.de) oder Steuerberater erforderlich.
            </div>
        </div>
        `;
    },

    init() {
        const ySel = document.getElementById('uvYear');
        const qSel = document.getElementById('uvQuartal');
        if (ySel) ySel.addEventListener('change', () => { this._year = parseInt(ySel.value); this._refresh(); });
        if (qSel) qSel.addEventListener('change', () => { this._quartal = parseInt(qSel.value); this._refresh(); });
    },

    _refresh() {
        const el = document.getElementById('content');
        if (el) { el.innerHTML = this.render(); this.init(); }
    },

    _selectQuartal(qi) {
        this._quartal = qi;
        this._refresh();
    },

    _markEingereicht() {
        Store.saveUstPeriode({
            year: this._year,
            quartal: this._quartal,
            monat: null,
            eingereichtAm: Utils.todayISO()
        });
        Utils.showToast(`Q${this._quartal + 1}/${this._year} als eingereicht markiert`, 'success');
        this._refresh();
    },

    _exportCSV() {
        const year  = this._year;
        const q     = this._quartal;
        const start = this._qStart(year, q);
        const end   = this._qEnd(year, q);
        const c     = this._calcPeriode(start, end);
        const rows  = [
            ['USt-Voranmeldung ELSTER Export', '', ''],
            [`Zeitraum: Q${q+1}/${year}`, start + ' bis ' + end, ''],
            ['', '', ''],
            ['Kennzahl', 'Bezeichnung', 'Betrag EUR'],
            ['Kz. 81', 'Steuerpflichtige Umsätze 19% (Netto)', c.nettoUmsatz19.toFixed(2)],
            ['Kz. 83', 'Umsatzsteuer 19%', c.ust19.toFixed(2)],
            ...(c.nettoUmsatz7 > 0 ? [
                ['Kz. 86', 'Steuerpflichtige Umsätze 7% (Netto)', c.nettoUmsatz7.toFixed(2)],
                ['Kz. 35', 'Umsatzsteuer 7%', c.ust7.toFixed(2)],
            ] : []),
            ['Kz. 66', 'Vorsteuer', c.vorsteuer.toFixed(2)],
            ['', 'Verbleibende Zahllast', c.zahllast.toFixed(2)],
        ];
        Utils.downloadCSV(rows, `uvr_Q${q+1}_${year}.csv`);
        Utils.showToast('ELSTER CSV exportiert', 'success');
    }
};
