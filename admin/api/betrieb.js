// GET /api/betrieb — Betriebsansicht aus vorhandenen Daten: Alarme, Client-Fehler, Loeschplan, Stand der Abgleiche

var auth = require('../lib/auth');
var db = require('../lib/db');

module.exports = async function handler(req, res) {
    try {
        if (!auth.methodOnly(req, res, ['GET'])) return;
        await auth.requireAdmin(req, 'ops.read');
        auth.sendJson(res, await db.rpc('sync_admin_betrieb', {}));
    } catch (err) {
        auth.sendError(res, err);
    }
};
