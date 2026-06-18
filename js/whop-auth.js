// ============================================
// WhopAuth — Whop OAuth 2.1 + PKCE Login
//
// Ersetzt auth-ui.js vollständig.
// Gleiche öffentliche API: AuthUI.boot(), openUserMenu(), _logout()
//
// Flow (OAuth 2.1 + PKCE):
//  1. _loginWithWhop(): erzeugt code_verifier/challenge, leitet zu Whop weiter
//  2. boot(): erkennt ?code= Callback, tauscht Code gegen Token (PKCE, kein client_secret)
//  3. _validateAndContinue(): prüft userinfo + has-access
//  4. _onAuthorized(): App starten
// ============================================
var AuthUI = (function () {
    'use strict';

    var WHOP_CLIENT_ID    = 'app_dc3OND8eGv2Iim';
    var WHOP_REDIRECT_URI = 'https://track-your-income-app.vercel.app/app.html';
    var WHOP_SCOPE        = 'openid profile email';
    var WHOP_PURCHASE_URL = 'https://whop.com/hub/app_dc3OND8eGv2Iim/';
    var PKCE_KEY          = 'whop_oauth_pkce';

    var LS_TOKEN = 'whop_access_token';
    var LS_USER  = 'whop_user';

    var _bootDone = false;

    // ── PKCE Helpers ──────────────────────────────────────────
    function _base64url(bytes) {
        return btoa(String.fromCharCode.apply(null, Array.from(bytes)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    function _randomString(len) {
        return _base64url(crypto.getRandomValues(new Uint8Array(len)));
    }

    async function _sha256(str) {
        var data = new TextEncoder().encode(str);
        var hash = await crypto.subtle.digest('SHA-256', data);
        return _base64url(new Uint8Array(hash));
    }

    // ── Einstieg ──────────────────────────────────────────────
    async function boot() {
        _injectStyles();
        _injectWidget();
        _showLoader('Verbinde mit Stackr...');

        var urlParams = new URLSearchParams(location.search);
        var code      = urlParams.get('code');
        var error     = urlParams.get('error');

        if (error) {
            history.replaceState({}, '', location.pathname);
            _hideLoader();
            _showLoginScreen('OAuth-Fehler: ' + error);
            return;
        }

        if (code) {
            history.replaceState({}, '', location.pathname);
            await _handleOAuthCallback(code, urlParams.get('state'));
            return;
        }

        var token = localStorage.getItem(LS_TOKEN);
        if (token) {
            var ok = await _validateAndContinue(token);
            if (ok) return;
        }

        _hideLoader();
        _showLoginScreen();
    }

    // ── OAuth-Redirect mit PKCE ───────────────────────────────
    async function _loginWithWhop() {
        var btn = document.getElementById('whopLoginBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Weiterleitung...'; }

        var codeVerifier  = _randomString(32);
        var state         = _randomString(16);
        var nonce         = _randomString(16);
        var codeChallenge = await _sha256(codeVerifier);

        sessionStorage.setItem(PKCE_KEY, JSON.stringify({ codeVerifier: codeVerifier, state: state, nonce: nonce }));

        var params = new URLSearchParams({
            response_type:         'code',
            client_id:             WHOP_CLIENT_ID,
            redirect_uri:          WHOP_REDIRECT_URI,
            scope:                 WHOP_SCOPE,
            state:                 state,
            nonce:                 nonce,
            code_challenge:        codeChallenge,
            code_challenge_method: 'S256',
        });

        location.href = 'https://api.whop.com/oauth/authorize?' + params.toString();
    }

    // ── OAuth-Callback: Code → Token (PKCE, kein client_secret) ──
    async function _handleOAuthCallback(code, returnedState) {
        _updateLoader('Authentifiziere mit Whop...');

        var stored = null;
        try { stored = JSON.parse(sessionStorage.getItem(PKCE_KEY) || 'null'); } catch (e) {}
        sessionStorage.removeItem(PKCE_KEY);

        if (!stored || (returnedState && returnedState !== stored.state)) {
            _hideLoader();
            _showLoginScreen('Sicherheitsfehler: Bitte erneut versuchen.');
            return;
        }

        try {
            var res = await fetch('https://api.whop.com/oauth/token', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    grant_type:    'authorization_code',
                    code:          code,
                    redirect_uri:  WHOP_REDIRECT_URI,
                    client_id:     WHOP_CLIENT_ID,
                    code_verifier: stored.codeVerifier,
                }),
            });
            var data = await res.json();

            if (!res.ok || !data.access_token) {
                throw new Error(data.error_description || data.error || 'Token-Austausch fehlgeschlagen');
            }

            localStorage.setItem(LS_TOKEN, data.access_token);
            var ok = await _validateAndContinue(data.access_token);
            if (!ok) { _hideLoader(); _showLoginScreen('Kein aktives Stackr-Abo gefunden.'); }
        } catch (err) {
            console.error('[WhopAuth] OAuth-Fehler:', err);
            _hideLoader();
            _showLoginScreen('Anmeldung fehlgeschlagen: ' + err.message);
        }
    }

    // ── Token validieren + Membership prüfen ──────────────────
    async function _validateAndContinue(token) {
        _updateLoader('Überprüfe Mitgliedschaft...');
        try {
            // Nutzer-Info via OIDC userinfo endpoint
            var meRes = await fetch('https://api.whop.com/oauth/userinfo', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!meRes.ok) {
                localStorage.removeItem(LS_TOKEN);
                localStorage.removeItem(LS_USER);
                return false;
            }
            var me = await meRes.json();
            // OIDC-Felder normalisieren
            me.id       = me.sub;
            me.username = me.preferred_username || me.name || me.sub || 'User';
            localStorage.setItem(LS_USER, JSON.stringify(me));

            // Membership-Check
            var accessRes = await fetch('https://api.whop.com/v5/me/has-access/' + WHOP_CLIENT_ID, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            var accessData = accessRes.ok ? await accessRes.json() : {};
            var hasAccess  = accessData.has_access === true;

            if (hasAccess) {
                await _onAuthorized(me);
                return true;
            } else {
                _hideLoader();
                _showNoMembershipScreen(me);
                return false;
            }
        } catch (err) {
            console.error('[WhopAuth] Validierungsfehler:', err);
            localStorage.removeItem(LS_TOKEN);
            return false;
        }
    }

    // ── Autorisiert: App starten ──────────────────────────────
    async function _onAuthorized(user) {
        _updateLoader('Lade Stackr...');
        _updateWidget(user);

        if (typeof CloudSync !== 'undefined') {
            try { CloudSync.disable(); } catch (e) {}
        }
        if (typeof UserPlan !== 'undefined') {
            try { UserPlan.injectBadge(); UserPlan.load(user.id); } catch (e) {}
        }

        _hideLoader();

        if (!_bootDone) {
            _bootDone = true;
            var appUser = {
                id:       user.id || user.sub,
                email:    user.email || (user.username + '@whop.stackr'),
                username: user.username,
            };
            if (typeof App !== 'undefined' && App._continueAfterAuth) {
                App._continueAfterAuth(appUser);
            }
        }
    }

    // ── Abmelden ──────────────────────────────────────────────
    function _logout() {
        var m = document.getElementById('authUserMenu');
        if (m) m.remove();
        localStorage.removeItem(LS_TOKEN);
        localStorage.removeItem(LS_USER);
        location.replace('app.html');
    }

    // ── Login-Screen ──────────────────────────────────────────
    function _showLoginScreen(errorMsg) {
        var existing = document.getElementById('whopLoginOverlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'whopLoginOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg,#08080f);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
        overlay.innerHTML = [
            '<div style="text-align:center;max-width:380px;width:100%;">',
            '<div style="font-size:52px;color:var(--accent,#10b981);margin-bottom:16px;line-height:1;">◆</div>',
            '<h1 style="color:var(--text-primary,#fff);font-size:26px;font-weight:800;margin:0 0 8px;letter-spacing:-.5px;">Stackr</h1>',
            '<p style="color:var(--text-muted,#888);font-size:14px;margin:0 0 32px;line-height:1.6;">Dein Buchhaltungs-Tool für Selbstständige</p>',
            errorMsg ? '<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:13px;color:#f87171;text-align:left;">' + _esc(errorMsg) + '</div>' : '',
            '<button id="whopLoginBtn" onclick="AuthUI._loginWithWhop()" style="width:100%;padding:14px;background:var(--accent,#10b981);color:#fff;border:none;border-radius:10px;cursor:pointer;font-size:15px;font-weight:700;letter-spacing:-.2px;margin-bottom:12px;">',
            'Mit Whop anmelden →',
            '</button>',
            '<p style="color:var(--text-muted,#666);font-size:12px;margin:0;line-height:1.6;">',
            'Noch kein Zugang? <a href="' + WHOP_PURCHASE_URL + '" target="_blank" rel="noopener" style="color:var(--accent,#10b981);text-decoration:none;font-weight:600;">Stackr Pro kaufen →</a>',
            '</p>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);
    }

    // ── Kein-Abo Screen ───────────────────────────────────────
    function _showNoMembershipScreen(user) {
        var name = user ? (user.username || (user.email || '').split('@')[0] || 'User') : 'User';
        var existing = document.getElementById('whopNoMemberOverlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'whopNoMemberOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';
        overlay.innerHTML = [
            '<div style="background:var(--surface,#1e1e2e);border:1px solid rgba(99,102,241,.4);border-radius:16px;padding:36px 32px;max-width:420px;width:100%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,.8);">',
            '<div style="font-size:44px;margin-bottom:14px;">🔒</div>',
            '<h2 style="color:var(--text-primary,#fff);font-size:20px;margin:0 0 10px;font-weight:800;">Kein aktives Abo</h2>',
            '<p style="color:var(--text-muted,#888);font-size:14px;margin:0 0 24px;line-height:1.6;">',
            'Hallo <strong style="color:var(--text-secondary,#ccc);">' + _esc(name) + '</strong>,<br>',
            'du hast kein aktives <strong style="color:var(--text-secondary,#ccc);">Stackr Pro</strong> Abo.',
            '</p>',
            '<a href="' + WHOP_PURCHASE_URL + '" target="_blank" rel="noopener" ',
            'style="display:block;width:100%;padding:13px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border-radius:8px;cursor:pointer;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:10px;box-sizing:border-box;">',
            'Stackr Pro kaufen — 15 €/Monat →',
            '</a>',
            '<button onclick="AuthUI._logout()" style="background:none;border:none;color:var(--text-muted,#888);cursor:pointer;font-size:13px;width:100%;padding:8px 0;">',
            'Mit anderem Konto anmelden',
            '</button>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);
    }

    // ── Topnav-Widget ─────────────────────────────────────────
    function _injectWidget() {
        var ctrl = document.querySelector('.topnav-controls');
        if (!ctrl || document.getElementById('authWidget')) return;
        var w = document.createElement('div');
        w.id = 'authWidget';
        w.style.cssText = 'display:flex;align-items:center;gap:6px;';
        w.innerHTML = '<span id="cloudSyncDot" style="font-size:14px;color:#888;cursor:default;" title="Verbinde...">☁</span>';
        ctrl.insertBefore(w, ctrl.firstChild);
    }

    function _updateWidget(user) {
        var w = document.getElementById('authWidget');
        if (!w) { _injectWidget(); w = document.getElementById('authWidget'); }
        if (!w) return;
        if (user) {
            var name = user.username || (user.email || '').split('@')[0] || 'Whop';
            w.innerHTML =
                '<span id="cloudSyncDot" style="font-size:14px;color:var(--accent,#10b981);" title="Whop Pro aktiv">◆</span>' +
                '<button class="auth-user-btn" onclick="AuthUI.openUserMenu(this)" title="' + _esc(user.email || user.username || '') + '">' +
                '<i class="ti ti-user" style="font-size:13px;"></i> ' + _esc(name.substring(0, 14)) +
                '</button>';
        } else {
            w.innerHTML = '<button class="auth-login-btn" onclick="AuthUI._loginWithWhop()">Anmelden</button>';
        }
    }

    function openUserMenu(btn) {
        var existing = document.getElementById('authUserMenu');
        if (existing) { existing.remove(); return; }

        var rect = btn.getBoundingClientRect();
        var menu = document.createElement('div');
        menu.id = 'authUserMenu';
        menu.style.cssText = 'position:fixed;top:' + (rect.bottom + 6) + 'px;right:' + (window.innerWidth - rect.right) + 'px;background:var(--surface,#1e1e2e);border:1px solid var(--border,#2e2e42);border-radius:8px;padding:4px;min-width:210px;z-index:9999;box-shadow:0 8px 28px rgba(0,0,0,.45);';

        var user = {};
        try { user = JSON.parse(localStorage.getItem(LS_USER) || '{}'); } catch (e) {}

        menu.innerHTML =
            '<div style="padding:8px 12px 6px;font-size:11px;color:var(--text-muted,#888);word-break:break-all;">' +
            _esc(user.email || user.username || 'Whop User') + '</div>' +
            '<div style="font-size:10px;color:var(--accent,#10b981);padding:0 12px 8px;">◆ Stackr Pro aktiv</div>' +
            '<hr style="border:none;border-top:1px solid var(--border,#2e2e42);margin:2px 0;">' +
            '<button style="display:block;width:100%;padding:8px 12px;background:none;border:none;color:#ef4444;cursor:pointer;text-align:left;font-size:13px;border-radius:5px;" onclick="AuthUI._logout()">🚪 Abmelden</button>';

        document.body.appendChild(menu);

        setTimeout(function () {
            document.addEventListener('click', function _close(e) {
                var m2 = document.getElementById('authUserMenu');
                if (m2 && !m2.contains(e.target) && e.target !== btn) {
                    m2.remove();
                    document.removeEventListener('click', _close);
                }
            });
        }, 100);
    }

    // ── Lade-Overlay ──────────────────────────────────────────
    function _showLoader(msg) {
        if (document.getElementById('authLoadingOverlay')) { _updateLoader(msg); return; }
        var overlay = document.createElement('div');
        overlay.id = 'authLoadingOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg,#08080f);display:flex;align-items:center;justify-content:center;z-index:9998;flex-direction:column;gap:16px;';
        overlay.innerHTML =
            '<div style="font-size:36px;color:var(--accent,#10b981);animation:whop-spin 1.2s linear infinite;">◆</div>' +
            '<div id="authLoadingMsg" style="color:var(--text-muted,#888);font-size:13px;">' + _esc(msg || 'Lade...') + '</div>' +
            '<style>@keyframes whop-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>';
        document.body.appendChild(overlay);
    }

    function _updateLoader(msg) {
        var el = document.getElementById('authLoadingMsg');
        if (el) el.textContent = msg || '';
    }

    function _hideLoader() {
        var el = document.getElementById('authLoadingOverlay');
        if (el) el.remove();
    }

    // ── Styles ────────────────────────────────────────────────
    function _injectStyles() {
        if (document.getElementById('authUiStyles')) return;
        var s = document.createElement('style');
        s.id = 'authUiStyles';
        s.textContent =
            '.auth-login-btn,.auth-user-btn{background:none;border:1px solid var(--border,#333);color:var(--text-muted,#aaa);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;}' +
            '.auth-user-btn{color:var(--text-primary,#fff);}' +
            '.auth-login-btn:hover,.auth-user-btn:hover{background:var(--surface-2,rgba(255,255,255,.06));}';
        document.head.appendChild(s);
    }

    function _esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    return { boot, openUserMenu, _logout, _loginWithWhop };
})();
