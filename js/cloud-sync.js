// ============================================
// CloudSync — Hybride Sync-Schicht
//
// Architektur:
//   LocalStorage/IDB  = schneller lokaler Cache
//   Supabase          = Cloud-Master-Datenbank
//
// Funktionsweise:
//   1. Store._idbPut wird gepatcht → schreibt auch in Cloud
//   2. pullAll()  → Cloud → IDB/Cache (beim Login)
//   3. pushAll()  → IDB/Cache → Cloud (Migration)
// ============================================
var CloudSync = (function () {
    'use strict';

    var _userId      = null;
    var _enabled     = false;
    var _origIdbPut  = null;    // Original Store._idbPut vor dem Patch
    var _patched     = false;

    // Write-Queue (debounced batch-upload)
    var _pending     = {};      // key → valueStr  (de-dupliziert)
    var _flushTimer  = null;
    var _syncing     = false;

    // Status-Callbacks
    var _listeners   = [];

    // ──────────────────────────────────────────
    // Status-Verwaltung
    // ──────────────────────────────────────────
    function _setStatus(s) {
        _listeners.forEach(function (fn) { try { fn(s); } catch (e) {} });
        var dot = document.getElementById('cloudSyncDot');
        if (!dot) return;
        var cfg = {
            idle:    { icon: '☁',  color: 'var(--success,#22c55e)', title: 'Cloud-Sync aktiv' },
            syncing: { icon: '↻',  color: 'var(--accent,#10b981)',  title: 'Synchronisiere...' },
            error:   { icon: '⚠',  color: '#ef4444',                title: 'Sync-Fehler' },
            offline: { icon: '☁',  color: '#888',                   title: 'Nicht angemeldet' }
        };
        var c = cfg[s] || cfg.offline;
        dot.textContent   = c.icon;
        dot.style.color   = c.color;
        dot.title         = c.title;
    }

    // ──────────────────────────────────────────
    // Aktivierung / Deaktivierung
    // ──────────────────────────────────────────
    function enable(userId) {
        _userId  = userId;
        _enabled = true;
        _patchStore();
        _setStatus('idle');
    }

    function disable() {
        _userId  = null;
        _enabled = false;
        _setStatus('offline');
    }

    function isEnabled() { return _enabled && !!_userId; }

    // ──────────────────────────────────────────
    // Store._idbPut — Monkey-Patch
    // Intercept alle lokalen Schreibvorgänge und
    // leitet sie zusätzlich in die Cloud weiter.
    // ──────────────────────────────────────────
    function _patchStore() {
        if (_patched || typeof Store === 'undefined') return;
        _patched    = true;
        _origIdbPut = Store._idbPut.bind(Store);   // Original mit richtigem `this` merken

        Store._idbPut = function (key, valueStr) {
            _origIdbPut(key, valueStr);             // Lokales IDB-Schreiben unverändert
            if (_enabled && _userId && Store._isCacheableKey && Store._isCacheableKey(key)) {
                _queue(key, valueStr);
            }
        };
    }

    // ──────────────────────────────────────────
    // Write-Queue (Debounce → Batch-Upload)
    // ──────────────────────────────────────────
    function _queue(key, valueStr) {
        _pending[key] = valueStr;
        clearTimeout(_flushTimer);
        _flushTimer = setTimeout(_flush, 800);
    }

    async function _flush() {
        if (!isEnabled() || Object.keys(_pending).length === 0 || _syncing) return;

        var client = SupabaseDB.getClient();
        if (!client) return;

        _syncing = true;
        _setStatus('syncing');

        var batch  = Object.assign({}, _pending);
        _pending   = {};

        var rows = [];
        Object.keys(batch).forEach(function (key) {
            try {
                rows.push({
                    user_id:     _userId,
                    store_key:   key,
                    store_value: JSON.parse(batch[key]),
                    updated_at:  new Date().toISOString()
                });
            } catch (e) {}
        });

        if (rows.length === 0) { _syncing = false; _setStatus('idle'); return; }

        try {
            var res = await client
                .from('user_data')
                .upsert(rows, { onConflict: 'user_id,store_key' });
            if (res.error) throw res.error;
            _setStatus('idle');
        } catch (e) {
            console.warn('[CloudSync] Flush fehlgeschlagen:', e.message || e);
            Object.assign(_pending, batch);         // Zurück in Queue für Retry
            _setStatus('error');
            setTimeout(_flush, 15000);              // Retry in 15 s
        }

        _syncing = false;
    }

    // ──────────────────────────────────────────
    // pullAll — Cloud → lokal (beim Login)
    // ──────────────────────────────────────────
    async function pullAll(onProgress) {
        var client = SupabaseDB.getClient();
        if (!client || !_userId) return 0;

        _setStatus('syncing');
        try {
            var res = await client
                .from('user_data')
                .select('store_key, store_value')
                .eq('user_id', _userId);

            if (res.error) throw res.error;
            var data = res.data || [];
            if (data.length === 0) { _setStatus('idle'); return 0; }

            // Original-IdbPut nutzen (kein Circular-Sync zurück in Cloud)
            var writeFn = _origIdbPut || Store._idbPut.bind(Store);

            data.forEach(function (row, i) {
                var str = JSON.stringify(row.store_value);
                Store._cache[row.store_key] = str;
                writeFn(row.store_key, str);
                if (onProgress) onProgress(i + 1, data.length);
            });

            _setStatus('idle');
            return data.length;
        } catch (e) {
            console.error('[CloudSync] pullAll fehlgeschlagen:', e.message || e);
            _setStatus('error');
            return 0;
        }
    }

    // ──────────────────────────────────────────
    // pushAll — lokal → Cloud (Migration)
    // ──────────────────────────────────────────
    async function pushAll(onProgress) {
        var client = SupabaseDB.getClient();
        if (!client || !_userId) return 0;

        _setStatus('syncing');

        var rows = [];
        Object.keys(Store._cache).forEach(function (key) {
            if (!Store._isCacheableKey || !Store._isCacheableKey(key)) return;
            try {
                rows.push({
                    user_id:     _userId,
                    store_key:   key,
                    store_value: JSON.parse(Store._cache[key]),
                    updated_at:  new Date().toISOString()
                });
            } catch (e) {}
        });

        if (rows.length === 0) { _setStatus('idle'); return 0; }

        try {
            for (var i = 0; i < rows.length; i += 100) {
                var chunk = rows.slice(i, i + 100);
                var res = await client
                    .from('user_data')
                    .upsert(chunk, { onConflict: 'user_id,store_key' });
                if (res.error) throw res.error;
                if (onProgress) onProgress(Math.min(i + 100, rows.length), rows.length);
            }
            _setStatus('idle');
            return rows.length;
        } catch (e) {
            console.error('[CloudSync] pushAll fehlgeschlagen:', e.message || e);
            _setStatus('error');
            return 0;
        }
    }

    // ──────────────────────────────────────────
    // Hilfsfunktionen
    // ──────────────────────────────────────────
    async function hasCloudData() {
        var client = SupabaseDB.getClient();
        if (!client || !_userId) return false;
        try {
            var res = await client
                .from('user_data')
                .select('store_key', { count: 'exact', head: true })
                .eq('user_id', _userId);
            return (res.count || 0) > 0;
        } catch (e) { return false; }
    }

    function onStatusChange(fn) { _listeners.push(fn); }

    return { enable, disable, isEnabled, pullAll, pushAll, hasCloudData, onStatusChange };
})();
