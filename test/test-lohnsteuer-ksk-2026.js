// Regressionstest für die 2026-Aktualisierung von js/lohnsteuer.js und js/ksk.js:
//   node test/test-lohnsteuer-ksk-2026.js
//
// Lädt beide Dateien über vm.runInContext als ECHTEN Code (kein Nachbau der Formeln).
// `const Lohnsteuer = {...}` bzw. `const Ksk = {...}` wird dazu in-memory (nicht auf der
// Festplatte!) zu `const X = module.exports = {...}` erweitert, damit der reale Objekt-Literal
// als CommonJS-Export verfügbar wird — Top-Level-`const` landet in einem vm-Kontext sonst NICHT
// auf dem Sandbox-Objekt (anders als `var`), daher dieser Umweg statt eines einfachen require().
// Ein Stub für `window` genügt, weil am Dateiende nur `if (window.Actions) Actions.register(...)`
// steht (Actions ist undefined → window.Actions ist falsy → der Block wird übersprungen).
//
// Recherchierte Quelle für alle 2026-Werte (siehe auch Kommentare in js/lohnsteuer.js/js/ksk.js):
// Sozialversicherungsrechengrößen-Verordnung 2026 (BMAS, verkündet 26.11.2025, in Kraft seit
// 01.01.2026) — https://www.bmas.de/DE/Service/Gesetze-und-Gesetzesvorhaben/sozialversicherungs-rechengroessenverordnung-2026.html
// sowie § 3 SolzG (Soli-Freigrenze 2026, TK/Deutschland-Rechner, mehrfach querverifiziert).
// Recherchiert am 2026-07-30.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

let pass = 0, fail = 0;
function eq(name, got, want) {
    const g = JSON.stringify(got);
    const w = JSON.stringify(want);
    if (g === w) { console.log('✓ ' + name); pass++; }
    else { console.log('✗ ' + name + ' — got ' + g + ' want ' + w); fail++; }
}
function ok(name, cond, detail) {
    if (cond) { console.log('✓ ' + name); pass++; }
    else { console.log('✗ ' + name + (detail ? ' — ' + detail : '')); fail++; }
}
function close(name, got, want, eps = 0.01) {
    const d = Math.abs(got - want);
    if (d <= eps) { console.log('✓ ' + name); pass++; }
    else { console.log('✗ ' + name + ' — got ' + got + ' want ~' + want + ' (Δ' + d.toFixed(4) + ')'); fail++; }
}

// ── Loader: echten Objekt-Literal aus der Quelldatei als module.exports ausführen ──────────
function loadRealModule(relPath, varName) {
    const filePath = path.join(__dirname, relPath);
    const src = fs.readFileSync(filePath, 'utf8');
    const marker = `const ${varName} = {`;
    assert(src.includes(marker), `Marker "${marker}" nicht in ${relPath} gefunden — Variable umbenannt?`);
    const patched = src.replace(marker, `const ${varName} = module.exports = {`);

    const sandbox = { module: { exports: {} }, window: {}, console, document: undefined };
    vm.createContext(sandbox);
    vm.runInContext(patched, sandbox, { filename: relPath });
    return sandbox.module.exports;
}

const Lohnsteuer = loadRealModule('../js/lohnsteuer.js', 'Lohnsteuer');
const Ksk = loadRealModule('../js/ksk.js', 'Ksk');

console.log('\n── Fix 1+3: BBG 2026 bundeseinheitlich — lohnsteuer.js und ksk.js müssen übereinstimmen ──');

// Amtliche 2026-Werte (SVBezGrV 2026): KV/PV 69.750 €/Jahr (5.812,50 €/Monat),
// RV/AV 101.400 €/Jahr (8.450 €/Monat) — bundeseinheitlich seit 2025.
eq('Lohnsteuer.BBG.kv (KV/PV, jährlich) = amtlicher 2026-Wert', Lohnsteuer.BBG.kv, 69750);
eq('Lohnsteuer.BBG.rv (RV/AV, jährlich) = amtlicher 2026-Wert', Lohnsteuer.BBG.rv, 101400);

