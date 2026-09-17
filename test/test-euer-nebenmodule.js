// Wie Retouren, Materialverbrauch, Fahrtenbuch und AfA in der EÜR ankommen.
//
// Diese vier Module speisen den Gewinn, hatten aber bis zum 2026-09-09 keinen einzigen Test
// (Kategorie C in plan/funde-vollaudit-2026-09-09.md: 20 von 48 Modulen ohne Abdeckung).
// Genau deshalb konnte auch niemand bemerken, dass drei andere Module den Gewinn ohne sie
// rechneten. Testbar sind sie, seit der Rechenkern als Euer._berechne() aufrufbar ist.
//
// Geprüft wird nicht die Oberfläche der Module, sondern ihre Wirkung auf die Zahl, die am
// Ende beim Finanzamt landet — inklusive der Sonderfälle, die im Code eigens abgefangen sind.
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

const euerSrc = fs.readFileSync(__dirname + '/../js/euer.js', 'utf8');
const _berechne = new Function('year', 'month', 'period',
    extractMethod(euerSrc, '_berechne(year, month, period) {', /\n    \},/));

// Ein Grundgerüst, das jeder Testfall gezielt abwandelt.
function baue(over) {
    const o = Object.assign({
        sales: [], purchases: [], expenses: [], retouren: [],
        // `material` = Verbrauch (Bestandssicht), `materialEinkaeufe` = Einkaeufe.
        // Die EUER liest seit 2026-09-13 die EINKAEUFE — der Verbrauch bleibt im
        // Grundgeruest, damit die Gegenprobe "Verbrauch wirkt NICHT mehr" moeglich ist.
        fahrten: [], material: [], materialEinkaeufe: [], afaAnlagen: [], afaProJahr: 0,
        ustMode: 'klein',
    }, over || {});
    const aktiv = (l) => l.filter(x => !x.storniert);
    global.Utils = {
        isInPeriod: (d, s, e) => !!d && d >= s && d <= e,
        getMonthName: () => 'Monat', formatDate: (d) => d,
    };
    global.Store = {
        getSettings:          () => ({ ustMode: o.ustMode }),
        getSales:             (alle) => (alle ? o.sales : aktiv(o.sales)),
        getPurchases:         (alle) => (alle ? o.purchases : aktiv(o.purchases)),
        getExpenses:          () => aktiv(o.expenses),
        getRechInvoices:      () => [],
        getRetouren:          () => o.retouren,
        getFahrten:           () => o.fahrten,
        getMaterialVerbrauch: () => o.material,
        getMaterialEinkauefe: () => o.materialEinkaeufe,
        getAfaAnlagen:        () => o.afaAnlagen,
        _syncReadRaw:         () => [],
    };
    global.localStorage = { getItem: () => '' };
    global.Afa = { _calcJahresAfa: () => o.afaProJahr };
    global.SteuerBerechnung = {
        nettoRechnungen:      () => ({ netto: 0, ust: 0 }),
        margeEinzeldifferenz: () => 0,
        nettoSales:           () => ({ netto: 0 }),
        nettoRetouren:        () => ({ netto: 0 }),
        nettoPurchases:       () => ({ ust: 0 }),
    };
    return _berechne.call({}, 2026, 0, 'jahr');
}

const VERKAUF = { id: 's1', datum: '2026-03-01', verkaufspreis: 1000, versandkostenKaeufer: 0,
                  versandkostenVerkaufer: 0, plattformgebuehrProzent: 0 };

// ── Retouren (§11 EStG — Rückfluss mindert die Einnahme) ─────────────────────
{
    const d = baue({ sales: [VERKAUF],
        retouren: [{ datum: '2026-04-01', erstattungBetrag: 300, saleId: null }] });
    check('Retoure mindert die Einnahmen', Math.abs(d.retourenErstattungen - 300) < 0.01);
    check('Retoure senkt den Gewinn entsprechend', Math.abs(d.gewinn - 700) < 0.01);
}
{
    // Retoure ausserhalb des Zeitraums zaehlt nicht ins Jahr.
    const d = baue({ sales: [VERKAUF],
        retouren: [{ datum: '2025-12-31', erstattungBetrag: 300, saleId: null }] });
    check('Retoure aus dem Vorjahr bleibt draussen', d.retourenErstattungen === 0);
}
{
    // Der Doppelabzug-Schutz: wurde der Verkauf selbst storniert, ist die Einnahme schon weg.
    // Die Erstattung darf dann NICHT noch einmal abgezogen werden.
    const stornierterVerkauf = Object.assign({}, VERKAUF, { id: 's9', storniert: true });
    const d = baue({ sales: [VERKAUF, stornierterVerkauf],
        retouren: [{ datum: '2026-04-01', erstattungBetrag: 300, saleId: 's9' }] });
    check('Retoure zu storniertem Verkauf wird nicht doppelt abgezogen',
        d.retourenErstattungen === 0 && Math.abs(d.gewinn - 1000) < 0.01);
}
{
    // Gegenprobe: haengt die Retoure an einem AKTIVEN Verkauf, greift sie normal.
    const d = baue({ sales: [VERKAUF],
        retouren: [{ datum: '2026-04-01', erstattungBetrag: 300, saleId: 's1' }] });
    check('Retoure zu aktivem Verkauf wird abgezogen', Math.abs(d.retourenErstattungen - 300) < 0.01);
}

