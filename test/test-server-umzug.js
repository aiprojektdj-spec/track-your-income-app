// Umzug in die Stackr-Cloud (R5, plan/server-umbau-2026-10-22.md §3):  node test/test-server-umzug.js
// =============================================================================
// Durchstich ohne Datenbank: js/server-umzug.js (vm-Kontext, mit echtem js/store.js,
// js/server-abbild.js, js/server-store.js) → echtes api/data.js → nachgebaute Datenfunktionen
// (jsonb ordnet Schlüssel um, audit_uebernehmen speichert den Text, umzug_* wie in
// 20261028000001_server_umzug.sql). Geprüft:
//   1. ohne Testschalter keine Anfrage; ohne Bestätigung kein Upload
//   2. Dialog: Bestätigung + Start nur mit Daten; leer → Cloud-Sync bzw. Backup-Import
//   3. Umzug in Stücken, Protokoll wortgleich auf dem Server, Kette und Prüfsumme vom Server
//      geprüft, Datenübernahme-Eintrag mit Zahlen und SHA-256, danach Spiegel ohne Nachsenden
//   4. Wiederholung: 'vorhanden', kein zweiter Eintrag
//   5. Kettenbruch: Umzug läuft, Bruch steht im Eintrag
//   6. vorhandener Datensatz mit anderem Inhalt → push mit Server-Version
//   7. zu großer Datensatz / Prüfsummen-Abweichung → kein Datenübernahme-Eintrag
// =============================================================================
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const { ladeModule } = require('./_lade-module.js');

// ── Datenbank-Nachbau (nur was api/data.js aufruft) ────────────────────────────
const umgeordnet = (o) => (o && typeof o === 'object' && !Array.isArray(o))
    ? Object.keys(o).reverse().reduce((x, k) => (x[k] = umgeordnet(o[k]), x), {}) : Array.isArray(o) ? o.map(umgeordnet) : o;
const DB = { firmen: {}, rpcs: [], verfaelsche: null };
function firma(c) { return DB.firmen[c] || (DB.firmen[c] = { recs: new Map(), sets: new Map(), audit: [], umzug: null, eintraege: [] }); }
const RPC = {
    sync_auth_cache_get: () => ({ user_id: 'u1', pro: true }),
    firmen_lesen: () => Object.keys(DB.firmen).map((id) => ({ id, rolle: 'owner', seq: 1 })),
    firma_anlegen: (a) => (DB.firmen[a.p_company] ? { status: 'vorhanden' } : (firma(a.p_company), { status: 'angelegt' })),
    datensatz_schreiben: (a) => {
        const f = firma(a.p_company), k = a.p_art + '/' + a.p_id, alt = f.recs.get(k);
        if ((alt && a.p_version !== alt.version) || (!alt && a.p_version != null)) return { status: 'konflikt', version: alt ? alt.version : null, data: alt ? alt.data : null };
        let data = umgeordnet(a.p_data);
        if (DB.verfaelsche) data = DB.verfaelsche(data);
        f.recs.set(k, { art: a.p_art, id: a.p_id, data, version: alt ? alt.version + 1 : 1, geloescht: a.p_geloescht });
        return { status: 'ok', version: f.recs.get(k).version };
    },
    einstellung_schreiben: (a) => {
        const f = firma(a.p_company), alt = f.sets.get(a.p_key);
        if ((alt && a.p_version !== alt.version) || (!alt && a.p_version != null)) return { status: 'konflikt', version: alt ? alt.version : null, data: alt ? alt.data : null };
        f.sets.set(a.p_key, { key: a.p_key, data: umgeordnet(a.p_data), version: alt ? alt.version + 1 : 1 });
        return { status: 'ok', version: f.sets.get(a.p_key).version };
    },
    datensatz_lesen: () => null,
    audit_uebernehmen: (a) => {
        const f = firma(a.p_company); let n = 0;
        a.p_eintraege.forEach((t) => { const id = JSON.parse(t).id; if (!f.audit.some((x) => JSON.parse(x).id === id)) { f.audit.push(t); n++; } });
        return n;
    },
    umzug_stand: (a) => ({ umgezogen_am: firma(a.p_company).umzug, audit: a.p_mit_audit ? firma(a.p_company).audit.slice() : null }),
    umzug_abschliessen: (a) => {
        const f = firma(a.p_company);
        if (f.umzug) return { status: 'vorhanden' };
        f.umzug = '2026-10-29T10:00:00Z'; f.eintraege.push(a.p_details);
        return { status: 'ok' };
    },
    aenderungen_seit: (a) => {
        const f = firma(a.p_company);
        const rows = [...f.recs.values()].map((r) => Object.assign({ t: 'r' }, r)).concat([...f.sets.values()].map((s) => Object.assign({ t: 's' }, s)));
        return { seq: 1, bis: 1, mehr: false, rows };
    }
};
process.env.SUPABASE_URL = 'http://sb.mock';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
for (const k of ['STORAGE_BACKEND', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) delete process.env[k];
global.fetch = async (url, opts) => {
    const name = url.split('/').pop(), args = JSON.parse(opts.body);
    DB.rpcs.push({ name, args });
    const v = RPC[name](args);
    return { ok: true, status: 200, text: async () => (v == null ? '' : JSON.stringify(v)) };
};
const handler = require('../api/data.js');

// ── Browser ─────────────────────────────────────────────────────────────────
const ls = new Map();
const localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) };
ls.set('whop_access_token', 'tok');
const browserAufrufe = [];
async function browserFetch(url, opts) {
    const body = JSON.parse(opts.body);
    browserAufrufe.push(body);
    const res = { code: 0, body: null, setHeader() {} };
    res.status = (c) => { res.code = c; return { json: (b) => { res.body = b; }, end: () => {} }; };
    await handler({ method: 'POST', headers: { authorization: opts.headers.Authorization }, body: JSON.parse(JSON.stringify(body)) }, res);
    return { status: res.code, json: async () => res.body };
}
const modale = [];
const ctx = ladeModule(['js/store.js', 'js/server-abbild.js', 'js/server-store.js', 'js/server-umzug.js'], {
    localStorage, fetch: browserFetch, setTimeout: () => 0, clearTimeout: () => {}, crypto: crypto.webcrypto, TextEncoder,
    navigator: { onLine: true }, document: { addEventListener() {}, readyState: 'complete', getElementById: () => null },
    Companies: { getAll: () => ['co_u', 'co_v', 'co_w', 'co_x', 'co_y', 'co_leer'].map((id) => ({ id, name: 'Firma ' + id, land: 'DE' })) },
    App: { showModal: (t, b) => modale.push({ t, b }), closeModal() {} }
});
const { Store, ServerStore, ServerUmzug } = ctx;
const mem = { meta: {}, out: {} };
const kopie = (x) => JSON.parse(JSON.stringify(x));
ServerStore._speicher = {
    getMeta: async (c) => (mem.meta[c] ? kopie(mem.meta[c]) : null), putMeta: async (c, m) => { mem.meta[c] = kopie(m); },
    alleOps: async () => Object.values(mem.out).map(kopie), putOps: async (l) => l.forEach((e) => { mem.out[e.k] = kopie(e); }),
    ersetzeOps: async (l) => l.forEach((e) => { if (mem.out[e.k] && mem.out[e.k].rev === e.rev) mem.out[e.k] = kopie(e); }),
    loescheOps: async (l) => l.forEach((e) => { if (mem.out[e.k] && mem.out[e.k].rev === e.rev) delete mem.out[e.k]; })
};
Store._cache = {};

