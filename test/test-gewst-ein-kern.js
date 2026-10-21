// Ein Gewerbesteuer-Rechenkern für alle Seiten (Steuer-Audit 2026-10-18, E-04/E-05c/E-06).
//   node test/test-gewst-ein-kern.js
// Sollwerte von Hand: §11 Abs.1 S.3 GewStG (Gewerbeertrag auf volle 100 € abrunden, Freibetrag
// 24.500 €), Abs.2 Messzahl 3,5 %; §7 GewStG i. V. m. §15 Abs.1 S.1 Nr.2 EStG (Sonderbetriebs-
// ergebnis gehört zum Gewerbeertrag der Mitunternehmerschaft); §19 Abs.1 GewStG (Vorauszahlungen
// 15.02./15.05./15.08./15.11.); Freiberufler (§18 EStG) sind nicht gewerbesteuerpflichtig.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

function welt(kv, verkauf, ausgabe) {
    const d = { kv: kv || {}, settings: { ustMode: 'klein' },
        sales: verkauf ? [{ id: 's', datum: '2026-06-01', verkaufspreis: verkauf, steuersatz: 0 }] : [],
        expenses: ausgabe ? [{ id: 'm', datum: '2026-06-02', kategorie: 'Sonstiges', betrag: ausgabe, ustSatz: 0 }] : [] };
    const leer = () => [];
    const Store = {
        getSettings: () => d.settings, saveSettings: s => { d.settings = s; },
        getSales: () => d.sales, getAllSalesRaw: () => d.sales, getPurchases: leer, getAllPurchasesRaw: leer,
        getExpenses: () => d.expenses, getAllExpensesRaw: () => d.expenses, getRetouren: leer, getRechInvoices: leer,
        getRechCustomers: leer, getFahrten: leer, getAfaAnlagen: leer, getMaterialEinkauefe: leer, getMaterialBestand: leer,
        _syncReadRaw: leer, getDifferenzVortrag: () => 0, autoSyncInvoices() {}, canEdit: () => true, isLocked: () => false,
        get: k => (k in d.kv ? d.kv[k] : null), set: (k, v) => { d.kv[k] = v; },
        salePerRate: s => [{ satz: s.steuersatz, brutto: +s.verkaufspreis || 0 }]
    };
    const Utils = { isInPeriod: (x, s, e) => !!x && x >= s && x <= e, getMonthName: m => 'M' + m, formatDate: x => x,
        formatCurrency: v => (Math.round((+v || 0) * 100) / 100).toFixed(2).replace('.', ',') + ' €',
        escapeHtml: s => String(s == null ? '' : s), istDrittland: () => false, EU_LAENDER: [], showToast() {} };
    const document = { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null };
    const c = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/steuer-berechnung.js', 'js/afa.js',
        'js/vorsteuer.js', 'js/euer.js', 'js/rechtsform.js', 'js/gbr.js', 'js/gbr-modul.js', 'js/gewerbesteuer.js', 'js/koerperschaftsteuer.js'],
        { Store, Utils, document, App: { showModal() {}, closeModal() {} } });
    return { c, d };
}
const r2 = v => Math.round(v * 100) / 100;
const zahl = (html, id) => { const m = new RegExp('id="' + id + '">([^<]+)<').exec(html); return m ? parseFloat(m[1].replace(/[^\d,-]/g, '').replace(',', '.')) : null; };
let n = 0; const ok = t => { n++; console.log('✓ ' + t); };

