// Regressionstest: abgebrochene Rechnung darf keinen Lagerartikel als "verkauft" zuruecklassen
// (Fund 1.5 aus Live-Test 5, live gemessen 2026-09-01).
//
// Der Fehler: "Artikel aus Lager" schreibt die Markierung SOFORT in den Store, obwohl die
// Rechnung noch nicht gespeichert ist. Der Abbrechen-Knopf raeumte das korrekt auf
// (reconcileLagerOnCancel), wer aber einfach wegnavigierte, liess den Artikel als verkauft
// zurueck - aus Bestand und Lagerwert verschwunden, ohne Umsatz dagegen. Die §14-Sperre macht
// den Pfad wahrscheinlich: ohne Steuernummer laesst sich gar nicht speichern.
//
// Geprueft wird beides: die Verdrahtung des Verlassen-Hakens im Quelltext und die Semantik
// von reconcileLagerOnCancel als nachgebaute Logik.
'use strict';
const fs = require('fs');
const path = require('path');

const appSrc  = fs.readFileSync(path.join(__dirname, '..', 'rechnungen', 'js', 'app.js'), 'utf8');
const rechSrc = fs.readFileSync(path.join(__dirname, '..', 'rechnungen', 'js', 'rechnung.js'), 'utf8');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('\u2713 ' + name); }
    else { console.error('\u2717 FAIL ' + name); }
}

// ── A) Verdrahtung in rechnungen/js/app.js ───────────────────────────────────
check('A1 onLeave existiert und wird exportiert',
      /function onLeave\(fn\)/.test(appSrc) && /onLeave:\s*onLeave/.test(appSrc));
check('A2 der Haken wird VOR dem Aufruf geloescht (keine Rekursion ueber navigate)',
      /_leaveHook = null;[\s\S]{0,120}?try \{ fn\(\); \}/.test(appSrc));
check('A3 navigate ruft den Haken erst NACH der Verwerfen-Rueckfrage',
      appSrc.indexOf('Seite trotzdem verlassen?') < appSrc.indexOf('if (page !== currentPage) _runLeaveHook();'));
check('A4 navigate ruft ihn nur bei echtem Seitenwechsel',
      /if \(page !== currentPage\) _runLeaveHook\(\);/.test(appSrc));
check('A5 Tab-schliessen/Reload ist abgedeckt',
      /addEventListener\('beforeunload', _runLeaveHook\)/.test(appSrc));

// ── B) Verdrahtung in rechnungen/js/rechnung.js ──────────────────────────────
check('B1 die Maske registriert den Haken in init()',
      /RechApp\.onLeave\(reconcileLagerOnCancel\)/.test(rechSrc));
check('B2 Abbrechen meldet ihn ab (sonst liefe reconcile doppelt)',
      /reconcileLagerOnCancel\(\);[\s\S]{0,200}?RechApp\.onLeave\(null\)/.test(rechSrc));
check('B3 erfolgreiches Speichern meldet ihn ab',
      /RechApp\.onLeave\(null\);[\s\S]{0,160}?Dokument gespeichert!/.test(rechSrc));

// B4: beim GESPERRTEN Dokument darf er stehen bleiben - dort wurde nichts gespeichert.
const gesperrtIdx = rechSrc.indexOf('ist bereits gestellt/gesperrt');
const gespeichertIdx = rechSrc.indexOf("Dokument gespeichert!");
const abmeldungenVorGesperrt = (rechSrc.slice(0, gesperrtIdx).match(/RechApp\.onLeave\(null\)/g) || []).length;
const abmeldungenVorGespeichert = (rechSrc.slice(0, gespeichertIdx).match(/RechApp\.onLeave\(null\)/g) || []).length;
check('B4 der gesperrte Pfad meldet den Haken NICHT ab',
      abmeldungenVorGespeichert > abmeldungenVorGesperrt);

// ── C) Semantik von reconcileLagerOnCancel, nachgebaut ───────────────────────
// verknuepft = was in der Maske steht, original = was die GESPEICHERTE Rechnung hatte.
function reconcile(lager, currentIds, originalIds) {
    const st = Object.assign({}, lager);
    currentIds.forEach(id => { if (originalIds.indexOf(id) === -1 && st[id] === 'verkauft') st[id] = 'verfuegbar'; });
    originalIds.forEach(id => { if (currentIds.indexOf(id) === -1) st[id] = 'verkauft'; });
    return st;
}
check('C1 neue Rechnung, weggenavigiert: Artikel wird wieder verfuegbar',
      reconcile({ a: 'verkauft' }, ['a'], []).a === 'verfuegbar');
check('C2 bestehende Rechnung unveraendert: Artikel bleibt verkauft',
      reconcile({ a: 'verkauft' }, ['a'], ['a']).a === 'verkauft');
check('C3 Position entfernt, aber nicht gespeichert: Artikel bleibt verkauft',
      reconcile({ a: 'verfuegbar' }, [], ['a']).a === 'verkauft');
check('C4 getauschte Verknuepfung wird beidseitig zurueckgedreht',
      (() => { const r = reconcile({ alt: 'verfuegbar', neu: 'verkauft' }, ['neu'], ['alt']);
               return r.alt === 'verkauft' && r.neu === 'verfuegbar'; })());
check('C5 ohne Lager-Verknuepfung passiert nichts',
      Object.keys(reconcile({}, [], [])).length === 0);

console.log('\n' + pass + '/' + total + ' bestanden');
process.exit(pass === total ? 0 : 1);
