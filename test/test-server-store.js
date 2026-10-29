// P1 Spiegel (R4, plan/server-umbau-2026-10-22.md):  node test/test-server-store.js
// =============================================================================
// Lädt js/store.js, js/server-abbild.js und js/server-store.js unverändert in einen vm-Kontext,
// ersetzt IndexedDB-Outbox und api/data.js durch Nachbauten im RAM (Versionsprüfung wie
// datensatz_schreiben) und prüft:
//   1. Haken: Store._idbPut/_idbPutAsync/_idbPutBatch/_idbDelete melden den Schlüssel
//   2. Einschalten: firma_anlegen, dann Vollabgleich mit Version null
//   3. Änderung/Löschung: nur der geänderte Datensatz, mit bekannter Version
//   4. Konflikt: Server-Version übernehmen, erneut senden; nach 3 Versuchen Abweichung
//   5. Netzfehler: Op bleibt in der Outbox; gesperrt → Abweichung, Op raus
//   6. Outbox: ein neuerer Stand desselben Datensatzes wird nicht weggelöscht
//   7. Prüfsumme Browser = Server nach dem Spiegeln; nicht eingeschaltete Firma bleibt still
// =============================================================================
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const { ladeModule } = require('./_lade-module.js');

const ls = new Map();
const localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) };

// ── api/data.js im RAM ────────────────────────────────────────────────────────
const srv = { recs: new Map(), sets: new Map(), calls: [], netzWeg: false, erzwinge: null };
const Abbild = require('../js/server-abbild.js');
function pushServer(ops) {
    return ops.map((op) => {
        if (srv.erzwinge && srv.erzwinge(op)) return Object.assign({ t: op.t }, srv.erzwinge(op));
        const map = op.t === 's' ? srv.sets : srv.recs, k = op.t === 's' ? op.key : op.art + '/' + op.id, alt = map.get(k);
        if (op.geloescht && !op.data && !alt) return { status: 'fehlt' };
        if ((alt && op.version !== alt.version) || (!alt && op.version)) return { status: 'konflikt', version: alt ? alt.version : null };
        const data = op.geloescht && !op.data ? alt.data : op.data;
        map.set(k, { art: op.art, id: op.id, key: op.key, data: JSON.parse(JSON.stringify(data)), geloescht: !!op.geloescht, version: alt ? alt.version + 1 : 1 });
        return { status: 'ok', version: map.get(k).version };
    });
}
async function fetch(url, opts) {
    const b = JSON.parse(opts.body);
    srv.calls.push(b);
    if (srv.netzWeg) throw new Error('offline');
    let json = {}, status = 200;
    if (b.action === 'firma_anlegen') json = { status: 'angelegt' };
    else if (b.action === 'push') { json = { results: pushServer(b.ops) }; if (json.results.some((r) => r.status === 'konflikt')) status = 409; }
    else if (b.action === 'pruefsumme') {
        const recs = [...srv.recs.values()], sets = [...srv.sets.values()];
        json = { pruefsumme: crypto.createHash('sha256').update(Abbild.pruefzeilen(recs, sets), 'utf8').digest('hex') };
    }
    return { status, json: async () => json };
}

const ctx = ladeModule(['js/store.js', 'js/server-abbild.js', 'js/server-store.js'], {
    localStorage, fetch, setTimeout: () => 0, clearTimeout: () => {}, crypto: crypto.webcrypto, TextEncoder,
    navigator: { onLine: true }, document: { addEventListener() {}, readyState: 'complete' },
    Companies: { getAll: () => [{ id: 'co_t', name: 'Testfirma', land: 'DE' }] }
});
const { Store, ServerStore } = ctx;

// Outbox/Meta im RAM, gleiche Schnittstelle wie der IndexedDB-Speicher
const kopie = (x) => JSON.parse(JSON.stringify(x));
const mem = { meta: {}, out: {} };
ServerStore._speicher = {
    getMeta: async (c) => (mem.meta[c] ? kopie(mem.meta[c]) : null),
    putMeta: async (c, m) => { mem.meta[c] = kopie(m); },
    alleOps: async () => Object.values(mem.out).map(kopie),
    putOps: async (l) => l.forEach((e) => { mem.out[e.k] = kopie(e); }),
    ersetzeOps: async (l) => l.forEach((e) => { if (mem.out[e.k] && mem.out[e.k].rev === e.rev) mem.out[e.k] = kopie(e); }),
    loescheOps: async (l) => l.forEach((e) => { if (mem.out[e.k] && mem.out[e.k].rev === e.rev) delete mem.out[e.k]; })
};

