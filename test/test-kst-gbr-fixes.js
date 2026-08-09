// Regressionstest für zwei Rechenfehler-Fixes:  node test/test-kst-gbr-fixes.js
//
// 1) js/koerperschaftsteuer.js: UG-Thesaurierungsrücklage (§5a Abs. 3 GmbHG) muss 25% des
//    JAHRESÜBERSCHUSSES NACH STEUERN sein, nicht 25% des zu versteuernden Einkommens VOR Steuern.
// 2) js/gbr.js + js/gbr-modul.js: Sonderbetriebseinnahmen/-ausgaben (§15 Abs. 1 Nr. 2 EStG)
//    müssen additiv (nicht anteilig) in den Gesamtgewinn des jeweiligen Gesellschafters einfließen.
//
// Beide Module referenzieren Browser-Globals (Store, Utils, window, document, Rechtsform, App) und
// können deshalb nicht per require() geladen werden. Statt die Dateien invasiv modulfähig zu machen
// (außerhalb des erlaubten Scopes), werden sie per vm-Modul in einem Sandbox-Kontext mit minimalen
// Store/Utils/Rechtsform-Mocks ausgeführt — es läuft also der ECHTE Produktionscode, nicht eine
// Kopie/Reimplementierung der Formeln.

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
function ok(name, cond) {
    if (cond) { console.log('✓ ' + name); pass++; }
    else { console.log('✗ ' + name + ' — Bedingung falsch'); fail++; }
}
function close(name, got, want, eps) {
    eps = eps == null ? 0.005 : eps;
    if (typeof got === 'number' && typeof want === 'number' && Math.abs(got - want) < eps) {
        console.log('✓ ' + name + ' (' + got.toFixed(4) + ' ≈ ' + want.toFixed(4) + ')');
        pass++;
    } else {
        console.log('✗ ' + name + ' — got ' + got + ' want ≈ ' + want);
        fail++;
    }
}

// ── Minimaler In-Memory-Store-Mock (company-namespacing hier irrelevant) ───────────────
function makeStore() {
    const data = {};
    let idCounter = 0;
    return {
        get(key) { return data[key]; },
        set(key, val) { data[key] = val; },
        generateId() { return 'id_' + (++idCounter); },
        _dump() { return data; },
    };
}

// ═════════════════════════════════════════════════════════════════════════════════════
// TEIL 1 — UG-Thesaurierungsrücklage: 25% NACH Steuern, nicht VOR Steuern
// ═════════════════════════════════════════════════════════════════════════════════════
console.log('\n── KSt: UG-Thesaurierungsrücklage ──────────────────────────────────────');

const kstSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'koerperschaftsteuer.js'), 'utf8');

// Regressions-Guard: die alte, falsche Formel darf im Quelltext nicht mehr vorkommen.
ok('Alte Formel "calc.zvE * 0.25" (Bemessung VOR Steuern) kommt nicht mehr vor',
    !/thesaurierung\s*=\s*isUG\s*\?\s*calc\.zvE\s*\*\s*0\.25/.test(kstSrc));
ok('Neue Formel bemisst 25% des Jahresüberschusses NACH Steuern (fin.gewinn − calc.steuerGesamt)',
    /jahresueberschussNachSteuern\s*=\s*fin\.gewinn\s*-\s*calc\.steuerGesamt/.test(kstSrc) &&
    /thesaurierung\s*=\s*isUG\s*\?\s*Math\.max\(0,\s*jahresueberschussNachSteuern\)\s*\*\s*0\.25/.test(kstSrc));

const kstStore = makeStore();
const kstUtilsCalls = [];
const kstContext = vm.createContext({
    window: {},
    console,
    Store: kstStore,
    // formatCurrency: deterministisch, mit klar erkennbarem Präfix zum Rausparsen aus dem HTML
    Utils: {
        formatCurrency(v) { const n = Number(v) || 0; return 'CUR[' + n.toFixed(4) + ']'; },
        escapeHtml(s) { return String(s == null ? '' : s); },
        downloadCSV() {},
        showToast() {},
        getDateInputValue() { return ''; },
    },
    // GmbH/UG-Zweig erzwingen
    Rechtsform: { get() { return 'UG'; } },
});
vm.runInContext(kstSrc, kstContext, { filename: 'koerperschaftsteuer.js' });
const Koerperschaftsteuer = vm.runInContext('Koerperschaftsteuer', kstContext);

