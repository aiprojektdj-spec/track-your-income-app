// Self-Test Materiallager:  node test/test-materiallager.js
//
// Fund C des Vollaudits (plan/01-AUFGABEN.md 1.8): Das Modul wurde von keinem Harness geladen.
// Es speist ueber die Einkaeufe die Materialkosten der EUeR (js/euer.js — abgezogen wird der
// EINKAUF, nicht der Verbrauch), und es fuehrt einen Bestand mit gleitendem Durchschnittspreis.
//
// Geprueft werden die zwei Rechenwege, die es wirklich gibt:
//   A) Materiallager._mischpreis()      — gleitender Durchschnitt beim Einkauf
//   B) Store.bookMaterialVerbrauch()    — Abbuchung: Kosten und Bestandsuntergrenze
//
// Beide waren bis 2026-09-14 ungeprueft. _mischpreis stand bis dahin inline im submit-Handler
// und war von aussen gar nicht aufrufbar — die Extraktion gehoert zu diesem Test.
'use strict';
const fs = require('fs');
const path = require('path');

global.window = {};
const mlSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'materiallager.js'), 'utf8');
const ML = new Function(mlSrc + '; return Materiallager;')();

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); }
}
const nah = (a, b) => Math.abs(a - b) < 1e-9;

// ── A) Gleitender Durchschnittspreis ─────────────────────────────────────────
(() => {
    check('A1 erste Lieferung setzt den Preis (kein Bestand zum Mitteln)',
        nah(ML._mischpreis(0, 0, 100, 0.038), 0.038));

    // 100 a 0,038 + 100 a 0,05 => (3,80 + 5,00) / 200 = 0,044
    check('A2 gleiche Mengen mitteln arithmetisch',
        nah(ML._mischpreis(100, 0.038, 100, 0.05), 0.044));

    // Ungleiche Mengen muessen GEWICHTET mitteln, nicht (alt+neu)/2.
    // 900 a 0,10 + 100 a 0,20 => (90 + 20) / 1000 = 0,11 — nicht 0,15.
    check('A3 ungleiche Mengen mitteln gewichtet, nicht arithmetisch',
        nah(ML._mischpreis(900, 0.10, 100, 0.20), 0.11));

    // Drei Nachkommastellen sind Absicht: Verpackung liegt im Cent-Bruchteil.
    check('A4 rundet auf drei Nachkommastellen',
        nah(ML._mischpreis(3, 0.1, 1, 0.2), 0.125));

    // Eine Gratislieferung senkt den Mischpreis, verschenkt ihn aber nicht:
    // 100 a 0,05 + 100 a 0 => 0,025
    check('A5 Gratislieferung senkt den Mischpreis anteilig',
        nah(ML._mischpreis(100, 0.05, 100, 0), 0.025));

    // Robustheit: Strings aus dem Formular, fehlende Felder, Unsinn.
    check('A6 String-Eingaben werden gerechnet, nicht konkateniert',
        nah(ML._mischpreis('100', '0.038', '100', '0.05'), 0.044));
    check('A7 undefined/null fallen auf 0 zurueck, ohne NaN',
        nah(ML._mischpreis(undefined, null, 100, 0.05), 0.05));
    check('A8 Menge 0 laesst den Altpreis unveraendert',
        nah(ML._mischpreis(50, 0.07, 0, 9.99), 0.07));

    // Kein Bestand und keine Menge: es gibt nichts zu mitteln, der neue Preis gilt.
    check('A9 ohne jeden Bestand gilt der neue Preis',
        nah(ML._mischpreis(0, 0, 0, 0.12), 0.12));

    // Regressionsschutz gegen die haeufigste Fehlbauart: (alt + neu) / 2.
    const naiv = (0.10 + 0.20) / 2;
    check('A10 Regression: NICHT der naive Mittelwert',
        !nah(ML._mischpreis(900, 0.10, 100, 0.20), naiv));
})();

