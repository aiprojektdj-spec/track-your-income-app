// Lager-Massenoperationen und das GoBD-Audit-Log:  node test/test-lager-audit-log.js
//
// Fund D2 (Steuer-Delta-Audit 2026-08-11, höchster Fund der Runde): lager/page.js schreibt an
// mehreren Stellen mit Store.setAsync() direkt in den Store. setAsync() ist ein reiner
// Schreibpfad — anders als Store.savePurchase()/saveSale() protokolliert es NICHT. Damit konnte
// ein Nutzer hunderte Einkäufe (Betriebsausgaben) und Verkäufe (Betriebseinnahmen) anlegen und
// Bestände auf "verkauft" setzen, ohne dass eine Zeile im Änderungsprotokoll erscheint.
//
// In einer Betriebsprüfung ist das die Lücke, die auffällt: die Hash-Kette ist intakt, das
// Protokoll wirkt vollständig — zeigt aber die umsatzstärksten Vorgänge nicht (§146 Abs. 4 AO,
// GoBD Rz. 64).
//
// Korrektur am Fund: von den fünf genannten Stellen protokollierte der Excel-Import (purchases
// UND sales) bereits. Offen waren drei: Sammel-Erfassung, Verkaufs-Import, Massen-Statuswechsel.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'lager', 'page.js'), 'utf8');
const lines = src.split('\n');
let pass = 0;

// Jede setAsync-Stelle auf purchases/sales muss einen Protokoll-Aufruf in ihrer Nähe haben.
// "Nähe" = derselbe try-Block, hier pragmatisch als Fenster von 45 Zeilen nach dem Schreiben.
const writeLines = [];
lines.forEach((l, i) => {
    if (/Store\.setAsync\('(purchases|sales)'/.test(l)) writeLines.push({ nr: i + 1, text: l.trim() });
});
assert.ok(writeLines.length >= 4, 'mindestens vier Schreibstellen erwartet, gefunden: ' + writeLines.length);

const ungeschuetzt = writeLines.filter(w => {
    const fenster = lines.slice(w.nr - 1, w.nr + 45).join('\n');
    return !/_addAuditEntriesBatch|_addAuditEntry/.test(fenster);
});
assert.deepStrictEqual(ungeschuetzt, [],
    'Schreibstellen ohne Protokollierung: ' + ungeschuetzt.map(u => u.nr).join(', '));
pass++; console.log('✓ alle ' + writeLines.length + ' setAsync-Schreibstellen liegen bei einer Protokollierung');

// Die Sammel-Erfassung muss Einkäufe als 'erstellt' protokollieren.
// Funktion bis zur nächsten Top-Level-Deklaration schneiden (die Länge fest zu begrenzen wäre
// brüchig — die Funktion ist über 120 Zeilen lang).
function funcSlice(name) {
    const i = src.indexOf(name);
    assert.ok(i !== -1, name + ' nicht gefunden');
    const next = src.indexOf('\nfunction ', i + name.length);
    return src.slice(i, next === -1 ? src.length : next);
}
const bulk = funcSlice('function _saveBulkArtikel');
assert.ok(/_addAuditEntriesBatch/.test(bulk), 'Sammel-Erfassung protokolliert');
assert.ok(/action: 'erstellt', entityType: 'einkauf'/.test(bulk), 'als erstellt/einkauf');
assert.ok(/Sammel-Erfassung Lager/.test(bulk), 'details nennt die Herkunft');
pass++; console.log('✓ Sammel-Erfassung protokolliert Einkäufe');

// Der Verkaufs-Import muss Verkäufe UND den Massen-Statuswechsel protokollieren
const imp = src.slice(src.indexOf('async _import()'));
assert.ok(/action: 'erstellt', entityType: 'verkauf'/.test(imp), 'Verkäufe als erstellt/verkauf');
assert.ok(/action: 'status_geaendert', entityType: 'einkauf'/.test(imp), 'Statuswechsel protokolliert');
assert.ok(/Massen-Statuswechsel aus Verkaufs-Import/.test(imp), 'details nennt den Vorgang');
pass++; console.log('✓ Verkaufs-Import protokolliert Verkäufe und Statuswechsel');

// Der Statuswechsel braucht den VORHER-Wert — ohne oldValues ist er nicht nachvollziehbar
assert.ok(/const vorher = \{ id: p\.id, status: p\.status \};/.test(imp),
    'Vorher-Status wird festgehalten, bevor er überschrieben wird');
const statusIdx = imp.indexOf("p.status = 'verkauft';");
const vorherIdx = imp.indexOf('const vorher =');
assert.ok(vorherIdx !== -1 && vorherIdx < statusIdx, 'Vorher-Wert VOR dem Überschreiben gelesen');
assert.ok(/oldValues: vorher/.test(imp), 'oldValues nutzt den festgehaltenen Wert');
pass++; console.log('✓ Statuswechsel hält den Vorher-Wert korrekt fest');

// Ein Batch-Aufruf statt N Einzelaufrufe — sonst bläht ein 300-Zeilen-Import das Protokoll auf
// und erzeugt 300 Schreiboperationen.
const batchCalls = (src.match(/_addAuditEntriesBatch\(/g) || []).length;
const singleCalls = (src.match(/Store\._addAuditEntry\(/g) || []).length;
assert.ok(batchCalls >= 3, 'mindestens drei Batch-Aufrufe, gefunden: ' + batchCalls);
assert.strictEqual(singleCalls, 0, 'keine Einzelaufrufe in Massenpfaden');
pass++; console.log('✓ ' + batchCalls + ' Batch-Aufrufe, keine Einzelprotokollierung in Massenpfaden');

// Defensive Aufrufe: fehlt die Store-Funktion, darf der Import nicht crashen
const guards = (src.match(/Store\._addAuditEntriesBatch &&|if \(Store\._addAuditEntriesBatch\)/g) || []).length;
assert.ok(guards >= 3, 'jeder Aufruf ist gegen fehlende Store-Funktion abgesichert, gefunden: ' + guards);
pass++; console.log('✓ alle Aufrufe gegen fehlende Store-Funktion abgesichert');

// Gegenprobe: die Aktionsarten müssen die sein, die store.js kennt — ein Tippfehler hier
// erzeugt Protokolleinträge, die kein Filter im Protokoll-Modul findet.
const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf8');
['erstellt', 'status_geaendert'].forEach(a => {
    assert.ok(new RegExp("'" + a + "'").test(storeSrc), 'Aktionsart ' + a + ' ist in store.js bekannt');
});
pass++; console.log('✓ verwendete Aktionsarten sind im Store bekannt');

console.log('\n' + pass + '/7 Tests bestanden ✅');
