// Admin-Panel Phase d (Dashboard, Feature-Flags):  node test/test-admin-phase-d.js
//  A) Validierung: Zeitraum, Flag, Plan
//  B) Flag-Auswertung (api/_flags.js): Notaus, Regeln, stabiler Prozent-Hash, Cache, Ausfall
//  C) Endpunkte: Rechte, Audit-Kontext, Hook nach den Abgleichen
//  D) Migration und Oberflaeche
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

const D = require(path.join(A, 'lib', 'dashboard.js'));

// ── A) Validierung ─────────────────────────────────────────────────────────────
const jetzt = new Date('2026-11-02T10:00:00Z');
check('A1 Standardzeitraum: 30 Tage bis heute (Berlin)', JSON.stringify(D.range({}, jetzt)) === JSON.stringify({ from: '2026-10-04', to: '2026-11-02' }));
check('A2 Datum/Zeitraum geprueft', throws(() => D.range({ from: 'gestern', to: '2026-11-02' }), 'datum_ungueltig') &&
    throws(() => D.range({ from: '2026-11-05', to: '2026-11-02' }), 'zeitraum_ungueltig') &&
    throws(() => D.range({ from: '2024-01-01', to: '2026-11-02' }), 'zeitraum_ungueltig') &&
    throws(() => D.range({ from: '2026-13-45', to: '2026-11-02' }), 'datum_ungueltig'));
check('A3 Berlin-Tag um Mitternacht UTC', D.berlinTag(new Date('2026-11-02T23:30:00Z')) === '2026-11-03');
const ok = D.flag({ key: 'neu.feature', status: 'rules', percent: '25', user_ids: 'user_aaa, user_bbb user_aaa', plan_ids: ['plan_x1'] });
check('A4 Flag: Listen bereinigt (Duplikate, Trennzeichen)', ok.p_users.join() === 'user_aaa,user_bbb' && ok.p_plans.join() === 'plan_x1' && ok.p_percent === 25);
check('A5 Flag: ungueltiger Key/Status/Prozent/ID',
    throws(() => D.flag({ key: 'Gross', status: 'on', percent: 0 }), 'key_ungueltig') &&
    throws(() => D.flag({ key: 'a', status: 'on', percent: 0 }), 'key_ungueltig') &&
    throws(() => D.flag({ key: 'ok.key', status: 'ja', percent: 0 }), 'status_ungueltig') &&
    throws(() => D.flag({ key: 'ok.key', status: 'on', percent: 101 }), 'prozent_ungueltig') &&
    throws(() => D.flag({ key: 'ok.key', status: 'on', percent: 'x' }), 'prozent_ungueltig') &&
    throws(() => D.flag({ key: 'ok.key', status: 'rules', percent: 5, user_ids: "x'; drop" }), 'liste_ungueltig'));
check('A6 Plan: Betrag nur ganze Cent 0..1.000.000', D.plan({ plan_id: 'plan_abc', monthly_cents: 1125 }).p_cents === 1125 &&
    throws(() => D.plan({ plan_id: 'plan_abc', monthly_cents: 11.5 }), 'betrag_ungueltig') && throws(() => D.plan({ plan_id: 'plan_abc', monthly_cents: -1 }), 'betrag_ungueltig') &&
    throws(() => D.plan({ plan_id: 'x', monthly_cents: 1 }), 'id_ungueltig'));

