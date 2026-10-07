// Speicherfristen in Supabase:  node test/test-aufraeumen.js
//
// Hintergrund (plan/rechtstexte-supabase-entwurf.md, F6): Die Datenschutzerklärung sagt,
// IP-Zähler würden kurzzeitig gespeichert. In Supabase räumten die ersten Migrationen nur
// zufällig auf (1 %), eine IP konnte so tagelang in rate_limits stehen.
// Geprüft wird ohne Datenbank:
//   1) Migration 20261007000002: sync_rate_hit räumt bei jedem Aufruf, kein random() mehr
//   2) sync_aufraeumen ist nur für service_role ausführbar
//   3) api/blob-cleanup.js ruft sync_aufraeumen täglich — aber nur, wenn Supabase primär ist
//   4) ein Fehler dabei kippt weder Aufräumlauf noch Antwort, sondern wird gemeldet
// Das SQL selbst wurde am 2026-10-07 gegen PGlite gefahren; vor dem Umschalten in
// stackr-preview noch einmal gegen echtes Supabase prüfen.
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

// ── 1/2: Migration ────────────────────────────────────────────────────────────
const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261007000002_aufraeumen.sql'), 'utf8');
const rateHit = /create or replace function sync_rate_hit\([\s\S]*?end \$\$;/.exec(sql);
check('1a sync_rate_hit wird neu definiert', !!rateHit);
check('1b sync_rate_hit löscht abgelaufene Zähler bei jedem Aufruf',
      !!rateHit && /delete from rate_limits[\s\S]*reset_at <= now\(\)/.test(rateHit[0]) && !/random\(\)/.test(rateHit[0]));
check('1c sync_rate_hit wartet nicht auf gesperrte Zeilen', !!rateHit && /for update skip locked/.test(rateHit[0]));
check('2a sync_aufraeumen() existiert ohne Parameter', /create or replace function sync_aufraeumen\(\)/.test(sql));
check('2b anon/authenticated haben keine Rechte',
      /revoke all on function sync_aufraeumen\(\) from public, anon, authenticated/.test(sql) &&
      /grant execute on function sync_aufraeumen\(\) to service_role/.test(sql));
check('2c Fristen: Zähler bei Ablauf, Fehler nach 30 Tagen',
      /delete from rate_limits\s+where reset_at\s+<= now\(\)/.test(sql) &&
      /delete from client_error_counts where day\s+<= current_date - 30/.test(sql) &&
      /delete from client_error_types\s+where first_day <= current_date - 30/.test(sql));

// ── 3/4: api/blob-cleanup.js ──────────────────────────────────────────────────
const BLOBMOD = require.resolve('@vercel/blob');
require.cache[BLOBMOD] = {
    id: BLOBMOD, filename: BLOBMOD, loaded: true, exports: {
        list: () => Promise.resolve({ blobs: [], hasMore: false }),
        del:  () => Promise.resolve(),
        put:  () => Promise.resolve({ url: 'https://blob.example/x' })
    }
};

let rpcs = [], alarme = [], rpcFehler = false;
global.fetch = function (url, opts) {
    const u = String(url);
    if (u.includes('/rest/v1/rpc/')) {
        const name = u.split('/rpc/')[1];
        rpcs.push(name);
        if (name === 'sync_aufraeumen' && rpcFehler) return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve('') });
        const body = name === 'sync_aufraeumen' ? '{"rate_limits":3,"clerr_counts":0,"clerr_types":0}'
                   : name === 'sync_clerr_summary' ? '{"counts":{},"neu":[],"entries":{}}' : '';
        return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(body) });
    }
    if (u.includes('hook.example')) { try { alarme.push(JSON.parse(opts.body)); } catch (e) {} }
    if (u.includes('/storage/v1/')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('[]') });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: null }), text: () => Promise.resolve('') });
};

const MODS = ['api/blob-cleanup.js', 'api/_alert.js', 'api/_sync-store.js', 'api/_db.js',
              'api/_client-errors.js', 'api/_storage.js'];
const ENVS = ['STORAGE_BACKEND', 'STORAGE_MIRROR', 'BLOB_BACKEND', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
              'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN',
              'CRON_SECRET', 'ALERT_WEBHOOK_URL', 'BLOB_READ_WRITE_TOKEN'];
function load(env) {
    for (const k of ENVS) delete process.env[k];
    Object.assign(process.env, { CRON_SECRET: 's', ALERT_WEBHOOK_URL: 'https://hook.example/a',
                                 KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 't' }, env);
    for (const f of MODS) delete require.cache[path.join(ROOT, f)];
    rpcs = []; alarme = [];
    return require(path.join(ROOT, 'api/blob-cleanup.js'));
}
function mkRes() {
    const r = { code: 0, body: null };
    r.status = (c) => { r.code = c; return r; };
    r.json   = (b) => { r.body = b; return r; };
    return r;
}
const req = { url: '/api/blob-cleanup', query: {}, headers: { authorization: 'Bearer s' } };
const SB  = { STORAGE_BACKEND: 'supabase', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' };

console.error = function () {};
console.warn  = function () {};

(async function run() {
    let h = load({});
    let res = mkRes();
    await h(req, res);
    check('3a Redis primär: kein sync_aufraeumen', res.code === 200 && !rpcs.includes('sync_aufraeumen'));

    h = load({ STORAGE_MIRROR: 'supabase', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' });
    res = mkRes();
    await h(req, res);
    check('3b Supabase nur Spiegel: kein sync_aufraeumen (dort liegen keine Zähler)', res.code === 200 && !rpcs.includes('sync_aufraeumen'));

    h = load(SB);
    res = mkRes();
    await h(req, res);
    check('3c Supabase primär: sync_aufraeumen läuft einmal', res.code === 200 && rpcs.filter(n => n === 'sync_aufraeumen').length === 1);

    rpcFehler = true;
    h = load(SB);
    res = mkRes();
    await h(req, res);
    rpcFehler = false;
    check('4a Fehler beim Aufräumen: Lauf antwortet trotzdem 200', res.code === 200);
    check('4b … und meldet aufraeumen-failed', alarme.some(a => JSON.stringify(a).includes('aufraeumen-failed')));

    console.log('\n' + pass + '/' + total + ' bestanden');
    process.exit(pass === total ? 0 : 1);
})().catch(e => { console.log('✗ Abbruch: ' + (e && e.stack)); process.exit(1); });