// Testdaten: 1 Verkauf über 50.000 €, keine weiteren Buchungen, Standard-Hebesatz 400%.
kstStore.set('sales', [{ datum: '2026-03-15', verkaufspreis: 50000, versandkostenKaeufer: 0 }]);
kstStore.set('purchases', []);
kstStore.set('ausgaben', []);
kstStore.set('gbr_einstellungen', { hebesatz: 400 });
kstStore.set('kst_data', {});
Koerperschaftsteuer._year = 2026;

// Erwartungswert über den ECHTEN _calcGewinn/_calcKSt-Code herleiten (keine Parallel-Formel)
const fin  = Koerperschaftsteuer._calcGewinn(2026);
const calc = Koerperschaftsteuer._calcKSt(fin.gewinn, 2026);
eq('Jahresgewinn (Cash-EÜR) = 50.000 €', fin.gewinn, 50000);
close('KSt+SolZ (15,825% von 50.000) = 7.912,50 €', calc.gesamt, 7912.5);
close('GewSt (3,5% × Hebesatz 400% von 50.000) = 7.000 €', calc.gewSt, 7000);
close('Gesamtsteuerbelastung = 14.912,50 €', calc.steuerGesamt, 14912.5);

const jahresueberschussNachSteuern = fin.gewinn - calc.steuerGesamt; // 35.087,50 €
const erwarteteRuecklage = Math.max(0, jahresueberschussNachSteuern) * 0.25; // 8.771,875 €
const buggyRuecklageVorSteuern = calc.zvE * 0.25; // 12.500 € — die alte, falsche Berechnung
ok('Erwartete Rücklage (nach Steuern) weicht klar von der alten Vor-Steuern-Berechnung ab',
    Math.abs(erwarteteRuecklage - buggyRuecklageVorSteuern) > 1);

// Render() ist reiner String-Aufbau (kein DOM nötig) → läuft im Sandbox-Kontext mit den Mocks oben
const html = Koerperschaftsteuer.render();

// Pflicht-Rücklage aus dem tatsächlich gerenderten HTML herausparsen
const m = html.match(/Pflicht-Rücklage 2026 \(25% davon\):\s*<strong>CUR\[([-\d.]+)\]<\/strong>/);
ok('Pflicht-Rücklage wird im HTML gerendert und ist auffindbar', !!m);
if (m) {
    const gerendeteRuecklage = parseFloat(m[1]);
    close('Gerenderte Pflicht-Rücklage entspricht 25% des Gewinns NACH Steuern', gerendeteRuecklage, erwarteteRuecklage);
    ok('Gerenderte Pflicht-Rücklage entspricht NICHT mehr der alten (falschen) Vor-Steuern-Berechnung',
        Math.abs(gerendeteRuecklage - buggyRuecklageVorSteuern) > 1);
}

// Pflichthinweis (Fix 1): Cash-EÜR-Näherung muss unübersehbar im Rendering stehen
ok('Cash-EÜR-Pflichthinweis ist im gerenderten HTML vorhanden',
    /Cash-EÜR-Näherung/.test(html) && /keine bilanzielle Gewinnermittlung/.test(html));
ok('Cash-EÜR-Hinweis referenziert §8 Abs. 1 KStG i.V.m. §5 Abs. 1 EStG', /§8 Abs\. 1 KStG/.test(html) && /§5 Abs\. 1 EStG/.test(html));
ok('Code-Kommentar über _calcGewinn erklärt die Cash-EÜR-Näherung', /reine Cash-EÜR-Näherung/.test(kstSrc));

// ═════════════════════════════════════════════════════════════════════════════════════
// TEIL 2 — GbR Sonderbetriebseinnahmen/-ausgaben (SBE/SBA), additiv zum Gesamthandsgewinn
// ═════════════════════════════════════════════════════════════════════════════════════
console.log('\n── GbR: Sonderbetriebseinnahmen/-ausgaben ──────────────────────────────');

const gbrSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'gbr.js'), 'utf8');
const gbrModulSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'gbr-modul.js'), 'utf8');

const gbrStore = makeStore();
const gbrContext = vm.createContext({
    window: {},
    console,
    Store: gbrStore,
    Utils: {
        formatCurrency(v) { return 'CUR[' + (Number(v) || 0).toFixed(4) + ']'; },
        escapeHtml(s) { return String(s == null ? '' : s); },
    },
    // Rechtsform bewusst NICHT definiert → testet, dass GbR-Code robust mit typeof-Checks arbeitet
});
vm.runInContext(gbrSrc, gbrContext, { filename: 'gbr.js' });
const GbR = vm.runInContext('GbR', gbrContext);

