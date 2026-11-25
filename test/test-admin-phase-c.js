// Admin-Panel Phase c (Billing, nur Anzeige):  node test/test-admin-phase-c.js
//  A) Whop-Zahlungen parsen: Cent, fehlgeschlagen, Karte nur Marke + letzte 4
//  B) Whop wird NUR gelesen (GET), im Code und im Aufruf
//  C) Endpunkte: Rechte, Validierung, Maskierung, Blockweise Speicherung
//  D) Migration: Rechte, kein Kartenfeld ausser Marke/letzte 4
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const A = path.join(ROOT, 'admin');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name); }
}

const B = require(path.join(A, 'lib', 'billing.js'));

// ── A) Parsen ──────────────────────────────────────────────────────────────────
check('A1 Cent: Dezimal -> Cent ohne Gleitkomma-Fehler', B.cents(15) === 1500 && B.cents(19.99) === 1999 && B.cents('0.29') === 29 && B.cents(null) === 0 && B.cents('x') === 0);
check('A2 fehlgeschlagen erkannt', B.istFehlgeschlagen({ status: 'failed' }) && B.istFehlgeschlagen({ status: 'card_declined' }) &&
    B.istFehlgeschlagen({ status: 'open', failure_message: 'Karte abgelehnt' }) && !B.istFehlgeschlagen({ status: 'paid', paid_at: 'x' }) &&
    !B.istFehlgeschlagen({ status: 'paid', failure_message: 'alt', paid_at: 'x' }));
const z = B.zeile({ id: 'pay_1', status: 'paid', total: 15, refunded_amount: 5, currency: 'EUR', card_brand: 'visa', card_last4: '4242',
    user: { id: 'user_1' }, membership: { id: 'mem_1' }, created_at: '2026-10-01T00:00:00Z', paid_at: '2026-10-01T00:00:01Z', card_number: '4242424242424242' });
check('A3 Zeile: Betraege, IDs, Karte nur Marke + letzte 4, keine weiteren Kartenfelder',
    z.amount_cents === 1500 && z.refunded_cents === 500 && z.currency === 'eur' && z.whop_user_id === 'user_1' && z.card_last4 === '4242' &&
    !('card_number' in z) && JSON.stringify(z).indexOf('4242424242424242') === -1);
check('A4 card_last4 wird auf 4 Zeichen gekuerzt', B.zeile({ id: 'p', card_last4: '1234567890' }).card_last4 === '7890');
const z1 = B.zeile({ id: 'pay_9', status: 'paid', total: { amount: '15.00', currency: 'eur', decimals: 2 }, refunded_amount: { amount: '0.00', currency: 'eur', decimals: 2 },
    user: { id: 'user_9' }, membership_id: 'mem_9', payment_instrument: { card: { brand: 'visa', last4: '4242', issuer_identification_number: '424242' } } });
check('A4b v1-Format: Money-Objekt, Waehrung, Karte aus payment_instrument, keine BIN', z1.amount_cents === 1500 && z1.refunded_cents === 0 &&
    z1.currency === 'eur' && z1.card_brand === 'visa' && z1.card_last4 === '4242' && z1.membership_id === 'mem_9' && JSON.stringify(z1).indexOf('424242') === -1);

