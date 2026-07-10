// ── Zentraler data-action-Router (CSP: keine Inline-Handler) ──────────────
// Module registrieren eine Whitelist-Map: Actions.register({ 'afa-save': fn, … })
// Markup: data-action="name" (click) bzw. data-action-input/-change/-submit/
// -key/-blur. Argumente als JSON-Array in data-args='["id",3]'.
// Aufruf: fn(...args, event, element) — `this` = Element.
// Bewusst KEIN Dotted-Path-Dispatch (window['X']['y']) — die explizite Map
// bleibt eine Whitelist, injiziertes Markup kann keine beliebigen Funktionen
// aufrufen. Namespaces eb-* / rech-* haben eigene Router (eigenbelege/js/app.js,
// rechnungen/js/*) und laufen an dieser Registry vorbei.
(function () {
    'use strict';
    var _map = Object.create(null);

    function _run(e, attr) {
        var t = e.target;
        if (!t || !t.closest) return;
        var el = t.closest('[' + attr + ']');
        if (!el) return;
        var name = el.getAttribute(attr);
        var fn = _map[name];
        if (!fn) return;
        // Steuerberater-Read-Only: Schreib-Aktionen am zentralen Chokepoint blocken
        // (Server erzwingt read-only hart; das hier ist die UX-Sperre). Nur echte
        // Mutations-Events (click/submit), damit Ansicht/Filter frei bleiben.
        if ((attr === 'data-action' || attr === 'data-action-submit') &&
            typeof window.StbShare !== 'undefined' && StbShare.blocks && StbShare.blocks(name)) {
            if (e.preventDefault) e.preventDefault();
            if (typeof Utils !== 'undefined' && Utils.showToast) Utils.showToast('Nur-Lese-Ansicht — Änderungen sind hier deaktiviert.', 'warning');
            return;
        }
        var args = [];
        var raw = el.getAttribute('data-args');
        if (raw) {
            try { args = JSON.parse(raw); } catch (err) { return; }
            if (!Array.isArray(args)) args = [args];
        }
        fn.apply(el, args.concat([e, el]));
    }

    document.addEventListener('click',    function (e) { _run(e, 'data-action'); });
    document.addEventListener('input',    function (e) { _run(e, 'data-action-input'); });
    document.addEventListener('change',   function (e) { _run(e, 'data-action-change'); });
    document.addEventListener('submit',   function (e) { _run(e, 'data-action-submit'); });
    document.addEventListener('keydown',  function (e) { _run(e, 'data-action-key'); });
    // onblur-Ersatz: blur bubbelt nicht, focusout schon
    document.addEventListener('focusout', function (e) { _run(e, 'data-action-blur'); });

    window.Actions = {
        register: function (map) {
            for (var k in map) _map[k] = map[k];
        }
    };

    // App-weite Allerwelts-Aktionen (Globals werden erst zur Klickzeit aufgelöst)
    Actions.register({
        'close-modal': function () { App.closeModal(); },
        'navigate':    function (page, e) { if (e && e.preventDefault) e.preventDefault(); App.navigate(page); },
        'reload':      function () { location.reload(); },
        'stop':        function (e) { e.stopPropagation(); },
        'goto':        function (url) { window.location.href = url; },
        'print-page':  function () { window.print(); }
    });
})();
