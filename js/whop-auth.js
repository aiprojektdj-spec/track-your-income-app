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
    var WHOP_PURCHASE_URL = 'https://whop.com/stackr-3244/';        // Fallback / Produktseite
    // Direkt-Checkout-Links pro Abo-Intervall — echte Whop-Plan-Links hier eintragen:
    var WHOP_URL_MONTHLY  = 'https://whop.com/checkout/plan_iR6YIKLcychSZ'; // Stackr Pro monatlich (15 €) — Whop-Plan plan_iR6YIKLcychSZ
    var WHOP_URL_YEARLY   = 'https://whop.com/checkout/plan_b5IBQ1lecggOT'; // Stackr Pro jährlich (135 €) — Whop-Plan plan_b5IBQ1lecggOT (Produkt "Stackr App Access", gewährt dieselbe App)
    // Referral/Affiliate-Basislink — {ref} wird durch den Whop-Username ersetzt:
    var WHOP_REFERRAL_BASE = 'https://whop.com/stackr-3244/?a={ref}'; // Whop-Affiliate: ?a=<username> (bestätigt, docs.whop.com/developer/guides/affiliates)
    // Preise (nur für die Ersparnis-Anzeige):
    var PRICE_MONTHLY = 15;   // €/Monat
    var PRICE_YEARLY  = 135;  // €/Jahr
    var PKCE_KEY          = 'whop_oauth_pkce';

    // Whop company owners can't self-subscribe — grant them permanent access
    var OWNER_USERNAMES   = ['secondlifevintage41'];

    var LS_TOKEN = 'whop_access_token';
    var LS_USER  = 'whop_user';
    var LS_GRACE = 'whop_grace_until';           // Offline-Grace: Access-Ablauf (ms-Epoch)
    var GRACE_MS = 4 * 60 * 60 * 1000;           // 4 h ohne erneuten Whop-Server-Check

    var _bootDone = false;

    // ── Offline-Grace ─────────────────────────────────────────
    // Einmal online autorisiert → Access-Flag 4 h lokal gültig, kein Server-Roundtrip.
    // ICE-Szenario: wiederholtes Netzflackern blockiert die App nicht.
    function _stampGrace() { try { localStorage.setItem(LS_GRACE, String(Date.now() + GRACE_MS)); } catch (e) {} }
    function _clearGrace() { try { localStorage.removeItem(LS_GRACE); } catch (e) {} }
    function _graceFresh() { return parseInt(localStorage.getItem(LS_GRACE) || '0', 10) > Date.now(); }
    function _cachedUser() { try { return JSON.parse(localStorage.getItem(LS_USER) || 'null'); } catch (e) { return null; } }

    // Whop nicht erreichbar (offline/flaky) → innerhalb der Frist weiterarbeiten,
    // sonst klare Re-Login-Aufforderung. Local-first → keine Daten gehen verloren.
    async function _graceFallback() {
        var user = _cachedUser();
        if (_graceFresh() && user) {
            console.warn('[WhopAuth] Whop nicht erreichbar — Offline-Grace aktiv bis ' +
                new Date(parseInt(localStorage.getItem(LS_GRACE) || '0', 10)).toLocaleTimeString());
            await _onAuthorized(user);
            return true;
        }
        _clearGrace();
        _hideLoader();
        _showLoginScreen(navigator.onLine
            ? 'Verbindung zu Whop fehlgeschlagen. Bitte erneut anmelden.'
            : 'Offline und die 4-Stunden-Frist ist abgelaufen. Deine Daten bleiben lokal gespeichert — bitte neu anmelden, sobald du wieder online bist.');
        return false;
    }

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
            // Offline-Grace: frische Frist → sofort aus Cache starten, kein Server-Roundtrip.
            // ponytail: keine Hintergrund-Revalidierung — bei Ablauf revalidiert der nächste
            //   Load ohnehin voll (gebundene Staleness ≤ 4 h, gewollter Grace-Tradeoff).
            if (_graceFresh() && _cachedUser()) {
                await _onAuthorized(_cachedUser());
                return;
            }
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

    // ── OAuth-Callback: Code → Token (via /api/whop-token, PKCE + client_secret serverseitig) ──
    async function _handleOAuthCallback(code, returnedState) {
        _updateLoader('Authentifiziere mit Whop...');

        var stored = null;
        try { stored = JSON.parse(sessionStorage.getItem(PKCE_KEY) || 'null'); } catch (e) {}
        sessionStorage.removeItem(PKCE_KEY);

        if (!stored || returnedState !== stored.state) {
            _hideLoader();
            _showLoginScreen('Sicherheitsfehler: Bitte erneut versuchen.');
            return;
        }

        try {
            var res = await fetch('/api/whop-token', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    code:          code,
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
            if (meRes.status === 401 || meRes.status === 403) {
                // echter Auth-Fehler → Token ist ungültig, Grace ebenfalls verwerfen
                localStorage.removeItem(LS_TOKEN);
                localStorage.removeItem(LS_USER);
                _clearGrace();
                return false;
            }
            if (!meRes.ok) {
                // Server-/Netzproblem (5xx o.ä.) → Grace statt Logout
                return _graceFallback();
            }
            var me = await meRes.json();
            // OIDC-Felder normalisieren
            me.id       = me.sub;
            me.username = me.preferred_username || me.name || me.sub || 'User';
            localStorage.setItem(LS_USER, JSON.stringify(me));

            // Owner bypass: Whop company owners can't self-subscribe
            if (OWNER_USERNAMES.indexOf(me.username) !== -1) {
                _stampGrace();
                await _onAuthorized(me);
                return true;
            }

            // Membership-Check
            var accessRes = await fetch('https://api.whop.com/v5/me/has-access/' + WHOP_CLIENT_ID, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            var accessData = accessRes.ok ? await accessRes.json() : {};
            var hasAccess  = accessData.has_access === true;

            if (hasAccess) {
                _stampGrace();
                await _onAuthorized(me);
                return true;
            } else {
                _hideLoader();
                _showNoMembershipScreen(me);
                return false;
            }
        } catch (err) {
            // Netzwerkfehler (offline) → Grace-Fallback statt Logout (Token NICHT löschen)
            console.warn('[WhopAuth] Validierung fehlgeschlagen (offline?):', err && err.message);
            return _graceFallback();
        }
    }

    // ── Autorisiert: App starten ──────────────────────────────
    async function _onAuthorized(user) {
        _updateLoader('Lade Stackr...');
        _updateWidget(user);

        if (typeof UserPlan !== 'undefined') {
            try { UserPlan.injectBadge(); UserPlan.load(user.id); } catch (e) {}
        }

        // Cloud-Sync-Status-Punkt aktualisieren (opt-in; tut ohne Aktivierung nichts)
        if (typeof CloudSync !== 'undefined') { try { CloudSync.init(); } catch (e) {} }

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
        _clearGrace();
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
            '<button id="whopLoginBtn" data-action="wa-login" style="width:100%;padding:14px;background:var(--accent,#10b981);color:#fff;border:none;border-radius:10px;cursor:pointer;font-size:15px;font-weight:700;letter-spacing:-.2px;margin-bottom:12px;">',
            'Mit Whop anmelden →',
            '</button>',
            '<p style="color:var(--text-muted,#666);font-size:12px;margin:0;line-height:1.6;">',
            'Noch kein Zugang? <a href="' + WHOP_PURCHASE_URL + '" target="_blank" rel="noopener" style="color:var(--accent,#10b981);text-decoration:none;font-weight:600;">Stackr Pro kaufen →</a>',
            '</p>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);
    }

    // ── Kein-Abo / Winback-Screen (Neukauf + abgelaufenes Abo) ─
    function _showNoMembershipScreen(user) {
        var name = user ? (user.username || (user.email || '').split('@')[0] || 'User') : 'User';
        var existing = document.getElementById('whopNoMemberOverlay');
        if (existing) existing.remove();

        var save         = (PRICE_MONTHLY * 12) - PRICE_YEARLY;              // 45
        var monthsFree   = Math.round(save / PRICE_MONTHLY);                 // 3
        var perMonthYear = (PRICE_YEARLY / 12).toFixed(2).replace('.', ','); // 11,25

        var overlay = document.createElement('div');
        overlay.id = 'whopNoMemberOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';
        overlay.innerHTML = [
            '<div style="background:var(--surface,#1e1e2e);border:1px solid var(--border,#2e2e42);border-radius:16px;padding:32px 28px;max-width:440px;width:100%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,.8);">',
            '<div style="font-size:40px;color:var(--accent,#10b981);margin-bottom:12px;line-height:1;">◆</div>',
            '<h2 style="color:var(--text-primary,#fff);font-size:21px;margin:0 0 8px;font-weight:800;">Stackr Pro aktivieren</h2>',
            '<p style="color:var(--text-muted,#888);font-size:13.5px;margin:0 0 6px;line-height:1.6;">',
            'Hallo <strong style="color:var(--text-secondary,#ccc);">' + _esc(name) + '</strong>, du hast aktuell kein aktives Abo.',
            '</p>',
            '<p style="color:var(--text-muted,#777);font-size:12px;margin:0 0 22px;line-height:1.6;">Deine Daten bleiben lokal gespeichert — nach der Aktivierung ist alles sofort wieder da.</p>',

            // Jahresabo (hervorgehoben)
            '<a href="' + WHOP_URL_YEARLY + '" target="_blank" rel="noopener" style="display:block;text-align:left;position:relative;padding:14px 16px;margin-bottom:10px;background:linear-gradient(135deg,rgba(16,185,129,.14),rgba(5,150,105,.08));border:1.5px solid var(--accent,#10b981);border-radius:12px;text-decoration:none;box-sizing:border-box;">',
            '<span style="position:absolute;top:-9px;right:14px;background:var(--accent,#10b981);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;letter-spacing:.3px;">SPAR ' + save + ' €</span>',
            '<div style="display:flex;justify-content:space-between;align-items:baseline;">',
            '<span style="color:var(--text-primary,#fff);font-size:15px;font-weight:700;">Jahresabo</span>',
            '<span style="color:var(--text-primary,#fff);font-size:15px;font-weight:800;">' + PRICE_YEARLY + ' €<span style="font-size:11px;color:var(--text-muted,#888);font-weight:500;">/Jahr</span></span>',
            '</div>',
            '<div style="color:var(--accent,#10b981);font-size:11.5px;margin-top:3px;">entspricht ' + perMonthYear + ' €/Monat · ' + monthsFree + ' Monate gratis</div>',
            '</a>',

            // Monatsabo
            '<a href="' + WHOP_URL_MONTHLY + '" target="_blank" rel="noopener" style="display:block;text-align:left;padding:14px 16px;margin-bottom:18px;background:var(--surface-2,rgba(255,255,255,.04));border:1px solid var(--border,#2e2e42);border-radius:12px;text-decoration:none;box-sizing:border-box;">',
            '<div style="display:flex;justify-content:space-between;align-items:baseline;">',
            '<span style="color:var(--text-primary,#fff);font-size:15px;font-weight:700;">Monatlich</span>',
            '<span style="color:var(--text-primary,#fff);font-size:15px;font-weight:800;">' + PRICE_MONTHLY + ' €<span style="font-size:11px;color:var(--text-muted,#888);font-weight:500;">/Monat</span></span>',
            '</div>',
            '<div style="color:var(--text-muted,#888);font-size:11.5px;margin-top:3px;">jederzeit kündbar</div>',
            '</a>',

            '<button data-action="wa-logout" style="background:none;border:none;color:var(--text-muted,#888);cursor:pointer;font-size:13px;width:100%;padding:6px 0;">',
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
                '<button class="auth-user-btn" data-action="wa-user-menu" title="' + _esc(user.email || user.username || '') + '">' +
                '<i class="ti ti-user" style="font-size:13px;"></i> ' + _esc(name.substring(0, 14)) +
                '</button>';
        } else {
            w.innerHTML = '<button class="auth-login-btn" data-action="wa-login">Anmelden</button>';
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
            '<button style="display:block;width:100%;padding:8px 12px;background:none;border:none;color:var(--text-primary,#fff);cursor:pointer;text-align:left;font-size:13px;border-radius:5px;" data-action="wa-referral">📣 Stackr empfehlen</button>' +
            '<button style="display:block;width:100%;padding:8px 12px;background:none;border:none;color:#ef4444;cursor:pointer;text-align:left;font-size:13px;border-radius:5px;" data-action="wa-logout">🚪 Abmelden</button>';

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

    // ── Referral: „Stackr empfehlen" ──────────────────────────
    // LEGAL: „Kunden werben Kunden"/Prämien haben in DE steuer-/AGB-Implikationen.
    // Der Teilnahmebedingungen-Link ist ein Platzhalter (#) — der Bedingungstext
    // muss von legal-reviewer/agb-writer geliefert und hier verlinkt werden.
    function openReferral() {
        var menu = document.getElementById('authUserMenu');
        if (menu) menu.remove();

        var existing = document.getElementById('referralOverlay');
        if (existing) { existing.remove(); return; }

        var user = {};
        try { user = JSON.parse(localStorage.getItem(LS_USER) || '{}'); } catch (e) {}
        var ref  = encodeURIComponent(user.username || user.id || user.sub || '');
        var link = WHOP_REFERRAL_BASE.replace('{ref}', ref);

        var shareText = encodeURIComponent('Ich verwalte meine Buchhaltung mit Stackr — schau es dir an: ' + link);
        var mailHref  = 'mailto:?subject=' + encodeURIComponent('Schau dir Stackr an') + '&body=' + shareText;
        var waHref    = 'https://wa.me/?text=' + shareText;

        var overlay = document.createElement('div');
        overlay.id = 'referralOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';
        overlay.innerHTML = [
            '<div style="background:var(--surface,#1e1e2e);border:1px solid var(--border,#2e2e42);border-radius:16px;padding:28px 26px;max-width:420px;width:100%;box-shadow:0 32px 80px rgba(0,0,0,.8);position:relative;">',
            '<button data-action="wa-close-referral" style="position:absolute;top:12px;right:14px;background:none;border:none;color:var(--text-muted,#888);font-size:20px;cursor:pointer;line-height:1;">×</button>',
            '<div style="font-size:32px;margin-bottom:10px;">📣</div>',
            '<h2 style="color:var(--text-primary,#fff);font-size:19px;margin:0 0 8px;font-weight:800;">Stackr empfehlen</h2>',
            '<p style="color:var(--text-muted,#888);font-size:13px;margin:0 0 18px;line-height:1.6;">Teile Stackr mit anderen Selbstständigen. Für jede erfolgreiche Empfehlung erhältst du eine Prämie über Whop.</p>',

            '<div style="display:flex;gap:8px;margin-bottom:14px;">',
            '<input id="refLinkInput" readonly value="' + _esc(link) + '" style="flex:1;min-width:0;background:var(--bg,#08080f);border:1px solid var(--border,#2e2e42);border-radius:8px;color:var(--text-secondary,#ccc);font-size:12px;padding:10px 12px;box-sizing:border-box;">',
            '<button id="refCopyBtn" data-action="wa-copy-ref" style="background:var(--accent,#10b981);border:none;color:#fff;font-size:13px;font-weight:700;padding:0 14px;border-radius:8px;cursor:pointer;white-space:nowrap;">Kopieren</button>',
            '</div>',

            '<div style="display:flex;gap:8px;margin-bottom:16px;">',
            '<a href="' + mailHref + '" style="flex:1;text-align:center;padding:10px;background:var(--surface-2,rgba(255,255,255,.04));border:1px solid var(--border,#2e2e42);border-radius:8px;color:var(--text-primary,#fff);font-size:13px;text-decoration:none;">✉ E-Mail</a>',
            '<a href="' + waHref + '" target="_blank" rel="noopener" style="flex:1;text-align:center;padding:10px;background:var(--surface-2,rgba(255,255,255,.04));border:1px solid var(--border,#2e2e42);border-radius:8px;color:var(--text-primary,#fff);font-size:13px;text-decoration:none;">WhatsApp</a>',
            '</div>',

            '<p style="color:var(--text-muted,#666);font-size:11px;margin:0;line-height:1.6;">Prämien werden über Whop abgewickelt. Es gelten die <a href="agb.html#empfehlungsprogramm" target="_blank" rel="noopener" style="color:var(--accent,#10b981);text-decoration:none;">Teilnahmebedingungen</a>.</p>',
            '</div>'
        ].join('');
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
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

    return { boot, openUserMenu, openReferral, _logout, _loginWithWhop };
})();

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'wa-login':          function () { AuthUI._loginWithWhop(); },
    'wa-logout':         function () { AuthUI._logout(); },
    'wa-user-menu':      function (e, el) { AuthUI.openUserMenu(el); },
    'wa-referral':       function () { AuthUI.openReferral(); },
    'wa-close-referral': function () { var o = document.getElementById('referralOverlay'); if (o) o.remove(); },
    'wa-copy-ref':       function () {
        navigator.clipboard.writeText(document.getElementById('refLinkInput').value).then(function () {
            var b = document.getElementById('refCopyBtn');
            b.textContent = 'Kopiert ✓';
            setTimeout(function () { b.textContent = 'Kopieren'; }, 1800);
        });
    }
});
