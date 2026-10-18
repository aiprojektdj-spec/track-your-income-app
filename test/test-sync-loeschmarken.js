// Regression Audit 2026-10-13, L6/L7 — Löschungen konvergieren über Firmen und Geräte.
//
// L6: Der Merge las die Löschmarken der AKTIVEN Firma statt der synchronisierten.
// L7: Eine Remote-Löschmarke wurde nicht auf lokalen Altbestand angewandt; das Gerät behielt die
//     gelöschte Ausgabe und lud sie wieder hoch (remoteDirty).
//
// Echter Code: CloudSync._test.merge aus js/cloud-sync.js (der vollständige Scope-Merge).
// Simuliert: Geräte als lokale Snapshots { keys, meta }, die Cloud als ein Snapshot. Kein API-,
// Krypto- oder Netzpfad — ein Ende-zu-Ende-Test mit echten Geräten ist das nicht.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

let fail = 0, pass = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}

// Store-Attrappe: aktive Firma A — ihr isTombstoned() kennt NUR A's Marken.
const tombsA = [];
const ctx = ladeModule(['js/cloud-sync.js'], {
    Store: { _cache: {}, isTombstoned: (t, id) => tombsA.some(x => x.entityType === t && x.entityId === id),
             _calcChecksum: s => String(s.length) },
    navigator: {}, location: { hostname: 'x', origin: 'x' },
    document: { addEventListener() {}, getElementById: () => null }
});
const merge = (scope, local, remote) => ctx.CloudSync._test.merge(scope, local, remote);

const B = 'co_B';
const K = k => B + '__reselling_' + k;
const ausgabe = (id, updatedAt) => ({ id, datum: '2026-04-01', betrag: 100, kategorie: 'Büro', updatedAt });
const marke = (id, deletedAt) => ({ id: 'ausgabe:' + id, entityType: 'ausgabe', entityId: id, deletedAt, updatedAt: deletedAt });
const snap = (expenses, tombstones) => {
    const keys = { [K('expenses')]: expenses };
    if (tombstones) keys[K('tombstones')] = tombstones;
    return { keys, meta: {} };
};
const ids = r => (r.keys[K('expenses')] || []).map(x => x.id).sort().join(',');

check('L6: Firma A aktiv, Merge für Firma B — B-Löschmarke verhindert Wiederkehr der B-Ausgabe', () => {
    const local = snap([], [marke('e1', 2000)]);       // auf diesem Gerät in B gelöscht
    const remote = snap([ausgabe('e1', 1000)], []);     // Cloud hat den Altbestand
    const r = merge(B, local, remote);
    assert.strictEqual(ids(r), '', 'e1 kehrt nicht zurück');
    assert.strictEqual(r.remoteDirty, true, 'Cloud wird bereinigt');
});

check('L7: A löscht, B mit Altbestand kommt online — kein Behalten, kein Wiederhochladen', () => {
    const remote = snap([], [marke('e1', 2000)]);       // A hat gelöscht und gepusht
    const lokalB = snap([ausgabe('e1', 1000)], []);     // B kennt die Marke noch nicht
    const r = merge(B, lokalB, remote);
    assert.strictEqual(ids(r), '', 'e1 lokal entfernt');
    assert.strictEqual(r.localDirty, true, 'lokal anzuwenden');
    assert.strictEqual(r.remoteDirty, false, 'nichts erneut hochzuladen');
});

check('L7: auch wenn B die Marke schon kennt, aber den Datensatz noch hat', () => {
    const r = merge(B, snap([ausgabe('e1', 1000)], [marke('e1', 2000)]), snap([], [marke('e1', 2000)]));
    assert.strictEqual(ids(r), '');
    assert.strictEqual(r.remoteDirty, false);
});

check('Konvergenz: zweiter Merge mit dem Ergebnis ändert nichts mehr', () => {
    const remote = snap([ausgabe('e2', 1500)], [marke('e1', 2000)]);
    const r1 = merge(B, snap([ausgabe('e1', 1000), ausgabe('e3', 1700)], []), remote);
    // Gerät wendet an und pusht → neue Cloud = Ergebnis
    const neu = { keys: r1.keys, meta: r1.meta };
    const r2 = merge(B, neu, neu);
    assert.strictEqual(ids(r2), 'e2,e3');
    assert.strictEqual(r2.localDirty, false, 'kein erneutes Anwenden');
    assert.strictEqual(r2.remoteDirty, false, 'kein erneuter Upload');
});

check('Drei Geräte, beliebige Reihenfolge: gelöschte Ausgabe taucht nirgends wieder auf', () => {
    let cloud = snap([ausgabe('e1', 1000), ausgabe('e2', 1000)], []);
    const geraete = { A: snap([ausgabe('e1', 1000), ausgabe('e2', 1000)], []), B: snap([ausgabe('e1', 1000), ausgabe('e2', 1000)], []), C: snap([ausgabe('e1', 1000), ausgabe('e2', 1000)], []) };
    // A löscht e1 lokal
    geraete.A = snap([ausgabe('e2', 1000)], [marke('e1', 3000)]);
    const sync = name => { const r = merge(B, geraete[name], cloud); geraete[name] = { keys: r.keys, meta: r.meta }; if (r.remoteDirty || !cloud) cloud = { keys: r.keys, meta: r.meta }; };
    // C synct zuerst (ohne Kenntnis), dann A, dann B, dann C erneut, dann B (CAS-Retry-artig doppelt)
    ['C', 'A', 'B', 'C', 'B', 'A'].forEach(sync);
    ['A', 'B', 'C'].forEach(n => assert.strictEqual(ids(geraete[n]), 'e2', 'Gerät ' + n));
    assert.strictEqual(ids(cloud), 'e2', 'Cloud');
});

check('Zwei Firmen: Löschmarke von B wirkt nicht auf gleichnamige ID in einem anderen Scope', () => {
    const C = 'co_C';
    const r = merge(C, { keys: { [C + '__reselling_expenses']: [ausgabe('e1', 1000)], [C + '__reselling_tombstones']: [] }, meta: {} },
        { keys: { [C + '__reselling_expenses']: [ausgabe('e1', 1000)], [C + '__reselling_tombstones']: [] }, meta: {} });
    assert.strictEqual((r.keys[C + '__reselling_expenses'] || []).length, 1, 'C behält e1');
});

check('Konflikt Änderung nach Löschung: Löschung gewinnt und wird gemeldet', () => {
    const r = merge(B, snap([], [marke('e1', 2000)]), snap([ausgabe('e1', 2500)], []));
    assert.strictEqual(ids(r), '');
    assert.strictEqual(r.loeschKonflikte.length, 1);
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
