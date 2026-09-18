// Was die Statistiken rechnen — das Modul mit den meisten Zahlen und bis heute ohne Test.
//
// js/statistiken.js ist mit 705 Zeilen das groesste der ungetesteten Rechenmodule (Fund C in
// plan/funde-vollaudit-2026-09-09.md). Beim ersten Durchmessen fiel auf, dass vier von
// vierzehn Einkaufssummen die Menge unterschlugen — Fund in plan/funde-statistiken-2026-09-13.md.
//
// Geprueft wird der Rechenteil, nicht die Diagramme: Zeitraumfilter, die Umsatzsummen aus
// Rechnungen, die PStTG-Meldeschwelle und die Gewinnbildung je Plattform, Marke und Typ.
'use strict';
const assert = require('assert');
const fs = require('fs');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}
// Ein Harness ruft echten Modulcode auf — genau das macht ihn wertvoll, und genau deshalb
// kann der Aufruf selbst werfen. Ohne diese Klammer stirbt der Lauf an der ersten Ausnahme,
// und man erfaehrt nicht, was sonst noch kaputt ist: ein Stacktrace statt einer Fundliste.
// Nachgemessen am 2026-09-15 in einer Spiegelkopie: bei einer gebrochenen Modul-API starben
// alle vier Harnesse dieser Session, statt zu melden.
let blockNr = 0;
function block(fn) {
    blockNr++;
    const nr = blockNr;
    try { fn(); }
    catch (e) {
        total++;
        console.error('✗ FAIL Block ' + nr + ' bricht mit einer Ausnahme ab: ' + e.message);
        process.exitCode = 1;
    }
}

const statSrc = fs.readFileSync(__dirname + '/../js/statistiken.js', 'utf8');

// ── Die Nettoerloes-Formel wird NICHT nachgebaut, sondern geladen ───────────
// Erste Fassung dieses Harness hatte sie als Mock nachgebildet. Einen Tag spaeter wurde
// Utils.calculateNetRevenue an der Wurzel korrigiert (Fund A3, 90d6719: der Kaeufer-Versand
// zaehlte als Gebuehrenbasis, aber nicht als Einnahme) — der Mock blieb gruen und zeigte
// trotzdem die alte Welt. Genau die Drift, gegen die ein Harness da sein soll.
function extractMethod(src, startMarker, endMarkerRe) {
    const startIdx = src.indexOf(startMarker);
    assert.ok(startIdx !== -1, 'Marker nicht gefunden: ' + startMarker);
    const rest = src.slice(startIdx + startMarker.length);
    const m = rest.match(endMarkerRe);
    assert.ok(m, 'Ende-Marker nicht gefunden nach ' + startMarker);
    return rest.slice(0, m.index);
}
const utilsSrc = fs.readFileSync(__dirname + '/../js/utils.js', 'utf8');
const calculateNetRevenue = new Function(
    'verkaufspreis', 'versandkostenKaeufer', 'plattformgebuehrProzent', 'versandkostenVerkaufer',
    extractMethod(utilsSrc,
        'calculateNetRevenue(verkaufspreis, versandkostenKaeufer, plattformgebuehrProzent, versandkostenVerkaufer) {',
        /\n    \},/));

