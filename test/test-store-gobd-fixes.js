// Regressionstest: GoBD-Fixes in js/store.js (2026-07-30)
//  35) saveRechInvoice(): "neu" wird jetzt anhand des persistierten Bestands (idx<0) bestimmt statt
//      anhand von !invoice.id — der Aufrufer vergibt die ID immer schon VOR dem Speichern, wodurch
//      der "erstellt"-Audit-Zweig (+ Webhook) vorher für JEDE neue Rechnung nie erreicht wurde.
//  39) Tombstones: getTombstones/_addTombstone/isTombstoned.
// Testet den ECHTEN Code aus js/store.js per Quelltext-Extraktion (gleiches Vorgehen wie die
// anderen test-*.js in diesem Repo, da store.js wegen IndexedDB/localStorage-Globals nicht
// direkt per require() ladbar ist).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function extractMethod(src, startMarker, endMarkerRe) {
    const startIdx = src.indexOf(startMarker);
    assert.ok(startIdx !== -1, 'Marker nicht gefunden: ' + startMarker);
    const afterStart = startIdx + startMarker.length;
    const rest = src.slice(afterStart);
    const m = rest.match(endMarkerRe);
    assert.ok(m, 'Ende-Marker nicht gefunden nach ' + startMarker);
    return rest.slice(0, m.index);
}

const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf8');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else console.error('✗ FAIL ' + name);
}

// ── Fix 35: saveRechInvoice ───────────────────────────────────────────────
const saveBody = extractMethod(storeSrc, 'saveRechInvoice(invoice) {', /\n    \},/);
const saveRechInvoice = new Function('invoice', saveBody);

function mockStore(initialInvoices) {
    const auditCalls = [];
    const webhookCalls = [];
    global.Webhooks = { fire(type, inv) { webhookCalls.push({ type, inv }); } };
    return {
        _cache: {},
        _rechGet(key) { return key === 'dokumente' ? (this._docs || []) : null; },
        _rechSet(key, val) { if (key === 'dokumente') this._docs = val; },
        _docs: initialInvoices || [],
        _stampRecord(r) { r.updatedAt = Date.now(); return r; },
        _isRechInvoiceLocked() { return false; },
        _warnIfPeriodLocked() {},
        generateId() { return 'inv_' + Math.random().toString(36).slice(2); },
        _addAuditEntry(action, entityType, entityId, oldV, newV, details) {
            auditCalls.push({ action, entityType, entityId, oldV, newV, details });
        },
        _auditCalls: auditCalls,
        _webhookCalls: webhookCalls
    };
}

{
    // Simuliert exakt den echten Aufrufer-Pfad (rechnungen/js/rechnung.js buildInvoiceObject):
    // die ID wird VOR dem Speichern vergeben, genau wie in der Produktion.
    const store = mockStore([]);
    const preAssignedId = store.generateId();
    const newInvoice = { id: preAssignedId, nummer: 'RE-2026-001', status: 'offen', typ: 'rechnung', datum: '2026-03-01' };
    saveRechInvoice.call(store, newInvoice);
    check('Neuanlage (ID bereits vom Aufrufer vergeben): genau 1 Audit-Eintrag', store._auditCalls.length === 1);
    check("Neuanlage: Audit-Action = 'erstellt'", store._auditCalls[0] && store._auditCalls[0].action === 'erstellt');
    check('Neuanlage: Webhook wurde gefeuert', store._webhookCalls.length === 1 && store._webhookCalls[0].type === 'rechnung');

    // Bearbeitung derselben (jetzt persistierten) Rechnung
    const edited = Object.assign({}, newInvoice, { notizen: 'geändert' });
    saveRechInvoice.call(store, edited);
    check('Bearbeitung: 2 Audit-Einträge insgesamt (erstellt + bearbeitet)', store._auditCalls.length === 2);
    check("Bearbeitung: zweiter Audit-Action = 'bearbeitet'", store._auditCalls[1].action === 'bearbeitet');
    check('Bearbeitung: KEIN zusätzlicher Webhook-Aufruf', store._webhookCalls.length === 1);
}

// ── Fix 39: Tombstones ─────────────────────────────────────────────────────
const tombstoneGetBody = extractMethod(storeSrc, 'getTombstones() {', /\n    \},/);
const addTombstoneBody = extractMethod(storeSrc, '_addTombstone(entityType, entityId) {', /\n    \},/);
const isTombstonedBody = extractMethod(storeSrc, 'isTombstoned(entityType, entityId) {', /\n    \},/);
const getTombstones = new Function(tombstoneGetBody);
const addTombstone = new Function('entityType', 'entityId', addTombstoneBody);
const isTombstoned = new Function('entityType', 'entityId', isTombstonedBody);

{
    const store2 = {
        _TOMBSTONE_KEY: 'tombstones',
        _TOMBSTONE_RETENTION_MS: 180 * 86400000,
        _data: {},
        get(key) { return this._data[key] || null; },
        set(key, val) { this._data[key] = val; },
        getTombstones, // damit isTombstoned/_addTombstone (this.getTombstones()) funktioniert
    };
    check('getTombstones() startet leer', getTombstones.call(store2).length === 0);
    addTombstone.call(store2, 'einkauf', 'p1');
    check('_addTombstone: Eintrag wird gespeichert', getTombstones.call(store2).length === 1);
    check("isTombstoned('einkauf','p1') === true nach dem Löschen", isTombstoned.call(store2, 'einkauf', 'p1') === true);
    check("isTombstoned('einkauf','p2') === false (nie gelöscht)", isTombstoned.call(store2, 'einkauf', 'p2') === false);
    check("isTombstoned('verkauf','p1') === false (anderer entityType, gleiche ID)", isTombstoned.call(store2, 'verkauf', 'p1') === false);
}

console.log('\n' + pass + '/' + total + ' Tests bestanden ' + (pass === total ? '✅' : '❌'));
if (pass !== total) process.exit(1);
