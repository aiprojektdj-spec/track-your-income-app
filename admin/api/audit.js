// GET /api/audit — Audit-Log durchsuchen (nur lesen; es gibt bewusst keinen Schreib-/Loesch-Endpunkt)
// Filter: admin, action, targetType, targetId, from, to, limit, beforeId (Keyset-Seite)

var auth = require('../lib/auth');
var audit = require('../lib/audit');

module.exports = async function handler(req, res) {
    try {
        if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(); }
        await auth.requireAdmin(req, 'audit.read');
        var q = req.query || {};
        var rows = await audit.search({
            admin: q.admin, action: q.action, targetType: q.targetType, targetId: q.targetId,
            from: q.from, to: q.to, limit: q.limit, beforeId: q.beforeId
        });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ rows: rows || [] }));
    } catch (err) {
        auth.sendError(res, err);
    }
};
