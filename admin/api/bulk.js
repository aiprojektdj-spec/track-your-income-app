// POST /api/bulk — Bulk-Aktionen auf alle Mitglieder eines Filters (Tag setzen, Sperren)
//   { action:'preview', filter }                       Trockenlauf: Anzahl + 10 Beispiele (E-Mails maskiert), aendert nichts
//   { action:'start', op, param, filter, expect, confirm }
//        expect = Anzahl aus dem Trockenlauf, confirm = getippt "<WORT> <Anzahl>" (z. B. "SPERREN 37").
//        Weicht die Anzahl ab (Daten haben sich geaendert) oder sind es > 500, passiert nichts.
//   { action:'step', runId }                           naechste <= 50 Mitglieder; Aufruf wiederholen bis status 'fertig'
//   { action:'get', runId }                            Stand + Fehlerliste
// Rechte: bulk.run PLUS das Recht der Einzelaktion (tags.write bzw. users.suspend).

var auth = require('../lib/auth');
var audit = require('../lib/audit');
var db = require('../lib/db');
var M = require('../lib/members');
var B = require('../lib/betrieb');

var FEHLER = { leer: 400, zu_viele: 400, anzahl_geaendert: 409 };

function runId(b) {
    var id = parseInt(b.runId, 10);
    if (!(id > 0)) throw M.badRequest('lauf_ungueltig');
    return id;
}

module.exports = async function handler(req, res) {
    try {
        if (!auth.methodOnly(req, res, ['POST'])) return;
        var admin = await auth.requireAdmin(req, 'bulk.run');
        var b = req.body && typeof req.body === 'object' ? req.body : {};
        var ctx = audit.ctx(req, admin);

        if (b.action === 'preview') {
            var p = await db.rpc('sync_admin_bulk_preview', { p_filter: B.filterFrom(b.filter) });
            p.beispiele = p.beispiele.map(M.maskMember);
            p.max = B.BULK_MAX;
            return auth.sendJson(res, p);
        }
        if (b.action === 'start') {
            var o = B.operation(b);
            await auth.requireAdmin(req, o.perm);
            var expect = parseInt(b.expect, 10);
            if (!(expect > 0)) throw M.badRequest('anzahl_ungueltig');
            if (String(b.confirm || '').trim() !== B.erwartung(o.wort, expect)) throw M.badRequest('bestaetigung_falsch');
            var r = await db.rpc('sync_admin_bulk_start', {
                p_op: o.op, p_param: o.param, p_filter: B.filterFrom(b.filter), p_max: B.BULK_MAX, p_expect: expect, p_ctx: ctx
            });
            if (r.fehler) {
                var e = new Error(r.fehler); e.status = FEHLER[r.fehler] || 400; e.code = r.fehler; e.anzahl = r.anzahl; throw e;
            }
            return auth.sendJson(res, r);
        }
        if (b.action === 'step') {
            var out = await db.rpc('sync_admin_bulk_step', { p_run: runId(b), p_batch: 50, p_ctx: ctx }, 25000);
            if (out === null) { var nf = new Error('nicht_gefunden'); nf.status = 404; nf.code = 'nicht_gefunden'; throw nf; }
            return auth.sendJson(res, out);
        }
        if (b.action === 'get') {
            var g = await db.rpc('sync_admin_bulk_get', { p_run: runId(b) });
            if (g === null) { var nf2 = new Error('nicht_gefunden'); nf2.status = 404; nf2.code = 'nicht_gefunden'; throw nf2; }
            return auth.sendJson(res, g);
        }
        throw M.badRequest('aktion_unbekannt');
    } catch (err) {
        auth.sendError(res, err);
    }
};
