// Ablage des Sync-Schlüssels:  node test/test-sync-key-storage.js
//
// Fund R5 (Red-Team-Audit 2026-08-10): der rohe 256-bit-AES-Schlüssel lag als Base64 in
// localStorage, direkt neben dem Whop-Token. Ein XSS-Treffer hätte damit erlaubt, das Chiffrat
// serverseitig zu ziehen UND offline zu entschlüsseln — die E2E-Zusage fällt komplett.
//
// Geprüft wird die Ablage-Schicht aus js/cloud-sync.js gegen ein In-Memory-IndexedDB. Der
// kritische Punkt ist die MIGRATION: wird der localStorage-Eintrag entfernt, ohne dass die
// IndexedDB-Kopie nachweislich lesbar ist, verliert der Nutzer den Schlüssel — und damit
// unwiederbringlich den Zugang zu seinen Cloud-Daten.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'cloud-sync.js'), 'utf8');

// ── Minimal-IndexedDB (nur get/put/delete auf einen Store) ───────────────────────────────
function makeIdb(opts) {
    const data = new Map();
    const idb = {
        open() {
            const req = {};
            setTimeout(() => {
                if (opts.openFails) { req.error = new Error('open failed'); req.onerror && req.onerror(); return; }
                const db = {
                    createObjectStore() {},
                    transaction() {
                        return { objectStore: () => ({
                            get(k) { const r = {}; setTimeout(() => {
                                if (opts.readReturnsWrong && String(k).endsWith(':raw')) {
                                    r.result = new Uint8Array(32);      // falsche Bytes
                                } else { r.result = data.get(k); }
                                r.onsuccess && r.onsuccess();
                            }, 0); return r; },
                            put(v, k) { const r = {}; if (!opts.writeSilentlyDrops) data.set(k, v); setTimeout(() => r.onsuccess && r.onsuccess(), 0); return r; },
                            delete(k) { const r = {}; data.delete(k); setTimeout(() => r.onsuccess && r.onsuccess(), 0); return r; }
                        }), get oncomplete() { return this._oc; }, set oncomplete(f) { this._oc = f; setTimeout(f, 1); }, set onerror(f) {} };
                    }
                };
                req.result = db; req.onsuccess && req.onsuccess({ target: { result: db } });
            }, 0);
            return req;
        }
    };
    return { idb, data };
}

// ── Ablage-Funktionen aus der Datei schneiden und in einer kontrollierten Umgebung laufen ──
function load(opts) {
    const { idb, data } = makeIdb(opts || {});
    const ls = new Map();
    const parts = [
        /var IDBK_DB = [\s\S]*?function _idbkKey\(uid, what\) \{ return \(uid \|\| _userId\(\)\) \+ ':' \+ what; \}/,
        /async function _keyBytes\(uid\) \{[\s\S]*?\n    \}/,
        /function _hasKey\(uid\) \{[\s\S]*?\n    \}/,
        /async function _storeKey\(uid, bytes\) \{[\s\S]*?\n    \}/,
        /async function _migrateKeyToIdb\(uid\) \{[\s\S]*?\n    \}/
    ].map(re => { const m = src.match(re); assert.ok(m, 'Block nicht gefunden: ' + re); return m[0]; });

    const body = parts.join('\n') + `
        return { keyBytes: _keyBytes, hasKey: _hasKey, storeKey: _storeKey, migrate: _migrateKeyToIdb };
    `;
    const fn = new Function('indexedDB', 'localStorage', '_userId', 'LS_KEY', 'LS_KEY_PRESENT',
                            '_unb64', '_b64', 'console', body);
    const localStorageStub = {
        getItem: (k) => (ls.has(k) ? ls.get(k) : null),
        setItem: (k, v) => ls.set(k, String(v)),
        removeItem: (k) => ls.delete(k)
    };
    const api = fn(opts && opts.noIdb ? undefined : idb, localStorageStub,
                   () => 'user_1',
                   (uid) => 'oyi_sync_key_' + uid,
                   (uid) => 'oyi_sync_keypresent_' + uid,
                   (b64) => Uint8Array.from(Buffer.from(b64, 'base64')),
                   (bytes) => Buffer.from(bytes).toString('base64'),
                   { warn: () => {}, info: () => {}, error: () => {} });
    return { api, ls, data };
}

const KEY = new Uint8Array(32);
for (let i = 0; i < 32; i++) KEY[i] = (i * 7 + 3) & 255;
const b64 = Buffer.from(KEY).toString('base64');