// ── B) nur GET ─────────────────────────────────────────────────────────────────
(async () => {
    const calls = [];
    const seiten = [
        { data: [{ id: 'pay_1', total: 15 }, { id: 'pay_2', status: 'failed', failure_message: 'x' }, { nix: 1 }], page_info: { has_next_page: true, end_cursor: 'c1' } },
        { data: [{ id: 'pay_3', total: 1 }], page_info: { has_next_page: false } }
    ];
    const rows = await B.zahlungenLaden({ WHOP_API_KEY: 'k' }, async (url, opts) => {
        calls.push({ url, method: opts.method });
        return { ok: true, json: async () => seiten[url.indexOf('after=c1') !== -1 ? 1 : 0] };
    });
    check('B1 Zahlungen ueber 2 Seiten, Eintrag ohne ID uebersprungen', rows.length === 3 && calls.length === 2);
    check('B2 jeder Whop-Aufruf ist GET', calls.every(c => c.method === 'GET'));
    const dateien = [];
    (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p); else if (/\.(js|html)$/.test(f.name)) dateien.push(p);
    } })(A);
    const mitWhop = dateien.filter(f => /api\.whop\.com|WHOP_API\b/.test(fs.readFileSync(f, 'utf8')));
    check('B3 nur lib/members.js und lib/billing.js sprechen mit Whop', mitWhop.map(f => path.basename(f)).sort().join() === 'billing.js,members.js');
    check('B4 in diesen Dateien kein schreibender HTTP-Aufruf', mitWhop.every(f => !/method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i.test(fs.readFileSync(f, 'utf8'))));
    check('B5 Admin-Code kennt keine Whop-Schreibpfade (refund/cancel)', dateien.every(f => !/\/refund|\/cancel/.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, ''))));

    // ── C) Endpunkte ──────────────────────────────────────────────────────────
    process.env.SUPABASE_URL = 'http://sb.mock';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test';
    process.env.ADMIN_EMAIL = 'chef@example.com';
    delete process.env.WHOP_API_KEY;
    const jwt = 'x.' + Buffer.from(JSON.stringify({ aal: 'aal2', session_id: 's1' })).toString('base64url') + '.y';
    let rpcs = [];
    global.fetch = async (url, opts) => {
        if (url.indexOf('/auth/v1/user') !== -1) return { ok: true, status: 200, json: async () => ({ email: 'chef@example.com', email_confirmed_at: '2026-01-01' }) };
        const name = url.split('/rpc/')[1];
        const body = JSON.parse(opts.body);
        rpcs.push({ name, body });
        const out = name === 'sync_admin_session_touch' ? true
                  : name === 'sync_admin_dunning' ? { past_due: [{ whop_user_id: 'user_1', email: 'anna@x.de' }], failed: [{ id: 'pay_2', email: 'bob@y.de' }], zuletzt_abgeglichen: null }
                  : name === 'sync_admin_payments_for' ? { payments: [], summe: {}, zuletzt_abgeglichen: null }
                  : name === 'sync_admin_payments_upsert' ? body.p_rows.length : null;
        return { ok: true, status: 200, text: async () => JSON.stringify(out) };
    };
    const billing = require(path.join(A, 'api', 'billing.js'));
    const psync = require(path.join(A, 'api', 'payments-sync.js'));
    function run(handler, req) {
        return new Promise((resolve) => {
            const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; },
                end(b) { resolve({ code: this.statusCode, body: b ? JSON.parse(b) : null }); } };
            req.headers = Object.assign({ authorization: 'Bearer ' + jwt }, req.headers);
            handler(req, res);
        });
    }
    let r = await run(billing, { method: 'GET', query: { dunning: '1' } });
    check('C1 Mahnliste: E-Mails maskiert', r.code === 200 && r.body.past_due[0].email === 'a***@x.de' && r.body.failed[0].email === 'b***@y.de');
    r = await run(billing, { method: 'GET', query: { id: 'user_1' } });
    check('C2 Zahlungen eines Mitglieds', r.code === 200 && rpcs.some(c => c.name === 'sync_admin_payments_for' && c.body.p_id === 'user_1'));
    r = await run(billing, { method: 'GET', query: { id: "x'; drop" } });
    check('C3 ungueltige ID: 400', r.code === 400);
    r = await run(billing, { method: 'POST', query: {} });
    check('C4 Billing-Endpunkt nimmt nur GET', r.code === 405);
    r = await run(billing, { method: 'GET', query: { dunning: '1' }, headers: { authorization: '' } });
    check('C5 ohne Token 401', r.code === 401);

    rpcs = [];
    r = await run(psync, { method: 'POST', body: {} });
    check('C6 Zahlungsabgleich ohne WHOP_API_KEY: 503, nichts geschrieben', r.code === 503 && !rpcs.some(c => c.name === 'sync_admin_payments_upsert'));
    process.env.WHOP_API_KEY = 'k';
    const real = global.fetch;
    const viele = []; for (let i = 0; i < 1100; i++) viele.push({ id: 'pay_' + i, total: 1, status: 'paid', paid_at: 'x' });
    let whopMethods = [];
    global.fetch = async (url, opts) => {
        if (url.indexOf('api.whop.com') !== -1) { whopMethods.push(opts.method); return { ok: true, json: async () => ({ data: viele, page_info: { has_next_page: false } }) }; }
        return real(url, opts);
    };
    rpcs = [];
    r = await run(psync, { method: 'POST', body: {} });
    const ups = rpcs.filter(c => c.name === 'sync_admin_payments_upsert');
    check('C7 Abgleich in 500er-Bloecken, Audit nur im letzten, Whop nur per GET',
        r.code === 200 && ups.length === 3 && ups.map(u => u.body.p_audit).join() === 'false,false,true' && whopMethods.every(m => m === 'GET'));
    global.fetch = async (url, opts) => url.indexOf('api.whop.com') !== -1
        ? { ok: true, json: async () => ({ data: [], page_info: { has_next_page: false } }) } : real(url, opts);
    rpcs = [];
    r = await run(psync, { method: 'POST', body: {} });
    check('C8 Whop leer: 502, nichts geschrieben', r.code === 502 && !rpcs.some(c => c.name === 'sync_admin_payments_upsert'));

    // ── D) Migration ──────────────────────────────────────────────────────────
    const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261102000003_admin_payments.sql'), 'utf8');
    const tabelle = sql.slice(sql.indexOf('create table if not exists admin_payments'), sql.indexOf(');', sql.indexOf('create table if not exists admin_payments')));
    check('D1 Tabelle speichert von der Karte nur Marke und letzte 4 Ziffern', /card_brand/.test(tabelle) && /card_last4/.test(tabelle) && !/card_(number|exp|cvc|fingerprint)/.test(tabelle));
    check('D2 RLS an, anon/authenticated ohne Rechte', /alter table admin_payments enable row level security/.test(sql) && /revoke all on admin_payments from public, anon, authenticated/.test(sql));
    check('D3 Abgleich schreibt Audit-Eintrag in derselben Funktion', /sync_admin_audit_intern\(p_ctx, 'payments\.sync'/.test(sql));

    console.log('\n' + pass + '/' + total + ' bestanden');
    process.exit(pass === total ? 0 : 1);
})();
