// js/import-lager.js: Pruefung der Lager-/Verkaeufe-Importzeilen, Dubletten, Periodensperre.
// Erfundene Beispieldaten. Echter Code: js/import-kern.js + js/import-lager.js.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');
const ctx = ladeModule(['js/import-kern.js', 'js/import-lager.js']);
const { ImportKern: K, LagerImport: L } = ctx;

// Arrays stammen aus dem vm-Kontext: ueber JSON vergleichen statt deepStrictEqual
const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
let fail = 0;
function check(name, fn) {
    try { fn(); console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}

const MAP = { datum: 'Datum', marke: 'Marke', beschreibung: 'Beschreibung', groesse: 'Größe', einkaufspreis: 'EK', artikelNr: 'Nr', anzahl: 'Anzahl', verkaufspreis: 'VK', verkaufsdatum: 'VK-Datum' };
const OPT = (extra) => Object.assign({ datum: '2026-03-01', quelle: 'Flohmarkt', bestand: [], gesperrt: () => false }, extra);
const zeile = (o) => Object.assign({ Datum: '', Marke: '', Beschreibung: '', 'Größe': '', EK: '', Nr: '', Anzahl: '', VK: '', 'VK-Datum': '' }, o);

// ── Einkaeufe ──
check('Einkauf: Normalfall mit DE-Zahl, Standarddatum und Quelle', () => {
    const e = L.einkaufsZeilen([zeile({ Marke: 'Nike', Beschreibung: 'Hoodie', EK: '1.234,56' })], MAP, OPT());
    assert.strictEqual(e.fehler.length, 0);
    assert.strictEqual(e.zeilen[0].row.einkaufspreis, 1234.56);
    assert.strictEqual(e.zeilen[0].row.datum, '2026-03-01');
    assert.strictEqual(e.zeilen[0].row.einkaufsquelle, 'Flohmarkt');
    assert.strictEqual(e.zeilen[0].dublette, false);
    assert.strictEqual(e.zeilen[0].importieren, true);
});

check('Einkauf: Fehlerfaelle mit Zeilennummer aus der Datei und Grund', () => {
    const rows = [zeile({ Marke: 'A', EK: 'abc' }), zeile({ Marke: 'B', EK: '-5' }), zeile({ EK: '5' }), zeile({ Marke: 'C', EK: '4,50' })];
    const e = L.einkaufsZeilen(rows, MAP, OPT({ nummern: [5, 6, 9, 12] }));
    eq(e.fehler.map(f => f.zeile), [5, 6, 9]);
    assert.ok(/EK-Preis fehlt/.test(e.fehler[0].grund));
    assert.ok(/negativ/.test(e.fehler[1].grund));
    assert.ok(/Marke und Beschreibung/.test(e.fehler[2].grund));
    assert.strictEqual(e.zeilen[0].zeile, 12);
});

check('Einkauf: ohne nummern gilt Zeile = Index + 2 (Kopfzeile 1)', () => {
    const e = L.einkaufsZeilen([zeile({ Marke: 'A', EK: 'x' })], MAP, OPT());
    assert.strictEqual(e.fehler[0].zeile, 2);
});

check('Einkauf: festgeschriebene Periode wird uebersprungen, offene nicht', () => {
    const gesperrt = d => d.startsWith('2025');
    const e = L.einkaufsZeilen([zeile({ Marke: 'A', EK: '5', Datum: '15.06.2025' }), zeile({ Marke: 'B', EK: '5', Datum: '15.06.2026' })], MAP, OPT({ gesperrt }));
    assert.strictEqual(e.fehler.length, 1);
    assert.ok(/^Periode festgeschrieben/.test(e.fehler[0].grund));
    assert.strictEqual(e.zeilen.length, 1);
});

check('Einkauf: Verkaufsdatum in festgeschriebener Periode -> Zeile uebersprungen', () => {
    const e = L.einkaufsZeilen([zeile({ Marke: 'A', EK: '5', VK: '9', 'VK-Datum': '01.02.2025' })], MAP, OPT({ gesperrt: d => d.startsWith('2025') }));
    assert.strictEqual(e.zeilen.length, 0);
    assert.ok(/Verkaufsdatum/.test(e.fehler[0].grund));
});

const BESTAND = [
    { id: 'p1', artikelNr: '2026-001', datum: '2026-03-01', marke: 'Nike', beschreibung: 'Hoodie', groesse: 'M', einkaufspreis: 12.5, status: 'verfuegbar' },
    { id: 'p2', artikelNr: 'SV-7', datum: '2026-03-02', marke: 'Adidas', beschreibung: 'Jacke', groesse: 'L', einkaufspreis: 20, status: 'verfuegbar' },
    { id: 'p3', artikelNr: '2026-003', datum: '2026-03-01', marke: 'Puma', beschreibung: 'Shirt', groesse: 'S', einkaufspreis: 5, storniert: true }
];

check('Einkauf: Dublette ueber Fingerabdruck (Normalisierung Gross/Klein/Leerzeichen)', () => {
    const e = L.einkaufsZeilen([zeile({ Marke: ' NIKE', Beschreibung: 'hoodie', 'Größe': 'm', EK: '12,50' })], MAP, OPT({ bestand: BESTAND }));
    assert.strictEqual(e.zeilen[0].dublette, true);
    assert.strictEqual(e.zeilen[0].importieren, false);
    assert.strictEqual(L.ausgewaehlt(e).length, 0);
});

check('Einkauf: zwei gleiche Zeilen, einer im Bestand -> #1 Dublette, #2 neu', () => {
    const r = zeile({ Marke: 'Nike', Beschreibung: 'Hoodie', 'Größe': 'M', EK: '12.5' });
    const e = L.einkaufsZeilen([r, r], MAP, OPT({ bestand: BESTAND }));
    eq(e.zeilen.map(z => z.dublette), [true, false]);
    assert.ok(/#1$/.test(e.zeilen[0].key) && /#2$/.test(e.zeilen[1].key));
});

check('Einkauf: anderer Preis oder anderes Datum ist keine Dublette', () => {
    const e = L.einkaufsZeilen([zeile({ Marke: 'Nike', Beschreibung: 'Hoodie', 'Größe': 'M', EK: '13' }), zeile({ Marke: 'Nike', Beschreibung: 'Hoodie', 'Größe': 'M', EK: '12,5', Datum: '2026-03-05' })], MAP, OPT({ bestand: BESTAND }));
    eq(e.zeilen.map(z => z.dublette), [false, false]);
});

check('Einkauf: stornierter Bestand zaehlt nicht als Dublette (Fingerabdruck), seine Nummer bleibt aber vergeben', () => {
    const a = L.einkaufsZeilen([zeile({ Marke: 'Puma', Beschreibung: 'Shirt', 'Größe': 'S', EK: '5' })], MAP, OPT({ bestand: BESTAND }));
    assert.strictEqual(a.zeilen[0].dublette, false);
    const b = L.einkaufsZeilen([zeile({ Marke: 'X', EK: '1', Nr: '2026-003' })], MAP, OPT({ bestand: BESTAND }));
    assert.strictEqual(b.zeilen[0].dublette, true);
});

check('Einkauf: Dublette ueber Artikelnummer, Gross/Klein egal, auch bei Menge mit -1', () => {
    const e = L.einkaufsZeilen([zeile({ Marke: 'X', EK: '1', Nr: 'sv-7' }), zeile({ Marke: 'Y', EK: '1', Nr: 'NEU-1' })], MAP, OPT({ bestand: BESTAND }));
    eq(e.zeilen.map(z => z.dublette), [true, false]);
    const mehrere = L.einkaufsZeilen([zeile({ Marke: 'X', EK: '1', Nr: 'K', Anzahl: '2' })], MAP, OPT({ bestand: [{ artikelNr: 'K-1', status: 'verfuegbar' }, { artikelNr: 'K-2', status: 'verfuegbar' }] }));
    assert.strictEqual(mehrere.zeilen[0].dublette, true);
});

check('Einkauf: Menge 2 mit einem Stueck im Bestand ist keine volle Dublette', () => {
    const e = L.einkaufsZeilen([zeile({ Marke: 'Nike', Beschreibung: 'Hoodie', 'Größe': 'M', EK: '12,5', Anzahl: '2' })], MAP, OPT({ bestand: BESTAND }));
    assert.strictEqual(e.zeilen[0].dublette, false);
});

check('Einkauf: Rundlauf – eigene Anlage nochmal importiert = nur Dubletten', () => {
    const rows = [zeile({ Marke: 'Nike', Beschreibung: 'Hoodie', EK: '12,5', Anzahl: '2' }), zeile({ Marke: 'Nike', Beschreibung: 'Hoodie', EK: '12,5' }), zeile({ Marke: 'Zara', Beschreibung: 'Kleid', EK: '8' })];
    const erst = L.einkaufsZeilen(rows, MAP, OPT());
    assert.strictEqual(erst.zeilen.filter(z => z.dublette).length, 0);
    const angelegt = [];
    erst.zeilen.forEach(z => { for (let i = 0; i < z.row.anzahl; i++) angelegt.push({ datum: z.row.datum, marke: z.row.marke, beschreibung: z.row.beschreibung, groesse: z.row.groesse, einkaufspreis: z.row.einkaufspreis, artikelNr: '2026-' + angelegt.length, status: 'verfuegbar' }); });
    const zweit = L.einkaufsZeilen(rows, MAP, OPT({ bestand: angelegt }));
    assert.strictEqual(zweit.zeilen.length, 3);
    assert.ok(zweit.zeilen.every(z => z.dublette), 'alle Dubletten');
    assert.strictEqual(L.ausgewaehlt(zweit).length, 0);
    zweit.zeilen[0].importieren = true;           // Nutzer setzt den Haken trotzdem
    assert.strictEqual(L.ausgewaehlt(zweit).length, 1);
});

check('Einkauf: Lagerort, Warenkategorie, Tags (Komma, ohne Doppelte), Notizen', () => {
    const map = Object.assign({ lagerBereich: 'Bereich', lagerRegal: 'Regal', lagerFach: 'Fach', warenkategorie: 'WK', tags: 'Tags', notizen: 'Notiz' }, MAP);
    const r = zeile({ Marke: 'Nike', EK: '5', Bereich: ' Keller ', Regal: 'R2', Fach: '7', WK: 'Kleidung', Tags: 'Vintage, nike ,, vintage, Y2K', Notiz: 'Fleck am Aermel' });
    const z = L.einkaufsZeilen([r], map, OPT()).zeilen[0].row;
    eq(z.lagerort, { bereich: 'Keller', regal: 'R2', fach: '7' });
    assert.strictEqual(z.warenkategorie, 'Kleidung');
    eq(z.tags, ['Vintage', 'nike', 'Y2K']);
    assert.strictEqual(z.notizen, 'Fleck am Aermel');
});

check('Einkauf: ohne diese Spalten bleiben die Felder leer (alte Dateien gueltig)', () => {
    const z = L.einkaufsZeilen([zeile({ Marke: 'Nike', EK: '5' })], MAP, OPT()).zeilen[0].row;
    eq(z.lagerort, { bereich: '', regal: '', fach: '' });
    eq(z.tags, []);
    assert.strictEqual(z.notizen, '');
});

check('Einkauf mit Verkauf: Gebuehr in EUR wird in Prozent umgerechnet, Prozent-Spalte hat Vorrang', () => {
    const map = Object.assign({ gebuehrEur: 'G', gebuehrProzent: 'P', versandKaeufer: 'V', verkaufsplattform: 'Pl', kaeufer: 'K' }, MAP);
    const r = zeile({ Marke: 'A', EK: '5', VK: '20', G: '1,00', V: '4', Pl: 'eBay', K: 'Erika' });
    const z = L.einkaufsZeilen([r], map, OPT()).zeilen[0].row;
    assert.strictEqual(z.gebuehrProzent, 4.17);
    assert.strictEqual(z.verkaufsplattform, 'eBay'); assert.strictEqual(z.kaeufer, 'Erika');
    const mitProzent = L.einkaufsZeilen([Object.assign({}, r, { P: '10' })], map, OPT()).zeilen[0].row;
    assert.strictEqual(mitProzent.gebuehrProzent, 10);
    const unverkauft = L.einkaufsZeilen([zeile({ Marke: 'A', EK: '5', G: '1' })], map, OPT()).zeilen[0].row;
    assert.strictEqual(unverkauft.gebuehrProzent, 0);
    assert.strictEqual(L.gebuehrProzent(1, 0, 0), 0);
});

check('Vorlage: BOM, Semikolon, 22 Spalten in Kopf und Beispielzeilen', () => {
    const t = L.vorlageCsv();
    assert.strictEqual(t.charCodeAt(0), 0xFEFF);
    const zeilen = t.slice(1).split('\r\n').filter(Boolean);
    assert.strictEqual(zeilen.length, 3);
    zeilen.forEach(z => assert.strictEqual(z.split(';').length, 22));
    assert.strictEqual(zeilen[0].split(';')[5], 'Größe');
});

// ── Verkaeufe ──
const SMAP = { datum: 'Datum', beschreibung: 'Titel', preis: 'Preis', gebuehr: 'Gebühr', versandKaeufer: 'Versand' };
const srow = (o) => Object.assign({ Datum: '', Titel: '', Preis: '', 'Gebühr': '', Versand: '' }, o);
const artNrMap = { '2026-001': BESTAND[0] };
const matcher = (titel) => /2026-001/.test(String(titel).toUpperCase()) ? '2026-001' : null;
const SOPT = (extra) => Object.assign({ plattform: 'Vinted', purchases: BESTAND, sales: [], gesperrt: () => false, einkaufGesperrt: () => false, findArtNr: matcher, artNrMap }, extra);

check('Verkauf: Normalfall, Gebuehr in Prozent, Lager-Match', () => {
    const e = L.verkaufsZeilen([srow({ Datum: '10.03.2026', Titel: 'Hoodie 2026-001', Preis: '20,00', 'Gebühr': '1,00', Versand: '4,00' })], SMAP, SOPT());
    const z = e.zeilen[0];
    assert.strictEqual(z.sale.datum, '2026-03-10');
    assert.strictEqual(z.sale.plattformgebuehrProzent, 4.17);
    assert.strictEqual(z.sale.purchaseId, 'p1');
    assert.strictEqual(z.purchase.id, 'p1');
    assert.strictEqual(z.statusGesperrt, false);
});

check('Verkauf: Fehlerfaelle mit Zeilennummer und Grund', () => {
    const e = L.verkaufsZeilen([srow({ Titel: 'a', Preis: '5' }), srow({ Datum: '2026-03-10', Titel: 'b', Preis: '0' }), srow({ Datum: '2026-03-10', Titel: 'c', Preis: '5' })], SMAP, SOPT({ nummern: [2, 3, 7] }));
    eq(e.fehler.map(f => f.zeile), [2, 3]);
    assert.ok(/Datum/.test(e.fehler[0].grund) && /Preis/.test(e.fehler[1].grund));
    assert.strictEqual(e.zeilen[0].zeile, 7);
});

check('Verkauf: festgeschriebene Periode wird uebersprungen', () => {
    const e = L.verkaufsZeilen([srow({ Datum: '2025-12-30', Titel: 'x', Preis: '9' })], SMAP, SOPT({ gesperrt: d => d.startsWith('2025') }));
    assert.strictEqual(e.zeilen.length, 0);
    assert.ok(/^Periode festgeschrieben/.test(e.fehler[0].grund));
});

check('Verkauf: gesperrter Einkauf -> statusGesperrt, Zeile bleibt importierbar', () => {
    const e = L.verkaufsZeilen([srow({ Datum: '2026-03-10', Titel: 'Hoodie 2026-001', Preis: '20' })], SMAP, SOPT({ einkaufGesperrt: () => true }));
    assert.strictEqual(e.zeilen[0].statusGesperrt, true);
    assert.strictEqual(e.zeilen[0].importieren, true);
});

check('Verkauf: Dublette gegen vorhandenen Verkauf (ohne Lager-Match, ueber Titel)', () => {
    const sales = [{ datum: '2026-03-11', verkaufspreis: 15, beschreibung: 'Rotes Kleid', verkaufsplattform: 'Vinted' }];
    const r = srow({ Datum: '11.03.2026', Titel: 'rotes  kleid', Preis: '15' });
    const e = L.verkaufsZeilen([r, r], SMAP, SOPT({ sales }));
    eq(e.zeilen.map(z => z.dublette), [true, false]);
});

check('Verkauf: Dublette mit Lager-Match (gespeicherte Beschreibung ist die des Artikels)', () => {
    const sales = [{ datum: '2026-03-10', verkaufspreis: 20, purchaseId: 'p1', beschreibung: 'Hoodie', verkaufsplattform: 'Vinted' }];
    const e = L.verkaufsZeilen([srow({ Datum: '2026-03-10', Titel: 'Nike Hoodie 2026-001', Preis: '20' })], SMAP, SOPT({ sales }));
    assert.strictEqual(e.zeilen[0].dublette, true);
});

check('Verkauf: andere Plattform oder stornierter Verkauf = keine Dublette', () => {
    const sales = [{ datum: '2026-03-11', verkaufspreis: 15, beschreibung: 'Kleid', verkaufsplattform: 'eBay' }, { datum: '2026-03-12', verkaufspreis: 9, beschreibung: 'Hose', verkaufsplattform: 'Vinted', storniert: true }];
    const e = L.verkaufsZeilen([srow({ Datum: '2026-03-11', Titel: 'Kleid', Preis: '15' }), srow({ Datum: '2026-03-12', Titel: 'Hose', Preis: '9' })], SMAP, SOPT({ sales }));
    eq(e.zeilen.map(z => z.dublette), [false, false]);
});

// ── Vorschau ──
check('vorschauHtml: Zaehler, Dublettenliste ohne Haken, Fehlerliste, HTML maskiert', () => {
    const e = L.einkaufsZeilen([zeile({ Marke: 'Nike', Beschreibung: 'Hoodie', 'Größe': 'M', EK: '12,5' }), zeile({ Marke: '<b>X</b>', EK: 'zzz' })], MAP, OPT({ bestand: BESTAND }));
    const h = L.vorschauHtml(e);
    assert.ok(/imp-dup/.test(h) && !/checked/.test(h));
    assert.ok(/Zeile 3: EK-Preis/.test(h));
    assert.ok(!/<b>X/.test(h));
});

// ── Meldung / Fehlerdatei ──
check('nichtImportiert: Fehler + abgewaehlte Dubletten, nach Zeile sortiert; Haken nimmt die Dublette heraus', () => {
    const rows = [zeile({ Marke: 'Nike', Beschreibung: 'Hoodie', 'Größe': 'M', EK: '12,5' }), zeile({ Marke: 'Q', EK: 'x' }), zeile({ Marke: 'Neu', EK: '1' })];
    const e = L.einkaufsZeilen(rows, MAP, OPT({ bestand: BESTAND, nummern: [7, 3, 9] }));
    const liste = L.nichtImportiert(e);
    eq(liste.map(f => f.zeile), [3, 7]);
    assert.ok(/^Dublette/.test(liste[1].grund) && /^EK-Preis/.test(liste[0].grund));
    e.zeilen[0].importieren = true;
    eq(L.nichtImportiert(e).map(f => f.zeile), [3]);
});

check('berichtHtml: Kopf, Liste mit Zeilennummer, Fehlerdatei-Knopf nur bei Meldungen', () => {
    const e = L.einkaufsZeilen([zeile({ Marke: 'Q', EK: 'x' })], MAP, OPT({ nummern: [4] }));
    const h = L.berichtHtml(e, '3 Artikel importiert');
    assert.ok(/3 Artikel importiert/.test(h) && /Zeile 4: EK-Preis/.test(h) && /imp-fehlerdatei/.test(h));
    const leer = L.berichtHtml({ zeilen: [], fehler: [] }, 'ok');
    assert.ok(!/imp-fehlerdatei/.test(leer));
});

if (fail) { console.log(fail + ' fehlgeschlagen'); process.exit(1); }
console.log('alle ok');
