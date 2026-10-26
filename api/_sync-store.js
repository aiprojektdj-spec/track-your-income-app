// Stackr — Speicher-Adapter für api/sync.js (Upstash Redis ODER Supabase)
// =============================================================================
// Phase 1 des Plans vom 2026-10-06: Upstash wird durch Supabase ersetzt, ohne dass
// sich für Nutzer etwas ändert. api/sync.js spricht nur noch diese Operationen an;
// welches System dahinter liegt, entscheiden zwei Env-Variablen:
//
//   STORAGE_BACKEND   'redis' (Default, heutiger Stand) | 'supabase'
//                     — von hier wird gelesen, und hier entscheidet der CAS.
//   STORAGE_MIRROR    leer (Default) | 'supabase' | 'redis'
//                     — bekommt jede erfolgreiche Schreiboperation zusätzlich.
//                       Fehler im Spiegel brechen den Request NICHT ab, sie gehen
//                       an api/_alert.js.
//
// Umzug (plan: 1.3):
//   1. STORAGE_MIRROR=supabase                         Dual-Write, Lesen weiter Redis
//   2. Backfill (scripts/backfill-sync-supabase.js)    Altbestand kopieren
//   3. STORAGE_BACKEND=supabase, STORAGE_MIRROR=redis  Lesen umgeschaltet, Redis bleibt
//                                                      aktuell → Rückweg = Variablen tauschen
//   4. nach 14 Tagen STORAGE_MIRROR leeren, Upstash abschalten
//
// Rate-Limits laufen nur gegen das primäre System und werden nicht gespiegelt.
//
// Der Dateiname beginnt mit "_", damit Vercel sie NICHT als Route ausliefert.
// =============================================================================

var alertOps = require('./_alert.js').alertOps;
var _log     = require('./_log.js');
var db       = require('./_db.js');

// Spiegel bekommt keinen Deckel — der wurde schon im primären System geprüft.
var NO_CAP = 1000000000;

// ── Upstash Redis ────────────────────────────────────────────────────────────
// Variablennamen je nach Setup (manuell UPSTASH_* oder Vercel-Integration KV_*).
var REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '';
var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

// CAS-Skript: setzt nur, wenn die gespeicherte Version == erwarteter Version.
// Bei Konflikt wird der aktuelle Wert zurückgegeben → Client macht pull-merge-retry.
var CAS_LUA = [
    "local cur = redis.call('GET', KEYS[1])",
    "if cur then",
    "  local ok, obj = pcall(cjson.decode, cur)",
    "  if (not ok) or (tostring(obj.version) ~= ARGV[1]) then return cur end",
    "end",
    "redis.call('SET', KEYS[1], ARGV[2])",
    "return 'OK'"
].join('\n');

