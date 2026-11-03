// GET /api/search?q= — Schnellsuche (Cmd+K): Whop-ID, E-Mail-Anfang, Name, Benutzername, Firmen-Domain.
// Alles ueber Indizes (Praefixsuche); Treffer mit maskierter E-Mail.

var auth = require('../lib/auth');
var db = require('../lib/db');
var M = require('../lib/members');

module.exports = async function handler(req, res) {
    try {
        if (!auth.methodOnly(req, res, ['GET'])) return;
        await auth.requireAdmin(req, 'users.read');
        var q = String((req.query && req.query.q) || '').trim().slice(0, 100);
        if (q.length < 2) return auth.sendJson(res, { rows: [] });
        var rows = (await db.rpc('sync_admin_search', { p_q: q, p_limit: 8 })) || [];
        auth.sendJson(res, { rows: rows.map(M.maskMember) });
    } catch (err) {
        auth.sendError(res, err);
    }
};
