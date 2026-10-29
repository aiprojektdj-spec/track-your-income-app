// Daten-Endpunkt (R3/R5, plan/server-umbau-2026-10-22.md):  node test/test-server-data.js
// =============================================================================
// Ohne Datenbank und ohne Whop (fetch gemockt):
//   1. Jeder db.rpc-Aufruf in api/data.js und api/_auth.js trifft eine Funktion der Migrationen
//      mit exakt denselben Parameternamen (Muster test/test-sync-store.js)
//   2. 20261028000001_server_umzug.sql folgt RLS-Weg E-A (Eigentümer stackr_app, set_config
//      zuerst, execute nur service_role, revoke von public/anon/authenticated)
//   3. js/server-abbild.js: calcChecksum = Store._calcChecksum, kettePruefen = Store.verifyAuditChain,
//      Zerlegung, Spalten, Prüfsumme unabhängig von der Schlüsselreihenfolge (jsonb)
//   4. api/_auth.js: Cache-Treffer ohne Whop, nur Pro wird gemerkt, nie der Token
//   5. api/data.js: push 409 bei Konflikt, migrate 'vorhanden' bei gleichem Inhalt, Grenzen,
//      42501 → 403, migrate_commit: Originaltexte wortgleich, Kette aus der DB, Prüfsumme,
//      Datenübernahme-Eintrag nur bei Gleichstand
//
// Was dieser Test NICHT kann (gegen echtes Supabase, führt der User aus): siehe Antwort der
// Session bzw. plan/server-umbau-2026-10-22.md Abschnitt 7 (R3/R5).
// =============================================================================
'use strict';
const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { ladeModule } = require('./_lade-module.js');

const ROOT = path.join(__dirname, '..');
const MIG  = path.join(ROOT, 'supabase/migrations');
const ohneKommentare = (s) => s.replace(/--[^\n]*/g, '');
const sql = fs.readdirSync(MIG).filter(f => f.endsWith('.sql')).sort()
    .map(f => ohneKommentare(fs.readFileSync(path.join(MIG, f), 'utf8'))).join('\n');
let pass = 0;
const ok = (m) => { pass++; console.log('✓ ' + m); };

// ── 1. RPC-Aufrufe ↔ Migration ───────────────────────────────────────────────
const fns = {};
for (const m of sql.matchAll(/create or replace function (\w+)\(([^)]*)\)/g)) {
    fns[m[1]] = m[2].split(',').map(a => a.trim().split(/\s+/)[0]).filter(Boolean).sort();
}
let n = 0;
for (const datei of ['api/data.js', 'api/_auth.js']) {
    const src = fs.readFileSync(path.join(ROOT, datei), 'utf8');
    for (const c of src.matchAll(/db\.rpc\('(\w+)',\s*\{([\s\S]*?)\}\)/g)) {
        const params = [...c[2].matchAll(/\b(p_\w+)\s*:/g)].map(x => x[1]).sort();
        assert.ok(fns[c[1]], datei + ': Funktion fehlt in der Migration: ' + c[1]);
        assert.deepStrictEqual(params, fns[c[1]], datei + ': Parameter von ' + c[1]);
        n++;
    }
}
assert.ok(n >= 12, 'zu wenige rpc-Aufrufe gefunden: ' + n);
ok(n + ' rpc-Aufrufe passen zur Migration');

