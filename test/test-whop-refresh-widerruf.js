// Regression Audit 2026-10-13, S6/S7 — temporärer Whop-Fehler und Logout während Refresh.
//
// S6: Whop antwortet 503 (oder 429) → Sitzung bleibt, Antwort 503. Nur `invalid_grant` beendet
//     die Sitzung (RFC 6749 §5.2).
// S7: Refresh anhalten → Logout → Refresh freigeben: die Sitzung bleibt widerrufen, auch wenn der
//     Refresh die rotierte Sitzung schon speichern wollte. Fehlgeschlagener Widerruf meldet
//     revoked:false statt Erfolg.
//
// Echter Handler api/whop-refresh.js + api/_whop-sessions.js (Redis-Fassung, test/_mini-redis.js).
// Die Supabase-Fassung ist über test-whop-sessions.js (Aufruffolge) abgedeckt, nicht gegen Postgres.
'use strict';
const assert = require('assert');
const path = require('path');
const { miniRedis } = require('./_mini-redis');
const ROOT = path.join(__dirname, '..');

let fail = 0, pass = 0;
const faelle = [];
const check = (n, f) => faelle.push([n, f]);

let redis, whopAntwort, whopSperre = null, redisKaputt = false;
global.fetch = async (url, opts) => {
    if (url === 'http://redis.mock') {
        if (redisKaputt && /whoprt:rv|DEL/.test(opts.body) && /SET|DEL/.test(opts.body)) return { json: async () => ({ error: 'down' }) };
        return redis.fetch(url, opts);
    }
    if (String(url).includes('api.whop.com/oauth/token')) {
        if (whopSperre) await whopSperre;
        return { ok: whopAntwort.status < 300, status: whopAntwort.status, json: async () => whopAntwort.body };
    }
    return { ok: false, status: 404 };
};
function lade() {
    Object.assign(process.env, { UPSTASH_REDIS_REST_URL: 'http://redis.mock', UPSTASH_REDIS_REST_TOKEN: 'x', WHOP_CLIENT_SECRET: 'geheim' });
    delete process.env.STORAGE_BACKEND; delete process.env.STORAGE_MIRROR;
    for (const f of ['whop-refresh.js', '_whop-sessions.js', '_sync-store.js', '_db.js', '_alert.js']) delete require.cache[path.join(ROOT, 'api', f)];
    return require(path.join(ROOT, 'api', 'whop-refresh.js'));
}
async function rufe(h, body) {
    const r = { code: 0, body: null, setHeader() {} };
    r.status = c => { r.code = c; return { json: b => { r.body = b; return r; }, end: () => r }; };
    await h({ method: 'POST', headers: { 'x-vercel-forwarded-for': '7.7.7.' + Math.floor(Math.random() * 200) }, body, socket: {} }, r);
    return r;
}
const SID = 'a'.repeat(64);
const sitzung = () => redis.cmd(['SET', 'whoprt:' + SID, JSON.stringify({ rt: 'RT0', at: 'AT0', exp: Date.now() - 1000 })]);

check('S6: Whop 503 → Sitzung bleibt, Antwort 503', async () => {
    redis = miniRedis(); const h = lade(); sitzung();
    whopAntwort = { status: 503, body: { error: 'temporarily_unavailable' } };
    const r = await rufe(h, { session_id: SID });
    assert.strictEqual(r.code, 503);
    assert.ok(redis.kv.has('whoprt:' + SID), 'Sitzung erhalten');
});
check('S6: Whop 429 und HTML-Fehlerseite → Sitzung bleibt', async () => {
    redis = miniRedis(); const h = lade(); sitzung();
    whopAntwort = { status: 429, body: { error: 'rate_limited' } };
    assert.strictEqual((await rufe(h, { session_id: SID })).code, 503);
    whopAntwort = { status: 502, body: undefined };
    assert.strictEqual((await rufe(h, { session_id: SID })).code, 503);
    assert.ok(redis.kv.has('whoprt:' + SID));
});
check('S6: invalid_grant → Sitzung gelöscht, 401', async () => {
    redis = miniRedis(); const h = lade(); sitzung();
    whopAntwort = { status: 400, body: { error: 'invalid_grant' } };
    const r = await rufe(h, { session_id: SID });
    assert.strictEqual(r.code, 401);
    assert.ok(!redis.kv.has('whoprt:' + SID));
});
check('S7: Refresh anhalten → Logout → Refresh freigeben: Sitzung bleibt widerrufen', async () => {
    redis = miniRedis(); const h = lade(); sitzung();
    whopAntwort = { status: 200, body: { access_token: 'AT1', refresh_token: 'RT1', expires_in: 3600 } };
    let freigeben; whopSperre = new Promise(r => { freigeben = r; });
    const laufend = rufe(h, { session_id: SID });
    await new Promise(r => setTimeout(r, 20));          // Refresh wartet jetzt auf Whop
    const logout = await rufe(h, { session_id: SID, revoke: true });
    assert.strictEqual(logout.code, 200); assert.strictEqual(logout.body.revoked, true);
    freigeben(); whopSperre = null;
    const r = await laufend;
    assert.strictEqual(r.code, 401, 'Refresh liefert keinen Token mehr: ' + JSON.stringify(r.body));
    assert.ok(!redis.kv.has('whoprt:' + SID), 'Sitzung nicht wiederbelebt');
    // auch ein späterer Refresh scheitert
    assert.strictEqual((await rufe(h, { session_id: SID })).code, 401);
});
check('S7: parallele Refreshs ohne Logout funktionieren weiter', async () => {
    redis = miniRedis(); const h = lade(); sitzung();
    whopAntwort = { status: 200, body: { access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600 } };
    const [a, b] = await Promise.all([rufe(h, { session_id: SID }), rufe(h, { session_id: SID })]);
    assert.ok([a.code, b.code].includes(200));
    assert.strictEqual(JSON.parse(redis.kv.get('whoprt:' + SID)).rt, 'RT2');
});
check('S7: Speicherfehler beim Widerruf → revoked:false, keine Erfolgsmeldung', async () => {
    redis = miniRedis(); const h = lade(); sitzung();
    redisKaputt = true;
    const r = await rufe(h, { session_id: SID, revoke: true });
    redisKaputt = false;
    assert.strictEqual(r.code, 503); assert.strictEqual(r.body.revoked, false);
});

(async () => {
    for (const [n, f] of faelle) {
        const e = console.error, w = console.warn; console.error = console.warn = () => {};
        try { await f(); pass++; console.log('✓ ' + n); }
        catch (x) { fail++; console.log('✗ ' + n + '\n   ' + (x && x.message)); }
        finally { console.error = e; console.warn = w; }
    }
    console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
    if (fail) process.exit(1);
})();
