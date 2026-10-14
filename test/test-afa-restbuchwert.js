// Regression Audit 2026-10-13, T03 + T08: degressive AfA
// T03: Der Buchwert muss mit den tatsächlich angesetzten Jahresbeträgen fortgeschrieben werden;
//      Summe aller Jahre darf die Anschaffungskosten nie übersteigen.
// T08: Degressiv nur bei Anschaffung in einem gesetzlichen Zeitfenster (§7 Abs.2 EStG),
//      tagesgenau — 2025 erst ab 01.07., 2024 erst ab 01.04.
// Sollwerte von Hand nach §7 Abs.2/3 EStG gerechnet, nicht aus dem Code abgeleitet.
// Ausführen: node test/test-afa-restbuchwert.js   (AFA_PATH=... für einen anderen Stand)
'use strict';
const assert = require('assert');
const path = require('path');
const Afa = require(process.env.AFA_PATH ? path.resolve(process.env.AFA_PATH) : '../js/afa.js');

let fail = 0, pass = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + e.message); }
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.011, `${msg}: erwartet ${b}, war ${a}`);
const summe = (asset, von, bis) => { let t = 0; for (let y = von; y <= bis; y++) t += Afa._calcJahresAfa(asset, y); return t; };

check('T03 Audit-Beispiel: AK 10.000, 01.01.2026, ND 5 — Jahreswerte nach Wechsel zu linear', () => {
    const a = { anschaffungskosten: 10000, nutzungsdauer: 5, anschaffungsdatum: '2026-01-01', methode: 'degressiv' };
    // 2026: 30 % von 10.000 = 3.000 · 2027: 30 % von 7.000 = 2.100
    // 2028: degressiv 30 % von 4.900 = 1.470 < linear 4.900/3 = 1.633,33 → Wechsel
    // 2029/2030: Restbuchwert gleichmäßig auf Restnutzungsdauer · 2031: nichts mehr
    near(Afa._calcJahresAfa(a, 2026), 3000, '2026');
    near(Afa._calcJahresAfa(a, 2027), 2100, '2027');
    near(Afa._calcJahresAfa(a, 2028), 1633.33, '2028');
    near(Afa._calcJahresAfa(a, 2029), 1633.34, '2029');
    near(Afa._calcJahresAfa(a, 2030), 1633.33, '2030');
    near(Afa._calcJahresAfa(a, 2031), 0, '2031 (nach vollständiger Abschreibung)');
    near(summe(a, 2026, 2035), 10000, 'Summe = AK');
});

check('T03 unterjähriger Kauf (01.09.2025, AK 12.000, ND 4): Summe = AK, kein Jahr über Restbuchwert', () => {
    const a = { anschaffungskosten: 12000, nutzungsdauer: 4, anschaffungsdatum: '2025-09-01', methode: 'degressiv' };
    // 2025: min(3×25 %, 30 %) = 30 % · 4/12 → 1.200 (linear wäre 12.000 · 4/48 = 1.000)
    near(Afa._calcJahresAfa(a, 2025), 1200, "2025");
    let bw = 12000;
    for (let y = 2025; y <= 2030; y++) {
        const v = Afa._calcJahresAfa(a, y);
        assert.ok(v <= bw + 0.005, `${y}: AfA ${v} > Restbuchwert ${bw}`);
        assert.ok(v >= 0, `${y}: negative AfA`);
        bw -= v;
    }
    near(summe(a, 2025, 2035), 12000, 'Summe = AK');
    near(Afa._buchwertEnde(a, 2029), 0, 'Buchwert Ende 2029');
});

check('T03 Invariante: Summe ≤ AK für viele Kombinationen', () => {
    for (const nd of [1, 2, 3, 5, 7, 10, 13]) for (const d of ['2020-01-15', '2022-12-01', '2024-04-01', '2025-07-01', '2027-06-30']) {
        const a = { anschaffungskosten: 9999.99, nutzungsdauer: nd, anschaffungsdatum: d, methode: 'degressiv' };
        const t = summe(a, 2009, 2050);
        assert.ok(t <= 9999.99 + 0.01, `ND ${nd}, ${d}: Summe ${t.toFixed(2)} > AK`);
        near(t, 9999.99, `ND ${nd}, ${d}: vollständig abgeschrieben`);
    }
});

check('T08: Kauf 01.01.2025 ist nicht begünstigt → linear 2.000 statt 3.000', () => {
    const a = { anschaffungskosten: 10000, nutzungsdauer: 5, anschaffungsdatum: '2025-01-01', methode: 'degressiv' };
    near(Afa._calcJahresAfa(a, 2025), 2000, '2025');
    assert.strictEqual(Afa._degressivUnzulaessig(a), true, 'Altbestand muss als unzulässig markiert werden');
});

check('T08: Stichtage 30.06./01.07.2025 und 31.03./01.04.2024', () => {
    const base = { anschaffungskosten: 12000, nutzungsdauer: 10, methode: 'degressiv' };
    // 30.06.2025: nicht begünstigt → linear 1.200 · 7/12 = 700
    near(Afa._calcJahresAfa({ ...base, anschaffungsdatum: '2025-06-30' }, 2025), 700, '30.06.2025');
    // 01.07.2025: 3×10 % = 30 % · 6/12 → 1.800
    near(Afa._calcJahresAfa({ ...base, anschaffungsdatum: '2025-07-01' }, 2025), 1800, '01.07.2025');
    // 31.03.2024: nicht begünstigt → linear 1.200 · 10/12 = 1.000
    near(Afa._calcJahresAfa({ ...base, anschaffungsdatum: '2024-03-31' }, 2024), 1000, '31.03.2024');
    // 01.04.2024: 2×10 % = 20 % · 9/12 → 1.800
    near(Afa._calcJahresAfa({ ...base, anschaffungsdatum: '2024-04-01' }, 2024), 1800, '01.04.2024');
    // 2023 komplett ausgeschlossen, 31.12.2027 letzter begünstigter Tag, 2028 wieder ausgeschlossen
    assert.strictEqual(Afa._degressivRegel('2023-06-01'), null, '2023');
    assert.ok(Afa._degressivRegel('2027-12-31'), '31.12.2027');
    assert.strictEqual(Afa._degressivRegel('2028-01-01'), null, '2028');
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
