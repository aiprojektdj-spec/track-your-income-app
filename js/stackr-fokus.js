// Interaktive Produktansichten mit festen Beispieldaten.
document.querySelectorAll('[data-product-tabs]').forEach(function (tabs) {
    var buttons = Array.from(tabs.querySelectorAll('[role="tab"]'));
    function activate(button) {
        buttons.forEach(function (item) {
            var active = item === button;
            item.setAttribute('aria-selected', String(active));
            item.tabIndex = active ? 0 : -1;
            document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
        });
    }
    buttons.forEach(function (button, index) {
        button.addEventListener('click', function () { activate(button); });
        button.addEventListener('keydown', function (event) {
            var next;
            if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
            if (event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = buttons.length - 1;
            if (next === undefined) return;
            event.preventDefault();
            activate(buttons[next]);
            buttons[next].focus();
        });
    });
});
