// Vercel Serverless Function — Shopify verbinden, Schritt 1 (Install-URL)
// =============================================================================
// POST { shop, companyId } mit Whop-Bearer-Token (Pro). Antwort { url } — der Browser leitet
// selbst dorthin um. Ein Redirect direkt von hier ginge nicht: eine Navigation trägt keinen
// Authorization-Header, und Nutzer/Firma müssen aus dem geprüften Whop-Token kommen.
//
// state (signiert mit SHOPIFY_CLIENT_SECRET) trägt Whop-Nutzer und Firma zum Callback; die
// Nonce steht zusätzlich im HttpOnly-Cookie (Path=/api/shopify-callback, SameSite=Lax — der
// Rücksprung von Shopify ist eine Top-Level-Navigation, Lax schickt den Cookie dabei mit).
// Ablauf und Prüfungen: api/_shopify.js.
//
// Env: SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_TOKEN_KEY (trägt der User ein),
//      dazu die Whop-/Owner-Variablen wie api/sync.js.
// =============================================================================
var _log    = require('./_log.js');
var store   = require('./_sync-store.js');
var db      = require('./_db.js');
var S       = require('./_shopify.js');
var alertOps = require('./_alert.js').alertOps;
var setzeCorsOrigin = require('./_cors.js');

// ── Auth: identisch zu api/sync.js (Endpunkte sind eigenständige Funktionen ohne gemeinsames
// Modul, siehe api/whop-access.js) ──
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

var IP_RATE_MAX = 20;                      // Install-Versuche je IP und Minute
var COMPANY_RE  = /^co_[a-z0-9]{1,40}$/;   // js/companies.js: 'co_' + base36

// "mein-shop" oder "Mein-Shop.myshopify.com" → "mein-shop.myshopify.com"; alles andere bleibt
// stehen und fällt an istShopDomain durch.
function normShop(s) {
    var x = String(s || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return /^[a-z0-9][a-z0-9-]*$/.test(x) ? x + '.myshopify.com' : x;
}

module.exports = async function handler(req, res) {
    setzeCorsOrigin(req, res);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'method_not_allowed' });

    var clientId = process.env.SHOPIFY_CLIENT_ID || '', secret = process.env.SHOPIFY_CLIENT_SECRET || '';
    if (!clientId || !secret || !process.env.SHOPIFY_TOKEN_KEY || !db.isConfigured()) {
        _log.logError('shopify-install', 'SHOPIFY_ENV_MISSING');
        return res.status(503).json({ error: 'shopify_not_configured' });
    }

    var auth  = req.headers['authorization'] || '';
    var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : '';
    if (!token || token.length > 4096) return res.status(401).json({ error: 'no_token' });

    var body = req.body || {};
    var shop = normShop(body.shop);
    var companyId = String(body.companyId || '');
    if (!S.istShopDomain(shop))         return res.status(400).json({ error: 'invalid_shop' });
    if (!COMPANY_RE.test(companyId))    return res.status(400).json({ error: 'invalid_company' });

    // IP-Deckel vor Whop, wie api/blob-upload.js (fail-open mit Alarm)
    if (!store.configProblem()) {
        try {
            var ip = req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
            if (await store.rateHit('shopify:iprl:' + ip, 60) > IP_RATE_MAX) return res.status(429).json({ error: 'rate_limited' });
        } catch (e) {
            await alertOps('shopify-install', 'ip-rate-limit-open', e && e.message);
        }
    }

    var userId, prefUsername;
    try {
        var meRes = await fetch('https://api.whop.com/oauth/userinfo', {
            headers: { 'Authorization': 'Bearer ' + token }, signal: AbortSignal.timeout(8000)
        });
        if (!meRes.ok) return res.status(401).json({ error: 'invalid_token' });
        var me = await meRes.json();
        userId = me.sub || me.id;
        prefUsername = me.preferred_username || '';
        if (!userId) return res.status(401).json({ error: 'no_user' });
    } catch (e) {
        _log.logError('shopify-install', 'WHOP_USERINFO_FAILED', e);
        return res.status(502).json({ error: 'whop_unreachable' });
    }

    if (!isOwnerIdentity(userId, prefUsername)) {
        try {
            if (!(await whopHasAccess(token, userId))) return res.status(403).json({ error: 'pro_required' });
        } catch (e) {
            _log.logError('shopify-install', 'WHOP_ACCESS_FAILED', e);
            return res.status(502).json({ error: 'whop_unreachable' });
        }
    }

    // TODO R5: Owner-Prüfung per firma_rolle(p_user, p_company) = 'owner' hier wieder einbauen
    // (Code und Test in db7cf92). Bis R5 liegen keine Firmen auf dem Server, die Prüfung
    // würde jede Installation abweisen und den Shopify-Livetest verhindern.

    var st = S.erzeugeState(secret, shop, Date.now(), { u: userId, c: companyId });
    var basis = S.appBasis(req.headers['host']);
    res.setHeader('Set-Cookie', S.nonceCookie(st.nonce, Math.floor(S.STATE_MAX_ALTER_MS / 1000)));
    return res.status(200).json({
        url: S.installUrl({ shop: shop, clientId: clientId, redirectUri: basis + '/api/shopify-callback', state: st.state })
    });
};
