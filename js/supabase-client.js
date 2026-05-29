// ============================================
// SupabaseDB — Cloud-Client (Supabase JS v2)
// Projekt: TrackYourIncome
// URL:     https://csfvzmlihkrxokbbjyhf.supabase.co
// ============================================
var SUPABASE_URL      = 'https://csfvzmlihkrxokbbjyhf.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_rERij3K0Dyeo5OYTOJsCeg_UTKZS5fL';

var SupabaseDB = (function () {
    'use strict';

    var _client = null;

    // ── Client initialisieren ─────────────────
    function getClient() {
        if (_client) return _client;
        if (typeof window.supabase === 'undefined') {
            console.warn('[SupabaseDB] Supabase JS nicht geladen — offline-Modus aktiv');
            return null;
        }
        try {
            _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    persistSession:   true,
                    autoRefreshToken: true,
                    storageKey:       'oyi_auth_session'
                }
            });
        } catch (e) {
            console.error('[SupabaseDB] createClient fehlgeschlagen:', e);
        }
        return _client;
    }

    // ── Auth-Methoden ─────────────────────────
    async function getSession() {
        var c = getClient();
        if (!c) return null;
        try {
            var r = await c.auth.getSession();
            return (r.data && r.data.session) ? r.data.session : null;
        } catch (e) { return null; }
    }

    async function getCurrentUser() {
        var s = await getSession();
        return s ? s.user : null;
    }

    async function signIn(email, password) {
        var c = getClient();
        if (!c) throw new Error('Keine Verbindung zu Supabase');
        return c.auth.signInWithPassword({ email: email, password: password });
    }

    async function signUp(email, password) {
        var c = getClient();
        if (!c) throw new Error('Keine Verbindung zu Supabase');
        return c.auth.signUp({ email: email, password: password });
    }

    async function signOut() {
        var c = getClient();
        if (!c) return;
        await c.auth.signOut();
    }

    // Gibt eine Unsubscribe-Funktion zurück
    function onAuthStateChange(callback) {
        var c = getClient();
        if (!c) return function () {};
        try {
            var sub = c.auth.onAuthStateChange(callback);
            return (sub.data && sub.data.subscription)
                ? function () { sub.data.subscription.unsubscribe(); }
                : function () {};
        } catch (e) { return function () {}; }
    }

    return { getClient, getSession, getCurrentUser, signIn, signUp, signOut, onAuthStateChange };
})();
