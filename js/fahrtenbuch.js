// ============================================
// Fahrtenbuch Module – Erweitert
// ============================================
const Fahrtenbuch = {
    _filterYear: String(new Date().getFullYear()),
    _filterZweck: '',
    _filterFahrzeug: '',
    _showMonate: false,
    _editId: null,

    ZWECKE: [
        { id: 'wareneinkauf',    label: 'Wareneinkauf (Flohmarkt / Privatkauf / Laden)' },
        { id: 'paket_aufgeben', label: 'Paket aufgeben (Post / DHL / Hermes / DPD)' },
        { id: 'paket_abholen',  label: 'Paket abholen (Packstation / Abholung)' },
        { id: 'materialeinkauf',label: 'Materialeinkauf (Verpackung, Bürobedarf)' },
        { id: 'meeting',        label: 'Geschäftliches Meeting / Beratung' },
        { id: 'bank_behoerde',  label: 'Bank / Behörde (geschäftlich)' },
        { id: 'sonstiges',      label: 'Sonstiges' },
    ],

    BERECHNUNGSARTEN: [
        { id: 'pauschale_pkw',       label: 'Kilometerpauschale PKW (0,30 €/km)',      rate: 0.30 },
        { id: 'pauschale_motorrad',  label: 'Kilometerpauschale Motorrad (0,20 €/km)', rate: 0.20 },
        { id: 'fahrrad',             label: 'Fahrrad / Zu Fuß (0,00 €)',               rate: 0.00 },
        { id: 'tatsaechlich',        label: 'Tatsächliche Kosten (manuell eingeben)',   rate: null },
    ],

    WOCHENTAGE: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],

    calcKosten(gesamtKm, berechnungsart, tatsKosten) {
        if (berechnungsart === 'tatsaechlich') return parseFloat(tatsKosten) || 0;
        const art = this.BERECHNUNGSARTEN.find(a => a.id === berechnungsart);
        if (!art || art.rate === null) return 0;
        return Math.round(gesamtKm * art.rate * 100) / 100;
    },

    getWochentag(datum) {
        if (!datum) return '';
        return this.WOCHENTAGE[new Date(datum + 'T12:00:00').getDay()] || '';
    },

    _getFiltered(fahrten) {
        let f = [...fahrten];
        if (this._filterYear !== 'all') f = f.filter(x => (x.datum || '').startsWith(this._filterYear));
        if (this._filterZweck) f = f.filter(x => x.zweck === this._filterZweck);
        if (this._filterFahrzeug) f = f.filter(x => (x.fahrzeug || 'PKW') === this._filterFahrzeug);
        return f.sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
    },

    render() {
        const fahrten = Store.getFahrten();
        const filtered = this._getFiltered(fahrten);
        // GoBD: stornierte Einträge anzeigen aber nicht in Summen zählen
        const aktivFiltered = filtered.filter(f => !f.storniert);
        const totalKm = aktivFiltered.reduce((s, f) => s + (parseFloat(f.gesamtKm || f.km) || 0), 0);
        const totalKosten = aktivFiltered.reduce((s, f) => s + (parseFloat(f.kosten) || 0), 0);
        const totalFahrten = aktivFiltered.length;

        const years = Array.from(new Set(fahrten.map(f => (f.datum || '').substring(0, 4)).filter(Boolean))).sort().reverse();
        const yearOpts = ['all', ...years].map(y =>
            `<option value="${y}" ${this._filterYear === y ? 'selected' : ''}>${y === 'all' ? 'Alle Jahre' : y}</option>`
        ).join('');
        const zweckOpts = [{ id: '', label: 'Alle Zwecke' }, ...this.ZWECKE].map(z =>
            `<option value="${z.id}" ${this._filterZweck === z.id ? 'selected' : ''}>${z.label}</option>`
        ).join('');
        const fahrzeugOpts = ['', 'PKW', 'Motorrad', 'Fahrrad', 'Zu Fuß'].map(f =>
            `<option value="${f}" ${this._filterFahrzeug === f ? 'selected' : ''}>${f === '' ? 'Alle Fahrzeuge' : f}</option>`
        ).join('');

        return `
            <div class="page-header">
                <h2>🚗 Fahrtenbuch</h2>
                <div class="page-header-actions no-print">
                    <button class="btn btn-primary" id="fbNeuBtn">+ Neue Fahrt</button>
                    <button class="btn" id="fbExportCSV">📥 CSV Export</button>
                    <button class="btn" id="fbDruckBtn">🖨️ Drucken</button>
                </div>
            </div>

            <div class="stats-grid">
                <div class="card stat-card info">
                    <div class="card-label">Gesamtkilometer</div>
                    <div class="card-value">${totalKm.toFixed(0)} km</div>
                    <div class="card-subtitle">${totalFahrten} Fahrten</div>
                </div>
                <div class="card stat-card danger">
                    <div class="card-label">Absetzbare Fahrtkosten</div>
                    <div class="card-value">${Utils.formatCurrency(totalKosten)}</div>
                    <div class="card-subtitle">Betriebsausgabe in EÜR</div>
                </div>
                <div class="card stat-card success">
                    <div class="card-label">Ø km pro Fahrt</div>
                    <div class="card-value">${totalFahrten > 0 ? (totalKm / totalFahrten).toFixed(1) : '0'} km</div>
                    <div class="card-subtitle">Durchschnitt</div>
                </div>
            </div>

            <div class="info-box" style="margin-bottom:12px;padding:10px 14px;background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);font-size:13px;color:var(--text-secondary);">
                <strong style="color:var(--info);">💡 §9 EStG Pauschalen:</strong>
                PKW: 0,30 €/km · Motorrad: 0,20 €/km · Fahrrad/Zu Fuß: 0,00 €.
                Fahrtkosten fließen automatisch in die EÜR ein.
            </div>

            <div id="fbFormContainer"></div>

            <div class="filter-bar no-print" style="margin-bottom:12px;">
                <div class="filter-group">
                    <label>Jahr</label>
                    <select class="form-select" id="fbFilterYear">${yearOpts}</select>
                </div>
                <div class="filter-group">
                    <label>Zweck</label>
                    <select class="form-select" id="fbFilterZweck">${zweckOpts}</select>
                </div>
                <div class="filter-group">
                    <label>Fahrzeug</label>
                    <select class="form-select" id="fbFilterFahrzeug">${fahrzeugOpts}</select>
                </div>
            </div>

            ${this._renderListe(filtered)}

            <div style="margin-top:20px;">
                <button class="btn btn-secondary" id="fbToggleMonate" style="margin-bottom:12px;">
                    ${this._showMonate ? '▲' : '▼'} Monatsübersicht
                </button>
                ${this._showMonate ? this._renderMonate(filtered) : ''}
            </div>
        `;
    },

    _renderForm(editId) {
        const f = editId ? Store.getFahrten().find(x => x.id === editId) : null;
        const orte = Store.getFahrtOrte();
        const orteDatalist = `<datalist id="fbOrteList">${orte.map(o => `<option value="${Utils.escapeHtml(o)}">`).join('')}</datalist>`;
        const nr = f?.nummer || Store.nextFahrtNumber();
        const berechnungsartDef = f?.berechnungsart || 'pauschale_pkw';
        const zweckOpts = this.ZWECKE.map(z =>
            `<option value="${z.id}" ${f?.zweck === z.id ? 'selected' : ''}>${z.label}</option>`
        ).join('');
        const berechnungsartOpts = this.BERECHNUNGSARTEN.map(a =>
            `<option value="${a.id}" ${berechnungsartDef === a.id ? 'selected' : ''}>${a.label}</option>`
        ).join('');
        const gesamtKm = f ? (f.hinUndRueck ? (f.km || 0) * 2 : (f.km || 0)) : 0;

        return `
            <div class="card" style="margin-bottom:16px;" id="fbFormCard">
                <div class="card-header">
                    <div class="card-title">${editId ? '✏️ Fahrt bearbeiten' : '+ Neue Fahrt erfassen'}</div>
                    <button class="btn btn-secondary btn-small" id="fbFormClose">✕ Schließen</button>
                </div>
                ${orteDatalist}
                <form id="fahrtForm">

                    <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Basisdaten</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Fahrten-Nr.</label>
                            <input type="text" class="form-input" id="fb_nummer" value="${nr}" readonly
                                style="background:var(--bg-card);color:var(--text-muted);font-family:monospace;font-size:12px;">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Datum *</label>
                            <input type="date" class="form-input" id="fb_datum" value="${f?.datum || Utils.todayISO()}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Wochentag</label>
                            <input type="text" class="form-input" id="fb_wochentag" readonly
                                value="${f ? this.getWochentag(f.datum) : this.getWochentag(Utils.todayISO())}"
                                style="background:var(--bg-card);color:var(--text-muted);">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Abfahrt (optional)</label>
                            <input type="time" class="form-input" id="fb_abfahrt" value="${f?.abfahrtszeit || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Ankunft (optional)</label>
                            <input type="time" class="form-input" id="fb_ankunft" value="${f?.ankunftszeit || ''}">
                        </div>
                    </div>

                    <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin:12px 0 8px;">Strecke</div>
                    <div class="form-row">
                        <div class="form-group" style="flex:2">
                            <label class="form-label">Von (Startort) *</label>
                            <input type="text" class="form-input" id="fb_von" list="fbOrteList"
                                value="${Utils.escapeHtml(f?.von || '')}" placeholder="z.B. Heimatadresse" required>
                        </div>
                        <div class="form-group" style="flex:2">
                            <label class="form-label">Nach (Zielort) *</label>
                            <input type="text" class="form-input" id="fb_nach" list="fbOrteList"
                                value="${Utils.escapeHtml(f?.nach || '')}" placeholder="z.B. Flohmarkt Stadtpark" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" style="display:flex;align-items:center;gap:6px;padding-top:24px;">
                                <input type="checkbox" id="fb_hinrueck" ${f?.hinUndRueck ? 'checked' : ''}
                                    style="width:16px;height:16px;"> Hin- &amp; Rückfahrt
                            </label>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Kilometer (einfach) *</label>
                            <input type="number" step="0.1" min="0" class="form-input" id="fb_km"
                                value="${f?.km || ''}" placeholder="0" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Gesamtkilometer</label>
                            <input type="text" class="form-input" id="fb_gesamtkm" readonly
                                value="${gesamtKm.toFixed(1)} km"
                                style="background:var(--bg-card);font-weight:600;color:var(--info);">
                        </div>
                        <div class="form-group">
                            <label class="form-label">km-Stand Abfahrt</label>
                            <input type="number" step="1" class="form-input" id="fb_km_ab"
                                value="${f?.kmstandAbfahrt || ''}" placeholder="optional">
                        </div>
                        <div class="form-group">
                            <label class="form-label">km-Stand Ankunft</label>
                            <input type="number" step="1" class="form-input" id="fb_km_an"
                                value="${f?.kmstandAnkunft || ''}" placeholder="optional">
                        </div>
                    </div>

                    <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin:12px 0 8px;">Fahrzeug &amp; Kosten</div>
                    <div class="form-row" style="align-items:flex-end;">
                        <div class="form-group">
                            <label class="form-label">Fahrzeug</label>
                            <select class="form-select" id="fb_fahrzeug">
                                ${['PKW', 'Motorrad', 'Fahrrad', 'Zu Fuß'].map(v =>
                                    `<option value="${v}" ${(f?.fahrzeug || 'PKW') === v ? 'selected' : ''}>${v}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="flex:2">
                            <label class="form-label">Berechnungsart</label>
                            <select class="form-select" id="fb_berechnungsart">${berechnungsartOpts}</select>
                        </div>
                        <div class="form-group" id="fb_tatsKostenGroup"
                            style="display:${berechnungsartDef === 'tatsaechlich' ? '' : 'none'}">
                            <label class="form-label">Tatsächl. Kosten (€)</label>
                            <input type="number" step="0.01" min="0" class="form-input" id="fb_tatsKosten"
                                value="${f?.tatsaechlicheKosten || ''}" placeholder="0,00">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Betrag (berechnet)</label>
                            <input type="text" class="form-input" id="fb_kosten_display" readonly
                                value="${Utils.formatCurrency(f?.kosten || 0)}"
                                style="background:var(--bg-card);font-weight:700;color:var(--success);font-size:15px;">
                        </div>
                    </div>
                    ${berechnungsartDef === 'tatsaechlich' ? `<div class="form-hint" style="margin-top:-8px;margin-bottom:8px;font-size:12px;color:var(--text-muted);">
                        💡 Bitte separate Belege (Tankquittung etc.) als Ausgabe erfassen und dort verknüpfen.
                    </div>` : ''}

                    <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin:12px 0 8px;">Zweck &amp; Notizen</div>
                    <div class="form-row" style="align-items:flex-start;">
                        <div class="form-group" style="flex:2">
                            <label class="form-label">Fahrtzweck *</label>
                            <select class="form-select" id="fb_zweck" required>
                                <option value="">Bitte wählen…</option>
                                ${zweckOpts}
                            </select>
                        </div>
                        <div class="form-group" id="fb_zweckSonstigGrp" style="flex:2;display:${f?.zweck === 'sonstiges' ? '' : 'none'}">
                            <label class="form-label">Zweck (Freitext)</label>
                            <input type="text" class="form-input" id="fb_zweck_text"
                                value="${Utils.escapeHtml(f?.zweckSonstiges || '')}" placeholder="Beschreibung des Zwecks">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Notizen (optional)</label>
                        <input type="text" class="form-input" id="fb_notizen"
                            value="${Utils.escapeHtml(f?.notizen || '')}" placeholder="Besonderheiten, Hinweise…">
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">${editId ? '💾 Aktualisieren' : '💾 Fahrt speichern'}</button>
                        <button type="button" class="btn btn-secondary" id="fbFormClose2">Abbrechen</button>
                    </div>
                </form>
            </div>
        `;
    },

    _renderListe(filtered) {
        let rows = '';
        if (!filtered.length) {
            rows = '<tr><td colspan="9" class="table-empty">Keine Fahrten. Klicke "+ Neue Fahrt" um zu starten.</td></tr>';
        } else {
            rows = filtered.map(f => {
                const zweckObj = this.ZWECKE.find(z => z.id === f.zweck);
                const zweckLabel = f.zweck === 'sonstiges' && f.zweckSonstiges
                    ? f.zweckSonstiges
                    : (zweckObj?.label.split('(')[0].trim() || f.zweck || '–');
                const gesamtKm = parseFloat(f.gesamtKm || f.km) || 0;
                const isSt = !!f.storniert;
                const rowStyle = isSt ? 'opacity:.45;text-decoration:line-through;' : '';
                return `<tr style="${rowStyle}">
                    <td style="font-family:monospace;font-size:11px;white-space:nowrap;color:var(--text-muted);">${Utils.escapeHtml(f.nummer || '–')}${isSt ? ' <span style="text-decoration:none;font-size:10px;color:#94a3b8;">[ST]</span>' : ''}</td>
                    <td style="white-space:nowrap;">${Utils.formatDate(f.datum)}</td>
                    <td style="font-size:12px;color:var(--text-muted);">${this.getWochentag(f.datum)}</td>
                    <td>${Utils.escapeHtml(f.von || '')} → ${Utils.escapeHtml(f.nach || '')}${f.hinUndRueck ? ' <span style="font-size:10px;color:var(--text-muted);">(H+R)</span>' : ''}</td>
                    <td style="text-align:right">${gesamtKm.toFixed(1)} km</td>
                    <td style="font-size:12px;max-width:160px;">${Utils.escapeHtml(zweckLabel)}</td>
                    <td style="font-size:12px;color:var(--text-muted);">${Utils.escapeHtml(f.fahrzeug || 'PKW')}</td>
                    <td style="text-align:right;font-weight:600;color:var(--success);">${isSt ? '–' : Utils.formatCurrency(f.kosten)}</td>
                    <td class="table-actions">
                        ${isSt ? '' : `<button class="btn btn-small" data-edit-fahrt="${f.id}" title="Bearbeiten">✏️</button>`}
                        ${isSt ? '' : `<button class="btn btn-small btn-danger" data-delete-fahrt="${f.id}" title="Stornieren">🗑️</button>`}
                    </td>
                </tr>`;
            }).join('');
        }

        const aktivFiltered = filtered.filter(f => !f.storniert);
        const totalKm = aktivFiltered.reduce((s, f) => s + (parseFloat(f.gesamtKm || f.km) || 0), 0);
        const totalKosten = aktivFiltered.reduce((s, f) => s + (parseFloat(f.kosten) || 0), 0);

        return `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Nr.</th>
                            <th>Datum</th>
                            <th>Tag</th>
                            <th>Strecke</th>
                            <th style="text-align:right">km</th>
                            <th>Zweck</th>
                            <th>Fahrzeug</th>
                            <th style="text-align:right">Betrag</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    ${aktivFiltered.length > 0 ? `<tfoot>
                        <tr style="font-weight:600;background:var(--bg-card);">
                            <td colspan="4" style="text-align:right;padding-right:12px;color:var(--text-secondary);">
                                Summe (${aktivFiltered.length} Fahrten):
                            </td>
                            <td style="text-align:right">${totalKm.toFixed(1)} km</td>
                            <td colspan="2"></td>
                            <td style="text-align:right;color:var(--success);">${Utils.formatCurrency(totalKosten)}</td>
                            <td></td>
                        </tr>
                    </tfoot>` : ''}
                </table>
            </div>
        `;
    },

    _renderMonate(filtered) {
        const monate = {};
        filtered.filter(f => !f.storniert).forEach(f => {
            const key = (f.datum || '').substring(0, 7);
            if (!key || key.length < 7) return;
            if (!monate[key]) monate[key] = { fahrten: [], km: 0, kosten: 0 };
            monate[key].fahrten.push(f);
            monate[key].km += parseFloat(f.gesamtKm || f.km) || 0;
            monate[key].kosten += parseFloat(f.kosten) || 0;
        });

        if (!Object.keys(monate).length) {
            return '<p style="color:var(--text-muted);padding:12px;">Keine Daten für die aktuelle Filterauswahl.</p>';
        }

        return `
            <div class="card">
                <div class="card-header"><div class="card-title">📅 Monatsübersicht</div></div>
                <div style="display:flex;flex-direction:column;gap:8px;padding:0 16px 16px;">
                    ${Object.entries(monate).sort(([a], [b]) => b.localeCompare(a)).map(([key, data]) => {
                        const [year, month] = key.split('-');
                        const monthName = Utils.getMonthName(parseInt(month) - 1) + ' ' + year;
                        const zweckSummen = {};
                        data.fahrten.forEach(f => {
                            const z = this.ZWECKE.find(x => x.id === f.zweck)?.label.split('(')[0].trim() || f.zweck || 'Sonstiges';
                            zweckSummen[z] = (zweckSummen[z] || 0) + (parseFloat(f.gesamtKm || f.km) || 0);
                        });
                        return `
                        <div style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                                <strong>${monthName}</strong>
                                <span style="font-size:13px;">
                                    ${data.fahrten.length} Fahrten ·
                                    ${data.km.toFixed(0)} km ·
                                    <strong style="color:var(--success);">${Utils.formatCurrency(data.kosten)}</strong>
                                </span>
                            </div>
                            <div style="font-size:12px;color:var(--text-muted);">
                                ${Object.entries(zweckSummen).map(([z, km]) => `${z}: ${km.toFixed(0)} km`).join(' · ')}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    },

    init() {
        document.getElementById('fbFilterYear')?.addEventListener('change', e => {
            this._filterYear = e.target.value; this._refresh();
        });
        document.getElementById('fbFilterZweck')?.addEventListener('change', e => {
            this._filterZweck = e.target.value; this._refresh();
        });
        document.getElementById('fbFilterFahrzeug')?.addEventListener('change', e => {
            this._filterFahrzeug = e.target.value; this._refresh();
        });

        document.getElementById('fbNeuBtn')?.addEventListener('click', () => {
            this._editId = null;
            const c = document.getElementById('fbFormContainer');
            if (c) { c.innerHTML = this._renderForm(null); this._bindForm(); c.scrollIntoView({ behavior: 'smooth' }); }
        });

        document.getElementById('fbExportCSV')?.addEventListener('click', () => {
            const fahrten = Store.getFahrten();
            const hdr = ['Nr.', 'Datum', 'Wochentag', 'Von', 'Nach', 'Hin+Rück', 'km (einfach)', 'Gesamtkilometer',
                         'km-Stand Abfahrt', 'km-Stand Ankunft', 'Fahrzeug', 'Berechnungsart', 'Betrag (€)',
                         'Zweck', 'Notizen'];
            const rows = [hdr];
            fahrten.forEach(f => rows.push([
                f.nummer || '', f.datum || '', this.getWochentag(f.datum),
                f.von || '', f.nach || '', f.hinUndRueck ? 'Ja' : 'Nein',
                f.km || 0, f.gesamtKm || f.km || 0,
                f.kmstandAbfahrt || '', f.kmstandAnkunft || '',
                f.fahrzeug || 'PKW', f.berechnungsart || '',
                (parseFloat(f.kosten) || 0).toFixed(2),
                this.ZWECKE.find(z => z.id === f.zweck)?.label || f.zweck || '',
                f.notizen || ''
            ]));
            Utils.downloadCSV(rows, 'fahrtenbuch_export.csv');
            Utils.showToast('CSV exportiert', 'success');
        });

        document.getElementById('fbDruckBtn')?.addEventListener('click', () => this._print());

        document.getElementById('fbToggleMonate')?.addEventListener('click', () => {
            this._showMonate = !this._showMonate; this._refresh();
        });

        document.querySelectorAll('[data-edit-fahrt]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._editId = btn.dataset.editFahrt;
                const c = document.getElementById('fbFormContainer');
                if (c) { c.innerHTML = this._renderForm(this._editId); this._bindForm(); c.scrollIntoView({ behavior: 'smooth' }); }
            });
        });

        document.querySelectorAll('[data-delete-fahrt]').forEach(btn => {
            btn.addEventListener('click', () => {
                const grund = prompt('Stornogrund (GoBD-Pflicht):', 'Falscheingabe');
                if (grund === null) return;
                Store.deleteFahrt(btn.dataset.deleteFahrt, grund || 'Manuell storniert');
                Utils.showToast('Fahrt storniert (GoBD-konform)', 'success');
                this._refresh();
            });
        });
    },

    _bindForm() {
        const get = id => document.getElementById(id);

        const updateBerechnung = () => {
            const km = parseFloat(get('fb_km')?.value) || 0;
            const hr = get('fb_hinrueck')?.checked || false;
            const gesamtKm = hr ? km * 2 : km;
            const art = get('fb_berechnungsart')?.value || 'pauschale_pkw';
            const tk = parseFloat(get('fb_tatsKosten')?.value) || 0;
            const kosten = this.calcKosten(gesamtKm, art, tk);
            const gkEl = get('fb_gesamtkm');
            if (gkEl) gkEl.value = gesamtKm.toFixed(1) + ' km';
            const kdEl = get('fb_kosten_display');
            if (kdEl) kdEl.value = Utils.formatCurrency(kosten);
            const tg = get('fb_tatsKostenGroup');
            if (tg) tg.style.display = art === 'tatsaechlich' ? '' : 'none';
        };

        get('fb_km')?.addEventListener('input', updateBerechnung);
        get('fb_hinrueck')?.addEventListener('change', updateBerechnung);
        get('fb_berechnungsart')?.addEventListener('change', updateBerechnung);
        get('fb_tatsKosten')?.addEventListener('input', updateBerechnung);

        get('fb_fahrzeug')?.addEventListener('change', () => {
            const v = get('fb_fahrzeug').value;
            const ba = get('fb_berechnungsart');
            if (!ba) return;
            if (v === 'Motorrad') ba.value = 'pauschale_motorrad';
            else if (v === 'Fahrrad' || v === 'Zu Fuß') ba.value = 'fahrrad';
            else ba.value = 'pauschale_pkw';
            updateBerechnung();
        });

        get('fb_datum')?.addEventListener('change', () => {
            const wt = get('fb_wochentag');
            if (wt) wt.value = this.getWochentag(Utils.getDateInputValue('fb_datum'));
        });

        get('fb_zweck')?.addEventListener('change', () => {
            const sg = get('fb_zweckSonstigGrp');
            if (sg) sg.style.display = get('fb_zweck').value === 'sonstiges' ? '' : 'none';
        });

        const closeForm = () => {
            const c = document.getElementById('fbFormContainer');
            if (c) c.innerHTML = '';
            this._editId = null;
        };
        get('fbFormClose')?.addEventListener('click', closeForm);
        get('fbFormClose2')?.addEventListener('click', closeForm);

        get('fahrtForm')?.addEventListener('submit', e => {
            e.preventDefault();
            const km = parseFloat(get('fb_km').value) || 0;
            const hr = get('fb_hinrueck').checked;
            const gesamtKm = hr ? km * 2 : km;
            const art = get('fb_berechnungsart').value;
            const tk = parseFloat(get('fb_tatsKosten')?.value) || 0;
            const von = get('fb_von').value.trim();
            const nach = get('fb_nach').value.trim();
            const zweck = get('fb_zweck').value;

            if (!zweck) { Utils.showToast('Bitte Fahrtzweck wählen', 'warning'); return; }

            Store.addFahrtOrt(von);
            Store.addFahrtOrt(nach);

            const existing = this._editId ? Store.getFahrten().find(x => x.id === this._editId) : null;
            Store.saveFahrt({
                id: this._editId || undefined,
                createdAt: existing?.createdAt || new Date().toISOString(),
                nummer: get('fb_nummer').value,
                datum: Utils.getDateInputValue('fb_datum'),
                wochentag: this.getWochentag(Utils.getDateInputValue('fb_datum')),
                abfahrtszeit: get('fb_abfahrt').value || null,
                ankunftszeit: get('fb_ankunft').value || null,
                von, nach, hinUndRueck: hr, km, gesamtKm,
                kmstandAbfahrt: get('fb_km_ab').value ? parseInt(get('fb_km_ab').value) : null,
                kmstandAnkunft: get('fb_km_an').value ? parseInt(get('fb_km_an').value) : null,
                fahrzeug: get('fb_fahrzeug').value,
                berechnungsart: art,
                tatsaechlicheKosten: art === 'tatsaechlich' ? tk : null,
                kosten: this.calcKosten(gesamtKm, art, tk),
                zweck,
                zweckSonstiges: get('fb_zweck_text')?.value.trim() || '',
                notizen: get('fb_notizen').value.trim()
            });

            Utils.showToast(this._editId ? 'Fahrt aktualisiert' : `Fahrt gespeichert (${Utils.formatCurrency(this.calcKosten(gesamtKm, art, tk))})`, 'success');
            this._editId = null;
            this._refresh();
        });

        updateBerechnung();
    },

    _print() {
        const fahrten = this._getFiltered(Store.getFahrten());
        const totalKm = fahrten.reduce((s, f) => s + (parseFloat(f.gesamtKm || f.km) || 0), 0);
        const totalKosten = fahrten.reduce((s, f) => s + (parseFloat(f.kosten) || 0), 0);
        const label = this._filterYear === 'all' ? 'Gesamt' : this._filterYear;

        const pw = window.open('', '_blank');
        pw.document.write(`<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
        <title>Fahrtenbuch ${label}</title>
        <style>
            body{font-family:Arial,sans-serif;font-size:11px;margin:20mm;}
            h1{font-size:16px;margin:0 0 2px;}
            .sub{font-size:10px;color:#666;margin-bottom:14px;}
            table{width:100%;border-collapse:collapse;margin-top:8px;}
            th,td{border:1px solid #ccc;padding:3px 5px;text-align:left;vertical-align:top;}
            th{background:#f0f0f0;font-weight:700;font-size:10px;}
            tfoot td{font-weight:700;background:#f0f0f0;}
            tr:nth-child(even){background:#fafafa;}
            @media print{@page{size:A4 landscape;margin:10mm;}}
        </style></head><body>
        <h1>🚗 Fahrtenbuch – ${label}</h1>
        <div class="sub">
            Erstellt: ${new Date().toLocaleDateString('de-DE')} |
            §9 EStG Kilometerpauschale |
            Fahrzeugnutzung für betriebliche Zwecke
        </div>
        <table>
            <thead><tr>
                <th>Nr.</th><th>Datum</th><th>Tag</th><th>Von</th><th>Nach</th>
                <th style="text-align:right">km</th><th>Zweck</th><th>Fahrzeug</th>
                <th>Berechnungsart</th><th style="text-align:right">Betrag €</th>
            </tr></thead>
            <tbody>
            ${fahrten.map(f => `<tr>
                <td style="font-family:monospace;font-size:10px;">${f.nummer || ''}</td>
                <td style="white-space:nowrap">${new Date(f.datum + 'T12:00:00').toLocaleDateString('de-DE')}</td>
                <td>${this.getWochentag(f.datum).substring(0, 2)}.</td>
                <td>${f.von || ''}</td>
                <td>${f.nach || ''}${f.hinUndRueck ? ' (H+R)' : ''}</td>
                <td style="text-align:right">${(parseFloat(f.gesamtKm || f.km) || 0).toFixed(1)}</td>
                <td>${this.ZWECKE.find(z => z.id === f.zweck)?.label.split('(')[0].trim() || f.zweck || ''}</td>
                <td>${f.fahrzeug || 'PKW'}</td>
                <td style="font-size:10px;">${this.BERECHNUNGSARTEN.find(a => a.id === f.berechnungsart)?.label.split('(')[0].trim() || ''}</td>
                <td style="text-align:right">${(parseFloat(f.kosten) || 0).toFixed(2).replace('.', ',')} €</td>
            </tr>`).join('')}
            </tbody>
            <tfoot><tr>
                <td colspan="5" style="text-align:right">Gesamt (${fahrten.length} Fahrten):</td>
                <td style="text-align:right">${totalKm.toFixed(1)}</td>
                <td colspan="3"></td>
                <td style="text-align:right">${totalKosten.toFixed(2).replace('.', ',')} €</td>
            </tr></tfoot>
        </table>
        <script>window.onload=()=>{window.print();}<\/script>
        </body></html>`);
        pw.document.close();
    },

    _refresh() {
        document.getElementById('content').innerHTML = this.render();
        this.init();
    }
};
