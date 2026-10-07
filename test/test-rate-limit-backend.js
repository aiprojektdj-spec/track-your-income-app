// IP-Rate-Limit von whop-token/whop-access folgt STORAGE_BACKEND:  node test/test-rate-limit-backend.js
// Prüft ohne Datenbank:
//   1. Default (Redis): Zähler landet unter dem bisherigen Key in Redis, ab Deckel+1 → 429.
//   2. STORAGE_BACKEND=supabase: Zähler läuft über rpc/sync_rate_hit, Redis wird nicht angefasst.
//   3. Supabase nicht erreichbar → fail-open mit dem bisherigen Alarmnamen, kein 429.
'use strict';
const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let pass = 0;

// ── alertOps-Spion (wie test-alert-ausloeser.js) ──────────────────────────────
const ALERTMOD = require.resolve(path.join(ROOT, 'api', '_alert.js'));
let alarme = [];
require.cache[ALERTMOD] = { id: ALERTMOD, filename: ALERTMOD, loaded: true, exports: {
    alertOps: async (source, event, detail) => { alarme.push({ source, event, detail }); return true; },
    alertZiele: () => ({ webhook: false, blob: false })
} };

function load(datei, env) {
    for (const k of ['STORAGE_BACKEND', 'STORAGE_MIRROR', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
                     'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) delete process.env[k];
    Object.assign(process.env, env);
    for (const f of ['api/' + datei, 'api/_sync-store.js', 'api/_db.js']) delete require.cache[path.join(ROOT, f)];
    alarme = [];
    return require('../api/' + datei);
}
function mkRes() {
    const r = { code: 0, body: null };
    r.setHeader = () => r; r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; }; r.end = () => r;
    return r;
}
function mkReq(body) { return { method: 'POST', headers: { 'x-vercel-forwarded-for': '203.0.113.9' }, body }; }

const kv = new Map();
let redisCalls = 0, supabaseUp = true;
const rpc = new Map(), rpcCalls = [];
global.fetch = async (url, opts) => {
    if (url === 'http://redis.mock') {
        redisCalls++;
        const c = JSON.parse(opts.body);
        if (c[0] === 'INCR') { const v = +(kv.get(c[1]) || 0) + 1; kv.set(c[1], v); return { json: async () => ({ result: v }) }; }
        return { json: async () => ({ result: 1 }) };
    }
    if (url === 'http://sb.mock/rest/v1/rpc/sync_rate_hit') {
        if (!supabaseUp) return { ok: false, status: 503, text: async () => '' };
        const b = JSON.parse(opts.body);
        rpcCalls.push(b);
        const v = (rpc.get(b.p_key) || 0) + 1; rpc.set(b.p_key, v);
        return { ok: true, status: 200, text: async () => String(v) };
    }
    // Whop: 401 beendet die Handler kontrolliert nach dem Rate-Limit
    return { ok: false, status: 401, json: async () => ({}), text: async () => '' };
};

const REDIS = { UPSTASH_REDIS_REST_URL: 'http://redis.mock', UPSTASH_REDIS_REST_TOKEN: 'x' };
const SB    = { STORAGE_BACKEND: 'supabase', SUPABASE_URL: 'http://sb.mock/', SUPABASE_SERVICE_ROLE_KEY: 'svc' };
const FAELLE = [
    { datei: 'whop-token.js',  max: 8,  key: 'whoptoken:rl:203.0.113.9',   body: {},                 openEvent: 'rate-limit-open' },
    { datei: 'whop-access.js', max: 30, key: 'whopaccess:iprl:203.0.113.9', body: { token: 'tok' },  openEvent: 'ip-rate-limit-open' }
];

const origErr = console.error, origWarn = console.warn;
console.error = console.warn = () => {};

(async () => {
    for (const f of FAELLE) {
        // ── 1. Redis (Default) ────────────────────────────────────────────────
        kv.clear(); redisCalls = 0; rpcCalls.length = 0;
        let h = load(f.datei, REDIS), r;
        for (let i = 0; i < f.max; i++) { r = mkRes(); await h(mkReq(f.body), r); assert.notStrictEqual(r.code, 429, f.datei + ' Anfrage ' + (i + 1)); }
        r = mkRes(); await h(mkReq(f.body), r);
        assert.strictEqual(r.code, 429, f.datei + ': Deckel+1 → 429');
        assert.strictEqual(kv.get(f.key), f.max + 1, f.datei + ': bisheriger Redis-Key');
        assert.strictEqual(rpcCalls.length, 0);
        assert.strictEqual(alarme.length, 0, f.datei + ': kein Alarm im Normalbetrieb');
        pass++; console.log('✓ ' + f.datei + ': Default zählt in Redis, Deckel ' + f.max);

        // ── 2. Supabase ───────────────────────────────────────────────────────
        rpc.clear(); rpcCalls.length = 0; redisCalls = 0;
        h = load(f.datei, Object.assign({}, REDIS, SB));
        for (let i = 0; i < f.max; i++) { r = mkRes(); await h(mkReq(f.body), r); assert.notStrictEqual(r.code, 429); }
        r = mkRes(); await h(mkReq(f.body), r);
        assert.strictEqual(r.code, 429, f.datei + ': Supabase-Deckel+1 → 429');
        assert.deepStrictEqual(rpcCalls[0], { p_key: f.key, p_window: 60 });
        if (f.datei === 'whop-access.js') assert.strictEqual(redisCalls, 0, 'whop-access fasst Redis nicht mehr an');
        pass++; console.log('✓ ' + f.datei + ': STORAGE_BACKEND=supabase zählt über sync_rate_hit');

        // ── 3. Supabase down → fail-open ──────────────────────────────────────
        supabaseUp = false;
        h = load(f.datei, SB);
        r = mkRes(); await h(mkReq(f.body), r);
        supabaseUp = true;
        assert.notStrictEqual(r.code, 429);
        assert.ok(alarme.some(a => a.event === f.openEvent), f.datei + ': Alarm ' + f.openEvent);
        pass++; console.log('✓ ' + f.datei + ': Supabase-Ausfall → fail-open, Alarm ' + f.openEvent);

        // ── 4. Supabase ohne Zugangsdaten → bisheriger Alarm rate-limit-inaktiv ──
        h = load(f.datei, { STORAGE_BACKEND: 'supabase' });
        r = mkRes(); await h(mkReq(f.body), r);
        assert.ok(alarme.some(a => a.event === 'rate-limit-inaktiv' && /SUPABASE_URL/.test(a.detail)), f.datei + ': rate-limit-inaktiv');
        pass++; console.log('✓ ' + f.datei + ': fehlende Supabase-Env → rate-limit-inaktiv');
    }
    console.error = origErr; console.warn = origWarn;
    console.log('\n' + pass + ' Prüfungen bestanden');
})().catch((e) => { console.error = origErr; console.error(e); process.exit(1); });
