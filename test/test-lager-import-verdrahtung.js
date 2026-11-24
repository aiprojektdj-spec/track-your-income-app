// Verdrahtung lager/page.js (ExcelImport, SalesImport) <-> js/import-lager.js, ohne Browser.
// Die beiden Objekte werden unveraendert aus dem Quelltext geholt und gegen einen Store-/DOM-Stub
// gefahren: Vorschau, Dublettenabwahl, Periodensperre, Statusschutz am gesperrten Einkauf.
// (Der Browser-Test scheitert lokal am Whop-Gate; dieser Test deckt die Anbindung ab.)
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ladeModule } = require('./_lade-module');

let fail = 0;
async function check(name, fn) {
    try { await fn(); console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.stack)); }
}

const src = fs.readFileSync(path.join(__dirname, '..', 'lager', 'page.js'), 'utf8');
function holeObjekt(name) {
    const i = src.indexOf('const ' + name + ' = {');
    const j = src.indexOf('window.' + name + ' = ' + name + ';', i);
    assert.ok(i !== -1 && j !== -1, name + ' nicht gefunden');
    return src.slice(i, j).replace('const ' + name, 'var ' + name);
}

function welt(store) {
    const el = {};
    const get = id => el[id] || (el[id] = { id, innerHTML: '', value: '', style: {}, disabled: false, textContent: '', querySelectorAll: () => [], addEventListener() {} });
    el.excelDatum = get('excelDatum'); el.excelDatum.value = '2026-03-01';
    el.excelQuelle = get('excelQuelle'); el.excelQuelle.value = 'Flohmarkt';
    const toasts = [], modale = [], downloads = [];
    const document = { getElementById: get, querySelectorAll: () => [] };
    const Utils = { downloadFile: (inhalt, name) => downloads.push({ inhalt, name }), showToast: (m, t) => toasts.push([t, m]), escapeHtml: s => String(s == null ? '' : s), formatCurrency: n => String(n) };
    const App = { closeModal() { modale.push('zu'); }, showModal: (titel, body) => modale.push({ titel, body }) };
    const kern = ladeModule(['js/import-kern.js', 'js/import-lager.js'], { document, Utils, App });
    const ctx = vm.createContext({
        console, Math, Date, JSON, Set, Map, Promise, setTimeout,
        ImportKern: kern.ImportKern, LagerImport: kern.LagerImport,
        document, Utils, Store: store, App, Lager: { _filters: {} }, renderPage() {}, confirm: () => true,
        window: {}
    });
    vm.runInContext(holeObjekt('ExcelImport') + '\n' + holeObjekt('SalesImport'), ctx);
    return { ctx, el, toasts, modale, downloads };
}

function storeStub(opt) {
    const daten = { purchases: opt.purchases || [], sales: opt.sales || [] };
    const gesperrt = opt.gesperrt || (() => false);
    return {
        daten,
        getAllPurchasesRaw: () => daten.purchases, getPurchases: () => daten.purchases,
        getAllSalesRaw: () => daten.sales, get: k => daten[k],
        setAsync: async (k, v) => { daten[k] = v; },
        isPeriodLocked: gesperrt, isLocked: p => !!p.gesperrt,
        generateId: (() => { let n = 0; return () => 'id' + (++n); })(),
        addBrand() {}, addPlatform() {}, addEinkaufsquelle() {}
    };
}

