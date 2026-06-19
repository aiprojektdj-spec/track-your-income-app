// Vercel Serverless Function — Whop OAuth Code → Access Token Exchange
// Client secret stays server-side; never exposed to the browser.
// Env var required: WHOP_CLIENT_SECRET

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://track-your-income-app.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

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
            console.error('[whop-token] Token exchange failed:', data);
            return res.status(400).json({ error: data.error || 'Token exchange failed' });
        }

        return res.status(200).json({ access_token: data.access_token });
    } catch (err) {
        console.error('[whop-token] Fetch error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};
