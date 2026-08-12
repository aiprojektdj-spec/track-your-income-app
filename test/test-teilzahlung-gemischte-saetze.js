// Teilzahlung bei gemischten Steuersätzen:  node test/test-teilzahlung-gemischte-saetze.js
//
// Fund D1 (Steuer-Delta-Audit 2026-08-11): rechnungen/js/dokumente.js blockierte Teilzahlungen,
// sobald eine Rechnung 7%- UND 19%-Positionen hatte. Die Begründung ("der Store kann einer
// Teilzahlung nur EINEN Satz mitgeben") war überholt — createSaleFromInvoice() teilt satzgenau
// auf (sale.steuersaetze). Die Sperre verursachte damit genau den Fehler, den sie verhindern
// sollte: "bitte Schlusszahlung abwarten" verschiebt einen im Dezember zugeflossenen Teilbetrag
// in den Januar — Verstoß gegen das Zuflussprinzip (§11 EStG).
//
// Beim Entfernen zeigte sich der eigentliche Haken: js/steuer-berechnung.js und js/gbr.js lasen
// nur `steuersatz` und fielen bei der Aufteilung auf ihren 19%-Default zurück. Ein 7%-Anteil wäre
// mit 19% genettet worden — zu wenig Gewinn, zu viel Umsatzsteuer. Deshalb Store.salePerRate().
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
let pass = 0;

// ── Store.salePerRate isoliert prüfen ───────────────────────────────────────────────────────
const storeSrc = read('js/store.js');
const m = storeSrc.match(/salePerRate\(sale, fallbackRate\) \{[\s\S]*?\n    \},/);
assert.ok(m, 'Store.salePerRate nicht gefunden');
const Store = new Function('return { ' + m[0] + ' };')();

// Einzelsatz: ein Eintrag über verkaufspreis + Versand
let g = Store.salePerRate({ verkaufspreis: 100, versandkostenKaeufer: 19, steuersatz: 19 });
assert.deepStrictEqual(g, [{ satz: 19, brutto: 119 }], 'Einzelsatz');
// 7%-Verkauf darf NICHT auf 19 fallen
g = Store.salePerRate({ verkaufspreis: 107, steuersatz: 7 });
assert.deepStrictEqual(g, [{ satz: 7, brutto: 107 }], '7% bleibt 7%');
// 0% (Reverse Charge / ig. Lieferung) darf nicht als "fehlt" gelten
g = Store.salePerRate({ verkaufspreis: 500, steuersatz: 0 });
assert.deepStrictEqual(g, [{ satz: 0, brutto: 500 }], '0% bleibt 0% (nicht 19%)');
pass++; console.log('✓ Einzelsatz-Verkäufe: 19%, 7% und 0% korrekt');

// Gemischte Aufteilung: beide Sätze, Beträge aus steuersaetze — NICHT aus verkaufspreis
g = Store.salePerRate({ verkaufspreis: 226, steuersaetze: { '7': 107, '19': 119 } });
assert.strictEqual(g.length, 2, 'zwei Gruppen');
assert.deepStrictEqual(g.find(x => x.satz === 7), { satz: 7, brutto: 107 });
assert.deepStrictEqual(g.find(x => x.satz === 19), { satz: 19, brutto: 119 });
pass++; console.log('✓ gemischte Sätze werden satzgenau zurückgegeben');

// Fehlender Satz → Default 19, aber überschreibbar (Retouren nutzen das)
assert.strictEqual(Store.salePerRate({ verkaufspreis: 100 })[0].satz, 19, 'Default 19%');
assert.strictEqual(Store.salePerRate({ verkaufspreis: 100 }, 7)[0].satz, 7, 'Default überschreibbar');
assert.strictEqual(Store.salePerRate({ verkaufspreis: 100, steuersatz: '' })[0].satz, 19, 'Leerstring = fehlt');
pass++; console.log('✓ fehlender Satz fällt auf 19% zurück, Fallback überschreibbar');

// ── Nettoberechnung: der Rechenfehler, den der Helfer verhindert ─────────────────────────────
// Nachbau von SteuerBerechnung.nettoSales mit dem Helfer, gegen die alte Variante gerechnet.
const netto = (b, r) => b / (1 + (isNaN(r) ? 19 : r) / 100);
const sale = { verkaufspreis: 226, steuersaetze: { '7': 107, '19': 119 } };
const neu = Store.salePerRate(sale).reduce((s, x) => s + netto(x.brutto, x.satz), 0);
const alt = netto(226, parseFloat(sale.steuersatz));   // alte Logik: steuersatz fehlt → 19%
assert.ok(Math.abs(neu - (100 + 100)) < 0.01, 'richtig: 107/1,07 + 119/1,19 = 200,00 €');
assert.ok(Math.abs(alt - 189.92) < 0.01, 'alte Logik ergab 189,92 € (7%-Anteil mit 19% genettet)');
assert.ok(neu > alt, 'der alte Weg wies zu wenig Gewinn und zu viel USt aus');
pass++; console.log('✓ Aufteilung ergibt 200,00 € netto statt 189,92 € (Differenz 10,08 €)');

// ── Die Sperre ist wirklich weg, und die Module nutzen den Helfer ────────────────────────────
const dok = read('rechnungen/js/dokumente.js');
assert.ok(!/hasMixedVatRates/.test(dok), 'hasMixedVatRates() vollständig entfernt');
assert.ok(!/gemischten MwSt-Sätzen/.test(dok), 'Blockade-Meldung entfernt');
assert.ok(/Fund D1/.test(dok), 'Begründung der Entfernung steht im Code');
pass++; console.log('✓ UI-Sperre samt Meldung entfernt, Begründung dokumentiert');

const sb = read('js/steuer-berechnung.js');
assert.ok(/Store\.salePerRate\(s\)/.test(sb), 'steuer-berechnung.js nutzt den Helfer');
assert.ok(!/nettoAusBrutto\(b, s\.steuersatz\)/.test(sb), 'alter Einzelsatz-Pfad ersetzt');
const gbr = read('js/gbr.js');
assert.ok(/Store\.salePerRate\(s\)/.test(gbr), 'gbr.js nutzt den Helfer');
pass++; console.log('✓ Gewinn- und GbR-Berechnung lesen die Aufteilung');

// Fallback ohne Store (Modul einzeln geladen) darf nicht crashen
assert.ok(/typeof Store !== 'undefined' && Store\.salePerRate/.test(sb),
    'steuer-berechnung.js prüft die Verfügbarkeit von Store');
pass++; console.log('✓ steuer-berechnung.js bleibt ohne Store lauffähig');

console.log('\n' + pass + '/7 Tests bestanden ✅');