(async () => {
    await check('ExcelImport: Dubletten vorab abgewaehlt, Import legt nur Neues an, uebersprungene Zeilen gemeldet', async () => {
        const bestand = [{ id: 'p1', artikelNr: '2026-001', datum: '2026-03-01', marke: 'Nike', beschreibung: 'Hoodie', groesse: 'M', einkaufspreis: 12.5, status: 'verfuegbar' }];
        const store = storeStub({ purchases: bestand });
        const { ctx, el, modale, downloads } = welt(store);
        const X = ctx.ExcelImport;
        X._columns = ['Marke', 'Beschreibung', 'Größe', 'EK'];
        X._rows = [
            { Marke: 'Nike', Beschreibung: 'Hoodie', 'Größe': 'M', EK: '12,50' },   // Dublette
            { Marke: 'Zara', Beschreibung: 'Kleid', 'Größe': 'S', EK: '8' },        // neu
            { Marke: 'Zara', Beschreibung: 'Rock', 'Größe': 'S', EK: 'kaputt' }     // Fehler
        ];
        X._nummern = [4, 5, 6];
        X._mapping = { marke: 'Marke', beschreibung: 'Beschreibung', groesse: 'Größe', einkaufspreis: 'EK' };
        X._renderPreview();
        assert.ok(/imp-dup/.test(el.excelPreview.innerHTML));
        assert.ok(/Zeile 6: EK-Preis/.test(el.excelPreview.innerHTML));
        await X._import();
        assert.strictEqual(store.daten.purchases.length, 2, 'ein neuer Artikel');
        assert.strictEqual(store.daten.purchases[1].marke, 'Zara');
        // Ergebnisfenster statt stillem Schliessen, mit Zeilennummern aus der Datei
        const bericht = modale.find(m => m && m.titel === 'Import-Ergebnis');
        assert.ok(bericht, 'Ergebnisfenster');
        assert.ok(/Zeile 6: EK-Preis/.test(bericht.body) && /Zeile 4: Dublette/.test(bericht.body));
        // Fehlerdatei: UTF-8-BOM, Semikolon, Kopfzeile, Zeilen wie in der Datei
        ctx.LagerImport.verdrahte({ querySelectorAll: s => s === '.imp-fehlerdatei' ? [{ addEventListener: (_, f) => f() }] : [] }, X._erg);
        assert.strictEqual(downloads.length, 1);
        assert.strictEqual(downloads[0].name, 'import-fehler.csv');
        assert.strictEqual(downloads[0].inhalt.charCodeAt(0), 0xFEFF);
        const csv = downloads[0].inhalt.slice(1).split('\r\n');
        assert.strictEqual(csv[0], 'Zeile;Grund');
        assert.ok(/^4;Dublette/.test(csv[1]) && /^6;EK-Preis/.test(csv[2]), csv.join(' | '));
    });

    await check('ExcelImport: Lagerort, Warenkategorie, Tags und Notizen landen am Artikel', async () => {
        const store = storeStub({});
        const kategorien = [];
        store.addWarenkategorie = k => kategorien.push(k);
        const { ctx } = welt(store);
        const X = ctx.ExcelImport;
        const spalten = ['Marke', 'EK', 'Lagerort', 'Regal', 'Fach', 'Warenkategorie', 'Tags', 'Bemerkung'];
        const m = X._autoDetect(spalten);
        assert.strictEqual(m.lagerBereich, 'Lagerort'); assert.strictEqual(m.lagerRegal, 'Regal'); assert.strictEqual(m.lagerFach, 'Fach');
        assert.strictEqual(m.warenkategorie, 'Warenkategorie'); assert.strictEqual(m.tags, 'Tags'); assert.strictEqual(m.notizen, 'Bemerkung');
        X._columns = spalten; X._mapping = m;
        X._rows = [{ Marke: 'Nike', EK: '5', Lagerort: 'Keller', Regal: 'R2', Fach: '7', Warenkategorie: 'Kleidung', Tags: 'a, b', Bemerkung: 'ok' }];
        X._renderPreview();
        await X._import();
        const p = store.daten.purchases[0];
        assert.strictEqual(JSON.stringify(p.lagerort), JSON.stringify({ bereich: 'Keller', regal: 'R2', fach: '7' }));
        assert.strictEqual(p.warenkategorie, 'Kleidung');
        assert.strictEqual(JSON.stringify(p.tags), JSON.stringify(['a', 'b']));
        assert.strictEqual(p.notizen, 'ok');
        assert.strictEqual(JSON.stringify(kategorien), JSON.stringify(['Kleidung']));
    });

    await check('Vorlage (Einzeilen-Format): alle Spalten erkannt, Verkauf in derselben Zeile, zweiter Import = nur Dubletten', async () => {
        const store = storeStub({});
        const { ctx, el } = welt(store);
        const X = ctx.ExcelImport;
        const csv = ctx.LagerImport.vorlageCsv();
        assert.strictEqual(csv.charCodeAt(0), 0xFEFF);
        const XLSX = require(path.join(__dirname, '..', 'js', 'vendor', 'xlsx.full.min.js'));
        const wb = XLSX.read(new TextEncoder().encode(csv), { type: 'array', codepage: 65001 });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
        const spalten = Object.keys(rows[0]);
        assert.strictEqual(JSON.stringify(spalten), JSON.stringify(Array.from(ctx.LagerImport.EINZEILEN_SPALTEN)));
        const m = X._autoDetect(spalten);
        const zugeordnet = new Set(Object.values(m).filter(Boolean));
        spalten.forEach(c => assert.ok(zugeordnet.has(c), 'Spalte nicht erkannt: ' + c));
        X._columns = spalten; X._mapping = m; X._rows = rows;
        X._renderPreview();
        assert.strictEqual(X._erg.fehler.length, 0);
        await X._import();
        const [a, b] = store.daten.purchases;
        assert.strictEqual(a.artikelNr, 'BSP-001'); assert.strictEqual(a.lagerort.regal, 'R1'); assert.strictEqual(a.status, 'verfuegbar');
        assert.strictEqual(b.status, 'verkauft');
        assert.strictEqual(store.daten.sales.length, 1);
        const v = store.daten.sales[0];
        assert.strictEqual(v.datum, '2026-02-03'); assert.strictEqual(v.verkaufsplattform, 'Vinted'); assert.strictEqual(v.kaeufer, 'Max Muster');
        assert.strictEqual(v.verkaufspreis, 25); assert.strictEqual(v.versandkostenKaeufer, 3.9); assert.strictEqual(v.versandkostenVerkaufer, 3.9);
        assert.strictEqual(v.plattformgebuehrProzent, 4.33);       // 1,25 / (25 + 3,90)
        X._renderPreview();
        assert.ok(X._erg.zeilen.every(z => z.dublette) && X._erg.zeilen.length === 2, 'zweiter Import: nur Dubletten');
    });

    await check('ExcelImport: Haken an der Dublette importiert sie doch', async () => {
        const bestand = [{ id: 'p1', artikelNr: '2026-001', datum: '2026-03-01', marke: 'Nike', beschreibung: 'Hoodie', groesse: '', einkaufspreis: 12.5, status: 'verfuegbar' }];
        const store = storeStub({ purchases: bestand });
        const { ctx } = welt(store);
        const X = ctx.ExcelImport;
        X._columns = ['Marke', 'Beschreibung', 'EK'];
        X._rows = [{ Marke: 'Nike', Beschreibung: 'Hoodie', EK: '12,5' }];
        X._mapping = { marke: 'Marke', beschreibung: 'Beschreibung', einkaufspreis: 'EK' };
        X._renderPreview();
        X._erg.zeilen[0].importieren = true;
        await X._import();
        assert.strictEqual(store.daten.purchases.length, 2);
    });

    await check('ExcelImport: Zeile in festgeschriebener Periode wird nicht angelegt', async () => {
        const store = storeStub({ gesperrt: d => d.startsWith('2025') });
        const { ctx } = welt(store);
        const X = ctx.ExcelImport;
        X._columns = ['Datum', 'Marke', 'EK'];
        X._rows = [{ Datum: '03.04.2025', Marke: 'Alt', EK: '5' }, { Datum: '03.04.2026', Marke: 'Neu', EK: '5' }];
        X._mapping = { datum: 'Datum', marke: 'Marke', einkaufspreis: 'EK' };
        X._renderPreview();
        assert.ok(/Periode festgeschrieben/.test(ctx.document.getElementById('excelPreview').innerHTML));
        await X._import();
        assert.strictEqual(JSON.stringify(store.daten.purchases.map(p => p.marke)), JSON.stringify(['Neu']));
    });

    await check('SalesImport: Dublette ausgelassen, gesperrter Einkauf behaelt seinen Status', async () => {
        const einkaeufe = [
            { id: 'p1', artikelNr: '2026-001', status: 'verfuegbar', gesperrt: true, datum: '2025-05-01' },
            { id: 'p2', artikelNr: '2026-002', status: 'verfuegbar', datum: '2026-02-01' }
        ];
        const store = storeStub({ purchases: einkaeufe, sales: [{ datum: '2026-03-12', verkaufspreis: 9, beschreibung: 'Hose', verkaufsplattform: 'Vinted' }] });
        const { ctx, el } = welt(store);
        const S = ctx.SalesImport;
        S._platform = 'Vinted';
        S._columns = ['Datum', 'Titel', 'Preis'];
        S._rows = [
            { Datum: '10.03.2026', Titel: 'Artikel 2026-001', Preis: '20' },
            { Datum: '11.03.2026', Titel: 'Artikel 2026-002', Preis: '15,50' },
            { Datum: '12.03.2026', Titel: 'Hose', Preis: '9' }       // Dublette
        ];
        S._mapping = { datum: 'Datum', beschreibung: 'Titel', preis: 'Preis' };
        S._renderPreview();
        assert.ok(/Status bleibt unverändert/.test(el.salesStats.innerHTML));
        assert.ok(/imp-dup/.test(el.salesStats.innerHTML));
        await S._import();
        assert.strictEqual(store.daten.sales.length, 3, '2 neue + 1 vorhandene');
        const nachId = Object.fromEntries(store.daten.purchases.map(p => [p.id, p]));
        assert.strictEqual(nachId.p1.status, 'verfuegbar', 'gesperrter Einkauf unveraendert');
        assert.strictEqual(nachId.p2.status, 'verkauft');
    });

    await check('SalesImport: Verkauf in festgeschriebener Periode wird uebersprungen', async () => {
        const store = storeStub({ gesperrt: d => d.startsWith('2025') });
        const { ctx } = welt(store);
        const S = ctx.SalesImport;
        S._platform = 'eBay';
        S._columns = ['Datum', 'Titel', 'Preis'];
        S._rows = [{ Datum: '2025-12-31', Titel: 'Alt', Preis: '5' }, { Datum: '2026-01-02', Titel: 'Neu', Preis: '5' }];
        S._mapping = { datum: 'Datum', beschreibung: 'Titel', preis: 'Preis' };
        S._renderPreview();
        await S._import();
        assert.strictEqual(JSON.stringify(store.daten.sales.map(s => s.beschreibung)), JSON.stringify(['Neu']));
    });

    if (fail) { console.log(fail + ' fehlgeschlagen'); process.exit(1); }
    console.log('alle ok');
})();
