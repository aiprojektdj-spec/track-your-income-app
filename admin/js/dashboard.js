// Stackr Admin — Dashboard: Kennzahlen mit Vorperiode, Diagramme (SVG), Kohorten, Plan-Betraege
(function () {
    'use strict';
    var A = window.Admin, $ = A.$, el = A.el;
    var NS = 'http://www.w3.org/2000/svg';

    function eur(c) { return c == null ? '–' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(c / 100); }
    function num(v) { return v == null ? '–' : new Intl.NumberFormat('de-DE').format(v); }
    function pct(v) { return v == null ? '–' : (Number(v) * 100).toFixed(1).replace('.', ',') + ' %'; }

    // Karte: Wert + Aenderung zur Vorperiode (goodUp: steigender Wert ist gut)
    function card(label, cur, prev, fmt, goodUp, raw) {
        var box = el('div', { class: 'kpi' }, [el('small', { text: label }), el('strong', { text: fmt(cur) })]);
        if (raw && cur != null && prev != null && Number(prev) !== Number(cur)) {
            var diff = Number(cur) - Number(prev), up = diff > 0;
            box.appendChild(el('span', { class: 'd ' + (up === goodUp ? 'up' : 'down'),
                text: (up ? '▲ ' : '▼ ') + fmt(Math.abs(diff)) + ' ggü. Vorperiode (' + fmt(prev) + ')' }));
        } else if (prev != null) {
            box.appendChild(el('span', { class: 'd', text: 'Vorperiode: ' + fmt(prev) }));
        }
        return box;
    }

    function svg(w, h) {
        var s = document.createElementNS(NS, 'svg');
        s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        s.setAttribute('width', w); s.setAttribute('height', h);
        s.setAttribute('role', 'img');
        return s;
    }
    function rect(s, x, y, w, h, color) {
        var r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', Math.max(w, 0)); r.setAttribute('height', Math.max(h, 0));
        r.setAttribute('fill', color);
        s.appendChild(r);
    }
    function text(s, x, y, t, anchor) {
        var n = document.createElementNS(NS, 'text');
        n.setAttribute('x', x); n.setAttribute('y', y); n.setAttribute('text-anchor', anchor || 'start');
        n.textContent = t;
        s.appendChild(n);
    }

    // Gestapelte Saeulen: series = [{ name, color, key, sign }], positive oben, negative unten
    function stacked(host, rows, series, fmt, title) {
        host.textContent = '';
        var W = Math.max(rows.length * 18 + 70, 420), H = 220, L = 60, T = 12, B = 28;
        var pos = rows.map(function (r) { return series.reduce(function (a, s) { return a + (s.sign > 0 ? (r[s.key] || 0) : 0); }, 0); });
        var neg = rows.map(function (r) { return series.reduce(function (a, s) { return a + (s.sign < 0 ? (r[s.key] || 0) : 0); }, 0); });
        var max = Math.max.apply(null, pos.concat([1])), min = Math.max.apply(null, neg.concat([0]));
        var span = max + min, plotH = H - T - B, zero = T + (max / span) * plotH;
        var s = svg(W, H);
        s.setAttribute('aria-label', title);
        rows.forEach(function (r, i) {
            var x = L + i * 18 + 3, up = zero, down = zero;
            series.forEach(function (se) {
                var v = r[se.key] || 0;
                if (!v) return;
                var h = (v / span) * plotH;
                if (se.sign > 0) { up -= h; rect(s, x, up, 12, h, se.color); } else { rect(s, x, down, 12, h, se.color); down += h; }
            });
            if (i % Math.ceil(rows.length / 10 || 1) === 0) text(s, x + 6, H - 10, r.day.slice(5), 'middle');
        });
        text(s, L - 6, T + 8, fmt(max), 'end'); text(s, L - 6, zero + 3, '0', 'end');
        if (min) text(s, L - 6, H - B, '-' + fmt(min), 'end');
        host.appendChild(s);
        var leg = el('p', { class: 'note' });
        series.forEach(function (se) { leg.appendChild(el('span', { class: 'chip', text: se.name })); });
        host.appendChild(leg);
        // Tabelle nur fuer Screenreader/Zahlen
        s.appendChild(Object.assign(document.createElementNS(NS, 'title'), { textContent: title }));
    }

    function bars(host, rows, key, title) {
        host.textContent = '';
        var W = Math.max(rows.length * 18 + 70, 420), H = 160, L = 40, T = 10, B = 26;
        var max = Math.max.apply(null, rows.map(function (r) { return r[key] || 0; }).concat([1]));
        var s = svg(W, H);
        s.setAttribute('aria-label', title);
        rows.forEach(function (r, i) {
            var h = ((r[key] || 0) / max) * (H - T - B);
            rect(s, L + i * 18 + 3, H - B - h, 12, h, 'var(--accent)');
            if (i % Math.ceil(rows.length / 10 || 1) === 0) text(s, L + i * 18 + 9, H - 10, r.day.slice(5), 'middle');
        });
        text(s, L - 6, T + 8, String(max), 'end'); text(s, L - 6, H - B + 3, '0', 'end');
        host.appendChild(s);
    }

    var ERR = { zeitraum_ungueltig: 'Zeitraum ungueltig (1 bis 366 Tage).', datum_ungueltig: 'Datum ungueltig.' };

    async function load() {
        var f = $('dash-filter');
        var p = new URLSearchParams();
        if (f.elements.from.value) p.set('from', f.elements.from.value);
        if (f.elements.to.value) p.set('to', f.elements.to.value);
        try {
            var d = await A.api('/api/metrics?' + p);
            f.elements.from.value = d.von; f.elements.to.value = d.bis;
            var c = d.aktuell, v = d.vorher;
            $('dash-stand').textContent = d.berechnet ? 'Berechnet: ' + A.fmt(d.berechnet) : 'Noch nie berechnet.';
            var k = $('kpis');
            k.textContent = '';
            [['MRR', 'mrr_cents', eur, true], ['ARR', 'arr_cents', eur, true], ['Netto-Neu-MRR', 'net_new_mrr_cents', eur, true],
             ['Neu-MRR', 'neu_cents', eur, true], ['Verlorener MRR', 'verloren_cents', eur, false],
             ['Aktive Mitglieder', 'active', num, true], ['ARPU', 'arpu_cents', eur, true],
             ['Logo-Churn', 'logo_churn', pct, false], ['Umsatz-Churn', 'revenue_churn', pct, false],
             ['Kündiger', 'kuendiger', num, false], ['Anmeldungen', 'signups', num, true],
             ['Testumstieg', 'trial_conversion', pct, true], ['Umsatz (Zahlungen)', 'umsatz_cents', eur, true],
             ['Fehlgeschlagen', 'fehlgeschlagen', num, false],
             ['DAU', 'dau', num, true], ['WAU', 'wau', num, true], ['MAU', 'mau', num, true]].forEach(function (x) {
                k.appendChild(card(x[0], c[x[1]], v[x[1]], x[2], x[3], x[2] !== pct));
            });
            stacked($('chart-mrr'), d.reihe, [
                { name: 'Neu', key: 'new_mrr_cents', color: '#34c38f', sign: 1 },
                { name: 'Erweiterung', key: 'expansion_cents', color: '#4a90d9', sign: 1 },
                { name: 'Rückgang', key: 'contraction_cents', color: '#e0a030', sign: -1 },
                { name: 'Verloren', key: 'churned_cents', color: '#e0524a', sign: -1 }], eur, 'MRR-Bewegung pro Tag');
            bars($('chart-signups'), d.reihe, 'signups', 'Anmeldungen pro Tag');
            var co = $('cohorts');
            co.textContent = '';
            d.kohorten.forEach(function (x) {
                var tr = el('tr');
                [x.monat, num(x.gesamt), num(x.aktiv), pct(x.gesamt ? x.aktiv / x.gesamt : null)].forEach(function (t) { tr.appendChild(el('td', { text: t })); });
                co.appendChild(tr);
            });
            loadPlans();
        } catch (e) { if (e.status !== 401) A.toast(ERR[e.message] || 'Dashboard konnte nicht geladen werden.'); }
    }

    async function loadPlans() {
        try {
            var d = await A.api('/api/plans');
            var tb = $('plans');
            tb.textContent = '';
            d.plans.forEach(function (p) {
                var tr = el('tr');
                [p.plan_id, p.label, (p.monthly_cents / 100).toFixed(2).replace('.', ',')].forEach(function (t) { tr.appendChild(el('td', { text: t })); });
                tr.appendChild(el('td'));
                tb.appendChild(tr);
            });
            var warn = $('dash-warn');
            warn.hidden = !d.ohne_betrag.length;
            warn.textContent = d.ohne_betrag.length ? 'Ohne Betrag (fehlen im MRR): ' +
                d.ohne_betrag.map(function (x) { return x.plan_id + ' (' + x.mitglieder + ' aktiv)'; }).join(', ') : '';
        } catch (e) { /* Tabelle bleibt leer */ }
    }

    $('dash-filter').addEventListener('submit', function (ev) { ev.preventDefault(); load(); });

    $('btn-metrics').addEventListener('click', async function () {
        var b = $('btn-metrics');
        b.disabled = true;
        try { await A.api('/api/metrics', { method: 'POST', body: {} }); A.toast('Kennzahlen berechnet.'); await load(); }
        catch (e) { A.toast('Berechnung fehlgeschlagen.'); }
        finally { b.disabled = false; }
    });

    $('plan-form').addEventListener('submit', async function (ev) {
        ev.preventDefault();
        var f = ev.target;
        var eurVal = Number(String(f.elements.eur.value).replace(',', '.'));
        if (!isFinite(eurVal) || eurVal < 0) return A.toast('Betrag ungueltig.');
        try {
            await A.api('/api/plans', { body: { plan_id: f.elements.plan_id.value.trim(), label: f.elements.label.value.trim(), monthly_cents: Math.round(eurVal * 100) } });
            A.toast('Plan gespeichert. Danach "Kennzahlen jetzt berechnen".');
            f.reset(); loadPlans();
        } catch (e) { if (e.status !== 401) A.toast(e.message === 'id_ungueltig' ? 'Plan-ID ungueltig.' : 'Speichern fehlgeschlagen.'); }
    });

    A.views.dashboard = { show: function () {
        var f = $('dash-filter');
        if (!f.elements.from.value) {
            var t = new Date(), v = new Date(t.getTime() - 29 * 86400000), fm = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });
            f.elements.to.value = fm.format(t); f.elements.from.value = fm.format(v);
        }
        load();
    } };
})();
