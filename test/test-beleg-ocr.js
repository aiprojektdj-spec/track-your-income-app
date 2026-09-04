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

// Die Bestaetigung darf nicht in zusammengesetzten Woertern anschlagen. Ohne das \b
// traf /betrag/ auch "Rabattbetrag" — dann zieht eine Teilbetragszeile eine KORREKT
// gelesene Summenzeile herunter. Gemeldet aus einer Parallel-Session, hier reproduziert.
check('Rabattbetrag bestaetigt nicht',
    OCR.findBetrag(['Baumarkt', 'Schraube 5,90', 'Rabattbetrag 5,90', 'SUMME [2 EUR 85,90']).wert === 85.90,
    JSON.stringify(OCR.findBetrag(['Baumarkt', 'Schraube 5,90', 'Rabattbetrag 5,90', 'SUMME [2 EUR 85,90'])));

check('Nettobetrag bestaetigt nicht',
    OCR.findBetrag(['Baumarkt', 'Nettobetrag 5,90', 'Nettobetrag 5,90', 'SUMME 85,90']).wert === 85.90,
    JSON.stringify(OCR.findBetrag(['Baumarkt', 'Nettobetrag 5,90', 'Nettobetrag 5,90', 'SUMME 85,90'])));

// Der Fall, den ein blosses \b NICHT abfaengt: ein Bindestrich ist eine Wortgrenze,
// "MwSt-Betrag" kaeme also durch. Dafuer gibt es den Teilbetrags-Ausschluss.
check('MwSt-Betrag bestaetigt nicht (Bindestrich ist eine Wortgrenze)',
    OCR.findBetrag(['Baumarkt', 'MwSt-Betrag 5,90', 'MwSt-Betrag 5,90', 'SUMME 85,90']).wert === 85.90,
    JSON.stringify(OCR.findBetrag(['Baumarkt', 'MwSt-Betrag 5,90', 'MwSt-Betrag 5,90', 'SUMME 85,90'])));

// Gegenprobe zum Ausschluss: echte Endbetrags-Komposita muessen weiter bestaetigen,
// sonst haette der Fix die Regel bloss stillgelegt.
check('Gesamtbetrag bestaetigt weiterhin',
    OCR.findBetrag(['SUMME [2 EUR 785,90', 'Gesamtbetrag 85,90', 'Posten 85,90']).wert === 85.90,
    JSON.stringify(OCR.findBetrag(['SUMME [2 EUR 785,90', 'Gesamtbetrag 85,90', 'Posten 85,90'])));

check('Rechnungsbetrag bestaetigt weiterhin',
    OCR.findBetrag(['SUMME [2 EUR 785,90', 'Rechnungsbetrag 85,90', 'Posten 85,90']).wert === 85.90,
    JSON.stringify(OCR.findBetrag(['SUMME [2 EUR 785,90', 'Rechnungsbetrag 85,90', 'Posten 85,90'])));

// ── 2b) Zwischensumme, zwei Randfaelle ──────────────────────────────────────
// Die Hauptabdeckung des Zwischensummen-Ausschlusses steht weiter unten unter
// "Zwischensumme vs. Endbetrag" (Rabattbon, Gutschein, Subtotal, Endsumme). Hier
// stehen nur die zwei Faelle, die dort nicht vorkommen.
console.log('\nBetrag: Zwischensumme, Randfaelle');

check('Uebertrag zaehlt ebenfalls nicht als Summenzeile',
    OCR.findBetrag(['Uebertrag 100,00', 'GESAMT 85,90']).wert === 85.90,
    JSON.stringify(OCR.findBetrag(['Uebertrag 100,00', 'GESAMT 85,90'])));

// Der Ausschluss nimmt der Zwischensumme nur den VORRANG, er wirft sie nicht aus der
// Betrachtung: bleibt keine echte Summenzeile uebrig, greift wie bisher der Rueckfall.
check('ohne echte Summenzeile bleibt die Zwischensumme im Rueckfall',
    OCR.findBetrag(['Zwischensumme 40,00', 'Posten 12,00']).wert === 40.00,
    JSON.stringify(OCR.findBetrag(['Zwischensumme 40,00', 'Posten 12,00'])));

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

