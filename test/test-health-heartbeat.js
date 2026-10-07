// Health-Check und Cron-Heartbeat:  node test/test-health-heartbeat.js
//
// plan/betrieb-luecken-2026-09-29.md §3. Geprüft wird:
//   api/health.js
//     1) Redis antwortet PONG      -> 200 { ok: true,  redis: "ok" }
//     2) Redis wirft / falsche Antwort / Env fehlt -> 503 { ok: false, redis: "down" }
//     3) Antwort enthält keine internen Details (nur ok + redis)
//     4) zweiter Aufruf binnen 30 s pingt Redis NICHT erneut
//     5) POST -> 405
//    10) Supabase wird nur geprüft, wenn STORAGE_BACKEND/STORAGE_MIRROR/BLOB_BACKEND es nutzen;
//        dann kippt ein Supabase-Ausfall die Antwort auf 503, Redis bleibt Pflicht
//   api/blob-cleanup.js
//     6) ohne HEARTBEAT_URL_BLOB_CLEANUP kein Netzverkehr (wie bei _alert.js)
//     7) mit URL: genau ein POST nach erfolgreichem Lauf
//     8) kein Ping im Selbsttest (?probe=1) und keiner nach fehlgeschlagenem Lauf
//     9) ein streikender Heartbeat kippt den Lauf nicht
'use strict';
const path = require('path');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name); }
}

// '@vercel/blob'-Attrappe; listFail simuliert einen kaputten Aufräumlauf.
const BLOBMOD = require.resolve('@vercel/blob');
let listFail = false;
require.cache[BLOBMOD] = {
    id: BLOBMOD, filename: BLOBMOD, loaded: true, exports: {
        list: function () { return listFail ? Promise.reject(new Error('blob weg')) : Promise.resolve({ blobs: [], hasMore: false }); },
        del:  function () { return Promise.resolve(); },
        put:  function () { return Promise.resolve({ url: 'https://blob.example/x' }); }
    }
};

let fetchCalls = [], fetchImpl = null;
global.fetch = function (url, opts) {
    fetchCalls.push({ url: url, opts: opts || {} });
    return fetchImpl(url, opts);
};

const HEALTHMOD  = path.join(__dirname, '..', 'api', 'health.js');
const ALERTMOD   = path.join(__dirname, '..', 'api', '_alert.js');
const CLEANUPMOD = path.join(__dirname, '..', 'api', 'blob-cleanup.js');
const ENV_KEYS = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
                  'CRON_SECRET', 'ALERT_WEBHOOK_URL', 'BLOB_READ_WRITE_TOKEN', 'HEARTBEAT_URL_BLOB_CLEANUP',
                  'STORAGE_BACKEND', 'STORAGE_MIRROR', 'BLOB_BACKEND', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

function fresh(mod, env) {
    [HEALTHMOD, ALERTMOD, CLEANUPMOD].forEach(function (m) { delete require.cache[require.resolve(m)]; });
    ENV_KEYS.forEach(function (k) { if (env[k]) process.env[k] = env[k]; else delete process.env[k]; });
    fetchCalls = [];
    listFail = false;
    return require(mod);
}
function mkReq(method, url, auth) {
    var q = {};
    if (url.indexOf('probe=1') !== -1) q.probe = '1';
    return { method: method, url: url, query: q, headers: auth ? { authorization: auth } : {} };
}
function mkRes() {
    var r = { code: 0, body: null, headers: {} };
    r.status    = function (c) { r.code = c; return r; };
    r.json      = function (b) { r.body = b; return r; };
    r.setHeader = function (k, v) { r.headers[k] = v; };
    return r;
}
function jsonAntwort(obj) { return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(obj); } }); }

const REDIS = { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'tok' };

