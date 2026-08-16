// ============================================
// Lohnsteuer-Basics — Brutto→Netto Rechner
// AG-Anteile Sozialversicherung, Lohnnebenkosten
// Für GmbH-GF, Angestellte bei jeder Rechtsform
// ============================================
const Lohnsteuer = {

    _year: new Date().getFullYear(),

    // SV-Beitragssätze 2026 (AG-Anteil)
    // Quelle: Sozialversicherungsrechengrößen-Verordnung 2026 (BMAS/BGBl., verkündet 26.11.2025,
    // in Kraft seit 01.01.2026) — https://www.bmas.de/DE/Service/Gesetze-und-Gesetzesvorhaben/sozialversicherungs-rechengroessenverordnung-2026.html
    // Recherchiert am 2026-07-30. KV/RV/AV/PV-Beitragssätze sind ggü. 2025 unverändert,
    // nur die Bemessungsgrenzen (BBG) steigen.
    SV: {
        kv:      0.0875,   // Krankenversicherung: 7,3% allgemeiner Satz + hälftiger Ø-Zusatzbeitrag (2,9% / 2 = 1,45%) → AG zahlt 8,75%
        rv:      0.093,    // Rentenversicherung 18,6% paritätisch → AG-Anteil 9,3%
        av:      0.013,    // Arbeitslosenversicherung 2,6% paritätisch → AG-Anteil 1,3%
        pv:      0.018,    // Pflegeversicherung 3,6% Basissatz paritätisch → AG-Anteil 1,8% (§55 Abs. 1 SGB XI).
                            // Kinderlosenzuschlag §55 Abs. 3 SGB XI (0,6%) wird ausschließlich vom AN getragen,
                            // hier NICHT modelliert (kein Kinderstatus je Mitarbeiter erfasst) — bekannte Näherung.
    },

    // BBG 2026 (bundeseinheitlich, jährlich)
    BBG: {
        kv: 69750,   // Beitragsbemessungsgrenze KV/PV (bundeseinheitlich, 5.812,50 €/Monat)
        rv: 101400,  // Beitragsbemessungsgrenze RV/AV (bundeseinheitlich seit 2025, 8.450 €/Monat)
    },

    // Solidaritätszuschlag-Freigrenze 2026 nach § 3 SolzG (tarifliche Jahres-Lohn-/Einkommensteuer)
    // Quelle: siehe SV-Quelle oben, recherchiert 2026-07-30.
    SOLI_FREIGRENZE_SINGLE:  20350,  // Steuerklasse I/II/IV/V/VI im Lohnsteuerabzugsverfahren
    SOLI_FREIGRENZE_SPLIT:   40700,  // Steuerklasse III (unterstellte Zusammenveranlagung beim Lohnsteuerabzug)
    SOLI_MILDERUNGSSATZ:     0.119, // Milderungszone: Soli max. 11,9% des Betrags über der Freigrenze

    _getEmployees()   { return Store.get('lohnsteuer_employees') || []; },
    _saveEmployees(d) { Store.set('lohnsteuer_employees', d); },

    // ── Brutto → Netto (vereinfacht) ──
    _calcMonat(brutto, steuerklasse) {
        brutto = parseFloat(brutto) || 0;
        steuerklasse = parseInt(steuerklasse) || 1;

        // Vereinfachte Lohnsteuer-Schätzung (Durchschnittssteuersatz)
        // Exakte Berechnung erfordert BMF-Algorithmus — hier Näherung
        const jahresBrutto = brutto * 12;
        let lstSatz = 0;
        if (jahresBrutto <= 11604)      lstSatz = 0;        // Grundfreibetrag 2025
        else if (jahresBrutto <= 17005) lstSatz = 0.14;
        else if (jahresBrutto <= 66760) lstSatz = 0.24;
        else if (jahresBrutto <= 277825) lstSatz = 0.35;
        else                            lstSatz = 0.42;

        // Steuerklasse-Anpassung (sehr vereinfacht)
        if (steuerklasse === 3) lstSatz *= 0.7;
        if (steuerklasse === 5) lstSatz *= 1.3;
        if (steuerklasse === 6) lstSatz *= 1.1;

        const lohnsteuer = brutto * lstSatz;

        // Soli nur, wenn die JAHRES-Lohnsteuer die Freigrenze nach § 3 SolzG übersteigt.
        // Im Lohnsteuerabzugsverfahren gilt die VERDOPPELTE Freigrenze nur für Steuerklasse III
        // (dort wird die gemeinsame Veranlagung unterstellt); StKl I/II/IV/V/VI nutzen die einfache
        // Freigrenze — StKl IV ist zwar auch "verheiratet", aber ohne Splitting-Vorteil beim
        // Lohnsteuerabzug, und StKl V/VI werden ohnehin mit dem hohen Grenzsteuersatz belastet.
        const jahresLohnsteuer = lohnsteuer * 12;
        const soliFreigrenze = (steuerklasse === 3)
            ? this.SOLI_FREIGRENZE_SPLIT
            : this.SOLI_FREIGRENZE_SINGLE;
        let solzJahres = 0;
        if (jahresLohnsteuer > soliFreigrenze) {
            // Milderungszone: Soli max. 11,9% des Betrags über der Freigrenze, sonst 5,5% der ESt.
            const milderungsSoli = (jahresLohnsteuer - soliFreigrenze) * this.SOLI_MILDERUNGSSATZ;
            const vollerSoli = jahresLohnsteuer * 0.055;
            solzJahres = Math.min(milderungsSoli, vollerSoli);
        }
        const solz = solzJahres / 12;
        const kirchensteuer = 0; // optional, default aus

        // SV-Beiträge AN (gleich wie AG)
        const kvBrutto = Math.min(brutto * 12, this.BBG.kv) / 12;
        const rvBrutto = Math.min(brutto * 12, this.BBG.rv) / 12;

        const svAN = {
            kv: kvBrutto * this.SV.kv,
            rv: rvBrutto * this.SV.rv,
            av: rvBrutto * this.SV.av,
            pv: kvBrutto * this.SV.pv,
        };
        const svANGesamt = svAN.kv + svAN.rv + svAN.av + svAN.pv;

        // AG-Anteile (gleich)
        const svAG = {
            kv: kvBrutto * this.SV.kv,
            rv: rvBrutto * this.SV.rv,
            av: rvBrutto * this.SV.av,
            pv: kvBrutto * this.SV.pv,
        };
        const svAGGesamt = svAG.kv + svAG.rv + svAG.av + svAG.pv;

        // U1/U2/U3 Umlagen (Näherung)
        const umlagen = brutto * 0.024; // ~2,4% gesamt

        const netto = brutto - lohnsteuer - solz - kirchensteuer - svANGesamt;
        const agKostenGesamt = brutto + svAGGesamt + umlagen;

        return {
            brutto, netto, lohnsteuer, solz, kirchensteuer,
            svAN, svANGesamt, svAG, svAGGesamt, umlagen,
            agKostenGesamt, lstSatz
        };
    },

    render() {
        const employees = this._getEmployees();
        const year = this._year;

        // Gesamtkosten
        let totalBrutto = 0, totalAGKosten = 0, totalNetto = 0;
        employees.forEach(e => {
            if (!e.aktiv) return;
            const c = this._calcMonat(e.brutto, e.steuerklasse);
            totalBrutto += c.brutto;
            totalAGKosten += c.agKostenGesamt;
            totalNetto += c.netto;
        });
        const aktiveCount = employees.filter(e => e.aktiv).length;

        return `
        <div class="page-header">
            <h2><i class="ti ti-users" style="margin-right:6px;"></i> Lohnsteuer & Personalkosten</h2>
            <div class="page-header-actions no-print">
                <button class="btn btn-primary" id="addEmployeeBtn">+ Mitarbeiter</button>
            </div>
        </div>

        <div class="card no-print" style="margin-bottom:16px;padding:14px 16px;border:1px solid var(--warning);background:rgba(245,158,11,.08);">
            <div style="display:flex;gap:10px;align-items:flex-start;">
                <i class="ti ti-alert-triangle" style="color:var(--warning);font-size:20px;flex-shrink:0;margin-top:1px;"></i>
                <div style="font-size:12.5px;line-height:1.6;">
                    <strong style="color:var(--warning);">Grobe Näherung — KEINE echte Lohnsteuerberechnung.</strong>
                    Dieser Rechner nutzt einen vereinfachten 4-Stufen-Pauschaltarif statt der amtlichen Tarifformel
                    nach § 32a EStG und ohne Vorsorgepauschale (§ 39b Abs. 2 Nr. 3 EStG). Ergebnisse dienen nur der
                    groben Orientierung und dürfen <u>nicht</u> für die offizielle Lohnabrechnung, Lohnsteuer-Anmeldung
                    oder ELSTER-Meldung verwendet werden. Nutze für echte Lohnabrechnungen zertifizierte Lohnsoftware
                    (z. B. DATEV) oder einen Steuerberater/Lohnbüro.
                </div>
            </div>
        </div>

        <!-- KPI -->
        <div class="stats-grid" style="margin-bottom:16px;">
            <div class="card stat-card">
                <div class="card-label">Mitarbeiter aktiv</div>
                <div class="card-value">${aktiveCount}</div>
                <div class="card-subtitle">von ${employees.length} gesamt</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Bruttolöhne / Monat</div>
                <div class="card-value">${Utils.formatCurrency(totalBrutto)}</div>
                <div class="card-subtitle">${Utils.formatCurrency(totalBrutto * 12)} / Jahr</div>
            </div>
            <div class="card stat-card danger">
                <div class="card-label">AG-Gesamtkosten / Monat</div>
                <div class="card-value">${Utils.formatCurrency(totalAGKosten)}</div>
                <div class="card-subtitle">Brutto + SV-AG + Umlagen</div>
            </div>
            <div class="card stat-card success">
                <div class="card-label">Nettolöhne / Monat</div>
                <div class="card-value">${Utils.formatCurrency(totalNetto)}</div>
                <div class="card-subtitle">Auszahlung an AN</div>
            </div>
        </div>

        <!-- Brutto-Netto-Rechner -->
        <div class="card" style="margin-bottom:16px;padding:20px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:14px;">Brutto-Netto-Rechner</div>
            <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;">
                <div class="form-group" style="flex:1;min-width:150px;">
                    <label class="form-label">Brutto-Monatsgehalt (€)</label>
                    <input type="number" step="1" min="0" max="9999999" class="form-input" id="calcBrutto" value="3000" placeholder="3000">
                </div>
                <div class="form-group" style="width:120px;">
                    <label class="form-label">Steuerklasse</label>
                    <select class="form-select" id="calcStKl">
                        <option value="1" selected>Klasse 1</option>
                        <option value="2">Klasse 2</option>
                        <option value="3">Klasse 3</option>
                        <option value="4">Klasse 4</option>
                        <option value="5">Klasse 5</option>
                        <option value="6">Klasse 6</option>
                    </select>
                </div>
                <button class="btn btn-primary" id="calcBtn" style="height:38px;">Berechnen</button>
            </div>
            <div id="calcResult" style="margin-top:16px;"></div>
        </div>

        <!-- Mitarbeiterliste -->
        <div class="card" style="padding:0;overflow:hidden;">
            <div style="padding:14px 16px;border-bottom:1px solid var(--border);">
                <div style="font-weight:700;">Mitarbeiter-Übersicht</div>
            </div>
            ${employees.length === 0
                ? `<div style="padding:40px;text-align:center;color:var(--text-muted);">Noch keine Mitarbeiter erfasst — den ersten legst du oben rechts über <strong>„+ Mitarbeiter"</strong> an.</div>`
                : `<div class="table-container" style="border:none;">
                    <table class="data-table">
                        <thead><tr>
                            <th>Name</th><th>Position</th><th>StKl</th>
                            <th style="text-align:right">Brutto</th>
                            <th style="text-align:right">SV-AG</th>
                            <th style="text-align:right">AG-Kosten</th>
                            <th style="text-align:right">Netto</th>
                            <th>Status</th><th style="width:60px;"></th>
                        </tr></thead>
                        <tbody>
                            ${employees.map(e => {
                                const c = this._calcMonat(e.brutto, e.steuerklasse);
                                return `<tr style="${e.aktiv ? '' : 'opacity:.5;'}">
                                    <td style="font-weight:600;">${Utils.escapeHtml(e.name)}</td>
                                    <td style="font-size:11px;color:var(--text-muted);">${Utils.escapeHtml(e.position || '—')}</td>
                                    <td>${e.steuerklasse}</td>
                                    <td style="text-align:right">${Utils.formatCurrency(c.brutto)}</td>
                                    <td style="text-align:right;color:var(--danger)">${Utils.formatCurrency(c.svAGGesamt)}</td>
                                    <td style="text-align:right;font-weight:600;">${Utils.formatCurrency(c.agKostenGesamt)}</td>
                                    <td style="text-align:right;color:var(--success)">${Utils.formatCurrency(c.netto)}</td>
                                    <td><span class="badge ${e.aktiv ? 'badge-success' : ''}">${e.aktiv ? 'Aktiv' : 'Inaktiv'}</span></td>
                                    <td style="display:flex;gap:4px;">
                                        <button style="background:none;border:none;cursor:pointer;color:var(--text-muted);" data-action="lst-toggle" data-args='["${e.id}"]' >${e.aktiv ? '⏸' : '▶'}</button>
                                        <button style="background:none;border:none;cursor:pointer;color:var(--text-muted);" data-action="lst-del" data-args='["${e.id}"]' >🗑</button>
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>`}
        </div>

        <!-- SV-Sätze Übersicht -->
        <div class="card" style="margin-top:16px;padding:16px;">
            <div style="font-weight:700;font-size:13px;margin-bottom:10px;">Sozialversicherung ${year} — AG-Anteile</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">
                ${[
                    ['KV', (this.SV.kv * 100).toFixed(2) + '%', 'Krankenversicherung'],
                    ['RV', (this.SV.rv * 100).toFixed(1) + '%', 'Rentenversicherung'],
                    ['AV', (this.SV.av * 100).toFixed(1) + '%', 'Arbeitslosenvers.'],
                    ['PV', (this.SV.pv * 100).toFixed(3) + '%', 'Pflegeversicherung'],
                ].map(([k, v, l]) => `
                    <div style="background:var(--bg-secondary);border-radius:8px;padding:10px 12px;">
                        <div style="font-size:11px;color:var(--text-muted);">${l}</div>
                        <div style="font-weight:700;font-size:15px;">${v}</div>
                        <div style="font-size:10px;color:var(--text-muted);">AG-Anteil</div>
                    </div>`).join('')}
            </div>
            <div style="margin-top:10px;font-size:11px;color:var(--text-muted);">
                BBG KV/PV: ${Utils.formatCurrency(this.BBG.kv)}/Jahr · BBG RV/AV: ${Utils.formatCurrency(this.BBG.rv)}/Jahr (bundeseinheitlich)<br>
                ⚠️ <strong>Vereinfachte Näherung, keine amtliche Lohnsteuerberechnung</strong> — exakte Werte über DATEV/Lohnsoftware oder Steuerberater. Keine Lohnsteuerberatung.
            </div>
        </div>`;
    },

    _renderCalcResult(brutto, steuerklasse) {
        const c = this._calcMonat(brutto, steuerklasse);

        return `
        <div style="background:var(--bg-secondary);border-radius:10px;padding:16px;border:1px solid var(--border);">
            <div style="display:grid;grid-template-columns:1fr auto;gap:4px 20px;font-size:13px;max-width:400px;">
                <span style="font-weight:700;">Bruttogehalt</span>
                <span style="text-align:right;font-weight:700;">${Utils.formatCurrency(c.brutto)}</span>

                <span style="color:var(--text-muted);">− Lohnsteuer (~${(c.lstSatz * 100).toFixed(0)}%)</span>
                <span style="text-align:right;color:var(--danger)">− ${Utils.formatCurrency(c.lohnsteuer)}</span>
                <span style="color:var(--text-muted);">− Solidaritätszuschlag</span>
                <span style="text-align:right;color:var(--danger)">− ${Utils.formatCurrency(c.solz)}</span>

                <span style="color:var(--text-muted);">− KV AN (${(this.SV.kv * 100).toFixed(2)}%)</span>
                <span style="text-align:right;color:var(--danger)">− ${Utils.formatCurrency(c.svAN.kv)}</span>
                <span style="color:var(--text-muted);">− RV AN (${(this.SV.rv * 100).toFixed(1)}%)</span>
                <span style="text-align:right;color:var(--danger)">− ${Utils.formatCurrency(c.svAN.rv)}</span>
                <span style="color:var(--text-muted);">− AV AN (${(this.SV.av * 100).toFixed(1)}%)</span>
                <span style="text-align:right;color:var(--danger)">− ${Utils.formatCurrency(c.svAN.av)}</span>
                <span style="color:var(--text-muted);">− PV AN (${(this.SV.pv * 100).toFixed(3)}%)</span>
                <span style="text-align:right;color:var(--danger)">− ${Utils.formatCurrency(c.svAN.pv)}</span>

                <div style="grid-column:1/-1;border-top:2px solid var(--border);margin:4px 0;"></div>
                <span style="font-weight:800;font-size:15px;">= Netto</span>
                <span style="text-align:right;font-weight:800;font-size:15px;color:var(--success);">${Utils.formatCurrency(c.netto)}</span>

                <div style="grid-column:1/-1;border-top:1px solid var(--border);margin:6px 0;"></div>
                <span style="font-weight:700;color:var(--text-muted);">AG-Gesamtkosten</span>
                <span style="text-align:right;font-weight:700;color:var(--danger);">${Utils.formatCurrency(c.agKostenGesamt)}</span>
                <span style="font-size:11px;color:var(--text-muted);">davon SV-AG</span>
                <span style="text-align:right;font-size:11px;">${Utils.formatCurrency(c.svAGGesamt)}</span>
                <span style="font-size:11px;color:var(--text-muted);">davon Umlagen (U1/U2/U3)</span>
                <span style="text-align:right;font-size:11px;">${Utils.formatCurrency(c.umlagen)}</span>
            </div>
        </div>`;
    },

    // ── Modals ──
    _openAddModal() {
        App.showModal('Mitarbeiter erfassen', `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Name *</label>
                        <input type="text" class="form-input" id="emp_name" maxlength="300" placeholder="Max Mustermann">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Position</label>
                        <input type="text" class="form-input" id="emp_pos" maxlength="300" placeholder="z.B. Lagerist, GF">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Brutto-Monatsgehalt (€) *</label>
                        <input type="number" step="1" min="0" max="9999999" class="form-input" id="emp_brutto" placeholder="3000">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Steuerklasse</label>
                        <select class="form-select" id="emp_stkl">
                            ${[1,2,3,4,5,6].map(k => `<option value="${k}" ${k===1?'selected':''}>Klasse ${k}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Eintrittsdatum</label>
                    <input type="date" class="form-input" id="emp_eintritt" value="${new Date().toLocaleDateString('sv-SE')}">
                </div>
            </div>`,
        `<button class="btn" data-action="close-modal">Abbrechen</button>
         <button class="btn btn-primary" id="saveEmpBtn">Speichern</button>`);

        document.getElementById('saveEmpBtn').addEventListener('click', () => {
            const name = document.getElementById('emp_name').value.trim();
            const brutto = parseFloat(document.getElementById('emp_brutto').value);
            // Number.isFinite statt isNaN: isNaN(Infinity) ist false, ein Infinity-Brutto wäre
            // durchgelaufen und hätte jede Folgeberechnung auf NaN gezogen.
            if (!name || !Number.isFinite(brutto) || brutto <= 0) { Utils.showToast('Name + Brutto erforderlich', 'warning'); return; }

            const emps = this._getEmployees();
            emps.push({
                id: Store.generateId(),
                name,
                position: document.getElementById('emp_pos').value.trim(),
                brutto,
                steuerklasse: parseInt(document.getElementById('emp_stkl').value) || 1,
                eintritt: document.getElementById('emp_eintritt').value || '',
                aktiv: true,
                createdAt: new Date().toISOString()
            });
            this._saveEmployees(emps);
            App.closeModal();
            Utils.showToast('Mitarbeiter gespeichert', 'success');
            this._refresh();
        });
    },

    _toggleEmployee(id) {
        const emps = this._getEmployees();
        const emp = emps.find(e => e.id === id);
        if (emp) emp.aktiv = !emp.aktiv;
        this._saveEmployees(emps);
        this._refresh();
    },

    _deleteEmployee(id) {
        if (!confirm('Mitarbeiter löschen?')) return;
        this._saveEmployees(this._getEmployees().filter(e => e.id !== id));
        Utils.showToast('Gelöscht', 'success');
        this._refresh();
    },

    _refresh() {
        const el = document.getElementById('content');
        if (!el) return;
        el.innerHTML = this.render();
        this.init();
    },

    init() {
        const addBtn = document.getElementById('addEmployeeBtn');
        if (addBtn) addBtn.addEventListener('click', () => this._openAddModal());

        const calcBtn = document.getElementById('calcBtn');
        if (calcBtn) calcBtn.addEventListener('click', () => {
            const brutto = parseFloat(document.getElementById('calcBrutto').value) || 0;
            const stkl = parseInt(document.getElementById('calcStKl').value) || 1;
            const result = document.getElementById('calcResult');
            if (result) result.innerHTML = this._renderCalcResult(brutto, stkl);
        });
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'lst-toggle': function (id) { Lohnsteuer._toggleEmployee(id); },
    'lst-del':    function (id) { Lohnsteuer._deleteEmployee(id); }
});
