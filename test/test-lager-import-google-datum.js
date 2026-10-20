// Regressionstest: Lager-Excel-Import einer Google-Sheets-Tabelle (Kundenmeldung 2026-10-20)
//  A) Google exportiert Datumszellen mit dem Zahlenformat "dd.MM.yyyy". SheetJS setzt das nicht
//     um, sheet_to_json(raw:false) lieferte deshalb die Seriennummer "46164" — und _parseDate
//     machte ueber new Date("46164") das Jahr 46164 daraus.
//  B) Die Kopfzeile "Artikel und Beschreibung" traf keinen exakten Namen der Auto-Erkennung,
//     die Beschreibung blieb leer. Ebenso "Einkaufskosten", "Produktnr." und "Umsatz".
// Gelesen wird wie im echten Import: XLSX.read ohne Optionen, dann sheet_to_json(raw:false).
// _parseDate/_autoDetect/_findHeaderRow kommen per Quelltext-Extraktion aus lager/page.js.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'js', 'vendor', 'xlsx.full.min.js'));

const pageSrc = fs.readFileSync(path.join(__dirname, '..', 'lager', 'page.js'), 'utf8');
const excelStart = pageSrc.indexOf('const ExcelImport = {');
assert.ok(excelStart !== -1, 'ExcelImport nicht gefunden');

function extractMethod(sig) {
    const i = pageSrc.indexOf(sig, excelStart);
    assert.ok(i !== -1, 'Methode nicht gefunden: ' + sig);
    const rest = pageSrc.slice(i + sig.length);
    const m = rest.match(/\n    \},/);
    assert.ok(m, 'Methodenende nicht gefunden: ' + sig);
    return rest.slice(0, m.index);
}
const ExcelImport = {
    _parseDate:     new Function('v', extractMethod('_parseDate(v) {')),
    _autoDetect:    new Function('columns', extractMethod('_autoDetect(columns) {')),
    _findHeaderRow: new Function('aoa', extractMethod('_findHeaderRow(aoa) {'))
};

let pass = 0, total = 0;
function check(name, cond, detail) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else console.error('✗ FAIL ' + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : ''));
}

// Nachbau der Kundentabelle: gleiche Kopfzeile, gleiche Zellformate wie im Google-Export
// (styles.xml der echten Datei: numFmt 164 = "dd.MM.yyyy", 165 = "#,##0.00\ [$€-1]").
const kopf = ['Kaufdatum', 'Herkunft', 'Marke', 'Artikel und Beschreibung', 'Produktnr.',
              'Einkaufskosten', 'Pushgebühren', 'Ausgaben', 'Umsatz', 'Gewinn', 'Status', 'Einkaufsbeleg'];
const EUR = '#,##0.00\\ [$€-1]';
const zeilen = [
    // Seriennummer, Marke, Beschreibung, Nr., EK, VK
    [46164, 'Ralph Lauren', 'Polo Hemd Hellblau',                'J0001', 16.59, 23.90],  // 22.05.2026
    [46175, 'Adidas',       'Manchester United Trainingsshirt',  'J0008',  9.96,  8.50],  // 02.06.2026
    [46196, 'Nike',         'Trackpants Dunkelblau-Rot',         'J0019', 13.69, null],   // 23.06.2026, unverkauft
    [null,  'Puma',         'Trainingsjacke retro',              'J0058',  0,    11.00]   // ohne Kaufdatum
];
const ws = { '!ref': 'A1:L' + (zeilen.length + 1) };
kopf.forEach((h, i) => { ws[XLSX.utils.encode_cell({ r: 0, c: i })] = { t: 's', v: h }; });
zeilen.forEach(([serial, marke, beschr, nr, ek, vk], r) => {
    const set = (c, cell) => { ws[XLSX.utils.encode_cell({ r: r + 1, c })] = cell; };
    if (serial !== null) set(0, { t: 'n', v: serial, z: 'dd.MM.yyyy' });
    set(1, { t: 's', v: 'DE' });
    set(2, { t: 's', v: marke });
    set(3, { t: 's', v: beschr });
    set(4, { t: 's', v: nr });
    set(5, { t: 'n', v: ek, z: EUR });
    if (vk !== null) set(8, { t: 'n', v: vk, z: EUR });
    set(10, { t: 's', v: vk !== null ? 'Verkauft' : 'Angekommen' });
});
const wbOut = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbOut, ws, 'TEMPLATE');
const bytes = XLSX.write(wbOut, { type: 'array', bookType: 'xlsx' });

