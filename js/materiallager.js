// ============================================
// Materiallager Module – Verpackungskosten
// ============================================
const Materiallager = {
    _tab: 'bestand',

    STD_MATERIAL: [
        { id: 'karton_xs',       name: 'Karton XS',            einheit: 'Stück',  kategorie: 'Karton' },
        { id: 'karton_s',        name: 'Karton S',             einheit: 'Stück',  kategorie: 'Karton' },
        { id: 'karton_m',        name: 'Karton M',             einheit: 'Stück',  kategorie: 'Karton' },
        { id: 'karton_l',        name: 'Karton L',             einheit: 'Stück',  kategorie: 'Karton' },
        { id: 'karton_xl',       name: 'Karton XL',            einheit: 'Stück',  kategorie: 'Karton' },
        { id: 'versandbeutel_s', name: 'Versandbeutel S',      einheit: 'Stück',  kategorie: 'Beutel' },
        { id: 'versandbeutel_m', name: 'Versandbeutel M',      einheit: 'Stück',  kategorie: 'Beutel' },
        { id: 'versandbeutel_l', name: 'Versandbeutel L',      einheit: 'Stück',  kategorie: 'Beutel' },
        { id: 'luftpolster_s',   name: 'Luftpolstertasche S',  einheit: 'Stück',  kategorie: 'Polstertasche' },
        { id: 'luftpolster_m',   name: 'Luftpolstertasche M',  einheit: 'Stück',  kategorie: 'Polstertasche' },
        { id: 'luftpolster_l',   name: 'Luftpolstertasche L',  einheit: 'Stück',  kategorie: 'Polstertasche' },
        { id: 'klebeband',       name: 'Klebeband',            einheit: 'Rolle',  kategorie: 'Zubehör' },
        { id: 'fuellmaterial',   name: 'Füllmaterial',         einheit: 'Beutel', kategorie: 'Zubehör' },
        { id: 'seidenpapier',    name: 'Seidenpapier',         einheit: 'Blatt',  kategorie: 'Zubehör' },
    ],

    render() {
        const bestand = Store.getMaterialBestand();
        const totalRestwert = bestand.reduce((s, m) =>
            s + (parseFloat(m.kostenProEinheit) || 0) * (parseInt(m.bestand) || 0), 0);
        const totalArten = bestand.length;
        const niedrig = bestand.filter(m => (parseInt(m.bestand) || 0) <= (parseInt(m.mindestbestand) || 0) && (parseInt(m.bestand) || 0) >= 0).length;

        const tabs = [
            { id: 'bestand',  label: '📦 Bestand' },
            { id: 'einkauf',  label: '🛒 Einkauf' },
            { id: 'verbrauch',label: '📊 Verbrauch' },
        ];

        return `
            <div class="page-header">
                <h2>Materiallager</h2>
                <div class="page-header-actions no-print">
                    <button class="btn" id="mlExportCSV">📥 CSV Export</button>
                </div>
            </div>

            <div class="stats-grid">
                <div class="card stat-card info">
                    <div class="card-label">Materialarten</div>
                    <div class="card-value">${totalArten}</div>
                    <div class="card-subtitle">im Lager</div>
                </div>
                <div class="card stat-card warning">
                    <div class="card-label">Restwert Lager</div>
                    <div class="card-value">${Utils.formatCurrency(totalRestwert)}</div>
                    <div class="card-subtitle">Umlaufvermögen</div>
                </div>
                ${niedrig > 0 ? `<div class="card stat-card danger">
                    <div class="card-label">Nachbestellen</div>
                    <div class="card-value">${niedrig}</div>
                    <div class="card-subtitle">unter Mindestbestand</div>
                </div>` : `<div class="card stat-card success">
                    <div class="card-label">Bestand</div>
                    <div class="card-value">✓</div>
                    <div class="card-subtitle">Alle gut bestückt</div>
                </div>`}
            </div>

            <div class="info-box" style="margin-bottom:12px;padding:10px 14px;background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);font-size:13px;color:var(--text-secondary);">
                <strong style="color:var(--info);">💡 Materiallager:</strong>
                Erfasse Verpackungsmaterial (Kartons, Beutel etc.) mit Bestand und Kosten.
                Beim Speichern eines Verkaufs kannst du verwendetes Material abbuchen.
                Die Kosten fließen in die EÜR als Betriebsausgabe ein.
            </div>

            <div style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:0;">
                ${tabs.map(t => `
                    <button class="btn${this._tab === t.id ? ' btn-primary' : ' btn-secondary'}"
                        style="border-radius:var(--radius) var(--radius) 0 0;margin-bottom:-1px;border-bottom:${this._tab === t.id ? '2px solid var(--primary)' : 'none'};"
                        data-ml-tab="${t.id}">${t.label}</button>
                `).join('')}
            </div>

            <div id="mlTabContent">
                ${this._tab === 'bestand'   ? this._renderBestand(bestand)  : ''}
                ${this._tab === 'einkauf'   ? this._renderEinkauf()          : ''}
                ${this._tab === 'verbrauch' ? this._renderVerbrauch()        : ''}
            </div>
        `;
    },

    _renderBestand(bestand) {
        const usedIds = new Set(bestand.map(m => m.stdId || m.id));

        const rows = bestand.length === 0
            ? '<tr><td colspan="7" class="table-empty">Noch kein Material erfasst. Materialart unten hinzufügen.</td></tr>'
            : bestand.map(m => {
                const bestandVal = parseInt(m.bestand) || 0;
                const mindest = parseInt(m.mindestbestand) || 0;
                const warn = bestandVal <= mindest && mindest > 0;
                const restwert = (parseFloat(m.kostenProEinheit) || 0) * bestandVal;
                return `<tr${warn ? ' style="background:rgba(239,68,68,0.04);"' : ''}>
                    <td>${Utils.escapeHtml(m.name)}</td>
                    <td style="color:var(--text-muted);font-size:12px;">${Utils.escapeHtml(m.kategorie || '')}</td>
                    <td style="text-align:right;font-weight:600;color:${warn ? 'var(--danger)' : 'var(--success)'};">
                        ${bestandVal} ${Utils.escapeHtml(m.einheit || 'Stück')}
                        ${warn ? ' ⚠️' : ''}
                    </td>
                    <td style="text-align:right;color:var(--text-muted);">${mindest > 0 ? mindest + ' ' + (m.einheit || 'Stück') : '–'}</td>
                    <td style="text-align:right">${Utils.formatCurrency(m.kostenProEinheit)}</td>
                    <td style="text-align:right;font-weight:600;">${Utils.formatCurrency(restwert)}</td>
                    <td class="table-actions">
                        <button class="btn btn-small" data-ml-edit="${m.id}" title="Bearbeiten">✏️</button>
                        <button class="btn btn-small" data-ml-einkauf="${m.id}" title="Bestand erhöhen (Einkauf)">+</button>
                        <button class="btn btn-small btn-danger" data-ml-delete="${m.id}" title="Löschen">🗑️</button>
                    </td>
                </tr>`;
            }).join('');

        const stdOpts = this.STD_MATERIAL
            .filter(s => !usedIds.has(s.id))
            .map(s => `<option value="${s.id}">${s.name} (${s.einheit})</option>`)
            .join('');

        return `
            <div class="card" style="margin-bottom:16px;">
                <div class="card-header"><div class="card-title">Neues Material hinzufügen</div></div>
                <form id="mlBestandForm">
                    <div class="form-row">
                        <div class="form-group" style="flex:2">
                            <label class="form-label">Standardmaterial wählen</label>
                            <select class="form-select" id="ml_std_select">
                                <option value="">– Manuelle Eingabe –</option>
                                ${stdOpts}
                            </select>
                        </div>
                        <div class="form-group" style="flex:0.5;align-self:flex-end;">
                            <button type="button" class="btn btn-secondary" id="mlStdFill">Ausfüllen</button>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="flex:2">
                            <label class="form-label">Bezeichnung *</label>
                            <input type="text" class="form-input" id="ml_name" placeholder="z.B. Karton M" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Einheit</label>
                            <input type="text" class="form-input" id="ml_einheit" placeholder="Stück" value="Stück">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Kategorie</label>
                            <input type="text" class="form-input" id="ml_kategorie" placeholder="Karton / Beutel …">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Anfangsbestand</label>
                            <input type="number" step="1" min="0" max="9999999" class="form-input" id="ml_bestand" placeholder="0" value="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Mindestbestand (Warnung)</label>
                            <input type="number" step="1" min="0" max="9999999" class="form-input" id="ml_mindest" placeholder="0" value="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Kosten pro Einheit (€)</label>
                            <input type="number" step="0.001" min="0" max="99999999" class="form-input" id="ml_kosten" placeholder="0,00">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">+ Materialart hinzufügen</button>
                    </div>
                </form>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Bezeichnung</th>
                            <th>Kategorie</th>
                            <th style="text-align:right">Bestand</th>
                            <th style="text-align:right">Mindestbestand</th>
                            <th style="text-align:right">€/Einheit</th>
                            <th style="text-align:right">Restwert</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    _renderEinkauf() {
        const bestand = Store.getMaterialBestand();
        const einkauefe = Store.getMaterialEinkauefe().sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

        const matOpts = bestand.length > 0
            ? bestand.map(m => `<option value="${m.id}">${Utils.escapeHtml(m.name)} (Bestand: ${parseInt(m.bestand) || 0} ${Utils.escapeHtml(m.einheit || 'Stück')})</option>`).join('')
            : '<option value="">Erst Materialarten unter "Bestand" anlegen</option>';

        const rows = einkauefe.length === 0
            ? '<tr><td colspan="7" class="table-empty">Noch keine Einkäufe erfasst.</td></tr>'
            : einkauefe.map(e => `<tr>
                <td>${Utils.formatDate(e.datum)}</td>
                <td>${Utils.escapeHtml(e.materialName || '')}</td>
                <td style="text-align:right">${e.menge || 0} ${Utils.escapeHtml(e.einheit || 'Stück')}</td>
                <td style="text-align:right">${Utils.formatCurrency(e.kostenProEinheit)}</td>
                <td style="text-align:right;font-weight:600;">${Utils.formatCurrency(e.gesamtkosten)}</td>
                <td>${Utils.escapeHtml(e.lieferant || '–')}</td>
                <td class="table-actions">
                    <button class="btn btn-small btn-danger" data-ml-del-einkauf="${e.id}">🗑️</button>
                </td>
            </tr>`).join('');

        return `
            <div class="card" style="margin-bottom:16px;">
                <div class="card-header"><div class="card-title">Materialeinkauf erfassen</div></div>
                ${bestand.length === 0 ? '<div style="padding:12px 16px;color:var(--text-muted);">Erst Materialarten unter "Bestand" anlegen.</div>' : `
                <form id="mlEinkaufForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <input type="date" class="form-input" id="mle_datum" value="${Utils.todayISO()}">
                        </div>
                        <div class="form-group" style="flex:2">
                            <label class="form-label">Material *</label>
                            <select class="form-select" id="mle_material" required>
                                <option value="">Bitte wählen…</option>
                                ${matOpts}
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Menge *</label>
                            <input type="number" step="1" min="1" class="form-input" id="mle_menge" placeholder="50" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Gesamtkosten (€)</label>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="mle_gesamt" placeholder="0,00">
                        </div>
                        <div class="form-group">
                            <label class="form-label">€/Einheit (berechnet)</label>
                            <input type="text" class="form-input" id="mle_einzeln_display" readonly value="0,000 €"
                                style="background:var(--bg-card);font-weight:600;color:var(--info);">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Lieferant (optional)</label>
                            <input type="text" class="form-input" id="mle_lieferant" placeholder="z.B. Amazon, Baumarkt">
                        </div>
                    </div>
                    <div class="form-hint" style="font-size:12px;color:var(--text-muted);margin-top:-4px;margin-bottom:8px;">
                        Der €/Einheit-Wert wird automatisch berechnet und aktualisiert den gleitenden Durchschnitt im Bestand.
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">+ Einkauf buchen</button>
                    </div>
                </form>`}
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Datum</th><th>Material</th><th style="text-align:right">Menge</th>
                            <th style="text-align:right">€/Einheit</th><th style="text-align:right">Gesamt</th>
                            <th>Lieferant</th><th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    _renderVerbrauch() {
        const log = Store.getMaterialVerbrauch()
            .filter(v => !v.storniert)
            .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

        const rows = log.length === 0
            ? '<tr><td colspan="7" class="table-empty">Noch kein Verbrauch gebucht. Verbrauch wird automatisch beim Speichern eines Verkaufs mit Materialbuchung gebucht.</td></tr>'
            : log.map(v => `<tr>
                <td>${Utils.formatDate(v.datum)}</td>
                <td>${Utils.escapeHtml(v.materialName || '')}</td>
                <td style="text-align:right">${v.menge || 0} ${Utils.escapeHtml(v.einheit || 'Stück')}</td>
                <td style="text-align:right">${Utils.formatCurrency(v.kostenProEinheit)}</td>
                <td style="text-align:right;font-weight:600;">${Utils.formatCurrency(v.kosten)}</td>
                <td style="font-size:12px;color:var(--text-muted);">${Utils.escapeHtml(v.grund || '')}${v.referenzBez ? ': ' + Utils.escapeHtml(v.referenzBez) : ''}</td>
                <td class="table-actions">
                    <button class="btn btn-small btn-danger" data-ml-del-verbrauch="${v.id}" title="Stornieren">↩️</button>
                </td>
            </tr>`).join('');

        const totalKosten = log.reduce((s, v) => s + (parseFloat(v.kosten) || 0), 0);

        return `
            <div style="margin-bottom:12px;padding:10px 16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);font-size:13px;display:flex;justify-content:space-between;">
                <span>Verbrauchskosten gesamt (aktiv):</span>
                <strong style="color:var(--danger);">${Utils.formatCurrency(totalKosten)}</strong>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Datum</th><th>Material</th><th style="text-align:right">Menge</th>
                            <th style="text-align:right">€/Einheit</th><th style="text-align:right">Kosten</th>
                            <th>Grund / Referenz</th><th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>

            <div class="card" style="margin-top:16px;">
                <div class="card-header"><div class="card-title">Manueller Verbrauch buchen</div></div>
                <form id="mlVerbrauchForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <input type="date" class="form-input" id="mlv_datum" value="${Utils.todayISO()}">
                        </div>
                        <div class="form-group" style="flex:2">
                            <label class="form-label">Material *</label>
                            <select class="form-select" id="mlv_material" required>
                                <option value="">Bitte wählen…</option>
                                ${Store.getMaterialBestand().map(m =>
                                    `<option value="${m.id}">${Utils.escapeHtml(m.name)} (${parseInt(m.bestand) || 0} ${Utils.escapeHtml(m.einheit || 'Stück')})</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Menge *</label>
                            <input type="number" step="1" min="1" class="form-input" id="mlv_menge" placeholder="1" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Grund</label>
                            <input type="text" class="form-input" id="mlv_grund" placeholder="z.B. Verlust, Test …">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-warning">Verbrauch buchen</button>
                    </div>
                </form>
            </div>
        `;
    },

    init() {
        document.querySelectorAll('[data-ml-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._tab = btn.dataset.mlTab;
                this._refresh();
            });
        });

        document.getElementById('mlExportCSV')?.addEventListener('click', () => {
            const bestand = Store.getMaterialBestand();
            const rows = [['Bezeichnung', 'Kategorie', 'Einheit', 'Bestand', 'Mindestbestand', '€/Einheit', 'Restwert €']];
            bestand.forEach(m => rows.push([
                m.name, m.kategorie || '', m.einheit || 'Stück',
                m.bestand || 0, m.mindestbestand || 0,
                (parseFloat(m.kostenProEinheit) || 0).toFixed(3),
                ((parseFloat(m.kostenProEinheit) || 0) * (parseInt(m.bestand) || 0)).toFixed(2)
            ]));
            Utils.downloadCSV(rows, 'materiallager_export.csv');
            Utils.showToast('CSV exportiert', 'success');
        });

        if (this._tab === 'bestand') this._bindBestand();
        if (this._tab === 'einkauf') this._bindEinkauf();
        if (this._tab === 'verbrauch') this._bindVerbrauch();
    },

    _bindBestand() {
        document.getElementById('mlStdFill')?.addEventListener('click', () => {
            const sel = document.getElementById('ml_std_select')?.value;
            if (!sel) return;
            const std = this.STD_MATERIAL.find(s => s.id === sel);
            if (!std) return;
            const n = document.getElementById('ml_name');
            const e = document.getElementById('ml_einheit');
            const k = document.getElementById('ml_kategorie');
            if (n) n.value = std.name;
            if (e) e.value = std.einheit;
            if (k) k.value = std.kategorie;
        });

        document.getElementById('mlBestandForm')?.addEventListener('submit', e => {
            e.preventDefault();
            const name = document.getElementById('ml_name').value.trim();
            if (!name) return;
            const std = this.STD_MATERIAL.find(s => s.name === name);
            Store.saveMaterialBestandItem({
                stdId: std?.id || null,
                name,
                einheit: document.getElementById('ml_einheit').value.trim() || 'Stück',
                kategorie: document.getElementById('ml_kategorie').value.trim(),
                bestand: parseInt(document.getElementById('ml_bestand').value) || 0,
                mindestbestand: parseInt(document.getElementById('ml_mindest').value) || 0,
                kostenProEinheit: parseFloat(document.getElementById('ml_kosten').value) || 0,
            });
            Utils.showToast(Utils.escapeHtml(name) + ' hinzugefügt', 'success');
            this._refresh();
        });

        document.querySelectorAll('[data-ml-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const m = Store.getMaterialBestand().find(x => x.id === btn.dataset.mlEdit);
                if (!m) return;
                const body = `
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Bestand</label>
                            <input type="number" step="1" min="0" max="9999999" class="form-input" id="me_bestand" value="${m.bestand || 0}"></div>
                        <div class="form-group"><label class="form-label">Mindestbestand</label>
                            <input type="number" step="1" min="0" max="9999999" class="form-input" id="me_mindest" value="${m.mindestbestand || 0}"></div>
                        <div class="form-group"><label class="form-label">€/Einheit</label>
                            <input type="number" step="0.001" min="0" max="99999999" class="form-input" id="me_kosten" value="${m.kostenProEinheit || 0}"></div>
                    </div>`;
                App.showModal('✏️ ' + m.name + ' bearbeiten', body,
                    `<button class="btn btn-primary" data-action="ml-save-edit" data-args='["${m.id}"]' >Speichern</button>
                    <button class="btn btn-secondary" data-action="close-modal">Abbrechen</button>`
                );
            });
        });

        document.querySelectorAll('[data-ml-einkauf]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._tab = 'einkauf';
                this._refresh();
                setTimeout(() => {
                    const sel = document.getElementById('mle_material');
                    if (sel) sel.value = btn.dataset.mlEinkauf;
                }, 50);
            });
        });

        document.querySelectorAll('[data-ml-delete]').forEach(btn => {
            btn.addEventListener('click', () => {
                const m = Store.getMaterialBestand().find(x => x.id === btn.dataset.mlDelete);
                if (!m) return;
                if (!confirm(`"${m.name}" aus dem Lager löschen?`)) return;
                Store.deleteMaterialBestandItem(btn.dataset.mlDelete);
                Utils.showToast('Materialart gelöscht', 'success');
                this._refresh();
            });
        });
    },

    _bindEinkauf() {
        const mengeEl = document.getElementById('mle_menge');
        const gesamtEl = document.getElementById('mle_gesamt');
        const einzelnEl = document.getElementById('mle_einzeln_display');

        const calcEinzeln = () => {
            const menge = parseFloat(mengeEl?.value) || 0;
            const gesamt = parseFloat(gesamtEl?.value) || 0;
            if (einzelnEl) {
                einzelnEl.value = menge > 0
                    ? (gesamt / menge).toFixed(3).replace('.', ',') + ' €'
                    : '0,000 €';
            }
        };
        mengeEl?.addEventListener('input', calcEinzeln);
        gesamtEl?.addEventListener('input', calcEinzeln);

        document.getElementById('mlEinkaufForm')?.addEventListener('submit', e => {
            e.preventDefault();
            const matId = document.getElementById('mle_material').value;
            const menge = parseInt(document.getElementById('mle_menge').value) || 0;
            const gesamt = parseFloat(document.getElementById('mle_gesamt').value) || 0;
            if (!matId || menge <= 0) { Utils.showToast('Bitte Material und Menge angeben', 'warning'); return; }
            const mat = Store.getMaterialBestand().find(m => m.id === matId);
            if (!mat) return;
            const kostenProEinheit = menge > 0 ? Math.round(gesamt / menge * 1000) / 1000 : 0;

            // Gleitender Durchschnitt
            const altBestand = parseInt(mat.bestand) || 0;
            const altKosten = parseFloat(mat.kostenProEinheit) || 0;
            const neuerBestand = altBestand + menge;
            mat.kostenProEinheit = neuerBestand > 0
                ? Math.round(((altBestand * altKosten + menge * kostenProEinheit) / neuerBestand) * 1000) / 1000
                : kostenProEinheit;
            mat.bestand = neuerBestand;
            Store.saveMaterialBestandItem(mat);

            Store.saveMaterialEinkauf({
                datum: document.getElementById('mle_datum').value,
                materialId: matId, materialName: mat.name, einheit: mat.einheit || 'Stück',
                menge, gesamtkosten: gesamt, kostenProEinheit,
                lieferant: document.getElementById('mle_lieferant').value.trim()
            });

            // Log as consumption entry with negative menge (positive stock addition)
            Utils.showToast(`${menge} × ${Utils.escapeHtml(mat.name)} eingebucht (+${Utils.formatCurrency(gesamt)})`, 'success');
            this._refresh();
        });

        document.querySelectorAll('[data-ml-del-einkauf]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!confirm('Einkauf-Eintrag löschen? Der Bestand wird NICHT rückgängig gemacht.')) return;
                Store.deleteMaterialEinkauf(btn.dataset.mlDelEinkauf);
                Utils.showToast('Einkauf gelöscht', 'success');
                this._refresh();
            });
        });
    },

    _bindVerbrauch() {
        document.getElementById('mlVerbrauchForm')?.addEventListener('submit', e => {
            e.preventDefault();
            const matId = document.getElementById('mlv_material').value;
            const menge = parseInt(document.getElementById('mlv_menge').value) || 0;
            const grund = document.getElementById('mlv_grund').value.trim() || 'manuell';
            if (!matId || menge <= 0) { Utils.showToast('Bitte Material und Menge angeben', 'warning'); return; }
            const mat = Store.getMaterialBestand().find(m => m.id === matId);
            if (!mat) return;
            if (menge > (parseInt(mat.bestand) || 0)) {
                if (!confirm(`Bestand (${mat.bestand}) reicht nicht. Trotzdem buchen (Minusbestand)?`)) return;
            }
            Store.bookMaterialVerbrauch(
                [{ materialId: matId, menge }],
                document.getElementById('mlv_datum').value,
                grund, null, ''
            );
            Utils.showToast(`${menge} × ${Utils.escapeHtml(mat.name)} verbraucht`, 'success');
            this._refresh();
        });

        document.querySelectorAll('[data-ml-del-verbrauch]').forEach(btn => {
            btn.addEventListener('click', () => {
                const v = Store.getMaterialVerbrauch().find(x => x.id === btn.dataset.mlDelVerbrauch);
                if (!v) return;
                if (!confirm('Verbrauchsbuchung stornieren? Bestand wird wiederhergestellt.')) return;
                const mat = Store.getMaterialBestand().find(m => m.id === v.materialId);
                if (mat) {
                    mat.bestand = (parseInt(mat.bestand) || 0) + (parseInt(v.menge) || 0);
                    Store.saveMaterialBestandItem(mat);
                }
                v.storniert = true;
                Store.saveMaterialVerbrauchEintrag(v);
                Utils.showToast('Verbrauch storniert', 'success');
                this._refresh();
            });
        });
    },

    _refresh() {
        document.getElementById('content').innerHTML = this.render();
        this.init();
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'ml-save-edit': function (id) {
        const m = Store.getMaterialBestand().find(x => x.id === id);
        if (!m) return;
        m.bestand = parseInt(document.getElementById('me_bestand').value) || 0;
        m.mindestbestand = parseInt(document.getElementById('me_mindest').value) || 0;
        m.kostenProEinheit = parseFloat(document.getElementById('me_kosten').value) || 0;
        Store.saveMaterialBestandItem(m);
        App.closeModal();
        Materiallager._refresh();
        Utils.showToast(Utils.escapeHtml(m.name) + ' aktualisiert', 'success');
    }
});
