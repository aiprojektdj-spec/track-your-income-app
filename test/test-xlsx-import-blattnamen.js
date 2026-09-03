// Regressionstest fuer den Buchungen-Import in js/app.js:  node test/test-xlsx-import-blattnamen.js
//
// Hintergrund: Live-Test 1 (plan/live-tests-checkliste.md) hat an einer echten Datei gemessen,
// dass der Import still nur die Haelfte uebernimmt. Drei Defekte, die alle nach aussen wie ein
// gelungener Import aussahen:
//   1. Der ASCII-Blattname stand als 'Verkauefe' statt 'Verkaeufe' (u und e vertauscht).
//   2. Der Abschluss-Toast filterte Nullwerte heraus, statt "0 Verkaeufe" zu melden.
//   3. parseNum ersetzte per String-Argument nur das erste Komma ("1.234,56" -> 1.234).
//
// Die Import-Logik haengt inline in einem DOM-Handler und laesst sich nicht importieren.
// Der Test schneidet die Stellen deshalb im Wortlaut aus der Quelldatei — er prueft echten
// ausgelieferten Code, nicht eine abgetippte Kopie.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
let pass = 0;

// ---------------------------------------------------------------------------
// 1) Blattnamen: jeder ASCII-Name muss die korrekte Transliteration des Umlaut-Namens sein
// ---------------------------------------------------------------------------
// Die Regel ist mechanisch (ae/oe/ue), deshalb wird sie hier gerechnet statt aufgezaehlt —
// ein neuer Blattname erbt die Pruefung damit automatisch.
const translit = s => s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
                       .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss');

