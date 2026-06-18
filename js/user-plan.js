// ============================================
// UserPlan — Whop-basierte Abo-Verwaltung
//
// Whop OAuth hat die Membership bereits vor App-Start
// validiert (in WhopAuth.boot()). Diese Datei ist
// daher vereinfacht: immer 'pro', kein Paddle-Code.
// ============================================
var UserPlan = (function () {
    'use strict';

    var WHOP_PURCHASE_URL = 'https://whop.com/stackr-3244/';

    var _plan   = 'pro';
    var _loaded = false;

    // ── Laden (wird von AuthUI nach Login aufgerufen) ─────────
    async function load(userId) {
        _plan   = 'pro';
        _loaded = true;
        _updateUI();
    }

    // ── Getter ────────────────────────────────────────────────
    function isPro()          { return true; }
    function isFree()         { return false; }
    function getPlan()        { return _plan; }
    function isTrialActive()  { return false; }
    function isTrialExpired() { return false; }
    function getTrialDaysLeft() { return null; }

    // ── Feature-Gate ──────────────────────────────────────────
    function requirePro(featureName) { return true; }
    function getLimit(key)           { return Infinity; }

    // ── Lock-Modal (Fallback, sollte nicht erscheinen) ────────
    function _showLockModal() {
        if (document.getElementById('trialLockOverlay')) return;
        var overlay = document.createElement('div');
        overlay.id = 'trialLockOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';
        overlay.innerHTML = [
            '<div style="background:var(--surface,#1e1e2e);border:1px solid rgba(99,102,241,.4);border-radius:16px;padding:36px 32px;max-width:420px;width:100%;text-align:center;box-shadow:0 32px 80px rgba(0,0,0,.8);">',
            '<div style="font-size:44px;margin-bottom:14px;">🔒</div>',
            '<h2 style="color:var(--text-primary,#fff);font-size:20px;margin:0 0 10px;font-weight:800;">Abo abgelaufen</h2>',
            '<p style="color:var(--text-muted,#888);font-size:14px;margin:0 0 24px;line-height:1.6;">Dein Stackr Pro Abo ist nicht mehr aktiv.<br>Verlängere es direkt über Whop.</p>',
            '<a href="' + WHOP_PURCHASE_URL + '" target="_blank" rel="noopener" ',
            'style="display:block;width:100%;padding:13px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;box-sizing:border-box;">',
            'Stackr Pro verlängern →',
            '</a>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);
    }

    // ── Upgrade-Modal (Fallback, kein Trial mehr) ─────────────
    function _showUpgradeModal(feature) {
        // Kein Trial mehr — direkt zum Whop-Kauf weiterleiten
        location.href = WHOP_PURCHASE_URL;
    }

    // ── Badge (Topnav) ────────────────────────────────────────
    function _updateUI() {
        var badge = document.getElementById('planBadge');
        if (!badge) return;
        badge.textContent = 'PRO';
        badge.style.cssText = 'background:linear-gradient(135deg,#10b981,#0da271);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:.5px;';
        badge.onclick = null;
    }

    function injectBadge() {
        if (document.getElementById('planBadge')) return;
        var ctrl = document.querySelector('.topnav-controls');
        if (!ctrl) return;
        var badge = document.createElement('span');
        badge.id = 'planBadge';
        ctrl.insertBefore(badge, ctrl.firstChild);
        _updateUI();
    }

    // Checkout-Stubs → leiten zu Whop weiter
    function openCheckout()       { location.href = WHOP_PURCHASE_URL; }
    function openCheckoutYearly() { location.href = WHOP_PURCHASE_URL; }

    var _public = {
        load, isPro, isFree, getPlan,
        isTrialActive, isTrialExpired, getTrialDaysLeft,
        requirePro, getLimit, injectBadge,
        openCheckout, openCheckoutYearly,
        _showUpgradeModal, _showLockModal,
    };
    Object.freeze(_public);
    return _public;
})();
