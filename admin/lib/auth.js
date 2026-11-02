// Stackr Admin — Anmeldung pruefen (Supabase Auth, Google + MFA)
// =============================================================================
// Der Browser schickt das Supabase-Access-Token als "Authorization: Bearer". Weil es ein
// Header ist und kein Cookie, greift CSRF nicht. requireAdmin() prueft in dieser Reihenfolge:
//   1. Token bei Supabase validieren (GET /auth/v1/user) — Signatur/Ablauf macht Supabase
//   2. E-Mail == ADMIN_EMAIL (Allowlist, genau ein Eintrag; Env, nicht im Code)
//   3. Claim aal == "aal2"  (zweiter Faktor wurde in dieser Session geprueft)
//   4. Idle-Timeout 30 min (sync_admin_session_touch)
//   5. Recht ueber permissions.can()
// Jede Ablehnung: 401 (nicht angemeldet/abgelaufen) bzw. 403 (angemeldet, aber nicht erlaubt).
//
// Env: ADMIN_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

var db = require('./db');
var perms = require('./permissions');

var IDLE_SECS = 30 * 60;
var ADMIN_ROLE = 'superadmin';   // Annahme: der einzige Admin hat alle Rechte

function fail(status, code) {
    var e = new Error(code);
    e.status = status;
    e.code = code;
    return e;
}

function bearer(req) {
    var h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
    var m = /^Bearer ([A-Za-z0-9._-]+)$/.exec(h);
    return m ? m[1] : '';
}

// Nutzlast eines bereits von Supabase validierten JWT lesen (keine eigene Signaturpruefung)
function claims(token) {
    try {
        return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    } catch (e) { return {}; }
}

async function fetchUser(token) {
    var c = db.config();
    var r = await fetch(c.url + '/auth/v1/user', {
        headers: { 'apikey': c.key, 'Authorization': 'Bearer ' + token },
        signal:  AbortSignal.timeout(8000)
    });
    if (!r.ok) return null;
    return r.json();
}

async function requireAdmin(req, permission) {
    var allowed = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!allowed || !db.isConfigured()) throw fail(503, 'nicht_konfiguriert');

    var token = bearer(req);
    if (!token) throw fail(401, 'kein_token');

    var user = await fetchUser(token);
    if (!user || !user.email) throw fail(401, 'token_ungueltig');
    if (String(user.email).toLowerCase() !== allowed || !user.email_confirmed_at) throw fail(403, 'nicht_erlaubt');

    var cl = claims(token);
    if (cl.aal !== 'aal2' || !cl.session_id) throw fail(401, 'mfa_fehlt');

    var ok = await db.rpc('sync_admin_session_touch', { p_sid: cl.session_id, p_email: allowed, p_idle_secs: IDLE_SECS });
    if (!ok) throw fail(401, 'sitzung_abgelaufen');

    if (permission && !perms.can(ADMIN_ROLE, permission)) throw fail(403, 'recht_fehlt');

    return { email: allowed, role: ADMIN_ROLE, sessionId: cl.session_id };
}

// Einheitliche Fehlerantwort fuer Endpunkte: nie Interna nach aussen
function sendError(res, err) {
    var status = err && err.status ? err.status : 500;
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: status === 500 ? 'serverfehler' : err.code }));
}

module.exports = { requireAdmin: requireAdmin, sendError: sendError, IDLE_SECS: IDLE_SECS };
