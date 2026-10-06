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
// Store: über api/_sync-store.js — Upstash Redis (heute) oder Supabase (Phase 1),
//   beide in Frankfurt → EU-Residenz. Umschaltung per STORAGE_BACKEND/STORAGE_MIRROR;
//   die Zugangsdaten der beiden Systeme stehen dort bzw. in api/_db.js.
//   Wert je Scope:  { ciphertext, iv, version, updatedAt, deviceId }   (nur Chiffrat)
//   scope = "__account" | "co_<id>"
//   CAS:   optimistische Nebenläufigkeit per Versions-Vergleich.
//
// Env (Vercel, EU-Region):
//   WHOP_ACCESS_IDS            (optional, kommagetrennt — Zugangs-IDs; Default prod_+biz_)
//   WHOP_API_KEY               (optional — Company-API-Key aktiviert den Fallback-Scan)
//   SYNC_OWNER_IDS             (optional, kommagetrennt — Whop-User-IDs "user_…" der Owner
//                               ohne Abo; BEVORZUGT, weil unveränderlich)
//   SYNC_OWNER_USERNAMES       (Altweg, nur wirksam solange SYNC_OWNER_IDS leer ist)
//   SYNC_MAX_SCOPES            (optional, Default 25 — Scopes pro Nutzer, s. claimScope)
//   SYNC_MAX_GRANTS            (optional, Default 10 — aktive StB-Freigaben pro Owner)
//   ALERT_WEBHOOK_URL          (optional — Meldung, wenn ein Deckel fail-open aufgeht,
//                               siehe api/_alert.js)
// =============================================================================

// Meldet stillschweigende Degradierung (offener Deckel) an ALERT_WEBHOOK_URL, siehe api/_alert.js
var alertOps = require('./_alert.js').alertOps;
var _log     = require('./_log.js');
var store    = require('./_sync-store.js');

// Zugangs-Check — zwei unabhängige Wege, Zugang sobald EINER bestätigt (identisch zu
// api/whop-access.js): (1) User-Token gegen https://api.whop.com/api/v2/me/has_access/<id>
// (has_access existiert bei Whop unter v2, NICHT v5→404, NICHT mit Bindestrich→404;
// braucht KEINEN Server-Key), (2) Fallback nur wenn WHOP_API_KEY gesetzt: Company-Scan
// gegen /v5/company/memberships?valid=true (user_id-Filter wird ignoriert → selbst matchen).
//   prod_wgVmaJg4sBVOD = Pro 15 €/Mon · prod_p1WHi5t65rAA6 = 135 €/Jahr · biz_2OEWYGlOwb8b0f = Company
var ACCESS_IDS   = (process.env.WHOP_ACCESS_IDS || 'prod_wgVmaJg4sBVOD,prod_p1WHi5t65rAA6,biz_2OEWYGlOwb8b0f')
                       .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
var WHOP_API_KEY = process.env.WHOP_API_KEY || '';
// Owner-Bypass: Vergleich gegen die UNVERÄNDERLICHE Whop-User-ID (me.sub, "user_…") aus
// SYNC_OWNER_IDS. Der Namensweg war umgehbar (Fund R3, Red-Team-Audit 2026-08-10): `username`
// entstand als `me.preferred_username || me.name || …`, und `me.name` ist der ANZEIGENAME —
// frei wählbar, nicht eindeutig. Solange SYNC_OWNER_IDS leer ist, gilt weiter die Namensliste,
// aber NUR gegen preferred_username (eindeutig), nie gegen den Anzeigenamen.
// Identische Logik in api/whop-access.js und api/blob-upload.js (eigenständige Funktionen).
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

