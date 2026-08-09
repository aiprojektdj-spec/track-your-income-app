// Self-Test der reinen Sync-Logik:  node test/test-cloud-sync.js
// Prüft: Base32-Roundtrip, LWW-Record-Merge, Audit-Re-Chaining (verifyAuditChain gültig).
'use strict';
const assert = require('assert');

// ── Minimal-Shims, damit js/cloud-sync.js unter Node lädt ──────────────────
const _ls = new Map();
global.localStorage = {
    getItem: k => (_ls.has(k) ? _ls.get(k) : null),
    setItem: (k, v) => _ls.set(k, String(v)),
    removeItem: k => _ls.delete(k)
};
global.document = { readyState: 'complete', getElementById: () => null, addEventListener: () => {} };
global.window = {};
// djb2-Checksumme + verifyAuditChain — identisch zu js/store.js
function calcChecksum(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h = h & h; } return Math.abs(h).toString(36); }
global.Store = {
    _calcChecksum: calcChecksum,
    _tombstones: new Set(),   // Test-Hilfsstruktur, s. Fix-39-Tests unten
    isTombstoned(entityType, id) { return this._tombstones.has(entityType + ':' + id); },
    verifyAuditChain(log) {
        let broken = 0;
        for (let i = 0; i < log.length; i++) {
            const e = log[i];
            const expected = calcChecksum(JSON.stringify(Object.assign({}, e, { checksum: '' })));
            if (e.checksum !== expected) { broken++; continue; }
            if (i > 0) { if (e.prevHash !== (log[i - 1].checksum || '')) broken++; }
            else if (e.prevHash !== 'GENESIS') broken++;
        }
        return { valid: broken === 0, broken, total: log.length };
    }
};

const T = require('../js/cloud-sync.js')._test;
let pass = 0;

// 1) Base32 roundtrip für 32-Byte-Schlüssel
(() => {
    const bytes = new Uint8Array(32); for (let i = 0; i < 32; i++) bytes[i] = (i * 37 + 11) & 255;
    const back = T.fromB32(T.toB32(bytes));
    assert.strictEqual(back.length, 32, 'base32 length');
    for (let i = 0; i < 32; i++) assert.strictEqual(back[i], bytes[i], 'base32 byte ' + i);
    pass++; console.log('✓ base32 roundtrip');
})();

// 2) Record-Merge: paralleles Anlegen → beide bleiben; gleicher Record → neuerer updatedAt gewinnt
(() => {
    const local  = [{ id: 'a', v: 1, updatedAt: 100 }, { id: 'b', v: 1, updatedAt: 100 }];
    const remote = [{ id: 'a', v: 2, updatedAt: 200 }, { id: 'c', v: 1, updatedAt: 150 }];
    const r = T.mergeRecords(local, remote);
    const byId = {}; r.val.forEach(x => byId[x.id] = x);
    assert.strictEqual(Object.keys(byId).length, 3, 'union a,b,c');
    assert.strictEqual(byId.a.v, 2, 'newer updatedAt wins');
    assert.ok(byId.b && byId.c, 'parallel inserts kept');
    assert.ok(r.localDirty && r.remoteDirty, 'both sides dirty');
    pass++; console.log('✓ record merge (LWW + union)');
})();

// 3) Tombstone (storniert) mit neuerem updatedAt gewinnt
(() => {
    const local  = [{ id: 'x', updatedAt: 100 }];
    const remote = [{ id: 'x', updatedAt: 300, storniert: true }];
    const r = T.mergeRecords(local, remote);
    assert.strictEqual(r.val[0].storniert, true, 'tombstone wins');
    pass++; console.log('✓ tombstone (soft-delete) wins by updatedAt');
})();

// 4) Audit-Merge: zwei Geräte-Ketten vereinen + re-chainen → verifyAuditChain gültig
(() => {
    const mk = (id, ts, dev) => ({ id, timestamp: ts, _dev: dev, action: 'erstellt', entityType: 'verkauf', entityId: id, oldValues: null, newValues: { id }, details: '', prevHash: '', checksum: '' });
    const dev1 = [mk('1', '2026-06-01T10:00:00Z', 'devA'), mk('3', '2026-06-01T12:00:00Z', 'devA')];
    const dev2 = [mk('2', '2026-06-01T11:00:00Z', 'devB'), mk('4', '2026-06-01T13:00:00Z', 'devB')];
    const r = T.mergeAudit(dev1, dev2);
    assert.strictEqual(r.val.length, 4, 'union of all entries');
    const v = Store.verifyAuditChain(r.val);
    assert.ok(v.valid, 'verifyAuditChain valid after merge, broken=' + v.broken);
    // Determinismus: andere Eingabereihenfolge → gleiche Kette
    const r2 = T.mergeAudit(dev2, dev1);
    assert.strictEqual(JSON.stringify(r.val), JSON.stringify(r2.val), 'deterministic re-chain');
    pass++; console.log('✓ audit union + deterministic re-chain (verifyAuditChain valid)');
})();

