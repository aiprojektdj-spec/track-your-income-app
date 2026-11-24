// js/import-ausgaben.js: Ausgaben-CSV (Spalten, Kategorie, USt-Satz, Dubletten, Periodensperre, Anlage).
// Erfundene Beispieldaten. Kategorien und Satz-Normalisierung kommen aus dem ECHTEN js/ausgaben.js.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');
const ctx = ladeModule(['js/import-kern.js', 'js/import-lager.js', 'js/ausgaben.js', 'js/import-ausgaben.js']);
const A = ctx.AusgabenImport, Aus = ctx.Ausgaben;

let fail = 0;
function check(name, fn) {
    try { fn(); console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}
const KOPF = ['Datum', 'Kategorie', 'Beschreibung', 'Betrag', 'USt-Satz', 'Beleg-Nr.', 'Lieferant', 'Notizen'];
const OPT = (extra) => Object.assign({ kategorien: Aus._kategorien, normUstSatz: v => Aus._normUstSatz(v), bestand: [], gesperrt: () => false }, extra);
const z = (o) => { const r = ['2026-03-05', 'Versand', 'Paketmarken', '23,80', '19', 'RE-1', 'Beispiel Post GmbH', '']; Object.keys(o).forEach(k => { r[KOPF.indexOf(k)] = o[k]; }); return r; };
const grunde = (e) => Array.from(e.fehler.map(f => f.grund));

check('Normalfall: Brutto-Betrag, Satz, Kategorie kanonisch, Zusatzfelder', () => {
    const e = A.zeilen([KOPF, z({ Kategorie: 'versand', Betrag: '1.234,56 €', Notizen: 'Test' })], OPT());
    assert.strictEqual(e.fehler.length, 0);
    const r = e.zeilen[0].row;
    assert.strictEqual(r.kategorie, 'Versand');
    assert.strictEqual(r.betrag, 1234.56);
    assert.strictEqual(r.ustSatz, 19);
    assert.strictEqual(r.belegNr, 'RE-1');
    assert.strictEqual(r.lieferant, 'Beispiel Post GmbH');
    assert.strictEqual(r.notizen, 'Test');
    assert.strictEqual(r.datum, '2026-03-05');
});

check('Vorlage ist selbst importierbar (Beispielzeile) und Export-Kopf wird erkannt', () => {
    const e = A.zeilen(A.vorlageZeilen(), OPT());
    assert.strictEqual(e.fehler.length, 0);
    assert.strictEqual(e.zeilen.length, 1);
    const exportKopf = ['Datum', 'Kategorie', 'Beschreibung', 'Betrag', 'USt-Satz', 'Beleg-Nr.'];
    assert.strictEqual(A.zeilen([exportKopf, ['2026-03-05', 'Büro', 'Papier', '5.00', '19', 'X1']], OPT()).zeilen.length, 1);
});

check('Pflichtspalte fehlt: kopfFehler, keine Zeilen', () => {
    const e = A.zeilen([['Datum', 'Beschreibung'], ['2026-03-05', 'x']], OPT());
    assert.strictEqual(e.zeilen.length, 0);
    assert.strictEqual(e.kopfFehler.length, 2);
});

check('Fehlerfaelle mit Zeilennummer und Grund', () => {
    const rows = [KOPF, z({ Datum: '31.02.2026' }), z({ Kategorie: '' }), z({ Kategorie: 'Kaffeekasse' }), z({ Betrag: 'abc' }), z({ Betrag: '0' }),
        z({ 'USt-Satz': '16' }), z({ 'USt-Satz': 'abc' }), z({ Kategorie: 'Geschenke an Geschäftsfreunde' }), z({ Kategorie: 'Umsatzsteuer an Finanzamt' }), z({})];
    const e = A.zeilen(rows, OPT({ nummern: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 14] }));
    assert.deepStrictEqual(Array.from(e.fehler.map(f => f.zeile)), [2, 3, 4, 6, 7, 8, 9, 10, 11]);
    const g = grunde(e);
    assert.ok(/Datum/.test(g[0]) && /Kategorie fehlt/.test(g[1]) && /Unbekannte Kategorie „Kaffeekasse“/.test(g[2]));
    assert.ok(/Betrag fehlt/.test(g[3]) && /größer 0/.test(g[4]));
    assert.ok(/Unzulässiger USt-Satz „16“/.test(g[5]) && /Unzulässiger USt-Satz „abc“/.test(g[6]));
    assert.ok(/Empfänger/.test(g[7]) && /Umsatzsteuer/.test(g[8]));
    assert.strictEqual(e.zeilen.length, 1);
    assert.strictEqual(e.zeilen[0].zeile, 14);
});

