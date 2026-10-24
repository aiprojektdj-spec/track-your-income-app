// Öffentliche Landingpage: Navigation, Abrechnung und bestehender App-Einstieg.
// Die Produktbeispiele und die Klick-Demo sind statisches HTML; App-Speicher werden nicht geladen.
(function () {
    'use strict';
    var root = document.querySelector('body.landing');
    if (!root) return;
    var appUrl = 'app.html';
    var header = root.querySelector('.header');
    var menu = root.querySelector('.menu-toggle');
    var navigation = root.querySelector('#navigation');
    var billing = root.querySelector('.billing-toggle');
    var checkout = root.querySelector('[data-checkout]');
    var sessionLinks = root.querySelectorAll('[data-session-link]');
    var selectedPeriod = 'month';
    var hasSession = false;
    var plans = {
        month: { price: '15', note: '15 € monatlich abgerechnet', renewal: 'Ohne Kündigung vor Ende der Testphase folgen 15 € monatlich (Endpreis, keine USt nach § 19 UStG). Das Abo verlängert sich automatisch um einen Monat.', url: 'https://whop.com/checkout/plan_iR6YIKLcychSZ' },
        year: { price: '11,25', note: '135 € jährlich abgerechnet', renewal: 'Ohne Kündigung vor Ende der Testphase folgen 135 € jährlich (Endpreis, keine USt nach § 19 UStG). Das Abo verlängert sich automatisch um ein Jahr.', url: 'https://whop.com/checkout/plan_CKs4MKzXmOz1E' }
    };

    function setMenu(open) {
        menu.setAttribute('aria-expanded', String(open));
        menu.setAttribute('aria-label', open ? 'Navigation schließen' : 'Navigation öffnen');
        navigation.classList.toggle('is-open', open);
    }
    header.classList.add('js-menu');
    menu.hidden = false;
    menu.addEventListener('click', function () { setMenu(menu.getAttribute('aria-expanded') !== 'true'); });
    navigation.addEventListener('click', function (event) {
        if (!event.target.closest('a')) return;
        // Der Fokus darf nach Schließen nicht in einer unsichtbaren Navigation bleiben.
        var href = event.target.closest('a').getAttribute('href');
        if (href.charAt(0) === '#') {
            var target = root.querySelector(href);
            if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
        }
        setMenu(false);
    });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
            setMenu(false);
            menu.focus();
        }
    });
    header.addEventListener('focusout', function (event) {
        if (event.relatedTarget && !header.contains(event.relatedTarget)) setMenu(false);
    });
    document.addEventListener('click', function (event) {
        if (!header.contains(event.target)) setMenu(false);
    });
    var mobile = window.matchMedia('(max-width: 540px)');
    mobile.addEventListener('change', function () { setMenu(false); });

    function renderBilling() {
        var plan = plans[selectedPeriod];
        billing.querySelectorAll('button').forEach(function (button) {
            button.setAttribute('aria-pressed', String(button.dataset.period === selectedPeriod));
        });
        root.querySelector('[data-price]').textContent = plan.price;
        root.querySelector('[data-billing-note]').textContent = plan.note;
        root.querySelector('[data-renewal]').textContent = plan.renewal;
        checkout.href = hasSession ? appUrl : plan.url;
        checkout.textContent = hasSession ? 'Zur App' : '7 Tage kostenlos testen';
    }
    billing.hidden = false;
    billing.querySelectorAll('button').forEach(function (button) {
        button.addEventListener('click', function () {
            if (!plans[button.dataset.period]) return;
            selectedPeriod = button.dataset.period;
            renderBilling();
        });
    });

    function updateSession() {
        // Nur den vorhandenen Landing-Hinweis erhalten. Die App prüft Token und Abo.
        try { hasSession = Boolean(localStorage.getItem('whop_access_token')); }
        catch (error) { hasSession = false; }
        sessionLinks.forEach(function (link) {
            link.href = hasSession ? appUrl : (link === checkout ? plans[selectedPeriod].url : '#preise');
            link.textContent = hasSession ? 'Zur App' : '7 Tage kostenlos testen';
            if (hasSession) link.dataset.session = '1';
            else delete link.dataset.session;
        });
        root.querySelector('[data-login]').textContent = hasSession ? 'Zur App' : 'Anmelden';
        renderBilling();
    }
    updateSession();
    window.addEventListener('pageshow', updateSession);
    window.addEventListener('storage', function (event) {
        if (event.key === 'whop_access_token' || event.key === null) updateSession();
    });
    // Klick-Demo im Hero: Reiter, Buchungsfilter und Rechnungsauswahl. Nur Beispieldaten.
    var tabs = Array.prototype.slice.call(root.querySelectorAll('.ad-tabs [role=tab]'));
    function selectTab(tab, focus) {
        tabs.forEach(function (t) {
            var active = t === tab;
            t.setAttribute('aria-selected', String(active));
            t.tabIndex = active ? 0 : -1;
            root.querySelector('#' + t.getAttribute('aria-controls')).hidden = !active;
        });
        if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
        tab.addEventListener('click', function () { selectTab(tab, false); });
        tab.addEventListener('keydown', function (event) {
            var next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[event.key];
            if (next === undefined) return;
            event.preventDefault();
            selectTab(tabs[(next + tabs.length) % tabs.length], true);
        });
    });
    root.querySelectorAll('.ad-filter button').forEach(function (button, _, all) {
        button.addEventListener('click', function () {
            all.forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
            root.querySelectorAll('#ad-buchungen tbody tr').forEach(function (row) {
                row.hidden = button.dataset.filter !== 'alle' && row.dataset.typ !== button.dataset.filter;
            });
        });
    });
    var invoices = [
        { nr: 'RE-2026-021', datum: '20.10.2026', kunde: 'Kleiderkreis e. V.', pos: 'Vintage-Konvolut, 40 Teile à 8,00 €', betrag: '320,00 €' },
        { nr: 'RE-2026-020', datum: '17.10.2026', kunde: 'Lisa Martens', pos: 'Carhartt Detroit Jacket', betrag: '89,00 €' },
        { nr: 'RE-2026-019', datum: '11.10.2026', kunde: 'Atelier Brandt', pos: 'Seidenschals, 3 Stück à 45,00 €', betrag: '135,00 €' },
        { nr: 'RE-2026-018', datum: '06.10.2026', kunde: 'Retro Store Leipzig', pos: "Levi's 501, 5 Stück à 48,00 €", betrag: '240,00 €' }
    ];
    root.querySelectorAll('.ad-invoices button').forEach(function (button, _, all) {
        button.addEventListener('click', function () {
            var inv = invoices[button.dataset.invoice];
            all.forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
            root.querySelectorAll('[data-inv]').forEach(function (el) {
                var key = el.dataset.inv;
                el.textContent = key === 'summe' ? inv.betrag : inv[key];
            });
        });
    });

    root.querySelector('[data-consent-settings]').addEventListener('click', function (event) {
        if (!window.CookieBanner) return;
        event.preventDefault();
        window.CookieBanner.reset();
    });
})();
