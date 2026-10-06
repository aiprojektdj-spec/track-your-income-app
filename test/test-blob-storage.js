// Anhänge: Vercel Blob ↔ Supabase Storage (api/_storage.js, api/blob-upload.js, js/blob-attachments.js)
//   node test/test-blob-storage.js
// Prüft ohne echte Speicher:
//   1. keyOf: nur Vercel-Blob-Host und sb:-Referenzen, kein '..'
//   2. sign: eigene Anhänge, fremde → not_owner, tmp/ nie, Steuerberater nur mit Grant
//      und dann auch ohne eigenes Abo
//   3. Supabase-Modus: put → sb:-Referenz, Chunk-Commit, Signieren mit Rückfall auf die
//      alte Vercel-URL, Löschen inkl. Backfill-Kopie, purge über beide Speicher
//   4. rpc-Aufruf passt zur Migration
//   5. Browser: hydrateFields signiert alle Anhänge eines Scopes in EINEM Request
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let pass = 0;
const ok = (msg) => { pass++; console.log('✓ ' + msg); };

// ── @vercel/blob-Attrappe ─────────────────────────────────────────────────────
const VHOST = 'https://abc.public.blob.vercel-storage.com/';
const vercel = new Map();   // pathname → Buffer
let vSeq = 0;
const BLOBMOD = require.resolve('@vercel/blob');
require.cache[BLOBMOD] = { id: BLOBMOD, filename: BLOBMOD, loaded: true, exports: {
    put: async (key, buf) => { const k = key + '-v' + (++vSeq); vercel.set(k, Buffer.from(buf)); return { url: VHOST + k }; },
    del: async (urls) => { urls.forEach(u => vercel.delete(u.slice(VHOST.length))); },
    list: async ({ prefix }) => ({ blobs: [...vercel.keys()].filter(k => k.startsWith(prefix)).map(k => ({ url: VHOST + k, uploadedAt: new Date(0).toISOString() })), hasMore: false })
} };

// ── Supabase-Storage-Attrappe ─────────────────────────────────────────────────
const SB = 'http://sb.mock';
const sbObj = new Map();     // key → Buffer
const sbLog = [];
async function sbFetch(url, opts) {
    const u = new URL(url), p = decodeURIComponent(u.pathname);
    assert.strictEqual(opts.headers.apikey, 'svc', 'Service-Key mitgeschickt');
    sbLog.push(opts.method + ' ' + p);
    if (p === '/rest/v1/rpc/sync_storage_list') {
        const b = JSON.parse(opts.body);
        return { ok: true, status: 200, text: async () => JSON.stringify([...sbObj.keys()].filter(k => k.startsWith(b.p_prefix)).slice(0, b.p_limit)) };
    }
    if (p === '/rest/v1/rpc/sync_get_grant') {
        const b = JSON.parse(opts.body);
        return { ok: true, status: 200, text: async () => (b.p_owner === 'mandant' && b.p_grantee === 'stb' ? '{"role":"readonly"}' : 'null') };
    }
    if (opts.method === 'POST' && p.startsWith('/storage/v1/object/sign/attachments')) {
        const b = JSON.parse(opts.body);
        assert.ok(b.expiresIn > 0 && b.expiresIn <= 600, 'kurze Laufzeit');
        return { ok: true, json: async () => b.paths.map(k => sbObj.has(k) ? { path: k, signedURL: '/object/sign/attachments/' + k + '?token=t', error: null } : { path: k, signedURL: null, error: 'not found' }) };
    }
    if (opts.method === 'POST' && p.startsWith('/storage/v1/object/attachments/')) {
        const key = p.slice('/storage/v1/object/attachments/'.length);
        assert.strictEqual(opts.headers['x-upsert'], 'false', 'nie überschreiben');
        sbObj.set(key, Buffer.from(opts.body)); return { ok: true, status: 200 };
    }
    if (opts.method === undefined && p.startsWith('/storage/v1/object/authenticated/attachments/')) {
        assert.strictEqual(opts.redirect, 'error');
        const b = sbObj.get(p.slice('/storage/v1/object/authenticated/attachments/'.length));
        return b ? { ok: true, arrayBuffer: async () => b } : { ok: false, status: 404 };
    }
    if (opts.method === 'DELETE' && p === '/storage/v1/object/attachments') {
        JSON.parse(opts.body).prefixes.forEach(k => sbObj.delete(k)); return { ok: true, status: 200 };
    }
    throw new Error('unerwarteter Supabase-Aufruf ' + opts.method + ' ' + p);
}

