// Fachlogik der Einkaufs-CSV im Buchungen-Dialog (Buchungen -> CSV Import): Zeilen pruefen,
// Dubletten gegen vorhandene Einkaeufe erkennen, festgeschriebene Perioden ueberspringen.
// Reine Funktionen ohne DOM/Store, Test: test/test-import-buchungen.js.
// Abhaengig von js/import-kern.js und js/import-lager.js (gleicher Dublettenschluessel wie der Lager-Import).
//
//   BuchungenImport.einkaufsZeilen(zeilen, mapping, opt) -> { zeilen: [...], fehler: [{zeile, grund}] }
//     zeilen  = Datenzeilen als Arrays (ohne Kopfzeile), mapping = {feld: spaltenindex}
//     opt     = { nummern: [Dateizeile je Zeile], bestand: [alle Einkaeufe], gesperrt(datum) -> bool }
const BuchungenImport = (function () {
    'use strict';
    var K = ImportKern;

    var TEXTFELDER = ['marke', 'artikeltyp', 'groesse', 'beschreibung', 'einkaufsquelle', 'notizen'];

    function einkaufsZeilen(zeilen, mapping, opt) {
        opt = opt || {};
        var bestand = LagerImport._bestandEinkauf(opt.bestand), zaehler = {};
        var gesperrt = opt.gesperrt || function () { return false; };
        var out = [], fehler = [];
        zeilen.forEach(function (r, i) {
            r = r || [];
            if (r.every(function (c) { return c == null || String(c).trim() === ''; })) return;   // Leerzeile
            var zeile = (opt.nummern && opt.nummern[i]) || i + 2;
            var get = function (f) { return mapping[f] === undefined ? '' : r[mapping[f]]; };
            var txt = function (f) { return String(get(f) == null ? '' : get(f)).trim(); };
            var marke = txt('marke'), beschr = txt('beschreibung');
            var preis = K.zahl(get('einkaufspreis'), null);
            var datum = K.datum(get('datum'));
            if (!marke && !beschr) { fehler.push({ zeile: zeile, grund: 'Marke und Beschreibung fehlen' }); return; }
            if (preis === null) { fehler.push({ zeile: zeile, grund: 'EK-Preis fehlt oder ist keine Zahl' }); return; }
            if (preis < 0) { fehler.push({ zeile: zeile, grund: 'EK-Preis ist negativ' }); return; }
            if (!datum) { fehler.push({ zeile: zeile, grund: 'Datum fehlt oder ist ungültig' }); return; }
            if (gesperrt(datum)) { fehler.push({ zeile: zeile, grund: 'Periode festgeschrieben (Kaufdatum ' + datum + ')' }); return; }
            var row = { status: 'verfuegbar', datum: datum, einkaufspreis: preis };
            TEXTFELDER.forEach(function (f) { if (mapping[f] !== undefined) row[f] = txt(f); });
            if (mapping.anzahl !== undefined) {
                row.anzahl = Math.max(1, Math.min(9999, parseInt(String(get('anzahl') || '').replace(/[^\d]/g, ''), 10) || 1));
            }
            // Ein Datensatz je Zeile (Anzahl ist ein Feld, kein Vervielfacher) -> jede Zeile belegt einen Platz
            var fp = LagerImport.fpEinkauf(datum, marke, beschr, txt('groesse'), preis);
            var nr = (zaehler[fp] = (zaehler[fp] || 0) + 1);
            var dublette = (bestand.fp[fp] || 0) >= nr;
            out.push({
                zeile: zeile, key: fp + '#' + nr, dublette: dublette, importieren: !dublette, row: row,
                label: (marke + ' ' + beschr).trim() + ' · EK ' + preis.toFixed(2).replace('.', ',') + ' €'
            });
        });
        return { zeilen: out, fehler: fehler };
    }

    return { einkaufsZeilen: einkaufsZeilen };
})();
if (typeof window !== 'undefined') window.BuchungenImport = BuchungenImport;
