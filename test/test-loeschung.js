// Cloud-Daten 30 Tage nach Abo-Ende löschen:  node test/test-loeschung.js
//
// Geprüft wird api/_loeschung.js mit Attrappen für Whop, Speicher, Supabase und Make:
//    1) Probelauf (Standard): vormerken, keine Kunden-Mail, nichts gelöscht, Bericht „würde löschen“
//    2) scharf: Mail 1 sofort, Mail 2 ab Tag 23, Löschung erst Tag 30 UND 7 Tage nach Mail 2
//    3) gelöscht werden Snapshots aller Scopes + __account, Scopes, Anhänge, erteilte Freigaben,
//       Pubkey (nicht, wenn selbst Freigabe-Empfänger); Prüfliste wird nie angefasst
//    4) wieder aktiv → aus dem Plan; Owner nie vorgemerkt; past_due zählt als gültig
//    5) Schutz: Whop-Fehler / keine gültige Mitgliedschaft / Massen-Vormerkung → Abbruch ohne Änderung
//    6) ohne E-Mail-Adresse: Löschung an Tag 30 ohne Mail; gescheiterte Mail verschiebt die Löschung
//    7) Migration: Funktionen, Rechte, keine E-Mail-Spalte; blob-cleanup ruft den Lauf auf
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const L = require(path.join(ROOT, 'api', '_loeschung.js'));

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name); }
}

const TAG = 86400000;
const T0 = Date.parse('2026-11-01T04:00:00Z');

function welt(o) {
    o = o || {};
    const w = {
        members: o.members || [
            { status: 'active',   user: { id: 'user_A', email: 'a@x.de' } },
            { status: 'canceled', user: { id: 'user_B', email: 'B@x.de' } },
            { status: 'past_due', user: { id: 'user_C', email: 'c@x.de' } },
            { status: 'expired',  user: { id: 'user_D' } },
            { status: 'active',   user: { id: 'user_E', email: 'e@x.de' } }
        ],
        nutzer: o.nutzer || ['user_A', 'user_B', 'user_C', 'user_D', 'user_O', 'user_E'],
        scopes: { user_B: ['co_1'], user_D: [] },
        grantsBy: { user_B: [{ id: 'user_S' }] },
        grantsFor: o.grantsFor || {},
        plan: {}, mails: [], alarme: [], ops: [], whopFail: false
    };
    w.d = {
        env: Object.assign({ WHOP_API_KEY: 'k', SYNC_OWNER_IDS: 'user_O' }, o.env || {}),
        now: T0,
        fetch: async function (url) {
            if (w.whopFail) return { ok: false, status: 500 };
            return { ok: true, json: async () => ({ data: w.members, page_info: { has_next_page: false } }) };
        },
        melden: async function (s, e, d) { w.alarme.push(e + ': ' + d); },
        mail: async function (email, nr, m) { if (w.mailFail) return false; w.mails.push({ email, nr, m }); return true; },
        db: {
            isConfigured: () => true,
            rpc: async function (name, a) {
                w.ops.push(name);
                if (name === 'sync_loeschplan_liste') return Object.values(w.plan).map(r => Object.assign({}, r));
                if (name === 'sync_loeschplan_vormerken') { a.p_users.forEach(u => { if (!w.plan[u]) w.plan[u] = { user_id: u, inaktiv_seit: new Date(w.d.now).toISOString(), mail1_am: null, mail2_am: null }; }); return a.p_users.length; }
                if (name === 'sync_loeschplan_mail') { w.plan[a.p_user]['mail' + a.p_nr + '_am'] = new Date(w.d.now).toISOString(); return null; }
                if (name === 'sync_loeschplan_entfernen') { delete w.plan[a.p_user]; return null; }
                throw new Error('rpc ' + name);
            }
        },
        store: {
            configProblem: () => '',
            listUsers: async () => w.nutzer.slice(),
            listScopesAlle: async (u) => (w.scopes[u] || []).slice(),
            del: async (u, s) => { w.ops.push('del ' + u + ' ' + s); },
            clearScopes: async (u) => { w.ops.push('clearScopes ' + u); w.nutzer = w.nutzer.filter(x => x !== u); },
            listGranteesBy: async (u) => w.grantsBy[u] || [],
            listGrantsFor: async (u) => w.grantsFor[u] || [],
            revokeGrant: async (o, g) => { w.ops.push('revoke ' + o + ' ' + g); },
            delPubkey: async (u) => { w.ops.push('delPubkey ' + u); }
        },
        storage: { sweep: async (prefix, age) => { w.ops.push('sweep ' + prefix + ' ' + age); return 0; } }
    };
    return w;
}
const hat = (w, s) => w.ops.indexOf(s) !== -1;
const geloescht = (w, u) => w.ops.some(x => x.indexOf('clearScopes ' + u) === 0);

