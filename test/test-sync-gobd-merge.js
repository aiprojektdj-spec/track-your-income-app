// Cloud-Sync-/Backup-Merge erhält GoBD-Zustand (Steuer-Audit 2026-10-18, F7/B7b).
//   node test/test-sync-gobd-merge.js
// Soll: §146 Abs. 4 AO — ein Jahresabschluss geht beim Zusammenführen nicht verloren, eine
// Manipulation am Protokoll bleibt erkennbar, ein festgeschriebener Datensatz wird nicht still
// überschrieben; §14 Abs. 4 Nr. 4 UStG — der Nummernzähler läuft nie rückwärts.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

function makeLS(init) {
    const m = new Map(Object.entries(init || {}));
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); },
        removeItem: k => { m.delete(k); }, key: i => Array.from(m.keys())[i] ?? null, get length() { return m.size; } };
}
const c = ladeModule(['js/utils.js', 'js/steuerstatus.js', 'js/rechnung-summen.js', 'js/store.js', 'js/cloud-sync.js'], {
    localStorage: makeLS({ oyi_companies: JSON.stringify([{ id: 'co_a', name: 'A' }]), oyi_active_company: 'co_a', oyi_device_id: 'dev' }),
    sessionStorage: makeLS(), setTimeout: () => 0, clearTimeout: () => {}, confirm: () => true, navigator: {},
    TextEncoder, crypto: require('crypto').webcrypto, MutationObserver: class { observe() {} },
    document: { body: {}, readyState: 'complete', addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] }
});
c.Utils.showToast = () => {};
const S = c.Store, M = c.CloudSync._test.merge;
S.setCompany('co_a');
S.set('settings', { ustMode: 'regel' });
const k = n => 'co_a__reselling_' + n;
let n = 0; const ok = t => { n++; console.log('✓ ' + t); };

{
    const a = M('co_a', { keys: { [k('closed_years')]: [2025] }, meta: { [k('closed_years')]: 1000 } },
                        { keys: { [k('closed_years')]: [2024] }, meta: { [k('closed_years')]: 2000 } });
    assert.deepStrictEqual(Array.from(a.keys[k('closed_years')]), [2024, 2025]);
    ok('Jahresabschlüsse beider Geräte bleiben erhalten (2024 + 2025)');
}
{
    const z = M('co_a', { keys: { 'co_a__rechnungsbuch_invoice_counter': { _year: 2026, RE: 5, SR: 1 } }, meta: { 'co_a__rechnungsbuch_invoice_counter': 1000 } },
                        { keys: { 'co_a__rechnungsbuch_invoice_counter': { _year: 2026, RE: 3, SR: 2 } }, meta: { 'co_a__rechnungsbuch_invoice_counter': 2000 } });
    const v = z.keys['co_a__rechnungsbuch_invoice_counter'];
    assert.strictEqual(v.RE, 5); assert.strictEqual(v.SR, 2);
    ok('B7b: Nummernzähler je Präfix per Maximum (RE 5, SR 2)');
}
{
    S.saveSale({ datum: '2026-02-01', verkaufspreis: 119, steuersatz: 19 });
    S.saveSale({ datum: '2026-02-02', verkaufspreis: 59, steuersatz: 19 });
    const log = JSON.parse(JSON.stringify(S.getAuditLog()));
    log[0].newValues.verkaufspreis = 11.9;   // nachträgliche Manipulation
    const b = M('co_a', { keys: { 'co_a__audit_log': log }, meta: {} }, { keys: { 'co_a__audit_log': [] }, meta: {} });
    S._cache[S._auditKey] = JSON.stringify(b.keys['co_a__audit_log']);
    const v = S.verifyAuditChain();
    assert.ok(!v.valid && v.broken >= 1, 'Manipulation nach Merge nicht mehr erkennbar');
    ok('Manipulierter Protokolleintrag bleibt nach dem Re-Chaining als Bruch erkennbar');
}
{
    S.set('closed_years', [2025]);
    const lokal = { id: 's1', datum: '2025-06-01', verkaufspreis: 119, steuersatz: 19, updatedAt: 1000 };
    const geaendert = Object.assign({}, lokal, { verkaufspreis: 19, updatedAt: 2000 });
    const cc = M('co_a', { keys: { [k('sales')]: [lokal] }, meta: {} }, { keys: { [k('sales')]: [geaendert] }, meta: {} });
    assert.strictEqual(cc.keys[k('sales')][0].verkaufspreis, 119);
    assert.strictEqual(cc.conflicts.length, 1);
    const storno = Object.assign({}, lokal, { gegengebucht: 'g1', storniertAm: 'x', stornoGrund: 'y', updatedAt: 3000 });
    const sc = M('co_a', { keys: { [k('sales')]: [lokal] }, meta: {} }, { keys: { [k('sales')]: [storno] }, meta: {} });
    assert.strictEqual(sc.keys[k('sales')][0].gegengebucht, 'g1', 'Storno eines anderen Geräts muss durchkommen');
    ok('Festgeschriebener Verkauf: fremde Änderung = Konflikt, fremder Storno wird übernommen');
}
console.log('\n' + n + '/4 Sync-GoBD-Merge-Tests bestanden');
