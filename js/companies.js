// ============================================
// CompanyManager — Multi-Firmen-Verwaltung
// ============================================
const CompanyManager = {
    REGISTRY_KEY: 'oyi_companies',       // global localStorage key (nie namespaced)
    ACTIVE_KEY:   'oyi_active_company',  // global localStorage key
    MAX_COMPANIES: 5,

    FARBEN: [
        { name: 'Emerald', hex: '#10b981' },
        { name: 'Grün',    hex: '#22c55e' },
        { name: 'Orange',  hex: '#f97316' },
        { name: 'Blau',    hex: '#3b82f6' },
        { name: 'Pink',    hex: '#ec4899' },
    ],

    BRANCHEN: ['Reselling', 'E-Commerce', 'Dienstleistung', 'Handwerk', 'Sonstiges'],

    getAll() {
        try { return JSON.parse(localStorage.getItem(this.REGISTRY_KEY) || '[]'); }
        catch { return []; }
    },

    _save(companies) {
        localStorage.setItem(this.REGISTRY_KEY, JSON.stringify(companies));
    },

    getActiveId() {
        return localStorage.getItem(this.ACTIVE_KEY) || '';
    },

    getActive() {
        const id = this.getActiveId();
        return this.getAll().find(c => c.id === id) || null;
    },

    // Gibt das Land der aktiven Firma zurück (aktuell immer 'DE')
    getActiveLand() {
        const co = this.getActive();
        return (co && co.land) ? co.land : 'DE';
    },

    create(name, farbe, branche, land) {
        const companies = this.getAll();
        // Trial/Plan: max. 1 Firma ohne Pro
        if (typeof UserPlan !== 'undefined' && !UserPlan.isPro() && !UserPlan.isTrialActive() && companies.length >= 1) {
            UserPlan.requirePro('Mehrere Unternehmen');
            return null;
        }
        if (companies.length >= this.MAX_COMPANIES) {
            throw new Error(`Maximal ${this.MAX_COMPANIES} Firmen erlaubt`);
        }
        const id = 'co_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const company = {
            id,
            name:           name.trim(),
            farbe:          farbe || '#10b981',
            branche:        branche || 'Reselling',
            land:           land || 'DE',
            erstellt:       new Date().toISOString(),
            letzterZugriff: new Date().toISOString()
        };
        companies.push(company);
        this._save(companies);
        return company;
    },

    // Wechselt Firma: speichert letzterZugriff, setzt Active-Key, lädt Seite neu
    switchTo(id) {
        const companies = this.getAll();
        const co = companies.find(c => c.id === id);
        if (!co) return;
        co.letzterZugriff = new Date().toISOString();
        this._save(companies);
        localStorage.setItem(this.ACTIVE_KEY, id);
        location.reload();
    },

    rename(id, newName) {
        const companies = this.getAll();
        const co = companies.find(c => c.id === id);
        if (!co || !newName.trim()) return;
        co.name = newName.trim();
        this._save(companies);
    },

    updateColor(id, hex) {
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
        const companies = this.getAll();
        const co = companies.find(c => c.id === id);
        if (!co) return;
        co.farbe = hex;
        this._save(companies);
    },

    // Löscht ALLE Daten einer Firma aus IDB + Cache (nur nicht-aktive Firmen!)
    async delete(id) {
        if (id === this.getActiveId()) {
            throw new Error('Aktive Firma kann nicht gelöscht werden — zuerst wechseln');
        }
        // IDB-Keys dieser Firma aus Cache + IDB entfernen
        const prefix = id + '__';
        const keys = Object.keys(Store._cache).filter(k => k.startsWith(prefix));
        keys.forEach(k => {
            delete Store._cache[k];
            Store._idbDelete(k);
        });
        // Rohe localStorage-Reste (v.a. co_<id>__eigenbelege_*, dort noch nicht in den Cache
        // migriert) — sonst holt sie _migrateEigenbelegeToIDB() beim nächsten Start zurück,
        // weil das Cache-Gate (!this._cache[k]) nach dem Löschen wieder greift
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) localStorage.removeItem(k);
        }
        // Cloud-Snapshot löschen (Art. 17 DSGVO) — sonst bringt der nächste Sync die Firma zurück
        if (typeof CloudSync !== 'undefined') {
            try { await CloudSync.deleteRemote(id); }
            catch (e) { console.error('[CompanyManager] Cloud-Löschung fehlgeschlagen:', e); }
        }
        // Aus Registry entfernen
        const companies = this.getAll().filter(c => c.id !== id);
        this._save(companies);
    },

    // Migriert bestehende Daten (ohne Prefix) zur angegebenen Firma
    // Wird einmalig beim ersten Erstellen der ersten Firma ausgeführt
    async migrateExistingData(companyId) {
        // Alle un-prefixed Cache-Keys die Reselling-Daten sind
        const OLD_PREFIXES = ['reselling_', 'rechnungsbuch_'];
        const OLD_AUDIT    = 'audit_log';

        const keysToMigrate = Object.keys(Store._cache).filter(k => {
            if (k === OLD_AUDIT) return true;
            return OLD_PREFIXES.some(p => k.startsWith(p));
        });

        if (keysToMigrate.length === 0) {
            console.log('[CompanyManager] Keine alten Daten zum Migrieren');
            return 0;
        }

        for (const oldKey of keysToMigrate) {
            const newKey = companyId + '__' + oldKey;
            const value  = Store._cache[oldKey];
            // Neuen Schlüssel anlegen
            Store._cache[newKey] = value;
            Store._idbPut(newKey, value);
            // Alten Schlüssel löschen
            delete Store._cache[oldKey];
            Store._idbDelete(oldKey);
        }
        console.log(`[CompanyManager] ${keysToMigrate.length} Keys migriert → ${companyId}`);
        return keysToMigrate.length;
    },

    // ── Eigenbeleg-Migration ────────────────────────────────────────────────
    // Früher lagen Eigenbelege unter einem globalen, firmenübergreifenden Key
    // ('eigenbelege_belege'). Diese Migration verteilt sie auf die einzelnen
    // Firmen: erkannt wird die erstellende Firma über die Lager-Verknüpfung
    // (Einkauf.eigenbeleg_id ↔ Beleg.id bzw. warenPositionen[].lagerArtikelId).
    // Wo nicht erkennbar, wird die aktive Firma verwendet. Läuft genau einmal.
    EB_MIGRATION_FLAG: 'oyi_eb_migrated_v1',

    // Liest alle Einkäufe einer Firma aus allen Quellen (Store-Cache, localStorage,
    // Mirror, IndexedDB), dedupliziert nach id. Nur für die einmalige Migration.
    async _readPurchasesAllSources(companyId) {
        const key  = companyId + '__reselling_purchases';
        const byId = {};
        const add  = (arr) => { if (Array.isArray(arr)) arr.forEach(p => { if (p && p.id && !byId[p.id]) byId[p.id] = p; }); };
        try { if (typeof Store !== 'undefined' && Store._cache && Store._cache[key]) add(JSON.parse(Store._cache[key])); } catch(e) {}
        try { const v = localStorage.getItem(key); if (v) add(JSON.parse(v)); } catch(e) {}
        try { const m = JSON.parse(localStorage.getItem('_oyi_lsmirror') || '{}'); if (m[key]) add(JSON.parse(m[key])); } catch(e) {}
        try { add(await this._idbGet(key)); } catch(e) {}
        return Object.values(byId);
    },

    _idbGet(key) {
        return new Promise((resolve) => {
            try {
                const req = indexedDB.open('oyi_maindata', 1);
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    try {
                        const tx = db.transaction('keyval', 'readonly');
                        const r  = tx.objectStore('keyval').get(key);
                        r.onsuccess = () => { try { resolve(r.result ? JSON.parse(r.result.v || '[]') : []); } catch(e2) { resolve([]); } };
                        r.onerror   = () => resolve([]);
                    } catch(e2) { resolve([]); }
                };
                req.onerror = () => resolve([]);
            } catch(e) { resolve([]); }
        });
    },

    // Gibt die Anzahl verschobener Belege zurück (0 = nichts zu tun / bereits erledigt).
    async migrateEigenbelegeToCompanies() {
        const FLAG = this.EB_MIGRATION_FLAG;
        if (localStorage.getItem(FLAG)) return 0;

        const companies = this.getAll();
        if (!companies.length) return 0;   // noch keine Firma → Onboarding übernimmt

        const BELEGE_KEY = 'eigenbelege_belege';
        const OTHER_KEYS = ['eigenbelege_kategorien', 'eigenbelege_einstellungen', 'eigenbelege_naechste_nummer', 'eigenbelege_produkte'];

        let globalBelege = [];
        try { globalBelege = JSON.parse(localStorage.getItem(BELEGE_KEY) || '[]'); } catch(e) {}
        if (!Array.isArray(globalBelege)) globalBelege = [];
        const hasOther = OTHER_KEYS.some(k => localStorage.getItem(k) != null);

        // Nichts Globales vorhanden → Flag setzen und fertig
        if (!globalBelege.length && !hasOther) {
            localStorage.setItem(FLAG, new Date().toISOString());
            return 0;
        }

        const activeId = this.getActiveId() || companies[0].id;

        // Lookup: Einkauf-id → Firma, Eigenbeleg-id → Firma
        const purchaseToCo = {};
        const ebIdToCo     = {};
        for (const co of companies) {
            const purchases = await this._readPurchasesAllSources(co.id);
            purchases.forEach(p => {
                // Erste Firma gewinnt bei einer (eigentlich unmöglichen) id-Kollision zwischen
                // Firmen — verhindert, dass eine später verarbeitete Firma die Zuordnung überschreibt.
                if (p.id && !(p.id in purchaseToCo))                       purchaseToCo[p.id] = co.id;
                if (p.eigenbeleg_id && !(p.eigenbeleg_id in ebIdToCo))     ebIdToCo[p.eigenbeleg_id] = co.id;
            });
        }

        const detectCo = (beleg) => {
            if (beleg.id && ebIdToCo[beleg.id]) return ebIdToCo[beleg.id];           // bidirektionaler Link (robust)
            for (const pos of (beleg.warenPositionen || [])) {
                if (pos.lagerArtikelId && purchaseToCo[pos.lagerArtikelId]) return purchaseToCo[pos.lagerArtikelId];
            }
            return activeId;                                                          // nicht erkennbar → aktive Firma
        };

        // Belege nach Ziel-Firma gruppieren
        const byCo = {};
        globalBelege.forEach(b => {
            const target = detectCo(b);
            (byCo[target] = byCo[target] || []).push(b);
        });

        // In firmen-präfixierte Keys einmischen (ohne Duplikate, ohne Überschreiben)
        Object.entries(byCo).forEach(([coId, incoming]) => {
            if (!incoming.length) return;
            const key = coId + '__' + BELEGE_KEY;
            let existing = [];
            try { existing = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) {}
            if (!Array.isArray(existing)) existing = [];
            const ids    = new Set(existing.map(x => x && x.id));
            const merged = existing.concat(incoming.filter(x => x && !ids.has(x.id)));
            localStorage.setItem(key, JSON.stringify(merged));
        });

        // Übrige globale Keys → aktive Firma, nur falls dort noch nicht vorhanden
        OTHER_KEYS.forEach(k => {
            const v = localStorage.getItem(k);
            if (v == null) return;
            const target = activeId + '__' + k;
            if (localStorage.getItem(target) == null) localStorage.setItem(target, v);
        });

        // Globale Keys entfernen → kein firmenübergreifendes Leck mehr
        localStorage.removeItem(BELEGE_KEY);
        OTHER_KEYS.forEach(k => localStorage.removeItem(k));

        localStorage.setItem(FLAG, new Date().toISOString());
        console.log(`[CompanyManager] Eigenbeleg-Migration: ${globalBelege.length} Belege auf Firmen verteilt`);
        return globalBelege.length;
    },

    // ── Firmen-Stammdaten-Migration (app_einstellungen) ──────────────────────
    // Früher lagen die Eigenbeleg-Firmenstammdaten (Firmenname, Inhaber, Adresse)
    // zusätzlich in einem globalen, firmenübergreifenden Key 'app_einstellungen'.
    // Diese Migration ordnet den vorhandenen Globalwert der AKTIVEN Firma zu (nur
    // fehlende Felder, ohne eigene Werte zu überschreiben — das ist genau der Wert,
    // den die aktive Firma bisher als Fallback angezeigt bekam) und entfernt danach
    // den globalen Key. Läuft genau einmal (synchron, nur localStorage).
    SETTINGS_MIGRATION_FLAG: 'oyi_settings_migrated_v1',

    // Gibt 1 zurück, wenn ein globaler Wert verarbeitet wurde (Aufrufer kann dann die
    // offene Seite neu laden), sonst 0.
    migrateAppEinstellungenToCompanies() {
        const FLAG = this.SETTINGS_MIGRATION_FLAG;
        if (localStorage.getItem(FLAG)) return 0;

        const companies = this.getAll();
        if (!companies.length) return 0;   // noch keine Firma → Onboarding übernimmt

        const raw = localStorage.getItem('app_einstellungen');
        if (raw == null) {                 // nichts Globales vorhanden → nur Flag setzen
            localStorage.setItem(FLAG, new Date().toISOString());
            return 0;
        }

        let global = {};
        try { global = JSON.parse(raw || '{}'); } catch(e) { global = {}; }
        if (!global || typeof global !== 'object') global = {};

        const activeId = this.getActiveId() || companies[0].id;
        const key = activeId + '__eigenbelege_einstellungen';
        let own = {};
        try { own = JSON.parse(localStorage.getItem(key) || '{}'); } catch(e) { own = {}; }
        if (!own || typeof own !== 'object') own = {};

        let changed = false;
        ['firmenname', 'inhaberName', 'adresse'].forEach(f => {
            if (global[f] && !own[f]) { own[f] = global[f]; changed = true; }
        });
        if (changed) localStorage.setItem(key, JSON.stringify(own));

        // Globalen Key entfernen → kein firmenübergreifendes Leck mehr
        localStorage.removeItem('app_einstellungen');
        localStorage.setItem(FLAG, new Date().toISOString());
        console.log(`[CompanyManager] Stammdaten-Migration: app_einstellungen → ${activeId}`);
        return 1;
    },

    // ── UI ──────────────────────────────────────────────────────────────────

    // CSP: kein Inline-Handler → Hover per CSS, einmalig global injiziert
    _injectStyles() {
        if (document.getElementById('companySwitcherStyles')) return;
        const s = document.createElement('style');
        s.id = 'companySwitcherStyles';
        s.textContent =
            '.company-switcher-btn:hover{background:rgba(255,255,255,.13) !important;}' +
            '.co-dropdown-row:not(.active):hover{background:var(--bg-secondary) !important;}';
        document.head.appendChild(s);
    },

    // Rendert den Company-Switcher-Button (oben rechts im tool-switcher)
    renderSwitcherBtn() {
        this._injectStyles();
        const co    = this.getActive();
        const color = (co && /^#[0-9a-fA-F]{6}$/.test(co.farbe)) ? co.farbe : '#10b981';
        const name  = co ? co.name  : '—';

        return `
        <div id="companySwitcherBtn" class="company-switcher-btn" data-action="co-toggle-dropdown" title="Firma wechseln" style="
            position:relative;
            display:flex;align-items:center;gap:7px;
            padding:5px 12px;
            background:rgba(255,255,255,.07);
            border:1px solid rgba(255,255,255,.15);
            border-radius:20px;cursor:pointer;
            font-size:13px;font-weight:600;
            color:var(--text-primary);
            white-space:nowrap;
            transition:background .15s;
            user-select:none;
        ">
            <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
            <span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(name)}</span>
            <span id="companySwitcherChevron" style="font-size:10px;opacity:.6;transition:transform .2s;">▾</span>
        </div>`;
    },

    // Dropdown ein-/ausblenden
    toggleDropdown(e) {
        e.stopPropagation();
        const existing = document.getElementById('companySwitcherDropdown');
        if (existing) { this._closeDropdown(); return; }
        this._openDropdown();
    },

    _openDropdown() {
        const btn       = document.getElementById('companySwitcherBtn');
        const companies = this.getAll();
        const activeId  = this.getActiveId();
        const maxed     = companies.length >= this.MAX_COMPANIES;

        const rows = companies.map(co => {
            const isActive = co.id === activeId;
            return `
            <div class="co-dropdown-row${isActive ? ' active' : ''}" style="
                display:flex;align-items:center;gap:10px;
                padding:10px 14px;
                border-bottom:1px solid var(--border);
                background:${isActive ? 'rgba(99,102,241,.10)' : 'transparent'};
                transition:background .12s;
            ">
                <span style="width:12px;height:12px;border-radius:50%;background:${/^#[0-9a-fA-F]{6}$/.test(co.farbe) ? co.farbe : '#10b981'};flex-shrink:0;"></span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${Utils.escapeHtml(co.name)}
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);">${Utils.escapeHtml(co.branche || '')} · 🇩🇪</div>
                </div>
                ${isActive
                    ? `<span style="font-size:11px;padding:2px 8px;background:rgba(99,102,241,.2);color:#818cf8;border-radius:10px;font-weight:600;white-space:nowrap;">✓ Aktiv</span>`
                    : `<button class="btn btn-small" data-action="co-switch" data-args='["${co.id}"]' 
                               style="font-size:11px;white-space:nowrap;">Wechseln</button>`
                }
                <button data-action="co-manage" data-args='["${co.id}"]' 
                        title="Bearbeiten"
                        style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;padding:2px 4px;flex-shrink:0;">⚙</button>
            </div>`;
        }).join('');

        const dropdown = document.createElement('div');
        dropdown.id = 'companySwitcherDropdown';
        dropdown.style.cssText = `
            position:fixed;
            z-index:99999;
            min-width:280px;
            max-width:340px;
            background:var(--bg-card);
            border:1px solid var(--border);
            border-radius:12px;
            box-shadow:0 8px 32px rgba(0,0,0,.45);
            overflow:hidden;
            animation:dropdownIn .15s ease;
        `;

        dropdown.innerHTML = `
            <style>
                @keyframes dropdownIn {
                    from { opacity:0; transform:translateY(-6px); }
                    to   { opacity:1; transform:translateY(0); }
                }
            </style>
            <!-- Header -->
            <div style="padding:12px 14px;background:var(--bg-secondary);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
                <div>
                    <div style="font-weight:700;font-size:13px;">🏢 Unternehmen</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:1px;">${companies.length} von ${this.MAX_COMPANIES} angelegt</div>
                </div>
                <button data-action="co-close-dropdown" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:18px;line-height:1;padding:0 2px;">×</button>
            </div>

            <!-- Firmen-Liste -->
            <div style="max-height:300px;overflow-y:auto;">
                ${rows}
            </div>

            <!-- Footer -->
            <div style="padding:10px 14px;border-top:1px solid var(--border);">
                ${!maxed
                    ? `<button class="btn btn-outline" data-action="co-create"
                               style="width:100%;font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px;">
                           <span style="font-size:16px;">＋</span> Neues Unternehmen anlegen
                       </button>`
                    : `<div style="text-align:center;font-size:12px;color:var(--text-muted);padding:4px;">
                           Maximum von ${this.MAX_COMPANIES} Unternehmen erreicht
                       </div>`
                }
            </div>`;

        document.body.appendChild(dropdown);

        // Position: direkt unter dem Button, rechte Kante bündig mit Button-rechter Kante
        const rect        = btn ? btn.getBoundingClientRect() : { bottom: 40, right: window.innerWidth - 16 };
        const rightOffset = Math.max(0, window.innerWidth - rect.right);
        dropdown.style.top   = (rect.bottom + 6) + 'px';
        dropdown.style.right = rightOffset + 'px';
        dropdown.style.left  = 'auto';

        // Chevron drehen
        const chevron = document.getElementById('companySwitcherChevron');
        if (chevron) chevron.style.transform = 'rotate(180deg)';

        // Click-Outside → schließen
        setTimeout(() => {
            document.addEventListener('click', this._outsideClickHandler);
        }, 0);
    },

    _outsideClickHandler(e) {
        const dd = document.getElementById('companySwitcherDropdown');
        if (dd && !dd.contains(e.target)) {
            CompanyManager._closeDropdown();
        }
    },

    _closeDropdown() {
        const dd = document.getElementById('companySwitcherDropdown');
        if (dd) dd.remove();
        const chevron = document.getElementById('companySwitcherChevron');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        document.removeEventListener('click', this._outsideClickHandler);
    },

    openSwitcher() {
        // Legacy — ruft jetzt Dropdown auf
        this._openDropdown();
    },

    _openCreateModal() {
        const farbenHtml = this.FARBEN.map((f, i) => `
            <label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;">
                <input type="radio" name="firma_farbe" value="${f.hex}" ${i===0?'checked':''} style="display:none;">
                <span class="farb-dot" style="width:28px;height:28px;border-radius:50%;background:${f.hex};
                      display:block;border:3px solid transparent;transition:border .15s;"
                      data-action="co-pick-color" data-args='[".farb-dot"]' >
                </span>
                <span style="font-size:10px;color:var(--text-muted);">${f.name}</span>
            </label>`).join('');

        const branchenHtml = this.BRANCHEN.map(b =>
            `<option value="${b}">${b}</option>`).join('');

        const body = `
            <div style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">
                <div class="form-group">
                    <label class="form-label">Firmenname *</label>
                    <input type="text" class="form-input" id="new_firma_name"
                           placeholder="z.B. Mein Business, Max Mustermann" maxlength="40"
                           style="font-size:16px;" autofocus>
                </div>
                <div class="form-group">
                    <label class="form-label">Branche</label>
                    <select class="form-select" id="new_firma_branche">${branchenHtml}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">Farbe (zur Unterscheidung)</label>
                    <div style="display:flex;gap:16px;margin-top:6px;">${farbenHtml}</div>
                </div>
                <button class="btn btn-primary" data-action="co-create-modal" style="width:100%;padding:12px;font-size:15px;">
                    ✅ Firma anlegen
                </button>
            </div>`;

        App.showModal('Neue Firma', body, '');
    },

    _createFromModal() {
        const name    = document.getElementById('new_firma_name')?.value?.trim();
        const branche = document.getElementById('new_firma_branche')?.value || 'Reselling';
        const farbe   = document.querySelector('input[name="firma_farbe"]:checked')?.value || '#10b981';
        const land    = 'DE';

        if (!name) {
            Utils.showToast('Bitte einen Firmennamen eingeben', 'warning');
            document.getElementById('new_firma_name')?.focus();
            return;
        }
        try {
            const co = this.create(name, farbe, branche, land);
            Utils.showToast(`✅ Firma "${name}" angelegt — wechsle jetzt rein`, 'success');
            App.closeModal();
            // Direkt zur neuen Firma wechseln
            setTimeout(() => this.switchTo(co.id), 600);
        } catch(err) {
            Utils.showToast('❌ ' + err.message, 'error');
        }
    },

    _openManageModal(id) {
        const co = this.getAll().find(c => c.id === id);
        if (!co) return;
        const isActive = id === this.getActiveId();
        const farbenHtml = this.FARBEN.map((f, i) => `
            <label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;">
                <input type="radio" name="edit_farbe" value="${f.hex}" ${co.farbe===f.hex?'checked':''} style="display:none;">
                <span class="farb-dot-edit" style="width:26px;height:26px;border-radius:50%;background:${f.hex};
                      display:block;border:3px solid ${co.farbe===f.hex?'white':'transparent'};transition:border .15s;"
                      data-action="co-pick-color" data-args='[".farb-dot-edit"]' >
                </span>
            </label>`).join('');

        const body = `
            <div style="display:flex;flex-direction:column;gap:14px;padding:4px 0;">
                <div class="form-group">
                    <label class="form-label">Firmenname</label>
                    <input type="text" class="form-input" id="edit_firma_name" value="${Utils.escapeHtml(co.name)}" maxlength="40">
                </div>
                <div class="form-group">
                    <label class="form-label">Farbe</label>
                    <div style="display:flex;gap:14px;margin-top:6px;">${farbenHtml}</div>
                </div>
                <button class="btn btn-primary" data-action="co-save-manage" data-args='["${id}"]'  style="width:100%;">
                    💾 Speichern
                </button>
                ${!isActive ? `
                <hr style="border-color:var(--border);margin:4px 0;">
                <button class="btn" data-action="co-confirm-del" data-args='["${id}"]' 
                        style="width:100%;background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.3);">
                    🗑 Firma löschen (alle Daten unwiderruflich löschen)
                </button>` : `
                <div style="font-size:12px;color:var(--text-muted);text-align:center;">
                    (Aktive Firma kann nicht gelöscht werden)
                </div>`}
            </div>`;

        App.showModal(`Firma: ${co.name}`, body, '');
    },

    _saveManageModal(id) {
        const name  = document.getElementById('edit_firma_name')?.value?.trim();
        const farbe = document.querySelector('input[name="edit_farbe"]:checked')?.value;
        if (!name) { Utils.showToast('Name darf nicht leer sein', 'warning'); return; }
        this.rename(id, name);
        if (farbe) this.updateColor(id, farbe);
        Utils.showToast('✅ Gespeichert', 'success');
        App.closeModal();
        // Switcher-Button neu rendern
        const btn = document.getElementById('companySwitcherBtn');
        if (btn) btn.outerHTML = this.renderSwitcherBtn();
    },

    async _confirmDelete(id) {
        const co = this.getAll().find(c => c.id === id);
        if (!co) return;
        const body = `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:14px;">
                    <div style="font-weight:700;color:var(--danger);margin-bottom:6px;">⚠️ Unwiderrufliche Aktion</div>
                    <div style="font-size:13px;color:var(--text-secondary);">
                        Alle Daten von <strong>${Utils.escapeHtml(co.name)}</strong> werden permanent gelöscht —
                        Einkäufe, Verkäufe, Ausgaben, Protokoll, Rechnungen und Belege.
                    </div>
                </div>
                <div style="font-size:13px;color:var(--text-muted);">
                    Stelle sicher, dass du vorher ein Backup erstellt hast.
                </div>
                <div style="display:flex;gap:10px;">
                    <button class="btn btn-outline" data-action="close-modal" style="flex:1;">Abbrechen</button>
                    <button class="btn" data-action="co-exec-del" data-args='["${id}"]' 
                            style="flex:1;background:var(--danger);color:white;border-color:var(--danger);">
                        Ja, Firma löschen
                    </button>
                </div>
            </div>`;
        App.showModal('Firma löschen?', body, '');
    },

    async _executeDelete(id) {
        try {
            await this.delete(id);
            App.closeModal();
            Utils.showToast('✅ Firma gelöscht', 'success');
        } catch(err) {
            Utils.showToast('❌ ' + err.message, 'error');
        }
    },

};
window.CompanyManager = CompanyManager;

