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
    function text(v) { return String(v == null ? '' : v).trim(); }
    // Tags: Komma-getrennt, ohne Leere und ohne Doppelte (Gross/Klein egal), Reihenfolge bleibt
    function tags(v) {
        var gesehen = {}, out = [];
        text(v).split(',').forEach(function (t) {
            t = t.trim();
            if (t && !gesehen[t.toLowerCase()]) { gesehen[t.toLowerCase()] = true; out.push(t); }
        });
        return out;
    }
    function aktiv(p) { return p && !p.storniert && !p.gegengebucht && p.status !== 'gegenbuchung'; }

    // Plattformgebuehr in EUR -> Prozent von Preis + Versand Kaeufer (2 Nachkommastellen).
    // Eine Stelle fuer Lager-Import, Verkaeufe-Import und Einzeilen-Format.
    function gebuehrProzent(eur, preis, vsk) {
        return preis > 0 ? Math.round((eur / (preis + vsk)) * 10000) / 100 : 0;
    }

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
                lagerort: { bereich: text(get('lagerBereich')), regal: text(get('lagerRegal')), fach: text(get('lagerFach')) },
                warenkategorie: text(get('warenkategorie')),
                tags: tags(get('tags')),
                notizen: text(get('notizen')),
                verkauft: verkauft,
                verkaufspreis: verkauft ? vkPreis : 0,
                verkaufsdatum: vkDatum,
                verkaufswo: text(get('verkaufswo')),
                verkaufsplattform: text(get('verkaufsplattform')),
                kaeufer: text(get('kaeufer')),
                versandKaeufer: verkauft ? K.zahl(get('versandKaeufer')) : 0,
                versandVerkaeufer: verkauft ? K.zahl(get('versandVerkaeufer')) : 0,
                gebuehrProzent: 0
            };
            if (verkauft) {
                // Prozent-Spalte hat Vorrang; sonst Gebuehr in EUR, umgerechnet auf den Gesamterloes der Zeile
                var prozent = K.zahl(get('gebuehrProzent'));
                row.gebuehrProzent = prozent > 0 ? prozent : gebuehrProzent(K.zahl(get('gebuehrEur')), vkPreis, row.versandKaeufer);
            }
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
                plattformgebuehrProzent: gebuehrProzent(gebuehr, preis, vsk),
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

    var FEHLERDATEI_KNOPF = '<button type="button" class="btn btn-sm imp-fehlerdatei" style="margin-top:6px;">Fehlerdatei (CSV) herunterladen</button>';

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
                erg.fehler.map(function (f) { return '<div>Zeile ' + f.zeile + ': ' + esc(f.grund) + '</div>'; }).join('') + FEHLERDATEI_KNOPF + '</div>';
        }
        return h;
    }

    // Alles, was NICHT importiert wird: uebersprungene Zeilen und abgewaehlte Dubletten, nach Zeile sortiert.
    function nichtImportiert(erg) {
        var liste = erg.fehler.slice();
        erg.zeilen.forEach(function (z) {
            if (z.dublette && !z.importieren) liste.push({ zeile: z.zeile, grund: 'Dublette: bereits vorhanden (' + z.label + ')' });
        });
        return liste.sort(function (a, b) { return a.zeile - b.zeile; });
    }

    // Ergebnisfenster nach dem Import: Zaehler, nicht importierte Zeilen mit Zeilennummer und Grund, Fehlerdatei.
    function berichtHtml(erg, kopf) {
        var liste = nichtImportiert(erg);
        return '<div style="font-size:13px;line-height:1.6;">' +
            '<div style="font-weight:700;margin-bottom:6px;">' + esc(kopf) + '</div>' +
            (liste.length ? '<div>' + liste.length + ' Zeile(n) nicht importiert:</div>' +
                '<div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:12px;margin-top:4px;max-height:240px;overflow:auto;">' +
                liste.map(function (f) { return '<div>Zeile ' + f.zeile + ': ' + esc(f.grund) + '</div>'; }).join('') + '</div>' + FEHLERDATEI_KNOPF : '') +
            '</div>';
    }

    // Ersetzt den Importdialog durch das Ergebnisfenster (nur wenn es etwas zu melden gibt).
    function zeigeBericht(titel, erg, kopf) {
        App.showModal(titel, berichtHtml(erg, kopf), '<button class="btn btn-primary" data-action="close-modal">Schließen</button>');
        verdrahte(document.getElementById('modal'), erg);
    }

    // Haken in container -> erg.zeilen[].importieren; Fehlerdatei-Knopf -> CSV-Download
    function verdrahte(container, erg) {
        if (!container || !container.querySelectorAll) return;
        container.querySelectorAll('.imp-fehlerdatei').forEach(function (btn) {
            btn.addEventListener('click', function () {
                Utils.downloadFile(K.fehlerCsv(nichtImportiert(erg)), 'import-fehler.csv', 'text/csv;charset=utf-8');
            });
        });
        container.querySelectorAll('.imp-dup').forEach(function (cb) {
            cb.addEventListener('change', function () {
                erg.zeilen.forEach(function (z) { if (String(z.zeile) === cb.dataset.zeile) z.importieren = cb.checked; });
            });
        });
    }

    // ── Einzeilen-Format (Vorlage, Export): ein Artikel je Zeile, Verkauf in derselben Zeile ──
    // Kopfnamen werden von ExcelImport._autoDetect erkannt (Test: test-import-lager.js).
    var EINZEILEN_SPALTEN = ['Artikelnummer', 'Kaufdatum', 'Marke', 'Beschreibung', 'Artikeltyp', 'Größe', 'Anzahl',
        'Einkaufspreis', 'Einkaufsquelle', 'Lagerbereich', 'Lagerregal', 'Lagerfach', 'Warenkategorie', 'Tags', 'Notizen',
        'Verkaufsdatum', 'Verkaufspreis', 'Plattform', 'Gebühr EUR', 'Versand Käufer', 'Versand Verkäufer', 'Käufer'];

    // CSV-Vorlage: UTF-8 mit BOM, Semikolon, Punkt-Dezimal, Datum JJJJ-MM-TT. Die Beispielzeilen sind erfunden
    // und gekennzeichnet; vor dem Import loeschen oder ueberschreiben.
    function vorlageCsv() {
        var bsp1 = ['BSP-001', '2026-01-15', 'Beispielmarke', 'BEISPIEL - Zeile loeschen: Jacke, nicht verkauft', 'Jacke', 'M', 1, '12.50', 'Flohmarkt',
            'Keller', 'R1', 'F2', 'Kleidung', 'Vintage, Winter', 'Kleiner Fleck am Aermel', '', '', '', '', '', '', ''];
        var bsp2 = ['BSP-002', '2026-01-15', 'Beispielmarke', 'BEISPIEL - Zeile loeschen: Hose, verkauft', 'Hose', '32', 1, '8.00', 'Flohmarkt',
            '', '', '', 'Kleidung', '', '', '2026-02-03', '25.00', 'Vinted', '1.25', '3.90', '3.90', 'Max Muster'];
        return '﻿' + [EINZEILEN_SPALTEN, bsp1, bsp2].map(K.csvZeile).join('\r\n') + '\r\n';
    }

    // ── Export im Einzeilen-Format (gleiche Spalten wie die Vorlage, wieder importierbar) ──
    function r2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
    function dez(n) { return r2(n).toFixed(2); }
    // CSV-Formel-Schutz fuer Textzellen (=, +, -, @ am Anfang -> Apostroph), Zahlen bleiben unberuehrt
    function csvText(v) { var s = text(v); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }

    // purchases: Artikel in Exportreihenfolge, sales: alle Verkaeufe. Stornierte Artikel und Verkaeufe entfallen
    // (ein Reimport wuerde sie sonst als aktive Ware anlegen). Sammelverkaeufe (purchaseIds) werden
    // gleichmaessig auf ihre Artikel verteilt, Cent-Rest auf den ersten.
    function einzeilenExport(purchases, sales) {
        var proArtikel = {};
        (sales || []).forEach(function (s) {
            if (!aktiv(s)) return;
            var ids = s.purchaseIds && s.purchaseIds.length ? s.purchaseIds : (s.purchaseId ? [s.purchaseId] : []);
            ids.forEach(function (id, i) {
                if (proArtikel[id]) return;
                var n = ids.length, teil = function (x) {
                    var summe = Number(x) || 0, basis = r2(summe / n);
                    return i === 0 ? r2(summe - basis * (n - 1)) : basis;
                };
                var vk = teil(s.verkaufspreis), vkK = teil(s.versandkostenKaeufer);
                proArtikel[id] = { s: s, vk: vk, vkK: vkK, vkV: teil(s.versandkostenVerkaufer),
                    geb: r2((vk + vkK) * (parseFloat(s.plattformgebuehrProzent) || 0) / 100) };
            });
        });
        var zeilen = [];
        (purchases || []).forEach(function (p) {
            if (!aktiv(p)) return;
            var lo = p.lagerort || {}, v = proArtikel[p.id];
            zeilen.push([
                csvText(p.artikelNr), p.datum || '', csvText(p.marke), csvText(p.beschreibung), csvText(p.artikeltyp), csvText(p.groesse), 1,
                dez(p.einkaufspreis), csvText(p.einkaufsquelle), csvText(lo.bereich), csvText(lo.regal), csvText(lo.fach),
                csvText(p.warenkategorie), csvText((p.tags || []).join(', ')), csvText(p.notizen),
                v ? v.s.datum || '' : '', v ? dez(v.vk) : '', v ? csvText(v.s.verkaufsplattform) : '', v ? dez(v.geb) : '',
                v ? dez(v.vkK) : '', v ? dez(v.vkV) : '', v ? csvText(v.s.kaeufer) : ''
            ]);
        });
        return { kopf: EINZEILEN_SPALTEN, zeilen: zeilen };
    }

    function einzeilenCsv(purchases, sales) {
        var e = einzeilenExport(purchases, sales);
        return '﻿' + [e.kopf].concat(e.zeilen).map(K.csvZeile).join('\r\n') + '\r\n';
    }

    function exportiereEinzeilen(purchases, sales) {
        var csv = einzeilenCsv(purchases, sales);
        Utils.downloadFile(csv, 'Lager_Einzeilen_' + new Date().toLocaleDateString('sv-SE') + '.csv', 'text/csv;charset=utf-8');
        Utils.showToast('Einzeilen-CSV exportiert', 'success');
    }

    return {
        einzeilenExport: einzeilenExport, einzeilenCsv: einzeilenCsv, exportiereEinzeilen: exportiereEinzeilen,
        gebuehrProzent: gebuehrProzent, EINZEILEN_SPALTEN: EINZEILEN_SPALTEN, vorlageCsv: vorlageCsv,
        einkaufsZeilen: einkaufsZeilen, verkaufsZeilen: verkaufsZeilen, ausgewaehlt: ausgewaehlt,
        vorschauHtml: vorschauHtml, verdrahte: verdrahte, nichtImportiert: nichtImportiert, berichtHtml: berichtHtml, zeigeBericht: zeigeBericht,
        _bestandEinkauf: bestandEinkauf, _bestandVerkauf: bestandVerkauf
    };
})();
if (typeof window !== 'undefined') window.LagerImport = LagerImport;
