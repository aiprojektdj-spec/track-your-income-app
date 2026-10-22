// Shopify-Connector, Serverlogik (api/_shopify.js): HMAC, state, Token-Verschlüsselung,
// Webhook-Zuordnung inkl. Pflicht-Datenschutz-Webhooks. Ohne Partner-Account prüfbar:
// die erwarteten HMACs werden hier unabhängig nach dem Shopify-Verfahren berechnet.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const S = require('../api/_shopify.js');

let fail = 0, pass = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n   ') : e)); }
}
const SECRET = 'test-geheimnis-nicht-echt';
const SHOP = 'beispiel-shop.myshopify.com';
const KEY = crypto.randomBytes(32).toString('base64');

// Referenz: Shopify-Beispiel "code=…&shop=…&state=…&timestamp=…" sortiert, HMAC-SHA256 hex
function signiereQuery(q) {
    const msg = Object.keys(q).sort().map(k => k + '=' + q[k]).join('&');
    return Object.assign({}, q, { hmac: crypto.createHmac('sha256', SECRET).update(msg).digest('hex') });
}

check('Shop-Domain: nur *.myshopify.com, keine Fremd- oder Pfad-Hosts', () => {
    assert.ok(S.istShopDomain(SHOP));
    ['evil.com', 'x.myshopify.com.evil.com', 'x.myshopify.com/admin', '-x.myshopify.com', 'X.MYSHOPIFY.COM', '', null]
        .forEach(d => assert.ok(!S.istShopDomain(d), String(d)));
});
check('Query-HMAC: echt ok, verändert/fehlend/falsches Secret abgelehnt', () => {
    const q = signiereQuery({ code: 'abc', shop: SHOP, state: 's', timestamp: '1700000000' });
    assert.ok(S.pruefeQueryHmac(q, SECRET));
    assert.ok(!S.pruefeQueryHmac(Object.assign({}, q, { shop: 'andere.myshopify.com' }), SECRET));
    assert.ok(!S.pruefeQueryHmac(Object.assign({}, q, { hmac: undefined }), SECRET));
    assert.ok(!S.pruefeQueryHmac(q, 'anderes'));
    assert.ok(!S.pruefeQueryHmac(q, ''));
});
check('Webhook-HMAC über den rohen Body (base64)', () => {
    const body = Buffer.from('{"id":820001,"financial_status":"paid"}', 'utf8');
    const h = crypto.createHmac('sha256', SECRET).update(body).digest('base64');
    assert.ok(S.pruefeWebhookHmac(body, h, SECRET));
    assert.ok(!S.pruefeWebhookHmac(Buffer.from('{"id":820001,"financial_status":"paid" }'), h, SECRET), 'ein Leerzeichen mehr');
    assert.ok(!S.pruefeWebhookHmac(body, '', SECRET));
    assert.ok(!S.pruefeWebhookHmac(body, h, ''));
});
check('state: gültig nur mit passendem Cookie, Shop und innerhalb 10 Minuten', () => {
    const t = 1760000000000;
    const { state, nonce } = S.erzeugeState(SECRET, SHOP, t);
    assert.ok(S.pruefeState(state, nonce, SHOP, SECRET, t + 1000));
    assert.ok(!S.pruefeState(state, 'fremd', SHOP, SECRET, t + 1000), 'anderer Browser');
    assert.ok(!S.pruefeState(state, nonce, 'andere.myshopify.com', SECRET, t + 1000), 'anderer Shop');
    assert.ok(!S.pruefeState(state, nonce, SHOP, SECRET, t + 11 * 60000), 'abgelaufen');
    assert.ok(!S.pruefeState(state, nonce, SHOP, 'anderes', t + 1000), 'falsches Secret');
    assert.ok(!S.pruefeState('kaputt', nonce, SHOP, SECRET, t), 'Format');
    // Nutzer und Firma reisen signiert mit und lassen sich nicht austauschen
    const mit = S.erzeugeState(SECRET, SHOP, t, { u: 'user_1', c: 'co_a' });
    assert.deepStrictEqual(S.pruefeState(mit.state, mit.nonce, SHOP, SECRET, t), { u: 'user_1', c: 'co_a' });
    const teile = mit.state.split('.');
    teile[2] = Buffer.from(JSON.stringify({ u: 'user_2', c: 'co_a' })).toString('base64url');
    assert.ok(!S.pruefeState(teile.join('.'), mit.nonce, SHOP, SECRET, t), 'Nutzer getauscht');
});
check('Install-URL: Offline-Token, kleinste Scopes, alles kodiert; fremde Domain wirft', () => {
    const u = new URL(S.installUrl({ shop: SHOP, clientId: 'cid', redirectUri: 'https://getstackr.de/api/shopify-callback', state: 'a.b.c' }));
    assert.strictEqual(u.host, SHOP);
    assert.strictEqual(u.pathname, '/admin/oauth/authorize');
    assert.strictEqual(u.searchParams.get('scope'), 'read_orders,read_shopify_payments_payouts');
    assert.strictEqual(u.searchParams.get('redirect_uri'), 'https://getstackr.de/api/shopify-callback');
    assert.ok(!u.search.includes('per-user'));
    assert.throws(() => S.installUrl({ shop: 'evil.com', clientId: 'cid', redirectUri: 'x', state: 's' }));
    assert.throws(() => S.tokenAnfrage('evil.com', 'cid', SECRET, 'code'));
    assert.strictEqual(S.tokenAnfrage(SHOP, 'cid', SECRET, 'code').url, 'https://' + SHOP + '/admin/oauth/access_token');
});
check('Erteilte Scopes müssen genau den angefragten entsprechen', () => {
    assert.ok(S.scopesPassen('read_shopify_payments_payouts,read_orders'));
    assert.ok(!S.scopesPassen('read_orders'));
    assert.ok(!S.scopesPassen('read_orders,read_shopify_payments_payouts,write_orders'));
});
check('Token-Verschlüsselung: Rundweg; anderer Shop, anderer Schlüssel, Manipulation scheitern', () => {
    const c = S.verschluesseleToken('shpat_beispiel', KEY, SHOP);
    assert.ok(!c.includes('shpat_beispiel'));
    assert.strictEqual(S.entschluesseleToken(c, KEY, SHOP), 'shpat_beispiel');
    assert.throws(() => S.entschluesseleToken(c, KEY, 'andere.myshopify.com'));
    assert.throws(() => S.entschluesseleToken(c, crypto.randomBytes(32).toString('base64'), SHOP));
    const t = c.split('.'); t[2] = t[2].slice(0, -2) + (t[2].slice(-2) === 'AA' ? 'AB' : 'AA');
    assert.throws(() => S.entschluesseleToken(t.join('.'), KEY, SHOP));
    assert.throws(() => S.verschluesseleToken('x', 'zukurz', SHOP));
});
check('Webhooks: Bestellungen speichern, Pflicht-Datenschutz-Themen zugeordnet', () => {
    assert.deepStrictEqual(S.webhookAktion('orders/paid', { id: 1 }, SHOP), { aktion: 'speichern', shop: SHOP, orderId: '1' });
    assert.strictEqual(S.webhookAktion('refunds/create', { order_id: 7 }, SHOP).orderId, '7');
    assert.strictEqual(S.webhookAktion('orders/paid', {}, SHOP).aktion, 'ablehnen');
    assert.strictEqual(S.webhookAktion('app/uninstalled', {}, SHOP).aktion, 'integration_beenden');
    assert.deepStrictEqual(S.webhookAktion('shop/redact', { shop_domain: SHOP }, SHOP), { aktion: 'shop_loeschen', shop: SHOP });
    assert.deepStrictEqual(Array.from(S.webhookAktion('customers/redact', { shop_domain: SHOP, orders_to_redact: [11, 12] }, SHOP).orderIds), ['11', '12']);
    assert.strictEqual(S.webhookAktion('customers/data_request', { shop_domain: SHOP, orders_requested: [5] }, SHOP).aktion, 'auskunft_melden');
    assert.strictEqual(S.webhookAktion('customers/redact', { shop_domain: 'andere.myshopify.com' }, SHOP).aktion, 'ablehnen');
    assert.strictEqual(S.webhookAktion('orders/paid', { id: 1 }, 'evil.com').aktion, 'ablehnen');
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
