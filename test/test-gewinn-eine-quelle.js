// Regressionstest: der Gewinn hat GENAU EINE Quelle.
//
// Hintergrund (Fund A1/A2, plan/funde-vollaudit-2026-09-09.md): js/gewerbesteuer.js rechnete
// den Gewinn bis zum 2026-09-09 selbst — ohne AfA, Fahrtkosten, Eigenbelege, Material,
// Retouren, Plattformgebuehren und Verkaeufer-Versand. Daraus entstanden unmittelbar
// Messbetrag und Steuerschuld, waehrend js/euer.js fuer dasselbe Jahr eine andere Zahl
// zeigte. Seitdem zieht _calcGewinn() den Wert aus Euer._berechne().
//
// Der Test haelt beides fest:
//   1. Euer._berechne() rechnet den EUER-Gewinn korrekt (Wert von Hand nachgerechnet),
//   2. Gewerbesteuer._calcGewinn() liefert EXAKT denselben Wert — keine zweite Formel,
//   3. die alte Formel wich um 1.905 EUR ab (Gegenprobe, damit der Rueckbau auffaellt).
//
// Vorgehen wie in den uebrigen Harnessen: Quelltext-Extraktion, da die Dateien wegen der
// Browser-Globals nicht per require() ladbar sind.
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
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}

// ── Datensatz ────────────────────────────────────────────────────────────────
// Zwei Verkaeufe (einer storniert), ein Einkauf, eine Ausgabe, dazu je ein Posten
// aus den Modulen, die die alte Gewerbesteuer-Formel ignorierte.
const SALES_ALLE = [
    { id: 's1', datum: '2026-03-01', verkaufspreis: 1000, versandkostenKaeufer: 50,
      versandkostenVerkaufer: 40, plattformgebuehrProzent: 10 },
    { id: 's2', datum: '2026-05-01', verkaufspreis: 500, versandkostenKaeufer: 0,
      versandkostenVerkaufer: 20, plattformgebuehrProzent: 10, storniert: true },
];
const SALES_AKTIV = SALES_ALLE.filter(s => !s.storniert);
const PURCHASES   = [{ id: 'p1', datum: '2026-02-01', einkaufspreis: 300, anzahl: 2 }];
const EXPENSES    = [{ datum: '2026-04-01', betrag: 200 }];
const EIGENBELEGE = [{ belegDatum: '2026-06-01', betragNetto: 120 }];

global.Utils = {
    isInPeriod: (d, s, e) => !!d && d >= s && d <= e,
    getMonthName: () => 'Monat',
    formatDate: (d) => d,
};
global.Store = {
    getSettings:         () => ({ ustMode: 'klein' }),   // §19 UStG: keine USt-Extraktion
    getSales:            (alle) => (alle ? SALES_ALLE : SALES_AKTIV),
    getPurchases:        () => PURCHASES,
    getExpenses:         () => EXPENSES,
    getRechInvoices:     () => [],
    getRetouren:         () => [{ datum: '2026-07-01', erstattungBetrag: 100, saleId: null }],
    getFahrten:          () => [{ datum: '2026-05-01', kosten: 150 }],
    getMaterialVerbrauch:() => [{ datum: '2026-05-01', kosten: 90, grund: 'verkauf' }],
    getAfaAnlagen:       () => [{ id: 'a1' }],
    _syncReadRaw:        () => EIGENBELEGE,
};
global.localStorage = { getItem: () => '' };
global.Afa = { _calcJahresAfa: () => 800 };
global.SteuerBerechnung = {
    nettoRechnungen:      () => ({ netto: 0, ust: 0 }),
    margeEinzeldifferenz: () => 0,
};

// ── 1) Euer._berechne(): der EUER-Gewinn ─────────────────────────────────────
// Von Hand: Einnahmen 1000 + 50 = 1050, minus 100 Retoure = 950.
// Ausgaben  600 Ware + 40 Versand + 105 Gebuehr + 150 Fahrt + 90 Material
//         + 200 Ausgabe + 120 Eigenbeleg + 800 AfA = 2105.
// Gewinn = 950 - 2105 = -1155.
const euerSrc = fs.readFileSync(__dirname + '/../js/euer.js', 'utf8');
const berechneBody = extractMethod(euerSrc, '_berechne(year, month, period) {', /\n    \},/);
const _berechne = new Function('year', 'month', 'period', berechneBody);

