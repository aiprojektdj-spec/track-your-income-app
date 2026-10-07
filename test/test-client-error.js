// Browser-Fehler an den Server:  node test/test-client-error.js
//
// plan/betrieb-luecken-2026-09-29.md §4. Geprüft wird:
//   api/_client-errors.js / api/client-error.js
//     1) Feld-Whitelist: unbekannte Felder (stack, url, ua, userId) fallen weg
//     2) E-Mail und Ziffernfolgen (Beträge, IBAN) in der Meldung ersetzt; Quelle nur Pfad
//     3) Body > 4 KB -> 413 (per Content-Length und per tatsächlicher Größe)
//     4) Rate-Limit: 11. Meldung derselben IP in der Minute -> 429
//     5) fremder oder fehlender Origin -> 403; GET -> 405
//     6) Redis wirft -> trotzdem 204; ohne Redis-Env -> 204 ohne Netzverkehr
//     7) gleicher Fehler zweimal = ein Typ, Zähler 2; alle Schlüssel mit TTL
//     8) Tagesdeckel: darüber wird still verworfen
//   Tageszusammenfassung (api/blob-cleanup.js)
//     9) neuer Typ gestern -> eine Meldung über alertOps; kein neuer Typ -> keine
//    10) Redis-Fehler in der Zusammenfassung kippt weder Lauf noch Heartbeat
//   Supabase (STORAGE_BACKEND=supabase, supabase/migrations/20261007000001_client_errors.sql)
//    11) rpc-Namen und Parameter passen zur Migration
//    12) Annahme, Deckel und Zusammenfassung laufen über Supabase, Redis bleibt unberührt
//   Das SQL selbst lief am 2026-10-07 gegen Postgres 16 (neu/bekannt, 30-Tage-Verfall, Rechte).
//   Die Client-Seite (js/error-logger.js) prüft test/test-error-logger-beacon.js.
'use strict';
const path = require('path');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name); }
}

// ── Redis-Attrappe (nur die benutzten Kommandos) ─────────────────────────────
let store = {}, ttl = {}, redisFail = false, fetchCalls = [];
function redisExec(cmd) {
    const op = cmd[0], k = cmd[1];
    switch (op) {
        case 'INCR':    store[k] = (parseInt(store[k], 10) || 0) + 1; return store[k];
        case 'EXPIRE':  if (!(k in ttl)) ttl[k] = +cmd[2]; return 1;
        case 'HINCRBY': store[k] = store[k] || {}; store[k][cmd[2]] = (store[k][cmd[2]] || 0) + (+cmd[3]); return store[k][cmd[2]];
        case 'SET':     if (cmd.indexOf('NX') !== -1 && k in store) return null;
                        store[k] = cmd[2]; const i = cmd.indexOf('EX'); if (i !== -1) ttl[k] = +cmd[i + 1]; return 'OK';
        case 'SADD':    store[k] = store[k] || []; if (store[k].indexOf(cmd[2]) === -1) store[k].push(cmd[2]); return 1;
        case 'HGETALL': return store[k] ? [].concat.apply([], Object.keys(store[k]).map(function (f) { return [f, String(store[k][f])]; })) : [];
        case 'SMEMBERS':return store[k] || [];
        case 'GET':     return k in store ? store[k] : null;
    }
    throw new Error('unbekannt ' + op);
}
// ── Supabase-Attrappe: rpc-Funktionen der Migration im Speicher ──────────────
let sb = {}, sbFail = false;
function sbExec(name, a) {
    if (name === 'sync_rate_hit') { sb.rl = sb.rl || {}; sb.rl[a.p_key] = (sb.rl[a.p_key] || 0) + 1; return sb.rl[a.p_key]; }
    if (name === 'sync_clerr_store') {
        sb.counts = sb.counts || {}; sb.types = sb.types || {};
        const k = a.p_day + '|' + a.p_hash; sb.counts[k] = (sb.counts[k] || 0) + 1;
        if (sb.types[a.p_hash]) return false;
        sb.types[a.p_hash] = { entry: a.p_entry, first_day: a.p_day }; return true;
    }
    if (name === 'sync_clerr_summary') {
        const r = { counts: {}, neu: [], entries: {} };
        Object.keys(sb.counts || {}).forEach(function (k) { const t = k.split('|'); if (t[0] === a.p_day) r.counts[t[1]] = sb.counts[k]; });
        Object.keys(sb.types || {}).forEach(function (h) { if (sb.types[h].first_day === a.p_day) { r.neu.push(h); r.entries[h] = sb.types[h].entry; } });
        return r;
    }
    // Täglicher Fristen-Lauf aus api/blob-cleanup.js (test/test-aufraeumen.js prüft ihn)
    if (name === 'sync_aufraeumen') return { rate_limits: 0, clerr_counts: 0, clerr_types: 0 };
    throw new Error('unbekannte rpc ' + name);
}
global.fetch = function (url, opts) {
    fetchCalls.push({ url: url, opts: opts || {} });
    if (url.indexOf('https://sb.example/rest/v1/rpc/') === 0) {
        if (sbFail) return Promise.resolve({ ok: false, status: 503, text: function () { return Promise.resolve(''); } });
        const r = sbExec(url.split('/').pop(), JSON.parse(opts.body));
        return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(JSON.stringify(r)); } });
    }
    if (url === 'https://redis.example') {
        if (redisFail) return Promise.reject(new Error('ECONNREFUSED'));
        const r = redisExec(JSON.parse(opts.body));
        return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ result: r }); } });
    }
    return Promise.resolve({ ok: true, status: 200 });
};

