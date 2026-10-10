// Vercel Serverless Function — Objektspeicher für große Sync-Anhänge
// (Vercel Blob oder Supabase Storage, siehe api/_storage.js)
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
//   sign   — JSON {urls:[...], owner?} — kurzlebige Abruf-URLs für Anhänge. Mit owner liest
//            ein Steuerberater die Anhänge eines Mandanten; nur mit Grant, ohne eigenes Abo.
//
// Env: BLOB_BACKEND (vercel|supabase, s. api/_storage.js)
//      BLOB_READ_WRITE_TOKEN (Vercel-Blob-Store-Integration) bzw. SUPABASE_* (api/_db.js)
//      + dieselben WHOP_*-Variablen wie api/sync.js (Auth). Rate-Limit, Byte-Budget und
//      Commit-Sperre laufen ueber api/_sync-store.js und folgen STORAGE_BACKEND (redis|supabase).
//      BLOB_MAX_BYTES             (optional, Default 1 GB — Byte-Budget je Nutzer und Fenster)
//      BLOB_BUDGET_WINDOW_SEC     (optional, Default 2592000 = 30 Tage)
//      ALERT_WEBHOOK_URL          (optional — Meldung bei offenem Deckel, s. api/_alert.js)
//      SYNC_OWNER_IDS             (optional — Whop-User-IDs "user_…" der Owner ohne Abo)
// =============================================================================
// Meldet stillschweigende Degradierung (offener Deckel) an ALERT_WEBHOOK_URL, siehe api/_alert.js
var alertOps = require('./_alert.js').alertOps;
var _log     = require('./_log.js');
var storage  = require('./_storage.js');
var store    = require('./_sync-store.js');   // Grant-Check (sign), Rate-Limit, Byte-Budget, Commit-Sperre
var setzeCorsOrigin = require('./_cors.js');

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
// Kein hart kodierter Default mehr (Fund R3, geschlossen 2026-08-23): frueher stand hier
// || 'secondlifevintage41'. Der Name lebte damit im Quelltext weiter, auch ohne gesetzte
// Variable — wer sich den Namen bei Whop sicherte, bekam Owner-Rechte ohne Abo. Jetzt
// faellt der Namensweg ohne ausdrueckliche Konfiguration auf eine LEERE Liste zurueck:
// im Zweifel kein Owner statt eines erratbaren Owners.
var OWNERS       = (process.env.SYNC_OWNER_USERNAMES || '')
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

// ── Limits ───────────────────────────────────────────────────────────────
var MAX_CHUNK       = 4 * 1024 * 1024;    // pro Request, Sicherheitsmarge unter Vercels 4,5-MB-Hardlimit
var MAX_TOTAL_BYTES  = 200 * 1024 * 1024; // Deckel je Anhang/Ledger-Blob (großzügig, aber nicht unbegrenzt — s. Chat)
var RATE_MAX         = 120;               // Requests/Minute/Nutzer — Chunk-Uploads brauchen mehr als sync.js' 40
var SCOPE_RE         = /^(__account|co_[a-z0-9_]+)$/;
// Realistischer Deckel statt willkürlicher 4000: mehr Chunks als für MAX_TOTAL_BYTES nötig
// sind nur für einen DoS-Versuch (viele sequentielle Fetches) gut, nicht für legitime Uploads.
var MAX_CHUNKS_PER_COMMIT = Math.ceil(MAX_TOTAL_BYTES / MAX_CHUNK) + 8; // 200MB/4MB=50 → 58
var MAX_SIGN         = 200;               // Referenzen je sign-Request (ein Scope-Pull bündelt alle)
var GRANTEE_ID_RE    = /^[A-Za-z0-9_-]{1,128}$/;

