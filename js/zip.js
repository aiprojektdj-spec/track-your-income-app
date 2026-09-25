// ============================================================
// ZIP-Schreiber — Store-Modus, ohne Bibliothek
//
// Warum das hier steht und nicht aus npm kommt: Regel 6 der CLAUDE.md (keine neue
// Abhaengigkeit ohne Rueckfrage). Ein ZIP ohne Komprimierung ist pro Datei ein
// Local-File-Header, die Rohdaten und ein Eintrag im Central Directory; die einzige
// Rechnung darin ist CRC-32. Das sind die paar Dutzend Zeilen unten — eine Bibliothek
// dafuer waere die teurere Loesung.
//
// Store statt Deflate ist Absicht und kein Provisorium:
//   • Was hier hineingeht, ist fast immer schon komprimiert — JPEG-Belegfotos und PDFs.
//     Deflate darauf gewinnt nichts und kostet Rechenzeit im Haupt-Thread.
//   • Die CSV-Dateien des Z3-Exports sind klein.
//   • CompressionStream('deflate-raw') waere der Weg, wenn es doch einmal noetig wird.
//     Dann aber als eigene Methode, damit der synchrone Pfad hier synchron bleibt.
//
// Bewusst OHNE Browser-Bezug: kein DOM, kein Blob, kein Download. Rueckgabe ist ein
// Uint8Array. Den Download macht Utils.downloadFile(). Derselbe Grund wie bei
// js/beleg-ocr.js und js/bank-import.js — was sich ohne Browser pruefen laesst, wird
// ohne Browser geprueft.
//   Test: node test/test-zip.js
// ============================================================

