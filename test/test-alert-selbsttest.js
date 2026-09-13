// Selbsttest der Alarmkette:  node test/test-alert-selbsttest.js
//
// Hintergrund (plan/offen-alert-webhook.md, 2026-09-13): Von der Kette
// Code → ALERT_WEBHOOK_URL → Make.com → Mail war alles belegt AUSSER dem ersten
// Glied — dass Vercels Umgebungsvariable zur Laufzeit wirklich bei api/_alert.js
// ankommt. Der dokumentierte Weg dorthin war, auf Preview die Redis-Env zu
// verbiegen und zweimal zu deployen. '?probe=1' an api/blob-cleanup.js ersetzt das
// durch einen curl.
//
// Geprüft wird hier, dass dieser Modus die Auth NICHT aufweicht und den Löschlauf
// NICHT anfasst — er hängt an einem Endpunkt, der Blobs löschen kann:
//   1) ohne CRON_SECRET       -> 500, wie bisher, kein Selbsttest
//   2) falsches Bearer-Token  -> 401, und KEIN Alarm (sonst könnte jeder Fremdaufruf
//                                Meldungen auslösen — dieselbe Überlegung wie beim Cron)
//   3) richtiges Token + probe -> 200, ein Alarm, aber list/del bleiben unberührt
//   4) richtiges Token ohne probe -> der normale Aufräumlauf, unverändert
//   5) die Antwort verrät, was der laufende Prozess sieht — ohne die URL preiszugeben
'use strict';
const assert = require('assert');
const path = require('path');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name); }
}

// Attrappe für '@vercel/blob': zählt list/del mit, damit belegbar ist, dass der
// Selbsttest den Aufräumlauf nicht auslöst. require-Cache vorab besetzen.
const BLOBMOD = require.resolve('@vercel/blob');
let listCalls = [], delCalls = [];
require.cache[BLOBMOD] = {
    id: BLOBMOD, filename: BLOBMOD, loaded: true, exports: {
        list: function (opts) { listCalls.push(opts); return Promise.resolve({ blobs: [], hasMore: false }); },
        del:  function (urls) { delCalls.push(urls);  return Promise.resolve(); },
        put:  function ()     { return Promise.resolve({ url: 'https://blob.example/x' }); }
    }
};

const ALERTMOD   = path.join(__dirname, '..', 'api', '_alert.js');
const CLEANUPMOD = path.join(__dirname, '..', 'api', 'blob-cleanup.js');

// fetch-Attrappe — der Webhook aus _alert.js darf im Test nicht wirklich hinausgehen.
let fetchCalls = [];
global.fetch = function (url, opts) {
    fetchCalls.push({ url: url, body: JSON.parse(opts.body) });
    return Promise.resolve({ ok: true, status: 200 });
};

// Beide Module frisch laden: _alert.js liest seine Env beim Laden, und die
// Entprellung liegt im Modul-Scope.
function freshHandler(env) {
    delete require.cache[require.resolve(ALERTMOD)];
    delete require.cache[require.resolve(CLEANUPMOD)];
    ['CRON_SECRET', 'ALERT_WEBHOOK_URL', 'BLOB_READ_WRITE_TOKEN', 'VERCEL_ENV'].forEach(function (k) {
        if (env[k]) process.env[k] = env[k]; else delete process.env[k];
    });
    listCalls = []; delCalls = []; fetchCalls = [];
    return require(CLEANUPMOD);
}

// Minimale req/res-Attrappen im Zuschnitt der Vercel-Node-Runtime.
function mkReq(url, auth) {
    var q = {};
    var frage = url.indexOf('?');
    if (frage !== -1) url.slice(frage + 1).split('&').forEach(function (p) {
        var kv = p.split('='); q[kv[0]] = kv[1];
    });
    return { url: url, query: q, headers: auth ? { authorization: auth } : {} };
}
function mkRes() {
    var r = { code: 0, body: null };
    r.status = function (c) { r.code = c; return r; };
    r.json   = function (b) { r.body = b; return r; };
    return r;
}

const SECRET = 'geheim-nur-im-test';
const AUTH   = 'Bearer ' + SECRET;

// console.error stummschalten — alertOps loggt bewusst immer.
const realError = console.error;
console.error = function () {};

