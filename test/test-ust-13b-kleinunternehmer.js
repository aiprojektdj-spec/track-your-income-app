// §13b UStG beim Leistungsempfänger: Kennzahlen 46/47 bzw. 84/85, Kleinunternehmer und
// manuelle Vorsteuer aus der KU-Zeit (Steuer-Audit 2026-10-18, U01/U04/U05).
//   node test/test-ust-13b-kleinunternehmer.js
// Sollwerte von Hand: §13b Abs.5 S.1 + Abs.8 UStG (auch der KU schuldet die Steuer),
// §19 Abs.1 UStG (kein Vorsteuerabzug für KU), Vordruck USt 1 A 2026 Zeilen 30–32.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

const EU = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
const Utils = {
    isInPeriod: (d, s, e) => !!d && d >= s && d <= e,
    getMonthName: () => 'Monat', formatDate: d => d, formatCurrency: v => String(v),
    istDrittland: c => !!c && c !== 'DE' && EU.indexOf(c) === -1,
    showToast() {}, escapeHtml: s => String(s), EU_LAENDER: EU
};

function welt(over) {
    const d = Object.assign({ sales: [], purchases: [], expenses: [], invoices: [], customers: [], retouren: [],
        vorsteuer_entries: [], ustPerioden: [], settings: { ustMode: 'regel', ustVersteuerungsart: 'soll' } }, over);
    const aktiv = l => l.filter(x => !x.storniert);
    const Store = {
        getSettings: () => d.settings, getSales: all => all ? d.sales : aktiv(d.sales),
        getAllSalesRaw: () => d.sales, getPurchases: all => all ? d.purchases : aktiv(d.purchases),
        getExpenses: () => aktiv(d.expenses), getRetouren: () => d.retouren,
        getRechInvoices: () => d.invoices, getRechCustomers: () => d.customers,
        getFahrten: () => [], getAfaAnlagen: () => [], getMaterialEinkauefe: () => [],
        getUstPerioden: () => d.ustPerioden, getSteuertermine: () => [],
        _syncReadRaw: () => [], getDifferenzVortrag: () => 0,
        get: k => d[k] || null, set: (k, v) => { d[k] = v; },
        salePerRate: s => [{ satz: parseFloat(s.steuersatz) || 19, brutto: +s.verkaufspreis || 0 }]
    };
    const c = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/steuer-berechnung.js', 'js/afa.js',
        'js/vorsteuer.js', 'js/oss.js', 'js/euer.js', 'js/ustvoranmeldung.js', 'js/steuertermine.js'], { Store, Utils });
    c.UstVoranmeldung._year = 2026;
    return c;
}
const q1 = c => c.UstVoranmeldung._calcPeriode('2026-01-01', '2026-03-31');
const zeilen = (c, calc) => Object.fromEntries(c.UstVoranmeldung._buildRows(calc).filter(r => r[0]).map(r => [r[0], r[2]]));
const nah = (a, b, t) => assert.ok(Math.abs(a - b) < 0.005, t + ': ' + a + ' statt ' + b);
let n = 0; const ok = t => { n++; console.log('✓ ' + t); };

// U01 — Steuerbeträge 47/85 und Abs.-2-Fälle in eigenen Kennzahlen
{
    const c = welt({ vorsteuer_entries: [
        { typ: 'reverse_charge', datum: '2026-02-01', paragraph: 'Abs. 1', nettoBetrag: 100, ustSatz: 19, vorsteuerBetrag: 19 },
        { typ: 'reverse_charge', datum: '2026-02-02', paragraph: 'Sonstige', nettoBetrag: 200, ustSatz: 19, vorsteuerBetrag: 38 }] });
    const z = zeilen(c, q1(c));
    assert.strictEqual(z['Kz. 46'], '100'); assert.strictEqual(z['Kz. 47'], '19.00');
    assert.strictEqual(z['Kz. 84'], '200'); assert.strictEqual(z['Kz. 85'], '38.00');
    assert.strictEqual(z['Kz. 67'], '57.00');
    ok('U01: Export enthält Kz 46/47, 84/85 und 67');
}

