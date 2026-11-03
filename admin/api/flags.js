// /api/flags — Feature-Flags
//   GET                                    alle Flags
//   POST { action:'save', key, description, status:'off'|'rules'|'on', percent, user_ids, account_ids, plan_ids }
//   POST { action:'kill', key, killed }    Notaus (wirkt sofort, schlaegt alle Regeln)
// Jede Aenderung steht im Audit-Log (vorher/nachher). Auswertung in Stackr: api/_flags.js.

var auth = require('../lib/auth');
var audit = require('../lib/audit');
var db = require('../lib/db');
var D = require('../lib/dashboard');
var M = require('../lib/members');

module.exports = async function handler(req, res) {
    try {
        if (!auth.methodOnly(req, res, ['GET', 'POST'])) return;
        if (req.method === 'GET') {
            await auth.requireAdmin(req, 'flags.read');
            return auth.sendJson(res, { flags: (await db.rpc('sync_admin_flags_list', {})) || [] });
        }
        var admin = await auth.requireAdmin(req, 'flags.edit');
        var b = req.body && typeof req.body === 'object' ? req.body : {};
        var ctx = audit.ctx(req, admin), out;
        if (b.action === 'save') {
            var p = D.flag(b);
            p.p_ctx = ctx;
            out = await db.rpc('sync_admin_flag_save', p);
        } else if (b.action === 'kill') {
            if (!D.KEY_RE.test(String(b.key || ''))) throw M.badRequest('key_ungueltig');
            out = await db.rpc('sync_admin_flag_kill', { p_key: b.key, p_killed: b.killed === true, p_ctx: ctx });
            if (out === null) {
                var e = new Error('nicht_gefunden');
                e.status = 404; e.code = 'nicht_gefunden';
                throw e;
            }
        } else {
            throw M.badRequest('aktion_unbekannt');
        }
        auth.sendJson(res, { ok: true, flag: out });
    } catch (err) {
        auth.sendError(res, err);
    }
};
