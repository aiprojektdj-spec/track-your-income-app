// Fristenkalender:  node test/test-steuertermine.js
//
// Fund T3 (Steuer-Vergleich 2026-08-10): js/steuertermine.js listete 10 feste Termine hart.
// Drei Lücken:
//   1. Kein Monatsrhythmus — wer monatlich voranmelden muss (Vorjahres-Zahllast > 7.500 €,
//      §18 Abs. 2 UStG), bekam nur vier Quartalstermine, also ACHT fehlende Fristen im Jahr.
//   2. Keine Dauerfristverlängerung (§46 UStDV) und keine 1/11-Sondervorauszahlung (§47 UStDV).
//   3. Keine Werktagsverschiebung nach §108 Abs. 3 AO — der 10.01.2026 ist ein Samstag,
//      gesetzliche Frist also der 12.01.; angezeigt wurde der 10.01.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Modul laden, Store/Utils stubben. steuertermine.js ist ein Objektliteral ohne module.exports.
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'steuertermine.js'), 'utf8');
function load(settings, employees) {
    const sandbox = {
        Store: {
            getSettings: () => settings || {},
            get: (k) => (k === 'lohnsteuer_employees' ? (employees || []) : null),
            getSteuertermine: () => [], getSales: () => []
        },
        Utils: { todayISO: () => '2026-01-01', escapeHtml: (s) => String(s), formatDate: (s) => s }
    };
    const fn = new Function('Store', 'Utils', src + '; return Steuertermine;');
    return fn(sandbox.Store, sandbox.Utils);
}

let pass = 0;
const KLEIN = { ustMode: 'klein' };
const REGEL_Q = { ustMode: 'regel', ustVaPeriodenTyp: 'quartal' };
const REGEL_M = { ustMode: 'regel', ustVaPeriodenTyp: 'monat' };

// ── 1. §108 Abs. 3 AO: Verschiebung auf den nächsten Werktag ────────────────────────────────
const S = load(KLEIN);
assert.strictEqual(S._naechsterWerktag('2026-01-10'), '2026-01-12', 'Sa 10.01.2026 → Mo 12.01.');
assert.strictEqual(S._naechsterWerktag('2026-01-11'), '2026-01-12', 'So 11.01. → Mo 12.01.');
assert.strictEqual(S._naechsterWerktag('2026-01-12'), '2026-01-12', 'Werktag bleibt');
assert.strictEqual(S._naechsterWerktag('2026-01-01'), '2026-01-02', 'Neujahr (Do) → Fr 02.01.');
assert.strictEqual(S._naechsterWerktag('2026-10-03'), '2026-10-05', 'Tag der Einheit Sa → Mo');
assert.strictEqual(S._naechsterWerktag('2026-12-25'), '2026-12-28', '1./2. Weihnachtstag Fr/Sa → Mo');
pass++; console.log('✓ §108 Abs. 3 AO: Wochenende und bundesweite Feiertage verschieben');

// Bewegliche Feiertage über die Osterformel. Ostersonntag 2026 = 05.04.
const ostern2026 = S._osterSonntag(2026).toISOString().slice(0, 10);
assert.strictEqual(ostern2026, '2026-04-05', 'Ostersonntag 2026');
assert.strictEqual(S._osterSonntag(2027).toISOString().slice(0, 10), '2027-03-28', 'Ostersonntag 2027');
const f = S._feiertage(2026);
assert.ok(f.has('2026-04-03'), 'Karfreitag 03.04.2026');
assert.ok(f.has('2026-04-06'), 'Ostermontag 06.04.2026');
assert.ok(f.has('2026-05-14'), 'Christi Himmelfahrt 14.05.2026');
assert.ok(f.has('2026-05-25'), 'Pfingstmontag 25.05.2026');
pass++; console.log('✓ bewegliche Feiertage korrekt (Osterformel)');

// Länderfeiertage werden bewusst NICHT verschoben — die Anzeige darf zu früh sein, nie zu spät
assert.ok(!f.has('2026-11-01'), 'Allerheiligen ist kein bundesweiter Feiertag');
assert.ok(!f.has('2026-10-31'), 'Reformationstag ist kein bundesweiter Feiertag');
pass++; console.log('✓ Länderfeiertage bleiben unberücksichtigt (Anzeige zu früh, nie zu spät)');

// ── 2. Kleinunternehmer: gar keine UStVA-Termine ─────────────────────────────────────────────
const klein = load(KLEIN)._getFixedTermine(2026);
assert.strictEqual(klein.filter(t => t.typ === 'ust').length, 0,
    '§19-Kleinunternehmer gibt keine Voranmeldung ab — Termine wären falsch');
assert.ok(klein.some(t => t.id.indexOf('fix_eur_') === 0), 'Jahrestermine bleiben');
pass++; console.log('✓ Kleinunternehmer bekommen keine UStVA-Termine');

