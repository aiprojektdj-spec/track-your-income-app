// Regressionstest: XRechnung/EN-16931-Fixes (2026-07-30) — Rundung (BR-CO-10), Menge=0,
// Kunden-USt-IdNr-Feldname, Steuerkategorien (ig. Lieferung §6a vs. Reverse Charge §13b vs.
// Ausfuhr vs. Kleinunternehmer), Pflichtfeld-Validierung vor Export.
// Testet den ECHTEN Code aus rechnungen/js/xrechnung.js: die Datei ist eine reine Browser-IIFE
// ohne module.exports — wir re-evaluieren sie 1:1 in Node (kein Nachbau der Logik) und rufen
// die zurückgegebenen Funktionen auf. generate()/validatePflichtfelder() sind rein (kein
// Store/Utils-Zugriff), nur download() bräuchte Browser-Globals — die testen wir hier nicht.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'rechnungen', 'js', 'xrechnung.js'), 'utf8');
const startMarker = 'var XRechnung = (function () {';
const startIdx = src.indexOf(startMarker);
assert.ok(startIdx !== -1, 'IIFE-Start nicht gefunden — hat sich xrechnung.js strukturell geändert?');
const endMarker = '})();';
const endIdx = src.lastIndexOf(endMarker);
assert.ok(endIdx !== -1 && endIdx > startIdx, 'IIFE-Ende nicht gefunden');
const iifeBody = src.slice(startIdx + 'var XRechnung = '.length, endIdx + endMarker.length);
const XRechnung = new Function('return ' + iifeBody)();

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else console.error('✗ FAIL ' + name);
}

const settingsBase = { firmenname: 'Test GmbH', adresse: 'Musterstr. 1', plz: '10115', ort: 'Berlin', land: 'DE', ustId: 'DE123456789' };

// ── 1) Rundung: Summe der GERUNDETEN Zeilen == Kopf-Summenfeld (BR-CO-10) ────
{
    // 3 Positionen mit krummen Beträgen, die bei falscher Rundungsreihenfolge eine
    // Differenz von 0,01€ zwischen Zeilensumme und Kopfsumme erzeugen würden.
    var inv1 = {
        nummer: 'RE-1', datum: '2026-03-01', typ: 'rechnung', isKlein: false,
        positionen: [
            { beschreibung: 'A', menge: 2.35, einzelpreis: 45.50, mwstSatz: 19 },
            { beschreibung: 'B', menge: 1.15, einzelpreis: 89.90, mwstSatz: 19 },
            { beschreibung: 'C', menge: 3.05, einzelpreis: 12.30, mwstSatz: 19 }
        ]
    };
    var kunde1 = { firma: 'Kunde AG', strasse: 'Kundenweg 2', plz: '80331', ort: 'München', land: 'DE' };
    var xml1 = XRechnung.generate(inv1, settingsBase, kunde1);
    // Nur die ZEILEN-LineTotalAmounts (innerhalb SpecifiedTradeSettlementLineMonetarySummation) —
    // der gleichnamige Tag existiert auch einmal im Kopf-Summenblock, der hier separat gelesen wird.
    var lineTotals = [...xml1.matchAll(/<ram:SpecifiedTradeSettlementLineMonetarySummation>\s*<ram:LineTotalAmount>([\d.]+)<\/ram:LineTotalAmount>/g)].map(m => parseFloat(m[1]));
    var headerLineTotal = parseFloat(xml1.match(/<ram:SpecifiedTradeSettlementHeaderMonetarySummation>[\s\S]*?<ram:LineTotalAmount>([\d.]+)<\/ram:LineTotalAmount>/)[1]);
    check('3 Zeilen-LineTotalAmounts gefunden', lineTotals.length === 3);
    var lineSum = Math.round(lineTotals.reduce((s, v) => s + v, 0) * 100) / 100;
    check('Summe der gerundeten Zeilenbeträge == Kopf-LineTotalAmount (BR-CO-10)', Math.abs(lineSum - headerLineTotal) < 0.001);
    check('Kopf-LineTotalAmount ist plausibel (~247,8x€)', headerLineTotal > 247 && headerLineTotal < 248);
}

