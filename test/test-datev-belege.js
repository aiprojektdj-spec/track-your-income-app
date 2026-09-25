// Belegexport neben dem DATEV-Buchungsstapel (Kriterium 4.1 des Anforderungsprofils,
// plan/pruefliste-buchhaltung-2026-09-21.md).
//
// Das Profil verlangt "standardisierter Daten- UND Belegexport". Der Stapel allein ist der
// Datenteil; ohne die Bilder muss der Steuerberater jeden Beleg einzeln nachfordern.
//
// Die Verknuepfung ist die Belegnummer: sie steht im Stapel in Belegfeld 1 und gibt hier der
// Bilddatei ihren Namen. Bricht diese Verbindung, ist das Archiv wertlos — man saehe es dem
// Export aber nicht an. Genau das haelt dieser Harness fest.
//
//   node test/test-datev-belege.js

'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let pass = 0, total = 0;
function check(name, cond, detail) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); process.exitCode = 1; }
}

const wurzel = path.join(__dirname, '..');
const datevSrc = fs.readFileSync(path.join(wurzel, 'js', 'datev.js'), 'utf8');

// StackrZip kommt echt herein, nicht als Attrappe: ausDataUrl() entscheidet ueber Endung und
// Bytes, und eine falsch geratene Endung faellt erst beim Doppelklick des Beraters auf.
const zipSandbox = { console, TextEncoder, Buffer, DataView, Uint8Array, ArrayBuffer };
vm.createContext(zipSandbox);
vm.runInContext(fs.readFileSync(path.join(wurzel, 'js', 'zip.js'), 'utf8'), zipSandbox);
const StackrZip = zipSandbox.StackrZip;

// Ein 1x1-JPEG und ein 1x1-PNG als Data-URL — mehr braucht es nicht, geprueft wird die
// Zuordnung, nicht der Bildinhalt.
const JPG = 'data:image/jpeg;base64,' + Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]).toString('base64');
const PNG = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4E, 0x47]).toString('base64');

function lade(d) {
    const daten = Object.assign({
        settings: { ustMode: 'regel', ustVersteuerungsart: 'soll' },
        purchases: [], sales: [], expenses: [], invoices: [], customers: [],
        fahrten: [], materialEinkaeufe: [], eigenbelege: [],
    }, d || {});
    const Store = {
        getSettings:        () => daten.settings,
        getAllPurchasesRaw: () => daten.purchases,
        getAllSalesRaw:     () => daten.sales,
        getAllExpensesRaw:  () => daten.expenses,
        getRechInvoices:    () => daten.invoices,
        getRechCustomers:   () => daten.customers,
        getFahrten:            () => daten.fahrten,
        getMaterialEinkauefe:  () => daten.materialEinkaeufe,
        _syncReadRaw:       (k) => (k === 'co_test__eigenbelege_belege' ? daten.eigenbelege : []),
    };
    const localStorage = {
        getItem: (k) => (k === 'oyi_active_company' ? 'co_test' : null),
        setItem: () => {}, removeItem: () => {},
    };
    const Utils = { escapeHtml: (s) => String(s || '') };
    return new Function('Store', 'Utils', 'localStorage', 'StackrZip',
        datevSrc + '\n; return DatevExport;')(Store, Utils, localStorage, StackrZip);
}

const DATEN = {
    expenses: [
        { id: 'a1', datum: '2026-03-04', kategorie: 'Büro', betrag: 23.80, ustSatz: 19,
          belegNr: 'RE-2026-001', belegFoto: JPG },
        { id: 'a2', datum: '2026-04-01', kategorie: 'Versand', betrag: 5.00, ustSatz: 19,
          belegNr: 'RE-2026-002' },                                  // ohne Foto
        { id: 'a3', datum: '2025-12-30', kategorie: 'Büro', betrag: 9.00, ustSatz: 19,
          belegNr: 'ALT-1', belegFoto: JPG },                        // anderes Jahr
        { id: 'a4', datum: '2026-05-05', kategorie: 'Büro', betrag: 7.00, ustSatz: 19,
          belegNr: 'STORNO-1', belegFoto: JPG, storniert: true },     // storniert
    ],
    purchases: [
        // Einkaeufe tragen KEINE Belegnummer — das Formular in js/buchungen.js kennt kein
        // solches Feld. Im Stapel steht deshalb die Artikelnummer in Belegfeld 1, und das
        // Archiv muss dieselbe Zuordnung benutzen.
        { id: 'p1', datum: '2026-02-01', einkaufspreis: 20, ustSatz: 19, marke: 'Acme',
          artikeltyp: 'Regal', artikelNr: 'EK-7', belegFoto: PNG },
    ],
    eigenbelege: [
        { id: 'b1', belegDatum: '2026-06-06', belegNr: 'EB-3', bezeichnung: 'Parkgebühr',
          betragBrutto: 4.50, foto: JPG },
    ],
};

const D = lade(DATEN);

// ── 1. Was ins Archiv kommt ────────────────────────────────────────────────
const erg = D._belegeSammeln('2026');
const namen = erg.dateien.map(f => f.name).sort();

