// Zugang bei gescheiterter Abbuchung (past_due):  node test/test-whop-past-due.js
// Faehrt den echten Handler mit gestubtem fetch. Vorfall 2026-11-01: Kunde sah nach gescheiterter
// Verlaengerung den Kaufbildschirm, weil has_access und valid=true past_due nicht mitzaehlen.

process.env.WHOP_API_KEY = 'apik_test';
process.env.WHOP_COMPANY_ID = 'biz_test';
['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN',
 'WHOP_ACCESS_IDS', 'WHOP_OWNER_IDS', 'WHOP_OWNER_USERNAMES', 'WHOP_GRACE_PRIVATE_KEY',
 'ALERT_WEBHOOK_URL', 'STORAGE_BACKEND', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].forEach(function (k) { delete process.env[k]; });

const handler = require('../api/whop-access.js');

const ICH = 'user_ich';
const PROD = 'prod_wgVmaJg4sBVOD';
const antwort = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

let v1Aufrufe = 0;
function stub({ hasAccess = false, v1 }) {
    v1Aufrufe = 0;
    global.fetch = async (url) => {
        url = String(url);
        if (url.includes('/oauth/userinfo')) return antwort(200, { sub: ICH, preferred_username: 'ich' });
        if (url.includes('/me/has_access/')) return antwort(200, { valid: hasAccess });
        if (url.includes('/v5/company/memberships')) return antwort(200, { data: [], pagination: {} });
        if (url.includes('/api/v1/memberships')) { v1Aufrufe++; return v1(url); }
        return antwort(404, {});
    };
}
function aufruf() {
    return new Promise((resolve) => {
        const res = {
            setHeader() {},
            status(c) { this.c = c; return this; },
            json(b) { resolve({ status: this.c, body: b }); return this; },
            end() { resolve({ status: this.c }); return this; }
        };
        handler({ method: 'POST', headers: {}, body: { token: 't' }, socket: {} }, res);
    });
}
const mitglied = (o) => Object.assign({ status: 'past_due', user: { id: ICH }, product: { id: PROD }, manage_url: 'https://whop.com/billing/manage/mem_x' }, o);

let pass = 0, fail = 0;
function check(name, ok, info) {
    if (ok) { console.log('✓ ' + name); pass++; }
    else { console.log('✗ ' + name + (info ? ' — ' + JSON.stringify(info) : '')); fail++; }
}

(async () => {
    const logError = console.error; console.error = () => {};
    const logWarn = console.warn; console.warn = () => {};
    let r;

    stub({ v1: (url) => { stub.url = url; return antwort(200, { data: [mitglied()] }); } });
    r = await aufruf();
    check('past_due → Zugang', r.body.has_access === true, r);
    check('past_due → Status und Verwaltungslink', r.body.status === 'past_due' && r.body.manage_url === 'https://whop.com/billing/manage/mem_x', r);
    check('Anfrage auf Firma, Status und Nutzer begrenzt',
        stub.url.includes('account_id=biz_test') && stub.url.includes('statuses[]=past_due') && stub.url.includes('user_ids[]=' + ICH), stub.url);

    stub({ v1: () => antwort(200, { data: [mitglied({ user: { id: 'user_fremd' } })] }) });
    r = await aufruf();
    check('fremde Mitgliedschaft (Filter ignoriert) → kein Zugang', r.body.has_access === false, r);

    stub({ v1: () => antwort(200, { data: [mitglied({ status: 'canceled' })] }) });
    r = await aufruf();
    check('anderer Status (Filter ignoriert) → kein Zugang', r.body.has_access === false, r);

    stub({ v1: () => antwort(200, { data: [mitglied({ product: { id: 'prod_anderes' } })] }) });
    r = await aufruf();
    check('fremdes Produkt → kein Zugang', r.body.has_access === false, r);

    stub({ v1: () => antwort(200, { data: [] }) });
    r = await aufruf();
    check('keine Mitgliedschaft → kein Zugang, kein Link', r.body.has_access === false && r.body.manage_url === null, r);

    for (const code of [403, 500]) {
        stub({ v1: () => antwort(code, {}) });
        r = await aufruf();
        check('v1 HTTP ' + code + ' → 200 ohne Zugang statt 502', r.status === 200 && r.body.has_access === false, r);
    }

    stub({ hasAccess: true, v1: () => antwort(200, { data: [mitglied()] }) });
    r = await aufruf();
    check('aktives Abo → Zugang ohne v1-Aufruf', r.body.has_access === true && v1Aufrufe === 0 && r.body.manage_url === null, { r, v1Aufrufe });

    console.error = logError; console.warn = logWarn;
    console.log('\n' + pass + ' ok, ' + fail + ' Fehler');
    process.exit(fail ? 1 : 0);
})();
