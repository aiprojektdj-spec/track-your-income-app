// Regressionstest: XRechnung-Regelpruefung ohne neue Abhaengigkeit (2026-09-05)
//
// Der offizielle KoSIT-Validator ist eine Java-Anwendung mit dem vollstaendigen
// Schematron-Regelsatz. Er kaeme als neue Abhaengigkeit ins Repo, das heute genau eine
// produktive hat (Arbeitsregel 6), und laesst sich auf statischem Hosting ohnehin nicht
// ausliefern. Geprueft wird deshalb eine TEILMENGE in reinem JS:
//
//  A) BR-DE-15 — BT-10 (Kaeuferreferenz) hat in der XRechnung die Kardinalitaet 1..1 und ist in
//     JEDER XRechnung Pflicht, nicht nur bei Rechnungen an Behoerden. Der Generator gab
//     BuyerReference bisher nur aus, wenn das Feld gefuellt war, und nannte es im Kommentar
//     "optional" — die erzeugte Datei war damit regelmaessig eine, die der Empfaenger ablehnt.
//  B) BR-CO-10 / BR-CO-15 — die arithmetischen Konsistenzregeln.
//  C) BR-E-10 und Geschwister — jede Kategorie ohne USt braucht einen Befreiungsgrund. Bei §25a
//     ginge sonst genau die Pflichtangabe nach §14a Abs. 6 UStG verloren.
//
// Was der Test NICHT behauptet: dass eine hier gruene Rechnung KoSIT-konform ist.
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'rechnungen', 'js', 'xrechnung.js'), 'utf8');
const XRechnung = new Function(src + '\nreturn XRechnung;')();

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); }
}

const SETTINGS = {
    firmenname: 'Test GmbH', adresse: 'Weg 1, 10115 Berlin', strasse: 'Weg 1', plz: '10115',
    ort: 'Berlin', land: 'DE', ustId: 'DE123456789', ustIdNr: 'DE123456789',
    iban: 'DE02120300000000202051', email: 'a@b.de', ustMode: 'regel'
};
const KUNDE = { firma: 'Kunde GmbH', name: 'Kunde GmbH', strasse: 'Str 2', plz: '20095', ort: 'Hamburg', land: 'DE' };
const POS = [{ beschreibung: 'Ware', menge: 2, einheit: 'Stück', einzelpreis: 50, mwstSatz: 19 }];

function inv(extra) {
    return Object.assign({
        id: 'r1', nummer: 'RE-001', datum: '2026-09-05', kundeId: 'k1', positionen: POS
    }, extra || {});
}
const enthaelt = (arr, teil) => arr.some(s => s.indexOf(teil) !== -1);

// ── A) BR-DE-15: BT-10 ist Pflicht ───────────────────────────────────────────
const ohneRef = XRechnung.validatePflichtfelder(inv(), SETTINGS, KUNDE);
check('A1 fehlende Kaeuferreferenz wird als Pflichtfeld gemeldet',
      enthaelt(ohneRef, 'BT-10'));
check('A2 die Meldung nennt die Regelnummer BR-DE-15',
      enthaelt(ohneRef, 'BR-DE-15'));

const mitRef = XRechnung.validatePflichtfelder(inv({ leitwegId: 'KDN-4711' }), SETTINGS, KUNDE);
check('A3 mit Kaeuferreferenz ist BT-10 nicht mehr offen',
      !enthaelt(mitRef, 'BT-10'));
check('A4 eine sonst vollstaendige Rechnung hat dann gar keine Pflichtluecke mehr',
      mitRef.length === 0);

// Eine eigene Referenz (B2B) muss genauso zaehlen wie eine echte Leitweg-ID (B2G).
check('A5 eigene Referenz reicht, nicht nur das Leitweg-Format',
      XRechnung.validatePflichtfelder(inv({ leitwegId: 'Auftrag 2026-08' }), SETTINGS, KUNDE).length === 0);

