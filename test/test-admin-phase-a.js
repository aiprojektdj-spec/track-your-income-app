// Admin-Panel Phase a:  node test/test-admin-phase-a.js
//  A) Rechte: Rollen, unbekannte Rolle/Recht -> nie erlaubt
//  B) requireAdmin: Token, Allowlist, MFA (aal2), Idle-Timeout, Recht
//  C) Audit: logAction schickt alle Felder, search begrenzt Limit
//  D) Migration: append-only-Trigger, Rechte nur service_role, kein Endpunkt mit Schreib-/Loeschzugriff
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const A = path.join(ROOT, 'admin');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name); }
}

// ── A) Rechte ──────────────────────────────────────────────────────────────────
const perms = require(path.join(A, 'lib', 'permissions.js'));
check('A1 superadmin darf alles', perms.PERMISSIONS.every(p => perms.can('superadmin', p)));
check('A2 readonly darf nicht sperren/erstatten/Flags aendern',
    !perms.can('readonly', 'users.suspend') && !perms.can('readonly', 'billing.refund') && !perms.can('readonly', 'flags.edit'));
check('A3 support darf nicht erstatten', !perms.can('support', 'billing.refund') && perms.can('support', 'users.suspend'));
check('A4 unbekannte Rolle und unbekanntes Recht nie erlaubt',
    !perms.can('chef', 'users.read') && !perms.can('superadmin', 'alles.darf') && !perms.can('__proto__', 'users.read'));
check('A5 jede Rolle nutzt nur bekannte Rechte',
    Object.values(perms.ROLES).every(l => l.every(p => perms.PERMISSIONS.includes(p))));

// ── B) requireAdmin ────────────────────────────────────────────────────────────
function jwt(payload) {
    return 'x.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.y';
}
let userResp, touchResult, rpcCalls;
global.fetch = function (url, opts) {
    if (url.indexOf('/auth/v1/user') !== -1) {
        return Promise.resolve({ ok: !!userResp, status: userResp ? 200 : 401, json: () => Promise.resolve(userResp) });
    }
    const name = url.split('/rpc/')[1];
    rpcCalls.push({ name, body: JSON.parse(opts.body) });
    const out = name === 'sync_admin_session_touch' ? touchResult : 7;
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(out)) });
};
process.env.SUPABASE_URL = 'http://sb.mock';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test';
process.env.ADMIN_EMAIL = 'Chef@Example.com';
const auth = require(path.join(A, 'lib', 'auth.js'));

function reqWith(token) { return { headers: token ? { authorization: 'Bearer ' + token, 'x-forwarded-for': '1.2.3.4, 9.9.9.9', 'user-agent': 'UA' } : {} }; }
async function status(p) { try { await p; return 200; } catch (e) { return e.status || 'x'; } }

(async () => {
    const good = jwt({ aal: 'aal2', session_id: 's1' });
    userResp = { email: 'chef@example.com', email_confirmed_at: '2026-01-01' }; touchResult = true; rpcCalls = [];

    check('B1 ohne Token 401', await status(auth.requireAdmin(reqWith(''))) === 401);
    userResp = null;
    check('B2 ungueltiges Token 401', await status(auth.requireAdmin(reqWith(good))) === 401);
    userResp = { email: 'fremd@example.com', email_confirmed_at: '2026-01-01' };
    check('B3 fremde Mail 403', await status(auth.requireAdmin(reqWith(good))) === 403);
    userResp = { email: 'chef@example.com', email_confirmed_at: null };
    check('B4 unbestaetigte Mail 403', await status(auth.requireAdmin(reqWith(good))) === 403);
    userResp = { email: 'chef@example.com', email_confirmed_at: '2026-01-01' };
    check('B5 ohne MFA (aal1) 401', await status(auth.requireAdmin(reqWith(jwt({ aal: 'aal1', session_id: 's1' })))) === 401);
    touchResult = false;
    check('B6 Idle-Timeout 401', await status(auth.requireAdmin(reqWith(good))) === 401);
    touchResult = true;
    const ok = await auth.requireAdmin(reqWith(good), 'audit.read');
    check('B7 gueltig: Allowlist ohne Gross/Klein-Unterschied', ok.email === 'chef@example.com' && ok.role === 'superadmin');
    const touch = rpcCalls.filter(c => c.name === 'sync_admin_session_touch').pop();
    check('B8 Idle-Limit 30 min', touch && touch.body.p_idle_secs === 1800 && touch.body.p_sid === 's1');
    delete process.env.ADMIN_EMAIL;
    check('B9 ohne ADMIN_EMAIL 503 (sperrt statt oeffnet)', await status(auth.requireAdmin(reqWith(good))) === 503);
    process.env.ADMIN_EMAIL = 'chef@example.com';
    check('B10 unbekanntes Recht abgelehnt', await status(auth.requireAdmin(reqWith(good), 'gibt.es.nicht')) === 403);

    // ── C) Audit ──────────────────────────────────────────────────────────────
    const audit = require(path.join(A, 'lib', 'audit.js'));
    rpcCalls = [];
    await audit.logAction(reqWith(good), ok, { action: 'users.suspend', targetType: 'member', targetId: 42, before: { s: 'aktiv' }, after: { s: 'gesperrt' } });
    const add = rpcCalls[0];
    check('C1 logAction: Admin, Ziel, Diff, erste IP, User-Agent',
        add.name === 'sync_admin_audit_add' && add.body.p_admin === 'chef@example.com' && add.body.p_target_id === '42' &&
        add.body.p_before.s === 'aktiv' && add.body.p_after.s === 'gesperrt' && add.body.p_ip === '1.2.3.4' && add.body.p_ua === 'UA');
    rpcCalls = [];
    await audit.search({ limit: '99999', from: 'kein-datum', beforeId: 'abc' });
    const sb = rpcCalls[0].body;
    check('C2 search: Limit gedeckelt, ungueltiges Datum und beforeId -> null', sb.p_limit === 200 && sb.p_from === null && sb.p_before_id === null);

    // ── D) Migration und Endpunkte ────────────────────────────────────────────
    const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261102000001_admin_audit.sql'), 'utf8');
    check('D1 Trigger sperrt UPDATE/DELETE und TRUNCATE',
        /before update or delete on admin_audit_log/.test(sql) && /before truncate on admin_audit_log/.test(sql));
    check('D2 service_role-Rechte auf das Audit-Log stehen in der Migration', /grant select, insert, update, delete on admin_audit_log to service_role/.test(sql));
    check('D3 RLS an, anon/authenticated ohne Rechte',
        /alter table admin_audit_log enable row level security/.test(sql) && /revoke all on admin_audit_log, admin_sessions from public, anon, authenticated/.test(sql));
    const apiFiles = fs.readdirSync(path.join(A, 'api')).map(f => fs.readFileSync(path.join(A, 'api', f), 'utf8')).join('\n');
    check('D4 kein Endpunkt schreibt oder loescht Audit-Eintraege', !/sync_admin_audit_add|delete from admin_audit_log|update admin_audit_log/i.test(apiFiles));
    check('D5 jeder Endpunkt ruft requireAdmin', fs.readdirSync(path.join(A, 'api')).every(f => /requireAdmin/.test(fs.readFileSync(path.join(A, 'api', f), 'utf8'))));
    check('D6 admin/ ist vom Stackr-Deployment ausgeschlossen', /^admin\/$/m.test(fs.readFileSync(path.join(ROOT, '.vercelignore'), 'utf8')));

    console.log('\n' + pass + '/' + total + ' bestanden');
    process.exit(pass === total ? 0 : 1);
})();