// ── Modul laden ────────────────────────────────────────────────────────────
// Kein Modulsystem: Store, Utils und ein Mini-DOM kommen als Parameter herein. Die
// Diagramm-Leinwaende liefert das Fake-DOM als null zurueck — _createChart steigt dann
// von selbst aus, und wir messen die Zahlen statt Chart.js zu simulieren.
function lade(o) {
    const d = Object.assign({
        sales: [], purchases: [], invoices: [],
        materialBestand: [], materialVerbrauch: [],
    }, o || {});
    const aktiv = (l) => l.filter(x => !x.storniert);

    const abschnitte = {};
    const Store = {
        getSales:             (alle) => (alle ? d.sales : aktiv(d.sales)),
        getPurchases:         (alle) => (alle ? d.purchases : aktiv(d.purchases)),
        getRechInvoices:      () => d.invoices,
        getMaterialBestand:   () => d.materialBestand,
        getMaterialVerbrauch: () => d.materialVerbrauch,
    };
    const Utils = {
        isInPeriod: (dat, s, e) => !!dat && dat >= s && dat <= e,
        escapeHtml: (s) => String(s == null ? '' : s),
        // Eindeutig wiederfindbar statt huebsch: so laesst sich jeder Betrag aus dem
        // erzeugten HTML exakt zurueckparsen, ohne an einer Formatierung zu haengen.
        formatCurrency: (n) => '[[' + (Math.round((parseFloat(n) || 0) * 100) / 100).toFixed(2) + ']]',
        formatDate: (x) => String(x),
        calculateNetRevenue: calculateNetRevenue,   // echte Funktion aus js/utils.js, s. oben
    };
    const document = {
        getElementById: (id) => {
            if (/^chart/i.test(id)) return null;           // Leinwaende: kein Diagramm im Test
            if (!abschnitte[id]) abschnitte[id] = { innerHTML: '', style: {} };
            return abschnitte[id];
        },
    };
    const Theme  = { isDark: () => true };
    const window = { matchMedia: () => ({ matches: false }) };
    const Chart  = function () { return {}; };

    const S = new Function('Store', 'Utils', 'document', 'Theme', 'window', 'Chart',
        statSrc + '\n; return Statistiken;')(Store, Utils, document, Theme, window, Chart);
    S._charts = [];
    return { S, abschnitte };
}

// Alle Betraege einer HTML-Tabellenzeile in der Reihenfolge ihres Auftretens
function betraege(html) {
    return (html.match(/\[\[-?\d+\.\d\d\]\]/g) || []).map(s => parseFloat(s.slice(2, -2)));
}
function zeile(html, name) {
    const zeilen = html.split('<tr>').filter(z => z.includes('>' + name + '<'));
    return zeilen.length ? zeilen[0] : '';
}

const VERKAUF = {
    id: 's1', datum: '2026-03-01', verkaufspreis: 100, versandkostenKaeufer: 0,
    plattformgebuehrProzent: 0, versandkostenVerkaufer: 0,
    verkaufsplattform: 'Vinted', marke: 'Acme', artikeltyp: 'Regal',
};
const RECHNUNG = {
    id: 'i1', typ: 'rechnung', status: 'bezahlt', datum: '2026-05-01', bezahltAm: '2026-05-10',
    positionen: [{ menge: 2, einzelpreis: 100 }],
};

console.log('\n── A. Zeitraumfilter ─────────────────────────────────────────');

block(() => {
    const { S } = lade({
        sales: [VERKAUF, Object.assign({}, VERKAUF, { id: 's2', datum: '2025-03-01' })],
        purchases: [{ id: 'p1', datum: '2026-01-01', einkaufspreis: 10 },
                    { id: 'p2', datum: '2025-01-01', einkaufspreis: 10 }],
    });
    S._period = '2026';
    const r = S._getFilteredData();
    check('A1 Jahresfilter laesst nur Belege des Jahres durch',
        r.sales.length === 1 && r.purchases.length === 1 && r.sales[0].id === 's1');
    check('A2 allPurchases bleibt ungefiltert (Einkauf kann aelter sein als der Verkauf)',
        r.allPurchases.length === 2);

    S._period = 'custom'; S._customStart = '2025-01-01'; S._customEnd = '2025-12-31';
    check('A3 Eigener Zeitraum filtert auf seine Grenzen',
        S._getFilteredData().sales.map(s => s.id).join() === 's2');

    S._period = 'alle';
    check('A4 Ohne Jahresangabe bleibt alles stehen', S._getFilteredData().sales.length === 2);
});

