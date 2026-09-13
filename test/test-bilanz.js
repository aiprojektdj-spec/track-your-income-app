// js/bilanz.js — GuV und Aktivseite fuer die bilanzpflichtigen Rechtsformen
// (GmbH, UG, OHG, KG, GmbH & Co. KG).
//
// Das Modul hatte bis zum 2026-09-13 keinen Test. Es las die Abschreibungen aus
// Store.get('afa_items') — einem Key, den NIEMAND schreibt; das Anlagenverzeichnis liegt
// unter 'afa_anlagen' (Store.getAfaAnlagen). Folge: AfA in der GuV immer 0 und
// Anlagevermoegen auf der Aktivseite immer 0. Getroffen hat das ausgerechnet die
// Rechtsformen, die keine EUER aufstellen duerfen und deshalb keine zweite Ansicht haben,
// in der die Abschreibung korrekt erschiene.
//
// Anders als bei Fund A1/A6 ist eine eigene Rechnung hier fachlich RICHTIG: eine GuV nach
// §4 Abs. 1 EStG / HGB folgt der Periodenabgrenzung, die EUER dem Zufluss-/Abflussprinzip
// (§4 Abs. 3 EStG). Der EUER-Gewinn darf hier also gerade nicht uebernommen werden.
// Geprueft wird deshalb die Rechnung selbst, nicht die Gleichheit mit der EUER.
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

const bilanzSrc = fs.readFileSync(__dirname + '/../js/bilanz.js', 'utf8');
const afaSrc    = fs.readFileSync(__dirname + '/../js/afa.js', 'utf8');
const _calcGuV  = new Function('year', extractMethod(bilanzSrc, '_calcGuV(year) {', /\n    \},/));

// Das echte js/afa.js als Global — die Rechnung soll durch den produktiven Code laufen,
// nicht durch eine Nachbildung.
const Afa = new Function(afaSrc + '\nreturn Afa;')();

// Eine Anlage: 12.000 EUR, 5 Jahre linear, gekauft 01.01.2026 -> 2.400 EUR pro Jahr.
const ANLAGE = {
    id: 'a1', bezeichnung: 'Transporter', anschaffungskosten: 12000,
    nutzungsdauer: 5, anschaffungsdatum: '2026-01-01', methode: 'linear',
};

function baue(over) {
    const o = Object.assign({ sales: [], purchases: [], expenses: [], retouren: [],
                              afaAnlagen: [], ustMode: 'klein' }, over || {});
    global.Afa = Afa;
    global.Store = {
        getSettings:    () => ({ ustMode: o.ustMode }),
        getSales:       (alle) => (alle ? o.sales : o.sales.filter(s => !s.storniert)),
        getPurchases:   () => o.purchases.filter(p => !p.storniert),
        getExpenses:    () => o.expenses,
        getRetouren:    () => o.retouren,
        getRechInvoices: () => [],
        getAfaAnlagen:  () => o.afaAnlagen,
        get: (k) => (k === 'bilanz_data' ? {} : null),
        set: () => {},
    };
    global.SteuerBerechnung = {
        nettoSales:      (l) => ({ netto: l.reduce((s, x) => s + (parseFloat(x.verkaufspreis) || 0), 0) }),
        nettoRechnungen: () => ({ netto: 0, ust: 0 }),
        nettoRetouren:   (l) => ({ netto: l.reduce((s, r) => s + (parseFloat(r.erstattungBetrag) || 0), 0),
                                   brutto: l.reduce((s, r) => s + (parseFloat(r.erstattungBetrag) || 0), 0) }),
        nettoPurchases:  (l) => ({ netto: l.reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0), 0),
                                   brutto: l.reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0), 0) }),
        nettoExpenses:   (l) => ({ netto: l.reduce((s, a) => s + (parseFloat(a.betrag) || 0), 0), byKategorie: {} }),
    };
    return _calcGuV.call({ _getYearData: () => ({ guv_korrekturen: [] }) }, 2026);
}