// ── 5) Zwischensumme schlaegt den Endbetrag nicht ───────────────────────────
// Gefunden am 2026-08-31 beim Gegenlesen der Konsens-Gegenprobe. Eine Zeile
// "Zwischensumme" traegt das Wort "summe" und landete damit im Summenpool; aus dem Pool
// gewinnt der groesste Betrag. Ohne Abzug faellt das nicht auf, weil Zwischensumme und
// Summe dann gleich gross sind — sobald ein Rabatt dazwischensteht, ist die Zwischensumme
// GROESSER und schlaegt die richtige Summe. Fehler nach oben, also zu hohe Betriebsausgabe
// und zu hohe Vorsteuer: dieselbe Klasse wie 785,90 statt 85,90.
console.log('\nZwischensumme vs. Endbetrag');

const rabattbon = OCR.extract([
    'Drogerie Mueller',
    'Shampoo             100,00',
    'Zwischensumme       100,00',
    'Rabatt              -14,10',
    'SUMME EUR            85,90',
    'Betrag EUR           85,90',
].join('\n'));
check('Rabattbon: SUMME gewinnt gegen die groessere Zwischensumme',
    rabattbon.betrag.wert === 85.90, JSON.stringify(rabattbon.betrag));

const gutschein = OCR.extract([
    'Getraenkemarkt',
    'Zwischensumme        52,40',
    'Gutschein           -10,00',
    'ZU ZAHLEN            42,40',
].join('\n'));
check('Gutschein: ZU ZAHLEN gewinnt gegen die Zwischensumme',
    gutschein.betrag.wert === 42.40, JSON.stringify(gutschein.betrag));

check('englische Schreibweise Subtotal ebenso',
    OCR.findBetrag(zeilen('Subtotal 52,40\nTOTAL 42,40')).wert === 42.40,
    JSON.stringify(OCR.findBetrag(zeilen('Subtotal 52,40\nTOTAL 42,40'))));

// Gegenprobe zur Ausschlussliste: sie darf nur treffen, was schon dem Namen nach ein
// Zwischenstand ist. "Endsumme" und "Gesamtsumme" sind Endbetraege und bleiben im Pool —
// und "Summe inkl. MwSt" ebenfalls. Deshalb steht "mwst" bewusst NICHT in
// RE_ZWISCHENSUMME, obwohl es in RE_TEILBETRAG steht: dort geht es um die Gegenprobe,
// hier um die Auswahl.
check('Endsumme bleibt eine Summenzeile',
    OCR.findBetrag(zeilen('Posten 9,99\nEndsumme 9,99')).wert === 9.99);

check('Gesamtsumme bleibt eine Summenzeile',
    OCR.findBetrag(zeilen('Posten 12,34\nGesamtsumme 12,34')).wert === 12.34);

check('"Summe inkl. MwSt" bleibt eine Summenzeile',
    OCR.findBetrag(zeilen('Wein 89,00\nSumme inkl. MwSt 19,90')).wert === 19.90,
    JSON.stringify(OCR.findBetrag(zeilen('Wein 89,00\nSumme inkl. MwSt 19,90'))));

// ── 6) Vorzeichen und Uhrzeit ───────────────────────────────────────────────
// Fund 2 und Fund 3 aus plan/funde-betragsregel-2026-08-30.md. Beide leben im
// Rueckfallpfad, beide irren nach oben. Fund 1 (umbrochene Summenzeile) ist
// bewusst NICHT gefixt und hat deshalb hier auch keinen Test — er braucht eine
// Regel, die raet, und die wartet auf mehr gemessene Bons.
console.log('\nVorzeichen und Uhrzeit');

