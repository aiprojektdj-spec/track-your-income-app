// Server führt (R6, P2, plan/server-umbau-2026-10-22.md):  node test/test-server-fuehrt.js
// =============================================================================
// Zwei Geräte (je ein vm-Kontext mit echtem js/store.js, js/server-abbild.js, js/server-store.js,
// eigenem Cache, localStorage und Outbox) an einem gemeinsamen Server-Nachbau (Versionen, seq,
// jsonb ordnet Schlüssel um). Geprüft:
//   1. Gerät B holt den Stand von A: gleiche Daten, gleiche Listenreihenfolge (ord__<art>)
//   2. Änderung auf A kommt bei B an, B behält seine Schlüsselreihenfolge (Datensatz-Prüfsumme)
//   3. Konflikt: der Server-Stand gilt und wird lokal übernommen
//   4. Umsortieren und Löschen kommen an
//   5. unversendete lokale Änderung wird vom Holen nicht überschrieben
//   6. offline → Store._isReadonlyCompany(), nur in serverführender Firma
//   7. Cloud-Sync lässt serverführende Firmen aus
// =============================================================================
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ladeModule } = require('./_lade-module.js');
const Abbild = require('../js/server-abbild.js');

// ── Server ────────────────────────────────────────────────────────────────────
const umgeordnet = (o) => (o && typeof o === 'object' && !Array.isArray(o))
    ? Object.keys(o).sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).reduce((x, k) => (x[k] = umgeordnet(o[k]), x), {})
    : Array.isArray(o) ? o.map(umgeordnet) : o;
const S = { seq: 0, rows: new Map(), fuehrt: false };
function schreibe(op) {
    const k = op.t === 's' ? 's/' + op.key : 'r/' + op.art + '/' + op.id, alt = S.rows.get(k);
    if ((alt && op.version !== alt.version) || (!alt && op.version)) return { status: 'konflikt', version: alt ? alt.version : null, data: alt ? alt.data : null };
    if (op.geloescht && !op.data && !alt) return { status: 'fehlt' };
    const data = umgeordnet(op.geloescht && !op.data ? alt.data : op.data);
    const z = { t: op.t, art: op.art, id: op.id, key: op.key, data, version: alt ? alt.version + 1 : 1, geloescht: !!op.geloescht, seq: ++S.seq };
    S.rows.set(k, z);
    return { status: 'ok', version: z.version, seq: z.seq };
}
function server(b) {
    if (b.action === 'firma_anlegen') return { status: 'vorhanden' };
    if (b.action === 'status') return { firma: true, rolle: 'owner', server_fuehrt: S.fuehrt };
    if (b.action === 'modus') { S.fuehrt = b.server_fuehrt; return { server_fuehrt: S.fuehrt }; }
    if (b.action === 'push') return { results: b.ops.map(schreibe) };
    if (b.action === 'changes') {
        const rows = [...S.rows.values()].filter((z) => z.seq > b.seq).sort((x, y) => x.seq - y.seq).map((z) => JSON.parse(JSON.stringify(z)));
        return { seq: S.seq, bis: rows.length ? rows[rows.length - 1].seq : b.seq, mehr: false, rows };
    }
    if (b.action === 'pruefsumme') {
        const all = [...S.rows.values()];
        return { pruefsumme: crypto.createHash('sha256').update(Abbild.pruefzeilen(all.filter((z) => z.t === 'r'), all.filter((z) => z.t === 's')), 'utf8').digest('hex') };
    }
    throw new Error('Aktion ' + b.action);
}

