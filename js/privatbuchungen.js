// ============================================
// Privatbuchungen – Entnahmen & Einlagen
// §4 Abs. 1 EStG – Kapitalkontoentwicklung
// ============================================
const Privatbuchungen = {
    _selectedYear: new Date().getFullYear(),

    render() {
        const year = this._selectedYear;
        const alle = Store.getPrivatbuchungen().filter(b => !b.storniert);
        const yearData = alle.filter(b => b.datum && b.datum.startsWith(String(year)));

        const entnahmen = yearData.filter(b => b.typ === 'entnahme').reduce((s, b) => s + (parseFloat(b.betrag) || 0), 0);
        const einlagen  = yearData.filter(b => b.typ === 'einlage').reduce((s, b) => s + (parseFloat(b.betrag) || 0), 0);
        const saldo     = einlagen - entnahmen;

        // Kapitalverlauf: Einnahmen aus EÜR für dieses Jahr
        const startDate = `${year}-01-01`;
        const endDate   = `${year}-12-31`;
        const sales    = Store.getSales().filter(s => Utils.isInPeriod(s.datum, startDate, endDate));
        const expenses = Store.getExpenses().filter(e => Utils.isInPeriod(e.datum, startDate, endDate));
        const purchases = Store.getPurchases().filter(p => Utils.isInPeriod(p.datum, startDate, endDate));
        const bruttoEin = sales.reduce((s, v) => s + (parseFloat(v.verkaufspreis) || 0) + (parseFloat(v.versandkostenKaeufer) || 0), 0);
        const ausgaben  = purchases.reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0)
                        + expenses.reduce((s, e) => s + (parseFloat(e.betrag) || 0), 0)
                        + sales.reduce((s, v) => s + (parseFloat(v.versandkostenVerkaufer) || 0), 0);
        const gewinn    = bruttoEin - ausgaben;

        // Jahresauswahl
        const yearOptions = Array.from({ length: 8 }, (_, i) => 2020 + i)
            .map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');

        const sorted = [...yearData].sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

        const rows = sorted.map(b => `
            <tr>
                <td>${Utils.formatDate(b.datum)}</td>
                <td>
                    <span class="badge ${b.typ === 'entnahme' ? 'badge-danger' : 'badge-success'}">
                        ${b.typ === 'entnahme' ? '↑ Entnahme' : '↓ Einlage'}
                    </span>
                </td>
                <td style="text-align:right;color:${b.typ === 'entnahme' ? 'var(--danger)' : 'var(--success)'}">
                    ${b.typ === 'entnahme' ? '−' : '+'}${Utils.formatCurrency(parseFloat(b.betrag) || 0)}
                </td>
                <td>${Utils.escapeHtml(b.beschreibung || '')}</td>
                <td>
                    <button class="btn btn-sm btn-danger" data-action="pb-storno" data-args='["${b.id}"]' >🗑️</button>
                </td>
            </tr>
        `).join('');

        const emptyRow = sorted.length === 0
            ? `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:32px;">Keine Buchungen in ${year}</td></tr>`
            : '';

        return `
        <div class="page-header">
            <h2>Privatentnahmen & Privateinlagen</h2>
            <div class="page-header-actions no-print">
                <select class="form-select" id="privYear" style="width:100px;">${yearOptions}</select>
                <button class="btn btn-primary" data-action="pb-form">+ Buchung</button>
            </div>
        </div>

        <div class="stats-grid" style="margin-bottom:20px;">
            <div class="card stat-card danger">
                <div class="card-label">Privatentnahmen ${year}</div>
                <div class="card-value">${Utils.formatCurrency(entnahmen)}</div>
                <div class="card-subtitle">${yearData.filter(b => b.typ === 'entnahme').length} Buchungen</div>
            </div>
            <div class="card stat-card success">
                <div class="card-label">Privateinlagen ${year}</div>
                <div class="card-value">${Utils.formatCurrency(einlagen)}</div>
                <div class="card-subtitle">${yearData.filter(b => b.typ === 'einlage').length} Buchungen</div>
            </div>
            <div class="card stat-card ${saldo >= 0 ? 'success' : 'danger'}">
                <div class="card-label">Saldo (Einlagen − Entnahmen)</div>
                <div class="card-value">${saldo >= 0 ? '+' : ''}${Utils.formatCurrency(saldo)}</div>
                <div class="card-subtitle">Netto-Kapitalveränderung</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Betriebsgewinn ${year} (EÜR)</div>
                <div class="card-value" style="color:${gewinn >= 0 ? 'var(--success)' : 'var(--danger)'}">
                    ${Utils.formatCurrency(gewinn)}
                </div>
                <div class="card-subtitle">Entnahmen sollten ≤ Gewinn sein</div>
            </div>
        </div>

        ${entnahmen > gewinn && gewinn > 0 ? `
        <div style="background:rgba(var(--warning-rgb,255,193,7),0.12);border:1px solid var(--warning,#ffc107);border-radius:8px;padding:12px 16px;margin-bottom:16px;color:var(--text-primary);">
            ⚠️ <strong>Hinweis:</strong> Die Privatentnahmen (${Utils.formatCurrency(entnahmen)}) übersteigen den Betriebsgewinn (${Utils.formatCurrency(gewinn)}).
            Das kann zu einer Überschuldung des Betriebsvermögens führen.
        </div>` : ''}

        <div class="card">
            <div class="card-header">
                <div class="card-title">Buchungsübersicht – ${year}</div>
            </div>
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Datum</th>
                            <th>Typ</th>
                            <th style="text-align:right">Betrag</th>
                            <th>Beschreibung</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rows || emptyRow}</tbody>
                    ${sorted.length > 0 ? `<tfoot>
                        <tr style="font-weight:600;background:var(--bg-secondary);">
                            <td colspan="2">Saldo</td>
                            <td style="text-align:right;color:${saldo >= 0 ? 'var(--success)' : 'var(--danger)'}">
                                ${saldo >= 0 ? '+' : ''}${Utils.formatCurrency(saldo)}
                            </td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>` : ''}
                </table>
            </div>
        </div>

        <div class="card" style="margin-top:16px;">
            <div class="card-header"><div class="card-title">Info zur Kapitalentwicklung</div></div>
            <div style="padding:12px 16px;font-size:13px;color:var(--text-muted);line-height:1.7;">
                <strong>Privatentnahme:</strong> Geld, das du für private Zwecke aus dem Betrieb entnimmst (mindert das Betriebskapital).<br>
                <strong>Privateinlage:</strong> Privates Geld, das du in den Betrieb einbringst (erhöht das Betriebskapital).<br>
                <strong>Steuerlich:</strong> Entnahmen und Einlagen sind keine Betriebsausgaben/-einnahmen – sie berühren die EÜR nicht direkt.<br>
                <strong>⚠️ Unverbindlich</strong> – Prüfung durch Steuerberater empfohlen.
            </div>
        </div>
        `;
    },

    init() {
        const ySel = document.getElementById('privYear');
        if (ySel) ySel.addEventListener('change', () => {
            this._selectedYear = parseInt(ySel.value);
            this._refresh();
        });
    },

    _refresh() {
        const el = document.getElementById('content');
        if (el) { el.innerHTML = this.render(); this.init(); }
    },

    _openForm() {
        const today = Utils.todayISO();
        App.showModal('➕ Privatbuchung erfassen', `
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Datum *</label>
                    <input type="date" class="form-input" id="priv_datum" value="${today}">
                </div>
                <div class="form-group">
                    <label class="form-label">Typ *</label>
                    <select class="form-select" id="priv_typ">
                        <option value="entnahme">↑ Privatentnahme</option>
                        <option value="einlage">↓ Privateinlage</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Betrag (€) *</label>
                <input type="number" class="form-input" id="priv_betrag" step="0.01" min="0" placeholder="0,00">
            </div>
            <div class="form-group">
                <label class="form-label">Beschreibung / Zweck</label>
                <input type="text" class="form-input" id="priv_desc" placeholder="z.B. Miete, Lebensmittel, Kapitalzuführung ...">
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                <button class="btn" data-action="close-modal">Abbrechen</button>
                <button class="btn btn-primary" data-action="pb-save">Speichern</button>
            </div>
        `);
    },

    _saveForm() {
        const datum   = document.getElementById('priv_datum')?.value;
        const typ     = document.getElementById('priv_typ')?.value;
        const betrag  = parseFloat(document.getElementById('priv_betrag')?.value) || 0;
        const desc    = document.getElementById('priv_desc')?.value?.trim();

        if (!datum) { Utils.showToast('Datum fehlt', 'error'); return; }
        if (betrag <= 0) { Utils.showToast('Betrag fehlt oder 0', 'error'); return; }

        Store.savePrivatbuchung({ datum, typ, betrag, beschreibung: desc || '' });
        App.closeModal();
        Utils.showToast('Buchung gespeichert', 'success');
        this._refresh();
    },

    _storno(id) {
        const b = Store.getPrivatbuchungen().find(x => x.id === id);
        if (!b) return;
        if (!confirm(`Buchung vom ${Utils.formatDate(b.datum)} (${Utils.formatCurrency(b.betrag)}) stornieren?`)) return;
        Store.stornoPrivatbuchung(id, 'Manuell storniert');
        Utils.showToast('Buchung storniert', 'success');
        this._refresh();
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'pb-storno': function (id) { Privatbuchungen._storno(id); },
    'pb-form':   function () { Privatbuchungen._openForm(); },
    'pb-save':   function () { Privatbuchungen._saveForm(); }
});
