// ============================================
// GbR — Gesellschaft bürgerlichen Rechts
// Gesellschafter, Gewinnverteilung, eGbR
// ============================================
const GbR = {

    // ── Store-Keys (company-namespaced via Store.get/set) ──
    KEY_EINST:    'gbr_einstellungen',
    KEY_GS:       'gbr_gesellschafter',
    KEY_AUSZ:     'gbr_auszahlungen',      // legacy (V1: ausgezahlt bool)
    KEY_AUSZ_V2:  'gbr_auszahlungen_v2',   // V2: Array von Einzeleinträgen pro GS/Monat

    // Standard-Hebesatz (bundesweiter Durchschnitt ~400%)
    DEFAULT_HEBESATZ: 400,
    FREIBETRAG_GBR:   24500,   // §11 Abs. 1 GewStG – Freibetrag für Personengesellschaften
    MESSZAHL:         0.035,   // 3,5% Steuermesszahl §11 Abs. 2 GewStG

    // ── Einstellungen ──────────────────────────────────────────────────────
    getEinstellungen() {
        return Store.get(this.KEY_EINST) || {
            firmenform:            'Einzelunternehmen',  // 'Einzelunternehmen' | 'GbR' | 'eGbR'
            eGbrRegisternummer:    '',
            eGbrRegistergericht:   '',
            hebesatz:              this.DEFAULT_HEBESATZ,
        };
    },

    saveEinstellungen(data) {
        Store.set(this.KEY_EINST, data);
    },

    isGbR() {
        const e = this.getEinstellungen();
        return e.firmenform === 'GbR' || e.firmenform === 'eGbR';
    },

    // Alle Personengesellschaften mit Gesellschafter-Verwaltung
    isPersonengesellschaft() {
        const e = this.getEinstellungen();
        return ['GbR', 'eGbR', 'OHG', 'KG', 'GmbH & Co. KG'].includes(e.firmenform);
    },

    // Kapitalgesellschaften mit Gesellschafter/Anteilen
    isKapitalgesellschaft() {
        const e = this.getEinstellungen();
        return ['GmbH', 'UG'].includes(e.firmenform);
    },

    // Hat diese Rechtsform Gesellschafter?
    hatGesellschafter() {
        return this.isPersonengesellschaft() || this.isKapitalgesellschaft();
    },

    // ── Gesellschafter ─────────────────────────────────────────────────────
    getGesellschafter() {
        return Store.get(this.KEY_GS) || [];
    },

    saveGesellschafter(list) {
        Store.set(this.KEY_GS, list);
    },

    addGesellschafter(name, anteil, adresse, eingetreten, rolle) {
        const list = this.getGesellschafter();
        list.push({
            id:         Store.generateId(),
            name:       name.trim(),
            adresse:    adresse || '',
            anteil:     parseFloat(anteil) || 0,
            eingetreten: eingetreten || new Date().toLocaleDateString('sv-SE'),
            rolle:      rolle || 'gesellschafter', // gesellschafter | komplementaer | kommanditist | geschaeftsfuehrer
        });
        this.saveGesellschafter(list);
    },

    // KG: Komplementäre und Kommanditisten getrennt
    getKomplementaere() {
        return this.getGesellschafter().filter(g => g.rolle === 'komplementaer');
    },
    getKommanditisten() {
        return this.getGesellschafter().filter(g => g.rolle === 'kommanditist');
    },

    updateGesellschafter(id, data) {
        const list = this.getGesellschafter();
        const idx  = list.findIndex(g => g.id === id);
        if (idx < 0) return;
        list[idx] = { ...list[idx], ...data };
        this.saveGesellschafter(list);
    },

    removeGesellschafter(id) {
        this.saveGesellschafter(this.getGesellschafter().filter(g => g.id !== id));
    },

    // Summe aller Anteile (sollte 100 sein)
    sumAnteile() {
        return this.getGesellschafter().reduce((s, g) => s + (parseFloat(g.anteil) || 0), 0);
    },

    // ── Berechnungen ───────────────────────────────────────────────────────

    // Gewerbesteuer für die GbR gesamt
    berechneGewSt(gewinn) {
        const einst     = this.getEinstellungen();
        const hebesatz  = parseFloat(einst.hebesatz) || this.DEFAULT_HEBESATZ;
        const gewerbeertrag = Math.max(0, gewinn - this.FREIBETRAG_GBR);
        const messbetrag    = gewerbeertrag * this.MESSZAHL;
        return messbetrag * (hebesatz / 100);
    },

    // Gewinnverteilung auf alle Gesellschafter
    berechneVerteilung(gewinn) {
        const list    = this.getGesellschafter();
        const gewSt   = this.berechneGewSt(gewinn);
        const sumPct  = this.sumAnteile();
        return list.map(g => {
            const pct      = parseFloat(g.anteil) || 0;
            const faktor   = sumPct > 0 ? pct / sumPct : 0;
            return {
                id:           g.id,
                name:         g.name,
                anteil:       pct,
                gewinnanteil: gewinn * faktor,
                gewStAnteil:  gewSt  * faktor,
            };
        });
    },

    // ── EÜR-Block: Gewinnverteilung ────────────────────────────────────────
    renderEuerBlock(gewinn) {
        if (!this.isGbR()) return '';
        const einst       = this.getEinstellungen();
        const gesellsch   = this.getGesellschafter();
        const hebesatz    = parseFloat(einst.hebesatz) || this.DEFAULT_HEBESATZ;
        const gewSt       = this.berechneGewSt(gewinn);
        const verteilung  = this.berechneVerteilung(gewinn);
        const sumPct      = this.sumAnteile();
        const pctWarning  = Math.abs(sumPct - 100) > 0.01;
        const fmt         = v => Utils.formatCurrency(v);

        const rows = verteilung.map(v => `
            <tr>
                <td style="padding:8px 12px;font-weight:600;">${Utils.escapeHtml(v.name)}</td>
                <td style="padding:8px 12px;text-align:right;">${v.anteil.toFixed(1)} %</td>
                <td style="padding:8px 12px;text-align:right;font-weight:700;color:${v.gewinnanteil >= 0 ? 'var(--success)' : 'var(--danger)'};">${fmt(v.gewinnanteil)}</td>
                <td style="padding:8px 12px;text-align:right;color:var(--text-secondary);">${fmt(v.gewStAnteil)}</td>
                <td style="padding:8px 12px;text-align:right;color:var(--text-muted);font-size:12px;">
                    ${fmt(v.gewinnanteil - v.gewStAnteil)}
                </td>
            </tr>`).join('');

        const gewerbeertrag = Math.max(0, gewinn - this.FREIBETRAG_GBR);

        return `
        <div class="card" style="margin-top:20px;border:1px solid rgba(99,102,241,.3);">
            <div class="card-header" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <div class="card-title"><i class="ti ti-users"></i> Gewinnverteilung GbR</div>
                <span style="font-size:12px;color:var(--text-muted);">${einst.firmenform}</span>
                <div style="display:flex;gap:6px;margin-left:auto;">
                    <button class="btn btn-small no-print" data-action="gbr-open-ausz" style="font-size:11px;"><i class="ti ti-calendar-dollar"></i> Auszahlungen</button>
                    <button class="btn btn-small btn-outline no-print" data-action="gbr-open-settings" style="font-size:11px;"><i class="ti ti-settings"></i> Gesellschafter</button>
                </div>
            </div>

            ${pctWarning ? `
            <div style="margin-bottom:12px;padding:8px 12px;background:rgba(239,68,68,.1);border:1px solid var(--danger);border-radius:6px;font-size:12px;color:var(--danger);">
                <i class="ti ti-alert-triangle"></i> Anteile summieren sich auf ${sumPct.toFixed(1)} % statt 100 % — bitte korrigieren.
                <button class="btn btn-small" data-action="gbr-open-settings" style="margin-left:8px;font-size:11px;">Jetzt korrigieren</button>
            </div>` : ''}

            ${gesellsch.length === 0 ? `
            <div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">
                Noch keine Gesellschafter angelegt.
                <button class="btn btn-small btn-outline" data-action="gbr-open-settings" style="margin-left:10px;">Jetzt anlegen</button>
            </div>` : `
            <div class="table-container" style="border:none;margin-bottom:0;">
                <table>
                    <thead>
                        <tr>
                            <th style="padding:8px 12px;">Gesellschafter</th>
                            <th style="padding:8px 12px;text-align:right;">Anteil</th>
                            <th style="padding:8px 12px;text-align:right;">Gewinnanteil</th>
                            <th style="padding:8px 12px;text-align:right;">GewSt-Anteil</th>
                            <th style="padding:8px 12px;text-align:right;font-size:11px;">Nach GewSt</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="border-top:2px solid var(--border);font-weight:700;">
                            <td style="padding:8px 12px;">Gesamt</td>
                            <td style="padding:8px 12px;text-align:right;">${sumPct.toFixed(1)} %</td>
                            <td style="padding:8px 12px;text-align:right;">${fmt(gewinn)}</td>
                            <td style="padding:8px 12px;text-align:right;">${fmt(gewSt)}</td>
                            <td style="padding:8px 12px;text-align:right;">${fmt(gewinn - gewSt)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div style="padding:12px;background:var(--bg-secondary);border-top:1px solid var(--border);font-size:12px;color:var(--text-muted);display:flex;gap:20px;flex-wrap:wrap;">
                <span><i class="ti ti-chart-bar"></i> Hebesatz: <strong style="color:var(--text-primary);">${hebesatz} %</strong></span>
                <span><i class="ti ti-trending-down"></i> GewSt-Freibetrag: <strong style="color:var(--text-primary);">${fmt(this.FREIBETRAG_GBR)}</strong></span>
                <span><i class="ti ti-coin"></i> Gewerbeertrag: <strong style="color:var(--text-primary);">${fmt(gewerbeertrag)}</strong></span>
                <span><i class="ti ti-building-bank"></i> GewSt gesamt: <strong style="color:var(--danger);">${fmt(gewSt)}</strong></span>
            </div>`}
        </div>`;
    },

    // ── Einstellungs-Modal (Gesellschafter + GbR-Daten) ───────────────────
    openSettingsModal() {
        this._renderSettingsModal();
    },

    _renderSettingsModal() {
        const einst = this.getEinstellungen();
        const list  = this.getGesellschafter();
        const sumPct = this.sumAnteile();

        const isKG = ['KG', 'GmbH & Co. KG'].includes(einst.firmenform);
        const showRolle = ['KG', 'OHG', 'GmbH & Co. KG', 'GmbH', 'UG'].includes(einst.firmenform);
        const rolleOptions = isKG
            ? [['komplementaer','Komplementär'],['kommanditist','Kommanditist']]
            : einst.firmenform === 'OHG'
                ? [['gesellschafter','Gesellschafter']]
                : ['GmbH','UG'].includes(einst.firmenform)
                    ? [['gesellschafter','Gesellschafter'],['geschaeftsfuehrer','Geschäftsführer']]
                    : [['gesellschafter','Gesellschafter']];

        const gsRows = list.map(g => `
            <tr id="gs_row_${g.id}">
                <td style="padding:6px 8px;">
                    <input type="text" class="form-input" id="gs_name_${g.id}" value="${Utils.escapeHtml(g.name)}"
                           style="font-size:13px;padding:5px 8px;" placeholder="Name">
                </td>
                <td style="padding:6px 8px;">
                    <input type="text" class="form-input" id="gs_adresse_${g.id}" value="${Utils.escapeHtml(g.adresse || '')}"
                           style="font-size:12px;padding:5px 8px;" placeholder="Adresse (optional)">
                </td>
                ${showRolle ? `<td style="padding:6px 8px;width:130px;">
                    <select class="form-select" id="gs_rolle_${g.id}" style="font-size:11px;padding:4px 6px;">
                        ${rolleOptions.map(([v,l]) => `<option value="${v}" ${(g.rolle||'gesellschafter')===v?'selected':''}>${l}</option>`).join('')}
                    </select>
                </td>` : ''}
                <td style="padding:6px 8px;width:90px;">
                    <div style="display:flex;align-items:center;gap:4px;">
                        <input type="number" class="form-input" id="gs_anteil_${g.id}" value="${g.anteil}"
                               min="0" max="100" step="0.1" style="font-size:13px;padding:5px 8px;" data-action-input="gbr-anteil-sum">
                        <span style="font-size:12px;color:var(--text-muted);">%</span>
                    </div>
                </td>
                <td style="padding:6px 8px;width:120px;">
                    <input type="date" class="form-input" id="gs_eintritt_${g.id}" value="${g.eingetreten || ''}"
                           style="font-size:12px;padding:5px 6px;">
                </td>
                <td style="padding:6px 8px;width:40px;text-align:center;">
                    <button data-action="gbr-remove-gs" data-args='["${g.id}"]' title="Entfernen"
                            class="action-btn action-btn-danger" style="width:26px;height:26px;font-size:13px;"><i class="ti ti-trash"></i></button>
                </td>
            </tr>`).join('');

        const body = `
        <div style="display:flex;flex-direction:column;gap:20px;">

            <!-- Firmenform -->
            <div class="form-group">
                <label class="form-label" style="font-weight:700;">Unternehmensform</label>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:6px;">
                    ${(typeof Rechtsform !== 'undefined' ? Object.keys(Rechtsform.FORMEN) : ['Einzelunternehmen','Freiberufler','GbR','eGbR','OHG','KG','GmbH','UG','GmbH & Co. KG']).map(f => {
                        const icons = {'Einzelunternehmen':'👤','Freiberufler':'💼','GbR':'🤝','eGbR':'🏛','OHG':'🏪','KG':'🏭','GmbH':'🏢','UG':'🏠','GmbH & Co. KG':'🏗'};
                        return `<div data-action="gbr-select-form" data-args='["${f}"]' id="gbr_form_${f.replace(/[^a-z0-9]/gi,'')}" style="
                        border:2px solid ${einst.firmenform===f ? 'var(--accent)' : 'var(--border)'};
                        background:${einst.firmenform===f ? 'rgba(99,102,241,.1)' : 'var(--bg-secondary)'};
                        border-radius:8px;padding:10px;text-align:center;cursor:pointer;transition:all .15s;">
                        <div style="font-size:18px;">${icons[f]||'🏢'}</div>
                        <div style="font-weight:700;font-size:11px;margin-top:4px;">${f}</div>
                    </div>`;
                    }).join('')}
                </div>
                <input type="hidden" id="gbr_firmenform" value="${einst.firmenform}">
                ${typeof Rechtsform !== 'undefined' ? '<div id="rechtsformPreviewInModal" style="margin-top:8px;"></div>' : ''}
            </div>

            <!-- eGbR Felder (nur sichtbar wenn eGbR) -->
            <div id="egbr_felder" style="${einst.firmenform==='eGbR' ? '' : 'display:none;'}">
                <div style="padding:12px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.2);border-radius:8px;margin-bottom:4px;">
                    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
                        💡 Seit 01.01.2024 (MoPeG): eGbR-Pflichtangaben auf Rechnungen (Registernummer + -gericht)
                    </div>
                    <div class="form-row" style="gap:10px;">
                        <div class="form-group">
                            <label class="form-label">Registernummer</label>
                            <input type="text" class="form-input" id="gbr_regnr" value="${Utils.escapeHtml(einst.eGbrRegisternummer || '')}"
                                   placeholder="z.B. GbR 12345">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Registergericht</label>
                            <input type="text" class="form-input" id="gbr_reggericht" value="${Utils.escapeHtml(einst.eGbrRegistergericht || '')}"
                                   placeholder="z.B. Amtsgericht München">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Handelsregister-Felder (OHG/KG/GmbH/UG/GmbH & Co. KG) -->
            <div id="hr_felder" style="${['OHG','KG','GmbH','UG','GmbH & Co. KG'].includes(einst.firmenform) ? '' : 'display:none;'}">
                <div style="padding:12px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.2);border-radius:8px;margin-bottom:4px;">
                    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
                        📋 Handelsregister-Pflichtangaben (§37a HGB / §35a GmbHG)
                    </div>
                    <div class="form-row" style="gap:10px;">
                        <div class="form-group">
                            <label class="form-label">Registernummer (HRA/HRB)</label>
                            <input type="text" class="form-input" id="gbr_hrnr" value="${Utils.escapeHtml(einst.handelsregisterNr || '')}"
                                   placeholder="z.B. HRB 12345">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Registergericht</label>
                            <input type="text" class="form-input" id="gbr_hrgericht" value="${Utils.escapeHtml(einst.handelsregisterGericht || '')}"
                                   placeholder="z.B. Amtsgericht München">
                        </div>
                    </div>
                    <div class="form-row" style="gap:10px;margin-top:8px;">
                        <div class="form-group">
                            <label class="form-label">Sitz der Gesellschaft</label>
                            <input type="text" class="form-input" id="gbr_sitz" value="${Utils.escapeHtml(einst.sitz || '')}"
                                   placeholder="z.B. München">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Geschäftsführer / Vertretungsberechtigte</label>
                            <input type="text" class="form-input" id="gbr_gf" value="${Utils.escapeHtml(einst.geschaeftsfuehrer || '')}"
                                   placeholder="z.B. Max Mustermann">
                        </div>
                    </div>
                    <div class="form-row" style="gap:10px;margin-top:8px;" id="stammkapital_row" style="${['GmbH','UG'].includes(einst.firmenform) ? '' : 'display:none;'}">
                        <div class="form-group" style="max-width:200px;">
                            <label class="form-label">Stammkapital (€)</label>
                            <input type="number" class="form-input" id="gbr_stammkapital" value="${einst.stammkapital || ''}"
                                   placeholder="${einst.firmenform === 'UG' ? '1' : '25000'}" min="1" step="1">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Gewerbesteuer-Hebesatz -->
            <div class="form-row" style="gap:10px;align-items:flex-end;">
                <div class="form-group" style="flex:1;">
                    <label class="form-label" style="font-weight:700;">Gewerbesteuer-Hebesatz</label>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <input type="number" class="form-input" id="gbr_hebesatz" value="${einst.hebesatz || this.DEFAULT_HEBESATZ}"
                               min="0" max="1000" style="width:100px;">
                        <span style="color:var(--text-muted);font-size:13px;">%</span>
                        <span style="font-size:11px;color:var(--text-muted);">Bundesweiter Ø ~400 % · Lokal beim Gewerbeamt erfragen</span>
                    </div>
                </div>
            </div>

            <!-- Gesellschafter -->
            <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                    <div>
                        <div style="font-weight:700;font-size:14px;">Gesellschafter</div>
                        <div style="font-size:12px;color:var(--text-muted);">Anteile müssen zusammen 100 % ergeben</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span id="gbr_anteil_sum" style="font-size:13px;font-weight:700;
                              color:${Math.abs(sumPct-100)<0.01?'var(--success)':'var(--danger)'};">
                            Σ ${sumPct.toFixed(1)} %
                        </span>
                        <button class="btn btn-small btn-outline" data-action="gbr-add-gs"><i class="ti ti-plus"></i> Hinzufügen</button>
                    </div>
                </div>

                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead>
                            <tr style="background:var(--bg-secondary);">
                                <th style="padding:6px 8px;font-size:11px;text-align:left;">Name *</th>
                                <th style="padding:6px 8px;font-size:11px;text-align:left;">Adresse</th>
                                <th style="padding:6px 8px;font-size:11px;text-align:left;">Anteil %</th>
                                <th style="padding:6px 8px;font-size:11px;text-align:left;">Eingetreten</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="gbr_gs_tbody">
                            ${gsRows}
                        </tbody>
                    </table>
                </div>
                ${list.length === 0 ? `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;">Noch keine Gesellschafter. Klicke "+ Hinzufügen".</div>` : ''}
            </div>

        </div>`;

        const footer = `
            <button class="btn" data-action="close-modal">Abbrechen</button>
            <button class="btn btn-primary" data-action="gbr-save-settings"><i class="ti ti-device-floppy"></i> Speichern</button>
        `;
        App.showModal('⚙ GbR / Unternehmensform', body, footer);
    },

    _selectForm(form) {
        const allForms = typeof Rechtsform !== 'undefined'
            ? Object.keys(Rechtsform.FORMEN)
            : ['Einzelunternehmen','Freiberufler','GbR','eGbR','OHG','KG','GmbH','UG','GmbH & Co. KG'];
        allForms.forEach(f => {
            const el = document.getElementById('gbr_form_' + f.replace(/[^a-z0-9]/gi,''));
            if (!el) return;
            if (f === form) {
                el.style.border = '2px solid var(--accent)';
                el.style.background = 'rgba(99,102,241,.1)';
            } else {
                el.style.border = '2px solid var(--border)';
                el.style.background = 'var(--bg-secondary)';
            }
        });
        const inp = document.getElementById('gbr_firmenform');
        if (inp) inp.value = form;
        const egbr = document.getElementById('egbr_felder');
        if (egbr) egbr.style.display = form === 'eGbR' ? '' : 'none';
        const hr = document.getElementById('hr_felder');
        if (hr) hr.style.display = ['OHG','KG','GmbH','UG','GmbH & Co. KG'].includes(form) ? '' : 'none';
        const skRow = document.getElementById('stammkapital_row');
        if (skRow) skRow.style.display = ['GmbH','UG'].includes(form) ? '' : 'none';
        // Rechtsform-Preview im Modal
        const preview = document.getElementById('rechtsformPreviewInModal');
        if (preview && typeof Rechtsform !== 'undefined') {
            preview.innerHTML = Rechtsform.renderPflichtenOverview(form);
        }
    },

    _addGsRow() {
        const tbody = document.getElementById('gbr_gs_tbody');
        if (!tbody) return;
        const tempId = 'new_' + Date.now();
        const today  = new Date().toLocaleDateString('sv-SE');
        const tr = document.createElement('tr');
        tr.id = 'gs_row_' + tempId;
        tr.innerHTML = `
            <td style="padding:6px 8px;">
                <input type="text" class="form-input" id="gs_name_${tempId}" style="font-size:13px;padding:5px 8px;" placeholder="Name">
            </td>
            <td style="padding:6px 8px;">
                <input type="text" class="form-input" id="gs_adresse_${tempId}" style="font-size:12px;padding:5px 8px;" placeholder="Adresse">
            </td>
            <td style="padding:6px 8px;width:90px;">
                <div style="display:flex;align-items:center;gap:4px;">
                    <input type="number" class="form-input" id="gs_anteil_${tempId}" value="0" min="0" max="100" step="0.1"
                           style="font-size:13px;padding:5px 8px;" data-action-input="gbr-anteil-sum">
                    <span style="font-size:12px;color:var(--text-muted);">%</span>
                </div>
            </td>
            <td style="padding:6px 8px;width:120px;">
                <input type="date" class="form-input" id="gs_eintritt_${tempId}" value="${today}" style="font-size:12px;padding:5px 6px;">
            </td>
            <td style="padding:6px 8px;width:40px;text-align:center;">
                <button data-action="gbr-remove-gs" data-args='["${tempId}"]' style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:16px;">🗑</button>
            </td>`;
        tbody.appendChild(tr);
        document.getElementById('gs_name_' + tempId)?.focus();
    },

    _removeGsRow(id) {
        document.getElementById('gs_row_' + id)?.remove();
        this._updateAnteilSum();
    },

    _updateAnteilSum() {
        let sum = 0;
        document.querySelectorAll('[id^="gs_anteil_"]').forEach(inp => {
            sum += parseFloat(inp.value) || 0;
        });
        const el = document.getElementById('gbr_anteil_sum');
        if (el) {
            el.textContent = 'Σ ' + sum.toFixed(1) + ' %';
            el.style.color = Math.abs(sum - 100) < 0.01 ? 'var(--success)' : 'var(--danger)';
        }
    },

    _saveSettingsModal() {
        const firmenform = document.getElementById('gbr_firmenform')?.value || 'Einzelunternehmen';
        const hebesatz   = parseFloat(document.getElementById('gbr_hebesatz')?.value) || this.DEFAULT_HEBESATZ;
        const regNr      = document.getElementById('gbr_regnr')?.value?.trim() || '';
        const regGericht = document.getElementById('gbr_reggericht')?.value?.trim() || '';
        const hrNr       = document.getElementById('gbr_hrnr')?.value?.trim() || '';
        const hrGericht  = document.getElementById('gbr_hrgericht')?.value?.trim() || '';
        const sitz       = document.getElementById('gbr_sitz')?.value?.trim() || '';
        const gf         = document.getElementById('gbr_gf')?.value?.trim() || '';
        const stammkapital = parseFloat(document.getElementById('gbr_stammkapital')?.value) || 0;

        // Gesellschafter aus Tabelle lesen
        const newList = [];
        document.querySelectorAll('[id^="gs_row_"]').forEach(row => {
            const rowId   = row.id.replace('gs_row_', '');
            const name    = document.getElementById('gs_name_' + rowId)?.value?.trim();
            const adresse = document.getElementById('gs_adresse_' + rowId)?.value?.trim() || '';
            const anteil  = parseFloat(document.getElementById('gs_anteil_' + rowId)?.value) || 0;
            const rolleEl = document.getElementById('gs_rolle_' + rowId);
            const rolle   = rolleEl ? rolleEl.value : 'gesellschafter';
            const eintritt = document.getElementById('gs_eintritt_' + rowId)?.value || '';
            if (!name) return;
            const existing = this.getGesellschafter().find(g => g.id === rowId);
            newList.push({
                id:          existing ? existing.id : Store.generateId(),
                name,
                adresse,
                anteil,
                eingetreten: eintritt,
                rolle,
            });
        });

        // Validierung: Anteile-Summe prüfen (Personengesellschaften)
        if (['GbR', 'eGbR', 'OHG', 'KG', 'GmbH & Co. KG', 'GmbH', 'UG'].includes(firmenform) && newList.length > 0) {
            const sumPct = newList.reduce((s, g) => s + g.anteil, 0);
            if (Math.abs(sumPct - 100) > 0.01) {
                Utils.showToast(`⚠️ Anteile ergeben ${sumPct.toFixed(1)} % — müssen 100 % sein`, 'warning');
                return;
            }
        }

        this.saveEinstellungen({
            firmenform,
            eGbrRegisternummer:  regNr,
            eGbrRegistergericht: regGericht,
            handelsregisterNr:   hrNr,
            handelsregisterGericht: hrGericht,
            sitz,
            geschaeftsfuehrer:   gf,
            stammkapital,
            hebesatz,
        });
        this.saveGesellschafter(newList);

        App.closeModal();
        Utils.showToast('✅ GbR-Einstellungen gespeichert', 'success');

        // EÜR neu rendern falls gerade offen
        if (typeof App !== 'undefined' && App.currentPage === 'euer') {
            const contentEl = document.getElementById('content');
            if (contentEl && typeof Euer !== 'undefined') {
                contentEl.innerHTML = Euer.render();
                Euer.init();
            }
        }
    },

    // ── Settings-Tab in App.showSettingsModal() ────────────────────────────
    // Gibt einen kompakten GbR-Block zurück der in die Settings eingebettet wird
    renderSettingsBlock() {
        const einst = this.getEinstellungen();
        const list  = this.getGesellschafter();
        const sumPct = this.sumAnteile();
        const pctOk  = Math.abs(sumPct - 100) < 0.01 || list.length === 0;

        return `
        <hr style="border-color:var(--border);margin:16px 0;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div>
                <div style="font-weight:700;font-size:14px;">🤝 Unternehmensform & GbR</div>
                <div style="font-size:12px;color:var(--text-muted);">
                    Aktuell: <strong>${einst.firmenform}</strong>
                    ${(einst.firmenform==='GbR'||einst.firmenform==='eGbR')
                        ? ` · ${list.length} Gesellschafter · Σ <span style="color:${pctOk?'var(--success)':'var(--danger)'};">${sumPct.toFixed(1)} %</span>`
                        : ''}
                    ${einst.firmenform==='eGbR' && einst.eGbrRegisternummer
                        ? ` · ${einst.eGbrRegisternummer}`
                        : ''}
                </div>
            </div>
            <button class="btn btn-small btn-outline" data-action="gbr-close-then-settings"
                    style="white-space:nowrap;">⚙ Bearbeiten</button>
        </div>
        ${!pctOk ? `
        <div style="padding:8px 12px;background:rgba(239,68,68,.1);border:1px solid var(--danger);border-radius:6px;font-size:12px;color:var(--danger);margin-bottom:8px;">
            ⚠️ Anteile summieren sich auf ${sumPct.toFixed(1)} % statt 100 %
        </div>` : ''}
        ${(einst.firmenform==='GbR'||einst.firmenform==='eGbR') && list.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${list.map(g => `
            <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;
                        background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;font-size:12px;">
                <span>👤</span>
                <strong>${Utils.escapeHtml(g.name)}</strong>
                <span style="color:var(--text-muted);">${g.anteil} %</span>
            </div>`).join('')}
        </div>` : ''}`;
    },

    // ── Monatliche Auszahlungen (Legacy V1) ───────────────────────────────

    getAuszahlungen() {
        return Store.get(this.KEY_AUSZ) || {};
    },

    saveAuszahlungen(data) {
        Store.set(this.KEY_AUSZ, data);
    },

    // ── Teilauszahlungen V2 ───────────────────────────────────────────────
    // Datenformat: { "2026-01": { "gs_id": [{id, datum, betrag, typ, notiz}] } }

    getAuszahlungenV2() {
        const raw = Store.get(this.KEY_AUSZ_V2) || {};
        // Einmalige Migration von V1 (ausgezahlt:bool + betrag → Array)
        const v1 = this.getAuszahlungen();
        let changed = false;
        Object.entries(v1).forEach(([mk, gsMap]) => {
            if (raw[mk]) return;
            Object.entries(gsMap || {}).forEach(([gsId, rec]) => {
                if (rec.ausgezahlt && parseFloat(rec.betrag) > 0) {
                    if (!raw[mk]) raw[mk] = {};
                    if (!raw[mk][gsId]) raw[mk][gsId] = [];
                    raw[mk][gsId].push({
                        id:    'v1_' + gsId + '_' + mk,
                        datum: rec.datum || (mk + '-01'),
                        betrag: parseFloat(rec.betrag) || 0,
                        typ:   'gewinnvorauszahlung',
                        notiz: rec.notizen || ''
                    });
                    changed = true;
                }
            });
        });
        if (changed) this.saveAuszahlungenV2(raw);
        return raw;
    },

    saveAuszahlungenV2(data) {
        Store.set(this.KEY_AUSZ_V2, data);
    },

    getMonthEntries(monthKey, gsId) {
        const d = this.getAuszahlungenV2();
        return (d[monthKey] && d[monthKey][gsId]) ? [...d[monthKey][gsId]] : [];
    },

    getTotalAusgezahlt(monthKey, gsId) {
        return this.getMonthEntries(monthKey, gsId)
            .reduce((s, e) => s + (parseFloat(e.betrag) || 0), 0);
    },

    addAuszahlungEntry(monthKey, gsId, eintrag) {
        const d = this.getAuszahlungenV2();
        if (!d[monthKey]) d[monthKey] = {};
        if (!d[monthKey][gsId]) d[monthKey][gsId] = [];
        d[monthKey][gsId].push({
            id:    Store.generateId(),
            datum: eintrag.datum,
            betrag: Math.round((parseFloat(eintrag.betrag) || 0) * 100) / 100,
            typ:   eintrag.typ || 'gewinnvorauszahlung',
            notiz: eintrag.notiz || ''
        });
        this.saveAuszahlungenV2(d);
    },

    deleteAuszahlungEntry(monthKey, gsId, eintragId) {
        const d = this.getAuszahlungenV2();
        if (d[monthKey] && d[monthKey][gsId]) {
            d[monthKey][gsId] = d[monthKey][gsId].filter(e => e.id !== eintragId);
        }
        this.saveAuszahlungenV2(d);
    },

    // Monatsgewinn berechnen (gleiche Logik wie euer.js, aber für einen einzelnen Monat)
    _calcMonthData(year, month) {
        const pad = n => String(n).padStart(2, '0');
        const startDate = `${year}-${pad(month + 1)}-01`;
        const lastDay   = new Date(year, month + 1, 0).getDate();
        const endDate   = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

        const storniertInvIds = new Set(
            (Store.getRechInvoices ? Store.getRechInvoices() : [])
                .filter(inv => inv.status === 'storniert' || inv._storniert)
                .map(inv => inv.id)
        );

        const sales    = Store.getSales().filter(s =>
            Utils.isInPeriod(s.datum, startDate, endDate) &&
            !(s._invoiceId && storniertInvIds.has(s._invoiceId))
        );
        const purchases = Store.getPurchases().filter(p =>
            Utils.isInPeriod(p.datum, startDate, endDate)
        );
        const expenses = Store.getExpenses().filter(e =>
            Utils.isInPeriod(e.datum, startDate, endDate)
        );

        const bruttoEinnahmen = sales.reduce((sum, s) =>
            sum + (parseFloat(s.verkaufspreis) || 0) + (parseFloat(s.versandkostenKaeufer) || 0), 0);
        const retourenErstattungen = Store.getRetouren()
            .filter(r => Utils.isInPeriod(r.datum, startDate, endDate))
            .reduce((sum, r) => sum + (parseFloat(r.erstattungBetrag) || 0), 0);

        // Synced unsynced invoices
        const syncedInvIds = new Set(Store.getSales(true).filter(s => s._invoiceId).map(s => s._invoiceId));
        const unsyncedInv  = (Store.getRechInvoices ? Store.getRechInvoices() : []).filter(inv => {
            if (inv.status !== 'bezahlt' || inv._storniert) return false;
            if (syncedInvIds.has(inv.id)) return false;
            return Utils.isInPeriod(inv.bezahltAm || inv.datum, startDate, endDate);
        });
        const rechnungsEinn = unsyncedInv.reduce((sum, inv) =>
            sum + (inv.positionen || []).reduce((s2, p) => s2 + (p.menge || 0) * (p.einzelpreis || 0), 0), 0);

        const nettoEinnahmen = bruttoEinnahmen + rechnungsEinn - retourenErstattungen;

        const wareneinkauf = purchases.filter(p => !p.eigenbeleg_id)
            .reduce((sum, p) => sum + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0);
        const versandkosten = sales.reduce((sum, s) =>
            sum + (parseFloat(s.versandkostenVerkaufer) || 0), 0);
        const plattformgebuehren = sales.reduce((sum, s) => {
            const vk  = parseFloat(s.verkaufspreis) || 0;
            const vkK = parseFloat(s.versandkostenKaeufer) || 0;
            return sum + (vk + vkK) * ((parseFloat(s.plattformgebuehrProzent) || 0) / 100);
        }, 0);
        const fahrtkosten = Store.getFahrten()
            .filter(f => Utils.isInPeriod(f.datum, startDate, endDate))
            .reduce((sum, f) => sum + (parseFloat(f.kosten) || 0), 0);
        const materialKosten = Store.getMaterialVerbrauch()
            .filter(v => !v.storniert && v.grund === 'verkauf' && Utils.isInPeriod(v.datum, startDate, endDate))
            .reduce((sum, v) => sum + (parseFloat(v.kosten) || 0), 0);
        const sonstigeAusgaben = expenses.reduce((sum, e) =>
            sum + (parseFloat(e.betrag) || 0), 0);

        const summeAusgaben = wareneinkauf + versandkosten + plattformgebuehren +
                              fahrtkosten + materialKosten + sonstigeAusgaben;
        const gewinn = nettoEinnahmen - summeAusgaben;

        return { einnahmen: nettoEinnahmen, ausgaben: summeAusgaben, gewinn, verkaeufe: sales.length };
    },

    // Monatsdaten mit Ausgaben-Aufschlüsselung nach Kategorie
    _calcMonthDataDetailed(year, month) {
        const base = this._calcMonthData(year, month);
        const pad = n => String(n).padStart(2, '0');
        const startDate = `${year}-${pad(month + 1)}-01`;
        const lastDay   = new Date(year, month + 1, 0).getDate();
        const endDate   = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

        const sales    = Store.getSales().filter(s => Utils.isInPeriod(s.datum, startDate, endDate));
        const purchases = Store.getPurchases().filter(p => Utils.isInPeriod(p.datum, startDate, endDate));
        const expenses = Store.getExpenses().filter(e => Utils.isInPeriod(e.datum, startDate, endDate));

        return {
            ...base,
            kategorien: {
                wareneinkauf:       purchases.filter(p => !p.eigenbeleg_id)
                    .reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0),
                versandkosten:      sales.reduce((s, sl) => s + (parseFloat(sl.versandkostenVerkaufer) || 0), 0),
                plattformgebuehren: sales.reduce((s, sl) => {
                    const vk = (parseFloat(sl.verkaufspreis) || 0) + (parseFloat(sl.versandkostenKaeufer) || 0);
                    return s + vk * ((parseFloat(sl.plattformgebuehrProzent) || 0) / 100);
                }, 0),
                fahrtkosten:        Store.getFahrten()
                    .filter(f => Utils.isInPeriod(f.datum, startDate, endDate))
                    .reduce((s, f) => s + (parseFloat(f.kosten) || 0), 0),
                material:           Store.getMaterialVerbrauch()
                    .filter(v => !v.storniert && v.grund === 'verkauf' && Utils.isInPeriod(v.datum, startDate, endDate))
                    .reduce((s, v) => s + (parseFloat(v.kosten) || 0), 0),
                sonstige:           expenses.reduce((s, e) => s + (parseFloat(e.betrag) || 0), 0),
            }
        };
    },

    // ── Tabbed Auszahlungen-Modal ─────────────────────────────────────────
    _TABS: [
        { key: 'verteilung',   label: '<i class="ti ti-chart-pie-2"></i> Gewinnverteilung' },
        { key: 'auszahlungen', label: '💸 Auszahlungen'     },
        { key: 'auswertung',   label: '📈 Auswertung'       },
    ],

    openAuszahlungenModal(year, activeTab) {
        year = parseInt(year) || new Date().getFullYear();
        GbR._auszYear = year;
        GbR._auszTab  = activeTab || 'verteilung';

        const body   = GbR._buildModalBody(year, GbR._auszTab);
        const footer = `
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%;">
                <button class="btn btn-outline btn-small" data-action="gbr-ausz-prev">◀ ${year - 1}</button>
                <span style="font-weight:700;font-size:15px;" id="auszYearLabel">${year}</span>
                <button class="btn btn-outline btn-small" data-action="gbr-ausz-next">▶ ${year + 1}</button>
                <span style="flex:1;"></span>
                <button class="btn" data-action="close-modal">Schließen</button>
            </div>`;
        App.showModal('🤝 GbR — Auswertung & Auszahlungen', body, footer);
    },

    _buildModalBody(year, tab) {
        const tabNav = this._TABS.map(t => `
            <button id="gbr_tab_${t.key}" data-action="gbr-ausz-tab" data-args='["${t.key}"]' 
                    style="padding:8px 16px;border:none;border-bottom:3px solid ${t.key===tab?'var(--accent)':'transparent'};
                           background:none;cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;
                           color:${t.key===tab?'var(--accent)':'var(--text-secondary)'};">
                ${t.label}</button>`).join('');

        const content = tab === 'verteilung'   ? this._renderTabVerteilung(year)
                      : tab === 'auszahlungen' ? this._renderTabAuszahlungen(year)
                      :                          this._renderTabAuswertung(year);

        return `<div id="auszModalBody">
            <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px;overflow-x:auto;">${tabNav}</div>
            <div id="auszTabContent">${content}</div>
        </div>`;
    },

    _switchAuszTab(tab) {
        GbR._auszTab = tab;
        const content = document.getElementById('auszTabContent');
        if (content) {
            content.innerHTML = tab === 'verteilung'   ? GbR._renderTabVerteilung(GbR._auszYear)
                              : tab === 'auszahlungen' ? GbR._renderTabAuszahlungen(GbR._auszYear)
                              :                          GbR._renderTabAuswertung(GbR._auszYear);
        }
        GbR._TABS.forEach(t => {
            const btn = document.getElementById('gbr_tab_' + t.key);
            if (!btn) return;
            btn.style.borderBottom = t.key === tab ? '3px solid var(--accent)' : '3px solid transparent';
            btn.style.color        = t.key === tab ? 'var(--accent)'           : 'var(--text-secondary)';
        });
    },

    _refreshAuszModal() {
        const yr   = GbR._auszYear;
        const body = document.getElementById('auszModalBody');
        if (body) body.outerHTML = GbR._buildModalBody(yr, GbR._auszTab);
        const lbl = document.getElementById('auszYearLabel');
        if (lbl) lbl.textContent = yr;
        document.querySelectorAll('.modal-footer button').forEach(b => {
            if (b.textContent.includes('◀')) b.textContent = `◀ ${yr - 1}`;
            if (b.textContent.includes('▶')) b.textContent = `▶ ${yr + 1}`;
        });
    },

    // ─────────────────────────────────────────────────────────────────────
    // TAB 1 — Gewinnverteilung
    // ─────────────────────────────────────────────────────────────────────
    _renderTabVerteilung(year) {
        const gesellsch   = this.getGesellschafter();
        const fmt         = v => Utils.formatCurrency(v);
        const monatNamen  = ['Januar','Februar','März','April','Mai','Juni',
                             'Juli','August','September','Oktober','November','Dezember'];
        const now         = new Date();
        const curYear     = now.getFullYear();
        const curMonth    = now.getMonth();

        if (!this.isGbR()) {
            return `<div style="padding:20px;text-align:center;color:var(--text-muted);">Nur für GbR / eGbR verfügbar. Bitte Firmenform in den Einstellungen ändern.</div>`;
        }
        if (gesellsch.length === 0) {
            return `<div style="padding:20px;text-align:center;color:var(--text-muted);">Noch keine Gesellschafter angelegt. <button class="btn btn-small btn-outline" data-action="gbr-close-then-settings">Jetzt anlegen</button></div>`;
        }

        // ── Jahres-Summen berechnen ──
        let jahresGewinn = 0, jahresEinn = 0, jahresAusg = 0;
        const gsSummen = {};
        gesellsch.forEach(g => { gsSummen[g.id] = { anspruch: 0, ausgezahlt: 0 }; });

        const rows = monatNamen.map((monatName, mIdx) => {
            const isFuture = year > curYear || (year === curYear && mIdx > curMonth);
            const data = isFuture ? { einnahmen: 0, ausgaben: 0, gewinn: 0, verkaeufe: 0 }
                                  : this._calcMonthData(year, mIdx);
            const { gewinn, einnahmen, ausgaben, verkaeufe } = data;
            if (!isFuture) { jahresGewinn += gewinn; jahresEinn += einnahmen; jahresAusg += ausgaben; }

            const monthKey  = `${year}-${String(mIdx + 1).padStart(2, '0')}`;
            const verteilung = this.berechneVerteilung(gewinn);

            const gsColsHtml = gesellsch.map(g => {
                const vEntry    = verteilung.find(v => v.id === g.id);
                const anspruch  = vEntry ? vEntry.gewinnanteil : 0;
                const ausgez    = this.getTotalAusgezahlt(monthKey, g.id);
                const offen     = anspruch - ausgez;
                const eintraege = this.getMonthEntries(monthKey, g.id);
                if (!isFuture) { gsSummen[g.id].anspruch += anspruch; gsSummen[g.id].ausgezahlt += ausgez; }

                if (isFuture) return `<td style="padding:8px 10px;text-align:center;color:var(--text-muted);font-size:12px;">—</td>`;

                const statusColor  = offen <= 0 ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.08)';
                const statusBorder = offen <= 0 ? 'rgba(34,197,94,.4)'  : 'rgba(239,68,68,.3)';
                const statusColor2 = offen <= 0 ? 'var(--success)'       : 'var(--danger)';
                const pill = offen <= 0
                    ? `<span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);color:var(--success);">✓ ausgezahlt</span>`
                    : `<span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:var(--danger);">${fmt(offen)} offen</span>`;

                return `<td style="padding:6px 8px;text-align:center;">
                    <div style="font-size:12px;font-weight:700;color:${anspruch>=0?'var(--success)':'var(--danger)'};">${fmt(anspruch)}</div>
                    ${ausgez > 0 ? `<div style="font-size:10px;color:var(--text-muted);">${fmt(ausgez)} bez.</div>` : ''}
                    <div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-top:3px;">
                        ${pill}
                        <button title="Auszahlung hinzufügen" data-action="gbr-add-ausz" data-args='[${year},${mIdx},"${g.id}"]' 
                            style="background:var(--accent);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:13px;line-height:1;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;">+</button>
                    </div>
                </td>`;
            }).join('');

            const gc = gewinn > 0 ? 'var(--success)' : gewinn < 0 ? 'var(--danger)' : 'var(--text-muted)';
            const rb = year === curYear && mIdx === curMonth ? 'background:rgba(99,102,241,.07);' : isFuture ? 'opacity:.5;' : '';
            return `<tr style="${rb}">
                <td style="padding:8px 10px;font-weight:600;white-space:nowrap;">
                    ${year === curYear && mIdx === curMonth ? '<span style="color:var(--accent);font-size:10px;">▶ </span>' : ''}${monatName}
                </td>
                <td style="padding:8px 10px;text-align:right;font-weight:700;color:${gc};">${isFuture?'—':fmt(gewinn)}</td>
                <td style="padding:8px 10px;text-align:right;font-size:12px;color:var(--text-muted);">${isFuture?'—':verkaeufe}</td>
                ${gsColsHtml}
            </tr>`;
        }).join('');

        const sumRow = `<tr style="border-top:2px solid var(--border);font-weight:700;background:var(--bg-secondary);">
            <td style="padding:9px 10px;">Gesamt ${year}</td>
            <td style="padding:9px 10px;text-align:right;color:${jahresGewinn>=0?'var(--success)':'var(--danger)'};">${fmt(jahresGewinn)}</td>
            <td></td>
            ${gesellsch.map(g => {
                const s = gsSummen[g.id];
                const offen = s.anspruch - s.ausgezahlt;
                const pct = s.anspruch !== 0 ? Math.round(s.ausgezahlt / s.anspruch * 100) : 0;
                return `<td style="padding:9px 10px;text-align:center;">
                    <div style="font-weight:700;">${fmt(s.anspruch)}</div>
                    <div style="font-size:10px;color:var(--success);">${fmt(s.ausgezahlt)} ausgezahlt (${pct}%)</div>
                    ${offen > 0.01 ? `<div style="font-size:10px;color:var(--danger);">${fmt(offen)} offen</div>` : ''}
                </td>`;
            }).join('')}
        </tr>`;

        const thGS = gesellsch.map(g => `<th style="padding:8px 10px;text-align:center;min-width:150px;">👤 ${Utils.escapeHtml(g.name)}<br><span style="font-weight:400;font-size:10px;">${g.anteil} %</span></th>`).join('');

        return `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
            ${[['Einnahmen',fmt(jahresEinn),'var(--text-primary)'],['Ausgaben',fmt(jahresAusg),'var(--danger)'],['Gewinn',fmt(jahresGewinn),jahresGewinn>=0?'var(--success)':'var(--danger)']].map(([l,v,c])=>`
            <div style="flex:1;min-width:120px;padding:10px 14px;background:var(--bg-secondary);border-radius:8px;border:1px solid var(--border);">
                <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">${l}</div>
                <div style="font-size:18px;font-weight:800;color:${c};margin-top:2px;">${v}</div>
            </div>`).join('')}
        </div>
        <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="border-bottom:2px solid var(--border);">
                    <th style="padding:8px 10px;text-align:left;">Monat</th>
                    <th style="padding:8px 10px;text-align:right;">Gewinn</th>
                    <th style="padding:8px 10px;text-align:right;font-size:11px;color:var(--text-muted);">Verk.</th>
                    ${thGS}
                </tr></thead>
                <tbody>${rows}</tbody>
                <tfoot>${sumRow}</tfoot>
            </table>
        </div>`;
    },

    // ── Auszahlung-Hinzufügen-Modal ────────────────────────────────────────
    openAddAuszahlungModal(year, month, gsId) {
        const gesellsch  = this.getGesellschafter();
        const g          = gesellsch.find(x => x.id === gsId);
        if (!g) return;
        const monatNamen = ['Januar','Februar','März','April','Mai','Juni',
                            'Juli','August','September','Oktober','November','Dezember'];
        const monthKey   = `${year}-${String(month + 1).padStart(2, '0')}`;
        const gewinn     = this._calcMonthData(year, month).gewinn;
        const verteilung = this.berechneVerteilung(gewinn);
        const vEntry     = verteilung.find(v => v.id === gsId);
        const anspruch   = vEntry ? vEntry.gewinnanteil : 0;
        const ausgez     = this.getTotalAusgezahlt(monthKey, gsId);
        const offen      = anspruch - ausgez;
        const fmt        = v => Utils.formatCurrency(v);
        const today      = new Date().toLocaleDateString('sv-SE');

        const body = `
        <div style="margin-bottom:14px;padding:12px;background:var(--bg-secondary);border-radius:8px;font-size:13px;">
            <strong>👤 ${Utils.escapeHtml(g.name)}</strong> · ${monatNamen[month]} ${year}<br>
            <span style="color:var(--text-muted);">Gewinnanteil: <strong style="color:var(--success);">${fmt(anspruch)}</strong> · Bereits ausgezahlt: <strong>${fmt(ausgez)}</strong> · Offen: <strong style="color:${offen>0?'var(--danger)':'var(--success)'};">${fmt(offen)}</strong></span>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Datum *</label>
                    <input type="date" class="form-input" id="nausz_datum" value="${today}">
                </div>
                <div class="form-group">
                    <label class="form-label">Betrag (€) *</label>
                    <input type="number" step="0.01" min="0" class="form-input" id="nausz_betrag"
                           value="${offen > 0 ? offen.toFixed(2) : '0'}" style="font-size:15px;font-weight:700;">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Typ</label>
                <div style="display:flex;gap:8px;">
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px;">
                        <input type="radio" name="nausz_typ" value="gewinnvorauszahlung" checked> Gewinnvorauszahlung
                    </label>
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px;">
                        <input type="radio" name="nausz_typ" value="entnahme"> Sonstige Entnahme
                    </label>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Notiz (optional)</label>
                <input type="text" class="form-input" id="nausz_notiz" placeholder="z.B. Überweisung IBAN …">
            </div>
        </div>`;

        const footer = `
            <button class="btn" data-action="gbr-cancel-ausz" data-args='[${year}]' >Abbrechen</button>
            <button class="btn btn-primary" data-action="gbr-save-ausz" data-args='[${year},${month},"${gsId}"]' ><i class="ti ti-device-floppy"></i> Buchen</button>`;
        App.showModal(`💸 Auszahlung buchen – ${Utils.escapeHtml(g.name)}`, body, footer);
    },

    _saveNewAuszahlung(year, month, gsId) {
        const datum  = document.getElementById('nausz_datum')?.value;
        const betrag = parseFloat(document.getElementById('nausz_betrag')?.value);
        const typ    = document.querySelector('input[name="nausz_typ"]:checked')?.value || 'gewinnvorauszahlung';
        const notiz  = document.getElementById('nausz_notiz')?.value?.trim() || '';
        if (!datum) { Utils.showToast('Bitte Datum angeben', 'warning'); return; }
        if (isNaN(betrag) || betrag <= 0) { Utils.showToast('Bitte gültigen Betrag eingeben', 'warning'); return; }
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        this.addAuszahlungEntry(monthKey, gsId, { datum, betrag, typ, notiz });
        Utils.showToast('✅ Auszahlung gebucht', 'success');
        App.closeModal();
        setTimeout(() => GbR.openAuszahlungenModal(year, 'auszahlungen'), 100);
    },

    // ─────────────────────────────────────────────────────────────────────
    // TAB 2 — Auszahlungen (Verrechnungskonto pro Gesellschafter)
    // ─────────────────────────────────────────────────────────────────────
    _renderTabAuszahlungen(year) {
        const gesellsch  = this.getGesellschafter();
        const fmt        = v => Utils.formatCurrency(v);
        const monatNamen = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
        const now        = new Date();
        const typLabel   = { gewinnvorauszahlung: '💰 Vorauszahlung', entnahme: '📤 Entnahme' };

        if (!this.isGbR()) return `<div style="padding:20px;text-align:center;color:var(--text-muted);">Nur für GbR verfügbar.</div>`;
        if (gesellsch.length === 0) return `<div style="padding:20px;text-align:center;color:var(--text-muted);">Noch keine Gesellschafter.</div>`;

        const sections = gesellsch.map(g => {
            // Alle Monate des Jahres aufsammeln
            let jahresAnspruch = 0, jahresAusgez = 0;
            const monatsRows = [];

            for (let mIdx = 0; mIdx < 12; mIdx++) {
                const isFuture = year > now.getFullYear() || (year === now.getFullYear() && mIdx > now.getMonth());
                if (isFuture) continue;
                const monthKey   = `${year}-${String(mIdx + 1).padStart(2, '0')}`;
                const gewinn     = this._calcMonthData(year, mIdx).gewinn;
                const verteilung = this.berechneVerteilung(gewinn);
                const vEntry     = verteilung.find(v => v.id === g.id);
                const anspruch   = vEntry ? vEntry.gewinnanteil : 0;
                const eintraege  = this.getMonthEntries(monthKey, g.id);
                const ausgez     = eintraege.reduce((s, e) => s + e.betrag, 0);
                jahresAnspruch += anspruch;
                jahresAusgez   += ausgez;

                eintraege.forEach(e => {
                    monatsRows.push(`
                    <tr>
                        <td style="padding:5px 8px;font-size:12px;color:var(--text-muted);">${monatNamen[mIdx]}</td>
                        <td style="padding:5px 8px;font-size:12px;">${Utils.formatDate(e.datum)}</td>
                        <td style="padding:5px 8px;font-size:12px;">${typLabel[e.typ] || e.typ}</td>
                        <td style="padding:5px 8px;font-weight:700;text-align:right;color:var(--success);">${fmt(e.betrag)}</td>
                        <td style="padding:5px 8px;font-size:11px;color:var(--text-muted);">${Utils.escapeHtml(e.notiz || '')}</td>
                        <td style="padding:5px 8px;text-align:center;">
                            <button data-action="gbr-del-ausz" data-args='["${monthKey}","${g.id}","${e.id}",${year}]' 
                                    class="action-btn action-btn-danger" style="width:24px;height:24px;font-size:12px;" title="Löschen"><i class="ti ti-trash"></i></button>
                        </td>
                    </tr>`);
                });
            }

            const saldo      = jahresAnspruch - jahresAusgez;
            const pct        = jahresAnspruch !== 0 ? Math.round(jahresAusgez / jahresAnspruch * 100) : 0;
            const saldoColor = saldo <= 0.01 ? 'var(--success)' : 'var(--danger)';

            return `
            <div style="margin-bottom:20px;border:1px solid var(--border);border-radius:10px;overflow:hidden;">
                <div style="padding:12px 16px;background:var(--bg-secondary);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                    <div>
                        <span style="font-weight:700;font-size:15px;">👤 ${Utils.escapeHtml(g.name)}</span>
                        <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">${g.anteil} % · ${year}</span>
                    </div>
                    <div style="display:flex;gap:16px;font-size:12px;">
                        <span>Anspruch: <strong style="color:var(--success);">${fmt(jahresAnspruch)}</strong></span>
                        <span>Ausgezahlt: <strong>${fmt(jahresAusgez)}</strong> (${pct}%)</span>
                        <span>Saldo: <strong style="color:${saldoColor};">${fmt(saldo)}</strong></span>
                    </div>
                    <button class="btn btn-small btn-primary" data-action="gbr-add-ausz" data-args='[${year},${now.getMonth()},"${g.id}"]' >+ Auszahlung</button>
                </div>
                ${monatsRows.length === 0
                    ? `<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:13px;">Noch keine Auszahlungen in ${year} gebucht.</div>`
                    : `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead><tr style="border-bottom:1px solid var(--border);font-size:11px;color:var(--text-muted);">
                            <th style="padding:5px 8px;">Monat</th>
                            <th style="padding:5px 8px;">Datum</th>
                            <th style="padding:5px 8px;">Typ</th>
                            <th style="padding:5px 8px;text-align:right;">Betrag</th>
                            <th style="padding:5px 8px;">Notiz</th>
                            <th></th>
                        </tr></thead>
                        <tbody>${monatsRows.join('')}</tbody>
                        <tfoot><tr style="border-top:1px solid var(--border);font-weight:700;">
                            <td colspan="3" style="padding:7px 8px;">Gesamt ausgezahlt</td>
                            <td style="padding:7px 8px;text-align:right;color:var(--success);">${fmt(jahresAusgez)}</td>
                            <td colspan="2"></td>
                        </tr></tfoot>
                    </table></div>`
                }
            </div>`;
        }).join('');

        return sections;
    },

    _deleteAusz(monthKey, gsId, eintragId, year) {
        if (!confirm('Auszahlung wirklich löschen?')) return;
        this.deleteAuszahlungEntry(monthKey, gsId, eintragId);
        Utils.showToast('🗑 Auszahlung gelöscht', 'success');
        const content = document.getElementById('auszTabContent');
        if (content) content.innerHTML = this._renderTabAuszahlungen(year);
    },

    // ─────────────────────────────────────────────────────────────────────
    // TAB 3 — Auswertung (Charts + Tabellen)
    // ─────────────────────────────────────────────────────────────────────
    _renderTabAuswertung(year) {
        const gesellsch  = this.getGesellschafter();
        const fmt        = v => Utils.formatCurrency(v);
        const monatK     = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
        const now        = new Date();

        if (!this.isGbR()) return `<div style="padding:20px;text-align:center;color:var(--text-muted);">Nur für GbR verfügbar.</div>`;

        // Alle Monatsdaten sammeln
        const months = [];
        const katTotals = { wareneinkauf:0, versandkosten:0, plattformgebuehren:0, fahrtkosten:0, material:0, sonstige:0 };
        for (let m = 0; m < 12; m++) {
            const isFuture = year > now.getFullYear() || (year === now.getFullYear() && m > now.getMonth());
            if (isFuture) { months.push({ label:monatK[m], einnahmen:0, ausgaben:0, gewinn:0, isFuture:true }); continue; }
            const d = this._calcMonthDataDetailed(year, m);
            months.push({ label:monatK[m], ...d, isFuture:false });
            Object.keys(katTotals).forEach(k => { katTotals[k] += d.kategorien[k] || 0; });
        }

        const maxVal   = Math.max(...months.map(m => Math.max(m.einnahmen, m.ausgaben)), 1);
        const barWidth = 100 / maxVal;

        // ── 1. Balken-Diagramm CSS ───────────────────────────────────────
        const barChart = `
        <div style="margin-bottom:20px;">
            <div style="font-weight:700;font-size:14px;margin-bottom:10px;">📊 Einnahmen vs. Ausgaben (${year})</div>
            <div style="display:flex;align-items:flex-end;gap:6px;height:120px;padding:0 4px;">
                ${months.map(m => `
                <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;height:100%;">
                    <div style="flex:1;width:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:1px;">
                        <div title="Einnahmen: ${fmt(m.einnahmen)}" style="width:100%;height:${m.einnahmen*barWidth}%;background:var(--success);border-radius:3px 3px 0 0;opacity:${m.isFuture?.3:1};min-height:${m.einnahmen>0?2:0}px;"></div>
                        <div title="Ausgaben: ${fmt(m.ausgaben)}" style="width:100%;height:${m.ausgaben*barWidth}%;background:var(--danger);border-radius:3px 3px 0 0;opacity:${m.isFuture?.3:.7};min-height:${m.ausgaben>0?2:0}px;"></div>
                    </div>
                    <div style="font-size:9px;color:var(--text-muted);white-space:nowrap;">${m.label}</div>
                </div>`).join('')}
            </div>
            <div style="display:flex;gap:14px;margin-top:8px;font-size:11px;">
                <span><span style="display:inline-block;width:10px;height:10px;background:var(--success);border-radius:2px;margin-right:4px;vertical-align:middle;"></span>Einnahmen</span>
                <span><span style="display:inline-block;width:10px;height:10px;background:var(--danger);opacity:.7;border-radius:2px;margin-right:4px;vertical-align:middle;"></span>Ausgaben</span>
            </div>
        </div>`;

        // ── 2. Ausgaben-Torte (SVG) ──────────────────────────────────────
        const katColors = { wareneinkauf:'#8b93f8', versandkosten:'#3b82f6', plattformgebuehren:'#f5a623', fahrtkosten:'#10b981', material:'#14b8a6', sonstige:'#6b7280' };
        const katLabels = { wareneinkauf:'Wareneinkauf', versandkosten:'Versandkosten', plattformgebuehren:'Plattformgeb.', fahrtkosten:'Fahrtkosten', material:'Material', sonstige:'Sonstige' };
        const katSegs   = Object.entries(katTotals).filter(([,v]) => v > 0.01).map(([k, v]) => ({ key:k, label:katLabels[k], value:v, color:katColors[k] }));
        const katTotal  = katSegs.reduce((s, x) => s + x.value, 0);
        const pieSvg    = this._renderSvgDonut(katSegs, 100);

        const pieSection = `
        <div style="margin-bottom:20px;display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
            <div>
                <div style="font-weight:700;font-size:14px;margin-bottom:10px;">🍩 Ausgaben-Kategorien (${year})</div>
                ${katTotal > 0 ? pieSvg : `<div style="color:var(--text-muted);font-size:13px;padding:20px 0;">Keine Ausgaben im Jahr ${year}</div>`}
            </div>
            <div style="flex:1;min-width:160px;">
                <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:8px;margin-top:26px;">Aufschlüsselung</div>
                ${katSegs.map(s => `
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;">
                    <span style="width:10px;height:10px;border-radius:50%;background:${s.color};flex-shrink:0;display:inline-block;"></span>
                    <span style="flex:1;color:var(--text-secondary);">${s.label}</span>
                    <strong>${fmt(s.value)}</strong>
                    <span style="color:var(--text-muted);width:36px;text-align:right;">${Math.round(s.value/katTotal*100)}%</span>
                </div>`).join('')}
                ${katSegs.length === 0 ? '<div style="color:var(--text-muted);font-size:12px;">—</div>' : ''}
            </div>
        </div>`;

        // ── 3. Pro-Gesellschafter Tabelle ────────────────────────────────
        const gsTable = gesellsch.length === 0 ? '' : `
        <div style="margin-bottom:20px;">
            <div style="font-weight:700;font-size:14px;margin-bottom:10px;">👥 Aufteilung pro Gesellschafter (${year})</div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <thead><tr style="border-bottom:2px solid var(--border);">
                        <th style="padding:7px 10px;text-align:left;">Gesellschafter</th>
                        <th style="padding:7px 10px;text-align:right;">Anteil</th>
                        <th style="padding:7px 10px;text-align:right;">Gewinnanteil</th>
                        <th style="padding:7px 10px;text-align:right;">Ausgezahlt</th>
                        <th style="padding:7px 10px;text-align:right;">Offen</th>
                    </tr></thead>
                    <tbody>
                    ${gesellsch.map(g => {
                        let gsAnspruch = 0, gsAusgez = 0;
                        months.filter(m => !m.isFuture).forEach((m, mIdx) => {
                            const mk = `${year}-${String(mIdx+1).padStart(2,'0')}`;
                            const vert = this.berechneVerteilung(m.gewinn);
                            const ve = vert.find(v => v.id === g.id);
                            gsAnspruch += ve ? ve.gewinnanteil : 0;
                            gsAusgez   += this.getTotalAusgezahlt(mk, g.id);
                        });
                        const offen = gsAnspruch - gsAusgez;
                        return `<tr style="border-bottom:1px solid var(--border);">
                            <td style="padding:7px 10px;font-weight:600;">👤 ${Utils.escapeHtml(g.name)}</td>
                            <td style="padding:7px 10px;text-align:right;color:var(--text-muted);">${g.anteil} %</td>
                            <td style="padding:7px 10px;text-align:right;font-weight:700;color:var(--success);">${fmt(gsAnspruch)}</td>
                            <td style="padding:7px 10px;text-align:right;">${fmt(gsAusgez)}</td>
                            <td style="padding:7px 10px;text-align:right;font-weight:700;color:${offen>0.01?'var(--danger)':'var(--success)'};">${fmt(offen)}</td>
                        </tr>`;
                    }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;

        // ── 4. Monatliche Details-Tabelle ────────────────────────────────
        const detailRows = months.filter(m => !m.isFuture).map((m, i) => `
            <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:6px 10px;font-weight:600;">${m.label}</td>
                <td style="padding:6px 10px;text-align:right;">${fmt(m.einnahmen)}</td>
                <td style="padding:6px 10px;text-align:right;color:var(--danger);">${fmt(m.ausgaben)}</td>
                <td style="padding:6px 10px;text-align:right;font-weight:700;color:${m.gewinn>=0?'var(--success)':'var(--danger)'};">${fmt(m.gewinn)}</td>
                <td style="padding:6px 10px;text-align:right;font-size:11px;color:var(--text-muted);">${m.verkaeufe}</td>
            </tr>`).join('');

        const totEinn = months.reduce((s,m) => s+m.einnahmen, 0);
        const totAusg = months.reduce((s,m) => s+m.ausgaben, 0);
        const totGew  = months.reduce((s,m) => s+m.gewinn, 0);

        const detailTable = `
        <details>
            <summary style="cursor:pointer;padding:8px 0;font-weight:700;font-size:14px;list-style:none;display:flex;align-items:center;gap:6px;">
                📋 Monatsdetails ausklappen
            </summary>
            <div style="overflow-x:auto;margin-top:10px;">
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    <thead><tr style="border-bottom:2px solid var(--border);">
                        <th style="padding:6px 10px;text-align:left;">Monat</th>
                        <th style="padding:6px 10px;text-align:right;">Einnahmen</th>
                        <th style="padding:6px 10px;text-align:right;">Ausgaben</th>
                        <th style="padding:6px 10px;text-align:right;">Gewinn</th>
                        <th style="padding:6px 10px;text-align:right;font-size:10px;">Verk.</th>
                    </tr></thead>
                    <tbody>${detailRows}</tbody>
                    <tfoot><tr style="border-top:2px solid var(--border);font-weight:700;background:var(--bg-secondary);">
                        <td style="padding:7px 10px;">Gesamt ${year}</td>
                        <td style="padding:7px 10px;text-align:right;">${fmt(totEinn)}</td>
                        <td style="padding:7px 10px;text-align:right;color:var(--danger);">${fmt(totAusg)}</td>
                        <td style="padding:7px 10px;text-align:right;color:${totGew>=0?'var(--success)':'var(--danger)'};">${fmt(totGew)}</td>
                        <td></td>
                    </tr></tfoot>
                </table>
            </div>
        </details>`;

        return barChart + pieSection + gsTable + detailTable;
    },

    // SVG-Donut-Chart: segments = [{label, value, color}]
    _renderSvgDonut(segments, size) {
        const total = segments.reduce((s, x) => s + x.value, 0);
        if (total === 0) return '';
        const cx = size / 2, cy = size / 2, r = size / 2 - 6, ri = r * 0.55;
        let cumAngle = -Math.PI / 2;
        const paths = segments.map(sg => {
            const frac = sg.value / total;
            const startA = cumAngle;
            const endA   = cumAngle + frac * 2 * Math.PI;
            cumAngle     = endA;
            if (frac >= 0.9999) {
                return `<path d="M${cx},${cy-r} A${r},${r} 0 1,1 ${cx-0.001},${cy-r} Z
                               M${cx},${cy-ri} A${ri},${ri} 0 1,0 ${cx-0.001},${cy-ri} Z" fill="${sg.color}" fill-rule="evenodd"/>`;
            }
            const x1=cx+r*Math.cos(startA), y1=cy+r*Math.sin(startA);
            const x2=cx+r*Math.cos(endA),   y2=cy+r*Math.sin(endA);
            const ix1=cx+ri*Math.cos(startA),iy1=cy+ri*Math.sin(startA);
            const ix2=cx+ri*Math.cos(endA),  iy2=cy+ri*Math.sin(endA);
            const la = frac > 0.5 ? 1 : 0;
            return `<path d="M${x1},${y1} A${r},${r} 0 ${la},1 ${x2},${y2} L${ix2},${iy2} A${ri},${ri} 0 ${la},0 ${ix1},${iy1} Z" fill="${sg.color}"/>`;
        }).join('');
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;">${paths}</svg>`;
    },

    // ── Dashboard-Kacheln (Gewinnanteil pro Gesellschafter) ────────────────
    renderDashboardKacheln(gewinn) {
        if (!this.isGbR() || this.getGesellschafter().length === 0) return '';
        const verteilung = this.berechneVerteilung(gewinn);
        const fmt = v => Utils.formatCurrency(v);

        return `
        <div style="grid-column:1/-1;">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
                🤝 Gewinnverteilung GbR
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
                ${verteilung.map(v => `
                <div class="card stat-card" style="cursor:pointer;" data-action="navigate" data-args=\'["euer"]\'>
                    <div class="card-label">👤 ${Utils.escapeHtml(v.name)} · ${v.anteil.toFixed(0)} %</div>
                    <div class="card-value" style="color:${v.gewinnanteil>=0?'var(--success)':'var(--danger)'};">${fmt(v.gewinnanteil)}</div>
                    <div class="card-subtitle">Gewinnanteil · GewSt: ${fmt(v.gewStAnteil)}</div>
                </div>`).join('')}
                <div class="card stat-card" style="cursor:pointer;border-style:dashed;" data-action="gbr-open-ausz">
                    <div class="card-label">📅 Auszahlungen</div>
                    <div class="card-value" style="font-size:20px;">buchen</div>
                    <div class="card-subtitle">Monatliche EÜR öffnen</div>
                </div>
            </div>
        </div>`;
    },
};
window.GbR = GbR;

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'gbr-open-ausz':           function (year) { GbR.openAuszahlungenModal(typeof year === 'number' ? year : new Date().getFullYear()); },
    'gbr-open-settings':       function () { GbR.openSettingsModal(); },
    'gbr-anteil-sum':          function () { GbR._updateAnteilSum(); },
    'gbr-remove-gs':           function (id) { GbR._removeGsRow(id); },
    'gbr-select-form':         function (f) { GbR._selectForm(f); },
    'gbr-add-gs':              function () { GbR._addGsRow(); },
    'gbr-save-settings':       function () { GbR._saveSettingsModal(); },
    'gbr-close-then-settings': function () { App.closeModal(); setTimeout(function () { GbR.openSettingsModal(); }, 100); },
    'gbr-ausz-prev':           function () { GbR._auszYear--; GbR._refreshAuszModal(); },
    'gbr-ausz-next':           function () { GbR._auszYear++; GbR._refreshAuszModal(); },
    'gbr-ausz-tab':            function (key) { GbR._switchAuszTab(key); },
    'gbr-add-ausz':            function (year, mIdx, gsId) { GbR.openAddAuszahlungModal(year, mIdx, gsId); },
    'gbr-cancel-ausz':         function (year) { App.closeModal(); setTimeout(function () { GbR.openAuszahlungenModal(year, 'auszahlungen'); }, 100); },
    'gbr-save-ausz':           function (year, month, gsId) { GbR._saveNewAuszahlung(year, month, gsId); },
    'gbr-del-ausz':            function (monthKey, gId, eId, year) { GbR._deleteAusz(monthKey, gId, eId, year); }
});
