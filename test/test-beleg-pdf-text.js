// Test: PDF-Textschicht der Belegerkennung (js/beleg-ocr-ui.js)
//
// Das Anforderungsprofil nennt "Kassenbons/PDFs". Ein Haendler-PDF traegt den Text
// bereits — dann ist die Textschicht die genauere Quelle als eine Texterkennung auf
// einem selbst gerenderten Bild.
//
// Geprueft wird beides, was dabei schiefgehen kann:
//   • Der Text muss zeilenweise herauskommen, sonst kann beleg-ocr.js nichts damit
//     anfangen — die Heuristik arbeitet Zeile fuer Zeile.
//   • Ein Scan-PDF ohne Textschicht muss NICHTS liefern. Ein halb geratener Text waere
//     schlimmer als die Auskunft "bitte als Bild hochladen": aus Rauschen wird sonst ein
//     Betragsvorschlag, den beim Klicken niemand nachrechnet.
//
//   node test/test-beleg-pdf-text.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const sandbox = {
    console, Uint8Array, ArrayBuffer, String, parseInt, parseFloat, RegExp, Math, Error,
    Blob: typeof Blob !== 'undefined' ? Blob : undefined,
    Response: typeof Response !== 'undefined' ? Response : undefined,
    DecompressionStream: typeof DecompressionStream !== 'undefined' ? DecompressionStream : undefined,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'beleg-ocr.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'beleg-ocr-ui.js'), 'utf8'), sandbox);
const UI  = sandbox.BelegOcrUi;
const OCR = sandbox.BelegOCR;

let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log('  OK   ' + name); }
    else      { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); }
}

// ── Textoperatoren ─────────────────────────────────────────────────────────
console.log('\n--- Textoperatoren eines Seiteninhalts ---');
{
    // So sieht der Inhaltsstrom einer schlichten Rechnung aus.
    const inhalt = `BT /F1 12 Tf 72 720 Td (Buero Meier GmbH) Tj
72 700 Td (Rechnung Nr. R-4711) Tj
72 680 Td (Datum: 14.09.2026) Tj
72 640 Td (Buerostuhl) Tj 400 640 Td (238,00) Tj
72 620 Td (SUMME EUR) Tj 400 620 Td (238,00) Tj
72 600 Td (MwSt 19,00%) Tj 400 600 Td (38,00) Tj
ET`;
    const text = UI.pdfTextAusInhalt(inhalt);
    check('Haendlername kommt vor', /Buero Meier GmbH/.test(text), text);
    check('Text ist in Zeilen zerlegt', text.split('\n').length >= 5, text.split('\n').length);

    const r = OCR.extract(text);
    check('Datum erkannt', r.datum && r.datum.wert === '2026-09-14', r.datum);
    check('Betrag 238,00 erkannt', r.betrag && r.betrag.wert === 238.00, r.betrag);
    check('USt-Satz 19 erkannt', r.ustSatz && r.ustSatz.wert === 19, r.ustSatz);
    check('USt-Betrag 38,00 steht fest', r.ustBetrag && r.ustBetrag.wert === 38.00, r.ustBetrag);
    // Spaltenlayout: Label und Betrag stehen in getrennten Td-Befehlen und landen deshalb
    // auf VERSCHIEDENEN Zeilen. Die Steuerregel findet auf der Zeile "MwSt 19,00%" also
    // keinen Betrag und rechnet ihn aus Brutto und Satz — 238,00 * 19 / 119 = 38,00, also
    // exakt der Wert, der daneben gedruckt steht. Das ist der Normalfall bei PDFs und kein
    // Mangel: gerechnet ist bei genau einem Satz exakt, und der Chip weist es aus.
    check('als gerechnet gekennzeichnet (Spaltenlayout)', r.ustBetrag && r.ustBetrag.berechnet === true, r.ustBetrag);
}

