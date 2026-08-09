// Regressionstest: degressive→lineare AfA-Umschaltung im Anschaffungsjahr (§7 Abs.2 EStG)
// Bug: linearNow wurde im Anschaffungsjahr als VOLLER Jahresbetrag (bw/verbleibend) berechnet
// und gegen die zeitanteilige degressive AfA (thisYearAfa) verglichen — ungleiche Grundlage.
// Fix: linearNow muss im Anschaffungsjahr mit demselben Monatsanteil wie die degressive
// Berechnung zeitanteilig sein, bevor Math.max(thisYearAfa, linearNow) entscheidet.
//
// Ausführen: node test/test-afa-degressiv-linear.js
'use strict';
const assert = require('assert');
const Afa = require('../js/afa.js');

let pass = 0;

// ─────────────────────────────────────────────────────────────────
// Test 1: Beispiel aus dem Audit — AK 6.000 €, ND 6 Jahre, Kauf 01.07.2024
// (kaufMonat = Juli → halbes Jahr im Anschaffungsjahr, degFactor 2024 = 2,0×/20% Cap)
//
// Degressiver Satz: min(1/6 * 2.0, 0.20) = min(0.3333, 0.20) = 0.20 (20% Cap greift)
// Degressiv zeitanteilig (Kaufjahr): 6000 * 0.20 * (6/12) = 600 €
// Linear voll (falsch, Bug):          6000 / 6              = 1000 €
// Linear zeitanteilig (korrekt):      1000 * (6/12)          = 500 €
//
// 600 > 500 → degressiv gewinnt im Anschaffungsjahr weiterhin (richtig).
// Mit dem Bug hätte Math.max(600, 1000) fälschlich 1000 € zurückgegeben.
// ─────────────────────────────────────────────────────────────────
{
    const asset = {
        anschaffungskosten: 6000,
        nutzungsdauer: 6,
        anschaffungsdatum: '2024-07-01',
        methode: 'degressiv'
    };
    const afa2024 = Afa._calcJahresAfa(asset, 2024);
    assert.ok(Math.abs(afa2024 - 600) < 0.01,
        `Anschaffungsjahr-AfA muss ≈600€ sein (zeitanteilig degressiv), war ${afa2024}`);
    assert.ok(afa2024 < 999.99,
        `Bug-Regression: darf NICHT den vollen linearen Jahresbetrag (1000€) liefern, war ${afa2024}`);
    pass++; console.log(`✓ Test 1: Anschaffungsjahr 2024 = ${afa2024.toFixed(2)}€ (erwartet ≈600€, degressiv gewinnt zeitanteilig)`);
}

// ─────────────────────────────────────────────────────────────────
// Test 2: Kein verfrühter Linear-Wechsel im Anschaffungsjahr nur wegen des Bugs.
// Gleiches Beispiel, aber explizit geprüft: der volle lineare Jahresbetrag (1000€)
// darf im Anschaffungsjahr niemals als linearNow-Vergleichswert herangezogen werden,
// weil das den Wechsel zu linear künstlich vorzieht (voller Betrag > zeitanteiliger
// degressiver Betrag, obwohl der korrekte zeitanteilige lineare Vergleichswert
// tatsächlich niedriger ist als der degressive).
// Variante mit noch kürzerem Anschaffungsmonat-Rest (Kauf 01.11., nur 2/12 Jahr),
// wo der Effekt noch krasser ist: voller linearer Betrag würde IMMER "gewinnen"
// und den (eigentlich noch klar vorteilhaften) degressiven Betrag verdrängen.
// ─────────────────────────────────────────────────────────────────
{
    const asset = {
        anschaffungskosten: 6000,
        nutzungsdauer: 6,
        anschaffungsdatum: '2024-11-01', // kaufMonat = Oktober(0-idx)=10 → nur 2/12 Jahr
        methode: 'degressiv'
    };
    // degRate wie oben: 0.20 (Cap)
    // Degressiv zeitanteilig: 6000 * 0.20 * (2/12) = 200€
    // Linear voll (Bug):       6000/6 = 1000€  → würde bei fehlerhaftem Vergleich immer gewinnen
    // Linear zeitanteilig:     1000 * (2/12) = 166.67€ → degressiv (200€) bleibt korrekt höher
    const afa2024 = Afa._calcJahresAfa(asset, 2024);
    assert.ok(Math.abs(afa2024 - 200) < 0.01,
        `Anschaffungsjahr-AfA muss ≈200€ sein (degressiv zeitanteilig gewinnt), war ${afa2024}`);
    assert.ok(afa2024 < 999.99,
        `Bug-Regression: kein verfrühter Wechsel auf den vollen linearen Jahresbetrag, war ${afa2024}`);
    pass++; console.log(`✓ Test 2: Anschaffungsjahr 2024 (Kauf 01.11.) = ${afa2024.toFixed(2)}€ (erwartet ≈200€, kein verfrühter Linear-Wechsel)`);
}

// ─────────────────────────────────────────────────────────────────
// Test 3: Sanity-Check — Januar-Kauf (voller Jahresanteil, fraction=1) bleibt unverändert.
// Hier ist kaufMonat=0, also (12-0)/12=1 → linearNow===linearVoll, der Fix darf
// dieses (unkritische) Verhalten nicht verändern.
// ─────────────────────────────────────────────────────────────────
{
    const asset = {
        anschaffungskosten: 6000,
        nutzungsdauer: 6,
        anschaffungsdatum: '2024-01-01',
        methode: 'degressiv'
    };
    // Degressiv: 6000 * 0.20 = 1200€. Linear voll = 1000€. Degressiv gewinnt (1200 > 1000).
    const afa2024 = Afa._calcJahresAfa(asset, 2024);
    assert.ok(Math.abs(afa2024 - 1200) < 0.01,
        `Voll-Jahr-Kauf: AfA muss 1200€ sein (degressiv, kein Zeitanteil-Unterschied), war ${afa2024}`);
    pass++; console.log(`✓ Test 3: Januar-Kauf (Vollanteil) = ${afa2024.toFixed(2)}€ (erwartet 1200€, Verhalten unverändert)`);
}

console.log(`\n${pass}/3 Tests bestanden ✅`);
