// Speicher-Adapter von api/sync.js (Upstash ↔ Supabase):  node test/test-sync-store.js
// Prüft ohne Datenbank:
//   1. Jeder db.rpc-Aufruf in api/_sync-store.js trifft eine Funktion der Migration mit
//      exakt denselben Parameternamen — sonst antwortet PostgREST erst live mit 404.
//   2. STORAGE_BACKEND=supabase ohne Zugangsdaten → 500 server_misconfigured.
//   3. Spiegel-Betrieb: Supabase-Ausfall bricht keinen Request ab, die Schreibung kommt
//      aber im Spiegel an, solange er erreichbar ist.
// Das SQL selbst wurde am 2026-10-06 einmalig gegen PGlite gefahren (alle Aktionen, beide
// Modi); vor dem Umschalten in stackr-preview noch einmal gegen echtes Supabase prüfen.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Alle Migrationen: Funktionen fuer den Adapter liegen inzwischen in mehreren Dateien
// (z. B. 20261008000002_blob_budget.sql fuer counterAdd/lockTry/lockRelease).
const MIG = path.join(ROOT, 'supabase/migrations');
const sql = fs.readdirSync(MIG).filter(f => f.endsWith('.sql')).sort()
    .map(f => fs.readFileSync(path.join(MIG, f), 'utf8')).join('\n');
const src = fs.readFileSync(path.join(ROOT, 'api/_sync-store.js'), 'utf8');
let pass = 0;

// ── 1. Aufrufe ↔ Migration ────────────────────────────────────────────────────
const fns = {};
for (const m of sql.matchAll(/create or replace function (\w+)\(([^)]*)\)/g)) {
    fns[m[1]] = m[2].split(',').map(a => a.trim().split(/\s+/)[0]).filter(Boolean).sort();
}
const calls = [...src.matchAll(/db\.rpc\('(\w+)',\s*\{([^}]*)\}/g)];
assert.ok(calls.length >= 18, 'zu wenige rpc-Aufrufe gefunden: ' + calls.length);
for (const c of calls) {
    const params = c[2].split(',').map(p => p.split(':')[0].trim()).filter(Boolean).sort();
    assert.ok(fns[c[1]], 'Funktion fehlt in der Migration: ' + c[1]);
    assert.deepStrictEqual(params, fns[c[1]], 'Parameter von ' + c[1]);
}
pass++; console.log('✓ ' + calls.length + ' rpc-Aufrufe passen zur Migration');

// Jede Funktion bekommt ihre Rechte nur über den Schleifenblock am Ende — der greift per
// Namensmuster. Eine Funktion ohne sync_-Präfix wäre für anon aufrufbar.
for (const name of Object.keys(fns)) assert.ok(/^sync_/.test(name), 'Funktion ohne sync_-Präfix: ' + name);
assert.ok(/revoke all on function %s from public, anon, authenticated/.test(sql));
pass++; console.log('✓ alle Funktionen fallen unter den Rechte-Entzug');

