// Regression Audit 2026-10-13, S2/S3 — der externe Audit-Anker beweist auch das Fehlen.
//
// S2: Server liefert zwei Anker, lokal ist nur einer vorhanden → keine "alles bestätigt"-Aussage,
//     der fehlende Eintrag wird als missingLocally gemeldet.
// S3: 20 × 1.000 neue Einträge verdrängen den ersten Anker nicht; gleiche ID mit anderem Hash
//     ersetzt nichts (409); Wiederholung ist idempotent; Kapazität wird gemeldet statt alte
//     Beweise zu löschen; Scope-Löschung lässt die Anker stehen.
//
// Echt: api/sync.js + api/_sync-store.js (Redis-Fassung gegen test/_mini-redis.js) und
// js/cloud-sync.js verifyAuditAnchors() — der Client spricht hier über fetch direkt mit dem
// echten Handler. Die Supabase-Fassung (sync_append_anchors_v2) ist NICHT ausgeführt, nur
// statisch geprüft (test-migration-rechte.js); die SQL-Probe steht als offener Schritt im Bericht.
'use strict';
const assert = require('assert');
const path = require('path');
const { miniRedis } = require('./_mini-redis');
const { ladeModule } = require('./_lade-module');
const ROOT = path.join(__dirname, '..');

let fail = 0, pass = 0;
const faelle = [];
const check = (n, f) => faelle.push([n, f]);

let redis = miniRedis();
global.fetch = async (url, opts) => {
    opts = opts || {};
    if (url === 'http://redis.mock') return redis.fetch(url, opts);
    if (String(url).includes('/oauth/userinfo')) return { ok: true, json: async () => ({ sub: 'u1', preferred_username: 'u1' }) };
    if (String(url).includes('/me/has_access/')) return { ok: true, status: 200, json: async () => ({ valid: true }) };
    return { ok: false, status: 404 };
};
function sync() {
    Object.assign(process.env, { UPSTASH_REDIS_REST_URL: 'http://redis.mock', UPSTASH_REDIS_REST_TOKEN: 'x' });
    delete process.env.STORAGE_BACKEND; delete process.env.STORAGE_MIRROR;
    for (const f of ['sync.js', '_sync-store.js', '_db.js', '_alert.js']) delete require.cache[path.join(ROOT, 'api', f)];
    return require(path.join(ROOT, 'api', 'sync.js'));
}
async function rufe(h, body) {
    redis.kv.delete('sync:rl:u1');   // Nutzer-Rate-Limit ist nicht Gegenstand dieses Tests
    const r = { code: 0, body: null, setHeader() {} };
    r.status = c => { r.code = c; return { json: b => { r.body = b; return r; }, end: () => r }; };
    await h({ method: 'POST', headers: { authorization: 'Bearer t', 'x-vercel-forwarded-for': '1.2.3.' + Math.floor(Math.random() * 200) }, body }, r);
    return r;
}
const hx = n => n.toString(16).padStart(64, '0');
const leise = async fn => { const e = console.error, w = console.warn; console.error = console.warn = () => {}; try { return await fn(); } finally { console.error = e; console.warn = w; } };

check('S3: erster Anker übersteht 20 × 1.000 neue Einträge', async () => {
    redis = miniRedis();
    const h = sync();
    let r = await rufe(h, { action: 'anchor', scope: 'co_a', entries: [{ id: 'original', h: hx(1) }] });
    assert.strictEqual(r.code, 200);
    for (let k = 0; k < 20; k++) {
        r = await rufe(h, { action: 'anchor', scope: 'co_a', entries: Array.from({ length: 1000 }, (_, i) => ({ id: 'f' + k + '_' + i, h: hx(2) })) });
        assert.strictEqual(r.code, 200, 'Füllanfrage ' + k + ': ' + JSON.stringify(r.body));
    }
    r = await rufe(h, { action: 'anchor_pull', scope: 'co_a' });
    assert.ok(r.body.anchors.some(a => a.id === 'original' && a.h === hx(1)), 'Original noch abrufbar');
    assert.strictEqual(r.body.anchors.length, 20001);
});
check('S3: gleiche ID + anderer Hash → 409, kein zweiter Wert; gleiche ID + gleicher Hash → idempotent', async () => {
    redis = miniRedis();
    const h = sync();
    await rufe(h, { action: 'anchor', scope: 'co_a', entries: [{ id: 'e1', h: hx(1) }] });
    let r = await rufe(h, { action: 'anchor', scope: 'co_a', entries: [{ id: 'e1', h: hx(9) }] });
    assert.strictEqual(r.code, 409); assert.strictEqual(r.body.error, 'anchor_conflict');
    r = await rufe(h, { action: 'anchor', scope: 'co_a', entries: [{ id: 'e1', h: hx(1) }] });
    assert.strictEqual(r.code, 200); assert.strictEqual(r.body.added, 0);
    r = await rufe(h, { action: 'anchor', scope: 'co_a', entries: [{ id: 'e2', h: hx(1) }, { id: 'e2', h: hx(2) }] });
    assert.strictEqual(r.code, 409, 'Widerspruch innerhalb der Anfrage');
    r = await rufe(h, { action: 'anchor_pull', scope: 'co_a' });
    assert.deepStrictEqual(r.body.anchors.map(a => a.id + ':' + a.h.slice(-1)), ['e1:1']);
});
check('S3: Kapazität je Scope wird gemeldet (507), alte Anker bleiben; Scope-Löschung lässt Anker stehen', async () => {
    redis = miniRedis();
    const h = sync();
    await rufe(h, { action: 'anchor', scope: 'co_a', entries: [{ id: 'erst', h: hx(1) }] });
    for (let k = 0; k < 49; k++) await rufe(h, { action: 'anchor', scope: 'co_a', entries: Array.from({ length: 1000 }, (_, i) => ({ id: 'x' + k + '_' + i, h: hx(3) })) });
    let r = await rufe(h, { action: 'anchor', scope: 'co_a', entries: Array.from({ length: 1000 }, (_, i) => ({ id: 'y' + i, h: hx(3) })) });
    assert.strictEqual(r.code, 507, JSON.stringify(r.body));
    r = await rufe(h, { action: 'anchor_pull', scope: 'co_a' });
    assert.ok(r.body.anchors.some(a => a.id === 'erst'), 'erster Anker bleibt');
    await rufe(h, { action: 'delete', scope: 'co_a' });
    r = await rufe(h, { action: 'anchor_pull', scope: 'co_a' });
    assert.ok(r.body.anchors.length > 0, 'Anker nach Löschung erhalten');
});

