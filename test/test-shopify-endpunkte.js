// Shopify-Endpunkte (api/shopify-install.js, -callback.js, -webhook.js) mit gemocktem fetch:
// Whop, Shopify (OAuth + GraphQL) und Supabase-RPC (In-Memory-Nachbau der Funktionen aus
// supabase/migrations/20261022000001_shopify.sql). Ohne Partner-Account prüfbar.
//   node test/test-shopify-endpunkte.js
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const { Readable } = require('stream');

const SECRET = 'test-secret-nicht-echt';
process.env.SHOPIFY_CLIENT_ID     = 'cid_test';
process.env.SHOPIFY_CLIENT_SECRET = SECRET;
process.env.SHOPIFY_TOKEN_KEY     = crypto.randomBytes(32).toString('base64');
process.env.SUPABASE_URL          = 'http://db.mock';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_test';
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.ALERT_WEBHOOK_URL;

const SHOP = 'beispiel-shop.myshopify.com';
const TOKEN = 'shpat_test_token';

// ── Mini-DB: dieselbe Semantik wie die sync_shopify_*-Funktionen ──────────────────
const integrations = new Map();   // shop → Zeile
const eingang = new Map();        // shop|order → Zeile
const aufrufe = [];
const RPC = {
    sync_shopify_integration_speichern: a => {
        integrations.set(a.p_shop, { shop: a.p_shop, user_id: a.p_user, company_id: a.p_company, token_chiffrat: a.p_token, scopes: a.p_scopes, status: 'aktiv', import_cursor: null });
    },
    sync_shopify_token: a => { const i = integrations.get(a.p_shop); return i && i.status === 'aktiv' ? i.token_chiffrat : null; },
    sync_shopify_integration_beenden: a => { const i = integrations.get(a.p_shop); if (i) Object.assign(i, { token_chiffrat: null, status: 'deinstalliert', import_cursor: null }); },
    sync_shopify_shop_loeschen: a => { let n = 0; for (const k of [...eingang.keys()]) if (k.startsWith(a.p_shop + '|')) { eingang.delete(k); n++; } integrations.delete(a.p_shop); return n; },
    sync_shopify_bestellungen_loeschen: a => { let n = 0; a.p_order_ids.forEach(o => { if (eingang.delete(a.p_shop + '|' + o)) n++; }); return n; },
    sync_shopify_eingang_melden: a => {
        const i = integrations.get(a.p_shop); if (!i || i.status !== 'aktiv') return false;
        const k = a.p_shop + '|' + a.p_order_id; eingang.set(k, Object.assign(eingang.get(k) || { payload: null }, { status: 'neu' })); return true;
    },
    sync_shopify_eingang_speichern: a => {
        const i = integrations.get(a.p_shop); if (!i || i.status !== 'aktiv') return 0;
        a.p_eintraege.forEach(e => eingang.set(a.p_shop + '|' + e.order_id, { payload: e.payload, status: 'geladen' }));
        return a.p_eintraege.length;
    },
    // 20261022000002_server_datenmodell.sql: nur user_pro ist Owner von co_abc
    firma_rolle: a => (a.p_user === 'user_pro' && a.p_company === 'co_abc' ? 'owner' : null),
    sync_shopify_import_cursor: a => { const i = integrations.get(a.p_shop); if (i && i.status === 'aktiv') i.import_cursor = a.p_cursor; }
};
let dbKaputt = false;

