// Self-Test:  node test/test-gzip-kompression.js
// Prueft die gzip-Kompression vor dem Verschluesseln (2026-10-06):
//   - Krypto-Worker: komprimiert nur mit msg.gzip, erkennt beim Entschluesseln beide Formate
//   - Cloud-Sync-Fallback ohne Worker liest Worker-Chiffrat mit gzip
//   - Cloud-Sync schreibt vor dem Stichtag GZIP_WRITE_FROM noch unkomprimiert
//   - Backup v2 (gzip) Rundlauf, v1 ohne CompressionStream weiter les- und schreibbar
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path'), vm = require('vm');

const ls = new Map();
global.localStorage = {
    get length() { return ls.size; },
    key: (i) => Array.from(ls.keys())[i] ?? null,
    getItem: (k) => (ls.has(k) ? ls.get(k) : null),
    setItem: (k, v) => { ls.set(k, String(v)); },
    removeItem: (k) => { ls.delete(k); }
};
global.document = { readyState: 'complete', getElementById: () => null, addEventListener: () => {} };
global.window = {};
global.Store = {
    _cache: {}, _EIGENBELEG_KEYS: [],
    _idbPutAsync: (k, v) => { Store._cache[k] = v; return Promise.resolve(); },
    _calcChecksum: (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return String(h); }
};
ls.set('whop_user', JSON.stringify({ id: 'user_a' }));

// Worker in self-Umgebung laden (wie test-crypto-worker.js), diesmal mit Streams
const selfObj = {
    crypto: globalThis.crypto, btoa, atob, postMessage: null, onmessage: null,
    CompressionStream, DecompressionStream, Response, Blob
};
const sandbox = { self: selfObj, TextEncoder, TextDecoder, Uint8Array, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'crypto-worker.js'), 'utf8'), sandbox);
const ruf = (msg) => new Promise((r) => { selfObj.postMessage = r; selfObj.onmessage({ data: Object.assign({ id: 'x' }, msg) }); });

const CS = require('../js/cloud-sync.js')._test;
const BC = require('../js/backup-crypto.js')._test;

(async () => {
    let pass = 0;
    const roh = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const key = await crypto.subtle.importKey('raw', roh, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    const aad = new TextEncoder().encode('user_a|firma1|sync-v1');
    const daten = { v: 1, keys: { purchases: Array.from({ length: 300 }, (_, i) => ({ id: 'p' + i, marke: 'Nike', preis: 79.9 })) }, meta: {} };
    const json = JSON.stringify(daten);

    // 1) Worker: gzip-Chiffrat deutlich kleiner, Rundlauf ok
    const roh1 = await ruf({ op: 'encrypt', json, key, aad });
    const gz1  = await ruf({ op: 'encrypt', json, key, aad, gzip: true });
    assert.ok(roh1.ok && gz1.ok);
    assert.ok(gz1.ct.length < roh1.ct.length * 0.3, 'gzip spart > 70 % (' + gz1.ct.length + ' vs ' + roh1.ct.length + ')');
    assert.strictEqual((await ruf({ op: 'decrypt', ct: gz1.ct, iv: gz1.iv, key, aad })).json, json);
    assert.strictEqual((await ruf({ op: 'decrypt', ct: roh1.ct, iv: roh1.iv, key, aad })).json, json);
    pass++; console.log('✓ Worker: gzip-Rundlauf, unkomprimiertes Alt-Chiffrat weiter lesbar');

    // 2) Cloud-Sync-Fallback (kein Worker unter Node) liest Worker-gzip-Chiffrat
    const ctBytes = Uint8Array.from(Buffer.from(gz1.ct, 'base64'));
    const out = await CS.decryptCtTest(ctBytes, gz1.iv, 'firma1', 'user_a', roh);
    assert.deepStrictEqual(out, daten);
    const out2 = await CS.decryptCtTest(Uint8Array.from(Buffer.from(roh1.ct, 'base64')), roh1.iv, 'firma1', 'user_a', roh);
    assert.deepStrictEqual(out2, daten);
    pass++; console.log('✓ Cloud-Sync liest gzip- und Alt-Chiffrat');

    // 3) Stichtag: vor 2026-10-20 wird noch nicht komprimiert geschrieben
    const echtNow = Date.now;
    Date.now = () => Date.parse('2026-10-19T23:59:00Z'); assert.strictEqual(CS.gzipWrite(), false);
    Date.now = () => Date.parse('2026-10-20T00:00:00Z'); assert.strictEqual(CS.gzipWrite(), true);
    Date.now = echtNow;
    pass++; console.log('✓ Schreiben komprimiert erst ab dem Stichtag');

    // 4) Backup v2 Rundlauf
    ls.set('oyi_companies', JSON.stringify(Array.from({ length: 200 }, (_, i) => ({ id: 'c' + i, name: 'Testfirma ' + i, land: 'DE' }))));
    const f2 = await BC.exportFile('pw-test-123');
    assert.strictEqual(f2.version, 2);
    const b2 = await BC.decryptFile(JSON.parse(JSON.stringify(f2)), 'pw-test-123');
    let falsch = false; try { await BC.decryptFile(f2, 'falsch'); } catch (e) { falsch = true; }
    assert.ok(falsch, 'falsche Passphrase scheitert');
    pass++; console.log('✓ Backup v2 (gzip) Rundlauf');

    // 5) Ohne CompressionStream: v1 schreiben, gleiches Bundle, v1 lesbar
    const CSt = global.CompressionStream; delete global.CompressionStream;
    const f1 = await BC.exportFile('pw-test-123');
    global.CompressionStream = CSt;
    assert.strictEqual(f1.version, 1);
    const b1 = await BC.decryptFile(f1, 'pw-test-123');
    assert.deepStrictEqual(b1, b2);
    assert.ok(f2.cipher.ciphertext.length < f1.cipher.ciphertext.length * 0.3, 'Backup v2 spart > 70 % (' + f2.cipher.ciphertext.length + ' vs ' + f1.cipher.ciphertext.length + ')');
    pass++; console.log('✓ Backup v1 weiter les-/schreibbar, gleicher Inhalt wie v2');

    console.log(pass + ' Tests bestanden');
})().catch((e) => { console.error(e); process.exit(1); });
