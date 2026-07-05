// Landing-Page-Logik (ehem. Inline-Scripts in index.html — CSP script-src-elem 'self')
(function () {
    'use strict';

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Zahlformat (de-DE) ────────────────────
    function fmtEur(n) {
        return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
    }
    function fmtInt(n) {
        return Math.round(n).toLocaleString('de-DE');
    }

    // ── Scroll-Reveal ─────────────────────────
    var revealEls = document.querySelectorAll('[data-reveal]');
    if ('IntersectionObserver' in window && !reduceMotion) {
        var ro = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) {
                    en.target.classList.add('vis');
                    ro.unobserve(en.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        revealEls.forEach(function (el) { ro.observe(el); });
    } else {
        revealEls.forEach(function (el) { el.classList.add('vis'); });
    }

    // ── Hero-Counter ──────────────────────────
    // setTimeout-Fallback garantiert den Endwert auch in Hintergrund-Tabs,
    // wo requestAnimationFrame pausiert.
    function countUp(el) {
        var target = parseFloat(el.getAttribute('data-cnt'));
        if (!isFinite(target)) { el.textContent = '0'; return; }
        if (reduceMotion || document.hidden) { el.textContent = fmtInt(target); return; }
        var start = null, dur = 1100, done = false;
        function finish() { if (!done) { done = true; el.textContent = fmtInt(target); } }
        function step(ts) {
            if (done) return;
            if (!start) start = ts;
            var p = Math.min((ts - start) / dur, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            if (p < 1) { el.textContent = fmtInt(target * eased); requestAnimationFrame(step); }
            else finish();
        }
        requestAnimationFrame(step);
        setTimeout(finish, dur + 200);
    }
    document.querySelectorAll('[data-cnt]').forEach(countUp);

    // ── Hero-Glow Parallax (dezent) ───────────
    var glow = document.getElementById('heroGlow');
    if (glow && !reduceMotion) {
        var ticking = false;
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                glow.style.transform = 'translateX(-50%) translateY(' + (window.scrollY * 0.18) + 'px)';
                ticking = false;
            });
        }, { passive: true });
    }

    // ── Nav-Schatten beim Scrollen ────────────
    var nav = document.getElementById('topnav');
    window.addEventListener('scroll', function () {
        nav.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });

    // ── Sticky Mobile CTA (nach dem Hero) ─────
    var stickyCta = document.getElementById('stickyCta');
    var heroEl = document.querySelector('.hero');
    if (stickyCta && heroEl && 'IntersectionObserver' in window) {
        var so = new IntersectionObserver(function (entries) {
            stickyCta.classList.toggle('show', !entries[0].isIntersecting);
            stickyCta.setAttribute('aria-hidden', String(entries[0].isIntersecting));
        }, { threshold: 0 });
        so.observe(heroEl);
    }

    /* ════════════════════════════════════════
       LIVE-DEMO
       ════════════════════════════════════════ */
    var demo = {
        nextId: 90,
        // Basiswerte 2026 (vor den sichtbaren Buchungen unten)
        baseIn: 11731.00,
        baseWare: 3106.00,
        baseKost: 1077.50,
        bookings: [
            { d: '03.06.', label: 'Nike Air Max 90 · Vinted',        amt: 89.00,  type: 'in',  cat: 'Verkauf' },
            { d: '02.06.', label: 'Versandmaterial DHL',             amt: 12.50,  type: 'out', cat: 'Porto' },
            { d: '01.06.', label: 'Logo-Design · RE-2026-041',       amt: 450.00, type: 'in',  cat: 'Dienstleistung' },
            { d: '31.05.', label: 'Einkauf Secondhand-Laden',        amt: 34.00,  type: 'out', cat: 'Wareneinkauf' },
            { d: '30.05.', label: 'Jordan 1 Mid · eBay',             amt: 210.00, type: 'in',  cat: 'Verkauf' }
        ],
        log: [
            { t: '03.06. 14:22', text: 'Buchung B-2026-089 erstellt', op: 'create' },
            { t: '02.06. 09:05', text: 'Rechnung RE-2026-041 als bezahlt markiert', op: 'update' },
            { t: '31.05. 18:40', text: 'Buchung B-2026-087 storniert (Storno statt Löschen)', op: 'storno' }
        ],
        months: { lbls: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun'], vals: [1800, 2100, 1950, 2400, 2150, 2080] }
    };

    function demoTotals() {
        var ein = demo.baseIn, ware = demo.baseWare, kost = demo.baseKost;
        demo.bookings.forEach(function (b) {
            if (b.type === 'in') ein += b.amt;
            else if (b.cat === 'Wareneinkauf') ware += b.amt;
            else kost += b.amt;
        });
        return { ein: ein, ware: ware, kost: kost, aus: ware + kost, win: ein - ware - kost };
    }

    function animateVal(el, from, to, fmt) {
        if (reduceMotion || document.hidden || Math.abs(to - from) < 0.005) { el.textContent = fmt(to); return; }
        var start = null, dur = 550, done = false;
        function finish() { if (!done) { done = true; el.textContent = fmt(to); } }
        function step(ts) {
            if (done) return;
            if (!start) start = ts;
            var p = Math.min((ts - start) / dur, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            if (p < 1) { el.textContent = fmt(from + (to - from) * eased); requestAnimationFrame(step); }
            else finish();
        }
        requestAnimationFrame(step);
        setTimeout(finish, dur + 150);
    }

    var demoPrev = { ein: 0, aus: 0, win: 0, ware: 0, kost: 0 };

    function renderDemoStats(animate) {
        var t = demoTotals();
        var map = [
            ['dsIn',   t.ein,  demoPrev.ein],
            ['dsOut',  t.aus,  demoPrev.aus],
            ['dsWin',  t.win,  demoPrev.win],
            ['euIn',   t.ein,  demoPrev.ein],
            ['euWare', t.ware, demoPrev.ware],
            ['euKost', t.kost, demoPrev.kost],
            ['euWin',  t.win,  demoPrev.win]
        ];
        map.forEach(function (m) {
            var el = document.getElementById(m[0]);
            if (!el) return;
            var fmt = fmtEur;
            if (m[0] === 'euWare' || m[0] === 'euKost') fmt = function (n) { return '− ' + fmtEur(n); };
            if (animate) animateVal(el, m[2], m[1], fmt); else el.textContent = fmt(m[1]);
        });
        var marge = document.getElementById('dsMarge');
        if (marge) marge.textContent = Math.round(t.win / t.ein * 100) + ' % Marge';
        demoPrev = { ein: t.ein, aus: t.aus, win: t.win, ware: t.ware, kost: t.kost };
    }

    function renderDemoChart() {
        var wrap = document.getElementById('demoChart');
        if (!wrap) return;
        wrap.innerHTML = '';
        var max = Math.max.apply(null, demo.months.vals);
        demo.months.lbls.forEach(function (lbl, i) {
            var col = document.createElement('div');
            col.className = 'demo-bar-col';
            var bar = document.createElement('div');
            bar.className = 'demo-bar';
            bar.style.height = Math.max(8, Math.round(demo.months.vals[i] / max * 82)) + '%';
            var l = document.createElement('div');
            l.className = 'demo-bar-lbl';
            l.textContent = lbl;
            col.appendChild(bar);
            col.appendChild(l);
            wrap.appendChild(col);
        });
    }

    function bookingRow(b, isNew) {
        var row = document.createElement('div');
        row.className = 'demo-row' + (isNew ? ' new' : '');
        var date = document.createElement('span');
        date.className = 'dr-date';
        date.textContent = b.d;
        var label = document.createElement('span');
        label.className = 'dr-label';
        label.textContent = b.label;
        var amt = document.createElement('span');
        amt.className = 'dr-amt ' + b.type;
        amt.textContent = (b.type === 'in' ? '+ ' : '− ') + fmtEur(b.amt);
        row.appendChild(date);
        row.appendChild(label);
        row.appendChild(amt);
        return row;
    }

    function renderDemoList() {
        var list = document.getElementById('demoList');
        if (!list) return;
        list.innerHTML = '';
        demo.bookings.slice(0, 8).forEach(function (b) { list.appendChild(bookingRow(b, false)); });
    }

    function logRow(e, isNew) {
        var row = document.createElement('div');
        row.className = 'demo-log-row' + (isNew ? ' new' : '');
        var t = document.createElement('span');
        t.className = 'demo-log-time';
        t.textContent = e.t;
        var txt = document.createElement('span');
        txt.className = 'demo-log-text';
        txt.textContent = e.text;
        var op = document.createElement('span');
        op.className = 'demo-log-op ' + e.op;
        op.textContent = e.op.toUpperCase();
        row.appendChild(t);
        row.appendChild(txt);
        row.appendChild(op);
        return row;
    }

    function renderDemoLog() {
        var list = document.getElementById('demoLog');
        if (!list) return;
        list.innerHTML = '';
        demo.log.slice(0, 7).forEach(function (e) { list.appendChild(logRow(e, false)); });
    }

    var toastTimer = null;
    function demoToast(html) {
        var t = document.getElementById('demoToast');
        if (!t) return;
        t.innerHTML = html;
        t.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2000);
    }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    window.demoAdd = function (label, amt, type, cat) {
        var now = new Date();
        var b = {
            d: pad2(now.getDate()) + '.' + pad2(now.getMonth() + 1) + '.',
            label: label, amt: amt, type: type, cat: cat
        };
        demo.bookings.unshift(b);

        // Chart: letzter Monat wächst bei Einnahmen
        if (type === 'in') demo.months.vals[demo.months.vals.length - 1] += amt;

        // GoBD-Log
        var id = 'B-2026-' + pad2(demo.nextId++);
        demo.log.unshift({
            t: pad2(now.getDate()) + '.' + pad2(now.getMonth() + 1) + '. ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes()),
            text: 'Buchung ' + id + ' erstellt (' + cat + ')',
            op: 'create'
        });

        renderDemoStats(true);
        renderDemoChart();

        var list = document.getElementById('demoList');
        if (list) {
            list.insertBefore(bookingRow(b, true), list.firstChild);
            while (list.children.length > 8) list.removeChild(list.lastChild);
        }
        var logList = document.getElementById('demoLog');
        if (logList) {
            logList.insertBefore(logRow(demo.log[0], true), logList.firstChild);
            while (logList.children.length > 7) logList.removeChild(logList.lastChild);
        }

        demoToast('<span class="ok">✓</span> ' + id + ' erfasst — GoBD-protokolliert');
    };

    window.demoAddCustom = function () {
        var amtInp = document.getElementById('demoAmt');
        var typeSel = document.getElementById('demoType');
        var amt = parseFloat((amtInp.value || '').replace(',', '.'));
        if (!isFinite(amt) || amt <= 0) {
            amtInp.focus();
            demoToast('Bitte gib einen Betrag größer 0 ein.');
            return;
        }
        amt = Math.round(amt * 100) / 100;
        var type = typeSel.value === 'out' ? 'out' : 'in';
        window.demoAdd(type === 'in' ? 'Eigene Einnahme' : 'Eigene Ausgabe', amt, type, type === 'in' ? 'Verkauf' : 'Betriebsausgabe');
        amtInp.value = '';
    };

    // Demo-Tabs
    document.querySelectorAll('.demo-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.demo-tab').forEach(function (b) { b.setAttribute('aria-selected', 'false'); });
            btn.setAttribute('aria-selected', 'true');
            document.querySelectorAll('.demo-view').forEach(function (v) { v.hidden = true; });
            var view = document.getElementById('dv-' + btn.dataset.view);
            if (view) view.hidden = false;
        });
    });

    // Demo: Enter im Betragsfeld bucht
    var demoAmtInp = document.getElementById('demoAmt');
    if (demoAmtInp) {
        demoAmtInp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') window.demoAddCustom();
        });
    }

    // Demo initial rendern
    renderDemoStats(false);
    renderDemoChart();
    renderDemoList();
    renderDemoLog();

    /* ════════════════════════════════════════
       PRICING TOGGLE
       ════════════════════════════════════════ */
    window.setBilling = function (mode) {
        var isYearly = mode === 'yearly';
        document.getElementById('billingMonthly').classList.toggle('billing-btn-active', !isYearly);
        document.getElementById('billingMonthly').setAttribute('aria-pressed', String(!isYearly));
        document.getElementById('billingYearly').classList.toggle('billing-btn-active', isYearly);
        document.getElementById('billingYearly').setAttribute('aria-pressed', String(isYearly));

        var priceEl  = document.getElementById('proPrice');
        var periodEl = document.getElementById('proPricePeriod');
        var descEl   = document.getElementById('proDesc');
        var ctaBtn   = document.getElementById('proCtaBtn');

        if (isYearly) {
            priceEl.childNodes[0].textContent = '11,25 € ';
            periodEl.textContent = '/ Monat';
            descEl.textContent   = 'Abgerechnet jährlich (135 €) · Du sparst 45 € · inkl. MwSt.';
            ctaBtn.textContent   = 'Jetzt Pro (jährlich) starten →';
        } else {
            priceEl.childNodes[0].textContent = '15,00 € ';
            periodEl.textContent = '/ Monat';
            descEl.textContent   = 'inkl. MwSt. · Jederzeit kündbar';
            ctaBtn.textContent   = 'Jetzt Pro starten →';
        }
    };

    /* ════════════════════════════════════════
       FAQ
       ════════════════════════════════════════ */
    window.toggleFaq = function (btn) {
        var item = btn.closest('.faq-item');
        var isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(function (i) { i.classList.remove('open'); });
        if (!isOpen) item.classList.add('open');
    };
})();

(function () {
    'use strict';

    var APP_URL = 'app.html';   // Haupt-App; Anmeldung, Registrierung & Zahlung laufen dort über Whop (OAuth)

    function showLoader(msg) {
        document.getElementById('loaderText').textContent = msg || 'Wird geladen...';
        document.getElementById('pageLoader').classList.add('show');
    }

    // ── Bereits über Whop angemeldet? → CTAs auf "Zur App" umstellen ──
    function checkExistingSession() {
        try {
            if (!localStorage.getItem('whop_access_token')) return;
        } catch (e) { return; }
        var btns = document.querySelectorAll('.btn-hero, .btn-plan-free, .btn-plan-pro');
        btns.forEach(function(btn) {
            btn.textContent = 'Zur App →';
            btn.onclick = function() {
                showLoader('App wird geöffnet...');
                window.location.href = APP_URL;
            };
        });
    }

    // Alle CTAs leiten direkt zur App — Login/Registrierung läuft dort über Whop
    window.openAuth = function () {
        showLoader('Weiter zur Anmeldung...');
        window.location.href = APP_URL;
    };

    checkExistingSession();
})();
