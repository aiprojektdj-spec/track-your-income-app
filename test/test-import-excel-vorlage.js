// js/import-excel-vorlage.js: Excel-Vorlage (Blaetter Einkaeufe/Verkaeufe/Ausgaben + flache Einzeltabelle).
// Kopfzeilen-Pruefung, Zeilenpruefung mit Blatt-Zeilennummer, Periodensperre, Dubletten (Einkauf/Verkauf), Anlage.
// Erfundene Beispieldaten.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');
const ctx = ladeModule(['js/import-kern.js', 'js/import-lager.js', 'js/import-excel-vorlage.js']);
const X = ctx.ExcelVorlageImport;

let fail = 0;
function check(name, fn) {
    try { fn(); console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.stack)); }
}
const arr = (a) => Array.from(a);
const kopf = (art) => arr(X.SPALTEN[art].map(s => s.titel));
const HEUTE = '2026-11-26';
const OPT = (extra) => Object.assign({ heute: HEUTE, gesperrt: () => false }, extra);

const EK = (o) => { const r = ['2026-03-05', 'Nike', 'Schuhe', '42', 'Air Max', '80', '1', 'Privatkauf', '']; Object.assign(r, o || {}); return r; };
const VK = (o) => { const r = ['2026-03-10', 'Nike', 'Schuhe', '42', 'Air Max', '150', '4,99', '5', '3', 'Vinted', 'Max', '', '']; Object.assign(r, o || {}); return r; };
const AU = (o) => { const r = ['2026-03-07', 'Versandmaterial', 'Bubble-Wrap', '12,99', 'Amazon', '']; Object.assign(r, o || {}); return r; };

check('Kopfzeile: Vorlage passt, fremde Datei nicht', () => {
    assert.strictEqual(X.pruefeKopfzeile([kopf('einkauf')], 'einkauf').ok, true);
    assert.strictEqual(X.pruefeKopfzeile([kopf('verkauf').slice(0, 12)], 'verkauf').ok, true);   // ohne EUR-Spalte (alt)
    assert.strictEqual(X.pruefeKopfzeile([['Was', 'Datum', 'Preis']], 'einkauf').ok, false);
});

check('Normalfall Einkauf/Verkauf/Ausgabe: Felder wie bisher', () => {
    const e = X.einkaeufe([kopf('einkauf'), EK({ 5: '1.234,56', 6: '2' })], OPT());
    assert.strictEqual(e.fehler.length, 0);
    const p = e.zeilen[0].purchase;
    assert.strictEqual(p.datum, '2026-03-05');
    assert.strictEqual(p.einkaufspreis, 1234.56);
    assert.strictEqual(p.anzahl, 2);
    assert.strictEqual(p.status, 'verfuegbar');
    assert.strictEqual(e.zeilen[0].zeile, 2);

    const v = X.verkaeufe([kopf('verkauf'), VK()], OPT());
    assert.strictEqual(v.fehler.length, 0);
    const s = v.zeilen[0].sale;
    assert.strictEqual(s.verkaufspreis, 150);
    assert.strictEqual(s.versandkostenKaeufer, 4.99);
    assert.strictEqual(s.plattformgebuehrProzent, 5);
    assert.strictEqual(s.verkaufsplattform, 'Vinted');

    // EUR-Gebuehr (r[12]) nur ohne Prozent: 7,74 € auf 150 + 4,99 = 4,99 %
    const v2 = X.verkaeufe([kopf('verkauf'), VK({ 7: '', 12: '7,74' })], OPT());
    assert.strictEqual(v2.zeilen[0].sale.plattformgebuehrProzent, 4.99);

    const a = X.ausgaben([kopf('ausgaben'), AU()], OPT());
    assert.strictEqual(a.fehler.length, 0);
    assert.strictEqual(a.zeilen[0].expense.betrag, 12.99);
    assert.strictEqual(a.zeilen[0].expense.plattform, 'Amazon');
});

check('Leeres Datum = heute (wie bisher), ungueltiges Datum = Fehler', () => {
    const e = X.einkaeufe([kopf('einkauf'), EK({ 0: '' }), EK({ 0: '31.02.2026' })], OPT());
    assert.strictEqual(e.zeilen[0].purchase.datum, HEUTE);
    assert.strictEqual(e.fehler.length, 1);
    assert.strictEqual(e.fehler[0].zeile, 3);
    assert.ok(/Datum ungültig/.test(e.fehler[0].grund));
});

