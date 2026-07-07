// Vercel Serverless Function — Stackr E2E Cloud-Sync Backend
// =============================================================================
// Speichert AUSSCHLIESSLICH Chiffrat. Der Server kann die Buchhaltungsdaten
// niemals entschlüsseln — der Schlüssel verlässt das Gerät des Nutzers nie.
//
// Identität: Whop-Bearer-Token wird server-seitig gegen Whop validiert
//   (userinfo + has-access). Die UserID wird server-seitig abgeleitet —
//   einer client-gesendeten ID wird NIE vertraut.
// Sync ist PRO-ONLY: nur bei has_access === true (oder Owner-Allowlist).
//
// Store: Upstash Redis (REST), Region eu-central-1 (Frankfurt) → EU-Residenz.
//   Keys:  sync:<userId>:<scope>   scope = "__account" | "co_<id>"
//   Wert:  { ciphertext, iv, version, updatedAt, deviceId }   (nur Chiffrat)
//   CAS:   optimistische Nebenläufigkeit per Versions-Vergleich (Lua EVAL).
//
// Env (Vercel, EU-Region) — von der Upstash-Marketplace-Integration automatisch
// gesetzt (KV_REST_API_*). UPSTASH_REDIS_REST_* werden als Override unterstützt.
//   KV_REST_API_URL / KV_REST_API_TOKEN    (Upstash REST-Endpoint + RW-Token)
//   WHOP_APP_ID                (default app_dc3OND8eGv2Iim)
//   SYNC_OWNER_USERNAMES       (optional, kommagetrennt — Owner ohne Abo)
// =============================================================================

// Variablennamen je nach Setup (manuell UPSTASH_* oder Vercel-Integration KV_*).
var REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '';
var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

var WHOP_APP_ID  = process.env.WHOP_APP_ID || 'app_dc3OND8eGv2Iim';
var OWNERS       = (process.env.SYNC_OWNER_USERNAMES || 'secondlifevintage41')
                       .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

var RATE_MAX     = 40;             // Requests pro Minute pro Nutzer (Push ist 6s-debounced, 40 deckt Firmenwechsel+Retries komfortabel)
var MAX_CIPHER   = 8 * 1024 * 1024; // 8 MB base64-Chiffrat pro Scope
var SCOPE_RE     = /^(__account|co_[a-z0-9_]+)$/;

// CAS-Skript: setzt nur, wenn die gespeicherte Version == erwarteter Version.
// Bei Konflikt wird der aktuelle Wert zurückgegeben → Client macht pull-merge-retry.
var CAS_LUA = [
    "local cur = redis.call('GET', KEYS[1])",
    "if cur then",
    "  local ok, obj = pcall(cjson.decode, cur)",
    "  if (not ok) or (tostring(obj.version) ~= ARGV[1]) then return cur end",
    "end",
    "redis.call('SET', KEYS[1], ARGV[2])",
    "return 'OK'"
].join('\n');

