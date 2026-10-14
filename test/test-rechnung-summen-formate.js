// Regression Audit 2026-10-13, L5 — PDF, XRechnung, Forderung und Buchung tragen denselben Betrag.
//
// Sollwert nach EN 16931 (BR-CO-10, BR-S-8, BR-CO-17): Zeilen auf Cent gerundet, Steuer je Satz
// EINMAL aus der Bemessungsgrundlage gerundet. 10 × 0,03 € zu 19 %: Netto 0,30, Steuer
// round(0,057) = 0,06, Gesamt 0,36 €. Vorher XML 0,40 € (Steuer je Zeile gerundet).
//
// Echte Module: js/rechnung-summen.js, rechnungen/js/xrechnung.js, rechnungen/js/rechnung.js
// (Vorschau/PDF-HTML), js/store.js (Verkauf aus Rechnung). Das ist ein Teilregeltest, KEIN
// KoSIT-Nachweis — s. kosit-proben/ und plan/01-AUFGABEN.md.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

let fail = 0, pass = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}

const SETTINGS = { firmenname: 'Test GmbH', adresse: 'Weg 1', strasse: 'Weg 1', plz: '10115', ort: 'Berlin', land: 'DE',
    ustId: 'DE123456789', ustIdNr: 'DE123456789', iban: 'DE02120300000000202051', email: 'a@b.de', ustMode: 'regel' };
const KUNDE = { id: 'k1', firma: 'Kunde GmbH', name: 'Kunde GmbH', strasse: 'Str 2', plz: '20095', ort: 'Hamburg', land: 'DE' };

function welt() {
    const mem = {};
    const localStorage = { getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
    const Utils = {
        todayISO: () => '2026-10-13', formatDate: x => x, escapeHtml: s => String(s == null ? '' : s),
        formatNumber: n => String(n),
        // wie im Produkt: de-DE mit zwei Nachkommastellen
        formatCurrency: n => (parseFloat(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }),
        showToast() {}, isInPeriod: (x, s, e) => !!x && x >= s && x <= e
    };
    const ctx = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/store.js',
        'rechnungen/js/xrechnung.js', 'rechnungen/js/rechnung.js'], { localStorage, Utils, document: { getElementById: () => null } });
    ctx.Store.saveSettings(SETTINGS);
    ctx.Store.saveRechCustomer && ctx.Store.saveRechCustomer(KUNDE);
    return ctx;
}
const xmlBetrag = (xml, tag) => { const m = xml.match(new RegExp('<ram:' + tag + '[^>]*>([-0-9.]+)<')); return m ? parseFloat(m[1]) : NaN; };
function pdfGesamt(html) {
    const m = html.match(/GESAMTBETRAG<\/span><span>([^<]+)</);
    return m ? parseFloat(m[1].replace(/[^0-9,\-]/g, '').replace(',', '.')) : NaN;
}
function pruefe(name, positionen, soll) {
    check(name, () => {
        const ctx = welt();
        const inv = { id: 'r1', typ: 'rechnung', nummer: 'RE-2026-0001', datum: '2026-10-01', status: 'versendet', isKlein: false,
            kundeId: 'k1', leitwegId: '04011000-1234512345-06', positionen, bezahltAm: '2026-10-05' };
        const xml = ctx.XRechnung.generate(inv, SETTINGS, KUNDE);
        const xmlGesamt = xmlBetrag(xml, 'GrandTotalAmount');
        const xmlSteuer = xmlBetrag(xml, 'TaxTotalAmount');
        const pdf = pdfGesamt(ctx.Rechnung.generatePreviewHtml(inv));
        const sale = ctx.Store.createSaleFromInvoice(inv, '', null, null);
        const kern = ctx.RechnungSummen.berechne(positionen, false);
        assert.strictEqual(xmlGesamt, soll.brutto, 'XML GrandTotalAmount');
        assert.strictEqual(xmlSteuer, soll.steuer, 'XML TaxTotalAmount');
        assert.strictEqual(pdf, soll.brutto, 'PDF/Vorschau Gesamtbetrag');
        assert.strictEqual(Math.round(sale.verkaufspreis * 100) / 100, soll.brutto, 'Verkauf (Forderung/Zufluss)');
        assert.strictEqual(kern.brutto, soll.brutto, 'Rechenkern');
        const regeln = ctx.XRechnung.pruefeRegeln ? ctx.XRechnung.pruefeRegeln(xml) : [];
        const arith = (regeln || []).filter(r => /BR-CO/.test(r.regel || r.id || ''));
        assert.strictEqual(arith.length, 0, 'eigene BR-CO-Prüfung: ' + JSON.stringify(arith));
    });
}

pruefe('L5: 10 × 0,03 € zu 19 % → überall 0,36 € (Steuer 0,06 €)',
    Array.from({ length: 10 }, () => ({ beschreibung: 'Kleinteil', menge: 1, einheit: 'Stück', einzelpreis: 0.03, mwstSatz: 19 })),
    { brutto: 0.36, steuer: 0.06 });
pruefe('L5: gemischte Sätze 7 % und 19 % mit Rundungsgrenze',
    [{ beschreibung: 'Buch', menge: 3, einheit: 'Stück', einzelpreis: 0.335, mwstSatz: 7 },   // 1,005 → 1,01
     { beschreibung: 'Ware', menge: 1, einheit: 'Stück', einzelpreis: 10.05, mwstSatz: 19 }], // Steuer 1,9095 → 1,91
    // Netto 1,01 + 10,05 = 11,06; Steuer 7 %: 0,0707 → 0,07; 19 %: 1,91; Gesamt 13,04
    { brutto: 13.04, steuer: 1.98 });

check('L5: Stornorechnung ist das exakte Spiegelbild (betragssymmetrisch gerundet)', () => {
    const ctx = welt();
    const pos = [{ menge: 1, einzelpreis: 0.025, mwstSatz: 19 }];
    const plus = ctx.RechnungSummen.berechne(pos, false);
    const minus = ctx.RechnungSummen.berechne([{ menge: 1, einzelpreis: -0.025, mwstSatz: 19 }], false);
    assert.strictEqual(minus.brutto, -plus.brutto);
    assert.strictEqual(minus.steuer, -plus.steuer);
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