function redisCmd(cmd) {
    // ponytail: timeout = lazy circuit breaker. Hung Redis fast-fails instead of
    // holding the function until platform kill. Full breaker is pointless on a
    // stateless serverless fn — trip state dies with each cold start.
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

function parseOrNull(s) { return s ? JSON.parse(s) : null; }

var redis = {
    name: 'redis',
    isConfigured: function () { return !!(REDIS_URL && REDIS_TOKEN); },

    rateHit: async function (key, windowSec) {
        var n = await redisCmd(['INCR', key]);
        // NX: setzt TTL nur wenn keiner existiert — heilt Keys, deren EXPIRE nach dem
        // ersten INCR fehlschlug (sonst permanenter 429 für den Nutzer)
        await redisCmd(['EXPIRE', key, String(windowSec), 'NX']);
        return Number(n);
    },
    // Wie rateHit, aber um delta (auch negativ, fuer die Ruecknahme). Byte-Budget in blob-upload.
    counterAdd: async function (key, delta, windowSec) {
        var n = await redisCmd(['INCRBY', key, String(delta)]);
        await redisCmd(['EXPIRE', key, String(windowSec), 'NX']);
        return Number(n);
    },
    lockTry:     async function (key, ttlSec) { return (await redisCmd(['SET', key, '1', 'NX', 'EX', String(ttlSec)])) !== null; },
    lockRelease: async function (key) { await redisCmd(['DEL', key]); },

    get: async function (u, s) { return parseOrNull(await redisCmd(['GET', 'sync:' + u + ':' + s])); },
    cas: async function (u, s, expected, data) {
        var r = await redisCmd(['EVAL', CAS_LUA, '1', 'sync:' + u + ':' + s, String(expected), JSON.stringify(data)]);
        return r === 'OK' ? { ok: true } : { ok: false, current: parseOrNull(r) };
    },
    put: async function (u, s, data) { await redisCmd(['SET', 'sync:' + u + ':' + s, JSON.stringify(data)]); },
    del: async function (u, s) { await redisCmd(['DEL', 'sync:' + u + ':' + s]); },

    // Reihenfolge SADD → SCARD → ggf. SREM: dadurch kann die Menge nie dauerhaft über dem
    // Deckel liegen, auch wenn zwei Requests gleichzeitig ankommen. Ein bereits belegter
    // Scope (SADD gibt 0) läuft immer durch — Bestandsdaten bleiben schreibbar.
    claimScope: async function (u, s, max) {
        var added = await redisCmd(['SADD', 'scopes:' + u, s]);
        if (Number(added) !== 1) return true;
        var total = await redisCmd(['SCARD', 'scopes:' + u]);
        if (Number(total) <= max) return true;
        await redisCmd(['SREM', 'scopes:' + u, s]);
        return false;
    },
    releaseScope: async function (u, s) { await redisCmd(['SREM', 'scopes:' + u, s]); },
    listScopes:   async function (u) { return (await redisCmd(['SMEMBERS', 'scopes:' + u])) || []; },
    clearScopes:  async function (u) { await redisCmd(['DEL', 'scopes:' + u]); },

    // Unverdrängbar (Audit 2026-10-13, S3) — vorher RPUSH + LTRIM auf die neuesten `max`:
    // neue Einträge schoben die alten Beweise hinaus. Jetzt je Event-ID ein eigener Schlüssel
    // (SET NX), gleicher Hash = idempotent, anderer Hash = Konflikt, Kapazität vor dem Schreiben.
    // Rückgabe wie sync_append_anchors_v2: { status: 'ok'|'conflict'|'capacity', ... }.
    // Nicht atomar über mehrere Kommandos; zwei gleichzeitige Anfragen desselben Nutzers können
    // die Kapazität um höchstens eine Anfrage überziehen, die Einmaligkeit sichert SET NX.
    appendAnchors: async function (u, s, rows, max, maxUser) {
        var key = 'syncanchor:' + u + ':' + s, idPfx = 'syncanchorid:' + u + ':' + s + ':';
        var konflikt = [], neu = [], gesehen = {};
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            if (gesehen[r.id] !== undefined) { if (gesehen[r.id] !== r.h) konflikt.push(r.id); continue; }
            gesehen[r.id] = r.h;
            var alt = await redisCmd(['GET', idPfx + r.id]);
            if (alt === null || alt === undefined) neu.push(r);
            else if (alt !== r.h) konflikt.push(r.id);
        }
        if (konflikt.length) return { status: 'conflict', ids: konflikt };
        if (!neu.length) return { status: 'ok', added: 0 };
        var lenScope = Number(await redisCmd(['LLEN', key])) || 0;
        var lenUser  = Number(await redisCmd(['GET', 'syncanchorcount:' + u])) || 0;
        if (lenScope + neu.length > max || lenUser + neu.length > maxUser)
            return { status: 'capacity', scope: lenScope, user: lenUser };
        var geschrieben = [];
        for (var j = 0; j < neu.length; j++) {
            var setz = await redisCmd(['SET', idPfx + neu[j].id, neu[j].h, 'NX']);
            if (setz === null) {   // parallel angelegt — nur bei gleichem Hash harmlos
                if ((await redisCmd(['GET', idPfx + neu[j].id])) !== neu[j].h) konflikt.push(neu[j].id);
                continue;
            }
            geschrieben.push(neu[j]);
        }
        if (geschrieben.length) {
            await redisCmd(['RPUSH', key].concat(geschrieben.map(function (r) { return JSON.stringify(r); })));
            await redisCmd(['INCRBY', 'syncanchorcount:' + u, String(geschrieben.length)]);
        }
        if (konflikt.length) return { status: 'conflict', ids: konflikt, added: geschrieben.length };
        return { status: 'ok', added: geschrieben.length };
    },
    listAnchors: async function (u, s) {
        var raw = (await redisCmd(['LRANGE', 'syncanchor:' + u + ':' + s, '0', '-1'])) || [];
        return raw.map(function (r) { try { return JSON.parse(r); } catch (e) { return null; } }).filter(Boolean);
    },

    setPubkey: async function (u, data) { await redisCmd(['SET', 'pubkey:' + u, JSON.stringify(data)]); },
    getPubkey: async function (u) { return parseOrNull(await redisCmd(['GET', 'pubkey:' + u])); },
    delPubkey: async function (u) { await redisCmd(['DEL', 'pubkey:' + u]); },

    // Alle Nutzer mit Sync-Daten (api/_loeschung.js). SCAN über sync:<user>:<scope> und
    // scopes:<user>; sync:rl:… und sync:iprl:… fallen durch den Filter auf Whop-IDs (user_…).
    listUsers: async function () {
        var set = {}, muster = ['sync:*', 'scopes:*'];
        for (var m = 0; m < muster.length; m++) {
            var cursor = '0', runden = 0;
            do {
                var r = await redisCmd(['SCAN', cursor, 'MATCH', muster[m], 'COUNT', '1000']);
                cursor = String((r && r[0]) || '0');
                ((r && r[1]) || []).forEach(function (k) {
                    var teile = String(k).split(':');
                    var u = teile[0] === 'sync' ? teile.slice(1, -1).join(':') : teile.slice(1).join(':');
                    if (/^user_[A-Za-z0-9]+$/.test(u)) set[u] = 1;
                });
            } while (cursor !== '0' && ++runden < 10000);
        }
        return Object.keys(set).sort();
    },

    // Deckel wie claimScope; ein bereits bestehender Grantee läuft immer durch.
    addGrant: async function (o, g, data, max) {
        var added = await redisCmd(['SADD', 'grantsby:' + o, g]);
        if (Number(added) === 1 && Number(await redisCmd(['SCARD', 'grantsby:' + o])) > max) {
            await redisCmd(['SREM', 'grantsby:' + o, g]);
            return false;
        }
        await redisCmd(['SET', 'grant:' + o + ':' + g, JSON.stringify(data)]);
        await redisCmd(['SADD', 'grantsfor:' + g, o]);
        return true;
    },
    getGrant: async function (o, g) { return parseOrNull(await redisCmd(['GET', 'grant:' + o + ':' + g])); },
    revokeGrant: async function (o, g) {
        await redisCmd(['DEL', 'grant:' + o + ':' + g]);
        await redisCmd(['SREM', 'grantsfor:' + g, o]);
        await redisCmd(['SREM', 'grantsby:' + o, g]);
    },
    // [{ id: ownerId, data }]
    listGrantsFor: async function (g) {
        var owners = (await redisCmd(['SMEMBERS', 'grantsfor:' + g])) || [], out = [];
        for (var i = 0; i < owners.length; i++) {
            var v = await redisCmd(['GET', 'grant:' + owners[i] + ':' + g]);
            if (v) out.push({ id: owners[i], data: JSON.parse(v) });
        }
        return out;
    },
    // [{ id: granteeId, data }]
    listGranteesBy: async function (o) {
        var grantees = (await redisCmd(['SMEMBERS', 'grantsby:' + o])) || [], out = [];
        for (var i = 0; i < grantees.length; i++) {
            var v = await redisCmd(['GET', 'grant:' + o + ':' + grantees[i]]);
            if (v) out.push({ id: grantees[i], data: JSON.parse(v) });
        }
        return out;
    }
};

