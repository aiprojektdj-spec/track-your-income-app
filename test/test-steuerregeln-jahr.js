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
    return ladeModule(['js/gewerbesteuer.js', 'js/koerperschaftsteuer.js'], {
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

// ── A3 (2026-11-27): jahresfeste Gesetzeswerte → Jahresfunktionen, Werte unverändert ──
// Sollwerte sind die Konstanten, die vorher fest im Code standen. Für frühere Jahre gilt
// derselbe Wert (Annahme im Commit) — das prüft jeweils das Jahr 2018 mit.
const JAHRE = [2018, 2026, 2030];
const plain = x => JSON.parse(JSON.stringify(x));   // vm-Kontext hat eigene Prototypen
const gleichFuerAlle = (fn, soll) => JAHRE.forEach(y => assert.deepStrictEqual(plain(fn(y)), soll, 'Jahr ' + y));

check('A3-5: Steuertermine nutzt Statistiken._getPstTgSchwellen statt 30/2000', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'steuertermine.js'), 'utf8');
    assert.strictEqual(/count\s*>=\s*30|umsatz\s*>=\s*2000/.test(src), false, 'keine feste Schwelle mehr');
    assert.strictEqual((src.match(/v\.count >= pst\.verkaeufe \|\| v\.umsatz >= pst\.verguetung/g) || []).length, 2);
    assert.strictEqual(src.includes('Statistiken._getPstTgSchwellen(year)'), true);
    const S = ladeModule(['js/statistiken.js'], { Store: {}, Utils: {} }).Statistiken;
    assert.deepStrictEqual(plain(S._getPstTgSchwellen(2026)), { verkaeufe: 30, verguetung: 2000 });
});

check('A3-1/2: Afa._gwgGrenze 800 €, _kfzPauschalen 1 % / 80 %', () => {
    const A = ladeModule(['js/afa.js'], { Store: {}, Utils: {} }).Afa;
    JAHRE.forEach(y => assert.strictEqual(A._gwgGrenze(y + '-06-01'), 800));
    assert.strictEqual(A._gwgGrenze(''), 800);
    gleichFuerAlle(y => A._kfzPauschalen(y + '-06-01'), { satz: 0.01, ustBemessung: 0.8 });
});

check('A3-3: SteuerBerechnung.gesamtdifferenzGrenze 750 €', () => {
    const SB = ladeModule(['js/steuer-berechnung.js'], {}).SteuerBerechnung;
    JAHRE.forEach(y => assert.strictEqual(SB.gesamtdifferenzGrenze(y), 750));
});

check('A3-4: Vorsteuer._kleinbetragGrenze 250 € — 250,00 Kleinbetrag, 250,01 nicht', () => {
    const V = ladeModule(['js/vorsteuer.js'], { Store: {}, Utils: {} }).Vorsteuer;
    JAHRE.forEach(y => assert.strictEqual(V._kleinbetragGrenze(y), 250));
    const r = { datum: '2026-03-01', lieferant: 'Händler' };
    assert.strictEqual(V._belegCheck(r, 250).kleinbetrag, true);
    assert.strictEqual(V._belegCheck(r, 250.01).kleinbetrag, false);
    assert.deepStrictEqual(plain(V._belegCheck(r, 250.01).missing), ['Steuernr./USt-IdNr.']);
    assert.strictEqual(V._belegCheck({ lieferant: 'ohne Datum' }, 100).kleinbetrag, true);
});

check('A3-6: GewSt aus EINER Quelle — Gewerbesteuer._getGewStWerte, gbr.js/KSt ohne eigene Konstanten', () => {
    const c = ladeModule(['js/gewerbesteuer.js', 'js/koerperschaftsteuer.js', 'js/gbr.js'], {
        Store: { get: k => k === 'gbr_einstellungen' ? { hebesatz: 400 } : null, set() {}, getSettings: () => ({}) }, Utils: {}
    });
    gleichFuerAlle(y => c.Gewerbesteuer._getGewStWerte(y), { messzahl: 0.035, freibetrag: 24500 });
    // 40.000 € − 24.500 € = 15.500 € × 3,5 % = 542,50 € × 400 % = 2.170 €
    const k = c.Gewerbesteuer.berechne(40000, { hebesatz: 400, year: 2026 });
    assert.strictEqual(k.freibetrag, 24500); assert.strictEqual(k.gewerbeertrag, 15500); assert.strictEqual(k.gewSt, 2170);
    assert.strictEqual(c.Gewerbesteuer.berechne(40000, { hebesatz: 400, freibetrag: false }).gewSt, 5600);
    assert.strictEqual(c.GbR.berechneGewSt(40000, 2026), 2170);
    assert.strictEqual(c.GbR.FREIBETRAG_GBR, undefined); assert.strictEqual(c.GbR.MESSZAHL, undefined);
    assert.strictEqual(c.Gewerbesteuer.MESSZAHL, undefined); assert.strictEqual(c.Gewerbesteuer.FREIBETRAG_PERSONEN, undefined);
    // GmbH: kein Freibetrag, 100.000 € × 3,5 % × 400 % ≈ 14.000 €
    c.Koerperschaftsteuer._getData = () => ({});
    assert.strictEqual(c.Koerperschaftsteuer._calcKSt(100000, 2026).gewSt, 100000 * 0.035 * (400 / 100));   // alte Formel, ungerundet
    const fs = require('fs'), path = require('path');
    ['gewerbesteuer.js', 'gbr.js', 'koerperschaftsteuer.js'].forEach(f => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
        // Nur Code zählt: Kommentarzeilen dürfen die Werte nennen
        const code = src.split('\n').filter(z => !/^\s*\/\//.test(z)).join('\n');
        const treffer = (code.match(/0\.035|24500/g) || []).length;
        assert.strictEqual(treffer, f === 'gewerbesteuer.js' ? 2 : 0, f + ': ' + treffer + ' Treffer');
        if (f === 'gewerbesteuer.js') assert.strictEqual(code.includes('return { messzahl: 0.035, freibetrag: 24500 };'), true);
    });
});

