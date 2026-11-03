// /api/member — Detail und Aktionen fuer ein Mitglied
//   GET  ?id=<whop_user_id>[&reveal=1]   Detail (E-Mail maskiert; reveal=1 braucht users.reveal_pii und wird protokolliert)
//   POST { id, action, ... }             action: suspend | unsuspend | note | pin | tag
//     suspend   { reason, confirm }      confirm muss die Whop-ID des Mitglieds sein (getippte Bestaetigung)
//     unsuspend {}
//     note      { body }
//     pin       { noteId, pinned }
//     tag       { tag, on }
// Jede schreibende Aktion legt ihren Audit-Eintrag in derselben DB-Transaktion an.

var auth = require('../lib/auth');
var audit = require('../lib/audit');
var db = require('../lib/db');
var M = require('../lib/members');

function notFound() {
    var e = new Error('nicht_gefunden');
    e.status = 404;
    e.code = 'nicht_gefunden';
    return e;
}

async function detail(req, res) {
    var id = M.validId(req.query && req.query.id);
    var reveal = req.query.reveal === '1';
    var admin = await auth.requireAdmin(req, reveal ? 'users.reveal_pii' : 'users.read');
    var d = await db.rpc('sync_admin_member_get', { p_id: id });
    if (!d) throw notFound();
    if (reveal) {
        await audit.logAction(req, admin, { action: 'users.reveal_pii', targetType: 'member', targetId: id });
    } else {
        d.member = M.maskMember(d.member);
    }
    auth.sendJson(res, d);
}

async function action(req, res) {
    var b = req.body && typeof req.body === 'object' ? req.body : {};
    var id = M.validId(b.id);
    var c, out;

    switch (b.action) {
    case 'suspend': {
        var admin = await auth.requireAdmin(req, 'users.suspend');
        var reason = String(b.reason || '').trim();
        if (reason.length < 3 || reason.length > 300) throw M.badRequest('grund_ungueltig');
        // Getippte Bestaetigung serverseitig: die Whop-ID des Mitglieds (keine PII, auch maskiert tippbar)
        if (String(b.confirm || '').trim() !== id) throw M.badRequest('bestaetigung_falsch');
        out = await db.rpc('sync_admin_member_suspend', { p_id: id, p_on: true, p_reason: reason, p_ctx: audit.ctx(req, admin) });
        break;
    }
    case 'unsuspend': {
        var a2 = await auth.requireAdmin(req, 'users.suspend');
        out = await db.rpc('sync_admin_member_suspend', { p_id: id, p_on: false, p_reason: '', p_ctx: audit.ctx(req, a2) });
        break;
    }
    case 'note': {
        var a3 = await auth.requireAdmin(req, 'notes.write');
        var body = String(b.body || '').trim();
        if (!body || body.length > 5000) throw M.badRequest('notiz_ungueltig');
        out = await db.rpc('sync_admin_note_add', { p_id: id, p_body: body, p_ctx: audit.ctx(req, a3) });
        break;
    }
    case 'pin': {
        var a4 = await auth.requireAdmin(req, 'notes.write');
        var noteId = parseInt(b.noteId, 10);
        if (!(noteId > 0)) throw M.badRequest('notiz_ungueltig');
        out = await db.rpc('sync_admin_note_pin', { p_note: noteId, p_pinned: b.pinned === true, p_ctx: audit.ctx(req, a4) });
        break;
    }
    case 'tag': {
        var a5 = await auth.requireAdmin(req, 'tags.write');
        c = M.validTag(b.tag);
        out = await db.rpc('sync_admin_tag_set', { p_id: id, p_tag: c, p_on: b.on !== false, p_ctx: audit.ctx(req, a5) });
        break;
    }
    default:
        await auth.requireAdmin(req);
        throw M.badRequest('aktion_unbekannt');
    }
    if (out === null) throw notFound();
    auth.sendJson(res, { ok: true, result: out });
}

module.exports = async function handler(req, res) {
    try {
        if (!auth.methodOnly(req, res, ['GET', 'POST'])) return;
        if (req.method === 'GET') await detail(req, res);
        else await action(req, res);
    } catch (err) {
        auth.sendError(res, err);
    }
};