function redisCmd(cmd) {
    // ponytail: timeout = lazy circuit breaker. Hung Redis fast-fails instead of
    // holding the function until platform kill. Full breaker is pointless on a
    // stateless serverless fn — trip state dies with each cold start.
    return fetch(REDIS_URL, {
        method:  'POST',
        headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
        body:    JSON.stringify(cmd),
        signal:  AbortSignal.timeout(8000)
    }).then(function (r) { return r.json(); })
      .then(function (j) {
          if (j && j.error) throw new Error('Redis: ' + j.error);
          return j ? j.result : null;
      });
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://track-your-income-app.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'method_not_allowed' });

    if (!REDIS_URL || !REDIS_TOKEN) {
        console.error('[sync] Redis env not set (KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_*)');
        return res.status(500).json({ error: 'server_misconfigured' });
    }

    // ── 1. Bearer-Token holen ────────────────────────────────────────────────
    var auth  = req.headers['authorization'] || '';
    var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : '';
    if (!token || token.length > 4096) return res.status(401).json({ error: 'no_token' });

    // ── 2. Token gegen Whop validieren → UserID server-seitig ableiten ────────
    var userId, username;
    try {
        // OIDC userinfo — identischer Endpoint wie der Client (js/whop-auth.js).
        // /v5/me lehnt OAuth-User-Tokens mit 401 ab → hier /oauth/userinfo nutzen.
        var meRes = await fetch('https://api.whop.com/oauth/userinfo', {
            headers: { 'Authorization': 'Bearer ' + token },
            signal:  AbortSignal.timeout(8000)
        });
        if (!meRes.ok) return res.status(401).json({ error: 'invalid_token' });
        var me   = await meRes.json();
        userId   = me.sub || me.id;
        username = me.preferred_username || me.name || me.username || '';
        if (!userId) return res.status(401).json({ error: 'no_user' });
    } catch (e) {
        console.error('[sync] userinfo failed:', e);
        return res.status(502).json({ error: 'whop_unreachable' });
    }

    // ── 3. PRO erzwingen (server-seitig, nicht nur UI) ────────────────────────
    var isOwner = OWNERS.indexOf(username) !== -1;
    if (!isOwner) {
        try {
            var accRes  = await fetch('https://api.whop.com/v5/me/has-access/' + WHOP_APP_ID, {
                headers: { 'Authorization': 'Bearer ' + token },
                signal:  AbortSignal.timeout(8000)
            });
            var accData = accRes.ok ? await accRes.json() : {};
            if (accData.has_access !== true) return res.status(403).json({ error: 'pro_required' });
        } catch (e) {
            console.error('[sync] has-access failed:', e);
            return res.status(502).json({ error: 'whop_unreachable' });
        }
    }

    // ── 4. Rate-Limit (KV-Counter, 60s-Fenster) ──────────────────────────────
    try {
        var rlKey = 'sync:rl:' + userId;
        var count = await redisCmd(['INCR', rlKey]);
        // NX: setzt TTL nur wenn keiner existiert — heilt Keys, deren EXPIRE nach dem
        // ersten INCR fehlschlug (sonst permanenter 429 für den Nutzer)
        await redisCmd(['EXPIRE', rlKey, '60', 'NX']);
        if (count > RATE_MAX) return res.status(429).json({ error: 'rate_limited' });
    } catch (e) {
        console.error('[sync] rate-limit error:', e);
        // Rate-Limit-Fehler nicht blockierend — weiter
    }

    // ── 5. Request validieren ─────────────────────────────────────────────────
    var body   = req.body || {};
    var action = body.action;
    var scope  = body.scope;
    if (!SCOPE_RE.test(String(scope || ''))) return res.status(400).json({ error: 'bad_scope' });

    var key = 'sync:' + userId + ':' + scope;

    try {
        if (action === 'pull') {
            var cur = await redisCmd(['GET', key]);
            return res.status(200).json({ ok: true, blob: cur ? JSON.parse(cur) : null });
        }

        if (action === 'push') {
            var expected = parseInt(body.version, 10);
            if (isNaN(expected) || expected < 0) return res.status(400).json({ error: 'bad_version' });
            if (typeof body.ciphertext !== 'string' || typeof body.iv !== 'string')
                return res.status(400).json({ error: 'bad_payload' });
            if (body.ciphertext.length > MAX_CIPHER) return res.status(413).json({ error: 'too_large' });

            var newBlob = JSON.stringify({
                ciphertext: body.ciphertext,
                iv:         body.iv,
                version:    expected + 1,
                updatedAt:  Date.now(),
                deviceId:   typeof body.deviceId === 'string' ? body.deviceId.slice(0, 64) : ''
            });

            var result = await redisCmd(['EVAL', CAS_LUA, '1', key, String(expected), newBlob]);
            if (result === 'OK') {
                return res.status(200).json({ ok: true, version: expected + 1 });
            }
            // Konflikt: aktueller Server-Stand zurück → Client merged & retried
            return res.status(409).json({ error: 'version_conflict', blob: result ? JSON.parse(result) : null });
        }

        if (action === 'delete') {
            // Art. 17 DSGVO — löscht den verschlüsselten Snapshot dieses Scopes unwiderruflich.
            await redisCmd(['DEL', key]);
            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: 'bad_action' });
    } catch (e) {
        console.error('[sync] storage error:', e);
        return res.status(500).json({ error: 'storage_error' });
    }
};
