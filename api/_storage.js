// Stackr — Objektspeicher für Anhänge: Vercel Blob (heute) ODER Supabase Storage
// =============================================================================
// Phase 1 des Plans vom 2026-10-06. Entscheidung des Users: privater Bucket, Abruf
// nur über kurzlebige signierte URLs (action=sign in api/blob-upload.js).
//
//   BLOB_BACKEND   'vercel' (Default, heutiger Stand) | 'supabase'
//                  — wohin NEUE Objekte gehen.
//
// Referenzen: Der Browser speichert pro Anhang eine Referenz VERSCHLÜSSELT im
// Snapshot. Der Server kann sie daher nie umschreiben, alte Referenzen bleiben für
// immer im Umlauf. Zwei Formen:
//   https://<store>.public.blob.vercel-storage.com/stackr/...   (Vercel Blob)
//   sb:stackr/...                                               (Supabase Storage)
// Beide tragen denselben Objektschlüssel (stackr/<kind>/<user>/<scope>/<name>-<zufall>).
// Das Backfill (scripts/backfill-blob-supabase.js) kopiert Vercel-Objekte unter genau
// diesem Schlüssel nach Supabase. Im Supabase-Modus signiert sign() deshalb auch alte
// Vercel-Referenzen gegen Supabase; liegt die Kopie noch nicht dort, kommt die alte
// öffentliche URL zurück. So gibt es keinen Stichtag, an dem Anhänge verschwinden.
//
// Env wird bei jedem Aufruf gelesen, nicht beim Laden (Tests laden Handler neu,
// ohne dieses Modul neu zu laden).
//
// Der Dateiname beginnt mit "_", damit Vercel sie NICHT als Route ausliefert.
// =============================================================================
var crypto = require('crypto');
var db     = require('./_db.js');

var BUCKET       = 'attachments';
var SIGN_TTL_SEC = 300;
var VERCEL_RE    = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;

function backend()        { return process.env.BLOB_BACKEND || 'vercel'; }
function vercelToken()    { return process.env.BLOB_READ_WRITE_TOKEN || ''; }
function supabaseActive() { return backend() === 'supabase' && db.isConfigured(); }
function vercelBlob()     { return require('@vercel/blob'); }

function sbBase() { return (process.env.SUPABASE_URL || '').replace(/\/+$/, '') + '/storage/v1'; }
function sbHeaders(extra) {
    var k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    return Object.assign({ 'apikey': k, 'Authorization': 'Bearer ' + k }, extra || {});
}
function encKey(key) { return key.split('/').map(encodeURIComponent).join('/'); }

// Fehlermeldung, wenn das gewählte System nicht nutzbar ist, sonst ''.
function configProblem() {
    var b = backend();
    if (b === 'vercel')   return vercelToken() ? '' : 'BLOB_READ_WRITE_TOKEN fehlt';
    if (b === 'supabase') return db.isConfigured() ? '' : 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY fehlen';
    return 'BLOB_BACKEND unbekannt: ' + b;
}

// Objektschlüssel einer Referenz, oder null bei allem anderen. '..' und leere
// Segmente werden verworfen — der Schlüssel ist Grundlage der Eigentumsprüfung.
function keyOf(ref) {
    if (typeof ref !== 'string') return null;
    var key = null;
    if (ref.indexOf('sb:') === 0) key = ref.slice(3);
    else if (VERCEL_RE.test(ref)) {
        try { key = decodeURIComponent(new URL(ref).pathname.slice(1)); } catch (e) { return null; }
    }
    if (!key || key.split('/').some(function (s) { return s === '' || s === '.' || s === '..'; })) return null;
    return key;
}

// ── Schreiben ────────────────────────────────────────────────────────────────
async function put(key, buf) {
    if (backend() === 'supabase') {
        var full = key + '-' + crypto.randomBytes(12).toString('base64url');
        var r = await fetch(sbBase() + '/object/' + BUCKET + '/' + encKey(full), {
            method:  'POST',
            headers: sbHeaders({ 'Content-Type': 'application/octet-stream', 'x-upsert': 'false' }),
            body:    buf,
            signal:  AbortSignal.timeout(60000)
        });
        if (!r.ok) throw new Error('Storage put HTTP ' + r.status);
        return 'sb:' + full;
    }
    var blob = await vercelBlob().put(key, buf, {
        access: 'public', addRandomSuffix: true, contentType: 'application/octet-stream', token: vercelToken()
    });
    return blob.url;
}