check('Drei Belege aus drei Quellen gefunden', erg.dateien.length === 3, namen);
check('Ausgabe liegt unter belege/ausgaben/',
    namen.some(n => n.indexOf('belege/ausgaben/') === 0), namen);
check('Wareneinkauf liegt unter belege/wareneinkauf/',
    namen.some(n => n.indexOf('belege/wareneinkauf/') === 0), namen);
check('Eigenbeleg liegt unter belege/eigenbelege/',
    namen.some(n => n.indexOf('belege/eigenbelege/') === 0), namen);

// ── 2. Die Verknuepfung zum Stapel ─────────────────────────────────────────
// Der Dateiname traegt die Belegnummer, und dieselbe Nummer steht im Stapel in Belegfeld 1.
// Ohne diese Uebereinstimmung ist das Archiv ein Haufen Bilder.
const stapel = D.buildCSV('2026', 'SKR03');
['RE-2026-001', 'EK-7', 'EB-3'].forEach(nr => {
    check('Belegnummer ' + nr + ' steht im Dateinamen',
        namen.some(n => n.indexOf(nr) !== -1), namen);
    check('Belegnummer ' + nr + ' steht auch im Buchungsstapel',
        stapel.indexOf(nr) !== -1);
});
check('Belegdatum steht im Dateinamen (sortierbar)',
    namen.every(n => /\/\d{4}-\d{2}-\d{2}_/.test(n)), namen);

// ── 3. Was NICHT ins Archiv gehoert ────────────────────────────────────────
check('Beleg ohne Foto erzeugt keine Datei', !namen.some(n => n.indexOf('RE-2026-002') !== -1), namen);
check('Beleg aus einem anderen Jahr bleibt draussen', !namen.some(n => n.indexOf('ALT-1') !== -1), namen);
check('Stornierter Beleg bleibt draussen', !namen.some(n => n.indexOf('STORNO-1') !== -1), namen);
check('Nichts als unlesbar gezaehlt', erg.ohne === 0, erg.ohne);

// ── 4. Endungen kommen aus dem Datentyp, nicht aus einer Annahme ───────────
// Ein "beleg.jpg", das in Wahrheit ein PNG ist, oeffnet der Berater nicht doppelklickend.
check('JPEG bekommt .jpg', namen.some(n => n.indexOf('RE-2026-001') !== -1 && /\.jpg$/.test(n)), namen);
check('PNG bekommt .png',  namen.some(n => n.indexOf('EK-7') !== -1 && /\.png$/.test(n)), namen);

// ── 5. Unlesbare Belege werden gezaehlt, nicht verschluckt ─────────────────
const kaputt = lade({
    expenses: [{ id: 'x', datum: '2026-01-01', kategorie: 'Büro', betrag: 1, ustSatz: 19,
                 belegNr: 'X-1', belegFoto: 'https://example.invalid/beleg.jpg' }],
});
const ergK = kaputt._belegeSammeln('2026');
check('Nicht-Data-URL erzeugt keine Datei', ergK.dateien.length === 0, ergK.dateien);
check('…wird aber gezaehlt', ergK.ohne === 1, ergK.ohne);

// ── 6. Dateinamen duerfen nicht ausbrechen ─────────────────────────────────
const boese = lade({
    expenses: [{ id: 'y', datum: '2026-01-01', kategorie: 'Büro', betrag: 1, ustSatz: 19,
                 belegNr: '../../etc/passwd', belegFoto: JPG }],
});
const nBoese = boese._belegeSammeln('2026').dateien[0].name;
check('Pfadtrenner in der Belegnummer werden entschaerft',
    nBoese.indexOf('..') === -1 && nBoese.indexOf('belege/ausgaben/') === 0, nBoese);

// ── 7. Das Archiv laesst sich wirklich bauen ───────────────────────────────
const archiv = StackrZip.build(
    [{ name: 'EXTF_Buchungsstapel_2026_SKR03.csv', data: stapel }]
        .concat(erg.dateien)
        .concat([{ name: 'LIESMICH.txt', data: D._liesmich('2026', 'SKR03', 'EXTF_x.csv', 3, 0) }]));
check('Archiv beginnt mit einem Local-File-Header',
    archiv[0] === 0x50 && archiv[1] === 0x4B && archiv[2] === 0x03);
const alsText = Buffer.from(archiv).toString('latin1');
check('Stapel liegt im Archiv', alsText.indexOf('EXTF_Buchungsstapel_2026_SKR03.csv') !== -1);
check('LIESMICH erklaert die Zuordnung ueber Belegfeld 1',
    D._liesmich('2026', 'SKR03', 'x.csv', 3, 0).indexOf('Belegfeld 1') !== -1);
check('LIESMICH nennt uebersprungene Belege, wenn es welche gab',
    D._liesmich('2026', 'SKR03', 'x.csv', 3, 2).indexOf('2 Beleg') !== -1);

console.log('\n' + pass + '/' + total + ' Tests bestanden' + (pass === total ? ' ✅' : ''));
