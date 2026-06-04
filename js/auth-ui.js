// ============================================
// AuthUI — Login / Registrierung / Logout
//
// Stellt bereit:
//   - Login-Banner (weiche Erinnerung)
//   - Auth-Modal (Login / Registrierung)
//   - Status-Widget in der Topnav
//   - Erster-Login-Sync (Migration lokaler Daten)
// ============================================
var AuthUI = (function () {
    'use strict';

    var _mode        = 'login';  // aktueller Modal-Tab
    var _unsubscribe = null;

    // ──────────────────────────────────────────
    // Bootstrap — wird einmalig beim Start aufgerufen
    // ──────────────────────────────────────────
    async function init() {
        _injectStyles();
        _injectWidget();

        // Auth-State-Listener registrieren
        _unsubscribe = SupabaseDB.onAuthStateChange(function (event, session) {
            if (event === 'SIGNED_IN'  && session) _onSignedIn(session.user, true);
            if (event === 'SIGNED_OUT')             _onSignedOut();
            if (event === 'TOKEN_REFRESHED' && session) CloudSync.enable(session.user.id);
        });

        // Bestehende Session prüfen (z. B. nach Seiten-Reload)
        var user = await SupabaseDB.getCurrentUser();
        if (user) {
            await _onSignedIn(user, false);   // false = kein Erst-Login → kein Sync-Dialog
        } else {
            _onSignedOut();
            // Banner erst nach kurzer Verzögerung zeigen (Onboarding nicht stören)
            setTimeout(_showLoginBanner, 1200);
        }
    }

    // ──────────────────────────────────────────
    // Signed-In Handler
    // ──────────────────────────────────────────
    async function _onSignedIn(user, isNew) {
        CloudSync.enable(user.id);
        _updateWidget(user);
        _hideLoginBanner();

        // Plan laden und Badge einfügen
        if (typeof UserPlan !== 'undefined') {
            UserPlan.injectBadge();
            await UserPlan.load(user.id);
        }

        if (!isNew) return;   // nach Reload: CloudSync läuft, kein Dialog

        // Erst-Login: herausfinden ob Cloud-Daten oder lokale Daten existieren
        var hasCloud = await CloudSync.hasCloudData();
        var hasLocal = _hasLocalData();

        if (hasCloud) {
            _toast('☁ Lade Daten aus der Cloud...', 'info');
            var n = await CloudSync.pullAll();
            _toast('✅ ' + n + ' Einträge aus Cloud geladen — App wird neu geladen', 'success');
            setTimeout(function () { location.reload(); }, 1800);

        } else if (hasLocal) {
            _toast('⬆ Migriere lokale Daten in die Cloud...', 'info');
            var n = await CloudSync.pushAll();
            _toast('✅ ' + n + ' Einträge in der Cloud gesichert', 'success');

        } else {
            _toast('☁ Cloud-Sync aktiv — neue Daten werden automatisch gesichert', 'success');
        }
    }

    function _hasLocalData() {
        if (typeof Store === 'undefined') return false;
        return Object.keys(Store._cache || {}).some(function (k) {
            return Store._isCacheableKey && Store._isCacheableKey(k);
        });
    }

    // ──────────────────────────────────────────
    // Signed-Out Handler
    // ──────────────────────────────────────────
    function _onSignedOut() {
        CloudSync.disable();
        _updateWidget(null);
    }

    // ──────────────────────────────────────────
    // Login-Banner (weiche Erinnerung)
    // ──────────────────────────────────────────
    function _showLoginBanner() {
        if (document.getElementById('authBanner')) return;
        var b = document.createElement('div');
        b.id = 'authBanner';
        b.innerHTML =
            '<span style="flex:1;line-height:1.3;">☁ <strong>Kein Cloud-Backup aktiv</strong> — Melde dich an, um deine Daten geräteübergreifend zu sichern</span>' +
            '<button class="auth-banner-btn-primary" onclick="AuthUI.openModal()">Jetzt anmelden</button>' +
            '<button class="auth-banner-btn-close" onclick="document.getElementById(\'authBanner\').remove()">×</button>';
        document.body.prepend(b);
    }

    function _hideLoginBanner() {
        var b = document.getElementById('authBanner');
        if (b) b.remove();
    }

    // ──────────────────────────────────────────
    // Status-Widget (Topnav)
    // ──────────────────────────────────────────
    function _injectWidget() {
        var ctrl = document.querySelector('.topnav-controls');
        if (!ctrl || document.getElementById('authWidget')) return;
        var w = document.createElement('div');
        w.id = 'authWidget';
        w.style.cssText = 'display:flex;align-items:center;gap:6px;';
        w.innerHTML = '<span id="cloudSyncDot" style="font-size:14px;color:#888;cursor:default;" title="Nicht angemeldet">☁</span>';
        // Vor dem ersten Kind einfügen
        ctrl.insertBefore(w, ctrl.firstChild);
    }

    function _updateWidget(user) {
        var w = document.getElementById('authWidget');
        if (!w) return;
        if (user) {
            var email = user.email || user.user_metadata?.email || '';
            var short = email ? email.split('@')[0].substring(0, 14) : 'Angemeldet';
            var esc = function(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
            w.innerHTML =
                '<span id="cloudSyncDot" style="font-size:14px;color:var(--success,#22c55e);" title="Cloud-Sync aktiv">☁</span>' +
                '<button class="auth-user-btn" onclick="AuthUI.openUserMenu(this)" title="' + esc(email) + '"><i class="ti ti-user" style="font-size:13px;"></i> ' + esc(short) + '</button>';
        } else {
            w.innerHTML =
                '<span id="cloudSyncDot" style="font-size:14px;color:#888;" title="Nicht angemeldet">☁</span>' +
                '<button class="auth-login-btn" onclick="AuthUI.openModal()">Anmelden</button>';
        }
    }

    // ──────────────────────────────────────────
    // Login / Register Modal
    // ──────────────────────────────────────────
    function openModal(mode) {
        _mode = mode || 'login';
        if (document.getElementById('authModalOverlay')) closeModal();

        var overlay = document.createElement('div');
        overlay.id = 'authModalOverlay';
        overlay.innerHTML = _buildModal();
        document.body.appendChild(overlay);

        // Fokus auf E-Mail-Feld
        setTimeout(function () {
            var el = document.getElementById('authEmail');
            if (el) el.focus();
        }, 50);

        // Schließen per Klick auf Overlay-Hintergrund
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        });

        // Enter in Passwort-Feld → Submit
        overlay.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                var active = document.activeElement;
                if (active && (active.id === 'authEmail' || active.id === 'authPassword')) {
                    _submit();
                }
            }
            if (e.key === 'Escape') closeModal();
        });
    }

    function closeModal() {
        var o = document.getElementById('authModalOverlay');
        if (o) o.remove();
    }

    function _buildModal() {
        var isLogin = _mode === 'login';
        return '<div id="authModal">' +
            // Header
            '<div class="auth-modal-header">' +
                '<div style="font-size:22px;">☁</div>' +
                '<h2>Cloud-Konto</h2>' +
                '<button class="auth-close-btn" onclick="AuthUI.closeModal()">×</button>' +
            '</div>' +

            // Tab-Switcher
            '<div class="auth-tabs">' +
                '<button id="authTabLogin" class="auth-tab' + (isLogin ? ' active' : '') + '" onclick="AuthUI.switchTab(\'login\')">Anmelden</button>' +
                '<button id="authTabRegister" class="auth-tab' + (!isLogin ? ' active' : '') + '" onclick="AuthUI.switchTab(\'register\')">Registrieren</button>' +
            '</div>' +

            // Felder
            '<div class="auth-fields">' +
                '<label class="auth-label">E-Mail-Adresse</label>' +
                '<input id="authEmail" type="email" class="auth-input" placeholder="deine@email.de" autocomplete="username">' +
                '<label class="auth-label" style="margin-top:10px;">Passwort</label>' +
                '<input id="authPassword" type="password" class="auth-input" placeholder="Mindestens 6 Zeichen" autocomplete="' + (isLogin ? 'current-password' : 'new-password') + '">' +
            '</div>' +

            // Fehlermeldungen
            '<div id="authError"   class="auth-msg error"   style="display:none;"></div>' +
            '<div id="authSuccess" class="auth-msg success" style="display:none;"></div>' +

            // Submit
            '<button id="authSubmit" class="auth-submit-btn" onclick="AuthUI._submit()">' +
                (isLogin ? 'Anmelden' : 'Konto erstellen') +
            '</button>' +

            // Skip
            '<div style="text-align:center;margin-top:12px;">' +
                '<button class="auth-skip-btn" onclick="AuthUI.closeModal()">Ohne Konto weiternutzen</button>' +
            '</div>' +

            // Info-Hinweis
            '<p class="auth-info-text">Deine Daten werden verschlüsselt gespeichert. Nur du hast Zugriff.</p>' +
        '</div>';
    }

    function switchTab(mode) {
        _mode = mode;
        openModal(mode);
    }

    async function _submit() {
        var email    = (document.getElementById('authEmail')?.value    || '').trim();
        var password =  document.getElementById('authPassword')?.value || '';

        _clearMessages();

        if (!email) { _showError('Bitte E-Mail-Adresse eingeben.'); return; }
        if (!password) { _showError('Bitte Passwort eingeben.'); return; }
        if (password.length < 6) { _showError('Passwort muss mindestens 6 Zeichen lang sein.'); return; }

        var btn = document.getElementById('authSubmit');
        if (btn) { btn.disabled = true; btn.textContent = 'Bitte warten...'; }

        try {
            var result;
            if (_mode === 'login') {
                result = await SupabaseDB.signIn(email, password);
            } else {
                result = await SupabaseDB.signUp(email, password);
            }

            if (result.error) {
                var msg = result.error.message || 'Unbekannter Fehler';
                if (/invalid login credentials/i.test(msg)) msg = 'Falsche E-Mail oder falsches Passwort.';
                if (/user already registered/i.test(msg))   msg = 'Diese E-Mail ist bereits registriert. Bitte anmelden.';
                if (/email not confirmed/i.test(msg))       msg = 'Bitte bestätige zuerst deine E-Mail-Adresse.';
                if (/password.*characters/i.test(msg))      msg = 'Passwort muss mindestens 6 Zeichen lang sein.';
                _showError(msg);
                if (btn) { btn.disabled = false; btn.textContent = _mode === 'login' ? 'Anmelden' : 'Konto erstellen'; }
                return;
            }

            // Registrierung ohne sofortige Session → E-Mail-Bestätigung erforderlich
            if (_mode === 'register' && result.data && !result.data.session) {
                _showSuccess('Bestätigungs-E-Mail gesendet! Bitte prüfe dein Postfach und klicke auf den Link.');
                if (btn) { btn.disabled = false; btn.textContent = 'Konto erstellen'; }
                return;
            }

            // Login erfolgreich — onAuthStateChange übernimmt den Rest
            closeModal();
            _toast('✅ Angemeldet als ' + email, 'success');

        } catch (e) {
            _showError('Verbindungsfehler: ' + (e.message || String(e)));
            if (btn) { btn.disabled = false; btn.textContent = _mode === 'login' ? 'Anmelden' : 'Konto erstellen'; }
        }
    }

    function _showError(msg)   { var el = document.getElementById('authError');   if (el) { el.textContent = msg; el.style.display = 'block'; } }
    function _showSuccess(msg) { var el = document.getElementById('authSuccess'); if (el) { el.textContent = msg; el.style.display = 'block'; } }
    function _clearMessages()  { _showError(''); _showSuccess(''); document.getElementById('authError').style.display='none'; document.getElementById('authSuccess').style.display='none'; }

    // ──────────────────────────────────────────
    // User-Menü (nach dem Login)
    // ──────────────────────────────────────────
    function openUserMenu(btn) {
        // Toggle: wenn Menü bereits offen → schließen
        var existing = document.getElementById('authUserMenu');
        if (existing) { existing.remove(); return; }

        var rect = btn.getBoundingClientRect();
        var menu = document.createElement('div');
        menu.id = 'authUserMenu';
        menu.style.top   = (rect.bottom + 6) + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';

        menu.innerHTML =
            '<div class="auth-menu-email">' + (btn.title || 'Angemeldet') + '</div>' +
            '<hr class="auth-menu-sep">' +
            '<button class="auth-menu-item" onclick="AuthUI._syncNow()">⬆ Jetzt synchronisieren</button>' +
            '<hr class="auth-menu-sep">' +
            '<button class="auth-menu-item danger" onclick="AuthUI._logout()">🚪 Abmelden</button>' +
            '<hr class="auth-menu-sep">' +
            '<button class="auth-menu-item danger" onclick="AuthUI._deleteAccount()" style="font-size:12px;opacity:.7;">🗑 Konto löschen (DSGVO)</button>';

        document.body.appendChild(menu);

        // Schließen bei Klick außerhalb
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

    async function _syncNow() {
        var m = document.getElementById('authUserMenu');
        if (m) m.remove();
        _toast('⬆ Synchronisiere...', 'info');
        var n = await CloudSync.pushAll();
        _toast('✅ ' + n + ' Einträge synchronisiert', 'success');
    }

    async function _logout() {
        var m = document.getElementById('authUserMenu');
        if (m) m.remove();
        await SupabaseDB.signOut();
        _toast('Abgemeldet — lokale Daten bleiben erhalten', 'info');
        setTimeout(_showLoginBanner, 1000);
    }

    // ── Konto löschen (DSGVO Art. 17) ───────────────────────────
    async function _deleteAccount() {
        var m = document.getElementById('authUserMenu');
        if (m) m.remove();

        var overlay = document.createElement('div');
        overlay.id = 'deleteAccountOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:10003;padding:20px;';
        overlay.innerHTML = [
            '<div style="background:var(--surface,#1e1e2e);border:1px solid rgba(239,68,68,.4);border-radius:14px;padding:28px 32px;max-width:420px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.6);text-align:center;">',
            '<div style="font-size:38px;margin-bottom:12px;">⚠️</div>',
            '<h2 style="color:#ef4444;font-size:17px;margin:0 0 10px;">Konto wirklich löschen?</h2>',
            '<p style="color:var(--text-muted,#888);font-size:13px;line-height:1.55;margin:0 0 20px;">',
            'Alle <strong style="color:var(--text-secondary,#ccc);">lokalen Daten</strong> werden sofort entfernt. ',
            'Deine Cloud-Daten (E-Mail, Buchungen) werden innerhalb von ',
            '<strong style="color:var(--text-secondary,#ccc);">3 Werktagen</strong> vollständig gelöscht.<br><br>',
            'Diese Aktion kann <strong style="color:#ef4444;">nicht rückgängig</strong> gemacht werden.',
            '</p>',
            '<button id="delAccConfirmBtn" style="width:100%;padding:11px;background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;margin-bottom:8px;">Ja, Konto endgültig löschen</button>',
            '<button id="delAccCancelBtn" style="background:none;border:none;color:var(--text-muted,#888);cursor:pointer;font-size:13px;width:100%;padding:6px 0;">Abbrechen</button>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
        document.getElementById('delAccCancelBtn').addEventListener('click', function() { overlay.remove(); });
        document.getElementById('delAccConfirmBtn').addEventListener('click', async function() {
            overlay.remove();
            await _doDeleteAccount();
        });
    }

    async function _doDeleteAccount() {
        _toast('⏳ Konto wird gelöscht...', 'info');
        try {
            var client = SupabaseDB.getClient();
            var user   = await SupabaseDB.getCurrentUser();
            if (client && user) {
                // Cloud-Daten löschen (RLS erlaubt nur eigene Zeilen)
                await client.from('user_data').delete().eq('user_id', user.id);
                await client.from('subscriptions').delete().eq('user_id', user.id);
            }
        } catch (e) {
            console.warn('[AuthUI] Cloud-Datenlöschung teilweise fehlgeschlagen:', e);
        }
        // Alle lokalen Daten löschen
        try { localStorage.clear(); } catch(e) {}
        // Abmelden
        try { await SupabaseDB.signOut(); } catch(e) {}
        _toast('✅ Konto gelöscht. Bis bald!', 'success');
        setTimeout(function() { location.reload(); }, 2000);
    }

    // ──────────────────────────────────────────
    // Toast-Helfer
    // ──────────────────────────────────────────
    function _toast(msg, type) {
        if (typeof Utils !== 'undefined' && Utils.showToast) {
            Utils.showToast(msg, type || 'info', 4000);
        } else {
            console.info('[AuthUI]', msg);
        }
    }

    // ──────────────────────────────────────────
    // Styles
    // ──────────────────────────────────────────
    function _injectStyles() {
        if (document.getElementById('authUiStyles')) return;
        var s = document.createElement('style');
        s.id = 'authUiStyles';
        s.textContent = `
/* ── Login-Banner ──────────────────────── */
#authBanner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    background: rgba(99,102,241,.1);
    border-bottom: 1px solid rgba(99,102,241,.2);
    font-size: 12px;
    color: var(--text-secondary, #aaa);
    position: relative;
    z-index: 200;
}
.auth-banner-btn-primary {
    background: var(--accent, #6366f1);
    color: #fff;
    border: none;
    padding: 5px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
    flex-shrink: 0;
}
.auth-banner-btn-close {
    background: none;
    border: none;
    color: var(--text-muted, #888);
    cursor: pointer;
    font-size: 20px;
    padding: 0 4px;
    line-height: 1;
    flex-shrink: 0;
}

/* ── Topnav-Buttons ─────────────────────── */
.auth-login-btn, .auth-user-btn {
    background: none;
    border: 1px solid var(--border, #333);
    color: var(--text-muted, #aaa);
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
}
.auth-user-btn  { color: var(--text-primary, #fff); }
.auth-login-btn:hover, .auth-user-btn:hover { background: var(--surface-2, rgba(255,255,255,.06)); }

/* ── Modal-Overlay ──────────────────────── */
#authModalOverlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
}

/* ── Modal-Box ──────────────────────────── */
#authModal {
    background: var(--surface, #1e1e2e);
    border: 1px solid var(--border, #2e2e42);
    border-radius: 14px;
    padding: 28px 32px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 24px 64px rgba(0,0,0,.6);
}
.auth-modal-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 22px;
}
.auth-modal-header h2 {
    flex: 1;
    color: var(--text-primary, #fff);
    font-size: 17px;
    margin: 0;
}
.auth-close-btn {
    background: none;
    border: none;
    color: var(--text-muted, #888);
    font-size: 22px;
    cursor: pointer;
    padding: 0;
    line-height: 1;
}

/* ── Tabs ───────────────────────────────── */
.auth-tabs {
    display: flex;
    border: 1px solid var(--border, #2e2e42);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 22px;
}
.auth-tab {
    flex: 1;
    padding: 8px;
    border: none;
    background: transparent;
    color: var(--text-muted, #888);
    cursor: pointer;
    font-size: 13px;
    transition: .15s;
}
.auth-tab.active {
    background: var(--accent, #6366f1);
    color: #fff;
    font-weight: 600;
}

/* ── Felder ─────────────────────────────── */
.auth-label {
    display: block;
    font-size: 11px;
    color: var(--text-muted, #888);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: .5px;
}
.auth-input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--border, #2e2e42);
    background: var(--bg, #13131f);
    color: var(--text-primary, #fff);
    font-size: 14px;
    box-sizing: border-box;
    transition: border-color .15s;
}
.auth-input:focus {
    outline: none;
    border-color: var(--accent, #6366f1);
}

/* ── Nachrichten ────────────────────────── */
.auth-msg {
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    margin: 10px 0 0;
}
.auth-msg.error   { background: rgba(239,68,68,.12);  border: 1px solid rgba(239,68,68,.3);  color: #f87171; }
.auth-msg.success { background: rgba(34,197,94,.12);  border: 1px solid rgba(34,197,94,.3);  color: #4ade80; }

/* ── Submit-Button ──────────────────────── */
.auth-submit-btn {
    width: 100%;
    padding: 11px;
    margin-top: 18px;
    background: var(--accent, #6366f1);
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: opacity .15s;
}
.auth-submit-btn:hover    { opacity: .88; }
.auth-submit-btn:disabled { opacity: .5; cursor: default; }
.auth-skip-btn {
    background: none;
    border: none;
    color: var(--text-muted, #888);
    cursor: pointer;
    font-size: 12px;
}
.auth-skip-btn:hover { color: var(--text-secondary, #aaa); }
.auth-info-text {
    text-align: center;
    font-size: 11px;
    color: var(--text-muted, #666);
    margin: 14px 0 0;
}

/* ── User-Menü ──────────────────────────── */
#authUserMenu {
    position: fixed;
    background: var(--surface, #1e1e2e);
    border: 1px solid var(--border, #2e2e42);
    border-radius: 8px;
    padding: 4px;
    min-width: 200px;
    z-index: 9999;
    box-shadow: 0 8px 28px rgba(0,0,0,.45);
}
.auth-menu-email {
    padding: 8px 12px 6px;
    font-size: 11px;
    color: var(--text-muted, #888);
    word-break: break-all;
}
.auth-menu-sep {
    border: none;
    border-top: 1px solid var(--border, #2e2e42);
    margin: 2px 0;
}
.auth-menu-item {
    display: block;
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    color: var(--text-primary, #fff);
    cursor: pointer;
    text-align: left;
    font-size: 13px;
    border-radius: 5px;
}
.auth-menu-item:hover  { background: var(--surface-2, rgba(255,255,255,.06)); }
.auth-menu-item.danger { color: #ef4444; }
`;
        document.head.appendChild(s);
    }

    // ──────────────────────────────────────────
    // Auto-Init nach DOMContentLoaded
    // ──────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 300); });
    } else {
        setTimeout(init, 300);
    }

    return { init, openModal, closeModal, switchTab, _submit, openUserMenu, _syncNow, _logout, _deleteAccount };
})();
