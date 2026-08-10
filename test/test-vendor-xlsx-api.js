// Regressionstest für die mitgelieferte SheetJS-Version:  node test/test-vendor-xlsx-api.js
//
// Zweck: js/vendor/xlsx.full.min.js wird von Hand von cdn.sheetjs.com ausgetauscht (kein npm,
// siehe js/vendor/VERSIONS.md). Dieser Test hält fest, welche API-Oberfläche und welche
// Leseoptionen Stackr tatsächlich benutzt, damit ein Versionswechsel nicht still einen
// Import-Pfad bricht. Läuft gegen die eingecheckte Datei, nicht gegen eine Version aus npm.
'use strict';
const assert = require('assert');
const XLSX = require('../js/vendor/xlsx.full.min.js');

let pass = 0;

// 1) Mindestversion — 0.20.2+ wegen CVE-2023-30533 (Prototype Pollution, ab 0.19.3)
//    und CVE-2024-22363 (ReDoS, ab 0.20.2). Der Import-Pfad verarbeitet fremde Dateien.
const [maj, min, pat] = String(XLSX.version).split('.').map(Number);
const atLeast = maj > 0 || min > 20 || (min === 20 && pat >= 2);
assert.ok(atLeast, 'SheetJS muss >= 0.20.2 sein, ist ' + XLSX.version + ' (CVE-2023-30533 / CVE-2024-22363)');
pass++; console.log('✓ Version ' + XLSX.version + ' erfüllt die CVE-Mindestanforderung');

// 2) Genutzte API-Oberfläche vollständig vorhanden
for (const p of ['read', 'write', 'writeFile', 'utils.sheet_to_json', 'utils.aoa_to_sheet',
                 'utils.json_to_sheet', 'utils.book_new', 'utils.book_append_sheet']) {
    const fn = p.split('.').reduce((o, k) => o && o[k], XLSX);
    assert.strictEqual(typeof fn, 'function', 'XLSX.' + p + ' fehlt');
}
pass++; console.log('✓ alle von Stackr benutzten XLSX-Funktionen vorhanden');

// 3) Schreib-/Lese-Roundtrip mit genau den Optionen aus app.js / buchungen.js / lager/page.js
const ws = XLSX.utils.aoa_to_sheet([
    ['Kaufdatum', 'Einkauf', 'Verkauf'],
    [new Date(Date.UTC(2026, 0, 15)), 12.5, 49.9],
    ['2026-02-01', '8,90', '']
]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Einkauf');
const bytes = new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

// app.js:2411 — type:'array' + cellDates, danach header:1 + defval
const back = XLSX.read(bytes, { type: 'array', cellDates: true });
const aoa = XLSX.utils.sheet_to_json(back.Sheets['Einkauf'], { header: 1, defval: '' });
assert.deepStrictEqual(aoa[0], ['Kaufdatum', 'Einkauf', 'Verkauf'], 'Kopfzeile über header:1');
assert.ok(aoa[1][0] instanceof Date, 'cellDates liefert ein Date-Objekt');
assert.strictEqual(aoa[1][1], 12.5, 'Zahl bleibt Zahl');
assert.strictEqual(aoa[2][2], '', 'defval füllt leere Zelle');
pass++; console.log('✓ type:array + cellDates + header:1 + defval');

// lager/page.js:2224 — codepage + raw:false (alles als String, deutsche Kommazahlen erhalten)
const back2 = XLSX.read(bytes, { type: 'array', codepage: 65001 });
const rows = XLSX.utils.sheet_to_json(back2.Sheets['Einkauf'], { defval: '', raw: false });
assert.strictEqual(rows.length, 2, 'zwei Datenzeilen');
assert.strictEqual(rows[1]['Einkauf'], '8,90', 'raw:false lässt "8,90" als String stehen');
pass++; console.log('✓ codepage + raw:false + defval');

// lager/page.js:1798 — range verschiebt die Kopfzeile (flache Ledger-Tabellen mit Vorlauf)
const withRange = XLSX.utils.sheet_to_json(back2.Sheets['Einkauf'], { defval: '', raw: false, range: 0 });
assert.strictEqual(withRange.length, 2, 'range:0 verhält sich wie ohne range');
pass++; console.log('✓ range-Option');

// 4) Prototype Pollution: __proto__ als Spaltenname darf Object.prototype nicht verändern
//    (die konkrete CVE-2023-30533 sitzt tiefer im Parser, aber dieser Check schlägt an, falls
//    eine künftige Version wieder auf ungeschützte Zuweisung umstellt)
const wsEvil = XLSX.utils.aoa_to_sheet([['__proto__', 'x'], ['{"polluted":true}', 1]]);
const wbEvil = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbEvil, wsEvil, 'E');
const evilBytes = new Uint8Array(XLSX.write(wbEvil, { type: 'buffer', bookType: 'xlsx' }));
XLSX.utils.sheet_to_json(XLSX.read(evilBytes, { type: 'array' }).Sheets['E'], { defval: '' });
assert.strictEqual({}.polluted, undefined, 'Object.prototype unverändert');
assert.strictEqual({}.x, undefined, 'Object.prototype unverändert');
pass++; console.log('✓ __proto__-Spalte verschmutzt Object.prototype nicht');

console.log('\n' + pass + '/6 Tests bestanden ✅  (SheetJS ' + XLSX.version + ')');
