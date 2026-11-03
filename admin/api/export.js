// GET /api/export?kind=members|payments|audit — CSV-Download (direkt, max. 5000 Zeilen, nichts bleibt auf dem Server)
//   members:  Filter wie in der Liste (q, status, tag, suspended); E-Mail maskiert,
//             reveal=1 liefert Klartext (Recht users.reveal_pii) — beides steht im Audit-Log
//   payments: from, to (YYYY-MM-DD, Standard 30 Tage); keine E-Mail, nur Whop-ID
//   audit:    Filter wie im Audit-Log (admin, action, targetType, targetId, from, to)
// Jeder Export schreibt "export.run" ins Audit-Log (Art, Zeilenzahl, ob Klartext).

var auth = require('../lib/auth');
var audit = require('../lib/audit');
var db = require('../lib/db');
var M = require('../lib/members');
var D = require('../lib/dashboard');
var B = require('../lib/betrieb');

var MEMBER_COLS  = ['whop_user_id', 'email', 'name', 'username', 'status', 'plan_id', 'signup_at', 'last_active_at', 'suspended_at', 'tags'];
var PAYMENT_COLS = ['id', 'whop_user_id', 'status', 'failed', 'amount_cents', 'refunded_cents', 'currency', 'card_brand', 'card_last4', 'created_at', 'paid_at', 'failure_message'];
var AUDIT_COLS   = ['id', 'ts', 'admin_email', 'action', 'target_type', 'target_id', 'ip', 'before', 'after'];

async function members(q, reveal) {
    var p = M.listParams(Object.assign({}, q, { page: 1, size: 100 }));
    p.p_limit = 200;
    var rows = [];
    for (var off = 0; off < B.EXPORT_MAX; off += 200) {
        p.p_offset = off;
        var out = await db.rpc('sync_admin_members_list', p, 20000);
        out.rows.forEach(function (m) { m.tags = (m.tags || []).join('|'); rows.push(reveal ? m : M.maskMember(m)); });
        if (out.rows.length < 200) break;
    }
    return { cols: MEMBER_COLS, rows: rows.slice(0, B.EXPORT_MAX) };
}

async function payments(q) {
    var r = D.range(q);
    var rows = await db.rpc('sync_admin_payments_export', { p_from: r.from, p_to: r.to, p_limit: B.EXPORT_MAX }, 20000);
    return { cols: PAYMENT_COLS, rows: rows };
}

async function auditRows(q) {
    var rows = [], before = null;
    while (rows.length < B.EXPORT_MAX) {
        var page = await audit.search({ admin: q.admin, action: q.action, targetType: q.targetType, targetId: q.targetId,
                                        from: q.from, to: q.to, limit: 200, beforeId: before });
        rows = rows.concat(page || []);
        if (!page || page.length < 200) break;
        before = page[page.length - 1].id;
    }
    return { cols: AUDIT_COLS, rows: rows.slice(0, B.EXPORT_MAX) };
}

module.exports = async function handler(req, res) {
    try {
        if (!auth.methodOnly(req, res, ['GET'])) return;
        var q = req.query || {};
        var reveal = q.reveal === '1';
        var admin = await auth.requireAdmin(req, 'export.run');
        if (reveal) await auth.requireAdmin(req, 'users.reveal_pii');

        var data;
        if (q.kind === 'members') {
            await auth.requireAdmin(req, 'users.read');
            data = await members(q, reveal);
        } else if (q.kind === 'payments') {
            await auth.requireAdmin(req, 'billing.read');
            data = await payments(q);
        } else if (q.kind === 'audit') {
            await auth.requireAdmin(req, 'audit.read');
            data = await auditRows(q);
        } else {
            throw M.badRequest('art_unbekannt');
        }

        await audit.logAction(req, admin, { action: 'export.run', targetType: 'export', targetId: q.kind,
            after: { zeilen: data.rows.length, klartext: reveal && q.kind === 'members', filter: { q: q.q || '', status: q.status || '', tag: q.tag || '' } } });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="stackr-' + q.kind + '-' + D.berlinTag() + '.csv"');
        res.setHeader('Cache-Control', 'no-store');
        res.end(B.csv(data.cols, data.rows));
    } catch (err) {
        auth.sendError(res, err);
    }
};
