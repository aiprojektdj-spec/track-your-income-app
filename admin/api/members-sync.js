// POST /api/members-sync — Mitglieder aus Whop abgleichen (nur auf Knopfdruck des Admins).
// Env: WHOP_API_KEY (Company-Key, nur Lesen), optional WHOP_COMPANY_ID.
// Schutz: liefert Whop 0 Mitgliedschaften, wird NICHT geschrieben (kaputte Antwort soll nichts leeren;
// der Abgleich loescht ohnehin nie, aber so bleibt der Fehler sichtbar).

var auth = require('../lib/auth');
var audit = require('../lib/audit');
var db = require('../lib/db');
var M = require('../lib/members');

var CHUNK = 500;

module.exports = async function handler(req, res) {
    try {
        if (!auth.methodOnly(req, res, ['POST'])) return;
        var admin = await auth.requireAdmin(req, 'users.edit');
        if (!process.env.WHOP_API_KEY) {
            var e = new Error('whop_nicht_konfiguriert');
            e.status = 503; e.code = 'whop_nicht_konfiguriert';
            throw e;
        }
        var w = await M.whopLaden(process.env, fetch);
        if (!w.rows.length) return auth.sendJson(res, { ok: false, error: 'whop_leer', gelesen: w.gelesen }, 502);

        var c = audit.ctx(req, admin), n = 0;
        for (var i = 0; i < w.rows.length; i += CHUNK) {
            n += await db.rpc('sync_admin_members_upsert', {
                p_rows: w.rows.slice(i, i + CHUNK), p_ctx: c, p_audit: i + CHUNK >= w.rows.length
            }, 30000);
        }
        auth.sendJson(res, { ok: true, mitglieder: w.rows.length, mitgliedschaften: w.gelesen });
    } catch (err) {
        auth.sendError(res, err);
    }
};