// ── Die AfA kommt ueberhaupt an ──────────────────────────────────────────────
{
    const g = baue({
        sales:    [{ datum: '2026-03-01', verkaufspreis: 50000 }],
        afaAnlagen: [ANLAGE],
    });
    check('AfA landet in der GuV (12.000 / 5 Jahre = 2.400)', Math.abs(g.afaJahr - 2400) < 0.01);
    check('AfA mindert das Betriebsergebnis',
        Math.abs(g.betriebsergebnis - (50000 - 2400)) < 0.01);
    check('AfA mindert den Jahresueberschuss',
        Math.abs(g.jahresueberschuss - (50000 - 2400)) < 0.01);
}
{
    // Ohne Anlagen bleibt es bei 0 — aber eben nur dann.
    const g = baue({ sales: [{ datum: '2026-03-01', verkaufspreis: 50000 }] });
    check('Ohne Anlagen ist die AfA 0', g.afaJahr === 0);
}
{
    // Stornierte Anlagen zaehlen nicht. Der alte Code fragte `item.aktiv` — ein Feld, das es
    // an einer Anlage nicht gibt; damit fiel jede Anlage heraus, auch die gueltigen.
    const g = baue({
        sales: [{ datum: '2026-03-01', verkaufspreis: 50000 }],
        afaAnlagen: [Object.assign({}, ANLAGE, { storniert: true })],
    });
    check('Stornierte Anlage erzeugt keine AfA', g.afaJahr === 0);
}
{
    // GWG-Sofortabschreibung §6 Abs. 2 EStG: volle AK im Anschaffungsjahr.
    const g = baue({
        sales: [{ datum: '2026-03-01', verkaufspreis: 50000 }],
        afaAnlagen: [{ id: 'g1', anschaffungskosten: 800, nutzungsdauer: 3,
                       anschaffungsdatum: '2026-06-15', methode: 'sofort' }],
    });
    check('GWG: volle 800 EUR im Anschaffungsjahr, keine Monatsregel',
        Math.abs(g.afaJahr - 800) < 0.01);
}
{
    // Monatsregel §7 Abs. 1 S. 4 EStG: im Anschaffungsjahr nur zeitanteilig.
    // Kauf im Juli -> 6/12 von 2.400 = 1.200. Der alte `ak / nd` haette 2.400 gezeigt.
    const g = baue({
        sales: [{ datum: '2026-03-01', verkaufspreis: 50000 }],
        afaAnlagen: [Object.assign({}, ANLAGE, { anschaffungsdatum: '2026-07-01' })],
    });
    check('Monatsregel: Kauf im Juli ergibt 1.200, nicht 2.400',
        Math.abs(g.afaJahr - 1200) < 0.01);
}

// ── Die uebrige GuV-Rechnung ─────────────────────────────────────────────────
{
    const g = baue({
        sales:     [{ datum: '2026-03-01', verkaufspreis: 10000 }],
        purchases: [{ datum: '2026-02-01', einkaufspreis: 4000 }],
        expenses:  [{ datum: '2026-04-01', betrag: 1000 }],
        retouren:  [{ datum: '2026-05-01', erstattungBetrag: 500, saleId: null }],
        afaAnlagen: [ANLAGE],
    });
    check('Umsatzerloese abzueglich Retouren (10.000 - 500)',
        Math.abs(g.umsatzerloese - 9500) < 0.01);
    check('Rohertrag = Umsatz - Wareneinsatz (9.500 - 4.000)',
        Math.abs(g.rohertrag - 5500) < 0.01);
    check('Betriebsergebnis = Rohertrag - Ausgaben - AfA (5.500 - 1.000 - 2.400)',
        Math.abs(g.betriebsergebnis - 2100) < 0.01);
    check('Jahresueberschuss ohne Korrekturen = Betriebsergebnis',
        Math.abs(g.jahresueberschuss - g.betriebsergebnis) < 0.01);
}
{
    // Retoure zu einem stornierten Verkauf: die Einnahme ist schon raus, kein Doppelabzug.
    const g = baue({
        sales: [{ id: 's1', datum: '2026-03-01', verkaufspreis: 10000 },
                { id: 's9', datum: '2026-03-02', verkaufspreis: 3000, storniert: true }],
        retouren: [{ datum: '2026-05-01', erstattungBetrag: 3000, saleId: 's9' }],
    });
    check('Retoure zu storniertem Verkauf wird nicht doppelt abgezogen',
        Math.abs(g.umsatzerloese - 10000) < 0.01);
}