// Regelbesteuerer: RC-Ausgabe erzeugt §13b-Steuer und gleich hohe Vorsteuer, Zahllast 0
{
    const c = welt({ expenses: [{ id: 'e', datum: '2026-02-01', betrag: 100, ustSatz: 'rc', kategorie: 'Software/Abos' }] });
    const calc = q1(c);
    nah(calc.rcNettoAbs1, 100, 'Kz 46'); nah(calc.rcSteuerAbs1, 19, 'Kz 47'); nah(calc.vorsteuerRc, 19, 'Kz 67');
    nah(calc.zahllast, 0, 'Zahllast');
    ok('Regel: RC-Ausgabe 100 € → Kz 46 100, Kz 47 19, Kz 67 19, Zahllast 0');
}

// U04a — KU: RC-Ausgabe → Steuer 19 €, kein Abzug
{
    const c = welt({ settings: { ustMode: 'klein' },
        expenses: [{ id: 'e', datum: '2026-02-01', betrag: 100, ustSatz: 'rc', kategorie: 'Software/Abos' }] });
    const calc = q1(c);
    nah(calc.rcNettoAbs1, 100, 'Kz 46'); nah(calc.rcSteuerGesamt, 19, '§13b-Steuer');
    nah(calc.vorsteuerRc, 0, 'Kz 67'); nah(calc.zahllast, 19, 'Zahllast');
    ok('U04a: KU mit RC-Ausgabe 100 € schuldet 19 €');
}

// U04b — KU: manueller §13b-Eintrag ohne Vorsteuerabzug
{
    const c = welt({ settings: { ustMode: 'klein' }, vorsteuer_entries: [
        { typ: 'reverse_charge', datum: '2026-02-01', paragraph: 'Abs. 1', nettoBetrag: 100, ustSatz: 19, vorsteuerBetrag: 19 }] });
    const calc = q1(c);
    nah(calc.vorsteuerRc, 0, 'Kz 67'); nah(calc.zahllast, 19, 'Zahllast');
    ok('U04b: KU mit manuellem §13b-Eintrag: Kz 67 = 0, Zahllast 19');
}

// U04c — KU sieht die reduzierte §18-Abs.-4a-Ansicht statt der Sperre, ohne §13b-Fall den Hinweis
{
    const mit = welt({ settings: { ustMode: 'klein' },
        expenses: [{ id: 'e', datum: '2026-02-01', betrag: 100, ustSatz: 'rc', kategorie: 'Software/Abos' }] });
    mit.UstVoranmeldung._quartal = 0;
    const html = mit.UstVoranmeldung.render();
    assert.ok(!/Nur für Regelbesteuerer/.test(html), 'KU mit §13b-Fall darf nicht gesperrt sein');
    assert.ok(/§18 Abs\. 4a/.test(html), 'Ansicht nennt §18 Abs. 4a');
    assert.ok(/Kz\. 47/.test(html), 'Ansicht zeigt Kz 47');
    const ohne = welt({ settings: { ustMode: 'klein' } });
    assert.ok(/Nur für Regelbesteuerer/.test(ohne.UstVoranmeldung.render()), 'KU ohne §13b-Fall: Hinweis bleibt');
    ok('U04c: KU-Ansicht nur bei §13b-Fällen, sonst Hinweis');
}

// U05 — manuelle Vorsteuer aus der KU-Zeit im Wechselquartal nicht abziehbar
{
    const c = welt({ settings: { ustMode: 'regel', ustVersteuerungsart: 'soll',
        ustModeHistorie: [{ ab: '0000-01-01', mode: 'klein' }, { ab: '2026-02-15', mode: 'regel' }] },
        vorsteuer_entries: [
            { typ: 'sonstige', datum: '2026-02-01', nettoBetrag: 263.16, vorsteuerBetrag: 50 },
            { typ: 'sonstige', datum: '2026-03-01', nettoBetrag: 263.16, vorsteuerBetrag: 50 }] });
    nah(q1(c).vorsteuerEinkaufAusgaben, 50, 'Kz 66 nur der Eintrag nach dem Wechsel');
    ok('U05: Kz 66 enthält nur Vorsteuer ab dem Wechseldatum');
}

