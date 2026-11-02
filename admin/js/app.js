// Stackr Admin — Login (Google + TOTP) und Audit-Ansicht. Kein Framework, kein Build.
(function () {
    'use strict';
    var CFG = window.ADMIN_CONFIG;
    var KEY = 'stackr_admin_session';
    var $ = function (id) { return document.getElementById(id); };

    // ── Sitzung (sessionStorage: nur dieser Tab, weg beim Schliessen) ──────────────
    function loadSession() {
        try { return JSON.parse(sessionStorage.getItem(KEY)) || null; } catch (e) { return null; }
    }
    function saveSession(s) {
        try { sessionStorage.setItem(KEY, JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token })); } catch (e) {}
    }
    function clearSession() { try { sessionStorage.removeItem(KEY); } catch (e) {} }

    function toast(msg) {
        var t = $('toast');
        t.textContent = msg;
        t.classList.add('on');
        setTimeout(function () { t.classList.remove('on'); }, 3500);
    }

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

    // ── Admin-API ──────────────────────────────────────────────────────────────────
    async function api(path, retried) {
        var s = loadSession();
        var r = await fetch(path, { headers: { Authorization: 'Bearer ' + (s ? s.access_token : '') } });
        var body = await r.json().catch(function () { return {}; });
        if (r.status === 401 && body.error === 'token_ungueltig' && !retried && await refresh()) return api(path, true);
        if (!r.ok) { var e = new Error(body.error || 'fehler'); e.status = r.status; throw e; }
        return body;
    }

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

    function logout(msg) { clearSession(); showLogin(msg); }
    $('btn-logout').addEventListener('click', function () { logout('Abgemeldet.'); });

    // ── MFA (TOTP) ─────────────────────────────────────────────────────────────────
    async function startMfa() {
        $('login').hidden = false;
        $('app').hidden = true;
        $('btn-google').hidden = true;
        $('mfa').hidden = false;
        $('login-msg').textContent = '';
        var ur = await sb('/user');
        if (!ur.ok) return logout('Anmeldung abgelaufen.');
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
            if (!er.ok) return logout('2FA konnte nicht eingerichtet werden.');
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
            if (!cr.ok) return toast('Challenge fehlgeschlagen.');
            var ch = await cr.json();
            var vr = await sb('/factors/' + factorId + '/verify', { method: 'POST', body: { challenge_id: ch.id, code: code } });
            if (!vr.ok) return toast('Code falsch.');
            saveSession(await vr.json());
            $('mfa-code').value = '';
            init();
        };
    }

    // ── Audit-Log ──────────────────────────────────────────────────────────────────
    var lastId = null;

    function cell(tr, text) { var td = document.createElement('td'); td.textContent = text; tr.appendChild(td); return td; }

    function renderRows(rows, append) {
        var tb = $('audit-rows');
        if (!append) tb.textContent = '';
        rows.forEach(function (r) {
            var tr = document.createElement('tr');
            cell(tr, new Date(r.ts).toLocaleString('de-DE'));
            cell(tr, r.admin_email);
            cell(tr, r.action);
            cell(tr, r.target_type ? r.target_type + ' ' + r.target_id : '');
            var td = cell(tr, '');
            if (r.before != null || r.after != null) {
                var pre = document.createElement('pre');
                pre.textContent = JSON.stringify({ vorher: r.before, nachher: r.after }, null, 1);
                td.appendChild(pre);
            }
            cell(tr, r.ip);
            tb.appendChild(tr);
        });
        $('audit-empty').hidden = tb.children.length > 0;
        $('audit-more').hidden = rows.length < 50;
        if (rows.length) lastId = rows[rows.length - 1].id;
    }

    async function loadAudit(append) {
        var p = new URLSearchParams();
        new FormData($('audit-filter')).forEach(function (v, k) {
            if (!v) return;
            // "Bis" gilt inklusive: bis zum Beginn des Folgetags
            if (k === 'to') { var d = new Date(v); d.setDate(d.getDate() + 1); v = d.toISOString(); }
            if (k === 'from') v = new Date(v).toISOString();
            p.set(k, v);
        });
        if (append && lastId) p.set('beforeId', lastId);
        try {
            renderRows((await api('/api/audit?' + p)).rows, append);
        } catch (e) {
            if (e.status === 401) return logout('Sitzung abgelaufen, bitte neu anmelden.');
            toast('Audit-Log konnte nicht geladen werden.');
        }
    }

    $('audit-filter').addEventListener('submit', function (ev) { ev.preventDefault(); lastId = null; loadAudit(false); });
    $('audit-more').addEventListener('click', function () { loadAudit(true); });

    // ── Start ──────────────────────────────────────────────────────────────────────
    async function init() {
        sessionFromHash();
        if (!loadSession()) return showLogin();
        try {
            var me = await api('/api/me');
            $('login').hidden = true;
            $('app').hidden = false;
            $('who').textContent = me.email;
            loadAudit(false);
        } catch (e) {
            if (e.message === 'mfa_fehlt') return startMfa();
            if (e.status === 403) return logout('Kein Zugriff fuer dieses Konto.');
            if (e.status === 503) return logout('Server nicht konfiguriert.');
            logout(e.status === 401 ? 'Bitte neu anmelden.' : 'Fehler beim Laden.');
        }
    }
    init();
})();