// Aus einer Erstattung darf keine Ausgabe werden. Bleibt von der Summenzeile nur
// Negatives uebrig, ist kein Vorschlag die richtige Antwort — ein Vorzeichenfehler
// waere beim Klicken nicht zu bemerken.
const retoure = OCR.extract([
    'MediaMarkt',
    'Ruecknahme',
    'Artikel        -49,99',
    'SUMME          -49,99',
].join('\n'));
check('Retoure: negative Summe liefert keinen Vorschlag',
    retoure.betrag === null, JSON.stringify(retoure.betrag));

check('nachgestelltes Minus zaehlt ebenso',
    OCR.findBetrag(zeilen('Retoure\nSUMME 49,99-')) === null,
    JSON.stringify(OCR.findBetrag(zeilen('Retoure\nSUMME 49,99-'))));

// Der Rabatt ist der haeufige Fall desselben Musters: ohne Summenzeile gewann
// bisher der Abzug, weil er der groesste Betrag war.
check('Rabattzeile gewinnt den Rueckfall nicht mehr',
    OCR.findBetrag(zeilen('Kiosk\nPosten 9,99\nRabatt -14,10')).wert === 9.99,
    JSON.stringify(OCR.findBetrag(zeilen('Kiosk\nPosten 9,99\nRabatt -14,10'))));

// Gegenprobe: ein Trennstrich mit Leerzeichen ist kein Vorzeichen.
check('Bindestrich mit Leerzeichen macht keinen negativen Betrag',
    OCR.findBetrag(zeilen('Posten A - 12,50')).wert === 12.50,
    JSON.stringify(OCR.findBetrag(zeilen('Posten A - 12,50'))));

// Uhrzeit in Punktschreibweise: "07.45" ist formal ein Betrag und schlug im
// Rueckfall jeden Bon unter 24 Euro.
check('Uhrzeit mit Punkt zaehlt nicht als Betrag',
    OCR.findBetrag(zeilen('Datum 12.03.2026\nUhrzeit 07.45\nKaffee 2,40')).wert === 2.40,
    JSON.stringify(OCR.findBetrag(zeilen('Datum 12.03.2026\nUhrzeit 07.45\nKaffee 2,40'))));

// Gegenprobe: nur die Zeile, die eine Uhrzeit ankuendigt, wird so gelesen.
check('derselbe Zahlenwert ohne Zeitwort bleibt ein Betrag',
    OCR.findBetrag(zeilen('Kiosk Meier\nKaffee 7.45')).wert === 7.45,
    JSON.stringify(OCR.findBetrag(zeilen('Kiosk Meier\nKaffee 7.45'))));

check('unmoegliche Uhrzeit bleibt ein Betrag',
    OCR.findBetrag(zeilen('Zeit 99.99')).wert === 99.99,
    JSON.stringify(OCR.findBetrag(zeilen('Zeit 99.99'))));

// ── 7) ISO-Datum als Rueckfall ──────────────────────────────────────────────
// Seit der Kassensicherungsverordnung traegt jeder Bon einen Fiskalblock mit
// ISO-Zeitstempeln. Auf dem gemessenen Bauhaus-Bon war das neben der Fussleiste die
// einzige unversehrte Datumsangabe — die Datumszeile selbst kam als
// "Datuenı Aa 0 o607.2026" aus der Erkennung.
console.log('\nDatum: ISO als Rueckfall');

check('ISO wird gelesen, wenn keine Punktangabe da ist',
    OCR.findDatum('Belegdatum 2026-07-06\nSUMME 12,00').wert === '2026-07-06',
    JSON.stringify(OCR.findDatum('Belegdatum 2026-07-06\nSUMME 12,00')));

check('ISO im Fiskalblock rettet das Datum',
    OCR.findDatum('Signaturzaehler 7044299\n2026-07-06T09:36:22.000Z').wert === '2026-07-06',
    JSON.stringify(OCR.findDatum('Signaturzaehler 7044299\n2026-07-06T09:36:22.000Z')));

