// Stackr — Speicher für Whop-Refresh-Sitzungen (Upstash Redis ODER Supabase)
// =============================================================================
// Genutzt von api/whop-token.js (Sitzung anlegen) und api/whop-refresh.js (lesen,
// rotieren, widerrufen, Sperre). Welches System dahinter liegt, entscheiden dieselben
// Env-Variablen wie in api/_sync-store.js (plan/supabase-umzug-2026-10-06.md):
//
//   STORAGE_BACKEND   'redis' (Default) | 'supabase' — Lesen, Sperre, Schreiben
//   STORAGE_MIRROR    leer | 'supabase' | 'redis'    — bekommt jede Schreibung und
//                     jedes Löschen der Sitzung zusätzlich, die Sperre nicht.
//
// WARUM EIN SPIEGEL: Die Sitzung lebt 30 Tage und ist nur dort bekannt, wo sie
// geschrieben wurde. Schaltet man STORAGE_BACKEND um, ohne dass Supabase sie kennt,
// antwortet whop-refresh 401 — und der Client löscht daraufhin seine Sitzungs-ID
// (js/whop-auth.js). Jeder Kunde müsste sich neu anmelden. Mit Spiegel landet jede
// neu angelegte oder rotierte Sitzung in beiden Systemen.
//
// Redis-Weg: exakt die Befehle, Keys und TTLs von vor dem Umzug, mit derselben
// redisCmd wie bisher in whop-token/whop-refresh — wirft also NICHT bei { error }.
// Supabase-Weg: Funktionen aus supabase/migrations/20261008000001_whop_sessions.sql,
// Fehler werfen (api/_db.js). Ein Spiegel-Fehler bricht den Request nicht ab, er geht
// an api/_alert.js ('whop-session'/'mirror-failed').
//
// Der Dateiname beginnt mit "_", damit Vercel sie NICHT als Route ausliefert.
// =============================================================================

var alertOps = require('./_alert.js').alertOps;
var _log     = require('./_log.js');
var db       = require('./_db.js');

var SESSION_TTL_S = 30 * 24 * 60 * 60; // 30 Tage

// ── Upstash Redis ────────────────────────────────────────────────────────────
var REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '';
var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

function redisCmd(cmd) {
    return fetch(REDIS_URL, {
        method:  'POST',
        headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
        body:    JSON.stringify(cmd),
        signal:  AbortSignal.timeout(8000)
    }).then(function (r) { return r.json(); }).then(function (j) { return j ? j.result : null; });
}

function sessKey(sid) { return 'whoprt:' + sid; }

var redis = {
    name: 'redis',
    isConfigured: function () { return !!(REDIS_URL && REDIS_TOKEN); },
    get: async function (sid) {
        var raw = await redisCmd(['GET', sessKey(sid)]);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch (e) { return null; }
    },
    put: async function (sid, entry) {
        await redisCmd(['SET', sessKey(sid), JSON.stringify(entry), 'EX', String(SESSION_TTL_S)]);
    },
    del:    async function (sid) { await redisCmd(['DEL', sessKey(sid)]); },
    lock:   async function (sid, secs) {
        return (await redisCmd(['SET', 'whoprt:lock:' + sid, '1', 'NX', 'EX', String(secs)])) !== null;
    },
    unlock: async function (sid) { await redisCmd(['DEL', 'whoprt:lock:' + sid]); }
};

// ── Supabase ─────────────────────────────────────────────────────────────────
var supabase = {
    name: 'supabase',
    isConfigured: db.isConfigured,
    get:    function (sid) { return db.rpc('sync_whop_session_get', { p_sid: sid }); },
    put:    async function (sid, entry) { await db.rpc('sync_whop_session_put', { p_sid: sid, p_data: entry, p_ttl: SESSION_TTL_S }); },
    del:    async function (sid) { await db.rpc('sync_whop_session_delete', { p_sid: sid }); },
    lock:   async function (sid, secs) { return (await db.rpc('sync_whop_lock', { p_sid: sid, p_secs: secs })) === true; },
    unlock: async function (sid) { await db.rpc('sync_whop_unlock', { p_sid: sid }); }
};

// ── Auswahl + Spiegel (wie api/_sync-store.js) ───────────────────────────────
var BACKENDS = { redis: redis, supabase: supabase };
var P = BACKENDS[process.env.STORAGE_BACKEND || 'redis'] || null;
var M = BACKENDS[process.env.STORAGE_MIRROR || ''] || null;
if (M === P) M = null;

async function mirror(op, fn) {
    if (!M) return;
    try {
        if (!M.isConfigured()) throw new Error(M.name + ' env missing');
        await fn(M);
    } catch (e) {
        _log.logWarn('whop-session', 'MIRROR_FAILED', op + ': ' + (e && e.message));
        await alertOps('whop-session', 'mirror-failed', M.name + ' ' + op + ': ' + (e && e.message));
    }
}

// Fehlermeldung, wenn das primäre System nicht nutzbar ist, sonst ''.
function configProblem() {
    if (!P) return 'STORAGE_BACKEND unbekannt: ' + process.env.STORAGE_BACKEND;
    if (!P.isConfigured()) {
        return P.name === 'redis'
            ? 'UPSTASH_REDIS_REST_URL/TOKEN nicht gesetzt'
            : 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY nicht gesetzt';
    }
    return '';
}

module.exports = {
    configProblem: configProblem,

    get:    function (sid) { return P.get(sid); },
    lock:   function (sid, secs) { return P.lock(sid, secs); },
    unlock: function (sid) { return P.unlock(sid); },

    put: async function (sid, entry) {
        await P.put(sid, entry);
        await mirror('put', function (m) { return m.put(sid, entry); });
    },
    del: async function (sid) {
        await P.del(sid);
        await mirror('del', function (m) { return m.del(sid); });
    }
};
