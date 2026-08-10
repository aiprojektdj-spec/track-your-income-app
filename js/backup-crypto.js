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
//     kdf:{ algo:"PBKDF2", hash:"SHA-256", iterations:600000, salt:<b64> },
//          ^ iterations/hash werden beim Entschlüsseln AUS DER DATEI gelesen, nicht aus dem Code —
//            deshalb bleiben Backups aus Zeiten anderer Rundenzahl (z.B. 210k) lesbar.
//     cipher:{ algo:"AES-GCM", iv:<b64>, ciphertext:<b64> } }
//   ciphertext = AES-GCM über JSON des Klartext-Bundles:
//     { "__account": { "oyi_companies": [...] },
//       "co_<id>":   { "co_<id>__reselling_purchases": [...], ... } }
//
// Wechsel-Datei (unverschlüsselt, Local 1.7 → Web 1.7, Trigger in Local-UI):
//   { format:"stackr-migration", version:1, app:"stackr", createdAt:<ISO>, bundle:<Klartext-Bundle> }
//   doImport() erkennt format automatisch, Passphrase-Feld wird ignoriert.
// ============================================================================
var BackupCrypto = (function () {
    'use strict';

    // Runden für NEUE Backups. 600.000 ist die OWASP-Vorgabe für PBKDF2-HMAC-SHA-256 (die oft
    // zitierten 210.000 gelten für SHA-512). Erhöht 2026-08-10 von 210k — gefahrlos möglich, weil
    // _decryptFile seit demselben Tag kdf.iterations aus der Datei liest statt diese Konstante.
    var ITER = 600000;
    var ITER_LEGACY = 210000;          // Fallback für Alt-Dateien ohne kdf.iterations — NIE ändern
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
    // iterations/hash MÜSSEN beim Entschlüsseln aus dem KDF-Header der Datei kommen, nicht
    // aus der Modul-Konstante (Fix 2026-08-10): sonst werden beim nächsten Hochsetzen von ITER
    // alle vorher erzeugten Backups unentschlüsselbar — und der Nutzer sieht nur "Falsche
    // Passphrase", sucht den Fehler also bei sich statt bei einer Codeänderung.
    // Fallback ITER_LEGACY: Dateien aus der Zeit vor diesem Fix, deren Header fehlt/unplausibel ist.
    async function _deriveKey(pass, salt, iterations, hash) {
        var it = (typeof iterations === 'number' && iterations >= 1000 && iterations <= 10000000)
                 ? Math.floor(iterations) : ITER_LEGACY;
        // Nur Hashes, die Stackr je geschrieben hat. Kein Angriffspfad (KDF-Parameter müssen zum
        // Verschlüsselungszeitpunkt passen, ein manipulierter Header liefert nur einen falschen
        // Schlüssel) — aber es gibt keinen Grund, SHA-1 aus einer Fremddatei zu akzeptieren.
        var h  = (hash === 'SHA-256' || hash === 'SHA-512') ? hash : 'SHA-256';
        var km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: it, hash: h },
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
        return r.indexOf('reselling_') === 0 || r.indexOf('rechnungsbuch_') === 0 || r === 'audit_log' || r.indexOf('eigenbelege_') === 0;
    }
    // gibt ein Promise zurück (IDB-Schreibvorgang) — Aufrufer kann auf Flush warten. Fehler werden
    // NICHT mehr verschluckt (Fix 2026-07-30): ein fehlgeschlagener IDB-Write muss dem Aufrufer
    // (_restore) sichtbar bleiben, sonst kann "✅ Daten importiert" gemeldet werden, obwohl der
    // Schreibvorgang (z.B. QuotaExceededError) tatsächlich fehlschlug.
    function _write(fullKey, value) {
        var str = JSON.stringify(value);
        if (_isCacheKey(fullKey)) {
            Store._cache[fullKey] = str;
            if (typeof Store._idbPutAsync === 'function') return Store._idbPutAsync(fullKey, str);
            if (typeof Store._idbPut === 'function') { Store._idbPut(fullKey, str); return Promise.resolve(); }
            return Promise.resolve();
        }
        try { localStorage.setItem(fullKey, str); return Promise.resolve(); }
        catch (e) { return Promise.reject(e); }
    }

    // ── Welche Keys gehören zu einem Scope ────────────────────────────────────
    function _companyRegistry(onlyLand) {
        try {
            var list = JSON.parse(localStorage.getItem('oyi_companies') || '[]');
            if (!Array.isArray(list)) return [];
            if (onlyLand) list = list.filter(function (c) { return c && (c.land || 'DE') === onlyLand; });
            return list.filter(function (c) { return c && c.id; });
        } catch (e) { return []; }
    }
    function _companyIds(onlyLand) {
        return _companyRegistry(onlyLand).map(function (c) { return c.id; });
    }
    // Einzige Definition von "dieser Schlüssel gehört zum Backup" — von _scopeKeys (Export) UND
    // _restore (Import) benutzt. Vorher prüfte nur der Export; _restore schrieb jeden Key aus der
    // Datei ungefiltert per localStorage.setItem() (Fix 2026-08-10). Eine präparierte Backup-Datei
    // konnte damit beliebige localStorage-Schlüssel dieses Origins setzen — u.a. whop_access_token,
    // whop_grace_token, oyi_device_owner_uid, oyi_active_company. Der Merge-Schutz (_mergeKey:
    // lokaler Wert gewinnt) griff dort nicht, weil _read() bei nicht-JSON-Werten undefined liefert.
    function _isAllowedKey(scope, fullKey) {
        if (typeof scope !== 'string' || typeof fullKey !== 'string') return false;
        if (scope === '__account') return fullKey === 'oyi_companies';
        if (!/^co_[a-z0-9_]+$/.test(scope)) return false;          // Scope muss eine Firmen-ID sein
        var pfx = scope + '__';
        if (fullKey.indexOf(pfx) !== 0) return false;              // kein Fremd-Scope-Schmuggel
        var rest = fullKey.slice(pfx.length);
        if (rest.indexOf('reselling_') === 0 || rest.indexOf('rechnungsbuch_') === 0) return true;
        if (rest === 'audit_log') return true;
        return (Store._EIGENBELEG_KEYS || []).indexOf(rest) !== -1;
    }

    function _scopeKeys(scope) {
        if (scope === '__account') return ['oyi_companies'];
        var keys = [], seen = {};
        function add(k) { if (!seen[k]) { seen[k] = 1; keys.push(k); } }
        var src = (Store._cache) ? Object.keys(Store._cache) : [];
        for (var i = 0; i < localStorage.length; i++) { var lk = localStorage.key(i); if (lk) src.push(lk); }
        src.forEach(function (k) { if (_isAllowedKey(scope, k)) add(k); });
        (Store._EIGENBELEG_KEYS || []).forEach(function (s) { var fk = scope + '__' + s; if (_read(fk) !== undefined) add(fk); });
        return keys;
    }

    // ── Klartext-Bundle bauen (Export) ────────────────────────────────────────
    // onlyLand:   z.B. 'DE' — Wechsel-Export enthält nur Firmen dieses Sitzlands
    //             (Web 1.7 hat kein CH/AT-UI mehr, siehe ch-at-removal-web); normales
    //             Komplett-Backup ruft ohne Filter auf und sichert weiterhin alles.
    // companyIds: optionale Whitelist von Firmen-IDs (Firmen-Auswahl im Wechsel-
    //             Dialog). Wirkt ZUSÄTZLICH zum Land-Filter, ersetzt ihn nie —
    //             CH/AT-Firmen bleiben also auch dann draußen, wenn sie angehakt wären.
    function _buildBundle(onlyLand, companyIds) {
        var only = null;
        if (Array.isArray(companyIds)) {
            only = {};
            companyIds.forEach(function (id) { if (id) only[id] = 1; });
        }
        function keep(c) { return c && (!onlyLand || (c.land || 'DE') === onlyLand) && (!only || only[c.id]); }
        var bundle = {};
        _scopeKeys('__account').forEach(function (k) {
            var v = _read(k);
            if (v !== undefined) {
                if (k === 'oyi_companies' && (onlyLand || only) && Array.isArray(v)) v = v.filter(keep);
                (bundle.__account = bundle.__account || {})[k] = v;
            }
        });
        _companyRegistry(onlyLand).filter(keep).forEach(function (c) {
            var id = c.id, sc = {};
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
    // AAD bindet das Chiffrat an Format+Version — verhindert, dass eine umbenannte/
    // manipulierte Datei anderen Ursprungs stillschweigend als gültiges Backup akzeptiert
    // wird. Alte, vor diesem Fix erzeugte Dateien haben keine AAD — s. Fallback in _decryptFile.
    var BACKUP_AAD = new TextEncoder().encode('stackr-backup|v1');

    async function _export(pass) {
        var salt = crypto.getRandomValues(new Uint8Array(16));
        var iv   = crypto.getRandomValues(new Uint8Array(12));
        var key  = await _deriveKey(pass, salt, ITER, 'SHA-256');
        var pt   = new TextEncoder().encode(JSON.stringify(_buildBundle()));
        var ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: BACKUP_AAD }, key, pt);
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
        var key = await _deriveKey(pass, _unb64(k.salt), k.iterations, k.hash);
        var ctBytes = _unb64(c.ciphertext), ivBytes = _unb64(c.iv);
        var pt;
        try { pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes, additionalData: BACKUP_AAD }, key, ctBytes); }
        catch (e) {
            try { pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ctBytes); } // Alt-Backups ohne AAD
            catch (e2) { throw new Error('Falsche Passphrase oder beschädigte Datei.'); }
        }
        return JSON.parse(new TextDecoder().decode(pt));
    }

    // ── Restore: Bundle mergen + persistieren ─────────────────────────────────
    // Wirft bei mindestens einem fehlgeschlagenen Schreibvorgang (statt stillschweigend
    // Teilerfolg als vollen Erfolg zu meldeng) — der Aufrufer (doImport) zeigt die betroffenen
    // Keys dann explizit an, statt pauschal "✅ Daten importiert".
    async function _restore(bundle) {
        var keys = [], writes = [], skipped = [];
        Object.keys(bundle).forEach(function (scope) {
            var remoteKeys = bundle[scope] || {};
            Object.keys(remoteKeys).forEach(function (fullKey) {
                if (!_isAllowedKey(scope, fullKey)) { skipped.push(scope + '/' + fullKey); return; }
                var merged = _mergeKey(fullKey, _read(fullKey), remoteKeys[fullKey]);
                keys.push(fullKey);
                writes.push(_write(fullKey, merged));
            });
        });
        if (skipped.length) {
            console.warn('[Backup] ' + skipped.length + ' Schlüssel nicht importiert (nicht Teil des Backup-Umfangs): ' +
                         skipped.slice(0, 10).join(', ') + (skipped.length > 10 ? ', …' : ''));
        }
        var results = await Promise.allSettled(writes);
        var failed = results.map(function (r, i) { return r.status === 'rejected' ? keys[i] : null; }).filter(Boolean);
        if (failed.length) {
            throw new Error('Import unvollständig — ' + failed.length + ' von ' + keys.length +
                ' Datensatz-Gruppen konnten nicht gespeichert werden (evtl. Speicherplatz voll). Betroffen: ' +
                failed.slice(0, 5).join(', ') + (failed.length > 5 ? ', …' : ''));
        }
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
              '<button class="btn btn-primary" data-action="bc-export" style="width:100%;"><i class="ti ti-package-export"></i> Verschlüsseltes Backup exportieren</button>' +
            '</div>' +

            // Import
            '<div style="border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;">' +
              '<div class="section-title" style="margin:0;"><i class="ti ti-package-import"></i> Backup importieren</div>' +
              '<input type="file" id="bkpImpFile" accept=".stackrbak,.json,application/json" class="form-input">' +
              '<input type="password" id="bkpImpPass" class="form-input" placeholder="Passphrase (leer lassen bei Wechsel-Datei von Local 1.7)" autocomplete="off">' +
              '<div style="font-size:12px;color:var(--text-muted);">Daten werden mit den vorhandenen <strong>zusammengeführt</strong> (neuere Einträge gewinnen). Anschließend lädt die Seite neu.</div>' +
              '<button class="btn" data-action="bc-import" style="width:100%;"><i class="ti ti-upload"></i> Backup importieren</button>' +
            '</div>' +
          '</div>';
        App.showModal('Komplett-Backup (alle Firmen, verschlüsselt)', body, '');
    }

    // ── Wechsel-Import (Web 1.7): eigener, sichtbarer Einstiegspunkt ──────────
    // Gleiche Merge-Logik wie der Komplett-Backup-Dialog — nutzt denselben
    // doImport() (Formaterkennung inklusive), nur ohne Passphrase-Feld, weil
    // stackr-migration-Dateien unverschlüsselt sind.
    function openMigrationImportModal() {
        var body =
          '<div style="display:flex;flex-direction:column;gap:16px;">' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">' +
              'Lade hier die <strong>Wechsel-Datei</strong> hoch, die du in Local 1.7 unter ' +
              '„Zu Web wechseln" exportiert hast (<code>stackr-wechsel-….json</code>).' +
            '</div>' +
            '<div style="border:1px solid var(--border);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;">' +
              '<input type="file" id="bkpImpFile" accept=".json,application/json" class="form-input">' +
              '<div style="font-size:12px;color:var(--text-muted);">' +
                'Die Daten werden mit deinen vorhandenen <strong>zusammengeführt</strong> (neuere Einträge gewinnen), ' +
                'nichts wird überschrieben oder gelöscht. Anschließend lädt die Seite neu.' +
              '</div>' +
              '<button class="btn btn-primary" data-action="bc-import" style="width:100%;"><i class="ti ti-upload"></i> Daten importieren</button>' +
            '</div>' +
            '<div style="font-size:12px;color:var(--text-muted);">' +
              'Verschlüsselte <code>.stackrbak</code>-Backups gehören nicht hierher — die importierst du über ' +
              '„Komplett-Backup öffnen" mit Passphrase.' +
            '</div>' +
          '</div>';
        App.showModal('Daten aus Local 1.7 importieren', body, '');
    }

    // ── Wechsel-Export: Firmen-Auswahl (Local 1.7 → Web 1.7) ──────────────────
    // Vorschaltdialog zu doExportPlain(): Checkbox-Liste aller DE-Firmen, alle
    // vorausgewählt. Nutzer kann Test-/Dummy-Firmen abwählen. Eine Filterung
    // INNERHALB einer Firma (nach Datum o.ä.) gibt es bewusst nicht.
    function openExportPlainModal() {
        var cos = _companyRegistry('DE');
        if (!cos.length) { _toast('Keine Firma mit Sitzland Deutschland gefunden — nichts zu exportieren.', 'warning', 6000); return; }
        var rows = cos.map(function (c) {
            return '<label style="display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid var(--border);border-radius:8px;cursor:pointer;">' +
                     '<input type="checkbox" class="bc-co-check" value="' + _esc(c.id) + '" checked>' +
                     '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + _esc(c.farbe || '#10b981') + ';flex:0 0 auto;"></span>' +
                     '<span style="font-size:13px;">' + _esc(c.name || c.id) + '</span>' +
                   '</label>';
        }).join('');
        var body =
          '<div style="display:flex;flex-direction:column;gap:14px;">' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">' +
              'Wähle die Firmen, die nach Web 1.7 mitgenommen werden sollen. Nicht angehakte Firmen ' +
              '(z.B. Test-Firmen) landen <strong>nicht</strong> in der Datei. Firmen mit Sitzland CH/AT ' +
              'werden generell nicht exportiert — Web 1.7 hat dafür kein UI mehr.' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:8px;">' + rows + '</div>' +
            '<div style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);border-radius:8px;padding:11px;font-size:12px;">' +
              '⚠️ <strong>Die Datei ist unverschlüsselt</strong> — sie enthält alle Finanzdaten im Klartext. ' +
              'Sicher aufbewahren und nach erfolgreichem Import löschen.' +
            '</div>' +
            '<div id="bcExpPlainCount" style="font-size:12px;color:var(--text-muted);"></div>' +
            '<button class="btn btn-primary" id="bcExpPlainBtn" data-action="bc-export-plain-run" style="width:100%;">' +
              '<i class="ti ti-package-export"></i> Wechsel-Datei exportieren</button>' +
          '</div>';
        App.showModal('Zu Web wechseln — Firmen auswählen', body, '');
        function sync() {
            var n = _selectedCompanyIds().length;
            var btn = document.getElementById('bcExpPlainBtn'), lbl = document.getElementById('bcExpPlainCount');
            if (btn) btn.disabled = (n === 0);
            if (lbl) lbl.textContent = n ? (n + ' von ' + cos.length + ' Firmen ausgewählt') : 'Keine Firma ausgewählt — bitte mindestens eine anhaken.';
        }
        Array.prototype.forEach.call(document.querySelectorAll('.bc-co-check'), function (cb) { cb.addEventListener('change', sync); });
        sync();
    }
    // null = kein Auswahl-Dialog offen (→ Aufrufer nimmt alle DE-Firmen)
    function _selectedCompanyIds() {
        var boxes = document.querySelectorAll('.bc-co-check');
        if (!boxes.length) return null;
        return Array.prototype.filter.call(boxes, function (cb) { return cb.checked; }).map(function (cb) { return cb.value; });
    }

    // ── Export (unverschlüsselt, Wechsel-Datei Local→Web) ─────────────────────
    // Nur Firmen mit Sitzland DE: Web 1.7 hat kein CH/AT-UI mehr, CH/AT-Firmen
    // würden sonst unsichtbar im Bundle landen (siehe ch-at-removal-web-Memo).
    function doExportPlain() {
        try {
            var sel = _selectedCompanyIds();
            if (sel && !sel.length) { _toast('Keine Firma ausgewählt — bitte mindestens eine anhaken.', 'warning', 5000); return; }
            var bundle = _buildBundle('DE', sel || undefined);
            var deCount = ((bundle.__account || {}).oyi_companies || []).length;
            if (!deCount) { _toast('Keine Firma mit Sitzland Deutschland gefunden — nichts zu exportieren.', 'warning', 6000); return; }
            var file = { format: 'stackr-migration', version: 1, app: 'stackr', createdAt: new Date().toISOString(), bundle: bundle };
            var name = 'stackr-wechsel-' + new Date().toLocaleDateString('sv-SE') + '.json';
            var a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
            a.download = name;
            document.body.appendChild(a); a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
            if (sel && typeof App !== 'undefined' && App.closeModal) App.closeModal();
            _toast('✅ Wechsel-Datei gespeichert (' + deCount + ' Firma' + (deCount === 1 ? '' : 'en') + '): ' + name, 'success', 5000);
        } catch (e) {
            console.error('[Backup] exportPlain', e);
            _toast('Export fehlgeschlagen: ' + (e && e.message || e), 'error');
        }
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
        if (!confirm('Daten importieren?\n\nDie enthaltenen Daten werden mit deinen vorhandenen zusammengeführt (neuere Einträge gewinnen). Anschließend lädt die Seite neu.')) return;

        var reader = new FileReader();
        reader.onload = async function () {
            var parsed;
            try { parsed = JSON.parse(reader.result); }
            catch (e) { _toast('Datei ist kein gültiges JSON.', 'error'); return; }
            try {
                var bundle;
                if (parsed && parsed.format === 'stackr-migration') {
                    bundle = parsed.bundle || {};
                } else {
                    if (!pass) {
                        // Im Wechsel-Import-Dialog gibt es kein Passphrase-Feld — dann klar auf den richtigen Dialog verweisen.
                        _toast(document.getElementById('bkpImpPass')
                            ? 'Bitte Passphrase eingeben.'
                            : 'Das ist ein verschlüsseltes Komplett-Backup — bitte über „Komplett-Backup öffnen" mit Passphrase importieren.',
                            'warning', 7000);
                        return;
                    }
                    bundle = await _decryptFile(parsed, pass);
                }
                await _restore(bundle);
                var maxCo = (typeof CompanyManager !== 'undefined' && CompanyManager.MAX_COMPANIES)
                         || (typeof Companies !== 'undefined' && Companies.MAX_COMPANIES) || 5;
                if (_companyIds().length > maxCo) {
                    _toast('⚠️ Mehr als ' + maxCo + ' Firmen vorhanden — „Neue Firma anlegen" bleibt gesperrt, bis eine gelöscht wird. Bestehende Firmen funktionieren normal.', 'warning', 8000);
                }
                _toast('✅ Daten importiert — lade neu…', 'success', 1800);
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
        // Wechsel-Datei: doImport()-Formaterkennung nachgebildet (unverschlüsselt, kein Passphrase-Zwang)
        var mig = JSON.parse(JSON.stringify({ format: 'stackr-migration', version: 1, app: 'stackr', bundle: b }));
        var ok4 = mig.format === 'stackr-migration' && JSON.stringify(mig.bundle) === JSON.stringify(b);
        console.log('[Backup] selftest', { roundtrip: ok1, lww: ok2, rechain: ok3, wrongPass: bad, migrationFormat: ok4 });
        return ok1 && ok2 && ok3 && bad && ok4;
    }

    return {
        openModal: openModal,
        openExportPlainModal: openExportPlainModal,
        openMigrationImportModal: openMigrationImportModal,
        doExport: doExport,
        doExportPlain: doExportPlain,
        doImport: doImport,
        _selftest: _selftest,
        _test: {
            buildBundle: _buildBundle, mergeRecords: _mergeRecords, mergeAudit: _mergeAudit, mergeKey: _mergeKey,
            isAllowedKey: _isAllowedKey, restore: _restore, exportFile: _export, decryptFile: _decryptFile,
            ITER: ITER, ITER_LEGACY: ITER_LEGACY
        }
    };
})();
if (typeof window !== 'undefined') window.BackupCrypto = BackupCrypto;
if (typeof module !== 'undefined' && module.exports) module.exports = BackupCrypto;

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (typeof window !== 'undefined' && window.Actions) Actions.register({
    'bc-open-modal':      function () { BackupCrypto.openModal(); },
    'bc-export':          function () { BackupCrypto.doExport(); },
    'bc-export-plain':    function () { BackupCrypto.openExportPlainModal(); },   // Firmen-Auswahl vorschalten
    'bc-export-plain-run':function () { BackupCrypto.doExportPlain(); },          // aus dem Auswahl-Dialog heraus
    'bc-migration-import':function () { BackupCrypto.openMigrationImportModal(); },
    'bc-import':          function () { BackupCrypto.doImport(); }
});
