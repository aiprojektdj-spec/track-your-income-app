// Stackr — Kündigungsschaltfläche nach § 312k BGB
// =============================================================================
// POST /api/kuendigung   (application/x-www-form-urlencoded aus kuendigen.html, ohne JS)
//   Felder: art (ordentlich|ausserordentlich), grund, name, email, kennung, vertrag,
//           zeitpunkt (naechstmoeglich|datum), datum (JJJJ-MM-TT), website (Honigtopf, leer)
//   → 200 HTML-Eingangsbestätigung (zum Speichern/Drucken, § 312k Abs. 3 BGB)
//   → 400 HTML mit Fehlerhinweis · 403 fremder Origin · 405 kein POST · 413 zu groß · 429
//
// Ablauf (Entscheidung User 2026-10-24: automatisch per Whop-API, Bestätigung per Make-Mail,
// Nachweis in Supabase):
//   1. Erklärung in kuendigungen speichern (supabase/migrations/20261024000001_kuendigungen.sql)
//   2. Ordentliche Kündigung zum nächstmöglichen Zeitpunkt: alle laufenden Whop-Mitgliedschaften
//      mit genau dieser E-Mail zum Periodenende kündigen (POST /api/v1/memberships/{id}/cancel,
//      cancellation_mode at_period_end). Außerordentliche Kündigung und Wunschdatum werden
//      bewusst NICHT automatisch ausgeführt, sondern als 'manuell' gemeldet.
//   3. Meldung an ALERT_WEBHOOK_URL (Make) mit event 'kuendigung' — das Szenario schickt daraus
//      die Eingangsbestätigung per E-Mail an den Kunden (§ 312k Abs. 4 BGB) und benachrichtigt
//      den Betreiber. Nicht über api/_alert.js: dessen Entprellung würde die zweite Kündigung
//      binnen 5 Minuten verschlucken.
//
// Die Erklärung ist wirksam, sobald sie hier ankommt. Deshalb blockiert nichts davon die
// Bestätigungsseite außer dem Fall, dass WEDER Supabase NOCH der Webhook sie festhalten
// konnte — dann wäre sie verloren, und die Seite nennt stattdessen die Kontakt-E-Mail.
//
// Missbrauch: Wer eine fremde E-Mail einträgt, kündigt fremde Mitgliedschaften — aber nur zum
// Periodenende (bei Whop umkehrbar), und die Bestätigung geht an genau diese E-Mail, der
// Inhaber erfährt es also sofort. Dazu Honigtopf, nur gleicher Origin, 5 Erklärungen je IP in
// 10 Minuten, 300 je Tag gesamt. Rate-Limit FAIL-OPEN: eine Kündigung darf nicht an einem
// Speicher-Ausfall scheitern.
//
// Env: WHOP_API_KEY (braucht membership:cancel, member:basic:read, member:email:read),
//      WHOP_COMPANY_ID (Default biz_2OEWYGlOwb8b0f), ALERT_WEBHOOK_URL, SUPABASE_*.
// =============================================================================

var _log  = require('./_log.js');
var db    = require('./_db.js');
var store = require('./_sync-store.js');

var BODY_MAX     = 8192;
var IP_RATE_MAX  = 5;
var DAY_MAX      = 300;
var WHOP_API     = 'https://api.whop.com/api/v1';
var MAX_PAGES    = 50;
var LAUFEND      = { trialing: 1, active: 1, past_due: 1 };
var KONTAKT      = 'secondlife.vintage07@gmail.com';

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

function _s(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max); }