(async function run() {
    // ── 1: ohne CRON_SECRET bleibt alles wie bisher ───────────────────────────
    let handler = freshHandler({ ALERT_WEBHOOK_URL: 'https://hook.example/t' });
    let res = mkRes();
    await handler(mkReq('/api/blob-cleanup?probe=1', AUTH), res);
    check('1a ohne CRON_SECRET weiterhin 500', res.code === 500);
    check('1b und kein Selbsttest in der Antwort', !res.body.probe);

    // ── 2: falsches Bearer -> 401, und keine Meldung ──────────────────────────
    handler = freshHandler({ CRON_SECRET: SECRET, ALERT_WEBHOOK_URL: 'https://hook.example/t' });
    res = mkRes();
    await handler(mkReq('/api/blob-cleanup?probe=1', 'Bearer falsch'), res);
    check('2a falsches Token -> 401', res.code === 401);
    check('2b Fremdaufruf loest KEINEN Alarm aus', fetchCalls.length === 0);
    res = mkRes();
    await handler(mkReq('/api/blob-cleanup?probe=1', null), res);
    check('2c ganz ohne Authorization -> 401', res.code === 401);
    check('2d und auch dabei kein Alarm', fetchCalls.length === 0);

    // ── 3: echter Selbsttest ──────────────────────────────────────────────────
    handler = freshHandler({ CRON_SECRET: SECRET, ALERT_WEBHOOK_URL: 'https://hook.example/t',
                             BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_TEST', VERCEL_ENV: 'production' });
    res = mkRes();
    await handler(mkReq('/api/blob-cleanup?probe=1', AUTH), res);
    check('3a Selbsttest antwortet 200',            res.code === 200);
    check('3b als Selbsttest gekennzeichnet',       res.body.probe === true);
    check('3c genau eine Meldung ging raus',        fetchCalls.length === 1);
    check('3d unter eigenem source:event-Paar',     fetchCalls[0].body.source === 'selbsttest' &&
                                                    fetchCalls[0].body.event  === 'webhook-probe');
    check('3e gemeldet: true beim ersten Aufruf',   res.body.gemeldet === true);
    // Der Punkt der ganzen Uebung: der Selbsttest darf NICHT aufraeumen.
    check('3f kein list() — Aufraeumlauf unberuehrt', listCalls.length === 0);
    check('3g kein del()  — nichts geloescht',        delCalls.length === 0);

    // ── 4: Entprellung gilt auch hier ─────────────────────────────────────────
    res = mkRes();
    await handler(mkReq('/api/blob-cleanup?probe=1', AUTH), res);
    check('4a zweiter Aufruf meldet gemeldet: false', res.body.gemeldet === false);
    check('4b und schickt wirklich nichts erneut',    fetchCalls.length === 1);

    // ── 5: die Auskunft ueber die Ziele ───────────────────────────────────────
    check('5a webhook: true, weil ALERT_WEBHOOK_URL gesetzt', res.body.webhook === true);
    check('5b blob: true, weil BLOB_READ_WRITE_TOKEN gesetzt', res.body.blob === true);
    check('5c env wird durchgereicht',                         res.body.env === 'production');
    check('5d die URL selbst steht NICHT in der Antwort',
          JSON.stringify(res.body).indexOf('hook.example') === -1);

    // Genau der Fall, den der Selbsttest aufdecken soll: deployt, aber Variable fehlt.
    handler = freshHandler({ CRON_SECRET: SECRET, BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_TEST' });
    res = mkRes();
    await handler(mkReq('/api/blob-cleanup?probe=1', AUTH), res);
    check('5e fehlende ALERT_WEBHOOK_URL zeigt sich als webhook: false', res.body.webhook === false);
    check('5f dabei kein Netzverkehr',                                   fetchCalls.length === 0);

    // ── 6: ohne probe laeuft der Cron unveraendert ────────────────────────────
    handler = freshHandler({ CRON_SECRET: SECRET, BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_TEST' });
    res = mkRes();
    await handler(mkReq('/api/blob-cleanup', AUTH), res);
    check('6a normaler Lauf antwortet 200',        res.code === 200);
    check('6b ohne probe-Kennzeichnung',           res.body.probe === undefined);
    check('6c beide Praefixe werden durchgesehen', listCalls.length === 2);
    check('6d Antwortfelder unveraendert',         res.body.deleted === 0 && res.body.alertsDeleted === 0);
    // Ein probe=0 oder probe=irgendwas ist KEIN Selbsttest — nur die exakte 1.
    res = mkRes();
    await handler(mkReq('/api/blob-cleanup?probe=0', AUTH), res);
    check('6e probe=0 loest keinen Selbsttest aus', res.body.probe === undefined);

    console.error = realError;
    console.log('\n' + pass + '/' + total + ' Checks bestanden');
    process.exit(pass === total ? 0 : 1);
})();
