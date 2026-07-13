// Vercel Serverless Function — Whop Zugangs-Check (serverseitig)
//
// Zwei unabhängige Prüfwege, Zugang sobald EINER bestätigt — robust gegen die beiden
// bisherigen Ausfallursachen (falscher Endpoint bzw. fehlende Server-Env):
//
//   1. PRIMÄR — mit dem OAuth-USER-Token des Kunden gegen
//        GET https://api.whop.com/api/v2/me/has_access/<id>
//      Der has_access-Endpoint existiert bei Whop unter v2 (NICHT v5 → 404, NICHT
//      mit Bindestrich → 404). Braucht KEINEN Server-API-Key. Mit einer prod_-/biz_-ID
//      meldet Whop Zugang, wenn der Token-Inhaber eine gültige Membership hat.
//   2. FALLBACK — nur wenn WHOP_API_KEY gesetzt ist: Company-Membership-Scan mit dem
//        Company-API-Key gegen GET /v5/company/memberships?valid=true
//      (empirisch bestätigter Weg; user_id-Filter wird bei Company-Keys ignoriert →
//       im Code selbst nach user_id matchen).
//
// Historie (nicht wiederholen): /v5/me/has-access (Bindestrich) → 404;
//   /v5/me/has_access → 404 (Route existiert nur unter v2); has_access gegen die App-ID
//   app_… → false für Kunden (Produkte "includen" die OAuth-App nicht) → biz_/prod_ nutzen.
//
// Env:
//   WHOP_ACCESS_IDS       optional, kommagetrennt — Zugangs-IDs (prod_ zuerst, biz_ als Fallback)
//   WHOP_API_KEY          optional — Company-API-Key aktiviert den Fallback-Scan
//   WHOP_OWNER_USERNAMES  optional, kommagetrennt — Company-Owner ohne eigenes Abo

//   prod_wgVmaJg4sBVOD = "Stackr Pro" 15 €/Mon · prod_p1WHi5t65rAA6 = "Stackr" 135 €/Jahr · biz_2OEWYGlOwb8b0f = Company
var ACCESS_IDS = (process.env.WHOP_ACCESS_IDS || 'prod_wgVmaJg4sBVOD,prod_p1WHi5t65rAA6,biz_2OEWYGlOwb8b0f')
    .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

var WHOP_API_KEY = process.env.WHOP_API_KEY || '';

var OWNERS = (process.env.WHOP_OWNER_USERNAMES || 'secondlifevintage41')
    .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

// Erkennt Zugang in den unterschiedlichen has_access-/Membership-Shapes.
function _grants(obj) {
    return !!(obj && (obj.valid === true || obj.has_access === true ||
        obj.status === 'active' || obj.status === 'trialing' ||
        (obj.access_level && obj.access_level !== 'no_access')));
}

