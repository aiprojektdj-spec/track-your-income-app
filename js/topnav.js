// ============================================
// Topnav — zentrale App-Navigation (EINE Quelle für alle Seiten)
// Verhindert Nav-Drift zwischen app.html und Unterseiten
// (Rechnungen / Eigenbelege / Lager).
//
// Verwendung pro Seite:
//   <div class="topnav-apps" id="topnavApps" data-active="dashboard"></div>
//   <script src="<pfad>/js/topnav.js"></script>   (NICHT defer, direkt nach dem Container)
//
// data-active: dashboard | rechnungen | eigenbelege | lager | euer | akademie | gbr | schweiz | oesterreich
//
// IDs bleiben identisch zu app.html (toolTabEuer/toolTabSchweiz/...),
// damit app.js die Tabs auf app.html weiterhin dynamisch steuern kann.
// ============================================
(function () {
    'use strict';

    var PERSONENGES = ['GbR', 'eGbR', 'OHG', 'KG', 'GmbH & Co. KG'];

    // Aktive Firma → land + firmenform. Liest localStorage direkt,
    // damit Unterseiten ohne app.js/Store funktionieren.
    function _activeCompanyMeta() {
        var land = 'DE', firmenform = 'Einzelunternehmen';
        try {
            var coId = localStorage.getItem('oyi_active_company') || '';
            var cos  = JSON.parse(localStorage.getItem('oyi_companies') || '[]');
            var co   = cos.find(function (c) { return c.id === coId; }) || cos[0];
            if (co && co.land) land = co.land;
            var gbrKey = (coId ? coId + '__' : '') + 'reselling_gbr_einstellungen';
            var gbr = JSON.parse(localStorage.getItem(gbrKey) || '{}');
            if (gbr.firmenform) firmenform = gbr.firmenform;
        } catch (e) {}
        return { land: land, firmenform: firmenform };
    }

    function _tab(prefix, active, o) {
        var cls   = 'tool-tab' + (o.key === active ? ' active' : '');
        var id    = o.id    ? ' id="' + o.id + '"' : '';
        var hide  = o.hidden ? ' style="display:none;"' : '';
        var i18n  = o.i18n  ? ' data-i18n="' + o.i18n + '"' : '';
        return '<a href="' + prefix + o.href + '" class="' + cls + '"' + id + hide +
               ' title="' + o.title + '"><i class="ti ' + o.icon + ' tab-icon"></i> ' +
               '<span' + i18n + '>' + o.label + '</span></a>';
    }

    function _html(prefix, active) {
        var t = [
            { key:'dashboard',   href:'app.html',                  icon:'ti-layout-dashboard', label:'Dashboard',   title:'Dashboard',                       i18n:'nav.dashboard' },
            { key:'finanzen',    href:'app.html?page=buchungen',   icon:'ti-wallet',           label:'Finanzen',    title:'Finanzen — Rechnungen, Eigenbelege, Buchungen, Ausgaben, Bank, Fahrten, AfA', id:'toolTabFinanzen', i18n:'nav.finance' },
            { key:'lager',       href:'lager/index.html',          icon:'ti-package',          label:'Lager',       title:'Lager / Inventory',  id:'toolTabLager',    i18n:'nav.inventory' },
            { key:'euer',        href:'app.html?page=euer',        icon:'ti-chart-bar',        label:'EÜR',         title:'EÜR / P&L',          id:'toolTabEuer',     i18n:'nav.euer' },
            { key:'akademie',    href:'app.html?page=akademie',    icon:'ti-school',           label:'Akademie',    title:'Akademie / Academy', id:'toolTabAkademie', i18n:'nav.academy' },
            { key:'gbr',         href:'app.html?page=gbr',         icon:'ti-users',            label:'GbR',         title:'GbR',                id:'toolTabGbr',       i18n:'nav.gbr', hidden:true },
            { key:'schweiz',     href:'app.html?page=schweiz',     icon:'ti-flag-3',           label:'Schweiz',     title:'Schweiz – EAR/MWST/AHV',          id:'toolTabSchweiz',     hidden:true },
            { key:'oesterreich', href:'app.html?page=oesterreich', icon:'ti-flag-3',           label:'Österreich',  title:'Österreich – EAR/USt/GSVG/ESt',   id:'toolTabOesterreich', hidden:true }
        ];
        var html = '';
        for (var i = 0; i < t.length; i++) html += _tab(prefix, active, t[i]);
        return html;
    }

    function _applyVisibility(root, meta) {
        var isCH = meta.land === 'CH', isAT = meta.land === 'AT';
        function set(id, show) { var el = root.querySelector('#' + id); if (el) el.style.display = show ? '' : 'none'; }
        set('toolTabEuer',        !isCH && !isAT);
        set('toolTabSchweiz',     isCH);
        set('toolTabOesterreich', isAT);
        set('toolTabGbr',         PERSONENGES.indexOf(meta.firmenform) !== -1);
    }

    window.Topnav = {
        render: function (opts) {
            opts = opts || {};
            var container = document.getElementById(opts.containerId || 'topnavApps');
            if (!container) return;
            var active = opts.active != null ? opts.active : (container.getAttribute('data-active') || '');
            var prefix = opts.prefix != null ? opts.prefix : container.getAttribute('data-prefix');
            if (prefix == null) {
                // Robust gegen Clean-URLs (/rechnungen), Trailing-Slash (/rechnungen/)
                // und /rechnungen/index.html: prüfe Pfadsegmente statt fixem Slash-Muster.
                var segs = location.pathname.split('/');
                var inSub = false;
                for (var s = 0; s < segs.length; s++) {
                    if (segs[s] === 'rechnungen' || segs[s] === 'eigenbelege' || segs[s] === 'lager') { inSub = true; break; }
                }
                prefix = inSub ? '../' : '';
            }
            container.innerHTML = _html(prefix, active);
            _applyVisibility(container, _activeCompanyMeta());
        }
    };

    // Auto-Init: sofort wenn Container schon geparst ist (Script direkt dahinter),
    // sonst auf DOMContentLoaded warten.
    function _auto() { if (document.getElementById('topnavApps')) window.Topnav.render(); }
    if (document.getElementById('topnavApps')) _auto();
    else document.addEventListener('DOMContentLoaded', _auto);
})();