const users = { tOwn: { sub: 'u1', pro: true }, tStb: { sub: 'stb', pro: false }, tMandant: { sub: 'mandant', pro: true } };
global.fetch = async (url, opts) => {
    opts = opts || {};
    if (url === 'http://redis.mock') return { json: async () => ({ result: 1 }) };   // Rate-Limit/Budget/Sperre: immer frei
    if (url.startsWith(SB)) return sbFetch(url, opts);
    if (url.startsWith(VHOST)) {
        const b = vercel.get(url.slice(VHOST.length));
        return b ? { ok: true, arrayBuffer: async () => b } : { ok: false, status: 404 };
    }
    const u = users[((opts.headers || {}).Authorization || '').replace('Bearer ', '')];
    if (url.includes('/oauth/userinfo')) return u ? { ok: true, json: async () => ({ sub: u.sub, preferred_username: u.sub }) } : { ok: false, status: 401 };
    if (url.includes('/me/has_access/')) return { ok: true, status: 200, json: async () => ({ valid: !!(u && u.pro) }) };
    return { ok: false, status: 404 };
};

function load(env) {
    for (const k of ['BLOB_BACKEND', 'BLOB_READ_WRITE_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STORAGE_BACKEND',
                     'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'WHOP_API_KEY']) delete process.env[k];
    Object.assign(process.env, { UPSTASH_REDIS_REST_URL: 'http://redis.mock', UPSTASH_REDIS_REST_TOKEN: 'x' }, env);
    for (const f of ['blob-upload.js', '_storage.js', '_sync-store.js', '_db.js']) delete require.cache[path.join(ROOT, 'api', f)];
    return require('../api/blob-upload.js');
}
async function call(h, tok, query, body) {
    const r = { code: 0, body: null, setHeader() {} };
    r.status = c => { r.code = c; return { json: b => { r.body = b; return r; }, end: () => r }; };
    await h({ method: 'POST', headers: { authorization: 'Bearer ' + tok }, query, body }, r);
    return r;
}
const quiet = (fn) => async (...a) => { const e = console.error, w = console.warn; console.error = console.warn = () => {}; try { return await fn(...a); } finally { console.error = e; console.warn = w; } };

(async () => {
    // ── 1. keyOf ──────────────────────────────────────────────────────────────
    const storage = (load({ BLOB_READ_WRITE_TOKEN: 't' }), require('../api/_storage.js'));
    assert.strictEqual(storage.keyOf(VHOST + 'stackr/attachments/u1/co_a/f-x'), 'stackr/attachments/u1/co_a/f-x');
    assert.strictEqual(storage.keyOf('sb:stackr/attachments/u1/co_a/f-x'), 'stackr/attachments/u1/co_a/f-x');
    assert.strictEqual(storage.keyOf('https://evil.example/stackr/attachments/u1/co_a/f'), null);
    assert.strictEqual(storage.keyOf('sb:stackr/attachments/u1/co_a/../../u2/co_a/f'), null);
    // %2E%2E normalisiert der URL-Parser selbst (wie fetch) — der Schlüssel ist dann der echte Zielpfad
    assert.strictEqual(storage.keyOf(VHOST + 'stackr/attachments/u1/co_a/%2E%2E/%2E%2E/u2/co_a/f'), 'stackr/attachments/u2/co_a/f');
    assert.strictEqual(storage.keyOf('sb:stackr//attachments'), null);
    ok('keyOf: nur bekannte Speicher, kein Pfad-Ausbruch');

    // ── 2. sign im Vercel-Modus ───────────────────────────────────────────────
    let h = load({ BLOB_READ_WRITE_TOKEN: 't' }), r;
    r = await call(h, 'tOwn', { action: 'put', scope: 'co_a', name: 'f' }, Buffer.from('CIPHER'));
    assert.strictEqual(r.code, 200); const own = r.body.url; assert.ok(own.startsWith(VHOST));
    r = await call(h, 'tOwn', { action: 'sign' }, { urls: [own] });
    assert.strictEqual(r.code, 200); assert.deepStrictEqual(r.body.urls, [own]);
    ok('Vercel-Modus: eigene Referenz kommt unverändert zurück');

    r = await call(h, 'tOwn', { action: 'sign' }, { urls: [VHOST + 'stackr/attachments/fremd/co_a/f-1'] });
    assert.strictEqual(r.code, 403); assert.strictEqual(r.body.error, 'not_owner');
    r = await call(h, 'tOwn', { action: 'sign' }, { urls: [VHOST + 'stackr/tmp/u1/co_a/up/0-1'] });
    assert.strictEqual(r.code, 403, 'tmp/ ist nie abrufbar');
    r = await call(h, 'tOwn', { action: 'sign' }, { urls: new Array(201).fill(own) });
    assert.strictEqual(r.body.error, 'too_many');
    ok('sign: fremde Nutzer, tmp/ und Übermenge abgelehnt');

    // Steuerberater: Grant-Prüfung läuft über _sync-store (hier Supabase-Backend, damit der Grant steuerbar ist)
    h = load({ BLOB_READ_WRITE_TOKEN: 't', STORAGE_BACKEND: 'supabase', SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'svc' });
    const mandantRef = VHOST + 'stackr/attachments/mandant/co_m/f-9';
    r = await call(h, 'tStb', { action: 'sign' }, { urls: [own], owner: 'u1' });
    assert.strictEqual(r.code, 403); assert.strictEqual(r.body.error, 'no_grant');
    r = await call(h, 'tStb', { action: 'sign' }, { urls: [mandantRef], owner: 'mandant' });
    assert.strictEqual(r.code, 200, 'StB mit Grant, ohne eigenes Abo'); assert.deepStrictEqual(r.body.urls, [mandantRef]);
    r = await call(h, 'tStb', { action: 'sign' }, { urls: [own], owner: 'mandant' });
    assert.strictEqual(r.body.error, 'not_owner', 'Grant gilt nur für Anhänge DIESES Mandanten');
    r = await call(h, 'tStb', { action: 'sign' }, { urls: [mandantRef] });
    assert.strictEqual(r.body.error, 'pro_required', 'ohne owner normaler Weg mit Pro-Pflicht');
    r = await call(h, 'tStb', { action: 'put', scope: 'co_a', name: 'f' }, Buffer.from('x'));
    assert.strictEqual(r.body.error, 'pro_required', 'Schreiben bleibt Pro-pflichtig');
    r = await call(h, 'tStb', { action: 'sign' }, { urls: [mandantRef], owner: 'stb' });
    assert.strictEqual(r.body.error, 'pro_required', 'owner = eigene ID umgeht die Pro-Pflicht nicht');
    ok('sign als Steuerberater: nur mit Grant, nur Mandanten-Anhänge, Schreiben bleibt gesperrt');

    // ── 3. Supabase-Modus ─────────────────────────────────────────────────────
    const sbEnv = { BLOB_BACKEND: 'supabase', BLOB_READ_WRITE_TOKEN: 't', SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'svc' };
    h = load(sbEnv);
    r = await call(h, 'tOwn', { action: 'put', scope: 'co_a', name: 'beleg' }, Buffer.from('NEU'));
    const sbRef = r.body.url;
    assert.ok(/^sb:stackr\/attachments\/u1\/co_a\/beleg-[A-Za-z0-9_-]{16}$/.test(sbRef), sbRef);
    assert.ok(!vercel.has(sbRef.slice(3)), 'nichts mehr in Vercel');
    ok('Supabase-Modus: put liefert sb:-Referenz mit Zufallsanteil');

    const c0 = (await call(h, 'tOwn', { action: 'chunk', scope: 'co_a', uploadId: 'up1', index: 0 }, Buffer.from('AB'))).body.url;
    const c1 = (await call(h, 'tOwn', { action: 'chunk', scope: 'co_a', uploadId: 'up1', index: 1 }, Buffer.from('CD'))).body.url;
    r = await call(h, 'tOwn', { action: 'commit', scope: 'co_a' }, { name: 'gross', chunkUrls: [c0, c1] });
    assert.strictEqual(r.code, 200); assert.strictEqual(r.body.size, 4);
    assert.strictEqual(sbObj.get(r.body.url.slice(3)).toString(), 'ABCD');
    assert.ok(!sbObj.has(c0.slice(3)) && !sbObj.has(c1.slice(3)), 'Chunks aufgeräumt');
    r = await call(h, 'tOwn', { action: 'commit', scope: 'co_a' }, { name: 'x', chunkUrls: ['sb:stackr/tmp/fremd/co_a/up/0-x'] });
    assert.strictEqual(r.body.error, 'not_owner');
    ok('Chunk-Commit über Supabase, fremde Chunks abgelehnt');

    // alte Vercel-Referenz: ohne Kopie → alte URL, mit Kopie → signiert
    const altRef = own, altKey = storage.keyOf(own);
    r = await call(h, 'tOwn', { action: 'sign' }, { urls: [sbRef, altRef, 'sb:stackr/attachments/u1/co_a/weg-1'] });
    assert.strictEqual(r.body.urls[0], SB + '/storage/v1/object/sign/attachments/' + sbRef.slice(3) + '?token=t');
    assert.strictEqual(r.body.urls[1], altRef, 'noch nicht kopiert → alte öffentliche URL');
    assert.strictEqual(r.body.urls[2], null, 'fehlendes Supabase-Objekt → null');
    sbObj.set(altKey, Buffer.from('KOPIE'));
    r = await call(h, 'tOwn', { action: 'sign' }, { urls: [altRef] });
    assert.ok(r.body.urls[0].startsWith(SB + '/storage/v1/object/sign/'), 'kopiert → signiert aus Supabase');
    ok('sign: Supabase-Objekte signiert, alte Vercel-Referenzen mit Rückfall');

    r = await call(h, 'tOwn', { action: 'delete', scope: 'co_a' }, { urls: [altRef] });
    assert.strictEqual(r.code, 200);
    assert.ok(!vercel.has(altKey) && !sbObj.has(altKey), 'Original UND Backfill-Kopie gelöscht');
    ok('delete erwischt Vercel-Original und Supabase-Kopie (Art. 17)');

    await call(h, 'tOwn', { action: 'put', scope: 'co_b', name: 'v' }, Buffer.from('1'));
    vercel.set('stackr/attachments/u1/co_b/alt-v99', Buffer.from('alt'));
    vercel.set('stackr/attachments/u2/co_b/nicht-anfassen', Buffer.from('x'));
    sbObj.set('stackr/attachments/u2/co_x/nicht-anfassen', Buffer.from('x'));
    r = await call(h, 'tOwn', { action: 'purge' }, {});
    assert.strictEqual(r.code, 200);
    assert.ok(![...sbObj.keys(), ...vercel.keys()].some(k => k.startsWith('stackr/attachments/u1/')), 'alles von u1 weg');
    assert.ok(vercel.has('stackr/attachments/u2/co_b/nicht-anfassen') && sbObj.has('stackr/attachments/u2/co_x/nicht-anfassen'), 'u2 unberührt');
    ok('purge räumt beide Speicher, nur den eigenen Präfix');

    r = await quiet(call)(load({ BLOB_BACKEND: 'supabase' }), 'tOwn', { action: 'sign' }, { urls: [] });
    assert.strictEqual(r.code, 500); assert.strictEqual(r.body.error, 'server_misconfigured');
    ok('Supabase-Modus ohne Zugangsdaten → 500');

    // ── 4. rpc ↔ Migration ────────────────────────────────────────────────────
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261006000002_storage.sql'), 'utf8');
    const m = /create or replace function sync_storage_list\(([^)]*)\)/.exec(sql);
    const sqlParams = m[1].split(',').map(a => a.trim().split(/\s+/)[0]).sort();
    const call2 = /db\.rpc\('sync_storage_list',\s*\{([^}]*)\}/.exec(fs.readFileSync(path.join(ROOT, 'api/_storage.js'), 'utf8'));
    assert.deepStrictEqual(call2[1].split(',').map(p => p.split(':')[0].trim()).sort(), sqlParams);
    assert.ok(/revoke all on function sync_storage_list\(text, timestamptz, integer\) from public, anon, authenticated/.test(sql));
    assert.ok(/'attachments', 'attachments', false/.test(sql), 'Bucket privat');
    ok('sync_storage_list passt zur Migration, Bucket privat, Rechte entzogen');

    // ── 5. Browser: gebündeltes Signieren ─────────────────────────────────────
    global.localStorage = { getItem: () => 'tok' };
    const BA = require('../js/blob-attachments.js');
    const signCalls = [];
    global.fetch = async (url, opts) => {
        if (url === '/api/blob-upload?action=sign') {
            const b = JSON.parse(opts.body); signCalls.push(b);
            return { ok: true, status: 200, json: async () => ({ urls: b.urls.map(u => u === 'sb:x' ? null : 'https://signed/' + u) }) };
        }
        if (url.startsWith('https://signed/')) return { ok: true, arrayBuffer: async () => new TextEncoder().encode(url.slice(-1)).buffer };
        return { ok: false, status: 404, json: async () => ({}) };
    };
    const keys = { k: [
        { logo: { __blobref__: 1, url: 'sb:a', iv: 'i', mime: 'text/plain' } },
        { foto: { __blobref__: 1, url: 'sb:b', iv: 'i', mime: 'text/plain' } }
    ] };
    await BA.hydrateFields(keys, async (ct) => ct, 'mandant');
    assert.strictEqual(signCalls.length, 1, 'ein sign-Request für alle Anhänge');
    assert.deepStrictEqual(signCalls[0], { urls: ['sb:a', 'sb:b'], owner: 'mandant' });
    assert.strictEqual(keys.k[0].logo, 'data:text/plain;base64,' + Buffer.from('a').toString('base64'));
    await assert.rejects(() => BA.get('sb:x'), /^Error: blob_get_/, 'Fehler bleiben blob_get_* (Netz statt falscher Schlüssel)');
    ok('Browser: ein sign-Request je Scope, owner wird durchgereicht');

    console.log('\n' + pass + '/' + pass + ' Blob-Storage-Tests bestanden ✅');
})().catch(e => { console.error(e); process.exit(1); });
