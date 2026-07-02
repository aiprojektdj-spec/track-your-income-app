// ============================================
// Ausgaben Module - Expenses Management
// ============================================
const Ausgaben = {
    _filterKategorie: '',
    _filterVon: '',
    _filterBis: '',

    _kategorien: ['Versand', 'Verpackung', 'Plattformgebühren', 'Fahrtkosten', 'Büro', 'Equipment', 'Software/Abos', 'Sonstiges'],

    render() {
        const activeExpenses = Store.getExpenses();      // nur aktive (für Totals/Breakdown)
        const expenses = Store.getExpenses(true);        // inkl. stornierte (für Tabellenansicht)
        const f = this;

        // Summary — nur aktive Ausgaben zählen
        const totalExpenses = activeExpenses.reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0);
        const catBreakdown = {};
        this._kategorien.forEach(k => catBreakdown[k] = 0);
        activeExpenses.forEach(e => {
            const cat = e.kategorie || 'Sonstiges';
            catBreakdown[cat] = (catBreakdown[cat] || 0) + (parseFloat(e.betrag) || 0);
        });

        // Filter
        let filtered = [...expenses];
        if (f._filterKategorie) filtered = filtered.filter(e => e.kategorie === f._filterKategorie);
        if (f._filterVon) filtered = filtered.filter(e => e.datum >= f._filterVon);
        if (f._filterBis) filtered = filtered.filter(e => e.datum <= f._filterBis);
        filtered.sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

        const katOptions = this._kategorien.map(k =>
            `<option value="${Utils.escapeHtml(k)}">${Utils.escapeHtml(k)}</option>`
        ).join('');

        // Summary cards - top categories
        const topCats = Object.entries(catBreakdown).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
        let summaryCards = `
            <div class="card stat-card danger">
                <div class="card-label">Gesamtausgaben</div>
                <div class="card-value">${Utils.formatCurrency(totalExpenses)}</div>
                <div class="card-subtitle">${expenses.length} Posten</div>
            </div>
        `;
        topCats.forEach(([cat, val]) => {
            summaryCards += `
                <div class="card stat-card">
                    <div class="card-label">${Utils.escapeHtml(cat)}</div>
                    <div class="card-value">${Utils.formatCurrency(val)}</div>
                    <div class="card-subtitle">${((val / totalExpenses) * 100).toFixed(1)}% der Ausgaben</div>
                </div>
            `;
        });

        let rows = '';
        if (filtered.length === 0) {
            rows = '<tr><td colspan="6" class="table-empty">Keine Ausgaben vorhanden</td></tr>';
        } else {
            rows = filtered.map(e => `
                <tr${e.storniert ? ' class="row-storniert"' : ''}>
                    <td>${Utils.formatDate(e.datum)}</td>
                    <td><span class="badge badge-info">${Utils.escapeHtml(e.kategorie || '')}</span> <span class="badge badge-neutral" title="SKR03-Konto (DATEV)" style="font-family:monospace;">${typeof DatevExport !== 'undefined' ? DatevExport.kontoForKategorie(e.kategorie, 'SKR03') : ''}</span></td>
                    <td>${Utils.escapeHtml(e.beschreibung || '')}</td>
                    <td style="text-align:right">${Utils.formatCurrency(e.betrag)}</td>
                    <td>${Utils.escapeHtml(e.belegNr || '')}</td>
                    <td class="table-actions">
                        ${e.storniert
                            ? `<span class="badge badge-neutral" title="${Utils.escapeHtml(e.stornoGrund || 'Storniert')}">Storniert</span>`
                            : Store.isPeriodLocked(e.datum)
                                ? `<span class="badge badge-warning" title="Periode festgeschrieben — nur Storno möglich" style="margin-right:4px;">🔒</span>
                                   <button class="btn btn-small btn-danger" data-storno-expense="${e.id}">Stornieren</button>`
                                : `<button class="btn btn-small" data-edit-expense="${e.id}">Bearbeiten</button>
                                   <button class="btn btn-small btn-danger" data-delete-expense="${e.id}" title="In offener Periode löschen (wird protokolliert)">Löschen</button>`
                        }
                    </td>
                </tr>
            `).join('');
        }

        return `
            <div class="page-header">
                <h2>Ausgaben</h2>
                <div class="page-header-actions no-print">
                    <button class="btn" id="expenseExportCSV">CSV Export</button>
                </div>
            </div>

            <div class="stats-grid">${summaryCards}</div>

            <div class="info-box" style="margin-bottom:16px;padding:12px 16px;background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);font-size:13px;color:var(--text-secondary);">
                <strong style="color:var(--info);">💡 Betriebsausgaben vs. Wareneinkauf</strong><br>
                Hier erfasst du <strong>Betriebsausgaben</strong> (z.B. Versandmaterial, Software, Büro, Fahrtkosten).
                <strong>Wareneinkauf</strong> (Artikel, die du weiterverkaufst) wird unter
                <a href="#" onclick="App.navigate('buchungen'); return false;" style="color:var(--info);">Buchungen → Einkauf</a> erfasst
                und fließt automatisch in die EÜR ein.
            </div>

            <div class="card" style="margin-bottom:20px;">
                <div class="card-header">
                    <div class="card-title">Neue Ausgabe</div>
                </div>
                <form id="expenseForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <input type="date" class="form-input" id="exp_datum" value="${Utils.todayISO()}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Kategorie</label>
                            <select class="form-select" id="exp_kategorie">${katOptions}</select>
                            <div id="exp_fahrtHint" style="display:none;margin-top:6px;padding:7px 10px;background:var(--warning-bg);border:1px solid var(--warning);border-radius:var(--radius-sm);font-size:12px;color:var(--warning);">
                                ⚠️ Fahrtkosten werden bereits automatisch aus dem <strong>Fahrtenbuch</strong> in die EÜR übernommen. Nur eintragen, wenn der Betrag <em>nicht</em> im Fahrtenbuch erfasst ist (z.B. Taxibelege).
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Betrag</label>
                            <input type="number" step="0.01" min="0" class="form-input" id="exp_betrag" placeholder="0,00">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Beschreibung</label>
                            <input type="text" class="form-input" id="exp_beschreibung" placeholder="Was wurde bezahlt?">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Beleg-Nr. (optional)</label>
                            <input type="text" class="form-input" id="exp_belegNr" placeholder="z.B. RE-2026-001">
                        </div>
                    </div>
                    <div id="expMatLagerSection" style="display:none;border:1px solid var(--info);border-radius:var(--radius);padding:12px;margin-bottom:12px;background:var(--info-bg);">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                            <input type="checkbox" id="exp_matToggle" style="width:16px;height:16px;">
                            <label for="exp_matToggle" style="font-size:13px;font-weight:600;color:var(--info);cursor:pointer;">
                                📦 Als Materiallager erfassen (Mengen tracken)
                            </label>
                        </div>
                        <div id="expMatDetail" style="display:none;">
                            <div class="form-row" style="margin-top:8px;">
                                <div class="form-group" style="flex:2">
                                    <label class="form-label">Materialart</label>
                                    <select class="form-select" id="exp_matArt">
                                        <option value="">– Manuell –</option>
                                        ${Store.getMaterialBestand().map(m =>
                                            `<option value="${m.id}">${Utils.escapeHtml(m.name)}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Menge (Stück)</label>
                                    <input type="number" step="1" min="1" class="form-input" id="exp_matMenge" placeholder="50">
                                </div>
                            </div>
                            <div class="form-hint" style="font-size:12px;color:var(--text-muted);">
                                Der Einkauf wird im Materiallager eingebucht. Bestand und gleitender Durchschnittspreis werden aktualisiert.
                            </div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Ausgabe speichern</button>
                    </div>
                </form>
            </div>

            <div class="filter-bar no-print">
                <div class="filter-group">
                    <label>Kategorie</label>
                    <select class="form-select" id="expFilterKat">
                        <option value="">Alle</option>
                        ${this._kategorien.map(k => `<option value="${Utils.escapeHtml(k)}" ${f._filterKategorie === k ? 'selected' : ''}>${Utils.escapeHtml(k)}</option>`).join('')}
                    </select>
                </div>
                <div class="filter-group">
                    <label>Von</label>
                    <input type="date" class="form-input" id="expFilterVon" value="${f._filterVon}">
                </div>
                <div class="filter-group">
                    <label>Bis</label>
                    <input type="date" class="form-input" id="expFilterBis" value="${f._filterBis}">
                </div>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Datum</th>
                            <th>Kategorie</th>
                            <th>Beschreibung</th>
                            <th style="text-align:right">Betrag</th>
                            <th>Beleg-Nr.</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    init() {
        // Show/hide material section based on category
        const katSel = document.getElementById('exp_kategorie');
        const matSection = document.getElementById('expMatLagerSection');
        const matToggle = document.getElementById('exp_matToggle');
        const matDetail = document.getElementById('expMatDetail');

        const updateMatSection = () => {
            if (!matSection) return;
            const isVerpackung = katSel && (katSel.value === 'Verpackung' || katSel.value === 'Verpackung / Versandmaterial');
            matSection.style.display = isVerpackung ? '' : 'none';
            if (!isVerpackung && matToggle) matToggle.checked = false;
            // Fahrtkosten warning
            const fahrtHint = document.getElementById('exp_fahrtHint');
            if (fahrtHint) fahrtHint.style.display = (katSel && katSel.value === 'Fahrtkosten') ? '' : 'none';
        };
        if (katSel) { katSel.addEventListener('change', updateMatSection); updateMatSection(); }
        if (matToggle) matToggle.addEventListener('change', () => {
            if (matDetail) matDetail.style.display = matToggle.checked ? '' : 'none';
        });

        // Form submit
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const datum = Utils.getDateInputValue('exp_datum');
            const betrag = parseFloat(document.getElementById('exp_betrag').value) || 0;
            Store.saveExpense({
                datum,
                kategorie: document.getElementById('exp_kategorie').value,
                beschreibung: document.getElementById('exp_beschreibung').value.trim(),
                betrag,
                belegNr: document.getElementById('exp_belegNr').value.trim()
            });

            // Optionally book to materiallager
            if (matToggle?.checked) {
                const matId = document.getElementById('exp_matArt')?.value;
                const menge = parseInt(document.getElementById('exp_matMenge')?.value) || 0;
                if (menge > 0 && Store.getMaterialBestand().length > 0) {
                    if (matId) {
                        const mat = Store.getMaterialBestand().find(m => m.id === matId);
                        if (mat) {
                            const kostenProEinheit = menge > 0 ? Math.round(betrag / menge * 1000) / 1000 : 0;
                            const altBestand = parseInt(mat.bestand) || 0;
                            const altKosten = parseFloat(mat.kostenProEinheit) || 0;
                            const neuerBestand = altBestand + menge;
                            mat.kostenProEinheit = neuerBestand > 0
                                ? Math.round(((altBestand * altKosten + menge * kostenProEinheit) / neuerBestand) * 1000) / 1000
                                : kostenProEinheit;
                            mat.bestand = neuerBestand;
                            Store.saveMaterialBestandItem(mat);
                            Store.saveMaterialEinkauf({ datum, materialId: matId, materialName: mat.name, einheit: mat.einheit || 'Stück', menge, gesamtkosten: betrag, kostenProEinheit, lieferant: 'Ausgabe' });
                            Utils.showToast(`${menge} × ${mat.name} ins Materiallager eingebucht`, 'success');
                        }
                    }
                }
            }

            Utils.showToast('Ausgabe gespeichert', 'success');
            this._refresh();
        });

        // Filters
        const applyFilters = () => {
            this._filterKategorie = document.getElementById('expFilterKat').value;
            this._filterVon = document.getElementById('expFilterVon').value;
            this._filterBis = document.getElementById('expFilterBis').value;
            this._refresh();
        };
        ['expFilterKat', 'expFilterVon', 'expFilterBis'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', applyFilters);
        });

        // Edit
        document.querySelectorAll('[data-edit-expense]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.editExpense;
                const exp = Store.getExpenses().find(e => e.id === id);
                if (!exp) return;
                const katOpts = this._kategorien.map(k =>
                    `<option value="${Utils.escapeHtml(k)}" ${exp.kategorie === k ? 'selected' : ''}>${Utils.escapeHtml(k)}</option>`
                ).join('');
                const body = `
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <input type="date" class="form-input" id="ee_datum" value="${exp.datum || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Kategorie</label>
                            <select class="form-select" id="ee_kategorie">${katOpts}</select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Beschreibung</label>
                        <input type="text" class="form-input" id="ee_beschreibung" value="${Utils.escapeHtml(exp.beschreibung || '')}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Betrag</label>
                            <input type="number" step="0.01" class="form-input" id="ee_betrag" value="${exp.betrag || 0}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Beleg-Nr.</label>
                            <input type="text" class="form-input" id="ee_belegNr" value="${Utils.escapeHtml(exp.belegNr || '')}">
                        </div>
                    </div>
                `;
                const footer = `
                    <button class="btn" onclick="App.closeModal()">Abbrechen</button>
                    <button class="btn btn-primary" id="saveExpenseEdit">Speichern</button>
                `;
                App.showModal('Ausgabe bearbeiten', body, footer);
                document.getElementById('saveExpenseEdit').addEventListener('click', () => {
                    Store.saveExpense({
                        id: exp.id,
                        datum: Utils.getDateInputValue('ee_datum'),
                        kategorie: document.getElementById('ee_kategorie').value,
                        beschreibung: document.getElementById('ee_beschreibung').value.trim(),
                        betrag: parseFloat(document.getElementById('ee_betrag').value) || 0,
                        belegNr: document.getElementById('ee_belegNr').value.trim(),
                        createdAt: exp.createdAt
                    });
                    App.closeModal();
                    Utils.showToast('Ausgabe aktualisiert', 'success');
                    this._refresh();
                });
            });
        });

        // Storno
        document.querySelectorAll('[data-storno-expense]').forEach(btn => {
            btn.addEventListener('click', () => {
                const grund = prompt('Stornogrund angeben (Pflicht fuer Revisionssicherheit):');
                if (!grund) return;
                Store.stornoExpense(btn.dataset.stornoExpense, grund);
                Utils.showToast('Ausgabe storniert', 'success');
                this._refresh();
            });
        });

        // Löschen — offene Periode: echtes Löschen mit Protokoll; festgeschrieben: Storno
        document.querySelectorAll('[data-delete-expense]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!confirm('Ausgabe löschen? In einer offenen Periode wird sie entfernt und im Änderungsprotokoll dokumentiert.')) return;
                const res = Store.deleteExpense(btn.dataset.deleteExpense);
                if (res && res.storno) Utils.showToast('Periode ist abgeschlossen — storniert statt gelöscht', 'warning');
                else Utils.showToast('Ausgabe gelöscht', 'success');
                this._refresh();
            });
        });

        // CSV Export
        const exportBtn = document.getElementById('expenseExportCSV');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const expenses = Store.getExpenses();
                const rows = [['Datum', 'Kategorie', 'Beschreibung', 'Betrag', 'Beleg-Nr.']];
                expenses.forEach(e => rows.push([e.datum, e.kategorie, e.beschreibung, e.betrag, e.belegNr || '']));
                Utils.downloadCSV(rows, 'ausgaben_export.csv');
                Utils.showToast('CSV exportiert', 'success');
            });
        }
    },

    _refresh() {
        const contentEl = document.getElementById('content');
        contentEl.innerHTML = this.render();
        this.init();
    }
};
