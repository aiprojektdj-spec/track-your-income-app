// Serverführendes Datenmodell, statisch:  node test/test-server-datenmodell.js
// =============================================================================
// Prüft supabase/migrations/*_server_datenmodell.sql (Schritt R2, plan/server-umbau-2026-10-22.md)
// gegen die Regeln von RLS-Weg E-A — ohne Datenbank. Allgemeine Rechte (RLS an, revoke von
// public/anon/authenticated, search_path) prüfen zusätzlich test/test-migration-rechte.js und
// test/test-migration-tabellenrechte.js.
//
//   1. stackr_app wird NOLOGIN angelegt, nirgends BYPASSRLS
//   2. jede Datentabelle: RLS an + force, revoke auch von service_role, grant an stackr_app,
//      kein grant an service_role, Policies nur `to stackr_app`
//   3. jede SECURITY-DEFINER-Funktion: Eigentümer stackr_app, search_path = public, pg_temp,
//      erster Parameter p_user text, erste Anweisung set_config('stackr.user', p_user, true),
//      execute nur an service_role
//   4. jede übrige neue Funktion ohne sync_-Präfix: Eigentümer stackr_app, revoke auch von
//      service_role, execute nur an stackr_app (nummer_ziehen also nie von außen)
//   5. GoBD: audit_log nur select/insert, Trigger gegen update/delete/truncate, sha256-Kette;
//      records mit Sperr-Trigger und Doppelimport-Index
//   6. Shopify: FK not valid + validate, Spalte gebucht, Owner-Prüfung in
//      sync_shopify_integration_speichern mit unveränderter Signatur, shopify_status,
//      stackr_app sieht token_chiffrat nicht
//   7. Negativfälle: der Prüfer schlägt an
//
// Was dieser Test NICHT kann (Prüfliste für stackr-preview, führt der User aus):
//   a) Migration läuft durch, zweiter Lauf auch (wiederholbar)
//   b) select rolbypassrls, rolcanlogin from pg_roles where rolname = 'stackr_app'  → f, f
//   c) Funktionseigentümer: select proname, proowner::regrole, prosecdef from pg_proc
//      where proname in ('datensatz_schreiben','aenderungen_seit','firma_anlegen')  → stackr_app, t
//   d) RLS greift für stackr_app: als service_role firma_anlegen('u1','co_a',…) und
//      firma_anlegen('u2','co_b',…), datensatz_schreiben für beide; dann
//        begin; set local role stackr_app; select set_config('stackr.user','u1',true);
//        select count(*) from records where company_id = 'co_b';   → 0
//        select count(*) from records;                             → nur co_a
//        rollback;
//      und aenderungen_seit('u1','co_b',0,10) → Fehler 42501
//   e) service_role ohne Tabellenrecht: set local role service_role; select * from records → 42501
//   f) GoBD: perioden-Zeile (co_a, Jahr, abgeschlossen) per SQL-Editor anlegen →
//      datensatz_schreiben mit Datum im Jahr auf bestehenden Datensatz → status 'gesperrt';
//      nur gesperrt_grund setzen (data unverändert) → 'ok'
//   g) audit_log: update/delete/truncate als postgres → Fehler SR002; Kette:
//      prev_hash jeder Zeile = hash der vorigen derselben Firma
//   h) Nummernkreis: zwei Neuanlagen mit p_kreis 'rechnung' → nummer 1, 2; Doppel-quelle →
//      status 'doppelt'
//   i) stb_lesen: company_members-Zeile per SQL-Editor, dann datensatz_schreiben als StB → 42501,
//      aenderungen_seit als StB → Daten
//   j) Shopify: sync_shopify_integration_speichern mit fremder Firma → 42501; shopify_status
//      liefert keinen Token
// =============================================================================
'use strict';
const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const DATEI = fs.readdirSync(DIR).filter(n => /_server_datenmodell\.sql$/.test(n)).sort();
const SHOPIFY = fs.readFileSync(path.join(DIR, '20261022000001_shopify.sql'), 'utf8');

function ohneKommentare(sql) { return sql.replace(/--[^\n]*/g, ''); }
function argTypen(args) {
    return args.split(',').map(a => a.trim()).filter(Boolean)
        .map(a => a.split(/\s+/).slice(1).join(' ').toLowerCase()).join(',');
}
function sigNorm(s) { return s.replace(/\s+/g, '').toLowerCase(); }
function rollenVon(liste) { return liste.toLowerCase().split(',').map(r => r.trim()); }

