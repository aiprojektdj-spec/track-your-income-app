// Shopify-Connector — Prüf- und Baulogik für OAuth und Webhooks. Helfer, kein Endpunkt.
// =============================================================================
// Phase 2 aus plan/stackr-plan-rest-2026-10-07.md. Bewusst noch OHNE Route: Token und
// Webhook-Inhalte brauchen die Tabellen `integrations`/`inbox` und den Nutzer-Pubkey aus Phase 1,
// die es noch nicht gibt. Alles hier ist reine Logik (node:crypto, keine neue Abhängigkeit) und
// in test/test-shopify-server.js geprüft — ohne Partner-Account.
//
// Weg: Authorization Code Grant (Offline-Token je Shop, eine Installation pro Shop).
//   1. install:  Shop-Domain + HMAC der Anfrage prüfen → state erzeugen, Nonce als Cookie →
//                Redirect auf installUrl()
//   2. callback: HMAC + state (gegen Cookie) + Shop-Domain prüfen → tokenAnfrage() an Shopify →
//                Token mit verschluesseleToken() in `integrations`
// Token Exchange (eingebettete App, App-Store-Pflicht) kommt später als zweiter Weg zu Schritt 2
// dazu; Shop-Prüfung, Token-Verschlüsselung und Webhooks bleiben dieselben.
// Admin-Zugriffe nur über GraphQL (App-Store-Anforderung 2.2.4), kein REST.
//
// Env (später, trägt der User ein): SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET,
// SHOPIFY_TOKEN_KEY (32 Byte, base64).
// =============================================================================
var crypto = require('crypto');

// Kleinste Rechte: Bestellungen lesen + Shopify-Payments-Saldo (Gebühren, Auszahlungen).
// read_all_orders (älter als 60 Tage) muss bei Shopify beantragt werden — erst nach Freigabe ergänzen.
var SCOPES = ['read_orders', 'read_shopify_payments_payouts'];
var STATE_MAX_ALTER_MS = 10 * 60 * 1000;

function istShopDomain(shop) {
    return typeof shop === 'string' && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);
}

function gleich(a, b) {
    var x = Buffer.from(String(a || ''), 'utf8'), y = Buffer.from(String(b || ''), 'utf8');
    return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

// HMAC der Install-/Callback-Query: alle Parameter außer hmac (und dem alten signature),
// sortiert, "k=v" mit "&" verbunden, HMAC-SHA256 hex. query = Objekt der geparsten Parameter.
function pruefeQueryHmac(query, secret) {
    if (!query || !secret || typeof query.hmac !== 'string') return false;
    var nachricht = Object.keys(query)
        .filter(function (k) { return k !== 'hmac' && k !== 'signature'; })
        .sort()
        .map(function (k) { return k + '=' + (Array.isArray(query[k]) ? JSON.stringify(query[k]) : query[k]); })
        .join('&');
    var soll = crypto.createHmac('sha256', secret).update(nachricht, 'utf8').digest('hex');
    return gleich(soll, query.hmac.toLowerCase());
}

// Webhook: HMAC-SHA256 über den ROHEN Body (Buffer, vor jedem JSON.parse), base64 im Header
// X-Shopify-Hmac-Sha256.
function pruefeWebhookHmac(rohBody, header, secret) {
    if (!secret || !header || rohBody == null) return false;
    var soll = crypto.createHmac('sha256', secret).update(rohBody).digest('base64');
    return gleich(soll, header);
}

// state gegen CSRF: zustandslos signiert (kein Speicher nötig) und an den Browser gebunden —
// die Nonce steht zusätzlich in einem HttpOnly-Cookie und muss beim Callback übereinstimmen.
function erzeugeState(secret, shop, jetzt) {
    var nonce = crypto.randomBytes(16).toString('hex');
    var ts = String(jetzt);
    var sig = crypto.createHmac('sha256', secret).update(nonce + '.' + ts + '.' + shop).digest('hex');
    return { state: nonce + '.' + ts + '.' + sig, nonce: nonce };
}
function pruefeState(state, cookieNonce, shop, secret, jetzt) {
    var teile = String(state || '').split('.');
    if (teile.length !== 3 || !secret) return false;
    var nonce = teile[0], ts = parseInt(teile[1], 10);
    if (!gleich(nonce, cookieNonce)) return false;
    if (!Number.isFinite(ts) || jetzt - ts > STATE_MAX_ALTER_MS || ts - jetzt > 60000) return false;
    var soll = crypto.createHmac('sha256', secret).update(nonce + '.' + teile[1] + '.' + shop).digest('hex');
    return gleich(soll, teile[2]);
}

// Ohne grant_options[]=per-user → Offline-Token (Webhooks und Erstimport laufen ohne Nutzer).
function installUrl(o) {
    if (!istShopDomain(o.shop)) throw new Error('Ungültige Shop-Domain');
    return 'https://' + o.shop + '/admin/oauth/authorize'
        + '?client_id=' + encodeURIComponent(o.clientId)
        + '&scope=' + encodeURIComponent((o.scopes || SCOPES).join(','))
        + '&redirect_uri=' + encodeURIComponent(o.redirectUri)
        + '&state=' + encodeURIComponent(o.state);
}

// Code → Token: nur die Anfrage bauen, abgeschickt wird sie im Endpunkt.
function tokenAnfrage(shop, clientId, clientSecret, code) {
    if (!istShopDomain(shop)) throw new Error('Ungültige Shop-Domain');
    return {
        url: 'https://' + shop + '/admin/oauth/access_token',
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code: code })
    };
}

