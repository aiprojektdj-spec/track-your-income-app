// ============================================
// RechnungSummen — EIN Rechenweg für Positionen, Steuer und Gesamtbetrag einer Rechnung
//
// Bis zum Audit 2026-10-13 (L5) rechneten XRechnung, PDF/Vorschau, Verkauf aus Rechnung,
// Dokumentenliste, Mahnungen, Kunden und Bankabgleich je mit eigener Formel. Zehn Positionen
// à 0,03 € netto mit 19 % ergaben im XML 0,40 € (Steuer je Zeile gerundet: 10 × 0,01), im PDF
// und in der Buchung 0,36 €. Empfänger von XML und PDF bekamen verschiedene Forderungen.
//
// Regel (EN 16931, wie sie die XRechnung-Validierung prüft):
//  - Zeilennettobetrag = Menge × Einzelpreis, auf Cent gerundet (BR-CO-10/BT-131).
//  - Bemessungsgrundlage je Steuersatz = Summe der gerundeten Zeilenbeträge (BR-S-8).
//  - Steuer je Satz = Bemessungsgrundlage × Satz, EINMAL auf Cent gerundet (BR-CO-17).
//  - Gesamt = Summe Netto + Summe Steuer.
//  Gerundet wird kaufmännisch, betragssymmetrisch (−0,005 → −0,01), damit eine Stornorechnung
//  mit negativen Positionen genau das Spiegelbild ergibt.
//
// Kleinunternehmer und §25a-Positionen tragen keinen offenen Steuerausweis (Satz 0).
// Leere Menge zählt als 0 — wie im Store und in der UVA (kein Phantomumsatz).
// ============================================
const RechnungSummen = {
    r2(v) {
        const n = Number(v) || 0;
        const s = n < 0 ? -1 : 1;
        return s * Math.round(Math.abs(n) * 100 + 1e-7) / 100;
    },

    satzFuer(pos, isKlein) {
        if (isKlein || (pos && pos.differenzbesteuert)) return 0;
        const r = parseFloat(pos && pos.mwstSatz);
        return isNaN(r) ? 0 : r;
    },

    berechne(positionen, isKlein) {
        const zeilen = (positionen || []).map(pos => {
            const menge = parseFloat(pos && pos.menge) || 0;
            const preis = parseFloat(pos && pos.einzelpreis) || 0;
            return { netto: this.r2(menge * preis), satz: this.satzFuer(pos, isKlein) };
        });
        const gruppen = {};
        zeilen.forEach(z => {
            const g = gruppen[z.satz] || (gruppen[z.satz] = { satz: z.satz, basis: 0, steuer: 0 });
            g.basis = this.r2(g.basis + z.netto);
        });
        let netto = 0, steuer = 0;
        const bruttoJeSatz = {};
        Object.keys(gruppen).forEach(k => {
            const g = gruppen[k];
            g.steuer = g.satz > 0 ? this.r2(g.basis * g.satz / 100) : 0;
            netto = this.r2(netto + g.basis);
            steuer = this.r2(steuer + g.steuer);
            bruttoJeSatz[g.satz] = this.r2(g.basis + g.steuer);
        });
        return { zeilen, gruppen, netto, steuer, brutto: this.r2(netto + steuer), bruttoJeSatz };
    },

    // Für eine gespeicherte Rechnung: isKlein am Dokument, sonst der Modus zum Rechnungsdatum.
    fuerRechnung(inv, settings) {
        let isKlein = inv && inv.isKlein;
        if (isKlein === undefined) {
            isKlein = (typeof SteuerStatus !== 'undefined' && settings)
                ? SteuerStatus.modeAm(inv.lieferdatum || inv.datum, settings) === 'klein'
                : !!(settings && settings.ustMode === 'klein');
        }
        return this.berechne(inv ? inv.positionen : [], !!isKlein);
    }
};

if (typeof window !== 'undefined') window.RechnungSummen = RechnungSummen;
if (typeof module !== 'undefined' && module.exports) module.exports = RechnungSummen;
