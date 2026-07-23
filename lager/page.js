// Lager-Seiten-Logik (ehem. Inline-Script in lager/index.html — CSP script-src-elem 'self')

// ── Minimaler App-Shim ────────────────────────────────────────────────────
const App = {
    currentPage: 'lager',

    navigate(page) {
        window.location.href = '../app.html?page=' + encodeURIComponent(page);
    },

    showModal(title, bodyHtml, footerHtml) {
        const modal = document.getElementById('modal');
        modal.innerHTML = `
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" data-action="close-modal">&times;</button>
            </div>
            <div class="modal-body">${bodyHtml}</div>
            ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
        `;
        document.getElementById('modalOverlay').classList.add('active');
    },

    closeModal() {
        document.getElementById('modalOverlay').classList.remove('active');
        document.getElementById('modal').innerHTML = '';
    }
};

// Modal schließen bei Klick auf Overlay / Escape
document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) App.closeModal();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') App.closeModal();
});

// ── Sidebar-Collapse (Legacy — Button ist hidden, kein Effekt nötig) ──────
// sidebarCollapseBtn ist display:none; Toggle läuft über sidebarToggleBtn

// ── Theme: system preference via prefers-color-scheme ─────────────────────
// Änderungen aus anderen Tabs sofort übernehmen (nur Lager-Sync, kein Theme)
window.addEventListener('storage', e => {
    if (e.key === '_oyi_lsmirror_ts' && Store._mainIdbReady && Store._mainIdb) {
        Store._loadCacheFromMainIDB().then(() => {
            if (typeof renderPage === 'function') renderPage();
        });
    }
});

// ── Buchungen-Umschaltung ─────────────────────────────────────────────────
const LagerPage = {
    _currentTab: 'lager',
    _buchSelected: new Set(),
    _buchSearchTerm: '',
    _buchPage: 1,
    _buchPageSize: 50,

    switchTab(tab) {
        this._currentTab = tab;
        document.getElementById('lagerTabContent').style.display    = tab === 'lager'     ? '' : 'none';
        document.getElementById('buchungenTabContent').style.display = tab === 'buchungen' ? '' : 'none';

        // Sidebar Aktiv-State synchronisieren
        const sbBuchungen = document.getElementById('sidebarBuchungen');
        const sbNeuArtikel = document.getElementById('sidebarNeuArtikel');
        if (sbBuchungen)  sbBuchungen.classList.toggle('active', tab === 'buchungen');
        if (sbNeuArtikel) sbNeuArtikel.classList.toggle('active', tab === 'lager');
        // Schnellfilter-Aktiv-Zustand zurücksetzen wenn Buchungen aktiv ist
        if (tab === 'buchungen') {
            document.querySelectorAll('[data-quick-filter]').forEach(el => el.classList.remove('active'));
        }

        if (tab === 'buchungen') {
            this.renderBuchungen();
        }
    },

    // Öffnet Buchungen-Ansicht und wählt Artikel vor
    switchToBuchungen(ids) {
        this._buchSelected = new Set(ids || []);
        this.switchTab('buchungen');
    },

    // ── Buchungen-Ansicht rendern ─────────────────────────────────────────
    renderBuchungen() {
        const el = document.getElementById('buchungenContent');
        if (!el) return;

        const allPurchases = Store.getPurchases();
        const available    = allPurchases.filter(p => p.status === 'verfuegbar' && !p.storniert);

        // Suchfilter
        const term = this._buchSearchTerm.toLowerCase();
        const filtered = term
            ? available.filter(p =>
                (p.marke||'').toLowerCase().includes(term) ||
                (p.artikeltyp||'').toLowerCase().includes(term) ||
                (p.beschreibung||'').toLowerCase().includes(term) ||
                (p.artikelNr||'').toLowerCase().includes(term) ||
                (p.groesse||'').toLowerCase().includes(term)
              )
            : available;

        const today     = new Date().toLocaleDateString('sv-SE');
        const platforms = Store.getPlatforms();
        const lastPlat  = localStorage.getItem('lager_last_platform') || 'Vinted';
        const platOpts  = platforms.filter(p => p !== 'Sonstiges')
            .map(p => `<option value="${Utils.escapeHtml(p)}" ${p === lastPlat ? 'selected' : ''}>${Utils.escapeHtml(p)}</option>`)
            .join('');

        const selectedCount = this._buchSelected.size;
        const totalEK = available.filter(p => this._buchSelected.has(p.id))
            .reduce((s, p) => s + (parseFloat(p.einkaufspreis)||0), 0);
        this._buchTotalEK = totalEK;

        // Pagination
        const filteredCount = filtered.length;
        const totalPages    = Math.max(1, Math.ceil(filteredCount / this._buchPageSize));
        if (this._buchPage > totalPages) this._buchPage = totalPages;
        if (this._buchPage < 1)          this._buchPage = 1;
        const startIdx  = (this._buchPage - 1) * this._buchPageSize;
        const pageItems = filtered.slice(startIdx, startIdx + this._buchPageSize);

        // Artikel-Zeilen (nur die aktuelle Seite)
        const rows = pageItems.map(p => {
            const checked = this._buchSelected.has(p.id);
            return `
            <tr class="buch-artikel-row${checked ? ' buch-row-selected' : ''}" data-buch-id="${p.id}" style="cursor:pointer;">
                <td style="width:32px;text-align:center;padding:6px 8px;">
                    <input type="checkbox" class="buch-cb" data-id="${p.id}" ${checked ? 'checked' : ''}
                           style="width:16px;height:16px;cursor:pointer;accent-color:var(--accent);"
                           data-action="stop">
                </td>
                ${p.foto ? `<td style="width:40px;padding:4px;"><img src="${p.foto}" style="width:34px;height:34px;object-fit:cover;border-radius:4px;vertical-align:middle;"></td>`
                          : `<td style="width:40px;text-align:center;color:var(--text-muted);font-size:18px;">📦</td>`}
                <td style="padding:6px 8px;font-family:monospace;font-size:11px;white-space:nowrap;color:var(--text-muted);">${Utils.escapeHtml(p.artikelNr||'—')}</td>
                <td style="padding:6px 8px;font-size:13px;font-weight:600;">${Utils.escapeHtml((p.marke||'—')+' '+(p.artikeltyp||''))}</td>
                <td style="padding:6px 8px;font-size:12px;color:var(--text-secondary);">${Utils.escapeHtml(p.groesse||'—')}</td>
                <td style="padding:6px 8px;font-size:13px;font-weight:700;text-align:right;white-space:nowrap;">${Utils.formatCurrency(p.einkaufspreis)}</td>
                <td style="padding:6px 8px;font-size:11px;color:var(--text-muted);white-space:nowrap;">${Utils.formatDate(p.datum)}</td>
            </tr>`;
        }).join('');

        el.innerHTML = `
        <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">

            <!-- Linke Spalte: Artikel wählen -->
            <div style="flex:1;min-width:300px;">
                <div class="card" style="padding:0;overflow:hidden;">
                    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                        <span style="font-weight:700;font-size:14px;">Verfügbare Artikel</span>
                        <span style="font-size:12px;color:var(--text-muted);">(${available.length})</span>
                        <div style="margin-left:auto;display:flex;gap:8px;align-items:center;">
                            <input type="text" class="form-input" id="buchSearch"
                                   placeholder="Suchen …" value="${Utils.escapeHtml(this._buchSearchTerm)}"
                                   style="width:160px;font-size:13px;padding:5px 10px;">
                            <button class="btn btn-small" id="buchDeselectBtn"
                                    style="white-space:nowrap;${selectedCount === 0 ? 'display:none;' : ''}">✕ Abwählen</button>
                        </div>
                    </div>

                    <!-- Auswahl-Infobar (nur sichtbar wenn Artikel gewählt) -->
                    <div id="buchSelectionInfo"
                         style="padding:8px 16px;background:rgba(16,185,129,.08);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;font-size:13px;flex-wrap:wrap;${selectedCount === 0 ? 'display:none;' : ''}">
                        <span style="font-weight:600;color:var(--accent);" id="buchSelCount">${selectedCount} Artikel ausgewählt</span>
                        <span style="color:var(--text-secondary);">EK: <strong id="buchSelEK" style="color:var(--danger);">${Utils.formatCurrency(totalEK)}</strong></span>
                        <span style="color:var(--text-secondary);">VP: <strong id="buchSelVP" style="color:var(--text-primary);">—</strong></span>
                        <span style="color:var(--text-secondary);">Gewinn: <strong id="buchSelGewinn" style="color:var(--success);">—</strong></span>
                    </div>

                    <div style="max-height:420px;overflow-y:auto;" id="buchArtikelList">
                        ${filteredCount === 0
                            ? `<div style="padding:40px;text-align:center;color:var(--text-secondary);">Keine verfügbaren Artikel</div>`
                            : `<table style="width:100%;border-collapse:collapse;">
                                <thead style="position:sticky;top:0;background:var(--bg-secondary);z-index:1;">
                                    <tr style="border-bottom:1px solid var(--border);">
                                        <th style="padding:6px 8px;width:32px;">
                                            <input type="checkbox" id="buchSelectAll" title="Alle (auf Seite)"
                                                   style="width:16px;height:16px;accent-color:var(--accent);"
                                                   ${pageItems.length > 0 && pageItems.every(p => this._buchSelected.has(p.id)) ? 'checked' : ''}>
                                        </th>
                                        <th style="width:40px;"></th>
                                        <th style="padding:6px 8px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;">Art.-Nr.</th>
                                        <th style="padding:6px 8px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;">Artikel</th>
                                        <th style="padding:6px 8px;font-size:11px;color:var(--text-muted);font-weight:600;">Gr.</th>
                                        <th style="padding:6px 8px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:right;">EK</th>
                                        <th style="padding:6px 8px;font-size:11px;color:var(--text-muted);font-weight:600;">Datum</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                               </table>`
                        }
                    </div>

                    ${filteredCount > this._buchPageSize ? `
                    <div style="padding:8px 16px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12px;">
                        <span style="color:var(--text-secondary);">
                            <strong>${startIdx + 1}</strong>–<strong>${Math.min(startIdx + this._buchPageSize, filteredCount)}</strong> von <strong>${filteredCount}</strong>
                        </span>
                        <div style="display:flex;gap:4px;align-items:center;">
                            <button class="btn btn-small" id="buchPagePrev" ${this._buchPage === 1 ? 'disabled' : ''}>‹</button>
                            <span style="padding:0 8px;font-weight:600;">${this._buchPage} / ${totalPages}</span>
                            <button class="btn btn-small" id="buchPageNext" ${this._buchPage === totalPages ? 'disabled' : ''}>›</button>
                        </div>
                    </div>` : ''}
                </div>
            </div>

            <!-- Rechte Spalte: Verkauf-Formular -->
            <div style="width:300px;min-width:240px;flex-shrink:0;position:sticky;top:80px;max-height:calc(100vh - 100px);overflow-y:auto;">
                <div class="card" id="buchFormCard"
                     style="padding:14px;transition:opacity .15s;${selectedCount === 0 ? 'opacity:.45;pointer-events:none;' : ''}">
                    <div style="font-weight:700;font-size:13px;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
                        💰 Verkauf verbuchen
                        <span id="buchFormBadge"
                              style="font-size:11px;background:var(--accent);color:#fff;border-radius:10px;padding:1px 7px;font-weight:600;${selectedCount === 0 ? 'display:none;' : ''}">${selectedCount}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:8px;">

                        <!-- Datum + Plattform (2 Spalten) -->
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            <div>
                                <label class="form-label" style="font-size:11px;">Datum *</label>
                                <input type="date" class="form-input" id="buch_datum" value="${today}" style="padding:5px 8px;font-size:12px;">
                            </div>
                            <div>
                                <label class="form-label" style="font-size:11px;">Plattform *</label>
                                <select class="form-select" id="buch_plattform" style="padding:5px 8px;font-size:12px;" data-action-change="lgp-plattform">
                                    ${platOpts}
                                    <option value="Sonstiges">Sonstiges</option>
                                </select>
                            </div>
                        </div>

                        <!-- Custom Plattform -->
                        <div id="buch_customPlattformWrap" style="display:none;">
                            <label class="form-label" style="font-size:11px;">Eigene Plattform</label>
                            <input type="text" class="form-input" id="buch_customPlattform" placeholder="Plattform …" style="padding:5px 8px;font-size:12px;">
                        </div>

                        <!-- Verkaufspreis (groß) -->
                        <div>
                            <label class="form-label" style="font-size:11px;">Verkaufspreis (€) *</label>
                            <input type="number" step="0.01" min="0" class="form-input" id="buch_preis"
                                   placeholder="0,00" style="font-size:20px;font-weight:700;padding:7px 10px;"
                                   data-action-input="lgp-calc-netto">
                        </div>

                        <!-- Versand Käufer + Gebühr -->
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            <div>
                                <label class="form-label" style="font-size:11px;">Versand Käufer (€)</label>
                                <input type="number" step="0.01" min="0" class="form-input" id="buch_versandKaeufer"
                                       value="0" style="padding:5px 8px;font-size:12px;" data-action-input="lgp-calc-netto">
                            </div>
                            <div>
                                <label class="form-label" style="font-size:11px;">Gebühr (%)</label>
                                <input type="number" step="0.1" min="0" max="100" class="form-input" id="buch_gebuehr"
                                       value="0" style="padding:5px 8px;font-size:12px;" data-action-input="lgp-calc-netto">
                            </div>
                        </div>

                        <!-- Versand Verkäufer -->
                        <div>
                            <label class="form-label" style="font-size:11px;">Versand Verkäufer (€)</label>
                            <input type="number" step="0.01" min="0" class="form-input" id="buch_versandVk"
                                   value="0" style="padding:5px 8px;font-size:12px;" data-action-input="lgp-calc-netto">
                        </div>

                        <!-- Käufer + Notizen (klappbar) -->
                        <details style="border:1px solid var(--border);border-radius:6px;">
                            <summary style="padding:5px 10px;cursor:pointer;font-size:11px;font-weight:600;color:var(--text-secondary);list-style:none;">
                                ＋ Käufer / Notizen <span style="font-weight:400;color:var(--text-muted);">(optional)</span>
                            </summary>
                            <div style="padding:8px 10px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:7px;">
                                <div>
                                    <label class="form-label" style="font-size:11px;">Käufer / Nutzername</label>
                                    <input type="text" class="form-input" id="buch_kaeufer" placeholder="Optional" style="padding:5px 8px;font-size:12px;">
                                </div>
                                <div>
                                    <label class="form-label" style="font-size:11px;">Notizen</label>
                                    <textarea class="form-textarea" id="buch_notizen" rows="2" placeholder="Optional" style="font-size:12px;padding:5px 8px;"></textarea>
                                </div>
                            </div>
                        </details>

                        <!-- Gewinn-Vorschau -->
                        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:10px;font-size:12px;">
                            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Vorschau</div>
                            <div style="display:grid;grid-template-columns:1fr auto;gap:2px 8px;align-items:baseline;">
                                <span style="color:var(--text-secondary);font-size:11px;">Verkauf + Versand</span>
                                <span id="buch_prev_preis" style="text-align:right;font-size:11px;">—</span>
                                <span style="color:var(--text-secondary);font-size:11px;">− Gebühr</span>
                                <span id="buch_prev_geb" style="text-align:right;font-size:11px;">—</span>
                                <span style="color:var(--text-secondary);font-size:11px;">− Versand VK</span>
                                <span id="buch_prev_vsk" style="text-align:right;font-size:11px;">—</span>
                                <span style="color:var(--text-secondary);font-size:11px;">− EK</span>
                                <span id="buch_prev_ek" style="text-align:right;font-size:11px;color:var(--danger);">− ${Utils.formatCurrency(totalEK)}</span>
                                <span style="font-weight:700;font-size:12px;border-top:1px solid var(--border);padding-top:5px;margin-top:2px;">Gewinn</span>
                                <span id="buch_prev_netto" style="font-weight:700;font-size:16px;text-align:right;border-top:1px solid var(--border);padding-top:5px;margin-top:2px;color:var(--success);">—</span>
                            </div>
                        </div>

                        <button class="btn btn-primary" id="buchSaveBtn"
                                style="width:100%;padding:10px;font-size:14px;font-weight:700;"
                                ${selectedCount === 0 ? 'disabled' : ''}>
                            💰 Verkauf speichern
                        </button>
                        <p id="buchSelHint" style="text-align:center;font-size:12px;color:var(--text-muted);margin:0;${selectedCount > 0 ? 'display:none;' : ''}">← Bitte zuerst Artikel auswählen</p>
                    </div>
                </div>
            </div>

        </div>`;

        // Event-Handler verdrahten
        this._initBuchungenEvents(pageItems, available);
        this._onPlattformChange();
        this._calcNetto();

        // Pagination-Buttons
        const bpp = document.getElementById('buchPagePrev');
        const bpn = document.getElementById('buchPageNext');
        if (bpp) bpp.addEventListener('click', () => { this._buchPage = Math.max(1, this._buchPage - 1); this.renderBuchungen(); });
        if (bpn) bpn.addEventListener('click', () => { this._buchPage++; this.renderBuchungen(); });
    },

    // Inkrementelles UI-Update (kein innerHTML-Ersetzen bei Checkbox-Klick)
    _updateSelectionUI(filtered, available) {
        const selectedCount = this._buchSelected.size;
        const totalEK = available.filter(p => this._buchSelected.has(p.id))
            .reduce((s, p) => s + (parseFloat(p.einkaufspreis)||0), 0);
        this._buchTotalEK = totalEK;

        // Zeilen hervorheben
        document.querySelectorAll('.buch-artikel-row').forEach(row => {
            const id = row.dataset.buchId;
            const sel = this._buchSelected.has(id);
            row.classList.toggle('buch-row-selected', sel);
            const cb = row.querySelector('.buch-cb');
            if (cb) cb.checked = sel;
        });

        // Alle-auswählen Checkbox: prüft nur die sichtbare Seite (filtered = pageItems)
        const selAll = document.getElementById('buchSelectAll');
        if (selAll) selAll.checked = filtered.length > 0 && filtered.every(p => this._buchSelected.has(p.id));

        // Infobar
        const infoBar = document.getElementById('buchSelectionInfo');
        if (infoBar) infoBar.style.display = selectedCount > 0 ? '' : 'none';
        const selCount = document.getElementById('buchSelCount');
        if (selCount) selCount.textContent = `${selectedCount} Artikel ausgewählt`;
        const selEK = document.getElementById('buchSelEK');
        if (selEK) selEK.textContent = Utils.formatCurrency(totalEK);

        // Abwählen-Button
        const desBtn = document.getElementById('buchDeselectBtn');
        if (desBtn) desBtn.style.display = selectedCount > 0 ? '' : 'none';

        // Formular-Karte
        const formCard = document.getElementById('buchFormCard');
        if (formCard) {
            formCard.style.opacity       = selectedCount > 0 ? '1' : '0.45';
            formCard.style.pointerEvents = selectedCount > 0 ? '' : 'none';
        }

        // Badge im Formular-Header
        const badge = document.getElementById('buchFormBadge');
        if (badge) {
            badge.textContent    = selectedCount;
            badge.style.display  = selectedCount > 0 ? '' : 'none';
        }

        // Speichern-Button
        const saveBtn = document.getElementById('buchSaveBtn');
        if (saveBtn) saveBtn.disabled = selectedCount === 0;

        // Hinweis-Text
        const hint = document.getElementById('buchSelHint');
        if (hint) hint.style.display = selectedCount > 0 ? 'none' : '';

        // EK in Gewinn-Vorschau aktualisieren
        const ekSpan = document.getElementById('buch_prev_ek');
        if (ekSpan) ekSpan.textContent = '− ' + Utils.formatCurrency(totalEK);
        this._calcNetto();
    },

    _initBuchungenEvents(filtered, available) {
        // Suche — vollständiges Re-Render nötig (Seite zurück auf 1)
        const searchEl = document.getElementById('buchSearch');
        if (searchEl) searchEl.addEventListener('input', () => {
            this._buchSearchTerm = searchEl.value;
            this._buchPage = 1;
            this.renderBuchungen();
        });

        // Alle auswählen
        const selAll = document.getElementById('buchSelectAll');
        if (selAll) selAll.addEventListener('change', () => {
            filtered.forEach(p => {
                if (selAll.checked) this._buchSelected.add(p.id);
                else this._buchSelected.delete(p.id);
            });
            this._updateSelectionUI(filtered, available);
        });

        // Einzel-Checkboxen — inkrementelles Update (kein Flimmern)
        document.querySelectorAll('.buch-cb').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) this._buchSelected.add(cb.dataset.id);
                else this._buchSelected.delete(cb.dataset.id);
                this._updateSelectionUI(filtered, available);
            });
        });

        // Zeilen-Klick = Checkbox toggeln — inkrementelles Update
        document.querySelectorAll('.buch-artikel-row').forEach(row => {
            row.addEventListener('click', e => {
                if (e.target.tagName === 'INPUT') return;
                const id = row.dataset.buchId;
                if (this._buchSelected.has(id)) this._buchSelected.delete(id);
                else this._buchSelected.add(id);
                this._updateSelectionUI(filtered, available);
            });
        });

        // Abwählen-Button
        const desBtn = document.getElementById('buchDeselectBtn');
        if (desBtn) desBtn.addEventListener('click', () => {
            this._buchSelected.clear();
            this._updateSelectionUI(filtered, available);
        });

        // Speichern-Button
        const saveBtn = document.getElementById('buchSaveBtn');
        if (saveBtn) saveBtn.addEventListener('click', () => this._saveBuchung());
    },

    _onPlattformChange() {
        const platSel  = document.getElementById('buch_plattform');
        const custWrap = document.getElementById('buch_customPlattformWrap');
        if (!platSel || !custWrap) return;
        custWrap.style.display = platSel.value === 'Sonstiges' ? '' : 'none';
        // Gebühr NICHT auto-füllen — Nutzer gibt manuell 0 oder eigenen Wert ein
    },

    _buchTotalEK: 0,

    _calcNetto() {
        try {
            const preis   = parseFloat(document.getElementById('buch_preis')?.value)         || 0;
            const vsk     = parseFloat(document.getElementById('buch_versandKaeufer')?.value) || 0;
            const geb     = parseFloat(document.getElementById('buch_gebuehr')?.value)        || 0;
            const vskVk   = parseFloat(document.getElementById('buch_versandVk')?.value)      || 0;
            const ek      = this._buchTotalEK || 0;
            const brutto  = preis + vsk;
            const gebBet  = brutto * (geb / 100);
            const netto   = brutto - gebBet - vskVk - ek;
            const fmt     = v => Utils.formatCurrency(v);
            const el      = id => document.getElementById(id);

            // Gewinn-Vorschau (rechte Spalte)
            if (el('buch_prev_preis')) el('buch_prev_preis').textContent = fmt(brutto);
            if (el('buch_prev_geb'))   el('buch_prev_geb').textContent   = '− ' + fmt(gebBet);
            if (el('buch_prev_vsk'))   el('buch_prev_vsk').textContent   = '− ' + fmt(vskVk);
            if (el('buch_prev_netto')) {
                el('buch_prev_netto').textContent = fmt(netto);
                el('buch_prev_netto').style.color = netto >= 0 ? 'var(--success)' : 'var(--danger)';
            }

            // Auswahl-Infobar: VP + Gesamtgewinn live anzeigen
            const vpEl = el('buchSelVP');
            const gwEl = el('buchSelGewinn');
            if (vpEl) vpEl.textContent = preis > 0 ? fmt(preis) : '—';
            if (gwEl) {
                if (preis > 0) {
                    gwEl.textContent = fmt(netto);
                    gwEl.style.color = netto >= 0 ? 'var(--success)' : 'var(--danger)';
                } else {
                    gwEl.textContent = '—';
                    gwEl.style.color = 'var(--success)';
                }
            }
        } catch(e) {}
    },

    _saveBuchung() {
        const ids = [...this._buchSelected];
        if (!ids.length) { Utils.showToast('Bitte Artikel auswählen', 'warning'); return; }

        const datum = Utils.getDateInputValue('buch_datum');
        const preis = parseFloat(document.getElementById('buch_preis').value) || 0;
        if (!datum) { Utils.showToast('Bitte Datum angeben (TT.MM.JJJJ)', 'warning'); return; }
        if (preis <= 0) { Utils.showToast('Bitte Verkaufspreis angeben', 'warning'); document.getElementById('buch_preis').focus(); return; }

        const platSel = document.getElementById('buch_plattform');
        let plattform = platSel.value;
        if (plattform === 'Sonstiges') {
            const custom = (document.getElementById('buch_customPlattform') || {}).value?.trim();
            if (custom) { plattform = custom; Store.addPlatform(custom); }
        } else {
            Store.addPlatform(plattform);
        }
        localStorage.setItem('lager_last_platform', plattform);

        const saleData = {
            datum,
            verkaufsplattform:      plattform,
            verkaufspreis:          preis,
            versandkostenKaeufer:   parseFloat(document.getElementById('buch_versandKaeufer').value) || 0,
            plattformgebuehrProzent: parseFloat(document.getElementById('buch_gebuehr').value)       || 0,
            versandkostenVerkaufer:  parseFloat(document.getElementById('buch_versandVk').value)     || 0,
            kaeufer:  (document.getElementById('buch_kaeufer') || {}).value?.trim() || '',
            notizen:  document.getElementById('buch_notizen').value.trim()
        };

        const allPurchases = Store.getPurchases();
        const selected = allPurchases.filter(p => ids.includes(p.id));

        if (selected.length === 1) {
            const p = selected[0];
            saleData.purchaseId   = p.id;
            saleData.marke        = p.marke || '';
            saleData.artikeltyp   = p.artikeltyp || '';
            saleData.groesse      = p.groesse || '';
            saleData.beschreibung = p.beschreibung || '';
            Store.saveSale(saleData);
        } else {
            const marken = [...new Set(selected.map(p => p.marke).filter(Boolean))];
            saleData.purchaseIds  = ids;
            saleData.marke        = marken.join(', ');
            saleData.artikeltyp   = `${selected.length} Artikel`;
            saleData.beschreibung = `Paket: ${selected.map(p => [p.marke,p.artikeltyp,p.groesse].filter(Boolean).join(' ')).join(', ')}`;
            Store.saveSaleMulti(saleData);
        }

        Utils.showToast(`✅ Verkauf gespeichert${selected.length > 1 ? ` (${selected.length} Artikel)` : ''}`, 'success');
        this._buchSelected.clear();
        this._buchSearchTerm = '';

        // Zurück zur Lagerübersicht
        this.switchTab('lager');
        renderPage();
    }
};
// Globalen Zugriff für lager.js sicherstellen (const wird sonst nicht auf window gesetzt)
window.LagerPage = LagerPage;

