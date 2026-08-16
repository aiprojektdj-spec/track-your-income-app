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
//   purge  — löscht ALLE Anhänge des aufrufenden Nutzers (Gegenstück zu sync.js reset_all,
//            wenn die URLs nur noch im unlesbaren Snapshot standen).
//
// Env: BLOB_READ_WRITE_TOKEN (Vercel-Blob-Store-Integration, automatisch gesetzt)
//      + dieselben WHOP_*/KV_REST_API_*-Variablen wie api/sync.js (Auth + Rate-Limit).
//      BLOB_MAX_BYTES             (optional, Default 10 GB — Byte-Budget je Nutzer und Fenster)
//      BLOB_BUDGET_WINDOW_SEC     (optional, Default 2592000 = 30 Tage)
//      ALERT_WEBHOOK_URL          (optional — Meldung bei offenem Deckel, s. api/_alert.js)
//      SYNC_OWNER_IDS             (optional — Whop-User-IDs "user_…" der Owner ohne Abo)
// =============================================================================
var { put, del, list } = require('@vercel/blob');

var REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '';
var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

// Meldet stillschweigende Degradierung (offener Deckel) an ALERT_WEBHOOK_URL, siehe api/_alert.js
var alertOps = require('./_alert.js').alertOps;

// ── Auth: identisch zu api/sync.js (bewusst dupliziert, siehe dortiger Kommentar) ──
var ACCESS_IDS   = (process.env.WHOP_ACCESS_IDS || 'prod_wgVmaJg4sBVOD,prod_p1WHi5t65rAA6,biz_2OEWYGlOwb8b0f')
                       .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
var WHOP_API_KEY = process.env.WHOP_API_KEY || '';
// Owner-Bypass: Vergleich gegen die UNVERÄNDERLICHE Whop-User-ID (me.sub, "user_…") aus
// SYNC_OWNER_IDS. Der Namensweg war umgehbar (Fund R3, Red-Team-Audit 2026-08-10): `username`
// entstand als `me.preferred_username || me.name || …`, und `me.name` ist der ANZEIGENAME —
// frei wählbar, nicht eindeutig. Solange SYNC_OWNER_IDS leer ist, gilt weiter die Namensliste,
// aber NUR gegen preferred_username (eindeutig), nie gegen den Anzeigenamen.
// Identische Logik in api/sync.js und api/whop-access.js (eigenständige Funktionen).
var OWNER_IDS    = (process.env.SYNC_OWNER_IDS || '')
                       .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
var OWNERS       = (process.env.SYNC_OWNER_USERNAMES || 'secondlifevintage41')
                       .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

function isOwnerIdentity(sub, prefUsername) {
    if (OWNER_IDS.length) return !!sub && OWNER_IDS.indexOf(sub) !== -1;
    return !!prefUsername && OWNERS.indexOf(prefUsername) !== -1;
}

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
// Realistischer Deckel statt willkürlicher 4000: mehr Chunks als für MAX_TOTAL_BYTES nötig
// sind nur für einen DoS-Versuch (viele sequentielle Fetches) gut, nicht für legitime Uploads.
var MAX_CHUNKS_PER_COMMIT = Math.ceil(MAX_TOTAL_BYTES / MAX_CHUNK) + 8; // 200MB/4MB=50 → 58
var BLOB_HOST_RE     = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;

// ── Byte-Budget pro Nutzer (Fund R6, Red-Team-Audit 2026-08-10) ──────────────────────────
// RATE_MAX=120 Requests/Minute à MAX_CHUNK=4 MB sind 480 MB/Minute ≈ 28 GB/Stunde pro
// zahlendem Account. MAX_TOTAL_BYTES deckelt nur EINE zusammengesetzte Datei (200 MB), nicht
// die Summe — und api/blob-cleanup.js räumt ausschließlich stackr/tmp/, mit action=put
// hochgeladene Anhänge bleiben dauerhaft liegen.
//
// Deshalb ein gleitendes Fenster statt eines Lebenszeit-Kontos: ein Lebenszeit-Deckel ohne
// Gegenbuchung beim Löschen würde einen echten Vielnutzer irgendwann dauerhaft aussperren, und
// eine Gegenbuchung gibt es nicht, weil Anhänge nie automatisch gelöscht werden. 10 GB in
// 30 Tagen ist für eine Belegverwaltung sehr großzügig und begrenzt den Angreifer von
// ~670 GB/Tag auf 10 GB/Monat.
//
// Gezählt werden put und chunk, also die tatsächlich durch die API geschobenen Bytes. commit
// zählt NICHT mit: die zusammengesetzte Datei ist genau die Summe der Chunks, die schon
// gezählt wurden — sonst wäre jeder Chunk-Upload doppelt gebucht.
//
// action=delete schreibt dem Budget NICHTS zurück, obwohl es verlockend wäre: bei einem
// gleitenden Fenster wäre das ein Bypass. Wer 10 GB hochlädt, 30 Tage wartet (Zähler ist per
// TTL weg) und dann löscht, hätte einen Zähler von -10 GB und damit das doppelte Budget.
// Das Fenster selbst gibt das Budget ohnehin zurück, eine Gegenbuchung ist unnötig.
var BLOB_BUDGET_BYTES  = parseInt(process.env.BLOB_MAX_BYTES || String(10 * 1024 * 1024 * 1024), 10);
var BLOB_BUDGET_WINDOW = parseInt(process.env.BLOB_BUDGET_WINDOW_SEC || '2592000', 10); // 30 Tage

