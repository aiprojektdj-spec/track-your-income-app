// Base64 mit nativem Schnellpfad und Fallback:  node test/test-cloudsync-b64.js
//
// Fund F6 (Performance-Audit 2026-08-10): Das Audit vermutete AES-GCM im Main-Thread als
// Ursache des Hängers und empfahl einen Web Worker. Gemessen ist der teuerste synchrone Posten
// aber die Base64-Umwandlung des Chiffrats (3,5 MB = ~73 ms), weil der chunked Loop einen
// 4,6-MB-Zwischenstring aufbaut; crypto.subtle rechnet in Chromium und Gecko ohnehin auf einem
// Hintergrund-Thread. _b64/_unb64 nehmen deshalb Uint8Array.prototype.toBase64 bzw.
// Uint8Array.fromBase64, wo vorhanden.
//
// Zwei Wege, ein Ergebnis — genau das ist die Bruchstelle: liefern nativer Pfad und Fallback
// unterschiedliche Strings, wird Chiffrat unlesbar und der Sync steht. Dieser Test fährt beide
// Pfade gegen dieselben Eingaben, inklusive der Kanten (leer, 1 Byte, alle 256 Bytewerte,
// Längen mit Padding-Rest).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'cloud-sync.js'), 'utf8');
let pass = 0;
function ok(name) { pass++; console.log('  ok  ' + name); }

// ── 1. Der Schnellpfad steht wirklich im Code, nicht nur im Kommentar ─────────
assert.ok(/function _b64\(bytes\) \{\s*\n\s*if \(typeof bytes\.toBase64 === 'function'\) return bytes\.toBase64\(\);/.test(src),
    '_b64 muss toBase64 zuerst versuchen');
assert.ok(/function _unb64\(str\) \{\s*\n\s*if \(typeof Uint8Array\.fromBase64 === 'function'\) return Uint8Array\.fromBase64\(str\);/.test(src),
    '_unb64 muss fromBase64 zuerst versuchen');
ok('nativer Schnellpfad ist in _b64 und _unb64 verdrahtet');

// Der Fallback muss stehen bleiben: ohne ihn bricht der Sync auf jeder Engine ohne toBase64.
assert.ok(src.includes("String.fromCharCode.apply(null, bytes.subarray(i, i + CH))"), 'chunked Fallback fehlt in _b64');
assert.ok(src.includes('b[i] = bin.charCodeAt(i);'), 'Byte-Loop-Fallback fehlt in _unb64');
ok('Fallback fuer Engines ohne toBase64/fromBase64 ist erhalten');

// ── 2. Beide Pfade liefern byte-identische Ergebnisse ────────────────────────
function b64Fallback(bytes) {
    let s = '', CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return Buffer.from(s, 'binary').toString('base64');   // btoa-Aequivalent in Node
}
function unb64Fallback(str) {
    const bin = Buffer.from(str, 'base64').toString('binary');
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
}
// Referenz statt "nativ, falls vorhanden": Node 24 hat toBase64 noch nicht freigeschaltet, der
// Test soll aber trotzdem etwas beweisen. Buffer ist hier die unabhaengige dritte Implementierung.
const b64Native = (u) => (typeof u.toBase64 === 'function' ? u.toBase64() : Buffer.from(u).toString('base64'));
const unb64Native = (s) => (typeof Uint8Array.fromBase64 === 'function' ? Uint8Array.fromBase64(s) : new Uint8Array(Buffer.from(s, 'base64')));

const faelle = {
    'leer': new Uint8Array(0),
    'ein Byte': new Uint8Array([0]),
    'zwei Bytes (Padding ==)': new Uint8Array([255, 0]),
    'drei Bytes (kein Padding)': new Uint8Array([1, 2, 3]),
    'alle 256 Bytewerte': Uint8Array.from({ length: 256 }, (_, i) => i),
    'ueber die Chunk-Grenze (0x8000+1)': Uint8Array.from({ length: 0x8000 + 1 }, (_, i) => i % 256),
    'zwei volle Chunks': Uint8Array.from({ length: 0x10000 }, (_, i) => (i * 7) % 256)
};
for (const [name, bytes] of Object.entries(faelle)) {
    const a = b64Fallback(bytes), b = b64Native(bytes);
    assert.strictEqual(a, b, 'kodiert unterschiedlich: ' + name);
    assert.deepStrictEqual(Array.from(unb64Fallback(a)), Array.from(bytes), 'Fallback-Roundtrip kaputt: ' + name);
    assert.deepStrictEqual(Array.from(unb64Native(b)), Array.from(bytes), 'nativer Roundtrip kaputt: ' + name);
}
ok('beide Pfade kodieren identisch und dekodieren verlustfrei (' + Object.keys(faelle).length + ' Faelle)');

// ── 3. Zufallsdaten in Chiffrat-Groesse ──────────────────────────────────────
const gross = new Uint8Array(600 * 1024);
require('crypto').randomFillSync(gross);
assert.strictEqual(b64Fallback(gross), b64Native(gross), 'Zufallsdaten kodieren unterschiedlich');
assert.deepStrictEqual(Array.from(unb64Native(b64Fallback(gross))), Array.from(gross), 'Kreuz-Roundtrip Fallback->nativ kaputt');
assert.deepStrictEqual(Array.from(unb64Fallback(b64Native(gross))), Array.from(gross), 'Kreuz-Roundtrip nativ->Fallback kaputt');
ok('600 KB Zufallsdaten: Kreuz-Roundtrip in beide Richtungen sauber');

console.log('\n' + pass + ' Pruefungen bestanden.');
