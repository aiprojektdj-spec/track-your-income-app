// GET /api/billing?id=<whop_user_id>  Zahlungen eines Mitglieds (Karte nur Marke + letzte 4)
// GET /api/billing?dunning=1          Mahnliste: ueberfaellige Abos und fehlgeschlagene Zahlungen (30 Tage)
// E-Mails sind maskiert (wie in der Mitgliederliste).

var auth = require('../lib/auth');
var db = require('../lib/db');
var M = require('../lib/members');

module.exports = async function handler(req, res) {
    try {
        if (!auth.methodOnly(req, res, ['GET'])) return;
        await auth.requireAdmin(req, 'billing.read');
        var q = req.query || {};
        if (q.dunning === '1') {
            var d = await db.rpc('sync_admin_dunning', {});
            d.past_due = d.past_due.map(M.maskMember);
            d.failed = d.failed.map(M.maskMember);
            return auth.sendJson(res, d);
        }
        auth.sendJson(res, await db.rpc('sync_admin_payments_for', { p_id: M.validId(q.id) }));
    } catch (err) {
        auth.sendError(res, err);
    }
};
