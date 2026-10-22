// Tabellenrechte für service_role in supabase/migrations/
//   node test/test-migration-tabellenrechte.js
// Supabase vergibt für neue Tabellen in public keine Rechte mehr automatisch (neue Projekte
// sofort, bestehende ab 30.10.2026). Die sync_*-Funktionen laufen als SECURITY INVOKER unter
// service_role und brauchen deshalb ein ausdrückliches GRANT. Geprüft wird:
//   1. jede angelegte Tabelle bekommt irgendwo select, insert, update, delete an service_role
//   2. jede bigserial-Sequenz bekommt usage an service_role
//   3. ab 20261010000001 steht das GRANT in derselben Migration wie das CREATE TABLE
// Ergänzt test/test-migration-rechte.js (RLS, revoke, Funktionsrechte).
// Ausnahme RLS-Weg E-A: Tabellen mit `force row level security` in ihrer Datei sind
// Datentabellen; auf sie hat service_role bewusst KEINE Rechte (Zugriff nur über die
// stackr_app-Funktionen). Für sie gilt umgekehrt: kein GRANT an service_role, dafür eines
// an stackr_app; ihre Sequenzen bekommen usage an stackr_app (test/test-server-datenmodell.js).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const GLEICHE_DATEI_AB = '20261010000001';
let pass = 0;
const ok = (msg) => { pass++; console.log('✓ ' + msg); };

function ohneKommentare(sql) { return sql.replace(/--[^\n]*/g, ''); }

// Tabellen aus einem "grant ... on [table] a, b, c to ..., service_role" herauslösen
function grantsAnServiceRole(sql, art) {
    const out = [];
    const re = art === 'table'
        ? /grant\s+([a-z,\s]+?)\s+on\s+(?:table\s+)?([\w\s,.]+?)\s+to\s+([\w\s,]+?);/gi
        : /grant\s+([a-z,\s]+?)\s+on\s+sequence\s+([\w\s,.]+?)\s+to\s+([\w\s,]+?);/gi;
    for (const m of sql.matchAll(re)) {
        if (!/\bservice_role\b/i.test(m[3])) continue;
        if (art === 'table' && /\bfunction\b|\bsequence\b|\bschema\b/i.test(m[2])) continue;
        const rechte = m[1].toLowerCase().split(/[\s,]+/).filter(Boolean);
        for (const n of m[2].split(',')) out.push({ name: n.trim().replace(/^public\./i, ''), rechte });
    }
    return out;
}

function pruefe(files) {
    const fehler = [];
    const tabellen = [], sequenzen = [];
    const tabGrants = new Map(), seqGrants = new Map(), appTab = new Set(), appSeq = new Set();
    for (const f of files) {
        const sql = ohneKommentare(f.sql);
        for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
            const forced = new RegExp('alter\\s+table\\s+' + m[1] + '\\s+force\\s+row\\s+level\\s+security', 'i').test(sql);
            tabellen.push({ name: m[1], datei: f.name, forced });
            for (const s of m[2].matchAll(/^\s*(\w+)\s+(?:big)?serial\b/gim)) sequenzen.push({ name: m[1] + '_' + s[1] + '_seq', datei: f.name, forced });
        }
        for (const m of sql.matchAll(/grant\s+[a-z,\s]+?\s+on\s+(table|sequence)\s+([\w\s,.]+?)\s+to\s+stackr_app\s*;/gi))
            for (const n of m[2].split(',')) (m[1].toLowerCase() === 'table' ? appTab : appSeq).add(n.trim());
        for (const g of grantsAnServiceRole(sql, 'table')) {
            const alt = tabGrants.get(g.name) || { rechte: new Set(), dateien: new Set() };
            g.rechte.forEach(r => alt.rechte.add(r)); alt.dateien.add(f.name); tabGrants.set(g.name, alt);
        }
        for (const g of grantsAnServiceRole(sql, 'sequence')) {
            const alt = seqGrants.get(g.name) || { rechte: new Set() };
            g.rechte.forEach(r => alt.rechte.add(r)); seqGrants.set(g.name, alt);
        }
    }
    for (const t of tabellen) {
        const g = tabGrants.get(t.name);
        if (t.forced) {
            if (g) fehler.push(t.name + ': Datentabelle (force RLS) mit grant an service_role');
            if (!appTab.has(t.name)) fehler.push(t.name + ': Datentabelle (force RLS) ohne grant an stackr_app');
            continue;
        }
        const fehlt = ['select', 'insert', 'update', 'delete'].filter(r => !(g && (g.rechte.has(r) || g.rechte.has('all'))));
        if (fehlt.length) fehler.push(t.name + ': service_role fehlt ' + fehlt.join(', '));
        else if (t.datei >= GLEICHE_DATEI_AB && !g.dateien.has(t.datei)) fehler.push(t.name + ': grant nicht in ' + t.datei);
    }
    for (const s of sequenzen) {
        const g = seqGrants.get(s.name);
        if (s.forced) {
            if (g) fehler.push(s.name + ': Sequenz einer Datentabelle mit grant an service_role');
            if (!appSeq.has(s.name)) fehler.push(s.name + ': stackr_app fehlt usage');
            continue;
        }
        if (!g || !(g.rechte.has('usage') || g.rechte.has('all'))) fehler.push(s.name + ': service_role fehlt usage');
    }
    return { fehler, tabellen: tabellen.length, sequenzen: sequenzen.length };
}

