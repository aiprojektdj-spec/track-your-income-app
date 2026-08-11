// ============================================
// Retouren Module - Return Management
// ============================================
const Retouren = {
    _filterYear: String(new Date().getFullYear()),

    render() {
        const retouren = Store.getRetouren();
        const year = this._filterYear;
        const filtered = year === 'all' ? retouren : retouren.filter(r => (r.datum || '').startsWith(year));
        filtered.sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

        const totalErstattet = filtered.reduce((s, r) => s + (parseFloat(r.erstattungBetrag) || 0), 0);
        const years = Array.from(new Set(retouren.map(r => (r.datum || '').substring(0, 4)).filter(Boolean))).sort().reverse();
        const yearOpts = ['all', ...years].map(y =>
            `<option value="${y}" ${this._filterYear === y ? 'selected' : ''}>${y === 'all' ? 'Alle Jahre' : y}</option>`
        ).join('');

        // Sales dropdown: recent non-storniert sales for linking
        // Fix: Sales aus Rechnungen (_invoiceId) ausgeschlossen — eine Retoure storniert den Sale-Eintrag,
        // aber in Soll-Versteuerung liest die UVA Rechnungsumsätze direkt aus den Rechnungen (nicht aus
        // Sales), das Stornieren des Sale-Spiegels hätte also KEINE Wirkung auf die gemeldete USt.
        // Für Rechnungen ist eine Gutschrift (§17 UStG) der korrekte Weg, nicht eine Retoure.
        const recentSales = Store.getSales()
            .filter(s => !s._invoiceId)
            .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''))
            .slice(0, 100);
        const salesOptions = recentSales.map(s => {
            const label = `${Utils.formatDate(s.datum)} – ${Utils.escapeHtml(s.marke || s.artikeltyp || 'Verkauf')} – ${Utils.formatCurrency(s.verkaufspreis)}`;
            return `<option value="${s.id}">${label}</option>`;
        }).join('');

        let rows = '';
        if (filtered.length === 0) {
            rows = '<tr><td colspan="8" class="table-empty">Noch keine Retouren erfasst — eine Retoure entsteht über „Verkauf bearbeiten“ im Lager.</td></tr>';
        } else {
            rows = filtered.map(r => {
                const zustandBadge = r.zustand === 'Unbeschädigt'
                    ? '<span class="badge badge-success">Unbeschädigt</span>'
                    : r.zustand === 'Beschädigt'
                        ? '<span class="badge badge-warning">Beschädigt</span>'
                        : '<span class="badge badge-danger">Fehlt/Verlust</span>';
                const lagerBadge = r.zustand === 'Unbeschädigt'
                    ? '<span class="badge badge-success" style="font-size:10px;">↩ Lager</span>'
                    : '<span class="badge badge-neutral" style="font-size:10px;">Ausgebucht</span>';
                const saleLink = r.saleId
                    ? `<span class="badge badge-info" style="font-size:10px;" title="Verkauf ID: ${r.saleId}">🔗 Verknüpft</span>`
                    : '<span style="color:var(--text-muted);font-size:11px;">–</span>';
                return `
                <tr>
                    <td>${Utils.formatDate(r.datum)}</td>
                    <td><span class="badge badge-info">${Utils.escapeHtml(r.nummer || '')}</span></td>
                    <td>${Utils.escapeHtml(r.marke || '')} ${Utils.escapeHtml(r.artikeltyp || '')}</td>
                    <td>${zustandBadge}</td>
                    <td>${lagerBadge}</td>
                    <td style="text-align:right">${Utils.formatCurrency(r.erstattungBetrag)}</td>
                    <td>${saleLink}</td>
                    <td class="table-actions">
                        <button class="btn btn-small btn-danger" data-delete-retoure="${r.id}">Löschen</button>
                    </td>
                </tr>`;
            }).join('');
        }

        return `
            <div class="page-header">
                <h2>Retourenmanagement</h2>
            </div>

            <div class="stats-grid">
                <div class="card stat-card danger">
                    <div class="card-label">Retouren ${year === 'all' ? 'Gesamt' : year}</div>
                    <div class="card-value">${filtered.length}</div>
                    <div class="card-subtitle">Rücksendungen</div>
                </div>
                <div class="card stat-card warning">
                    <div class="card-label">Erstattet ${year === 'all' ? 'Gesamt' : year}</div>
                    <div class="card-value">${Utils.formatCurrency(totalErstattet)}</div>
                    <div class="card-subtitle">Rückerstattungen</div>
                </div>
                <div class="card stat-card info">
                    <div class="card-label">Zurück ins Lager</div>
                    <div class="card-value">${filtered.filter(r => r.zustand === 'Unbeschädigt').length}</div>
                    <div class="card-subtitle">Unbeschädigt zurück</div>
                </div>
                <div class="card stat-card">
                    <div class="card-label">Mit Verkauf verknüpft</div>
                    <div class="card-value">${filtered.filter(r => r.saleId).length}</div>
                    <div class="card-subtitle">Bestand aktualisiert</div>
                </div>
            </div>

            <div class="info-box" style="margin-bottom:16px;padding:12px 16px;background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);font-size:13px;color:var(--text-secondary);">
                <strong style="color:var(--info);">💡 Verknüpfung mit Verkauf</strong><br>
                Wähle den originalen Verkauf aus der Liste. Bei <strong>Unbeschädigt</strong> wird der Artikel automatisch wieder ins Lager zurückgebucht und Verpackungskosten storniert.
                Bei <strong>Beschädigt/Verlust</strong> wird der Verkauf storniert, der Artikel bleibt jedoch ausgebucht.
            </div>

            <div class="card" style="margin-bottom:16px;">
                <div class="card-header"><div class="card-title">Neue Retoure erfassen</div></div>
                <form id="retourenForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <input type="date" class="form-input" id="rt_datum" value="${Utils.todayISO()}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Marke</label>
                            <input type="text" class="form-input" id="rt_marke" placeholder="z.B. Nike">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Artikeltyp</label>
                            <input type="text" class="form-input" id="rt_artikeltyp" placeholder="z.B. Schuhe">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Zustand bei Rücksendung</label>
                            <select class="form-select" id="rt_zustand">
                                <option value="Unbeschädigt">Unbeschädigt – zurück ins Lager</option>
                                <option value="Beschädigt">Beschädigt – nicht weiterverkaufbar</option>
                                <option value="Fehlt/Verlust">Fehlt / Verlust</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Originaler Verkaufspreis (€)</label>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="rt_vkPreis" placeholder="0,00">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Erstattung an Käufer (€)</label>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="rt_erstattung" placeholder="0,00">
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom:12px;">
                        <label class="form-label">🔗 Originalen Verkauf verknüpfen <span style="color:var(--text-muted);font-weight:400;">(empfohlen – stellt Lager & Kosten automatisch zurück)</span></label>
                        <select class="form-select" id="rt_saleId">
                            <option value="">– Kein Verkauf verknüpfen –</option>
                            ${salesOptions}
                        </select>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Für eine Rechnung gibt es hier keine Auswahl — bitte stattdessen eine <strong>Gutschrift</strong> zur Rechnung erstellen (§17 UStG), sonst wirkt sich die Retoure nicht auf die USt-Voranmeldung aus.</div>
                    </div>
                    <div id="rt_saleHint" style="display:none;padding:8px 12px;background:var(--success-bg);border:1px solid var(--success);border-radius:var(--radius-sm);font-size:12px;color:var(--success);margin-bottom:12px;">
                        ✅ Verkauf wird storniert · Artikel zurück ins Lager · Verpackungskosten storniert
                    </div>

                    <div class="form-group">
                        <label class="form-label">Notizen / Grund</label>
                        <input type="text" class="form-input" id="rt_notizen" placeholder="Grund der Retoure...">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Retoure speichern</button>
                    </div>
                </form>
            </div>

            <div class="filter-bar no-print">
                <div class="filter-group">
                    <label>Jahr</label>
                    <select class="form-select" id="rtFilterYear">${yearOpts}</select>
                </div>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Datum</th>
                            <th>Nummer</th>
                            <th>Artikel</th>
                            <th>Zustand</th>
                            <th>Lager</th>
                            <th style="text-align:right">Erstattung</th>
                            <th>Verkauf</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    init() {
        // Sale selector hint
        const saleSelect = document.getElementById('rt_saleId');
        const saleHint = document.getElementById('rt_saleHint');
        if (saleSelect && saleHint) {
            saleSelect.addEventListener('change', () => {
                saleHint.style.display = saleSelect.value ? '' : 'none';
                // Auto-fill VK-Preis from selected sale
                if (saleSelect.value) {
                    const sale = Store.getSales().find(s => s.id === saleSelect.value);
                    if (sale) {
                        const vkEl = document.getElementById('rt_vkPreis');
                        const erstEl = document.getElementById('rt_erstattung');
                        if (vkEl && !vkEl.value) vkEl.value = sale.verkaufspreis || '';
                        if (erstEl && !erstEl.value) erstEl.value = sale.verkaufspreis || '';
                        const markeEl = document.getElementById('rt_marke');
                        const typEl = document.getElementById('rt_artikeltyp');
                        if (markeEl && !markeEl.value) markeEl.value = sale.marke || '';
                        if (typEl && !typEl.value) typEl.value = sale.artikeltyp || '';
                    }
                }
            });
        }

        document.getElementById('retourenForm').addEventListener('submit', e => {
            e.preventDefault();
            const zustand = document.getElementById('rt_zustand').value;
            const saleId = (document.getElementById('rt_saleId') || {}).value || '';
            const r = {
                datum: Utils.getDateInputValue('rt_datum'),
                marke: document.getElementById('rt_marke').value.trim(),
                artikeltyp: document.getElementById('rt_artikeltyp').value.trim(),
                zustand,
                vkPreis: parseFloat(document.getElementById('rt_vkPreis').value) || 0,
                erstattungBetrag: parseFloat(document.getElementById('rt_erstattung').value) || 0,
                notizen: document.getElementById('rt_notizen').value.trim(),
                saleId: saleId || null
            };

            // Process linked sale
            if (saleId) {
                const sale = Store.getSales().find(s => s.id === saleId);
                if (sale) {
                    const grund = 'Retoure: ' + zustand + ' – ' + (r.marke || r.artikeltyp || 'Artikel');

                    if (zustand === 'Unbeschädigt') {
                        // stornoSale restores linked purchases to "verfuegbar"
                        Store.stornoSale(saleId, grund);
                        // Revert material consumption (Verpackungskosten zurückbuchen)
                        if (typeof Store.revertMaterialVerbrauch === 'function') {
                            Store.revertMaterialVerbrauch(saleId);
                        }
                    } else {
                        // Beschädigt / Fehlt/Verlust: Verkauf stornieren,
                        // aber Artikel NICHT zurück ins Lager (kann nicht weiterverkauft werden)
                        Store.stornoSale(saleId, grund);
                        // stornoSale already freed purchases → re-mark them as storniert since item can't be resold
                        const pids = sale.purchaseIds ? sale.purchaseIds : (sale.purchaseId ? [sale.purchaseId] : []);
                        pids.forEach(pid => Store.stornoPurchase(pid, grund + ' (nicht wiederverkäuflich)'));
                        // Revert material consumption
                        if (typeof Store.revertMaterialVerbrauch === 'function') {
                            Store.revertMaterialVerbrauch(saleId);
                        }
                    }
                }
            }

            Store.saveRetoure(r);
            Utils.showToast('Retoure gespeichert' + (saleId ? ' · Lager & EÜR aktualisiert' : ''), 'success');
            this._refresh();
        });

        const yearFilter = document.getElementById('rtFilterYear');
        if (yearFilter) yearFilter.addEventListener('change', () => {
            this._filterYear = yearFilter.value;
            this._refresh();
        });

        document.querySelectorAll('[data-delete-retoure]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!confirm('Retoure wirklich löschen?')) return;
                Store.deleteRetoure(btn.dataset.deleteRetoure);
                Utils.showToast('Retoure gelöscht', 'success');
                this._refresh();
            });
        });
    },

    _refresh() {
        document.getElementById('content').innerHTML = this.render();
        this.init();
    }
};