// ── Verpackungsmaterial: EINKAUF statt Verbrauch ─────────────────────────────
// Die EUER kennt keine Bestandsbewertung fuer Umlaufvermoegen: Betriebsausgabe ist die
// Zahlung (§11 Abs. 2 EStG), nicht der Verbrauch. Bis 2026-09-13 zog diese Datei den
// Verbrauch ab — zusammen mit dem Haken "ins Materiallager buchen" im Ausgabenformular
// ergab das einen doppelten Abzug desselben Euros.
{
    const d = baue({ sales: [VERKAUF], materialEinkaeufe: [
        { datum: '2026-05-01', gesamtkosten: 90 },
        { datum: '2025-05-04', gesamtkosten: 30 },                          // Vorjahr
    ]});
    check('Material: nur Einkaeufe im Zeitraum',
        Math.abs(d.materialEinkauf - 90) < 0.01);
    check('Materialeinkauf mindert den Gewinn', Math.abs(d.gewinn - 910) < 0.01);
}

// Gegenprobe: der Verbrauch darf die EUER NICHT mehr beruehren.
{
    const d = baue({ sales: [VERKAUF], material: [
        { datum: '2026-05-01', kosten: 90, grund: 'verkauf' },
    ]});
    check('Verbrauch allein aendert den Gewinn nicht mehr', Math.abs(d.gewinn - 1000) < 0.01);
    check('Verbrauch allein erzeugt keine Materialkosten', Math.abs(d.materialEinkauf - 0) < 0.01);
}

// Der eigentliche Fund: Ausgabe MIT Materiallager-Haken. Die Ausgabe zaehlt, der daraus
// entstandene Einkauf (ausgabeId gesetzt) nicht noch einmal.
{
    const d = baue({
        sales: [VERKAUF],
        expenses: [{ datum: '2026-05-01', betrag: 90, kategorie: 'Verpackung' }],
        materialEinkaeufe: [{ datum: '2026-05-01', gesamtkosten: 90, ausgabeId: 'e1' }],
        material: [{ datum: '2026-06-01', kosten: 90, grund: 'verkauf' }],   // spaeterer Verbrauch
    });
    check('Ausgabe + verknuepfter Einkauf: nur EINMAL abgezogen',
        Math.abs(d.summeAusgaben - 90) < 0.01);
    check('Ausgabe + verknuepfter Einkauf: Gewinn 910 statt 820 (kein Doppelabzug)',
        Math.abs(d.gewinn - 910) < 0.01);
}

// Altdaten ohne ausgabeId: der Marker `lieferant: 'Ausgabe'` haelt sie ebenfalls heraus.
{
    const d = baue({
        sales: [VERKAUF],
        expenses: [{ datum: '2026-05-01', betrag: 90, kategorie: 'Verpackung' }],
        materialEinkaeufe: [{ datum: '2026-05-01', gesamtkosten: 90, lieferant: 'Ausgabe' }],
    });
    check('Altdaten-Marker verhindert den Doppelabzug ebenfalls',
        Math.abs(d.gewinn - 910) < 0.01);
}

// Ein im Materiallager direkt erfasster Einkauf (freier Lieferantentext) zaehlt dagegen.
{
    const d = baue({ sales: [VERKAUF], materialEinkaeufe: [
        { datum: '2026-05-01', gesamtkosten: 90, lieferant: 'Amazon' },
    ]});
    check('Direkt erfasster Einkauf zaehlt normal', Math.abs(d.gewinn - 910) < 0.01);
}

