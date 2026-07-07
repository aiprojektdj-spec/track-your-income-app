// ============================================
// KSK – Künstlersozialkasse
// §25 KSVG – Beitragsberechnung für Künstler
// ============================================
const Ksk = {
    _selectedYear: new Date().getFullYear(),

    // Aktuelle Beitragssätze (werden jährlich festgesetzt)
    _beitragssaetze: {
        2024: { kv: 0.073, pv: 0.0170, rv: 0.093 }, // KSK-Mitglied zahlt AN-Anteil RV 9,3% (§163 SGB VI)
        2025: { kv: 0.075, pv: 0.0180, rv: 0.093 },
        2026: { kv: 0.075, pv: 0.0180, rv: 0.093 }
    },

    _getSaetze(year) {
        return this._beitragssaetze[year]
            || this._beitragssaetze[Math.max(...Object.keys(this._beitragssaetze).map(Number))];
    },

    // BBG (Beitragsbemessungsgrenzen) nach Jahr — jährlich anpassen
    _BBG: {
        2024: { kvpv: 5175.00, rv: 7550.00 },
        2025: { kvpv: 5512.50, rv: 8050.00 },
        2026: { kvpv: 5512.50, rv: 8050.00 }  // vorläufig bis Bekanntgabe
    },

    _getBBG(year) {
        return this._BBG[year]
            || this._BBG[Math.max(...Object.keys(this._BBG).map(Number))];
    },

    _calcBeitrag(jahreseinkommen, year) {
        const s   = this._getSaetze(year);
        const bbg = this._getBBG(year);
        const monatl = jahreseinkommen / 12;
        // KSK trägt 50% — Künstler zahlt 50% der gesetzlichen Sätze
        const kvBeitrag = Math.min(monatl, bbg.kvpv) * s.kv * 12;
        const pvBeitrag = Math.min(monatl, bbg.kvpv) * s.pv * 12;
        const rvBeitrag = Math.min(monatl, bbg.rv)   * s.rv * 12;
        return { kv: kvBeitrag, pv: pvBeitrag, rv: rvBeitrag, gesamt: kvBeitrag + pvBeitrag + rvBeitrag };
    },

    render() {
        const cfg    = Store.getKskConfig();
        const year   = this._selectedYear;
        const meldungen = Store.getKskMeldungen().filter(m => m.jahr === year);
        const istMitglied = cfg.mitglied === true || cfg.mitglied === 'true';

        // Einkommensschätzung aus EÜR
        const startDate = `${year}-01-01`;
        const endDate   = `${year}-12-31`;
        const sales = Store.getSales().filter(s => Utils.isInPeriod(s.datum, startDate, endDate));
        const bruttoEin = sales.reduce((s, v) =>
            s + (parseFloat(v.verkaufspreis) || 0) + (parseFloat(v.versandkostenKaeufer) || 0), 0);
        const purchases = Store.getPurchases().filter(p => Utils.isInPeriod(p.datum, startDate, endDate));
        const expenses  = Store.getExpenses().filter(e => Utils.isInPeriod(e.datum, startDate, endDate));
        const ausgaben  = purchases.reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0)
                        + expenses.reduce((s, e) => s + (parseFloat(e.betrag) || 0), 0);
        const gewinnEuer = Math.max(0, bruttoEin - ausgaben);

        // Gemeldetes oder geschätztes Einkommen
        const gemeldetes = parseFloat(cfg.gemeldetesEinkommen) || 0;
        const grundlage  = gemeldetes > 0 ? gemeldetes : gewinnEuer;
        const beitrag    = this._calcBeitrag(grundlage, year);
        const saetze     = this._getSaetze(year);

        const yearOptions = Array.from({ length: 8 }, (_, i) => 2020 + i)
            .map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');

        const meldRows = meldungen.map(m => `
            <tr>
                <td>${m.datum ? Utils.formatDate(m.datum) : '–'}</td>
                <td>${Utils.escapeHtml(m.typ || '')}</td>
                <td style="text-align:right">${Utils.formatCurrency(parseFloat(m.betrag) || 0)}</td>
                <td>${Utils.escapeHtml(m.notiz || '')}</td>
            </tr>
        `).join('');

        return `
        <div class="page-header">
            <h2>Künstlersozialkasse (KSK)</h2>
            <div class="page-header-actions no-print">
                <select class="form-select" id="kskYear" style="width:100px;">${yearOptions}</select>
                <button class="btn btn-primary" data-action="ksk-config">⚙️ KSK-Konfiguration</button>
            </div>
        </div>

        ${!istMitglied ? `
        <div class="card" style="margin-bottom:16px;">
            <div style="padding:24px;text-align:center;">
                <div style="font-size:48px;margin-bottom:12px;">🎨</div>
                <h3>KSK-Mitgliedschaft nicht aktiv</h3>
                <p style="color:var(--text-muted);margin:8px 0 20px;max-width:500px;margin-left:auto;margin-right:auto;">
                    Die KSK bietet Künstlern und Publizisten Zugang zur gesetzlichen Kranken-, Pflege- und
                    Rentenversicherung. Du zahlst nur den Arbeitnehmeranteil (~50%), die KSK übernimmt den Rest.
                </p>
                <button class="btn btn-primary" data-action="ksk-config">KSK-Mitgliedschaft einrichten</button>
            </div>
        </div>` : ''}

        ${istMitglied ? `
        <div class="stats-grid" style="margin-bottom:20px;">
            <div class="card stat-card">
                <div class="card-label">Gemeldetes Einkommen ${year}</div>
                <div class="card-value">${Utils.formatCurrency(grundlage)}</div>
                <div class="card-subtitle">${gemeldetes > 0 ? 'Manuell gemeldet' : 'Aus EÜR geschätzt'}</div>
            </div>
            <div class="card stat-card danger">
                <div class="card-label">KV-Beitrag (${(saetze.kv * 100).toFixed(1)}%)</div>
                <div class="card-value">${Utils.formatCurrency(beitrag.kv)}</div>
                <div class="card-subtitle">${Utils.formatCurrency(beitrag.kv / 12)}/Monat</div>
            </div>
            <div class="card stat-card danger">
                <div class="card-label">PV-Beitrag (${(saetze.pv * 100).toFixed(1)}%)</div>
                <div class="card-value">${Utils.formatCurrency(beitrag.pv)}</div>
                <div class="card-subtitle">${Utils.formatCurrency(beitrag.pv / 12)}/Monat</div>
            </div>
            <div class="card stat-card danger">
                <div class="card-label">Gesamt-Beitrag ${year}</div>
                <div class="card-value">${Utils.formatCurrency(beitrag.gesamt)}</div>
                <div class="card-subtitle">${Utils.formatCurrency(beitrag.gesamt / 12)}/Monat</div>
            </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
            <div class="card-header"><div class="card-title">Beitragsrechner ${year}</div></div>
            <div style="padding:16px;">
                <div class="form-row" style="align-items:flex-end;">
                    <div class="form-group">
                        <label class="form-label">Jahreseinkommen (Basis für Beitrag) €</label>
                        <input type="number" class="form-input" id="kskCalcEin" step="100" value="${grundlage.toFixed(0)}"
                            data-action-input="ksk-calc">
                        <div class="form-hint">EÜR-Gewinn für ${year}: ${Utils.formatCurrency(gewinnEuer)}</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Monatsbeitrag (KV + PV + RV)</label>
                        <div class="form-input" id="kskCalcResult" style="background:var(--bg-secondary);color:var(--success);font-weight:600;">
                            ${Utils.formatCurrency(beitrag.gesamt / 12)}/Monat
                        </div>
                    </div>
                    <div class="form-group">
                        <button class="btn btn-primary" data-action="ksk-save-gemeldet">💾 Als gemeldetes EK speichern</button>
                    </div>
                </div>

                <table class="data-table" style="margin-top:12px;">
                    <thead><tr><th>Versicherung</th><th>Satz (Arbeitnehmer)</th><th style="text-align:right">Jahresbeitrag</th><th style="text-align:right">Monatsbeitrag</th></tr></thead>
                    <tbody>
                        <tr><td>Krankenversicherung</td><td>${(saetze.kv * 100).toFixed(1)}%</td><td style="text-align:right">${Utils.formatCurrency(beitrag.kv)}</td><td style="text-align:right">${Utils.formatCurrency(beitrag.kv/12)}</td></tr>
                        <tr><td>Pflegeversicherung</td><td>${(saetze.pv * 100).toFixed(1)}%</td><td style="text-align:right">${Utils.formatCurrency(beitrag.pv)}</td><td style="text-align:right">${Utils.formatCurrency(beitrag.pv/12)}</td></tr>
                        <tr><td>Rentenversicherung</td><td>${(saetze.rv * 100).toFixed(1)}%</td><td style="text-align:right">${Utils.formatCurrency(beitrag.rv)}</td><td style="text-align:right">${Utils.formatCurrency(beitrag.rv/12)}</td></tr>
                        <tr style="font-weight:600;background:var(--bg-secondary);">
                            <td colspan="2">Gesamt</td>
                            <td style="text-align:right">${Utils.formatCurrency(beitrag.gesamt)}</td>
                            <td style="text-align:right">${Utils.formatCurrency(beitrag.gesamt/12)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>` : ''}

        <div class="card" style="margin-bottom:16px;">
            <div class="card-header">
                <div class="card-title">Meldungshistorie ${year}</div>
                ${istMitglied ? `<button class="btn btn-sm btn-primary" data-action="ksk-meldung">+ Meldung</button>` : ''}
            </div>
            ${meldungen.length > 0 ? `
            <div class="table-container" style="border:none;">
                <table class="data-table">
                    <thead><tr><th>Datum</th><th>Typ</th><th style="text-align:right">Betrag</th><th>Notiz</th></tr></thead>
                    <tbody>${meldRows}</tbody>
                </table>
            </div>` : `<div style="padding:24px;text-align:center;color:var(--text-muted);">Keine Meldungen in ${year}</div>`}
        </div>

        <div class="card">
            <div style="padding:12px 16px;font-size:13px;color:var(--text-muted);line-height:1.7;">
                <strong>KSK-Meldepflicht:</strong> Jährlich musst du dein voraussichtliches Arbeitseinkommen melden.<br>
                <strong>Beitragsberechnung:</strong> Der Beitrag basiert auf dem gemeldeten Jahreseinkommen, aufgeteilt auf 12 Monate.<br>
                <strong>KSK-Anteil:</strong> Du zahlst nur ~50% des Beitrags – die KSK übernimmt die andere Hälfte aus dem Künstlersozialabgabe-Aufkommen.<br>
                <strong>Mindesteinnahmen:</strong> Dein Jahresarbeitseinkommen muss mind. 3.900 € betragen (Stand 2024).<br>
                <strong>⚠️ Beitragssätze sind Näherungswerte</strong> – aktuelle Sätze unter ksk.de prüfen.
            </div>
        </div>
        `;
    },

    init() {
        const ySel = document.getElementById('kskYear');
        if (ySel) ySel.addEventListener('change', () => {
            this._selectedYear = parseInt(ySel.value);
            this._refresh();
        });
    },

    _refresh() {
        const el = document.getElementById('content');
        if (el) { el.innerHTML = this.render(); this.init(); }
    },

    _updateCalc() {
        const val = parseFloat(document.getElementById('kskCalcEin')?.value) || 0;
        const b   = this._calcBeitrag(val, this._selectedYear);
        const res = document.getElementById('kskCalcResult');
        if (res) res.textContent = Utils.formatCurrency(b.gesamt / 12) + '/Monat';
        // Store temp value for save button
        this._tempCalcVal = val;
    },

    _saveGemeldetes() {
        const val = parseFloat(document.getElementById('kskCalcEin')?.value) || 0;
        const cfg = Store.getKskConfig();
        cfg.gemeldetesEinkommen = val;
        Store.saveKskConfig(cfg);
        Utils.showToast('Gemeldetes Einkommen gespeichert', 'success');
        this._refresh();
    },

    _openConfig() {
        const cfg = Store.getKskConfig();
        App.showModal('⚙️ KSK-Konfiguration', `
            <div class="form-group">
                <label class="form-label">KSK-Mitglied?</label>
                <select class="form-select" id="ksk_mitglied">
                    <option value="false" ${!cfg.mitglied || cfg.mitglied === 'false' ? 'selected' : ''}>Nein</option>
                    <option value="true" ${cfg.mitglied === true || cfg.mitglied === 'true' ? 'selected' : ''}>Ja</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Tätigkeitsbereich</label>
                <select class="form-select" id="ksk_taetigkeit">
                    <option value="bildende_kunst" ${cfg.taetigkeit === 'bildende_kunst' ? 'selected' : ''}>Bildende Kunst</option>
                    <option value="darstellende_kunst" ${cfg.taetigkeit === 'darstellende_kunst' ? 'selected' : ''}>Darstellende Kunst / Musik</option>
                    <option value="publizistik" ${cfg.taetigkeit === 'publizistik' ? 'selected' : ''}>Publizistik / Wort</option>
                    <option value="design" ${cfg.taetigkeit === 'design' ? 'selected' : ''}>Design / Formgestaltung</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Mitgliedsnummer (optional)</label>
                <input type="text" class="form-input" id="ksk_nr" value="${Utils.escapeHtml(cfg.nummer || '')}" placeholder="KSK-Nummer">
            </div>
            <div class="form-group">
                <label class="form-label">Gemeldetes Jahreseinkommen (€)</label>
                <input type="number" class="form-input" id="ksk_ein" step="100" value="${cfg.gemeldetesEinkommen || ''}" placeholder="0">
                <div class="form-hint">Das bei der KSK gemeldete voraussichtliche Arbeitseinkommen</div>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                <button class="btn" data-action="close-modal">Abbrechen</button>
                <button class="btn btn-primary" data-action="ksk-save-config">💾 Speichern</button>
            </div>
        `);
    },

    _saveConfig() {
        const cfg = {
            mitglied: document.getElementById('ksk_mitglied')?.value === 'true',
            taetigkeit: document.getElementById('ksk_taetigkeit')?.value,
            nummer: document.getElementById('ksk_nr')?.value?.trim(),
            gemeldetesEinkommen: parseFloat(document.getElementById('ksk_ein')?.value) || 0
        };
        Store.saveKskConfig(cfg);
        App.closeModal();
        Utils.showToast('KSK-Konfiguration gespeichert', 'success');
        this._refresh();
    },

    _openMeldung() {
        const today = Utils.todayISO();
        App.showModal('➕ KSK-Meldung erfassen', `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Datum *</label>
                    <input type="date" class="form-input" id="ksk_datum" value="${today}">
                </div>
                <div class="form-group">
                    <label class="form-label">Typ *</label>
                    <select class="form-select" id="ksk_typ">
                        <option value="Einkommensmeldung">Einkommensmeldung</option>
                        <option value="Beitragszahlung">Beitragszahlung</option>
                        <option value="Änderungsmeldung">Änderungsmeldung</option>
                        <option value="Sonstiges">Sonstiges</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Betrag (€)</label>
                <input type="number" class="form-input" id="ksk_betrag" step="0.01" min="0" placeholder="0,00">
            </div>
            <div class="form-group">
                <label class="form-label">Notiz</label>
                <input type="text" class="form-input" id="ksk_notiz" placeholder="z.B. Einkommensmeldung für 2026 ...">
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                <button class="btn" data-action="close-modal">Abbrechen</button>
                <button class="btn btn-primary" data-action="ksk-save-meldung">💾 Speichern</button>
            </div>
        `);
    },

    _saveMeldung() {
        const datum  = document.getElementById('ksk_datum')?.value;
        const typ    = document.getElementById('ksk_typ')?.value;
        const betrag = parseFloat(document.getElementById('ksk_betrag')?.value) || 0;
        const notiz  = document.getElementById('ksk_notiz')?.value?.trim();

        if (!datum) { Utils.showToast('Datum fehlt', 'error'); return; }

        Store.saveKskMeldung({
            datum, typ, betrag, notiz: notiz || '',
            jahr: this._selectedYear
        });
        App.closeModal();
        Utils.showToast('Meldung gespeichert', 'success');
        this._refresh();
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'ksk-config':        function () { Ksk._openConfig(); },
    'ksk-calc':          function () { Ksk._updateCalc(); },
    'ksk-save-gemeldet': function () { Ksk._saveGemeldetes(); },
    'ksk-meldung':       function () { Ksk._openMeldung(); },
    'ksk-save-config':   function () { Ksk._saveConfig(); },
    'ksk-save-meldung':  function () { Ksk._saveMeldung(); }
});
