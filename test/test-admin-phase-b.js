// Admin-Panel Phase b (Mitglieder):  node test/test-admin-phase-b.js
//  A) Validierung, Listenparameter, PII-Maskierung
//  B) Whop-Abgleich: eine Zeile je Nutzer, beste Mitgliedschaft, aeltestes Anmeldedatum
//  C) Endpunkte: Rechtepruefung, getippte Bestaetigung, Audit-Kontext, Reveal-Protokoll
//  D) Stackr-Seite: api/_gesperrt.js (fail-open) und Einbau in sync/blob-upload/_auth
//  E) Migration: Audit atomar in den schreibenden Funktionen, Notiztext nicht im Log
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

const M = require(path.join(A, 'lib', 'members.js'));

// ── A) Validierung ─────────────────────────────────────────────────────────────
function throws(fn, code) { try { fn(); return false; } catch (e) { return e.status === 400 && e.code === code; } }
check('A1 Whop-ID: nur sichere Zeichen', M.validId('user_ab12') === 'user_ab12' && throws(() => M.validId("x'; drop"), 'id_ungueltig') && throws(() => M.validId(''), 'id_ungueltig'));
check('A2 Tag: Umlaute ok, Sonderzeichen/zu lang nicht', M.validTag(' at risk ') === 'at risk' && M.validTag('Büro') === 'Büro' &&
    throws(() => M.validTag('<b>'), 'tag_ungueltig') && throws(() => M.validTag('x'.repeat(31)), 'tag_ungueltig'));
const lp = M.listParams({ q: 'a', status: 'hacked', sort: 'password; --', dir: 'sideways', page: '-3', size: '9999', suspended: '1' });
check('A3 listParams: unbekannte Werte verworfen, Seite/Groesse begrenzt',
    lp.p_status === null && lp.p_sort === 'signup_at' && lp.p_dir === 'desc' && lp.p_offset === 0 && lp.p_limit === 100 && lp.p_suspended === true);
check('A4 listParams: Seite 3 bei 25 -> Offset 50', M.listParams({ page: '3' }).p_offset === 50);
check('A5 E-Mail maskiert', M.maskEmail('max.mustermann@firma.de') === 'm***@firma.de' && M.maskEmail('') === '' && M.maskEmail('kaputt') === '***');

