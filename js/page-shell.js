// Eine gemeinsame Shell für Haupt-App, Rechnungen, Lager und Eigenbelege.
// Kein zweiter Toggle-Handler und keine abweichende mobile Navigation.
(function () {
    'use strict';
    function init() {
        if (window.RedesignShell) window.RedesignShell.init();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