// ── Geräte ────────────────────────────────────────────────────────────────────
const kopie = (x) => JSON.parse(JSON.stringify(x));
function geraet() {
    const ls = new Map(), mem = { meta: {}, out: {} }, toasts = [], nav = { onLine: true };
    const ctx = ladeModule(['js/store.js', 'js/server-abbild.js', 'js/server-store.js'], {
        localStorage: { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) },
        fetch: async (url, o) => {
            const b = JSON.parse(o.body), json = server(b);
            const status = b.action === 'push' && json.results.some((r) => r.status === 'konflikt') ? 409 : 200;
            return { status, json: async () => json };
        },
        setTimeout: () => 0, clearTimeout: () => {}, crypto: crypto.webcrypto, TextEncoder, navigator: nav,
        document: { addEventListener() {}, readyState: 'complete' },
        Companies: { getAll: () => [{ id: 'co_f', name: 'Firma', land: 'DE' }] },
        Utils: { showToast: (t) => toasts.push(t) }
    });
    ctx.ServerStore._speicher = {
        getMeta: async (c) => (mem.meta[c] ? kopie(mem.meta[c]) : null), putMeta: async (c, m) => { mem.meta[c] = kopie(m); },
        alleOps: async () => Object.values(mem.out).map(kopie), putOps: async (l) => l.forEach((e) => { mem.out[e.k] = kopie(e); }),
        ersetzeOps: async (l) => l.forEach((e) => { if (mem.out[e.k] && mem.out[e.k].rev === e.rev) mem.out[e.k] = kopie(e); }),
        loescheOps: async (l) => l.forEach((e) => { if (mem.out[e.k] && mem.out[e.k].rev === e.rev) delete mem.out[e.k]; })
    };
    ctx.Store._cache = {};
    ctx.Store._companyId = 'co_f';
    return { ctx, Store: ctx.Store, SS: ctx.ServerStore, toasts, mem, nav };
}
const A = geraet(), B = geraet();
const liste = (g) => JSON.parse(g.Store._cache['co_f__reselling_sales'] || '[]');
const ids = (g) => liste(g).map((x) => x.id).join(',');
async function aendere(g, fn) {
    const l = liste(g); fn(l);
    g.Store._cache['co_f__reselling_sales'] = JSON.stringify(l);
    g.SS.notiere('co_f__reselling_sales');
    await g.SS.verarbeite();
}
let pass = 0;
const ok = (m) => { pass++; console.log('✓ ' + m); };

