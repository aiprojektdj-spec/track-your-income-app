// Regression Audit 2026-10-13, T01/T02/T06 — EÜR als Zahlungsrechnung mit Umsatzsteuer.
//
// T01: Vereinnahmte USt ist im Zuflussjahr Betriebseinnahme, die Abführung ans Finanzamt eine
//      Betriebsausgabe im Jahr der Zahlung (§11 EStG, BFH VIII B 54/20).
// T02: Der ELSTER-Hilfsexport nutzt dasselbe Ergebnis wie die Anzeige — keine /1,19-Formel.
// T06: Ein Wechsel zur Regelbesteuerung darf alte KU-Vorgänge nicht neu klassifizieren.
//
// Sollwerte stammen aus den Abnahmebeispielen des Fixauftrags, nicht aus dem Code.
// Geladen werden die echten Module js/steuerstatus.js, js/steuer-berechnung.js, js/euer.js.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

let fail = 0, pass = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: erwartet ${b}, war ${a}`);

function welt(o) {
    const d = Object.assign({ sales: [], purchases: [], expenses: [], retouren: [], fahrten: [],
        invoices: [], settings: { ustMode: 'regel' } }, o);
    const aktiv = l => l.filter(x => !x.storniert);
    const Store = {
        getSettings: () => d.settings,
        getSales: alle => alle ? d.sales : aktiv(d.sales),
        getPurchases: alle => alle ? d.purchases : aktiv(d.purchases),
        getExpenses: () => aktiv(d.expenses),
        getRechInvoices: () => d.invoices,
        getRetouren: () => d.retouren,
        getFahrten: () => d.fahrten,
        getMaterialEinkauefe: () => [],
        getAfaAnlagen: () => [],
        _syncReadRaw: () => [],
        salePerRate(sale) {
            const b = (parseFloat(sale.verkaufspreis) || 0) + (parseFloat(sale.versandkostenKaeufer) || 0);
            const r = parseFloat(sale.steuersatz);
            return [{ satz: isNaN(r) ? 19 : r, brutto: b }];
        }
    };
    const Utils = { isInPeriod: (x, s, e) => !!x && x >= s && x <= e, getMonthName: () => 'M',
        formatDate: x => x, istDrittland: () => false };
    return ladeModule(['js/steuerstatus.js', 'js/steuer-berechnung.js', 'js/euer.js'], { Store, Utils });
}
const verkauf = (id, datum, brutto, satz, extra) => Object.assign({ id, datum, verkaufspreis: brutto,
    versandkostenKaeufer: 0, versandkostenVerkaufer: 0, plattformgebuehrProzent: 0 },
    satz === undefined ? {} : { steuersatz: satz }, extra || {});

check('T01: 119 € Zufluss 15.12.2026, Abführung erst 2027 → EÜR 2026 = 119 €', () => {
    const ctx = welt({ sales: [verkauf('s1', '2026-12-15', 119, 19)] });
    const r = ctx.Euer._berechne(2026, 0, 'jahr');
    near(r.gewinn, 119, 'Gewinn 2026');
    near(r.ustEinnahmen, 19, 'vereinnahmte USt');
    near(r.einnahmenNetto, 100, 'Erlös netto');
    near(r.nettoGewinn, 100, 'wirtschaftlicher Nettogewinn bleibt getrennt');
});

check('T01: echte USt-Abführung 19 € am 20.12.2026 → Gewinn 100 €, nicht 81 €', () => {
    // Variante A: Abführung in der dafür vorgesehenen Kategorie
    let ctx = welt({ sales: [verkauf('s1', '2026-12-15', 119, 19)] });
    ctx.Store.getExpenses = () => [{ id: 'e1', datum: '2026-12-20', betrag: 19, ustSatz: 0, kategorie: ctx.Euer.KAT_UST_ZAHLUNG }];
    let r = ctx.Euer._berechne(2026, 0, 'jahr');
    near(r.gewinn, 100, 'Gewinn (Kategorie USt an Finanzamt)');
    near(r.ustZahlungenFA, 19, 'USt-Zahlung eigene Zeile');
    near(r.sonstigeAusgaben, 0, 'keine Betriebsausgabe');
    // Variante B wie im Audit: allgemeine Ausgabe mit Satz 0
    ctx = welt({ sales: [verkauf('s1', '2026-12-15', 119, 19)],
        expenses: [{ id: 'e1', datum: '2026-12-20', betrag: 19, ustSatz: 0, kategorie: 'Sonstiges' }] });
    r = ctx.Euer._berechne(2026, 0, 'jahr');
    near(r.gewinn, 100, 'Gewinn (Ausgabe mit Satz 0)');
});

check('T01: Erstattung vom Finanzamt ist Einnahme im Zahlungsjahr', () => {
    const ctx = welt({});
    ctx.Store.getExpenses = () => [{ id: 'e1', datum: '2026-03-10', betrag: 50, ustSatz: 0, kategorie: ctx.Euer.KAT_UST_ERSTATTUNG }];
    const r = ctx.Euer._berechne(2026, 0, 'jahr');
    near(r.gewinn, 50, 'Gewinn');
    near(r.summeAusgaben, 0, 'keine Ausgabe');
});

check('T01: Vorsteuer ist Ausgabe — Einkauf 119 € brutto mindert den Gewinn um 119 €', () => {
    const ctx = welt({ purchases: [{ id: 'p1', datum: '2026-05-01', einkaufspreis: 119, anzahl: 1, ustSatz: 19 }] });
    const r = ctx.Euer._berechne(2026, 0, 'jahr');
    near(r.gewinn, -119, 'Gewinn');
    near(r.vorsteuer, 19, 'Vorsteuer ausgewiesen');
    near(r.nettoGewinn, -100, 'Nettogewinn');
});

check('T02: 7 %-Erlös 107 € → netto 100 €; Privatankauf 100 € ohne Vorsteuer; km-Pauschale 30 €', () => {
    const ctx = welt({
        sales: [verkauf('s1', '2026-04-01', 107, 7)],
        purchases: [{ id: 'p1', datum: '2026-04-02', einkaufspreis: 100, anzahl: 1, ustSatz: 0 }],
        fahrten: [{ id: 'f1', datum: '2026-04-03', kosten: 30 }]
    });
    const r = ctx.Euer._berechne(2026, 0, 'jahr');
    near(r.einnahmenNetto, 100, 'Erlös netto');
    near(r.ustEinnahmen, 7, 'USt 7 %');
    near(r.vorsteuer, 0, 'keine erfundene Vorsteuer');
    near(r.fahrtkosten, 30, 'Pauschale voll');
    near(r.gewinn, 107 - 100 - 30, 'steuerlicher Gewinn');
    near(r.nettoGewinn, 100 - 100 - 30, 'Nettovergleich −30 €');
    // Export-Zeilen aus demselben Ergebnis
    const z = ctx.Euer._elsterZeilen(r);
    const wert = name => z.find(x => x.key === name).betrag;
    near(wert('erloese'), 100, 'Export: Erlöse netto');
    near(wert('ust'), 7, 'Export: vereinnahmte USt');
    near(wert('waren'), 100, 'Export: Wareneinkauf');
    near(wert('fahrt'), 30, 'Export: Fahrtkosten');
    near(wert('gewinn'), r.gewinn, 'Export-Gewinn = Anzeige-Gewinn');
});

check('T02: Regelbesteuerter Verkauf ohne Steuersatz wird gemeldet, nicht still mit 19 % gerechnet', () => {
    const ctx = welt({ sales: [verkauf('s1', '2026-04-01', 119)] });
    const r = ctx.Euer._berechne(2026, 0, 'jahr');
    assert.strictEqual(r.ohneSteuersatz.length, 1, 'ohneSteuersatz');
});

check('T06: KU-Verkauf 119 € aus 2025 bleibt nach Wechsel zur Regelbesteuerung 119 €', () => {
    const ctx = welt({ sales: [verkauf('s1', '2025-08-01', 119)], settings: { ustMode: 'klein' } });
    near(ctx.Euer._berechne(2025, 0, 'jahr').gewinn, 119, 'vor dem Wechsel');
    // Wechsel ab 01.01.2026 — so wie Store.saveSettings ihn einträgt
    const neu = ctx.SteuerStatus.wechsel({ ustMode: 'klein' }, 'regel', '2026-01-01');
    ctx.Store.getSettings = () => neu;
    assert.strictEqual(neu.ustMode, 'regel');
    near(ctx.Euer._berechne(2025, 0, 'jahr').gewinn, 119, 'EÜR 2025 nach dem Wechsel');
    // Ein Verkauf ab dem Wechsel ist regelbesteuert
    ctx.Store.getSales = () => [verkauf('s2', '2026-02-01', 119, 19)];
    near(ctx.Euer._berechne(2026, 0, 'jahr').einnahmenNetto, 100, '2026 netto');
});

check('T06: am Vorgang gestempelte Behandlung schlägt die Historie', () => {
    const ctx = welt({ sales: [verkauf('s1', '2026-08-01', 119, 19, { ustBehandlung: 'klein' })] });
    const r = ctx.Euer._berechne(2026, 0, 'jahr');
    near(r.ustEinnahmen, 0, 'keine USt bei KU-Stempel');
    near(r.gewinn, 119, 'Gewinn');
});

check('T06 Store: Moduswechsel wird datiert festgehalten, Formular-Speichern verliert die Historie nicht, Vorgänge werden gestempelt', () => {
    const mem = {};
    const localStorage = { getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
    const ctx = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/store.js'], { localStorage });
    const S = ctx.Store;
    S.saveSettings({ ustMode: 'klein' });
    S.saveSettings({ ustMode: 'regel', _ustModeAb: '2026-01-01' });
    // Das Einstellungsformular baut ein neues Objekt ohne Historie
    S.saveSettings({ ustMode: 'regel', firmenname: 'Testfirma' });
    const st = S.getSettings();
    assert.strictEqual(st._ustModeAb, undefined, 'Hilfsfeld nicht gespeichert');
    assert.strictEqual(ctx.SteuerStatus.modeAm('2025-12-31', st), 'klein', 'vor dem Wechsel');
    assert.strictEqual(ctx.SteuerStatus.modeAm('2026-01-01', st), 'regel', 'ab dem Wechsel');
    assert.strictEqual(S.saveSale({ datum: '2025-06-01', verkaufspreis: 119 }).ustBehandlung, 'klein');
    assert.strictEqual(S.saveSale({ datum: '2026-06-01', verkaufspreis: 119, steuersatz: 19 }).ustBehandlung, 'regel');
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
