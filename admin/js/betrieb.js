// Stackr Admin — Betriebsansicht und Missbrauchs-Warteschlange
(function () {
    'use strict';
    var A = window.Admin, $ = A.$, el = A.el;
    var KIND_DE = { signup_domain: 'Anmeldungs-Haeufung', failed_payments: 'Fehlgeschlagene Zahlungen' };

    function kpi(label, wert) {
        return el('div', { class: 'kpi' }, [el('small', { text: label }), el('strong', { text: String(wert) })]);
    }
    function td(tr, t) { tr.appendChild(el('td', { text: t == null ? '' : String(t) })); }

    function betrifft(f) {
        if (f.whop_user_id) return (f.name || f.email || f.whop_user_id);
        return '@' + f.subject;
    }
    function detail(f) {
        var d = f.detail || {};
        return f.kind === 'signup_domain' ? d.anmeldungen_24h + ' Anmeldungen in 24 h (Schwelle ' + d.schwelle + ')'
                                          : d.fehlgeschlagen_30t + ' fehlgeschlagene Zahlungen in 30 Tagen (Schwelle ' + d.schwelle + ')';
    }

    async function decide(f, decision) {
        var body = { action: 'decide', id: f.id, decision: decision, reason: '' };
        if (decision === 'gesperrt') {
            var r = await A.askConfirm({ title: 'Mitglied sperren', reason: true, expect: f.whop_user_id,
                text: 'Sperrt ' + betrifft(f) + ' (Cloud-Sync wird blockiert).' });
            if (!r) return;
            body.reason = r.reason; body.confirm = r.confirm;
        }
        try { await A.api('/api/abuse', { body: body }); A.toast('Entscheidung gespeichert.'); load(); }
        catch (e) { if (e.status !== 401) A.toast(e.message === 'domain_nicht_sperrbar' ? 'Eine Domain laesst sich nur freigeben.' : 'Aktion fehlgeschlagen.'); }
    }

    async function load() {
        try {
            var d = await A.api('/api/betrieb');
            var k = $('betrieb-kpis');
            k.textContent = '';
            k.appendChild(kpi('Mitglieder', d.mitglieder.gesamt));
            k.appendChild(kpi('Gesperrt', d.mitglieder.gesperrt));
            k.appendChild(kpi('Offene Missbrauchs-Meldungen', d.abuse_offen));
            k.appendChild(kpi('Loeschplan (gesamt / faellig)', d.loeschplan.gesamt + ' / ' + d.loeschplan.faellig));
            k.appendChild(kpi('Mitglieder abgeglichen', A.fmt(d.stand.mitglieder)));
            k.appendChild(kpi('Zahlungen abgeglichen', A.fmt(d.stand.zahlungen)));
            k.appendChild(kpi('Kennzahlen berechnet', A.fmt(d.stand.kennzahlen)));
            d.alarme_24h.slice(0, 6).forEach(function (a) { k.appendChild(kpi('24 h: ' + a.source + ' / ' + a.event, a.n)); });

            var al = $('alarm-rows');
            al.textContent = '';
            d.alarme.forEach(function (a) { var tr = el('tr'); td(tr, A.fmt(a.ts)); td(tr, a.source); td(tr, a.event); td(tr, a.detail); al.appendChild(tr); });
            $('alarm-empty').hidden = d.alarme.length > 0;

            var ce = $('clerr-rows');
            ce.textContent = '';
            d.client_fehler.forEach(function (c) { var tr = el('tr'); td(tr, c.n); td(tr, c.eintrag); ce.appendChild(tr); });
            $('clerr-empty').hidden = d.client_fehler.length > 0;
        } catch (e) { if (e.status !== 401) A.toast('Betriebsdaten konnten nicht geladen werden.'); }

        try {
            var rows = (await A.api('/api/abuse?status=offen')).rows;
            var tb = $('abuse-rows');
            tb.textContent = '';
            rows.forEach(function (f) {
                var tr = el('tr');
                td(tr, KIND_DE[f.kind] || f.kind);
                var who = el('td');
                if (f.whop_user_id) who.appendChild(el('a', { href: '#member/' + encodeURIComponent(f.whop_user_id), text: betrifft(f) }));
                else who.textContent = betrifft(f);
                tr.appendChild(who);
                td(tr, detail(f)); td(tr, A.fmtDay(f.created_at));
                var act = el('td');
                if (A.can('abuse.review')) {
                    var ok = el('button', { type: 'button', class: 'ghost', text: 'Freigeben' });
                    ok.addEventListener('click', function () { decide(f, 'freigegeben'); });
                    act.appendChild(ok);
                    if (f.whop_user_id) {
                        act.appendChild(document.createTextNode(' '));
                        var sp = el('button', { type: 'button', class: 'danger', text: 'Sperren' });
                        sp.addEventListener('click', function () { decide(f, 'gesperrt'); });
                        act.appendChild(sp);
                    }
                }
                tr.appendChild(act);
                tb.appendChild(tr);
            });
            $('abuse-empty').hidden = rows.length > 0;
        } catch (e) { /* Warteschlange bleibt leer */ }
    }

    $('btn-abuse-scan').addEventListener('click', async function () {
        var b = $('btn-abuse-scan');
        b.disabled = true;
        try { var r = await A.api('/api/abuse', { body: { action: 'scan' } }); A.toast(r.neu + ' neue Meldung(en).'); load(); }
        catch (e) { if (e.status !== 401) A.toast('Pruefung fehlgeschlagen.'); }
        finally { b.disabled = false; }
    });

    A.views.betrieb = { show: load };
})();
