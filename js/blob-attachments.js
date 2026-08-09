// ============================================================================
// BlobAttachments — Transport-Schicht zu api/blob-upload.js (Vercel Blob)
// ============================================================================
// Reiner Transport: Upload/Download/Delete roher Bytes + generisches Auslagern
// großer Base64-Felder aus dem Sync-JSON. Verschlüsselung bleibt bei CloudSync
// (js/cloud-sync.js) — dieses Modul bekommt encrypt/decrypt-Funktionen als
// Parameter injiziert und kennt selbst keinen Schlüssel.
//
// Warum: api/sync.js hat ein striktes ~3,5-MB-Chiffrat-Limit (Vercels 4,5-MB-
// Function-Body-Hardlimit, siehe dortiger Kommentar). Große Felder (Rechnungs-
// logo, Eigenbeleg-Foto/-PDF als Base64-Data-URL) würden dieses Limit sprengen,
// sobald genug Datensätze existieren. Lösung: Felder ≥ FIELD_THRESHOLD werden
// vor dem Push als eigenes verschlüsseltes Objekt zu Vercel Blob hochgeladen
// und im Sync-JSON durch eine kleine Referenz ersetzt — die lokale Kopie
// (IndexedDB) bleibt immer vollständig inline, nur die Cloud-Repräsentation
// ist schlank. Auf einem anderen Gerät wird die Referenz beim Pull wieder zum
// Original hydriert, BEVOR gemerged wird (siehe cloud-sync.js _syncScope).
//
// Transport-Chunking: Requests über MAX_CHUNK gehen als mehrere 'chunk'-Calls
// + 'commit' — deckt auch das (sehr seltene) Einzel-Attachment > 4 MB und den
// (praktisch nie mehr vorkommenden) Fall eines übergroßen Ledger-Chiffrats ab.
// Ergebnis: Größe ist nur noch durch MAX_TOTAL_BYTES (server-seitig) begrenzt,
// nicht durch die Transport-Chunkgröße — "praktisch unbegrenzt".
// ============================================================================
var BlobAttachments = (function () {
    'use strict';

    var API           = '/api/blob-upload';
    var MAX_CHUNK      = 4 * 1024 * 1024;   // Sicherheitsmarge unter Vercels 4,5-MB-Hardlimit (roh, kein Base64-Overhead)
    var FIELD_THRESHOLD = 20000;            // Base64-Zeichen (~15 KB roh) — darüber wird ausgelagert statt inline gesynct

    function _token() { try { return localStorage.getItem('whop_access_token') || ''; } catch (e) { return ''; } }

    // ── Roh-Upload (Bytes → Blob-URL), transparent gechunkt ───────────────────
    async function put(scope, name, bytes) {
        if (bytes.length <= MAX_CHUNK) {
            var r = await _req('put', scope, { name: name }, bytes);
            if (!r.ok) throw new Error('blob_put_' + r.status);
            return r.json.url;
        }
        var chunkUrls = [], uploadId = _randId();
        for (var i = 0, idx = 0; i < bytes.length; i += MAX_CHUNK, idx++) {
            var piece = bytes.subarray(i, Math.min(i + MAX_CHUNK, bytes.length));
            var cr = await _req('chunk', scope, { uploadId: uploadId, index: idx }, piece);
            if (!cr.ok) throw new Error('blob_chunk_' + cr.status);
            chunkUrls.push(cr.json.url);
        }
        var fr = await fetch(API + '?action=commit&scope=' + encodeURIComponent(scope), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _token() },
            body: JSON.stringify({ name: name, chunkUrls: chunkUrls })
        });
        var fj = await fr.json().catch(function () { return {}; });
        if (!fr.ok) throw new Error('blob_commit_' + fr.status);
        return fj.url;
    }

    function _req(action, scope, query, bytes) {
        var qs = Object.keys(query).map(function (k) { return k + '=' + encodeURIComponent(query[k]); }).join('&');
        return fetch(API + '?action=' + action + '&scope=' + encodeURIComponent(scope) + '&' + qs, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream', 'Authorization': 'Bearer ' + _token() },
            body: bytes
        }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, json: j }; }); });
    }

    function _randId() {
        var b = crypto.getRandomValues(new Uint8Array(9)), s = '';
        for (var i = 0; i < b.length; i++) s += b[i].toString(36);
        return s;
    }

    // ── Download (öffentliche Blob-URL, kein Auth nötig — Inhalt ist Chiffrat) ─
    async function get(url) {
        var r = await fetch(url);
        if (!r.ok) throw new Error('blob_get_' + r.status);
        return new Uint8Array(await r.arrayBuffer());
    }

    // ── Löschen (Ersetzen/Art. 17 DSGVO) — best-effort, wirft nicht, meldet aber ──
    // scope ist Pflicht: der Server prüft serverseitig, dass jede URL zum
    // Namespace (userId+scope) des aufrufenden Nutzers gehört (Ownership-Check).
    // Rückgabe: true nur bei bestätigtem Erfolg (HTTP 2xx) — der Aufrufer (cloud-sync.js
    // deleteRemote) nutzt das, um eine fehlgeschlagene Löschung in eine Retry-Queue
    // einzureihen, statt Erfolg zu melden, obwohl der Blob noch existiert (Art. 17 DSGVO).
    async function deleteUrls(scope, urls) {
        var list = (urls || []).filter(Boolean);
        if (!list.length) return true;
        try {
            var r = await fetch(API + '?action=delete&scope=' + encodeURIComponent(scope), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _token() },
                body: JSON.stringify({ urls: list })
            });
            if (!r.ok) { console.warn('[BlobAttachments] delete failed: HTTP ' + r.status); return false; }
            return true;
        } catch (e) { console.warn('[BlobAttachments] delete failed:', e && e.message); return false; }
    }

    // ── Base64-Data-URL ↔ rohe Bytes ───────────────────────────────────────────
    function _dataUrlToBytes(dataUrl) {
        var comma = dataUrl.indexOf(',');
        var meta  = dataUrl.slice(5, comma);              // "image/png;base64"
        var mime  = meta.split(';')[0];
        var b64   = dataUrl.slice(comma + 1);
        var bin   = atob(b64), b = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
        return { mime: mime, bytes: b };
    }
    function _bytesToDataUrl(bytes, mime) {
        var s = '', CH = 0x8000;
        for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
        return 'data:' + mime + ';base64,' + btoa(s);
    }

    // ── Ein Record/Objekt nach großen "data:"-Feldern durchsuchen (1 Ebene tief) ─
    function _fieldsOf(obj) {
        var out = [];
        for (var k in obj) {
            if (typeof obj[k] === 'string' && obj[k].length > FIELD_THRESHOLD && obj[k].indexOf('data:') === 0) out.push(k);
        }
        return out;
    }

    // Simpler, schneller String-Hash (FNV-1a) — nur zur Wiedererkennung unveränderten
    // Inhalts (Cache-Key), kein kryptografischer Zweck.
    function _fnv1a(str) {
        var h = 0x811c9dc5;
        for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
        return h.toString(36);
    }

    // ── Auslagern: großes "data:"-Feld → { __blobref__:1, url, iv, mime, size } ─
    // encryptBytes: async(Uint8Array) => { ct: base64, iv: base64 } (AES-GCM, vom Aufrufer/Scope-Schlüssel)
    // cache (optional, vom Aufrufer persistiert): { [contentHash]: blobUrl } — verhindert,
    // dass UNVERÄNDERTE Anhänge bei jedem Sync erneut hochgeladen werden (jeder Push
    // synct den ganzen Scope neu, nicht nur die geänderten Records).
    async function offloadLargeFields(scope, keys, encryptBytes, cache) {
        cache = cache || {};
        var uploads = [];
        function visit(obj) {
            if (!obj || typeof obj !== 'object') return;
            _fieldsOf(obj).forEach(function (field) {
                var raw  = obj[field];
                var hash = _fnv1a(raw);
                if (cache[hash]) { obj[field] = cache[hash]; return; }   // unverändert → vorhandene Referenz wiederverwenden
                var parsed = _dataUrlToBytes(raw);
                uploads.push((async function () {
                    // Fehlschlag (z.B. BLOB_READ_WRITE_TOKEN server-seitig noch nicht gesetzt) darf
                    // NICHT den ganzen Scope-Sync abbrechen — Feld bleibt dann einfach inline (wie
                    // bisher), nächster Sync-Versuch holt es nach. Bewusst kein Retry/Backoff hier.
                    try {
                        var enc  = await encryptBytes(parsed.bytes);
                        var ctBytes = _b64ToBytes(enc.ct);
                        var name = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
                        var url  = await put(scope, name, ctBytes);
                        var ref  = { __blobref__: 1, url: url, iv: enc.iv, mime: parsed.mime, size: parsed.bytes.length };
                        obj[field] = ref;
                        cache[hash] = ref;
                    } catch (e) {
                        console.warn('[BlobAttachments] Auslagern fehlgeschlagen, bleibt inline:', e && e.message);
                    }
                })());
            });
        }
        Object.keys(keys).forEach(function (k) {
            var v = keys[k];
            if (Array.isArray(v)) v.forEach(visit); else visit(v);
        });
        if (uploads.length) await Promise.all(uploads);
        return keys;
    }

    // ── Hydrieren: { __blobref__ } → wieder volle "data:"-URL (vor dem Merge!) ──
    // decryptBytes: async(Uint8Array ct, base64 iv) => Uint8Array plaintext
    async function hydrateFields(keys, decryptBytes) {
        var jobs = [];
        function visit(obj) {
            if (!obj || typeof obj !== 'object') return;
            for (var field in obj) {
                var v = obj[field];
                if (v && typeof v === 'object' && v.__blobref__) {
                    jobs.push((async function (o, f, ref) {
                        var ctBytes = await get(ref.url);
                        var plain   = await decryptBytes(ctBytes, ref.iv);
                        o[f] = _bytesToDataUrl(plain, ref.mime || 'application/octet-stream');
                    })(obj, field, v));
                }
            }
        }
        Object.keys(keys).forEach(function (k) {
            var v = keys[k];
            if (Array.isArray(v)) v.forEach(visit); else visit(v);
        });
        if (jobs.length) await Promise.all(jobs);
        return keys;
    }

    function _b64ToBytes(str) {
        var bin = atob(str), b = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
        return b;
    }

    return {
        MAX_CHUNK: MAX_CHUNK,
        FIELD_THRESHOLD: FIELD_THRESHOLD,
        put: put,
        get: get,
        deleteUrls: deleteUrls,
        offloadLargeFields: offloadLargeFields,
        hydrateFields: hydrateFields
    };
})();
if (typeof window !== 'undefined') window.BlobAttachments = BlobAttachments;
if (typeof module !== 'undefined' && module.exports) module.exports = BlobAttachments;
