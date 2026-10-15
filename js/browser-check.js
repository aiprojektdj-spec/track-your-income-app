// Stackr — Hinweis für zu alte Browser
// =============================================================================
// Anlass: Tageszusammenfassung vom 2026-10-10 (ops_alerts) — ein Aufruf mit einem Browser
// ohne Optional Chaining, zehnmal "Uncaught SyntaxError: Unexpected token ." in js/*.js.
// Die App lief für diese Person gar nicht, ohne dass sie erfuhr, warum.
//
// js/es-probe.js setzt window.__stackrEs2020, wenn der Browser `?.`/`??` versteht. Fehlt die
// Marke, legt diese Datei einen Hinweis über die Seite. Kein Übersetzen des App-Codes: kein
// Build-Schritt (plan/02-ENTSCHEIDUNGEN.md).
//
// Diese Datei selbst ist ES5 — sie muss gerade in den alten Browsern laufen.
// test/test-browser-check.js prüft das.
// =============================================================================
(function () {
    'use strict';

    function hinweis() {
        if (window.__stackrEs2020 === true) return;
        if (document.getElementById('stackrBrowserAlt')) return;

        var box = document.createElement('div');
        box.id = 'stackrBrowserAlt';
        box.setAttribute('role', 'alert');
        var s = box.style;
        s.position = 'fixed'; s.top = '0'; s.left = '0'; s.right = '0'; s.bottom = '0';
        s.zIndex = '2147483647'; s.background = '#111111'; s.color = '#eeeeee';
        s.display = 'flex'; s.alignItems = 'center'; s.justifyContent = 'center';
        s.padding = '24px'; s.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';

        var inner = document.createElement('div');
        inner.style.maxWidth = '480px';
        inner.style.lineHeight = '1.5';

        var h = document.createElement('h1');
        h.style.fontSize = '22px';
        h.style.margin = '0 0 12px';
        h.appendChild(document.createTextNode('Dein Browser ist zu alt für Stackr'));

        var p = document.createElement('p');
        p.style.margin = '0';
        p.appendChild(document.createTextNode(
            'Stackr braucht einen aktuellen Browser, zum Beispiel Chrome, Edge oder Firefox in einer ' +
            'Version ab 2020 oder Safari ab 13.1 (iPhone/iPad ab iOS 13.4). Bitte aktualisiere deinen Browser oder ' +
            'öffne Stackr auf einem anderen Gerät. Deine Daten bleiben dabei unberührt.'));

        inner.appendChild(h);
        inner.appendChild(p);
        box.appendChild(inner);
        document.body.appendChild(box);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hinweis);
    else hinweis();
})();
