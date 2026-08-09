// Regressionstest: Kassenbuch-Fixes (2026-07-30)
//  1) Jahresanfangsbestand wird aus Basiswert + tatsächlichen Vorjahresbuchungen abgeleitet
//     (vorher: derselbe globale Wert für jedes Jahr — keine automatische Fortschreibung).
//  2) saveKassenEintrag() protokolliert jetzt Erstellung UND Änderung im Audit-Log
//     (vorher: nur die Stornierung in deleteKassenEintrag wurde geloggt).
// Testet den ECHTEN Code aus js/kassenbuch.js und js/store.js per Quelltext-Extraktion
// (gleiches Vorgehen wie die anderen test-*.js in diesem Repo).
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

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else console.error('✗ FAIL ' + name);
}

// ── 1) Kassenbuch._anfangsbestandFuerJahr ────────────────────────────────────
const kbSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'kassenbuch.js'), 'utf8');
const anfangsbestandBody = extractMethod(kbSrc, '_anfangsbestandFuerJahr(year, eintraege, basisAnfangsbestand) {', /\n    \},/);
const _anfangsbestandFuerJahr = new Function('year', 'eintraege', 'basisAnfangsbestand', anfangsbestandBody);

const eintraege = [
    { datum: '2025-03-01', typ: 'Einnahme', betrag: 1000, storniert: false },
    { datum: '2025-06-01', typ: 'Ausgabe',  betrag: 200,  storniert: false },
    { datum: '2025-11-01', typ: 'Einnahme', betrag: 500,  storniert: true },  // storniert -> zaehlt nicht
    { datum: '2026-01-15', typ: 'Ausgabe',  betrag: 50,   storniert: false }, // erst 2026 -> nicht in 2026er Anfangsbestand
];

check("'all' liefert den reinen Basiswert", _anfangsbestandFuerJahr('all', eintraege, 100) === 100);
check('2025: Basiswert unverändert (keine Buchungen vor 2025)', _anfangsbestandFuerJahr('2025', eintraege, 100) === 100);
check('2026: Basiswert (100) + 1000 Einnahme − 200 Ausgabe = 900 (stornierte 500€ zählen nicht, 2026er Buchung noch nicht)',
    Math.abs(_anfangsbestandFuerJahr('2026', eintraege, 100) - 900) < 0.01);
check('2027: berücksichtigt auch die 2026er Ausgabe -> 900 - 50 = 850',
    Math.abs(_anfangsbestandFuerJahr('2027', eintraege, 100) - 850) < 0.01);

// ── 2) Store.saveKassenEintrag: Audit-Eintrag bei Erstellung UND Bearbeitung ─
const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf8');
const saveBody = extractMethod(storeSrc, 'saveKassenEintrag(e) {', /\n    \},/);
const saveKassenEintrag = new Function('e', saveBody);

function mockStore(initialEintraege) {
    const auditCalls = [];
    let cacheVal = JSON.stringify(initialEintraege || []);
    return {
        _prefix: 'test__',
        _cache: { 'test__kassenbuch': cacheVal },
        getKassenbuch() { return JSON.parse(this._cache['test__kassenbuch'] || '[]'); },
        generateId() { return 'kb_' + Math.random().toString(36).slice(2); },
        isLocked() { return false; },
        _idbPut() {},
        _triggerAutoBackup() {},
        _addAuditEntry(action, entityType, entityId, oldV, newV, details) {
            auditCalls.push({ action, entityType, entityId, oldV, newV, details });
        },
        _auditCalls: auditCalls
    };
}

{
    const store = mockStore([]);
    const saved = saveKassenEintrag.call(store, { typ: 'Einnahme', betrag: 100, beschreibung: 'Testverkauf', datum: '2026-03-01' });
    check('Neuanlage: genau 1 Audit-Eintrag', store._auditCalls.length === 1);
    check("Neuanlage: Audit-Action = 'erstellt'", store._auditCalls[0].action === 'erstellt');
    check("Neuanlage: entityType = 'kassenbuch'", store._auditCalls[0].entityType === 'kassenbuch');
    check('Neuanlage: oldValues ist null (kein Vorzustand)', store._auditCalls[0].oldV === null);

    // Bearbeitung desselben Eintrags
    const edited = Object.assign({}, saved, { betrag: 150 });
    saveKassenEintrag.call(store, edited);
    check('Bearbeitung: insgesamt 2 Audit-Einträge (erstellt + bearbeitet)', store._auditCalls.length === 2);
    check("Bearbeitung: zweiter Audit-Action = 'bearbeitet'", store._auditCalls[1].action === 'bearbeitet');
    check('Bearbeitung: oldValues enthält den ALTEN Betrag (100)', store._auditCalls[1].oldV.betrag === 100);
    check('Bearbeitung: newValues enthält den NEUEN Betrag (150)', store._auditCalls[1].newV.betrag === 150);
}

console.log('\n' + pass + '/' + total + ' Tests bestanden ' + (pass === total ? '✅' : '❌'));
if (pass !== total) process.exit(1);