const kskBbg2026 = Ksk._getBBG(2026);
eq('Ksk._BBG[2026].kvpv (monatlich) = amtlicher 2026-Wert', kskBbg2026.kvpv, 5812.50);
eq('Ksk._BBG[2026].rv (monatlich) = amtlicher 2026-Wert', kskBbg2026.rv, 8450.00);

ok('Ksk 2026 BBG ist NICHT mehr identisch zu 2025 (Bug behoben)',
    JSON.stringify(Ksk._getBBG(2026)) !== JSON.stringify(Ksk._getBBG(2025)));

close('KV/PV-BBG: Lohnsteuer (Jahr) === Ksk (Monat) × 12 — beide bundeseinheitlich',
    Lohnsteuer.BBG.kv, kskBbg2026.kvpv * 12);
close('RV/AV-BBG: Lohnsteuer (Jahr) === Ksk (Monat) × 12 — beide bundeseinheitlich',
    Lohnsteuer.BBG.rv, kskBbg2026.rv * 12);

console.log('\n── Fix 1: SV-Beitragssätze 2026 (AG-Anteil) — amtliche Werte ──');
close('KV AG-Anteil 2026 = 7,3% + Ø-Zusatzbeitrag/2 (2,9%/2) = 8,75%', Lohnsteuer.SV.kv, 0.0875, 0.0001);
close('RV AG-Anteil 2026 = 18,6%/2 = 9,3% (unverändert ggü. 2025)', Lohnsteuer.SV.rv, 0.093, 0.0001);
close('AV AG-Anteil 2026 = 2,6%/2 = 1,3% (unverändert ggü. 2025)', Lohnsteuer.SV.av, 0.013, 0.0001);
close('PV AG-Anteil 2026 = 3,6%/2 = 1,8% (unverändert ggü. 2025)', Lohnsteuer.SV.pv, 0.018, 0.0001);

console.log('\n── Fix 2: Soli-Freigrenze § 3 SolzG (2026: 20.350 € ledig / 40.700 € Splitting) ──');
eq('SOLI_FREIGRENZE_SINGLE = 20.350 €', Lohnsteuer.SOLI_FREIGRENZE_SINGLE, 20350);
eq('SOLI_FREIGRENZE_SPLIT = 40.700 €', Lohnsteuer.SOLI_FREIGRENZE_SPLIT, 40700);

// StKl 5 multipliziert den Pauschalsatz mit 1,3 (bereits vorher im Code) — das erlaubt uns,
// den Umschlagpunkt der Freigrenze exakt innerhalb einer einzigen Tarifstufe (24%) zu treffen,
// ohne die Sprungstellen zwischen den Pauschalstufen zu berühren.
//   jahresBrutto=65.200 → lstSatz=0,24×1,3=0,312 → Jahres-Lohnsteuer = 65.200×0,312 = 20.342,40 € (< 20.350 €)
const knappUnter = Lohnsteuer._calcMonat(65200 / 12, 5);
close('Knapp UNTER der Freigrenze (Jahres-LSt 20.342,40 €) → Soli = 0', knappUnter.solz, 0, 0.001);

//   jahresBrutto=65.300 → Jahres-Lohnsteuer = 65.300×0,312 = 20.373,60 € (> 20.350 €, Milderungszone)
const knappUeber = Lohnsteuer._calcMonat(65300 / 12, 5);
ok('Knapp ÜBER der Freigrenze (Jahres-LSt 20.373,60 €) → Soli > 0', knappUeber.solz > 0,
    'solz=' + knappUeber.solz);

//   Deutlich darüber: jahresBrutto=120.000 (StKl 1) → lstSatz=0,35 → Jahres-LSt 42.000 € ≫ 20.350 €
const deutlichUeber = Lohnsteuer._calcMonat(120000 / 12, 1);
ok('Deutlich ÜBER der Freigrenze (Jahres-LSt 42.000 €, StKl 1) → Soli > 0', deutlichUeber.solz > 0,
    'solz=' + deutlichUeber.solz);
