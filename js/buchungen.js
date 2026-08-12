// ============================================
// Buchungen Module - Purchases & Sales
// ============================================
const Buchungen = {
    _activeTab: 'einkauf',
    _sortCol: null,
    _sortDir: 'asc',
    _filters: {},

    // Bulk-Einkauf session state
    _sessionItems: [],    // items added but not yet saved
    _sessionMeta: null,   // { datum, einkaufsquelle, budget, sessionId }

    // Verkauf: selected purchase IDs
    _selectedPurchaseIds: [],
    _verkaufManual: false,
    _verkaufFilters: { marke: '', status: 'verfuegbar' },

    render() {
        return `
            <div class="page-header">
                <h2>Buchungen</h2>
            </div>
            <div class="tabs">
                <div class="tab ${this._activeTab === 'einkauf' ? 'active' : ''}" data-tab="einkauf">Einkauf</div>
                <div class="tab ${this._activeTab === 'verkauf' ? 'active' : ''}" data-tab="verkauf">Verkauf</div>
                <div class="tab ${this._activeTab === 'alle' ? 'active' : ''}" data-tab="alle">Alle Buchungen</div>
            </div>
            <div id="buchungenContent"></div>
        `;
    },

    init() {
        document.querySelectorAll('.tab[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                this._activeTab = tab.dataset.tab;
                document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.toggle('active', t === tab));
                this._renderTab();
            });
        });
        this._renderTab();
    },

    _renderTab() {
        const container = document.getElementById('buchungenContent');
        if (this._activeTab === 'einkauf') {
            container.innerHTML = this._renderEinkaufForm();
            this._bindEinkaufForm();
        } else if (this._activeTab === 'verkauf') {
            container.innerHTML = this._renderVerkaufForm();
            this._bindVerkaufForm();
        } else {
            container.innerHTML = this._renderAlleTable();
            this._bindAlleTable();
        }
    },

    // ======== EINKAUF TAB ========
    _renderEinkaufForm() {
        const einkaufsquellen = Store.getEinkaufsquellen();
        const meta = this._sessionMeta;
        const sessionDatum = meta ? meta.datum : Utils.todayISO();
        const sessionQuelle = meta ? meta.einkaufsquelle : 'Flohmarkt';
        const sessionBudget = meta ? (meta.budget || '') : '';
        const sessionLieferant  = meta ? (meta.lieferantName || '') : '';
        const sessionLiefSteuer = meta ? (meta.lieferantSteuerId || '') : '';

        const quellenOptions = einkaufsquellen.map(q =>
            `<option value="${Utils.escapeHtml(q)}" ${q === sessionQuelle ? 'selected' : ''}>${Utils.escapeHtml(q)}</option>`
        ).join('');

        const brands = Store.getBrands();
        const brandOptions = brands.map(b => `<option value="${Utils.escapeHtml(b)}">`).join('');

        // Render session items table
        const items = this._sessionItems;
        const totalEK = items.reduce((s, it) => s + (it.einkaufspreis || 0) * (it.anzahl || 1), 0);

        let itemRows = '';
        if (items.length === 0) {
            itemRows = '<tr><td colspan="7" class="table-empty">Noch keine Artikel hinzugefügt</td></tr>';
        } else {
            itemRows = items.map((it, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${Utils.escapeHtml(it.marke || '')}</td>
                    <td>${Utils.escapeHtml(it.artikeltyp || '')}</td>
                    <td>${Utils.escapeHtml(it.groesse || '')}</td>
                    <td>${Utils.escapeHtml(it.beschreibung || '')}</td>
                    <td style="text-align:right">${Utils.formatCurrency(it.einkaufspreis)} ${it.anzahl > 1 ? `x${it.anzahl}` : ''}</td>
                    <td class="table-actions">
                        <button class="btn btn-small btn-danger" data-remove-item="${idx}">Entfernen</button>
                    </td>
                </tr>
            `).join('');
        }

        return `
            <div class="card" style="margin-bottom:16px;">
                <div class="card-header">
                    <div class="card-title">Session-Informationen</div>
                    <button class="btn btn-small" id="csvImportBtn">CSV/Excel Import</button>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Datum</label>
                        <input type="date" class="form-input" id="sess_datum" value="${Utils.escapeHtml(sessionDatum)}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Einkaufsquelle / Plattform</label>
                        <select class="form-select" id="sess_quelle">
                            ${quellenOptions}
                        </select>
                    </div>
                    <div class="form-group" id="sess_customQuelleGroup" style="display:none;">
                        <label class="form-label">Eigene Quelle</label>
                        <input type="text" class="form-input" id="sess_customQuelle" maxlength="300" placeholder="Quelle eingeben...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Gesamtbudget (optional)</label>
                        <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="sess_budget" placeholder="0,00" value="${Utils.escapeHtml(String(sessionBudget))}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label" for="sess_lieferant">Lieferant / Rechnungsaussteller</label>
                        <input type="text" class="form-input" id="sess_lieferant" maxlength="200" placeholder="für Vorsteuerabzug §14 UStG" value="${Utils.escapeHtml(sessionLieferant)}">
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="sess_lieferantSteuerId">Steuernr. / USt-IdNr. des Lieferanten</label>
                        <input type="text" class="form-input" id="sess_lieferantSteuerId" maxlength="50" placeholder="nur bei Rechnung >250€ Pflicht" value="${Utils.escapeHtml(sessionLiefSteuer)}">
                    </div>
                </div>
            </div>

            <div class="card" style="margin-bottom:16px;">
                <div class="card-header">
                    <div class="card-title">Session-Artikel (${items.length} Stück${items.length > 0 ? ', Gesamt: ' + Utils.formatCurrency(totalEK) : ''})</div>
                </div>
                <div class="table-container" style="margin-bottom:0;">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Marke</th>
                                <th>Typ</th>
                                <th>Größe</th>
                                <th>Beschreibung</th>
                                <th style="text-align:right">EK-Preis</th>
                                <th>Aktion</th>
                            </tr>
                        </thead>
                        <tbody id="sessionItemsBody">${itemRows}</tbody>
                    </table>
                </div>
            </div>

            <div class="card" style="margin-bottom:16px;">
                <div class="card-header">
                    <div class="card-title">Neuen Artikel hinzufügen</div>
                </div>
                <datalist id="markenList">${brandOptions}</datalist>
                <div class="form-row" style="align-items:flex-end;">
                    <div class="form-group">
                        <label class="form-label">Marke</label>
                        <input type="text" class="form-input" id="item_marke" list="markenList" maxlength="300" placeholder="z.B. Nike">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Artikeltyp</label>
                        <select class="form-select" id="item_artikeltyp">
                            <option value="Jacke">Jacke</option>
                            <option value="Hose">Hose</option>
                            <option value="Shirt">Shirt</option>
                            <option value="Hoodie">Hoodie</option>
                            <option value="Schuhe">Schuhe</option>
                            <option value="Accessoire">Accessoire</option>
                            <option value="Sonstiges">Sonstiges</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Größe</label>
                        <input type="text" class="form-input" id="item_groesse" maxlength="300" placeholder="z.B. M, 42">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Beschreibung</label>
                        <input type="text" class="form-input" id="item_beschreibung" maxlength="300" placeholder="Kurze Beschreibung...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Warenkategorie</label>
                        <select class="form-select" id="item_warenkategorie">
                            <option value="Kleidung">Kleidung</option>
                            <option value="Schuhe">Schuhe</option>
                            <option value="Elektronik">Elektronik</option>
                            <option value="Bücher">Bücher</option>
                            <option value="Haushalt">Haushalt</option>
                            <option value="Sport">Sport</option>
                            <option value="Accessoires">Accessoires</option>
                            <option value="Sonstiges">Sonstiges</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">EK-Preis (€)</label>
                        <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="item_preis" placeholder="0,00">
                    </div>
                    <div class="form-group" style="max-width:80px;">
                        <label class="form-label">Anzahl</label>
                        <input type="number" min="1" max="9999" class="form-input" id="item_anzahl" value="1">
                    </div>
                    <div class="form-group" style="align-self:flex-end;">
                        <button type="button" class="btn btn-primary" id="addItemBtn"><i class="ti ti-plus"></i> Hinzufügen</button>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <div class="card-title">Aktionen</div>
                </div>
                <div class="form-actions" style="gap:12px;">
                    <button type="button" class="btn btn-success" id="saveSessionBtn">
                        Session speichern (${items.length} Artikel)
                    </button>
                    <button type="button" class="btn btn-danger" id="discardSessionBtn">
                        Session verwerfen
                    </button>
                </div>
            </div>
        `;
    },

    _bindEinkaufForm() {
        // CSV import
        const csvBtn = document.getElementById('csvImportBtn');
        if (csvBtn) csvBtn.addEventListener('click', () => this._showCSVImportModal());

        // Custom source toggle
        const quelleSelect = document.getElementById('sess_quelle');
        const customQuelleGroup = document.getElementById('sess_customQuelleGroup');
        if (quelleSelect) {
            quelleSelect.addEventListener('change', () => {
                customQuelleGroup.style.display = quelleSelect.value === 'Sonstiges' ? '' : 'none';
            });
        }

        // Add item button
        const addItemBtn = document.getElementById('addItemBtn');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', () => {
                const marke = document.getElementById('item_marke').value.trim();
                const artikeltyp = document.getElementById('item_artikeltyp').value;
                const groesse = document.getElementById('item_groesse').value.trim();
                const beschreibung = document.getElementById('item_beschreibung').value.trim();
                const warenkategorie = document.getElementById('item_warenkategorie').value || 'Sonstiges';
                const preis = parseFloat(document.getElementById('item_preis').value) || 0;
                const anzahl = parseInt(document.getElementById('item_anzahl').value) || 1;

                if (!marke && !beschreibung) {
                    Utils.showToast('Bitte mindestens Marke oder Beschreibung eingeben', 'warning');
                    return;
                }
                if (!Number.isFinite(preis) || preis < 0 || preis > 99999999) {
                    Utils.showToast('Einkaufspreis muss eine gültige, nicht-negative Zahl sein', 'warning');
                    return;
                }
                // Obergrenze nicht kosmetisch: beim Speichern wird die Menge in Einzeldatensätze
                // aufgeteilt (ein Store.savePurchase pro Stück), eine sehr große Zahl würde den
                // Browser blockieren.
                if (!Number.isFinite(anzahl) || anzahl < 1 || anzahl > 9999) {
                    Utils.showToast('Anzahl muss zwischen 1 und 9999 liegen', 'warning');
                    return;
                }

                this._sessionItems.push({ marke, artikeltyp, groesse, beschreibung, warenkategorie, einkaufspreis: preis, anzahl });

                // Clear item fields
                document.getElementById('item_marke').value = '';
                document.getElementById('item_groesse').value = '';
                document.getElementById('item_beschreibung').value = '';
                document.getElementById('item_preis').value = '';
                document.getElementById('item_anzahl').value = '1';
                document.getElementById('item_marke').focus();

                // Re-render just the items list + counter
                this._refreshSessionItemsTable();
                Utils.showToast('Artikel hinzugefügt', 'success');
            });
        }

        // Remove item buttons — directly bound with one-time setup
        const sessionItemsBody = document.getElementById('sessionItemsBody');
        if (sessionItemsBody) {
            sessionItemsBody.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-remove-item]');
                if (!btn) return;
                const idx = parseInt(btn.dataset.removeItem);
                if (!isNaN(idx)) {
                    this._sessionItems.splice(idx, 1);
                    this._refreshSessionItemsTable();
                }
            });
        }

        // Save session
        const saveBtn = document.getElementById('saveSessionBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                if (this._sessionItems.length === 0) {
                    Utils.showToast('Keine Artikel in der Session', 'warning');
                    return;
                }

                // Read/update session meta from current form values
                let quelle = quelleSelect ? quelleSelect.value : 'Flohmarkt';
                if (quelle === 'Sonstiges') {
                    const custom = document.getElementById('sess_customQuelle') ? document.getElementById('sess_customQuelle').value.trim() : '';
                    if (custom) { quelle = custom; Store.addEinkaufsquelle(custom); }
                }
                const datum = Utils.getDateInputValue('sess_datum') || Utils.todayISO();
                const budget = parseFloat(document.getElementById('sess_budget') ? document.getElementById('sess_budget').value : 0) || 0;
                // §14 UStG: Aussteller-Angaben gelten für die ganze Einkaufs-Session (eine Quelle = ein Beleg)
                const lieferantName    = (document.getElementById('sess_lieferant') || {}).value?.trim() || '';
                const lieferantSteuerId = (document.getElementById('sess_lieferantSteuerId') || {}).value?.trim() || '';

                if (!this._sessionMeta) {
                    this._sessionMeta = { datum, einkaufsquelle: quelle, budget, sessionId: Store.generateId() };
                } else {
                    this._sessionMeta.datum = datum;
                    this._sessionMeta.einkaufsquelle = quelle;
                    this._sessionMeta.budget = budget;
                }
                this._sessionMeta.lieferantName = lieferantName;
                this._sessionMeta.lieferantSteuerId = lieferantSteuerId;

                const { datum: sDatum, einkaufsquelle: sQuelle, sessionId } = this._sessionMeta;
                const count = this._sessionItems.length;

                let savedCount = 0;
                this._sessionItems.forEach(item => {
                    const marke = item.marke;
                    if (marke) Store.addBrand(marke);
                    Store.addEinkaufsquelle(sQuelle);
                    // Anzahl > 1 → in einzelne Datensätze aufteilen (jedes Stück separat verkaufbar)
                    const qty = parseInt(item.anzahl) || 1;
                    for (let i = 0; i < qty; i++) {
                        Store.savePurchase({
                            datum: sDatum,
                            marke: item.marke,
                            artikeltyp: item.artikeltyp,
                            groesse: item.groesse,
                            beschreibung: item.beschreibung,
                            einkaufspreis: item.einkaufspreis, // Preis pro Stück
                            anzahl: 1,
                            einkaufsquelle: sQuelle,
                            sessionId: sessionId,
                            lieferantName,
                            lieferantSteuerId,
                            status: 'verfuegbar'
                        });
                        savedCount++;
                    }
                });

                Utils.showToast(`${savedCount} Artikel gespeichert`, 'success');
                this._sessionItems = [];
                this._sessionMeta = null;
                this._renderTab();
            });
        }

        // Discard session
        const discardBtn = document.getElementById('discardSessionBtn');
        if (discardBtn) {
            discardBtn.addEventListener('click', () => {
                if (this._sessionItems.length > 0) {
                    if (!confirm(`Session mit ${this._sessionItems.length} Artikel(n) wirklich verwerfen?`)) return;
                }
                this._sessionItems = [];
                this._sessionMeta = null;
                this._renderTab();
            });
        }
    },

    _refreshSessionItemsTable() {
        const items = this._sessionItems;
        const totalEK = items.reduce((s, it) => s + (it.einkaufspreis || 0) * (it.anzahl || 1), 0);

        let itemRows = '';
        if (items.length === 0) {
            itemRows = '<tr><td colspan="7" class="table-empty">Noch keine Artikel hinzugefügt</td></tr>';
        } else {
            itemRows = items.map((it, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${Utils.escapeHtml(it.marke || '')}</td>
                    <td>${Utils.escapeHtml(it.artikeltyp || '')}</td>
                    <td>${Utils.escapeHtml(it.groesse || '')}</td>
                    <td>${Utils.escapeHtml(it.beschreibung || '')}</td>
                    <td style="text-align:right">${Utils.formatCurrency(it.einkaufspreis)} ${it.anzahl > 1 ? `x${it.anzahl}` : ''}</td>
                    <td class="table-actions">
                        <button class="btn btn-small btn-danger" data-remove-item="${idx}">Entfernen</button>
                    </td>
                </tr>
            `).join('');
        }

        const tbody = document.getElementById('sessionItemsBody');
        if (tbody) tbody.innerHTML = itemRows;

        // Update header counter
        const cardHeaders = document.querySelectorAll('.card-title');
        cardHeaders.forEach(h => {
            if (h.textContent.startsWith('Session-Artikel')) {
                h.textContent = `Session-Artikel (${items.length} Stück${items.length > 0 ? ', Gesamt: ' + Utils.formatCurrency(totalEK) : ''})`;
            }
        });

        // Update save button label
        const saveBtn = document.getElementById('saveSessionBtn');
        if (saveBtn) saveBtn.textContent = `Session speichern (${items.length} Artikel)`;
    },

    // ======== VERKAUF TAB ========
    _renderVerkaufForm() {
        const platforms = Store.getPlatforms();
        const platOptions = platforms.filter(p => p !== 'Sonstiges').map(p =>
            `<option value="${Utils.escapeHtml(p)}" ${p === 'Vinted' ? 'selected' : ''}>${Utils.escapeHtml(p)}</option>`
        ).join('');

        const isManual = this._verkaufManual;
        const vf = this._verkaufFilters;

        // Build inventory table (all purchases, filtered)
        const allPurchases = Store.getPurchases();
        const brands = [...new Set(allPurchases.map(p => p.marke).filter(Boolean))].sort();
        let filtered = allPurchases;
        if (vf.marke) filtered = filtered.filter(p => p.marke === vf.marke);
        if (vf.status) filtered = filtered.filter(p => p.status === vf.status);

        const selectedIds = this._selectedPurchaseIds;
        const selectedEK = allPurchases
            .filter(p => selectedIds.includes(p.id))
            .reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0), 0);

        const brandFilterOpts = brands.map(b =>
            `<option value="${Utils.escapeHtml(b)}" ${vf.marke === b ? 'selected' : ''}>${Utils.escapeHtml(b)}</option>`
        ).join('');

        let invRows = '';
        if (filtered.length === 0) {
            invRows = '<tr><td colspan="8" class="table-empty">Keine Artikel im Lager</td></tr>';
        } else {
            invRows = filtered.map(p => {
                const isChecked = selectedIds.includes(p.id);
                const statusBadge = p.status === 'verfuegbar'
                    ? '<span class="badge badge-success">Verfügbar</span>'
                    : p.status === 'reserviert'
                        ? '<span class="badge badge-warning">Reserviert</span>'
                        : '<span class="badge badge-neutral">Verkauft</span>';
                const sessionBadge = p.sessionId ? ' <span class="badge badge-info" style="font-size:10px;">Bulk</span>' : '';
                return `
                    <tr class="${isChecked ? 'row-selected' : ''}">
                        <td><input type="checkbox" class="inv-checkbox" data-id="${p.id}" ${isChecked ? 'checked' : ''}></td>
                        <td style="font-family:monospace;font-size:11px;white-space:nowrap;">${Utils.escapeHtml(p.artikelNr || '—')}</td>
                        <td>${Utils.escapeHtml(p.marke || '')}${sessionBadge}</td>
                        <td>${Utils.escapeHtml(p.artikeltyp || '')}</td>
                        <td>${Utils.escapeHtml(p.groesse || '')}</td>
                        <td>${Utils.escapeHtml(p.beschreibung || '')}</td>
                        <td style="text-align:right">${Utils.formatCurrency(p.einkaufspreis)}</td>
                        <td>${statusBadge}</td>
                    </tr>
                `;
            }).join('');
        }

        const manualSection = isManual ? `
            <div id="vk_manual_fields">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Marke</label>
                        <input type="text" class="form-input" id="vk_marke" maxlength="300">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Artikeltyp</label>
                        <input type="text" class="form-input" id="vk_artikeltyp" maxlength="300">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Größe</label>
                        <input type="text" class="form-input" id="vk_groesse" maxlength="300">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Beschreibung</label>
                    <input type="text" class="form-input" id="vk_beschreibung" maxlength="300">
                </div>
            </div>
        ` : '';

        return `
            <div class="card" style="margin-bottom:16px;">
                <div class="card-header">
                    <div class="card-title">Artikel aus Lager auswählen</div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <div class="toggle-container">
                            <div class="toggle ${isManual ? 'active' : ''}" id="manualToggle"></div>
                            <span class="toggle-label">Manueller Verkauf</span>
                        </div>
                    </div>
                </div>
                <div class="filter-bar no-print" style="margin-bottom:12px;">
                    <div class="filter-group">
                        <label>Marke</label>
                        <select class="form-select" id="vkFilterMarke">
                            <option value="">Alle</option>
                            ${brandFilterOpts}
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Status</label>
                        <select class="form-select" id="vkFilterStatus">
                            <option value="" ${vf.status === '' ? 'selected' : ''}>Alle</option>
                            <option value="verfuegbar" ${vf.status === 'verfuegbar' ? 'selected' : ''}>Verfügbar</option>
                            <option value="reserviert" ${vf.status === 'reserviert' ? 'selected' : ''}>Reserviert</option>
                            <option value="verkauft" ${vf.status === 'verkauft' ? 'selected' : ''}>Verkauft</option>
                        </select>
                    </div>
                    <div class="filter-group" style="align-self:flex-end;">
                        <button class="btn btn-small" id="vkSelectAllBtn">Alle auswählen</button>
                        <button class="btn btn-small" id="vkClearSelBtn">Auswahl aufheben</button>
                    </div>
                </div>
                <div class="table-container" style="margin-bottom:0;">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:32px;"></th>
                                <th>Art.-Nr.</th>
                                <th>Marke</th>
                                <th>Typ</th>
                                <th>Größe</th>
                                <th>Beschreibung</th>
                                <th style="text-align:right">EK-Preis</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody id="vkInventoryBody">${invRows}</tbody>
                    </table>
                </div>
            </div>

            <div class="card" style="margin-bottom:16px;${selectedIds.length === 0 && !isManual ? 'opacity:0.6;' : ''}">
                <div class="card-header">
                    <div class="card-title">Ausgewählte Artikel: ${selectedIds.length} (EK gesamt: ${Utils.formatCurrency(selectedEK)})</div>
                </div>
            </div>

            <div class="card" style="margin-bottom:16px;">
                <div class="card-header">
                    <div class="card-title">Verkaufsdetails</div>
                </div>
                ${manualSection}
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Datum</label>
                        <input type="date" class="form-input" id="vk_datum" value="${Utils.todayISO()}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Verkaufsplattform</label>
                        <select class="form-select" id="vk_plattform">
                            ${platOptions}
                            <option value="Sonstiges">Sonstiges</option>
                        </select>
                    </div>
                    <div class="form-group" id="vk_customPlattformGroup" style="display:none;">
                        <label class="form-label">Eigene Plattform</label>
                        <input type="text" class="form-input" id="vk_customPlattform" maxlength="300" placeholder="Plattform eingeben...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Käufer (optional)</label>
                        <input type="text" class="form-input" id="vk_kaeufer" maxlength="300">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Verkaufspreis (Gesamt)</label>
                        <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="vk_preis" placeholder="0,00">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Versandkosten (Käufer zahlt)</label>
                        <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="vk_versandKaeufer" value="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Plattformgebühr (%)</label>
                        <input type="number" step="0.01" min="0" max="100" class="form-input" id="vk_gebuehr" value="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Versandkosten (meine Kosten)</label>
                        <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="vk_versandVk" value="0">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Notizen</label>
                    <textarea class="form-textarea" id="vk_notizen" maxlength="1000" placeholder="Optionale Notizen..."></textarea>
                </div>
                ${(() => {
                    const mat = Store.getMaterialBestand();
                    if (!mat.length) return `<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
                        📦 <a href="#" data-action="navigate" data-args=\'["materiallager"]\' style="color:var(--info);">Materiallager einrichten</a>
                        um Verpackungskosten pro Verkauf zu tracken.
                    </div>`;
                    const matRows = mat.map(m => `
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                            <span style="flex:2;font-size:13px;">${Utils.escapeHtml(m.name)}</span>
                            <span style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${parseInt(m.bestand)||0} ${m.einheit||'Stück'}</span>
                            <input type="number" step="1" min="0" max="999999" class="form-input vk_mat_menge"
                                data-mat-id="${m.id}" data-kosten="${m.kostenProEinheit||0}"
                                style="width:70px;" placeholder="0" value="0">
                            <span style="font-size:12px;color:var(--text-muted);white-space:nowrap;"
                                id="vk_mat_kosten_${m.id}">0,00 €</span>
                        </div>`).join('');
                    return `<div style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:12px;">
                        <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">
                            📦 Verpackungsmaterial (optional)
                        </div>
                        ${matRows}
                        <div style="font-size:13px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
                            Verpackungskosten: <strong id="vk_mat_total">0,00 €</strong>
                        </div>
                    </div>`;
                })()}
                <div class="card" style="padding:12px;margin-bottom:16px;background:var(--bg-card);">
                    <strong>Nettoerlös:</strong> <span id="vk_netto">0,00 &euro;</span>
                    &nbsp;|&nbsp;
                    <strong>EK gesamt:</strong> <span id="vk_ekTotal">${Utils.formatCurrency(selectedEK)}</span>
                    &nbsp;|&nbsp;
                    <strong>Gewinn:</strong> <span id="vk_gewinn">0,00 &euro;</span>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-success" id="saveVerkaufBtn">Verkauf speichern</button>
                </div>
            </div>

            ${this._renderSaleList()}
        `;
    },

    _bindVerkaufForm() {
        // Manual toggle
        const manualToggle = document.getElementById('manualToggle');
        if (manualToggle) {
            manualToggle.addEventListener('click', () => {
                this._verkaufManual = !this._verkaufManual;
                this._renderTab();
            });
        }

        // Filter change
        const vkFilterMarke = document.getElementById('vkFilterMarke');
        const vkFilterStatus = document.getElementById('vkFilterStatus');
        if (vkFilterMarke) vkFilterMarke.addEventListener('change', () => {
            this._verkaufFilters.marke = vkFilterMarke.value;
            this._selectedPurchaseIds = [];  // reset on filter change
            this._renderTab();
        });
        if (vkFilterStatus) vkFilterStatus.addEventListener('change', () => {
            this._verkaufFilters.status = vkFilterStatus.value;
            this._selectedPurchaseIds = [];  // reset on filter change
            this._renderTab();
        });

        // Select all / clear selection (visible filtered items only)
        const vkSelectAllBtn = document.getElementById('vkSelectAllBtn');
        const vkClearSelBtn = document.getElementById('vkClearSelBtn');
        if (vkSelectAllBtn) {
            vkSelectAllBtn.addEventListener('click', () => {
                document.querySelectorAll('.inv-checkbox').forEach(cb => {
                    const id = cb.dataset.id;
                    if (!this._selectedPurchaseIds.includes(id)) {
                        this._selectedPurchaseIds.push(id);
                    }
                    cb.checked = true;
                });
                this._refreshVerkaufSummary();
            });
        }
        if (vkClearSelBtn) {
            vkClearSelBtn.addEventListener('click', () => {
                // Only clear IDs that are currently visible
                document.querySelectorAll('.inv-checkbox').forEach(cb => {
                    const id = cb.dataset.id;
                    const idx = this._selectedPurchaseIds.indexOf(id);
                    if (idx >= 0) this._selectedPurchaseIds.splice(idx, 1);
                    cb.checked = false;
                });
                this._refreshVerkaufSummary();
            });
        }

        // Checkbox changes
        document.querySelectorAll('.inv-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = cb.dataset.id;
                if (cb.checked) {
                    if (!this._selectedPurchaseIds.includes(id)) this._selectedPurchaseIds.push(id);
                    cb.closest('tr').classList.add('row-selected');
                } else {
                    const idx = this._selectedPurchaseIds.indexOf(id);
                    if (idx >= 0) this._selectedPurchaseIds.splice(idx, 1);
                    cb.closest('tr').classList.remove('row-selected');
                }
                this._refreshVerkaufSummary();
            });
        });

        // Platform select
        const plattformSelect = document.getElementById('vk_plattform');
        const customPlattformGroup = document.getElementById('vk_customPlattformGroup');
        if (plattformSelect) {
            plattformSelect.addEventListener('change', () => {
                customPlattformGroup.style.display = plattformSelect.value === 'Sonstiges' ? '' : 'none';
            });
        }

        // Netto calculation
        const calcNetto = () => {
            const vk = parseFloat(document.getElementById('vk_preis').value) || 0;
            const vkK = parseFloat(document.getElementById('vk_versandKaeufer').value) || 0;
            const geb = parseFloat(document.getElementById('vk_gebuehr').value) || 0;
            const versandVk = parseFloat(document.getElementById('vk_versandVk').value) || 0;
            const netto = Utils.calculateNetRevenue(vk, vkK, geb, versandVk);
            document.getElementById('vk_netto').textContent = Utils.formatCurrency(netto);

            const allPurchases = Store.getPurchases();
            const selectedEK = allPurchases
                .filter(p => this._selectedPurchaseIds.includes(p.id))
                .reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0), 0);
            const ekEl = document.getElementById('vk_ekTotal');
            const gewinnEl = document.getElementById('vk_gewinn');
            if (ekEl) ekEl.textContent = Utils.formatCurrency(selectedEK);
            if (gewinnEl) gewinnEl.textContent = Utils.formatCurrency(netto - selectedEK);
        };

        ['vk_preis', 'vk_versandKaeufer', 'vk_gebuehr', 'vk_versandVk'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', calcNetto);
        });

        // Material menge inputs → live cost preview
        document.querySelectorAll('.vk_mat_menge').forEach(el => {
            el.addEventListener('input', () => {
                const kosten = parseFloat(el.dataset.kosten) || 0;
                const menge = parseInt(el.value) || 0;
                const kostenEl = document.getElementById('vk_mat_kosten_' + el.dataset.matId);
                if (kostenEl) kostenEl.textContent = Utils.formatCurrency(kosten * menge);
                let total = 0;
                document.querySelectorAll('.vk_mat_menge').forEach(inp => {
                    total += (parseFloat(inp.dataset.kosten) || 0) * (parseInt(inp.value) || 0);
                });
                const totalEl = document.getElementById('vk_mat_total');
                if (totalEl) totalEl.textContent = Utils.formatCurrency(total);
            });
        });

        // Platform auto-fill fee
        if (plattformSelect) {
            const autoFillFee = () => {
                const gebField = document.getElementById('vk_gebuehr');
                if (!gebField || parseFloat(gebField.value) > 0) return;
                const gebuehren = Store.getPlattformGebuehren();
                const cfg = gebuehren[plattformSelect.value];
                if (cfg) { gebField.value = cfg.prozent; calcNetto(); }
            };
            plattformSelect.addEventListener('change', autoFillFee);
            // Auto-fill on initial render
            autoFillFee();
        }

        // Save button
        const saveBtn = document.getElementById('saveVerkaufBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const isManual = this._verkaufManual;

                if (!isManual && this._selectedPurchaseIds.length === 0) {
                    Utils.showToast('Bitte mindestens einen Artikel auswählen oder Manueller Verkauf aktivieren', 'warning');
                    return;
                }

                let plattform = plattformSelect ? plattformSelect.value : '';
                if (plattform === 'Sonstiges') {
                    const custom = document.getElementById('vk_customPlattform') ? document.getElementById('vk_customPlattform').value.trim() : '';
                    if (custom) { plattform = custom; Store.addPlatform(custom); }
                } else if (plattform) {
                    Store.addPlatform(plattform);
                }

                // Pre-generate ID so we can link material usage
                const saleId = Store.generateId();

                const vkPreisVal = parseFloat(document.getElementById('vk_preis').value) || 0;
                const vkVersandKVal = parseFloat(document.getElementById('vk_versandKaeufer').value) || 0;
                const vkGebuehrVal = parseFloat(document.getElementById('vk_gebuehr').value) || 0;
                const vkVersandVkVal = parseFloat(document.getElementById('vk_versandVk').value) || 0;
                if (vkPreisVal < 0 || vkVersandKVal < 0 || vkGebuehrVal < 0 || vkVersandVkVal < 0) {
                    Utils.showToast('Beträge dürfen nicht negativ sein', 'warning');
                    return;
                }

                const saleData = {
                    id: saleId,
                    datum: Utils.getDateInputValue('vk_datum'),
                    verkaufsplattform: plattform,
                    verkaufspreis: vkPreisVal,
                    versandkostenKaeufer: vkVersandKVal,
                    plattformgebuehrProzent: vkGebuehrVal,
                    versandkostenVerkaufer: vkVersandVkVal,
                    kaeufer: document.getElementById('vk_kaeufer') ? document.getElementById('vk_kaeufer').value.trim() : '',
                    notizen: document.getElementById('vk_notizen').value.trim()
                };

                if (isManual) {
                    // Manual sale - no linked purchases
                    const markeEl = document.getElementById('vk_marke');
                    const typEl = document.getElementById('vk_artikeltyp');
                    const grEl = document.getElementById('vk_groesse');
                    const beschEl = document.getElementById('vk_beschreibung');
                    saleData.marke = markeEl ? markeEl.value.trim() : '';
                    saleData.artikeltyp = typEl ? typEl.value.trim() : '';
                    saleData.groesse = grEl ? grEl.value.trim() : '';
                    saleData.beschreibung = beschEl ? beschEl.value.trim() : '';
                    Store.saveSale(saleData);
                } else if (this._selectedPurchaseIds.length === 1) {
                    // Single item - use legacy purchaseId for compatibility
                    const pid = this._selectedPurchaseIds[0];
                    const p = Store.getPurchases().find(x => x.id === pid);
                    saleData.purchaseId = pid;
                    saleData.marke = p ? p.marke : '';
                    saleData.artikeltyp = p ? p.artikeltyp : '';
                    saleData.groesse = p ? p.groesse : '';
                    saleData.beschreibung = p ? p.beschreibung : '';
                    Store.saveSale(saleData);
                } else {
                    // Multi item - use purchaseIds array
                    const purchases = Store.getPurchases().filter(p => this._selectedPurchaseIds.includes(p.id));
                    const marken = [...new Set(purchases.map(p => p.marke).filter(Boolean))];
                    saleData.purchaseIds = [...this._selectedPurchaseIds];
                    saleData.marke = marken.join(', ');
                    saleData.artikeltyp = `${purchases.length} Artikel`;
                    saleData.beschreibung = `Paket: ${purchases.map(p => [p.marke, p.artikeltyp, p.groesse].filter(Boolean).join(' ')).join(', ')}`;
                    Store.saveSaleMulti(saleData);
                }

                // Book material usage if any quantities entered
                const matItems = [];
                document.querySelectorAll('.vk_mat_menge').forEach(inp => {
                    const menge = parseInt(inp.value) || 0;
                    if (menge > 0) matItems.push({ materialId: inp.dataset.matId, menge });
                });
                if (matItems.length > 0) {
                    Store.bookMaterialVerbrauch(matItems, saleData.datum, 'verkauf', saleId,
                        (saleData.marke || '') + ' ' + (saleData.artikeltyp || ''));
                }

                Utils.showToast('Verkauf gespeichert', 'success');
                this._selectedPurchaseIds = [];
                this._renderTab();
            });
        }

        // Verkäufe-Liste: Bearbeiten / Stornieren / Löschen
        this._bindBuchungActions();
    },

    _refreshVerkaufSummary() {
        const allPurchases = Store.getPurchases();
        const selectedEK = allPurchases
            .filter(p => this._selectedPurchaseIds.includes(p.id))
            .reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0), 0);

        // Update summary card
        const cardTitles = document.querySelectorAll('.card-title');
        cardTitles.forEach(h => {
            if (h.textContent.startsWith('Ausgewählte Artikel:')) {
                h.textContent = `Ausgewählte Artikel: ${this._selectedPurchaseIds.length} (EK gesamt: ${Utils.formatCurrency(selectedEK)})`;
            }
        });

        const ekEl = document.getElementById('vk_ekTotal');
        if (ekEl) ekEl.textContent = Utils.formatCurrency(selectedEK);

        const nettoEl = document.getElementById('vk_netto');
        const gewinnEl = document.getElementById('vk_gewinn');
        if (nettoEl && gewinnEl) {
            const nettoStr = nettoEl.textContent.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
            const nettoVal = parseFloat(nettoStr) || 0;
            gewinnEl.textContent = Utils.formatCurrency(nettoVal - selectedEK);
        }

        // Update summary card opacity
        const summaryCard = document.querySelectorAll('.card')[1];
        if (summaryCard && !this._verkaufManual) {
            summaryCard.style.opacity = this._selectedPurchaseIds.length === 0 ? '0.6' : '1';
        }
    },

    // ======== ALLE BUCHUNGEN TAB ========
    _renderAlleTable() {
        const purchases = Store.getPurchases(true);
        const sales = Store.getSales(true);
        const brands = [...new Set([...purchases.map(p => p.marke), ...sales.map(s => s.marke)].filter(Boolean))];
        const platforms = Store.getPlatforms();
        const einkaufsquellen = [...new Set(purchases.map(p => p.einkaufsquelle).filter(Boolean))].sort();
        const f = this._filters;

        const brandOpts = brands.map(b => `<option value="${Utils.escapeHtml(b)}" ${f.marke === b ? 'selected' : ''}>${Utils.escapeHtml(b)}</option>`).join('');
        const platOpts = platforms.map(p => `<option value="${Utils.escapeHtml(p)}" ${f.plattform === p ? 'selected' : ''}>${Utils.escapeHtml(p)}</option>`).join('');
        const quellenOpts = einkaufsquellen.map(q => `<option value="${Utils.escapeHtml(q)}" ${f.einkaufsquelle === q ? 'selected' : ''}>${Utils.escapeHtml(q)}</option>`).join('');

        // Combine
        let allItems = [
            ...purchases.map(p => ({
                id: p.id, _source: 'purchase', datum: p.datum, typ: 'Einkauf',
                marke: p.marke || '', artikelNr: p.artikelNr || '', artikel: p.artikeltyp || '', beschreibung: p.beschreibung || '',
                betrag: -(parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1),
                plattform: p.einkaufsquelle || '', einkaufsquelle: p.einkaufsquelle || '',
                storniert: p.storniert || false,
                _stornoGrund: p.stornoGrund || '',
                _isPurchase: true
            })),
            ...sales.map(s => {
                const isMulti = s.purchaseIds && s.purchaseIds.length > 0;
                const artikel = isMulti
                    ? `${s.purchaseIds.length} Artikel (Paket)`
                    : (s.artikeltyp || '');
                return {
                    id: s.id, _source: 'sale', datum: s.datum,
                    typ: s._typ === 'rechnung' ? 'Rechnung' : s._typ === 'gutschrift' ? 'Gutschrift' : 'Verkauf',
                    marke: s.marke || '', artikelNr: '', artikel, beschreibung: s.beschreibung || '',
                    betrag: parseFloat(s.verkaufspreis) || 0,
                    plattform: s.verkaufsplattform || '', einkaufsquelle: '',
                    storniert: s.storniert || false,
                    _stornoGrund: s.stornoGrund || '',
                    _invoiceId: s._invoiceId || '',
                    _isPurchase: false,
                    _isMulti: isMulti,
                    _purchaseCount: isMulti ? s.purchaseIds.length : 0
                };
            })
        ];

        // Apply filters
        if (f.typ) allItems = allItems.filter(i => i.typ === f.typ);
        if (f.marke) allItems = allItems.filter(i => i.marke === f.marke);
        if (f.plattform) allItems = allItems.filter(i => i.plattform === f.plattform);
        if (f.einkaufsquelle) allItems = allItems.filter(i => i.einkaufsquelle === f.einkaufsquelle);
        if (f.von) allItems = allItems.filter(i => i.datum >= f.von);
        if (f.bis) allItems = allItems.filter(i => i.datum <= f.bis);

        // Sort
        if (this._sortCol) {
            allItems.sort((a, b) => {
                let va = a[this._sortCol], vb = b[this._sortCol];
                if (typeof va === 'number') return this._sortDir === 'asc' ? va - vb : vb - va;
                va = String(va || '').toLowerCase();
                vb = String(vb || '').toLowerCase();
                return this._sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
            });
        } else {
            allItems.sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
        }

        let rows = '';
        if (allItems.length === 0) {
            // Leerer Datenbestand ist kein Suchergebnis - s. Kommentar in js/ausgaben.js.
            const gefiltert = Object.keys(f).some(k => f[k]);
            rows = gefiltert
                ? '<tr><td colspan="8" class="table-empty">Keine Buchung passt zu diesem Filter.</td></tr>'
                : '<tr><td colspan="8" class="table-empty">Noch keine Buchungen erfasst.<br>' +
                  '<span style="font-size:12px;">Buchungen entstehen aus Ein- und Verkäufen im Lager, aus bezahlten Rechnungen und aus dem Bank-Import.</span><br>' +
                  `<button class="btn btn-primary btn-small" data-action="navigate" data-args='["bankimport"]' style="margin-top:12px;">` +
                  '<i class="ti ti-building-bank"></i> Kontoauszug importieren</button></td></tr>';
        } else {
            rows = allItems.map(i => {
                let platformBadge = '';
                if (i._isPurchase && i.einkaufsquelle) {
                    platformBadge = `<span class="platform-badge platform-buy">${Utils.escapeHtml(i.einkaufsquelle)}</span>`;
                } else if (!i._isPurchase && i.plattform) {
                    platformBadge = `<span class="platform-badge">${Utils.escapeHtml(i.plattform)}</span>`;
                }
                const multiPaketBadge = i._isMulti
                    ? `<span class="badge badge-info" style="margin-left:4px;font-size:10px;">${i._purchaseCount} Artikel</span>`
                    : '';
                const actionButtons = this._recordActions(i.id, i._source, i.datum, i.storniert, i._stornoGrund, !!i._invoiceId);
                return `
                <tr class="${i.storniert ? 'row-storniert' : ''}">
                    <td>${Utils.formatDate(i.datum)}</td>
                    <td><span class="badge ${i.typ === 'Verkauf' ? 'badge-success' : i.typ === 'Rechnung' ? 'badge-warning' : 'badge-info'}">${i.typ}</span></td>
                    <td>${Utils.escapeHtml(i.marke)}</td>
                    <td style="font-family:monospace;font-size:11px;white-space:nowrap;">${Utils.escapeHtml(i.artikelNr || '—')}</td>
                    <td>${Utils.escapeHtml(i.artikel)}${multiPaketBadge} ${Utils.escapeHtml(i.beschreibung)}</td>
                    <td style="text-align:right">${Utils.formatCurrency(i.betrag)}</td>
                    <td>${platformBadge}</td>
                    <td class="table-actions">
                        ${actionButtons}
                    </td>
                </tr>
            `}).join('');
        }

        const sortIcon = (col) => {
            if (this._sortCol !== col) return '';
            return this._sortDir === 'asc' ? ' sorted-asc' : ' sorted-desc';
        };

        return `
            <div class="filter-bar no-print">
                <div class="filter-group">
                    <label>Typ</label>
                    <select class="form-select" id="filterTyp">
                        <option value="">Alle</option>
                        <option value="Einkauf" ${f.typ === 'Einkauf' ? 'selected' : ''}>Einkauf</option>
                        <option value="Verkauf" ${f.typ === 'Verkauf' ? 'selected' : ''}>Verkauf</option>
                        <option value="Rechnung" ${f.typ === 'Rechnung' ? 'selected' : ''}>Rechnung</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Marke</label>
                    <select class="form-select" id="filterMarke">
                        <option value="">Alle</option>
                        ${brandOpts}
                    </select>
                </div>
                <div class="filter-group">
                    <label>Von</label>
                    <input type="date" class="form-input" id="filterVon" value="${f.von || ''}">
                </div>
                <div class="filter-group">
                    <label>Bis</label>
                    <input type="date" class="form-input" id="filterBis" value="${f.bis || ''}">
                </div>
                <div class="filter-group">
                    <label>Verkaufsplattform</label>
                    <select class="form-select" id="filterPlattform">
                        <option value="">Alle</option>
                        ${platOpts}
                    </select>
                </div>
                <div class="filter-group">
                    <label>Einkaufsquelle</label>
                    <select class="form-select" id="filterEinkaufsquelle">
                        <option value="">Alle</option>
                        ${quellenOpts}
                    </select>
                </div>
                <div class="filter-group">
                    <label>&nbsp;</label>
                    <button class="btn btn-small" id="exportCSVBtn">CSV Export</button>
                </div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th class="${sortIcon('datum')}" data-sort="datum">Datum</th>
                            <th class="${sortIcon('typ')}" data-sort="typ">Typ</th>
                            <th class="${sortIcon('marke')}" data-sort="marke">Marke</th>
                            <th>Art.-Nr.</th>
                            <th>Artikel</th>
                            <th class="${sortIcon('betrag')}" data-sort="betrag" style="text-align:right">Betrag</th>
                            <th class="${sortIcon('plattform')}" data-sort="plattform">Plattform</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    _bindAlleTable() {
        // Filters
        const applyFilters = () => {
            this._filters = {
                typ: document.getElementById('filterTyp').value,
                marke: document.getElementById('filterMarke').value,
                von: document.getElementById('filterVon').value,
                bis: document.getElementById('filterBis').value,
                plattform: document.getElementById('filterPlattform').value,
                einkaufsquelle: document.getElementById('filterEinkaufsquelle').value
            };
            this._renderTab();
        };

        ['filterTyp', 'filterMarke', 'filterVon', 'filterBis', 'filterPlattform', 'filterEinkaufsquelle'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', applyFilters);
        });

        // Sort
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this._sortCol === col) {
                    this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortCol = col;
                    this._sortDir = 'asc';
                }
                this._renderTab();
            });
        });

        // Bearbeiten / Stornieren / Löschen (gemeinsam für Alle-Buchungen + Verkäufe-Liste)
        this._bindBuchungActions();

        // CSV Export
        const exportBtn = document.getElementById('exportCSVBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const purchases = Store.getPurchases();
                const sales = Store.getSales();
                const rows = [['Datum', 'Typ', 'Marke', 'Artikel', 'Beschreibung', 'Betrag', 'Verkaufsplattform', 'Einkaufsquelle']];
                purchases.forEach(p => rows.push([p.datum, 'Einkauf', p.marke, p.artikeltyp, p.beschreibung, p.einkaufspreis, '', p.einkaufsquelle || '']));
                sales.forEach(s => rows.push([s.datum, 'Verkauf', s.marke, s.artikeltyp, s.beschreibung, s.verkaufspreis, s.verkaufsplattform || '', '']));
                Utils.downloadCSV(rows, 'buchungen_export.csv');
                Utils.showToast('CSV exportiert', 'success');
            });
        }
    },

    // Gemeinsame Aktions-Handler (Bearbeiten / Stornieren / Löschen) für
    // die Tabellen in "Alle Buchungen" UND der Verkäufe-Liste.
    _bindBuchungActions() {
        document.querySelectorAll('[data-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._showEditModal(btn.dataset.edit, btn.dataset.source);
            });
        });

        document.querySelectorAll('[data-storno]').forEach(btn => {
            btn.addEventListener('click', () => {
                const grund = prompt('Stornogrund angeben (Pflicht für Revisionssicherheit):');
                if (!grund) return;
                const id = btn.dataset.storno;
                if (btn.dataset.source === 'purchase') {
                    Store.stornoPurchase(id, grund);
                } else {
                    const result = Store.stornoSale(id, grund);
                    if (result && result.blocked && result.reason === 'invoice') {
                        Utils.showToast('Dieser Verkauf stammt aus einer Rechnung — bitte über die Rechnung stornieren.', 'error');
                        return;
                    }
                }
                Utils.showToast('Storniert', 'success');
                this._renderTab();
            });
        });

        document.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!confirm('Eintrag löschen? In einer offenen Periode wird er entfernt und im Änderungsprotokoll dokumentiert.')) return;
                const id = btn.dataset.delete;
                const res = btn.dataset.source === 'purchase' ? Store.deletePurchase(id) : Store.deleteSale(id);
                if (res && res.blocked) { Utils.showToast(res.reason === 'invoice' ? 'Verkauf stammt aus einer Rechnung — bitte die Rechnung stornieren' : 'Artikel ist verkauft — bitte zuerst den verknüpften Verkauf stornieren/löschen', 'warning'); return; }
                if (res && res.storno) Utils.showToast('Periode ist abgeschlossen — storniert statt gelöscht', 'warning');
                else Utils.showToast('Gelöscht', 'success');
                this._renderTab();
            });
        });
    },

    // Aktions-Buttons je Datensatz — GoBD-bewusst (offen vs. festgeschrieben).
    _recordActions(id, source, datum, storniert, stornoGrund, isInvoice) {
        if (storniert) {
            return `<span class="badge badge-neutral" title="${Utils.escapeHtml(stornoGrund || 'Storniert')}">Storniert</span>`;
        }
        if (isInvoice) {
            return `<span class="badge badge-info" title="Stammt aus einer Rechnung — Änderungen bitte im Rechnungen-Modul (Rechnung stornieren)"><i class="ti ti-file-invoice"></i> aus Rechnung</span>`;
        }
        if (Store.isPeriodLocked(datum)) {
            return `<span class="badge badge-warning" title="Periode festgeschrieben — nur Storno möglich" style="margin-right:4px;"><i class="ti ti-lock"></i></span>
                <button class="btn btn-small btn-danger" data-storno="${id}" data-source="${source}">Stornieren</button>`;
        }
        return `<button class="btn btn-small" data-edit="${id}" data-source="${source}">Bearbeiten</button>
            <button class="btn btn-small btn-danger" data-delete="${id}" data-source="${source}" title="In offener Periode löschen (wird protokolliert)">Löschen</button>`;
    },

    // ======== VERKÄUFE-LISTE (eigene Liste im Verkauf-Tab) ========
    _renderSaleList() {
        const sales = Store.getSales(true).slice().sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
        let rows = '';
        if (sales.length === 0) {
            rows = '<tr><td colspan="6" class="table-empty">Noch keine Verkäufe erfasst</td></tr>';
        } else {
            rows = sales.map(s => {
                const isMulti = s.purchaseIds && s.purchaseIds.length > 0;
                const artikel = isMulti ? `${s.purchaseIds.length} Artikel (Paket)` : (s.artikeltyp || '');
                const platBadge = s.verkaufsplattform ? `<span class="platform-badge">${Utils.escapeHtml(s.verkaufsplattform)}</span>` : '';
                return `
                <tr class="${s.storniert ? 'row-storniert' : ''}">
                    <td>${Utils.formatDate(s.datum)}</td>
                    <td>${Utils.escapeHtml(s.marke || '')}</td>
                    <td>${Utils.escapeHtml(artikel)} ${Utils.escapeHtml(s.beschreibung || '')}</td>
                    <td style="text-align:right">${Utils.formatCurrency(s.verkaufspreis)}</td>
                    <td>${platBadge}</td>
                    <td class="table-actions">${this._recordActions(s.id, 'sale', s.datum, s.storniert, s.stornoGrund, !!s._invoiceId)}</td>
                </tr>`;
            }).join('');
        }

        return `
            <div class="card" style="margin-bottom:16px;">
                <div class="card-header">
                    <div class="card-title">Verkäufe (${sales.filter(s => !s.storniert).length})</div>
                </div>
                <div class="table-container" style="margin-bottom:0;">
                    <table>
                        <thead>
                            <tr>
                                <th>Datum</th>
                                <th>Marke</th>
                                <th>Artikel</th>
                                <th style="text-align:right">Verkaufspreis</th>
                                <th>Plattform</th>
                                <th>Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // ======== EDIT MODAL ========
    _showEditModal(id, source) {
        if (source === 'purchase') {
            const p = Store.getPurchases().find(x => x.id === id);
            if (!p) return;
            const brands = Store.getBrands();
            const brandOptions = brands.map(b => `<option value="${Utils.escapeHtml(b)}">`).join('');
            const einkaufsquellen = Store.getEinkaufsquellen();
            const quellenOptions = einkaufsquellen.map(q => `<option value="${Utils.escapeHtml(q)}" ${p.einkaufsquelle === q ? 'selected' : ''}>${Utils.escapeHtml(q)}</option>`).join('');

            const body = `
                <form id="editPurchaseForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <input type="date" class="form-input" id="ep_datum" value="${p.datum || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Marke</label>
                            <input type="text" class="form-input" id="ep_marke" list="epMarkenList" maxlength="300" value="${Utils.escapeHtml(p.marke || '')}">
                            <datalist id="epMarkenList">${brandOptions}</datalist>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Artikeltyp</label>
                            <select class="form-select" id="ep_artikeltyp">
                                ${['Jacke','Hose','Shirt','Hoodie','Schuhe','Accessoire','Sonstiges'].map(t => `<option value="${t}" ${p.artikeltyp === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Einkaufsquelle / Plattform</label>
                            <select class="form-select" id="ep_einkaufsquelle">
                                ${quellenOptions}
                            </select>
                        </div>
                        <div class="form-group" id="ep_customQuelleGroup" style="display:none;">
                            <label class="form-label">Eigene Quelle</label>
                            <input type="text" class="form-input" id="ep_customQuelle" maxlength="300" placeholder="Quelle eingeben...">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Größe</label>
                            <input type="text" class="form-input" id="ep_groesse" maxlength="300" value="${Utils.escapeHtml(p.groesse || '')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Beschreibung</label>
                        <input type="text" class="form-input" id="ep_beschreibung" maxlength="300" value="${Utils.escapeHtml(p.beschreibung || '')}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="ep_preis">Einkaufspreis (Brutto)</label>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="ep_preis" value="${p.einkaufspreis || 0}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="ep_anzahl">Anzahl</label>
                            <input type="number" min="1" max="9999999" class="form-input" id="ep_anzahl" value="${p.anzahl || 1}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="ep_ustSatz">USt-Satz</label>
                            <select class="form-select" id="ep_ustSatz">
                                <option value="19" ${(p.ustSatz === 19 || p.ustSatz == null) ? 'selected' : ''}>19 % (Standard)</option>
                                <option value="7"  ${p.ustSatz === 7 ? 'selected' : ''}>7 % (ermäßigt)</option>
                                <option value="0"  ${p.ustSatz === 0 ? 'selected' : ''}>0 % (keine USt)</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Verkäufer / Rechnungsaussteller</label>
                            <input type="text" class="form-input" id="ep_lieferant" maxlength="200" value="${Utils.escapeHtml(p.lieferantName || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Steuernr. / USt-IdNr. Verkäufer</label>
                            <input type="text" class="form-input" id="ep_lieferantSteuerId" maxlength="50" value="${Utils.escapeHtml(p.lieferantSteuerId || '')}" placeholder="nur bei Rechnung >250€ Pflicht">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Beleg-Foto/Scan ${p.belegFoto ? '(vorhanden — Datei wählen zum Ersetzen)' : ''} <span style="font-weight:400;color:var(--text-muted);">— nur relevant bei Vorsteuerabzug (§14 UStG)</span></label>
                        ${p.belegFoto ? `<div style="margin-bottom:6px;"><a href="#" id="ep_belegFotoView" style="font-size:12px;">📎 aktuelles Beleg-Foto ansehen</a></div>` : ''}
                        <input type="file" accept="image/*" class="form-input" id="ep_belegFoto">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Notizen</label>
                        <textarea class="form-textarea" id="ep_notizen" maxlength="1000">${Utils.escapeHtml(p.notizen || '')}</textarea>
                    </div>
                </form>
            `;
            const footer = `
                <button class="btn" data-action="close-modal">Abbrechen</button>
                <button class="btn btn-primary" id="savePurchaseEdit">Speichern</button>
            `;
            App.showModal('Einkauf bearbeiten', body, footer);

            // Show/hide custom source input
            const epQuelleSelect = document.getElementById('ep_einkaufsquelle');
            const epCustomQuelleGroup = document.getElementById('ep_customQuelleGroup');
            epQuelleSelect.addEventListener('change', () => {
                epCustomQuelleGroup.style.display = epQuelleSelect.value === 'Sonstiges' ? '' : 'none';
            });

            const epBelegFotoViewLink = document.getElementById('ep_belegFotoView');
            if (epBelegFotoViewLink) epBelegFotoViewLink.addEventListener('click', (ev) => {
                ev.preventDefault();
                App.showModal('Beleg-Foto', `<img src="${p.belegFoto}" style="max-width:100%;border-radius:var(--radius-sm);">`, '<button class="btn" data-action="close-modal">Schließen</button>');
            });

            document.getElementById('savePurchaseEdit').addEventListener('click', async () => {
                const marke = document.getElementById('ep_marke').value.trim();
                if (marke) Store.addBrand(marke);

                let einkaufsquelle = epQuelleSelect.value;
                if (einkaufsquelle === 'Sonstiges') {
                    const custom = document.getElementById('ep_customQuelle').value.trim();
                    if (custom) {
                        einkaufsquelle = custom;
                        Store.addEinkaufsquelle(custom);
                    }
                }

                const newFotoFile = document.getElementById('ep_belegFoto')?.files?.[0];
                let belegFoto = p.belegFoto;
                if (newFotoFile) {
                    try { belegFoto = await Utils.sanitizeImageFile(newFotoFile); }
                    catch (err) { Utils.showToast(err.message || 'Beleg-Foto konnte nicht gelesen werden', 'error'); return; }
                }

                const epPreisVal = parseFloat(document.getElementById('ep_preis').value) || 0;
                const epAnzahlVal = parseInt(document.getElementById('ep_anzahl').value) || 1;
                if (epPreisVal < 0) {
                    Utils.showToast('Einkaufspreis darf nicht negativ sein', 'warning');
                    return;
                }
                if (epAnzahlVal < 1) {
                    Utils.showToast('Anzahl muss mindestens 1 sein', 'warning');
                    return;
                }

                Store.savePurchase({
                    id: p.id,
                    datum: Utils.getDateInputValue('ep_datum'),
                    marke,
                    artikeltyp: document.getElementById('ep_artikeltyp').value,
                    groesse: document.getElementById('ep_groesse').value.trim(),
                    beschreibung: document.getElementById('ep_beschreibung').value.trim(),
                    einkaufspreis: epPreisVal,
                    anzahl: epAnzahlVal,
                    ustSatz: parseInt(document.getElementById('ep_ustSatz').value) ?? 19,
                    einkaufsquelle: einkaufsquelle,
                    lieferantName: document.getElementById('ep_lieferant').value.trim(),
                    lieferantSteuerId: document.getElementById('ep_lieferantSteuerId').value.trim(),
                    belegFoto,
                    notizen: document.getElementById('ep_notizen').value.trim(),
                    status: p.status,
                    createdAt: p.createdAt
                });
                App.closeModal();
                Utils.showToast('Einkauf aktualisiert', 'success');
                this._renderTab();
            });
        } else {
            const s = Store.getSales().find(x => x.id === id);
            if (!s) return;
            const platforms = Store.getPlatforms();
            const platOptions = platforms.filter(p => p !== 'Sonstiges').map(p => `<option value="${Utils.escapeHtml(p)}" ${s.verkaufsplattform === p ? 'selected' : ''}>${Utils.escapeHtml(p)}</option>`).join('');

            const body = `
                <form id="editSaleForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <input type="date" class="form-input" id="es_datum" value="${s.datum || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Verkaufsplattform</label>
                            <select class="form-select" id="es_plattform">
                                ${platOptions}
                                <option value="Sonstiges" ${!platforms.includes(s.verkaufsplattform) && s.verkaufsplattform ? 'selected' : ''}>Sonstiges</option>
                            </select>
                        </div>
                        <div class="form-group" id="es_customPlattformGroup" style="${!platforms.includes(s.verkaufsplattform) && s.verkaufsplattform ? '' : 'display:none'}">
                            <label class="form-label">Eigene Plattform</label>
                            <input type="text" class="form-input" id="es_customPlattform" maxlength="300" value="${!platforms.includes(s.verkaufsplattform) && s.verkaufsplattform ? Utils.escapeHtml(s.verkaufsplattform) : ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Marke</label>
                            <input type="text" class="form-input" id="es_marke" maxlength="300" value="${Utils.escapeHtml(s.marke || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Artikeltyp</label>
                            <input type="text" class="form-input" id="es_artikeltyp" maxlength="300" value="${Utils.escapeHtml(s.artikeltyp || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Größe</label>
                            <input type="text" class="form-input" id="es_groesse" maxlength="300" value="${Utils.escapeHtml(s.groesse || '')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Beschreibung</label>
                        <input type="text" class="form-input" id="es_beschreibung" maxlength="300" value="${Utils.escapeHtml(s.beschreibung || '')}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Verkaufspreis</label>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="es_preis" value="${s.verkaufspreis || 0}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Versandkosten (Käufer)</label>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="es_versandK" value="${s.versandkostenKaeufer || 0}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Plattformgebühr (%)</label>
                            <input type="number" step="0.01" min="0" max="100" class="form-input" id="es_gebuehr" value="${s.plattformgebuehrProzent || 0}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Versandkosten (meine)</label>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="es_versandV" value="${s.versandkostenVerkaufer || 0}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Käufer</label>
                            <input type="text" class="form-input" id="es_kaeufer" maxlength="300" value="${Utils.escapeHtml(s.kaeufer || '')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Notizen</label>
                        <textarea class="form-textarea" id="es_notizen" maxlength="1000">${Utils.escapeHtml(s.notizen || '')}</textarea>
                    </div>
                </form>
            `;
            const footer = `
                <button class="btn" data-action="close-modal">Abbrechen</button>
                <button class="btn btn-primary" id="saveSaleEdit">Speichern</button>
            `;
            App.showModal('Verkauf bearbeiten', body, footer);

            // Show/hide custom platform input
            const esPlattformSelect = document.getElementById('es_plattform');
            const esCustomPlattformGroup = document.getElementById('es_customPlattformGroup');
            esPlattformSelect.addEventListener('change', () => {
                esCustomPlattformGroup.style.display = esPlattformSelect.value === 'Sonstiges' ? '' : 'none';
            });

            document.getElementById('saveSaleEdit').addEventListener('click', () => {
                let plat = esPlattformSelect.value;
                if (plat === 'Sonstiges') {
                    const custom = document.getElementById('es_customPlattform').value.trim();
                    if (custom) {
                        plat = custom;
                        Store.addPlatform(custom);
                    }
                } else {
                    Store.addPlatform(plat);
                }

                const esPreisVal = parseFloat(document.getElementById('es_preis').value) || 0;
                const esVersandKVal = parseFloat(document.getElementById('es_versandK').value) || 0;
                const esGebuehrVal = parseFloat(document.getElementById('es_gebuehr').value) || 0;
                const esVersandVVal = parseFloat(document.getElementById('es_versandV').value) || 0;
                if (esPreisVal < 0 || esVersandKVal < 0 || esGebuehrVal < 0 || esVersandVVal < 0) {
                    Utils.showToast('Beträge dürfen nicht negativ sein', 'warning');
                    return;
                }

                Store.saveSale({
                    id: s.id,
                    datum: Utils.getDateInputValue('es_datum'),
                    purchaseId: s.purchaseId,
                    purchaseIds: s.purchaseIds,  // preserve multi-sale links
                    marke: document.getElementById('es_marke').value.trim(),
                    artikeltyp: document.getElementById('es_artikeltyp').value.trim(),
                    groesse: document.getElementById('es_groesse').value.trim(),
                    beschreibung: document.getElementById('es_beschreibung').value.trim(),
                    verkaufsplattform: plat,
                    verkaufspreis: esPreisVal,
                    versandkostenKaeufer: esVersandKVal,
                    plattformgebuehrProzent: esGebuehrVal,
                    versandkostenVerkaufer: esVersandVVal,
                    kaeufer: document.getElementById('es_kaeufer').value.trim(),
                    notizen: document.getElementById('es_notizen').value.trim(),
                    createdAt: s.createdAt
                });
                App.closeModal();
                Utils.showToast('Verkauf aktualisiert', 'success');
                this._renderTab();
            });
        }
    },

    // ======== CSV IMPORT MODAL ========
    _showCSVImportModal() {
        const body = `
            <div class="section">
                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px;">
                    CSV-Datei mit Einkaufs- oder Verkaufsdaten importieren. Trennzeichen: Semikolon (;) oder Komma.
                </p>
                <div style="margin-bottom:12px;">
                    <strong>Schritt 1:</strong> Vorlage herunterladen
                </div>
                <div style="display:flex;gap:8px;margin-bottom:16px;">
                    <button class="btn btn-small" id="csvTemplateEinkaufBtn">Einkauf-Template.csv</button>
                    <button class="btn btn-small" id="csvTemplateVerkaufBtn">Verkauf-Template.csv</button>
                </div>
                <div style="margin-bottom:12px;">
                    <strong>Schritt 2:</strong> Ausgefüllte CSV-Datei hochladen
                </div>
                <input type="file" accept=".csv,.txt,.xlsx,.xls" id="csvFileInput" class="form-input">
            </div>
            <div id="csvPreviewArea" style="display:none;">
                <div style="margin-bottom:8px;"><strong>Schritt 3:</strong> Vorschau prüfen & Spalten zuordnen</div>
                <div class="section-title">Vorschau (erste 5 Zeilen)</div>
                <div class="csv-preview" id="csvPreview"></div>
                <div class="section-title" style="margin-top:16px;">Spalten-Zuordnung</div>
                <div id="csvMapping"></div>
                <div id="csvImportResult" style="display:none;margin-top:12px;padding:8px;border-radius:6px;"></div>
                <div class="form-actions">
                    <button class="btn btn-primary" id="csvDoImport">Importieren</button>
                </div>
            </div>
        `;
        App.showModal('CSV Import - Einkäufe', body, '');

        let parsedRows = [];
        let headers = [];

        document.getElementById('csvTemplateEinkaufBtn').addEventListener('click', () => {
            Utils.downloadCSV([
                ['Datum', 'Marke', 'Artikeltyp', 'Größe', 'Beschreibung', 'Einkaufspreis', 'Anzahl', 'Einkaufsquelle', 'Notizen'],
                ['2026-04-08', 'Nike', 'Schuhe', '42', 'Air Max 90', '80.00', '1', 'Privatkauf', '']
            ], 'Einkauf-Template.csv');
        });

        document.getElementById('csvTemplateVerkaufBtn').addEventListener('click', () => {
            Utils.downloadCSV([
                ['Datum', 'Marke', 'Artikeltyp', 'Größe', 'Beschreibung', 'Verkaufspreis', 'Versandkosten Käufer', 'Plattformgebühr %', 'Versandkosten Verkäufer', 'Verkaufsplattform', 'Käufer', 'Notizen'],
                ['2026-04-08', 'Nike', 'Schuhe', '42', 'Air Max 90', '150.00', '5.99', '5', '4.99', 'Vinted', 'Max Mustermann', '']
            ], 'Verkauf-Template.csv');
        });

        const processCSVRows = () => {
            if (parsedRows.length < 2) {
                Utils.showToast('Datei ist leer oder hat nur eine Zeile', 'warning');
                return;
            }
            headers = parsedRows[0];
            const dataRows = parsedRows.slice(1, 6);

            // Show preview
            let previewHtml = '<table><thead><tr>' + headers.map(h => `<th>${Utils.escapeHtml(h)}</th>`).join('') + '</tr></thead><tbody>';
            dataRows.forEach(row => {
                previewHtml += '<tr>' + row.map(c => `<td>${Utils.escapeHtml(c)}</td>`).join('') + '</tr>';
            });
            previewHtml += '</tbody></table>';
            document.getElementById('csvPreview').innerHTML = previewHtml;

            // Show mapping
            const fields = ['-- Ignorieren --', 'datum', 'marke', 'artikeltyp', 'groesse', 'beschreibung', 'einkaufspreis', 'anzahl', 'einkaufsquelle', 'notizen'];
            const fieldLabels = ['-- Ignorieren --', 'Datum', 'Marke', 'Artikeltyp', 'Größe', 'Beschreibung', 'Einkaufspreis', 'Anzahl', 'Einkaufsquelle', 'Notizen'];
            let mappingHtml = '';
            headers.forEach((h, i) => {
                const normalizedHeader = h.toLowerCase().trim().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
                let autoMatch = -1;
                fields.forEach((f, fi) => {
                    const normalizedField = f.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
                    if (normalizedField === normalizedHeader || f.toLowerCase() === h.toLowerCase().trim()) {
                        autoMatch = fi;
                    }
                });
                // Also try matching display labels
                if (autoMatch <= 0) {
                    fieldLabels.forEach((fl, fi) => {
                        if (fl.toLowerCase() === h.toLowerCase().trim()) {
                            autoMatch = fi;
                        }
                    });
                }
                mappingHtml += `<div class="mapping-row">
                    <div class="csv-col">${Utils.escapeHtml(h)}</div>
                    <select class="form-select csv-map" data-col="${i}">
                        ${fields.map((f, fi) => `<option value="${f}" ${fi === autoMatch ? 'selected' : ''}>${fieldLabels[fi]}</option>`).join('')}
                    </select>
                </div>`;
            });
            document.getElementById('csvMapping').innerHTML = mappingHtml;
            document.getElementById('csvPreviewArea').style.display = 'block';
        };

        document.getElementById('csvFileInput').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const isExcel = file.name.match(/\.(xlsx|xls)$/i);
            if (isExcel) {
                // Frueher stand hier "isExcel && typeof XLSX !== 'undefined'": fehlte die
                // Bibliothek, landete die Excel-Datei still im CSV-Zweig und wurde als Muell
                // geparst. Mit dem Lazy-Load waere genau das der Normalfall geworden.
                Utils.ensureXlsx().catch(err => { Utils.showToast(err.message, 'error'); return Promise.reject(err); }).then(() => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const wb = XLSX.read(ev.target.result, { type: 'array' });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                        parsedRows = raw.map(row => row.map(cell => String(cell == null ? '' : cell)));
                        processCSVRows();
                    } catch (err) {
                        Utils.showToast('Fehler beim Lesen der Excel-Datei: ' + err.message, 'error');
                    }
                };
                reader.readAsArrayBuffer(file);
                }, () => { /* Fehler wurde oben schon gemeldet */ });
            } else {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    parsedRows = Utils.parseCSV(ev.target.result);
                    processCSVRows();
                };
                reader.readAsText(file);
            }
        });

        document.getElementById('csvDoImport').addEventListener('click', () => {
            if (parsedRows.length < 2) return;
            const mappings = {};
            document.querySelectorAll('.csv-map').forEach(sel => {
                const col = parseInt(sel.dataset.col);
                const field = sel.value;
                if (field !== '-- Ignorieren --') mappings[field] = col;
            });

            let imported = 0;
            let skipped = 0;
            parsedRows.slice(1).forEach(row => {
                const obj = { status: 'verfuegbar' };
                for (const [field, col] of Object.entries(mappings)) {
                    const val = row[col] || '';
                    if (field === 'einkaufspreis') obj[field] = parseFloat(val.replace(',', '.')) || 0;
                    else if (field === 'anzahl') obj[field] = parseInt(val) || 1;
                    else obj[field] = val.trim();
                }
                if (!obj.marke && !obj.beschreibung) {
                    skipped++;
                    return;
                }
                if (obj.marke) Store.addBrand(obj.marke);
                if (obj.einkaufsquelle) Store.addEinkaufsquelle(obj.einkaufsquelle);
                Store.savePurchase(obj);
                imported++;
            });

            const resultEl = document.getElementById('csvImportResult');
            if (resultEl) {
                resultEl.style.display = 'block';
                resultEl.style.background = 'var(--bg-card)';
                resultEl.innerHTML = `<strong>${imported}</strong> Einkäufe importiert` + (skipped > 0 ? `, <strong>${skipped}</strong> übersprungen (keine Daten)` : '');
            }

            App.closeModal();
            Utils.showToast(`${imported} Einkäufe importiert` + (skipped > 0 ? `, ${skipped} übersprungen` : ''), 'success');
            this._renderTab();
        });
    }
};
