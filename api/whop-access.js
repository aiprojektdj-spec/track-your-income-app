// Vercel Serverless Function — Whop Membership / Zugangs-Check (serverseitig)
//
// Warum serverseitig: Ein OAuth-USER-Token darf bei Whop nur /oauth/userinfo lesen;
// /v5/me/* lehnt es mit 403 "Your token is invalid" ab. Der Mitgliedschafts-Check
// braucht einen Company-API-Key, der NIEMALS in den Browser darf → er lebt hier im Backend.
// (Die früher genutzte Route /v5/me/has-access/<id> existiert bei Whop gar nicht → 404,
//  dadurch wurde JEDER zahlende Kunde ausgesperrt.)
//
// Flow:
//   1. Client schickt sein OAuth-User-Token.
//   2. Wir leiten daraus serverseitig die user_id ab (/oauth/userinfo) — der Client-ID
//      wird nie vertraut.
//   3. Mit WHOP_API_KEY (Company-API-Key): GET /v5/company/memberships?valid=true
//      → durchsuchen nach einer gültigen Membership mit dieser user_id.
//      HINWEIS: Der user_id-Query-Filter wird von Whop bei Company-Keys IGNORIERT
//      (gibt immer alle zurück) → wir filtern selbst im Code. Der App-Endpoint
//      /v5/app/memberships (der user_id filtern würde) liefert mit Company-Key 403.
//
// Env:
//   WHOP_API_KEY            Company-API-Key aus dem Whop-Dashboard (Scope: "Read members")
//   WHOP_OWNER_USERNAMES    optional, kommagetrennt — Company-Owner ohne eigenes Abo

var OWNERS = (process.env.WHOP_OWNER_USERNAMES || 'secondlifevintage41')
    .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

// Durchsucht die Company-Memberships nach einer gültigen Mitgliedschaft der user_id.
// Paginiert (Filter wirkt nicht → selbst matchen), mit Seiten-Obergrenze als Schutz.
async function _hasValidMembership(apiKey, userId) {
    var page = 1, MAX_PAGES = 20;
    while (page <= MAX_PAGES) {
        var res = await fetch('https://api.whop.com/v5/company/memberships?valid=true&per=50&page=' + page, {
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(8000)
        });
        if (!res.ok) {
            var body = ''; try { body = await res.text(); } catch (e) {}
            var err = new Error('memberships HTTP ' + res.status + ' ' + body);
            err.httpStatus = res.status;
            throw err;
        }
        var json = await res.json();
        var list = (json && json.data) || [];
        for (var i = 0; i < list.length; i++) {
            var m = list[i];
            if (m && m.user_id === userId &&
                (m.valid === true || m.status === 'active' || m.status === 'trialing')) {
                return true;
            }
        }
        var pg = json && json.pagination;
        if (!pg || !pg.next_page || list.length === 0) break;
        page = pg.next_page;
    }
    return false;
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

    var apiKey = process.env.WHOP_API_KEY;
    if (!apiKey) {
        console.error('[whop-access] WHOP_API_KEY not set');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    try {
        // ── 1. user_id serverseitig aus dem User-Token ableiten ──────────────
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

        // Owner-Bypass: Company-Owner haben kein eigenes Abo (können sich nicht selbst abonnieren).
        if (OWNERS.indexOf(username) !== -1) {
            return res.status(200).json({ has_access: true, user_id: userId, owner: true });
        }

        // ── 2. Gültige Mitgliedschaft des Users prüfen (Company-API-Key) ─────
        var hasAccess = await _hasValidMembership(apiKey, userId);
        return res.status(200).json({ has_access: hasAccess, user_id: userId });
    } catch (err) {
        // 401/403 vom Membership-Call = falscher/fehlender API-Key → Serverfehler,
        // NICHT "kein Abo". Netz/5xx → ebenfalls 502 → Client nutzt Offline-Grace.
        console.error('[whop-access] error:', err && err.message);
        return res.status(502).json({ error: 'whop_unreachable' });
    }
};
