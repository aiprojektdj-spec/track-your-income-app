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
    var MAX_INLINE_CIPHER = 3.5 * 1024 * 1024;   // muss zu MAX_CIPHER in api/sync.js passen
    var B32           = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    var EB_KEYS       = ['eigenbelege_belege', 'eigenbelege_kategorien',
                         'eigenbelege_einstellungen', 'eigenbelege_naechste_nummer', 'eigenbelege_produkte'];

    var LS_ENABLED = 'oyi_sync_enabled';
    // ALT-Ablage des rohen Sync-Schlüssels (Fund R5, Red-Team-Audit 2026-08-10). Wird nur noch
    // gelesen — für die einmalige Migration nach IndexedDB (s. _migrateKeyToIdb) und als Rückfall,
    // solange die Migration nicht bestätigt durchgelaufen ist. NEU wird hier nichts mehr abgelegt.
    var LS_KEY     = function (uid) { return 'oyi_sync_key_' + uid; };
    // Enthält KEIN Geheimnis, nur "auf diesem Gerät liegt ein Schlüssel für <uid>". Nötig, weil
    // IndexedDB asynchron ist, _hasKey() aber an vielen Stellen synchron gebraucht wird
    // (Status-Punkt, Panel-Rendering, Sync-Vorbedingungen).
    var LS_KEY_PRESENT = function (uid) { return 'oyi_sync_keypresent_' + uid; };
    var LS_META    = function (scope) { return 'oyi_sync_keymeta_' + scope; };
    var LS_BASE    = function (scope) { return 'oyi_sync_base_' + scope; };   // zuletzt synchronisierter updatedAt je Record (Konflikt-Basis)
    var LS_BLOBCACHE = function (scope) { return 'oyi_sync_blobcache_' + scope; };   // Inhalts-Hash → Blob-URL, verhindert Doppel-Uploads unveränderter Anhänge
    var LS_CONFLICTS = 'oyi_sync_conflicts';                                  // offene Parallel-Konflikte (beide Fassungen), überlebt Reload
    var LS_LAST_OK   = 'oyi_sync_last_ok';                                    // Timestamp des letzten vollständig erfolgreichen Sync-Laufs
    var HEALTHY_MAX_AGE_MS = 7 * 86400000;   // älter → lokale Backup-Hinweise NICHT unterdrücken (Sync könnte hängen)
    var LS_CODE_REMIND = 'oyi_sync_code_remind_last';                         // Timestamp der letzten Wiederherstellungscode-Erinnerung
    var CODE_REMIND_INTERVAL_MS = 90 * 86400000;   // alle 90 Tage — Code-Verlust ist das eine Risiko, das isHealthy() nicht erkennen kann
    var LS_ANCHORED = function (scope) { return 'oyi_sync_anchored_' + scope; };   // bereits an den Server gemeldete Audit-Entry-IDs (Set)
    var ANCHOR_BATCH = 500;   // muss <= Server-Limit (1000, siehe api/sync.js) sein
    var LS_ANCHOR_CHECK = 'oyi_sync_anchor_check_last';                       // Timestamp der letzten automatischen Anker-Pruefung
    var ANCHOR_CHECK_INTERVAL_MS = 24 * 3600000;   // taeglich reicht — kein manueller Klick noetig, um eine Abweichung zu bemerken
    var LS_KEY_MISMATCH = 'oyi_sync_key_mismatch';   // Sackgasse: Cloud-Daten liegen unter einem anderen Schlüssel als dem lokalen
    var LS_ERR_TOAST    = 'oyi_sync_err_toast_last'; // Drosselung der allgemeinen Fehlermeldung (nicht bei jedem Start nerven)
    var ERR_TOAST_INTERVAL_MS = 24 * 3600000;

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
    // Schlüssel-Sackgasse: die Cloud-Daten dieses Accounts sind mit einem anderen Schlüssel
    // verschlüsselt als dem auf diesem Gerät. Der Zustand MUSS überleben (Reload, Neustart)
    // und sichtbar sein — sonst läuft der Sync monatelang tot vor sich hin, ohne dass es
    // jemand merkt (genau der Fehler, den der stille catch in _syncAll früher erzeugt hat).
    function _setMismatch(on) {
        try { on ? localStorage.setItem(LS_KEY_MISMATCH, String(Date.now())) : localStorage.removeItem(LS_KEY_MISMATCH); } catch (e) {}
    }
    function _hasMismatch() { try { return !!localStorage.getItem(LS_KEY_MISMATCH); } catch (e) { return false; } }
    function _isPro()   { return typeof UserPlan === 'undefined' || UserPlan.isPro(); }
    function _activeScope() { return (typeof CompanyManager !== 'undefined') ? CompanyManager.getActiveId() : ''; }

    // ── Schlüssel-Ablage (Fund R5) ───────────────────────────────────────────
    // Vorher lag der rohe 256-bit-AES-Schlüssel als Base64 in localStorage, direkt neben dem
    // Whop-Token. Ein einziger XSS-Treffer hätte damit nicht nur die Sitzung geliefert, sondern
    // erlaubt, das Chiffrat serverseitig zu ziehen UND offline zu entschlüsseln — die
    // E2E-Zusage fällt komplett. (Es wurde kein XSS gefunden; der Punkt ist der Schadensradius.)
    //
    // Jetzt in IndexedDB, und zwar zweigeteilt:
    //   'ck'  — der importierte CryptoKey mit extractable:false. Er trägt den GANZEN täglichen
    //           Sync (encrypt/decrypt). Ein XSS kann damit ver- und entschlüsseln, den Schlüssel
    //           selbst aber nicht auslesen und nicht wegtragen.
    //   'raw' — die Rohbytes. Unvermeidbar, weil zwei Funktionen sie brauchen: die Anzeige des
    //           Wiederherstellungscodes (der Code IST der Schlüssel, s. showCode) und das
    //           Verpacken für den Steuerberater (js/stb-share.js). Ein vollständig
    //           nicht-extrahierbarer Schlüssel würde beide Funktionen entfernen — dafür ist das
    //           "Code erneut anzeigen" der einzige Weg, ein zweites Gerät anzubinden, wenn der
    //           Nutzer den Code nicht notiert hat.
    //
    // Der ehrliche Gewinn: der Schlüssel liegt nicht mehr in localStorage, also greifen generische
    // XSS-Payloads, die schlicht localStorage abschöpfen, nicht mehr. Ein gezielter Angreifer, der
    // Stackr kennt, kommt auch an IndexedDB. Vollständige Nicht-Extrahierbarkeit ist erst möglich,
    // wenn "Code erneut anzeigen" entfällt — das ist eine Produktentscheidung, keine technische.
    var IDBK_DB = 'oyi_synckey', IDBK_STORE = 'k';
    function _idbkOpen() {
        return new Promise(function (resolve, reject) {
            var req = indexedDB.open(IDBK_DB, 1);
            req.onupgradeneeded = function (e) { e.target.result.createObjectStore(IDBK_STORE); };
            req.onsuccess = function (e) { resolve(e.target.result); };
            req.onerror   = function () { reject(req.error); };
        });
    }
    function _idbkGet(k) {
        return _idbkOpen().then(function (db) { return new Promise(function (resolve, reject) {
            var rq = db.transaction(IDBK_STORE, 'readonly').objectStore(IDBK_STORE).get(k);
            rq.onsuccess = function () { resolve(rq.result); };
            rq.onerror   = function () { reject(rq.error); };
        }); });
    }
    function _idbkPut(k, v) {
        return _idbkOpen().then(function (db) { return new Promise(function (resolve, reject) {
            var tx = db.transaction(IDBK_STORE, 'readwrite');
            tx.objectStore(IDBK_STORE).put(v, k);
            tx.oncomplete = function () { resolve(); };
            tx.onerror    = function () { reject(tx.error); };
        }); });
    }
    function _idbkDel(k) {
        return _idbkOpen().then(function (db) { return new Promise(function (resolve) {
            var tx = db.transaction(IDBK_STORE, 'readwrite');
            tx.objectStore(IDBK_STORE).delete(k);
            tx.oncomplete = function () { resolve(); };
            tx.onerror    = function () { resolve(); };   // best-effort
        }); });
    }
    function _idbkKey(uid, what) { return (uid || _userId()) + ':' + what; }

    // Rohbytes: IndexedDB zuerst, localStorage nur als Rückfall für noch nicht migrierte Geräte.
    async function _keyBytes(uid) {
        var u = uid || _userId();
        try {
            if (typeof indexedDB === 'undefined') throw new Error('no_idb');
            var v = await _idbkGet(_idbkKey(u, 'raw'));
            if (v && v.byteLength === 32) return new Uint8Array(v instanceof Uint8Array ? v : new Uint8Array(v));
        } catch (e) { /* IDB nicht verfügbar → Rückfall unten */ }
        var b64 = localStorage.getItem(LS_KEY(u));
        if (!b64) return null;
        try { return _unb64(b64); } catch (e) { return null; }
    }
    // Synchron, weil an vielen Stellen im Render-/Statuspfad gebraucht. Prüft nur die EXISTENZ.
    function _hasKey(uid) {
        var u = uid || _userId();
        try { if (localStorage.getItem(LS_KEY_PRESENT(u)) === '1') return true; } catch (e) {}
        try { return !!localStorage.getItem(LS_KEY(u)); } catch (e) { return false; }
    }
    // Schreibt Rohbytes + nicht-extrahierbaren CryptoKey nach IndexedDB und liest zur Kontrolle
    // zurück. Erst wenn der Rückvergleich stimmt, gilt der Schlüssel als sicher abgelegt — ein
    // stillschweigend fehlgeschlagener Schreibvorgang würde den Nutzer von seinen Cloud-Daten
    // trennen, und der Schlüssel ist nicht wiederherstellbar.
    async function _storeKey(uid, bytes) {
        var u = uid || _userId();
        // Kein IndexedDB (privater Modus mancher Browser, Node-Tests) → alte Ablage benutzen.
        // Ein Schlüssel, der sich nicht anlegen lässt, bedeutet "Cloud-Sync gar nicht nutzbar";
        // das ist ein schlechterer Ausgang als der bekannte, akzeptierte localStorage-Weg.
        if (typeof indexedDB === 'undefined') {
            localStorage.setItem(LS_KEY(u), _b64(bytes));
            try { localStorage.setItem(LS_KEY_PRESENT(u), '1'); } catch (e) {}
            console.warn('[CloudSync] IndexedDB nicht verfügbar — Schlüssel liegt in localStorage (s. Fund R5)');
            return true;
        }
        await _idbkPut(_idbkKey(u, 'raw'), new Uint8Array(bytes));
        await _idbkPut(_idbkKey(u, 'ck'),
                       await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']));
        var back = await _idbkGet(_idbkKey(u, 'raw'));
        var ok = back && back.byteLength === 32;
        if (ok) {
            var a = new Uint8Array(back);
            for (var i = 0; i < 32; i++) if (a[i] !== bytes[i]) { ok = false; break; }
        }
        if (!ok) throw new Error('key_store_verify_failed');
        try { localStorage.setItem(LS_KEY_PRESENT(u), '1'); } catch (e) {}
        return true;
    }
    // Einmalige Migration aus localStorage. Der Alt-Eintrag wird ERST entfernt, wenn die
    // IndexedDB-Kopie zurückgelesen und byteweise verglichen wurde (s. _storeKey). Scheitert
    // irgendetwas, bleibt alles wie vorher — lieber die alte Ablage als kein Schlüssel.
    async function _migrateKeyToIdb(uid) {
        var u = uid || _userId();
        if (!u) return;
        if (typeof indexedDB === 'undefined') return;   // nichts, wohin migriert werden könnte
        var legacy = null;
        try { legacy = localStorage.getItem(LS_KEY(u)); } catch (e) { return; }
        if (!legacy) return;
        try {
            var bytes = _unb64(legacy);
            if (bytes.length !== 32) return;
            await _storeKey(u, bytes);
            localStorage.removeItem(LS_KEY(u));
            console.info('[CloudSync] Sync-Schlüssel nach IndexedDB migriert (R5)');
        } catch (e) {
            console.warn('[CloudSync] Schlüssel-Migration übersprungen:', e && e.message);
        }
    }

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
    // AAD bindet jedes Chiffrat an (Daten-Eigentümer, Scope, Schema-Version): ein vom
    // Server (oder Redis/Blob-Zugriff) vertauschtes Chiffrat eines anderen Scopes/Owners
    // wird beim Entschlüsseln erkannt (AES-GCM-Tag-Prüfung schlägt fehl) statt still
    // akzeptiert zu werden. ownerId ist bei Selbst-Sync == _userId(), bei StB-Fremdzugriff
    // (foreignLoad) explizit der Mandanten-Owner — deshalb NIE hart _userId() annehmen.
    var AAD_VERSION = 'sync-v1';
    // Ablaufdatum des AAD-Migrations-Fallbacks (Fund R7, s. _decryptCt). AAD wurde am 2026-08-09
    // eingeführt; jeder Push eines Scopes schreibt das Chiffrat mit AAD neu. Vier Monate sind
    // reichlich für ein Gerät, das lange nicht synchronisiert hat — danach ist ein Blob ohne AAD
    // kein Migrationsfall mehr, sondern ein Verdachtsfall.
    // NACH diesem Datum: diesen Block und den Fallback in _decryptCt ersatzlos entfernen.
    var AAD_FALLBACK_UNTIL = Date.parse('2026-12-01T00:00:00Z');
    function _aad(ownerId, scope) {
        return new TextEncoder().encode(String(ownerId || '') + '|' + String(scope || '') + '|' + AAD_VERSION);
    }
    function _importKey(bytes) {
        return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }
    // Der tägliche Sync-Pfad nimmt bevorzugt den nicht-extrahierbaren CryptoKey aus IndexedDB und
    // fasst die Rohbytes gar nicht an (Fund R5). Nur wenn der noch nicht existiert (Alt-Gerät kurz
    // vor der Migration), wird aus den Rohbytes importiert — dann ebenfalls nicht extrahierbar.
    async function _cryptoKey() {
        var uid = _userId();
        if (_cryptoKeyCache && _cryptoKeyUid === uid) return _cryptoKeyCache;
        var ck = null;
        try { if (typeof indexedDB !== 'undefined') ck = await _idbkGet(_idbkKey(uid, 'ck')); } catch (e) {}
        if (!ck) {
            var bytes = await _keyBytes(uid);
            if (!bytes) throw new Error('no_key');
            ck = await _importKey(bytes);
            try { if (typeof indexedDB !== 'undefined') await _idbkPut(_idbkKey(uid, 'ck'), ck); } catch (e) {}
        }
        _cryptoKeyCache = ck;
        _cryptoKeyUid   = uid;
        return _cryptoKeyCache;
    }
    async function _encrypt(obj, scope, ownerId) {
        var key = await _cryptoKey();
        var iv  = crypto.getRandomValues(new Uint8Array(12));
        var pt  = new TextEncoder().encode(JSON.stringify(obj));
        var ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: _aad(ownerId || _userId(), scope) }, key, pt);
        return { ct: _b64(new Uint8Array(ct)), iv: _b64(iv) };
    }
    // Chiffrat-Beschaffung getrennt von der Entschlüsselung: nur so lässt sich sauber
    // unterscheiden, ob der SCHLÜSSEL nicht passt oder ob das ausgelagerte Chiffrat gerade
    // nicht ladbar war (Netz/Speicher). Früher endete beides in derselben Meldung
    // "Code falsch" — ein Netzfehler wurde dem Nutzer als falscher Code verkauft.
    async function _fetchCipher(blob) {
        // Übergroßes Ledger-Chiffrat liegt als eigenes Blob-Objekt (siehe push unten) —
        // erst herunterladen, dann wie gewohnt entschlüsseln.
        if (blob.blobUrl) return await BlobAttachments.get(blob.blobUrl);
        if (typeof blob.ciphertext !== 'string') throw new Error('blob_malformed');
        return _unb64(blob.ciphertext);
    }
    async function _decryptCt(ct, ivB64, scope, ownerId, overrideBytes) {
        var key = overrideBytes ? await _importKey(overrideBytes) : await _cryptoKey();
        var iv  = _unb64(ivB64);
        var pt;
        try {
            pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv, additionalData: _aad(ownerId || _userId(), scope) }, key, ct);
        } catch (e) {
            // Migrations-Fallback: Chiffrat von vor der AAD-Einführung hat keine additionalData.
            // Nächster Push dieses Scopes verschlüsselt automatisch wieder mit AAD (selbstheilend).
            //
            // Der Fallback hebelt für solches Alt-Chiffrat die Bindung an (ownerId, scope) aus
            // (Fund R7, Red-Team-Audit 2026-08-10). Da derselbe Schlüssel für alle Scopes eines
            // Nutzers gilt, könnte jemand mit Redis-Schreibzugriff — also der Betreiber oder ein
            // kompromittierter Upstash-Zugang — den Alt-Blob von Firma A in den Slot von Firma B
            // schieben, und der Client nähme ihn still an. Deshalb ein hartes Ablaufdatum:
            // ab dann gibt es kein Alt-Chiffrat mehr, das nicht längst neu geschrieben wurde
            // (jeder Push erneuert es), und der Umweg fällt weg statt jahrelang offen zu stehen.
            if (Date.now() > AAD_FALLBACK_UNTIL) throw e;
            pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
        }
        return JSON.parse(new TextDecoder().decode(pt));
    }
    async function _decrypt(blob, scope, ownerId, overrideBytes) {
        return _decryptCt(await _fetchCipher(blob), blob.iv, scope, ownerId, overrideBytes);
    }
    // Ergebnis eines Entschlüsselungs-Versuchs klassifizieren: 'key' (Schlüssel passt nicht,
    // Sackgasse — Nutzer muss handeln) vs. 'fetch' (Chiffrat gerade nicht ladbar, geht beim
    // nächsten Versuch meist von allein). Die Unterscheidung steuert Meldung UND Dot-Zustand.
    function _classifyDecryptError(e) {
        var m = (e && e.message) || '';
        return (/^blob_get_/.test(m) || m === 'blob_malformed' || /Failed to fetch|NetworkError|Load failed/i.test(m)) ? 'fetch' : 'key';
    }
    // ── Roh-Byte-Ver-/Entschlüsselung — für ausgelagerte Anhänge (BlobAttachments) ──
    async function _encryptBytes(bytes, scope, ownerId) {
        var key = await _cryptoKey();
        var iv  = crypto.getRandomValues(new Uint8Array(12));
        var ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: _aad(ownerId || _userId(), scope) }, key, bytes);
        return { ct: _b64(new Uint8Array(ct)), iv: _b64(iv) };
    }
    async function _decryptBytes(ctBytes, ivB64, scope, ownerId, overrideBytes) {
        var key = overrideBytes ? await _importKey(overrideBytes) : await _cryptoKey();
        var iv  = _unb64(ivB64);
        var pt;
        try {
            pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv, additionalData: _aad(ownerId || _userId(), scope) }, key, ctBytes);
        } catch (e) {
            pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ctBytes); // Migrations-Fallback, s. _decrypt
        }
        return new Uint8Array(pt);
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

    // ── Konflikt-Basis: updatedAt je Record zum Zeitpunkt des letzten Syncs ────
    function _getBase(scope) { try { return JSON.parse(localStorage.getItem(LS_BASE(scope)) || '{}'); } catch (e) { return {}; } }
    function _saveBase(scope, b) { try { localStorage.setItem(LS_BASE(scope), JSON.stringify(b)); } catch (e) {} }
    function _getBlobCache(scope) { try { return JSON.parse(localStorage.getItem(LS_BLOBCACHE(scope)) || '{}'); } catch (e) { return {}; } }
    function _saveBlobCache(scope, c) { try { localStorage.setItem(LS_BLOBCACHE(scope), JSON.stringify(c)); } catch (e) {} }
    // ── Offene Konflikte persistieren (überleben Reload, dedupe scope+key+id) ──
    function _loadConflicts() { try { return JSON.parse(localStorage.getItem(LS_CONFLICTS) || '[]'); } catch (e) { return []; } }
    function _clearConflicts() { try { localStorage.removeItem(LS_CONFLICTS); } catch (e) {} }
    function _persistConflicts(fresh) {
        var all = _loadConflicts(), seen = {};
        all.concat(fresh).forEach(function (c) { seen[c.scope + '|' + c.key + '|' + c.id] = c; });
        var list = Object.keys(seen).map(function (k) { return seen[k]; });
        try { localStorage.setItem(LS_CONFLICTS, JSON.stringify(list)); } catch (e) {}
        return list;
    }

    // ── Audit-Log-Anker: neue Einträge (Content-Hash) an die append-only Server-Liste melden ──
    // Best-effort — ein Fehlschlag darf den eigentlichen Sync nicht stören. Bereits gemeldete
    // IDs werden lokal gemerkt, damit nicht bei jedem Sync alles erneut gesendet wird.
    function _loadAnchored(scope) { try { return JSON.parse(localStorage.getItem(LS_ANCHORED(scope)) || '[]'); } catch (e) { return []; } }
    function _saveAnchored(scope, ids) { try { localStorage.setItem(LS_ANCHORED(scope), JSON.stringify(ids)); } catch (e) {} }
    async function _pushAuditAnchors(scope, auditLog) {
        if (!Array.isArray(auditLog) || !auditLog.length) return;
        var already = new Set(_loadAnchored(scope));
        var pending = auditLog.filter(function (e) { return e && e.id != null && !already.has(e.id); });
        if (!pending.length) return;
        try {
            for (var i = 0; i < pending.length; i += ANCHOR_BATCH) {
                var batch = pending.slice(i, i + ANCHOR_BATCH);
                var entries = [];
                for (var j = 0; j < batch.length; j++) entries.push({ id: batch[j].id, h: await Store._auditContentHash(batch[j]) });
                var res = await _api({ action: 'anchor', scope: scope, entries: entries });
                if (res.status !== 200) return;   // Rate-Limit o.ä. — nächster Sync versucht es erneut
                batch.forEach(function (e) { already.add(e.id); });
            }
            _saveAnchored(scope, Array.from(already));
        } catch (e) { console.warn('[CloudSync] Audit-Anker fehlgeschlagen (nicht kritisch):', e && e.message); }
    }

    // Nach erfolgreichem Sync: neuen gemeinsamen Stand als Basis für die nächste Kollisionsprüfung merken
    function _updateBase(scope, merged) {
        var base = {};
        Object.keys(merged.keys).forEach(function (k) {
            var v = merged.keys[k];
            if (Array.isArray(v) && !/__audit_log$/.test(k)) {
                var m = {}; v.forEach(function (r) { if (r && r.id != null) m[r.id] = r.updatedAt || 0; });
                base[k] = m;
            }
        });
        _saveBase(scope, base);
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
            var v  = (typeof Store !== 'undefined') ? Store._syncReadRaw(fk) : localStorage.getItem(fk);
            if (v != null && keys.indexOf(fk) === -1) keys.push(fk);
        });
        return keys;
    }

    // ── Merge-Bausteine ────────────────────────────────────────────────────────
    function _isRecArr(a, b) {
        var probe = (Array.isArray(a) && a.length) ? a : ((Array.isArray(b) && b.length) ? b : null);
        if (!probe) return Array.isArray(a) || Array.isArray(b);   // beide leer/array → record-merge (no-op)
        return probe.every(function (x) { return x && typeof x === 'object' && ('id' in x); });
    }

    // LWW nach updatedAt; Tombstones (storniert/gesperrt) sind reguläre Felder → gewinnen via neuerem updatedAt.
    // base (optional): updatedAt je Record beim letzten Sync → echte Parallel-Konflikte erkennen
    //   (nur wenn BEIDE Seiten seit base geändert → conflicts). Sequentielle Updates sind kein Konflikt.
    // entityType (optional): 'einkauf'|'verkauf'|'ausgabe' — wenn gesetzt, wird Store.isTombstoned()
    //   konsultiert, damit ein physisch gelöschter Datensatz (offene Periode, s. store.js
    //   deletePurchase/deleteSale/deleteExpense) nicht durch einen älteren Cloud-Snapshot eines
    //   anderen Geräts unbemerkt wieder auftaucht.
    function _mergeRecords(localArr, remoteArr, base, entityType) {
        var byId = {}, localDirty = false, remoteDirty = false, remoteIds = {}, conflicts = [];
        (localArr || []).forEach(function (r) { if (r && r.id != null) byId[r.id] = r; });
        var localIds = Object.keys(byId);
        (remoteArr || []).forEach(function (r) {
            if (!r || r.id == null) return;
            var ex = byId[r.id];
            if (!ex && entityType && typeof Store !== 'undefined' && Store.isTombstoned && Store.isTombstoned(entityType, r.id)) {
                // Lokal bewusst gelöscht (Tombstone vorhanden) — NICHT wieder aufnehmen. remoteDirty,
                // damit der nächste Push die veraltete Remote-Kopie ebenfalls entfernt.
                remoteDirty = true;
                return;
            }
            remoteIds[r.id] = 1;
            if (!ex) { byId[r.id] = r; localDirty = true; }
            else {
                var ru = r.updatedAt || 0, lu = ex.updatedAt || 0;
                if (base && ru !== lu) {
                    var b = base[r.id];
                    if (b != null && ru > b && lu > b) conflicts.push({ id: r.id, mine: ex, theirs: r });   // beide seit Base bewegt → echte Kollision, beide Fassungen behalten
                }
                if (ru > lu) { byId[r.id] = r; localDirty = true; }
                else if (lu > ru) { remoteDirty = true; }
            }
        });
        localIds.forEach(function (id) { if (!remoteIds[id]) remoteDirty = true; });
        return { val: Object.keys(byId).map(function (id) { return byId[id]; }), localDirty: localDirty, remoteDirty: remoteDirty, conflicts: conflicts };
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
        var mergedKeys = {}, mergedMeta = {}, localDirty = false, remoteDirty = false, conflicts = [];
        var base = _getBase(scope);
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
                var entityType = /__reselling_purchases$/.test(k) ? 'einkauf'
                    : /__reselling_sales$/.test(k) ? 'verkauf'
                    : /__reselling_expenses$/.test(k) ? 'ausgabe' : null;
                var rr = _mergeRecords(lv, rv, base[k], entityType);
                mergedKeys[k] = rr.val; if (rr.localDirty) localDirty = true; if (rr.remoteDirty) remoteDirty = true;
                if (rr.conflicts.length) rr.conflicts.forEach(function (c) { conflicts.push({ key: k, id: c.id, mine: c.mine, theirs: c.theirs }); });
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
        return { keys: mergedKeys, meta: mergedMeta, localDirty: localDirty, remoteDirty: remoteDirty, conflicts: conflicts };
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
            var isCacheKey = (k.indexOf('__reselling_') !== -1 || k.indexOf('__rechnungsbuch_') !== -1 || k.indexOf('__eigenbelege_') !== -1 || /__audit_log$/.test(k));
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
            try {
                remote = await _decrypt(pull.json.blob, scope);   // { keys, meta }
            } catch (de) {
                // NIE als "keine Remote-Daten" weiterlaufen: remote === null würde unten einen
                // Push auslösen und damit fremde/ältere Cloud-Daten mit diesem Schlüssel
                // überschreiben. Stattdessen sauber abbrechen und den Zustand benennen.
                var err = new Error(_classifyDecryptError(de) === 'fetch' ? 'cipher_unreachable' : 'key_mismatch');
                err.scope = scope;
                err.cause = de;
                throw err;
            }
            // Ausgelagerte große Felder (Logo/Foto/PDF) wieder zu voller "data:"-URL machen,
            // BEVOR gemerged wird — der Merge kennt nur echte Werte, keine Blob-Referenzen.
            if (remote) await BlobAttachments.hydrateFields(remote.keys, function (ct, iv) { return _decryptBytes(ct, iv, scope); });
        }
        var local  = _buildLocal(scope);
        var merged = _merge(scope, local, remote);

        if (merged.localDirty) {
            _applyMerged(scope, merged);
            if (scope === _activeScope()) { if (isStartup) _needReload = true; else _changedActive = true; }
        }

        if (remote === null || merged.remoteDirty) {
            // Große Felder vor dem Verschlüsseln auslagern — hält das Ledger-Chiffrat
            // unabhängig von Anzahl/Größe der Anhänge klein (siehe blob-attachments.js).
            // Cache verhindert Doppel-Upload unveränderter Anhänge bei jedem Scope-Sync.
            var blobCache = _getBlobCache(scope);
            await BlobAttachments.offloadLargeFields(scope, merged.keys, function (b) { return _encryptBytes(b, scope); }, blobCache);
            _saveBlobCache(scope, blobCache);
            var enc  = await _encrypt({ v: 1, keys: merged.keys, meta: merged.meta }, scope);
            var pushBody = { action: 'push', scope: scope, version: remoteVer, iv: enc.iv, deviceId: Store._deviceId() };
            // Auch nach dem Auslagern von Feldern kann das Ledger selbst (viele tausend
            // Textbuchungen) noch zu groß fürs Inline-Limit sein — dann ebenfalls als
            // eigenes Blob-Objekt hochladen statt inline zu pushen.
            if (enc.ct.length > MAX_INLINE_CIPHER) { // muss zum Server-Limit in api/sync.js passen (dort die maßgebliche Grenze)
                pushBody.blobUrl = await BlobAttachments.put(scope, 'ledger-' + Date.now().toString(36), _unb64(enc.ct));
            } else {
                pushBody.ciphertext = enc.ct;
            }
            var push = await _api(pushBody);
            if (push.status === 413) { // Sicherheitsnetz: Server-Grenze doch gerissen → als Blob nachschieben und retry
                pushBody.blobUrl = await BlobAttachments.put(scope, 'ledger-' + Date.now().toString(36), _unb64(enc.ct));
                delete pushBody.ciphertext;
                push = await _api(pushBody);
            }
            // 409 heißt normalerweise Versionskonflikt → pull-merge-retry. Seit dem Scope-Deckel
            // (api/sync.js claimScope, Fund R2) kann 409 auch "zu viele Scopes" bedeuten — das ist
            // durch Wiederholen nicht zu heilen, drei Retries wären verschenkt und der Nutzer sähe
            // am Ende nur "push_409".
            if (push.status === 409 && push.json && push.json.error === 'scope_limit')
                throw new Error('scope_limit');
            if (push.status === 409 && attempt < 3) return _syncScope(scope, isStartup, attempt + 1);
            if (push.status === 403) throw new Error('pro_required');
            if (push.status !== 200) throw new Error('push_' + push.status);
        }
        // Nur auf dem final erfolgreichen Pass: Konflikte melden + Basis fortschreiben
        if (merged.conflicts.length) merged.conflicts.forEach(function (c) {
            _conflicts.push({ scope: scope, key: c.key, id: c.id, mine: c.mine, theirs: c.theirs });
        });
        _updateBase(scope, merged);
        await _pushAuditAnchors(scope, merged.keys[scope + '__audit_log']);
    }

    var _needReload    = false;
    var _changedActive = false;
    var _conflicts     = [];

    // ── Alle Scopes synchronisieren ───────────────────────────────────────────
    async function _syncAll(isStartup) {
        // Steuerberater-Read-Only-Sitzung: weder eigene Registry (enthält Client-Firmen)
        // noch Mandantendaten synchronisieren — StB betrachtet nur, Sync ruht bis Exit.
        if (typeof StbShare !== 'undefined' && StbShare.isReadonly && StbShare.isReadonly()) return;
        if (_running || !_enabled() || !_hasKey() || !_token() || !_isPro()) return;
        _running = true; _needReload = false; _changedActive = false; _conflicts = [];
        _setDot('sync');
        try {
            retryPendingDeletions().catch(function (e) { console.warn('[CloudSync] retryPendingDeletions:', e && e.message); }); // fire-and-forget, blockiert den Sync nicht
            await _syncScope('__account', isStartup);   // zuerst Registry → Firmen-IDs angleichen
            var companies = (typeof CompanyManager !== 'undefined') ? CompanyManager.getAll() : [];
            for (var i = 0; i < companies.length; i++) {
                // Read-only-Mandanten (Steuerberater-Ansicht) NIE hochladen
                if (companies[i] && companies[i].id && !companies[i]._readonly) await _syncScope(companies[i].id, isStartup);
            }
            _setDot('ok');
            _setMismatch(false);   // Lauf komplett durch → Schlüssel passt, alte Sackgassen-Markierung weg
            try { localStorage.setItem(LS_LAST_OK, String(Date.now())); } catch (e) {}
            _maybeAutoVerifyAnchors();   // fire-and-forget, taeglich throttled
            if (_conflicts.length) {
                console.warn('[CloudSync] Parallel-Konflikte erkannt (beide Fassungen gesichert):', _conflicts);
                var pending = _persistConflicts(_conflicts);
                // Reload hat Vorrang (Dialog erscheint danach via init); sonst direkt öffnen
                if (!_needReload) openConflicts();
                else _setDot('warn');
            }
            if (_needReload)      { Utils.showToast('☁ Cloud-Daten übernommen — lade neu…', 'info', 1800); setTimeout(function () { location.reload(); }, 1300); }
            else if (_changedActive) Utils.showToast('☁ Daten aus der Cloud zusammengeführt', 'info', 3000);
        } catch (e) {
            console.warn('[CloudSync] sync error:', e && e.message);
            var msg = (e && e.message) || '';
            if (msg === 'key_mismatch') {
                // Der eine Fehler, der von allein NIE weggeht: ohne Zutun des Nutzers bleibt der
                // Sync für immer tot. Deshalb dauerhaft markieren, roter Punkt, lauter Hinweis.
                _setMismatch(true);
                _setDot('broken');
                if (typeof Utils !== 'undefined') Utils.showToast(
                    '⛔ Cloud-Sync gestoppt: Der Schlüssel dieses Geräts passt nicht zu den Cloud-Daten deines Accounts. ' +
                    'Deine lokalen Daten sind vollständig sicher. Klick auf das Wolken-Symbol oben → „Problem beheben“.', 'error', 15000);
            } else {
                _setDot('err');
                if (typeof Utils === 'undefined') { /* kein UI verfügbar */ }
                else if (e && e.userMessage)               Utils.showToast(e.userMessage, 'warning', 8000);
                else if (msg === 'pro_required')           Utils.showToast('Cloud-Sync ist ein Pro-Feature.', 'warning');
                else if (msg === 'scope_limit')
                    Utils.showToast('Cloud-Sync: Grenze für gesicherte Firmen erreicht. Lösche in den Einstellungen die Cloud-Daten von Firmen, die du nicht mehr brauchst.', 'warning', 8000);
                else if (msg === 'cipher_unreachable')
                    Utils.showToast('Cloud-Sync: Ausgelagerte Cloud-Daten waren nicht abrufbar — das ist KEIN Schlüsselproblem. Beim nächsten Sync wird es erneut versucht.', 'warning', 8000);
                // Alles Übrige (pull_5xx, push_409, Netzabbruch) lief bisher völlig stumm ab:
                // der Nutzer hielt den Sync für aktiv, während seit Wochen nichts mehr ankam.
                // Gedrosselt melden — einmal am Tag reicht, um nicht zu nerven.
                else _maybeErrToast('Cloud-Sync konnte zuletzt nicht abschließen (' + (msg || 'unbekannter Fehler') +
                                    '). Deine Daten liegen lokal sicher — Details über das Wolken-Symbol → „Diagnose“.');
            }
        } finally {
            _running = false;
        }
    }

    // ── Status-Punkt (wiederverwendet #cloudSyncDot) ──────────────────────────
    function _setDot(state) {
        var el = document.getElementById('cloudSyncDot');
        if (!el) return;
        el.style.cursor = 'pointer';
        el.onclick = (state === 'warn') ? openConflicts : openPanel;
        var map = {
            off:  ['<i class="ti ti-cloud"></i>', 'var(--text-muted,#888)',    'Cloud-Sync aus — klicken zum Aktivieren'],
            sync: ['<i class="ti ti-cloud"></i>', 'var(--accent,#10b981)',     'Synchronisiere…'],
            ok:   ['<i class="ti ti-cloud"></i>', 'var(--accent,#10b981)',     'Cloud-Sync aktiv'],
            warn: ['<i class="ti ti-cloud-exclamation"></i>', '#f59e0b',       'Sync-Konflikte offen — klicken zum Lösen'],
            err:  ['<i class="ti ti-cloud-exclamation"></i>', '#f59e0b',       'Cloud-Sync-Fehler — klicken für Details'],
            // Eigener, roter Zustand: nicht "hakt gerade", sondern "steht und bleibt stehen,
            // bis du etwas tust". Optisch klar von der gelben Warnung getrennt.
            broken: ['<i class="ti ti-cloud-off"></i>', 'var(--danger,#ef4444)', 'Cloud-Sync gestoppt (Schlüssel passt nicht) — klicken zum Beheben']
        };
        var s = map[state] || map.off;
        el.innerHTML = s[0]; el.style.color = s[1]; el.title = s[2];
    }

    // Gedrosselte Fehlermeldung: höchstens einmal pro Tag, und nie wenn das Gerät ohnehin
    // offline ist (dann ist "Sync fehlgeschlagen" keine Information, sondern Lärm).
    function _maybeErrToast(msg) {
        if (typeof Utils === 'undefined') return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
        var last = parseInt(localStorage.getItem(LS_ERR_TOAST) || '0', 10);
        if (last && (Date.now() - last) < ERR_TOAST_INTERVAL_MS) return;
        try { localStorage.setItem(LS_ERR_TOAST, String(Date.now())); } catch (e) {}
        Utils.showToast(msg, 'warning', 10000);
    }

    // ── onLocalChange: debounced Push nach Änderung ───────────────────────────
    function onLocalChange() {
        // Im Steuerberater-Read-Only-Modus nichts pushen (fremde Mandantendaten)
        if (typeof StbShare !== 'undefined' && StbShare.isReadonly && StbShare.isReadonly()) return;
        if (!_enabled() || !_hasKey() || _running) return;
        clearTimeout(_pushTimer);
        _pushTimer = setTimeout(function () { _syncAll(false); }, PUSH_DEBOUNCE);
    }

    // ── Wiederherstellungscode-Erinnerung (selten, unabhängig von isHealthy) ──
    // isHealthy() erkennt kaputten/hängenden Sync, aber NICHT den Verlust des
    // Wiederherstellungscodes selbst — der ist laut Enable-Dialog der einzige
    // Weg an die Cloud-Daten und nicht zurücksetzbar. Deshalb unabhängig davon
    // alle 90 Tage ein leiser Reminder, den Code nochmal zu sichern.
    function _maybeRemindCode() {
        if (!_enabled() || !_hasKey()) return;
        var last = parseInt(localStorage.getItem(LS_CODE_REMIND) || '0', 10);
        if (last && (Date.now() - last) < CODE_REMIND_INTERVAL_MS) return;
        try { localStorage.setItem(LS_CODE_REMIND, String(Date.now())); } catch (e) {}
        setTimeout(function () {
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('Cloud-Sync-Wiederherstellungscode noch sicher verwahrt? Er ist der einzige Weg an deine Cloud-Daten — Cloud-Sync-Menü → Code anzeigen.', 'info');
            }
        }, 6000);
    }

    // ── Init: Dot setzen, beim Start Pull (sobald Store bereit) ───────────────
    function init() {
        // Reihenfolge nach Dringlichkeit: eine Schlüssel-Sackgasse überlebt den Reload und muss
        // sofort wieder sichtbar sein — sonst sieht der Nutzer nach jedem Neustart wieder einen
        // freundlichen grünen Punkt, obwohl seit Wochen nichts mehr synchronisiert wird.
        _setDot(_hasMismatch() ? 'broken' : (_loadConflicts().length ? 'warn' : (_enabled() && _hasKey() ? 'ok' : 'off')));
        if (_inited) return; _inited = true;

        // Schlüssel aus localStorage nach IndexedDB holen (Fund R5). Läuft im Hintergrund und
        // blockiert den Start nicht: schlägt sie fehl, bleibt der Alt-Eintrag liegen und alles
        // funktioniert wie bisher — _keyBytes() liest ihn weiter als Rückfall.
        _migrateKeyToIdb(_userId()).catch(function () {});
        if (_hasMismatch() && typeof Utils !== 'undefined') {
            setTimeout(function () {
                Utils.showToast('⛔ Cloud-Sync steht still: Schlüssel und Cloud-Daten passen nicht zusammen. ' +
                                'Klick auf das Wolken-Symbol oben, um es zu beheben.', 'error', 12000);
            }, 4000);
        }
        if (!_enabled() || !_hasKey() || !_token()) return;
        _maybeRemindCode();
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

    // Reparatur-Block: erscheint oben im Panel, sobald ein Sync-Lauf am Schlüssel gescheitert
    // ist. Er ist der einzige Weg aus der Sackgasse — vorher gab es dafür gar keine UI.
    function _repairBlock() {
        if (!_hasMismatch()) return '';
        return '<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);border-radius:8px;padding:12px;font-size:13px;line-height:1.5;">' +
                 '⛔ <strong>Cloud-Sync steht.</strong> Die in der Cloud liegenden Daten dieses Accounts sind mit einem <strong>anderen Schlüssel</strong> ' +
                 'verschlüsselt als dem auf diesem Gerät. Es geht dadurch nichts verloren: deine Buchhaltung liegt vollständig lokal auf diesem Gerät.' +
                 '<div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">' +
                   '<button class="btn btn-primary" data-action="cs-connect" style="width:100%;">🔑 Richtigen Wiederherstellungscode eingeben</button>' +
                   '<button class="btn btn-outline" data-action="cs-reset" style="width:100%;">🗑 Cloud-Daten verwerfen &amp; neu aufsetzen</button>' +
                 '</div>' +
               '</div>';
    }

    function openPanel() {
        var on = _enabled() && _hasKey();
        var body;
        if (on) {
            body =
              '<div style="display:flex;flex-direction:column;gap:14px;">' +
                _repairBlock() +
                (_hasMismatch() ? '' :
                '<div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:8px;padding:12px;font-size:13px;">' +
                  '☁ <strong>Cloud-Sync ist aktiv.</strong> Deine Daten werden Ende-zu-Ende-verschlüsselt zwischen deinen Geräten synchronisiert. Der Server kann sie nicht lesen.' +
                '</div>') +
                '<button class="btn btn-outline" data-action="cs-show-code" style="width:100%;">🔑 Wiederherstellungscode anzeigen</button>' +
                '<button class="btn btn-outline" data-action="cs-sync-now" style="width:100%;">🔄 Jetzt synchronisieren</button>' +
                '<button class="btn btn-outline" data-action="cs-diagnose" style="width:100%;">🩺 Sync-Diagnose</button>' +
                '<button class="btn" data-action="cs-disable" style="width:100%;background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.3);">Cloud-Sync deaktivieren</button>' +
              '</div>';
        } else {
            body =
              '<div style="display:flex;flex-direction:column;gap:14px;">' +
                _repairBlock() +
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
                '<button class="btn btn-outline" data-action="cs-diagnose" style="width:100%;">🩺 Sync-Diagnose</button>' +
              '</div>';
        }
        App.showModal('Cloud-Sync', body, '');
    }

    // Lesbare Herkunftsangabe zu einem Cloud-Snapshot — hilft dem Nutzer einzuordnen,
    // WELCHES Gerät die Daten zuletzt geschrieben hat.
    function _blobInfo(blob) {
        if (!blob) return 'keine Cloud-Daten';
        var parts = [];
        if (blob.updatedAt) { try { parts.push('Stand ' + new Date(blob.updatedAt).toLocaleString('de-DE')); } catch (e) {} }
        if (blob.version)  parts.push('Version ' + blob.version);
        if (blob.deviceId) parts.push('zuletzt von Gerät ' + String(blob.deviceId).slice(0, 8));
        if (blob.blobUrl) parts.push('ausgelagert');
        else {
            var kb = Math.round(String(blob.ciphertext || '').length * 0.75 / 1024);   // Base64 → Rohbytes
            parts.push(kb >= 1 ? kb + ' KB' : 'unter 1 KB');
        }
        return parts.join(' · ');
    }

    // Legt einen neuen Schlüssel an. Async, weil die Ablage seit Fund R5 in IndexedDB liegt und
    // _storeKey den Schreibvorgang zurückliest, bevor er Erfolg meldet — ein nur scheinbar
    // gespeicherter Schlüssel wäre der Verlust aller künftigen Cloud-Daten.
    async function _mintKey(uid) {
        var bytes = crypto.getRandomValues(new Uint8Array(32));
        try { await _storeKey(uid, bytes); }
        catch (e) {
            console.warn('[CloudSync] mintKey:', e && e.message);
            Utils.showToast('Schlüssel konnte nicht gespeichert werden.', 'error');
            return false;
        }
        _cryptoKeyCache = null;
        _setMismatch(false);
        return true;
    }

    // ── Aktivieren: Schlüssel erzeugen → Code-Dialog (Pflicht-Bestätigung) ────
    // WICHTIG: Vor dem Erzeugen eines Schlüssels wird geprüft, ob für diesen Account bereits
    // Cloud-Daten liegen. Ohne diese Prüfung entstand die klassische Sackgasse: Gerät A
    // aktiviert (Schlüssel K1, Daten liegen verschlüsselt in der Cloud), Gerät B drückt
    // ebenfalls "aktivieren" statt "verbinden" → Schlüssel K2. K2 kann K1-Daten nie lesen,
    // jeder Sync scheitert, und der auf Gerät B angezeigte Code ist für die vorhandenen
    // Cloud-Daten wertlos. Genau derselbe Effekt trat beim Deaktivieren-und-wieder-
    // Aktivieren auf demselben Gerät ein, weil der vorhandene Schlüssel überschrieben wurde.
    async function enableFlow() {
        if (!_isPro()) { Utils.showToast('Cloud-Sync ist ein Pro-Feature.', 'warning'); return; }
        var uid = _userId();
        if (!uid) { Utils.showToast('Bitte zuerst mit Whop anmelden.', 'warning'); return; }
        if (!_token()) { Utils.showToast('Bitte zuerst mit Whop anmelden.', 'warning'); return; }

        // Fall 1: Dieses Gerät hat schon einen Schlüssel (z. B. nach "deaktivieren ohne
        // Schlüssel löschen") → wiederverwenden statt überschreiben. Ein neuer Schlüssel
        // würde die eigenen Cloud-Daten unlesbar machen.
        if (_hasKey()) { await showCode(true); return; }

        Utils.showToast('Prüfe, ob für deinen Account schon Cloud-Daten existieren…', 'info', 2500);
        var probe;
        try { probe = await _api({ action: 'pull', scope: '__account' }); }
        catch (e) { probe = { status: 0, json: {} }; }

        if (probe.status === 403) { Utils.showToast('Cloud-Sync ist ein Pro-Feature.', 'warning'); return; }
        if (probe.status !== 200) {
            // Bewusst KEIN Schlüssel "auf Verdacht": liegen serverseitig schon Daten, wäre der
            // neue Schlüssel für immer der falsche. Lieber abbrechen als eine Sackgasse bauen.
            Utils.showToast('Cloud-Sync konnte nicht geprüft werden (Server nicht erreichbar' +
                (probe.status ? ', HTTP ' + probe.status : '') + '). Bitte mit Internetverbindung erneut versuchen.', 'warning', 9000);
            return;
        }
        if (probe.json.blob) { _showExistingData(probe.json.blob); return; }

        if (await _mintKey(uid)) await showCode(true);
    }

    // Es liegen bereits Cloud-Daten: der Nutzer entscheidet bewusst zwischen "verbinden"
    // (Regelfall) und "verwerfen" — ein stiller zweiter Schlüssel ist keine Option mehr.
    function _showExistingData(blob) {
        var body =
          '<div style="display:flex;flex-direction:column;gap:14px;">' +
            '<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:12px;font-size:13px;line-height:1.5;">' +
              '⚠️ Für deinen Account liegen <strong>bereits verschlüsselte Cloud-Daten</strong> (' + _esc(_blobInfo(blob)) + ').' +
            '</div>' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">' +
              'Würde dieses Gerät jetzt einen <strong>neuen</strong> Schlüssel erzeugen, könnte es die vorhandenen Daten nie mehr lesen — ' +
              'und der hier angezeigte Wiederherstellungscode wäre für sie wertlos. Wähle deshalb:' +
            '</div>' +
            '<button class="btn btn-primary" data-action="cs-connect" style="width:100%;">📲 Mit bestehendem Sync verbinden (empfohlen)</button>' +
            '<div style="font-size:12px;color:var(--text-muted);">Du brauchst dafür den Wiederherstellungscode deines anderen Geräts.</div>' +
            '<button class="btn btn-outline" data-action="cs-reset" style="width:100%;">🗑 Cloud-Daten verwerfen &amp; neu aufsetzen</button>' +
            '<div style="font-size:12px;color:var(--text-muted);">Nur wenn du den Code nicht mehr hast. Deine lokalen Daten bleiben unberührt.</div>' +
          '</div>';
        App.showModal('Es gibt schon Cloud-Daten', body, '');
    }

    // ── Code-Dialog (firstTime erzwingt Bestätigung) ──────────────────────────
    async function showCode(firstTime) {
        var bytes = await _keyBytes();
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

    async function _finishEnable() {
        var saved = document.getElementById('syncCodeSaved');
        var conf  = document.getElementById('syncCodeConfirm');
        if (!saved || !saved.checked) { Utils.showToast('Bitte bestätige, dass du den Code gespeichert hast.', 'warning'); return; }
        var bytes = await _keyBytes(); var expected = _groupCode(_toB32(bytes)).split(' ').slice(-2).join('');
        var got = (conf ? conf.value : '').toUpperCase().replace(/[^A-Z2-7]/g, '');
        if (got !== expected) { Utils.showToast('Die eingegebenen Gruppen stimmen nicht. Bitte prüfen.', 'error'); if (conf) conf.focus(); return; }
        localStorage.setItem(LS_ENABLED, '1');
        _setMismatch(false);
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

    // Prüft einen eingegebenen Schlüssel gegen einen Cloud-Snapshot.
    // 'ok' | 'mismatch' (Schlüssel passt nicht) | 'unreachable' (Chiffrat nicht ladbar).
    // Die Trennung ist der Grund, warum ein Netz-/Speicherfehler nicht mehr fälschlich als
    // "Code falsch" gemeldet wird — das hat Nutzer an einem völlig korrekten Code zweifeln lassen.
    async function _probeKey(blob, bytes) {
        var ct;
        try { ct = await _fetchCipher(blob); }
        catch (e) { return 'unreachable'; }
        if (!ct || !ct.length) return 'unreachable';
        try { await _decryptCt(ct, blob.iv, '__account', _userId(), bytes); return 'ok'; }
        catch (e) { return 'mismatch'; }
    }

    // Code passt nicht: statt eines wegfliegenden Toasts ein Dialog, der den Zustand erklärt
    // und beide Auswege anbietet. Ohne ihn stand der Nutzer in einer Sackgasse ohne Ausgang.
    function _showCodeMismatch(blob) {
        var body =
          '<div style="display:flex;flex-direction:column;gap:14px;">' +
            '<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);border-radius:8px;padding:12px;font-size:13px;line-height:1.5;">' +
              '❌ <strong>Dieser Code passt nicht zu den Cloud-Daten deines Accounts.</strong>' +
            '</div>' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">' +
              'Die Daten in der Cloud (' + _esc(_blobInfo(blob)) + ') wurden mit einem <strong>anderen Schlüssel</strong> verschlüsselt. ' +
              'Das passiert typischerweise, wenn auf einem Gerät „Cloud-Sync aktivieren“ statt „Mit bestehendem Sync verbinden“ gewählt wurde — ' +
              'dann existieren zwei Schlüssel, und nur einer davon öffnet diese Daten.' +
            '</div>' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">' +
              '<strong>Was jetzt hilft:</strong> Öffne auf dem Gerät, das zuletzt erfolgreich synchronisiert hat, ' +
              '„Cloud-Sync → 🔑 Wiederherstellungscode anzeigen“ und gib <em>diesen</em> Code hier ein.' +
            '</div>' +
            '<button class="btn btn-primary" data-action="cs-connect" style="width:100%;">🔑 Anderen Code eingeben</button>' +
            '<button class="btn btn-outline" data-action="cs-reset" style="width:100%;">🗑 Cloud-Daten verwerfen &amp; neu aufsetzen</button>' +
            '<div style="font-size:12px;color:var(--text-muted);line-height:1.5;">' +
              'Verwerfen löscht nur die <strong>unlesbaren Cloud-Kopien</strong>. Deine Buchhaltung auf diesem Gerät bleibt vollständig erhalten.' +
            '</div>' +
          '</div>';
        App.showModal('Code passt nicht', body, '');
    }

    async function _finishConnect() {
        var ta = document.getElementById('syncConnectCode');
        var btn = document.getElementById('syncConnectBtn');
        var raw = ta ? String(ta.value || '') : '';
        var bytes = _fromB32(raw);
        if (bytes.length !== 32) {
            var n = raw.toUpperCase().replace(/[^A-Z2-7]/g, '').length;
            // Konkret statt "ungültig": 52 Zeichen sind Pflicht, und die häufigsten Tippfehler
            // (0/O, 1/I, 8/B) fallen sonst stumm raus, weil das Alphabet sie gar nicht kennt.
            Utils.showToast('Code unvollständig: ' + n + ' von 52 Zeichen erkannt. Der Code besteht aus 11 Gruppen. ' +
                            'Beachte: er enthält keine Ziffern 0, 1, 8 und 9 — das sind O, I, B bzw. G.', 'error', 10000);
            return;
        }
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Prüfe…'; }
        try {
            // Test-Entschlüsselung gegen die Account-Registry des anderen Geräts
            var pull = await _api({ action: 'pull', scope: '__account' });
            if (pull.status === 403) { Utils.showToast('Cloud-Sync ist ein Pro-Feature.', 'warning'); throw 0; }
            if (pull.status !== 200) { Utils.showToast('Server nicht erreichbar (' + pull.status + ').', 'error'); throw 0; }
            if (pull.json.blob) {
                var probe = await _probeKey(pull.json.blob, bytes);
                if (probe === 'unreachable') {
                    Utils.showToast('Die Cloud-Daten konnten gerade nicht geladen werden (Netzwerk/Speicher). ' +
                                    'Das ist KEIN Fehler deines Codes — bitte gleich noch einmal versuchen.', 'warning', 10000);
                    throw 0;
                }
                if (probe === 'mismatch') { _showCodeMismatch(pull.json.blob); throw 0; }
            } else {
                Utils.showToast('Keine bestehenden Cloud-Daten gefunden — Sync wird neu aufgebaut.', 'info');
            }
            // Code korrekt → lokal speichern, aktivieren
            localStorage.setItem(LS_KEY(_userId()), _b64(bytes));
            localStorage.setItem(LS_ENABLED, '1');
            _cryptoKeyCache = null;
            _setMismatch(false);
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

    // ========================================================================
    // Notausgang: Cloud-Daten verwerfen und neu aufsetzen
    // ========================================================================
    // Für den Fall, dass der Schlüssel zu den Cloud-Daten auf keinem Gerät mehr existiert.
    // Ohne diesen Weg bliebe der Account dauerhaft unsynchronisierbar: der reguläre
    // Löschpfad (deleteRemote) setzt einen funktionierenden Schlüssel voraus, weil er den
    // Snapshot erst entschlüsseln muss, um die Anhang-URLs einzusammeln.
    function resetFlow() {
        if (!_isPro()) { Utils.showToast('Cloud-Sync ist ein Pro-Feature.', 'warning'); return; }
        if (!_token()) { Utils.showToast('Bitte zuerst mit Whop anmelden.', 'warning'); return; }
        var body =
          '<div style="display:flex;flex-direction:column;gap:14px;">' +
            '<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);border-radius:8px;padding:12px;font-size:13px;line-height:1.5;">' +
              '🗑 Alle <strong>verschlüsselten Cloud-Kopien</strong> deines Accounts werden gelöscht und der Sync mit einem neuen Schlüssel neu aufgebaut.' +
            '</div>' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">' +
              '<strong>Deine Buchhaltung auf diesem Gerät bleibt vollständig erhalten</strong> — gelöscht wird nur, was in der Cloud liegt ' +
              'und ohnehin von keinem deiner Geräte mehr entschlüsselt werden kann. Nach dem Zurücksetzen lädt <strong>dieses</strong> Gerät seinen Stand neu hoch.' +
            '</div>' +
            '<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:10px;font-size:12px;line-height:1.5;">' +
              '⚠️ <strong>Vorher auf deinen anderen Geräten prüfen:</strong> Hat dort noch ein Gerät Daten, die es nur in der Cloud gibt? ' +
              'Dann zuerst dort ein lokales Backup (Backup &amp; Daten) ziehen. Nach dem Zurücksetzen verbindest du jedes weitere Gerät ' +
              'über „Mit bestehendem Sync verbinden“ mit dem <strong>neuen</strong> Code.' +
            '</div>' +
            '<div style="font-size:12px;color:var(--text-muted);">Zum Bestätigen <strong>LÖSCHEN</strong> eintippen:</div>' +
            '<input type="text" id="syncResetConfirm" class="form-input" placeholder="LÖSCHEN" autocomplete="off" style="font-family:monospace;letter-spacing:1px;">' +
            '<button class="btn" id="syncResetBtn" data-action="cs-finish-reset" style="width:100%;background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.3);">Cloud-Daten verwerfen &amp; neu aufsetzen</button>' +
            '<button class="btn btn-outline" data-action="close-modal" style="width:100%;">Abbrechen</button>' +
          '</div>';
        App.showModal('Cloud-Daten verwerfen', body, '');
    }

    // Alle lokalen Sync-Metadaten wegräumen — Konflikt-Basis, Key-Meta, Blob-Cache und
    // Anker-Listen beziehen sich auf den verworfenen Stand. Blieben sie liegen, würde der
    // erste Sync mit dem neuen Schlüssel gegen eine Basis mergen, die es nicht mehr gibt.
    function _wipeLocalSyncState(uid) {
        var prefixes = ['oyi_sync_keymeta_', 'oyi_sync_base_', 'oyi_sync_blobcache_', 'oyi_sync_anchored_'];
        var doomed = [];
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (!k) continue;
            for (var p = 0; p < prefixes.length; p++) if (k.indexOf(prefixes[p]) === 0) { doomed.push(k); break; }
        }
        doomed.push(LS_CONFLICTS, LS_LAST_OK, LS_PENDING_DEL, LS_ANCHOR_CHECK, LS_ERR_TOAST, LS_KEY(uid));
        doomed.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
        _cryptoKeyCache = null; _cryptoKeyUid = null;
    }

    async function _finishReset() {
        var inp = document.getElementById('syncResetConfirm');
        var btn = document.getElementById('syncResetBtn');
        var typed = (inp ? inp.value : '').trim().toUpperCase().replace(/OE/g, 'Ö');
        if (typed !== 'LÖSCHEN') { Utils.showToast('Bitte LÖSCHEN eintippen, um zu bestätigen.', 'warning'); if (inp) inp.focus(); return; }
        var uid = _userId();
        if (!uid) { Utils.showToast('Bitte zuerst mit Whop anmelden.', 'warning'); return; }
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Verwerfe…'; }
        try {
            var res = await _api({ action: 'reset_all' });
            if (res.status !== 200) {
                Utils.showToast('Cloud-Daten konnten nicht verworfen werden (HTTP ' + res.status + '). Bitte später erneut versuchen.', 'error', 9000);
                if (btn) { btn.disabled = false; btn.textContent = 'Cloud-Daten verwerfen & neu aufsetzen'; }
                return;
            }
            // Anhänge mit aufräumen: ihre URLs standen nur im verworfenen Chiffrat, sonst
            // blieben sie unauffindbar im Blob-Store liegen. Best-effort — ein Fehler hier
            // darf den Neuaufbau nicht blockieren.
            var blobsOk = true;
            try { blobsOk = await BlobAttachments.purgeAll(); } catch (e) { blobsOk = false; }

            _wipeLocalSyncState(uid);
            localStorage.removeItem(LS_ENABLED);   // wird erst durch die Code-Bestätigung wieder gesetzt
            _setMismatch(false);
            if (!(await _mintKey(uid))) return;

            Utils.showToast('✅ Cloud-Daten verworfen' + (blobsOk ? '' : ' (Anhang-Aufräumung folgt später)') +
                            ' — hier ist dein NEUER Wiederherstellungscode.', 'success', 9000);
            await showCode(true);
        } catch (e) {
            console.warn('[CloudSync] reset error:', e && e.message);
            Utils.showToast('Zurücksetzen fehlgeschlagen — bitte Internetverbindung prüfen.', 'error', 8000);
            if (btn) { btn.disabled = false; btn.textContent = 'Cloud-Daten verwerfen & neu aufsetzen'; }
        }
    }

    // ========================================================================
    // Diagnose — beantwortet "warum synchronisiert es nicht?" ohne Konsole
    // ========================================================================
    async function diagnoseFlow() {
        App.showModal('Sync-Diagnose', '<div style="font-size:13px;color:var(--text-secondary);">⏳ Prüfe Anmeldung, Schlüssel und Cloud-Daten…</div>', '');
        var uid = _userId(), rows = [], plain = [], verdict = '', actions = '';
        function row(label, value, state) {
            var color = state === 'ok' ? 'var(--accent,#10b981)' : state === 'bad' ? 'var(--danger,#ef4444)' : state === 'warn' ? '#f59e0b' : 'var(--text-secondary)';
            rows.push('<tr><td style="padding:6px 10px 6px 0;color:var(--text-muted);white-space:nowrap;vertical-align:top;">' + _esc(label) + '</td>' +
                      '<td style="padding:6px 0;color:' + color + ';word-break:break-word;">' + _esc(value) + '</td></tr>');
            plain.push(label + ': ' + value);
        }

        row('Angemeldet als', uid || '— nicht angemeldet —', uid ? 'ok' : 'bad');
        var kb = await _keyBytes(uid);
        // Nur der Fingerabdruck (letzte zwei Gruppen), nicht der ganze Schlüssel: er reicht,
        // um zwei Schlüssel zu unterscheiden, taugt aber nicht zum Mitschreiben.
        row('Schlüssel auf diesem Gerät', kb ? ('vorhanden · endet auf ' + _groupCode(_toB32(kb)).split(' ').slice(-2).join(' ')) : 'keiner', kb ? 'ok' : 'warn');
        row('Cloud-Sync eingeschaltet', _enabled() ? 'ja' : 'nein', _enabled() ? 'ok' : 'warn');
        var lastOk = parseInt(localStorage.getItem(LS_LAST_OK) || '0', 10);
        row('Letzter erfolgreicher Sync', lastOk ? new Date(lastOk).toLocaleString('de-DE') : 'noch nie', lastOk && (Date.now() - lastOk) < HEALTHY_MAX_AGE_MS ? 'ok' : 'warn');

        if (!_token()) {
            row('Server', 'nicht abgefragt (nicht angemeldet)', 'bad');
            verdict = 'Ohne Whop-Anmeldung kann nicht synchronisiert werden. Bitte neu anmelden.';
        } else {
            var pull;
            try { pull = await _api({ action: 'pull', scope: '__account' }); }
            catch (e) { pull = { status: 0, json: {} }; }
            if (pull.status !== 200) {
                row('Server', pull.status === 403 ? 'Zugang verweigert (Pro-Abo/Whop)' : ('nicht erreichbar' + (pull.status ? ' — HTTP ' + pull.status : '')), 'bad');
                verdict = pull.status === 403
                    ? 'Der Server bestätigt kein aktives Abo für diesen Account. Prüfe deine Whop-Mitgliedschaft.'
                    : 'Der Sync-Server ist gerade nicht erreichbar. Deine Daten liegen lokal sicher; sobald die Verbindung steht, läuft der Sync von allein weiter.';
            } else if (!pull.json.blob) {
                row('Cloud-Daten', 'keine vorhanden', 'warn');
                verdict = _enabled() && kb
                    ? 'Es liegen noch keine Cloud-Daten. Beim nächsten Sync lädt dieses Gerät seinen Stand hoch.'
                    : 'Es liegen keine Cloud-Daten. Aktiviere Cloud-Sync, um zu starten.';
            } else {
                row('Cloud-Daten', _blobInfo(pull.json.blob), 'ok');
                if (!kb) {
                    row('Test-Entschlüsselung', 'nicht möglich — kein Schlüssel auf diesem Gerät', 'bad');
                    verdict = 'In der Cloud liegen Daten, dieses Gerät hat aber keinen Schlüssel. Verbinde es mit dem Wiederherstellungscode deines anderen Geräts.';
                    actions = '<button class="btn btn-primary" data-action="cs-connect" style="width:100%;">🔑 Wiederherstellungscode eingeben</button>' +
                              '<button class="btn btn-outline" data-action="cs-reset" style="width:100%;">🗑 Cloud-Daten verwerfen &amp; neu aufsetzen</button>';
                } else {
                    var probe = await _probeKey(pull.json.blob, kb);
                    if (probe === 'ok') {
                        row('Test-Entschlüsselung', 'erfolgreich — Schlüssel passt', 'ok');
                        _setMismatch(false);
                        verdict = _enabled()
                            ? 'Alles in Ordnung: Schlüssel und Cloud-Daten passen zusammen.'
                            : 'Schlüssel und Cloud-Daten passen zusammen — Cloud-Sync ist auf diesem Gerät nur ausgeschaltet.';
                    } else if (probe === 'unreachable') {
                        row('Test-Entschlüsselung', 'Chiffrat nicht ladbar (Netzwerk/Speicher)', 'warn');
                        verdict = 'Die ausgelagerten Cloud-Daten waren gerade nicht abrufbar. Das ist KEIN Schlüsselproblem — bitte später erneut prüfen.';
                    } else {
                        row('Test-Entschlüsselung', 'fehlgeschlagen — Schlüssel passt NICHT zu den Cloud-Daten', 'bad');
                        _setMismatch(true); _setDot('broken');
                        verdict = 'Gefunden: Die Cloud-Daten sind mit einem anderen Schlüssel verschlüsselt als dem dieses Geräts. ' +
                                  'Deshalb steht der Sync. Gib den Wiederherstellungscode des Geräts ein, das zuletzt erfolgreich synchronisiert hat — ' +
                                  'oder verwirf die Cloud-Daten und setze neu auf.';
                        actions = '<button class="btn btn-primary" data-action="cs-connect" style="width:100%;">🔑 Anderen Code eingeben</button>' +
                                  '<button class="btn btn-outline" data-action="cs-reset" style="width:100%;">🗑 Cloud-Daten verwerfen &amp; neu aufsetzen</button>';
                    }
                }
            }
        }

        var body =
          '<div style="display:flex;flex-direction:column;gap:14px;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>' + rows.join('') + '</tbody></table>' +
            '<div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;line-height:1.5;">' +
              '<strong>Ergebnis:</strong> ' + _esc(verdict) +
            '</div>' +
            actions +
            '<button class="btn btn-outline" data-action="cs-copy-diagnosis" style="width:100%;">📋 Bericht für den Support kopieren</button>' +
          '</div>';
        // Klartext-Fassung für den Support-Button (ohne HTML, ohne Schlüsselmaterial)
        window.__syncDiagnosis = 'Stackr Sync-Diagnose ' + new Date().toLocaleString('de-DE') + '\n' +
                                 plain.join('\n') + '\n\nErgebnis: ' + verdict;
        App.showModal('Sync-Diagnose', body, '');
    }
    function _copyDiagnosis() {
        try { navigator.clipboard.writeText(window.__syncDiagnosis || ''); Utils.showToast('Bericht kopiert', 'success'); }
        catch (e) { Utils.showToast('Kopieren nicht möglich — bitte Text markieren.', 'warning'); }
    }

    // ── Keep-Both-Konflikt-Dialog: pro Eintrag Fassung wählen ─────────────────
    function _recLabel(c) {
        var k = c.key, t = 'Eintrag';
        if (/reselling_purchases/.test(k)) t = 'Einkauf';
        else if (/reselling_sales/.test(k)) t = 'Verkauf';
        else if (/rechnungsbuch/.test(k)) t = 'Rechnung';
        else if (/eigenbelege/.test(k)) t = 'Eigenbeleg';
        return t + ' · ' + c.id;
    }
    function _recWhen(r) {
        var u = r && r.updatedAt; if (!u) return '(ohne Zeitstempel)';
        try { return '(' + new Date(u).toLocaleString('de-DE') + ')'; } catch (e) { return ''; }
    }
    function openConflicts() {
        var list = _loadConflicts();
        if (!list.length) { Utils.showToast('Keine offenen Sync-Konflikte.', 'info'); _setDot(_enabled() && _hasKey() ? 'ok' : 'off'); return; }
        var rows = list.map(function (c, i) {
            var mineNew = (c.mine.updatedAt || 0) >= (c.theirs.updatedAt || 0);
            return '<div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:10px;">' +
                '<div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">' + _esc(_recLabel(c)) + '</div>' +
                '<label style="display:block;font-size:13px;margin-bottom:4px;cursor:pointer;"><input type="radio" name="cf_' + i + '" value="mine" ' + (mineNew ? 'checked' : '') + '> Dieses Gerät ' + _esc(_recWhen(c.mine)) + '</label>' +
                '<label style="display:block;font-size:13px;cursor:pointer;"><input type="radio" name="cf_' + i + '" value="theirs" ' + (!mineNew ? 'checked' : '') + '> Anderes Gerät ' + _esc(_recWhen(c.theirs)) + '</label>' +
                '</div>';
        }).join('');
        var body =
          '<div style="display:flex;flex-direction:column;gap:8px;">' +
            '<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">' +
              'Diese Einträge wurden auf zwei Geräten <strong>gleichzeitig</strong> geändert. Wähle je Eintrag die Fassung, die behalten werden soll — <strong>beide</strong> sind bis dahin gesichert, es geht nichts verloren.' +
            '</div>' +
            rows +
            '<button class="btn btn-primary" data-action="cs-resolve-conflicts" style="width:100%;">Auswahl übernehmen</button>' +
          '</div>';
        App.showModal('Sync-Konflikte lösen (' + list.length + ')', body, '');
    }
    // Eine gewählte Fassung in den Store-Array schreiben (updatedAt=jetzt → gewinnt nächsten Sync)
    function _applyRecordChoice(key, rec) {
        var arr = Store._syncReadRaw(key);
        if (!Array.isArray(arr)) return;
        var stamped = Object.assign({}, rec, { updatedAt: Date.now() }), found = false;
        var out = arr.map(function (x) { if (x && x.id === rec.id) { found = true; return stamped; } return x; });
        if (!found) out.push(stamped);
        var ser = JSON.stringify(out);
        var isCacheKey = (key.indexOf('__reselling_') !== -1 || key.indexOf('__rechnungsbuch_') !== -1 || key.indexOf('__eigenbelege_') !== -1 || /__audit_log$/.test(key));
        if (isCacheKey && typeof Store !== 'undefined') { var o = {}; o[key] = ser; Store.syncApplyKeys(o); }
        else { try { localStorage.setItem(key, ser); } catch (e) {} }
    }
    function _resolveConflicts() {
        var list = _loadConflicts();
        list.forEach(function (c, i) {
            var sel = document.querySelector('input[name="cf_' + i + '"]:checked');
            var picked  = (sel && sel.value === 'theirs') ? c.theirs : c.mine;
            var current = (c.mine.updatedAt || 0) >= (c.theirs.updatedAt || 0) ? c.mine : c.theirs;
            // Nur schreiben, wenn die Wahl vom aktuell gespeicherten LWW-Gewinner abweicht
            if (JSON.stringify(picked) !== JSON.stringify(current)) _applyRecordChoice(c.key, picked);
        });
        _clearConflicts();
        App.closeModal();
        _setDot('sync');
        Utils.showToast('✅ Konflikte gelöst — synchronisiere…', 'success');
        _syncAll(false);
    }

    // ── Retry-Queue für fehlgeschlagene Löschungen (Redis + Blob) ─────────────
    // Art. 17 DSGVO verlangt eine BESTÄTIGTE Löschung — ein HTTP-Fehler beim Löschen darf nie
    // stillschweigend als Erfolg durchgehen. Fehlgeschlagene Löschungen werden hier vermerkt und
    // bei jedem CloudSync.init()/_syncAll() automatisch erneut versucht.
    var LS_PENDING_DEL = 'oyi_sync_pending_deletions';
    function _loadPendingDeletions() { try { return JSON.parse(localStorage.getItem(LS_PENDING_DEL) || '[]'); } catch (e) { return []; } }
    function _savePendingDeletions(list) { try { localStorage.setItem(LS_PENDING_DEL, JSON.stringify(list)); } catch (e) {} }
    function _queuePendingDeletion(entry) {
        var list = _loadPendingDeletions();
        list.push(Object.assign({ ts: Date.now() }, entry));
        _savePendingDeletions(list);
    }
    async function retryPendingDeletions() {
        if (!_token()) return;
        var list = _loadPendingDeletions();
        if (!list.length) return;
        var remaining = [];
        for (var i = 0; i < list.length; i++) {
            var e = list[i], ok = false;
            try {
                if (e.kind === 'redis') {
                    var res = await _api({ action: 'delete', scope: e.scope });
                    ok = (res.status === 200 || res.status === 404);
                } else if (e.kind === 'blob') {
                    ok = await BlobAttachments.deleteUrls(e.scope, e.urls);
                }
            } catch (err) { ok = false; }
            if (!ok) remaining.push(e);
        }
        if (remaining.length !== list.length) _savePendingDeletions(remaining);
    }

    // ── Art. 17 DSGVO: verschlüsselten Cloud-Snapshot eines Scopes löschen ────
    // Wird von "Geschäftsdaten löschen" aufgerufen, damit gelöschte Daten nicht
    // beim nächsten Sync aus der Cloud zurückgeholt werden (sonst LWW-Merge-Falle).
    // Rückgabe true bedeutet: Redis-Snapshot UND alle Blob-Anhänge bestätigt gelöscht. Bei
    // false wurde die Löschung in die Retry-Queue eingereiht (kein stiller "Erfolg" trotz Fehler).
    async function deleteRemote(scope) {
        if (!_enabled() || !_hasKey() || !_token()) return true; // Cloud-Sync nicht aktiv → nichts zu löschen
        var blobOk = true;
        try {
            // Art. 17 DSGVO muss auch ausgelagerte Anhänge (Blob-Objekte) erfassen —
            // vor dem Löschen des Redis-Keys den aktuellen Stand pullen und alle
            // referenzierten Blob-URLs (Ledger-Overflow + Feld-Anhänge) einsammeln.
            try {
                var cur = await _api({ action: 'pull', scope: scope });
                if (cur.status === 200 && cur.json.blob) {
                    var urls = [];
                    if (cur.json.blob.blobUrl) urls.push(cur.json.blob.blobUrl);
                    var data = await _decrypt(cur.json.blob, scope).catch(function () { return null; });
                    if (data && data.keys) _collectBlobRefs(data.keys, urls);
                    if (urls.length) {
                        blobOk = await BlobAttachments.deleteUrls(scope, urls);
                        if (!blobOk) _queuePendingDeletion({ kind: 'blob', scope: scope, urls: urls });
                    }
                }
            } catch (e) {
                console.warn('[CloudSync] Anhang-Cleanup vor Löschung fehlgeschlagen:', e && e.message);
                blobOk = false;
            }

            var redisOk;
            try {
                var delRes = await _api({ action: 'delete', scope: scope });
                redisOk = (delRes.status === 200 || delRes.status === 404);
            } catch (e) { redisOk = false; }
            if (!redisOk) _queuePendingDeletion({ kind: 'redis', scope: scope });

            // Lokale Sync-Metadaten IMMER aufräumen (auch bei Fehlschlag) — die Retry-Queue sorgt
            // fürs Nachholen server-seitig, lokale Reste dürfen den nächsten Sync nicht blockieren.
            localStorage.removeItem(LS_META(scope));
            localStorage.removeItem(LS_BASE(scope));
            localStorage.removeItem(LS_BLOBCACHE(scope));
            localStorage.removeItem(LS_ANCHORED(scope));
            return redisOk && blobOk;
        } catch (e) {
            console.warn('[CloudSync] deleteRemote error:', e && e.message);
            _queuePendingDeletion({ kind: 'redis', scope: scope });
            return false;
        }
    }
    // Sammelt alle { __blobref__ } URLs aus einem keys-Objekt (Records + einzelne Objekte) ein.
    function _collectBlobRefs(keys, out) {
        function visit(obj) {
            if (!obj || typeof obj !== 'object') return;
            for (var f in obj) { var v = obj[f]; if (v && typeof v === 'object' && v.__blobref__ && v.url) out.push(v.url); }
        }
        Object.keys(keys).forEach(function (k) {
            var v = keys[k];
            if (Array.isArray(v)) v.forEach(visit); else visit(v);
        });
    }

    // ── Steuerberater: fremde (Mandanten-)Daten read-only laden ───────────────
    // Rohschlüssel des aktuellen Nutzers (zum Verpacken für einen StB). Nur wenn Sync aktiv.
    // Gibt jetzt ein Promise zurück (IndexedDB, Fund R5). Aufrufer: js/stb-share.js.
    function keyBytes() { return _keyBytes(); }
    function hasKey() { return _hasKey(); }

    // Mit dem entpackten Envelope-Schlüssel die Firmen eines Mandanten pullen,
    // entschlüsseln und lokal als READ-ONLY-Client-Firmen ablegen (Registry-Merge).
    // Wird NIE zurückgepusht (siehe _readonly-Skip in _syncAll + onLocalChange).
    async function foreignLoad(ownerId, kb) {
        var reg = await _api({ action: 'pull', scope: '__account', owner: ownerId });
        if (reg.status === 403) throw new Error('no_grant');
        if (reg.status !== 200) throw new Error('pull_' + reg.status);
        var regObj = reg.json.blob ? await _decrypt(reg.json.blob, '__account', ownerId, kb) : null;
        var ownerCos = (regObj && regObj.keys && regObj.keys.oyi_companies) ? regObj.keys.oyi_companies : [];
        // Kollisionsschutz: IDs eigener (Nicht-Readonly-)Firmen nie überschreiben
        var ownIds = {}; try { JSON.parse(localStorage.getItem('oyi_companies') || '[]').forEach(function (c) { if (c && c.id && !c._readonly) ownIds[c.id] = 1; }); } catch (e) {}
        var clientCos = [], skipped = 0;
        for (var i = 0; i < ownerCos.length; i++) {
            var co = ownerCos[i]; if (!co || !co.id) continue;
            if (ownIds[co.id]) { skipped++; continue; }   // ID-Kollision mit eigener Firma → auslassen
            var p = await _api({ action: 'pull', scope: co.id, owner: ownerId });
            if (p.status !== 200 || !p.json.blob) continue;
            var data = await _decrypt(p.json.blob, co.id, ownerId, kb);   // { keys, meta }
            await BlobAttachments.hydrateFields(data.keys, function (ct, iv) { return _decryptBytes(ct, iv, co.id, ownerId, kb); });
            var toCache = {};
            Object.keys(data.keys || {}).forEach(function (k) {
                var ser = JSON.stringify(data.keys[k]);
                var isCacheKey = (k.indexOf('__reselling_') !== -1 || k.indexOf('__rechnungsbuch_') !== -1 || k.indexOf('__eigenbelege_') !== -1 || /__audit_log$/.test(k));
                if (isCacheKey) toCache[k] = ser; else { try { localStorage.setItem(k, ser); } catch (e) {} }
            });
            if (Object.keys(toCache).length && typeof Store !== 'undefined') Store.syncApplyKeys(toCache);
            // Fremde Firmenfelder landen ungeprüft im eigenen localStorage (Klartext-Ursprung ist
            // der Mandant, nicht der Server) — farbe wird überall als CSS-Wert interpoliert, daher
            // hier hart auf gültiges Hex whitelisten statt erst beim Rendern zu filtern.
            var safeCo = Object.assign({}, co, { _readonly: true, _clientOf: ownerId });
            if (!/^#[0-9a-fA-F]{6}$/.test(safeCo.farbe)) safeCo.farbe = '#10b981';
            clientCos.push(safeCo);
        }
        // Registry mergen — eigene Firmen NICHT überschreiben (Client-IDs sind eigenständig)
        var mine = []; try { mine = JSON.parse(localStorage.getItem('oyi_companies') || '[]'); } catch (e) {}
        var byId = {}; mine.forEach(function (c) { if (c && c.id) byId[c.id] = c; });
        clientCos.forEach(function (c) { byId[c.id] = c; });
        localStorage.setItem('oyi_companies', JSON.stringify(Object.keys(byId).map(function (id) { return byId[id]; })));
        if (skipped) {
            console.warn('[CloudSync] ' + skipped + ' Mandanten-Firma(en) wegen ID-Kollision mit eigener Firma ausgelassen');
            if (typeof Utils !== 'undefined') Utils.showToast(skipped + ' Mandanten-Firma(en) konnten wegen einer ID-Kollision mit einer eigenen Firma nicht geladen werden.', 'warning', 7000);
        }
        return clientCos;
    }

    // Read-only-Client-Firmen + deren Scope-Keys wieder entfernen (Privacy beim Verlassen)
    function foreignUnload() {
        var mine = []; try { mine = JSON.parse(localStorage.getItem('oyi_companies') || '[]'); } catch (e) {}
        var keep = [], drop = [];
        mine.forEach(function (c) { if (c && c._readonly) drop.push(c.id); else keep.push(c); });
        drop.forEach(function (id) {
            _scopeKeys(id).forEach(function (k) {
                try { localStorage.removeItem(k); } catch (e) {}
                if (typeof Store !== 'undefined' && Store._cache) delete Store._cache[k];
                if (typeof Store !== 'undefined' && Store._idbDelete) { try { Store._idbDelete(k); } catch (e) {} }
            });
            try { localStorage.removeItem(LS_BASE(id)); localStorage.removeItem(LS_META(id)); } catch (e) {}
        });
        localStorage.setItem('oyi_companies', JSON.stringify(keep));
        return drop.length;
    }

    // ── Health-Check für lokale Backup-Hinweise ───────────────────────────────
    // "Gesund" heißt: aktiv, entschlüsselbar, Pro, keine offenen Konflikte UND
    // erst kürzlich erfolgreich synchronisiert (nicht bloß "aktiviert, aber tot").
    // Nur dann dürfen die lokalen Backup-Nudges in app.js unterdrückt werden —
    // sonst könnte ein hängender/fehlerhafter Sync unbemerkt zum einzigen (und
    // stillen) Ausfallpunkt werden.
    function isHealthy() {
        if (!_enabled() || !_hasKey() || !_isPro() || !_token()) return false;
        if (_hasMismatch()) return false;   // Cloud-Kopie existiert, ist aber unlesbar → lokale Backup-Hinweise MÜSSEN wieder erscheinen
        if (_loadConflicts().length) return false;
        var last = parseInt(localStorage.getItem(LS_LAST_OK) || '0', 10);
        if (!last) return false;
        return (Date.now() - last) < HEALTHY_MAX_AGE_MS;
    }

    // ── Audit-Trail gegen den externen Server-Anker prüfen (aktive Firma) ────
    // Ergebnis dient protokoll.js: enabled=false → kein Cloud-Sync aktiv, keine
    // externe Beweisführung möglich (nur die reine In-Memory-Kette prüfbar).
    async function verifyAuditAnchors() {
        if (!_enabled() || !_hasKey() || !_isPro() || !_token()) return { enabled: false };
        var scope = _activeScope();
        if (!scope) return { enabled: false };
        var res = await _api({ action: 'anchor_pull', scope: scope });
        if (res.status !== 200) return { enabled: true, error: true };
        var byId = {};
        (res.json.anchors || []).forEach(function (a) { (byId[a.id] = byId[a.id] || []).push(a.h); });
        var log = (typeof Store !== 'undefined') ? Store.getAuditLog() : [];
        var okCount = 0, notAnchored = 0, mismatches = [];
        for (var i = 0; i < log.length; i++) {
            var e = log[i], hashes = byId[e.id];
            if (!hashes) { notAnchored++; continue; }
            var uniq = Array.from(new Set(hashes));
            var h = await Store._auditContentHash(e);
            if (uniq.length === 1 && uniq[0] === h) okCount++; else mismatches.push(e.id);
        }
        return { enabled: true, total: log.length, ok: okCount, notAnchored: notAnchored, mismatches: mismatches };
    }

    // Taegliche automatische Anker-Pruefung (statt nur auf Klick im Protokoll-Modul) —
    // damit eine Abweichung auffaellt, auch wenn niemand aktiv "Integritaet pruefen" klickt.
    async function _maybeAutoVerifyAnchors() {
        var last = parseInt(localStorage.getItem(LS_ANCHOR_CHECK) || '0', 10);
        if (last && (Date.now() - last) < ANCHOR_CHECK_INTERVAL_MS) return;
        try { localStorage.setItem(LS_ANCHOR_CHECK, String(Date.now())); } catch (e) {}
        try {
            var res = await verifyAuditAnchors();
            if (res.enabled && !res.error && res.mismatches && res.mismatches.length && typeof Utils !== 'undefined') {
                Utils.showToast(
                    '⚠ Audit-Log: ' + res.mismatches.length + ' Eintrag/Einträge weichen vom Cloud-Anker ab (Manipulationsverdacht) — Details im Modul „Protokoll“.',
                    'error', 12000
                );
            }
        } catch (e) { /* best-effort, keine Fehlermeldung noetig */ }
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
        resetFlow: resetFlow,
        diagnoseFlow: diagnoseFlow,
        showCode: function () { return showCode(false); },
        syncNow: syncNow,
        openConflicts: openConflicts,
        keyBytes: keyBytes,
        hasKey: hasKey,
        isHealthy: isHealthy,
        verifyAuditAnchors: verifyAuditAnchors,
        foreignLoad: foreignLoad,
        foreignUnload: foreignUnload,
        deleteRemote: deleteRemote,
        retryPendingDeletions: retryPendingDeletions,
        _finishEnable: _finishEnable,
        _finishConnect: _finishConnect,
        _finishDisable: _finishDisable,
        _finishReset: _finishReset,
        _copyDiagnosis: _copyDiagnosis,
        _resolveConflicts: _resolveConflicts,
        _copyCode: _copyCode,
        _downloadCode: _downloadCode,
        // Test-Oberfläche für reine Merge-/Code-Logik (siehe test-cloud-sync.js)
        _test: { mergeRecords: _mergeRecords, mergeAudit: _mergeAudit, merge: _merge, toB32: _toB32, fromB32: _fromB32,
            loadPendingDeletions: _loadPendingDeletions, queuePendingDeletion: _queuePendingDeletion,
            probeKey: _probeKey, classifyDecryptError: _classifyDecryptError,
            hasMismatch: _hasMismatch, setMismatch: _setMismatch, encrypt: _encrypt, b64: _b64 }
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
    'cs-show-code':      function () { Promise.resolve(CloudSync.showCode()).catch(function (e) { console.warn('[CloudSync] showCode:', e && e.message); }); },
    'cs-sync-now':       function () { CloudSync.syncNow(); },
    'cs-disable':        function () { CloudSync.disableFlow(); },
    'cs-enable':         function () { Promise.resolve(CloudSync.enableFlow()).catch(function (e) { console.warn('[CloudSync] enable:', e && e.message); }); },
    'cs-connect':        function () { CloudSync.connectFlow(); },
    'cs-reset':          function () { CloudSync.resetFlow(); },
    'cs-finish-reset':   function () { Promise.resolve(CloudSync._finishReset()).catch(function (e) { console.warn('[CloudSync] reset:', e && e.message); }); },
    'cs-diagnose':       function () { Promise.resolve(CloudSync.diagnoseFlow()).catch(function (e) { console.warn('[CloudSync] diagnose:', e && e.message); }); },
    'cs-copy-diagnosis': function () { CloudSync._copyDiagnosis(); },
    'cs-finish-enable':  function () { Promise.resolve(CloudSync._finishEnable()).catch(function (e) { console.warn('[CloudSync] finishEnable:', e && e.message); }); },
    'cs-copy-code':      function () { CloudSync._copyCode(); },
    'cs-download-code':  function () { CloudSync._downloadCode(); },
    'cs-finish-connect': function () { CloudSync._finishConnect(); },
    'cs-finish-disable': function () { CloudSync._finishDisable(); },
    'cs-resolve-conflicts': function () { CloudSync._resolveConflicts(); }
});
