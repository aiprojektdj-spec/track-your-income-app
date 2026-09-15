// Self-Test Fahrtenbuch:  node test/test-fahrtenbuch.js
//
// Fund C des Vollaudits (plan/01-AUFGABEN.md 1.8): Das Modul wurde von keinem Harness geladen.
// Es speist Zeile 50 der EUeR (Fahrtkosten) — die Wirkung DORT deckt test-euer-nebenmodule.js
// ab, die Modullogik selbst war offen.
//
// Geprueft werden die drei Stellen, an denen gerechnet und gefiltert wird:
//   A) calcKosten()   — Kilometerpauschale je Fahrzeugart, tatsaechliche Kosten
//   B) getWochentag() — Datumsauswertung, inklusive der Sommerzeit-Falle
//   C) _getFiltered() — Jahres-/Zweck-/Fahrzeugfilter und Sortierung
'use strict';
const fs = require('fs');
const path = require('path');

global.window = {};
const fbSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'fahrtenbuch.js'), 'utf8');
const FB = new Function(fbSrc + '; return Fahrtenbuch;')();

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); }
}
const nah = (a, b) => Math.abs(a - b) < 1e-9;

// ── A) Kilometerpauschale ────────────────────────────────────────────────────
(() => {
    check('A1 PKW rechnet mit 0,30 EUR/km', nah(FB.calcKosten(100, 'pauschale_pkw'), 30));
    check('A2 Motorrad rechnet mit 0,20 EUR/km', nah(FB.calcKosten(100, 'pauschale_motorrad'), 20));
    check('A3 Fahrrad/zu Fuss ergibt 0', nah(FB.calcKosten(100, 'fahrrad'), 0));

    // Tatsaechliche Kosten kommen aus dem Feld, die Kilometer sind dann irrelevant.
    check('A4 tatsaechliche Kosten ersetzen die Pauschale',
        nah(FB.calcKosten(100, 'tatsaechlich', 42.5), 42.5));
    check('A5 bei tatsaechlichen Kosten zaehlen die km nicht mit',
        nah(FB.calcKosten(0, 'tatsaechlich', 42.5), 42.5));

    // Rundung auf Cent: 33,3 km x 0,30 = 9,99 EUR
    check('A6 rundet auf Cent', nah(FB.calcKosten(33.3, 'pauschale_pkw'), 9.99));

    // STRIKT vergleichen, nicht mit Toleranz: 7 x 0,30 ergibt in JS 2.1000000000000005.
    // Ein Toleranzvergleich (und auch toFixed(2)) haelt das faelschlich fuer bestanden — genau
    // deshalb faellt eine entfernte Rundung sonst durch jeden Test. Der Wert landet ungerundet
    // in der EUeR und summiert sich ueber die Fahrten des Jahres.
    check('A7 keine Fliesskomma-Reste — exakt 2.1, nicht 2.1000000000000005',
        FB.calcKosten(7, 'pauschale_pkw') === 2.1);
    check('A8 auch bei Motorrad exakt gerundet — 7 x 0,20 = 1.4',
        FB.calcKosten(7, 'pauschale_motorrad') === 1.4);
    // Zwei Nachkommastellen sind die Obergrenze: 1,234 km ergibt 0,37 EUR, nicht 0,3702.
    check('A9 mehr als zwei Nachkommastellen entstehen nicht',
        FB.calcKosten(1.234, 'pauschale_pkw') === 0.37);

    // Eine unbekannte Berechnungsart darf keine Kosten erfinden.
    check('A10 unbekannte Berechnungsart ergibt 0', nah(FB.calcKosten(100, 'gibtsnicht'), 0));
    check('A11 fehlende Berechnungsart ergibt 0', nah(FB.calcKosten(100, undefined), 0));
    // rate === null ist die Kennung der tatsaechlichen Kosten — ohne Betrag bleibt es 0.
    check('A12 tatsaechlich ohne Betrag ergibt 0', nah(FB.calcKosten(100, 'tatsaechlich'), 0));
    check('A13 tatsaechlich mit Unsinn ergibt 0, nicht NaN',
        nah(FB.calcKosten(100, 'tatsaechlich', 'abc'), 0));

    check('A14 0 km ergibt 0 EUR', nah(FB.calcKosten(0, 'pauschale_pkw'), 0));

    // Dokumentierte Grenze, kein Fund: parseFloat schneidet am deutschen Komma ab. In der App
    // kommt das nicht vor, weil das Feld type="number" ist und der Browser auf Punktnotation
    // normalisiert (js/fahrtenbuch.js, fb_tatsKosten). Wer den Wert je aus einem Import oder
    // einem Textfeld speist, muss vorher selbst umwandeln.
    check('A15 Grenze: Komma-String wird abgeschnitten (Feld ist type=number)',
        nah(FB.calcKosten(100, 'tatsaechlich', '42,50'), 42));
    check('A16 Punkt-String wird korrekt gelesen',
        nah(FB.calcKosten(100, 'tatsaechlich', '42.50'), 42.5));
})();

