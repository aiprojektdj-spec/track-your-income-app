// ============================================
// OSS – One-Stop-Shop (EU-Fernverkauf an Privatkunden)
// §3c UStG – Bestimmungslandprinzip ab 10.000 € Jahresschwelle (EU-weit)
// ============================================
const OSS = {
    _year: new Date().getFullYear(),

    SCHWELLE: 10000,

    // Referenz-Regelsätze – bei ermäßigt besteuerten Waren/Leistungen im Zielland manuell prüfen
    RATES_STAND: '2026-01-01',
    EU_VAT_RATES: {
        AT: 20, BE: 21, BG: 20, HR: 25, CY: 19, CZ: 21, DK: 25, EE: 22, FI: 25.5, FR: 20, GR: 24,
        HU: 27, IE: 23, IT: 22, LV: 21, LT: 21, LU: 17, MT: 18, NL: 21, PL: 23, PT: 23, RO: 19,
        SK: 23, SI: 22, ES: 21, SE: 25
    },

    _isRegel() {
        return (Store.getSettings().ustMode || 'klein') === 'regel';
    },

    // B2C-Rechnungen an EU-Privatkunden eines Jahres (Ausland, EU-Mitglied, keine USt-IdNr. → kein Reverse Charge B2B)
    _getB2CInvoices(year) {
        if (typeof Store.getRechInvoices !== 'function') return [];
        const euLaender = (typeof Vorsteuer !== 'undefined') ? Vorsteuer.EU_LAENDER : Object.keys(this.EU_VAT_RATES);
        const customers = Store.getRechCustomers ? Store.getRechCustomers() : [];
        return Store.getRechInvoices()
            .filter(i => i.typ === 'rechnung' && (i.status === 'versendet' || i.status === 'bezahlt') && (i.datum || '').startsWith(String(year)))
            .map(i => ({ inv: i, kunde: customers.find(c => c.id === i.kundeId) }))
            .filter(x => x.kunde && x.kunde.land && x.kunde.land !== 'DE' && euLaender.indexOf(x.kunde.land) !== -1 && !x.kunde.ustIdNr);
    },

    _netto(inv) {
        return (inv.positionen || []).reduce((s, p) => s + parseFloat(p.menge || 1) * parseFloat(p.einzelpreis || 0), 0);
    },

    _calcLaender(year) {
        const byLand = {};
        this._getB2CInvoices(year).forEach(({ inv, kunde }) => {
            byLand[kunde.land] = (byLand[kunde.land] || 0) + this._netto(inv);
        });
        return byLand;
    },

    _jahresumsatz(year) {
        return this._getB2CInvoices(year).reduce((s, { inv }) => s + this._netto(inv), 0);
    },

    render() {
        if (Store.getSettings().land === 'CH') {
            return `
            <div class="page-header"><h2><i class="ti ti-world" style="margin-right:6px;"></i> OSS (EU-Fernverkauf)</h2></div>
            <div class="card" style="padding:40px;text-align:center;">
                <div style="font-size:48px;margin-bottom:12px;">🇨🇭</div>
                <div style="font-weight:700;font-size:16px;margin-bottom:8px;">Nicht verfügbar im Schweiz-Modus</div>
                <div style="color:var(--text-muted);">Das EU-OSS-Verfahren gilt nur für Unternehmen mit Sitz in der EU.</div>
            </div>`;
        }

        if (!this._isRegel()) {
            return `
            <div class="page-header"><h2>OSS (EU-Fernverkauf)</h2></div>
            <div class="card">
                <div style="padding:32px;text-align:center;">
                    <div style="font-size:48px;margin-bottom:16px;">📋</div>
                    <h3>Nur für Regelbesteuerer</h3>
                    <p style="color:var(--text-muted);margin:8px 0 20px;">Als Kleinunternehmer (§19 UStG) weist du generell keine USt aus – das OSS-Verfahren betrifft nur Regelbesteuerer.</p>
                    <button class="btn btn-primary" onclick="App.navigate('euer')">Zur EÜR → USt-Modus ändern</button>
                </div>
            </div>`;
        }

        const year = this._year;
        const umsatz = this._jahresumsatz(year);
        const ueberSchwelle = umsatz >= this.SCHWELLE;
        const byLand = this._calcLaender(year);
        const laender = Object.keys(byLand).sort();

        const yearOptions = Array.from({ length: 8 }, (_, i) => 2020 + i)
            .map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');

        return `
        <div class="page-header">
            <h2>OSS (EU-Fernverkauf)</h2>
            <div class="page-header-actions no-print">
                <select class="form-select" id="ossYear" style="width:90px;">${yearOptions}</select>
                <button class="btn" onclick="OSS._exportCSV()">CSV Export</button>
            </div>
        </div>

        <div class="card ${ueberSchwelle ? 'danger' : ''}" style="padding:20px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                <div>
                    <div class="card-label">EU-Fernverkauf-Umsatz ${year} (netto, B2C, alle EU-Länder außer DE)</div>
                    <div class="card-value" style="font-size:1.6rem;">${Utils.formatCurrency(umsatz)}</div>
                    <div class="card-subtitle">Schwelle: ${Utils.formatCurrency(this.SCHWELLE)} / Jahr (§3c UStG, EU-weit kumuliert)</div>
                </div>
                <div style="text-align:right;">
                    ${ueberSchwelle
                        ? '<span class="badge badge-danger">⚠️ Schwelle überschritten</span><div style="font-size:12px;color:var(--text-muted);margin-top:6px;max-width:280px;">USt ist ab Überschreiten im jeweiligen Bestimmungsland fällig. Melde dich beim <a href="https://www.bzst.de" target="_blank" rel="noopener">BZSt</a> für das OSS-Verfahren an.</div>'
                        : '<span class="badge badge-success">✅ Unter Schwelle</span><div style="font-size:12px;color:var(--text-muted);margin-top:6px;max-width:280px;">Bis hierhin gilt das Ursprungslandprinzip — normale deutsche USt auf diesen Rechnungen ist korrekt.</div>'}
                </div>
            </div>
            <div style="margin-top:14px;height:8px;background:var(--bg-secondary);border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(100, (umsatz / this.SCHWELLE) * 100)}%;background:${ueberSchwelle ? 'var(--danger)' : 'var(--accent)'};"></div>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><div class="card-title">Aufteilung nach Bestimmungsland ${year}</div></div>
            <div class="table-container" style="border:none;">
                <table class="data-table">
                    <thead><tr><th>Land</th><th style="text-align:right">Nettoumsatz</th><th style="text-align:right">Regelsteuersatz (Referenz, Stand ${Utils.formatDate(this.RATES_STAND)})</th><th style="text-align:right">USt-Betrag (geschätzt)</th></tr></thead>
                    <tbody>
                        ${laender.length === 0 ? `<tr><td colspan="4" class="table-empty">Keine EU-Fernverkäufe an Privatkunden in ${year}</td></tr>` : ''}
                        ${laender.map(land => {
                            const netto = byLand[land];
                            const rate = this.EU_VAT_RATES[land] || 0;
                            const ust = netto * rate / 100;
                            return `<tr><td>${land}</td><td style="text-align:right">${Utils.formatCurrency(netto)}</td><td style="text-align:right">${rate}%</td><td style="text-align:right">${Utils.formatCurrency(ust)}</td></tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="card" style="margin-top:16px;">
            <div style="padding:12px 16px;font-size:13px;color:var(--text-muted);line-height:1.7;">
                <strong>Wer ist betroffen:</strong> Verkäufe von Waren/digitalen Leistungen an <strong>Privatpersonen</strong> in anderen EU-Ländern (erkannt an: Kundenland ≠ DE, EU-Mitglied, keine USt-IdNr. hinterlegt).<br>
                <strong>Unter 10.000 €/Jahr</strong> (EU-weit kumuliert, nicht pro Land): weiterhin deutsche USt zulässig (Ursprungslandprinzip).<br>
                <strong>Ab 10.000 €/Jahr:</strong> USt des Ziellandes fällig, Meldung quartalsweise über das <a href="https://www.bzst.de" target="_blank" rel="noopener">BZSt-Portal (One-Stop-Shop)</a> statt Einzelregistrierung in jedem Land.<br>
                <strong>Regelsteuersätze</strong> sind Referenzwerte (Stand ${Utils.formatDate(this.RATES_STAND)}) – bei ermäßigt besteuerten Waren/Leistungen im Zielland weichen sie ab, und EU-Länder ändern Sätze gelegentlich. Bei Zweifel offizielle Quelle (z.B. <a href="https://ec.europa.eu/taxation_customs/tedb/" target="_blank" rel="noopener">EU-Steuersatzdatenbank</a>) prüfen.<br>
                <strong>⚠️ Unverbindlich</strong> – ersetzt keine Steuerberatung. Die eigentliche Meldung erfolgt manuell im BZSt-Portal, ein Direktversand ist hier nicht implementiert.
            </div>
        </div>
        `;
    },

    init() {
        const ySel = document.getElementById('ossYear');
        if (ySel) ySel.addEventListener('change', () => { this._year = parseInt(ySel.value); this._refresh(); });
    },

    _refresh() {
        const el = document.getElementById('content');
        if (el) { el.innerHTML = this.render(); this.init(); }
    },

    _exportCSV() {
        const year = this._year;
        const byLand = this._calcLaender(year);
        const laender = Object.keys(byLand).sort();
        const rows = [
            ['OSS-Meldung Referenzdaten', '', '', ''],
            [`Jahr: ${year}`, '', '', ''],
            [`Steuersätze Stand: ${Utils.formatDate(this.RATES_STAND)} — vor Meldung gegenprüfen`, '', '', ''],
            ['', '', '', ''],
            ['Land', 'Nettoumsatz EUR', 'Regelsteuersatz % (Referenz)', 'USt EUR (geschätzt)'],
            ...laender.map(land => {
                const netto = byLand[land];
                const rate = this.EU_VAT_RATES[land] || 0;
                return [land, netto.toFixed(2), rate, (netto * rate / 100).toFixed(2)];
            }),
        ];
        Utils.downloadCSV(rows, `oss_${year}.csv`);
        Utils.showToast('OSS-Referenzdaten exportiert', 'success');
    }
};