// ── Byte-Budget pro Nutzer (Fund R6, Red-Team-Audit 2026-08-10) ──────────────────────────
// RATE_MAX=120 Requests/Minute à MAX_CHUNK=4 MB sind 480 MB/Minute ≈ 28 GB/Stunde pro
// zahlendem Account. MAX_TOTAL_BYTES deckelt nur EINE zusammengesetzte Datei (200 MB), nicht
// die Summe — und api/blob-cleanup.js räumt ausschließlich stackr/tmp/, mit action=put
// hochgeladene Anhänge bleiben dauerhaft liegen.
//
// Deshalb ein gleitendes Fenster statt eines Lebenszeit-Kontos: ein Lebenszeit-Deckel ohne
// Gegenbuchung beim Löschen würde einen echten Vielnutzer irgendwann dauerhaft aussperren, und
// eine Gegenbuchung gibt es nicht, weil Anhänge nie automatisch gelöscht werden. 1 GB in
// 30 Tagen reicht für eine Belegverwaltung und begrenzt den Angreifer von ~670 GB/Tag auf
// 1 GB/Monat. Am 2026-10-04 von 10 GB gesenkt (Seiten-Check B8); wer mehr braucht, bekommt
// es per BLOB_MAX_BYTES.
//
// Gezählt werden put und chunk, also die tatsächlich durch die API geschobenen Bytes. commit
// zählt NICHT mit: die zusammengesetzte Datei ist genau die Summe der Chunks, die schon
// gezählt wurden — sonst wäre jeder Chunk-Upload doppelt gebucht.
//
// action=delete schreibt dem Budget NICHTS zurück, obwohl es verlockend wäre: bei einem
// gleitenden Fenster wäre das ein Bypass. Wer 10 GB hochlädt, 30 Tage wartet (Zähler ist per
// TTL weg) und dann löscht, hätte einen Zähler von -10 GB und damit das doppelte Budget.
// Das Fenster selbst gibt das Budget ohnehin zurück, eine Gegenbuchung ist unnötig.
var BLOB_BUDGET_BYTES  = parseInt(process.env.BLOB_MAX_BYTES || String(1 * 1024 * 1024 * 1024), 10);
var BLOB_BUDGET_WINDOW = parseInt(process.env.BLOB_BUDGET_WINDOW_SEC || '2592000', 10); // 30 Tage

