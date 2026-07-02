var RechApp = (function() {

    var currentPage = 'rech-dashboard';
    var currentParams = {};

    var pageMap = {
        'rech-dashboard':    RechDashboard,
        'rechnung-neu':      Rechnung,
        'angebot-neu':       Rechnung,
        'rechnung-edit':     Rechnung,
        'dokumente':         Dokumente,
        'erechnung-empfang': ERechnungImport,
        'kunden':            Kunden,
        'produkte':          Produkte,
        'mahnungen':         Mahnungen,
        'protokoll':         RechProtokoll,
        'testrechnung':      TestRechnung,
        'unternehmensdaten': Unternehmensdaten,
        'wiederkehrend':     Wiederkehrend,
    };

    // Embedded-Modus (in app.html eingebettet als Finanzen-Sub-Tab):
    // RechApp-Nav wird zweite Sub-Nav-Zeile (#rechSubnav) statt eigener Sidebar.
    var NAV_PAGES = [
        { page:'rech-dashboard',    icon:'ti-layout-dashboard', label:'Dashboard' },
        { page:'rechnung-neu',      icon:'ti-plus',             label:'Neue Rechnung' },
        { page:'angebot-neu',       icon:'ti-file-text',        label:'Neues Angebot' },
        { page:'dokumente',         icon:'ti-folder',           label:'Dokumente' },
        { page:'erechnung-empfang', icon:'ti-file-download',    label:'E-Rechnung' },
        { page:'kunden',            icon:'ti-users',            label:'Kunden' },
        { page:'produkte',          icon:'ti-package',          label:'Produkte' },
        { page:'mahnungen',         icon:'ti-alert-triangle',   label:'Mahnungen' },
        { page:'wiederkehrend',     icon:'ti-repeat',           label:'Wiederkehrend' },
        { page:'protokoll',         icon:'ti-notebook',         label:'Protokoll' },
        { page:'unternehmensdaten', icon:'ti-building',         label:'Unternehmensdaten' },
    ];

    function renderSubnav() {
        var el = document.getElementById('rechSubnav');
        if (!el) return;
        el.innerHTML =
            '<div class="module-subnav-inner">' +
                '<div class="module-subnav-title"><i class="ti ti-file-invoice"></i> Rechnungen</div>' +
                '<div class="module-subnav-tabs">' +
                NAV_PAGES.map(function (p) {
                    return '<button class="msub-tab' + (p.page === currentPage ? ' active' : '') + '" type="button" ' +
                        'data-rech-page="' + p.page + '" onclick="RechApp.navigate(\'' + p.page + '\')">' +
                        '<i class="ti ' + p.icon + '"></i><span>' + p.label + '</span></button>';
                }).join('') +
                '</div>' +
            '</div>';
    }

    // Einstieg aus der Haupt-App (statt boot()): Daten-Setup ohne Standalone-Sidebar.
    function mount() {
        if (typeof CompanyManager !== 'undefined') {
            var activeId = CompanyManager.getActiveId();
            if (activeId) Store.setCompany(activeId);
        }
        if (Store.autoSyncInvoices) Store.autoSyncInvoices();
        checkOverdueInvoices();
        if (typeof Wiederkehrend !== 'undefined') {
            setTimeout(function () { Wiederkehrend.processDueRules(); }, 500);
        }
        renderSubnav();
        navigate('rech-dashboard');
    }

    function navigate(page, params) {
        params = params || {};
        currentPage = page;
        currentParams = params;

        var module = pageMap[page];
        if (!module) {
            document.getElementById('content').innerHTML = '<div class="empty-state">Seite nicht gefunden.</div>';
            return;
        }

        // Set params based on page
        var renderParams = Object.assign({}, params);
        if (page === 'rechnung-neu') {
            renderParams.typ = 'rechnung';
        } else if (page === 'angebot-neu') {
            renderParams.typ = 'angebot';
        }

        // Reset views if needed
        if (page === 'kunden' && Kunden.resetView && !params.keepView) {
            Kunden.resetView();
        }

        var content = document.getElementById('content');
        content.innerHTML = module.render(renderParams);
        module.init(renderParams);

        // Update sidebar active state
        document.querySelectorAll('.sidebar-link').forEach(function(link) {
            link.classList.remove('active');
            var linkPage = link.getAttribute('data-page');
            if (linkPage === page) {
                link.classList.add('active');
            }
            // Highlight parent for edit pages
            if (page === 'rechnung-edit' && linkPage === 'dokumente') {
                link.classList.add('active');
            }
        });

        // Embedded-Strip Active-State (#rechSubnav) — nur im eingebetteten Modus vorhanden
        document.querySelectorAll('#rechSubnav [data-rech-page]').forEach(function (b) {
            var p = b.getAttribute('data-rech-page');
            b.classList.toggle('active', p === page || (page === 'rechnung-edit' && p === 'dokumente'));
        });

        // Close mobile menu
        closeMobileMenu();

        // Scroll to top
        content.scrollTop = 0;
        window.scrollTo(0, 0);
    }

    function showModal(title, bodyHtml, footerHtml) {
        var modal = document.getElementById('modal');
        var overlay = document.getElementById('modalOverlay');

        var html = '<div class="modal-header">';
        html += '<h3>' + title + '</h3>';
        html += '<button class="modal-close" id="modalCloseBtn">&times;</button>';
        html += '</div>';
        html += '<div class="modal-body">' + bodyHtml + '</div>';
        if (footerHtml) {
            html += '<div class="modal-footer">' + footerHtml + '</div>';
        }

        modal.innerHTML = html;
        overlay.classList.add('active');

        document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeModal();
        });
    }

    function closeModal() {
        var overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.remove('active');
        document.getElementById('modal').innerHTML = '';
    }

    function closeMobileMenu() {
        var sidebar = document.getElementById('sidebar');
        var overlay = document.getElementById('mobileOverlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }

    function checkOverdueInvoices() {
        var invoices = Store.getRechInvoices();
        var today = Utils.todayISO();
        var changed = false;
        invoices.forEach(function(inv) {
            if (inv.status === 'offen' && inv.faelligkeit && inv.faelligkeit < today && inv.typ === 'rechnung') {
                inv.status = 'ueberfaellig';
                Store.saveRechInvoice(inv);
                changed = true;
            }
        });
        return changed;
    }

    function showAgbModal(onAccept) {
        var overlay = document.getElementById('modalOverlay');
        var modal = document.getElementById('modal');
        modal.innerHTML = `
            <div class="agb-modal-header">
                <div style="font-size:28px;margin-bottom:8px;">📋</div>
                <h2 style="margin:0 0 4px 0;font-size:20px;">Nutzungsbedingungen</h2>
                <p style="margin:0;color:var(--text-secondary);font-size:13px;">Bitte lesen und akzeptieren Sie vor der ersten Nutzung</p>
            </div>
            <div class="agb-scroll-box">
                <h3>§ 1 Geltungsbereich</h3>
                <p>Diese Nutzungsbedingungen gelten für die Nutzung der Software <strong>„Reselling Tool / Rechnungsbuch"</strong>. Mit der Nutzung erklären Sie sich mit diesen Bedingungen einverstanden.</p>
                <h3>§ 2 Haftungsausschluss</h3>
                <p>Die Software wird <strong>„wie besehen" (as-is)</strong> bereitgestellt. Der Entwickler übernimmt <strong>keinerlei Haftung</strong> für Fehler in Berechnungen, Datenverluste, steuerliche oder rechtliche Nachteile, Fehlbedienungen oder technische Störungen.</p>
                <h3>§ 3 Kein steuerlicher Rat</h3>
                <p>Die Software ersetzt <strong>keinen Steuerberater</strong>. Alle Auswertungen (EÜR etc.) sind unverbindliche Hilfsmittel und müssen vor Abgabe an Finanzbehörden durch einen qualifizierten Steuerberater geprüft werden.</p>
                <h3>§ 4 Datenspeicherung</h3>
                <p>Alle Daten werden ausschließlich <strong>lokal im Browser</strong> gespeichert. Keine Übertragung an externe Server. Der Nutzer ist für die Datensicherung verantwortlich.</p>
                <h3>§ 5 GoBD</h3>
                <p>Der Entwickler übernimmt <strong>keine Garantie</strong>, dass die Software den jeweils geltenden steuerrechtlichen Anforderungen vollständig entspricht.</p>
                <h3>§ 6 Nutzung auf eigene Gefahr</h3>
                <p>Die Nutzung erfolgt <strong>vollständig auf eigenes Risiko</strong>. Der Entwickler haftet nicht für direkte oder indirekte Schäden aus der Nutzung.</p>
            </div>
            <div class="agb-modal-footer">
                <label class="agb-checkbox-label">
                    <input type="checkbox" id="agbCheckbox">
                    <span>Ich habe die Nutzungsbedingungen gelesen und akzeptiere diese vollständig.</span>
                </label>
                <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">
                    <button class="btn btn-danger" id="agbDeclineBtn">Ablehnen</button>
                    <button class="btn btn-primary" id="agbAcceptBtn" disabled>Akzeptieren &amp; Starten</button>
                </div>
            </div>
        `;
        overlay.classList.add('active');

        document.getElementById('agbCheckbox').addEventListener('change', function() {
            document.getElementById('agbAcceptBtn').disabled = !this.checked;
        });
        document.getElementById('agbAcceptBtn').addEventListener('click', function() {
            localStorage.setItem('agb_accepted', new Date().toISOString());
            overlay.classList.remove('active');
            onAccept();
        });
        document.getElementById('agbDeclineBtn').addEventListener('click', function() {
            overlay.classList.remove('active');
            document.getElementById('content').innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:80vh;text-align:center;padding:40px;">
                    <div style="font-size:48px;margin-bottom:16px;">🚫</div>
                    <h2>Nutzung nicht möglich</h2>
                    <p style="color:var(--text-secondary);">Die Nutzung ist nur nach Akzeptanz der Nutzungsbedingungen möglich.</p>
                    <button class="btn btn-primary" style="margin-top:24px;" onclick="location.reload()">Seite neu laden</button>
                </div>`;
        });
    }

    function initApp() {
        // AGB-Pruefung (geteilte Akzeptanz mit Reselling Tool ueber localStorage)
        if (!localStorage.getItem('agb_accepted')) {
            showAgbModal(function() { initApp(); });
            return;
        }

        // Bezahlte Rechnungen automatisch synchronisieren
        Store.autoSyncInvoices();

        // Theme initialization
        var theme = localStorage.getItem('app_theme') || 'dark';
        if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');

        var themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = theme === 'light' ? '\u2600\uFE0F Light Mode' : '\uD83C\uDF19 Dark Mode';
            themeToggle.addEventListener('click', function() {
                var current = document.documentElement.getAttribute('data-theme');
                var newTheme = current === 'light' ? 'dark' : 'light';
                if (newTheme === 'light') {
                    document.documentElement.setAttribute('data-theme', 'light');
                } else {
                    document.documentElement.removeAttribute('data-theme');
                }
                localStorage.setItem('app_theme', newTheme);
                themeToggle.textContent = newTheme === 'light' ? '\u2600\uFE0F Light Mode' : '\uD83C\uDF19 Dark Mode';
            });
        }

        // Check overdue invoices on load
        checkOverdueInvoices();

        // Auto-process due recurring invoices
        if (typeof Wiederkehrend !== 'undefined') {
            setTimeout(function() { Wiederkehrend.processDueRules(); }, 500);
        }

        // Sidebar navigation
        document.querySelectorAll('.sidebar-link').forEach(function(link) {
            link.addEventListener('click', function() {
                var page = this.getAttribute('data-page');
                if (page) navigate(page);
            });
        });

        // Mobile menu
        var menuBtn = document.getElementById('mobileMenuBtn');
        var sidebar = document.getElementById('sidebar');
        var mobileOverlay = document.getElementById('mobileOverlay');

        if (menuBtn) {
            menuBtn.addEventListener('click', function() {
                sidebar.classList.toggle('open');
                mobileOverlay.classList.toggle('active');
            });
        }

        if (mobileOverlay) {
            mobileOverlay.addEventListener('click', closeMobileMenu);
        }

        // Navigate to dashboard
        navigate('rech-dashboard');
    }

    // Initialize on DOM ready — IndexedDB MUSS vor allem anderen fertig sein,
    // sonst sind _cache leer und alle Daten gehen nach Reload verloren.
    // initWithRecovery() erkennt Datenverlust und stellt automatisch wieder her.
    function boot() {
        // Aktive Firma setzen — MUSS vor initWithRecovery() passieren,
        // damit der richtige namespace-Prefix für alle Datenzugriffe gilt.
        if (typeof CompanyManager !== 'undefined') {
            var activeId = CompanyManager.getActiveId();
            if (activeId) Store.setCompany(activeId);
        }

        Store.initWithRecovery().then(({ lossDetected, recovered }) => {
            initApp();
            if (lossDetected && recovered) {
                setTimeout(() => {
                    const ts = recovered.ts ? new Date(recovered.ts).toLocaleString('de-DE') : '';
                    Utils.showToast(
                        `⚠️ Daten aus Backup (${recovered.source}${ts ? ' · ' + ts : ''}) wiederhergestellt`,
                        'warning'
                    );
                }, 1000);
            } else if (lossDetected && !recovered) {
                setTimeout(() => {
                    Utils.showToast('❌ Datenverlust erkannt — kein Backup gefunden. Bitte Hauptapp öffnen.', 'error');
                }, 1000);
            }
        });

        // Session-Ende: Datei-Backup erzwingen
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && Store.getFsBackupFolderName()) {
                Store.writeFileSystemBackup('session_end_rech');
            }
        });
    }

    // Eingebettet in Haupt-App (app.html hat #moduleSubnav) → NICHT auto-booten;
    // Haupt-App ruft RechApp.mount(). Standalone-Seite → boot() wie gehabt.
    var EMBEDDED = !!document.getElementById('moduleSubnav');
    if (!EMBEDDED) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', boot);
        } else {
            boot();
        }
    }

    return {
        navigate: navigate,
        showModal: showModal,
        closeModal: closeModal,
        mount: mount
    };
})();
