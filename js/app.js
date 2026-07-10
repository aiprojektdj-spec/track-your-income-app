// ============================================
// App - Router, Onboarding, Settings, Backup
// ============================================
const App = {
    currentPage: 'dashboard',
    APP_VERSION: '1.7',  // ← bei jedem Update hier UND in index.html anpassen

    // Finanzen-Modul: alle transaktionalen Seiten, die sich die Sub-Nav teilen.
    // Reihenfolge = Reihenfolge der Sub-Tabs.
    FINANZ_PAGES: ['rechnungen', 'eigenbelege', 'buchungen', 'ausgaben', 'bankimport', 'fahrtenbuch', 'afa'],

    pages: {
        dashboard: Dashboard,
        buchungen: Buchungen,
        lager: Lager,
        euer: Euer,
        ausgaben: Ausgaben,
        statistiken: Statistiken,
        protokoll: Protokoll,
        retouren: Retouren,
        fahrtenbuch: Fahrtenbuch,
        kassenbuch: Kassenbuch,
        steuertermine: Steuertermine,
        materiallager: Materiallager,
        akademie: Akademie,
        gbr: GbrModul,
        afa: Afa,
        privatbuchungen: Privatbuchungen,
        ustvoranmeldung: UstVoranmeldung,
        ksk: Ksk,
        bankimport: BankImport,
        steuerberater: Steuerberater,
        vorsteuer: Vorsteuer,
        oss: OSS,
        koerperschaftsteuer: Koerperschaftsteuer,
        bilanz: Bilanz,
        rechtsform: Rechtsform,
        lohnsteuer: Lohnsteuer,
        gewerbesteuer: Gewerbesteuer,
        schweiz: Schweiz,
        oesterreich: Oesterreich,
        // Eingebettete Rechnungen-Sub-App — bootet via RechApp.mount() in #content
        rechnungen: {
            render() { return '<div id="rechMount"></div>'; },
            init() { if (typeof RechApp !== 'undefined' && RechApp.mount) RechApp.mount(); }
        },
        // Eingebettete Eigenbelege-Sub-App — bootet via EBApp.mount() in #content
        eigenbelege: {
            render() { return '<div id="ebMount"></div>'; },
            init() { if (typeof EBApp !== 'undefined' && EBApp.mount) EBApp.mount(); }
        },
    },

    init() {
        // IndexedDB Auto-Backup initialisieren
        Store.initIDB();

        // Datei-Backup Handle wiederherstellen (async, blockiert nicht)
        Store.initFileSystemBackup().then(handle => {
            if (handle) {
                this._updateFsBackupStatus(handle.name, true);
            }
        });

        // Session-Ende Backup — greift wenn Tab/Fenster geschlossen oder versteckt wird
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && Store.getFsBackupFolderName()) {
                Store.writeFileSystemBackup('session_end');
            }
        });
        window.addEventListener('pagehide', () => {
            if (Store.getFsBackupFolderName()) {
                Store.writeFileSystemBackup('session_end');
            }
        });

        // Whop validiert Membership vor App-Start (kein Offline-Lizenz-Check mehr)
        this._bootAfterLicense();
    },

    // Aktualisiert den Backup-Status-Indikator in der Sidebar (falls vorhanden)
    _updateFsBackupStatus(folderName, active) {
        const el = document.getElementById('fsBackupStatus');
        if (!el) return;
        if (active && folderName) {
            el.innerHTML = `<span style="color:var(--success);font-size:11px;">💾 Datei-Backup aktiv: <strong>${Utils.escapeHtml(folderName)}</strong></span>`;
        } else {
            el.innerHTML = `<span style="color:var(--text-muted);font-size:11px;">💾 Kein Datei-Backup</span>`;
        }
    },

    _bootAfterLicense() {
        // Whop-Auth: AuthUI prüft Membership, dann _continueAfterAuth()
        if (typeof AuthUI !== 'undefined' && AuthUI.boot) {
            AuthUI.boot();
        } else {
            // Fallback (kein AuthUI geladen)
            this._continueInit();
        }
    },

    // Von AuthUI aufgerufen nachdem Auth + pullAll abgeschlossen
    _continueAfterAuth(user) {
        this._continueInit();
    },

    _continueInit() {
        // Apply i18n translations to static DOM elements
        if (typeof I18n !== 'undefined') I18n.applyAll();

        // ── Firmen-Check: Muss VOR allem anderen laufen ──
        const companies = CompanyManager.getAll();
        if (companies.length === 0) {
            // Erster Start oder Migration nötig
            const hasData = Object.keys(Store._cache).some(k =>
                k.startsWith('reselling_') || k.startsWith('rechnungsbuch_')
            );
            CompanyManager.showOnboarding(hasData);
            return;  // _continueAfterCompany() wird vom Onboarding-Wizard aufgerufen
        }

        // Aktive Firma setzen (oder erste Firma wählen)
        const activeId = CompanyManager.getActiveId() || companies[0].id;
        Store.setCompany(activeId);

        // letzterZugriff aktualisieren + company.land → Store.settings.land synchronisieren
        const cos = CompanyManager.getAll();
        const co  = cos.find(c => c.id === activeId);
        if (co) {
            co.letzterZugriff = new Date().toISOString();
            CompanyManager._save(cos);
            if (co.land) {
                const s = Store.getSettings();
                if (s.land !== co.land) Store.saveSettings(Object.assign({}, s, { land: co.land }));
                if (co.land === 'CH' && typeof Schweiz !== 'undefined') {
                    if (s.chKanton)                Schweiz._kanton   = s.chKanton;
                    if (s.chGemeinde !== undefined) Schweiz._gemeinde = s.chGemeinde || '';
                    if (s.chGjStart)               Schweiz._gjStart  = s.chGjStart;
                }
            }
        }

        // Company-Switcher-Button einfügen
        const switcherEl = document.getElementById('companySwitcher');
        if (switcherEl) switcherEl.innerHTML = CompanyManager.renderSwitcherBtn();

        this._continueAfterCompany();
    },

    // Startet den normalen App-Boot (nach Company-Auswahl)
    _continueAfterCompany() {
        // Versions-Check + Update-Erkennung (vor allem anderen)
        this._checkVersionUpdate();

        // Bezahlte Rechnungen automatisch als Verkauefe synchronisieren
        Store.autoSyncInvoices();

        // Periodisches Datei-Backup starten (alle 10 Minuten)
        this._startPeriodicBackup();

        // Theme: system preference via prefers-color-scheme (no manual toggle)

        // AGB-Pruefung vor allem anderen
        if (!localStorage.getItem('agb_accepted')) {
            this.showAgbModal();
            return; // bindGlobalEvents & navigate erst nach Akzeptanz
        }

        this._checkBackupReminder();
        this.bindGlobalEvents();
        this._updateGbrTabVisibility();
        this._updateSchweizTabVisibility();

        // DSGVO-Hinweis beim ersten Start nach AGB-Akzeptanz
        if (!localStorage.getItem('dsgvo_notice_shown')) {
            this.showDsgvoModal(() => {
                const settings = Store.getSettings();
                if (!settings.onboardingDone) this.showOnboarding();
                else {
                    const startPage = new URLSearchParams(location.search).get('page');
                    this.navigate(startPage || 'dashboard');
                }
            });
            return;
        }

        const settings = Store.getSettings();
        if (!settings.onboardingDone) {
            this.showOnboarding();
        } else {
            // ?page=xyz → direkt zur Zielseite (z.B. von der Lager-Standalone-Seite)
            const params = new URLSearchParams(location.search);
            const startPage = params.get('page');
            this.navigate(startPage || 'dashboard');
            // ?openBackup=1 → Backup-Modal direkt öffnen (von Lager-Sidebar)
            if (params.get('openBackup') === '1') {
                setTimeout(() => this.showBackupModal && this.showBackupModal(), 300);
            }
            // Backup-Hinweis-Banner (verzögert damit Seite erst gerendert ist)
            setTimeout(() => this._showBackupBanner(), 2000);
        }
    },

    // ============================================
    // Versions-Check & Update-Erkennung
    // ============================================
    _checkVersionUpdate() {
        const lastVersion = localStorage.getItem('app_last_version');
        const currentVersion = this.APP_VERSION;

        // Erstinstallation? Nur Version speichern, kein Update-Hinweis.
        if (!lastVersion) {
            localStorage.setItem('app_last_version', currentVersion);
            return;
        }

        // Selbe Version? Nichts zu tun.
        if (lastVersion === currentVersion) return;

        // Neue Version erkannt → User informieren + Auto-Backup
        const hasData = (Store.getPurchases(true).length + Store.getSales(true).length) > 0;

        // Auto-Backup vor erstem Start der neuen Version (wenn Datei-Backup-Ordner gesetzt)
        if (hasData && Store.getFsBackupFolderName()) {
            Store.writeFileSystemBackup('vor_update_' + currentVersion).then(() => {
                console.log('[App] Auto-Backup vor Update erstellt');
            }).catch(() => {});
        }

        // Update-Banner anzeigen
        setTimeout(() => this._showUpdateBanner(lastVersion, currentVersion, hasData), 600);

        // Letzte Version aktualisieren
        localStorage.setItem('app_last_version', currentVersion);
    },

    _showUpdateBanner(oldV, newV, hasData) {
        const body = `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div style="background:rgba(34,197,94,.10);border:1px solid rgba(34,197,94,.4);border-radius:10px;padding:14px 18px;">
                    <div style="font-weight:700;font-size:16px;color:var(--success);margin-bottom:6px;">
                        🎉 Update erfolgreich: <strong>v${oldV}</strong> → <strong>v${newV}</strong>
                    </div>
                    <div style="font-size:13px;color:var(--text-secondary);">
                        ${hasData
                            ? 'Deine bestehenden Daten wurden automatisch übernommen — keine Einbußen.'
                            : 'Willkommen bei der neuen Version!'}
                    </div>
                </div>

                ${hasData ? `
                <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:12px 14px;font-size:13px;">
                    <div style="font-weight:700;margin-bottom:6px;">📊 Bestehende Daten</div>
                    <div style="color:var(--text-secondary);font-size:12px;line-height:1.5;">
                        • <strong>${Store.getPurchases(true).length}</strong> Einkäufe<br>
                        • <strong>${Store.getSales(true).length}</strong> Verkäufe<br>
                        • <strong>${Store.getExpenses ? Store.getExpenses(true).length : 0}</strong> Ausgaben<br>
                        ${Store.getFsBackupFolderName()
                            ? `• ✅ Auto-Backup vor Update wurde erstellt (<em>${Utils.escapeHtml(Store.getFsBackupFolderName())}</em>)`
                            : '• ⚠️ Kein Datei-Backup-Ordner — bitte einrichten!'}
                    </div>
                </div>` : ''}

                <div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.3);border-radius:8px;padding:12px 14px;font-size:12px;color:var(--text-secondary);">
                    <div style="font-weight:700;color:var(--info);margin-bottom:4px;">💡 Wichtig zu wissen</div>
                    <div style="line-height:1.5;">
                        Deine Daten sind im Browser-Speicher gebunden an den <strong>Pfad</strong> dieser App.
                        Solange du den <code style="background:var(--bg-card);padding:1px 5px;border-radius:3px;">Drive</code>-Ordner
                        am gleichen Ort behältst, bleiben Daten bei jedem Update erhalten.
                        ${hasData ? '<br><br>Vor dem nächsten Update empfehlen wir trotzdem ein manuelles Backup.' : ''}
                    </div>
                </div>
            </div>
        `;

        const footer = `
            ${hasData ? `<button class="btn" id="updateBackupNow">💾 Backup jetzt herunterladen</button>` : ''}
            <button class="btn btn-primary" data-action="close-modal">Verstanden</button>
        `;

        this.showModal(`✨ Willkommen in v${newV}`, body, footer);

        const dlBtn = document.getElementById('updateBackupNow');
        if (dlBtn) dlBtn.addEventListener('click', () => {
            const data = Store.exportAll();
            const filename = `reselling_backup_v${newV}_${Utils.todayISO()}.json`;
            Utils.downloadFile(data, filename, 'application/json');
            localStorage.setItem('last_backup_date', new Date().toISOString());
            Utils.showToast('Backup heruntergeladen', 'success');
        });
    },

    bindGlobalEvents() {
        // Sidebar collapse toggle
        const collapseBtn = document.getElementById('sidebarCollapseBtn');
        const sidebar = document.getElementById('sidebar');
        if (collapseBtn && sidebar) {
            // collapsed-Klasse nie beim Start setzen — Toggle läuft über sidebarToggleBtn
            sidebar.classList.remove('collapsed');
            // collapseBtn ist display:none, kein Click-Handler nötig
        }

        // Sidebar section collapse/expand
        document.querySelectorAll('.sidebar-section[data-section]').forEach(sec => {
            const key = sec.dataset.section;
            const items = document.getElementById('section-' + key);
            if (!items) return;
            // Restore saved state
            if (localStorage.getItem('sidebar_sec_' + key) === '0') {
                items.classList.add('section-collapsed');
                sec.classList.add('section-collapsed');
            }
            sec.addEventListener('click', () => {
                const collapsed = items.classList.toggle('section-collapsed');
                sec.classList.toggle('section-collapsed', collapsed);
                localStorage.setItem('sidebar_sec_' + key, collapsed ? '0' : '1');
            });
        });

        // Sidebar navigation
        document.querySelectorAll('.sidebar-link').forEach(link => {
            // WCAG 2.1.1: make div-based links keyboard accessible
            if (!link.hasAttribute('tabindex')) link.setAttribute('tabindex', '0');
            if (!link.hasAttribute('role'))     link.setAttribute('role', 'button');
            // derive label from visible text
            const labelText = link.querySelector('.sidebar-link-label')?.textContent?.trim();
            if (labelText && !link.hasAttribute('aria-label')) link.setAttribute('aria-label', labelText);

            const _activate = () => {
                const page = link.dataset.page;

                // GbR Tab wechseln (bevor navigate, damit _tab gesetzt ist)
                const gbrTab = link.dataset.gbrTab;
                if (gbrTab && typeof GbrModul !== 'undefined') {
                    GbrModul._tab = gbrTab;
                }

                if (page) this.navigate(page);

                // EÜR Periode wechseln
                const period = link.dataset.euerPeriod;
                if (period && typeof Euer !== 'undefined') {
                    Euer._period = period;
                    Euer._refresh();
                    // Aktiv-Markierung aktualisieren
                    document.querySelectorAll('[data-euer-period]').forEach(el => {
                        el.classList.toggle('active', el.dataset.euerPeriod === period);
                    });
                }
            };

            link.addEventListener('click', _activate);
            // Enter / Space activate (WCAG 2.1.1)
            link.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _activate(); }
            });
        });

        // Settings link
        document.getElementById('settingsLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showSettingsModal();
        });

        // Backup link
        document.getElementById('backupLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showBackupModal();
        });

        // Mobile menu
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mobileOverlay = document.getElementById('mobileOverlay');

        if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => {
            const sb = document.getElementById('sidebar');
            const ov = document.getElementById('mobileOverlay');
            const btn = document.getElementById('sidebarToggleBtn');
            const opening = !sb?.classList.contains('sidebar-open');
            if (sb)  sb.classList.toggle('sidebar-open', opening);
            if (btn) { btn.classList.toggle('sidebar-open', opening); btn.textContent = opening ? '‹' : '›'; }
            if (ov)  ov.classList.toggle('active', opening);
        });

        if (mobileOverlay) mobileOverlay.addEventListener('click', () => {
            const sb  = document.getElementById('sidebar');
            const btn = document.getElementById('sidebarToggleBtn');
            if (sb)  sb.classList.remove('sidebar-open');
            if (btn) { btn.classList.remove('sidebar-open'); btn.textContent = '›'; }
            mobileOverlay.classList.remove('active');
        });

        // Close modal on overlay click
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });

        // ── F: ESC schließt Modal, dann Sidebar ────────────────────────────
        document.addEventListener('keydown', (e) => {
            const overlay = document.getElementById('modalOverlay');
            const modalOpen = overlay && overlay.classList.contains('active');

            // Focus-Trap: Tab bleibt im Modal (WCAG 2.4.3)
            if (modalOpen && e.key === 'Tab') {
                const modal = document.getElementById('modal');
                const focusables = modal.querySelectorAll('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])');
                if (!focusables.length) return;
                const first = focusables[0], last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
                return;
            }

            if (e.key !== 'Escape') return;
            if (modalOpen) {
                this.closeModal();
                return;
            }
            const sb = document.getElementById('sidebar');
            const btn = document.getElementById('sidebarToggleBtn');
            if (sb && sb.classList.contains('sidebar-open')) {
                sb.classList.remove('sidebar-open');
                btn?.classList.remove('sidebar-open');
                btn && (btn.textContent = '›');
                document.getElementById('mobileOverlay')?.classList.remove('active');
            }
        });

        // ── H: Unsaved-Changes-Tracking ────────────────────────────────────
        // Nur echte Formulareingaben (INPUT/TEXTAREA) markieren als dirty.
        // SELECTs werden NICHT gezählt, weil sie überwiegend Filter-Controls sind
        // (Jahresauswahl, Periodenfilter etc.) — kein Speicherbedarf.
        document.getElementById('content').addEventListener('input', (e) => {
            if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                this._formDirty = true;
            }
        });
        document.getElementById('content').addEventListener('change', (e) => {
            if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
                this._formDirty = true;
            }
        });

        // ── I: Spinner Utilities ────────────────────────────────────────────
        // showSpinner / hideSpinner sind auf App-Ebene verfügbar
    },

    // ── Spinner ──────────────────────────────────────────────────────────────
    showSpinner(text) {
        let el = document.getElementById('_appSpinner');
        if (!el) {
            el = document.createElement('div');
            el.id = '_appSpinner';
            el.innerHTML = `
                <div style="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;
                            display:flex;align-items:center;justify-content:center;">
                    <div style="background:var(--bg-card);border-radius:12px;padding:28px 36px;
                                text-align:center;box-shadow:var(--shadow-lg);min-width:200px;">
                        <div class="_spinner-ring"></div>
                        <div id="_spinnerText" style="margin-top:14px;font-size:14px;
                             color:var(--text-primary);font-weight:500;"></div>
                    </div>
                </div>`;
            document.body.appendChild(el);
        }
        document.getElementById('_spinnerText').textContent = text || 'Bitte warten…';
        el.style.display = 'block';
    },
    hideSpinner() {
        const el = document.getElementById('_appSpinner');
        if (el) el.style.display = 'none';
    },

    // ── Dirty-Form Tracking ──────────────────────────────────────────────────
    _formDirty: false,
    markDirty()  { this._formDirty = true; },
    markClean()  { this._formDirty = false; },

    // ── Backup-Hinweis-Banner (C) ─────────────────────────────────────────────
    _showBackupBanner() {
        if (localStorage.getItem('backup_banner_dismissed')) return;
        if (Store.getFsBackupFolderName()) return; // bereits konfiguriert
        const hasData = (Store.getPurchases(true).length + Store.getSales(true).length) > 5;
        if (!hasData) return; // nicht stören wenn kaum Daten

        let banner = document.getElementById('_backupBanner');
        if (banner) return;
        banner = document.createElement('div');
        banner.id = '_backupBanner';
        banner.className = '_backup-banner';
        banner.innerHTML = `
            <i class="ti ti-device-floppy" style="font-size:16px;"></i>
            <span><strong>Kein automatisches Backup aktiv.</strong>
            Richte einen Backup-Ordner ein, damit deine Daten nicht verloren gehen.</span>
            <button class="btn btn-sm btn-primary" style="white-space:nowrap;"
                    data-action="app-backup-modal">Backup einrichten</button>
            <button style="background:none;border:none;cursor:pointer;color:var(--text-muted);
                           font-size:18px;padding:0 4px;line-height:1;"
                    title="Hinweis schließen"
                    data-action="app-dismiss-backup-banner">&times;</button>`;
        // Nach Topnav einfügen
        const topnav = document.querySelector('.topnav');
        if (topnav) topnav.insertAdjacentElement('afterend', banner);
        else document.body.prepend(banner);
    },

    _updateGbrTabVisibility() {
        const isGbR = (typeof GbR !== 'undefined' && GbR.isPersonengesellschaft());
        const gbrTabEl = document.getElementById('toolTabGbr');
        if (gbrTabEl) gbrTabEl.style.display = isGbR ? '' : 'none';

        // Sidebar-Links je nach Rechtsform ein-/ausblenden
        if (typeof Rechtsform !== 'undefined') {
            const cfg = Rechtsform.getConfig();
            const show = (id, visible) => { const el = document.getElementById(id); if (el) el.style.display = visible ? '' : 'none'; };
            show('kstSidebarLink', cfg.koerperschaftsteuer);
            show('bilanzSidebarLink', cfg.bilanzPflicht || cfg.bilanzOptional);
            show('lohnsteuerSidebarLink', cfg.lohnsteuer);
            show('gewstSidebarLink', cfg.gewerbesteuer);
            show('privatbuchungenSidebarLink', cfg.privatbuchungen);
            show('kskSidebarLink', cfg.ksk);
        }
    },

    navigate(page) {
        if (!this.pages[page]) return;

        // Land-Gate: Österreich nur bei AT
        if (page === 'oesterreich' && Store.getSettings().land !== 'AT') { this.navigate('dashboard'); return; }

        // Rechtsform-Gate: block navigation to pages hidden for current form
        if (typeof Rechtsform !== 'undefined') {
            const cfg = Rechtsform.getConfig();
            if (page === 'koerperschaftsteuer' && !cfg.koerperschaftsteuer) { this.navigate('dashboard'); return; }
            if (page === 'bilanz' && !cfg.bilanzPflicht && !cfg.bilanzOptional) { this.navigate('dashboard'); return; }
            if (page === 'lohnsteuer' && !cfg.lohnsteuer) { this.navigate('dashboard'); return; }
            if (page === 'privatbuchungen' && !cfg.privatbuchungen) { this.navigate('dashboard'); return; }
            if (page === 'ksk' && !cfg.ksk) { this.navigate('dashboard'); return; }
            if (page === 'gewerbesteuer' && !cfg.gewerbesteuer) { this.navigate('dashboard'); return; }
        }

        // ── H: Unsaved-Changes-Warnung ───────────────────────────────────────
        if (this._formDirty && page !== this.currentPage) {
            if (!confirm('Du hast ungespeicherte Eingaben. Seite trotzdem verlassen?')) return;
        }
        this._formDirty = false;

        // EÜR↔Steuertermine-Flag zurücksetzen wenn wir woanders hin navigieren
        if (page !== 'steuertermine' && page !== 'euer') {
            this._cameFromEuer = false;
        }

        // Schweiz-Modus: EÜR komplett durch EAR ersetzen
        if (Store.getSettings().land === 'CH' && page === 'euer') {
            this.navigate('schweiz');
            return;
        }

        this.currentPage = page;

        // §19 UStG Umsatzgrenzprüfung bei jeder Navigation (nur DE)
        if (Store.getSettings().land !== 'CH') this._checkUstThreshold();

        // Update sidebar active state
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });

        // Close mobile menu
        const sidebarEl = document.getElementById('sidebar');
        const overlayEl = document.getElementById('mobileOverlay');
        if (sidebarEl) sidebarEl.classList.remove('sidebar-open');
        if (overlayEl) overlayEl.classList.remove('active');

        // Akademie: Sidebar ausblenden → volle Breite
        if (sidebarEl) sidebarEl.classList.toggle('euer-hidden', page === 'akademie');

        // GbR-Sektion ein-/ausblenden + Topnav-Tab zeigen/verbergen
        const onGbr = (page === 'gbr');
        const isGbR = (typeof GbR !== 'undefined' && GbR.isPersonengesellschaft());
        const gbrSection  = document.getElementById('gbrSidebarSection');
        const gbrItems    = document.getElementById('gbrSidebarItems');
        const gbrTabEl    = document.getElementById('toolTabGbr');
        if (gbrSection) gbrSection.style.display = onGbr ? '' : 'none';
        if (gbrItems)   gbrItems.style.display   = onGbr ? '' : 'none';
        if (gbrTabEl)   gbrTabEl.style.display   = isGbR ? '' : 'none';

        // GbR Tab aktiv markieren
        if (onGbr && typeof GbrModul !== 'undefined') {
            document.querySelectorAll('[data-gbr-tab]').forEach(el => {
                el.classList.toggle('active', el.dataset.gbrTab === GbrModul._tab);
            });
        }

        // Länder-Sektionen ein-/ausblenden
        const settings    = Store.getSettings();
        const isCH        = settings.land === 'CH';
        const isAT        = settings.land === 'AT';
        const onCH        = page === 'schweiz' || (isCH && page === 'steuertermine');
        const onAT        = page === 'oesterreich';
        const chSection   = document.getElementById('chSidebarSection');
        const chItems     = document.getElementById('chSidebarItems');
        const atSection   = document.getElementById('atSidebarSection');
        const atItems     = document.getElementById('atSidebarItems');
        const schweizTab  = document.getElementById('toolTabSchweiz');
        const atTab       = document.getElementById('toolTabOesterreich');
        const euerTabEl   = document.getElementById('toolTabEuer');
        if (chSection)  chSection.style.display  = onCH ? '' : 'none';
        if (chItems)    chItems.style.display    = onCH ? '' : 'none';
        if (atSection)  atSection.style.display  = onAT ? '' : 'none';
        if (atItems)    atItems.style.display    = onAT ? '' : 'none';
        if (schweizTab) schweizTab.style.display = isCH ? '' : 'none';
        if (atTab)      atTab.style.display      = isAT ? '' : 'none';
        if (euerTabEl)  euerTabEl.style.display  = (isCH || isAT) ? 'none' : '';

        // Schweiz Periode-Buttons aktiv markieren
        if (onCH && typeof Schweiz !== 'undefined') {
            document.querySelectorAll('[data-ch-period]').forEach(el => {
                el.classList.toggle('active', el.dataset.chPeriod === Schweiz._period);
                el.onclick = () => {
                    Schweiz._period = el.dataset.chPeriod;
                    App.navigate('schweiz');
                };
            });
        }

        // EÜR-Sektion ein-/ausblenden (im CH-Modus nie sichtbar)
        const onEuer = !isCH && (page === 'euer' || page === 'steuertermine');
        const euerSection  = document.getElementById('euerSidebarSection');
        const euerItems    = document.getElementById('euerSidebarItems');
        const mainSection  = document.getElementById('mainSidebarSection');
        if (euerSection) euerSection.style.display  = (onEuer && !onGbr) ? '' : 'none';
        if (euerItems)   euerItems.style.display    = (onEuer && !onGbr) ? '' : 'none';

        // Finanzen-Modul: transaktionale Seiten teilen sich eine persistente Sub-Nav
        const onFinanzen = App.FINANZ_PAGES.includes(page);
        this._renderModuleSubnav(page);
        const finanzTab = document.getElementById('toolTabFinanzen');
        if (finanzTab) finanzTab.classList.toggle('active', onFinanzen);

        // Steuer & Soziales Sektion ein-/ausblenden
        // (afa + bankimport sind ins Finanzen-Modul gewandert → hier raus)
        const onSteuer = ['privatbuchungen', 'ustvoranmeldung', 'ksk', 'vorsteuer', 'oss', 'koerperschaftsteuer', 'bilanz', 'rechtsform', 'lohnsteuer', 'gewerbesteuer', 'steuerberater'].includes(page);
        const steuerSection = document.getElementById('steuerSidebarSection');
        const steuerItems   = document.getElementById('steuerSidebarItems');
        if (steuerSection) steuerSection.style.display = (onSteuer && !onGbr) ? '' : 'none';
        if (steuerItems)   steuerItems.style.display   = (onSteuer && !onGbr) ? '' : 'none';

        if (mainSection) mainSection.style.display  = (onEuer || onGbr || onSteuer || onCH || onAT) ? 'none' : '';
        const mainItems = document.getElementById('section-hauptmenu');
        if (mainItems)   mainItems.style.display    = (onEuer || onGbr || onSteuer || onCH || onAT) ? 'none' : '';

        // EÜR Periode-Buttons aktiv markieren
        if (onEuer && typeof Euer !== 'undefined') {
            document.querySelectorAll('[data-euer-period]').forEach(el => {
                el.classList.toggle('active', el.dataset.euerPeriod === Euer._period);
            });
        }

        // Render page — mit try-catch damit nie ein leerer schwarzer Screen kommt
        const contentEl = document.getElementById('content');

        // Skeleton Loading: kurz Platzhalter zeigen, dann echten Inhalt einblenden
        contentEl.innerHTML = this._skeletonFor(page);

        try {
            // Kleiner rAF-Delay damit Skeleton sichtbar wird und dann Inhalt smooth einfliegt
            requestAnimationFrame(() => {
                try {
                    contentEl.innerHTML = this.pages[page].render();
                    contentEl.classList.add('skeleton-fade-in');
                    setTimeout(() => contentEl.classList.remove('skeleton-fade-in'), 300);
                    this.pages[page].init();
                } catch(err) {
                    console.error('[navigate] Fehler auf Seite', page, err);
                    contentEl.innerHTML = `
                        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;text-align:center;padding:40px;">
                            <div style="font-size:48px;margin-bottom:16px;color:var(--warning);"><i class="ti ti-alert-triangle"></i></div>
                            <h2 style="color:var(--text-primary);margin-bottom:12px;">Seite konnte nicht geladen werden</h2>
                            <p style="color:var(--text-secondary);max-width:400px;margin-bottom:20px;">Fehler: <code style="background:var(--bg-card);padding:4px 8px;border-radius:4px;">${err.message || err}</code></p>
                            <button class="btn btn-primary" data-action="navigate" data-args=\'["dashboard"]\'>→ Zum Dashboard</button>
                        </div>
                    `;
                }
            });
            // Early return — init läuft im rAF callback oben
            return;
        } catch(err) {
            // Nur falls das rAF-Setup selbst fehlschlägt (sehr selten)
            console.error('[navigate] Setup-Fehler', page, err);
        }
    },

    // Persistente Sub-Nav des Finanzen-Moduls. Liegt außerhalb von #content,
    // überlebt daher die _refresh()-Aufrufe der einzelnen Module.
    // Leert sich auf Nicht-Finanzen-Seiten (CSS :empty → display:none).
    _renderModuleSubnav(page) {
        const el = document.getElementById('moduleSubnav');
        if (!el) return;

        // 2. Sub-Nav-Ebene (eingebettete Sub-Apps: Rechnungen/Eigenbelege) leeren,
        // sobald wir nicht mehr auf deren Seite sind.
        const rs = document.getElementById('rechSubnav');
        if (rs && page !== 'rechnungen' && page !== 'eigenbelege') rs.innerHTML = '';

        const SUBTABS = [
            { page: 'rechnungen',  icon: 'ti-file-invoice',    label: 'Rechnungen'   },
            { page: 'eigenbelege', icon: 'ti-receipt',         label: 'Eigenbelege'  },
            { page: 'buchungen',   icon: 'ti-arrows-exchange', label: 'Buchungen'    },
            { page: 'ausgaben',    icon: 'ti-cash',            label: 'Ausgaben'     },
            { page: 'bankimport',  icon: 'ti-building-bank',   label: 'Bank-Import'  },
            { page: 'fahrtenbuch', icon: 'ti-car',             label: 'Fahrtenbuch'  },
            { page: 'afa',         icon: 'ti-trending-down',   label: 'AfA'          },
        ];

        if (!App.FINANZ_PAGES.includes(page)) { el.innerHTML = ''; return; }

        const tabs = SUBTABS.map(t =>
            `<button class="msub-tab${t.page === page ? ' active' : ''}" type="button" ` +
            `data-action="navigate" data-args='["${t.page}"]' title="${t.label}" aria-label="${t.label}">` +
            `<i class="ti ${t.icon}"></i><span>${t.label}</span></button>`
        ).join('');

        el.innerHTML =
            `<div class="module-subnav-inner">` +
                `<div class="module-subnav-title"><i class="ti ti-wallet"></i> Finanzen</div>` +
                `<div class="module-subnav-tabs">${tabs}</div>` +
            `</div>`;
    },

    // Erzeugt ein Skeleton-Platzhalter-Layout je nach Seite
    _skeletonFor(page) {
        const card = () => `
            <div class="skeleton-card">
                <div class="skeleton-line title"></div>
                <div class="skeleton-line value"></div>
                <div class="skeleton-line sub"></div>
            </div>`;

        if (page === 'dashboard') {
            return `
                <div class="page-header" style="margin-bottom:16px;">
                    <div class="skeleton-line" style="width:140px;height:22px;"></div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-bottom:24px;">
                    ${card()}${card()}${card()}${card()}${card()}${card()}
                </div>
                <div class="skeleton-card" style="height:200px;"></div>`;
        }

        // Generisches Skeleton für alle anderen Seiten
        return `
            <div class="page-header" style="margin-bottom:16px;">
                <div class="skeleton-line" style="width:160px;height:22px;"></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;">
                <div class="skeleton-card" style="height:60px;"></div>
                <div class="skeleton-card" style="height:200px;"></div>
                <div class="skeleton-card" style="height:140px;"></div>
            </div>`;
    },

    // Emoji-Titel-Präfixe → Tabler-Icons (Konsistenz mit Rest der App, kein Font-abhängiges Emoji-Rendering)
    _MODAL_ICON_MAP: {
        '⚙️': 'ti-settings', '⚙': 'ti-settings', '🤝': 'ti-handshake', '💸': 'ti-cash-banknote',
        '✨': 'ti-sparkles', '📋': 'ti-clipboard-list', '🚨': 'ti-alert-triangle', '🧹': 'ti-eraser',
        '⚠️': 'ti-alert-triangle', '⚠': 'ti-alert-triangle', '📦': 'ti-package', '📊': 'ti-chart-bar',
        '📥': 'ti-download', '📍': 'ti-map-pin', '✏️': 'ti-pencil', '✏': 'ti-pencil',
    },

    showModal(title, bodyHtml, footerHtml) {
        const modal = document.getElementById('modal');
        let titleText = String(title);
        let iconClass = null;
        const emojiMatch = titleText.match(/^(\p{Emoji_Presentation}️?|\p{Extended_Pictographic}️?)\s*/u);
        if (emojiMatch && this._MODAL_ICON_MAP[emojiMatch[1]]) {
            iconClass = this._MODAL_ICON_MAP[emojiMatch[1]];
            titleText = titleText.slice(emojiMatch[0].length);
        }
        const safeTitle = (iconClass ? `<i class="ti ${iconClass}" style="color:var(--accent-text);margin-right:6px;" aria-hidden="true"></i>` : '')
            + titleText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        modal.innerHTML = `
            <div class="modal-header">
                <h3 id="modalTitle">${safeTitle}</h3>
                <button class="modal-close" data-action="close-modal" aria-label="Schließen">&times;</button>
            </div>
            <div class="modal-body">${bodyHtml}</div>
            ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
        `;
        modal.setAttribute('aria-label', titleText);
        document.getElementById('modalOverlay').classList.add('active');
        // Focus first focusable element (WCAG 2.1.2)
        const focusable = modal.querySelector('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])');
        if (focusable) focusable.focus();
    },

    closeModal() {
        const overlay = document.getElementById('modalOverlay');
        const modal = document.getElementById('modal');
        if (overlay) overlay.classList.remove('active');
        if (modal) modal.innerHTML = '';
    },

    // ---- Onboarding ----
    // ── DSGVO First-Run Hinweis (Art. 13 DSGVO) ──
    showDsgvoModal(onConfirm) {
        const overlay = document.getElementById('modalOverlay');
        const modal   = document.getElementById('modal');

        modal.innerHTML = `
            <div class="agb-modal-header">
                <div style="font-size:28px;margin-bottom:8px;color:var(--accent);"><i class="ti ti-lock"></i></div>
                <h2 style="margin:0 0 4px 0;font-size:20px;">Datenschutzhinweis</h2>
                <p style="margin:0;color:var(--text-secondary);font-size:13px;">Gemäß Art. 13 DSGVO – einmalige Information zur Datenverarbeitung</p>
            </div>
            <div class="agb-scroll-box">
                <h3>Wer ist verantwortlich?</h3>
                <p>Diese Software wird von Ihnen lokal betrieben. Verantwortlich für die Datenverarbeitung sind <strong>Sie als Nutzer</strong>. Ihre Buchhaltungsdaten werden standardmäßig ausschließlich lokal gespeichert und nicht übertragen — außer Sie aktivieren ausdrücklich den optionalen, Ende-zu-Ende-verschlüsselten Cloud-Sync (siehe Datenschutzerklärung, Ziffer 4). Für Login/Zahlung wird der Drittanbieter Whop genutzt.</p>

                <h3>Welche Daten werden gespeichert?</h3>
                <ul>
                    <li><strong>Buchhaltungsdaten</strong>: Einkäufe, Verkäufe, Ausgaben, Rechnungen, Fahrtenbuch, Kassenbuch</li>
                    <li><strong>Stammdaten</strong>: Kundendaten (Name, Adresse, E-Mail), Einstellungen</li>
                    <li><strong>Protokolldaten</strong>: Änderungsprotokoll (Audit-Log) gemäß GoBD</li>
                    <li><strong>App-Daten</strong>: Theme-Einstellungen, Backup-Zeitstempel, Onboarding-Status</li>
                </ul>

                <h3>Wo werden die Daten gespeichert?</h3>
                <p>Alle Daten werden <strong>standardmäßig ausschließlich lokal auf Ihrem Gerät</strong> gespeichert – in <code>IndexedDB</code> und <code>localStorage</code> Ihres Browsers. Es findet keine Übertragung an externe Server statt, <strong>es sei denn</strong>, Sie aktivieren den optionalen Cloud-Sync (Ende-zu-Ende-verschlüsselt, EU-Server) — Details in der Datenschutzerklärung.</p>

                <h3>Wie lange werden Daten gespeichert?</h3>
                <p>Daten bleiben bis zur aktiven Löschung durch Sie erhalten. Steuerrelevante Unterlagen (GoBD) müssen gemäß <strong>§ 147 AO 10 Jahre</strong> aufbewahrt werden – das Audit-Log ist daher aus rechtlichen Gründen nicht löschbar.</p>

                <h3>Ihre Rechte (DSGVO Art. 15–22)</h3>
                <ul>
                    <li><strong>Auskunft</strong> (Art. 15): Alle Daten sind über „Backup & Daten → Backup herunterladen" einsehbar</li>
                    <li><strong>Berichtigung</strong> (Art. 16): Daten können direkt in der App bearbeitet werden</li>
                    <li><strong>Löschung</strong> (Art. 17): Über „Backup & Daten → Geschäftsdaten löschen" möglich (außer GoBD-Protokoll); löscht bei aktivem Cloud-Sync auch den verschlüsselten Cloud-Stand</li>
                    <li><strong>Datenportabilität</strong> (Art. 20): Export als JSON oder CSV jederzeit verfügbar</li>
                </ul>

                <h3>Kundendaten in Rechnungen</h3>
                <p>Wenn Sie Kundendaten (Name, Adresse) erfassen, verarbeiten Sie personenbezogene Daten im Sinne der DSGVO. <strong>Als Verantwortlicher müssen Sie Ihre Kunden bei der ersten Kontaktaufnahme über die Verarbeitung informieren</strong> (Art. 13 DSGVO – z.B. durch Datenschutzhinweis auf Rechnungen oder Website).</p>

                <h3>Drittanbieter</h3>
                <p>Diese Software lädt <strong>keine externen Ressourcen</strong> (keine CDNs, keine Analytics, keine Tracker). Google Fonts sind in der Einstellungs-Oberfläche verlinkt – bei Bedarf durch lokale Schriften ersetzbar.</p>
            </div>
            <div class="agb-modal-footer">
                <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Dieser Hinweis wird einmalig angezeigt. Er kann jederzeit unter <strong>Einstellungen → Datenschutz</strong> erneut aufgerufen werden.</p>
                <div style="display:flex;justify-content:flex-end;">
                    <button class="btn btn-primary" id="dsgvoOkBtn">Verstanden &amp; Weiter</button>
                </div>
            </div>
        `;

        overlay.classList.add('active');

        document.getElementById('dsgvoOkBtn').addEventListener('click', () => {
            localStorage.setItem('dsgvo_notice_shown', new Date().toISOString());
            overlay.classList.remove('active');
            if (typeof onConfirm === 'function') onConfirm();
        });
    },

    showAgbModal() {
        const overlay = document.getElementById('modalOverlay');
        const modal = document.getElementById('modal');

        modal.innerHTML = `
            <div class="agb-modal-header">
                <div style="font-size:28px;margin-bottom:8px;color:var(--accent);"><i class="ti ti-clipboard-text"></i></div>
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
                <label class="agb-checkbox-label" id="agbCheckLabel">
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

        const checkbox = document.getElementById('agbCheckbox');
        const acceptBtn = document.getElementById('agbAcceptBtn');
        const declineBtn = document.getElementById('agbDeclineBtn');

        checkbox.addEventListener('change', () => {
            acceptBtn.disabled = !checkbox.checked;
        });

        acceptBtn.addEventListener('click', () => {
            localStorage.setItem('agb_accepted', new Date().toISOString());
            overlay.classList.remove('active');
            this.bindGlobalEvents();
            // DSGVO-Hinweis anzeigen, wenn noch nicht gesehen
            if (!localStorage.getItem('dsgvo_notice_shown')) {
                this.showDsgvoModal(() => {
                    const settings = Store.getSettings();
                    if (!settings.onboardingDone) this.showOnboarding();
                    else this.navigate('dashboard');
                });
            } else {
                const settings = Store.getSettings();
                if (!settings.onboardingDone) this.showOnboarding();
                else this.navigate('dashboard');
            }
        });

        declineBtn.addEventListener('click', () => {
            document.getElementById('content').innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:80vh;text-align:center;padding:40px;">
                    <div style="font-size:48px;margin-bottom:16px;">🚫</div>
                    <h2 style="color:var(--text-primary);margin-bottom:12px;">Nutzung nicht möglich</h2>
                    <p style="color:var(--text-secondary);max-width:400px;">Die Nutzung dieser Software ist nur nach Akzeptanz der Nutzungsbedingungen möglich.<br><br>Bitte laden Sie die Seite neu, um die Bedingungen erneut anzuzeigen.</p>
                    <button class="btn btn-primary" style="margin-top:24px;" data-action="reload">Seite neu laden</button>
                </div>
            `;
            overlay.classList.remove('active');
        });
    },

    // ---- AES-256-GCM Backup Verschlüsselung ----
    async _deriveKey(password, salt) {
        const keyMaterial = await crypto.subtle.importKey(
            'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    },

    async _encryptBackup(jsonStr, password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv   = crypto.getRandomValues(new Uint8Array(12));
        const key  = await this._deriveKey(password, salt);
        const ct   = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode(jsonStr)
        );
        const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
        return {
            _encrypted: true,
            _version: 1,
            salt: toB64(salt),
            iv: toB64(iv),
            data: toB64(ct)
        };
    },

    // Anzeige-Text "welche Firma bekommt den Excel-Import" — verhindert versehentlichen Import in falsche Firma (z.B. DE statt CH)
    _importTargetLabel() {
        const flags = { DE: '🇩🇪 Deutschland', AT: '🇦🇹 Österreich', CH: '🇨🇭 Schweiz' };
        if (typeof CompanyManager !== 'undefined') {
            const co = CompanyManager.getActive();
            if (co) return `${co.name} (${flags[co.land] || co.land})`;
        }
        const land = Store.getSettings().land || 'DE';
        return flags[land] || land;
    },

    async _decryptBackup(encObj, password) {
        if (!encObj._encrypted || encObj._version !== 1) throw new Error('Unbekanntes Verschlüsselungsformat');
        const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
        const salt = fromB64(encObj.salt);
        const iv   = fromB64(encObj.iv);
        const ct   = fromB64(encObj.data);
        const key  = await this._deriveKey(password, salt);
        let pt;
        try {
            pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
        } catch {
            throw new Error('Falsches Passwort oder beschädigte Datei');
        }
        return new TextDecoder().decode(pt);
    },


    // ── Land-Wechsel: CH-Felder ein-/ausblenden ──────────────
    _onLandChange(land) {
        const isCH = land === 'CH';
        ['set_ch_kanton_group', 'set_ch_mwstnr_group', 'set_ch_mwst_default_group', 'set_ch_rate_group'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = isCH ? '' : 'none';
        });
    },

    // ── Schweiz/AT-Tab-Sichtbarkeit aktualisieren ────────────────
    _updateSchweizTabVisibility() {
        const land = Store.getSettings().land || 'DE';
        const isCH = land === 'CH';
        const isAT = land === 'AT';
        // CH sidebar
        const chSection = document.getElementById('chSidebarSection');
        const chItems   = document.getElementById('chSidebarItems');
        if (chSection) chSection.style.display = isCH ? '' : 'none';
        if (chItems)   chItems.style.display   = isCH ? '' : 'none';
        // AT sidebar
        const atSection = document.getElementById('atSidebarSection');
        const atItems   = document.getElementById('atSidebarItems');
        if (atSection) atSection.style.display = isAT ? '' : 'none';
        if (atItems)   atItems.style.display   = isAT ? '' : 'none';
        // Topnav tabs
        const schweizTab = document.getElementById('toolTabSchweiz');
        if (schweizTab) schweizTab.style.display = isCH ? '' : 'none';
        const atTab = document.getElementById('toolTabOesterreich');
        if (atTab) atTab.style.display = isAT ? '' : 'none';
        // EÜR-Tab-Label dynamisch
        const euerTab = document.getElementById('toolTabEuer');
        if (euerTab) {
            euerTab.style.display = (isCH || isAT) ? 'none' : '';
            const label = euerTab.querySelector('span');
            if (label) label.textContent = 'EÜR';
        }
        // EÜR-Sidebar anpassen
        const euerSect = document.getElementById('euerSidebarSection');
        if (euerSect) {
            const txt = euerSect.firstChild;
            if (txt && txt.nodeType === 3) txt.textContent = 'EÜR – Auswertung';
        }
    },

    // ── USt-Modus Kartenauswahl ───────────────────────────────
    _pickUst(prefix, value) {
        const input = document.getElementById(prefix + '_ustMode');
        if (input) input.value = value;
        const picker = document.getElementById(prefix + '_ust_picker');
        if (picker) {
            picker.querySelectorAll('.ust-card').forEach(card => {
                card.classList.toggle('selected', card.dataset.value === value);
            });
        }
        const versteuerungsartGroup = document.getElementById(prefix + '_versteuerungsart_group');
        if (versteuerungsartGroup) versteuerungsartGroup.style.display = value === 'regel' ? '' : 'none';
        const uvaPeriodeGroup = document.getElementById(prefix + '_uva_periode_group');
        if (uvaPeriodeGroup) uvaPeriodeGroup.style.display = value === 'regel' ? '' : 'none';
    },

    // ── §19 UStG Jahresumsatz-Grenzprüfung ───────────────────────
    // Gesamtumsatz i.S.d. §19 Abs. 3 UStG umfasst auch vom Käufer erstattete Versandkosten
    // (Teil des Entgelts) — muss konsistent mit euer.js' bruttoEinnahmen-Definition sein,
    // sonst wird die 25k/100k-Grenze real überschritten, während die Warnung noch stumm bleibt.
    _calcJahresumsatz(year) {
        const y = String(year || new Date().getFullYear());
        return Store.getSales()
            .filter(s => !s.storniert && s.datum && s.datum.startsWith(y))
            .reduce((sum, s) => sum + (parseFloat(s.verkaufspreis) || 0) + (parseFloat(s.versandkostenKaeufer) || 0), 0);
    },

    _checkUstThreshold() {
        const settings = Store.getSettings();
        if ((settings.ustMode || 'klein') !== 'klein') return; // nur für Kleinunternehmer
        const year       = new Date().getFullYear();
        const GRENZE_VJ  = 25000;    // Vorjahresgrenze (§19 UStG ab 2025) → entscheidet Folgejahr
        const GRENZE_LFD = 100000;   // obere Grenze lfd. Jahr → SOFORTIGER Wegfall der Kleinunternehmer-Eigenschaft
        const umsatz     = this._calcJahresumsatz(year);
        const hardKey    = 'ust_threshold_hard_' + year;    // 100k Sofort-Modal
        const warnKey    = 'ust_threshold_warned_' + year;  // 25k Folgejahr-Modal
        const preWarnKey = 'ust_prewarn_' + year;

        // 1) Obere Grenze: 100.000 € im laufenden Jahr → Status entfällt SOFORT ab überschreitendem Umsatz
        if (umsatz >= GRENZE_LFD) {
            if (!localStorage.getItem(hardKey)) {
                setTimeout(() => this._showUstThresholdModal(umsatz, year, hardKey, 'sofort'), 400);
            }
            return;
        }

        // 2) Vorjahresgrenze 25.000 € im lfd. Jahr überschritten → ab Folgejahr regelbesteuert
        if (umsatz >= GRENZE_VJ) {
            if (!localStorage.getItem(warnKey)) {
                setTimeout(() => this._showUstThresholdModal(umsatz, year, warnKey, 'folgejahr'), 400);
            }
        } else if (umsatz >= GRENZE_VJ * 0.9) {
            // 90 % Vorwarnung (ab 22.500 €) — einmalige Toast-Meldung
            if (!localStorage.getItem(preWarnKey) && !localStorage.getItem(warnKey)) {
                localStorage.setItem(preWarnKey, '1');
                const rest = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
                    .format(GRENZE_VJ - umsatz);
                setTimeout(() => Utils.showToast(
                    `⚠️ Kleinunternehmer: Noch ${rest} bis zur 25.000 €-Grenze`, 'warning'), 800);
            }
        }
    },

    _showUstThresholdModal(umsatz, year, warnKey, mode) {
        const fmt    = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
        const sofort = mode === 'sofort';
        const erklaerung = sofort
            ? `Die obere Umsatzgrenze von <strong>100.000&nbsp;€</strong> wurde im laufenden Jahr überschritten.
               Die Kleinunternehmerregelung (§&nbsp;19 UStG) entfällt damit <strong>sofort</strong> — ab dem Umsatz,
               der die Grenze überschreitet, ist Umsatzsteuer auszuweisen.`
            : `Dein Umsatz übersteigt ${year} die Grenze von <strong>25.000&nbsp;€</strong>.
               Du bleibst <strong>dieses Jahr</strong> Kleinunternehmer, wirst aber <strong>ab ${year + 1}</strong>
               regelbesteuert (sofern der Umsatz nicht zusätzlich 100.000&nbsp;€ überschreitet — dann gilt der Wechsel sofort).`;
        const todos = sofort
            ? `<li>Ab sofort <strong>19&nbsp;% Umsatzsteuer</strong> auf neuen Rechnungen ausweisen</li>
               <li>Das <strong>Finanzamt informieren</strong> (oder Steuerberater beauftragen)</li>
               <li>Ab Folgemonat gilt die <strong>Pflicht zur USt-Voranmeldung</strong></li>`
            : `<li><strong>Ab ${year + 1}</strong> Umsatzsteuer (19&nbsp;%) auf Rechnungen ausweisen</li>
               <li><strong>Finanzamt/Steuerberater</strong> über den anstehenden Wechsel informieren</li>
               <li>Dieses Jahr bleibt unverändert — keine Rückwirkung auf bereits gestellte Rechnungen</li>`;
        const body = `
            <div style="background:var(--warning-bg);border:1px solid var(--warning);border-radius:8px;
                        padding:16px 18px;margin-bottom:20px;">
                <div style="font-size:24px;margin-bottom:6px;color:var(--warning);"><i class="ti ti-alert-triangle"></i></div>
                <strong style="font-size:15px;">Jahresumsatz ${year}: ${fmt.format(umsatz)}</strong>
                <div style="font-size:13px;color:var(--text-secondary);margin-top:6px;">
                    ${erklaerung}
                </div>
            </div>
            <h4 style="margin-bottom:10px;color:var(--text-primary);">Was jetzt zu tun ist:</h4>
            <ul style="padding-left:20px;font-size:13px;line-height:1.9;
                       color:var(--text-secondary);margin-bottom:20px;">
                ${todos}
            </ul>
            <div style="font-size:11px;color:var(--text-muted);background:var(--bg-secondary);
                        padding:8px 12px;border-radius:6px;">
                ⚖️ Keine Steuerberatung – bitte einen Steuerberater konsultieren.
            </div>
        `;
        const footer = sofort
            ? `<button class="btn btn-primary"
                    style="background:var(--warning);border-color:var(--warning);flex:1;min-width:180px;"
                    data-action="app-ust-switch-regel" data-args='["${warnKey}"]'>
                    ✅ Jetzt auf Regelbesteuerung umstellen
                </button>
                <button class="btn btn-secondary" style="flex:1;min-width:160px;"
                    data-action="app-ust-dismiss" data-args='["${warnKey}"]'>
                    📋 Ich kümmere mich selbst
                </button>`
            : `<button class="btn btn-primary" style="flex:1;min-width:160px;"
                    data-action="app-ust-dismiss" data-args='["${warnKey}"]'>
                    ✅ Verstanden
                </button>`;
        const title = sofort
            ? 'Kleinunternehmer-Grenze (100.000 €) überschritten'
            : 'Kleinunternehmer: 25.000-€-Grenze überschritten';
        this.showModal(title, body, footer);
    },

    _ustSwitchToRegel(warnKey) {
        const s = Store.getSettings();
        s.ustMode = 'regel';
        Store.saveSettings(s);
        localStorage.setItem(warnKey, '1');
        this.closeModal();
        Utils.showToast('Umgestellt auf Regelbesteuerung — bitte Finanzamt informieren!', 'warning');
    },

    _ustDismissThreshold(warnKey) {
        localStorage.setItem(warnKey, '1');
        this.closeModal();
    },

    _checkBackupReminder() {
        // Auto-Backup läuft jetzt vollautomatisch via IndexedDB (Store._triggerAutoBackup)
        // Hier nur Erinnerung für manuelles JSON-Export alle 30 Tage
        const lastBackup = localStorage.getItem('last_backup_date');
        if (!lastBackup) {
            setTimeout(() => {
                Utils.showToast('💡 Tipp: Regelmäßig Backup herunterladen — Backup & Daten im Menü', 'info');
            }, 4000);
            return;
        }
        const daysSince = Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000);
        if (daysSince >= 30) {
            setTimeout(() => {
                Utils.showToast(`⚠️ Letztes Backup vor ${daysSince} Tagen — bitte herunterladen!`, 'warning');
            }, 3000);
        }
    },

    showOnboarding() {
        // Show language picker first if not already chosen explicitly
        const langChosen = localStorage.getItem('stackr_lang_chosen');
        if (!langChosen) {
            this._showLangPicker();
            return;
        }
        this._onboardingStep = 1;
        this._onboardingData = {};
        this._renderOnboarding();
    },

    _showLangPicker() {
        const L = (typeof I18n !== 'undefined') ? I18n : { t: function(k) { return k; } };
        document.getElementById('onboarding').innerHTML = `
            <div class="onboarding-overlay">
                <div class="onboarding-card" style="text-align:center;max-width:420px;">
                    <div style="font-size:36px;color:var(--accent);margin-bottom:16px;">◆</div>
                    <h2 style="margin-bottom:8px;">${L.t('ob.lang.title')}</h2>
                    <p style="color:var(--text-muted);font-size:13px;margin-bottom:32px;">${L.t('ob.lang.subtitle')}</p>
                    <div style="display:flex;gap:16px;justify-content:center;">
                        <button class="btn btn-lg" id="langPickDE" style="flex:1;padding:18px;font-size:16px;display:flex;flex-direction:column;align-items:center;gap:8px;border:2px solid var(--border);border-radius:12px;background:var(--card);">
                            <span style="font-size:32px;">🇩🇪</span>
                            <span style="font-weight:600;">Deutsch</span>
                        </button>
                        <button class="btn btn-lg" id="langPickEN" style="flex:1;padding:18px;font-size:16px;display:flex;flex-direction:column;align-items:center;gap:8px;border:2px solid var(--border);border-radius:12px;background:var(--card);">
                            <span style="font-size:32px;">🇬🇧</span>
                            <span style="font-weight:600;">English</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('langPickDE').addEventListener('click', () => {
            localStorage.setItem('stackr_lang', 'de');
            localStorage.setItem('stackr_lang_chosen', '1');
            this._onboardingStep = 1;
            this._onboardingData = {};
            this._renderOnboarding();
        });
        document.getElementById('langPickEN').addEventListener('click', () => {
            localStorage.setItem('stackr_lang', 'en');
            localStorage.setItem('stackr_lang_chosen', '1');
            this._onboardingStep = 1;
            this._onboardingData = {};
            this._renderOnboarding();
        });
    },

    _renderOnboarding() {
        const step = this._onboardingStep;
        const d = this._onboardingData;
        const L = (typeof I18n !== 'undefined') ? I18n : { t: function(k) { return k; } };
        const isCH = (typeof CompanyManager !== 'undefined') && CompanyManager.getActiveLand() === 'CH';
        const totalSteps = isCH ? 6 : 5;

        let stepsHtml = '<div class="onboarding-steps">';
        for (let i = 1; i <= totalSteps; i++) {
            const cls = i < step ? 'done' : i === step ? 'active' : '';
            stepsHtml += `<div class="onboarding-step ${cls}"></div>`;
        }
        stepsHtml += '</div>';

        let title = '', subtitle = '', fieldsHtml = '';

        if (step === 1) {
            title = L.t('ob.step1.title');
            subtitle = L.t('ob.step1.subtitle');
            fieldsHtml = `
                <div class="form-group">
                    <label class="form-label" for="ob_firmenname">${L.t('field.company')}</label>
                    <input type="text" class="form-input" id="ob_firmenname" value="${Utils.escapeHtml(d.firmenname || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="ob_name">${L.t('field.name.req')}</label>
                    <input type="text" class="form-input" id="ob_name" value="${Utils.escapeHtml(d.name || '')}" required>
                </div>
            `;
        } else if (step === 2) {
            title = L.t('ob.step2.title');
            subtitle = L.t('ob.step2.subtitle');
            fieldsHtml = `
                <div class="form-group">
                    <label class="form-label" for="ob_adresse">${L.t('field.address')}</label>
                    <input type="text" class="form-input" id="ob_adresse" value="${Utils.escapeHtml(d.adresse || '')}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="ob_plz">${L.t('field.zip')}</label>
                        <input type="text" class="form-input" id="ob_plz" value="${Utils.escapeHtml(d.plz || '')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="ob_ort">${L.t('field.city')}</label>
                        <input type="text" class="form-input" id="ob_ort" value="${Utils.escapeHtml(d.ort || '')}">
                    </div>
                </div>
            `;
        } else if (step === 3) {
            title = L.t('ob.step3.title');
            subtitle = L.t('ob.step3.subtitle');
            fieldsHtml = `
                <div class="form-group">
                    <label class="form-label" for="ob_telefon">${L.t('field.phone')}</label>
                    <input type="text" class="form-input" id="ob_telefon" value="${Utils.escapeHtml(d.telefon || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="ob_email">${L.t('field.email')}</label>
                    <input type="email" class="form-input" id="ob_email" value="${Utils.escapeHtml(d.email || '')}">
                </div>
            `;
        } else if (step === 4) {
            title = L.t('ob.step4.title');
            subtitle = isCH ? 'Steuerliche Angaben für die EAR.' : L.t('ob.step4.subtitle');
            if (isCH) {
                fieldsHtml = `
                <div class="form-group">
                    <label class="form-label" for="ob_ahvNr">AHV-Nummer (optional)</label>
                    <input type="text" class="form-input" id="ob_ahvNr" value="${Utils.escapeHtml(d.ahvNr || '')}" placeholder="756.xxxx.xxxx.xx">
                </div>
                <div class="form-group">
                    <label class="form-label" for="ob_chMwstNr">MWST-Nummer (optional)</label>
                    <input type="text" class="form-input" id="ob_chMwstNr" value="${Utils.escapeHtml(d.chMwstNr || '')}" placeholder="CHE-xxx.xxx.xxx MWST">
                </div>
                <div class="form-group">
                    <label class="form-label">MWST-Modus</label>
                    <input type="hidden" id="ob_ch_ustMode" value="${d.chMwstMode || 'klein'}">
                    <div class="ust-picker" id="ob_ch_ust_picker">
                        <div class="ust-card ${(d.chMwstMode || 'klein') === 'klein' ? 'selected' : ''}" data-value="klein" data-action="app-pick-ust" data-args='["ob_ch","klein"]'>
                            <div class="ust-card-icon" style="color:var(--success);"><i class="ti ti-shield-check"></i></div>
                            <div class="ust-card-title">Nicht pflichtig</div>
                            <div class="ust-card-law">Art. 10 Abs. 2 MWSTG</div>
                            <ul class="ust-card-facts">
                                <li>Umsatz &lt; CHF 100'000 / Jahr</li>
                                <li>Keine MWST auf Rechnungen</li>
                                <li>Kein Vorsteuerabzug</li>
                                <li>Keine MWST-Abrechnung</li>
                            </ul>
                            <div class="ust-card-hint">Ideal für Einsteiger &amp; Kleinbetriebe</div>
                        </div>
                        <div class="ust-card ${d.chMwstMode === 'effektiv' ? 'selected' : ''}" data-value="effektiv" data-action="app-pick-ust" data-args='["ob_ch","effektiv"]'>
                            <div class="ust-card-icon" style="color:var(--info);"><i class="ti ti-trending-up"></i></div>
                            <div class="ust-card-title">Effektive Methode</div>
                            <div class="ust-card-law">8.1% Normalsatz</div>
                            <ul class="ust-card-facts">
                                <li>MWST auf Ausgangsrechnungen</li>
                                <li>Vorsteuerabzug möglich</li>
                                <li>Quartals-/Jahresabrechnung</li>
                                <li>Pflicht ab CHF 100'000 Umsatz</li>
                            </ul>
                            <div class="ust-card-hint">Für B2B &amp; höhere Umsätze empfohlen</div>
                        </div>
                    </div>
                </div>
                `;
            } else {
                fieldsHtml = `
                <div class="form-group">
                    <label class="form-label" for="ob_steuernummer">${L.t('field.taxnr')}</label>
                    <input type="text" class="form-input" id="ob_steuernummer" value="${Utils.escapeHtml(d.steuernummer || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="ob_ustId">${L.t('field.ustid')}</label>
                    <input type="text" class="form-input" id="ob_ustId" value="${Utils.escapeHtml(d.ustId || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${L.t('field.ustmode')}</label>
                    <input type="hidden" id="ob_ustMode" value="${d.ustMode || 'klein'}">
                    <div class="ust-picker" id="ob_ust_picker">
                        <div class="ust-card ${(d.ustMode || 'klein') === 'klein' ? 'selected' : ''}" data-value="klein" data-action="app-pick-ust" data-args='["ob","klein"]'>
                            <div class="ust-card-icon" style="color:var(--success);"><i class="ti ti-shield-check"></i></div>
                            <div class="ust-card-title">${L.t('ust.klein.title')}</div>
                            <div class="ust-card-law">${L.t('ust.klein.law')}</div>
                            <ul class="ust-card-facts">
                                <li>${L.t('ust.klein.f1')}</li>
                                <li>${L.t('ust.klein.f2')}</li>
                                <li>${L.t('ust.klein.f3')}</li>
                                <li>${L.t('ust.klein.f4')}</li>
                            </ul>
                            <div class="ust-card-hint">${L.t('ust.klein.hint')}</div>
                        </div>
                        <div class="ust-card ${d.ustMode === 'regel' ? 'selected' : ''}" data-value="regel" data-action="app-pick-ust" data-args='["ob","regel"]'>
                            <div class="ust-card-icon" style="color:var(--info);"><i class="ti ti-trending-up"></i></div>
                            <div class="ust-card-title">${L.t('ust.regel.title')}</div>
                            <div class="ust-card-law">${L.t('ust.regel.law')}</div>
                            <ul class="ust-card-facts">
                                <li>${L.t('ust.regel.f1')}</li>
                                <li>${L.t('ust.regel.f2')}</li>
                                <li>${L.t('ust.regel.f3')}</li>
                                <li>${L.t('ust.regel.f4')}</li>
                            </ul>
                            <div class="ust-card-hint">${L.t('ust.regel.hint')}</div>
                        </div>
                    </div>
                </div>
                `;
            }
        } else if (step === 5 && isCH) {
            title = 'Standort & Geschäftsjahr';
            subtitle = 'Für die Steuerberechnung und EAR-Auswertung.';
            const kNames = {AG:'Aargau',AI:'Appenzell Innerrhoden',AR:'Appenzell Ausserrhoden',BE:'Bern',BL:'Basel-Landschaft',BS:'Basel-Stadt',FR:'Freiburg',GE:'Genf',GL:'Glarus',GR:'Graubünden',JU:'Jura',LU:'Luzern',NE:'Neuenburg',NW:'Nidwalden',OW:'Obwalden',SG:'St. Gallen',SH:'Schaffhausen',SO:'Solothurn',SZ:'Schwyz',TG:'Thurgau',TI:'Tessin',UR:'Uri',VD:'Waadt',VS:'Wallis',ZG:'Zug',ZH:'Zürich'};
            const curKanton = d.chKanton || 'ZH';
            const kantonOpts = Object.entries(kNames).map(([k,n])=>`<option value="${k}" ${curKanton===k?'selected':''}>${k} – ${n}</option>`).join('');
            const gemListe = (typeof Schweiz !== 'undefined' && Schweiz.GEMEINDEN && Schweiz.GEMEINDEN[curKanton]) || [];
            const gemOpts = `<option value="">— Kantonsschnitt verwenden —</option>` +
                gemListe.map(g=>`<option value="${g.id}" ${(d.chGemeinde||'')===g.id?'selected':''}>${Utils.escapeHtml(g.name)}</option>`).join('');
            const mNames = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
            const monthOpts = mNames.map((m,i)=>`<option value="${i+1}" ${(d.chGjStart||1)===(i+1)?'selected':''}>${m}</option>`).join('');
            fieldsHtml = `
                <div class="form-group">
                    <label class="form-label" for="ob_chKanton">Kanton</label>
                    <select class="form-input" id="ob_chKanton" data-action-change="app-ob-gemeinde">${kantonOpts}</select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="ob_chGemeinde">Gemeinde <span style="font-size:10px;color:var(--text-muted);">(optional)</span></label>
                    <select class="form-input" id="ob_chGemeinde">${gemOpts}</select>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Für eine genauere Steuerrechnung. Auch später im Steuer-Tab wählbar.</div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="ob_chGjStart">Geschäftsjahr beginnt im</label>
                    <select class="form-input" id="ob_chGjStart">${monthOpts}</select>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Standard: Januar. Nur ändern wenn dein Geschäftsjahr abweicht.</div>
                </div>
            `;
        } else if ((step === 5 && !isCH) || step === 6) {
            title = L.t('ob.step5.title');
            subtitle = isCH ? 'Die IBAN wird auch für die QR-Rechnung verwendet.' : L.t('ob.step5.subtitle');
            fieldsHtml = `
                <div class="form-group">
                    <label class="form-label">${L.t('field.bank')}</label>
                    <input type="text" class="form-input" id="ob_bankname" value="${Utils.escapeHtml(d.bankname || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">${L.t('field.iban')}${isCH ? ' <span style="font-size:10px;background:var(--accent);color:#fff;padding:1px 6px;border-radius:3px;vertical-align:middle;margin-left:4px;">QR</span>' : ''}</label>
                    <input type="text" class="form-input" id="ob_iban" value="${Utils.escapeHtml(d.iban || '')}" ${isCH ? 'placeholder="CH56 0483 5012 3456 7800 9"' : ''}>
                </div>
                ${!isCH ? `<div class="form-group">
                    <label class="form-label">${L.t('field.bic')}</label>
                    <input type="text" class="form-input" id="ob_bic" value="${Utils.escapeHtml(d.bic || '')}">
                </div>` : ''}
            `;
        }

        const prevBtn = step > 1 ? `<button class="btn" id="obPrev">${L.t('ob.back')}</button>` : '';
        const nextBtn = step < totalSteps
            ? `<button class="btn btn-primary" id="obNext">${L.t('ob.next')}</button>`
            : `<button class="btn btn-success" id="obFinish">${L.t('ob.finish')}</button>`;

        document.getElementById('onboarding').innerHTML = `
            <div class="onboarding-overlay">
                <div class="onboarding-card">
                    ${stepsHtml}
                    <h2>${title}</h2>
                    <div class="subtitle">${subtitle}</div>
                    ${fieldsHtml}
                    <div class="form-actions">
                        ${prevBtn}
                        ${nextBtn}
                    </div>
                </div>
            </div>
        `;

        // Bind buttons
        const prevEl = document.getElementById('obPrev');
        if (prevEl) prevEl.addEventListener('click', () => { this._saveOnboardingStep(); this._onboardingStep--; this._renderOnboarding(); });

        const nextEl = document.getElementById('obNext');
        if (nextEl) nextEl.addEventListener('click', () => {
            const ok = this._saveOnboardingStep();
            if (ok === false) return;
            this._onboardingStep++;
            this._renderOnboarding();
        });

        const finishEl = document.getElementById('obFinish');
        if (finishEl) finishEl.addEventListener('click', () => {
            const ok = this._saveOnboardingStep();
            if (ok === false) return;
            this._finishOnboarding();
        });
    },

    _saveOnboardingStep() {
        const d = this._onboardingData;
        const step = this._onboardingStep;
        if (step === 1) {
            d.firmenname = document.getElementById('ob_firmenname').value.trim();
            d.name = document.getElementById('ob_name').value.trim();
        } else if (step === 2) {
            d.adresse = document.getElementById('ob_adresse').value.trim();
            d.plz = document.getElementById('ob_plz').value.trim();
            d.ort = document.getElementById('ob_ort').value.trim();
        } else if (step === 3) {
            d.telefon = document.getElementById('ob_telefon').value.trim();
            d.email = document.getElementById('ob_email').value.trim();
        } else if (step === 4) {
            const isCH = (typeof CompanyManager !== 'undefined') && CompanyManager.getActiveLand() === 'CH';
            if (isCH) {
                d.ahvNr      = (document.getElementById('ob_ahvNr')?.value || '').trim();
                d.chMwstNr   = (document.getElementById('ob_chMwstNr')?.value || '').trim();
                d.chMwstMode = document.getElementById('ob_ch_ustMode')?.value || 'klein';
            } else {
                d.steuernummer = document.getElementById('ob_steuernummer').value.trim();
                d.ustId        = document.getElementById('ob_ustId').value.trim();
                d.ustMode      = document.getElementById('ob_ustMode').value;
            }
        } else if (step === 5) {
            const isCH = (typeof CompanyManager !== 'undefined') && CompanyManager.getActiveLand() === 'CH';
            if (isCH) {
                d.chKanton    = document.getElementById('ob_chKanton')?.value || 'ZH';
                d.chGemeinde  = document.getElementById('ob_chGemeinde')?.value || '';
                d.chGjStart   = parseInt(document.getElementById('ob_chGjStart')?.value) || 1;
            } else {
                d.bankname = document.getElementById('ob_bankname').value.trim();
                d.iban     = document.getElementById('ob_iban').value.trim();
                d.bic      = document.getElementById('ob_bic').value.trim();
            }
        } else if (step === 6) {
            d.bankname = document.getElementById('ob_bankname').value.trim();
            d.iban     = document.getElementById('ob_iban').value.trim();
        }
    },

    _finishOnboarding() {
        const d = this._onboardingData;
        d.onboardingDone = true;
        Store.saveSettings(d);
        document.getElementById('onboarding').innerHTML = '';
        Utils.showToast('Einrichtung abgeschlossen! 🎉', 'success');
        this.navigate('dashboard');
    },

    _obRefreshGemeinde(kanton) {
        const sel = document.getElementById('ob_chGemeinde');
        if (!sel) return;
        const gList = (typeof Schweiz !== 'undefined' && Schweiz.GEMEINDEN && Schweiz.GEMEINDEN[kanton]) || [];
        sel.innerHTML = '<option value="">— Kantonsschnitt verwenden —</option>' +
            gList.map(g => `<option value="${g.id}">${Utils.escapeHtml(g.name)}</option>`).join('');
    },

    // ---- Settings Modal ----
    showSettingsModal() {
        const s = Store.getSettings();

        const body = `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="set_firmenname">Firmenname</label>
                    <input type="text" class="form-input" id="set_firmenname" value="${Utils.escapeHtml(s.firmenname || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="set_name">Name</label>
                    <input type="text" class="form-input" id="set_name" value="${Utils.escapeHtml(s.name || '')}">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="set_adresse">Adresse</label>
                <input type="text" class="form-input" id="set_adresse" value="${Utils.escapeHtml(s.adresse || '')}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="set_plz">PLZ</label>
                    <input type="text" class="form-input" id="set_plz" value="${Utils.escapeHtml(s.plz || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="set_ort">Ort</label>
                    <input type="text" class="form-input" id="set_ort" value="${Utils.escapeHtml(s.ort || '')}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="set_telefon">Telefon</label>
                    <input type="text" class="form-input" id="set_telefon" value="${Utils.escapeHtml(s.telefon || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="set_email">E-Mail</label>
                    <input type="email" class="form-input" id="set_email" value="${Utils.escapeHtml(s.email || '')}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="set_steuernummer">Steuernummer</label>
                    <input type="text" class="form-input" id="set_steuernummer" value="${Utils.escapeHtml(s.steuernummer || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="set_ustId">USt-ID</label>
                    <input type="text" class="form-input" id="set_ustId" value="${Utils.escapeHtml(s.ustId || '')}">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">USt-Modus</label>
                <input type="hidden" id="set_ustMode" value="${s.ustMode || 'klein'}">
                <div class="ust-picker ust-picker--compact" id="set_ust_picker">
                    <div class="ust-card ${(s.ustMode || 'klein') === 'klein' ? 'selected' : ''}" data-value="klein" data-action="app-pick-ust" data-args='["set","klein"]'>
                        <div class="ust-card-icon" style="color:var(--success);"><i class="ti ti-shield-check"></i></div>
                        <div class="ust-card-title">Kleinunternehmer</div>
                        <div class="ust-card-law">§ 19 UStG</div>
                        <ul class="ust-card-facts">
                            <li>Keine USt auf Rechnungen</li>
                            <li>Kein Vorsteuerabzug</li>
                            <li>Grenze: 25.000 € / Jahr</li>
                        </ul>
                    </div>
                    <div class="ust-card ${s.ustMode === 'regel' ? 'selected' : ''}" data-value="regel" data-action="app-pick-ust" data-args='["set","regel"]'>
                        <div class="ust-card-icon" style="color:var(--info);"><i class="ti ti-trending-up"></i></div>
                        <div class="ust-card-title">Regelbesteuerung</div>
                        <div class="ust-card-law">19 % USt</div>
                        <ul class="ust-card-facts">
                            <li>19 % USt ausweisen</li>
                            <li>Vorsteuer erstattbar</li>
                            <li>Voranmeldung Pflicht</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="form-group" id="set_versteuerungsart_group" style="${s.ustMode === 'regel' ? '' : 'display:none'}">
                <label class="form-label" for="set_ustVersteuerungsart">Versteuerungsart (UVA + DATEV)</label>
                <select class="form-select" id="set_ustVersteuerungsart">
                    <option value="soll" ${(s.ustVersteuerungsart || 'soll') === 'soll' ? 'selected' : ''}>Soll-Versteuerung (nach Rechnungsdatum) – Regelfall</option>
                    <option value="ist" ${s.ustVersteuerungsart === 'ist' ? 'selected' : ''}>Ist-Versteuerung (nach Zahlungseingang) – nur bis 800.000 € Vorjahresumsatz oder Freiberufler</option>
                </select>
                <div style="font-size:11px;color:var(--warning);margin-top:6px;"><i class="ti ti-alert-triangle"></i> Ein Wechsel wirkt nur auf zukünftige Voranmeldungen. Bereits gemeldete Zeiträume werden nicht rückwirkend neu berechnet — bei Wechsel während des Jahres bitte mit dem Steuerberater abstimmen, damit keine Umsätze doppelt oder gar nicht erfasst werden.</div>
            </div>
            <div class="form-group" id="set_uva_periode_group" style="${s.ustMode === 'regel' ? '' : 'display:none'}">
                <label class="form-label" for="set_ustVaPeriodenTyp">Voranmeldungs-Zeitraum</label>
                <select class="form-select" id="set_ustVaPeriodenTyp">
                    <option value="quartal" ${(s.ustVaPeriodenTyp || 'quartal') === 'quartal' ? 'selected' : ''}>Vierteljährlich (Regelfall)</option>
                    <option value="monat" ${s.ustVaPeriodenTyp === 'monat' ? 'selected' : ''}>Monatlich</option>
                </select>
                <div class="form-hint">Monatlich ist Pflicht, wenn die USt-Zahllast des Vorjahres 7.500 € überstieg, sowie im Gründungsjahr und im Folgejahr (§18 Abs. 2 UStG).</div>
                <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;cursor:pointer;">
                    <input type="checkbox" id="set_ustDauerfrist" ${s.ustDauerfristverlaengerung ? 'checked' : ''}>
                    Dauerfristverlängerung beantragt/genehmigt (verschiebt Abgabefrist um 1 Monat)
                </label>
            </div>
            <hr style="border-color:var(--border);margin:16px 0;">
            <div class="section-title" style="margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <i class="ti ti-world"></i> Land / Region
            </div>
            <div class="form-row" style="align-items:flex-end;">
                <div class="form-group">
                    <label class="form-label" for="set_land">Land</label>
                    <select class="form-select" id="set_land" data-action-change="app-land-change">
                        <option value="DE" ${(s.land || 'DE') === 'DE' ? 'selected' : ''}>🇩🇪 Deutschland (EÜR, USt, ELSTER)</option>
                        <option value="CH" ${s.land === 'CH' ? 'selected' : ''}>🇨🇭 Schweiz (EAR, MWST, ESTV)</option>
                        <option value="AT" ${s.land === 'AT' ? 'selected' : ''}>🇦🇹 Österreich (EAR, USt, GSVG, ESt)</option>
                    </select>
                </div>
                <div class="form-group" id="set_ch_kanton_group" style="${s.land === 'CH' ? '' : 'display:none'}">
                    <label class="form-label" for="set_chKanton">Kanton</label>
                    <select class="form-select" id="set_chKanton">
                        ${typeof Schweiz !== 'undefined' ? Object.entries(Schweiz.KANTONE).sort((a,b)=>a[1].name.localeCompare(b[1].name)).map(([k, v]) =>
                            `<option value="${k}" ${(s.chKanton || 'ZH') === k ? 'selected' : ''}>${k} – ${v.name}</option>`
                        ).join('') : '<option value="ZH">ZH – Zürich</option>'}
                    </select>
                </div>
                <div class="form-group" id="set_ch_mwstnr_group" style="${s.land === 'CH' ? '' : 'display:none'}">
                    <label class="form-label" for="set_chMwstNr">MWST-Nummer</label>
                    <input type="text" class="form-input" id="set_chMwstNr" placeholder="CHE-123.456.789 MWST" value="${Utils.escapeHtml(s.chMwstNr || '')}">
                </div>
                <div class="form-group" id="set_ch_mwst_default_group" style="${s.land === 'CH' ? '' : 'display:none'}">
                    <label class="form-label" for="set_chMwstSatzDefault">Standard-MWST (Rechnungen)</label>
                    <select class="form-select" id="set_chMwstSatzDefault">
                        <option value="8.1" ${(s.chMwstSatzDefault||'8.1')==='8.1'?'selected':''}>8.1% – Normalsatz</option>
                        <option value="2.6" ${s.chMwstSatzDefault==='2.6'?'selected':''}>2.6% – Sondersatz</option>
                        <option value="3.8" ${s.chMwstSatzDefault==='3.8'?'selected':''}>3.8% – Beherbergung</option>
                        <option value="0"   ${s.chMwstSatzDefault==='0'?'selected':''}>0% – nicht steuerpflichtig</option>
                    </select>
                    <div class="form-hint">Vorauswahl bei neuer Rechnungsposition</div>
                </div>
                <div class="form-group" id="set_ch_rate_group" style="${s.land === 'CH' ? '' : 'display:none'}">
                    <label class="form-label" for="set_chfRate">CHF/EUR-Kurs</label>
                    <input type="number" class="form-input" id="set_chfRate" step="0.001" min="0.5" max="5" placeholder="1.050" value="${s.chfRate || '1.050'}">
                    <div class="form-hint">Für Währungsumrechnung in Buchungen (1 EUR = X CHF)</div>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="set_bankname">Bankname</label>
                    <input type="text" class="form-input" id="set_bankname" value="${Utils.escapeHtml(s.bankname || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="set_iban">IBAN</label>
                    <input type="text" class="form-input" id="set_iban" value="${Utils.escapeHtml(s.iban || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="set_bic">BIC</label>
                    <input type="text" class="form-input" id="set_bic" value="${Utils.escapeHtml(s.bic || '')}">
                </div>
            </div>
            <hr style="border-color:var(--border);margin:16px 0;">
            <div class="section-title" style="margin-bottom:12px;">Rechnungs-Design</div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="set_logo">Logo (PNG/JPG)</label>
                    <input type="file" accept="image/png,image/jpeg,image/gif,image/svg+xml" class="form-input" id="set_logo">
                    <div class="form-hint" id="set_logo_preview" style="margin-top:6px;"></div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="set_headerColor">Header-Farbe</label>
                    <input type="color" class="form-input" id="set_headerColor" value="${s.invoiceHeaderColor || '#0e3b2e'}" style="height:42px;padding:4px;">
                </div>
                <div class="form-group">
                    <label class="form-label" for="set_primaryColor">Primärfarbe (Akzent)</label>
                    <input type="color" class="form-input" id="set_primaryColor" value="${s.invoicePrimaryColor || '#10b981'}" style="height:42px;padding:4px;">
                </div>
            </div>
            ${s.logoBase64 ? `<div style="margin-top:8px;"><img src="${s.logoBase64}" style="max-height:60px;max-width:200px;object-fit:contain;border:1px solid var(--border);border-radius:6px;padding:4px;background:white;"></div>` : ''}
            ${(typeof GbR !== 'undefined') ? GbR.renderSettingsBlock() : ''}
            <hr style="border-color:var(--border);margin:16px 0;">
            <div class="form-group">
                <label class="form-label">🌐 Sprache / Language</label>
                <div style="display:flex;gap:10px;margin-top:6px;">
                    <button class="btn${(typeof I18n !== 'undefined' && I18n.isDE()) ? ' btn-primary' : ''}" data-action="i18n-set-lang" data-args='["de"]' style="flex:1;">🇩🇪 Deutsch</button>
                    <button class="btn${(typeof I18n !== 'undefined' && I18n.isEN()) ? ' btn-primary' : ''}" data-action="i18n-set-lang" data-args='["en"]' style="flex:1;">🇬🇧 English</button>
                </div>
            </div>
            <hr style="border-color:var(--border);margin:16px 0;">
            <div style="display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:10px;">
                <div style="font-size:11px;color:var(--text-muted);text-align:right;">
                    Stackr v1.7 &nbsp;·&nbsp;
                    <a href="mailto:secondlife.vintage07@gmail.com" style="color:var(--text-muted);">secondlife.vintage07@gmail.com</a>
                </div>
            </div>
        `;
        const footer = `
            <button class="btn" id="dsgvoReopenBtn" style="margin-right:auto;">🔒 Datenschutzhinweis</button>
            <button class="btn" data-action="close-modal">Abbrechen</button>
            <button class="btn btn-primary" id="saveSettingsBtn">Speichern</button>
        `;
        this.showModal('Einstellungen', body, footer);

        document.getElementById('dsgvoReopenBtn').addEventListener('click', () => {
            this.closeModal();
            this.showDsgvoModal(() => this.showSettingsModal());
        });

        // Land-Wechsel: CH-Felder ein-/ausblenden (via inline onchange handler)

        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            const updated = {
                firmenname: document.getElementById('set_firmenname').value.trim(),
                name: document.getElementById('set_name').value.trim(),
                adresse: document.getElementById('set_adresse').value.trim(),
                plz: document.getElementById('set_plz').value.trim(),
                ort: document.getElementById('set_ort').value.trim(),
                telefon: document.getElementById('set_telefon').value.trim(),
                email: document.getElementById('set_email').value.trim(),
                steuernummer: document.getElementById('set_steuernummer').value.trim(),
                ustId: document.getElementById('set_ustId').value.trim(),
                ustMode: document.getElementById('set_ustMode').value,
                ustVersteuerungsart: (document.getElementById('set_ustVersteuerungsart') || {}).value || 'soll',
                ustVaPeriodenTyp: (document.getElementById('set_ustVaPeriodenTyp') || {}).value || 'quartal',
                ustDauerfristverlaengerung: !!(document.getElementById('set_ustDauerfrist') || {}).checked,
                land: (document.getElementById('set_land') || {}).value || 'DE',
                chKanton: (document.getElementById('set_chKanton') || {}).value || s.chKanton || 'ZH',
                chMwstNr: ((document.getElementById('set_chMwstNr') || {}).value || '').trim(),
                chMwstSatzDefault: (document.getElementById('set_chMwstSatzDefault') || {}).value || s.chMwstSatzDefault || '8.1',
                chfRate: parseFloat((document.getElementById('set_chfRate') || {}).value) || s.chfRate || 1.05,
                chMwstMode: s.chMwstMode || 'klein',
                chSaldoSatz: s.chSaldoSatz || 2.0,
                bankname: document.getElementById('set_bankname').value.trim(),
                iban: document.getElementById('set_iban').value.trim(),
                bic: document.getElementById('set_bic').value.trim(),
                invoiceHeaderColor: document.getElementById('set_headerColor').value,
                invoicePrimaryColor: document.getElementById('set_primaryColor').value,
                onboardingDone: true
            };
            const logoInput = document.getElementById('set_logo');
            const saveAndClose = (logoBase64) => {
                updated.logoBase64 = logoBase64;
                Store.saveSettings(updated);
                this.closeModal();
                Utils.showToast('Einstellungen gespeichert', 'success');
                this.navigate(this.currentPage);
            };
            if (logoInput && logoInput.files[0]) {
                const file = logoInput.files[0];
                if (file.size > 500 * 1024) {
                    Utils.showToast('Logo zu groß (max. 500 KB)', 'warning');
                    return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => saveAndClose(ev.target.result);
                reader.readAsDataURL(file);
                return;
            }
            saveAndClose(s.logoBase64 || '');
        });

    },

    // ---- Backup Modal ----
    _getStorageInfo() {
        // Berechne Größe aus dem IDB-Cache (Hauptspeicher)
        let totalBytes = 0;
        const cache = Store._cache || {};
        for (const [k, v] of Object.entries(cache)) {
            if (k.startsWith(Store._prefix) || k.startsWith(Store._rechPrefix) || k === Store._auditKey) {
                totalBytes += (k.length + (v || '').length) * 2;
            }
        }
        const usedKB = (totalBytes / 1024).toFixed(1);
        const usedMB = (totalBytes / 1024 / 1024).toFixed(2);
        const usedGB = (totalBytes / 1024 / 1024 / 1024).toFixed(3);
        // IDB Limit: Browser gewährt typisch 50% freier Festplattenplatz → zeigen wir als "unbegrenzt"
        const color = 'var(--success)';
        return { usedKB, usedMB, usedGB, pct: 0, color, limitMB: null };
    },

    showBackupModal() {
        const si = this._getStorageInfo();
        const lastBackup = localStorage.getItem('last_backup_date');
        const lastBackupStr = lastBackup ? Utils.formatDate(lastBackup.split('T')[0]) : 'Noch kein Backup';
        const fsFolder = Store.getFsBackupFolderName();
        const fsLastFile = localStorage.getItem('_fs_backup_last_file') || '—';
        const fsLastTs   = localStorage.getItem('_fs_backup_last');
        const fsLastStr  = fsLastTs ? new Date(fsLastTs).toLocaleString('de-DE') : '—';
        const fsSupported = !!window.showDirectoryPicker;

        // Backup-Modal rendern, dann async Speicher-Status nachladen
        const body = `
            <div style="padding:10px 14px;border-radius:8px;background:rgba(59,130,246,0.08);border:1px solid var(--info);font-size:12px;color:var(--text-secondary);line-height:1.6;margin-bottom:10px;">
                <i class="ti ti-info-circle"></i> <strong>Gesetzliche Aufbewahrungspflicht: 10 Jahre</strong> (§147 AO / GoBD). Deine Buchhaltungsdaten liegen ausschließlich lokal auf diesem Gerät — es gibt kein automatisches Server-Backup. Richte unten einen Datei-Backup-Ordner ein und bewahre Backups über die gesamte Frist auf.
            </div>
            <div id="persistStorageBlock" style="margin-bottom:4px;">
                <div style="padding:12px 14px;border-radius:8px;background:rgba(251,191,36,0.12);border:1px solid var(--warning);font-size:13px;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:20px;color:var(--warning);"><i class="ti ti-loader"></i></span>
                    <span style="color:var(--warning);">Prüfe Speicherschutz…</span>
                </div>
            </div>
            <div class="section" style="border:2px solid var(--success);border-radius:8px;padding:14px;background:rgba(34,197,94,0.04);margin-bottom:4px;">
                <div class="section-title" style="color:var(--success);"><i class="ti ti-device-floppy"></i> Datei-Backup — Ordner auf deinem PC</div>
                ${!fsSupported ? `
                    <div style="background:rgba(220,38,38,0.1);border-radius:6px;padding:10px;font-size:13px;color:var(--danger);">
                        <i class="ti ti-alert-triangle"></i> Dein Browser unterstützt kein Datei-Backup. Bitte <strong>Chrome</strong> oder <strong>Edge</strong> verwenden.
                    </div>
                ` : `
                    <div id="fsFolderInfo" style="margin-bottom:12px;padding:10px;background:var(--bg-main);border-radius:6px;font-size:13px;">
                        ${fsFolder ? `
                            <div style="color:var(--success);font-weight:600;margin-bottom:4px;"><i class="ti ti-circle-check"></i> Aktiv — Ordner: <strong>${Utils.escapeHtml(fsFolder)}</strong></div>
                            <div style="color:var(--text-muted);font-size:11px;">Letztes Backup: ${fsLastStr} &nbsp;·&nbsp; Datei: ${Utils.escapeHtml(fsLastFile)}</div>
                            <div style="color:var(--text-secondary);font-size:11px;margin-top:4px;"><i class="ti ti-pin"></i> Backup wird automatisch nach jeder Änderung + bei Session-Ende geschrieben. Letzte 60 Dateien werden behalten.</div>
                        ` : `
                            <div style="color:var(--warning);font-weight:600;"><i class="ti ti-alert-triangle"></i> Kein Backup-Ordner festgelegt</div>
                            <div style="color:var(--text-secondary);font-size:12px;margin-top:4px;">Wähle einmal einen Ordner — danach läuft alles automatisch.</div>
                        `}
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                        <button class="btn btn-primary" id="fsSelectFolderBtn"><i class="ti ti-folder"></i> ${fsFolder ? 'Ordner ändern' : 'Backup-Ordner wählen'}</button>
                        ${fsFolder ? `<button class="btn" id="fsBackupNowBtn"><i class="ti ti-device-floppy"></i> Jetzt sichern</button>` : ''}
                        ${fsFolder ? `<button class="btn btn-small" id="fsListBackupsBtn"><i class="ti ti-list"></i> Vorhandene Backups</button>` : ''}
                        ${fsFolder ? `<button class="btn btn-small btn-danger" id="fsClearFolderBtn"><i class="ti ti-x"></i> Ordner entfernen</button>` : ''}
                    </div>
                    ${!fsFolder ? `
                        <div style="font-size:11px;color:var(--text-muted);padding:8px;background:var(--bg-main);border-radius:4px;">
                            <i class="ti ti-bulb"></i> <strong>Tipp:</strong> Erstelle einen Ordner namens <code>Reselling_Backups</code> in deinen Dokumenten und wähle ihn hier aus.
                            Der Browser fragt einmalig nach Berechtigung — danach läuft das Backup vollautomatisch.
                        </div>
                    ` : ''}
                `}
            </div>
            <div class="section">
                <div class="section-title">Speichernutzung</div>
                <div style="margin-bottom:12px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">
                        <span><i class="ti ti-database"></i> Buchhaltungsdaten (IndexedDB)</span>
                        <span style="color:var(--success);">${parseFloat(si.usedMB) >= 1 ? si.usedMB + ' MB' : si.usedKB + ' KB'} genutzt</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:2px;margin-bottom:8px;">
                        IndexedDB – Speicher unbegrenzt (abhängig von freiem Festplattenplatz, typisch mehrere GB verfügbar)
                    </div>
                </div>
                <div style="margin-bottom:12px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);margin-bottom:4px;">
                        <span><i class="ti ti-refresh"></i> Auto-Backups (IndexedDB)</span>
                        <span id="idbSizeDisplay" style="color:var(--success);">Berechne…</span>
                    </div>
                    <div style="background:var(--bg-main);border-radius:6px;height:8px;overflow:hidden;">
                        <div id="idbSizeBar" style="width:0%;height:100%;background:var(--success);transition:width 0.3s;border-radius:6px;"></div>
                    </div>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
                    <button class="btn btn-small" id="trimAuditBtn" style="font-size:12px;"><i class="ti ti-brush"></i> Protokolleinträge kürzen (&gt;90 Tage)</button>
                    <button class="btn btn-small" id="pruneSnapshotsBtn" style="font-size:12px;"><i class="ti ti-trash"></i> Auto-Backups bereinigen</button>
                </div>
            </div>
            <div class="section">
                <div class="section-title"><i class="ti ti-refresh"></i> Auto-Backup Verlauf</div>
                <p style="color:var(--text-secondary);font-size:12px;margin-bottom:10px;">Wird automatisch nach jeder Änderung gespeichert (letzte <strong>20 Stände</strong> + localStorage-Spiegel). Gespeichert in IndexedDB des Browsers.</p>
                <div id="idbSnapshotsList" style="font-size:13px;color:var(--text-secondary);">Lade Snapshots…</div>
            </div>
            <div class="section">
                <div class="section-title">Manuelles Backup herunterladen</div>
                <p style="margin-bottom:8px;color:var(--text-secondary);font-size:13px;">Letztes manuelles Backup: <strong>${lastBackupStr}</strong></p>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="btn btn-primary" id="exportBackupBtn"><i class="ti ti-package-export"></i> Backup herunterladen</button>
                    <button class="btn btn-secondary" id="exportEncryptedBtn"><i class="ti ti-lock"></i> Verschlüsseltes Backup</button>
                </div>
            </div>
            <div class="section" style="border:2px solid var(--accent);border-radius:8px;padding:14px;background:rgba(124,58,237,0.04);">
                <div class="section-title" style="color:var(--accent);"><i class="ti ti-shield-lock"></i> Komplett-Backup (alle Firmen, verschlüsselt)</div>
                <p style="color:var(--text-secondary);font-size:12px;margin-bottom:10px;">
                    Sichert <strong>alle Firmen</strong> in eine passphrase-verschlüsselte Datei für Gerätewechsel — kein Server, keine laufenden Kosten.
                    Import führt die Daten zusammen (neuere Einträge gewinnen). <strong>Passphrase verloren = Backup unwiederbringlich.</strong>
                </p>
                <button class="btn btn-primary" data-action="bc-open-modal"><i class="ti ti-shield-lock"></i> Komplett-Backup öffnen</button>
            </div>
            <div class="section" style="border:2px solid var(--accent);border-radius:8px;padding:14px;background:rgba(124,58,237,0.04);">
                <div class="section-title" style="color:var(--accent);"><i class="ti ti-brush"></i> Speicher aufräumen</div>
                <p style="color:var(--text-secondary);font-size:12px;margin-bottom:10px;">
                    Speicherplatz freigeben durch Komprimierung und Foto-Bereinigung. <strong>Daten bleiben GoBD-konform erhalten.</strong>
                </p>
                <button class="btn" id="openCleanupBtn"><i class="ti ti-brush"></i> Aufräum-Analyse öffnen</button>
            </div>
            <div class="section">
                <div class="section-title">Daten importieren</div>
                <p style="margin-bottom:12px;color:var(--text-secondary);font-size:13px;">Eine zuvor exportierte JSON- oder verschlüsselte .enc.json-Datei wiederherstellen.</p>
                <input type="file" accept=".json,.enc.json" id="importBackupFile" class="form-input">
            </div>
            <div class="section" style="border:2px solid var(--info);border-radius:8px;padding:14px;background:rgba(59,130,246,0.04);">
                <div class="section-title" style="color:var(--info);"><i class="ti ti-file-spreadsheet"></i> Excel-Import — Daten wiedereingeben</div>
                <p style="color:var(--text-secondary);font-size:12px;margin-bottom:10px;">
                    Daten über eine Excel-Vorlage importieren. Ideal wenn Daten manuell neu erfasst werden müssen.<br>
                    <strong>Sheets:</strong> Einkäufe · Verkäufe · Ausgaben<br>
                    Eigene Tabellen mit Spalten <strong>Kaufdatum / Einkauf / Verkauf / Verkaufsdatum</strong> (z.B. private Reselling-Listen mit einer Zeile pro Artikel) werden automatisch erkannt.
                </p>
                <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:10px;border-radius:6px;background:var(--bg-secondary);border:1px solid var(--border);font-size:12px;">
                    <i class="ti ti-building"></i>
                    <span>Import erfolgt in Firma: <strong>${Utils.escapeHtml(this._importTargetLabel())}</strong></span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                    <button class="btn btn-small" id="xlsxTemplateBtn"><i class="ti ti-download"></i> Excel-Vorlage herunterladen</button>
                    <button class="btn btn-small btn-primary" id="xlsxImportOpenBtn"><i class="ti ti-folder-open"></i> Excel-Datei importieren</button>
                </div>
                <input type="file" accept=".xlsx,.xls" id="xlsxImportFile" style="display:none;">
                <div id="xlsxImportStatus" style="font-size:12px;color:var(--text-secondary);"></div>
            </div>
            <div class="section" style="border:2px solid var(--danger);border-radius:8px;padding:14px;background:rgba(220,38,38,0.04);">
                <div class="section-title" style="color:var(--danger);"><i class="ti ti-urgent"></i> Notfall-Datenwiederherstellung</div>
                <p style="color:var(--text-secondary);font-size:12px;margin-bottom:10px;">Falls Daten verloren gegangen sind — das System prüft alle verfügbaren Quellen (Auto-Backups, localStorage-Spiegel, raw localStorage).</p>
                <button class="btn btn-danger" id="emergencyRecoverBtn"><i class="ti ti-search"></i> Verfügbare Backups prüfen &amp; wiederherstellen</button>
            </div>
            <div class="section">
                <div class="section-title">Alle Daten loeschen</div>
                <p style="margin-bottom:12px;color:var(--text-secondary);font-size:13px;">Achtung: Alle Geschaeftsdaten werden geloescht! Das Aenderungsprotokoll (Audit-Log) bleibt gemaess GoBD erhalten.</p>
                <button class="btn btn-danger" id="clearAllBtn">Geschaeftsdaten loeschen</button>
            </div>
        `;
        this.showModal('Backup & Daten', body, '');

        // Speicherschutz-Status asynchron laden und anzeigen
        Store.getStorageEstimate().then(est => {
            const block = document.getElementById('persistStorageBlock');
            if (!block) return;
            if (!est) { block.innerHTML = ''; return; }

            const usedMB  = (est.usage  / 1024 / 1024).toFixed(2);
            const quotaGB = (est.quota  / 1024 / 1024 / 1024).toFixed(1);

            // Datei-Backup aktiv → Daten sind sicher (überlebt sogar "Alle Browserdaten löschen")
            const fsActive = !!Store.getFsBackupFolderName();

            if (est.persisted) {
                // Browser hat persist() gewährt
                block.innerHTML = `
                    <div style="padding:12px 14px;border-radius:8px;background:rgba(34,197,94,0.1);border:1px solid var(--success);font-size:13px;margin-bottom:4px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                            <span style="font-size:18px;">🛡️</span>
                            <strong style="color:var(--success);">Speicher ist dauerhaft geschützt</strong>
                        </div>
                        <div style="color:var(--text-secondary);font-size:12px;line-height:1.6;">
                            Der Browser darf diese Daten <strong>nicht</strong> automatisch löschen.<br>
                            Genutzt: <strong>${usedMB} MB</strong> von <strong>${quotaGB} GB</strong> verfügbarem Kontingent.
                        </div>
                    </div>`;
            } else if (fsActive) {
                // Datei-Backup aktiv → Warnung unterdrücken, grüne Meldung zeigen
                block.innerHTML = `
                    <div style="padding:12px 14px;border-radius:8px;background:rgba(34,197,94,0.08);border:1px solid var(--success);font-size:13px;margin-bottom:4px;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">
                            <span style="font-size:18px;">✅</span>
                            <strong style="color:var(--success);">Daten sind durch Datei-Backup geschützt</strong>
                        </div>
                        <div style="color:var(--text-secondary);font-size:12px;line-height:1.6;">
                            Das Datei-Backup speichert nach jeder Änderung automatisch eine Kopie auf die Festplatte.<br>
                            Diese Datei überlebt auch "Alle Browserdaten löschen" vollständig.<br>
                            <span style="color:var(--text-muted);">Genutzt: ${usedMB} MB · Browser-persist nicht nötig solange Backup aktiv ist.</span>
                        </div>
                    </div>`;
            } else {
                // Weder persist noch FS-Backup → Warnung zeigen
                // Bei file://-URLs ist Browser-Schutz grundsätzlich nicht verfügbar (Browser-API-Einschränkung)
                const isFileProtocol = location.protocol === 'file:';
                block.innerHTML = `
                    <div style="padding:12px 14px;border-radius:8px;background:rgba(220,38,38,0.08);border:2px solid var(--danger);font-size:13px;margin-bottom:4px;">
                        <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;">
                            <span style="font-size:20px;flex-shrink:0;">⚠️</span>
                            <div>
                                <strong style="color:var(--danger);">Speicher nicht dauerhaft geschützt</strong><br>
                                <span style="color:var(--text-secondary);font-size:12px;">
                                    Chrome, Edge &amp; Firefox können bei Speicherdruck oder Browser-Reset IndexedDB-Daten löschen.<br>
                                    Genutzt: ${usedMB} MB von ${quotaGB} GB.<br>
                                    ${isFileProtocol
                                        ? '<strong>file://-URL erkannt:</strong> Browser-Schutz wird von Browsern auf lokalen Dateien nicht unterstützt. <strong>Lösung: Datei-Backup oben aktivieren</strong> (speichert dauerhaft auf die Festplatte).'
                                        : '<strong>Lösung: Datei-Backup oben aktivieren</strong> (speichert dauerhaft auf die Festplatte).'}
                                </span>
                            </div>
                        </div>
                        ${isFileProtocol
                            ? `<div style="background:rgba(251,191,36,0.15);border:1px solid var(--warning);border-radius:6px;padding:8px 12px;font-size:12px;color:var(--text-secondary);">
                                ℹ️ Browser-Schutz ist auf <code>file://</code>-URLs technisch nicht möglich — das ist kein Fehler der App.
                                Richte das <strong>Datei-Backup</strong> (oben) ein, um deine Daten dauerhaft zu sichern.
                               </div>`
                            : `<button class="btn btn-primary btn-small" id="requestPersistBtn">🛡️ Browser-Schutz versuchen</button>`}
                    </div>`;
                const persistBtn = document.getElementById('requestPersistBtn');
                if (persistBtn) {
                    persistBtn.addEventListener('click', async () => {
                        persistBtn.disabled = true;
                        persistBtn.textContent = '⏳ Anfrage läuft…';
                        const granted = await Store.requestPersistentStorage();
                        if (granted) {
                            Utils.showToast('✅ Browser-Speicherschutz aktiviert!', 'success');
                            this.closeModal();
                            this.showBackupModal();
                        } else {
                            // persist() abgelehnt (z.B. Browser-Einschränkung)
                            persistBtn.textContent = '❌ Nicht gewährt – Datei-Backup nutzen';
                            // Button bleibt disabled — kein erneutes Klicken möglich
                        }
                    });
                }
            }
        });

        // Snapshots laden und rendern (OPFS oder IDB)
        Store.getIDBSnapshots().then(snapshots => {
            const el = document.getElementById('idbSnapshotsList');
            if (!el) return;
            const idbDisplay = document.getElementById('idbSizeDisplay');
            const idbBar     = document.getElementById('idbSizeBar');

            // Speichergröße berechnen: OPFS-Snapshots = komprimierte Dateigröße, IDB = Stringlänge × 2
            const isOpfs = snapshots.length > 0 && snapshots[0]._opfs;
            const storageLabel = Store._opfsReady ? '⚡ OPFS + gzip' : '📦 IDB';

            if (snapshots && snapshots.length > 0) {
                const totalBytes = isOpfs
                    ? snapshots.reduce((sum, s) => sum + (s.size || 0), 0)   // komprimierte OPFS-Größe
                    : snapshots.reduce((sum, s) => sum + (s.data ? s.data.length * 2 : 0), 0); // IDB unkomprimiert
                const totalMB = totalBytes / 1024 / 1024;
                const totalKB = totalBytes / 1024;
                // Warnschwelle: OPFS < 5 MB unkritisch (gzip ~85% kleiner); IDB: < 15 MB ok
                const warnThresh  = isOpfs ? 2 * 1024 * 1024 : 8  * 1024 * 1024;
                const dangerThresh = isOpfs ? 4 * 1024 * 1024 : 15 * 1024 * 1024;
                const idbColor = totalBytes > dangerThresh ? 'var(--danger)' : totalBytes > warnThresh ? 'var(--warning)' : 'var(--success)';
                const sizeStr = totalMB >= 1 ? `${totalMB.toFixed(2)} MB` : `${totalKB.toFixed(0)} KB`;
                if (idbDisplay) {
                    idbDisplay.textContent = `${sizeStr} (${snapshots.length} Stände · ${storageLabel})`;
                    idbDisplay.style.color = idbColor;
                }
                const refMB = isOpfs ? 3 : 20; // Referenzwert für den Fortschrittsbalken
                const pct = Math.min(100, (totalMB / refMB) * 100).toFixed(1);
                if (idbBar) { idbBar.style.width = pct + '%'; idbBar.style.background = idbColor; }
            } else {
                if (idbDisplay) { idbDisplay.textContent = `Leer (${storageLabel})`; idbDisplay.style.color = 'var(--text-muted)'; }
                if (idbBar) idbBar.style.width = '0%';
            }

            if (!snapshots || snapshots.length === 0) {
                el.innerHTML = '<span style="color:var(--text-muted);">Noch keine Auto-Backups vorhanden.</span>';
                return;
            }
            el.innerHTML = snapshots.map(s => {
                const d = new Date(s.ts);
                const dateStr = d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', {hour:'2-digit',minute:'2-digit'});
                // Größe: OPFS = echte komprimierte Dateigröße; IDB = Stringlänge
                const sizeKB = s._opfs
                    ? ((s.size || 0) / 1024).toFixed(1)
                    : ((s.data ? s.data.length / 1024 : 0)).toFixed(1);
                const badge = s._opfs
                    ? `<span style="font-size:10px;color:var(--info);margin-left:6px;" title="Komprimiert im OPFS gespeichert">⚡gz</span>`
                    : '';
                return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);">
                    <div>
                        <span style="font-weight:500;color:var(--text-primary);">${dateStr}</span>
                        <span style="font-size:11px;color:var(--text-muted);margin-left:8px;">${sizeKB} KB</span>
                        ${badge}
                    </div>
                    <button class="btn btn-small btn-warning" data-restore-idb="${Utils.escapeHtml(s.id)}" style="font-size:11px;">Wiederherstellen</button>
                </div>`;
            }).join('');

            el.querySelectorAll('[data-restore-idb]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id   = btn.dataset.restoreIdb;
                    const snap = snapshots.find(s => s.id === id);
                    const d    = snap ? new Date(snap.ts).toLocaleString('de-DE') : '';
                    if (!confirm(`Daten vom ${d} wiederherstellen?\n\nAktuelle Daten werden überschrieben!`)) return;
                    Store.restoreFromIDBSnapshot(id).then(() => {
                        Utils.showToast('✅ Daten wiederhergestellt', 'success');
                        this.closeModal();
                        App.navigate(App.currentPage);
                    }).catch(err => {
                        Utils.showToast('Fehler: ' + err, 'error');
                    });
                });
            });
        });

        document.getElementById('pruneSnapshotsBtn').addEventListener('click', () => {
            Store.getIDBSnapshots().then(snapshots => {
                const count = snapshots.length;
                const keepCount = Math.min(5, count);
                const deleteCount = count - keepCount;
                if (deleteCount <= 0) {
                    Utils.showToast(`Nur ${count} Auto-Backup${count !== 1 ? 's' : ''} vorhanden — nichts zu bereinigen.`, 'info');
                    return;
                }
                if (confirm(`${deleteCount} alte Auto-Backup${deleteCount !== 1 ? 's' : ''} löschen und nur die neuesten ${keepCount} behalten?\n\nSpeicherplatz wird sofort freigegeben.`)) {
                    Store._emergencyPruneSnapshots(keepCount).then(() => {
                        Utils.showToast(`🧹 ${deleteCount} alte Auto-Backups gelöscht — Speicher freigegeben.`, 'success');
                        this.closeModal();
                        this.showBackupModal();
                    });
                }
            });
        });

        document.getElementById('trimAuditBtn').addEventListener('click', () => {
            const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
            const log = Store.getAuditLog();
            const trimmed = log.filter(e => !e.timestamp || e.timestamp >= cutoff);
            const removed = log.length - trimmed.length;
            if (removed === 0) {
                Utils.showToast('Keine alten Einträge gefunden (< 90 Tage)', 'info');
                return;
            }
            if (confirm(`${removed} Protokolleinträge (älter als 90 Tage) löschen?`)) {
                const trimmedStr = JSON.stringify(trimmed);
                Store._cache[Store._auditKey] = trimmedStr;
                Store._idbPut(Store._auditKey, trimmedStr);
                Utils.showToast(`${removed} Einträge gekürzt – Speicher freigegeben`, 'success');
                this.closeModal();
                this.showBackupModal();
            }
        });

        // ---- Datei-Backup Buttons ----
        const fsSelectBtn = document.getElementById('fsSelectFolderBtn');
        if (fsSelectBtn) {
            fsSelectBtn.addEventListener('click', async () => {
                try {
                    fsSelectBtn.disabled = true;
                    fsSelectBtn.textContent = '⏳ Ordner wird gewählt…';
                    const handle = await Store.selectBackupFolder();
                    // Sofort ein Backup schreiben um Berechtigung zu testen
                    const filename = await Store.writeFileSystemBackup('einrichtung');
                    this._updateFsBackupStatus(handle.name, true);
                    Utils.showToast(`✅ Backup-Ordner gesetzt: ${handle.name}${filename ? ` — ${filename} erstellt` : ''}`, 'success');
                    this.closeModal();
                    this.showBackupModal();
                } catch(err) {
                    if (err.name !== 'AbortError') {
                        Utils.showToast('Fehler: ' + err.message, 'error');
                    }
                    if (fsSelectBtn) {
                        fsSelectBtn.disabled = false;
                        fsSelectBtn.textContent = '📁 Backup-Ordner wählen';
                    }
                }
            });
        }

        const fsNowBtn = document.getElementById('fsBackupNowBtn');
        if (fsNowBtn) {
            fsNowBtn.addEventListener('click', async () => {
                fsNowBtn.disabled = true;
                fsNowBtn.textContent = '⏳ Schreibe…';
                // Berechtigung ggf. erneut anfragen (benötigt User-Geste ✓)
                if (!Store.getFsBackupFolderName()) {
                    const granted = await Store.requestFsPermission();
                    if (!granted) {
                        Utils.showToast('Berechtigung verweigert — bitte Ordner neu wählen', 'error');
                        fsNowBtn.disabled = false;
                        fsNowBtn.textContent = '💾 Jetzt sichern';
                        return;
                    }
                }
                App.showSpinner('Backup wird geschrieben…');
                const filename = await Store.writeFileSystemBackup('manuell');
                App.hideSpinner();
                if (filename) {
                    Utils.showToast(`✅ Backup gespeichert: ${filename}`, 'success');
                    this.closeModal();
                    this.showBackupModal();
                } else {
                    Utils.showToast('Backup fehlgeschlagen — Ordner ggf. neu wählen', 'error');
                    fsNowBtn.disabled = false;
                    fsNowBtn.textContent = '💾 Jetzt sichern';
                }
            });
        }

        const fsListBtn = document.getElementById('fsListBackupsBtn');
        if (fsListBtn) {
            fsListBtn.addEventListener('click', async () => {
                fsListBtn.disabled = true;
                fsListBtn.textContent = '⏳ Lade Liste…';
                const files = await Store.listFileSystemBackups();
                fsListBtn.disabled = false;
                fsListBtn.textContent = '📋 Vorhandene Backups';
                if (files.length === 0) {
                    Utils.showToast('Keine Backup-Dateien im Ordner gefunden', 'info');
                    return;
                }
                const listHtml = files.slice(0, 30).map(f => {
                    // Datum aus Dateiname extrahieren — funktioniert mit und ohne Firmenname
                    const m = f.name.match(/(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/);
                    const dateStr = m ? `${m[1]} ${m[2].replace(/-/g, ':')}` : f.name;
                    // Typ-Label aus Dateiname (auto / manuell / periodic / einrichtung …)
                    const typeLabel = f.name.replace(/^backup[^_]*_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_?/, '').replace(/\.(zip|json)$/, '') || 'auto';
                    // Backups einer anderen Firma werden erkennbar markiert
                    const otherFirma = !f.isCurrentCompany;
                    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);gap:8px;${otherFirma ? 'opacity:0.6;' : ''}">
                        <div style="font-size:13px;min-width:0;">
                            <span style="font-weight:500;">${dateStr}</span>
                            <span style="font-size:11px;color:var(--text-muted);margin-left:6px;">${Utils.escapeHtml(typeLabel)}</span>
                            ${otherFirma ? `<span style="font-size:10px;background:var(--warning-bg);color:var(--warning);border-radius:4px;padding:1px 5px;margin-left:6px;">andere Firma</span>` : ''}
                        </div>
                        <button class="btn btn-small btn-warning" data-fs-restore="${Utils.escapeHtml(f.name)}" style="white-space:nowrap;flex-shrink:0;">Wiederherstellen</button>
                    </div>`;
                }).join('');
                const otherCount = files.filter(f => !f.isCurrentCompany).length;
                const totalExtra = files.length > 30 ? `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">… und ${files.length - 30} weitere</div>` : '';
                const modalBody = `
                    <div style="margin-bottom:10px;font-size:13px;color:var(--text-secondary);">
                        📂 Ordner: <strong>${Utils.escapeHtml(Store.getFsBackupFolderName())}</strong>
                        &nbsp;·&nbsp; ${files.length} Backup-Datei(en)
                        ${otherCount > 0 ? `<span style="font-size:11px;color:var(--text-muted);margin-left:8px;">(${otherCount} von anderen Firmen — gedimmt)</span>` : ''}
                    </div>
                    <div style="max-height:400px;overflow-y:auto;">${listHtml}${totalExtra}</div>
                `;
                this.showModal('📋 Backup-Dateien im Ordner', modalBody, '');

                // Restore aus Datei
                document.querySelectorAll('[data-fs-restore]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const name = btn.dataset.fsRestore;
                        const entry = files.find(f => f.name === name);
                        if (!entry) return;
                        if (!confirm(`"${name}" wiederherstellen?\n\nAlle aktuellen Daten werden überschrieben!`)) return;
                        try {
                            btn.disabled = true;
                            btn.textContent = '⏳';
                            App.showSpinner('Backup wird wiederhergestellt…');
                            const jsonStr = await Store.readFileSystemBackup(entry.handle);
                            Store.importAll(jsonStr);
                            App.hideSpinner();
                            Utils.showToast('✅ Aus Datei-Backup wiederhergestellt', 'success');
                            this.closeModal();
                            this.navigate(this.currentPage);
                        } catch(err) {
                            App.hideSpinner();
                            Utils.showToast('Fehler: ' + err.message, 'error');
                            btn.disabled = false;
                            btn.textContent = 'Wiederherstellen';
                        }
                    });
                });
            });
        }

        const fsClearBtn = document.getElementById('fsClearFolderBtn');
        if (fsClearBtn) {
            fsClearBtn.addEventListener('click', () => {
                if (!confirm('Datei-Backup deaktivieren?\nDer Ordner und seine Dateien werden NICHT gelöscht.')) return;
                Store._clearFsHandle();
                this._updateFsBackupStatus(null, false);
                Utils.showToast('Datei-Backup deaktiviert', 'info');
                this.closeModal();
                this.showBackupModal();
            });
        }

        document.getElementById('exportBackupBtn').addEventListener('click', () => {
            const data = Store.exportAll();
            const filename = 'reselling_backup_' + Utils.todayISO() + '.json';
            Utils.downloadFile(data, filename, 'application/json');
            localStorage.setItem('last_backup_date', new Date().toISOString());
            Utils.showToast('Backup heruntergeladen', 'success');
        });

        const cleanupBtn = document.getElementById('openCleanupBtn');
        if (cleanupBtn) cleanupBtn.addEventListener('click', () => this.showCleanupModal());

        document.getElementById('exportEncryptedBtn').addEventListener('click', () => {
            const pw = prompt('Passwort für verschlüsseltes Backup (mind. 8 Zeichen):');
            if (!pw) return;
            if (pw.length < 8) { Utils.showToast('Passwort zu kurz (min. 8 Zeichen)', 'error'); return; }
            const pw2 = prompt('Passwort bestätigen:');
            if (pw !== pw2) { Utils.showToast('Passwörter stimmen nicht überein', 'error'); return; }
            this._encryptBackup(Store.exportAll(), pw).then(enc => {
                const filename = 'reselling_backup_' + Utils.todayISO() + '.enc.json';
                Utils.downloadFile(JSON.stringify(enc), filename, 'application/json');
                localStorage.setItem('last_backup_date', new Date().toISOString());
                Utils.showToast('Verschlüsseltes Backup heruntergeladen', 'success');
            }).catch(err => Utils.showToast('Fehler: ' + err.message, 'error'));
        });

        document.getElementById('importBackupFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            // Dateigröße prüfen (max 50 MB)
            if (file.size > 50 * 1024 * 1024) {
                Utils.showToast('Backup-Datei zu groß (max. 50 MB)', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const raw = ev.target.result;
                    const parsed = JSON.parse(raw);

                    // Verschlüsseltes Backup erkennen
                    let jsonStr = raw;
                    if (parsed && parsed._encrypted === true) {
                        const pw = prompt('Passwort für verschlüsseltes Backup:');
                        if (!pw) return;
                        jsonStr = await this._decryptBackup(parsed, pw);
                    }

                    // Strict-Validation vor dem Import
                    const data = JSON.parse(jsonStr);
                    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                        throw new Error('Ungültiges Backup-Format');
                    }
                    // Nur erlaubte Schlüssel-Präfixe zulassen
                    const ALLOWED_PREFIXES = [
                        'reselling_',       // Einfirmen-Reselling-Daten
                        'rechnungsbuch_',   // Einfirmen-Rechnungsbuch-Daten
                        'co_',              // Multi-Firmen-Prefix (co_xxx__reselling_*)
                        'audit_log',        // Audit-Log ohne Firma-Prefix
                        '_',                // Alle Meta-Schlüssel (_exportMeta, _eigenbelege, _appSettings)
                    ];
                    const forbidden = Object.keys(data).filter(k =>
                        !ALLOWED_PREFIXES.some(p => k.startsWith(p))
                    );
                    if (forbidden.length > 0) {
                        throw new Error('Backup enthält unbekannte Schlüssel: ' + forbidden.slice(0, 3).join(', '));
                    }
                    // Werte dürfen keine Prototype-Pollution enthalten
                    for (const [key, val] of Object.entries(data)) {
                        const serialized = JSON.stringify(val);
                        if (serialized === undefined) throw new Error('Nicht-serialisierbarer Wert in: ' + key);
                        if (serialized.includes('__proto__') || serialized.includes('constructor')) {
                            throw new Error('Sicherheitsproblem erkannt in: ' + key);
                        }
                    }
                    // Backup-Metadaten prüfen
                    if (!data._exportMeta) {
                        if (!confirm('Diese Datei enthält keine Backup-Metadaten. Trotzdem importieren?')) return;
                    }
                    App.showSpinner('Backup wird importiert…');
                    Store.importAll(jsonStr);
                    App.hideSpinner();
                    Utils.showToast('Backup erfolgreich importiert', 'success');
                    this.closeModal();
                    this.navigate(this.currentPage);
                } catch (err) {
                    App.hideSpinner();
                    Utils.showToast('Fehler beim Import: ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
        });

        // ---- Excel Template Download ----
        document.getElementById('xlsxTemplateBtn').addEventListener('click', () => {
            if (typeof XLSX === 'undefined') { Utils.showToast('XLSX-Bibliothek nicht geladen', 'error'); return; }
            const wb = XLSX.utils.book_new();

            // Sheet 1: Einkäufe
            const einkaufHeader = ['Datum (JJJJ-MM-TT)', 'Marke', 'Artikeltyp', 'Größe', 'Beschreibung', 'EK-Preis (€)', 'Anzahl', 'Einkaufsquelle', 'Notizen'];
            const einkaufExample = ['2026-01-15', 'Nike', 'Schuhe', '42', 'Air Max 90 White', '80', '1', 'Privatkauf', ''];
            const wsEinkauf = XLSX.utils.aoa_to_sheet([einkaufHeader, einkaufExample]);
            wsEinkauf['!cols'] = einkaufHeader.map(h => ({ wch: Math.max(h.length + 2, 16) }));
            XLSX.utils.book_append_sheet(wb, wsEinkauf, 'Einkäufe');

            // Sheet 2: Verkäufe
            const verkaufHeader = ['Datum (JJJJ-MM-TT)', 'Marke', 'Artikeltyp', 'Größe', 'Beschreibung', 'Verkaufspreis (€)', 'Versand-Käufer (€)', 'Plattformgebühr (%)', 'Versand-Verkäufer (€)', 'Verkaufsplattform', 'Käufer', 'Notizen'];
            const verkaufExample = ['2026-01-20', 'Nike', 'Schuhe', '42', 'Air Max 90 White', '150', '0', '5', '4.99', 'Vinted', 'Max Muster', ''];
            const wsVerkauf = XLSX.utils.aoa_to_sheet([verkaufHeader, verkaufExample]);
            wsVerkauf['!cols'] = verkaufHeader.map(h => ({ wch: Math.max(h.length + 2, 16) }));
            XLSX.utils.book_append_sheet(wb, wsVerkauf, 'Verkäufe');

            // Sheet 3: Ausgaben
            const ausgabenHeader = ['Datum (JJJJ-MM-TT)', 'Kategorie', 'Beschreibung', 'Betrag (€)', 'Plattform / Lieferant', 'Notizen'];
            const ausgabenExample = ['2026-01-10', 'Versandmaterial', 'Bubble-Wrap Rolle', '12.99', 'Amazon', ''];
            const wsAusgaben = XLSX.utils.aoa_to_sheet([ausgabenHeader, ausgabenExample]);
            wsAusgaben['!cols'] = ausgabenHeader.map(h => ({ wch: Math.max(h.length + 2, 16) }));
            XLSX.utils.book_append_sheet(wb, wsAusgaben, 'Ausgaben');

            // Sheet 4: Anleitung
            const anleitung = [
                ['ANLEITUNG — Reselling Tool Excel-Import'],
                [''],
                ['1. Fülle die Sheets "Einkäufe", "Verkäufe" und "Ausgaben" mit deinen Daten aus.'],
                ['2. Lösche die Beispielzeilen (Zeile 2) wenn du eigene Daten einträgst.'],
                ['3. Speichere die Datei als .xlsx.'],
                ['4. Öffne Backup & Daten → Excel-Datei importieren.'],
                [''],
                ['WICHTIG:'],
                ['- Datum immer im Format JJJJ-MM-TT (z.B. 2026-05-03)'],
                ['- Preise mit Punkt als Dezimaltrennzeichen (z.B. 80.50) ODER Komma (80,50) — beides wird erkannt'],
                ['- Leere Zeilen werden automatisch übersprungen'],
                ['- Du kannst nur einzelne Sheets befüllen — leere Sheets werden ignoriert'],
            ];
            const wsAnleitung = XLSX.utils.aoa_to_sheet(anleitung);
            wsAnleitung['!cols'] = [{ wch: 70 }];
            XLSX.utils.book_append_sheet(wb, wsAnleitung, 'Anleitung');

            XLSX.writeFile(wb, 'reselling_import_vorlage.xlsx');
            Utils.showToast('Excel-Vorlage heruntergeladen', 'success');
        });

        // ---- Excel Import ----
        document.getElementById('xlsxImportOpenBtn').addEventListener('click', () => {
            document.getElementById('xlsxImportFile').click();
        });

        document.getElementById('xlsxImportFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (typeof XLSX === 'undefined') { Utils.showToast('XLSX-Bibliothek nicht geladen', 'error'); return; }

            if (!confirm(`"${file.name}" wird importiert in Firma: ${this._importTargetLabel()}.\n\nIst das die richtige Firma?`)) {
                e.target.value = '';
                return;
            }

            const statusEl = document.getElementById('xlsxImportStatus');
            if (statusEl) statusEl.textContent = '⏳ Lese Datei…';

            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
                    let importedEinkauf = 0, importedVerkauf = 0, importedAusgaben = 0, skipped = 0;

                    const parseNum = v => {
                        if (v === null || v === undefined || v === '') return 0;
                        return parseFloat(String(v).replace(',', '.')) || 0;
                    };
                    const parseDate = v => {
                        if (!v) return Utils.todayISO();
                        if (v instanceof Date) return v.toLocaleDateString('sv-SE');
                        const s = String(v).trim();
                        // JJJJ-MM-TT oder TT.MM.JJJJ
                        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
                        const parts = s.split('.');
                        if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                        return Utils.todayISO();
                    };

                    // -- Einkäufe --
                    const wsE = wb.Sheets['Einkäufe'] || wb.Sheets['Einkaeufe'] || wb.Sheets['einkauf'] || wb.Sheets['Einkauf'];
                    if (wsE) {
                        const rows = XLSX.utils.sheet_to_json(wsE, { header: 1, defval: '' });
                        rows.slice(1).forEach(r => {
                            const datum = parseDate(r[0]);
                            const marke = String(r[1] || '').trim();
                            const beschreibung = String(r[4] || '').trim();
                            if (!marke && !beschreibung) { skipped++; return; }
                            const purchase = {
                                datum,
                                marke,
                                artikeltyp: String(r[2] || 'Sonstiges').trim(),
                                groesse: String(r[3] || '').trim(),
                                beschreibung,
                                einkaufspreis: parseNum(r[5]),
                                anzahl: parseInt(r[6]) || 1,
                                einkaufsquelle: String(r[7] || 'Sonstiges').trim() || 'Sonstiges',
                                notizen: String(r[8] || '').trim(),
                                status: 'verfuegbar'
                            };
                            if (purchase.marke) Store.addBrand(purchase.marke);
                            if (purchase.einkaufsquelle) Store.addEinkaufsquelle(purchase.einkaufsquelle);
                            Store.savePurchase(purchase);
                            importedEinkauf++;
                        });
                    }

                    // -- Verkäufe --
                    const wsV = wb.Sheets['Verkäufe'] || wb.Sheets['Verkauefe'] || wb.Sheets['verkauf'] || wb.Sheets['Verkauf'];
                    if (wsV) {
                        const rows = XLSX.utils.sheet_to_json(wsV, { header: 1, defval: '' });
                        rows.slice(1).forEach(r => {
                            const marke = String(r[1] || '').trim();
                            const beschreibung = String(r[4] || '').trim();
                            if (!marke && !beschreibung) { skipped++; return; }
                            const sale = {
                                datum: parseDate(r[0]),
                                marke,
                                artikeltyp: String(r[2] || '').trim(),
                                groesse: String(r[3] || '').trim(),
                                beschreibung,
                                verkaufspreis: parseNum(r[5]),
                                versandkostenKaeufer: parseNum(r[6]),
                                plattformgebuehrProzent: parseNum(r[7]),
                                versandkostenVerkaufer: parseNum(r[8]),
                                verkaufsplattform: String(r[9] || '').trim(),
                                kaeufer: String(r[10] || '').trim(),
                                notizen: String(r[11] || '').trim()
                            };
                            if (sale.verkaufsplattform) Store.addPlatform(sale.verkaufsplattform);
                            Store.saveSale(sale);
                            importedVerkauf++;
                        });
                    }

                    // -- Ausgaben --
                    const wsA = wb.Sheets['Ausgaben'] || wb.Sheets['ausgaben'] || wb.Sheets['Ausgabe'];
                    if (wsA) {
                        const rows = XLSX.utils.sheet_to_json(wsA, { header: 1, defval: '' });
                        rows.slice(1).forEach(r => {
                            const beschreibung = String(r[2] || '').trim();
                            const betrag = parseNum(r[3]);
                            if (!beschreibung && !betrag) { skipped++; return; }
                            const expense = {
                                datum: parseDate(r[0]),
                                kategorie: String(r[1] || 'Sonstiges').trim(),
                                beschreibung,
                                betrag,
                                plattform: String(r[4] || '').trim(),
                                notizen: String(r[5] || '').trim()
                            };
                            Store.saveExpense(expense);
                            importedAusgaben++;
                        });
                    }

                    // -- Fallback: einzelne Tabelle mit Kaufdatum/Einkauf/Verkauf/Verkaufsdatum-Spalten --
                    // (z.B. private Reselling-Listen mit einer Zeile pro Artikel statt den 3 Vorlagen-Sheets)
                    if (!wsE && !wsV && !wsA) {
                        const normHeader = h => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        wb.SheetNames.forEach(sheetName => {
                            const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });

                            let col = null;
                            for (let i = 0; i < Math.min(rows.length, 30); i++) {
                                const cand = {};
                                let woSeen = 0;
                                rows[i].forEach((h, ci) => {
                                    const n = normHeader(h);
                                    if (n === 'kaufdatum') cand.kaufdatum = ci;
                                    else if (n === 'verkaufsdatum') cand.verkaufsdatum = ci;
                                    else if (n === 'was' || n.includes('artikel') || n.includes('produkt')) cand.beschreibung = ci;
                                    else if (n === 'einkauf') cand.einkauf = ci;
                                    else if (n === 'verkauf') cand.verkauf = ci;
                                    else if (/^wo\d*$/.test(n)) { woSeen++; if (woSeen === 1) cand.quelle = ci; else cand.plattform = ci; }
                                });
                                if (cand.kaufdatum !== undefined && cand.einkauf !== undefined && cand.verkauf !== undefined) { col = cand; rows.splice(0, i + 1); break; }
                            }
                            if (!col) return;

                            rows.forEach(r => {
                                const kaufdatumRaw = r[col.kaufdatum];
                                if (!kaufdatumRaw) return; // Summen-/Leerzeilen überspringen
                                const beschreibung = col.beschreibung !== undefined ? String(r[col.beschreibung] || '').trim() : '';
                                const quelle = col.quelle !== undefined ? String(r[col.quelle] || '').trim() : '';
                                const einkaufspreis = parseNum(r[col.einkauf]);
                                if (!beschreibung && !einkaufspreis) { skipped++; return; }

                                const purchase = {
                                    datum: parseDate(kaufdatumRaw),
                                    marke: '',
                                    artikeltyp: 'Sonstiges',
                                    groesse: '',
                                    beschreibung,
                                    einkaufspreis,
                                    anzahl: 1,
                                    einkaufsquelle: quelle || 'Sonstiges',
                                    notizen: '',
                                    status: 'verfuegbar'
                                };
                                if (purchase.einkaufsquelle) Store.addEinkaufsquelle(purchase.einkaufsquelle);
                                const saved = Store.savePurchase(purchase);
                                importedEinkauf++;

                                const verkaufsdatumRaw = col.verkaufsdatum !== undefined ? r[col.verkaufsdatum] : null;
                                const verkaufRaw = col.verkauf !== undefined ? r[col.verkauf] : '';
                                const hatVerkauf = !!verkaufsdatumRaw || (verkaufRaw !== '' && verkaufRaw !== null && verkaufRaw !== undefined);
                                if (hatVerkauf) {
                                    const plattform = col.plattform !== undefined ? String(r[col.plattform] || '').trim() : '';
                                    const datumFallback = !verkaufsdatumRaw;
                                    const sale = {
                                        datum: datumFallback ? parseDate(kaufdatumRaw) : parseDate(verkaufsdatumRaw),
                                        marke: '',
                                        artikeltyp: 'Sonstiges',
                                        groesse: '',
                                        beschreibung,
                                        verkaufspreis: parseNum(verkaufRaw),
                                        versandkostenKaeufer: 0,
                                        plattformgebuehrProzent: 0,
                                        versandkostenVerkaufer: 0,
                                        verkaufsplattform: plattform,
                                        kaeufer: '',
                                        notizen: datumFallback ? 'Verkaufsdatum unbekannt – Kaufdatum übernommen' : '',
                                        purchaseId: saved.id
                                    };
                                    if (sale.verkaufsplattform) Store.addPlatform(sale.verkaufsplattform);
                                    Store.saveSale(sale);
                                    importedVerkauf++;
                                }
                            });
                        });
                    }

                    const msg = [
                        importedEinkauf > 0 ? `${importedEinkauf} Einkäufe` : '',
                        importedVerkauf > 0 ? `${importedVerkauf} Verkäufe` : '',
                        importedAusgaben > 0 ? `${importedAusgaben} Ausgaben` : '',
                    ].filter(Boolean).join(', ') || '0 Datensätze';

                    if (statusEl) statusEl.innerHTML = `<span style="color:var(--success);">✅ Importiert: ${msg}${skipped > 0 ? ` (${skipped} leere Zeilen übersprungen)` : ''}</span>`;
                    Utils.showToast(`Import abgeschlossen: ${msg}`, 'success');
                    e.target.value = '';
                    // Kurze Verzögerung dann View aktualisieren
                    setTimeout(() => this.navigate(this.currentPage), 1200);

                } catch(err) {
                    if (statusEl) statusEl.innerHTML = `<span style="color:var(--danger);">❌ Fehler: ${Utils.escapeHtml(err.message)}</span>`;
                    Utils.showToast('Import-Fehler: ' + err.message, 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        });

        document.getElementById('emergencyRecoverBtn').addEventListener('click', () => {
            const btn = document.getElementById('emergencyRecoverBtn');
            if (btn) { btn.disabled = true; btn.textContent = '⏳ Prüfe Quellen…'; }
            Store.emergencyRecover().then(results => {
                if (!results || results.length === 0) {
                    Utils.showToast('Keine Backup-Quellen gefunden. Leider kein Recovery möglich.', 'error');
                    if (btn) { btn.disabled = false; btn.textContent = '🔍 Verfügbare Backups prüfen & wiederherstellen'; }
                    return;
                }

                // Dialog mit gefundenen Quellen
                const opts = results.map((r, i) => `
                    <div style="border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:8px;cursor:pointer;transition:background .15s;"
                         class="recovery-option" data-idx="${i}"
                         class="hover-bg-main">
                        <div style="font-weight:600;font-size:13px;">📦 ${Utils.escapeHtml(r.label)}</div>
                        <div style="font-size:11px;color:var(--text-muted);">Quelle: ${Utils.escapeHtml(r.source)}</div>
                    </div>
                `).join('');

                const body = `
                    <div style="margin-bottom:12px;padding:10px;background:rgba(220,38,38,0.06);border-radius:6px;font-size:13px;">
                        ⚠️ <strong>${results.length} Backup-Quelle(n) gefunden.</strong><br>
                        Wähle einen Stand zum Wiederherstellen. <em>Aktuelle Daten werden überschrieben!</em>
                    </div>
                    ${opts}
                `;
                this.showModal('🚨 Notfall-Wiederherstellung', body, '');

                results.forEach((r, i) => {
                    const el = document.querySelector(`.recovery-option[data-idx="${i}"]`);
                    if (!el) return;
                    el.addEventListener('click', () => {
                        if (!confirm(`"${r.label}" jetzt wiederherstellen?\n\nDies überschreibt alle aktuellen Daten!`)) return;

                        const doRestore = () => {
                            Utils.showToast('Daten wiederhergestellt ✅', 'success');
                            this.closeModal();
                            this.navigate(this.currentPage);
                        };

                        if (r.source === 'AutoBackup-IDB') {
                            Store.restoreFromIDBSnapshot(r.id)
                                .then(doRestore)
                                .catch(err => Utils.showToast('Fehler: ' + err, 'error'));
                        } else if (r.source === 'localStorage-Raw') {
                            const n = Store.restoreFromLocalStorageRaw();
                            Utils.showToast(`${n} Schlüssel aus localStorage wiederhergestellt`, 'success');
                            this.closeModal();
                            this.navigate(this.currentPage);
                        } else {
                            // localStorage-Spiegel
                            try {
                                Store.importAll(r.data);
                                doRestore();
                            } catch(e) {
                                Utils.showToast('Fehler beim Restore: ' + e.message, 'error');
                            }
                        }
                    });
                });
            });
        });

        document.getElementById('clearAllBtn').addEventListener('click', () => {
            // Gesichertes Löschen: Nutzer muss "LÖSCHEN" tippen
            const body = `
                <div style="margin-bottom:16px;padding:14px;background:rgba(220,38,38,0.1);border-radius:8px;border:2px solid var(--danger);">
                    <div style="font-weight:700;color:var(--danger);font-size:16px;margin-bottom:8px;">⛔ Warnung: Unwiderrufliche Aktion</div>
                    <p style="color:var(--text-secondary);font-size:13px;margin:0 0 8px;">
                        Folgende Daten werden <strong>unwiderruflich gelöscht</strong>:
                    </p>
                    <ul style="color:var(--text-secondary);font-size:12px;margin:0 0 8px 18px;padding:0;">
                        <li>Einkäufe, Verkäufe, Ausgaben, Lager-Artikel</li>
                        <li>Rechnungen, Angebote, Kunden, Produkte (Rechnungsbuch)</li>
                        <li>Eigenbelege &amp; Eigenbeleg-Stammdaten</li>
                        <li>Akademie-Fortschritt &amp; Achievements</li>
                    </ul>
                    <p style="color:var(--text-secondary);font-size:12px;margin:0 0 8px;">
                        ✅ <strong>Erhalten bleiben:</strong> Audit-Log (GoBD), App-Einstellungen, Theme, Backup-Konfiguration, Passwort.
                    </p>
                    <p style="color:var(--text-secondary);font-size:12px;margin:0;">
                        ${(typeof CloudSync !== 'undefined' && document.getElementById('cloudSyncDot') && localStorage.getItem('oyi_sync_enabled') === '1')
                            ? '☁ Bei aktivem Cloud-Sync wird auch der verschlüsselte Cloud-Stand dieser Firma gelöscht.'
                            : ''}
                    </p>
                </div>
                <div class="form-group">
                    <label class="form-label" style="color:var(--danger);">Tippe <strong>LÖSCHEN</strong> zur Bestätigung:</label>
                    <input type="text" class="form-input" id="deleteConfirmInput" placeholder="LÖSCHEN" autocomplete="off">
                </div>
            `;
            const footer = `
                <button class="btn" data-action="close-modal">Abbrechen</button>
                <button class="btn btn-danger" id="confirmDeleteBtn" disabled>Endgültig löschen</button>
            `;
            this.showModal('Alle Daten löschen', body, footer);

            const input = document.getElementById('deleteConfirmInput');
            const confirmBtn = document.getElementById('confirmDeleteBtn');
            input.addEventListener('input', () => {
                confirmBtn.disabled = input.value !== 'LÖSCHEN';
            });
            confirmBtn.addEventListener('click', () => {
                if (input.value !== 'LÖSCHEN') return;
                // Sofortiges Backup vor dem Löschen (falls Ordner konfiguriert)
                const doDelete = async () => {
                    const scope = typeof CompanyManager !== 'undefined' ? CompanyManager.getActiveId() : '';
                    Store.clearAll();
                    // Art. 17 DSGVO: Cloud-Löschung abwarten, sonst holt der nächste Sync die
                    // gelöschten Daten aus der Cloud zurück, bevor der Server-Snapshot entfernt ist.
                    let cloudOk = true;
                    if (scope && typeof CloudSync !== 'undefined') cloudOk = await CloudSync.deleteRemote(scope);
                    if (cloudOk) {
                        Utils.showToast('Alle Daten gelöscht', 'warning');
                    } else {
                        Utils.showToast('Lokale Daten gelöscht — Cloud-Löschung fehlgeschlagen. Bitte Internetverbindung prüfen; beim nächsten Sync-Versuch wird erneut versucht.', 'error');
                    }
                    this.closeModal();
                    location.reload();
                };
                if (Store.getFsBackupFolderName()) {
                    Store.writeFileSystemBackup('vor_loeschung').finally(doDelete);
                } else {
                    doDelete();
                }
            });
        });
    },

    // ============================================
    // Speicher aufräumen Modal
    // ============================================
    showCleanupModal() {
        // Analyse: was belegt wieviel Speicher?
        const purchases = Store.getPurchases(true);
        const sales     = Store.getSales(true);

        const purchasesWithFoto = purchases.filter(p => p.foto);
        const verkaufteFotos    = purchases.filter(p => p.foto && p.status === 'verkauft');
        const storno            = purchases.filter(p => p.storniert);
        const stornoMitFoto     = storno.filter(p => p.foto);

        // Foto-Größe schätzen (base64 → Bytes ≈ length × 0.75)
        const fotoBytes = arr => arr.reduce((s, p) => s + (p.foto ? p.foto.length * 0.75 : 0), 0);
        const fmt = bytes => bytes > 1024*1024 ? (bytes/1024/1024).toFixed(1) + ' MB' : (bytes/1024).toFixed(0) + ' KB';

        const totalPhotoBytes = fotoBytes(purchasesWithFoto);
        const verkaufteBytes  = fotoBytes(verkaufteFotos);
        const stornoBytes     = fotoBytes(stornoMitFoto);

        const body = `
            <div style="display:flex;flex-direction:column;gap:14px;">

                <div style="background:rgba(99,102,241,.08);border:1px solid var(--border);border-radius:8px;padding:12px 16px;font-size:13px;">
                    <div style="font-weight:700;margin-bottom:6px;">📊 Aktuelle Analyse</div>
                    <div style="display:grid;grid-template-columns:1fr auto;gap:4px 12px;">
                        <span>Artikel mit Foto</span><span><strong>${purchasesWithFoto.length}</strong> · ${fmt(totalPhotoBytes)}</span>
                        <span>Davon: verkaufte Artikel</span><span>${verkaufteFotos.length} · ${fmt(verkaufteBytes)}</span>
                        <span>Davon: stornierte Artikel</span><span>${stornoMitFoto.length} · ${fmt(stornoBytes)}</span>
                        <span>Verkäufe gesamt</span><span>${sales.length}</span>
                    </div>
                </div>

                <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text-secondary);display:flex;gap:8px;align-items:flex-start;">
                    <span style="font-size:15px;flex-shrink:0;">✅</span>
                    <span><strong>GoBD-Hinweis:</strong> Alle Datensätze (auch verkaufte und stornierte Artikel) bleiben erhalten. Nur Fotos werden bereinigt — diese sind keine Pflicht-Belege.</span>
                </div>

                <div style="display:flex;flex-direction:column;gap:10px;">
                    <button class="btn cleanup-action" id="cleanupSold" ${verkaufteFotos.length === 0 ? 'disabled' : ''}
                            style="text-align:left;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
                        <div>
                            <div style="font-weight:700;margin-bottom:2px;"><i class="ti ti-photo-off"></i> Fotos verkaufter Artikel entfernen</div>
                            <div style="font-size:11px;color:var(--text-muted);font-weight:400;">Datensatz bleibt — Foto wird gelöscht</div>
                        </div>
                        <strong style="color:var(--success);white-space:nowrap;">spart ${fmt(verkaufteBytes)}</strong>
                    </button>

                    <button class="btn cleanup-action" id="cleanupStorno" ${stornoMitFoto.length === 0 ? 'disabled' : ''}
                            style="text-align:left;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
                        <div>
                            <div style="font-weight:700;margin-bottom:2px;">📁 Fotos stornierter Artikel entfernen</div>
                            <div style="font-size:11px;color:var(--text-muted);font-weight:400;">Datensatz bleibt für GoBD-Audit erhalten</div>
                        </div>
                        <strong style="color:var(--success);white-space:nowrap;">spart ${fmt(stornoBytes)}</strong>
                    </button>

                    <button class="btn cleanup-action" id="cleanupCompress" ${purchasesWithFoto.length === 0 ? 'disabled' : ''}
                            style="text-align:left;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
                        <div>
                            <div style="font-weight:700;margin-bottom:2px;">📉 Alle Fotos stärker komprimieren</div>
                            <div style="font-size:11px;color:var(--text-muted);font-weight:400;">600px / JPEG 0.55 — Qualität niedriger, Größe ~50%</div>
                        </div>
                        <strong style="color:var(--success);white-space:nowrap;">spart ~${fmt(totalPhotoBytes * 0.5)}</strong>
                    </button>
                </div>
            </div>
        `;

        this.showModal('🧹 Speicher aufräumen', body, '<button class="btn" data-action="close-modal">Schließen</button>');

        // Aktion: Fotos verkaufter Artikel entfernen
        const removePhotos = (filterFn, label) => {
            if (!confirm(`${label}?\n\nDie Datensätze bleiben erhalten, nur die Fotos werden gelöscht.`)) return;
            const all = Store.getPurchases(true);
            let count = 0;
            all.forEach(p => { if (filterFn(p) && p.foto) { delete p.foto; count++; } });
            Store.setAsync('purchases', all)
                .then(() => {
                    Utils.showToast(`✅ ${count} Fotos entfernt`, 'success');
                    this.closeModal();
                    if (this.currentPage) this.navigate(this.currentPage);
                })
                .catch(err => Utils.showToast('Fehler: ' + err.message, 'error'));
        };

        document.getElementById('cleanupSold')?.addEventListener('click', () =>
            removePhotos(p => p.status === 'verkauft', `Fotos von ${verkaufteFotos.length} verkauften Artikeln entfernen`));

        document.getElementById('cleanupStorno')?.addEventListener('click', () =>
            removePhotos(p => p.storniert, `Fotos von ${stornoMitFoto.length} stornierten Artikeln entfernen`));

        // Aktion: Alle Fotos komprimieren
        document.getElementById('cleanupCompress')?.addEventListener('click', async () => {
            if (!confirm(`Alle ${purchasesWithFoto.length} Fotos werden stärker komprimiert (600px, niedrigere Qualität).\n\nDieser Vorgang kann je nach Anzahl ein paar Sekunden dauern. Fortfahren?`)) return;

            const btn = document.getElementById('cleanupCompress');
            const orig = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '⏳ Komprimiere…';

            try {
                const all = Store.getPurchases(true);
                let processed = 0;
                for (const p of all) {
                    if (!p.foto) continue;
                    p.foto = await this._recompressPhoto(p.foto, 600, 0.55);
                    processed++;
                    if (processed % 20 === 0) {
                        btn.innerHTML = `⏳ Komprimiere… (${processed}/${purchasesWithFoto.length})`;
                        await new Promise(r => setTimeout(r, 0)); // UI atmen lassen
                    }
                }
                await Store.setAsync('purchases', all);
                Utils.showToast(`✅ ${processed} Fotos komprimiert`, 'success');
                this.closeModal();
                if (this.currentPage) this.navigate(this.currentPage);
            } catch (err) {
                console.error('[Cleanup] Komprimieren fehlgeschlagen:', err);
                Utils.showToast('Fehler: ' + err.message, 'error');
                btn.disabled = false;
                btn.innerHTML = orig;
            }
        });
    },

    // Foto neu komprimieren (zur Speicheroptimierung)
    _recompressPhoto(base64, maxSize, quality) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Bild nicht decodierbar'));
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > h && w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
                    else if (h > maxSize)     { w = Math.round(w * maxSize / h); h = maxSize; }
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                } catch (e) {
                    reject(e);
                }
            };
            img.src = base64;
        });
    },

    // ---- Recovery-Benachrichtigungen ----
    _showRecoveryNotice(recovered) {
        const srcLabels = {
            lsmirror:     'localStorage-Spiegel (automatischer Spiegelkopie)',
            idb_snapshot: 'Auto-Backup Snapshot (IndexedDB)',
            ls_raw:       'localStorage (direkte Schlüssel)'
        };
        const src = srcLabels[recovered.source] || recovered.source;
        const ts  = recovered.ts ? new Date(recovered.ts).toLocaleString('de-DE') : 'unbekannt';
        const body = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;color:var(--success);"><i class="ti ti-shield-check"></i></div>
                <h3 style="color:var(--success);margin-bottom:8px;">Daten automatisch gerettet!</h3>
                <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px;">
                    Das System hat beim Start einen Datenverlust erkannt und die Daten
                    automatisch wiederhergestellt.
                </p>
            </div>
            <div style="background:var(--bg-main);border-radius:8px;padding:14px;font-size:13px;margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                    <span style="color:var(--text-muted);">Quelle:</span>
                    <strong>${Utils.escapeHtml(src)}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <span style="color:var(--text-muted);">Zeitpunkt:</span>
                    <strong>${Utils.escapeHtml(ts)}</strong>
                </div>
            </div>
            <div style="background:rgba(251,191,36,0.1);border:1px solid var(--warning);border-radius:8px;padding:12px;font-size:12px;color:var(--text-secondary);">
                💡 <strong>Empfehlung:</strong> Richte jetzt einen Backup-Ordner ein (Backup & Daten → Ordner wählen)
                damit zukünftige Backups als echte Dateien auf deinem PC gespeichert werden.
            </div>
        `;
        this.showModal('Daten wiederhergestellt', body, '<button class="btn btn-primary" data-action="close-modal">Verstanden</button>');
    },

    _showDataLossModal() {
        const body = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">😔</div>
                <h3 style="color:var(--danger);margin-bottom:8px;">Datenverlust — keine Wiederherstellung möglich</h3>
                <p style="color:var(--text-secondary);font-size:14px;margin-bottom:16px;">
                    Das System hat beim Start erkannt, dass Daten fehlen — konnte aber keine
                    Backup-Quelle zur Wiederherstellung finden.
                </p>
            </div>
            <div style="background:rgba(220,38,38,0.06);border:1px solid var(--danger);border-radius:8px;padding:14px;font-size:13px;margin-bottom:16px;">
                <strong>Was jetzt?</strong>
                <ol style="margin:8px 0 0 16px;padding:0;line-height:2;">
                    <li>Prüfe ob du einen anderen Browser verwendest (Chrome, Firefox, Edge)</li>
                    <li>Öffne <strong>Backup & Daten → Notfall-Wiederherstellung</strong></li>
                    <li>Falls du einen Backup-Ordner hattest: Datei über den Datei-Ordner-Button wieder einspielen</li>
                    <li>Daten über Excel-Import neu erfassen</li>
                </ol>
            </div>
            <div style="background:rgba(251,191,36,0.1);border:1px solid var(--warning);border-radius:8px;padding:12px;font-size:12px;color:var(--text-secondary);">
                💡 Richte jetzt einen Backup-Ordner ein damit es nie wieder passiert.
            </div>
        `;
        const footer = `
            <button class="btn" data-action="close-modal">Schließen</button>
            <button class="btn btn-primary" data-action="app-close-and-backup">Backup & Daten öffnen</button>
        `;
        this.showModal('⚠️ Datenverlust erkannt', body, footer);
    },

    // SCHICHT 4 — Periodisches Backup: alle 10 Minuten wird ein Datei-Backup erzwungen,
    // auch wenn keine Änderungen stattgefunden haben (z.B. lange Sitzungen).
    _startPeriodicBackup() {
        const INTERVAL_MS = 10 * 60 * 1000; // 10 Minuten
        setInterval(() => {
            if (Store.getFsBackupFolderName()) {
                Store.writeFileSystemBackup('periodic');
            }
        }, INTERVAL_MS);
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'app-backup-modal':          function () { App.showBackupModal(); },
    'app-close-and-backup':      function () { App.closeModal(); App.showBackupModal(); },
    'app-dismiss-backup-banner': function () {
        const b = document.getElementById('_backupBanner');
        if (b) b.remove();
        localStorage.setItem('backup_banner_dismissed', '1');
    },
    'app-ust-switch-regel': function (key) { App._ustSwitchToRegel(key); },
    'app-ust-dismiss':      function (key) { App._ustDismissThreshold(key); },
    'app-pick-ust':         function (ctx, mode) { App._pickUst(ctx, mode); },
    'app-ob-gemeinde':      function (e, el) { App._obRefreshGemeinde(el.value); },
    'app-land-change':      function (e, el) { App._onLandChange(el.value); }
});

// Start the app — vollständiger Start mit Integritätsprüfung und Auto-Recovery
document.addEventListener('DOMContentLoaded', () => {
    Store.initWithRecovery().then(({ lossDetected, recovered }) => {
        App.init();
        if (lossDetected) {
            // Recovery-Banner anzeigen sobald DOM bereit ist
            setTimeout(() => {
                if (recovered) {
                    const srcLabels = {
                        lsmirror:    'localStorage-Spiegel',
                        idb_snapshot: 'Auto-Backup Snapshot',
                        ls_raw:       'localStorage (direkt)'
                    };
                    const src = srcLabels[recovered.source] || recovered.source;
                    const ts  = recovered.ts ? ` vom ${new Date(recovered.ts).toLocaleString('de-DE')}` : '';
                    Utils.showToast(
                        `⚠️ Datenverlust erkannt — Daten automatisch aus ${src}${ts} wiederhergestellt!`,
                        'warning'
                    );
                    // Zusätzlich prominentes Modal
                    setTimeout(() => App._showRecoveryNotice(recovered), 1200);
                } else {
                    // Verlust erkannt, nichts wiederherstellbar
                    App._showDataLossModal();
                }
            }, 800);
        }
    });
});