// Rückgabe: Liste von Fehlertexten
function pruefe(roh) {
    const sql = ohneKommentare(roh), fehler = [];
    const f = (t) => fehler.push(t);

    // 1. Rolle
    if (!/create\s+role\s+stackr_app\s+nologin\s+nobypassrls/i.test(sql)) f('stackr_app nicht NOLOGIN NOBYPASSRLS angelegt');
    if (/(^|[^o])bypassrls/i.test(sql.replace(/nobypassrls/gi, ''))) f('BYPASSRLS taucht auf');

    // Rechte einsammeln
    const revokes = [...sql.matchAll(/revoke\s+all\s+on\s+([^;]+?)\s+from\s+([^;]+);/gi)];
    const tabRevoke = new Map(), fnRevoke = new Map();
    for (const m of revokes) {
        const rollen = rollenVon(m[2]); let x;
        if ((x = /^function\s+(.+)$/i.exec(m[1]))) fnRevoke.set(sigNorm(x[1]), rollen);
        else if (!/^sequence\s/i.test(m[1])) m[1].split(',').forEach(t => tabRevoke.set(t.trim().toLowerCase(), rollen));
    }
    const tabGrants = [...sql.matchAll(/grant\s+([a-z,\s]+?)\s+on\s+table\s+(\w+)\s+to\s+(\w+)\s*;/gi)]
        .map(m => ({ rechte: m[1].toLowerCase().split(/[\s,]+/), tab: m[2].toLowerCase(), an: m[3].toLowerCase() }));
    const fnGrants = [...sql.matchAll(/grant\s+execute\s+on\s+function\s+(\w+\s*\([^)]*\))\s+to\s+(\w+)\s*;/gi)]
        .map(m => ({ sig: sigNorm(m[1]), an: m[2].toLowerCase() }));
    const eigen = new Set([...sql.matchAll(/alter\s+function\s+(\w+\s*\([^)]*\))\s+owner\s+to\s+stackr_app/gi)].map(m => sigNorm(m[1])));
    const policies = [...sql.matchAll(/create\s+policy\s+(\w+)\s+on\s+(\w+)\s+for\s+\w+\s+to\s+(\w+)/gi)]
        .map(m => ({ name: m[1], tab: m[2].toLowerCase(), an: m[3].toLowerCase() }));
    if ((sql.match(/create\s+policy/gi) || []).length !== policies.length) f('Policy ohne `for … to <rolle>`');

    // 2. Datentabellen = alles mit force RLS
    const tabellen = [...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)\s*\(/gi)].map(m => m[1].toLowerCase());
    const daten = tabellen.filter(t => new RegExp('alter\\s+table\\s+' + t + '\\s+force\\s+row\\s+level\\s+security', 'i').test(sql));
    for (const t of daten) {
        if (!new RegExp('alter\\s+table\\s+' + t + '\\s+enable\\s+row\\s+level\\s+security', 'i').test(sql)) f(t + ': RLS nicht an');
        const r = tabRevoke.get(t) || [];
        for (const rolle of ['public', 'anon', 'authenticated', 'service_role'])
            if (r.indexOf(rolle) === -1) f(t + ': kein revoke von ' + rolle);
        if (!tabGrants.some(g => g.tab === t && g.an === 'stackr_app')) f(t + ': kein grant an stackr_app');
        if (tabGrants.some(g => g.tab === t && g.an !== 'stackr_app')) f(t + ': grant an andere Rolle als stackr_app');
        if (!policies.some(p => p.tab === t)) f(t + ': keine Policy');
    }
    for (const p of policies) if (p.an !== 'stackr_app') f('Policy ' + p.name + ' nicht auf stackr_app beschränkt');

    // 3./4. Funktionen
    const fnRe = /create\s+(?:or\s+replace\s+)?function\s+(\w+)\s*\(([^)]*)\)([\s\S]*?)\bas\s+\$\$([\s\S]*?)\$\$/gi;
    const funktionen = [...sql.matchAll(fnRe)].map(m => ({
        name: m[1].toLowerCase(), args: m[2], sig: m[1].toLowerCase() + '(' + argTypen(m[2]) + ')', kopf: m[3], body: m[4] }));
    for (const fn of funktionen) {
        const definer = /security\s+definer/i.test(fn.kopf);
        const an = fnGrants.filter(g => g.sig === fn.sig).map(g => g.an);
        const rev = fnRevoke.get(fn.sig) || [];
        if (!/set\s+search_path\s*=\s*public\s*,\s*pg_temp/i.test(fn.kopf)) f(fn.sig + ': search_path fehlt');
        if (definer) {
            if (!eigen.has(fn.sig)) f(fn.sig + ': SECURITY DEFINER, Eigentümer nicht stackr_app');
            if (!/^\s*p_user\s+text\s*(,|$)/i.test(fn.args)) f(fn.sig + ': erster Parameter nicht p_user text');
            const erste = fn.body.replace(/^\s*declare[\s\S]*?\bbegin\b/i, '').replace(/^\s*begin\b/i, '').trim();
            if (!/^perform\s+set_config\s*\(\s*'stackr\.user'\s*,\s*p_user\s*,\s*true\s*\)\s*;/i.test(erste))
                f(fn.sig + ': erste Anweisung ist nicht set_config(\'stackr.user\', p_user, true)');
            if (an.join() !== 'service_role') f(fn.sig + ': execute nicht genau an service_role (' + an.join() + ')');
            for (const rolle of ['public', 'anon', 'authenticated'])
                if (rev.indexOf(rolle) === -1) f(fn.sig + ': kein revoke von ' + rolle);
        } else if (fn.name.indexOf('sync_') !== 0) {
            if (!eigen.has(fn.sig)) f(fn.sig + ': Eigentümer nicht stackr_app');
            if (an.join() !== 'stackr_app') f(fn.sig + ': execute nicht genau an stackr_app (' + an.join() + ')');
            for (const rolle of ['public', 'anon', 'authenticated', 'service_role'])
                if (rev.indexOf(rolle) === -1) f(fn.sig + ': kein revoke von ' + rolle);
        }
    }
    for (const g of fnGrants) if (g.an === 'stackr_app' && funktionen.some(fn => fn.sig === g.sig && /security\s+definer/i.test(fn.kopf)))
        f(g.sig + ': Datenfunktion an stackr_app freigegeben');

    // 5. GoBD
    const audit = tabGrants.filter(g => g.tab === 'audit_log').flatMap(g => g.rechte);
    if (audit.some(r => r !== 'select' && r !== 'insert')) f('audit_log: mehr als select/insert');
    if (!/create\s+trigger\s+\w+\s+before\s+update\s+or\s+delete\s+on\s+audit_log/i.test(sql)) f('audit_log: kein Update/Delete-Trigger');
    if (!/create\s+trigger\s+\w+\s+before\s+truncate\s+on\s+audit_log/i.test(sql)) f('audit_log: kein Truncate-Trigger');
    if (!/create\s+trigger\s+\w+\s+before\s+insert\s+on\s+audit_log/i.test(sql) || !/sha256\s*\(/i.test(sql)) f('audit_log: keine sha256-Kette');
    if (/create\s+policy\s+\w+\s+on\s+audit_log\s+for\s+(update|delete|all)/i.test(sql)) f('audit_log: Update/Delete-Policy');
    if (!/create\s+trigger\s+\w+\s+before\s+update\s+or\s+delete\s+on\s+records/i.test(sql)) f('records: kein GoBD-Trigger');
    if (!/create\s+unique\s+index[^;]+on\s+records\s*\(\s*company_id\s*,\s*art\s*,\s*quelle\s*\)\s*where\s+quelle\s+is\s+not\s+null/i.test(sql))
        f('records: Doppelimport-Index fehlt');

    // 6. Shopify
    if (!/foreign\s+key\s*\(\s*company_id\s*\)\s*references\s+companies\s*\(\s*id\s*\)\s*on\s+delete\s+cascade\s+not\s+valid/i.test(sql)) f('Shopify: FK not valid fehlt');
    if (!/validate\s+constraint\s+integrations_company_fk/i.test(sql)) f('Shopify: validate fehlt');
    if (!/alter\s+table\s+shopify_eingang\s+add\s+column\s+if\s+not\s+exists\s+gebucht\s+jsonb/i.test(sql)) f('Shopify: Spalte gebucht fehlt');
    const spAlt = /function\s+sync_shopify_integration_speichern\s*\(([^)]*)\)/i.exec(ohneKommentare(SHOPIFY));
    const spNeu = funktionen.find(fn => fn.name === 'sync_shopify_integration_speichern');
    if (!spNeu) f('Shopify: sync_shopify_integration_speichern nicht neu definiert');
    else {
        if (!spAlt || argTypen(spAlt[1]) !== argTypen(spNeu.args)) f('Shopify: Signatur von sync_shopify_integration_speichern geändert');
        if (!/firma_rolle\s*\(\s*p_user\s*,\s*p_company\s*\)\s+is\s+distinct\s+from\s+'owner'/i.test(spNeu.body)) f('Shopify: Owner-Prüfung fehlt');
    }
    if (!funktionen.some(fn => fn.sig === 'shopify_status(text,text)')) f('Shopify: shopify_status fehlt');
    const intGrant = /grant\s+select\s*\(([^)]*)\)\s*on\s+integrations\s+to\s+stackr_app/i.exec(sql);
    if (/grant\s+[a-z,\s]+\s+on\s+(table\s+)?integrations\s+to\s+stackr_app/i.test(sql) || (intGrant && /token_chiffrat/i.test(intGrant[1])))
        f('Shopify: stackr_app darf token_chiffrat lesen');

    // Pflicht-Funktionen für R3
    for (const sig of ['firma_anlegen(text,text,text,text,text)', 'firma_rolle(text,text)', 'firmen_lesen(text)',
                       'datensatz_lesen(text,text,text,text)', 'aenderungen_seit(text,text,bigint,integer)'])
        if (!funktionen.some(fn => fn.sig === sig)) f('fehlt: ' + sig);
    if (!funktionen.some(fn => fn.name === 'datensatz_schreiben')) f('fehlt: datensatz_schreiben');
    for (const t of ['companies', 'company_members', 'records', 'settings', 'nummernkreise', 'perioden',
                     'audit_log', 'anhaenge', 'user_prefs'])
        if (daten.indexOf(t) === -1) f('Datentabelle fehlt oder ohne force RLS: ' + t);
    if (tabellen.indexOf('auth_cache') === -1) f('auth_cache fehlt');
    return fehler;
}

