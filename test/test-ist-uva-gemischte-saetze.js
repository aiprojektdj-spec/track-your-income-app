// Regressionstest: Ist-UVA / createSaleFromInvoice mit gemischten 7%/19%-Steuersätzen.
// Testet den ECHTEN Code aus js/store.js (per Quelltext-Extraktion, nicht eine Kopie) —
// gleiches Vorgehen wie test-kleinunternehmer-schwellen.js, da js/store.js wegen vieler
// Browser-Globals (indexedDB, localStorage, navigator) nicht direkt per require() ladbar ist.
'use strict';
const assert = require('assert');
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/../js/store.js', 'utf8');
const startMarker = 'createSaleFromInvoice(invoice, platform, purchaseId, manualEK, opts) {';
const endMarker = 'return this.saveSale(sale);';
const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker, startIdx);
assert.ok(startIdx !== -1 && endIdx !== -1, 'createSaleFromInvoice nicht gefunden — hat sich die Methodensignatur geändert?');
const body = src.slice(startIdx + startMarker.length, endIdx + endMarker.length);
// eslint-disable-next-line no-new-func
const createSaleFromInvoice = new Function('invoice', 'platform', 'purchaseId', 'manualEK', 'opts', body);

// Minimaler Store-Mock: nur was diese eine Methode aufruft.
function mockStore(existingSales) {
    return {
        getSettings() { return { ustMode: 'regel' }; },
        getSales(includeStorniert) { return existingSales || []; },
        getRechCustomers() { return []; },
        savePurchase(p) { return Object.assign({ id: 'pk_test' }, p); },
        saveSale(s) { return Object.assign({ id: 's_' + Math.random().toString(36).slice(2) }, s); }
    };
}

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else console.error('✗ FAIL ' + name);
}

// ── 1) Rechnung mit gemischten 7%/19%-Positionen, volle Zahlung ──────────────
// Position A: 100,00 € netto @ 19% → 119,00 € brutto
// Position B: 100,00 € netto @  7% → 107,00 € brutto
const invoiceMixed = {
    id: 'inv1', nummer: 'RE-2026-001', typ: 'rechnung', datum: '2026-03-01', bezahltAm: '2026-03-05',
    positionen: [
        { menge: 1, einzelpreis: 100, mwstSatz: 19 },
        { menge: 1, einzelpreis: 100, mwstSatz: 7 }
    ]
};
{
    const sale = createSaleFromInvoice.call(mockStore([]), invoiceMixed, '', null, null, {});
    check('gemischte Sätze: Gesamtbrutto = 226,00€', Math.abs(sale.verkaufspreis - 226) < 0.01);
    check('gemischte Sätze: sale.steuersatz bleibt UNGESETZT (kein falscher Single-Value)', sale.steuersatz === undefined);
    check('gemischte Sätze: sale.steuersaetze enthält beide Sätze', sale.steuersaetze && sale.steuersaetze['19'] !== undefined && sale.steuersaetze['7'] !== undefined);
    check('gemischte Sätze: 19%-Gruppe = 119,00€', Math.abs(sale.steuersaetze['19'] - 119) < 0.01);
    check('gemischte Sätze: 7%-Gruppe = 107,00€', Math.abs(sale.steuersaetze['7'] - 107) < 0.01);
}

// ── 2) Einheitlicher Satz bleibt weiterhin als einfaches sale.steuersatz-Feld ─
const invoiceUniform = {
    id: 'inv2', nummer: 'RE-2026-002', typ: 'rechnung', datum: '2026-03-01', bezahltAm: '2026-03-05',
    positionen: [{ menge: 2, einzelpreis: 50, mwstSatz: 19 }]
};
{
    const sale = createSaleFromInvoice.call(mockStore([]), invoiceUniform, '', null, null, {});
    check('einheitlicher Satz: sale.steuersatz = 19', sale.steuersatz === 19);
    check('einheitlicher Satz: kein steuersaetze-Objekt gesetzt', !sale.steuersaetze);
}

// ── 3) Teilzahlung auf gemischte Rechnung: proportionale Aufteilung ──────────
// Gesamtrechnung 226,00€ (119 @19% + 107 @7%). Teilzahlung 113,00€ = 50% des Gesamtbetrags
// → erwartete Aufteilung: 59,50€ @19% (119*0.5) + 53,50€ @7% (107*0.5)
{
    const teilSale = createSaleFromInvoice.call(mockStore([]), invoiceMixed, '', null, null, { teilzahlungBetrag: 113 });
    check('Teilzahlung: Gesamtbetrag = 113,00€', Math.abs(teilSale.verkaufspreis - 113) < 0.01);
    check('Teilzahlung: 19%-Anteil = 59,50€', Math.abs(teilSale.steuersaetze['19'] - 59.5) < 0.01);
    check('Teilzahlung: 7%-Anteil = 53,50€', Math.abs(teilSale.steuersaetze['7'] - 53.5) < 0.01);

    // ── 4) Schlusszahlung nach dieser Teilzahlung: Rest korrekt satzgenau ────
    const schlussSale = createSaleFromInvoice.call(mockStore([Object.assign({ _invoiceId: 'inv1', _teilzahlung: true, storniert: false }, teilSale)]), invoiceMixed, '', null, null, {});
    check('Schlusszahlung: Restbetrag = 113,00€ (226 - 113)', Math.abs(schlussSale.verkaufspreis - 113) < 0.01);
    check('Schlusszahlung: 19%-Rest = 59,50€', Math.abs(schlussSale.steuersaetze['19'] - 59.5) < 0.01);
    check('Schlusszahlung: 7%-Rest = 53,50€', Math.abs(schlussSale.steuersaetze['7'] - 53.5) < 0.01);
}

// ── 5) Gutschrift auf gemischte Rechnung: beide Gruppen negativ ──────────────
const gutschriftMixed = Object.assign({}, invoiceMixed, { id: 'inv3', typ: 'gutschrift' });
{
    const sale = createSaleFromInvoice.call(mockStore([]), gutschriftMixed, '', null, null, {});
    check('Gutschrift gemischt: Gesamtbetrag negativ (-226,00€)', Math.abs(sale.verkaufspreis + 226) < 0.01);
    check('Gutschrift gemischt: 19%-Gruppe negativ (-119,00€)', Math.abs(sale.steuersaetze['19'] + 119) < 0.01);
    check('Gutschrift gemischt: 7%-Gruppe negativ (-107,00€)', Math.abs(sale.steuersaetze['7'] + 107) < 0.01);
}

// ── 6) ustvoranmeldung.js: _perRateGroups/_rate lesen sale.steuersaetze korrekt ──
{
    const uvaSrc = fs.readFileSync(__dirname + '/../js/ustvoranmeldung.js', 'utf8');
    check('ustvoranmeldung.js: _perRateGroups() vorhanden (satzgenaue Ist-Summierung)', uvaSrc.includes('_perRateGroups'));
    check('ustvoranmeldung.js: Ist-Zweig nutzt _perRateGroups statt pauschalem _rate()+_brutto() pro Sale', /salesOhneDiff25a\.forEach\(v => \{\s*_perRateGroups\(v\)/.test(uvaSrc));
}

console.log('\n' + pass + '/' + total + ' Tests bestanden ' + (pass === total ? '✅' : '❌'));
if (pass !== total) process.exit(1);
