// ============================================
// UserPlan — Abo-Verwaltung & Feature-Gates
//
// Free:  Buchungen (max 50), Basis-Dashboard
// Pro:   Alles — 10,00 € / Monat
// ============================================
var UserPlan = (function () {
    'use strict';

    var _plan    = 'free';   // 'free' | 'pro'
    var _expiry  = null;
    var _loaded  = false;
    var _userId  = null;

    // ── Abo aus Supabase laden ────────────────
    async function load(userId) {
        _userId = userId;
        var client = SupabaseDB.getClient();
        if (!client || !userId) { _plan = 'free'; _loaded = true; return; }

        try {
            var res = await client
                .from('subscriptions')
                .select('status, current_period_end, plan')
                .eq('user_id', userId)
                .maybeSingle();

            if (res.data && res.data.status === 'active') {
                var expired = res.data.current_period_end
                    ? new Date(res.data.current_period_end) < new Date()
                    : false;
                _plan   = expired ? 'free' : 'pro';
                _expiry = res.data.current_period_end;
            } else {
                _plan = 'free';
            }
        } catch (e) {
            console.warn('[UserPlan] Laden fehlgeschlagen:', e.message);
            _plan = 'free';
        }
        _loaded = true;
        _updateUI();
    }

    // ── Getter ────────────────────────────────
    function isPro()  { return _plan === 'pro'; }
    function isFree() { return _plan === 'free'; }
    function getPlan() { return _plan; }

    // ── Feature-Gate ──────────────────────────
    // Gibt true zurück wenn Pro, zeigt sonst Upgrade-Modal
    function requirePro(featureName) {
        if (isPro()) return true;
        _showUpgradeModal(featureName);
        return false;
    }

    // ── Freemium-Limits ───────────────────────
    var LIMITS = {
        maxBuchungen: 50    // Free: max 50 Buchungen
    };

    function getLimit(key) {
        if (isPro()) return Infinity;
        return LIMITS[key] || 0;
    }

    // ── Upgrade Modal ─────────────────────────
    function _showUpgradeModal(feature) {
        var overlay = document.createElement('div');
        overlay.id = 'upgradeModalOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:10001;padding:20px;';

        overlay.innerHTML = [
            '<div style="background:var(--surface,#1e1e2e);border:1px solid rgba(99,102,241,.35);border-radius:14px;padding:32px;max-width:400px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,.6);">',
            '<div style="font-size:40px;margin-bottom:12px;">⭐</div>',
            '<h2 style="color:var(--text-primary,#fff);font-size:18px;margin:0 0 8px;">Pro-Feature</h2>',
            feature ? '<p style="color:var(--text-muted,#888);font-size:14px;margin:0 0 20px;"><strong style="color:var(--text-secondary,#ccc);">' + (feature+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</strong> ist nur im Pro-Abo verfügbar.</p>' : '',
            '<div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:16px;margin-bottom:20px;">',
            '<div style="font-size:28px;font-weight:700;color:var(--text-primary,#fff);">10,00 € <span style="font-size:14px;font-weight:400;color:var(--text-muted,#888);">/ Monat</span></div>',
            '<div style="font-size:12px;color:var(--text-muted,#888);margin-top:4px;">Jederzeit kündbar</div>',
            '</div>',
            '<button onclick="UserPlan.openCheckout()" style="width:100%;padding:12px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;margin-bottom:8px;">Monatlich — 10,00 €/Monat →</button>',
            '<button onclick="UserPlan.openCheckoutYearly()" style="width:100%;padding:11px;background:rgba(16,185,129,.1);color:#10b981;border:1px solid rgba(16,185,129,.3);border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;margin-bottom:10px;">Jährlich — 90,00 €/Jahr <span style="font-size:11px;opacity:.8;">· 25% sparen</span></button>',
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

    function openCheckout(priceId) {
        priceId = priceId || PRICE_ID_MONTHLY;

        if (typeof Paddle === 'undefined') {
            if (typeof Notyf !== 'undefined') new Notyf().error('Paddle nicht geladen. Bitte Seite neu laden.');
            else alert('Paddle nicht geladen.');
            return;
        }

        var email = '', userId = _userId || '';
        try {
            var session = JSON.parse(localStorage.getItem('oyi_auth_session') || '{}');
            email  = (session.user && session.user.email) || '';
            userId = (session.user && session.user.id) || userId;
        } catch (e) {}

        var opts = {
            items: [{ priceId: priceId, quantity: 1 }],
            customData: { user_id: userId },
            successUrl: 'https://stackr-buchhaltung.netlify.app/index.html?upgrade=success'
        };
        if (email) opts.customer = { email: email };

        Paddle.Checkout.open(opts);
    }

    function openCheckoutYearly() { openCheckout(PRICE_ID_YEARLY); }

    // ── UI aktualisieren ──────────────────────
    function _updateUI() {
        // Plan-Badge in Topnav aktualisieren
        var badge = document.getElementById('planBadge');
        if (!badge) return;
        if (isPro()) {
            badge.textContent = 'PRO';
            badge.style.cssText = 'background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:.5px;';
        } else {
            badge.textContent = 'FREE';
            badge.style.cssText = 'background:rgba(255,255,255,.08);color:var(--text-muted,#888);font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:.5px;cursor:pointer;';
            badge.onclick = function () { _showUpgradeModal(); };
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

    return { load, isPro, isFree, getPlan, requirePro, getLimit, openCheckout, openCheckoutYearly, injectBadge, _showUpgradeModal };
})();