let pass = 0;
const ok = (m) => { pass++; console.log('✓ ' + m); };
const setze = (k, v) => { Store._cache[k] = JSON.stringify(v); };
const pushes = () => srv.calls.filter((c) => c.action === 'push');
async function lokalGleichServer() {
    const r = await ServerStore.pruefen('co_t');
    assert.ok(r.gleich, 'Prüfsumme Browser = Server: ' + JSON.stringify(r));
}

(async () => {
    // 1. Haken
    ServerStore._dirty.clear();
    localStorage.setItem(ServerStore.LS_FIRMEN, JSON.stringify(['co_t']));
    Store._idbPut('co_t__reselling_sales', '[]');
    Store._idbDelete('co_t__reselling_expenses');
    Store._idbPutAsync('co_t__reselling_brands', '[]').catch(() => {});
    Store._idbPutBatch([{ k: 'co_t__rechnungsbuch_invoices', v: '[]' }]);
    Store._idbPut('co_anders__reselling_sales', '[]');
    Store._idbPut('co_t__audit_log', '[]');
    assert.deepStrictEqual([...ServerStore._dirty].sort(),
        ['co_t__rechnungsbuch_invoices', 'co_t__reselling_brands', 'co_t__reselling_expenses', 'co_t__reselling_sales']);
    ServerStore._dirty.clear();
    localStorage.removeItem(ServerStore.LS_FIRMEN);
    ok('Haken in _idbPut/_idbPutAsync/_idbPutBatch/_idbDelete, nur eingeschaltete Firma, kein audit_log');

    // 2. Einschalten
    Store._cache = {};
    setze('co_t__reselling_sales', [{ id: 's1', datum: '2026-01-05', preis: 10 }, { id: 's2', preis: 20 }]);
    setze('co_t__reselling_settings', { ku: true });
    setze('co_t__rechnungsbuch_invoice_counter', 7);
    setze('co_t__audit_log', [{ id: 'a1' }]);
    setze('co_fremd__reselling_sales', [{ id: 'x' }]);
    await ServerStore.spiegelEin('co_t');
    assert.strictEqual(srv.calls[0].action, 'firma_anlegen');
    assert.strictEqual(srv.calls[0].name, 'Testfirma');
    const erst = pushes()[0];
    assert.deepStrictEqual(erst.ops.map((o) => ServerStore._opKey(o)).sort(), ['r/sales/s1', 'r/sales/s2', 's/rech_invoice_counter', 's/settings']);
    assert.ok(erst.ops.every((o) => o.version === null));
    assert.strictEqual(Object.keys(mem.out).length, 0, 'Outbox leer');
    await lokalGleichServer();
    ok('Einschalten: firma_anlegen + Vollabgleich, Prüfsumme gleich');

    // 3. Änderung und Löschung
    srv.calls = [];
    setze('co_t__reselling_sales', [{ id: 's1', datum: '2026-01-05', preis: 11 }]);
    ServerStore.notiere('co_t__reselling_sales');
    await ServerStore.verarbeite();
    const ops = pushes()[0].ops;
    assert.deepStrictEqual(ops.map((o) => [ServerStore._opKey(o), o.version, !!o.geloescht]), [['r/sales/s1', 1, false], ['r/sales/s2', 1, true]]);
    assert.ok(!ops[1].data, 'Löschung ohne Inhalt');
    srv.calls = [];
    await ServerStore.verarbeite();
    assert.strictEqual(pushes().length, 0, 'nichts geändert → nichts gesendet');
    await lokalGleichServer();
    ok('nur geänderte Datensätze, mit bekannter Version; Löschung als geloescht');

    // 4. Konflikt (anderes Gerät hat geschrieben)
    srv.recs.get('sales/s1').version = 5;
    setze('co_t__reselling_sales', [{ id: 's1', datum: '2026-01-05', preis: 12 }]);
    ServerStore.notiere('co_t__reselling_sales');
    await ServerStore.verarbeite();
    assert.strictEqual(Object.keys(mem.out).length, 1, 'nach Konflikt noch in der Outbox');
    await ServerStore.verarbeite();
    assert.strictEqual(Object.keys(mem.out).length, 0);
    assert.strictEqual(srv.recs.get('sales/s1').data.preis, 12);
    assert.strictEqual(srv.recs.get('sales/s1').version, 6);
    srv.erzwinge = (op) => op.id === 's1' && { status: 'konflikt', version: 9 };
    setze('co_t__reselling_sales', [{ id: 's1', datum: '2026-01-05', preis: 13 }]);
    ServerStore.notiere('co_t__reselling_sales');
    for (let i = 0; i < 5; i++) await ServerStore.verarbeite();
    assert.strictEqual(Object.keys(mem.out).length, 0, 'nach 3 Versuchen aufgegeben');
    assert.ok(/r\/sales\/s1: konflikt/.test(localStorage.getItem(ServerStore.LS_ABWEICHUNG)));
    srv.erzwinge = null;
    await ServerStore.abgleich('co_t');
    await ServerStore.verarbeite();
    assert.strictEqual(srv.recs.get('sales/s1').data.preis, 13, 'aufgegebener Konflikt geht beim nächsten Abgleich erneut raus');
    ok('Konflikt: Server-Version übernehmen und erneut senden, nach 3 Versuchen Abweichung');

    // 5. Netzfehler und gesperrt
    srv.netzWeg = true;
    setze('co_t__reselling_settings', { ku: false });
    ServerStore.notiere('co_t__reselling_settings');
    await ServerStore.verarbeite();
    assert.strictEqual(Object.keys(mem.out).length, 1, 'offline: bleibt');
    srv.netzWeg = false;
    await ServerStore.verarbeite();
    assert.strictEqual(Object.keys(mem.out).length, 0);
    assert.strictEqual(srv.sets.get('settings').data.ku, false);
    srv.erzwinge = (op) => op.id === 's9' && { status: 'gesperrt', grund: 'GoBD' };
    setze('co_t__reselling_sales', [{ id: 's1', datum: '2026-01-05', preis: 13 }, { id: 's9' }]);
    ServerStore.notiere('co_t__reselling_sales');
    await ServerStore.verarbeite();
    assert.strictEqual(Object.keys(mem.out).length, 0);
    assert.ok(/r\/sales\/s9: gesperrt \(GoBD\)/.test(localStorage.getItem(ServerStore.LS_ABWEICHUNG)));
    srv.erzwinge = null;
    ok('Netzfehler: Op bleibt; gesperrt → Abweichung');

    // 6. Neuerer Stand während des Sendens
    mem.out['co_t|r/sales/s1'] = { k: 'co_t|r/sales/s1', rev: 999, op: {} };
    await ServerStore._speicher.loescheOps([{ k: 'co_t|r/sales/s1', rev: 998 }]);
    await ServerStore._speicher.ersetzeOps([{ k: 'co_t|r/sales/s1', rev: 998, op: { alt: 1 } }]);
    assert.strictEqual(mem.out['co_t|r/sales/s1'].rev, 999);
    delete mem.out['co_t|r/sales/s1'];
    ok('Outbox: neuerer Stand bleibt stehen');

    // 7. Abgleich nach Fremdschreibung + fremde Firma still
    srv.calls = [];
    setze('co_t__eigenbelege_belege', [{ id: 'e1', betrag: 3 }]);   // z. B. aus eigenbelege/index.html
    setze('co_fremd__reselling_sales', [{ id: 'y' }]);
    ServerStore.notiere('co_fremd__reselling_sales');
    await ServerStore.abgleich('co_t');
    assert.deepStrictEqual(pushes().flatMap((p) => p.ops.map((o) => ServerStore._opKey(o))), ['r/eb_belege/e1']);
    assert.ok(!srv.calls.some((c) => c.company === 'co_fremd'));
    Store._cache['co_t__reselling_sales'] = JSON.stringify([{ id: 's1', datum: '2026-01-05', preis: 13 }]);
    ServerStore.notiere('co_t__reselling_sales');
    await ServerStore.verarbeite();
    await lokalGleichServer();
    ok('Abgleich holt Fremdschreibungen nach; nicht eingeschaltete Firma wird nie gesendet');

    console.log('\n' + pass + '/7 Prüfungen bestanden ✅');
})().catch((e) => { console.error(e); process.exit(1); });
