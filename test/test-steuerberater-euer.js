// Das Steuerberater-Paket rechnet den Gewinn nicht mehr selbst.
//
// js/steuerberater.js baut das HTML-Dokument, das beim Steuerberater landet. Bis zum
// 2026-09-28 stand darin eine eigene, zweite Gewinnformel:
//
//     Verkaeufe - Wareneinkauf - sonstige Ausgaben
//
// Das ist Fund A1 des Vollaudits (plan/funde-vollaudit-2026-09-09.md), nur an der
// unangenehmsten Stelle. Es fehlten Rechnungseinnahmen, Retouren, Verkaeufer-Versand,
// Plattformgebuehren, Fahrtkosten, Verpackungsmaterial, Eigenbelege, AfA — und bei
// Regelbesteuerung die gesamte Netto-Umstellung. Die EUER-Seite der App und das Paket
// zeigten fuer dasselbe Jahr verschiedene Zahlen; die des Beraters war die falsche.
//
// Der Modul hatte keinen Harness: er stand in plan/01-AUFGABEN.md, Abschnitt 1.8, als eines
// der vier offenen Module — unter der Frage, ob er ueberhaupt genug Rechenrelevanz hat.
// Hatte er.
//
// Geprueft wird beides: dass die Zahl im ausgelieferten HTML exakt die von Euer._berechne()
// ist (Block B/C), und dass die alte Formel nicht still zurueckwandert (Block A, Quelltext).
'use strict';
const assert = require('assert');
const fs = require('fs');

function extractMethod(src, startMarker, endMarkerRe) {
    const startIdx = src.indexOf(startMarker);
    assert.ok(startIdx !== -1, 'Marker nicht gefunden: ' + startMarker);
    const rest = src.slice(startIdx + startMarker.length);
    const m = rest.match(endMarkerRe);
    assert.ok(m, 'Ende-Marker nicht gefunden nach ' + startMarker);
    return rest.slice(0, m.index);
}

let pass = 0, total = 0;
// `cond` darf ein Wert ODER eine Funktion sein — faellt ein Feld aus der Rueckgabe von
// _berechne(), stirbt der Harness sonst schon beim Auswerten des Arguments, statt den
// Fehlschlag zu zaehlen. Begruendung ausfuehrlich in test/test-gewinn-eine-quelle.js.
function check(name, cond) {
    total++;
    let ok = false;
    try {
        ok = (typeof cond === 'function') ? !!cond() : !!cond;
    } catch (e) {
        console.error('   (Ausnahme statt Ergebnis: ' + (e && e.message) + ')');
    }
    if (ok) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}

function block(name, fn) {
    try { fn(); }
    catch (e) { total++; console.error('✗ FAIL Block ' + name + ' abgebrochen: ' + (e && e.message)); process.exitCode = 1; }
}

const euerSrc = fs.readFileSync(__dirname + '/../js/euer.js', 'utf8');
const stbSrc  = fs.readFileSync(__dirname + '/../js/steuerberater.js', 'utf8');
const _berechne = new Function('year', 'month', 'period',
    extractMethod(euerSrc, '_berechne(year, month, period) {', /\n    \},/));

// ── Szenario ────────────────────────────────────────────────────────────────
// Bewusst so gebaut, dass JEDE der acht vergessenen Groessen einen Betrag traegt: sonst
// bewiese ein gruener Test nur, dass zwei Nullen gleich sind.
const JAHR = 2026;
function grundgeruest(over) {
    return Object.assign({
        sales: [{ id: 's1', datum: '2026-03-01', verkaufspreis: 1000, versandkostenKaeufer: 50,
                  versandkostenVerkaufer: 30, plattformgebuehrProzent: 10 }],
        purchases: [{ id: 'p1', datum: '2026-02-01', einkaufspreis: 400, anzahl: 1 }],
        expenses:  [{ id: 'e1', datum: '2026-04-01', betrag: 100, kategorie: 'Buero', ustSatz: 19 }],
        retouren:  [{ datum: '2026-05-01', erstattungBetrag: 120, saleId: null }],
        fahrten:   [{ datum: '2026-06-01', kosten: 60 }],
        materialEinkaeufe: [{ datum: '2026-07-01', gesamtkosten: 90 }],
        afaAnlagen: [{ id: 'a1' }],
        afaProJahr: 200,
        eigenbelege: [{ belegDatum: '2026-08-01', betragNetto: 70 }],
        ustMode: 'klein',
    }, over || {});
}

