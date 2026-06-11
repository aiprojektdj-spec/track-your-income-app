/**
 * error-logger.js — Stackr Error Monitoring
 * Captures JS errors + unhandled promise rejections.
 * Stores in localStorage (max 50 entries) for debugging.
 * In production: extend _send() to POST to a logging endpoint.
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

    function _send(entry) {
        // TODO: replace with real endpoint when available
        // fetch('/api/log-error', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(entry) })
        //   .catch(function(){});

        // For now: console.warn so devtools shows it without breaking UX
        console.warn('[Stackr Error]', entry.type, entry.message, entry.source);
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
