// Admin-Panel Phase e (Betrieb, Missbrauch, Bulk, Export):  node test/test-admin-phase-e.js
//  A) Validierung, getippte Bestaetigung, CSV-Schutz
//  B) Bulk-Endpunkt: Trockenlauf, Start nur mit richtiger Bestaetigung, Obergrenze, Schritte
//  C) Missbrauchs-Endpunkt
//  D) Export: Maskierung, Klartext nur mit Haken + Audit, CSV-Injection
//  E) Migration
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
function throws(fn, code) { try { fn(); return false; } catch (e) { return e.status === 400 && e.code === code; } }

const B = require(path.join(A, 'lib', 'betrieb.js'));

// ── A) Validierung ─────────────────────────────────────────────────────────────
check('A1 Filter: unbekannte Werte verworfen', JSON.stringify(B.filterFrom({ q: 'x', status: 'hacked', tag: 'VIP', suspended: 'true', evil: 1 })) ===
    JSON.stringify({ q: 'x', status: '', tag: 'VIP', suspended: 'true' }) && B.filterFrom(null).q === '');
check('A2 Filter: ungueltiger Tag 400', throws(() => B.filterFrom({ tag: '<b>' }), 'tag_ungueltig'));
check('A3 Aktion: nur tag.add und suspend', B.operation({ op: 'suspend', param: 'Missbrauch' }).wort === 'SPERREN' && B.operation({ op: 'tag.add', param: ' VIP ' }).param === 'VIP' &&
    throws(() => B.operation({ op: 'delete', param: 'x' }), 'aktion_unbekannt') && throws(() => B.operation({ op: 'suspend', param: 'ab' }), 'grund_ungueltig') &&
    throws(() => B.operation({ op: 'tag.add', param: '<x>' }), 'tag_ungueltig'));
check('A4 Bestaetigung enthaelt Aktion und Anzahl', B.erwartung('SPERREN', 37) === 'SPERREN 37');
check('A5 CSV: Formeln und Zeilenumbrueche entschaerft', B.zelle('=HYPERLINK("x")') === "\"'=HYPERLINK(\"\"x\"\")\"" && B.zelle('+49 170') === "'+49 170" && B.zelle('a,b') === '"a,b"' &&
    B.zelle('zeile1\nzeile2') === '"zeile1\nzeile2"' && B.zelle(-5) === '-5' && B.zelle(null) === '' && B.zelle({ a: 1 }) === '"{""a"":1}"');
const csv = B.csv(['a', 'b'], [{ a: 1, b: '@x' }]);
check('A6 CSV: BOM, Kopfzeile, CRLF', csv.charCodeAt(0) === 0xFEFF && csv === '﻿a,b\r\n1,\'@x\r\n');