// ── Shopify-GraphQL-Mock ──────────────────────────────────────────────────────
function gqlOrder(id) {
    return {
        id: 'gid://shopify/Order/' + id, name: '#' + id, processedAt: '2026-10-20T10:00:00+02:00', createdAt: '2026-10-20T10:00:00+02:00',
        displayFinancialStatus: 'PAID', currencyCode: 'EUR', taxesIncluded: true, paymentGatewayNames: ['shopify_payments'],
        totalTipReceivedSet: { shopMoney: { amount: '0.0' } }, shippingAddress: { countryCodeV2: 'DE' }, billingAddress: null,
        lineItems: { nodes: [{ id: 'gid://shopify/LineItem/1', sku: 'A1', title: 'Jacke', quantity: 1, isGiftCard: false,
            originalUnitPriceSet: { shopMoney: { amount: '119.00' } }, discountAllocations: [],
            taxLines: [{ rate: 0.19, priceSet: { shopMoney: { amount: '19.00' } } }] }] },
        shippingLines: { nodes: [] },
        transactions: [{ kind: 'SALE', status: 'SUCCESS', fees: [{ amount: { amount: '2.10', currencyCode: 'EUR' } }] }],
        refunds: []
    };
}
let seiten = [[101, 102], [103]];      // Erstimport in zwei Seiten
let webhookAbos = [];
let shopifyGraphqlKaputt = false;
let tokenScope = 'read_orders,read_shopify_payments_payouts';

const whopUsers = { tok_pro: { sub: 'user_pro', pro: true }, tok_free: { sub: 'user_free', pro: false } };

global.fetch = async (url, opts) => {
    opts = opts || {};
    const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
    if (url.startsWith('http://db.mock/rest/v1/rpc/')) {
        const name = url.split('/').pop();
        aufrufe.push(name);
        if (dbKaputt) return json(500, {});
        const r = RPC[name](JSON.parse(opts.body));
        return { ok: true, status: 200, text: async () => (r === undefined ? '' : JSON.stringify(r)) };
    }
    if (url.includes('api.whop.com/oauth/userinfo')) {
        const u = whopUsers[(opts.headers.Authorization || '').replace('Bearer ', '')];
        return u ? json(200, { sub: u.sub }) : json(401, {});
    }
    if (url.includes('api.whop.com/api/v2/me/has_access/')) {
        const u = whopUsers[(opts.headers.Authorization || '').replace('Bearer ', '')];
        return u ? json(200, { valid: u.pro }) : json(401, {});
    }
    if (url === 'https://' + SHOP + '/admin/oauth/access_token') {
        const b = JSON.parse(opts.body);
        assert.strictEqual(b.client_secret, SECRET);
        return b.code === 'gut' ? json(200, { access_token: TOKEN, scope: tokenScope }) : json(400, {});
    }
    if (url.startsWith('https://' + SHOP + '/admin/api/') && url.endsWith('/graphql.json')) {
        assert.strictEqual(opts.headers['X-Shopify-Access-Token'], TOKEN);
        if (shopifyGraphqlKaputt) return json(503, {});
        const q = JSON.parse(opts.body);
        if (q.query.includes('webhookSubscriptionCreate')) {
            webhookAbos.push(q.variables.topic + ' ' + q.variables.uri);
            return json(200, { data: { webhookSubscriptionCreate: { webhookSubscription: { id: 'x' }, userErrors: [] } } });
        }
        if (q.variables.query) {
            const id = q.variables.query.replace('id:', '');
            return json(200, { data: { orders: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [gqlOrder(id)] } } });
        }
        const idx = q.variables.after ? parseInt(q.variables.after, 10) : 0;
        const ids = seiten[idx] || [];
        return json(200, { data: { orders: { pageInfo: { hasNextPage: idx + 1 < seiten.length, endCursor: String(idx + 1) }, nodes: ids.map(gqlOrder) } } });
    }
    throw new Error('unerwarteter fetch: ' + url);
};

const install  = require('../api/shopify-install.js');
const callback = require('../api/shopify-callback.js');
const webhook  = require('../api/shopify-webhook.js');
const S = require('../api/_shopify.js');