// ── Seite rendern ─────────────────────────────────────────────────────────
function renderPage() {
    const contentEl = document.getElementById('content');
    contentEl.innerHTML = Lager.render();
    Lager.init();
    updateSidebarBadges();
    updateSidebarActiveFilter();
}

// Zähler in Sidebar aktualisieren
function updateSidebarBadges() {
    try {
        const purchases = Store.getPurchases();
        const counts = {};
        purchases.forEach(p => {
            counts[p.status] = (counts[p.status] || 0) + 1;
        });
        ['verfuegbar','reserviert','verkauft'].forEach(s => {
            const el = document.getElementById('badge_' + s);
            if (el) el.textContent = counts[s] ? counts[s] : '';
        });
    } catch(e) {}
}

// Aktiven Sidebar-Filter hervorheben
function updateSidebarActiveFilter() {
    const currentFilter = Lager._filters.status || '';
    document.querySelectorAll('[data-quick-filter]').forEach(el => {
        el.classList.toggle('active', el.dataset.quickFilter === currentFilter);
    });
}

// ── Schnellfilter aus Sidebar ─────────────────────────────────────────────
// Hilfsfunktion: Buchungen-Tab schließen falls offen, dann Aktion ausführen
function ensureLagerTab() {
    if (LagerPage._currentTab === 'buchungen') {
        LagerPage.switchTab('lager');
    }
}

document.querySelectorAll('[data-quick-filter]').forEach(el => {
    el.addEventListener('click', () => {
        ensureLagerTab(); // Buchungen-Tab schließen wenn aktiv
        Lager._filters.status = el.dataset.quickFilter;
        renderPage();
        // Scroll nach oben
        document.getElementById('mainContent').scrollTop = 0;
    });
});

