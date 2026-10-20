// Anlagenabgang statt Storno (Steuer-Audit 2026-10-18, E-01).
//   node test/test-afa-abgang.js
// Sollwerte von Hand: §7 Abs.1 S.4 EStG / R 7.4 Abs.8 EStR (AfA im Abgangsjahr monatsgenau bis
// einschließlich Abgangsmonat), §4 Abs.3 S.4 EStG (Restbuchwert = Betriebsausgabe im Abgangsjahr).
// Beispiel: Laptop 3.000 € netto, Kauf 01.12.2026, linear 3 Jahre, Verkauf 15.03.2027 für 1.190 €.
//   2026: 3000/3 × 1/12 = 83,33 · 2027: 1000 × 3/12 = 250,00 · Restbuchwert 3000 − 83,33 − 250 = 2.666,67
//   Gewinn 2027 (Ist, Regel, Verkauf brutto als Zufluss): 1.190 − 250 − 2.666,67 = −1.726,67
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

function welt(daten) {
    const d = Object.assign({ sales: [], assets: [], settings: { ustMode: 'regel', ustVersteuerungsart: 'ist' } }, daten);
    const leer = () => [];
    const Store = {
        getSettings: () => d.settings, getSales: () => d.sales.filter(s => !s.storniert), getAllSalesRaw: () => d.sales,
        getPurchases: leer, getAllPurchasesRaw: leer, getExpenses: leer, getAllExpensesRaw: leer, getRetouren: leer,
        getRechInvoices: leer, getRechCustomers: leer, getFahrten: leer, getAfaAnlagen: () => d.assets,
        getMaterialEinkauefe: leer, getMaterialBestand: leer, _syncReadRaw: leer, getDifferenzVortrag: () => 0,
        get: () => null, set() {}, autoSyncInvoices() {},
        salePerRate: s => [{ satz: s.steuersatz, brutto: +s.verkaufspreis || 0 }]
    };
    const Utils = { isInPeriod: (x, s, e) => !!x && x >= s && x <= e, getMonthName: m => 'M' + m, formatDate: x => x,
        formatCurrency: v => String(v), escapeHtml: s => String(s), istDrittland: () => false, EU_LAENDER: [], showToast() {} };
    return ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/steuer-berechnung.js', 'js/afa.js',
        'js/vorsteuer.js', 'js/euer.js'], { Store, Utils });
}
const r2 = v => Math.round(v * 100) / 100;
const laptop = extra => Object.assign({ id: 'L', bezeichnung: 'Laptop', anschaffungsdatum: '2026-12-01',
    anschaffungskosten: 3000, nutzungsdauer: 3, methode: 'linear' }, extra || {});
let n = 0; const ok = t => { n++; console.log('✓ ' + t); };

{
    const c = welt({ assets: [laptop({ abgangsdatum: '2027-03-15' })], sales: [{ id: 'v', datum: '2027-03-15', verkaufspreis: 1190, steuersatz: 19 }] });
    assert.strictEqual(r2(c.Afa._calcJahresAfa(laptop({ abgangsdatum: '2027-03-15' }), 2026)), 83.33);
    ok('Vorjahr bleibt unberührt: AfA 2026 = 83,33');
    const e = c.Euer._berechne(2027, 0, 'jahr');
    assert.strictEqual(r2(e.afaKosten), 250);
    assert.strictEqual(r2(e.anlagenRestbuchwert), 2666.67);
    assert.strictEqual(r2(e.gewinn), -1726.67);
    ok('Abgangsjahr 2027: AfA 250,00 + Restbuchwert 2.666,67, Gewinn −1.726,67');
    assert.deepStrictEqual([2028, 2029].map(y => c.Afa._calcJahresAfa(laptop({ abgangsdatum: '2027-03-15' }), y)), [0, 0]);
    assert.strictEqual(e.afaKosten + e.anlagenRestbuchwert + 83.33, 3000);
    ok('Nach dem Abgang keine AfA mehr, Summe aller Jahre = AK');
    const zeilen = c.Euer._elsterZeilen(e);
    assert.strictEqual(r2(zeilen.find(z => z.key === 'restbuchwert').betrag), 2666.67);
    ok('Übertragungshilfe enthält die Zeile Restbuchwert');
}
{
    // Abgang im Anschaffungsjahr: Kauf 01.03.2026, Abgang 31.08.2026 → 6 Monate AfA
    const c = welt();
    const a = { anschaffungsdatum: '2026-03-01', anschaffungskosten: 1200, nutzungsdauer: 3, methode: 'linear', abgangsdatum: '2026-08-31' };
    assert.strictEqual(r2(c.Afa._calcJahresAfa(a, 2026)), 200);
    assert.strictEqual(r2(c.Afa._restbuchwertAbgang(a, 2026)), 1000);
    ok('Abgang im Anschaffungsjahr: 6 Monate AfA 200, Restbuchwert 1.000');
    const g = { anschaffungsdatum: '2026-03-01', anschaffungskosten: 700, nutzungsdauer: 3, methode: 'sofort', abgangsdatum: '2027-01-10' };
    assert.strictEqual(c.Afa._restbuchwertAbgang(g, 2027), 0);
    ok('GWG: kein Restbuchwert');
}
{
    const src = require('fs').readFileSync(require('path').join(__dirname, '../js/store.js'), 'utf8');
    assert.ok(/abgangAfaAnlage\(id, datum\)/.test(src) && /if \(this\.isPeriodLocked\(item\.anschaffungsdatum\)\) return;/.test(src),
        'Store: Abgang-Methode bzw. Storno-Sperre im festgeschriebenen Anschaffungsjahr fehlt');
    ok('Storno im festgeschriebenen Anschaffungsjahr gesperrt, Abgang vorhanden');
}
console.log('\n' + n + '/7 AfA-Abgang-Tests bestanden');