check('A3-7: Rechtsform._getAO141Grenzen 800.000 / 80.000 €', () => {
    const R = ladeModule(['js/rechtsform.js'], { Store: { get: () => ({}) } }).Rechtsform;
    gleichFuerAlle(y => R._getAO141Grenzen(y), { umsatz: 800000, gewinn: 80000 });
    assert.strictEqual(R.AO141_UMSATZ_GRENZE, undefined);
});

check('A3-8/9: KSt _solzSatz 5,5 %, _ugRuecklageQuote 25 %', () => {
    const K = kst({});
    gleichFuerAlle(y => K._solzSatz(y), 0.055);
    gleichFuerAlle(y => K._ugRuecklageQuote(y), 0.25);
    assert.strictEqual(K.SOLZ_SATZ, undefined);
    assert.strictEqual(K._gesamtSatz(2026), 0.15 + 0.15 * 0.055);
});

check('A3-10..14: Lohnsteuer-Jahresfunktionen — Werte wie die alten Konstanten', () => {
    const L = ladeModule(['js/lohnsteuer.js'], { Store: { get: () => null }, Utils: {} }).Lohnsteuer;
    gleichFuerAlle(y => L._getSvSaetze(y), { kv: 0.0875, rv: 0.093, av: 0.013, pv: 0.018 });
    gleichFuerAlle(y => L._getBBG(y), { kv: 69750, rv: 101400 });
    gleichFuerAlle(y => L._getSoli(y), { satz: 0.055, freigrenzeSingle: 20350, freigrenzeSplit: 40700, milderungssatz: 0.119 });
    gleichFuerAlle(y => L._getTarifNaeherung(y), { anPauschbetrag: 1230, saPauschbetrag: 36,
        zonen: [{ bis: 17005, satz: 0.14 }, { bis: 66760, satz: 0.24 }, { bis: 277825, satz: 0.35 }], spitzensatz: 0.42 });
    gleichFuerAlle(y => L._umlagenSatz(y), 0.024);
    ['SV', 'BBG', 'SOLI_FREIGRENZE_SINGLE', 'SOLI_FREIGRENZE_SPLIT', 'SOLI_MILDERUNGSSATZ'].forEach(k => assert.strictEqual(L[k], undefined, k));
});

check('A3-13: Lohnsteuer._calcMonat rechnet bitgenau wie die alte Fassung (Referenz von Hand nachgebaut)', () => {
    const L = ladeModule(['js/lohnsteuer.js'], { Store: { get: () => null }, Utils: {} }).Lohnsteuer;
    // Die Formel aus js/lohnsteuer.js vor dem Umbau, mit den damals festen Zahlen
    const alt = (brutto, sk, gfb) => {
        const jb = brutto * 12;
        let s;
        if (jb - 1230 - 36 <= gfb) s = 0; else if (jb <= 17005) s = 0.14; else if (jb <= 66760) s = 0.24;
        else if (jb <= 277825) s = 0.35; else s = 0.42;
        if (sk === 3) s *= 0.7; if (sk === 5) s *= 1.3; if (sk === 6) s *= 1.1;
        const lst = brutto * s, jl = lst * 12, fg = sk === 3 ? 40700 : 20350;
        const solz = (jl > fg ? Math.min((jl - fg) * 0.119, jl * 0.055) : 0) / 12;
        const kv = Math.min(brutto * 12, 69750) / 12, rv = Math.min(brutto * 12, 101400) / 12;
        const sv = kv * 0.0875 + rv * 0.093 + rv * 0.013 + kv * 0.018;
        return { lohnsteuer: lst, solz, netto: brutto - lst - solz - 0 - sv, umlagen: brutto * 0.024,
            agKostenGesamt: brutto + sv + brutto * 0.024, lstSatz: s };
    };
    [2024, 2026].forEach(year => {
        L._year = year;
        [0, 1100, 1416, 1500, 3000, 5560, 8450, 9000, 23152, 30000].forEach(b => [1, 3, 4, 5, 6].forEach(sk => {
            const n = L._calcMonat(b, sk), a = alt(b, sk, L._grundfreibetrag(year));
            Object.keys(a).forEach(f => assert.strictEqual(n[f], a[f], `${year} ${b} € StKl ${sk} ${f}`));
        }));
    });
});

check('A3-15: OSS._getEuSaetze — 26 Länder, Stand wie die alte Konstante, in jedem Jahr', () => {
    const O = ladeModule(['js/oss.js'], { Store: { getSettings: () => ({}) }, Utils: {} }).OSS;
    const soll = { AT: 20, BE: 21, BG: 20, HR: 25, CY: 19, CZ: 21, DK: 25, EE: 24, FI: 25.5, FR: 20, GR: 24,
        HU: 27, IE: 23, IT: 22, LV: 21, LT: 21, LU: 17, MT: 18, NL: 21, PL: 23, PT: 23, RO: 21, SK: 23, SI: 22, ES: 21, SE: 25 };
    gleichFuerAlle(y => O._getEuSaetze(y), soll);
    assert.strictEqual(O.EU_VAT_RATES, undefined);
    // Netto im Zielland: 120 € brutto nach FR (20 %) = 100 €
    assert.strictEqual(O._saleNettoZielland({ land: 'FR', datum: '2026-05-01', verkaufspreis: 120 }), 100);
    assert.strictEqual(O._saleNettoZielland({ land: 'FR', verkaufspreis: 120 }), 100);
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
