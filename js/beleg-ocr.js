// Belegerkennung: Extraktionsheuristik (Fund G4)
//
// Zerlegt den OCR-Rohtext eines Kassenbons in Datum, Bruttobetrag und Haendlername.
// Bewusst OHNE jeden Browser-Bezug: kein DOM, kein WASM, keine Abhaengigkeit auf
// tesseract.js. Der Grund ist derselbe wie beim Zahlungsabgleich (js/bank-import.js,
// Fund G3): die Regeln sind Heuristiken, sie werden sich aendern, und sie muessen
// sich ohne Browser und ohne ~8 MB WASM pruefen lassen.
//   Test: node test/test-beleg-ocr.js
//
// Die drei Regeln stammen aus plan/ocr-belegerkennung-2026-08-12.md, Abschnitt 5.
// Wer sie aendert, aendert sie dort mit.
//
// WICHTIG: Nichts hiervon traegt selbst etwas in ein Formular ein. Die Rueckgabe ist
// ein Vorschlag, den der Nutzer per Klick uebernimmt — ein falsch vorbefuelltes Feld
// ist schlimmer als ein leeres.

var BelegOCR = (function () {
    'use strict';

    // ── Datum ────────────────────────────────────────────────────────────────
    // TT.MM.JJJJ oder TT.MM.JJ. Bei mehreren Treffern das FRUEHESTE: Bons tragen
    // neben dem Kaufdatum oft ein spaeteres Druck- oder Abrechnungsdatum.
    var RE_DATUM = /(?:^|[^\d.])(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?!\d)/g;

    function _istEchtesDatum(t, m, j) {
        if (m < 1 || m > 12 || t < 1 || t > 31) return false;
        var d = new Date(Date.UTC(j, m - 1, t));
        // Faengt den 31.02. ab: Date rollt sonst still auf den 03.03. weiter.
        return d.getUTCFullYear() === j && d.getUTCMonth() === m - 1 && d.getUTCDate() === t;
    }

    function _iso(j, m, t) {
        return String(j) + '-' + ('0' + m).slice(-2) + '-' + ('0' + t).slice(-2);
    }

    function findDatum(text) {
        var treffer = [];
        var m;
        RE_DATUM.lastIndex = 0;
        while ((m = RE_DATUM.exec(text)) !== null) {
            var t  = parseInt(m[1], 10);
            var mo = parseInt(m[2], 10);
            var jRoh = m[3];
            // Zweistellig ist immer 20xx. Ein Kassenbon aus dem letzten Jahrhundert
            // gehoert in keine laufende Buchhaltung; 2000+JJ ist die einzige Lesart,
            // die hier ueberhaupt plausibel ist.
            var j = jRoh.length === 2 ? 2000 + parseInt(jRoh, 10) : parseInt(jRoh, 10);
            if (!_istEchtesDatum(t, mo, j)) continue;
            treffer.push({ wert: _iso(j, mo, t), roh: m[1] + '.' + m[2] + '.' + jRoh });
        }
        if (!treffer.length) return null;
        treffer.sort(function (a, b) { return a.wert < b.wert ? -1 : a.wert > b.wert ? 1 : 0; });
        return treffer[0];
    }

    // ── Betrag ───────────────────────────────────────────────────────────────
    // Zeile mit SUMME / GESAMT / TOTAL / ZU ZAHLEN bevorzugt, sonst der groesste
    // Betrag mit zwei Nachkommastellen.
    var RE_SUMMENZEILE = /summe|gesamt|total|zu\s+zahlen/i;

    // Eine Zwischensumme ist per Definition NICHT der Endbetrag — sie traegt aber das
    // Wort "summe" und landete damit im selben Pool. Solange nichts abgezogen wird, faellt
    // das nicht auf: dann ist sie gleich gross wie die Summe. Sobald ein Rabatt, Gutschein
    // oder Pfandabzug dazwischensteht, ist sie GROESSER als der Endbetrag — und weil aus dem
    // Pool der groesste Betrag gewinnt, schlaegt sie die richtige Summe:
    //     Zwischensumme 100,00 / Rabatt -14,10 / SUMME 85,90   ->  100,00
    // Derselbe Fehler nach oben wie beim gemessenen Bon (785,90 statt 85,90), nur aus einer
    // anderen Richtung, und mit denselben Folgen: zu hohe Betriebsausgabe, zu hohe Vorsteuer.
    //
    // Bewusst eine EIGENE, enge Liste statt RE_TEILBETRAG: dort stehen auch "netto" und
    // "mwst", und "Summe inkl. MwSt" ist eine voellig normale Endbetragszeile, die im Pool
    // bleiben muss. Ausgeschlossen wird nur, was schon dem Namen nach ein Zwischenstand ist.
    var RE_ZWISCHENSUMME = /zwischensumme|zwischen\s?summe|subtotal|uebertrag|übertrag/i;

    // Vier Schreibweisen, laengere zuerst — sonst frisst die kurze Alternative den
    // Tausendertrenner nicht mit:  1.234,56 | 1234,56 | 1,234.56 | 1234.56
    var RE_BETRAG = /(?:^|[^\d.,])(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d+\.\d{2})(?!\d)/g;

    function _zuZahl(roh) {
        // Der zuletzt auftretende Trenner ist das Dezimalzeichen, der andere ist
        // Tausendertrenner — gilt fuer beide Schreibweisen gleichermassen.
        var trenner = roh.lastIndexOf(',') > roh.lastIndexOf('.') ? ',' : '.';
        var teile = roh.split(trenner);
        var nachkomma = teile.pop();
        var vorkomma = teile.join('').replace(/[.,\s]/g, '');
        return parseFloat(vorkomma + '.' + nachkomma);
    }

    // Alle Betraege einer Zeile. Zwei Dinge sehen wie ein Betrag aus, sind aber keiner,
    // und beide wuerden in der Rueckfallregel ("groesster Betrag") jeden kleinen
    // Bon-Endbetrag schlagen:
    //   1. Ein Wert mit nachfolgendem Prozentzeichen ist ein MwSt-SATZ ("19,00 %").
    //   2. Der Kopf eines Datums. "27.08.2026" enthaelt "27.08" — mit zwei Ziffern nach
    //      dem Punkt und einem Nicht-Ziffer-Zeichen dahinter, also formal ein Betrag.
    //      Ein Datum steht auf JEDEM Bon, und jeder Endbetrag unter 31,12 verloere
    //      gegen den Tag-Monat-Kopf. Erkennungsmerkmal: direkt dahinter folgt ein
    //      weiterer Trenner mit Ziffer (".2026"). Ein echter Betrag am Satzende
    //      ("3,99.") hat dort keine Ziffer und bleibt drin.
    //   3. Eine Uhrzeit in Punktschreibweise. "07.45" hat zwei Nachkommastellen und
    //      nichts dahinter — die Datumsabwehr aus Punkt 2 greift nicht, weil eine Uhrzeit
    //      keinen dritten Teil hat. Im Rueckfall schlaegt sie jeden Bon unter 24 Euro
    //      (Fund 3 aus plan/funde-betragsregel-2026-08-30.md). Erkannt wird sie nur, wenn
    //      die ZEILE sie ankuendigt — "Kaffee 7.45" bleibt damit ein Betrag.
    var RE_UHRZEITZEILE = /uhrzeit|\buhr\b|\bzeit\b/i;
    var RE_UHRZEITFORM  = /^(\d{1,2})\.(\d{2})$/;

    function _betraegeDerZeile(zeile) {
        var out = [];
        var m;
        var istZeitzeile = RE_UHRZEITZEILE.test(zeile);
        RE_BETRAG.lastIndex = 0;
        while ((m = RE_BETRAG.exec(zeile)) !== null) {
            var rest = zeile.slice(m.index + m[0].length);
            if (/^\s*%/.test(rest)) continue;
            if (/^[.,]\d/.test(rest)) continue;
            if (istZeitzeile) {
                var u = RE_UHRZEITFORM.exec(m[1]);
                if (u && parseInt(u[1], 10) < 24 && parseInt(u[2], 10) < 60) continue;
            }
            var wert = _zuZahl(m[1]);
            if (!isFinite(wert)) continue;
            // Vorzeichen: RE_BETRAG verlangt vor der Zahl ein Nicht-Ziffer-Zeichen und
            // verschluckt das Minus dabei — aus "-49,99" wurde 49,99, aus einer Erstattung
            // also eine Ausgabe (Fund 2, ebenda). Gewertet wird nur ein direkt anliegendes
            // Minus, vorn oder hinten ("49,99-" ist im deutschen Kassendruck ueblich); ein
            // Bindestrich mit Leerzeichen drumherum ist ein Trennstrich, kein Vorzeichen.
            var davor = m[0].length > m[1].length ? m[0].charAt(0) : '';
            var negativ = davor === '-' || /^-/.test(rest);
            out.push({ wert: wert, roh: m[1], negativ: negativ });
        }
        return out;
    }

    function _groesster(liste) {
        if (!liste.length) return null;
        return liste.reduce(function (a, b) { return b.wert > a.wert ? b : a; });
    }

    // ── Konsens-Gegenprobe (Spezifikation Abschnitt 5a) ──────────────────────
    // Anlass ist gemessen: am 2026-08-30 las die Erkennung "SUMME [2]  EUR  85,90"
    // als "SUMME [2 EUR 785,90" — die schliessende Klammer wurde zur 7 und klebte am
    // Betrag. Beide bisherigen Regeln liefern dabei denselben falschen Wert: die
    // Schluesselwortzeile, weil 785,90 der einzige Betrag darin ist, und der Rueckfall
    // "groesster Betrag" auch, weil die verunglueckte Zeile stehen bleibt. Es gab also
    // kein Netz darunter — und der Fehler geht nach OBEN, also in Richtung zu hoher
    // Betriebsausgabe und zu hoher Vorsteuer.
    //
    // Bestaetigungswoerter: hier steht bewusst KEIN "BAR"/"GEGEBEN". Auf einem Barbon
    // ist "Gegeben 50,00" genau der Betrag, der nicht gewinnen soll; ihn als Bestaetigung
    // zuzulassen hoebe die Summenregel von hinten wieder auf.
    //
    // Das \b vorn ist nicht kosmetisch. Ohne es traf /betrag/ auch "Rabattbetrag" und
    // "Nettobetrag" — dann bestaetigt ausgerechnet eine Teilbetragszeile einen Kandidaten
    // als Endbetrag, und die Sicherung, die diese Regel ungefaehrlich macht, faellt aus.
    // Belegt: eine korrekt gelesene "SUMME 85,90" wurde neben "Rabattbetrag 5,90" auf
    // 5,90 heruntergezogen. "Rechnungsbetrag" und "Zahlbetrag" stehen deshalb einzeln
    // drin — sie sind echte Endbetraege und wuerden vom \b sonst mitgerissen.
    var RE_BESTAETIGUNG = /\b(?:betrag|brutto|summe|gesamt|total|zu\s+zahlen|endbetrag|rechnungsbetrag|zahlbetrag)/i;

    // Das \b allein genuegt nicht: ein Bindestrich IST eine Wortgrenze, "MwSt-Betrag"
    // kaeme also durch. Eine Zeile, die einen Teilbetrag ausweist, kann keinen Endbetrag
    // bestaetigen — unabhaengig davon, wie das Wort zusammengesetzt ist.
    var RE_TEILBETRAG = /rabatt|netto|mwst|\bust\b|steuer|trinkgeld|pfand|zwischensumme|anzahlung|gutschein/i;

    // Vergleichsform ohne Tausendertrenner, Dezimalzeichen vereinheitlicht:
    // "1.234,56" und "1234.56" werden beide zu "1234,56".
    function _ziffernform(roh) {
        var trenner = roh.lastIndexOf(',') > roh.lastIndexOf('.') ? ',' : '.';
        var teile = roh.split(trenner);
        var nachkomma = teile.pop();
        var vorkomma = teile.join('').replace(/[.,\s]/g, '');
        return vorkomma + ',' + nachkomma;
    }

    // Ist `kurz` der Rest von `lang`, nachdem vorne GENAU EINE Ziffer wegfaellt?
    // Genau eine, weil das das beobachtete Muster ist: ein einzelnes Zeichen, das die
    // Erkennung an den Betrag geklebt hat. Mehr zuzulassen hiesse raten.
    function _istAngeklebteZiffer(lang, kurz) {
        if (lang.length !== kurz.length + 1) return false;
        if (lang.slice(1) !== kurz) return false;
        return /^\d$/.test(lang.charAt(0));
    }

    function _konsensGegenprobe(gewinner, alle) {
        if (!gewinner) return gewinner;

        var haeufigkeit = {};   // Ziffernform -> Anzahl im ganzen Bon
        var bestaetigt  = {};   // Ziffernform -> stand mind. einmal auf einer Endbetragszeile
        for (var i = 0; i < alle.length; i++) {
            var f = _ziffernform(alle[i].roh);
            haeufigkeit[f] = (haeufigkeit[f] || 0) + 1;
            if (alle[i].bestaetigt) bestaetigt[f] = true;
        }

        var gForm = _ziffernform(gewinner.roh);
        // Bedingung 1: der Gewinner steht nur ein einziges Mal auf dem Bon.
        if (haeufigkeit[gForm] !== 1) return gewinner;

        var bester = null;
        for (var j = 0; j < alle.length; j++) {
            var kForm = _ziffernform(alle[j].roh);
            if (haeufigkeit[kForm] < 2) continue;            // Bedingung 2
            if (!_istAngeklebteZiffer(gForm, kForm)) continue; // Bedingung 3
            if (!bestaetigt[kForm]) continue;                 // Bedingung 4
            if (!bester || alle[j].wert > bester.wert) bester = alle[j];
        }
        if (!bester) return gewinner;

        // Nicht stillschweigend korrigieren: was urspruenglich dastand, bleibt am
        // Treffer haengen, damit der Chip beides zeigen kann.
        return { wert: bester.wert, roh: bester.roh, korrigiertVon: gewinner.roh };
    }

    function findBetrag(zeilen) {
        var ausSummenzeilen = [];
        var alle = [];
        for (var i = 0; i < zeilen.length; i++) {
            var b = _betraegeDerZeile(zeilen[i]);
            if (!b.length) continue;
            // Negative Betraege kommen gar nicht erst in die Auswahl: der Bruttobetrag
            // eines Eigenbelegs ist nie negativ. Das erledigt zwei Faelle auf einmal —
            // die Rabatt- oder Gutscheinzeile, die im Rueckfall sonst als "groesster
            // Betrag" gewinnt, und die Retoure, deren Summenzeile nur noch aus negativen
            // Betraegen besteht. Im zweiten Fall bleibt am Ende nichts uebrig, und genau
            // das ist die richtige Antwort: lieber kein Vorschlag als ein Vorzeichenfehler,
            // den beim Klicken niemand nachrechnet.
            var positiv = [];
            for (var n = 0; n < b.length; n++) if (!b[n].negativ) positiv.push(b[n]);
            if (!positiv.length) continue;
            b = positiv;
            // Merkt sich pro Betrag, ob seine Zeile ihn als Endbetrag ausweist —
            // gebraucht von der Gegenprobe, nicht von der Auswahl selbst.
            if (RE_BESTAETIGUNG.test(zeilen[i]) && !RE_TEILBETRAG.test(zeilen[i])) {
                for (var k = 0; k < b.length; k++) b[k].bestaetigt = true;
            }
            alle = alle.concat(b);
            if (RE_SUMMENZEILE.test(zeilen[i]) && !RE_ZWISCHENSUMME.test(zeilen[i])) {
                ausSummenzeilen = ausSummenzeilen.concat(b);
            }
        }
        var gewinner = _groesster(ausSummenzeilen.length ? ausSummenzeilen : alle);
        return _konsensGegenprobe(gewinner, alle);
    }

    // ── Haendler ─────────────────────────────────────────────────────────────
    // Erste Zeile mit mindestens drei Buchstaben, die keine Zahl und keine
    // Adressfloskel ist. Der Bonkopf traegt den Namen fast immer zuerst.
    var RE_BUCHSTABE = /[A-Za-zÄÖÜäöüß]/g;
    var RE_ZIFFER    = /\d/;
    var RE_FLOSKEL   = new RegExp([
        'stra(?:ss|ß)e', '\\bstr\\.', '\\bweg\\b', '\\bplatz\\b', '\\ballee\\b',
        '\\bgasse\\b', '\\bring\\b', '\\bchaussee\\b', '\\bufer\\b',
        'telefon', '\\btel\\b', '\\bfax\\b', 'e-?mail', 'www\\.', 'https?:',
        'steuernummer', 'st\\.-?nr', 'ust-?id', '\\buid\\b',
        'kundenbeleg', 'quittung', 'rechnung', 'kassenbon', '\\bbeleg\\b',
        'vielen dank', '\\bdanke\\b', 'auf wiedersehen', '(?:oe|ö)ffnungszeiten',
    ].join('|'), 'i');

    function findHaendler(zeilen) {
        for (var i = 0; i < zeilen.length; i++) {
            // OCR-Rauschen am Zeilenrand (*, =, |, ~) abschneiden, den Punkt am Ende
            // aber behalten — "Muster GmbH & Co. KG" soll ganz bleiben.
            var z = zeilen[i]
                .replace(/^[^A-Za-zÄÖÜäöüß0-9]+/, '')
                .replace(/[^A-Za-zÄÖÜäöüß0-9.]+$/, '')
                .trim();
            if (!z) continue;
            if (RE_ZIFFER.test(z)) continue;
            var buchstaben = z.match(RE_BUCHSTABE);
            if (!buchstaben || buchstaben.length < 3) continue;
            if (RE_FLOSKEL.test(z)) continue;
            return { wert: z, roh: zeilen[i].trim() };
        }
        return null;
    }

    // ── Einstieg ─────────────────────────────────────────────────────────────
    function extract(text) {
        if (typeof text !== 'string' || !text.trim()) {
            return { datum: null, betrag: null, haendler: null };
        }
        var zeilen = text.split(/\r?\n/);
        return {
            datum:    findDatum(text),
            betrag:   findBetrag(zeilen),
            haendler: findHaendler(zeilen),
        };
    }

    return {
        extract: extract,
        // Einzeln exportiert, damit der Test jede Regel fuer sich pruefen kann.
        findDatum: findDatum,
        findBetrag: findBetrag,
        findHaendler: findHaendler,
    };
})();