// ── B) Whop-Abgleich ───────────────────────────────────────────────────────────
(async () => {
    const seiten = [
        { data: [
            { id: 'mem_1', status: 'canceled', created_at: '2026-01-01T00:00:00Z', user: { id: 'user_1', email: 'A@X.de', name: 'Anna', username: 'anna' }, plan: { id: 'plan_a' } },
            { id: 'mem_2', status: 'active',   created_at: '2026-05-01T00:00:00Z', user: { id: 'user_1', email: 'a@x.de', name: 'Anna', username: 'anna' }, plan: { id: 'plan_b' } },
            { id: 'mem_3', status: 'active',   created_at: '2026-03-01T00:00:00Z', user: { id: 'u2', email: 'b@y.de' } },
            { id: 'mem_4', status: 'active' }
        ], page_info: { has_next_page: true, end_cursor: 'c1' } },
        { data: [ { id: 'mem_5', status: 'past_due', created_at: '2026-02-01T00:00:00Z', user_id: 'u3' } ], page_info: { has_next_page: false } }
    ];
    let urls = [];
    const w = await M.whopLaden({ WHOP_API_KEY: 'k' }, async (url) => {
        urls.push(url);
        return { ok: true, json: async () => seiten[url.indexOf('after=c1') !== -1 ? 1 : 0] };
    });
    const u1 = w.rows.find(r => r.whop_user_id === 'user_1');
    check('B1 eine Zeile je Nutzer, Mitgliedschaft ohne Nutzer uebersprungen', w.rows.length === 3 && w.gelesen === 4);
    check('B2 aktive schlaegt gekuendigte; Plan, E-Mail klein; aeltestes Anmeldedatum', u1.status === 'active' && u1.plan_id === 'plan_b' && u1.email === 'a@x.de' && u1.signup_at === '2026-01-01T00:00:00Z');
    check('B3 Seitenwechsel per Cursor', urls.length === 2 && urls[1].indexOf('after=c1') !== -1);

    // ── C) Endpunkte ──────────────────────────────────────────────────────────
    process.env.SUPABASE_URL = 'http://sb.mock';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test';
    process.env.ADMIN_EMAIL = 'chef@example.com';
    delete process.env.WHOP_API_KEY;
    const jwt = 'x.' + Buffer.from(JSON.stringify({ aal: 'aal2', session_id: 's1' })).toString('base64url') + '.y';
    let rpcs = [];
    const detail = { member: { whop_user_id: 'user_1', email: 'anna@x.de', name: 'Anna' }, tags: [], notes: [], loeschplan: null, sync: { scopes: 0, zuletzt: null } };
    global.fetch = async (url, opts) => {
        if (url.indexOf('/auth/v1/user') !== -1) return { ok: true, status: 200, json: async () => ({ email: 'chef@example.com', email_confirmed_at: '2026-01-01' }) };
        const name = url.split('/rpc/')[1];
        const body = JSON.parse(opts.body);
        rpcs.push({ name, body });
        const out = name === 'sync_admin_session_touch' ? true
                  : name === 'sync_admin_member_get' ? JSON.parse(JSON.stringify(detail))
                  : name === 'sync_admin_members_list' ? { total: 1, rows: [{ whop_user_id: 'user_1', email: 'anna@x.de', tags: [] }] }
                  : name === 'sync_admin_search' ? [{ whop_user_id: 'user_1', email: 'anna@x.de' }]
                  : name === 'sync_admin_members_upsert' ? body.p_rows.length
                  : { ok: 1 };
        return { ok: true, status: 200, text: async () => JSON.stringify(out) };
    };
    const members = require(path.join(A, 'api', 'members.js'));
    const member = require(path.join(A, 'api', 'member.js'));
    const search = require(path.join(A, 'api', 'search.js'));
    const msync = require(path.join(A, 'api', 'members-sync.js'));

    function run(handler, req) {
        return new Promise((resolve) => {
            const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; },
                end(b) { resolve({ code: this.statusCode, body: b ? JSON.parse(b) : null }); } };
            req.headers = Object.assign({ authorization: 'Bearer ' + jwt, 'user-agent': 'UA', 'x-forwarded-for': '5.6.7.8' }, req.headers);
            handler(req, res);
        });
    }
    const names = () => rpcs.map(r => r.name);

    let r = await run(members, { method: 'GET', query: { q: 'ann' } });
    check('C1 Liste: E-Mail maskiert, Parameter an die DB', r.code === 200 && r.body.rows[0].email === 'a***@x.de' && rpcs.some(c => c.name === 'sync_admin_members_list' && c.body.p_q === 'ann'));
    r = await run(members, { method: 'DELETE', query: {} });
    check('C2 falsche Methode 405', r.code === 405);
    r = await run(members, { method: 'GET', query: {}, headers: { authorization: '' } });
    check('C3 ohne Token 401', r.code === 401);

    rpcs = [];
    r = await run(search, { method: 'GET', query: { q: 'a' } });
    check('C4 Suche unter 2 Zeichen: leer, keine DB-Abfrage', r.body.rows.length === 0 && !names().includes('sync_admin_search'));
    r = await run(search, { method: 'GET', query: { q: 'anna' } });
    check('C5 Suche: Treffer maskiert', r.body.rows[0].email === 'a***@x.de');

    rpcs = [];
    r = await run(member, { method: 'GET', query: { id: 'user_1' } });
    check('C6 Detail ohne reveal: maskiert, kein Audit-Eintrag', r.body.member.email === 'a***@x.de' && !names().includes('sync_admin_audit_add'));
    r = await run(member, { method: 'GET', query: { id: 'user_1', reveal: '1' } });
    const rev = rpcs.find(c => c.name === 'sync_admin_audit_add');
    check('C7 Detail mit reveal: Klartext UND Audit users.reveal_pii mit IP', r.body.member.email === 'anna@x.de' && rev && rev.body.p_action === 'users.reveal_pii' && rev.body.p_target_id === 'user_1' && rev.body.p_ip === '5.6.7.8');

    rpcs = [];
    r = await run(member, { method: 'POST', body: { id: 'user_1', action: 'suspend', reason: 'Missbrauch', confirm: 'falsch' } });
    check('C8 Sperre mit falscher Bestaetigung: 400, nichts geschrieben', r.code === 400 && r.body.error === 'bestaetigung_falsch' && !names().includes('sync_admin_member_suspend'));
    r = await run(member, { method: 'POST', body: { id: 'user_1', action: 'suspend', reason: 'ab', confirm: 'user_1' } });
    check('C9 Sperre ohne Grund: 400', r.code === 400 && r.body.error === 'grund_ungueltig');
    r = await run(member, { method: 'POST', body: { id: 'user_1', action: 'suspend', reason: 'Missbrauch', confirm: 'user_1' } });
    const sp = rpcs.find(c => c.name === 'sync_admin_member_suspend');
    check('C10 Sperre: DB-Aufruf mit Grund und Audit-Kontext (Admin, IP, User-Agent)', r.code === 200 && sp && sp.body.p_on === true && sp.body.p_reason === 'Missbrauch' &&
        sp.body.p_ctx.admin === 'chef@example.com' && sp.body.p_ctx.ip === '5.6.7.8' && sp.body.p_ctx.ua === 'UA');
    r = await run(member, { method: 'POST', body: { id: 'user_1', action: 'unsuspend' } });
    check('C11 Entsperren braucht keine Bestaetigung', r.code === 200 && rpcs.filter(c => c.name === 'sync_admin_member_suspend').pop().body.p_on === false);
    r = await run(member, { method: 'POST', body: { id: 'user_1', action: 'tag', tag: '<script>', on: true } });
    check('C12 ungueltiger Tag: 400', r.code === 400 && r.body.error === 'tag_ungueltig');
    r = await run(member, { method: 'POST', body: { id: 'user_1', action: 'note', body: '   ' } });
    check('C13 leere Notiz: 400', r.code === 400);
    r = await run(member, { method: 'POST', body: { id: 'user_1', action: 'loesche_alles' } });
    check('C14 unbekannte Aktion: 400', r.code === 400 && r.body.error === 'aktion_unbekannt');
    r = await run(member, { method: 'POST', body: { id: "u1'; --", action: 'unsuspend' } });
    check('C15 ungueltige ID: 400', r.code === 400);

    rpcs = [];
    r = await run(msync, { method: 'POST', body: {} });
    check('C16 Abgleich ohne WHOP_API_KEY: 503, nichts geschrieben', r.code === 503 && !names().includes('sync_admin_members_upsert'));
    process.env.WHOP_API_KEY = 'k';
    const realFetch = global.fetch;
    global.fetch = async (url, opts) => url.indexOf('api.whop.com') !== -1
        ? { ok: true, json: async () => ({ data: [], page_info: { has_next_page: false } }) } : realFetch(url, opts);
    r = await run(msync, { method: 'POST', body: {} });
    check('C17 Whop liefert nichts: 502, nichts geschrieben', r.code === 502 && !names().includes('sync_admin_members_upsert'));
    const viele = []; for (let i = 0; i < 1200; i++) viele.push({ id: 'm' + i, status: 'active', user: { id: 'u' + i, email: 'x' + i + '@y.de' } });
    global.fetch = async (url, opts) => url.indexOf('api.whop.com') !== -1
        ? { ok: true, json: async () => ({ data: viele, page_info: { has_next_page: false } }) } : realFetch(url, opts);
    rpcs = [];
    r = await run(msync, { method: 'POST', body: {} });
    const ups = rpcs.filter(c => c.name === 'sync_admin_members_upsert');
    check('C18 Abgleich in 500er-Bloecken, Audit nur im letzten', r.code === 200 && ups.length === 3 && ups.map(u => u.body.p_audit).join() === 'false,false,true');
    global.fetch = realFetch;

    // ── D) Stackr-Seite ───────────────────────────────────────────────────────
    const gp = path.join(ROOT, 'api', '_gesperrt.js'), dbp = path.join(ROOT, 'api', '_db.js');
    function frisch() { delete require.cache[gp]; delete require.cache[dbp]; return require(gp); }
    let gAnt = 'true', gKaputt = false, gCalls = 0;
    global.fetch = async (url) => {
        gCalls++;
        if (gKaputt) return { ok: false, status: 503, text: async () => '' };
        return { ok: true, status: 200, text: async () => gAnt };
    };
    process.env.SUPABASE_URL = 'http://sb.mock'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    let g = frisch();
    check('D1 gesperrt -> true', await g.istGesperrt('user_1') === true);
    gAnt = 'false';
    check('D2 nicht gesperrt -> false', await g.istGesperrt('user_1') === false);
    gKaputt = true;
    const errOrig = console.error; console.error = () => {};
    check('D3 Abfrage faellt aus -> false (kein Aussperren zahlender Kunden)', await g.istGesperrt('user_1') === false);
    console.error = errOrig;
    gCalls = 0; delete process.env.SUPABASE_URL;
    g = frisch();
    check('D4 ohne Supabase-Konfiguration: false, keine Abfrage', await g.istGesperrt('user_1') === false && gCalls === 0);
    check('D5 ohne Nutzer-ID: false', await g.istGesperrt('') === false);
    const src = (f) => fs.readFileSync(path.join(ROOT, 'api', f), 'utf8');
    check('D6 sync.js und blob-upload.js sperren, Selbstbedienung bleibt frei',
        /!isSelbstbedienung && await gesperrt\.istGesperrt\(userId\)/.test(src('sync.js')) && /!isSelbstbedienung && await gesperrt\.istGesperrt\(userId\)/.test(src('blob-upload.js')));
    check('D7 _auth.js prueft Cache-Treffer UND frische Anmeldung', (src('_auth.js').match(/gesperrt\.istGesperrt\(/g) || []).length === 2 && /account_suspended/.test(src('_auth.js')));

    // ── E) Migration ──────────────────────────────────────────────────────────
    const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261102000002_admin_members.sql'), 'utf8');
    for (const fn of ['sync_admin_member_suspend', 'sync_admin_note_add', 'sync_admin_note_pin', 'sync_admin_tag_set']) {
        const i = sql.indexOf('create or replace function ' + fn + '(');
        const body = sql.slice(i, sql.indexOf('end $$;', i));
        check('E ' + fn + ' schreibt den Audit-Eintrag in derselben Funktion', /sync_admin_audit_intern\(p_ctx/.test(body));
    }
    const noteFn = sql.slice(sql.indexOf('function sync_admin_note_add('), sql.indexOf('function sync_admin_note_pin('));
    check('E5 Notiztext steht nicht im Audit-Log (nur Id und Laenge)', /'laenge'/.test(noteFn) && !/'body'/.test(noteFn));
    check('E6 Abgleich ueberschreibt suspended_* nie', !/suspended_at\s*=\s*excluded/.test(sql));
    check('E7 Sortierspalte nur aus Whitelist (%I), kein String-Anhaengen von p_sort', /case p_sort when/.test(sql) && !/\|\| *p_sort/.test(sql));

    console.log('\n' + pass + '/' + total + ' bestanden');
    process.exit(pass === total ? 0 : 1);
})();
