// Kontaktformular (zweiter Kommunikationsweg im Impressum):  node test/test-kontakt.js
//
// Geprüft wird api/kontakt.js mit Attrappen für Supabase (Rate-Limit) und den Make-Webhook:
//    1) GET -> 405, fremder Origin -> 403, Body zu groß -> 413
//    2) Pflichtfelder fehlen -> 400 mit Hinweis, nichts gesendet
//    3) Honigtopf gefüllt -> 200 ohne Versand
//    4) gültig -> Webhook mit event 'kontakt', Name, E-Mail, Nachricht (Zeilenumbrüche erhalten),
//       charset im Content-Type; 200-Seite nennt die Antwortadresse
//    5) Webhook kaputt oder nicht gesetzt -> 503 mit Kontakt-E-Mail
//    6) Rate-Limit: 6. Nachricht derselben IP in 10 Minuten -> 429; Supabase-Ausfall -> fail-open
//    7) Ausgabe HTML-escaped, CSP-Header; Seite, Impressum, DSE und vercel.json verdrahtet
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name); }
}

process.env.SUPABASE_URL = 'https://sb.example';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test';
process.env.STORAGE_BACKEND = 'supabase';
process.env.ALERT_WEBHOOK_URL = 'https://hook.example/make';

let rl, calls, sbFail, hookFail;
function reset() { rl = {}; calls = []; sbFail = false; hookFail = false; }
function ok(body) { return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(body == null ? '' : JSON.stringify(body)) }); }
function fail(st) { return Promise.resolve({ ok: false, status: st, json: () => Promise.resolve({}), text: () => Promise.resolve('') }); }

global.fetch = function (url, opts) {
    opts = opts || {};
    calls.push({ url: url, opts: opts });
    if (url.indexOf('https://sb.example/rest/v1/rpc/') === 0) {
        if (sbFail) return fail(503);
        const name = url.split('/').pop(), a = JSON.parse(opts.body);
        if (name === 'sync_rate_hit') { rl[a.p_key] = (rl[a.p_key] || 0) + 1; return ok(rl[a.p_key]); }
        throw new Error('unbekannte rpc ' + name);
    }
    if (url === 'https://hook.example/make') return hookFail ? fail(500) : ok({});
    throw new Error('unerwarteter fetch ' + url);
};
console.error = function () {};
console.warn  = function () {};

const handler = require(path.join(ROOT, 'api', 'kontakt.js'));

function anfrage(felder, extra) {
    extra = extra || {};
    const body = new URLSearchParams(felder).toString();
    return {
        method: extra.method || 'POST',
        headers: Object.assign({ origin: 'https://getstackr.de', host: 'getstackr.de', 'content-length': String(Buffer.byteLength(body)), 'x-forwarded-for': extra.ip || '1.2.3.4' }, extra.headers || {}),
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
const hookCalls = () => calls.filter(c => c.url === 'https://hook.example/make');
const BASIS = { name: 'Kim Kunde', email: 'Kunde@Example.de', betreff: 'Frage', nachricht: 'Zeile 1\r\nZeile 2' };

(async function () {
    reset();
    check('1a GET -> 405', (await lauf(BASIS, { method: 'GET' })).statusCode === 405);
    check('1b fremder Origin -> 403', (await lauf(BASIS, { headers: { origin: 'https://evil.example' } })).statusCode === 403);
    check('1c Body zu groß -> 413', (await lauf(BASIS, { headers: { 'content-length': '99999' } })).statusCode === 413);

    reset();
    let r = await lauf({ name: '', email: 'kaputt', nachricht: '' });
    check('2a Pflichtfelder fehlen -> 400', r.statusCode === 400);
    check('2b 400 nennt Name, E-Mail, Nachricht', ['Namen', 'E-Mail', 'Nachricht'].every(w => r.body.indexOf(w) !== -1));
    check('2c 400: nichts gesendet', hookCalls().length === 0);

    reset();
    r = await lauf(Object.assign({ website: 'spam' }, BASIS));
    check('3 Honigtopf -> 200 ohne Versand', r.statusCode === 200 && hookCalls().length === 0);

    reset();
    r = await lauf(BASIS);
    const h = hookCalls()[0], p = h ? JSON.parse(h.opts.body) : {};
    check('4a gültig -> 200', r.statusCode === 200);
    check('4b Webhook einmal, event kontakt', hookCalls().length === 1 && p.event === 'kontakt' && p.source === 'kontakt');
    check('4c Name, E-Mail (klein), Betreff, Nachricht mit Zeilenumbruch', p.name === 'Kim Kunde' && p.email === 'kunde@example.de' && p.betreff === 'Frage' && p.nachricht === 'Zeile 1\nZeile 2');
    check('4d text enthält Absender und Nachricht (für das bestehende Make-Szenario)', /kunde@example\.de/.test(p.text) && /Zeile 2/.test(p.text));
    check('4e charset im Content-Type', /charset=utf-8/.test(h && h.opts.headers['Content-Type']));
    check('4f Danke-Seite nennt Antwortadresse', r.body.indexOf('kunde@example.de') !== -1);

    reset(); hookFail = true;
    r = await lauf(BASIS);
    check('5a Webhook kaputt -> 503 mit Kontakt-E-Mail', r.statusCode === 503 && r.body.indexOf('secondlife.vintage07@gmail.com') !== -1);
    const alt = process.env.ALERT_WEBHOOK_URL; delete process.env.ALERT_WEBHOOK_URL; reset();
    r = await lauf(BASIS);
    process.env.ALERT_WEBHOOK_URL = alt;
    check('5b Webhook nicht gesetzt -> 503', r.statusCode === 503);

    reset();
    let codes = [];
    for (let i = 0; i < 6; i++) codes.push((await lauf(BASIS, { ip: '9.9.9.9' })).statusCode);
    check('6a 6. Nachricht derselben IP -> 429', codes.slice(0, 5).every(c => c === 200) && codes[5] === 429);
    check('6b andere IP geht weiter', (await lauf(BASIS, { ip: '8.8.8.8' })).statusCode === 200);
    reset(); sbFail = true;
    check('6c Supabase-Ausfall -> fail-open, Nachricht geht raus', (await lauf(BASIS)).statusCode === 200 && hookCalls().length === 1);

    reset();
    r = await lauf({ name: '<script>x</script>', email: 'a@b.de', nachricht: 'x' });
    check('7a Ausgabe escaped', r.body.indexOf('<script>x') === -1);
    check('7b CSP-Header gesetzt, script-src none', /script-src 'none'/.test(r.headers['content-security-policy'] || ''));
    const html = fs.readFileSync(path.join(ROOT, 'kontakt.html'), 'utf8');
    check('7c Formular postet an /api/kontakt mit Honigtopf', /action="\/api\/kontakt"/.test(html) && /name="website"/.test(html));
    check('7d Impressum verlinkt das Formular', /href="kontakt\.html"/.test(fs.readFileSync(path.join(ROOT, 'impressum.html'), 'utf8')));
    check('7e Datenschutz hat Abschnitt #kontakt mit Make', /id="kontakt"[\s\S]{0,400}Make\.com/.test(fs.readFileSync(path.join(ROOT, 'datenschutz.html'), 'utf8')));
    const vj = fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8');
    check('7f vercel.json: CSP-Route und Weiterleitung alte Domain', /"source": "\/kontakt\.html"/.test(vj) && /kontakt\\\\\.html/.test(vj));

    console.log('\n' + pass + '/' + total + ' bestanden');
    process.exit(pass === total ? 0 : 1);
})().catch(e => { console.log('✗ Abbruch: ' + (e && e.stack)); process.exit(1); });