// ── Regressionsschutz gegen die tote Quelle ──────────────────────────────────
// Kommentare rausschneiden, bevor der Quelltext geprueft wird: die Erklaerungen zum Fix
// zitieren `Store.get('afa_items')` und `new Date().getFullYear()` woertlich, und ein
// naiver Regex haelt genau die Begruendung fuer den Fehler.
const ohneKommentare = bilanzSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
{
    check('Regression: kein Zugriff mehr auf den toten Key afa_items',
        !/Store\.get\(\s*['"]afa_items['"]\s*\)/.test(ohneKommentare));
    check('Regression: kein Filter mehr auf das nicht existierende Feld aktiv',
        !/\.aktiv\b/.test(ohneKommentare));
    check('Regression: AfA kommt aus js/afa.js',
        /Afa\._totalAfaFuerJahr\(\s*year\s*\)/.test(ohneKommentare));
    check('Regression: Anlagevermoegen ueber Afa._buchwertEnde(..., year)',
        /_buchwertEnde\([^)]*,\s*year\s*\)/.test(ohneKommentare));
    // Die Aktivseite muss gegen das BILANZJAHR rechnen, nicht gegen heute: der alte
    // Restwert nutzte new Date().getFullYear(), eine Bilanz fuer 2024 zeigte damit den
    // Buchwert von heute.
    const aktivaBlock = extractMethod(ohneKommentare, '_renderAktiva(year) {', /\n    \},/);
    check('Regression: Aktivseite rechnet nicht mehr gegen new Date().getFullYear()',
        !/new Date\(\)\.getFullYear\(\)/.test(aktivaBlock));
}

// ── _renderAktiva() wirklich ausfuehren ──────────────────────────────────────
// Der Grund fuer diesen Block: beim Fix blieb zunaechst eine dritte Stelle stehen, die
// weiter die geloeschte Variable `afaItems` ansprach. `node --check` sieht so etwas nicht
// (Syntax ist gueltig), und ein Regex auch nicht — erst der Aufruf wirft den ReferenceError.
{
    global.Afa = Afa;
    global.Utils = {
        formatCurrency: (v) => Number(v).toFixed(2) + ' €',
        escapeHtml: (s) => String(s),
    };
    global.Store = {
        getAfaAnlagen: () => [ANLAGE, Object.assign({}, ANLAGE, { id: 'a2', storniert: true })],
        get: () => ({}), set: () => {},
    };
    const _renderAktiva = new Function('year',
        extractMethod(bilanzSrc, '_renderAktiva(year) {', /\n    \},/));

    let html = null, fehler = null;
    try {
        html = _renderAktiva.call({ _getYearData: () => ({ aktiva: {} }) }, 2026);
    } catch (e) { fehler = e; }

    check('_renderAktiva(): laeuft ohne ReferenceError durch',
        !fehler || !(fehler instanceof ReferenceError));
    if (fehler) console.error('   → ' + fehler.message);
    check('_renderAktiva(): liefert HTML', typeof html === 'string' && html.length > 200);
    // 9.600 = Buchwert Ende 2026; die stornierte Zweitanlage darf nicht mitgezaehlt werden.
    check('_renderAktiva(): zeigt den Buchwert 9.600, nicht 19.200',
        !!html && html.indexOf('9600.00') !== -1 && html.indexOf('19200.00') === -1);
}

// ── Buchwert auf der Aktivseite ──────────────────────────────────────────────
{
    // 12.000 EUR, 5 Jahre, Kauf 01.01.2026: Ende 2026 sind 2.400 abgeschrieben -> 9.600.
    global.Store = { getAfaAnlagen: () => [ANLAGE] };
    const bw = [ANLAGE].filter(a => !a.storniert)
        .reduce((s, a) => s + Afa._buchwertEnde(a, 2026), 0);
    check('Buchwert Ende 2026 = 9.600 EUR', Math.abs(bw - 9600) < 0.01);
    const bw28 = [ANLAGE].reduce((s, a) => s + Afa._buchwertEnde(a, 2028), 0);
    check('Buchwert Ende 2028 = 4.800 EUR (drei Jahre abgeschrieben)',
        Math.abs(bw28 - 4800) < 0.01);
}

console.log('\n' + pass + '/' + total + ' Checks bestanden');
if (pass !== total) process.exit(1);
