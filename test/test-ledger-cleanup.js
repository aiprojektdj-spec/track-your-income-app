// Überholte Ledger-Chiffrate im Blob-Speicher (api/blob-cleanup.js → ledgerAufraeumen)
//   node test/test-ledger-cleanup.js
// Prüft ohne echten Speicher:
//   1. ersetzte ledger-* älter als 24 h werden gelöscht, auch wenn der Eintrag inline ist
//   2. das aktuelle ledger-*, junge Dateien, normale Anhänge und tmp/ bleiben
//   3. ohne Sync-Eintrag bleibt alles liegen (Lesefehler oder Speicherwechsel)
//   4. ein Fehler beim Lesen wird gemeldet und wirft nicht
'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let pass = 0;
const ok = (msg) => { pass++; console.log('✓ ' + msg); };

const H = 'https://abc.public.blob.vercel-storage.com/';
const NOW = Date.parse('2026-10-08T04:00:00Z');
const ALT = new Date(NOW - 3 * 86400000).toISOString();
const JUNG = new Date(NOW - 3600000).toISOString();
const blob = (pathname, uploadedAt) => ({ pathname, url: H + pathname, uploadedAt });

let blobs = [];
let geloescht = [];
let eintraege = {};
let getFehler = null;
const alarme = [];

function stub(rel, exports) {
    const id = require.resolve(path.join(ROOT, rel));
    require.cache[id] = { id, filename: id, loaded: true, exports };
}
const BLOBMOD = require.resolve('@vercel/blob');
require.cache[BLOBMOD] = { id: BLOBMOD, filename: BLOBMOD, loaded: true, exports: {
    // Zwei Seiten, damit der Cursor-Durchlauf mitgeprüft wird
    list: async ({ prefix, cursor }) => {
        const alle = blobs.filter(b => b.pathname.startsWith(prefix));
        const start = cursor ? Number(cursor) : 0;
        return { blobs: alle.slice(start, start + 2), hasMore: start + 2 < alle.length, cursor: String(start + 2) };
    },
    del: async (urls) => { geloescht.push(...urls); },
    put: async () => { throw new Error('nicht erwartet'); }
} };
stub('api/_sync-store.js', {
    get: async (u, s) => { if (getFehler) throw getFehler; return eintraege[u + '/' + s] || null; },
    backendName: () => 'redis', configProblem: () => null
});
stub('api/_alert.js', { alertOps: async (src, ev, msg) => { alarme.push(ev + ': ' + msg); return true; }, alertZiele: () => ({}) });

process.env.BLOB_READ_WRITE_TOKEN = 'test';
const { ledgerAufraeumen } = require(path.join(ROOT, 'api/blob-cleanup.js'));

(async () => {
    // 1 + 2
    blobs = [
        blob('stackr/attachments/user_a/co_x/ledger-alt1', ALT),
        blob('stackr/attachments/user_a/co_x/ledger-alt2', ALT),
        blob('stackr/attachments/user_a/co_x/ledger-aktuell', ALT),
        blob('stackr/attachments/user_a/co_x/ledger-jung', JUNG),
        blob('stackr/attachments/user_a/co_x/fmt123beleg', ALT),
        blob('stackr/attachments/user_b/__account/ledger-alt', ALT),
        blob('stackr/tmp/user_a/co_x/ledger-chunk', ALT)
    ];
    eintraege = {
        'user_a/co_x': { blobUrl: H + 'stackr/attachments/user_a/co_x/ledger-aktuell', version: 9 },
        'user_b/__account': { ciphertext: 'klein', version: 3 }   // Ledger wieder inline
    };
    const n = await ledgerAufraeumen(NOW);
    assert.deepStrictEqual(geloescht.sort(), [
        H + 'stackr/attachments/user_a/co_x/ledger-alt1',
        H + 'stackr/attachments/user_a/co_x/ledger-alt2',
        H + 'stackr/attachments/user_b/__account/ledger-alt'
    ]);
    assert.strictEqual(n, 3);
    ok('ersetzte ledger-* werden gelöscht, auch wenn der Eintrag inzwischen inline ist');
    ok('aktuelles ledger-*, junge Dateien, Belege und tmp/ bleiben');

    // 3
    geloescht = [];
    eintraege = {};
    assert.strictEqual(await ledgerAufraeumen(NOW), 0);
    assert.deepStrictEqual(geloescht, []);
    ok('ohne Sync-Eintrag wird nichts gelöscht');

    // 4
    getFehler = new Error('redis weg');
    eintraege = { 'user_a/co_x': { blobUrl: 'x' } };
    assert.strictEqual(await ledgerAufraeumen(NOW), 0);
    assert.deepStrictEqual(geloescht, []);
    assert.ok(alarme.some(a => /aufraeumen-failed: ledger: redis weg/.test(a)), 'Alarm gemeldet');
    ok('Lesefehler wird gemeldet, nichts gelöscht, kein Wurf');

    console.log(`\n${pass} Prüfungen bestanden`);
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