// has_access mit dem User-Token (v2). true | false | null(unbestimmt: 401/403). 5xx → wirft.
async function whopHasAccessViaToken(userToken) {
    // Alle IDs parallel (sonst bis 3×8 s = 24 s > Vercel-10-s-Limit). Spiegelt whop-access.js.
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

// Fallback: Company-Membership-Scan mit dem Company-API-Key. Paginiert, Seiten-Obergrenze.
async function whopHasAccessViaCompanyKey(userId) {
    var page = 1, MAX_PAGES = 200; // 10.000 valid memberships Kopfraum; nur Sicherheits-Deckel (Loop bricht bei next_page=null)
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
// 3,5 MB Base64-Chiffrat (≈2,6 MB roh) — bewusst deutlich unter Vercels HARTEM
// 4,5-MB-Function-Body-Limit (nicht konfigurierbar, gilt für JEDE Node-Serverless-
// Function). Das alte MAX_CIPHER=8MB war praktisch nie erreichbar: ein Request in
// dieser Größe wäre schon von der Plattform abgelehnt worden, bevor dieser Code
// überhaupt lief. Größere Payloads gehen über js/blob-attachments.js als eigenes
// Objekt zu Vercel Blob (api/blob-upload.js, kein Body-Limit-Problem dort) — hier
// wird dann nur noch { blobUrl, iv, version, ... } gespeichert (siehe push unten).
var MAX_CIPHER   = 3.5 * 1024 * 1024;
var SCOPE_RE     = /^(__account|co_[a-z0-9_]+)$/;

// ── Mengendeckel pro Nutzer (Fund R2, Red-Team-Audit 2026-08-10) ──────────────────────────
// SCOPE_RE prüfte nur die FORM des Scopes, nicht Existenz oder Anzahl. Ein Nutzer mit einem
// gültigen Abo konnte beliebig viele Scopes anlegen (`co_flood1`, `co_flood2`, …) und in jeden
// bis MAX_CIPHER schreiben: bei RATE_MAX=40 Requests/Minute ~140 MB/Minute, also ~200 GB/Tag
// dauerhaft belegter Upstash-Speicher — auf Kosten des Betreibers, für 15 €/Monat.
//
// Gegenmittel ist ein Zähler statt eines TTL: ein TTL auf sync:-Keys würde echte Nutzerdaten
// wegräumen (das Backup IST der Wert). `scopes:<userId>` hält daher die Menge der belegten
// Scopes, push/anchor müssen einen Platz belegen, delete gibt ihn wieder frei.
//
// 25 ist großzügig: real braucht ein Nutzer `__account` + seine Firmen. Das clientseitige
// Stück-Limit (früher Companies.MAX_COMPANIES = 5) ist am 2026-08-24 entfallen — damit ist DIESER
// Zähler die einzige verbliebene Obergrenze. Wer sie reißt, bekommt kein stilles Fehlverhalten,
// sondern 409 `scope_limit`, das der Client als lesbare Meldung anzeigt (js/cloud-sync.js,
// „Grenze für gesicherte Firmen erreicht"). Der Rest ist Kopfraum für Firmen, die im Laufe der
// Zeit gelöscht und neu angelegt wurden.
// Damit ist der Speicher pro Nutzer auf 25 × 3,5 MB ≈ 88 MB begrenzt — ein separates Byte-Budget
// braucht es dafür nicht. Deckt auch `anchor` mit ab (ANCHOR_MAX griff nur je Key, nicht je
// Nutzer). Über SYNC_MAX_SCOPES/SYNC_MAX_GRANTS ohne Codeänderung anhebbar, falls ein echter
// Kunde anläuft.
var MAX_SCOPES   = parseInt(process.env.SYNC_MAX_SCOPES || '25', 10);
var MAX_GRANTS   = parseInt(process.env.SYNC_MAX_GRANTS || '10', 10);

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://track-your-income-app.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'method_not_allowed' });

    var storeProblem = store.configProblem();
    if (storeProblem) {
        await alertOps('sync', (store.backendName() || 'store') + '-env-missing', storeProblem);
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
        // x-vercel-forwarded-for wird von Vercels Edge-Netzwerk selbst gesetzt und ist vom
        // Client nicht überschreibbar (anders als das erste x-forwarded-for-Segment) — sonst
        // wäre das IP-Rate-Limit per Header spoofbar.
        var ip      = req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
        var ipCount = await store.rateHit('sync:iprl:' + ip, 60);
        if (ipCount > IP_RATE_MAX) return res.status(429).json({ error: 'rate_limited' });
    } catch (e) {
        // nicht blockierend — weiter, aber der IP-Deckel ist damit offen
        await alertOps('sync', 'ip-rate-limit-open', e && e.message);
    }

    // ── 2. Token gegen Whop validieren → UserID server-seitig ableiten ────────
    // username dient nur der ANZEIGE (ownerName im Grant, username am Pubkey). Für die
    // Owner-Entscheidung wird prefUsername benutzt — ohne den Anzeigenamen-Fallback, s.
    // isOwnerIdentity().
    var userId, username, prefUsername;
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
        prefUsername = me.preferred_username || '';
        if (!userId) return res.status(401).json({ error: 'no_user' });
    } catch (e) {
        _log.logError('sync', 'WHOP_USERINFO_FAILED', e);
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
    var isOwner = isOwnerIdentity(userId, prefUsername);
    if (!isOwner && !isGranteeRead) {
        try {
            // Zugangs-Check: User-Token gegen /api/v2/me/has_access, sonst Company-Key-Fallback.
            if (!(await whopHasAccess(token, userId)))
                return res.status(403).json({ error: 'pro_required' });
        } catch (e) {
            _log.logError('sync', 'WHOP_ACCESS_CHECK_FAILED', e);
            return res.status(502).json({ error: 'whop_unreachable' });
        }
    }

    // ── 4b. Rate-Limit (Zähler, 60s-Fenster) ─────────────────────────────────
    try {
        var count = await store.rateHit('sync:rl:' + userId, 60);
        if (count > RATE_MAX) return res.status(429).json({ error: 'rate_limited' });
    } catch (e) {
        // Rate-Limit-Fehler nicht blockierend — weiter, aber der Nutzer-Deckel ist offen
        await alertOps('sync', 'rate-limit-open', e && e.message);
    }

    // ── 5. Request validieren ─────────────────────────────────────────────────
    // scope nur für scope-gebundene Aktionen (pull/push/delete/anchor*) verlangen;
    // pubkey-/grant-Aktionen brauchen keinen scope.
    var isScopeAction = (action === 'pull' || action === 'push' || action === 'delete' ||
                          action === 'anchor' || action === 'anchor_pull');
    if (isScopeAction && !SCOPE_RE.test(String(scope || ''))) return res.status(400).json({ error: 'bad_scope' });

    var ANCHOR_MAX = 20000;   // LTRIM-Deckel — Hash+ID pro Eintrag ist winzig, das deckt Jahre ab

    try {
        if (action === 'pull') {
            var readOwner = userId;
            if (body.owner) {
                // Steuerberater liest fremden Mandanten-Scope → nur mit gültigem Grant (read-only)
                var ownerId = String(body.owner);
                if (!GRANTEE_ID_RE.test(ownerId)) return res.status(400).json({ error: 'bad_owner' });
                if (!(await store.getGrant(ownerId, userId))) return res.status(403).json({ error: 'no_grant' });
                readOwner = ownerId;
            }
            var cur = await store.get(readOwner, scope);
            return res.status(200).json({ ok: true, blob: cur || null });
        }

        if (action === 'push') {
            // Grantee (StB) ist strikt read-only: nie in fremde Owner-Keys schreiben
            if (body.owner) return res.status(403).json({ error: 'readonly' });
            var expected = parseInt(body.version, 10);
            if (isNaN(expected) || expected < 0) return res.status(400).json({ error: 'bad_version' });
            if (typeof body.iv !== 'string') return res.status(400).json({ error: 'bad_payload' });

            // Zwei Formen: inline (klein, wie bisher) ODER blobUrl (großes Chiffrat liegt
            // bereits als eigenes Objekt in Vercel Blob, siehe js/blob-attachments.js).
            var hasInline = typeof body.ciphertext === 'string';
            var hasBlob   = typeof body.blobUrl === 'string' && body.blobUrl.indexOf('https://') === 0;
            if (!hasInline && !hasBlob) return res.status(400).json({ error: 'bad_payload' });
            if (hasInline && body.ciphertext.length > MAX_CIPHER) return res.status(413).json({ error: 'too_large', maxCipher: MAX_CIPHER });

            // Scope-Platz belegen, BEVOR geschrieben wird (Fund R2) — sonst läge das Chiffrat
            // bereits im Speicher, wenn der Deckel greift.
            if (!(await store.claimScope(userId, scope, MAX_SCOPES)))
                return res.status(409).json({ error: 'scope_limit', maxScopes: MAX_SCOPES });

            var newBlob = hasInline ? {
                ciphertext: body.ciphertext,
                iv:         body.iv,
                version:    expected + 1,
                updatedAt:  Date.now(),
                deviceId:   typeof body.deviceId === 'string' ? body.deviceId.slice(0, 64) : ''
            } : {
                blobUrl:    body.blobUrl,
                iv:         body.iv,
                version:    expected + 1,
                updatedAt:  Date.now(),
                deviceId:   typeof body.deviceId === 'string' ? body.deviceId.slice(0, 64) : ''
            };

            var result = await store.cas(userId, scope, expected, newBlob);
            if (result.ok) {
                return res.status(200).json({ ok: true, version: expected + 1 });
            }
            // Konflikt: aktueller Server-Stand zurück → Client merged & retried
            return res.status(409).json({ error: 'version_conflict', blob: result.current || null });
        }

        if (action === 'delete') {
            // Art. 17 DSGVO — löscht nur den verschlüsselten Snapshot. Die Anker-Liste
            // bleibt bewusst erhalten. Würde sie hier mitgelöscht, könnte ein
            // Nutzer, der Buchungen nachträglich manipuliert hat, die eigene
            // GoBD-Tamper-Evidence-Kette mit entfernen.
            //
            // ACHTUNG bei der Begründung nach außen: Hash+ID+Timestamp sind pseudonyme und
            // damit personenbezogene Daten (Art. 4 Nr. 1 i. V. m. EG 26) — "nicht
            // personenbezogen" ist gegenüber einer Aufsichtsbehörde nicht haltbar. Tragfähig
            // ist Art. 17 Abs. 3 lit. b DSGVO: kein Löschanspruch, soweit die Verarbeitung zur
            // Erfüllung einer rechtlichen Verpflichtung erforderlich ist — hier §§ 145 ff.,
            // 147 AO i. V. m. GoBD. So steht es auch in datenschutz.html, Abschnitt 6.1;
            // beide Stellen zusammen ändern.
            await store.del(userId, scope);
            // Scope-Platz freigeben (Fund R2): wer aufräumt, soll wieder Luft haben. Die
            // Anker-Liste bleibt liegen, belegt aber keinen Platz — er ist winzig und per
            // ANCHOR_MAX gedeckelt.
            await store.releaseScope(userId, scope);
            return res.status(200).json({ ok: true });
        }

        // ── Notausgang: ALLE Cloud-Snapshots dieses Accounts verwerfen ────────
        // Für den Sackgassen-Fall "der Schlüssel, mit dem die Cloud-Daten verschlüsselt
        // sind, existiert auf keinem Gerät mehr" (zwei Geräte hatten je einen eigenen
        // Schlüssel erzeugt, oder der Wiederherstellungscode ging verloren). 'delete'
        // hilft dort nicht: der Client muss den Snapshot dafür erst ENTSCHLÜSSELN, um die
        // Anhang-URLs einzusammeln — genau das geht ja nicht mehr. Ohne diesen Endpunkt
        // bliebe der Account dauerhaft unsynchronisierbar.
        // Kein Datenverlust im Rechtssinn: die Klardaten liegen lokal auf den Geräten,
        // hier fällt ausschließlich unlesbares Chiffrat weg.
        if (action === 'reset_all') {
            if (body.owner) return res.status(403).json({ error: 'readonly' });   // nie fremde Owner-Daten
            var known = (await store.listScopes(userId)).slice();
            // '__account' immer mitnehmen: das Scope-Set kam erst mit dem Scope-Deckel dazu,
            // ältere Snapshots stehen möglicherweise nicht darin.
            if (known.indexOf('__account') === -1) known.push('__account');
            var wiped = [];
            for (var ri = 0; ri < known.length; ri++) {
                var rs = String(known[ri] || '');
                if (!SCOPE_RE.test(rs)) continue;
                await store.del(userId, rs);
                wiped.push(rs);
            }
            await store.clearScopes(userId);
            // Anker-Listen bleiben bewusst stehen — gleiche Begründung wie
            // bei 'delete': sie enthalten keine Klardaten, sind aber die GoBD-Tamper-
            // Evidence. Wären sie hier mitlöschbar, könnte man die eigene Beweiskette
            // per "Reset" abstreifen.
            return res.status(200).json({ ok: true, scopes: wiped });
        }

        // ── Audit-Log-Anker: append-only Beweisliste für Manipulationserkennung ──
        // Speichert NUR {id, h(Content-SHA-256), ts} — keine Klardaten. Einmal
        // angehängte Einträge werden nie überschrieben (nur per Art.-17-delete
        // komplett entfernt) → liefert einen externen, vom Client nicht rückwirkend
        // veränderbaren Referenzpunkt für GoBD Rz. 64 (Unveränderbarkeit).
        if (action === 'anchor') {
            if (body.owner) return res.status(403).json({ error: 'readonly' });
            var items = Array.isArray(body.entries) ? body.entries : [];
            if (!items.length) return res.status(400).json({ error: 'bad_payload' });
            if (items.length > 1000) return res.status(400).json({ error: 'too_many' });
            // Auch anchor legt einen neuen Key je Scope an — ohne diesen Gate wäre der
            // Scope-Deckel über den anchor-Pfad umgehbar (Fund R2).
            if (!(await store.claimScope(userId, scope, MAX_SCOPES)))
                return res.status(409).json({ error: 'scope_limit', maxScopes: MAX_SCOPES });
            var ID_RE = /^[A-Za-z0-9_-]{1,64}$/, HASH_RE = /^[A-Fa-f0-9]{64}$/;
            var rows = [];
            for (var ai = 0; ai < items.length; ai++) {
                var it = items[ai];
                if (!it || !ID_RE.test(String(it.id || '')) || !HASH_RE.test(String(it.h || '')))
                    return res.status(400).json({ error: 'bad_entry' });
                rows.push({ id: it.id, h: it.h, ts: Date.now() });
            }
            await store.appendAnchors(userId, scope, rows, ANCHOR_MAX);
            return res.status(200).json({ ok: true, added: rows.length });
        }

        if (action === 'anchor_pull') {
            if (body.owner) return res.status(403).json({ error: 'readonly' });   // StB-Sync ruht ohnehin (siehe cloud-sync.js) — kein Bedarf
            var anchors = await store.listAnchors(userId, scope);
            return res.status(200).json({ ok: true, anchors: anchors });
        }

        // ── Steuerberater-Freigabe (Envelope-Key, siehe js/stb-share.js) ──────
        // Öffentlichen Schlüssel registrieren (idempotent). Kein Geheimnis.
        if (action === 'register_pubkey') {
            if (!body.pub || typeof body.pub !== 'object') return res.status(400).json({ error: 'bad_payload' });
            // Kein `username` im Datensatz (Fund R8, Red-Team-Audit 2026-08-10): get_pubkey ist für
            // jeden zahlenden Nutzer aufrufbar und gab den Whop-Benutzernamen zu einer beliebigen
            // User-ID heraus — ein Enumerations-Orakel „nutzt diese Person Stackr, und wie heißt
            // sie dort". Zum Verpacken des Datenschlüssels wird ausschließlich `pub` gebraucht.
            // Der Name wird deshalb gar nicht erst gespeichert, statt ihn nur aus der Antwort zu
            // filtern — was nicht liegt, kann auch nicht verraten werden (Datenminimierung,
            // Art. 5 Abs. 1 lit. c DSGVO). Alt-Datensätze tragen ihn noch; sie werden beim
            // nächsten Login des jeweiligen Nutzers überschrieben (registerPubkey läuft bei
            // jedem Login) — deshalb filtert get_pubkey unten zusätzlich.
            var pubObj = { pub: body.pub, updatedAt: Date.now() };
            if (JSON.stringify(pubObj).length > 4096) return res.status(413).json({ error: 'too_large' });
            await store.setPubkey(userId, pubObj);
            return res.status(200).json({ ok: true });
        }

        // Owner holt den Public-Key des einzuladenden StB (zum Wrappen des Datenschlüssels)
        if (action === 'get_pubkey') {
            var gidP = String(body.granteeId || '');
            if (!GRANTEE_ID_RE.test(gidP)) return res.status(400).json({ error: 'bad_grantee' });
            var pkObj = await store.getPubkey(gidP);
            if (!pkObj) return res.status(404).json({ error: 'no_pubkey' });
            // Nur `pub` und `updatedAt` herausgeben, nie den ganzen gespeicherten Datensatz
            // (Fund R8): Alt-Datensätze von vor diesem Fix tragen noch ein `username`-Feld, das
            // erst beim nächsten Login des Betroffenen verschwindet. Bis dahin filtert dieser
            // Whitelist-Zugriff. Auch künftige Felder gelangen so nicht versehentlich nach außen.
            return res.status(200).json({ ok: true, pubkey: { pub: pkObj.pub, updatedAt: pkObj.updatedAt || 0 } });
        }

        // Owner erteilt Grant: verpackter Datenschlüssel (Envelope) für den StB ablegen
        if (action === 'grant') {
            var gidG = String(body.granteeId || '');
            if (!GRANTEE_ID_RE.test(gidG)) return res.status(400).json({ error: 'bad_grantee' });
            if (!body.envelope || typeof body.envelope !== 'object') return res.status(400).json({ error: 'bad_payload' });
            var envStr = JSON.stringify(body.envelope);
            if (envStr.length > 8192) return res.status(413).json({ error: 'too_large' });

            // Der Grantee muss vorher einen Public Key registriert haben (Fund R4): bisher ließ
            // sich ein Grant blind auf eine BELIEBIGE ID setzen. Das war zweifach nutzlos-schädlich
            // — der Envelope wäre für einen nicht existierenden Empfänger ohnehin unentpackbar,
            // und `grantsby:<userId>` wuchs mit jedem Fantasie-Grantee weiter.
            if (!(await store.getPubkey(gidG)))
                return res.status(404).json({ error: 'no_pubkey' });

            // Deckel auf aktive Grants pro Owner (Fund R2/R4). Ein Owner braucht selten mehr als
            // ein bis zwei Steuerberater; ohne Deckel war die Grant-Liste unbegrenzt und je
            // Grant bis 8 KB groß. Ein bereits bestehender Grantee läuft immer durch, ein
            // Re-Grant an denselben Steuerberater bleibt also möglich (siehe store.addGrant).
            var grantVal = { role: 'readonly', envelope: body.envelope, ownerName: username, createdAt: Date.now() };
            if (!(await store.addGrant(userId, gidG, grantVal, MAX_GRANTS)))
                return res.status(409).json({ error: 'grant_limit', maxGrants: MAX_GRANTS });
            return res.status(200).json({ ok: true });
        }

        // Owner entzieht Grant (echter Revoke; Owner sollte danach re-keyen)
        if (action === 'revoke') {
            var gidR = String(body.granteeId || '');
            if (!GRANTEE_ID_RE.test(gidR)) return res.status(400).json({ error: 'bad_grantee' });
            await store.revokeGrant(userId, gidR);
            return res.status(200).json({ ok: true });
        }

        // StB listet alle Mandanten, die ihm Zugriff gewährt haben (+ Envelope zum Entpacken)
        if (action === 'list_grants') {
            var grants = (await store.listGrantsFor(userId)).map(function (g) {
                return { ownerId: g.id, ownerName: g.data.ownerName || '', role: g.data.role, envelope: g.data.envelope };
            });
            return res.status(200).json({ ok: true, grants: grants });
        }

        // Owner listet, wem ER Zugriff gewährt hat (zum Entziehen). Grantee-Klarname ist
        // server-seitig nicht bekannt (nur die userId) — Code + Datum reicht für den Dialog.
        if (action === 'list_my_grantees') {
            var myGrantees = (await store.listGranteesBy(userId)).map(function (g) {
                return { granteeId: g.id, createdAt: g.data.createdAt || null };
            });
            return res.status(200).json({ ok: true, grantees: myGrantees });
        }

        return res.status(400).json({ error: 'bad_action' });
    } catch (e) {
        _log.logError('sync', 'STORAGE_ERROR', e);
        return res.status(500).json({ error: 'storage_error' });
    }
};
