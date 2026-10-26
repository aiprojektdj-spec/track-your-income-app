// Stackr — Kontaktformular (zweiter Kommunikationsweg neben der E-Mail, § 5 Abs. 1 Nr. 2 DDG)
// =============================================================================
// POST /api/kontakt   (application/x-www-form-urlencoded aus kontakt.html, ohne JS)
//   Felder: name, email, betreff (optional), nachricht, website (Honigtopf, leer)
//   → 200 HTML „Nachricht angekommen“ · 400 Fehlerhinweis · 403 fremder Origin · 405 kein POST
//   → 413 zu groß · 429 Rate-Limit · 503 Webhook nicht erreichbar (Seite nennt die E-Mail)
//
// Hintergrund: Das Impressum nannte nur eine E-Mail-Adresse. Der EuGH (C-298/07) verlangt
// daneben einen zweiten schnellen, unmittelbaren Kommunikationsweg; ein Kontaktformular genügt
// (plan/rechtsaudit-2026-10-24.md, D1; Entscheidung User 2026-10-26).
//
// Zustellung über ALERT_WEBHOOK_URL (Make), event 'kontakt' — dasselbe Szenario wie die
// Betriebsmeldungen, die Nachricht steht vollständig in 'text'/'nachricht'. Nicht über
// api/_alert.js: dessen Entprellung würde die zweite Nachricht binnen 5 Minuten verschlucken.
// Gespeichert wird bei Stackr nichts außer dem IP-Zähler (Missbrauchsschutz, 10 Minuten).
//
// Missbrauch: Honigtopf, nur gleicher Origin, 5 Nachrichten je IP in 10 Minuten, 200 je Tag
// gesamt. Rate-Limit FAIL-OPEN wie bei der Kündigung: lieber eine Nachricht zu viel als eine
// verlorene Anfrage.
// =============================================================================

var _log  = require('./_log.js');
var store = require('./_sync-store.js');

var BODY_MAX    = 12288;
var IP_RATE_MAX = 5;
var DAY_MAX     = 200;
var KONTAKT     = 'secondlife.vintage07@gmail.com';

function _env(k, d) { return process.env[k] || d || ''; }

function _sameOrigin(req) {
    var origin = req.headers['origin'] || '';
    var host   = req.headers['x-forwarded-host'] || req.headers['host'] || '';
    if (!origin || !host) return false;
    try { return new URL(origin).host === host; } catch (e) { return false; }
}

function _felder(body) {
    if (body == null) return {};
    if (Buffer.isBuffer(body)) body = body.toString('utf8');
    if (typeof body === 'string') {
        var o = {};
        new URLSearchParams(body).forEach(function (v, k) { o[k] = v; });
        return o;
    }
    return body;
}