// Der Kern der Rueckfall-Bauart: die Punktangabe ist die lokale Zeit, der Fiskalstempel
// steht in UTC. Existiert eine Punktangabe, darf ISO sie NICHT unterbieten — sonst
// gewinnt bei einem Kauf kurz nach Mitternacht der Vortag.
check('ISO verdraengt eine vorhandene Punktangabe nicht',
    OCR.findDatum('Datum: 07.07.2026\n2026-07-06T22:30:00.000Z').wert === '2026-07-07',
    JSON.stringify(OCR.findDatum('Datum: 07.07.2026\n2026-07-06T22:30:00.000Z')));

check('unplausibles ISO-Jahr wird verworfen',
    OCR.findDatum('Kennung 1899-07-06') === null,
    JSON.stringify(OCR.findDatum('Kennung 1899-07-06')));

// Bewusst nicht unterstuetzt: in TT/MM/JJJJ ist nicht entscheidbar, ob Tag oder Monat
// vorn steht. Ein stillschweigend falsches Datum ist schlimmer als keins.
check('Schraegstrich bleibt unerkannt (Reihenfolge nicht entscheidbar)',
    OCR.findDatum('Kiosk\n06/07/2026') === null);

// ── 8) Haendlername mit Ziffer ──────────────────────────────────────────────
// "Cafe 1900" ist ein Name, keine Adresse. Bisher verwarf die Regel jede Zeile mit
// Ziffer und lieferte in solchen Faellen gar nichts.
console.log('\nHaendler: Name mit Ziffer');

check('Name mit Jahreszahl wird erkannt',
    OCR.findHaendler(['Cafe 1900', 'Hauptstr. 3']).wert === 'Cafe 1900',
    JSON.stringify(OCR.findHaendler(['Cafe 1900', 'Hauptstr. 3'])));

check('Name mit Filialnummer wird erkannt',
    OCR.findHaendler(['Shell 4711', '12345 Koeln']).wert === 'Shell 4711');

// Die drei Grenzen, die verhindern, dass stattdessen die Adresse gewinnt.
check('PLZ-Zeile gewinnt nicht (faengt mit Ziffer an)',
    OCR.findHaendler(['88212 Ravensburg', 'Baecker Wolf']).wert === 'Baecker Wolf',
    JSON.stringify(OCR.findHaendler(['88212 Ravensburg', 'Baecker Wolf'])));

check('Telefonzeile gewinnt nicht (mehrere Zifferngruppen)',
    OCR.findHaendler(['Kontakt Center: 0621 3905-1000', 'Baecker Wolf']).wert === 'Baecker Wolf',
    JSON.stringify(OCR.findHaendler(['Kontakt Center: 0621 3905-1000', 'Baecker Wolf'])));

check('EAN-Zeile gewinnt nicht (Ziffernfolge ab fuenf Stellen)',
    OCR.findHaendler(['Art/EAN 4024506316768', 'Baecker Wolf']).wert === 'Baecker Wolf',
    JSON.stringify(OCR.findHaendler(['Art/EAN 4024506316768', 'Baecker Wolf'])));

check('Kassenzeile gewinnt nicht (Floskelliste)',
    OCR.findHaendler(['Kasse 2', 'Baecker Wolf']).wert === 'Baecker Wolf',
    JSON.stringify(OCR.findHaendler(['Kasse 2', 'Baecker Wolf'])));

check('Betragszeile gewinnt nicht (zwei Zifferngruppen)',
    OCR.findHaendler(['SF OFENSCMERST 85,90 C', 'Baecker Wolf']).wert === 'Baecker Wolf',
    JSON.stringify(OCR.findHaendler(['SF OFENSCMERST 85,90 C', 'Baecker Wolf'])));

