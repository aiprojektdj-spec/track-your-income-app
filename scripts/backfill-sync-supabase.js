// Backfill Cloud-Sync: Upstash Redis → Supabase (Phase 1, Schritt 1.3.2 im Plan vom 2026-10-06)
// =============================================================================
// Kopiert den Altbestand, den der Spiegel-Betrieb (STORAGE_MIRROR=supabase) nicht
// gesehen hat. Redis bleibt dabei unverändert; Supabase wird auf den Redis-Stand gebracht.
//
//   node scripts/backfill-sync-supabase.js            Trockenlauf: zählt nur
//   node scripts/backfill-sync-supabase.js --write    kopiert
//   node scripts/backfill-sync-supabase.js --check    vergleicht beide Seiten, Exit 1 bei Abweichung
//
// Env wie in Vercel: KV_REST_API_URL/KV_REST_API_TOKEN (oder UPSTASH_REDIS_REST_*),
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Gibt nur Zähler und Schlüsselnamen aus,
// nie Inhalte. Rate-Limit-Zähler (sync:rl:, sync:iprl:) werden nicht übernommen.
//
// Reihenfolge: erst Spiegel einschalten, dann --write, dann --check. Unmittelbar
// vor dem Umschalten (STORAGE_BACKEND=supabase) --check noch einmal laufen lassen.
// =============================================================================
'use strict';
const path  = require('path');
const store = require(path.join(__dirname, '..', 'api', '_sync-store.js'));
const R = store._backends.redis, S = store._backends.supabase;

const MODE = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'dry';
const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const ANCHOR_MAX  = 20000;   // wie api/sync.js

async function redisCmd(cmd) {
    const r = await fetch(REDIS_URL, { method: 'POST', body: JSON.stringify(cmd),
        headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' } });
    const j = await r.json();
    if (j && j.error) throw new Error('Redis: ' + j.error);
    return j.result;
}

async function scan(pattern) {
    const out = []; let cursor = '0';
    do {
        const [next, keys] = await redisCmd(['SCAN', cursor, 'MATCH', pattern, 'COUNT', '500']);
        out.push(...keys); cursor = String(next);
    } while (cursor !== '0');
    return out;
}

// Anker-Liste in Supabase durch die Redis-Liste ersetzen (nicht anhängen — der Spiegel
// kann schon einen Teil übernommen haben).
async function replaceAnchors(u, s, rows) {
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = await fetch(base + '/rest/v1/sync_anchors?user_id=eq.' + encodeURIComponent(u) + '&scope=eq.' + encodeURIComponent(s),
        { method: 'DELETE', headers: { apikey: key, Authorization: 'Bearer ' + key } });
    if (!r.ok) throw new Error('DELETE sync_anchors HTTP ' + r.status);
    if (rows.length) await S.appendAnchors(u, s, rows, ANCHOR_MAX);
}

// Zeilenzahl einer Tabelle — findet, was in Supabase liegt, in Redis aber nicht mehr
// (z. B. ein delete/revoke, dessen Spiegelung fehlschlug).
async function countRows(table, col) {
    const base = process.env.SUPABASE_URL.replace(/\/+$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const r = await fetch(base + '/rest/v1/' + table + '?select=' + col,
        { method: 'HEAD', headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'count=exact', Range: '0-0' } });
    if (!r.ok) throw new Error('count ' + table + ' HTTP ' + r.status);
    return Number((r.headers.get('content-range') || '').split('/')[1]);
}

// jsonb speichert Objektschlüssel in eigener Reihenfolge — daher sortiert vergleichen.
const canon = (v) => Array.isArray(v) ? v.map(canon)
    : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (o[k] = canon(v[k]), o), {}) : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

(async () => {
    if (!R.isConfigured() || !S.isConfigured()) throw new Error('Redis- und Supabase-Env müssen gesetzt sein');
    const n = { snapshots: 0, scopes: 0, anchors: 0, pubkeys: 0, grants: 0 }, diffs = [];

    for (const k of await scan('sync:*')) {
        const m = /^sync:([^:]+):([^:]+)$/.exec(k);
        if (!m || m[1] === 'rl' || m[1] === 'iprl') continue;
        const v = await R.get(m[1], m[2]); if (!v) continue;
        n.snapshots++;
        if (MODE === 'write') await S.put(m[1], m[2], v);
        if (MODE === 'check' && !same(v, await S.get(m[1], m[2]))) diffs.push(k);
    }
    for (const k of await scan('scopes:*')) {
        const u = k.slice(7), list = (await R.listScopes(u)).slice().sort();
        n.scopes += list.length;
        if (MODE === 'write') for (const s of list) await S.claimScope(u, s, 1000000000);
        if (MODE === 'check' && !same(list, (await S.listScopes(u)).slice().sort())) diffs.push(k);
    }
    for (const k of await scan('syncanchor:*')) {
        const m = /^syncanchor:([^:]+):([^:]+)$/.exec(k); if (!m) continue;
        const rows = await R.listAnchors(m[1], m[2]);
        n.anchors += rows.length;
        if (MODE === 'write') await replaceAnchors(m[1], m[2], rows);
        if (MODE === 'check' && !same(rows, await S.listAnchors(m[1], m[2]))) diffs.push(k);
    }
    for (const k of await scan('pubkey:*')) {
        const u = k.slice(7), v = await R.getPubkey(u); if (!v) continue;
        n.pubkeys++;
        if (MODE === 'write') await S.setPubkey(u, v);
        if (MODE === 'check' && !same(v, await S.getPubkey(u))) diffs.push(k);
    }
    for (const k of await scan('grant:*')) {
        const m = /^grant:([^:]+):([^:]+)$/.exec(k); if (!m) continue;
        const v = await R.getGrant(m[1], m[2]); if (!v) continue;
        n.grants++;
        if (MODE === 'write') await S.addGrant(m[1], m[2], v, 1000000000);
        if (MODE === 'check' && !same(v, await S.getGrant(m[1], m[2]))) diffs.push(k);
    }

    console.log(MODE, n);
    if (MODE === 'check') {
        const counts = { snapshots: ['sync_snapshots', 'user_id'], scopes: ['sync_scopes', 'user_id'],
                         anchors: ['sync_anchors', 'user_id'], pubkeys: ['public_keys', 'user_id'], grants: ['grants', 'owner_id'] };
        for (const [what, [table, col]] of Object.entries(counts)) {
            const c = await countRows(table, col);
            if (c !== n[what]) diffs.push(table + ': Supabase ' + c + ' Zeilen, Redis ' + n[what]);
        }
        diffs.forEach(d => console.log('ABWEICHUNG ' + d));
        console.log(diffs.length ? diffs.length + ' Abweichungen' : 'beide Seiten gleich');
        process.exit(diffs.length ? 1 : 0);
    }
})().catch(e => { console.error(e.message); process.exit(1); });
