// Stackr Admin — Feature-Flags: Liste, Anlegen/Bearbeiten, Notaus
(function () {
    'use strict';
    var A = window.Admin, $ = A.$, el = A.el;
    var STATUS_DE = { off: 'aus', rules: 'nach Regeln', on: 'an' };
    var flags = [];

    function regeln(f) {
        if (f.status !== 'rules') return '–';
        var t = [];
        if (f.percent) t.push(f.percent + ' %');
        if (f.user_ids.length) t.push(f.user_ids.length + ' Nutzer');
        if (f.account_ids.length) t.push(f.account_ids.length + ' Konten');
        if (f.plan_ids.length) t.push(f.plan_ids.length + ' Plaene');
        return t.join(', ') || 'keine Regel – fuer niemanden an';
    }

    function render() {
        var tb = $('flags-rows');
        tb.textContent = '';
        flags.forEach(function (f) {
            var tr = el('tr', { class: f.killed ? 'susp' : '' });
            tr.appendChild(el('td', {}, [el('strong', { text: f.key }), el('br'), el('small', { text: f.description })]));
            tr.appendChild(el('td', { text: STATUS_DE[f.status] }));
            tr.appendChild(el('td', { text: regeln(f) }));
            tr.appendChild(el('td', { text: f.killed ? 'AUS (Notaus)' : '' }));
            var td = el('td');
            if (A.can('flags.edit')) {
                var ed = el('button', { type: 'button', class: 'ghost', text: 'Bearbeiten' });
                ed.addEventListener('click', function () { fill(f); });
                var kill = el('button', { type: 'button', class: f.killed ? '' : 'danger', text: f.killed ? 'Notaus aufheben' : 'Notaus' });
                kill.addEventListener('click', function () { setKill(f, !f.killed); });
                td.appendChild(ed); td.appendChild(document.createTextNode(' ')); td.appendChild(kill);
            }
            tr.appendChild(td);
            tb.appendChild(tr);
        });
        $('flags-empty').hidden = flags.length > 0;
        $('flag-form').hidden = !A.can('flags.edit');
    }

    function fill(f) {
        var e = $('flag-form').elements;
        e.key.value = f.key; e.key.readOnly = true;
        e.description.value = f.description; e.status.value = f.status; e.percent.value = f.percent;
        e.user_ids.value = f.user_ids.join(' '); e.account_ids.value = f.account_ids.join(' '); e.plan_ids.value = f.plan_ids.join(' ');
        $('flag-form-title').textContent = 'Flag bearbeiten: ' + f.key;
        $('flag-form').scrollIntoView();
    }

    async function load() {
        try { flags = (await A.api('/api/flags')).flags; render(); }
        catch (e) { if (e.status !== 401) A.toast('Flags konnten nicht geladen werden.'); }
    }

    async function setKill(f, killed) {
        try { await A.api('/api/flags', { body: { action: 'kill', key: f.key, killed: killed } }); A.toast(killed ? 'Notaus gesetzt.' : 'Notaus aufgehoben.'); load(); }
        catch (e) { if (e.status !== 401) A.toast('Aktion fehlgeschlagen.'); }
    }

    var ERR = { key_ungueltig: 'Key ungueltig (klein, a-z 0-9 . _ -, 2 bis 63 Zeichen).', prozent_ungueltig: 'Prozent 0 bis 100.',
                liste_ungueltig: 'Eine ID in den Listen ist ungueltig.', liste_zu_lang: 'Zu viele Eintraege in einer Liste.' };

    $('flag-form').addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var e = ev.target.elements;
        try {
            await A.api('/api/flags', { body: { action: 'save', key: e.key.value.trim(), description: e.description.value, status: e.status.value,
                percent: e.percent.value, user_ids: e.user_ids.value, account_ids: e.account_ids.value, plan_ids: e.plan_ids.value } });
            A.toast('Flag gespeichert.');
            ev.target.reset(); e.key.readOnly = false;
            $('flag-form-title').textContent = 'Flag anlegen';
            load();
        } catch (er) { if (er.status !== 401) A.toast(ERR[er.message] || 'Speichern fehlgeschlagen.'); }
    });

    A.views.flags = { show: load };
})();
