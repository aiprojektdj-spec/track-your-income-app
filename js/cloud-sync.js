// ============================================================================
// CloudSync — optionaler, Ende-zu-Ende-verschlüsselter Cloud-Sync (opt-in)
// ============================================================================
// Offline-First bleibt unangetastet: ohne Aktivierung tut dieses Modul NICHTS.
//
// E2E: Der 256-bit-Schlüssel wird lokal per crypto.getRandomValues erzeugt,
//   NUR lokal gespeichert und NIE hochgeladen. Alle Payloads werden client-
//   seitig mit AES-GCM verschlüsselt — der Server (api/sync.js → Upstash EU)
//   sieht ausschließlich Chiffrat.
//
// Modell: pro (User, Scope) ein verschlüsselter Snapshot mit CAS-Version.
//   Scope = "__account" (Firmen-Registry) | "co_<id>" (Daten einer Firma).
//   Merge passiert CLIENT-seitig pro Record (LWW nach updatedAt); Audit-Log
//   wird vereinigt und deterministisch re-chained (GoBD-Kette bleibt gültig).
//   pull → entschlüsseln → mergen → verschlüsseln → push (bei 409: retry).
//
// ponytail: 1 Snapshot je Scope statt per-Record-Keys — kleine Datenmengen,
//   ~0 Contention, halb so viel Code. Auf per-record-keys gehen erst, wenn ein
//   Blob das Upstash-Limit sprengt oder echte Multi-User-Contention auftritt.
// ============================================================================
var CloudSync = (function () {
    'use strict';

    var API          = '/api/sync';
    var PUSH_DEBOUNCE = 6000;
    var B32           = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    var EB_KEYS       = ['eigenbelege_belege', 'eigenbelege_kategorien',
                         'eigenbelege_einstellungen', 'eigenbelege_naechste_nummer', 'eigenbelege_produkte'];

    var LS_ENABLED = 'oyi_sync_enabled';
    var LS_KEY     = function (uid) { return 'oyi_sync_key_' + uid; };
    var LS_META    = function (scope) { return 'oyi_sync_keymeta_' + scope; };

    var _cryptoKeyCache = null;   // importierter CryptoKey (für aktuellen User)
    var _cryptoKeyUid   = null;
    var _running        = false;  // verhindert parallele Sync-Läufe
    var _pushTimer      = null;
    var _inited         = false;

    // ── Identität / State ────────────────────────────────────────────────────
    function _token()  { try { return localStorage.getItem('whop_access_token') || ''; } catch (e) { return ''; } }
    function _userId() {
        try { var u = JSON.parse(localStorage.getItem('whop_user') || '{}'); return u.id || u.sub || ''; }
        catch (e) { return ''; }
    }
    function _enabled() { return localStorage.getItem(LS_ENABLED) === '1'; }
    function _isPro()   { return typeof UserPlan === 'undefined' || UserPlan.isPro(); }
    function _activeScope() { return (typeof CompanyManager !== 'undefined') ? CompanyManager.getActiveId() : ''; }

    function _keyBytes(uid) {
        var b64 = localStorage.getItem(LS_KEY(uid || _userId()));
        if (!b64) return null;
        try { return _unb64(b64); } catch (e) { return null; }
    }
    function _hasKey() { return !!_keyBytes(); }

    // ── Base64 (chunked — verträgt MB-große Chiffrate) ────────────────────────
    function _b64(bytes) {
        var s = '', CH = 0x8000;
        for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
        return btoa(s);
    }
    function _unb64(str) {
        var bin = atob(str), b = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
        return b;
    }

    // ── Base32 (RFC4648) für den Wiederherstellungscode ───────────────────────
    function _toB32(bytes) {
        var bits = 0, val = 0, out = '';
        for (var i = 0; i < bytes.length; i++) {
            val = (val << 8) | bytes[i]; bits += 8;
            while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
        }
        if (bits > 0) out += B32[(val << (5 - bits)) & 31];
        return out;
    }
    function _fromB32(str) {
        str = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
        var bits = 0, val = 0, out = [];
        for (var i = 0; i < str.length; i++) {
            var idx = B32.indexOf(str[i]); if (idx < 0) continue;
            val = (val << 5) | idx; bits += 5;
            if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
        }
        return new Uint8Array(out);
    }
    function _groupCode(code) { return code.match(/.{1,5}/g).join(' '); }

    // ── Crypto (AES-GCM, Roh-Schlüssel — KEINE Passphrase-Ableitung) ──────────
    function _importKey(bytes) {
        return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }
    async function _cryptoKey() {
        var uid = _userId();
        if (_cryptoKeyCache && _cryptoKeyUid === uid) return _cryptoKeyCache;
        var bytes = _keyBytes(uid);
        if (!bytes) throw new Error('no_key');
        _cryptoKeyCache = await _importKey(bytes);
        _cryptoKeyUid   = uid;
        return _cryptoKeyCache;
    }
    async function _encrypt(obj) {
        var key = await _cryptoKey();
        var iv  = crypto.getRandomValues(new Uint8Array(12));
        var pt  = new TextEncoder().encode(JSON.stringify(obj));
        var ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, pt);
        return { ct: _b64(new Uint8Array(ct)), iv: _b64(iv) };
    }
    async function _decrypt(blob, overrideBytes) {
        var key = overrideBytes ? await _importKey(overrideBytes) : await _cryptoKey();
        var iv  = _unb64(blob.iv);
        var ct  = _unb64(blob.ciphertext);
        var pt  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
        return JSON.parse(new TextDecoder().decode(pt));
    }

    // ── Server-API ────────────────────────────────────────────────────────────
    async function _api(body) {
        var res = await fetch(API, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + _token() },
            body:    JSON.stringify(body)
        });
        var json = {};
        try { json = await res.json(); } catch (e) {}
        return { status: res.status, json: json };
    }

    // ── Key-Meta (Whole-Value-LWW für Nicht-Record-Keys wie settings) ─────────
    function _hash(s) { return (typeof Store !== 'undefined') ? Store._calcChecksum(s) : String(s.length); }
    function _getMeta(scope) { try { return JSON.parse(localStorage.getItem(LS_META(scope)) || '{}'); } catch (e) { return {}; } }
    function _saveMeta(scope, m) { try { localStorage.setItem(LS_META(scope), JSON.stringify(m)); } catch (e) {} }
    function _localKeyU(scope, key, serialized) {
        var m = _getMeta(scope), h = _hash(serialized);
        if (!m[key] || m[key].h !== h) { m[key] = { h: h, u: Date.now() }; _saveMeta(scope, m); return m[key].u; }
        return m[key].u;
    }
    function _setMeta(scope, key, serialized, u) {
        var m = _getMeta(scope); m[key] = { h: _hash(serialized), u: u }; _saveMeta(scope, m);
    }

    // ── Welche Keys gehören zu einem Scope ────────────────────────────────────
    function _scopeKeys(scope) {
        if (scope === '__account') return ['oyi_companies'];
        var keys = [], pfxR = scope + '__reselling_', pfxB = scope + '__rechnungsbuch_', aKey = scope + '__audit_log';
        if (typeof Store !== 'undefined') {
            for (var k in Store._cache) {
                if (k.indexOf(pfxR) === 0 || k.indexOf(pfxB) === 0 || k === aKey) keys.push(k);
            }
        }
        EB_KEYS.forEach(function (s) {
            var fk = scope + '__' + s;
            if (localStorage.getItem(fk) != null && keys.indexOf(fk) === -1) keys.push(fk);
        });
        return keys;
    }

    // ── Merge-Bausteine ────────────────────────────────────────────────────────
    function _isRecArr(a, b) {
        var probe = (Array.isArray(a) && a.length) ? a : ((Array.isArray(b) && b.length) ? b : null);
        if (!probe) return Array.isArray(a) || Array.isArray(b);   // beide leer/array → record-merge (no-op)
        return probe.every(function (x) { return x && typeof x === 'object' && ('id' in x); });
    }

    // LWW nach updatedAt; Tombstones (storniert/gesperrt) sind reguläre Felder → gewinnen via neuerem updatedAt
    function _mergeRecords(localArr, remoteArr) {
        var byId = {}, localDirty = false, remoteDirty = false, remoteIds = {};
        (localArr || []).forEach(function (r) { if (r && r.id != null) byId[r.id] = r; });
        var localIds = Object.keys(byId);
        (remoteArr || []).forEach(function (r) {
            if (!r || r.id == null) return;
            remoteIds[r.id] = 1;
            var ex = byId[r.id];
            if (!ex) { byId[r.id] = r; localDirty = true; }
            else {
                var ru = r.updatedAt || 0, lu = ex.updatedAt || 0;
                if (ru > lu) { byId[r.id] = r; localDirty = true; }
                else if (lu > ru) { remoteDirty = true; }
            }
        });
        localIds.forEach(function (id) { if (!remoteIds[id]) remoteDirty = true; });
        return { val: Object.keys(byId).map(function (id) { return byId[id]; }), localDirty: localDirty, remoteDirty: remoteDirty };
    }

    // Audit-Log: append-only Union + deterministisches Re-Chaining (GoBD)
    function _mergeAudit(localLog, remoteLog) {
        var byId = {};
        (localLog || []).concat(remoteLog || []).forEach(function (e) { if (e && e.id != null && !byId[e.id]) byId[e.id] = e; });
        var list = Object.keys(byId).map(function (id) { return byId[id]; });
        list.sort(function (a, b) {
            var t = String(a.timestamp || '').localeCompare(String(b.timestamp || '')); if (t) return t;
            var d = String(a._dev || '').localeCompare(String(b._dev || '')); if (d) return d;
            return String(a.id || '').localeCompare(String(b.id || ''));
        });
        var prev = 'GENESIS';
        for (var i = 0; i < list.length; i++) {
            list[i].prevHash = prev;
            list[i].checksum = '';
            list[i].checksum = Store._calcChecksum(JSON.stringify(Object.assign({}, list[i], { checksum: '' })));
            prev = list[i].checksum;
        }
        var ser = JSON.stringify(list);
        return { val: list, localDirty: ser !== JSON.stringify(localLog || []), remoteDirty: ser !== JSON.stringify(remoteLog || []) };
    }

    // Vollständiger Scope-Merge → { keys, meta, localDirty, remoteDirty }
    function _merge(scope, local, remote) {
        var mergedKeys = {}, mergedMeta = {}, localDirty = false, remoteDirty = false;
        var all = {};
        Object.keys(local.keys).forEach(function (k) { all[k] = 1; });
        if (remote) Object.keys(remote.keys).forEach(function (k) { all[k] = 1; });
        var aKey = scope + '__audit_log';

        Object.keys(all).forEach(function (k) {
            var lv = local.keys[k], rv = remote ? remote.keys[k] : undefined;
            if (k === aKey) {
                var ra = _mergeAudit(lv, rv);
                mergedKeys[k] = ra.val; if (ra.localDirty) localDirty = true; if (ra.remoteDirty) remoteDirty = true;
            } else if (_isRecArr(lv, rv)) {
                var rr = _mergeRecords(lv, rv);
                mergedKeys[k] = rr.val; if (rr.localDirty) localDirty = true; if (rr.remoteDirty) remoteDirty = true;
            } else {
                // Whole-Value-LWW über Key-Meta
                var lu = (local.meta[k] != null) ? local.meta[k] : (lv != null ? 0 : -1);
                var ru = (remote && remote.meta[k] != null) ? remote.meta[k] : (rv != null ? 0 : -1);
                if (rv === undefined)       { mergedKeys[k] = lv; mergedMeta[k] = lu; }
                else if (lv === undefined)  { mergedKeys[k] = rv; mergedMeta[k] = ru; localDirty = true; }
                else if (ru > lu)           { mergedKeys[k] = rv; mergedMeta[k] = ru; localDirty = true; }
                else                        { mergedKeys[k] = lv; mergedMeta[k] = lu; if (JSON.stringify(lv) !== JSON.stringify(rv)) remoteDirty = true; }
            }
        });
        return { keys: mergedKeys, meta: mergedMeta, localDirty: localDirty, remoteDirty: remoteDirty };
    }

    // ── Lokalen Snapshot bauen ────────────────────────────────────────────────
    function _buildLocal(scope) {
        var out = { v: 1, keys: {}, meta: {} }, keys = _scopeKeys(scope), aKey = scope + '__audit_log';
        keys.forEach(function (k) {
            var val = Store._syncReadRaw(k);
            if (val == null) return;
            out.keys[k] = val;
            if (k !== aKey && !_isRecArr(val, val)) out.meta[k] = _localKeyU(scope, k, JSON.stringify(val));
        });
        return out;
    }

    // ── Merge-Ergebnis lokal anwenden (kein _stampRecord → updatedAt bleibt) ──
    function _applyMerged(scope, merged) {
        var toCache = {};
        Object.keys(merged.keys).forEach(function (k) {
            var ser = JSON.stringify(merged.keys[k]);
            // Nicht-IDB-Keys (Registry, Eigenbelege) liegen in localStorage
            var isCacheKey = (k.indexOf('__reselling_') !== -1 || k.indexOf('__rechnungsbuch_') !== -1 || /__audit_log$/.test(k));
            if (isCacheKey) toCache[k] = ser;
            else { try { localStorage.setItem(k, ser); } catch (e) {} }
            if (merged.meta[k] != null) _setMeta(scope, k, ser, merged.meta[k]);
        });
        if (Object.keys(toCache).length && typeof Store !== 'undefined') Store.syncApplyKeys(toCache);
    }

    // ── Einen Scope synchronisieren (pull → merge → push, CAS-Retry) ──────────
    async function _syncScope(scope, isStartup, attempt) {
        attempt = attempt || 0;
        var pull = await _api({ action: 'pull', scope: scope });
        if (pull.status === 403) throw new Error('pro_required');
        if (pull.status !== 200) throw new Error('pull_' + pull.status);

        var remote = null, remoteVer = 0;
        if (pull.json.blob) {
            remoteVer = pull.json.blob.version || 0;
            remote = await _decrypt(pull.json.blob);   // { keys, meta }
        }
        var local  = _buildLocal(scope);
        var merged = _merge(scope, local, remote);

        if (merged.localDirty) {
            _applyMerged(scope, merged);
            if (scope === _activeScope()) { if (isStartup) _needReload = true; else _changedActive = true; }
        }

        if (remote === null || merged.remoteDirty) {
            var enc  = await _encrypt({ v: 1, keys: merged.keys, meta: merged.meta });
            var push = await _api({ action: 'push', scope: scope, version: remoteVer, ciphertext: enc.ct, iv: enc.iv, deviceId: Store._deviceId() });
            if (push.status === 409 && attempt < 3) return _syncScope(scope, isStartup, attempt + 1);
            if (push.status === 403) throw new Error('pro_required');
            if (push.status !== 200) throw new Error('push_' + push.status);
        }
    }

    var _needReload    = false;
    var _changedActive = false;

    // ── Alle Scopes synchronisieren ───────────────────────────────────────────
    async function _syncAll(isStartup) {
        if (_running || !_enabled() || !_hasKey() || !_token() || !_isPro()) return;
        _running = true; _needReload = false; _changedActive = false;
        _setDot('sync');
        try {
            await _syncScope('__account', isStartup);   // zuerst Registry → Firmen-IDs angleichen
            var companies = (typeof CompanyManager !== 'undefined') ? CompanyManager.getAll() : [];
            for (var i = 0; i < companies.length; i++) {
                if (companies[i] && companies[i].id) await _syncScope(companies[i].id, isStartup);
            }
            _setDot('ok');
            if (_needReload)      { Utils.showToast('☁ Cloud-Daten übernommen — lade neu…', 'info', 1800); setTimeout(function () { location.reload(); }, 1300); }
            else if (_changedActive) Utils.showToast('☁ Daten aus der Cloud zusammengeführt', 'info', 3000);
        } catch (e) {
            console.warn('[CloudSync] sync error:', e && e.message);
            _setDot('err');
            if (e && e.message === 'pro_required' && typeof Utils !== 'undefined') Utils.showToast('Cloud-Sync ist ein Pro-Feature.', 'warning');
        } finally {
            _running = false;
        }
    }

    // ── Status-Punkt (wiederverwendet #cloudSyncDot) ──────────────────────────
    function _setDot(state) {
        var el = document.getElementById('cloudSyncDot');
        if (!el) return;
        el.style.cursor = 'pointer';
        el.onclick = openPanel;
        var map = {
            off:  ['<i class="ti ti-cloud"></i>', 'var(--text-muted,#888)',    'Cloud-Sync aus — klicken zum Aktivieren'],
            sync: ['<i class="ti ti-cloud"></i>', 'var(--accent,#10b981)',     'Synchronisiere…'],
            ok:   ['<i class="ti ti-cloud"></i>', 'var(--accent,#10b981)',     'Cloud-Sync aktiv'],
            err:  ['<i class="ti ti-cloud-exclamation"></i>', '#f59e0b',       'Cloud-Sync-Fehler — klicken für Details']
        };
        var s = map[state] || map.off;
        el.innerHTML = s[0]; el.style.color = s[1]; el.title = s[2];
    }

    // ── onLocalChange: debounced Push nach Änderung ───────────────────────────
    function onLocalChange() {
        if (!_enabled() || !_hasKey() || _running) return;
        clearTimeout(_pushTimer);
        _pushTimer = setTimeout(function () { _syncAll(false); }, PUSH_DEBOUNCE);
    }

    // ── Init: Dot setzen, beim Start Pull (sobald Store bereit) ───────────────
    function init() {
        _setDot(_enabled() && _hasKey() ? 'ok' : 'off');   // immer aktualisieren (auch bei Re-Init nach Auth)
        if (_inited) return; _inited = true;
        if (!_enabled() || !_hasKey() || !_token()) return;
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            if (typeof Store !== 'undefined' && (Store._mainIdbReady || tries > 20)) {
                clearInterval(iv);
                _syncAll(true);
            }
            if (tries > 40) clearInterval(iv);
        }, 500);
    }

    // ========================================================================
    // UI-Flows
    // ========================================================================
    function _esc(s) { return (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml(String(s)) : String(s); }

    function openPanel() {
        var on = _enabled() && _hasKey();
        var body;
        if (on) {
            body =
              '<div style="display:flex;flex-direction:column;gap:14px;">' +
                '<div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:8px;padding:12px;font-size:13px;">' +
                  '☁ <strong>Cloud-Sync ist aktiv.</strong> Deine Daten werden Ende-zu-Ende-verschlüsselt zwischen deinen Geräten synchronisiert. Der Server kann sie nicht lesen.' +
                '</div>' +
                '<button class="btn btn-outline" data-action="cs-show-code" style="width:100%;">🔑 Wiederherstellungscode anzeigen</button>' +
                '<button class="btn btn-outline" data-action="cs-sync-now" style="width:100%;">🔄 Jetzt synchronisieren</button>' +
                '<button class="btn" data-action="cs-disable" style="width:100%;background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.3);">Cloud-Sync deaktivieren</button>' +
              '</div>';
        } else {
            body =
              '<div style="display:flex;flex-direction:column;gap:14px;">' +
                '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">' +
                  'Cloud-Sync hält deine Daten <strong>verschlüsselt</strong> zwischen mehreren Geräten aktuell. ' +
                  'Die Verschlüsselung ist <strong>Ende-zu-Ende</strong>: nur du hast den Schlüssel, der Server sieht ausschließlich unlesbares Chiffrat. ' +
                  'Aufbewahrung beim Auftragsverarbeiter <strong>Upstash (Frankfurt, EU)</strong>.' +
                '</div>' +
                '<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:12px;font-size:12px;">' +
                  '⚠️ Du erhältst einen <strong>Wiederherstellungscode</strong>. Er ist der EINZIGE Weg, die Cloud-Daten zu entschlüsseln. ' +
                  'Geht er samt aller Geräte verloren, sind die Cloud-Daten <strong>unwiederbringlich</strong>. Wir können ihn nicht zurücksetzen.' +
                '</div>' +
                '<button class="btn btn-primary" data-action="cs-enable" style="width:100%;">☁ Cloud-Sync aktivieren</button>' +
                '<button class="btn btn-outline" data-action="cs-connect" style="width:100%;">📲 Mit bestehendem Sync verbinden</button>' +
              '</div>';
        }
        App.showModal('Cloud-Sync', body, '');
    }

    // ── Aktivieren: Schlüssel erzeugen → Code-Dialog (Pflicht-Bestätigung) ────
    function enableFlow() {
        if (!_isPro()) { Utils.showToast('Cloud-Sync ist ein Pro-Feature.', 'warning'); return; }
        var uid = _userId();
        if (!uid) { Utils.showToast('Bitte zuerst mit Whop anmelden.', 'warning'); return; }
        var bytes = crypto.getRandomValues(new Uint8Array(32));
        try { localStorage.setItem(LS_KEY(uid), _b64(bytes)); } catch (e) { Utils.showToast('Schlüssel konnte nicht gespeichert werden.', 'error'); return; }
        _cryptoKeyCache = null;
        showCode(true);
    }

    // ── Code-Dialog (firstTime erzwingt Bestätigung) ──────────────────────────
    function showCode(firstTime) {
        var bytes = _keyBytes();
        if (!bytes) { Utils.showToast('Kein Schlüssel auf diesem Gerät.', 'warning'); return; }
        var code   = _toB32(bytes);
        var grouped = _groupCode(code);
        var lastTwo = grouped.split(' ').slice(-2).join(' ');
        window.__syncCode = code;   // nur für Copy/Download-Buttons im Dialog

        var confirmBlock = firstTime ?
            ('<label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;cursor:pointer;">' +
                '<input type="checkbox" id="syncCodeSaved" style="margin-top:3px;"> ' +
                '<span>Ich habe den Code sicher gespeichert (Passwort-Manager, Ausdruck o.ä.).</span></label>' +
             '<div style="font-size:12px;color:var(--text-muted);">Bestätige durch Eingabe der <strong>letzten zwei Gruppen</strong> (' + _esc(lastTwo) + '):</div>' +
             '<input type="text" id="syncCodeConfirm" class="form-input" placeholder="' + _esc(lastTwo) + '" autocomplete="off" style="font-family:monospace;letter-spacing:1px;">' +
             '<button class="btn btn-primary" id="syncCodeNext" data-action="cs-finish-enable" style="width:100%;">Aktivieren &amp; synchronisieren</button>')
          : '<button class="btn btn-primary" data-action="close-modal" style="width:100%;">Schließen</button>';

        var body =
          '<div style="display:flex;flex-direction:column;gap:14px;">' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">' +
              'Das ist dein <strong>Wiederherstellungscode</strong>. Er entschlüsselt deine Cloud-Daten und ist der <strong>einzige</strong> Weg dazu. ' +
              'Weder Stackr noch der Server kennen ihn oder können ihn zurücksetzen. Bewahre ihn sicher auf.' +
            '</div>' +
            '<div style="font-family:monospace;font-size:16px;letter-spacing:2px;line-height:1.9;word-break:break-all;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:14px;text-align:center;">' +
              _esc(grouped) +
            '</div>' +
            '<div style="display:flex;gap:10px;">' +
              '<button class="btn btn-outline" data-action="cs-copy-code" style="flex:1;">📋 Kopieren</button>' +
              '<button class="btn btn-outline" data-action="cs-download-code" style="flex:1;">💾 Als .txt</button>' +
            '</div>' +
            '<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:10px;font-size:12px;">' +
              '💡 Tipp: Behalte zusätzlich ein <strong>unverschlüsseltes lokales Backup</strong> (Backup &amp; Daten) als letzten Rückfall.' +
            '</div>' +
            confirmBlock +
          '</div>';
        App.showModal('Wiederherstellungscode', body, '');
    }

    function _copyCode() {
        try { navigator.clipboard.writeText(_groupCode(window.__syncCode || '')); Utils.showToast('Code kopiert', 'success'); }
        catch (e) { Utils.showToast('Kopieren nicht möglich — bitte manuell markieren.', 'warning'); }
    }
    function _downloadCode() {
        var txt = 'Stackr Cloud-Sync — Wiederherstellungscode\n\n' + _groupCode(window.__syncCode || '') +
                  '\n\nWICHTIG: Einziger Weg, deine verschlüsselten Cloud-Daten zu lesen. Sicher aufbewahren. Nicht zurücksetzbar.\n';
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
        a.download = 'stackr-wiederherstellungscode.txt';
        document.body.appendChild(a); a.click(); a.remove();
    }

    function _finishEnable() {
        var saved = document.getElementById('syncCodeSaved');
        var conf  = document.getElementById('syncCodeConfirm');
        if (!saved || !saved.checked) { Utils.showToast('Bitte bestätige, dass du den Code gespeichert hast.', 'warning'); return; }
        var bytes = _keyBytes(); var expected = _groupCode(_toB32(bytes)).split(' ').slice(-2).join('');
        var got = (conf ? conf.value : '').toUpperCase().replace(/[^A-Z2-7]/g, '');
        if (got !== expected) { Utils.showToast('Die eingegebenen Gruppen stimmen nicht. Bitte prüfen.', 'error'); if (conf) conf.focus(); return; }
        localStorage.setItem(LS_ENABLED, '1');
        App.closeModal();
        Utils.showToast('☁ Cloud-Sync aktiviert', 'success');
        _setDot('sync');
        _syncAll(false);
    }

    // ── Mit bestehendem Sync verbinden (Code → Test-Entschlüsselung) ──────────
    function connectFlow() {
        if (!_isPro()) { Utils.showToast('Cloud-Sync ist ein Pro-Feature.', 'warning'); return; }
        var body =
          '<div style="display:flex;flex-direction:column;gap:14px;">' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">' +
              'Gib den <strong>Wiederherstellungscode</strong> deines anderen Geräts ein. Er wird per Test-Entschlüsselung geprüft, lokal gespeichert und deine Daten werden zusammengeführt.' +
            '</div>' +
            '<textarea id="syncConnectCode" class="form-input" rows="3" placeholder="z.B. ABCDE FGHIJ KLMNO …" autocomplete="off" style="font-family:monospace;letter-spacing:1px;"></textarea>' +
            '<button class="btn btn-primary" id="syncConnectBtn" data-action="cs-finish-connect" style="width:100%;">Verbinden &amp; synchronisieren</button>' +
          '</div>';
        App.showModal('Mit bestehendem Sync verbinden', body, '');
    }

    async function _finishConnect() {
        var ta = document.getElementById('syncConnectCode');
        var btn = document.getElementById('syncConnectBtn');
        var bytes = _fromB32(ta ? ta.value : '');
        if (bytes.length !== 32) { Utils.showToast('Code unvollständig oder ungültig.', 'error'); return; }
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Prüfe…'; }
        try {
            // Test-Entschlüsselung gegen die Account-Registry des anderen Geräts
            var pull = await _api({ action: 'pull', scope: '__account' });
            if (pull.status === 403) { Utils.showToast('Cloud-Sync ist ein Pro-Feature.', 'warning'); throw 0; }
            if (pull.status !== 200) { Utils.showToast('Server nicht erreichbar (' + pull.status + ').', 'error'); throw 0; }
            if (pull.json.blob) {
                try { await _decrypt(pull.json.blob, bytes); }
                catch (e) { Utils.showToast('❌ Code falsch — Entschlüsselung fehlgeschlagen.', 'error'); throw 0; }
            } else {
                Utils.showToast('Keine bestehenden Cloud-Daten gefunden — Sync wird neu aufgebaut.', 'info');
            }
            // Code korrekt → lokal speichern, aktivieren
            localStorage.setItem(LS_KEY(_userId()), _b64(bytes));
            localStorage.setItem(LS_ENABLED, '1');
            _cryptoKeyCache = null;
            App.closeModal();
            Utils.showToast('✅ Verbunden — synchronisiere…', 'success');
            await _syncAll(true);
            // Frisches Gerät ohne aktive Firma → erste übernommene Firma aktivieren
            if (typeof CompanyManager !== 'undefined' && !CompanyManager.getActiveId() && CompanyManager.getAll().length) {
                localStorage.setItem('oyi_active_company', CompanyManager.getAll()[0].id);
                _needReload = true;
            }
            if (_needReload) setTimeout(function () { location.reload(); }, 1200);
        } catch (e) {
            if (btn) { btn.disabled = false; btn.textContent = 'Verbinden & synchronisieren'; }
        }
    }

    function syncNow() { App.closeModal(); _syncAll(false); }

    // ── Art. 17 DSGVO: verschlüsselten Cloud-Snapshot eines Scopes löschen ────
    // Wird von "Geschäftsdaten löschen" aufgerufen, damit gelöschte Daten nicht
    // beim nächsten Sync aus der Cloud zurückgeholt werden (sonst LWW-Merge-Falle).
    async function deleteRemote(scope) {
        if (!_enabled() || !_hasKey() || !_token()) return true; // Cloud-Sync nicht aktiv → nichts zu löschen
        try {
            await _api({ action: 'delete', scope: scope });
            // lokale Sync-Metadaten für diesen Scope ebenfalls verwerfen
            localStorage.removeItem(LS_META(scope));
            return true;
        } catch (e) {
            console.warn('[CloudSync] deleteRemote error:', e && e.message);
            return false;
        }
    }

    function disableFlow() {
        var body =
          '<div style="display:flex;flex-direction:column;gap:14px;">' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">' +
              'Cloud-Sync wird auf <strong>diesem Gerät</strong> deaktiviert. Deine lokalen Daten bleiben vollständig erhalten. ' +
              'Bereits in der Cloud liegende (verschlüsselte) Daten bleiben für deine anderen Geräte bestehen.' +
            '</div>' +
            '<label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;cursor:pointer;">' +
              '<input type="checkbox" id="syncWipeKey" style="margin-top:3px;"> ' +
              '<span>Schlüssel ebenfalls von diesem Gerät löschen. <strong>Achtung:</strong> ohne Wiederherstellungscode danach kein Cloud-Zugriff mehr.</span></label>' +
            '<button class="btn" data-action="cs-finish-disable" style="width:100%;background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.3);">Deaktivieren</button>' +
          '</div>';
        App.showModal('Cloud-Sync deaktivieren', body, '');
    }
    function _finishDisable() {
        var wipe = document.getElementById('syncWipeKey');
        localStorage.removeItem(LS_ENABLED);
        if (wipe && wipe.checked) { localStorage.removeItem(LS_KEY(_userId())); _cryptoKeyCache = null; }
        clearTimeout(_pushTimer);
        App.closeModal();
        _setDot('off');
        Utils.showToast('Cloud-Sync deaktiviert', 'info');
    }

    // ── Public API ─────────────────────────────────────────────────────────────
    return {
        init: init,
        onLocalChange: onLocalChange,
        openPanel: openPanel,
        enableFlow: enableFlow,
        connectFlow: connectFlow,
        disableFlow: disableFlow,
        showCode: function () { showCode(false); },
        syncNow: syncNow,
        deleteRemote: deleteRemote,
        _finishEnable: _finishEnable,
        _finishConnect: _finishConnect,
        _finishDisable: _finishDisable,
        _copyCode: _copyCode,
        _downloadCode: _downloadCode,
        // Test-Oberfläche für reine Merge-/Code-Logik (siehe test-cloud-sync.js)
        _test: { mergeRecords: _mergeRecords, mergeAudit: _mergeAudit, merge: _merge, toB32: _toB32, fromB32: _fromB32 }
    };
})();
if (typeof window !== 'undefined') window.CloudSync = CloudSync;
if (typeof module !== 'undefined' && module.exports) module.exports = CloudSync;

// Auto-Init nach Load (idempotent). WhopAuth ruft init() nach Auth erneut auf.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { CloudSync.init(); }, 1500); });
} else {
    setTimeout(function () { CloudSync.init(); }, 1500);
}

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'cs-show-code':      function () { CloudSync.showCode(); },
    'cs-sync-now':       function () { CloudSync.syncNow(); },
    'cs-disable':        function () { CloudSync.disableFlow(); },
    'cs-enable':         function () { CloudSync.enableFlow(); },
    'cs-connect':        function () { CloudSync.connectFlow(); },
    'cs-finish-enable':  function () { CloudSync._finishEnable(); },
    'cs-copy-code':      function () { CloudSync._copyCode(); },
    'cs-download-code':  function () { CloudSync._downloadCode(); },
    'cs-finish-connect': function () { CloudSync._finishConnect(); },
    'cs-finish-disable': function () { CloudSync._finishDisable(); }
});