console.log('\n' + n + '/6 §13b-/KU-Tests bestanden');

// U02/U03 — Kz. 45: Drittland-Dienstleistung und OSS-Fernverkauf (Steuer-Audit 2026-10-18)
{
    const c = welt({ customers: [{ id: 'us', land: 'US', firma: 'Acme Inc.' }, { id: 'fr', land: 'FR' }],
        invoices: [
            { id: 'i1', datum: '2026-02-10', kundeId: 'us', typ: 'rechnung', status: 'versendet', isKlein: false,
              positionen: [{ menge: 1, einzelpreis: 1000, mwstSatz: 0, igArt: 'leistung' }, { menge: 1, einzelpreis: 300, mwstSatz: 0, igArt: 'ware' }] },
            { id: 'v', datum: '2025-06-01', kundeId: 'fr', typ: 'rechnung', status: 'versendet', isKlein: false, positionen: [{ menge: 1, einzelpreis: 10500, mwstSatz: 19 }] },
            { id: 'i2', datum: '2026-02-11', kundeId: 'fr', typ: 'rechnung', status: 'versendet', isKlein: false, positionen: [{ menge: 1, einzelpreis: 500, mwstSatz: 19 }] }] });
    const z = zeilen(c, q1(c));
    assert.strictEqual(z['Kz. 43'], '300');
    assert.strictEqual(z['Kz. 45'], '1500');
    console.log('✓ U02/U03: Drittland-Leistung 1.000 + OSS-Fernverkauf 500 in Kz 45, Ware 300 in Kz 43');
}

// R-TAX-06/07/09 — Soll-UVA: Gutschrift-Periode, volle Vorauszahlung, Cent-Rundung (Steuer-Audit 2026-10-14/18)
{
    const q2 = c => c.UstVoranmeldung._calcPeriode('2026-04-01', '2026-06-30');
    const rech = (id, datum, extra) => Object.assign({ id, datum, typ: 'rechnung', status: 'versendet', isKlein: false,
        positionen: [{ menge: 1, einzelpreis: 100, mwstSatz: 19 }] }, extra || {});
    // §17 Abs.1 UStG: Gutschrift vom 05.04. mit Lieferdatum 15.03. korrigiert Q2, nicht Q1
    let c = welt({ invoices: [rech('i', '2026-03-15', { datumsOption: 'lieferdatum', lieferdatum: '2026-03-15' }),
        rech('g', '2026-04-05', { typ: 'gutschrift', datumsOption: 'lieferdatum', lieferdatum: '2026-03-15' })] });
    nah(q1(c).ust19, 19, 'R-TAX-06 Q1'); nah(q2(c).ust19, -19, 'R-TAX-06 Q2');
    // §13 Abs.1 Nr.1a S.4 UStG: volle Vorauszahlung 01.03., Lieferung 15.04. → Q1 19, Q2 0
    c = welt({ invoices: [rech('i', '2026-02-01', { status: 'bezahlt', bezahltAm: '2026-03-01', datumsOption: 'lieferdatum', lieferdatum: '2026-04-15' })],
        sales: [{ id: 's', datum: '2026-03-01', verkaufspreis: 119, steuersatz: 19, _invoiceId: 'i' }] });
    nah(q1(c).ust19, 19, 'R-TAX-07 Q1'); nah(q2(c).ust19, 0, 'R-TAX-07 Q2');
    // 20 × (0,5 × 0,03 €) = 20 × 0,02 € (Rechnungskern rundet je Position) = 0,40 € → USt 0,076 €
    c = welt({ invoices: [rech('i', '2026-02-01', { positionen: Array.from({ length: 20 }, () => ({ menge: 0.5, einzelpreis: 0.03, mwstSatz: 19 })) })] });
    nah(q1(c).nettoUmsatz19, 0.40, 'R-TAX-09 Kz 81');
    console.log('✓ R-TAX-06/07/09: Gutschrift in Q2, Vorauszahlung in Q1, Positionsnetto auf Cent');
}