let letztesHtml = null;
let letzterDateiname = null;

// Setzt alle Globals, die js/euer.js UND js/steuerberater.js im Browser vorfinden.
function setzeGlobals(o, opts) {
    opts = opts || {};
    const aktiv = (l) => l.filter(x => !x.storniert);
    global.Utils = {
        isInPeriod: (d, s, e) => !!d && d >= s && d <= e,
        getMonthName: () => 'Monat',
        formatDate: (d) => d,
        formatCurrency: (n) => String(n),
        escapeHtml: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        downloadFile: (inhalt, name) => { letztesHtml = inhalt; letzterDateiname = name; },
        showToast: () => {},
    };
    global.Store = {
        getSettings:          () => ({ ustMode: o.ustMode, firmenname: 'Testfirma' }),
        getSales:             (alle) => (alle ? o.sales : aktiv(o.sales)),
        getPurchases:         (alle) => (alle ? o.purchases : aktiv(o.purchases)),
        getExpenses:          () => aktiv(o.expenses),
        getAllPurchasesRaw:   () => o.purchases,
        getAllExpensesRaw:    () => o.expenses,
        getAllSalesRaw:       () => { throw new Error('getAllSalesRaw gehoerte zur alten Eigenformel'); },
        getRechInvoices:      () => [],
        getRechCustomers:     () => [],
        getRetouren:          () => o.retouren,
        getFahrten:           () => o.fahrten,
        getMaterialVerbrauch: () => [],
        getMaterialEinkauefe: () => o.materialEinkaeufe,
        getAfaAnlagen:        () => o.afaAnlagen,
        getAuditLog:          () => [],
        _syncReadRaw:         () => o.eigenbelege,
    };
    global.localStorage = { getItem: () => '' };
    global.Afa = { _calcJahresAfa: () => o.afaProJahr };
    global.SteuerBerechnung = {
        nettoRechnungen:      () => ({ netto: 0, ust: 0 }),
        margeEinzeldifferenz: () => 0,
        // Netto bei Regelbesteuerung: 19% aus dem Brutto herausgerechnet, wie im Produkt.
        nettoSales:           (s) => ({ netto: s.reduce((x, v) =>
                                  x + ((parseFloat(v.verkaufspreis) || 0) + (parseFloat(v.versandkostenKaeufer) || 0)) / 1.19, 0) }),
        nettoRetouren:        (r) => ({ netto: r.reduce((x, v) => x + (parseFloat(v.erstattungBetrag) || 0) / 1.19, 0) }),
        nettoPurchases:       (p) => ({ ust: p.reduce((x, v) => {
                                  const b = (parseFloat(v.einkaufspreis) || 0) * (parseInt(v.anzahl) || 1);
                                  return x + (b - b / 1.19);
                              }, 0) }),
    };
    global.Euer = opts.ohneEuer ? undefined : { _berechne: _berechne };

    let klick = null;
    global.document = {
        getElementById: (id) => {
            if (id === 'stbExportBtn') return { addEventListener: (ev, fn) => { klick = fn; } };
            if (id === 'stbYear') return { value: String(JAHR) };
            if (id === 'stbPin')  return { value: '' };
            // Nur der EUER-Abschnitt — die uebrigen Bloecke sind reine Auflistungen und
            // wuerden die Zeilensuche unten nur stoeren.
            if (id === 'stb_eur') return { checked: true };
            return { checked: false };
        },
    };
    return () => klick;
}

// Laedt js/steuerberater.js frisch und loest den Export aus. Rueckgabe: das HTML, das
// Utils.downloadFile bekommen haette.
function exportiere(o, opts) {
    letztesHtml = null;
    const holeKlick = setzeGlobals(o, opts);
    const Steuerberater = new Function(stbSrc + '\nreturn Steuerberater;')();
    Steuerberater.init();
    const klick = holeKlick();
    assert.ok(typeof klick === 'function', 'init() hat keinen Klick-Handler verdrahtet');
    klick();
    return letztesHtml;
}

