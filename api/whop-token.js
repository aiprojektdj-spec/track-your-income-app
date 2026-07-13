// Vercel Serverless Function — Whop OAuth Code → Access Token Exchange
// Client secret stays server-side; never exposed to the browser.
// Env var required: WHOP_CLIENT_SECRET

var REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '';
var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
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
        // Nicht still überspringen: sichtbar loggen, damit fehlende Redis-Env auffällt.
        console.warn('[whop-token] Rate-Limit INAKTIV — UPSTASH_REDIS_REST_URL/TOKEN nicht gesetzt');
    } else {
        try {
            var ip    = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
            var rlKey = 'whoptoken:rl:' + ip;
            var count = await redisCmd(['INCR', rlKey]);
            // NX: TTL nachziehen falls beim ersten INCR verloren — sonst permanente IP-Sperre
            await redisCmd(['EXPIRE', rlKey, '60', 'NX']);
            if (count > RATE_MAX) return res.status(429).json({ error: 'rate_limited' });
        } catch (e) {
            console.error('[whop-token] rate-limit error:', e); // nicht blockierend
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

        return res.status(200).json({ access_token: data.access_token });
    } catch (err) {
        console.error('[whop-token] Fetch error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};
