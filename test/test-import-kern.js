// js/import-kern.js: Zahl-/Datumsparser, Schluessel mit Laufnummer, Fehlerdatei.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');
const { ImportKern: K } = ladeModule(['js/import-kern.js']);

let fail = 0;
function check(name, fn) {
    try { fn(); console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}

check('zahl: DE mit Tausenderpunkt', () => assert.strictEqual(K.zahl('1.234,56'), 1234.56));
check('zahl: EN mit Tausenderkomma', () => assert.strictEqual(K.zahl('1,234.56'), 1234.56));
check('zahl: Komma-Dezimal und Waehrung', () => assert.strictEqual(K.zahl('12,50 €'), 12.5));
check('zahl: Punkt-Dezimal', () => assert.strictEqual(K.zahl('12.5'), 12.5));
check('zahl: negativ', () => assert.strictEqual(K.zahl('-3,20'), -3.2));
check('zahl: Zahl bleibt Zahl', () => assert.strictEqual(K.zahl(7.25), 7.25));
check('zahl: leer/ungueltig -> 0, mit Fallback null', () => {
    assert.strictEqual(K.zahl(''), 0); assert.strictEqual(K.zahl(null), 0); assert.strictEqual(K.zahl('abc'), 0);
    assert.strictEqual(K.zahl('abc', null), null); assert.strictEqual(K.zahl(NaN, null), null);
});

check('datum: ISO', () => assert.strictEqual(K.datum('2026-11-24'), '2026-11-24'));
check('datum: ISO mit Uhrzeit', () => assert.strictEqual(K.datum('2026-11-24T10:00:00Z'), '2026-11-24'));
check('datum: TT.MM.JJJJ', () => assert.strictEqual(K.datum('4.3.2026'), '2026-03-04'));
check('datum: TT/MM/JJJJ', () => assert.strictEqual(K.datum('24/11/2026'), '2026-11-24'));
check('datum: 13/x ist zwingend der Tag, 12/13 ebenso', () => {
    assert.strictEqual(K.datum('11/24/2026'), '2026-11-24');
    assert.strictEqual(K.datum('01.02.2026'), '2026-02-01');
});
check('datum: zweistelliges Jahr', () => assert.strictEqual(K.datum('24.11.26'), '2026-11-24'));
check('datum: Excel-Seriennummer', () => assert.strictEqual(K.datum('46164'), '2026-05-22'));
check('datum: Date-Objekt lokal', () => assert.strictEqual(K.datum(new Date(2026, 0, 5, 23, 30)), '2026-01-05'));
check('datum: ungueltig -> null', () => {
    assert.strictEqual(K.datum('31.02.2026'), null); assert.strictEqual(K.datum('morgen'), null);
    assert.strictEqual(K.datum(''), null); assert.strictEqual(K.datum(null), null);
    assert.strictEqual(K.datum('2026-13-01'), null);
});

check('schluessel: Laufnummer bei gleichen Zeilen, Normalisierung', () => {
    const z = {};
    assert.strictEqual(K.schluessel(['2026-01-01', 'Nike ', 1250], z), '2026-01-01|nike|1250#1');
    assert.strictEqual(K.schluessel(['2026-01-01', 'NIKE', 1250], z), '2026-01-01|nike|1250#2');
    assert.strictEqual(K.schluessel(['2026-01-02', 'nike', 1250], z), '2026-01-02|nike|1250#1');
    // frischer Zaehler = gleiche Datei erneut -> gleiche Schluessel
    assert.strictEqual(K.schluessel(['2026-01-01', 'nike', 1250], {}), '2026-01-01|nike|1250#1');
});

check('zeilennummern: Dateizeilen, Leerzeilen mitgezaehlt', () => {
    const aoa = [['Titel'], ['Kopf', 'x'], ['a', 'b'], ['', ''], [], ['c', '']];
    assert.strictEqual(JSON.stringify(K.zeilennummern(aoa, 1)), '[3,6]');
});

check('fingerprint: gleiche Normalisierung wie schluessel', () => {
    assert.strictEqual(K.fingerprint(['A  b', 5]), 'a b|5');
});

check('fehlerCsv: BOM, Semikolon, Quoting', () => {
    const t = K.fehlerCsv([{ zeile: 3, grund: 'Datum fehlt' }, { zeile: 7, grund: 'Titel "a;b"' }]);
    assert.strictEqual(t.charCodeAt(0), 0xFEFF);
    assert.strictEqual(t.slice(1), 'Zeile;Grund\r\n3;Datum fehlt\r\n7;"Titel ""a;b"""\r\n');
    assert.strictEqual(K.fehlerCsv([]).slice(1), 'Zeile;Grund\r\n');
});

if (fail) { console.log(fail + ' fehlgeschlagen'); process.exit(1); }
console.log('alle ok');
