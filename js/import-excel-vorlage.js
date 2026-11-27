// Excel-Vorlage importieren (Backup & Daten -> "Excel-Datei importieren"): Blaetter Einkaeufe/Verkaeufe/Ausgaben
// der Stackr-Vorlage, ersatzweise eine flache Liste mit Kaufdatum/Einkauf/Verkauf je Zeile.
// Wie die CSV-Importe: Zeilen pruefen, festgeschriebene Perioden ueberspringen, Dubletten (Einkauf/Verkauf)
// mit Auswahl, jede nicht importierte Zeile mit Blatt-Zeilennummer und Grund.
// Reine Funktionen (Store kommt als Parameter), Dialog und Dateilesen bleiben in js/app.js.
// Test: test/test-import-excel-vorlage.js. Abhaengig von js/import-kern.js und js/import-lager.js.
//
//   ExcelVorlageImport.einkaeufe|verkaeufe|ausgaben(rows, opt) -> { zeilen: [...], fehler: [{zeile, grund}] }
//   ExcelVorlageImport.flach(rows, opt) -> dasselbe oder null (keine passende Kopfzeile)
//     rows = alle Zeilen des Blatts (sheet_to_json mit header:1, Leerzeilen inklusive), rows[0] = Kopfzeile
//     opt  = { heute: 'JJJJ-MM-TT', gesperrt(datum) -> bool, purchases, sales, startZeile: Dateizeile von rows[0] (Standard 1) }
const ExcelVorlageImport = (function () {
    'use strict';
    var K = ImportKern, L = LagerImport;

    // ---- Spaltenaufbau der Vorlage: EINE Definition fuer Vorlage-Download und Import ----
    // `schluessel` ist der normalisierte Name, gegen den geprueft wird; `titel` steht in der erzeugten
    // Vorlage. Die Reihenfolge IST die Spaltenreihenfolge (r[0], r[1], … unten).
    var SPALTEN = {
        einkauf: [
            { schluessel: 'datum',        titel: 'Datum (JJJJ-MM-TT)', beispiel: '2026-01-15' },
            { schluessel: 'marke',        titel: 'Marke',              beispiel: 'Nike' },
            { schluessel: 'artikeltyp',   titel: 'Artikeltyp',         beispiel: 'Schuhe' },
            { schluessel: 'groesse',      titel: 'Größe',              beispiel: '42' },
            { schluessel: 'beschreibung', titel: 'Beschreibung',       beispiel: 'Air Max 90 White' },
            { schluessel: 'ekpreis',      titel: 'EK-Preis (€)',       beispiel: '80' },
            { schluessel: 'anzahl',       titel: 'Anzahl',             beispiel: '1' },
            { schluessel: 'einkaufsquelle', titel: 'Einkaufsquelle',   beispiel: 'Privatkauf' },
            { schluessel: 'notizen',      titel: 'Notizen',            beispiel: '' }
        ],
        verkauf: [
            { schluessel: 'datum',        titel: 'Datum (JJJJ-MM-TT)',   beispiel: '2026-01-20' },
            { schluessel: 'marke',        titel: 'Marke',                beispiel: 'Nike' },
            { schluessel: 'artikeltyp',   titel: 'Artikeltyp',           beispiel: 'Schuhe' },
            { schluessel: 'groesse',      titel: 'Größe',                beispiel: '42' },
            { schluessel: 'beschreibung', titel: 'Beschreibung',         beispiel: 'Air Max 90 White' },
            { schluessel: 'verkaufspreis', titel: 'Verkaufspreis (€)',   beispiel: '150' },
            { schluessel: 'versandkaeufer', titel: 'Versand-Käufer (€)', beispiel: '0' },
            { schluessel: 'plattformgebuehr', titel: 'Plattformgebühr (%)', beispiel: '5' },
            { schluessel: 'versandverkaeufer', titel: 'Versand-Verkäufer (€)', beispiel: '4.99' },
            { schluessel: 'verkaufsplattform', titel: 'Verkaufsplattform', beispiel: 'Vinted' },
            { schluessel: 'kaeufer',      titel: 'Käufer',               beispiel: 'Max Muster' },
            { schluessel: 'notizen',      titel: 'Notizen',              beispiel: '' },
            // Optional und ganz hinten: aeltere Vorlagen ohne diese Spalte bleiben gueltig.
            { schluessel: 'plattformgebuehr', titel: 'Plattformgebühr (EUR)', beispiel: '' }
        ],
        ausgaben: [
            { schluessel: 'datum',        titel: 'Datum (JJJJ-MM-TT)',    beispiel: '2026-01-10' },
            { schluessel: 'kategorie',    titel: 'Kategorie',             beispiel: 'Versandmaterial' },
            { schluessel: 'beschreibung', titel: 'Beschreibung',          beispiel: 'Bubble-Wrap Rolle' },
            { schluessel: 'betrag',       titel: 'Betrag (€)',            beispiel: '12.99' },
            // Schluessel = der normalisierte Titel ("Plattform / Lieferant" -> "plattformlieferant")
            { schluessel: 'plattformlieferant', titel: 'Plattform / Lieferant', beispiel: 'Amazon' },
            { schluessel: 'notizen',      titel: 'Notizen',               beispiel: '' }
        ]
    };

    // Kopfzeilen-Pruefung: der Import liest nach Spaltenindex, eine fremde Datei ergaebe sonst stillen
    // Unsinn mit Erfolgsmeldung. Absichtlich tolerant (Umlaute, Klammerzusaetze, Gross/Klein); mindestens
    // die Haelfte der Spalten (min. 3) muss an ihrer Position sitzen.
    function normSpalte(h) {
        return String(h || '').replace(/\(.*?\)/g, '').toLowerCase()
            .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
            .replace(/[^a-z0-9]/g, '');
    }
    function pruefeKopfzeile(rows, art) {
        var erwartet = SPALTEN[art];
        var kopf = (rows[0] || []).map(normSpalte);
        var treffer = 0;
        erwartet.forEach(function (s, i) {
            var ist = kopf[i] || '';
            if (ist && (ist === s.schluessel || ist.indexOf(s.schluessel) === 0 || s.schluessel.indexOf(ist) === 0)) treffer++;
        });
        return {
            ok: treffer >= Math.max(3, Math.ceil(erwartet.length / 2)),
            treffer: treffer,
            gesamt: erwartet.length,
            erwartetText: erwartet.slice(0, 4).map(function (s) { return s.titel; }).join(', ') + ', …'
        };
    }

    function text(v) { return v == null ? '' : String(v).trim(); }
    function istLeer(v) { return v == null || (!(v instanceof Date) && String(v).trim() === ''); }
    function eur(n) { return n.toFixed(2).replace('.', ',') + ' €'; }

    // Leeres Datum = heute (Verhalten der Vorlage), gefuelltes aber ungueltiges = Fehler (nie still ersetzen).
    function datumFeld(v, opt, name) {
        if (istLeer(v)) return { wert: opt.heute };
        var d = K.datum(v);
        return d ? { wert: d } : { grund: name + ' ungültig (' + text(v) + ')' };
    }
    // Optionaler Betrag: leer = 0, sonst Zahl >= 0
    function betragFeld(v, name) {
        if (istLeer(v)) return { wert: 0 };
        var n = K.zahl(v, null);
        if (n === null) return { grund: name + ' ist keine Zahl' };
        if (n < 0) return { grund: name + ' ist negativ' };
        return { wert: n };
    }

    // Laeuft ueber die Datenzeilen; pruefe(r) gibt einen Grund (String) oder das Zeilenobjekt zurueck.
    function lauf(rows, opt, pruefe) {
        var zeilen = [], fehler = [], start = opt.startZeile || 1;
        rows.slice(1).forEach(function (r, i) {
            r = r || [];
            if (r.every(istLeer)) return;                 // Leerzeile: still, zaehlt aber fuer die Nummer
            var zeile = start + i + 1;
            var e = pruefe(r);
            if (typeof e === 'string') fehler.push({ zeile: zeile, grund: e });
            else { e.zeile = zeile; zeilen.push(e); }
        });
        return { zeilen: zeilen, fehler: fehler };
    }
    function gesperrtFn(opt) { return opt.gesperrt || function () { return false; }; }
    function dubl(z, dublette) { z.dublette = dublette; z.importieren = !dublette; return z; }

    // ── Einkaeufe ────────────────────────────────────────────────────────────
    function einkaeufe(rows, opt) {
        var bestand = L._bestandEinkauf(opt.purchases).fp, zaehler = {}, gesperrt = gesperrtFn(opt);
        return lauf(rows, opt, function (r) {
            var marke = text(r[1]), beschr = text(r[4]);
            var preis = istLeer(r[5]) ? null : K.zahl(r[5], null);
            if (preis === null) return 'EK-Preis fehlt oder ist keine Zahl';
            if (preis < 0) return 'EK-Preis ist negativ';
            if (!marke && !beschr) return 'Marke und Beschreibung fehlen';
            var d = datumFeld(r[0], opt, 'Datum');
            if (d.grund) return d.grund;
            if (gesperrt(d.wert)) return 'Periode festgeschrieben (Kaufdatum ' + d.wert + ')';
            var purchase = {
                datum: d.wert,
                marke: marke,
                artikeltyp: text(r[2]) || 'Sonstiges',
                groesse: text(r[3]),
                beschreibung: beschr,
                einkaufspreis: preis,
                anzahl: Math.max(1, Math.min(9999, parseInt(text(r[6]).replace(/[^\d]/g, ''), 10) || 1)),
                einkaufsquelle: text(r[7]) || 'Sonstiges',
                notizen: text(r[8]),
                status: 'verfuegbar'
            };
            // Eine Vorlagenzeile ist ein Datensatz (die Anzahl steht im Feld), deshalb +1 je Zeile
            var fp = L.fpEinkauf(d.wert, marke, beschr, purchase.groesse, preis);
            var nr = (zaehler[fp] = (zaehler[fp] || 0) + 1);
            return dubl({ purchase: purchase, sale: null, label: (marke + ' ' + beschr).trim() + ' · EK ' + eur(preis) }, (bestand[fp] || 0) >= nr);
        });
    }

    // ── Verkaeufe ────────────────────────────────────────────────────────────
    function verkaeufe(rows, opt) {
        var bestand = L._bestandVerkauf(opt.sales, opt.purchases), zaehler = {}, gesperrt = gesperrtFn(opt);
        return lauf(rows, opt, function (r) {
            var marke = text(r[1]), beschr = text(r[4]);
            if (!marke && !beschr) return 'Marke und Beschreibung fehlen';
            var d = datumFeld(r[0], opt, 'Datum');
            if (d.grund) return d.grund;
            var preis = istLeer(r[5]) ? null : K.zahl(r[5], null);
            if (preis === null || preis <= 0) return 'Verkaufspreis fehlt, ist 0 oder keine Zahl';
            var vsk = betragFeld(r[6], 'Versand-Käufer'), pct = betragFeld(r[7], 'Plattformgebühr (%)'),
                vvk = betragFeld(r[8], 'Versand-Verkäufer'), geb = betragFeld(r[12], 'Plattformgebühr (EUR)');
            var g = vsk.grund || pct.grund || vvk.grund || geb.grund;
            if (g) return g;
            if (gesperrt(d.wert)) return 'Periode festgeschrieben (Verkaufsdatum ' + d.wert + ')';
            var sale = {
                datum: d.wert,
                marke: marke,
                artikeltyp: text(r[2]),
                groesse: text(r[3]),
                beschreibung: beschr,
                verkaufspreis: preis,
                versandkostenKaeufer: vsk.wert,
                // Prozent-Spalte hat Vorrang; sonst optionale EUR-Spalte -> Prozent, 2 Stellen
                plattformgebuehrProzent: L.gebuehrAusAngaben(pct.wert, geb.wert, preis, vsk.wert),
                versandkostenVerkaufer: vvk.wert,
                verkaufsplattform: text(r[9]),
                kaeufer: text(r[10]),
                notizen: text(r[11])
            };
            var fp = L.fpVerkauf(d.wert, preis, beschr, sale.verkaufsplattform);
            var nr = (zaehler[fp] = (zaehler[fp] || 0) + 1);
            return dubl({ purchase: null, sale: sale, label: d.wert + ' · ' + ((marke + ' ' + beschr).trim()) + ' · ' + eur(preis) }, (bestand[fp] || 0) >= nr);
        });
    }

    // ── Ausgaben (ohne Dublettenpruefung: es gibt keinen vorhandenen Schluessel fuer diese Felder) ──
    function ausgaben(rows, opt) {
        var gesperrt = gesperrtFn(opt);
        return lauf(rows, opt, function (r) {
            var betrag = istLeer(r[3]) ? null : K.zahl(r[3], null);
            if (betrag === null) return 'Betrag fehlt oder ist keine Zahl';
            if (betrag <= 0) return 'Betrag muss größer 0 sein';
            var d = datumFeld(r[0], opt, 'Datum');
            if (d.grund) return d.grund;
            if (gesperrt(d.wert)) return 'Periode festgeschrieben (Datum ' + d.wert + ')';
            var expense = {
                datum: d.wert,
                kategorie: text(r[1]) || 'Sonstiges',
                beschreibung: text(r[2]),
                betrag: betrag,
                plattform: text(r[4]),
                notizen: text(r[5])
            };
            return dubl({ purchase: null, sale: null, expense: expense, label: d.wert + ' · ' + (expense.beschreibung || expense.kategorie) + ' · ' + eur(betrag) }, false);
        });
    }

    // ── Flache Liste: eine Zeile je Artikel mit Kaufdatum, Einkauf, Verkauf (z. B. private Reselling-Listen) ──
    // Kopfzeile irgendwo in den ersten 30 Zeilen. Gesperrt ist die Zeile, wenn Kauf- ODER Verkaufsdatum
    // in einer festgeschriebenen Periode liegt (wie LagerImport.einkaufsZeilen). Dublette ueber den Einkauf.
    function flach(rows, opt) {
        var norm = function (h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
        var col = null, kopfIdx = -1;
        for (var i = 0; i < Math.min(rows.length, 30) && !col; i++) {
            var cand = {}, woSeen = 0;
            (rows[i] || []).forEach(function (h, ci) {
                var n = norm(h);
                if (n === 'kaufdatum') cand.kaufdatum = ci;
                else if (n === 'verkaufsdatum') cand.verkaufsdatum = ci;
                else if (n === 'was' || n.indexOf('artikel') > -1 || n.indexOf('produkt') > -1) cand.beschreibung = ci;
                else if (n === 'einkauf') cand.einkauf = ci;
                else if (n === 'verkauf') cand.verkauf = ci;
                else if (/^wo\d*$/.test(n)) { woSeen++; if (woSeen === 1) cand.quelle = ci; else cand.plattform = ci; }
            });
            if (cand.kaufdatum !== undefined && cand.einkauf !== undefined && cand.verkauf !== undefined) { col = cand; kopfIdx = i; }
        }
        if (!col) return null;
        var bestand = L._bestandEinkauf(opt.purchases).fp, zaehler = {}, gesperrt = gesperrtFn(opt);
        var get = function (r, c) { return c === undefined ? '' : r[c]; };
        var o = Object.assign({}, opt, { startZeile: (opt.startZeile || 1) + kopfIdx });
        var erg = lauf(rows.slice(kopfIdx), o, function (r) {
            var kaufRoh = get(r, col.kaufdatum);
            if (istLeer(kaufRoh)) return { leer: true };            // Summen-/Leerzeilen still uebergehen
            var beschr = text(get(r, col.beschreibung)), quelle = text(get(r, col.quelle));
            var preis = istLeer(get(r, col.einkauf)) ? null : K.zahl(get(r, col.einkauf), null);
            if (preis === null) return 'Einkauf fehlt oder ist keine Zahl';
            if (preis < 0) return 'Einkauf ist negativ';
            var kd = K.datum(kaufRoh);
            if (!kd) return 'Kaufdatum ungültig (' + text(kaufRoh) + ')';
            if (gesperrt(kd)) return 'Periode festgeschrieben (Kaufdatum ' + kd + ')';
            var purchase = {
                datum: kd, marke: '', artikeltyp: 'Sonstiges', groesse: '', beschreibung: beschr,
                einkaufspreis: preis, anzahl: 1, einkaufsquelle: quelle || 'Sonstiges', notizen: '', status: 'verfuegbar'
            };
            var sale = null, vkRoh = get(r, col.verkaufsdatum), vkPreisRoh = get(r, col.verkauf);
            if (!istLeer(vkRoh) || !istLeer(vkPreisRoh)) {
                var ohneDatum = istLeer(vkRoh);
                var vd = ohneDatum ? kd : K.datum(vkRoh);
                if (!vd) return 'Verkaufsdatum ungültig (' + text(vkRoh) + ')';
                var vp = betragFeld(vkPreisRoh, 'Verkauf');
                if (vp.grund) return vp.grund;
                if (gesperrt(vd)) return 'Periode festgeschrieben (Verkaufsdatum ' + vd + ')';
                sale = {
                    datum: vd, marke: '', artikeltyp: 'Sonstiges', groesse: '', beschreibung: beschr,
                    verkaufspreis: vp.wert, versandkostenKaeufer: 0, plattformgebuehrProzent: 0, versandkostenVerkaufer: 0,
                    verkaufsplattform: text(get(r, col.plattform)), kaeufer: '',
                    notizen: ohneDatum ? 'Verkaufsdatum unbekannt – Kaufdatum übernommen' : ''
                };
            }
            var fp = L.fpEinkauf(kd, '', beschr, '', preis);
            var nr = (zaehler[fp] = (zaehler[fp] || 0) + 1);
            return dubl({ purchase: purchase, sale: sale, label: (beschr || '—') + ' · EK ' + eur(preis) }, (bestand[fp] || 0) >= nr);
        });
        erg.zeilen = erg.zeilen.filter(function (z) { return !z.leer; });
        return erg;
    }

    // Legt die ausgewaehlten Zeilen aller Teile an. teile = [{ blatt, erg }]. Gibt Zaehler zurueck.
    // Verkauf einer flachen Zeile wird mit dem eben angelegten Einkauf verknuepft.
    function anlegen(teile, store) {
        var n = { einkauf: 0, verkauf: 0, ausgaben: 0 };
        teile.forEach(function (t) {
            t.erg.zeilen.forEach(function (z) {
                if (!z.importieren) return;
                var gespeichert = null;
                if (z.purchase) {
                    if (z.purchase.marke) store.addBrand(z.purchase.marke);
                    if (z.purchase.einkaufsquelle) store.addEinkaufsquelle(z.purchase.einkaufsquelle);
                    gespeichert = store.savePurchase(Object.assign({}, z.purchase));
                    if (!gespeichert || !gespeichert.id) return;   // z. B. Plan-Limit: dann auch keinen Verkauf
                    n.einkauf++;
                }
                if (z.sale) {
                    var sale = Object.assign({}, z.sale);
                    if (gespeichert) sale.purchaseId = gespeichert.id;
                    if (sale.verkaufsplattform) store.addPlatform(sale.verkaufsplattform);
                    var s = store.saveSale(sale);
                    if (s && s.id) n.verkauf++;
                }
                if (z.expense) {
                    var e = store.saveExpense(Object.assign({}, z.expense));
                    if (e && e.id) n.ausgaben++;
                }
            });
        });
        return n;
    }

    // Alle Teile zu einem Ergebnis fuer LagerImport.berichtHtml/zeigeBericht/nichtImportiert:
    // Blattname vor Grund und Label, Zeilennummer bleibt die des Blatts.
    function bericht(teile) {
        var zeilen = [], fehler = [];
        teile.forEach(function (t) {
            t.erg.fehler.forEach(function (f) { fehler.push({ zeile: f.zeile, grund: t.blatt + ': ' + f.grund }); });
            t.erg.zeilen.forEach(function (z) {
                zeilen.push({ zeile: z.zeile, dublette: z.dublette, importieren: z.importieren, label: t.blatt + ': ' + z.label });
            });
        });
        return { zeilen: zeilen, fehler: fehler };
    }

    // Abschlussmeldung: eine Null wird genannt, wenn das Blatt DA WAR und trotzdem nichts ergab; ein FEHLENDES
    // oder abgelehntes Blatt bleibt stumm (laut Anleitung darf man Blaetter leer lassen; die Ablehnung hat ihre
    // eigene Meldung). Der Flach-Zweig legt nur Einkaeufe und Verkaeufe an, nie Ausgaben.
    function meldung(n, teile, flachGenutzt) {
        var hat = function (art) { return teile.some(function (t) { return t.art === art; }); };
        return [
            (hat('einkauf') || flachGenutzt) ? n.einkauf + ' Einkäufe' : '',
            (hat('verkauf') || flachGenutzt) ? n.verkauf + ' Verkäufe' : '',
            hat('ausgaben') ? n.ausgaben + ' Ausgaben' : ''
        ].filter(Boolean).join(', ') || '0 Datensätze';
    }

    return {
        SPALTEN: SPALTEN, meldung: meldung, pruefeKopfzeile: pruefeKopfzeile,
        einkaeufe: einkaeufe, verkaeufe: verkaeufe, ausgaben: ausgaben, flach: flach,
        anlegen: anlegen, bericht: bericht
    };
})();
if (typeof window !== 'undefined') window.ExcelVorlageImport = ExcelVorlageImport;
