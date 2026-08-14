// ============================================
// UserPlan — Whop-basierte Abo-Verwaltung
//
// Whop OAuth hat die Membership bereits vor App-Start
// validiert (in WhopAuth.boot()). Diese Datei ist
// daher vereinfacht: immer 'pro', kein Paddle-Code.
// ============================================
var UserPlan = (function () {
    'use strict';

    // NIE auf den Company-Hub https://whop.com/stackr-3244/ verlinken — allgemeine Profilseite
    // mit "Join"-Button, führt erst über Products→See all→Stackr Pro zum Kauf (Kunde blieb dort
    // hängen). Direkter Checkout-Link landet sofort auf "Stackr Pro" (verifiziert: HTTP 200).
    var WHOP_PURCHASE_URL = 'https://whop.com/checkout/plan_iR6YIKLcychSZ'; // Direkt-Checkout monatlich
    var WHOP_URL_MONTHLY  = 'https://whop.com/checkout/plan_iR6YIKLcychSZ'; // Stackr Pro monatlich (15 €) — Whop-Plan plan_iR6YIKLcychSZ
    var WHOP_URL_YEARLY   = 'https://whop.com/checkout/plan_b5IBQ1lecggOT'; // Stackr Pro jährlich (135 €) — Whop-Plan plan_b5IBQ1lecggOT (Produkt "Stackr App Access", gewährt dieselbe App)

    var _plan   = 'pro';
    var _loaded = false;

    // ── Abo-Status aus dem Server-Check (Fund N2, Monetarisierungs-Audit 2026-08-12) ──────────
    // api/whop-access.js liefert seit dem N2-Fix `status` ('active' | 'trialing') und `renews_at`
    // mit. Vorher warf der Server die Information weg, obwohl er sie kannte — die App konnte
    // während der sieben Trial-Tage nicht sagen, dass ein Trial läuft, wie viele Tage bleiben und
    // wann die erste Abbuchung kommt. Das Kontomenü zeigte "Pro aktiv": formal richtig, aber es
    // verdeckt die anstehende Zahlung. Genau daraus entstehen Rückbuchungen.
    //
    // Persistiert, weil der Server-Check nicht bei jedem Seitenaufruf läuft (Offline-Grace) —
    // ohne Persistenz wäre der Hinweis nach einem Reload weg. Enthält kein Geheimnis: Status und
    // ein Zeitpunkt, beides steht dem Nutzer ohnehin zu.
    var LS_ACCESS = 'whop_access_info';
    var _status   = null;   // 'active' | 'trialing' | null (unbekannt)
    var _renewsAt = null;   // ms-Epoch oder null

    function _loadAccessInfo() {
        try {
            var raw = localStorage.getItem(LS_ACCESS);
            if (!raw) return;
            var o = JSON.parse(raw);
            _status   = o && typeof o.status === 'string' ? o.status : null;
            _renewsAt = o && typeof o.renewsAt === 'number' ? o.renewsAt : null;
        } catch (e) { /* kaputt → wie unbekannt behandeln, nie werfen */ }
    }
    _loadAccessInfo();

    /** Von js/whop-auth.js direkt nach dem /api/whop-access-Aufruf zu setzen:
     *    UserPlan.setAccessInfo(accJson.status, accJson.renews_at);
     *  Ohne diesen Aufruf verhält sich die App wie vorher — isTrialActive() bleibt false, es wird
     *  kein Hinweis gezeigt. Das ist bewusst so: lieber keine Aussage als eine falsche. */
    function setAccessInfo(status, renewsAt) {
        _status   = (typeof status === 'string' && status) ? status : null;
        _renewsAt = (typeof renewsAt === 'number' && renewsAt > 0) ? renewsAt : null;
        try {
            if (_status || _renewsAt) localStorage.setItem(LS_ACCESS, JSON.stringify({ status: _status, renewsAt: _renewsAt }));
            else localStorage.removeItem(LS_ACCESS);
        } catch (e) {}
        _updateUI();
    }
    function clearAccessInfo() {
        _status = null; _renewsAt = null;
        try { localStorage.removeItem(LS_ACCESS); } catch (e) {}
    }

    // ── Laden (wird von AuthUI nach Login aufgerufen) ─────────
    async function load(userId) {
        _plan   = 'pro';
        _loaded = true;
        _loadAccessInfo();
        _updateUI();
    }

    // ── Getter ────────────────────────────────────────────────
    function isPro()          { return true; }
    function isFree()         { return false; }
    function getPlan()        { return _plan; }
    function getStatus()      { return _status; }
    function getRenewsAt()    { return _renewsAt; }
    // Trial = der Server hat ausdrücklich 'trialing' gemeldet. NICHT aus einem fehlenden Status
    // ableiten: unbekannt heißt unbekannt, und ein falscher Trial-Hinweis bei einem zahlenden
    // Kunden wäre schlimmer als kein Hinweis.
    function isTrialActive()  { return _status === 'trialing'; }
    function isTrialExpired() { return false; }
    /** Volle Tage bis zur ersten Abbuchung. null, wenn der Zeitpunkt unbekannt ist — dann zeigt
     *  die UI "Testphase läuft" ohne Zahl, statt eine zu erfinden. 0 = heute fällig. */
    function getTrialDaysLeft() {
        if (!isTrialActive() || !_renewsAt) return null;
        return Math.max(0, Math.ceil((_renewsAt - Date.now()) / 86400000));
    }

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
            '<a href="' + WHOP_URL_YEARLY + '" target="_blank" rel="noopener" ',
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
    function openCheckout()       { location.href = WHOP_URL_MONTHLY; }
    function openCheckoutYearly() { location.href = WHOP_URL_YEARLY; }

    var _public = {
        load, isPro, isFree, getPlan,
        isTrialActive, isTrialExpired, getTrialDaysLeft,
        getStatus, getRenewsAt, setAccessInfo, clearAccessInfo,
        requirePro, getLimit, injectBadge,
        openCheckout, openCheckoutYearly,
        _showUpgradeModal, _showLockModal,
    };
    Object.freeze(_public);
    return _public;
})();