console.log('\n--- Maskierungen und TJ-Arrays ---');
{
    check('Klammern in Klammern ueberleben',
        UI.pdfTextAusInhalt('BT (Kosten \\(netto\\)) Tj ET').indexOf('Kosten (netto)') !== -1);
    check('Oktal-Escapes werden aufgeloest (\\344 = ä)',
        UI.pdfTextAusInhalt('BT (M\\344ller) Tj ET').indexOf('Mäller') !== -1);
    check('TJ-Array wird zusammengesetzt',
        UI.pdfTextAusInhalt('BT [(SUM)-20(ME)] TJ ET').indexOf('SUMME') !== -1);
    check('grosser Kerning-Sprung wird zum Leerzeichen',
        /SUMME EUR/.test(UI.pdfTextAusInhalt('BT [(SUMME)-400(EUR)] TJ ET')));
    check('Hex-String wird gelesen',
        UI.pdfTextAusInhalt('BT <48616C6C6F> Tj ET').indexOf('Hallo') !== -1);
}

// ── Ganze Datei ────────────────────────────────────────────────────────────
// Minimales, unkomprimiertes PDF. Absichtlich von Hand gebaut: eine PDF-Bibliothek
// waere eine neue Abhaengigkeit (Regel 6), und fuer den Zweck genuegen 20 Zeilen.
function baueTextPdf(inhalt) {
    const objekte = [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
        '3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
        '4 0 obj\n<< /Length ' + inhalt.length + ' >>\nstream\n' + inhalt + '\nendstream\nendobj\n',
        '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    ];
    let pdf = '%PDF-1.4\n';
    for (const o of objekte) pdf += o;
    pdf += 'trailer\n<< /Size 6 /Root 1 0 R >>\n%%EOF\n';
    return Buffer.from(pdf, 'latin1');
}

(async () => {
    console.log('\n--- Ganze PDF-Datei ---');
    const rechnung = baueTextPdf([
        'BT /F1 12 Tf',
        '72 720 Td (Tankstelle Sued GmbH) Tj',
        '72 700 Td (Beleg vom 03.09.2026) Tj',
        '72 660 Td (Diesel 42,10 l) Tj',
        '72 640 Td (SUMME EUR 78,45) Tj',
        '72 620 Td (MwSt 19,00% 12,52) Tj',
        'ET',
    ].join('\n'));

    const text = await UI.pdfText(rechnung.buffer.slice(
        rechnung.byteOffset, rechnung.byteOffset + rechnung.byteLength));
    check('Text aus dem unkomprimierten PDF gefunden', !!text, text);
    if (text) {
        const r = OCR.extract(text);
        check('Haendler erkannt', r.haendler && /Tankstelle/.test(r.haendler.wert), r.haendler);
        check('Datum erkannt', r.datum && r.datum.wert === '2026-09-03', r.datum);
        check('Summe 78,45 erkannt', r.betrag && r.betrag.wert === 78.45, r.betrag);
        check('USt-Satz 19 erkannt', r.ustSatz && r.ustSatz.wert === 19, r.ustSatz);
    }

    console.log('\n--- Scan-PDF ohne Textschicht ---');
    // Kein BT/ET, nur Binaerrauschen, wie es ein eingebettetes Bild hinterlaesst.
    const scan = Buffer.concat([
        Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /XObject /Subtype /Image >>\nstream\n', 'latin1'),
        Buffer.from(Array.from({ length: 4000 }, (_, i) => (i * 37) % 256)),
        Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1'),
    ]);
    const scanText = await UI.pdfText(scan.buffer.slice(
        scan.byteOffset, scan.byteOffset + scan.byteLength));
    check('Scan-PDF liefert null statt Rauschen', scanText === null, scanText);

    console.log('\n--- Leeres PDF ---');
    const leer = Buffer.from('%PDF-1.4\n%%EOF\n', 'latin1');
    const leerText = await UI.pdfText(leer.buffer.slice(
        leer.byteOffset, leer.byteOffset + leer.byteLength));
    check('leeres PDF liefert null', leerText === null, leerText);

    console.log('\n' + pass + ' OK, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