// Erteilte Rechte dürfen nicht weiter gehen als angefragt (und nichts fehlen).
function scopesPassen(erteilt, angefragt) {
    var e = String(erteilt || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean).sort();
    var a = (angefragt || SCOPES).slice().sort();
    return e.length === a.length && e.every(function (s, i) { return s === a[i]; });
}

// Token AES-256-GCM, Shop als AAD: ein Chiffrat lässt sich keinem anderen Shop unterschieben.
function verschluesseleToken(token, keyB64, shop) {
    var key = Buffer.from(String(keyB64 || ''), 'base64');
    if (key.length !== 32) throw new Error('SHOPIFY_TOKEN_KEY muss 32 Byte haben');
    var iv = crypto.randomBytes(12);
    var c = crypto.createCipheriv('aes-256-gcm', key, iv);
    c.setAAD(Buffer.from(shop, 'utf8'));
    var ct = Buffer.concat([c.update(String(token), 'utf8'), c.final()]);
    return ['v1', iv.toString('base64url'), ct.toString('base64url'), c.getAuthTag().toString('base64url')].join('.');
}
function entschluesseleToken(chiffrat, keyB64, shop) {
    var t = String(chiffrat || '').split('.');
    if (t.length !== 4 || t[0] !== 'v1') throw new Error('Unbekanntes Token-Format');
    var key = Buffer.from(String(keyB64 || ''), 'base64');
    if (key.length !== 32) throw new Error('SHOPIFY_TOKEN_KEY muss 32 Byte haben');
    var d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(t[1], 'base64url'));
    d.setAAD(Buffer.from(shop, 'utf8'));
    d.setAuthTag(Buffer.from(t[3], 'base64url'));
    return Buffer.concat([d.update(Buffer.from(t[2], 'base64url')), d.final()]).toString('utf8');
}

// Webhook-Themen → was der Server tun muss. Die Inbox hält Bestellungen nur versiegelt; damit
// Löschpflichten trotzdem erfüllbar sind, steht neben dem Chiffrat die Bestell-ID im Klartext
// (keine Personendaten). Jeder geprüfte Webhook wird mit 200 beantwortet.
var BESTELL_THEMEN = ['orders/paid', 'orders/updated', 'refunds/create'];
function webhookAktion(thema, payload, shopHeader) {
    var p = payload || {};
    var shop = shopHeader;
    if (!istShopDomain(shop)) return { aktion: 'ablehnen', grund: 'Shop-Domain' };
    if (p.shop_domain && p.shop_domain !== shop) return { aktion: 'ablehnen', grund: 'Shop-Domain widersprüchlich' };
    if (BESTELL_THEMEN.indexOf(thema) !== -1) {
        var orderId = thema === 'refunds/create' ? p.order_id : p.id;
        if (orderId == null) return { aktion: 'ablehnen', grund: 'Bestell-ID fehlt' };
        return { aktion: 'versiegeln', shop: shop, orderId: String(orderId) };
    }
    switch (thema) {
        case 'app/uninstalled':
            return { aktion: 'integration_beenden', shop: shop };
        case 'shop/redact':
            return { aktion: 'shop_loeschen', shop: shop };
        case 'customers/redact':
            return { aktion: 'bestellungen_loeschen', shop: shop, orderIds: (p.orders_to_redact || []).map(String) };
        case 'customers/data_request':
            // Der Server kann Inbox-Inhalte nicht lesen; Auskunft gibt der Nutzer aus Stackr.
            return { aktion: 'auskunft_melden', shop: shop, orderIds: (p.orders_requested || []).map(String) };
        default:
            return { aktion: 'ignorieren', shop: shop };
    }
}

module.exports = {
    SCOPES: SCOPES, istShopDomain: istShopDomain, pruefeQueryHmac: pruefeQueryHmac,
    pruefeWebhookHmac: pruefeWebhookHmac, erzeugeState: erzeugeState, pruefeState: pruefeState,
    installUrl: installUrl, tokenAnfrage: tokenAnfrage, scopesPassen: scopesPassen,
    verschluesseleToken: verschluesseleToken, entschluesseleToken: entschluesseleToken,
    webhookAktion: webhookAktion
};