// 5) Konflikt-Erkennung: beide Seiten seit Base geändert → conflicts; sequentiell/ohne Base → keine
(() => {
    const base = { r: 100 };
    // beide > base, unterschiedlich → echte Kollision, beide Fassungen erhalten (LWW: 200 gewinnt in val)
    let r = T.mergeRecords([{ id: 'r', v: 'A', updatedAt: 150 }], [{ id: 'r', v: 'B', updatedAt: 200 }], base);
    assert.strictEqual(r.conflicts.length, 1, 'parallel edit flagged');
    assert.strictEqual(r.conflicts[0].id, 'r', 'conflict id');
    assert.strictEqual(r.conflicts[0].mine.v, 'A', 'keeps my version');
    assert.strictEqual(r.conflicts[0].theirs.v, 'B', 'keeps their version');
    assert.strictEqual(r.val[0].updatedAt, 200, 'newer still wins in merged val');
    // nur remote bewegt (lokal == base) → sequentiell, kein Konflikt
    r = T.mergeRecords([{ id: 'r', updatedAt: 100 }], [{ id: 'r', updatedAt: 200 }], base);
    assert.strictEqual(r.conflicts.length, 0, 'sequential update = no conflict');
    // ohne Base (Erststart) → nie Falsch-Positiv
    r = T.mergeRecords([{ id: 'r', updatedAt: 150 }], [{ id: 'r', updatedAt: 200 }]);
    assert.strictEqual(r.conflicts.length, 0, 'no base = no false positive');
    pass++; console.log('✓ parallel-edit conflict detection (keep-both)');
})();

// 6) Fix 39: physisch gelöschter Datensatz (Tombstone) wird beim Merge NICHT wiederbelebt
(() => {
    Store._tombstones = new Set(['einkauf:gone']);
    // remote hat einen Datensatz, der lokal (mangels Tombstone-Kenntnis anderer Geräte) längst
    // physisch gelöscht wurde — ohne Tombstone-Check würde er hier zurückkommen (localDirty=true, val enthält ihn).
    const r = T.mergeRecords([], [{ id: 'gone', v: 1, updatedAt: 500 }], null, 'einkauf');
    assert.strictEqual(r.val.length, 0, 'tombstoned remote record NICHT übernommen');
    assert.ok(r.remoteDirty, 'remoteDirty gesetzt, damit der nächste Push die Remote-Kopie ebenfalls entfernt');
    // Kontrolltest: OHNE Tombstone (anderer Datensatz) wird normal übernommen
    const r2 = T.mergeRecords([], [{ id: 'still-here', v: 1, updatedAt: 500 }], null, 'einkauf');
    assert.strictEqual(r2.val.length, 1, 'nicht-tombstoned Datensatz wird normal übernommen');
    Store._tombstones = new Set();
    pass++; console.log('✓ Fix 39: tombstoned record wird beim Cloud-Merge nicht wiederbelebt');
})();

// 7) Fix 40: Retry-Queue für fehlgeschlagene Löschungen (Redis/Blob)
(() => {
    const CS = require('../js/cloud-sync.js');
    let list = CS._test.loadPendingDeletions();
    assert.strictEqual(list.length, 0, 'Queue startet leer');
    CS._test.queuePendingDeletion({ kind: 'redis', scope: 'co_test' });
    CS._test.queuePendingDeletion({ kind: 'blob', scope: 'co_test', urls: ['https://x.example/f'] });
    list = CS._test.loadPendingDeletions();
    assert.strictEqual(list.length, 2, 'beide fehlgeschlagenen Löschungen wurden vermerkt');
    assert.ok(list.every(e => e.ts), 'jeder Eintrag hat einen Zeitstempel');
    pass++; console.log('✓ Fix 40: fehlgeschlagene Löschungen landen in der Retry-Queue');
})();

console.log('\n' + pass + '/7 Tests bestanden ✅');
