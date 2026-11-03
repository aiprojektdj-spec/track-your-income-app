// /api/plans — Monatsbetrag je Whop-Plan (Grundlage fuer MRR)
//   GET                                       gepflegte Plaene + aktive Plan-IDs ohne Betrag
//   POST { plan_id, label, monthly_cents }    Plan speichern (Audit-Eintrag mit vorher/nachher)

var auth = require('../lib/auth');
var audit = require('../lib/audit');
var db = require('../lib/db');
var D = require('../lib/dashboard');

module.exports = async function handler(req, res) {
    try {
        if (!auth.methodOnly(req, res, ['GET', 'POST'])) return;
        if (req.method === 'GET') {
            await auth.requireAdmin(req, 'metrics.read');
            return auth.sendJson(res, await db.rpc('sync_admin_plans_list', {}));
        }
        var admin = await auth.requireAdmin(req, 'users.edit');
        var p = D.plan(req.body && typeof req.body === 'object' ? req.body : {});
        p.p_ctx = audit.ctx(req, admin);
        auth.sendJson(res, { ok: true, plan: await db.rpc('sync_admin_plan_save', p) });
    } catch (err) {
        auth.sendError(res, err);
    }
};
