// Rechte-Wächter für supabase/migrations/:  node test/test-migration-rechte.js
// =============================================================================
// Supabase gibt anon/authenticated per Default-Privileges Rechte auf alles, was neu in
// `public` angelegt wird (Tabellen, Sequenzen, Funktionen). Jede Migration nimmt das für
// ihre eigenen Objekte zurück — dieser Test sorgt dafür, dass keine künftige Migration das
// vergisst (Härtung H2 aus plan/audit-supabase-security-2026-10-07.md).
//
// Geprüft wird je Datei, für jedes dort NEU angelegte Objekt:
//   Tabelle   → RLS an + revoke … from public, anon, authenticated
//   serial    → revoke all on sequence <tabelle>_<spalte>_seq
//   Funktion  → Name beginnt mit sync_ (darauf bauen Rechte-Schleife und search_path-Migration),
//               revoke from public/anon/authenticated + grant execute to service_role
//               (ausdrücklich oder über die sync_%-Schleife in derselben Datei),
//               nie SECURITY DEFINER,
//               und ab 20261009000001_search_path.sql eine eigene `set search_path`.
// Ein `create or replace` einer schon früher angelegten Funktion (gleiche Signatur) behält
// ihre Rechte in Postgres und braucht kein erneutes revoke.
// =============================================================================
'use strict';
const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const SEARCH_PATH_AB = '20261009000001';
const ROLLEN = /from\s+public\s*,\s*anon\s*,\s*authenticated/i;

function ohneKommentare(sql) { return sql.replace(/--[^\n]*/g, ''); }

// "p_key text, p_window integer" → "text,integer"
function argTypen(args) {
    return args.split(',').map(a => a.trim()).filter(Boolean)
        .map(a => a.split(/\s+/).slice(1).join(' ').toLowerCase()).join(',');
}
function sigNorm(s) { return s.replace(/\s+/g, '').toLowerCase(); }

// files: [{ name, sql }] in Ausführungsreihenfolge. Rückgabe: Liste von Fehlertexten.
function pruefe(files) {
    const fehler = [], bekannt = new Set();
    for (const f of files) {
        const sql = ohneKommentare(f.sql);
        const hatSchleife = /proname\s+like\s+'sync\\_%'[\s\S]*revoke all on function[\s\S]*grant execute on function/i.test(sql);
        const revokes = [...sql.matchAll(/revoke\s+all\s+on\s+([^;]+?)\s+(from\s+[^;]+);/gi)]
            .filter(m => ROLLEN.test(m[2])).map(m => m[1]);
        const tabRevoke = new Set(), seqRevoke = new Set(), fnRevoke = new Set();
        for (const r of revokes) {
            let m;
            if ((m = /^sequence\s+(.+)$/i.exec(r)))      m[1].split(',').forEach(s => seqRevoke.add(s.trim().toLowerCase()));
            else if ((m = /^function\s+(.+)$/i.exec(r))) fnRevoke.add(sigNorm(m[1]));
            else r.split(',').forEach(t => tabRevoke.add(t.trim().replace(/^table\s+/i, '').toLowerCase()));
        }
        const fnGrant = new Set([...sql.matchAll(/grant\s+execute\s+on\s+function\s+(.+?)\s+to\s+service_role/gi)]
            .map(m => sigNorm(m[1])));

        for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
            const t = m[1].toLowerCase();
            if (!new RegExp('alter\\s+table\\s+' + t + '\\s+enable\\s+row\\s+level\\s+security', 'i').test(sql))
                fehler.push(f.name + ': Tabelle ' + t + ' ohne RLS');
            if (!tabRevoke.has(t)) fehler.push(f.name + ': Tabelle ' + t + ' ohne revoke');
            for (const c of m[2].matchAll(/^\s*(\w+)\s+(?:big|small)?serial\b/gim)) {
                const seq = t + '_' + c[1].toLowerCase() + '_seq';
                if (!seqRevoke.has(seq)) fehler.push(f.name + ': Sequenz ' + seq + ' ohne revoke');
            }
            if (/generated\s+(?:always|by\s+default)\s+as\s+identity/i.test(m[2]))
                fehler.push(f.name + ': Tabelle ' + t + ' mit identity-Spalte — Sequenz-Rechte hier ergänzen');
        }

        for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(\w+)\s*\(([^)]*)\)([\s\S]*?)\bas\s+\$/gi)) {
            const name = m[1].toLowerCase(), sig = name + '(' + argTypen(m[2]) + ')', kopf = m[3];
            if (/security\s+definer/i.test(kopf)) fehler.push(f.name + ': ' + sig + ' ist SECURITY DEFINER');
            if (f.name >= SEARCH_PATH_AB && !/set\s+search_path/i.test(kopf))
                fehler.push(f.name + ': ' + sig + ' ohne feste search_path');
            if (bekannt.has(sig)) continue;   // create or replace behält die Rechte
            bekannt.add(sig);
            if (name.indexOf('sync_') !== 0) { fehler.push(f.name + ': ' + sig + ' ohne sync_-Präfix'); continue; }
            if (!hatSchleife && !fnRevoke.has(sig)) fehler.push(f.name + ': ' + sig + ' ohne revoke');
            if (!hatSchleife && !fnGrant.has(sig))  fehler.push(f.name + ': ' + sig + ' ohne grant an service_role');
        }
    }
    return fehler;
}

