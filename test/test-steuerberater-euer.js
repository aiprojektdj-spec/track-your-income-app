// Das Steuerberater-Paket zeigt die EÜR aus derselben Rechnung wie die App.
//
// js/steuerberater.js baut das HTML-Dokument, das beim Steuerberater landet. Bis 2026-10-07
// stand darin eine eigene, zweite Gewinnformel (Verkaeufe − Wareneinkauf − Ausgaben, Fund A1
// des Vollaudits 2026-09-09). Seit dem Audit 2026-10-13 (T01/T02) kommen die Zeilen aus
// Euer._elsterZeilen(), gebildet aus dem Ergebnis von Euer._berechne().
//
// Dieser Test stand vor dem Audit ungetrackt im Repo und prüfte eine Paketfassung, die es so
// nie gab (Stub warf bei getAllSalesRaw, Quelltextmuster einer anderen Schreibweise). Er ist am
// 2026-10-14 auf den echten Produktpfad umgestellt: echte Module js/steuerstatus.js,
// js/steuer-berechnung.js, js/euer.js und js/steuerberater.js, nur Store/Utils/DOM simuliert.
//
// Geprüft wird an den gerenderten Zeilen — nicht am Quelltext:
//   B) Kleinunternehmer: jede der acht früher vergessenen Größen trägt einen Betrag, die
//      Spalte summiert auf den ausgewiesenen Gewinn = Euer._berechne().gewinn = −125 €.
//   C) Regelbesteuerung: vereinnahmte USt und Vorsteuer stehen als eigene Zeilen, die Spalte
//      summiert auf den Gewinn.
//   D) ohne js/euer.js wird kein Paket erzeugt.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

let fail = 0, pass = 0;
function check(name, fn) {
    try { assert.ok(fn() !== false); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + (e && e.message ? '\n   ' + e.message : '')); }
}

function szenario(ustMode) {
    return {
        settings: { ustMode, firmenname: 'Testfirma' },
        sales: [{ id: 's1', datum: '2026-03-01', verkaufspreis: 1000, versandkostenKaeufer: 50,
                  versandkostenVerkaufer: 30, plattformgebuehrProzent: 10, steuersatz: 19 }],
        purchases: [{ id: 'p1', datum: '2026-02-01', einkaufspreis: 400, anzahl: 1, ustSatz: 19 }],
        expenses: [{ id: 'e1', datum: '2026-04-01', betrag: 100, kategorie: 'Büro', ustSatz: 19 }],
        retouren: [{ datum: '2026-05-01', erstattungBetrag: 120, saleId: null }],
        fahrten: [{ datum: '2026-06-01', kosten: 60 }],
        materialEinkaeufe: [{ datum: '2026-07-01', gesamtkosten: 90 }],
        afa: 200,
        eigenbelege: [{ belegDatum: '2026-08-01', betragBrutto: 70, betragNetto: 70 }]
    };
}

function exportiere(o, ohneEuer) {
    const out = { html: null, toasts: [], datei: null };
    let klick = null;
    const felder = {
        stbYear: { value: '2026' }, stbPin: { value: '' },
        stb_eur: { checked: true }, stb_invoices: { checked: false }, stb_expenses: { checked: false },
        stb_purchases: { checked: false }, stb_afa: { checked: false }, stb_audit: { checked: false },
        stbExportBtn: { addEventListener: (ev, fn) => { klick = fn; } }
    };
    const aktiv = l => l.filter(x => !x.storniert);
    const Store = {
        getSettings: () => o.settings,
        getSales: alle => alle ? o.sales : aktiv(o.sales),
        getPurchases: alle => alle ? o.purchases : aktiv(o.purchases),
        getExpenses: () => aktiv(o.expenses),
        getAllPurchasesRaw: () => o.purchases, getAllExpensesRaw: () => o.expenses,
        getRechInvoices: () => [], getRechCustomers: () => [],
        getRetouren: () => o.retouren, getFahrten: () => o.fahrten,
        getMaterialEinkauefe: () => o.materialEinkaeufe,
        getAfaAnlagen: () => [{ id: 'a1' }], getAuditLog: () => [],
        _syncReadRaw: () => o.eigenbelege,
        salePerRate: s => [{ satz: parseFloat(s.steuersatz), brutto: (s.verkaufspreis || 0) + (s.versandkostenKaeufer || 0) }]
    };
    const Utils = {
        isInPeriod: (d, s, e) => !!d && d >= s && d <= e, getMonthName: () => 'M', formatDate: d => d,
        istDrittland: () => false, escapeHtml: s => String(s),
        downloadFile: (html, name) => { out.html = html; out.datei = name; },
        showToast: (m, t) => out.toasts.push([m, t])
    };
    const dateien = ohneEuer ? ['js/steuerberater.js']
        : ['js/steuerstatus.js', 'js/steuer-berechnung.js', 'js/euer.js', 'js/steuerberater.js'];
    const ctx = ladeModule(dateien, { Store, Utils, Afa: { _calcJahresAfa: () => o.afa },
        document: { getElementById: id => felder[id] || { checked: false } } });
    ctx.Steuerberater.init();
    klick();
    out.ctx = ctx;
    return out;
}

