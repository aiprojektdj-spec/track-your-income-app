// Vercel Serverless Function — Whop OAuth Code → Access Token Exchange
// Client secret stays server-side; never exposed to the browser.
// Env var required: WHOP_CLIENT_SECRET
// Env optional:      ALERT_WEBHOOK_URL — Meldung bei offenem Rate-Limit-Deckel (api/_alert.js)

var REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '';
var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
// Meldet stillschweigende Degradierung (offener Deckel) an ALERT_WEBHOOK_URL, siehe api/_alert.js
var alertOps    = require('./_alert.js').alertOps;
var RATE_MAX    = 8; // Requests pro Minute pro IP — Login passiert nicht öfter als 1-2x/min, 8 lässt Retry-Spielraum, bremst Flood/Scan-Versuche stärker

function redisCmd(cmd) {
    return fetch(REDIS_URL, {
        method:  'POST',
        headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
        body:    JSON.stringify(cmd),
        signal:  AbortSignal.timeout(8000)
    }).then(function (r) { return r.json(); }).then(function (j) { return j ? j.result : null; });
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://track-your-income-app.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

    if (!REDIS_URL || !REDIS_TOKEN) {
        // ponytail: kein In-Memory-Fallback — in Serverless (Cold Starts, N Instanzen) wertlos.
        // Nicht still überspringen: melden, damit fehlende Redis-Env auffällt.
        await alertOps('whop-token', 'rate-limit-inaktiv',
            'UPSTASH_REDIS_REST_URL/TOKEN nicht gesetzt — Login-Endpunkt ohne IP-Deckel');
    } else {
        try {
            // x-vercel-forwarded-for wird von Vercels Edge-Netzwerk selbst gesetzt und ist vom
            // Client nicht überschreibbar (anders als das erste x-forwarded-for-Segment, das ein
            // Client mitschicken kann) — sonst wäre das IP-Rate-Limit per Header spoofbar.
            var ip    = req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
            var rlKey = 'whoptoken:rl:' + ip;
            var count = await redisCmd(['INCR', rlKey]);
            // NX: TTL nachziehen falls beim ersten INCR verloren — sonst permanente IP-Sperre
            await redisCmd(['EXPIRE', rlKey, '60', 'NX']);
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
        console.error('[whop-token] WHOP_CLIENT_SECRET not set');
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
                redirect_uri:  'https://track-your-income-app.vercel.app/app.html',
            }),
        });
        var data = await tokenRes.json();

        if (!tokenRes.ok) {
            console.error('[whop-token] Token exchange failed:', JSON.stringify(data));
            return res.status(400).json({ error: 'invalid_grant' });
        }

        // Refresh-Token serverseitig ablegen, Client bekommt nur eine Sitzungs-ID.
        // Warum nicht in den Browser: s. Kopfkommentar in api/whop-refresh.js.
        // Ohne Redis geht das nicht — dann verhaelt sich alles wie vor 2026-09-05
        // (Sitzung endet nach einer Stunde), statt den Login ganz scheitern zu lassen.
        var sessionId = null;
        if (data.refresh_token && REDIS_URL && REDIS_TOKEN) {
            try {
                sessionId = require('crypto').randomBytes(32).toString('hex');
                var expiresIn = parseInt(data.expires_in, 10);
                if (!expiresIn || expiresIn < 0) expiresIn = 3600;
                await redisCmd(['SET', 'whoprt:' + sessionId, JSON.stringify({
                    rt:  data.refresh_token,
                    at:  data.access_token,
                    exp: Date.now() + expiresIn * 1000
                }), 'EX', String(30 * 24 * 60 * 60)]);
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
        console.error('[whop-token] Fetch error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};
