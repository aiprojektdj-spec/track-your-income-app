// Fehlende Anhang-Datei (404) darf den Sync nicht dauerhaft stoppen
//   node test/test-anhang-404.js
// Kundenfall 2026-10-24: Reset auf dem iPhone (purgeAll, neuer Schlüssel), das zweite Gerät
// verbindet sich mit dem neuen Code und pusht aus seinem alten Blob-Cache Referenzen auf
// gelöschte Dateien. Danach scheiterte jeder Pull mit blob_get_404 ("abgebrochen bei o").
// Prüft:
//   1. hydrateFields sammelt 404 in missing statt zu werfen; andere Fehler werfen weiter
//   2. ohne missing wirft 404 wie bisher (Steuerberater-Pfad unverändert)
//   3. Reparatur: lokale Kopie desselben Datensatzes ersetzt die tote Referenz,
//      ohne lokale Kopie fliegt das Feld raus; tote Referenzen verlassen den Cache
//   4. danach lädt offloadLargeFields die lokale Fassung neu hoch (Cloud heilt)
//   5. Schlüsselwechsel leert den Blob-Cache (Speicher + localStorage)
'use strict';
const assert = require('assert');
let pass = 0;
const ok = (msg) => { pass++; console.log('✓ ' + msg); };

const _ls = new Map();
global.localStorage = {
    getItem: k => (_ls.has(k) ? _ls.get(k) : null),
    setItem: (k, v) => _ls.set(k, String(v)),
    removeItem: k => _ls.delete(k),
    key: i => [..._ls.keys()][i] || null,
    get length() { return _ls.size; }
};
global.document = { readyState: 'complete', getElementById: () => null, addEventListener: () => {} };
global.window = {};
const lokal = {};
global.Store = { _syncReadRaw: k => (k in lokal ? JSON.parse(JSON.stringify(lokal[k])) : null) };
const warn = console.warn; console.warn = () => {};

const BA = require('../js/blob-attachments.js');
global.BlobAttachments = BA;
const T = require('../js/cloud-sync.js')._test;

const dataUrl = (s) => 'data:image/jpeg;base64,' + Buffer.from(s).toString('base64');
const big = 'x'.repeat(30000);
let puts = [];
global.fetch = async (url, opts) => {
    if (url === '/api/blob-upload?action=sign') {
        const b = JSON.parse(opts.body);
        return { ok: true, status: 200, json: async () => ({ urls: b.urls.map(u => 'https://signed/' + u) }) };
    }
    if (url === 'https://signed/tot1' || url === 'https://signed/tot2') return { ok: false, status: 404 };
    if (url === 'https://signed/kaputt') return { ok: false, status: 500 };
    if (url.startsWith('https://signed/')) return { ok: true, arrayBuffer: async () => new TextEncoder().encode('gut').buffer };
    if (url.indexOf('action=put') !== -1) { puts.push(url); return { ok: true, status: 200, json: async () => ({ url: 'neu' + puts.length }) }; }
    return { ok: false, status: 404, json: async () => ({}) };
};
const ref = (url) => ({ __blobref__: 1, url: url, iv: 'i', mime: 'image/jpeg' });

(async () => {
    // ── 1. 404 wird gesammelt, der Rest hydriert ──────────────────────────────
    const key = 'co_o__eigenbelege_2026';
    const remote = { [key]: [
        { id: 'a', foto: ref('tot1') },
        { id: 'b', foto: ref('tot2') },
        { id: 'c', foto: ref('lebt') }
    ] };
    const missing = [];
    const cache = { h1: ref('tot1'), h2: ref('lebt'), h3: ref('tot2') };
    await BA.hydrateFields(remote, async (ct) => ct, null, cache, missing);
    assert.deepStrictEqual(missing.map(m => m.url).sort(), ['tot1', 'tot2']);
    assert.strictEqual(missing[0].key, key, 'Schlüssel des Datensatzes mitgeliefert');
    assert.strictEqual(remote[key][2].foto, dataUrl('gut'), 'vorhandener Anhang hydriert');
    assert.ok(remote[key][0].foto.__blobref__, 'tote Referenz bleibt bis zur Reparatur stehen');
    await assert.rejects(() => BA.hydrateFields({ k: [{ id: 'z', foto: ref('kaputt') }] }, async (ct) => ct, null, {}, []),
        /blob_get_500/, 'Netz-/Serverfehler bricht weiter ab (kein Datenverlust durch Wackelnetz)');
    ok('hydrateFields: 404 landet in missing, 500 wirft weiter');

    // ── 2. ohne missing: unverändert werfen ──────────────────────────────────
    await assert.rejects(() => BA.hydrateFields({ k: [{ id: 'z', foto: ref('tot1') }] }, async (ct) => ct, null, {}),
        /blob_get_404/);
    ok('hydrateFields ohne missing wirft 404 wie bisher');

    // ── 3. Reparatur aus der lokalen Kopie ───────────────────────────────────
    lokal[key] = [{ id: 'a', foto: dataUrl(big) }, { id: 'b' }, { id: 'c', foto: dataUrl('gut') }];
    const verloren = T.repairMissingAttachments(missing, cache);
    assert.strictEqual(remote[key][0].foto, dataUrl(big), 'lokale Kopie ersetzt tote Referenz');
    assert.ok(!('foto' in remote[key][1]), 'ohne lokale Kopie: Feld entfernt statt toter Referenz');
    assert.strictEqual(verloren, 1);
    assert.deepStrictEqual(Object.keys(cache).map(h => cache[h].url).filter(u => /^tot/.test(u)), [], 'tote Referenzen aus dem Cache entfernt');
    assert.strictEqual(cache.h2.url, 'lebt', 'gültige Referenzen bleiben');
    ok('Reparatur: lokale Kopie übernommen, Rest gezählt, Cache bereinigt');

    // ── 4. Push lädt die lokale Fassung neu hoch ─────────────────────────────
    puts = [];
    await BA.offloadLargeFields('co_o', remote, async (b) => ({ ct: Buffer.from(b).toString('base64'), iv: 'i' }), cache);
    assert.strictEqual(puts.length, 1, 'genau der reparierte Anhang wird neu hochgeladen');
    assert.strictEqual(remote[key][0].foto.url, 'neu1', 'Ledger zeigt danach auf die neue Datei');
    ok('Push: reparierter Anhang bekommt eine neue, gültige Referenz');

    // ── 5. Schlüsselwechsel leert den Cache ──────────────────────────────────
    T.saveBlobCache('co_o', { h: ref('alt') });
    localStorage.setItem('oyi_sync_blobcache_co_x', '{"h":{"url":"alt2"}}');
    localStorage.setItem('anderer_key', '1');
    T.clearBlobCaches();
    assert.deepStrictEqual(T.getBlobCache('co_o'), {}, 'Speicher- und localStorage-Cache leer');
    assert.strictEqual(localStorage.getItem('oyi_sync_blobcache_co_x'), null);
    assert.strictEqual(localStorage.getItem('anderer_key'), '1', 'nur Blob-Caches gelöscht');
    ok('clearBlobCaches: alle Blob-Caches weg, sonst nichts');

    console.warn = warn;
    console.log('\n' + pass + '/' + pass + ' Anhang-404-Tests bestanden ✅');
})().catch(e => { console.warn = warn; console.error(e); process.exit(1); });
