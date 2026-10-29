// Whop-Identität für die Daten-Endpunkte (api/data.js) — Helfer, kein Endpunkt.
// =============================================================================
// Plan Abschnitt 1 „Identität im Server“ (plan/server-umbau-2026-10-22.md): bisher prüft jeder
// Endpunkt den Whop-Token bei JEDEM Request (userinfo + has_access, s. api/sync.js) — für eine
// serverführende App zu langsam und zu Whop-abhängig. Hier einmal prüfen und das Ergebnis
// (user_id, Pro) 5 Minuten unter SHA-256(Token) in auth_cache merken (RPCs
// sync_auth_cache_get/put, 20261022000002_server_datenmodell.sql). Nie der Token selbst.
//
// Pro-Gate wie heute (api/sync.js): Owner-Allowlist (SYNC_OWNER_IDS, Altweg
// SYNC_OWNER_USERNAMES) oder has_access über Whop.
//
// Annahme: Nur bestätigtes Pro wird gemerkt. Wer gerade erst bezahlt hat, soll nicht 5 Minuten
// lang ein gemerktes „kein Pro“ sehen; Nicht-Pro-Anfragen gehen deshalb jedes Mal zu Whop
// (bremst das IP-/Nutzer-Rate-Limit in api/data.js). Ein bei Whop widerrufener Token gilt
// höchstens noch 5 Minuten — so im Plan vorgesehen.
//
// Fällt auth_cache aus (Supabase weg), läuft die Prüfung wie bisher direkt gegen Whop.
// =============================================================================
var crypto = require('crypto');
var db     = require('./_db.js');
var _log   = require('./_log.js');

var TTL_S = 300;

// ── Whop: identisch zu api/sync.js (dort Herkunft und Begründung der Einzelheiten) ──
var ACCESS_IDS   = (process.env.WHOP_ACCESS_IDS || 'prod_wgVmaJg4sBVOD,prod_p1WHi5t65rAA6,biz_2OEWYGlOwb8b0f')
                       .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
var WHOP_API_KEY = process.env.WHOP_API_KEY || '';
var OWNER_IDS    = (process.env.SYNC_OWNER_IDS || '')
                       .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
var OWNERS       = (process.env.SYNC_OWNER_USERNAMES || '')
                       .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

function isOwnerIdentity(sub, prefUsername) {
    if (OWNER_IDS.length) return !!sub && OWNER_IDS.indexOf(sub) !== -1;
    return !!prefUsername && OWNERS.indexOf(prefUsername) !== -1;
}
function whopGrants(obj) {
    return !!(obj && (obj.valid === true || obj.has_access === true ||
        obj.status === 'active' || obj.status === 'trialing' ||
        (obj.access_level && obj.access_level !== 'no_access')));
}
async function whopHasAccessViaToken(userToken) {
    var results = await Promise.all(ACCESS_IDS.map(function (id) {
        return fetch('https://api.whop.com/api/v2/me/has_access/' + id, {
            headers: { 'Authorization': 'Bearer ' + userToken, 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(8000)
        }).then(async function (r) {
            if (r.status >= 500) { var e = new Error('has_access HTTP ' + r.status); e.httpStatus = r.status; throw e; }
            if (r.status === 401 || r.status === 403) return 'reject';
            if (!r.ok) return 'skip';
            var j = null; try { j = await r.json(); } catch (pe) { return 'skip'; }
            return (whopGrants(j) || whopGrants(j && j.data)) ? 'grant' : 'ok';
        });
    }));
    if (results.indexOf('grant') !== -1) return true;
    return results.indexOf('ok') !== -1 ? false : null;
}
async function whopHasAccessViaCompanyKey(userId) {
    var page = 1, MAX_PAGES = 200;
    while (page <= MAX_PAGES) {
        var r = await fetch('https://api.whop.com/v5/company/memberships?valid=true&per=50&page=' + page, {
            headers: { 'Authorization': 'Bearer ' + WHOP_API_KEY, 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(8000)
        });
        if (!r.ok) { var e = new Error('memberships HTTP ' + r.status); e.httpStatus = r.status; throw e; }
        var j = await r.json();
        var list = (j && j.data) || [];
        for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].user_id === userId && whopGrants(list[i])) return true;
        }
        var pg = j && j.pagination;
        if (!pg || !pg.next_page || list.length === 0) break;
        page = pg.next_page;
    }
    return false;
}
async function whopHasAccess(userToken, userId) {
    var t = await whopHasAccessViaToken(userToken);
    if (t === true) return true;
    if (WHOP_API_KEY) return await whopHasAccessViaCompanyKey(userId);
    if (t === false) return false;
    var e = new Error('access_undeterminable'); e.httpStatus = 502; throw e;
}

function tokenHash(token) {
    return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

// → { ok: true, userId, pro, ausCache } | { ok: false, status, error }
async function pruefe(req) {
    var h = (req.headers && req.headers['authorization']) || '';
    var token = h.indexOf('Bearer ') === 0 ? h.slice(7) : '';
    if (!token || token.length > 4096) return { ok: false, status: 401, error: 'no_token' };
    var hash = tokenHash(token);

    try {
        var c = await db.rpc('sync_auth_cache_get', { p_hash: hash });
        if (c && c.user_id && c.pro === true) return { ok: true, userId: c.user_id, pro: true, ausCache: true };
    } catch (e) {
        _log.logError('auth', 'AUTH_CACHE_GET_FAILED', e);
    }

    var userId, prefUsername;
    try {
        var meRes = await fetch('https://api.whop.com/oauth/userinfo', {
            headers: { 'Authorization': 'Bearer ' + token }, signal: AbortSignal.timeout(8000)
        });
        if (!meRes.ok) return { ok: false, status: 401, error: 'invalid_token' };
        var me = await meRes.json();
        userId = me.sub || me.id;
        prefUsername = me.preferred_username || '';
        if (!userId) return { ok: false, status: 401, error: 'no_user' };
    } catch (e) {
        _log.logError('auth', 'WHOP_USERINFO_FAILED', e);
        return { ok: false, status: 502, error: 'whop_unreachable' };
    }

    var pro = isOwnerIdentity(userId, prefUsername);
    if (!pro) {
        try { pro = await whopHasAccess(token, userId); }
        catch (e) {
            _log.logError('auth', 'WHOP_ACCESS_FAILED', e);
            return { ok: false, status: 502, error: 'whop_unreachable' };
        }
    }
    if (pro) {
        try { await db.rpc('sync_auth_cache_put', { p_hash: hash, p_user: userId, p_pro: true, p_ttl: TTL_S }); }
        catch (e) { _log.logError('auth', 'AUTH_CACHE_PUT_FAILED', e); }
    }
    return { ok: true, userId: userId, pro: !!pro, ausCache: false };
}

module.exports = { pruefe: pruefe, tokenHash: tokenHash, TTL_S: TTL_S };