(async () => {
    // 1. A legt an und schaltet „Server führt“ ein, B holt
    A.Store._cache['co_f__reselling_sales'] = JSON.stringify([
        { id: 's3', preis: 30, datum: '2026-01-03' }, { id: 's1', preis: 10, datum: '2026-01-01' }, { id: 's2', preis: 20, datum: '2026-01-02' }]);
    A.Store._cache['co_f__reselling_settings'] = JSON.stringify({ ku: true });
    await A.SS.spiegelEin('co_f');
    await A.SS.serverFuehrt('co_f', true);
    assert.ok(A.SS.fuehrt('co_f'));
    await B.SS.spiegelEin('co_f');
    B.SS._setzeFuehrt('co_f', true);
    await B.SS.hole('co_f', false);
    assert.strictEqual(ids(B), 's3,s1,s2', 'Reihenfolge wie auf A');
    assert.strictEqual(Abbild.kanonisch(liste(B)), Abbild.kanonisch(liste(A)));
    assert.strictEqual(JSON.parse(B.Store._cache['co_f__reselling_settings']).ku, true);
    assert.strictEqual(Object.keys(B.mem.out).length, 0, 'B schickt den geholten Stand nicht zurück');
    assert.ok((await B.SS.pruefen('co_f')).gleich && (await A.SS.pruefen('co_f')).gleich);
    ok('Gerät B holt den Stand von A, gleiche Reihenfolge, nichts zurückgeschickt');

    // 2. Änderung auf A → B, Schlüsselreihenfolge auf B bleibt
    const vorher = Object.keys(liste(B).find((x) => x.id === 's1'));
    await aendere(A, (l) => { l.find((x) => x.id === 's1').preis = 11; });
    const r = await B.SS.hole('co_f', false);
    assert.strictEqual(JSON.stringify(r.geaendert), '["co_f__reselling_sales"]');
    const s1 = liste(B).find((x) => x.id === 's1');
    assert.strictEqual(s1.preis, 11);
    assert.strictEqual(JSON.stringify(Object.keys(s1)), JSON.stringify(vorher), 'Schlüsselreihenfolge wie lokal');
    assert.ok(B.toasts.some((t) => /anderen Gerät/.test(t)));
    ok('Änderung kommt an, lokale Schlüsselreihenfolge bleibt');

    // 3. Konflikt: B schreibt zuerst, A mit altem Stand → Server-Stand gilt auf A
    await aendere(B, (l) => { l.find((x) => x.id === 's2').preis = 22; });
    await aendere(A, (l) => { l.find((x) => x.id === 's2').preis = 99; });
    assert.strictEqual(liste(A).find((x) => x.id === 's2').preis, 22, 'A übernimmt den Server-Stand');
    assert.strictEqual(S.rows.get('r/sales/s2').data.preis, 22);
    assert.ok(A.toasts.some((t) => /Server-Stand übernommen/.test(t)));
    assert.strictEqual(Object.keys(A.mem.out).length, 0);
    ok('Konflikt: Server-Stand gilt und wird lokal übernommen');

    // 4. Umsortieren und Löschen
    await aendere(A, (l) => { l.reverse(); });
    await B.SS.hole('co_f', false);
    assert.strictEqual(ids(B), 's2,s1,s3');
    await aendere(A, (l) => { l.splice(l.findIndex((x) => x.id === 's1'), 1); });
    await B.SS.hole('co_f', false);
    assert.strictEqual(ids(B), 's2,s3');
    assert.ok((await B.SS.pruefen('co_f')).gleich);
    ok('Umsortieren und Löschen kommen an');

    // 5. unversendete lokale Änderung bleibt beim Holen stehen
    B.Store._cache['co_f__reselling_sales'] = JSON.stringify(liste(B).map((x) => x.id === 's3' ? Object.assign({}, x, { preis: 33 }) : x));
    B.SS.notiere('co_f__reselling_sales');
    B.SS._dirty.forEach((k) => B.SS._diff(B.SS._meta.co_f, k, 'sales', []));   // in die Basis, …
    await B.SS._speicher.putOps([{ k: 'co_f|r/sales/s3', company: 'co_f', op: { t: 'r', art: 'sales', id: 's3', data: liste(B).find((x) => x.id === 's3') }, rev: 1, versuche: 0 }]);
    B.SS._dirty.clear();                                                         // … aber noch nicht gesendet
    await aendere(A, (l) => { l.find((x) => x.id === 's3').notiz = 'von A'; });
    await B.SS._uebernehme('co_f', [...S.rows.values()].filter((z) => z.id === 's3').map(kopie), B.SS._meta.co_f);
    assert.strictEqual(liste(B).find((x) => x.id === 's3').preis, 33, 'lokale Änderung nicht überschrieben');
    ok('unversendete lokale Änderung wird vom Holen nicht überschrieben');

    // 6. offline nur lesen
    assert.strictEqual(A.Store._isReadonlyCompany(), false);
    A.nav.onLine = false;
    assert.strictEqual(A.Store._isReadonlyCompany(), true);
    A.SS._setzeFuehrt('co_f', false);
    assert.strictEqual(A.Store._isReadonlyCompany(), false, 'nur serverführende Firma');
    A.SS._setzeFuehrt('co_f', true); A.nav.onLine = true;
    ok('offline → nur lesen, nur in serverführender Firma');

    // 7. Cloud-Sync lässt serverführende Firmen aus
    const cs = fs.readFileSync(path.join(__dirname, '..', 'js', 'cloud-sync.js'), 'utf8');
    assert.ok(/zuSyncen = companies\.filter\([\s\S]{0,200}ServerStore\.fuehrt\(c\.id\)/.test(cs));
    ok('Cloud-Sync lässt serverführende Firmen aus');

    console.log('\n' + pass + '/7 Prüfungen bestanden ✅');
})().catch((e) => { console.error(e); process.exit(1); });