// R-TAX-02/03 — KU-Rechnung mit §25a-Artikel; §25a-Preisnachlass über Margenrekonstruktion
{
    const q2 = c => c.UstVoranmeldung._calcPeriode('2026-04-01', '2026-06-30');
    let c = welt({ settings: { ustMode: 'regel', ustVersteuerungsart: 'soll', ustModeHistorie: [{ ab: '0000-01-01', mode: 'klein' }, { ab: '2026-04-01', mode: 'regel' }] },
        purchases: [{ id: 'p', datum: '2026-01-01', einkaufspreis: 100, ustSatz: 0, differenzbesteuert: true }],
        invoices: [{ id: 'ku', datum: '2026-02-01', typ: 'rechnung', status: 'versendet', isKlein: true,
            positionen: [{ menge: 1, einzelpreis: 150, mwstSatz: 0, lagerArtikelId: 'p', differenzbesteuert: true }] }] });
    nah(q1(c).ust19, 0, 'R-TAX-02 KU-Rechnung');
    // 150 VK / 100 EK, Preisnachlass 30 € in Q2 auf den behaltenen Artikel: Marge 50 → 20, USt −30 × 19/119
    c = welt({ sales: [{ id: 's', datum: '2026-02-01', verkaufspreis: 150, steuersatz: 19, purchaseId: 'p' }],
        purchases: [{ id: 'p', datum: '2026-01-01', einkaufspreis: 100, ustSatz: 0, differenzbesteuert: true }],
        retouren: [{ id: 'r1', datum: '2026-04-01', saleId: 's', erstattungBetrag: 30, ware: 'keine' }] });
    nah(q2(c).ust19, -30 * 19 / 119, 'R-TAX-03 Preisnachlass');
    // Volle Rücknahme des Artikels: ganze Marge (50 × 19/119) zurück
    c = welt({ sales: [{ id: 's', datum: '2026-02-01', verkaufspreis: 150, steuersatz: 19, purchaseId: 'p' }],
        purchases: [{ id: 'p', datum: '2026-01-01', einkaufspreis: 100, ustSatz: 0, differenzbesteuert: true }],
        retouren: [{ id: 'r1', datum: '2026-04-01', saleId: 's', erstattungBetrag: 150, ware: 'zurueck', artikelIds: ['p'] }] });
    nah(q2(c).ust19, -50 * 19 / 119, 'R-TAX-03 volle Retoure');
    console.log('✓ R-TAX-02/03: KU-Rechnung ohne USt; §25a-Nachlass −4,79 €, volle Retoure −7,98 €');
}

// R-TAX-04 — EÜR/Übertragungshilfe: bei §25a enthält nur die Marge Umsatzsteuer
{
    const c = welt({ settings: { ustMode: 'regel', ustVersteuerungsart: 'ist' },
        sales: [{ id: 's', datum: '2026-02-01', verkaufspreis: 150, steuersatz: 19, purchaseId: 'p' }],
        purchases: [{ id: 'p', datum: '2026-01-01', einkaufspreis: 100, ustSatz: 0, differenzbesteuert: true }] });
    const e = c.Euer._berechne(2026, 0, 'jahr');
    const z = Object.fromEntries(c.Euer._elsterZeilen(e).map(x => [x.key, x.betrag]));
    nah(z.ust, 50 * 19 / 119, 'R-TAX-04 USt');
    nah(z.erloese, 150 - 50 * 19 / 119, 'R-TAX-04 Erlöse netto');
    nah(e.gewinn, 50, 'R-TAX-04 Gewinn');
    console.log('✓ R-TAX-04: §25a 150 VK / 100 EK → USt 7,98 €, Erlöse netto 142,02 €, Gewinn 50 €');
}