// ── Lesen (nur für commit: Chunks zusammensetzen) ────────────────────────────
async function read(ref) {
    var r;
    if (ref.indexOf('sb:') === 0) {
        r = await fetch(sbBase() + '/object/authenticated/' + BUCKET + '/' + encKey(keyOf(ref)), {
            headers: sbHeaders(), redirect: 'error', signal: AbortSignal.timeout(15000)
        });
    } else {
        // redirect:'error' — die URL ist auf den eigenen Namespace geprüft; eine
        // Weiterleitung würde genau diese Prüfung umgehen (SSRF).
        r = await fetch(ref, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    }
    if (!r.ok) { var e = new Error('read HTTP ' + r.status); e.httpStatus = r.status; throw e; }
    return Buffer.from(await r.arrayBuffer());
}

// ── Löschen ──────────────────────────────────────────────────────────────────
async function sbDelete(keys) {
    for (var i = 0; i < keys.length; i += 1000) {
        var r = await fetch(sbBase() + '/object/' + BUCKET, {
            method:  'DELETE',
            headers: sbHeaders({ 'Content-Type': 'application/json' }),
            body:    JSON.stringify({ prefixes: keys.slice(i, i + 1000) }),
            signal:  AbortSignal.timeout(15000)
        });
        if (!r.ok) throw new Error('Storage delete HTTP ' + r.status);
    }
}

// Löscht jede Referenz dort, wo sie liegt — und im Supabase-Modus auch die
// Backfill-Kopie einer Vercel-Referenz (Art. 17 DSGVO: keine Kopie bleibt zurück).
async function remove(refs) {
    var vercelUrls = refs.filter(function (u) { return VERCEL_RE.test(u); });
    var sbKeys = refs.filter(function (u) { return u.indexOf('sb:') === 0; }).map(keyOf);
    if (supabaseActive()) sbKeys = sbKeys.concat(vercelUrls.map(keyOf));
    if (sbKeys.length) await sbDelete(sbKeys);
    if (vercelUrls.length && vercelToken()) await vercelBlob().del(vercelUrls, { token: vercelToken() });
}

// ── Signieren (Abruf durch den Browser) ──────────────────────────────────────
// Rückgabe in derselben Reihenfolge wie refs.
async function sign(refs) {
    var out = refs.slice();
    var idx = [], keys = [];
    refs.forEach(function (ref, i) {
        if (ref.indexOf('sb:') === 0 || supabaseActive()) { idx.push(i); keys.push(keyOf(ref)); }
    });
    if (!keys.length) return out;   // reine Vercel-Referenzen: öffentlich, bleiben wie sie sind
    var r = await fetch(sbBase() + '/object/sign/' + BUCKET, {
        method:  'POST',
        headers: sbHeaders({ 'Content-Type': 'application/json' }),
        body:    JSON.stringify({ expiresIn: SIGN_TTL_SEC, paths: keys }),
        signal:  AbortSignal.timeout(8000)
    });
    if (!r.ok) throw new Error('Storage sign HTTP ' + r.status);
    var list = await r.json();
    idx.forEach(function (i, n) {
        var s = list[n];
        if (s && s.signedURL && !s.error) out[i] = sbBase() + s.signedURL;
        else if (refs[i].indexOf('sb:') === 0) out[i] = null;   // fehlt wirklich
        // Vercel-Referenz ohne Kopie in Supabase: alte öffentliche URL bleibt
    });
    return out;
}

// ── Auflisten + Löschen per Präfix (purge, Cron) ─────────────────────────────
// maxAgeMs: nur Objekte, die älter sind. Gibt die Zahl der gelöschten Objekte zurück.
async function sweep(prefix, maxAgeMs, now) {
    var deleted = 0, cursor;
    if (vercelToken()) {
        var vb = vercelBlob();
        do {
            var page = await vb.list({ prefix: prefix, cursor: cursor, limit: 1000, token: vercelToken() });
            var stale = (page.blobs || []).filter(function (b) {
                if (maxAgeMs == null) return true;
                var ts = b && b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
                return ts && (now - ts) > maxAgeMs;
            });
            if (stale.length) { await vb.del(stale.map(function (b) { return b.url; }), { token: vercelToken() }); deleted += stale.length; }
            cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
    }
    if (supabaseActive()) {
        var before = maxAgeMs == null ? null : new Date(now - maxAgeMs).toISOString();
        for (var guard = 0; guard < 100; guard++) {
            var names = await db.rpc('sync_storage_list', { p_prefix: prefix, p_before: before, p_limit: 1000 });
            if (!names || !names.length) break;
            await sbDelete(names);
            deleted += names.length;
        }
    }
    return deleted;
}

module.exports = {
    configProblem: configProblem,
    keyOf:         keyOf,
    put:           put,
    read:          read,
    remove:        remove,
    sign:          sign,
    sweep:         sweep,
    SIGN_TTL_SEC:  SIGN_TTL_SEC
};
