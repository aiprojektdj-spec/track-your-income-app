// Test: Extraktionsheuristik der Belegerkennung (Fund G4)
//
// Prueft js/beleg-ocr.js isoliert in einem vm-Kontext — ohne Browser und ohne WASM.
// Genau dafuer liegt die Heuristik in einer eigenen Datei: die OCR-Engine ist ~8 MB
// gross und nicht Gegenstand dieses Tests. Getestet werden die drei Regeln aus
// plan/ocr-belegerkennung-2026-08-12.md, Abschnitt 5, an echten Bon-Texten.
//
//   node test/test-beleg-ocr.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'beleg-ocr.js'), 'utf8'), sandbox);
const OCR = sandbox.BelegOCR;

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log('  OK   ' + name); }
    else      { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
}
const zeilen = t => t.split('\n');

// ── Fixtures: so sehen die Rohtexte aus, die tesseract.js liefert ───────────
// Uebernommen aus echten Bons, inklusive der typischen OCR-Eigenheiten:
// Rauschzeichen am Rand, zusammengezogene Spalten, uneinheitliche Grossschreibung.

const BON_REWE = [
    'REWE Markt GmbH',
    'Musterstrasse 5',
    '10115 Berlin',
    'Tel. 030 1234567',
    '',
    'Vollkornbrot          2,49 B',
    'H-Milch 3,5%          1,19 B',
    'Kaffee 500g           6,99 B',
    '------------------------------',
    'SUMME EUR            10,67',
    'Geg. BAR             20,00',
    'Rueckgeld             9,33',
    '',
    'MwSt 7,00 %   Netto 9,97  Ust 0,70',
    '',
    '12.03.2026 14:22 Bed. 004 Kasse 2',
    'Beleg-Nr. 4711',
].join('\n');

const BON_TANKSTELLE = [
    '*** KUNDENBELEG ***',
    'Aral Tankstelle',
    'Bahnhofstrasse 12',
    '',
    'Super E10   42,31 L   1,829 EUR/L',
    'Zwischensumme        77,38',
    'GESAMT               77,38',
    '',
    'Datum 04.01.26  Zeit 08:14',
].join('\n');

const BON_RESTAURANT = [
    'Trattoria Da Luigi',
    '',
    '2x Pizza Margherita      19,00',
    '1x Lasagne                12,50',
    '3x Mineralwasser           9,00',
    '',
    'ZU ZAHLEN                40,50',
    '',
    'Vielen Dank fuer Ihren Besuch',
    'Rechnungsdatum: 28.02.2026',
].join('\n');

const BON_ENGLISCH = [
    'Office Supplies Ltd',
    '',
    'Notebook stand        1,234.56',
    'TOTAL                 1,234.56',
    '17.11.2025',
].join('\n');

console.log('\nBelegerkennung: Extraktionsheuristik\n');

// ── 1) Datum ────────────────────────────────────────────────────────────────
console.log('Datum');

check('erkennt TT.MM.JJJJ', OCR.findDatum('Kaufdatum 12.03.2026').wert === '2026-03-12');

check('erkennt TT.MM.JJ als 20JJ', OCR.findDatum('Datum 04.01.26').wert === '2026-01-04',
    JSON.stringify(OCR.findDatum('Datum 04.01.26')));

// Der Kern der Regel: Bons tragen neben dem Kaufdatum ein spaeteres Druckdatum.
check('bei mehreren Daten gewinnt das frueheste',
    OCR.findDatum('Kauf 12.03.2026\nDruckdatum 15.03.2026').wert === '2026-03-12',
    JSON.stringify(OCR.findDatum('Kauf 12.03.2026\nDruckdatum 15.03.2026')));

check('frueheres Datum gewinnt auch ueber das Jahr hinweg',
    OCR.findDatum('Druck 02.01.2026\nLeistung 28.12.2025').wert === '2025-12-28');

check('unmoegliches Datum wird verworfen (31.02.)',
    OCR.findDatum('31.02.2026 und 05.04.2026').wert === '2026-04-05',
    JSON.stringify(OCR.findDatum('31.02.2026 und 05.04.2026')));

check('Monat 13 wird verworfen', OCR.findDatum('12.13.2026') === null);

check('ohne Datum kommt null', OCR.findDatum('SUMME EUR 10,67') === null);

