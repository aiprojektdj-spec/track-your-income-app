// ============================================
// UserPlan — Abo-Verwaltung & Feature-Gates
//
// Free:  Buchungen (max 50), Basis-Dashboard
// Pro:   Alles — 9,99 € / Monat
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
            feature ? '<p style="color:var(--text-muted,#888);font-size:14px;margin:0 0 20px;"><strong style="color:var(--text-secondary,#ccc);">' + feature + '</strong> ist nur im Pro-Abo verfügbar.</p>' : '',
            '<div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:16px;margin-bottom:20px;">',
            '<div style="font-size:28px;font-weight:700;color:var(--text-primary,#fff);">9,99 € <span style="font-size:14px;font-weight:400;color:var(--text-muted,#888);">/ Monat</span></div>',
            '<div style="font-size:12px;color:var(--text-muted,#888);margin-top:4px;">Jederzeit kündbar</div>',
            '</div>',
            '<button onclick="UserPlan.openCheckout()" style="width:100%;padding:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;margin-bottom:10px;">Jetzt upgraden →</button>',
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

    // ── Checkout-Link (LemonSqueezy) ──────────────────────────────
    // So erhältst du die URL:
    //   1. LemonSqueezy → Dein Store → Products → Produkt wählen
    //   2. Reiter "Sharing" → "Checkout URL" kopieren
    //   Beispiel: https://trackyourincome.lemonsqueezy.com/checkout/buy/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    //
    var CHECKOUT_URL = 'https://trackyourincome.lemonsqueezy.com/checkout/buy/DEIN-PRODUKT-ID';

    function openCheckout() {
        // E-Mail des Users vorausfüllen wenn möglich
        var email = '';
        try {
            var session = JSON.parse(localStorage.getItem('oyi_auth_session') || '{}');
            email = (session.user && session.user.email) || '';
        } catch (e) {}

        var url = CHECKOUT_URL;
        if (email) url += (url.includes('?') ? '&' : '?') + 'checkout[email]=' + encodeURIComponent(email);
        if (_userId) url += '&checkout[custom][user_id]=' + encodeURIComponent(_userId);

        window.open(url, '_blank');
    }

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

    return { load, isPro, isFree, getPlan, requirePro, getLimit, openCheckout, injectBadge, _showUpgradeModal };
})();