// ── "Neuer Artikel"-Modal ─────────────────────────────────────────────────
function openNeuArtikelModal() {
    const today      = new Date().toLocaleDateString('sv-SE');
    const brands     = Store.getBrands();
    const brandOpts  = brands.map(b => `<option value="${Utils.escapeHtml(b)}">`).join('');
    const quellen    = Store.getEinkaufsquellen();
    const lastQuelle = localStorage.getItem('lager_last_quelle') || '';
    const kategorien = Store.getWarenkategorien();
    const haendlerListe = Store.getHaendler();

    const body = `
        <div style="display:flex;flex-direction:column;gap:11px;">

            <!-- Foto (kompakt, inline) -->
            <div style="display:flex;align-items:center;gap:12px;">
                <div id="neuFotoPreviewWrap"
                     style="width:52px;height:52px;background:var(--bg-secondary);border-radius:8px;border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;cursor:pointer;"
                     data-action="lgp-foto">📷</div>
                <div>
                    <button class="btn btn-small" type="button" data-action="lgp-foto">📷 Foto wählen</button>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">JPG / PNG · optional</div>
                </div>
                <input type="file" id="neuFotoInput" accept="image/*" style="display:none;">
            </div>

            <!-- Datum + Marke -->
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Datum *</label>
                    <input type="date" class="form-input" id="neu_datum" value="${today}">
                </div>
                <div class="form-group">
                    <label class="form-label">Marke *</label>
                    <input type="text" class="form-input" id="neu_marke" list="neuMarkenList" placeholder="Nike, Adidas …" autocomplete="off">
                    <datalist id="neuMarkenList">${brandOpts}</datalist>
                </div>
            </div>

            <!-- Artikeltyp + Größe -->
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Artikeltyp</label>
                    <select class="form-select" id="neu_artikeltyp">
                        ${['Jacke','Hose','Shirt','Hoodie','Schuhe','Accessoire','Sonstiges'].map(t => `<option>${t}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Größe</label>
                    <input type="text" class="form-input" id="neu_groesse" placeholder="M, L, 42 …">
                </div>
            </div>

            <!-- Beschreibung + Tags (2 Spalten) -->
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Beschreibung</label>
                    <input type="text" class="form-input" id="neu_beschreibung" placeholder="z.B. Colorway, Modellname …">
                </div>
                <div class="form-group">
                    <label class="form-label">Tags <span style="color:var(--text-muted);font-weight:400;">(kommagetrennt)</span></label>
                    <input type="text" class="form-input" id="neu_tags" placeholder="z.B. Vintage, Nike …" autocomplete="off">
                </div>
            </div>

            <!-- Kategorie + Zielgruppe -->
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Kategorie</label>
                    <select class="form-select" id="neu_kategorie">
                        <option value="">– keine –</option>
                        ${kategorien.map(k => `<option value="${Utils.escapeHtml(k)}">${Utils.escapeHtml(k)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Zielgruppe</label>
                    <select class="form-select" id="neu_zielgruppe">
                        <option value="">– keine –</option>
                        ${Store.ZIELGRUPPEN.map(z => `<option value="${z}">${z}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Lieferant/Händler -->
            <div class="form-group">
                <label class="form-label">Lieferant/Händler <span style="color:var(--text-muted);font-weight:400;">(optional)</span></label>
                <select class="form-select" id="neu_haendler">
                    <option value="">– keiner –</option>
                    ${haendlerListe.map(h => `<option value="${Utils.escapeHtml(h)}">${Utils.escapeHtml(h)}</option>`).join('')}
                    <option value="Sonstiges">Sonstiges …</option>
                </select>
                <div id="neu_customHaendlerGroup" style="display:none;margin-top:6px;">
                    <input type="text" class="form-input" id="neu_customHaendler" placeholder="Name eingeben...">
                </div>
            </div>

            <!-- EK-Preis + Einkaufsquelle -->
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">EK-Preis (€) *</label>
                    <input type="number" step="0.01" min="0" class="form-input" id="neu_preis"
                           placeholder="0,00" style="font-size:18px;font-weight:700;">
                </div>
                <div class="form-group">
                    <label class="form-label">Einkaufsquelle</label>
                    <select class="form-select" id="neu_quelle">
                        ${quellen.map(q => `<option value="${Utils.escapeHtml(q)}" ${q === lastQuelle ? 'selected' : ''}>${Utils.escapeHtml(q)}</option>`).join('')}
                    </select>
                </div>
            </div>

            <!-- Artikelnummer (optional, sonst automatisch JAHR-NNN) -->
            <div class="form-group">
                <label class="form-label">Artikelnummer <span style="color:var(--text-muted);font-weight:400;">(optional, sonst automatisch)</span></label>
                <input type="text" class="form-input" id="neu_artikelnr" placeholder="z.B. 2026-042" autocomplete="off">
            </div>

            <!-- Differenzbesteuerung §25a UStG -->
            <div class="form-group">
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;font-weight:400;">
                    <input type="checkbox" id="neu_differenzbesteuert">
                    Ohne Vorsteuerabzug erworben (z.B. von Privatperson) — Differenzbesteuerung §25a möglich
                </label>
                <div id="neu_warenart_wrap" style="display:none;margin-top:8px;">
                    <label class="form-label">Warenart (§25a)</label>
                    <select class="form-select" id="neu_warenart">
                        <option value="gebraucht">Gebrauchtgegenstände</option>
                        <option value="kunst">Kunstgegenstände</option>
                        <option value="sammlerstueck">Sammlungsstücke und Antiquitäten</option>
                    </select>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Stackr rechnet die Marge v1 pauschal mit 19% USt. Bei bestimmten Kunstgegenständen/Sammlerstücken/Einfuhren kann nach §25a Abs. 3 UStG i.V.m. Anlage 2 UStG auch 7% gelten — bitte im Zweifel mit deinem Steuerberater klären.</div>
                </div>
            </div>

            <!-- Lagerort + Notizen (einklappbar) -->
            <details style="border:1px solid var(--border);border-radius:8px;">
                <summary style="padding:10px 14px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text-secondary);list-style:none;display:flex;align-items:center;gap:6px;">
                    📍 Lagerort &amp; Notizen <span style="font-weight:400;color:var(--text-muted);">&nbsp;(optional)</span>
                </summary>
                <div style="padding:12px 14px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:10px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                        <div>
                            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Bereich</label>
                            <input type="text" class="form-input" id="neu_lo_bereich" placeholder="z.B. A">
                        </div>
                        <div>
                            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Regal</label>
                            <input type="text" class="form-input" id="neu_lo_regal" placeholder="z.B. R2">
                        </div>
                        <div>
                            <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Fach</label>
                            <input type="text" class="form-input" id="neu_lo_fach" placeholder="z.B. F3">
                        </div>
                    </div>
                    <div>
                        <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Notizen</label>
                        <textarea class="form-textarea" id="neu_notizen" rows="2" placeholder="Zustand, Besonderheiten …" style="font-size:13px;"></textarea>
                    </div>
                </div>
            </details>
        </div>
    `;

    const footer = `
        <button class="btn" data-action="close-modal">Abbrechen</button>
        <button class="btn btn-primary" id="saveNeuArtikel" style="min-width:130px;">💾 Speichern</button>
    `;

    App.showModal('Neuer Artikel', body, footer);

    // Foto-Logik
    let neuFotoBase64 = null;
    document.getElementById('neuFotoInput').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        // Validierung: Typ + Größe (max 15 MB)
        if (!file.type || !file.type.startsWith('image/')) {
            Utils.showToast('⚠️ Datei ist kein Bild (' + (file.type || 'unbekannt') + ')', 'warning');
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            Utils.showToast('⚠️ Bild zu groß (' + (file.size/1024/1024).toFixed(1) + ' MB · max 15 MB)', 'warning');
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => Utils.showToast('Datei konnte nicht gelesen werden', 'error');
        reader.onload = ev => {
            const img = new Image();
            img.onerror = () => Utils.showToast('Bild konnte nicht decodiert werden', 'error');
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 800;
                let w = img.width, h = img.height;
                if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
                else if (h > MAX)     { w = Math.round(w * MAX / h); h = MAX; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                neuFotoBase64 = canvas.toDataURL('image/jpeg', 0.78);
                const wrap = document.getElementById('neuFotoPreviewWrap');
                wrap.innerHTML = `<img src="${neuFotoBase64}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`;
                wrap.style.border = 'none';
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });

    // Differenzbesteuerung §25a: Warenart-Auswahl nur bei aktivem Haken zeigen
    const neuDiffCheckbox = document.getElementById('neu_differenzbesteuert');
    const neuWarenartWrap = document.getElementById('neu_warenart_wrap');
    if (neuDiffCheckbox && neuWarenartWrap) {
        neuDiffCheckbox.addEventListener('change', () => {
            neuWarenartWrap.style.display = neuDiffCheckbox.checked ? '' : 'none';
        });
    }

    // Händler "Sonstiges" toggle
    const neuHaendlerSelect = document.getElementById('neu_haendler');
    const neuCustomHaendlerGroup = document.getElementById('neu_customHaendlerGroup');
    if (neuHaendlerSelect && neuCustomHaendlerGroup) {
        neuHaendlerSelect.addEventListener('change', () => {
            neuCustomHaendlerGroup.style.display = neuHaendlerSelect.value === 'Sonstiges' ? '' : 'none';
        });
    }

    // Speichern
    document.getElementById('saveNeuArtikel').addEventListener('click', () => {
        const marke  = document.getElementById('neu_marke').value.trim();
        const preis  = parseFloat(document.getElementById('neu_preis').value);
        const datum  = Utils.getDateInputValue('neu_datum');
        const beschr = document.getElementById('neu_beschreibung').value.trim();

        if (!datum) {
            Utils.showToast('Bitte Datum eingeben (TT.MM.JJJJ)', 'warning');
            document.getElementById('neu_datum').focus();
            return;
        }
        if (!marke && !beschr) {
            Utils.showToast('Bitte mindestens Marke oder Beschreibung angeben', 'warning');
            document.getElementById('neu_marke').focus();
            return;
        }
        if (isNaN(preis) || preis < 0) {
            Utils.showToast('Bitte gültigen EK-Preis eingeben', 'warning');
            document.getElementById('neu_preis').focus();
            return;
        }

        const quelle = document.getElementById('neu_quelle').value;
        if (marke) Store.addBrand(marke);
        Store.addEinkaufsquelle(quelle);
        localStorage.setItem('lager_last_quelle', quelle);

        const rawTags = document.getElementById('neu_tags')?.value || '';
        const tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
        const artikelNr = (document.getElementById('neu_artikelnr')?.value || '').trim();

        let haendler = (neuHaendlerSelect || {}).value || '';
        if (haendler === 'Sonstiges') {
            const customH = (document.getElementById('neu_customHaendler') || {}).value?.trim();
            haendler = customH || '';
            if (customH) Store.addHaendler(customH);
        }

        const purchase = {
            datum,
            marke,
            artikeltyp:    document.getElementById('neu_artikeltyp').value,
            groesse:       document.getElementById('neu_groesse').value.trim(),
            beschreibung:  beschr,
            einkaufspreis: preis,
            anzahl:        1,
            einkaufsquelle: quelle,
            warenkategorie: document.getElementById('neu_kategorie')?.value || '',
            zielgruppe:     document.getElementById('neu_zielgruppe')?.value || '',
            haendler,
            notizen:       document.getElementById('neu_notizen').value.trim(),
            tags,
            status:        'verfuegbar',
            differenzbesteuert: neuDiffCheckbox?.checked || false,
            warenart:      neuDiffCheckbox?.checked ? document.getElementById('neu_warenart').value : undefined,
            lagerort: {
                bereich: (document.getElementById('neu_lo_bereich') || {}).value?.trim() || '',
                regal:   (document.getElementById('neu_lo_regal')   || {}).value?.trim() || '',
                fach:    (document.getElementById('neu_lo_fach')    || {}).value?.trim() || ''
            }
        };
        if (neuFotoBase64) purchase.foto = neuFotoBase64;
        if (artikelNr) purchase.artikelNr = artikelNr;

        Store.savePurchase(purchase);
        App.closeModal();
        Utils.showToast('✅ Artikel gespeichert · EÜR aktualisiert', 'success');

        // Filter auf "Verfügbar" setzen damit neuer Artikel sofort sichtbar ist
        Lager._filters.status = 'verfuegbar';
        renderPage();
        document.getElementById('mainContent').scrollTop = 0;
    });
}

// ── Kategorien verwalten (anlegen/umbenennen/löschen) ──────────────────────
function openKategorienModal() {
    const render = () => {
        const kategorien = Store.getWarenkategorien();
        const body = `
            <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;">
                ${kategorien.map(k => `
                    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;">
                        <span style="flex:1;font-size:13px;">${Utils.escapeHtml(k)}</span>
                        <button class="btn btn-small" data-kat-rename="${Utils.escapeHtml(k)}" title="Umbenennen">✏️</button>
                        <button class="btn btn-small btn-danger" data-kat-delete="${Utils.escapeHtml(k)}" title="Löschen">🗑</button>
                    </div>
                `).join('') || '<div style="font-size:13px;color:var(--text-muted);">Keine Kategorien angelegt</div>'}
            </div>
            <div style="display:flex;gap:8px;">
                <input type="text" class="form-input" id="katNeuInput" placeholder="Neue Kategorie …" style="flex:1;">
                <button class="btn btn-primary" id="katNeuBtn">+ Hinzufügen</button>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:10px;">Löschen entfernt die Kategorie nur aus der Auswahlliste — bereits zugeordnete Artikel behalten ihre Kategorie-Angabe.</div>
        `;
        const footer = `<button class="btn btn-primary" id="katModalCloseBtn">Fertig</button>`;
        App.showModal('🏷️ Kategorien verwalten', body, footer);
        document.getElementById('katModalCloseBtn').addEventListener('click', () => {
            App.closeModal();
            renderPage();
        });

        document.querySelectorAll('[data-kat-rename]').forEach(btn => {
            btn.addEventListener('click', () => {
                const alt = btn.dataset.katRename;
                const neu = prompt('Neuer Name für Kategorie „' + alt + '":', alt);
                if (!neu || !neu.trim() || neu.trim() === alt) return;
                Store.renameWarenkategorie(alt, neu.trim());
                Utils.showToast('Kategorie umbenannt', 'success');
                render();
            });
        });
        document.querySelectorAll('[data-kat-delete]').forEach(btn => {
            btn.addEventListener('click', () => {
                const kat = btn.dataset.katDelete;
                if (!confirm('Kategorie „' + kat + '" aus der Auswahlliste entfernen?')) return;
                Store.deleteWarenkategorie(kat);
                Utils.showToast('Kategorie entfernt', 'success');
                render();
            });
        });
        document.getElementById('katNeuBtn').addEventListener('click', () => {
            const input = document.getElementById('katNeuInput');
            const val = input.value.trim();
            if (!val) return;
            Store.addWarenkategorie(val);
            Utils.showToast('Kategorie hinzugefügt', 'success');
            render();
        });
    };
    render();
}

