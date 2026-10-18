// Regression Audit 2026-10-13, T04/T06/T07 — wann und ob die Umsatzsteuer in der UVA steht.
//
// T04: Bei Sollbesteuerung entsteht die Steuer im Zeitraum der Leistung, nicht im Zeitraum des
//      Rechnungsdatums (§13 Abs.1 Nr.1a UStG); Anzahlungen vor der Leistung im Zahlungszeitraum.
// T06: Kleinunternehmer-Vorgänge gehören nicht in die UVA, auch nach einem Wechsel.
// T07: §25a-Rückabwicklung in einer späteren Periode wird dort mit Vorzeichen berichtigt (§17).
//
// Echte Module: js/steuerstatus.js, js/steuer-berechnung.js, js/ustvoranmeldung.js.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

let fail = 0, pass = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: erwartet ${b}, war ${a}`);

function uva(o) {
    const d = Object.assign({ sales: [], purchases: [], expenses: [], retouren: [], invoices: [],
        settings: { ustMode: 'regel', ustVersteuerungsart: 'soll' } }, o);
    const Store = {
        getSettings: () => d.settings,
        getSales: alle => alle ? d.sales : d.sales.filter(s => !s.storniert),
        getPurchases: alle => alle ? d.purchases : d.purchases.filter(p => !p.storniert),
        getExpenses: () => d.expenses, getRetouren: () => d.retouren,
        getRechInvoices: () => d.invoices, getRechCustomers: () => [],
        getDifferenzVortrag: () => 0, getUstPerioden: () => []
    };
    const Utils = { isInPeriod: (x, s, e) => !!x && x >= s && x <= e, istDrittland: () => false };
    const ctx = ladeModule(['js/steuerstatus.js', 'js/steuer-berechnung.js', 'js/ustvoranmeldung.js'], { Store, Utils });
    ctx.UstVoranmeldung._year = 2026;
    return (von, bis) => ctx.UstVoranmeldung._calcPeriode(von, bis);
}
const Q1 = ['2026-01-01', '2026-03-31'], Q2 = ['2026-04-01', '2026-06-30'];
const rechnung = extra => Object.assign({ id: 'r1', typ: 'rechnung', status: 'versendet',
    positionen: [{ menge: 1, einzelpreis: 100, mwstSatz: 19 }] }, extra);

check('T04: Leistung 15.03., Rechnung 10.04. → Q1 19 €, Q2 0 €', () => {
    const calc = uva({ invoices: [rechnung({ datum: '2026-04-10', datumsOption: 'lieferdatum', lieferdatum: '2026-03-15' })] });
    near(calc(...Q1).ust19, 19, 'Q1');
    near(calc(...Q2).ust19, 0, 'Q2');
});

check('T04: Leistungszeitraum Feb–Mai, Rechnung 01.02. → Steuer im Zeitraum des Leistungsendes', () => {
    const calc = uva({ invoices: [rechnung({ datum: '2026-02-01', datumsOption: 'lieferzeitraum', lieferVon: '2026-02-01', lieferBis: '2026-05-31' })] });
    near(calc(...Q1).ust19, 0, 'Q1');
    near(calc(...Q2).ust19, 19, 'Q2');
});

check('T04: ohne Liefer-/Leistungsangabe gilt das Rechnungsdatum (wie auf der Rechnung ausgewiesen)', () => {
    const calc = uva({ invoices: [rechnung({ datum: '2026-04-10', datumsOption: 'nur_datum', lieferdatum: '2026-03-15' })] });
    near(calc(...Q1).ust19, 0, 'Q1 — verstecktes Lieferdatum zählt nicht');
    near(calc(...Q2).ust19, 19, 'Q2');
});

check('T04: Anzahlung 59,50 € im März, Leistung im April → Q1 9,50 €, Q2 9,50 €', () => {
    const calc = uva({
        invoices: [rechnung({ datum: '2026-03-01', datumsOption: 'lieferdatum', lieferdatum: '2026-04-20' })],
        sales: [{ id: 'a1', _invoiceId: 'r1', _teilzahlung: true, datum: '2026-03-10', verkaufspreis: 59.5, steuersatz: 19 }]
    });
    near(calc(...Q1).ust19, 9.5, 'Q1 Anzahlung');
    near(calc(...Q2).ust19, 9.5, 'Q2 Rest');
});

check('T06: Kleinunternehmer-Verkauf 2025 erscheint nach Wechsel nicht in einer UVA', () => {
    const calc = uva({
        settings: { ustMode: 'regel', ustVersteuerungsart: 'ist',
            ustModeHistorie: [{ ab: '0000-01-01', mode: 'klein' }, { ab: '2026-02-01', mode: 'regel' }] },
        sales: [{ id: 's1', datum: '2026-01-15', verkaufspreis: 119 }, { id: 's2', datum: '2026-02-15', verkaufspreis: 119, steuersatz: 19 }]
    });
    near(calc(...Q1).ust19, 19, 'nur der Verkauf nach dem Wechsel');
});

check('T07: §25a 150/100, Verkauf Q1, volle Erstattung Q2 → Q1 +7,98 €, Q2 −7,98 €', () => {
    const calc = uva({
        settings: { ustMode: 'regel', ustVersteuerungsart: 'ist' },
        purchases: [{ id: 'p1', datum: '2026-01-10', einkaufspreis: 100, anzahl: 1, ustSatz: 0, differenzbesteuert: true }],
        sales: [{ id: 's1', datum: '2026-03-01', verkaufspreis: 150, purchaseId: 'p1' }],
        retouren: [{ id: 'r1', datum: '2026-04-01', erstattungBetrag: 150, saleId: 's1' }]
    });
    near(calc(...Q1).ust19, 7.98, 'Q1');
    near(calc(...Q2).ust19, -7.98, 'Q2 Berichtigung');
});

check('T07 Soll: bezahlte §25a-Rechnung März, Gutschrift April → Q2 −7,98 €', () => {
    const calc = uva({
        purchases: [{ id: 'p1', datum: '2026-01-10', einkaufspreis: 100, anzahl: 1, ustSatz: 0, differenzbesteuert: true }],
        invoices: [
            { id: 'r1', typ: 'rechnung', status: 'bezahlt', datum: '2026-03-01', positionen: [{ menge: 1, einzelpreis: 150, differenzbesteuert: true, lagerArtikelId: 'p1' }] },
            { id: 'g1', typ: 'gutschrift', status: 'versendet', datum: '2026-04-01', positionen: [{ menge: 1, einzelpreis: 150, differenzbesteuert: true, lagerArtikelId: 'p1' }] }
        ]
    });
    near(calc(...Q1).ust19, 7.98, 'Q1');
    near(calc(...Q2).ust19, -7.98, 'Q2');
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