// Außerhalb der Milderungszone gilt der volle Satz von 5,5% der Jahres-Lohnsteuer.
close('Deutlich über Freigrenze: voller Soli-Satz 5,5% greift (Milderungszone verlassen)',
    deutlichUeber.solz * 12, 42000 * 0.055, 0.5);

// Sehr niedriges Einkommen bleibt unter der Freigrenze → Soli = 0 (Basisfall, unverändert)
const niedrig = Lohnsteuer._calcMonat(2500, 1);
eq('Niedriges Einkommen (30.000 €/Jahr brutto, StKl 1) → Soli = 0', niedrig.solz, 0);

// Splitting-Freigrenze (StKl 3/4/5) ist doppelt so hoch wie die Einzelveranlagung (StKl 1/2/6):
// gleiches Bruttoeinkommen, das bei Einzelveranlagung bereits Soli auslöst, bleibt bei
// Zusammenveranlagung (StKl 3) darunter.
const stKl3 = Lohnsteuer._calcMonat(122449 / 12, 3);   // lstSatz 0,35×0,7=0,245 → Jahres-LSt ≈ 30.000 € (< 40.700 €)
const stKl1gleichesBrutto = Lohnsteuer._calcMonat(122449 / 12, 1); // lstSatz 0,35 → Jahres-LSt ≈ 42.857 € (> 20.350 €)
ok('StKl 3 (Splitting-Freigrenze 40.700 €) bei Jahres-LSt ≈30.000 € → Soli = 0', stKl3.solz === 0);
ok('Gleiches Brutto bei StKl 1 (Freigrenze 20.350 €) → Soli > 0', stKl1gleichesBrutto.solz > 0);

console.log('\n── Fix 3: KSK PV-Kinderlosenzuschlag §55 Abs.3 SGB XI ──');
const jahreseinkommen = 30000; // monatl. 2.500 € — unterhalb aller 2026-BBG, keine Kappung nötig

const mitKindern = Ksk._calcBeitrag(jahreseinkommen, 2026, true);
const ohneKinder = Ksk._calcBeitrag(jahreseinkommen, 2026, false);

close('Mit Kindern: PV-Satz bleibt Basissatz 1,8% (kein Zuschlag)', mitKindern.pvSatz, 0.018, 0.0001);
close('Ohne Kinder: PV-Satz = Basissatz + Kinderlosenzuschlag = 1,8% + 0,6% = 2,4%', ohneKinder.pvSatz, 0.024, 0.0001);
close('Mit Kindern: PV-Jahresbeitrag = 2.500 × 1,8% × 12 = 540 €', mitKindern.pv, 540, 0.01);
close('Ohne Kinder: PV-Jahresbeitrag = 2.500 × 2,4% × 12 = 720 €', ohneKinder.pv, 720, 0.01);
close('Differenz Kinderlosenzuschlag = 2.500 × 0,6% × 12 = 180 €', ohneKinder.pv - mitKindern.pv, 180, 0.01);
ok('Kinderlosenzuschlag NICHT auf KV/RV angewendet (nur PV betroffen)',
    mitKindern.kv === ohneKinder.kv && mitKindern.rv === ohneKinder.rv);

close('Ksk KV-Satz 2026 = 7,3% + Ø-Zusatzbeitrag/2 = 8,75% (war zu niedrig: 7,5%)',
    Ksk._getSaetze(2026).kv, 0.0875, 0.0001);
ok('Ksk KV-Satz 2026 an Lohnsteuer.SV.kv (bundeseinheitlicher AN/AG-Satz) angeglichen',
    Ksk._getSaetze(2026).kv === Lohnsteuer.SV.kv);

console.log('\n' + '='.repeat(60));
console.log(`${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail > 0) process.exit(1);
