// Test: ZIP-Schreiber (js/zip.js)
//
// Prueft den Store-Modus-Schreiber isoliert im vm-Kontext — ohne Browser.
// Der Schreiber existiert, weil DATEV-Belegexport und der Z3-Export nach §147 Abs. 6 AO
// ein Archiv brauchen und Regel 6 (keine neue Abhaengigkeit) gilt.
//
// Die eigentliche Gegenprobe steht NICHT hier, sondern in test/test-zip-python.py:
// ein ZIP, das nur der eigene Code fuer gueltig haelt, ist wertlos. Dieser Test prueft
// die Struktur, das Python-Skript oeffnet dieselbe Datei mit einer fremden Bibliothek.
//
//   node test/test-zip.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const zlib = require('zlib');

const sandbox = { console, TextEncoder, Buffer, DataView, Uint8Array, ArrayBuffer };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'zip.js'), 'utf8'), sandbox);
const Zip = sandbox.StackrZip;

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log('  OK   ' + name); }
    else      { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
}

console.log('\n--- CRC-32 gegen zlib ---');
// zlib.crc32 gibt es erst ab Node 20.15 — sonst ueber den bekannten Pruefwert.
const probe = Buffer.from('123456789', 'utf8');
const erwartet = 0xCBF43926; // Standard-Pruefwert der CRC-32-Spezifikation
check('CRC-32 von "123456789" ist CBF43926',
    Zip.crc32(new Uint8Array(probe)) === erwartet,
    Zip.crc32(new Uint8Array(probe)).toString(16));
check('CRC-32 von leer ist 0', Zip.crc32(new Uint8Array(0)) === 0);
if (typeof zlib.crc32 === 'function') {
    const txt = Buffer.from('Rechnung RE-2026-001, Betrag 1.234,56 EUR', 'utf8');
    check('CRC-32 stimmt mit zlib.crc32 ueberein',
        Zip.crc32(new Uint8Array(txt)) === zlib.crc32(txt));
}

console.log('\n--- Struktur ---');
const archiv = Zip.build([
    { name: 'index.xml', data: '<?xml version="1.0"?><root/>' },
    { name: 'daten/einkaeufe.csv', data: 'id;datum\n1;2026-01-05\n' },
    { name: 'belege/beleg.bin', data: new Uint8Array([0, 1, 2, 253, 254, 255]) }
]);
check('Archiv beginnt mit dem Local-File-Header PK\\x03\\x04',
    archiv[0] === 0x50 && archiv[1] === 0x4B && archiv[2] === 0x03 && archiv[3] === 0x04);
const eocdSig = archiv.length - 22;
const dv = new DataView(archiv.buffer, archiv.byteOffset, archiv.byteLength);
check('EOCD steht am Ende (kein Archivkommentar)', dv.getUint32(eocdSig, true) === 0x06054B50);
check('EOCD meldet 3 Eintraege', dv.getUint16(eocdSig + 8, true) === 3);
const cdOffset = dv.getUint32(eocdSig + 16, true);
const cdLaenge = dv.getUint32(eocdSig + 12, true);
check('Central Directory beginnt mit PK\\x01\\x02', dv.getUint32(cdOffset, true) === 0x02014B50);
check('Central-Directory-Laenge passt zum Offset', cdOffset + cdLaenge === eocdSig);
check('UTF-8-Flag (Bit 11) im Local Header gesetzt', (dv.getUint16(6, true) & 0x0800) !== 0);
check('Methode ist 0 (store)', dv.getUint16(8, true) === 0);

console.log('\n--- Pfade ---');
check('Backslash wird zu Schraegstrich',
    Zip._saeuberePfad('belege\\2026\\bon.jpg') === 'belege/2026/bon.jpg');
check('fuehrender Schraegstrich faellt weg',
    Zip._saeuberePfad('/etc/passwd') === 'etc/passwd');
check('Zip-Slip wird entschaerft',
    Zip._saeuberePfad('../../../etc/passwd') === 'etc/passwd');
check('Doppelte Trenner werden zusammengefasst',
    Zip._saeuberePfad('a//b///c.txt') === 'a/b/c.txt');

console.log('\n--- Doppelte Namen ---');
const doppelt = Zip.build([
    { name: 'beleg.jpg', data: 'eins' },
    { name: 'beleg.jpg', data: 'zwei' },
    { name: 'beleg.jpg', data: 'drei' }
]);
const alsText = Buffer.from(doppelt).toString('latin1');
check('zweite gleichnamige Datei wird zu beleg_2.jpg', alsText.indexOf('beleg_2.jpg') !== -1);
check('dritte gleichnamige Datei wird zu beleg_3.jpg', alsText.indexOf('beleg_3.jpg') !== -1);

console.log('\n--- Data-URL ---');
const png = Zip.ausDataUrl('data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4E, 0x47]).toString('base64'));
check('PNG-Data-URL ergibt .png', png && png.endung === '.png');
check('PNG-Bytes stimmen', png && png.bytes[0] === 0x89 && png.bytes[1] === 0x50);
const jpg = Zip.ausDataUrl('data:image/jpeg;base64,' + Buffer.from([0xFF, 0xD8, 0xFF]).toString('base64'));
check('JPEG-Data-URL ergibt .jpg', jpg && jpg.endung === '.jpg');
check('Unsinn ergibt null', Zip.ausDataUrl('kein-data-url') === null);

console.log('\n--- Grenzen ---');
let geworfen = false;
try { Zip.build(new Array(70000).fill(0).map((_, i) => ({ name: 'f' + i, data: '' }))); }
catch (e) { geworfen = /ZIP64/.test(e.message); }
check('mehr als 65.535 Dateien werfen statt ein kaputtes Archiv zu liefern', geworfen);
check('leere Liste ergibt ein gueltiges leeres Archiv',
    Zip.build([]).length === 22 && new DataView(Zip.build([]).buffer).getUint32(0, true) === 0x06054B50);

// Archiv fuer die Gegenprobe mit einer fremden Bibliothek ablegen.
const ziel = path.join(__dirname, '..', 'node_modules', '.cache');
try { fs.mkdirSync(ziel, { recursive: true }); } catch (e) {}
const datei = path.join(ziel, 'test-zip-probe.zip');
fs.writeFileSync(datei, Buffer.from(Zip.build([
    { name: 'index.xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<DataSet/>\n' },
    { name: 'daten/einkaeufe.csv', data: 'id;datum;betrag\n1;05.01.2026;1234,56\n' },
    { name: 'belege/Bon Müller & Co.jpg', data: new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]) },
    { name: 'leer.txt', data: '' }
])));
console.log('\nGegenprobe-Archiv geschrieben: ' + datei);
console.log('  -> python test/test-zip-python.py');

console.log('\n' + pass + ' OK, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