const d = _berechne.call({}, 2026, 0, 'jahr');
check('Euer._berechne(): Gewinn = -1155 EUR', Math.abs(d.gewinn - (-1155)) < 0.01);
check('Euer._berechne(): AfA enthalten (800)',            Math.abs(d.afaKosten - 800) < 0.01);
check('Euer._berechne(): Fahrtkosten enthalten (150)',    Math.abs(d.fahrtkosten - 150) < 0.01);
check('Euer._berechne(): Material enthalten (90)',        Math.abs(d.materialKosten - 90) < 0.01);
check('Euer._berechne(): Eigenbelege enthalten (120)',    Math.abs(d.eigenbelegeAusgaben - 120) < 0.01);
check('Euer._berechne(): Retoure mindert Einnahmen (100)',Math.abs(d.retourenErstattungen - 100) < 0.01);
check('Euer._berechne(): Plattformgebuehr auf VK+Versand (105)', Math.abs(d.plattformgebuehren - 105) < 0.01);
check('Euer._berechne(): stornierter Verkauf zaehlt nicht mit', d.sales.length === 1);

// ── 2) _berechne() fasst keinen State an ─────────────────────────────────────
// Wichtig, weil js/gewerbesteuer.js die Methode fuer ein anderes Jahr aufruft als das,
// welches die EUER-Ansicht gerade zeigt. Wuerde _berechne() _lastRenderData setzen,
// wuerde ein Blick auf die Gewerbesteuer die angezeigte EUER ueberschreiben.
{
    const self = {};
    _berechne.call(self, 2026, 0, 'jahr');
    check('_berechne(): setzt kein _lastGewinn/_lastRenderData',
        self._lastGewinn === undefined && self._lastRenderData === undefined);
}

// ── 3) Gewerbesteuer._calcGewinn(): identischer Wert, keine zweite Formel ─────
const gewSrc = fs.readFileSync(__dirname + '/../js/gewerbesteuer.js', 'utf8');
const calcGewinnBody = extractMethod(gewSrc, '_calcGewinn(year) {', /\n    \},/);
const _calcGewinn = new Function('year', calcGewinnBody);

global.Euer = { _berechne: (y, m, p) => _berechne.call({}, y, m, p) };
const gewGewinn = _calcGewinn.call({}, 2026);
check('Gewerbesteuer._calcGewinn() = Euer-Gewinn (-1155)', Math.abs(gewGewinn - (-1155)) < 0.01);
check('Gewerbesteuer._calcGewinn() === Euer._berechne().gewinn', gewGewinn === d.gewinn);

// Erhebungszeitraum ist das Kalenderjahr (§14 GewStG) — die Periode muss fest 'jahr' sein,
// egal was die EUER-Ansicht gerade zeigt.
{
    let gesehen = null;
    global.Euer = { _berechne: (y, m, p) => { gesehen = { y, p }; return { gewinn: 0 }; } };
    _calcGewinn.call({}, 2024);
    check('_calcGewinn(): fragt Jahr 2024 als Periode "jahr" ab',
        gesehen && gesehen.y === 2024 && gesehen.p === 'jahr');
}

// Fehlt js/euer.js, darf keine geratene Zahl entstehen.
{
    const echteEuer = global.Euer;
    delete global.Euer;
    const err = console.error; console.error = () => {};
    const g = _calcGewinn.call({}, 2026);
    console.error = err;
    check('_calcGewinn(): ohne js/euer.js -> 0 statt geratener Gewinn', g === 0);
    global.Euer = echteEuer;
}

