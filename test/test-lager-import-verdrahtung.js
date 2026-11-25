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
        isPeriodLocked: gesperrt,
        // wie js/store.js: storniert / gegengebucht / manuell gesperrt / Periode (Datum des Datensatzes)
        isLocked: p => !!(p.storniert || p.gegengebucht || p.gesperrt || gesperrt(p.datum || p.anschaffungsdatum || '')),
        audit: [], _addAuditEntriesBatch(items) { this.audit.push(...items); },
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

    await check('Rundlauf: Einzeilen-Export -> Excel-Import = 0 neue Zeilen (alles Dubletten)', async () => {
        const einkaeufe = [
            { id: 'p1', artikelNr: '2026-001', datum: '2026-01-10', marke: 'Nike', beschreibung: 'Hoodie "Retro"', groesse: 'M', artikeltyp: 'Pullover', einkaufspreis: 12.5, einkaufsquelle: 'Flohmarkt', status: 'verkauft',
              lagerort: { bereich: 'Keller', regal: 'R1', fach: '2' }, warenkategorie: 'Kleidung', tags: ['Vintage', 'Nike'], notizen: 'Fleck; links' },
            { id: 'p2', artikelNr: '2026-002', datum: '2026-01-11', marke: 'Zara', beschreibung: 'Kleid', groesse: 'S', einkaufspreis: 8, status: 'verfuegbar', lagerort: {} },
            { id: 'p3', artikelNr: '2026-003', datum: '2026-01-12', marke: 'H&M', beschreibung: 'Set A', einkaufspreis: 3, status: 'verkauft' },
            { id: 'p4', artikelNr: '2026-004', datum: '2026-01-12', marke: 'H&M', beschreibung: 'Set B', einkaufspreis: 3, status: 'verkauft' },
            { id: 'p5', artikelNr: '2026-005', datum: '2026-01-13', marke: 'Alt', beschreibung: 'storniert', einkaufspreis: 1, storniert: true },
            { id: 'p6', artikelNr: '', datum: '2026-01-14', marke: 'Ohne', beschreibung: 'Nummer', groesse: 'L', einkaufspreis: 4.5, status: 'verfuegbar' },
            { id: 'p7', artikelNr: '2026-007', datum: '2026-01-15', marke: 'X', beschreibung: '=HYPERLINK("http://boese")', einkaufspreis: 2, status: 'verfuegbar' }
        ];
        const verkaeufe = [
            { id: 's1', purchaseId: 'p1', datum: '2026-02-01', verkaufspreis: 25, versandkostenKaeufer: 3.9, versandkostenVerkaufer: 3.9, plattformgebuehrProzent: 4.33, verkaufsplattform: 'Vinted', kaeufer: 'Erika' },
            { id: 's2', purchaseIds: ['p3', 'p4'], datum: '2026-02-02', verkaufspreis: 10.01, versandkostenKaeufer: 0, versandkostenVerkaufer: 0, plattformgebuehrProzent: 10, verkaufsplattform: 'eBay' },
            { id: 's3', purchaseId: 'p2', datum: '2026-02-03', verkaufspreis: 9, storniert: true }
        ];
        const store = storeStub({});
        const { ctx } = welt(store);
        const L = ctx.LagerImport;
        const e = L.einzeilenExport(einkaeufe, verkaeufe);
        assert.strictEqual(e.zeilen.length, 6, 'stornierter Artikel entfaellt');
        // Sammelverkauf: 10,01 auf zwei Artikel, Cent-Rest auf den ersten
        const preise = e.zeilen.filter(z => /Set/.test(z[3])).map(z => z[16]);
        assert.strictEqual(JSON.stringify(preise), JSON.stringify(['5.00', '5.01']));
        assert.strictEqual(e.zeilen[0][18], '1.25');                 // (25 + 3,90) * 4,33 %
        assert.ok(/^'=HYPERLINK/.test(e.zeilen[5][3]), 'Formel-Schutz');
        const csv = L.einzeilenCsv(einkaeufe, verkaeufe);
        assert.strictEqual(csv.charCodeAt(0), 0xFEFF);
        const XLSX = require(path.join(__dirname, '..', 'js', 'vendor', 'xlsx.full.min.js'));
        const wb = XLSX.read(new TextEncoder().encode(csv), { type: 'array', codepage: 65001 });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
        assert.strictEqual(rows.length, 6);
        // Import in den Bestand, aus dem exportiert wurde: nichts Neues
        const bestandStore = storeStub({ purchases: einkaeufe, sales: verkaeufe });
        const { ctx: ctx2 } = welt(bestandStore);
        const X = ctx2.ExcelImport;
        X._columns = Object.keys(rows[0]); X._mapping = X._autoDetect(X._columns); X._rows = rows;
        X._renderPreview();
        assert.strictEqual(X._erg.fehler.length, 0);
        assert.strictEqual(X._erg.zeilen.length, 6);
        assert.strictEqual(X._erg.zeilen.filter(z => !z.dublette).length, 0, 'keine neuen Zeilen');
        // Import in einen leeren Bestand legt alles wieder an (6 Artikel, 4 davon mit eigener Nummer verkauft = 3 Verkaeufe)
        const leer = storeStub({});
        const { ctx: ctx3 } = welt(leer);
        const Y = ctx3.ExcelImport;
        Y._columns = Object.keys(rows[0]); Y._mapping = Y._autoDetect(Y._columns); Y._rows = rows;
        Y._renderPreview();
        assert.strictEqual(Y._erg.zeilen.filter(z => z.dublette).length, 0);
        await Y._import();
        assert.strictEqual(leer.daten.purchases.length, 6);
        assert.strictEqual(leer.daten.purchases.filter(p => p.status === 'verkauft').length, 3);
        assert.strictEqual(leer.daten.sales.length, 3);
        const hoodie = leer.daten.purchases.find(p => p.artikelNr === '2026-001');
        assert.strictEqual(hoodie.beschreibung, 'Hoodie "Retro"');
        assert.strictEqual(hoodie.notizen, 'Fleck; links');
        assert.strictEqual(JSON.stringify(hoodie.tags), JSON.stringify(['Vintage', 'Nike']));
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

    await check('SalesImport: Einkauf in festgeschriebener Periode, Verkauf offen -> Status verkauft, nur Status, mit Audit', async () => {
        const einkaeufe = [
            { id: 'p1', artikelNr: '2025-001', status: 'verfuegbar', datum: '2025-05-01', einkaufspreis: 10, marke: 'A' },
            { id: 'p2', artikelNr: '2025-002', status: 'verfuegbar', datum: '2025-05-01', einkaufspreis: 10, marke: 'B', gegengebucht: true },
            { id: 'p3', artikelNr: '2025-003', status: 'verfuegbar', datum: '2025-05-01', einkaufspreis: 10, marke: 'C', gesperrt: true }
        ];
        const store = storeStub({ purchases: einkaeufe, gesperrt: d => d.startsWith('2025') });
        const { ctx } = welt(store);
        const S = ctx.SalesImport;
        S._platform = 'Vinted';
        S._columns = ['Datum', 'Titel', 'Preis'];
        S._rows = [
            { Datum: '2026-01-10', Titel: 'Artikel 2025-001', Preis: '20' },
            { Datum: '2026-01-11', Titel: 'Artikel 2025-002', Preis: '20' },
            { Datum: '2026-01-12', Titel: 'Artikel 2025-003', Preis: '20' },
            { Datum: '2025-12-30', Titel: 'Artikel 2025-001', Preis: '20' }     // Verkauf selbst gesperrt
        ];
        S._mapping = { datum: 'Datum', beschreibung: 'Titel', preis: 'Preis' };
        S._renderPreview();
        assert.strictEqual(S._erg.fehler.length, 1);
        assert.ok(/^Periode festgeschrieben/.test(S._erg.fehler[0].grund));
        await S._import();
        assert.strictEqual(store.daten.sales.length, 3, 'drei Verkaeufe, der in gesperrter Periode entfaellt');
        const p = Object.fromEntries(store.daten.purchases.map(x => [x.id, x]));
        assert.strictEqual(p.p1.status, 'verkauft', 'nur Periode gesperrt: Status erlaubt');
        assert.strictEqual(p.p1.datum, '2025-05-01'); assert.strictEqual(p.p1.einkaufspreis, 10); assert.strictEqual(p.p1.marke, 'A');
        assert.strictEqual(p.p2.status, 'verfuegbar', 'gegengebucht bleibt gesperrt');
        assert.strictEqual(p.p3.status, 'verfuegbar', 'manuell gesperrt bleibt gesperrt');
        const eintrag = store.audit.find(a => a.entityId === 'p1' && a.action === 'status_geaendert');
        assert.ok(eintrag && /festgeschriebener Periode/.test(eintrag.details), 'Audit-Eintrag mit Hinweis');
        assert.strictEqual(eintrag.oldValues.status, 'verfuegbar');
        assert.ok(!store.audit.some(a => a.entityId === 'p2' && a.action === 'status_geaendert'));
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

    await check('SalesImport: Spaltennamen aus IMPORT-FORMATE.md werden auf jeder Plattform erkannt', async () => {
        const { ctx } = welt(storeStub({}));
        const spalten = ['Datum', 'Titel', 'Preis', 'Gebühr (€)', 'Versand Käufer', 'Versand Verkäufer', 'Käufer'];
        ['Vinted', 'eBay', 'Sonstige'].forEach(pf => {
            const m = ctx.SalesImport._autoDetect(spalten, pf);
            assert.strictEqual(m.gebuehr, 'Gebühr (€)', pf);
            assert.strictEqual(m.versandKaeufer, 'Versand Käufer', pf);
            assert.strictEqual(m.versandVk, 'Versand Verkäufer', pf);
            assert.strictEqual(m.kaeufer, 'Käufer', pf);
        });
        // Plattform-eigene Spalte hat Vorrang
        assert.strictEqual(ctx.SalesImport._autoDetect(['Datum', 'Fee', 'Gebühr (€)'], 'Vinted').gebuehr, 'Fee');
    });

    if (fail) { console.log(fail + ' fehlgeschlagen'); process.exit(1); }
    console.log('alle ok');
})();