// Prüft und normalisiert die Eingaben. Rückgabe { ok, fehler[], daten }.
function pruefe(f) {
    var d = {
        art:       f.art === 'ausserordentlich' ? 'ausserordentlich' : 'ordentlich',
        grund:     _s(f.grund, 2000),
        name:      _s(f.name, 200),
        email:     _s(f.email, 254).toLowerCase(),
        kennung:   _s(f.kennung, 200),
        vertrag:   ({ monatlich: 1, jaehrlich: 1 })[f.vertrag] ? f.vertrag : 'unbekannt',
        zeitpunkt: f.zeitpunkt === 'datum' ? 'datum' : 'naechstmoeglich',
        datum:     _s(f.datum, 10)
    };
    var fehler = [];
    if (!d.name) fehler.push('Bitte gib deinen Namen an.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) fehler.push('Bitte gib die E-Mail-Adresse deines Whop-Kontos an.');
    if (d.art === 'ausserordentlich' && !d.grund) fehler.push('Bitte nenne bei einer außerordentlichen Kündigung den Grund.');
    if (d.zeitpunkt === 'datum' && !/^\d{4}-\d{2}-\d{2}$/.test(d.datum)) fehler.push('Bitte gib das gewünschte Kündigungsdatum an.');
    if (d.zeitpunkt !== 'datum') d.datum = '';
    return { ok: fehler.length === 0, fehler: fehler, daten: d };
}

// ── Whop ──────────────────────────────────────────────────────────────────────
async function _whop(pfad, opts) {
    var r = await fetch(WHOP_API + pfad, Object.assign({ signal: AbortSignal.timeout(8000) }, opts, {
        headers: Object.assign({ 'Authorization': 'Bearer ' + _env('WHOP_API_KEY'), 'Accept': 'application/json' },
                               (opts && opts.headers) || {})
    }));
    if (!r.ok) { var e = new Error('Whop ' + pfad.split('?')[0].replace(/mem_\w+/, 'mem_…') + ' HTTP ' + r.status); e.httpStatus = r.status; throw e; }
    return r.json();
}

// Alle laufenden Mitgliedschaften der Firma mit genau dieser E-Mail.
async function _mitgliedschaften(email) {
    var treffer = [], after = '', seite = 0;
    var firma = _env('WHOP_COMPANY_ID', 'biz_2OEWYGlOwb8b0f');
    while (seite++ < MAX_PAGES) {
        var q = '/memberships?account_id=' + encodeURIComponent(firma) + '&first=100' +
                (after ? '&after=' + encodeURIComponent(after) : '');
        var j = await _whop(q);
        (j.data || []).forEach(function (m) {
            var mail = m && m.user && m.user.email;
            if (mail && String(mail).toLowerCase() === email && LAUFEND[m.status]) treffer.push(m);
        });
        var pi = j.page_info;
        if (!pi || !pi.has_next_page || !pi.end_cursor) break;
        after = pi.end_cursor;
    }
    return treffer;
}

// Rückgabe { status, detail, wirksam } — wirft nie.
async function kuendigeBeiWhop(d) {
    if (d.art !== 'ordentlich' || d.zeitpunkt !== 'naechstmoeglich') {
        return { status: 'manuell', detail: d.art === 'ausserordentlich' ? 'außerordentlich' : 'Wunschdatum ' + d.datum, wirksam: null };
    }
    if (!_env('WHOP_API_KEY')) return { status: 'fehler', detail: 'WHOP_API_KEY fehlt', wirksam: null };
    try {
        var liste = await _mitgliedschaften(d.email);
        if (!liste.length) return { status: 'nicht_gefunden', detail: '', wirksam: null };
        var wirksam = null, ids = [];
        for (var i = 0; i < liste.length; i++) {
            var m = await _whop('/memberships/' + encodeURIComponent(liste[i].id) + '/cancel', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ cancellation_mode: 'at_period_end' })
            });
            ids.push(liste[i].id);
            var ende = (m && m.renewal_period_end) || liste[i].renewal_period_end;
            if (ende) {
                var t = typeof ende === 'number' ? new Date(ende < 1e12 ? ende * 1000 : ende) : new Date(ende);
                if (!isNaN(t) && (!wirksam || t > wirksam)) wirksam = t;
            }
        }
        return { status: 'gekuendigt', detail: ids.join(','), wirksam: wirksam };
    } catch (e) {
        _log.logError('kuendigung', 'WHOP_CANCEL_FAILED', e);
        return { status: 'fehler', detail: e.message, wirksam: null };
    }
}

