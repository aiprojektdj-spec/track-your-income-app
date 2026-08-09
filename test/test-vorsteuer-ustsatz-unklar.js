// Regressionstest: Vorsteuer aus Betriebsausgaben ohne/mit USt-Satz (Fix 2026-07-30).
// Vorher: fehlender Satz fiel per ||-Fallback auf 19% -> unbelegter Vorsteuerabzug.
// Jetzt: fehlender/unklarer Satz -> 0€ Vorsteuerabzug, separat als "unklar" ausgewiesen.
// Testet den ECHTEN Code aus js/ausgaben.js und js/vorsteuer.js per Quelltext-Extraktion
// (gleiches Vorgehen wie die anderen test-*.js in diesem Repo).
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

const ausgabenSrc = fs.readFileSync(__dirname + '/../js/ausgaben.js', 'utf8');
const vorsteuerSrc = fs.readFileSync(__dirname + '/../js/vorsteuer.js', 'utf8');

const normUstSatzBody = extractMethod(ausgabenSrc, '_normUstSatz(v) {', /\n    \},/);
const _normUstSatz = new Function('v', normUstSatzBody);

const expenseUstRawBody = extractMethod(vorsteuerSrc, '_expenseUstRaw(e) {', /\n    \},/);
const _expenseUstRaw = new Function('e', expenseUstRawBody);

// _calcFromExpenses(startDate, endDate) Body — nutzt Store.getExpenses/Utils.isInPeriod + this._expenseUstRaw
const calcBody = extractMethod(vorsteuerSrc, '_calcFromExpenses(startDate, endDate) {', /\n    \},/);
const _calcFromExpenses = new Function('startDate', 'endDate', calcBody);

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else console.error('✗ FAIL ' + name);
}

// ── 1) _normUstSatz: Altbestand ohne Feld -> 'unklar', NIE 19 ────────────────
check("_normUstSatz(undefined) === 'unklar'", _normUstSatz(undefined) === 'unklar');
check("_normUstSatz('') === 'unklar'", _normUstSatz('') === 'unklar');
check('_normUstSatz(7) === 7', _normUstSatz(7) === 7);
check('_normUstSatz(0) === 0 (steuerfrei bleibt 0, nicht "unklar")', _normUstSatz(0) === 0);
check("_normUstSatz('rc') === 'rc'", _normUstSatz('rc') === 'rc');

// ── 2) _expenseUstRaw: liest ustSatz bevorzugt vor Legacy steuersatz-Feld ────
check("_expenseUstRaw({}) === 'unklar' (kein Feld -> unklar, NIE 19)", _expenseUstRaw({}) === 'unklar');
check('_expenseUstRaw({ustSatz:7}) === 7', _expenseUstRaw({ ustSatz: 7 }) === 7);
check('_expenseUstRaw({steuersatz:19}) === 19 (Legacy-Fallback-Feld)', _expenseUstRaw({ steuersatz: 19 }) === 19);

// ── 3) _calcFromExpenses: unklar -> 0€ Vorsteuer, wird separat gezählt ───────
global.Store = {
    getExpenses: () => [
        { datum: '2026-03-01', betrag: 119, ustSatz: 19 },   // 19% -> 19,00€ VSt
        { datum: '2026-03-02', betrag: 107, ustSatz: 7 },    // 7%  -> 7,00€ VSt
        { datum: '2026-03-03', betrag: 500 },                // kein Feld -> unklar, 0€ VSt
        { datum: '2026-03-04', betrag: 50, ustSatz: 0 },     // 0% -> 0€ VSt, aber NICHT "unklar"
        { datum: '2026-03-05', betrag: 300, ustSatz: 'rc' }, // Reverse Charge -> separat, nicht hier
    ]
};
global.Utils = { isInPeriod: () => true };
const mockThis = { _expenseUstRaw };
const r = _calcFromExpenses.call(mockThis, '2026-01-01', '2026-12-31');

check('vst19 = 19,00€', Math.abs(r.vst19 - 19) < 0.01);
check('vst7 = 7,00€', Math.abs(r.vst7 - 7) < 0.01);
check('vst0 enthält die 0%-Ausgabe (50€), NICHT die "unklar"-Ausgabe (500€)', Math.abs(r.vst0 - 50) < 0.01);
check('unklarCount = 1 (nur die Ausgabe ohne Feld)', r.unklarCount === 1);
check('unklarBetrag = 500,00€', Math.abs(r.unklarBetrag - 500) < 0.01);
check('Gesamt-Vorsteuer (vst19+vst7) = 26,00€ — NICHT durch die "unklar"-Ausgabe verfälscht', Math.abs((r.vst19 + r.vst7) - 26) < 0.01);
// Vor dem Fix wäre die "unklar"-Ausgabe (500€) mit 19% Fallback als 79,83€ Vorsteuer durchgerutscht.
check('Vorsteuer NICHT um den alten 19%-Fallback-Betrag (79,83€) der unklaren Ausgabe erhöht', r.vst19 < 79);

console.log('\n' + pass + '/' + total + ' Tests bestanden ' + (pass === total ? '✅' : '❌'));
if (pass !== total) process.exit(1);
