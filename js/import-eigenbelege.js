// Eigenbeleg-CSV importieren (Eigenbelege -> "CSV importieren"): Zeilen pruefen, Dubletten gegen
// vorhandene Belege erkennen, festgeschriebene Perioden ueberspringen. Importierte Belege sind
// UNBESTAETIGT (bestaetigt: false, s. js/eigenbeleg-status.js): sie zaehlen erst nach "Bestaetigen"
// in EUER/DATEV. Vorsteuerabzug wird nie per CSV gesetzt.
// Pruefung und Anlage sind reine Funktionen (Kategorien, Begruendungen, Speicher kommen als Parameter);
// nur oeffneDialog() fasst das DOM an. Test: test/test-import-eigenbelege.js.
// Abhaengig von js/import-kern.js und js/import-lager.js (Vorschau/Bericht/Fehlerdatei).
//
//   EigenbelegImport.zeilen(rows, opt) -> { zeilen: [...], fehler: [{zeile, grund}], kopfFehler: [...] }
//     rows = alle Zeilen inkl. Kopfzeile (Arrays), opt = { kategorien: [{id,name}], begruendungen: [{id,name}],
//            bestand: [Belege], gesperrt(datum) -> bool, nummern: [Dateizeile je rows-Eintrag] }
const EigenbelegImport = (function () {
    'use strict';
    var K = ImportKern;

    function cent(n) { return Math.round((Number(n) || 0) * 100); }
    function text(v) { return String(v == null ? '' : v).trim(); }
    function schlag(s) {
        return text(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
            .replace(/^﻿/, '').replace(/[\s.\-_()\/]/g, '');
    }

    var ALIAS = {
        datum: ['datum', 'belegdatum', 'date'],
        zweck: ['zweck', 'verwendungszweck', 'beschreibung', 'zweckbetrieblicheveranlassung'],
        betrag: ['betragbrutto', 'brutto', 'betrag', 'bruttobetrag'],
        mwstSatz: ['mwstsatz', 'mwst', 'ustsatz', 'steuersatz', 'satz'],
        begruendung: ['begruendung', 'grund'],
        verkaeufer: ['verkaeufer', 'lieferant', 'empfaenger', 'verkaeuferabsender'],
        kategorie: ['kategorie', 'category'],
        zahlungsweg: ['zahlungsweg', 'zahlungsart'],
        notizen: ['notizen', 'notiz', 'bemerkung']
    };
    var PFLICHT = [['datum', 'Datum'], ['zweck', 'Zweck'], ['betrag', 'Betrag brutto'], ['mwstSatz', 'MwSt-Satz'], ['begruendung', 'Begründung']];
    var ZAHLUNGSWEGE = [['bar', 'Bar'], ['ec', 'EC-Karte / Debitkarte'], ['kreditkarte', 'Kreditkarte'], ['paypal', 'PayPal'],
        ['ueberweisung', 'Banküberweisung'], ['klarna', 'Klarna'], ['sonstiges', 'Sonstiges']];

    function spalten(kopf) {
        var map = {};
        (kopf || []).forEach(function (h, i) {
            var s = schlag(h);
            Object.keys(ALIAS).forEach(function (f) { if (map[f] === undefined && ALIAS[f].indexOf(s) > -1) map[f] = i; });
        });
        return map;
    }

    // id ODER Name (Gross/Klein egal) -> id; sonst null
    function finde(liste, v) {
        var s = K.norm(v), treffer = null;
        liste.forEach(function (e) { if (!treffer && (K.norm(e.id) === s || K.norm(e.name) === s)) treffer = e.id; });
        return treffer;
    }

    function fp(datum, brutto, zweck) { return K.fingerprint([datum || '', cent(brutto), zweck || '']); }

    function bestandFp(belege) {
        var z = {};
        (belege || []).forEach(function (b) {
            if (!b || b.storniert) return;
            var k = fp(b.belegDatum, b.betragBrutto, b.zweck);
            z[k] = (z[k] || 0) + 1;
        });
        return z;
    }

    function zeilen(rows, opt) {
        var map = spalten(rows[0]);
        var kopfFehler = PFLICHT.filter(function (p) { return map[p[0]] === undefined; }).map(function (p) { return 'Spalte „' + p[1] + '“ fehlt'; });
        var out = [], fehler = [];
        if (kopfFehler.length) return { zeilen: out, fehler: fehler, kopfFehler: kopfFehler };
        var bestand = bestandFp(opt.bestand), zaehler = {};
        var gesperrt = opt.gesperrt || function () { return false; };
        var zahlungswege = ZAHLUNGSWEGE.map(function (z) { return { id: z[0], name: z[1] }; });
        rows.slice(1).forEach(function (r, i) {
            r = r || [];
            if (r.every(function (c) { return text(c) === ''; })) return;   // Leerzeile
            var zeile = (opt.nummern && opt.nummern[i + 1]) || i + 2;
            var get = function (f) { return map[f] === undefined ? '' : text(r[map[f]]); };
            var datum = K.datum(get('datum'));
            if (!datum) { fehler.push({ zeile: zeile, grund: 'Datum fehlt oder ist ungültig' }); return; }
            var zweck = get('zweck');
            if (!zweck) { fehler.push({ zeile: zeile, grund: 'Zweck fehlt' }); return; }
            var brutto = K.zahl(get('betrag'), null);
            if (brutto === null) { fehler.push({ zeile: zeile, grund: 'Betrag brutto fehlt oder ist keine Zahl' }); return; }
            if (brutto <= 0 || brutto > 99999999) { fehler.push({ zeile: zeile, grund: 'Betrag brutto muss größer 0 sein' }); return; }
            var satzRoh = get('mwstSatz');
            var satz = satzRoh === '' ? null : K.zahl(satzRoh.replace('%', ''), null);
            if (satz === null) { fehler.push({ zeile: zeile, grund: 'MwSt-Satz fehlt oder ist keine Zahl' }); return; }
            if ([0, 7, 19].indexOf(satz) < 0) { fehler.push({ zeile: zeile, grund: 'Unzulässiger MwSt-Satz „' + satzRoh + '“ (erlaubt: 0, 7, 19)' }); return; }
            var begrRoh = get('begruendung');
            if (!begrRoh) { fehler.push({ zeile: zeile, grund: 'Begründung fehlt' }); return; }
            var begruendung = finde(opt.begruendungen, begrRoh);
            if (!begruendung) { fehler.push({ zeile: zeile, grund: 'Unbekannte Begründung „' + begrRoh + '“' }); return; }
            var kategorie = '';
            if (get('kategorie')) {
                kategorie = finde(opt.kategorien, get('kategorie'));
                if (!kategorie) { fehler.push({ zeile: zeile, grund: 'Unbekannte Kategorie „' + get('kategorie') + '“' }); return; }
            }
            var zahlungsweg = 'sonstiges';
            if (get('zahlungsweg')) {
                zahlungsweg = finde(zahlungswege, get('zahlungsweg'));
                if (!zahlungsweg) { fehler.push({ zeile: zeile, grund: 'Unbekannter Zahlungsweg „' + get('zahlungsweg') + '“' }); return; }
            }
            if (gesperrt(datum)) { fehler.push({ zeile: zeile, grund: 'Periode festgeschrieben (Belegdatum ' + datum + ')' }); return; }
            var row = {
                belegDatum: datum, zweck: zweck.slice(0, 300), betragBrutto: brutto, mwstSatz: satz, begruendung: begruendung,
                verkaeufer: get('verkaeufer').slice(0, 200), kategorie: kategorie, zahlungsweg: zahlungsweg, notizen: get('notizen')
            };
            var k = fp(datum, brutto, row.zweck);
            var nr = (zaehler[k] = (zaehler[k] || 0) + 1);
            var dublette = (bestand[k] || 0) >= nr;
            out.push({
                zeile: zeile, key: k + '#' + nr, dublette: dublette, importieren: !dublette, row: row,
                label: datum + ' · ' + row.zweck + ' · ' + brutto.toFixed(2).replace('.', ',') + ' €'
            });
        });
        return { zeilen: out, fehler: fehler, kopfFehler: [] };
    }

    // Legt die ausgewaehlten Zeilen als UNBESTAETIGTE Belege an (gleiche Felder wie saveBeleg im Formular).
    // d = { genId(), calcMwst(brutto, satz), heute(), einstellungen, getBelege(), saveBelege(liste), audit(id, beleg) }
    // Die Belegnummer wird erst hier vergeben (nicht in der Vorschau), damit keine Nummern verbraucht werden.
    function anlegen(erg, d) {
        var belege = d.getBelege().slice(), neu = [];
        erg.zeilen.forEach(function (z) {
            if (!z.importieren) return;
            var r = z.row, id = d.genId(), m = d.calcMwst(r.betragBrutto, r.mwstSatz);
            var beleg = {
                id: id, erstelltAm: d.heute(), belegDatum: r.belegDatum, zahlungsDatum: r.belegDatum,
                zahlungsweg: r.zahlungsweg, zahlungswegSonstig: '', zweck: r.zweck, kategorie: r.kategorie,
                betragBrutto: r.betragBrutto, mwstSatz: r.mwstSatz, betragNetto: m.netto, betragMwst: m.mwst,
                empfaenger: r.verkaeufer,
                'verkäufer': { name: r.verkaeufer, strasse: '', plzOrt: '', land: 'Deutschland', adresseUnbekannt: false },
                warenPositionen: [], begruendung: r.begruendung, begruendungText: '', vstAbzugsfaehig: false,
                erlaeuterung: d.einstellungen.standardErlaeuterung || '', verknuepfteArtikel: [], foto: null,
                aussteller: d.einstellungen.inhaberName || d.einstellungen.firmenname || '',
                bestaetigt: false, notizen: r.notizen, quelle: 'csv-import'
            };
            belege.push(beleg);
            neu.push(beleg);
        });
        if (neu.length) {
            d.saveBelege(belege);
            neu.forEach(function (b) { d.audit(b.id, b); });
        }
        return neu.length;
    }

    var VORLAGE_KOPF = ['Datum', 'Zweck', 'Betrag brutto', 'MwSt-Satz', 'Begründung', 'Verkäufer', 'Kategorie', 'Zahlungsweg', 'Notizen'];
    // Die Beispielzeile ist erfunden und gekennzeichnet; vor dem Import loeschen.
    function vorlageZeilen() {
        return [VORLAGE_KOPF, ['2026-01-15', 'BEISPIEL - Zeile loeschen: Parkgebuehr Kundentermin', '3.50', '0', 'barzahlung_flohmarkt', 'Parkhaus Beispiel', 'fahrtkosten', 'bar', '']];
    }

    // ── Dialog ───────────────────────────────────────────────────────────────
    // d = Abhaengigkeiten aus eigenbelege/js/app.js (siehe anlegen) plus
    //     { kategorien, begruendungen, bestand(), gesperrt(datum), firmaPasst(), modal (Element), openModal, closeModal, toast, nachImport }
    function oeffneDialog(d) {
        if (!d.firmaPasst()) { d.toast('Die aktive Firma stimmt nicht überein (Eigenbelege vs. Buchhaltung). Bitte Seite neu laden und die Firma erneut wählen.', 'warning'); return; }
        d.modal.innerHTML = '<div style="padding:20px;background:var(--bg-secondary);max-width:640px;max-height:88vh;overflow-y:auto">' +
            '<h3 id="modalTitle" style="margin:0 0 8px">Eigenbelege per CSV importieren</h3>' +
            '<p style="font-size:13px;color:var(--text-secondary);margin:0 0 12px">Importierte Belege sind <strong>unbestätigt</strong> und zählen erst nach „Bestätigen“ in EÜR und DATEV. Pflicht: Datum, Zweck, Betrag brutto, MwSt-Satz (0, 7, 19), Begründung.</p>' +
            '<div style="margin-bottom:12px;"><button class="btn btn-secondary" id="ebImpVorlage">Vorlage herunterladen (CSV)</button></div>' +
            '<input type="file" accept=".csv,.txt" id="ebImpDatei" class="form-control">' +
            '<div id="ebImpVorschau" style="margin-top:12px;"></div>' +
            '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;"><button class="btn btn-secondary" id="ebImpZu">Schließen</button>' +
            '<button class="btn btn-primary" id="ebImpGo" style="display:none;">Importieren</button></div></div>';
        d.openModal();
        var erg = null;
        var $ = function (id) { return document.getElementById(id); };
        $('ebImpZu').addEventListener('click', d.closeModal);
        $('ebImpVorlage').addEventListener('click', function () { Utils.downloadCSV(vorlageZeilen(), 'stackr-eigenbelege-vorlage.csv'); });
        $('ebImpDatei').addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function (ev) {
                var t = String(ev.target.result);
                var nummern = [];
                t.split(/\r?\n/).forEach(function (l, i) { if (l.trim()) nummern.push(i + 1); });   // parseCSV laesst Leerzeilen weg
                erg = zeilen(Utils.parseCSV(t), { kategorien: d.kategorien, begruendungen: d.begruendungen, bestand: d.bestand(), gesperrt: d.gesperrt, nummern: nummern });
                var vorschau = $('ebImpVorschau'), go = $('ebImpGo');
                if (erg.kopfFehler.length) {
                    vorschau.innerHTML = '<div style="color:var(--danger);font-size:13px;">' + erg.kopfFehler.join('<br>') + '. Vorlage herunterladen und Spaltennamen angleichen.</div>';
                    go.style.display = 'none';
                    return;
                }
                vorschau.innerHTML = LagerImport.vorschauHtml(erg);
                LagerImport.verdrahte(vorschau, erg);
                go.textContent = LagerImport.ausgewaehlt(erg).length + ' Belege importieren';
                go.style.display = '';
            };
            reader.readAsText(file);
        });
        $('ebImpGo').addEventListener('click', function () {
            if (!erg) return;
            var n = anlegen(erg, d);
            if (LagerImport.nichtImportiert(erg).length > 0) {
                d.modal.innerHTML = '<div style="padding:20px;background:var(--bg-secondary);max-width:640px;">' + LagerImport.berichtHtml(erg, n + ' Eigenbelege importiert (unbestätigt)') +
                    '<div style="text-align:right;margin-top:12px;"><button class="btn btn-primary" id="ebImpFertig">Schließen</button></div></div>';
                LagerImport.verdrahte(d.modal, erg);
                $('ebImpFertig').addEventListener('click', d.closeModal);
            } else d.closeModal();
            d.toast(n + ' Eigenbelege importiert — zum Verbuchen bitte bestätigen', 'success');
            if (d.nachImport) d.nachImport();
        });
    }

    return { zeilen: zeilen, anlegen: anlegen, spalten: spalten, vorlageZeilen: vorlageZeilen, oeffneDialog: oeffneDialog };
})();
if (typeof window !== 'undefined') window.EigenbelegImport = EigenbelegImport;