(async () => {
    let pass = 0;

    // 1) Neuer Schlüssel landet in IndexedDB, NICHT in localStorage
    let { api, ls, data } = load({});
    assert.strictEqual(await api.storeKey('user_1', KEY), true);
    assert.strictEqual(ls.get('oyi_sync_key_user_1'), undefined, 'kein Rohschlüssel in localStorage');
    assert.strictEqual(ls.get('oyi_sync_keypresent_user_1'), '1', 'Existenz-Flag gesetzt');
    assert.ok(data.has('user_1:raw'), 'Rohbytes in IndexedDB');
    assert.ok(data.has('user_1:ck'), 'nicht-extrahierbarer CryptoKey in IndexedDB');
    const back = await api.keyBytes('user_1');
    assert.deepStrictEqual(Array.from(back), Array.from(KEY), 'Rückgabe stimmt byteweise');
    pass++; console.log('✓ neuer Schlüssel liegt in IndexedDB, nicht in localStorage');

    // 2) Der in IndexedDB abgelegte CryptoKey ist nicht extrahierbar — das ist der ganze Punkt
    const ck = data.get('user_1:ck');
    assert.strictEqual(ck.extractable, false, 'CryptoKey.extractable === false');
    await assert.rejects(() => crypto.subtle.exportKey('raw', ck), 'exportKey muss scheitern');
    pass++; console.log('✓ CryptoKey ist nicht extrahierbar (exportKey scheitert)');

    // 3) Migration: Alt-Eintrag wird übernommen und DANACH entfernt
    ({ api, ls, data } = load({}));
    ls.set('oyi_sync_key_user_1', b64);
    await api.migrate('user_1');
    assert.strictEqual(ls.get('oyi_sync_key_user_1'), undefined, 'Alt-Eintrag entfernt');
    assert.deepStrictEqual(Array.from(await api.keyBytes('user_1')), Array.from(KEY), 'Schlüssel erhalten');
    pass++; console.log('✓ Migration überträgt und räumt den Alt-Eintrag ab');

    // 4) DER kritische Fall: der IndexedDB-Schreibvorgang verschwindet still. Dann MUSS der
    //    Alt-Eintrag liegen bleiben — sonst ist der Schlüssel weg und mit ihm alle Cloud-Daten.
    ({ api, ls, data } = load({ writeSilentlyDrops: true }));
    ls.set('oyi_sync_key_user_1', b64);
    await api.migrate('user_1');
    assert.strictEqual(ls.get('oyi_sync_key_user_1'), b64, 'Alt-Eintrag bleibt bei fehlgeschlagenem Write');
    assert.deepStrictEqual(Array.from(await api.keyBytes('user_1')), Array.from(KEY), 'Schlüssel über Rückfall lesbar');
    pass++; console.log('✓ stiller Schreibfehler lässt den Alt-Eintrag stehen (kein Schlüsselverlust)');

    // 5) Rückgelesene Bytes weichen ab (korrupter Store) → ebenfalls kein Aufräumen
    ({ api, ls, data } = load({ readReturnsWrong: true }));
    ls.set('oyi_sync_key_user_1', b64);
    await api.migrate('user_1');
    assert.strictEqual(ls.get('oyi_sync_key_user_1'), b64, 'Alt-Eintrag bleibt bei Byte-Abweichung');
    pass++; console.log('✓ Byte-Abweichung beim Rücklesen verhindert das Aufräumen');

    // 6) storeKey meldet den Fehlschlag, statt Erfolg zu behaupten
    ({ api } = load({ writeSilentlyDrops: true }));
    await assert.rejects(() => api.storeKey('user_1', KEY), /key_store_verify_failed/,
        'storeKey muss werfen, wenn der Rückvergleich scheitert');
    pass++; console.log('✓ storeKey wirft bei fehlgeschlagenem Rückvergleich');

    // 7) Ohne IndexedDB (privater Browser-Modus, Node) bleibt Cloud-Sync nutzbar — Rückfall auf
    //    die alte Ablage. Ein nicht anlegbarer Schlüssel wäre der schlechtere Ausgang.
    ({ api, ls } = load({ noIdb: true }));
    assert.strictEqual(await api.storeKey('user_1', KEY), true, 'storeKey gelingt ohne IndexedDB');
    assert.strictEqual(ls.get('oyi_sync_key_user_1'), b64, 'Rückfall auf localStorage');
    assert.deepStrictEqual(Array.from(await api.keyBytes('user_1')), Array.from(KEY));
    pass++; console.log('✓ ohne IndexedDB fällt die Ablage auf localStorage zurück');

    // 8) _hasKey ist synchron und erkennt beide Ablagen — es steckt im Render-/Statuspfad
    ({ api, ls } = load({}));
    assert.strictEqual(api.hasKey('user_1'), false, 'ohne Schlüssel false');
    ls.set('oyi_sync_keypresent_user_1', '1');
    assert.strictEqual(api.hasKey('user_1'), true, 'Existenz-Flag genügt');
    ({ api, ls } = load({}));
    ls.set('oyi_sync_key_user_1', b64);
    assert.strictEqual(api.hasKey('user_1'), true, 'Alt-Eintrag zählt auch');
    pass++; console.log('✓ _hasKey erkennt neue und alte Ablage, ohne asynchron zu werden');

    console.log('\n' + pass + '/8 Tests bestanden ✅');
})().catch(e => { console.error('✗ FAIL', e); process.exit(1); });
