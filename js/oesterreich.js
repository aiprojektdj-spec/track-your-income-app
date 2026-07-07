// ============================================
// Österreich-Modul — EAR, USt, GSVG, ESt
// ============================================
const Oesterreich = {

    _year: new Date().getFullYear(),
    _tab:  'ear',
    _period: 'jahr',

    // ── Konstanten ────────────────────────────────────────────────
    UST_KLEIN_GRENZE: 35000, // § 6 Abs. 1 Z 27 UStG (bis 2024)

    GSVG: {
        kv:      0.0765,  // Krankenversicherung
        pv:      0.185,   // Pensionsversicherung
        uvFixed: 124.08,  // Unfallversicherung (Jahrespauschale 2024)
    },
    GSVG_GRENZE: {
        min: 6453.36,  // Mindestbeitragsgrundlage/Jahr 2024
        max: 84840,    // Höchstbeitragsgrundlage/Jahr 2024 (7 070 €/Monat)
    },

    // Einkommensteuer-Tarif 2024 (§ 33 EStG)
    EST_TARIF: [
        { von: 0,        bis: 12816,   satz: 0    },
        { von: 12816,    bis: 20818,   satz: 0.20 },
        { von: 20818,    bis: 34513,   satz: 0.30 },
        { von: 34513,    bis: 66612,   satz: 0.41 },
        { von: 66612,    bis: 99266,   satz: 0.48 },
        { von: 99266,    bis: 1000000, satz: 0.50 },
        { von: 1000000,  bis: Infinity,satz: 0.55 },
    ],

    GEWINNFREIBETRAG_GRENZE: 33000,
    GEWINNFREIBETRAG_SATZ:   0.15,  // max 4 500 € Grundfreibetrag

    // ── Initialisierung ───────────────────────────────────────────
    init() {
        // nothing to load from settings currently
    },

    // ── Routing ───────────────────────────────────────────────────
    render() {
        const tabs = [
            { id: 'ear',  label: 'EAR',           icon: 'ti-clipboard-list' },
            { id: 'ust',  label: 'USt',            icon: 'ti-receipt-tax'   },
            { id: 'gsvg', label: 'GSVG / SV',      icon: 'ti-shield-heart'  },
            { id: 'est',  label: 'Einkommensteuer', icon: 'ti-calculator'    },
        ];
        const tabHtml = `
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;">
            ${tabs.map(t => `
            <button class="btn${this._tab === t.id ? ' btn-primary' : ''}"
                data-action="at-tab" data-args='["${t.id}"]' >
                <i class="ti ${t.icon}"></i> ${t.label}
            </button>`).join('')}
        </div>`;

        let body = '';
        if (this._tab === 'ear')  body = this._renderEAR();
        if (this._tab === 'ust')  body = this._renderUSt();
        if (this._tab === 'gsvg') body = this._renderGSVG();
        if (this._tab === 'est')  body = this._renderESt();

        return `
        <div class="page-header">
            <h2><i class="ti ti-flag-3" style="margin-right:6px;"></i> Österreich ${this._year}</h2>
            <div class="page-header-actions no-print">
                <select class="form-select" style="width:100px;" data-action-change="at-year">
                    ${[-2,-1,0,1].map(d=>this._year+d).map(y=>`<option value="${y}" ${y===this._year?'selected':''}>${y}</option>`).join('')}
                </select>
            </div>
        </div>
        ${tabHtml}
        ${body}`;
    },

    _rerender() {
        const el = document.getElementById('content');
        if (el) { el.innerHTML = this.render(); this.initEvents(); }
    },

    initEvents() {
        // Year select handled inline via onchange
    },

    // ── EAR ───────────────────────────────────────────────────────
    _calcEAR(year) {
        const y = year || this._year;
        const sales     = (Store.get('sales')     || []).filter(s => new Date(s.datum).getFullYear() === y);
        const purchases = (Store.get('purchases') || []).filter(p => new Date(p.datum).getFullYear() === y);
        const expenses  = (Store.getAllExpensesRaw ? Store.getAllExpensesRaw() : (Store.get('ausgaben') || [])).filter(e => new Date(e.datum).getFullYear() === y);

        let einnahmen = 0, ausgaben = 0;
        sales.forEach(s     => einnahmen += parseFloat(s.netto || s.betrag) || 0);
        purchases.forEach(p => ausgaben  += parseFloat(p.netto || p.betrag) || 0);
        expenses.forEach(e  => ausgaben  += parseFloat(e.betrag) || 0);

        return { einnahmen, ausgaben, gewinn: einnahmen - ausgaben };
    },

    _renderEAR() {
        const { einnahmen, ausgaben, gewinn } = this._calcEAR();
        const fmt = v => Utils.formatCurrency(v);
        const ustKlein = einnahmen <= this.UST_KLEIN_GRENZE;

        return `
        ${ustKlein ? `
        <div class="info-card info-card-success" style="margin-bottom:16px;">
            <i class="ti ti-shield-check"></i>
            <div><strong>Kleinunternehmer</strong> — Jahresumsatz unter ${fmt(this.UST_KLEIN_GRENZE)}<br>
            <small>§ 6 Abs. 1 Z 27 UStG — keine USt-Pflicht</small></div>
        </div>` : `
        <div class="info-card info-card-warning" style="margin-bottom:16px;">
            <i class="ti ti-alert-triangle"></i>
            <div><strong>USt-pflichtig</strong> — Umsatz über ${fmt(this.UST_KLEIN_GRENZE)}<br>
            <small>USt-Voranmeldung quartalsweise (U30) erforderlich</small></div>
        </div>`}

        <div class="stats-grid" style="margin-bottom:16px;">
            <div class="card stat-card success">
                <div class="card-label">Einnahmen ${this._year}</div>
                <div class="card-value">${fmt(einnahmen)}</div>
            </div>
            <div class="card stat-card danger">
                <div class="card-label">Ausgaben ${this._year}</div>
                <div class="card-value">${fmt(ausgaben)}</div>
            </div>
            <div class="card stat-card${gewinn >= 0 ? '' : ' danger'}">
                <div class="card-label">Gewinn (EAR)</div>
                <div class="card-value">${fmt(gewinn)}</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Kleinunternehmergrenze</div>
                <div class="card-value">${Math.min(100, Math.round(einnahmen / this.UST_KLEIN_GRENZE * 100))}%</div>
                <div class="card-subtitle">${fmt(einnahmen)} von ${fmt(this.UST_KLEIN_GRENZE)}</div>
            </div>
        </div>

        <div class="card" style="padding:20px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:14px;">Einnahmen-Ausgaben-Rechnung ${this._year}</div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:4px 20px;font-size:13px;max-width:460px;">
                <span>Einnahmen (Netto)</span>
                <span style="text-align:right;color:var(--success);font-weight:600;">${fmt(einnahmen)}</span>
                <span style="color:var(--text-muted);">− Betriebsausgaben</span>
                <span style="text-align:right;color:var(--danger);">− ${fmt(ausgaben)}</span>
                <div style="grid-column:1/-1;border-top:2px solid var(--border);margin:6px 0;"></div>
                <span style="font-weight:800;font-size:15px;">= Gewinn</span>
                <span style="text-align:right;font-weight:800;font-size:15px;color:${gewinn>=0?'var(--success)':'var(--danger)'};">${fmt(gewinn)}</span>
            </div>
        </div>`;
    },

    // ── USt ───────────────────────────────────────────────────────
    _calcUSt(year) {
        const y = year || this._year;
        const sales = (Store.get('sales') || []).filter(s => new Date(s.datum).getFullYear() === y);

        let ust20 = 0, ust10 = 0, ust13 = 0;
        let basis20 = 0, basis10 = 0, basis13 = 0;

        sales.forEach(s => {
            const netto = parseFloat(s.netto || s.betrag) || 0;
            const satz  = parseFloat(s.mwstSatz || s.ustSatz) || 20;
            if (satz === 10) { basis10 += netto; ust10 += netto * 0.10; }
            else if (satz === 13) { basis13 += netto; ust13 += netto * 0.13; }
            else { basis20 += netto; ust20 += netto * 0.20; }
        });

        const purchases = (Store.get('purchases') || []).filter(p => new Date(p.datum).getFullYear() === y);
        const expenses  = (Store.getAllExpensesRaw ? Store.getAllExpensesRaw() : (Store.get('ausgaben') || [])).filter(e => new Date(e.datum).getFullYear() === y);

        let vorsteuer = 0;
        purchases.forEach(p => vorsteuer += (parseFloat(p.vorsteuer || 0)) || (parseFloat(p.netto||p.betrag)||0) * 0.20);
        expenses.forEach(e  => vorsteuer += (parseFloat(e.vorsteuer || 0)) || 0);

        const ustGesamt = ust20 + ust10 + ust13;
        const zahllast  = ustGesamt - vorsteuer;

        return { basis20, basis10, basis13, ust20, ust10, ust13, ustGesamt, vorsteuer, zahllast };
    },

    _renderUSt() {
        const { einnahmen } = this._calcEAR();
        const ustKlein = einnahmen <= this.UST_KLEIN_GRENZE;
        const fmt = v => Utils.formatCurrency(v);

        if (ustKlein) {
            return `
            <div class="card" style="padding:40px;text-align:center;">
                <div style="font-size:48px;margin-bottom:12px;">🇦🇹</div>
                <div style="font-weight:700;font-size:16px;margin-bottom:8px;">Kleinunternehmer — keine USt-Pflicht</div>
                <div style="color:var(--text-muted);max-width:400px;margin:0 auto;">
                    Umsatz unter ${fmt(this.UST_KLEIN_GRENZE)}/Jahr (§ 6 Abs. 1 Z 27 UStG).<br>
                    Auf Rechnungen: <em>"Gemäß § 6 Abs. 1 Z 27 UStG wird keine Umsatzsteuer berechnet."</em>
                </div>
            </div>`;
        }

        const d = this._calcUSt();
        const q = [1,2,3,4].map(i => {
            const s = (Store.get('sales')||[]).filter(s=>{const m=new Date(s.datum).getMonth()+1; return new Date(s.datum).getFullYear()===this._year && Math.ceil(m/3)===i;});
            let u=0; s.forEach(x=>u+=(parseFloat(x.netto||x.betrag)||0)*0.20); return u;
        });

        return `
        <div class="stats-grid" style="margin-bottom:16px;">
            <div class="card stat-card danger">
                <div class="card-label">USt gesamt ${this._year}</div>
                <div class="card-value">${fmt(d.ustGesamt)}</div>
            </div>
            <div class="card stat-card success">
                <div class="card-label">Vorsteuer</div>
                <div class="card-value">${fmt(d.vorsteuer)}</div>
            </div>
            <div class="card stat-card${d.zahllast>0?' danger':' success'}">
                <div class="card-label">Zahllast / Überschuss</div>
                <div class="card-value">${fmt(d.zahllast)}</div>
            </div>
        </div>

        <!-- Sätze -->
        <div class="card" style="padding:20px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:14px;">Umsatzsteuer nach Sätzen</div>
            <div style="display:grid;grid-template-columns:1fr auto auto;gap:6px 16px;font-size:13px;align-items:center;">
                <span style="font-weight:600;color:var(--text-muted);">Steuersatz</span>
                <span style="font-weight:600;text-align:right;color:var(--text-muted);">Netto-Basis</span>
                <span style="font-weight:600;text-align:right;color:var(--text-muted);">USt</span>
                ${d.basis20>0||true ? `
                <span>20% – Normalsatz</span>
                <span style="text-align:right;">${fmt(d.basis20)}</span>
                <span style="text-align:right;color:var(--danger);">${fmt(d.ust20)}</span>` : ''}
                ${d.basis10>0 ? `
                <span>10% – reduzierter Satz</span>
                <span style="text-align:right;">${fmt(d.basis10)}</span>
                <span style="text-align:right;color:var(--danger);">${fmt(d.ust10)}</span>` : ''}
                ${d.basis13>0 ? `
                <span>13% – Halbsatz</span>
                <span style="text-align:right;">${fmt(d.basis13)}</span>
                <span style="text-align:right;color:var(--danger);">${fmt(d.ust13)}</span>` : ''}
                <div style="grid-column:1/-1;border-top:2px solid var(--border);margin:4px 0;"></div>
                <span style="font-weight:800;">= Zahllast</span>
                <span></span>
                <span style="text-align:right;font-weight:800;color:var(--danger);">${fmt(d.zahllast)}</span>
            </div>
        </div>

        <!-- Quartalsvorauszahlungen -->
        <div class="card" style="padding:16px;">
            <div style="font-weight:700;font-size:13px;margin-bottom:10px;">USt-Voranmeldung (U30) — Quartale ${this._year}</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
                ${['Q1 (30.04.)', 'Q2 (31.07.)', 'Q3 (31.10.)', 'Q4 (31.01.)'].map((q_,i) => `
                <div style="background:var(--bg-secondary);border-radius:8px;padding:10px 12px;text-align:center;">
                    <div style="font-size:11px;color:var(--text-muted);">${q_}</div>
                    <div style="font-weight:700;font-size:14px;">${fmt(q[i])}</div>
                </div>`).join('')}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">
                U30 quartalsweise bis Monatsende nach Quartal. Bei Vorjahres-USt > 100 000 €: monatlich.
            </div>
        </div>`;
    },

    // ── GSVG ──────────────────────────────────────────────────────
    _calcGSVG(gewinn) {
        gewinn = gewinn || 0;
        const { kv, pv, uvFixed } = this.GSVG;
        const { min: bglMin, max: bglMax } = this.GSVG_GRENZE;

        // Beitragsgrundlage = Gewinn (clamped)
        const bgl = Math.min(Math.max(gewinn, bglMin), bglMax);
        const kvBeitrag = bgl * kv;
        const pvBeitrag = bgl * pv;
        const gesamt    = kvBeitrag + pvBeitrag + uvFixed;
        const effRate   = gewinn > 0 ? (gesamt / gewinn * 100) : 0;

        return { bgl, kvBeitrag, pvBeitrag, uvFixed, gesamt, effRate, hatMindest: gewinn < bglMin };
    },

    _renderGSVG() {
        const { gewinn } = this._calcEAR();
        const g = this._calcGSVG(gewinn);
        const fmt = v => Utils.formatCurrency(v);

        return `
        ${g.hatMindest ? `
        <div class="info-card info-card-warning" style="margin-bottom:16px;">
            <i class="ti ti-info-circle"></i>
            <div><strong>Mindestbeitragsgrundlage</strong> — Beiträge auf Basis ${fmt(this.GSVG_GRENZE.min)}/Jahr (nicht auf tatsächlichem Gewinn)</div>
        </div>` : ''}

        <div class="stats-grid" style="margin-bottom:16px;">
            <div class="card stat-card">
                <div class="card-label">Beitragsgrundlage</div>
                <div class="card-value">${fmt(g.bgl)}</div>
                <div class="card-subtitle">${g.hatMindest ? 'Mindest-BGL' : 'Gewinn'}</div>
            </div>
            <div class="card stat-card danger">
                <div class="card-label">GSVG-Beiträge / Jahr</div>
                <div class="card-value">${fmt(g.gesamt)}</div>
                <div class="card-subtitle">Effektiv ${g.effRate.toFixed(1)} %</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Monatlich</div>
                <div class="card-value">${fmt(g.gesamt / 12)}</div>
                <div class="card-subtitle">Vorschreibung quartalsweise</div>
            </div>
        </div>

        <div class="card" style="padding:20px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:14px;">Beitragsaufschlüsselung</div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:5px 20px;font-size:13px;max-width:460px;">
                <span>Beitragsgrundlage</span>
                <span style="text-align:right;font-weight:600;">${fmt(g.bgl)}</span>

                <span style="color:var(--text-muted);">× KV ${(this.GSVG.kv*100).toFixed(2)} % (Krankenversicherung)</span>
                <span style="text-align:right;color:var(--danger);">${fmt(g.kvBeitrag)}</span>

                <span style="color:var(--text-muted);">× PV ${(this.GSVG.pv*100).toFixed(1)} % (Pensionsversicherung)</span>
                <span style="text-align:right;color:var(--danger);">${fmt(g.pvBeitrag)}</span>

                <span style="color:var(--text-muted);">+ UV Pauschale (Unfallversicherung)</span>
                <span style="text-align:right;color:var(--danger);">${fmt(g.uvFixed)}</span>

                <div style="grid-column:1/-1;border-top:2px solid var(--border);margin:4px 0;"></div>
                <span style="font-weight:800;font-size:15px;">= GSVG gesamt</span>
                <span style="text-align:right;font-weight:800;font-size:15px;color:var(--danger);">${fmt(g.gesamt)}</span>
            </div>
        </div>

        <div class="card" style="padding:16px;">
            <div style="font-weight:700;font-size:13px;margin-bottom:10px;">Quartalsvorschreibungen</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
                ${['Q1', 'Q2', 'Q3', 'Q4'].map(q => `
                <div style="background:var(--bg-secondary);border-radius:8px;padding:10px 12px;text-align:center;">
                    <div style="font-size:11px;color:var(--text-muted);">${q}</div>
                    <div style="font-weight:700;font-size:14px;">${fmt(g.gesamt / 4)}</div>
                </div>`).join('')}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">
                SVS stellt quartalsweise Vorschreibung aus. Beiträge steuerlich absetzbar.
            </div>
        </div>`;
    },

    // ── ESt ───────────────────────────────────────────────────────
    _calcESt(gewinn) {
        if (!gewinn || gewinn <= 0) return { zvE: 0, est: 0, effRate: 0, gwf: 0 };

        // Gewinnfreibetrag § 10 EStG (Grundfreibetrag bis 33 000 €)
        const gwfBasis = Math.min(gewinn, this.GEWINNFREIBETRAG_GRENZE);
        const gwf = gwfBasis * this.GEWINNFREIBETRAG_SATZ;

        const zvE = Math.max(0, gewinn - gwf);

        let est = 0;
        for (const stufe of this.EST_TARIF) {
            if (zvE <= stufe.von) break;
            const band = Math.min(zvE, stufe.bis) - stufe.von;
            est += band * stufe.satz;
        }

        const effRate = gewinn > 0 ? (est / gewinn * 100) : 0;
        return { zvE, est, effRate, gwf };
    },

    _renderESt() {
        const { gewinn } = this._calcEAR();
        const gsvg = this._calcGSVG(gewinn);
        // GSVG absetzbar → Gewinn für ESt reduziert
        const gewinnNachGSVG = Math.max(0, gewinn - gsvg.gesamt);
        const e = this._calcESt(gewinnNachGSVG);
        const fmt = v => Utils.formatCurrency(v);

        const stufenHtml = this.EST_TARIF.filter(s=>s.bis!==Infinity||gewinnNachGSVG>s.von).map(stufe => {
            if (gewinnNachGSVG <= stufe.von) return '';
            const band = Math.min(gewinnNachGSVG, stufe.bis) - stufe.von;
            if (band <= 0) return '';
            return `<tr>
                <td>${fmt(stufe.von+1)} – ${stufe.bis===Infinity?'darüber':fmt(stufe.bis)}</td>
                <td style="text-align:center;">${(stufe.satz*100).toFixed(0)}%</td>
                <td style="text-align:right;">${fmt(band)}</td>
                <td style="text-align:right;color:var(--danger);">${fmt(band*stufe.satz)}</td>
            </tr>`;
        }).join('');

        const gesamtBelastung = e.est + gsvg.gesamt;
        const gesamtRate = gewinn > 0 ? (gesamtBelastung / gewinn * 100) : 0;

        return `
        <div class="stats-grid" style="margin-bottom:16px;">
            <div class="card stat-card">
                <div class="card-label">Gewinn (EAR)</div>
                <div class="card-value">${fmt(gewinn)}</div>
            </div>
            <div class="card stat-card success">
                <div class="card-label">Gewinnfreibetrag §10</div>
                <div class="card-value">${fmt(e.gwf)}</div>
                <div class="card-subtitle">${(this.GEWINNFREIBETRAG_SATZ*100).toFixed(0)}% bis ${fmt(this.GEWINNFREIBETRAG_GRENZE)}</div>
            </div>
            <div class="card stat-card danger">
                <div class="card-label">Einkommensteuer</div>
                <div class="card-value">${fmt(e.est)}</div>
                <div class="card-subtitle">Effektiv ${e.effRate.toFixed(1)} %</div>
            </div>
            <div class="card stat-card danger">
                <div class="card-label">Gesamtbelastung (ESt+GSVG)</div>
                <div class="card-value">${fmt(gesamtBelastung)}</div>
                <div class="card-subtitle">${gesamtRate.toFixed(1)} % vom Gewinn</div>
            </div>
        </div>

        <div class="card" style="padding:20px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:14px;">Berechnungsweg</div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:4px 20px;font-size:13px;max-width:460px;">
                <span>Gewinn (EAR)</span>
                <span style="text-align:right;font-weight:600;">${fmt(gewinn)}</span>
                <span style="color:var(--text-muted);">− GSVG-Beiträge (abziehbar)</span>
                <span style="text-align:right;color:var(--success);">− ${fmt(gsvg.gesamt)}</span>
                <span style="color:var(--text-muted);">− Gewinnfreibetrag §10 EStG</span>
                <span style="text-align:right;color:var(--success);">− ${fmt(e.gwf)}</span>
                <div style="grid-column:1/-1;border-top:1px solid var(--border);margin:4px 0;"></div>
                <span style="font-weight:600;">= Zu versteuerndes Einkommen (zvE)</span>
                <span style="text-align:right;font-weight:600;">${fmt(e.zvE)}</span>
            </div>
        </div>

        <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px;">
            <div style="padding:12px 16px;font-weight:700;font-size:14px;border-bottom:1px solid var(--border);">
                Steuertarif §33 EStG — Progressionsstufen
            </div>
            <div class="table-container" style="border:none;">
                <table class="data-table">
                    <thead><tr>
                        <th>Einkommensstufe</th>
                        <th style="text-align:center;">Satz</th>
                        <th style="text-align:right;">Bemessungsteil</th>
                        <th style="text-align:right;">Steuer</th>
                    </tr></thead>
                    <tbody>${stufenHtml || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Einkommen unter Grundfreibetrag</td></tr>'}</tbody>
                </table>
            </div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:4px 20px;padding:12px 16px;font-size:13px;border-top:2px solid var(--border);">
                <span style="font-weight:800;">= Einkommensteuer</span>
                <span style="text-align:right;font-weight:800;color:var(--danger);">${fmt(e.est)}</span>
            </div>
        </div>

        <div class="card" style="padding:16px;">
            <div style="font-weight:700;font-size:13px;margin-bottom:10px;">Vorauszahlungen ESt</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
                ${['15. Feb.', '15. Mai', '15. Aug.', '15. Nov.'].map(d => `
                <div style="background:var(--bg-secondary);border-radius:8px;padding:10px 12px;text-align:center;">
                    <div style="font-size:11px;color:var(--text-muted);">${d}</div>
                    <div style="font-weight:700;font-size:14px;">${fmt(e.est / 4)}</div>
                </div>`).join('')}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">
                ⚠️ Vereinfachte Berechnung — kein Steuerberatungsersatz. Kirchenbeitrag, Sonderausgaben, außergewöhnliche Belastungen nicht berücksichtigt.
            </div>
        </div>`;
    },
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'at-tab':  function (tab) { Oesterreich._tab = tab; Oesterreich._rerender(); },
    'at-nav':  function (tab) { Oesterreich._tab = tab; App.navigate('oesterreich'); },
    'at-year': function (e, el) { Oesterreich._year = parseInt(el.value); Oesterreich._rerender(); }
});
