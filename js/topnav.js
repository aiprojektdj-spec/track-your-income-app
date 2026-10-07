// Kompatibilitäts-Einstieg: Die gemeinsame Navigation lebt in redesign-shell.js.
// Die Container-ID bleibt für bestehende Fachmodule und Standalone-Seiten erhalten.
(function () {
    'use strict';
    window.Topnav = {
        render: function (opts) {
            var el = document.getElementById((opts && opts.containerId) || 'topnavApps');
            if (!el) return;
            el.hidden = true;
            el.innerHTML = '';
            if (window.RedesignShell) window.RedesignShell.refresh();
        }
    };
    if (document.getElementById('topnavApps')) Topnav.render();
    else document.addEventListener('DOMContentLoaded', function () { Topnav.render(); });
})();