// ── B) Verbrauchsbuchung (js/store.js) ───────────────────────────────────────
// bookMaterialVerbrauch wird aus dem Quelltext geschnitten, weil js/store.js als Ganzes
// Browser-APIs braucht. Gleiches Vorgehen wie test-gewinn-eine-quelle.js.
(() => {
    const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf8');
    const start = storeSrc.indexOf('bookMaterialVerbrauch(items, datum, grund, referenzId, referenzBez) {');
    if (start < 0) { console.error('✗ FAIL B0 bookMaterialVerbrauch nicht gefunden — Signatur geaendert?'); total++; return; }
    const open = storeSrc.indexOf('{', start);
    let depth = 0, i = open;
    while (i < storeSrc.length) { if (storeSrc[i] === '{') depth++; else if (storeSrc[i] === '}') { depth--; if (!depth) break; } i++; }
    const body = storeSrc.slice(open + 1, i);

    // Fake-Store: haelt den Bestand im Speicher und protokolliert die Verbrauchseintraege.
    function makeStore(bestand) {
        return {
            _gespeichert: [],
            getMaterialBestand() { return bestand; },
            saveMaterialBestandItem(m) { this._gespeichert.push(m); return m; },
            saveMaterialVerbrauchEintrag(e) { return e; },
            bookMaterialVerbrauch: new Function('items', 'datum', 'grund', 'referenzId', 'referenzBez', body)
        };
    }

    // Normalfall: 10 Stueck a 0,038 verbraucht => 0,38 EUR, Bestand 100 -> 90
    let bestand = [{ id: 'm1', name: 'Polybeutel', einheit: 'Stück', bestand: 100, kostenProEinheit: 0.038 }];
    let S = makeStore(bestand);
    let r = S.bookMaterialVerbrauch([{ materialId: 'm1', menge: 10 }], '2026-09-14', 'manuell');
    check('B1 Kosten = Menge x Stueckpreis, auf Cent gerundet', r.length === 1 && nah(r[0].kosten, 0.38));
    check('B2 Bestand wird um die Menge gesenkt', bestand[0].bestand === 90);
    check('B3 Stueckpreis bleibt beim Verbrauch unveraendert', nah(bestand[0].kostenProEinheit, 0.038));

    // Rundung: 3 x 0,0335 = 0,1005 -> 0,10 (nicht 0,1005 im Eintrag)
    bestand = [{ id: 'm1', name: 'X', bestand: 100, kostenProEinheit: 0.0335 }];
    S = makeStore(bestand);
    r = S.bookMaterialVerbrauch([{ materialId: 'm1', menge: 3 }], '2026-09-14');
    check('B4 Kosten sind auf zwei Stellen gerundet', nah(r[0].kosten, 0.1));

    // Mehr verbrauchen als vorhanden: Bestand faellt auf 0 und NICHT ins Negative.
    bestand = [{ id: 'm1', name: 'X', bestand: 3, kostenProEinheit: 1 }];
    S = makeStore(bestand);
    r = S.bookMaterialVerbrauch([{ materialId: 'm1', menge: 10 }], '2026-09-14');
    check('B5 Bestand faellt nicht unter 0', bestand[0].bestand === 0);
    // Dokumentiert die bewusste Asymmetrie: gebucht wird die ANGEFORDERTE Menge, nicht die
    // verfuegbare. Das ist fuer die EUeR folgenlos (dort zaehlt der Einkauf, nicht der
    // Verbrauch), waere es aber nicht, wenn der Verbrauch je zur Ausgabe wuerde.
    check('B6 gebucht wird die angeforderte Menge, auch wenn der Bestand nicht reicht',
        nah(r[0].kosten, 10) && r[0].menge === 10);

    // Unbekanntes Material und Nullmengen werden still uebersprungen, nicht als 0 gebucht.
    bestand = [{ id: 'm1', name: 'X', bestand: 50, kostenProEinheit: 0.5 }];
    S = makeStore(bestand);
    r = S.bookMaterialVerbrauch([
        { materialId: 'gibtsnicht', menge: 5 },
        { materialId: 'm1', menge: 0 },
        { materialId: 'm1', menge: -3 },
        { materialId: 'm1', menge: 4 }
    ], '2026-09-14');
    check('B7 unbekanntes Material, 0 und negative Mengen erzeugen keinen Eintrag', r.length === 1);
    check('B8 nur die gueltige Position wirkt auf den Bestand', bestand[0].bestand === 46);

    // Mehrere Positionen in einem Aufruf
    bestand = [
        { id: 'm1', name: 'A', bestand: 100, kostenProEinheit: 0.20 },
        { id: 'm2', name: 'B', bestand: 100, kostenProEinheit: 0.50 }
    ];
    S = makeStore(bestand);
    r = S.bookMaterialVerbrauch([{ materialId: 'm1', menge: 10 }, { materialId: 'm2', menge: 2 }], '2026-09-14');
    check('B9 mehrere Positionen werden einzeln bewertet',
        r.length === 2 && nah(r[0].kosten, 2) && nah(r[1].kosten, 1));
    check('B10 jede Position senkt ihren eigenen Bestand',
        bestand[0].bestand === 90 && bestand[1].bestand === 98);
})();

// ── C) Quelltext-Wachen ──────────────────────────────────────────────────────
// Die Rechnung darf nicht in den Handler zurueckwandern, sonst ist sie wieder ungeprueft.
(() => {
    check('C1 _mischpreis existiert als eigene Methode',
        /_mischpreis\s*\(altBestand,\s*altKosten,\s*menge,\s*neuPreis\)/.test(mlSrc));
    check('C2 der Einkauf-Handler ruft sie auf, statt selbst zu rechnen',
        /this\._mischpreis\(altBestand,/.test(mlSrc));
    // Die Mittelung darf genau einmal im Modul stehen — in _mischpreis, wo sie geprueft wird.
    check('C3 die Mittelung steht genau einmal im Modul',
        (mlSrc.match(/ab \* ak \+ m \* np/g) || []).length === 1);
    // Und die alte Inline-Fassung darf nicht zurueckkehren. Genau das war der Zustand, in dem
    // sie kein Harness erreichte.
    check('C4 die alte Inline-Formel ist nicht zurueck',
        !/altBestand \* altKosten/.test(mlSrc));
})();

console.log('\n' + pass + '/' + total + ' Checks bestanden');
if (pass !== total) process.exit(1);
