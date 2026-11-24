// Fachlogik der Lager-Importe (Excel/CSV: Einkaeufe und Verkaeufe): Zeilen pruefen, Dubletten
// gegen den vorhandenen Bestand erkennen, festgeschriebene Perioden ueberspringen.
// Reine Funktionen ohne DOM/Store (Store-Zugriff kommt als Parameter), Test: test/test-import-lager.js.
// Abhaengig von js/import-kern.js. Aufrufer: lager/page.js (ExcelImport, SalesImport).
//
// Ergebnis beider Funktionen: { zeilen: [...], fehler: [{zeile, grund}] }
//   zeilen[i] = { zeile, key, dublette, importieren, label, ... }  (dublette => importieren = false)
const LagerImport = (function () {
    'use strict';
    var K = ImportKern;

    function cent(n) { return Math.round((Number(n) || 0) * 100); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function upper(s) { return String(s || '').trim().toUpperCase(); }
    function aktiv(p) { return p && !p.storniert && !p.gegengebucht && p.status !== 'gegenbuchung'; }

    // ── Einkaeufe (ExcelImport) ──────────────────────────────────────────────
    function fpEinkauf(datum, marke, beschr, groesse, preis) {
        return K.fingerprint([datum || '', marke || '', beschr || '', groesse || '', cent(preis)]);
    }

    function bestandEinkauf(purchases) {
        var nrs = {}, fp = {};
        (purchases || []).forEach(function (p) {
            if (!p) return;
            var nr = upper(p.artikelNr);
            if (nr) nrs[nr] = true;                       // auch stornierte Nummern bleiben vergeben
            if (!aktiv(p)) return;
            var k = fpEinkauf(p.datum, p.marke, p.beschreibung, p.groesse, p.einkaufspreis);
            fp[k] = (fp[k] || 0) + 1;
        });
        return { nrs: nrs, fp: fp };
    }

    // rows = Zeilenobjekte aus sheet_to_json, mapping = {feld: spaltenname}
    // opt: datum (Standarddatum), quelle, nummern (Dateizeilen je Row), bestand (alle Einkaeufe),
    //      gesperrt(datum) -> bool
    function einkaufsZeilen(rows, mapping, opt) {
        var bestand = bestandEinkauf(opt.bestand), zaehler = {}, gesperrt = opt.gesperrt || function () { return false; };
        var zeilen = [], fehler = [];
        rows.forEach(function (r, i) {
            var zeile = (opt.nummern && opt.nummern[i]) || i + 2;
            var get = function (f) { var c = mapping[f]; return c ? r[c] : ''; };
            var preis = K.zahl(get('einkaufspreis'), null);
            var marke = String(get('marke') || '').trim();
            var beschr = String(get('beschreibung') || '').trim();
            if (preis === null) { fehler.push({ zeile: zeile, grund: 'EK-Preis fehlt oder ist keine Zahl' }); return; }
            if (preis < 0) { fehler.push({ zeile: zeile, grund: 'EK-Preis ist negativ' }); return; }
            if (!marke && !beschr) { fehler.push({ zeile: zeile, grund: 'Marke und Beschreibung fehlen' }); return; }
            var rowDatum = K.datum(get('datum')) || opt.datum;
            if (gesperrt(rowDatum)) { fehler.push({ zeile: zeile, grund: 'Periode festgeschrieben (Kaufdatum ' + rowDatum + ')' }); return; }
            var anzahl = Math.max(1, Math.min(9999, parseInt(String(get('anzahl') || '1').replace(/[^\d]/g, ''), 10) || 1));
            var vkPreis = K.zahl(get('verkaufspreis'), 0);
            var verkauft = vkPreis > 0;
            var vkDatum = verkauft ? (K.datum(get('verkaufsdatum')) || rowDatum) : '';
            if (verkauft && gesperrt(vkDatum)) { fehler.push({ zeile: zeile, grund: 'Periode festgeschrieben (Verkaufsdatum ' + vkDatum + ')' }); return; }
            var row = {
                datum: rowDatum,
                artikelNr: String(get('artikelNr') || '').trim().slice(0, 60),
                marke: marke,
                artikeltyp: String(get('artikeltyp') || 'Sonstiges').trim() || 'Sonstiges',
                groesse: String(get('groesse') || '').trim(),
                beschreibung: beschr,
                einkaufspreis: preis,
                einkaufsquelle: String(get('quelle') || '').trim() || opt.quelle || '',
                anzahl: anzahl,
                verkauft: verkauft,
                verkaufspreis: verkauft ? vkPreis : 0,
                verkaufsdatum: vkDatum,
                verkaufswo: String(get('verkaufswo') || '').trim(),
                versandKaeufer: verkauft ? K.zahl(get('versandKaeufer')) : 0,
                versandVerkaeufer: verkauft ? K.zahl(get('versandVerkaeufer')) : 0,
                gebuehrProzent: verkauft ? K.zahl(get('gebuehrProzent')) : 0
            };
            var key, dublette;
            if (row.artikelNr) {
                key = 'nr:' + upper(row.artikelNr);
                dublette = !!bestand.nrs[upper(row.artikelNr)] || (anzahl > 1 && !!bestand.nrs[upper(row.artikelNr) + '-1']);
            } else {
                var fp = fpEinkauf(rowDatum, marke, beschr, row.groesse, preis);
                var vorher = zaehler[fp] || 0;
                zaehler[fp] = vorher + anzahl;             // Menge k belegt k Plätze derselben Sorte
                key = fp + '#' + (vorher + 1);
                dublette = (bestand.fp[fp] || 0) >= vorher + anzahl;
            }
            zeilen.push({
                zeile: zeile, key: key, dublette: dublette, importieren: !dublette, row: row,
                label: (marke + ' ' + beschr).trim() + ' · EK ' + preis.toFixed(2).replace('.', ',') + ' €'
            });
        });
        return { zeilen: zeilen, fehler: fehler };
    }

    // ── Verkaeufe (SalesImport) ──────────────────────────────────────────────
    function fpVerkauf(datum, preis, titel, plattform) {
        return K.fingerprint([datum || '', cent(preis), upper(titel), plattform || '']);
    }

    function bestandVerkauf(sales, purchases) {
        var nachId = {}, fp = {};
        (purchases || []).forEach(function (p) { if (p && p.id) nachId[p.id] = p; });
        (sales || []).forEach(function (s) {
            if (!aktiv(s)) return;
            var pid = s.purchaseId || (Array.isArray(s.purchaseIds) && s.purchaseIds[0]);
            var p = pid && nachId[pid];
            var k = fpVerkauf(s.datum, s.verkaufspreis, p && p.artikelNr ? p.artikelNr : s.beschreibung, s.verkaufsplattform);
            fp[k] = (fp[k] || 0) + 1;
        });
        return fp;
    }

    // opt: plattform, nummern, purchases, sales, gesperrt(datum), einkaufGesperrt(purchase),
    //      findArtNr(titel) -> Artikelnummer (Grossbuchstaben) oder null, artNrMap {NR: purchase}
    function verkaufsZeilen(rows, mapping, opt) {
        var bestand = bestandVerkauf(opt.sales, opt.purchases), zaehler = {};
        var gesperrt = opt.gesperrt || function () { return false; };
        var einkaufGesperrt = opt.einkaufGesperrt || function () { return false; };
        var zeilen = [], fehler = [];
        rows.forEach(function (r, i) {
            var zeile = (opt.nummern && opt.nummern[i]) || i + 2;
            var get = function (f) { var c = mapping[f]; return c ? r[c] : ''; };
            var datum = K.datum(get('datum'));
            var preis = K.zahl(get('preis'));
            var beschr = String(get('beschreibung') || '').trim();
            if (!datum) { fehler.push({ zeile: zeile, grund: 'Datum fehlt oder ist ungültig' }); return; }
            if (preis <= 0) { fehler.push({ zeile: zeile, grund: 'Preis fehlt, ist 0 oder keine Zahl' }); return; }
            if (gesperrt(datum)) { fehler.push({ zeile: zeile, grund: 'Periode festgeschrieben (Verkaufsdatum ' + datum + ')' }); return; }
            var gebuehr = K.zahl(get('gebuehr'));
            var vsk = K.zahl(get('versandKaeufer'));
            var vskVk = K.zahl(get('versandVk'));
            var kaeufer = String(get('kaeufer') || '').trim();
            var matchedNr = opt.findArtNr ? opt.findArtNr(beschr) : null;
            var purchase = matchedNr && opt.artNrMap ? opt.artNrMap[matchedNr] : null;
            var fp = fpVerkauf(datum, preis, matchedNr || beschr, opt.plattform);
            var nr = (zaehler[fp] = (zaehler[fp] || 0) + 1);
            var sale = {
                datum: datum,
                verkaufsplattform: opt.plattform,
                verkaufspreis: preis,
                versandkostenKaeufer: vsk,
                plattformgebuehrProzent: preis > 0 ? Math.round((gebuehr / (preis + vsk)) * 10000) / 100 : 0,
                versandkostenVerkaufer: vskVk,
                kaeufer: kaeufer,
                notizen: 'Importiert aus ' + opt.plattform + '-CSV' + (purchase ? ' · Lager-Match: ' + purchase.artikelNr : '')
            };
            if (purchase) {
                sale.purchaseId = purchase.id;
                sale.marke = purchase.marke || '';
                sale.artikeltyp = purchase.artikeltyp || '';
                sale.groesse = purchase.groesse || '';
                sale.beschreibung = purchase.beschreibung || '';
            } else {
                sale.beschreibung = beschr;
            }
            var dublette = (bestand[fp] || 0) >= nr;
            zeilen.push({
                zeile: zeile, key: fp + '#' + nr, dublette: dublette, importieren: !dublette, sale: sale,
                purchase: purchase || null,
                // GoBD: an einem festgeschriebenen/stornierten Einkauf wird der Status nicht angefasst
                statusGesperrt: !!(purchase && einkaufGesperrt(purchase)),
                label: datum + ' · ' + (beschr || '—') + ' · ' + preis.toFixed(2).replace('.', ',') + ' €'
            });
        });
        return { zeilen: zeilen, fehler: fehler };
    }

    // ── Gemeinsames ──────────────────────────────────────────────────────────
    function ausgewaehlt(erg) { return erg.zeilen.filter(function (z) { return z.importieren; }); }

    // Kurzfassung als HTML fuer die Vorschau: Zaehler, Dublettenliste mit Haken (vorab aus),
    // uebersprungene Zeilen mit Grund. Haken werden von verdrahte() an das Ergebnis gebunden.
    function vorschauHtml(erg) {
        var dubl = erg.zeilen.filter(function (z) { return z.dublette; });
        var neu = erg.zeilen.length - dubl.length;
        var h = '<div class="imp-summary" style="font-size:12px;line-height:1.6;margin-bottom:8px;">' +
            '<strong>' + neu + '</strong> neu' +
            (dubl.length ? ' · <strong>' + dubl.length + '</strong> bereits vorhanden (Dubletten)' : '') +
            (erg.fehler.length ? ' · <strong>' + erg.fehler.length + '</strong> übersprungen' : '') + '</div>';
        if (dubl.length) {
            h += '<div style="border:1px solid rgba(245,158,11,.35);background:rgba(245,158,11,.08);border-radius:8px;padding:8px 10px;font-size:12px;margin-bottom:8px;">' +
                '<div style="font-weight:600;margin-bottom:4px;">Bereits vorhanden — nicht ausgewählt; Haken setzen, um sie trotzdem zu importieren</div>' +
                dubl.map(function (z) {
                    return '<label style="display:flex;gap:6px;align-items:center;padding:2px 0;"><input type="checkbox" class="imp-dup" data-zeile="' + z.zeile + '"' + (z.importieren ? ' checked' : '') + '> ' +
                        'Zeile ' + z.zeile + ': ' + esc(z.label) + '</label>';
                }).join('') + '</div>';
        }
        if (erg.fehler.length) {
            h += '<div style="border:1px solid rgba(239,68,68,.35);background:rgba(239,68,68,.06);border-radius:8px;padding:8px 10px;font-size:12px;margin-bottom:8px;max-height:120px;overflow:auto;">' +
                '<div style="font-weight:600;margin-bottom:4px;">Übersprungen</div>' +
                erg.fehler.map(function (f) { return '<div>Zeile ' + f.zeile + ': ' + esc(f.grund) + '</div>'; }).join('') + '</div>';
        }
        return h;
    }

    // Haken in container -> erg.zeilen[].importieren
    function verdrahte(container, erg) {
        if (!container || !container.querySelectorAll) return;
        container.querySelectorAll('.imp-dup').forEach(function (cb) {
            cb.addEventListener('change', function () {
                erg.zeilen.forEach(function (z) { if (String(z.zeile) === cb.dataset.zeile) z.importieren = cb.checked; });
            });
        });
    }

    return {
        einkaufsZeilen: einkaufsZeilen, verkaufsZeilen: verkaufsZeilen, ausgewaehlt: ausgewaehlt,
        vorschauHtml: vorschauHtml, verdrahte: verdrahte,
        _bestandEinkauf: bestandEinkauf, _bestandVerkauf: bestandVerkauf
    };
})();
if (typeof window !== 'undefined') window.LagerImport = LagerImport;
