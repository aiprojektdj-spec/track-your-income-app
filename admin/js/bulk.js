// Stackr Admin — Bulk-Aktionen (Trockenlauf, getippte Bestaetigung, Schritte mit Fortschritt) und CSV-Export
(function () {
    'use strict';
    var A = window.Admin, $ = A.$, el = A.el;
    var WORT = { 'tag.add': 'TAGGEN', 'suspend': 'SPERREN' };
    var state = null;   // { op, param, filter, anzahl }

    function filter() {
        var f = $('members-filter').elements;
        return { q: f.q.value.trim(), status: f.status.value, tag: f.tag.value,
                 suspended: f.suspended.value === '1' ? 'true' : f.suspended.value === '0' ? 'false' : '' };
    }

    function reset() {
        state = null;
        $('bulk-preview').hidden = true;
        $('bulk-confirm').value = '';
        $('bulk-run').disabled = true;
        $('bulk-progress').hidden = true;
        $('bulk-result').textContent = '';
        $('bulk-errors').textContent = '';
    }

    var ERR = { zu_viele: 'Zu viele Mitglieder (max. 500) – Filter enger setzen.', leer: 'Kein Mitglied passt zum Filter.',
                anzahl_geaendert: 'Die Anzahl hat sich seit dem Trockenlauf geaendert – bitte neu pruefen.',
                bestaetigung_falsch: 'Bestaetigung stimmt nicht.', tag_ungueltig: 'Tag ungueltig.', grund_ungueltig: 'Grund fehlt (3 bis 300 Zeichen).',
                recht_fehlt: 'Dir fehlt das Recht dafuer.' };

    $('bulk-form').addEventListener('submit', async function (ev) {
        ev.preventDefault();
        reset();
        var f = ev.target.elements, op = f.op.value, param = f.param.value.trim();
        try {
            var p = await A.api('/api/bulk', { body: { action: 'preview', filter: filter() } });
            state = { op: op, param: param, filter: filter(), anzahl: p.anzahl };
            $('bulk-count').textContent = p.anzahl + ' Mitglieder betroffen' + (p.anzahl > p.max ? ' – ueber dem Limit von ' + p.max + ', Filter enger setzen.' : '. Beispiele (10):');
            var ul = $('bulk-sample');
            ul.textContent = '';
            p.beispiele.forEach(function (m) { ul.appendChild(el('li', { text: (m.name || m.whop_user_id) + ' · ' + m.email + ' · ' + m.status })); });
            $('bulk-expect').textContent = WORT[op] + ' ' + p.anzahl;
            $('bulk-preview').hidden = false;
        } catch (e) { if (e.status !== 401) A.toast(ERR[e.message] || 'Trockenlauf fehlgeschlagen.'); }
    });

    $('bulk-confirm').addEventListener('input', function () {
        $('bulk-run').disabled = !(state && state.anzahl > 0 && state.anzahl <= 500 && this.value.trim() === $('bulk-expect').textContent);
    });

    $('bulk-run').addEventListener('click', async function () {
        if (!state) return;
        var b = $('bulk-run');
        b.disabled = true; $('bulk-confirm').disabled = true;
        var prog = $('bulk-progress');
        try {
            var s = await A.api('/api/bulk', { body: { action: 'start', op: state.op, param: state.param, filter: state.filter,
                                                        expect: state.anzahl, confirm: $('bulk-confirm').value.trim() } });
            prog.hidden = false; prog.max = s.total; prog.value = 0;
            var out;
            do {
                out = await A.api('/api/bulk', { body: { action: 'step', runId: s.run_id } });
                prog.value = out.lauf.done;
                $('bulk-result').textContent = out.lauf.done + ' von ' + out.lauf.total + ' verarbeitet, ' + out.lauf.failed + ' Fehler';
            } while (out.lauf.status !== 'fertig');
            var ul = $('bulk-errors');
            ul.textContent = '';
            out.fehler.forEach(function (x) { ul.appendChild(el('li', { text: x.whop_user_id + ': ' + x.message })); });
            A.toast('Bulk-Aktion abgeschlossen.');
            if (A.views.members) A.views.members.show();
        } catch (e) {
            if (e.status !== 401) A.toast(ERR[e.message] || 'Bulk-Aktion abgebrochen – Stand im Audit-Log.');
        } finally { $('bulk-confirm').disabled = false; $('bulk-confirm').value = ''; }
    });

    ['q', 'status', 'tag', 'suspended'].forEach(function (n) {
        $('members-filter').elements[n].addEventListener('change', reset);
    });

    // ── Export ────────────────────────────────────────────────────────────────────
    async function exportCsv(path, name) {
        try { await A.download(path, name); A.toast('Export erstellt (im Audit-Log vermerkt).'); }
        catch (e) { if (e.status !== 401) A.toast(e.message === 'recht_fehlt' ? 'Dir fehlt das Recht dafuer.' : 'Export fehlgeschlagen.'); }
    }
    $('btn-export-members').addEventListener('click', function () {
        var p = new URLSearchParams({ kind: 'members' });
        new FormData($('members-filter')).forEach(function (v, k) { if (v) p.set(k, v); });
        if ($('export-reveal').checked) p.set('reveal', '1');
        exportCsv('/api/export?' + p, 'stackr-members.csv');
    });
    $('btn-export-payments').addEventListener('click', function () { exportCsv('/api/export?kind=payments', 'stackr-payments.csv'); });
    $('btn-export-audit').addEventListener('click', function () {
        var p = new URLSearchParams({ kind: 'audit' });
        new FormData($('audit-filter')).forEach(function (v, k) {
            if (!v) return;
            if (k === 'to') { var d = new Date(v); d.setDate(d.getDate() + 1); v = d.toISOString(); }
            if (k === 'from') v = new Date(v).toISOString();
            p.set(k, v);
        });
        exportCsv('/api/export?' + p, 'stackr-audit.csv');
    });

    // Bulk-Bereich und Klartext-Haken nur mit passenden Rechten zeigen
    var zeigen = A.views.members.show;
    A.views.members.show = function () {
        $('bulk').hidden = !A.can('bulk.run');
        $('export-reveal-wrap').hidden = !A.can('users.reveal_pii');
        zeigen.apply(this, arguments);
    };
})();
