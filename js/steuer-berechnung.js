// ============================================
// Steuer-Berechnung — geteilte USt-Netting-Logik
// Single Source of Truth für die Brutto→Netto-Umrechnung, die euer.js (EÜR) und
// bilanz.js (GuV) vorher parallel und identisch implementiert hatten. Nimmt bereits
// gefilterte Datensätze entgegen — welche Sales/Purchases/Retouren in eine Periode
// gehören (und ob z.B. ein Storno sie ausschließt), entscheidet weiterhin jedes
// Modul selbst; hier steckt nur noch die Steuersatz-Arithmetik.
// ============================================
const SteuerBerechnung = {

    // Netto/USt aus einem Brutto-Betrag bei gegebenem Satz. 0% ist ein gültiger,
    // expliziter Satz (steuerfreie Ausgabe / Privatankauf) — fällt NICHT auf den
    // 19%-Fallback zurück. Nur null/''/NaN fallen auf 19% (Altdaten ohne Satz-Feld).
    nettoAusBrutto(brutto, rate) {
        const parsed = (rate != null && rate !== '') ? parseFloat(rate) : NaN;
        const r = isNaN(parsed) ? 19 : parsed;
        const netto = brutto / (1 + r / 100);
        return { netto, ust: brutto - netto, rate: r };
    },

    // Verkäufe: Brutto = Verkaufspreis + Versand vom Käufer, genettet am Satz je Verkauf (steuersatz).
    nettoSales(sales, isRegel) {
        let brutto = 0, netto = 0;
        sales.forEach(s => {
            const b = (parseFloat(s.verkaufspreis) || 0) + (parseFloat(s.versandkostenKaeufer) || 0);
            brutto += b;
            netto += isRegel ? this.nettoAusBrutto(b, s.steuersatz).netto : b;
        });
        return { brutto, netto, ust: brutto - netto };
    },

    // Retouren: Erstattungsbetrag genettet am Satz des VERKNÜPFTEN Verkaufs (allSalesRaw inkl.
    // stornierter, zum Nachschlagen), Fallback 19% ohne Verknüpfung.
    nettoRetouren(retouren, allSalesRaw, isRegel) {
        let brutto = 0, netto = 0;
        retouren.forEach(r => {
            const b = parseFloat(r.erstattungBetrag) || 0;
            brutto += b;
            if (!isRegel) { netto += b; return; }
            const relSale = r.saleId ? (allSalesRaw || []).find(s => s.id === r.saleId) : null;
            const rate = (relSale && relSale.steuersatz != null && relSale.steuersatz !== '') ? relSale.steuersatz : 19;
            netto += this.nettoAusBrutto(b, rate).netto;
        });
        return { brutto, netto, ust: brutto - netto };
    },

    // Rechnungspositionen sind bereits NETTO gespeichert (MwSt wird in rechnung.js separat
    // draufgerechnet) — hier NICHT nochmal /1.xx teilen. §17 UStG: Gutschrift mindert Umsatz/USt
    // (Vorzeichen -1).
    nettoRechnungen(invoices) {
        let netto = 0, ust = 0;
        (invoices || []).forEach(inv => {
            const sign = inv.typ === 'gutschrift' ? -1 : 1;
            (inv.positionen || []).forEach(p => {
                const posNetto = (p.menge || 0) * (p.einzelpreis || 0);
                netto += sign * posNetto;
                ust += sign * posNetto * (parseFloat(p.mwstSatz) || 0) / 100;
            });
        });
        return { netto, ust };
    },

    // Wareneinkauf/-einsatz: Satz je Einkauf (ustSatz), 0% gültig (Privatankauf ohne Vorsteuer).
    nettoPurchases(purchases) {
        let brutto = 0, netto = 0;
        (purchases || []).forEach(p => {
            const b = (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
            brutto += b;
            netto += this.nettoAusBrutto(b, p.ustSatz).netto;
        });
        return { brutto, netto, ust: brutto - netto };
    },

    // Betriebsausgaben je Kategorie + Gesamt, Satz je Ausgabe (ustSatz/steuersatz), 0% gültig.
    nettoExpenses(expenses) {
        const byKategorie = {};
        let brutto = 0, netto = 0;
        (expenses || []).forEach(e => {
            const kat = e.kategorie || 'Sonstiges';
            const b = parseFloat(e.betrag) || 0;
            const rawRate = (e.ustSatz != null && e.ustSatz !== '') ? e.ustSatz : e.steuersatz;
            const n = (rawRate != null && rawRate !== '' && parseFloat(rawRate) === 0) ? b : this.nettoAusBrutto(b, rawRate).netto;
            byKategorie[kat] = (byKategorie[kat] || 0) + n;
            brutto += b;
            netto += n;
        });
        return { brutto, netto, ust: brutto - netto, byKategorie };
    },
};

if (typeof window !== 'undefined') window.SteuerBerechnung = SteuerBerechnung;
