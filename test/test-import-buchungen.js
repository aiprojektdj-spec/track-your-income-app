// js/import-buchungen.js: Einkaufs-CSV im Buchungen-Dialog (Zahlen, Datum, Dubletten, Periodensperre).
// Erfundene Beispieldaten. Echter Code: js/import-kern.js + js/import-lager.js + js/import-buchungen.js.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');
const ctx = ladeModule(['js/import-kern.js', 'js/import-lager.js', 'js/import-buchungen.js']);
const B = ctx.BuchungenImport;

let fail = 0;
function check(name, fn) {
    try { fn(); console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}

// Spaltenindex wie in der alten Vorlage: Datum, Marke, Artikeltyp, Größe, Beschreibung, Einkaufspreis, Anzahl, Einkaufsquelle, Notizen
const MAP = { datum: 0, marke: 1, artikeltyp: 2, groesse: 3, beschreibung: 4, einkaufspreis: 5, anzahl: 6, einkaufsquelle: 7, notizen: 8 };
const alt = ['2026-04-08', 'Nike', 'Schuhe', '42', 'Air Max 90', '80.00', '1', 'Privatkauf', ''];   // Zeile der alten Vorlage

check('alte Vorlage bleibt importierbar (ISO-Datum, Punkt-Dezimal)', () => {
    const e = B.einkaufsZeilen([alt], MAP, {});
    assert.strictEqual(e.fehler.length, 0);
    const r = e.zeilen[0].row;
    assert.strictEqual(r.datum, '2026-04-08');
    assert.strictEqual(r.einkaufspreis, 80);
    assert.strictEqual(r.marke, 'Nike');
    assert.strictEqual(r.anzahl, 1);
    assert.strictEqual(r.status, 'verfuegbar');
    assert.strictEqual(e.zeilen[0].importieren, true);
});

check('Tausendertrenner und deutsches Datum', () => {
    const e = B.einkaufsZeilen([['08.04.2026', 'Rolex', '', '', 'Uhr', '1.234,56 €', '', '', '']], MAP, {});
    assert.strictEqual(e.zeilen[0].row.einkaufspreis, 1234.56);
    assert.strictEqual(e.zeilen[0].row.datum, '2026-04-08');
});

check('Fehler mit Zeilennummer aus der Datei und Grund', () => {
    const z = (o) => { const r = alt.slice(); Object.keys(o).forEach(k => { r[MAP[k]] = o[k]; }); return r; };
    const rows = [z({ datum: '31.02.2026' }), z({ datum: '' }), z({ einkaufspreis: 'abc' }), z({ einkaufspreis: '-4' }), z({ marke: '', beschreibung: '' }), alt];
    const e = B.einkaufsZeilen(rows, MAP, { nummern: [2, 3, 5, 6, 8, 9] });
    assert.deepStrictEqual(Array.from(e.fehler.map(f => f.zeile)), [2, 3, 5, 6, 8]);
    assert.ok(/Datum/.test(e.fehler[0].grund) && /Datum/.test(e.fehler[1].grund));
    assert.ok(/EK-Preis fehlt/.test(e.fehler[2].grund));
    assert.ok(/negativ/.test(e.fehler[3].grund));
    assert.ok(/Marke und Beschreibung/.test(e.fehler[4].grund));
    assert.strictEqual(e.zeilen.length, 1);
    assert.strictEqual(e.zeilen[0].zeile, 9);
});

check('Leerzeile wird still uebergangen (kein Fehler)', () => {
    const e = B.einkaufsZeilen([['', '', '', '', '', '', '', '', ''], alt], MAP, {});
    assert.strictEqual(e.fehler.length, 0);
    assert.strictEqual(e.zeilen.length, 1);
});

check('Periode festgeschrieben: uebersprungen mit Grund', () => {
    const e = B.einkaufsZeilen([alt], MAP, { gesperrt: d => d.startsWith('2026-04') });
    assert.strictEqual(e.zeilen.length, 0);
    assert.ok(/Periode festgeschrieben/.test(e.fehler[0].grund));
});

check('Dublette gegen Bestand: vorab abgewaehlt; stornierter Bestand zaehlt nicht', () => {
    const bestand = [{ datum: '2026-04-08', marke: 'Nike', beschreibung: 'Air Max 90', groesse: '42', einkaufspreis: 80 }];
    let e = B.einkaufsZeilen([alt], MAP, { bestand });
    assert.strictEqual(e.zeilen[0].dublette, true);
    assert.strictEqual(e.zeilen[0].importieren, false);
    e = B.einkaufsZeilen([alt], MAP, { bestand: [Object.assign({ storniert: true }, bestand[0])] });
    assert.strictEqual(e.zeilen[0].dublette, false);
});

check('gleiche Zeile zweimal in der Datei: Bestand mit einem Treffer -> nur die zweite ist neu', () => {
    const bestand = [{ datum: '2026-04-08', marke: 'Nike', beschreibung: 'Air Max 90', groesse: '42', einkaufspreis: 80 }];
    const e = B.einkaufsZeilen([alt, alt], MAP, { bestand });
    assert.deepStrictEqual(Array.from(e.zeilen.map(z => z.dublette)), [true, false]);
    assert.notStrictEqual(e.zeilen[0].key, e.zeilen[1].key);
});

check('Anzahl > 1 bleibt ein Datensatz und bleibt beim Reimport erkennbar', () => {
    const r3 = alt.slice(); r3[MAP.anzahl] = '3';
    const e = B.einkaufsZeilen([r3], MAP, {});
    assert.strictEqual(e.zeilen[0].row.anzahl, 3);
    const bestand = [Object.assign({}, e.zeilen[0].row)];
    assert.strictEqual(B.einkaufsZeilen([r3], MAP, { bestand }).zeilen[0].dublette, true);
});

check('nur gemappte Felder landen im Datensatz', () => {
    const e = B.einkaufsZeilen([['2026-04-08', 'Nike', '60']], { datum: 0, marke: 1, einkaufspreis: 2 }, {});
    const r = e.zeilen[0].row;
    assert.strictEqual(r.beschreibung, undefined);
    assert.strictEqual(r.anzahl, undefined);
    assert.strictEqual(r.einkaufspreis, 60);
});

if (fail) { console.log('\n' + fail + ' Test(s) fehlgeschlagen'); process.exit(1); }
console.log('\nalle Tests gruen');
