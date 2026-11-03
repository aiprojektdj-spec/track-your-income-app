// Stackr Admin — Validierung fuer Kennzahlen, Plaene und Feature-Flags
// =============================================================================

var M = require('./members');

var KEY_RE   = /^[a-z0-9][a-z0-9._-]{1,62}$/;
var DATE_RE  = /^\d{4}-\d{2}-\d{2}$/;
var STATUS   = ['off', 'rules', 'on'];
var MAX_TAGE = 366;

function bad(code) { return M.badRequest(code); }

// Kalendertag in Europe/Berlin als YYYY-MM-DD (sv-SE liefert dieses Format)
function berlinTag(d) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(d || new Date());
}

function tagPlus(tag, n) {
    var d = new Date(tag + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

// from/to aus der Query; Standard: letzte 30 Tage bis heute. Hoechstens 366 Tage.
function range(q, jetzt) {
    var to = q.to ? String(q.to) : berlinTag(jetzt);
    var from = q.from ? String(q.from) : tagPlus(to, -29);
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || isNaN(Date.parse(from)) || isNaN(Date.parse(to))) throw bad('datum_ungueltig');
    var tage = (Date.parse(to) - Date.parse(from)) / 86400000 + 1;
    if (tage < 1 || tage > MAX_TAGE) throw bad('zeitraum_ungueltig');
    return { from: from, to: to };
}

function list(v, max, check) {
    var arr = Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/);
    var out = [];
    arr.forEach(function (x) {
        x = String(x).trim();
        if (!x) return;
        if (!check(x)) throw bad('liste_ungueltig');
        if (out.indexOf(x) === -1) out.push(x);
    });
    if (out.length > max) throw bad('liste_zu_lang');
    return out;
}

function flag(b) {
    var key = String(b.key || '').trim();
    if (!KEY_RE.test(key)) throw bad('key_ungueltig');
    if (STATUS.indexOf(b.status) === -1) throw bad('status_ungueltig');
    var percent = parseInt(b.percent, 10);
    if (!(percent >= 0 && percent <= 100)) throw bad('prozent_ungueltig');
    var idOk = function (x) { return /^[A-Za-z0-9_-]{3,64}$/.test(x); };
    return {
        p_key:      key,
        p_desc:     String(b.description || '').slice(0, 300),
        p_status:   b.status,
        p_percent:  percent,
        p_users:    list(b.user_ids, 500, idOk),
        p_accounts: list(b.account_ids, 500, idOk),
        p_plans:    list(b.plan_ids, 50, idOk)
    };
}

function plan(b) {
    var id = M.validId(b.plan_id);
    var cents = Number(b.monthly_cents);
    if (!Number.isInteger(cents) || cents < 0 || cents > 1000000) throw bad('betrag_ungueltig');
    return { p_plan: id, p_label: String(b.label || '').trim().slice(0, 60), p_cents: cents };
}

module.exports = { range: range, flag: flag, plan: plan, berlinTag: berlinTag, tagPlus: tagPlus, KEY_RE: KEY_RE };