// ── Nachweis und Meldung ──────────────────────────────────────────────────────
async function _speichern(d) {
    if (!db.isConfigured()) return null;
    try {
        return await db.rpc('sync_kuendigung_add', {
            p_name: d.name, p_email: d.email, p_art: d.art, p_grund: d.grund,
            p_zeitpunkt: d.zeitpunkt === 'datum' ? d.datum : 'naechstmoeglich',
            p_vertrag: d.vertrag, p_kennung: d.kennung
        });
    } catch (e) { _log.logError('kuendigung', 'STORE_FAILED', e); return null; }
}

async function _status(id, w) {
    if (!id || !db.isConfigured()) return;
    try {
        await db.rpc('sync_kuendigung_status', {
            p_id: id, p_status: w.status, p_detail: w.detail, p_wirksam: w.wirksam ? w.wirksam.toISOString() : null
        });
    } catch (e) { _log.logError('kuendigung', 'STATUS_FAILED', e); }
}

function _berlin(t) {
    return t.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'long', timeStyle: 'short' }) + ' Uhr';
}
function _berlinTag(t) { return t.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'long' }); }

var VERTRAG = { monatlich: 'Stackr Pro monatlich', jaehrlich: 'Stackr Pro jährlich', unbekannt: 'Stackr Pro' };

function _wirksamText(d, w) {
    if (d.zeitpunkt === 'datum') return 'zum gewünschten Datum ' + _berlinTag(new Date(d.datum + 'T12:00:00Z')) + ', frühestens zum Ende des laufenden Abrechnungszeitraums';
    if (d.art === 'ausserordentlich') return 'nach Prüfung des Grundes; wir melden uns per E-Mail';
    if (w.wirksam) return 'zum Ende des laufenden Abrechnungszeitraums am ' + _berlinTag(w.wirksam);
    return 'zum nächstmöglichen Zeitpunkt (Ende des laufenden Abrechnungszeitraums)';
}

// Inhalt der Bestätigung — dieselbe Liste für Seite und E-Mail.
function bestaetigung(d, nr, eingang, w) {
    return {
        nr: nr ? 'K-' + nr : '',
        zeilen: [
            ['Eingang',             _berlin(eingang)],
            ['Vertrag',             VERTRAG[d.vertrag]],
            ['Art der Kündigung',   d.art === 'ausserordentlich' ? 'außerordentlich' : 'ordentlich'],
            d.art === 'ausserordentlich' ? ['Grund', d.grund] : null,
            ['Name',                d.name],
            ['E-Mail',              d.email],
            d.kennung ? ['Whop-Benutzername / Bestellnummer', d.kennung] : null,
            ['Wirksam',             _wirksamText(d, w)]
        ].filter(Boolean)
    };
}

