// ============================================================
// Belegerkennung — gemeinsamer Unterbau fuer alle Formulare
//
// Warum es diese Datei gibt: die Erkennung hing bis zum 2026-09-21 ausschliesslich im
// Eigenbeleg-Formular. Das Anforderungsprofil (plan/pruefliste-buchhaltung-2026-09-21.md,
// Kriterium 2.1) verlangt sie fuer die Belegerfassung allgemein — und der Vorsteuerabzug
// haengt ohnehin an den Ausgaben, nicht an den Eigenbelegen. Der Motor gehoert deshalb an
// eine Stelle, nicht in jedes Formular kopiert.
//
// Was hier liegt: das Laden der Engine, der Worker, die PDF-Textschicht und die generischen
// Chip-Bausteine. Was NICHT hier liegt: welches Feld welchen Treffer bekommt — das weiss
// nur das jeweilige Formular.
//
// Zwei Zusagen dieser Datei, beide aelter als sie selbst:
//   • Kein Bild und kein PDF verlaesst das Geraet. Deshalb ~8 MB WASM statt eines
//     OCR-Endpunkts (plan/ocr-belegerkennung-2026-08-12.md, Abschnitt 1).
//   • Nichts wird automatisch eingetragen. Treffer sind anklickbare Vorschlaege. Ein
//     falsch vorbefuelltes Feld ist schlimmer als ein leeres.
//
// Die Heuristik selbst steht in js/beleg-ocr.js und ist ohne Browser testbar.
//   Test des PDF-Teils: node test/test-beleg-pdf-text.js
// ============================================================