// ── B) Wochentag ─────────────────────────────────────────────────────────────
(() => {
    check('B1 2026-09-15 ist ein Dienstag', FB.getWochentag('2026-09-15') === 'Dienstag');
    check('B2 Sonntag wird als Sonntag erkannt', FB.getWochentag('2026-09-13') === 'Sonntag');
    check('B3 leeres Datum ergibt leeren String', FB.getWochentag('') === '');
    check('B4 fehlendes Datum ergibt leeren String', FB.getWochentag(undefined) === '');

    // Der Zeitanteil T12:00:00 im Code ist kein Zufall: Mit T00:00:00 kippt das Datum in
    // Zeitzonen westlich von UTC auf den Vortag, und an Zeitumstellungstagen auch oestlich.
    // Beide Umstellungstage 2026 gegengeprueft — 29.03. (Sonntag) und 25.10. (Sonntag).
    check('B5 Sommerzeit-Beginn 2026-03-29 bleibt Sonntag', FB.getWochentag('2026-03-29') === 'Sonntag');
    check('B6 Sommerzeit-Ende 2026-10-25 bleibt Sonntag', FB.getWochentag('2026-10-25') === 'Sonntag');
    check('B7 Jahreswechsel 2026-01-01 ist ein Donnerstag', FB.getWochentag('2026-01-01') === 'Donnerstag');
    check('B8 Schalttag 2028-02-29 ist ein Dienstag', FB.getWochentag('2028-02-29') === 'Dienstag');

    check('B9 Quelltext-Wache: der Mittags-Zeitanteil steht noch drin',
        /new Date\(datum \+ 'T12:00:00'\)/.test(fbSrc));
})();

// ── C) Filter und Sortierung ─────────────────────────────────────────────────
(() => {
    const fahrten = [
        { id: '1', datum: '2026-03-10', zweck: 'meeting',        fahrzeug: 'PKW' },
        { id: '2', datum: '2026-07-22', zweck: 'materialeinkauf', fahrzeug: 'Motorrad' },
        { id: '3', datum: '2025-11-05', zweck: 'meeting',        fahrzeug: 'PKW' },
        { id: '4', datum: '2026-01-15', zweck: 'sonstiges' }        // ohne Fahrzeug
    ];
    const mit = (y, z, fz) => {
        const ctx = Object.create(FB);
        ctx._filterYear = y; ctx._filterZweck = z; ctx._filterFahrzeug = fz;
        return ctx._getFiltered(fahrten);
    };

    let r = mit('all', '', '');
    check('C1 ohne Filter bleiben alle Fahrten', r.length === 4);
    check('C2 sortiert absteigend nach Datum',
        r.map(x => x.id).join('') === '2143');

    check('C3 Jahresfilter greift', mit('2026', '', '').length === 3);
    check('C4 Zweckfilter greift', mit('all', 'meeting', '').length === 2);
    check('C5 Filter wirken zusammen, nicht alternativ', mit('2026', 'meeting', '').length === 1);

    // Fahrten ohne Fahrzeug gelten als PKW — sonst verschwaende der Filter Eintraege,
    // die vor der Einfuehrung des Feldes angelegt wurden.
    check('C6 Fahrt ohne Fahrzeug zaehlt als PKW', mit('all', '', 'PKW').length === 3);
    check('C7 Motorradfilter findet genau eine', mit('all', '', 'Motorrad').length === 1);

    // Das Original darf nicht umsortiert werden — _getFiltered kopiert bewusst.
    check('C8 die uebergebene Liste bleibt unveraendert', fahrten[0].id === '1');
})();

// ── D) Gesetzeswerte ─────────────────────────────────────────────────────────
(() => {
    const pkw = FB.BERECHNUNGSARTEN.find(a => a.id === 'pauschale_pkw');
    const krad = FB.BERECHNUNGSARTEN.find(a => a.id === 'pauschale_motorrad');
    check('D1 PKW-Satz ist 0,30 EUR/km', nah(pkw.rate, 0.30));
    check('D2 Motorrad-Satz ist 0,20 EUR/km', nah(krad.rate, 0.20));
    // Die Beschriftung nennt denselben Wert wie die Rechnung — sonst steht im Formular etwas
    // anderes, als hinterher gebucht wird.
    check('D3 Beschriftung und Rechensatz stimmen ueberein',
        pkw.label.indexOf('0,30') > -1 && krad.label.indexOf('0,20') > -1);

    // HINWEIS, kein Fehlschlag: Beide Saetze stehen als jahresfeste Konstanten da. Regel 7 der
    // CLAUDE.md verlangt fuer Gesetzeswerte eine Jahresfunktion (Muster: App._getUstGrenzen).
    // Aendert der Gesetzgeber den Satz, rechnet Stackr rueckwirkend auch alte Jahre neu.
    // Bewusst nicht hier gefixt — das ist eine Aenderung an steuerlicher Rechenlogik und
    // gehoert entschieden, nicht nebenbei gemacht.
    check('D4 Hinweis: Saetze sind jahresfest (Regel 7 offen, siehe 01-AUFGABEN 1.8)',
        /rate: 0\.30/.test(fbSrc) && !/rate\(year\)|_getKmSatz/.test(fbSrc));
})();

console.log('\n' + pass + '/' + total + ' Checks bestanden');
if (pass !== total) process.exit(1);