let pass = 0;
function ok(msg) { pass++; console.log('✓ ' + msg); }

// 1–6: die echte Migration
assert.strictEqual(DATEI.length, 1, 'genau eine *_server_datenmodell.sql');
const ECHT = fs.readFileSync(path.join(DIR, DATEI[0]), 'utf8');
assert.ok(DATEI[0] > '20261022000001', 'läuft nach der Shopify-Migration');
const befund = pruefe(ECHT);
assert.deepStrictEqual(befund, [], 'E-A-Lücken:\n' + befund.join('\n'));
ok(DATEI[0] + ': Rolle, Datentabellen, Definer-Funktionen, GoBD und Shopify nach E-A');

// 7: Negativfälle — jede Verletzung muss gemeldet werden
function kaputt(ersetzen, erwartet) {
    const [a, b] = ersetzen;
    assert.ok(ECHT.indexOf(a) !== -1, 'Vorlage gefunden: ' + a);
    const r = pruefe(ECHT.replace(a, b));
    assert.ok(r.some(e => e.indexOf(erwartet) !== -1), 'erkennt „' + erwartet + '“, gemeldet:\n' + r.join('\n'));
}
kaputt(['create role stackr_app nologin nobypassrls', 'create role stackr_app nologin bypassrls'], 'stackr_app nicht NOLOGIN');
kaputt(['alter table records         force row level security;', ''], 'Datentabelle fehlt oder ohne force RLS: records');
kaputt(['grant select, insert, update, delete on table settings        to stackr_app;',
        'grant select, insert, update, delete on table settings        to service_role;'], 'settings: grant an andere Rolle');
