// CSV-Kodierung beim Lager- und Verkaeufe-Import: UTF-8 ohne BOM und ANSI (Excel) muessen beide lesbar sein.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ladeModule } = require('./_lade-module');
const XLSX = require('../js/vendor/xlsx.full.min.js');
const ctx = ladeModule(['js/import-kern.js'], { TextDecoder, Uint8Array });
const K = ctx.ImportKern;

const kopf = 'Größe;Gebühr EUR;Käufer\r\nM;1.20;Testkäufer\r\n';
const utf8 = Buffer.from(kopf, 'utf8');
const ansi = Buffer.from(kopf, 'latin1');
const lies = (buf) => {
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    const wb = XLSX.read(ab, { type: 'array', codepage: K.csvCodepage(ab) });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 })[0];
};
assert.strictEqual(K.csvCodepage(utf8), 65001);
assert.strictEqual(K.csvCodepage(ansi), undefined);
assert.deepStrictEqual(lies(utf8), ['Größe', 'Gebühr EUR', 'Käufer']);
assert.deepStrictEqual(lies(ansi), ['Größe', 'Gebühr EUR', 'Käufer']);

// Beide Lager-Dialoge muessen die Erkennung nutzen (keine feste Kodierung).
const page = fs.readFileSync(path.join(__dirname, '..', 'lager', 'page.js'), 'utf8');
const aufrufe = page.match(/XLSX\.read\([^)]*\)/g) || [];
assert.ok(aufrufe.length >= 2, 'XLSX.read-Aufrufe nicht gefunden');
aufrufe.forEach(a => assert.ok(a.includes('ImportKern.csvCodepage'), 'ohne Kodierungserkennung: ' + a));
console.log('OK test-import-csv-kodierung');