function lade() {
    return fs.readdirSync(DIR).filter(n => n.endsWith('.sql')).sort()
        .map(n => ({ name: n, sql: fs.readFileSync(path.join(DIR, n), 'utf8') }));
}

// 1 + 2: der echte Bestand
const echt = pruefe(lade());
assert.deepStrictEqual(echt.fehler, [], echt.fehler.join('\n'));
assert.ok(echt.tabellen >= 13 && echt.sequenzen >= 2, 'Tabellen und Sequenzen gefunden');
ok(`alle ${echt.tabellen} Tabellen und ${echt.sequenzen} Sequenzen haben ihre Rechte an service_role`);

// 3: Negativfälle
const neu = pruefe([
    { name: '20261020000001_neu.sql', sql: 'create table if not exists neu (\n    id bigserial primary key\n);\n' },
    { name: '20261021000001_nachtrag.sql', sql: 'grant select, insert, update, delete on table neu to service_role;\n' },
    { name: '20261022000001_halb.sql', sql: 'create table halb (\n    k text\n);\ngrant select on halb to service_role;\n' }
]);
assert.deepStrictEqual(neu.fehler.sort(), [
    'halb: service_role fehlt insert, update, delete',
    'neu: grant nicht in 20261020000001_neu.sql',
    'neu_id_seq: service_role fehlt usage'
]);
ok('fehlendes GRANT, GRANT in späterer Datei, Teilrechte und Sequenz werden erkannt');

const gut = pruefe([{ name: '20261020000001_gut.sql', sql: [
    'create table if not exists gut (', '    id bigserial primary key', ');',
    'grant select, insert, update, delete on table public.gut to service_role;',
    'grant usage, select on sequence gut_id_seq to service_role;'
].join('\n') + '\n' }]);
assert.deepStrictEqual(gut.fehler, []);
ok('eine vollständige Migration geht durch');

// 4: Datentabellen (force RLS) — service_role darf nichts, stackr_app muss
const ea = pruefe([{ name: '20261023000001_ea.sql', sql: [
    'create table if not exists dat (', '    seq bigserial primary key', ');',
    'alter table dat force row level security;',
    'grant select, insert, update, delete on table dat to service_role;',
    'create table if not exists dat2 (', '    seq bigserial primary key', ');',
    'alter table dat2 force row level security;',
    'grant select, insert on table dat2 to stackr_app;',
    'grant usage on sequence dat2_seq_seq to stackr_app;'
].join('\n') + '\n' }]);
assert.deepStrictEqual(ea.fehler.sort(), [
    'dat: Datentabelle (force RLS) mit grant an service_role',
    'dat: Datentabelle (force RLS) ohne grant an stackr_app',
    'dat_seq_seq: stackr_app fehlt usage'
]);
ok('Datentabellen: grant an service_role verboten, an stackr_app Pflicht');

console.log(`\n${pass} Prüfungen bestanden`);