// ── 2. Umzugs-Migration nach E-A ─────────────────────────────────────────────
const UMZUG = ohneKommentare(fs.readFileSync(path.join(MIG, '20261028000001_server_umzug.sql'), 'utf8'));
const typen = (a) => a.split(',').map(x => x.trim()).filter(Boolean).map(x => x.split(/\s+/).slice(1).join(' ')).join(', ');
const umzugFns = [...UMZUG.matchAll(/create or replace function (\w+)\(([^)]*)\)([\s\S]*?)\bas \$\$([\s\S]*?)\$\$/g)];
assert.strictEqual(umzugFns.length, 2);
for (const [, name, args, kopf, body] of umzugFns) {
    const sig = name + '(' + typen(args) + ')';
    assert.ok(/security definer/.test(kopf) && /set search_path = public, pg_temp/.test(kopf), sig + ': Kopf');
    assert.ok(/^p_user text,/.test(args.trim()), sig + ': p_user zuerst');
    const erste = body.replace(/^\s*declare[\s\S]*?\bbegin\b/, '').replace(/^\s*begin\b/, '').trim();
    assert.ok(/^perform set_config\('stackr\.user', p_user, true\);/.test(erste), sig + ': set_config zuerst');
    assert.ok(UMZUG.includes('alter function ' + sig), sig + ': alter function');
    assert.ok(new RegExp('alter function ' + sig.replace(/[()]/g, '\\$&') + '\\s+owner to stackr_app').test(UMZUG), sig + ': Eigentümer');
    assert.ok(new RegExp('revoke all on function ' + sig.replace(/[()]/g, '\\$&') + '\\s+from public, anon, authenticated;').test(UMZUG), sig + ': revoke');
    const grants = [...UMZUG.matchAll(new RegExp('grant execute on function ' + sig.replace(/[()]/g, '\\$&') + '\\s+to (\\w+);', 'g'))].map(m => m[1]);
    assert.deepStrictEqual(grants, ['service_role'], sig + ': execute nur service_role');
    assert.ok(/ist_owner\(p_company\)/.test(body), sig + ': nur Owner');
}
ok('Umzugs-Migration: 2 Datenfunktionen nach RLS-Weg E-A');

// ── 3. ServerAbbild ──────────────────────────────────────────────────────────
const Abbild = require('../js/server-abbild.js');
const ctx = ladeModule(['js/store.js'], { document: { addEventListener() {}, readyState: 'complete' }, navigator: {} });
const Store = ctx.Store;
for (const s of ['', 'a', '{"x":1}', 'äöü€', 'x'.repeat(5000)]) assert.strictEqual(Abbild.calcChecksum(s), Store._calcChecksum(s));

// Kette wie Store._addAuditEntry bauen, dann gegen Store.verifyAuditChain halten
function kette(anz) {
    const log = [];
    for (let i = 0; i < anz; i++) {
        const prev = log.length ? log[log.length - 1].checksum : 'GENESIS';
        const e = { id: 'a' + i, timestamp: '2026-10-0' + (1 + i % 9) + 'T10:00:00.000Z', _dev: 'dev_x', action: 'create',
                    entityType: 'sale', entityId: 's' + i, oldValues: null, newValues: { betrag: i * 1.5, text: 'Ä' + i },
                    details: '', prevHash: prev, checksum: '' };
        e.checksum = Store._calcChecksum(JSON.stringify(e));
        log.push(e);
    }
    return log;
}
function vergleiche(log) {
    Store._companyId = 'co_t';
    Store._cache = { 'co_t__audit_log': JSON.stringify(log) };
    const soll = Store.verifyAuditChain();
    const ist = Abbild.kettePruefen(log.map(e => JSON.stringify(e)));
    assert.strictEqual(ist.total, soll.total); assert.strictEqual(ist.broken, soll.broken); assert.strictEqual(ist.clockBack, soll.clockBack);
    return ist;
}
assert.strictEqual(vergleiche(kette(5)).broken, 0);
let k = kette(5); k[2].newValues.betrag = 99;                         // Inhalt manipuliert
assert.deepStrictEqual(vergleiche(k).positionen, [2]);
k = kette(5); k.splice(1, 1);                                          // Eintrag entfernt
assert.deepStrictEqual(vergleiche(k).positionen, [1]);
k = kette(4); k[3]._kettenbruch = '2026-10-01T00:00:00.000Z';
assert.strictEqual(vergleiche(k).broken, 1);
ok('calcChecksum und kettePruefen = Store._calcChecksum / Store.verifyAuditChain');