function lade() {
    return fs.readdirSync(DIR).filter(n => n.endsWith('.sql')).sort()
        .map(n => ({ name: n, sql: fs.readFileSync(path.join(DIR, n), 'utf8') }));
}

let pass = 0;
function ok(msg) { pass++; console.log('✓ ' + msg); }

// 1. Der echte Bestand ist sauber
const echt = lade();
assert.ok(echt.length >= 8, 'Migrationen gefunden');
const befund = pruefe(echt);
assert.deepStrictEqual(befund, [], 'Rechte-Lücken:\n' + befund.join('\n'));
ok(echt.length + ' Migrationen: alle Tabellen, Sequenzen und Funktionen gesperrt');

// 2. Der Wächter schlägt an — sonst prüft Fall 1 nichts
const kaputt = pruefe([{ name: '20991231000001_test.sql', sql: [
    'create table if not exists geheim (',
    '    id bigserial primary key',
    ');',
    'create or replace function sync_neu(p text)',
    'returns void language sql as $$ select 1 $$;',
    'create or replace function hilfe()',
    'returns void language sql security definer set search_path = public as $$ select 1 $$;'
].join('\n') }]);
for (const erwartet of ['Tabelle geheim ohne RLS', 'Tabelle geheim ohne revoke', 'Sequenz geheim_id_seq ohne revoke',
                        'sync_neu(text) ohne feste search_path', 'sync_neu(text) ohne revoke',
                        'sync_neu(text) ohne grant an service_role', 'hilfe() ist SECURITY DEFINER',
                        'hilfe() ohne sync_-Präfix']) {
    assert.ok(kaputt.some(e => e.indexOf(erwartet) !== -1), 'erkennt: ' + erwartet + '\n' + kaputt.join('\n'));
}
ok('fehlendes RLS/revoke/grant, Sequenz, SECURITY DEFINER, Präfix und search_path werden erkannt');

// 3. Vollständige neue Migration geht durch; Neudefinition einer alten Funktion braucht kein revoke
const sauber = pruefe([
    { name: '20991231000001_a.sql', sql: [
        'create table if not exists t1 (',
        '    id bigserial primary key',
        ');',
        'alter table t1 enable row level security;',
        'create or replace function sync_x(p_a text, p_b integer)',
        'returns void language sql set search_path = public, pg_temp as $$ select 1 $$;',
        'revoke all on t1 from public, anon, authenticated;',
        'revoke all on sequence t1_id_seq from public, anon, authenticated;',
        'revoke all on function sync_x(text, integer) from public, anon, authenticated;',
        'grant execute on function sync_x(text, integer) to service_role;'
    ].join('\n') },
    { name: '20991231000002_b.sql', sql:
        'create or replace function sync_x(p_a text, p_b integer)\nreturns void language sql set search_path = public, pg_temp as $$ select 2 $$;' }
]);
assert.deepStrictEqual(sauber, []);
ok('vollständige Migration und Neudefinition ohne Fehlmeldung');

console.log('\n' + pass + '/3 Rechte-Tests bestanden ✅');
