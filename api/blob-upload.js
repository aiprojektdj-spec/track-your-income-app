// Vercel Serverless Function — Objektspeicher für große Sync-Anhänge (Vercel Blob)
// =============================================================================
// Löst das Vercel-Hardlimit von 4,5 MB Function-Body: statt große Base64-Felder
// (Rechnungslogo, Eigenbeleg-Foto/-PDF, überlange Ledger-Chiffrate) inline im
// EINEN Redis-Blob von api/sync.js zu synchronisieren, werden sie hier als
// eigene Objekte abgelegt — der Server sieht auch hier NUR Chiffrat (Client
// verschlüsselt vor dem Upload mit demselben Sync-Schlüssel wie api/sync.js).
//
// Transport-Chunking: der 4,5-MB-Body-Deckel gilt PRO REQUEST, nicht pro Datei.
// Größere Anhänge gehen über mehrere 'chunk'-Requests (roh, kein Base64/JSON-
// Overhead) + einen abschließenden 'commit', der die Teile server-seitig zu
// einem finalen Blob zusammenfügt. Ergebnis: Anhang-/Ledger-Größe ist nur noch
// durch MAX_TOTAL_BYTES begrenzt, nicht durch die Transport-Chunkgröße.
//
// Aktionen (Query-Param ?action=):
//   put    — Body = rohe Chiffrat-Bytes (≤ MAX_CHUNK). Direkter Upload, 1 Request.
//   chunk  — Body = ein Teilstück (≤ MAX_CHUNK). Antwort enthält die Blob-URL des Teils.
//   commit — JSON {chunkUrls:[...]} — fügt Teile zu einem finalen Blob zusammen, löscht die Teile.
//   delete — JSON {urls:[...]} — löscht ein oder mehrere Blob-Objekte (Ersetzen/Art.17 DSGVO).
//
// Env: BLOB_READ_WRITE_TOKEN (Vercel-Blob-Store-Integration, automatisch gesetzt)
//      + dieselben WHOP_*/KV_REST_API_*-Variablen wie api/sync.js (Auth + Rate-Limit).
// =============================================================================
var { put, del } = require('@vercel/blob');

var REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '';
var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