assert.deepStrictEqual(Abbild.schluessel('co_ab1__reselling_sales'), { company: 'co_ab1', name: 'sales' });
assert.deepStrictEqual(Abbild.schluessel('co_ab1__rechnungsbuch_invoices'), { company: 'co_ab1', name: 'rech_invoices' });
assert.deepStrictEqual(Abbild.schluessel('co_ab1__eigenbelege_belege'), { company: 'co_ab1', name: 'eb_belege' });
assert.strictEqual(Abbild.schluessel('co_ab1__audit_log'), null);
assert.strictEqual(Abbild.schluessel('co_ab1__reselling_tombstones'), null);
assert.strictEqual(Abbild.schluessel('oyi_companies'), null);
const z = Abbild.zerlege('sales', [{ id: 'x', a: 1 }, { id: 'x', a: 2 }, { id: 7 }]);
assert.deepStrictEqual(z.records.map(r => r.id), ['x', 'x#2', '7']);
assert.strictEqual(z.records[1].data.a, 2);
assert.deepStrictEqual(Abbild.zerlege('invoice_counter', 12), { key: 'invoice_counter', data: 12 });
assert.deepStrictEqual(Abbild.zerlege('platforms', ['Vinted', 'eBay']), { key: 'platforms', data: ['Vinted', 'eBay'] });
assert.ok(Abbild.zerlege('Sales', [{ id: 1 }]).fehler);
const cache = {
    'co_a__reselling_sales': JSON.stringify([{ id: 's1', datum: '2026-01-02' }]),
    'co_a__reselling_settings': JSON.stringify({ ku: true }),
    'co_a__audit_log': '[]', 'co_b__reselling_sales': JSON.stringify([{ id: 'fremd' }]), 'co_a__reselling_brands': 'kaputt{'
};
const alle = Abbild.alleZeilen('co_a', cache);
assert.deepStrictEqual(alle.records.map(r => r.art + '/' + r.id), ['sales/s1']);
assert.deepStrictEqual(alle.settings.map(s => s.key), ['settings']);
assert.strictEqual(alle.fehler.length, 1);

assert.deepStrictEqual(Abbild.spalten({ datum: '2026-02-30' }), { datum: null, gesperrt_grund: null, quelle: null });
assert.deepStrictEqual(Abbild.spalten({ anschaffungsdatum: '2025-12-31T10:00', storniert: true }), { datum: '2025-12-31', gesperrt_grund: 'storniert', quelle: null });
assert.strictEqual(Abbild.spalten({ _gegenbuchungZu: 'x' }).gesperrt_grund, 'gegengebucht');
assert.strictEqual(Abbild.spalten({ quelle: { art: 'shopify', shop: 'm.myshopify.com', orderId: '5', teil: 2 } }).quelle, 'shopify:m.myshopify.com:5:2');
assert.strictEqual(Abbild.spalten({ quelle: { art: 'shopify', shop: 'm.myshopify.com', orderId: '5', refundId: '9' } }).quelle, 'shopify:m.myshopify.com:refund:9');
assert.strictEqual(Abbild.spalten({ quelle: 'bestandscheck' }).quelle, null);

// jsonb ordnet Schlüssel um — die Prüfsumme darf das nicht sehen
const umgeordnet = (o) => (o && typeof o === 'object' && !Array.isArray(o))
    ? Object.keys(o).reverse().reduce((x, key) => (x[key] = umgeordnet(o[key]), x), {})
    : Array.isArray(o) ? o.map(umgeordnet) : o;
const recs = [{ art: 'sales', id: 's1', data: { b: 1, a: { y: [1, { q: 2, p: 3 }], x: 'ü' } } }, { art: 'sales', id: 's2', data: { z: 0 }, geloescht: true }];
const sets = [{ key: 'settings', data: { ku: true, satz: 19 } }];
assert.strictEqual(Abbild.pruefzeilen(recs, sets),
    Abbild.pruefzeilen(recs.slice().reverse().map(r => Object.assign({}, r, { data: umgeordnet(r.data) })), sets.map(s => ({ key: s.key, data: umgeordnet(s.data) }))));