check('S2: zwei Server-Anker, ein lokaler Eintrag → nicht bestätigt, missingLocally = 1', async () => {
    redis = miniRedis();
    const h = sync();
    await rufe(h, { action: 'anchor', scope: 'co_a', entries: [{ id: 'kept', h: hx(1) }, { id: 'deleted', h: hx(2) }] });
    const ls = { 'oyi_sync_enabled': '1', 'whop_access_token': 't', 'oyi_sync_anchored_co_a': JSON.stringify(['kept', 'deleted']) };
    const ctx = ladeModule(['js/cloud-sync.js'], {
        localStorage: { getItem: k => (k in ls ? ls[k] : (k.indexOf('oyi_sync_keypresent_') === 0 ? '1' : null)), setItem: (k, v) => { ls[k] = v; }, removeItem() {} },
        Store: { _cache: {}, getAuditLog: () => [{ id: 'kept' }], _auditContentHash: async () => hx(1) },
        CompanyManager: { getActiveId: () => 'co_a' },
        fetch: async (url, opts) => { const r = await rufe(h, JSON.parse(opts.body)); return { status: r.code, ok: r.code === 200, json: async () => r.body, text: async () => JSON.stringify(r.body) }; },
        // Auto-Init von cloud-sync.js (setTimeout) hier nicht laufen lassen
        setTimeout: () => 0, setInterval: () => 0,
        navigator: {}, location: { hostname: 'x', origin: 'x' }, document: { addEventListener() {}, getElementById: () => null }
    });
    const res = await ctx.CloudSync.verifyAuditAnchors();
    assert.strictEqual(res.enabled, true, JSON.stringify(res));
    assert.strictEqual(res.ok, 1);
    assert.strictEqual(JSON.stringify(res.missingLocally), '["deleted"]');
    assert.strictEqual(res.vollstaendig, false);
});
check('S2: lokal als verankert gemerkt, Server-Anker fehlt (früher verdrängt) → "nicht mehr extern belegt"', async () => {
    redis = miniRedis();
    const h = sync();
    const ls = { 'oyi_sync_enabled': '1', 'whop_access_token': 't', 'oyi_sync_anchored_co_a': JSON.stringify(['alt']) };
    const ctx = ladeModule(['js/cloud-sync.js'], {
        localStorage: { getItem: k => (k in ls ? ls[k] : (k.indexOf('oyi_sync_keypresent_') === 0 ? '1' : null)), setItem: (k, v) => { ls[k] = v; }, removeItem() {} },
        Store: { _cache: {}, getAuditLog: () => [{ id: 'alt' }, { id: 'neu' }], _auditContentHash: async () => hx(1) },
        CompanyManager: { getActiveId: () => 'co_a' },
        fetch: async (url, opts) => { const r = await rufe(h, JSON.parse(opts.body)); return { status: r.code, ok: r.code === 200, json: async () => r.body, text: async () => JSON.stringify(r.body) }; },
        // Auto-Init von cloud-sync.js (setTimeout) hier nicht laufen lassen
        setTimeout: () => 0, setInterval: () => 0,
        navigator: {}, location: { hostname: 'x', origin: 'x' }, document: { addEventListener() {}, getElementById: () => null }
    });
    const res = await ctx.CloudSync.verifyAuditAnchors();
    assert.strictEqual(JSON.stringify(res.nichtMehrBelegt), '["alt"]');
    assert.strictEqual(res.notAnchored, 1);
    assert.strictEqual(res.vollstaendig, false);
});

(async () => {
    for (const [n, f] of faelle) {
        try { await leise(f); pass++; console.log('✓ ' + n); }
        catch (e) { fail++; console.log('✗ ' + n + '\n   ' + (e && e.message)); }
    }
    console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
    if (fail) process.exit(1);
})();
