// ============================================
// Steuertermine Module - Tax Deadline Calendar
// ============================================
const Steuertermine = {

    _getFixedTermine(year) {
        const land = (typeof CompanyManager !== 'undefined') ? CompanyManager.getActiveLand() : 'DE';
        if (land === 'AT') return this._getFixedTermineAT(year);
        return [
            { id: 'fix_eur_' + year,   datum: `${year}-07-31`, beschreibung: 'Steuererklärung / EÜR Vorjahr abgeben',      typ: 'steuer', fix: true },
            { id: 'fix_pstg_' + year,  datum: `${year}-03-31`, beschreibung: 'PStTG: Jahresbericht Plattformdaten',          typ: 'pstg',   fix: true },
            { id: 'fix_gewa_' + year,  datum: `${year}-02-15`, beschreibung: 'Gewerbesteuer-Vorauszahlung Q1',               typ: 'gewerbe', fix: true },
            { id: 'fix_gewb_' + year,  datum: `${year}-05-15`, beschreibung: 'Gewerbesteuer-Vorauszahlung Q2',               typ: 'gewerbe', fix: true },
            { id: 'fix_gewc_' + year,  datum: `${year}-08-15`, beschreibung: 'Gewerbesteuer-Vorauszahlung Q3',               typ: 'gewerbe', fix: true },
            { id: 'fix_gewd_' + year,  datum: `${year}-11-15`, beschreibung: 'Gewerbesteuer-Vorauszahlung Q4',               typ: 'gewerbe', fix: true },
            { id: 'fix_ust1_' + year,  datum: `${year}-04-10`, beschreibung: 'USt-Voranmeldung Q1 (bis 10.04.)',             typ: 'ust',    fix: true },
            { id: 'fix_ust2_' + year,  datum: `${year}-07-10`, beschreibung: 'USt-Voranmeldung Q2 (bis 10.07.)',             typ: 'ust',    fix: true },
            { id: 'fix_ust3_' + year,  datum: `${year}-10-10`, beschreibung: 'USt-Voranmeldung Q3 (bis 10.10.)',             typ: 'ust',    fix: true },
            { id: 'fix_ust4y_' + year, datum: `${year}-01-10`, beschreibung: 'USt-Voranmeldung Q4 Vorjahr (bis 10.01.)',     typ: 'ust',    fix: true }
        ];
    },

    _getFixedTermineAT(year) {
        return [
            // Finanzamt Austria
            { id: 'at_est_'  + year, datum: `${year}-06-30`, beschreibung: 'Einkommensteuererklärung E1/E1a Vorjahr (FinanzOnline)',  typ: 'steuer', fix: true },
            { id: 'at_pstg_' + year, datum: `${year}-03-31`, beschreibung: 'DAC7/PStTG: Jahresbericht Plattformdaten',               typ: 'pstg',   fix: true },
            // SVS Vorauszahlungen (Quartale: Feb, Mai, Aug, Nov)
            { id: 'at_svs1_' + year, datum: `${year}-02-28`, beschreibung: 'SVS-Vorauszahlung Q1 (Fälligkeit 28.02.)',               typ: 'svs',    fix: true },
            { id: 'at_svs2_' + year, datum: `${year}-05-31`, beschreibung: 'SVS-Vorauszahlung Q2 (Fälligkeit 31.05.)',               typ: 'svs',    fix: true },
            { id: 'at_svs3_' + year, datum: `${year}-08-31`, beschreibung: 'SVS-Vorauszahlung Q3 (Fälligkeit 31.08.)',               typ: 'svs',    fix: true },
            { id: 'at_svs4_' + year, datum: `${year}-11-30`, beschreibung: 'SVS-Vorauszahlung Q4 (Fälligkeit 30.11.)',               typ: 'svs',    fix: true },
            // KU-Schwelle Warnung (42.000 €)
            { id: 'at_ku_'   + year, datum: `${year}-12-31`, beschreibung: 'KU-Grenze prüfen: Umsatz < 42.000 € für §6 UStG?',      typ: 'steuer', fix: true },
        ];
    },

    _ampelColor(datum) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const termin = new Date(datum);
        const diffDays = Math.ceil((termin - today) / 86400000);
        if (diffDays < 0) return 'danger';
        if (diffDays <= 14) return 'warning';
        return 'success';
    },

    _diffLabel(datum) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const termin = new Date(datum);
        const diffDays = Math.ceil((termin - today) / 86400000);
        if (diffDays < 0) return `${Math.abs(diffDays)} Tage überfällig`;
        if (diffDays === 0) return 'Heute!';
        if (diffDays === 1) return 'Morgen!';
        return `in ${diffDays} Tagen`;
    },

    render() {
        const year = new Date().getFullYear();
        const fixed = this._getFixedTermine(year);
        const custom = Store.getSteuertermine();
        const today = Utils.todayISO();

        const all = [...fixed, ...custom].sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
        const upcoming = all.filter(t => t.datum >= today).slice(0, 3);

        // PStTG check
        const sales = Store.getSales();
        const yearSales = sales.filter(s => s.datum && s.datum.startsWith(String(year)));
        const platStats = {};
        yearSales.forEach(s => {
            const p = s.verkaufsplattform || 'Unbekannt';
            if (!platStats[p]) platStats[p] = { count: 0, umsatz: 0 };
            platStats[p].count++;
            platStats[p].umsatz += parseFloat(s.verkaufspreis) || 0;
        });
        const pstpgPflicht = Object.entries(platStats).filter(([, v]) => v.count >= 30 || v.umsatz >= 2000);

        const colorVars = { danger: 'var(--danger)', warning: 'var(--warning)', success: 'var(--success)' };
        const typColors = { steuer: 'badge-info', ust: 'badge-warning', gewerbe: 'badge-neutral', pstg: 'badge-danger', svs: 'badge-warning', custom: 'badge-success' };

        const upcomingCards = upcoming.length > 0 ? upcoming.map(t => {
            const c = this._ampelColor(t.datum);
            return `<div class="card stat-card" style="border-left:4px solid ${colorVars[c]};">
                <div class="card-label" style="color:${colorVars[c]};">${this._diffLabel(t.datum)}</div>
                <div class="card-value" style="font-size:14px;line-height:1.3;">${Utils.escapeHtml(t.beschreibung)}</div>
                <div class="card-subtitle">${Utils.formatDate(t.datum)}</div>
            </div>`;
        }).join('') : `<div class="card stat-card success">
            <div class="card-label">Nächster Termin</div>
            <div class="card-value" style="font-size:16px;">–</div>
            <div class="card-subtitle">Keine anstehenden Termine</div>
        </div>`;

        let rows = '';
        if (all.length === 0) {
            rows = '<tr><td colspan="5" class="table-empty">Keine Termine</td></tr>';
        } else {
            rows = all.map(t => {
                const c = this._ampelColor(t.datum);
                const colorStyle = colorVars[c];
                return `
                <tr>
                    <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorStyle};margin-right:6px;vertical-align:middle;"></span>${Utils.formatDate(t.datum)}</td>
                    <td>${Utils.escapeHtml(t.beschreibung)}</td>
                    <td><span class="badge ${typColors[t.typ] || 'badge-neutral'}">${Utils.escapeHtml(t.typ || 'custom')}</span></td>
                    <td style="color:${colorStyle};font-size:12px;">${this._diffLabel(t.datum)}</td>
                    <td class="table-actions">${!t.fix ? `<button class="btn btn-small btn-danger" data-delete-termin="${t.id}">Löschen</button>` : ''}</td>
                </tr>`;
            }).join('');
        }

        const pstpgWarning = pstpgPflicht.length > 0
            ? `<div style="margin-bottom:12px;padding:10px;background:rgba(239,68,68,0.08);border:1px solid var(--danger);border-radius:6px;font-size:13px;color:var(--danger);">
                ⚠️ <strong>Meldepflicht (PStTG)</strong> bei: ${pstpgPflicht.map(([p]) => p).join(', ')} – bis 31. März melden!
               </div>` : '';

        const pstpgRows = Object.entries(platStats).map(([plat, v]) => {
            const pflicht = v.count >= 30 || v.umsatz >= 2000;
            return `<tr>
                <td>${Utils.escapeHtml(plat)}</td>
                <td style="text-align:right">${v.count}</td>
                <td style="text-align:right">${Utils.formatCurrency(v.umsatz)}</td>
                <td><span class="badge ${pflicht ? 'badge-danger' : 'badge-success'}">${pflicht ? '⚠️ Meldepflicht' : '✓ OK'}</span></td>
            </tr>`;
        }).join('');

        const fromEuer = (typeof App !== 'undefined' && App._cameFromEuer);

        const land = (typeof CompanyManager !== 'undefined') ? CompanyManager.getActiveLand() : 'DE';
        const landBadge = land === 'AT'
            ? `<span style="font-size:12px;padding:3px 10px;border-radius:12px;background:rgba(228,50,62,.12);color:#e4323e;font-weight:600;border:1px solid rgba(228,50,62,.3);">🇦🇹 Österreich · §6 UStG</span>`
            : `<span style="font-size:12px;padding:3px 10px;border-radius:12px;background:rgba(99,102,241,.1);color:var(--accent);font-weight:600;border:1px solid rgba(99,102,241,.2);">🇩🇪 Deutschland · §19 UStG</span>`;

        return `
            <div class="page-header" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
                ${fromEuer ? `<button class="btn btn-small" id="steuerBackToEuer" style="opacity:.8;">← Zurück zur EÜR</button>` : ''}
                <h2 style="margin:0;">Steuertermin-Kalender</h2>
                ${landBadge}
            </div>
            ${land === 'AT' ? `<div id="svsTrackerWidget"></div>` : ''}

            <div class="stats-grid" style="margin-bottom:20px;">
                ${upcomingCards}
            </div>

            <div class="card" style="margin-bottom:16px;">
                <div class="card-header"><div class="card-title">Eigenen Termin hinzufügen</div></div>
                <form id="terminForm">
                    <div class="form-row" style="align-items:flex-end;">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <input type="date" class="form-input" id="st_datum">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Beschreibung</label>
                            <input type="text" class="form-input" id="st_beschreibung" placeholder="z.B. Vorauszahlung Finanzamt">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Typ</label>
                            <select class="form-select" id="st_typ">
                                <option value="custom">Eigener Termin</option>
                                <option value="steuer">Steuer</option>
                                <option value="ust">USt</option>
                                <option value="gewerbe">Gewerbesteuer</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <button type="submit" class="btn btn-primary">Hinzufügen</button>
                        </div>
                    </div>
                </form>
            </div>

            <div class="table-container" style="margin-bottom:24px;">
                <table>
                    <thead>
                        <tr>
                            <th>Datum</th>
                            <th>Beschreibung</th>
                            <th>Typ</th>
                            <th>Status</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>

            ${Object.keys(platStats).length > 0 ? `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">PStTG – Plattformmeldepflicht ${year}</div>
                    <div style="font-size:12px;color:var(--text-muted);">Meldepflicht ab 30 Verkäufe ODER 2.000 € je Plattform</div>
                </div>
                ${pstpgWarning}
                <div class="table-container" style="border:none;">
                    <table>
                        <thead><tr><th>Plattform</th><th style="text-align:right">Verkäufe</th><th style="text-align:right">Umsatz</th><th>PStTG-Status</th></tr></thead>
                        <tbody>${pstpgRows}</tbody>
                    </table>
                </div>
            </div>` : ''}
        `;
    },

    init() {
        // SVS-Widget für AT-User befüllen
        const svsEl = document.getElementById('svsTrackerWidget');
        if (svsEl && typeof SVS !== 'undefined') {
            svsEl.innerHTML = SVS.renderWidget();
        }

        // Zurück-Button (nur wenn von EÜR aufgerufen)
        const backBtn = document.getElementById('steuerBackToEuer');
        if (backBtn) backBtn.addEventListener('click', () => {
            App._cameFromEuer = false;
            App.navigate('euer');
        });

        document.getElementById('terminForm').addEventListener('submit', e => {
            e.preventDefault();
            const datum = document.getElementById('st_datum').value;
            const beschreibung = document.getElementById('st_beschreibung').value.trim();
            if (!datum || !beschreibung) {
                Utils.showToast('Datum und Beschreibung sind Pflichtfelder', 'warning');
                return;
            }
            Store.saveSteuertermin({ datum, beschreibung, typ: document.getElementById('st_typ').value });
            Utils.showToast('Termin gespeichert', 'success');
            this._refresh();
        });

        document.querySelectorAll('[data-delete-termin]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!confirm('Termin löschen?')) return;
                Store.deleteSteuertermin(btn.dataset.deleteTermin);
                Utils.showToast('Termin gelöscht', 'success');
                this._refresh();
            });
        });
    },

    _refresh() {
        document.getElementById('content').innerHTML = this.render();
        this.init();
    }
};
