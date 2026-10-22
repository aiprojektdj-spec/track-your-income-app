// Vercel Serverless Function — Shopify-Webhooks (alle Themen, Thema aus X-Shopify-Topic)
// =============================================================================
// Rohbody lesen (vor jedem JSON-Parse) → HMAC (X-Shopify-Hmac-Sha256, SHOPIFY_CLIENT_SECRET) →
// webhookAktion (api/_shopify.js) → ausführen → 200. Ungültige Signatur 401; ein Speicherfehler
// antwortet 500, damit Shopify erneut zustellt (Upserts machen die Wiederholung harmlos).
//
// Bestellthemen: Webhook-Inhalt wird NICHT gespeichert (Namen, E-Mail, Anschriften), nur die
// Bestell-ID als 'neu' vorgemerkt; danach lädt der Server die Bestellung per GraphQL in den
// Buchungsfeldern. Scheitert das Laden in der Zeit, bleibt die Zeile 'neu' und wird von der
// Buchungsstufe nachgeladen — Shopify bekommt trotzdem 200.
// Pflicht-Datenschutz-Themen werden hier wirklich ausgeführt, siehe unten.
// Logs nur mit festen Codes und Thema, nie mit Payload.
// =============================================================================
var _log = require('./_log.js');
var db   = require('./_db.js');
var S    = require('./_shopify.js');
var alertOps = require('./_alert.js').alertOps;

var MAX_BODY = 1024 * 1024;

// Vercel parst req.body erst beim Zugriff (Getter) — deshalb zuerst den Stream lesen und
// req.body nicht anfassen. Nur wenn der Stream leer ist, ein schon gepuffertes req.body als
// Buffer/String nehmen; ein geparstes Objekt taugt nicht (neu serialisiert stimmt der HMAC
// nicht mehr → 401, also sicher). Vor dem Livegang mit echtem Webhook bestätigen.
async function rohBody(req) {
    var teile = [], n = 0;
    for await (var chunk of req) {
        n += chunk.length;
        if (n > MAX_BODY) throw new Error('zu gross');
        teile.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk);
    }
    if (n) return Buffer.concat(teile);
    if (Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
    return Buffer.alloc(0);
}

async function bestellungLaden(shop, orderId) {
    var key = process.env.SHOPIFY_TOKEN_KEY || '';
    var chiffrat = await db.rpc('sync_shopify_token', { p_shop: shop });
    if (!chiffrat) return;
    var token = S.entschluesseleToken(chiffrat, key, shop);
    var seite = await S.ladeBestellungen(shop, token, { query: 'id:' + orderId, first: 1, timeoutMs: 3000 });
    var e = seite.eintraege.filter(function (x) { return x.orderId === orderId; });
    if (e.length) await db.rpc('sync_shopify_eingang_speichern', {
        p_shop: shop, p_eintraege: [{ order_id: e[0].orderId, payload: e[0].daten }]
    });
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).end();

    var secret = process.env.SHOPIFY_CLIENT_SECRET || '';
    if (!secret || !process.env.SHOPIFY_TOKEN_KEY || !db.isConfigured()) {
        _log.logError('shopify-webhook', 'SHOPIFY_ENV_MISSING');
        return res.status(503).end();
    }

    var body;
    try { body = await rohBody(req); }
    catch (e) { return res.status(413).end(); }
    if (!S.pruefeWebhookHmac(body, req.headers['x-shopify-hmac-sha256'], secret)) return res.status(401).end();

    var thema = String(req.headers['x-shopify-topic'] || '');
    var payload;
    try { payload = JSON.parse(body.toString('utf8') || '{}'); }
    catch (e) { return res.status(400).end(); }

    var a = S.webhookAktion(thema, payload, String(req.headers['x-shopify-shop-domain'] || ''));
    try {
        switch (a.aktion) {
            case 'ablehnen':
                _log.logWarn('shopify-webhook', 'SHOPIFY_WEBHOOK_ABGELEHNT', thema + ': ' + a.grund);
                break;
            case 'speichern':
                if (await db.rpc('sync_shopify_eingang_melden', { p_shop: a.shop, p_order_id: a.orderId })) {
                    try { await bestellungLaden(a.shop, a.orderId); }
                    catch (e) { _log.logWarn('shopify-webhook', 'SHOPIFY_NACHLADEN_FAILED', e); }
                }
                break;
            case 'integration_beenden':
                await db.rpc('sync_shopify_integration_beenden', { p_shop: a.shop });
                break;
            case 'shop_loeschen':
                await db.rpc('sync_shopify_shop_loeschen', { p_shop: a.shop });
                break;
            case 'bestellungen_loeschen':
                if (a.orderIds.length) await db.rpc('sync_shopify_bestellungen_loeschen', { p_shop: a.shop, p_order_ids: a.orderIds });
                break;
            case 'auskunft_melden':
                // Auskunft gibt der Händler; Stackr hält zu einer Bestellung nur Buchungsfelder und
                // Lieferland. Gemeldet wird nur, DASS eine Anfrage kam (Shop + Anzahl), damit sie
                // nicht untergeht — keine Bestell- oder Kunden-IDs in Log oder Alarm.
                await alertOps('shopify-webhook', 'customers-data-request', a.shop + ', ' + a.orderIds.length + ' Bestellungen');
                break;
        }
    } catch (e) {
        _log.logError('shopify-webhook', 'SHOPIFY_DB_FAILED', thema + ': ' + (e && e.message));
        return res.status(500).end();
    }
    return res.status(200).end();
};
