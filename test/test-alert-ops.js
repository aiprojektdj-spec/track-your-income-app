// Regressionstest: api/_alert.js — Betriebs-Alarm bei offenem Fail-open-Deckel (2026-08-15)
//  A) Ohne ALERT_WEBHOOK_URL wird KEIN Netzverkehr erzeugt (Verhalten wie vorher).
//  B) Mit Webhook geht genau EINE Meldung raus, Wiederholungen werden entprellt.
//  C) Verschiedene Ereignisse entprellen sich NICHT gegenseitig.
//  D) Nach Ablauf des Entprell-Fensters wird wieder gemeldet.
//  E) alertOps wirft nie — ein kaputter Webhook darf keinen Request kippen.
//  F) Die Entprell-Map waechst nicht unbegrenzt (Deckel MAX_KEYS).
//  G) Zweites Ziel Vercel Blob (2026-09-10): ohne BLOB_READ_WRITE_TOKEN kein put,
//     mit Token liegt dieselbe Nutzlast unter 'stackr/alerts/<datum>/', ein
//     streikender Blob-Store wirft nicht durch, und beide Ziele stoeren sich nicht.
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

// put-Attrappe fuer '@vercel/blob'. _alert.js laedt das Modul erst im Fehlerpfad
// (lazy require), deshalb genuegt es, den require-Cache vorab zu besetzen.
const BLOBMOD = require.resolve('@vercel/blob');
let puts = [], putMode = 'ok';
require.cache[BLOBMOD] = {
    id: BLOBMOD, filename: BLOBMOD, loaded: true, exports: {
        put: function (pathname, body, opts) {
            puts.push({ pathname: pathname, body: body, opts: opts });
            if (putMode === 'throw') return Promise.reject(new Error('blob kaputt'));
            return Promise.resolve({ url: 'https://blob.example/' + pathname });
        }
    }
};

// Laedt _alert.js frisch (Modul-Scope-Entprellung zuruecksetzen) mit gesetzter Env.
// blobToken: Zeichenkette = Ziel 2 aktiv, sonst aus.
function freshAlert(webhookUrl, blobToken) {
    delete require.cache[require.resolve(MOD)];
    if (webhookUrl) process.env.ALERT_WEBHOOK_URL = webhookUrl;
    else            delete process.env.ALERT_WEBHOOK_URL;
    if (blobToken)  process.env.BLOB_READ_WRITE_TOKEN = blobToken;
    else            delete process.env.BLOB_READ_WRITE_TOKEN;
    puts = []; putMode = 'ok';
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
    check('A1 ohne ALERT_WEBHOOK_URL kein fetch', calls.length === 0);
    check('A2 ohne beide Ziele auch kein Blob-put', puts.length === 0);

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

    // ── G: zweites Ziel — Vercel Blob ────────────────────────────────
    // G1: Blob allein, ohne Webhook — genau der Zustand vor eingerichtetem Make.com.
    stubFetch('ok');
    alertOps = freshAlert(null, 'vercel_blob_rw_TESTTOKEN');
    await alertOps('sync', 'redis-env-missing', 'KV_REST_API_URL fehlt');
    check('G1 ohne Webhook trotzdem ein Blob-Objekt', puts.length === 1 && calls.length === 0);

    const geschrieben = puts[0] || { pathname: '', body: '{}', opts: {} };
    const heute = new Date().toISOString().slice(0, 10);
    check('G2 Pfad liegt unter stackr/alerts/<datum>/',
          geschrieben.pathname.indexOf('stackr/alerts/' + heute + '/') === 0);
    check('G3 Pfad nennt Quelle und Ereignis',
          geschrieben.pathname.indexOf('sync_redis-env-missing_') !== -1);
    check('G4 als JSON abgelegt, mit Zufallssuffix',
          geschrieben.opts.contentType === 'application/json' &&
          geschrieben.opts.addRandomSuffix === true &&
          geschrieben.opts.token === 'vercel_blob_rw_TESTTOKEN');

    let inhalt = {};
    try { inhalt = JSON.parse(geschrieben.body); } catch (e) {}
    check('G5 Inhalt ist dieselbe Nutzlast wie beim Webhook',
          inhalt.source === 'sync' && inhalt.event === 'redis-env-missing' &&
          inhalt.detail === 'KV_REST_API_URL fehlt' &&
          typeof inhalt.text === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(inhalt.ts));

    // G6: derselbe Alarm ist auch hier entprellt — kein Objekt je Request.
    await alertOps('sync', 'redis-env-missing', 'nochmal');
    check('G6 Entprellung gilt fuer das Blob-Ziel genauso', puts.length === 1);

    // G7: beide Ziele gleichzeitig, je genau einmal.
    stubFetch('ok');
    alertOps = freshAlert('https://hook.example/beides', 'vercel_blob_rw_TESTTOKEN');
    await alertOps('blob-upload', 'byte-budget-open', 'Redis weg');
    check('G7 beide Ziele bekommen je eine Meldung', calls.length === 1 && puts.length === 1);

    // G8: ein streikender Blob-Store darf den Request nicht kippen — und den
    // Webhook nicht mit sich reissen (Promise.all haelt nur, weil beide schlucken).
    stubFetch('ok');
    alertOps = freshAlert('https://hook.example/blobkaputt', 'vercel_blob_rw_TESTTOKEN');
    putMode = 'throw';
    threw = false;
    try { await alertOps('whop-refresh', 'redis-fehlt', 'x'); } catch (e) { threw = true; }
    check('G8 abgelehntes put wirft nicht durch', threw === false);
    check('G9 Webhook geht trotz kaputtem Blob raus', calls.length === 1);

    // G10: ein Schraegstrich in source/event darf keine Unterebene aufmachen.
    stubFetch('ok');
    alertOps = freshAlert(null, 'vercel_blob_rw_TESTTOKEN');
    await alertOps('sync/../attachments', 'ev/1', 'x');
    check('G10 Pfadsegmente sind entschaerft',
          puts.length === 1 &&
          puts[0].pathname.indexOf('stackr/alerts/' + heute + '/sync----attachments_ev-1_') === 0);

    console.error = realError;
    console.log('\n' + pass + '/' + total + ' Checks bestanden');
    process.exit(pass === total ? 0 : 1);
})();
