/**
 * error-logger.js — Stackr Error Monitoring
 * Captures JS errors + unhandled promise rejections.
 * Stores in localStorage (max 50 entries) for debugging.
 * Zusätzlich: bereinigte Kurzfassung per sendBeacon an /api/client-error
 * (plan/betrieb-luecken-2026-09-29.md §4) — nur im Web-Build über https,
 * jeder Fehler höchstens 1× pro Seitenaufruf, höchstens 10 pro Seitenaufruf.
 * Gesendet werden nur Art, ein fester Fehlercode (s. _code), Dateipfad, Zeile/Spalte und
 * Version — keine freie Fehlermeldung, kein Stack, keine Seiten-URL, kein User-Agent.
 * Die vollständige Meldung bleibt ausschließlich im lokalen Fehlerprotokoll des Geräts.
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

    var MAX_SENDS = 10;

    // Nur im Arbeitsspeicher, pro Seitenaufruf: ein Fehler in einer Schleife wird
    // nicht jedes Mal erneut gemeldet. Bewusst nicht im sessionStorage — so wird fürs
    // Melden nichts auf dem Endgerät gespeichert (§ 25 TDDDG, F7 in
    // plan/rechtstexte-supabase-entwurf.md). Wiederholungen über Seiten deckelt der Server.
    var _sent = {};

    // Nur der Pfad: keine Query (?v=…), kein Host.
    function _path(src) {
        if (!src) return '';   // sonst lieferte new URL('', href) den Seitenpfad
        try { return new URL(src, location.href).pathname; } catch(e) { return ''; }
    }

    // Fester Fehlercode statt freier Meldung (Audit 2026-10-13, S8). Eine Error.message kann
    // Teile fehlgeschlagener Eingaben oder Antworten enthalten — Namen, Beträge, Belegtext,
    // Tokens. Übertragen wird deshalb nur: Fehlerart (TypeError …) und, für die häufigsten
    // Laufzeitfehler, der betroffene Bezeichner aus dem QUELLCODE (z. B. "read_undefined:length"),
    // und auch der nur, wenn er wie ein JS-Bezeichner aussieht. Alles andere wird "sonstig".
    var IDENT = /^[A-Za-z_$][\w$]{0,40}$/;
    var ARTEN = ['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'URIError', 'EvalError',
                 'AbortError', 'NetworkError', 'QuotaExceededError', 'SecurityError', 'NotAllowedError',
                 'DataError', 'InvalidStateError', 'NotFoundError', 'TimeoutError', 'Error'];
    function _code(message, name) {
        var m = String(message || '');
        var art = '';
        ARTEN.some(function (a) { if (name === a || m.indexOf(a + ':') === 0 || m.indexOf('Uncaught ' + a) === 0) { art = a; return true; } return false; });
        var muster = [
            [/Cannot read propert(?:y|ies) of (?:undefined|null) \(reading '([^']*)'\)/, 'read_undefined'],
            [/Cannot set propert(?:y|ies) of (?:undefined|null) \(setting '([^']*)'\)/, 'set_undefined'],
            [/([A-Za-z_$][\w$.]*) is not defined/, 'not_defined'],
            [/([A-Za-z_$][\w$.]*) is not a function/, 'not_function'],
            [/([A-Za-z_$][\w$.]*) is not iterable/, 'not_iterable'],
            [/Unexpected token/, 'unexpected_token'],
            [/JSON/, 'json'],
            [/Failed to fetch|NetworkError|Load failed/, 'fetch_failed'],
            [/quota/i, 'quota'],
            [/Maximum call stack/, 'stack_overflow']
        ];
        for (var i = 0; i < muster.length; i++) {
            var t = m.match(muster[i][0]);
            if (!t) continue;
            var ident = t[1] && IDENT.test(t[1].split('.').pop()) ? ':' + t[1].split('.').pop() : '';
            return (art || 'Error') + ':' + muster[i][1] + ident;
        }
        return (art || 'Error') + ':sonstig';
    }

    function _send(entry) {
        console.warn('[Stackr Error]', entry.type, entry.message, entry.source);

        // Nur der Web-Build über https meldet — nicht die Local-Version (file:),
        // nicht der lokale Dev-Server (http://localhost).
        if (location.protocol !== 'https:' || !navigator.sendBeacon) return;

        var src = _path(entry.source);
        var code = entry.code || _code(entry.message, entry.name);
        var key = entry.type + '|' + code + '|' + src + '|' + entry.line;
        if (_sent[key] || Object.keys(_sent).length >= MAX_SENDS) return;
        _sent[key] = 1;

        try {
            // Feldname "message" bleibt für api/client-error.js (Whitelist dort); der Inhalt ist der Code.
            var body = JSON.stringify({
                type: entry.type, message: code, source: src,
                line: entry.line, col: entry.col, v: entry.v
            });
            // text/plain: kein Preflight, und /api/client-error liest beides
            navigator.sendBeacon('/api/client-error', new Blob([body], { type: 'text/plain' }));
        } catch(e) { /* Melden darf nie selbst einen Fehler auslösen */ }
    }

    function _capture(type, message, source, lineno, colno, stack, name, code) {
        var entry = {
            v:       APP_VER,
            type:    type,
            name:    name || '',
            code:    code || '',
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
        _capture('js', msg, src, line, col, err && err.stack, err && err.name);
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
            reason.stack || '',
            reason.name || ''
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
            // context ist oft ein fester Ort ("Rechnung speichern"), kann aber Daten enthalten —
            // gesendet wird er nur, wenn er wie ein kurzer technischer Bezeichner aussieht.
            var ctxOk = context && /^[A-Za-z0-9_.-]{1,40}$/.test(String(context));
            var code = _code(msg, err && err.name) + (ctxOk ? '@' + context : '');
            _capture('manual', (context ? context + ': ' : '') + msg, '', 0, 0, err && err.stack, err && err.name, code);
        }
    };

})();
