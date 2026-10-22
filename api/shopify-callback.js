// Vercel Serverless Function — Shopify verbinden, Schritt 2 (Rücksprung von Shopify)
// =============================================================================
// GET ?code&hmac&shop&state&timestamp. Prüfreihenfolge: Query-HMAC → Shop-Domain → state
// (gegen Nonce-Cookie, trägt Whop-Nutzer und Firma) → Token holen → Scopes → Token
// verschlüsselt in `integrations` → Webhooks abonnieren → erste Seiten des Erstimports.
// Endet immer mit einem Redirect in die App: /app?shopify=verbunden | fehler&grund=…
// (feste Codes, nie Fehlertext).
//
// Erstimport: read_orders reicht 60 Tage zurück. Hier nur so viele Seiten, wie in das
// Zeitbudget passen; der Rest steht als import_cursor in `integrations` und wird von der
// Buchungsstufe (Stufe 2) fortgesetzt.
// =============================================================================
var _log = require('./_log.js');
var db   = require('./_db.js');
var S    = require('./_shopify.js');

var IMPORT_BUDGET_MS = 4000;

function zurueck(res, basis, ergebnis, grund) {
    res.setHeader('Set-Cookie', S.nonceCookie('', 0));
    res.setHeader('Location', basis + '/app?shopify=' + ergebnis + (grund ? '&grund=' + grund : ''));
    return res.status(302).end();
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    var basis = S.appBasis(req.headers['host']);
    if (req.method !== 'GET') return res.status(405).end();

    var clientId = process.env.SHOPIFY_CLIENT_ID || '', secret = process.env.SHOPIFY_CLIENT_SECRET || '';
    var key = process.env.SHOPIFY_TOKEN_KEY || '';
    if (!clientId || !secret || !key || !db.isConfigured()) {
        _log.logError('shopify-callback', 'SHOPIFY_ENV_MISSING');
        return zurueck(res, basis, 'fehler', 'konfiguration');
    }

    var q = req.query || {};
    if (!S.pruefeQueryHmac(q, secret))  return zurueck(res, basis, 'fehler', 'signatur');
    var shop = String(q.shop || '');
    if (!S.istShopDomain(shop))         return zurueck(res, basis, 'fehler', 'shop');
    var daten = S.pruefeState(q.state, S.leseCookie(req.headers['cookie'], S.NONCE_COOKIE), shop, secret, Date.now());
    if (!daten || !daten.u || !daten.c) return zurueck(res, basis, 'fehler', 'sitzung');
    if (!q.code)                        return zurueck(res, basis, 'fehler', 'code');

    var token, scopes;
    try {
        var ta = S.tokenAnfrage(shop, clientId, secret, String(q.code));
        var r = await fetch(ta.url, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: ta.body, signal: AbortSignal.timeout(8000)
        });
        if (!r.ok) throw new Error('access_token HTTP ' + r.status);
        var j = await r.json();
        token = j && j.access_token; scopes = j && j.scope;
        if (!token) throw new Error('access_token fehlt');
    } catch (e) {
        _log.logError('shopify-callback', 'SHOPIFY_TOKEN_FAILED', e);
        return zurueck(res, basis, 'fehler', 'token');
    }
    if (!S.scopesPassen(scopes)) return zurueck(res, basis, 'fehler', 'rechte');

    try {
        await db.rpc('sync_shopify_integration_speichern', {
            p_shop: shop, p_user: String(daten.u), p_company: String(daten.c),
            p_token: S.verschluesseleToken(token, key, shop), p_scopes: String(scopes)
        });
    } catch (e) {
        _log.logError('shopify-callback', 'SHOPIFY_DB_FAILED', e);
        return zurueck(res, basis, 'fehler', 'speichern');
    }

    var fehlt = await S.registriereWebhooks(shop, token, basis + '/api/shopify-webhook');
    if (fehlt.length) _log.logError('shopify-callback', 'SHOPIFY_WEBHOOKS_FAILED', fehlt.join(','));

    // Erstimport im Zeitbudget; ein Fehler hier bricht die Verbindung nicht ab, sondern lässt
    // den Cursor stehen ('*' = noch keine Seite geladen), damit Stufe 2 dort weitermacht.
    var start = Date.now(), cursor = null;
    try {
        do {
            var seite = await S.ladeBestellungen(shop, token, { after: cursor, timeoutMs: 3000 });
            if (seite.eintraege.length) {
                await db.rpc('sync_shopify_eingang_speichern', {
                    p_shop: shop,
                    p_eintraege: seite.eintraege.map(function (e) { return { order_id: e.orderId, payload: e.daten }; })
                });
            }
            cursor = seite.weiter;
        } while (cursor && Date.now() - start < IMPORT_BUDGET_MS);
        await db.rpc('sync_shopify_import_cursor', { p_shop: shop, p_cursor: cursor });
    } catch (e) {
        _log.logError('shopify-callback', 'SHOPIFY_IMPORT_FAILED', e);
        try { await db.rpc('sync_shopify_import_cursor', { p_shop: shop, p_cursor: cursor || '*' }); }
        catch (e2) { _log.logError('shopify-callback', 'SHOPIFY_DB_FAILED', e2); }
    }

    return fehlt.length ? zurueck(res, basis, 'fehler', 'webhooks') : zurueck(res, basis, 'verbunden');
};
