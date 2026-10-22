// Nicht (voll) abziehbare Betriebsausgaben (E-07) und Fahrtenbuch "tatsächliche Kosten" (E-08),
// Steuer-Audit 2026-10-18.
//   node test/test-nicht-abziehbare-ba.js
// Sollwerte von Hand: §4 Abs. 5 S. 1 Nr. 1 EStG (Geschenke bis 50 € je Empfänger und Jahr, ab 2024),
// Nr. 2 (Bewirtung 70 %), §4 Abs. 5b EStG (GewSt keine Betriebsausgabe), §15 Abs. 1a UStG
// (keine Vorsteuer auf nicht abziehbare Geschenke; Bewirtung voll), R 4.10 Abs. 3 EStR (Grenze netto
// bei Vorsteuerabzug).
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');
let n = 0; const ok = t => { n++; console.log('✓ ' + t); };
const r2 = v => Math.round(v * 100) / 100;

const Utils = {
    isInPeriod: (d, s, e) => !!d && d >= s && d <= e,
    getMonthName: () => 'Monat', formatDate: d => d, formatCurrency: v => String(v),
    istDrittland: () => false, showToast() {}, escapeHtml: s => String(s), EU_LAENDER: []
};
function welt(over) {
    const d = Object.assign({ sales: [], purchases: [], expenses: [], invoices: [], fahrten: [], retouren: [],
        vorsteuer_entries: [], ustPerioden: [], settings: { ustMode: 'klein' } }, over);
    const aktiv = l => l.filter(x => !x.storniert);
    const Store = {
        getSettings: () => d.settings, getSales: all => all ? d.sales : aktiv(d.sales),
        getAllSalesRaw: () => d.sales, getPurchases: all => all ? d.purchases : aktiv(d.purchases),
        getExpenses: () => aktiv(d.expenses), getRetouren: () => d.retouren,
        getRechInvoices: () => d.invoices, getRechCustomers: () => [],
        getFahrten: () => d.fahrten, getAfaAnlagen: () => [], getMaterialEinkauefe: () => [],
        getUstPerioden: () => d.ustPerioden, getSteuertermine: () => [],
        _syncReadRaw: () => [], getDifferenzVortrag: () => 0,
        get: k => d[k] || null, set: (k, v) => { d[k] = v; },
        salePerRate: s => [{ satz: parseFloat(s.steuersatz) || 19, brutto: +s.verkaufspreis || 0 }]
    };
    const c = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/steuer-berechnung.js', 'js/afa.js',
        'js/vorsteuer.js', 'js/oss.js', 'js/ausgaben.js', 'js/fahrtenbuch.js', 'js/euer.js', 'js/ustvoranmeldung.js'],
        { Store, Utils, document: { getElementById: () => null } });
    return c;
}
const jahr = c => c.Euer._berechne(2026, 0, 'jahr');

// E-07, Kleinunternehmer — der Repro-Fall mit den neuen Kategorien
{
    const c = welt({
        sales: [{ id: 's', datum: '2026-02-01', verkaufspreis: 10000, steuersatz: 0 }],
        expenses: [
            { id: 'b', datum: '2026-03-01', kategorie: 'Bewirtung', betrag: 100, ustSatz: 0 },
            { id: 'g', datum: '2026-03-02', kategorie: 'Geschenke an Geschäftsfreunde', empfaenger: 'Kunde X', betrag: 80, ustSatz: 0 },
            { id: 'gw', datum: '2026-03-03', kategorie: 'Gewerbesteuer', betrag: 500, ustSatz: 0 }] });
    const e = jahr(c);
    assert.strictEqual(r2(e.nichtAbziehbar), 610);
    assert.strictEqual(r2(e.gewinn), 9930);
    ok('E-07 KU: Bewirtung 100 / Geschenk 80 / GewSt 500 → 610 € nicht abziehbar, Gewinn 9.930 €');
}

