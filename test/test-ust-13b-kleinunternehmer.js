// §13b UStG beim Leistungsempfänger: Kennzahlen 46/47 bzw. 84/85, Kleinunternehmer und
// manuelle Vorsteuer aus der KU-Zeit (Steuer-Audit 2026-10-18, U01/U04/U05).
//   node test/test-ust-13b-kleinunternehmer.js
// Sollwerte von Hand: §13b Abs.5 S.1 + Abs.8 UStG (auch der KU schuldet die Steuer),
// §19 Abs.1 UStG (kein Vorsteuerabzug für KU), Vordruck USt 1 A 2026 Zeilen 30–32.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

const EU = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
const Utils = {
    isInPeriod: (d, s, e) => !!d && d >= s && d <= e,
    getMonthName: () => 'Monat', formatDate: d => d, formatCurrency: v => String(v),
    istDrittland: c => !!c && c !== 'DE' && EU.indexOf(c) === -1,
    showToast() {}, escapeHtml: s => String(s), EU_LAENDER: EU
};

function welt(over) {
    const d = Object.assign({ sales: [], purchases: [], expenses: [], invoices: [], customers: [], retouren: [],
        vorsteuer_entries: [], ustPerioden: [], settings: { ustMode: 'regel', ustVersteuerungsart: 'soll' } }, over);
    const aktiv = l => l.filter(x => !x.storniert);
    const Store = {
        getSettings: () => d.settings, getSales: all => all ? d.sales : aktiv(d.sales),
        getAllSalesRaw: () => d.sales, getPurchases: all => all ? d.purchases : aktiv(d.purchases),
        getExpenses: () => aktiv(d.expenses), getRetouren: () => d.retouren,
        getRechInvoices: () => d.invoices, getRechCustomers: () => d.customers,
        getFahrten: () => [], getAfaAnlagen: () => [], getMaterialEinkauefe: () => [],
        getUstPerioden: () => d.ustPerioden, getSteuertermine: () => [],
        _syncReadRaw: () => [], getDifferenzVortrag: () => 0,
        get: k => d[k] || null, set: (k, v) => { d[k] = v; },
        salePerRate: s => [{ satz: parseFloat(s.steuersatz) || 19, brutto: +s.verkaufspreis || 0 }]
    };
    const c = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/steuer-berechnung.js', 'js/afa.js',
        'js/vorsteuer.js', 'js/oss.js', 'js/euer.js', 'js/ustvoranmeldung.js', 'js/steuertermine.js'], { Store, Utils });
    c.UstVoranmeldung._year = 2026;
    return c;
}
const q1 = c => c.UstVoranmeldung._calcPeriode('2026-01-01', '2026-03-31');
const zeilen = (c, calc) => Object.fromEntries(c.UstVoranmeldung._buildRows(calc).filter(r => r[0]).map(r => [r[0], r[2]]));
const nah = (a, b, t) => assert.ok(Math.abs(a - b) < 0.005, t + ': ' + a + ' statt ' + b);
let n = 0; const ok = t => { n++; console.log('✓ ' + t); };

// U01 — Steuerbeträge 47/85 und Abs.-2-Fälle in eigenen Kennzahlen
{
    const c = welt({ vorsteuer_entries: [
        { typ: 'reverse_charge', datum: '2026-02-01', paragraph: 'Abs. 1', nettoBetrag: 100, ustSatz: 19, vorsteuerBetrag: 19 },
        { typ: 'reverse_charge', datum: '2026-02-02', paragraph: 'Sonstige', nettoBetrag: 200, ustSatz: 19, vorsteuerBetrag: 38 }] });
    const z = zeilen(c, q1(c));
    assert.strictEqual(z['Kz. 46'], '100.00'); assert.strictEqual(z['Kz. 47'], '19.00');
    assert.strictEqual(z['Kz. 84'], '200.00'); assert.strictEqual(z['Kz. 85'], '38.00');
    assert.strictEqual(z['Kz. 67'], '57.00');
    ok('U01: Export enthält Kz 46/47, 84/85 und 67');
}

