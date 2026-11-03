// Stackr Admin — Kern: Sitzung, Login (Google + TOTP), API-Aufrufe, Hilfsfunktionen.
// Ansichten haengen sich an window.Admin.views[name] = { show(param) } (js/audit.js, js/members.js);
// js/boot.js startet Router und Anmeldung.
(function () {
    'use strict';
    var CFG = window.ADMIN_CONFIG;
    var KEY = 'stackr_admin_session';
    var $ = function (id) { return document.getElementById(id); };
    var Admin = window.Admin = { views: {}, me: null, $: $ };

    // ── Sitzung (sessionStorage: nur dieser Tab, weg beim Schliessen) ──────────────
    function loadSession() {
        try { return JSON.parse(sessionStorage.getItem(KEY)) || null; } catch (e) { return null; }
    }
    function saveSession(s) {
        try { sessionStorage.setItem(KEY, JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token })); } catch (e) {}
    }
    function clearSession() { try { sessionStorage.removeItem(KEY); } catch (e) {} }

    Admin.toast = function (msg) {
        var t = $('toast');
        t.textContent = msg;
        t.classList.add('on');
        setTimeout(function () { t.classList.remove('on'); }, 3500);
    };

    // ── Kleine DOM-Helfer (nur Textknoten, nie HTML-Strings) ─────────────────────────
    Admin.el = function (tag, attrs, kids) {
        var n = document.createElement(tag);
        Object.keys(attrs || {}).forEach(function (k) {
            if (k === 'text') n.textContent = attrs[k];
            else if (k === 'class') n.className = attrs[k];
            else n.setAttribute(k, attrs[k]);
        });
        (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
        return n;
    };
    Admin.fmt = function (v) { return v ? new Date(v).toLocaleString('de-DE') : '–'; };
    Admin.fmtDay = function (v) { return v ? new Date(v).toLocaleDateString('de-DE') : '–'; };

    // ── Supabase Auth (REST) ───────────────────────────────────────────────────────
    function sb(path, opts) {
        opts = opts || {};
        var s = loadSession();
        var h = { 'apikey': CFG.supabaseKey, 'Content-Type': 'application/json' };
        if (s && opts.auth !== false) h.Authorization = 'Bearer ' + s.access_token;
        return fetch(CFG.supabaseUrl + '/auth/v1' + path, {
            method: opts.method || 'GET', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined
        });
    }

    function sessionFromHash() {
        if (!location.hash || location.hash.indexOf('access_token=') === -1) return;
        var p = new URLSearchParams(location.hash.slice(1));
        if (p.get('access_token')) saveSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token') });
        history.replaceState(null, '', location.pathname);
    }

    async function refresh() {
        var s = loadSession();
        if (!s || !s.refresh_token) return false;
        var r = await sb('/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: s.refresh_token } });
        if (!r.ok) return false;
        saveSession(await r.json());
        return true;
    }

    // ── Admin-API: Admin.api('/api/x?..') oder Admin.api('/api/x', { body: {...} }) ──
    Admin.api = async function api(path, opts, retried) {
        opts = opts || {};
        var s = loadSession();
        var h = { Authorization: 'Bearer ' + (s ? s.access_token : '') };
        if (opts.body) h['Content-Type'] = 'application/json';
        var r = await fetch(path, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: h,
                                    body: opts.body ? JSON.stringify(opts.body) : undefined });
        var body = await r.json().catch(function () { return {}; });
        if (r.status === 401 && body.error === 'token_ungueltig' && !retried && await refresh()) return api(path, opts, true);
        if (!r.ok) {
            if (r.status === 401) Admin.logout('Sitzung abgelaufen, bitte neu anmelden.');
            var e = new Error(body.error || 'fehler'); e.status = r.status; throw e;
        }
        return body;
    };

    // ── Ansichten ──────────────────────────────────────────────────────────────────
    function showLogin(msg) {
        $('app').hidden = true;
        $('login').hidden = false;
        $('mfa').hidden = true;
        $('btn-google').hidden = false;
        $('login-msg').textContent = msg || '';
    }

    $('btn-google').addEventListener('click', function () {
        location.href = CFG.supabaseUrl + '/auth/v1/authorize?provider=google&redirect_to=' +
            encodeURIComponent(location.origin + location.pathname);
    });

    Admin.logout = function (msg) { clearSession(); Admin.me = null; showLogin(msg); };
    $('btn-logout').addEventListener('click', function () { Admin.logout('Abgemeldet.'); });

    // ── MFA (TOTP) ─────────────────────────────────────────────────────────────────
    async function startMfa() {
        $('login').hidden = false;
        $('app').hidden = true;
        $('btn-google').hidden = true;
        $('mfa').hidden = false;
        $('login-msg').textContent = '';
        var ur = await sb('/user');
        if (!ur.ok) return Admin.logout('Anmeldung abgelaufen.');
        var user = await ur.json();
        var f = (user.factors || []).filter(function (x) { return x.factor_type === 'totp' && x.status === 'verified'; })[0];
        var factorId;
        if (f) {
            factorId = f.id;
            $('mfa-hint').textContent = 'Code aus der Authenticator-App eingeben.';
            $('mfa-qr').hidden = true;
            $('mfa-secret').textContent = '';
        } else {
            var er = await sb('/factors', { method: 'POST', body: { factor_type: 'totp', friendly_name: 'Stackr Admin ' + Date.now() } });
            if (!er.ok) return Admin.logout('2FA konnte nicht eingerichtet werden.');
            var en = await er.json();
            factorId = en.id;
            $('mfa-hint').textContent = 'Erstanmeldung: QR-Code scannen, dann den Code eingeben.';
            $('mfa-qr').src = en.totp.qr_code;
            $('mfa-qr').hidden = false;
            $('mfa-secret').textContent = en.totp.secret;
        }
        $('btn-mfa').onclick = async function () {
            var code = $('mfa-code').value.replace(/\s+/g, '');
            var cr = await sb('/factors/' + factorId + '/challenge', { method: 'POST' });
            if (!cr.ok) return Admin.toast('Challenge fehlgeschlagen.');
            var ch = await cr.json();
            var vr = await sb('/factors/' + factorId + '/verify', { method: 'POST', body: { challenge_id: ch.id, code: code } });
            if (!vr.ok) return Admin.toast('Code falsch.');
            saveSession(await vr.json());
            $('mfa-code').value = '';
            Admin.start();
        };
    }

    // ── Start: prueft Anmeldung, zeigt dann die App (Router in boot.js) ────────────
    Admin.start = async function () {
        sessionFromHash();
        if (!loadSession()) return showLogin();
        try {
            Admin.me = await Admin.api('/api/me');
            $('login').hidden = true;
            $('app').hidden = false;
            $('who').textContent = Admin.me.email;
            Admin.route();
        } catch (e) {
            if (e.message === 'mfa_fehlt') return startMfa();
            if (e.status === 403) return Admin.logout('Kein Zugriff fuer dieses Konto.');
            if (e.status === 503) return Admin.logout('Server nicht konfiguriert.');
            Admin.logout(e.status === 401 ? 'Bitte neu anmelden.' : 'Fehler beim Laden.');
        }
    };

    // Datei laden (Authorization-Header geht nur per fetch) und als Download speichern
    Admin.download = async function (path, fallbackName) {
        var s = loadSession();
        var r = await fetch(path, { headers: { Authorization: 'Bearer ' + (s ? s.access_token : '') } });
        if (!r.ok) {
            var b = await r.json().catch(function () { return {}; });
            if (r.status === 401) Admin.logout('Sitzung abgelaufen, bitte neu anmelden.');
            var e = new Error(b.error || 'fehler'); e.status = r.status; throw e;
        }
        var m = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '');
        var url = URL.createObjectURL(await r.blob());
        var a = document.createElement('a');
        a.href = url; a.download = m ? m[1] : fallbackName;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    };

    Admin.can = function (perm) { return !!(Admin.me && Admin.me.permissions.indexOf(perm) !== -1); };
})();