// R-TAX-08 — Zehn-Tage-Regel: USt-Vorauszahlung Q4/2024, fällig 10.01.2025, gezahlt 08.01.2025 → EÜR 2024
{
    const fa = extra => Object.assign({ id: 'fa', datum: '2025-01-08', betrag: 100, ustSatz: 0, kategorie: 'Umsatzsteuer an Finanzamt', ustZeitraum: '2024-Q4' }, extra || {});
    let c = welt({ settings: { ustMode: 'regel', ustVersteuerungsart: 'ist' }, expenses: [fa()] });
    nah(c.Euer._berechne(2024, 0, 'jahr').gewinn, -100, 'R-TAX-08 2024'); nah(c.Euer._berechne(2025, 0, 'jahr').gewinn, 0, 'R-TAX-08 2025');
    c = welt({ settings: { ustMode: 'regel', ustVersteuerungsart: 'ist' }, expenses: [fa({ ustDauerfrist: true })] });
    nah(c.Euer._berechne(2025, 0, 'jahr').gewinn, -100, 'mit Dauerfristverlängerung fällig 10.02. → 2025');
    c = welt({ settings: { ustMode: 'regel', ustVersteuerungsart: 'ist' }, expenses: [fa({ datum: '2025-01-11' })] });
    nah(c.Euer._berechne(2025, 0, 'jahr').gewinn, -100, 'nach dem 10.01. gezahlt → 2025');
    c = welt({ settings: { ustMode: 'regel', ustVersteuerungsart: 'ist' }, expenses: [fa({ ustZeitraum: '2024-11' })] });
    nah(c.Euer._berechne(2025, 0, 'jahr').gewinn, -100, 'November-Zahlung (fällig 10.12.) → 2025');
    console.log('✓ R-TAX-08: Q4-Vorauszahlung vom 08.01. ins Vorjahr; DFV, 11.01. und November bleiben im Zahlungsjahr');
}

// U10/U11/U12 — volle Euro, Fristen nach Historie, kein §25a-Kz-500-Hinweis
{
    let c = welt({ invoices: [{ id: 'i', datum: '2026-02-10', typ: 'rechnung', status: 'versendet', isKlein: false, positionen: [{ menge: 1, einzelpreis: 100.42, mwstSatz: 19 }] }] });
    const z = zeilen(c, q1(c));
    assert.strictEqual(z['Kz. 81'], '100', 'U10 Kz 81 ohne Cent');
    c = welt({ settings: { ustMode: 'regel', ustVersteuerungsart: 'soll', ustModeHistorie: [{ ab: '0000-01-01', mode: 'klein' }, { ab: '2026-07-01', mode: 'regel' }] } });
    const t = c.Steuertermine._ustTermine(2026).map(x => x.beschreibung);
    assert.ok(!t.some(b => /Q4 2025|Q1 2026|Q2 2026/.test(b)) && t.some(b => /Q3 2026/.test(b)), 'U11 Termine: ' + t.join(', '));
    c = welt({ sales: [{ id: 's', datum: '2026-02-01', verkaufspreis: 150, steuersatz: 19, purchaseId: 'p' }],
        purchases: [{ id: 'p', datum: '2026-01-01', einkaufspreis: 100, ustSatz: 0, differenzbesteuert: true }] });
    c.UstVoranmeldung._quartal = 0;
    assert.ok(!/Kennziffer 500/.test(c.UstVoranmeldung.render()), 'U12 Kz-500-Hinweis');
    console.log('✓ U10/U11/U12: Kz 81 = 100 (ohne Cent), keine Termine für KU-Quartale, kein Kz-500-Hinweis');
}
