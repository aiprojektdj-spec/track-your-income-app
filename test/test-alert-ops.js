// Regressionstest: api/_alert.js — Betriebs-Alarm bei offenem Fail-open-Deckel (2026-08-15)
//  A) Ohne ALERT_WEBHOOK_URL wird KEIN Netzverkehr erzeugt (Verhalten wie vorher).
//  B) Mit Webhook geht genau EINE Meldung raus, Wiederholungen werden entprellt.
//  C) Verschiedene Ereignisse entprellen sich NICHT gegenseitig.
//  D) Nach Ablauf des Entprell-Fensters wird wieder gemeldet.
//  E) alertOps wirft nie — ein kaputter Webhook darf keinen Request kippen.
//  F) Die Entprell-Map waechst nicht unbegrenzt (Deckel MAX_KEYS).
// _alert.js ist ein reines CommonJS-Modul ohne DOM/localStorage und laesst sich
// deshalb — anders als die js/*.js — direkt require()n.
'use strict';
const path = require('path');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name); }
}

const MOD = path.join(__dirname, '..', 'api', '_alert.js');

// Laedt _alert.js frisch (Modul-Scope-Entprellung zuruecksetzen) mit gesetzter Env.
function freshAlert(webhookUrl) {
    delete require.cache[require.resolve(MOD)];
    if (webhookUrl) process.env.ALERT_WEBHOOK_URL = webhookUrl;
    else            delete process.env.ALERT_WEBHOOK_URL;
    return require(MOD).alertOps;
}

// fetch-Attrappe: zaehlt Aufrufe und merkt sich die Nutzlast.
let calls = [];
function stubFetch(mode) {
    calls = [];
    global.fetch = function (url, opts) {
        calls.push({ url: url, body: JSON.parse(opts.body) });
        if (mode === 'throw')  return Promise.reject(new Error('webhook kaputt'));
        if (mode === 'status') return Promise.resolve({ ok: false, status: 500 });
        return Promise.resolve({ ok: true, status: 200 });
    };
}

// console.error stummschalten — alertOps loggt bewusst immer.
const realError = console.error;
console.error = function () {};

(async function run() {
    // ── A: ohne Webhook kein Netzverkehr ──────────────────────────────────────
    stubFetch('ok');
    let alertOps = freshAlert(null);
    await alertOps('sync', 'rate-limit-open', 'Redis weg');
    check('A ohne ALERT_WEBHOOK_URL kein fetch', calls.length === 0);

    // ── B: mit Webhook genau eine Meldung, Rest entprellt ─────────────────────
    stubFetch('ok');
    alertOps = freshAlert('https://hook.example/test');
    await alertOps('sync', 'rate-limit-open', 'Redis weg');
    await alertOps('sync', 'rate-limit-open', 'Redis weg');
    await alertOps('sync', 'rate-limit-open', 'Redis weg');
    check('B1 nur eine Meldung trotz drei Aufrufen', calls.length === 1);
    check('B2 Ziel-URL stimmt',                      calls[0].url === 'https://hook.example/test');
    check('B3 text-Feld fuer Slack vorhanden',       typeof calls[0].body.text === 'string' &&
                                                     calls[0].body.text.indexOf('sync') !== -1);
    check('B4 strukturierte Felder fuer Make.com',   calls[0].body.source === 'sync' &&
                                                     calls[0].body.event  === 'rate-limit-open');
    check('B5 Zeitstempel ist ISO',                  /^\d{4}-\d{2}-\d{2}T/.test(calls[0].body.ts));

    // ── C: anderes Ereignis wird nicht mitentprellt ───────────────────────────
    await alertOps('sync', 'ip-rate-limit-open', 'auch weg');
    await alertOps('blob-upload', 'rate-limit-open', 'auch weg');
    check('C anderes Ereignis meldet eigenstaendig', calls.length === 3);

    // ── D: nach dem Fenster wieder melden ─────────────────────────────────────
    // 5-Minuten-Fenster: Uhr um 6 Minuten vorstellen statt zu warten.
    const realNow = Date.now;
    Date.now = function () { return realNow() + 6 * 60 * 1000; };
    await alertOps('sync', 'rate-limit-open', 'Redis immer noch weg');
    Date.now = realNow;
    check('D nach Ablauf des Fensters wieder eine Meldung', calls.length === 4);

    // ── E: kaputter Webhook wirft nicht nach aussen ───────────────────────────
    stubFetch('throw');
    alertOps = freshAlert('https://hook.example/kaputt');
    let threw = false;
    try { await alertOps('sync', 'rate-limit-open', 'x'); } catch (e) { threw = true; }
    check('E1 abgelehnter fetch wirft nicht durch', threw === false);

    stubFetch('status');
    alertOps = freshAlert('https://hook.example/500');
    threw = false;
    try { await alertOps('sync', 'rate-limit-open', 'x'); } catch (e) { threw = true; }
    check('E2 HTTP-500 vom Webhook wirft nicht durch', threw === false);

    // ── F: Map-Deckel greift ──────────────────────────────────────────────────
    stubFetch('ok');
    alertOps = freshAlert('https://hook.example/viele');
    for (let i = 0; i < 120; i++) await alertOps('src' + i, 'ev', 'd');
    check('F1 alle 120 verschiedenen Ereignisse gemeldet', calls.length === 120);
    // Der aelteste Schluessel wurde verdraengt -> src0 meldet sofort wieder.
    await alertOps('src0', 'ev', 'd');
    check('F2 verdraengter Schluessel meldet erneut', calls.length === 121);

    console.error = realError;
    console.log('\n' + pass + '/' + total + ' Checks bestanden');
    process.exit(pass === total ? 0 : 1);
})();
