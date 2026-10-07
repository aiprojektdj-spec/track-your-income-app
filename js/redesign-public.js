// Öffentliche Navigation und Angebotswahl; Anmeldung bleibt im bestehenden Whop-Gate.
(function () {
    'use strict';

    var menu = document.querySelector('[data-menu-toggle]');
    var nav = document.getElementById('navigation');
    if (menu && nav) {
        function closeMenu(returnFocus) {
            nav.classList.remove('is-open');
            menu.setAttribute('aria-expanded', 'false');
            menu.textContent = 'Menü';
            if (returnFocus) menu.focus();
        }
        menu.addEventListener('click', function () {
            var opened = menu.getAttribute('aria-expanded') !== 'true';
            nav.classList.toggle('is-open', opened);
            menu.setAttribute('aria-expanded', String(opened));
            menu.textContent = opened ? 'Schließen' : 'Menü';
        });
        nav.addEventListener('click', function (event) {
            if (event.target.closest('a')) closeMenu(false);
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
                closeMenu(true);
            }
        });
        var desktop = window.matchMedia('(min-width: 601px)');
        var resetMenu = function () { closeMenu(false); };
        if (desktop.addEventListener) desktop.addEventListener('change', resetMenu);
        else if (desktop.addListener) desktop.addListener(resetMenu);
    }

    var checkout = document.querySelector('[data-checkout]');
    var billingNote = document.querySelector('[data-billing-note]');
    var choices = document.querySelectorAll('[data-period]');
    choices.forEach(function (button) {
        button.addEventListener('click', function () {
            var yearly = button.dataset.period === 'year';
            choices.forEach(function (choice) {
                choice.setAttribute('aria-pressed', String(choice === button));
            });
            if (checkout) {
                checkout.href = yearly
                    ? 'https://whop.com/checkout/plan_b5IBQ1lecggOT'
                    : 'https://whop.com/checkout/plan_iR6YIKLcychSZ';
                checkout.textContent = yearly ? 'Jahresangebot ansehen' : 'Monatsangebot ansehen';
            }
            if (billingNote) billingNote.textContent = yearly
                ? 'Jährliche Abrechnung. Preis und Vertragsbedingungen stehen im Whop-Angebot.'
                : 'Monatliche Abrechnung. Preis und Vertragsbedingungen stehen im Whop-Angebot.';
        });
    });
})();
