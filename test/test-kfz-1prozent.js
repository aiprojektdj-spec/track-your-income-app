// Private Kfz-Nutzung nach der 1-%-Regel und Privatanteil bei §13b-Ausgaben (Entscheidungen User
// 2026-10-26).
//   node test/test-kfz-1prozent.js
// Sollwerte von Hand: §6 Abs. 1 Nr. 4 S. 2 EStG (1 % des auf volle 100 € abgerundeten
// Bruttolistenpreises je Kalendermonat; E-Auto Viertel bis zur Preisgrenze, sonst Hälfte),
// Abschn. 15.23 Abs. 5 UStAE (USt-Bemessung 80 % des ungeminderten 1-%-Werts, 19 %),
// §15 Abs. 1 S. 1 Nr. 4 UStG (Vorsteuer aus §13b nur für das Unternehmen).
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');
let n = 0; const ok = t => { n++; console.log('✓ ' + t); };
const r2 = v => Math.round(v * 100) / 100;

const Utils = {
    isInPeriod: (d, s, e) => !!d && d >= s && d <= e,
    getMonthName: () => 'Monat', formatDate: d => d, formatCurrency: v => String(v),
    istDrittland: () => false, showToast() {}, escapeHtml: s => String(s), EU_LAENDER: []
};
function welt(over) {
    const d = Object.assign({ sales: [], purchases: [], expenses: [], invoices: [], fahrten: [], retouren: [], anlagen: [],
        vorsteuer_entries: [], ustPerioden: [], settings: { ustMode: 'klein' } }, over);
    const aktiv = l => l.filter(x => !x.storniert);
    const Store = {
        getSettings: () => d.settings, getSales: all => all ? d.sales : aktiv(d.sales),
        getAllSalesRaw: () => d.sales, getPurchases: all => all ? d.purchases : aktiv(d.purchases),
        getExpenses: () => aktiv(d.expenses), getRetouren: () => d.retouren,
        getRechInvoices: () => d.invoices, getRechCustomers: () => [],
        getFahrten: () => d.fahrten, getAfaAnlagen: () => d.anlagen, getMaterialEinkauefe: () => [],
        getUstPerioden: () => d.ustPerioden, getSteuertermine: () => [],
        _syncReadRaw: () => [], getDifferenzVortrag: () => 0,
        get: k => d[k] || null, set: (k, v) => { d[k] = v; },
        salePerRate: s => [{ satz: parseFloat(s.steuersatz) || 19, brutto: +s.verkaufspreis || 0 }]
    };
    return ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/steuer-berechnung.js', 'js/afa.js',
        'js/vorsteuer.js', 'js/oss.js', 'js/ausgaben.js', 'js/fahrtenbuch.js', 'js/euer.js', 'js/ustvoranmeldung.js'],
        { Store, Utils, document: { getElementById: () => null } });
}
const pkw = (extra) => Object.assign({ id: 'P', bezeichnung: 'Pkw', anschaffungsdatum: '2025-03-10', anschaffungskosten: 30000,
    nutzungsdauer: 6, methode: 'linear', anlagenart: 'pkw', privatnutzung: '1prozent', bruttolistenpreis: 40050, antrieb: 'verbrenner' }, extra || {});

// 1. Verbrenner, Kleinunternehmer: 40.050 → 40.000 → 400 €/Monat, keine USt
{
    const c = welt({ anlagen: [pkw()] });
    const ne = c.Afa.nutzungsentnahme('2026-01-01', '2026-12-31');
    assert.strictEqual(ne.monate.length, 12);
    assert.strictEqual(r2(ne.wert), 4800);
    assert.strictEqual(ne.ust, 0);
    const e = c.Euer._berechne(2026, 0, 'jahr');
    assert.strictEqual(r2(e.kfzPrivat), 4800);
    assert.strictEqual(r2(e.summeEinnahmen), 4800);
    assert.strictEqual(r2(c.Euer._elsterZeilen(e).find(z => z.key === 'kfzPrivat').betrag), 4800);
    ok('Verbrenner 40.050 € (KU): 400 €/Monat, 4.800 € Betriebseinnahme 2026, keine USt');
}

