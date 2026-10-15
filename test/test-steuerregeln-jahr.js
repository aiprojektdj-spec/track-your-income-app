// Regression Audit 2026-10-13, T09/T10/T11/T12 — Jahresregeln mit unabhängig vorgegebenen Sollwerten.
//
// T09: §18 Abs.2 UStG — monatlich erst bei Vorjahressteuer über 9.000 € (ab 2025), Gründer-
//      Ausnahme 2021–2026 mit Umrechnung.
// T10: KSt- und GewSt-Verlustvortrag getrennt, Mindestbesteuerung (§10d EStG 70 % 2024–2027,
//      §10a GewStG 60 %, Sockel 1 Mio. €).
// T11: PStTG — kein Verkäufer-Pflichttermin zum 31.03.
// T12: §23 KStG — 15 % bis 2027, 14 % 2028 … 10 % ab 2032.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

let fail = 0, pass = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: erwartet ${b}, war ${a}`);

// ── T09 ──
const uva = ladeModule(['js/ustvoranmeldung.js'], { Store: { getSettings: () => ({}) }, Utils: {} }).UstVoranmeldung;
check('T09: 2026, Vorjahressteuer 8.000 € → keine Monatspflicht (alte 7.500-€-Grenze)', () => {
    assert.strictEqual(uva._monatspflicht(2026, 8000, '').pflicht, false);
});
check('T09: 2026 Grenze 9.000 € — exakt 9.000 nein, 9.000,01 ja', () => {
    assert.strictEqual(uva._monatspflicht(2026, 9000, '').pflicht, false);
    assert.strictEqual(uva._monatspflicht(2026, 9000.01, '').pflicht, true);
});
check('T09: 2024 galt 7.500 € — 8.000 € → monatlich', () => {
    assert.strictEqual(uva._monatspflicht(2024, 8000, '').pflicht, true);
});
check('T09: Befreiungsgrenze 2.000 € ab 2025, 1.000 € davor', () => {
    assert.strictEqual(uva._voranmeldungsRegeln(2026).befreiungBis, 2000);
    assert.strictEqual(uva._voranmeldungsRegeln(2024).befreiungBis, 1000);
});
check('T09: Gründer 2026 im Gründungsjahr — hängt von der voraussichtlichen Steuer ab, keine Pauschalpflicht', () => {
    const r = uva._monatspflicht(2026, 0, '2026-04-01');
    assert.strictEqual(r.pflicht, null); assert.strictEqual(r.grund, 'schaetzung');
});
check('T09: Folgejahr 2026 nach Gründung 01.07.2025 — Umrechnung: 4.000 → 8.000 nein, 5.000 → 10.000 ja', () => {
    assert.strictEqual(uva._monatspflicht(2026, 4000, '2025-07-01').pflicht, false);
    assert.strictEqual(uva._monatspflicht(2026, 5000, '2025-07-01').pflicht, true);
});
check('T09: Gründer 2027 (Ausnahme ausgelaufen) — monatlich nach §18 Abs.2 S.4', () => {
    assert.strictEqual(uva._monatspflicht(2027, 0, '2027-03-01').pflicht, true);
    assert.strictEqual(uva._monatspflicht(2028, 100, '2027-03-01').pflicht, true);
});

// ── T10/T12 ──
function kst(data) {
    return ladeModule(['js/koerperschaftsteuer.js'], {
        Store: { get: k => k === 'kst_data' ? data : k === 'gbr_einstellungen' ? { hebesatz: 400 } : null, set() {} },
        Utils: {}
    }).Koerperschaftsteuer;
}
check('T10: 2026, 2 Mio. Gewinn, je 2 Mio. Vortrag → KSt-Basis 300.000, GewSt-Basis 400.000, Restvorträge bleiben', () => {
    const K = kst({ 2026: { verlustvortrag: 2000000, verlustvortragGewSt: 2000000 } });
    const r = K._calcKSt(2000000, 2026);
    near(r.zvE, 300000, 'KSt-Basis');
    near(r.kst, 45000, 'KSt');
    near(r.solz, 2475, 'SolZ');
    near(r.gewerbeertrag, 400000, 'GewSt-Basis');
    near(r.gewSt, 56000, 'GewSt');
    near(r.neuerVerlust, 300000, 'Rest KSt-Vortrag');
    near(r.neuerVerlustGewSt, 400000, 'Rest GewSt-Vortrag');
});
check('T10: getrennte Vorträge — GewSt-Vortrag 0, KSt-Vortrag 500.000', () => {
    const K = kst({ 2026: { verlustvortrag: 500000, verlustvortragGewSt: 0 } });
    const r = K._calcKSt(800000, 2026);
    near(r.zvE, 300000, 'KSt-Basis (unter Sockel voll abziehbar)');
    near(r.gewerbeertrag, 800000, 'GewSt-Basis ohne Abzug');
});
check('T10: 2028 Mindestbesteuerung KSt wieder 60 %', () => {
    const K = kst({ 2028: { verlustvortrag: 2000000, verlustvortragGewSt: 2000000 } });
    near(K._calcKSt(2000000, 2028).zvE, 400000, 'KSt-Basis 2028');
});
check('T10: Verlustjahr erhöht den Vortrag', () => {
    const K = kst({ 2026: { verlustvortrag: 1000, verlustvortragGewSt: 1000 } });
    const r = K._calcKSt(-5000, 2026);
    near(r.zvE, 0, 'zvE'); near(r.neuerVerlust, 6000, 'KSt-Vortrag'); near(r.neuerVerlustGewSt, 6000, 'GewSt-Vortrag');
});
check('T12: KSt-Satz 2026/2027 15 %, 2028 14 %, 2031 11 %, ab 2032 10 %', () => {
    const K = kst({});
    assert.deepStrictEqual([2026, 2027, 2028, 2029, 2030, 2031, 2032, 2040].map(y => K._kstSatz(y)),
        [0.15, 0.15, 0.14, 0.13, 0.12, 0.11, 0.10, 0.10]);
    near(K._calcKSt(100000, 2028).kst, 14000, 'KSt 2028 auf 100.000');
});

// ── T11 ──
check('T11: kein PStTG-Pflichttermin 31.03. für Verkäufer', () => {
    const T = ladeModule(['js/steuertermine.js'], {
        Store: { getSettings: () => ({ ustMode: 'klein' }), get: () => null, getSteuertermine: () => [], getSales: () => [] },
        Utils: { todayISO: () => '2026-01-01', escapeHtml: s => String(s), formatDate: s => s }
    }).Steuertermine;
    const pstg = T._getFixedTermine(2027).filter(t => t.typ === 'pstg');
    assert.ok(!pstg.some(t => t.datum.slice(5) === '03-31'), 'kein 31.03.');
    assert.ok(pstg.every(t => /freiwillig/i.test(t.beschreibung)), 'als freiwillige Prüfung benannt');
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
