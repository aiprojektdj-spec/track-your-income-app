// Vercel Serverless Function — Stackr E2E Cloud-Sync Backend
// =============================================================================
// Speichert AUSSCHLIESSLICH Chiffrat. Der Server kann die Buchhaltungsdaten
// niemals entschlüsseln — der Schlüssel verlässt das Gerät des Nutzers nie.
//
// Identität: Whop-Bearer-Token wird server-seitig gegen Whop validiert
//   (userinfo + /v5/me/has_access). Die UserID wird server-seitig abgeleitet —
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
//   WHOP_ACCESS_IDS            (optional, kommagetrennt — Zugangs-IDs; Default prod_+biz_)
//   WHOP_API_KEY               (optional — Company-API-Key aktiviert den Fallback-Scan)
//   SYNC_OWNER_USERNAMES       (optional, kommagetrennt — Owner ohne Abo)
// =============================================================================

// Variablennamen je nach Setup (manuell UPSTASH_* oder Vercel-Integration KV_*).
var REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '';
var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

// Zugangs-Check — zwei unabhängige Wege, Zugang sobald EINER bestätigt (identisch zu
// api/whop-access.js): (1) User-Token gegen https://api.whop.com/api/v2/me/has_access/<id>
// (has_access existiert bei Whop unter v2, NICHT v5→404, NICHT mit Bindestrich→404;
// braucht KEINEN Server-Key), (2) Fallback nur wenn WHOP_API_KEY gesetzt: Company-Scan
// gegen /v5/company/memberships?valid=true (user_id-Filter wird ignoriert → selbst matchen).
//   prod_wgVmaJg4sBVOD = Pro 15 €/Mon · prod_p1WHi5t65rAA6 = 135 €/Jahr · biz_2OEWYGlOwb8b0f = Company
var ACCESS_IDS   = (process.env.WHOP_ACCESS_IDS || 'prod_wgVmaJg4sBVOD,prod_p1WHi5t65rAA6,biz_2OEWYGlOwb8b0f')
                       .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
var WHOP_API_KEY = process.env.WHOP_API_KEY || '';
var OWNERS       = (process.env.SYNC_OWNER_USERNAMES || 'secondlifevintage41')
                       .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

function whopGrants(obj) {
    return !!(obj && (obj.valid === true || obj.has_access === true ||
        obj.status === 'active' || obj.status === 'trialing' ||
        (obj.access_level && obj.access_level !== 'no_access')));
}

// has_access mit dem User-Token (v2). true | false | null(unbestimmt: 401/403). 5xx → wirft.
async function whopHasAccessViaToken(userToken) {
    var sawOk = false;
    for (var i = 0; i < ACCESS_IDS.length; i++) {
        var r = await fetch('https://api.whop.com/api/v2/me/has_access/' + ACCESS_IDS[i], {
            headers: { 'Authorization': 'Bearer ' + userToken, 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(8000)
        });
        if (r.status === 401 || r.status === 403) return null;
        if (r.status >= 500) { var e = new Error('has_access HTTP ' + r.status); e.httpStatus = r.status; throw e; }
        if (!r.ok) continue;
        sawOk = true;
        var j = null; try { j = await r.json(); } catch (pe) { continue; }
        if (whopGrants(j) || whopGrants(j && j.data)) return true;
    }
    return sawOk ? false : null;
}

// Fallback: Company-Membership-Scan mit dem Company-API-Key. Paginiert, Seiten-Obergrenze.
async function whopHasAccessViaCompanyKey(userId) {
    var page = 1, MAX_PAGES = 20;
    while (page <= MAX_PAGES) {
        var r = await fetch('https://api.whop.com/v5/company/memberships?valid=true&per=50&page=' + page, {
            headers: { 'Authorization': 'Bearer ' + WHOP_API_KEY, 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(8000)
        });
        if (!r.ok) { var e = new Error('memberships HTTP ' + r.status); e.httpStatus = r.status; throw e; }
        var j = await r.json();
        var list = (j && j.data) || [];
        for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].user_id === userId && whopGrants(list[i])) return true;
        }
        var pg = j && j.pagination;
        if (!pg || !pg.next_page || list.length === 0) break;
        page = pg.next_page;
    }
    return false;
}

