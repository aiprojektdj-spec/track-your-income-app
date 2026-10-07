// Whop-Refresh-Sitzungen folgen STORAGE_BACKEND/STORAGE_MIRROR:  node test/test-whop-sessions.js
//
// plan/supabase-umzug-2026-10-06.md Punkt 4. Getestet werden die echten Handler
// api/whop-token.js und api/whop-refresh.js (fake req/res), Speicher als Attrappe:
//   A) Default (Redis): exakt die bisherigen Befehle, Keys und TTLs, Supabase unberührt
//   B) STORAGE_BACKEND=supabase: Login → Refresh → Rotation → Widerruf über die rpc-Funktionen
//      der Migration 20261008000001_whop_sessions.sql, Redis unberührt
//   C) Sperre: zwei gleichzeitige Refreshs → genau EIN Whop-Aufruf, beide bekommen den Token
//   D) Ablauf: abgelaufene Sitzung → 401 session_expired, ohne Whop-Aufruf
//   E) Ausfall: Supabase down → nie 401 (der Client würde sonst die Sitzungs-ID löschen),
//      Sitzung bleibt; Login gelingt ohne Sitzung; fehlende Env → 'redis-fehlt' wie bisher
//   F) Spiegel: Dual-Write, Umschalten ohne Abmeldung, Spiegel-Ausfall bricht nichts ab
//   G) Verschlüsselung in Supabase (WHOP_SESSION_KEY): kein Klartext, falscher Schlüssel
//      oder umkopiertes Chiffrat → 503 statt 401, fehlender Schlüssel → nicht konfiguriert
//   H) Speicherfehler (Entscheidungen 2026-10-08): Sperrfehler → direkt erneuern;
//      Upstash { error } → 503 statt 401; Schreibfehler nach Rotation → Wiederholung,
//      sonst Token trotzdem ausgeben und melden
// Das SQL selbst lief am 2026-10-08 gegen Postgres 16 (Ablauf, Sperre unter 40 parallelen
// Verbindungen genau einmal vergeben, Aufräumen, anon/authenticated ohne Rechte).
'use strict';
const path = require('path');

let pass = 0, total = 0;
function check(name, cond, info) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name + (info ? ' — ' + info : '')); }
}

const ROOT = path.join(__dirname, '..');
const ALERTMOD = require.resolve(path.join(ROOT, 'api', '_alert.js'));
let alarme = [];
require.cache[ALERTMOD] = { id: ALERTMOD, filename: ALERTMOD, loaded: true, exports: {
    alertOps: async (source, event, detail) => { alarme.push({ source, event, detail }); return true; },
    alertZiele: () => ({ webhook: false, blob: false })
} };

// ── Redis-Attrappe mit TTL-Mitschrift ────────────────────────────────────────
let kv, kvTtl, redisLog, redisErr;
let redisExec = function (c) {
    redisLog.push(c);
    const op = c[0], k = c[1];
    if (redisErr.has(op)) return { error: 'ERR simuliert' };
    if (op === 'GET')  return kv.has(k) ? kv.get(k) : null;
    if (op === 'DEL')  return kv.delete(k) ? 1 : 0;
    if (op === 'INCR') { const v = (+kv.get(k) || 0) + 1; kv.set(k, String(v)); return v; }
    if (op === 'EXPIRE') return 1;
    if (op === 'SET') {
        if (c.indexOf('NX') !== -1 && kv.has(k)) return null;
        kv.set(k, c[2]);
        const i = c.indexOf('EX'); if (i !== -1) kvTtl.set(k, c[i + 1]);
        return 'OK';
    }
    throw new Error('unbekannter Redis-Befehl ' + op);
};
const redisExecOrig = redisExec;

