// Stackr Admin — Mitglieder: Validierung, PII-Maskierung, Whop-Abgleich
// =============================================================================
// PII: E-Mail wird standardmaessig maskiert ("m***@domain.de"). Klartext nur mit Recht
// users.reveal_pii und Audit-Eintrag (admin/api/member.js, ?reveal=1).
// =============================================================================

var ID_RE  = /^[A-Za-z0-9_-]{3,64}$/;
var TAG_RE = /^[\p{L}\p{N} _-]{1,30}$/u;
var STATUS = ['active', 'trialing', 'past_due', 'canceled', 'completed', 'expired', 'unresolved', 'drafted', 'paused'];
var SORTS  = ['signup_at', 'last_active_at', 'email', 'name', 'status'];

function badRequest(code) {
    var e = new Error(code);
    e.status = 400;
    e.code = code;
    return e;
}

function validId(v) {
    if (!ID_RE.test(String(v || ''))) throw badRequest('id_ungueltig');
    return String(v);
}

function validTag(v) {
    var t = String(v || '').trim();
    if (!TAG_RE.test(t)) throw badRequest('tag_ungueltig');
    return t;
}

// Listenparameter aus der Query: unbekannte Werte werden verworfen, nicht durchgereicht
function listParams(q) {
    var page = Math.max(parseInt(q.page, 10) || 1, 1);
    var size = Math.min(Math.max(parseInt(q.size, 10) || 25, 1), 100);
    return {
        p_q:         String(q.q || '').slice(0, 100) || null,
        p_status:    STATUS.indexOf(q.status) !== -1 ? q.status : null,
        p_tag:       q.tag ? validTag(q.tag) : null,
        p_suspended: q.suspended === '1' ? true : q.suspended === '0' ? false : null,
        p_sort:      SORTS.indexOf(q.sort) !== -1 ? q.sort : 'signup_at',
        p_dir:       q.dir === 'asc' ? 'asc' : 'desc',
        p_limit:     size,
        p_offset:    (page - 1) * size
    };
}

function maskEmail(email) {
    var s = String(email || '');
    var at = s.lastIndexOf('@');
    if (at < 1) return s ? '***' : '';
    return s.charAt(0) + '***' + s.slice(at);
}

function maskMember(m) {
    if (!m) return m;
    var out = Object.assign({}, m);
    out.email = maskEmail(m.email);
    return out;
}

// ── Whop-Abgleich ───────────────────────────────────────────────────────────────
var WHOP_API   = 'https://api.whop.com/api/v1';
var MAX_SEITEN = 200;
var RANG = { active: 4, trialing: 3, past_due: 2 };

function rang(status) { return RANG[status] || 1; }

// Holt alle Mitgliedschaften der Firma und verdichtet sie auf eine Zeile je Nutzer.
// Feldnamen wie in api/_loeschung.js (whopMitglieder); fehlt ein Feld, bleibt es leer.
async function whopLaden(env, fetchFn) {
    var firma = env.WHOP_COMPANY_ID || 'biz_2OEWYGlOwb8b0f';
    var best = {}, gelesen = 0, after = '';
    for (var seite = 0; seite < MAX_SEITEN; seite++) {
        var r = await fetchFn(WHOP_API + '/memberships?account_id=' + encodeURIComponent(firma) + '&first=100' +
                              (after ? '&after=' + encodeURIComponent(after) : ''), {
            headers: { 'Authorization': 'Bearer ' + env.WHOP_API_KEY, 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(8000)
        });
        if (!r.ok) throw new Error('Whop memberships HTTP ' + r.status);
        var j = await r.json();
        (j.data || []).forEach(function (m) {
            var u = (m && m.user && m.user.id) || (m && m.user_id);
            if (!u) return;
            gelesen++;
            var row = {
                whop_user_id:  u,
                email:         String((m.user && m.user.email) || '').toLowerCase(),
                name:          String((m.user && m.user.name) || ''),
                username:      String((m.user && m.user.username) || ''),
                plan_id:       String((m.plan && m.plan.id) || m.plan_id || m.variant_id || ''),
                membership_id: String(m.id || ''),
                status:        String(m.status || ''),
                signup_at:     m.created_at || null
            };
            var alt = best[u];
            if (!alt || rang(row.status) > rang(alt.status) ||
                (rang(row.status) === rang(alt.status) && String(row.signup_at) > String(alt.signup_at))) {
                // Anmeldedatum ist das aelteste aller Mitgliedschaften
                if (alt && alt.signup_at && (!row.signup_at || alt.signup_at < row.signup_at)) row.signup_at = alt.signup_at;
                best[u] = row;
            } else if (row.signup_at && (!alt.signup_at || row.signup_at < alt.signup_at)) {
                alt.signup_at = row.signup_at;
            }
        });
        var pi = j.page_info;
        if (!pi || !pi.has_next_page || !pi.end_cursor) break;
        after = pi.end_cursor;
    }
    var rows = Object.keys(best).map(function (k) { return best[k]; });
    // Seit Whop API v1 hat eine Mitgliedschaft kein user-Objekt mehr (nur user_id). E-Mail, Name und
    // Benutzername liefert nur /members. Best effort: scheitert der Abruf (z. B. fehlendes Key-Recht),
    // bleiben die Felder leer, der Abgleich laeuft trotzdem durch.
    if (rows.some(function (r) { return !r.email; })) {
        try {
            var info = await whopMembersLaden(env, fetchFn, firma);
            rows.forEach(function (r) {
                var i = info[r.whop_user_id];
                if (!i) return;
                if (!r.email)    r.email    = i.email;
                if (!r.name)     r.name     = i.name;
                if (!r.username) r.username = i.username;
            });
        } catch (e) { /* E-Mails bleiben leer */ }
    }
    return { rows: rows, gelesen: gelesen };
}

// user_id -> { email, name, username } aus GET /members
async function whopMembersLaden(env, fetchFn, firma) {
    var info = {}, after = '';
    for (var seite = 0; seite < MAX_SEITEN; seite++) {
        var r = await fetchFn(WHOP_API + '/members?account_id=' + encodeURIComponent(firma) + '&first=100' +
                              (after ? '&after=' + encodeURIComponent(after) : ''), {
            headers: { 'Authorization': 'Bearer ' + env.WHOP_API_KEY, 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(8000)
        });
        if (!r.ok) throw new Error('Whop members HTTP ' + r.status);
        var j = await r.json();
        (j.data || []).forEach(function (m) {
            var u = m && m.user && m.user.id;
            if (!u) return;
            info[u] = {
                email:    String(m.email || '').toLowerCase(),
                name:     String(m.name || m.user.name || ''),
                username: String(m.user.username || '')
            };
        });
        var pi = j.page_info;
        if (!pi || !pi.has_next_page || !pi.end_cursor) break;
        after = pi.end_cursor;
    }
    return info;
}

module.exports = {
    validId: validId, validTag: validTag, listParams: listParams, badRequest: badRequest,
    maskEmail: maskEmail, maskMember: maskMember, whopLaden: whopLaden
};