// ── Fahrtenbuch ──────────────────────────────────────────────────────────────
{
    const d = baue({ sales: [VERKAUF], fahrten: [
        { datum: '2026-02-01', kosten: 150 },
        { datum: '2026-06-01', kosten: 60 },
        { datum: '2025-06-01', kosten: 999 },   // Vorjahr
    ]});
    check('Fahrtkosten werden im Zeitraum summiert', Math.abs(d.fahrtkosten - 210) < 0.01);
    check('Fahrtkosten mindern den Gewinn', Math.abs(d.gewinn - 790) < 0.01);
}

// Stornierte Fahrten (2026-09-16). Das Fahrtenbuch storniert GoBD-konform: der Eintrag bleibt
// mit seinem Betrag gespeichert und wird nur durchgestrichen angezeigt. js/fahrtenbuch.js:53
// sagt ausdruecklich "stornierte Eintraege anzeigen aber nicht in Summen zaehlen" und filtert
// selbst auf !storniert. Anders als getSales/getPurchases filtert Store.getFahrten() Stornos
// aber NICHT heraus — die Pruefung muss also in der EUeR sitzen. Fehlt sie, zaehlt eine
// stornierte Fahrt als Betriebsausgabe: Gewinn zu niedrig, Einkommensteuer zu niedrig.
{
    const d = baue({ sales: [VERKAUF], fahrten: [
        { datum: '2026-02-01', kosten: 150 },
        { datum: '2026-03-01', kosten: 400, storniert: true },   // storniert — darf nicht zaehlen
    ]});
    check('Stornierte Fahrt zaehlt nicht als Fahrtkosten', Math.abs(d.fahrtkosten - 150) < 0.01);
    check('Stornierte Fahrt mindert den Gewinn nicht', Math.abs(d.gewinn - 850) < 0.01);
}

// ── AfA (§7 EStG) ────────────────────────────────────────────────────────────
{
    const d = baue({ sales: [VERKAUF], afaAnlagen: [{ id: 'a1' }], afaProJahr: 800 });
    check('AfA fliesst in voller Jahreshoehe ein (period="jahr")',
        Math.abs(d.afaKosten - 800) < 0.01);
    check('AfA mindert den Gewinn', Math.abs(d.gewinn - 200) < 0.01);
}
{
    // Stornierte Anlagen sind draussen — der Filter sitzt in _berechne, nicht im Store.
    const d = baue({ sales: [VERKAUF], afaAnlagen: [{ id: 'a1', storniert: true }], afaProJahr: 800 });
    check('Stornierte Anlage erzeugt keine AfA', d.afaKosten === 0);
}
{
    // Teilzeitraum: zeitanteilig statt voll. Quartal 1 = 90 Tage von 365.
    global.Utils = { isInPeriod: (d, s, e) => !!d && d >= s && d <= e,
                     getMonthName: () => 'M', formatDate: (x) => x };
    global.Store = {
        getSettings: () => ({ ustMode: 'klein' }),
        getSales: () => [], getPurchases: () => [], getExpenses: () => [],
        getRechInvoices: () => [], getRetouren: () => [], getFahrten: () => [],
        getMaterialVerbrauch: () => [], getMaterialEinkauefe: () => [],
        getAfaAnlagen: () => [{ id: 'a1' }],
        _syncReadRaw: () => [],
    };
    global.Afa = { _calcJahresAfa: () => 3650 };   // 10 EUR pro Tag
    const d = _berechne.call({}, 2026, 0, 'quartal');
    // 01.01.-31.03.2026 = 90 Tage -> 3650 * 90/365 = 900
    check('AfA im Quartal zeitanteilig (90/365 von 3.650 = 900)',
        Math.abs(d.afaKosten - 900) < 1);
}

// ── Zusammenspiel: alle vier zugleich ────────────────────────────────────────
{
    const d = baue({
        sales: [VERKAUF],
        retouren: [{ datum: '2026-04-01', erstattungBetrag: 100, saleId: null }],
        materialEinkaeufe: [{ datum: '2026-05-01', gesamtkosten: 90 }],
        fahrten:  [{ datum: '2026-02-01', kosten: 150 }],
        afaAnlagen: [{ id: 'a1' }], afaProJahr: 800,
    });
    // 1000 - 100 Retoure - (90 Material + 150 Fahrt + 800 AfA) = -140
    check('Alle vier zusammen: Gewinn = -140 (Verlust)', Math.abs(d.gewinn - (-140)) < 0.01);
    check('Alle vier zusammen: Summe Ausgaben = 1.040',
        Math.abs(d.summeAusgaben - 1040) < 0.01);
}

console.log('\n' + pass + '/' + total + ' Checks bestanden');
if (pass !== total) process.exit(1);