// ── Supabase-Attrappe: Funktionen der Migration im Speicher ──────────────────
let sess, locks, rl, rpcLog, sbUp, sbFail;
function sbExec(name, a) {
    rpcLog.push({ name, args: a });
    const now = Date.now();
    switch (name) {
        case 'sync_rate_hit': rl.set(a.p_key, (rl.get(a.p_key) || 0) + 1); return rl.get(a.p_key);
        case 'sync_whop_session_get': { const s = sess.get(a.p_sid); return s && s.until > now ? s.data : null; }
        case 'sync_whop_session_put': sess.set(a.p_sid, { data: a.p_data, until: now + a.p_ttl * 1000 }); return null;
        case 'sync_whop_session_delete': sess.delete(a.p_sid); return null;
        case 'sync_whop_lock': { const l = locks.get(a.p_sid); if (l && l > now) return false; locks.set(a.p_sid, now + a.p_secs * 1000); return true; }
        case 'sync_whop_unlock': locks.delete(a.p_sid); return null;
    }
    throw new Error('unbekannte rpc ' + name);
}

let whopCalls, whopReply, whopDelay;
global.fetch = async (url, opts) => {
    const body = opts && opts.body ? JSON.parse(opts.body) : null;
    if (url === 'http://redis.mock') {
        const r = redisExec(body);
        return { ok: true, json: async () => (r && r.error ? r : { result: r }) };
    }
    if (url.indexOf('http://sb.mock/rest/v1/rpc/') === 0) {
        const name = url.split('/').pop();
        if (!sbUp || (sbFail[name] && sbFail[name]-- > 0)) { rpcLog.push({ name, args: body, failed: true }); return { ok: false, status: 503, text: async () => '' }; }
        const r = sbExec(url.split('/').pop(), body);
        return { ok: true, status: 200, text: async () => JSON.stringify(r) };
    }
    if (url === 'https://api.whop.com/oauth/token') {
        whopCalls.push(body);
        if (whopDelay) await new Promise((r) => setTimeout(r, whopDelay));
        const rep = typeof whopReply === 'function' ? whopReply(body) : whopReply;
        return { ok: rep.status < 300, status: rep.status, json: async () => rep.body || {} };
    }
    throw new Error('unerwarteter fetch: ' + url);
};

const ENV_KEYS = ['STORAGE_BACKEND', 'STORAGE_MIRROR', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
                  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN'];
const MODS = ['whop-token.js', 'whop-refresh.js', '_whop-sessions.js', '_sync-store.js', '_db.js'];
const REDIS = { UPSTASH_REDIS_REST_URL: 'http://redis.mock', UPSTASH_REDIS_REST_TOKEN: 'x' };
const crypto = require('crypto');
const KEY  = crypto.randomBytes(32);
const SBENV = { SUPABASE_URL: 'http://sb.mock/', SUPABASE_SERVICE_ROLE_KEY: 'svc', WHOP_SESSION_KEY: KEY.toString('base64') };
// Gegenstück zu seal/unseal in api/_whop-sessions.js, unabhängig nachgebaut
function sbRead(sid) {
    const b = sess.get(sid).data;
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(b.iv, 'base64'));
    d.setAAD(Buffer.from(sid)); d.setAuthTag(Buffer.from(b.tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(b.ct, 'base64')), d.final()]).toString());
}
function sbWrite(sid, entry) {
    const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    c.setAAD(Buffer.from(sid));
    const ct = Buffer.concat([c.update(JSON.stringify(entry)), c.final()]);
    sess.get(sid).data = { v: 1, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: c.getAuthTag().toString('base64') };
}

// Lädt beide Handler mit genau dieser Env. Speicherinhalte bleiben stehen (für Umschalt-Tests).
function load(env) {
    ENV_KEYS.concat(['WHOP_SESSION_KEY']).forEach((k) => { delete process.env[k]; });
    Object.assign(process.env, env, { WHOP_CLIENT_SECRET: 'geheim' });
    MODS.forEach((f) => { delete require.cache[path.join(ROOT, 'api', f)]; });
    alarme = []; redisLog = []; rpcLog = []; whopCalls = []; whopDelay = 0; sbUp = true; sbFail = {}; redisErr = new Set();
    return { token: require('../api/whop-token.js'), refresh: require('../api/whop-refresh.js') };
}
function reset() { kv = new Map(); kvTtl = new Map(); sess = new Map(); locks = new Map(); rl = new Map(); }