const fmtCur = (n) => (parseFloat(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

// "1.234,56 €" zurueck in eine Zahl. fmtCur() setzt ein schmales geschuetztes Leerzeichen
// vor das Euro-Zeichen — deshalb wird alles ausser Ziffern, Komma, Punkt und Minus verworfen.
function betrag(s) {
    const roh = String(s).replace(/[^0-9.,\-−]/g, '').replace('−', '-');
    return parseFloat(roh.replace(/\./g, '').replace(',', '.'));
}

// Liest eine Zeile der EUER-Tabelle heraus. Die Beschriftungen stehen im Klartext im HTML.
function zeile(html, labelAnfang) {
    const re = new RegExp('<td[^>]*>' + labelAnfang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^<]*</td><td[^>]*>([^<]*)</td>');
    const m = html.match(re);
    return m ? m[1] : null;
}

// ── Block A: Quelltext-Wachen gegen den Rueckbau ────────────────────────────
block('A', () => {
    check('A1 js/steuerberater.js ruft Euer._berechne auf',
        /Euer\._berechne\(\s*year\s*,\s*0\s*,\s*'jahr'\s*\)/.test(stbSrc));
    check('A2 keine eigene Gewinnformel mehr',
        !/gewinn\s*=\s*einnahmen\s*-/.test(stbSrc));
    check('A3 die Einzelsummen der alten Formel sind weg',
        !/var\s+einnahmen\s*=/.test(stbSrc) && !/var\s+wareneinkauf\s*=/.test(stbSrc));
    check('A4 die Verkaufsliste wird nicht mehr eigens gelesen',
        !/Store\.getAllSalesRaw\s*\(/.test(stbSrc));
    check('A5 buildEurSection nimmt die Rechnung, nicht Einzelwerte',
        /function buildEurSection\(year, d\)/.test(stbSrc));
    check('A6 fehlt js/euer.js, wird nichts ausgewiesen statt geraten',
        /console\.error\('\[Steuerberater\]/.test(stbSrc));
});

// ── Block B: die Zahl im Paket ist die der EUER (Kleinunternehmer) ──────────
block('B', () => {
    const o = grundgeruest();
    const html = exportiere(o);
    setzeGlobals(o);                       // Globals fuer den Direktaufruf zuruecksetzen
    const d = _berechne.call({}, JAHR, 0, 'jahr');

    check('B1 Gewinn im Paket == Euer._berechne().gewinn',
        zeile(html, '= Gewinn') === fmtCur(d.gewinn) || zeile(html, '= Verlust') === fmtCur(d.gewinn));

    // Gegenprobe mit Zahlen: die alte Formel war Verkaeufe - Wareneinkauf - Ausgaben.
    // 1050 - 400 - 100 = 550. Die EUER kommt auf 550 - 30 (Versand) - 105 (Gebuehr)
    // - 60 (Fahrt) - 90 (Material) - 200 (AfA) - 70 (Eigenbeleg) - 120 (Retoure) = -125.
    const alteFormel = 1050 - 400 - 100;
    check('B2 die alte Formel wich um 675 EUR ab (Gegenprobe)',
        Math.abs(alteFormel - 550) < 0.01 && Math.abs(d.gewinn - (-125)) < 0.01);

    check('B3 Fahrtkosten stehen als eigene Zeile', zeile(html, '− Fahrtkosten') === fmtCur(60));
    check('B4 AfA steht als eigene Zeile', zeile(html, '− Abschreibungen AfA') === fmtCur(200));
    check('B5 Verpackungsmaterial steht als eigene Zeile', zeile(html, '− Verpackungsmaterial') === fmtCur(90));
    check('B6 Eigenbelege stehen als eigene Zeile', zeile(html, '− Eigenbelege') === fmtCur(70));
    check('B7 Plattformgebuehren stehen als eigene Zeile', zeile(html, '− Plattformgebühren') === fmtCur(105));
    check('B8 Verkaeufer-Versand steht als eigene Zeile', zeile(html, '− Versandkosten') === fmtCur(30));
    check('B9 die Retoure ist in den Einnahmen abgezogen',
        zeile(html, 'Summe Betriebseinnahmen') === fmtCur(1050 - 120));
    check('B10 Kleinunternehmer-Hinweis nach §19 UStG steht drin', /§19 UStG/.test(html));
    check('B11 keine Vorsteuerzeile beim Kleinunternehmer', zeile(html, '+ abziehbare Vorsteuer') === null);
    check('B12 der Dateiname nennt Jahr und Firma', /Stackr_Steuerberater_2026_Testfirma\.html/.test(letzterDateiname || ''));
});

// ── Block C: Regelbesteuerung — die Spalte muss aufgehen ────────────────────
block('C', () => {
    const o = grundgeruest({ ustMode: 'regel' });
    const html = exportiere(o);
    setzeGlobals(o);
    const d = _berechne.call({}, JAHR, 0, 'jahr');

    check('C1 Gewinn im Paket == Euer._berechne().gewinn (Regelbesteuerung)',
        zeile(html, '= Gewinn') === fmtCur(d.gewinn) || zeile(html, '= Verlust') === fmtCur(d.gewinn));
    check('C2 Vorsteuer steht als eigene Zeile', zeile(html, '+ abziehbare Vorsteuer') === fmtCur(d.vorsteuer));
    check('C3 Einnahmen sind netto ausgewiesen', /Summe Betriebseinnahmen \(netto\)/.test(html));

    // Der eigentliche Punkt der Vorsteuerzeile: ohne sie summiert die Spalte nicht auf den
    // ausgewiesenen Gewinn — der Berater rechnet nach und findet eine Differenz. Deshalb wird
    // hier NICHT d ausgerechnet, sondern das gerechnet, was im Dokument steht: gesummt werden
    // die gerenderten Zeilen, verglichen wird mit der gerenderten Gewinnzeile.
    const alleZeilen = [...html.matchAll(/<td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td>/g)]
        .map(m => ({ label: m[1], wert: betrag(m[2]) }))
        .filter(z => /^[−+=]/.test(z.label) || /^Summe Betriebseinnahmen/.test(z.label));
    const gerechnet = alleZeilen
        .filter(z => !z.label.startsWith('='))
        .reduce((s, z) => s + (z.label.startsWith('−') ? -z.wert : z.wert), 0);
    const ausgewiesen = alleZeilen.filter(z => z.label.startsWith('=')).map(z => z.wert)[0];
    // Toleranz 5 Cent, nicht null: jede Zeile ist auf Cent gerundet dargestellt, neun gerundete
    // Zeilen duerfen gegenueber der ungerundeten Summe um ein paar Cent driften. Groesser darf
    // die Luecke nicht werden — eine fehlende Zeile faellt damit auf.
    check('C4 die ausgewiesenen Zeilen summieren auf die ausgewiesene Gewinnzeile',
        ausgewiesen != null && Math.abs(gerechnet - ausgewiesen) < 0.05);
    check('C5 die Vorsteuer ist nicht null (sonst prueft C4 nichts)', d.vorsteuer > 0);
    check('C6 Regelbesteuerungs-Hinweis statt §19-Hinweis',
        /Regelbesteuerung: Betriebseinnahmen netto/.test(html) && !/§19 UStG/.test(html));
});

// ── Block D: ohne js/euer.js wird keine Zahl erfunden ───────────────────────
block('D', () => {
    const fehler = [];
    const alterError = console.error;
    console.error = (...a) => fehler.push(a.join(' '));
    let html;
    try { html = exportiere(grundgeruest(), { ohneEuer: true }); }
    finally { console.error = alterError; }

    check('D1 das Paket sagt, dass die EUER fehlt',
        /konnte nicht berechnet werden/.test(html));
    check('D2 es steht keine Gewinnzeile drin', zeile(html, '= Gewinn') === null && zeile(html, '= Verlust') === null);
    check('D3 es steht ueberhaupt kein Betrag im EUER-Abschnitt', !/\d,\d\d\s*€/.test(html));
    check('D4 der Fehler wird protokolliert',
        fehler.some(z => /\[Steuerberater\].*euer\.js/.test(z)));
});

console.log('\n' + pass + '/' + total + ' Pruefungen bestanden');
if (pass !== total) process.exitCode = 1;
