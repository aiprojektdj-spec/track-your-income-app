// ============================================
// Store - IndexedDB Data Layer (GoBD-konform)
// Hauptspeicher: IndexedDB (mehrere GB möglich)
// Fallback: localStorage (5-10 MB, falls IDB fehlt)
// ============================================
const Store = {
    _companyId: '',   // wird von CompanyManager.switchTo() / Store.setCompany() gesetzt

    get _prefix()     { return (this._companyId ? this._companyId + '__' : '') + 'reselling_'; },
    get _rechPrefix() { return (this._companyId ? this._companyId + '__' : '') + 'rechnungsbuch_'; },
    get _auditKey()   { return (this._companyId ? this._companyId + '__' : '') + 'audit_log'; },
    // Eigenbelege liegen company-präfixiert in localStorage (z.B. co_xxx__eigenbelege_belege)
    get _ebKeyPrefix(){ return (this._companyId ? this._companyId + '__' : ''); },

    // ============================================
    // Haupt-Datenspeicher: IndexedDB Key-Value
    // ============================================
    MAIN_IDB_NAME: 'oyi_maindata',
    MAIN_IDB_KV: 'keyval',
    _mainIdb: null,
    _mainIdbReady: false,
    _cache: {},   // In-Memory-Cache für synchrone reads

    // Fordert "persistenten" Speicher vom Browser an.
    // Ohne persist() darf Chrome/Edge IndexedDB bei Speicherdruck JEDERZEIT löschen.
    // Mit persist() ist der Speicher dauerhaft geschützt — genau wie installierte Apps.
    async requestPersistentStorage() {
        if (!navigator.storage || !navigator.storage.persist) return false;
        try {
            const already = await navigator.storage.persisted();
            if (already) return true;
            const granted = await navigator.storage.persist();
            console.log('[Store] Persistenter Speicher:', granted ? 'gewährt ✅' : 'abgelehnt ⚠️');
            return granted;
        } catch(e) { return false; }
    },

    // Gibt den aktuellen Speicherstatus zurück { persisted, quota, usage, usagePct }
    async getStorageEstimate() {
        if (!navigator.storage || !navigator.storage.estimate) return null;
        try {
            const [est, persisted] = await Promise.all([
                navigator.storage.estimate(),
                navigator.storage.persisted()
            ]);
            const usage   = est.usage   || 0;
            const quota   = est.quota   || 0;
            const usagePct = quota > 0 ? ((usage / quota) * 100).toFixed(1) : '?';
            return { persisted, quota, usage, usagePct };
        } catch(e) { return null; }
    },

    initMainIDB() {
        // Persistenten Speicher sofort anfordern — schützt vor Browser-Bereinigung
        this.requestPersistentStorage();

        return new Promise((resolve) => {
            if (!window.indexedDB) {
                this._loadCacheFromLS();
                resolve();
                return;
            }
            const req = indexedDB.open(this.MAIN_IDB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.MAIN_IDB_KV)) {
                    db.createObjectStore(this.MAIN_IDB_KV, { keyPath: 'k' });
                }
            };
            req.onsuccess = (e) => {
                this._mainIdb = e.target.result;
                this._mainIdbReady = true;
                this._loadCacheFromMainIDB().then(() => {
                    // IDB-Lücken aus localStorage schließen (z.B. Eigenbeleg-Fallback)
                    // Ergänzt fehlende Keys aus localStorage, ohne IDB-Daten zu überschreiben
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (k && this._isCacheableKey(k) && !this._cache[k]) {
                            this._cache[k] = localStorage.getItem(k);
                        }
                    }
                    this._migrateFromLS();
                    resolve();
                });
            };
            req.onerror = () => {
                this._loadCacheFromLS();
                resolve();
            };
        });
    },

    _loadCacheFromMainIDB() {
        return new Promise((resolve) => {
            try {
                const tx = this._mainIdb.transaction(this.MAIN_IDB_KV, 'readonly');
                const req = tx.objectStore(this.MAIN_IDB_KV).getAll();
                req.onsuccess = () => {
                    (req.result || []).forEach(entry => { this._cache[entry.k] = entry.v; });
                    resolve();
                };
                req.onerror = () => resolve();
            } catch(e) { resolve(); }
        });
    },

    _loadCacheFromLS() {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && this._isCacheableKey(k)) {
                this._cache[k] = localStorage.getItem(k);
            }
        }
    },

    _isCacheableKey(k) {
        // Legacy-Format (ohne Firma-Prefix)
        if (k.startsWith('reselling_') || k.startsWith('rechnungsbuch_') || k === 'audit_log') return true;
        // Multi-Firmen-Format: co_xxx__reselling_* etc.
        if (k.startsWith('co_')) {
            const rest = k.replace(/^co_[a-z0-9_]+__/, '');
            return rest.startsWith('reselling_') || rest.startsWith('rechnungsbuch_') || rest === 'audit_log';
        }
        return false;
    },

    _migrateFromLS() {
        if (this._cache['_idb_migrated']) return;
        let moved = false;
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && this._isCacheableKey(k)) {
                if (!this._cache[k]) {
                    const v = localStorage.getItem(k);
                    this._cache[k] = v;
                    this._idbPut(k, v);
                    moved = true;
                }
            }
        }
        this._cache['_idb_migrated'] = '"1"';
        this._idbPut('_idb_migrated', '"1"');
        if (moved) console.log('[Store] localStorage → IndexedDB Migration abgeschlossen');
    },

    _idbPut(key, valueStr) {
        if (!this._mainIdbReady || !this._mainIdb) return;
        try {
            const tx = this._mainIdb.transaction(this.MAIN_IDB_KV, 'readwrite');
            const req = tx.objectStore(this.MAIN_IDB_KV).put({ k: key, v: valueStr });
            req.onerror = (ev) => {
                const err = ev.target && ev.target.error;
                console.error('[Store] IDB-Put fehlgeschlagen:', key, err);
                if (err && err.name === 'QuotaExceededError') {
                    // Speicher voll: erst Auto-Backup-Snapshots bereinigen, dann Retry
                    this._emergencyPruneSnapshots(3).then(() => {
                        try {
                            const tx2 = this._mainIdb.transaction(this.MAIN_IDB_KV, 'readwrite');
                            const req2 = tx2.objectStore(this.MAIN_IDB_KV).put({ k: key, v: valueStr });
                            req2.onerror = () => {
                                // Auch nach Bereinigung voll — kritischer Fehler
                                if (typeof Utils !== 'undefined' && Utils.showToast) {
                                    Utils.showToast('🚨 Speicher kritisch voll! Daten konnten nicht gespeichert werden. Bitte sofort Backup erstellen und Daten bereinigen.', 'error', 12000);
                                }
                            };
                            tx2.oncomplete = () => {
                                if (typeof Utils !== 'undefined' && Utils.showToast) {
                                    Utils.showToast('🧹 Speicher war voll — alte Auto-Backups bereinigt. Daten wurden gespeichert.', 'info', 5000);
                                }
                            };
                        } catch(e2) {}
                    });
                } else if (err) {
                    if (typeof Utils !== 'undefined' && Utils.showToast) {
                        Utils.showToast(`⚠️ Speicher-Fehler: ${err.name || 'Unbekannt'}`, 'error');
                    }
                }
            };
            tx.onerror = (ev) => {
                console.error('[Store] IDB-Transaktion abgebrochen:', key, ev.target && ev.target.error);
            };
        } catch(e) {
            console.error('[Store] _idbPut Exception:', key, e);
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast(`⚠️ Speicher-Fehler: ${e.message || e.name}`, 'error');
            }
        }
    },

    _idbDelete(key) {
        if (!this._mainIdbReady || !this._mainIdb) return;
        try {
            const tx = this._mainIdb.transaction(this.MAIN_IDB_KV, 'readwrite');
            tx.objectStore(this.MAIN_IDB_KV).delete(key);
        } catch(e) {}
    },

    // ── Promise-basierter Schreibvorgang (für Bulk-Saves & Verifizierung) ──
    _idbPutAsync(key, valueStr) {
        return new Promise((resolve, reject) => {
            if (!this._mainIdbReady || !this._mainIdb) {
                return reject(new Error('IndexedDB nicht bereit'));
            }
            try {
                const tx = this._mainIdb.transaction(this.MAIN_IDB_KV, 'readwrite');
                tx.objectStore(this.MAIN_IDB_KV).put({ k: key, v: valueStr });
                tx.oncomplete = () => resolve(true);
                tx.onerror    = (ev) => reject((ev.target && ev.target.error) || new Error('Transaktion fehlgeschlagen'));
                tx.onabort    = (ev) => reject((ev.target && ev.target.error) || new Error('Transaktion abgebrochen'));
            } catch (e) {
                reject(e);
            }
        });
    },

    // Wie set(), aber liefert ein Promise das erst nach erfolgreichem IDB-Schreibvorgang resolved
    async setAsync(key, value) {
        const fullKey = this._prefix + key;
        const str = JSON.stringify(value);
        this._cache[fullKey] = str;
        try {
            await this._idbPutAsync(fullKey, str);
        } catch (err) {
            // Cache zurücksetzen falls Schreibvorgang fehlgeschlagen ist? Nein —
            // Cache ist Source of Truth in dieser Session, aber User bekommt Fehler
            console.error('[Store] setAsync fehlgeschlagen:', key, err);
            const errName = err && err.name;
            if (errName === 'QuotaExceededError') {
                throw new Error('Speicher voll — bitte alte Daten/Fotos entfernen oder Backup machen');
            }
            throw err;
        }
        this._triggerAutoBackup();
        return true;
    },

    // ============================================
    // IndexedDB Auto-Backup (nach jeder Änderung)
    // ============================================
    _idb: null,
    _idbReady: false,
    _autoBackupDebounce: null,
    _isImporting: false,
    IDB_NAME: 'oyi_autobackup',
    IDB_STORE: 'snapshots',
    IDB_MAX_SNAPSHOTS: 20,

    initIDB() {
        if (!window.indexedDB || this._idbInit) return;
        this._idbInit = true;
        const req = indexedDB.open(this.IDB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(this.IDB_STORE)) {
                const os = db.createObjectStore(this.IDB_STORE, { keyPath: 'id' });
                os.createIndex('ts', 'ts', { unique: false });
            }
        };
        req.onsuccess = (e) => {
            this._idb = e.target.result;
            this._idbReady = true;
        };
        req.onerror = () => {};
        // OPFS parallel initialisieren (kein Blocking)
        this._initOpfs().catch(() => {});
    },

    // ============================================
    // OPFS — Origin Private File System
    // Schneller, quota-freier Snapshot-Speicher
    // Snapshots werden gzip-komprimiert (~85% kleiner)
    // Fallback: IDB wenn OPFS nicht verfügbar
    // ============================================
    _opfsReady: false,
    _opfsDir:   null,

    async _initOpfs() {
        try {
            if (typeof navigator.storage?.getDirectory !== 'function') return;
            const root = await navigator.storage.getDirectory();
            this._opfsDir  = await root.getDirectoryHandle('oyi_autobackup', { create: true });
            this._opfsReady = true;
            console.log('[Store] OPFS bereit ✅');
        } catch(e) {
            this._opfsReady = false;
            console.log('[Store] OPFS nicht verfügbar, nutze IDB:', e.message);
        }
    },

    // gzip-Komprimierung (CompressionStream, alle modernen Browser)
    async _compress(str) {
        if (typeof CompressionStream === 'undefined') {
            // Fallback: unkomprimiert als UTF-8
            return new TextEncoder().encode(str).buffer;
        }
        const cs = new CompressionStream('gzip');
        const writer = cs.writable.getWriter();
        writer.write(new TextEncoder().encode(str));
        writer.close();
        return new Response(cs.readable).arrayBuffer();
    },

    async _decompress(buffer, isGzip) {
        if (!isGzip || typeof DecompressionStream === 'undefined') {
            return new TextDecoder().decode(buffer);
        }
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(buffer);
        writer.close();
        return new Response(ds.readable).text();
    },

    // Snapshot in OPFS schreiben (komprimiert)
    async _writeOpfsSnapshot(data) {
        const id  = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const ts  = new Date().toISOString();
        const isGz = typeof CompressionStream !== 'undefined';
        const filename = `snap_${id}${isGz ? '.json.gz' : '.json'}`;
        const compressed = await this._compress(data);
        const fh = await this._opfsDir.getFileHandle(filename, { create: true });
        const writable = await fh.createWritable();
        await writable.write(compressed);
        await writable.close();
        return { id: filename, ts, filename, size: compressed.byteLength };
    },

    // Alle OPFS-Snapshots auflisten (neueste zuerst)
    async _listOpfsSnapshots() {
        if (!this._opfsReady || !this._opfsDir) return [];
        const results = [];
        for await (const [name, handle] of this._opfsDir.entries()) {
            if (!name.startsWith('snap_')) continue;
            try {
                const file = await handle.getFile();
                results.push({
                    id:         name,         // Dateiname = ID für Restore
                    filename:   name,
                    ts:         new Date(file.lastModified).toISOString(),
                    size:       file.size,
                    compressed: name.endsWith('.gz'),
                    _opfs:      true,
                });
            } catch(e) {}
        }
        return results.sort((a, b) => b.ts.localeCompare(a.ts));
    },

    // OPFS-Snapshot lesen + dekomprimieren
    async _readOpfsSnapshot(filename) {
        const fh  = await this._opfsDir.getFileHandle(filename);
        const file = await fh.getFile();
        const buf  = await file.arrayBuffer();
        return this._decompress(buf, filename.endsWith('.gz'));
    },

    // Alte OPFS-Snapshots löschen (nur die neuesten `keep` behalten)
    async _pruneOpfsSnapshots(keep) {
        const snaps    = await this._listOpfsSnapshots();
        const toDelete = snaps.slice(keep);
        for (const snap of toDelete) {
            try { await this._opfsDir.removeEntry(snap.filename); } catch(e) {}
        }
    },

    // ============================================
    // File System Backup (File System Access API)
    // Schreibt ZIP-Dateien in einen vom User gewählten Ordner
    // ============================================

    // CRC-32 Lookup-Tabelle (einmalig beim Laden berechnet)
    _crc32Table: (() => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c;
        }
        return t;
    })(),

    _crc32(buf) {
        let c = 0xFFFFFFFF;
        const t = this._crc32Table;
        for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    },

    // Erstellt eine ZIP-Datei (single file) aus einem JSON-String
    // innerFilename = Dateiname innerhalb des ZIPs (z.B. "backup_..._auto.json")
    async _createZip(innerFilename, content) {
        const enc  = new TextEncoder();
        const name = enc.encode(innerFilename);
        const raw  = enc.encode(content);
        const crc  = this._crc32(raw);
        const uncompSize = raw.length;

        // Deflate-Raw (ZIP-Format erwartet kein zlib-Header/Trailer)
        let comp = raw;          // Fallback: stored (method 0)
        let method = 0;
        try {
            const cs = new CompressionStream('deflate-raw');
            const w  = cs.writable.getWriter();
            w.write(raw); w.close();
            const chunks = [], r = cs.readable.getReader();
            for (;;) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
            const total = chunks.reduce((s, c) => s + c.length, 0);
            comp = new Uint8Array(total);
            let off = 0;
            for (const c of chunks) { comp.set(c, off); off += c.length; }
            method = 8;  // deflate
        } catch(e) { /* Fallback: stored */ }

        const compSize = comp.length;

        // DOS-Zeitstempel
        const now = new Date();
        const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
        const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

        // Little-endian helper
        const u16 = v => [v & 0xFF, (v >> 8) & 0xFF];
        const u32 = v => [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF];

        // Local File Header (30 + nameLen bytes)
        const lhLen = 30 + name.length;
        const lh = new Uint8Array([
            0x50, 0x4B, 0x03, 0x04,
            ...u16(20), ...u16(0),
            ...u16(method), ...u16(dosTime), ...u16(dosDate),
            ...u32(crc), ...u32(compSize), ...u32(uncompSize),
            ...u16(name.length), ...u16(0),
            ...name,
        ]);

        // Central Directory Header (46 + nameLen bytes)
        const cdh = new Uint8Array([
            0x50, 0x4B, 0x01, 0x02,
            ...u16(20), ...u16(20), ...u16(0),
            ...u16(method), ...u16(dosTime), ...u16(dosDate),
            ...u32(crc), ...u32(compSize), ...u32(uncompSize),
            ...u16(name.length), ...u16(0), ...u16(0),
            ...u16(0), ...u16(0), ...u32(0),
            ...u32(0),   // local header offset = 0 (erste Datei)
            ...name,
        ]);

        // End of Central Directory (22 bytes)
        const cdOffset = lh.length + compSize;
        const eocd = new Uint8Array([
            0x50, 0x4B, 0x05, 0x06,
            ...u16(0), ...u16(0), ...u16(1), ...u16(1),
            ...u32(cdh.length), ...u32(cdOffset),
            ...u16(0),
        ]);

        // Zusammenbauen
        const zip = new Uint8Array(lh.length + compSize + cdh.length + eocd.length);
        let pos = 0;
        zip.set(lh, pos);   pos += lh.length;
        zip.set(comp, pos); pos += compSize;
        zip.set(cdh, pos);  pos += cdh.length;
        zip.set(eocd, pos);
        return zip;
    },

    // Liest die erste Datei aus einem ZIP-ArrayBuffer und gibt den Textinhalt zurück
    async _unzipFirstFile(buffer) {
        const v = new DataView(buffer);
        if (v.getUint32(0, true) !== 0x04034B50) throw new Error('Ungültige ZIP-Datei');
        const method    = v.getUint16(8,  true);
        const compSize  = v.getUint32(18, true);
        const nameLen   = v.getUint16(26, true);
        const extraLen  = v.getUint16(28, true);
        const dataStart = 30 + nameLen + extraLen;
        const compData  = new Uint8Array(buffer, dataStart, compSize);

        if (method === 0) return new TextDecoder().decode(compData);  // stored

        const ds = new DecompressionStream('deflate-raw');
        const w  = ds.writable.getWriter();
        w.write(compData); w.close();
        const chunks = [], r = ds.readable.getReader();
        for (;;) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
        const total = chunks.reduce((s, c) => s + c.length, 0);
        const out = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { out.set(c, off); off += c.length; }
        return new TextDecoder().decode(out);
    },

    _fsDirHandle: null,
    _fsHandleIdb: null,
    _fsPending: false,   // verhindert parallele Schreibvorgänge

    // Einmalig aufrufen beim App-Start — stellt gespeicherten Handle wieder her
    initFileSystemBackup() {
        return new Promise((resolve) => {
            if (!window.indexedDB) { resolve(null); return; }
            const req = indexedDB.open('oyi_fs_handles', 1);
            req.onupgradeneeded = (e) => {
                e.target.result.createObjectStore('handles', { keyPath: 'k' });
            };
            req.onsuccess = async (e) => {
                this._fsHandleIdb = e.target.result;
                const handle = await this._loadFsHandle();
                if (handle) {
                    // Berechtigung ohne User-Geste prüfen (Ergebnis: granted/prompt)
                    try {
                        const perm = await handle.queryPermission({ mode: 'readwrite' });
                        if (perm === 'granted') {
                            this._fsDirHandle = handle;
                            console.log('[Store] Datei-Backup aktiv →', handle.name);
                        }
                        // Bei 'prompt': Handle gemerkt, aber erst nach User-Klick wird berechtigt
                    } catch(e) {}
                }
                resolve(this._fsDirHandle);
            };
            req.onerror = () => resolve(null);
        });
    },

    _loadFsHandle() {
        return new Promise((resolve) => {
            if (!this._fsHandleIdb) { resolve(null); return; }
            try {
                const tx = this._fsHandleIdb.transaction('handles', 'readonly');
                const req = tx.objectStore('handles').get('dir');
                req.onsuccess = () => resolve(req.result ? req.result.handle : null);
                req.onerror = () => resolve(null);
            } catch(e) { resolve(null); }
        });
    },

    _saveFsHandle(handle) {
        if (!this._fsHandleIdb) return;
        try {
            const tx = this._fsHandleIdb.transaction('handles', 'readwrite');
            tx.objectStore('handles').put({ k: 'dir', handle });
        } catch(e) {}
    },

    _clearFsHandle() {
        this._fsDirHandle = null;
        if (!this._fsHandleIdb) return;
        try {
            const tx = this._fsHandleIdb.transaction('handles', 'readwrite');
            tx.objectStore('handles').delete('dir');
        } catch(e) {}
    },

    // Öffnet den Ordner-Picker — muss durch User-Geste ausgelöst werden
    async selectBackupFolder() {
        if (!window.showDirectoryPicker) {
            throw new Error('Nicht verfügbar — bitte Chrome oder Edge verwenden');
        }
        const handle = await window.showDirectoryPicker({
            id: 'oyi_backup_folder',
            mode: 'readwrite',
            startIn: 'documents'
        });
        this._fsDirHandle = handle;
        this._saveFsHandle(handle);
        return handle;
    },

    // Berechtigung anfragen (benötigt User-Geste, z.B. Button-Klick)
    async requestFsPermission() {
        const handle = await this._loadFsHandle();
        if (!handle) return false;
        try {
            const perm = await handle.requestPermission({ mode: 'readwrite' });
            if (perm === 'granted') {
                this._fsDirHandle = handle;
                return true;
            }
        } catch(e) {}
        return false;
    },

    getFsBackupFolderName() {
        return this._fsDirHandle ? this._fsDirHandle.name : null;
    },

    // Schreibt ein benanntes Backup in den gewählten Ordner
    async writeFileSystemBackup(label) {
        if (!this._fsDirHandle || this._fsPending) return false;
        this._fsPending = true;
        try {
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
            const suffix = label ? `_${label.replace(/[^a-z0-9]/gi, '_')}` : '';
            // Firmenname im Dateinamen (für getrennte Backups pro Firma)
            const coName = (typeof CompanyManager !== 'undefined' && CompanyManager.getActive())
                ? '_' + CompanyManager.getActive().name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_').substring(0, 20)
                : '';
            const filename = `backup${coName}_${ts}${suffix}.zip`;
            // JSON-Inhalt innerhalb des ZIPs: gleicher Name, aber .json
            const innerName = `backup${coName}_${ts}${suffix}.json`;

            const jsonData = this.exportAll();
            const zipData  = await this._createZip(innerName, jsonData);

            const fileHandle = await this._fsDirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(zipData.buffer);
            await writable.close();

            localStorage.setItem('_fs_backup_last', new Date().toISOString());
            localStorage.setItem('_fs_backup_last_file', filename);

            // Alte Backups aufräumen — nur letzte 60 behalten
            await this._pruneFileSystemBackups(60);
            console.log('[Store] Datei-Backup geschrieben:', filename);
            return filename;
        } catch(err) {
            // Berechtigung abgelaufen oder Ordner nicht mehr vorhanden
            if (err.name === 'NotAllowedError') {
                this._fsDirHandle = null;  // Handle zurücksetzen, beim nächsten Klick neu anfragen
                if (typeof Utils !== 'undefined' && Utils.showToast) {
                    Utils.showToast('⚠️ Datei-Backup-Berechtigung abgelaufen. Backup-Ordner neu wählen.', 'warning');
                }
            } else if (err.name === 'NotFoundError') {
                this._fsDirHandle = null;
                if (typeof Utils !== 'undefined' && Utils.showToast) {
                    Utils.showToast('⚠️ Backup-Ordner nicht erreichbar (z.B. USB nicht angesteckt)', 'warning');
                }
            } else {
                if (typeof Utils !== 'undefined' && Utils.showToast) {
                    Utils.showToast('⚠️ Datei-Backup fehlgeschlagen: ' + (err.name || err.message), 'warning');
                }
            }
            console.warn('[Store] Datei-Backup Fehler:', err.message);
            return false;
        } finally {
            this._fsPending = false;
        }
    },

    // Gibt den Firmennamen-Anteil zurück, der in Dateinamen verwendet wird
    // z.B. "_MeineGmbH" oder "" (kein Firmenname)
    _fsCoNameSlug() {
        if (typeof CompanyManager === 'undefined') return '';
        const co = CompanyManager.getActive();
        return co ? '_' + co.name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_').substring(0, 20) : '';
    },

    // Prüft ob ein Dateiname zur aktiven Firma gehört (.zip und .json)
    _fsFileMatchesCompany(name) {
        if (!name.endsWith('.zip') && !name.endsWith('.json')) return false;
        const slug = this._fsCoNameSlug();
        if (slug) {
            return name.startsWith('backup' + slug + '_');
        } else {
            return name.startsWith('backup_') &&
                   !/^backup_[a-zA-ZäöüÄÖÜß]/.test(name.slice(7)); // kein Buchstabe nach backup_
        }
    },

    async _pruneFileSystemBackups(maxKeep) {
        if (!this._fsDirHandle) return;
        try {
            const files = [];
            for await (const [name, handle] of this._fsDirHandle.entries()) {
                // Nur Dateien der aktiven Firma prunen — andere Firmen bleiben unberührt
                if (this._fsFileMatchesCompany(name)) {
                    files.push({ name, handle });
                }
            }
            // Neueste zuerst (alphabetisch = chronologisch durch ts-Präfix)
            files.sort((a, b) => b.name.localeCompare(a.name));
            for (let i = maxKeep; i < files.length; i++) {
                try { await this._fsDirHandle.removeEntry(files[i].name); } catch(e) {}
            }
        } catch(e) {}
    },

    // Listet alle Backup-Dateien im Ordner — mit Firmen-Markierung
    async listFileSystemBackups() {
        if (!this._fsDirHandle) return [];
        try {
            const slug = this._fsCoNameSlug();
            const files = [];
            for await (const [name, handle] of this._fsDirHandle.entries()) {
                if (name.startsWith('backup') && (name.endsWith('.zip') || name.endsWith('.json'))) {
                    const isCurrentCompany = slug
                        ? name.startsWith('backup' + slug + '_')
                        : (name.startsWith('backup_') && !/^backup_[a-zA-ZäöüÄÖÜß]/.test(name.slice(7)));
                    files.push({ name, handle, isCurrentCompany });
                }
            }
            return files.sort((a, b) => b.name.localeCompare(a.name));
        } catch(e) { return []; }
    },

    // Liest eine Backup-Datei aus dem Ordner und gibt den JSON-String zurück
    async readFileSystemBackup(fileHandle) {
        const file = await fileHandle.getFile();
        if (file.name.endsWith('.zip')) {
            const buffer = await file.arrayBuffer();
            return await this._unzipFirstFile(buffer);
        }
        return await file.text();
    },

    // Debouncte Auto-Backup: 1,5 Sekunden nach letzter Änderung
    // Schreibt ALLE Schichten gleichzeitig: IDB-Snapshot + LS-Spiegel + Datei
    _triggerAutoBackup() {
        if (this._isImporting) return;
        clearTimeout(this._autoBackupDebounce);
        this._autoBackupDebounce = setTimeout(() => {
            this._trackDataCounts();          // Sentinel aktualisieren
            this._writeIDBSnapshot();          // Schicht: IDB Auto-Backup
            this._writeLocalStorageMirror();   // Schicht: LS-Spiegel
            if (this._fsDirHandle) {           // Schicht: Datei-Backup (wenn konfiguriert)
                this.writeFileSystemBackup('auto');
            }
            // Schicht: Cloud-Sync (opt-in, E2E) — debounced Push nach Änderung
            if (window.CloudSync && CloudSync.onLocalChange) { try { CloudSync.onLocalChange(); } catch (e) {} }
        }, 1500);
    },

    _writeIDBSnapshot() {
        const data = this.exportAll();

        // ── Primär: OPFS + gzip ──────────────────────────────────────
        if (this._opfsReady && this._opfsDir) {
            this._writeOpfsSnapshot(data)
                .then(() => this._pruneOpfsSnapshots(this.IDB_MAX_SNAPSHOTS))
                .catch(e => {
                    console.warn('[Store] OPFS-Snapshot fehlgeschlagen, Fallback auf IDB:', e);
                    this._writeIDBSnapshotFallback(data);
                });
            return;
        }

        // ── Fallback: IDB ────────────────────────────────────────────
        this._writeIDBSnapshotFallback(data);
    },

    // IDB-Snapshot schreiben (Fallback wenn OPFS nicht verfügbar)
    _writeIDBSnapshotFallback(data) {
        if (!this._idbReady || !this._idb) return;
        try {
            const snapshot = {
                id:   Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                ts:   new Date().toISOString(),
                data: data
            };
            const tx = this._idb.transaction(this.IDB_STORE, 'readwrite');
            tx.objectStore(this.IDB_STORE).add(snapshot);
            tx.oncomplete = () => this._pruneIDBSnapshots();
            tx.onerror = (ev) => {
                const err = ev.target && ev.target.error;
                if (err && err.name === 'QuotaExceededError') {
                    console.warn('[Store] IDB-Snapshot: Speicher voll — starte Notfall-Bereinigung');
                    this._emergencyPruneSnapshots(5).then(() => {
                        try {
                            const tx2 = this._idb.transaction(this.IDB_STORE, 'readwrite');
                            tx2.objectStore(this.IDB_STORE).add(snapshot);
                            tx2.oncomplete = () => {
                                if (typeof Utils !== 'undefined' && Utils.showToast)
                                    Utils.showToast('🧹 Speicher bereinigt — Auto-Backup gespeichert.', 'info', 5000);
                            };
                            tx2.onerror = () => {
                                if (typeof Utils !== 'undefined' && Utils.showToast)
                                    Utils.showToast('⚠️ Speicher voll — Auto-Backup übersprungen. Datei-Backup bleibt aktiv.', 'warning', 8000);
                            };
                        } catch(e2) {}
                    });
                } else {
                    console.warn('[Store] IDB-Snapshot fehlgeschlagen:', err);
                }
            };
        } catch(e) {
            console.warn('[Store] _writeIDBSnapshotFallback Exception:', e);
        }
    },

    // Löscht alle Snapshots bis auf die neuesten `keepCount` — OPFS-first, IDB als Fallback
    _emergencyPruneSnapshots(keepCount) {
        if (this._opfsReady && this._opfsDir) {
            return this._pruneOpfsSnapshots(keepCount);
        }
        // IDB-Fallback
        return new Promise((resolve) => {
            if (!this._idbReady || !this._idb) { resolve(); return; }
            try {
                const tx = this._idb.transaction(this.IDB_STORE, 'readwrite');
                const os = tx.objectStore(this.IDB_STORE);
                const req = os.index('ts').openCursor(null, 'prev');
                let count = 0;
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (!cursor) { resolve(); return; }
                    count++;
                    if (count > keepCount) cursor.delete();
                    cursor.continue();
                };
                req.onerror = () => resolve();
                tx.oncomplete = () => resolve();
                tx.onerror   = () => resolve();
            } catch(e) { resolve(); }
        });
    },

    // Schreibt einen kompakten LS-Spiegel als letzter Ausweg bei IDB-Verlust
    _writeLocalStorageMirror() {
        try {
            const snap = this.exportAll();
            localStorage.setItem('_oyi_lsmirror', snap);
            localStorage.setItem('_oyi_lsmirror_ts', new Date().toISOString());
        } catch(e) {} // LS kann voll sein — ignorieren
    },

    // Versucht Daten aus allen verfügbaren Quellen wiederherzustellen.
    // Gibt ein Objekt { source, ts, data } zurück oder null.
    emergencyRecover() {
        return new Promise((resolve) => {
            const results = [];

            // 1) Auto-Backup IDB (oyi_autobackup)
            this.getIDBSnapshots().then(snaps => {
                snaps.forEach(s => results.push({
                    source: 'AutoBackup-IDB',
                    id: s.id,
                    ts: s.ts,
                    data: s.data,
                    label: 'Auto-Backup ' + new Date(s.ts).toLocaleString('de-DE')
                }));

                // 2) localStorage Spiegel
                const lsSnap = localStorage.getItem('_oyi_lsmirror');
                const lsTs   = localStorage.getItem('_oyi_lsmirror_ts');
                if (lsSnap) {
                    results.push({
                        source: 'localStorage-Spiegel',
                        id: '_lsmirror',
                        ts: lsTs || '',
                        data: lsSnap,
                        label: 'LS-Spiegel ' + (lsTs ? new Date(lsTs).toLocaleString('de-DE') : '?')
                    });
                }

                // 3) Rohe localStorage-Schlüssel direkt
                let rawKeys = 0;
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith(this._prefix) || k.startsWith(this._rechPrefix))) rawKeys++;
                }
                if (rawKeys > 0) {
                    results.push({
                        source: 'localStorage-Raw',
                        id: '_lsraw',
                        ts: null,
                        data: null,   // importAll direkt aus LS
                        label: `localStorage (${rawKeys} Schlüssel direkt)`
                    });
                }

                resolve(results.sort((a, b) => (b.ts || '').localeCompare(a.ts || '')));
            });
        });
    },

    // Stellt Daten aus dem localStorage-Raw direkt wieder her
    restoreFromLocalStorageRaw() {
        let moved = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith(this._prefix) || k.startsWith(this._rechPrefix) || k === this._auditKey)) {
                const v = localStorage.getItem(k);
                this._cache[k] = v;
                this._idbPut(k, v);
                moved++;
            }
        }
        return moved;
    },

    _pruneIDBSnapshots() {
        if (!this._idbReady || !this._idb) return;
        try {
            const tx = this._idb.transaction(this.IDB_STORE, 'readwrite');
            const os = tx.objectStore(this.IDB_STORE);
            const req = os.index('ts').openCursor(null, 'prev');
            let count = 0;
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (!cursor) return;
                count++;
                if (count > this.IDB_MAX_SNAPSHOTS) {
                    cursor.delete();
                }
                cursor.continue();
            };
        } catch(e) {}
    },

    // Alle Snapshots lesen — OPFS zuerst, IDB als Fallback
    async getIDBSnapshots() {
        if (this._opfsReady && this._opfsDir) {
            try {
                const opfsSnaps = await this._listOpfsSnapshots();
                if (opfsSnaps.length > 0) return opfsSnaps;
                // OPFS leer → auch IDB prüfen (z.B. nach Migration)
            } catch(e) {}
        }
        // IDB-Fallback
        return new Promise((resolve) => {
            if (!this._idbReady || !this._idb) { resolve([]); return; }
            try {
                const tx = this._idb.transaction(this.IDB_STORE, 'readonly');
                const req = tx.objectStore(this.IDB_STORE).index('ts').getAll();
                req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.ts.localeCompare(a.ts)));
                req.onerror  = () => resolve([]);
            } catch(e) { resolve([]); }
        });
    },

    // Snapshot wiederherstellen — OPFS-Dateiname oder IDB-ID
    restoreFromIDBSnapshot(snapshotId) {
        // OPFS-Snapshot: ID ist der Dateiname (snap_*.json.gz)
        if (this._opfsReady && this._opfsDir && String(snapshotId).startsWith('snap_')) {
            return this._readOpfsSnapshot(snapshotId).then(data => {
                this._isImporting = true;
                try { this.importAll(data); return Promise.resolve(); }
                catch(e) { return Promise.reject(e.message); }
                finally { this._isImporting = false; }
            });
        }
        // IDB-Fallback
        return new Promise((resolve, reject) => {
            if (!this._idbReady || !this._idb) { reject('IDB nicht verfügbar'); return; }
            try {
                const tx = this._idb.transaction(this.IDB_STORE, 'readonly');
                const req = tx.objectStore(this.IDB_STORE).get(snapshotId);
                req.onsuccess = () => {
                    if (!req.result) { reject('Snapshot nicht gefunden'); return; }
                    this._isImporting = true;
                    try { this.importAll(req.result.data); resolve(); }
                    catch(e) { reject(e.message); }
                    finally { this._isImporting = false; }
                };
                req.onerror = () => reject('Fehler beim Lesen');
            } catch(e) { reject(e.message); }
        });
    },

    get(key) {
        try {
            const raw = this._cache[this._prefix + key];
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    },

    set(key, value) {
        const fullKey = this._prefix + key;
        const str = JSON.stringify(value);
        this._cache[fullKey] = str;
        this._idbPut(fullKey, str);
        this._triggerAutoBackup();
    },

    _rechGet(key) {
        try {
            const raw = this._cache[this._rechPrefix + key];
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    },

    _rechSet(key, value) {
        const fullKey = this._rechPrefix + key;
        const str = JSON.stringify(value);
        this._cache[fullKey] = str;
        this._idbPut(fullKey, str);
        this._triggerAutoBackup();
    },

    // ============================================
    // Audit Log (Aenderungsprotokoll) - GoBD
    // ============================================
    getAuditLog() {
        try {
            const raw = this._cache[this._auditKey];
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    },

    _addAuditEntry(action, entityType, entityId, oldValues, newValues, details) {
        const log = this.getAuditLog();
        // Hash-chain: prevHash = checksum of last entry (GoBD Rz.64 — Unveränderlichkeit)
        const prevEntry = log.length ? log[log.length - 1] : null;
        const prevHash  = prevEntry ? (prevEntry.checksum || '') : 'GENESIS';
        const entry = {
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            _dev: this._deviceId(),   // Herkunft — stabiler Sortier-Tiebreak beim Merge-Re-Chaining
            action,
            entityType,
            entityId,
            oldValues: oldValues || null,
            newValues: newValues || null,
            details: details || '',
            prevHash,  // chain link: tampering one entry breaks all subsequent prevHash checks
            checksum: ''
        };
        entry.checksum = this._calcChecksum(JSON.stringify(entry));
        log.push(entry);
        const str = JSON.stringify(log);
        this._cache[this._auditKey] = str;
        this._idbPut(this._auditKey, str);
        return entry;
    },

    // Wie _addAuditEntry, aber für viele Einträge in EINER Schreiboperation (Bulk-Import).
    // Hash-Chain bleibt identisch (jeder prevHash = checksum des Vorgängers) → verifyAuditChain() bleibt gültig.
    _addAuditEntriesBatch(items) {
        if (!items || !items.length) return 0;
        const log = this.getAuditLog();
        let prevHash = log.length ? (log[log.length - 1].checksum || '') : 'GENESIS';
        for (const it of items) {
            const entry = {
                id: this.generateId(),
                timestamp: new Date().toISOString(),
                _dev: this._deviceId(),
                action: it.action,
                entityType: it.entityType,
                entityId: it.entityId,
                oldValues: it.oldValues || null,
                newValues: it.newValues || null,
                details: it.details || '',
                prevHash,
                checksum: ''
            };
            entry.checksum = this._calcChecksum(JSON.stringify(entry));
            prevHash = entry.checksum;   // Kettenglied für nächsten Eintrag
            log.push(entry);
        }
        const str = JSON.stringify(log);
        this._cache[this._auditKey] = str;
        this._idbPut(this._auditKey, str);
        return items.length;
    },

    // Verify audit log chain integrity — returns { valid, broken, total }
    verifyAuditChain() {
        const log = this.getAuditLog();
        let broken = 0;
        for (let i = 0; i < log.length; i++) {
            const entry = log[i];
            // Recompute entry checksum (excluding checksum field itself)
            const copy = Object.assign({}, entry, { checksum: '' });
            const expected = this._calcChecksum(JSON.stringify(copy));
            if (entry.checksum !== expected) { broken++; continue; }
            // Verify chain link
            if (i > 0) {
                const expectedPrev = log[i - 1].checksum || '';
                if (entry.prevHash !== expectedPrev) broken++;
            } else {
                if (entry.prevHash !== 'GENESIS') broken++;
            }
        }
        return { valid: broken === 0, broken, total: log.length };
    },

    _calcChecksum(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + ch;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    },

    _calcRecordChecksum(record) {
        const copy = Object.assign({}, record);
        delete copy._checksum;
        return this._calcChecksum(JSON.stringify(copy));
    },

    verifyIntegrity(record) {
        if (!record || !record._checksum) return true;
        return record._checksum === this._calcRecordChecksum(record);
    },

    // Stabile Geräte-ID — für Sync-Merge (LWW) & Audit-Re-Chaining. Einmalig erzeugt.
    _deviceId() {
        var id = localStorage.getItem('oyi_device_id');
        if (!id) {
            id = 'dev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            localStorage.setItem('oyi_device_id', id);
        }
        return id;
    },

    _stampRecord(record) {
        // Sync-Metadaten: updatedAt (Last-Writer-Wins) + _dev (Herkunft).
        // Vor der Prüfsumme gesetzt → wird mitgesichert und bleibt beim Transport stabil.
        record.updatedAt = Date.now();
        record._dev = this._deviceId();
        record._checksum = this._calcRecordChecksum(record);
        return record;
    },

    // ── Cloud-Sync-Schnittstelle (genutzt von js/cloud-sync.js) ──────────────
    // Liest einen firmen-präfixierten Roh-Key, OHNE die aktive Firma zu wechseln.
    _syncReadRaw(fullKey) {
        var raw = this._cache[fullKey];
        if (raw == null) { try { raw = localStorage.getItem(fullKey); } catch (e) {} }
        if (raw == null) return null;
        try { return JSON.parse(raw); } catch (e) { return null; }
    },

    // Schreibt mehrere Roh-Keys (firmen-präfixiert) in Cache + IDB in EINER Operation.
    // Bewusst OHNE _stampRecord — der Merge liefert bereits gültige updatedAt/_checksum.
    syncApplyKeys(map) {
        var entries = [];
        for (var k in map) {
            if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
            var str = (typeof map[k] === 'string') ? map[k] : JSON.stringify(map[k]);
            this._cache[k] = str;
            entries.push({ k: k, v: str });
        }
        if (typeof this._idbPutBatch === 'function') this._idbPutBatch(entries);
        else entries.forEach(function (e) { this._idbPut(e.k, e.v); }, this);
    },

    // ── GoBD: Sperre / Festschreibung ───────────────────────────────────────
    // Ein Datensatz ist gesperrt (nur noch per Storno korrigierbar), wenn er
    // storniert/manuell gesperrt ist ODER in einer festgeschriebenen Periode liegt.
    isLocked(record) {
        if (!record) return false;
        if (record.storniert) return true;
        if (record.gesperrt) return true;
        if (this.isPeriodLocked(record.datum || record.anschaffungsdatum)) return true;
        return false;
    },

    // Frei bearbeitbar? (offen, nicht storniert, nicht festgeschrieben)
    canEdit(record)   { return !!record && !this.isLocked(record); },
    // Echt löschbar? = wie canEdit (festgeschriebene/stornierte → nur Storno)
    canDelete(record) { return this.canEdit(record); },

    // Liegt das Datum (YYYY-MM-DD) in einer festgeschriebenen Periode?
    //  • USt-Voranmeldungs-Quartal als eingereicht markiert, ODER
    //  • Jahr manuell abgeschlossen.
    isPeriodLocked(dateStr) {
        if (!dateStr) return false;
        const ds = String(dateStr);
        const year = parseInt(ds.slice(0, 4), 10);
        if (!year) return false;
        if (this.getClosedYears().includes(year)) return true;
        const month = parseInt(ds.slice(5, 7), 10) || 1;
        const quartal = Math.floor((month - 1) / 3); // 0–3
        return this.getUstPerioden().some(p => p.year === year && p.quartal === quartal && p.eingereichtAm);
    },

    // Warum ist der Datensatz gesperrt? (für UI-Tooltips)
    lockReason(record) {
        if (!record) return '';
        if (record.storniert) return 'Bereits storniert';
        if (record.gesperrt)  return 'Manuell festgeschrieben';
        const d = record.datum || record.anschaffungsdatum;
        if (this.isPeriodLocked(d)) {
            const year = parseInt(String(d).slice(0, 4), 10);
            if (this.getClosedYears().includes(year)) return 'Jahr ' + year + ' ist abgeschlossen';
            return 'USt-Voranmeldung dieser Periode wurde eingereicht';
        }
        return '';
    },

    // Manuell abgeschlossene Jahre (Festschreibung)
    getClosedYears() {
        try { return JSON.parse(this._cache[this._prefix + 'closed_years'] || '[]'); } catch(e) { return []; }
    },
    closeYear(year) {
        year = parseInt(year, 10);
        if (!year) return;
        const list = this.getClosedYears();
        if (!list.includes(year)) {
            list.push(year);
            this.set('closed_years', list);
            this._addAuditEntry('status_geaendert', 'system', 'jahr_' + year, null, { year, geschlossen: true },
                'Jahr ' + year + ' abgeschlossen (festgeschrieben)');
        }
    },
    reopenYear(year, grund) {
        year = parseInt(year, 10);
        let list = this.getClosedYears();
        if (list.includes(year)) {
            list = list.filter(y => y !== year);
            this.set('closed_years', list);
            this._addAuditEntry('status_geaendert', 'system', 'jahr_' + year, null, { year, geschlossen: false },
                'Jahr ' + year + ' wieder geöffnet' + (grund ? ': ' + grund : ''));
        }
    },

    // ---- Theme (shared, no prefix) ----
    getTheme() {
        return localStorage.getItem('app_theme') || 'dark';
    },

    setTheme(theme) {
        localStorage.setItem('app_theme', theme);
    },

    // ---- Reselling Settings ----
    getSettings() {
        return this.get('settings') || {};
    },

    saveSettings(settings) {
        this.set('settings', settings);
    },

    // ---- Purchases ----
    getPurchases(includeStorniert) {
        const all = this.get('purchases') || [];
        return includeStorniert ? all : all.filter(p => !p.storniert);
    },

    getAllPurchasesRaw() {
        return this.get('purchases') || [];
    },

    getPurchasesBySession(sessionId) {
        return this.getAllPurchasesRaw().filter(p => p.sessionId === sessionId && !p.storniert);
    },

    getSessions() {
        const all = this.getAllPurchasesRaw().filter(p => p.sessionId && !p.storniert);
        const sessions = {};
        all.forEach(p => {
            if (!sessions[p.sessionId]) {
                sessions[p.sessionId] = {
                    sessionId: p.sessionId,
                    datum: p.datum,
                    einkaufsquelle: p.einkaufsquelle,
                    items: []
                };
            }
            sessions[p.sessionId].items.push(p);
        });
        return Object.values(sessions);
    },

    savePurchase(purchase) {
        const purchases = this.getAllPurchasesRaw();
        if (purchase.id) {
            const idx = purchases.findIndex(p => p.id === purchase.id);
            if (idx >= 0) {
                const old = Object.assign({}, purchases[idx]);
                if (this.isLocked(old)) return purchase; // GoBD: festgeschriebene/stornierte Einträge nicht bearbeitbar
                this._addAuditEntry('bearbeitet', 'einkauf', purchase.id, old, purchase, 'Einkauf bearbeitet');
                purchases[idx] = this._stampRecord(purchase);
            } else {
                purchases.push(this._stampRecord(purchase));
            }
        } else {
            // Trial/Plan Limit
            if (typeof UserPlan !== 'undefined' && !UserPlan.isPro() && !UserPlan.isTrialActive()) {
                const total = this.getAllPurchasesRaw().length + this.getAllSalesRaw().length + this.getAllExpensesRaw().length;
                if (total >= UserPlan.getLimit('maxBuchungen')) { UserPlan.requirePro('Unbegrenzte Buchungen'); return purchase; }
            }
            purchase.id = this.generateId();
            purchase.createdAt = new Date().toISOString();
            // Auto-generate Artikelnummer (YYYY-NNN)
            if (!purchase.artikelNr) {
                const year = new Date().getFullYear();
                const prefix = year + '-';
                const allExisting = purchases.filter(p => p.artikelNr && p.artikelNr.startsWith(prefix));
                const maxN = allExisting.reduce((max, p) => {
                    const m = (p.artikelNr || '').match(/^(\d{4})-(\d+)$/);
                    return m ? Math.max(max, parseInt(m[2])) : max;
                }, 0);
                purchase.artikelNr = prefix + String(maxN + 1).padStart(3, '0');
            }
            this._stampRecord(purchase);
            purchases.push(purchase);
            this._addAuditEntry('erstellt', 'einkauf', purchase.id, null, purchase, 'Einkauf erstellt');
        }
        this.set('purchases', purchases);
        return purchase;
    },

    stornoPurchase(id, grund) {
        const purchases = this.getAllPurchasesRaw();
        const p = purchases.find(x => x.id === id);
        if (!p || p.storniert) return;
        const old = Object.assign({}, p);
        p.storniert = true;
        p.storniertAm = new Date().toISOString();
        p.stornoGrund = grund || 'Storniert';
        this._stampRecord(p);
        this.set('purchases', purchases);
        this._addAuditEntry('storniert', 'einkauf', id, old, p, grund || 'Einkauf storniert');
    },

    // GoBD-konformes Löschen:
    //  • offene Periode  → echtes Löschen MIT Protokolleintrag (rekonstruierbar)
    //  • festgeschrieben → kein Löschen, automatisch Storno (Spur bleibt erhalten)
    deletePurchase(id) {
        const p = this.getAllPurchasesRaw().find(x => x.id === id);
        if (!p) return { ok: false };
        if (this.isLocked(p)) {
            if (!p.storniert) this.stornoPurchase(id, 'Storno statt Löschung — Periode abgeschlossen');
            return { storno: true };
        }
        this._addAuditEntry('loeschung', 'einkauf', id, p, null, 'Einkauf gelöscht (offene Periode)');
        const purchases = this.getAllPurchasesRaw();
        const idx = purchases.findIndex(x => x.id === id);
        if (idx >= 0) { purchases.splice(idx, 1); this.set('purchases', purchases); }
        return { deleted: true };
    },

    // Veralteter Name — jetzt Alias auf das lock-aware, protokollierte Löschen.
    physicalDeletePurchase(id) { return this.deletePurchase(id); },

    // ---- Sales ----
    getSales(includeStorniert) {
        const all = this.get('sales') || [];
        return includeStorniert ? all : all.filter(s => !s.storniert);
    },

    getAllSalesRaw() {
        return this.get('sales') || [];
    },

    saveSale(sale) {
        const sales = this.getAllSalesRaw();
        if (sale.id) {
            const idx = sales.findIndex(s => s.id === sale.id);
            if (idx >= 0) {
                const old = Object.assign({}, sales[idx]);
                if (this.isLocked(old)) return sale; // GoBD: festgeschriebene/stornierte Verkäufe nicht bearbeitbar
                this._addAuditEntry('bearbeitet', 'verkauf', sale.id, old, sale, 'Verkauf bearbeitet');
                sales[idx] = this._stampRecord(sale);
            } else {
                sales.push(this._stampRecord(sale));
            }
        } else {
            // Trial/Plan Limit
            if (typeof UserPlan !== 'undefined' && !UserPlan.isPro() && !UserPlan.isTrialActive()) {
                const total = this.getAllPurchasesRaw().length + this.getAllSalesRaw().length + this.getAllExpensesRaw().length;
                if (total >= UserPlan.getLimit('maxBuchungen')) { UserPlan.requirePro('Unbegrenzte Buchungen'); return sale; }
            }
            sale.id = this.generateId();
            sale.createdAt = new Date().toISOString();
            this._stampRecord(sale);
            sales.push(sale);
            this._addAuditEntry('erstellt', 'verkauf', sale.id, null, sale, 'Verkauf erstellt');
        }
        this.set('sales', sales);
        // Mark purchase(s) as sold if linked - supports both single (purchaseId) and multiple (purchaseIds)
        if (!sale.storniert) {
            const idsToMark = sale.purchaseIds ? sale.purchaseIds : (sale.purchaseId ? [sale.purchaseId] : []);
            if (idsToMark.length > 0) {
                const purchases = this.getAllPurchasesRaw();
                let changed = false;
                idsToMark.forEach(pid => {
                    const p = purchases.find(x => x.id === pid);
                    if (p && !p.storniert) {
                        p.status = 'verkauft';
                        this._stampRecord(p);
                        changed = true;
                    }
                });
                if (changed) this.set('purchases', purchases);
            }
        }
        // §19 UStG: Umsatzgrenze nach jedem Verkauf prüfen
        if (!sale.storniert && window.App && typeof App._checkUstThreshold === 'function') {
            setTimeout(() => App._checkUstThreshold(), 300);
        }
        return sale;
    },

    // saveSaleMulti: Verkauf mit mehreren Artikeln (purchaseIds Array)
    saveSaleMulti(sale) {
        // Trial/Plan Limit
        if (typeof UserPlan !== 'undefined' && !UserPlan.isPro() && !UserPlan.isTrialActive()) {
            const total = this.getAllPurchasesRaw().length + this.getAllSalesRaw().length + this.getAllExpensesRaw().length;
            if (total >= UserPlan.getLimit('maxBuchungen')) { UserPlan.requirePro('Unbegrenzte Buchungen'); return sale; }
        }
        const sales = this.getAllSalesRaw();
        sale.id = this.generateId();
        sale.createdAt = new Date().toISOString();
        this._stampRecord(sale);
        sales.push(sale);
        this._addAuditEntry('erstellt', 'verkauf', sale.id, null, sale,
            `Multi-Verkauf erstellt (${(sale.purchaseIds || []).length} Artikel)`);
        this.set('sales', sales);
        // Alle verlinkten Einkäufe als verkauft markieren
        if (sale.purchaseIds && sale.purchaseIds.length > 0) {
            const purchases = this.getAllPurchasesRaw();
            let changed = false;
            sale.purchaseIds.forEach(pid => {
                const p = purchases.find(x => x.id === pid);
                if (p && !p.storniert) {
                    p.status = 'verkauft';
                    this._stampRecord(p);
                    changed = true;
                }
            });
            if (changed) this.set('purchases', purchases);
        }
        // §19 UStG: Umsatzgrenze nach Multi-Verkauf prüfen
        if (window.App && typeof App._checkUstThreshold === 'function') {
            setTimeout(() => App._checkUstThreshold(), 300);
        }
        return sale;
    },

    stornoSale(id, grund) {
        const sales = this.getAllSalesRaw();
        const s = sales.find(x => x.id === id);
        if (!s || s.storniert) return;
        const old = Object.assign({}, s);
        s.storniert = true;
        s.storniertAm = new Date().toISOString();
        s.stornoGrund = grund || 'Storniert';
        this._stampRecord(s);
        this.set('sales', sales);
        this._addAuditEntry('storniert', 'verkauf', id, old, s, grund || 'Verkauf storniert');
        // Einkauf(e) wieder freigeben - unterstützt einzelne (purchaseId) und mehrere (purchaseIds)
        const purchases = this.getAllPurchasesRaw();
        const idsToFree = s.purchaseIds ? s.purchaseIds : (s.purchaseId ? [s.purchaseId] : []);
        let purchasesChanged = false;
        idsToFree.forEach(pid => {
            const p = purchases.find(x => x.id === pid);
            if (p && !p.storniert) {
                p.status = 'verfuegbar';
                this._stampRecord(p);
                purchasesChanged = true;
            }
        });
        if (purchasesChanged) this.set('purchases', purchases);
    },

    deleteSale(id) {
        const s = this.getAllSalesRaw().find(x => x.id === id);
        if (!s) return { ok: false };
        if (this.isLocked(s)) {
            if (!s.storniert) this.stornoSale(id, 'Storno statt Löschung — Periode abgeschlossen');
            return { storno: true };
        }
        this._addAuditEntry('loeschung', 'verkauf', id, s, null, 'Verkauf gelöscht (offene Periode)');
        // verknüpfte Einkäufe wieder freigeben
        const pids = s.purchaseIds ? s.purchaseIds : (s.purchaseId ? [s.purchaseId] : []);
        if (pids.length > 0) {
            const purchases = this.getAllPurchasesRaw();
            let changed = false;
            pids.forEach(pid => {
                const p = purchases.find(x => x.id === pid);
                if (p && !p.storniert && p.status === 'verkauft') { p.status = 'verfuegbar'; this._stampRecord(p); changed = true; }
            });
            if (changed) this.set('purchases', purchases);
        }
        const sales = this.getAllSalesRaw();
        const idx = sales.findIndex(x => x.id === id);
        if (idx >= 0) { sales.splice(idx, 1); this.set('sales', sales); }
        return { deleted: true };
    },

    physicalDeleteSale(id) { return this.deleteSale(id); },

    // ---- Expenses ----
    getExpenses(includeStorniert) {
        const all = this.get('expenses') || [];
        return includeStorniert ? all : all.filter(e => !e.storniert);
    },

    getAllExpensesRaw() {
        return this.get('expenses') || [];
    },

    saveExpense(expense) {
        const expenses = this.getAllExpensesRaw();
        if (expense.id) {
            const idx = expenses.findIndex(e => e.id === expense.id);
            if (idx >= 0) {
                const old = Object.assign({}, expenses[idx]);
                if (this.isLocked(old)) return expense; // GoBD: festgeschriebene/stornierte Ausgaben nicht bearbeitbar
                this._addAuditEntry('bearbeitet', 'ausgabe', expense.id, old, expense, 'Ausgabe bearbeitet');
                expenses[idx] = this._stampRecord(expense);
            } else {
                expenses.push(this._stampRecord(expense));
            }
        } else {
            // Trial/Plan Limit
            if (typeof UserPlan !== 'undefined' && !UserPlan.isPro() && !UserPlan.isTrialActive()) {
                const total = this.getAllPurchasesRaw().length + this.getAllSalesRaw().length + this.getAllExpensesRaw().length;
                if (total >= UserPlan.getLimit('maxBuchungen')) { UserPlan.requirePro('Unbegrenzte Buchungen'); return expense; }
            }
            expense.id = this.generateId();
            expense.createdAt = new Date().toISOString();
            this._stampRecord(expense);
            expenses.push(expense);
            this._addAuditEntry('erstellt', 'ausgabe', expense.id, null, expense, 'Ausgabe erstellt');
        }
        this.set('expenses', expenses);
        return expense;
    },

    stornoExpense(id, grund) {
        const expenses = this.getAllExpensesRaw();
        const e = expenses.find(x => x.id === id);
        if (!e || e.storniert) return;
        const old = Object.assign({}, e);
        e.storniert = true;
        e.storniertAm = new Date().toISOString();
        e.stornoGrund = grund || 'Storniert';
        this._stampRecord(e);
        this.set('expenses', expenses);
        this._addAuditEntry('storniert', 'ausgabe', id, old, e, grund || 'Ausgabe storniert');
    },

    deleteExpense(id) {
        const e = this.getAllExpensesRaw().find(x => x.id === id);
        if (!e) return { ok: false };
        if (this.isLocked(e)) {
            if (!e.storniert) this.stornoExpense(id, 'Storno statt Löschung — Periode abgeschlossen');
            return { storno: true };
        }
        this._addAuditEntry('loeschung', 'ausgabe', id, e, null, 'Ausgabe gelöscht (offene Periode)');
        const expenses = this.getAllExpensesRaw();
        const idx = expenses.findIndex(x => x.id === id);
        if (idx >= 0) { expenses.splice(idx, 1); this.set('expenses', expenses); }
        return { deleted: true };
    },

    physicalDeleteExpense(id) { return this.deleteExpense(id); },

    // ============================================
    // AfA / Abschreibungen
    // ============================================
    getAfaAnlagen() {
        try { return JSON.parse(this._cache[this._prefix + 'afa_anlagen'] || '[]'); } catch(e) { return []; }
    },
    saveAfaAnlage(item) {
        const list = this.getAfaAnlagen();
        if (item.id) {
            const idx = list.findIndex(x => x.id === item.id);
            if (idx >= 0) {
                const old = Object.assign({}, list[idx]);
                if (this.isLocked(old)) return item; // GoBD: festgeschriebene/stornierte AfA-Anlage nicht bearbeitbar
                list[idx] = this._stampRecord(item);
                this._addAuditEntry('bearbeitet', 'afa', item.id, old, item, 'AfA-Anlage bearbeitet');
            } else { list.push(this._stampRecord(item)); }
        } else {
            item.id = this.generateId();
            item.createdAt = new Date().toISOString();
            this._stampRecord(item);
            list.push(item);
            this._addAuditEntry('erstellt', 'afa', item.id, null, item, 'AfA-Anlage erstellt');
        }
        this.set('afa_anlagen', list);
        return item;
    },
    stornoAfaAnlage(id, grund) {
        const list = this.getAfaAnlagen();
        const item = list.find(x => x.id === id);
        if (!item || item.storniert) return;
        const old = Object.assign({}, item);
        item.storniert = true; item.storniertAm = new Date().toISOString(); item.stornoGrund = grund || 'Storniert';
        this._stampRecord(item); this.set('afa_anlagen', list);
        this._addAuditEntry('storniert', 'afa', id, old, item, grund || 'AfA-Anlage storniert');
    },

    // ============================================
    // Privatentnahmen / Privateinlagen
    // ============================================
    getPrivatbuchungen() {
        try { return JSON.parse(this._cache[this._prefix + 'privatbuchungen'] || '[]'); } catch(e) { return []; }
    },
    savePrivatbuchung(item) {
        const list = this.getPrivatbuchungen();
        if (item.id) {
            const idx = list.findIndex(x => x.id === item.id);
            if (idx >= 0) { list[idx] = this._stampRecord(item); }
            else { list.push(this._stampRecord(item)); }
        } else {
            item.id = this.generateId(); item.createdAt = new Date().toISOString();
            this._stampRecord(item); list.push(item);
            this._addAuditEntry('erstellt', 'privat', item.id, null, item, 'Privatbuchung erstellt');
        }
        this.set('privatbuchungen', list); return item;
    },
    stornoPrivatbuchung(id, grund) {
        const list = this.getPrivatbuchungen();
        const item = list.find(x => x.id === id);
        if (!item || item.storniert) return;
        const old = Object.assign({}, item);
        item.storniert = true; item.storniertAm = new Date().toISOString(); item.stornoGrund = grund || 'Storniert';
        this._stampRecord(item); this.set('privatbuchungen', list);
        this._addAuditEntry('storniert', 'privat', id, old, item, grund || 'Privatbuchung storniert');
    },

    // ============================================
    // USt-Voranmeldung — gesperrte Perioden
    // ============================================
    getUstPerioden() {
        try { return JSON.parse(this._cache[this._prefix + 'ust_perioden'] || '[]'); } catch(e) { return []; }
    },
    saveUstPeriode(p) {
        const list = this.getUstPerioden();
        const idx = list.findIndex(x => x.year === p.year && x.quartal === p.quartal && x.monat === p.monat);
        if (idx >= 0) list[idx] = p; else list.push(p);
        this.set('ust_perioden', list);
    },

    // ============================================
    // KSK — Künstlersozialkasse
    // ============================================
    getKskConfig() { return this.get('ksk_config') || {}; },
    saveKskConfig(cfg) { this.set('ksk_config', cfg); },
    getKskMeldungen() {
        try { return JSON.parse(this._cache[this._prefix + 'ksk_meldungen'] || '[]'); } catch(e) { return []; }
    },
    saveKskMeldung(m) {
        const list = this.getKskMeldungen();
        if (m.id) {
            const idx = list.findIndex(x => x.id === m.id);
            if (idx >= 0) list[idx] = m; else list.push(m);
        } else { m.id = this.generateId(); m.createdAt = new Date().toISOString(); list.push(m); }
        this.set('ksk_meldungen', list); return m;
    },

    // ---- Brands ----
    getBrands() {
        return this.get('brands') || ['Nike', 'Adidas', 'Supreme', 'Stone Island', 'The North Face', 'Ralph Lauren', 'CP Company', 'Moncler', 'Burberry', 'Carhartt', 'Palm Angels', 'Off-White'];
    },

    addBrand(brand) {
        const brands = this.getBrands();
        if (!brands.includes(brand)) {
            brands.push(brand);
            brands.sort();
            this.set('brands', brands);
        }
    },

    // ---- Platforms (Verkaufsplattformen) ----
    getPlatforms() {
        return this.get('platforms') || ['Vinted', 'eBay', 'eBay Kleinanzeigen / Kleinanzeigen', 'StockX', 'GOAT', 'Depop', 'Vestiaire Collective', 'Instagram / DM-Verkauf', 'WhatsApp', 'Facebook Marketplace', 'Flohmarkt', 'Direktverkauf / Privat', 'Amazon', 'Sonstiges'];
    },

    addPlatform(platform) {
        const platforms = this.getPlatforms();
        if (!platforms.includes(platform)) {
            platforms.push(platform);
            this.set('platforms', platforms);
        }
    },

    // ---- Einkaufsquellen ----
    getEinkaufsquellen() {
        return this.get('einkaufsquellen') || ['Privatkauf', 'eBay', 'eBay Kleinanzeigen / Kleinanzeigen', 'Vinted', 'StockX', 'GOAT', 'Depop', 'Vestiaire Collective', 'Flohmarkt', 'Outlet / Store', 'Großhändler / Bulk', 'ASOS', 'Zalando', 'About You', 'Amazon', 'Sonstiges'];
    },

    addEinkaufsquelle(quelle) {
        const quellen = this.getEinkaufsquellen();
        if (!quellen.includes(quelle)) {
            quellen.push(quelle);
            this.set('einkaufsquellen', quellen);
        }
    },

    // ---- Reselling Customers ----
    getCustomers() {
        return this.get('customers') || [];
    },

    saveCustomer(customer) {
        const customers = this.getCustomers();
        if (customer.id) {
            const idx = customers.findIndex(c => c.id === customer.id);
            if (idx >= 0) customers[idx] = customer;
            else customers.push(customer);
        } else {
            customer.id = this.generateId();
            customer.createdAt = new Date().toISOString();
            customers.push(customer);
        }
        this.set('customers', customers);
        return customer;
    },

    deleteCustomer(id) {
        this.set('customers', this.getCustomers().filter(c => c.id !== id));
    },

    // ---- Reselling Products ----
    getProducts() {
        return this.get('products') || [];
    },

    saveProduct(product) {
        const products = this.getProducts();
        if (product.id) {
            const idx = products.findIndex(p => p.id === product.id);
            if (idx >= 0) products[idx] = product;
            else products.push(product);
        } else {
            product.id = this.generateId();
            product.createdAt = new Date().toISOString();
            products.push(product);
        }
        this.set('products', products);
        return product;
    },

    deleteProduct(id) {
        this.set('products', this.getProducts().filter(p => p.id !== id));
    },

    // ---- Reselling Invoices ----
    getInvoices() {
        return this.get('invoices') || [];
    },

    saveInvoice(invoice) {
        const invoices = this.getInvoices();
        if (invoice.id) {
            const idx = invoices.findIndex(i => i.id === invoice.id);
            if (idx >= 0) invoices[idx] = invoice;
            else invoices.push(invoice);
        } else {
            invoice.id = this.generateId();
            invoice.createdAt = new Date().toISOString();
            invoices.push(invoice);
        }
        this.set('invoices', invoices);
        return invoice;
    },

    deleteInvoice(id) {
        this.set('invoices', this.getInvoices().filter(i => i.id !== id));
    },

    getInvoiceCounter() {
        return this.get('invoice_counter') || { RE: 0, AN: 0, GU: 0 };
    },

    nextInvoiceNumber(typ) {
        const counter = this.getInvoiceCounter();
        const prefix = typ === 'rechnung' ? 'RE' : typ === 'angebot' ? 'AN' : 'GU';
        const year = new Date().getFullYear();
        counter[prefix] = (counter[prefix] || 0) + 1;
        this.set('invoice_counter', counter);
        return `${prefix}-${year}-${String(counter[prefix]).padStart(3, '0')}`;
    },

    // ============================================
    // Rechnungsbuch Data (separate localStorage keys)
    // ============================================

    // ---- Rechnungsbuch Customers ----
    getRechCustomers(includeStorniert) {
        const all = this._rechGet('kunden') || [];
        return includeStorniert ? all : all.filter(c => !c.storniert);
    },

    saveRechCustomer(customer) {
        const customers = this._rechGet('kunden') || [];
        if (customer.id) {
            const idx = customers.findIndex(c => c.id === customer.id);
            if (idx >= 0) {
                const old = Object.assign({}, customers[idx]);
                if (old.storniert) return customer;
                this._addAuditEntry('bearbeitet', 'kunde', customer.id, old, customer, 'Kunde bearbeitet');
                customers[idx] = this._stampRecord(customer);
            } else {
                customers.push(this._stampRecord(customer));
            }
        } else {
            customer.id = this.generateId();
            customer.createdAt = new Date().toISOString();
            this._stampRecord(customer);
            customers.push(customer);
            this._addAuditEntry('erstellt', 'kunde', customer.id, null, customer, 'Kunde erstellt');
        }
        this._rechSet('kunden', customers);
        return customer;
    },

    stornoRechCustomer(id, grund) {
        const customers = this._rechGet('kunden') || [];
        const c = customers.find(x => x.id === id);
        if (!c || c.storniert) return;
        const old = Object.assign({}, c);
        c.storniert = true;
        c.storniertAm = new Date().toISOString();
        c.stornoGrund = grund || 'Storniert';
        this._stampRecord(c);
        this._rechSet('kunden', customers);
        this._addAuditEntry('storniert', 'kunde', id, old, c, grund || 'Kunde storniert');
    },

    deleteRechCustomer(id) {
        this.stornoRechCustomer(id, 'Storniert (ehemals geloescht)');
    },

    // ---- Rechnungsbuch Products ----
    getRechProducts(includeStorniert) {
        const all = this._rechGet('produkte') || [];
        return includeStorniert ? all : all.filter(p => !p.storniert);
    },

    saveRechProduct(product) {
        const products = this._rechGet('produkte') || [];
        if (product.id) {
            const idx = products.findIndex(p => p.id === product.id);
            if (idx >= 0) {
                const old = Object.assign({}, products[idx]);
                if (old.storniert) return product;
                this._addAuditEntry('bearbeitet', 'produkt', product.id, old, product, 'Produkt bearbeitet');
                products[idx] = this._stampRecord(product);
            } else {
                products.push(this._stampRecord(product));
            }
        } else {
            product.id = this.generateId();
            product.createdAt = new Date().toISOString();
            this._stampRecord(product);
            products.push(product);
            this._addAuditEntry('erstellt', 'produkt', product.id, null, product, 'Produkt erstellt');
        }
        this._rechSet('produkte', products);
        return product;
    },

    stornoRechProduct(id, grund) {
        const products = this._rechGet('produkte') || [];
        const p = products.find(x => x.id === id);
        if (!p || p.storniert) return;
        const old = Object.assign({}, p);
        p.storniert = true;
        p.storniertAm = new Date().toISOString();
        p.stornoGrund = grund || 'Storniert';
        this._stampRecord(p);
        this._rechSet('produkte', products);
        this._addAuditEntry('storniert', 'produkt', id, old, p, grund || 'Produkt storniert');
    },

    deleteRechProduct(id) {
        this.stornoRechProduct(id, 'Storniert (ehemals geloescht)');
    },

    // ---- Rechnungsbuch Invoices/Dokumente ----
    getRechInvoices(includeStorniert) {
        const all = this._rechGet('dokumente') || [];
        // Dokumente haben eigenes 'storniert' status-Feld, immer alle zurueckgeben
        return all;
    },

    saveRechInvoice(invoice) {
        const invoices = this._rechGet('dokumente') || [];
        if (invoice.id) {
            const idx = invoices.findIndex(i => i.id === invoice.id);
            if (idx >= 0) {
                const old = Object.assign({}, invoices[idx]);
                const action = invoice.status !== old.status ? 'status_geaendert' : 'bearbeitet';
                this._addAuditEntry(action, 'dokument', invoice.id, old, invoice,
                    action === 'status_geaendert' ? `Status: ${old.status} -> ${invoice.status}` : 'Dokument bearbeitet');
                invoices[idx] = this._stampRecord(invoice);
            } else {
                invoices.push(this._stampRecord(invoice));
            }
        } else {
            invoice.id = this.generateId();
            invoice.createdAt = new Date().toISOString();
            this._stampRecord(invoice);
            invoices.push(invoice);
            this._addAuditEntry('erstellt', 'dokument', invoice.id, null, invoice, 'Dokument erstellt: ' + (invoice.nummer || ''));
        }
        this._rechSet('dokumente', invoices);
        return invoice;
    },

    stornoRechInvoice(id, grund) {
        const invoices = this._rechGet('dokumente') || [];
        const inv = invoices.find(x => x.id === id);
        if (!inv) return;
        const old = Object.assign({}, inv);
        inv.status = 'storniert';
        inv._storniert = true;
        inv.storniertAm = new Date().toISOString();
        inv.stornoGrund = grund || 'Storniert';
        this._stampRecord(inv);
        this._rechSet('dokumente', invoices);
        this._addAuditEntry('storniert', 'dokument', id, old, inv, grund || 'Dokument storniert: ' + (inv.nummer || ''));
        // Cascade: storniere verknüpften Verkauf falls bereits synchronisiert
        const linkedSale = this.getAllSalesRaw().find(s => s._invoiceId === id && !s.storniert);
        if (linkedSale) {
            this.stornoSale(linkedSale.id, 'Automatisch: Rechnung ' + (inv.nummer || id) + ' storniert');
        }
    },

    deleteRechInvoice(id) {
        // GoBD: Physisches Loeschen nicht erlaubt - stattdessen stornieren
        this.stornoRechInvoice(id, 'Storniert (ehemals geloescht)');
    },

    peekStornoNumber() {
        const counter = this.getRechInvoiceCounter();
        const year = new Date().getFullYear();
        const n = (counter['SR'] || 0) + 1;
        return `SR-${year}-${String(n).padStart(4, '0')}`;
    },

    nextStornoNumber() {
        const counter = this.getRechInvoiceCounter();
        const year = new Date().getFullYear();
        counter['SR'] = (counter['SR'] || 0) + 1;
        this._rechSet('invoice_counter', counter);
        return `SR-${year}-${String(counter['SR']).padStart(4, '0')}`;
    },

    createStornoRechnung(originalId, grund, grundText) {
        const invoices = this._rechGet('dokumente') || [];
        const orig = invoices.find(x => x.id === originalId);
        if (!orig || orig.typ === 'stornorechnung') return null;
        const old = Object.assign({}, orig);
        const stornoNum = this.nextStornoNumber();
        // Negative Positionen
        const stornoPos = (orig.positionen || []).map(p => Object.assign({}, p, { einzelpreis: -Math.abs(p.einzelpreis) }));
        const today = new Date().toISOString().split('T')[0];
        const stornoDoc = {
            id: this.generateId(),
            typ: 'stornorechnung',
            nummer: stornoNum,
            originalRechnungId: originalId,
            originalRechnungNummer: orig.nummer,
            originalDatum: orig.datum,
            datum: today,
            stornierungsDatum: today,
            stornierungsGrund: grund || '',
            stornierungsGrundText: grundText || '',
            kundeId: orig.kundeId,
            positionen: stornoPos,
            zahlungsbedingungen: '',
            notizen: '',
            verkaufsplattform: orig.verkaufsplattform || '',
            status: 'storniert',
            faelligkeit: '',
            datumsOption: 'nur_datum',
            versendet: false,
            versandDatum: null,
            createdAt: new Date().toISOString()
        };
        this._stampRecord(stornoDoc);
        // Originalrechnung als storniert markieren
        orig.status = 'storniert';
        orig.storniertAm = today;
        orig.stornoGrund = grund || '';
        orig.stornoRechnungId = stornoDoc.id;
        this._stampRecord(orig);
        const idx = invoices.findIndex(x => x.id === originalId);
        if (idx >= 0) invoices[idx] = orig;
        invoices.push(stornoDoc);
        this._rechSet('dokumente', invoices);
        this._addAuditEntry('storniert', 'dokument', originalId, old, orig, 'Storniert: ' + (grund || ''));
        this._addAuditEntry('erstellt', 'dokument', stornoDoc.id, null, stornoDoc, 'Stornorechnung erstellt: ' + stornoNum + ' zu ' + orig.nummer);
        return stornoDoc;
    },

    setVersandStatus(invoiceId) {
        const invoices = this._rechGet('dokumente') || [];
        const inv = invoices.find(x => x.id === invoiceId);
        if (!inv) return;
        const today = new Date().toISOString().split('T')[0];
        inv.versendet = true;
        inv.versandDatum = today;
        if (inv.status === 'offen') inv.status = 'versendet';
        this._stampRecord(inv);
        this._rechSet('dokumente', invoices);
        this._addAuditEntry('status_geaendert', 'dokument', invoiceId, null, inv, 'Als versendet markiert');
    },

    // ---- Rechnungsbuch Settings ----
    getRechSettings() {
        return this._rechGet('einstellungen') || {};
    },

    saveRechSettings(obj) {
        this._rechSet('einstellungen', obj);
    },

    // ---- Unternehmensdaten (Absender auf Rechnungen) ----
    getRechUnternehmen() {
        return this._rechGet('unternehmen') || {};
    },

    saveRechUnternehmen(obj) {
        this._rechSet('unternehmen', obj);
    },

    // ---- Rechnungsbuch Invoice Counter ----
    getRechInvoiceCounter() {
        return this._rechGet('invoice_counter') || { RE: 0, AN: 0, GU: 0 };
    },

    nextRechInvoiceNumber(typ) {
        const counter = this.getRechInvoiceCounter();
        const prefix = typ === 'rechnung' ? 'RE' : typ === 'angebot' ? 'AN' : 'GU';
        const year = new Date().getFullYear();
        // Existierende Nummern laden, um Duplikate zu vermeiden (Schutz vor Counter-Desync)
        const existingNrs = new Set((this._rechGet('dokumente') || []).map(i => i.nummer || ''));
        let candidate;
        do {
            counter[prefix] = (counter[prefix] || 0) + 1;
            candidate = `${prefix}-${year}-${String(counter[prefix]).padStart(3, '0')}`;
        } while (existingNrs.has(candidate));
        this._rechSet('invoice_counter', counter);
        return candidate;
    },

    // ============================================
    // Invoice → Sale Connector (Rechnungsbuch → Reselling)
    // ============================================

    createSaleFromInvoice(invoice, platform, purchaseId, manualEK) {
        const settings = this.getSettings();
        const isKlein = settings.ustMode === 'klein';
        let brutto = 0;
        (invoice.positionen || []).forEach(p => {
            const netto = (p.menge || 0) * (p.einzelpreis || 0);
            const mwst = isKlein ? 0 : netto * (p.mwstSatz || 0) / 100;
            brutto += netto + mwst;
        });

        const customers = this.getRechCustomers();
        const kunde = customers.find(c => c.id === invoice.kundeId);
        const kundeName = kunde ? (kunde.firma || kunde.ansprechpartner || '') : '';

        let linkedPurchaseId = purchaseId || null;

        // Manueller EK: eigenen Einkaufseintrag anlegen
        if (!linkedPurchaseId && manualEK !== null && manualEK !== undefined && manualEK !== '') {
            const ekBetrag = parseFloat(manualEK) || 0;
            if (ekBetrag > 0) {
                const purchase = {
                    datum: invoice.datum,
                    marke: 'Rechnung',
                    artikeltyp: 'Rechnung',
                    beschreibung: 'EK zu ' + (invoice.nummer || ''),
                    einkaufspreis: ekBetrag,
                    anzahl: 1,
                    einkaufsquelle: 'Direktverkauf / Privat',
                    status: 'verkauft',
                    _invoiceId: invoice.id
                };
                const saved = this.savePurchase(purchase);
                linkedPurchaseId = saved.id;
            }
        }

        const sale = {
            datum: invoice.bezahltAm || invoice.datum,
            marke: 'Rechnung',
            artikeltyp: 'Rechnung',
            beschreibung: (invoice.nummer || '') + (kundeName ? ' – ' + kundeName : ''),
            verkaufsplattform: platform || invoice.verkaufsplattform || '',
            verkaufspreis: brutto,
            versandkostenKaeufer: 0,
            plattformgebuehrProzent: 0,
            versandkostenVerkaufer: 0,
            purchaseId: linkedPurchaseId,
            _invoiceId: invoice.id,
            _typ: 'rechnung'
        };

        return this.saveSale(sale);
    },

    // ============================================
    // Utilities
    // ============================================

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    setCompany(id) {
        this._companyId = id || '';
        // Cache-Keys der anderen Firmen müssen nicht gelöscht werden —
        // get() / set() nutzen jetzt automatisch den neuen Prefix
        console.log('[Store] Aktive Firma:', id || '(keine)');
    },

    // Eigenbelege-Schlüssel (localStorage-only, nicht im IDB-Cache)
    _EIGENBELEG_KEYS: [
        'eigenbelege_belege', 'eigenbelege_kategorien',
        'eigenbelege_einstellungen', 'eigenbelege_naechste_nummer', 'eigenbelege_produkte'
    ],
    // App-Einstellungen die im Backup mitgesichert werden (global, NICHT firmenspezifisch).
    // app_einstellungen wurde entfernt: Firmen-Stammdaten liegen jetzt firmen-präfixiert
    // in eigenbelege_einstellungen (siehe _EIGENBELEG_KEYS) und werden dort gesichert.
    _APP_SETTING_KEYS: ['app_theme', 'theme'],
    // Firmen-Registry (global, nicht company-namespaced)
    _COMPANY_KEYS: ['oyi_companies', 'oyi_active_company'],

    exportAll() {
        const data = {};
        const pfx     = this._prefix;
        const rPfx    = this._rechPrefix;
        const aKey    = this._auditKey;
        for (const [key, val] of Object.entries(this._cache)) {
            if (key.startsWith(pfx) || key.startsWith(rPfx) || key === aKey) {
                data[key] = val;
            }
        }

        // Eigenbelege (liegen nur in localStorage, nicht im IDB-Cache) — company-präfixiert lesen
        const ebData = {};
        const ebPfx  = this._ebKeyPrefix;
        this._EIGENBELEG_KEYS.forEach(k => {
            const v = localStorage.getItem(ebPfx + k);
            if (v && v !== '[]' && v !== '{}') ebData[k] = v;   // unter Roh-Key sichern → Import remappt auf Ziel-Firma
        });
        if (Object.keys(ebData).length) data._eigenbelege = JSON.stringify(ebData);

        // App-Einstellungen (Theme, Sprache etc.)
        const apData = {};
        this._APP_SETTING_KEYS.forEach(k => {
            const v = localStorage.getItem(k);
            if (v) apData[k] = v;
        });
        if (Object.keys(apData).length) data._appSettings = JSON.stringify(apData);

        // Firmen-Registry (oyi_companies + oyi_active_company)
        const coData = {};
        this._COMPANY_KEYS.forEach(k => {
            const v = localStorage.getItem(k);
            if (v && v !== '[]') coData[k] = v;
        });
        if (Object.keys(coData).length) data._companies = JSON.stringify(coData);

        const co = (typeof CompanyManager !== 'undefined') ? CompanyManager.getActive() : null;
        data._exportMeta = JSON.stringify({
            exportDate:      new Date().toISOString(),
            appVersion:      typeof App !== 'undefined' ? App.APP_VERSION : '?',
            companyId:       this._companyId || '',
            companyName:     co ? co.name : '',
            auditEntryCount: this.getAuditLog().length,
            hasEigenbelege:  !!data._eigenbelege,
            checksum:        this._calcChecksum(JSON.stringify(data))
        });
        return JSON.stringify(data, null, 2);
    },

    importAll(jsonStr) {
        let data;
        try {
            data = JSON.parse(jsonStr);
        } catch (e) {
            Utils.showToast('Backup-Datei ungültig — kein gültiges JSON. Datei möglicherweise beschädigt.', 'error');
            return false;
        }

        // ── Prüfsummen-Verifikation (B) ──────────────────────────────────────
        if (data._exportMeta) {
            try {
                const meta = JSON.parse(data._exportMeta);
                if (meta.checksum) {
                    const copy = Object.assign({}, data);
                    delete copy._exportMeta;
                    const actual = this._calcChecksum(JSON.stringify(copy));
                    if (actual !== meta.checksum) {
                        throw new Error(
                            'Prüfsumme ungültig – die Backup-Datei könnte beschädigt oder verändert worden sein.\n\n' +
                            'Import trotzdem fortsetzen?'
                        );
                    }
                }
            } catch(e) {
                if (e.message.includes('Prüfsumme')) {
                    if (!confirm(e.message)) throw new Error('Import abgebrochen');
                }
                // JSON-Parse-Fehler in meta → ignorieren, trotzdem importieren
            }
        }

        this._addAuditEntry('import', 'system', 'backup', null, null, 'Daten-Import durchgefuehrt');
        const curPfx  = this._prefix;
        const curRPfx = this._rechPrefix;
        const curAKey = this._auditKey;

        // ── Schritt 1: Alte Daten der aktiven Firma aus Cache + IDB löschen ─
        // Verhindert "Datenmix" zwischen altem Stand und Backup-Stand.
        // Audit-Log wird NICHT gelöscht (GoBD).
        const keysToDelete = Object.keys(this._cache).filter(k =>
            k.startsWith(curPfx) || k.startsWith(curRPfx)
        );
        keysToDelete.forEach(k => {
            delete this._cache[k];
            this._idbDelete(k);
        });

        // ── Schritt 2: Backup-Keys auf Ziel-Prefix mappen ────────────────────
        // Backup kann von einer anderen Firma stammen — Prefix wird remappt.
        const entries = []; // { key, value } für Bulk-Transaktion
        for (const [key, value] of Object.entries(data)) {
            if (key.startsWith('_')) continue; // Meta-Keys überspringen

            let targetKey = null;
            if (key.startsWith(curPfx) || key.startsWith(curRPfx) || key === curAKey) {
                targetKey = key;
            } else {
                const rawKey = key.replace(/^co_[a-z0-9_]+__/, '');
                if (rawKey.startsWith('reselling_')) {
                    targetKey = curPfx + rawKey.slice('reselling_'.length);
                } else if (rawKey.startsWith('rechnungsbuch_')) {
                    targetKey = curRPfx + rawKey.slice('rechnungsbuch_'.length);
                } else if (rawKey === 'audit_log') {
                    targetKey = curAKey;
                }
            }
            if (targetKey) {
                this._cache[targetKey] = value; // sofort in Memory
                entries.push({ k: targetKey, v: value });
            }
        }

        // ── Schritt 3: Atomare Bulk-Transaktion — alles oder nichts ──────────
        this._idbPutBatch(entries);

        // ── Eigenbelege wiederherstellen (in die AKTIVE Firma) ───────────────
        if (data._eigenbelege) {
            try {
                const ebData = JSON.parse(data._eigenbelege);
                const ebPfx  = this._ebKeyPrefix;
                Object.entries(ebData).forEach(([k, v]) => {
                    // Roh-Key ggf. von altem Firmen-Prefix bereinigen, dann auf Ziel-Firma mappen
                    const rawKey = k.replace(/^co_[a-z0-9_]+__/, '');
                    localStorage.setItem(ebPfx + rawKey, v);
                });
            } catch(e) {}
        }

        // ── App-Einstellungen wiederherstellen ───────────────────────────────
        if (data._appSettings) {
            try {
                const apData = JSON.parse(data._appSettings);
                Object.entries(apData).forEach(([k, v]) => {
                    // Veraltete/firmenübergreifende Keys (z.B. app_einstellungen aus Alt-Backups)
                    // nicht wiederherstellen → kein Datenleck reintroduzieren.
                    if (!this._APP_SETTING_KEYS.includes(k)) return;
                    if (!localStorage.getItem(k)) localStorage.setItem(k, v);
                });
            } catch(e) {}
        }

        // ── Firmen-Registry wiederherstellen ─────────────────────────────────
        // Nur wenn das Zielsystem noch keine Firmen hat (kein Überschreiben).
        if (data._companies) {
            try {
                const noCompanies = !localStorage.getItem('oyi_companies') ||
                                    JSON.parse(localStorage.getItem('oyi_companies') || '[]').length === 0;
                if (noCompanies) {
                    const coData = JSON.parse(data._companies);
                    Object.entries(coData).forEach(([k, v]) => localStorage.setItem(k, v));
                }
            } catch(e) {}
        }
    },

    // ── Atomare Bulk-Transaktion: schreibt alle Einträge in einer IDB-Transaktion ──
    // Entweder alles oder nichts — verhindert Teilimporte bei Abbruch.
    _idbPutBatch(entries) {
        if (!this._mainIdbReady || !this._mainIdb || !entries.length) return;
        try {
            const tx = this._mainIdb.transaction(this.MAIN_IDB_KV, 'readwrite');
            const os = tx.objectStore(this.MAIN_IDB_KV);
            entries.forEach(({ k, v }) => os.put({ k, v }));
            tx.onerror = (ev) => {
                const err = ev.target && ev.target.error;
                console.error('[Store] _idbPutBatch Transaktion fehlgeschlagen:', err);
                if (err && err.name === 'QuotaExceededError') {
                    if (typeof Utils !== 'undefined' && Utils.showToast) {
                        Utils.showToast('⚠️ Speicher voll! Backup konnte nicht vollständig geschrieben werden.', 'error');
                    }
                }
            };
            tx.onabort = (ev) => {
                console.error('[Store] _idbPutBatch Transaktion abgebrochen:', ev.target && ev.target.error);
            };
        } catch(e) {
            console.error('[Store] _idbPutBatch Exception:', e);
        }
    },

    // Synchronisiert bezahlte Rechnungen automatisch als Verkaufseintraege
    autoSyncInvoices() {
        try {
            const invoices = this.getRechInvoices ? this.getRechInvoices() : [];
            const allSales = this.getAllSalesRaw();
            const syncedIds = new Set(allSales.filter(s => s._invoiceId).map(s => s._invoiceId));
            invoices.forEach(inv => {
                if (inv.status === 'bezahlt' && inv.typ === 'rechnung' && !syncedIds.has(inv.id)) {
                    this.createSaleFromInvoice(inv, inv.verkaufsplattform || '', null, null);
                    syncedIds.add(inv.id); // doppelten sync verhindern
                }
            });
        } catch(e) {}
    },

    // ---- Retouren ----
    getRetouren() {
        try { return JSON.parse(this._cache[this._prefix + 'retouren'] || '[]'); } catch(e) { return []; }
    },

    nextRetourenNumber() {
        const all = this.getRetouren();
        const year = new Date().getFullYear();
        const n = all.filter(r => r.nummer && r.nummer.startsWith('RT-' + year + '-')).length + 1;
        return `RT-${year}-${String(n).padStart(3, '0')}`;
    },

    saveRetoure(r) {
        const all = this.getRetouren();
        if (!r.id) { r.id = this.generateId(); r.createdAt = new Date().toISOString(); r.nummer = this.nextRetourenNumber(); }
        const idx = all.findIndex(x => x.id === r.id);
        if (idx >= 0) all[idx] = r; else all.push(r);
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'retouren'] = str;
        this._idbPut(this._prefix + 'retouren', str);
        this._triggerAutoBackup();
        return r;
    },

    deleteRetoure(id) {
        const all = this.getRetouren().filter(r => r.id !== id);
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'retouren'] = str;
        this._idbPut(this._prefix + 'retouren', str);
        this._triggerAutoBackup();
    },

    // ---- Fahrtenbuch ----
    getFahrten() {
        try { return JSON.parse(this._cache[this._prefix + 'fahrtenbuch'] || '[]'); } catch(e) { return []; }
    },

    saveFahrt(f) {
        const all = this.getFahrten();
        const isNew = !f.id;
        if (isNew) { f.id = this.generateId(); f.createdAt = new Date().toISOString(); }
        const idx = all.findIndex(x => x.id === f.id);
        const old = idx >= 0 ? Object.assign({}, all[idx]) : null;
        if (old && this.isLocked(old)) return f; // GoBD: festgeschriebene/stornierte Fahrt nicht bearbeitbar
        if (idx >= 0) all[idx] = f; else all.push(f);
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'fahrtenbuch'] = str;
        this._idbPut(this._prefix + 'fahrtenbuch', str);
        this._addAuditEntry(isNew ? 'erstellt' : 'bearbeitet', 'fahrt', f.id, old, f, isNew ? 'Fahrt erstellt' : 'Fahrt bearbeitet');
        this._triggerAutoBackup();
        return f;
    },

    deleteFahrt(id, grund) {
        // GoBD §146 AO: Physisches Löschen verboten — Eintrag stornieren statt löschen
        const all = this.getFahrten();
        const idx = all.findIndex(f => f.id === id);
        if (idx < 0) return;
        const old = Object.assign({}, all[idx]);
        all[idx] = Object.assign({}, all[idx], {
            storniert:   true,
            stornoGrund: grund || 'Manuell storniert',
            stornoAt:    new Date().toISOString()
        });
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'fahrtenbuch'] = str;
        this._idbPut(this._prefix + 'fahrtenbuch', str);
        this._addAuditEntry('storniert', 'fahrt', id, old, all[idx], grund || 'Fahrtenbucheintrag storniert');
        this._triggerAutoBackup();
    },

    // ---- Kassenbuch ----
    getKassenbuch() {
        try { return JSON.parse(this._cache[this._prefix + 'kassenbuch'] || '[]'); } catch(e) { return []; }
    },

    saveKassenEintrag(e) {
        const all = this.getKassenbuch();
        if (!e.id) { e.id = this.generateId(); e.createdAt = new Date().toISOString(); }
        const idx = all.findIndex(x => x.id === e.id);
        if (idx >= 0 && this.isLocked(all[idx])) return e; // GoBD: festgeschriebener/stornierter Kasseneintrag nicht bearbeitbar
        if (idx >= 0) all[idx] = e; else all.push(e);
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'kassenbuch'] = str;
        this._idbPut(this._prefix + 'kassenbuch', str);
        this._triggerAutoBackup();
        return e;
    },

    deleteKassenEintrag(id, grund) {
        // GoBD §146 AO: Physisches Löschen verboten — Eintrag stornieren statt löschen
        const all = this.getKassenbuch();
        const idx = all.findIndex(e => e.id === id);
        if (idx < 0) return;
        const old = Object.assign({}, all[idx]);
        all[idx] = Object.assign({}, all[idx], {
            storniert:   true,
            stornoGrund: grund || 'Manuell storniert',
            stornoAt:    new Date().toISOString()
        });
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'kassenbuch'] = str;
        this._idbPut(this._prefix + 'kassenbuch', str);
        this._addAuditEntry('storniert', 'kassenbuch', id, old, all[idx], grund || 'Kassenbucheintrag storniert');
        this._triggerAutoBackup();
    },

    // ---- Steuertermine ----
    getSteuertermine() {
        return JSON.parse(this._cache[this._prefix + 'steuertermine'] || '[]');
    },

    saveSteuertermin(t) {
        const all = this.getSteuertermine();
        if (!t.id) { t.id = this.generateId(); t.createdAt = new Date().toISOString(); }
        const idx = all.findIndex(x => x.id === t.id);
        if (idx >= 0) all[idx] = t; else all.push(t);
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'steuertermine'] = str;
        this._idbPut(this._prefix + 'steuertermine', str);
        this._triggerAutoBackup();
        return t;
    },

    deleteSteuertermin(id) {
        const all = this.getSteuertermine().filter(t => t.id !== id);
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'steuertermine'] = str;
        this._idbPut(this._prefix + 'steuertermine', str);
        this._triggerAutoBackup();
    },

    // ---- Plattformgebühren-Defaults ----
    getPlattformGebuehren() {
        const defaults = {
            'Vinted': { prozent: 5, fixbetrag: 0.70 },
            'eBay': { prozent: 10, fixbetrag: 0 },
            'eBay KA': { prozent: 0, fixbetrag: 0 },
            'Depop': { prozent: 10, fixbetrag: 0 },
            'StockX': { prozent: 9, fixbetrag: 0 },
            'GOAT': { prozent: 9.5, fixbetrag: 0 },
            'Vestiaire': { prozent: 12, fixbetrag: 0 },
            'Facebook': { prozent: 0, fixbetrag: 0 },
            'Instagram': { prozent: 0, fixbetrag: 0 },
            'Privat': { prozent: 0, fixbetrag: 0 }
        };
        const saved = JSON.parse(this._cache[this._prefix + 'plattformgebuehren'] || '{}');
        return Object.assign({}, defaults, saved);
    },

    savePlattformGebuehren(data) {
        const str = JSON.stringify(data);
        this._cache[this._prefix + 'plattformgebuehren'] = str;
        this._idbPut(this._prefix + 'plattformgebuehren', str);
        this._triggerAutoBackup();
    },

    // ---- Fahrtenbuch Extensions ----
    nextFahrtNumber() {
        const all = this.getFahrten();
        const year = new Date().getFullYear();
        const n = all.filter(f => f.nummer && f.nummer.startsWith('FT-' + year + '-')).length + 1;
        return `FT-${year}-${String(n).padStart(3, '0')}`;
    },

    getFahrtOrte() {
        return JSON.parse(this._cache[this._prefix + 'fahrtenbuch_orte'] || '[]');
    },

    saveFahrtOrte(orte) {
        const str = JSON.stringify(orte);
        this._cache[this._prefix + 'fahrtenbuch_orte'] = str;
        this._idbPut(this._prefix + 'fahrtenbuch_orte', str);
    },

    addFahrtOrt(ort) {
        if (!ort || !ort.trim()) return;
        const orte = this.getFahrtOrte();
        const trimmed = ort.trim();
        if (!orte.includes(trimmed)) {
            orte.unshift(trimmed);
            if (orte.length > 50) orte.pop();
            this.saveFahrtOrte(orte);
        }
    },

    // ---- Materiallager ----
    getMaterialBestand() {
        return JSON.parse(this._cache[this._prefix + 'materiallager_bestand'] || '[]');
    },

    saveMaterialBestandItem(item) {
        const all = this.getMaterialBestand();
        if (!item.id) { item.id = this.generateId(); item.erstelltAm = new Date().toISOString(); }
        const idx = all.findIndex(x => x.id === item.id);
        if (idx >= 0) all[idx] = item; else all.push(item);
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'materiallager_bestand'] = str;
        this._idbPut(this._prefix + 'materiallager_bestand', str);
        this._triggerAutoBackup();
        return item;
    },

    deleteMaterialBestandItem(id) {
        const all = this.getMaterialBestand().filter(x => x.id !== id);
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'materiallager_bestand'] = str;
        this._idbPut(this._prefix + 'materiallager_bestand', str);
        this._triggerAutoBackup();
    },

    getMaterialEinkauefe() {
        return JSON.parse(this._cache[this._prefix + 'materiallager_einkauefe'] || '[]');
    },

    saveMaterialEinkauf(e) {
        const all = this.getMaterialEinkauefe();
        if (!e.id) { e.id = this.generateId(); e.erstelltAm = new Date().toISOString(); }
        const idx = all.findIndex(x => x.id === e.id);
        if (idx >= 0) all[idx] = e; else all.push(e);
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'materiallager_einkauefe'] = str;
        this._idbPut(this._prefix + 'materiallager_einkauefe', str);
        this._triggerAutoBackup();
        return e;
    },

    deleteMaterialEinkauf(id) {
        const all = this.getMaterialEinkauefe().filter(x => x.id !== id);
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'materiallager_einkauefe'] = str;
        this._idbPut(this._prefix + 'materiallager_einkauefe', str);
        this._triggerAutoBackup();
    },

    getMaterialVerbrauch() {
        return JSON.parse(this._cache[this._prefix + 'materiallager_verbrauch'] || '[]');
    },

    saveMaterialVerbrauchEintrag(v) {
        const all = this.getMaterialVerbrauch();
        if (!v.id) { v.id = this.generateId(); v.erstelltAm = new Date().toISOString(); }
        const idx = all.findIndex(x => x.id === v.id);
        if (idx >= 0) all[idx] = v; else all.push(v);
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'materiallager_verbrauch'] = str;
        this._idbPut(this._prefix + 'materiallager_verbrauch', str);
        this._triggerAutoBackup();
        return v;
    },

    deleteMaterialVerbrauchEintrag(id) {
        const all = this.getMaterialVerbrauch().filter(x => x.id !== id);
        const str = JSON.stringify(all);
        this._cache[this._prefix + 'materiallager_verbrauch'] = str;
        this._idbPut(this._prefix + 'materiallager_verbrauch', str);
        this._triggerAutoBackup();
    },

    bookMaterialVerbrauch(items, datum, grund, referenzId, referenzBez) {
        const bestand = this.getMaterialBestand();
        const ergebnis = [];
        (items || []).forEach(({ materialId, menge }) => {
            if (!menge || menge <= 0) return;
            const mat = bestand.find(b => b.id === materialId);
            if (!mat) return;
            const kosten = Math.round((parseFloat(mat.kostenProEinheit) || 0) * menge * 100) / 100;
            mat.bestand = Math.max(0, (parseInt(mat.bestand) || 0) - menge);
            this.saveMaterialBestandItem(mat);
            ergebnis.push(this.saveMaterialVerbrauchEintrag({
                datum: datum || new Date().toISOString().split('T')[0],
                materialId, materialName: mat.name, einheit: mat.einheit || 'Stück',
                menge, kostenProEinheit: parseFloat(mat.kostenProEinheit) || 0, kosten,
                grund: grund || 'manuell', referenzId: referenzId || null,
                referenzBez: referenzBez || '', storniert: false
            }));
        });
        return ergebnis;
    },

    revertMaterialVerbrauch(referenzId) {
        if (!referenzId) return;
        const bestand = this.getMaterialBestand();
        this.getMaterialVerbrauch()
            .filter(v => v.referenzId === referenzId && !v.storniert)
            .forEach(v => {
                const mat = bestand.find(b => b.id === v.materialId);
                if (mat) {
                    mat.bestand = (parseInt(mat.bestand) || 0) + (parseInt(v.menge) || 0);
                    this.saveMaterialBestandItem(mat);
                }
                v.storniert = true;
                this.saveMaterialVerbrauchEintrag(v);
            });
    },

    clearAll() {
        // GoBD: Audit-Log wird NICHT geloescht
        this._addAuditEntry('loeschung', 'system', 'alle', null, null, 'Alle Geschaeftsdaten geloescht (Audit-Log bleibt erhalten)');

        // 1. Haupt-Daten der AKTIVEN FIRMA aus Cache + IDB löschen (andere Firmen unangetastet)
        const pfx  = this._prefix;
        const rPfx = this._rechPrefix;
        const keysToDelete = Object.keys(this._cache).filter(k =>
            k.startsWith(pfx) || k.startsWith(rPfx)
        );
        keysToDelete.forEach(k => {
            delete this._cache[k];
            this._idbDelete(k);
        });

        // 2. Eigenbelege-Daten der AKTIVEN FIRMA (company-präfixierte localStorage-Keys)
        const ebPfx = this._ebKeyPrefix;
        this._EIGENBELEG_KEYS.forEach(k => localStorage.removeItem(ebPfx + k));

        // 3. Akademie-Achievements (basieren auf Geschäftsdaten — werden sonst inkonsistent)
        localStorage.removeItem('akademie_progress');
        localStorage.removeItem('akademie_flag_eur_exported');

        // 4. Sentinel + Mirror zurücksetzen (kein Auto-Recovery beim Reload)
        localStorage.removeItem('_oyi_sentinel');
        localStorage.removeItem('_oyi_lsmirror');
        localStorage.removeItem('_oyi_lsmirror_ts');
        sessionStorage.removeItem('_oyi_sentinel');

        // Audit-Log + UI-Präferenzen + App-Einstellungen + Backup-Konfiguration bleiben erhalten!
    },

    // ============================================================
    // DATENVERLUST-PRÄVENTION — 5-Schicht Schutzsystem
    // ============================================================

    // SCHICHT 1 — Sentinel: merkt wie viele Datensätze zuletzt vorhanden waren.
    // Wird nach jeder Änderung in localStorage UND sessionStorage geschrieben.
    // sessionStorage überlebt Browser-Bereinigungen NICHT, aber erkennt
    // Verluste innerhalb derselben Sitzung sofort.
    _trackDataCounts() {
        try {
            const counts = {
                p:  this.getAllPurchasesRaw().length,
                s:  this.getAllSalesRaw().length,
                e:  this.getAllExpensesRaw().length,
                co: this._companyId,   // Firma mitmerken → verhindert Fehlalarm nach Firmenwechsel
                t:  Date.now()
            };
            const str = JSON.stringify(counts);
            localStorage.setItem('_oyi_sentinel', str);
            sessionStorage.setItem('_oyi_sentinel', str);
        } catch(e) {}
    },

    // Gibt true zurück wenn der Sentinel signifikanten Verlust meldet.
    // "Signifikant" = wir hatten >2 Datensätze, jetzt sind es 0.
    // Stornierungen oder manuelle Löschungen erzeugen keinen False-Positive
    // weil die RAW-Liste sie weiterhin enthält.
    _detectDataLoss() {
        try {
            // sessionStorage zuerst (nur innerhalb Session gültig, aber zuverlässiger)
            const raw = sessionStorage.getItem('_oyi_sentinel') ||
                        localStorage.getItem('_oyi_sentinel');
            if (!raw) return false;
            const prev = JSON.parse(raw);
            const prevTotal = (prev.p || 0) + (prev.s || 0);
            if (prevTotal < 3) return false;   // zu wenig Daten → kein Verlust-Alarm

            // Sentinel für eine andere Firma → nicht auswertbar (kein Fehlalarm)
            if (prev.co !== undefined && prev.co !== this._companyId) return false;

            // ── Datenzählung ──────────────────────────────────────────────────
            // Problem: initWithRecovery() läuft VOR Store.setCompany(), d.h. _companyId
            // ist noch '' wenn dieser Check läuft. getAllPurchasesRaw() würde dann
            // 'reselling_purchases' statt 'co_xxx__reselling_purchases' lesen → immer 0.
            // Lösung: wenn kein Prefix gesetzt, alle passenden Cache-Keys aufsummieren.
            let curTotal;
            if (!this._companyId) {
                curTotal = 0;
                for (const k of Object.keys(this._cache)) {
                    if (k.endsWith('reselling_purchases') || k.endsWith('reselling_sales')) {
                        try {
                            const arr = JSON.parse(this._cache[k]);
                            if (Array.isArray(arr)) curTotal += arr.length;
                        } catch(e) {}
                    }
                }
            } else {
                curTotal = this.getAllPurchasesRaw().length + this.getAllSalesRaw().length;
            }

            return curTotal === 0;  // vorher Daten, jetzt nichts → Verlust
        } catch(e) { return false; }
    },

    // SCHICHT 2 — Auto-Recovery: versucht systematisch aus allen Quellen zu retten.
    // Reihenfolge: LS-Spiegel → IDB-Snapshots → Raw-LS
    async _autoRecover() {
        console.warn('[Store] ⚠️ Datenverlust erkannt — starte Auto-Recovery…');

        // 2a) localStorage-Spiegel (wird nach jeder Änderung geschrieben)
        const lsMirror = localStorage.getItem('_oyi_lsmirror');
        if (lsMirror) {
            try {
                const parsed = JSON.parse(lsMirror);
                // Stichprobe: hat er tatsächlich Daten?
                const hasData = Object.keys(parsed).some(k =>
                    (k.startsWith(this._prefix) || k.startsWith(this._rechPrefix)) &&
                    k !== '_exportMeta');
                if (hasData) {
                    this.importAll(lsMirror);
                    this._trackDataCounts();
                    console.log('[Store] ✅ Auto-Recovery aus localStorage-Spiegel');
                    return { source: 'lsmirror', ts: localStorage.getItem('_oyi_lsmirror_ts') };
                }
            } catch(e) {}
        }

        // 2b) IDB Auto-Backup Snapshots (neuester zuerst)
        try {
            const snapshots = await this.getIDBSnapshots();
            for (const snap of snapshots) {
                try {
                    const parsed = JSON.parse(snap.data);
                    const hasData = Object.keys(parsed).some(k =>
                        (k.startsWith(this._prefix) || k.startsWith(this._rechPrefix)));
                    if (hasData) {
                        await this.restoreFromIDBSnapshot(snap.id);
                        this._trackDataCounts();
                        console.log('[Store] ✅ Auto-Recovery aus IDB-Snapshot', snap.ts);
                        return { source: 'idb_snapshot', ts: snap.ts };
                    }
                } catch(e) { continue; }
            }
        } catch(e) {}

        // 2c) Raw localStorage-Schlüssel (ursprüngliche Migration)
        const rawMoved = this.restoreFromLocalStorageRaw();
        if (rawMoved > 0) {
            this._trackDataCounts();
            console.log('[Store] ✅ Auto-Recovery aus raw localStorage:', rawMoved, 'Schlüssel');
            return { source: 'ls_raw', ts: null };
        }

        console.error('[Store] ❌ Auto-Recovery fehlgeschlagen — keine Quelle vorhanden');
        return null;
    },

    // SCHICHT 3 — initWithRecovery: ersetzt initMainIDB() als Haupteinstieg.
    // Führt vollständigen Start mit Integritätsprüfung und ggf. Auto-Recovery durch.
    initWithRecovery() {
        return this.initMainIDB().then(async () => {
            const lossDetected = this._detectDataLoss();
            if (lossDetected) {
                const result = await this._autoRecover();
                return { lossDetected: true, recovered: result };
            }
            // Sentinel nach erfolgreichem Start aktualisieren
            this._trackDataCounts();
            return { lossDetected: false, recovered: null };
        });
    },

    // ── SVS (Österreich) — Vorauszahlungen ──────────────────────────────────
    getSvsVorauszahlungen() {
        return this.get('svs_vorauszahlungen') || [];
    },

    saveSvsVorauszahlungen(data) {
        this.set('svs_vorauszahlungen', data);
    },

    // ── GbR — Gesellschaft bürgerlichen Rechts ───────────────────────────────
    getGbrEinstellungen() {
        return this.get('gbr_einstellungen') || { firmenform: 'Einzelunternehmen', hebesatz: 400 };
    },
    saveGbrEinstellungen(data) { this.set('gbr_einstellungen', data); },

    getGbrGesellschafter() {
        return this.get('gbr_gesellschafter') || [];
    },
    saveGbrGesellschafter(list) { this.set('gbr_gesellschafter', list); },
};
