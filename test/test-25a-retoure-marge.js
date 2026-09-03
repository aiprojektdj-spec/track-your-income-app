// Regressionstest: §25a Differenzbesteuerung — Retoure/Gutschrift muss die Marge senken (2026-09-02)
//  A) margeEinzeldifferenz() verrechnet pos.margeKorrektur gegen die Position mit derselben ref.
//     Vorher las die Funktion nur verkaufspreis/einkaufspreis: ein Korrektur-Eintrag trug
//     max(0, 0-0) = 0 bei und verschwand spurlos — nach voller Retoure blieb die urspruenglich
//     versteuerte Marge in Kz. 81 stehen (Uebersteuerung, Fund 1.4 aus Live-Test 5).
//  B) Der Floor bei 0 wirkt weiter PRO POSITION — eine Retoure darf nicht die Marge einer
//     anderen Position druecken (§25a Abs. 3 UStG verbietet Verrechnung zwischen Positionen).
//  C) js/ustvoranmeldung.js muss an JEDER Push-Stelle ein ref mitgeben, sonst greift A nicht.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const bercSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'steuer-berechnung.js'), 'utf8');
const SteuerBerechnung = new Function(bercSrc + '\nreturn SteuerBerechnung;')();

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('\u2713 ' + name); }
    else { console.error('\u2717 FAIL ' + name); }
}
const rund = n => Math.round(n * 100) / 100;

// ── A) Einzeldifferenz: Korrektur greift ──────────────────────────────────────
const verkauf = { ref: 'art1', verkaufspreis: 150, einkaufspreis: 100, satz: 19 }; // Marge 50

check('A1 Verkauf ohne Retoure: Marge 50',
      rund(SteuerBerechnung.margeEinzeldifferenz([verkauf]).margeBrutto) === 50);

check('A2 volle Retoure: Marge faellt auf 0',
      rund(SteuerBerechnung.margeEinzeldifferenz([
          verkauf, { ref: 'art1', margeKorrektur: -50, satz: 19 }
      ]).margeBrutto) === 0);

check('A3 halbe Retoure: Marge halbiert sich',
      rund(SteuerBerechnung.margeEinzeldifferenz([
          verkauf, { ref: 'art1', margeKorrektur: -25, satz: 19 }
      ]).margeBrutto) === 25);

check('A4 volle Retoure: auch die USt faellt auf 0',
      rund(SteuerBerechnung.margeEinzeldifferenz([
          verkauf, { ref: 'art1', margeKorrektur: -50, satz: 19 }
      ]).ust) === 0);

// ── B) Floor bleibt pro Position ──────────────────────────────────────────────
const verkaufB = { ref: 'art2', verkaufspreis: 300, einkaufspreis: 200, satz: 19 }; // Marge 100

check('B1 Retoure trifft nur ihre eigene Position',
      rund(SteuerBerechnung.margeEinzeldifferenz([
          verkauf, verkaufB, { ref: 'art1', margeKorrektur: -50, satz: 19 }
      ]).margeBrutto) === 100);

check('B2 Ueberschiessende Retoure greift NICHT auf die andere Position durch (§25a Abs. 3)',
      rund(SteuerBerechnung.margeEinzeldifferenz([
          verkauf, verkaufB, { ref: 'art1', margeKorrektur: -500, satz: 19 }
      ]).margeBrutto) === 100);

check('B3 Korrektur ohne passende Position (Verkauf in der Vorperiode) zieht nichts ab',
      rund(SteuerBerechnung.margeEinzeldifferenz([
          verkaufB, { ref: 'art9', margeKorrektur: -50, satz: 19 }
      ]).margeBrutto) === 100);

check('B4 Verlustposition bleibt bei 0, macht die Gewinnposition nicht kleiner',
      rund(SteuerBerechnung.margeEinzeldifferenz([
          verkaufB, { ref: 'art3', verkaufspreis: 50, einkaufspreis: 200, satz: 19 }
      ]).margeBrutto) === 100);

check('B5 leere Liste bleibt 0',
      SteuerBerechnung.margeEinzeldifferenz([]).margeBrutto === 0 &&
      SteuerBerechnung.margeEinzeldifferenz(null).margeBrutto === 0);

// ── C) Gesamtdifferenz war nie betroffen — darf sich nicht veraendern ─────────
check('C1 Gesamtdifferenz: volle Retoure ergibt 0',
      rund(SteuerBerechnung.margeGesamtdifferenz(
          [verkauf, { margeKorrektur: -50, satz: 19 }], 0, 19
      ).bemessungsgrundlage) === 0);

check('C2 Gesamtdifferenz: Ueberhang wandert in den Vortrag statt ins Minus',
      rund(SteuerBerechnung.margeGesamtdifferenz(
          [verkauf, { margeKorrektur: -80, satz: 19 }], 0, 19
      ).neuerVortrag) === -30);

// ── D) Quelltext: jede Push-Stelle muss ein ref mitgeben ──────────────────────
const uvaSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'ustvoranmeldung.js'), 'utf8');
const pushes = uvaSrc.match(/diff25aPositionenRoh\.push\(\{[^}]*\}\)/g) || [];
const pushesRoh = (uvaSrc.match(/diff25aPositionenRoh\.push\(/g) || []).length;
// Stand 2026-09-02 sind es genau fuenf: Gutschrift + Rechnungsposition (Soll), Direktverkauf,
// Ist-Verkauf, Retoure. Der Vergleich mit pushesRoh faengt ab, dass der Regex eine Stelle
// verschluckt und D2 dann faelschlich gruen meldet.
check('D1 alle Push-Stellen erfasst (' + pushes.length + ' von ' + pushesRoh + ')',
      pushes.length === pushesRoh && pushes.length >= 5);
const ohneRef = pushes.filter(p => !/\bref:/.test(p));
check('D2 jede Push-Stelle setzt ref — ohne ref verrechnet Einzeldifferenz nicht (' +
      ohneRef.length + ' ohne)', ohneRef.length === 0);

console.log('\n' + pass + '/' + total + ' bestanden');
process.exit(pass === total ? 0 : 1);
