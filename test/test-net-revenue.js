// Utils.calculateNetRevenue — der Nettoerloes eines Verkaufs.
//
// Fund A3 aus plan/funde-vollaudit-2026-09-09.md an seiner Wurzel: die Funktion berechnete
// die Plattformgebuehr auf (verkaufspreis + versandkostenKaeufer), erkannte den
// Kaeufer-Versand also als Kostenbasis an — buchte ihn aber nicht als Einnahme. Das
// Ergebnis war um genau versandkostenKaeufer zu niedrig.
//
// Der A3-Fix vom 2026-09-09 traf nur Dashboard._getYearStats(). Diese Hilfsfunktion blieb
// stehen und speist js/buchungen.js, js/dashboard.js und fuenf Stellen in js/statistiken.js.
// Aufgefallen ist das einer Parallel-Session beim Bauen des statistiken-Harness.
'use strict';
const assert = require('assert');
const fs = require('fs');

function extractMethod(src, startMarker, endMarkerRe) {
    const startIdx = src.indexOf(startMarker);
    assert.ok(startIdx !== -1, 'Marker nicht gefunden: ' + startMarker);
    const rest = src.slice(startIdx + startMarker.length);
    const m = rest.match(endMarkerRe);
    assert.ok(m, 'Ende-Marker nicht gefunden nach ' + startMarker);
    return rest.slice(0, m.index);
}

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}

const utilsSrc = fs.readFileSync(__dirname + '/../js/utils.js', 'utf8');
const netRevenue = new Function(
    'verkaufspreis', 'versandkostenKaeufer', 'plattformgebuehrProzent', 'versandkostenVerkaufer',
    extractMethod(utilsSrc,
        'calculateNetRevenue(verkaufspreis, versandkostenKaeufer, plattformgebuehrProzent, versandkostenVerkaufer) {',
        /\n    \},/));

// ── Der Fall aus dem Fund ────────────────────────────────────────────────────
// 100 EUR Verkauf, 5 EUR Kaeufer-Versand, 10 % Gebuehr, 4 EUR Porto.
// Der Kaeufer zahlt 105, die Plattform behaelt 10,50, das Porto kostet 4 -> 90,50.
{
    const n = netRevenue(100, 5, 10, 4);
    check('Nettoerloes = 90,50 (nicht 85,50 wie vor dem Fix)', Math.abs(n - 90.50) < 0.001);
    check('Der Kaeufer-Versand ist drin: ohne ihn waere es genau 5 weniger',
        Math.abs(n - (netRevenue(100, 0, 10, 4) + 5 - 0.5)) < 0.001);
}

// ── Die Gebuehr liegt weiter auf Verkauf PLUS Kaeufer-Versand ────────────────
// Das war am alten Code richtig und muss so bleiben: die Plattformen rechnen ihre
// Provision auf den Gesamtbetrag, den der Kaeufer zahlt.
{
    check('Gebuehr auf (vk + vkKaeufer): 10 % von 105 = 10,50',
        Math.abs(netRevenue(100, 5, 10, 0) - 94.50) < 0.001);
    check('Ohne Kaeufer-Versand: 10 % von 100 = 10,00',
        Math.abs(netRevenue(100, 0, 10, 0) - 90.00) < 0.001);
}

// ── Uebereinstimmung mit der EUER ────────────────────────────────────────────
// js/euer.js zaehlt (verkaufspreis + versandkostenKaeufer) zur Einnahme und die Gebuehr
// sowie den Verkaeufer-Versand zu den Ausgaben. Dieselbe Groesse, anderer Weg.
{
    const vk = 250, vkK = 12.90, geb = 8.5, vkV = 6.40;
    const euerWeg = (vk + vkK) - ((vk + vkK) * geb / 100) - vkV;
    check('Deckt sich mit der EUER-Rechnung',
        Math.abs(netRevenue(vk, vkK, geb, vkV) - euerWeg) < 0.001);
}

// ── Randfaelle ───────────────────────────────────────────────────────────────
{
    check('Alles leer ergibt 0, nicht NaN', netRevenue() === 0);
    check('Strings werden geparst (Formularfelder liefern Text)',
        Math.abs(netRevenue('100', '5', '10', '4') - 90.50) < 0.001);
    check('Unbrauchbare Eingaben fallen auf 0 statt NaN',
        netRevenue('abc', null, undefined, {}) === 0);
    check('Ohne Gebuehr und Porto bleibt der volle Bruttobetrag',
        Math.abs(netRevenue(100, 5, 0, 0) - 105) < 0.001);
    // Ein Verlustgeschaeft darf negativ herauskommen und nicht auf 0 gefloort werden --
    // sonst verschwindet der Verlust aus jeder Auswertung.
    check('Verlust bleibt negativ', netRevenue(10, 0, 20, 15) < 0);
}

// ── Regressionsschutz ────────────────────────────────────────────────────────
{
    const ohneKommentare = utilsSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const koerper = extractMethod(ohneKommentare,
        'calculateNetRevenue(verkaufspreis, versandkostenKaeufer, plattformgebuehrProzent, versandkostenVerkaufer) {',
        /\n    \},/);
    check('Regression: die Rueckgabe addiert den Kaeufer-Versand',
        /return\s+vk\s*\+\s*vkKaeufer\s*-\s*plattformGebuehr\s*-\s*vkVerkaufer/.test(koerper));
    check('Regression: die alte Fassung ohne vkKaeufer ist weg',
        !/return\s+vk\s*-\s*plattformGebuehr\s*-\s*vkVerkaufer/.test(koerper));
}

console.log('\n' + pass + '/' + total + ' Checks bestanden');
if (pass !== total) process.exit(1);