// ── 2) Menge = 0 bleibt 0, wird NICHT stillschweigend zu 1 ───────────────────
{
    var inv2 = {
        nummer: 'RE-2', datum: '2026-03-01', typ: 'rechnung', isKlein: false,
        positionen: [{ beschreibung: 'Korrekturzeile', menge: 0, einzelpreis: 999, mwstSatz: 19 }]
    };
    var xml2 = XRechnung.generate(inv2, settingsBase, { firma: 'K', strasse: 'S', plz: '1', ort: 'O', land: 'DE' });
    check('Menge 0 -> BilledQuantity = 0.0000 (nicht 1.0000)', xml2.includes('BilledQuantity unitCode="C62">0.0000<'));
    check('Menge 0 -> LineTotalAmount = 0.00 (nicht 999.00)', xml2.includes('<ram:LineTotalAmount>0.00</ram:LineTotalAmount>'));
}

// ── 3) Kunden-USt-IdNr: liest kunde.ustIdNr (nicht kunde.ustId) ──────────────
{
    var inv3 = { nummer: 'RE-3', datum: '2026-03-01', typ: 'rechnung', isKlein: false,
        positionen: [{ beschreibung: 'X', menge: 1, einzelpreis: 100, mwstSatz: 0, igArt: 'leistung' }] };
    var kundeRichtig = { firma: 'EU Kunde', strasse: 'S', plz: '1', ort: 'O', land: 'FR', ustIdNr: 'FR12345678901' };
    var xmlRichtig = XRechnung.generate(inv3, settingsBase, kundeRichtig);
    check('kunde.ustIdNr landet im XML (BT-48 Käufer-USt-IdNr.)', xmlRichtig.includes('FR12345678901'));

    var kundeFalschesFeld = { firma: 'EU Kunde', strasse: 'S', plz: '1', ort: 'O', land: 'FR', ustId: 'FR99999999999' };
    var xmlFalsch = XRechnung.generate(inv3, settingsBase, kundeFalschesFeld);
    check('kunde.ustId (falsches Feld) wird NICHT übernommen', !xmlFalsch.includes('FR99999999999'));
}

