// §19-Gesamtumsatz: vereinnahmte Entgelte netto, Erstattungen mindern (Steuer-Audit 2026-10-18, U06).
//   node test/test-ku-gesamtumsatz.js
// Sollwerte von Hand: §19 Abs.1/2 UStG n. F. ("nach vereinnahmten Entgelten berechnete Summe",
// Entgelt ohne USt nach §10 Abs.1 UStG), Grenzen 25.000 € Vorjahr / 100.000 € laufendes Jahr.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

function welt(sales, retouren, settings) {
    const Store = {
        getSettings: () => settings, getAllSalesRaw: () => sales, getSales: () => sales.filter(s => !s.storniert),
        getRetouren: () => retouren || [],
        salePerRate: s => {
            const brutto = (+s.verkaufspreis || 0) + (+s.versandkostenKaeufer || 0);
            return [{ satz: isNaN(parseFloat(s.steuersatz)) ? 19 : parseFloat(s.steuersatz), brutto }];
        }
    };
    return ladeModule(['js/steuerstatus.js', 'js/kleinunternehmer.js'], { Store });
}
const r2 = v => Math.round(v * 100) / 100;
let n = 0; const ok = t => { n++; console.log('✓ ' + t); };

// (a) Rückkehr zur KU: 2025 regelbesteuert, 24.000 € netto = 28.560 € brutto → KU 2026 zulässig
{
    const settings = { ustMode: 'klein', ustModeHistorie: [{ ab: '0000-01-01', mode: 'regel' }, { ab: '2026-01-01', mode: 'klein' }] };
    const c = welt([{ id: 'a', datum: '2025-05-01', verkaufspreis: 28560, steuersatz: 19 }], [], settings);
    assert.strictEqual(r2(c.Kleinunternehmer.summe(2025)), 24000);
    const r = c.Kleinunternehmer.pruefe({ year: 2026, grenzen: { vj: 25000, lfd: 100000 }, umsaetze: [],
        vorjahresUmsatz: c.Kleinunternehmer.summe(2025), taetigkeitsbeginn: '2020-01-01' });
    assert.strictEqual(r.status, 'klein');
    ok('U06a: Vorjahr 28.560 € brutto = 24.000 € netto → Kleinunternehmer 2026 zulässig');
}
// (b) Gründer 2026: 25.500 € vereinnahmt, 1.000 € erstattet → 24.500 €, KU bleibt
{
    const c = welt([{ id: 's1', datum: '2026-01-15', verkaufspreis: 25500, steuersatz: 0 }],
        [{ datum: '2026-02-01', saleId: 's1', erstattungBetrag: 1000 }], { ustMode: 'klein' });
    const r = c.Kleinunternehmer.pruefe({ year: 2026, grenzen: { vj: 25000, lfd: 100000 },
        umsaetze: c.Kleinunternehmer.entgelte(2026), vorjahresUmsatz: 0, taetigkeitsbeginn: '2026-01-01' });
    // Laufende Summe: am 15.01. 25.500 > 25.000 → die Befreiung entfällt mit diesem Umsatz;
    // die spätere Erstattung macht den überschreitenden Umsatz nicht rückgängig.
    assert.strictEqual(r.status, 'sofort');
    assert.strictEqual(r2(r.summe), 24500);
    ok('U06b: Erstattung mindert die Jahressumme (24.500 €); der Grenzumsatz vom 15.01. bleibt maßgeblich');
}
// (c) Erstattung vor Überschreiten: 24.900 + Erstattung 1.000 + 1.050 → 24.950 bleibt KU
{
    const c = welt([{ id: 's1', datum: '2026-01-15', verkaufspreis: 24900, steuersatz: 0 },
                    { id: 's2', datum: '2026-03-01', verkaufspreis: 1050, steuersatz: 0 }],
        [{ datum: '2026-02-01', saleId: 's1', erstattungBetrag: 1000 }], { ustMode: 'klein' });
    const r = c.Kleinunternehmer.pruefe({ year: 2026, grenzen: { vj: 25000, lfd: 100000 },
        umsaetze: c.Kleinunternehmer.entgelte(2026), vorjahresUmsatz: 0, taetigkeitsbeginn: '2026-01-01' });
    assert.strictEqual(r.status, 'klein');
    ok('U06c: Gründer 24.900 − 1.000 + 1.050 = 24.950 € → Befreiung bleibt');
}
// (d) Altbestand: Retoure hat den Verkauf storniert → kein Doppelabzug
{
    const c = welt([{ id: 's1', datum: '2026-01-15', verkaufspreis: 500, steuersatz: 0, storniert: true }],
        [{ datum: '2026-02-01', saleId: 's1', erstattungBetrag: 500 }], { ustMode: 'klein' });
    assert.strictEqual(c.Kleinunternehmer.summe(2026), 0);
    ok('U06d: stornierter Altbestands-Verkauf und seine Retoure zählen beide nicht');
}
// (e) Anlagenverkauf (§19 Abs. 2 S. 2 UStG): Umsätze mit Anlagevermögen bleiben außer Ansatz —
// auch die Rückzahlung dazu
{
    const c = welt([{ id: 'w', datum: '2026-03-01', verkaufspreis: 20000, steuersatz: 0 },
        { id: 'l', datum: '2026-04-01', verkaufspreis: 8000, steuersatz: 0, anlagevermoegen: true, anlageId: 'L' }],
        [{ id: 'r', datum: '2026-05-01', saleId: 'l', erstattungBetrag: 500 }], { ustMode: 'klein' });
    assert.strictEqual(r2(c.Kleinunternehmer.summe(2026)), 20000);
    ok('U06e: Verkauf eines Anlageguts (8.000 €) zählt nicht zum Gesamtumsatz');
}
console.log('\n' + n + '/5 KU-Gesamtumsatz-Tests bestanden');
