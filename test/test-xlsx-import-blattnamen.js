// Regressionstest fuer den Excel-Vorlage-Import:  node test/test-xlsx-import-blattnamen.js
//
// Hintergrund: Live-Test 1 (plan/live-tests-checkliste.md) hat an einer echten Datei gemessen,
// dass der Import still nur die Haelfte uebernimmt. Drei Defekte, die alle nach aussen wie ein
// gelungener Import aussahen:
//   1. Der ASCII-Blattname stand als 'Verkauefe' statt 'Verkaeufe' (u und e vertauscht).
//   2. Der Abschluss-Toast filterte Nullwerte heraus, statt "0 Verkaeufe" zu melden.
//   3. parseNum ersetzte per String-Argument nur das erste Komma ("1.234,56" -> 1.234).
//
// Seit 2026-11-26 liegt die Zeilenlogik im Fachmodul js/import-excel-vorlage.js und wird hier
// direkt geladen. Nur die Blattnamen stehen weiter in js/app.js und werden dort ausgeschnitten.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ladeModule } = require('./_lade-module');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const X = ladeModule(['js/import-kern.js', 'js/import-lager.js', 'js/import-excel-vorlage.js']).ExcelVorlageImport;
let pass = 0;

// ---------------------------------------------------------------------------
// 1) Blattnamen: jeder ASCII-Name muss die korrekte Transliteration des Umlaut-Namens sein
// ---------------------------------------------------------------------------
const translit = s => s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
                       .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss');

// Zeilen der Form ['Einkäufe', 'einkauf', X.einkaeufe, ['Einkäufe', 'Einkaeufe', …]]
const ketten = SRC.match(/\['[^']+', '(?:einkauf|verkauf|ausgaben)', X\.\w+, \[[^\]]+\]\]/g) || [];
assert.strictEqual(ketten.length, 3, 'Es sollten genau drei Blattnamen-Ketten sein, gefunden: ' + ketten.length);
const alleNamen = [];
ketten.forEach(kette => {
    const namen = (kette.match(/, \[([^\]]+)\]\]$/)[1].match(/'([^']+)'/g) || []).map(m => m.slice(1, -1));
    alleNamen.push(...namen);
    const mitUmlaut = namen.find(n => /[äöüÄÖÜß]/.test(n));
    if (!mitUmlaut) return;                       // Kette ohne Umlaut-Variante (z.B. 'Ausgaben')
    const erwartet = translit(mitUmlaut);
    assert.ok(namen.includes(erwartet),
        'Kette fuer "' + mitUmlaut + '" muss die ASCII-Variante "' + erwartet + '" enthalten, hat aber nur: ' + namen.join(', '));
});
pass++; console.log('✓ jede Blattnamen-Kette enthaelt die korrekte ASCII-Transliteration');

assert.ok(!alleNamen.includes('Verkauefe'), "'Verkauefe' (u/e vertauscht) darf nicht zurueckkehren");
assert.ok(alleNamen.includes('Verkaeufe'), "'Verkaeufe' muss als Blattname gesucht werden");
pass++; console.log('✓ der Tippfehler \'Verkauefe\' ist weg und \'Verkaeufe\' steht da');

// ---------------------------------------------------------------------------
// 2) Zahlen: deutsches Dezimalkomma inklusive Tausendertrenner; Unsinn wird gemeldet statt 0
// ---------------------------------------------------------------------------
const kopfE = X.SPALTEN.einkauf.map(s => s.titel);
const ek = v => X.einkaeufe([kopfE, ['2026-01-15', 'Nike', 'Schuhe', '42', 'Air Max', v, '1', 'Privat', '']], { heute: '2026-11-26' });
[['80,50', 80.5], ['80.50', 80.5], ['1.234,56', 1234.56], ['1.234.567,89', 1234567.89], ['1234,56', 1234.56], [12.5, 12.5]]
    .forEach(([ein, soll]) => {
        const e = ek(ein);
        assert.strictEqual(e.fehler.length, 0, 'EK ' + JSON.stringify(ein) + ': ' + JSON.stringify(e.fehler));
        assert.ok(Math.abs(e.zeilen[0].purchase.einkaufspreis - soll) < 0.0001, 'EK ' + JSON.stringify(ein) + ' = ' + e.zeilen[0].purchase.einkaufspreis);
    });
