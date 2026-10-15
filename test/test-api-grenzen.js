// Regression Audit 2026-10-13, S4/S5/S9 — echte API-Handler mit simuliertem Whop/Redis/Blob.
//
// S9: Eigentümer ohne aktives Abo widerruft einen bestehenden Grant; danach wird der Abruf des
//     Steuerberaters abgewiesen. Löschen eigener Cloud-Daten/Anhänge geht ohne Abo, fremde nie.
//     Neue Grants, Pushes und Uploads bleiben tarifgeschützt.
// S4: Commit nimmt nur die temporären Teile EINES Uploads, jeden genau einmal; Wiederholung
//     erzeugt kein zweites Objekt.
// S5: Ungültige Tokens werden vor wiederholten Whop-Abfragen per IP begrenzt.
//
// Simuliert (kein Produktionszugriff): Whop-OAuth/has_access, Upstash-REST (test/_mini-redis.js),
// @vercel/blob. Supabase-Fassung der SQL-Funktionen ist hier NICHT abgedeckt.
'use strict';
const assert = require('assert');
const path = require('path');
const { miniRedis } = require('./_mini-redis');
const ROOT = path.join(__dirname, '..');

let fail = 0, pass = 0;
const faelle = [];
const check = (name, fn) => faelle.push([name, fn]);

const VHOST = 'https://abc.public.blob.vercel-storage.com/';
const vercel = new Map(); let vSeq = 0;
const BLOBMOD = require.resolve('@vercel/blob');
require.cache[BLOBMOD] = { id: BLOBMOD, filename: BLOBMOD, loaded: true, exports: {
    put: async (key, buf) => { const k = key + '-v' + (++vSeq); vercel.set(k, Buffer.from(buf)); return { url: VHOST + k }; },
    del: async (urls) => { urls.forEach(u => vercel.delete(u.slice(VHOST.length))); },
    list: async ({ prefix }) => ({ blobs: [...vercel.keys()].filter(k => k.startsWith(prefix)).map(k => ({ url: VHOST + k, uploadedAt: new Date(0).toISOString() })), hasMore: false })
} };

// Abo-Zustände: trial/aktiv = Zugriff, gekündigt-noch-laufend = Zugriff, abgelaufen = kein Zugriff
const USERS = {
    tOwnerAbgelaufen: { sub: 'owner_ex', status: 'expired' },
    tOwnerTrial:      { sub: 'owner_tr', status: 'trialing' },
    tStb:             { sub: 'stb', status: 'expired' },
    tFremd:           { sub: 'fremd', status: 'active' }
};
let whopCalls = 0, redis;
global.fetch = async (url, opts) => {
    opts = opts || {};
    if (url === 'http://redis.mock') return redis.fetch(url, opts);
    if (url.startsWith(VHOST)) { const b = vercel.get(url.slice(VHOST.length)); return b ? { ok: true, arrayBuffer: async () => b } : { ok: false, status: 404 }; }
    const u = USERS[((opts.headers || {}).Authorization || '').replace('Bearer ', '')];
    if (url.includes('/oauth/userinfo')) { whopCalls++; return u ? { ok: true, json: async () => ({ sub: u.sub, preferred_username: u.sub }) } : { ok: false, status: 401 }; }
    if (url.includes('/me/has_access/')) return { ok: true, status: 200, json: async () => ({ valid: !!u && (u.status === 'active' || u.status === 'trialing') }) };
    return { ok: false, status: 404 };
};
function lade(datei) {
    for (const k of ['STORAGE_BACKEND', 'STORAGE_MIRROR', 'BLOB_BACKEND', 'WHOP_API_KEY', 'SYNC_OWNER_IDS', 'SYNC_OWNER_USERNAMES']) delete process.env[k];
    Object.assign(process.env, { UPSTASH_REDIS_REST_URL: 'http://redis.mock', UPSTASH_REDIS_REST_TOKEN: 'x', BLOB_READ_WRITE_TOKEN: 't' });
    for (const f of [datei, '_storage.js', '_sync-store.js', '_db.js', '_alert.js']) delete require.cache[path.join(ROOT, 'api', f)];
    return require(path.join(ROOT, 'api', datei));
}
async function rufe(h, tok, opts) {
    const r = { code: 0, body: null, setHeader() {} };
    r.status = c => { r.code = c; return { json: b => { r.body = b; return r; }, end: () => r }; };
    await h({ method: 'POST', headers: Object.assign({ authorization: 'Bearer ' + tok, 'x-vercel-forwarded-for': opts.ip || '1.1.1.' + Math.floor(Math.random() * 250) }, opts.headers || {}),
        query: opts.query || {}, body: opts.body, socket: {} }, r);
    return r;
}
const leise = async fn => { const e = console.error, w = console.warn, l = console.log; console.error = console.warn = () => {}; try { return await fn(); } finally { console.error = e; console.warn = w; } };

