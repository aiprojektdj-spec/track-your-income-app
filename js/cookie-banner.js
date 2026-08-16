// ============================================
// CookieBanner — Einwilligung nach §25 TDDDG / Art. 6 Abs. 1 lit. a DSGVO
//
// Zwei Stufen:
//   'necessary' → nur technisch notwendige lokale Speicherung (einwilligungsfrei,
//                 §25 Abs. 2 Nr. 2 TDDDG). Keine Reichweitenmessung.
//   'all'       → zusaetzlich Vercel Web Analytics, erst dann wird das Skript geladen.
//
// Der Analytics-Loader laeuft VOR dem Early-Return, sonst wuerde ein bereits
// erteiltes 'all' auf Folgeseiten nicht mehr greifen.
// Schluessel ist bewusst _v2: die v1-Frage ("Verstanden") hat nie nach
// Reichweitenmessung gefragt, eine Einwilligung laesst sich daraus nicht ableiten.
// ============================================
(function () {
    'use strict';

    var STORAGE_KEY = 'oyi_cookie_consent_v2';

    function loadAnalytics() {
        if (document.getElementById('vercelInsights')) return;
        var s = document.createElement('script');
        s.id    = 'vercelInsights';
        s.defer = true;
        s.src   = '/_vercel/insights/script.js';
        document.head.appendChild(s);
    }

    var consent = null;
    try { consent = localStorage.getItem(STORAGE_KEY); } catch (e) {}

    if (consent === 'all') loadAnalytics();

    function accept(level) {
        try { localStorage.setItem(STORAGE_KEY, level); } catch (e) {}
        if (level === 'all') loadAnalytics();
        var banner = document.getElementById('cookieBanner');
        if (banner) {
            banner.style.transition = 'transform .3s ease, opacity .3s ease';
            banner.style.opacity    = '0';
            banner.style.transform  = 'translateY(16px)';
            setTimeout(function () { banner.remove(); }, 320);
        }
    }

    function inject() {
        // Styles liegen in css/cookie-banner.css — ein hier injizierter <style>-Block
        // wuerde von der CSP blockiert (style-src-elem 'self', kein unsafe-inline).

        // Banner-HTML. Link absolut: das Banner laeuft auch in /lager/, /rechnungen/
        // und /eigenbelege/ — relativ zeigte er dort ins Leere.
        var banner = document.createElement('div');
        banner.id = 'cookieBanner';
        banner.innerHTML =
            '<div class="cb-text">' +
                '<strong>Datenschutz-Hinweis</strong><br>' +
                'Für Anmeldung und Betrieb speichert Stackr technisch notwendige Daten lokal in deinem ' +
                'Browser (localStorage/IndexedDB). Das ist einwilligungsfrei und lässt sich nicht abwählen. ' +
                'Zusätzlich möchten wir die Nutzung anonym und cookiefrei messen (Vercel Web Analytics) — ' +
                'dafür brauchen wir deine Einwilligung. Keine Werbung, keine Weitergabe zu Werbezwecken. ' +
                'Mehr in unserer <a href="/datenschutz.html">Datenschutzerklärung</a>.' +
            '</div>' +
            '<div class="cb-actions">' +
                '<button class="cb-btn-min" data-action="cb-necessary">Nur notwendige</button>' +
                '<button class="cb-btn-all" data-action="cb-accept">Statistik erlauben ✓</button>' +
            '</div>';

        document.body.appendChild(banner);
    }

    // Banner nur zeigen, wenn noch nichts entschieden ist. Die oeffentliche API
    // unten wird trotzdem immer definiert — sonst haette der Widerrufs-Button in
    // cookies.html kein CookieBanner-Objekt, genau dann, wenn er gebraucht wird.
    if (!consent) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', inject);
        } else {
            inject();
        }
    }

    // Öffentliche API
    window.CookieBanner = {
        acceptAll:       function () { accept('all'); },
        acceptNecessary: function () { accept('necessary'); },
        getConsent:      function () { try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; } },
        reset:           function () { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} location.reload(); }
    };
})();

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'cb-accept':    function () { CookieBanner.acceptAll(); },
    'cb-necessary': function () { CookieBanner.acceptNecessary(); },
    // Widerruf nach Art. 7 Abs. 3 DSGVO — Button liegt in cookies.html
    'cb-reset':     function () { CookieBanner.reset(); }
});