// Ein Geldbetrag mit Tausenderpunkten darf nicht als Datum durchgehen.
check('1.234.567 ist kein Datum', OCR.findDatum('Betrag 1.234.567 Stueck') === null,
    JSON.stringify(OCR.findDatum('Betrag 1.234.567 Stueck')));

check('roher Treffer bleibt erhalten', OCR.findDatum('am 4.1.26 gekauft').roh === '4.1.26');

// ── 2) Betrag ───────────────────────────────────────────────────────────────
console.log('\nBetrag');

check('SUMME-Zeile schlaegt groesseren Betrag daneben',
    OCR.findBetrag(zeilen(BON_REWE)).wert === 10.67,
    JSON.stringify(OCR.findBetrag(zeilen(BON_REWE))));

check('GESAMT wird erkannt', OCR.findBetrag(zeilen(BON_TANKSTELLE)).wert === 77.38,
    JSON.stringify(OCR.findBetrag(zeilen(BON_TANKSTELLE))));

check('ZU ZAHLEN wird erkannt (Schluesselwort mit Leerzeichen)',
    OCR.findBetrag(zeilen(BON_RESTAURANT)).wert === 40.50,
    JSON.stringify(OCR.findBetrag(zeilen(BON_RESTAURANT))));

check('TOTAL wird erkannt', OCR.findBetrag(zeilen(BON_ENGLISCH)).wert === 1234.56,
    JSON.stringify(OCR.findBetrag(zeilen(BON_ENGLISCH))));

check('ohne Schluesselwort gewinnt der groesste Betrag',
    OCR.findBetrag(['Brot 2,49', 'Kaffee 6,99', 'Milch 1,19']).wert === 6.99);

check('deutscher Tausenderpunkt wird gelesen',
    OCR.findBetrag(['SUMME 1.234,56']).wert === 1234.56,
    JSON.stringify(OCR.findBetrag(['SUMME 1.234,56'])));

check('Punkt als Dezimaltrenner wird gelesen',
    OCR.findBetrag(['SUMME 89.90']).wert === 89.90);

// Ohne diese Regel schlaegt der MwSt-Satz jeden Bon unter 19 EUR.
check('MwSt-Satz mit Prozentzeichen zaehlt nicht als Betrag',
    OCR.findBetrag(['Brot 2,49', 'MwSt 19,00 % Ust 0,40']).wert === 2.49,
    JSON.stringify(OCR.findBetrag(['Brot 2,49', 'MwSt 19,00 % Ust 0,40'])));

// Dasselbe Muster wie beim MwSt-Satz, nur haeufiger: ein Datum steht auf JEDEM Bon,
// und "27.08.2026" enthaelt "27.08" — formal ein Betrag. Ohne die Regel verliert jeder
// Endbetrag unter 31,12 gegen den Tag-Monat-Kopf des Datums, sobald die Summenzeile
// nicht erkannt wurde.
check('Datum zaehlt nicht als Betrag',
    OCR.findBetrag(['Kiosk Meier', '27.08.2026  14:33', 'Kaffee 2,50', 'EUR 3,99']).wert === 3.99,
    JSON.stringify(OCR.findBetrag(['Kiosk Meier', '27.08.2026  14:33', 'Kaffee 2,50', 'EUR 3,99'])));

check('reine Datumszeile liefert keinen Betrag',
    OCR.findBetrag(['Datum: 27.08.2026']) === null,
    JSON.stringify(OCR.findBetrag(['Datum: 27.08.2026'])));

check('zweistelliges Jahr leckt ebenfalls nicht durch',
    OCR.findBetrag(['12.05.26', 'Bar 4,20']).wert === 4.20,
    JSON.stringify(OCR.findBetrag(['12.05.26', 'Bar 4,20'])));

// Gegenprobe zur Datumsregel: der Punkt am Satzende darf den Betrag nicht kosten.
check('Betrag am Satzende bleibt erhalten',
    OCR.findBetrag(['Summe betraegt 3,99.']).wert === 3.99,
    JSON.stringify(OCR.findBetrag(['Summe betraegt 3,99.'])));

check('Betrag ohne Nachkommastellen wird ignoriert',
    OCR.findBetrag(['Menge 3 Stueck', 'Kasse 2']) === null);

check('ohne jeden Betrag kommt null', OCR.findBetrag(['REWE Markt GmbH']) === null);

