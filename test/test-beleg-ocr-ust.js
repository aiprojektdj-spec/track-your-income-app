// Test: USt-Erkennung der Belegerkennung (Kriterium 2.1 des Anforderungsprofils)
//
// Die Regel ist bewusst zurueckhaltend, und genau das wird hier geprueft:
//   • gemischte Saetze (7 % und 19 % auf einem Bon) ergeben GAR KEINEN Vorschlag
//   • ein gelesener Steuerbetrag wird nur uebernommen, wenn er zum Brutto passt
//   • passt er nicht oder steht er nicht da, wird gerechnet und gekennzeichnet
//   • die Steuernummer im Bonkopf ist keine Steuerzeile
//
// Der Gegentest steht in test-beleg-ocr.js: die bestehende Betragsregel darf sich durch
// die neue Regel NICHT veraendert haben. Beide muessen gruen sein.
//
//   node test/test-beleg-ocr-ust.js

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
    else      { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}
const zeilen = t => t.split('\n');

// ── Ein Satz, Steuerbetrag steht auf dem Bon ───────────────────────────────
const BAUHAUS = [
    'BAUHAUS Ravensburg',
    'Schussenstrasse 2',
    'St.-Nr. 77/123/45678',
    '',
    'Akkuschrauber        71,34',
    'Bohrer-Set           14,56',
    '------------------------------',
    'SUMME EUR            85,90',
    'MwSt 19,00%          13,71',
    'Netto                72,19',
    'Betrag EUR           85,90',
].join('\n');

console.log('\n--- Ein Satz, Betrag steht auf dem Bon ---');
{
    const r = OCR.extract(BAUHAUS);
    check('Brutto weiterhin 85,90', r.betrag && r.betrag.wert === 85.90, r.betrag);
    check('Satz 19', r.ustSatz && r.ustSatz.wert === 19, r.ustSatz);
    check('Rohtext des Satzes bleibt erhalten', r.ustSatz && /19/.test(r.ustSatz.roh), r.ustSatz);
    check('Steuerbetrag 13,71 gelesen', r.ustBetrag && r.ustBetrag.wert === 13.71, r.ustBetrag);
    check('gelesen, nicht gerechnet', r.ustBetrag && !r.ustBetrag.berechnet, r.ustBetrag);
    // Gegenprobe der Zahl selbst: 85,90 * 19 / 119 = 13,715 -> 13,71 oder 13,72.
    check('Der gelesene Wert liegt im Toleranzband',
        Math.abs(13.71 - (85.90 * 19 / 119)) <= 0.02);
}

// ── Ein Satz, kein Steuerbetrag auf dem Bon ────────────────────────────────
console.log('\n--- Ein Satz, Betrag fehlt: wird gerechnet und gekennzeichnet ---');
{
    const bon = [
        'Cafe Central',
        'Rechnung',
        'Espresso             3,20',
        'Kuchen               4,30',
        'SUMME EUR            7,50',
        'inkl. 19 % MwSt.',
    ].join('\n');
    const r = OCR.extract(bon);
    check('Satz 19 erkannt', r.ustSatz && r.ustSatz.wert === 19, r.ustSatz);
    // 7,50 * 19 / 119 = 1,197... -> 1,20
    check('Steuerbetrag 1,20 gerechnet', r.ustBetrag && r.ustBetrag.wert === 1.20, r.ustBetrag);
    check('als gerechnet gekennzeichnet', r.ustBetrag && r.ustBetrag.berechnet === true, r.ustBetrag);
    check('ohne Rohtext, weil nichts dastand', r.ustBetrag && r.ustBetrag.roh === null, r.ustBetrag);
}