var BelegOcrUi = (function () {
    'use strict';

    var _worker     = null;   // bleibt fuer weitere Belege derselben Sitzung stehen
    var _libPromise = null;

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── Engine laden ─────────────────────────────────────────────────────────
    /** Lazy-load des Loaders (~63 KB). Kern und Sprachmodell holt danach der Worker. */
    function _ensureTesseract() {
        if (typeof Tesseract !== 'undefined') return Promise.resolve();
        if (_libPromise) return _libPromise;
        _libPromise = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = '/js/vendor/tesseract.min.js';
            script.onload  = function () { resolve(); };
            script.onerror = function () { _libPromise = null; reject(new Error('tesseract.js nicht ladbar')); };
            document.head.appendChild(script);
        });
        return _libPromise;
    }

    // tesseract.js waehlt den Kern sonst selbst — und wuerde bei einem Verzeichnis als
    // corePath zuerst die relaxedsimd-Variante anfragen, die wir bewusst nicht vendoriert
    // haben (das waeren 3,9 MB mehr fuer einen kaum messbaren Gewinn). Deshalb pruefen wir
    // SIMD selbst und uebergeben eine konkrete Datei.
    // WebAssembly.validate() kompiliert nicht und faellt daher nicht unter wasm-unsafe-eval;
    // schlaegt es fehl, ist der Nicht-SIMD-Kern die sichere Antwort.
    function hatSimd() {
        try {
            return WebAssembly.validate(new Uint8Array([
                0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123,
                3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
            ]));
        } catch (e) { return false; }
    }

    // Statusnamen von tesseract.js sind englisch und technisch — hier die, die der Nutzer
    // tatsaechlich zu sehen bekommt.
    var STATUS_TEXT = {
        'loading tesseract core':        'Texterkennung wird geladen…',
        'initializing tesseract':        'Texterkennung wird gestartet…',
        'loading language traineddata':  'Sprachmodell wird geladen…',
        'initializing api':              'Texterkennung wird gestartet…',
        'recognizing text':              'Beleg wird gelesen…',
    };

    async function ensureWorker(onStatus) {
        if (_worker) return _worker;
        await _ensureTesseract();
        _worker = await Tesseract.createWorker('deu', 1, {
            workerPath: '/js/vendor/tesseract-worker.min.js',
            corePath:   hatSimd() ? '/js/vendor/tesseract-core-simd-lstm.wasm.js'
                                  : '/js/vendor/tesseract-core-lstm.wasm.js',
            langPath:   '/js/vendor/tessdata',
            // NICHT AENDERN, ohne die CSP mitzuaendern. tesseract.js startet den Worker
            // sonst aus einer blob:-URL — und ein blob:-Worker ERBT die CSP des Dokuments.
            // Dann braeuchte script-src zusaetzlich 'wasm-unsafe-eval' (und worker-src
            // blob:), weil der WASM-Kern im Worker kompiliert wird.
            // So dagegen laeuft der Worker von einer gleichnamigen Datei auf 'self':
            // erlaubt durch default-src, und seine eigene Antwort traegt keine CSP, also
            // kompiliert das WASM ohne jede Aufweichung. Am Build geprueft, s.
            // js/vendor/VERSIONS.md. Geprueft von test/test-ocr-worker-csp.js — dort
            // stehen beide Routen, /eigenbelege UND /app.html.
            workerBlobURL: false,
            // Das Sprachmodell kommt von unserem eigenen Origin und haengt im HTTP-Cache
            // (Cache-Control 7 Tage, s. vercel.json). Ein zweiter Zwischenspeicher in
            // IndexedDB brauchte eine eigene Erklaerung im Datenschutztext und spart nichts.
            cacheMethod: 'none',
            logger: function (m) {
                var txt = STATUS_TEXT[m.status];
                if (txt && onStatus) onStatus(txt, m.progress);
            },
        });
        return _worker;
    }

    // ── PDF: die Textschicht, ohne Texterkennung ─────────────────────────────
    // Das Anforderungsprofil nennt ausdruecklich "Kassenbons/PDFs". Ein vom Haendler
    // erzeugtes Rechnungs-PDF traegt den Text bereits — dort waere eine Texterkennung
    // der Umweg ueber ein Bild, das wir selbst erst rendern muessten, mit allen
    // Lesefehlern, die dabei entstehen. Die Textschicht ist die genauere Quelle.
    //
    // Derselbe Entpack-Weg wie in rechnungen/js/erechnung-import.js. Bewusst kein
    // PDF-Parser als Abhaengigkeit (Regel 6): gebraucht wird nur, was zwischen BT und ET
    // in Klammern steht.
    //
    // Ein GESCANNTES PDF hat keine Textschicht. Dann liefert das hier nichts Brauchbares,
    // und genau das muss es auch sagen — ein halb geratener Text waere schlimmer als die
    // ehrliche Auskunft "bitte als Bild hochladen". Die Schranke dafuer ist `_genugText`.
    function _bytesToLatin1(bytes) {
        var s = '', CH = 0x8000;
        for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
        return s;
    }

    async function _inflateAlle(bytes) {
        var stuecke = [];
        if (typeof DecompressionStream === 'undefined') return stuecke;
        var s = _bytesToLatin1(bytes), idx = 0;
        while (true) {
            var start = s.indexOf('stream', idx);
            if (start < 0) break;
            idx = start + 6;
            var end = s.indexOf('endstream', idx);
            if (end < 0) break;
            var b0 = start + 6;
            if (s[b0] === '\r') b0++;
            if (s[b0] === '\n') b0++;
            var chunk = bytes.subarray(b0, end);
            if (chunk.length > 8) {
                try {
                    var ds = new DecompressionStream('deflate');
                    var out = new Response(new Blob([chunk]).stream().pipeThrough(ds));
                    stuecke.push(await out.text());
                } catch (e) { /* kein Flate-Stream — z.B. ein eingebettetes Bild */ }
            }
            idx = end + 9;
        }
        return stuecke;
    }

    // Ein PDF-String steht in runden Klammern, mit Backslash-Maskierung, oder als
    // Hex zwischen spitzen Klammern.
    function _pdfString(roh) {
        var out = '';
        for (var i = 0; i < roh.length; i++) {
            var c = roh[i];
            if (c !== '\\') { out += c; continue; }
            var n = roh[++i];
            if (n === 'n') out += '\n';
            else if (n === 'r') out += '\n';
            else if (n === 't') out += '\t';
            else if (n === 'b' || n === 'f') out += ' ';
            else if (n >= '0' && n <= '7') {
                var okt = n;
                while (okt.length < 3 && roh[i + 1] >= '0' && roh[i + 1] <= '7') okt += roh[++i];
                out += String.fromCharCode(parseInt(okt, 8));
            } else if (n === '\n' || n === '\r') { /* Zeilenfortsetzung */ }
            else out += n;
        }
        return out;
    }
    function _pdfHex(roh) {
        var h = roh.replace(/[^0-9a-fA-F]/g, '');
        if (h.length % 2) h += '0';
        var out = '';
        for (var i = 0; i < h.length; i += 2) {
            var code = parseInt(h.substr(i, 2), 16);
            // Reine Hex-Strings sind oft in einer Subset-Kodierung, die ohne die
            // Font-Tabelle nicht aufloesbar ist. Was nicht wie druckbarer Text aussieht,
            // faellt raus statt als Rauschen in die Heuristik zu wandern.
            out += (code >= 32 && code < 127) || code >= 160 ? String.fromCharCode(code) : '';
        }
        return out;
    }

    // Aus dem Seiteninhalt die Textoperatoren einsammeln. Positionierbefehle (Td, TD,
    // T*, Tm) werden zu Zeilenumbruechen — die Heuristik in beleg-ocr.js arbeitet
    // zeilenweise, ein Text ohne Zeilen waere fuer sie wertlos.
    var RE_TEXTOP = /(\((?:[^()\\]|\\.)*\)|<[0-9a-fA-F\s]*>)\s*(Tj|TJ|'|")|\[((?:[^\][\\]|\\.)*)\]\s*TJ|(T\*|Td|TD|Tm|BT|ET)/g;

    function pdfTextAusInhalt(inhalt) {
        var out = '';
        var m;
        RE_TEXTOP.lastIndex = 0;
        while ((m = RE_TEXTOP.exec(inhalt)) !== null) {
            if (m[1]) {
                out += m[1].charAt(0) === '<' ? _pdfHex(m[1].slice(1, -1)) : _pdfString(m[1].slice(1, -1));
            } else if (m[3] !== undefined) {
                // TJ-Array: Strings mit Kerning-Zahlen dazwischen. Grosse negative Werte
                // sind ein Wortabstand — kleinere nur Unterschneidung.
                var innen = m[3], mm;
                var RE_ITEM = /\((?:[^()\\]|\\.)*\)|<[0-9a-fA-F\s]*>|-?\d+(?:\.\d+)?/g;
                while ((mm = RE_ITEM.exec(innen)) !== null) {
                    var t = mm[0];
                    if (t.charAt(0) === '(') out += _pdfString(t.slice(1, -1));
                    else if (t.charAt(0) === '<') out += _pdfHex(t.slice(1, -1));
                    else if (parseFloat(t) <= -100) out += ' ';
                }
            } else if (m[4]) {
                if (m[4] !== 'BT') out += '\n';
            }
        }
        return out;
    }

    // Reicht das, um es der Heuristik vorzulegen? Ein Scan-PDF liefert hier ein paar
    // Zeichen aus Metadaten und sonst nichts.
    function _genugText(text) {
        var buchstaben = (text.match(/[A-Za-zÄÖÜäöüß]/g) || []).length;
        var zeilen = text.split('\n').filter(function (z) { return z.trim().length > 0; }).length;
        return buchstaben >= 20 && zeilen >= 3;
    }

    async function pdfText(arrayBuffer) {
        var stuecke = await _inflateAlle(new Uint8Array(arrayBuffer));
        // Unkomprimierte Inhaltsstroeme gibt es auch — dann steht der Text im Klartext
        // in der Datei.
        stuecke.push(_bytesToLatin1(new Uint8Array(arrayBuffer)));
        var bester = '';
        for (var i = 0; i < stuecke.length; i++) {
            var t = pdfTextAusInhalt(stuecke[i]);
            if (t.length > bester.length) bester = t;
        }
        bester = bester.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
        return _genugText(bester) ? bester : null;
    }

    // ── Einstieg: eine Datei lesen ───────────────────────────────────────────
    /**
     * @param {File} datei  Bild oder PDF
     * @param {function(string, number|null)} [onStatus]
     * @returns {Promise<object>} Trefferobjekt von BelegOCR.extract()
     *
     * Wirft mit sprechender Meldung, wenn ein PDF keine Textschicht hat. Das ist kein
     * Fehler der App, sondern eine Eigenschaft der Datei — und der Nutzer kann etwas
     * dagegen tun (als Foto hochladen).
     */
    async function lese(datei, onStatus) {
        var istPdf = /\.pdf$/i.test(datei.name || '') || datei.type === 'application/pdf';
        if (istPdf) {
            if (onStatus) onStatus('PDF wird gelesen…', null);
            var text = await pdfText(await datei.arrayBuffer());
            if (!text) {
                throw new Error('Dieses PDF enthaelt keinen auslesbaren Text — es ist vermutlich ein Scan. '
                    + 'Lade den Beleg als Foto oder Bilddatei hoch, dann liest ihn die Texterkennung.');
            }
            return BelegOCR.extract(text);
        }
        if (onStatus) onStatus('Texterkennung wird geladen…', 0);
        var worker = await ensureWorker(onStatus);
        var ergebnis = await worker.recognize(datei);
        return BelegOCR.extract(ergebnis && ergebnis.data && ergebnis.data.text ? ergebnis.data.text : '');
    }

    // ── Chips ────────────────────────────────────────────────────────────────
    // Generisch: welches Feld welchen Treffer bekommt, entscheidet der Aufrufer.
    //
    // `action` ist Pflicht bei jedem Aufrufer, der nicht der Eigenbeleg ist, und der Grund
    // ist app.html: dort laufen BEIDE Router gleichzeitig — der eigene Namensraum eb-* aus
    // eigenbelege/js/app.js und die zentrale Registry aus js/actions.js. Ein gemeinsamer
    // Aktionsname wuerde beide ausloesen, und dann setzt der fremde Router denselben Wert
    // ein zweites Mal in ein Feld, das er gar nicht kennt.
    function chipHtml(zielId, anzeige, wert, roh, hinweis, action) {
        var hinweisHtml = hinweis
            ? '<span style="font-size:11px;color:var(--warning,#f59e0b)">' + esc(hinweis) + '</span>'
            : '';
        var rohHtml = roh
            ? '<span style="font-size:11px;color:var(--text-muted)">erkannt: „' + esc(roh) + '“</span>'
            : '';
        return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">'
             + '<button type="button" class="btn btn-secondary btn-sm" data-action="' + esc(action || 'beleg-ocr-uebernehmen') + '"'
             + ' data-ziel="' + esc(zielId) + '" data-wert="' + esc(String(wert)) + '"'
             + ' style="padding:3px 10px;font-size:12px">'
             + '<i class="ti ti-wand"></i> ' + esc(anzeige) + ' übernehmen</button>'
             + rohHtml + hinweisHtml + '</div>';
    }

    /**
     * Wert in ein Feld schreiben — und das input-Ereignis nachreichen.
     *
     * Ein per Code gesetzter Wert loest KEIN input-Ereignis aus; der Browser feuert das
     * nur bei Eingaben von Hand. Ohne dieses Ereignis merkt kein Dirty-Flag und kein
     * Rechen-Handler etwas davon — wer sein Formular ausschliesslich ueber die Chips
     * fuellt, bekaeme beim Wegklicken keine Warnung, und der Beleg waere weg.
     */
    function uebernehmen(zielId, wert) {
        var el = document.getElementById(zielId);
        if (!el) return null;
        el.value = wert;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        // Ein <select> hoert auf change, nicht auf input.
        if (el.tagName === 'SELECT') el.dispatchEvent(new Event('change', { bubbles: true }));
        el.focus();
        return el;
    }

    /** Fortschrittsanzeige in einen beliebigen Container. */
    function statusHtml(text, prozent) {
        if (!text) return '';
        var bar = (prozent === null || prozent === undefined) ? ''
            : '<div style="height:4px;background:var(--border);border-radius:2px;margin-top:6px;overflow:hidden">'
            + '<div style="height:100%;width:' + Math.round(prozent * 100) + '%;background:var(--accent);transition:width .2s"></div></div>';
        return '<span style="font-size:12px;color:var(--text-secondary)">' + esc(text) + '</span>' + bar;
    }

    return {
        lese: lese,
        ensureWorker: ensureWorker,
        hatSimd: hatSimd,
        pdfText: pdfText,
        pdfTextAusInhalt: pdfTextAusInhalt,
        chipHtml: chipHtml,
        uebernehmen: uebernehmen,
        statusHtml: statusHtml,
        STATUS_TEXT: STATUS_TEXT,
    };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BelegOcrUi;
