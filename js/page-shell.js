// Gemeinsame Seiten-Shell für app.html, lager/, rechnungen/, eigenbelege/
// (ehem. Inline-Scripts — ausgelagert für CSP script-src-elem 'self')

(function() {
    // ── GbR-Tab + Sidebar-Link: zeigen wenn GbR/eGbR aktiv ──
    try {
        var coId = localStorage.getItem('oyi_active_company') || '';
        var key  = (coId ? coId + '__' : '') + 'reselling_gbr_einstellungen';
        var gbr  = JSON.parse(localStorage.getItem(key) || '{}');
        if (gbr.firmenform === 'GbR' || gbr.firmenform === 'eGbR') {
            var tab = document.getElementById('toolTabGbr');
            if (tab) tab.style.display = '';
            var sidebarLink = document.getElementById('sidebarGbrLink');
            if (sidebarLink) sidebarLink.style.display = '';
        }
    } catch(e) {}
})();

(function() {
    // ── Aktiven Tool-Tab anhand ?page= markieren (greift nur in app.html) ──
    var page = new URLSearchParams(location.search).get('page');
    var tabIds = {
        euer: 'toolTabEuer', akademie: 'toolTabAkademie', gbr: 'toolTabGbr',
        // Finanzen-Modul: alle transaktionalen Seiten teilen sich einen Tab
        rechnungen: 'toolTabFinanzen', eigenbelege: 'toolTabFinanzen',
        buchungen: 'toolTabFinanzen', ausgaben: 'toolTabFinanzen', bankimport: 'toolTabFinanzen',
        fahrtenbuch: 'toolTabFinanzen', afa: 'toolTabFinanzen'
    };
    var tabId = tabIds[page];
    if (tabId) {
        var cur = document.querySelector('.topnav-apps .tool-tab.active');
        if (cur) cur.classList.remove('active');
        var el = document.getElementById(tabId);
        if (el) el.classList.add('active');
    }
})();

(function() {
    // ── Akademie: mobile Sidebar komplett ausblenden (öffnete leer/kaputt) ──
    if (new URLSearchParams(location.search).get('page') !== 'akademie') return;
    ['sidebar', 'sidebarToggleBtn', 'mobileOverlay'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
})();

(function() {
    // ── Sidebar-Toggle (mobil) ──
    var btn     = document.getElementById('sidebarToggleBtn');
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('mobileOverlay');
    if (!btn || !sidebar || !overlay) return;
    sidebar.classList.remove('collapsed'); // Legacy-Klasse aus altem localStorage

    function setState(open) {
        sidebar.classList.toggle('sidebar-open', open);
        btn.classList.toggle('sidebar-open', open);
        btn.textContent = open ? '‹' : '›';
        btn.title = open ? 'Navigation schließen' : 'Navigation öffnen';
        btn.setAttribute('aria-expanded', String(open));
        btn.setAttribute('aria-label', btn.title);
        overlay.classList.toggle('active', open);
    }
    btn.addEventListener('click', function() {
        setState(!sidebar.classList.contains('sidebar-open'));
    });
    overlay.addEventListener('click', function() { setState(false); });
    sidebar.querySelectorAll('.sidebar-link').forEach(function(link) {
        // Kleine Verzögerung, damit der Seitenwechsel flüssiger wirkt
        link.addEventListener('click', function() { setTimeout(function(){ setState(false); }, 150); });
    });
})();
