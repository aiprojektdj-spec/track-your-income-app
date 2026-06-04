// ============================================
// CompanyManager — Multi-Firmen-Verwaltung
// ============================================
const CompanyManager = {
    REGISTRY_KEY: 'oyi_companies',       // global localStorage key (nie namespaced)
    ACTIVE_KEY:   'oyi_active_company',  // global localStorage key
    MAX_COMPANIES: 5,

    FARBEN: [
        { name: 'Indigo',  hex: '#6366f1' },
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

    // Gibt das Land der aktiven Firma zurück ('DE' oder 'AT')
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
            farbe:          farbe || '#6366f1',
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

    // ── UI ──────────────────────────────────────────────────────────────────

    // Rendert den Company-Switcher-Button (oben rechts im tool-switcher)
    renderSwitcherBtn() {
        const co    = this.getActive();
        const color = co ? co.farbe : '#6366f1';
        const name  = co ? co.name  : '—';

        return `
        <div id="companySwitcherBtn" onclick="CompanyManager.toggleDropdown(event)" title="Firma wechseln" style="
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
        " onmouseenter="this.style.background='rgba(255,255,255,.13)'"
           onmouseleave="this.style.background='rgba(255,255,255,.07)'">
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
            <div style="
                display:flex;align-items:center;gap:10px;
                padding:10px 14px;
                border-bottom:1px solid var(--border);
                background:${isActive ? 'rgba(99,102,241,.10)' : 'transparent'};
                transition:background .12s;
            " onmouseenter="if(!${isActive})this.style.background='var(--bg-secondary)'"
               onmouseleave="this.style.background='${isActive ? 'rgba(99,102,241,.10)' : 'transparent'}'">
                <span style="width:12px;height:12px;border-radius:50%;background:${/^#[0-9a-fA-F]{6}$/.test(co.farbe) ? co.farbe : '#6366f1'};flex-shrink:0;"></span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${Utils.escapeHtml(co.name)}
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);">${Utils.escapeHtml(co.branche || '')} · ${co.land === 'AT' ? '🇦🇹' : '🇩🇪'}</div>
                </div>
                ${isActive
                    ? `<span style="font-size:11px;padding:2px 8px;background:rgba(99,102,241,.2);color:#818cf8;border-radius:10px;font-weight:600;white-space:nowrap;">✓ Aktiv</span>`
                    : `<button class="btn btn-small" onclick="CompanyManager._closeDropdown();CompanyManager.switchTo('${co.id}');"
                               style="font-size:11px;white-space:nowrap;">Wechseln</button>`
                }
                <button onclick="event.stopPropagation();CompanyManager._closeDropdown();CompanyManager._openManageModal('${co.id}');"
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
                <button onclick="CompanyManager._closeDropdown()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:18px;line-height:1;padding:0 2px;">×</button>
            </div>

            <!-- Firmen-Liste -->
            <div style="max-height:300px;overflow-y:auto;">
                ${rows}
            </div>

            <!-- Footer -->
            <div style="padding:10px 14px;border-top:1px solid var(--border);">
                ${!maxed
                    ? `<button class="btn btn-outline" onclick="CompanyManager._closeDropdown();CompanyManager._openCreateModal();"
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
                      onclick="document.querySelectorAll('.farb-dot').forEach(d=>d.style.borderColor='transparent');this.style.borderColor='white';">
                </span>
                <span style="font-size:10px;color:var(--text-muted);">${f.name}</span>
            </label>`).join('');

        const branchenHtml = this.BRANCHEN.map(b =>
            `<option value="${b}">${b}</option>`).join('');

        const body = `
            <div style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">
                <div class="form-group">
                    <label class="form-label">Steuerliches Sitzland</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px;">
                        <label style="cursor:pointer;">
                            <input type="radio" name="new_firma_land" value="DE" checked style="display:none;">
                            <div onclick="CompanyManager._selectLandBtn('new','DE')" id="new_land_de" style="
                                border:2px solid var(--accent);border-radius:8px;padding:8px;text-align:center;
                                background:rgba(99,102,241,.1);cursor:pointer;">
                                <span style="font-size:20px;">🇩🇪</span>
                                <div style="font-size:12px;font-weight:700;">Deutschland</div>
                            </div>
                        </label>
                        <label style="cursor:pointer;">
                            <input type="radio" name="new_firma_land" value="AT" style="display:none;">
                            <div onclick="CompanyManager._selectLandBtn('new','AT')" id="new_land_at" style="
                                border:2px solid var(--border);border-radius:8px;padding:8px;text-align:center;
                                background:var(--bg-secondary);cursor:pointer;">
                                <span style="font-size:20px;">🇦🇹</span>
                                <div style="font-size:12px;font-weight:700;">Österreich</div>
                            </div>
                        </label>
                    </div>
                </div>
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
                <button class="btn btn-primary" onclick="CompanyManager._createFromModal()" style="width:100%;padding:12px;font-size:15px;">
                    ✅ Firma anlegen
                </button>
            </div>`;

        App.showModal('Neue Firma', body, '');
    },

    _createFromModal() {
        const name    = document.getElementById('new_firma_name')?.value?.trim();
        const branche = document.getElementById('new_firma_branche')?.value || 'Reselling';
        const farbe   = document.querySelector('input[name="firma_farbe"]:checked')?.value || '#6366f1';
        const land    = document.querySelector('input[name="new_firma_land"]:checked')?.value || 'DE';

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
                      onclick="document.querySelectorAll('.farb-dot-edit').forEach(d=>d.style.borderColor='transparent');this.style.borderColor='white';">
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
                <button class="btn btn-primary" onclick="CompanyManager._saveManageModal('${id}')" style="width:100%;">
                    💾 Speichern
                </button>
                ${!isActive ? `
                <hr style="border-color:var(--border);margin:4px 0;">
                <button class="btn" onclick="CompanyManager._confirmDelete('${id}')"
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
                    <button class="btn btn-outline" onclick="App.closeModal()" style="flex:1;">Abbrechen</button>
                    <button class="btn" onclick="CompanyManager._executeDelete('${id}')"
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

    // ── Onboarding (Erster Start — keine Firmen vorhanden) ──────────────────

    showOnboarding(hasExistingData) {
        const farbenHtml = this.FARBEN.map((f, i) => `
            <label style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;">
                <input type="radio" name="onb_farbe" value="${f.hex}" ${i===0?'checked':''} style="display:none;">
                <span class="onb-farb-dot" style="
                    width:36px;height:36px;border-radius:50%;background:${f.hex};display:block;
                    border:3px solid ${i===0?'white':'transparent'};transition:all .15s;box-shadow:0 2px 8px rgba(0,0,0,.3);"
                    onclick="document.querySelectorAll('.onb-farb-dot').forEach(d=>d.style.borderColor='transparent');this.style.borderColor='white';">
                </span>
                <span style="font-size:11px;color:var(--text-muted);">${f.name}</span>
            </label>`).join('');

        const branchenHtml = this.BRANCHEN.map(b =>
            `<option value="${b}">${b}</option>`).join('');

        const el = document.getElementById('onboarding');
        if (!el) return;
        el.innerHTML = `
    <div style="
        position:fixed;inset:0;z-index:9999;
        background:var(--bg-primary);
        display:flex;align-items:center;justify-content:center;
        padding:20px;overflow-y:auto;
    ">
        <div style="
            max-width:480px;width:100%;
            background:var(--bg-card);
            border:1px solid var(--border);
            border-radius:16px;
            padding:32px 28px;
            box-shadow:0 20px 60px rgba(0,0,0,.5);
            margin:auto;
        ">
            <div style="text-align:center;margin-bottom:24px;">
                <div style="font-size:36px;color:var(--accent);margin-bottom:10px;line-height:1;">◆</div>
                <h2 style="font-size:22px;font-weight:800;margin:0 0 6px;letter-spacing:-.3px;">Willkommen bei Stackr</h2>
                <p style="font-size:13px;color:var(--text-secondary);margin:0;">
                    ${hasExistingData
                        ? 'Deine bestehenden Daten bleiben erhalten — benenne einfach deine erste Firma.'
                        : 'Richte dein Business ein — dauert unter 60 Sekunden.'}
                </p>
            </div>

            <div style="display:flex;flex-direction:column;gap:18px;">

                <!-- Land / Steuerrecht -->
                <div class="form-group">
                    <label class="form-label" style="font-size:14px;font-weight:700;">Steuerliches Sitzland *</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px;">
                        <label id="onb_land_de_lbl" style="cursor:pointer;">
                            <input type="radio" name="onb_land" value="DE" checked style="display:none;">
                            <div class="onb-land-btn" id="onb_land_de_btn" onclick="CompanyManager._selectLand('DE')" style="
                                border:2px solid var(--accent);border-radius:10px;padding:12px;text-align:center;
                                background:rgba(99,102,241,.1);transition:all .15s;">
                                <div style="font-size:26px;">🇩🇪</div>
                                <div style="font-weight:700;font-size:14px;margin-top:4px;">Deutschland</div>
                                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">§19 UStG · EÜR · GoBD</div>
                            </div>
                        </label>
                        <label id="onb_land_at_lbl" style="cursor:pointer;">
                            <input type="radio" name="onb_land" value="AT" style="display:none;">
                            <div class="onb-land-btn" id="onb_land_at_btn" onclick="CompanyManager._selectLand('AT')" style="
                                border:2px solid var(--border);border-radius:10px;padding:12px;text-align:center;
                                background:var(--bg-secondary);transition:all .15s;">
                                <div style="font-size:26px;">🇦🇹</div>
                                <div style="font-weight:700;font-size:14px;margin-top:4px;">Österreich</div>
                                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">§6 UStG · E1a · SVS</div>
                            </div>
                        </label>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label" style="font-size:14px;font-weight:700;">Firmenname *</label>
                    <input type="text" class="form-input" id="onb_name"
                           placeholder="z.B. Mein Business, Max Mustermann"
                           maxlength="40" style="font-size:16px;"
                           onkeydown="if(event.key==='Enter') CompanyManager._submitOnboarding()">
                </div>

                <div class="form-group">
                    <label class="form-label" style="font-size:14px;font-weight:700;">Branche</label>
                    <select class="form-select" id="onb_branche">${branchenHtml}</select>
                </div>

                <div class="form-group">
                    <label class="form-label" style="font-size:14px;font-weight:700;">Erkennungsfarbe</label>
                    <div style="display:flex;gap:16px;margin-top:8px;justify-content:center;">${farbenHtml}</div>
                </div>

                <button class="btn btn-primary" onclick="CompanyManager._submitOnboarding()"
                        style="width:100%;padding:14px;font-size:16px;font-weight:700;margin-top:4px;border-radius:10px;">
                    🚀 Starten
                </button>
            </div>
        </div>
    </div>`;
        setTimeout(() => document.getElementById('onb_name')?.focus(), 100);
    },

    // Hilfsmethode: Land im Onboarding visuell selektieren
    _selectLand(land) {
        const deBtn = document.getElementById('onb_land_de_btn');
        const atBtn = document.getElementById('onb_land_at_btn');
        const deRad = document.querySelector('input[name="onb_land"][value="DE"]');
        const atRad = document.querySelector('input[name="onb_land"][value="AT"]');
        if (!deBtn || !atBtn) return;
        if (land === 'DE') {
            deBtn.style.border = '2px solid var(--accent)';
            deBtn.style.background = 'rgba(99,102,241,.1)';
            atBtn.style.border = '2px solid var(--border)';
            atBtn.style.background = 'var(--bg-secondary)';
            if (deRad) deRad.checked = true;
        } else {
            atBtn.style.border = '2px solid #e4323e';
            atBtn.style.background = 'rgba(228,50,62,.08)';
            deBtn.style.border = '2px solid var(--border)';
            deBtn.style.background = 'var(--bg-secondary)';
            if (atRad) atRad.checked = true;
        }
    },

    // Für Create-Modal Land-Wahl
    _selectLandBtn(prefix, land) {
        const de = document.getElementById(prefix + '_land_de');
        const at = document.getElementById(prefix + '_land_at');
        const deR = document.querySelector(`input[name="${prefix}_firma_land"][value="DE"]`);
        const atR = document.querySelector(`input[name="${prefix}_firma_land"][value="AT"]`);
        if (!de || !at) return;
        if (land === 'DE') {
            de.style.border = '2px solid var(--accent)'; de.style.background = 'rgba(99,102,241,.1)';
            at.style.border = '2px solid var(--border)'; at.style.background = 'var(--bg-secondary)';
            if (deR) deR.checked = true;
        } else {
            at.style.border = '2px solid #e4323e'; at.style.background = 'rgba(228,50,62,.08)';
            de.style.border = '2px solid var(--border)'; de.style.background = 'var(--bg-secondary)';
            if (atR) atR.checked = true;
        }
    },

    async _submitOnboarding() {
        const name    = document.getElementById('onb_name')?.value?.trim();
        const branche = document.getElementById('onb_branche')?.value || 'Reselling';
        const farbe   = document.querySelector('input[name="onb_farbe"]:checked')?.value || '#6366f1';
        const land    = document.querySelector('input[name="onb_land"]:checked')?.value || 'DE';

        if (!name) {
            document.getElementById('onb_name')?.focus();
            const inp = document.getElementById('onb_name');
            if (inp) inp.style.borderColor = 'var(--danger)';
            Utils.showToast('Bitte einen Firmennamen eingeben', 'warning');
            return;
        }

        const btn = document.querySelector('#onboarding button.btn-primary');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Wird angelegt…'; }

        const co = this.create(name, farbe, branche, land);
        localStorage.setItem(this.ACTIVE_KEY, co.id);

        await this.migrateExistingData(co.id);

        Store._companyId = co.id;

        const el = document.getElementById('onboarding');
        if (el) el.innerHTML = '';

        const switcher = document.getElementById('companySwitcher');
        if (switcher) switcher.innerHTML = this.renderSwitcherBtn();

        Utils.showToast(`✅ Firma "${name}" angelegt! (${land === 'AT' ? '🇦🇹 Österreich' : '🇩🇪 Deutschland'})`, 'success');

        App._continueAfterCompany();
    }
};
window.CompanyManager = CompanyManager;