(async () => {
    // ── Mocks ─────────────────────────────────────────────────────────────────
    process.env.SUPABASE_URL = 'http://sb.mock';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test';
    process.env.ADMIN_EMAIL = 'chef@example.com';
    const jwt = 'x.' + Buffer.from(JSON.stringify({ aal: 'aal2', session_id: 's1' })).toString('base64url') + '.y';
    let rpcs = [], startAntwort = null, decideAntwort = { id: 1 };
    const member = (i) => ({ whop_user_id: 'user_' + i, email: '=cmd' + i + '@x.de', name: 'N' + i, username: 'u', status: 'active', tags: ['a', 'b'] });
    global.fetch = async (url, opts) => {
        if (url.indexOf('/auth/v1/user') !== -1) return { ok: true, status: 200, json: async () => ({ email: 'chef@example.com', email_confirmed_at: '2026-01-01' }) };
        const name = url.split('/rpc/')[1];
        const body = JSON.parse(opts.body);
        rpcs.push({ name, body });
        const out = name === 'sync_admin_session_touch' ? true
            : name === 'sync_admin_bulk_preview' ? { anzahl: 3, beispiele: [member(1), member(2)] }
            : name === 'sync_admin_bulk_start' ? (startAntwort || { run_id: 7, total: body.p_expect })
            : name === 'sync_admin_bulk_step' || name === 'sync_admin_bulk_get' ? { lauf: { id: 7, done: 3, failed: 0, total: 3, status: 'fertig' }, fehler: [] }
            : name === 'sync_admin_abuse_list' ? [{ id: 5, kind: 'failed_payments', subject: 'user_9', whop_user_id: 'user_9', email: 'a@x.de', status: 'offen' },
                                                  { id: 6, kind: 'signup_domain', subject: 'firma.de', whop_user_id: null, email: null, status: 'offen' }]
            : name === 'sync_admin_abuse_decide' ? decideAntwort
            : name === 'sync_admin_abuse_scan' ? 2
            : name === 'sync_admin_betrieb' ? { alarme: [] }
            : name === 'sync_admin_members_list' ? { total: 2, rows: [member(1), member(2)] }
            : name === 'sync_admin_payments_export' ? [{ id: 'pay_1', whop_user_id: 'user_1', amount_cents: 1500, failure_message: '=1+1' }]
            : name === 'sync_admin_audit_search' ? [{ id: 3, ts: 'x', admin_email: 'chef@example.com', action: 'a', before: null, after: { z: 1 } }]
            : { ok: 1 };
        return { ok: true, status: 200, text: async () => JSON.stringify(out) };
    };
    const bulk = require(path.join(A, 'api', 'bulk.js')), abuse = require(path.join(A, 'api', 'abuse.js')),
          exportApi = require(path.join(A, 'api', 'export.js')), betrieb = require(path.join(A, 'api', 'betrieb.js'));
    function run(handler, req) {
        return new Promise((resolve) => {
            const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; },
                end(b) { let j = null; try { j = b ? JSON.parse(b) : null; } catch (e) {} resolve({ code: this.statusCode, body: j, text: b, headers: this.headers }); } };
            req.headers = Object.assign({ authorization: 'Bearer ' + jwt, 'user-agent': 'UA', 'x-forwarded-for': '4.4.4.4' }, req.headers);
            handler(req, res);
        });
    }
    const names = () => rpcs.map(r => r.name);

    // ── B) Bulk ───────────────────────────────────────────────────────────────
    let r = await run(bulk, { method: 'POST', body: { action: 'preview', filter: { status: 'active' } } });
    check('B1 Trockenlauf: Anzahl, E-Mails maskiert, Obergrenze, aendert nichts', r.code === 200 && r.body.anzahl === 3 && r.body.beispiele[0].email === '=***@x.de' && r.body.max === 500 &&
        !names().includes('sync_admin_bulk_start'));
    rpcs = [];
    r = await run(bulk, { method: 'POST', body: { action: 'start', op: 'suspend', param: 'Missbrauch', filter: {}, expect: 3, confirm: 'SPERREN 4' } });
    check('B2 falsche Bestaetigung (Anzahl): 400, nichts gestartet', r.code === 400 && r.body.error === 'bestaetigung_falsch' && !names().includes('sync_admin_bulk_start'));
    r = await run(bulk, { method: 'POST', body: { action: 'start', op: 'suspend', param: 'Missbrauch', filter: {}, expect: 3, confirm: 'TAGGEN 3' } });
    check('B3 Bestaetigung einer anderen Aktion zaehlt nicht', r.code === 400 && !names().includes('sync_admin_bulk_start'));
    r = await run(bulk, { method: 'POST', body: { action: 'start', op: 'suspend', param: 'Missbrauch', filter: { status: 'active' }, expect: 3, confirm: 'SPERREN 3' } });
    const st = rpcs.find(c => c.name === 'sync_admin_bulk_start');
    check('B4 Start: Anzahl, Obergrenze 500, Filter, Audit-Kontext', r.code === 200 && st.body.p_expect === 3 && st.body.p_max === 500 && st.body.p_filter.status === 'active' &&
        st.body.p_ctx.admin === 'chef@example.com' && st.body.p_ctx.ip === '4.4.4.4');
    startAntwort = { fehler: 'zu_viele', anzahl: 900 };
    r = await run(bulk, { method: 'POST', body: { action: 'start', op: 'tag.add', param: 'VIP', filter: {}, expect: 900, confirm: 'TAGGEN 900' } });
    check('B5 zu viele Mitglieder: 400', r.code === 400 && r.body.error === 'zu_viele');
    startAntwort = { fehler: 'anzahl_geaendert', anzahl: 5 };
    r = await run(bulk, { method: 'POST', body: { action: 'start', op: 'tag.add', param: 'VIP', filter: {}, expect: 3, confirm: 'TAGGEN 3' } });
    check('B6 Anzahl hat sich geaendert: 409', r.code === 409 && r.body.error === 'anzahl_geaendert');
    startAntwort = null;
    rpcs = [];
    r = await run(bulk, { method: 'POST', body: { action: 'step', runId: 7 } });
    check('B7 Schritt: Lauf-ID, Batch hoechstens 50', r.code === 200 && rpcs.find(c => c.name === 'sync_admin_bulk_step').body.p_batch === 50 && r.body.lauf.status === 'fertig');
    r = await run(bulk, { method: 'POST', body: { action: 'step', runId: 'abc' } });
    check('B8 ungueltige Lauf-ID: 400', r.code === 400);
    r = await run(bulk, { method: 'POST', body: { action: 'alles_loeschen' } });
    check('B9 unbekannte Aktion: 400; GET nicht erlaubt', r.code === 400 && (await run(bulk, { method: 'GET', query: {} })).code === 405);
    r = await run(bulk, { method: 'POST', body: { action: 'preview' }, headers: { authorization: '' } });
    check('B10 ohne Token 401', r.code === 401);

    // ── C) Missbrauch ─────────────────────────────────────────────────────────
    rpcs = [];
    r = await run(abuse, { method: 'GET', query: {} });
    check('C1 Liste: E-Mails maskiert', r.code === 200 && r.body.rows[0].email === 'a***@x.de');
    r = await run(abuse, { method: 'POST', body: { action: 'scan' } });
    check('C2 Pruefung per Knopf mit Audit', r.code === 200 && r.body.neu === 2 && rpcs.some(c => c.name === 'sync_admin_abuse_scan' && c.body.p_audit === true));
    rpcs = [];
    r = await run(abuse, { method: 'POST', body: { action: 'decide', id: 5, decision: 'gesperrt', reason: 'Karten-Test', confirm: 'falsch' } });
    check('C3 Sperren ohne richtige Whop-ID: 400, keine Entscheidung', r.code === 400 && r.body.error === 'bestaetigung_falsch' && !names().includes('sync_admin_abuse_decide'));
    r = await run(abuse, { method: 'POST', body: { action: 'decide', id: 5, decision: 'gesperrt', reason: 'x', confirm: 'user_9' } });
    check('C4 Sperren ohne Grund: 400', r.code === 400 && r.body.error === 'grund_ungueltig');
    r = await run(abuse, { method: 'POST', body: { action: 'decide', id: 5, decision: 'gesperrt', reason: 'Karten-Test', confirm: 'user_9' } });
    check('C5 Sperren mit Grund und Whop-ID: Entscheidung an die DB', r.code === 200 && rpcs.some(c => c.name === 'sync_admin_abuse_decide' && c.body.p_decision === 'gesperrt' && c.body.p_ctx.admin === 'chef@example.com'));
    r = await run(abuse, { method: 'POST', body: { action: 'decide', id: 6, decision: 'freigegeben' } });
    check('C6 Freigeben braucht keine Bestaetigung', r.code === 200);
    decideAntwort = { fehler: 'domain_nicht_sperrbar' };
    r = await run(abuse, { method: 'POST', body: { action: 'decide', id: 6, decision: 'gesperrt', reason: 'Domain' } });
    check('C7 Domain sperren: abgelehnt (400)', r.code === 400 && r.body.error === 'domain_nicht_sperrbar');
    decideAntwort = null;
    r = await run(abuse, { method: 'POST', body: { action: 'decide', id: 99, decision: 'freigegeben' } });
    check('C8 unbekannte/entschiedene Meldung: 404', r.code === 404);
    r = await run(betrieb, { method: 'GET', query: {} });
    check('C9 Betriebsansicht lesbar, POST nicht erlaubt', r.code === 200 && (await run(betrieb, { method: 'POST', body: {} })).code === 405);

    // ── D) Export ─────────────────────────────────────────────────────────────
    rpcs = [];
    r = await run(exportApi, { method: 'GET', query: { kind: 'members', status: 'active' } });
    const log = rpcs.find(c => c.name === 'sync_admin_audit_add');
    check('D1 Mitglieder-CSV: maskiert, BOM, Kopfzeile, Formel entschaerft', r.code === 200 && r.headers['Content-Type'].indexOf('text/csv') === 0 && r.text.charCodeAt(0) === 0xFEFF &&
        r.text.indexOf('whop_user_id,email') === 1 && r.text.indexOf("'=***@x.de") !== -1 && r.text.indexOf('cmd1@x.de') === -1);
    check('D2 Export ist Download und steht im Audit-Log (Zeilenzahl, kein Klartext)', /attachment; filename="stackr-members-\d{4}-\d{2}-\d{2}\.csv"/.test(r.headers['Content-Disposition']) &&
        log && log.body.p_action === 'export.run' && log.body.p_after.zeilen === 2 && log.body.p_after.klartext === false && r.headers['Cache-Control'] === 'no-store');
    rpcs = [];
    r = await run(exportApi, { method: 'GET', query: { kind: 'members', reveal: '1' } });
    const log2 = rpcs.find(c => c.name === 'sync_admin_audit_add');
    check('D3 Klartext nur mit reveal=1, dann Audit mit klartext:true', r.text.indexOf('cmd1@x.de') !== -1 && log2.body.p_after.klartext === true);
    rpcs = [];
    r = await run(exportApi, { method: 'GET', query: { kind: 'payments', from: '2026-10-01', to: '2026-10-31' } });
    const pe = rpcs.find(c => c.name === 'sync_admin_payments_export');
    check('D4 Zahlungen-CSV: Zeitraum, Limit 5000, keine E-Mail-Spalte, Formel entschaerft', r.code === 200 && pe.body.p_from === '2026-10-01' && pe.body.p_limit === 5000 &&
        r.text.indexOf('email') === -1 && r.text.indexOf("'=1+1") !== -1);
    r = await run(exportApi, { method: 'GET', query: { kind: 'audit' } });
    check('D5 Audit-CSV mit Vorher/Nachher-JSON', r.code === 200 && r.text.indexOf('"{""z"":1}"') !== -1);
    r = await run(exportApi, { method: 'GET', query: { kind: 'passwoerter' } });
    check('D6 unbekannte Art: 400, kein Download', r.code === 400 && !r.headers['Content-Disposition']);
    r = await run(exportApi, { method: 'GET', query: { kind: 'members' }, headers: { authorization: '' } });
    check('D7 ohne Token 401', r.code === 401);

    // ── E) Migration und Rechte ───────────────────────────────────────────────
    const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261102000005_admin_betrieb.sql'), 'utf8');
    const fn = (n) => { const i = sql.indexOf('create or replace function ' + n + '('); return sql.slice(i, sql.indexOf('end $$;', i) + 1 || undefined); };
    check('E1 Sperren aus der Warteschlange laeuft ueber die auditierte Sperrfunktion', /sync_admin_member_suspend\(f\.whop_user_id/.test(fn('sync_admin_abuse_decide')));
    check('E2 Bulk: je Mitglied eigener Unterblock (ein Fehler stoppt den Lauf nicht) und Lauf-Kennung im Audit', /exception when others then/.test(fn('sync_admin_bulk_step')) && /\[bulk /.test(fn('sync_admin_bulk_step')));
    check('E3 Bulk-Start prueft Anzahl und Obergrenze in der DB', /anzahl_geaendert/.test(fn('sync_admin_bulk_start')) && /zu_viele/.test(fn('sync_admin_bulk_start')));
    check('E4 nur zwei Bulk-Operationen in der Tabelle erlaubt', /check \(op in \('tag\.add', 'suspend'\)\)/.test(sql));
    check('E5 RLS an, kein Zugriff fuer anon/authenticated', /alter table admin_bulk_runs\s+enable row level security/.test(sql) && /revoke all on admin_abuse_flags, admin_bulk_runs, admin_bulk_items from public, anon, authenticated/.test(sql));
    const perms = require(path.join(A, 'lib', 'permissions.js'));
    check('E6 neue Rechte nur fuer superadmin (und ops.read fuer engineering)', perms.can('superadmin', 'abuse.review') && !perms.can('readonly', 'bulk.run') && !perms.can('support', 'export.run') &&
        perms.can('engineering', 'ops.read') && !perms.can('engineering', 'abuse.review'));
    const apis = fs.readdirSync(path.join(A, 'api'));
    check('E7 jeder Endpunkt ruft requireAdmin', apis.every(f => /requireAdmin/.test(fs.readFileSync(path.join(A, 'api', f), 'utf8'))));

    console.log('\n' + pass + '/' + total + ' bestanden');
    process.exit(pass === total ? 0 : 1);
})();