block(() => {
    const { S } = lade({ sales: [], purchases: [], invoices: [RECHNUNG] });
    S._period = '2026';
    check('A5 Bezahlte Rechnung zaehlt zum Umsatz', S._getFilteredData().unsyncedRevenue === 200);

    const { S: S2 } = lade({ invoices: [Object.assign({}, RECHNUNG, { status: 'versendet' })] });
    S2._period = '2026';
    check('A6 Unbezahlte Rechnung zaehlt nicht', S2._getFilteredData().unsyncedRevenue === 0);

    const { S: S3 } = lade({ invoices: [Object.assign({}, RECHNUNG, { typ: 'gutschrift' })] });
    S3._period = '2026';
    check('A7 Gutschrift mindert den Umsatz (§17 UStG)', S3._getFilteredData().unsyncedRevenue === -200);

    const { S: S4 } = lade({
        invoices: [RECHNUNG],
        sales: [Object.assign({}, VERKAUF, { _invoiceId: 'i1' })],
    });
    S4._period = '2026';
    check('A8 Bereits als Verkauf gebuchte Rechnung zaehlt nicht doppelt',
        S4._getFilteredData().unsyncedRevenue === 0);

    const { S: S5 } = lade({ invoices: [Object.assign({}, RECHNUNG, { _storniert: true })] });
    S5._period = '2026';
    check('A9 Stornierte Rechnung zaehlt nicht', S5._getFilteredData().unsyncedRevenue === 0);

    const { S: S6 } = lade({ invoices: [Object.assign({}, RECHNUNG, { typ: 'angebot' })] });
    S6._period = '2026';
    check('A10 Angebote sind kein Umsatz', S6._getFilteredData().unsyncedRevenue === 0);

    const { S: S7 } = lade({ invoices: [Object.assign({}, RECHNUNG, { bezahltAm: '2027-01-02' })] });
    S7._period = '2026';
    check('A11 Massgeblich ist das Zahlungsdatum, nicht das Rechnungsdatum',
        S7._getFilteredData().unsyncedRevenue === 0);
});

console.log('\n── B. PStTG-Meldeschwelle ────────────────────────────────────');

// § 4 Abs. 5 PStTG: freigestellt ist nur, wer UNTER 30 Verkaeufen UND UNTER 2.000 € bleibt.
// Ab 30 Verkaeufen ODER 2.000 € wird gemeldet — beide Grenzen einzeln geprueft, weil ein
// Dreher hier dem Nutzer "alles in Ordnung" anzeigt, waehrend die Plattform laengst meldet.
function plattform(anzahlVerkaeufe, preisJeVerkauf, jahr) {
    const sales = [];
    for (let i = 0; i < anzahlVerkaeufe; i++) {
        sales.push(Object.assign({}, VERKAUF, { id: 's' + i, verkaufspreis: preisJeVerkauf }));
    }
    const { S, abschnitte } = lade({ sales });
    S._period = String(jahr || 2026);   // fest, damit die Pruefung nicht am Kalender haengt
    S._renderPlatformAnalyse(sales, []);
    return abschnitte['platAnalyseSection'].innerHTML;
}

check('B1 29 Verkaeufe unter 2.000 € gelten als nicht meldepflichtig',
    plattform(29, 50).includes('✓ OK'));
check('B2 Der 30. Verkauf loest die Meldepflicht aus, auch bei kleinen Betraegen',
    plattform(30, 1).includes('⚠️ Meldepflicht'));
check('B3 1.999 € aus wenigen Verkaeufen bleiben unter der Schwelle',
    plattform(2, 999.5).includes('✓ OK'));
check('B4 2.000 € loesen die Meldepflicht aus, auch bei einem einzigen Verkauf',
    plattform(1, 2000).includes('⚠️ Meldepflicht'));
check('B5 Vor Inkrafttreten des PStTG (2022) gibt es keine Meldepflicht',
    plattform(50, 500, 2022).includes('✓ OK'));
check('B6 Im ersten Geltungsjahr 2023 greift sie',
    plattform(50, 500, 2023).includes('⚠️ Meldepflicht'));

// Der Fall, der bis 2026-09-18 falsch lief: die Plattform meldet die Verguetung MIT dem vom
// Kaeufer bezahlten Versand. 1.950 € Artikel + 80 € Versand = 2.030 € — gemeldet. Stackr zaehlte
// nur den Artikelpreis und zeigte "✓ OK".
block(() => {
    const s = [Object.assign({}, VERKAUF, { verkaufspreis: 1950, versandkostenKaeufer: 80 })];
    const { S, abschnitte } = lade({ sales: s });
    S._period = '2026';
    S._renderPlatformAnalyse(s, []);
    const html = abschnitte['platAnalyseSection'].innerHTML;
    check('B7 Kaeufer-Versand zaehlt zur PStTG-Schwelle (1.950 + 80 = 2.030 → Meldepflicht)',
        html.includes('⚠️ Meldepflicht'));
    check('B8 Die Umsatzspalte weist dieselben 2.030 € aus', betraege(zeile(html, 'Vinted'))[0] === 2030);
});

