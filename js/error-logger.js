/**
 * error-logger.js — Stackr Error Monitoring
 * Captures JS errors + unhandled promise rejections.
 * Stores in localStorage (max 50 entries) for debugging.
 * Zusätzlich: bereinigte Kurzfassung per sendBeacon an /api/client-error
 * (plan/betrieb-luecken-2026-09-29.md §4) — nur im Web-Build über https,
 * jeder Fehler höchstens 1× pro Sitzung, höchstens 10 pro Sitzung.
 * Gesendet werden nur Art, Meldung, Dateipfad, Zeile/Spalte und Version —
 * kein Stack, keine Seiten-URL, kein User-Agent.
 */
(function() {
    'use strict';

    var LS_KEY   = 'stackr_error_log';
    var MAX_LOGS = 50;
    var APP_VER  = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '1.7';

    function _store(entry) {
        try {
            var logs = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
            logs.unshift(entry);
            if (logs.length > MAX_LOGS) logs = logs.slice(0, MAX_LOGS);
            localStorage.setItem(LS_KEY, JSON.stringify(logs));
        } catch(e) { /* localStorage full or private mode — silently skip */ }
    }

    var SENT_KEY  = 'stackr_error_sent';
    var MAX_SENDS = 10;
    var _sentMem  = {};

    // Pro Sitzung (Tab) gemerkt, damit ein Fehler in einer Schleife oder auf jeder
    // Unterseite (lager/rechnungen) nicht jedes Mal erneut gemeldet wird.
    function _sentSet() {
        try { return JSON.parse(sessionStorage.getItem(SENT_KEY) || '{}'); } catch(e) { return _sentMem; }
    }
    function _sentSave(set) {
        _sentMem = set;
        try { sessionStorage.setItem(SENT_KEY, JSON.stringify(set)); } catch(e) {}
    }

    // Nur der Pfad: keine Query (?v=…), kein Host.
    function _path(src) {
        if (!src) return '';   // sonst lieferte new URL('', href) den Seitenpfad
        try { return new URL(src, location.href).pathname; } catch(e) { return ''; }
    }

    function _send(entry) {
        console.warn('[Stackr Error]', entry.type, entry.message, entry.source);

        // Nur der Web-Build über https meldet — nicht die Local-Version (file:),
        // nicht der lokale Dev-Server (http://localhost).
        if (location.protocol !== 'https:' || !navigator.sendBeacon) return;

        var src = _path(entry.source);
        var key = entry.type + '|' + entry.message + '|' + src + '|' + entry.line;
        var set = _sentSet();
        if (set[key] || Object.keys(set).length >= MAX_SENDS) return;
        set[key] = 1;
        _sentSave(set);

        try {
            var body = JSON.stringify({
                type: entry.type, message: entry.message, source: src,
                line: entry.line, col: entry.col, v: entry.v
            });
            // text/plain: kein Preflight, und /api/client-error liest beides
            navigator.sendBeacon('/api/client-error', new Blob([body], { type: 'text/plain' }));
        } catch(e) { /* Melden darf nie selbst einen Fehler auslösen */ }
    }

    function _capture(type, message, source, lineno, colno, stack) {
        var entry = {
            v:       APP_VER,
            type:    type,
            message: String(message || '').slice(0, 300),
            source:  String(source  || '').slice(0, 200),
            line:    lineno || 0,
            col:     colno  || 0,
            stack:   String(stack   || '').slice(0, 600),
            url:     location.pathname,
            ts:      new Date().toISOString(),
            ua:      navigator.userAgent.slice(0, 100)
        };
        _store(entry);
        _send(entry);
    }

    // ── Sync JS errors ──
    var _prev = window.onerror;
    window.onerror = function(msg, src, line, col, err) {
        _capture('js', msg, src, line, col, err && err.stack);
        if (typeof _prev === 'function') _prev.apply(this, arguments);
        return false; // don't suppress default browser handling
    };

    // ── Unhandled Promise rejections ──
    window.addEventListener('unhandledrejection', function(ev) {
        var reason = ev.reason || {};
        _capture(
            'promise',
            reason.message || String(reason),
            reason.fileName || '',
            reason.lineNumber || 0,
            reason.columnNumber || 0,
            reason.stack || ''
        );
    });

    // ── Public API ──
    window.ErrorLogger = {
        /** Returns all stored error entries (newest first) */
        getLogs: function() {
            try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch(e) { return []; }
        },
        /** Clear stored logs */
        clear: function() {
            localStorage.removeItem(LS_KEY);
        },
        /** Manually log a caught error (e.g. in catch blocks) */
        log: function(err, context) {
            var msg = (err && err.message) ? err.message : String(err);
            _capture('manual', (context ? context + ': ' : '') + msg, '', 0, 0, err && err.stack);
        }
    };

})();