var StackrZip = (function () {
    'use strict';

    // ── CRC-32 (IEEE 802.3, wie ZIP ihn verlangt) ────────────────────────────
    // Tabelle wird beim ersten Aufruf gebaut, nicht beim Laden der Datei: die meisten
    // Seitenaufrufe erzeugen nie ein ZIP.
    var _crcTable = null;
    function _ensureCrcTable() {
        if (_crcTable) return _crcTable;
        _crcTable = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            _crcTable[n] = c >>> 0;
        }
        return _crcTable;
    }
    function crc32(bytes) {
        var t = _ensureCrcTable(), c = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    // ── MS-DOS-Zeitstempel ───────────────────────────────────────────────────
    // ZIP speichert die Uhrzeit im Format von 1980: Sekunden in Zweierschritten, Jahr
    // als Offset auf 1980. Alles vor 1980 waere nicht darstellbar — wir klemmen darauf,
    // statt einen negativen Wert zu schreiben, der jeden Entpacker verwirrt.
    function _dosDateTime(d) {
        var jahr = d.getFullYear();
        if (jahr < 1980) return { zeit: 0, datum: 33 }; // 01.01.1980, 00:00
        return {
            zeit: ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF,
            datum: (((jahr - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF
        };
    }

    // ── Bytes ────────────────────────────────────────────────────────────────
    function _utf8(str) {
        // TextEncoder gibt es im Browser seit Ewigkeiten und in Node seit v11. Der
        // Rueckfall existiert nur fuer den vm-Sandkasten der Tests, falls er ohne
        // Globals gestartet wird.
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
        var out = [], s = unescape(encodeURIComponent(String(str)));
        for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xFF);
        return new Uint8Array(out);
    }
    function _toBytes(data) {
        if (data == null) return new Uint8Array(0);
        if (data instanceof Uint8Array) return data;
        if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) return new Uint8Array(data);
        if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        return _utf8(String(data));
    }

    // Pfadtrenner im ZIP ist IMMER der Schraegstrich, auch wenn die Datei unter Windows
    // entsteht (APPNOTE 4.4.17.1). Ein Backslash im Namen ergibt beim Entpacken unter
    // Linux/macOS eine Datei mit Backslash im Namen statt eines Unterordners.
    // Fuehrende Schraegstriche und ".." fliegen raus: ein ZIP mit absoluten oder
    // aufsteigenden Pfaden ist ein Zip-Slip und wird von guten Entpackern abgewiesen.
    function _saeuberePfad(name) {
        var p = String(name == null ? '' : name).replace(/\\/g, '/');
        p = p.replace(/^\/+/, '');
        p = p.split('/').filter(function (teil) {
            return teil !== '' && teil !== '.' && teil !== '..';
        }).join('/');
        return p;
    }

    // Gleiche Namen zweimal im Archiv sind erlaubt, aber kein Entpacker macht daraus
    // etwas Sinnvolles — die zweite Datei ueberschreibt die erste oder wird verworfen.
    // Beim DATEV-Belegexport passiert das schnell: zwei Belege desselben Tages mit
    // derselben Belegnummer. Deshalb: zaehlender Zusatz vor der Endung.
    function _eindeutig(name, vergeben) {
        if (!vergeben[name]) { vergeben[name] = true; return name; }
        var punkt = name.lastIndexOf('.');
        var stamm = punkt > 0 ? name.slice(0, punkt) : name;
        var endung = punkt > 0 ? name.slice(punkt) : '';
        var n = 2, kandidat;
        do { kandidat = stamm + '_' + n + endung; n++; } while (vergeben[kandidat]);
        vergeben[kandidat] = true;
        return kandidat;
    }

    /**
     * Baut ein ZIP-Archiv im Store-Modus.
     *
     * @param {Array<{name: string, data: (Uint8Array|ArrayBuffer|string), datum?: Date}>} dateien
     * @returns {Uint8Array}
     *
     * Wirft, statt ein kaputtes Archiv zurueckzugeben, wenn die Grenzen des klassischen
     * ZIP-Formats gerissen werden (ZIP64 kann dieser Schreiber nicht). Ein Archiv, das
     * sich nicht oeffnen laesst, ist im Steuerkontext schlimmer als eine Fehlermeldung:
     * es faellt erst beim Pruefer auf.
     */
    function build(dateien) {
        var liste = (dateien || []).filter(function (f) { return f && f.name; });
        if (liste.length > 0xFFFF) {
            throw new Error('ZIP: mehr als 65.535 Dateien — dafuer braeuchte es ZIP64.');
        }

        var jetzt = new Date();
        var vergeben = {};
        var eintraege = [];   // fuer das Central Directory
        var teile = [];       // Local Headers + Daten, in Reihenfolge
        var offset = 0;

        for (var i = 0; i < liste.length; i++) {
            var f = liste[i];
            var pfad = _saeuberePfad(f.name);
            if (!pfad) continue;               // Name bestand nur aus Trennern
            pfad = _eindeutig(pfad, vergeben);

            var daten = _toBytes(f.data);
            var nameBytes = _utf8(pfad);
            var dt = _dosDateTime(f.datum instanceof Date ? f.datum : jetzt);
            var crc = crc32(daten);

            var lokal = new Uint8Array(30 + nameBytes.length);
            var lv = new DataView(lokal.buffer);
            lv.setUint32(0, 0x04034B50, true);        // Signatur
            lv.setUint16(4, 20, true);                // benoetigte Version (2.0)
            lv.setUint16(6, 0x0800, true);            // Bit 11: Name ist UTF-8
            lv.setUint16(8, 0, true);                 // Methode 0 = store
            lv.setUint16(10, dt.zeit, true);
            lv.setUint16(12, dt.datum, true);
            lv.setUint32(14, crc, true);
            lv.setUint32(18, daten.length, true);     // komprimierte Groesse = Rohgroesse
            lv.setUint32(22, daten.length, true);
            lv.setUint16(26, nameBytes.length, true);
            lv.setUint16(28, 0, true);                // kein Extra-Feld
            lokal.set(nameBytes, 30);

            eintraege.push({ pfad: nameBytes, crc: crc, groesse: daten.length, dt: dt, offset: offset });
            teile.push(lokal, daten);
            offset += lokal.length + daten.length;

            if (offset > 0xFFFFFFFF) {
                throw new Error('ZIP: Archiv groesser als 4 GB — dafuer braeuchte es ZIP64.');
            }
        }

        // ── Central Directory ────────────────────────────────────────────────
        var cdStart = offset, cdLaenge = 0;
        for (var j = 0; j < eintraege.length; j++) {
            var e = eintraege[j];
            var zentral = new Uint8Array(46 + e.pfad.length);
            var zv = new DataView(zentral.buffer);
            zv.setUint32(0, 0x02014B50, true);        // Signatur
            zv.setUint16(4, 20, true);                // erzeugt von Version 2.0
            zv.setUint16(6, 20, true);                // benoetigte Version
            zv.setUint16(8, 0x0800, true);            // UTF-8
            zv.setUint16(10, 0, true);                // store
            zv.setUint16(12, e.dt.zeit, true);
            zv.setUint16(14, e.dt.datum, true);
            zv.setUint32(16, e.crc, true);
            zv.setUint32(20, e.groesse, true);
            zv.setUint32(24, e.groesse, true);
            zv.setUint16(28, e.pfad.length, true);
            zv.setUint16(30, 0, true);                // Extra
            zv.setUint16(32, 0, true);                // Kommentar
            zv.setUint16(34, 0, true);                // Datentraeger
            zv.setUint16(36, 0, true);                // interne Attribute
            zv.setUint32(38, 0, true);                // externe Attribute
            zv.setUint32(42, e.offset, true);         // Offset des Local Headers
            zentral.set(e.pfad, 46);
            teile.push(zentral);
            cdLaenge += zentral.length;
        }

        // ── End of Central Directory ─────────────────────────────────────────
        var eocd = new Uint8Array(22);
        var ev = new DataView(eocd.buffer);
        ev.setUint32(0, 0x06054B50, true);
        ev.setUint16(4, 0, true);                     // Datentraegernummer
        ev.setUint16(6, 0, true);                     // Datentraeger mit dem CD
        ev.setUint16(8, eintraege.length, true);
        ev.setUint16(10, eintraege.length, true);
        ev.setUint32(12, cdLaenge, true);
        ev.setUint32(16, cdStart, true);
        ev.setUint16(20, 0, true);                    // kein Archivkommentar
        teile.push(eocd);

        // ── Zusammensetzen ───────────────────────────────────────────────────
        var gesamt = 0;
        for (var k = 0; k < teile.length; k++) gesamt += teile[k].length;
        var out = new Uint8Array(gesamt), pos = 0;
        for (var m = 0; m < teile.length; m++) { out.set(teile[m], pos); pos += teile[m].length; }
        return out;
    }

    /**
     * Data-URL (oder Blob-URL) eines Belegfotos in Bytes umrechnen.
     *
     * Belegfotos liegen in Stackr als Data-URL im Datensatz. Fuer das Archiv brauchen wir
     * die Rohbytes und die richtige Endung — ein "beleg.jpg", das in Wahrheit ein PNG ist,
     * oeffnet der Pruefer nicht doppelt klickend.
     *
     * @returns {{bytes: Uint8Array, endung: string}|null}
     */
    function ausDataUrl(dataUrl) {
        var s = String(dataUrl || '');
        var m = s.match(/^data:([^;,]*)(;base64)?,(.*)$/);
        if (!m) return null;
        var typ = (m[1] || '').toLowerCase();
        var endung = typ === 'image/png' ? '.png'
                   : typ === 'image/gif' ? '.gif'
                   : typ === 'image/webp' ? '.webp'
                   : typ === 'application/pdf' ? '.pdf'
                   : typ === 'image/svg+xml' ? '.svg'
                   : '.jpg';
        var bytes;
        try {
            if (m[2]) {
                var bin = typeof atob === 'function'
                    ? atob(m[3])
                    : Buffer.from(m[3], 'base64').toString('binary');
                bytes = new Uint8Array(bin.length);
                for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xFF;
            } else {
                bytes = _utf8(decodeURIComponent(m[3]));
            }
        } catch (e) { return null; }
        return { bytes: bytes, endung: endung };
    }

    return { build: build, crc32: crc32, ausDataUrl: ausDataUrl, _saeuberePfad: _saeuberePfad };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = StackrZip;