// Bucht `bytes` auf das Budget. Rückgabe false = Deckel erreicht, dann wird die Buchung
// zurückgenommen, damit ein abgelehnter Upload kein Budget verbraucht.
// Redis-Fehler lassen den Upload durch (fail-open, wie das bestehende Rate-Limit hier und in
// api/sync.js): ein Redis-Ausfall darf keinen zahlenden Kunden am Arbeiten hindern.
async function chargeBlobBudget(userId, bytes) {
    if (!REDIS_URL || !REDIS_TOKEN) {
        await alertOps('blob-upload', 'redis-env-missing',
            'Byte-Budget und Rate-Limit sind ohne Redis-Env komplett aus');
        return true;
    }
    var key = 'blob:bytes:' + userId;
    try {
        var total = await redisCmd(['INCRBY', key, String(bytes)]);
        await redisCmd(['EXPIRE', key, String(BLOB_BUDGET_WINDOW), 'NX']);
        if (Number(total) <= BLOB_BUDGET_BYTES) return true;
        await redisCmd(['DECRBY', key, String(bytes)]);
        return false;
    } catch (e) {
        // fail-open — der Byte-Deckel ist damit fuer diesen Upload weg
        await alertOps('blob-upload', 'byte-budget-open', e && e.message);
        return true;
    }
}

