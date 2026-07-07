// ============================================================================
// BackupCrypto — Passphrase-verschlüsseltes Komplett-Backup / Restore (kein Backend)
// ============================================================================
// Local-first: OHNE Nutzung tut dieses Modul nichts. Exportiert ALLE Firmen in
// EINE verschlüsselte Datei; Import entschlüsselt + MERGT (LWW nach updatedAt,
// GoBD-Audit-Log deterministisch re-chained). Der AES-Schlüssel wird per PBKDF2
// aus der Nutzer-Passphrase abgeleitet → dieselbe Passphrase entschlüsselt auf
// JEDEM Gerät. Kein Whop, kein api/sync.js, kein Netzwerk → läuft in Web 1.7
// UND Local 1.7 identisch. Self-contained: braucht cloud-sync.js NICHT.
//
// Merge-Logik adaptiert aus js/cloud-sync.js (Records: LWW; Audit: Union +
// Re-Chain). Read/Write sind cache-first und nutzen nur Store-Primitive, die in
// beiden Varianten existieren (_cache, _idbPut/_idbPutAsync, _calcChecksum).
//
// Dateiformat (.stackrbak):
//   { format:"stackr-backup", version:1, app:"stackr", createdAt:<ISO>,
//     kdf:{ algo:"PBKDF2", hash:"SHA-256", iterations:210000, salt:<b64> },
//     cipher:{ algo:"AES-GCM", iv:<b64>, ciphertext:<b64> } }
//   ciphertext = AES-GCM über JSON des Klartext-Bundles:
//     { "__account": { "oyi_companies": [...] },
//       "co_<id>":   { "co_<id>__reselling_purchases": [...], ... } }
// ============================================================================
var BackupCrypto = (function () {
    'use strict';

    var ITER = 210000;                 // ≥ 210k (Vorgabe)
    var WARN = 'Passphrase verloren = Backup unwiederbringlich. Es gibt keine Wiederherstellung (Ende-zu-Ende).';

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

    // ── PBKDF2(Passphrase) → AES-GCM-Key ──────────────────────────────────────
    async function _deriveKey(pass, salt) {
        var km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: ITER, hash: 'SHA-256' },
            km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }

    // ── Store-Read/Write (cache-first; self-contained) ────────────────────────
    function _read(fullKey) {
        var raw = (Store._cache && Store._cache[fullKey] != null) ? Store._cache[fullKey] : null;
        if (raw == null) { try { raw = localStorage.getItem(fullKey); } catch (e) {} }
        if (raw == null) return undefined;
        try { return JSON.parse(raw); } catch (e) { return undefined; }
    }
    function _isCacheKey(k) {
        var r = k.replace(/^co_[a-z0-9_]+__/, '');
        return r.indexOf('reselling_') === 0 || r.indexOf('rechnungsbuch_') === 0 || r === 'audit_log';
    }
    // gibt ein Promise zurück (IDB-Schreibvorgang) — Aufrufer kann auf Flush warten
    function _write(fullKey, value) {
        var str = JSON.stringify(value);
        if (_isCacheKey(fullKey)) {
            Store._cache[fullKey] = str;
            if (typeof Store._idbPutAsync === 'function') return Store._idbPutAsync(fullKey, str).catch(function () {});
            if (typeof Store._idbPut === 'function') Store._idbPut(fullKey, str);
            return Promise.resolve();
        }
        try { localStorage.setItem(fullKey, str); } catch (e) {}
        return Promise.resolve();
    }

    // ── Welche Keys gehören zu einem Scope ────────────────────────────────────
    function _companyIds() {
        try { return JSON.parse(localStorage.getItem('oyi_companies') || '[]').map(function (c) { return c.id; }).filter(Boolean); }
        catch (e) { return []; }
    }
    function _scopeKeys(scope) {
        if (scope === '__account') return ['oyi_companies'];
        var keys = [], seen = {};
        var pfxR = scope + '__reselling_', pfxB = scope + '__rechnungsbuch_', aKey = scope + '__audit_log';
        function add(k) { if (!seen[k]) { seen[k] = 1; keys.push(k); } }
        var src = (Store._cache) ? Object.keys(Store._cache) : [];
        for (var i = 0; i < localStorage.length; i++) { var lk = localStorage.key(i); if (lk) src.push(lk); }
        src.forEach(function (k) { if (k.indexOf(pfxR) === 0 || k.indexOf(pfxB) === 0 || k === aKey) add(k); });
        (Store._EIGENBELEG_KEYS || []).forEach(function (s) { var fk = scope + '__' + s; if (_read(fk) !== undefined) add(fk); });
        return keys;
    }

    // ── Klartext-Bundle bauen (Export) ────────────────────────────────────────
    function _buildBundle() {
        var bundle = {};
        _scopeKeys('__account').forEach(function (k) {
            var v = _read(k); if (v !== undefined) (bundle.__account = bundle.__account || {})[k] = v;
        });
        _companyIds().forEach(function (id) {
            var sc = {};
            _scopeKeys(id).forEach(function (k) { var v = _read(k); if (v !== undefined) sc[k] = v; });
            if (Object.keys(sc).length) bundle[id] = sc;
        });
        return bundle;
    }

    // ── Merge-Bausteine (aus cloud-sync.js adaptiert) ─────────────────────────
    function _isRecArr(a, b) {
        var probe = (Array.isArray(a) && a.length) ? a : ((Array.isArray(b) && b.length) ? b : null);
        if (!probe) return Array.isArray(a) || Array.isArray(b);
        return probe.every(function (x) { return x && typeof x === 'object' && ('id' in x); });
    }
    function _mergeRecords(localArr, remoteArr) {
        var byId = {};
        (localArr || []).forEach(function (r) { if (r && r.id != null) byId[r.id] = r; });
        (remoteArr || []).forEach(function (r) {
            if (!r || r.id == null) return;
            var ex = byId[r.id];
            if (!ex) byId[r.id] = r;
            else if ((r.updatedAt || 0) > (ex.updatedAt || 0)) byId[r.id] = r;   // LWW
        });
        return Object.keys(byId).map(function (id) { return byId[id]; });
    }
    // Audit: append-only Union + deterministisches Re-Chaining (GoBD).
    // Feld-erhaltend → bleibt verify-kompatibel in beiden Varianten (Local ohne _dev, Web mit _dev).
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
        return list;
    }
    function _mergeKey(fullKey, lv, rv) {
        if (/__audit_log$/.test(fullKey)) return _mergeAudit(lv, rv);
        if (_isRecArr(lv, rv)) return _mergeRecords(lv, rv);
        return (lv !== undefined) ? lv : rv;   // Whole-Value: lokal gewinnt, sonst Backup
    }

    // ── Export ────────────────────────────────────────────────────────────────
    async function _export(pass) {
        var salt = crypto.getRandomValues(new Uint8Array(16));
        var iv   = crypto.getRandomValues(new Uint8Array(12));
        var key  = await _deriveKey(pass, salt);
        var pt   = new TextEncoder().encode(JSON.stringify(_buildBundle()));
        var ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, pt);
        return {
            format: 'stackr-backup', version: 1, app: 'stackr', createdAt: new Date().toISOString(),
            kdf:    { algo: 'PBKDF2', hash: 'SHA-256', iterations: ITER, salt: _b64(salt) },
            cipher: { algo: 'AES-GCM', iv: _b64(iv), ciphertext: _b64(new Uint8Array(ct)) }
        };
    }

    // ── Restore: Datei → Klartext-Bundle (wirft bei falscher Passphrase) ──────
    async function _decryptFile(file, pass) {
        if (!file || file.format !== 'stackr-backup') throw new Error('Keine gültige Stackr-Backup-Datei.');
        var k = file.kdf || {}, c = file.cipher || {};
        var key = await _deriveKey(pass, _unb64(k.salt));
        var pt;
        try { pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: _unb64(c.iv) }, key, _unb64(c.ciphertext)); }
        catch (e) { throw new Error('Falsche Passphrase oder beschädigte Datei.'); }
        return JSON.parse(new TextDecoder().decode(pt));
    }

    // ── Restore: Bundle mergen + persistieren ─────────────────────────────────
    async function _restore(bundle) {
        var writes = [];
        Object.keys(bundle).forEach(function (scope) {
            var remoteKeys = bundle[scope] || {};
            Object.keys(remoteKeys).forEach(function (fullKey) {
                var merged = _mergeKey(fullKey, _read(fullKey), remoteKeys[fullKey]);
                writes.push(_write(fullKey, merged));
            });
        });
        await Promise.all(writes);
        // Frisches Gerät ohne aktive Firma → erste vorhandene Firma aktivieren
        try {
            var ids = _companyIds();
            if (ids.length && !localStorage.getItem('oyi_active_company')) localStorage.setItem('oyi_active_company', ids[0]);
        } catch (e) {}
    }

    // ========================================================================
    // UI
    // ========================================================================
    function _esc(s) { return (typeof Utils !== 'undefined' && Utils.escapeHtml) ? Utils.escapeHtml(String(s)) : String(s); }
    function _toast(m, t, d) { if (typeof Utils !== 'undefined' && Utils.showToast) Utils.showToast(m, t || 'info', d); else console.log('[Backup]', m); }

    function openModal() {
        var body =
          '<div style="display:flex;flex-direction:column;gap:18px;">' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">' +
              'Sichert <strong>alle Firmen</strong> verschlüsselt in <strong>eine Datei</strong>. ' +
              'Lege sie selbst ab (eigene Cloud, USB) und stelle sie auf einem anderen Gerät mit derselben Passphrase wieder her. ' +
              'Kein Server, keine Anmeldung.' +
            '</div>' +
            '<div style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);border-radius:8px;padding:11px;font-size:12px;">' +
              '⚠️ <strong>' + _esc(WARN) + '</strong>' +
            '</div>' +

            // Export
            '<div style="border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;">' +
              '<div class="section-title" style="margin:0;"><i class="ti ti-lock"></i> Verschlüsseltes Backup exportieren</div>' +
              '<input type="password" id="bkpExpPass"  class="form-input" placeholder="Passphrase (mind. 8 Zeichen)" autocomplete="new-password">' +
              '<input type="password" id="bkpExpPass2" class="form-input" placeholder="Passphrase wiederholen"        autocomplete="new-password">' +
              '<button class="btn btn-primary" onclick="BackupCrypto.doExport()" style="width:100%;"><i class="ti ti-package-export"></i> Verschlüsseltes Backup exportieren</button>' +
            '</div>' +

            // Import
            '<div style="border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;">' +
              '<div class="section-title" style="margin:0;"><i class="ti ti-package-import"></i> Backup importieren</div>' +
              '<input type="file" id="bkpImpFile" accept=".stackrbak,application/json" class="form-input">' +
              '<input type="password" id="bkpImpPass" class="form-input" placeholder="Passphrase" autocomplete="off">' +
              '<div style="font-size:12px;color:var(--text-muted);">Daten werden mit den vorhandenen <strong>zusammengeführt</strong> (neuere Einträge gewinnen). Anschließend lädt die Seite neu.</div>' +
              '<button class="btn" onclick="BackupCrypto.doImport()" style="width:100%;"><i class="ti ti-upload"></i> Backup importieren</button>' +
            '</div>' +
          '</div>';
        App.showModal('Komplett-Backup (alle Firmen, verschlüsselt)', body, '');
    }

    async function doExport() {
        var p1 = (document.getElementById('bkpExpPass') || {}).value || '';
        var p2 = (document.getElementById('bkpExpPass2') || {}).value || '';
        if (p1.length < 8) { _toast('Passphrase zu kurz (mind. 8 Zeichen).', 'warning'); return; }
        if (p1 !== p2)     { _toast('Passphrasen stimmen nicht überein.', 'error'); return; }
        try {
            var file = await _export(p1);
            var name = 'stackr-backup-' + new Date().toLocaleDateString('sv-SE') + '.stackrbak';
            var a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
            a.download = name;
            document.body.appendChild(a); a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
            try { localStorage.setItem('last_backup_date', new Date().toISOString()); } catch (e) {}
            _toast('✅ Verschlüsseltes Backup gespeichert: ' + name, 'success', 5000);
        } catch (e) {
            console.error('[Backup] export', e);
            _toast('Export fehlgeschlagen: ' + (e && e.message || e), 'error');
        }
    }

    function doImport() {
        var fileEl = document.getElementById('bkpImpFile');
        var pass   = (document.getElementById('bkpImpPass') || {}).value || '';
        if (!fileEl || !fileEl.files || !fileEl.files[0]) { _toast('Bitte zuerst eine Backup-Datei wählen.', 'warning'); return; }
        if (!pass) { _toast('Bitte Passphrase eingeben.', 'warning'); return; }
        if (!confirm('Backup importieren?\n\nDie enthaltenen Daten werden mit deinen vorhandenen zusammengeführt (neuere Einträge gewinnen). Anschließend lädt die Seite neu.')) return;

        var reader = new FileReader();
        reader.onload = async function () {
            var parsed;
            try { parsed = JSON.parse(reader.result); }
            catch (e) { _toast('Datei ist kein gültiges JSON.', 'error'); return; }
            try {
                var bundle = await _decryptFile(parsed, pass);
                await _restore(bundle);
                _toast('✅ Backup importiert — lade neu…', 'success', 1800);
                setTimeout(function () { location.reload(); }, 1300);
            } catch (e) {
                console.warn('[Backup] import', e && e.message);
                _toast(e && e.message || 'Import fehlgeschlagen.', 'error', 6000);
            }
        };
        reader.onerror = function () { _toast('Datei konnte nicht gelesen werden.', 'error'); };
        reader.readAsText(fileEl.files[0]);
    }

    // In-Memory-Selbsttest (Konsole): encrypt→decrypt Round-Trip + Merge/Re-Chain.
    async function _selftest() {
        var b = { __account: { oyi_companies: [{ id: 'co_x', name: 'A' }] },
                  co_x: { 'co_x__reselling_purchases': [{ id: 1, updatedAt: 5 }] } };
        var bb = _buildBundle; _buildBundle = function () { return b; };          // stub
        var f = await _export('pw-test-123'); _buildBundle = bb;
        var out = await _decryptFile(f, 'pw-test-123');
        var ok1 = JSON.stringify(out) === JSON.stringify(b);
        var rec = _mergeRecords([{ id: 1, updatedAt: 1 }], [{ id: 1, updatedAt: 9 }, { id: 2, updatedAt: 3 }]);
        var ok2 = rec.length === 2 && rec.find(function (r) { return r.id === 1; }).updatedAt === 9;
        var aud = _mergeAudit([{ id: 'a', timestamp: '1' }], [{ id: 'b', timestamp: '2' }]);
        var ok3 = aud[0].prevHash === 'GENESIS' && aud[1].prevHash === aud[0].checksum;
        var bad = false; try { await _decryptFile(f, 'wrong-pass'); } catch (e) { bad = true; }
        console.log('[Backup] selftest', { roundtrip: ok1, lww: ok2, rechain: ok3, wrongPass: bad });
        return ok1 && ok2 && ok3 && bad;
    }

    return {
        openModal: openModal,
        doExport: doExport,
        doImport: doImport,
        _selftest: _selftest,
        _test: { buildBundle: _buildBundle, mergeRecords: _mergeRecords, mergeAudit: _mergeAudit, mergeKey: _mergeKey }
    };
})();
if (typeof window !== 'undefined') window.BackupCrypto = BackupCrypto;
if (typeof module !== 'undefined' && module.exports) module.exports = BackupCrypto;