// Und sie muss auch wirklich in der XML landen.
const xmlMitRef = XRechnung.generate(inv({ leitwegId: 'KDN-4711' }), SETTINGS, KUNDE);
check('A6 die Referenz steht als BuyerReference in der XML',
      xmlMitRef.indexOf('<ram:BuyerReference>KDN-4711</ram:BuyerReference>') !== -1);

// ── B) Eine sauber erzeugte Rechnung darf keine Regelverstoesse zeigen ───────
check('B1 erzeugte Regel-Rechnung ist verstossfrei',
      XRechnung.pruefeRegeln(xmlMitRef).length === 0);

const xml25a = XRechnung.generate(inv({
    leitwegId: 'KDN-1',
    positionen: [{ beschreibung: 'Vase', menge: 1, einheit: 'Stück', einzelpreis: 100,
                   mwstSatz: null, differenzbesteuert: true, warenart: 'kunst' }]
}), SETTINGS, KUNDE);
check('B2 auch die §25a-Rechnung ist verstossfrei',
      XRechnung.pruefeRegeln(xml25a).length === 0);

// ── C) Die Pruefung muss echte Verstoesse auch finden ───────────────────────
// Sonst ist sie ein gruenes Licht ohne Aussage. Handgebaute XML-Schnipsel.
const kaputtCO15 = `
  <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    <ram:TaxBasisTotalAmount>100.00</ram:TaxBasisTotalAmount>
    <ram:TaxTotalAmount currencyID="EUR">19.00</ram:TaxTotalAmount>
    <ram:GrandTotalAmount>200.00</ram:GrandTotalAmount>
  </ram:SpecifiedTradeSettlementHeaderMonetarySummation>`;
check('C1 BR-CO-15 wird erkannt (100 + 19 ist nicht 200)',
      enthaelt(XRechnung.pruefeRegeln(kaputtCO15), 'BR-CO-15'));

const kaputtCO10 = `
  <ram:LineTotalAmount>30.00</ram:LineTotalAmount>
  <ram:LineTotalAmount>30.00</ram:LineTotalAmount>
  <ram:LineTotalAmount>99.00</ram:LineTotalAmount>`;
check('C2 BR-CO-10 wird erkannt (30 + 30 ist nicht 99)',
      enthaelt(XRechnung.pruefeRegeln(kaputtCO10), 'BR-CO-10'));

const ohneGrund = `
  <ram:ApplicableTradeTax>
    <ram:CalculatedAmount>0.00</ram:CalculatedAmount>
    <ram:BasisAmount>100.00</ram:BasisAmount>
    <ram:CategoryCode>E</ram:CategoryCode>
    <ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>
  </ram:ApplicableTradeTax>`;
check('C3 BR-E-10 wird erkannt (Kategorie E ohne Befreiungsgrund)',
      enthaelt(XRechnung.pruefeRegeln(ohneGrund), 'BR-E-10'));

const kOhneGrund = ohneGrund.replace('>E<', '>K<');
check('C4 dieselbe Luecke bei Kategorie K heisst BR-K-10',
      enthaelt(XRechnung.pruefeRegeln(kOhneGrund), 'BR-K-10'));

// Der Regelsatz darf NICHT bei der Regelbesteuerung anschlagen — dort ist kein Grund noetig.
const sMitSatz = `
  <ram:ApplicableTradeTax>
    <ram:BasisAmount>100.00</ram:BasisAmount>
    <ram:CategoryCode>S</ram:CategoryCode>
    <ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>
  </ram:ApplicableTradeTax>`;
check('C5 Kategorie S mit 19 % loest keinen Fehlalarm aus',
      XRechnung.pruefeRegeln(sMitSatz).length === 0);

// ── D) Quelltext: die Grenze muss benannt bleiben ───────────────────────────
check('D1 der Export sagt weiterhin, dass er KoSIT nicht ersetzt',
      /ersetzt KEINE|ersetzt keine/i.test(src) && /KoSIT/.test(src));
check('D2 pruefeRegeln ist oeffentlich und damit testbar',
      typeof XRechnung.pruefeRegeln === 'function');

console.log('\n' + pass + '/' + total + ' Checks bestanden');
process.exit(pass === total ? 0 : 1);