function mkRes() {
    const r = { code: 0, body: null };
    r.setHeader = () => r; r.status = (c) => { r.code = c; return r; };
    r.json = (b) => { r.body = b; return r; }; r.end = () => r;
    return r;
}
async function call(h, body) {
    const res = mkRes();
    await h({ method: 'POST', body, headers: { 'x-vercel-forwarded-for': '203.0.113.5' }, socket: {} }, res);
    return res;
}
const LOGIN = { status: 200, body: { access_token: 'AT0', refresh_token: 'RT0', expires_in: 3600 } };
function rotate(n) { return { status: 200, body: { access_token: 'AT' + n, refresh_token: 'RT' + n, expires_in: 3600 } }; }
function expire(map, sid) {   // Access-Token im Speicher als abgelaufen markieren
    if (map === kv) { const e = JSON.parse(kv.get('whoprt:' + sid)); e.exp = Date.now() - 1000; kv.set('whoprt:' + sid, JSON.stringify(e)); }
    else { const e = sbRead(sid); e.exp = Date.now() - 1000; sbWrite(sid, e); }
}

const origErr = console.error, origWarn = console.warn, origLog = console.log;
const quiet = () => { console.error = console.warn = () => {}; };
quiet();

(async () => {
    let h, r, sid;

    // ── A · Default Redis: exakt das bisherige Verhalten ─────────────────────
    reset(); h = load(REDIS); whopReply = LOGIN;
    r = await call(h.token, { code: 'c', code_verifier: 'v' });
    sid = r.body.session_id;
    check('A1 Login legt Sitzung unter whoprt:<sid> an', r.code === 200 && /^[a-f0-9]{64}$/.test(sid) && kv.has('whoprt:' + sid));
    check('A2 TTL 30 Tage wie bisher', kvTtl.get('whoprt:' + sid) === '2592000');
    check('A3 Inhalt { rt, at, exp }', JSON.parse(kv.get('whoprt:' + sid)).rt === 'RT0');
    expire(kv, sid); redisLog = []; whopReply = rotate(1);
    r = await call(h.refresh, { session_id: sid });
    const erwartet = [
        ['INCR', 'whoprefresh:rl:203.0.113.5'], ['EXPIRE', 'whoprefresh:rl:203.0.113.5', '60', 'NX'],
        ['GET', 'whoprt:' + sid], ['SET', 'whoprt:lock:' + sid, '1', 'NX', 'EX', '10'],
        ['SET', 'whoprt:' + sid, '<json>', 'EX', '2592000'], ['DEL', 'whoprt:lock:' + sid]
    ];
    const gesehen = redisLog.map((c) => c[0] === 'SET' && c[1] === 'whoprt:' + sid ? c.slice(0, 2).concat(['<json>'], c.slice(3)) : c);
    check('A4 Rotation: exakt die bisherigen Redis-Befehle in Reihenfolge', JSON.stringify(gesehen) === JSON.stringify(erwartet), JSON.stringify(gesehen));
    check('A5 rotierter Refresh-Token gespeichert', r.body.access_token === 'AT1' && JSON.parse(kv.get('whoprt:' + sid)).rt === 'RT1');
    r = await call(h.refresh, { session_id: sid, revoke: true });
    check('A6 Widerruf löscht whoprt:<sid>', r.code === 200 && !kv.has('whoprt:' + sid));
    check('A7 Supabase im Default nie angefasst', rpcLog.length === 0);
    check('A8 kein Alarm im Normalbetrieb', alarme.length === 0, JSON.stringify(alarme));

    // ── B · STORAGE_BACKEND=supabase ─────────────────────────────────────────
    reset(); h = load(Object.assign({ STORAGE_BACKEND: 'supabase' }, REDIS, SBENV)); whopReply = LOGIN;
    r = await call(h.token, { code: 'c', code_verifier: 'v' });
    sid = r.body.session_id;
    const put = rpcLog.find((x) => x.name === 'sync_whop_session_put');
    check('B1 Login legt Sitzung per sync_whop_session_put an', r.code === 200 && !!sid && sess.has(sid));
    check('B2 Parameter passen zur Migration (p_sid, p_data, p_ttl=30 Tage)',
          put && put.args.p_sid === sid && put.args.p_ttl === 2592000 && sbRead(sid).rt === 'RT0' && sbRead(sid).at === 'AT0');
    check('B2b in Supabase kein Klartext, nur { v, iv, ct, tag }',
          !/RT0|AT0/.test(JSON.stringify(put.args.p_data)) && Object.keys(put.args.p_data).sort().join() === 'ct,iv,tag,v');
    r = await call(h.refresh, { session_id: sid });
    check('B3 gültiger Access-Token wird ohne Whop-Aufruf ausgegeben', r.code === 200 && r.body.access_token === 'AT0' && whopCalls.length === 1);
    expire(sess, sid); rpcLog = []; whopCalls = []; whopReply = rotate(1);
    r = await call(h.refresh, { session_id: sid });
    check('B4 Rotation über Supabase', r.code === 200 && r.body.access_token === 'AT1' && sbRead(sid).rt === 'RT1');
    check('B5 Whop bekam den gespeicherten Refresh-Token', whopCalls[0].refresh_token === 'RT0');
    check('B6 rpc-Folge: rate_hit, get, lock, put, unlock',
          rpcLog.map((x) => x.name).join(',') === 'sync_rate_hit,sync_whop_session_get,sync_whop_lock,sync_whop_session_put,sync_whop_unlock',
          rpcLog.map((x) => x.name).join(','));
    check('B7 Deckel-Key und Sperrdauer wie in Redis',
          rpcLog[0].args.p_key === 'whoprefresh:rl:203.0.113.5' && rpcLog[0].args.p_window === 60 && rpcLog[2].args.p_secs === 10);
    expire(sess, sid); whopReply = rotate(2); whopCalls = [];
    r = await call(h.refresh, { session_id: sid });
    check('B8 zweite Runde nutzt den rotierten Token (Kette lebt)', whopCalls[0].refresh_token === 'RT1' && sbRead(sid).rt === 'RT2');
    expire(sess, sid); whopReply = { status: 400, body: { error: 'invalid_grant' } };
    r = await call(h.refresh, { session_id: sid });
    check('B9 invalid_grant → 401 und Sitzung gelöscht', r.code === 401 && !sess.has(sid));
    reset(); whopReply = LOGIN; sid = (await call(h.token, { code: 'c', code_verifier: 'v' })).body.session_id;
    r = await call(h.refresh, { session_id: sid, revoke: true });
    check('B10 Widerruf löscht in Supabase', r.code === 200 && !sess.has(sid));
    check('B11 Redis bleibt mit STORAGE_BACKEND=supabase unberührt', kv.size === 0 && redisLog.length === 0);

    // ── C · Sperre ───────────────────────────────────────────────────────────
    reset(); h = load(Object.assign({ STORAGE_BACKEND: 'supabase' }, SBENV)); whopReply = LOGIN;
    sid = (await call(h.token, { code: 'c', code_verifier: 'v' })).body.session_id;
    expire(sess, sid); whopCalls = []; whopReply = rotate(1); whopDelay = 200;
    const [r1, r2] = await Promise.all([call(h.refresh, { session_id: sid }), call(h.refresh, { session_id: sid })]);
    check('C1 zwei gleichzeitige Refreshs → genau ein Whop-Aufruf', whopCalls.length === 1, 'Aufrufe: ' + whopCalls.length);
    check('C2 beide bekommen den neuen Token', r1.body.access_token === 'AT1' && r2.body.access_token === 'AT1', JSON.stringify([r1.body, r2.body]));
    check('C3 Sperre danach wieder frei', !locks.has(sid));
    expire(sess, sid); whopDelay = 0; whopCalls = []; locks.set(sid, Date.now() + 10000);
    r = await call(h.refresh, { session_id: sid });
    check('C4 fremde Sperre, kein frischer Token → 503 refresh_busy, nicht 401', r.code === 503 && r.body.error === 'refresh_busy' && whopCalls.length === 0);
    locks.set(sid, Date.now() - 1);
    whopReply = rotate(3);
    r = await call(h.refresh, { session_id: sid });
    check('C5 abgelaufene Sperre blockiert nicht', r.code === 200 && r.body.access_token === 'AT3');

    // ── D · Ablauf der Sitzung (TTL) ─────────────────────────────────────────
    sess.get(sid).until = Date.now() - 1; whopCalls = [];
    r = await call(h.refresh, { session_id: sid });
    check('D1 abgelaufene Sitzung → 401 session_expired', r.code === 401 && r.body.error === 'session_expired');
    check('D2 dabei kein Whop-Aufruf', whopCalls.length === 0);

    // ── E · Ausfall ──────────────────────────────────────────────────────────
    reset(); h = load(Object.assign({ STORAGE_BACKEND: 'supabase' }, SBENV)); whopReply = LOGIN;
    sid = (await call(h.token, { code: 'c', code_verifier: 'v' })).body.session_id;
    expire(sess, sid); sbUp = false; whopCalls = [];
    r = await call(h.refresh, { session_id: sid });
    check('E1 Supabase down → 503 refresh_unavailable, NICHT 401', r.code === 503 && r.body.error === 'refresh_unavailable');
    check('E2 Sitzung bleibt erhalten, kein Whop-Aufruf', sess.has(sid) && whopCalls.length === 0);
    check('E3 offener IP-Deckel gemeldet', alarme.some((a) => a.source === 'whop-refresh' && a.event === 'rate-limit-open'));
    alarme = [];
    r = await call(h.token, { code: 'c', code_verifier: 'v' });
    check('E4 Login gelingt trotzdem, nur ohne Sitzung', r.code === 200 && r.body.access_token === 'AT0' && r.body.session_id === null);
    check('E5 und meldet session-nicht-gespeichert', alarme.some((a) => a.source === 'whop-token' && a.event === 'session-nicht-gespeichert'));
    h = load({ STORAGE_BACKEND: 'supabase' });
    r = await call(h.refresh, { session_id: sid });
    check('E6 Supabase-Env fehlt → 503 und Alarm redis-fehlt mit Ursache',
          r.code === 503 && alarme.length === 1 && alarme[0].event === 'redis-fehlt' && /SUPABASE_URL/.test(alarme[0].detail));
    r = await call(h.token, { code: 'c', code_verifier: 'v' });
    check('E7 Login ohne Supabase-Env → ohne Sitzung, wie bisher ohne Redis', r.code === 200 && r.body.session_id === null);
    h = load({});
    r = await call(h.refresh, { session_id: sid });
    check('E8 ganz ohne Env: Alarmtext wie vor dem Umzug',
          r.code === 503 && alarme[0] && alarme[0].detail === 'UPSTASH_REDIS_REST_URL/TOKEN nicht gesetzt — Token-Erneuerung unmoeglich, Kunden fliegen stuendlich raus');

    // ── F · Spiegel und Umschalten ───────────────────────────────────────────
    reset(); h = load(Object.assign({ STORAGE_MIRROR: 'supabase' }, REDIS, SBENV)); whopReply = LOGIN;
    sid = (await call(h.token, { code: 'c', code_verifier: 'v' })).body.session_id;
    check('F1 Dual-Write beim Login: Redis und Supabase', kv.has('whoprt:' + sid) && sess.has(sid));
    expire(kv, sid); whopReply = rotate(1);
    await call(h.refresh, { session_id: sid });
    check('F2 Rotation landet auch im Spiegel', sbRead(sid).rt === 'RT1');
    check('F3 Sperre nur im primären System', !rpcLog.some((x) => x.name === 'sync_whop_lock'));
    // Umschalten: Supabase primär, Redis Spiegel — Sitzung muss weiterleben
    h = load(Object.assign({ STORAGE_BACKEND: 'supabase', STORAGE_MIRROR: 'redis' }, REDIS, SBENV));
    expire(sess, sid); whopReply = rotate(2);
    r = await call(h.refresh, { session_id: sid });
    check('F4 nach dem Umschalten kein Logout, Kette läuft mit RT1 weiter',
          r.code === 200 && r.body.access_token === 'AT2' && whopCalls[0].refresh_token === 'RT1');
    check('F5 Rückweg aktuell: Redis bekam RT2 mit 30-Tage-TTL',
          JSON.parse(kv.get('whoprt:' + sid)).rt === 'RT2' && kvTtl.get('whoprt:' + sid) === '2592000');
    await call(h.refresh, { session_id: sid, revoke: true });
    check('F6 Widerruf löscht in beiden', !sess.has(sid) && !kv.has('whoprt:' + sid));
    // Spiegel-Ausfall bricht nichts ab, wird aber gemeldet
    reset(); h = load(Object.assign({ STORAGE_MIRROR: 'supabase' }, REDIS, SBENV)); whopReply = LOGIN; sbUp = false;
    r = await call(h.token, { code: 'c', code_verifier: 'v' });
    check('F7 Spiegel down: Login mit Sitzung gelingt', r.code === 200 && !!r.body.session_id && kv.has('whoprt:' + r.body.session_id));
    check('F8 und meldet whop-session/mirror-failed', alarme.some((a) => a.source === 'whop-session' && a.event === 'mirror-failed'));
    h = load(Object.assign({ STORAGE_MIRROR: 'supabase' }, REDIS));
    await call(h.token, { code: 'c', code_verifier: 'v' });
    check('F9 Spiegel ohne Env: gemeldet, nicht still', alarme.some((a) => a.event === 'mirror-failed' && /env missing/.test(a.detail)));

    // ── G · Verschlüsselung ──────────────────────────────────────────────────
    reset(); h = load(Object.assign({ STORAGE_BACKEND: 'supabase' }, SBENV)); whopReply = LOGIN;
    sid = (await call(h.token, { code: 'c', code_verifier: 'v' })).body.session_id;
    h = load(Object.assign({ STORAGE_BACKEND: 'supabase' }, SBENV, { WHOP_SESSION_KEY: crypto.randomBytes(32).toString('base64') }));
    r = await call(h.refresh, { session_id: sid });
    check('G1 falscher Schlüssel → 503, NICHT 401', r.code === 503 && r.body.error === 'refresh_unavailable');
    check('G2 Sitzung bleibt, Alarm session-nicht-lesbar', sess.has(sid) && alarme.some((a) => a.event === 'session-nicht-lesbar'));
    h = load(Object.assign({ STORAGE_BACKEND: 'supabase' }, SBENV));
    r = await call(h.refresh, { session_id: sid });
    check('G3 mit richtigem Schlüssel wieder lesbar', r.code === 200 && r.body.access_token === 'AT0');
    const sid2 = 'b'.repeat(64);
    sess.set(sid2, { data: sess.get(sid).data, until: Date.now() + 60000 });
    r = await call(h.refresh, { session_id: sid2 });
    check('G4 Chiffrat unter fremde ID kopiert → nicht lesbar (AAD), 503', r.code === 503);
    h = load(Object.assign({ STORAGE_BACKEND: 'supabase' }, SBENV, { WHOP_SESSION_KEY: '' }));
    r = await call(h.refresh, { session_id: sid });
    check('G5 ohne WHOP_SESSION_KEY → 503 + redis-fehlt nennt den Schlüssel',
          r.code === 503 && alarme[0] && alarme[0].event === 'redis-fehlt' && /WHOP_SESSION_KEY/.test(alarme[0].detail));
    h = load(Object.assign({ STORAGE_BACKEND: 'supabase' }, SBENV, { WHOP_SESSION_KEY: Buffer.alloc(16).toString('base64') }));
    check('G6 zu kurzer Schlüssel (16 Byte) zählt als fehlend', (await call(h.refresh, { session_id: sid })).code === 503 && /WHOP_SESSION_KEY/.test(alarme[0].detail));
    reset(); h = load(Object.assign({ STORAGE_MIRROR: 'supabase' }, REDIS, SBENV, { WHOP_SESSION_KEY: '' })); whopReply = LOGIN;
    r = await call(h.token, { code: 'c', code_verifier: 'v' });
    check('G7 Spiegel ohne Schlüssel: Login läuft, mirror-failed gemeldet, nichts im Klartext gespiegelt',
          !!r.body.session_id && sess.size === 0 && alarme.some((a) => a.event === 'mirror-failed'));

    // ── H · Speicherfehler ───────────────────────────────────────────────────
    for (const be of ['redis', 'supabase']) {
        const env = be === 'redis' ? REDIS : Object.assign({ STORAGE_BACKEND: 'supabase' }, SBENV);
        reset(); h = load(env); whopReply = LOGIN;
        sid = (await call(h.token, { code: 'c', code_verifier: 'v' })).body.session_id;
        expire(be === 'redis' ? kv : sess, sid);
        // nur die Sperre stören (in Redis ist das ein SET wie das Speichern)
        if (be === 'redis') redisExec = (c) => (String(c[1]).indexOf('whoprt:lock:') === 0 ? { error: 'ERR' } : redisExecOrig(c));
        else sbFail.sync_whop_lock = 1;
        whopCalls = []; whopReply = rotate(1);
        r = await call(h.refresh, { session_id: sid });
        if (be === 'redis') redisExec = redisExecOrig;
        check('H1 ' + be + ': Sperre nicht setzbar → direkt erneuert (200, ein Whop-Aufruf)',
              r.code === 200 && r.body.access_token === 'AT1' && whopCalls.length === 1, JSON.stringify(r.body));
        check('H2 ' + be + ': rotierter Token gespeichert, fremde Sperre nicht gelöscht',
              (be === 'redis' ? JSON.parse(kv.get('whoprt:' + sid)).rt : sbRead(sid).rt) === 'RT1' &&
              !redisLog.some((c) => c[0] === 'DEL' && /lock/.test(c[1])) && !rpcLog.some((x) => x.name === 'sync_whop_unlock'));

        expire(be === 'redis' ? kv : sess, sid); alarme = []; whopReply = rotate(2);
        if (be === 'redis') { let n = 1; redisExec = (c) => (c[0] === 'SET' && c[1] === 'whoprt:' + sid && n-- > 0 ? { error: 'ERR' } : redisExecOrig(c)); }
        else sbFail.sync_whop_session_put = 1;
        r = await call(h.refresh, { session_id: sid });
        redisExec = redisExecOrig;
        check('H3 ' + be + ': Speichern scheitert einmal → Wiederholung rettet die Kette',
              r.code === 200 && (be === 'redis' ? JSON.parse(kv.get('whoprt:' + sid)).rt : sbRead(sid).rt) === 'RT2' && alarme.length === 0);

        expire(be === 'redis' ? kv : sess, sid); alarme = []; whopReply = rotate(3);
        if (be === 'redis') redisExec = (c) => (c[0] === 'SET' && c[1] === 'whoprt:' + sid ? { error: 'ERR' } : redisExecOrig(c));
        else sbFail.sync_whop_session_put = 2;
        r = await call(h.refresh, { session_id: sid });
        redisExec = redisExecOrig;
        check('H4 ' + be + ': Speichern scheitert zweimal → Token trotzdem ausgegeben, laut gemeldet',
              r.code === 200 && r.body.access_token === 'AT3' && alarme.some((a) => a.source === 'whop-refresh' && a.event === 'session-nicht-gespeichert'));
    }
    reset(); h = load(REDIS); whopReply = LOGIN;
    sid = (await call(h.token, { code: 'c', code_verifier: 'v' })).body.session_id;
    redisErr.add('GET');
    r = await call(h.refresh, { session_id: sid });
    check('H5 Upstash antwortet { error } beim Lesen → 503, NICHT 401 (vorher: Kunde abgemeldet)',
          r.code === 503 && r.body.error === 'refresh_unavailable' && kv.has('whoprt:' + sid));
    check('H6 und meldet session-nicht-lesbar', alarme.some((a) => a.event === 'session-nicht-lesbar'));
    redisErr.clear(); redisErr.add('SET');
    r = await call(h.token, { code: 'c', code_verifier: 'v' });
    check('H7 Upstash { error } beim Anlegen → Login ohne Sitzung + Alarm (vorher: tote ID ausgegeben)',
          r.code === 200 && r.body.session_id === null && alarme.some((a) => a.event === 'session-nicht-gespeichert'));

    console.error = origErr; console.warn = origWarn;
    console.log('\n' + pass + '/' + total + ' Checks bestanden');
    if (pass !== total) process.exit(1);
})().catch((e) => { console.error = origErr; console.error(e); process.exit(1); });
