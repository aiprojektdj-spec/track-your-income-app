// ============================================
// Theme — System / Hell / Dunkel
//
// MUSS synchron im <head> stehen, VOR dem ersten Stylesheet-Paint. Laedt man
// das Modul defer oder am Body-Ende, blitzt beim Laden kurz die dunkle Palette
// auf, bevor umgeschaltet wird.
//
// Vertrag mit css/style.css: dieses Modul setzt IMMER ein explizites
// data-theme="light" oder data-theme="dark" auf <html>. Deshalb braucht die CSS
// nur EINEN hellen Token-Block (:root[data-theme="light"]) und keine zweite
// Kopie in einer @media-(prefers-color-scheme)-Abfrage. Die gespeicherte Wahl
// ('system') wird hier zum konkreten Wert aufgeloest, nicht in der CSS.
//
// Wer die effektive Palette braucht (Charts!), nimmt Theme.isDark() — NICHT
// window.matchMedia('(prefers-color-scheme: dark)'). matchMedia kennt nur die
// Systemeinstellung und liegt falsch, sobald jemand manuell umgeschaltet hat.
// Bei Wechsel feuert auf window das Event 'themechange'.
// ============================================
var Theme = (function () {
    'use strict';

    var LS_KEY = 'oyi_theme';                  // 'system' | 'light' | 'dark'
    var MODES  = ['system', 'light', 'dark'];
    var mql    = window.matchMedia('(prefers-color-scheme: dark)');

    function stored() {
        try {
            var v = localStorage.getItem(LS_KEY);
            return MODES.indexOf(v) >= 0 ? v : 'system';
        } catch (e) {
            return 'system';                    // Private Mode / gesperrter Storage
        }
    }

    function systemIsDark() { return mql.matches; }

    /** Gewaehlter Modus, wie er im Umschalter steht. */
    function get() { return stored(); }

    /** Was tatsaechlich angezeigt wird: 'light' oder 'dark'. */
    function effective() {
        var m = stored();
        if (m === 'system') return systemIsDark() ? 'dark' : 'light';
        return m;
    }

    function isDark() { return effective() === 'dark'; }

    function _apply() {
        var eff = effective();
        var root = document.documentElement;
        root.setAttribute('data-theme', eff);
        // Formularelemente, Scrollbalken und die Browser-eigene Datumsauswahl
        // richten sich hiernach — ohne das bleiben sie in der falschen Palette.
        root.style.colorScheme = eff;
        return eff;
    }

    function set(mode) {
        if (MODES.indexOf(mode) < 0) mode = 'system';
        try { localStorage.setItem(LS_KEY, mode); } catch (e) {}
        var eff = _apply();
        _paintToggles();
        try {
            window.dispatchEvent(new CustomEvent('themechange', {
                detail: { mode: mode, effective: eff }
            }));
        } catch (e) {}
        return eff;
    }

    /** System → Hell → Dunkel → System */
    function cycle() {
        var i = MODES.indexOf(stored());
        return set(MODES[(i + 1) % MODES.length]);
    }

    var LABEL = {
        system: { icon: 'ti-device-desktop', text: 'System' },
        light:  { icon: 'ti-sun',            text: 'Hell'   },
        dark:   { icon: 'ti-moon',           text: 'Dunkel' }
    };

    function _paintToggles() {
        var mode = stored(), l = LABEL[mode];
        var btns = document.querySelectorAll('.theme-toggle');
        Array.prototype.forEach.call(btns, function (b) {
            b.innerHTML = '<i class="ti ' + l.icon + '" aria-hidden="true"></i>';
            // Der Titel nennt den AKTUELLEN Zustand, das aria-label die naechste
            // Aktion — sonst weiss ein Screenreader-Nutzer nicht, was der Klick tut.
            b.title = 'Darstellung: ' + l.text;
            var next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
            b.setAttribute('aria-label', 'Darstellung: ' + l.text + ' — umschalten auf ' + LABEL[next].text);
        });
    }

    /** Bindet alle .theme-toggle-Buttons im Dokument. Mehrfachaufruf ist harmlos. */
    function mount() {
        var btns = document.querySelectorAll('.theme-toggle');
        Array.prototype.forEach.call(btns, function (b) {
            if (b.dataset.themeBound) return;
            b.dataset.themeBound = '1';
            b.style.removeProperty('display');   // alte inline-Ausblendung aufheben
            b.addEventListener('click', function (e) { e.preventDefault(); cycle(); });
        });
        _paintToggles();
    }

    // Systemwechsel bei laufender App nur dann durchreichen, wenn 'system' gewaehlt ist.
    var _onSys = function () {
        if (stored() !== 'system') return;
        var eff = _apply();
        try {
            window.dispatchEvent(new CustomEvent('themechange', {
                detail: { mode: 'system', effective: eff }
            }));
        } catch (e) {}
    };
    if (mql.addEventListener) mql.addEventListener('change', _onSys);
    else if (mql.addListener) mql.addListener(_onSys);          // Safari < 14

    // Sofort anwenden — dieses Skript laeuft im <head>, <body> gibt es noch nicht.
    _apply();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }

    return {
        get: get, set: set, cycle: cycle, mount: mount,
        effective: effective, isDark: isDark, MODES: MODES
    };
})();
