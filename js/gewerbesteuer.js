// ============================================
// Gewerbesteuer-Modul
// Berechnung für alle gewerbesteuerpflichtigen Rechtsformen
// ============================================
const Gewerbesteuer = {

    _year: new Date().getFullYear(),

    MESSZAHL: 0.035, // 3,5% Steuermesszahl
    FREIBETRAG_PERSONEN: 24500, // §11 Abs. 1 GewStG — nur Personengesellschaften/EU

    _getHebesatz() {
        const einst = Store.get('gbr_einstellungen') || {};
        return parseFloat(einst.hebesatz) || 400;
    },

    _isGewStPflichtig() {
        if (typeof Rechtsform === 'undefined') return false;
        return Rechtsform.getConfig().gewerbesteuer === true;
    },

    _hatFreibetrag() {
        if (typeof Rechtsform === 'undefined') return true;
        return Rechtsform.getConfig().gewStFreibetrag === true;
    },

    _calcGewinn(year) {
        const sales     = (Store.get('sales') || []).filter(s => new Date(s.datum).getFullYear() === year);
        const purchases = (Store.get('purchases') || []).filter(p => new Date(p.datum).getFullYear() === year);
        const expenses  = (Store.get('expenses') || []).filter(e => new Date(e.datum).getFullYear() === year);

        let einnahmen = 0, ausgaben = 0;
        sales.forEach(s => einnahmen += parseFloat(s.netto || s.betrag) || 0);
        purchases.forEach(p => ausgaben += parseFloat(p.netto || p.betrag) || 0);
        expenses.forEach(e => ausgaben += parseFloat(e.betrag) || 0);

        return einnahmen - ausgaben;
    },

    _calc(year) {
        const gewinn = this._calcGewinn(year);
        const hebesatz = this._getHebesatz();
        const hatFreibetrag = this._hatFreibetrag();
        const freibetrag = hatFreibetrag ? this.FREIBETRAG_PERSONEN : 0;

        // Gewerbeertrag nach Freibetrag
        const gewerbeertrag = Math.max(0, gewinn - freibetrag);
        const messbetrag = gewerbeertrag * this.MESSZAHL;
        const gewSt = messbetrag * (hebesatz / 100);

        // §35 EStG Anrechnung (nur Personengesellschaften/EU)
        // Max. Anrechnung = 4 × Messbetrag, begrenzt auf tatsächliche ESt
        const anrechnung35 = hatFreibetrag ? messbetrag * 4 : 0;

        const effektiverSatz = gewinn > 0 ? (gewSt / gewinn * 100) : 0;

        return {
            gewinn, gewerbeertrag, freibetrag, messbetrag,
            hebesatz, gewSt, anrechnung35, effektiverSatz,
            hatFreibetrag
        };
    },

    render() {
        if (!this._isGewStPflichtig()) {
            return `<div class="page-header"><h2><i class="ti ti-building-store" style="margin-right:6px;"></i> Gewerbesteuer</h2></div>
            <div class="card" style="padding:40px;text-align:center;">
                <div style="font-size:48px;margin-bottom:12px;">🏠</div>
                <div style="font-weight:700;font-size:16px;margin-bottom:8px;">Keine Gewerbesteuerpflicht</div>
                <div style="color:var(--text-muted);">Als ${typeof Rechtsform !== 'undefined' ? Rechtsform.get() : 'Freiberufler'} bist du nicht gewerbesteuerpflichtig.</div>
            </div>`;
        }

        const year = this._year;
        const c = this._calc(year);
        const form = typeof Rechtsform !== 'undefined' ? Rechtsform.get() : '';

        return `
        <div class="page-header">
            <h2><i class="ti ti-building-store" style="margin-right:6px;"></i> Gewerbesteuer ${year}</h2>
            <div class="page-header-actions no-print">
                <select class="form-select" style="width:100px;" id="gewstYearSelect">
                    ${[year-2, year-1, year, year+1].map(y => `<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('')}
                </select>
            </div>
        </div>

        <!-- KPI -->
        <div class="stats-grid" style="margin-bottom:16px;">
            <div class="card stat-card">
                <div class="card-label">Gewerblicher Gewinn</div>
                <div class="card-value">${Utils.formatCurrency(c.gewinn)}</div>
            </div>
            <div class="card stat-card ${c.hatFreibetrag ? 'success' : ''}">
                <div class="card-label">Freibetrag</div>
                <div class="card-value">${c.hatFreibetrag ? Utils.formatCurrency(c.freibetrag) : '—'}</div>
                <div class="card-subtitle">${c.hatFreibetrag ? '§11 GewStG (Personengesellschaft/EU)' : 'Kein Freibetrag (Kapitalgesellschaft)'}</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Gewerbeertrag</div>
                <div class="card-value">${Utils.formatCurrency(c.gewerbeertrag)}</div>
            </div>
            <div class="card stat-card danger">
                <div class="card-label">Gewerbesteuer</div>
                <div class="card-value">${Utils.formatCurrency(c.gewSt)}</div>
                <div class="card-subtitle">Effektiv ${c.effektiverSatz.toFixed(2)} %</div>
            </div>
        </div>

        <!-- Berechnungsweg -->
        <div class="card" style="padding:20px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:14px;">Berechnungsweg</div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:4px 20px;font-size:13px;max-width:500px;">
                <span>Gewinn aus Gewerbebetrieb</span>
                <span style="text-align:right;font-weight:600;">${Utils.formatCurrency(c.gewinn)}</span>

                ${c.hatFreibetrag ? `
                <span style="color:var(--text-muted);">− Freibetrag §11 GewStG</span>
                <span style="text-align:right;color:var(--success)">− ${Utils.formatCurrency(c.freibetrag)}</span>` : ''}

                <span style="font-weight:600;">= Gewerbeertrag (abgerundet auf volle 100 €)</span>
                <span style="text-align:right;font-weight:600;">${Utils.formatCurrency(Math.floor(c.gewerbeertrag / 100) * 100)}</span>

                <div style="grid-column:1/-1;border-top:1px solid var(--border);margin:6px 0;"></div>

                <span style="color:var(--text-muted);">× Steuermesszahl ${(this.MESSZAHL * 100).toFixed(1)} %</span>
                <span style="text-align:right;">${Utils.formatCurrency(c.messbetrag)}</span>

                <span style="color:var(--text-muted);">× Hebesatz ${c.hebesatz} %</span>
                <span style="text-align:right;"></span>

                <div style="grid-column:1/-1;border-top:2px solid var(--border);margin:4px 0;"></div>
                <span style="font-weight:800;font-size:15px;">= Gewerbesteuer</span>
                <span style="text-align:right;font-weight:800;font-size:15px;color:var(--danger);">${Utils.formatCurrency(c.gewSt)}</span>

                ${c.hatFreibetrag ? `
                <div style="grid-column:1/-1;border-top:1px solid var(--border);margin:6px 0;"></div>
                <span style="color:var(--success);">§35 EStG Anrechnung (max. 4×Messbetrag)</span>
                <span style="text-align:right;color:var(--success);font-weight:600;">bis ${Utils.formatCurrency(c.anrechnung35)}</span>
                <span style="grid-column:1/-1;font-size:11px;color:var(--text-muted);">Anrechnung auf Einkommensteuer — effektive GewSt-Belastung oft nahe 0 € bei Hebesatz ≤ 400 %</span>` : ''}
            </div>
        </div>

        <!-- Hebesatz-Einstellung -->
        <div class="card" style="padding:16px;">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <div style="font-weight:700;font-size:13px;">Hebesatz:</div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <input type="number" class="form-input" id="gewstHebesatzInput" value="${c.hebesatz}" min="200" max="900" step="1" style="width:80px;">
                    <span style="color:var(--text-muted);">%</span>
                    <button class="btn btn-small btn-primary" id="gewstHebesatzSave">Speichern</button>
                </div>
                <span style="font-size:11px;color:var(--text-muted);">Bundesweiter Ø ~400 % · Lokal beim Gewerbeamt erfragen</span>
            </div>
        </div>

        <!-- Quartals-Vorauszahlungen -->
        <div class="card" style="padding:16px;margin-top:16px;">
            <div style="font-weight:700;font-size:13px;margin-bottom:10px;">Vierteljährliche Vorauszahlungen</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
                ${['Q1 (15.02.)', 'Q2 (15.05.)', 'Q3 (15.08.)', 'Q4 (15.11.)'].map((q, i) => `
                <div style="background:var(--bg-secondary);border-radius:8px;padding:10px 12px;text-align:center;">
                    <div style="font-size:11px;color:var(--text-muted);">${q}</div>
                    <div style="font-weight:700;font-size:14px;">${Utils.formatCurrency(c.gewSt / 4)}</div>
                </div>`).join('')}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">
                Vorauszahlungen basierend auf Vorjahresgewinn — FA setzt individuell fest
            </div>
        </div>`;
    },

    init() {
        const yearSel = document.getElementById('gewstYearSelect');
        if (yearSel) yearSel.addEventListener('change', (e) => {
            this._year = parseInt(e.target.value);
            this._refresh();
        });

        const saveBtn = document.getElementById('gewstHebesatzSave');
        if (saveBtn) saveBtn.addEventListener('click', () => {
            const val = parseFloat(document.getElementById('gewstHebesatzInput')?.value) || 400;
            const einst = Store.get('gbr_einstellungen') || {};
            einst.hebesatz = val;
            Store.set('gbr_einstellungen', einst);
            Utils.showToast('Hebesatz gespeichert', 'success');
            this._refresh();
        });
    },

    _refresh() {
        const el = document.getElementById('content');
        if (!el) return;
        el.innerHTML = this.render();
        this.init();
    }
};