// 2 Gesellschafter, 50/50
GbR.saveEinstellungen({ firmenform: 'GbR', hebesatz: 400 });
GbR.saveGesellschafter([
    { id: 'a', name: 'Gesellschafter A', anteil: 50, adresse: '', eingetreten: '2020-01-01', rolle: 'gesellschafter' },
    { id: 'b', name: 'Gesellschafter B', anteil: 50, adresse: '', eingetreten: '2020-01-01', rolle: 'gesellschafter' },
]);
eq('Anteile summieren sich auf 100%', GbR.sumAnteile(), 100);

// Nur A hat eine Sonderbetriebseinnahme (z.B. Tätigkeitsvergütung), keine SBA bei irgendwem
GbR.saveSbeSba(2026, 'a', { sbe: 1000, sbeBezeichnung: 'Tätigkeitsvergütung', sba: 0, sbaBezeichnung: '' });

const GESAMTHANDSGEWINN = 10000;
const verteilung = GbR.berechneVerteilungMitSonder(GESAMTHANDSGEWINN, 2026);
const vA = verteilung.find(v => v.id === 'a');
const vB = verteilung.find(v => v.id === 'b');

ok('Gesellschafter A und B gefunden', !!vA && !!vB);
eq('A: Anteil am Gesamthandsgewinn = 5.000 € (50% von 10.000 €)', vA.gewinnanteil, 5000);
eq('B: Anteil am Gesamthandsgewinn = 5.000 € (50% von 10.000 €)', vB.gewinnanteil, 5000);
eq('A: erfasste SBE = 1.000 €', vA.sbe, 1000);
eq('A: erfasste SBA = 0 €', vA.sba, 0);
eq('A: Gesamtgewinn = Anteil (5.000 €) + SBE (1.000 €) = 6.000 €', vA.gesamtgewinn, 6000);
eq('B: Gesamtgewinn = nur sein Anteil = 5.000 € (keine SBE/SBA)', vB.gesamtgewinn, 5000);
ok('Die SBE von A hat NICHT den Gesamthandsgewinn-Anteil von B verändert (rein additiv, nicht anteilig)',
    vB.gewinnanteil === 5000 && vB.gesamtgewinn === 5000);

// Persistenz-Roundtrip prüfen (Store-gestützt, wie im echten Feststellung-Tab)
const wiederGelesen = GbR.getSbeSba(2026, 'a');
eq('SBE/SBA werden korrekt aus dem Store zurückgelesen', wiederGelesen, { sbe: 1000, sbeBezeichnung: 'Tätigkeitsvergütung', sba: 0, sbaBezeichnung: '' });
eq('Gesellschafter B ohne gespeicherte Einträge liefert Nullwerte', GbR.getSbeSba(2026, 'b'), { sbe: 0, sbeBezeichnung: '', sba: 0, sbaBezeichnung: '' });

// gbr-modul.js: Feststellung + Übersicht müssen die additive Berechnung tatsächlich verwenden
// (nicht mehr die reine anteilige berechneVerteilung ohne Sonderbereich)
ok('_renderFeststellung nutzt GbR.berechneVerteilungMitSonder(...)',
    /_renderFeststellung\(gs, gewinn, year\)\s*\{[\s\S]{0,300}GbR\.berechneVerteilungMitSonder\(gewinn,\s*year\)/.test(gbrModulSrc));
ok('_renderUebersicht nutzt GbR.berechneVerteilungMitSonder(...)',
    /_renderUebersicht\([\s\S]{0,300}GbR\.berechneVerteilungMitSonder\(gewinn,\s*year\)/.test(gbrModulSrc));
ok('_exportFeststellung (CSV) nutzt GbR.berechneVerteilungMitSonder(...)',
    /_exportFeststellung\(year\)\s*\{[\s\S]{0,300}GbR\.berechneVerteilungMitSonder\(gewinn,\s*year\)/.test(gbrModulSrc));
ok('Eingabefelder für Sonderbetriebseinnahmen/-ausgaben pro Gesellschafter sind im Feststellung-Tab vorhanden',
    /sbesba_sbe_/.test(gbrModulSrc) && /sbesba_sba_/.test(gbrModulSrc));
ok('Speicher-Handler _saveSbeSba ruft GbR.saveSbeSba(...) auf', /GbR\.saveSbeSba\(year, g\.id/.test(gbrModulSrc));

console.log('\n' + pass + '/' + (pass + fail) + ' Tests bestanden ' + (fail ? '❌' : '✅'));
process.exit(fail ? 1 : 0);
