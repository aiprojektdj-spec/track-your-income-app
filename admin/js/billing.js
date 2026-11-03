// Stackr Admin — Billing-Reiter (Zahlungen eines Mitglieds) und Mahnwesen. Nur Anzeige.
(function () {
    'use strict';
    var A = window.Admin, $ = A.$, el = A.el;

    function money(cents, cur) {
        var c = (cur || 'eur').toUpperCase();
        try { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: c }).format((cents || 0) / 100); }
        catch (e) { return ((cents || 0) / 100).toFixed(2) + ' ' + c; }
    }
    function card(p) { return p.card_last4 ? (p.card_brand || 'Karte') + ' •••• ' + p.card_last4 : '–'; }
    function td(tr, text) { tr.appendChild(el('td', { text: text })); }

    A.loadPayments = async function (id) {
        var tb = $('m-payments');
        tb.textContent = '';
        try {
            var d = await A.api('/api/billing?id=' + encodeURIComponent(id));
            d.payments.forEach(function (p) {
                var tr = el('tr', { class: p.failed ? 'susp' : '' });
                td(tr, A.fmtDay(p.created_at));
                td(tr, money(p.amount_cents, p.currency));
                td(tr, p.refunded_cents ? money(p.refunded_cents, p.currency) : '–');
                td(tr, p.failed ? 'fehlgeschlagen' : p.status);
                td(tr, card(p));
                td(tr, p.failure_message || '');
                tb.appendChild(tr);
            });
            $('m-payments-empty').hidden = d.payments.length > 0;
            var dl = $('m-billing-basic');
            [['Bezahlt (netto)', money(d.summe.bezahlt_cents, (d.payments[0] || {}).currency)],
             ['Erstattet', money(d.summe.erstattet_cents, (d.payments[0] || {}).currency)],
             ['Fehlgeschlagene Zahlungen', String(d.summe.fehlgeschlagen)],
             ['Zahlungen abgeglichen', A.fmt(d.zuletzt_abgeglichen)]].forEach(function (kv) {
                dl.appendChild(el('dt', { text: kv[0] })); dl.appendChild(el('dd', { text: kv[1] }));
            });
        } catch (e) { if (e.status !== 401) A.toast('Zahlungen konnten nicht geladen werden.'); }
    };

    async function loadDunning() {
        try {
            var d = await A.api('/api/billing?dunning=1');
            $('dun-stand').textContent = 'Stand: ' + A.fmt(d.zuletzt_abgeglichen);
            var pd = $('dun-pastdue');
            pd.textContent = '';
            d.past_due.forEach(function (m) {
                var tr = el('tr');
                tr.appendChild(el('td', {}, [el('a', { href: '#member/' + encodeURIComponent(m.whop_user_id), text: m.name || m.whop_user_id })]));
                td(tr, m.email); td(tr, A.fmtDay(m.letzte_zahlung));
                pd.appendChild(tr);
            });
            $('dun-pastdue-empty').hidden = d.past_due.length > 0;
            var fl = $('dun-failed');
            fl.textContent = '';
            d.failed.forEach(function (p) {
                var tr = el('tr');
                td(tr, A.fmtDay(p.created_at));
                tr.appendChild(el('td', {}, [el('a', { href: '#member/' + encodeURIComponent(p.whop_user_id), text: p.name || p.email || p.whop_user_id })]));
                td(tr, money(p.amount_cents, p.currency)); td(tr, card(p)); td(tr, p.failure_message || '');
                fl.appendChild(tr);
            });
            $('dun-failed-empty').hidden = d.failed.length > 0;
        } catch (e) { if (e.status !== 401) A.toast('Mahnliste konnte nicht geladen werden.'); }
    }

    $('btn-pay-sync').addEventListener('click', async function () {
        var b = $('btn-pay-sync');
        b.disabled = true;
        try {
            var r = await A.api('/api/payments-sync', { method: 'POST', body: {} });
            A.toast(r.zahlungen + ' Zahlungen abgeglichen.');
            await loadDunning();
        } catch (e) {
            A.toast(e.message === 'whop_nicht_konfiguriert' ? 'WHOP_API_KEY fehlt im Admin-Projekt.' :
                    e.message === 'whop_leer' ? 'Whop lieferte keine Zahlungen – nichts geaendert.' : 'Abgleich fehlgeschlagen.');
        } finally { b.disabled = false; }
    });

    A.views.dunning = { show: loadDunning };
})();
