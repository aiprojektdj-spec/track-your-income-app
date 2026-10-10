// ============================================
// AppLoader — Login zuerst, Module danach (nur app.html)
//
// app.html laedt per defer nur den Kern (Vendor, Store, Whop-Auth, Utils). Die ~50 Modul-
// Skripte (2,5 MB) kommen erst hier dazu — und nur, wenn ueberhaupt eine Sitzung da ist.
//
// Ohne Token und ohne OAuth-Antwort (?code= / ?error=) endet boot() in whop-auth.js ohnehin
// sofort im Login-Screen. Den zeigen wir jetzt direkt, statt vorher alle Module zu parsen
// (Lighthouse mobil: LCP 8 s, 90 % davon Render-Delay). Der Login geht immer per Redirect
// zu Whop und zurueck, die Seite laedt danach also neu und nimmt dann den vollen Weg.
// Muss mit boot() in whop-auth.js uebereinstimmen (dort LS_TOKEN).
// ============================================
(function () {
    'use strict';

    // Reihenfolge = Ausfuehrungsreihenfolge (async=false), js/app.js braucht alle davor.
    var MODULES = [
        // Vendor nur fuer die Module (Utils prueft flatpickr erst beim Aufruf per typeof)
        'js/vendor/gsap.min.js',
        'js/vendor/flatpickr.min.js',
        'js/vendor/flatpickr-de.js',

        'js/dashboard.js',
        'js/buchungen.js',
        'js/lager.js',
        'js/datev.js',
        'js/bank-import.js',
        'js/steuerberater.js',
        'js/steuer-berechnung.js',
        'js/euer.js',
        'js/ausgaben.js',
        'js/statistiken.js',
        'js/protokoll.js',
        'js/retouren.js',
        'js/fahrtenbuch.js',
        'js/kassenbuch.js',
        'js/steuertermine.js',
        'js/afa.js',
        'js/privatbuchungen.js',
        'js/ustvoranmeldung.js',
        'js/ksk.js',
        'js/rechtsform.js',
        'js/vorsteuer.js',
        'js/oss.js',
        'js/koerperschaftsteuer.js',
        'js/bilanz.js',
        'js/gewerbesteuer.js',
        'js/lohnsteuer.js',
        'js/gbr.js',
        'js/gbr-modul.js',
        'js/materiallager.js',
        'js/akademie.js',

        // Rechnungen-Sub-App (eingebettet als Finanzen-Sub-Tab)
        'rechnungen/js/xrechnung.js',
        'rechnungen/js/erechnung-import.js',
        'rechnungen/js/rech-dashboard.js',
        'rechnungen/js/rechnung.js',
        'rechnungen/js/dokumente.js',
        'rechnungen/js/kunden.js',
        'rechnungen/js/produkte.js',
        'rechnungen/js/mahnungen.js',
        'rechnungen/js/protokoll.js',
        'rechnungen/js/unternehmensdaten.js',
        'rechnungen/js/wiederkehrend.js',
        'rechnungen/js/app.js',

        // Belegerkennung (Heuristik + Unterbau; tesseract kommt erst beim Klick) und ZIP-Schreiber
        'js/beleg-ocr.js',
        'js/beleg-ocr-ui.js',
        'js/zip.js',

        // Eigenbelege-Sub-App (eingebettet als Finanzen-Sub-Tab)
        'eigenbelege/js/app.js',

        'js/blob-attachments.js',
        'js/cloud-sync.js',
        'js/stb-share.js',
        'js/domain-umzug.js',

        // Einstieg zuletzt: startet sofort beim Ausfuehren (DOMContentLoaded ist vorbei),
        // frueher lief der Start erst nach allen Skripten — so bleibt die Reihenfolge gleich.
        'js/app.js?v=2',

        // Redesign: braucht das App-Objekt, muss also nach js/app.js laufen. js/app.js startet
        // deshalb erst, wenn der Loader fertig ist (AppLoader.ready) — wie frueher nach allen Skripten.
        'js/redesign-charts.js',
        'js/redesign-onboarding.js',
        'js/redesign-bookings.js',
        'js/redesign-settings.js',
        'js/redesign-shell.js',
        'js/redesign-ui.js'
    ];

    function hasSession() {
        var params = new URLSearchParams(location.search);
        if (params.has('code') || params.has('error')) return true;
        try { return !!localStorage.getItem('whop_access_token'); } catch (e) { return true; }
    }

    var markReady;
    var ready = new Promise(function (resolve) { markReady = resolve; });

    function loadModules() {
        MODULES.forEach(function (src, i) {
            var s = document.createElement('script');
            s.src = src;
            s.async = false;
            // async=false fuehrt in Listenreihenfolge aus: das letzte Skript ist zuletzt dran.
            if (i === MODULES.length - 1) s.onload = s.onerror = function () { markReady(); };
            document.body.appendChild(s);
        });
    }

    function start() {
        if (hasSession()) { loadModules(); return; }
        if (typeof AuthUI !== 'undefined' && AuthUI.boot) { AuthUI.boot(); return; }
        // whop-auth.js nicht geladen: voller Weg wie bisher (App._bootAfterLicense entscheidet).
        loadModules();
    }

    window.AppLoader = { MODULES: MODULES, ready: ready };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
