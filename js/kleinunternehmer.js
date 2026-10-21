// ============================================
// Kleinunternehmer — §19 UStG-Prüfung für ein Kalenderjahr
//
// Rechtsstand ab 2025 (§19 Abs.1 UStG n.F., BMF-Schreiben vom 18.03.2025):
//  - Vorjahresumsatz über der Vorjahresgrenze (25.000 €) → die Befreiung gilt im ganzen
//    laufenden Jahr nicht.
//  - Laufendes Jahr: die Befreiung entfällt ab dem Umsatz, mit dem die laufende Grenze
//    überschritten wird — dieser Umsatz ist schon steuerpflichtig.
//  - Im Jahr der Aufnahme der Tätigkeit ist die laufende Grenze 25.000 €, nicht 100.000 €
//    (Vorjahresumsatz ist 0) — ohne Hochrechnung auf ein volles Jahr.
//
// Bis zum Audit 2026-10-13 (T05) kannte die Prüfung in js/app.js nur 100.000 € und die
// Folgejahr-Warnung bei 25.000 € und sagte einem Gründer mit 25.001 € "du bleibst dieses Jahr
// Kleinunternehmer". Die Grenzwerte kommen weiter aus App._getUstGrenzen(year) (Jahresfunktion,
// CLAUDE.md Regel 7) und werden hier nur übergeben.
//
// Vor 2025 galt eine Prognoseregel für das laufende Jahr; die bildet diese Prüfung nicht nach
// (Gründer-Sonderfall nur ab 2025).
// ============================================
const Kleinunternehmer = {
    // Gesamtumsatz i. S. d. §19 Abs. 2 UStG n. F.: "nach vereinnahmten Entgelten berechnete Summe"
    // — Entgelt heißt OHNE Umsatzsteuer, und Rückzahlungen mindern das Vereinnahmte. Bis zum
    // Steuer-Audit 2026-10-18 (U06) summierte js/app.js Brutto-Verkaufspreise: ein im Vorjahr
    // regelbesteuertes Unternehmen mit 24.000 € netto (28.560 € brutto) bekam "Vorjahresgrenze
    // überschritten", und eine Erstattung von 1.000 € zählte nicht.
    // Liefert [{datum, betrag}] für die Prüfung unten; Erstattungen als negative Beträge.
    entgelte(year) {
        const y = String(year);
        const settings = Store.getSettings ? Store.getSettings() : {};
        const istRegel = v => typeof SteuerStatus !== 'undefined' && SteuerStatus.istRegel(v, settings);
        const netto = s => {
            const gruppen = Store.salePerRate(s);
            const brutto = gruppen.reduce((a, g) => a + (parseFloat(g.brutto) || 0), 0);
            const n = istRegel(s) ? gruppen.reduce((a, g) => a + (parseFloat(g.brutto) || 0) / (1 + (parseFloat(g.satz) || 0) / 100), 0) : brutto;
            return { brutto, netto: n };
        };
        const alle = Store.getAllSalesRaw ? Store.getAllSalesRaw() : Store.getSales(true);
        const out = [];
        alle.filter(s => !s.storniert && s.datum && String(s.datum).startsWith(y))
            .forEach(s => out.push({ datum: s.datum, betrag: netto(s).netto }));
        // Erstattungen aus Retouren mindern das Vereinnahmte, anteilig netto wie der Verkauf.
        // Altbestand: Retoure hat den Verkauf storniert → der Verkauf zählt schon nicht, kein Doppelabzug.
        (Store.getRetouren ? Store.getRetouren() : []).forEach(r => {
            const b = parseFloat(r.erstattungBetrag) || 0;
            if (!b || !r.datum || !String(r.datum).startsWith(y)) return;
            const sale = alle.find(s => s.id === r.saleId);
            if (sale && sale.storniert) return;
            const n = sale ? netto(sale) : null;
            const faktor = n && n.brutto ? n.netto / n.brutto : 1;
            out.push({ datum: r.datum, betrag: -b * faktor });
        });
        return out;
    },
    summe(year) {
        return this.entgelte(year).reduce((s, u) => s + u.betrag, 0);
    },

    // eingabe: { year, grenzen: {vj, lfd}, umsaetze: [{datum, betrag}], vorjahresUmsatz,
    //            taetigkeitsbeginn: 'YYYY-MM-DD'|'' }
    // Rückgabe: { status, grenze, summe, ab, gruendungsjahr }
    //   status: 'klein'     – Befreiung gilt
    //           'folgejahr' – dieses Jahr befreit, ab dem Folgejahr nicht mehr
    //           'sofort'    – laufende Grenze überschritten; steuerpflichtig ab `ab`
    //           'vorjahr'   – Vorjahr über der Grenze; das ganze Jahr nicht befreit
    pruefe(e) {
        const g = e.grenzen;
        const tb = String(e.taetigkeitsbeginn || '');
        const gruendungsjahr = /^\d{4}-\d{2}-\d{2}$/.test(tb) && parseInt(tb.slice(0, 4), 10) === e.year;
        const sortiert = (e.umsaetze || []).filter(u => u && u.datum)
            .slice().sort((a, b) => a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0);
        const summe = sortiert.reduce((s, u) => s + (parseFloat(u.betrag) || 0), 0);

        // Vor dem Tätigkeitsbeginn gibt es kein Vorjahr; sonst schließt ein Vorjahr > Grenze aus.
        // Strikt ">" — "nicht überschritten hat".
        if (!gruendungsjahr && (parseFloat(e.vorjahresUmsatz) || 0) > g.vj) {
            return { status: 'vorjahr', grenze: g.vj, summe, ab: e.year + '-01-01', gruendungsjahr };
        }
        const grenzeLfd = (gruendungsjahr && e.year >= 2025) ? g.vj : g.lfd;
        let lauf = 0;
        for (const u of sortiert) {
            lauf += parseFloat(u.betrag) || 0;
            if (lauf > grenzeLfd) return { status: 'sofort', grenze: grenzeLfd, summe, ab: u.datum, gruendungsjahr };
        }
        if (summe > g.vj) return { status: 'folgejahr', grenze: g.vj, summe, ab: (e.year + 1) + '-01-01', gruendungsjahr };
        return { status: 'klein', grenze: g.vj, summe, ab: null, gruendungsjahr };
    }
};

if (typeof window !== 'undefined') window.Kleinunternehmer = Kleinunternehmer;
if (typeof module !== 'undefined' && module.exports) module.exports = Kleinunternehmer;
