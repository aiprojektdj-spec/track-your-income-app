// GET /api/members — Mitgliederliste (Filter, Sortierung, Seiten); ?tags=1 liefert alle Tags mit Anzahl.
// E-Mail ist maskiert; Klartext gibt es nur im Detail (api/member.js, ?reveal=1, mit Audit).

var auth = require('../lib/auth');
var db = require('../lib/db');
var M = require('../lib/members');

module.exports = async function handler(req, res) {
    try {
        if (!auth.methodOnly(req, res, ['GET'])) return;
        await auth.requireAdmin(req, 'users.read');
        var q = req.query || {};
        if (q.tags === '1') return auth.sendJson(res, { tags: (await db.rpc('sync_admin_tags_liste', {})) || [] });

        var p = M.listParams(q);
        var out = await db.rpc('sync_admin_members_list', p);
        auth.sendJson(res, {
            total: out.total,
            page:  Math.floor(p.p_offset / p.p_limit) + 1,
            size:  p.p_limit,
            rows:  out.rows.map(M.maskMember)
        });
    } catch (err) {
        auth.sendError(res, err);
    }
};