// Firma mit Daten und echtem Protokoll (Store._addAuditEntry)
function befuelle(c) {
    Store._companyId = c;
    Store._cache[c + '__reselling_sales'] = JSON.stringify([{ id: 's1', datum: '2026-01-05', preis: 10, notiz: 'Größe M' }, { id: 's2', preis: 20, storniert: true }, { id: 's3', preis: 30 }]);
    Store._cache[c + '__reselling_settings'] = JSON.stringify({ ku: true, satz: 19 });
    Store._cache[c + '__eigenbelege_belege'] = JSON.stringify([{ id: 'e1', foto: 'data:image/png;base64,' + 'A'.repeat(500) }]);
    Store._addAuditEntry('create', 'sale', 's1', null, { preis: 10 });
    Store._addAuditEntry('update', 'sale', 's1', { preis: 9 }, { preis: 10, text: 'äöü "x"' });
    Store._addAuditEntry('storno', 'sale', 's2', null, null, 'Storno');
}
let pass = 0;
const ok = (m) => { pass++; console.log('✓ ' + m); };

(async () => {
    // 1. Schalter und Bestätigung
    befuelle('co_u');
    assert.strictEqual(await ServerUmzug.pruefe(), null);
    assert.strictEqual(browserAufrufe.length, 0, 'ohne Testschalter keine Anfrage');
    ServerUmzug._bestaetigt = false;
    assert.strictEqual(JSON.stringify((await ServerUmzug.starte()).fehler), '["Bestätigung fehlt"]');
    assert.strictEqual(browserAufrufe.length, 0, 'ohne Bestätigung kein Upload');
    ok('ohne Testschalter keine Anfrage, ohne Bestätigung kein Upload');

    // 2. Dialog
    localStorage.setItem(ServerUmzug.LS_SCHALTER, '1');
    await ServerUmzug.pruefe();
    let d = modale.pop();
    assert.strictEqual(d.t, 'Umzug in die Stackr-Cloud');
    assert.ok(d.b.includes('4 Datensätze') && d.b.includes('3 Protokolleinträge'));
    assert.ok(d.b.includes('data-action-change="umzug-bestaetigen"') && /data-action="umzug-start" disabled/.test(d.b));
    assert.ok(d.b.includes('Supabase') && d.b.includes('Vercel') && d.b.includes('Lesbar auf dem Server'));
    Store._companyId = 'co_leer';
    ServerUmzug.dialog();
    d = modale.pop();
    assert.ok(d.b.includes('umzug-backup') && !d.b.includes('umzug-start'));
    localStorage.setItem('oyi_sync_enabled', '1'); ctx.CloudSync = { hasKey: () => true };
    ServerUmzug.dialog();
    assert.ok(modale.pop().b.includes('umzug-cloudsync'));
    localStorage.removeItem('oyi_sync_enabled'); delete ctx.CloudSync;
    ok('Dialog: Hinweise + Bestätigung; leer → Cloud-Sync bzw. Backup-Import');

    // 3. Umzug
    Store._companyId = 'co_u';
    ServerUmzug.MAX_OPS = 2;
    ServerUmzug.MAX_AUDIT = 2;
    ServerUmzug.bestaetigen({ checked: true });
    browserAufrufe.length = 0;
    let e = await ServerUmzug.starte();
    assert.ok(e.ok, JSON.stringify(e));
    assert.strictEqual(browserAufrufe.filter((b) => b.action === 'migrate').length, 3, '5 Ops in Stücken zu 2');
    assert.strictEqual(browserAufrufe.filter((b) => b.action === 'migrate_commit' && b.audit).length, 2, '3 Einträge in Stücken zu 2');
    const roh = Store._cache['co_u__audit_log'];
    assert.strictEqual('[' + DB.firmen.co_u.audit.join(',') + ']', roh, 'Protokoll wortgleich');
    assert.strictEqual(DB.firmen.co_u.eintraege.length, 1);
    const text = DB.firmen.co_u.eintraege[0];
    assert.ok(text.includes('4 Datensätze, 1 Einstellungen, 3 Protokolleinträge; Kette intakt') && text.includes(e.pruefsumme), text);
    assert.strictEqual(DB.firmen.co_u.recs.get('sales/s2').data.storniert, true);
    assert.ok(ServerStore.aktiv('co_u'));
    browserAufrufe.length = 0;
    await ServerStore.abgleich('co_u');
    assert.strictEqual(browserAufrufe.filter((b) => b.action === 'push').length, 0, 'Spiegel kennt den Stand schon');
    assert.ok((await ServerStore.pruefen('co_u')).gleich);
    ok('Umzug in Stücken, Protokoll wortgleich, Datenübernahme-Eintrag, Spiegel ohne Nachsenden');

    // 4. Wiederholung
    e = await ServerUmzug.starte();
    assert.ok(e.ok);
    assert.strictEqual(DB.firmen.co_u.eintraege.length, 1, 'kein zweiter Eintrag');
    ok('Wiederholung: vorhanden, kein zweiter Eintrag');

    // 5. Kettenbruch
    befuelle('co_v');
    const log = JSON.parse(Store._cache['co_v__audit_log']); log[1].details = 'nachträglich geändert';
    Store._cache['co_v__audit_log'] = JSON.stringify(log);
    e = await ServerUmzug.starte();
    assert.ok(e.ok);
    assert.ok(/Kette mit 1 Brüchen \(Eintrag 2\)/.test(DB.firmen.co_v.eintraege[0]), DB.firmen.co_v.eintraege[0]);
    ok('Kettenbruch: Umzug läuft, Bruch im Eintrag');

    // 6. abgebrochener Umzug, danach weitergearbeitet
    befuelle('co_w');
    RPC.firma_anlegen({ p_company: 'co_w' });
    RPC.datensatz_schreiben({ p_company: 'co_w', p_art: 'sales', p_id: 's1', p_data: { id: 's1', preis: 1 }, p_version: null });
    e = await ServerUmzug.starte();
    assert.ok(e.ok, JSON.stringify(e));
    assert.strictEqual(DB.firmen.co_w.recs.get('sales/s1').data.preis, 10);
    assert.strictEqual(DB.firmen.co_w.recs.get('sales/s1').version, 2);
    ok('vorhandener Datensatz mit anderem Inhalt → push mit Server-Version');

    // 7. zu groß / Prüfsumme weicht ab
    befuelle('co_x');
    ServerUmzug.MAX_BYTES = 200;
    e = await ServerUmzug.starte();
    assert.ok(!e.ok && /r\/eb_belege\/e1 ist größer als 3,5 MB/.test(e.fehler[0]), JSON.stringify(e));
    assert.ok(!DB.firmen.co_x || !DB.firmen.co_x.recs.size, 'nichts übertragen');
    ServerUmzug.MAX_BYTES = 3.5 * 1024 * 1024;
    befuelle('co_y');
    DB.verfaelsche = (data) => (data.preis === 30 ? Object.assign({}, data, { preis: 31 }) : data);
    e = await ServerUmzug.starte();
    DB.verfaelsche = null;
    assert.ok(!e.ok && /Prüfsumme weicht ab/.test(e.fehler[0]), JSON.stringify(e));
    assert.strictEqual(DB.firmen.co_y.eintraege.length, 0, 'kein Datenübernahme-Eintrag');
    assert.strictEqual(modale.pop().t, 'Umzug nicht abgeschlossen');
    ok('zu großer Datensatz / Prüfsummen-Abweichung → kein Datenübernahme-Eintrag');

    console.log('\n' + pass + '/7 Prüfungen bestanden ✅');
})().catch((err) => { console.error(err); process.exit(1); });
