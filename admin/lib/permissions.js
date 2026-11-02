// Stackr Admin — Rechte: eine Config, Rollen -> Aktionen
// =============================================================================
// Einziger Ort fuer Rechte. Heute gibt es nur einen Admin (Rolle superadmin); die Rollen
// darunter sind vorbereitet, falls spaeter jemand dazukommt. Server-Endpunkte pruefen
// IMMER ueber can(); die UI blendet nur zusaetzlich aus.
// =============================================================================

var PERMISSIONS = [
    'users.read', 'users.reveal_pii', 'users.suspend', 'users.edit', 'users.delete',
    'notes.write', 'tags.write',
    'billing.read', 'billing.refund', 'billing.credit', 'billing.plan_change', 'billing.cancel',
    'metrics.read',
    'flags.read', 'flags.edit',
    'audit.read',
    'export.run', 'bulk.run',
    'ops.read', 'abuse.review'
];

var ROLES = {
    superadmin:  PERMISSIONS.slice(),
    support:     ['users.read', 'users.suspend', 'notes.write', 'tags.write', 'billing.read', 'audit.read'],
    finance:     ['users.read', 'billing.read', 'billing.refund', 'billing.credit', 'billing.plan_change',
                  'billing.cancel', 'metrics.read', 'export.run'],
    engineering: ['users.read', 'flags.read', 'flags.edit', 'metrics.read', 'audit.read', 'ops.read'],
    readonly:    ['users.read', 'billing.read', 'metrics.read', 'flags.read', 'audit.read']
};

function can(role, permission) {
    if (!Object.prototype.hasOwnProperty.call(ROLES, role)) return false;
    if (PERMISSIONS.indexOf(permission) === -1) return false;   // unbekanntes Recht -> nie erlaubt
    return ROLES[role].indexOf(permission) !== -1;
}

module.exports = { PERMISSIONS: PERMISSIONS, ROLES: ROLES, can: can };