// ── Bulk-Einkauf ──────────────────────────────────────────────────────────
let _bulkRows   = [];
let _bulkPhotos = {};   // rowId → base64
let _bulkRowCtr = 0;

function _bulkNewRow(template) {
    return {
        id:           ++_bulkRowCtr,
        marke:        (template && template.marke)        || '',
        artikeltyp:   (template && template.artikeltyp)   || 'Jacke',
        groesse:      (template && template.groesse)      || '',
        beschreibung: (template && template.beschreibung) || '',
        einkaufspreis:(template && template.einkaufspreis)|| '',
        anzahl:       (template && template.anzahl)       || 1,
        artikelNr:    ''   // optional, manuell — leer = automatisch JAHR-NNN, nie von Duplizieren übernommen
    };
}

function openBulkArtikelModal() {
    _bulkRows   = [_bulkNewRow()];
    _bulkPhotos = {};

    const today      = new Date().toLocaleDateString('sv-SE');
    const quellen    = Store.getEinkaufsquellen();
    const lastQuelle = localStorage.getItem('lager_last_quelle') || '';
    const brands     = Store.getBrands();
    const brandOpts  = brands.map(b => `<option value="${Utils.escapeHtml(b)}">`).join('');
    const kategorien = Store.getWarenkategorien();
    const haendlerListe = Store.getHaendler();

    const body = `
        <datalist id="bulkMarkenList">${brandOpts}</datalist>

        <!-- Gemeinsame Felder -->
        <div class="form-row" style="margin-bottom:14px;">
            <div class="form-group">
                <label class="form-label">Datum *</label>
                <input type="date" class="form-input" id="bulk_datum" value="${today}">
            </div>
            <div class="form-group">
                <label class="form-label">Einkaufsquelle</label>
                <select class="form-select" id="bulk_quelle">
                    ${quellen.map(q => `<option value="${Utils.escapeHtml(q)}" ${q === lastQuelle ? 'selected' : ''}>${Utils.escapeHtml(q)}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="form-row" style="margin-bottom:14px;">
            <div class="form-group">
                <label class="form-label">Kategorie <span style="color:var(--text-muted);font-weight:400;">(für alle Zeilen)</span></label>
                <select class="form-select" id="bulk_kategorie">
                    <option value="">– keine –</option>
                    ${kategorien.map(k => `<option value="${Utils.escapeHtml(k)}">${Utils.escapeHtml(k)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Zielgruppe <span style="color:var(--text-muted);font-weight:400;">(für alle Zeilen)</span></label>
                <select class="form-select" id="bulk_zielgruppe">
                    <option value="">– keine –</option>
                    ${Store.ZIELGRUPPEN.map(z => `<option value="${z}">${z}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label">Lieferant/Händler <span style="color:var(--text-muted);font-weight:400;">(optional, für alle Zeilen)</span></label>
            <select class="form-select" id="bulk_haendler">
                <option value="">– keiner –</option>
                ${haendlerListe.map(h => `<option value="${Utils.escapeHtml(h)}">${Utils.escapeHtml(h)}</option>`).join('')}
                <option value="Sonstiges">Sonstiges …</option>
            </select>
            <div id="bulk_customHaendlerGroup" style="display:none;margin-top:6px;">
                <input type="text" class="form-input" id="bulk_customHaendler" placeholder="Name eingeben...">
            </div>
        </div>

        <!-- Lagerort gemeinsam -->
        <details style="border:1px solid var(--border);border-radius:8px;margin-bottom:14px;">
            <summary style="padding:9px 14px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text-secondary);list-style:none;display:flex;align-items:center;gap:6px;">
                📍 Lagerort für alle <span style="font-weight:400;color:var(--text-muted);">&nbsp;(optional)</span>
            </summary>
            <div style="padding:12px 14px;border-top:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                <div>
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Bereich</label>
                    <input type="text" class="form-input" id="bulk_lo_bereich" placeholder="z.B. A">
                </div>
                <div>
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Regal</label>
                    <input type="text" class="form-input" id="bulk_lo_regal" placeholder="z.B. R2">
                </div>
                <div>
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Fach</label>
                    <input type="text" class="form-input" id="bulk_lo_fach" placeholder="z.B. F3">
                </div>
            </div>
        </details>

        <!-- MwSt + Versandkosten -->
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:14px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;">💶 Kosten-Aufschläge <span style="font-weight:400;color:var(--text-muted);">(gelten für alle Artikel dieser Session)</span></div>
            <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-end;">

                <!-- Versandkosten -->
                <div>
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Versandkosten gesamt (€)</label>
                    <input type="number" step="0.01" min="0" class="form-input" id="bulk_versand" value="0"
                           style="width:130px;font-size:14px;" data-action-input="lgp-bulk-summary">
                </div>

                <!-- MwSt -->
                <div>
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Mehrwertsteuer</label>
                    <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;">
                        <button type="button" class="btn btn-small" id="bmwst_0"
                                data-action="lgp-bulk-mwst" data-args='[0]' 
                                style="background:var(--accent);color:#fff;border-color:var(--accent);">0%</button>
                        <button type="button" class="btn btn-small" id="bmwst_7"
                                data-action="lgp-bulk-mwst" data-args='[7]' >7%</button>
                        <button type="button" class="btn btn-small" id="bmwst_19"
                                data-action="lgp-bulk-mwst" data-args='[19]' >19%</button>
                        <input type="number" step="0.1" min="0" max="100" class="form-input"
                               id="bulk_mwst_custom" placeholder="eigener %"
                               style="width:90px;font-size:13px;"
                               data-action-input="lgp-bulk-mwst-custom">
                    </div>
                    <input type="hidden" id="bulk_mwst_value" value="0">
                </div>

                <!-- Info-Text -->
                <div style="font-size:11px;color:var(--text-muted);padding-bottom:2px;max-width:240px;line-height:1.4;">
                    EK-Preis im Lager = <strong style="color:var(--text-secondary);">Brutto</strong><br>
                    (Netto + Versandanteil) × (1 + MwSt)
                </div>
            </div>
        </div>

        <!-- Artikel-Tabelle -->
        <div class="bulk-table-wrap" style="overflow-x:auto;margin-bottom:10px;-webkit-overflow-scrolling:touch;">
            <table class="bulk-table" style="width:100%;border-collapse:collapse;min-width:560px;">
                <thead>
                    <tr style="border-bottom:2px solid var(--border);">
                        <th style="padding:5px 6px;font-size:11px;color:var(--text-muted);font-weight:600;width:46px;">Foto</th>
                        <th style="padding:5px 6px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;">Marke</th>
                        <th style="padding:5px 6px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;">Typ</th>
                        <th style="padding:5px 6px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;">Größe</th>
                        <th style="padding:5px 6px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;">Beschreibung</th>
                        <th style="padding:5px 6px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:right;" title="Netto-Einkaufspreis pro Stück (ohne MwSt, ohne Versand)">EK Netto (€)</th>
                        <th style="padding:5px 6px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:center;">Anzahl</th>
                        <th style="padding:5px 6px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;" title="Optional, sonst automatisch JAHR-NNN. Bei Anzahl &gt; 1 wird -1, -2 … angehängt.">Art.-Nr.</th>
                        <th style="width:72px;"></th>
                    </tr>
                </thead>
                <tbody id="bulkArtikelBody"></tbody>
            </table>
        </div>

        <button class="btn btn-small" id="bulkAddRowBtn" style="margin-bottom:14px;">+ Zeile hinzufügen</button>

        <!-- Zusammenfassung -->
        <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:13px;margin-bottom:12px;">
            <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;margin-bottom:6px;">
                <span>Typen: <strong id="bulkSumTypes">—</strong></span>
                <span>Artikel gesamt: <strong id="bulkSumTotal">—</strong></span>
            </div>
            <div style="display:flex;gap:0;flex-direction:column;font-size:12px;">
                <div style="display:flex;gap:6px;align-items:center;color:var(--text-secondary);">
                    <span style="width:160px;">Netto-EK gesamt:</span>
                    <strong id="bulkSumNetto" style="color:var(--text-primary);">—</strong>
                </div>
                <div id="bulkSumVersandRow" style="display:flex;gap:6px;align-items:center;color:var(--text-secondary);">
                    <span style="width:160px;">+ Versandkosten:</span>
                    <strong id="bulkSumVersand" style="color:var(--text-primary);">—</strong>
                </div>
                <div id="bulkSumMwstRow" style="display:flex;gap:6px;align-items:center;color:var(--text-secondary);">
                    <span style="width:160px;" id="bulkSumMwstLabel">+ MwSt (0%):</span>
                    <strong id="bulkSumMwst" style="color:var(--text-primary);">—</strong>
                </div>
                <div style="display:flex;gap:6px;align-items:center;margin-top:5px;padding-top:6px;border-top:1px solid var(--border);">
                    <span style="width:160px;font-weight:700;">= Brutto-EK gesamt:</span>
                    <strong id="bulkSumBrutto" style="color:var(--accent);font-size:15px;">—</strong>
                    <span id="bulkSumBruttoPerPiece" style="color:var(--text-muted);font-size:11px;margin-left:6px;"></span>
                </div>
            </div>
        </div>

        <!-- GoBD-Hinweis -->
        <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text-secondary);display:flex;gap:8px;align-items:flex-start;">
            <span style="font-size:15px;flex-shrink:0;">✅</span>
            <span>Jedes Exemplar wird als <strong>eigener Eintrag</strong> angelegt (GoBD-konform &amp; einzeln verkaufbar). Alle Artikel dieser Session sind im Lager als <em>Bulk</em> erkennbar.</span>
        </div>
    `;

    const footer = `
        <button class="btn" data-action="close-modal">Abbrechen</button>
        <button class="btn btn-primary" id="bulkSaveBtn" style="min-width:180px;">💾 Alle anlegen</button>
    `;

    App.showModal('📦 Bulk-Einkauf', body, footer);

    // Händler "Sonstiges" toggle
    const bulkHaendlerSelect = document.getElementById('bulk_haendler');
    const bulkCustomHaendlerGroup = document.getElementById('bulk_customHaendlerGroup');
    if (bulkHaendlerSelect && bulkCustomHaendlerGroup) {
        bulkHaendlerSelect.addEventListener('change', () => {
            bulkCustomHaendlerGroup.style.display = bulkHaendlerSelect.value === 'Sonstiges' ? '' : 'none';
        });
    }

    _renderBulkRows();
    _updateBulkSummary();

    document.getElementById('bulkAddRowBtn').addEventListener('click', () => {
        _bulkSaveRowValues();
        _bulkRows.push(_bulkNewRow());
        _renderBulkRows();
        _updateBulkSummary();
        const tbody = document.getElementById('bulkArtikelBody');
        if (tbody && tbody.lastElementChild) {
            tbody.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            // Focus first input of new row
            const firstInput = tbody.lastElementChild.querySelector('input[type="text"]');
            if (firstInput) setTimeout(() => firstInput.focus(), 50);
        }
    });

    document.getElementById('bulkSaveBtn').addEventListener('click', _saveBulkArtikel);
}

// Werte aus DOM in _bulkRows übertragen (vor Re-Render / Speichern)
function _bulkSaveRowValues() {
    _bulkRows.forEach(row => {
        const g = id => document.getElementById(id);
        if (g(`bulk_marke_${row.id}`))    row.marke        = g(`bulk_marke_${row.id}`).value.trim();
        if (g(`bulk_typ_${row.id}`))      row.artikeltyp   = g(`bulk_typ_${row.id}`).value;
        if (g(`bulk_groesse_${row.id}`))  row.groesse      = g(`bulk_groesse_${row.id}`).value.trim();
        if (g(`bulk_beschr_${row.id}`))   row.beschreibung = g(`bulk_beschr_${row.id}`).value.trim();
        if (g(`bulk_preis_${row.id}`))    row.einkaufspreis= g(`bulk_preis_${row.id}`).value;
        if (g(`bulk_anzahl_${row.id}`))   row.anzahl       = parseInt(g(`bulk_anzahl_${row.id}`).value) || 1;
        if (g(`bulk_artikelnr_${row.id}`))row.artikelNr    = g(`bulk_artikelnr_${row.id}`).value.trim();
    });
}

function _renderBulkRows() {
    const tbody = document.getElementById('bulkArtikelBody');
    if (!tbody) return;
    const TYPES = ['Jacke','Hose','Shirt','Hoodie','Schuhe','Accessoire','Sonstiges'];
    const onlyOne = _bulkRows.length === 1;

    tbody.innerHTML = _bulkRows.map(row => {
        const foto = _bulkPhotos[row.id];
        const photoHtml = foto
            ? `<img id="bulkPh_${row.id}" src="${foto}"
                    style="width:40px;height:40px;object-fit:cover;border-radius:4px;cursor:pointer;vertical-align:middle;"
                    title="Klicken zum Ändern">`
            : `<div id="bulkPh_${row.id}"
                    style="width:40px;height:40px;background:var(--bg-secondary);border-radius:4px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;"
                    title="Foto hinzufügen">📷</div>`;

        // Speicher-Schätzung wenn viele Artikel + Foto
        const anzVal = parseInt(row.anzahl) || 1;
        const storageHint = foto && anzVal > 5
            ? `<div style="font-size:9px;color:var(--text-muted);text-align:center;margin-top:1px;">~${Math.round(foto.length * 0.75 / 1024 * anzVal)}KB</div>`
            : '';

        return `
        <tr style="border-bottom:1px solid var(--border);" data-row-id="${row.id}">
            <td style="padding:5px 6px;vertical-align:middle;">
                ${photoHtml}
                ${storageHint}
                <input type="file" id="bulkPhInput_${row.id}" accept="image/*" style="display:none;">
            </td>
            <td style="padding:5px 6px;">
                <input type="text" class="form-input" id="bulk_marke_${row.id}"
                       list="bulkMarkenList"
                       value="${Utils.escapeHtml(row.marke)}" placeholder="Marke"
                       style="font-size:13px;padding:5px 8px;min-width:90px;" autocomplete="off">
            </td>
            <td style="padding:5px 6px;">
                <select class="form-select" id="bulk_typ_${row.id}"
                        style="font-size:13px;padding:5px 8px;min-width:90px;">
                    ${TYPES.map(t => `<option${row.artikeltyp===t?' selected':''}>${t}</option>`).join('')}
                </select>
            </td>
            <td style="padding:5px 6px;">
                <input type="text" class="form-input" id="bulk_groesse_${row.id}"
                       value="${Utils.escapeHtml(row.groesse)}" placeholder="M, 42…"
                       style="font-size:13px;padding:5px 8px;width:62px;">
            </td>
            <td style="padding:5px 6px;">
                <input type="text" class="form-input" id="bulk_beschr_${row.id}"
                       value="${Utils.escapeHtml(row.beschreibung)}" placeholder="Beschreibung"
                       style="font-size:13px;padding:5px 8px;min-width:110px;">
            </td>
            <td style="padding:5px 6px;">
                <input type="number" step="0.01" min="0" class="form-input" id="bulk_preis_${row.id}"
                       value="${row.einkaufspreis}" placeholder="0,00"
                       style="font-size:14px;font-weight:700;padding:5px 8px;width:86px;text-align:right;"
                       data-action-input="lgp-bulk-summary">
            </td>
            <td style="padding:5px 6px;text-align:center;">
                <input type="number" min="1" max="9999" class="form-input" id="bulk_anzahl_${row.id}"
                       value="${row.anzahl}"
                       style="font-size:14px;font-weight:700;padding:5px 8px;width:68px;text-align:center;"
                       data-action-input="lgp-bulk-summary">
            </td>
            <td style="padding:5px 6px;">
                <input type="text" class="form-input" id="bulk_artikelnr_${row.id}"
                       value="${Utils.escapeHtml(row.artikelNr || '')}" placeholder="Auto"
                       style="font-size:13px;padding:5px 8px;width:90px;">
            </td>
            <td style="padding:5px 6px;">
                <div style="display:flex;gap:3px;">
                    <button class="btn btn-small" title="Zeile duplizieren"
                            data-action="lgp-bulk-dup" data-args='[${row.id}]' >↻</button>
                    <button class="btn btn-small btn-danger" title="Zeile löschen"
                            data-action="lgp-bulk-del" data-args='[${row.id}]'  ${onlyOne ? 'disabled' : ''}>🗑</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // Foto-Klick + Upload für jede Zeile verdrahten
    _bulkRows.forEach(row => {
        const phEl    = document.getElementById(`bulkPh_${row.id}`);
        const inputEl = document.getElementById(`bulkPhInput_${row.id}`);
        if (!phEl || !inputEl) return;

        phEl.addEventListener('click', () => inputEl.click());

        inputEl.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            // Validierung
            if (!file.type || !file.type.startsWith('image/')) {
                Utils.showToast('⚠️ Datei ist kein Bild', 'warning'); return;
            }
            if (file.size > 15 * 1024 * 1024) {
                Utils.showToast('⚠️ Bild zu groß (' + (file.size/1024/1024).toFixed(1) + ' MB · max 15 MB)', 'warning'); return;
            }
            const reader = new FileReader();
            reader.onerror = () => Utils.showToast('Datei konnte nicht gelesen werden', 'error');
            reader.onload = ev => {
                const img = new Image();
                img.onerror = () => Utils.showToast('Bild konnte nicht decodiert werden', 'error');
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX = 400; // Kleinere Größe für Bulk (Speicher)
                    let w = img.width, h = img.height;
                    if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
                    else if (h > MAX)     { w = Math.round(w * MAX / h); h = MAX; }
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    _bulkPhotos[row.id] = canvas.toDataURL('image/jpeg', 0.5);

                    // Vorschau aktualisieren (ohne Re-Render der ganzen Tabelle)
                    const currentPh = document.getElementById(`bulkPh_${row.id}`);
                    if (currentPh) {
                        const newImg = document.createElement('img');
                        newImg.id    = `bulkPh_${row.id}`;
                        newImg.src   = _bulkPhotos[row.id];
                        newImg.style.cssText = 'width:40px;height:40px;object-fit:cover;border-radius:4px;cursor:pointer;vertical-align:middle;';
                        newImg.title = 'Klicken zum Ändern';
                        newImg.addEventListener('click', () => inputEl.click());
                        currentPh.replaceWith(newImg);
                    }
                    _updateBulkSummary(); // Speicher-Hinweis aktualisieren
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    });
}

// MwSt-Button Schnellauswahl
function _setBulkMwst(val) {
    const hidden = document.getElementById('bulk_mwst_value');
    if (hidden) hidden.value = val;
    const custom = document.getElementById('bulk_mwst_custom');
    if (custom) custom.value = '';
    [0, 7, 19].forEach(v => {
        const btn = document.getElementById(`bmwst_${v}`);
        if (!btn) return;
        if (v === val) {
            btn.style.background    = 'var(--accent)';
            btn.style.color         = '#fff';
            btn.style.borderColor   = 'var(--accent)';
        } else {
            btn.style.background    = '';
            btn.style.color         = '';
            btn.style.borderColor   = '';
        }
    });
    _updateBulkSummary();
}

// Eigener MwSt-Wert
function _onBulkMwstCustom() {
    const custom = document.getElementById('bulk_mwst_custom');
    const val = custom ? parseFloat(custom.value) : NaN;
    const hidden = document.getElementById('bulk_mwst_value');
    if (!isNaN(val) && val >= 0) {
        if (hidden) hidden.value = val;
        // Schnellauswahl-Buttons deaktivieren
        [0, 7, 19].forEach(v => {
            const btn = document.getElementById(`bmwst_${v}`);
            if (btn) { btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
        });
    }
    _updateBulkSummary();
}

function _updateBulkSummary() {
    const g = id => document.getElementById(id);
    let totalArticles = 0;
    let totalNetto    = 0;

    _bulkRows.forEach(row => {
        const anzahl = parseInt((g(`bulk_anzahl_${row.id}`) || {}).value) || parseInt(row.anzahl) || 1;
        const preis  = parseFloat((g(`bulk_preis_${row.id}`) || {}).value) || parseFloat(row.einkaufspreis) || 0;
        totalArticles += anzahl;
        totalNetto    += preis * anzahl;
    });

    const versand = Math.max(0, parseFloat((g('bulk_versand') || {}).value) || 0);
    const mwst    = Math.max(0, parseFloat((g('bulk_mwst_value') || {}).value) || 0);

    const base      = totalNetto + versand;
    const mwstBetrag = base * mwst / 100;
    const brutto    = base + mwstBetrag;
    const bruttoProStk = totalArticles > 0 ? brutto / totalArticles : 0;

    if (g('bulkSumTypes'))         g('bulkSumTypes').textContent       = _bulkRows.length;
    if (g('bulkSumTotal'))         g('bulkSumTotal').textContent       = totalArticles;
    if (g('bulkSumNetto'))         g('bulkSumNetto').textContent       = Utils.formatCurrency(totalNetto);
    if (g('bulkSumVersand'))       g('bulkSumVersand').textContent     = versand > 0 ? Utils.formatCurrency(versand) : '—';
    if (g('bulkSumMwstLabel'))     g('bulkSumMwstLabel').textContent   = `+ MwSt (${mwst}%):`;
    if (g('bulkSumMwst'))          g('bulkSumMwst').textContent        = mwst > 0 ? Utils.formatCurrency(mwstBetrag) : '—';
    if (g('bulkSumBrutto'))        g('bulkSumBrutto').textContent      = Utils.formatCurrency(brutto);
    if (g('bulkSumBruttoPerPiece'))g('bulkSumBruttoPerPiece').textContent =
        totalArticles > 1 ? `(Ø ${Utils.formatCurrency(bruttoProStk)} / Stk)` : '';
    if (g('bulkSaveBtn'))          g('bulkSaveBtn').textContent        = `💾 Alle anlegen (${totalArticles} Artikel)`;
}

function _bulkDuplicateRow(rowId) {
    _bulkSaveRowValues();
    const original = _bulkRows.find(r => r.id === rowId);
    if (!original) return;
    const newRow = _bulkNewRow(original);
    if (_bulkPhotos[rowId]) _bulkPhotos[newRow.id] = _bulkPhotos[rowId]; // Foto mitkopieren
    const idx = _bulkRows.findIndex(r => r.id === rowId);
    _bulkRows.splice(idx + 1, 0, newRow);
    _renderBulkRows();
    _updateBulkSummary();
}

function _bulkDeleteRow(rowId) {
    if (_bulkRows.length <= 1) return;
    _bulkSaveRowValues();
    _bulkRows = _bulkRows.filter(r => r.id !== rowId);
    delete _bulkPhotos[rowId];
    _renderBulkRows();
    _updateBulkSummary();
}

function _saveBulkArtikel() {
    _bulkSaveRowValues();

    const datum   = (document.getElementById('bulk_datum')      || {}).value || '';
    const quelle  = (document.getElementById('bulk_quelle')     || {}).value || '';
    const kategorie   = (document.getElementById('bulk_kategorie')  || {}).value || '';
    const zielgruppe  = (document.getElementById('bulk_zielgruppe') || {}).value || '';
    let haendler = (document.getElementById('bulk_haendler') || {}).value || '';
    if (haendler === 'Sonstiges') {
        const customH = (document.getElementById('bulk_customHaendler') || {}).value?.trim();
        haendler = customH || '';
        if (customH) Store.addHaendler(customH);
    }
    const loB     = (document.getElementById('bulk_lo_bereich') || {}).value?.trim() || '';
    const loR     = (document.getElementById('bulk_lo_regal')   || {}).value?.trim() || '';
    const loF     = (document.getElementById('bulk_lo_fach')    || {}).value?.trim() || '';
    const versandGesamt = Math.max(0, parseFloat((document.getElementById('bulk_versand') || {}).value) || 0);
    const mwstSatz      = Math.max(0, parseFloat((document.getElementById('bulk_mwst_value') || {}).value) || 0);

    if (!datum) { Utils.showToast('Bitte Datum angeben', 'warning'); return; }

    // Zeilen validieren
    const validRows = _bulkRows.filter(row => {
        const preis = parseFloat(row.einkaufspreis);
        return (row.marke || row.beschreibung) && !isNaN(preis) && preis >= 0;
    });
    if (validRows.length === 0) {
        Utils.showToast('Mindestens eine Zeile mit Marke/Beschreibung und Preis ausfüllen', 'warning');
        return;
    }

    const totalToCreate = validRows.reduce((s, r) => s + (parseInt(r.anzahl) || 1), 0);

    // Button sperren
    const saveBtn = document.getElementById('bulkSaveBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Wird gespeichert…'; }

    // Batch-Speicherung (async — wartet auf IDB-Bestätigung)
    setTimeout(async () => {
        try {
            // Session-ID für diese Bulk-Gruppe
            const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

            // Alle bestehenden Käufe laden (für Artikel-Nr-Vergabe)
            const existing = Store.getAllPurchasesRaw ? Store.getAllPurchasesRaw() : [];

            // Höchste laufende Artikelnummern pro Jahr ermitteln
            const yearMax = {};
            existing.forEach(p => {
                const m = (p.artikelNr || '').match(/^(\d{4})-(\d+)$/);
                if (m) {
                    const y = m[1], n = parseInt(m[2]);
                    if (!yearMax[y] || yearMax[y] < n) yearMax[y] = n;
                }
            });

            const year     = String(new Date(datum).getFullYear());
            if (!yearMax[year]) yearMax[year] = 0;

            const newRecords = [];

            // Versandkosten gleichmäßig auf alle Stück verteilen
            const totalPieces   = validRows.reduce((s, r) => s + (parseInt(r.anzahl) || 1), 0);
            const versandPerStk = totalPieces > 0 ? versandGesamt / totalPieces : 0;

            validRows.forEach(row => {
                const anzahl      = parseInt(row.anzahl) || 1;
                const nettoPerStk = parseFloat(row.einkaufspreis) || 0;
                // Brutto pro Stück = (Netto + Versandanteil) × (1 + MwSt/100)
                const bruttoPerStk = Math.round(
                    (nettoPerStk + versandPerStk) * (1 + mwstSatz / 100) * 100
                ) / 100;
                const foto  = _bulkPhotos[row.id] || null;
                const marke = row.marke.trim();
                if (marke) Store.addBrand(marke);

                const manualNr = (row.artikelNr || '').trim();
                for (let j = 0; j < anzahl; j++) {
                    let artikelNr;
                    if (manualNr) {
                        artikelNr = anzahl > 1 ? `${manualNr}-${j + 1}` : manualNr;
                    } else {
                        yearMax[year]++;
                        artikelNr = `${year}-${String(yearMax[year]).padStart(3, '0')}`;
                    }
                    const record = {
                        datum,
                        marke,
                        artikeltyp:         row.artikeltyp,
                        groesse:            row.groesse,
                        beschreibung:       row.beschreibung,
                        einkaufspreis:      bruttoPerStk,      // Brutto (was ins Lager kommt)
                        einkaufspreis_netto: nettoPerStk,      // Netto gespeichert für Transparenz
                        mwst_satz:          mwstSatz,
                        versandanteil:      Math.round(versandPerStk * 100) / 100,
                        anzahl:             1,
                        einkaufsquelle:     quelle,
                        warenkategorie:     kategorie,
                        zielgruppe,
                        haendler,
                        status:             'verfuegbar',
                        sessionId,
                        artikelNr,
                        lagerort:           { bereich: loB, regal: loR, fach: loF }
                    };
                    if (foto) record.foto = foto;
                    // EINDEUTIGE ID vergeben (sonst kollidieren UI-Selektionen)
                    record.id = Store.generateId();
                    record.createdAt = new Date().toISOString();
                    if (Store._stampRecord) Store._stampRecord(record);
                    newRecords.push(record);
                }
            });

            // Einmaliger Batch-Write — wartet auf echte IDB-Bestätigung
            if (saveBtn) saveBtn.textContent = '⏳ Schreibe in Datenbank…';
            await Store.setAsync('purchases', [...existing, ...newRecords]);

            Store.addEinkaufsquelle(quelle);
            localStorage.setItem('lager_last_quelle', quelle);

            App.closeModal();
            const mwstInfo  = mwstSatz > 0    ? ` · MwSt ${mwstSatz}%` : '';
            const versandInfo = versandGesamt > 0 ? ` · Versand ${Utils.formatCurrency(versandGesamt)}` : '';
            Utils.showToast(
                `✅ ${totalToCreate} Artikel persistiert${validRows.length > 1 ? ` (${validRows.length} Typen)` : ''}${mwstInfo}${versandInfo} · Brutto-EK gespeichert`,
                'success'
            );
            Lager._filters.status = 'verfuegbar';
            renderPage();
            document.getElementById('mainContent').scrollTop = 0;

        } catch(err) {
            console.error('[Bulk] Speicherfehler:', err);
            Utils.showToast('❌ Speichern fehlgeschlagen: ' + (err.message || err.name || err), 'error');
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Alle anlegen'; }
        }
    }, 20);
}

// ── Excel-Import ──────────────────────────────────────────────────────────
const ExcelImport = {
    _rows: [],          // geparste Zeilen aus der Excel-Datei
    _columns: [],       // Spalten-Namen (Header)
    _mapping: {},       // Field → ColumnName

    // Erkennt automatisch welche Spalte zu welchem Feld gehört (deutsch + englisch)
    // Fragezeichen werden ignoriert ("was?" → "was", "wo?" → "wo")
    _autoDetect(columns) {
        const lc = c => (c || '').toString().trim().toLowerCase().replace(/\?/g, '');
        const find = (...names) => columns.find(c => names.includes(lc(c))) || '';
        return {
            datum:        find('kaufdatum', 'datum', 'date', 'einkaufsdatum', 'kauf'),
            marke:        find('marke', 'brand', 'hersteller'),
            artikeltyp:   find('typ', 'artikeltyp', 'kategorie', 'type', 'category'),
            groesse:      find('größe', 'groesse', 'size', 'gr', 'gr.', 'gröse'),
            beschreibung: find('beschreibung', 'description', 'modell', 'name', 'titel', 'title', 'was', 'artikel', 'item', 'produkt', 'bezeichnung'),
            einkaufspreis:find('ek', 'ek-preis', 'einkauf', 'einkaufspreis', 'preis', 'price', 'cost', 'kaufpreis'),
            quelle:       find('wo', 'quelle', 'source', 'einkaufsquelle', 'händler', 'haendler', 'shop', 'laden'),
            anzahl:       find('anzahl', 'menge', 'quantity', 'qty', 'stück', 'stueck'),
            verkaufspreis:find('verkauf', 'verkaufspreis', 'vk', 'vk-preis', 'sale', 'sold', 'erlös', 'erloes'),
            verkaufsdatum:find('verkaufsdatum', 'verkaufdatum', 'vk-datum', 'sale date', 'saledate', 'sold date'),
            verkaufswo:   find('wo2', 'wohin', 'käufer', 'kaeufer', 'buyer', 'sold to'),
            // Optionale Ausgaben-/Einnahmen-Posten für die EÜR (€ bzw. %) — nur bei passender Spalte
            versandKaeufer:    find('versand käufer', 'versandkäufer', 'versandkosten käufer', 'versand vom käufer', 'shipping charged'),
            versandVerkaeufer: find('versand', 'porto', 'shipping', 'versandkosten', 'versandkosten verkäufer', 'versand verkäufer'),
            gebuehrProzent:    find('gebühr %', 'gebuehr %', 'provision %', 'fee %', 'plattformgebühr %', 'gebührprozent')
        };
    },

    // Findet die echte Header-Zeile (manche Exporte haben Titel-/Legenden-Zeilen darüber).
    // aoa = Array-of-Arrays inkl. Leerzeilen, damit der Index der Tabellenzeile entspricht.
    _findHeaderRow(aoa) {
        const KW = new Set(['marke','brand','hersteller','typ','artikeltyp','kategorie','type','category',
            'größe','groesse','size','beschreibung','description','modell','name','titel','title','was','artikel','bezeichnung',
            'ek','ek-preis','einkauf','einkaufspreis','preis','price','cost','kaufpreis',
            'wo','quelle','source','datum','kaufdatum','date','anzahl','menge','quantity','qty','stück','stueck']);
        const clean = c => (c == null ? '' : String(c)).trim().toLowerCase().replace(/\?/g, '');
        const limit = Math.min(aoa.length, 30);
        let best = -1;
        for (let i = 0; i < limit; i++) {
            const cells = (aoa[i] || []).map(clean).filter(Boolean);
            if (cells.length < 2) continue;
            if (cells.some(c => KW.has(c))) return i;          // erste Zeile mit bekanntem Header-Stichwort
            if (best === -1 && cells.length >= 3) best = i;     // Fallback: erste „volle“ Zeile
        }
        return best === -1 ? 0 : best;
    },

    // Robuster Datums-Parser → 'YYYY-MM-DD' (lokal, kein UTC-Versatz) oder null.
    // Erkennt ISO, DE (TT.MM.JJJJ) und US (M/T/JJ) — bei 13/x ist die >12-Zahl zwingend der Tag.
    _parseDate(v) {
        if (v == null || v === '') return null;
        const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (v instanceof Date) return isNaN(v.getTime()) ? null : fmt(v);
        const s = String(v).trim();
        if (!s) return null;
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
        if (m) {
            let a = +m[1], b = +m[2], y = m[3]; if (y.length === 2) y = '20' + y;
            let day, mon;
            if (a > 12 && b <= 12)      { day = a; mon = b; }   // DE  TT/MM
            else if (b > 12 && a <= 12) { day = b; mon = a; }   // US  MM/TT
            else                        { day = a; mon = b; }   // mehrdeutig → DE-Default
            if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31)
                return `${y}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : fmt(d);
    },

    open() {
        if (typeof XLSX === 'undefined') {
            Utils.showToast('Excel-Library konnte nicht geladen werden', 'error');
            return;
        }
        this._rows = []; this._columns = []; this._mapping = {};

        const body = `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.3);border-radius:8px;padding:12px 16px;font-size:13px;color:var(--text-secondary);">
                    <div style="font-weight:700;color:var(--info);margin-bottom:4px;">📊 Excel-Import</div>
                    <div>Lade eine <strong>.xlsx, .xls oder .csv</strong>-Datei mit deinen Artikeln hoch. Spalten werden automatisch erkannt — du kannst sie zuordnen.</div>
                </div>

                <div>
                    <label class="form-label">Datei wählen *</label>
                    <input type="file" class="form-input" id="excelFileInput" accept=".xlsx,.xls,.csv">
                </div>

                <div id="excelMappingSection" style="display:none;">
                    <div style="font-weight:700;font-size:13px;margin-bottom:8px;">Spalten-Zuordnung</div>
                    <div id="excelMappingFields"></div>
                </div>

                <div id="excelPreviewSection" style="display:none;">
                    <div style="font-weight:700;font-size:13px;margin-bottom:8px;">Vorschau (erste 10 Zeilen)</div>
                    <div id="excelPreview" style="max-height:240px;overflow:auto;border:1px solid var(--border);border-radius:6px;"></div>
                </div>

                <div id="excelCommonFields" style="display:none;background:var(--bg-secondary);border-radius:8px;padding:12px;">
                    <div style="font-weight:700;font-size:13px;margin-bottom:8px;">Gemeinsame Felder für alle importierten Artikel</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum *</label>
                            <input type="date" class="form-input" id="excelDatum" value="${new Date().toLocaleDateString('sv-SE')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Einkaufsquelle</label>
                            <select class="form-select" id="excelQuelle">
                                ${Store.getEinkaufsquellen().map(q => `<option value="${Utils.escapeHtml(q)}">${Utils.escapeHtml(q)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn" data-action="close-modal">Abbrechen</button>
            <button class="btn btn-primary" id="excelImportBtn" disabled style="min-width:200px;">📥 Importieren</button>
        `;

        App.showModal('📊 Excel-Import', body, footer);

        document.getElementById('excelFileInput').addEventListener('change', e => this._handleFile(e.target.files[0]));
        document.getElementById('excelImportBtn').addEventListener('click', () => this._import());
    },

    _handleFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onerror = () => Utils.showToast('Datei konnte nicht gelesen werden', 'error');
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const sheetName = wb.SheetNames[0];
                const sheet = wb.Sheets[sheetName];
                // 1) Rohe Zeilen lesen, um die echte Header-Zeile zu finden (Leerzeilen behalten → Index = Tabellenzeile)
                const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
                if (aoa.length === 0) {
                    Utils.showToast('Datei enthält keine Daten', 'warning');
                    return;
                }
                const hdrIdx = this._findHeaderRow(aoa);
                // 2) Ab erkannter Header-Zeile als Objekte lesen
                const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, range: hdrIdx });
                if (json.length === 0) {
                    Utils.showToast('Datei enthält keine Daten', 'warning');
                    return;
                }
                this._rows = json;
                // Nur echte Spalten — leere __EMPTY-Platzhalter (z. B. erste Leerspalte) raus
                this._columns = Object.keys(json[0]).filter(k => k && !/^__EMPTY/.test(k));
                this._mapping = this._autoDetect(this._columns);
                this._renderMapping();
                this._renderPreview();
                document.getElementById('excelMappingSection').style.display = '';
                document.getElementById('excelPreviewSection').style.display = '';
                document.getElementById('excelCommonFields').style.display = '';
                document.getElementById('excelImportBtn').disabled = false;
                Utils.showToast(`✅ ${json.length} Zeilen geladen aus ${sheetName}`, 'success');
            } catch (err) {
                console.error('[ExcelImport] Parse-Fehler:', err);
                Utils.showToast('Datei konnte nicht gelesen werden: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    },

    _renderMapping() {
        const fields = [
            { key: 'datum',         label: 'Kaufdatum',      required: false },
            { key: 'marke',         label: 'Marke',          required: false },
            { key: 'artikeltyp',    label: 'Artikeltyp',     required: false },
            { key: 'groesse',       label: 'Größe',          required: false },
            { key: 'beschreibung',  label: 'Beschreibung',   required: false },
            { key: 'einkaufspreis', label: 'EK-Preis *',     required: true  },
            { key: 'quelle',        label: 'Einkaufsquelle', required: false },
            { key: 'anzahl',        label: 'Anzahl',         required: false },
            { key: 'verkaufspreis', label: 'Verkaufspreis',  required: false },
            { key: 'verkaufsdatum', label: 'Verkaufsdatum',  required: false },
            { key: 'verkaufswo',    label: 'Verkauft an / wo',required: false },
            { key: 'versandKaeufer',    label: 'Versand v. Käufer (€)',  required: false },
            { key: 'versandVerkaeufer', label: 'Versandkosten (€)',      required: false },
            { key: 'gebuehrProzent',    label: 'Plattformgebühr (%)',    required: false }
        ];
        const opts = ['<option value="">— nicht zuordnen —</option>',
                      ...this._columns.map(c => `<option value="${Utils.escapeHtml(c)}">${Utils.escapeHtml(c)}</option>`)].join('');

        const html = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                ${fields.map(f => `
                    <div>
                        <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:3px;">${f.label}</label>
                        <select class="form-select" data-field="${f.key}" style="font-size:12px;padding:5px 8px;">
                            ${opts.replace(`value="${Utils.escapeHtml(this._mapping[f.key] || '')}"`,
                                           `value="${Utils.escapeHtml(this._mapping[f.key] || '')}" selected`)}
                        </select>
                    </div>
                `).join('')}
            </div>
        `;
        document.getElementById('excelMappingFields').innerHTML = html;

        // Mapping-Änderungen tracken
        document.querySelectorAll('[data-field]').forEach(sel => {
            sel.addEventListener('change', () => {
                this._mapping[sel.dataset.field] = sel.value;
            });
        });
    },

    _renderPreview() {
        const rows = this._rows.slice(0, 10);
        const html = `
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
                <thead style="background:var(--bg-secondary);position:sticky;top:0;">
                    <tr>${this._columns.map(c => `<th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--border);font-weight:600;">${Utils.escapeHtml(c)}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${rows.map(r => `<tr>${this._columns.map(c => `<td style="padding:4px 8px;border-bottom:1px solid var(--border);">${Utils.escapeHtml(String(r[c] || ''))}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
            ${this._rows.length > 10 ? `<div style="padding:8px;text-align:center;font-size:11px;color:var(--text-muted);background:var(--bg-secondary);">… und ${this._rows.length - 10} weitere Zeilen</div>` : ''}
        `;
        document.getElementById('excelPreview').innerHTML = html;
    },

    async _import() {
        const datum = document.getElementById('excelDatum').value;
        const quelle = document.getElementById('excelQuelle').value || '';
        const btn = document.getElementById('excelImportBtn');

        if (!datum) { Utils.showToast('Bitte Datum angeben', 'warning'); return; }
        if (!this._mapping.einkaufspreis) {
            Utils.showToast('Bitte mindestens "EK-Preis" zuordnen', 'warning');
            return;
        }

        // Werte aus Excel-Zeilen extrahieren
        const validRows = [];
        let skipped = 0;
        for (const r of this._rows) {
            const get = field => {
                const col = this._mapping[field];
                return col ? r[col] : '';
            };
            const preis = parseFloat(String(get('einkaufspreis')).replace(',', '.').replace(/[^\d.\-]/g, ''));
            const anzahl = parseInt(String(get('anzahl') || '1').replace(/[^\d]/g, '')) || 1;
            const marke = String(get('marke') || '').trim();
            const beschr = String(get('beschreibung') || '').trim();

            if (isNaN(preis) || preis < 0 || (!marke && !beschr)) { skipped++; continue; }

            // Verkaufs-Daten (optional) — ist ein Verkaufspreis > 0 da, gilt der Artikel als verkauft
            const num = v => parseFloat(String(v).replace(',', '.').replace(/[^\d.\-]/g, '')) || 0;
            const vkPreis = parseFloat(String(get('verkaufspreis')).replace(',', '.').replace(/[^\d.\-]/g, ''));
            const verkauft = !isNaN(vkPreis) && vkPreis > 0;
            const rowDatum = this._parseDate(get('datum')) || datum;

            validRows.push({
                datum:         rowDatum,                                       // pro Zeile, sonst gemeinsames Datum
                marke,
                artikeltyp:    String(get('artikeltyp') || 'Sonstiges').trim() || 'Sonstiges',
                groesse:       String(get('groesse') || '').trim(),
                beschreibung:  beschr,
                einkaufspreis: preis,
                einkaufsquelle: String(get('quelle') || '').trim() || quelle,  // pro Zeile, sonst gemeinsame Quelle
                anzahl:        Math.max(1, Math.min(9999, anzahl)),
                verkauft,
                verkaufspreis: verkauft ? vkPreis : 0,
                verkaufsdatum: verkauft ? (this._parseDate(get('verkaufsdatum')) || rowDatum) : '',
                verkaufswo:    String(get('verkaufswo') || '').trim(),
                versandKaeufer:    verkauft ? num(get('versandKaeufer')) : 0,
                versandVerkaeufer: verkauft ? num(get('versandVerkaeufer')) : 0,
                gebuehrProzent:    verkauft ? num(get('gebuehrProzent')) : 0
            });
        }

        if (validRows.length === 0) {
            Utils.showToast('Keine gültigen Zeilen gefunden (EK-Preis + Marke/Beschreibung erforderlich)', 'warning');
            return;
        }

        const totalToCreate = validRows.reduce((s, r) => s + r.anzahl, 0);
        const soldToCreate  = validRows.filter(r => r.verkauft).reduce((s, r) => s + r.anzahl, 0);
        if (!confirm(`${validRows.length} Excel-Zeilen → ${totalToCreate} einzelne Artikel werden angelegt.${soldToCreate > 0 ? `\n\nDavon ${soldToCreate} direkt als „verkauft" markiert (mit Verkaufspreis + Verkaufsdatum).` : ''}${skipped > 0 ? `\n\n${skipped} Zeilen übersprungen (ungültiger Preis oder fehlende Marke/Beschreibung).` : ''}\n\nFortfahren?`)) return;

        btn.disabled = true;
        btn.textContent = '⏳ Importiere…';

        try {
            const sessionId = 'xlsx_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
            const existing = Store.getAllPurchasesRaw ? Store.getAllPurchasesRaw() : [];

            const yearMax = {};
            existing.forEach(p => {
                const m = (p.artikelNr || '').match(/^(\d{4})-(\d+)$/);
                if (m) {
                    const y = m[1], n = parseInt(m[2]);
                    if (!yearMax[y] || yearMax[y] < n) yearMax[y] = n;
                }
            });
            const newRecords = [];
            const newSales   = [];
            const existingSales = Store.getAllSalesRaw ? Store.getAllSalesRaw() : [];
            validRows.forEach(row => {
                if (row.marke) Store.addBrand(row.marke);
                const ry = String(new Date(row.datum).getFullYear());   // Artikel-Nr. pro Jahr fortlaufend
                if (!yearMax[ry]) yearMax[ry] = 0;
                const unitIds = [];
                for (let j = 0; j < row.anzahl; j++) {
                    yearMax[ry]++;
                    const record = {
                        datum:         row.datum,
                        marke:         row.marke,
                        artikeltyp:    row.artikeltyp,
                        groesse:       row.groesse,
                        beschreibung:  row.beschreibung,
                        einkaufspreis: row.einkaufspreis,
                        anzahl:        1,
                        einkaufsquelle: row.einkaufsquelle,
                        status:        row.verkauft ? 'verkauft' : 'verfuegbar',
                        sessionId,
                        artikelNr:     `${ry}-${String(yearMax[ry]).padStart(3, '0')}`,
                        lagerort:      { bereich: '', regal: '', fach: '' }
                    };
                    // EINDEUTIGE ID vergeben (sonst kollidieren UI-Selektionen)
                    record.id = Store.generateId();
                    record.createdAt = new Date().toISOString();
                    if (Store._stampRecord) Store._stampRecord(record);
                    newRecords.push(record);
                    unitIds.push(record.id);
                }

                // Verkauft? → verlinkten Verkaufs-Datensatz anlegen (Preis = Gesamterlös der Zeile)
                if (row.verkauft) {
                    const sale = {
                        datum:            row.verkaufsdatum || row.datum,
                        verkaufsplattform: row.verkaufswo || 'Sonstiges',
                        verkaufspreis:    row.verkaufspreis,
                        versandkostenKaeufer:    row.versandKaeufer,
                        plattformgebuehrProzent: row.gebuehrProzent,
                        versandkostenVerkaufer:  row.versandVerkaeufer,
                        kaeufer:          row.verkaufswo || '',
                        notizen:          'Excel-Import',
                        marke:            row.marke,
                        artikeltyp:       row.artikeltyp,
                        groesse:          row.groesse,
                        beschreibung:     row.beschreibung,
                        sessionId
                    };
                    if (unitIds.length === 1) sale.purchaseId = unitIds[0];
                    else                      sale.purchaseIds = unitIds;
                    sale.id = Store.generateId();
                    sale.createdAt = new Date().toISOString();
                    if (Store._stampRecord) Store._stampRecord(sale);
                    newSales.push(sale);
                    if (row.verkaufswo) Store.addPlatform && Store.addPlatform(row.verkaufswo);
                }
            });

            await Store.setAsync('purchases', [...existing, ...newRecords]);
            if (newSales.length) await Store.setAsync('sales', [...existingSales, ...newSales]);
            [...new Set(validRows.map(r => r.einkaufsquelle).filter(Boolean))].forEach(q => Store.addEinkaufsquelle(q));

            // GoBD (Rz.64): jeden importierten Datensatz einzeln & unveränderlich protokollieren (Hash-Chain, eine Schreiboperation)
            if (Store._addAuditEntriesBatch) {
                const auditItems = [];
                newRecords.forEach(r => auditItems.push({
                    action: 'erstellt', entityType: 'einkauf', entityId: r.id,
                    oldValues: null, newValues: r,
                    details: `Einkauf erstellt (Excel-Import ${sessionId})`
                }));
                newSales.forEach(s => auditItems.push({
                    action: 'erstellt', entityType: 'verkauf', entityId: s.id,
                    oldValues: null, newValues: s,
                    details: `Verkauf erstellt (Excel-Import ${sessionId})`
                }));
                Store._addAuditEntriesBatch(auditItems);
            }

            App.closeModal();
            Utils.showToast(`✅ ${totalToCreate} Artikel aus Excel importiert${soldToCreate > 0 ? ` · ${soldToCreate} als verkauft` : ''}${skipped > 0 ? ` · ${skipped} übersprungen` : ''}`, 'success');
            Lager._filters.status = '';
            renderPage();
            document.getElementById('mainContent').scrollTop = 0;

            // §19 UStG: nach Import mit Verkäufen Umsatzgrenze prüfen (Bulk umgeht sonst saveSale-Check)
            if (newSales.length && window.App && typeof App._checkUstThreshold === 'function') {
                setTimeout(() => App._checkUstThreshold(), 400);
            }

        } catch (err) {
            console.error('[ExcelImport] Speicherfehler:', err);
            Utils.showToast('❌ Import fehlgeschlagen: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = '📥 Importieren';
        }
    }
};
window.ExcelImport = ExcelImport;

// ── Verkäufe-Import (CSV von Vinted, eBay, etc.) ──────────────────────────
const SalesImport = {
    _rows: [],
    _columns: [],
    _mapping: {},
    _platform: 'Vinted',

    // Robuste Datums-Parser (akzeptiert ISO, DE, US, EU)
    _parseDate(s) {
        if (!s) return null;
        s = String(s).trim();
        if (!s) return null;
        // Bereits ISO?
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        // DD.MM.YYYY / DD/MM/YYYY / DD-MM-YYYY
        let m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
        if (m) {
            const day   = m[1].padStart(2, '0');
            const month = m[2].padStart(2, '0');
            let year    = m[3];
            if (year.length === 2) year = '20' + year;
            return `${year}-${month}-${day}`;
        }
        // Fallback: native Date
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d.toLocaleDateString('sv-SE');
        return null;
    },

    // Robuster Zahlen-Parser (DE/EN, € entfernt)
    _parseNum(s) {
        if (s == null || s === '') return 0;
        let str = String(s).replace(/[^\d.,\-]/g, '');
        if (!str) return 0;
        if (str.indexOf(',') > -1 && str.indexOf('.') > -1) {
            // Beide Trennzeichen → letztes ist Dezimal
            if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                str = str.replace(/\./g, '').replace(',', '.');
            } else {
                str = str.replace(/,/g, '');
            }
        } else if (str.indexOf(',') > -1) {
            // Nur Komma → DE-Dezimal
            str = str.replace(',', '.');
        }
        const n = parseFloat(str);
        return isNaN(n) ? 0 : n;
    },

    // Plattform-spezifische Auto-Detection (Vinted/eBay/generisch)
    _autoDetect(columns, platform) {
        const lc = c => (c || '').toString().trim().toLowerCase();
        const find = (...names) => columns.find(c => names.includes(lc(c))) || '';

        if (platform === 'Vinted') {
            return {
                datum:          find('date', 'datum', 'sale date', 'sold on', 'verkaufsdatum', 'order date'),
                beschreibung:   find('item title', 'titel', 'title', 'item', 'artikel'),
                preis:          find('item price', 'price', 'preis', 'sold for', 'item value'),
                gebuehr:        find('buyer protection fee', 'protection fee', 'fee', 'gebühr', 'commission'),
                versandKaeufer: find('postage', 'shipping', 'versand', 'porto', 'shipping cost'),
                versandVk:      find('seller postage', 'meine versandkosten', 'shipping cost (seller)'),
                kaeufer:        find('buyer', 'käufer', 'username', 'buyer username')
            };
        }
        if (platform === 'eBay') {
            return {
                datum:          find('sale date', 'sold date', 'order date', 'datum'),
                beschreibung:   find('item title', 'item', 'titel', 'title'),
                preis:          find('sold for', 'item price', 'sale price', 'price'),
                gebuehr:        find('final value fee', 'ebay fee', 'gebühr', 'fees', 'fee'),
                versandKaeufer: find('shipping and handling', 'shipping', 'versand', 'porto'),
                versandVk:      find('shipping cost', 'meine versandkosten'),
                kaeufer:        find('buyer username', 'buyer', 'käufer', 'username')
            };
        }
        // Generic
        return {
            datum:          find('datum', 'date', 'sale date'),
            beschreibung:   find('artikel', 'item', 'beschreibung', 'title', 'titel'),
            preis:          find('preis', 'price', 'verkaufspreis', 'amount'),
            gebuehr:        find('gebühr', 'fee', 'fees', 'commission'),
            versandKaeufer: find('versand', 'shipping', 'porto'),
            versandVk:      find('versand verkäufer', 'shipping cost (seller)'),
            kaeufer:        find('käufer', 'buyer', 'username')
        };
    },

    open() {
        if (typeof XLSX === 'undefined') {
            Utils.showToast('XLSX-Library nicht geladen', 'error');
            return;
        }
        this._rows = []; this._columns = []; this._mapping = {}; this._platform = 'Vinted';

        const body = `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:12px 16px;font-size:13px;color:var(--text-secondary);">
                    <div style="font-weight:700;color:var(--success);margin-bottom:4px;">📥 Verkäufe-Import</div>
                    <div>Lade die <strong>Verkaufshistorie</strong> deiner Plattform als CSV/Excel-Datei hoch. Die Verkäufe werden direkt in Buchungen gespeichert. <br>
                    <strong>Tipp:</strong> Wenn die Artikel-Nr. (<code>ART-2026-XXXX</code>) im Titel steht, wird der Verkauf automatisch dem Lager-Artikel zugeordnet.</div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Plattform *</label>
                        <select class="form-select" id="salesPlatform">
                            <option value="Vinted" selected>Vinted</option>
                            <option value="eBay">eBay</option>
                            <option value="Mercari">Mercari</option>
                            <option value="Etsy">Etsy</option>
                            <option value="Depop">Depop</option>
                            <option value="Sonstige">Sonstige</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Eigene Plattform</label>
                        <input type="text" class="form-input" id="salesCustomPlatform" placeholder="(falls Sonstige)" disabled>
                    </div>
                </div>

                <div>
                    <label class="form-label">Datei wählen *</label>
                    <input type="file" class="form-input" id="salesFileInput" accept=".csv,.xlsx,.xls">
                </div>

                <div id="salesMappingSection" style="display:none;">
                    <div style="font-weight:700;font-size:13px;margin-bottom:8px;">Spalten-Zuordnung</div>
                    <div id="salesMappingFields"></div>
                </div>

                <div id="salesPreviewSection" style="display:none;">
                    <div style="font-weight:700;font-size:13px;margin-bottom:8px;">Vorschau (erste 8 Zeilen — geparst)</div>
                    <div id="salesPreview" style="max-height:240px;overflow:auto;border:1px solid var(--border);border-radius:6px;"></div>
                    <div id="salesStats" style="margin-top:8px;font-size:12px;color:var(--text-secondary);"></div>
                </div>
            </div>
        `;

        const footer = `
            <button class="btn" data-action="close-modal">Abbrechen</button>
            <button class="btn btn-primary" id="salesImportBtn" disabled style="min-width:200px;">📥 Importieren</button>
        `;

        App.showModal('📥 Verkäufe-Import (CSV)', body, footer);

        // Plattform-Wechsel
        document.getElementById('salesPlatform').addEventListener('change', (e) => {
            this._platform = e.target.value;
            const customField = document.getElementById('salesCustomPlatform');
            customField.disabled = e.target.value !== 'Sonstige';
            if (this._columns.length > 0) {
                this._mapping = this._autoDetect(this._columns, this._platform);
                this._renderMapping();
                this._renderPreview();
            }
        });

        document.getElementById('salesFileInput').addEventListener('change', e => this._handleFile(e.target.files[0]));
        document.getElementById('salesImportBtn').addEventListener('click', () => this._import());
    },

    _handleFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onerror = () => Utils.showToast('Datei konnte nicht gelesen werden', 'error');
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array', codepage: 65001 });
                const sheetName = wb.SheetNames[0];
                const sheet = wb.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
                if (json.length === 0) {
                    Utils.showToast('Datei enthält keine Daten', 'warning');
                    return;
                }
                this._rows = json;
                this._columns = Object.keys(json[0]);
                this._mapping = this._autoDetect(this._columns, this._platform);
                this._renderMapping();
                this._renderPreview();
                document.getElementById('salesMappingSection').style.display = '';
                document.getElementById('salesPreviewSection').style.display = '';
                document.getElementById('salesImportBtn').disabled = false;
                Utils.showToast(`✅ ${json.length} Zeilen geladen`, 'success');
            } catch (err) {
                console.error('[SalesImport] Parse-Fehler:', err);
                Utils.showToast('Datei konnte nicht gelesen werden: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    },

    _renderMapping() {
        const fields = [
            { key: 'datum',          label: 'Datum *',                req: true  },
            { key: 'beschreibung',   label: 'Artikel / Titel',        req: false },
            { key: 'preis',          label: 'Verkaufspreis (€) *',    req: true  },
            { key: 'gebuehr',        label: 'Plattform-Gebühr (€)',   req: false },
            { key: 'versandKaeufer', label: 'Versand Käufer (€)',     req: false },
            { key: 'versandVk',      label: 'Versand Verkäufer (€)',  req: false },
            { key: 'kaeufer',        label: 'Käufer / Username',      req: false }
        ];
        const optHtml = (selected) =>
            ['<option value="">— nicht zuordnen —</option>',
             ...this._columns.map(c => `<option value="${Utils.escapeHtml(c)}" ${c === selected ? 'selected' : ''}>${Utils.escapeHtml(c)}</option>`)
            ].join('');

        const html = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                ${fields.map(f => `
                    <div>
                        <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:3px;">${f.label}</label>
                        <select class="form-select sales-map" data-field="${f.key}" style="font-size:12px;padding:5px 8px;">
                            ${optHtml(this._mapping[f.key])}
                        </select>
                    </div>
                `).join('')}
            </div>
        `;
        document.getElementById('salesMappingFields').innerHTML = html;
        document.querySelectorAll('.sales-map').forEach(sel => {
            sel.addEventListener('change', () => {
                this._mapping[sel.dataset.field] = sel.value;
                this._renderPreview();
            });
        });
    },

    // Geparste Vorschau mit erkannter Artikel-Nr-Zuordnung
    _renderPreview() {
        const purchases = Store.getPurchases ? Store.getPurchases(true) : [];
        const artNrMap = {};
        purchases.forEach(p => { if (p.artikelNr) artNrMap[p.artikelNr] = p; });
        const artNrRegex = /\b\d{4}-\d{3,}\b/;

        const get = (row, field) => {
            const col = this._mapping[field];
            return col ? row[col] : '';
        };

        const parsed = this._rows.slice(0, 8).map(r => {
            const datum = this._parseDate(get(r, 'datum'));
            const beschr = String(get(r, 'beschreibung') || '').trim();
            const preis = this._parseNum(get(r, 'preis'));
            const gebuehr = this._parseNum(get(r, 'gebuehr'));
            const vsk = this._parseNum(get(r, 'versandKaeufer'));
            const vskVk = this._parseNum(get(r, 'versandVk'));
            const kaeufer = String(get(r, 'kaeufer') || '').trim();

            const m = beschr.match(artNrRegex);
            const matchNr = m && artNrMap[m[0].toUpperCase()] ? m[0].toUpperCase() : null;

            return { datum, beschr, preis, gebuehr, vsk, vskVk, kaeufer, matchNr };
        });

        const fmt = v => Utils.formatCurrency(v);
        const html = `
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
                <thead style="background:var(--bg-secondary);position:sticky;top:0;">
                    <tr>
                        <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--border);font-weight:600;">Datum</th>
                        <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--border);font-weight:600;">Artikel</th>
                        <th style="padding:5px 8px;text-align:right;border-bottom:1px solid var(--border);font-weight:600;">Preis</th>
                        <th style="padding:5px 8px;text-align:right;border-bottom:1px solid var(--border);font-weight:600;">Gebühr</th>
                        <th style="padding:5px 8px;text-align:right;border-bottom:1px solid var(--border);font-weight:600;">Versand K.</th>
                        <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--border);font-weight:600;">Käufer</th>
                        <th style="padding:5px 8px;text-align:left;border-bottom:1px solid var(--border);font-weight:600;">Lager-Match</th>
                    </tr>
                </thead>
                <tbody>
                    ${parsed.map(p => `
                        <tr>
                            <td style="padding:4px 8px;border-bottom:1px solid var(--border);${p.datum ? '' : 'color:var(--danger);'}">${p.datum || '⚠ ungültig'}</td>
                            <td style="padding:4px 8px;border-bottom:1px solid var(--border);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${Utils.escapeHtml(p.beschr)}">${Utils.escapeHtml(p.beschr || '—')}</td>
                            <td style="padding:4px 8px;border-bottom:1px solid var(--border);text-align:right;${p.preis > 0 ? '' : 'color:var(--danger);'}">${p.preis > 0 ? fmt(p.preis) : '⚠ 0'}</td>
                            <td style="padding:4px 8px;border-bottom:1px solid var(--border);text-align:right;">${p.gebuehr > 0 ? fmt(p.gebuehr) : '—'}</td>
                            <td style="padding:4px 8px;border-bottom:1px solid var(--border);text-align:right;">${p.vsk > 0 ? fmt(p.vsk) : '—'}</td>
                            <td style="padding:4px 8px;border-bottom:1px solid var(--border);">${Utils.escapeHtml(p.kaeufer || '—')}</td>
                            <td style="padding:4px 8px;border-bottom:1px solid var(--border);">${p.matchNr ? `<span class="badge badge-success" style="font-size:9px;">✓ ${p.matchNr}</span>` : '<span style="color:var(--text-muted);">—</span>'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${this._rows.length > 8 ? `<div style="padding:8px;text-align:center;font-size:11px;color:var(--text-muted);background:var(--bg-secondary);">… und ${this._rows.length - 8} weitere Zeilen</div>` : ''}
        `;
        document.getElementById('salesPreview').innerHTML = html;

        // Statistik: wie viele Matches?
        const allParsed = this._rows.map(r => {
            const beschr = String(get(r, 'beschreibung') || '').trim();
            const datum  = this._parseDate(get(r, 'datum'));
            const preis  = this._parseNum(get(r, 'preis'));
            const m = beschr.match(artNrRegex);
            const matchNr = m && artNrMap[m[0].toUpperCase()] ? m[0].toUpperCase() : null;
            return { valid: datum && preis > 0, matchNr };
        });
        const totalValid   = allParsed.filter(p => p.valid).length;
        const totalSkipped = allParsed.length - totalValid;
        const totalMatched = allParsed.filter(p => p.valid && p.matchNr).length;

        document.getElementById('salesStats').innerHTML = `
            ✅ <strong>${totalValid}</strong> gültige Verkäufe ·
            🔗 <strong>${totalMatched}</strong> automatisch dem Lager zugeordnet ·
            ${totalSkipped > 0 ? `⚠️ <strong>${totalSkipped}</strong> übersprungen (Datum/Preis fehlt)` : ''}
        `;
    },

    async _import() {
        const get = (row, field) => {
            const col = this._mapping[field];
            return col ? row[col] : '';
        };

        let plattform = this._platform;
        if (plattform === 'Sonstige') {
            const custom = (document.getElementById('salesCustomPlatform') || {}).value?.trim();
            plattform = custom || 'Sonstige';
        }

        if (!this._mapping.datum || !this._mapping.preis) {
            Utils.showToast('Bitte Datum und Verkaufspreis zuordnen', 'warning');
            return;
        }

        const purchases = Store.getPurchases(true);
        const artNrMap = {};
        purchases.forEach(p => { if (p.artikelNr && !p.storniert) artNrMap[p.artikelNr.toUpperCase()] = p; });
        const artNrRegex = /\b\d{4}-\d{3,}\b/;

        // Verkäufe vorbereiten
        const newSales = [];
        const updatedPurchases = new Set(); // IDs deren Status auf 'verkauft' gesetzt wird
        let skipped = 0, matched = 0;

        for (const r of this._rows) {
            const datum  = this._parseDate(get(r, 'datum'));
            const preis  = this._parseNum(get(r, 'preis'));
            const beschr = String(get(r, 'beschreibung') || '').trim();

            if (!datum || preis <= 0) { skipped++; continue; }

            const gebuehr = this._parseNum(get(r, 'gebuehr'));
            const vsk     = this._parseNum(get(r, 'versandKaeufer'));
            const vskVk   = this._parseNum(get(r, 'versandVk'));
            const kaeufer = String(get(r, 'kaeufer') || '').trim();

            // Gebühr in Prozent umrechnen (für die App)
            const gebuehrProzent = preis > 0 ? Math.round((gebuehr / (preis + vsk)) * 10000) / 100 : 0;

            // Lager-Match versuchen via Artikel-Nr im Titel
            const m = beschr.match(artNrRegex);
            const matchedPurchase = m ? artNrMap[m[0].toUpperCase()] : null;

            const sale = {
                id: 'sale_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9),
                datum,
                verkaufsplattform:       plattform,
                verkaufspreis:           preis,
                versandkostenKaeufer:    vsk,
                plattformgebuehrProzent: gebuehrProzent,
                versandkostenVerkaufer:  vskVk,
                kaeufer,
                notizen:                 `Importiert aus ${plattform}-CSV` + (matchedPurchase ? ` · Lager-Match: ${matchedPurchase.artikelNr}` : '')
            };

            if (matchedPurchase) {
                sale.purchaseId   = matchedPurchase.id;
                sale.marke        = matchedPurchase.marke || '';
                sale.artikeltyp   = matchedPurchase.artikeltyp || '';
                sale.groesse      = matchedPurchase.groesse || '';
                sale.beschreibung = matchedPurchase.beschreibung || '';
                updatedPurchases.add(matchedPurchase.id);
                matched++;
            } else {
                // Manueller Verkauf ohne Lager-Link
                sale.beschreibung = beschr;
            }

            if (Store._stampRecord) Store._stampRecord(sale);
            newSales.push(sale);
        }

        if (newSales.length === 0) {
            Utils.showToast('Keine gültigen Verkäufe zum Importieren', 'warning');
            return;
        }

        const total = newSales.length;
        if (!confirm(`${total} Verkäufe werden gebucht (${matched} mit Lager-Match, ${total - matched} manuell).${skipped > 0 ? `\n${skipped} Zeilen übersprungen.` : ''}\n\nFortfahren?`)) return;

        const btn = document.getElementById('salesImportBtn');
        btn.disabled = true;
        btn.textContent = '⏳ Importiere…';

        try {
            // Verkäufe persistieren
            const existingSales = Store.get('sales') || [];
            await Store.setAsync('sales', [...existingSales, ...newSales]);

            // Status der gematchten Artikel auf 'verkauft' setzen
            if (updatedPurchases.size > 0) {
                const allPurchases = Store.getPurchases(true);
                allPurchases.forEach(p => {
                    if (updatedPurchases.has(p.id)) {
                        p.status = 'verkauft';
                        if (Store._stampRecord) Store._stampRecord(p);
                    }
                });
                await Store.setAsync('purchases', allPurchases);
            }

            App.closeModal();
            Utils.showToast(`✅ ${total} Verkäufe importiert · ${matched} Lager-Artikel als verkauft markiert`, 'success');
            renderPage();
        } catch (err) {
            console.error('[SalesImport] Fehler:', err);
            Utils.showToast('❌ Import fehlgeschlagen: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = '📥 Importieren';
        }
    }
};
window.SalesImport = SalesImport;

// ── Start ─────────────────────────────────────────────────────────────────
async function lagerBoot() {
    // Company-Prefix setzen — muss VOR initMainIDB und renderPage passieren,
    // damit alle Store-Zugriffe die richtigen company-namespaced Keys nutzen
    const activeCompanyId = localStorage.getItem('oyi_active_company') || '';
    Store.setCompany(activeCompanyId);

    await Store.initMainIDB();
    renderPage();

    // Wrap modal-trigger so they auto-close Buchungen-Tab if open
    const wrap = (fn) => () => { ensureLagerTab(); fn(); };

    document.getElementById('neuArtikelBtn').addEventListener('click', openNeuArtikelModal); // header bleibt direkt
    document.getElementById('sidebarNeuArtikel').addEventListener('click', wrap(openNeuArtikelModal));

    document.getElementById('bulkEinkaufBtn').addEventListener('click', openBulkArtikelModal); // header
    document.getElementById('sidebarBulkEinkauf').addEventListener('click', wrap(openBulkArtikelModal));

    document.getElementById('lagerExportBtn').addEventListener('click', () => Lager.openExportModal());
    document.getElementById('lagerKategorienBtn').addEventListener('click', openKategorienModal);

    document.getElementById('sidebarExcelImport').addEventListener('click', wrap(() => ExcelImport.open()));
    const salesBtn = document.getElementById('sidebarSalesImport');
    if (salesBtn) salesBtn.addEventListener('click', wrap(() => SalesImport.open()));

    // Speicher-Status (Browser-Quota) anzeigen
    if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(est => {
            const el = document.getElementById('storageStatus');
            if (!el || !est.quota) return;
            const used = (est.usage  / 1024 / 1024).toFixed(1);
            const tot  = (est.quota  / 1024 / 1024).toFixed(0);
            const pct  = (est.usage / est.quota * 100).toFixed(1);
            const color = pct > 80 ? 'var(--danger)' : pct > 50 ? 'var(--warning)' : 'var(--text-muted)';
            el.innerHTML = `<span style="color:${color};">💾 ${used} / ${tot} MB (${pct}%)</span>`;
        }).catch(() => {});
    }

    // Zurück-Button in Buchungen-Ansicht
    document.getElementById('buchZurueckBtn').addEventListener('click', () => {
        LagerPage.switchTab('lager');
        renderPage();
    });
}

// Whop-Gate: erst nach gültiger Membership booten (standalone-Seite hatte bisher keinen Check)
if (typeof AuthUI !== 'undefined' && AuthUI.boot) {
    App._continueAfterAuth = lagerBoot;
    AuthUI.boot();
} else {
    lagerBoot();
}


// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'lgp-tab':              function (tab) { LagerPage.switchTab(tab); },
    'lgp-plattform':        function () { LagerPage._onPlattformChange(); },
    'lgp-calc-netto':       function () { LagerPage._calcNetto(); },
    'lgp-foto':             function () { document.getElementById('neuFotoInput').click(); },
    'lgp-bulk-summary':     function () { _updateBulkSummary(); },
    'lgp-bulk-mwst':        function (satz) { _setBulkMwst(satz); },
    'lgp-bulk-mwst-custom': function () { _onBulkMwstCustom(); },
    'lgp-bulk-dup':         function (id) { _bulkDuplicateRow(id); },
    'lgp-bulk-del':         function (id) { _bulkDeleteRow(id); }
});
