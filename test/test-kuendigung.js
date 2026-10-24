// Kündigungsschaltfläche § 312k BGB:  node test/test-kuendigung.js
//
// Geprüft wird api/kuendigung.js mit Attrappen für Supabase, Whop und den Make-Webhook:
//    1) GET -> 405, fremder Origin -> 403, Body zu groß -> 413
//    2) Pflichtfelder fehlen -> 400 mit Hinweis, nichts gespeichert, nichts an Whop
//    3) Honigtopf gefüllt -> 200 ohne Speicherung
//    4) ordentlich + nächstmöglich: Supabase-Zeile, Whop-Suche über alle Seiten, nur laufende
//       Mitgliedschaften derselben E-Mail (Groß/klein egal) at_period_end gekündigt, Status
//       'gekuendigt' mit Wirksamkeitsdatum, Webhook mit Mailtext, HTML-Bestätigung mit Nummer
//    5) keine Mitgliedschaft -> 'nicht_gefunden', Bestätigung trotzdem
//    6) außerordentlich bzw. Wunschdatum -> 'manuell', kein Whop-Aufruf
//    7) Whop 403 (Key ohne Rechte) -> 'fehler', Bestätigung trotzdem
//    8) Supabase UND Webhook aus -> 503 mit Kontakt-E-Mail; nur einer aus -> 200
//    9) Ausgabe ist HTML-escaped, CSP-Header gesetzt
//   10) Migration: rpc-Namen und Parameter passen zu supabase/migrations/20261024000001_kuendigungen.sql
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name); }
}

process.env.SUPABASE_URL = 'https://sb.example';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test';
process.env.STORAGE_BACKEND = 'supabase';
process.env.WHOP_API_KEY = 'apik_test';
process.env.ALERT_WEBHOOK_URL = 'https://hook.example/make';

// ── Attrappen ────────────────────────────────────────────────────────────────
let rows, rl, calls, sbFail, hookFail, whopFail, members;
function reset() {
    rows = []; rl = {}; calls = []; sbFail = false; hookFail = false; whopFail = 0;
    members = [
        { id: 'mem_A', status: 'active',   user: { email: 'Kunde@Example.de' }, renewal_period_end: '2026-11-21T10:00:00Z' },
        { id: 'mem_B', status: 'canceled', user: { email: 'kunde@example.de' } },
        { id: 'mem_C', status: 'trialing', user: { email: 'andere@example.de' } },
        { id: 'mem_D', status: 'trialing', user: { email: 'kunde@example.de' }, renewal_period_end: 1798000000 }
    ];
}
function ok(body) { return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(body == null ? '' : JSON.stringify(body)) }); }
function fail(st) { return Promise.resolve({ ok: false, status: st, json: () => Promise.resolve({}), text: () => Promise.resolve('') }); }

global.fetch = function (url, opts) {
    opts = opts || {};
    calls.push({ url: url, opts: opts });
    if (url.indexOf('https://sb.example/rest/v1/rpc/') === 0) {
        if (sbFail) return fail(503);
        const name = url.split('/').pop(), a = JSON.parse(opts.body);
        if (name === 'sync_rate_hit') { rl[a.p_key] = (rl[a.p_key] || 0) + 1; return ok(rl[a.p_key]); }
        if (name === 'sync_kuendigung_add') { const r = Object.assign({ id: rows.length + 1, eingang: '2026-10-24T08:30:00Z' }, a); rows.push(r); return ok({ id: r.id, eingang: r.eingang }); }
        if (name === 'sync_kuendigung_status') { const r = rows.find(x => x.id === a.p_id); Object.assign(r, a); return ok(null); }
        throw new Error('unbekannte rpc ' + name);
    }
    if (url.indexOf('https://api.whop.com/api/v1/') === 0) {
        if (whopFail) return fail(whopFail);
        const u = new URL(url);
        if (u.pathname === '/api/v1/memberships') {
            // zwei Seiten à 2, um die Paginierung zu prüfen
            const after = u.searchParams.get('after');
            const start = after ? 2 : 0;
            return ok({ data: members.slice(start, start + 2), page_info: { has_next_page: start === 0 && members.length > 2, end_cursor: 'c2' } });
        }
        const m = u.pathname.match(/^\/api\/v1\/memberships\/([^/]+)\/cancel$/);
        if (m) { const x = members.find(y => y.id === m[1]); return ok(Object.assign({}, x, { status: 'canceling', cancel_at_period_end: true })); }
    }
    if (url === 'https://hook.example/make') { return hookFail ? fail(500) : ok({}); }
    throw new Error('unerwarteter fetch ' + url);
};