// "1.234,56 €" → Zahl
const betrag = s => parseFloat(String(s).replace(/[^0-9,\-−]/g, '').replace('−', '-').replace(',', '.'));
function zeilen(html) {
    const sec = html.slice(html.indexOf('id="s_eur"'), html.indexOf('</section>', html.indexOf('id="s_eur"')));
    return [...sec.matchAll(/<td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td>/g)].map(m => ({ label: m[1], wert: betrag(m[2]) }));
}
function spaltensumme(z) {
    return z.filter(x => !x.label.startsWith('=')).reduce((s, x) => s + (x.label.startsWith('−') ? -x.wert : x.wert), 0);
}

// ── B: Kleinunternehmer ──
{
    const o = szenario('klein');
    const out = exportiere(o);
    const d = out.ctx.Euer._berechne(2026, 0, 'jahr');
    const z = zeilen(out.html);
    const gewinnZeile = z.find(x => x.label.startsWith('='));
    // 1050 − 120 Retoure − 400 − 200 AfA − 60 Fahrt − (30 Versand + 105 Gebühr + 90 Material + 100 Büro + 70 Eigenbeleg) = −125
    check('B1 Gewinn = Euer._berechne().gewinn = −125 €', () => Math.abs(d.gewinn - (-125)) < 0.01 && Math.abs(gewinnZeile.wert - d.gewinn) < 0.01);
    check('B2 die Spalte summiert auf den ausgewiesenen Gewinn', () => Math.abs(spaltensumme(z) - gewinnZeile.wert) < 0.05);
    check('B3 Fahrtkosten eigene Zeile', () => z.some(x => /Fahrtkosten/.test(x.label) && Math.abs(x.wert - 60) < 0.01));
    check('B4 AfA eigene Zeile', () => z.some(x => /AfA/.test(x.label) && Math.abs(x.wert - 200) < 0.01));
    check('B5 Sammelposten enthält Versand, Gebühr, Material, Büro, Eigenbeleg (395 €)',
        () => z.some(x => /Übrige Betriebsausgaben/.test(x.label) && Math.abs(x.wert - 395) < 0.01));
    check('B6 Retoure in den Erlösen abgezogen (930 €)', () => z.some(x => /Kleinunternehmer/.test(x.label) && Math.abs(x.wert - 930) < 0.01));
    check('B7 §19-Hinweis, keine Vorsteuerzeile', () => /§19 UStG/.test(out.html) && !z.some(x => /Vorsteuer/.test(x.label)));
    check('B8 Dateiname nennt Jahr und Firma', () => /Stackr_Steuerberater_2026_Testfirma\.html/.test(out.datei || ''));
}

// ── C: Regelbesteuerung ──
{
    const o = szenario('regel');
    const out = exportiere(o);
    const d = out.ctx.Euer._berechne(2026, 0, 'jahr');
    const z = zeilen(out.html);
    const gewinnZeile = z.find(x => x.label.startsWith('='));
    check('C1 Gewinn im Paket = Euer._berechne().gewinn', () => Math.abs(gewinnZeile.wert - d.gewinn) < 0.01);
    check('C2 vereinnahmte USt eigene Zeile', () => z.some(x => /Vereinnahmte Umsatzsteuer/.test(x.label) && Math.abs(x.wert - d.ustEinnahmen) < 0.01));
    check('C3 Vorsteuer eigene Zeile und > 0', () => d.vorsteuer > 0 && z.some(x => /Vorsteuer/.test(x.label) && Math.abs(x.wert - d.vorsteuer) < 0.01));
    check('C4 die Spalte summiert auf den Gewinn', () => Math.abs(spaltensumme(z) - gewinnZeile.wert) < 0.05);
    // Steuerlicher Gewinn bei Regelbesteuerung = Zahlungsrechnung: gleich wie brutto, weil im
    // Jahr nichts an das Finanzamt gezahlt wurde (T01).
    check('C5 ohne USt-Zahlung im Jahr ist der steuerliche Gewinn der Bruttowert (−125 €)', () => Math.abs(d.gewinn - (-125)) < 0.01);
    check('C6 kein §19-Hinweis', () => !/§19 UStG/.test(out.html));
}

// ── D: ohne js/euer.js keine geratene Zahl ──
{
    const out = exportiere(szenario('klein'), true);
    check('D1 kein Download', () => out.html === null);
    check('D2 Fehlermeldung', () => out.toasts.some(t => t[1] === 'error'));
}

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