async function _melden(d, b, w) {
    var url = _env('ALERT_WEBHOOK_URL');
    if (!url) return false;
    var text = 'Eingangsbestätigung deiner Kündigung' + (b.nr ? ' (' + b.nr + ')' : '') + '\n\n' +
               b.zeilen.map(function (z) { return z[0] + ': ' + z[1]; }).join('\n') +
               '\n\nDiese E-Mail bestätigt den Eingang deiner Kündigungserklärung nach § 312k Abs. 4 BGB.' +
               '\nFragen: ' + KONTAKT;
    try {
        var r = await fetch(url, {
            method:  'POST',
            // charset MUSS mit, sonst dekodiert Make als Latin-1 (s. api/_alert.js)
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body:    JSON.stringify({
                text:        '[Stackr] kuendigung — ' + w.status + (b.nr ? ' ' + b.nr : ''),
                source:      'kuendigung',
                event:       'kuendigung',
                env:         _env('VERCEL_ENV', 'unknown'),
                ts:          new Date().toISOString(),
                kuendigung:  b.nr,
                email:       d.email,
                name:        d.name,
                whop_status: w.status,
                whop_detail: String(w.detail || '').slice(0, 300),
                mail_betreff: 'Eingangsbestätigung deiner Kündigung bei Stackr' + (b.nr ? ' (' + b.nr + ')' : ''),
                mail_text:   text
            }),
            signal: AbortSignal.timeout(4000)
        });
        return !!r.ok;
    } catch (e) { _log.logError('kuendigung', 'WEBHOOK_FAILED', e); return false; }
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

function seiteBestaetigung(b, mailVersucht) {
    var zeilen = b.zeilen.map(function (z) {
        return '        <div class="data-row"><span class="data-lbl">' + _esc(z[0]) + ':</span> <span class="data-val">' + _esc(z[1]) + '</span></div>';
    }).join('\n');
    return _seite('Kündigung eingegangen',
        '    <h1>Deine Kündigung ist eingegangen</h1>\n' +
        (b.nr ? '    <p class="subtitle">Kündigungsnummer ' + _esc(b.nr) + '</p>\n' : '') +
        '    <div class="section">\n' + zeilen + '\n    </div>\n' +
        '    <div class="highlight-box">\n        <strong>Bitte speichere oder drucke diese Seite</strong> ' +
        '(z.&nbsp;B. mit Strg+P bzw. Cmd+P) als Nachweis über Inhalt, Datum und Uhrzeit deiner Kündigung.\n' +
        (mailVersucht ? '        Eine Eingangsbestätigung schicken wir dir zusätzlich an die angegebene E-Mail-Adresse.\n' : '') +
        '    </div>\n' +
        '    <p>Fragen zur Kündigung: <a href="mailto:' + KONTAKT + '">' + KONTAKT + '</a></p>');
}

function seiteFehler(fehler, status) {
    return _seite('Kündigung nicht abgeschickt',
        '    <h1>Kündigung nicht abgeschickt</h1>\n    <div class="highlight-box">\n' +
        fehler.map(function (f) { return '        <p>' + _esc(f) + '</p>'; }).join('\n') +
        '\n    </div>\n' +
        (status === 400 ? '    <p><a href="/kuendigen.html">Zurück zum Formular</a></p>\n' : '') +
        '    <p>Du kannst uns deine Kündigung auch jederzeit per E-Mail an ' +
        '<a href="mailto:' + KONTAKT + '">' + KONTAKT + '</a> schicken.</p>');
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
    var d = p.daten;

    // Rate-Limit FAIL-OPEN (s. Kopf)
    if (!store.configProblem()) {
        try {
            var ip = req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
            if (await store.rateHit('kuend:iprl:' + ip, 600) > IP_RATE_MAX) {
                return _html(res, 429, seiteFehler(['Zu viele Kündigungen in kurzer Zeit. Bitte versuche es in einigen Minuten erneut.'], 429));
            }
            if (await store.rateHit('kuend:total:' + new Date().toISOString().slice(0, 10), 2 * 24 * 60 * 60) > DAY_MAX) {
                return _html(res, 429, seiteFehler(['Das Formular ist gerade überlastet. Bitte versuche es später erneut.'], 429));
            }
        } catch (e) { _log.logWarn('kuendigung', 'RATE_LIMIT_OPEN', e); }
    }

    var row     = await _speichern(d);
    var eingang = row && row.eingang ? new Date(row.eingang) : new Date();
    var w       = await kuendigeBeiWhop(d);
    await _status(row && row.id, w);
    var b       = bestaetigung(d, row && row.id, eingang, w);
    var gemeldet = await _melden(d, b, w);

    if (!row && !gemeldet) {
        _log.logError('kuendigung', 'NOT_RECORDED', 'weder Supabase noch Webhook');
        return _html(res, 503, seiteFehler(['Deine Kündigung konnte gerade technisch nicht entgegengenommen werden.'], 503));
    }
    return _html(res, 200, seiteBestaetigung(b, gemeldet));
}

module.exports = handler;
module.exports._intern = { pruefe: pruefe, kuendigeBeiWhop: kuendigeBeiWhop, bestaetigung: bestaetigung };
