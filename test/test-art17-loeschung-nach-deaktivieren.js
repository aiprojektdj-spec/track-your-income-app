// Regressionstest: Art.-17-Loeschung nach dem Deaktivieren von Cloud-Sync (2026-09-07)
//
// Gefunden beim Vorklaeren von Live-Test 2. deleteRemote() begann mit
//   if (!_enabled() || !_hasKey() || !_token()) return true;
// Das ist richtig fuer "nie synchronisiert", aber falsch fuer "einmal synchronisiert, danach
// deaktiviert": der Snapshot liegt weiter in Redis, die Funktion meldete Erfolg, und der
// Aufrufer in js/app.js zeigte darauf "Alle Daten geloescht". Genau diese Reihenfolge - erst
// Sync aus, dann loeschen - waehlt ein Nutzer, der aufhoeren will, und sie steht so auch in
// plan/live-tests-checkliste.md unter Punkt 2.
'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'cloud-sync.js'), 'utf8');
const hostSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('\u2713 ' + name); }
    else { console.error('\u2717 FAIL ' + name); }
}

// ── A) Der alte Kurzschluss darf nicht zurueckkommen ─────────────────────────
check('A1 der alte Pauschal-Kurzschluss ist weg',
      !/if \(!_enabled\(\) \|\| !_hasKey\(\) \|\| !_token\(\)\) return true;/.test(src));
check('A2 "nie in der Cloud" wird ueber die Sync-Metadaten erkannt, nicht ueber das Enabled-Flag',
      /localStorage\.getItem\(LS_META\(scope\)\)/.test(src) && /localStorage\.getItem\(LS_BASE\(scope\)\)/.test(src));
check('A3 fehlendes Token wird eingereiht statt als Erfolg verbucht',
      /if \(!_token\(\)\) \{ _queuePendingDeletion\(\{ kind: 'redis', scope: scope \}\); return false; \}/.test(src));

// ── B) Der Redis-Snapshot braucht keinen Schluessel, das Anhang-Sammeln schon ─
check('B1 ohne Schluessel wird das Anhang-Sammeln uebersprungen, nicht die ganze Loeschung',
      /if \(!_hasKey\(\)\) throw new Error\('kein_schluessel_fuer_anhang_cleanup'\);/.test(src));
const delIdx = src.indexOf('async function deleteRemote');
const redisDelIdx = src.indexOf("action: 'delete', scope: scope", delIdx);
const keyGuardIdx = src.indexOf("kein_schluessel_fuer_anhang_cleanup", delIdx);
check('B2 die Redis-Loeschung steht NACH dem Anhang-Guard, wird also weiterhin erreicht',
      keyGuardIdx !== -1 && redisDelIdx !== -1 && keyGuardIdx < redisDelIdx);

// ── C) Das Versprechen im Toast muss einloesbar sein ─────────────────────────
// js/app.js sagt bei Fehlschlag "beim naechsten Sync-Versuch wird erneut versucht". Der Retry
// hing aber allein an _syncAll(), das bei deaktiviertem Sync sofort zurueckkehrt - im
// Loeschfall also nie lief.
check('C1 js/app.js verspricht einen spaeteren Versuch',
      /beim n[äa]chsten Sync-Versuch wird erneut versucht/.test(hostSrc));
const initIdx = src.indexOf('function init()');
const initEnde = src.indexOf('\n    function ', initIdx + 10);
const initBody = src.slice(initIdx, initEnde === -1 ? initIdx + 4000 : initEnde);
check('C2 init() holt offene Loeschungen nach, unabhaengig von _enabled()',
      /retryPendingDeletions\(\)/.test(initBody));
check('C3 retryPendingDeletions selbst haengt nur am Token',
      /async function retryPendingDeletions\(\)\s*\{\s*\n\s*if \(!_token\(\)\) return;/.test(src));

// ── D) Entscheidungslogik nachgebaut ─────────────────────────────────────────
// true  = nichts zu tun, Erfolg melden ist ehrlich
// false = es liegt etwas in der Cloud, es MUSS geloescht werden
function darfKurzschliessen(meta, base, enabled) {
    const jeInDerCloud = !!(meta || base);
    return !jeInDerCloud && !enabled;
}
check('D1 nie synchronisiert und Sync aus -> nichts zu tun',
      darfKurzschliessen(null, null, false) === true);
check('D2 EINMAL synchronisiert, danach deaktiviert -> muss loeschen (der Fund)',
      darfKurzschliessen('oyi_sync_keymeta_co_x', null, false) === false);
check('D3 nur die Konflikt-Basis vorhanden -> muss ebenfalls loeschen',
      darfKurzschliessen(null, '{"a":1}', false) === false);
check('D4 Sync aktiv -> muss loeschen, auch ohne Metadaten',
      darfKurzschliessen(null, null, true) === false);

console.log('\n' + pass + '/' + total + ' bestanden');
process.exit(pass === total ? 0 : 1);
