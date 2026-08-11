// Künstlersozialabgabe — Satz und Freigrenze jahresabhängig:  node test/test-ksa-jahresabhaengig.js
//
// Fund T1 des Steuer-Vergleichs-Audits (2026-08-10): _KSA_SATZ und _KSA_BAGATELLGRENZE waren feste
// Konstanten mit den 2026er-Werten, obwohl _ksaJahressumme(year) für ein beliebiges Jahr rechnet.
// Rückwärts falsch (2025er-Honorare mit 4,9 % und 1.000-€-Grenze statt 5,0 % und 700 €), vorwärts
// falsch ab 1.1.2027 (Satz steigt wieder auf 5,0 %, wäre still zu niedrig geblieben).
//
// Rechtsstand (Quellen im Kommentar von Ausgaben._getKsaWerte):
//   Abgabesatz: bis 2025 = 5,0 % · 2026 = 4,9 % · 2027 = 5,0 % (KSA-VO 2027, BMAS Juli 2026)
//   Freigrenze §24 Abs. 2 Satz 2 KSVG: bis 2024 = 450 € · 2025 = 700 € · ab 2026 = 1.000 €
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Ausgaben ist ein Browser-Objektliteral ohne module.exports — die beiden reinen Rechenfunktionen
// werden aus der Datei herausgeschnitten und einzeln ausgewertet. Kein Store/DOM nötig.
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'ausgaben.js'), 'utf8');
const m = src.match(/_getKsaWerte\(year\)\s*\{[\s\S]*?\n    \},/);
assert.ok(m, '_getKsaWerte in js/ausgaben.js nicht gefunden — Test an den Code anpassen');
const Ausgaben = new Function('return { ' + m[0] + ' };')();

let pass = 0;

// 1) Abgabesatz je Jahr
assert.strictEqual(Ausgaben._getKsaWerte(2024).satz, 0.050, '2024: 5,0 %');
assert.strictEqual(Ausgaben._getKsaWerte(2025).satz, 0.050, '2025: 5,0 %');
assert.strictEqual(Ausgaben._getKsaWerte(2026).satz, 0.049, '2026: 4,9 % (einmalige Absenkung)');
assert.strictEqual(Ausgaben._getKsaWerte(2027).satz, 0.050, '2027: 5,0 % (KSA-VO 2027)');
pass++; console.log('✓ Abgabesatz je Jahr korrekt (2026 ist der Ausreißer)');

// 2) Freigrenze je Jahr — §24 Abs. 2 Satz 2 KSVG i.d.F. Art. 56 Nr. 1 BEG IV
assert.strictEqual(Ausgaben._getKsaWerte(2024).bagatelle, 450, '2024: 450 €');
assert.strictEqual(Ausgaben._getKsaWerte(2025).bagatelle, 700, '2025: 700 € (Übergangsregelung)');
assert.strictEqual(Ausgaben._getKsaWerte(2026).bagatelle, 1000, '2026: 1.000 €');
assert.strictEqual(Ausgaben._getKsaWerte(2030).bagatelle, 1000, 'Folgejahre: 1.000 €');
pass++; console.log('✓ Freigrenze je Jahr korrekt');

// 3) Der konkrete Fehlerfall aus der Fundbeschreibung: 850 € Honorare in 2025.
//    Vorher wurde gegen die 1.000-€-Grenze geprüft → "nicht abgabepflichtig", obwohl 850 € über
//    der damals geltenden 700-€-Grenze lagen. Und weil die Grenze eine FREIGRENZE ist, wird die
//    GESAMTE Jahressumme abgabepflichtig, nicht nur der übersteigende Teil.
const w2025 = Ausgaben._getKsaWerte(2025);
assert.ok(850 > w2025.bagatelle, '850 € in 2025 sind abgabepflichtig');
assert.strictEqual(Math.round(850 * w2025.satz * 100) / 100, 42.5, 'KSA auf die volle Summe: 42,50 €');
// Gegenprobe: dieselben 850 € in 2026 sind es NICHT (Grenze 1.000 €)
assert.ok(850 < Ausgaben._getKsaWerte(2026).bagatelle, '850 € in 2026 bleiben unter der Grenze');
pass++; console.log('✓ 850 € Honorare: 2025 abgabepflichtig (42,50 €), 2026 nicht');

// 4) Jahreswechsel 2027 kippt den Betrag sichtbar statt still
const summe = 10000;
assert.strictEqual(summe * Ausgaben._getKsaWerte(2026).satz, 490, '2026: 490 €');
assert.strictEqual(summe * Ausgaben._getKsaWerte(2027).satz, 500, '2027: 500 €');
pass++; console.log('✓ 10.000 € Honorare: 490 € (2026) vs. 500 € (2027)');

// 5) Unbekannte Zukunftsjahre rechnen mit dem letzten bekannten Satz weiter, nicht mit 0
const zukunft = Ausgaben._getKsaWerte(2035);
assert.strictEqual(zukunft.satz, 0.050, 'Zukunft: letzter bekannter Satz, keine 0');
assert.ok(zukunft.satz > 0, 'nie 0 — eine stille Unterzahlung wäre der schlimmere Fehler');
pass++; console.log('✓ unbekannte Zukunftsjahre fallen auf den letzten bekannten Satz zurück');

// 6) Robustheit gegen die Aufrufer: year kommt an einer Stelle als String ('2026' aus dem
//    Datumsfeld), an der anderen als Number (getFullYear())
assert.deepStrictEqual(Ausgaben._getKsaWerte('2025'), Ausgaben._getKsaWerte(2025), 'String == Number');
assert.strictEqual(Ausgaben._getKsaWerte('2026').satzText, '4,9%', 'Anzeigetext deutsch formatiert');
assert.strictEqual(Ausgaben._getKsaWerte(2027).satzText, '5,0%', 'Anzeigetext 5,0% statt 5%');
pass++; console.log('✓ String- und Number-Jahre gleichwertig, Satztext deutsch formatiert');

console.log('\n' + pass + '/6 Tests bestanden ✅');