function mockRes() {
    const r = { statusCode: 0, headers: {}, body: undefined };
    r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
    r.status = c => { r.statusCode = c; return r; };
    r.json = b => { r.body = b; return r; };
    r.end = () => r;
    return r;
}
function signQuery(q) {
    const msg = Object.keys(q).sort().map(k => k + '=' + q[k]).join('&');
    return Object.assign({}, q, { hmac: crypto.createHmac('sha256', SECRET).update(msg).digest('hex') });
}
function webhookReq(topic, payload, opts) {
    opts = opts || {};
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    const req = Readable.from([body]);
    req.method = 'POST';
    req.headers = {
        'x-shopify-topic': topic, 'x-shopify-shop-domain': opts.shop || SHOP,
        'x-shopify-hmac-sha256': opts.hmac || crypto.createHmac('sha256', SECRET).update(body).digest('base64')
    };
    return req;
}

let pass = 0, fail = 0;
async function check(name, fn) {
    try { await fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n   ') : e)); }
}

(async () => {
    let nonce, state;

    await check('Install: ohne Token 401, ohne Pro 403, falscher Shop/Firma 400', async () => {
        let res = mockRes();
        await install({ method: 'POST', headers: { host: 'getstackr.de' }, body: { shop: SHOP, companyId: 'co_abc' } }, res);
        assert.strictEqual(res.statusCode, 401);
        res = mockRes();
        await install({ method: 'POST', headers: { host: 'getstackr.de', authorization: 'Bearer tok_free' }, body: { shop: SHOP, companyId: 'co_abc' } }, res);
        assert.strictEqual(res.statusCode, 403);
        res = mockRes();
        await install({ method: 'POST', headers: { host: 'getstackr.de', authorization: 'Bearer tok_pro' }, body: { shop: 'evil.com', companyId: 'co_abc' } }, res);
        assert.strictEqual(res.statusCode, 400);
        res = mockRes();
        await install({ method: 'POST', headers: { host: 'getstackr.de', authorization: 'Bearer tok_pro' }, body: { shop: SHOP, companyId: '../x' } }, res);
        assert.strictEqual(res.statusCode, 400);
        res = mockRes();
        await install({ method: 'GET', headers: {} }, res);
        assert.strictEqual(res.statusCode, 405);
    });

    await check('Install: Pro-Nutzer bekommt Install-URL + HttpOnly-Nonce-Cookie; Kurzname wird ergänzt', async () => {
        const res = mockRes();
        await install({ method: 'POST', headers: { host: 'getstackr.de', authorization: 'Bearer tok_pro' }, body: { shop: 'Beispiel-Shop', companyId: 'co_abc' } }, res);
        assert.strictEqual(res.statusCode, 200);
        const u = new URL(res.body.url);
        assert.strictEqual(u.host, SHOP);
        assert.strictEqual(u.searchParams.get('redirect_uri'), 'https://getstackr.de/api/shopify-callback');
        state = u.searchParams.get('state');
        const c = res.headers['set-cookie'];
        assert.ok(/HttpOnly/.test(c) && /Secure/.test(c) && /SameSite=Lax/.test(c) && /Path=\/api\/shopify-callback/.test(c), c);
        nonce = S.leseCookie(c.split(';')[0], S.NONCE_COOKIE);
        assert.deepStrictEqual(S.pruefeState(state, nonce, SHOP, SECRET, Date.now()), { u: 'user_pro', c: 'co_abc' });
    });

    await check('Install: Firma, die dem Nutzer nicht gehört → 403, DB-Ausfall → 502', async () => {
        let res = mockRes();
        await install({ method: 'POST', headers: { host: 'getstackr.de', authorization: 'Bearer tok_pro' }, body: { shop: SHOP, companyId: 'co_fremd' } }, res);
        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(res.body.error, 'not_company_owner');
        dbKaputt = true;
        res = mockRes();
        await install({ method: 'POST', headers: { host: 'getstackr.de', authorization: 'Bearer tok_pro' }, body: { shop: SHOP, companyId: 'co_abc' } }, res);
        dbKaputt = false;
        assert.strictEqual(res.statusCode, 502);
    });

    await check('Install: fremder Host bekommt die Hauptdomain als Redirect-Ziel', async () => {
        const res = mockRes();
        await install({ method: 'POST', headers: { host: 'evil.example', authorization: 'Bearer tok_pro' }, body: { shop: SHOP, companyId: 'co_abc' } }, res);
        assert.strictEqual(new URL(res.body.url).searchParams.get('redirect_uri'), 'https://getstackr.de/api/shopify-callback');
    });

    const cbReq = (q, cookie) => ({ method: 'GET', headers: { host: 'getstackr.de', cookie: cookie }, query: q });

    await check('Callback: falscher HMAC, fremder Browser (Cookie), falsche Scopes → Fehler-Redirect, nichts gespeichert', async () => {
        let res = mockRes();
        await callback(cbReq(Object.assign(signQuery({ code: 'gut', shop: SHOP, state, timestamp: '1' }), { hmac: '00' }), S.NONCE_COOKIE + '=' + nonce), res);
        assert.strictEqual(res.headers.location, 'https://getstackr.de/app?shopify=fehler&grund=signatur');
        res = mockRes();
        await callback(cbReq(signQuery({ code: 'gut', shop: SHOP, state, timestamp: '1' }), S.NONCE_COOKIE + '=fremd'), res);
        assert.strictEqual(res.headers.location, 'https://getstackr.de/app?shopify=fehler&grund=sitzung');
        tokenScope = 'read_orders';
        res = mockRes();
        await callback(cbReq(signQuery({ code: 'gut', shop: SHOP, state, timestamp: '1' }), S.NONCE_COOKIE + '=' + nonce), res);
        assert.strictEqual(res.headers.location, 'https://getstackr.de/app?shopify=fehler&grund=rechte');
        tokenScope = 'read_orders,read_shopify_payments_payouts';
        res = mockRes();
        await callback(cbReq(signQuery({ code: 'schlecht', shop: SHOP, state, timestamp: '1' }), S.NONCE_COOKIE + '=' + nonce), res);
        assert.strictEqual(res.headers.location, 'https://getstackr.de/app?shopify=fehler&grund=token');
        assert.strictEqual(integrations.size, 0);
    });

    await check('Callback: Token nur verschlüsselt gespeichert, Webhooks abonniert, Erstimport über zwei Seiten', async () => {
        const res = mockRes();
        await callback(cbReq(signQuery({ code: 'gut', shop: SHOP, state, timestamp: '1' }), 'x=1; ' + S.NONCE_COOKIE + '=' + nonce), res);
        assert.strictEqual(res.statusCode, 302);
        assert.strictEqual(res.headers.location, 'https://getstackr.de/app?shopify=verbunden');
        assert.ok(/Max-Age=0/.test(res.headers['set-cookie']), 'Nonce-Cookie gelöscht');
        const i = integrations.get(SHOP);
        assert.strictEqual(i.user_id, 'user_pro');
        assert.strictEqual(i.company_id, 'co_abc');
        assert.ok(!i.token_chiffrat.includes(TOKEN));
        assert.strictEqual(S.entschluesseleToken(i.token_chiffrat, process.env.SHOPIFY_TOKEN_KEY, SHOP), TOKEN);
        assert.deepStrictEqual(webhookAbos.map(w => w.split(' ')[0]), S.WEBHOOK_ABOS);
        assert.ok(webhookAbos.every(w => w.endsWith(' https://getstackr.de/api/shopify-webhook')));
        assert.deepStrictEqual([...eingang.keys()].sort(), [SHOP + '|101', SHOP + '|102', SHOP + '|103']);
        const p = eingang.get(SHOP + '|101');
        assert.strictEqual(p.status, 'geladen');
        assert.strictEqual(p.payload.order.id, '101');
        assert.strictEqual(p.payload.gebuehr, 2.1);
        assert.strictEqual(i.import_cursor, null, 'Erstimport fertig');
    });

    await check('Webhook: falscher HMAC 401, nichts geschrieben', async () => {
        const vorher = aufrufe.length;
        const res = mockRes();
        await webhook(webhookReq('orders/paid', { id: 200 }, { hmac: 'falsch' }), res);
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(aufrufe.length, vorher);
    });

    await check('Webhook orders/paid: nur ID gemeldet, Bestellung per GraphQL nachgeladen (keine Käuferdaten)', async () => {
        const res = mockRes();
        await webhook(webhookReq('orders/paid', { id: 200, email: 'kaeufer@example.com', customer: { first_name: 'Max' } }), res);
        assert.strictEqual(res.statusCode, 200);
        const e = eingang.get(SHOP + '|200');
        assert.strictEqual(e.status, 'geladen');
        assert.ok(!JSON.stringify(e.payload).includes('kaeufer@example.com'));
        assert.ok(!JSON.stringify(e.payload).includes('Max'));
    });

    await check('Webhook: Nachladen scheitert → Zeile bleibt neu, Shopify bekommt trotzdem 200', async () => {
        shopifyGraphqlKaputt = true;
        const res = mockRes();
        await webhook(webhookReq('orders/updated', { id: 201 }), res);
        shopifyGraphqlKaputt = false;
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(eingang.get(SHOP + '|201').status, 'neu');
    });

    await check('Webhook: Speicherfehler → 500 (Shopify stellt erneut zu)', async () => {
        dbKaputt = true;
        const res = mockRes();
        await webhook(webhookReq('orders/paid', { id: 202 }), res);
        dbKaputt = false;
        assert.strictEqual(res.statusCode, 500);
    });

    await check('Webhook: unbekannter Shop wird nicht angelegt', async () => {
        const fremd = 'fremd.myshopify.com';
        const res = mockRes();
        await webhook(webhookReq('orders/paid', { id: 1 }, { shop: fremd }), res);
        assert.strictEqual(res.statusCode, 200);
        assert.ok(![...eingang.keys()].some(k => k.startsWith(fremd)));
    });

    await check('customers/redact löscht genau die genannten Bestellungen', async () => {
        const res = mockRes();
        await webhook(webhookReq('customers/redact', { shop_domain: SHOP, orders_to_redact: [101, 102] }), res);
        assert.strictEqual(res.statusCode, 200);
        assert.ok(!eingang.has(SHOP + '|101') && !eingang.has(SHOP + '|102'));
        assert.ok(eingang.has(SHOP + '|103'));
    });

    await check('customers/data_request: 200, nichts gelöscht', async () => {
        const n = eingang.size;
        const res = mockRes();
        await webhook(webhookReq('customers/data_request', { shop_domain: SHOP, orders_requested: [103] }), res);
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(eingang.size, n);
    });

    await check('app/uninstalled: Token weg, Status deinstalliert, neue Bestellungen werden nicht mehr angenommen', async () => {
        let res = mockRes();
        await webhook(webhookReq('app/uninstalled', { id: 1 }), res);
        assert.strictEqual(res.statusCode, 200);
        const i = integrations.get(SHOP);
        assert.strictEqual(i.status, 'deinstalliert');
        assert.strictEqual(i.token_chiffrat, null);
        res = mockRes();
        await webhook(webhookReq('orders/paid', { id: 300 }), res);
        assert.ok(!eingang.has(SHOP + '|300'));
    });

    await check('shop/redact: Integration und Eingang des Shops gelöscht', async () => {
        const res = mockRes();
        await webhook(webhookReq('shop/redact', { shop_domain: SHOP }), res);
        assert.strictEqual(res.statusCode, 200);
        assert.ok(!integrations.has(SHOP));
        assert.ok(![...eingang.keys()].some(k => k.startsWith(SHOP)));
    });

    console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
    process.exit(fail ? 1 : 0);
})();