// ── 4) Gegenprobe: was die alte Formel geliefert haette ──────────────────────
// Wortlaut der bis 2026-09-09 in js/gewerbesteuer.js stehenden Berechnung.
//
// Wichtig fuer die Nachbildung: Store.getSales()/getPurchases()/getExpenses() filtern
// stornierte Datensaetze BEREITS SELBST (js/store.js:1563/1435/1738 — nur getSales(true)
// liefert sie mit). Die alte Formel sah also sehr wohl nur aktive Verkaeufe; ihr Fehler
// lag ausschliesslich in den ausgelassenen Ausgabenarten. Eine erste Fassung dieses Tests
// unterstellte hier faelschlich fehlende Storno-Filterung und kam dadurch auf zu hohe Werte.
{
    let einnahmen = 0, ausgaben = 0;
    SALES_AKTIV.forEach(s => einnahmen += s.verkaufspreis + s.versandkostenKaeufer);
    PURCHASES.forEach(p => ausgaben += p.einkaufspreis * p.anzahl);
    EXPENSES.forEach(e => ausgaben += e.betrag);
    const alt = einnahmen - ausgaben;
    check('Gegenprobe: alte Formel lieferte 250 EUR', Math.abs(alt - 250) < 0.01);
    check('Gegenprobe: Abweichung betrug 1.405 EUR',  Math.abs((alt - d.gewinn) - 1405) < 0.01);
    check('Gegenprobe: alte Formel wies Gewinn aus, wo ein Verlust steht', alt > 0 && d.gewinn < 0);
    // Genau die Posten, die der alten Formel fehlten:
    check('Gegenprobe: Luecke = AfA + Fahrt + Material + Eigenbeleg + Gebuehr + Versand + Retoure',
        Math.abs((alt - d.gewinn) - (800 + 150 + 90 + 120 + 105 + 40 + 100)) < 0.01);
}

// ── 5) Steuerliche Auswirkung ueber dem Freibetrag (§11 Abs. 1 GewStG) ───────
// Unterhalb von 24.500 EUR faellt der Unterschied nicht auf — darueber voll.
{
    const gewStVon = (g) => {
        const ertrag = Math.floor(Math.max(0, g - 24500) / 100) * 100;
        return ertrag * 0.035 * 4;   // Messzahl 3,5 %, Hebesatz 400 %
    };
    const skal = 200;                  // erst hier traegt die alte Zahl ueber den Freibetrag
    const altGross  = 250 * skal;      //   50.000
    const euerGross = -1155 * skal;    // -231.000
    check('Freibetrag-Fall: alte Formel haette 3.570 EUR GewSt ausgewiesen',
        Math.abs(gewStVon(altGross) - 3570) < 0.01);
    check('Freibetrag-Fall: auf den EUER-Verlust faellt keine GewSt an',
        gewStVon(euerGross) === 0);
}

// ── 6) render() laeuft nach der Trennung weiter durch ────────────────────────
// Der Rechenkern wurde am 2026-09-09 aus render() herausgeloest; render() bezieht seine
// ~38 Werte seitdem per Destrukturierung aus _berechne(). Faellt dabei ein Bezeichner
// unter den Tisch, gibt es keinen Syntaxfehler — die Seite bricht erst zur Laufzeit im
// Browser mit einem ReferenceError. Deshalb wird render() hier wirklich ausgefuehrt.
{
    global.Rechtsform = {
        brauchtBilanzStattEuer: () => false,
        isKapitalgesellschaft:  () => false,
        getConfig: () => ({ bilanzPflicht: false, gewStFreibetrag: 24500 }),
        get: () => 'Einzelunternehmen',
    };
    global.GbR = { renderEuerBlock: () => '' };
    global.Utils.formatCurrency = (v) => Number(v).toFixed(2) + ' €';
    global.Utils.escapeHtml = (s) => String(s);

    const render = new Function(extractMethod(euerSrc, 'render() {', /\n    \},/));
    const self = {
        _view: 'euer', _selectedYear: 2026, _selectedMonth: 4, _period: 'jahr',
        _customStart: null, _customEnd: null, _detailView: null, _lastRenderData: {},
        _renderViewTabs:          () => '<nav></nav>',
        _renderDetailSection:     () => '',
        _renderGewerbesteuerBlock: () => '',
        _berechne: function (y, m, p) { return _berechne.call(this, y, m, p); },
    };

    let html = null, fehler = null;
    try { html = render.call(self); } catch (e) { fehler = e; }

    check('render(): laeuft ohne ReferenceError durch (Destrukturierung vollstaendig)',
        !fehler || !(fehler instanceof ReferenceError));
    if (fehler) console.error('   → ' + fehler.message);
    check('render(): liefert HTML', typeof html === 'string' && html.length > 500);
    check('render(): setzt _lastGewinn auf den Wert aus _berechne()',
        Math.abs(self._lastGewinn - d.gewinn) < 0.01);
    check('render(): fuellt _lastRenderData (von _renderDetailSection gebraucht)',
        Object.keys(self._lastRenderData).length === 25);
}