// E04a — Einzelunternehmen: GewSt-Seite und EÜR-Block mit demselben Hebesatz und Abrundung
{
    const { c, d } = welt({ gbr_einstellungen: { firmenform: 'Einzelunternehmen', taetigkeitsart: 'gewerblich', hebesatz: 450 } }, 30050);
    d.settings.gewerbesteuerHebesatz = 400;   // alter zweiter Speicher darf nicht mehr gewinnen
    const gewinn = c.Euer._berechne(2026, 0, 'jahr').gewinn;
    c.Euer._selectedYear = 2026;
    assert.strictEqual(r2(c.Gewerbesteuer._calc(2026).gewSt), 866.25);
    assert.strictEqual(zahl(c.Euer._renderGewerbesteuerBlock(gewinn), 'gewstBetrag'), 866.25);
    ok('E04a: GewSt-Seite = EÜR-Block = 866,25 € (30.050 → 30.000 − 24.500 = 5.500 × 3,5 % × 450 %)');
}
// E04b — GbR mit Sonderbetriebseinnahmen
{
    const { c } = welt({ gbr_einstellungen: { firmenform: 'GbR', taetigkeitsart: 'gewerblich', hebesatz: 450 },
        gbr_gesellschafter: [{ id: 'A', name: 'A', anteil: 50 }, { id: 'B', name: 'B', anteil: 50 }],
        gbr_sbe_sba: { 2026: { A: { sbe: 10000, sba: 0 } } } }, 30050, 10000);
    const gewinn = c.Euer._berechne(2026, 0, 'jahr').gewinn;
    assert.strictEqual(r2(gewinn), 20050);
    assert.strictEqual(r2(c.GbR.berechneGewSt(gewinn, 2026)), 866.25);
    assert.strictEqual(r2(c.Gewerbesteuer._calc(2026).gewSt), 866.25);
    assert.ok(/866,25/.test(c.GbrModul._renderGewerbesteuer(gewinn, 2026)), 'GbR-Verwaltung ohne SBE');
    ok('E04b: GbR 20.050 + SBE 10.000 → 866,25 € auf allen Wegen');
}
// E04c — Abrundung vor dem Freibetrag
{
    const { c } = welt({ gbr_einstellungen: { firmenform: 'GbR', taetigkeitsart: 'gewerblich', hebesatz: 400 },
        gbr_gesellschafter: [{ id: 'A', name: 'A', anteil: 100 }] }, 24599);
    assert.strictEqual(c.GbR.berechneGewSt(24599, 2026), 0);
    ok('E04c: Gewinn 24.599 → Gewerbeertrag 0, keine Gewerbesteuer');
}
// E-05c — freiberuflich: keine Gewerbesteuer, kein EÜR-Block
{
    const { c } = welt({ gbr_einstellungen: { firmenform: 'Einzelunternehmen', taetigkeitsart: 'freiberuflich' } }, 170000);
    assert.strictEqual(c.Gewerbesteuer._isGewStPflichtig(), false);
    assert.strictEqual(c.Euer._renderGewerbesteuerBlock(170000), '');
    ok('E-05c: freiberuflicher Einzelunternehmer ohne Gewerbesteuer');
}
// E-06 — Vorauszahlungstermine §19 GewStG
{
    const { c } = welt({ gbr_einstellungen: { firmenform: 'GbR', taetigkeitsart: 'gewerblich' }, gbr_gesellschafter: [{ id: 'A', name: 'A', anteil: 100 }] }, 50000);
    const html = c.GbrModul._renderGewerbesteuer(50000, 2026);
    ['15.02.2026', '15.05.2026', '15.08.2026', '15.11.2026'].forEach(t => assert.ok(html.indexOf(t) !== -1, t + ' fehlt'));
    assert.ok(html.indexOf('10.03.2026') === -1, 'ESt-Termin statt GewSt-Termin');
    ok('E-06: GewSt-Vorauszahlungen 15.02./15.05./15.08./15.11.');
}
// E-10 / R-TAX-05 — GmbH: KSt-Seite und GewSt-Seite aus demselben (Netto-)Gewinn
{
    const { c, d } = welt({ gbr_einstellungen: { firmenform: 'GmbH', hebesatz: 400 } }, 119000);
    d.settings = { ustMode: 'regel', ustVersteuerungsart: 'ist' };
    d.sales[0].steuersatz = 19;
    assert.strictEqual(r2(c.Koerperschaftsteuer._calcGewinn(2026).gewinn), 100000);
    assert.strictEqual(r2(c.Gewerbesteuer._calcGewinn(2026)), 100000);
    d.expenses.push({ id: 'fa', datum: '2026-07-01', kategorie: 'Umsatzsteuer-Erstattung vom Finanzamt', betrag: 50, ustSatz: 0 });
    assert.strictEqual(r2(c.Koerperschaftsteuer._calcGewinn(2026).gewinn), 100000, 'USt-Erstattung ist bei der GmbH kein Ertrag/Aufwand');
    ok('E-10/R-TAX-05: GmbH — KSt- und GewSt-Gewinn 100.000 € netto, FA-Erstattung ohne Wirkung');
}
// E-09 — manuelle "sonstige" Vorsteuer ist Betriebsausgabe
{
    const { c, d } = welt({ vorsteuer_entries: [{ typ: 'sonstige', datum: '2026-01-10', nettoBetrag: 1000, vorsteuerBetrag: 190 }],
        gbr_einstellungen: { firmenform: 'Einzelunternehmen', taetigkeitsart: 'gewerblich' } });
    d.settings = { ustMode: 'regel', ustVersteuerungsart: 'ist' };
    const e = c.Euer._berechne(2026, 0, 'jahr');
    assert.strictEqual(r2(e.vorsteuer), 190);
    assert.strictEqual(r2(e.gewinn), -190);
    assert.strictEqual(r2(e.nettoGewinn), 0);
    assert.strictEqual(r2(c.Euer._elsterZeilen(e).find(x => x.key === 'vorsteuer').betrag), 190);
    ok('E-09: manuelle Vorsteuer 190 € mindert den EÜR-Gewinn und steht in der Zeile Vorsteuer');
}
console.log('\n' + n + '/7 Gewerbesteuer-Kern-Tests bestanden');