// PRIMÄR: has_access mit dem User-Token (v2). Rückgabe: true | false | null(unbestimmt).
// null = der Endpoint akzeptiert das Token nicht (401/403) → Aufrufer nutzt den Fallback.
// 5xx → wirft (→ 502 → Client-Offline-Grace).
async function _hasAccessViaToken(userToken) {
    // Alle IDs PARALLEL — sequentiell wären es bis 3×8 s = 24 s > Vercel-10-s-Limit → 502/Grace
    // beim Erst-Login eines Jahres-/Nicht-Kunden. Parallel = Worst Case 1×8 s.
    var results = await Promise.all(ACCESS_IDS.map(function (id) {
        return fetch('https://api.whop.com/api/v2/me/has_access/' + id, {
            headers: { 'Authorization': 'Bearer ' + userToken, 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(8000)
        }).then(async function (r) {
            if (r.status >= 500) { var e = new Error('has_access HTTP ' + r.status); e.httpStatus = r.status; throw e; }
            if (r.status === 401 || r.status === 403) return 'reject'; // Token hier nicht akzeptiert
            if (!r.ok) return 'skip';                                  // 4xx (ID-Form)
            var j = null; try { j = await r.json(); } catch (pe) { return 'skip'; }
            return (_grants(j) || _grants(j && j.data)) ? 'grant' : 'ok';
        });
    })); // 5xx wirft → Promise.all rejected → äußerer catch → 502 → Grace
    if (results.indexOf('grant') !== -1) return true;
    return results.indexOf('ok') !== -1 ? false : null; // mind. ein 2xx ohne Grant → false, sonst unbestimmt
}

// FALLBACK: Company-Membership-Scan mit dem Company-API-Key. Paginiert, Seiten-Obergrenze.
async function _hasAccessViaCompanyKey(userId) {
    var page = 1, MAX_PAGES = 200; // 200×50 = 10.000 valid memberships Kopfraum; nur Sicherheits-Deckel, Loop bricht ohnehin bei next_page=null
    while (page <= MAX_PAGES) {
        var res = await fetch('https://api.whop.com/v5/company/memberships?valid=true&per=50&page=' + page, {
            headers: { 'Authorization': 'Bearer ' + WHOP_API_KEY, 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(8000)
        });
        if (!res.ok) { var e = new Error('memberships HTTP ' + res.status); e.httpStatus = res.status; throw e; }
        var json = await res.json();
        var list = (json && json.data) || [];
        for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].user_id === userId && _grants(list[i])) return true;
        }
        var pg = json && json.pagination;
        if (!pg || !pg.next_page || list.length === 0) break;
        page = pg.next_page;
    }
    return false;
}

// Kombiniert: Token-Weg zuerst; bei true sofort Zugang. Sonst — wenn ein Company-Key
// vorhanden ist — der bewährte Membership-Scan als maßgebliche Zweitmeinung.
async function _checkAccess(userToken, userId) {
    var t = await _hasAccessViaToken(userToken);   // true | false | null
    if (t === true) return true;
    if (WHOP_API_KEY) return await _hasAccessViaCompanyKey(userId);
    if (t === false) return false;
    // Token-Endpoint unbestimmt UND kein Company-Key → nicht entscheidbar:
    // einen zahlenden Kunden NICHT fälschlich aussperren → als Serverproblem behandeln.
    var e = new Error('access_undeterminable (no WHOP_API_KEY, token endpoint rejected user token)');
    e.httpStatus = 502;
    throw e;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://track-your-income-app.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

    var token = req.body && req.body.token;
    if (!token || typeof token !== 'string' || token.length > 4096) {
        return res.status(400).json({ error: 'Missing or invalid token' });
    }

    try {
        // ── 1. user_id + username serverseitig aus dem Token ableiten ─────────
        var meRes = await fetch('https://api.whop.com/oauth/userinfo', {
            headers: { 'Authorization': 'Bearer ' + token },
            signal:  AbortSignal.timeout(8000)
        });
        if (meRes.status === 401 || meRes.status === 403) {
            return res.status(401).json({ error: 'invalid_token' });
        }
        if (!meRes.ok) {
            return res.status(502).json({ error: 'whop_unreachable' }); // → Client: Offline-Grace
        }
        var me       = await meRes.json();
        var userId   = me.sub;
        var username = me.preferred_username || me.name || me.sub || '';

        if (!userId) return res.status(502).json({ error: 'no_user_id' });

        // Owner-Bypass: Company-Owner haben kein eigenes Abo.
        if (OWNERS.indexOf(username) !== -1) {
            return res.status(200).json({ has_access: true, user_id: userId, owner: true });
        }

        // ── 2. Zugang prüfen (Token-Weg, dann ggf. Company-Key-Fallback) ─────
        var hasAccess = await _checkAccess(token, userId);
        return res.status(200).json({ has_access: hasAccess, user_id: userId });
    } catch (err) {
        // Netz/5xx/unbestimmt → 502 → Client nutzt Offline-Grace (kein falsches „kein Abo").
        console.error('[whop-access] error:', err && err.message);
        return res.status(502).json({ error: 'whop_unreachable' });
    }
};

// Test-Hook (siehe test-whop-access.js) — reine Zugangs-Logik ohne HTTP-Handler
module.exports._test = { _hasAccessViaToken: _hasAccessViaToken, _grants: _grants };