const ketten = SRC.match(/const ws[EVA] = wb\.Sheets\[[^;]+;/g) || [];
assert.strictEqual(ketten.length, 3, 'Es sollten genau drei Blattnamen-Ketten sein, gefunden: ' + ketten.length);

ketten.forEach(kette => {
    const namen = (kette.match(/wb\.Sheets\['([^']+)'\]/g) || [])
        .map(m => m.match(/\['([^']+)'\]/)[1]);
    const mitUmlaut = namen.find(n => /[äöüÄÖÜß]/.test(n));
    if (!mitUmlaut) return;                       // Kette ohne Umlaut-Variante (z.B. 'Ausgaben')
    const erwartet = translit(mitUmlaut);
    assert.ok(namen.includes(erwartet),
        'Kette fuer "' + mitUmlaut + '" muss die ASCII-Variante "' + erwartet + '" enthalten, ' +
        'hat aber nur: ' + namen.join(', '));
});
pass++; console.log('✓ jede Blattnamen-Kette enthaelt die korrekte ASCII-Transliteration');

// Der konkrete Tippfehler von damals, namentlich festgenagelt.
// Gezielt auf den Blattzugriff, nicht auf den blossen Namen: der Kommentar an der Fundstelle
// zitiert den falschen Namen, und daran darf der Test sich nicht aufhaengen (ist er beim
// ersten Lauf prompt).
assert.ok(!/wb\.Sheets\['Verkauefe'\]/.test(SRC), "'Verkauefe' (u/e vertauscht) darf nicht zurueckkehren");
assert.ok(/wb\.Sheets\['Verkaeufe'\]/.test(SRC), "'Verkaeufe' muss als Blattname gesucht werden");
pass++; console.log('✓ der Tippfehler \'Verkauefe\' ist weg und \'Verkaeufe\' steht da');

// ---------------------------------------------------------------------------
// 2) parseNum: deutsches Dezimalkomma inklusive Tausendertrenner
// ---------------------------------------------------------------------------
const mParse = SRC.match(/const parseNum = v => \{[\s\S]*?\n {20}\};/);
assert.ok(mParse, 'parseNum nicht in js/app.js gefunden');
const parseNum = eval('(' + mParse[0].replace(/^\s*const parseNum = /, '').replace(/;$/, '') + ')');

const faelle = [
    ['80,50',      80.5,    'deutsches Komma'],
    ['80.50',      80.5,    'englischer Punkt bleibt Dezimalzeichen'],
    ['1.234,56',   1234.56, 'Punkt als Tausendertrenner (war Faktor 1000 daneben)'],
    ['1.234.567,89', 1234567.89, 'zwei Tausendertrenner'],
    ['1234,56',    1234.56, 'ohne Trenner'],
    [12.5,         12.5,    'echte Zahl aus einer numerischen Zelle'],
    ['-5',         0,       'negativ wird auf 0 geklemmt'],
    ['/',          0,       'Platzhalter statt Zahl'],
    ['',           0,       'leer'],
    [null,         0,       'null'],
];
faelle.forEach(([ein, soll, was]) => {
    const ist = parseNum(ein);
    assert.ok(Math.abs(ist - soll) < 0.0001,
        'parseNum(' + JSON.stringify(ein) + ') = ' + ist + ', erwartet ' + soll + ' (' + was + ')');
});
pass++; console.log('✓ parseNum: ' + faelle.length + ' Faelle, inkl. Tausendertrenner "1.234,56" → 1234.56');

// ---------------------------------------------------------------------------
// 3) Abschlussmeldung: eine Null wird genannt, wenn die Quelle da war
// ---------------------------------------------------------------------------
const mMsg = SRC.match(/const msg = \[[\s\S]*?\.filter\(Boolean\)\.join\(', '\) \|\| '0 Datensätze';/);
assert.ok(mMsg, 'Aufbau der Abschlussmeldung nicht gefunden');

// Die Zaehler heissen im Original importedEinkauf/-Verkauf/-Ausgaben; hier mit Testwerten belegt.
const baueMsg = (importedEinkauf, importedVerkauf, importedAusgaben, wsE, wsV, wsA, flachGenutzt) =>
    eval(mMsg[0].replace(/^const msg = /, '(').replace(/;$/, ')'));

// Der gemessene Fall: Blatt Verkaeufe vorhanden, aber nichts uebernommen
assert.strictEqual(baueMsg(29, 0, 0, {}, {}, null, false), '29 Einkäufe, 0 Verkäufe',
    'eine Null muss genannt werden, wenn das Blatt da war');
pass++; console.log('✓ "0 Verkäufe" wird gemeldet, wenn das Blatt da war (war vorher unsichtbar)');

// Fehlendes Blatt bleibt stumm — laut Anleitung darf man einzelne Blaetter weglassen
assert.strictEqual(baueMsg(29, 0, 0, {}, null, null, false), '29 Einkäufe',
    'ein fehlendes Blatt darf nicht als "0" auftauchen');
pass++; console.log('✓ ein fehlendes Blatt bleibt stumm (kein Rauschen)');

// Flach-Fallback: keines der drei Blaetter existiert, trotzdem muss gezaehlt gemeldet werden
assert.strictEqual(baueMsg(5, 5, 0, null, null, null, true), '5 Einkäufe, 5 Verkäufe',
    'der Flach-Fallback fuellt dieselben Zaehler und darf nicht auf "0 Datensätze" fallen');
pass++; console.log('✓ Flach-Fallback meldet weiterhin seine Zeilen');

// Gar nichts gefunden
assert.strictEqual(baueMsg(0, 0, 0, null, null, null, false), '0 Datensätze', 'Leerfall');
pass++; console.log('✓ ohne jede Quelle bleibt es bei "0 Datensätze"');

// ---------------------------------------------------------------------------
// 4) Die Klammer darf nicht mehr "leere Zeilen" behaupten
// ---------------------------------------------------------------------------
// Uebersprungen wird, wenn zwei Pruefspalten leer sind — die Zeile selbst kann voll sein.
// An der Messdatei waren 160 der 972 "leeren" Zeilen echte Einkaeufe.
assert.ok(!/leere Zeilen übersprungen/.test(SRC),
    'Die Meldung darf uebersprungene Zeilen nicht als "leere Zeilen" ausgeben');
assert.ok(/\$\{skipped\} Zeilen übersprungen/.test(SRC), 'Der Hinweis auf uebersprungene Zeilen fehlt');
pass++; console.log('✓ uebersprungene Zeilen werden nicht mehr als "leer" behauptet');

console.log('\n' + pass + '/8 Tests bestanden ✅');
