// Kleinere P2-Fixes aus dem Steuer-Audit 2026-10-18: KSA-Bemessung (E-03), §141-Umsatz netto
// (E-05b), OSS-Normalsätze (U09), E-Rechnungs-Hinweis (B10), GWG-Grenze bei KU (E-02).
//   node test/test-steuer-audit-p2-werte.js
// Sollwerte von Hand: §25 Abs.2 KSVG (Entgelt ohne gesondert ausgewiesene USt), KSA 2026 4,9 %,
// Freigrenze 1.000 € (§24 KSVG); §141 Abs.1 Nr.1 AO (Umsätze = Entgelte ohne USt);
// EE 24 % ab 01.07.2025, RO 21 % ab 01.08.2025; §27 Abs.38 UStG; §6 Abs.2 S.1 EStG.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ladeModule } = require('./_lade-module');
let n = 0; const ok = t => { n++; console.log('✓ ' + t); };
const r2 = v => Math.round(v * 100) / 100;

// E-03 — KSA aus Netto
{
    const expenses = [];
    const Store = { getExpenses: () => expenses, getSettings: () => ({}), get: () => null };
    const c = ladeModule(['js/ausgaben.js'], { Store, Utils: { showToast() {} }, document: { getElementById: () => null } });
    const A = c.Ausgaben;
    expenses.push({ datum: '2026-05-01', kategorie: A._KSA_KATEGORIE, betrag: 1190, ustSatz: 19 });
    const kw = A._getKsaWerte(2026);
    assert.strictEqual(r2(A._ksaJahressumme(2026)), 1000);
    assert.ok(!(A._ksaJahressumme(2026) > kw.bagatelle), '1.000 € netto liegt nicht über der Freigrenze');
    expenses.push({ datum: '2026-06-01', kategorie: A._KSA_KATEGORIE, betrag: 1190, ustSatz: 19 });
    assert.strictEqual(r2(A._ksaJahressumme(2026) * kw.satz), 98);
    expenses.push({ datum: '2026-07-01', kategorie: A._KSA_KATEGORIE, betrag: 500, ustSatz: 0 });
    assert.strictEqual(r2(A._ksaJahressumme(2026)), 2500);
    ok('E-03: KSA-Bemessung netto — 1.190 € brutto = 1.000 € (frei), 2 × 1.190 € → 98,00 € KSA, KU-Honorar voll');
}

// E-05b — §141-Umsatz netto
{
    global.Store = { get: () => ({ firmenform: 'Einzelunternehmen', taetigkeitsart: 'gewerblich' }), set() {} };
    const c = ladeModule(['js/rechtsform.js'], { Store: global.Store });
    c.GbrModul = { _calcJahresgewinn: () => ({ einnahmen: 833000, umsatzNetto: 700000, gewinn: 50000 }) };
    assert.strictEqual(c.Rechtsform.ueberschreitetAO141Schwelle(2026), false);
    c.GbrModul = { _calcJahresgewinn: () => ({ einnahmen: 952000, umsatzNetto: 800000.01, gewinn: 50000 }) };
    assert.strictEqual(c.Rechtsform.ueberschreitetAO141Schwelle(2026), true);
    ok('E-05b: 700.000 € netto (833.000 € brutto) reißt die 800.000-€-Grenze nicht');
}

// U09 — OSS-Sätze
{
    const c = ladeModule(['js/oss.js'], { Store: { getSettings: () => ({}) }, Utils: {} });
    assert.strictEqual(c.OSS.EU_VAT_RATES.EE, 24);
    assert.strictEqual(c.OSS.EU_VAT_RATES.RO, 21);
    assert.strictEqual(r2(124 / (1 + c.OSS.EU_VAT_RATES.EE / 100)), 100);
    ok('U09: OSS-Normalsätze EE 24 %, RO 21 % — 124 € brutto nach Estland = 100 € netto');
}

// B10 — E-Rechnungs-Hinweis
{
    const src = fs.readFileSync(path.join(__dirname, '../rechnungen/js/rech-dashboard.js'), 'utf8');
    assert.ok(!/Ab&nbsp;2027 auch Ausstellungspflicht für Umsätze >&nbsp;0/.test(src), 'alter Hinweis noch da');
    assert.ok(/800\.000&nbsp;€/.test(src) && /2028/.test(src) && /Kleinunternehmer/.test(src), 'neuer Hinweis unvollständig');
    ok('B10: E-Rechnungs-Hinweis nennt 2026/2027 (800.000 €)/2028 und die Ausnahmen');
}

// E-02 / E-12 — GWG netto, Hinweistexte
{
    const c = ladeModule(['js/afa.js'], { Store: {}, Utils: {} });
    assert.strictEqual(r2(c.Afa._gwgNetto(940, 150.08)), 789.92);
    assert.ok(!(c.Afa._gwgNetto(940, 150.08) > 800), '940 € brutto mit 150,08 € USt ist GWG');
    assert.ok(c.Afa._gwgNetto(952, 0) > 800, 'ohne USt-Angabe bleibt der Bruttobetrag maßgeblich');
    ok('E-02: GWG-Grenze misst bei KU den Nettobetrag');
    const src = fs.readFileSync(path.join(__dirname, '../js/afa.js'), 'utf8');
    assert.ok(/PC\/Laptop\/Software 1 J\./.test(src) && !/PC\/Laptop 3 J\./.test(src));
    assert.ok(!/wieder ab 1\.1\.2023/.test(src));
    ok('E-12: Hinweise Nutzungsdauer Computer 1 J. und degressive Zeitfenster aktuell');
}
console.log('\n' + n + '/6 P2-Werte-Tests bestanden');
