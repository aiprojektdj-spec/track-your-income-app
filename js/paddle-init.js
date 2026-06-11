/**
 * paddle-init.js — Lazy Paddle.js loader
 *
 * Paddle.js is ~120KB and only needed when the user clicks "Upgrade".
 * This module loads it on-demand so it doesn't block initial page load.
 *
 * Usage (from user-plan.js or any upgrade button):
 *   PaddleLoader.load().then(function() { Paddle.Checkout.open({...}); });
 *   // or with async/await:
 *   await PaddleLoader.load();
 *   Paddle.Checkout.open({...});
 */
var PaddleLoader = (function() {
    'use strict';

    // ── Config ──────────────────────────────────────────────────────────────
    var PADDLE_VENDOR_ID = null; // set if using Paddle Classic; null for Paddle Billing
    var PADDLE_ENV       = 'production'; // 'sandbox' | 'production'
    // ────────────────────────────────────────────────────────────────────────

    var _loaded   = false;
    var _loading  = false;
    var _promise  = null;

    /**
     * Load Paddle.js and initialize it.
     * Returns a Promise that resolves when Paddle is ready.
     * Multiple calls share the same Promise (idempotent).
     */
    function load() {
        if (_loaded) return Promise.resolve();
        if (_loading) return _promise;

        _loading = true;
        _promise = new Promise(function(resolve, reject) {
            var script = document.createElement('script');
            script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
            script.async = true;

            script.onload = function() {
                try {
                    if (typeof Paddle === 'undefined') {
                        throw new Error('Paddle global not found after script load');
                    }

                    // Sandbox mode for testing
                    if (PADDLE_ENV === 'sandbox') {
                        Paddle.Environment.set('sandbox');
                    }

                    // Initialize — token injected by user-plan.js or app config
                    var token = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.paddleToken)
                        ? APP_CONFIG.paddleToken
                        : null;

                    if (token) {
                        Paddle.Initialize({ token: token });
                    }

                    _loaded  = true;
                    _loading = false;
                    resolve();
                } catch(e) {
                    _loading = false;
                    reject(e);
                }
            };

            script.onerror = function() {
                _loading = false;
                reject(new Error('Failed to load Paddle.js'));
            };

            document.head.appendChild(script);
        });

        return _promise;
    }

    /** True once Paddle.js is loaded and initialized */
    function isReady() { return _loaded; }

    return { load: load, isReady: isReady };

})();
