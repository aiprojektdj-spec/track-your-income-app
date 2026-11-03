// Stackr Admin — Audit-Log-Ansicht und Aktivitaets-Zeitleiste eines Mitglieds
(function () {
    'use strict';
    var A = window.Admin, $ = A.$;
    var lastId = null;

    function cell(tr, text) { var td = document.createElement('td'); td.textContent = text; tr.appendChild(td); return td; }

    function diffCell(tr, r) {
        var td = cell(tr, '');
        if (r.before != null || r.after != null) {
            var pre = document.createElement('pre');
            pre.textContent = JSON.stringify({ vorher: r.before, nachher: r.after }, null, 1);
            td.appendChild(pre);
        }
    }

    // Zeitleiste eines Mitglieds: alle Aktionen mit target = member/<id>
    A.renderActivity = function (tbody, emptyEl, rows) {
        tbody.textContent = '';
        rows.forEach(function (r) {
            var tr = document.createElement('tr');
            cell(tr, A.fmt(r.ts)); cell(tr, r.admin_email); cell(tr, r.action); diffCell(tr, r);
            tbody.appendChild(tr);
        });
        emptyEl.hidden = rows.length > 0;
    };

    function renderRows(rows, append) {
        var tb = $('audit-rows');
        if (!append) tb.textContent = '';
        rows.forEach(function (r) {
            var tr = document.createElement('tr');
            cell(tr, A.fmt(r.ts));
            cell(tr, r.admin_email);
            cell(tr, r.action);
            cell(tr, r.target_type ? r.target_type + ' ' + r.target_id : '');
            diffCell(tr, r);
            cell(tr, r.ip);
            tb.appendChild(tr);
        });
        $('audit-empty').hidden = tb.children.length > 0;
        $('audit-more').hidden = rows.length < 50;
        if (rows.length) lastId = rows[rows.length - 1].id;
    }

    async function load(append) {
        var p = new URLSearchParams();
        new FormData($('audit-filter')).forEach(function (v, k) {
            if (!v) return;
            // "Bis" gilt inklusive: bis zum Beginn des Folgetags
            if (k === 'to') { var d = new Date(v); d.setDate(d.getDate() + 1); v = d.toISOString(); }
            if (k === 'from') v = new Date(v).toISOString();
            p.set(k, v);
        });
        if (append && lastId) p.set('beforeId', lastId);
        try { renderRows((await A.api('/api/audit?' + p)).rows, append); }
        catch (e) { if (e.status !== 401) A.toast('Audit-Log konnte nicht geladen werden.'); }
    }

    $('audit-filter').addEventListener('submit', function (ev) { ev.preventDefault(); lastId = null; load(false); });
    $('audit-more').addEventListener('click', function () { load(true); });

    A.views.audit = { show: function () { lastId = null; load(false); } };
})();