// ── Supabase (Funktionen aus supabase/migrations/20261006000001_sync.sql) ─────
var supabase = {
    name: 'supabase',
    isConfigured: db.isConfigured,

    rateHit: async function (key, windowSec) { return Number(await db.rpc('sync_rate_hit', { p_key: key, p_window: windowSec })); },
    // Funktionen aus supabase/migrations/20261008000002_blob_budget.sql
    counterAdd:  async function (key, delta, windowSec) { return Number(await db.rpc('sync_counter_add', { p_key: key, p_delta: delta, p_window: windowSec })); },
    lockTry:     async function (key, ttlSec) { return (await db.rpc('sync_lock_try', { p_key: key, p_ttl: ttlSec })) === true; },
    lockRelease: async function (key) { await db.rpc('sync_lock_release', { p_key: key }); },

    get: function (u, s) { return db.rpc('sync_get', { p_user: u, p_scope: s }); },
    cas: async function (u, s, expected, data) {
        var r = await db.rpc('sync_cas', { p_user: u, p_scope: s, p_expected: expected, p_data: data });
        return r && r.ok ? { ok: true } : { ok: false, current: (r && r.current) || null };
    },
    put: async function (u, s, data) { await db.rpc('sync_put', { p_user: u, p_scope: s, p_data: data }); },
    del: async function (u, s) { await db.rpc('sync_delete', { p_user: u, p_scope: s }); },

    claimScope:   async function (u, s, max) { return (await db.rpc('sync_claim_scope', { p_user: u, p_scope: s, p_max: max })) === true; },
    releaseScope: async function (u, s) { await db.rpc('sync_release_scope', { p_user: u, p_scope: s }); },
    listScopes:   async function (u) { return (await db.rpc('sync_list_scopes', { p_user: u })) || []; },
    clearScopes:  async function (u) { await db.rpc('sync_clear_scopes', { p_user: u }); },

    // supabase/migrations/20261015000001_anker_unverdraengbar.sql (S3)
    appendAnchors: async function (u, s, rows, max, maxUser) {
        return (await db.rpc('sync_append_anchors_v2', { p_user: u, p_scope: s, p_rows: rows, p_max: max, p_max_user: maxUser })) || { status: 'ok' };
    },
    listAnchors:   async function (u, s) { return (await db.rpc('sync_list_anchors', { p_user: u, p_scope: s })) || []; },

    setPubkey: async function (u, data) { await db.rpc('sync_set_pubkey', { p_user: u, p_data: data }); },
    getPubkey: function (u) { return db.rpc('sync_get_pubkey', { p_user: u }); },
    delPubkey: async function (u) { await db.rpc('sync_delete_pubkey', { p_user: u }); },
    listUsers: async function () { return (await db.rpc('sync_list_users', {})) || []; },

    addGrant:       async function (o, g, data, max) { return (await db.rpc('sync_add_grant', { p_owner: o, p_grantee: g, p_data: data, p_max: max })) === true; },
    getGrant:       function (o, g) { return db.rpc('sync_get_grant', { p_owner: o, p_grantee: g }); },
    revokeGrant:    async function (o, g) { await db.rpc('sync_revoke_grant', { p_owner: o, p_grantee: g }); },
    listGrantsFor:  async function (g) { return (await db.rpc('sync_list_grants_for', { p_grantee: g })) || []; },
    listGranteesBy: async function (o) { return (await db.rpc('sync_list_grantees_by', { p_owner: o })) || []; }
};