// E-07, Geschenkgrenze je Empfänger und Jahr
{
    const g = (id, datum, empf, betrag) => ({ id, datum, kategorie: 'Geschenke an Geschäftsfreunde', empfaenger: empf, betrag, ustSatz: 0 });
    const c = welt({ expenses: [g('a', '2026-01-10', 'Anna', 30), g('b', '2026-11-10', ' anna ', 25),
        g('c', '2026-05-01', 'Bernd', 50), g('d', '2025-12-20', 'Bernd', 40)] });
    const A = c.Ausgaben, alle = c.Store.getExpenses();
    assert.strictEqual(A._geschenkUeberGrenze(alle[0], alle), true, 'Anna 55 € im Jahr');
    assert.strictEqual(A._geschenkUeberGrenze(alle[2], alle), false, 'Bernd 50 € genau an der Grenze, Vorjahr zählt nicht');
    assert.strictEqual(A._geschenkGrenze(2023), 35);
    assert.strictEqual(r2(jahr(c).nichtAbziehbar), 55);
    ok('E-07: Grenze je Empfänger und Jahr (55 € an Anna ganz nicht abziehbar, 50 € an Bernd abziehbar; 35 € bis 2023)');
}

// E-07, Regelbesteuerung: Bewirtung netto 70 %, Vorsteuer voll; Geschenk über der Grenze ohne Vorsteuer
{
    const c = welt({ settings: { ustMode: 'regel', ustVersteuerungsart: 'soll' },
        sales: [{ id: 's', datum: '2026-02-01', verkaufspreis: 1190, steuersatz: 19 }],
        expenses: [
            { id: 'b', datum: '2026-03-01', kategorie: 'Bewirtung', betrag: 119, ustSatz: 19 },
            { id: 'g', datum: '2026-03-02', kategorie: 'Geschenke an Geschäftsfreunde', empfaenger: 'X', betrag: 71.4, ustSatz: 19 },
            { id: 'k', datum: '2026-03-03', kategorie: 'Geschenke an Geschäftsfreunde', empfaenger: 'Y', betrag: 59.5, ustSatz: 19 }] });
    const e = jahr(c);
    // Bewirtung: 30 € nicht abziehbar, VSt 19 €; Geschenk X 60 € netto > 50 → 71,40 € nicht abziehbar, keine VSt;
    // Geschenk Y 50 € netto → abziehbar, VSt 9,50 €
    assert.strictEqual(r2(e.nichtAbziehbar), 101.4);
    assert.strictEqual(r2(e.vorsteuer), 28.5);
    assert.strictEqual(r2(e.nettoGewinn), r2(1000 - 70 - 50));
    assert.strictEqual(r2(c.Vorsteuer._calcFromExpenses('2026-01-01', '2026-03-31').vst19), 28.5, 'UVA-Vorsteuer ohne Geschenk X');
    ok('E-07 Regel: Bewirtung 70 % netto mit voller VSt, Geschenk 60 € netto ohne VSt, 50 € netto mit VSt');
}

// E-08 — Fahrt mit tatsächlichen Kosten bucht 0 €, Pauschale bleibt
{
    const c = welt({
        fahrten: [{ id: 'f', datum: '2026-05-01', gesamtKm: 100, berechnungsart: 'tatsaechlich', tatsaechlicheKosten: 60, kosten: 60 },
                  { id: 'p', datum: '2026-05-02', gesamtKm: 100, berechnungsart: 'pauschale_pkw', kosten: 30 }],
        expenses: [{ id: 't', datum: '2026-05-01', kategorie: 'Fahrtkosten', betrag: 60, ustSatz: 0 }] });
    const e = jahr(c);
    assert.strictEqual(r2(e.fahrtkosten), 30);
    assert.strictEqual(r2(e.fahrtkosten + e.sonstigeAusgaben), 90);
    assert.strictEqual(c.Fahrtenbuch._betriebsausgabe({ berechnungsart: 'tatsaechlich', kosten: 60 }), 0);
    ok('E-08: 60 € Fahrt (tatsächlich) + 60 € Tankbeleg + 30 € Pauschale = 90 € statt 150 €');
}

console.log('\n' + n + '/4 Tests bestanden');
