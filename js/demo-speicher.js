// ============================================
// DemoSpeicher — nur demo.html, muss als ERSTES Skript laufen.
//
// Die Demo nutzt den echten App-Code. Damit sie nie an echte Buchhaltungsdaten kommt (wer auf
// derselben Domain angemeldet ist, hat sie in localStorage/IndexedDB liegen), ersetzt dieses
// Skript localStorage und sessionStorage durch einen reinen Arbeitsspeicher und blendet
// IndexedDB aus (Store faellt dann auf seinen Weg ohne IndexedDB zurueck). Reload = frischer Start.
// ============================================
(function () {
    'use strict';

    function MemoryStorage() {
        var daten = Object.create(null);
        var api = {
            getItem: function (k) { k = String(k); return k in daten ? daten[k] : null; },
            setItem: function (k, v) { daten[String(k)] = String(v); },
            removeItem: function (k) { delete daten[String(k)]; },
            clear: function () { daten = Object.create(null); },
            key: function (i) { var ks = Object.keys(daten); return i >= 0 && i < ks.length ? ks[i] : null; }
        };
        Object.defineProperty(api, 'length', { get: function () { return Object.keys(daten).length; }, configurable: true });
        // Manche Module iterieren per Object.keys(localStorage) bzw. for...in: Proxy liefert die
        // gespeicherten Schluessel wie beim echten Storage, die Methoden bleiben erreichbar.
        return new Proxy(api, {
            get: function (t, p) { return p in t ? t[p] : (typeof p === 'string' && p in daten ? daten[p] : undefined); },
            set: function (t, p, v) { if (p in t) return false; daten[p] = String(v); return true; },
            has: function (t, p) { return p in t || p in daten; },
            deleteProperty: function (t, p) { delete daten[p]; return true; },
            ownKeys: function () { return Object.keys(daten); },
            getOwnPropertyDescriptor: function (t, p) {
                return p in daten ? { value: daten[p], writable: true, enumerable: true, configurable: true } : undefined;
            }
        });
    }

    function ersetze(name, wert) {
        try {
            Object.defineProperty(window, name, { value: wert, configurable: false, writable: false });
        } catch (e) { /* unten geprueft */ }
        // Ohne Ersatz darf die Demo nicht laufen, sonst arbeitet sie auf echten Daten.
        if (window[name] !== wert) window.__demoSpeicherFehlt = true;
    }

    ersetze('localStorage', MemoryStorage());
    ersetze('sessionStorage', MemoryStorage());
    ersetze('indexedDB', undefined);
    if (window.__demoSpeicherFehlt) {
        // Harte Bremse: nichts weiter laden.
        document.documentElement.innerHTML = '<body style="font:16px sans-serif;padding:24px">Die Demo läuft in diesem Browser nicht.</body>';
        if (window.stop) window.stop();
        throw new Error('DemoSpeicher: Speicher konnte nicht isoliert werden');
    }
    window.__demoSpeicherAktiv = true;
})();
