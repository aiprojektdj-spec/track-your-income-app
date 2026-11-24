// Gemeinsamer Kern fuer alle Datei-Importe/-Exporte (Lager, Verkaeufe, Vorlage, CSV-Exporte).
// Reine Funktionen, kein DOM, kein Store: laeuft im Browser und im Node-Test (test/test-import-kern.js).
//
//   ImportKern.zahl('1.234,56 €')      -> 1234.56   (DE und EN, Tausendertrenner; leer/ungueltig -> 0)
//   ImportKern.datum('24.11.2026')     -> '2026-11-24' (ISO, TT.MM.JJJJ, TT/MM/JJJJ, Excel-Serie) oder null
//   ImportKern.schluessel([...], zaehler) -> 'teil|teil#n' (Laufnummer pro Import, wie js/bank-import.js)
//   ImportKern.fehlerCsv([{zeile, grund}]) -> CSV-Text (UTF-8 mit BOM, Semikolon)
const ImportKern = (function () {
    'use strict';

    // Zahl aus Text oder Zelle. Letztes Trennzeichen ist Dezimal, wenn beide vorkommen;
    // nur ein Komma = DE-Dezimal; nur ein Punkt = Dezimalpunkt ('1.234' ist 1,234, nicht 1234).
    // leer: Rueckgabe bei leerer/ungueltiger Eingabe (Standard 0; null zum Unterscheiden).
    function zahl(v, leer) {
        var fallback = leer === undefined ? 0 : leer;
        if (typeof v === 'number') return isFinite(v) ? v : fallback;
        if (v == null || v === '') return fallback;
        var s = String(v).replace(/[^\d.,\-]/g, '');
        if (!s) return fallback;
        if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
            s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
        } else if (s.indexOf(',') > -1) {
            s = s.replace(',', '.');
        }
        var n = parseFloat(s);
        return isNaN(n) ? fallback : n;
    }

    function _iso(y, m, d) {
        // Echter Kalendertag? (31.02. -> null)
        var t = new Date(Date.UTC(y, m - 1, d));
        if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
        return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }

    // Datum als 'JJJJ-MM-TT' (lokal, nie toISOString) oder null.
    // Mehrdeutig (beide Teile <= 12) gilt TT/MM; ist ein Teil > 12, steht er fuer den Tag.
    function datum(v) {
        if (v == null || v === '') return null;
        if (v instanceof Date) {
            return isNaN(v.getTime()) ? null : _iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
        }
        var s = String(v).trim();
        if (!s) return null;
        var m;
        // Excel-Seriennummer: fuenf Stellen = 1927 bis 2173
        if (/^\d{5}(\.\d+)?$/.test(s)) {
            var d = new Date(Math.round((parseFloat(s) - 25569) * 86400000));
            return _iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        }
        m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/);
        if (m) return _iso(+m[1], +m[2], +m[3]);
        m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})(?!\d)/);
        if (m) {
            var a = +m[1], b = +m[2], y = m[3].length === 2 ? 2000 + (+m[3]) : +m[3];
            var tag = a, mon = b;
            if (b > 12 && a <= 12) { tag = b; mon = a; }
            return _iso(y, mon, tag);
        }
        return null;
    }

    function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }

    // Teile -> Fingerabdruck (ohne Laufnummer): normalisierte Teile, mit | getrennt.
    function fingerprint(teile) {
        return teile.map(function (t) { return typeof t === 'number' ? String(t) : norm(t); }).join('|');
    }

    // Teile -> Schluessel. zaehler ist ein Objekt, das der Aufrufer pro Importlauf frisch anlegt:
    // zwei gleiche Zeilen in einer Datei ergeben #1/#2, dieselbe Datei erneut ergibt wieder #1/#2.
    function schluessel(teile, zaehler) {
        var fp = fingerprint(teile);
        zaehler = zaehler || {};
        zaehler[fp] = (zaehler[fp] || 0) + 1;
        return fp + '#' + zaehler[fp];
    }

    // Zeilennummern wie in der Datei (1-basiert) fuer die nicht leeren Datenzeilen.
    // aoa = alle Zeilen inkl. Leerzeilen (sheet_to_json mit header:1), kopfIdx = 0-basierte Kopfzeile.
    // sheet_to_json laesst Leerzeilen weg; die Nummern muessen trotzdem zur Datei passen.
    function zeilennummern(aoa, kopfIdx) {
        var nr = [];
        for (var i = kopfIdx + 1; i < aoa.length; i++) {
            var leer = (aoa[i] || []).every(function (c) { return c == null || String(c).trim() === ''; });
            if (!leer) nr.push(i + 1);
        }
        return nr;
    }

    function csvZelle(v) {
        var s = v == null ? '' : String(v);
        return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    function csvZeile(felder) { return felder.map(csvZelle).join(';'); }

    // Fehlerdatei zum Import: eine Zeile je uebersprungener Zeile. Zeilennummer wie in der Datei.
    function fehlerCsv(liste) {
        var zeilen = ['Zeile;Grund'];
        (liste || []).forEach(function (f) { zeilen.push(csvZeile([f.zeile, f.grund])); });
        return '﻿' + zeilen.join('\r\n') + '\r\n';
    }

    return { zahl: zahl, datum: datum, norm: norm, fingerprint: fingerprint, schluessel: schluessel, zeilennummern: zeilennummern, csvZelle: csvZelle, csvZeile: csvZeile, fehlerCsv: fehlerCsv };
})();
if (typeof window !== 'undefined') window.ImportKern = ImportKern;