['-5', '/', ''].forEach(ein => assert.strictEqual(ek(ein).fehler.length, 1, 'EK ' + JSON.stringify(ein) + ' muss gemeldet werden'));
pass++; console.log('✓ Zahlen: "1.234,56" → 1234.56; negativ, Platzhalter und leer werden gemeldet statt still 0');

// ---------------------------------------------------------------------------
// 3) Abschlussmeldung: eine Null wird genannt, wenn die Quelle da war
// ---------------------------------------------------------------------------
const n = (e, v, a) => ({ einkauf: e, verkauf: v, ausgaben: a });
const teile = (...arten) => arten.map(art => ({ art }));
assert.strictEqual(X.meldung(n(29, 0, 0), teile('einkauf', 'verkauf'), false), '29 Einkäufe, 0 Verkäufe');
pass++; console.log('✓ "0 Verkäufe" wird gemeldet, wenn das Blatt da war');
assert.strictEqual(X.meldung(n(29, 0, 0), teile('einkauf'), false), '29 Einkäufe');
pass++; console.log('✓ ein fehlendes (oder abgelehntes) Blatt bleibt stumm');
assert.strictEqual(X.meldung(n(5, 5, 0), teile('flach'), true), '5 Einkäufe, 5 Verkäufe');
pass++; console.log('✓ Flach-Fallback meldet Einkaeufe und Verkaeufe, nie Ausgaben');
assert.strictEqual(X.meldung(n(0, 0, 0), [], false), '0 Datensätze');
pass++; console.log('✓ ohne jede Quelle bleibt es bei "0 Datensätze"');

// ---------------------------------------------------------------------------
// 3b) Kopfzeilen-Pruefung (Fund 3): passt die Spaltenfolge nicht, wird abgewiesen
// ---------------------------------------------------------------------------
['einkauf', 'verkauf', 'ausgaben'].forEach(art => {
    const r = X.pruefeKopfzeile([X.SPALTEN[art].map(sp => sp.titel)], art);
    assert.ok(r.ok, 'Die eigene Vorlage muss angenommen werden (' + art + ')');
    assert.strictEqual(r.treffer, r.gesamt, 'Vorlage ' + art + ': alle Spalten muessen sitzen');
});
pass++; console.log('✓ die mitgelieferte Vorlage wird angenommen (alle Spalten erkannt)');

const vinted = ['Belegnummer (E-###)', 'Datum', 'Plattform / Ort', 'Artikel / Beschreibung',
                'Farbe', 'Betrag (€)', 'Versand / Gebühren (€)', 'Zoll / EUSt (€)',
                'Gesamtkosten (€)', 'Zahlungsart (Bar / Bank / PayPal)', 'Dateiname vom Beleg', 'Notiz'];
assert.ok(!X.pruefeKopfzeile([vinted], 'einkauf').ok, 'Die gemessene Vinted-Kopfzeile muss abgewiesen werden');
pass++; console.log('✓ die gemessene Vinted-Kopfzeile wird abgewiesen');

const locker = ['datum', 'MARKE', 'Artikeltyp', 'Groesse', 'beschreibung', 'EK-Preis', 'Anzahl', 'Einkaufsquelle', 'Notizen', 'Meine eigene Spalte'];
assert.ok(X.pruefeKopfzeile([locker], 'einkauf').ok, 'Schreibweise und Zusatzspalte duerfen nicht abweisen');
pass++; console.log('✓ andere Schreibweise, fehlende Umlaute und Zusatzspalten gehen durch');

assert.ok(!X.pruefeKopfzeile([['Datum', 'x', 'y', 'z', 'a', 'b', 'c', 'd', 'e']], 'einkauf').ok);
pass++; console.log('✓ eine einzelne zufaellige Uebereinstimmung genuegt nicht');

// ---------------------------------------------------------------------------
// 4) Die Meldung darf nicht "leere Zeilen" behaupten
// ---------------------------------------------------------------------------
assert.ok(!/leere Zeilen übersprungen/.test(SRC), 'Die Meldung darf uebersprungene Zeilen nicht als "leere Zeilen" ausgeben');
assert.ok(/Zeilen nicht importiert/.test(SRC), 'Der Hinweis auf nicht importierte Zeilen fehlt');
pass++; console.log('✓ nicht importierte Zeilen werden nicht als "leer" behauptet');

console.log('\n' + pass + '/12 Tests bestanden ✅');
