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
// Redis-Weg: exakt die Befehle, Keys und TTLs von vor dem Umzug.
// Supabase-Weg: Funktionen aus supabase/migrations/20261008000001_whop_sessions.sql.
// Beide werfen bei jedem Speicherfehler — auch bei einer Upstash-Antwort { error }.
// Bis 2026-10-08 wurde die still als "keine Sitzung" gelesen: 401, der Client löschte
// seine Sitzungs-ID, der Kunde war wegen einer Redis-Störung abgemeldet.
// Ein Spiegel-Fehler bricht den Request nicht ab, er geht an api/_alert.js
// ('whop-session'/'mirror-failed').
//
// VERSCHLÜSSELUNG (nur Supabase, Entscheidung User 2026-10-08 zu E1):
// In Supabase liegt { rt, at, exp } nur als AES-256-GCM-Chiffrat { v, iv, ct, tag }.
// Schlüssel: WHOP_SESSION_KEY, 32 Byte Base64. Die Sitzungs-ID ist AAD — ein Chiffrat
// lässt sich also nicht unter eine andere ID kopieren. Ohne gültigen Schlüssel gilt
// Supabase als nicht konfiguriert. Lässt sich ein Eintrag nicht entschlüsseln (falscher
// Schlüssel, beschädigt), wirft get — das wird 503, nie 401: mit dem richtigen
// Schlüssel ist die Sitzung wieder lesbar. Redis bleibt Klartext wie bisher.
//
// Der Dateiname beginnt mit "_", damit Vercel sie NICHT als Route ausliefert.
// =============================================================================

var crypto   = require('crypto');
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
    }).then(function (r) { return r.json(); })
      .then(function (j) {
          if (j && j.error) throw new Error('Redis: ' + j.error);
          return j ? j.result : null;
      });
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
var SEAL_KEY = (function () {
    var b = Buffer.from(process.env.WHOP_SESSION_KEY || '', 'base64');
    return b.length === 32 ? b : null;
})();

function seal(sid, entry) {
    var iv = crypto.randomBytes(12);
    var c  = crypto.createCipheriv('aes-256-gcm', SEAL_KEY, iv);
    c.setAAD(Buffer.from(sid, 'utf8'));
    var ct = Buffer.concat([c.update(JSON.stringify(entry), 'utf8'), c.final()]);
    return { v: 1, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: c.getAuthTag().toString('base64') };
}

function unseal(sid, box) {
    if (!box) return null;
    if (box.v !== 1) throw new Error('Sitzung: unbekanntes Format');
    var d = crypto.createDecipheriv('aes-256-gcm', SEAL_KEY, Buffer.from(box.iv, 'base64'));
    d.setAAD(Buffer.from(sid, 'utf8'));
    d.setAuthTag(Buffer.from(box.tag, 'base64'));
    var pt = Buffer.concat([d.update(Buffer.from(box.ct, 'base64')), d.final()]);
    return JSON.parse(pt.toString('utf8'));
}

var supabase = {
    name: 'supabase',
    isConfigured: function () { return db.isConfigured() && !!SEAL_KEY; },
    get:    async function (sid) { return unseal(sid, await db.rpc('sync_whop_session_get', { p_sid: sid })); },
    put:    async function (sid, entry) { await db.rpc('sync_whop_session_put', { p_sid: sid, p_data: seal(sid, entry), p_ttl: SESSION_TTL_S }); },
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
        if (!M.isConfigured()) throw new Error(M.name + ' env missing (bei supabase auch WHOP_SESSION_KEY)');
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
            : (db.isConfigured() ? 'WHOP_SESSION_KEY fehlt oder ist nicht 32 Byte Base64'
                                 : 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY nicht gesetzt');
    }
    return '';
}

// Täglicher Lauf aus api/blob-cleanup.js: abgelaufene Sitzungen physisch löschen.
// Läuft, sobald Supabase primär ODER Spiegel ist — in der Spiegelphase (mindestens
// 30 Tage) liegen dort ja schon Sitzungen. Braucht keinen WHOP_SESSION_KEY.
// null = nichts zu tun; Fehler werfen (der Aufrufer meldet sie).
function aufraeumen() {
    var nutzt = (P && P.name === 'supabase') || (M && M.name === 'supabase');
    if (!nutzt || !db.isConfigured()) return Promise.resolve(null);
    return db.rpc('sync_whop_aufraeumen', {});
}

module.exports = {
    configProblem: configProblem,
    aufraeumen:    aufraeumen,

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
