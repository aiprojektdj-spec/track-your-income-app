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

        // GoBD: Stornierte Einträge nicht aus Saldo herausrechnen, aber visuell kennzeichnen
        const aktiv = filtered.filter(e => !e.storniert);
        const typSummen = { Einnahme: 0, Ausgabe: 0, Privateinlage: 0, Privatentnahme: 0 };
        aktiv.forEach(e => { if (typSummen[e.typ] !== undefined) typSummen[e.typ] += parseFloat(e.betrag) || 0; });
        const endbestand = anfangsbestand
            + typSummen['Einnahme'] + typSummen['Privateinlage']
            - typSummen['Ausgabe'] - typSummen['Privatentnahme'];

        let balance = anfangsbestand;
        let rows = '';
        if (filtered.length === 0) {
            rows = '<tr><td colspan="6" class="table-empty">Keine Kassenbucheinträge vorhanden</td></tr>';
        } else {
            // Tages-Gruppierung: Trennzeile + Tagessumme, sobald sich das Datum ändert (filtered ist datumssortiert)
            const dayCloseRow = (datum, ein, aus, endBalance) => `
                <tr style="background:var(--bg-secondary);">
                    <td colspan="3" style="font-size:11px;color:var(--text-muted);">Tagessumme ${Utils.formatDate(datum)}: <span style="color:var(--success);">+${Utils.formatCurrency(ein)}</span> / <span style="color:var(--danger);">−${Utils.formatCurrency(aus)}</span></td>
                    <td></td>
                    <td style="text-align:right;font-weight:600;font-size:11px;color:${endBalance >= 0 ? 'var(--success)' : 'var(--danger)'};">${Utils.formatCurrency(endBalance)}</td>
                    <td></td>
                </tr>`;
            let lastDatum = null, tagEin = 0, tagAus = 0;
            const rowParts = [];
            filtered.forEach(e => {
                const betrag = parseFloat(e.betrag) || 0;
                const isEin = e.typ === 'Einnahme' || e.typ === 'Privateinlage';
                const isSt  = !!e.storniert;
                if (e.datum !== lastDatum) {
                    if (lastDatum !== null) rowParts.push(dayCloseRow(lastDatum, tagEin, tagAus, balance));
                    lastDatum = e.datum; tagEin = 0; tagAus = 0;
                }
                if (!isSt) {
                    if (isEin) { balance += betrag; tagEin += betrag; } else { balance -= betrag; tagAus += betrag; }
                }
                const typBadge = isSt
                    ? '<span class="badge" style="background:rgba(100,116,139,.2);color:#94a3b8;">Storniert</span>'
                    : e.typ === 'Einnahme' ? '<span class="badge badge-success">Einnahme</span>'
                    : e.typ === 'Ausgabe' ? '<span class="badge badge-danger">Ausgabe</span>'
                    : e.typ === 'Privateinlage' ? '<span class="badge badge-info">Privateinlage</span>'
                    : '<span class="badge badge-warning">Privatentnahme</span>';
                const rowStyle = isSt ? 'opacity:.45;text-decoration:line-through;' : '';
                const balanceCell = isSt ? '—' : Utils.formatCurrency(balance);
                const balanceColor = isSt ? 'var(--text-muted,#888)' : (balance >= 0 ? 'var(--success)' : 'var(--danger)');
                rowParts.push(`
                <tr style="${rowStyle}">
                    <td>${Utils.formatDate(e.datum)}</td>
                    <td>${typBadge}</td>
                    <td>${Utils.escapeHtml(e.beschreibung || '')}${isSt ? ` <small style="color:var(--text-muted,#888);text-decoration:none;">(${Utils.escapeHtml(e.stornoGrund || '')})</small>` : ''}</td>
                    <td style="text-align:right;color:${isSt ? 'var(--text-muted,#888)' : (isEin ? 'var(--success)' : 'var(--danger)')};">${isSt ? '' : (isEin ? '+' : '-')}${Utils.formatCurrency(betrag)}</td>
                    <td style="text-align:right;font-weight:600;color:${balanceColor};">${balanceCell}</td>
                    <td class="table-actions">
                        ${isSt ? '' : `<button class="btn btn-small btn-danger" data-delete-kasse="${e.id}">Stornieren</button>`}
                    </td>
                </tr>`);
            });
            if (lastDatum !== null) rowParts.push(dayCloseRow(lastDatum, tagEin, tagAus, balance));
            rows = rowParts.join('');
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
                    <div class="card-subtitle">${aktiv.filter(e => e.typ === 'Einnahme' || e.typ === 'Privateinlage').length} Einträge</div>
                </div>
                <div class="card stat-card danger">
                    <div class="card-label">Ausgaben ${year === 'all' ? '' : year}</div>
                    <div class="card-value">${Utils.formatCurrency(typSummen['Ausgabe'] + typSummen['Privatentnahme'])}</div>
                    <div class="card-subtitle">${aktiv.filter(e => e.typ === 'Ausgabe' || e.typ === 'Privatentnahme').length} Einträge</div>
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
                            <label class="form-label" for="kb_datum">Datum</label>
                            <input type="date" class="form-input" id="kb_datum" value="${Utils.todayISO()}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="kb_typ">Typ</label>
                            <select class="form-select" id="kb_typ">
                                <option value="Einnahme">Einnahme</option>
                                <option value="Ausgabe">Ausgabe</option>
                                <option value="Privateinlage">Privateinlage</option>
                                <option value="Privatentnahme">Privatentnahme</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="kb_betrag">Betrag (€)</label>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="kb_betrag" placeholder="0,00">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="kb_beschreibung">Beschreibung</label>
                            <input type="text" class="form-input" id="kb_beschreibung" maxlength="300" placeholder="Wofür?">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="kb_beleg">Beleg-Nr. (optional)</label>
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
                            <th scope="col">Datum</th>
                            <th scope="col">Typ</th>
                            <th scope="col">Beschreibung</th>
                            <th scope="col" style="text-align:right">Betrag</th>
                            <th scope="col" style="text-align:right">Saldo</th>
                            <th scope="col">Aktionen</th>
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
            const typ = document.getElementById('kb_typ').value;
            if (!beschreibung) { Utils.showToast('Bitte Beschreibung eingeben', 'warning'); return; }
            if (betrag <= 0) { Utils.showToast('Betrag muss größer als 0 sein', 'warning'); return; }

            const isEin = typ === 'Einnahme' || typ === 'Privateinlage';
            const anfangsbestand = parseFloat(Store.getSettings().kassenbuchAnfangsbestand) || 0;
            const saldo = Store.getKassenbuch().reduce((s, e) => {
                if (e.storniert) return s;
                const b = parseFloat(e.betrag) || 0;
                return s + ((e.typ === 'Einnahme' || e.typ === 'Privateinlage') ? b : -b);
            }, anfangsbestand) + (isEin ? betrag : -betrag);
            // ponytail: globaler Saldo, nicht datumsgenau — reicht für Betriebsprüfungs-Warnhinweis
            if (saldo < 0) Utils.showToast(`Warnung: Kassenbestand würde negativ (${Utils.formatCurrency(saldo)})`, 'warning');

            Store.saveKassenEintrag({
                datum: Utils.getDateInputValue('kb_datum'),
                typ,
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
                const grund = prompt('Stornogrund (GoBD-Pflicht):', 'Falscheingabe');
                if (grund === null) return; // Abbrechen
                Store.deleteKassenEintrag(btn.dataset.deleteKasse, grund || 'Manuell storniert');
                Utils.showToast('Eintrag storniert (GoBD-konform)', 'success');
                this._refresh();
            });
        });

        const editAnfang = document.getElementById('editAnfangsbestand');
        if (editAnfang) {
            editAnfang.addEventListener('click', () => {
                const s = Store.getSettings();
                const val = prompt('Anfangsbestand (€):', (s.kassenbuchAnfangsbestand || 0).toString());
                if (val === null) return;
                const n = parseFloat(val.replace(',', '.'));
                s.kassenbuchAnfangsbestand = Number.isFinite(n) ? n : 0;
                Store.saveSettings(s);
                this._refresh();
            });
        }

        const exportBtn = document.getElementById('kbExportCSV');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const rows = [['Datum', 'Typ', 'Beschreibung', 'Betrag', 'Beleg', 'Storniert', 'Stornogrund']];
                Store.getKassenbuch().forEach(e => rows.push([
                    e.datum, e.typ, e.beschreibung, e.betrag, e.beleg || '',
                    e.storniert ? 'Ja' : 'Nein', e.stornoGrund || ''
                ]));
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