// ── 7) dashboard.js zieht dieselbe Zahl ──────────────────────────────────────
// _getYearStats() speist den Jahresvergleich ("Gewinn"/"Marge") und das Gewinn-Chart.
{
    const dashSrc = fs.readFileSync(__dirname + '/../js/dashboard.js', 'utf8');
    const statsBody = extractMethod(dashSrc, '_getYearStats(year) {', /\n    \},/);
    const _getYearStats = new Function('year', statsBody);

    global.Euer = { _berechne: (y, m, p) => _berechne.call({}, y, m, p) };
    const st = _getYearStats.call({}, 2026);

    check('dashboard._getYearStats(): Gewinn = EUER-Gewinn', Math.abs(st.gewinn - d.gewinn) < 0.01);
    check('dashboard._getYearStats(): Einnahmen = summeEinnahmen',
        Math.abs(st.einnahmen - d.summeEinnahmen) < 0.01);
    check('dashboard._getYearStats(): Ausgaben = summeAusgaben',
        Math.abs(st.ausgaben - d.summeAusgaben) < 0.01);
    // A3: der vom Kaeufer gezahlte Versand zaehlte frueher nicht als Einnahme, seine
    // Plattformgebuehr aber sehr wohl als Kosten. Jetzt ist er drin (1000 + 50 - 100 Retoure).
    check('dashboard: Kaeufer-Versand zaehlt als Einnahme (A3 behoben)',
        Math.abs(st.einnahmen - 950) < 0.01);
    // Vertriebskennzahlen bleiben Vertriebskennzahlen
    check('dashboard: anzahl = Zahl der aktiven Verkaeufe', st.anzahl === 1);
    check('dashboard: avgVK = Verkaufspreis, nicht Gewinnanteil', Math.abs(st.avgVK - 1000) < 0.01);

    const ohneEuer = (() => {
        const e = global.Euer; delete global.Euer;
        const err = console.error; console.error = () => {};
        const r = _getYearStats.call({}, 2026);
        console.error = err; global.Euer = e; return r;
    })();
    check('dashboard: ohne js/euer.js -> Nullen statt geratener Zahlen',
        ohneEuer.gewinn === 0 && ohneEuer.einnahmen === 0);
}

// ── 8) privatbuchungen.js zieht dieselbe Zahl ────────────────────────────────
// Der Gewinn ist dort eine lokale Variable in render(); geprueft wird deshalb das
// erzeugte HTML — genau der Wert, den die Kachel "Betriebsgewinn (EÜR)" anzeigt und
// an dem die Warnung "Entnahmen uebersteigen den Gewinn" haengt.
{
    const privSrc = fs.readFileSync(__dirname + '/../js/privatbuchungen.js', 'utf8');
    const renderBody = extractMethod(privSrc, 'render() {', /\n    \},/);
    const privRender = new Function(renderBody);

    global.Euer = { _berechne: (y, m, p) => _berechne.call({}, y, m, p) };
    global.Store.getPrivatbuchungen = () => [
        { id: 'e1', datum: '2026-04-01', typ: 'entnahme', betrag: 500, beschreibung: 'Privat' },
    ];
    let gesehen = [];
    global.Utils.formatCurrency = (v) => { gesehen.push(Number(v)); return Number(v).toFixed(2) + ' €'; };
    global.Utils.formatDate = (x) => x;

    const html = privRender.call({ _selectedYear: 2026 });
    check('privatbuchungen: render() liefert HTML', typeof html === 'string' && html.length > 500);
    check('privatbuchungen: zeigt den EUER-Gewinn (-1155)',
        gesehen.some(v => Math.abs(v - d.gewinn) < 0.01));
    check('privatbuchungen: zeigt NICHT mehr die alte Zahl (210)',
        !gesehen.some(v => Math.abs(v - 210) < 0.01));
    // Bei einem Verlust darf die Warnung "Entnahmen > Gewinn" nicht erscheinen: sie ist an
    // gewinn > 0 gebunden. Vorher stand dort ein Gewinn von 210 -> Warnung bei 500 Entnahme.
    check('privatbuchungen: keine Entnahme-Warnung bei Verlust',
        html.indexOf('übersteigen den Betriebsgewinn') === -1);
}

console.log('\n' + pass + '/' + total + ' Checks bestanden');
if (pass !== total) process.exit(1);
