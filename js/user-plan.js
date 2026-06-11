// ============================================
// UserPlan — Abo-Verwaltung & Feature-Gates
//
// Trial: 14 Tage voller Zugriff (kein Credit Card nötig)
// Pro:   Alles nach Trial — 10,00 € / Monat (inkl. MwSt.)
// Abgelaufen: App gesperrt bis Upgrade
// ============================================
var UserPlan = (function () {
    'use strict';

    var _plan        = 'trial';  // 'trial' | 'pro' | 'expired'
    var _expiry      = null;
    var _loaded      = false;
    var _userId      = null;
    var _trialStart  = null;

    var TRIAL_DAYS        = 14;
    var TRIAL_STORAGE_KEY = 'oyi_trial_start';

    // ── Trial-Start initialisieren (für nicht-eingeloggte User) ───
    // Defence-in-depth: Store in both localStorage AND sessionStorage.
    // If localStorage is cleared, sessionStorage (tab-persistent) catches reset
    // within the same browser session. Cross-session resets still possible for
    // non-logged-in users — full fix requires server-side (see load() which
    // reads trial_start from Supabase user_metadata for logged-in users).
    var SESSION_TRIAL_KEY = 'oyi_trial_start_session';
    function _initTrialStart() {
        var lsVal  = localStorage.getItem(TRIAL_STORAGE_KEY);
        var ssVal  = sessionStorage.getItem(SESSION_TRIAL_KEY);

        // Use the EARLIER of the two dates to prevent rollback attacks
        var candidates = [lsVal, ssVal].filter(Boolean).map(function(v) { return new Date(v); }).filter(function(d) { return !isNaN(d.getTime()); });
        var earliest = candidates.length ? candidates.reduce(function(a, b) { return a < b ? a : b; }) : null;

        if (!earliest) {
            // First visit: record now in both storages
            var now = new Date().toISOString();
            localStorage.setItem(TRIAL_STORAGE_KEY, now);
            sessionStorage.setItem(SESSION_TRIAL_KEY, now);
            _trialStart = new Date(now);
        } else {
            // Sync both to the earliest recorded value (rollback prevention)
            var iso = earliest.toISOString();
            localStorage.setItem(TRIAL_STORAGE_KEY, iso);
            sessionStorage.setItem(SESSION_TRIAL_KEY, iso);
            _trialStart = earliest;
        }
    }

    // ── Trial-Tage berechnen ──────────────────
    function getTrialDaysLeft() {
        if (_plan === 'pro') return null;
        if (!_trialStart) return 0;
        var elapsed = (Date.now() - _trialStart.getTime()) / (1000 * 60 * 60 * 24);
        return Math.max(0, Math.ceil(TRIAL_DAYS - elapsed));
    }

    function isTrialActive()  { return _plan !== 'pro' && getTrialDaysLeft() > 0; }
    function isTrialExpired() { return _plan !== 'pro' && getTrialDaysLeft() === 0; }

    // ── Abo aus Supabase laden ────────────────
    async function load(userId) {
        _userId = userId;
        var client = SupabaseDB.getClient();

        // Trial-Start aus localStorage laden (Fallback für nicht eingeloggte)
        _initTrialStart();

        if (!client || !userId) {
            _plan = isTrialActive() ? 'trial' : 'expired';
            _loaded = true;
            _updateUI();
            if (isTrialExpired()) _showLockModal();
            return;
        }

        try {
            // trial_start aus Supabase user-metadata lesen (verhindert Reset via localStorage-Clear)
            var { data: { user } } = await client.auth.getUser();
            if (user && user.user_metadata && user.user_metadata.trial_start) {
                _trialStart = new Date(user.user_metadata.trial_start);
                localStorage.setItem(TRIAL_STORAGE_KEY, user.user_metadata.trial_start);
            } else if (user) {
                // Noch kein trial_start → user.created_at nutzen (zuverlässig, nicht manipulierbar)
                var accountCreated = user.created_at || new Date().toISOString();
                _trialStart = new Date(accountCreated);
                localStorage.setItem(TRIAL_STORAGE_KEY, accountCreated);
                await client.auth.updateUser({ data: { trial_start: accountCreated } });
            }

            // Subscription-Status prüfen
            var res = await client
                .from('subscriptions')
                .select('status, current_period_end, plan')
                .eq('user_id', userId)
                .maybeSingle();

            if (res.data && res.data.status === 'active') {
                var expired = res.data.current_period_end
                    ? new Date(res.data.current_period_end) < new Date()
                    : false;
                _plan   = expired ? (isTrialActive() ? 'trial' : 'expired') : 'pro';
                _expiry = res.data.current_period_end;
            } else {
                _plan = isTrialActive() ? 'trial' : 'expired';
            }
        } catch (e) {
            console.warn('[UserPlan] Laden fehlgeschlagen:', e.message);
            _plan = isTrialActive() ? 'trial' : 'expired';
        }
        _loaded = true;
        _updateUI();
        if (isTrialExpired()) _showLockModal();
    }

    // ── Getter ────────────────────────────────
    function isPro()  { return _plan === 'pro'; }
    function isFree() { return _plan === 'expired'; }
    function getPlan() { return _plan; }

    // ── Feature-Gate ──────────────────────────
    // Gibt true zurück wenn Pro oder Trial aktiv, zeigt sonst Lock-Modal
    function requirePro(featureName) {
        if (isPro() || isTrialActive()) return true;
        _showLockModal();
        return false;
    }

    // ── Limits ───────────────────────────────
    function getLimit(key) {
        if (isPro() || isTrialActive()) return Infinity;
        return 0; // Trial abgelaufen: alles gesperrt
    }

    // ── Lock-Modal (Trial abgelaufen — nicht schließbar) ──────────
    function _showLockModal() {
        if (document.getElementById('trialLockOverlay')) return;

        var overlay = document.createElement('div');
        overlay.id = 'trialLockOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';

        overlay.innerHTML = [
            '<div style="background:var(--surface,#1e1e2e);border:1px solid rgba(99,102,241,.4);border-radius:16px;padding:36px 32px;max-width:420px;width:100%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,.8);">',
            '<div style="font-size:44px;margin-bottom:14px;">⏳</div>',
            '<h2 style="color:var(--text-primary,#fff);font-size:20px;margin:0 0 10px;font-weight:800;">Testphase abgelaufen</h2>',
            '<p style="color:var(--text-muted,#888);font-size:14px;margin:0 0 24px;line-height:1.6;">',
            'Deine <strong style="color:var(--text-secondary,#ccc);">14-tägige Testphase</strong> ist beendet.<br>',
            'Wähle ein Abo um Stackr weiter zu nutzen.',
            '</p>',
            '<div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:16px;margin-bottom:20px;">',
            '<div style="font-size:26px;font-weight:800;color:var(--text-primary,#fff);">7,50 € <span style="font-size:13px;font-weight:400;color:var(--text-muted,#888);">/ Monat</span></div>',
            '<div style="font-size:11px;color:var(--text-muted,#888);margin-top:4px;">bei jährlicher Zahlung · 90,00 €/Jahr inkl. MwSt.</div>',
            '</div>',
            '<button onclick="UserPlan.openCheckoutYearly()" style="width:100%;padding:13px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:700;margin-bottom:8px;">Jährlich — 90,00 €/Jahr <span style="font-size:12px;font-weight:400;opacity:.9;">· 25% sparen →</span></button>',
            '<button onclick="UserPlan.openCheckout()" style="width:100%;padding:12px;background:rgba(16,185,129,.1);color:#10b981;border:1px solid rgba(16,185,129,.3);border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;margin-bottom:4px;">Monatlich — 10,00 €/Monat <span style="font-size:11px;opacity:.7;">inkl. MwSt.</span></button>',
            '</div>'
        ].join('');

        document.body.appendChild(overlay);
        // Keine Escape/Backdrop-Dismiss — App ist gesperrt
    }

    // ── Upgrade-Modal (während Trial — schließbar) ────────────────
    function _showUpgradeModal(feature) {
        if (document.getElementById('upgradeModalOverlay')) return;
        var daysLeft = getTrialDaysLeft();
        var overlay = document.createElement('div');
        overlay.id = 'upgradeModalOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:10001;padding:20px;';

        overlay.innerHTML = [
            '<div style="background:var(--surface,#1e1e2e);border:1px solid rgba(99,102,241,.35);border-radius:14px;padding:32px;max-width:400px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.6);">',
            '<div style="font-size:40px;margin-bottom:12px;">⭐</div>',
            '<h2 style="color:var(--text-primary,#fff);font-size:18px;margin:0 0 8px;">Pro-Feature</h2>',
            feature ? '<p style="color:var(--text-muted,#888);font-size:14px;margin:0 0 8px;"><strong style="color:var(--text-secondary,#ccc);">' + (feature+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</strong> ist nur im Pro-Abo verfügbar.</p>' : '',
            daysLeft !== null ? '<p style="color:var(--text-muted,#888);font-size:12px;margin:0 0 16px;">Noch <strong style="color:#fbbf24;">' + daysLeft + ' Tag' + (daysLeft === 1 ? '' : 'e') + '</strong> in deiner Testphase.</p>' : '',
            '<div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:16px;margin-bottom:20px;">',
            '<div style="font-size:28px;font-weight:700;color:var(--text-primary,#fff);">7,50 € <span style="font-size:14px;font-weight:400;color:var(--text-muted,#888);">/ Monat</span></div>',
            '<div style="font-size:12px;color:var(--text-muted,#888);margin-top:4px;">bei jährlicher Zahlung · 90,00 €/Jahr inkl. MwSt.</div>',
            '</div>',
            '<button onclick="UserPlan.openCheckoutYearly()" style="width:100%;padding:12px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;margin-bottom:8px;">Jährlich — 90,00 €/Jahr <span style="font-size:12px;font-weight:400;opacity:.9;">· 25% sparen →</span></button>',
            '<button onclick="UserPlan.openCheckout()" style="width:100%;padding:11px;background:rgba(16,185,129,.1);color:#10b981;border:1px solid rgba(16,185,129,.3);border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;margin-bottom:10px;">Monatlich — 10,00 €/Monat <span style="font-size:11px;opacity:.7;">inkl. MwSt.</span></button>',
            '<button onclick="document.getElementById(\'upgradeModalOverlay\').remove()" style="background:none;border:none;color:var(--text-muted,#888);cursor:pointer;font-size:13px;">Vielleicht später</button>',
            '</div>'
        ].join('');

        document.body.appendChild(overlay);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) overlay.remove();
        });
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
        });
    }

    // ── Paddle Checkout ───────────────────────────────────────────
    var PADDLE_TOKEN     = 'live_7d279f61a3499fed520f7cd8c08';
    var PRICE_ID_MONTHLY = 'pri_01kt7ksxhv4q4evpz78jsfjv98';
    var PRICE_ID_YEARLY  = 'pri_01kt7m5y77v2d49kgc8hfpr13n';

    // Widerrufsrecht-Bestätigung vor Checkout (§ 356 Abs. 5 BGB)
    function _confirmWiderrufsrecht(onConfirmed) {
        var overlay = document.createElement('div');
        overlay.id = 'widerrufsModalOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:10002;padding:20px;';

        overlay.innerHTML = [
            '<div style="background:var(--surface,#1e1e2e);border:1px solid rgba(99,102,241,.35);border-radius:14px;padding:28px 32px;max-width:460px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.6);">',
            '<h2 style="color:var(--text-primary,#fff);font-size:17px;margin:0 0 6px;">Bestellung bestätigen</h2>',
            '<p style="color:var(--text-muted,#888);font-size:12px;margin:0 0 18px;">Bitte bestätige vor dem Kauf:</p>',
            '<label style="display:flex;gap:12px;align-items:flex-start;cursor:pointer;margin-bottom:22px;padding:14px;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.15);border-radius:8px;">',
            '<input type="checkbox" id="widerrufsCheckbox" style="margin-top:2px;flex-shrink:0;width:16px;height:16px;accent-color:#10b981;cursor:pointer;">',
            '<span style="color:var(--text-secondary,#ccc);font-size:13px;line-height:1.55;">',
            'Ich stimme ausdrücklich zu, dass mit der Ausführung des Vertrags sofort begonnen wird, ',
            'und nehme zur Kenntnis, dass ich damit mein Widerrufsrecht verliere, sobald der Dienst ',
            'vollständig erbracht wurde (§&nbsp;356 Abs.&nbsp;5 BGB). ',
            'Ich habe die <a href="refund.html" target="_blank" style="color:#34d399;">Widerrufsbelehrung</a> gelesen.',
            '</span>',
            '</label>',
            '<button id="widerrufsWeiterBtn" disabled style="width:100%;padding:12px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;margin-bottom:8px;opacity:.35;cursor:not-allowed;transition:opacity .2s,cursor .2s;">Weiter zur Zahlung →</button>',
            '<button id="widerrufsAbbrBtn" style="background:none;border:none;color:var(--text-muted,#888);cursor:pointer;font-size:13px;width:100%;padding:6px 0;">Abbrechen</button>',
            '</div>'
        ].join('');

        document.body.appendChild(overlay);

        var cb  = document.getElementById('widerrufsCheckbox');
        var btn = document.getElementById('widerrufsWeiterBtn');
        var abb = document.getElementById('widerrufsAbbrBtn');

        cb.addEventListener('change', function () {
            btn.disabled = !cb.checked;
            btn.style.opacity = cb.checked ? '1' : '.35';
            btn.style.cursor  = cb.checked ? 'pointer' : 'not-allowed';
        });
        btn.addEventListener('click', function () {
            if (cb.checked) { overlay.remove(); onConfirmed(); }
        });
        abb.addEventListener('click', function () { overlay.remove(); });
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
        document.addEventListener('keydown', function escH(e) {
            if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escH); }
        });
    }

    function openCheckout(priceId) {
        priceId = priceId || PRICE_ID_MONTHLY;

        if (typeof Paddle === 'undefined') {
            if (typeof Notyf !== 'undefined') new Notyf().error('Paddle nicht geladen. Bitte Seite neu laden.');
            else alert('Paddle nicht geladen.');
            return;
        }

        _confirmWiderrufsrecht(function () {
            var email = '', userId = _userId || '';
            try {
                var session = JSON.parse(localStorage.getItem('oyi_auth_session') || '{}');
                email  = (session.user && session.user.email) || '';
                userId = (session.user && session.user.id) || userId;
            } catch (e) {}

            var opts = {
                items: [{ priceId: priceId, quantity: 1 }],
                customData: { user_id: userId },
                successUrl: 'https://track-your-income-app.vercel.app/app.html?upgrade=success'
            };
            if (email) opts.customer = { email: email };

            // Lazy-load Paddle.js on first upgrade click (saves ~120KB on initial page load)
            if (typeof PaddleLoader !== 'undefined') {
                PaddleLoader.load().then(function () {
                    Paddle.Checkout.open(opts);
                }).catch(function (err) {
                    console.error('[UserPlan] Paddle load failed', err);
                    if (typeof notyf !== 'undefined') {
                        notyf.error('Checkout konnte nicht geladen werden. Bitte Seite neu laden.');
                    }
                });
            } else if (typeof Paddle !== 'undefined') {
                Paddle.Checkout.open(opts); // fallback: Paddle already loaded
            } else {
                console.error('[UserPlan] Paddle not available');
            }
        });
    }

    function openCheckoutYearly() { openCheckout(PRICE_ID_YEARLY); }

    // ── UI aktualisieren ──────────────────────
    function _updateUI() {
        var badge = document.getElementById('planBadge');
        if (!badge) return;

        if (isPro()) {
            badge.textContent = 'PRO';
            badge.style.cssText = 'background:linear-gradient(135deg,#10b981,#0da271);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:.5px;';
            badge.onclick = null;
        } else if (isTrialActive()) {
            var d = getTrialDaysLeft();
            var urgent = d <= 2;
            badge.textContent = 'TRIAL ' + d + 'T';
            badge.style.cssText = 'background:' + (urgent ? 'rgba(239,68,68,.15)' : 'rgba(251,191,36,.15)') + ';color:' + (urgent ? '#ef4444' : '#fbbf24') + ';font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:.5px;cursor:pointer;border:1px solid ' + (urgent ? 'rgba(239,68,68,.3)' : 'rgba(251,191,36,.3)') + ';';
            badge.onclick = function () { _showUpgradeModal(); };
        } else {
            badge.textContent = 'ABGELAUFEN';
            badge.style.cssText = 'background:rgba(239,68,68,.15);color:#ef4444;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:.5px;cursor:pointer;border:1px solid rgba(239,68,68,.3);';
            badge.onclick = function () { _showLockModal(); };
        }
    }

    // Plan-Badge in Topnav einmalig injizieren
    function injectBadge() {
        if (document.getElementById('planBadge')) return;
        var ctrl = document.querySelector('.topnav-controls');
        if (!ctrl) return;
        var badge = document.createElement('span');
        badge.id = 'planBadge';
        ctrl.insertBefore(badge, ctrl.firstChild);
        _updateUI();
    }

    // Trial bei Seitenload initialisieren (für nicht-eingeloggte User)
    _initTrialStart();

    // ── Periodischer Trial-Check (alle 5 Minuten) ─────────────────
    // Sperrt App wenn Trial während einer laufenden Sitzung abläuft
    setInterval(function () {
        if (_plan !== 'pro' && _loaded && isTrialExpired()) {
            _plan = 'expired';
            _updateUI();
            _showLockModal();
        }
    }, 5 * 60 * 1000);

    var _public = {
        load, isPro, isFree, getPlan,
        isTrialActive, isTrialExpired, getTrialDaysLeft,
        requirePro, getLimit,
        openCheckout, openCheckoutYearly,
        injectBadge, _showUpgradeModal, _showLockModal
    };
    // Prevent Object.defineProperty bypass attacks (e.g. isPro: () => true)
    Object.freeze(_public);
    return _public;
})();