assert.ok(!Abbild.pruefzeilen(recs, sets).includes('s2'), 'gelöschte zählen nicht');
ok('Zerlegung, Spalten und Prüfsumme');

// ── Gemeinsame Mocks für Endpunkt und Auth ───────────────────────────────────
for (const key of ['STORAGE_BACKEND', 'STORAGE_MIRROR', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'SYNC_OWNER_IDS', 'SYNC_OWNER_USERNAMES', 'WHOP_API_KEY']) delete process.env[key];
process.env.SUPABASE_URL = 'http://sb.mock';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
let rpcs = [], whop = [], antwort = {}, proFlag = true, kaputt403 = null;
global.fetch = async (url, opts) => {
    if (url.startsWith('http://sb.mock/rest/v1/rpc/')) {
        const name = url.split('/').pop(), args = JSON.parse(opts.body);
        rpcs.push({ name, args, roh: opts.body });
        if (kaputt403 === name) return { ok: false, status: 403, text: async () => '' };
        const a = antwort[name];
        const v = typeof a === 'function' ? a(args) : (a === undefined ? null : a);
        return { ok: true, status: 200, text: async () => (v === null ? '' : JSON.stringify(v)) };
    }
    whop.push(url);
    if (url.includes('/oauth/userinfo')) return { ok: true, json: async () => ({ sub: 'user_1', preferred_username: 'u1' }) };
    if (url.includes('/me/has_access/')) return { ok: true, status: 200, json: async () => ({ valid: proFlag }) };
    return { ok: false, status: 404 };
};
const handler = require('../api/data.js');
const auth = require('../api/_auth.js');
function mkRes() { const r = { code: 0, body: null }; r.setHeader = () => {}; r.status = (c) => { r.code = c; return { json: (b) => { r.body = b; return r; }, end: () => r }; }; return r; }
async function call(body, token) {
    const res = mkRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer ' + (token || 'tok') }, body }, res);
    return res;
}

