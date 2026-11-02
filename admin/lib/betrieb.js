// Stackr Admin — Validierung und CSV fuer Bulk-Aktionen und Export
// =============================================================================

var M = require('./members');

var STATUS     = ['active', 'trialing', 'past_due', 'canceled', 'completed', 'expired', 'unresolved', 'drafted', 'paused'];
var BULK_MAX   = 500;
var EXPORT_MAX = 5000;
var OPS = {
    'tag.add': { perm: 'tags.write',    wort: 'TAGGEN' },
    'suspend': { perm: 'users.suspend', wort: 'SPERREN' }
};

function bad(code) { return M.badRequest(code); }

// Filter wie in der Mitgliederliste; unbekannte Werte werden verworfen
function filterFrom(f) {
    f = f && typeof f === 'object' ? f : {};
    return {
        q:         String(f.q || '').slice(0, 100),
        status:    STATUS.indexOf(f.status) !== -1 ? f.status : '',
        tag:       f.tag ? M.validTag(f.tag) : '',
        suspended: f.suspended === true || f.suspended === 'true' ? 'true' : f.suspended === false || f.suspended === 'false' ? 'false' : ''
    };
}

// op/param pruefen; Ergebnis { op, param, perm, wort }
function operation(b) {
    var def = OPS[b.op];
    if (!def) throw bad('aktion_unbekannt');
    var param = String(b.param || '').trim();
    if (b.op === 'tag.add') param = M.validTag(param);
    else if (param.length < 3 || param.length > 300) throw bad('grund_ungueltig');
    return { op: b.op, param: param, perm: def.perm, wort: def.wort };
}

// Die getippte Bestaetigung enthaelt Aktion UND Anzahl, z. B. "SPERREN 37"
function erwartung(wort, anzahl) { return wort + ' ' + anzahl; }

// ── CSV ─────────────────────────────────────────────────────────────────────────
// Zellen, die in Excel/Sheets als Formel gelten wuerden, bekommen ein ' davor (CSV-Injection)
function zelle(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    var s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function csv(spalten, zeilen) {
    var out = ['﻿' + spalten.map(zelle).join(',')];
    zeilen.forEach(function (z) { out.push(spalten.map(function (k) { return zelle(z[k]); }).join(',')); });
    return out.join('\r\n') + '\r\n';
}

module.exports = {
    BULK_MAX: BULK_MAX, EXPORT_MAX: EXPORT_MAX, OPS: OPS,
    filterFrom: filterFrom, operation: operation, erwartung: erwartung, csv: csv, zelle: zelle
};