console.log('\n── C. Gewinn je Plattform ────────────────────────────────────');

block(() => {
    // Der Fund vom 2026-09-13: Ein Verkauf nimmt den ganzen Einkaufssatz mit
    // (Store.saveSale setzt ihn komplett auf 'verkauft'), einkaufspreis ist der Stueckpreis.
    // Zehn Stueck a 20 € kosteten in dieser Auswertung 20 € statt 200 € — der Gewinn je
    // Plattform stand damit um 180 € zu hoch.
    const sale = Object.assign({}, VERKAUF, { purchaseId: 'p1', verkaufspreis: 300 });
    const einkauf = { id: 'p1', datum: '2026-01-01', einkaufspreis: 20, anzahl: 10 };
    const { S, abschnitte } = lade({ sales: [sale], purchases: [einkauf] });
    S._renderPlatformAnalyse([sale], [einkauf]);
    const z = zeile(abschnitte['platAnalyseSection'].innerHTML, 'Vinted');
    const w = betraege(z);
    check('C1 Der Sammel-Einkauf geht mit Menge in den Gewinn (300 − 10×20 = 100)',
        w.includes(100));
    check('C2 Umsatz und Durchschnittspreis bleiben unberuehrt', w[0] === 300 && w[1] === 300);

    const einzeln = { id: 'p1', datum: '2026-01-01', einkaufspreis: 20 };
    const { S: S2, abschnitte: a2 } = lade({ sales: [sale], purchases: [einzeln] });
    S2._renderPlatformAnalyse([sale], [einzeln]);
    check('C3 Fehlende Menge zaehlt als 1 (300 − 20 = 280)',
        betraege(zeile(a2['platAnalyseSection'].innerHTML, 'Vinted')).includes(280));

    const mehrere = [{ id: 'p1', einkaufspreis: 20, anzahl: 2 }, { id: 'p2', einkaufspreis: 30, anzahl: 3 }];
    const saleMulti = Object.assign({}, VERKAUF, { purchaseIds: ['p1', 'p2'], verkaufspreis: 300 });
    const { S: S3, abschnitte: a3 } = lade({ sales: [saleMulti], purchases: mehrere });
    S3._renderPlatformAnalyse([saleMulti], mehrere);
    check('C4 Mehrere verknuepfte Einkaeufe summieren mit Menge (300 − 40 − 90 = 170)',
        betraege(zeile(a3['platAnalyseSection'].innerHTML, 'Vinted')).includes(170));

    const ohneZuordnung = Object.assign({}, VERKAUF, { verkaufspreis: 300 });
    const { S: S4, abschnitte: a4 } = lade({ sales: [ohneZuordnung] });
    S4._renderPlatformAnalyse([ohneZuordnung], []);
    check('C5 Verkauf ohne Lagerzuordnung faellt nicht aus der Auswertung',
        betraege(zeile(a4['platAnalyseSection'].innerHTML, 'Vinted')).includes(300));

    const ohnePlattform = Object.assign({}, VERKAUF, { verkaufsplattform: '' });
    const { S: S5, abschnitte: a5 } = lade({ sales: [ohnePlattform] });
    S5._renderPlatformAnalyse([ohnePlattform], []);
    check('C6 Verkauf ohne Plattform landet unter "Unbekannt", nicht im Nichts',
        a5['platAnalyseSection'].innerHTML.includes('Unbekannt'));

    const mitGebuehr = Object.assign({}, VERKAUF, {
        verkaufspreis: 100, versandkostenKaeufer: 10, plattformgebuehrProzent: 10, versandkostenVerkaufer: 5,
    });
    const { S: S6, abschnitte: a6 } = lade({ sales: [mitGebuehr] });
    S6._renderPlatformAnalyse([mitGebuehr], []);
    // Fund A3, an der Wurzel behoben (90d6719): Der Kaeufer-Versand ist Einnahme UND
    // Gebuehrenbasis — nicht nur Gebuehrenbasis. Der Kaeufer zahlt 110, davon gehen 10 %
    // Gebuehr auf die vollen 110 (= 11) und 5 eigenes Porto ab: 94 bleiben.
    check('C7 Kaeufer-Versand ist Einnahme und Gebuehrenbasis zugleich (100 + 10 − 11 − 5 = 94)',
        betraege(zeile(a6['platAnalyseSection'].innerHTML, 'Vinted')).includes(94));
});