(async function () {
    // 1 Probelauf
    let w = welt();
    let r = await L.tageslauf(w.d);
    check('1a Probelauf ohne SYNC_LOESCHUNG', r.status === 'probelauf');
    check('1b vorgemerkt: B und D (canceled/expired), nicht A/E (aktiv), C (past_due), O (Owner)',
          Object.keys(w.plan).sort().join() === 'user_B,user_D');
    check('1c keine Kunden-Mail im Probelauf', w.mails.length === 0);
    w.d.now = T0 + 31 * TAG; w.alarme = [];
    r = await L.tageslauf(w.d);
    check('1d Tag 31 im Probelauf: nichts gelöscht', !geloescht(w, 'user_B') && !geloescht(w, 'user_D'));
    check('1e Bericht nennt „würde löschen“ mit IDs', w.alarme.some(a => /PROBELAUF/.test(a) && /wuerde loeschen 2/.test(a) && /user_B/.test(a)));

    // 2 scharf
    w = welt({ env: { SYNC_LOESCHUNG: 'aktiv' } });
    await L.tageslauf(w.d);
    check('2a Mail 1 sofort an B (E-Mail klein), nicht an D (keine Adresse)', w.mails.length === 1 && w.mails[0].email === 'b@x.de' && w.mails[0].nr === 1);
    check('2b Mail 1 nennt Datum Tag 30 und Prüfliste', /1\. Dezember 2026/.test(w.mails[0].m.betreff) && /Prüfliste/.test(w.mails[0].m.text));
    w.d.now = T0 + 10 * TAG; await L.tageslauf(w.d);
    check('2c Tag 10: keine weitere Mail', w.mails.length === 1);
    w.d.now = T0 + 23 * TAG; await L.tageslauf(w.d);
    check('2d Tag 23: Mail 2', w.mails.length === 2 && w.mails[1].nr === 2 && /Erinnerung/.test(w.mails[1].m.betreff));
    w.d.now = T0 + 29.9 * TAG; await L.tageslauf(w.d);
    check('2e vor Tag 30: nichts gelöscht', !geloescht(w, 'user_B'));
    w.d.now = T0 + 30 * TAG; await L.tageslauf(w.d);
    check('2f Tag 30 und 7 Tage nach Mail 2: B gelöscht, aus dem Plan', geloescht(w, 'user_B') && !w.plan.user_B);

    // 3 Umfang
    check('3a Snapshots co_1 und __account gelöscht', hat(w, 'del user_B co_1') && hat(w, 'del user_B __account'));
    check('3b Anhänge und tmp per Präfix', hat(w, 'sweep stackr/attachments/user_B/ null') && hat(w, 'sweep stackr/tmp/user_B/ null'));
    check('3c erteilte Freigabe widerrufen, Pubkey gelöscht', hat(w, 'revoke user_B user_S') && hat(w, 'delPubkey user_B'));
    check('3d Prüfliste nie angefasst', !w.ops.some(x => /anchor/i.test(x)));
    check('3e D ohne E-Mail an Tag 30 ohne Mail gelöscht', geloescht(w, 'user_D') && !w.mails.some(m => m.email === undefined));
    let w2 = welt({ env: { SYNC_LOESCHUNG: 'aktiv' }, grantsFor: { user_B: [{ id: 'user_X' }] } });
    w2.plan.user_B = { user_id: 'user_B', inaktiv_seit: new Date(T0 - 40 * TAG).toISOString(), mail1_am: null, mail2_am: new Date(T0 - 8 * TAG).toISOString() };
    await L.tageslauf(w2.d);
    check('3f selbst Freigabe-Empfänger: Daten weg, Pubkey bleibt', geloescht(w2, 'user_B') && !hat(w2, 'delPubkey user_B'));

    // 4 wieder aktiv
    w = welt({ env: { SYNC_LOESCHUNG: 'aktiv' } });
    await L.tageslauf(w.d);
    w.members[1].status = 'active'; w.d.now = T0 + 5 * TAG;
    await L.tageslauf(w.d);
    check('4a B wieder aktiv → aus dem Plan', !w.plan.user_B);
    check('4b Owner O nie im Plan, past_due C nie', !w.plan.user_O && !w.plan.user_C);
    w.nutzer = w.nutzer.filter(u => u !== 'user_D'); w.d.now = T0 + 6 * TAG;
    await L.tageslauf(w.d);
    check('4c Nutzer ohne Daten mehr → aus dem Plan', !w.plan.user_D);

    // 5 Schutz
    w = welt({ env: { SYNC_LOESCHUNG: 'aktiv' } }); w.whopFail = true;
    r = await L.tageslauf(w.d);
    check('5a Whop-Fehler → Abbruch, kein Plan, Alarm', r.status === 'abbruch' && !Object.keys(w.plan).length && w.alarme.some(a => /whop-fehler/.test(a)));
    w = welt({ env: { SYNC_LOESCHUNG: 'aktiv' }, members: [{ status: 'canceled', user: { id: 'user_A' } }] });
    r = await L.tageslauf(w.d);
    check('5b keine gültige Mitgliedschaft → Abbruch', r.status === 'abbruch' && r.grund === 'whop-leer' && !Object.keys(w.plan).length);
    w = welt({ env: { SYNC_LOESCHUNG: 'aktiv' }, nutzer: ['user_A', 'user_B', 'user_D', 'user_F', 'user_G', 'user_H'] });
    r = await L.tageslauf(w.d);
    check('5c 5 von 6 auf einmal inaktiv → Abbruch ohne Änderung', r.grund === 'massen' && !Object.keys(w.plan).length && w.alarme.some(a => /massen/.test(a)));

    // 6 Mail scheitert
    w = welt({ env: { SYNC_LOESCHUNG: 'aktiv' } }); w.mailFail = true;
    await L.tageslauf(w.d);
    w.d.now = T0 + 31 * TAG; await L.tageslauf(w.d);
    check('6a Mail scheitert → B wird an Tag 31 NICHT gelöscht', !geloescht(w, 'user_B'));
    w.mailFail = false; await L.tageslauf(w.d);
    check('6b Mail 2 klappt an Tag 31 → angekündigtes Datum ≥ heute + 7', w.mails.some(m => m.nr === 2 && /9\. Dezember 2026/.test(m.m.betreff)));
    w.d.now = T0 + 37.5 * TAG; await L.tageslauf(w.d);
    check('6c 6,5 Tage nach Mail 2: noch nicht gelöscht', !geloescht(w, 'user_B'));
    w.d.now = T0 + 38 * TAG; await L.tageslauf(w.d);
    check('6d 7 Tage nach Mail 2: gelöscht', geloescht(w, 'user_B'));

    // 7 Migration und Verdrahtung
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261026000002_loeschplan.sql'), 'utf8');
    const fns = ['sync_loeschplan_liste()', 'sync_loeschplan_vormerken(text[])', 'sync_loeschplan_mail(text, integer)',
                 'sync_loeschplan_entfernen(text)', 'sync_list_users()', 'sync_delete_pubkey(text)'];
    check('7a alle Funktionen: revoke public/anon/authenticated, grant service_role',
          fns.every(f => sql.indexOf('revoke all on function ' + f) !== -1 && sql.indexOf('grant execute on function ' + f) !== -1));
    check('7b loeschplan ohne E-Mail-Spalte, RLS an', !/create table[\s\S]*?email[\s\S]*?\);/.test(sql.split('alter table')[0]) && /alter table loeschplan enable row level security/.test(sql));
    const bc = fs.readFileSync(path.join(ROOT, 'api/blob-cleanup.js'), 'utf8');
    check('7c blob-cleanup ruft loeschung.laufen(now)', /await loeschung\.laufen\(now\)/.test(bc));
    const ss = fs.readFileSync(path.join(ROOT, 'api/_sync-store.js'), 'utf8');
    check('7d Sync-Adapter: listUsers/delPubkey für Redis und Supabase', (ss.match(/listUsers:/g) || []).length === 3 && (ss.match(/delPubkey:/g) || []).length === 3);

    console.log('\n' + pass + '/' + total + ' bestanden');
    process.exit(pass === total ? 0 : 1);
})().catch(e => { console.log('✗ Abbruch: ' + (e && e.stack)); process.exit(1); });
