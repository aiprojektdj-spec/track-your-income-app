// Backfill Anhänge: Vercel Blob → Supabase Storage (Phase 1, Plan vom 2026-10-06)
// =============================================================================
// Kopiert jedes Objekt unter stackr/attachments/ mit DEMSELBEN Schlüssel in den
// privaten Bucket. Die alten Vercel-URLs im Chiffrat der Nutzer bleiben gültig:
// api/_storage.js signiert sie im Supabase-Modus gegen genau diesen Schlüssel.
//
//   node scripts/backfill-blob-supabase.js            Trockenlauf: zählt nur
//   node scripts/backfill-blob-supabase.js --write    kopiert, prüft je Datei SHA-256
//   node scripts/backfill-blob-supabase.js --check    fehlt etwas in Supabase? Exit 1 wenn ja
//
// Reihenfolge: BLOB_BACKEND=supabase setzen (neue Uploads landen dann schon dort),
// dann --write, dann --check. Erst wenn --check Exit 0 liefert, darf Vercel Blob weg.
// tmp/ (Chunk-Reste) und alerts/ werden nicht kopiert.
//
// Env: BLOB_READ_WRITE_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Gibt nur Zähler und Schlüssel aus, nie Inhalte.
// =============================================================================
'use strict';
const crypto = require('crypto');
const path = require('path');
const { list } = require('@vercel/blob');
const db = require(path.join(__dirname, '..', 'api', '_db.js'));

const MODE   = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'dry';
const PREFIX = 'stackr/attachments/';
const TOKEN  = process.env.BLOB_READ_WRITE_TOKEN || '';
const SB     = (process.env.SUPABASE_URL || '').replace(/\/+$/, '') + '/storage/v1';
const KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const H      = (extra) => Object.assign({ apikey: KEY, Authorization: 'Bearer ' + KEY }, extra || {});
const enc    = (k) => k.split('/').map(encodeURIComponent).join('/');
const sha    = (b) => crypto.createHash('sha256').update(b).digest('hex');

// Alle vorhandenen Schlüssel auf einmal (Deckel großzügig; real liegen wenige tausend Objekte).
async function supabaseKeys() {
    const names = await db.rpc('sync_storage_list', { p_prefix: PREFIX, p_before: null, p_limit: 1000000 });
    return new Set(names || []);
}

async function download(url, opts) {
    const r = await fetch(url, Object.assign({ redirect: 'error' }, opts));
    if (!r.ok) throw new Error('GET HTTP ' + r.status);
    return Buffer.from(await r.arrayBuffer());
}

(async () => {
    if (!TOKEN || !db.isConfigured()) throw new Error('BLOB_READ_WRITE_TOKEN und SUPABASE_* müssen gesetzt sein');
    const have = await supabaseKeys();
    let total = 0, missing = 0, copied = 0, cursor;
    const fehlt = [];
    do {
        const page = await list({ prefix: PREFIX, cursor, limit: 1000, token: TOKEN });
        for (const b of page.blobs || []) {
            total++;
            if (have.has(b.pathname)) continue;
            missing++;
            if (MODE === 'check') { fehlt.push(b.pathname); continue; }
            if (MODE !== 'write') continue;
            const buf = await download(b.url);
            const up = await fetch(SB + '/object/attachments/' + enc(b.pathname), {
                method: 'POST', headers: H({ 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' }), body: buf
            });
            if (!up.ok) throw new Error('Upload ' + b.pathname + ' HTTP ' + up.status);
            const back = await download(SB + '/object/authenticated/attachments/' + enc(b.pathname), { headers: H() });
            if (sha(back) !== sha(buf)) throw new Error('Prüfsumme weicht ab: ' + b.pathname);
            copied++;
        }
        cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    console.log(MODE, { vercel: total, schonInSupabase: total - missing, fehlend: missing, kopiert: copied });
    if (MODE === 'check') {
        fehlt.forEach(k => console.log('FEHLT ' + k));
        process.exit(missing ? 1 : 0);
    }
})().catch(e => { console.error(e.message); process.exit(1); });