// Regelbesteuerer: RC-Ausgabe erzeugt §13b-Steuer und gleich hohe Vorsteuer, Zahllast 0
{
    const c = welt({ expenses: [{ id: 'e', datum: '2026-02-01', betrag: 100, ustSatz: 'rc', kategorie: 'Software/Abos' }] });
    const calc = q1(c);
    nah(calc.rcNettoAbs1, 100, 'Kz 46'); nah(calc.rcSteuerAbs1, 19, 'Kz 47'); nah(calc.vorsteuerRc, 19, 'Kz 67');
    nah(calc.zahllast, 0, 'Zahllast');
    ok('Regel: RC-Ausgabe 100 € → Kz 46 100, Kz 47 19, Kz 67 19, Zahllast 0');
}

// U04a — KU: RC-Ausgabe → Steuer 19 €, kein Abzug
{
    const c = welt({ settings: { ustMode: 'klein' },
        expenses: [{ id: 'e', datum: '2026-02-01', betrag: 100, ustSatz: 'rc', kategorie: 'Software/Abos' }] });
    const calc = q1(c);
    nah(calc.rcNettoAbs1, 100, 'Kz 46'); nah(calc.rcSteuerGesamt, 19, '§13b-Steuer');
    nah(calc.vorsteuerRc, 0, 'Kz 67'); nah(calc.zahllast, 19, 'Zahllast');
    ok('U04a: KU mit RC-Ausgabe 100 € schuldet 19 €');
}

// U04b — KU: manueller §13b-Eintrag ohne Vorsteuerabzug
{
    const c = welt({ settings: { ustMode: 'klein' }, vorsteuer_entries: [
        { typ: 'reverse_charge', datum: '2026-02-01', paragraph: 'Abs. 1', nettoBetrag: 100, ustSatz: 19, vorsteuerBetrag: 19 }] });
    const calc = q1(c);
    nah(calc.vorsteuerRc, 0, 'Kz 67'); nah(calc.zahllast, 19, 'Zahllast');
    ok('U04b: KU mit manuellem §13b-Eintrag: Kz 67 = 0, Zahllast 19');
}

// U04c — KU sieht die reduzierte §18-Abs.-4a-Ansicht statt der Sperre, ohne §13b-Fall den Hinweis
{
    const mit = welt({ settings: { ustMode: 'klein' },
        expenses: [{ id: 'e', datum: '2026-02-01', betrag: 100, ustSatz: 'rc', kategorie: 'Software/Abos' }] });
    mit.UstVoranmeldung._quartal = 0;
    const html = mit.UstVoranmeldung.render();
    assert.ok(!/Nur für Regelbesteuerer/.test(html), 'KU mit §13b-Fall darf nicht gesperrt sein');
    assert.ok(/§18 Abs\. 4a/.test(html), 'Ansicht nennt §18 Abs. 4a');
    assert.ok(/Kz\. 47/.test(html), 'Ansicht zeigt Kz 47');
    const ohne = welt({ settings: { ustMode: 'klein' } });
    assert.ok(/Nur für Regelbesteuerer/.test(ohne.UstVoranmeldung.render()), 'KU ohne §13b-Fall: Hinweis bleibt');
    ok('U04c: KU-Ansicht nur bei §13b-Fällen, sonst Hinweis');
}

// U05 — manuelle Vorsteuer aus der KU-Zeit im Wechselquartal nicht abziehbar
{
    const c = welt({ settings: { ustMode: 'regel', ustVersteuerungsart: 'soll',
        ustModeHistorie: [{ ab: '0000-01-01', mode: 'klein' }, { ab: '2026-02-15', mode: 'regel' }] },
        vorsteuer_entries: [
            { typ: 'sonstige', datum: '2026-02-01', nettoBetrag: 263.16, vorsteuerBetrag: 50 },
            { typ: 'sonstige', datum: '2026-03-01', nettoBetrag: 263.16, vorsteuerBetrag: 50 }] });
    nah(q1(c).vorsteuerEinkaufAusgaben, 50, 'Kz 66 nur der Eintrag nach dem Wechsel');
    ok('U05: Kz 66 enthält nur Vorsteuer ab dem Wechseldatum');
}

console.log('\n' + n + '/6 §13b-/KU-Tests bestanden');
