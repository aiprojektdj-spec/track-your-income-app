// Regressionstest fuer Utils.waehleDatenblatt:  node test/test-xlsx-blattwahl.js
//
// Hintergrund: drei Importpfade griffen fest auf wb.SheetNames[0] — lager/page.js (zweimal)
// und js/buchungen.js. An einer echten mehrblaettrigen Datei war Blatt 0 die "ANLEITUNG",
// und der Import meldete gruen "17 Zeilen geladen aus ANLEITUNG" ueber Fliesstext
// (Live-Test 1, plan/live-tests-checkliste.md, Fund 4).
//
// Die Datei von damals liegt bewusst NICHT im Repo (sie enthaelt echte Buchhaltungsdaten).
// Der Test baut ihre Struktur deshalb nach: einspaltiges Anleitungsblatt vorn, Datentabelle
// dahinter.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const XLSX = require('../js/vendor/xlsx.full.min.js');

let pass = 0;

// Utils laesst sich in Node nicht laden (haengt an document/window). Die Funktion wird
// deshalb im Wortlaut aus js/utils.js geschnitten — geprueft wird ausgelieferter Code.
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'utils.js'), 'utf8');
const m = SRC.match(/ {4}waehleDatenblatt\(wb\) \{[\s\S]*?\n {4}\},/);
assert.ok(m, 'waehleDatenblatt nicht in js/utils.js gefunden');
const waehleDatenblatt = eval('(function ' + m[0].trim().replace(/,$/, '') + ')');

const mappe = blaetter => {
    const wb = XLSX.utils.book_new();
    blaetter.forEach(([name, aoa]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name));
    return wb;
};

// Der gemessene Fall: einspaltige ANLEITUNG vor der Datentabelle
const anleitung = [['📘 EINFACHE ANLEITUNG – Reselling'], ['Diese Datei hilft dir, deine Zahlen zu ordnen.'],
                   ['1. Trage alle Einkäufe ein'], ['2. Trage alle Verkäufe ein']];
const einkaeufe = [['Belegnummer', 'Datum', 'Plattform', 'Artikel', 'Betrag (€)'],
                   ['E-0001', '2025-04-19', 'Vinted', 'Adidas Trainingsjacke XL', '12,00'],
                   ['E-0002', '2025-04-25', 'Vinted', 'Ralph Lauren Polo L', '14,00']];

assert.strictEqual(waehleDatenblatt(mappe([['ANLEITUNG', anleitung], ['Einkaeufe', einkaeufe]])), 'Einkaeufe',
    'Das einspaltige Anleitungsblatt darf nicht gewaehlt werden');
pass++; console.log('✓ einspaltiges Anleitungsblatt wird uebersprungen, die Tabelle gewaehlt');

// Reihenfolge darf egal sein: steht die Tabelle vorn, bleibt sie es
assert.strictEqual(waehleDatenblatt(mappe([['Einkaeufe', einkaeufe], ['ANLEITUNG', anleitung]])), 'Einkaeufe',
    'Steht die Tabelle vorn, muss sie gewaehlt bleiben');
pass++; console.log('✓ steht die Tabelle vorn, bleibt sie gewaehlt');

// Einblaettrige Mappe: unveraenderte Vorgabe, kein Mehraufwand
assert.strictEqual(waehleDatenblatt(mappe([['Tabelle1', einkaeufe]])), 'Tabelle1');
pass++; console.log('✓ einblaettrige Mappe liefert unveraendert ihr einziges Blatt');

// Findet sich NICHTS Tabellenartiges, bleibt es bei Blatt 0 — nie schlechter als vorher.
assert.strictEqual(waehleDatenblatt(mappe([['Nur Text', anleitung], ['Auch Text', [['x'], ['y']]]])), 'Nur Text',
    'Ohne Tabelle muss der alte Vorgabewert SheetNames[0] herauskommen');
pass++; console.log('✓ ohne erkennbare Tabelle bleibt es bei Blatt 0 (kein Rueckschritt)');

// Ein Blatt mit NUR Kopfzeile ist keine Tabelle — es braucht mindestens eine Datenzeile.
// (Das Kassenbuch-Blatt der gemessenen Datei sah genau so aus.)
const nurKopf = [['Datum', 'Art', 'Betrag (€)', 'Grund']];
assert.strictEqual(waehleDatenblatt(mappe([['Kassenbuch', nurKopf], ['Einkaeufe', einkaeufe]])), 'Einkaeufe',
    'Ein Blatt mit nur einer Kopfzeile darf nicht gewaehlt werden');
pass++; console.log('✓ Blatt mit nur einer Kopfzeile zaehlt nicht als Tabelle');

// Kein Blatt / kaputte Mappe darf nicht werfen
assert.strictEqual(waehleDatenblatt({ SheetNames: [], Sheets: {} }), undefined);
assert.strictEqual(waehleDatenblatt(null), undefined);
pass++; console.log('✓ leere und fehlende Mappe werfen nicht');

// Die drei Aufrufstellen duerfen nicht wieder auf SheetNames[0] zurueckfallen
[['lager/page.js', 2], ['js/buchungen.js', 1]].forEach(([datei, erwartet]) => {
    const s = fs.readFileSync(path.join(__dirname, '..', datei), 'utf8');
    const treffer = (s.match(/Utils\.waehleDatenblatt\(/g) || []).length;
    assert.strictEqual(treffer, erwartet, datei + ' muss Utils.waehleDatenblatt ' + erwartet + '-mal benutzen');
    assert.ok(!/wb\.SheetNames\[0\]/.test(s), datei + ' darf nicht mehr fest auf SheetNames[0] greifen');
});
pass++; console.log('✓ alle drei Aufrufstellen benutzen die gemeinsame Blattwahl');

console.log('\n' + pass + '/7 Tests bestanden ✅');
