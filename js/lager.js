// ============================================
// Lager Module - Inventory Management
// ============================================
const Lager = {
    _filters: {},
    _viewMode: 'table',   // 'table' | 'grid'
    _sortBy: 'newest',
    // Spaltensortierung der Tabellenansicht. Solange col leer ist, gilt das Sortier-Dropdown
    // (_sortBy) — es ist immer genau eine Sortierquelle aktiv, sonst widersprechen sie sich.
    _headSort: { col: '', dir: 'asc' },
    _selected: new Set(),
    _pendingPhotos: {},   // id → base64
    _currentPage: 1,
    _pageSize: 50,
    _lastAllFiltered: [], // für Export (alle gefilterten, nicht nur aktuelle Seite)
    _activeTab: 'real',   // 'real' | 'virtual'

    // ── Lager-Layout — Store-Helfer ──────────────────────────────────────────
    _getLayout() {
        try {
            const raw = localStorage.getItem('lager_layout');
            if (!raw) return { gridCols: 6, gridRows: 4, zones: [] };
            const l = JSON.parse(raw);
            return { gridCols: l.gridCols || 6, gridRows: l.gridRows || 4, zones: l.zones || [] };
        } catch(e) { return { gridCols: 6, gridRows: 4, zones: [] }; }
    },
    _saveLayout(l) { localStorage.setItem('lager_layout', JSON.stringify(l)); },
    _genZId()      { return 'z_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5); },
    _layoutEditMode: false,

    ZONE_TYPES: {
        regal:     { label: 'Regal',      icon: '🗄️' },
        box:       { label: 'Box/Karton', icon: '📦' },
        schrank:   { label: 'Schrank',    icon: '🗃️' },
        boden:     { label: 'Boden',      icon: '📐' },
        sonstiges: { label: 'Sonstiges',  icon: '📍' }
    },
    ZONE_COLORS: ['#10b981','#2563eb','#8b93f8','#d97706','#dc2626','#0891b2','#9333ea','#16a34a','#ea580c','#be185d'],

    // ── Artikel-Farben (Mehrfachauswahl pro Artikel, Kunden-Wunschliste Punkt 3) ──
    ARTIKEL_FARBEN: [
        ['#000000','Schwarz'], ['#ffffff','Weiß'],  ['#6b7280','Grau'],
        ['#78350f','Braun'],   ['#1d4ed8','Blau'],  ['#15803d','Grün'],
        ['#dc2626','Rot'],     ['#ea580c','Orange'],['#ca8a04','Gelb'],
        ['#db2777','Pink'],    ['#7c3aed','Lila'],  ['#0891b2','Türkis']
    ],

    // HTML für ein Farben-Multiselect-Feld (Label + verstecktes CSV-Feld + Chip-Container).
    // prefix = eindeutiges ID-Präfix des Formulars (z.B. 'le', 'neu', 'bulk').
    _farbenFieldHtml(prefix, selected, labelSuffix) {
        const sel = (selected || []).join(',');
        return `
            <div class="form-group">
                <label class="form-label">Farben${labelSuffix ? ' <span style="color:var(--text-muted);font-weight:400;">' + labelSuffix + '</span>' : ''}</label>
                <input type="hidden" id="${prefix}_farben" value="${Utils.escapeHtml(sel)}">
                <div id="${prefix}_farbenChips" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;"></div>
            </div>`;
    },

    // Rendert die Farb-Chips (Palette + eigene Auswahl) und verdrahtet Klick-Toggle.
    // Muss nach App.showModal(...) einmalig pro Formular aufgerufen werden.
    _bindFarbenPicker(prefix) {
        const hidden    = document.getElementById(`${prefix}_farben`);
        const container = document.getElementById(`${prefix}_farbenChips`);
        if (!hidden || !container) return;
        const norm = h => (h || '').toLowerCase();
        const render = () => {
            const selected = hidden.value ? hidden.value.split(',').filter(Boolean) : [];
            const paletteHtml = this.ARTIKEL_FARBEN.map(([hex, name]) => {
                const isSel = selected.some(s => norm(s) === norm(hex));
                return `<div data-farbe="${hex}" title="${Utils.escapeHtml(name)}"
                    style="width:24px;height:24px;border-radius:50%;background:${hex};cursor:pointer;
                    border:2px solid ${isSel ? 'var(--accent)' : 'var(--border)'};
                    box-shadow:${isSel ? '0 0 0 2px var(--accent)' : 'none'};"></div>`;
            }).join('');
            const customSel = selected.filter(s => !this.ARTIKEL_FARBEN.some(([hex]) => norm(hex) === norm(s)));
            const customHtml = customSel.map(hex => `
                <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:10px;background:${hex}22;border:1px solid ${hex};font-size:11px;">
                    <span style="width:10px;height:10px;border-radius:50%;background:${hex};display:inline-block;"></span>
                    <span data-farbe-remove="${hex}" style="cursor:pointer;" title="Entfernen">×</span>
                </span>`).join('');
            container.innerHTML = paletteHtml +
                `<input type="color" id="${prefix}_farbeCustom" title="Eigene Farbe hinzufügen"
                    style="width:24px;height:24px;border:none;background:none;cursor:pointer;padding:0;">` +
                customHtml;

            container.querySelectorAll('[data-farbe]').forEach(el => {
                el.addEventListener('click', () => {
                    const hex = el.getAttribute('data-farbe');
                    let sel = hidden.value ? hidden.value.split(',').filter(Boolean) : [];
                    sel = sel.some(s => norm(s) === norm(hex)) ? sel.filter(s => norm(s) !== norm(hex)) : sel.concat(hex);
                    hidden.value = sel.join(',');
                    render();
                });
            });
            container.querySelectorAll('[data-farbe-remove]').forEach(el => {
                el.addEventListener('click', () => {
                    const hex = el.getAttribute('data-farbe-remove');
                    hidden.value = (hidden.value ? hidden.value.split(',').filter(Boolean) : []).filter(s => norm(s) !== norm(hex)).join(',');
                    render();
                });
            });
            const customInput = document.getElementById(`${prefix}_farbeCustom`);
            if (customInput) customInput.addEventListener('change', () => {
                const hex = customInput.value;
                let sel = hidden.value ? hidden.value.split(',').filter(Boolean) : [];
                if (!sel.some(s => norm(s) === norm(hex))) sel.push(hex);
                hidden.value = sel.join(',');
                render();
            });
        };
        render();
    },

    _getFarben(prefix) {
        const hidden = document.getElementById(`${prefix}_farben`);
        return hidden && hidden.value ? hidden.value.split(',').filter(Boolean) : [];
    },

    // Dynamisch aus Store.getLagerStatusListe() (frei editierbar, s. lager/page.js openStatusModal) —
    // Vorschlagswerte in Store.LAGER_STATUS_DEFAULT. 'verfuegbar'/'verkauft' bleiben System-Keys.
    get STATUS_CONFIG() {
        const cfg = {};
        Store.getLagerStatusListe().forEach(s => { cfg[s.key] = s; });
        return cfg;
    },

    SORT_OPTIONS: [
        { value: 'newest',    label: 'Neueste zuerst' },
        { value: 'oldest',    label: 'Älteste / FIFO'  },
        { value: 'ek_desc',   label: 'Höchster EK'    },
        { value: 'ek_asc',    label: 'Niedrigster EK' },
        { value: 'marke',     label: 'Marke (A–Z)'    },
        { value: 'artikelnr', label: 'Artikelnummer'   }
    ],

    _loadPrefs() {
        try {
            const p = JSON.parse(localStorage.getItem('lager_prefs') || '{}');
            if (p.viewMode) this._viewMode = p.viewMode;
            if (p.sortBy)   this._sortBy   = p.sortBy;
            if (p.pageSize) this._pageSize = parseInt(p.pageSize) || 50;
            if (p.headSort && typeof p.headSort === 'object') {
                this._headSort = { col: p.headSort.col || '', dir: p.headSort.dir === 'desc' ? 'desc' : 'asc' };
            }
        } catch(e) {}
    },

    _savePrefs() {
        try {
            localStorage.setItem('lager_prefs', JSON.stringify({
                viewMode: this._viewMode,
                sortBy:   this._sortBy,
                pageSize: this._pageSize,
                headSort: this._headSort
            }));
        } catch(e) {}
    },

    // Lagerort als durchsuchbarer Text ("Keller Regal 3 Fach B").
    _lagerortText(p) {
        const lo = (p && p.lagerort) || {};
        return [lo.bereich, lo.regal, lo.fach].filter(Boolean).join(' ');
    },

    // Sortierwert je Spaltenkopf. Nicht jede Spalte ist ein direktes Feld: "Artikel" fasst
    // Marke + Typ + Beschreibung zusammen, "Lager" den Lagerort. EK muss eine Zahl bleiben,
    // sonst sortiert der generische Vergleicher alphabetisch (100 € vor 20 €).
    _sortValue(p, col) {
        switch (col) {
            case 'artikelNr':     return p.artikelNr || '';
            case 'datum':         return p.datum || '';
            case 'artikel':       return [p.marke, p.artikeltyp, p.beschreibung].filter(Boolean).join(' ');
            case 'groesse':       return p.groesse || '';
            case 'einkaufspreis': return parseFloat(p.einkaufspreis) || 0;
            case 'lagerort':      return this._lagerortText(p);
            case 'status':        return p.status || '';
            default:              return p[col];
        }
    },

    // ── Artikel-Nummern für alte Einträge nachrüsten ─────────────────────
    _migrateArtikelNummern() {
        try {
            const purchases = Store.getAllPurchasesRaw();
            let needsSave = false;

            // ── Migration 1: Fehlende IDs nachrüsten ──────────────────
            // (passierte bei Bulk-Save vor Bugfix — Records ohne unique ID)
            const idLess = purchases.filter(p => !p.id);
            if (idLess.length > 0) {
                idLess.forEach(p => {
                    p.id = Store.generateId();
                    if (!p.createdAt) p.createdAt = new Date().toISOString();
                });
                needsSave = true;
                console.log(`[Lager] ${idLess.length} fehlende IDs nachgerüstet`);
            }

            // ── Migration 2: Fehlende Artikelnummern nachrüsten ───────
            const missing = purchases.filter(p => !p.artikelNr && !p.storniert);
            if (missing.length > 0) {
                const usedNrs = new Set(purchases.map(p => p.artikelNr).filter(Boolean));
                missing.forEach(p => {
                    const year = new Date(p.datum || p.createdAt || Date.now()).getFullYear();
                    const prefix = `${year}-`;
                    let maxN = 0;
                    usedNrs.forEach(nr => {
                        if (nr && nr.startsWith(prefix)) {
                            const m = nr.match(/^(\d{4})-(\d+)$/);
                            if (m) maxN = Math.max(maxN, parseInt(m[2]));
                        }
                    });
                    const newNr = prefix + String(maxN + 1).padStart(3, '0');
                    p.artikelNr = newNr;
                    usedNrs.add(newNr);
                });
                needsSave = true;
                console.log(`[Lager] ${missing.length} Artikel-Nummern nachgerüstet`);
            }

            if (needsSave) {
                purchases.forEach(p => Store._stampRecord(p));
                Store.set('purchases', purchases);
            }
        } catch(e) {
            console.warn('[Lager] Migration fehlgeschlagen:', e);
        }
    },

    // ── Verkauf-Modal (Einzel & Paket) ────────────────────────────────────
    openVerkaufModal(ids) {
        if (!ids || ids.length === 0) {
            Utils.showToast('Kein Artikel ausgewählt', 'warning');
            return;
        }

        const purchases = Store.getPurchases();
        const selected  = purchases.filter(p => ids.includes(p.id));
        if (selected.length === 0) {
            Utils.showToast('Artikel nicht gefunden', 'warning');
            return;
        }

        const isMulti   = selected.length > 1;
        const today     = new Date().toLocaleDateString('sv-SE');
        const platforms = Store.getPlatforms();
        const lastPlat  = localStorage.getItem('lager_last_platform') || 'Vinted';
        const platOpts  = platforms.filter(p => p !== 'Sonstiges')
            .map(p => `<option value="${Utils.escapeHtml(p)}" ${p === lastPlat ? 'selected' : ''}>${Utils.escapeHtml(p)}</option>`)
            .join('');

        const totalEK = selected.reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0), 0);

        // Artikel-Vorschau
        const artikelRows = selected.map(p => `
            <tr>
                <td style="padding:4px 8px;font-size:12px;">${Utils.escapeHtml(p.artikelNr || '—')}</td>
                <td style="padding:4px 8px;font-size:12px;">${Utils.escapeHtml(p.marke || '')} ${Utils.escapeHtml(p.artikeltyp || '')}</td>
                <td style="padding:4px 8px;font-size:12px;">${Utils.escapeHtml(p.groesse || '')}</td>
                <td style="padding:4px 8px;font-size:12px;text-align:right;">${Utils.formatCurrency(p.einkaufspreis)}</td>
            </tr>
        `).join('');

        // Kompakte Artikel-Info-Zeilen
        const artikelInfo = selected.map(p =>
            `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);">
                ${p.foto ? `<img src="${p.foto}" style="width:28px;height:28px;object-fit:cover;border-radius:4px;flex-shrink:0;">` : `<span style="font-size:18px;line-height:1;">📦</span>`}
                <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${Utils.escapeHtml((p.marke||'') + ' ' + (p.artikeltyp||''))}</div>
                    <div style="font-size:10px;color:var(--text-muted);">${Utils.escapeHtml(p.artikelNr||'')}${p.groesse ? ' · Gr. '+Utils.escapeHtml(p.groesse) : ''}</div>
                </div>
                <div style="font-size:12px;font-weight:700;white-space:nowrap;color:var(--danger);">EK ${Utils.formatCurrency(p.einkaufspreis)}</div>
            </div>`
        ).join('');

        const body = `
            <!-- Artikel-Info (kompakt) -->
            <div style="background:var(--bg-secondary);border-radius:8px;padding:6px 12px;margin-bottom:14px;">
                ${artikelInfo}
                ${isMulti ? `<div style="padding:5px 0 2px;font-size:12px;font-weight:700;text-align:right;">Gesamt EK: <span style="color:var(--danger);">${Utils.formatCurrency(totalEK)}</span></div>` : ''}
            </div>

            <!-- 2-Spalten-Layout: Felder links, Vorschau rechts -->
            <div style="display:grid;grid-template-columns:1fr 200px;gap:16px;align-items:start;">

                <!-- Linke Spalte: Formfelder -->
                <div style="display:flex;flex-direction:column;gap:10px;">

                    <!-- Datum + Plattform -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div>
                            <label class="form-label" style="font-size:11px;">Datum *</label>
                            <input type="date" class="form-input" id="vk_datum" value="${today}" style="padding:6px 10px;font-size:13px;">
                        </div>
                        <div>
                            <label class="form-label" style="font-size:11px;">Plattform *</label>
                            <select class="form-select" id="vk_plattform" style="padding:6px 10px;font-size:13px;">
                                ${platOpts}
                                <option value="Sonstiges">Sonstiges</option>
                            </select>
                        </div>
                    </div>

                    <!-- Custom Plattform -->
                    <div id="vk_customPlattformWrap" style="display:none;">
                        <label class="form-label" style="font-size:11px;">Eigene Plattform</label>
                        <input type="text" class="form-input" id="vk_customPlattform" placeholder="Plattform …" style="padding:6px 10px;font-size:13px;">
                    </div>

                    <!-- Verkaufspreis (groß) -->
                    <div>
                        <label class="form-label" style="font-size:11px;">Verkaufspreis (€) *</label>
                        <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="vk_preis"
                               placeholder="0,00" style="font-size:22px;font-weight:700;padding:8px 12px;"
                               data-action-input="lg-calc-vk">
                    </div>

                    <!-- Versand Käufer + Gebühr -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <div>
                            <label class="form-label" style="font-size:11px;">Versand Käufer (€)</label>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="vk_versandKaeufer"
                                   value="0" style="padding:6px 10px;font-size:13px;" data-action-input="lg-calc-vk">
                        </div>
                        <div>
                            <label class="form-label" style="font-size:11px;">Gebühr (%)</label>
                            <input type="number" step="0.1" min="0" max="100" class="form-input" id="vk_gebuehr"
                                   value="0" style="padding:6px 10px;font-size:13px;" data-action-input="lg-calc-vk">
                        </div>
                    </div>

                    <!-- Versand Verkäufer -->
                    <div>
                        <label class="form-label" style="font-size:11px;">Versand Verkäufer (€)</label>
                        <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="vk_versandVk"
                               value="0" style="padding:6px 10px;font-size:13px;" data-action-input="lg-calc-vk">
                    </div>

                    <!-- Käufer + Notizen klappbar -->
                    <details style="border:1px solid var(--border);border-radius:6px;">
                        <summary style="padding:7px 12px;cursor:pointer;font-size:12px;font-weight:600;color:var(--text-secondary);list-style:none;display:flex;align-items:center;gap:6px;">
                            ＋ Käufer / Notizen <span style="font-weight:400;color:var(--text-muted);">(optional)</span>
                        </summary>
                        <div style="padding:10px 12px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:8px;">
                            <div>
                                <label class="form-label" style="font-size:11px;">Käufer / Nutzername</label>
                                <input type="text" class="form-input" id="vk_kaeufer" placeholder="Optional" style="padding:6px 10px;font-size:13px;">
                            </div>
                            <div>
                                <label class="form-label" style="font-size:11px;">Notizen</label>
                                <textarea class="form-textarea" id="vk_notizen" rows="2" placeholder="Optional" style="font-size:13px;padding:6px 10px;"></textarea>
                            </div>
                        </div>
                    </details>
                </div>

                <!-- Rechte Spalte: Gewinn-Vorschau -->
                <div id="vk_nettoPreview" style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:12px;font-size:12px;position:sticky;top:0;">
                    <div style="font-weight:700;margin-bottom:10px;color:var(--text-muted);font-size:10px;text-transform:uppercase;letter-spacing:.5px;">Vorschau</div>
                    <div style="display:grid;grid-template-columns:1fr auto;gap:5px 8px;align-items:baseline;">
                        <span style="color:var(--text-secondary);font-size:11px;">Verkauf</span>
                        <span id="vk_prev_preis" style="text-align:right;font-size:12px;">—</span>
                        <span style="color:var(--text-secondary);font-size:11px;">− Gebühr</span>
                        <span id="vk_prev_geb" style="text-align:right;font-size:12px;">—</span>
                        <span style="color:var(--text-secondary);font-size:11px;">− Versand</span>
                        <span id="vk_prev_vsk" style="text-align:right;font-size:12px;">—</span>
                        <span style="color:var(--text-secondary);font-size:11px;">− EK</span>
                        <span id="vk_prev_ek" style="text-align:right;font-size:12px;color:var(--danger);">− ${Utils.formatCurrency(totalEK)}</span>
                        <span style="font-weight:700;font-size:12px;border-top:1px solid var(--border);padding-top:8px;margin-top:4px;">Gewinn</span>
                        <span id="vk_prev_netto" style="font-weight:700;font-size:18px;text-align:right;border-top:1px solid var(--border);padding-top:8px;margin-top:4px;color:var(--success);">—</span>
                    </div>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn" data-action="close-modal">Abbrechen</button>
            <button class="btn btn-primary" id="saveVerkauf" style="min-width:140px;">💰 Verkauf speichern</button>
        `;

        App.showModal(isMulti ? `Paketverkauf (${selected.length} Artikel)` : 'Artikel verkaufen', body, footer);

        // Store EK for netto calc
        Lager._vkTotalEK = totalEK;

        // Plattform → nur Custom-Feld ein-/ausblenden (kein Auto-Fill für Gebühr)
        const platSel = document.getElementById('vk_plattform');
        platSel.addEventListener('change', () => {
            document.getElementById('vk_customPlattformWrap').style.display =
                platSel.value === 'Sonstiges' ? '' : 'none';
        });

        // Save
        document.getElementById('saveVerkauf').addEventListener('click', () => {
            const datum   = Utils.getDateInputValue('vk_datum');
            const preis   = parseFloat(document.getElementById('vk_preis').value) || 0;

            if (!datum)  { Utils.showToast('Bitte Datum eingeben (TT.MM.JJJJ)', 'warning'); return; }
            if (preis <= 0) { Utils.showToast('Bitte Verkaufspreis angeben', 'warning'); document.getElementById('vk_preis').focus(); return; }

            let plattform = platSel.value;
            if (plattform === 'Sonstiges') {
                const custom = (document.getElementById('vk_customPlattform') || {}).value?.trim();
                if (custom) { plattform = custom; Store.addPlatform(custom); }
            } else {
                Store.addPlatform(plattform);
            }
            localStorage.setItem('lager_last_platform', plattform);

            const saleData = {
                datum,
                verkaufsplattform: plattform,
                verkaufspreis:     preis,
                versandkostenKaeufer:   parseFloat(document.getElementById('vk_versandKaeufer').value) || 0,
                plattformgebuehrProzent: parseFloat(document.getElementById('vk_gebuehr').value)      || 0,
                versandkostenVerkaufer:  parseFloat(document.getElementById('vk_versandVk').value)    || 0,
                kaeufer:  (document.getElementById('vk_kaeufer') || {}).value?.trim() || '',
                notizen:  document.getElementById('vk_notizen').value.trim()
            };

            if (selected.length === 1) {
                const p = selected[0];
                saleData.purchaseId  = p.id;
                saleData.marke       = p.marke || '';
                saleData.artikeltyp  = p.artikeltyp || '';
                saleData.groesse     = p.groesse || '';
                saleData.beschreibung = p.beschreibung || '';
                Store.saveSale(saleData);
            } else {
                const marken = [...new Set(selected.map(p => p.marke).filter(Boolean))];
                saleData.purchaseIds = ids;
                saleData.marke       = marken.join(', ');
                saleData.artikeltyp  = `${selected.length} Artikel`;
                saleData.beschreibung = `Paket: ${selected.map(p => [p.marke, p.artikeltyp, p.groesse].filter(Boolean).join(' ')).join(', ')}`;
                Store.saveSaleMulti(saleData);
            }

            App.closeModal();
            this._selected.clear();
            Utils.showToast(`Verkauf gespeichert${isMulti ? ` (${selected.length} Artikel)` : ''}`, 'success');
            const contentEl = document.getElementById('content');
            contentEl.innerHTML = this.render();
            this.init();
        });
    },

    // Netto-Gewinn live berechnen
    _calcVkNetto() {
        try {
            const preis  = parseFloat(document.getElementById('vk_preis')?.value)         || 0;
            const vsk    = parseFloat(document.getElementById('vk_versandKaeufer')?.value) || 0;
            const geb    = parseFloat(document.getElementById('vk_gebuehr')?.value)        || 0;
            const vskVk  = parseFloat(document.getElementById('vk_versandVk')?.value)      || 0;
            const ek     = Lager._vkTotalEK || 0;

            const bruttoEinnahme = preis + vsk;
            const gebBetrag = bruttoEinnahme * (geb / 100);
            const netto = preis + vsk - gebBetrag - vskVk - ek;

            const fmt = v => Utils.formatCurrency(v);
            const el = id => document.getElementById(id);
            if (el('vk_prev_preis')) el('vk_prev_preis').textContent = fmt(preis + vsk);
            if (el('vk_prev_geb'))   el('vk_prev_geb').textContent   = '− ' + fmt(gebBetrag);
            if (el('vk_prev_vsk'))   el('vk_prev_vsk').textContent   = '− ' + fmt(vskVk);
            if (el('vk_prev_netto')) {
                el('vk_prev_netto').textContent = fmt(netto);
                el('vk_prev_netto').style.color = netto >= 0 ? 'var(--success)' : 'var(--danger)';
            }
        } catch(e) {}
    },
    _vkTotalEK: 0,

    _statusBadge(status, storniert) {
        if (storniert) return '<span class="badge badge-danger" style="font-weight:600;padding:3px 8px;">Storniert</span>';
        const cfg = this.STATUS_CONFIG[status];
        if (!cfg) return `<span class="badge badge-neutral">${Utils.escapeHtml(status || '—')}</span>`;
        return `<span class="badge" style="background:${cfg.bg};color:${cfg.color};border:1px solid ${cfg.color}40;font-weight:600;padding:3px 8px;border-radius:6px;">${cfg.label}</span>`;
    },

    _setPhoto(id, base64) {
        const p = Store.getPurchases(true).find(x => x.id === id);
        if (p) {
            p.foto = base64;
            Store.savePurchase(p);
        }
        // Update preview img if edit modal is open
        const preview = document.getElementById('lagerPhotoPreview_' + id);
        if (preview) { preview.src = base64; preview.style.display = 'block'; }
        // Refresh table/grid photo cell
        const contentEl = document.getElementById('content');
        if (contentEl && !document.getElementById('modal')) {
            contentEl.innerHTML = this.render();
            this.init();
        }
    },

    // Validiert Datei: muss Bild sein und unter MAX_SIZE_MB liegen
    _validatePhotoFile(file) {
        const MAX_SIZE_MB = 15;
        if (!file) return 'Keine Datei';
        if (!file.type || !file.type.startsWith('image/')) {
            return `Datei ist kein Bild (${file.type || 'unbekannter Typ'})`;
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            return `Bild zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB · max ${MAX_SIZE_MB} MB)`;
        }
        return null; // OK
    },

    _resizeAndStagePhoto(id, file) {
        const err = this._validatePhotoFile(file);
        if (err) { Utils.showToast(err, 'warning'); return; }

        const reader = new FileReader();
        reader.onerror = () => Utils.showToast('Datei konnte nicht gelesen werden', 'error');
        reader.onload = e => {
            const img = new Image();
            img.onerror = () => Utils.showToast('Bild konnte nicht decodiert werden — andere Datei wählen', 'error');
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const MAX = 800;
                    let w = img.width, h = img.height;
                    if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
                    else if (h > MAX)     { w = Math.round(w * MAX / h); h = MAX; }
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    Lager._setPhoto(id, canvas.toDataURL('image/jpeg', 0.78));
                } catch (ex) {
                    Utils.showToast('Bild-Verarbeitung fehlgeschlagen: ' + ex.message, 'error');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    // Aktions-Buttons je Zeile — GoBD-bewusst (offen vs. festgeschrieben).
    // Annahme: NICHT-stornierte Artikel (storniert behandelt der Aufrufer via _stornoHint).
    _rowActions(p) {
        const locked = !Store.canEdit(p);
        const saleId = (this._saleByPid || {})[p.id];
        let b = '';
        if (p.status === 'verfuegbar') {
            b += `<button class="btn btn-small btn-success" data-sell="${p.id}" style="padding:3px 8px;font-size:11px;">Verkaufen</button>`;
        }
        if (saleId) {
            b += `<button class="action-btn action-btn-accent" data-edit-sale="${saleId}" aria-label="Verkauf bearbeiten / stornieren" title="Verkauf bearbeiten / stornieren"><i class="ti ti-receipt"></i></button>`;
        }
        if (locked) {
            b += `<span title="${Utils.escapeHtml(Store.lockReason(p) || 'Festgeschrieben')} — nicht mehr bearbeitbar" style="font-size:12px;opacity:.7;">🔒</span>`;
            b += `<button class="action-btn action-btn-danger" data-storno-lager="${p.id}" aria-label="Stornieren" title="Stornieren"><i class="ti ti-ban"></i></button>`;
        } else {
            b += `<button class="action-btn" data-status-modal="${p.id}" aria-label="Status ändern" title="Status ändern"><i class="ti ti-bolt"></i></button>`;
            b += `<button class="action-btn action-btn-accent" data-edit-lager="${p.id}" aria-label="Bearbeiten" title="Bearbeiten"><i class="ti ti-pencil"></i></button>`;
            b += `<button class="action-btn action-btn-danger" data-storno-lager="${p.id}" aria-label="Stornieren" title="Stornieren"><i class="ti ti-ban"></i></button>`;
            // Löschen nur, wenn KEIN aktiver Verkauf darauf verweist (sonst Verkauf zuerst behandeln)
            if (!saleId) b += `<button class="action-btn action-btn-danger" data-delete-lager="${p.id}" aria-label="Löschen (offene Periode)" title="Löschen (offene Periode)"><i class="ti ti-trash"></i></button>`;
        }
        return b;
    },

    // Kompakter Storno-Hinweis für stornierte Artikel (statt leerer Aktionszelle)
    _stornoHint(p) {
        const g = p.stornoGrund ? ' – ' + Utils.escapeHtml(p.stornoGrund) : '';
        return `<span style="font-size:10px;color:var(--text-muted);" title="${Utils.escapeHtml(p.stornoGrund || 'Storniert')}">🚫 storniert${g}</span>`;
    },

    // Verkauf direkt am Artikel bearbeiten / stornieren
    openSaleEditModal(saleId) {
        const s = Store.getSales(true).find(x => x.id === saleId);
        if (!s) { Utils.showToast('Verkauf nicht gefunden', 'warning'); return; }
        const locked = !Store.canEdit(s);
        const platforms = [...new Set([s.verkaufsplattform, ...Store.getPlatforms()].filter(Boolean))];
        const platOpts = platforms.filter(p => p !== 'Sonstiges')
            .map(p => `<option value="${Utils.escapeHtml(p)}" ${s.verkaufsplattform === p ? 'selected' : ''}>${Utils.escapeHtml(p)}</option>`).join('');
        const dis = locked ? 'disabled' : '';
        const body = `
            ${locked ? `<div style="background:rgba(245,158,11,.12);border:1px solid var(--warning,#f59e0b);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;">🔒 ${Utils.escapeHtml(Store.lockReason(s) || 'Festgeschrieben')} — nur Storno möglich.</div>` : ''}
            <div class="form-row">
                <div class="form-group"><label class="form-label">Datum</label><input type="date" class="form-input" id="se_datum" value="${s.datum || ''}" ${dis}></div>
                <div class="form-group"><label class="form-label">Plattform</label><select class="form-select" id="se_plattform" ${dis}>${platOpts}<option value="Sonstiges">Sonstiges …</option></select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Verkaufspreis (€)</label><input type="number" step="0.01" class="form-input" id="se_preis" value="${s.verkaufspreis || 0}" ${dis}></div>
                <div class="form-group"><label class="form-label">Versand Käufer (€)</label><input type="number" step="0.01" class="form-input" id="se_versandK" value="${s.versandkostenKaeufer || 0}" ${dis}></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Gebühr (%)</label><input type="number" step="0.01" class="form-input" id="se_gebuehr" value="${s.plattformgebuehrProzent || 0}" ${dis}></div>
                <div class="form-group"><label class="form-label">Versand Verkäufer (€)</label><input type="number" step="0.01" class="form-input" id="se_versandV" value="${s.versandkostenVerkaufer || 0}" ${dis}></div>
            </div>
            <div class="form-group"><label class="form-label">Käufer</label><input type="text" class="form-input" id="se_kaeufer" value="${Utils.escapeHtml(s.kaeufer || '')}" ${dis}></div>
            <div class="form-group"><label class="form-label">Notizen</label><textarea class="form-textarea" id="se_notizen" ${dis}>${Utils.escapeHtml(s.notizen || '')}</textarea></div>
        `;
        const footer = `
            <button class="btn" data-action="close-modal">Abbrechen</button>
            ${s.storniert ? '' : `<button class="btn btn-danger" id="se_storno">Stornieren</button>`}
            ${locked ? '' : `<button class="btn btn-primary" id="se_save">Speichern</button>`}
        `;
        App.showModal('Verkauf bearbeiten', body, footer);

        const refresh = () => { const c = document.getElementById('content'); if (c) { c.innerHTML = this.render(); this.init(); } };

        const stornoBtn = document.getElementById('se_storno');
        if (stornoBtn) stornoBtn.addEventListener('click', () => {
            const grund = prompt('Stornogrund angeben (Pflicht für Revisionssicherheit):');
            if (!grund) return;
            Store.stornoSale(s.id, grund);
            App.closeModal();
            Utils.showToast('Verkauf storniert', 'success');
            refresh();
        });

        const saveBtn = document.getElementById('se_save');
        if (saveBtn) saveBtn.addEventListener('click', () => {
            let plat = (document.getElementById('se_plattform') || {}).value || s.verkaufsplattform;
            if (plat && plat !== 'Sonstiges') Store.addPlatform(plat);
            Store.saveSale({
                ...s,
                datum: Utils.getDateInputValue('se_datum'),
                verkaufsplattform: plat,
                verkaufspreis: parseFloat(document.getElementById('se_preis').value) || 0,
                versandkostenKaeufer: parseFloat(document.getElementById('se_versandK').value) || 0,
                plattformgebuehrProzent: parseFloat(document.getElementById('se_gebuehr').value) || 0,
                versandkostenVerkaufer: parseFloat(document.getElementById('se_versandV').value) || 0,
                kaeufer: document.getElementById('se_kaeufer').value.trim(),
                notizen: document.getElementById('se_notizen').value.trim()
            });
            App.closeModal();
            Utils.showToast('Verkauf aktualisiert', 'success');
            refresh();
        });
    },

    render() {
        try {
            this._loadPrefs();
            const allPurchases  = Store.getPurchases(true);
            const purchases     = Store.getPurchases();
            const totalCount    = purchases.reduce((s, p) => s + (parseInt(p.anzahl) || 1), 0);
            const totalValue    = purchases.reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0);
            const soldCount     = purchases.filter(p => p.status === 'verkauft').reduce((s, p) => s + (parseInt(p.anzahl) || 1), 0);
            const availCount    = purchases.filter(p => p.status === 'verfuegbar').reduce((s, p) => s + (parseInt(p.anzahl) || 1), 0);
            const availValue    = purchases.filter(p => p.status === 'verfuegbar').reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0);
            const serviceCount  = purchases.filter(p => ['beschadigt','reinigung','reparatur'].includes(p.status)).reduce((s, p) => s + (parseInt(p.anzahl) || 1), 0);
            const avgEK         = availCount > 0 ? availValue / availCount : 0;
            const potentialRev  = availValue * 2;
            const umschlag      = totalCount > 0 ? Math.round(soldCount / totalCount * 100) : 0;

            const brands = [...new Set(allPurchases.map(p => p.marke).filter(Boolean))].sort();
            const years  = [...new Set(allPurchases.map(p => (p.datum||'').slice(0,4)).filter(Boolean))].sort().reverse();
            const f = this._filters;

            let filtered = [...allPurchases];
            if (!f.showStorniert) filtered = filtered.filter(p => !p.storniert);
            if (f.marke)         filtered = filtered.filter(p => p.marke === f.marke);
            if (f.artikeltyp)    filtered = filtered.filter(p => p.artikeltyp === f.artikeltyp);
            if (f.warenkategorie)filtered = filtered.filter(p => (p.warenkategorie || '') === f.warenkategorie);
            if (f.zielgruppe)    filtered = filtered.filter(p => (p.zielgruppe || '') === f.zielgruppe);
            if (f.haendler)      filtered = filtered.filter(p => (p.haendler || '') === f.haendler);
            if (f.status)        filtered = filtered.filter(p => p.status === f.status);
            if (f.filterJahr)    filtered = filtered.filter(p => (p.datum||'').startsWith(f.filterJahr));
            if (f.filterMonat)   filtered = filtered.filter(p => (p.datum||'').slice(5,7) === f.filterMonat);
            if (f.artikelNr && f.artikelNr.trim()) {
                const nrTerm = f.artikelNr.trim().toLowerCase();
                filtered = filtered.filter(p => (p.artikelNr||'').toLowerCase().includes(nrTerm));
            }
            // ── Filterzeile im Tabellenkopf (spaltenbezogen, kombinierbar mit der Leiste) ──
            if (f.von)  filtered = filtered.filter(p => (p.datum || '') >= f.von);
            if (f.bis)  filtered = filtered.filter(p => (p.datum || '') <= f.bis);
            if (f.artikel && f.artikel.trim()) {
                const t = f.artikel.trim().toLowerCase();
                filtered = filtered.filter(p =>
                    [p.marke, p.artikeltyp, p.beschreibung].some(v => v && String(v).toLowerCase().includes(t)));
            }
            if (f.groesse && f.groesse.trim()) {
                const t = f.groesse.trim().toLowerCase();
                filtered = filtered.filter(p => (p.groesse || '').toLowerCase().includes(t));
            }
            if (f.lagerort && f.lagerort.trim()) {
                const t = f.lagerort.trim().toLowerCase();
                filtered = filtered.filter(p => this._lagerortText(p).toLowerCase().includes(t));
            }
            if (f.search && f.search.trim()) {
                const term = f.search.trim().toLowerCase();
                filtered = filtered.filter(p =>
                    [p.marke, p.artikeltyp, p.beschreibung, p.artikelNr, p.groesse, p.einkaufsquelle,
                     ...(p.tags || [])]
                        .some(v => v && String(v).toLowerCase().includes(term))
                );
            }

            // Sort — Spaltenkopf schlägt das Dropdown, aber nur in der Tabellenansicht:
            // in der Kartenansicht gibt es keine Spaltenköpfe, dort bleibt das Dropdown maßgeblich.
            if (this._viewMode === 'table' && this._headSort.col) {
                filtered.sort(Utils.sortComparator(this._headSort, (p, col) => this._sortValue(p, col)));
            } else {
                const s = this._sortBy;
                if (s === 'oldest')     filtered.sort((a,b) => (a.datum||'').localeCompare(b.datum||''));
                else if (s === 'ek_desc') filtered.sort((a,b) => (parseFloat(b.einkaufspreis)||0) - (parseFloat(a.einkaufspreis)||0));
                else if (s === 'ek_asc')  filtered.sort((a,b) => (parseFloat(a.einkaufspreis)||0) - (parseFloat(b.einkaufspreis)||0));
                else if (s === 'marke')   filtered.sort((a,b) => (a.marke||'').localeCompare(b.marke||''));
                else if (s === 'artikelnr') filtered.sort((a,b) => (a.artikelNr||'').localeCompare(b.artikelNr||''));
                else                       filtered.sort((a,b) => (b.datum||'').localeCompare(a.datum||''));
            }

            // Session lookup
            const sessionMap = {};
            allPurchases.forEach(p => {
                if (p.sessionId) {
                    if (!sessionMap[p.sessionId]) sessionMap[p.sessionId] = { datum: p.datum, quelle: p.einkaufsquelle, count: 0 };
                    sessionMap[p.sessionId].count++;
                }
            });

            // Invoice lookup
            const invoiceMap = {};
            try {
                const invoices = Store.getRechInvoices ? Store.getRechInvoices() : [];
                invoices.forEach(inv => {
                    (inv.positionen || []).forEach(pos => {
                        if (pos.lagerArtikelId) {
                            if (!invoiceMap[pos.lagerArtikelId]) invoiceMap[pos.lagerArtikelId] = [];
                            invoiceMap[pos.lagerArtikelId].push(inv.nummer || inv.id.slice(0,8));
                        }
                    });
                });
            } catch(e) {}

            // Eigenbeleg lookup
            const ebMap = {};
            try {
                const _ebCo = localStorage.getItem('oyi_active_company') || '';
                const _ebKey = (_ebCo?_ebCo+'__':'')+'eigenbelege_belege';
                const belege = (typeof Store !== 'undefined' ? Store._syncReadRaw(_ebKey) : JSON.parse(localStorage.getItem(_ebKey) || '[]')) || [];
                belege.forEach(b => {
                    (b.warenPositionen || []).forEach(wp => {
                        if (wp.lagerArtikelId) {
                            ebMap[wp.lagerArtikelId] = (ebMap[wp.lagerArtikelId] || 0) + 1;
                        }
                    });
                });
            } catch(e) {}

            // Aktive (nicht stornierte) Verkäufe je Einkauf-ID → "Verkauf bearbeiten" am Artikel
            const saleByPid = {};
            try {
                Store.getSales(true).forEach(s => {
                    if (s.storniert) return;
                    const pids = s.purchaseIds ? s.purchaseIds : (s.purchaseId ? [s.purchaseId] : []);
                    pids.forEach(pid => { if (!saleByPid[pid]) saleByPid[pid] = s.id; });
                });
            } catch(e) {}
            this._saleByPid = saleByPid;

            const selectedCount = this._selected.size;

            const hasActiveFilters = !!(f.marke || f.artikeltyp || f.warenkategorie || f.zielgruppe || f.haendler || f.status || f.filterJahr || f.filterMonat || f.artikelNr || f.search || f.showStorniert);
            const filterBar = `
                <div class="card no-print" style="padding:14px 16px;margin-bottom:14px;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
                        <i class="ti ti-filter" style="color:var(--text-secondary);font-size:15px;"></i>
                        <span style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);">Filter &amp; Sortierung</span>
                        ${hasActiveFilters ? `<button class="btn btn-small" id="lagerFilterReset" title="Alle Filter zurücksetzen" style="margin-left:auto;font-size:11px;padding:3px 9px;gap:4px;display:flex;align-items:center;"><i class="ti ti-filter-off"></i> Zurücksetzen</button>` : ''}
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;">
                        <div class="filter-group" style="flex:1;min-width:200px;">
                            <label style="display:flex;align-items:center;gap:4px;"><i class="ti ti-search" style="font-size:13px;"></i> Suche</label>
                            <input type="text" class="form-input" id="lagerSearch"
                                   placeholder="Marke, Typ, Art.-Nr., Größe …"
                                   value="${Utils.escapeHtml(f.search || '')}"
                                   style="font-size:13px;">
                        </div>
                        <div class="filter-group">
                            <label style="display:flex;align-items:center;gap:4px;"><i class="ti ti-brand-abstract" style="font-size:13px;"></i> Marke</label>
                            <select class="form-select" id="lagerFilterMarke">
                                <option value="">Alle</option>
                                ${brands.map(b => `<option value="${Utils.escapeHtml(b)}" ${f.marke === b ? 'selected' : ''}>${Utils.escapeHtml(b)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label style="display:flex;align-items:center;gap:4px;"><i class="ti ti-tag" style="font-size:13px;"></i> Artikeltyp</label>
                            <select class="form-select" id="lagerFilterTyp">
                                <option value="">Alle</option>
                                ${['Jacke','Hose','Shirt','Hoodie','Schuhe','Accessoire','Sonstiges'].map(t => `<option value="${t}" ${f.artikeltyp === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label style="display:flex;align-items:center;gap:4px;"><i class="ti ti-category" style="font-size:13px;"></i> Kategorie</label>
                            <select class="form-select" id="lagerFilterKat">
                                <option value="">Alle</option>
                                ${Store.getWarenkategorien().map(k => `<option value="${Utils.escapeHtml(k)}" ${f.warenkategorie === k ? 'selected' : ''}>${Utils.escapeHtml(k)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label style="display:flex;align-items:center;gap:4px;"><i class="ti ti-gender-genderless" style="font-size:13px;"></i> Zielgruppe</label>
                            <select class="form-select" id="lagerFilterZielgruppe">
                                <option value="">Alle</option>
                                ${Store.ZIELGRUPPEN.map(z => `<option value="${z}" ${f.zielgruppe === z ? 'selected' : ''}>${z}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label style="display:flex;align-items:center;gap:4px;"><i class="ti ti-truck-delivery" style="font-size:13px;"></i> Händler</label>
                            <select class="form-select" id="lagerFilterHaendler">
                                <option value="">Alle</option>
                                ${Store.getHaendler().map(h => `<option value="${Utils.escapeHtml(h)}" ${f.haendler === h ? 'selected' : ''}>${Utils.escapeHtml(h)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label style="display:flex;align-items:center;gap:4px;"><i class="ti ti-hash" style="font-size:13px;"></i> Art.-Nr.</label>
                            <input type="text" class="form-input" id="lagerFilterArtikelnr"
                                   placeholder="z.B. 2026-042"
                                   value="${Utils.escapeHtml(f.artikelNr || '')}"
                                   style="font-size:13px;width:120px;">
                        </div>
                        <div class="filter-group">
                            <label style="display:flex;align-items:center;gap:4px;"><i class="ti ti-circle-dot" style="font-size:13px;"></i> Status</label>
                            <select class="form-select" id="lagerFilterStatus">
                                <option value="">Alle</option>
                                ${Object.entries(this.STATUS_CONFIG).map(([k,v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label style="display:flex;align-items:center;gap:4px;"><i class="ti ti-calendar" style="font-size:13px;"></i> Jahr</label>
                            <select class="form-select" id="lagerFilterJahr">
                                <option value="">Alle</option>
                                ${years.map(y => `<option value="${y}" ${f.filterJahr == y ? 'selected' : ''}>${y}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group">
                            <label style="display:flex;align-items:center;gap:4px;"><i class="ti ti-calendar-month" style="font-size:13px;"></i> Monat</label>
                            <select class="form-select" id="lagerFilterMonat">
                                <option value="">Alle</option>
                                ${['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'].map((m,i) =>
                                    `<option value="${String(i+1).padStart(2,'0')}" ${f.filterMonat === String(i+1).padStart(2,'0') ? 'selected' : ''}>${m}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="filter-group" style="align-self:flex-end;padding-bottom:2px;">
                            <label style="white-space:nowrap;cursor:pointer;display:flex;align-items:center;gap:5px;margin-bottom:6px;">
                                <input type="checkbox" id="lagerFilterStorniert" ${f.showStorniert ? 'checked' : ''}>
                                <span style="font-size:12px;">Stornierte</span>
                            </label>
                        </div>
                        <div class="filter-group" style="margin-left:auto;">
                            <label style="display:flex;align-items:center;gap:4px;"><i class="ti ti-arrows-sort" style="font-size:13px;"></i> Sortierung</label>
                            <select class="form-select" id="lagerSortBy">
                                ${this.SORT_OPTIONS.map(o => `<option value="${o.value}" ${this._sortBy === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                            </select>
                        </div>
                        <div class="filter-group" style="align-self:flex-end;">
                            <div style="display:flex;gap:6px;">
                                <button class="btn btn-small ${this._viewMode === 'table' ? 'btn-primary' : ''}" id="lagerViewTable" title="Tabellenansicht"><i class="ti ti-table"></i> Tabelle</button>
                                <button class="btn btn-small ${this._viewMode === 'grid' ? 'btn-primary' : ''}" id="lagerViewGrid" title="Kartenansicht"><i class="ti ti-layout-grid"></i> Karten</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const bulkBar = selectedCount > 0 ? `
                <div id="lagerBulkBar" style="position:sticky;top:0;z-index:100;background:var(--accent);color:#fff;padding:10px 16px;border-radius:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;box-shadow:0 4px 16px rgba(0,0,0,0.25);">
                    <span style="font-weight:600;">${selectedCount} Artikel ausgewählt</span>
                    <button class="btn btn-small" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);" id="lagerBulkStatus"><i class="ti ti-bolt"></i> Status ändern</button>
                    <button class="btn btn-small" style="background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);" id="lagerBulkVerkauf"><i class="ti ti-shopping-cart"></i> Paketverkauf</button>
                    <button class="btn btn-small" style="background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);" id="lagerBulkDeselect"><i class="ti ti-x"></i> Abbrechen</button>
                </div>
            ` : '';

            // Export-Cache: alle gefilterten (vor Pagination)
            this._lastAllFiltered = filtered;

            // ── Pagination ─────────────────────────────────────────────
            const filteredCount = filtered.length;
            // Wenn pageSize === Infinity (oder sehr groß) → alles auf einer Seite anzeigen
            const showAll       = this._pageSize >= 99999;
            const effectivePageSize = showAll ? filteredCount : this._pageSize;
            const totalPages    = Math.max(1, Math.ceil(filteredCount / Math.max(1, effectivePageSize)));
            if (this._currentPage > totalPages) this._currentPage = totalPages;
            if (this._currentPage < 1)          this._currentPage = 1;
            const startIdx = showAll ? 0 : (this._currentPage - 1) * this._pageSize;
            const pageItems = showAll ? filtered : filtered.slice(startIdx, startIdx + this._pageSize);

            // Buttons mit data-attributen statt IDs (damit oberer + unterer Bar BEIDE klickbar sind)
            const showPagination = filteredCount > 25; // Bar zeigen wenn >25, mit Größenwahl
            const paginationBar = showPagination ? `
                <div class="lager-pagination no-print" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;flex-wrap:wrap;gap:10px;">
                    <div style="font-size:12px;color:var(--text-secondary);">
                        ${showAll
                            ? `Zeige <strong>alle ${filteredCount}</strong> Artikel`
                            : `Zeige <strong>${startIdx + 1}</strong>–<strong>${Math.min(startIdx + this._pageSize, filteredCount)}</strong> von <strong>${filteredCount}</strong>`
                        }
                    </div>
                    <div style="display:flex;gap:4px;align-items:center;">
                        ${showAll ? '' : `
                            <button class="btn btn-small lager-page-btn" data-page-action="first" ${this._currentPage === 1 ? 'disabled' : ''} title="Erste Seite">«</button>
                            <button class="btn btn-small lager-page-btn" data-page-action="prev"  ${this._currentPage === 1 ? 'disabled' : ''} title="Zurück">‹</button>
                            <span style="padding:0 10px;font-size:12px;font-weight:600;white-space:nowrap;">${this._currentPage} / ${totalPages}</span>
                            <button class="btn btn-small lager-page-btn" data-page-action="next"  ${this._currentPage === totalPages ? 'disabled' : ''} title="Weiter">›</button>
                            <button class="btn btn-small lager-page-btn" data-page-action="last"  ${this._currentPage === totalPages ? 'disabled' : ''} title="Letzte Seite">»</button>
                        `}
                        <select class="form-select lager-page-size" style="font-size:12px;padding:3px 6px;margin-left:10px;">
                            <option value="25"    ${this._pageSize===25?'selected':''}>25 / Seite</option>
                            <option value="50"    ${this._pageSize===50?'selected':''}>50 / Seite</option>
                            <option value="100"   ${this._pageSize===100?'selected':''}>100 / Seite</option>
                            <option value="250"   ${this._pageSize===250?'selected':''}>250 / Seite</option>
                            <option value="500"   ${this._pageSize===500?'selected':''}>500 / Seite</option>
                            <option value="99999" ${this._pageSize>=99999?'selected':''}>🔍 Alle anzeigen</option>
                        </select>
                    </div>
                </div>
            ` : '';

            const content = this._viewMode === 'grid'
                ? this._renderGrid(pageItems, sessionMap, invoiceMap, ebMap)
                : this._renderTable(pageItems, sessionMap, invoiceMap, ebMap);

            if (this._activeTab === 'virtual') {
                return this._renderLayoutView();
            }

            return `
                <div class="page-header" style="margin-bottom:12px;">
                    <h2 style="margin:0;">Lager</h2>
                </div>

                <!-- Tab Switcher -->
                <div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid var(--border);">
                    <button id="tabReal" class="btn" style="border-radius:8px 8px 0 0;border-bottom:2px solid var(--accent);margin-bottom:-2px;background:var(--bg-card);font-weight:700;color:var(--accent);padding:8px 20px;font-size:13px;"><i class="ti ti-box"></i> Lager</button>
                    <button id="tabVirtual" class="btn" style="border-radius:8px 8px 0 0;border-bottom:2px solid transparent;margin-bottom:-2px;background:transparent;color:var(--text-secondary);padding:8px 20px;font-size:13px;">
                        <i class="ti ti-map-2"></i> Lager-Layout
                    </button>
                </div>

                <div class="stats-grid-primary" style="margin-bottom:10px;">
                    <div class="card stat-card info" style="padding:14px 16px;border-left:3px solid var(--info,#3b82f6);">
                        <div class="card-label" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:4px;"><i class="ti ti-box"></i> Verfügbar</div>
                        <div class="card-value" style="font-size:26px;font-weight:700;line-height:1;">${availCount}</div>
                        <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:4px;">EK ${Utils.formatCurrency(availValue)}</div>
                    </div>
                    <div class="card stat-card success" style="padding:14px 16px;border-left:3px solid var(--success,#22c55e);">
                        <div class="card-label" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:4px;"><i class="ti ti-building-warehouse"></i> Lagerwert</div>
                        <div class="card-value" style="font-size:26px;font-weight:700;line-height:1;">${Utils.formatCurrency(availValue)}</div>
                        <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:4px;">verfügbare Artikel</div>
                    </div>
                    <div class="card stat-card" style="padding:14px 16px;border-left:3px solid var(--accent);">
                        <div class="card-label" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:4px;"><i class="ti ti-stack"></i> Gesamt</div>
                        <div class="card-value" style="font-size:26px;font-weight:700;line-height:1;">${totalCount}</div>
                        <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:4px;">${Utils.formatCurrency(totalValue)}</div>
                    </div>
                    <div class="card stat-card warning" style="padding:14px 16px;border-left:3px solid var(--warning,#f59e0b);">
                        <div class="card-label" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:4px;"><i class="ti ti-tool"></i> Im Service</div>
                        <div class="card-value" style="font-size:26px;font-weight:700;line-height:1;">${serviceCount}</div>
                        <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:4px;">Reinigung / Reparatur</div>
                    </div>
                </div>
                <div class="stats-grid-secondary" style="margin-bottom:14px;">
                    <div class="card stat-card" style="padding:12px 14px;border-left:3px solid var(--text-muted);">
                        <div class="card-label" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:3px;"><i class="ti ti-shopping-cart"></i> Verkauft</div>
                        <div class="card-value" style="font-size:20px;font-weight:700;line-height:1;">${soldCount}</div>
                        <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:3px;">Artikel</div>
                    </div>
                    <div class="card stat-card info" style="padding:12px 14px;border-left:3px solid var(--info,#3b82f6);">
                        <div class="card-label" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:3px;"><i class="ti ti-refresh"></i> Umschlag</div>
                        <div class="card-value" style="font-size:20px;font-weight:700;line-height:1;">${umschlag}%</div>
                        <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:3px;">Verkauft / Gesamt</div>
                    </div>
                    <div class="card stat-card" style="padding:12px 14px;border-left:3px solid var(--text-muted);">
                        <div class="card-label" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:3px;"><i class="ti ti-tag"></i> Ø EK</div>
                        <div class="card-value" style="font-size:20px;font-weight:700;line-height:1;">${Utils.formatCurrency(avgEK)}</div>
                        <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:3px;">pro Artikel</div>
                    </div>
                    <div class="card stat-card success" style="padding:12px 14px;border-left:3px solid var(--success,#22c55e);">
                        <div class="card-label" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:3px;"><i class="ti ti-trending-up"></i> Pot. Umsatz</div>
                        <div class="card-value" style="font-size:20px;font-weight:700;line-height:1;">${Utils.formatCurrency(potentialRev)}</div>
                        <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:3px;">2× Lagerwert</div>
                    </div>
                </div>

                ${filterBar}
                ${bulkBar}
                ${paginationBar}
                ${content}
                ${paginationBar}
            `;
        } catch(err) {
            console.error('Lager.render error:', err);
            return `<div class="card" style="padding:20px;color:var(--danger);">⚠ Fehler beim Laden des Lagers: ${Utils.escapeHtml(err.message)}</div>`;
        }
    },

    _renderTable(filtered, sessionMap, invoiceMap, ebMap) {
        // Pre-compute zone lookup for quick-assign badges
        const layout = this._getLayout();
        const zoneByBereich = {};
        layout.zones.forEach(z => { if (z.bereich) zoneByBereich[z.bereich] = z; });
        const hasZones = layout.zones.length > 0;

        let rows = '';
        if (filtered.length === 0) {
            rows = '<tr><td colspan="9" class="table-empty" style="padding:30px;text-align:center;color:var(--text-secondary);">Keine Artikel</td></tr>';
        } else {
            rows = filtered.map(p => {
                const sess = p.sessionId ? sessionMap[p.sessionId] : null;
                const sessionBadge = sess
                    ? `<span class="badge badge-info" style="font-size:9px;padding:1px 5px;cursor:help;" title="Session: ${Utils.escapeHtml(sess.datum || '')} | ${sess.count} Artikel">Bulk</span>`
                    : '';

                const invNrs  = invoiceMap[p.id];
                const invBadge = invNrs ? `<span class="badge badge-success" style="font-size:9px;padding:1px 5px;" title="Rechnung(en): ${Utils.escapeHtml(invNrs.join(', '))}">🧾${invNrs.length}</span>` : '';
                const ebCount  = ebMap[p.id];
                const ebBadge  = ebCount ? `<span class="badge" style="font-size:9px;padding:1px 5px;background:rgba(124,58,237,0.12);color:var(--accent);" title="${ebCount} Eigenbeleg(e)">📋${ebCount}</span>` : '';

                const lo = p.lagerort;
                const lagerortStr = lo && (lo.bereich || lo.regal || lo.fach)
                    ? [lo.bereich, lo.regal, lo.fach].filter(Boolean).join('›')
                    : '';

                // Zone badge / quick-assign button
                const assignedZone = (lo && lo.bereich) ? zoneByBereich[lo.bereich] : null;
                const ZICONS = { regal:'🗄️', box:'📦', schrank:'🗃️', boden:'📐', sonstiges:'📍' };
                let zoneBadge = '';
                if (!p.storniert && hasZones) {
                    if (assignedZone) {
                        const zIcon = ZICONS[assignedZone.type] || '📍';
                        zoneBadge = `<div style="margin-top:2px;">
                            <button class="btn btn-small" data-zone-pick="${p.id}" title="Zone wechseln"
                                style="font-size:9px;padding:1px 5px;border-color:${assignedZone.color};color:${assignedZone.color};background:${assignedZone.color}15;white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis;">
                                ${zIcon} ${Utils.escapeHtml(assignedZone.name)}
                            </button></div>`;
                    } else if (p.status === 'verfuegbar') {
                        zoneBadge = `<div style="margin-top:2px;">
                            <button class="btn btn-small" data-zone-pick="${p.id}" title="Zone zuordnen"
                                style="font-size:9px;padding:1px 5px;opacity:.55;white-space:nowrap;">📍 Zone</button></div>`;
                    }
                }

                const photoCell = p.foto
                    ? `<img src="${p.foto}" style="width:34px;height:34px;object-fit:cover;border-radius:4px;cursor:pointer;vertical-align:middle;" data-photo-preview="${p.id}" title="Foto">`
                    : `<button class="btn btn-small" style="font-size:11px;padding:2px 5px;opacity:.6;" data-upload-photo="${p.id}" title="Foto hinzufügen">📷</button>`;

                const isSelected = this._selected.has(p.id);
                const titleParts = [p.marke, p.artikeltyp].filter(Boolean).join(' ');

                return `
                <tr${p.storniert ? ' class="row-storniert"' : ''}${isSelected ? ' style="background:rgba(99,102,241,.07);"' : ''}>
                    <td style="width:26px;text-align:center;padding:4px 2px;"><input type="checkbox" class="lager-select-cb" data-id="${p.id}" ${p.storniert ? 'disabled' : ''} ${isSelected ? 'checked' : ''}></td>
                    <td style="width:42px;text-align:center;padding:3px;">${photoCell}</td>
                    <td style="padding:3px 6px;line-height:1.25;white-space:nowrap;">
                        <div style="font-family:monospace;font-size:11px;">${Utils.escapeHtml(p.artikelNr || '—')}</div>
                        <div style="font-size:10px;color:var(--text-muted);">${Utils.formatDate(p.datum)}</div>
                    </td>
                    <td style="padding:3px 6px;line-height:1.25;min-width:160px;max-width:280px;">
                        <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${Utils.escapeHtml(titleParts)}">${Utils.escapeHtml(titleParts || '—')}</div>
                        ${p.beschreibung ? `<div style="font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${Utils.escapeHtml(p.beschreibung)}">${Utils.escapeHtml(p.beschreibung)}</div>` : ''}
                        ${p.tags && p.tags.length ? `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:3px;">${p.tags.map(t=>`<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--accent-glow);color:var(--accent);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);white-space:nowrap;">${Utils.escapeHtml(t)}</span>`).join('')}</div>` : ''}
                    </td>
                    <td style="padding:3px 6px;font-size:12px;white-space:nowrap;">${Utils.escapeHtml(p.groesse || '—')}</td>
                    <td style="padding:3px 6px;text-align:right;font-weight:700;font-size:13px;white-space:nowrap;cursor:pointer;"
                        data-inline-ek="${p.id}" data-ek-val="${p.einkaufspreis || 0}"
                        title="Doppelklick → EK direkt bearbeiten">${Utils.formatCurrency(p.einkaufspreis)}</td>
                    <td style="padding:3px 6px;line-height:1.25;min-width:90px;">
                        ${lagerortStr ? `<div style="font-size:10px;color:var(--text-secondary);white-space:nowrap;display:flex;align-items:center;gap:3px;"><i class="ti ti-map-pin" style="font-size:11px;"></i>${Utils.escapeHtml(lagerortStr)}</div>` : ''}
                        <div style="display:flex;gap:2px;flex-wrap:wrap;${lagerortStr ? 'margin-top:2px;' : ''}">${sessionBadge}${invBadge}${ebBadge}</div>
                        ${zoneBadge}
                    </td>
                    <td style="padding:3px 6px;">${this._statusBadge(p.status, p.storniert)}</td>
                    <td class="table-actions" style="padding:3px;white-space:nowrap;">
                        ${p.storniert ? this._stornoHint(p) : this._rowActions(p)}
                    </td>
                </tr>`;
            }).join('');
        }

        const f  = this._filters || {};
        const si = col => Utils.sortIcon(this._headSort, col);
        const esc = v => Utils.escapeHtml(v || '');
        // Status-Auswahl der Filterzeile aus derselben Quelle wie die Filterleiste, damit eigene
        // Status-Werte (Store.getLagerStatusListe) auch hier auftauchen.
        const statusOpts = Store.getLagerStatusListe().map(s =>
            `<option value="${esc(s.key)}"${f.status === s.key ? ' selected' : ''}>${esc(s.label || s.key)}</option>`).join('');
        // Kein Live-Filtern bei jedem Tastendruck (bewusste Entscheidung, s. Suchfeld weiter
        // unten): Textfelder greifen bei Enter bzw. beim Verlassen, Auswahl/Datum sofort.
        const inp = (id, val, ph, extra) =>
            `<input type="text" class="form-input lager-hf" id="${id}" value="${esc(val)}" placeholder="${ph}" ` +
            `style="width:100%;font-size:11px;padding:3px 6px;min-height:0;${extra || ''}">`;

        return `
            <div class="table-container">
                <table style="font-size:12px;">
                    <thead>
                        <tr>
                            <th style="width:26px;padding:5px 2px;"><input type="checkbox" id="lagerSelectAll" title="Alle"></th>
                            <th style="width:42px;padding:5px;"><i class="ti ti-camera" style="font-size:13px;"></i></th>
                            <th class="${si('artikelNr')}" data-sort="artikelNr" style="padding:5px 6px;text-align:left;" title="Nach Artikelnummer sortieren">Art.-Nr. / Datum</th>
                            <th class="${si('artikel')}" data-sort="artikel" style="padding:5px 6px;text-align:left;" title="Nach Artikel sortieren">Artikel / Beschreibung</th>
                            <th class="${si('groesse')}" data-sort="groesse" style="padding:5px 6px;text-align:left;" title="Nach Größe sortieren">Größe</th>
                            <th class="${si('einkaufspreis')}" data-sort="einkaufspreis" style="padding:5px 6px;text-align:right;" title="Nach EK sortieren">EK</th>
                            <th class="${si('lagerort')}" data-sort="lagerort" style="padding:5px 6px;text-align:left;" title="Nach Lagerort sortieren">Lager / Zone</th>
                            <th class="${si('status')}" data-sort="status" style="padding:5px 6px;text-align:left;" title="Nach Status sortieren">Status</th>
                            <th style="padding:5px 6px;text-align:left;">Aktionen</th>
                        </tr>
                        <tr class="lager-filter-row">
                            <th colspan="2" style="padding:3px 4px;text-align:center;">
                                <button class="btn btn-small" id="lagerHfReset" title="Spaltenfilter zurücksetzen"
                                        style="font-size:10px;padding:2px 6px;min-height:0;opacity:.7;">✕</button>
                            </th>
                            <th style="padding:3px 5px;min-width:130px;">
                                ${inp('lagerHfArtikelnr', f.artikelNr, 'Art.-Nr.')}
                                <div style="display:flex;gap:3px;margin-top:3px;">
                                    <input type="date" class="form-input" id="lagerHfVon" value="${esc(f.von)}" title="Kaufdatum von"
                                           style="width:50%;font-size:10px;padding:2px 4px;min-height:0;">
                                    <input type="date" class="form-input" id="lagerHfBis" value="${esc(f.bis)}" title="Kaufdatum bis"
                                           style="width:50%;font-size:10px;padding:2px 4px;min-height:0;">
                                </div>
                            </th>
                            <th style="padding:3px 5px;">${inp('lagerHfArtikel', f.artikel, 'Marke, Typ, Beschreibung…')}</th>
                            <th style="padding:3px 5px;min-width:60px;">${inp('lagerHfGroesse', f.groesse, 'Größe')}</th>
                            <th style="padding:3px 5px;"></th>
                            <th style="padding:3px 5px;min-width:90px;">${inp('lagerHfLagerort', f.lagerort, 'Ort / Regal')}</th>
                            <th style="padding:3px 5px;min-width:90px;">
                                <select class="form-select" id="lagerHfStatus" style="width:100%;font-size:11px;padding:3px 6px;min-height:0;">
                                    <option value="">Alle</option>${statusOpts}
                                </select>
                            </th>
                            <th style="padding:3px 5px;"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    _renderGrid(filtered, sessionMap, invoiceMap, ebMap) {
        if (filtered.length === 0) {
            return '<div style="text-align:center;padding:60px 20px;color:var(--text-secondary);">Keine Artikel im Lager</div>';
        }
        const cards = filtered.map(p => {
            const cfg = this.STATUS_CONFIG[p.status] || this.STATUS_CONFIG.verfuegbar;
            const isSelected = this._selected.has(p.id);
            const lo = p.lagerort;
            const lagerortStr = lo && (lo.bereich || lo.regal || lo.fach)
                ? [lo.bereich, lo.regal, lo.fach].filter(Boolean).join(' › ')
                : '';

            return `
            <div class="card" style="padding:0;overflow:hidden;border:2px solid ${isSelected ? 'var(--accent)' : 'transparent'};transition:border-color .15s;cursor:default;">
                <div style="position:relative;background:var(--bg-secondary);">
                    ${p.foto
                        ? `<img src="${p.foto}" style="width:100%;height:130px;object-fit:cover;display:block;">`
                        : `<div style="width:100%;height:70px;display:flex;align-items:center;justify-content:center;font-size:32px;color:var(--text-muted);">📦</div>`
                    }
                    ${p.storniert ? '' : `<div style="position:absolute;top:6px;left:6px;">
                        <input type="checkbox" class="lager-select-cb" data-id="${p.id}" ${isSelected ? 'checked' : ''} style="width:17px;height:17px;cursor:pointer;accent-color:var(--accent);">
                    </div>`}
                    <div style="position:absolute;top:6px;right:6px;">
                        ${this._statusBadge(p.status, p.storniert)}
                    </div>
                </div>
                <div style="padding:11px 12px;">
                    <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml((p.marke || '—') + ' ' + (p.artikeltyp || ''))}</div>
                    ${p.beschreibung ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${Utils.escapeHtml(p.beschreibung)}</div>` : ''}
                    ${p.tags && p.tags.length ? `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px;">${p.tags.map(t=>`<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--accent-glow);color:var(--accent);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);">${Utils.escapeHtml(t)}</span>`).join('')}</div>` : ''}
                    ${p.groesse ? `<div style="font-size:11px;color:var(--text-muted);">Gr. ${Utils.escapeHtml(p.groesse)}</div>` : ''}
                    ${lagerortStr ? `<div style="font-size:10px;color:var(--text-muted);margin-top:3px;">📍 ${Utils.escapeHtml(lagerortStr)}</div>` : ''}
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:9px;">
                        <span style="font-weight:700;font-size:15px;">${Utils.formatCurrency(p.einkaufspreis)}</span>
                        <span style="font-size:10px;color:var(--text-muted);">${Utils.formatDate(p.datum)}</span>
                    </div>
                    ${p.storniert
                        ? `<div style="margin-top:9px;">${this._stornoHint(p)}</div>`
                        : `<div style="display:flex;gap:5px;margin-top:9px;flex-wrap:wrap;align-items:center;">
                            ${this._rowActions(p)}
                            ${p.foto
                                ? `<button class="action-btn" data-photo-preview="${p.id}" aria-label="Foto ansehen" title="Foto ansehen"><i class="ti ti-photo"></i></button>`
                                : `<button class="action-btn" data-upload-photo="${p.id}" aria-label="Foto hinzufügen" title="Foto hinzufügen"><i class="ti ti-camera"></i></button>`
                            }
                        </div>`}
                </div>
            </div>`;
        }).join('');

        return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;">${cards}</div>`;
    },

    _openStatusModal(id) {
        const p = Store.getPurchases(true).find(x => x.id === id);
        if (!p) return;
        const body = `
            <p style="margin-bottom:14px;color:var(--text-secondary);font-size:13px;">Aktuell: ${this._statusBadge(p.status, false)}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                ${Object.entries(this.STATUS_CONFIG).map(([k,v]) => `
                    <button class="btn" style="justify-content:flex-start;gap:8px;padding:10px 14px;border:1px solid ${v.color};${p.status===k ? `background:${v.bg};color:${v.color};font-weight:600;` : ''}"
                        data-set-status="${k}" data-status-id="${id}">
                        <span style="font-size:15px;">${v.icon}</span> ${v.label}
                    </button>
                `).join('')}
            </div>
        `;
        App.showModal('Status ändern', body, '<button class="btn" data-action="close-modal">Schließen</button>');

        document.querySelectorAll('[data-set-status]').forEach(btn => {
            btn.addEventListener('click', () => {
                const newStatus = btn.dataset.setStatus;
                const pid = btn.dataset.statusId;
                const purchase = Store.getPurchases(true).find(x => x.id === pid);
                if (purchase) {
                    purchase.status = newStatus;
                    Store.savePurchase(purchase);
                    Utils.showToast('Status: ' + this.STATUS_CONFIG[newStatus].label, 'success');
                }
                App.closeModal();
                const contentEl = document.getElementById('content');
                contentEl.innerHTML = this.render();
                this.init();
            });
        });
    },

    startBulkVerkauf() {
        const ids = [...this._selected];
        if (!ids.length) { Utils.showToast('Bitte zuerst Artikel auswählen', 'warning'); return; }
        // Standalone Lager-Seite: in den Buchungen-Tab wechseln
        if (window.LagerPage && window.LagerPage.switchToBuchungen) {
            this._selected.clear();
            window.LagerPage.switchToBuchungen(ids);
        } else {
            this.openVerkaufModal(ids);
        }
    },

    _bulkSetStatus(newStatus) {
        const ids = [...this._selected];
        const cfg = this.STATUS_CONFIG[newStatus];
        ids.forEach(id => {
            const p = Store.getPurchases(true).find(x => x.id === id);
            if (p && !p.storniert) {
                p.status = newStatus;
                Store.savePurchase(p);
            }
        });
        Utils.showToast(`${ids.length} Artikel → ${cfg ? cfg.label : newStatus}`, 'success');
        this._selected.clear();
        const contentEl = document.getElementById('content');
        contentEl.innerHTML = this.render();
        this.init();
    },

    // ── Export ────────────────────────────────────────────────────────────────
    openExportModal() {
        const count = this._lastAllFiltered.length;
        const body = `
        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:20px;">
            ${count} Artikel werden exportiert (aktuelle Filterung)
        </p>
        <div style="display:flex;flex-direction:column;gap:10px;">
            <button class="btn btn-primary" style="padding:12px 20px;font-size:14px;justify-content:flex-start;gap:12px;"
                    data-action="lg-export-xlsx">
                <span style="font-size:20px;">📊</span>
                <div style="text-align:left;">
                    <div style="font-weight:700;">Excel exportieren (.xlsx)</div>
                    <div style="font-size:12px;font-weight:400;opacity:.8;">Öffnet direkt in Excel / LibreOffice</div>
                </div>
            </button>
            <button class="btn btn-outline" style="padding:12px 20px;font-size:14px;justify-content:flex-start;gap:12px;"
                    data-action="lg-export-csv">
                <span style="font-size:20px;">📄</span>
                <div style="text-align:left;">
                    <div style="font-weight:700;">CSV exportieren (.csv)</div>
                    <div style="font-size:12px;font-weight:400;opacity:.8;">Universalformat, Semikolon-getrennt, UTF-8</div>
                </div>
            </button>
        </div>`;
        App.showModal('📥 Lager exportieren', body, '');
    },

    exportXLSX() {
        if (typeof UserPlan !== 'undefined' && !UserPlan.requirePro('Excel-Export')) return;
        // Bibliothek wird nicht mehr eager geladen (s. Utils.ensureXlsx) — hier nachziehen
        // statt abzubrechen; der alte Zweig meldete nur "XLSX-Library nicht geladen".
        Utils.ensureXlsx().then(() => this._exportXLSX())
            .catch(err => Utils.showToast(err.message, 'error'));
    },

    _exportXLSX() {
        const data = (this._lastAllFiltered.length ? this._lastAllFiltered : Store.getPurchases()).map(p => {
            const lo = p.lagerort;
            const lagerortStr = lo && (lo.bereich || lo.regal || lo.fach)
                ? [lo.bereich, lo.regal, lo.fach].filter(Boolean).join(' > ')
                : '';
            return {
                'Art.-Nr.':    p.artikelNr    || '',
                'Datum':       p.datum        || '',
                'Marke':       p.marke        || '',
                'Artikeltyp':  p.artikeltyp   || '',
                'Beschreibung':p.beschreibung || '',
                'Größe':       p.groesse      || '',
                'EK (€)':      parseFloat(p.einkaufspreis) || 0,
                'Status':      (this.STATUS_CONFIG[p.status] || {}).label || p.status || '',
                'Lagerort':    lagerortStr,
                'Quelle':      p.einkaufsquelle || '',
                'Notizen':     p.notizen || ''
            };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
            {wch:14},{wch:12},{wch:16},{wch:14},{wch:26},{wch:8},
            {wch:10},{wch:14},{wch:18},{wch:16},{wch:22}
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Lager');
        XLSX.writeFile(wb, `Lager_Export_${new Date().toLocaleDateString('sv-SE')}.xlsx`);
        Utils.showToast('📥 Excel exportiert', 'success');
    },

    exportCSV() {
        const headers = ['Art.-Nr.','Datum','Marke','Artikeltyp','Beschreibung','Größe','EK (€)','Status','Lagerort','Quelle','Notizen'];
        const rows = (this._lastAllFiltered.length ? this._lastAllFiltered : Store.getPurchases()).map(p => {
            const lo = p.lagerort;
            const lagerortStr = lo && (lo.bereich || lo.regal || lo.fach)
                ? [lo.bereich, lo.regal, lo.fach].filter(Boolean).join(' > ')
                : '';
            return [
                p.artikelNr    || '',
                p.datum        || '',
                p.marke        || '',
                p.artikeltyp   || '',
                p.beschreibung || '',
                p.groesse      || '',
                (parseFloat(p.einkaufspreis) || 0).toFixed(2).replace('.', ','),
                (this.STATUS_CONFIG[p.status] || {}).label || p.status || '',
                lagerortStr,
                p.einkaufsquelle || '',
                p.notizen || ''
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
        });
        const csv = '﻿' + [headers.map(h => `"${h}"`).join(';'), ...rows].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `Lager_Export_${new Date().toLocaleDateString('sv-SE')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        Utils.showToast('📥 CSV exportiert', 'success');
    },

    // ── Lager-Layout (Raumlayout-Editor) ────────────────────────────────────

    _renderLayoutView() {
        const layout        = this._getLayout();
        const availPurchases = Store.getPurchases(true).filter(p => !p.storniert && p.status === 'verfuegbar');

        // Count items & value per zone
        const zoneStats = {};
        layout.zones.forEach(z => { zoneStats[z.id] = { count: 0, value: 0 }; });
        const assignedIds = new Set();
        availPurchases.forEach(p => {
            if (!p.lagerort || !p.lagerort.bereich) return;
            const zone = layout.zones.find(z => z.bereich && z.bereich === p.lagerort.bereich);
            if (zone) {
                zoneStats[zone.id].count++;
                zoneStats[zone.id].value += (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
                assignedIds.add(p.id);
            }
        });
        const unassignedCount = availPurchases.length - assignedIds.size;

        return `
            <div class="page-header" style="margin-bottom:12px;"><h2 style="margin:0;">Lager</h2></div>

            <!-- Tab Switcher -->
            <div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid var(--border);">
                <button id="tabReal" class="btn" style="border-radius:8px 8px 0 0;border-bottom:2px solid transparent;margin-bottom:-2px;background:transparent;color:var(--text-secondary);padding:8px 20px;font-size:13px;">📦 Lager</button>
                <button id="tabVirtual" class="btn" style="border-radius:8px 8px 0 0;border-bottom:2px solid var(--accent);margin-bottom:-2px;background:var(--bg-card);font-weight:700;color:var(--accent);padding:8px 20px;font-size:13px;">🗺️ Lager-Layout</button>
            </div>

            <!-- Controls -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
                <div style="font-size:13px;color:var(--text-secondary);">
                    <strong style="color:var(--text-primary);">${layout.zones.length}</strong> Zonen ·
                    Gitter: ${layout.gridCols} × ${layout.gridRows}
                    ${unassignedCount > 0 ? `· <span style="color:var(--warning);">⚠️ ${unassignedCount} nicht zugeordnet</span>` : (layout.zones.length > 0 ? ' · <span style="color:var(--success);">✓ alles zugeordnet</span>' : '')}
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    ${this._layoutEditMode ? `
                        <button class="btn btn-small" id="layoutConfigGrid">⚙️ Gitter</button>
                        <button class="btn btn-small btn-primary" id="layoutAddZone">+ Zone hinzufügen</button>
                        <button class="btn btn-small btn-success" id="layoutEditToggle">✓ Fertig</button>
                    ` : `
                        <button class="btn btn-small" id="layoutEditToggle">✏️ Layout bearbeiten</button>
                    `}
                </div>
            </div>

            ${layout.zones.length === 0 && !this._layoutEditMode ? `
                <div style="text-align:center;padding:80px 20px;background:var(--bg-secondary);border-radius:12px;border:2px dashed var(--border);">
                    <div style="font-size:56px;margin-bottom:14px;">🗺️</div>
                    <div style="font-size:16px;font-weight:700;margin-bottom:8px;">Noch kein Lager-Layout definiert</div>
                    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px;max-width:400px;margin-left:auto;margin-right:auto;">
                        Baue deinen echten Lagerraum nach — füge Regale, Boxen und Schränke als Zonen hinzu. Artikel ordnen sich automatisch zu.
                    </div>
                    <button class="btn btn-primary" id="layoutEditStart" style="padding:10px 24px;">✏️ Layout jetzt aufbauen</button>
                </div>
            ` : this._renderLayoutGrid(layout, zoneStats)}

            ${unassignedCount > 0 && layout.zones.length > 0 ? `
                <div style="margin-top:14px;padding:10px 16px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:13px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <span style="font-size:18px;">⚠️</span>
                    <div style="flex:1;"><strong>${unassignedCount} verfügbare Artikel</strong> sind keiner Zone zugeordnet.
                    <span style="color:var(--text-muted);">Bearbeite den Artikel → Lagerort → Bereich.</span></div>
                    <button class="btn btn-small btn-warning" id="showUnassigned">Anzeigen</button>
                </div>
            ` : ''}

            <div style="margin-top:14px;padding:10px 14px;background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.15);border-radius:8px;font-size:12px;color:var(--text-secondary);">
                💡 <strong>Tipp:</strong> Im Lager-Tab siehst du bei jedem Artikel einen <em>📍 Zone</em>-Button — damit kannst du Artikel direkt einer Zone zuordnen. Alternativ: Klicke eine Zone → "Artikel zuordnen".
            </div>
        `;
    },

    _renderLayoutGrid(layout, zoneStats) {
        const { gridCols, gridRows, zones } = layout;

        // Map which cells are occupied (to render empty cells in edit mode)
        const cellOcc = {};
        zones.forEach(z => {
            for (let r = 0; r < (z.rowSpan || 1); r++) {
                for (let c = 0; c < (z.colSpan || 1); c++) {
                    cellOcc[`${(z.col||1)+c},${(z.row||1)+r}`] = z.id;
                }
            }
        });

        const ICONS = { regal:'🗄️', box:'📦', schrank:'🗃️', boden:'📐', sonstiges:'📍' };

        // Darken a hex color for the 3D depth side panel
        const hexDarken = (hex, amt = 50) => {
            const n = parseInt((hex||'#10b981').replace('#',''), 16);
            const r = Math.max(0, (n >> 16) - amt);
            const g = Math.max(0, ((n >> 8) & 0xff) - amt);
            const b = Math.max(0, (n & 0xff) - amt);
            return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
        };

        // Type-specific interior decoration (shelf lines, door panels, etc.)
        const typeDecoration = (type, color) => {
            switch (type) {
                case 'regal':
                    return [1,2,3].map(() =>
                        `<div style="height:1px;background:${color}50;margin:0 2px;border-radius:1px;flex-shrink:0;"></div>`
                    ).join('');
                case 'box':
                    return `<div style="flex:1;border:1px dashed ${color}55;border-radius:3px;position:relative;min-height:6px;">
                        <div style="position:absolute;top:-1px;right:-1px;width:7px;height:7px;border-top:2px solid ${color}90;border-right:2px solid ${color}90;border-radius:0 3px 0 0;"></div>
                        <div style="position:absolute;bottom:-1px;left:-1px;width:7px;height:7px;border-bottom:2px solid ${color}90;border-left:2px solid ${color}90;border-radius:0 0 0 3px;"></div>
                    </div>`;
                case 'schrank':
                    return `<div style="flex:1;display:flex;gap:2px;min-height:6px;">
                        <div style="flex:1;background:${color}12;border:1px solid ${color}30;border-radius:2px;"></div>
                        <div style="flex:1;background:${color}12;border:1px solid ${color}30;border-radius:2px;"></div>
                    </div>`;
                case 'boden':
                    return `<div style="flex:1;min-height:6px;background-image:radial-gradient(${color}55 1.2px,transparent 1.2px);background-size:7px 7px;border-radius:2px;"></div>`;
                default:
                    return `<div style="flex:1;min-height:4px;"></div>`;
            }
        };

        // Render zones with 3D depth effect
        const zonesHTML = zones.map(z => {
            const stats       = zoneStats[z.id] || { count: 0, value: 0 };
            const icon        = ICONS[z.type] || '📍';
            const safeCol     = Math.max(1, Math.min(z.col     || 1, gridCols));
            const safeRow     = Math.max(1, Math.min(z.row     || 1, gridRows));
            const safeColSpan = Math.max(1, Math.min(z.colSpan || 1, gridCols - safeCol + 1));
            const safeRowSpan = Math.max(1, Math.min(z.rowSpan || 1, gridRows - safeRow + 1));
            const darkColor   = hexDarken(z.color, 55);
            const midColor    = hexDarken(z.color, 25);

            // In edit mode: whole card = edit target; in view mode: whole card = items target
            const cardAttr = this._layoutEditMode
                ? `data-zone-edit="${z.id}"`
                : `data-zone-click="${z.id}"`;
            const editBadge = this._layoutEditMode
                ? `<div style="font-size:9px;color:rgba(255,255,255,0.45);margin-top:3px;letter-spacing:.5px;">✏️ Klicken zum Bearbeiten</div>`
                : '';

            return `
            <div style="
                grid-column:${safeCol}/span ${safeColSpan};
                grid-row:${safeRow}/span ${safeRowSpan};
                position:relative;
                padding:0 0 7px 0;
                cursor:pointer;
            " class="lg-zone3d" ${cardAttr}>
                <!-- 3D depth layers (back → front) -->
                <div style="position:absolute;inset:7px 0 0 7px;background:${darkColor};border-radius:9px;opacity:.9;pointer-events:none;"></div>
                <div style="position:absolute;inset:4px 3px 3px 4px;background:${midColor};border-radius:10px;opacity:.7;pointer-events:none;"></div>
                <!-- Main face -->
                <div class="zf" style="
                    position:relative;z-index:2;
                    background:linear-gradient(145deg,${z.color}28 0%,${z.color}10 100%);
                    border:1.5px solid ${this._layoutEditMode ? z.color+'aa' : z.color+'cc'};
                    border-radius:10px;
                    padding:9px 10px 8px;
                    display:flex;flex-direction:column;gap:3px;
                    height:calc(100% - 7px);
                    min-height:70px;
                    transition:transform .12s,box-shadow .12s;
                    box-shadow:inset 0 1px 0 ${z.color}40, 0 3px 10px rgba(0,0,0,0.35);
                    ${this._layoutEditMode ? 'outline:1.5px dashed rgba(255,255,255,0.12);outline-offset:-3px;' : ''}
                ">
                    <!-- Header: icon + name -->
                    <div style="display:flex;align-items:center;gap:5px;min-width:0;">
                        <span style="font-size:16px;line-height:1;flex-shrink:0;">${icon}</span>
                        <span style="font-weight:700;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.6);">${Utils.escapeHtml(z.name)}</span>
                    </div>
                    <!-- Type decoration -->
                    ${typeDecoration(z.type, z.color)}
                    <!-- Footer: bereich + count + edit hint -->
                    <div style="margin-top:2px;">
                        ${z.bereich
                            ? `<div style="font-size:9px;color:rgba(255,255,255,0.55);letter-spacing:.5px;">BEREICH <strong style="color:${z.color};font-size:10px;">${Utils.escapeHtml(z.bereich)}</strong></div>`
                            : `<div style="font-size:9px;color:#f59e0b;">⚠ kein Bereich</div>`}
                        <div style="font-size:12px;font-weight:700;color:${z.color};line-height:1.2;margin-top:1px;">${stats.count} Artikel${stats.value > 0 ? `<span style="font-size:9px;font-weight:400;color:rgba(255,255,255,0.45);margin-left:4px;">${Utils.formatCurrency(stats.value)}</span>` : ''}</div>
                        ${editBadge}
                    </div>
                </div>
            </div>`;
        }).join('');

        // Empty cells (only in edit mode)
        let emptyCells = '';
        if (this._layoutEditMode) {
            for (let r = 1; r <= gridRows; r++) {
                for (let c = 1; c <= gridCols; c++) {
                    if (!cellOcc[`${c},${r}`]) {
                        emptyCells += `
                        <div style="
                            grid-column:${c};grid-row:${r};
                            border:1.5px dashed rgba(255,255,255,0.12);border-radius:9px;
                            display:flex;align-items:center;justify-content:center;
                            min-height:70px;cursor:pointer;color:rgba(255,255,255,0.2);
                            font-size:24px;transition:all .15s;
                        " class="lg-cell-add" data-cell-add="${c},${r}">+</div>`;
                    }
                }
            }
        }

        // Room labels (column A, B, C... / row 1, 2, 3...)
        const colLabels = Array.from({length: gridCols}, (_,i) =>
            `<div style="text-align:center;font-size:9px;color:rgba(255,255,255,0.2);font-family:monospace;letter-spacing:1px;padding:2px 0;">${String.fromCharCode(65+i)}</div>`
        ).join('');

        return `
        <div style="
            background:linear-gradient(160deg,#0d1117 0%,#161b22 60%,#1c2128 100%);
            border-radius:16px;
            border:1px solid rgba(255,255,255,0.07);
            box-shadow:0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05);
            overflow:hidden;
        ">
            <!-- Room header label -->
            <div style="padding:8px 20px 0;display:flex;align-items:center;gap:8px;">
                <span style="font-size:10px;color:rgba(255,255,255,0.18);font-family:monospace;letter-spacing:2px;text-transform:uppercase;">LAGERRAUM</span>
                <div style="flex:1;height:1px;background:rgba(255,255,255,0.05);"></div>
                <span style="font-size:10px;color:rgba(255,255,255,0.12);">${gridCols}×${gridRows}</span>
            </div>
            <!-- Column labels -->
            <div style="display:grid;grid-template-columns:repeat(${gridCols},1fr);gap:10px;padding:4px 20px 0;">${colLabels}</div>
            <!-- Main grid -->
            <div style="
                display:grid;
                grid-template-columns:repeat(${gridCols},1fr);
                grid-template-rows:repeat(${gridRows},minmax(${this._layoutEditMode ? 85 : 100}px,auto));
                gap:10px;
                padding:6px 20px 20px;
            ">
                ${zonesHTML}
                ${emptyCells}
            </div>
        </div>`;
    },

    _openZoneModal(zone) {
        const layout = this._getLayout();
        const isEdit = !!zone;
        const z = zone || {
            col: 1, row: 1, colSpan: 1, rowSpan: 1,
            type: 'regal',
            color: this.ZONE_COLORS[layout.zones.length % this.ZONE_COLORS.length],
            bereich: '', name: ''
        };

        const swatches = this.ZONE_COLORS.map(c =>
            `<div data-swatch="${c}" data-action="lg-pick-swatch"
            style="width:22px;height:22px;border-radius:50%;background:${c};cursor:pointer;flex-shrink:0;
                   outline:${z.color===c?'3px solid '+c:'none'};outline-offset:${z.color===c?'2px':'0'};">
            </div>`
        ).join('');

        const typeOpts = Object.entries(this.ZONE_TYPES)
            .map(([k,v]) => `<option value="${k}" ${z.type===k?'selected':''}>${v.icon} ${v.label}</option>`).join('');

        const body = `
            <div class="form-row">
                <div class="form-group" style="flex:2;">
                    <label class="form-label">Name der Zone *</label>
                    <input type="text" class="form-input" id="zm_name" value="${Utils.escapeHtml(z.name||'')}" placeholder="z.B. Regal A, Karton 1, Schrank …">
                </div>
                <div class="form-group">
                    <label class="form-label">Typ</label>
                    <select class="form-select" id="zm_type">${typeOpts}</select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Bereich-Code <span style="color:var(--text-muted);font-weight:400;font-size:11px;">— muss mit Lagerort → Bereich übereinstimmen</span></label>
                <input type="text" class="form-input" id="zm_bereich" value="${Utils.escapeHtml(z.bereich||'')}" placeholder="z.B. A, R1, BOX-1 (frei wählbar)">
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
                ${[['zm_col','Spalte',z.col||1,1,layout.gridCols],['zm_row','Reihe',z.row||1,1,layout.gridRows],
                   ['zm_colspan','Breite',z.colSpan||1,1,layout.gridCols],['zm_rowspan','Höhe',z.rowSpan||1,1,layout.gridRows]]
                  .map(([id,lbl,val,mn,mx]) => `
                    <div class="form-group" style="margin:0;">
                        <label class="form-label" style="font-size:11px;">${lbl}</label>
                        <input type="number" min="${mn}" max="${mx}" class="form-input" id="${id}" value="${val}" style="padding:6px 8px;">
                    </div>`).join('')}
            </div>
            <div class="form-group">
                <label class="form-label">Farbe</label>
                <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                    ${swatches}
                    <input type="color" id="zm_color" value="${z.color||this.ZONE_COLORS[0]}"
                           style="width:30px;height:30px;border:none;background:none;cursor:pointer;border-radius:4px;padding:0;" title="Eigene Farbe">
                </div>
            </div>
        `;

        const footer = `
            ${isEdit ? `<button class="btn btn-danger" id="zmDelete" style="margin-right:auto;">🗑 Löschen</button>` : ''}
            <button class="btn" data-action="close-modal">Abbrechen</button>
            <button class="btn btn-primary" id="zmSave">${isEdit ? 'Speichern' : '+ Hinzufügen'}</button>
        `;
        App.showModal(isEdit ? `Zone: ${Utils.escapeHtml(z.name||'?')}` : '+ Zone hinzufügen', body, footer);

        const save = () => {
            const name = document.getElementById('zm_name').value.trim();
            if (!name) { Utils.showToast('Bitte einen Namen angeben', 'warning'); return; }
            const newZ = {
                id:       isEdit ? z.id : this._genZId(),
                name,
                type:     document.getElementById('zm_type').value,
                bereich:  document.getElementById('zm_bereich').value.trim(),
                col:      Math.max(1, parseInt(document.getElementById('zm_col').value)     || 1),
                row:      Math.max(1, parseInt(document.getElementById('zm_row').value)     || 1),
                colSpan:  Math.max(1, parseInt(document.getElementById('zm_colspan').value) || 1),
                rowSpan:  Math.max(1, parseInt(document.getElementById('zm_rowspan').value) || 1),
                color:    document.getElementById('zm_color').value || this.ZONE_COLORS[0]
            };
            if (isEdit) {
                const idx = layout.zones.findIndex(x => x.id === z.id);
                if (idx >= 0) layout.zones[idx] = newZ; else layout.zones.push(newZ);
            } else {
                layout.zones.push(newZ);
            }
            this._saveLayout(layout);
            App.closeModal();
            Utils.showToast(isEdit ? 'Zone gespeichert' : 'Zone hinzugefügt', 'success');
            const contentEl = document.getElementById('content');
            contentEl.innerHTML = this.render();
            this.init();
        };
        document.getElementById('zmSave').addEventListener('click', save);

        if (isEdit) {
            document.getElementById('zmDelete').addEventListener('click', () => {
                if (!confirm(`Zone "${z.name}" löschen?`)) return;
                layout.zones = layout.zones.filter(x => x.id !== z.id);
                this._saveLayout(layout);
                App.closeModal();
                Utils.showToast('Zone gelöscht', 'info');
                const contentEl = document.getElementById('content');
                contentEl.innerHTML = this.render();
                this.init();
            });
        }
    },

    _openZoneItemsModal(zoneId) {
        const layout = this._getLayout();
        const zone   = layout.zones.find(z => z.id === zoneId);
        if (!zone) return;
        const icon = (this.ZONE_TYPES[zone.type] || { icon: '📍' }).icon;

        if (!zone.bereich) {
            App.showModal(`${icon} ${Utils.escapeHtml(zone.name)}`,
                `<div style="text-align:center;padding:30px;color:var(--text-secondary);">
                    <div style="font-size:36px;margin-bottom:10px;">⚙️</div>
                    <div>Kein Bereich-Code gesetzt — bearbeite die Zone um Artikel zuzuordnen.</div>
                </div>`,
                `<button class="btn btn-primary" data-action="lg-zone-edit" data-args='["${zone.id}"]'>✏️ Zone bearbeiten</button>
                 <button class="btn" data-action="close-modal">Schließen</button>`
            );
            return;
        }

        const items = Store.getPurchases(true).filter(p =>
            !p.storniert && p.status === 'verfuegbar' &&
            p.lagerort && p.lagerort.bereich === zone.bereich
        );
        const totalVal = items.reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0);

        const rows = items.length === 0
            ? `<tr><td colspan="5" class="table-empty" style="padding:20px;">Keine verfügbaren Artikel mit Bereich "${Utils.escapeHtml(zone.bereich)}"</td></tr>`
            : items.map(p => `<tr>
                <td style="padding:5px 8px;font-family:monospace;font-size:11px;">${Utils.escapeHtml(p.artikelNr||'—')}</td>
                <td style="padding:5px 8px;font-size:12px;font-weight:600;">${Utils.escapeHtml(p.marke||'—')} ${Utils.escapeHtml(p.artikeltyp||'')}</td>
                <td style="padding:5px 8px;font-size:12px;">${Utils.escapeHtml(p.groesse||'—')}</td>
                <td style="padding:5px 8px;font-size:11px;color:var(--text-muted);">${p.lagerort && p.lagerort.regal ? p.lagerort.regal : ''} ${p.lagerort && p.lagerort.fach ? '› '+p.lagerort.fach : ''}</td>
                <td style="padding:5px 8px;font-size:12px;text-align:right;font-weight:700;">${Utils.formatCurrency(p.einkaufspreis)}</td>
              </tr>`).join('');

        const body = `
            <div style="padding:8px 14px;background:${zone.color}18;border:1px solid ${zone.color};border-radius:8px;margin-bottom:14px;font-size:13px;display:flex;gap:16px;">
                <span><strong>${items.length}</strong> Artikel</span>
                <span>Lagerwert: <strong>${Utils.formatCurrency(totalVal)}</strong></span>
                <span style="color:var(--text-muted);">Bereich: <strong>${Utils.escapeHtml(zone.bereich)}</strong></span>
            </div>
            <div class="table-container" style="border:none;">
                <table style="font-size:12px;">
                    <thead><tr><th>Art.-Nr.</th><th>Artikel</th><th>Größe</th><th>Regal/Fach</th><th style="text-align:right;">EK</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        App.showModal(`${icon} ${Utils.escapeHtml(zone.name)}`, body,
            `<button class="btn" id="zoneEditBtn" style="margin-right:auto;">✏️ Zone bearbeiten</button>
             <button class="btn btn-primary" id="zoneAssignBtn">📦 Artikel zuordnen</button>
             <button class="btn" data-action="close-modal">Schließen</button>`
        );

        const editZoneBtn = document.getElementById('zoneEditBtn');
        if (editZoneBtn) editZoneBtn.addEventListener('click', () => {
            App.closeModal();
            this._openZoneModal(zone);
        });

        const assignBtn = document.getElementById('zoneAssignBtn');
        if (assignBtn) assignBtn.addEventListener('click', () => {
            App.closeModal();
            this._openUnassignedPicker(zone);
        });
    },

    // Pick unassigned articles and assign them to a zone
    _openUnassignedPicker(zone) {
        const layout     = this._getLayout();
        const allZoneIds = new Set(layout.zones.map(z => z.bereich).filter(Boolean));
        const unassigned = Store.getPurchases(true).filter(p =>
            !p.storniert && p.status === 'verfuegbar' &&
            (!p.lagerort || !p.lagerort.bereich || !allZoneIds.has(p.lagerort.bereich))
        );
        const ICONS = { regal:'🗄️', box:'📦', schrank:'🗃️', boden:'📐', sonstiges:'📍' };
        const icon  = ICONS[zone.type] || '📍';

        if (unassigned.length === 0) {
            App.showModal(`${icon} ${Utils.escapeHtml(zone.name)} — Artikel zuordnen`,
                `<div style="text-align:center;padding:30px;color:var(--text-secondary);">
                    <div style="font-size:32px;margin-bottom:10px;">✅</div>
                    <div>Alle verfügbaren Artikel sind bereits einer Zone zugeordnet.</div>
                </div>`,
                `<button class="btn" data-action="close-modal">Schließen</button>`
            );
            return;
        }

        const rows = unassigned.map(p => `
            <tr>
                <td style="padding:5px 8px;text-align:center;"><input type="checkbox" class="zone-assign-cb" data-pid="${p.id}" style="width:15px;height:15px;accent-color:${zone.color};"></td>
                <td style="padding:5px 8px;font-family:monospace;font-size:11px;">${Utils.escapeHtml(p.artikelNr||'—')}</td>
                <td style="padding:5px 8px;font-size:12px;font-weight:600;">${Utils.escapeHtml(p.marke||'—')} ${Utils.escapeHtml(p.artikeltyp||'')}</td>
                <td style="padding:5px 8px;font-size:12px;">${Utils.escapeHtml(p.groesse||'—')}</td>
                <td style="padding:5px 8px;font-size:12px;text-align:right;font-weight:700;">${Utils.formatCurrency(p.einkaufspreis)}</td>
            </tr>`).join('');

        const body = `
            <div style="padding:8px 12px;background:${zone.color}15;border:1px solid ${zone.color}50;border-radius:8px;margin-bottom:12px;font-size:13px;">
                Wähle Artikel die du <strong style="color:${zone.color};">${Utils.escapeHtml(zone.name)}</strong> (Bereich <strong>${Utils.escapeHtml(zone.bereich)}</strong>) zuordnen möchtest.
            </div>
            <div style="margin-bottom:8px;font-size:12px;color:var(--text-muted);">
                <label style="cursor:pointer;display:flex;align-items:center;gap:6px;">
                    <input type="checkbox" id="selectAllAssign" style="accent-color:${zone.color};"> Alle auswählen
                </label>
            </div>
            <div class="table-container" style="border:none;max-height:320px;overflow-y:auto;">
                <table style="font-size:12px;">
                    <thead><tr><th style="width:28px;"></th><th>Art.-Nr.</th><th>Artikel</th><th>Größe</th><th style="text-align:right;">EK</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        App.showModal(`${icon} Artikel zuordnen → ${Utils.escapeHtml(zone.name)}`, body,
            `<button class="btn" data-action="close-modal">Abbrechen</button>
             <button class="btn btn-primary" id="confirmZoneAssign">✓ Zuordnen</button>`
        );

        const allCb = document.getElementById('selectAllAssign');
        if (allCb) allCb.addEventListener('change', () => {
            document.querySelectorAll('.zone-assign-cb').forEach(cb => cb.checked = allCb.checked);
        });

        document.getElementById('confirmZoneAssign').addEventListener('click', () => {
            const selected = [...document.querySelectorAll('.zone-assign-cb:checked')].map(cb => cb.dataset.pid);
            if (selected.length === 0) { Utils.showToast('Keine Artikel ausgewählt', 'warning'); return; }
            selected.forEach(id => {
                const p = Store.getPurchases(true).find(x => x.id === id);
                if (!p) return;
                if (!p.lagerort) p.lagerort = {};
                p.lagerort.bereich = zone.bereich;
                Store.savePurchase(p);
            });
            App.closeModal();
            Utils.showToast(`${selected.length} Artikel → ${Utils.escapeHtml(zone.name)} zugeordnet`, 'success');
            const contentEl = document.getElementById('content');
            contentEl.innerHTML = this.render();
            this.init();
        });
    },

    // Quick zone picker for a single purchase (from the table badge)
    _openZonePicker(purchaseId) {
        const purchase = Store.getPurchases(true).find(p => p.id === purchaseId);
        if (!purchase) return;
        const layout = this._getLayout();
        if (layout.zones.length === 0) {
            App.showModal('📍 Zone zuordnen',
                `<div style="text-align:center;padding:30px;color:var(--text-secondary);">
                    <div style="font-size:36px;margin-bottom:10px;">🗺️</div>
                    <div>Noch keine Zonen definiert. Erstelle zuerst ein Lager-Layout.</div>
                </div>`,
                `<button class="btn btn-primary" data-action="lg-goto-virtual">Zum Layout</button>
                 <button class="btn" data-action="close-modal">Abbrechen</button>`
            );
            return;
        }

        const ICONS = { regal:'🗄️', box:'📦', schrank:'🗃️', boden:'📐', sonstiges:'📍' };
        const curBereich = purchase.lagerort && purchase.lagerort.bereich;
        const title = [purchase.marke, purchase.artikeltyp].filter(Boolean).join(' ') || 'Artikel';

        const zoneCards = layout.zones.map(z => {
            const icon    = ICONS[z.type] || '📍';
            const isActive = z.bereich && z.bereich === curBereich;
            return `
            <div class="lg-pickzone" data-pick-zone="${z.bereich||''}" data-pick-zone-id="${z.id}" style="
                --zc:${z.color};--zcbg:${z.color}18;
                padding:12px 14px;border-radius:10px;cursor:pointer;
                border:2px solid ${isActive ? z.color : 'var(--border)'};
                background:${isActive ? z.color+'18' : 'var(--bg-secondary)'};
                display:flex;align-items:center;gap:10px;
                transition:border-color .1s,background .1s;
            ">
                <span style="font-size:22px;">${icon}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:13px;color:var(--text-primary);">${Utils.escapeHtml(z.name)}</div>
                    ${z.bereich ? `<div style="font-size:11px;color:var(--text-muted);">Bereich: <strong style="color:${z.color};">${Utils.escapeHtml(z.bereich)}</strong></div>` : `<div style="font-size:11px;color:var(--warning);">⚠ kein Bereich-Code</div>`}
                </div>
                ${isActive ? `<span style="color:${z.color};font-size:18px;">✓</span>` : ''}
            </div>`;
        }).join('');

        const body = `
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
                Artikel: <strong style="color:var(--text-primary);">${Utils.escapeHtml(title)}</strong>
                ${curBereich ? ` · Aktuell: <strong>${Utils.escapeHtml(curBereich)}</strong>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
                ${zoneCards}
                ${curBereich ? `
                <div class="lg-pickzone-remove" data-pick-zone="" style="
                    padding:10px 14px;border-radius:8px;cursor:pointer;
                    border:1px dashed var(--border);background:transparent;
                    display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:12px;
                ">
                    <span>✕</span> Zone-Zuordnung entfernen
                </div>` : ''}
            </div>`;

        App.showModal(`📍 Zone zuordnen`, body,
            `<button class="btn" data-action="close-modal">Abbrechen</button>`
        );

        document.querySelectorAll('[data-pick-zone]').forEach(card => {
            card.addEventListener('click', () => {
                const bereich = card.dataset.pickZone; // '' = remove
                if (!purchase.lagerort) purchase.lagerort = {};
                if (bereich) {
                    purchase.lagerort.bereich = bereich;
                } else {
                    delete purchase.lagerort.bereich;
                }
                Store.savePurchase(purchase);
                App.closeModal();
                const zoneName = bereich
                    ? (layout.zones.find(z => z.bereich === bereich) || {}).name || bereich
                    : null;
                Utils.showToast(zoneName ? `→ ${zoneName}` : 'Zone entfernt', 'success');
                const contentEl = document.getElementById('content');
                contentEl.innerHTML = this.render();
                this.init();
            });
        });
    },

    _animateKPIs() {
        if (typeof gsap === 'undefined') return;
        const cards = document.querySelectorAll('#content .stat-card');
        if (!cards.length) return;
        gsap.from(cards, { y: 16, opacity: 0, stagger: 0.06, duration: 0.4, ease: 'power2.out', clearProps: 'all' });
        cards.forEach(card => {
            const valEl = card.querySelector('.card-value');
            if (!valEl) return;
            const raw = valEl.textContent.trim();
            if (raw.includes('/')) return; // Skip ratio values like "10 / 27"
            const num = parseFloat(raw.replace(/\./g,'').replace(',','.').replace(/[^\d.-]/g,''));
            if (isNaN(num) || num === 0) return;
            const hasCurrency = raw.includes('€');
            const obj = { val: 0 };
            gsap.to(obj, { val: num, duration: 0.9, ease: 'power2.out',
                onUpdate() { valEl.textContent = hasCurrency ? obj.val.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €' : Math.round(obj.val).toLocaleString('de-DE'); },
                onComplete() { valEl.textContent = raw; }
            });
        });
    },

    init() {
        try {
            // Artikelnummern für alte Einträge nachrüsten (einmalig)
            this._migrateArtikelNummern();

            // GSAP KPI animation
            this._animateKPIs();

            // Helper: re-render
            const rerender = () => {
                const contentEl = document.getElementById('content');
                contentEl.innerHTML = this.render();
                this.init();
            };

            // ── Tab-Switcher ──────────────────────────────────────────────
            const tabReal = document.getElementById('tabReal');
            const tabVirt = document.getElementById('tabVirtual');
            if (tabReal) tabReal.addEventListener('click', () => { this._activeTab = 'real'; rerender(); });
            if (tabVirt) tabVirt.addEventListener('click', () => { this._activeTab = 'virtual'; rerender(); });

            // ── Lager-Layout Aktionen ─────────────────────────────────────
            // Alle Buttons die den Edit-Modus toggeln (kleiner in Kontrolleiste + großer im leeren Zustand)
            ['layoutEditToggle', 'layoutEditStart'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.addEventListener('click', () => {
                    this._layoutEditMode = !this._layoutEditMode;
                    rerender();
                });
            });

            const layoutAddZone = document.getElementById('layoutAddZone');
            if (layoutAddZone) layoutAddZone.addEventListener('click', () => this._openZoneModal(null));

            const layoutConfigGrid = document.getElementById('layoutConfigGrid');
            if (layoutConfigGrid) layoutConfigGrid.addEventListener('click', () => {
                const layout = this._getLayout();
                const body = `
                    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">Passe die Größe des Raumlayout-Gitters an.</p>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Spalten (1–12)</label>
                            <input type="range" min="1" max="12" id="lgCols" value="${layout.gridCols}" style="width:100%;"
                                   data-action-input="lg-cols-val">
                            <div style="text-align:center;font-size:22px;font-weight:700;margin-top:4px;" id="lgColsVal">${layout.gridCols}</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Reihen (1–8)</label>
                            <input type="range" min="1" max="8" id="lgRows" value="${layout.gridRows}" style="width:100%;"
                                   data-action-input="lg-rows-val">
                            <div style="text-align:center;font-size:22px;font-weight:700;margin-top:4px;" id="lgRowsVal">${layout.gridRows}</div>
                        </div>
                    </div>`;
                App.showModal('⚙️ Gitter konfigurieren', body, `
                    <button class="btn" data-action="close-modal">Abbrechen</button>
                    <button class="btn btn-primary" id="saveGridCfg">Übernehmen</button>`);
                document.getElementById('saveGridCfg').addEventListener('click', () => {
                    layout.gridCols = parseInt(document.getElementById('lgCols').value) || 6;
                    layout.gridRows = parseInt(document.getElementById('lgRows').value) || 4;
                    this._saveLayout(layout);
                    App.closeModal();
                    rerender();
                });
            });

            // Zone click → zeige Artikel
            document.querySelectorAll('[data-zone-click]').forEach(el => {
                el.addEventListener('click', () => this._openZoneItemsModal(el.dataset.zoneClick));
            });
            // Zone edit button
            document.querySelectorAll('[data-zone-edit]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const zone = this._getLayout().zones.find(z => z.id === btn.dataset.zoneEdit);
                    if (zone) this._openZoneModal(zone);
                });
            });
            // Empty cell → add zone here
            document.querySelectorAll('[data-cell-add]').forEach(cell => {
                cell.addEventListener('click', () => {
                    const [col, row] = cell.dataset.cellAdd.split(',').map(Number);
                    const layout = this._getLayout();
                    this._openZoneModal({ col, row, colSpan:1, rowSpan:1, type:'regal',
                        color: this.ZONE_COLORS[layout.zones.length % this.ZONE_COLORS.length], bereich:'', name:'' });
                });
            });

            // Show unassigned items
            const showUnassigned = document.getElementById('showUnassigned');
            if (showUnassigned) showUnassigned.addEventListener('click', () => {
                const layout    = this._getLayout();
                const purchases = Store.getPurchases(true).filter(p => !p.storniert && p.status === 'verfuegbar');
                const unassigned = purchases.filter(p => {
                    if (!p.lagerort || !p.lagerort.bereich) return true;
                    return !layout.zones.find(z => z.bereich === p.lagerort.bereich);
                });
                const rows = unassigned.map(p => `<tr>
                    <td style="font-size:12px;padding:5px 8px;font-family:monospace;">${Utils.escapeHtml(p.artikelNr||'—')}</td>
                    <td style="font-size:12px;padding:5px 8px;font-weight:600;">${Utils.escapeHtml(p.marke||'—')} ${Utils.escapeHtml(p.artikeltyp||'')}</td>
                    <td style="font-size:12px;padding:5px 8px;">${Utils.escapeHtml(p.groesse||'—')}</td>
                    <td style="font-size:12px;padding:5px 8px;text-align:right;">${Utils.formatCurrency(p.einkaufspreis)}</td>
                </tr>`).join('');
                App.showModal('⚠️ Nicht zugeordnete Artikel', `
                    <div style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">${unassigned.length} verfügbare Artikel ohne Zone</div>
                    <div class="table-container" style="border:none;">
                        <table><thead><tr><th>Art.-Nr.</th><th>Artikel</th><th>Größe</th><th style="text-align:right">EK</th></tr></thead>
                        <tbody>${rows || '<tr><td colspan="4" class="table-empty">Alle zugeordnet ✅</td></tr>'}</tbody></table>
                    </div>`,
                    '<button class="btn" data-action="close-modal">Schließen</button>'
                );
            });

            // Zone quick-assign badges in the table
            document.querySelectorAll('[data-zone-pick]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._openZonePicker(btn.dataset.zonePick);
                });
            });

            // Filter-Reset-Button
            const resetBtn = document.getElementById('lagerFilterReset');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    this._filters = { marke:'', artikeltyp:'', warenkategorie:'', zielgruppe:'', haendler:'', status:'', filterJahr:'', filterMonat:'', artikelNr:'', search:'', showStorniert: false,
                                      von:'', bis:'', artikel:'', groesse:'', lagerort:'' };
                    this._currentPage = 1;
                    rerender();
                });
            }

            // Filters → Seite immer auf 1 zurücksetzen.
            // Die Felder der Filterzeile im Tabellenkopf gibt es in der Kartenansicht nicht —
            // fehlt das Element, bleibt der bisherige Wert stehen, statt beim Ansichtswechsel
            // still weggeworfen zu werden.
            const keep = (id, current) => {
                const el = document.getElementById(id);
                return el ? el.value : (current || '');
            };
            const applyFilters = () => {
                const prev = this._filters || {};
                this._filters = {
                    marke:          (document.getElementById('lagerFilterMarke')     || {}).value || '',
                    artikeltyp:     (document.getElementById('lagerFilterTyp')       || {}).value || '',
                    warenkategorie: (document.getElementById('lagerFilterKat')       || {}).value || '',
                    zielgruppe:     (document.getElementById('lagerFilterZielgruppe')|| {}).value || '',
                    haendler:       (document.getElementById('lagerFilterHaendler')  || {}).value || '',
                    status:         (document.getElementById('lagerFilterStatus')    || {}).value || '',
                    filterJahr:     (document.getElementById('lagerFilterJahr')      || {}).value || '',
                    filterMonat:    (document.getElementById('lagerFilterMonat')     || {}).value || '',
                    artikelNr:      (document.getElementById('lagerFilterArtikelnr') || {}).value || '',
                    search:         prev.search || '',
                    showStorniert:  !!(document.getElementById('lagerFilterStorniert') || {}).checked,
                    // Spaltenfilter aus dem Tabellenkopf
                    von:            keep('lagerHfVon',      prev.von),
                    bis:            keep('lagerHfBis',      prev.bis),
                    artikel:        keep('lagerHfArtikel',  prev.artikel),
                    groesse:        keep('lagerHfGroesse',  prev.groesse),
                    lagerort:       keep('lagerHfLagerort', prev.lagerort)
                };
                this._currentPage = 1;
                rerender();
            };

            // ── Filterzeile im Tabellenkopf ───────────────────────────────
            // Art.-Nr. und Status stehen in der Leiste UND im Kopf: es ist dasselbe Filterfeld,
            // nur an zwei Orten bedienbar. Der Kopf schreibt seinen Wert deshalb in die Leiste
            // zurück, bevor applyFilters liest — so zeigen beide immer denselben Stand.
            const mirrorToBar = (headId, barId) => {
                const head = document.getElementById(headId);
                const bar  = document.getElementById(barId);
                if (head && bar) bar.value = head.value;
            };
            const applyHeadFilters = () => {
                mirrorToBar('lagerHfArtikelnr', 'lagerFilterArtikelnr');
                mirrorToBar('lagerHfStatus',    'lagerFilterStatus');
                applyFilters();
            };
            // Textfelder: bei Enter und beim Verlassen — kein Filtern bei jedem Tastendruck
            // (gleiche Entscheidung wie beim Suchfeld weiter unten).
            ['lagerHfArtikelnr','lagerHfArtikel','lagerHfGroesse','lagerHfLagerort'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('keydown', e => { if (e.key === 'Enter') applyHeadFilters(); });
                el.addEventListener('change', applyHeadFilters);
            });
            ['lagerHfVon','lagerHfBis','lagerHfStatus'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('change', applyHeadFilters);
            });
            const hfReset = document.getElementById('lagerHfReset');
            if (hfReset) hfReset.addEventListener('click', () => {
                this._filters = Object.assign({}, this._filters, {
                    artikelNr: '', von: '', bis: '', artikel: '', groesse: '', lagerort: '', status: ''
                });
                this._currentPage = 1;
                rerender();
            });

            // ── Sortierbare Spaltenköpfe ──────────────────────────────────
            Utils.bindSortableHeaders(document.querySelector('.table-container'), this._headSort, () => {
                this._currentPage = 1;
                this._savePrefs();
                rerender();
            });
            ['lagerFilterMarke','lagerFilterTyp','lagerFilterKat','lagerFilterZielgruppe','lagerFilterHaendler','lagerFilterStatus','lagerFilterJahr','lagerFilterMonat','lagerFilterStorniert'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('change', applyFilters);
            });
            // Art.-Nr.-Filter: Klick-Suche (Enter), kein Live-Filter mehr bei jedem Tastendruck
            const artikelnrEl = document.getElementById('lagerFilterArtikelnr');
            if (artikelnrEl) {
                artikelnrEl.addEventListener('keydown', e => {
                    if (e.key === 'Enter') applyFilters();
                });
            }

            // ── Suchfeld: Klick-Suche (Enter/Escape), kein Live-Filter mehr ──────
            const searchEl = document.getElementById('lagerSearch');
            if (searchEl) {
                searchEl.addEventListener('keydown', e => {
                    if (e.key === 'Enter') {
                        this._filters.search = searchEl.value;
                        this._currentPage = 1;
                        rerender();
                    }
                    if (e.key === 'Escape') {
                        searchEl.value = '';
                        this._filters.search = '';
                        this._currentPage = 1;
                        rerender();
                    }
                });
            }

            // Sort → Seite auf 1 zurücksetzen
            const sortEl = document.getElementById('lagerSortBy');
            if (sortEl) sortEl.addEventListener('change', () => {
                this._sortBy = sortEl.value;
                // Dropdown übernimmt wieder — sonst blieben zwei Sortierungen gleichzeitig
                // gesetzt und die Auswahl im Dropdown hätte sichtbar keine Wirkung.
                this._headSort.col = '';
                this._currentPage = 1;
                this._savePrefs();
                rerender();
            });

            // Pagination — querySelectorAll, damit obere UND untere Bar funktionieren
            const setPage = (p) => { this._currentPage = p; rerender(); };
            document.querySelectorAll('.lager-page-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.pageAction;
                    if (action === 'first') setPage(1);
                    else if (action === 'prev') setPage(Math.max(1, this._currentPage - 1));
                    else if (action === 'next') setPage(this._currentPage + 1);
                    else if (action === 'last') setPage(99999); // wird im render geclampt
                });
            });
            document.querySelectorAll('.lager-page-size').forEach(sel => {
                sel.addEventListener('change', () => {
                    this._pageSize = parseInt(sel.value) || 50;
                    this._currentPage = 1;
                    this._savePrefs();
                    rerender();
                });
            });

            // View toggle
            const viewTableBtn = document.getElementById('lagerViewTable');
            const viewGridBtn  = document.getElementById('lagerViewGrid');
            if (viewTableBtn) viewTableBtn.addEventListener('click', () => {
                this._viewMode = 'table'; this._savePrefs();
                const contentEl = document.getElementById('content');
                contentEl.innerHTML = this.render();
                this.init();
            });
            if (viewGridBtn) viewGridBtn.addEventListener('click', () => {
                this._viewMode = 'grid'; this._savePrefs();
                const contentEl = document.getElementById('content');
                contentEl.innerHTML = this.render();
                this.init();
            });

            // Bulk: select all checkbox
            const selectAll = document.getElementById('lagerSelectAll');
            if (selectAll) selectAll.addEventListener('change', () => {
                document.querySelectorAll('.lager-select-cb:not(:disabled)').forEach(cb => {
                    cb.checked = selectAll.checked;
                    if (selectAll.checked) this._selected.add(cb.dataset.id);
                    else this._selected.delete(cb.dataset.id);
                });
                const contentEl = document.getElementById('content');
                contentEl.innerHTML = this.render();
                this.init();
            });

            // Bulk: individual checkboxes
            document.querySelectorAll('.lager-select-cb').forEach(cb => {
                cb.addEventListener('change', () => {
                    if (cb.checked) this._selected.add(cb.dataset.id);
                    else this._selected.delete(cb.dataset.id);
                    // Re-render only the bulk bar and update highlighting without full re-render
                    // (For simplicity, do full re-render)
                    const contentEl = document.getElementById('content');
                    contentEl.innerHTML = this.render();
                    this.init();
                });
            });

            // Bulk action bar buttons
            const bulkStatusBtn = document.getElementById('lagerBulkStatus');
            if (bulkStatusBtn) bulkStatusBtn.addEventListener('click', () => {
                const body = `
                    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:14px;">${this._selected.size} Artikel werden geändert</p>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        ${Object.entries(this.STATUS_CONFIG).map(([k,v]) => `
                            <button class="btn" style="justify-content:flex-start;gap:8px;padding:10px 14px;border:1px solid ${v.color};" data-bulk-set-status="${k}">
                                <span style="font-size:15px;">${v.icon}</span> ${v.label}
                            </button>
                        `).join('')}
                    </div>
                `;
                App.showModal('Bulk-Status ändern', body, '<button class="btn" data-action="close-modal">Abbrechen</button>');
                document.querySelectorAll('[data-bulk-set-status]').forEach(b => {
                    b.addEventListener('click', () => {
                        App.closeModal();
                        this._bulkSetStatus(b.dataset.bulkSetStatus);
                    });
                });
            });

            const bulkVerkaufBtn = document.getElementById('lagerBulkVerkauf');
            if (bulkVerkaufBtn) bulkVerkaufBtn.addEventListener('click', () => this.startBulkVerkauf());

            const bulkDeselectBtn = document.getElementById('lagerBulkDeselect');
            if (bulkDeselectBtn) bulkDeselectBtn.addEventListener('click', () => {
                this._selected.clear();
                const contentEl = document.getElementById('content');
                contentEl.innerHTML = this.render();
                this.init();
            });

            // Photo: upload button (in table/grid when no photo exists)
            document.querySelectorAll('[data-upload-photo]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.uploadPhoto;
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = e => {
                        const file = e.target.files[0];
                        if (file) Lager._resizeAndStagePhoto(id, file);
                    };
                    input.click();
                });
            });

            // Photo: preview click (in table when photo exists)
            document.querySelectorAll('[data-photo-preview]').forEach(img => {
                img.addEventListener('click', () => {
                    const id = img.dataset.photoPreview;
                    const p = Store.getPurchases(true).find(x => x.id === id);
                    if (!p || !p.foto) return;
                    const body = `
                        <div style="text-align:center;">
                            <img src="${p.foto}" style="max-width:100%;max-height:60vh;border-radius:8px;object-fit:contain;">
                        </div>
                        <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                            <button class="btn btn-small" id="changePhoto_${id}">📷 Foto ändern</button>
                            <button class="btn btn-small btn-danger" id="deletePhoto_${id}">🗑 Foto löschen</button>
                        </div>
                    `;
                    App.showModal(Utils.escapeHtml(p.marke || 'Foto'), body, '<button class="btn" data-action="close-modal">Schließen</button>');

                    const changeBtn = document.getElementById('changePhoto_' + id);
                    if (changeBtn) changeBtn.addEventListener('click', () => {
                        const input = document.createElement('input');
                        input.type = 'file'; input.accept = 'image/*';
                        input.onchange = ev => {
                            const file = ev.target.files[0];
                            if (file) { App.closeModal(); Lager._resizeAndStagePhoto(id, file); }
                        };
                        input.click();
                    });

                    const delBtn = document.getElementById('deletePhoto_' + id);
                    if (delBtn) delBtn.addEventListener('click', () => {
                        const purchase = Store.getPurchases(true).find(x => x.id === id);
                        if (purchase) { delete purchase.foto; Store.savePurchase(purchase); }
                        App.closeModal();
                        const contentEl = document.getElementById('content');
                        contentEl.innerHTML = this.render();
                        this.init();
                    });
                });
            });

            // Status modal button
            document.querySelectorAll('[data-status-modal]').forEach(btn => {
                btn.addEventListener('click', () => this._openStatusModal(btn.dataset.statusModal));
            });

            // Sell buttons → Buchungen-Tab (standalone) oder Modal (Haupt-App)
            document.querySelectorAll('[data-sell]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.sell;
                    if (window.LagerPage && window.LagerPage.switchToBuchungen) {
                        window.LagerPage.switchToBuchungen([id]);
                    } else {
                        this.openVerkaufModal([id]);
                    }
                });
            });

            // ── EK Inline-Edit (Doppelklick) ──────────────────────────
            document.querySelectorAll('[data-inline-ek]').forEach(td => {
                td.addEventListener('dblclick', () => {
                    const id     = td.dataset.inlineEk;
                    const curVal = parseFloat(td.dataset.ekVal) || 0;
                    td.innerHTML = `
                        <input type="number" step="0.01" min="0" max="99999999"
                            id="ekInline_${id}" value="${curVal.toFixed(2)}"
                            style="width:82px;padding:2px 5px;font-size:12px;text-align:right;
                                   background:var(--bg-input);color:var(--text-primary);
                                   border:2px solid var(--accent);border-radius:4px;font-weight:700;">`;
                    const inp = document.getElementById('ekInline_' + id);
                    if (!inp) return;
                    inp.focus();
                    inp.select();

                    let committed = false;
                    const commit = () => {
                        if (committed) return;
                        committed = true;
                        const newVal = parseFloat(inp.value);
                        if (!Number.isFinite(newVal) || newVal < 0) {
                            Utils.showToast('Ungültiger EK-Wert', 'warning');
                            rerender();
                            return;
                        }
                        const purchase = Store.getPurchases(true).find(x => x.id === id);
                        if (purchase) {
                            purchase.einkaufspreis = newVal;
                            Store.savePurchase(purchase);
                            Utils.showToast(`EK → ${Utils.formatCurrency(newVal)}`, 'success');
                        }
                        rerender();
                    };
                    inp.addEventListener('keydown', e => {
                        if (e.key === 'Enter')  { e.preventDefault(); commit(); }
                        if (e.key === 'Escape') { committed = true; rerender(); }
                    });
                    inp.addEventListener('blur', commit);
                });
            });

            // Toggle status (legacy two-way toggle — kept for backward compat)
            document.querySelectorAll('[data-toggle-status]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.toggleStatus;
                    const current = btn.dataset.current;
                    const p = Store.getPurchases().find(x => x.id === id);
                    if (!p) return;
                    p.status = current === 'verfuegbar' ? 'reserviert' : 'verfuegbar';
                    Store.savePurchase(p);
                    Utils.showToast('Status geändert', 'success');
                    const contentEl = document.getElementById('content');
                    contentEl.innerHTML = this.render();
                    this.init();
                });
            });

            // Edit modal
            document.querySelectorAll('[data-edit-lager]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.editLager;
                    const p = Store.getPurchases(true).find(x => x.id === id);
                    if (!p) return;
                    const brands = Store.getBrands();
                    const brandOptions = brands.map(b => `<option value="${Utils.escapeHtml(b)}">`).join('');
                    const einkaufsquellen = Store.getEinkaufsquellen();
                    const quellenOptions = einkaufsquellen.map(q => `<option value="${Utils.escapeHtml(q)}" ${p.einkaufsquelle === q ? 'selected' : ''}>${Utils.escapeHtml(q)}</option>`).join('');
                    const kategorien = Store.getWarenkategorien();
                    const katOptions = ['<option value="">– keine –</option>'].concat(
                        kategorien.map(k => `<option value="${Utils.escapeHtml(k)}" ${p.warenkategorie === k ? 'selected' : ''}>${Utils.escapeHtml(k)}</option>`)
                    ).join('');
                    const haendlerListe = Store.getHaendler();
                    const haendlerOptions = ['<option value="">– keiner –</option>'].concat(
                        haendlerListe.map(h => `<option value="${Utils.escapeHtml(h)}" ${p.haendler === h ? 'selected' : ''}>${Utils.escapeHtml(h)}</option>`),
                        [`<option value="Sonstiges" ${p.haendler && !haendlerListe.includes(p.haendler) ? 'selected' : ''}>Sonstiges …</option>`]
                    ).join('');
                    const lo = p.lagerort || {};

                    const statusOptions = Object.entries(this.STATUS_CONFIG).map(([k, v]) =>
                        `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`
                    ).join('');

                    const body = `
                        <!-- Status -->
                        <div class="form-group" style="margin-bottom:16px;padding:12px 14px;background:var(--bg-secondary,rgba(255,255,255,.04));border-radius:8px;border:1px solid var(--border);">
                            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                                <div>
                                    <div style="font-size:11px;color:var(--text-muted);font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px;">Status</div>
                                    <div id="le_status_badge">${this._statusBadge(p.status, p.storniert)}</div>
                                </div>
                                ${!p.storniert ? `
                                <div style="flex:1;min-width:140px;max-width:200px;">
                                    <select class="form-select" id="le_status" style="font-size:13px;">
                                        ${statusOptions}
                                    </select>
                                </div>` : '<div style="font-size:12px;color:var(--danger,#ef4444);">Storniert — Status kann nicht geändert werden</div>'}
                            </div>
                        </div>
                        <!-- Foto -->
                        <div class="form-group" style="margin-bottom:16px;">
                            <label class="form-label">Foto</label>
                            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                                ${p.foto
                                    ? `<img id="lagerPhotoPreview_${id}" src="${p.foto}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;">`
                                    : `<div style="width:64px;height:64px;background:var(--bg-secondary);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:26px;">📦</div>`
                                }
                                <button class="btn btn-small" id="lagerPhotoUploadBtn_${id}" type="button">📷 ${p.foto ? 'Ändern' : 'Hinzufügen'}</button>
                                ${p.foto ? `<button class="btn btn-small btn-danger" id="lagerPhotoDelBtn_${id}" type="button">🗑 Löschen</button>` : ''}
                            </div>
                        </div>
                        <!-- Lagerort -->
                        <div class="form-group" style="margin-bottom:16px;">
                            <label class="form-label">Lagerort</label>
                            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                                <div>
                                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Bereich</label>
                                    <input type="text" class="form-input" id="le_lo_bereich" placeholder="z.B. A" value="${Utils.escapeHtml(lo.bereich||'')}">
                                </div>
                                <div>
                                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Regal</label>
                                    <input type="text" class="form-input" id="le_lo_regal" placeholder="z.B. R2" value="${Utils.escapeHtml(lo.regal||'')}">
                                </div>
                                <div>
                                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Fach</label>
                                    <input type="text" class="form-input" id="le_lo_fach" placeholder="z.B. F3" value="${Utils.escapeHtml(lo.fach||'')}">
                                </div>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Datum</label>
                                <input type="date" class="form-input" id="le_datum" value="${p.datum || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Marke</label>
                                <input type="text" class="form-input" id="le_marke" list="leMarkenList" value="${Utils.escapeHtml(p.marke || '')}">
                                <datalist id="leMarkenList">${brandOptions}</datalist>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Artikeltyp</label>
                                <select class="form-select" id="le_artikeltyp">
                                    ${['Jacke','Hose','Shirt','Hoodie','Schuhe','Accessoire','Sonstiges'].map(t => `<option value="${t}" ${p.artikeltyp === t ? 'selected' : ''}>${t}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Einkaufsquelle</label>
                                <select class="form-select" id="le_einkaufsquelle">
                                    ${quellenOptions}
                                </select>
                                <div id="le_customQuelleGroup" style="display:none;margin-top:6px;">
                                    <input type="text" class="form-input" id="le_customQuelle" placeholder="Eigene Quelle eingeben...">
                                </div>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Kategorie</label>
                                <select class="form-select" id="le_kategorie">
                                    ${katOptions}
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Zielgruppe</label>
                                <select class="form-select" id="le_zielgruppe">
                                    <option value="">– keine –</option>
                                    ${Store.ZIELGRUPPEN.map(z => `<option value="${z}" ${p.zielgruppe === z ? 'selected' : ''}>${z}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Lieferant/Händler</label>
                                <select class="form-select" id="le_haendler">
                                    ${haendlerOptions}
                                </select>
                                <div id="le_customHaendlerGroup" style="display:${p.haendler && !haendlerListe.includes(p.haendler) ? '' : 'none'};margin-top:6px;">
                                    <input type="text" class="form-input" id="le_customHaendler" placeholder="Name eingeben..." value="${p.haendler && !haendlerListe.includes(p.haendler) ? Utils.escapeHtml(p.haendler) : ''}">
                                </div>
                            </div>
                        </div>
                        ${this._farbenFieldHtml('le', p.farben)}
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Größe</label>
                                <input type="text" class="form-input" id="le_groesse" value="${Utils.escapeHtml(p.groesse || '')}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Beschreibung</label>
                                <input type="text" class="form-input" id="le_beschreibung" value="${Utils.escapeHtml(p.beschreibung || '')}">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Artikelnummer</label>
                                <input type="text" class="form-input" id="le_artikelnr" value="${Utils.escapeHtml(p.artikelNr || '')}">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Einkaufspreis (Brutto)
                                    ${p.einkaufspreis_netto != null ? `<span style="font-weight:400;font-size:11px;color:var(--text-muted);margin-left:6px;" title="Netto ${Utils.formatCurrency(p.einkaufspreis_netto)} · Versandanteil ${Utils.formatCurrency(p.versandanteil||0)} · MwSt ${p.mwst_satz||0}%">ℹ Netto: ${Utils.formatCurrency(p.einkaufspreis_netto)}</span>` : ''}
                                </label>
                                <input type="number" step="0.01" class="form-input" id="le_preis" value="${p.einkaufspreis || 0}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Anzahl</label>
                                <input type="number" min="1" class="form-input" id="le_anzahl" value="${p.anzahl || 1}">
                            </div>
                        </div>
                        <!-- Differenzbesteuerung §25a UStG -->
                        <div class="form-group">
                            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;font-weight:400;">
                                <input type="checkbox" id="le_differenzbesteuert" ${p.differenzbesteuert ? 'checked' : ''}>
                                Ohne Vorsteuerabzug erworben (z.B. von Privatperson) — Differenzbesteuerung §25a möglich
                            </label>
                            <div id="le_warenart_wrap" style="display:${p.differenzbesteuert ? '' : 'none'};margin-top:8px;">
                                <label class="form-label">Warenart (§25a)</label>
                                <select class="form-select" id="le_warenart">
                                    <option value="gebraucht" ${p.warenart === 'gebraucht' ? 'selected' : ''}>Gebrauchtgegenstände</option>
                                    <option value="kunst" ${p.warenart === 'kunst' ? 'selected' : ''}>Kunstgegenstände</option>
                                    <option value="sammlerstueck" ${p.warenart === 'sammlerstueck' ? 'selected' : ''}>Sammlungsstücke und Antiquitäten</option>
                                </select>
                                <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Stackr rechnet die Marge v1 pauschal mit 19% USt. Bei bestimmten Kunstgegenständen/Sammlerstücken/Einfuhren kann nach §25a Abs. 3 UStG i.V.m. Anlage 2 UStG auch 7% gelten — bitte im Zweifel mit deinem Steuerberater klären.</div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Tags <span style="font-weight:400;color:var(--text-muted);">(kommagetrennt)</span></label>
                            <input type="text" class="form-input" id="le_tags" value="${Utils.escapeHtml((p.tags || []).join(', '))}" placeholder="z.B. Vintage, Streetwear …">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Notizen</label>
                            <textarea class="form-textarea" id="le_notizen">${Utils.escapeHtml(p.notizen || '')}</textarea>
                        </div>
                    `;
                    const footer = `
                        <button class="btn" data-action="close-modal">Abbrechen</button>
                        <button class="btn btn-primary" id="saveLagerEdit">Speichern</button>
                    `;
                    App.showModal('Artikel bearbeiten', body, footer);
                    this._bindFarbenPicker('le');

                    // Photo upload button in edit modal
                    const uploadBtn = document.getElementById(`lagerPhotoUploadBtn_${id}`);
                    if (uploadBtn) uploadBtn.addEventListener('click', () => {
                        const input = document.createElement('input');
                        input.type = 'file'; input.accept = 'image/*';
                        input.onchange = e => {
                            const file = e.target.files[0];
                            if (file) Lager._resizeAndStagePhoto(id, file);
                        };
                        input.click();
                    });

                    // Photo delete button in edit modal
                    const delPhotoBtn = document.getElementById(`lagerPhotoDelBtn_${id}`);
                    if (delPhotoBtn) delPhotoBtn.addEventListener('click', () => {
                        delete p.foto;
                        Store.savePurchase(p);
                        Utils.showToast('Foto gelöscht', 'success');
                        // Visually swap the photo area
                        const previewImg = document.getElementById(`lagerPhotoPreview_${id}`);
                        if (previewImg) previewImg.remove();
                        delPhotoBtn.remove();
                        const changeBtn2 = document.getElementById(`lagerPhotoUploadBtn_${id}`);
                        if (changeBtn2) changeBtn2.textContent = '📷 Hinzufügen';
                    });

                    // Status-Dropdown → Badge live aktualisieren
                    const leStatusSelect = document.getElementById('le_status');
                    const leStatusBadge  = document.getElementById('le_status_badge');
                    if (leStatusSelect && leStatusBadge) {
                        leStatusSelect.addEventListener('change', () => {
                            leStatusBadge.innerHTML = Lager._statusBadge(leStatusSelect.value, false);
                        });
                    }

                    // Differenzbesteuerung §25a: Warenart-Auswahl nur bei aktivem Haken zeigen
                    const leDiffCheckbox = document.getElementById('le_differenzbesteuert');
                    const leWarenartWrap = document.getElementById('le_warenart_wrap');
                    if (leDiffCheckbox && leWarenartWrap) {
                        leDiffCheckbox.addEventListener('change', () => {
                            leWarenartWrap.style.display = leDiffCheckbox.checked ? '' : 'none';
                        });
                    }

                    // Einkaufsquelle "Sonstiges" toggle
                    const leQuelleSelect = document.getElementById('le_einkaufsquelle');
                    const leCustomGroup  = document.getElementById('le_customQuelleGroup');
                    if (leQuelleSelect && leCustomGroup) {
                        leQuelleSelect.addEventListener('change', () => {
                            leCustomGroup.style.display = leQuelleSelect.value === 'Sonstiges' ? '' : 'none';
                        });
                    }

                    // Händler "Sonstiges" toggle
                    const leHaendlerSelect = document.getElementById('le_haendler');
                    const leCustomHaendlerGroup = document.getElementById('le_customHaendlerGroup');
                    if (leHaendlerSelect && leCustomHaendlerGroup) {
                        leHaendlerSelect.addEventListener('change', () => {
                            leCustomHaendlerGroup.style.display = leHaendlerSelect.value === 'Sonstiges' ? '' : 'none';
                        });
                    }

                    // Save button
                    document.getElementById('saveLagerEdit').addEventListener('click', () => {
                        const marke = document.getElementById('le_marke').value.trim();
                        if (marke) Store.addBrand(marke);

                        let einkaufsquelle = (leQuelleSelect || {}).value || p.einkaufsquelle;
                        if (einkaufsquelle === 'Sonstiges') {
                            const custom = (document.getElementById('le_customQuelle') || {}).value?.trim();
                            if (custom) { einkaufsquelle = custom; Store.addEinkaufsquelle(custom); }
                        }

                        let haendler = (leHaendlerSelect || {}).value || '';
                        if (haendler === 'Sonstiges') {
                            const customH = (document.getElementById('le_customHaendler') || {}).value?.trim();
                            haendler = customH || '';
                            if (customH) Store.addHaendler(customH);
                        }

                        const newStatus = document.getElementById('le_status')?.value || p.status;
                        Store.savePurchase({
                            ...p,
                            datum:          Utils.getDateInputValue('le_datum'),
                            marke,
                            artikeltyp:     (document.getElementById('le_artikeltyp') || {}).value     || p.artikeltyp,
                            groesse:        document.getElementById('le_groesse').value.trim(),
                            beschreibung:   document.getElementById('le_beschreibung').value.trim(),
                            artikelNr:      document.getElementById('le_artikelnr').value.trim() || p.artikelNr,
                            einkaufspreis:  parseFloat(document.getElementById('le_preis').value) || 0,
                            anzahl:         parseInt(document.getElementById('le_anzahl').value)  || 1,
                            einkaufsquelle,
                            warenkategorie: (document.getElementById('le_kategorie') || {}).value || '',
                            zielgruppe:     (document.getElementById('le_zielgruppe') || {}).value || '',
                            haendler,
                            farben:         this._getFarben('le'),
                            status:         newStatus,
                            differenzbesteuert: leDiffCheckbox?.checked || false,
                            warenart:       leDiffCheckbox?.checked ? document.getElementById('le_warenart').value : undefined,
                            tags:           (document.getElementById('le_tags')?.value || '').split(',').map(t=>t.trim()).filter(Boolean),
                            notizen:        document.getElementById('le_notizen').value.trim(),
                            lagerort: {
                                bereich: (document.getElementById('le_lo_bereich') || {}).value?.trim() || '',
                                regal:   (document.getElementById('le_lo_regal')   || {}).value?.trim() || '',
                                fach:    (document.getElementById('le_lo_fach')    || {}).value?.trim() || ''
                            }
                        });
                        App.closeModal();
                        Utils.showToast('Artikel aktualisiert', 'success');
                        const contentEl = document.getElementById('content');
                        contentEl.innerHTML = this.render();
                        this.init();
                    });
                });
            });

            // Storno
            document.querySelectorAll('[data-storno-lager]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const grund = prompt('Stornogrund angeben (Pflicht für Revisionssicherheit):');
                    if (!grund) return;
                    Store.stornoPurchase(btn.dataset.stornoLager, grund);
                    Utils.showToast('Artikel storniert', 'success');
                    const contentEl = document.getElementById('content');
                    contentEl.innerHTML = this.render();
                    this.init();
                });
            });

            // Verkauf direkt am Artikel bearbeiten / stornieren
            document.querySelectorAll('[data-edit-sale]').forEach(btn => {
                btn.addEventListener('click', () => this.openSaleEditModal(btn.dataset.editSale));
            });

            // Löschen — offene Periode: echtes Löschen mit Protokoll; festgeschrieben: Storno
            document.querySelectorAll('[data-delete-lager]').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (!confirm('Artikel löschen? In einer offenen Periode wird er entfernt und im Änderungsprotokoll dokumentiert.')) return;
                    const res = Store.deletePurchase(btn.dataset.deleteLager);
                    if (res && res.blocked) { Utils.showToast('Artikel ist verkauft — bitte zuerst den Verkauf bearbeiten/stornieren', 'warning'); return; }
                    if (res && res.storno) Utils.showToast('Periode ist abgeschlossen — storniert statt gelöscht', 'warning');
                    else Utils.showToast('Artikel gelöscht', 'success');
                    const contentEl = document.getElementById('content');
                    contentEl.innerHTML = this.render();
                    this.init();
                });
            });
        } catch(err) {
            console.error('Lager.init error:', err);
        }
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'lg-calc-vk':      function () { Lager._calcVkNetto(); },
    'lg-export-xlsx':  function () { App.closeModal(); Lager.exportXLSX(); },
    'lg-export-csv':   function () { App.closeModal(); Lager.exportCSV(); },
    'lg-pick-swatch':  function (e, el) {
        document.querySelectorAll('[data-swatch]').forEach(function (s) { s.style.outline = 'none'; });
        el.style.outline = '3px solid ' + el.dataset.swatch;
        el.style.outlineOffset = '2px';
        document.getElementById('zm_color').value = el.dataset.swatch;
    },
    'lg-zone-edit':    function (id) {
        App.closeModal();
        Lager._openZoneModal(Lager._getLayout().zones.find(function (z) { return z.id === id; }));
    },
    'lg-goto-virtual': function () {
        App.closeModal();
        Lager._activeTab = 'virtual';
        document.getElementById('content').innerHTML = Lager.render();
        Lager.init();
    },
    'lg-cols-val':     function (e, el) { document.getElementById('lgColsVal').textContent = el.value; },
    'lg-rows-val':     function (e, el) { document.getElementById('lgRowsVal').textContent = el.value; }
});
