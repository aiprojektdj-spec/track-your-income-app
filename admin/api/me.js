// GET /api/me — Wer bin ich? Prueft Login, MFA und Idle-Timeout und haelt die Sitzung wach.

var auth = require('../lib/auth');
var perms = require('../lib/permissions');

module.exports = async function handler(req, res) {
    try {
        if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(); }
        var admin = await auth.requireAdmin(req);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ email: admin.email, role: admin.role, permissions: perms.ROLES[admin.role] }));
    } catch (err) {
        auth.sendError(res, err);
    }
};