// Einmalige Migrationen: globale (firmenübergreifende) Eigenbelege bzw. Firmen-
// Stammdaten (app_einstellungen) auf Firmen verteilen. Läuft auf jeder Seite (alle
// laden companies.js), aber jeweils nur einmal (Flags). Reload nur, wenn tatsächlich
// etwas verschoben wurde — damit die offene Seite die firmen-getrennten Daten zeigt.
(function _runEbMigration() {
    const go = () => {
        try {
            let settingsMoved = 0;
            try { settingsMoved = CompanyManager.migrateAppEinstellungenToCompanies(); } catch(e) {}
            CompanyManager.migrateEigenbelegeToCompanies()
                .then(moved => { if (moved > 0 || settingsMoved > 0) location.reload(); })
                .catch(() => { if (settingsMoved > 0) location.reload(); });
        } catch(e) {}
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', go);
    } else {
        go();
    }
})();

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'co-toggle-dropdown':   function (e) { CompanyManager.toggleDropdown(e); },
    'co-switch':            function (id) { CompanyManager._closeDropdown(); CompanyManager.switchTo(id); },
    'co-manage':            function (id, e) { e.stopPropagation(); CompanyManager._closeDropdown(); CompanyManager._openManageModal(id); },
    'co-close-dropdown':    function () { CompanyManager._closeDropdown(); },
    'co-create':            function () { CompanyManager._closeDropdown(); CompanyManager._openCreateModal(); },
    'co-pick-color':        function (sel, e, el) {
        document.querySelectorAll(sel).forEach(function (d) { d.style.borderColor = 'transparent'; });
        el.style.borderColor = 'white';
    },
    'co-create-modal':      function () { CompanyManager._createFromModal(); },
    'co-save-manage':       function (id) { CompanyManager._saveManageModal(id); },
    'co-confirm-del':       function (id) { CompanyManager._confirmDelete(id); },
    'co-exec-del':          function (id) { CompanyManager._executeDelete(id); }
});