const handler = require(path.join(__dirname, '..', 'api', 'kuendigung.js'));

function anfrage(felder, extra) {
    extra = extra || {};
    const body = new URLSearchParams(felder).toString();
    return {
        method: extra.method || 'POST',
        headers: Object.assign({ origin: 'https://getstackr.de', host: 'getstackr.de', 'content-length': String(Buffer.byteLength(body)), 'x-forwarded-for': '1.2.3.4' }, extra.headers || {}),
        body: body
    };
}
function antwort() {
    const r = { statusCode: 0, headers: {}, body: '' };
    r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
    r.status = (c) => { r.statusCode = c; return r; };
    r.send = (b) => { r.body = String(b); return r; };
    r.json = (b) => { r.body = JSON.stringify(b); return r; };
    r.end = () => r;
    return r;
}
async function lauf(felder, extra) { const res = antwort(); await handler(anfrage(felder, extra), res); return res; }
const whopCalls = () => calls.filter(c => c.url.indexOf('api.whop.com') !== -1);
const hookCalls = () => calls.filter(c => c.url === 'https://hook.example/make');
const BASIS = { art: 'ordentlich', name: 'Kim Kunde', email: 'kunde@example.de', vertrag: 'monatlich', zeitpunkt: 'naechstmoeglich' };

