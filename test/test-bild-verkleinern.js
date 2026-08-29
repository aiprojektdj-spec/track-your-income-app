// Test: Zielmasse beim Verkleinern von Beleg-Fotos (js/utils.js)
//
// Hintergrund: Beleg-Fotos gehen als Data-URL in den Datenbestand, den der
// Cloud-Sync bei jeder Aenderung komplett verschluesselt und hochlaedt — es gibt
// bewusst keinen Delta-Sync (plan/02-ENTSCHEIDUNGEN.md). Ein ungeschrumpftes
// Handyfoto kostet dort mehrere Megabyte pro Beleg.
//
// Geprueft wird nur die reine Rechnung `_bildZielMasse`. Das Zeichnen selbst
// braucht Canvas und ist hier nicht Gegenstand — dieselbe Trennung wie bei der
// OCR-Heuristik (test/test-beleg-ocr.js).
//
//   node test/test-bild-verkleinern.js

const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

// utils.js laeuft im Browser gegen window/document. Fuer den Test reicht ein
// Kontext, in dem die Datei durchlaeuft; benutzt wird nur die eine Methode.
const sandbox = {
    console,
    window:     {},
    document:   {
        addEventListener() {}, querySelectorAll: () => [], querySelector: () => null,
        readyState: 'complete', body: {}
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator:  { userAgent: 'node' },
    // utils.js haengt beim Laden einen MutationObserver ein (linkOrphanLabels).
    // Im Browser noetig, hier nur Attrappe — getestet wird die reine Rechnung.
    MutationObserver: function () { this.observe = function () {}; this.disconnect = function () {}; },
    setTimeout, clearTimeout, setInterval, clearInterval
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
// `const Utils = {...}` auf oberster Ebene wird im vm-Kontext KEINE Eigenschaft des
// Globals (anders als ein `var`). Deshalb am Ende ausdruecklich herausreichen.
const quelle = fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8');
vm.runInContext(quelle, sandbox);
// Zweites Skript im selben Kontext: greift auf die lexikalische Bindung `Utils` zu.
vm.runInContext('globalThis.Utils = Utils;', sandbox);

const U = sandbox.Utils || (sandbox.window && sandbox.window.Utils);
if (!U || typeof U._bildZielMasse !== 'function') {
    console.log('  FAIL Utils._bildZielMasse nicht gefunden');
    process.exit(1);
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log('  OK   ' + name); }
    else      { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
}

// ── Kleine Bilder bleiben unangetastet ─────────────────────────────────────
const logo = U._bildZielMasse(400, 120);
check('Logo 400x120 wird nicht angefasst', logo.verkleinert === false && logo.breite === 400 && logo.hoehe === 120, JSON.stringify(logo));

const genauMax = U._bildZielMasse(1600, 900);
check('genau auf der Grenze bleibt unveraendert', genauMax.verkleinert === false, JSON.stringify(genauMax));

// ── Handyfoto hochkant: die lange Kante bestimmt den Faktor ────────────────
const hochkant = U._bildZielMasse(3024, 4032);
check('Hochkant 3024x4032 wird verkleinert', hochkant.verkleinert === true);
check('lange Kante landet auf 1600', hochkant.hoehe === 1600, 'hoehe=' + hochkant.hoehe);
check('Seitenverhaeltnis bleibt erhalten', Math.abs((hochkant.breite / hochkant.hoehe) - (3024 / 4032)) < 0.005,
      hochkant.breite + 'x' + hochkant.hoehe);

// ── Querformat ────────────────────────────────────────────────────────────
const quer = U._bildZielMasse(4032, 3024);
check('Quer 4032x3024 -> Breite 1600', quer.breite === 1600 && quer.hoehe === 1200, JSON.stringify(quer));

// ── Extremes Seitenverhaeltnis: ein langer Bon ────────────────────────────
const bon = U._bildZielMasse(900, 6000);
check('langer Kassenbon 900x6000 wird verkleinert', bon.verkleinert === true && bon.hoehe === 1600, JSON.stringify(bon));
check('schmale Kante faellt nie auf 0', bon.breite >= 1, 'breite=' + bon.breite);

// ── Eigener Grenzwert ─────────────────────────────────────────────────────
const eigen = U._bildZielMasse(3000, 1500, 1000);
check('eigener maxKante-Wert wird beachtet', eigen.breite === 1000 && eigen.hoehe === 500, JSON.stringify(eigen));

// ── Unsinnige Eingaben kippen nichts ──────────────────────────────────────
const null0 = U._bildZielMasse(0, 0);
check('0x0 wird durchgereicht statt geteilt', null0.verkleinert === false, JSON.stringify(null0));

const negativ = U._bildZielMasse(-10, 5000);
check('negative Breite kippt nicht', negativ.verkleinert === false, JSON.stringify(negativ));

console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen');
process.exit(fail ? 1 : 0);
