// Regressionstest: Gewerbesteuer-Freibetrag-Bug (gewStFreibetrag===true statt >0) und
// §35-EStG-Anrechnungsfaktor (3,8 → 4,0 + Deckelung). Testet den ECHTEN Code aus
// js/gewerbesteuer.js per Quelltext-Extraktion (gleiches Vorgehen wie die anderen
// test-*.js-Regressionstests in diesem Repo, da die Datei wegen Store/Rechtsform-Globals
// nicht direkt per require() ladbar ist).
'use strict';
const assert = require('assert');
const fs = require('fs');

function extractMethod(src, startMarker, endMarkerRe) {
    const startIdx = src.indexOf(startMarker);
    assert.ok(startIdx !== -1, 'Marker nicht gefunden: ' + startMarker);
    const afterStart = startIdx + startMarker.length;
    const rest = src.slice(afterStart);
    const m = rest.match(endMarkerRe);
    assert.ok(m, 'Ende-Marker nicht gefunden nach ' + startMarker);
    return rest.slice(0, m.index);
}

const src = fs.readFileSync(__dirname + '/../js/gewerbesteuer.js', 'utf8');

// _hatFreibetrag() Body
const hatFreibetragBody = extractMethod(src, '_hatFreibetrag() {', /\n    \},/);
const _hatFreibetrag = new Function(hatFreibetragBody);

// _calc(year) Body (nutzt this.FREIBETRAG_PERSONEN, this.MESSZAHL, this._getHebesatz(), this._calcGewinn(), this._hatFreibetrag())
const calcBody = extractMethod(src, '_calc(year) {', /\n    \},/);
const _calc = new Function('year', calcBody);

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else console.error('✗ FAIL ' + name);
}

// ── 1) _hatFreibetrag(): numerischer Wert statt Boolean-Vergleich ────────────
{
    global.Rechtsform = { getConfig: () => ({ gewStFreibetrag: 24500 }) };
    check('_hatFreibetrag(): Einzelunternehmer (gewStFreibetrag=24500) -> true', _hatFreibetrag.call({}) === true);
    global.Rechtsform = { getConfig: () => ({ gewStFreibetrag: 0 }) };
    check('_hatFreibetrag(): GmbH (gewStFreibetrag=0) -> false', _hatFreibetrag.call({}) === false);
}

// ── 2) _calc(): Freibetrag greift jetzt tatsächlich (Audit-Beispiel) ─────────
// Einzelunternehmer, Gewinn 40.000€, Hebesatz 400% -> nach §11 GewStG:
// Gewerbeertrag = 40.000 - 24.500 = 15.500 (glatte 100er, keine Rundung nötig)
// Steuermessbetrag = 15.500 * 3,5% = 542,50€
// GewSt = 542,50 * 400% = 2.170,00€
{
    global.Rechtsform = { getConfig: () => ({ gewStFreibetrag: 24500 }) };
    const mockThis = {
        FREIBETRAG_PERSONEN: 24500,
        MESSZAHL: 0.035,
        _getHebesatz: () => 400,
        _calcGewinn: () => 40000,
        _hatFreibetrag,
    };
    const c = _calc.call(mockThis, 2026);
    check('Gewerbeertrag = 15.500€ (40.000 - 24.500 Freibetrag)', Math.abs(c.gewerbeertrag - 15500) < 0.01);
    check('Steuermessbetrag = 542,50€', Math.abs(c.messbetrag - 542.5) < 0.01);
    check('Gewerbesteuer = 2.170,00€ (542,50 × 400%)', Math.abs(c.gewSt - 2170) < 0.01);
    // Ohne den Fix (Freibetrag griff nie): Gewerbeertrag=40.000, Messbetrag=1.400, GewSt=5.600€ — 2,6x zu hoch.
    check('Gewerbesteuer ist NICHT mehr der (falsche) Vor-Fix-Wert 5.600€', Math.abs(c.gewSt - 5600) > 1);
}

// ── 3) §35-Anrechnung: Faktor 4,0 statt 3,8 ───────────────────────────────────
{
    global.Rechtsform = { getConfig: () => ({ gewStFreibetrag: 24500 }) };
    const mockThis = {
        FREIBETRAG_PERSONEN: 24500, MESSZAHL: 0.035,
        _getHebesatz: () => 400, _calcGewinn: () => 40000, _hatFreibetrag,
    };
    const c = _calc.call(mockThis, 2026);
    // Messbetrag 542,50€ * 4,0 = 2.170€ (== gewSt bei Hebesatz 400% -> Deckelung greift genau am Rand)
    check('§35-Anrechnung nutzt Faktor 4,0 (542,50 × 4 = 2.170€, gedeckelt auf GewSt 2.170€)', Math.abs(c.anrechnung35 - 2170) < 0.01);
    check('§35-Anrechnung ist NICHT mehr der alte 3,8-Faktor (2.061,50€)', Math.abs(c.anrechnung35 - 2061.5) > 1);
}

// ── 4) §35-Deckelung: Anrechnung darf tatsächlich gezahlte GewSt nie übersteigen ──
// Hoher Hebesatz (900%) -> GewSt sehr hoch, 4×Messbetrag bleibt aber klein -> Deckel = 4×Messbetrag greift.
// Niedriger Hebesatz (200%, unter 400/4=100% Schwelle) -> GewSt < 4×Messbetrag -> Deckel = tatsächliche GewSt greift.
{
    global.Rechtsform = { getConfig: () => ({ gewStFreibetrag: 24500 }) };
    const mockThisNiedrig = {
        FREIBETRAG_PERSONEN: 24500, MESSZAHL: 0.035,
        _getHebesatz: () => 200, _calcGewinn: () => 40000, _hatFreibetrag,
    };
    const cNiedrig = _calc.call(mockThisNiedrig, 2026);
    // Messbetrag 542,50 * 4 = 2.170; GewSt bei 200% = 542,50*2 = 1.085 -> Deckel auf tatsächliche GewSt (1.085)
    check('Deckelung: bei Hebesatz 200% ist Anrechnung = tatsächliche GewSt (1.085€), NICHT 4×Messbetrag (2.170€)',
        Math.abs(cNiedrig.anrechnung35 - 1085) < 0.01);
}

// ── 5) js/euer.js: Gewerbesteuer-Block nur für gewerbesteuerpflichtige Rechtsformen ──
{
    const euerSrc = fs.readFileSync(__dirname + '/../js/euer.js', 'utf8');
    check('euer.js: _renderGewerbesteuerBlock prüft cfg.gewerbesteuer !== true (Freiberufler-Guard)',
        /_renderGewerbesteuerBlock\(gewinn\)\s*\{[\s\S]{0,300}gewerbesteuer !== true/.test(euerSrc));
}

console.log('\n' + pass + '/' + total + ' Tests bestanden ' + (pass === total ? '✅' : '❌'));
if (pass !== total) process.exit(1);
