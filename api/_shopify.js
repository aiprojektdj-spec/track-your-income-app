// Shopify-Connector — Prüf- und Baulogik für OAuth und Webhooks. Helfer, kein Endpunkt.
// =============================================================================
// Weg (b) aus plan/session-prompt-shopify-oauth-2026-10-21.md, seit 2026-10-21 mit lesbaren
// Daten auf dem Server (Local-First aufgegeben, plan/02-ENTSCHEIDUNGEN.md). Routen:
// api/shopify-install.js, api/shopify-callback.js, api/shopify-webhook.js; Tabellen
// `integrations` und `shopify_eingang` (supabase/migrations/20261022000001_shopify.sql).
// Reine Logik (node:crypto, fetch, keine neue Abhängigkeit), geprüft in
// test/test-shopify-server.js und test/test-shopify-endpunkte.js — ohne Partner-Account.
//
// Weg: Authorization Code Grant (Offline-Token je Shop, eine Installation pro Shop).
//   1. install:  eingeloggter Whop-Nutzer nennt Shop + Firma → state (signiert, trägt Nutzer
//                und Firma), Nonce als Cookie → Install-URL zurück, der Browser leitet um
//   2. callback: HMAC + state (gegen Cookie) + Shop-Domain prüfen → tokenAnfrage() an Shopify →
//                Token mit verschluesseleToken() in `integrations` → Webhooks → Erstimport
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
// daten (optional, z. B. { u: Whop-Nutzer, c: Firma }) reist signiert mit: der Callback kommt
// von Shopify ohne Whop-Token und erfährt Nutzer und Firma nur hierüber.
// Format: nonce.ts.datenB64url.sig — pruefeState liefert die Daten ({} ohne) oder false.
function erzeugeState(secret, shop, jetzt, daten) {
    var nonce = crypto.randomBytes(16).toString('hex');
    var ts = String(jetzt);
    var d = Buffer.from(JSON.stringify(daten || {}), 'utf8').toString('base64url');
    var sig = crypto.createHmac('sha256', secret).update(nonce + '.' + ts + '.' + d + '.' + shop).digest('hex');
    return { state: nonce + '.' + ts + '.' + d + '.' + sig, nonce: nonce };
}
function pruefeState(state, cookieNonce, shop, secret, jetzt) {
    var teile = String(state || '').split('.');
    if (teile.length !== 4 || !secret) return false;
    var nonce = teile[0], ts = parseInt(teile[1], 10);
    if (!gleich(nonce, cookieNonce)) return false;
    if (!Number.isFinite(ts) || jetzt - ts > STATE_MAX_ALTER_MS || ts - jetzt > 60000) return false;
    var soll = crypto.createHmac('sha256', secret).update(nonce + '.' + teile[1] + '.' + teile[2] + '.' + shop).digest('hex');
    if (!gleich(soll, teile[3])) return false;
    try { return JSON.parse(Buffer.from(teile[2], 'base64url').toString('utf8')) || {}; }
    catch (e) { return false; }
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

// Webhook-Themen → was der Server tun muss. Bei Bestellthemen wird NICHT der Webhook-Inhalt
// gespeichert (der trägt Namen, E-Mail und Anschriften des Käufers), sondern nur die Bestell-ID
// gemeldet; die Bestellung lädt der Server danach per GraphQL (ladeBestellungen) in genau den
// Feldern, die die Buchung braucht — samt Gebühren, die im Webhook fehlen.
// Jeder geprüfte Webhook wird mit 200 beantwortet.
var BESTELL_THEMEN = ['orders/paid', 'orders/updated', 'refunds/create'];
function webhookAktion(thema, payload, shopHeader) {
    var p = payload || {};
    var shop = shopHeader;
    if (!istShopDomain(shop)) return { aktion: 'ablehnen', grund: 'Shop-Domain' };
    if (p.shop_domain && p.shop_domain !== shop) return { aktion: 'ablehnen', grund: 'Shop-Domain widersprüchlich' };
    if (BESTELL_THEMEN.indexOf(thema) !== -1) {
        var orderId = thema === 'refunds/create' ? p.order_id : p.id;
        if (orderId == null) return { aktion: 'ablehnen', grund: 'Bestell-ID fehlt' };
        return { aktion: 'speichern', shop: shop, orderId: String(orderId) };
    }
    switch (thema) {
        case 'app/uninstalled':
            return { aktion: 'integration_beenden', shop: shop };
        case 'shop/redact':
            return { aktion: 'shop_loeschen', shop: shop };
        case 'customers/redact':
            return { aktion: 'bestellungen_loeschen', shop: shop, orderIds: (p.orders_to_redact || []).map(String) };
        case 'customers/data_request':
            // Wird protokolliert und gemeldet; die Auskunft an den Käufer gibt der Händler.
            return { aktion: 'auskunft_melden', shop: shop, orderIds: (p.orders_requested || []).map(String) };
        default:
            return { aktion: 'ignorieren', shop: shop };
    }
}

// ── Admin-GraphQL (Token im Klartext nur innerhalb des Aufrufs) ──────────────────────────
// Fehlermeldungen tragen nur den Status, nie den Antwort-Body (der kann Bestelldaten enthalten,
// siehe api/_log.js).
var Kern = require('../js/shopify-buchung.js');
var API_VERSION = Kern.API_VERSION;

async function graphql(shop, token, query, variables, timeoutMs) {
    if (!istShopDomain(shop)) throw new Error('Ungültige Shop-Domain');
    var r = await fetch('https://' + shop + '/admin/api/' + API_VERSION + '/graphql.json', {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: query, variables: variables || {} }),
        signal: AbortSignal.timeout(timeoutMs || 8000)
    });
    if (!r.ok) { var e = new Error('Shopify GraphQL HTTP ' + r.status); e.httpStatus = r.status; throw e; }
    var j = await r.json();
    if (j && j.errors && j.errors.length) throw new Error('Shopify GraphQL errors');
    return (j && j.data) || {};
}