// ── 9) Zahlungszeilen gewinnen den Rueckfall nicht ──────────────────────────
// Fund 1 aus plan/funde-betragsregel-2026-08-30.md, der letzte der drei. Auf schmalen
// Thermobons bricht die Summenzeile um: "SUMME" steht allein, der Betrag eine Zeile
// tiefer. Dann bleibt ausSummenzeilen leer, es faellt auf "groesster Betrag" zurueck —
// und das hingelegte Bargeld ist fast immer groesser als die Summe.
//
// Geloest wird das NICHT, indem die Folgezeile geraten wird, sondern indem gesagt wird,
// was ohnehin nie der Rechnungsbetrag ist: gegebenes Bargeld und Rueckgeld.
console.log('\nZahlungszeilen im Rueckfall');

const barbonUmbruch = OCR.extract([
    '2 x Kaffee      7,98',
    'SUMME',
    '        12,47',
    'Geg. BAR  20,00',
    'Rueck      7,53',
].join('\n'));
check('umbrochene Summenzeile: Bargeld gewinnt nicht mehr',
    barbonUmbruch.betrag.wert === 12.47, JSON.stringify(barbonUmbruch.betrag));

check('Wechselgeld ebenso',
    OCR.findBetrag(zeilen('Kiosk\nBrot 3,50\nWechselgeld 16,50')).wert === 3.50,
    JSON.stringify(OCR.findBetrag(zeilen('Kiosk\nBrot 3,50\nWechselgeld 16,50'))));

check('Bargeld-Schreibweise ebenso',
    OCR.findBetrag(zeilen('Kiosk\nBrot 3,50\nBargeld 20,00')).wert === 3.50);

// Die Ausnahmen. Kartenbons tragen den richtigen Betrag ausgerechnet auf der
// Zahlungszeile — auf dem gemessenen Bauhaus-Bon als "Betrag EUR 85,90".
check('Kartenbon: "Betrag EUR" bleibt drin',
    OCR.findBetrag(zeilen('Bauhaus\nArtikel 85,90\nBetrag EUR 85,90')).wert === 85.90);

check('"EC-Cash" bleibt drin',
    OCR.findBetrag(zeilen('Markt\nEC-Cash EUR 42,00')).wert === 42.00);

// "bargeldlos" steht auf Kartenbons und ist das Gegenteil einer Barzahlung.
check('"bargeldlos" wird nicht als Barzahlung gelesen',
    OCR.findBetrag(zeilen('Tankstelle\nDiesel 89,50\nZahlung bargeldlos 89,50')).wert === 89.50,
    JSON.stringify(OCR.findBetrag(zeilen('Tankstelle\nDiesel 89,50\nZahlung bargeldlos 89,50'))));

// Steht der einzige Betrag des Bons auf einer Bar-Zeile, waere kein Vorschlag die
// schlechtere Antwort: anders als beim Vorzeichen droht hier kein Richtungsfehler.
check('einziger Betrag auf einer Bar-Zeile wird trotzdem vorgeschlagen',
    OCR.findBetrag(zeilen('Kiosk Meier\nBAR 12,47')).wert === 12.47,
    JSON.stringify(OCR.findBetrag(zeilen('Kiosk Meier\nBAR 12,47'))));

// Gegenproben gegen zu gierige Wortgrenzen.
check('"Rucksack" ist kein Rueckgeld',
    OCR.findBetrag(zeilen('Outdoor\nRucksack 49,99\nMuetze 9,99')).wert === 49.99);

check('"Rueckenlehne" ebenso',
    OCR.findBetrag(zeilen('Moebel\nRueckenlehne 199,00\nSchraube 2,00')).wert === 199.00);

check('ein Lokal namens "Bar" verliert seinen Posten nicht',
    OCR.findBetrag(zeilen('Cocktail Bar Nachtschwalbe\nLongdrink 12,50')).wert === 12.50,
    JSON.stringify(OCR.findBetrag(zeilen('Cocktail Bar Nachtschwalbe\nLongdrink 12,50'))));

check('erkannte Summenzeile behaelt Vorrang vor allem',
    OCR.findBetrag(zeilen('Kiosk\nSUMME 3,50\nGeg. BAR 20,00')).wert === 3.50);

console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen\n');
process.exit(fail ? 1 : 0);
