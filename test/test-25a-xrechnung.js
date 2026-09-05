// Regressionstest: §25a Differenzbesteuerung in der XRechnung (2026-09-05)
//
//  A) Eine differenzbesteuerte Position darf in der XML NICHT als "Steuerfreier Umsatz"
//     erscheinen. Sie ist steuerpflichtig, nur eben auf die Marge (§25a Abs. 5 Satz 1 UStG).
//     Kategorie E ist die uebliche EN-16931-Zuordnung, der ExemptionReason muss aber der
//     Pflichttext nach §14a Abs. 6 UStG sein — im PDF stand er laengst, der XML fehlte er ganz.
//  B) Je Warenart der gesetzlich vorgeschriebene Wortlaut, unbekannte Warenart faellt auf
//     "Gebrauchtgegenstaende" zurueck.
//  C) §25a schlaegt die ig. Lieferung: §25a Abs. 5 Satz 2 UStG nimmt die Steuerbefreiung fuer
//     innergemeinschaftliche Lieferungen AUSDRUECKLICH von den fortgeltenden Befreiungen aus.
//     Kategorie K waere dort eine Unterzahlung.
//  D) Die Ausfuhr (Drittland, Kategorie G) bleibt dagegen unberuehrt — dieselbe Norm zaehlt sie
//     nicht mit auf.
//  E) Mehrere Gruende unter derselben Kategorie duerfen sich nicht gegenseitig verdraengen.
//  F) Regressionsschutz: die Faelle ohne §25a muessen unveraendert bleiben.
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
    firmenname: 'Test GmbH', strasse: 'Weg 1', plz: '10115', ort: 'Berlin', land: 'DE',
    ustIdNr: 'DE123456789', iban: 'DE02120300000000202051', email: 'a@b.de', ustMode: 'regel'
};
const KUNDE_DE = { name: 'Kunde DE', strasse: 'Str 2', plz: '20095', ort: 'Hamburg', land: 'DE' };
const KUNDE_AT = { name: 'Kunde AT', strasse: 'Gasse 3', plz: '1010', ort: 'Wien', land: 'AT', ustIdNr: 'ATU12345678' };
const KUNDE_CH = { name: 'Kunde CH', strasse: 'Weg 4', plz: '8001', ort: 'Zuerich', land: 'CH' };

function inv(positionen, extra) {
    return Object.assign({
        id: 'r1', nummer: 'RE-001', datum: '2026-09-05', faelligAm: '2026-09-19',
        kundeId: 'k1', positionen: positionen
    }, extra || {});
}
function diffPos(warenart, preis) {
    const p = { beschreibung: 'Artikel', menge: 1, einheit: 'Stück', einzelpreis: preis || 100,
                mwstSatz: null, differenzbesteuert: true };
    if (warenart !== undefined) p.warenart = warenart;
    return p;
}
const GEBRAUCHT = 'Gebrauchtgegenstände/Sonderregelung';
const KUNST     = 'Kunstgegenstände/Sonderregelung';
const SAMMLER   = 'Sammlungsstücke und Antiquitäten/Sonderregelung';

// Anzahl Vorkommen eines Textes in der XML
const zaehle = (xml, s) => xml.split(s).length - 1;

// ── A) Der eigentliche Fund ───────────────────────────────────────────────────
const xmlA = XRechnung.generate(inv([diffPos('gebraucht')]), SETTINGS, KUNDE_DE);

check('A1 kein "Steuerfreier Umsatz" mehr bei §25a',
      zaehle(xmlA, 'Steuerfreier Umsatz') === 0);
check('A2 Pflichttext nach §14a Abs. 6 steht in der XML',
      zaehle(xmlA, GEBRAUCHT) > 0);
check('A3 Kategorie bleibt E',
      zaehle(xmlA, '<ram:CategoryCode>E</ram:CategoryCode>') > 0);
check('A4 kein offener USt-Ausweis (0.00)',
      zaehle(xmlA, '<ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>') > 0);
check('A5 Text steht auf Zeilen- UND Dokumentebene',
      zaehle(xmlA, GEBRAUCHT) >= 2);

// ── B) Wortlaut je Warenart ───────────────────────────────────────────────────
check('B1 kunst -> Kunstgegenstaende/Sonderregelung',
      zaehle(XRechnung.generate(inv([diffPos('kunst')]), SETTINGS, KUNDE_DE), KUNST) > 0);
check('B2 sammlerstueck -> Sammlungsstuecke und Antiquitaeten/Sonderregelung',
      zaehle(XRechnung.generate(inv([diffPos('sammlerstueck')]), SETTINGS, KUNDE_DE), SAMMLER) > 0);
check('B3 fehlende Warenart faellt auf gebraucht zurueck',
      zaehle(XRechnung.generate(inv([diffPos(undefined)]), SETTINGS, KUNDE_DE), GEBRAUCHT) > 0);
