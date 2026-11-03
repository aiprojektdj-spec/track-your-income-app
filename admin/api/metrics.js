// /api/metrics
//   GET  ?from=YYYY-MM-DD&to=YYYY-MM-DD   Kennzahlen, Vorperiode (gleich lang), Tagesreihe, Kohorten (Standard: 30 Tage)
//   POST {}                               Tageskennzahlen jetzt berechnen (Knopfdruck, mit Audit-Eintrag)
// Kein Cron: auch nach jedem Mitglieder-/Zahlungsabgleich wird neu berechnet (members-sync, payments-sync).

var auth = require('../lib/auth');
var audit = require('../lib/audit');
var db = require('../lib/db');
var D = require('../lib/dashboard');

module.exports = async function handler(req, res) {
    try {
        if (!auth.methodOnly(req, res, ['GET', 'POST'])) return;
        var admin = await auth.requireAdmin(req, 'metrics.read');
        if (req.method === 'POST') {
            var out = await db.rpc('sync_admin_metrics_compute', { p_ctx: audit.ctx(req, admin), p_audit: true }, 30000);
            return auth.sendJson(res, { ok: true, ergebnis: out });
        }
        var r = D.range(req.query || {});
        var d = await db.rpc('sync_admin_dashboard', { p_from: r.from, p_to: r.to });
        d.kohorten = (await db.rpc('sync_admin_cohorts', {})) || [];
        d.von = r.from;
        d.bis = r.to;
        auth.sendJson(res, d);
    } catch (err) {
        auth.sendError(res, err);
    }
};