check('Excel-Datum (Date-Objekt aus cellDates) wird lokal uebernommen', () => {
    const e = X.einkaeufe([kopf('einkauf'), EK({ 0: new Date(2026, 2, 5) })], OPT());
    assert.strictEqual(e.zeilen[0].purchase.datum, '2026-03-05');
});

check('Gesperrte Periode: Zeile uebersprungen mit Grund und Blatt-Zeilennummer', () => {
    const gesperrt = d => d.startsWith('2026-03');
    const e = X.einkaeufe([kopf('einkauf'), EK({ 0: '2026-04-01' }), EK()], OPT({ gesperrt }));
    assert.strictEqual(e.zeilen.length, 1);
    assert.deepStrictEqual(arr(e.fehler.map(f => f.zeile)), [3]);
    assert.ok(/^Periode festgeschrieben/.test(e.fehler[0].grund));
    const v = X.verkaeufe([kopf('verkauf'), VK()], OPT({ gesperrt }));
    assert.ok(/^Periode festgeschrieben \(Verkaufsdatum 2026-03-10\)/.test(v.fehler[0].grund));
    const a = X.ausgaben([kopf('ausgaben'), AU()], OPT({ gesperrt }));
    assert.ok(/^Periode festgeschrieben/.test(a.fehler[0].grund));
});

check('Fehlerhafte Zeilen mit Zeilennummer; Leerzeilen still, zaehlen aber mit', () => {
    const leer = ['', '', '', '', '', '', '', '', ''];
    const rows = [kopf('einkauf'), EK({ 1: '', 4: '' }), leer, EK({ 5: 'abc' }), EK({ 5: '-3' }), EK({ 5: '' }), EK()];
    const e = X.einkaeufe(rows, OPT());
    assert.deepStrictEqual(arr(e.fehler.map(f => f.zeile)), [2, 4, 5, 6]);
    const g = arr(e.fehler.map(f => f.grund));
    assert.ok(/Marke und Beschreibung fehlen/.test(g[0]) && /EK-Preis fehlt/.test(g[1]) && /negativ/.test(g[2]) && /EK-Preis fehlt/.test(g[3]));
    assert.strictEqual(e.zeilen.length, 1);
    assert.strictEqual(e.zeilen[0].zeile, 7);
    // Blatt beginnt tiefer (startZeile = Kopfzeile in der Datei)
    assert.strictEqual(X.einkaeufe([kopf('einkauf'), EK({ 5: 'x' })], OPT({ startZeile: 4 })).fehler[0].zeile, 5);
});

check('Verkauf: Preis 0 und negativer Versand sind Fehler; Ausgabe: Betrag 0 ist Fehler', () => {
    const v = X.verkaeufe([kopf('verkauf'), VK({ 5: '0' }), VK({ 6: '-1' })], OPT());
    assert.ok(/Verkaufspreis/.test(v.fehler[0].grund) && /Versand-Käufer/.test(v.fehler[1].grund));
    const a = X.ausgaben([kopf('ausgaben'), AU({ 3: '0' }), AU({ 3: 'x' })], OPT());
    assert.ok(/größer 0/.test(a.fehler[0].grund) && /Betrag fehlt/.test(a.fehler[1].grund));
});

check('Dubletten Einkauf (fpEinkauf) und Verkauf (fpVerkauf); Ausgaben ohne Dublettenpruefung', () => {
    const purchases = [{ id: 'p1', datum: '2026-03-05', marke: 'nike', beschreibung: 'air max', groesse: '42', einkaufspreis: 80 }];
    const e = X.einkaeufe([kopf('einkauf'), EK(), EK()], OPT({ purchases }));
    assert.deepStrictEqual(arr(e.zeilen.map(z => z.dublette)), [true, false]);
    assert.strictEqual(e.zeilen[0].importieren, false);
    const sales = [{ datum: '2026-03-10', verkaufspreis: 150, beschreibung: 'Air Max', verkaufsplattform: 'Vinted' }];
    const v = X.verkaeufe([kopf('verkauf'), VK(), VK({ 9: 'eBay' })], OPT({ sales }));
    assert.deepStrictEqual(arr(v.zeilen.map(z => z.dublette)), [true, false]);
    const a = X.ausgaben([kopf('ausgaben'), AU()], OPT());
    assert.strictEqual(a.zeilen[0].dublette, false);
});