(async function () {
    // ── health.js ────────────────────────────────────────────────────────────
    let h, res;

    fetchImpl = function () { return jsonAntwort({ result: 'PONG' }); };
    h = fresh(HEALTHMOD, REDIS); res = mkRes();
    await h(mkReq('GET', '/api/health'), res);
    check('1) PONG -> 200 ok', res.code === 200 && res.body.ok === true && res.body.redis === 'ok');
    check('3) Antwort nur ok + redis', Object.keys(res.body).sort().join(',') === 'ok,redis');
    check('   Cache-Control no-store', res.headers['Cache-Control'] === 'no-store');
    const vorher = fetchCalls.length;
    await h(mkReq('GET', '/api/health'), mkRes());
    check('4) zweiter Aufruf binnen 30 s ohne neuen Redis-Ping', fetchCalls.length === vorher);

    fetchImpl = function () { return Promise.reject(new Error('ECONNREFUSED 10.0.0.1')); };
    h = fresh(HEALTHMOD, REDIS); res = mkRes();
    await h(mkReq('GET', '/api/health'), res);
    check('2) Redis wirft -> 503 down', res.code === 503 && res.body.ok === false && res.body.redis === 'down');
    check('3) Fehlertext nicht in der Antwort', JSON.stringify(res.body).indexOf('ECONN') === -1);

    fetchImpl = function () { return jsonAntwort({ error: 'WRONGPASS' }); };
    h = fresh(HEALTHMOD, REDIS); res = mkRes();
    await h(mkReq('GET', '/api/health'), res);
    check('2) Redis-Fehlerantwort -> 503', res.code === 503);

    h = fresh(HEALTHMOD, {}); res = mkRes();
    await h(mkReq('GET', '/api/health'), res);
    check('2) Redis-Env fehlt -> 503 ohne Netzverkehr', res.code === 503 && fetchCalls.length === 0);

    h = fresh(HEALTHMOD, REDIS); res = mkRes();
    await h(mkReq('POST', '/api/health'), res);
    check('5) POST -> 405', res.code === 405);

    // ── health.js + Supabase ─────────────────────────────────────────────────
    const SB = Object.assign({ SUPABASE_URL: 'https://sb.example', SUPABASE_SERVICE_ROLE_KEY: 'svc' }, REDIS);
    let sbUp = true, redisUp = true;
    fetchImpl = function (url) {
        if (url.indexOf('https://sb.example/rest/v1/rpc/') === 0) {
            return Promise.resolve(sbUp ? { ok: true, status: 200, text: function () { return Promise.resolve('null'); } }
                                        : { ok: false, status: 503, text: function () { return Promise.resolve(''); } });
        }
        return redisUp ? jsonAntwort({ result: 'PONG' }) : Promise.reject(new Error('weg'));
    };

    h = fresh(HEALTHMOD, SB); res = mkRes();
    await h(mkReq('GET', '/api/health'), res);
    check('10) Supabase ungenutzt -> kein Ping, Antwort nur ok + redis',
          res.code === 200 && Object.keys(res.body).sort().join(',') === 'ok,redis' &&
          !fetchCalls.some(function (c) { return c.url.indexOf('sb.example') !== -1; }));

    for (const v of [{ STORAGE_BACKEND: 'supabase' }, { STORAGE_MIRROR: 'supabase' }, { BLOB_BACKEND: 'supabase' }]) {
        const name = Object.keys(v)[0];
        h = fresh(HEALTHMOD, Object.assign({}, SB, v)); res = mkRes();
        await h(mkReq('GET', '/api/health'), res);
        check('10) ' + name + '=supabase, beide da -> 200 mit supabase: ok',
              res.code === 200 && res.body.ok === true && res.body.redis === 'ok' && res.body.supabase === 'ok');
    }
    const rpcCall = fetchCalls.find(function (c) { return c.url.indexOf('sb.example') !== -1; });
    check('10) Ping ist der lesende rpc sync_get_pubkey',
          rpcCall && /\/rpc\/sync_get_pubkey$/.test(rpcCall.url) && JSON.parse(rpcCall.opts.body).p_user === '__health');

    sbUp = false;
    h = fresh(HEALTHMOD, Object.assign({ STORAGE_MIRROR: 'supabase' }, SB)); res = mkRes();
    await h(mkReq('GET', '/api/health'), res);
    check('10) Supabase down -> 503 supabase: down', res.code === 503 && res.body.ok === false &&
          res.body.redis === 'ok' && res.body.supabase === 'down');
    sbUp = true;

    h = fresh(HEALTHMOD, Object.assign({ STORAGE_BACKEND: 'supabase' }, REDIS)); res = mkRes();
    await h(mkReq('GET', '/api/health'), res);
    check('10) Supabase-Env fehlt -> 503 ohne Supabase-Netzverkehr', res.code === 503 && res.body.supabase === 'down' &&
          !fetchCalls.some(function (c) { return c.url.indexOf('sb.example') !== -1; }));

    redisUp = false;
    h = fresh(HEALTHMOD, Object.assign({ STORAGE_BACKEND: 'supabase' }, SB)); res = mkRes();
    await h(mkReq('GET', '/api/health'), res);
    check('10) Redis down bei STORAGE_BACKEND=supabase -> trotzdem 503', res.code === 503 &&
          res.body.redis === 'down' && res.body.supabase === 'ok');
    redisUp = true;

    // ── blob-cleanup.js Heartbeat ────────────────────────────────────────────
    const AUTH = 'Bearer s';
    const HB = 'https://hc-ping.example/uuid';
    fetchImpl = function () { return Promise.resolve({ ok: true, status: 200 }); };

    let c = fresh(CLEANUPMOD, { CRON_SECRET: 's' }); res = mkRes();
    await c(mkReq('GET', '/api/blob-cleanup', AUTH), res);
    check('6) ohne URL: Lauf ok, kein Netzverkehr', res.code === 200 && fetchCalls.length === 0);

    c = fresh(CLEANUPMOD, { CRON_SECRET: 's', HEARTBEAT_URL_BLOB_CLEANUP: HB }); res = mkRes();
    await c(mkReq('GET', '/api/blob-cleanup', AUTH), res);
    check('7) mit URL: genau ein POST an die URL', res.code === 200 && fetchCalls.length === 1 &&
          fetchCalls[0].url === HB && fetchCalls[0].opts.method === 'POST');

    c = fresh(CLEANUPMOD, { CRON_SECRET: 's', HEARTBEAT_URL_BLOB_CLEANUP: HB }); res = mkRes();
    await c(mkReq('GET', '/api/blob-cleanup?probe=1', AUTH), res);
    check('8) Selbsttest pingt nicht', res.code === 200 && res.body.probe === true &&
          !fetchCalls.some(function (f) { return f.url === HB; }));

    c = fresh(CLEANUPMOD, { CRON_SECRET: 's', HEARTBEAT_URL_BLOB_CLEANUP: HB }); listFail = true; res = mkRes();
    await c(mkReq('GET', '/api/blob-cleanup', AUTH), res);
    check('8) fehlgeschlagener Lauf pingt nicht', res.code === 500 &&
          !fetchCalls.some(function (f) { return f.url === HB; }));

    c = fresh(CLEANUPMOD, { CRON_SECRET: 's', HEARTBEAT_URL_BLOB_CLEANUP: HB });
    fetchImpl = function () { return Promise.reject(new Error('hc down')); };
    res = mkRes();
    await c(mkReq('GET', '/api/blob-cleanup', AUTH), res);
    check('9) streikender Heartbeat kippt den Lauf nicht', res.code === 200 && res.body.ok === true);

    // 401 ohne Ping — Fremdaufrufe dürfen den Dead-Man-Switch nicht füttern
    c = fresh(CLEANUPMOD, { CRON_SECRET: 's', HEARTBEAT_URL_BLOB_CLEANUP: HB });
    fetchImpl = function () { return Promise.resolve({ ok: true, status: 200 }); };
    res = mkRes();
    await c(mkReq('GET', '/api/blob-cleanup', 'Bearer falsch'), res);
    check('   falsches Token: 401, kein Ping', res.code === 401 && fetchCalls.length === 0);

    console.log('\n' + pass + '/' + total + ' bestanden');
    process.exit(pass === total ? 0 : 1);
})().catch(function (e) { console.error(e); process.exit(1); });