check('B4 unbekannte Warenart faellt auf gebraucht zurueck',
      zaehle(XRechnung.generate(inv([diffPos('quatsch')]), SETTINGS, KUNDE_DE), GEBRAUCHT) > 0);

// ── C) §25a schlaegt die ig. Lieferung (§25a Abs. 5 Satz 2 UStG) ──────────────
const xmlC = XRechnung.generate(inv([diffPos('gebraucht')]), SETTINGS, KUNDE_AT);
check('C1 EU-Kunde mit USt-IdNr: NICHT Kategorie K',
      zaehle(xmlC, '<ram:CategoryCode>K</ram:CategoryCode>') === 0);
check('C2 EU-Kunde mit USt-IdNr: keine ig.-Lieferungs-Befreiung im Text',
      zaehle(xmlC, 'innergemeinschaftliche Lieferung') === 0);
check('C3 EU-Kunde mit USt-IdNr: stattdessen §25a-Pflichttext',
      zaehle(xmlC, GEBRAUCHT) > 0);

// ── D) Ausfuhr bleibt unberuehrt ──────────────────────────────────────────────
const xmlD = XRechnung.generate(inv([diffPos('gebraucht')]), SETTINGS, KUNDE_CH);
check('D1 Drittland bleibt Kategorie G',
      zaehle(xmlD, '<ram:CategoryCode>G</ram:CategoryCode>') > 0);
check('D2 Drittland behaelt die Ausfuhrbegruendung',
      zaehle(xmlD, 'Ausfuhrlieferung') > 0);

// ── E) Mehrere Gruende unter derselben Kategorie ──────────────────────────────
const xmlE1 = XRechnung.generate(inv([diffPos('gebraucht'), diffPos('kunst')]), SETTINGS, KUNDE_DE);
check('E1 zwei Warenarten: beide Pflichttexte ueberleben',
      zaehle(xmlE1, GEBRAUCHT) > 0 && zaehle(xmlE1, KUNST) > 0);

const nullSatzPos = { beschreibung: 'Sonstiges', menge: 1, einheit: 'Stück', einzelpreis: 50, mwstSatz: 0 };
const xmlE2 = XRechnung.generate(inv([diffPos('gebraucht'), nullSatzPos]), SETTINGS, KUNDE_DE);
check('E2 §25a neben sonstigem steuerfreien Umsatz: beide Gruende erhalten',
      zaehle(xmlE2, GEBRAUCHT) > 0 && zaehle(xmlE2, 'Steuerfreier Umsatz') > 0);

// ── F) Regressionsschutz: alles ohne §25a unveraendert ────────────────────────
const warePos = { beschreibung: 'Ware', menge: 1, einheit: 'Stück', einzelpreis: 100, mwstSatz: 0 };
const xmlF1 = XRechnung.generate(inv([warePos]), SETTINGS, KUNDE_AT);
check('F1 ig. Lieferung ohne §25a bleibt Kategorie K',
      zaehle(xmlF1, '<ram:CategoryCode>K</ram:CategoryCode>') > 0);

const leistungPos = { beschreibung: 'Leistung', menge: 1, einheit: 'Std.', einzelpreis: 100, mwstSatz: 0, igArt: 'leistung' };
check('F2 Reverse Charge bleibt Kategorie AE',
      zaehle(XRechnung.generate(inv([leistungPos]), SETTINGS, KUNDE_AT), '<ram:CategoryCode>AE</ram:CategoryCode>') > 0);

const regelPos = { beschreibung: 'Ware', menge: 1, einheit: 'Stück', einzelpreis: 100, mwstSatz: 19 };
const xmlF3 = XRechnung.generate(inv([regelPos]), SETTINGS, KUNDE_DE);
check('F3 Regelsatz bleibt Kategorie S',
      zaehle(xmlF3, '<ram:CategoryCode>S</ram:CategoryCode>') > 0);
check('F4 Regelsatz weist 19,00 aus',
      zaehle(xmlF3, '<ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>') > 0);

const xmlF5 = XRechnung.generate(inv([diffPos('gebraucht')], { isKlein: true }), SETTINGS, KUNDE_DE);
check('F5 Kleinunternehmer: §19 gewinnt, kein §25a-Text',
      zaehle(xmlF5, '§19 UStG') > 0 && zaehle(xmlF5, GEBRAUCHT) === 0);

// ── G) Quelltextpruefung: die Begruendung darf nicht still zurueckfallen ──────
check('G1 taxCategoryFor kennt differenzbesteuert',
      /differenzbesteuert/.test(src));
check('G2 §25a Abs. 5 Satz 2 als Begruendung fuer den K-Ausschluss dokumentiert',
      /Abs\. 5 Satz 2/.test(src));

console.log('\n' + pass + '/' + total + ' Checks bestanden');
process.exit(pass === total ? 0 : 1);