// ── S9 ──
check('S9: Eigentümer mit abgelaufenem Abo widerruft — danach kein Abruf durch den Steuerberater', async () => {
    redis = miniRedis();
    const sync = lade('sync.js');
    redis.cmd(['SET', 'grant:owner_ex:stb', JSON.stringify({ role: 'readonly', envelope: {} })]);
    redis.cmd(['SADD', 'grantsby:owner_ex', 'stb']); redis.cmd(['SADD', 'grantsfor:stb', 'owner_ex']);
    redis.cmd(['SET', 'sync:owner_ex:co_a', JSON.stringify({ ciphertext: 'c', iv: 'i', version: 1 })]);
    let r = await rufe(sync, 'tStb', { body: { action: 'pull', scope: 'co_a', owner: 'owner_ex' } });
    assert.strictEqual(r.code, 200, 'vorher liest der StB');
    r = await rufe(sync, 'tOwnerAbgelaufen', { body: { action: 'revoke', granteeId: 'stb' } });
    assert.strictEqual(r.code, 200, 'Widerruf ohne Abo: ' + JSON.stringify(r.body));
    r = await rufe(sync, 'tStb', { body: { action: 'pull', scope: 'co_a', owner: 'owner_ex' } });
    assert.strictEqual(r.code, 403, 'danach abgewiesen');
    r = await rufe(sync, 'tOwnerAbgelaufen', { body: { action: 'list_my_grantees' } });
    assert.strictEqual(r.code, 200); assert.strictEqual(r.body.grantees.length, 0);
});
check('S9: Fremder kann den Grant eines anderen nicht widerrufen; owner-Parameter bei Löschen verboten', async () => {
    redis = miniRedis();
    const sync = lade('sync.js');
    redis.cmd(['SET', 'grant:owner_ex:stb', JSON.stringify({ role: 'readonly' })]);
    let r = await rufe(sync, 'tFremd', { body: { action: 'revoke', granteeId: 'stb' } });
    assert.strictEqual(r.code, 200, 'wirkt nur auf eigene ID');
    assert.ok(redis.kv.get('grant:owner_ex:stb'), 'fremder Grant besteht weiter');
    r = await rufe(sync, 'tFremd', { body: { action: 'delete', scope: 'co_a', owner: 'owner_ex' } });
    assert.strictEqual(r.code, 403);
    r = await rufe(sync, 'tFremd', { body: { action: 'reset_all', owner: 'owner_ex' } });
    assert.strictEqual(r.code, 403);
});
check('S9: ohne Abo eigene Daten löschbar; neue Grants und Pushes bleiben gesperrt; Trial darf', async () => {
    redis = miniRedis();
    const sync = lade('sync.js');
    redis.cmd(['SET', 'sync:owner_ex:co_a', JSON.stringify({ ciphertext: 'c', iv: 'i', version: 1 })]);
    let r = await rufe(sync, 'tOwnerAbgelaufen', { body: { action: 'delete', scope: 'co_a' } });
    assert.strictEqual(r.code, 200); assert.ok(!redis.kv.has('sync:owner_ex:co_a'));
    r = await rufe(sync, 'tOwnerAbgelaufen', { body: { action: 'grant', granteeId: 'stb', envelope: {} } });
    assert.strictEqual(r.body.error, 'pro_required');
    r = await rufe(sync, 'tOwnerAbgelaufen', { body: { action: 'push', scope: 'co_a', version: 0, iv: 'i', ciphertext: 'c' } });
    assert.strictEqual(r.body.error, 'pro_required');
    r = await rufe(sync, 'tOwnerTrial', { body: { action: 'push', scope: 'co_a', version: 0, iv: 'i', ciphertext: 'c' } });
    assert.strictEqual(r.code, 200, 'Trial darf schreiben');
});
check('S9: Blob — eigene Anhänge ohne Abo löschbar, fremde nie, Upload bleibt gesperrt', async () => {
    redis = miniRedis();
    const blob = lade('blob-upload.js');
    vercel.set('stackr/attachments/owner_ex/co_a/f-v1', Buffer.from('x'));
    vercel.set('stackr/attachments/fremd/co_a/g-v1', Buffer.from('y'));
    let r = await rufe(blob, 'tOwnerAbgelaufen', { query: { action: 'delete', scope: 'co_a' }, body: { urls: [VHOST + 'stackr/attachments/owner_ex/co_a/f-v1'] } });
    assert.strictEqual(r.code, 200); assert.ok(!vercel.has('stackr/attachments/owner_ex/co_a/f-v1'));
    r = await rufe(blob, 'tOwnerAbgelaufen', { query: { action: 'delete', scope: 'co_a' }, body: { urls: [VHOST + 'stackr/attachments/fremd/co_a/g-v1'] } });
    assert.strictEqual(r.body.error, 'not_owner'); assert.ok(vercel.has('stackr/attachments/fremd/co_a/g-v1'));
    r = await rufe(blob, 'tOwnerAbgelaufen', { query: { action: 'put', scope: 'co_a', name: 'f' }, body: Buffer.from('x') });
    assert.strictEqual(r.body.error, 'pro_required');
});

