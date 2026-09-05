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

// B5/B6: der ABGELEHNTE Speicherversuch ist der zweite Weg in denselben Zustand (von einer
// Parallel-Session gemeldet: nicht die §14-Sperre, sondern "Bitte Kunden auswaehlen"). Nach
// einem Validierungsfehler bleibt der Nutzer auf der Maske - der Haken MUSS scharf bleiben,
// sonst ist die Verknuepfung verloren, sobald er danach wegnavigiert.
const saveBody = (rechSrc.match(/async function saveInvoice\(\)[\s\S]*?\n    \}/) || [''])[0];
check('B5 saveInvoice gefunden', saveBody.length > 200);
const validierungsAbbruch = saveBody.indexOf('if (!invoice) return;');
const ersteAbmeldung = saveBody.indexOf('RechApp.onLeave(null)');
check('B5b Validierungsabbruch liegt VOR jeder Abmeldung (Haken bleibt scharf)',
      validierungsAbbruch !== -1 && ersteAbmeldung !== -1 && validierungsAbbruch < ersteAbmeldung);
const gesperrtNavigate = saveBody.indexOf("Dokument ist bereits gestellt/gesperrt");
check('B6 auch der gesperrte Pfad meldet nicht ab, bevor er wegnavigiert',
      gesperrtNavigate !== -1 && gesperrtNavigate < ersteAbmeldung);

// ── D) Der vierte Weg: eingebettet in app.html (Fund 1.6) ────────────────────
// Die Rechnungs-App laeuft auch als Finanzen-Sub-Tab in app.html. Dort wechselt die Sidebar
// clientseitig ueber App.navigate() — kein Unload (also kein beforeunload) und kein
// RechApp.navigate(). Ohne einen Ausgang von aussen blieb genau der Zustand aus 1.5 stehen.
const hostSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

check('D1 RechApp exportiert einen oeffentlichen Ausloeser',
      /runLeaveHook:\s*runLeaveHook/.test(appSrc) && /function runLeaveHook\(\)\s*\{\s*_runLeaveHook\(\);\s*\}/.test(appSrc));
check('D2 die Haupt-App ruft ihn beim Seitenwechsel',
      /sub\.runLeaveHook\(\)/.test(hostSrc) && /typeof RechApp !== 'undefined' \? RechApp : null/.test(hostSrc));
check('D3 nur bei echtem Seitenwechsel, nicht bei Neuladen derselben Seite',
      /if \(page !== this\.currentPage\) \{[\s\S]{0,400}?sub\.runLeaveHook\(\)/.test(hostSrc));

// D4: Reihenfolge. Wird die Verwerfen-Rueckfrage verneint, bricht navigate() ab — dann darf
// vorher nichts aufgeraeumt worden sein, sonst ist die Verknuepfung weg, obwohl der Nutzer
// ausdruecklich auf der Seite geblieben ist.
const hostFrage    = hostSrc.indexOf('Seite trotzdem verlassen?');
const hostAufraeumen = hostSrc.indexOf('sub.runLeaveHook()');
check('D4 aufgeraeumt wird erst NACH der Verwerfen-Rueckfrage',
      hostFrage !== -1 && hostAufraeumen !== -1 && hostFrage < hostAufraeumen);

// D5: und vor dem Austausch von #content — danach sind die .pos-lager-id-Felder weg, aus denen
// reconcileLagerOnCancel seine currentIds liest, und der Abgleich liefe ins Leere.
const hostSeitenwechsel = hostSrc.indexOf('this.currentPage = page;');
check('D5 aufgeraeumt wird VOR dem Seitenwechsel',
      hostSeitenwechsel !== -1 && hostAufraeumen < hostSeitenwechsel);

check('D6 ein fehlender Haken bricht nichts ab (typeof-Guard plus try/catch)',
      /typeof sub\.runLeaveHook === 'function'/.test(hostSrc) && /catch \(e\)[\s\S]{0,120}?Sub-App/.test(hostSrc));

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
