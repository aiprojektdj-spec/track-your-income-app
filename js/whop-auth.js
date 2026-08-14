// ============================================
// WhopAuth — Whop OAuth 2.1 + PKCE Login
//
// Ersetzt auth-ui.js vollständig.
// Gleiche öffentliche API: AuthUI.boot(), openUserMenu(), _logout()
//
// Flow (OAuth 2.1 + PKCE):
//  1. _loginWithWhop(): erzeugt code_verifier/challenge, leitet zu Whop weiter
//  2. boot(): erkennt ?code= Callback, tauscht Code gegen Token (PKCE, kein client_secret)
//  3. _validateAndContinue(): userinfo + Membership-Check via /api/whop-access (serverseitig)
//  4. _onAuthorized(): App starten
// ============================================
var AuthUI = (function () {
    'use strict';

    var WHOP_CLIENT_ID    = 'app_dc3OND8eGv2Iim';
    var WHOP_REDIRECT_URI = 'https://track-your-income-app.vercel.app/app.html';
    var WHOP_SCOPE        = 'openid profile email';
    // WICHTIG: NIE auf https://whop.com/stackr-3244/ (Company-Hub) verlinken — das ist eine
    // allgemeine Profilseite mit "Join"-Button, die erst durch Products→See all→Stackr Pro
    // führt. Ein echter Kunde blieb dort hängen ("ich komm auch gar nd auf die seite wo man
    // kaufen kann"). Jeder Kauf-Link geht direkt auf den Checkout (bestätigt: 200, zeigt sofort
    // "Stackr Pro" — auch mit ?a=-Referral-Parameter).
    var WHOP_PURCHASE_URL = 'https://whop.com/checkout/plan_iR6YIKLcychSZ'; // Fallback = Direkt-Checkout monatlich
    // Direkt-Checkout-Links pro Abo-Intervall — echte Whop-Plan-Links hier eintragen:
    var WHOP_URL_MONTHLY  = 'https://whop.com/checkout/plan_iR6YIKLcychSZ'; // Stackr Pro monatlich (15 €) — Whop-Plan plan_iR6YIKLcychSZ
    var WHOP_URL_YEARLY   = 'https://whop.com/checkout/plan_b5IBQ1lecggOT'; // Stackr Pro jährlich (135 €) — Whop-Plan plan_b5IBQ1lecggOT (Produkt "Stackr App Access", gewährt dieselbe App)
    // Referral/Affiliate-Basislink — {ref} wird durch den Whop-Username ersetzt. Direkter
    // Checkout-Link (NICHT der Company-Hub), ?a= funktioniert dort ebenso (verifiziert):
    var WHOP_REFERRAL_BASE = 'https://whop.com/checkout/plan_iR6YIKLcychSZ?a={ref}'; // Whop-Affiliate: ?a=<username> (bestätigt, docs.whop.com/developer/guides/affiliates)
    // §312k BGB Kündigungsbutton: Whops eigener Self-Service-Weg (nicht der Company-Hub, siehe
    // Kommentar oben zu WHOP_PURCHASE_URL) — verifiziert per docs.whop.com/.../cancel-a-subscription.
    var WHOP_MANAGE_URL = 'https://whop.com/@me/settings/orders/';
    // Preise (nur für die Ersparnis-Anzeige):
    var PRICE_MONTHLY = 15;   // €/Monat
    var PRICE_YEARLY  = 135;  // €/Jahr
    var PKCE_KEY          = 'whop_oauth_pkce';

    // Whop company owners can't self-subscribe — grant them permanent access
    var OWNER_USERNAMES   = ['secondlifevintage41'];

    // Zugangs-Check läuft SERVERSEITIG über /api/whop-access. Das Backend prüft primär mit dem
    // durchgereichten User-Token gegen /api/v2/me/has_access/<id> (has_access existiert bei Whop
    // unter v2, nicht v5) und — falls WHOP_API_KEY gesetzt ist — zusätzlich per Company-Scan.
    // Kein Server-Key zwingend nötig, damit eine fehlende Env den Kunden nicht aussperrt.

    var LS_TOKEN = 'whop_access_token';
    var LS_USER  = 'whop_user';
    // Gerätesperre: lokale Unternehmensdaten (companies.js REGISTRY_KEY etc.) sind NICHT an die
    // Whop-User-ID gebunden. Ohne diesen Marker würde nach einem Logout jeder andere Whop-Account
    // im selben Browserprofil sofort die vollen Geschäftsdaten des vorherigen Nutzers sehen.
    var LS_DEVICE_OWNER = 'oyi_device_owner_uid';
    var LS_GRACE = 'whop_grace_token';           // Offline-Grace: server-signiertes Token (ECDSA P-256)
    var GRACE_MS = 4 * 60 * 60 * 1000;           // 4 h ohne erneuten Whop-Server-Check (muss zu api/whop-access.js passen)

    // Public Key zu api/whop-access.js WHOP_GRACE_PRIVATE_KEY (nur der Server kennt den Private
    // Key → Client kann ein Grace-Token nicht fälschen, nur ein echtes vom Server verifizieren).
    var GRACE_PUBKEY_JWK = { kty: 'EC', crv: 'P-256', ext: true,
        x: 'ZZQLtX5IWVyHHZ9hDmnJ1_uxS_oJGGkGTGtLxHRcT9U',
        y: 'Ik6rDmTMqm6fdxbXCt_5akptY8i8Ere7VvLTTeZgVkc' };
    var _gracePubKeyPromise = null;
    function _gracePubKey() {
        if (!_gracePubKeyPromise) {
            _gracePubKeyPromise = crypto.subtle.importKey('jwk', GRACE_PUBKEY_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
        }
        return _gracePubKeyPromise;
    }
    function _b64urlToBytes(b64url) {
        var b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        var bin = atob(b64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    var _bootDone = false;
    var _focusRecheckBound = false; // verhindert doppelte 'focus'-Listener bei erneutem No-Membership-Screen

    // ── Offline-Grace ─────────────────────────────────────────
    // Einmal online autorisiert → Server liefert signiertes Grace-Token, 4 h lokal ohne
    // Server-Roundtrip gültig. ICE-Szenario: wiederholtes Netzflackern blockiert die App nicht.
    // Token ist ECDSA-signiert (uid + exp) — anders als ein reiner Timestamp kann es im DevTools
    // NICHT gefälscht werden (Signaturprüfung schlägt ohne den serverseitigen Private Key fehl).
    function _stampGrace(token) { try { if (token) localStorage.setItem(LS_GRACE, token); else localStorage.removeItem(LS_GRACE); } catch (e) {} }
    function _clearGrace() { try { localStorage.removeItem(LS_GRACE); } catch (e) {} }
    async function _verifyGraceToken(token, expectedUid) {
        if (!token) return false;
        var parts = token.split('.');
        if (parts.length !== 2) return false;
        try {
            var pubKey = await _gracePubKey();
            var ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, _b64urlToBytes(parts[1]), new TextEncoder().encode(parts[0]));
            if (!ok) return false;
            var payload = JSON.parse(new TextDecoder().decode(_b64urlToBytes(parts[0])));
            return payload.exp > Date.now() && (!expectedUid || payload.uid === expectedUid);
        } catch (e) { return false; }
    }
    function _cachedUser() { try { return JSON.parse(localStorage.getItem(LS_USER) || 'null'); } catch (e) { return null; } }

    // Whop nicht erreichbar (offline/flaky) → innerhalb der Frist weiterarbeiten,
    // sonst klare Re-Login-Aufforderung. Local-first → keine Daten gehen verloren.
    async function _graceFallback() {
        var user = _cachedUser();
        if (user && await _verifyGraceToken(localStorage.getItem(LS_GRACE), user.id)) {
            console.warn('[WhopAuth] Whop nicht erreichbar — Offline-Grace aktiv (signiertes Token gültig)');
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

    // ── Fokus-Trap für Gate-Overlays (Tastatur-Bypass-Fix, WCAG 2.4.3) ──
    // Sperrt alle Body-Geschwister des Overlays (Topnav, Sidebar, Sidebar-Toggle …) per
    // `inert` (+ aria-hidden-Fallback für ältere Browser), solange ein Gate aktiv ist, und
    // fängt Tab im Overlay ein. `closable:true` fügt einen ESC-Handler hinzu — Login-Pflicht-
    // Screens bleiben bewusst ohne ESC, aber Tab darf trotzdem nie aus dem Overlay entkommen.
    var _trapStack = [];
    function _lockBackground(overlay) {
        Array.prototype.forEach.call(document.body.children, function (el) {
            if (el === overlay || el.hasAttribute('data-wa-locked') ||
                el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
            el.setAttribute('data-wa-locked', '1');
            if ('inert' in el) el.inert = true;
            el.setAttribute('aria-hidden', 'true');
        });
    }
    function _unlockBackground() {
        if (_trapStack.length) return; // noch ein anderes Gate aktiv
        Array.prototype.forEach.call(document.querySelectorAll('[data-wa-locked]'), function (el) {
            el.removeAttribute('data-wa-locked');
            if ('inert' in el) el.inert = false;
            el.removeAttribute('aria-hidden');
        });
    }
    function _focusables(container) {
        return Array.prototype.filter.call(
            container.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'),
            function (el) { return el.offsetParent !== null && !el.disabled; }
        );
    }
    function _trapFocus(overlay, opts) {
        opts = opts || {};
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        _lockBackground(overlay);
        _trapStack.push(overlay);

        var first = _focusables(overlay)[0];
        if (first) { first.focus(); } else { overlay.setAttribute('tabindex', '-1'); overlay.focus(); }

        function onKeydown(e) {
            if (e.key === 'Tab') {
                var f = _focusables(overlay);
                if (!f.length) return;
                var firstEl = f[0], lastEl = f[f.length - 1];
                if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
                else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
                return;
            }
            if (e.key === 'Escape' && opts.closable) {
                e.preventDefault();
                _releaseFocusTrap(overlay);
                if (opts.onClose) opts.onClose();
            }
        }
        overlay._waTrapHandler = onKeydown;
        document.addEventListener('keydown', onKeydown, true);
    }
    function _releaseFocusTrap(overlay) {
        if (!overlay) return;
        if (overlay._waTrapHandler) {
            document.removeEventListener('keydown', overlay._waTrapHandler, true);
            overlay._waTrapHandler = null;
        }
        var idx = _trapStack.indexOf(overlay);
        if (idx !== -1) _trapStack.splice(idx, 1);
        _unlockBackground();
    }
    function _removeGate(id) {
        var el = document.getElementById(id);
        if (el) { _releaseFocusTrap(el); el.remove(); }
        return el;
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
            // Offline-Grace: gültiges signiertes Token → sofort aus Cache starten, kein Server-Roundtrip.
            // ponytail: keine Hintergrund-Revalidierung — bei Ablauf revalidiert der nächste
            //   Load ohnehin voll (gebundene Staleness ≤ 4 h, gewollter Grace-Tradeoff).
            var _cu = _cachedUser();
            if (_cu && await _verifyGraceToken(localStorage.getItem(LS_GRACE), _cu.id)) {
                await _onAuthorized(_cu);
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

            // Owner-Bypass läuft über /api/whop-access (prüft OWNERS serverseitig identisch) —
            // kein Client-Shortcut mehr, sonst bekäme der Owner-Pfad nie ein signiertes
            // Grace-Token und bräuchte bei jedem Offline-Start einen Server-Roundtrip.

            // Membership-Check serverseitig: /api/whop-access prüft mit dem durchgereichten
            // User-Token /api/v2/me/has_access (+ optional Company-Scan). 5xx/Netzfehler →
            // äußerer catch → Offline-Grace. Sonstiger non-ok → kein Zugang, laut geloggt.
            var hasAccess = false;
            var graceToken = null;
            var accRes = await fetch('/api/whop-access', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ token: token })
            });
            if (accRes.ok) {
                var accJson = await accRes.json();
                hasAccess  = !!(accJson && accJson.has_access === true);
                graceToken = accJson && accJson.grace_token;
            } else if (accRes.status >= 500 || accRes.status === 429) {
                throw new Error('whop-access HTTP ' + accRes.status); // → Offline-Grace (429: IP-Rate-Limit ist kein "kein Abo")
            } else {
                console.warn('[WhopAuth] /api/whop-access HTTP ' + accRes.status + ' — Zugang nicht bestätigt');
            }

            if (hasAccess) {
                _stampGrace(graceToken);
                await _onAuthorized(me);
                return true;
            }

            // Kein eigenes Abo — evtl. Steuerberater mit Read-Only-Grant von einem Mandanten
            // (Henne-Ei sonst: ohne App-Zugang kann er nie seinen Public-Key registrieren
            // oder seinen Freigabe-Code sehen). register_pubkey/list_grants sind laut
            // api/sync.js serverseitig explizit Pro-frei für Grantee-Lesezugriff.
            if (typeof StbShare !== 'undefined') {
                try {
                    await StbShare.registerPubkey();
                    var grants = await StbShare.checkGrants();
                    if (grants.length > 0) {
                        _stampGrace(graceToken);
                        await _onAuthorized(me);
                        return true;
                    }
                } catch (e) { console.warn('[WhopAuth] StB-Grant-Check fehlgeschlagen:', e && e.message); }
            }

            _hideLoader();
            _showNoMembershipScreen(me);
            return false;
        } catch (err) {
            // Netzwerkfehler (offline) → Grace-Fallback statt Logout (Token NICHT löschen)
            console.warn('[WhopAuth] Validierung fehlgeschlagen (offline?):', err && err.message);
            return _graceFallback();
        }
    }

    // ── Gerätesperre: gehören die bereits vorhandenen lokalen Daten diesem Nutzer? ──
    // true  = ok (gleicher Eigentümer, oder Gerät war leer/vor-Fix → aktueller Nutzer wird Eigentümer)
    // false = Sperre (andere Whop-User-ID hat hier bereits Daten hinterlassen)
    function _checkDeviceOwner(userId) {
        var stored = null;
        try { stored = localStorage.getItem(LS_DEVICE_OWNER); } catch (e) { return true; }
        if (stored) return stored === userId;
        // Kein Marker gesetzt: entweder ein frisches Gerät, oder eine Installation von vor
        // diesem Fix. In beiden Fällen bleibt der aktuelle Nutzer der Eigentümer ab jetzt —
        // eine rückwirkende Zuordnung für Alt-Installationen ist ohne weitere Information
        // nicht möglich, aber ab hier greift die Sperre für jeden ANDEREN Account.
        try { localStorage.setItem(LS_DEVICE_OWNER, userId); } catch (e) {}
        return true;
    }

    // ── Gerätesperre: Blockbildschirm bei fremdem Konto ────────
    function _showDeviceLockedScreen(user) {
        _removeGate('whopDeviceLockOverlay');
        var overlay = document.createElement('div');
        overlay.id = 'whopDeviceLockOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';
        overlay.innerHTML = [
            '<div style="background:var(--surface,#1e1e2e);border:1px solid var(--border,#2e2e42);border-radius:16px;padding:32px 28px;max-width:460px;width:100%;text-align:left;box-shadow:0 32px 80px rgba(0,0,0,.8);">',
            '<div style="font-size:34px;margin-bottom:10px;line-height:1;">🔒</div>',
            '<h2 style="color:var(--text-primary,#fff);font-size:19px;margin:0 0 10px;font-weight:800;">Gerät gesperrt — anderes Konto erkannt</h2>',
            '<p style="color:var(--text-muted,#aaa);font-size:13.5px;margin:0 0 14px;line-height:1.6;">',
            'Dieser Browser enthält bereits lokale Geschäftsdaten eines <strong>anderen</strong> Stackr-Kontos als <strong style="color:var(--text-secondary,#ddd);">' + _esc(user && (user.username || user.email) || 'dieses Konto') + '</strong>. ',
            'Aus Datenschutzgründen zeigt Stackr diese Daten keinem anderen Konto an.',
            '</p>',
            '<p style="color:var(--text-muted,#888);font-size:12.5px;margin:0 0 20px;line-height:1.6;">Melde dich mit dem ursprünglichen Konto an, oder nutze ein anderes Gerät/einen anderen Browser. ',
            'Falls du sicher bist, dass hier niemand mehr Zugriff auf die alten Daten braucht, kannst du dieses Gerät zurücksetzen — die lokalen Daten des vorherigen Kontos werden dabei unwiderruflich gelöscht.</p>',
            '<button data-action="wa-logout" style="width:100%;padding:12px;background:var(--accent,#10b981);color:#fff;border:none;border-radius:10px;cursor:pointer;font-size:14px;font-weight:700;margin-bottom:10px;">Abmelden</button>',
            '<button data-action="wa-device-reset-start" style="width:100%;padding:10px;background:none;border:1px solid rgba(239,68,68,.4);color:#f87171;border-radius:10px;cursor:pointer;font-size:12.5px;">Gerät zurücksetzen (löscht alte lokale Daten unwiderruflich)</button>',
            '<div id="waDeviceResetConfirm" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--border,#2e2e42);">',
            '<p style="color:#f87171;font-size:12px;margin:0 0 8px;line-height:1.5;">Tippe zur Bestätigung <strong>LÖSCHEN</strong> ein. Diese Aktion kann nicht rückgängig gemacht werden.</p>',
            '<input id="waDeviceResetInput" type="text" autocomplete="off" style="width:100%;padding:9px 10px;margin-bottom:8px;background:var(--surface-2,rgba(255,255,255,.04));border:1px solid var(--border,#2e2e42);border-radius:8px;color:var(--text-primary,#fff);font-size:13px;box-sizing:border-box;">',
            '<button id="waDeviceResetConfirmBtn" data-action="wa-device-reset-confirm" disabled style="width:100%;padding:10px;background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:not-allowed;font-size:13px;font-weight:700;opacity:.5;">Endgültig löschen und neu starten</button>',
            '</div>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);
        _trapFocus(overlay, { closable: false });

        var input = document.getElementById('waDeviceResetInput');
        if (input) {
            input.addEventListener('input', function () {
                var btn = document.getElementById('waDeviceResetConfirmBtn');
                var ok  = input.value.trim().toUpperCase() === 'LÖSCHEN';
                btn.disabled = !ok;
                btn.style.opacity = ok ? '1' : '.5';
                btn.style.cursor  = ok ? 'pointer' : 'not-allowed';
            });
        }
    }
    function _startDeviceReset() {
        var box = document.getElementById('waDeviceResetConfirm');
        if (box) box.style.display = 'block';
        document.getElementById('waDeviceResetInput')?.focus();
    }
    async function _confirmDeviceReset() {
        var input = document.getElementById('waDeviceResetInput');
        if (!input || input.value.trim().toUpperCase() !== 'LÖSCHEN') return;
        var btn = document.getElementById('waDeviceResetConfirmBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Lösche…'; }
        try {
            // Alle bekannten App-Datenbanken + sämtlichen localStorage dieses Ursprungs löschen —
            // NICHT vorher exportieren: die Daten gehören dem vorherigen Konto, nicht dem neuen.
            var dbNames = ['oyi_maindata', 'oyi_autobackup', 'oyi_fs_handles'];
            await Promise.all(dbNames.map(function (name) {
                return new Promise(function (resolve) {
                    try {
                        var req = indexedDB.deleteDatabase(name);
                        req.onsuccess = req.onerror = req.onblocked = function () { resolve(); };
                    } catch (e) { resolve(); }
                });
            }));
            localStorage.clear();
        } catch (e) { console.error('[WhopAuth] Device-Reset fehlgeschlagen:', e); }
        location.replace('/app.html');
    }

    // ── Autorisiert: App starten ──────────────────────────────
    async function _onAuthorized(user) {
        var uid = user && (user.id || user.sub);
        if (!_checkDeviceOwner(uid)) {
            _hideLoader();
            _removeGate('whopLoginOverlay');
            _showDeviceLockedScreen(user);
            return;
        }
        _updateLoader('Lade Stackr...');
        // Autorisiert → alle Gate-Overlays weg. Sonst bleibt ein Rest-Overlay (z. B. das
        // Login-Overlay aus dem Callback-Pfad hinter dem Kein-Abo-Screen) nach dem Kauf
        // per _recheckOnFocus liegen und sperrt den frisch zahlenden Kunden aus.
        _removeGate('whopLoginOverlay');
        _removeGate('whopNoMemberOverlay');
        _updateWidget(user);

        if (typeof UserPlan !== 'undefined') {
            try { UserPlan.injectBadge(); UserPlan.load(user.id); } catch (e) {}
        }

        // Cloud-Sync-Status-Punkt aktualisieren (opt-in; tut ohne Aktivierung nichts)
        if (typeof CloudSync !== 'undefined') { try { CloudSync.init(); } catch (e) {} }

        // Steuerberater-Freigabe: eigenen Public-Key registrieren + ggf. Read-Only-Banner
        if (typeof StbShare !== 'undefined') {
            try { StbShare.registerPubkey(); StbShare.initReadonlyBanner(); } catch (e) {}
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

    // ── Nach Kauf: Whop-Checkout öffnet in neuem Tab, kein Redirect zurück.
    //    Beim Rückkehren auf diesen Tab (Fenster-Fokus) Zugang still neu prüfen,
    //    statt den Nutzer zum manuellen Reload zu zwingen. ──────
    async function _recheckOnFocus() {
        var overlay = document.getElementById('whopNoMemberOverlay');
        if (!overlay) return;
        var token = localStorage.getItem(LS_TOKEN);
        if (!token) return;
        var ok = await _validateAndContinue(token);
        if (ok) _removeGate('whopNoMemberOverlay');
    }

    // ── Abmelden ──────────────────────────────────────────────
    function _logout() {
        _removeGate('authUserMenu');
        localStorage.removeItem(LS_TOKEN);
        localStorage.removeItem(LS_USER);
        _clearGrace();
        location.replace('/app.html'); // absolut: relativ 404et von /lager/, /rechnungen/, /eigenbelege/ aus
    }

    // ── Login-Screen ──────────────────────────────────────────
    function _showLoginScreen(errorMsg) {
        _removeGate('whopLoginOverlay');

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
            'Mit Whop anmelden',
            '</button>',
            // Bis 2026-08-11 war das der einzige Bildschirm der App ohne jede Verkaufsaussage —
            // und der, den jeder Wiederkehrer und jeder Local-Umsteiger als erstes sieht.
            // Der Trial gehoert zum Monatsplan (derselbe plan_-Link wie auf der Landingpage).
            '<ul style="list-style:none;padding:0;margin:0 0 18px;text-align:left;color:var(--text-muted,#888);font-size:12.5px;line-height:1.9;">',
            '<li>Rechnungen, EÜR, USt-Voranmeldung &amp; DATEV-Export</li>',
            '<li>E-Rechnung (XRechnung) ohne Aufpreis</li>',
            '<li>Deine Daten bleiben lokal — Cloud-Sync optional und Ende-zu-Ende-verschlüsselt</li>',
            '</ul>',
            '<p style="color:var(--text-muted,#666);font-size:12px;margin:0;line-height:1.6;">',
            'Noch kein Zugang? <a href="' + WHOP_PURCHASE_URL + '" target="_blank" rel="noopener" style="color:var(--accent,#10b981);text-decoration:none;font-weight:600;">7 Tage kostenlos testen</a><br>',
            'Karte hinterlegen, in den ersten 7 Tagen keine Abbuchung · danach ' + PRICE_MONTHLY + ' €/Monat',
            '</p>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);
        _trapFocus(overlay, { closable: false });
    }

    // ── Kein-Abo / Winback-Screen (Neukauf + abgelaufenes Abo) ─
    function _showNoMembershipScreen(user) {
        var name = user ? (user.username || (user.email || '').split('@')[0] || 'User') : 'User';
        _removeGate('whopNoMemberOverlay');

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
            // "du hast kein aktives Abo" las sich fuer Interessenten wie eine Rechnung statt wie
            // ein Angebot. Der Endpunkt liefert nur has_access (kein "hatte je eine Membership"),
            // deshalb ein Text, der fuer Neukunden und Rueckkehrer gleichermassen stimmt.
            'Hallo <strong style="color:var(--text-secondary,#ccc);">' + _esc(name) + '</strong>, für Stackr Pro brauchst du ein aktives Abo. Neu hier? Die ersten 7 Tage sind kostenlos.',
            '</p>',
            '<p style="color:var(--text-muted,#777);font-size:12px;margin:0 0 22px;line-height:1.6;">Deine Daten bleiben lokal gespeichert — nach der Zahlung wirst du beim Zurückwechseln zu diesem Tab automatisch erkannt.</p>',

            // Jahresabo (hervorgehoben)
            '<a href="' + WHOP_URL_YEARLY + '" target="_blank" rel="noopener" style="display:block;text-align:left;position:relative;padding:14px 16px;margin-bottom:10px;background:linear-gradient(135deg,rgba(16,185,129,.14),rgba(5,150,105,.08));border:1.5px solid var(--accent,#10b981);border-radius:12px;text-decoration:none;box-sizing:border-box;">',
            '<span style="position:absolute;top:-9px;right:14px;background:var(--accent,#10b981);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;letter-spacing:.3px;">7 TAGE GRATIS · SPAR ' + save + ' €</span>',
            '<div style="display:flex;justify-content:space-between;align-items:baseline;">',
            '<span style="color:var(--text-primary,#fff);font-size:15px;font-weight:700;">Jahresabo</span>',
            '<span style="color:var(--text-primary,#fff);font-size:15px;font-weight:800;">' + PRICE_YEARLY + ' €<span style="font-size:11px;color:var(--text-muted,#888);font-weight:500;">/Jahr</span></span>',
            '</div>',
            '<div style="color:var(--accent,#10b981);font-size:11.5px;margin-top:3px;">entspricht ' + perMonthYear + ' €/Monat · ' + monthsFree + ' Monate gratis</div>',
            '<div style="color:var(--accent,#10b981);font-size:11.5px;margin-top:3px;font-weight:600;">Erste 7 Tage kostenlos</div>',
            '</a>',

            // Monatsabo
            '<a href="' + WHOP_URL_MONTHLY + '" target="_blank" rel="noopener" style="display:block;text-align:left;padding:14px 16px;margin-bottom:18px;background:var(--surface-2,rgba(255,255,255,.04));border:1px solid var(--border,#2e2e42);border-radius:12px;text-decoration:none;box-sizing:border-box;">',
            '<div style="display:flex;justify-content:space-between;align-items:baseline;">',
            '<span style="color:var(--text-primary,#fff);font-size:15px;font-weight:700;">Monatlich</span>',
            '<span style="color:var(--text-primary,#fff);font-size:15px;font-weight:800;">' + PRICE_MONTHLY + ' €<span style="font-size:11px;color:var(--text-muted,#888);font-weight:500;">/Monat</span></span>',
            '</div>',
            // Trial-Hinweis an BEIDEN Karten: die Testphase haengt bei Whop an beiden Plaenen
            // (vom Betreiber am 2026-08-12 bestaetigt; aus dem Code allein nicht nachweisbar,
            // da Monats- und Jahresabo verschiedene plan_-IDs sind). Deckt sich mit der FAQ
            // auf index.html:607, die den Trial ebenfalls fuer beide Abos nennt.
            '<div style="color:var(--accent,#10b981);font-size:11.5px;margin-top:3px;font-weight:600;">Erste 7 Tage kostenlos</div>',
            '<div style="color:var(--text-muted,#888);font-size:11.5px;margin-top:2px;">Karte hinterlegen, in den ersten 7 Tagen keine Abbuchung · jederzeit kündbar</div>',
            '</a>',

            '<button data-action="wa-logout" style="background:none;border:none;color:var(--text-muted,#888);cursor:pointer;font-size:13px;width:100%;padding:6px 0;">',
            'Mit anderem Konto anmelden',
            '</button>',

            '<hr style="border:none;border-top:1px solid var(--border,#2e2e42);margin:14px 0 12px;">',
            '<p style="color:var(--text-muted,#666);font-size:11.5px;margin:0 0 8px;line-height:1.6;text-align:left;">Bist du Steuerberater? Gib deinem Mandanten diesen Freigabe-Code für Nur-Lese-Zugriff:</p>',
            '<div style="display:flex;gap:8px;">',
            '<div style="flex:1;min-width:0;font-family:monospace;font-size:11px;word-break:break-all;background:var(--surface-2,rgba(255,255,255,.04));border:1px solid var(--border,#2e2e42);border-radius:8px;padding:8px 10px;color:var(--text-secondary,#ccc);text-align:left;">' + _esc(user && (user.id || user.sub) || '') + '</div>',
            '<button data-action="stb-copy-code" data-args="' + _esc(JSON.stringify([(user && (user.id || user.sub)) || ''])).replace(/"/g, '&quot;') + '" style="background:var(--surface-2,rgba(255,255,255,.04));border:1px solid var(--border,#2e2e42);color:var(--text-primary,#fff);font-size:12px;padding:0 12px;border-radius:8px;cursor:pointer;white-space:nowrap;">Kopieren</button>',
            '</div>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);
        _trapFocus(overlay, { closable: false });

        if (!_focusRecheckBound) {
            _focusRecheckBound = true;
            window.addEventListener('focus', _recheckOnFocus);
        }
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
                '<button class="auth-user-btn" data-action="wa-user-menu" aria-haspopup="true" aria-expanded="false" title="' + _esc(user.email || user.username || '') + '">' +
                '<i class="ti ti-user" style="font-size:13px;"></i> ' + _esc(name.substring(0, 14)) +
                '</button>';
        } else {
            w.innerHTML = '<button class="auth-login-btn" data-action="wa-login">Anmelden</button>';
        }
    }

    function _closeUserMenu(menu, btn, opts) {
        opts = opts || {};
        if (!menu) menu = document.getElementById('authUserMenu');
        if (menu && menu._waKeyHandler) document.removeEventListener('keydown', menu._waKeyHandler, true);
        if (menu) menu.remove();
        if (btn) {
            btn.setAttribute('aria-expanded', 'false');
            if (opts.returnFocus) btn.focus();
        }
    }

    function openUserMenu(btn) {
        var existing = document.getElementById('authUserMenu');
        if (existing) { _closeUserMenu(existing, btn, { returnFocus: false }); return; }

        var rect = btn.getBoundingClientRect();
        var menu = document.createElement('div');
        menu.id = 'authUserMenu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Konto-Menü');
        menu.style.cssText = 'position:fixed;top:' + (rect.bottom + 6) + 'px;right:' + (window.innerWidth - rect.right) + 'px;background:var(--surface,#1e1e2e);border:1px solid var(--border,#2e2e42);border-radius:8px;padding:4px;min-width:210px;z-index:9999;box-shadow:0 8px 28px rgba(0,0,0,.45);';

        var user = {};
        try { user = JSON.parse(localStorage.getItem(LS_USER) || '{}'); } catch (e) {}

        menu.innerHTML =
            '<div style="padding:8px 12px 6px;font-size:11px;color:var(--text-muted,#888);word-break:break-all;">' +
            _esc(user.email || user.username || 'Whop User') + '</div>' +
            '<div style="font-size:10px;color:var(--accent,#10b981);padding:0 12px 8px;">◆ Stackr Pro aktiv</div>' +
            '<hr style="border:none;border-top:1px solid var(--border,#2e2e42);margin:2px 0;">' +
            '<button role="menuitem" style="display:block;width:100%;padding:8px 12px;background:none;border:none;color:var(--text-primary,#fff);cursor:pointer;text-align:left;font-size:13px;border-radius:5px;" data-action="wa-referral">📣 Stackr empfehlen</button>' +
            '<button role="menuitem" style="display:block;width:100%;padding:8px 12px;background:none;border:none;color:var(--text-primary,#fff);cursor:pointer;text-align:left;font-size:13px;border-radius:5px;" data-action="stb-invite">👥 Steuerberater einladen</button>' +
            '<button role="menuitem" style="display:block;width:100%;padding:8px 12px;background:none;border:none;color:var(--text-primary,#fff);cursor:pointer;text-align:left;font-size:13px;border-radius:5px;" data-action="stb-clients">📂 Mandanten (als Steuerberater)</button>' +
            '<button role="menuitem" style="display:block;width:100%;padding:8px 12px;background:none;border:none;color:var(--text-muted,#888);cursor:pointer;text-align:left;font-size:12px;border-radius:5px;" data-action="stb-my-code">🔑 Mein Freigabe-Code</button>' +
            '<button role="menuitem" style="display:block;width:100%;padding:8px 12px;background:none;border:none;color:var(--text-muted,#888);cursor:pointer;text-align:left;font-size:12px;border-radius:5px;" data-action="stb-manage">🔒 Freigaben verwalten</button>' +
            '<hr style="border:none;border-top:1px solid var(--border,#2e2e42);margin:2px 0;">' +
            '<button role="menuitem" style="display:block;width:100%;padding:8px 12px;background:none;border:none;color:var(--text-primary,#fff);cursor:pointer;text-align:left;font-size:13px;border-radius:5px;" data-action="wa-manage-membership">🧾 Abo verwalten / kündigen</button>' +
            '<button role="menuitem" style="display:block;width:100%;padding:8px 12px;background:none;border:none;color:#ef4444;cursor:pointer;text-align:left;font-size:13px;border-radius:5px;" data-action="wa-logout">🚪 Abmelden</button>';

        document.body.appendChild(menu);
        btn.setAttribute('aria-expanded', 'true');

        var firstItem = menu.querySelector('[role="menuitem"]');
        if (firstItem) firstItem.focus();

        function onKeydown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                _closeUserMenu(menu, btn, { returnFocus: true });
            }
        }
        menu._waKeyHandler = onKeydown;
        document.addEventListener('keydown', onKeydown, true);

        setTimeout(function () {
            document.addEventListener('click', function _close(e) {
                var m2 = document.getElementById('authUserMenu');
                if (!m2) { document.removeEventListener('click', _close); return; }
                if (!m2.contains(e.target) && e.target !== btn) {
                    _closeUserMenu(m2, btn, { returnFocus: false });
                    document.removeEventListener('click', _close);
                }
            });
        }, 100);
    }

    // ── §312k Kündigungsbutton: direkt zu Whops Self-Service-Kündigung ──
    function _openManageMembership() { window.open(WHOP_MANAGE_URL, '_blank', 'noopener'); }

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
        // Styles liegen in css/style.css (Abschnitt "Auth-Widget") — ein hier injizierter
        // <style>-Block wuerde von der CSP blockiert (style-src-elem 'self').
    }

    function _esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    return { boot, openUserMenu, openReferral, _logout, _loginWithWhop, _startDeviceReset, _confirmDeviceReset, _openManageMembership };
})();

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'wa-login':          function () { AuthUI._loginWithWhop(); },
    'wa-logout':         function () { AuthUI._logout(); },
    'wa-user-menu':      function (e, el) { AuthUI.openUserMenu(el); },
    'wa-referral':       function () { AuthUI.openReferral(); },
    'wa-close-referral': function () { var o = document.getElementById('referralOverlay'); if (o) o.remove(); },
    'wa-device-reset-start':   function () { AuthUI._startDeviceReset(); },
    'wa-device-reset-confirm': function () { AuthUI._confirmDeviceReset(); },
    'wa-manage-membership':    function () { AuthUI._openManageMembership(); },
    'wa-copy-ref':       function () {
        navigator.clipboard.writeText(document.getElementById('refLinkInput').value).then(function () {
            var b = document.getElementById('refCopyBtn');
            b.textContent = 'Kopiert ✓';
            setTimeout(function () { b.textContent = 'Kopieren'; }, 1800);
        });
    }
});
