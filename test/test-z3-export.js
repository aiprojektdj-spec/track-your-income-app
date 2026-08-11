// Datenträgerüberlassung Z3 (GDPdU/IDEA):  node test/test-z3-export.js
//
// Fund T2 (Steuer-Vergleich 2026-08-10): §147 Abs. 6 AO gibt dem Prüfer das Recht, die
// steuerrelevanten Daten in maschinell auswertbarer Form zu VERLANGEN — in der Praxis der
// GDPdU-/IDEA-Export (index.xml + je Tabelle eine CSV). Die Suche nach gdpdu/index.xml/Z1/Z2/Z3
// im Projekt ergab null Treffer; mit PDF, Excel und JSON kann die Prüfsoftware nichts anfangen.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'protokoll.js'), 'utf8');

// Protokoll ist ein Objektliteral ohne module.exports. Store/Utils/localStorage werden gestubbt,
// die Downloads abgefangen.
function load(data) {
    const files = [];
    const toasts = [];
    const ls = new Map([
        ['oyi_companies', JSON.stringify([{ id: 'co_1', name: 'Muster & Söhne GmbH' }])],
        ['oyi_active_company', 'co_1']
    ]);
    const Store = {
        getAllPurchasesRaw: () => data.einkaeufe || [],
        getAllSalesRaw:     () => data.verkaeufe || [],
        getAllExpensesRaw:  () => data.ausgaben || [],
        getKassenbuch:      () => data.kassenbuch || [],
        getInvoices:        () => data.rechnungen || [],
        getAuditLog:        () => data.audit || [],
        getClosedYears: () => [], getSteuertermine: () => [], getSales: () => [], getSettings: () => ({})
    };
    const Utils = {
        downloadCSV: (rows, name) => files.push({ name, rows }),
        downloadFile: (content, name) => files.push({ name, content }),
        showToast: (m, t) => toasts.push({ m, t }),
        escapeHtml: (s) => String(s), formatDate: (s) => s, todayISO: () => '2026-08-11'
    };
    const fn = new Function('Store', 'Utils', 'localStorage', 'App', 'document',
        src.replace(/^if \(typeof window[\s\S]*$/m, '') + '; return Protokoll;');
    const P = fn(Store, Utils, { getItem: (k) => (ls.has(k) ? ls.get(k) : null) },
                 { showModal: () => {}, closeModal: () => {} },
                 { getElementById: () => null });
    return { P, files, toasts };
}

const DATEN = {
    einkaeufe: [
        { id: 'e1', datum: '2025-03-04', marke: 'Nike', beschreibung: 'Air Max', einkaufspreis: 80.5, anzahl: 1, storniert: false },
        { id: 'e2', datum: '2026-01-09', marke: 'Adidas', beschreibung: 'Samba', einkaufspreis: 65, anzahl: 2, storniert: false }
    ],
    verkaeufe: [{ id: 'v1', datum: '2025-06-01', beschreibung: 'Air Max', verkaufspreis: 150, storniert: true }],
    ausgaben:  [{ id: 'a1', datum: '2025-02-02', kategorie: 'Versand', betrag: 12.99, ustSatz: 19 }],
    audit:     [{ id: 'l1', timestamp: '2025-02-02T10:00:00.000Z', action: 'erstellt', entityType: 'ausgabe',
                  entityId: 'a1', prevHash: 'GENESIS', checksum: 'abc' }],
    rechnungen: [],
    kassenbuch: []
};

let pass = 0;

// ── 1. Nur der verlangte Zeitraum wird ausgeliefert ─────────────────────────────────────────
let { P, files, toasts } = load(DATEN);
P.exportZ3(2025, 2025);
const einkauf = files.find(f => f.name === 'einkaeufe.csv');
assert.ok(einkauf, 'einkaeufe.csv erzeugt');
assert.strictEqual(einkauf.rows.length, 2, 'Kopfzeile + genau der 2025er-Datensatz');
assert.ok(einkauf.rows[1].includes('Nike'), '2025er Datensatz enthalten');
assert.ok(!JSON.stringify(einkauf.rows).includes('Adidas'), '2026er Datensatz NICHT enthalten');
pass++; console.log('✓ Jahresfilter: nur der verlangte Zeitraum (Datenminimierung)');

// Leere Tabellen werden nicht als Datei erzeugt, aber im Hinweis benannt
assert.ok(!files.some(f => f.name === 'rechnungen.csv'), 'leere Tabelle erzeugt keine Datei');
assert.ok(/Rechnungen/.test(toasts[0].m) && /nicht enthalten/.test(toasts[0].m),
    'Hinweis benennt die weggelassenen Tabellen');
pass++; console.log('✓ leere Tabellen weggelassen und im Hinweis benannt');

// ── 2. index.xml wird erzeugt und beschreibt GENAU die gelieferten Dateien ──────────────────
const idx = files.find(f => f.name === 'index.xml');
assert.ok(idx, 'index.xml erzeugt');
const xml = idx.content;
assert.ok(/^<\?xml version="1\.0" encoding="UTF-8"\?>/.test(xml), 'XML-Deklaration');
assert.ok(/<!DOCTYPE DataSet SYSTEM "gdpdu-01-09-2004\.dtd">/.test(xml), 'GDPdU-DTD referenziert');
const urls = (xml.match(/<URL>([^<]+)<\/URL>/g) || []).map(s => s.replace(/<\/?URL>/g, ''));
const csvs = files.filter(f => f.name.endsWith('.csv')).map(f => f.name).sort();
assert.deepStrictEqual(urls.sort(), csvs, 'jede gelieferte CSV ist in index.xml verzeichnet — und keine andere');
pass++; console.log('✓ index.xml verzeichnet genau die gelieferten Dateien (' + csvs.length + ')');

// ── 3. Formatangaben müssen zu den Daten passen, sonst liest die Prüfsoftware falsch ────────
assert.ok(/<DecimalSymbol>,<\/DecimalSymbol>/.test(xml), 'Dezimaltrennzeichen als Komma deklariert');
assert.ok(/<ColumnDelimiter>;<\/ColumnDelimiter>/.test(xml), 'Semikolon als Spaltentrenner');
assert.ok(/<TextEncapsulator>"<\/TextEncapsulator>/.test(xml), 'Anführungszeichen als Textbegrenzer');
// … und die CSV muss sich daran halten
const ekPreisIdx = einkauf.rows[0].indexOf('Einkaufspreis (EUR)');
assert.strictEqual(einkauf.rows[1][ekPreisIdx], '80,5', 'Zahl mit Komma, wie deklariert');
pass++; console.log('✓ Formatangaben in index.xml entsprechen den CSV-Daten');

// ── 4. Erste Spalte je Tabelle ist der Primärschlüssel (GDPdU verlangt genau einen) ─────────
const tables = xml.split('<Table>').slice(1);
assert.strictEqual(tables.length, csvs.length, 'ein <Table> je Datei');
tables.forEach((t) => {
    assert.strictEqual((t.match(/<VariablePrimaryKey>/g) || []).length, 1,
        'genau ein VariablePrimaryKey je Tabelle');
    assert.ok(t.indexOf('<VariablePrimaryKey>') < t.indexOf('<VariableColumn>'),
        'Primärschlüssel steht als erste Spalte');
});
pass++; console.log('✓ je Tabelle genau ein Primärschlüssel, an erster Position');

// ── 5. Datentypen: Datum mit Format, Zahl mit Genauigkeit ───────────────────────────────────
assert.ok(/<Date><Format>YYYY-MM-DD<\/Format><\/Date>/.test(xml), 'Datumsformat deklariert');
assert.ok(/<Numeric><Accuracy>2<\/Accuracy><\/Numeric>/.test(xml), 'Nachkommastellen deklariert');
assert.ok(/<AlphaNumeric><\/AlphaNumeric>/.test(xml), 'Textspalten als AlphaNumeric');
pass++; console.log('✓ Datentypen samt Format/Genauigkeit deklariert');

// ── 6. XML-Escaping: der Firmenname landet ungeprüft im XML, "&" würde es zerstören ─────────
assert.ok(/<Name>Muster &amp; Söhne GmbH<\/Name>/.test(xml), 'Firmenname mit & korrekt escaped');
assert.ok(!/&(?!amp;|lt;|gt;|quot;|#13;|#10;)/.test(xml), 'kein unescaptes & im gesamten XML');
pass++; console.log('✓ XML-Escaping hält, auch bei & im Firmennamen');

// ── 7. Wahrheitswerte und fehlende Felder lesbar, nicht "undefined"/"false" ─────────────────
const vkFiles = load(DATEN); vkFiles.P.exportZ3(2025, 2025);
const vk = vkFiles.files.find(f => f.name === 'verkaeufe.csv');
const stIdx = vk.rows[0].indexOf('Storniert');
assert.strictEqual(vk.rows[1][stIdx], 'ja', 'true → "ja"');
const kaeuferIdx = vk.rows[0].indexOf('Käufer');
assert.strictEqual(vk.rows[1][kaeuferIdx], '', 'fehlendes Feld → leer, nicht "undefined"');
pass++; console.log('✓ Wahrheitswerte als ja/nein, fehlende Felder leer');

// ── 8. Mehrjahres-Zeitraum und Validity-Angabe ──────────────────────────────────────────────
const mehr = load(DATEN); mehr.P.exportZ3(2025, 2026);
const mx = mehr.files.find(f => f.name === 'index.xml').content;
assert.ok(/<From>2025-01-01<\/From><To>2026-12-31<\/To>/.test(mx), 'Gültigkeitszeitraum im XML');
const mEk = mehr.files.find(f => f.name === 'einkaeufe.csv');
assert.strictEqual(mEk.rows.length, 3, 'beide Jahre enthalten');
pass++; console.log('✓ Mehrjahres-Export mit korrektem Gültigkeitszeitraum');

// ── 9. Kein Datenbestand im Zeitraum → klare Meldung, keine leeren Dateien ──────────────────
const leer = load(DATEN); leer.files.length = 0;
leer.P.exportZ3(2019, 2019);
assert.strictEqual(leer.files.length, 0, 'keine Dateien');
assert.ok(/keine Daten/.test(leer.toasts[leer.toasts.length - 1].m), 'Meldung statt leerem Export');
pass++; console.log('✓ Zeitraum ohne Daten erzeugt keine leeren Dateien');

console.log('\n' + pass + '/10 Tests bestanden ✅');