// ── Gemischte Saetze: gar nichts ───────────────────────────────────────────
console.log('\n--- Gemischte Saetze ergeben keinen Vorschlag ---');
{
    const bon = [
        'REWE Markt GmbH',
        'Vollkornbrot          2,49 B',
        'Spuelmittel           3,99 A',
        'SUMME EUR             6,48',
        'MwSt A 19,00%         0,64',
        'MwSt B  7,00%         0,16',
    ].join('\n');
    const r = OCR.extract(bon);
    check('kein Satz vorgeschlagen', r.ustSatz === null, r.ustSatz);
    check('kein Steuerbetrag vorgeschlagen', r.ustBetrag === null, r.ustBetrag);
    check('Brutto bleibt trotzdem erkannt', r.betrag && r.betrag.wert === 6.48, r.betrag);
}

// ── Steuernummer ist keine Steuerzeile ─────────────────────────────────────
console.log('\n--- Steuernummer / USt-IdNr. im Kopf ---');
{
    const bon = [
        'Muster GmbH',
        'Steuernummer 12/345/67890',
        'USt-IdNr. DE123456789',
        'Ware                 50,00',
        'SUMME EUR            50,00',
    ].join('\n');
    const r = OCR.extract(bon);
    check('kein Satz aus der Steuernummer', r.ustSatz === null, r.ustSatz);
    check('kein Steuerbetrag', r.ustBetrag === null, r.ustBetrag);
}

// ── Unplausibler Prozentwert ───────────────────────────────────────────────
console.log('\n--- Prozentangaben, die kein Steuersatz sind ---');
{
    const r = OCR.findUst(zeilen([
        'Rabatt 30 % auf alles',
        'Trinkgeld 10%',
    ].join('\n')), 100);
    check('30 % Rabatt ist kein Steuersatz (keine Steuerzeile)', r.satz === null, r.satz);

    const r2 = OCR.findUst(zeilen('MwSt 30,00%   10,00'), 100);
    check('30 % auf einer Steuerzeile bleibt ueber der Plausibilitaetsgrenze', r2.satz === null, r2.satz);

    const r3 = OCR.findUst(zeilen('MwSt 16,00%   13,79'), 100);
    check('16 % (Fassung 2020) wird akzeptiert — kein jahresfester Satz im Code',
        r3.satz && r3.satz.wert === 16, r3.satz);
}

// ── Gelesener Betrag passt nicht zum Brutto ────────────────────────────────
console.log('\n--- Falsch gelesener Steuerbetrag wird nicht uebernommen ---');
{
    // Dieselbe Fehlerart wie beim gemessenen Bauhaus-Bon: eine Ziffer klebt am Betrag.
    const r = OCR.findUst(zeilen([
        'SUMME EUR            85,90',
        'MwSt 19,00%         713,71',
    ].join('\n')), 85.90);
    check('Satz bleibt 19', r.satz && r.satz.wert === 19, r.satz);
    check('713,71 wird verworfen', r.betrag && r.betrag.wert !== 713.71, r.betrag);
    check('stattdessen gerechnet', r.betrag && r.betrag.berechnet === true, r.betrag);
    check('gerechneter Wert ist 13,72 oder 13,71',
        r.betrag && Math.abs(r.betrag.wert - 85.90 * 19 / 119) <= 0.01, r.betrag);
}

// ── Ohne Brutto keine Gegenprobe, also kein Betrag ─────────────────────────
console.log('\n--- Ohne Bruttobetrag ---');
{
    const r = OCR.findUst(zeilen('MwSt 19,00%   13,71'), null);
    check('Satz wird trotzdem vorgeschlagen', r.satz && r.satz.wert === 19, r.satz);
    check('Betrag nicht, weil nichts gegengeprueft werden kann', r.betrag === null, r.betrag);
}

// ── Leereingabe ────────────────────────────────────────────────────────────
console.log('\n--- Leereingabe ---');
{
    const r = OCR.extract('');
    check('ustSatz ist null', r.ustSatz === null);
    check('ustBetrag ist null', r.ustBetrag === null);
}

console.log('\n' + pass + ' OK, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
