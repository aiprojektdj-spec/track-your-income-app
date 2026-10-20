// ============================================
// DemoModus — nur demo.html (Plan: plan/demo-interaktiv-2026-10-19.md)
//
// Laeuft nach store.js/utils.js und VOR js/app-loader.js. Voraussetzung: js/demo-speicher.js hat
// localStorage/IndexedDB schon durch einen Arbeitsspeicher ersetzt — alles hier landet nur dort.
//
//  1. Musterfirma (Reseller, Kleinunternehmer §19 UStG) mit Lager, Verkaeufen und Ausgaben
//  2. Nur Uebersicht, Rechnungen und Lager erreichbar
//  3. Hoechstens GRENZE neue Eintraege pro Besuch
//  4. Keine Exporte, Downloads, Druck, Backups
// ============================================
(function () {
    'use strict';

    if (!window.__demoSpeicherAktiv) return; // ohne isolierten Speicher nie Musterdaten schreiben

    var GRENZE = 25;
    var ERLAUBT = { dashboard: true, rechnungen: true, lager: true };
    var TEST_URL = 'https://getstackr.de/#preise';

    // ── 1. Musterdaten ──────────────────────────────────────────────────────────
    var befuellen = true; // waehrend des Befuellens zaehlt die Grenze nicht

    function musterdaten() {
        var co = CompanyManager.create('Vintage Kiste (Muster)', '#10b981', 'Reselling', 'DE');
        if (!co) return;
        localStorage.setItem(CompanyManager.ACTIVE_KEY, co.id);
        Store.setCompany(co.id);
        Utils.setAgbAccepted();
        // Einmalige Hinweise der echten App gelten der eigenen Buchhaltung, nicht der Demo.
        localStorage.setItem('dsgvo_notice_shown', new Date().toISOString());
        // Backups gibt es in der Demo nicht (nichts wird gespeichert) — keine Erinnerungen dazu.
        localStorage.setItem('backup_banner_dismissed', '1');
        localStorage.setItem('last_backup_date', new Date().toISOString());

        Store.saveSettings(Object.assign({}, Store.getSettings(), {
            firmenname: 'Vintage Kiste (Muster)',
            name: 'Alex Muster',
            adresse: 'Musterstraße 1',
            plz: '12345',
            ort: 'Musterstadt',
            email: 'demo@example.com',
            steuernummer: '000/000/00000',
            iban: 'DE89370400440532013000',
            bankname: 'Musterbank',
            ustMode: 'klein',
            land: 'DE',
            onboardingDone: true
        }));

        Store.saveRechUnternehmen({
            firmenname: 'Vintage Kiste (Muster)', inhaber: 'Alex Muster', adresse: 'Musterstraße 1',
            plz: '12345', ort: 'Musterstadt', land: 'Deutschland', steuernummer: '000/000/00000',
            email: 'demo@example.com', bankname: 'Musterbank', iban: 'DE89370400440532013000'
        });
        [
            ['K-001', 'Second Hand Laden Muster', 'Kim Beispiel', 'Marktplatz 5', '12345', 'Musterstadt'],
            ['K-002', '', 'Sam Testkunde', 'Gartenweg 12', '54321', 'Beispielort']
        ].forEach(function (k) {
            Store.saveRechCustomer({
                id: Store.generateId(), kundennummer: k[0], firma: k[1], ansprechpartner: k[2],
                strasse: k[3], plz: k[4], ort: k[5], land: 'Deutschland', email: '', telefon: '',
                createdAt: new Date().toISOString()
            });
        });

        // [Einkaufsdatum, Marke, Artikeltyp, Groesse, Einkauf €, Verkauf (Datum, €, Plattform) oder null]
        var artikel = [
            ['2026-05-02', 'Levi\'s', 'Jeans', 'W32', 8, ['2026-05-14', 39, 'Vinted']],
            ['2026-05-03', 'Carhartt', 'Jacke', 'L', 22, ['2026-05-21', 89, 'Vinted']],
            ['2026-05-10', 'Nike', 'Sneaker', '43', 25, ['2026-06-02', 79, 'eBay']],
            ['2026-06-01', 'Ralph Lauren', 'Hemd', 'M', 6, ['2026-06-18', 35, 'Vinted']],
            ['2026-06-07', 'The North Face', 'Fleece', 'M', 15, ['2026-07-03', 65, 'Vinted']],
            ['2026-06-20', 'Adidas', 'Trainingsjacke', 'L', 9, ['2026-07-12', 49, 'Kleinanzeigen']],
            ['2026-07-05', 'Patagonia', 'Weste', 'S', 18, ['2026-08-01', 85, 'Vinted']],
            ['2026-07-19', 'Dr. Martens', 'Stiefel', '41', 30, ['2026-08-15', 110, 'eBay']],
            ['2026-08-02', 'Stüssy', 'Hoodie', 'L', 20, ['2026-08-28', 95, 'Vinted']],
            ['2026-08-16', 'Barbour', 'Wachsjacke', 'M', 35, ['2026-09-10', 149, 'Vinted']],
            ['2026-09-01', 'Tommy Hilfiger', 'Pullover', 'XL', 7, ['2026-09-24', 42, 'Vinted']],
            ['2026-09-14', 'New Balance', 'Sneaker', '42', 28, ['2026-10-04', 95, 'eBay']],
            ['2026-09-28', 'Arc\'teryx', 'Jacke', 'M', 60, ['2026-10-12', 219, 'Vinted']],
            ['2026-10-02', 'Levi\'s', 'Trucker-Jacke', 'M', 14, null],
            ['2026-10-06', 'Nike', 'Windbreaker', 'L', 12, null],
            ['2026-10-09', 'Carhartt', 'Mütze', 'One Size', 4, null],
            ['2026-10-13', 'Lacoste', 'Poloshirt', 'M', 6, null],
            ['2026-10-15', 'Salomon', 'Trailschuh', '44', 26, null]
        ];
        artikel.forEach(function (a) {
            var p = Store.savePurchase({
                datum: a[0], marke: a[1], artikeltyp: a[2], groesse: a[3],
                beschreibung: a[1] + ' ' + a[2], einkaufspreis: a[4], anzahl: 1,
                einkaufsquelle: 'Flohmarkt', warenkategorie: 'Kleidung', status: 'verfuegbar'
            });
            if (!a[5]) return;
            Store.addPlatform(a[5][2]);
            Store.saveSale({
                datum: a[5][0], verkaufsplattform: a[5][2], land: 'DE',
                verkaufspreis: a[5][1], versandkostenKaeufer: 0, plattformgebuehrProzent: 0,
                versandkostenVerkaufer: 0, kaeufer: '', notizen: '',
                purchaseId: p.id, marke: a[1], artikeltyp: a[2], groesse: a[3], beschreibung: a[1] + ' ' + a[2]
            });
        });

        [
            ['2026-05-05', 'Versandmaterial', 'Kartons und Versandtaschen', 24.9],
            ['2026-07-01', 'Versandmaterial', 'Versandtaschen', 18.5],
            ['2026-08-20', 'Bürobedarf', 'Etikettendrucker-Rollen', 12.99],
            ['2026-10-01', 'Versandmaterial', 'Kartons', 21.4]
        ].forEach(function (e) {
            Store.saveExpense({ datum: e[0], kategorie: e[1], beschreibung: e[2], betrag: e[3], ustSatz: 0, belegNr: '', lieferant: 'Musterhandel' });
        });
    }

    // ── 3. Grenze fuer neue Eintraege ──────────────────────────────────────────
    var neu = 0;
    var tiefe = 0; // Folge-Speicherungen (z. B. Verkauf aus Rechnung) zaehlen nicht extra

    function istNeu(fn, obj) {
        if (!obj || !obj.id) return true;
        var liste = fn === 'saveRechInvoice' ? Store.getRechInvoices(true)
            : fn === 'savePurchase' ? Store.getAllPurchasesRaw()
            : fn === 'saveExpense' ? Store.getAllExpensesRaw()
            : Store.getAllSalesRaw();
        return !liste.some(function (x) { return x && x.id === obj.id; });
    }

    ['savePurchase', 'saveSale', 'saveSaleMulti', 'saveExpense', 'saveRechInvoice'].forEach(function (fn) {
        var original = Store[fn];
        if (typeof original !== 'function') return;
        Store[fn] = function (obj) {
            if (!befuellen && tiefe === 0 && istNeu(fn, obj)) {
                if (neu >= GRENZE) {
                    grenzeErreicht();
                    return fn === 'saveRechInvoice' ? null : obj;
                }
                neu++;
                zeigeZaehler();
            }
            tiefe++;
            try { return original.apply(this, arguments); }
            finally { tiefe--; }
        };
    });

    // ── 4. Keine Exporte, Downloads, Druck ─────────────────────────────────────
    function nurVollversion(text) {
        if (typeof Utils !== 'undefined' && Utils.showToast) Utils.showToast(text + ' – in der Demo nicht verfügbar.', 'info');
    }
    window.print = function () { nurVollversion('Drucken'); };
    // Downloads laufen ueber <a download> (Blob-URLs) — abfangen, bevor der Browser sie startet.
    var klick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
        if (this.hasAttribute('download')) { nurVollversion('Exporte und Downloads'); return; }
        return klick.apply(this, arguments);
    };
    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[download]');
        if (a) { e.preventDefault(); e.stopPropagation(); nurVollversion('Exporte und Downloads'); }
    }, true);
    // Rechnungen druckt die App ueber ein eigenes iframe (Rechnung.printInvoiceWindow) - dessen
    // print() geht an window.print vorbei. Jedes neu eingehaengte iframe bekommt die Sperre mit.
    new MutationObserver(function (eintraege) {
        eintraege.forEach(function (e) {
            Array.prototype.forEach.call(e.addedNodes, function (n) {
                if (n.tagName === 'IFRAME' && n.contentWindow) n.contentWindow.print = function () { nurVollversion('Drucken und PDF'); };
            });
        });
    }).observe(document.documentElement, { childList: true, subtree: true });
    // Neue Fenster (PDF-Vorschau per window.open) nur ohne Inhalt der App.
    window.open = function () { nurVollversion('Diese Ansicht'); return null; };

    // ── 2. Nur drei Bereiche ───────────────────────────────────────────────────
    function sperreNavigation() {
        if (typeof App === 'undefined' || typeof App.navigate !== 'function' || App.__demoGesperrt) return;
        var nav = App.navigate;
        App.navigate = function (page) {
            if (!ERLAUBT[page]) { nurVollversion('Dieser Bereich'); page = 'dashboard'; arguments[0] = page; }
            return nav.apply(this, arguments);
        };
        App.__demoGesperrt = true;
    }
    // Startseite aus der Adresse (?page=) nur fuer erlaubte Bereiche.
    (function () {
        var q = new URLSearchParams(location.search);
        if (q.has('page') && !ERLAUBT[q.get('page')]) {
            q.delete('page');
            history.replaceState(history.state, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
        }
    })();

    // ── Hinweisleiste und Meldungen ─────────────────────────────────────────────
    function leiste() {
        var el = document.createElement('div');
        el.className = 'demo-leiste';
        el.setAttribute('role', 'note');
        el.innerHTML = '<span><strong>Demo</strong> mit Beispieldaten · nichts wird gespeichert · '
            + '<span class="demo-zaehler" id="demoZaehler">' + GRENZE + ' Einträge frei</span></span>'
            + '<a class="demo-cta" href="' + TEST_URL + '" target="_top">7 Tage kostenlos testen</a>';
        document.body.insertBefore(el, document.body.firstChild);
        document.documentElement.classList.add('ist-demo');
        // Eingebettet in die Landing steht der Test-Button schon direkt darueber.
        if (window.top !== window) document.documentElement.classList.add('ist-eingebettet');
    }

    function zeigeZaehler() {
        var el = document.getElementById('demoZaehler');
        if (el) el.textContent = Math.max(0, GRENZE - neu) + ' Einträge frei';
    }

    function grenzeErreicht() {
        if (typeof App !== 'undefined' && App.showModal) {
            App.showModal('Demo-Grenze erreicht',
                '<p>In der Demo kannst du bis zu ' + GRENZE + ' neue Einträge anlegen. '
                + 'Mit dem Testzugang arbeitest du ohne Grenze und deine Daten bleiben gespeichert.</p>',
                '<a class="btn btn-primary" href="' + TEST_URL + '" target="_top">7 Tage kostenlos testen</a>'
                + '<button class="btn" data-action="close-modal">Schließen</button>');
        } else {
            nurVollversion('Mehr Einträge');
        }
    }

    // ── Start ──────────────────────────────────────────────────────────────────
    try { musterdaten(); } finally { befuellen = false; }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', leiste);
    else leiste();

    // AppLoader steht erst nach diesem Skript bereit; dessen ready-Kette laeuft vor dem App-Start,
    // den js/app.js erst beim Laden der Module anhaengt.
    document.addEventListener('DOMContentLoaded', function () {
        if (window.AppLoader && AppLoader.ready) AppLoader.ready.then(sperreNavigation);
    });
    window.addEventListener('load', sperreNavigation);

    window.DemoModus = { GRENZE: GRENZE, ERLAUBT: ERLAUBT, frei: function () { return GRENZE - neu; } };
})();