check('roher Treffer bleibt erhalten', OCR.findBetrag(['SUMME 1.234,56']).roh === '1.234,56');

// ── 2a) Konsens-Gegenprobe ──────────────────────────────────────────────────
// Spezifikation Abschnitt 5a. Anlass ist gemessen, nicht ausgedacht: am 2026-08-30
// las die Erkennung an einem echten Bauhaus-Bon "SUMME [2]  EUR  85,90" als
// "SUMME [2 EUR 785,90" — die schliessende Klammer wurde zur 7 und klebte am Betrag.
console.log('\nBetrag: Konsens-Gegenprobe');

// Der gemessene Fall, auf das Wesentliche gekuerzt.
const BON_BAUHAUS_VERSTUEMMELT = [
    'Bauhaus GmbH & Co, KG Schwaben',
    'SF OFENSCMERST 85,90 C',
    'SUMME [2 EUR 785,90 |',      // <- die verunglueckte Zeile
    'Betrag EUR 85,90 |',          // <- Bestaetigungswort "Betrag"
    'C 19% 72,18€ 13,72€ 85,90€ 1',
];

check('angeklebte Ziffer wird gegen den dreifachen Konsens verworfen',
    OCR.findBetrag(BON_BAUHAUS_VERSTUEMMELT).wert === 85.90,
    JSON.stringify(OCR.findBetrag(BON_BAUHAUS_VERSTUEMMELT)));

check('die Korrektur wird nicht verschwiegen',
    OCR.findBetrag(BON_BAUHAUS_VERSTUEMMELT).korrigiertVon === '785,90',
    JSON.stringify(OCR.findBetrag(BON_BAUHAUS_VERSTUEMMELT)));

// Der gefaehrlichste Fall der ganzen Regel, und der Grund fuer Bedingung 4:
// zwei Posten zu 5,90 und eine Summe von 85,90, die nur einmal dasteht. Ohne das
// verlangte Bestaetigungswort wuerde hier nach UNTEN korrigiert — aus einem
// Erkennungsfehler wuerde ein Rechenfehler.
check('ohne Bestaetigungswort wird NICHT nach unten korrigiert',
    OCR.findBetrag(['Kiosk Meier', 'Cola 5,90', 'Wasser 5,90', 'SUMME 85,90']).wert === 85.90,
    JSON.stringify(OCR.findBetrag(['Kiosk Meier', 'Cola 5,90', 'Wasser 5,90', 'SUMME 85,90'])));

check('unkorrigierter Treffer traegt kein korrigiertVon',
    OCR.findBetrag(['SUMME 85,90']).korrigiertVon === undefined,
    JSON.stringify(OCR.findBetrag(['SUMME 85,90'])));

// Bedingung 1: kommt der Gewinner selbst mehrfach vor, ist er kein Ausrutscher.
check('mehrfach vorkommender Gewinner bleibt stehen',
    OCR.findBetrag(['SUMME 785,90', 'Betrag EUR 785,90', 'Posten 85,90', 'BRUTTO 85,90']).wert === 785.90,
    JSON.stringify(OCR.findBetrag(['SUMME 785,90', 'Betrag EUR 785,90', 'Posten 85,90', 'BRUTTO 85,90'])));

// Bedingung 3: genau eine Ziffer. Zwei weggefallene Zeichen waeren geraten.
check('zwei angeklebte Ziffern greifen nicht',
    OCR.findBetrag(['SUMME 1785,90', 'Betrag EUR 85,90', 'BRUTTO 85,90']).wert === 1785.90,
    JSON.stringify(OCR.findBetrag(['SUMME 1785,90', 'Betrag EUR 85,90', 'BRUTTO 85,90'])));

// Der Vergleich laeuft auf der Ziffernform, also ohne Tausendertrenner.
check('Tausendertrenner stoert den Vergleich nicht',
    OCR.findBetrag(['SUMME 1.785,90', 'Betrag EUR 785,90', 'BRUTTO 785,90']).wert === 785.90,
    JSON.stringify(OCR.findBetrag(['SUMME 1.785,90', 'Betrag EUR 785,90', 'BRUTTO 785,90'])));

