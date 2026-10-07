/* Diagrammdarstellung und tabellarische Alternative, ohne Änderungen an den Datenreihen. */
(function () {
    'use strict';
    if (typeof Statistiken === 'undefined') return;
    const create = Statistiken._createChart;
    function tokens() {
        const style = getComputedStyle(document.documentElement);
        return {
            text: style.getPropertyValue('--text').trim(),
            muted: style.getPropertyValue('--muted').trim(),
            line: style.getPropertyValue('--line').trim(),
            control: style.getPropertyValue('--control').trim()
        };
    }
    Statistiken._getThemeColors = function () {
        const palette = tokens();
        return { textColor: palette.muted, gridColor: palette.line };
    };
    Statistiken._createChart = function (id, config) {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const palette = tokens();
        const shades = [palette.text, palette.control, palette.muted];
        config.options = config.options || {};
        config.options.animation = false;
        (config.data.datasets || []).forEach(function (dataset, index) {
            dataset.backgroundColor = config.type === 'doughnut' || config.type === 'pie'
                ? (config.data.labels || []).map(function (_, i) { return shades[i % shades.length]; })
                : shades[index % shades.length];
            dataset.borderColor = palette.text;
            dataset.borderDash = index % 2 ? [6, 4] : [];
            dataset.borderWidth = 1;
        });
        create.call(this, id, config);
        const heading = canvas.closest('.card')?.querySelector('.card-title')?.textContent || 'Auswertung';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', heading + '. Die Werte sind unter Diagrammdaten verfügbar.');
        const old = document.getElementById(id + '-data');
        if (old) old.remove();
        const details = document.createElement('details');
        details.id = id + '-data';
        details.className = 'redesign-chart-data';
        const summary = document.createElement('summary');
        summary.textContent = 'Diagrammdaten';
        details.appendChild(summary);
        const region = document.createElement('div');
        region.className = 'table-container';
        region.tabIndex = 0;
        region.setAttribute('role', 'region');
        region.setAttribute('aria-label', heading + ' als Tabelle');
        const table = document.createElement('table');
        const caption = table.createCaption();
        caption.textContent = heading;
        const header = table.createTHead().insertRow();
        ['Bezeichnung'].concat((config.data.datasets || []).map(function (d) { return d.label || heading; })).forEach(function (label) {
            const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; header.appendChild(th);
        });
        const body = table.createTBody();
        (config.data.labels || []).forEach(function (label, index) {
            const row = body.insertRow();
            row.insertCell().textContent = Array.isArray(label) ? label.join(' ') : label;
            (config.data.datasets || []).forEach(function (dataset) {
                const value = dataset.data[index];
                row.insertCell().textContent = typeof value === 'number' ? value.toLocaleString('de-DE', { maximumFractionDigits: 4 }) : String(value ?? '—');
            });
        });
        region.appendChild(table); details.appendChild(region);
        canvas.parentElement.insertAdjacentElement('afterend', details);
    };
    window.addEventListener('themechange', function () {
        if (typeof App !== 'undefined' && App.currentPage === 'statistiken' && document.getElementById('statPeriod')) Statistiken._renderCharts();
    });
})();
