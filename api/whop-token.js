// Vercel Serverless Function — Whop OAuth Code → Access Token Exchange
// Client secret stays server-side; never exposed to the browser.
// Env var required: WHOP_CLIENT_SECRET
// Env optional:      ALERT_WEBHOOK_URL — Meldung bei offenem Rate-Limit-Deckel (api/_alert.js)

// IP-Rate-Limit und Refresh-Sitzung folgen STORAGE_BACKEND (Redis | Supabase),
// plan/supabase-umzug-2026-10-06.md. Die Sitzung zusaetzlich STORAGE_MIRROR.
var store       = require('./_sync-store.js');
var sessions    = require('./_whop-sessions.js');
var setzeCorsOrigin = require('./_cors.js');
// Meldet stillschweigende Degradierung (offener Deckel) an ALERT_WEBHOOK_URL, siehe api/_alert.js
var alertOps    = require('./_alert.js').alertOps;
var _log        = require('./_log.js');
var RATE_MAX    = 8; // Requests pro Minute pro IP — Login passiert nicht öfter als 1-2x/min, 8 lässt Retry-Spielraum, bremst Flood/Scan-Versuche stärker

// Rueckleitung nach dem Whop-Login: muss exakt der beim Authorize-Aufruf entsprechen
// (js/whop-auth.js) und in der Whop-App eingetragen sein. Feste Liste statt Client-Wert,
// unbekannte Hosts (Previews) bekommen wie bisher die alte Adresse.
var REDIRECT_URIS = {
    'getstackr.de':                     'https://getstackr.de/app.html',
    'track-your-income-app.vercel.app': 'https://track-your-income-app.vercel.app/app.html',
};
function _redirectUri(req) {
    var host = String(req.headers['x-forwarded-host'] || req.headers['host'] || '').toLowerCase();
    return REDIRECT_URIS[host] || REDIRECT_URIS['track-your-income-app.vercel.app'];
}

module.exports = async function handler(req, res) {
    setzeCorsOrigin(req, res);  // getstackr.de und alte Adresse, s. api/_cors.js
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

    var rlProblem = store.configProblem();
    if (rlProblem) {
        // ponytail: kein In-Memory-Fallback — in Serverless (Cold Starts, N Instanzen) wertlos.
        // Nicht still überspringen: melden, damit fehlende Speicher-Env auffällt.
        await alertOps('whop-token', 'rate-limit-inaktiv',
            rlProblem + ' — Login-Endpunkt ohne IP-Deckel');
    } else {
        try {
            // x-vercel-forwarded-for wird von Vercels Edge-Netzwerk selbst gesetzt und ist vom
            // Client nicht überschreibbar (anders als das erste x-forwarded-for-Segment, das ein
            // Client mitschicken kann) — sonst wäre das IP-Rate-Limit per Header spoofbar.
            var ip    = req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
            var rlKey = 'whoptoken:rl:' + ip;
            var count = await store.rateHit(rlKey, 60);
            if (count > RATE_MAX) return res.status(429).json({ error: 'rate_limited' });
        } catch (e) {
            // nicht blockierend — weiter, aber der IP-Deckel ist damit offen
            await alertOps('whop-token', 'rate-limit-open', e && e.message);
        }
    }

    var code         = req.body && req.body.code;
    var codeVerifier = req.body && req.body.code_verifier;

    if (!code || typeof code !== 'string' || code.length > 512) {
        return res.status(400).json({ error: 'Missing or invalid code' });
    }
    if (!codeVerifier || typeof codeVerifier !== 'string' || codeVerifier.length > 256) {
        return res.status(400).json({ error: 'Missing or invalid code_verifier' });
    }

    var clientSecret = process.env.WHOP_CLIENT_SECRET;
    if (!clientSecret) {
        _log.logError('whop-token', 'CLIENT_SECRET_MISSING');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    try {
        var tokenRes = await fetch('https://api.whop.com/oauth/token', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                grant_type:    'authorization_code',
                code:          code,
                code_verifier: codeVerifier,
                client_id:     'app_dc3OND8eGv2Iim',
                client_secret: clientSecret,
                redirect_uri:  _redirectUri(req),
            }),
        });
        var data = await tokenRes.json();

        if (!tokenRes.ok) {
            _log.logWarn('whop-token', 'TOKEN_EXCHANGE_FAILED', data && data.error);
            return res.status(400).json({ error: 'invalid_grant' });
        }

        // Refresh-Token serverseitig ablegen, Client bekommt nur eine Sitzungs-ID.
        // Warum nicht in den Browser: s. Kopfkommentar in api/whop-refresh.js.
        // Ohne Speicher (Redis bzw. Supabase) geht das nicht — dann verhaelt sich alles
        // wie vor 2026-09-05 (Sitzung endet nach einer Stunde), statt den Login ganz
        // scheitern zu lassen.
        var sessionId = null;
        if (data.refresh_token && !sessions.configProblem()) {
            try {
                sessionId = require('crypto').randomBytes(32).toString('hex');
                var expiresIn = parseInt(data.expires_in, 10);
                if (!expiresIn || expiresIn < 0) expiresIn = 3600;
                await sessions.put(sessionId, {
                    rt:  data.refresh_token,
                    at:  data.access_token,
                    exp: Date.now() + expiresIn * 1000
                });
            } catch (e) {
                // Nicht blockierend: der Login gelingt, nur die Erneuerung fehlt.
                sessionId = null;
                await alertOps('whop-token', 'session-nicht-gespeichert',
                    'Refresh-Token konnte nicht abgelegt werden — Kunde fliegt nach einer Stunde raus: ' + (e && e.message));
            }
        } else if (!data.refresh_token) {
            await alertOps('whop-token', 'kein-refresh-token',
                'Whop lieferte keinen refresh_token — Token-Erneuerung nicht moeglich');
        }

        return res.status(200).json({
            access_token: data.access_token,
            expires_in:   parseInt(data.expires_in, 10) || 3600,
            session_id:   sessionId
        });
    } catch (err) {
        _log.logError('whop-token', 'WHOP_UNREACHABLE', err);
        return res.status(500).json({ error: 'Server error' });
    }
};