// "Gegeben" darf kein Bestaetigungswort sein — sonst hoebe die Gegenprobe die
// Summenregel von hinten wieder auf, die genau diesen Fall abfaengt.
check('Gegeben-Zeile bestaetigt nicht',
    OCR.findBetrag(['SUMME 85,90', 'Geg. BAR 5,90', 'Rueckgeld 5,90']).wert === 85.90,
    JSON.stringify(OCR.findBetrag(['SUMME 85,90', 'Geg. BAR 5,90', 'Rueckgeld 5,90'])));

// ── 3) Haendler ─────────────────────────────────────────────────────────────
console.log('\nHaendler');

check('erste Namenszeile gewinnt',
    OCR.findHaendler(zeilen(BON_REWE)).wert === 'REWE Markt GmbH',
    JSON.stringify(OCR.findHaendler(zeilen(BON_REWE))));

check('Rauschzeile *** KUNDENBELEG *** wird uebersprungen',
    OCR.findHaendler(zeilen(BON_TANKSTELLE)).wert === 'Aral Tankstelle',
    JSON.stringify(OCR.findHaendler(zeilen(BON_TANKSTELLE))));

check('Zeile mit Ziffer wird uebersprungen',
    OCR.findHaendler(['10115 Berlin', 'Baecker Schmidt']).wert === 'Baecker Schmidt');

check('Strassenzeile wird uebersprungen',
    OCR.findHaendler(['Musterstrasse', 'Baecker Schmidt']).wert === 'Baecker Schmidt',
    JSON.stringify(OCR.findHaendler(['Musterstrasse', 'Baecker Schmidt'])));

check('Zeile mit weniger als drei Buchstaben wird uebersprungen',
    OCR.findHaendler(['AG', '- -', 'Baecker Schmidt']).wert === 'Baecker Schmidt',
    JSON.stringify(OCR.findHaendler(['AG', '- -', 'Baecker Schmidt'])));

check('Umlaute zaehlen als Buchstaben',
    OCR.findHaendler(['Bäckerei Müller']).wert === 'Bäckerei Müller');

check('Punkt im Firmennamen bleibt erhalten',
    OCR.findHaendler(['Muster GmbH & Co. KG']).wert === 'Muster GmbH & Co. KG',
    JSON.stringify(OCR.findHaendler(['Muster GmbH & Co. KG'])));

check('ohne brauchbare Zeile kommt null',
    OCR.findHaendler(['10115 Berlin', 'Tel. 030 1234567']) === null,
    JSON.stringify(OCR.findHaendler(['10115 Berlin', 'Tel. 030 1234567'])));

// ── 4) extract() als Ganzes ─────────────────────────────────────────────────
console.log('\nextract() end-to-end');

const r = OCR.extract(BON_REWE);
check('REWE-Bon: alle drei Felder',
    r.datum.wert === '2026-03-12' && r.betrag.wert === 10.67 && r.haendler.wert === 'REWE Markt GmbH',
    JSON.stringify(r));

const r2 = OCR.extract(BON_RESTAURANT);
check('Restaurant-Bon: alle drei Felder',
    r2.datum.wert === '2026-02-28' && r2.betrag.wert === 40.50 && r2.haendler.wert === 'Trattoria Da Luigi',
    JSON.stringify(r2));

// Kein Pflichtpfad: unbrauchbarer Text darf nicht werfen, sondern liefert nichts.
const leer = OCR.extract('');
check('leerer Text liefert drei null, ohne zu werfen',
    leer.datum === null && leer.betrag === null && leer.haendler === null);

const kein = OCR.extract('   \n\n  ');
check('nur Leerraum liefert drei null',
    kein.datum === null && kein.betrag === null && kein.haendler === null);

const nichtString = OCR.extract(null);
check('null als Eingabe wirft nicht',
    nichtString.datum === null && nichtString.betrag === null && nichtString.haendler === null);

const rausch = OCR.extract('#@!$%^&*()\n||||\n~~~~');
check('reines OCR-Rauschen liefert drei null',
    rausch.datum === null && rausch.betrag === null && rausch.haendler === null,
    JSON.stringify(rausch));

// Teiltreffer sind der Normalfall: ein unleserlicher Bonkopf darf Datum und
// Betrag nicht mitreissen.
const teil = OCR.extract('####\n12.03.2026\nSUMME 9,99');
check('Teiltreffer: Datum und Betrag ohne Haendler',
    teil.datum.wert === '2026-03-12' && teil.betrag.wert === 9.99 && teil.haendler === null,
    JSON.stringify(teil));

console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen\n');
process.exit(fail ? 1 : 0);