kaputt(['  from public, anon, authenticated, service_role;\nrevoke all on sequence',
        '  from public, anon, authenticated;\nrevoke all on sequence'], 'kein revoke von service_role');
kaputt(['    perform set_config(\'stackr.user\', p_user, true);\n    select c.change_seq',
        '    select c.change_seq'], 'aenderungen_seit(text,text,bigint,integer): erste Anweisung');
kaputt(['alter function shopify_status(text, text)             owner to stackr_app;', ''],
       'shopify_status(text,text): SECURITY DEFINER, Eigentümer');
kaputt(['grant execute on function nummer_ziehen(text, text)           to stackr_app;',
        'grant execute on function nummer_ziehen(text, text)           to service_role;'], 'nummer_ziehen(text,text): execute nicht genau an stackr_app');
kaputt(['grant select, insert                 on table audit_log       to stackr_app;',
        'grant select, insert, update         on table audit_log       to stackr_app;'], 'audit_log: mehr als select/insert');
kaputt(['create trigger records_gobd_sperre before update or delete on records', 'create trigger records_gobd_sperre before update on records'],
       'records: kein GoBD-Trigger');
kaputt(['    if firma_rolle(p_user, p_company) is distinct from \'owner\' then', '    if false then'], 'Shopify: Owner-Prüfung fehlt');
kaputt(['grant select (shop, company_id, status,', 'grant select (shop, token_chiffrat, company_id, status,'], 'token_chiffrat');
kaputt(['create policy user_prefs_eigene on user_prefs for all to stackr_app', 'create policy user_prefs_eigene on user_prefs for all to authenticated'],
       'nicht auf stackr_app beschränkt');
ok('12 Negativfälle werden erkannt');

console.log('\n' + pass + '/2 Prüfungen bestanden ✅');
