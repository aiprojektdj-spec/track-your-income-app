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
                        'data-rech-page="' + p.page + '" data-action="rech-navigate">' +
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
        html += '<h3 id="modalTitle">' + title + '</h3>';
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

        var focusable = modal.querySelector('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])');
        if (focusable) focusable.focus();
    }

    function closeModal() {
        var overlay = document.getElementById('modalOverlay');
        if (overlay) overlay.classList.remove('active');
        document.getElementById('modal').innerHTML = '';
    }

    // Fokus-Trap (Tab bleibt im Modal) + ESC schließt (WCAG 2.4.3/2.1.2)
    document.addEventListener('keydown', function(e) {
        var overlay = document.getElementById('modalOverlay');
        var modalOpen = overlay && overlay.classList.contains('active');
        if (!modalOpen) return;
        var modal = document.getElementById('modal');
        if (e.key === 'Tab') {
            var focusables = modal.querySelectorAll('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])');
            if (!focusables.length) return;
            var first = focusables[0], last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        } else if (e.key === 'Escape') {
            closeModal();
        }
    });

    function closeMobileMenu() {
        var sidebar = document.getElementById('sidebar');
        var overlay = document.getElementById('mobileOverlay');
        if (sidebar) sidebar.classList.remove('sidebar-open');
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
                <p>Diese Nutzungsbedingungen gelten für die Nutzung der Software <strong>„Stackr"</strong> (nachfolgend „Software"). Mit der Nutzung der Software erklären Sie sich mit diesen Bedingungen einverstanden.</p>

                <h3>§ 2 Haftungsausschluss</h3>
                <p>Die Software wird <strong>„wie besehen" (as-is)</strong> ohne jegliche ausdrückliche oder stillschweigende Gewährleistung bereitgestellt. Der Entwickler übernimmt <strong>keinerlei Haftung</strong> für:</p>
                <ul>
                    <li>Fehler, Ungenauigkeiten oder Auslassungen in Berechnungen (EÜR, Steuerbeträge, Margen, Gewinne)</li>
                    <li>Datenverluste durch Browserabsturz, Cache-Löschung oder technische Fehler</li>
                    <li>Steuerliche oder rechtliche Nachteile, die aus der Nutzung der Software entstehen</li>
                    <li>Fehlbedienungen oder Fehler durch den Nutzer</li>
                    <li>Ausfälle, Bugs oder sonstige technische Störungen</li>
                </ul>

                <h3>§ 3 Kein steuerlicher oder rechtlicher Rat</h3>
                <p>Die Software ersetzt <strong>keinen professionellen Steuerberater</strong> und stellt keine steuerliche oder rechtliche Beratung dar. Alle durch die Software erzeugten Auswertungen (insbesondere EÜR, Gewinnberechnungen) sind <strong>unverbindliche Hilfsmittel</strong> und müssen vor Abgabe an Finanzbehörden durch einen qualifizierten Steuerberater oder Buchhalter geprüft werden.</p>

                <h3>§ 4 Datenspeicherung</h3>
                <p>Daten werden <strong>ausschließlich lokal im Browser</strong> gespeichert (IndexedDB / localStorage) und nicht an Server des Anbieters oder Dritter übertragen. Der Nutzer ist selbst für regelmäßige Backups verantwortlich. Der Entwickler übernimmt keine Haftung für Datenverlust.</p>

                <h3>§ 5 GoBD-Konformität</h3>
                <p>Die Software enthält Funktionen zur Unterstützung der GoBD-Konformität (Protokollierung, Stornierung, Prüfsummen). Der Entwickler übernimmt jedoch <strong>keine Garantie</strong>, dass die Software den jeweils geltenden steuerrechtlichen Anforderungen vollständig entspricht. Die Prüfung der steuerrechtlichen Anforderungen obliegt dem Nutzer.</p>

                <h3>§ 6 Nutzung auf eigene Gefahr</h3>
                <p>Die Nutzung der Software erfolgt <strong>vollständig auf eigenes Risiko</strong> des Nutzers. Der Entwickler haftet nicht für direkte, indirekte, zufällige, besondere oder Folgeschäden, die aus der Nutzung oder der Unfähigkeit zur Nutzung der Software entstehen.</p>

                <h3>§ 7 Änderungen</h3>
                <p>Der Entwickler behält sich das Recht vor, diese Nutzungsbedingungen jederzeit zu ändern. Bei wesentlichen Änderungen wird erneut um Zustimmung gebeten.</p>

                <h3>§ 8 Schlussbestimmungen</h3>
                <p>Es gilt deutsches Recht. Sollten einzelne Bestimmungen dieser Bedingungen unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</p>
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
                    <button class="btn btn-primary" style="margin-top:24px;" data-action="reload">Seite neu laden</button>
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

        // Mobile menu — Toggle-Button selbst wird global von page-shell.js (#sidebarToggleBtn)
        // gesteuert; hier nur noch das Schließen per Overlay-Klick (legacy #mobileMenuBtn entfernt,
        // war ein zweiter, redundanter Toggle-Mechanismus, Fund 24 Vollaudit 2026-07-23).
        var mobileOverlay = document.getElementById('mobileOverlay');

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
        // Whop-Gate: erst nach gültiger Membership booten (standalone-Seite hatte bisher keinen Check)
        if (typeof AuthUI !== 'undefined' && AuthUI.boot) {
            window.App = window.App || {};
            App._continueAfterAuth = boot;
            AuthUI.boot();
        } else {
            // Fail-Closed statt Fail-Open: AuthUI-Script konnte nicht laden (Netzwerk/CDN-Fehler)
            // -> NICHT ungeprüft booten (Fund 21, Vollaudit 2026-07-23), sondern Fehler anzeigen.
            var showGateError = function () {
                document.body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center;padding:40px;font-family:sans-serif;">' +
                    '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>' +
                    '<h2>Anmeldung konnte nicht geladen werden</h2>' +
                    '<p style="color:#888;max-width:420px;">Ein Skript zur Zugriffsprüfung ist nicht geladen. Bitte Seite neu laden oder Internetverbindung prüfen.</p>' +
                    '<button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;border-radius:8px;border:none;background:#4f46e5;color:#fff;cursor:pointer;">Seite neu laden</button>' +
                    '</div>';
            };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', showGateError);
            } else {
                showGateError();
            }
        }
    }

    return {
        navigate: navigate,
        showModal: showModal,
        closeModal: closeModal,
        mount: mount
    };
})();

// ── Delegierte Handler: data-action/data-uppercase statt Inline-Attribute (CSP) ──
// Dokument-weit, überlebt innerHTML-Rerenders der Modals/Subnav.
document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    switch (el.dataset.action) {
        case 'rech-close-modal': RechApp.closeModal(); break;
        case 'rech-navigate':    RechApp.navigate(el.getAttribute('data-rech-page')); break;
        case 'reload':           location.reload(); break;
    }
});
document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.matches && el.matches('input[data-uppercase]')) el.value = el.value.toUpperCase();
});
