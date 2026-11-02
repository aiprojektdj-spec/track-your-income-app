// POST /api/payments-sync — Zahlungen aus Whop abgleichen (nur auf Knopfdruck, nur lesend bei Whop).
// Env: WHOP_API_KEY (Lese-Key). Liefert Whop nichts, wird nicht geschrieben.

var auth = require('../lib/auth');
var audit = require('../lib/audit');
var db = require('../lib/db');
var B = require('../lib/billing');

var CHUNK = 500;

module.exports = async function handler(req, res) {
    try {
        if (!auth.methodOnly(req, res, ['POST'])) return;
        var admin = await auth.requireAdmin(req, 'billing.read');
        if (!process.env.WHOP_API_KEY) {
            var e = new Error('whop_nicht_konfiguriert');
            e.status = 503; e.code = 'whop_nicht_konfiguriert';
            throw e;
        }
        var rows = await B.zahlungenLaden(process.env, fetch);
        if (!rows.length) return auth.sendJson(res, { ok: false, error: 'whop_leer' }, 502);

        var c = audit.ctx(req, admin);
        for (var i = 0; i < rows.length; i += CHUNK) {
            await db.rpc('sync_admin_payments_upsert', {
                p_rows: rows.slice(i, i + CHUNK), p_ctx: c, p_audit: i + CHUNK >= rows.length
            }, 30000);
        }
        var metriken = true;
        try { await db.rpc('sync_admin_metrics_compute', { p_ctx: c, p_audit: false }, 30000); }
        catch (e2) { metriken = false; }   // Abgleich war erfolgreich; Kennzahlen lassen sich per Knopf nachholen
        auth.sendJson(res, { ok: true, zahlungen: rows.length, metriken: metriken });
    } catch (err) {
        auth.sendError(res, err);
    }
};
