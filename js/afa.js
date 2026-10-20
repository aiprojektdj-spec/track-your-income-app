// ============================================
// AfA – Anlagenverzeichnis & Abschreibungen
// §7 EStG – Lineare & Degressive Abschreibung
// ============================================
const Afa = {
    _selectedYear: new Date().getFullYear(),

    // Abgang (Verkauf, Entnahme, Verschrottung) — bis zum Steuer-Audit 2026-10-18 (E-01) ließ sich
    // ein ausgeschiedenes Wirtschaftsgut nur "stornieren", was die AfA ALLER Jahre rückwirkend
    // löschte, auch in festgeschriebenen Jahren. Jetzt: AfA bis einschließlich Abgangsmonat
    // (§7 Abs.1 S.4 EStG, R 7.4 Abs.8 EStR), danach nichts mehr; der Restbuchwert ist im
    // Abgangsjahr Betriebsausgabe (§4 Abs.3 S.4 EStG). Der Verkaufserlös ist eine normale
    // Einnahme und wird als Verkauf gebucht.
    _abgang(asset) {
        const d = String((asset && asset.abgangsdatum) || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
        return { jahr: parseInt(d.slice(0, 4), 10), monat: parseInt(d.slice(5, 7), 10) - 1 };
    },

    // AfA für eine Anlage in einem bestimmten Jahr, unter Berücksichtigung eines Abgangs
    _calcJahresAfa(asset, year) {
        if (asset.storniert) return 0;
        const ab = this._abgang(asset);
        const voll = this._planJahresAfa(asset, year);
        if (!ab || year < ab.jahr) return voll;
        if (year > ab.jahr) return 0;
        if (asset.methode === 'sofort') return voll;   // GWG: voll im Anschaffungsjahr, kein Restwert
        const kauf = new Date(asset.anschaffungsdatum);
        const kaufJahr = kauf.getFullYear(), kaufMonat = kauf.getMonth();
        const nd = parseInt(asset.nutzungsdauer) || 1;
        // Monate, die der Plan diesem Jahr zuordnet, und davon die Monate bis einschließlich Abgang
        const start = year === kaufJahr ? kaufMonat : 0;
        const ende = (year === kaufJahr + nd && kaufMonat > 0) ? kaufMonat - 1 : 11;
        const planMonate = ende - start + 1;
        const bisAbgang = Math.min(ab.monat, ende) - start + 1;
        if (planMonate <= 0 || bisAbgang <= 0) return 0;
        return voll * Math.min(1, bisAbgang / planMonate);
    },

    // Restbuchwert, der im Abgangsjahr als Betriebsausgabe anfällt (0 in allen anderen Jahren)
    _restbuchwertAbgang(asset, year) {
        const ab = this._abgang(asset);
        if (!ab || ab.jahr !== year || asset.storniert) return 0;
        const ak = parseFloat(asset.anschaffungskosten) || 0;
        const kaufJahr = new Date(asset.anschaffungsdatum).getFullYear();
        let bw = ak;
        for (let y = kaufJahr; y <= year; y++) bw -= this._calcJahresAfa(asset, y);
        return bw > 0.005 ? Math.round(bw * 100) / 100 : 0;
    },

    // Plan-AfA ohne Abgang
    _planJahresAfa(asset, year) {
        const ak = parseFloat(asset.anschaffungskosten) || 0;
        const nd = parseInt(asset.nutzungsdauer) || 1;
        const kaufDatum = new Date(asset.anschaffungsdatum);
        const kaufJahr = kaufDatum.getFullYear();
        const kaufMonat = kaufDatum.getMonth(); // 0-indexed

        if (year < kaufJahr) return 0;

        // GWG-Sofortabschreibung (§6 Abs.2 EStG): AK≤800€ netto komplett im Anschaffungsjahr,
        // keine Monatsregel (anders als linear/degressiv — volle AK unabhängig vom Kaufmonat).
        if (asset.methode === 'sofort') return year === kaufJahr ? ak : 0;

        if (year > kaufJahr + nd) return 0; // vollständig abgeschrieben (inkl. anteiliges Abschlussjahr)

        if (asset.methode === 'degressiv' && this._degressivRegel(asset.anschaffungsdatum)) {
            return this._degressivPlan(asset)[year] || 0;
        } else {
            // Lineare AfA: gleichmäßig über Nutzungsdauer
            const jahresAfa = ak / nd;
            if (year === kaufJahr) {
                // Anteilig ab Kaufmonat: (12 - Monat) / 12
                return jahresAfa * ((12 - kaufMonat) / 12);
            }
            // Bei anteiligem Erstjahr (kaufMonat > 0) entsteht ein Restbetrag,
            // der im Jahr kaufJahr + nd abgeschrieben wird (§7 EStG Monatsregel).
            if (year > kaufJahr + nd) return 0;          // vollständig abgeschrieben
            if (year === kaufJahr + nd) {
                // Restbuchwert = AK − (Erstjahr-AfA + nd−1 Volljahre)
                const totalBisher = jahresAfa * ((12 - kaufMonat) / 12 + nd - 1);
                const rest = ak - totalBisher;
                return rest > 0.005 ? rest : 0;          // Float-Rounding ignorieren
            }
            return jahresAfa;
        }
    },

    // Degressive AfA ist nur für bewegliche Wirtschaftsgüter mit Anschaffung in gesetzlich
    // festgelegten Zeitfenstern zulässig (§7 Abs.2 EStG in der jeweiligen Fassung). Maßgeblich ist
    // der Anschaffungstag, nicht das Jahr: 2024 erst ab 01.04. (Wachstumschancengesetz),
    // 2025 erst ab 01.07. (Gesetz für ein steuerliches Investitionssofortprogramm).
    // Quelle: BMF-Übersicht der Abschreibungszeiträume, EStH 2025 Anhang 1 I.1.
    // Außerhalb aller Fenster → null: dann wird linear gerechnet und die Anlage markiert (T08).
    _DEGRESSIV_FENSTER: [
        { von: '2009-01-01', bis: '2010-12-31', faktor: 2.5, cap: 0.25 },
        { von: '2020-01-01', bis: '2022-12-31', faktor: 2.5, cap: 0.25 },
        { von: '2024-04-01', bis: '2024-12-31', faktor: 2.0, cap: 0.20 },
        { von: '2025-07-01', bis: '2027-12-31', faktor: 3.0, cap: 0.30 }
    ],
    _degressivRegel(datumISO) {
        const d = String(datumISO || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
        return this._DEGRESSIV_FENSTER.find(f => d >= f.von && d <= f.bis) || null;
    },
    // true, wenn eine Anlage als degressiv erfasst ist, das Anschaffungsdatum das aber nicht trägt.
    _degressivUnzulaessig(asset) {
        return !!asset && asset.methode === 'degressiv' && !this._degressivRegel(asset.anschaffungsdatum);
    },

    // Jahresplan der degressiven AfA mit Wechsel zur linearen Methode (§7 Abs.3 EStG).
    // Der Buchwert wird mit den TATSÄCHLICH angesetzten Jahresbeträgen fortgeschrieben, ein einmal
    // vollzogener Wechsel bleibt bestehen, linear = Restbuchwert / Restnutzungsdauer (monatsgenau),
    // und kein Jahresbetrag übersteigt den Restbuchwert → Summe aller Jahre = AK (T03).
    _degressivPlan(asset) {
        const ak = parseFloat(asset.anschaffungskosten) || 0;
        const nd = parseInt(asset.nutzungsdauer) || 1;
        const regel = this._degressivRegel(asset.anschaffungsdatum);
        const kaufDatum = new Date(asset.anschaffungsdatum);
        const kaufJahr = kaufDatum.getFullYear();
        const kaufMonat = kaufDatum.getMonth();
        const degRate = Math.min((1 / nd) * regel.faktor, regel.cap);
        const r2 = v => Math.round(v * 100) / 100;
        const plan = {};
        let bw = ak, restMonate = nd * 12, linear = false;
        for (let y = kaufJahr; restMonate > 0 && bw > 0; y++) {
            const monate = Math.min(y === kaufJahr ? 12 - kaufMonat : 12, restMonate);
            const deg = bw * degRate * monate / 12;
            const lin = bw * monate / restMonate;
            if (!linear && lin >= deg) linear = true;
            let afa = restMonate === monate ? bw : r2(linear ? lin : deg);
            if (afa > bw) afa = bw;
            plan[y] = afa;
            bw = r2(bw - afa);
            restMonate -= monate;
        }
        return plan;
    },

    // Buchwert zum 31.12. des Jahres (nach einem Abgang: 0, der Rest ist als Restbuchwert abgegangen)
    _buchwertEnde(asset, year) {
        const ab = this._abgang(asset);
        if (ab && year >= ab.jahr) return 0;
        const ak = parseFloat(asset.anschaffungskosten) || 0;
        let bw = ak;
        const kaufJahr = new Date(asset.anschaffungsdatum).getFullYear();
        for (let y = kaufJahr; y <= year; y++) {
            bw -= this._calcJahresAfa(asset, y);
        }
        return Math.max(0, bw);
    },

    // Summe aller AfA im Jahr
    _totalAfaFuerJahr(year) {
        return Store.getAfaAnlagen()
            .filter(a => !a.storniert)
            .reduce((sum, a) => sum + this._calcJahresAfa(a, year), 0);
    },

    render() {
        const year = this._selectedYear;
        const anlagen = Store.getAfaAnlagen();
        const aktive = anlagen.filter(a => !a.storniert);
        const totalAfa = this._totalAfaFuerJahr(year);

        const yearOptions = Array.from({ length: 10 }, (_, i) => 2020 + i)
            .map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');

        const rows = aktive.map(a => {
            const ak = parseFloat(a.anschaffungskosten) || 0;
            const nd = parseInt(a.nutzungsdauer) || 1;
            const kaufJahr = new Date(a.anschaffungsdatum).getFullYear();
            const afaJahr = this._calcJahresAfa(a, year);
            const bwEnde = this._buchwertEnde(a, year);
            const fertigJahr = kaufJahr + nd - 1;
            const abbPct = ak > 0 ? Math.min(100, ((ak - bwEnde) / ak * 100)).toFixed(0) : 0;

            const abg = this._abgang(a);
            return `<tr>
                <td>${Utils.escapeHtml(a.bezeichnung)}${abg ? `<div style="font-size:11px;color:var(--text-muted);">Abgang ${Utils.formatDate(a.abgangsdatum)}${this._restbuchwertAbgang(a, year) > 0 ? ' · Restbuchwert ' + Utils.formatCurrency(this._restbuchwertAbgang(a, year)) : ''}</div>` : ''}</td>
                <td>${Utils.formatDate(a.anschaffungsdatum)}</td>
                <td style="text-align:right">${Utils.formatCurrency(ak)}</td>
                <td style="text-align:center">${nd} J.</td>
                <td style="text-align:center">${a.methode === 'sofort' ? 'Sofort (GWG)' : this._degressivUnzulaessig(a) ? '<span title="Für dieses Anschaffungsdatum ist die degressive AfA gesetzlich nicht zulässig (§7 Abs.2 EStG). Gerechnet wird linear — bitte die Methode korrigieren." style="color:var(--warning)"><i class="ti ti-alert-triangle"></i> Linear*</span>' : a.methode === 'degressiv' ? 'Degr.' : 'Linear'}</td>
                <td style="text-align:right;color:var(--danger)">${afaJahr > 0 ? '−' + Utils.formatCurrency(afaJahr) : '–'}</td>
                <td style="text-align:right">
                    ${Utils.formatCurrency(bwEnde)}
                    <div style="height:4px;background:var(--border);border-radius:2px;margin-top:3px;">
                        <div style="height:4px;border-radius:2px;background:${bwEnde > 0 ? 'var(--accent)' : 'var(--success)'};width:${100 - abbPct}%"></div>
                    </div>
                </td>
                <td style="text-align:center;font-size:11px;color:var(--text-muted)">${fertigJahr}</td>
                <td>
                    ${!Store.canEdit(a)
                        ? `<span title="Jahr festgeschrieben — Ausscheiden über „Abgang“" style="font-size:11px;opacity:.7;"><i class="ti ti-lock"></i></span>
                           ${abg ? '' : `<button class="btn btn-sm" data-action="afa-abgang" data-args='["${a.id}"]' title="Abgang (Verkauf/Ausscheiden)" aria-label="Abgang für ${Utils.escapeHtml(a.bezeichnung || '')} erfassen"><i class="ti ti-package-export"></i></button>`}
                           <button class="btn btn-sm btn-danger" data-action="afa-storno" data-args='["${a.id}"]'  title="Stornieren" aria-label="Anlage ${Utils.escapeHtml(a.bezeichnung || '')} stornieren"><i class="ti ti-trash"></i></button>`
                        : `<button class="btn btn-sm" data-action="afa-edit" data-args='["${a.id}"]'  title="Bearbeiten" aria-label="Anlage ${Utils.escapeHtml(a.bezeichnung || '')} bearbeiten"><i class="ti ti-pencil"></i></button>
                           ${abg ? '' : `<button class="btn btn-sm" data-action="afa-abgang" data-args='["${a.id}"]' title="Abgang (Verkauf/Ausscheiden)" aria-label="Abgang für ${Utils.escapeHtml(a.bezeichnung || '')} erfassen"><i class="ti ti-package-export"></i></button>`}
                           <button class="btn btn-sm btn-danger" data-action="afa-storno" data-args='["${a.id}"]'  title="Stornieren" aria-label="Anlage ${Utils.escapeHtml(a.bezeichnung || '')} stornieren"><i class="ti ti-trash"></i></button>`}
                </td>
            </tr>`;
        }).join('');

        const emptyRow = aktive.length === 0
            ? `<tr><td colspan="9" class="table-empty">Noch keine Wirtschaftsgüter erfasst — Anschaffungen über 800 € netto werden hier über mehrere Jahre abgeschrieben.<br>
                   <button class="btn btn-small btn-primary" style="margin-top:10px;" data-action="afa-form"><i class="ti ti-plus"></i> Erste Anlage erfassen</button></td></tr>`
            : '';

        // Kumulierte AfA aller Jahre für Gesamtübersicht
        const kaufJahre = [...new Set(aktive.map(a => new Date(a.anschaffungsdatum).getFullYear()))].sort();
        const minJahr = kaufJahre.length > 0 ? Math.min(...kaufJahre) : year;

        return `
        <div class="page-header">
            <h2>AfA – Abschreibungen</h2>
            <div class="page-header-actions no-print">
                <select class="form-select" id="afaYear" style="width:100px;">${yearOptions}</select>
                <button class="btn" data-action="afa-export">CSV Export</button>
                <button class="btn btn-primary" data-action="afa-form"><i class="ti ti-plus"></i> Anlage erfassen</button>
            </div>
        </div>

        <div class="stats-grid" style="margin-bottom:20px;">
            <div class="card stat-card danger">
                <div class="card-label">AfA ${year} gesamt</div>
                <div class="card-value">${Utils.formatCurrency(totalAfa)}</div>
                <div class="card-subtitle">Betriebsausgaben durch Abschreibung</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Aktive Wirtschaftsgüter</div>
                <div class="card-value">${aktive.filter(a => this._calcJahresAfa(a, year) > 0).length}</div>
                <div class="card-subtitle">von ${aktive.length} erfassten Anlagen</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Anschaffungskosten gesamt</div>
                <div class="card-value">${Utils.formatCurrency(aktive.reduce((s, a) => s + (parseFloat(a.anschaffungskosten) || 0), 0))}</div>
                <div class="card-subtitle">Alle aktiven Anlagen</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Gesamter Buchwert ${year}</div>
                <div class="card-value">${Utils.formatCurrency(aktive.reduce((s, a) => s + this._buchwertEnde(a, year), 0))}</div>
                <div class="card-subtitle">Restbuchwert zum 31.12.${year}</div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <div class="card-title">Anlagenverzeichnis – ${year}</div>
                <div style="font-size:12px;color:var(--text-muted);">§7 EStG</div>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Bezeichnung</th>
                            <th>Kauf</th>
                            <th style="text-align:right">AK</th>
                            <th style="text-align:center">ND</th>
                            <th style="text-align:center">Methode</th>
                            <th style="text-align:right">AfA ${year}</th>
                            <th style="text-align:right">Buchwert 31.12.</th>
                            <th style="text-align:center">Fertig</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows || emptyRow}</tbody>
                    ${aktive.length > 0 ? `<tfoot>
                        <tr style="font-weight:600;background:var(--bg-secondary);">
                            <td colspan="5">Summe</td>
                            <td style="text-align:right;color:var(--danger)">−${Utils.formatCurrency(totalAfa)}</td>
                            <td style="text-align:right">${Utils.formatCurrency(aktive.reduce((s, a) => s + this._buchwertEnde(a, year), 0))}</td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>` : ''}
                </table>
            </div>
        </div>

        <div class="card" style="margin-top:16px;">
            <div class="card-header"><div class="card-title">Hinweise §7 EStG</div></div>
            <div style="padding:12px 16px;font-size:13px;color:var(--text-muted);line-height:1.7;">
                <strong>GWG-Grenze:</strong> Wirtschaftsgüter bis 800 € netto können sofort abgeschrieben werden (§6 Abs. 2 EStG).<br>
                <strong>Lineare AfA:</strong> Gleichmäßige Verteilung der AK über die Nutzungsdauer.<br>
                <strong>Degressive AfA:</strong> nur für Anschaffungen in den gesetzlichen Zeitfenstern (§7 Abs. 2 EStG): 2020–2022 und 01.04.–31.12.2024 (2- bzw. 2,5-facher Linearsatz, max. 20/25 %), 01.07.2025–31.12.2027 (3-fach, max. 30 %).<br>
                <strong>Anteilige AfA:</strong> Im Anschaffungsjahr nur für verbleibende volle Monate (Monatsregel).<br>
                <strong>Unverbindlich</strong> – Prüfung durch Steuerberater empfohlen.
            </div>
        </div>
        `;
    },

    init() {
        const yearSel = document.getElementById('afaYear');
        if (yearSel) yearSel.addEventListener('change', () => {
            this._selectedYear = parseInt(yearSel.value);
            this._refresh();
        });
    },

    _refresh() {
        const el = document.getElementById('content');
        if (el) { el.innerHTML = this.render(); this.init(); }
    },

    _openForm(id) {
        const existing = id ? (Store.getAfaAnlagen().find(a => a.id === id) || {}) : {};
        const isEdit = !!existing.id;
        const today = Utils.todayISO();

        App.showModal(isEdit ? 'Anlage bearbeiten' : '+ Neue Anlage erfassen', `
            <div class="form-group">
                <label class="form-label">Bezeichnung *</label>
                <input type="text" class="form-input" id="afa_bez" maxlength="300" value="${Utils.escapeHtml(existing.bezeichnung || '')}" placeholder="z.B. Laptop, Kamera, PKW ...">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Anschaffungsdatum *</label>
                    <input type="date" class="form-input" id="afa_datum" value="${existing.anschaffungsdatum || today}">
                </div>
                <div class="form-group">
                    <label class="form-label">Anschaffungskosten (€) *</label>
                    <input type="number" class="form-input" id="afa_ak" step="0.01" min="0" max="99999999" value="${existing.anschaffungskosten || ''}" placeholder="0,00">
                    <div class="form-hint">Mit Vorsteuerabzug netto, ohne (Kleinunternehmer) brutto (§9b EStG).</div>
                </div>
                <div class="form-group" id="afa_ustGroup">
                    <label class="form-label">Darin enthaltene USt (€)</label>
                    <input type="number" class="form-input" id="afa_ust" step="0.01" min="0" max="99999999" value="${existing.ustEnthalten || ''}" placeholder="0,00">
                    <div class="form-hint">Nur ohne Vorsteuerabzug: für die 800-€-GWG-Grenze zählt der Nettobetrag (§6 Abs. 2 EStG).</div>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Nutzungsdauer (Jahre) *</label>
                    <input type="number" class="form-input" id="afa_nd" min="1" max="50" value="${existing.nutzungsdauer || 3}" placeholder="3">
                    <div class="form-hint">Richtwerte: PC/Laptop/Software 1 J. (BMF 22.02.2022) · PKW 6 J. · Möbel 13 J.</div>
                </div>
                <div class="form-group">
                    <label class="form-label">Abschreibungsmethode</label>
                    <select class="form-select" id="afa_methode">
                        <option value="linear" ${(existing.methode || 'linear') === 'linear' ? 'selected' : ''}>Linear (gleichmäßig)</option>
                        <option value="degressiv" ${existing.methode === 'degressiv' ? 'selected' : ''}>Degressiv (fallend)</option>
                        <option value="sofort" ${existing.methode === 'sofort' ? 'selected' : ''}>Sofort (GWG, nur AK≤800€ netto)</option>
                    </select>
                    <div class="form-hint" id="afa_sofortHint" style="display:none;color:var(--success);">GWG-Sofortabschreibung: volle AK im Anschaffungsjahr, keine Verteilung über Jahre (§6 Abs.2 EStG).</div>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Anlagenart</label>
                <select class="form-select" id="afa_art">
                    ${[['bga', 'Sonstige Betriebs- und Geschäftsausstattung'], ['buero', 'Büroeinrichtung'], ['pkw', 'Pkw'], ['software', 'EDV-Software']]
                        .map(([v, t]) => `<option value="${v}" ${(existing.anlagenart || 'bga') === v ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
                <div class="form-hint">Bestimmt das Anlagekonto im DATEV-Export. GWG (Methode „Sofort") bucht unabhängig davon auf das GWG-Konto.</div>
            </div>
            <div class="form-group">
                <label class="form-label">Kategorie / Notiz</label>
                <input type="text" class="form-input" id="afa_notiz" maxlength="1000" value="${Utils.escapeHtml(existing.notiz || '')}" placeholder="z.B. Büroausstattung, Fahrzeug, IT-Equipment ...">
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                <button class="btn" data-action="close-modal">Abbrechen</button>
                <button class="btn btn-primary" data-action="afa-save" data-args='["${existing.id || ''}"]' >Speichern</button>
            </div>
        `);

        const methodeSel = document.getElementById('afa_methode');
        const ndInput = document.getElementById('afa_nd');
        const akInput = document.getElementById('afa_ak');
        const sofortHint = document.getElementById('afa_sofortHint');
        const updateSofortState = () => {
            const isSofort = methodeSel.value === 'sofort';
            sofortHint.style.display = isSofort ? '' : 'none';
            ndInput.disabled = isSofort;
            if (isSofort) ndInput.value = 1;
        };
        methodeSel.addEventListener('change', updateSofortState);
        // Vorschlag: bei AK≤800€ auf Sofort umschalten, solange der Nutzer die Methode nicht manuell geändert hat
        let methodeManuellGesetzt = isEdit;
        methodeSel.addEventListener('change', () => { methodeManuellGesetzt = true; });
        const ustInput = document.getElementById('afa_ust');
        const akNettoForm = () => (parseFloat(akInput.value) || 0) - (parseFloat(ustInput && ustInput.value) || 0);
        if (ustInput) ustInput.addEventListener('input', () => akInput.dispatchEvent(new Event('input')));
        akInput.addEventListener('input', () => {
            if (methodeManuellGesetzt) return;
            const ak = akNettoForm();
            methodeSel.value = (ak > 0 && ak <= 800) ? 'sofort' : 'linear';
            updateSofortState();
        });
        updateSofortState();
    },

    _editAnlage(id) { this._openForm(id); },

    // Netto-AK für die GWG-Grenze (E-02)
    _gwgNetto(ak, ustEnthalten) {
        return (parseFloat(ak) || 0) - Math.max(0, parseFloat(ustEnthalten) || 0);
    },

    _saveForm(existingId) {
        const bez = document.getElementById('afa_bez')?.value?.trim();
        const datum = document.getElementById('afa_datum')?.value;
        const ak = parseFloat(document.getElementById('afa_ak')?.value) || 0;
        let nd = parseInt(document.getElementById('afa_nd')?.value) || 0;
        const methode = document.getElementById('afa_methode')?.value || 'linear';
        const notiz = document.getElementById('afa_notiz')?.value?.trim();
        // Kleinunternehmer erfassen die AK brutto (§9b EStG), die GWG-Grenze misst aber netto
        // (§6 Abs.2 S.1 EStG: "vermindert um einen darin enthaltenen Vorsteuerbetrag") —
        // Steuer-Audit 2026-10-18, E-02: 940 € brutto / 789,92 € netto wurden abgelehnt.
        const ustEnthalten = Math.max(0, parseFloat(document.getElementById('afa_ust')?.value) || 0);

        if (!bez) { Utils.showToast('Bezeichnung fehlt', 'error'); return; }
        if (!datum) { Utils.showToast('Datum fehlt', 'error'); return; }
        if (!Number.isFinite(ak) || ak <= 0 || ak > 99999999) { Utils.showToast('Anschaffungskosten ungültig', 'error'); return; }
        // §6 Abs.2 EStG: Sofortabschreibung nur für GWG bis 800€ netto — sonst Bußgeldrisiko bei Betriebsprüfung
        if (ustEnthalten >= ak && ustEnthalten > 0) { Utils.showToast('Die enthaltene USt muss kleiner als die Anschaffungskosten sein', 'error'); return; }
        if (methode === 'sofort' && this._gwgNetto(ak, ustEnthalten) > 800) { Utils.showToast('Sofortabschreibung (GWG) nur bis 800€ netto AK zulässig (§6 Abs.2 EStG)', 'error'); return; }
        if (methode === 'sofort') nd = 1; // Nutzungsdauer irrelevant bei Sofortabschreibung
        // §7 Abs.2 EStG: degressiv nur bei Anschaffung in einem begünstigten Zeitfenster (T08)
        if (methode === 'degressiv' && !this._degressivRegel(datum)) {
            Utils.showToast('Degressive AfA ist für dieses Anschaffungsdatum nicht zulässig (§7 Abs.2 EStG: z. B. 01.04.–31.12.2024, 01.07.2025–31.12.2027). Bitte linear wählen.', 'error');
            return;
        }
        if (!Number.isFinite(nd) || nd < 1) { Utils.showToast('Nutzungsdauer muss ≥ 1 sein', 'error'); return; }

        const item = {
            id: existingId || undefined,
            bezeichnung: bez,
            anschaffungsdatum: datum,
            anschaffungskosten: ak,
            nutzungsdauer: nd,
            methode,
            // DATEV-Anlagekonto (js/datev.js, ANLAGEN). Fehlt es — Anlagen vor 2026-10-08 —, gilt 'bga'.
            anlagenart: document.getElementById('afa_art')?.value || 'bga',
            ustEnthalten: ustEnthalten || undefined,
            notiz: notiz || ''
        };

        Store.saveAfaAnlage(item);
        App.closeModal();
        Utils.showToast(existingId ? 'Anlage aktualisiert' : 'Anlage erfasst', 'success');
        this._refresh();
    },

    _abgangAnlage(id) {
        const anlage = Store.getAfaAnlagen().find(a => a.id === id);
        if (!anlage) return;
        const datum = prompt(`Abgang von "${anlage.bezeichnung}" (Verkauf, Entnahme, Verschrottung)\nDatum (JJJJ-MM-TT):`, new Date().toLocaleDateString('sv-SE'));
        if (datum === null) return;
        const r = Store.abgangAfaAnlage(id, datum.trim());
        if (!r.ok) { Utils.showToast(r.fehler, 'error'); return; }
        Utils.showToast('Abgang erfasst — AfA bis ' + Utils.formatDate(datum.trim()) + ', Restbuchwert wird im Abgangsjahr als Betriebsausgabe angesetzt. Einen Verkaufserlös bitte als Verkauf buchen.', 'success', 8000);
        this._refresh();
    },

    _stornoAnlage(id) {
        const anlage = Store.getAfaAnlagen().find(a => a.id === id);
        if (!anlage) return;
        // Storno löscht die AfA aller Jahre — im festgeschriebenen Anschaffungsjahr nicht zulässig (E-01)
        if (Store.isPeriodLocked(anlage.anschaffungsdatum)) {
            Utils.showToast('Das Anschaffungsjahr ist festgeschrieben. Ein verkauftes oder ausgeschiedenes Wirtschaftsgut bitte über „Abgang“ erfassen.', 'warning', 8000);
            return;
        }
        const grund = prompt(`Anlage "${anlage.bezeichnung}" stornieren?\nGrund (optional):`);
        if (grund === null) return; // abgebrochen
        Store.stornoAfaAnlage(id, grund || 'Storniert');
        Utils.showToast('Anlage storniert', 'success');
        this._refresh();
    },

    _exportCSV() {
        const year = this._selectedYear;
        const anlagen = Store.getAfaAnlagen().filter(a => !a.storniert);
        const rows = [
            ['AfA-Export', year, '', '', '', '', ''],
            ['Bezeichnung', 'Kauf', 'Ansch.kosten €', 'ND (J)', 'Methode', `AfA ${year} €`, `Buchwert ${year} €`],
            ...anlagen.map(a => [
                a.bezeichnung,
                a.anschaffungsdatum,
                (parseFloat(a.anschaffungskosten) || 0).toFixed(2),
                a.nutzungsdauer,
                a.methode,
                this._calcJahresAfa(a, year).toFixed(2),
                this._buchwertEnde(a, year).toFixed(2)
            ]),
            ['', '', '', '', 'Summe AfA:', this._totalAfaFuerJahr(year).toFixed(2), '']
        ];
        Utils.downloadCSV(rows, `afa_${year}.csv`);
        Utils.showToast('CSV exportiert', 'success');
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (typeof window !== 'undefined' && window.Actions) Actions.register({
    'afa-storno': function (id) { Afa._stornoAnlage(id); },
    'afa-abgang': function (id) { Afa._abgangAnlage(id); },
    'afa-edit':   function (id) { Afa._editAnlage(id); },
    'afa-export': function () { Afa._exportCSV(); },
    'afa-form':   function () { Afa._openForm(); },
    'afa-save':   function (id) { Afa._saveForm(id); }
});
// Node-Export für Regressionstests (siehe test-afa-degressiv-linear.js) — im Browser wirkungslos.
if (typeof module !== 'undefined' && module.exports) module.exports = Afa;
