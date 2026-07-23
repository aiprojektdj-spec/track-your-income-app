// ============================================
// Ausgaben Module - Expenses Management
// ============================================
const Ausgaben = {
    _filterKategorie: '',
    _filterVon: '',
    _filterBis: '',

    _kategorien: ['Versand', 'Verpackung', 'Plattformgebühren', 'Fahrtkosten', 'Büro', 'Equipment', 'Software/Abos', 'Honorare an Künstler/Publizisten', 'Sonstiges'],

    // Künstlersozialabgabe (§24-§28 KSVG): Unternehmer, die nicht nur gelegentlich Aufträge an
    // freie Künstler/Publizisten vergeben (Grafik/Foto/Text für eigene Werbung, §24 Abs.2 KSVG),
    // sind abgabepflichtig. Bagatellgrenze ist eine FREIGRENZE (§24 Abs.3 KSVG) — bei Überschreiten
    // im Kalenderjahr wird die GESAMTE Jahressumme abgabepflichtig, nicht nur der übersteigende Teil.
    _KSA_KATEGORIE: 'Honorare an Künstler/Publizisten',
    _KSA_SATZ: 0.049,          // 2026, gesunken von 5,0% (2025)
    _KSA_BAGATELLGRENZE: 1000, // 2026, gestiegen von 700€ (2025)

    _ksaJahressumme(year) {
        return Store.getExpenses().filter(e => e.kategorie === this._KSA_KATEGORIE && (e.datum || '').startsWith(String(year)))
            .reduce((s, e) => s + (parseFloat(e.betrag) || 0), 0);
    },

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

        const ksaJahr = new Date().getFullYear();
        const ksaSumme = this._ksaJahressumme(ksaJahr);
        const ksaPflichtig = ksaSumme > this._KSA_BAGATELLGRENZE;
        if (ksaSumme > 0) {
            summaryCards += `
                <div class="card stat-card ${ksaPflichtig ? 'danger' : ''}">
                    <div class="card-label">Künstlersozialabgabe ${ksaJahr}</div>
                    <div class="card-value">${ksaPflichtig ? Utils.formatCurrency(ksaSumme * this._KSA_SATZ) : Utils.formatCurrency(0)}</div>
                    <div class="card-subtitle">${ksaPflichtig
                        ? `Freigrenze überschritten (${Utils.formatCurrency(ksaSumme)} Honorare, 4,9%)`
                        : `${Utils.formatCurrency(ksaSumme)} von ${Utils.formatCurrency(this._KSA_BAGATELLGRENZE)} Freigrenze`}</div>
                </div>
            `;
        }

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
                            : !Store.canEdit(e)
                                ? `<span class="badge badge-warning" title="Periode festgeschrieben — nur Storno möglich" style="margin-right:4px;"><i class="ti ti-lock"></i></span>
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
                <a href="#" data-action="navigate" data-args=\'["buchungen"]\' style="color:var(--info);">Buchungen → Einkauf</a> erfasst
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
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="exp_betrag" placeholder="0,00">
                        </div>
                    </div>
                    <div id="exp_ksaHint" style="display:none;margin-bottom:12px;padding:10px 12px;border-radius:var(--radius-sm);font-size:12px;line-height:1.6;"></div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Beschreibung</label>
                            <input type="text" class="form-input" id="exp_beschreibung" maxlength="300" placeholder="Was wurde bezahlt?">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Beleg-Nr. (optional)</label>
                            <input type="text" class="form-input" id="exp_belegNr" maxlength="100" placeholder="z.B. RE-2026-001">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Lieferant / Aussteller</label>
                            <input type="text" class="form-input" id="exp_lieferant" maxlength="200" placeholder="Name des Rechnungsausstellers">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Steuernr. / USt-IdNr. Lieferant</label>
                            <input type="text" class="form-input" id="exp_lieferantSteuerId" maxlength="50" placeholder="nur bei Rechnung >250€ Pflicht">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Beleg-Foto/Scan (empfohlen, §14 UStG)</label>
                        <input type="file" accept="image/*" class="form-input" id="exp_belegFoto">
                        <div class="form-hint" style="font-size:12px;color:var(--text-muted);">
                            Für den Vorsteuerabzug musst du eine ordnungsgemäße Rechnung <em>besitzen</em> — hier hinterlegen macht das prüfbar.
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

        // KSA-Hinweis (Künstlersozialabgabe): live bei Kategorie-/Betrag-/Datumsänderung
        const ksaHint = document.getElementById('exp_ksaHint');
        const updateKsaHint = () => {
            if (!ksaHint) return;
            const isKsa = katSel && katSel.value === this._KSA_KATEGORIE;
            ksaHint.style.display = isKsa ? '' : 'none';
            if (!isKsa) return;
            const year = (Utils.getDateInputValue('exp_datum') || Utils.todayISO()).slice(0, 4);
            const neuerBetrag = parseFloat(document.getElementById('exp_betrag')?.value) || 0;
            const jahressumme = this._ksaJahressumme(year) + neuerBetrag;
            const ueberGrenze = jahressumme > this._KSA_BAGATELLGRENZE;
            ksaHint.style.background = ueberGrenze ? 'var(--danger-bg)' : 'var(--info-bg)';
            ksaHint.style.border = `1px solid var(${ueberGrenze ? '--danger' : '--info'})`;
            ksaHint.style.color = `var(${ueberGrenze ? '--danger' : '--info'})`;
            ksaHint.innerHTML = ueberGrenze
                ? `⚠️ Jahressumme ${year} inkl. dieser Ausgabe: <strong>${Utils.formatCurrency(jahressumme)}</strong> — übersteigt die 1.000€-Freigrenze (§24 Abs.3 KSVG). Dann ist die <strong>gesamte</strong> Jahressumme künstlersozialabgabepflichtig, nicht nur der übersteigende Teil. Voraussichtliche KSA: <strong>${Utils.formatCurrency(jahressumme * this._KSA_SATZ)}</strong> (4,9%), zusätzlich zum Honorar an die Künstlersozialkasse zu melden und zu zahlen.`
                : `Jahressumme ${year} inkl. dieser Ausgabe: <strong>${Utils.formatCurrency(jahressumme)}</strong> von ${Utils.formatCurrency(this._KSA_BAGATELLGRENZE)} Freigrenze (§24 Abs.3 KSVG). Bemessungsgrundlage ist der Nettobetrag ohne USt. Betrifft nur Leistungen mit gestalterischem/kreativem Charakter (§25 KSVG), z.B. Grafik, Foto, Text — reine technische Ausführung ohne kreativen Spielraum fällt idR nicht darunter.`;
        };
        if (katSel) katSel.addEventListener('change', updateKsaHint);
        const betragInput = document.getElementById('exp_betrag');
        if (betragInput) betragInput.addEventListener('input', updateKsaHint);
        const datumInput = document.getElementById('exp_datum');
        if (datumInput) datumInput.addEventListener('change', updateKsaHint);
        updateKsaHint();

        // Form submit
        document.getElementById('expenseForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const datum = Utils.getDateInputValue('exp_datum');
            const betrag = parseFloat(document.getElementById('exp_betrag').value) || 0;
            if (!Number.isFinite(betrag) || betrag < 0 || betrag > 99999999) {
                Utils.showToast('Betrag ungültig', 'error');
                return;
            }
            const belegFotoFile = document.getElementById('exp_belegFoto')?.files?.[0];
            let belegFoto;
            if (belegFotoFile) {
                try { belegFoto = await Utils.sanitizeImageFile(belegFotoFile); }
                catch (err) { Utils.showToast(err.message || 'Beleg-Foto konnte nicht gelesen werden', 'error'); return; }
            }
            Store.saveExpense({
                datum,
                kategorie: document.getElementById('exp_kategorie').value,
                beschreibung: document.getElementById('exp_beschreibung').value.trim(),
                betrag,
                belegNr: document.getElementById('exp_belegNr').value.trim(),
                lieferant: document.getElementById('exp_lieferant').value.trim(),
                lieferantSteuerId: document.getElementById('exp_lieferantSteuerId').value.trim(),
                belegFoto
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
                            Utils.showToast(`${menge} × ${Utils.escapeHtml(mat.name)} ins Materiallager eingebucht`, 'success');
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
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Lieferant / Aussteller</label>
                            <input type="text" class="form-input" id="ee_lieferant" maxlength="200" value="${Utils.escapeHtml(exp.lieferant || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Steuernr. / USt-IdNr. Lieferant</label>
                            <input type="text" class="form-input" id="ee_lieferantSteuerId" maxlength="50" value="${Utils.escapeHtml(exp.lieferantSteuerId || '')}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Beleg-Foto/Scan ${exp.belegFoto ? '(vorhanden — Datei wählen zum Ersetzen)' : ''}</label>
                        ${exp.belegFoto ? `<div style="margin-bottom:6px;"><a href="#" id="ee_belegFotoView" style="font-size:12px;">📎 aktuelles Beleg-Foto ansehen</a></div>` : ''}
                        <input type="file" accept="image/*" class="form-input" id="ee_belegFoto">
                    </div>
                `;
                const footer = `
                    <button class="btn" data-action="close-modal">Abbrechen</button>
                    <button class="btn btn-primary" id="saveExpenseEdit">Speichern</button>
                `;
                App.showModal('Ausgabe bearbeiten', body, footer);
                const belegFotoViewLink = document.getElementById('ee_belegFotoView');
                if (belegFotoViewLink) belegFotoViewLink.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    App.showModal('Beleg-Foto', `<img src="${exp.belegFoto}" style="max-width:100%;border-radius:var(--radius-sm);">`, '<button class="btn" data-action="close-modal">Schließen</button>');
                });
                document.getElementById('saveExpenseEdit').addEventListener('click', async () => {
                    const newFotoFile = document.getElementById('ee_belegFoto')?.files?.[0];
                    let belegFoto = exp.belegFoto;
                    if (newFotoFile) {
                        try { belegFoto = await Utils.sanitizeImageFile(newFotoFile); }
                        catch (err) { Utils.showToast(err.message || 'Beleg-Foto konnte nicht gelesen werden', 'error'); return; }
                    }
                    Store.saveExpense({
                        id: exp.id,
                        datum: Utils.getDateInputValue('ee_datum'),
                        kategorie: document.getElementById('ee_kategorie').value,
                        beschreibung: document.getElementById('ee_beschreibung').value.trim(),
                        betrag: parseFloat(document.getElementById('ee_betrag').value) || 0,
                        belegNr: document.getElementById('ee_belegNr').value.trim(),
                        lieferant: document.getElementById('ee_lieferant').value.trim(),
                        lieferantSteuerId: document.getElementById('ee_lieferantSteuerId').value.trim(),
                        belegFoto,
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