(async function () {
    // 1
    reset();
    check('GET -> 405', (await lauf(BASIS, { method: 'GET' })).statusCode === 405);
    check('fremder Origin -> 403', (await lauf(BASIS, { headers: { origin: 'https://evil.example' } })).statusCode === 403);
    check('Body zu groß -> 413', (await lauf(BASIS, { headers: { 'content-length': '99999' } })).statusCode === 413);

    // 2
    reset();
    let r = await lauf({ art: 'ausserordentlich', name: '', email: 'kaputt', zeitpunkt: 'datum' });
    check('Pflichtfelder fehlen -> 400', r.statusCode === 400);
    check('400 nennt Name, E-Mail, Grund, Datum', ['Namen', 'E-Mail', 'Grund', 'Kündigungsdatum'].every(w => r.body.indexOf(w) !== -1));
    check('400: nichts gespeichert, kein Whop', rows.length === 0 && whopCalls().length === 0);

    // 3
    reset();
    r = await lauf(Object.assign({ website: 'spam' }, BASIS));
    check('Honigtopf -> 200 ohne Speicherung', r.statusCode === 200 && rows.length === 0 && whopCalls().length === 0);

    // 4
    reset();
    r = await lauf(Object.assign({}, BASIS, { email: 'KUNDE@example.de ' }));
    const cancels = whopCalls().filter(c => /\/cancel$/.test(c.url));
    check('ordentlich: 200', r.statusCode === 200);
    check('Supabase-Zeile mit normalisierter E-Mail', rows.length === 1 && rows[0].p_email === 'kunde@example.de' && rows[0].p_art === 'ordentlich');
    check('Whop-Suche mit account_id, zweite Seite per after', whopCalls().some(c => c.url.indexOf('account_id=biz_2OEWYGlOwb8b0f') !== -1) && whopCalls().some(c => c.url.indexOf('after=c2') !== -1));
    check('genau mem_A und mem_D gekündigt (laufend, gleiche E-Mail)', cancels.length === 2 && /mem_A/.test(cancels[0].url) && /mem_D/.test(cancels[1].url));
    check('cancellation_mode at_period_end', cancels.every(c => JSON.parse(c.opts.body).cancellation_mode === 'at_period_end'));
    check('Authorization mit WHOP_API_KEY', cancels[0].opts.headers.Authorization === 'Bearer apik_test');
    check('Status gekuendigt + spätestes Wirksamkeitsdatum', rows[0].p_status === 'gekuendigt' && rows[0].p_wirksam === new Date(1798000000 * 1000).toISOString());
    const hook = JSON.parse(hookCalls()[0].opts.body);
    check('Webhook: event kuendigung, E-Mail, Nummer, Mailtext', hook.event === 'kuendigung' && hook.email === 'kunde@example.de' && hook.kuendigung === 'K-1' && /§ 312k Abs. 4 BGB/.test(hook.mail_text));
    check('Webhook mit charset=utf-8', hookCalls()[0].opts.headers['Content-Type'] === 'application/json; charset=utf-8');
    check('Bestätigungsseite: Nummer, Eingangszeit, Wirksam-Datum, Drucken-Hinweis', /K-1/.test(r.body) && /24\. Oktober 2026 um 10:30 Uhr/.test(r.body) && /Ende des laufenden Abrechnungszeitraums am/.test(r.body) && /drucke diese Seite/.test(r.body));

    // 5
    reset();
    r = await lauf(Object.assign({}, BASIS, { email: 'niemand@example.de' }));
    check('keine Mitgliedschaft -> nicht_gefunden, trotzdem 200', r.statusCode === 200 && rows[0].p_status === 'nicht_gefunden');

    // 6
    reset();
    r = await lauf(Object.assign({}, BASIS, { art: 'ausserordentlich', grund: 'Dienst seit Wochen nicht erreichbar' }));
    check('außerordentlich -> manuell, kein Whop', r.statusCode === 200 && rows[0].p_status === 'manuell' && whopCalls().length === 0 && /Grund/.test(r.body));
    reset();
    r = await lauf(Object.assign({}, BASIS, { zeitpunkt: 'datum', datum: '2027-03-31' }));
    check('Wunschdatum -> manuell, kein Whop, Datum auf der Seite', rows[0].p_status === 'manuell' && whopCalls().length === 0 && /31\. März 2027/.test(r.body));

    // 7
    reset(); whopFail = 403;
    r = await lauf(BASIS);
    check('Whop 403 -> fehler, trotzdem 200', r.statusCode === 200 && rows[0].p_status === 'fehler' && /HTTP 403/.test(rows[0].p_detail));

    // 8
    reset(); sbFail = true; hookFail = true;
    r = await lauf(BASIS);
    check('Supabase und Webhook aus -> 503 mit Kontakt', r.statusCode === 503 && /mailto:/.test(r.body));
    reset(); sbFail = true;
    r = await lauf(BASIS);
    check('nur Supabase aus -> 200 (Webhook hält fest)', r.statusCode === 200);
    reset(); hookFail = true;
    r = await lauf(BASIS);
    check('nur Webhook aus -> 200 ohne Mail-Versprechen', r.statusCode === 200 && !/zusätzlich an die angegebene E-Mail/.test(r.body));

    // 9
    reset();
    r = await lauf(Object.assign({}, BASIS, { name: '<script>alert(1)</script>' }));
    check('Name HTML-escaped', r.body.indexOf('<script>') === -1 && r.body.indexOf('&lt;script&gt;') !== -1);
    check('CSP-Header mit script-src none', /script-src 'none'/.test(r.headers['content-security-policy'] || ''));

    // 10
    const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261024000001_kuendigungen.sql'), 'utf8');
    check('Migration: sync_kuendigung_add mit 7 Parametern', /sync_kuendigung_add\(\s*p_name text, p_email text, p_art text, p_grund text, p_zeitpunkt text, p_vertrag text, p_kennung text\)/.test(sql));
    check('Migration: sync_kuendigung_status(p_id, p_status, p_detail, p_wirksam)', /sync_kuendigung_status\(\s*p_id bigint, p_status text, p_detail text, p_wirksam timestamptz\)/.test(sql));

    console.log('\n' + pass + '/' + total + ' Kündigungs-Tests bestanden ' + (pass === total ? '✅' : '❌'));
    if (pass !== total) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