// ── Auswahl + Spiegel ────────────────────────────────────────────────────────
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
        _log.logWarn('sync', 'MIRROR_FAILED', op + ': ' + (e && e.message));
        await alertOps('sync', 'mirror-failed', M.name + ' ' + op + ': ' + (e && e.message));
    }
}

// Liefert eine Fehlermeldung, wenn das primäre System nicht nutzbar ist, sonst ''.
function configProblem() {
    if (!P) return 'STORAGE_BACKEND unbekannt: ' + process.env.STORAGE_BACKEND;
    if (!P.isConfigured()) {
        return P.name === 'redis'
            ? 'KV_REST_API_URL/TOKEN bzw. UPSTASH_REDIS_REST_* fehlen — Sync ist komplett aus'
            : 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY fehlen oder ungültig — Sync ist komplett aus';
    }
    return '';
}

module.exports = {
    configProblem: configProblem,
    backendName:   function () { return P ? P.name : ''; },

    // Lesen: nur primär
    rateHit:        function (key, w) { return P.rateHit(key, w); },
    // Zaehler und Sperren laufen wie rateHit nur gegen das primaere System, kein Spiegel
    counterAdd:     function (key, d, w) { return P.counterAdd(key, d, w); },
    lockTry:        function (key, ttl) { return P.lockTry(key, ttl); },
    lockRelease:    function (key) { return P.lockRelease(key); },
    get:            function (u, s) { return P.get(u, s); },
    listScopes:     function (u) { return P.listScopes(u); },
    listAnchors:    function (u, s) { return P.listAnchors(u, s); },
    getPubkey:      function (u) { return P.getPubkey(u); },
    getGrant:       function (o, g) { return P.getGrant(o, g); },
    listGrantsFor:  function (g) { return P.listGrantsFor(g); },
    listGranteesBy: function (o) { return P.listGranteesBy(o); },

    // Schreiben: primär entscheidet, Spiegel übernimmt nur das Ergebnis
    cas: async function (u, s, expected, data) {
        var r = await P.cas(u, s, expected, data);
        if (r.ok) await mirror('put', function (m) { return m.put(u, s, data); });
        return r;
    },
    del: async function (u, s) {
        await P.del(u, s);
        await mirror('del', function (m) { return m.del(u, s); });
    },
    claimScope: async function (u, s, max) {
        var ok = await P.claimScope(u, s, max);
        if (ok) await mirror('claimScope', function (m) { return m.claimScope(u, s, NO_CAP); });
        return ok;
    },
    releaseScope: async function (u, s) {
        await P.releaseScope(u, s);
        await mirror('releaseScope', function (m) { return m.releaseScope(u, s); });
    },
    clearScopes: async function (u) {
        await P.clearScopes(u);
        await mirror('clearScopes', function (m) { return m.clearScopes(u); });
    },
    appendAnchors: async function (u, s, rows, max, maxUser) {
        var r = await P.appendAnchors(u, s, rows, max, maxUser);
        // Spiegel nur mit dem tatsächlich Angenommenen; ohne eigenen Deckel (NO_CAP)
        if (r && r.status === 'ok' && r.added) await mirror('appendAnchors', function (m) { return m.appendAnchors(u, s, rows, NO_CAP, NO_CAP); });
        return r;
    },
    setPubkey: async function (u, data) {
        await P.setPubkey(u, data);
        await mirror('setPubkey', function (m) { return m.setPubkey(u, data); });
    },
    addGrant: async function (o, g, data, max) {
        var ok = await P.addGrant(o, g, data, max);
        if (ok) await mirror('addGrant', function (m) { return m.addGrant(o, g, data, NO_CAP); });
        return ok;
    },
    revokeGrant: async function (o, g) {
        await P.revokeGrant(o, g);
        await mirror('revokeGrant', function (m) { return m.revokeGrant(o, g); });
    },
    delPubkey: async function (u) {
        await P.delPubkey(u);
        await mirror('delPubkey', function (m) { return m.delPubkey(u); });
    },

    // Für api/_loeschung.js: Vereinigung aus primärem System und Spiegel — ein Nutzer, dessen
    // Daten nur noch im Spiegel liegen, muss trotzdem gelöscht werden. Scopes ebenso.
    listUsers: async function () {
        var a = await P.listUsers(), b = [];
        if (M && M.isConfigured()) { try { b = await M.listUsers(); } catch (e) { b = []; } }
        return Array.from(new Set(a.concat(b))).sort();
    },
    listScopesAlle: async function (u) {
        var a = await P.listScopes(u), b = [];
        if (M && M.isConfigured()) { try { b = await M.listScopes(u); } catch (e) { b = []; } }
        return Array.from(new Set(a.concat(b)));
    },

    // Für scripts/backfill-sync-supabase.js
    _backends: BACKENDS
};
