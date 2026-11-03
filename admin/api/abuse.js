// /api/abuse — Missbrauchs-Warteschlange
//   GET [?status=offen|freigegeben|gesperrt]            Liste (E-Mails maskiert)
//   POST { action:'scan' }                              Pruefung jetzt (Knopfdruck, kein Cron)
//   POST { action:'decide', id, decision:'freigegeben'|'gesperrt', reason, confirm }
//        'gesperrt' sperrt das Mitglied (nur bei Mitglieder-Meldungen) und braucht die getippte Whop-ID als confirm

var auth = require('../lib/auth');
var audit = require('../lib/audit');
var db = require('../lib/db');
var M = require('../lib/members');

var STATI = ['offen', 'freigegeben', 'gesperrt'];
var FEHLER = { domain_nicht_sperrbar: 400, mitglied_fehlt: 404, entscheidung_ungueltig: 400 };

module.exports = async function handler(req, res) {
    try {
        if (!auth.methodOnly(req, res, ['GET', 'POST'])) return;
        if (req.method === 'GET') {
            await auth.requireAdmin(req, 'ops.read');
            var s = req.query && STATI.indexOf(req.query.status) !== -1 ? req.query.status : null;
            var rows = (await db.rpc('sync_admin_abuse_list', { p_status: s })) || [];
            return auth.sendJson(res, { rows: rows.map(M.maskMember) });
        }
        var admin = await auth.requireAdmin(req, 'abuse.review');
        var b = req.body && typeof req.body === 'object' ? req.body : {};
        var ctx = audit.ctx(req, admin);
        if (b.action === 'scan') {
            var n = await db.rpc('sync_admin_abuse_scan', { p_ctx: ctx, p_audit: true });
            return auth.sendJson(res, { ok: true, neu: n });
        }
        if (b.action === 'decide') {
            var id = parseInt(b.id, 10);
            if (!(id > 0)) throw M.badRequest('id_ungueltig');
            var reason = String(b.reason || '').trim().slice(0, 300);
            if (b.decision === 'gesperrt') {
                if (reason.length < 3) throw M.badRequest('grund_ungueltig');
                // Getippte Bestaetigung: Whop-ID des betroffenen Mitglieds (Domain-Meldungen sind nicht sperrbar)
                var list = await db.rpc('sync_admin_abuse_list', { p_status: 'offen' });
                var f = (list || []).filter(function (x) { return x.id === id; })[0];
                if (f && f.whop_user_id && String(b.confirm || '').trim() !== f.whop_user_id) throw M.badRequest('bestaetigung_falsch');
            }
            var out = await db.rpc('sync_admin_abuse_decide', { p_id: id, p_decision: String(b.decision || ''), p_reason: reason, p_ctx: ctx });
            if (out === null) {
                var nf = new Error('nicht_gefunden'); nf.status = 404; nf.code = 'nicht_gefunden'; throw nf;
            }
            if (out.fehler) {
                var e = new Error(out.fehler); e.status = FEHLER[out.fehler] || 400; e.code = out.fehler; throw e;
            }
            return auth.sendJson(res, { ok: true });
        }
        throw M.badRequest('aktion_unbekannt');
    } catch (err) {
        auth.sendError(res, err);
    }
};
