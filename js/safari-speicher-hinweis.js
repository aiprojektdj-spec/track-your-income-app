// ============================================
// SafariSpeicherHinweis — Warnung fuer Safari (macOS) und alle Browser auf iPhone/iPad
//
// WebKit loescht den Speicher einer Webseite (localStorage, IndexedDB), wenn sie 7 Tage
// Browser-Nutzung lang nicht geoeffnet wurde (Intelligent Tracking Prevention). Stackr haelt
// die Buchhaltung bis zum Server-Umzug (R5-R9) im Browser — ein Kunde, der eine Woche Pause
// macht, sieht danach eine leere App (Kundenfall 2026-11-09, Safari auf dem Mac).
//
// Zeigt deshalb einen Banner, solange Cloud-Sync nicht nachweislich laeuft
// (CloudSync.isHealthy(), dieselbe Grenze wie die Backup-Hinweise in app.js).
// Annahme: Banner erst, wenn eine Firma angelegt ist (vorher gibt es nichts zu verlieren).
// Annahme: Schliessen blendet ihn 14 Tage aus, dann kommt er wieder.
// Annahme: Kein Hinweis auf "Zum Dock / Home-Bildschirm hinzufuegen" — die Web-App dort hat
// einen eigenen, leeren Speicher; ohne Sync oder Backup waere das der naechste Datenverlust.
// ============================================
var SafariSpeicherHinweis = (function () {
    'use strict';

    var LS_VERSTECKT_BIS = 'stackr_safari_hinweis_bis';
    var PAUSE_MS = 14 * 86400000;

    // true fuer Safari auf dem Mac und jeden Browser auf iPhone/iPad (dort ist alles WebKit).
    function istWebKitMitLoeschfrist(ua, maxTouchPoints) {
        ua = String(ua || '');
        if (/iPhone|iPad|iPod/.test(ua)) return true;
        // iPadOS meldet sich als Mac, hat aber einen Touchscreen
        if (/Macintosh/.test(ua) && (maxTouchPoints || 0) > 1) return true;
        if (!/Macintosh/.test(ua) || !/Safari\//.test(ua)) return false;
        return !/Chrome|Chromium|Edg\/|OPR\/|Firefox|Vivaldi|Brave/.test(ua);
    }

    function sollZeigen(z) {
        if (!istWebKitMitLoeschfrist(z.ua, z.maxTouchPoints)) return false;
        if (z.standalone) return false;      // installierte Web-App: keine 7-Tage-Frist
        if (!z.hatFirma) return false;
        if (z.syncGesund) return false;
        return !(z.verstecktBis && z.jetzt < z.verstecktBis);
    }

    function _ls(k, v) {
        try {
            if (v === undefined) return localStorage.getItem(k);
            localStorage.setItem(k, v);
        } catch (e) {}
        return null;
    }

    function _hatFirma() {
        try {
            var f = JSON.parse(localStorage.getItem('oyi_companies') || '[]');
            return Array.isArray(f) && f.length > 0;
        } catch (e) { return false; }
    }

    function _standalone() {
        try {
            if (navigator.standalone) return true;
            return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
        } catch (e) { return false; }
    }

    function _zustand() {
        return {
            ua: navigator.userAgent,
            maxTouchPoints: navigator.maxTouchPoints,
            standalone: _standalone(),
            hatFirma: _hatFirma(),
            syncGesund: typeof CloudSync !== 'undefined' && CloudSync.isHealthy && CloudSync.isHealthy(),
            verstecktBis: parseInt(_ls(LS_VERSTECKT_BIS) || '0', 10),
            jetzt: Date.now()
        };
    }

    function _entfernen() {
        var el = document.getElementById('safariSpeicherHinweis');
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function _render() {
        if (document.getElementById('safariSpeicherHinweis')) return;
        var el = document.createElement('div');
        el.id = 'safariSpeicherHinweis';
        el.setAttribute('role', 'region');
        el.setAttribute('aria-label', 'Hinweis zum Speicher in Safari');
        el.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px 12px;' +
            'padding:10px 16px;border-bottom:1px solid var(--border,#333);background:var(--surface,#111);' +
            'color:var(--text,#eee);font-size:14px;line-height:1.5;';
        el.innerHTML =
            '<span><strong>Wichtig in Safari:</strong> Safari löscht die Daten von Webseiten, die du 7 Tage nicht öffnest – ' +
            'auch deine Buchhaltung in Stackr. Schalte Cloud-Sync ein oder lade regelmäßig ein Backup herunter.</span>' +
            '<button type="button" class="btn btn-primary btn-small" data-ssh="sync">Cloud-Sync einschalten</button>' +
            '<button type="button" class="btn btn-small" data-ssh="backup">Backup herunterladen</button>' +
            '<button type="button" class="btn btn-small" data-ssh="zu" aria-label="Hinweis für 14 Tage ausblenden" ' +
            'style="background:none;border:none;font-size:18px;line-height:1;padding:0 4px;">&times;</button>';
        el.querySelector('[data-ssh="sync"]').addEventListener('click', function () {
            if (typeof CloudSync !== 'undefined' && CloudSync.openPanel) CloudSync.openPanel();
        });
        el.querySelector('[data-ssh="backup"]').addEventListener('click', function () {
            if (typeof App !== 'undefined' && App.showBackupModal) App.showBackupModal();
        });
        el.querySelector('[data-ssh="zu"]').addEventListener('click', function () {
            _ls(LS_VERSTECKT_BIS, String(Date.now() + PAUSE_MS));
            _entfernen();
        });
        document.body.insertBefore(el, document.body.firstChild);
    }

    function pruefen() {
        try {
            if (sollZeigen(_zustand())) _render();
            else _entfernen();
        } catch (e) {}
    }

    function start() {
        // CloudSync.init() laeuft 1,5 s verzoegert; danach erst beurteilen, ob Sync gesund ist
        setTimeout(pruefen, 3000);
    }

    return { istWebKitMitLoeschfrist: istWebKitMitLoeschfrist, sollZeigen: sollZeigen, pruefen: pruefen, start: start };
})();
if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) SafariSpeicherHinweis.start();
if (typeof module !== 'undefined' && module.exports) module.exports = SafariSpeicherHinweis;