// Bucht `bytes` auf das Budget. Rückgabe false = Deckel erreicht, dann wird die Buchung
// zurückgenommen, damit ein abgelehnter Upload kein Budget verbraucht.
// Speicher-Fehler lassen den Upload durch (fail-open, wie das bestehende Rate-Limit hier und
// in api/sync.js): ein Ausfall darf keinen zahlenden Kunden am Arbeiten hindern.
// Das Fenster setzt nur die erste Buchung (Redis: EXPIRE … NX, Supabase: sync_counter_add).
async function chargeBlobBudget(userId, bytes) {
    var problem = store.configProblem();
    if (problem) {
        await alertOps('blob-upload', (store.backendName() || 'store') + '-env-missing',
            'Byte-Budget und Rate-Limit sind komplett aus: ' + problem);
        return true;
    }
    var key = 'blob:bytes:' + userId;
    try {
        var total = await store.counterAdd(key, bytes, BLOB_BUDGET_WINDOW);
        if (Number(total) <= BLOB_BUDGET_BYTES) return true;
        await store.counterAdd(key, -bytes, BLOB_BUDGET_WINDOW);
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
// Eigentumsprüfung: eine Referenz darf nur committed/gelöscht werden, wenn ihr Objekt-
// schlüssel exakt zum Namespace (stackr/<kind>/<userId>/<scope>/) des aufrufenden,
// authentifizierten Nutzers gehört — nie allein aus der Client-URL selbst ableiten.
// storage.keyOf akzeptiert nur Vercel-Blob-Hosts und sb:-Referenzen.
function isOwnedBlobUrl(u, userId, scope) {
    var key = storage.keyOf(u);
    if (!key) return false;
    var prefixRe = new RegExp('^stackr/(?:attachments|tmp)/' + escapeRegex(userId) + '/' + escapeRegex(scope) + '/');
    return prefixRe.test(key);
}
// Für sign: nur fertige Anhänge (nie tmp/) des Ziel-Nutzers, beliebiger gültiger Scope.
function isReadableRef(u, targetId) {
    var key = storage.keyOf(u);
    if (!key) return false;
    return new RegExp('^stackr/attachments/' + escapeRegex(targetId) + '/(?:__account|co_[a-z0-9_]+)/').test(key);
}

module.exports = async function handler(req, res) {
    setzeCorsOrigin(req, res);  // getstackr.de und alte Adresse, s. api/_cors.js
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'method_not_allowed' });

    var storageProblem = storage.configProblem();
    if (storageProblem) {
        _log.logError('blob-upload', 'STORAGE_ENV_MISSING', storageProblem);
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
        _log.logError('blob-upload', 'WHOP_USERINFO_FAILED', e);
        return res.status(502).json({ error: 'whop_unreachable' });
    }

    var action = String(req.query && req.query.action || '');
    var scope  = String(req.query && req.query.scope || '');

    // Steuerberater liest Anhänge eines Mandanten: durch den Grant autorisiert, kein eigenes
    // Abo nötig — wie pull mit owner in api/sync.js. Der Grant wird unten geprüft.
    var signOwner   = action === 'sign' && req.body && req.body.owner ? String(req.body.owner) : '';
    if (signOwner === userId) signOwner = '';   // eigene Anhänge: normaler Weg mit Pro-Pflicht
    var isOwner = isOwnerIdentity(userId, prefUsername);
    if (!isOwner && !signOwner) {
        try {
            if (!(await whopHasAccess(token, userId))) return res.status(403).json({ error: 'pro_required' });
        } catch (e) {
            _log.logError('blob-upload', 'WHOP_ACCESS_CHECK_FAILED', e);
            return res.status(502).json({ error: 'whop_unreachable' });
        }
    }

    // Rate-Limit (best-effort, wie sync.js — Speicher-Fehler blockieren den Upload nicht)
    var rlProblem = store.configProblem();
    if (!rlProblem) {
        try {
            var count = await store.rateHit('blob:rl:' + userId, 60);
            if (count > RATE_MAX) return res.status(429).json({ error: 'rate_limited' });
        } catch (e) {
            // nicht blockierend — weiter, aber der Nutzer-Deckel ist damit offen
            await alertOps('blob-upload', 'rate-limit-open', e && e.message);
        }
    } else {
        await alertOps('blob-upload', (store.backendName() || 'store') + '-env-missing',
            'Byte-Budget und Rate-Limit sind komplett aus: ' + rlProblem);
    }

    try {
        if (action === 'sign') {
            var sb = req.body || {};
            var refs = Array.isArray(sb.urls) ? sb.urls : [];
            if (!refs.length) return res.status(200).json({ ok: true, urls: [] });
            if (refs.length > MAX_SIGN) return res.status(400).json({ error: 'too_many' });
            var targetId = userId;
            if (signOwner) {
                if (!GRANTEE_ID_RE.test(signOwner)) return res.status(400).json({ error: 'bad_owner' });
                if (!(await store.getGrant(signOwner, userId))) return res.status(403).json({ error: 'no_grant' });
                targetId = signOwner;
            }
            for (var si = 0; si < refs.length; si++) {
                if (!isReadableRef(refs[si], targetId)) return res.status(403).json({ error: 'not_owner', index: si });
            }
            return res.status(200).json({ ok: true, urls: await storage.sign(refs), expiresIn: storage.SIGN_TTL_SEC });
        }

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

            var ref = await storage.put(pathFor(userId, scope, kind, name), body);
            return res.status(200).json({ ok: true, url: ref });
        }

        if (action === 'commit') {
            if (!SCOPE_RE.test(scope)) return res.status(400).json({ error: 'bad_scope' });
            var b = req.body || {};
            var chunkUrls = Array.isArray(b.chunkUrls) ? b.chunkUrls : [];
            if (!chunkUrls.length || chunkUrls.length > MAX_CHUNKS_PER_COMMIT) return res.status(400).json({ error: 'bad_chunks' });
            var finalName = String(b.name || 'f').replace(/[^a-zA-Z0-9_.-]/g, '');
            if (!finalName) return res.status(400).json({ error: 'bad_name' });

            // Eigentumsprüfung: jede Chunk-Referenz muss ein Objekt DIESES Nutzers/Scopes
            // sein — nie fremde/erratene Blob-URLs blind fetchen.
            for (var i0 = 0; i0 < chunkUrls.length; i0++) {
                if (!isOwnedBlobUrl(chunkUrls[i0], userId, scope)) return res.status(403).json({ error: 'not_owner', index: i0 });
            }

            // Concurrency-Deckel pro Nutzer: verhindert, dass ein einzelner Account viele
            // parallele 200-MB-Commits anstößt (Ressourcen-/Kosten-DoS trotz Rate-Limit).
            var lockKey = 'blob:commitlock:' + userId, lockHeld = false;
            if (!store.configProblem()) {
                try {
                    if (!(await store.lockTry(lockKey, 30))) return res.status(429).json({ error: 'commit_busy' });
                    lockHeld = true;
                } catch (e) { _log.logWarn('blob-upload', 'COMMIT_LOCK_FAILED', e); }
            }

            try {
                var parts = [], total = 0;
                for (var i = 0; i < chunkUrls.length; i++) {
                    // storage.read folgt keiner Weiterleitung (SSRF, siehe dort)
                    var buf;
                    try { buf = await storage.read(String(chunkUrls[i] || '')); }
                    catch (re) {
                        if (re && re.httpStatus) return res.status(502).json({ error: 'chunk_fetch_failed', index: i });
                        throw re;
                    }
                    total += buf.length;
                    if (total > MAX_TOTAL_BYTES) return res.status(413).json({ error: 'too_large', maxTotal: MAX_TOTAL_BYTES });
                    parts.push(buf);
                }
                var assembled = Buffer.concat(parts, total);
                var finalRef = await storage.put(pathFor(userId, scope, 'attachments', finalName), assembled);
                // Best-effort: temporäre Teile aufräumen (Fehler hier sind nicht kritisch — Cron räumt Reste)
                try { await storage.remove(chunkUrls); } catch (e) { _log.logWarn('blob-upload', 'CHUNK_CLEANUP_FAILED', e); }
                return res.status(200).json({ ok: true, url: finalRef, size: total });
            } finally {
                if (lockHeld) { try { await store.lockRelease(lockKey); } catch (e) { /* TTL räumt ohnehin nach 30s auf */ } }
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
            await storage.remove(rawUrls);
            return res.status(200).json({ ok: true, deleted: rawUrls.length });
        }

        // Gegenstück zu api/sync.js action=reset_all: wenn die Cloud-Snapshots verworfen
        // werden, weil sie mit keinem vorhandenen Schlüssel mehr lesbar sind, kennt
        // niemand mehr die URLs der ausgelagerten Anhänge — die standen ausschließlich IM
        // Chiffrat. Ohne diesen Pfad blieben sie für immer im Blob-Store liegen
        // (api/blob-cleanup.js räumt nur stackr/tmp/, nie stackr/attachments/).
        // Gelöscht wird ausschließlich der eigene Namespace stackr/attachments/<userId>/ —
        // userId stammt aus dem server-seitig validierten Token, nie aus dem Request-Body.
        // Im Supabase-Modus räumt storage.sweep beide Speicher, solange der Vercel-Token steht.
        if (action === 'purge') {
            var removed = await storage.sweep('stackr/attachments/' + userId + '/', null, Date.now());
            return res.status(200).json({ ok: true, deleted: removed });
        }

        return res.status(400).json({ error: 'bad_action' });
    } catch (e) {
        _log.logError('blob-upload', 'STORAGE_ERROR', e);
        return res.status(500).json({ error: 'storage_error' });
    }
};
