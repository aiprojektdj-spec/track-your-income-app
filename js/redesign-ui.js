/* Ergänzt Darstellung und Semantik; schreibt keine Buchhaltungsdaten. */
(function () {
    'use strict';
    let nextId = 0;
    let scheduled = false;

    function enhance(root) {
        ['#content', '#modal'].forEach(function (selector) {
            const scope = root.querySelector(selector);
            if (!scope) return;
            const candidates = Array.from(scope.querySelectorAll('.btn-primary, .btn-success, .btn-danger, .btn-warning'));
            const visible = candidates.filter(function (button) { return button.getClientRects().length && !button.closest('[hidden]'); });
            const primary = visible.find(function (button) { return button.closest('.page-header'); }) || visible[0];
            candidates.forEach(function (button) { button.classList.toggle('sr-secondary-action', button !== primary); });
        });
        root.querySelectorAll('button, .tab, .page-header h2, .modal-header h3, .form-label, .card-title').forEach(function (element) {
            Array.from(element.childNodes).forEach(function (node) {
                if (node.nodeType !== Node.TEXT_NODE) return;
                const plain = node.textContent.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/[→↗]/g, '');
                if (plain !== node.textContent) node.textContent = plain;
            });
        });
        root.querySelectorAll('i.ti, svg:not([role]):not([aria-label])').forEach(function (icon) {
            icon.setAttribute('aria-hidden', 'true');
        });
        root.querySelectorAll('.form-group, .filter-group').forEach(function (group) {
            const label = group.querySelector('label');
            const fields = group.querySelectorAll('input:not([type="hidden"]), select, textarea');
            if (!label || fields.length !== 1) return;
            const field = fields[0];
            if (!field.id) field.id = 'sr-field-' + (++nextId);
            if (!label.htmlFor) label.htmlFor = field.id;
            const hint = group.querySelector('.form-hint');
            if (hint && !field.hasAttribute('aria-describedby')) {
                if (!hint.id) hint.id = 'sr-hint-' + (++nextId);
                field.setAttribute('aria-describedby', hint.id);
            }
        });
        root.querySelectorAll('table').forEach(function (table) {
            const header = table.tHead && table.tHead.rows[0];
            if (!header) return;
            const headers = Array.from(header.cells);
            headers.forEach(function (cell) { if (!cell.hasAttribute('scope')) cell.scope = 'col'; });
            // Nur einfache Datensatzlisten umbrechen. Formular-/Vergleichstabellen bleiben Tabellen.
            const plain = !table.closest('.academy-lesson-content') &&
                headers.length >= 3 && headers.length <= 8 && table.tHead.rows.length === 1 &&
                !table.querySelector('tbody input:not([type="checkbox"]), tbody select, tbody textarea, [rowspan]');
            if (plain) {
                table.classList.add('sr-mobile-table');
                Array.from(table.tBodies).forEach(function (body) {
                    Array.from(body.rows).forEach(function (row) {
                        Array.from(row.cells).forEach(function (cell, i) {
                            if (cell.colSpan === 1 && headers[i]) cell.dataset.label = headers[i].textContent.trim();
                        });
                    });
                });
            }
            const region = table.closest('.table-container');
            if (region && !plain) {
                region.tabIndex = 0;
                region.setAttribute('role', 'region');
                if (!region.hasAttribute('aria-label')) region.setAttribute('aria-label', 'Datentabelle, horizontal scrollbar');
            }
        });
        root.querySelectorAll('.ust-card[data-action], .tab[data-tab]').forEach(function (card) {
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-pressed', String(card.classList.contains('selected') || card.classList.contains('active')));
        });
        root.querySelectorAll('.skeleton-card, .skeleton-line').forEach(function (item) {
            item.setAttribute('aria-hidden', 'true');
        });
        const content = document.getElementById('content');
        if (content) content.setAttribute('aria-busy', String(!!content.querySelector('.skeleton-card')));
        // Beschriftung vorhandener kompakter Auswahlen, ohne Placeholder als Label zu erfinden.
        const years = root.querySelectorAll('#yearSelect');
        years.forEach(function (select) { select.setAttribute('aria-label', 'Geschäftsjahr'); });
    }

    function nativeDialog() {
        const overlay = document.getElementById('modalOverlay');
        if (!overlay || overlay.tagName !== 'DIALOG') return;
        let trigger = null;
        const update = function () {
            const active = overlay.classList.contains('active');
            if (active && !overlay.open) {
                trigger = document.activeElement;
                overlay.showModal();
                const inner = document.getElementById('modal');
                if (inner) { inner.removeAttribute('role'); inner.removeAttribute('aria-modal'); }
                const title = document.getElementById('modalTitle');
                if (title) overlay.setAttribute('aria-labelledby', 'modalTitle');
                else overlay.setAttribute('aria-label', 'Dialog');
            } else if (!active && overlay.open) {
                overlay.close();
                if (trigger && trigger.isConnected && !overlay.contains(trigger)) trigger.focus();
            }
        };
        new MutationObserver(update).observe(overlay, { attributes: true, attributeFilter: ['class'] });
        // Vorhandene Close-Handler behalten Aufräumfunktionen und Fokus-Rückgabe.
        overlay.addEventListener('cancel', function (event) {
            event.preventDefault();
            const close = overlay.querySelector('.modal-close, #modalCloseBtn, [data-action="eb-close"], [data-action="close-modal"], [data-action="rech-close-modal"]');
            if (close) close.click();
            else overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        update();
    }

    function init() {
        nativeDialog();
        enhance(document);
        const targets = ['content', 'modal', 'onboarding', 'companySwitcher'];
        const observer = new MutationObserver(function () {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(function () { scheduled = false; enhance(document); });
        });
        targets.forEach(function (id) {
            const el = document.getElementById(id);
            if (el) observer.observe(el, { childList: true, subtree: true });
        });
        document.addEventListener('keydown', function (event) {
            if ((event.key === ' ' || event.key === 'Enter') && event.target.matches('.ust-card[data-action], .tab[data-tab]')) {
                event.preventDefault(); event.target.click();
                enhance(document);
            }
        });
        document.addEventListener('click', function (event) {
            if (event.target.closest('.ust-card[data-action], .tab[data-tab]')) requestAnimationFrame(function () { enhance(document); });
        });
        document.addEventListener('toggle', function (event) {
            if (event.target.tagName === 'DETAILS') requestAnimationFrame(function () { enhance(document); });
        }, true);
        document.addEventListener('invalid', function (event) {
            const field = event.target;
            if (!field.id) field.id = 'sr-field-' + (++nextId);
            field.setAttribute('aria-invalid', 'true');
            let error = document.getElementById(field.id + '-error');
            if (!error) {
                error = document.createElement('p');
                error.id = field.id + '-error';
                error.className = 'field-error';
                error.setAttribute('role', 'alert');
                field.insertAdjacentElement('afterend', error);
                field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '));
            }
            error.textContent = field.validationMessage;
        }, true);
        document.addEventListener('input', function (event) {
            const field = event.target;
            if (field.getAttribute('aria-invalid') === 'true' && field.validity && field.validity.valid) {
                field.removeAttribute('aria-invalid');
                const error = document.getElementById(field.id + '-error');
                if (error) error.remove();
                const refs = (field.getAttribute('aria-describedby') || '').split(' ').filter(function (id) { return id !== field.id + '-error'; });
                if (refs.length) field.setAttribute('aria-describedby', refs.join(' ')); else field.removeAttribute('aria-describedby');
            }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