console.log('\n── D. Profitabilitaet je Marke und Typ ───────────────────────');

block(() => {
    const sale = Object.assign({}, VERKAUF, { purchaseId: 'p1', verkaufspreis: 300, datum: '2026-03-11' });
    const einkauf = { id: 'p1', datum: '2026-03-01', einkaufspreis: 20, anzahl: 10 };
    const { S, abschnitte } = lade({ sales: [sale], purchases: [einkauf] });
    S._renderProfitabilitaet([sale], [einkauf]);
    const html = abschnitte['profitabilitaetSection'].innerHTML;

    // Dieselbe Kennzahl stand vor dem 2026-09-13 zweimal verschieden auf einem Bildschirm:
    // das Diagramm "Gewinn pro Marke" rechnete mit Menge, diese Tabelle ohne.
    check('D1 Marken-Tabelle rechnet den Einkauf mit Menge (300 − 200 = 100)',
        betraege(zeile(html, 'Acme')).includes(100));
    check('D2 Typen-Tabelle rechnet genauso', betraege(zeile(html, 'Regal')).includes(100));
    check('D3 Standzeit kommt aus dem Einkaufsdatum (10 Tage)', /\b10\b/.test(zeile(html, 'Acme')));
});

console.log('\n── E. Regressionswaechter ────────────────────────────────────');

block(() => {
    // Der eigentliche Schutz: nicht ein Wert, sondern die Bauart. Vor dem 2026-09-13 trugen
    // 10 von 14 Einkaufssummen die Menge und 4 nicht — genau so entstehen zwei Zahlen mit
    // demselben Namen. Kommt eine neue Summe ohne Menge dazu, faellt diese Pruefung.
    const alle   = (statSrc.match(/parseFloat\(p2?\.einkaufspreis\)\s*\|\|\s*0/g) || []).length;
    const mitMenge = (statSrc.match(/parseFloat\(p2?\.einkaufspreis\)\s*\|\|\s*0\)\s*\*\s*\(parseInt\(p2?\.anzahl\)\s*\|\|\s*1\)/g) || []).length;
    check('E1 Jede Einkaufssumme im Modul rechnet die Menge mit',
        alle > 0 && alle === mitMenge);
    check('E2 Es sind unveraendert 14 Summen — keine ist beim Fix verlorengegangen', alle === 14);

    check('E3 Die PStTG-Schwelle steht als ODER im Code, nicht als UND',
        /count\s*>=\s*schwelle\.verkaeufe\s*\|\|\s*[\w.]*umsatz\s*>=\s*schwelle\.verguetung/.test(statSrc));

    // CLAUDE.md Regel 7: Gesetzeswerte gehoeren in eine Jahresfunktion, nie in eine
    // jahresfeste Konstante — auch wenn es heute nur einen Stand gibt.
    const { S } = lade({});
    check('E4 Die Schwellen kommen aus einer Jahresfunktion, nicht aus festen Zahlen',
        typeof S._getPstTgSchwellen === 'function' &&
        S._getPstTgSchwellen(2026).verkaeufe === 30 &&
        S._getPstTgSchwellen(2026).verguetung === 2000);
    check('E5 Die Jahresfunktion kennt den Stand vor dem PStTG',
        S._getPstTgSchwellen(2022).verkaeufe === Infinity);
    check('E6 Im Vergleich stehen keine nackten Gesetzeszahlen mehr',
        !/count\s*>=\s*30\b/.test(statSrc) && !/umsatz\s*>=\s*2000\b/.test(statSrc));
});

console.log('\n' + pass + '/' + total + ' Checks bestanden');
assert.strictEqual(pass, total, 'Statistiken: ' + (total - pass) + ' Pruefung(en) fehlgeschlagen');