// ── S4 ──
check('S4: 3-Byte-Chunk 50× referenziert wird abgelehnt — keine 150 unberechneten Bytes', async () => {
    redis = miniRedis();
    const blob = lade('blob-upload.js');
    const c0 = (await rufe(blob, 'tFremd', { query: { action: 'chunk', scope: 'co_a', uploadId: 'up1', index: 0 }, body: Buffer.from('ABC') })).body.url;
    const vorher = vercel.size;
    const r = await rufe(blob, 'tFremd', { query: { action: 'commit', scope: 'co_a' }, body: { name: 'gross', chunkUrls: Array(50).fill(c0) } });
    assert.strictEqual(r.code, 400, JSON.stringify(r.body));
    assert.strictEqual(vercel.size, vorher, 'nichts geschrieben');
    assert.strictEqual(Number(redis.kv.get('blob:bytes:fremd')), 3, 'gebucht: 3 Bytes');
});
check('S4: fertiger Anhang als Ersatz-Chunk abgelehnt; gültiger Commit einmalig, Wiederholung 409', async () => {
    redis = miniRedis();
    const blob = lade('blob-upload.js');
    const anhang = (await rufe(blob, 'tFremd', { query: { action: 'put', scope: 'co_a', name: 'a' }, body: Buffer.from('XYZ') })).body.url;
    let r = await rufe(blob, 'tFremd', { query: { action: 'commit', scope: 'co_a' }, body: { name: 'g', chunkUrls: [anhang, anhang] } });
    assert.strictEqual(r.code, 400, 'attachments/ ist kein Chunk');
    const c0 = (await rufe(blob, 'tFremd', { query: { action: 'chunk', scope: 'co_a', uploadId: 'up2', index: 0 }, body: Buffer.from('AB') })).body.url;
    const c1 = (await rufe(blob, 'tFremd', { query: { action: 'chunk', scope: 'co_a', uploadId: 'up2', index: 1 }, body: Buffer.from('CD') })).body.url;
    r = await rufe(blob, 'tFremd', { query: { action: 'commit', scope: 'co_a' }, body: { name: 'g', chunkUrls: [c1, c0] } });
    assert.strictEqual(r.code, 400, 'falsche Reihenfolge');
    r = await rufe(blob, 'tFremd', { query: { action: 'commit', scope: 'co_a' }, body: { name: 'g', chunkUrls: [c0, c1] } });
    assert.strictEqual(r.code, 200); assert.strictEqual(r.body.size, 4);
    // Chunks wären aufgeräumt; selbst wenn nicht (Aufräumfehler): zweiter Commit wird abgewiesen
    vercel.set(c0.slice(VHOST.length), Buffer.from('AB')); vercel.set(c1.slice(VHOST.length), Buffer.from('CD'));
    const anzahl = vercel.size;
    r = await rufe(blob, 'tFremd', { query: { action: 'commit', scope: 'co_a' }, body: { name: 'g2', chunkUrls: [c0, c1] } });
    assert.strictEqual(r.code, 409, JSON.stringify(r.body));
    assert.strictEqual(vercel.size, anzahl, 'kein zweites Objekt');
});

// ── S5 ──
check('S5: 300 ungültige Tokens von einer IP → höchstens 240 Whop-Aufrufe, Rest 429', async () => {
    redis = miniRedis();
    const blob = lade('blob-upload.js');
    whopCalls = 0;
    let n429 = 0;
    for (let i = 0; i < 300; i++) {
        const r = await rufe(blob, 'muell' + i, { ip: '9.9.9.9', query: { action: 'put', scope: 'co_a' }, body: Buffer.from('x') });
        if (r.code === 429) n429++;
    }
    assert.ok(whopCalls <= 240, 'Whop-Aufrufe: ' + whopCalls);
    assert.strictEqual(n429, 60);
    // Normaler Upload von anderer IP funktioniert
    const r = await rufe(blob, 'tFremd', { ip: '8.8.8.8', query: { action: 'put', scope: 'co_a', name: 'n' }, body: Buffer.from('ok') });
    assert.strictEqual(r.code, 200);
});

(async () => {
    for (const [name, fn] of faelle) {
        try { await leise(fn); pass++; console.log('✓ ' + name); }
        catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
    }
    console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
    if (fail) process.exit(1);
})();