(async () => {
    // ── B) Flags ──────────────────────────────────────────────────────────────
    process.env.SUPABASE_URL = 'http://sb.mock';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
    const fp = path.join(ROOT, 'api', '_flags.js'), dbp = path.join(ROOT, 'api', '_db.js');
    delete require.cache[fp]; delete require.cache[dbp];
    const F = require(fp);
    const f = (o) => Object.assign({ key: 'x.y', status: 'rules', killed: false, percent: 0, user_ids: [], account_ids: [], plan_ids: [] }, o);

    check('B1 Notaus schlaegt alles, auch status on', !F.auswerten(f({ status: 'on', killed: true }), { id: 'user_1' }) && !F.auswerten(f({ killed: true, user_ids: ['user_1'] }), { id: 'user_1' }));
    check('B2 off = aus, on = an (auch ohne Nutzer)', !F.auswerten(f({ status: 'off', user_ids: ['user_1'] }), { id: 'user_1' }) && F.auswerten(f({ status: 'on' }), null));
    check('B3 Regeln: Nutzer, Konto, Plan', F.auswerten(f({ user_ids: ['user_1'] }), { id: 'user_1' }) &&
        F.auswerten(f({ account_ids: ['biz_1'] }), { id: 'user_2', accountId: 'biz_1' }) && F.auswerten(f({ plan_ids: ['plan_a'] }), { id: 'user_3', plan: 'plan_a' }) &&
        !F.auswerten(f({ user_ids: ['user_1'] }), { id: 'user_9' }));
    check('B4 ohne Nutzer, unbekanntes Flag, 0 Prozent: aus', !F.auswerten(f({ percent: 100 }), null) && !F.auswerten(undefined, { id: 'user_1' }) && !F.auswerten(f({ percent: 0 }), { id: 'user_1' }));
    let drin = 0;
    for (let i = 0; i < 10000; i++) if (F.auswerten(f({ percent: 30 }), { id: 'user_' + i })) drin++;
    check('B5 Prozent-Rollout ungefaehr gleichverteilt (30 % +/- 2)', drin > 2800 && drin < 3200);
    let stabil = true, mono = true;
    for (let i = 0; i < 2000; i++) {
        const u = { id: 'user_' + i };
        if (F.auswerten(f({ percent: 20 }), u) !== F.auswerten(f({ percent: 20 }), u)) stabil = false;
        if (F.auswerten(f({ percent: 20 }), u) && !F.auswerten(f({ percent: 60 }), u)) mono = false;
    }
    check('B6 stabil: gleicher Nutzer immer gleicher Eimer; wer bei 20 % drin ist, bleibt bei 60 % drin', stabil && mono);
    check('B7 Eimer haengt am Flag-Key (andere Flags -> andere Verteilung)', F.bucket('a.b', 'user_1') !== F.bucket('c.d', 'user_1') || F.bucket('a.b', 'user_2') !== F.bucket('c.d', 'user_2'));

    let rpcAnz = 0, modus = 'ok';
    global.fetch = async (url) => {
        rpcAnz++;
        if (modus === 'down') return { ok: false, status: 503, text: async () => '' };
        return { ok: true, status: 200, text: async () => JSON.stringify([f({ key: 'a.b', status: 'on' })]) };
    };
    const errOrig = console.error; console.error = () => {};
    F._reset();
    check('B8 isEnabled liest aus der DB', await F.isEnabled('a.b', { id: 'user_1' }) === true && await F.isEnabled('gibt.es.nicht', { id: 'user_1' }) === false);
    check('B9 Zwischenspeicher: zweiter Aufruf ohne DB', rpcAnz === 1);
    modus = 'down'; F._reset();
    check('B10 DB weg und nichts im Speicher: aus', await F.isEnabled('a.b', { id: 'user_1' }) === false);
    modus = 'ok'; F._reset(); await F.isEnabled('a.b', { id: 'user_1' }); modus = 'down';
    // Cache kuenstlich altern: ueber den naechsten Aufruf nach TTL ohne Zeitmanipulation nicht moeglich -> Verhalten ueber Quelltext
    console.error = errOrig;
    const fsrc = fs.readFileSync(fp, 'utf8');
    check('B11 bei Ladefehler gilt der letzte Stand hoechstens 5 Minuten', /STALE_MS\s*=\s*300000/.test(fsrc) && /jetzt - cache\.at < STALE_MS/.test(fsrc));

    // ── C) Endpunkte ──────────────────────────────────────────────────────────
    process.env.ADMIN_EMAIL = 'chef@example.com';
    process.env.WHOP_API_KEY = 'k';
    const jwt = 'x.' + Buffer.from(JSON.stringify({ aal: 'aal2', session_id: 's1' })).toString('base64url') + '.y';
    let rpcs = [];
    const real = async (url, opts) => {
        if (url.indexOf('/auth/v1/user') !== -1) return { ok: true, status: 200, json: async () => ({ email: 'chef@example.com', email_confirmed_at: '2026-01-01' }) };
        if (url.indexOf('api.whop.com') !== -1) {
            const data = url.indexOf('/payments') !== -1 ? [{ id: 'pay_1', total: 15, status: 'paid' }] : [{ id: 'm1', status: 'active', user: { id: 'user_1' } }];
            return { ok: true, json: async () => ({ data, page_info: { has_next_page: false } }) };
        }
        const name = url.split('/rpc/')[1];
        const body = JSON.parse(opts.body);
        rpcs.push({ name, body });
        if (name === 'sync_admin_metrics_compute' && failCompute) return { ok: false, status: 500, text: async () => '' };
        const out = name === 'sync_admin_session_touch' ? true
                  : name === 'sync_admin_dashboard' ? { aktuell: {}, vorher: {}, reihe: [], berechnet: null }
                  : name === 'sync_admin_cohorts' ? [] : name === 'sync_admin_flag_kill' ? (body.p_key === 'fehlt.nicht' ? null : { killed: body.p_killed })
                  : name === 'sync_admin_members_upsert' || name === 'sync_admin_payments_upsert' ? body.p_rows.length : { ok: 1 };
        return { ok: true, status: 200, text: async () => JSON.stringify(out) };
    };
    let failCompute = false;
    global.fetch = real;
    const metrics = require(path.join(A, 'api', 'metrics.js')), plans = require(path.join(A, 'api', 'plans.js')), flags = require(path.join(A, 'api', 'flags.js'));
    const msync = require(path.join(A, 'api', 'members-sync.js')), psync = require(path.join(A, 'api', 'payments-sync.js'));
    function run(handler, req) {
        return new Promise((resolve) => {
            const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ code: this.statusCode, body: b ? JSON.parse(b) : null }); } };
            req.headers = Object.assign({ authorization: 'Bearer ' + jwt, 'user-agent': 'UA', 'x-forwarded-for': '9.9.9.9' }, req.headers);
            handler(req, res);
        });
    }
    const names = () => rpcs.map(r => r.name);

    let r = await run(metrics, { method: 'GET', query: { from: '2026-10-01', to: '2026-10-31' } });
    const dash = rpcs.find(c => c.name === 'sync_admin_dashboard');
    check('C1 Dashboard: Zeitraum an die DB, Kohorten dabei', r.code === 200 && dash.body.p_from === '2026-10-01' && dash.body.p_to === '2026-10-31' && Array.isArray(r.body.kohorten));
    r = await run(metrics, { method: 'GET', query: { from: 'x', to: 'y' } });
    check('C2 Dashboard: ungueltiger Zeitraum 400', r.code === 400);
    rpcs = [];
    r = await run(metrics, { method: 'POST', body: {} });
    const mc = rpcs.find(c => c.name === 'sync_admin_metrics_compute');
    check('C3 Berechnen per Knopf: mit Audit und Kontext', r.code === 200 && mc.body.p_audit === true && mc.body.p_ctx.admin === 'chef@example.com' && mc.body.p_ctx.ip === '9.9.9.9');
    r = await run(plans, { method: 'POST', body: { plan_id: 'plan_abc', label: 'Monat', monthly_cents: 1500 } });
    check('C4 Plan speichern mit Audit-Kontext', r.code === 200 && rpcs.some(c => c.name === 'sync_admin_plan_save' && c.body.p_cents === 1500 && c.body.p_ctx.ip === '9.9.9.9'));
    r = await run(plans, { method: 'POST', body: { plan_id: 'plan_abc', monthly_cents: 'viel' } });
    check('C5 Plan mit ungueltigem Betrag: 400', r.code === 400);
    r = await run(flags, { method: 'POST', body: { action: 'save', key: 'neu.feature', status: 'rules', percent: 10, user_ids: 'user_aaa' } });
    const fs1 = rpcs.find(c => c.name === 'sync_admin_flag_save');
    check('C6 Flag speichern', r.code === 200 && fs1.body.p_key === 'neu.feature' && fs1.body.p_users[0] === 'user_aaa' && fs1.body.p_ctx.admin === 'chef@example.com');
    r = await run(flags, { method: 'POST', body: { action: 'kill', key: 'neu.feature', killed: true } });
    check('C7 Notaus', r.code === 200 && rpcs.some(c => c.name === 'sync_admin_flag_kill' && c.body.p_killed === true));
    r = await run(flags, { method: 'POST', body: { action: 'kill', key: 'fehlt.nicht', killed: true } });
    check('C8 Notaus fuer unbekanntes Flag: 404', r.code === 404);
    r = await run(flags, { method: 'POST', body: { action: 'loeschen', key: 'neu.feature' } });
    check('C9 unbekannte Aktion 400; es gibt keinen Loesch-Weg fuer Flags', r.code === 400 && !/delete from admin_flags/i.test(fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261102000004_admin_metrics_flags.sql'), 'utf8')));
    r = await run(flags, { method: 'GET', query: {}, headers: { authorization: '' } });
    check('C10 Flags ohne Token 401', r.code === 401);

    rpcs = [];
    r = await run(msync, { method: 'POST', body: {} });
    check('C11 Mitglieder-Abgleich berechnet danach die Kennzahlen (ohne eigenen Audit)', r.code === 200 && r.body.metriken === true &&
        names().indexOf('sync_admin_metrics_compute') > names().lastIndexOf('sync_admin_members_upsert') && rpcs.find(c => c.name === 'sync_admin_metrics_compute').body.p_audit === false);
    rpcs = [];
    r = await run(psync, { method: 'POST', body: {} });
    check('C12 Zahlungs-Abgleich berechnet danach die Kennzahlen', r.code === 200 && names().includes('sync_admin_metrics_compute'));
    failCompute = true; rpcs = [];
    r = await run(msync, { method: 'POST', body: {} });
    check('C13 Berechnung scheitert: Abgleich bleibt erfolgreich, Antwort sagt metriken:false', r.code === 200 && r.body.metriken === false);

    // ── D) Migration und Oberflaeche ──────────────────────────────────────────
    const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', '20261102000004_admin_metrics_flags.sql'), 'utf8');
    for (const fn of ['sync_admin_plan_save', 'sync_admin_flag_save', 'sync_admin_flag_kill']) {
        const i = sql.indexOf('create or replace function ' + fn + '(');
        check('D ' + fn + ' schreibt den Audit-Eintrag in derselben Funktion', /sync_admin_audit_intern\(p_ctx/.test(sql.slice(i, sql.indexOf('end $$;', i))));
    }
    check('D4 Erstimport erzeugt keine Ereignisse', /v_erst := not exists/.test(sql) && /if not v_erst then/.test(sql));
    check('D5 Tage in Europe/Berlin', (sql.match(/Europe\/Berlin/g) || []).length >= 5 && !/current_date/.test(sql));
    const html = fs.readFileSync(path.join(A, 'index.html'), 'utf8');
    check('D6 keine fremden Skripte/CDNs und keine Inline-Skripte im Panel', !/<script[^>]+src="https?:/.test(html) && !/<script>/.test(html) && !/\sstyle=|\sonclick=/.test(html));
    const js = fs.readdirSync(path.join(A, 'js')).map(x => fs.readFileSync(path.join(A, 'js', x), 'utf8')).join('\n');
    check('D7 Oberflaeche schreibt nie per innerHTML', !/innerHTML|insertAdjacentHTML|document\.write/.test(js));

    console.log('\n' + pass + '/' + total + ' bestanden');
    process.exit(pass === total ? 0 : 1);
})();
