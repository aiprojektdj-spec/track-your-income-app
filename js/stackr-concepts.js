// Vorschau-Steuerung: keine Verbindung zu Buchhaltungsdaten oder Anmeldung.
document.querySelectorAll('[data-menu-toggle]').forEach(function (button) {
    var navigation = document.getElementById(button.getAttribute('aria-controls'));
    button.addEventListener('click', function () {
        var open = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-label', open ? 'Navigation schließen' : 'Navigation öffnen');
        navigation.classList.toggle('is-open', open);
    });
    navigation.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
            button.setAttribute('aria-expanded', 'false');
            button.setAttribute('aria-label', 'Navigation öffnen');
            navigation.classList.remove('is-open');
        });
    });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
            button.setAttribute('aria-expanded', 'false');
            button.setAttribute('aria-label', 'Navigation öffnen');
            navigation.classList.remove('is-open');
            button.focus();
        }
    });
});

document.querySelectorAll('[data-billing]').forEach(function (group) {
    group.querySelectorAll('button').forEach(function (button) {
        button.addEventListener('click', function () {
            var yearly = button.dataset.period === 'year';
            var section = group.closest('.pricing-section');
            group.querySelectorAll('button').forEach(function (item) {
                item.setAttribute('aria-pressed', String(item === button));
            });
            section.querySelector('[data-price]').textContent = yearly ? '11,25' : '15';
            section.querySelector('[data-billing-note]').textContent = yearly
                ? '135 € jährlich abgerechnet · 25 % günstiger als monatlich'
                : '15 € monatlich abgerechnet · monatlich kündbar';
            section.querySelector('[data-checkout]').href = yearly
                ? 'https://whop.com/checkout/plan_b5IBQ1lecggOT'
                : 'https://whop.com/checkout/plan_iR6YIKLcychSZ';
        });
    });
});