check('USt-Satz: 19/7/0 auch mit %, rc, leer = unklar (nie 19)', () => {
    const satz = (s) => A.zeilen([KOPF, z({ 'USt-Satz': s })], OPT()).zeilen[0].row.ustSatz;
    assert.strictEqual(satz('7 %'), 7);
    assert.strictEqual(satz('0'), 0);
    assert.strictEqual(satz('7,0'), 7);
    assert.strictEqual(satz('RC'), 'rc');
    assert.strictEqual(satz('Reverse Charge'), 'rc');
    assert.strictEqual(satz(''), 'unklar');
    assert.strictEqual(satz('unklar'), 'unklar');
});

check('Periode festgeschrieben: uebersprungen', () => {
    const e = A.zeilen([KOPF, z({})], OPT({ gesperrt: d => d.startsWith('2026-03') }));
    assert.strictEqual(e.zeilen.length, 0);
    assert.ok(/Periode festgeschrieben/.test(e.fehler[0].grund));
});

check('Dublette ueber Beleg-Nr. (auch bei anderem Betrag); storniert zaehlt nicht', () => {
    const best = [{ datum: '2026-01-01', betrag: 99, belegNr: 're-1' }];
    let e = A.zeilen([KOPF, z({})], OPT({ bestand: best }));
    assert.strictEqual(e.zeilen[0].dublette, true);
    assert.strictEqual(e.zeilen[0].importieren, false);
    e = A.zeilen([KOPF, z({})], OPT({ bestand: [Object.assign({ storniert: true }, best[0])] }));
    assert.strictEqual(e.zeilen[0].dublette, false);
});

check('Dublette ohne Beleg-Nr.: Datum|Betrag-Cent|Beschreibung|Lieferant; #n bei gleichen Zeilen in der Datei', () => {
    const best = [{ datum: '2026-03-05', betrag: 23.8, beschreibung: 'paketmarken', lieferant: 'Beispiel Post GmbH' }];
    const zeile = z({ 'Beleg-Nr.': '' });
    const e = A.zeilen([KOPF, zeile, zeile, z({ 'Beleg-Nr.': '', Betrag: '23,81' })], OPT({ bestand: best }));
    assert.deepStrictEqual(Array.from(e.zeilen.map(x => x.dublette)), [true, false, false]);
    assert.notStrictEqual(e.zeilen[0].key, e.zeilen[1].key);
});

check('Leerzeile wird uebergangen, Dateizeilen bleiben richtig', () => {
    const e = A.zeilen([KOPF, ['', '', '', '', '', '', '', ''], z({ Betrag: 'x' })], OPT());
    assert.strictEqual(e.zeilen.length, 0);
    assert.strictEqual(e.fehler[0].zeile, 3);
});

check('anlegen: nur ausgewaehlte Zeilen ueber saveExpense; Reimport mit Bestand = nichts Neues', () => {
    const gespeichert = [];
    const store = { saveExpense: x => { x.id = 'id' + gespeichert.length; gespeichert.push(x); return x; } };
    const e = A.zeilen([KOPF, z({}), z({ 'Beleg-Nr.': 'RE-2' })], OPT());
    e.zeilen[1].importieren = false;
    assert.strictEqual(A.anlegen(e, store), 1);
    assert.strictEqual(gespeichert[0].belegNr, 'RE-1');
    const again = A.zeilen([KOPF, z({}), z({ 'Beleg-Nr.': 'RE-2' })], OPT({ bestand: gespeichert }));
    assert.deepStrictEqual(Array.from(again.zeilen.map(x => x.dublette)), [true, false]);
});

if (fail) { console.log('\n' + fail + ' Test(s) fehlgeschlagen'); process.exit(1); }
console.log('\nalle Tests gruen');