// Exakt so wie _handleFileParsed / _ladeBlatt lesen
const wb = XLSX.read(bytes, { type: 'array' });
const sheet = wb.Sheets[wb.SheetNames[0]];
const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
const hdrIdx = ExcelImport._findHeaderRow(aoa);
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, range: hdrIdx });
const columns = Object.keys(rows[0]).filter(k => k && !/^__EMPTY/.test(k));
const map = ExcelImport._autoDetect(columns);

check('Vorbedingung: SheetJS liefert die Seriennummer statt eines Datums', rows[0]['Kaufdatum'] === '46164', rows[0]['Kaufdatum']);

// ── A) Datum ─────────────────────────────────────────────────────────────────
check('A1 Kaufdatum-Spalte erkannt', map.datum === 'Kaufdatum', map.datum);
const daten = rows.map(r => ExcelImport._parseDate(r[map.datum]));
check('A2 46164 → 2026-05-22', daten[0] === '2026-05-22', daten[0]);
check('A3 46175 → 2026-06-02 (nicht 06.02.)', daten[1] === '2026-06-02', daten[1]);
check('A4 46196 → 2026-06-23', daten[2] === '2026-06-23', daten[2]);
check('A5 leere Zelle → null (gemeinsames Datum greift)', daten[3] === null, daten[3]);
check('A6 Seriennummer als Zahl', ExcelImport._parseDate(46164) === '2026-05-22');
check('A7 Seriennummer mit Uhrzeit-Anteil', ExcelImport._parseDate('46164.75') === '2026-05-22');
// Bisherige Formate unveraendert
check('A8 TT.MM.JJJJ unveraendert', ExcelImport._parseDate('02.06.2026') === '2026-06-02');
check('A9 ISO unveraendert', ExcelImport._parseDate('2026-06-02') === '2026-06-02');
check('A10 US M/T/JJ unveraendert', ExcelImport._parseDate('5/22/26') === '2026-05-22');
check('A11 Date-Objekt unveraendert', ExcelImport._parseDate(new Date(2026, 4, 22)) === '2026-05-22');

// ── B) Spaltenerkennung ──────────────────────────────────────────────────────
check('B1 "Artikel und Beschreibung" → Beschreibung', map.beschreibung === 'Artikel und Beschreibung', map.beschreibung);
check('B2 "Einkaufskosten" → EK-Preis', map.einkaufspreis === 'Einkaufskosten', map.einkaufspreis);
check('B3 "Produktnr." → Artikelnummer', map.artikelNr === 'Produktnr.', map.artikelNr);
check('B4 "Umsatz" → Verkaufspreis', map.verkaufspreis === 'Umsatz', map.verkaufspreis);
check('B5 Marke weiter erkannt', map.marke === 'Marke', map.marke);
check('B6 Beschreibung kommt in der Zeile an', rows[1][map.beschreibung] === 'Manchester United Trainingsshirt', rows[1][map.beschreibung]);
// Preis so geparst wie in _import()
const preis = parseFloat(String(rows[0][map.einkaufspreis]).replace(',', '.').replace(/[^\d.\-]/g, ''));
check('B7 EK-Preis 16,59 € → 16.59', preis === 16.59, rows[0][map.einkaufspreis]);
// Exakte Treffer gehen weiter vor: eine echte "Beschreibung"-Spalte schlaegt "Artikel und Beschreibung"
const m2 = ExcelImport._autoDetect(['Notiz-Beschreibung', 'Beschreibung']);
check('B8 exakter Name hat Vorrang vor Teiltreffer', m2.beschreibung === 'Beschreibung', m2.beschreibung);
const m3 = ExcelImport._autoDetect(['Marke', 'EK']);
check('B9 ohne passende Spalte bleibt Beschreibung leer', m3.beschreibung === '', m3.beschreibung);

console.log(`\n${pass}/${total} bestanden`);
if (pass !== total) process.exit(1);