// ── Auth: identisch zu api/sync.js (bewusst dupliziert, siehe dortiger Kommentar) ──
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
async function whopHasAccessViaToken(userToken) {
    var results = await Promise.all(ACCESS_IDS.map(function (id) {
        return fetch('https://api.whop.com/api/v2/me/has_access/' + id, {
            headers: { 'Authorization': 'Bearer ' + userToken, 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(8000)
        }).then(async function (r) {
            if (r.status >= 500) { var e = new Error('has_access HTTP ' + r.status); e.httpStatus = r.status; throw e; }
            if (r.status === 401 || r.status === 403) return 'reject';
            if (!r.ok) return 'skip';
            var j = null; try { j = await r.json(); } catch (pe) { return 'skip'; }
            return (whopGrants(j) || whopGrants(j && j.data)) ? 'grant' : 'ok';
        });
    }));
    if (results.indexOf('grant') !== -1) return true;
    return results.indexOf('ok') !== -1 ? false : null;
}
async function whopHasAccessViaCompanyKey(userId) {
    var page = 1, MAX_PAGES = 200;
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
async function whopHasAccess(userToken, userId) {
    var t = await whopHasAccessViaToken(userToken);
    if (t === true) return true;
    if (WHOP_API_KEY) return await whopHasAccessViaCompanyKey(userId);
    if (t === false) return false;
    var e = new Error('access_undeterminable'); e.httpStatus = 502; throw e;
}

function redisCmd(cmd) {
    return fetch(REDIS_URL, {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd), signal: AbortSignal.timeout(8000)
    }).then(function (r) { return r.json(); }).then(function (j) { return j ? j.result : null; });
}

// ── Limits ───────────────────────────────────────────────────────────────
var MAX_CHUNK       = 4 * 1024 * 1024;    // pro Request, Sicherheitsmarge unter Vercels 4,5-MB-Hardlimit
var MAX_TOTAL_BYTES  = 200 * 1024 * 1024; // Deckel je Anhang/Ledger-Blob (großzügig, aber nicht unbegrenzt — s. Chat)
var RATE_MAX         = 120;               // Requests/Minute/Nutzer — Chunk-Uploads brauchen mehr als sync.js' 40
var SCOPE_RE         = /^(__account|co_[a-z0-9_]+)$/;

function pathFor(userId, scope, kind, name) {
    return 'stackr/' + kind + '/' + userId + '/' + scope + '/' + name;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://track-your-income-app.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'method_not_allowed' });

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        console.error('[blob-upload] BLOB_READ_WRITE_TOKEN nicht gesetzt');
        return res.status(500).json({ error: 'server_misconfigured' });
    }

    var auth  = req.headers['authorization'] || '';
    var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : '';
    if (!token || token.length > 4096) return res.status(401).json({ error: 'no_token' });

    var userId, username;
    try {
        var meRes = await fetch('https://api.whop.com/oauth/userinfo', {
            headers: { 'Authorization': 'Bearer ' + token }, signal: AbortSignal.timeout(8000)
        });
        if (!meRes.ok) return res.status(401).json({ error: 'invalid_token' });
        var me = await meRes.json();
        userId = me.sub || me.id;
        username = me.preferred_username || me.name || me.username || '';
        if (!userId) return res.status(401).json({ error: 'no_user' });
    } catch (e) {
        console.error('[blob-upload] userinfo failed:', e);
        return res.status(502).json({ error: 'whop_unreachable' });
    }

    var isOwner = OWNERS.indexOf(username) !== -1;
    if (!isOwner) {
        try {
            if (!(await whopHasAccess(token, userId))) return res.status(403).json({ error: 'pro_required' });
        } catch (e) {
            console.error('[blob-upload] access check failed:', e && e.message);
            return res.status(502).json({ error: 'whop_unreachable' });
        }
    }

    // Rate-Limit (best-effort, wie sync.js — Redis-Fehler blockieren den Upload nicht)
    if (REDIS_URL && REDIS_TOKEN) {
        try {
            var rlKey = 'blob:rl:' + userId;
            var count = await redisCmd(['INCR', rlKey]);
            await redisCmd(['EXPIRE', rlKey, '60', 'NX']);
            if (count > RATE_MAX) return res.status(429).json({ error: 'rate_limited' });
        } catch (e) { console.error('[blob-upload] rate-limit error:', e); }
    }

    var action = String(req.query && req.query.action || '');
    var scope  = String(req.query && req.query.scope || '');

    try {
        if (action === 'put' || action === 'chunk') {
            if (!SCOPE_RE.test(scope)) return res.status(400).json({ error: 'bad_scope' });
            var body = req.body;
            if (!Buffer.isBuffer(body)) return res.status(400).json({ error: 'bad_payload' });
            if (body.length > MAX_CHUNK) return res.status(413).json({ error: 'too_large', maxChunk: MAX_CHUNK });

            var kind = action === 'chunk' ? 'tmp' : 'attachments';
            var name = action === 'chunk'
                ? String(req.query.uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '') + '/' + String(parseInt(req.query.index, 10) || 0)
                : String(req.query.name || 'f').replace(/[^a-zA-Z0-9_.-]/g, '');
            if (!name) return res.status(400).json({ error: 'bad_name' });

            var blob = await put(pathFor(userId, scope, kind, name), body, {
                access: 'public', addRandomSuffix: true, contentType: 'application/octet-stream',
                token: process.env.BLOB_READ_WRITE_TOKEN
            });
            return res.status(200).json({ ok: true, url: blob.url });
        }

        if (action === 'commit') {
            if (!SCOPE_RE.test(scope)) return res.status(400).json({ error: 'bad_scope' });
            var b = req.body || {};
            var chunkUrls = Array.isArray(b.chunkUrls) ? b.chunkUrls : [];
            if (!chunkUrls.length || chunkUrls.length > 4000) return res.status(400).json({ error: 'bad_chunks' }); // Deckel ~ MAX_TOTAL_BYTES/MAX_CHUNK
            var finalName = String(b.name || 'f').replace(/[^a-zA-Z0-9_.-]/g, '');
            if (!finalName) return res.status(400).json({ error: 'bad_name' });

            // ponytail: Host auf Vercel-Blob-Storage eingeschraenkt (nicht nur https://) —
            // sonst SSRF, da chunkUrls vom Client kommen und der Server sie blind fetcht.
            var BLOB_HOST_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
            var parts = [], total = 0;
            for (var i = 0; i < chunkUrls.length; i++) {
                var u = String(chunkUrls[i] || '');
                if (!BLOB_HOST_RE.test(u)) return res.status(400).json({ error: 'bad_chunk_url' });
                var r = await fetch(u, { signal: AbortSignal.timeout(15000) });
                if (!r.ok) return res.status(502).json({ error: 'chunk_fetch_failed', index: i });
                var buf = Buffer.from(await r.arrayBuffer());
                total += buf.length;
                if (total > MAX_TOTAL_BYTES) return res.status(413).json({ error: 'too_large', maxTotal: MAX_TOTAL_BYTES });
                parts.push(buf);
            }
            var assembled = Buffer.concat(parts, total);
            var finalBlob = await put(pathFor(userId, scope, 'attachments', finalName), assembled, {
                access: 'public', addRandomSuffix: true, contentType: 'application/octet-stream',
                token: process.env.BLOB_READ_WRITE_TOKEN
            });
            // Best-effort: temporäre Teile aufräumen (Fehler hier sind nicht kritisch — Cron räumt Reste)
            try { await del(chunkUrls, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch (e) { console.warn('[blob-upload] chunk cleanup failed:', e && e.message); }
            return res.status(200).json({ ok: true, url: finalBlob.url, size: total });
        }

        if (action === 'delete') {
            var bd = req.body || {};
            var urls = Array.isArray(bd.urls) ? bd.urls.filter(function (u) { return typeof u === 'string' && u.indexOf('https://') === 0; }) : [];
            if (!urls.length) return res.status(200).json({ ok: true, deleted: 0 });
            if (urls.length > 500) return res.status(400).json({ error: 'too_many' });
            await del(urls, { token: process.env.BLOB_READ_WRITE_TOKEN });
            return res.status(200).json({ ok: true, deleted: urls.length });
        }

        return res.status(400).json({ error: 'bad_action' });
    } catch (e) {
        console.error('[blob-upload] error:', e && e.message);
        return res.status(500).json({ error: 'storage_error' });
    }
};