// ── 3. Quartalsrhythmus: 4 Termine, jeweils 10. des Folgemonats ──────────────────────────────
const q = load(REGEL_Q)._getFixedTermine(2026).filter(t => t.typ === 'ust');
assert.strictEqual(q.length, 4, 'vier Quartalstermine');
const qd = q.map(t => t.datum).sort();
assert.strictEqual(qd[0], '2026-01-12', 'Q4/2025 → 10.01.2026 ist Sa → 12.01.');
assert.strictEqual(qd[1], '2026-04-10', 'Q1 → 10.04. (Fr)');
assert.strictEqual(qd[2], '2026-07-10', 'Q2 → 10.07. (Fr)');
assert.strictEqual(qd[3], '2026-10-12', 'Q3 → 10.10. ist Sa → 12.10.');
pass++; console.log('✓ Quartalsrhythmus: 4 Termine, §108-Verschiebung angewandt');

// ── 4. Monatsrhythmus: 12 Termine — die acht, die vorher fehlten ─────────────────────────────
const m = load(REGEL_M)._getFixedTermine(2026).filter(t => t.typ === 'ust');
assert.strictEqual(m.length, 12, 'zwölf Monatstermine (vorher fehlten acht)');
assert.ok(m.some(t => /Dezember 2025/.test(t.beschreibung)), 'Dezember des Vorjahres ist dabei');
assert.ok(m.some(t => /November 2026/.test(t.beschreibung)), 'November des laufenden Jahres ist dabei');
assert.ok(!m.some(t => /Dezember 2026/.test(t.beschreibung)),
    'Dezember 2026 ist erst 2027 fällig und gehört nicht in diesen Kalender');
pass++; console.log('✓ Monatsrhythmus liefert 12 Termine');

// ── 5. Dauerfristverlängerung: alles einen Monat später, plus Sondervorauszahlung ───────────
const dfQ = load({ ...REGEL_Q, ustDauerfristverlaengerung: true })._getFixedTermine(2026).filter(t => t.typ === 'ust');
const dfQd = dfQ.map(t => t.datum).sort();
assert.strictEqual(dfQd[1], '2026-05-11', 'Q1 mit Dauerfrist → 10.05.2026 ist So → 11.05.');
assert.ok(dfQ.every(t => /Dauerfristverlängerung/.test(t.beschreibung)), 'Beschreibung nennt den Grund');
// Sondervorauszahlung nur bei MONATLICHER Anmeldung (§47 UStDV) — Quartalsanmelder haben keine
assert.ok(!dfQ.some(t => /Sondervorauszahlung/.test(t.beschreibung)),
    'Quartalsanmelder: keine 1/11-Sondervorauszahlung');
const dfM = load({ ...REGEL_M, ustDauerfristverlaengerung: true })._getFixedTermine(2026).filter(t => t.typ === 'ust');
const svz = dfM.filter(t => /Sondervorauszahlung/.test(t.beschreibung));
assert.strictEqual(svz.length, 1, 'monatlich + Dauerfrist → genau eine Sondervorauszahlung');
assert.strictEqual(svz[0].datum, '2026-02-10', '10.02.2026 ist ein Dienstag');
pass++; console.log('✓ Dauerfristverlängerung verschiebt und ergänzt die Sondervorauszahlung');

// ── 6. Lohnsteuer nur mit erfassten Mitarbeitern ─────────────────────────────────────────────
assert.strictEqual(load(REGEL_Q, [])._getFixedTermine(2026).filter(t => t.typ === 'lohn').length, 0,
    'ohne Mitarbeiter keine Lohnsteuer-Termine');
const lst = load(REGEL_Q, [{ id: 1, name: 'A' }])._getFixedTermine(2026).filter(t => t.typ === 'lohn');
assert.strictEqual(lst.length, 12, 'mit Mitarbeitern zwölf Anmeldungen');
assert.ok(lst.every(t => /§41a EStG/.test(t.beschreibung)), 'Fundstelle genannt');
assert.ok(lst.every(t => /monatlich unterstellt/.test(t.beschreibung)),
    'der unterstellte Rhythmus ist als Annahme gekennzeichnet, nicht als Gewissheit');
pass++; console.log('✓ Lohnsteuer-Termine nur mit Mitarbeitern, Annahme gekennzeichnet');

// ── 7. Keine doppelten IDs — sie sind der Schlüssel fürs Abhaken ────────────────────────────
const alle = load(REGEL_M, [{ id: 1 }])._getFixedTermine(2026);
const ids = alle.map(t => t.id);
assert.strictEqual(new Set(ids).size, ids.length, 'alle Termin-IDs eindeutig');
assert.ok(alle.every(t => /^\d{4}-\d{2}-\d{2}$/.test(t.datum)), 'alle Daten im ISO-Format');
pass++; console.log('✓ ' + alle.length + ' Termine, IDs eindeutig, Daten ISO-formatiert');

console.log('\n' + pass + '/9 Tests bestanden ✅');