// 2. Faktoren und Preisgrenzen für E-Autos je Anschaffungsdatum
{
    const c = welt();
    const w = a => Math.floor(a.bruttolistenpreis * c.Afa._kfzFaktor(a) / 100) * 100 * 0.01;   // wie nutzungsentnahme()
    assert.strictEqual(w(pkw({ antrieb: 'elektro', anschaffungsdatum: '2023-05-01', bruttolistenpreis: 59990 })), 149);   // ≤ 60.000 → Viertel
    assert.strictEqual(w(pkw({ antrieb: 'elektro', anschaffungsdatum: '2024-03-01', bruttolistenpreis: 75000 })), 375);   // > 70.000 → Hälfte
    assert.strictEqual(w(pkw({ antrieb: 'elektro', anschaffungsdatum: '2025-08-01', bruttolistenpreis: 80000 })), 200);   // ≤ 100.000 → Viertel
    assert.strictEqual(w(pkw({ antrieb: 'hybrid', anschaffungsdatum: '2025-08-01', bruttolistenpreis: 50000 })), 250);    // Hälfte
    assert.strictEqual(w(pkw({ antrieb: 'elektro', anschaffungsdatum: '2018-06-01', bruttolistenpreis: 50000 })), 500);   // vor 2019 → 1 %
    ok('E-Auto: Viertel bis 60.000/70.000/100.000 € je Anschaffung, sonst Hälfte; Hybrid Hälfte; vor 2019 1 %');
}

// 3. Regelbesteuerung: USt auf 80 % des ungeminderten Werts, Abgang beendet die Entnahme
{
    const settings = { ustMode: 'regel', ustVersteuerungsart: 'soll' };
    const c = welt({ settings, anlagen: [pkw({ anschaffungsdatum: '2026-01-10', abgangsdatum: '2026-03-15' })] });
    const q1 = c.UstVoranmeldung._calcPeriode('2026-01-01', '2026-03-31');
    assert.strictEqual(r2(q1.nettoUmsatz19), 960);
    assert.strictEqual(r2(q1.ust19), 182.4);
    assert.strictEqual(c.Afa.nutzungsentnahme('2026-04-01', '2026-06-30').monate.length, 0);
    const e = c.Euer._berechne(2026, 0, 'jahr');
    assert.strictEqual(r2(e.kfzPrivat), 1200);
    assert.strictEqual(r2(e.ustEinnahmen), 182.4);
    ok('Regel: Jan–Mär 3 × 400 € Entnahme, Kz 81 + 960 € (80 %), USt 182,40 €; nach Abgang keine Entnahme');
}

// 4. E-Auto bei Regelbesteuerung: ESt-Wert geviertelt, USt-Bemessung nicht
{
    const c = welt({ settings: { ustMode: 'regel', ustVersteuerungsart: 'soll' },
        anlagen: [pkw({ antrieb: 'elektro', anschaffungsdatum: '2026-01-05', bruttolistenpreis: 60000 })] });
    const m = c.Afa.nutzungsentnahme('2026-01-01', '2026-01-31').monate[0];
    assert.deepStrictEqual([m.wert, m.bemessung, m.ust], [150, 480, 91.2]);
    ok('E-Auto 60.000 € (Regel): Entnahme 150 €, USt-Bemessung 480 €, USt 91,20 €');
}

// 5. Vor Anschaffung kein Monat; Kleinunternehmer bei Anschaffung → auch später keine USt
{
    const c = welt({ settings: { ustMode: 'regel', ustModeHistorie: [{ ab: '0000-01-01', mode: 'klein' }, { ab: '2026-01-01', mode: 'regel' }] },
        anlagen: [pkw({ anschaffungsdatum: '2025-11-20' })] });
    const ne = c.Afa.nutzungsentnahme('2025-01-01', '2026-02-28');
    assert.strictEqual(JSON.stringify(ne.monate.map(m => m.monat)), JSON.stringify(['2025-11', '2025-12', '2026-01', '2026-02']));
    assert.strictEqual(ne.ust, 0);
    ok('Entnahme ab Anschaffungsmonat; ohne Vorsteuerabzug bei Anschaffung auch nach Wechsel keine USt');
}

// 6. §13b mit Privatanteil: Steuer voll, Vorsteuer anteilig
{
    const c = welt({ settings: { ustMode: 'regel', ustVersteuerungsart: 'soll' },
        expenses: [{ id: 'rc', datum: '2026-02-01', kategorie: 'Software/Abos', betrag: 100, ustSatz: 'rc', privatAnteil: 30 }] });
    const rc = c.Vorsteuer._calcRcAusgaben('2026-01-01', '2026-03-31');
    assert.strictEqual(r2(rc.steuer), 19);
    assert.strictEqual(r2(rc.vorsteuer), 13.3);
    ok('§13b 100 € mit 30 % privat: Steuer 19,00 €, Vorsteuer 13,30 €');
}

console.log('\n' + n + '/6 Tests bestanden');