const BLOBMOD = require.resolve('@vercel/blob');
require.cache[BLOBMOD] = { id: BLOBMOD, filename: BLOBMOD, loaded: true, exports: {
    list: function () { return Promise.resolve({ blobs: [], hasMore: false }); },
    del:  function () { return Promise.resolve(); },
    put:  function () { return Promise.resolve({ url: 'x' }); }
} };

const API = path.join(__dirname, '..', 'api');
const MODS = ['client-error.js', '_client-errors.js', '_alert.js', '_log.js', 'blob-cleanup.js', '_sync-store.js', '_db.js'].map(function (f) { return path.join(API, f); });
const ENV_KEYS = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
                  'CRON_SECRET', 'ALERT_WEBHOOK_URL', 'BLOB_READ_WRITE_TOKEN', 'HEARTBEAT_URL_BLOB_CLEANUP',
                  'STORAGE_BACKEND', 'STORAGE_MIRROR', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const REDIS = { KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'tok' };
function fresh(file, env) {
    MODS.forEach(function (m) { delete require.cache[m]; });
    ENV_KEYS.forEach(function (k) { if (env[k]) process.env[k] = env[k]; else delete process.env[k]; });
    store = {}; ttl = {}; redisFail = false; fetchCalls = []; sb = {}; sbFail = false;
    return require(path.join(API, file));
}
function mkReq(body, opt) {
    opt = opt || {};
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    const h = { host: 'stackr.example', origin: 'https://stackr.example', 'x-vercel-forwarded-for': opt.ip || '1.2.3.4',
                'content-length': String(Buffer.byteLength(text)) };
    if (opt.origin !== undefined) { if (opt.origin) h.origin = opt.origin; else delete h.origin; }
    if (opt.cl) h['content-length'] = opt.cl;
    return { method: opt.method || 'POST', headers: h, body: text };
}
function mkRes() {
    const r = { code: 0, body: null, headers: {} };
    r.status = function (c) { r.code = c; return r; };
    r.json   = function (b) { r.body = b; return r; };
    r.end    = function () { return r; };
    r.setHeader = function (k, v) { r.headers[k] = v; };
    return r;
}
function metas() { return Object.keys(store).filter(function (k) { return k.indexOf('clerr:m:') === 0; }).map(function (k) { return JSON.parse(store[k]); }); }

const realError = console.error, realWarn = console.warn;
console.error = function () {}; console.warn = function () {};