// ── Gemeinsame Mocks ──────────────────────────────────────────────────────────
function loadSync(env) {
    for (const k of ['STORAGE_BACKEND', 'STORAGE_MIRROR', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
                     'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) delete process.env[k];
    Object.assign(process.env, env);
    for (const f of ['api/sync.js', 'api/_sync-store.js', 'api/_db.js']) delete require.cache[path.join(ROOT, f)];
    return require('../api/sync.js');
}
function mkRes() { const r = { code: 0, body: null }; r.setHeader = () => {}; r.status = (c) => { r.code = c; return { json: (b) => { r.body = b; return r; }, end: () => r }; }; return r; }
async function call(handler, body) { const res = mkRes(); await handler({ method: 'POST', headers: { authorization: 'Bearer tok' }, body }, res); return res; }

const kv = new Map(), sets = new Map();
function redisExec(c) {
    const op = c[0];
    if (op === 'GET')  return kv.has(c[1]) ? kv.get(c[1]) : null;
    if (op === 'INCR') { const v = +(kv.get(c[1]) || 0) + 1; kv.set(c[1], String(v)); return v; }
    if (op === 'EXPIRE') return 1;
    if (op === 'EVAL') { kv.set(c[3], c[5]); return 'OK'; }
    if (op === 'SADD') { const s = sets.get(c[1]) || new Set(); const had = s.has(c[2]); s.add(c[2]); sets.set(c[1], s); return had ? 0 : 1; }
    if (op === 'SCARD') return (sets.get(c[1]) || new Set()).size;
    return null;
}
let supabaseUp = true;
const rpcCalls = [];
global.fetch = async (url, opts) => {
    if (url === 'http://redis.mock') return { json: async () => ({ result: redisExec(JSON.parse(opts.body)) }) };
    if (url.indexOf('http://sb.mock/rest/v1/rpc/') === 0) {
        if (!supabaseUp) return { ok: false, status: 503, text: async () => '' };
        rpcCalls.push({ name: url.split('/').pop(), body: JSON.parse(opts.body), key: opts.headers.apikey });
        return { ok: true, status: 200, text: async () => 'true' };
    }
    if (url.includes('/oauth/userinfo')) return { ok: true, json: async () => ({ sub: 'u1', preferred_username: 'u1' }) };
    if (url.includes('/me/has_access/')) return { ok: true, status: 200, json: async () => ({ valid: true }) };
    return { ok: false, status: 404 };
};
const origErr = console.error, origWarn = console.warn;

(async () => {
    let h, r;

    // ── 2. Fehlkonfiguration ──────────────────────────────────────────────────
    console.error = console.warn = () => {};
    h = loadSync({ STORAGE_BACKEND: 'supabase' });
    r = await call(h, { action: 'pull', scope: '__account' });
    assert.strictEqual(r.code, 500); assert.strictEqual(r.body.error, 'server_misconfigured');
    h = loadSync({ STORAGE_BACKEND: 'tippfehler', UPSTASH_REDIS_REST_URL: 'http://redis.mock', UPSTASH_REDIS_REST_TOKEN: 'x' });
    r = await call(h, { action: 'pull', scope: '__account' });
    assert.strictEqual(r.code, 500, 'unbekanntes Backend darf nicht still auf Redis fallen');
    console.error = origErr; console.warn = origWarn;
    pass++; console.log('✓ Supabase ohne Zugangsdaten / unbekanntes Backend → 500 server_misconfigured');

    // ── 3. Spiegel ────────────────────────────────────────────────────────────
    const mirrorEnv = { STORAGE_MIRROR: 'supabase', UPSTASH_REDIS_REST_URL: 'http://redis.mock', UPSTASH_REDIS_REST_TOKEN: 'x',
                        SUPABASE_URL: 'http://sb.mock/', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
    h = loadSync(mirrorEnv);
    r = await call(h, { action: 'push', scope: '__account', version: 0, ciphertext: 'C', iv: 'i' });
    assert.strictEqual(r.code, 200);
    const put = rpcCalls.find(c => c.name === 'sync_put');
    assert.ok(put, 'Schreibung kommt im Spiegel an');
    assert.strictEqual(put.body.p_data.ciphertext, 'C'); assert.strictEqual(put.body.p_data.version, 1);
    assert.strictEqual(put.key, 'svc');
    assert.ok(!rpcCalls.some(c => c.name === 'sync_rate_hit'), 'Rate-Limit wird nicht gespiegelt');
    assert.ok(rpcCalls.some(c => c.name === 'sync_claim_scope' && c.body.p_max > 1e6), 'Spiegel prüft keinen eigenen Deckel');
    pass++; console.log('✓ Spiegel bekommt CAS-Ergebnis und Scope, kein Rate-Limit');

    supabaseUp = false;
    console.error = console.warn = () => {};
    r = await call(h, { action: 'push', scope: '__account', version: 1, ciphertext: 'D', iv: 'i' });
    console.error = origErr; console.warn = origWarn;
    assert.strictEqual(r.code, 200, 'Spiegel-Ausfall darf den Sync nicht stoppen');
    assert.strictEqual(JSON.parse(kv.get('sync:u1:__account')).ciphertext, 'D');
    pass++; console.log('✓ Supabase-Ausfall im Spiegel bricht den Request nicht ab');

    console.log('\n' + pass + '/' + pass + ' Sync-Store-Tests bestanden ✅');
})().catch(e => { console.error = origErr; console.error(e); process.exit(1); });
