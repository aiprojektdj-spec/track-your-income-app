// Ausgaben-CSV importieren (Ausgaben-Seite -> "CSV Import"): Zeilen pruefen, Dubletten gegen vorhandene
// Ausgaben erkennen, festgeschriebene Perioden ueberspringen, Vorlage zum Download.
// Pruefung und Anlage sind reine Funktionen (Store/Kategorien/Satz-Normalisierung kommen als Parameter),
// nur oeffneDialog() fasst das DOM an. Test: test/test-import-ausgaben.js.
// Abhaengig von js/import-kern.js und js/import-lager.js (Vorschau/Ergebnisfenster/Fehlerdatei).
//
//   AusgabenImport.zeilen(rows, opt) -> { zeilen: [...], fehler: [{zeile, grund}], kopfFehler: [...] }
//     rows = alle Zeilen der Datei inkl. Kopfzeile (Arrays), die Kopfzeile ist Zeile 1
//     opt  = { kategorien: [...], normUstSatz(v), bestand: [alle Ausgaben], gesperrt(datum) -> bool, nummern: [Dateizeile je rows-Eintrag] }
const AusgabenImport = (function () {
    'use strict';
    var K = ImportKern;

    function cent(n) { return Math.round((Number(n) || 0) * 100); }
    function text(v) { return String(v == null ? '' : v).trim(); }
    function schlag(s) {
        return text(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
            .replace(/^﻿/, '').replace(/[\s.\-_()\/]/g, '');
    }
    function aktiv(e) { return e && !e.storniert && !e.gegengebucht && e.status !== 'gegenbuchung'; }

    // Kopfnamen (normalisiert: klein, ohne Leerzeichen/Punkt/Bindestrich) -> Feld
    var ALIAS = {
        datum: ['datum', 'date', 'belegdatum', 'rechnungsdatum'],
        kategorie: ['kategorie', 'category'],
        beschreibung: ['beschreibung', 'text', 'verwendungszweck', 'description'],
        betrag: ['betrag', 'betragbrutto', 'brutto', 'amount', 'summe'],
        ustSatz: ['ustsatz', 'ust', 'mwst', 'mwstsatz', 'steuersatz', 'satz'],
        belegNr: ['belegnr', 'belegnummer', 'rechnungsnummer', 'belegnum'],
        lieferant: ['lieferant', 'anbieter', 'supplier'],
        notizen: ['notizen', 'notiz', 'bemerkung', 'anmerkung']
    };
    var PFLICHT = [['datum', 'Datum'], ['kategorie', 'Kategorie'], ['betrag', 'Betrag']];

    function spalten(kopf) {
        var map = {};
        (kopf || []).forEach(function (h, i) {
            var s = schlag(h);
            Object.keys(ALIAS).forEach(function (f) { if (map[f] === undefined && ALIAS[f].indexOf(s) > -1) map[f] = i; });
        });
        return map;
    }

    // Kategorien, die der Import bewusst nicht anlegt: sie brauchen Angaben, die die CSV nicht hat.
    function kategorieSperre(k) {
        if (k === 'Geschenke an Geschäftsfreunde') return 'Geschenke brauchen einen Empfänger (§4 Abs. 7 EStG) und lassen sich nur im Formular erfassen';
        if (/^Umsatzsteuer/.test(k)) return 'Umsatzsteuer-Zahlungen/-Erstattungen (Zeitraum, Zehn-Tage-Regel) lassen sich nur im Formular erfassen';
        return '';
    }

    // Satztext -> 19 | 7 | 0 | 'rc' | 'unklar' oder null (unzulaessig). Leer = 'unklar' (wie im Formular).
    function satz(roh, normUst) {
        var s = text(roh).toLowerCase().replace(/\s+/g, ' ');
        if (!s) return 'unklar';
        if (s === 'rc' || s === 'unklar') return normUst(s);
        if (/^(reverse charge|§ ?13b.*|13b)$/.test(s)) return normUst('rc');
        var n = K.zahl(s.replace('%', ''), null);
        if (n === null || [19, 7, 0].indexOf(n) < 0) return null;
        return normUst(n);
    }

    function fpOhneBeleg(datum, betrag, beschr, lieferant) { return K.fingerprint([datum || '', cent(betrag), beschr || '', lieferant || '']); }
    function belegKey(nr) { return 'beleg:' + K.norm(nr); }

    function bestandAusgaben(ausgaben) {
        var zaehl = {};
        (ausgaben || []).forEach(function (e) {
            if (!aktiv(e)) return;
            var nr = text(e.belegNr || e.belegnummer);
            var k = nr ? belegKey(nr) : fpOhneBeleg(e.datum, e.betrag, e.beschreibung, e.lieferant);
            zaehl[k] = (zaehl[k] || 0) + 1;
        });
        return zaehl;
    }

    function zeilen(rows, opt) {
        var map = spalten(rows[0]);
        var kopfFehler = PFLICHT.filter(function (p) { return map[p[0]] === undefined; }).map(function (p) { return 'Spalte „' + p[1] + '“ fehlt'; });
        var out = [], fehler = [];
        if (kopfFehler.length) return { zeilen: out, fehler: fehler, kopfFehler: kopfFehler };
        var bestand = bestandAusgaben(opt.bestand), zaehler = {};
        var gesperrt = opt.gesperrt || function () { return false; };
        var kat = {};
        opt.kategorien.forEach(function (k) { kat[K.norm(k)] = k; });
        rows.slice(1).forEach(function (r, i) {
            r = r || [];
            if (r.every(function (c) { return text(c) === ''; })) return;   // Leerzeile
            var zeile = (opt.nummern && opt.nummern[i + 1]) || i + 2;
            var get = function (f) { return map[f] === undefined ? '' : text(r[map[f]]); };
            var datum = K.datum(get('datum'));
            if (!datum) { fehler.push({ zeile: zeile, grund: 'Datum fehlt oder ist ungültig' }); return; }
            var kategorie = get('kategorie');
            if (!kategorie) { fehler.push({ zeile: zeile, grund: 'Kategorie fehlt' }); return; }
            var kanon = kat[K.norm(kategorie)];
            if (!kanon) { fehler.push({ zeile: zeile, grund: 'Unbekannte Kategorie „' + kategorie + '“' }); return; }
            var sperre = kategorieSperre(kanon);
            if (sperre) { fehler.push({ zeile: zeile, grund: 'Kategorie „' + kanon + '“ nicht per CSV importierbar: ' + sperre }); return; }
            var betrag = K.zahl(get('betrag'), null);
            if (betrag === null) { fehler.push({ zeile: zeile, grund: 'Betrag fehlt oder ist keine Zahl' }); return; }
            if (betrag <= 0 || betrag > 99999999) { fehler.push({ zeile: zeile, grund: 'Betrag muss größer 0 sein' }); return; }
            var ust = satz(get('ustSatz'), opt.normUstSatz);
            if (ust === null) { fehler.push({ zeile: zeile, grund: 'Unzulässiger USt-Satz „' + get('ustSatz') + '“ (erlaubt: 19, 7, 0, rc, unklar)' }); return; }
            if (gesperrt(datum)) { fehler.push({ zeile: zeile, grund: 'Periode festgeschrieben (Datum ' + datum + ')' }); return; }
            var row = {
                datum: datum, kategorie: kanon, beschreibung: get('beschreibung').slice(0, 300), betrag: betrag, ustSatz: ust,
                belegNr: get('belegNr').slice(0, 100), lieferant: get('lieferant').slice(0, 200)
            };
            var notizen = get('notizen');
            if (notizen) row.notizen = notizen;
            // Beleg-Nr. identifiziert, sonst Datum|Betrag|Beschreibung|Lieferant; gleiche Schluessel in einer Datei werden durchgezaehlt
            var fp = row.belegNr ? belegKey(row.belegNr) : fpOhneBeleg(datum, betrag, row.beschreibung, row.lieferant);
            var nr = (zaehler[fp] = (zaehler[fp] || 0) + 1);
            var dublette = (bestand[fp] || 0) >= nr;
            out.push({
                zeile: zeile, key: fp + '#' + nr, dublette: dublette, importieren: !dublette, row: row,
                label: datum + ' · ' + (row.beschreibung || kanon) + ' · ' + betrag.toFixed(2).replace('.', ',') + ' €'
            });
        });
        return { zeilen: out, fehler: fehler, kopfFehler: [] };
    }

    // Legt die ausgewaehlten Zeilen an (Store.saveExpense: Audit, Steuerstatus, Plan-Limit). Gibt die Anzahl zurueck.
    function anlegen(erg, store) {
        var n = 0;
        erg.zeilen.forEach(function (z) {
            if (!z.importieren) return;
            var gespeichert = store.saveExpense(Object.assign({}, z.row));
            if (gespeichert && gespeichert.id) n++;
        });
        return n;
    }

    var VORLAGE_KOPF = ['Datum', 'Kategorie', 'Beschreibung', 'Betrag', 'USt-Satz', 'Beleg-Nr.', 'Lieferant', 'Notizen'];
    // Vorlage: Betrag BRUTTO. Die Beispielzeile ist erfunden und gekennzeichnet; vor dem Import loeschen.
    function vorlageZeilen() {
        return [VORLAGE_KOPF, ['2026-01-15', 'Versand', 'BEISPIEL - Zeile loeschen: Paketmarken', '23.80', '19', 'RE-0001', 'Beispiel Post GmbH', '']];
    }

    // ── Dialog ───────────────────────────────────────────────────────────────
    function oeffneDialog(nachImport) {
        var body = '<div class="section">' +
            '<p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">CSV-Datei mit Ausgaben importieren (Semikolon oder Komma). <strong>Betrag = Bruttobetrag.</strong> Pflicht: Datum, Kategorie, Betrag. Dubletten und festgeschriebene Perioden werden erkannt.</p>' +
            '<div style="margin-bottom:12px;"><button class="btn btn-small" id="ausImpVorlage">Vorlage herunterladen (CSV)</button></div>' +
            '<input type="file" accept=".csv,.txt" id="ausImpDatei" class="form-input"></div>' +
            '<div id="ausImpVorschau" style="margin-top:12px;"></div>' +
            '<div class="form-actions"><button class="btn btn-primary" id="ausImpGo" style="display:none;">Importieren</button></div>';
        App.showModal('CSV Import – Ausgaben', body, '');
        var erg = null;
        document.getElementById('ausImpVorlage').addEventListener('click', function () {
            Utils.downloadCSV(vorlageZeilen(), 'stackr-ausgaben-vorlage.csv');
        });
        document.getElementById('ausImpDatei').addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function (ev) {
                var text = String(ev.target.result);
                var rows = Utils.parseCSV(text);
                var nummern = [];
                text.split(/\r?\n/).forEach(function (l, i) { if (l.trim()) nummern.push(i + 1); });   // parseCSV laesst Leerzeilen weg
                erg = zeilen(rows, {
                    kategorien: Ausgaben._kategorien, normUstSatz: function (v) { return Ausgaben._normUstSatz(v); },
                    bestand: Store.getAllExpensesRaw(), gesperrt: function (d) { return Store.isPeriodLocked(d); }, nummern: nummern
                });
                var vorschau = document.getElementById('ausImpVorschau'), go = document.getElementById('ausImpGo');
                if (erg.kopfFehler.length) {
                    vorschau.innerHTML = '<div style="color:var(--danger);font-size:13px;">' + erg.kopfFehler.join('<br>') + '. Vorlage herunterladen und Spaltennamen angleichen.</div>';
                    go.style.display = 'none';
                    return;
                }
                vorschau.innerHTML = LagerImport.vorschauHtml(erg);
                LagerImport.verdrahte(vorschau, erg);
                var n = LagerImport.ausgewaehlt(erg).length;
                go.textContent = n + ' Ausgaben importieren';
                go.style.display = '';
            };
            reader.readAsText(file);
        });
        document.getElementById('ausImpGo').addEventListener('click', function () {
            if (!erg) return;
            var n = anlegen(erg, Store);
            if (LagerImport.nichtImportiert(erg).length > 0) LagerImport.zeigeBericht('Import-Ergebnis', erg, n + ' Ausgaben importiert');
            else { App.closeModal(); Utils.showToast(n + ' Ausgaben importiert', 'success'); }
            if (nachImport) nachImport();
        });
    }

    return { zeilen: zeilen, anlegen: anlegen, spalten: spalten, vorlageZeilen: vorlageZeilen, oeffneDialog: oeffneDialog };
})();
if (typeof window !== 'undefined') window.AusgabenImport = AusgabenImport;
