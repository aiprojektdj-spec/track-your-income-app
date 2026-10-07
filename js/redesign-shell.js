// Gemeinsame Oberfläche. Fachmodule, Authentifizierung und Schreibsperren bleiben
// die alleinigen Eigentümer ihrer Daten und Aktionen.
(function () {
    'use strict';

    var GROUPS = [
        { id: 'overview', label: 'Übersicht', page: 'dashboard', icon: 'ti-layout-dashboard' },
        { id: 'bookings', label: 'Buchungen', page: 'buchungen', icon: 'ti-arrows-exchange' },
        { id: 'invoices', label: 'Rechnungen', page: 'rechnungen', icon: 'ti-file-invoice' },
        { id: 'inventory', label: 'Lager', page: 'lager', icon: 'ti-package' },
        { id: 'tax', label: 'Steuern', page: 'euer', icon: 'ti-receipt-tax' },
        { id: 'reports', label: 'Auswertungen', page: 'statistiken', icon: 'ti-chart-line' }
    ];
    var ROUTES = {
        dashboard: ['overview', 'Übersicht'],
        buchungen: ['bookings', 'Alle Buchungen'],
        ausgaben: ['bookings', 'Ausgaben und Belege'],
        privatbuchungen: ['bookings', 'Privat'],
        bankimport: ['bookings', 'Bank importieren'],
        eigenbelege: ['bookings', 'Eigenbelege'],
        fahrtenbuch: ['bookings', 'Fahrtenbuch'],
        kassenbuch: ['bookings', 'Kassenbuch'],
        afa: ['bookings', 'Anschaffungen und Abschreibung'],
        rechnungen: ['invoices', 'Rechnungen'],
        lager: ['inventory', 'Artikel'],
        retouren: ['inventory', 'Retouren'],
        materiallager: ['inventory', 'Material'],
        euer: ['tax', 'Jahresgewinn'],
        ustvoranmeldung: ['tax', 'Umsatzsteuer melden'],
        steuertermine: ['tax', 'Termine'],
        vorsteuer: ['tax', 'Steuer aus Ausgaben'],
        oss: ['tax', 'EU-Verkäufe (OSS)'],
        gewerbesteuer: ['tax', 'Gewerbesteuer'],
        koerperschaftsteuer: ['tax', 'Körperschaftsteuer'],
        lohnsteuer: ['tax', 'Beschäftigte und Lohnsteuer'],
        ksk: ['tax', 'Kunst und Publizistik (KSK)'],
        statistiken: ['reports', 'Entwicklung'],
        bilanz: ['reports', 'Jahresabschluss'],
        steuerberater: ['reports', 'Steuerberater'],
        gbr: ['reports', 'Gesellschaft und Verteilung'],
        protokoll: ['reports', 'Änderungsprotokoll'],
        einstellungen: ['settings', 'Einstellungen'],
        rechtsform: ['settings', 'Rechtsform und Pflichten'],
        akademie: ['help', 'Hilfe und Akademie']
    };
    var SUBPAGES = {
        rechnungen: [
            ['dokumente', 'Dokumente'], ['kunden', 'Kunden'], ['produkte', 'Positionsvorlagen'],
            ['rech-dashboard', 'Rechnungsübersicht'], ['rechnung-neu', 'Rechnung schreiben', true],
            ['angebot-neu', 'Angebot erstellen', true], ['erechnung-empfang', 'E-Rechnung empfangen', true],
            ['mahnungen', 'Zahlungen und Mahnungen'], ['wiederkehrend', 'Wiederkehrend'],
            ['protokoll', 'Rechnungsprotokoll'], ['unternehmensdaten', 'Rechnungsangaben'],
            ['testrechnung', 'Testrechnung', true]
        ],
        eigenbelege: [
            ['alle', 'Alle Eigenbelege'], ['neu', 'Eigenbeleg erstellen', true], ['vorlagen', 'Vorlagen'],
            ['dashboard', 'Belegübersicht'], ['kategorien', 'Kategorien'], ['einstellungen', 'Eigenbeleg-Einstellungen']
        ],
        gbr: [
            ['uebersicht', 'Gewinnverteilung'], ['verrechnung', 'Verrechnungskonten'], ['feststellung', 'Feststellung'],
            ['gewerbesteuer', 'Gewerbesteuer der Gesellschaft'], ['stammdaten', 'Firma und Gesellschafter']
        ]
    };
    var SETTINGS_VIEWS = { rechnungen: ['unternehmensdaten'], eigenbelege: ['kategorien', 'einstellungen'], gbr: ['stammdaten'] };
    function isSettingsView(page, view) { return SETTINGS_VIEWS[page] && SETTINGS_VIEWS[page].indexOf(view) !== -1; }
    var initialized = false;
    var ready = false;
    var currentPage = 'dashboard';
    var currentSubpage = '';
    var historyIndex = 0;
    var historyStarted = false;
    var restoring = false;
    var restoringCancelledPop = false;
    var pendingView = '';
    var pendingProfile = '';
    var drawerOpen = false;
    var returnFocus = null;
    var inertNodes = [];
    var observer;
    var refreshQueued = false;
    var contextSignature = '';
    var standalone = (location.pathname.match(/\/(rechnungen|eigenbelege|lager)(?:\/|$)/) || [])[1] || '';
    var prefix = standalone ? '../' : '';
    var mobile = window.matchMedia('(max-width: 1023px)');

    function app() { return typeof App !== 'undefined' && App.pages ? App : null; }
    function esc(value) {
        return String(value).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function href(page, view) {
        return prefix + 'app.html?page=' + encodeURIComponent(page) + (view ? '&view=' + encodeURIComponent(view) : '');
    }
    function gateOpen() {
        return !!document.querySelector('#authLoadingOverlay, #whopLoginOverlay, #whopNoMemberOverlay, #whopDeviceLockOverlay');
    }
    function readonly() {
        if (typeof StbShare !== 'undefined' && StbShare.isReadonly) return StbShare.isReadonly();
        return typeof Store !== 'undefined' && Store._isReadonlyCompany ? Store._isReadonlyCompany() : false;
    }
    function available(page) {
        if (typeof Rechtsform === 'undefined') return true;
        var cfg = Rechtsform.getConfig();
        if (page === 'bilanz') return cfg.bilanzPflicht || cfg.bilanzOptional;
        if (['koerperschaftsteuer', 'lohnsteuer', 'privatbuchungen', 'ksk', 'gewerbesteuer'].indexOf(page) !== -1) return !!cfg[page];
        return true;
    }
    function activeSubpage() {
        if (currentPage === 'gbr' && typeof GbrModul !== 'undefined') return GbrModul._tab;
        if (currentPage !== 'rechnungen' && currentPage !== 'eigenbelege') return '';
        var attr = currentPage === 'rechnungen' ? 'data-rech-page' : 'data-eb-page';
        var source = document.querySelector('#rechSubnav [' + attr + '].active');
        if (source) return source.getAttribute('data-rech-page') || source.getAttribute('data-eb-page');
        if (standalone === 'rechnungen' || standalone === 'eigenbelege') {
            source = document.querySelector('.sr-legacy-nav .sidebar-link[data-page].active');
            if (source) return source.getAttribute('data-page');
        }
        return currentSubpage;
    }
    function routeLink(page, label, view) {
        var active = currentPage === page && (!view || currentSubpage === view);
        var profile = !available(page);
        return '<a class="sr-context-link' + (active ? ' active' : '') + '" href="' + href(page, view) +
            '" data-sr-page="' + page + '"' + (view ? ' data-sr-view="' + view + '"' : '') +
            (active ? ' aria-current="page"' : '') + '>' + esc(label) + (profile ? ' <span class="sr-profile-hint">(Profil prüfen)</span>' : '') + '</a>';
    }

    function init() {
        if (initialized) return;
        var sidebar = document.getElementById('sidebar');
        var main = document.querySelector('main.main-content');
        var topbar = document.querySelector('.topnav');
        if (!sidebar || !main || !topbar) return;
        initialized = true;
        document.body.classList.add('stackr-shell');
        currentPage = standalone || new URLSearchParams(location.search).get('page') || 'dashboard';
        if (!ROUTES[currentPage]) currentPage = 'dashboard';
        pendingView = new URLSearchParams(location.search).get('view') || '';

        // Alte IDs bleiben im DOM. Unsichtbare Hooks sind keine zweite Navigation.
        var legacy = document.createElement('div');
        legacy.className = 'sr-legacy-nav';
        legacy.hidden = true;
        while (sidebar.firstChild) legacy.appendChild(sidebar.firstChild);
        sidebar.appendChild(legacy);
        sidebar.classList.remove('collapsed', 'euer-hidden');
        sidebar.removeAttribute('style');
        sidebar.hidden = true;
        var panel = document.createElement('div');
        panel.id = 'stackrNavigationPanel';
        panel.className = 'sr-navigation-panel';
        panel.setAttribute('aria-label', 'Hauptnavigation');
        topbar.appendChild(panel);
        var close = document.createElement('button');
        close.id = 'stackrDrawerClose';
        close.className = 'sr-drawer-close';
        close.type = 'button';
        close.textContent = 'Menü schließen';
        close.addEventListener('click', function () { setDrawer(false); });
        panel.appendChild(close);
        var nav = document.createElement('nav');
        nav.id = 'stackrPrimaryNav';
        nav.className = 'sr-primary-nav';
        nav.setAttribute('aria-label', 'Arbeitsbereiche');
        nav.innerHTML = GROUPS.map(function (group) {
            return '<a class="sr-nav-link" href="' + href(group.page) + '" data-sr-page="' + group.page +
                '" data-sr-group="' + group.id + '"><i class="ti ' + group.icon + '" aria-hidden="true"></i><span>' + group.label + '</span></a>';
        }).join('');
        panel.appendChild(nav);
        var footer = document.createElement('div');
        footer.className = 'sr-nav-footer';
        footer.innerHTML = '<a class="sr-nav-link" href="' + href('einstellungen') + '" data-sr-page="einstellungen" data-sr-group="settings"><i class="ti ti-settings" aria-hidden="true"></i><span>Einstellungen</span></a>' +
            '<a class="sr-nav-link" href="' + href('akademie') + '" data-sr-page="akademie" data-sr-group="help"><i class="ti ti-help" aria-hidden="true"></i><span>Hilfe</span></a>';
        panel.appendChild(footer);
        footer.querySelectorAll('a').forEach(function (link) { link.title = link.textContent.trim(); });
        var status = legacy.querySelector('#storageStatus');
        if (status) { status.classList.add('sr-storage-status'); topbar.querySelector('.topnav-controls').appendChild(status); }

        ['topnavApps', 'moduleSubnav', 'rechSubnav', 'sidebarToggleBtn', 'mobileMenuBtn', 'settingsLink', 'backupLink', 'topnavNewInvoice', 'themeToggle', 'lagerKategorienBtn', 'lagerStatusBtn'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.hidden = true;
        });
        topbar.setAttribute('role', 'banner');
        topbar.removeAttribute('aria-label');
        var menu = document.createElement('button');
        menu.id = 'stackrMenuButton';
        menu.className = 'sr-menu-button';
        menu.type = 'button';
        menu.textContent = 'Menü';
        menu.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-controls', 'stackrNavigationPanel');
        menu.addEventListener('click', function () { setDrawer(!drawerOpen); });
        topbar.insertBefore(menu, topbar.firstChild);
        var context = document.createElement('nav');
        context.id = 'stackrContextNav';
        context.className = 'sr-context-nav';
        context.setAttribute('aria-label', 'Ansichten und Aufgaben');
        topbar.appendChild(context);
        if (!main.id) main.id = 'mainContent';
        main.tabIndex = -1;
        var skip = document.querySelector('.skip-link');
        if (!skip) {
            skip = document.createElement('a');
            skip.className = 'skip-link';
            skip.textContent = 'Zum Inhalt';
            document.body.insertBefore(skip, document.body.firstChild);
        }
        skip.href = '#' + main.id;
        var overlay = document.getElementById('mobileOverlay');
        if (overlay) overlay.addEventListener('click', function () { setDrawer(false); }, true);
        document.addEventListener('click', onClick);
        document.addEventListener('keydown', onKeydown, true);
        window.addEventListener('popstate', onPopstate);
        if (mobile.addEventListener) mobile.addEventListener('change', onBreakpoint);
        else mobile.addListener(onBreakpoint);
        onBreakpoint();

        observer = new MutationObserver(queueRefresh);
        ['content', 'rechSubnav'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) observer.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        });
        observer.observe(legacy, { subtree: true, attributes: true, attributeFilter: ['class'] });
        refresh();
    }

    function queueRefresh() {
        if (refreshQueued) return;
        refreshQueued = true;
        queueMicrotask(function () { refreshQueued = false; refresh(); });
    }
    function refresh() {
        if (!initialized) return;
        if (app()) currentPage = app().currentPage || currentPage;
        if (standalone && document.getElementById('content') && document.getElementById('content').children.length && !gateOpen()) ready = true;
        var previousSubpage = currentSubpage;
        currentSubpage = activeSubpage();
        if (ready && !pendingView && currentSubpage && previousSubpage !== currentSubpage) updateSubLocation(currentSubpage);
        var group = isSettingsView(currentPage, currentSubpage) ? 'settings' : (ROUTES[currentPage] ? ROUTES[currentPage][0] : 'overview');
        document.body.dataset.stackrArea = group;
        document.querySelectorAll('[data-sr-group]').forEach(function (el) {
            var active = el.dataset.srGroup === group;
            el.classList.toggle('active', active);
            if (active) el.setAttribute('aria-current', 'page');
            else el.removeAttribute('aria-current');
        });
        var sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('euer-hidden', 'collapsed');
        // Fachinterne Navigationsleisten gehen in dieselbe Kontextnavigation auf.
        document.querySelectorAll('#content [data-action="euer-set-view"], #content button[data-gbr-tab]').forEach(function (button) {
            button.parentElement.hidden = true;
            if (!button.parentElement.classList.contains('sr-legacy-nav')) button.parentElement.classList.add('sr-legacy-nav');
        });
        renderContext(currentPage);
        if (ready && standalone === 'lager' && !gateOpen()) {
            var settingsUrl = new URL(location.href);
            var management = settingsUrl.searchParams.get('verwaltung');
            var managementButton = document.getElementById(management === 'kategorien' ? 'lagerKategorienBtn' : management === 'status' ? 'lagerStatusBtn' : '');
            if (managementButton) {
                settingsUrl.searchParams.delete('verwaltung');
                history.replaceState(history.state, '', settingsUrl.pathname + settingsUrl.search);
                managementButton.click();
            }
        }
        var subpageReady = standalone || currentPage === 'gbr' || document.querySelector('#rechSubnav [' + (currentPage === 'rechnungen' ? 'data-rech-page' : 'data-eb-page') + ']');
        if (ready && subpageReady && pendingView && SUBPAGES[currentPage] && SUBPAGES[currentPage].some(function (item) { return item[0] === pendingView; })) {
            var view = pendingView;
            pendingView = '';
            navigateSubpage(view);
        }
    }

    function renderContext(page) {
        if (!initialized) init();
        currentPage = page;
        if (!initialized) return;
        var el = document.getElementById('stackrContextNav');
        var subpage = activeSubpage();
        var signature = [page, subpage, readonly(), ['bilanz', 'koerperschaftsteuer', 'lohnsteuer', 'privatbuchungen', 'ksk', 'gewerbesteuer'].map(available).join(',')].join('|');
        if (signature === contextSignature) return;
        contextSignature = signature;
        currentSubpage = subpage;
        var links = [];
        if (isSettingsView(page, subpage)) {
            links.push(routeLink('einstellungen', 'Alle Einstellungen'));
            var setting = SUBPAGES[page].find(function (item) { return item[0] === subpage; });
            links.push(routeLink(page, setting[1], subpage));
        } else if (SUBPAGES[page]) {
            if (page === 'eigenbelege') links.push(routeLink('buchungen', 'Alle Buchungen'));
            SUBPAGES[page].forEach(function (item) {
                if (!isSettingsView(page, item[0]) && (!item[2] || !readonly())) links.push(routeLink(page, item[1], item[0]));
            });
            if (page === 'gbr') links.push(routeLink('statistiken', 'Entwicklung'), routeLink('steuerberater', 'Steuerberater'), routeLink('protokoll', 'Änderungsprotokoll'));
        } else if (page !== 'einstellungen' && ROUTES[page] && ROUTES[page][0] !== 'overview' && ROUTES[page][0] !== 'help') {
            var group = ROUTES[page][0];
            Object.keys(ROUTES).filter(function (key) { return ROUTES[key][0] === group; }).sort(function (a, b) {
                return Number(available(b)) - Number(available(a));
            }).forEach(function (key) {
                links.push(routeLink(key, ROUTES[key][1]));
            });
            // Die eigenständige Lagerseite besitzt zusätzliche Importe und Mehrfacherfassung.
            if (group === 'inventory') {
                if (standalone === 'lager') {
                    links.push('<a class="sr-context-link" href="#buchungenTabContent" data-sr-local="sidebarBuchungen">Verkäufe buchen</a>');
                    [['sidebarBulkEinkauf', 'Mehrere Artikel einkaufen'], ['sidebarExcelImport', 'Artikel importieren'], ['sidebarSalesImport', 'Plattformverkäufe importieren']].forEach(function (item) {
                        if (!readonly()) links.push('<button class="sr-context-link" type="button" data-sr-local="' + item[0] + '">' + item[1] + '</button>');
                    });
                } else {
                    links.push('<a class="sr-context-link" href="lager/index.html">Importe und Mehrfacherfassung</a>');
                }
            }
        }
        var visible = links.slice(0, 3);
        // Die aktive Aufgabe bleibt sichtbar; das Menü verdeckt keinen Seiteninhalt.
        var activeLink = links.find(function (link) { return link.indexOf('aria-current="page"') !== -1; });
        if (activeLink && visible.indexOf(activeLink) === -1) visible[2] = activeLink;
        var extra = links.filter(function (link) { return visible.indexOf(link) === -1; });
        el.innerHTML = links.length ? '<div class="sr-context-tabs">' + visible.join('') + '</div>' +
            (extra.length ? '<details class="sr-more-tasks"><summary aria-label="Mehr Aufgaben">Mehr</summary><div class="sr-task-links">' + extra.join('') + '</div></details>' : '') : '';
        el.hidden = !links.length;
    }

    function onClick(event) {
        document.querySelectorAll('.sr-more-tasks[open], .sr-nav-tools[open]').forEach(function (details) {
            if (!details.contains(event.target)) details.open = false;
        });
        var target = event.target.closest('[data-sr-page], [data-sr-tool], [data-sr-local]');
        if (!target || event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if (gateOpen()) { event.preventDefault(); return; }
        var page = target.dataset.srPage;
        var view = target.dataset.srView;
        if (target.dataset.srTool && app()) {
            event.preventDefault();
            if (!ready) return;
            setDrawer(false);
            if (target.dataset.srTool === 'profile') {
                app().closeModal();
                app().navigate('rechtsform');
            } else if (target.dataset.srTool === 'settings') app().showSettingsModal();
            else app().showBackupModal();
            return;
        }
        if (target.dataset.srLocal) {
            event.preventDefault();
            if (!ready) return;
            setDrawer(false);
            var source = document.getElementById(target.dataset.srLocal);
            if (source) source.click();
            return;
        }
        if (!page) return;
        if (standalone === page && view) {
            event.preventDefault();
            if (ready) navigateSubpage(view);
            return;
        }
        if (standalone === 'lager' && page === 'lager' && typeof LagerPage !== 'undefined') {
            event.preventDefault();
            if (ready) LagerPage.switchTab('lager');
            setDrawer(false);
            return;
        }
        if (app()) {
            event.preventDefault();
            if (!ready) return;
            if (!available(page)) { showProfileHint(page); return; }
            if (page === currentPage) {
                if (view) navigateSubpage(view);
                setDrawer(false);
                return;
            }
            pendingView = view || '';
            app().navigate(page); // Einschließlich bestehender Dirty-Guards und Leave-Hooks.
            if (app().currentPage !== page) pendingView = '';
        }
    }

    function navigateSubpage(view) {
        if (gateOpen() || !ready) return;
        var previous = activeSubpage();
        if (currentPage === 'rechnungen' && typeof RechApp !== 'undefined') RechApp.navigate(view);
        if (currentPage === 'eigenbelege' && typeof EBApp !== 'undefined') EBApp.navigate(view);
        if (currentPage === 'gbr') {
            var source = document.querySelector('#content button[data-gbr-tab="' + view + '"]');
            if (source) source.click();
        }
        currentSubpage = activeSubpage();
        if (currentSubpage === view && currentSubpage !== previous) updateSubLocation(view);
        setDrawer(false);
        refresh();
    }

    function syncLocation(page) {
        var url = new URL(location.href);
        var first = !historyStarted;
        var oldPage = url.searchParams.get('page') || 'dashboard';
        var previousView = url.searchParams.get('view');
        if (first && ROUTES[oldPage] && !available(oldPage) && oldPage !== page) pendingProfile = oldPage;
        url.searchParams.set('page', page);
        if (page !== oldPage) url.searchParams.delete('view');
        if (first && oldPage === page && previousView) pendingView = previousView;
        if (!restoring) {
            if (!first && page !== oldPage) historyIndex++;
            var method = !first && page !== oldPage ? 'pushState' : 'replaceState';
            try { history[method]({ page: page, stackrIndex: historyIndex }, '', url.pathname + url.search + url.hash); } catch (e) { /* file:// ohne History-API */ }
        }
        historyStarted = true;
        currentPage = page;
        if (page === 'euer' && typeof Euer !== 'undefined') Euer._view = 'report';
        if (page !== oldPage) currentSubpage = '';
        document.title = 'Stackr — ' + (ROUTES[page] ? ROUTES[page][1] : page);
    }
    function updateSubLocation(view) {
        var url = new URL(location.href);
        url.searchParams.set('view', view);
        if (!standalone) url.searchParams.set('page', currentPage);
        try { history.replaceState(Object.assign({}, history.state, { view: view }), '', url.pathname + url.search + url.hash); } catch (e) { /* optional */ }
    }
    function onPopstate(event) {
        if (restoringCancelledPop) { restoringCancelledPop = false; return; }
        if (!app() || !ready || gateOpen()) return;
        var url = new URL(location.href);
        var page = url.searchParams.get('page') || 'dashboard';
        if (!app().pages[page]) page = 'dashboard';
        var nextIndex = event.state && Number.isInteger(event.state.stackrIndex) ? event.state.stackrIndex : 0;
        restoring = true;
        pendingView = url.searchParams.get('view') || '';
        app().navigate(page);
        restoring = false;
        if (app().currentPage !== page) {
            pendingView = '';
            if (historyIndex !== nextIndex) {
                restoringCancelledPop = true;
                history.go(historyIndex - nextIndex);
            }
        } else historyIndex = nextIndex;
    }
    function afterRender(page) {
        ready = true;
        currentPage = page;
        setDrawer(false);
        refresh();
        if (window.RedesignBookings) RedesignBookings.afterRender(page);
        if (pendingProfile) {
            var profilePage = pendingProfile;
            pendingProfile = '';
            showProfileHint(profilePage);
        }
        var params = new URLSearchParams(location.search);
        if (params.get('openSettings') === '1' && app()) {
            params.delete('openSettings');
            history.replaceState(history.state, '', location.pathname + '?' + params.toString());
            app().navigate('einstellungen');
        }
    }

    function showProfileHint(page) {
        if (!app()) return;
        setDrawer(false);
        app().showModal('Firmenprofil prüfen', '<p>„' + esc(ROUTES[page][1]) + '“ ist für das derzeit bestätigte Firmenprofil nicht freigeschaltet.</p>' +
            '<p>Vorhandene Daten bleiben erhalten. Prüfe die Rechtsform und die Angaben zur Firma, bevor du diesen Bereich verwendest.</p>',
            '<button class="btn btn-secondary" type="button" data-action="close-modal">Schließen</button>' +
            '<button class="btn btn-primary" type="button" data-sr-tool="profile">Firmenprofil prüfen</button>');
    }

    function onBreakpoint() {
        setDrawer(false, false);
        var sidebar = document.getElementById('stackrNavigationPanel');
        if (sidebar) sidebar.inert = mobile.matches;
    }
    function setDrawer(open, focus) {
        var sidebar = document.getElementById('stackrNavigationPanel');
        var button = document.getElementById('stackrMenuButton');
        var overlay = document.getElementById('mobileOverlay');
        if (!sidebar || !button) return;
        open = !!open && mobile.matches;
        var wasOpen = drawerOpen;
        drawerOpen = open;
        sidebar.classList.toggle('sr-navigation-open', open);
        sidebar.inert = mobile.matches && !open;
        document.body.classList.toggle('sr-drawer-open', open);
        button.setAttribute('aria-expanded', String(open));
        if (overlay) overlay.classList.toggle('active', open);
        if (open) {
            sidebar.setAttribute('role', 'dialog');
            sidebar.setAttribute('aria-modal', 'true');
            if (!wasOpen) {
                returnFocus = document.activeElement;
                inertNodes = Array.from(document.body.children).filter(function (node) {
                    return node !== sidebar && !node.contains(sidebar) && !node.contains(overlay) && node.tagName !== 'SCRIPT' && !node.inert;
                });
                Array.from(sidebar.parentElement.children).forEach(function (node) { if (node !== sidebar && !node.inert) inertNodes.push(node); });
                inertNodes.forEach(function (node) { node.inert = true; });
                // Der Overlay-Container enthält den Hauptinhalt; dieser wird separat gesperrt.
                var main = document.querySelector('main.main-content');
                if (main && !main.inert) { main.inert = true; inertNodes.push(main); }
                document.getElementById('stackrDrawerClose').focus();
            }
        } else {
            sidebar.removeAttribute('role');
            sidebar.removeAttribute('aria-modal');
            inertNodes.forEach(function (node) { node.inert = false; });
            inertNodes = [];
            if (wasOpen && focus !== false && returnFocus && returnFocus.isConnected) returnFocus.focus();
            returnFocus = null;
        }
    }
    function onKeydown(event) {
        if (!drawerOpen) {
            if (event.key === 'Escape') {
                var details = document.querySelector('.sr-more-tasks[open], .sr-nav-tools[open]');
                if (details) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    details.open = false;
                    details.querySelector('summary').focus();
                }
            }
            return;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            setDrawer(false);
        } else if (event.key === 'Tab') {
            var sidebar = document.getElementById('stackrNavigationPanel');
            var items = Array.from(sidebar.querySelectorAll('a[href], button, summary, [tabindex="0"]')).filter(function (node) {
                return !node.disabled && node.getClientRects().length > 0 && !node.closest('[hidden]');
            });
            if (!items.length) { event.preventDefault(); return; }
            var first = items[0], last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    }

    window.RedesignShell = { init: init, refresh: refresh, renderContext: renderContext, syncLocation: syncLocation, afterRender: afterRender, closeDrawer: function () { setDrawer(false); } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
