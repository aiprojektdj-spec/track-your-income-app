// Feuern die dokumentierten Ausloeser wirklich?  node test/test-alert-ausloeser.js
//
// Die Luecke, die dieser Test schliesst (benannt am 2026-09-14): Der Selbsttest
// '?probe=1' aus api/blob-cleanup.js belegt die Kette erst **ab** alertOps —
// Variable kommt an, Make nimmt die Nutzlast, Mail wird zugestellt. Er belegt
// NICHT, dass ein echter Ausloeser ueberhaupt in den alertOps-Zweig laeuft.
// test-alert-ops.js wiederum prueft alertOps selbst, aber nie einen Endpunkt.
// Dazwischen lag bis hierher gar kein Test: dass api/sync.js bei fehlender
// Redis-Env tatsaechlich meldet, stand nur in der Ausloeser-Tabelle der
// Anleitung — also in einer Plandatei, nicht im Code.
//
// Geprueft wird deshalb der echte Handler gegen die Env, die den Alarm ausloesen
// soll: kommt die Meldung, traegt sie das dokumentierte source:event-Paar, und
// bleibt die Antwort die zugesagte? Dazu die Gegenprobe — mit gesetzter Env darf
// KEIN Alarm kommen, sonst wuerde dieser Test auch einen dauerfeuernden Endpunkt
// gruen melden.
//
// Was hier fehlt und anderswo steht: 'blob-upload'/'redis-env-missing' und
// 'byte-budget-open' liegen in chargeBlobBudget hinter der Whop-Auth; sie sind
// auf Funktionsebene in test/test-blob-budget.js abgedeckt (dort Zeile 90-103).
'use strict';
const path = require('path');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name); }
}

// ── alertOps-Spion: require-Cache von api/_alert.js vorab besetzen ───────────
// Die Handler holen sich das Modul beim Laden; ein Spion hier faengt jede
// Meldung ab, ohne dass irgendein Webhook oder Blob-Store angefasst wird.
const ALERTMOD = require.resolve(path.join(__dirname, '..', 'api', '_alert.js'));
let alarme = [];
require.cache[ALERTMOD] = {
    id: ALERTMOD, filename: ALERTMOD, loaded: true, exports: {
        alertOps: async function (source, event, detail) {
            alarme.push({ source: source, event: event, detail: detail });
            return true;
        },
        alertZiele: function () { return { webhook: false, blob: false }; }
    }
};

const REDIS_ENVS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
                    'KV_REST_API_URL', 'KV_REST_API_TOKEN'];

// Handler frisch laden — alle lesen ihre Env im Modul-Scope beim Laden.
// redis: false = alle vier Variablen weg (genau der gemeldete Zustand).
function freshHandler(datei, opts) {
    opts = opts || {};
    const p = require.resolve(path.join(__dirname, '..', 'api', datei));
    delete require.cache[p];
    REDIS_ENVS.forEach(function (k) { delete process.env[k]; });
    if (opts.redis) {
        process.env.KV_REST_API_URL   = 'http://redis.mock';
        process.env.KV_REST_API_TOKEN = 'testtoken';
    }
    if (opts.cronSecret) process.env.CRON_SECRET = opts.cronSecret;
    else                 delete process.env.CRON_SECRET;
    alarme = [];
    return require(p);
}

function mkReq(o) {
    o = o || {};
    return {
        method:  o.method || 'POST',
        url:     o.url || '/',
        query:   o.query || {},
        headers: o.headers || {},
        body:    o.body || {},
        socket:  { remoteAddress: '203.0.113.7' }
    };
}
function mkRes() {
    const r = { code: 0, body: null, headers: {} };
    r.status    = function (c) { r.code = c; return r; };
    r.json      = function (b) { r.body = b; return r; };
    r.end       = function ()  { return r; };
    r.setHeader = function (k, v) { r.headers[k] = v; return r; };
    return r;
}

// Whop antwortet im Test nie echt — 401 beendet die Handler kontrolliert,
// nachdem der Alarm bereits gefallen ist.
global.fetch = function () {
    return Promise.resolve({
        ok: false, status: 401,
        json: function () { return Promise.resolve({}); }
    });
};

const realError = console.error;
console.error = function () {};