function pathFor(userId, scope, kind, name) {
    return 'stackr/' + kind + '/' + userId + '/' + scope + '/' + name;
}
function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
// Eigentumsprüfung: eine Blob-URL darf nur committed/gelöscht werden, wenn ihr Pfad
// exakt zum Namespace (Host + stackr/<kind>/<userId>/<scope>/) des aufrufenden,
// authentifizierten Nutzers gehört — nie allein aus der Client-URL selbst ableiten.
function isOwnedBlobUrl(u, userId, scope) {
    if (typeof u !== 'string' || !BLOB_HOST_RE.test(u)) return false;
    var pathname;
    try { pathname = new URL(u).pathname; } catch (e) { return false; }
    var prefixRe = new RegExp('^/stackr/(?:attachments|tmp)/' + escapeRegex(userId) + '/' + escapeRegex(scope) + '/');
    return prefixRe.test(pathname);
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

    // Kein Anzeigename-Fallback: prefUsername ist ausschließlich me.preferred_username, weil der
    // Wert in die Owner-Entscheidung eingeht (s. isOwnerIdentity). Anderweitig wird er nicht
    // gebraucht — dieser Endpunkt zeigt keinen Namen an.
    var userId, prefUsername;
    try {
        var meRes = await fetch('https://api.whop.com/oauth/userinfo', {
            headers: { 'Authorization': 'Bearer ' + token }, signal: AbortSignal.timeout(8000)
        });
        if (!meRes.ok) return res.status(401).json({ error: 'invalid_token' });
        var me = await meRes.json();
        userId = me.sub || me.id;
        prefUsername = me.preferred_username || '';
        if (!userId) return res.status(401).json({ error: 'no_user' });
    } catch (e) {
        console.error('[blob-upload] userinfo failed:', e);
        return res.status(502).json({ error: 'whop_unreachable' });
    }

    var isOwner = isOwnerIdentity(userId, prefUsername);
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
        } catch (e) {
            // nicht blockierend — weiter, aber der Nutzer-Deckel ist damit offen
            await alertOps('blob-upload', 'rate-limit-open', e && e.message);
        }
    } else {
        await alertOps('blob-upload', 'redis-env-missing',
            'Byte-Budget und Rate-Limit sind ohne Redis-Env komplett aus');
    }

    var action = String(req.query && req.query.action || '');
    var scope  = String(req.query && req.query.scope || '');

    try {
        if (action === 'put' || action === 'chunk') {
            if (!SCOPE_RE.test(scope)) return res.status(400).json({ error: 'bad_scope' });
            var body = req.body;
            if (!Buffer.isBuffer(body)) return res.status(400).json({ error: 'bad_payload' });
            if (body.length > MAX_CHUNK) return res.status(413).json({ error: 'too_large', maxChunk: MAX_CHUNK });

            // Budget VOR dem put() buchen — danach liegt das Objekt schon im Blob-Store und
            // kostet, auch wenn wir die Antwort ablehnen (Fund R6).
            if (!(await chargeBlobBudget(userId, body.length))) {
                return res.status(507).json({ error: 'storage_budget', maxBytes: BLOB_BUDGET_BYTES,
                                              windowSec: BLOB_BUDGET_WINDOW });
            }

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
            if (!chunkUrls.length || chunkUrls.length > MAX_CHUNKS_PER_COMMIT) return res.status(400).json({ error: 'bad_chunks' });
            var finalName = String(b.name || 'f').replace(/[^a-zA-Z0-9_.-]/g, '');
            if (!finalName) return res.status(400).json({ error: 'bad_name' });

            // Eigentumsprüfung: jede Chunk-URL muss ein temporäres Chunk-Objekt
            // DIESES Nutzers/Scopes sein — nie fremde/erratene Blob-URLs blind fetchen.
            for (var i0 = 0; i0 < chunkUrls.length; i0++) {
                if (!isOwnedBlobUrl(chunkUrls[i0], userId, scope)) return res.status(403).json({ error: 'not_owner', index: i0 });
            }

            // Concurrency-Deckel pro Nutzer: verhindert, dass ein einzelner Account viele
            // parallele 200-MB-Commits anstößt (Ressourcen-/Kosten-DoS trotz Rate-Limit).
            var lockKey = 'blob:commitlock:' + userId, lockHeld = false;
            if (REDIS_URL && REDIS_TOKEN) {
                try {
                    var lockRes = await redisCmd(['SET', lockKey, '1', 'NX', 'EX', '30']);
                    if (!lockRes) return res.status(429).json({ error: 'commit_busy' });
                    lockHeld = true;
                } catch (e) { console.warn('[blob-upload] lock error:', e && e.message); }
            }

            try {
                var parts = [], total = 0;
                for (var i = 0; i < chunkUrls.length; i++) {
                    var u = String(chunkUrls[i] || '');
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
            } finally {
                if (lockHeld) { try { await redisCmd(['DEL', lockKey]); } catch (e) { /* TTL räumt ohnehin nach 30s auf */ } }
            }
        }

        if (action === 'delete') {
            if (!SCOPE_RE.test(scope)) return res.status(400).json({ error: 'bad_scope' });
            var bd = req.body || {};
            var rawUrls = Array.isArray(bd.urls) ? bd.urls : [];
            if (!rawUrls.length) return res.status(200).json({ ok: true, deleted: 0 });
            if (rawUrls.length > 500) return res.status(400).json({ error: 'too_many' });
            // Löschberechtigung folgt NIE allein aus der Client-URL: jede URL muss zum
            // Namespace des authentifizierten Nutzers/Scopes gehören.
            for (var j = 0; j < rawUrls.length; j++) {
                if (!isOwnedBlobUrl(rawUrls[j], userId, scope)) return res.status(403).json({ error: 'not_owner', index: j });
            }
            await del(rawUrls, { token: process.env.BLOB_READ_WRITE_TOKEN });
            return res.status(200).json({ ok: true, deleted: rawUrls.length });
        }

        // Gegenstück zu api/sync.js action=reset_all: wenn die Cloud-Snapshots verworfen
        // werden, weil sie mit keinem vorhandenen Schlüssel mehr lesbar sind, kennt
        // niemand mehr die URLs der ausgelagerten Anhänge — die standen ausschließlich IM
        // Chiffrat. Ohne diesen Pfad blieben sie für immer im Blob-Store liegen
        // (api/blob-cleanup.js räumt nur stackr/tmp/, nie stackr/attachments/).
        // Gelöscht wird ausschließlich der eigene Namespace stackr/attachments/<userId>/ —
        // userId stammt aus dem server-seitig validierten Token, nie aus dem Request-Body.
        if (action === 'purge') {
            var prefix = 'stackr/attachments/' + userId + '/';
            var cursor, removed = 0, pages = 0;
            do {
                var page = await list({ prefix: prefix, cursor: cursor, limit: 1000, token: process.env.BLOB_READ_WRITE_TOKEN });
                var urls = (page.blobs || []).map(function (b) { return b.url; });
                if (urls.length) { await del(urls, { token: process.env.BLOB_READ_WRITE_TOKEN }); removed += urls.length; }
                cursor = page.hasMore ? page.cursor : undefined;
            } while (cursor && ++pages < 50);   // Seiten-Deckel: 50.000 Objekte reichen weit über jeden realen Bestand
            return res.status(200).json({ ok: true, deleted: removed });
        }

        return res.status(400).json({ error: 'bad_action' });
    } catch (e) {
        console.error('[blob-upload] error:', e && e.message);
        return res.status(500).json({ error: 'storage_error' });
    }
};
