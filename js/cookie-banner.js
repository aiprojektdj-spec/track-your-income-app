// ============================================
// CookieBanner — DSGVO-konformer Cookie-Hinweis
// Speichert Entscheidung in localStorage
// ============================================
(function () {
    'use strict';

    var STORAGE_KEY = 'oyi_cookie_consent';

    // Bereits entschieden? → nichts anzeigen
    if (localStorage.getItem(STORAGE_KEY)) return;

    function accept(level) {
        localStorage.setItem(STORAGE_KEY, level);
        var banner = document.getElementById('cookieBanner');
        if (banner) {
            banner.style.transition = 'transform .3s ease, opacity .3s ease';
            banner.style.opacity    = '0';
            banner.style.transform  = 'translateY(16px)';
            setTimeout(function () { banner.remove(); }, 320);
        }
    }

    function inject() {
        // Styles
        var style = document.createElement('style');
        style.textContent = `
#cookieBanner {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9000;
    background: #161a18;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 14px;
    padding: 18px 22px;
    display: flex;
    align-items: center;
    gap: 18px;
    flex-wrap: wrap;
    max-width: 820px;
    width: calc(100% - 32px);
    box-shadow: 0 8px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(16,185,129,.08);
    animation: cookieSlideUp .35s ease;
}
@keyframes cookieSlideUp {
    from { opacity:0; transform:translateX(-50%) translateY(20px); }
    to   { opacity:1; transform:translateX(-50%) translateY(0); }
}
#cookieBanner .cb-text {
    flex: 1;
    min-width: 220px;
    font-size: 13px;
    color: #9ba8a1;
    line-height: 1.55;
}
#cookieBanner .cb-text strong { color: #eef2f0; }
#cookieBanner .cb-text a { color: #34d399; text-decoration: none; }
#cookieBanner .cb-text a:hover { text-decoration: underline; }
#cookieBanner .cb-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
}
#cookieBanner .cb-btn-all {
    background: linear-gradient(135deg, #10b981, #0da271);
    color: #fff;
    border: none;
    padding: 9px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    transition: opacity .15s;
}
#cookieBanner .cb-btn-all:hover { opacity: .88; }
#cookieBanner .cb-btn-min {
    background: rgba(255,255,255,.05);
    color: #9ba8a1;
    border: 1px solid rgba(255,255,255,.1);
    padding: 9px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    white-space: nowrap;
    transition: background .15s;
}
#cookieBanner .cb-btn-min:hover { background: rgba(255,255,255,.09); color: #eef2f0; }
@media (max-width: 520px) {
    #cookieBanner { flex-direction: column; gap: 12px; }
    #cookieBanner .cb-actions { width: 100%; }
    #cookieBanner .cb-btn-all,
    #cookieBanner .cb-btn-min { flex: 1; text-align: center; }
}
        `;
        document.head.appendChild(style);

        // Banner-HTML
        var banner = document.createElement('div');
        banner.id = 'cookieBanner';
        banner.innerHTML =
            '<div class="cb-text">' +
                '<strong>Cookie-Hinweis</strong><br>' +
                'Diese App verwendet ausschließlich technisch notwendige Cookies für Anmeldung und Session-Verwaltung. ' +
                'Keine Tracking- oder Werbe-Cookies. ' +
                'Mehr in unserer <a href="datenschutz.html">Datenschutzerklärung</a>.' +
            '</div>' +
            '<div class="cb-actions">' +
                '<button class="cb-btn-all" onclick="CookieBanner.acceptNecessary()">Verstanden ✓</button>' +
            '</div>';

        // Nach kurzem Delay anzeigen (Seitenaufbau abwarten)
        document.body.appendChild(banner);
    }

    // Auf DOM-Bereitschaft warten
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject);
    } else {
        inject();
    }

    // Öffentliche API
    window.CookieBanner = {
        acceptAll:       function () { accept('all'); },
        acceptNecessary: function () { accept('necessary'); },
        getConsent:      function () { return localStorage.getItem(STORAGE_KEY); },
        reset:           function () { localStorage.removeItem(STORAGE_KEY); location.reload(); }
    };
})();
