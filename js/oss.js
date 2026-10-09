// ============================================
// OSS – One-Stop-Shop (EU-Fernverkauf an Privatkunden)
// §3c UStG – Bestimmungslandprinzip ab 10.000 € Jahresschwelle (EU-weit)
// ============================================
const OSS = {
    _year: new Date().getFullYear(),

    // §3c Abs. 4 UStG — EU-weite Fernverkaufsschwelle, als Jahresfunktion statt als Konstante
    // (Regel 7 der CLAUDE.md: Gesetzeswerte gehören in eine Jahresfunktion, auch wenn heute nur
    // ein Wert existiert). Hier ist das keine Formsache: die Prüfung stellt Vorjahr und
    // laufendes Jahr nebeneinander, und beide müssen gegen die IHREM Jahr zustehende Schwelle
    // gemessen werden. Mit einer festen Zahl wäre diese Unterscheidung gar nicht formulierbar.
    //
    // 10.000 € gelten EU-weit seit dem 01.07.2021 (Digitalpaket). Davor galten länderspezifische
    // Lieferschwellen (35.000/100.000 € je Zielland), die Stackr nicht abbildet — für frühere
    // Jahre steht deshalb derselbe Wert, was für ein Werkzeug ab 2021 unschädlich ist.
    _getSchwelle(year) {
        return 10000;
    },

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

    // B2C-Rechnungen (+ Gutschriften, gegenrechnend) an EU-Privatkunden eines Jahres (Ausland,
    // EU-Mitglied, keine USt-IdNr. → kein Reverse Charge B2B). Gutschriften muessen mitzaehlen,
    // sonst sinkt der kumulierte OSS-Umsatz nicht, wenn ein EU-Fernverkauf storniert wird
    // (Inkonsistenz zur UVA-Logik in ustvoranmeldung.js, die Gutschriften bereits gegenrechnet).
    _getB2CInvoices(year) {
        if (typeof Store.getRechInvoices !== 'function') return [];
        const euLaender = this._euLaender();
        const customers = Store.getRechCustomers ? Store.getRechCustomers() : [];
        return Store.getRechInvoices()
            .filter(i => (i.typ === 'rechnung' || i.typ === 'gutschrift') && (i.status === 'versendet' || i.status === 'bezahlt') && (i.datum || '').startsWith(String(year)))
            .map(i => ({ inv: i, kunde: customers.find(c => c.id === i.kundeId) }))
            .filter(x => x.kunde && x.kunde.land && x.kunde.land !== 'DE' && euLaender.indexOf(x.kunde.land) !== -1 && !x.kunde.ustIdNr);
    },

    _netto(inv) {
        // menge wie auf der Rechnung selbst: leer/0 = 0 (kein ||1-Phantomumsatz)
        //
        // Beim Einzelpreis stand bis zum 2026-09-15 `parseFloat(p.einzelpreis || 0)` — das `|| 0`
        // INNERHALB der Klammer. Es fängt nur leer/null/undefined ab; ein nicht-numerischer Wert
        // ("k.A.", ein Importrest) kommt als NaN heraus und steckt die ganze Summe an. Und ein
        // NaN-Jahresumsatz ist im Schwellenvergleich immer false: die OSS-Schwelle gälte als nie
        // gerissen, der Nutzer bliebe ungewarnt und versteuerte weiter mit deutscher USt, obwohl
        // §3c Abs. 4 UStG das Bestimmungsland verlangt. Ein stiller Fehler, der zur
        // Steuerpflichtverletzung führt. Bei `menge` daneben stand die Klammer immer richtig.
        const sign = inv.typ === 'gutschrift' ? -1 : 1;
        return sign * (inv.positionen || []).reduce((s, p) => s + (parseFloat(p.menge) || 0) * (parseFloat(p.einzelpreis) || 0), 0);
    },

    // Marktplatz-Verkäufe ohne Rechnung an Käufer im EU-Ausland (sale.land, beim Verkauf
    // erfasst). Auf Vinted & Co. sind das Privatkäufer, also B2C-Fernverkäufe nach §3c UStG.
    // Verkäufe aus Rechnungen (_invoiceId) zählen schon über _getB2CInvoices — nicht doppelt.
    // §25a-Verkäufe fallen heraus: "Die Anwendung des § 3c ... [ist] bei der
    // Differenzbesteuerung ausgeschlossen" (§25a Abs. 7 Nr. 3 UStG) — sie bleiben immer
    // deutsch versteuert und zählen auch nicht zur Schwelle.
    // Annahme: Retouren mindern die Schwellensumme nicht (warnt im Zweifel früher).
    _getB2CSales(year) {
        if (typeof Store.getSales !== 'function') return [];
        const euLaender = this._euLaender();
        const diff25a = {};
        (typeof Store.getPurchases === 'function' ? Store.getPurchases(true) : [])
            .forEach(p => { if (p.differenzbesteuert) diff25a[p.id] = true; });
        return Store.getSales().filter(s => {
            if (s._invoiceId || !(s.datum || '').startsWith(String(year))) return false;
            if (!s.land || s.land === 'DE' || euLaender.indexOf(s.land) === -1) return false;
            const ids = (s.purchaseIds && s.purchaseIds.length) ? s.purchaseIds : (s.purchaseId ? [s.purchaseId] : []);
            return !ids.some(id => diff25a[id]);
        });
    },

    _euLaender() {
        return (typeof Vorsteuer !== 'undefined') ? Vorsteuer.EU_LAENDER : Object.keys(this.EU_VAT_RATES);
    },

    // Verkaufspreise auf Marktplätzen sind Bruttopreise. Bis zur Schwelle steckt die deutsche
    // USt darin (Satz des Verkaufs, Default 19 % wie in der UStVA), danach die des Ziellandes —
    // der Kunde zahlt denselben Preis, nur der Steueranteil darin wechselt. Kleinunternehmer
    // weisen keine USt aus: dort ist der Preis das Entgelt.
    // Annahme: ermäßigte Ziellandsätze sind nicht abgebildet (Hinweis auf der OSS-Seite).
    _saleBrutto(s) {
        return (parseFloat(s.verkaufspreis) || 0) + (parseFloat(s.versandkostenKaeufer) || 0);
    },
    _saleNettoDE(s) {
        if (!this._isRegel()) return this._saleBrutto(s);
        const satz = parseFloat(s.steuersatz);
        return this._saleBrutto(s) / (1 + (isNaN(satz) ? 19 : satz) / 100);
    },
    _saleNettoZielland(s) {
        const rate = this.EU_VAT_RATES[s.land];
        return rate === undefined ? this._saleNettoDE(s) : this._saleBrutto(s) / (1 + rate / 100);
    },

    // Alle B2C-Fernverkäufe eines Jahres in einer Liste: Rechnungen und Marktplatz-Verkäufe.
    // netto = Entgelt bei deutschem Leistungsort (Schwellensumme), nettoOSS = Entgelt, wenn der
    // Umsatz im Zielland zu versteuern ist (bei Rechnungen identisch: dort sind Positionen netto).
    _umsaetze(year) {
        const inv = this._getB2CInvoices(year).map(({ inv, kunde }) => {
            const n = this._netto(inv);
            return { id: inv.id, datum: inv.datum || '', land: kunde.land, netto: n, nettoOSS: n };
        });
        const sales = this._getB2CSales(year).map(s => ({
            id: s.id, datum: s.datum || '', land: s.land, netto: this._saleNettoDE(s), nettoOSS: this._saleNettoZielland(s)
        }));
        return inv.concat(sales);
    },

    _calcLaender(year) {
        const byLand = {};
        this._umsaetze(year).forEach(u => {
            byLand[u.land] = (byLand[u.land] || 0) + u.netto;
        });
        return byLand;
    },

    // Nur der Teil, der tatsächlich dem Bestimmungslandprinzip unterliegt — dieselbe Auswahl,
    // die js/ustvoranmeldung.js benutzt. Bis 2026-09-18 legten Ländertabelle und CSV-Export den
    // Ziellandsatz auf den VOLLEN Jahresumsatz: im Überschreitungsjahr standen damit Rechnungen
    // aus der Zeit vor der Schwelle, die deutsch versteuert und schon in der UStVA erklärt sind,
    // ein zweites Mal im "OSS-Meldung Referenzdaten"-Export (plan/funde-oss-2026-09-15.md).
    _calcLaenderOSS(year) {
        const ids = this._ueberSchwelleIds(year);
        const byLand = {};
        this._umsaetze(year).forEach(u => {
            if (!ids.has(u.id)) return;
            byLand[u.land] = (byLand[u.land] || 0) + u.nettoOSS;
        });
        return byLand;
    },

    _jahresumsatz(year) {
        return this._umsaetze(year).reduce((s, u) => s + u.netto, 0);
    },

    // IDs (Rechnungen UND Marktplatz-Verkäufe), die dem Bestimmungslandprinzip unterliegen
    // (OSS-pflichtig statt dt. USt) — js/ustvoranmeldung.js nimmt sie aus der UStVA heraus.
    // §3c Abs. 4 S. 1 UStG wirkt PROSPEKTIV ab dem Umsatz, der die 10.000€-Schwelle reißt — nicht
    // rückwirkend auf bereits getätigte Umsätze desselben Jahres. Nur die Vorjahresschwelle (S. 2)
    // wirkt rückwirkend ab dem 1. Umsatz. Darum hier chronologische Laufsumme statt Jahres-Flag.
    // ponytail: Tie-Break bei gleichem Rechnungsdatum = Einfügereihenfolge, in der Praxis irrelevant.
    _ueberSchwelleIds(year) {
        // §3c Abs. 4 UStG: "nicht überschritten"/"nicht übersteigt" -> bei exakt 10.000,00 €
        // greift die Ausnahme (Ursprungslandprinzip) noch. Erst der Umsatz, der die Schwelle
        // tatsächlich UEBERsteigt, loest das Bestimmungslandprinzip aus -> strikt '>'.
        if (this._jahresumsatz(year - 1) > this._getSchwelle(year - 1)) {
            return new Set(this._umsaetze(year).map(u => u.id));
        }
        const sorted = this._umsaetze(year).sort((a, b) => a.datum.localeCompare(b.datum));
        let kumuliert = 0, ueberschritten = false;
        const ids = new Set();
        sorted.forEach(u => {
            if (ueberschritten) { ids.add(u.id); return; }
            kumuliert += u.netto;
            if (kumuliert > this._getSchwelle(year)) { ueberschritten = true; ids.add(u.id); }
        });
        return ids;
    },

    // Schwelle im laufenden Jahr oder Vorjahr überschritten? (§3c Abs. 4 S. 1+2, strikt '>')
    _schwelleUeberschritten(year) {
        return this._jahresumsatz(year) > this._getSchwelle(year) || this._jahresumsatz(year - 1) > this._getSchwelle(year - 1);
    },

    // Marktplatz-Verkäufe des Jahres ohne Land: sie zählen als Inland, könnten aber EU-Verkäufe
    // sein und dann zur Schwelle gehören. Nicht still übergehen, sondern zum Nachtragen zeigen.
    _ohneLand(year) {
        if (typeof Store.getSales !== 'function') return 0;
        return Store.getSales().filter(s => !s._invoiceId && !s.land && (s.datum || '').startsWith(String(year))).length;
    },

    _ohneLandHinweis(year) {
        const n = this._ohneLand(year);
        return n ? `<div class="card" style="padding:12px 16px;margin-bottom:16px;border-color:var(--warning);font-size:13px;">
            <strong>${n} Verkäufe in ${year} ohne Land des Käufers.</strong> Sie zählen hier als Inlandsverkäufe.
            Gingen welche ins EU-Ausland, gehören sie zur 10.000-€-Schwelle — Land über „Verkauf bearbeiten" nachtragen.
        </div>` : '';
    },

    // Einmal-Hinweis pro Jahr und Firma nach dem Speichern eines Verkaufs (Aufruf aus
    // App._checkUstThreshold). Regelbesteuerer: Zielland-USt + OSS-Anmeldung. Kleinunternehmer:
    // §19 befreit nur Umsätze mit deutschem Leistungsort — über der Schwelle liegt der Ort im
    // Zielland, dort greift die deutsche Befreiung nicht.
    checkSchwelle() {
        const year = new Date().getFullYear();
        const key = 'oss_schwelle_warned_' + year;
        if (Store.get(key) || !this._schwelleUeberschritten(year)) return;
        Store.set(key, '1');
        Utils.showToast(this._isRegel()
            ? 'EU-Fernverkäufe über 10.000 €: ab jetzt USt des Ziellandes (OSS). Details unter Steuer → OSS.'
            : 'EU-Fernverkäufe über 10.000 €: Die Kleinunternehmer-Befreiung gilt dafür nicht mehr. Bitte mit Steuerberater klären — Details unter Steuer → OSS.', 'warning');
    },

    render() {
        if (!this._isRegel()) {
            const y = this._year;
            const umsatzKU = this._jahresumsatz(y);
            const kuWarnung = this._schwelleUeberschritten(y) ? `
            <div class="card danger" style="padding:16px 20px;margin-bottom:16px;font-size:13px;line-height:1.6;">
                <strong>EU-Fernverkäufe ${y}: ${Utils.formatCurrency(umsatzKU)} — Schwelle von ${Utils.formatCurrency(this._getSchwelle(y))} überschritten${umsatzKU <= this._getSchwelle(y) ? ' (im Vorjahr)' : ''}.</strong><br>
                Ab dem Verkauf, der die Schwelle überschreitet, liegt der Ort der Lieferung im Land des Käufers (§3c UStG).
                Die Kleinunternehmer-Befreiung (§19 UStG) gilt nur für Umsätze in Deutschland — für diese Verkäufe fällt die
                Umsatzsteuer des Ziellandes an (Meldung über das OSS-Verfahren beim BZSt), außer du nimmst am
                EU-Kleinunternehmerverfahren teil (§19a UStG). <strong>Bitte mit Steuerberater klären.</strong>
                Verkäufe mit Differenzbesteuerung (§25a) zählen nicht mit.
            </div>` : (umsatzKU > 0 ? `<div class="card" style="padding:12px 16px;margin-bottom:16px;font-size:13px;">EU-Fernverkäufe ${y}: ${Utils.formatCurrency(umsatzKU)} von ${Utils.formatCurrency(this._getSchwelle(y))} (§3c UStG) — unter der Schwelle, die Kleinunternehmer-Befreiung gilt.</div>` : '');
            return `
            <div class="page-header"><h2>OSS (EU-Fernverkauf)</h2></div>
            ${kuWarnung}
            ${this._ohneLandHinweis(y)}
            <div class="card">
                <div style="padding:32px;text-align:center;">
                    <div style="font-size:48px;margin-bottom:16px;">📋</div>
                    <h3>Nur für Regelbesteuerer</h3>
                    <p style="color:var(--text-muted);margin:8px 0 20px;">Als Kleinunternehmer (§19 UStG) weist du generell keine USt aus – das OSS-Verfahren betrifft nur Regelbesteuerer.</p>
                    <button class="btn btn-primary" data-action="navigate" data-args=\'["euer"]\'>Zur EÜR → USt-Modus ändern</button>
                </div>
            </div>`;
        }

        const year = this._year;
        const umsatz = this._jahresumsatz(year);
        // §3c Abs. 4 UStG: Schwelle muss im Vorjahr UND im laufenden Jahr unterschritten sein —
        // nach einem Überschreitungsjahr gilt das Bestimmungslandprinzip ab dem ersten Euro
        const vorjahrUmsatz = this._jahresumsatz(year - 1);
        // strikt '>' -> siehe Begruendung bei _ueberSchwelleIds()
        const ueberSchwelle = umsatz > this._getSchwelle(year) || vorjahrUmsatz > this._getSchwelle(year - 1);
        const nurWegenVorjahr = ueberSchwelle && umsatz <= this._getSchwelle(year);
        const byLand = this._calcLaender(year);
        const byLandOSS = this._calcLaenderOSS(year);
        const laender = Object.keys(byLand).sort();

        const yearOptions = Array.from({ length: 8 }, (_, i) => 2020 + i)
            .map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');

        return `
        <div class="page-header">
            <h2>OSS (EU-Fernverkauf)</h2>
            <div class="page-header-actions no-print">
                <select class="form-select" id="ossYear" style="width:90px;">${yearOptions}</select>
                <button class="btn" data-action="oss-export">CSV Export</button>
            </div>
        </div>

        ${this._ohneLandHinweis(year)}

        <div class="card ${ueberSchwelle ? 'danger' : ''}" style="padding:20px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                <div>
                    <div class="card-label">EU-Fernverkauf-Umsatz ${year} (netto, B2C, alle EU-Länder außer DE)</div>
                    <div class="card-value" style="font-size:1.6rem;">${Utils.formatCurrency(umsatz)}</div>
                    <div class="card-subtitle">Schwelle: ${Utils.formatCurrency(this._getSchwelle(year))} / Jahr (§3c UStG, EU-weit kumuliert)</div>
                </div>
                <div style="text-align:right;">
                    ${ueberSchwelle
                        ? `<span class="badge badge-danger">Schwelle überschritten${nurWegenVorjahr ? ' (Vorjahr)' : ''}</span><div style="font-size:12px;color:var(--text-muted);margin-top:6px;max-width:280px;">${nurWegenVorjahr ? `Das Vorjahr lag mit ${Utils.formatCurrency(vorjahrUmsatz)} über der Schwelle — das Bestimmungslandprinzip gilt daher schon ab dem ersten Euro dieses Jahres (§3c Abs. 4 UStG). ` : 'USt ist ab Überschreiten im jeweiligen Bestimmungsland fällig. '}Melde dich beim <a href="https://www.bzst.de" target="_blank" rel="noopener">BZSt</a> für das OSS-Verfahren an.</div>`
                        : '<span class="badge badge-success">Unter Schwelle</span><div style="font-size:12px;color:var(--text-muted);margin-top:6px;max-width:280px;">Bis hierhin gilt das Ursprungslandprinzip — normale deutsche USt auf diesen Umsätzen ist korrekt (Vorjahr ebenfalls unter der Schwelle).</div>'}
                </div>
            </div>
            <div style="margin-top:14px;height:8px;background:var(--bg-secondary);border-radius:4px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(100, (umsatz / this._getSchwelle(year)) * 100)}%;background:${ueberSchwelle ? 'var(--danger)' : 'var(--accent)'};"></div>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><div class="card-title">Aufteilung nach Bestimmungsland ${year}</div></div>
            <div class="table-container" style="border:none;">
                <table class="data-table">
                    <thead><tr><th>Land</th><th style="text-align:right">Nettoumsatz gesamt</th><th style="text-align:right">davon OSS-pflichtig</th><th style="text-align:right">Regelsteuersatz (Referenz, Stand ${Utils.formatDate(this.RATES_STAND)})</th><th style="text-align:right">USt-Betrag (geschätzt, nur OSS-pflichtiger Teil)</th></tr></thead>
                    <tbody>
                        ${laender.length === 0 ? `<tr><td colspan="5" class="table-empty">Keine EU-Fernverkäufe an Privatkunden in ${year}</td></tr>` : ''}
                        ${laender.map(land => {
                            const netto = byLand[land];
                            const nettoOSS = byLandOSS[land] || 0;
                            const known = Object.prototype.hasOwnProperty.call(this.EU_VAT_RATES, land);
                            const rate = known ? this.EU_VAT_RATES[land] : 0;
                            // Ziellandsatz nur auf den Teil ab dem Überschreiten — davor gilt deutsche USt.
                            const ust = nettoOSS * rate / 100;
                            const rateCell = known ? `${rate}%` : '<span style="color:var(--danger)">unbekannt</span>';
                            const ustCell  = known ? Utils.formatCurrency(ust) : '<span style="color:var(--danger)">manuell prüfen</span>';
                            return `<tr><td>${land}</td><td style="text-align:right">${Utils.formatCurrency(netto)}</td><td style="text-align:right">${Utils.formatCurrency(nettoOSS)}</td><td style="text-align:right">${rateCell}</td><td style="text-align:right">${ustCell}</td></tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="card" style="margin-top:16px;">
            <div style="padding:12px 16px;font-size:13px;color:var(--text-muted);line-height:1.7;">
                <strong>Wer ist betroffen:</strong> Verkäufe von Waren/digitalen Leistungen an <strong>Privatpersonen</strong> in anderen EU-Ländern — Rechnungen (Kundenland ≠ DE, EU-Mitglied, keine USt-IdNr.) und Marktplatz-Verkäufe mit erfasstem Land des Käufers. Differenzbesteuerte Verkäufe (§25a) zählen nicht (§25a Abs. 7 Nr. 3 UStG).<br>
                <strong>Marktplatz-Verkäufe:</strong> Der Verkaufspreis gilt als Bruttopreis; über der Schwelle wird der Ziellandsatz aus ihm herausgerechnet. Retouren solcher Verkäufe stehen nicht in der UStVA — als Korrektur in der OSS-Meldung angeben.<br>
                <strong>Unter 10.000 €/Jahr</strong> (EU-weit kumuliert, nicht pro Land): weiterhin deutsche USt zulässig (Ursprungslandprinzip).<br>
                <strong>Ab 10.000 €/Jahr:</strong> USt des Ziellandes fällig, Meldung quartalsweise über das <a href="https://www.bzst.de" target="_blank" rel="noopener">BZSt-Portal (One-Stop-Shop)</a> statt Einzelregistrierung in jedem Land.<br>
                <strong>Regelsteuersätze</strong> sind Referenzwerte (Stand ${Utils.formatDate(this.RATES_STAND)}) – bei ermäßigt besteuerten Waren/Leistungen im Zielland weichen sie ab, und EU-Länder ändern Sätze gelegentlich. Bei Zweifel offizielle Quelle (z.B. <a href="https://ec.europa.eu/taxation_customs/tedb/" target="_blank" rel="noopener">EU-Steuersatzdatenbank</a>) prüfen.<br>
                <strong>Unverbindlich</strong> – ersetzt keine Steuerberatung. Die eigentliche Meldung erfolgt manuell im BZSt-Portal, ein Direktversand ist hier nicht implementiert.
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
        // Gemeldet wird nur der OSS-pflichtige Teil (ab dem Überschreiten der Schwelle bzw. bei
        // Vorjahresüberschreitung ab dem ersten Euro) — genau wie in der UStVA. Der Gesamtumsatz
        // steht zur Einordnung daneben, fließt aber nicht in die USt-Spalte.
        const byLandOSS = this._calcLaenderOSS(year);
        const laender = Object.keys(byLand).sort();
        const rows = [
            ['OSS-Meldung Referenzdaten', '', '', '', ''],
            [`Jahr: ${year}`, '', '', '', ''],
            [`Steuersätze Stand: ${Utils.formatDate(this.RATES_STAND)} — vor Meldung gegenprüfen`, '', '', '', ''],
            ['Gemeldet wird nur die Spalte "davon OSS-pflichtig"; der Rest ist deutsch versteuert (UStVA).', '', '', '', ''],
            ['', '', '', '', ''],
            ['Land', 'Nettoumsatz gesamt EUR', 'davon OSS-pflichtig EUR', 'Regelsteuersatz % (Referenz)', 'USt EUR (geschätzt, OSS-pflichtiger Teil)'],
            ...laender.map(land => {
                const netto = byLand[land];
                const nettoOSS = byLandOSS[land] || 0;
                const known = Object.prototype.hasOwnProperty.call(this.EU_VAT_RATES, land);
                const rate = known ? this.EU_VAT_RATES[land] : 0;
                return [land, netto.toFixed(2), nettoOSS.toFixed(2), known ? rate : 'unbekannt — manuell prüfen',
                        known ? (nettoOSS * rate / 100).toFixed(2) : ''];
            }),
        ];
        Utils.downloadCSV(rows, `oss_${year}.csv`);
        Utils.showToast('OSS-Referenzdaten exportiert', 'success');
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'oss-export': function () { OSS._exportCSV(); }
});
