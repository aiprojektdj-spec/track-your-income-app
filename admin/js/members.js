// Stackr Admin — Mitgliederliste, Detailseite, Schnellsuche (Strg/Cmd+K), Bestaetigungsdialog
(function () {
    'use strict';
    var A = window.Admin, $ = A.$, el = A.el;
    var STATUS_DE = { active: 'aktiv', trialing: 'Test', past_due: 'ueberfaellig', canceled: 'gekuendigt',
                      completed: 'beendet', expired: 'abgelaufen' };
    var state = { page: 1, sort: 'signup_at', dir: 'desc' };
    var current = null;   // geladenes Detail

    function statusDe(s) { return STATUS_DE[s] || s || '–'; }

    // ── Liste ──────────────────────────────────────────────────────────────────────
    async function loadTags() {
        try {
            var t = (await A.api('/api/members?tags=1')).tags;
            var sel = $('tag-filter'), keep = sel.value;
            sel.textContent = '';
            sel.appendChild(el('option', { value: '', text: 'alle' }));
            t.forEach(function (x) { sel.appendChild(el('option', { value: x.tag, text: x.tag + ' (' + x.n + ')' })); });
            sel.value = keep;
        } catch (e) { /* Filter bleibt leer */ }
    }

    async function loadList() {
        var p = new URLSearchParams({ page: state.page, sort: state.sort, dir: state.dir });
        new FormData($('members-filter')).forEach(function (v, k) { if (v) p.set(k, v); });
        try {
            var out = await A.api('/api/members?' + p);
            var tb = $('members-rows');
            tb.textContent = '';
            out.rows.forEach(function (m) {
                var tr = el('tr', { class: m.suspended_at ? 'susp' : '' });
                var a = el('a', { href: '#member/' + encodeURIComponent(m.whop_user_id), text: m.name || m.username || m.whop_user_id });
                tr.appendChild(el('td', {}, [a]));
                tr.appendChild(el('td', { text: m.email }));
                tr.appendChild(el('td', { text: statusDe(m.status) + (m.suspended_at ? ' · gesperrt' : '') }));
                tr.appendChild(el('td', { text: A.fmtDay(m.signup_at) }));
                tr.appendChild(el('td', { text: A.fmtDay(m.last_active_at) }));
                tr.appendChild(el('td', {}, m.tags.map(function (t) { return el('span', { class: 'chip', text: t }); })));
                tb.appendChild(tr);
            });
            $('members-empty').hidden = out.rows.length > 0;
            var pages = Math.max(Math.ceil(out.total / out.size), 1);
            $('pg-info').textContent = 'Seite ' + out.page + ' von ' + pages + ' · ' + out.total + ' Mitglieder';
            $('pg-prev').disabled = out.page <= 1;
            $('pg-next').disabled = out.page >= pages;
        } catch (e) { if (e.status !== 401) A.toast('Liste konnte nicht geladen werden.'); }
    }

    $('members-filter').addEventListener('submit', function (ev) { ev.preventDefault(); state.page = 1; loadList(); });
    $('pg-prev').addEventListener('click', function () { state.page--; loadList(); });
    $('pg-next').addEventListener('click', function () { state.page++; loadList(); });
    document.querySelectorAll('.th').forEach(function (b) {
        b.addEventListener('click', function () {
            var s = b.getAttribute('data-sort');
            state.dir = state.sort === s && state.dir === 'desc' ? 'asc' : 'desc';
            state.sort = s; state.page = 1; loadList();
        });
    });

    $('btn-whop-sync').addEventListener('click', async function () {
        if (!A.can('users.edit')) return A.toast('Dir fehlt das Recht users.edit.');
        var b = $('btn-whop-sync');
        b.disabled = true;
        try {
            var r = await A.api('/api/members-sync', { method: 'POST', body: {} });
            A.toast(r.mitglieder + ' Mitglieder abgeglichen.');
            state.page = 1; await loadTags(); await loadList();
        } catch (e) {
            A.toast(e.message === 'whop_nicht_konfiguriert' ? 'WHOP_API_KEY fehlt im Admin-Projekt.' :
                    e.message === 'whop_leer' ? 'Whop lieferte keine Mitglieder – nichts geaendert.' : 'Abgleich fehlgeschlagen.');
        } finally { b.disabled = false; }
    });

    A.views.members = { show: function () { loadTags(); loadList(); } };

    // ── Bestaetigungsdialog (getippte Bestaetigung bei destruktiven Aktionen) ──────
    var confirmDone = null;
    function askConfirm(o) {   // o: { title, text, expect, reason (bool) } -> Promise<{ reason } | null>
        return new Promise(function (resolve) {
            $('confirm-title').textContent = o.title;
            $('confirm-text').textContent = o.text;
            $('confirm-expect').textContent = o.expect;
            $('confirm-input').value = '';
            $('confirm-reason').value = '';
            $('confirm-reason-wrap').hidden = !o.reason;
            $('confirm-ok').disabled = true;
            confirmDone = function (ok) { resolve(ok ? { reason: $('confirm-reason').value.trim(), confirm: $('confirm-input').value.trim() } : null); };
            $('confirm-dialog').showModal();
        });
    }
    function confirmReady() {
        var okReason = $('confirm-reason-wrap').hidden || $('confirm-reason').value.trim().length >= 3;
        $('confirm-ok').disabled = !(okReason && $('confirm-input').value.trim() === $('confirm-expect').textContent);
    }
    $('confirm-input').addEventListener('input', confirmReady);
    $('confirm-reason').addEventListener('input', confirmReady);
    $('confirm-cancel').addEventListener('click', function () { $('confirm-dialog').close(); });
    $('confirm-form').addEventListener('submit', function (ev) {
        if (ev.submitter && ev.submitter.id === 'confirm-ok' && confirmDone) confirmDone(true);
    });
    $('confirm-dialog').addEventListener('close', function () {
        if (confirmDone) { var d = confirmDone; confirmDone = null; d(false); }
    });

    // ── Detail ─────────────────────────────────────────────────────────────────────
    function fact(dl, k, v) { dl.appendChild(el('dt', { text: k })); dl.appendChild(el('dd', { text: v })); }

    function renderDetail(d, revealed) {
        current = d;
        var m = d.member, id = m.whop_user_id;
        $('m-title').textContent = m.name || m.username || id;
        var badges = $('m-badges');
        badges.textContent = '';
        badges.appendChild(el('span', { class: 'chip', text: statusDe(m.status) }));
        if (m.suspended_at) badges.appendChild(el('span', { class: 'chip bad', text: 'gesperrt seit ' + A.fmtDay(m.suspended_at) }));
        if (d.loeschplan) badges.appendChild(el('span', { class: 'chip warn', text: 'Loeschung vorgemerkt' }));

        var ov = $('tab-overview');
        ov.textContent = '';
        var dl = el('dl');
        fact(dl, 'Whop-ID', id);
        fact(dl, 'E-Mail', m.email || '–');
        fact(dl, 'Benutzername', m.username || '–');
        fact(dl, 'Plan', m.plan_id || '–');
        fact(dl, 'Angemeldet', A.fmtDay(m.signup_at));
        fact(dl, 'Zuletzt aktiv (Sync)', A.fmt(m.last_active_at));
        fact(dl, 'Sync-Bereiche', String(d.sync.scopes));
        fact(dl, 'Zuletzt abgeglichen', A.fmt(m.last_sync_at));
        if (m.suspended_at) fact(dl, 'Sperrgrund', m.suspended_reason || '–');
        ov.appendChild(dl);

        if (!revealed && A.can('users.reveal_pii')) {
            ov.appendChild(el('button', { type: 'button', class: 'ghost', id: 'btn-reveal', text: 'E-Mail anzeigen (wird protokolliert)' }));
        }

        if (d.loeschplan) {
            var l = d.loeschplan, ab = new Date(new Date(l.inaktiv_seit).getTime() + 30 * 86400000);
            var box = el('div', { class: 'box' });
            box.appendChild(el('strong', { text: 'Loeschplan (nur Anzeige)' }));
            box.appendChild(el('p', { text: 'Whop kennt keine gueltige Mitgliedschaft mehr seit ' + A.fmtDay(l.inaktiv_seit) +
                '. Cloud-Daten werden fruehestens ab ' + A.fmtDay(ab) + ' geloescht. Mail 1: ' + A.fmtDay(l.mail1_am) +
                ', Mail 2: ' + A.fmtDay(l.mail2_am) + '.' }));
            ov.appendChild(box);
        }

        // Tags
        var tg = el('div', { class: 'box' }, [el('strong', { text: 'Tags' })]);
        var chips = el('p');
        d.tags.forEach(function (t) {
            var c = el('span', { class: 'chip', text: t });
            if (A.can('tags.write')) {
                var x = el('button', { type: 'button', class: 'x', 'aria-label': 'Tag ' + t + ' entfernen', text: '×' });
                x.addEventListener('click', function () { act({ action: 'tag', tag: t, on: false }); });
                c.appendChild(x);
            }
            chips.appendChild(c);
        });
        tg.appendChild(chips);
        if (A.can('tags.write')) {
            var tf = el('form', { class: 'inline' }, [
                el('input', { name: 'tag', maxlength: '30', placeholder: 'z. B. VIP, at risk', 'aria-label': 'Neuer Tag' }),
                el('button', { type: 'submit', text: 'Hinzufuegen' })]);
            tf.addEventListener('submit', function (ev) {
                ev.preventDefault();
                var v = tf.elements.tag.value.trim();
                if (v) act({ action: 'tag', tag: v, on: true });
            });
            tg.appendChild(tf);
        }
        ov.appendChild(tg);

        // Sperre
        if (A.can('users.suspend')) {
            var sb = el('div', { class: 'box' });
            if (m.suspended_at) {
                var un = el('button', { type: 'button', text: 'Entsperren' });
                un.addEventListener('click', function () { act({ action: 'unsuspend' }); });
                sb.appendChild(un);
            } else {
                sb.appendChild(el('p', { text: 'Sperren blockt den Cloud-Sync und Datei-Upload dieses Mitglieds. Eigene Daten loeschen und Freigaben widerrufen bleiben moeglich. Whop-Konto und Abo bleiben unveraendert.' }));
                var sp = el('button', { type: 'button', class: 'danger', text: 'Mitglied sperren' });
                sp.addEventListener('click', async function () {
                    var r = await askConfirm({ title: 'Mitglied sperren', reason: true, expect: id,
                        text: 'Das Mitglied verliert den Cloud-Sync, bis du es entsperrst.' });
                    if (r) act({ action: 'suspend', reason: r.reason, confirm: r.confirm });
                });
                sb.appendChild(sp);
            }
            ov.appendChild(sb);
        }

        // Billing-Kurzinfo (Phase c bringt den Rest)
        var bb = $('m-billing-basic');
        bb.textContent = '';
        fact(bb, 'Status bei Whop', statusDe(m.status));
        fact(bb, 'Plan-ID', m.plan_id || '–');
        fact(bb, 'Mitgliedschafts-ID', m.membership_id || '–');

        renderNotes(d.notes);
        var rev = $('btn-reveal');
        if (rev) rev.addEventListener('click', function () { show(id, true); });
    }

    function renderNotes(notes) {
        var ul = $('m-notes');
        ul.textContent = '';
        notes.forEach(function (n) {
            var li = el('li', { class: n.pinned ? 'pinned' : '' });
            li.appendChild(el('p', { class: 'nbody', text: n.body }));
            li.appendChild(el('small', { text: n.author + ' · ' + A.fmt(n.created_at) + (n.pinned ? ' · angepinnt' : '') + ' ' }));
            if (A.can('notes.write')) {
                var b = el('button', { type: 'button', class: 'ghost', text: n.pinned ? 'Loesen' : 'Anpinnen' });
                b.addEventListener('click', function () { act({ action: 'pin', noteId: n.id, pinned: !n.pinned }); });
                li.appendChild(b);
            }
            ul.appendChild(li);
        });
        $('m-notes-empty').hidden = notes.length > 0;
        $('note-form').hidden = !A.can('notes.write');
    }

    async function loadActivity(id) {
        try {
            var rows = (await A.api('/api/audit?targetType=member&targetId=' + encodeURIComponent(id) + '&limit=100')).rows;
            A.renderActivity($('m-activity'), $('m-activity-empty'), rows);
        } catch (e) { /* Reiter bleibt leer */ }
    }

    var ERR_DE = { grund_ungueltig: 'Grund fehlt (3 bis 300 Zeichen).', bestaetigung_falsch: 'Bestaetigung stimmt nicht.',
                   notiz_ungueltig: 'Notiz ungueltig.', tag_ungueltig: 'Tag ungueltig (max. 30 Zeichen, Buchstaben/Ziffern).',
                   recht_fehlt: 'Dir fehlt das Recht dafuer.', nicht_gefunden: 'Mitglied nicht gefunden.' };

    async function act(body) {
        if (!current) return;
        var id = current.member.whop_user_id;
        try {
            await A.api('/api/member', { body: Object.assign({ id: id }, body) });
            A.toast('Gespeichert.');
            await show(id);
        } catch (e) { if (e.status !== 401) A.toast(ERR_DE[e.message] || 'Aktion fehlgeschlagen.'); }
    }

    $('note-form').addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var f = ev.target, body = f.elements.body.value.trim();
        if (!body) return;
        await act({ action: 'note', body: body });
        f.reset();
    });

    document.querySelectorAll('.tabs button').forEach(function (b) {
        b.addEventListener('click', function () {
            document.querySelectorAll('.tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
            document.querySelectorAll('.tab').forEach(function (t) { t.hidden = t.id !== 'tab-' + b.getAttribute('data-tab'); });
        });
    });

    async function show(id, reveal) {
        try {
            var d = await A.api('/api/member?id=' + encodeURIComponent(id) + (reveal ? '&reveal=1' : ''));
            renderDetail(d, !!reveal);
            loadActivity(id);
        } catch (e) {
            if (e.status === 401) return;
            A.toast(e.status === 404 ? 'Mitglied nicht gefunden.' : 'Detail konnte nicht geladen werden.');
            location.hash = '#members';
        }
    }
    A.views.member = { show: function (id) { show(decodeURIComponent(id)); } };

    // ── Schnellsuche (Strg/Cmd+K) ──────────────────────────────────────────────────
    var timer = null, hits = [];
    function openSearch() {
        if (!A.me) return;
        $('search-input').value = '';
        $('search-results').textContent = '';
        $('search-dialog').showModal();
        $('search-input').focus();
    }
    function go(m) { $('search-dialog').close(); location.hash = '#member/' + encodeURIComponent(m.whop_user_id); }

    $('search-input').addEventListener('input', function () {
        clearTimeout(timer);
        var q = this.value.trim();
        timer = setTimeout(async function () {
            var ul = $('search-results');
            if (q.length < 2) { ul.textContent = ''; hits = []; return; }
            try {
                hits = (await A.api('/api/search?q=' + encodeURIComponent(q))).rows;
                ul.textContent = '';
                hits.forEach(function (m) {
                    var li = el('li');
                    var b = el('button', { type: 'button', text: (m.name || m.whop_user_id) + ' · ' + m.email + ' · ' + statusDe(m.status) });
                    b.addEventListener('click', function () { go(m); });
                    li.appendChild(b);
                    ul.appendChild(li);
                });
                if (!hits.length) ul.appendChild(el('li', { class: 'none', text: 'Kein Treffer.' }));
            } catch (e) { /* naechste Eingabe versucht es erneut */ }
        }, 120);
    });
    $('search-input').addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); if (hits[0]) go(hits[0]); }
    });
    $('btn-search').addEventListener('click', openSearch);
    document.addEventListener('keydown', function (ev) {
        if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); openSearch(); }
    });
})();