(async function () {
    const FEHLER = {
        type: 'js', message: "Cannot read 'x' of kunde@example.com, Betrag 1.234,56 IBAN DE89 3704 0044 0532 0130 00",
        source: 'https://stackr.example/js/app.js?v=1.7.3&token=abc#frag', line: 42, col: 7, v: '1.7.3',
        stack: 'at geheim (app.js:1)', url: '/app.html?kunde=Mueller', ua: 'Mozilla', userId: 'user_123'
    };

    // 1/2 Whitelist + Bereinigung
    let h = fresh('client-error.js', REDIS), res = mkRes();
    await h(mkReq(FEHLER), res);
    let m = metas();
    check('1) 204 und genau ein gespeicherter Typ', res.code === 204 && m.length === 1);
    check('1) nur type/message/source/line/col/v/ts', m[0] && Object.keys(m[0]).sort().join(',') === 'col,line,message,source,ts,type,v');
    check('2) E-Mail ersetzt', m[0] && m[0].message.indexOf('@') === -1 && m[0].message.indexOf('<email>') !== -1);
    check('2) Betrag und IBAN-Ziffern ersetzt', m[0] && !/\d{4}/.test(m[0].message) && m[0].message.indexOf('1.234') === -1);
    check('2) Quelle nur Pfad, ohne Query/Host', m[0] && m[0].source === '/js/app.js');
    check('   leere Quelle bleibt leer', fresh('_client-errors.js', {}).sanitize({ source: '' }, Date.now()).source === '');
    check('   unbekannte Art -> js, Unsinn-Zeile -> 0', (function () {
        const s = require(path.join(API, '_client-errors.js')).sanitize({ type: '<script>', line: -5, v: 'a b' }, 0);
        return s.type === 'js' && s.line === 0 && s.v === '';
    })());

    // 3) Größe
    h = fresh('client-error.js', REDIS); res = mkRes();
    await h(mkReq(FEHLER, { cl: '5000' }), res);
    check('3) Content-Length > 4 KB -> 413', res.code === 413 && fetchCalls.length === 0);
    h = fresh('client-error.js', REDIS); res = mkRes();
    const gross = mkReq({ message: 'x'.repeat(5000) }); gross.headers['content-length'] = '10';
    await h(gross, res);
    check('3) tatsächlicher Body > 4 KB -> 413', res.code === 413);

    // 4) Rate-Limit
    h = fresh('client-error.js', REDIS);
    const codes = [];
    for (let i = 0; i < 11; i++) { res = mkRes(); await h(mkReq(Object.assign({}, FEHLER, { line: i })), res); codes.push(res.code); }
    check('4) 10x 204, 11. -> 429', codes.slice(0, 10).every(function (c) { return c === 204; }) && codes[10] === 429);
    res = mkRes(); await h(mkReq(FEHLER, { ip: '9.9.9.9' }), res);
    check('4) andere IP unbeeinflusst', res.code === 204);
    check('4) Rate-Limit-Schlüssel mit 60 s TTL', ttl['clerr:iprl:1.2.3.4'] === 60);

    // 5) Origin / Methode
    h = fresh('client-error.js', REDIS);
    res = mkRes(); await h(mkReq(FEHLER, { origin: 'https://boese.example' }), res);
    const fremd = res.code;
    res = mkRes(); await h(mkReq(FEHLER, { origin: '' }), res);
    check('5) fremder Origin 403, fehlender 403', fremd === 403 && res.code === 403 && fetchCalls.length === 0);
    res = mkRes(); await h(mkReq(FEHLER, { method: 'GET' }), res);
    check('5) GET -> 405', res.code === 405);
    res = mkRes(); await h(mkReq('{kaputt'), res);
    check('   kaputtes JSON -> 400', res.code === 400);

    // 6) Redis weg
    h = fresh('client-error.js', REDIS); redisFail = true; res = mkRes();
    await h(mkReq(FEHLER), res);
    check('6) Redis wirft -> 204', res.code === 204);
    h = fresh('client-error.js', {}); res = mkRes();
    await h(mkReq(FEHLER), res);
    check('6) ohne Redis-Env -> 204 ohne Netzverkehr', res.code === 204 && fetchCalls.length === 0);

    // 7) Zählen + TTL
    h = fresh('client-error.js', REDIS);
    await h(mkReq(FEHLER), mkRes());
    await h(mkReq(Object.assign({}, FEHLER, { col: 99, v: '1.7.4' })), mkRes());
    const heute = new Date().toISOString().slice(0, 10);
    const zaehler = store['clerr:d:' + heute] || {};
    check('7) gleicher Fehler (andere Spalte/Version) = ein Typ, Zähler 2',
          Object.keys(zaehler).length === 1 && zaehler[Object.keys(zaehler)[0]] === 2 && metas().length === 1);
    check('7) Typ als neu vermerkt', (store['clerr:new:' + heute] || []).length === 1);
    const ohneTtl = Object.keys(store).filter(function (k) { return !(k in ttl); });
    check('7) jeder Schlüssel hat eine TTL' + (ohneTtl.length ? ' (' + ohneTtl.join(', ') + ')' : ''), ohneTtl.length === 0);
    check('7) Daten verfallen nach 30 Tagen', ttl['clerr:d:' + heute] === 30 * 86400);

    // 8) Tagesdeckel
    h = fresh('client-error.js', REDIS);
    store['clerr:total:' + heute] = 5000;
    res = mkRes(); await h(mkReq(FEHLER), res);
    check('8) über dem Tagesdeckel: 204, nichts gespeichert', res.code === 204 && metas().length === 0);

    // 9/10) Tageszusammenfassung im Cron
    const AUTH = { method: 'GET', url: '/api/blob-cleanup', query: {}, headers: { authorization: 'Bearer s' } };
    const gestern = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const ENV = Object.assign({ CRON_SECRET: 's', ALERT_WEBHOOK_URL: 'https://hook.example', HEARTBEAT_URL_BLOB_CLEANUP: 'https://hc.example' }, REDIS);

    let c = fresh('blob-cleanup.js', ENV);
    const ce = require(path.join(API, '_client-errors.js'));
    const e1 = ce.sanitize({ message: 'x is undefined', source: '/js/app.js', line: 3 }, 0);
    const hsh = ce.typHash(e1);
    store['clerr:d:' + gestern] = {}; store['clerr:d:' + gestern][hsh] = 7; store['clerr:d:' + gestern]['alt'] = 2;
    store['clerr:new:' + gestern] = [hsh];
    store['clerr:m:' + hsh] = JSON.stringify(e1);
    res = mkRes(); await c(AUTH, res);
    const hook = fetchCalls.filter(function (f) { return f.url === 'https://hook.example'; });
    let text = hook.length ? JSON.parse(hook[0].opts.body).detail : '';
    check('9) neuer Typ gestern -> genau eine Meldung', res.code === 200 && hook.length === 1);
    check('9) Meldung nennt Zahlen und Fehler', /1 neue Fehlertypen, 2 Typen gesamt, 9 Vorkommen/.test(text) &&
          text.indexOf('7x x is undefined (/js/app.js:3)') !== -1);
    check('9) Heartbeat danach trotzdem', fetchCalls.some(function (f) { return f.url === 'https://hc.example'; }));

    c = fresh('blob-cleanup.js', ENV);
    store['clerr:d:' + gestern] = { alt: 5 };
    res = mkRes(); await c(AUTH, res);
    check('9) nur bekannte Typen -> keine Meldung', res.code === 200 &&
          !fetchCalls.some(function (f) { return f.url === 'https://hook.example'; }));

    c = fresh('blob-cleanup.js', ENV); redisFail = true;
    res = mkRes(); await c(AUTH, res);
    check('10) Redis-Fehler: Lauf 200 und Heartbeat', res.code === 200 &&
          fetchCalls.some(function (f) { return f.url === 'https://hc.example'; }));

    // 11) rpc ↔ Migration
    const fs = require('fs');
    const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261007000001_client_errors.sql'), 'utf8')
              + fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261006000001_sync.sql'), 'utf8');
    const fns = {};
    for (const mm of sql.matchAll(/create or replace function (\w+)\(([^)]*)\)/g)) {
        fns[mm[1]] = mm[2].split(',').map(function (x) { return x.trim().split(/\s+/)[0]; }).filter(Boolean).sort().join(',');
    }
    const src = fs.readFileSync(path.join(API, '_client-errors.js'), 'utf8');
    const calls = [...src.matchAll(/db\.rpc\('(\w+)',\s*\{([^}]*)\}/g)];
    check('11) zwei rpc-Aufrufe, Namen und Parameter passen zur Migration', calls.length === 2 && calls.every(function (c) {
        return fns[c[1]] === c[2].split(',').map(function (x) { return x.split(':')[0].trim(); }).filter(Boolean).sort().join(',');
    }));
    check('11) Migration nimmt anon/authenticated die Rechte', /revoke all on function sync_clerr_store\(date, text, jsonb\) from public, anon, authenticated/.test(sql) &&
          /revoke all on function sync_clerr_summary\(date\)\s+from public, anon, authenticated/.test(sql));

    // 12) Supabase als Backend
    const SBENV = Object.assign({ STORAGE_BACKEND: 'supabase', SUPABASE_URL: 'https://sb.example', SUPABASE_SERVICE_ROLE_KEY: 'svc' }, REDIS);
    h = fresh('client-error.js', SBENV);
    await h(mkReq(FEHLER), mkRes());
    res = mkRes(); await h(mkReq(Object.assign({}, FEHLER, { col: 99 })), res);
    const sbTypen = Object.keys(sb.types || {});
    check('12) Supabase: 204, ein Typ, Zähler 2', res.code === 204 && sbTypen.length === 1 &&
          sb.counts[heute + '|' + sbTypen[0]] === 2);
    check('12) Supabase: Eintrag bereinigt', sbTypen.length === 1 && sb.types[sbTypen[0]].entry.source === '/js/app.js' &&
          sb.types[sbTypen[0]].entry.message.indexOf('@') === -1);
    check('12) Supabase: Deckel über sync_rate_hit, Redis unberührt',
          sb.rl['clerr:iprl:1.2.3.4'] === 2 && sb.rl['clerr:total:' + heute] === 2 &&
          !fetchCalls.some(function (f) { return f.url === 'https://redis.example'; }));
    for (let i = 0; i < 9; i++) await h(mkReq(Object.assign({}, FEHLER, { line: 100 + i })), mkRes());
    res = mkRes(); await h(mkReq(FEHLER), res);
    check('12) Supabase: 11. Meldung derselben IP -> 429', res.code === 429);

    h = fresh('client-error.js', SBENV); sbFail = true; res = mkRes();
    await h(mkReq(FEHLER), res);
    check('12) Supabase wirft -> trotzdem 204', res.code === 204);
    h = fresh('client-error.js', { STORAGE_BACKEND: 'supabase' }); res = mkRes();
    await h(mkReq(FEHLER), res);
    check('12) Supabase ohne Env -> 204 ohne Netzverkehr', res.code === 204 && fetchCalls.length === 0);

    c = fresh('blob-cleanup.js', Object.assign({}, ENV, SBENV));
    const e2 = ce.sanitize({ message: 'y is null', source: '/js/store.js', line: 9 }, 0);
    const h2 = ce.typHash(e2);
    sb.counts = {}; sb.counts[gestern + '|' + h2] = 4; sb.counts[gestern + '|alt'] = 1;
    sb.types = {}; sb.types[h2] = { entry: e2, first_day: gestern }; sb.types.alt = { entry: e1, first_day: '2026-01-01' };
    res = mkRes(); await c(AUTH, res);
    const hook2 = fetchCalls.filter(function (f) { return f.url === 'https://hook.example'; });
    text = hook2.length ? JSON.parse(hook2[0].opts.body).detail : '';
    check('12) Supabase: Zusammenfassung meldet neuen Typ', res.code === 200 && hook2.length === 1 &&
          /1 neue Fehlertypen, 2 Typen gesamt, 5 Vorkommen/.test(text) && text.indexOf('4x y is null (/js/store.js:9)') !== -1);

    console.error = realError; console.warn = realWarn;
    console.log('\n' + pass + '/' + total + ' bestanden');
    process.exit(pass === total ? 0 : 1);
})().catch(function (e) { console.error = realError; console.error(e); process.exit(1); });
