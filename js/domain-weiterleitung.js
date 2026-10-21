// ============================================
// DomainWeiterleitung — neue Geraete auf der alten Adresse sofort nach getstackr.de
//
// Laeuft synchron im <head> von app.html, also vor dem Whop-Login: Wer auf
// track-your-income-app.vercel.app landet und in diesem Browser noch keine Stackr-Daten
// hat, verliert durch die Weiterleitung nichts und muss sich nur einmal anmelden, direkt
// auf getstackr.de. Bestandskunden (Firma angelegt oder Cloud-Sync eingerichtet) bleiben
// hier und ziehen ueber den Banner aus js/domain-umzug.js um.
// "Ohne Daten" = keine Firma in oyi_companies, kein Cloud-Sync, kein Store-Spiegel
// (_oyi_lsmirror, falls das Firmenverzeichnis kaputt ist, die Daten aber noch da sind).
// Plan: plan/domain-umzug-getstackr-2026-10-08.md
// ============================================
var DomainWeiterleitung = (function () {
    'use strict';

    var ALT_HOST = 'track-your-income-app.vercel.app';
    var ZIEL = 'https://getstackr.de/app.html';

    // Im Zweifel (localStorage gesperrt, Wert unlesbar) gilt der Browser als Bestand: lieber
    // einmal zu wenig umleiten als einem Kunden eine leere App zeigen.
    function hatDaten(ls) {
        try {
            if (ls.getItem('oyi_sync_enabled') === '1') return true;
            if (ls.getItem('_oyi_lsmirror')) return true;
            var roh = ls.getItem('oyi_companies');
            if (!roh) return false;
            var firmen = JSON.parse(roh);
            return !Array.isArray(firmen) || firmen.length > 0;
        } catch (e) { return true; }
    }

    function sollUmleiten(host, ls) {
        return host === ALT_HOST && !hatDaten(ls);
    }

    function pruefen() {
        try {
            if (sollUmleiten(location.hostname, localStorage)) { location.replace(ZIEL); return true; }
        } catch (e) {}
        return false;
    }

    return { hatDaten: hatDaten, sollUmleiten: sollUmleiten, pruefen: pruefen, ZIEL: ZIEL };
})();
if (typeof window !== 'undefined' && typeof location !== 'undefined') DomainWeiterleitung.pruefen();
if (typeof module !== 'undefined' && module.exports) module.exports = DomainWeiterleitung;
