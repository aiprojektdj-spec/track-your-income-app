// Uhr-Rücksprung im Audit-Log:  node test/test-audit-clock-back.js
//
// Fund T4 (Steuer-Vergleich 2026-08-10): der Zeitstempel im Audit-Log kommt aus new Date(), also
// von der Systemuhr des Geräts. Die Hash-Kette schützt ihn nicht — sie verkettet Inhalte, nicht
// Zeiten. Wer die Uhr zurückstellt, erzeugt einen rückdatierten Eintrag mit INTAKTER Kette.
// In einer Local-First-App ohne Serverzwang ist das nicht verhinderbar; erkennbar aber schon.
//
// Geprüft wird Store._clockBackFlag(): markiert Rücksprünge, toleriert kleine Korrekturen, und
// der Vermerk liegt innerhalb der Prüfsumme (Entfernen bricht die Kette).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf8');

// _clockBackFlag ist eine reine Funktion ohne Store-Abhängigkeiten → einzeln auswertbar.
const m = src.match(/_clockBackFlag\(prevEntry, isoNow\) \{[\s\S]*?\n    \},/);
assert.ok(m, '_clockBackFlag in js/store.js nicht gefunden');
const S = new Function('return { ' + m[0] + ' };')();

let pass = 0;
const iso = (ms) => new Date(ms).toISOString();
const T0 = Date.UTC(2026, 7, 11, 12, 0, 0);

// 1) Normalfall: Zeit läuft vorwärts → kein Vermerk
assert.strictEqual(S._clockBackFlag({ timestamp: iso(T0) }, iso(T0 + 60000)), null, 'vorwärts');
assert.strictEqual(S._clockBackFlag({ timestamp: iso(T0) }, iso(T0)), null, 'gleiche Zeit');
pass++; console.log('✓ vorwärts laufende Uhr erzeugt keinen Vermerk');

// 2) Erster Eintrag hat keinen Vorgänger → nichts zu vergleichen
assert.strictEqual(S._clockBackFlag(null, iso(T0)), null, 'kein Vorgänger');
assert.strictEqual(S._clockBackFlag({}, iso(T0)), null, 'Vorgänger ohne Zeitstempel');
pass++; console.log('✓ erster Eintrag wird nicht markiert');

// 3) Rücksprung: Vermerk enthält den Zeitstempel des Vorgängers, gegen den verglichen wurde
const back = S._clockBackFlag({ timestamp: iso(T0) }, iso(T0 - 3600000));  // eine Stunde zurück
assert.strictEqual(back, iso(T0), 'Vermerk nennt den Vorgänger-Zeitstempel');
pass++; console.log('✓ Rücksprung um eine Stunde wird markiert');

// 4) Toleranz: NTP-Korrekturen und Sommerzeit-Sprünge sind kein Manipulationsindiz.
//    Ohne Toleranz würde jede Sekundenkorrektur eine Manipulationswarnung erzeugen — dann
//    glaubt der Nutzer der Warnung irgendwann nicht mehr, und das ist schlimmer als keine.
assert.strictEqual(S._clockBackFlag({ timestamp: iso(T0) }, iso(T0 - 1500)), null, '1,5 s toleriert');
assert.strictEqual(S._clockBackFlag({ timestamp: iso(T0) }, iso(T0 - 2000)), null, 'genau 2 s toleriert');
assert.ok(S._clockBackFlag({ timestamp: iso(T0) }, iso(T0 - 2001)), 'ab 2,001 s markiert');
pass++; console.log('✓ 2-Sekunden-Toleranz für NTP-/Zeitzonen-Korrekturen');

// 5) Der Vermerk muss von der Prüfsumme erfasst sein. Nachbau der Store-Logik: Prüfsumme über
//    den ganzen Eintrag mit checksum:''. Entfernt jemand _clockBack, ändert sich die Prüfsumme.
const calc = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const entry = { id: 'a1', timestamp: iso(T0 - 3600000), _dev: 'd1', action: 'erstellt',
                entityType: 'einkauf', entityId: 'e1', oldValues: null, newValues: null,
                details: '', prevHash: 'GENESIS', checksum: '', _clockBack: iso(T0) };
entry.checksum = calc(Object.assign({}, entry, { checksum: '' }));

const stripped = Object.assign({}, entry);
delete stripped._clockBack;
assert.notStrictEqual(calc(Object.assign({}, stripped, { checksum: '' })), entry.checksum,
    'Entfernen des Vermerks muss die Prüfsumme brechen');
const forged = Object.assign({}, entry, { _clockBack: iso(T0 - 999999) });
assert.notStrictEqual(calc(Object.assign({}, forged, { checksum: '' })), entry.checksum,
    'Verändern des Vermerks muss die Prüfsumme brechen');
pass++; console.log('✓ Vermerk liegt innerhalb der Prüfsumme (nicht still entfernbar)');

// 6) verifyAuditChain zählt clockBack getrennt von broken — eine harmlose Zeitkorrektur darf
//    nicht wie eine gebrochene Kette aussehen, sonst ist die Meldung unbrauchbar
assert.ok(/let broken = 0, clockBack = 0;/.test(src), 'getrennte Zähler in verifyAuditChain');
assert.ok(/return \{ valid: broken === 0, broken, clockBack, total: log\.length \};/.test(src),
    'clockBack wird zurückgegeben, valid hängt nur an broken');
pass++; console.log('✓ verifyAuditChain trennt clockBack von broken');

// 7) Beide Schreibpfade müssen die Prüfung machen — der Bulk-Import wäre sonst die offene Tür
const single = src.match(/_addAuditEntry\(action[\s\S]*?\n    \},/)[0];
const batch  = src.match(/_addAuditEntriesBatch\(items\) \{[\s\S]*?\n    \},/)[0];
assert.ok(/_clockBackFlag\(/.test(single), '_addAuditEntry prüft');
assert.ok(/_clockBackFlag\(/.test(batch),  '_addAuditEntriesBatch prüft');
// Im Batch muss prevEntry mitwandern, sonst wird nur gegen den Stand VOR dem Import verglichen
assert.ok(/prevEntry = entry;/.test(batch), 'Batch führt prevEntry mit');
pass++; console.log('✓ Einzel- und Bulk-Pfad prüfen beide, Batch führt den Zeitbezug mit');

console.log('\n' + pass + '/7 Tests bestanden ✅');