// Bestellthemen + Deinstallation. Die drei Pflicht-Datenschutz-Themen lassen sich nicht per API
// abonnieren, sie stehen in der App-Konfiguration bei Shopify (gleiche URL).
var WEBHOOK_ABOS = ['ORDERS_PAID', 'ORDERS_UPDATED', 'REFUNDS_CREATE', 'APP_UNINSTALLED'];
// `uri` statt des abgekündigten `callbackUrl` — Feldname vor dem Livegang gegen den Dev-Store prüfen.
var WEBHOOK_MUTATION = 'mutation Abo($topic: WebhookSubscriptionTopic!, $uri: String!) {'
    + ' webhookSubscriptionCreate(topic: $topic, webhookSubscription: { uri: $uri, format: JSON })'
    + ' { webhookSubscription { id } userErrors { field message } } }';

// Rückgabe: Liste der Themen, die nicht angelegt werden konnten (leer = alles da). Ein schon
// bestehendes Abo (erneute Installation) meldet Shopify als userError "already been taken" —
// das zählt als vorhanden.
async function registriereWebhooks(shop, token, uri) {
    var fehlt = [];
    for (var i = 0; i < WEBHOOK_ABOS.length; i++) {
        try {
            var d = await graphql(shop, token, WEBHOOK_MUTATION, { topic: WEBHOOK_ABOS[i], uri: uri }, 5000);
            var ue = (d.webhookSubscriptionCreate && d.webhookSubscriptionCreate.userErrors) || [];
            if (ue.some(function (x) { return !/already been taken/i.test(String(x && x.message)); })) fehlt.push(WEBHOOK_ABOS[i]);
        } catch (e) { fehlt.push(WEBHOOK_ABOS[i]); }
    }
    return fehlt;
}

// Eine Seite Bestellungen im Format des Rechenkerns ({ order, gebuehr } aus ausGraphQL).
// o: { after, query, first, timeoutMs } — query z. B. "id:123" für eine einzelne Bestellung.
// Rückgabe: { eintraege: [{ orderId, daten }], weiter: Cursor oder null }
async function ladeBestellungen(shop, token, o) {
    o = o || {};
    var d = await graphql(shop, token, Kern.BESTELL_QUERY,
        { first: o.first || 50, after: o.after || null, query: o.query || null }, o.timeoutMs);
    var orders = d.orders || {};
    var eintraege = (orders.nodes || []).map(function (n) {
        var daten = Kern.ausGraphQL(n);
        return { orderId: String(daten.order.id), daten: daten };
    });
    var pi = orders.pageInfo || {};
    return { eintraege: eintraege, weiter: pi.hasNextPage ? (pi.endCursor || null) : null };
}

// Redirect-Ziel nach Host: nur die bekannten App-Domains (api/_cors.js), sonst die Hauptdomain.
// Der Nonce-Cookie hängt am Host — Install und Callback müssen auf derselben Domain laufen.
// Beide URLs müssen in der App-Konfiguration bei Shopify als erlaubte Redirect-URL stehen.
function appBasis(host) {
    var erlaubt = require('./_cors.js').ERLAUBT;
    var b = 'https://' + String(host || '').toLowerCase();
    return erlaubt.indexOf(b) !== -1 ? b : erlaubt[0];
}

var NONCE_COOKIE = 'stackr_shopify_nonce';
function nonceCookie(nonce, maxAgeSec) {
    return NONCE_COOKIE + '=' + nonce + '; Path=/api/shopify-callback; Max-Age=' + maxAgeSec
        + '; HttpOnly; Secure; SameSite=Lax';
}
function leseCookie(header, name) {
    var teile = String(header || '').split(';');
    for (var i = 0; i < teile.length; i++) {
        var p = teile[i].trim(), k = p.indexOf('=');
        if (k > 0 && p.slice(0, k) === name) return p.slice(k + 1);
    }
    return '';
}

module.exports = {
    API_VERSION: API_VERSION, WEBHOOK_ABOS: WEBHOOK_ABOS, graphql: graphql,
    registriereWebhooks: registriereWebhooks, ladeBestellungen: ladeBestellungen,
    appBasis: appBasis, NONCE_COOKIE: NONCE_COOKIE, nonceCookie: nonceCookie, leseCookie: leseCookie,
    STATE_MAX_ALTER_MS: STATE_MAX_ALTER_MS,
    SCOPES: SCOPES, istShopDomain: istShopDomain, pruefeQueryHmac: pruefeQueryHmac,
    pruefeWebhookHmac: pruefeWebhookHmac, erzeugeState: erzeugeState, pruefeState: pruefeState,
    installUrl: installUrl, tokenAnfrage: tokenAnfrage, scopesPassen: scopesPassen,
    verschluesseleToken: verschluesseleToken, entschluesseleToken: entschluesseleToken,
    webhookAktion: webhookAktion
};