// ── 4) Steuerkategorien: ig. Lieferung (K/§6a) vs. Reverse Charge (AE/§13b) ──
{
    var kundeEU = { firma: 'EU B2B', strasse: 'S', plz: '1', ort: 'O', land: 'NL', ustIdNr: 'NL123456789B01' };
    var invWare = { nummer: 'RE-4', datum: '2026-03-01', typ: 'rechnung', isKlein: false,
        positionen: [{ beschreibung: 'Ware', menge: 1, einzelpreis: 100, mwstSatz: 0, igArt: 'ware' }] };
    var xmlWare = XRechnung.generate(invWare, settingsBase, kundeEU);
    check('ig. Lieferung (Ware) -> CategoryCode K', /<ram:CategoryCode>K<\/ram:CategoryCode>/.test(xmlWare));
    check('ig. Lieferung -> §6a-Befreiungsgrund im XML', xmlWare.includes('§6a UStG'));
    check('ig. Lieferung -> NICHT §13b-Text', !xmlWare.includes('§13b'));

    var invLeistung = { nummer: 'RE-5', datum: '2026-03-01', typ: 'rechnung', isKlein: false,
        positionen: [{ beschreibung: 'Beratung', menge: 1, einzelpreis: 100, mwstSatz: 0, igArt: 'leistung' }] };
    var xmlLeistung = XRechnung.generate(invLeistung, settingsBase, kundeEU);
    check('Reverse Charge (Leistung) -> CategoryCode AE', /<ram:CategoryCode>AE<\/ram:CategoryCode>/.test(xmlLeistung));
    check('Reverse Charge -> §13b-Befreiungsgrund im XML', xmlLeistung.includes('§13b UStG'));

    var kundeDrittland = { firma: 'US Kunde', strasse: 'S', plz: '1', ort: 'O', land: 'US' };
    var invExport = { nummer: 'RE-6', datum: '2026-03-01', typ: 'rechnung', isKlein: false,
        positionen: [{ beschreibung: 'Export', menge: 1, einzelpreis: 100, mwstSatz: 0, igArt: 'ware' }] };
    var xmlExport = XRechnung.generate(invExport, settingsBase, kundeDrittland);
    check('Drittland-Export -> CategoryCode G', /<ram:CategoryCode>G<\/ram:CategoryCode>/.test(xmlExport));
    check('Drittland-Export -> §6 UStG-Befreiungsgrund (Ausfuhr)', xmlExport.includes('§6 UStG'));

    var invKlein = { nummer: 'RE-7', datum: '2026-03-01', typ: 'rechnung', isKlein: true,
        positionen: [{ beschreibung: 'X', menge: 1, einzelpreis: 100, mwstSatz: 19 }] };
    var xmlKlein = XRechnung.generate(invKlein, settingsBase, { firma: 'K', strasse: 'S', plz: '1', ort: 'O', land: 'DE' });
    check('Kleinunternehmer -> CategoryCode E + VATEX-EU-O', /<ram:CategoryCode>E<\/ram:CategoryCode>/.test(xmlKlein) && xmlKlein.includes('VATEX-EU-O'));
}

// ── 5) validatePflichtfelder(): erkennt fehlende §14-Pflichtangaben ──────────
{
    var vollstaendig = XRechnung.validatePflichtfelder(
        { nummer: 'RE-8', datum: '2026-03-01', positionen: [{ menge: 1, einzelpreis: 10, mwstSatz: 19 }] },
        settingsBase, { firma: 'K', strasse: 'S', plz: '1', ort: 'O' }
    );
    check('Vollständige Rechnung -> keine fehlenden Pflichtfelder', vollstaendig.length === 0);

    var unvollstaendig = XRechnung.validatePflichtfelder(
        { nummer: '', datum: '2026-03-01', positionen: [] },
        { adresse: '', ustId: '' }, null
    );
    check('Unvollständige Rechnung -> mehrere fehlende Pflichtfelder erkannt', unvollstaendig.length >= 4);
    check("fehlende Rechnungsnummer wird erkannt", unvollstaendig.some(m => /Rechnungsnummer/.test(m)));
    check('fehlender Empfänger wird erkannt', unvollstaendig.some(m => /Empfänger/.test(m)));
}

// ── 6) rechnungen/js/rechnung.js + wiederkehrend.js: menge-Fix textuell vorhanden ──
{
    const rechnungSrc = fs.readFileSync(path.join(__dirname, '..', 'rechnungen', 'js', 'rechnung.js'), 'utf8');
    check('rechnung.js: kein `pos.menge || 1` mehr (Menge-0-Bug)', !/pos\.menge \|\| 1/.test(rechnungSrc));
    check('rechnung.js: §14-Gate umfasst auch Gutschriften', /typ === 'rechnung' \|\| typ === 'gutschrift'/.test(rechnungSrc));

    const wkSrc = fs.readFileSync(path.join(__dirname, '..', 'rechnungen', 'js', 'wiederkehrend.js'), 'utf8');
    check('wiederkehrend.js: kein `p.menge || 1` mehr', !/p\.menge \|\| 1/.test(wkSrc));
    check('wiederkehrend.js: §14-Pflichtfeld-Check vor Rechnungserstellung vorhanden', /missing14/.test(wkSrc));
}

console.log('\n' + pass + '/' + total + ' Tests bestanden ' + (pass === total ? '✅' : '❌'));
if (pass !== total) process.exit(1);