(async function run() {
    // ── 1: sync/redis-env-missing — der dringlichste Alarm der Liste ─────────
    // Kein offener Deckel, sondern Totalausfall: der Cloud-Sync ist fuer alle aus.
    let handler = freshHandler('sync.js');
    let res = mkRes();
    await handler(mkReq({ method: 'POST' }), res);
    check('1a sync meldet bei fehlender Redis-Env',
          alarme.length === 1 && alarme[0].source === 'sync' && alarme[0].event === 'redis-env-missing');
    check('1b und antwortet 500 server_misconfigured',
          res.code === 500 && res.body && res.body.error === 'server_misconfigured');
    // Der Alarm liegt VOR der Tokenpruefung — genau darauf beruht die Gegenprobe
    // in der Anleitung, die ohne gueltiges Token auskommt.
    check('1c ohne Authorization-Header, also vor der Tokenpruefung',
          alarme.length === 1);

    // ── 2: Gegenprobe — mit Env darf NICHTS gemeldet werden ──────────────────
    handler = freshHandler('sync.js', { redis: true });
    res = mkRes();
    await handler(mkReq({ method: 'POST' }), res);
    check('2a mit gesetzter Redis-Env kein redis-env-missing',
          alarme.filter(function (a) { return a.event === 'redis-env-missing'; }).length === 0);
    check('2b und die Antwort ist nicht mehr server_misconfigured',
          !(res.body && res.body.error === 'server_misconfigured'));

    // ── 3: whop-refresh/redis-fehlt — der zweite Totalausfall ────────────────
    // Ohne Redis faellt JEDER Kunde nach einer Stunde aus dem Gate.
    handler = freshHandler('whop-refresh.js');
    res = mkRes();
    await handler(mkReq({ body: { session_id: 'a'.repeat(64) } }), res);
    check('3a whop-refresh meldet die fehlende Redis-Env',
          alarme.length === 1 && alarme[0].source === 'whop-refresh' && alarme[0].event === 'redis-fehlt');
    check('3b und antwortet 503 refresh_unavailable',
          res.code === 503 && res.body && res.body.error === 'refresh_unavailable');

    // ── 4: whop-token/rate-limit-inaktiv ─────────────────────────────────────
    // Hier ist es KEIN Totalausfall: der Login laeuft weiter, nur ohne IP-Deckel.
    handler = freshHandler('whop-token.js');
    res = mkRes();
    await handler(mkReq({ body: {} }), res);
    check('4a whop-token meldet den inaktiven IP-Deckel',
          alarme.length === 1 && alarme[0].source === 'whop-token' &&
          alarme[0].event === 'rate-limit-inaktiv');
    check('4b und der Handler laeuft weiter statt abzubrechen',
          res.code === 400);

    // ── 5: whop-access/rate-limit-inaktiv ────────────────────────────────────
    // Merkposten aus der Anleitung: whop-access sendet NIE 'rate-limit-open',
    // sondern 'ip-rate-limit-open' — ein Make-Filter auf den falschen Namen
    // verpasst die Haelfte. Dieser Test haelt die Schreibweise fest.
    // Achtung: whop-access erwartet den Token im BODY (`req.body.token`), waehrend
    // sync ihn aus dem Authorization-Header liest. Wer hier den Header setzt, landet
    // bei 400 und sieht den Alarmzweig nie.
    handler = freshHandler('whop-access.js');
    res = mkRes();
    await handler(mkReq({ body: { token: 'testtoken' } }), res);
    check('5a whop-access meldet den inaktiven IP-Deckel',
          alarme.some(function (a) {
              return a.source === 'whop-access' && a.event === 'rate-limit-inaktiv';
          }));
    check('5b und nennt es NICHT rate-limit-open',
          !alarme.some(function (a) { return a.event === 'rate-limit-open'; }));

    // ── 6: blob-cleanup/cron-secret-missing ──────────────────────────────────
    // An diesem Endpunkt haengt kein Mensch: faellt er aus, beschwert sich niemand.
    handler = freshHandler('blob-cleanup.js');
    res = mkRes();
    await handler(mkReq({ method: 'GET', headers: {} }), res);
    check('6a blob-cleanup meldet fehlendes CRON_SECRET',
          alarme.length === 1 && alarme[0].source === 'blob-cleanup' &&
          alarme[0].event === 'cron-secret-missing');
    check('6b und antwortet 500 cron_secret_not_configured',
          res.code === 500 && res.body && res.body.error === 'cron_secret_not_configured');

    // ── 7: jede Meldung traegt einen Text ────────────────────────────────────
    // 'detail' landet in der Mail; ein leeres Feld waere eine Meldung ohne Inhalt.
    handler = freshHandler('sync.js');
    await handler(mkReq({ method: 'POST' }), mkRes());
    check('7 detail ist gefuellt und nennt die Ursache',
          typeof alarme[0].detail === 'string' && alarme[0].detail.length > 10);

    console.error = realError;
    console.log('\n' + pass + '/' + total + ' Checks bestanden');
    process.exit(pass === total ? 0 : 1);
})();
