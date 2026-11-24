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
