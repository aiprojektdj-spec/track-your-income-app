// Handler-Test für die StB-Grant-Autorisierung:  node test-api-sync.js
// Mockt Upstash-Redis (in-memory) + Whop (userinfo + app/memberships) und fährt den echten
// api/sync.js-Handler. Prüft: Grant-gated pull, read-only push-Sperre, Pro-Ausnahme
// für Grantee-Reads, echter Revoke.
'use strict';
const assert = require('assert');
process.env.UPSTASH_REDIS_REST_URL   = 'http://redis.mock';
process.env.UPSTASH_REDIS_REST_TOKEN = 'x';
process.env.WHOP_API_KEY             = 'test_app_key';

// ── In-Memory-Redis ───────────────────────────────────────────────────────────
const store = new Map(), sets = new Map();
function redisExec(cmd) {
    const op = cmd[0];
    if (op === 'GET')      return store.has(cmd[1]) ? store.get(cmd[1]) : null;
    if (op === 'SET')      { store.set(cmd[1], cmd[2]); return 'OK'; }
    if (op === 'DEL')      { store.delete(cmd[1]); return 1; }
    if (op === 'INCR')     { const v = parseInt(store.get(cmd[1]) || '0', 10) + 1; store.set(cmd[1], String(v)); return v; }
    if (op === 'EXPIRE')   return 1;
    if (op === 'EVAL')     return 'OK';
    if (op === 'SADD')     { const s = sets.get(cmd[1]) || new Set(); s.add(cmd[2]); sets.set(cmd[1], s); return 1; }
    if (op === 'SREM')     { const s = sets.get(cmd[1]); if (s) s.delete(cmd[2]); return 1; }
    if (op === 'SMEMBERS') { const s = sets.get(cmd[1]); return s ? Array.from(s) : []; }
    return null;
}

// ── Whop-Mock (Token → User) ──────────────────────────────────────────────────
const whopUsers = {
    tok_owner: { sub: 'owner1', preferred_username: 'ownerX', has_access: true },
    tok_stb:   { sub: 'stb1',   preferred_username: 'stbY',   has_access: false }   // StB OHNE eigenes Pro
};
global.fetch = async (url, opts) => {
    if (url === 'http://redis.mock') {
        return { json: async () => ({ result: redisExec(JSON.parse(opts.body)) }) };
    }
    const auth = (opts.headers.Authorization || '').replace('Bearer ', '');
    const u = whopUsers[auth] || null;
    if (url.includes('/oauth/userinfo')) return u ? { ok: true, json: async () => ({ sub: u.sub, preferred_username: u.preferred_username }) } : { ok: false };
    if (url.includes('/company/memberships')) {
        // Company-API-Key-Check: gibt ALLE gültigen Memberships zurück (user_id-Filter wirkt nicht);
        // der Handler matcht die user_id selbst. Nur Mock-User mit has_access sind gültig.
        const members = Object.values(whopUsers).filter(x => x.has_access)
            .map(x => ({ id: 'mem_' + x.sub, user_id: x.sub, valid: true, status: 'active' }));
        return { ok: true, json: async () => ({ data: members, pagination: { next_page: null } }) };
    }
    return { ok: false };
};

const handler = require('./api/sync.js');
function mkRes() { const r = { code: 0, body: null }; r.setHeader = () => {}; r.status = (c) => { r.code = c; return { json: (b) => { r.body = b; return r; }, end: () => r }; }; return r; }
async function call(token, body) { const res = mkRes(); await handler({ method: 'POST', headers: { authorization: 'Bearer ' + token }, body }, res); return res; }

(async () => {
    let pass = 0, r;

    r = await call('tok_stb', { action: 'register_pubkey', pub: { kty: 'EC', x: 'a', y: 'b' } });
    assert.strictEqual(r.code, 200, 'StB register_pubkey ohne Pro'); pass++; console.log('✓ register_pubkey (kein Pro nötig)');

    r = await call('tok_owner', { action: 'get_pubkey', granteeId: 'stb1' });
    assert.strictEqual(r.code, 200); assert.ok(r.body.pubkey.pub, 'pubkey zurück'); pass++; console.log('✓ get_pubkey (Owner holt StB-Key)');

    r = await call('tok_stb', { action: 'pull', scope: '__account', owner: 'owner1' });
    assert.strictEqual(r.code, 403); assert.strictEqual(r.body.error, 'no_grant', 'ohne Grant kein Zugriff'); pass++; console.log('✓ pull vor Grant → 403 no_grant');

    store.set('sync:owner1:__account', JSON.stringify({ ciphertext: 'X', iv: 'Y', version: 1 }));
    r = await call('tok_owner', { action: 'grant', granteeId: 'stb1', envelope: { ephPub: {}, iv: 'i', ct: 'c' } });
    assert.strictEqual(r.code, 200, 'Grant erteilt'); pass++; console.log('✓ grant (Owner teilt Envelope)');

    r = await call('tok_stb', { action: 'list_grants' });
    assert.strictEqual(r.code, 200); assert.strictEqual(r.body.grants.length, 1);
    assert.strictEqual(r.body.grants[0].ownerId, 'owner1'); assert.ok(r.body.grants[0].envelope, 'Envelope dabei'); pass++; console.log('✓ list_grants (StB sieht Mandant + Envelope)');

    r = await call('tok_stb', { action: 'pull', scope: '__account', owner: 'owner1' });
    assert.strictEqual(r.code, 200); assert.strictEqual(r.body.blob.ciphertext, 'X', 'Chiffrat gelesen'); pass++; console.log('✓ pull nach Grant → Chiffrat');

    r = await call('tok_stb', { action: 'push', scope: '__account', owner: 'owner1', version: 1, ciphertext: 'Z', iv: 'i' });
    assert.strictEqual(r.code, 403); assert.strictEqual(r.body.error, 'readonly', 'StB darf nie schreiben'); pass++; console.log('✓ push als StB → 403 readonly');

    r = await call('tok_owner', { action: 'revoke', granteeId: 'stb1' });
    assert.strictEqual(r.code, 200);
    r = await call('tok_stb', { action: 'pull', scope: '__account', owner: 'owner1' });
    assert.strictEqual(r.code, 403, 'nach Revoke kein Zugriff'); pass++; console.log('✓ revoke → Zugriff entzogen');

    r = await call('tok_stb', { action: 'pull', scope: '__account' });   // eigener Scope, StB ohne Pro
    assert.strictEqual(r.code, 403); assert.strictEqual(r.body.error, 'pro_required', 'eigener Scope braucht Pro'); pass++; console.log('✓ eigener pull ohne Pro → pro_required');

    console.log('\n' + pass + '/9 API-Tests bestanden ✅');
})().catch(e => { console.error('✗ FAIL', e); process.exit(1); });
