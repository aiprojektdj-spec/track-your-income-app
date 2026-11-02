// Stackr Admin — Audit-Log schreiben und lesen
// =============================================================================
// Jede Admin-Aktion mit Wirkung ruft logAction() VOR der Antwort auf. Schlaegt das
// Protokollieren fehl, schlaegt die Aktion fehl (kein Handeln ohne Spur): der Aufrufer
// laesst den Fehler durchlaufen. Tabelle ist append-only (Trigger, s. Migration).
// =============================================================================

var db = require('./db');

function clientIp(req) {
    var xf = (req.headers && req.headers['x-forwarded-for']) || '';
    return String(xf).split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '';
}

async function logAction(req, admin, entry) {
    return db.rpc('admin_audit_add', {
        p_admin:       admin.email,
        p_action:      entry.action,
        p_target_type: entry.targetType || '',
        p_target_id:   entry.targetId == null ? '' : String(entry.targetId),
        p_before:      entry.before === undefined ? null : entry.before,
        p_after:       entry.after === undefined ? null : entry.after,
        p_ip:          clientIp(req),
        p_ua:          (req.headers && req.headers['user-agent']) || ''
    });
}

function nz(v) { return v ? String(v) : null; }

function iso(v) {
    if (!v) return null;
    var d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

async function search(f) {
    return db.rpc('admin_audit_search', {
        p_admin:       nz(f.admin),
        p_action:      nz(f.action),
        p_target_type: nz(f.targetType),
        p_target_id:   nz(f.targetId),
        p_from:        iso(f.from),
        p_to:          iso(f.to),
        p_limit:       Math.min(Math.max(parseInt(f.limit, 10) || 50, 1), 200),
        p_before_id:   f.beforeId ? parseInt(f.beforeId, 10) || null : null
    });
}

module.exports = { logAction: logAction, search: search, clientIp: clientIp };