check('Flache Tabelle: Kopf irgendwo, Einkauf + Verkauf, Sperre ueber Kauf- ODER Verkaufsdatum', () => {
    const rows = [['Meine Liste'], ['Kaufdatum', 'Was', 'Einkauf', 'Wo', 'Verkauf', 'Wo2', 'Verkaufsdatum'],
        ['2026-01-02', 'Jacke', '10', 'Flohmarkt', '25', 'Vinted', '2026-03-03'],
        ['2026-01-03', 'Hose', '5', 'Flohmarkt', '', '', ''],
        ['', 'Summe', '15', '', '', '', ''],
        ['2026-04-01', 'Mantel', '9', '', '20', '', '']];
    const f = X.flach(rows, OPT());
    assert.strictEqual(f.zeilen.length, 3);
    assert.strictEqual(f.zeilen[0].zeile, 3);
    assert.strictEqual(f.zeilen[0].sale.datum, '2026-03-03');
    assert.strictEqual(f.zeilen[1].sale, null);
    assert.ok(/Kaufdatum übernommen/.test(f.zeilen[2].sale.notizen));
    const g = X.flach(rows, OPT({ gesperrt: d => d.startsWith('2026-03') }));
    assert.deepStrictEqual(arr(g.fehler.map(x => x.zeile)), [3]);
    assert.ok(/Verkaufsdatum 2026-03-03/.test(g.fehler[0].grund));
    assert.strictEqual(X.flach([['a', 'b']], OPT()), null);
});

check('anlegen: nur ausgewaehlte Zeilen, Stammdaten + Store-Aufrufe, Zaehler; flach verknuepft den Verkauf', () => {
    const log = [];
    let id = 0;
    const store = {
        addBrand: b => log.push('brand:' + b), addEinkaufsquelle: q => log.push('quelle:' + q), addPlatform: p => log.push('pf:' + p),
        savePurchase: p => { p.id = 'p' + (++id); log.push('ek'); return p; },
        saveSale: s => { log.push('vk:' + (s.purchaseId || '')); s.id = 's' + (++id); return s; },
        saveExpense: x => { log.push('au'); x.id = 'a' + (++id); return x; }
    };
    const e = X.einkaeufe([kopf('einkauf'), EK(), EK({ 4: 'Anderes' })], OPT());
    e.zeilen[1].importieren = false;
    const v = X.verkaeufe([kopf('verkauf'), VK()], OPT());
    const a = X.ausgaben([kopf('ausgaben'), AU()], OPT());
    const f = X.flach([['Kaufdatum', 'Was', 'Einkauf', 'Verkauf'], ['2026-01-02', 'Jacke', '10', '25']], OPT());
    const n = X.anlegen([{ blatt: 'Einkäufe', erg: e }, { blatt: 'Verkäufe', erg: v }, { blatt: 'Ausgaben', erg: a }, { blatt: 'Tabelle1', erg: f }], store);
    assert.deepStrictEqual(Object.assign({}, n), { einkauf: 2, verkauf: 2, ausgaben: 1 });
    assert.ok(log.indexOf('brand:Nike') > -1 && log.indexOf('pf:Vinted') > -1);
    assert.ok(/^vk:p\d+$/.test(log[log.length - 1]), 'flacher Verkauf nicht verknuepft: ' + log[log.length - 1]);
    assert.strictEqual(f.zeilen[0].purchase.id, undefined);   // Vorschau-Objekt bleibt unangetastet
});

check('bericht: Blattname vor Grund und Label, nicht ausgewaehlte Dubletten gelistet', () => {
    const purchases = [{ id: 'p1', datum: '2026-03-05', marke: 'Nike', beschreibung: 'Air Max', groesse: '42', einkaufspreis: 80 }];
    const e = X.einkaeufe([kopf('einkauf'), EK(), EK({ 5: 'x' })], OPT({ purchases }));
    const a = X.ausgaben([kopf('ausgaben'), AU({ 3: '0' })], OPT());
    const b = X.bericht([{ blatt: 'Einkäufe', erg: e }, { blatt: 'Ausgaben', erg: a }]);
    const liste = arr(ctx.LagerImport.nichtImportiert(b).map(x => x.grund));
    assert.ok(liste.some(g => /^Einkäufe: EK-Preis/.test(g)));
    assert.ok(liste.some(g => /^Ausgaben: Betrag/.test(g)));
    assert.ok(liste.some(g => /^Dublette: bereits vorhanden \(Einkäufe: /.test(g)));
    assert.ok(/import-fehler|imp-fehlerdatei/.test(ctx.LagerImport.berichtHtml(b, 'x')));
    assert.ok(/^﻿Zeile;Grund\r\n2;Einkäufe/.test(ctx.ImportKern.fehlerCsv([{ zeile: 2, grund: 'Einkäufe: x' }])));
});

if (fail) { console.log('\n' + fail + ' Test(s) fehlgeschlagen'); process.exit(1); }
console.log('\nalle Tests gruen');
