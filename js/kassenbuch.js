// ============================================
// Kassenbuch Module - Cash Book
// ============================================
const Kassenbuch = {
    _filterYear: String(new Date().getFullYear()),

    render() {
        const eintraege = Store.getKassenbuch();
        const settings = Store.getSettings();
        const anfangsbestand = parseFloat(settings.kassenbuchAnfangsbestand) || 0;

        const year = this._filterYear;
        const filtered = year === 'all' ? [...eintraege] : eintraege.filter(e => (e.datum || '').startsWith(year));
        filtered.sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));

        const years = Array.from(new Set(eintraege.map(e => (e.datum || '').substring(0, 4)).filter(Boolean))).sort().reverse();
        const yearOpts = ['all', ...years].map(y =>
            `<option value="${y}" ${this._filterYear === y ? 'selected' : ''}>${y === 'all' ? 'Alle Jahre' : y}</option>`
        ).join('');

        const typSummen = { Einnahme: 0, Ausgabe: 0, Privateinlage: 0, Privatentnahme: 0 };
        filtered.forEach(e => { if (typSummen[e.typ] !== undefined) typSummen[e.typ] += parseFloat(e.betrag) || 0; });
        const endbestand = anfangsbestand
            + typSummen['Einnahme'] + typSummen['Privateinlage']
            - typSummen['Ausgabe'] - typSummen['Privatentnahme'];

        let balance = anfangsbestand;
        let rows = '';
        if (filtered.length === 0) {
            rows = '<tr><td colspan="6" class="table-empty">Keine Kassenbucheinträge vorhanden</td></tr>';
        } else {
            rows = filtered.map(e => {
                const betrag = parseFloat(e.betrag) || 0;
                const isEin = e.typ === 'Einnahme' || e.typ === 'Privateinlage';
                if (isEin) balance += betrag; else balance -= betrag;
                const typBadge = e.typ === 'Einnahme' ? '<span class="badge badge-success">Einnahme</span>'
                    : e.typ === 'Ausgabe' ? '<span class="badge badge-danger">Ausgabe</span>'
                    : e.typ === 'Privateinlage' ? '<span class="badge badge-info">Privateinlage</span>'
                    : '<span class="badge badge-warning">Privatentnahme</span>';
                return `
                <tr>
                    <td>${Utils.formatDate(e.datum)}</td>
                    <td>${typBadge}</td>
                    <td>${Utils.escapeHtml(e.beschreibung || '')}</td>
                    <td style="text-align:right;color:${isEin ? 'var(--success)' : 'var(--danger)'};">${isEin ? '+' : '-'}${Utils.formatCurrency(betrag)}</td>
                    <td style="text-align:right;font-weight:600;color:${balance >= 0 ? 'var(--success)' : 'var(--danger)'};">${Utils.formatCurrency(balance)}</td>
                    <td class="table-actions">
                        <button class="btn btn-small btn-danger" data-delete-kasse="${e.id}">Löschen</button>
                    </td>
                </tr>`;
            }).join('');
        }

        return `
            <div class="page-header">
                <h2>Kassenbuch</h2>
            </div>

            <div class="stats-grid">
                <div class="card stat-card info">
                    <div class="card-label">Anfangsbestand</div>
                    <div class="card-value">${Utils.formatCurrency(anfangsbestand)}</div>
                    <div class="card-subtitle" style="cursor:pointer;" id="editAnfangsbestand">✏️ Ändern</div>
                </div>
                <div class="card stat-card success">
                    <div class="card-label">Einnahmen ${year === 'all' ? '' : year}</div>
                    <div class="card-value">${Utils.formatCurrency(typSummen['Einnahme'] + typSummen['Privateinlage'])}</div>
                    <div class="card-subtitle">${filtered.filter(e => e.typ === 'Einnahme' || e.typ === 'Privateinlage').length} Einträge</div>
                </div>
                <div class="card stat-card danger">
                    <div class="card-label">Ausgaben ${year === 'all' ? '' : year}</div>
                    <div class="card-value">${Utils.formatCurrency(typSummen['Ausgabe'] + typSummen['Privatentnahme'])}</div>
                    <div class="card-subtitle">${filtered.filter(e => e.typ === 'Ausgabe' || e.typ === 'Privatentnahme').length} Einträge</div>
                </div>
                <div class="card stat-card ${endbestand >= 0 ? 'success' : 'danger'}">
                    <div class="card-label">Kassensaldo ${year === 'all' ? '' : year}</div>
                    <div class="card-value">${Utils.formatCurrency(endbestand)}</div>
                    <div class="card-subtitle">Endbestand</div>
                </div>
            </div>

            <div class="card" style="margin-bottom:16px;">
                <div class="card-header"><div class="card-title">Neuer Kasseneintrag</div></div>
                <form id="kasseForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <input type="date" class="form-input" id="kb_datum" value="${Utils.todayISO()}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Typ</label>
                            <select class="form-select" id="kb_typ">
                                <option value="Einnahme">Einnahme</option>
                                <option value="Ausgabe">Ausgabe</option>
                                <option value="Privateinlage">Privateinlage</option>
                                <option value="Privatentnahme">Privatentnahme</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Betrag (€)</label>
                            <input type="number" step="0.01" min="0" class="form-input" id="kb_betrag" placeholder="0,00">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Beschreibung</label>
                            <input type="text" class="form-input" id="kb_beschreibung" placeholder="Wofür?">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Beleg-Nr. (optional)</label>
                            <input type="text" class="form-input" id="kb_beleg" placeholder="z.B. B-001">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Eintrag speichern</button>
                    </div>
                </form>
            </div>

            <div class="filter-bar no-print">
                <div class="filter-group">
                    <label>Jahr</label>
                    <select class="form-select" id="kbFilterYear">${yearOpts}</select>
                </div>
                <div class="filter-group" style="align-self:flex-end;">
                    <button class="btn btn-small" id="kbExportCSV">CSV Export</button>
                </div>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Datum</th>
                            <th>Typ</th>
                            <th>Beschreibung</th>
                            <th style="text-align:right">Betrag</th>
                            <th style="text-align:right">Saldo</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    init() {
        document.getElementById('kasseForm').addEventListener('submit', e => {
            e.preventDefault();
            const betrag = parseFloat(document.getElementById('kb_betrag').value) || 0;
            const beschreibung = document.getElementById('kb_beschreibung').value.trim();
            if (!beschreibung) { Utils.showToast('Bitte Beschreibung eingeben', 'warning'); return; }
            if (betrag <= 0) { Utils.showToast('Betrag muss größer als 0 sein', 'warning'); return; }
            Store.saveKassenEintrag({
                datum: Utils.getDateInputValue('kb_datum'),
                typ: document.getElementById('kb_typ').value,
                betrag,
                beschreibung,
                beleg: document.getElementById('kb_beleg').value.trim()
            });
            Utils.showToast('Eintrag gespeichert', 'success');
            this._refresh();
        });

        const yearFilter = document.getElementById('kbFilterYear');
        if (yearFilter) yearFilter.addEventListener('change', () => {
            this._filterYear = yearFilter.value;
            this._refresh();
        });

        document.querySelectorAll('[data-delete-kasse]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!confirm('Eintrag löschen?')) return;
                Store.deleteKassenEintrag(btn.dataset.deleteKasse);
                Utils.showToast('Eintrag gelöscht', 'success');
                this._refresh();
            });
        });

        const editAnfang = document.getElementById('editAnfangsbestand');
        if (editAnfang) {
            editAnfang.addEventListener('click', () => {
                const s = Store.getSettings();
                const val = prompt('Anfangsbestand (€):', (s.kassenbuchAnfangsbestand || 0).toString());
                if (val === null) return;
                s.kassenbuchAnfangsbestand = parseFloat(val.replace(',', '.')) || 0;
                Store.saveSettings(s);
                this._refresh();
            });
        }

        const exportBtn = document.getElementById('kbExportCSV');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const rows = [['Datum', 'Typ', 'Beschreibung', 'Betrag', 'Beleg']];
                Store.getKassenbuch().forEach(e => rows.push([e.datum, e.typ, e.beschreibung, e.betrag, e.beleg || '']));
                Utils.downloadCSV(rows, 'kassenbuch_export.csv');
                Utils.showToast('CSV exportiert', 'success');
            });
        }
    },

    _refresh() {
        document.getElementById('content').innerHTML = this.render();
        this.init();
    }
};