// Steuerzeichen raus, Zeilenumbrüche nur dort, wo erlaubt (Nachricht).
function _s(v, max, mehrzeilig) {
    var re = mehrzeilig ? /[\u0000-\u0008\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g;
    return String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(re, mehrzeilig ? '' : ' ').trim().slice(0, max);
}

function pruefe(f) {
    var d = {
        name:      _s(f.name, 200),
        email:     _s(f.email, 254).toLowerCase(),
        betreff:   _s(f.betreff, 200),
        nachricht: _s(f.nachricht, 5000, true)
    };
    var fehler = [];
    if (!d.name) fehler.push('Bitte gib deinen Namen an.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) fehler.push('Bitte gib eine gültige E-Mail-Adresse an, damit wir antworten können.');
    if (!d.nachricht) fehler.push('Bitte schreib uns deine Nachricht.');
    return { ok: fehler.length === 0, fehler: fehler, daten: d };
}

async function _senden(d) {
    var url = _env('ALERT_WEBHOOK_URL');
    if (!url) return false;
    var kopf = '[Stackr] Kontakt — ' + (d.betreff || 'Nachricht') + ' (von ' + d.name + ' <' + d.email + '>)';
    try {
        var r = await fetch(url, {
            method:  'POST',
            // charset MUSS mit, sonst dekodiert Make als Latin-1 (s. api/_alert.js)
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body:    JSON.stringify({
                text:      kopf + '\n\n' + d.nachricht,
                source:    'kontakt',
                event:     'kontakt',
                env:       _env('VERCEL_ENV', 'unknown'),
                ts:        new Date().toISOString(),
                name:      d.name,
                email:     d.email,
                betreff:   d.betreff,
                nachricht: d.nachricht
            }),
            signal: AbortSignal.timeout(4000)
        });
        return !!r.ok;
    } catch (e) { _log.logError('kontakt', 'WEBHOOK_FAILED', e); return false; }
}

// ── HTML ──────────────────────────────────────────────────────────────────────
function _esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}

var CSP = "default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; " +
          "script-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'none'; frame-src 'none'";

function _seite(titel, inhalt) {
    return '<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="UTF-8">\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '<meta name="robots" content="noindex">\n' +
        '<link rel="icon" href="/assets/stackr-concepts/raute-facette.svg" type="image/svg+xml">\n' +
        '<title>' + _esc(titel) + ' — Stackr</title>\n<link rel="stylesheet" href="/css/legal.css">\n</head>\n<body>\n' +
        '<nav class="legal-header" aria-label="Hauptnavigation">\n' +
        '    <a href="/" class="nav-brand"><span class="nav-brand-icon">◆</span><span class="nav-brand-text">stackr</span></a>\n' +
        '    <a href="/" class="nav-back">Zur Startseite</a>\n</nav>\n' +
        '<main class="page-wrap" id="inhalt">\n' + inhalt + '\n</main>\n</body>\n</html>\n';
}

function seiteDanke(d) {
    return _seite('Nachricht angekommen',
        '    <h1>Danke, deine Nachricht ist angekommen</h1>\n' +
        '    <div class="highlight-box">Wir antworten werktags innerhalb von 48 Stunden an <strong>' + _esc(d.email) + '</strong>.</div>\n' +
        '    <p><a href="/">Zur Startseite</a></p>');
}

function seiteFehler(fehler, status) {
    return _seite('Nachricht nicht gesendet',
        '    <h1>Nachricht nicht gesendet</h1>\n    <div class="highlight-box">\n' +
        fehler.map(function (f) { return '        <p>' + _esc(f) + '</p>'; }).join('\n') +
        '\n    </div>\n' +
        (status === 400 ? '    <p><a href="/kontakt.html">Zurück zum Formular</a></p>\n' : '') +
        '    <p>Du erreichst uns auch per E-Mail an <a href="mailto:' + KONTAKT + '">' + KONTAKT + '</a>.</p>');
}

function _html(res, status, body) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', CSP);
    return res.status(status).send(body);
}

// ── Handler ───────────────────────────────────────────────────────────────────
async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    if (!_sameOrigin(req))     return res.status(403).json({ error: 'forbidden' });
    if (parseInt(req.headers['content-length'], 10) > BODY_MAX) return res.status(413).json({ error: 'too_large' });

    var f = _felder(req.body);
    if (f.website) return _html(res, 200, seiteFehler(['Die Anfrage konnte nicht verarbeitet werden.'], 200)); // Honigtopf

    var p = pruefe(f);
    if (!p.ok) return _html(res, 400, seiteFehler(p.fehler, 400));

    if (!store.configProblem()) {
        try {
            var ip = req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
            if (await store.rateHit('kontakt:iprl:' + ip, 600) > IP_RATE_MAX) {
                return _html(res, 429, seiteFehler(['Zu viele Nachrichten in kurzer Zeit. Bitte versuche es in einigen Minuten erneut.'], 429));
            }
            if (await store.rateHit('kontakt:total:' + new Date().toISOString().slice(0, 10), 2 * 24 * 60 * 60) > DAY_MAX) {
                return _html(res, 429, seiteFehler(['Das Formular ist gerade überlastet. Bitte versuche es später erneut.'], 429));
            }
        } catch (e) { _log.logWarn('kontakt', 'RATE_LIMIT_OPEN', e); }
    }

    if (!(await _senden(p.daten))) {
        return _html(res, 503, seiteFehler(['Deine Nachricht konnte gerade technisch nicht zugestellt werden.'], 503));
    }
    return _html(res, 200, seiteDanke(p.daten));
}

module.exports = handler;
module.exports._intern = { pruefe: pruefe };