// Kombiniert: Token-Weg zuerst; sonst — falls Company-Key vorhanden — der Membership-Scan.
async function whopHasAccess(userToken, userId) {
    var t = await whopHasAccessViaToken(userToken);
    if (t === true) return true;
    if (WHOP_API_KEY) return await whopHasAccessViaCompanyKey(userId);
    if (t === false) return false;
    var e = new Error('access_undeterminable (no WHOP_API_KEY, token endpoint rejected user token)');
    e.httpStatus = 502; throw e;
}

var RATE_MAX     = 40;             // Requests pro Minute pro Nutzer (Push ist 6s-debounced, 40 deckt Firmenwechsel+Retries komfortabel)
var IP_RATE_MAX  = 60;             // Requests pro Minute pro IP, VOR dem teuren Whop-Call — bremst Kosten-Flood mit Müll-Tokens
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

    // ── 1b. IP-Rate-Limit VOR dem Whop-Call ──────────────────────────────────
    // Verhindert Kosten-/Quota-Amplification: Müll-Tokens dürfen nicht unbegrenzt
    // teure Whop-API-Calls auslösen, bevor die (userId-basierte) Prüfung in Schritt 4 greift.
    try {
        var ip      = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
        var ipRlKey = 'sync:iprl:' + ip;
        var ipCount = await redisCmd(['INCR', ipRlKey]);
        await redisCmd(['EXPIRE', ipRlKey, '60', 'NX']);
        if (ipCount > IP_RATE_MAX) return res.status(429).json({ error: 'rate_limited' });
    } catch (e) {
        console.error('[sync] ip-rate-limit error:', e);
        // nicht blockierend — weiter
    }

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

    // ── 3. Request-Grunddaten (Action früh gebraucht für Pro-Gate-Ausnahme) ───
    var body   = req.body || {};
    var action = body.action;
    var scope  = body.scope;

    // Grantee-Lese-Aktionen (Steuerberater): durch ein Grant autorisiert, KEIN eigenes
    // Pro-Abo nötig — der zahlende Mandant teilt seine Daten. Public-Key-Registrierung
    // ist harmlos (öffentlicher Schlüssel). pull mit owner-Param wird per Grant-Check gated.
    var GRANTEE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
    var isGranteeRead = (action === 'register_pubkey' || action === 'list_grants' ||
                         (action === 'pull' && !!body.owner));

    // Schreiben in fremde Owner-Daten ist NIE erlaubt (StB read-only) — vor dem Pro-Gate,
    // damit die Antwort 'readonly' ist, egal ob der StB selbst ein Abo hat.
    if ((action === 'push' || action === 'delete') && body.owner)
        return res.status(403).json({ error: 'readonly' });

    // ── 4. PRO erzwingen (server-seitig) — nur für Owner-/Schreib-Aktionen ────
    var isOwner = OWNERS.indexOf(username) !== -1;
    if (!isOwner && !isGranteeRead) {
        try {
            // Zugangs-Check: User-Token gegen /api/v2/me/has_access, sonst Company-Key-Fallback.
            if (!(await whopHasAccess(token, userId)))
                return res.status(403).json({ error: 'pro_required' });
        } catch (e) {
            console.error('[sync] access check failed:', e && e.message);
            return res.status(502).json({ error: 'whop_unreachable' });
        }
    }

    // ── 4b. Rate-Limit (KV-Counter, 60s-Fenster) ─────────────────────────────
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
    // scope nur für scope-gebundene Aktionen (pull/push/delete) verlangen;
    // pubkey-/grant-Aktionen brauchen keinen scope.
    var isScopeAction = (action === 'pull' || action === 'push' || action === 'delete');
    if (isScopeAction && !SCOPE_RE.test(String(scope || ''))) return res.status(400).json({ error: 'bad_scope' });

    var key = 'sync:' + userId + ':' + scope;

    try {
        if (action === 'pull') {
            var readKey = key;
            if (body.owner) {
                // Steuerberater liest fremden Mandanten-Scope → nur mit gültigem Grant (read-only)
                var ownerId = String(body.owner);
                if (!GRANTEE_ID_RE.test(ownerId)) return res.status(400).json({ error: 'bad_owner' });
                var grantChk = await redisCmd(['GET', 'grant:' + ownerId + ':' + userId]);
                if (!grantChk) return res.status(403).json({ error: 'no_grant' });
                readKey = 'sync:' + ownerId + ':' + scope;
            }
            var cur = await redisCmd(['GET', readKey]);
            return res.status(200).json({ ok: true, blob: cur ? JSON.parse(cur) : null });
        }

        if (action === 'push') {
            // Grantee (StB) ist strikt read-only: nie in fremde Owner-Keys schreiben
            if (body.owner) return res.status(403).json({ error: 'readonly' });
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

        // ── Steuerberater-Freigabe (Envelope-Key, siehe js/stb-share.js) ──────
        // Öffentlichen Schlüssel registrieren (idempotent). Kein Geheimnis.
        if (action === 'register_pubkey') {
            if (!body.pub || typeof body.pub !== 'object') return res.status(400).json({ error: 'bad_payload' });
            var pubStr = JSON.stringify({ pub: body.pub, username: username, updatedAt: Date.now() });
            if (pubStr.length > 4096) return res.status(413).json({ error: 'too_large' });
            await redisCmd(['SET', 'pubkey:' + userId, pubStr]);
            return res.status(200).json({ ok: true });
        }

        // Owner holt den Public-Key des einzuladenden StB (zum Wrappen des Datenschlüssels)
        if (action === 'get_pubkey') {
            var gidP = String(body.granteeId || '');
            if (!GRANTEE_ID_RE.test(gidP)) return res.status(400).json({ error: 'bad_grantee' });
            var pk = await redisCmd(['GET', 'pubkey:' + gidP]);
            if (!pk) return res.status(404).json({ error: 'no_pubkey' });
            return res.status(200).json({ ok: true, pubkey: JSON.parse(pk) });
        }

        // Owner erteilt Grant: verpackter Datenschlüssel (Envelope) für den StB ablegen
        if (action === 'grant') {
            var gidG = String(body.granteeId || '');
            if (!GRANTEE_ID_RE.test(gidG)) return res.status(400).json({ error: 'bad_grantee' });
            if (!body.envelope || typeof body.envelope !== 'object') return res.status(400).json({ error: 'bad_payload' });
            var envStr = JSON.stringify(body.envelope);
            if (envStr.length > 8192) return res.status(413).json({ error: 'too_large' });
            var grantVal = JSON.stringify({ role: 'readonly', envelope: body.envelope, ownerName: username, createdAt: Date.now() });
            await redisCmd(['SET', 'grant:' + userId + ':' + gidG, grantVal]);
            await redisCmd(['SADD', 'grantsfor:' + gidG, userId]);
            return res.status(200).json({ ok: true });
        }

        // Owner entzieht Grant (echter Revoke; Owner sollte danach re-keyen)
        if (action === 'revoke') {
            var gidR = String(body.granteeId || '');
            if (!GRANTEE_ID_RE.test(gidR)) return res.status(400).json({ error: 'bad_grantee' });
            await redisCmd(['DEL', 'grant:' + userId + ':' + gidR]);
            await redisCmd(['SREM', 'grantsfor:' + gidR, userId]);
            return res.status(200).json({ ok: true });
        }

        // StB listet alle Mandanten, die ihm Zugriff gewährt haben (+ Envelope zum Entpacken)
        if (action === 'list_grants') {
            var owners = (await redisCmd(['SMEMBERS', 'grantsfor:' + userId])) || [];
            var grants = [];
            for (var i = 0; i < owners.length; i++) {
                var g = await redisCmd(['GET', 'grant:' + owners[i] + ':' + userId]);
                if (g) { var go = JSON.parse(g); grants.push({ ownerId: owners[i], ownerName: go.ownerName || '', role: go.role, envelope: go.envelope }); }
            }
            return res.status(200).json({ ok: true, grants: grants });
        }

        return res.status(400).json({ error: 'bad_action' });
    } catch (e) {
        console.error('[sync] storage error:', e);
        return res.status(500).json({ error: 'storage_error' });
    }
};