(async () => {
    // ── 4. Auth ────────────────────────────────────────────────────────────────
    antwort = { sync_auth_cache_get: null };
    let a = await auth.pruefe({ headers: { authorization: 'Bearer geheim' } });
    assert.deepStrictEqual([a.ok, a.userId, a.pro, a.ausCache], [true, 'user_1', true, false]);
    const put = rpcs.find(r => r.name === 'sync_auth_cache_put');
    assert.ok(put && put.args.p_hash === crypto.createHash('sha256').update('geheim').digest('hex') && put.args.p_ttl === 300);
    assert.ok(!rpcs.some(r => r.roh.includes('geheim')), 'Token nie an die DB');
    rpcs = []; whop = [];
    antwort = { sync_auth_cache_get: { user_id: 'user_1', pro: true } };
    a = await auth.pruefe({ headers: { authorization: 'Bearer geheim' } });
    assert.ok(a.ausCache && whop.length === 0, 'Cache-Treffer ohne Whop');
    rpcs = []; proFlag = false; antwort = { sync_auth_cache_get: null };
    a = await auth.pruefe({ headers: { authorization: 'Bearer x' } });
    assert.ok(a.ok && !a.pro && !rpcs.some(r => r.name === 'sync_auth_cache_put'), 'kein Pro wird nicht gemerkt');
    assert.strictEqual((await call({ action: 'pull' })).code, 403);
    proFlag = true;
    antwort = { sync_auth_cache_get: () => { throw new Error('weg'); } };
    a = await auth.pruefe({ headers: { authorization: 'Bearer x' } });
    assert.ok(a.ok && a.pro, 'Cache-Ausfall: direkt gegen Whop');
    assert.deepStrictEqual(await auth.pruefe({ headers: {} }), { ok: false, status: 401, error: 'no_token' });
    ok('auth: Cache-Treffer ohne Whop, nur Pro gemerkt, Token nur als SHA-256');

    // ── 5. Endpunkt ────────────────────────────────────────────────────────────
    const C = 'co_test1';
    antwort = { sync_auth_cache_get: { user_id: 'user_1', pro: true } };
    assert.strictEqual((await call({ action: 'push', company: 'CO_X', ops: [] })).code, 400);
    assert.strictEqual((await call({ action: 'push', company: C, ops: new Array(201).fill({ t: 's', key: 'x', data: 1 }) })).code, 413);
    assert.strictEqual((await call({ action: 'push', company: C, ops: [{ t: 'r', art: 'Sales', id: 'a', data: {} }] })).body.feld, 'art');
    assert.strictEqual((await call({ action: 'changes', company: C })).code, 400, 'changes ohne seq');
    assert.strictEqual((await call({ action: 'nix', company: C })).code, 400);

    rpcs = [];
    antwort.datensatz_schreiben = (x) => x.p_id === 'k' ? { status: 'konflikt', version: 3, data: { alt: 1 } } : { status: 'ok', version: 1, seq: 5 };
    antwort.einstellung_schreiben = { status: 'ok', version: 2, seq: 6 };
    let r = await call({ action: 'push', company: C, ops: [
        { t: 'r', art: 'sales', id: 'a', data: { datum: '2026-03-01', storniert: true }, version: 2 },
        { t: 'r', art: 'sales', id: 'k', data: { x: 1 }, version: 1 },
        { t: 's', key: 'settings', data: { ku: true }, version: 1 }] });
    assert.strictEqual(r.code, 409);
    assert.deepStrictEqual(r.body.results.map(x => x.status), ['ok', 'konflikt', 'ok']);
    const ds = rpcs.find(x => x.name === 'datensatz_schreiben' && x.args.p_id === 'a').args;
    assert.deepStrictEqual([ds.p_user, ds.p_version, ds.p_datum, ds.p_gesperrt_grund, ds.p_kreis, ds.p_nummer], ['user_1', 2, '2026-03-01', 'storniert', null, null]);
    antwort.datensatz_schreiben = { status: 'ok', version: 1, seq: 5 };
    assert.strictEqual((await call({ action: 'push', company: C, ops: [{ t: 'r', art: 'sales', id: 'a', data: {} }] })).code, 200);

    // Löschen ohne Inhalt: Server-Stand bleibt data
    rpcs = [];
    antwort.datensatz_lesen = { data: { id: 'd', betrag: 5 }, version: 4 };
    r = await call({ action: 'push', company: C, ops: [{ t: 'r', art: 'sales', id: 'd', geloescht: true }] });
    const del = rpcs.find(x => x.name === 'datensatz_schreiben').args;
    assert.deepStrictEqual([del.p_geloescht, del.p_version, del.p_data.betrag], [true, 4, 5]);
    antwort.datensatz_lesen = null;
    r = await call({ action: 'push', company: C, ops: [{ t: 'r', art: 'sales', id: 'nie', geloescht: true }] });
    assert.strictEqual(r.body.results[0].status, 'fehlt');

    // migrate: immer Version null; gleicher Inhalt bei Wiederholung = vorhanden
    rpcs = [];
    antwort.datensatz_schreiben = { status: 'konflikt', version: 1, data: { b: 2, a: 1 } };
    r = await call({ action: 'migrate', company: C, ops: [{ t: 'r', art: 'sales', id: 'm', data: { a: 1, b: 2 }, version: 7 }] });
    assert.strictEqual(r.code, 200);
    assert.strictEqual(r.body.results[0].status, 'vorhanden');
    assert.strictEqual(rpcs.find(x => x.name === 'datensatz_schreiben').args.p_version, null);
    antwort.datensatz_schreiben = { status: 'konflikt', version: 1, data: { a: 9 } };
    assert.strictEqual((await call({ action: 'migrate', company: C, ops: [{ t: 'r', art: 'sales', id: 'm', data: { a: 1 } }] })).code, 409);

    kaputt403 = 'firma_anlegen';
    assert.strictEqual((await call({ action: 'firma_anlegen', company: C, name: 'X' })).code, 403, '42501 → 403');
    kaputt403 = null;

    // migrate_commit: Originaltexte wortgleich als text[]
    const log = kette(3).map(e => JSON.stringify(e));
    rpcs = [];
    antwort.audit_uebernehmen = 3;
    r = await call({ action: 'migrate_commit', company: C, audit: log });
    const au = rpcs.find(x => x.name === 'audit_uebernehmen');
    assert.deepStrictEqual(au.args.p_eintraege, log);
    assert.ok(au.roh.includes(JSON.stringify(log)), 'als JSON-Strings, nicht als Objekte');
    assert.strictEqual(r.body.uebernommen, 3);
    assert.strictEqual((await call({ action: 'migrate_commit', company: C, audit: ['{"ohne":"id"}'] })).code, 400);

    // Abschluss: Kette aus der DB, Prüfsumme gleich → Datenübernahme-Eintrag
    const zeilen = { rows: [{ t: 'r', art: 'sales', id: 's1', data: { b: 1, a: 2 }, geloescht: false },
                            { t: 'r', art: 'sales', id: 's2', data: { x: 1 }, geloescht: true },
                            { t: 's', key: 'settings', data: { ku: true } }], mehr: false, bis: 3, seq: 3 };
    const browserSumme = crypto.createHash('sha256').update(Abbild.pruefzeilen(
        [{ art: 'sales', id: 's1', data: { a: 2, b: 1 } }], [{ key: 'settings', data: { ku: true } }]), 'utf8').digest('hex');
    const kaputteKette = kette(3); kaputteKette[1].details = 'geändert';
    antwort.umzug_stand = { umgezogen_am: null, audit: kaputteKette.map(e => JSON.stringify(e)) };
    antwort.aenderungen_seit = zeilen;
    antwort.umzug_abschliessen = { status: 'ok' };
    rpcs = [];
    r = await call({ action: 'migrate_commit', company: C, abschluss: true, pruefsumme: browserSumme,
                     anker: { enabled: true, total: 3, ok: 3, vollstaendig: true } });
    assert.strictEqual(r.code, 200);
    assert.strictEqual(r.body.status, 'ok');
    assert.deepStrictEqual([r.body.server.records, r.body.server.settings, r.body.kette.broken], [1, 1, 1]);
    const text = rpcs.find(x => x.name === 'umzug_abschliessen').args.p_details;
    assert.ok(text.includes('1 Datensätze') && text.includes('3 Protokolleinträge') && text.includes('Eintrag 2')
              && text.includes(browserSumme) && text.includes('3 von 3 bestätigt'), text);

    rpcs = [];
    r = await call({ action: 'migrate_commit', company: C, abschluss: true, pruefsumme: '0'.repeat(64) });
    assert.strictEqual(r.code, 409);
    assert.strictEqual(r.body.status, 'abweichung');
    assert.ok(!rpcs.some(x => x.name === 'umzug_abschliessen'), 'bei Abweichung kein Datenübernahme-Eintrag');

    antwort.umzug_stand = { umgezogen_am: '2026-10-28T10:00:00Z', audit: [] };
    r = await call({ action: 'migrate_commit', company: C, abschluss: true, pruefsumme: browserSumme });
    assert.strictEqual(r.body.status, 'vorhanden');

    // status / pruefsumme / pull
    antwort.firmen_lesen = [{ id: C, rolle: 'owner', seq: 9 }];
    r = await call({ action: 'status', company: C });
    assert.deepStrictEqual(r.body, { firma: true, rolle: 'owner', seq: 9, umgezogen_am: '2026-10-28T10:00:00Z' });
    assert.deepStrictEqual((await call({ action: 'status', company: 'co_anders' })).body, { firma: false });
    assert.strictEqual((await call({ action: 'pruefsumme', company: C })).body.pruefsumme, browserSumme);
    assert.deepStrictEqual((await call({ action: 'pull' })).body.firmen, antwort.firmen_lesen);
    ok('data: push/migrate/migrate_commit/status/pruefsumme');

    console.log('\n' + pass + '/6 Prüfungen bestanden ✅');
})().catch((e) => { console.error(e); process.exit(1); });
