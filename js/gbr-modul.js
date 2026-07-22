// ============================================================
// GbR-Modul — Vollständige GbR-Verwaltung
// Nur sichtbar wenn firmenform = 'GbR' oder 'eGbR'
// ============================================================
const GbrModul = {

    _tab:  'uebersicht',
    _year: new Date().getFullYear(),

    // ── Datenzugriff ─────────────────────────────────────────────
    _getEinst()     { return Store.get('gbr_einstellungen') || {}; },
    _saveEinst(d)   { Store.set('gbr_einstellungen', d); },
    _getVerr()      { return Store.get('gbr_verr') || []; },
    _saveVerr(d)    { Store.set('gbr_verr', d); },
    _getGewSt()     { return Store.get('gbr_gewst') || {}; },
    _saveGewSt(d)   { Store.set('gbr_gewst', d); },

    // ── Jahresgewinn berechnen ────────────────────────────────────
    // Nutzt SteuerBerechnung (Single Source of Truth für USt-Netting, s. js/steuer-berechnung.js),
    // dieselbe Rechenbasis wie euer.js/bilanz.js. Fixt dabei 3 Bugs der Vorversion:
    // 0%-Steuersatz fiel fälschlich auf 19% zurück (SteuerBerechnung behandelt 0% als gültig),
    // Rechnungen/Gutschriften wurden komplett ignoriert, Retouren wurden nicht abgezogen.
    _calcJahresgewinn(year) {
        const y = String(year);
        // GbR ist eigenes USt-Steuersubjekt (§19 UStG-Grenze separat von anderen Companies) —
        // Beträge müssen bei Regelbesteuerung netto in den Gewinn einfließen, USt ist Durchlaufposten.
        const settings = Store.getSettings();
        const isRegel = (settings.ustMode || 'klein') === 'regel';
        const salesRaw  = (Store.getSales     ? Store.getSales(true) : Store.get('sales')     || []);
        const sales     = salesRaw.filter(s => (s.datum||'').startsWith(y) && !s.storniert);
        const purchases = (Store.getPurchases ? Store.getPurchases() : Store.get('purchases') || []).filter(p => (p.datum||'').startsWith(y) && !p.storniert);
        // Fix: las vorher aus totem Key 'ausgaben' statt 'expenses' → Betriebsausgaben waren immer 0.
        const ausgaben  = (Store.getExpenses ? Store.getExpenses() : Store.get('expenses') || []).filter(a => (a.datum||'').startsWith(y));
        const retouren  = (Store.getRetouren ? Store.getRetouren() : []).filter(r => (r.datum||'').startsWith(y));
        const rechInvoices = (Store.getRechInvoices ? Store.getRechInvoices() : []).filter(inv =>
            (inv.datum||'').startsWith(y) && inv.status === 'bezahlt' && !inv._storniert &&
            (inv.typ === 'rechnung' || inv.typ === 'gutschrift'));

        const salesNetting = SteuerBerechnung.nettoSales(sales, isRegel);
        const retNetting   = SteuerBerechnung.nettoRetouren(retouren, salesRaw, isRegel);
        const invNetting   = SteuerBerechnung.nettoRechnungen(rechInvoices);
        const purchNetting = SteuerBerechnung.nettoPurchases(purchases);
        const expNetting   = SteuerBerechnung.nettoExpenses(ausgaben);

        const einnahmen = isRegel
            ? (salesNetting.netto - retNetting.netto) + invNetting.netto
            : (salesNetting.brutto - retNetting.brutto) + invNetting.netto; // Rechnungspositionen sind immer netto gespeichert
        const wareneinkauf = isRegel ? purchNetting.netto : purchNetting.brutto;
        const betriebsausgaben = isRegel ? expNetting.netto : expNetting.brutto;

        // ── §25a UStG Differenzbesteuerung: informative Aufschlüsselung ──────────
        // Rein informativ, kein Einfluss auf gewinn oben (s. euer.js für ausführliche Erläuterung
        // desselben Musters). Maßgeblich für die USt-Schuld ist die USt-Voranmeldung.
        const purchasesById = {};
        purchases.forEach(p => { purchasesById[p.id] = p; });
        (Store.getPurchases ? Store.getPurchases(true) : []).forEach(p => { if (!purchasesById[p.id]) purchasesById[p.id] = p; });
        const diff25aSalesPositionen = sales
            .map(s => ({ sale: s, purchase: purchasesById[s.purchaseId] || (s.purchaseIds && s.purchaseIds[0] ? purchasesById[s.purchaseIds[0]] : null) }))
            .filter(x => x.purchase && x.purchase.differenzbesteuert)
            .map(x => ({
                verkaufspreis: (parseFloat(x.sale.verkaufspreis) || 0) + (parseFloat(x.sale.versandkostenKaeufer) || 0),
                einkaufspreis: parseFloat(x.purchase.einkaufspreis) || 0
            }));
        const diff25aInvoicePositionen = [];
        rechInvoices.forEach(inv => {
            const sign = inv.typ === 'gutschrift' ? -1 : 1;
            (inv.positionen || []).forEach(pos => {
                if (!pos.differenzbesteuert) return;
                const linkedPurch = pos.lagerArtikelId ? purchasesById[pos.lagerArtikelId] : null;
                diff25aInvoicePositionen.push({
                    verkaufspreis: sign * (pos.menge || 0) * (pos.einzelpreis || 0),
                    einkaufspreis: sign * (linkedPurch ? (parseFloat(linkedPurch.einkaufspreis) || 0) : (parseFloat(pos.einkaufspreis) || 0))
                });
            });
        });
        const diff25aPositionen = diff25aSalesPositionen.concat(diff25aInvoicePositionen);
        const diff25aUmsatz = diff25aPositionen.reduce((s, p) => s + p.verkaufspreis, 0);
        const diff25aWareneinkauf = diff25aPositionen.reduce((s, p) => s + p.einkaufspreis, 0);
        const diff25aMargePreview = SteuerBerechnung.margeEinzeldifferenz(diff25aPositionen.map(p => Object.assign({ satz: 19 }, p)));

        return { einnahmen, wareneinkauf, betriebsausgaben, gewinn: einnahmen - wareneinkauf - betriebsausgaben, diff25aUmsatz, diff25aWareneinkauf, diff25aMargePreview };
    },

    // ── Haupt-Render ──────────────────────────────────────────────
    render() {
        if (!GbR.isPersonengesellschaft()) return this._renderNotAvailable();

        const einst = this._getEinst();
        const gs    = GbR.getGesellschafter();
        const year  = this._year;
        const { einnahmen, wareneinkauf, betriebsausgaben, gewinn, diff25aUmsatz, diff25aWareneinkauf, diff25aMargePreview } = this._calcJahresgewinn(year);

        const tabs = [
            ['uebersicht',    '📊', 'Übersicht'],
            ['verrechnung',   '💳', 'Verrechnungskonten'],
            ['gewerbesteuer', '🏛️', 'Gewerbesteuer'],
            ['feststellung',  '📄', 'Feststellung'],
            ['stammdaten',    '⚙️', 'Stammdaten'],
        ];

        return `
        <div>
            <!-- Header -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
                <div>
                    <h2 style="margin:0;">GbR-Verwaltung</h2>
                    <div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">
                        ${Utils.escapeHtml(einst.gbr_name || 'GbR')} · ${Utils.escapeHtml(einst.firmenform || 'GbR')}
                        ${einst.steuernummer ? `· StNr: <span style="font-family:monospace;">${Utils.escapeHtml(einst.steuernummer)}</span>` : ''}
                    </div>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <select class="form-select" id="gbrYearSel" style="padding:6px 10px;font-size:13px;width:auto;">
                        ${[year-2,year-1,year,year+1].map(y=>`<option value="${y}"${y===year?' selected':''}>${y}</option>`).join('')}
                    </select>
                    <button class="btn btn-small" data-action="gbr-open-settings">👥 Gesellschafter</button>
                    <button class="btn btn-small btn-primary" data-action="gbr-open-ausz" data-args='[${year}]' >📅 Auszahlungen</button>
                </div>
            </div>

            <!-- Tab Bar -->
            <div style="display:flex;gap:2px;margin-bottom:20px;background:var(--bg-secondary);border-radius:10px;padding:4px;flex-wrap:wrap;">
                ${tabs.map(([key,icon,label])=>`
                    <button data-gbr-tab="${key}" style="flex:1;min-width:110px;padding:8px 10px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;transition:all .15s;background:${this._tab===key?'var(--bg-card)':'transparent'};color:${this._tab===key?'var(--accent)':'var(--text-secondary)'};box-shadow:${this._tab===key?'0 1px 4px rgba(0,0,0,.2)':'none'};">
                        ${icon} ${label}
                    </button>`).join('')}
            </div>

            <!-- Inhalt -->
            <div id="gbrTabContent">
                ${this._renderTab(gs, { einnahmen, wareneinkauf, betriebsausgaben, gewinn, diff25aUmsatz, diff25aWareneinkauf, diff25aMargePreview }, year)}
            </div>
        </div>`;
    },

    _renderTab(gs, fin, year) {
        switch (this._tab) {
            case 'uebersicht':    return this._renderUebersicht(gs, fin, year);
            case 'verrechnung':   return this._renderVerrechnung(gs, year);
            case 'gewerbesteuer': return this._renderGewerbesteuer(fin.gewinn, year);
            case 'feststellung':  return this._renderFeststellung(gs, fin.gewinn, year);
            case 'stammdaten':    return this._renderStammdaten();
            default:              return this._renderUebersicht(gs, fin, year);
        }
    },

    // ── Übersicht ─────────────────────────────────────────────────
    _renderUebersicht(gs, { einnahmen, wareneinkauf, betriebsausgaben, gewinn, diff25aUmsatz, diff25aWareneinkauf, diff25aMargePreview }, year) {
        const verteilung = GbR.berechneVerteilung(gewinn);
        const gewSt      = GbR.berechneGewSt(gewinn);
        const nettoGewinn = gewinn - gewSt;

        // §141-AO-Hinweis: gewerbliche GbR/eGbR über der Schwelle — Zahlen unten bleiben als
        // Orientierung, tatsächliche Gewinnermittlung läuft dann über Bilanz/GuV, nicht EÜR.
        const ao141Hinweis = (typeof Rechtsform !== 'undefined' && Rechtsform.istGewerblich() && Rechtsform.ueberschreitetAO141Schwelle(year))
            ? `<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;">
                ⚠️ §141-AO-Schwelle überschritten (Umsatz > 800.000 € oder Gewinn > 80.000 €) — voraussichtlich ab dem übernächsten Jahr bilanzierungspflichtig.
                Bilanzierung ist in Stackr in Planung, die Zahlen unten dienen bis dahin nur der Orientierung. Sprich mit deinem Steuerberater.
               </div>`
            : '';

        // V2: ausgezahlt korrekt aus gbr_auszahlungen_v2 lesen
        let totalAusz = 0;
        for (let mIdx = 0; mIdx < 12; mIdx++) {
            const mk = `${year}-${String(mIdx+1).padStart(2,'0')}`;
            gs.forEach(g => { totalAusz += GbR.getTotalAusgezahlt(mk, g.id); });
        }

        return `
        ${ao141Hinweis}
        <!-- KPI-Kacheln -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;margin-bottom:24px;">
            ${this._kpi('Einnahmen '+year,    Utils.formatCurrency(einnahmen),    'var(--success)', '📈')}
            ${this._kpi('Wareneinkauf',       Utils.formatCurrency(wareneinkauf), 'var(--danger)',  '🛒')}
            ${this._kpi('Betriebsausgaben',   Utils.formatCurrency(betriebsausgaben), 'var(--danger)', '💸')}
            ${this._kpi('Jahresgewinn',        Utils.formatCurrency(gewinn),        gewinn>=0?'var(--success)':'var(--danger)', '💰')}
            ${this._kpi('Gewerbesteuer',       Utils.formatCurrency(gewSt),         'var(--warning)', '🏛️')}
            ${this._kpi('Netto-Gewinn',        Utils.formatCurrency(nettoGewinn),   nettoGewinn>=0?'var(--success)':'var(--danger)', '✅')}
            ${this._kpi('Auszahlungen YTD',    Utils.formatCurrency(totalAusz),     'var(--accent)', '📤')}
        </div>
        ${diff25aUmsatz > 0 ? `<div class="card" style="padding:14px 16px;margin-bottom:16px;font-size:12px;color:var(--text-secondary);">
            <strong><i class="ti ti-tag" style="margin-right:4px;"></i> Differenzbesteuerung §25a UStG</strong> — nur Anzeige, keine Auswirkung auf den Jahresgewinn oben.<br>
            Davon Umsätze: ${Utils.formatCurrency(diff25aUmsatz)} · davon Wareneinkauf: ${Utils.formatCurrency(diff25aWareneinkauf)} ·
            Einzeldifferenz-Vorschau Marge: ${Utils.formatCurrency(diff25aMargePreview.margeBrutto)} (USt ${Utils.formatCurrency(diff25aMargePreview.ust)}).
            Maßgeblich für die tatsächliche USt-Schuld ist die <a href="#" data-action="navigate" data-args='["ustvoranmeldung"]'>USt-Voranmeldung</a>.
        </div>` : ''}

        <!-- Gewinnverteilung -->
        <div class="card" style="padding:20px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:16px;">Gewinnverteilung ${year}</div>
            ${gs.length === 0 ? `<div style="text-align:center;padding:24px;color:var(--text-muted);">Noch keine Gesellschafter angelegt — <button class="btn btn-small" data-action="gbr-open-settings">Jetzt anlegen</button></div>` : `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
                ${gs.map(g => {
                    const v = verteilung.find(x=>x.id===g.id) || {};
                    const brutto  = parseFloat(v.gewinnanteil)||0;
                    const gst     = parseFloat(v.gewSt)||0;
                    const netto   = brutto - gst;
                    let ausgezahlt = 0;
                    for (let mIdx = 0; mIdx < 12; mIdx++) {
                        const mk = `${year}-${String(mIdx+1).padStart(2,'0')}`;
                        ausgezahlt += GbR.getTotalAusgezahlt(mk, g.id);
                    }
                    const offen = netto - ausgezahlt;
                    return `
                    <div style="background:var(--bg-secondary);border-radius:10px;padding:16px;border:1px solid var(--border);">
                        <div style="font-weight:700;font-size:14px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                            <span style="width:32px;height:32px;border-radius:50%;background:var(--accent-glow);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:16px;">👤</span>
                            ${Utils.escapeHtml(g.name)}
                            <span style="margin-left:auto;font-size:11px;padding:2px 8px;border-radius:10px;background:var(--accent-glow);color:var(--accent);">${g.anteil}%</span>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr auto;gap:4px 8px;font-size:12px;">
                            <span style="color:var(--text-muted);">Bruttoanteil</span>
                            <span style="text-align:right;font-weight:600;">${Utils.formatCurrency(brutto)}</span>
                            <span style="color:var(--text-muted);">− Gewerbesteuer</span>
                            <span style="text-align:right;color:var(--warning);">− ${Utils.formatCurrency(gst)}</span>
                            <span style="color:var(--text-muted);font-weight:700;padding-top:4px;border-top:1px solid var(--border);">Nettoanteil</span>
                            <span style="text-align:right;font-weight:800;padding-top:4px;border-top:1px solid var(--border);color:var(--success);">${Utils.formatCurrency(netto)}</span>
                            <span style="color:var(--text-muted);">Ausgezahlt</span>
                            <span style="text-align:right;color:var(--accent);">${Utils.formatCurrency(ausgezahlt)}</span>
                            <span style="color:var(--text-muted);font-weight:600;">Noch offen</span>
                            <span style="text-align:right;font-weight:700;color:${offen>0.01?'var(--danger)':'var(--success)'};">${Utils.formatCurrency(Math.max(0,offen))}</span>
                        </div>
                        <button class="btn btn-small btn-primary" style="width:100%;margin-top:12px;"
                            data-action="gm-tab-verrechnung">💸 Auszahlung buchen</button>
                    </div>`;
                }).join('')}
            </div>`}
        </div>

        <!-- Hinweis-Box -->
        <div style="background:var(--info-bg);border:1px solid var(--info);border-radius:8px;padding:12px 16px;font-size:12px;color:var(--text-secondary);">
            <strong style="color:var(--info);">ℹ Gesonderte Feststellungserklärung (Anlage FE)</strong><br>
            Die GbR muss jährlich eine gesonderte und einheitliche Feststellungserklärung beim Finanzamt einreichen.
            Alle benötigten Daten findest du im Tab <strong>Feststellung</strong>.
        </div>`;
    },

    _kpi(label, value, color, icon) {
        return `<div class="card" style="padding:14px 16px;">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">${icon} ${label}</div>
            <div style="font-size:20px;font-weight:800;color:${color};">${value}</div>
        </div>`;
    },

    // ── Verrechnungskonten ────────────────────────────────────────
    _renderVerrechnung(gs, year) {
        const alle   = this._getVerr().filter(b => (b.datum||'').startsWith(String(year)));
        const typen  = { einlage:'Einlage', entnahme:'Entnahme', gewinnanteil:'Gewinnanteil', kosten:'Kosten', sonstiges:'Sonstiges' };
        const isPos  = t => ['einlage','gewinnanteil'].includes(t);

        return `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
            <div>
                <div style="font-weight:700;font-size:15px;">💳 Verrechnungskonten ${year}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Einlagen, Entnahmen und Gewinnzuweisungen je Gesellschafter</div>
            </div>
            <button class="btn btn-primary btn-small" id="addVerrBtn">+ Buchung erfassen</button>
        </div>

        ${gs.length === 0 ? `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted);">Erst Gesellschafter anlegen</div>` :
        gs.map(g => {
            const gb  = alle.filter(b=>b.gsId===g.id).sort((a,b)=>a.datum.localeCompare(b.datum));
            const saldo = gb.reduce((s,b) => isPos(b.typ) ? s+(parseFloat(b.betrag)||0) : s-(parseFloat(b.betrag)||0), 0);
            return `
            <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px;">
                <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:var(--bg-card);">
                    <div style="font-weight:700;">👤 ${Utils.escapeHtml(g.name)} · ${g.anteil}%</div>
                    <div style="font-size:15px;font-weight:800;color:${saldo>=0?'var(--success)':'var(--danger)'};">Saldo: ${Utils.formatCurrency(saldo)}</div>
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;min-width:480px;">
                        <thead><tr style="background:var(--bg-secondary);">
                            <th style="padding:6px 12px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;">Datum</th>
                            <th style="padding:6px 12px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;">Typ</th>
                            <th style="padding:6px 12px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;">Beschreibung</th>
                            <th style="padding:6px 12px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:right;">Betrag</th>
                            <th style="width:36px;"></th>
                        </tr></thead>
                        <tbody>
                        ${gb.length === 0
                            ? `<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">Keine Buchungen für ${year}</td></tr>`
                            : gb.map(b=>`
                            <tr style="border-bottom:1px solid var(--border);">
                                <td style="padding:7px 12px;font-size:12px;white-space:nowrap;">${b.datum}</td>
                                <td style="padding:7px 12px;font-size:12px;">
                                    <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${isPos(b.typ)?'var(--success-bg)':'var(--danger-bg)'};color:${isPos(b.typ)?'var(--success)':'var(--danger)'};">${typen[b.typ]||b.typ}</span>
                                </td>
                                <td style="padding:7px 12px;font-size:12px;color:var(--text-secondary);">${Utils.escapeHtml(b.beschreibung||'—')}</td>
                                <td style="padding:7px 12px;font-size:12px;font-weight:700;text-align:right;white-space:nowrap;color:${isPos(b.typ)?'var(--success)':'var(--danger)'};">${isPos(b.typ)?'+':'−'} ${Utils.formatCurrency(Math.abs(parseFloat(b.betrag)||0))}</td>
                                <td style="padding:7px 8px;text-align:center;"><button style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:13px;" data-action="gm-del-verr" data-args='["${b.id}"]' >🗑</button></td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        }).join('')}`;
    },

    _openAddVerrModal() {
        const gs    = GbR.getGesellschafter();
        const today = new Date().toLocaleDateString('sv-SE');
        App.showModal('Verrechnungsbuchung erfassen', `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Gesellschafter *</label>
                        <select class="form-select" id="verr_gs">
                            ${gs.map(g=>`<option value="${g.id}">${Utils.escapeHtml(g.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Datum *</label>
                        <input type="date" class="form-input" id="verr_datum" value="${today}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Typ *</label>
                        <select class="form-select" id="verr_typ">
                            <option value="einlage">Einlage (+ Konto)</option>
                            <option value="entnahme">Entnahme (− Konto)</option>
                            <option value="gewinnanteil">Gewinnanteil (+ Konto)</option>
                            <option value="kosten">Kosten (− Konto)</option>
                            <option value="sonstiges">Sonstiges</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Betrag (€) *</label>
                        <input type="number" step="0.01" min="0" class="form-input" id="verr_betrag" placeholder="0,00">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Beschreibung</label>
                    <input type="text" class="form-input" id="verr_beschr" placeholder="z.B. Monatliche Entnahme Mai ${this._year}">
                </div>
            </div>`,
        `<button class="btn" data-action="close-modal">Abbrechen</button>
         <button class="btn btn-primary" id="saveVerrBtn">💾 Speichern</button>`);

        document.getElementById('saveVerrBtn').addEventListener('click', () => {
            const gsId   = document.getElementById('verr_gs').value;
            const datum  = Utils.getDateInputValue('verr_datum');
            const typ    = document.getElementById('verr_typ').value;
            const betrag = parseFloat(document.getElementById('verr_betrag').value);
            const beschr = document.getElementById('verr_beschr').value.trim();
            if (!datum||!gsId)               { Utils.showToast('Pflichtfelder ausfüllen','warning'); return; }
            if (!Number.isFinite(betrag)||betrag<0)     { Utils.showToast('Ungültiger Betrag','warning');      return; }
            const all = this._getVerr();
            all.push({ id: Store.generateId(), gsId, datum, typ, betrag, beschreibung: beschr, createdAt: new Date().toISOString() });
            this._saveVerr(all);
            App.closeModal();
            Utils.showToast('✅ Buchung gespeichert','success');
            this._refresh();
        });
    },

    _deleteVerr(id) {
        if (!confirm('Buchung unwiderruflich löschen?')) return;
        this._saveVerr(this._getVerr().filter(b=>b.id!==id));
        Utils.showToast('Buchung gelöscht','success');
        this._refresh();
    },

    // ── Gewerbesteuer ─────────────────────────────────────────────
    _renderGewerbesteuer(gewinn, year) {
        if (typeof Rechtsform !== 'undefined' && !Rechtsform.brauchtGewSt()) {
            return `
            <div class="card" style="padding:20px;">
                <div style="font-weight:700;font-size:15px;margin-bottom:8px;">🏛️ Gewerbesteuer</div>
                <div style="font-size:13px;color:var(--text-secondary);">Keine Gewerbesteuer — als freiberufliche Tätigkeit (§18 EStG) eingestuft, unabhängig von der Rechtsform.</div>
            </div>`;
        }
        const einst       = this._getEinst();
        const hebesatz    = parseFloat(einst.hebesatz) || 400;
        const freibetrag  = 24500;
        const messzahl    = 0.035;
        const stpfl       = Math.max(0, gewinn - freibetrag);
        const messbetrag  = stpfl * messzahl;
        const gewSt       = messbetrag * (hebesatz / 100);

        const data      = this._getGewSt();
        const yearData  = data[year] || { vorauszahlungen: [] };
        const bezahlt   = yearData.vorauszahlungen.reduce((s,v)=>s+(parseFloat(v.betrag)||0), 0);
        const offen     = Math.max(0, gewSt - bezahlt);

        const now  = new Date();
        const qDue = [
            { q:1, datum:`${year}-03-10`, label:`Q1 · bis 10.03.${year}` },
            { q:2, datum:`${year}-06-10`, label:`Q2 · bis 10.06.${year}` },
            { q:3, datum:`${year}-09-10`, label:`Q3 · bis 10.09.${year}` },
            { q:4, datum:`${year}-12-10`, label:`Q4 · bis 10.12.${year}` },
        ];

        return `
        <!-- Berechnung -->
        <div class="card" style="padding:20px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:16px;">🏛️ Gewerbesteuer-Berechnung ${year}</div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:5px 24px;font-size:13px;max-width:420px;">
                <span style="color:var(--text-secondary);">Jahresgewinn (vorläufig)</span>
                <span style="text-align:right;font-weight:600;">${Utils.formatCurrency(gewinn)}</span>
                <span style="color:var(--text-secondary);">− Freibetrag §11 Abs. 1 GewStG</span>
                <span style="text-align:right;color:var(--success);">− ${Utils.formatCurrency(freibetrag)}</span>
                <span style="color:var(--text-secondary);">= Steuerpflichtiger Gewerbeertrag</span>
                <span style="text-align:right;font-weight:600;">${Utils.formatCurrency(stpfl)}</span>
                <span style="color:var(--text-secondary);">× Steuermesszahl (3,5%)</span>
                <span style="text-align:right;">${Utils.formatCurrency(messbetrag)}</span>
                <span style="color:var(--text-secondary);">× Hebesatz (${hebesatz}%)</span>
                <span style="text-align:right;font-weight:800;font-size:17px;color:var(--warning);">${Utils.formatCurrency(gewSt)}</span>
                <div style="grid-column:1/-1;border-top:1px solid var(--border);margin:4px 0;"></div>
                <span style="color:var(--text-secondary);">Vorauszahlungen bezahlt</span>
                <span style="text-align:right;color:var(--success);">${Utils.formatCurrency(bezahlt)}</span>
                <span style="font-weight:700;">Noch offen</span>
                <span style="text-align:right;font-weight:800;color:${offen>0?'var(--danger)':'var(--success)'};">${Utils.formatCurrency(offen)}</span>
            </div>
            <div style="margin-top:10px;font-size:11px;color:var(--text-muted);">⚠ Vorläufige Berechnung auf Basis aktueller Buchungslage. Hebesatz in <strong>Stammdaten</strong> anpassen.</div>
        </div>

        <!-- Quartale Status -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:16px;">
            ${qDue.map(({q, datum, label}) => {
                const vzq     = yearData.vorauszahlungen.filter(v=>v.quartal===q);
                const vzqSum  = vzq.reduce((s,v)=>s+(parseFloat(v.betrag)||0), 0);
                const fällig  = new Date(datum) < now && vzqSum === 0;
                return `<div style="background:${fällig?'var(--danger-bg)':vzqSum>0?'var(--success-bg)':'var(--bg-secondary)'};border:1px solid ${fällig?'var(--danger)':vzqSum>0?'var(--success)':'var(--border)'};border-radius:8px;padding:12px;">
                    <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:3px;">Quartal ${q}</div>
                    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">${label}</div>
                    <div style="font-weight:700;font-size:13px;color:${vzqSum>0?'var(--success)':fällig?'var(--danger)':'var(--text-secondary)'};">
                        ${vzqSum>0 ? '✅ '+Utils.formatCurrency(vzqSum) : fällig ? '⚠️ Fällig!' : '—'}
                    </div>
                </div>`;
            }).join('')}
        </div>

        <!-- Vorauszahlungen Liste -->
        <div class="card" style="padding:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                <div style="font-weight:700;font-size:14px;">Vorauszahlungen ${year}</div>
                <button class="btn btn-small btn-primary" id="addGewStVzBtn">+ Vorauszahlung erfassen</button>
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="border-bottom:1px solid var(--border);">
                    <th style="padding:6px 8px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;">Datum</th>
                    <th style="padding:6px 8px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;">Quartal</th>
                    <th style="padding:6px 8px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:left;">Notizen</th>
                    <th style="padding:6px 8px;font-size:11px;color:var(--text-muted);font-weight:600;text-align:right;">Betrag</th>
                    <th style="width:36px;"></th>
                </tr></thead>
                <tbody>
                ${yearData.vorauszahlungen.length === 0
                    ? `<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text-muted);">Noch keine Vorauszahlungen für ${year}</td></tr>`
                    : yearData.vorauszahlungen.map(v=>`
                    <tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:7px 8px;font-size:12px;">${v.datum}</td>
                        <td style="padding:7px 8px;font-size:12px;">Q${v.quartal}</td>
                        <td style="padding:7px 8px;font-size:12px;color:var(--text-secondary);">${Utils.escapeHtml(v.notizen||'')}</td>
                        <td style="padding:7px 8px;font-size:12px;font-weight:700;text-align:right;">${Utils.formatCurrency(v.betrag)}</td>
                        <td style="padding:7px 8px;text-align:center;"><button style="background:none;border:none;cursor:pointer;font-size:13px;color:var(--text-muted);" data-action="gm-del-gewstvz" data-args='[${year},"${v.id}"]' >🗑</button></td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    },

    _openAddGewStVzModal(year) {
        const today = new Date().toLocaleDateString('sv-SE');
        const m = new Date().getMonth();
        const defQ = m < 3 ? 1 : m < 6 ? 2 : m < 9 ? 3 : 4;
        App.showModal('Gewerbesteuer-Vorauszahlung', `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Datum *</label>
                        <input type="date" class="form-input" id="vz_datum" value="${today}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Quartal *</label>
                        <select class="form-select" id="vz_quartal">
                            ${[1,2,3,4].map(q=>`<option value="${q}"${q===defQ?' selected':''}>Q${q}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Betrag (€) *</label>
                    <input type="number" step="0.01" min="0" class="form-input" id="vz_betrag" placeholder="0,00">
                </div>
                <div class="form-group">
                    <label class="form-label">Notizen</label>
                    <input type="text" class="form-input" id="vz_notizen" placeholder="Optional">
                </div>
            </div>`,
        `<button class="btn" data-action="close-modal">Abbrechen</button>
         <button class="btn btn-primary" id="saveVzBtn">💾 Speichern</button>`);

        document.getElementById('saveVzBtn').addEventListener('click', () => {
            const datum   = Utils.getDateInputValue('vz_datum');
            const quartal = parseInt(document.getElementById('vz_quartal').value);
            const betrag  = parseFloat(document.getElementById('vz_betrag').value);
            const notizen = document.getElementById('vz_notizen').value.trim();
            if (!datum)              { Utils.showToast('Datum angeben','warning');   return; }
            if (!Number.isFinite(betrag)||betrag<=0) { Utils.showToast('Betrag angeben','warning'); return; }
            const d = this._getGewSt();
            if (!d[year]) d[year] = { vorauszahlungen: [] };
            d[year].vorauszahlungen.push({ id: Store.generateId(), datum, quartal, betrag, notizen, createdAt: new Date().toISOString() });
            this._saveGewSt(d);
            App.closeModal();
            Utils.showToast('✅ Vorauszahlung gespeichert','success');
            this._refresh();
        });
    },

    _deleteGewStVz(year, id) {
        if (!confirm('Vorauszahlung löschen?')) return;
        const d = this._getGewSt();
        if (d[year]) d[year].vorauszahlungen = (d[year].vorauszahlungen||[]).filter(v=>v.id!==id);
        this._saveGewSt(d);
        Utils.showToast('Gelöscht','success');
        this._refresh();
    },

    // ── Feststellungserklärung ────────────────────────────────────
    _renderFeststellung(gs, gewinn, year) {
        const einst      = this._getEinst();
        const verteilung = GbR.berechneVerteilung(gewinn);
        const gewSt      = GbR.berechneGewSt(gewinn);
        const anteilSum  = gs.reduce((s,g)=>s+(parseFloat(g.anteil)||0),0);

        const checks = [
            { ok: !!einst.gbr_name,                         label:'GbR-Name eingetragen',                  hint:'→ Tab Stammdaten' },
            { ok: !!einst.steuernummer,                     label:'Steuernummer der GbR',                   hint:'→ Tab Stammdaten' },
            { ok: !!einst.finanzamt,                        label:'Zuständiges Finanzamt',                  hint:'→ Tab Stammdaten' },
            { ok: gs.length >= 2,                           label:'Mindestens 2 Gesellschafter',            hint:'→ Gesellschafter bearbeiten' },
            { ok: gs.every(g=>parseFloat(g.anteil)>0),     label:'Gewinnanteil % pro Gesellschafter',      hint:'→ Gesellschafter – Anteile' },
            { ok: Math.abs(anteilSum-100)<0.01,             label:'Anteile ergeben 100%',                   hint:`Aktuell: ${anteilSum.toFixed(1)}%` },
            { ok: gs.every(g=>!!g.adresse),                 label:'Alle Adressen der Gesellschafter',       hint:'→ Gesellschafter bearbeiten' },
            { ok: !!einst.gruendungsdatum,                  label:'Gründungsdatum hinterlegt',              hint:'→ Tab Stammdaten' },
        ];
        const allOk = checks.every(c=>c.ok);

        return `
        <!-- Checkliste -->
        <div class="card" style="padding:20px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px;">📄 Feststellungserklärung ${year}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">Gesonderte & einheitliche Gewinnfeststellung (Anlage FE / GbR-Steuererklärung)</div>

            ${checks.map(c=>`
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
                <span style="font-size:15px;flex-shrink:0;">${c.ok?'✅':'❌'}</span>
                <span style="flex:1;font-size:13px;${c.ok?'':'color:var(--danger);font-weight:600;'}">${c.label}</span>
                ${!c.ok?`<span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${c.hint}</span>`:''}
            </div>`).join('')}

            <div style="margin-top:14px;">
            ${allOk
                ? `<div style="background:var(--success-bg);border:1px solid var(--success);border-radius:8px;padding:12px;font-size:13px;color:var(--success);font-weight:600;">✅ Alle Pflichtangaben vollständig – Export bereit</div>`
                : `<div style="background:var(--warning-bg);border:1px solid var(--warning);border-radius:8px;padding:12px;font-size:13px;color:var(--warning);">⚠ Fehlende Angaben in <strong>Stammdaten</strong> oder <strong>Gesellschafter</strong> ergänzen</div>`}
            </div>
        </div>

        <!-- Datenübersicht -->
        <div class="card" style="padding:20px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:16px;">📊 Datenübersicht für ELSTER / Steuerberater</div>
            <div style="background:var(--bg-secondary);border-radius:8px;padding:16px;font-size:12px;line-height:2;font-family:monospace;">
                <div><strong>GbR-Bezeichnung:</strong>&nbsp; ${Utils.escapeHtml(einst.gbr_name||'—')}</div>
                <div><strong>Rechtsform:</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${Utils.escapeHtml(einst.firmenform||'GbR')}</div>
                <div><strong>Steuernummer:</strong>&nbsp;&nbsp;&nbsp;&nbsp; ${Utils.escapeHtml(einst.steuernummer||'—')}</div>
                <div><strong>Finanzamt:</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${Utils.escapeHtml(einst.finanzamt||'—')}</div>
                <div><strong>Wirtschaftsjahr:</strong>&nbsp;&nbsp; ${year}</div>
                <div><strong>Gewinnermittlung:</strong>&nbsp; EÜR gem. §4 Abs. 3 EStG</div>
                <div style="border-top:1px solid var(--border);margin:6px 0;"></div>
                <div><strong>Gesamtgewinn:</strong>&nbsp;&nbsp;&nbsp;&nbsp; ${Utils.formatCurrency(gewinn)}</div>
                <div><strong>Gewerbesteuer:</strong>&nbsp;&nbsp;&nbsp; ${Utils.formatCurrency(gewSt)}</div>
                <div><strong>Netto-Gewinn:</strong>&nbsp;&nbsp;&nbsp;&nbsp; ${Utils.formatCurrency(gewinn-gewSt)}</div>
                <div style="border-top:1px solid var(--border);margin:6px 0;"></div>
                ${gs.map(g=>{
                    const v = verteilung.find(x=>x.id===g.id)||{};
                    const rolleLabel = g.rolle && g.rolle !== 'gesellschafter' ? ` [${g.rolle}]` : '';
                    return `<div><strong>${Utils.escapeHtml(g.name)}${rolleLabel} (${g.anteil}%):</strong>&nbsp; Brutto ${Utils.formatCurrency(v.gewinnanteil||0)} · Netto ${Utils.formatCurrency((v.gewinnanteil||0)-(v.gewSt||0))}</div>`;
                }).join('')}
            </div>
            <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
                <button class="btn btn-primary" id="exportFestBtn">📥 CSV exportieren</button>
                <button class="btn" data-action="print-page">🖨 Drucken / PDF</button>
            </div>
        </div>

        <!-- Deadlines -->
        <div class="card" style="padding:16px;">
            <div style="font-weight:700;font-size:13px;margin-bottom:10px;">📆 Wichtige Fristen für ${year+1}</div>
            <div style="font-size:12px;display:flex;flex-direction:column;gap:6px;">
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-secondary);">Steuererklärungen (ohne StB)</span><span style="font-weight:600;">31.07.${year+1}</span></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-secondary);">Steuererklärungen (mit Steuerberater)</span><span style="font-weight:600;">28.02.${year+2}</span></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-secondary);">Gewerbesteuererklärung</span><span style="font-weight:600;">31.05.${year+1}</span></div>
                <div style="display:flex;justify-content:space-between;padding:5px 0;"><span style="color:var(--text-secondary);">USt-Voranmeldungen</span><span style="font-weight:600;">Quartalsweise</span></div>
            </div>
        </div>`;
    },

    _exportFeststellung(year) {
        const einst      = this._getEinst();
        const gs         = GbR.getGesellschafter();
        const { gewinn } = this._calcJahresgewinn(year);
        const verteilung = GbR.berechneVerteilung(gewinn);
        const gewSt      = GbR.berechneGewSt(gewinn);
        const rows = [
            ['Feststellungserklärung Export',`Stand: ${new Date().toLocaleDateString('de-DE')}`],
            ['Gesellschaftsname', einst.gbr_name||''],
            ['Rechtsform', einst.firmenform||'GbR'],
            ['Handelsregister', einst.handelsregisterNr ? (einst.handelsregisterNr + ' / ' + (einst.handelsregisterGericht||'')) : '—'],
            ['Steuernummer', einst.steuernummer||''],
            ['Finanzamt', einst.finanzamt||''],
            ['Wirtschaftsjahr', year],
            ['Gewinnermittlung', 'EÜR §4 Abs. 3 EStG'],
            [''],
            ['GEWINNERMITTLUNG','',''],
            ['Gesamtgewinn', gewinn.toFixed(2),'€'],
            ['Gewerbesteuer', gewSt.toFixed(2),'€'],
            ['Netto-Gewinn', (gewinn-gewSt).toFixed(2),'€'],
            [''],
            ['GESELLSCHAFTER','Rolle','Anteil %','Bruttoanteil €','GewSt-Anteil €','Nettoanteil €'],
            ...gs.map(g=>{
                const v = verteilung.find(x=>x.id===g.id)||{};
                return [g.name, g.rolle||'gesellschafter', g.anteil, (v.gewinnanteil||0).toFixed(2), (v.gewSt||0).toFixed(2), ((v.gewinnanteil||0)-(v.gewSt||0)).toFixed(2)];
            })
        ];
        if (typeof Utils.downloadCSV === 'function') {
            Utils.downloadCSV(rows, `feststellung_gbr_${year}.csv`);
            Utils.showToast('CSV exportiert','success');
        }
    },

    // ── Stammdaten ────────────────────────────────────────────────
    _renderStammdaten() {
        const e = this._getEinst();
        return `
        <div class="card" style="padding:24px;max-width:640px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:20px;">⚙️ GbR-Stammdaten</div>
            <div style="display:flex;flex-direction:column;gap:14px;">

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">GbR-Name *</label>
                        <input type="text" class="form-input" id="st_name" value="${Utils.escapeHtml(e.gbr_name||'')}" placeholder="z.B. Müller & Schmidt GbR">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Rechtsform</label>
                        <select class="form-select" id="st_form">
                            <option value="GbR"  ${e.firmenform==='GbR' ?'selected':''}>GbR</option>
                            <option value="eGbR" ${e.firmenform==='eGbR'?'selected':''}>eGbR (eingetragene GbR)</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Steuernummer der GbR</label>
                        <input type="text" class="form-input" id="st_stnr" value="${Utils.escapeHtml(e.steuernummer||'')}" placeholder="z.B. 12/345/67890">
                        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">Separate StNr der GbR – nicht die der Gesellschafter</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Zuständiges Finanzamt</label>
                        <input type="text" class="form-input" id="st_fa" value="${Utils.escapeHtml(e.finanzamt||'')}" placeholder="z.B. Finanzamt München">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Gründungsdatum</label>
                        <input type="date" class="form-input" id="st_gruend" value="${e.gruendungsdatum||''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">GbR-Vertrag Datum</label>
                        <input type="date" class="form-input" id="st_vertrag" value="${e.vertragsdatum||''}">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">IBAN Geschäftskonto GbR</label>
                        <input type="text" class="form-input" id="st_iban" value="${Utils.escapeHtml(e.iban||'')}" placeholder="DE00 0000 0000 0000 0000 00">
                        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">Eigenes Konto auf GbR-Namen (Pflicht)</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Gewerbesteuer-Hebesatz (%)</label>
                        <input type="number" class="form-input" id="st_hebesatz" value="${e.hebesatz||400}" min="200" max="900">
                        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">Ortsabhängig – z.B. München 490%, Berlin 410%</div>
                    </div>
                </div>

                ${e.firmenform==='eGbR'?`
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">eGbR Registernummer</label>
                        <input type="text" class="form-input" id="st_regnr" value="${Utils.escapeHtml(e.eGbrRegisternummer||'')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">eGbR Registergericht</label>
                        <input type="text" class="form-input" id="st_regg" value="${Utils.escapeHtml(e.eGbrRegistergericht||'')}">
                    </div>
                </div>`:''}

                <div style="background:var(--info-bg);border:1px solid var(--info);border-radius:8px;padding:12px;font-size:12px;color:var(--text-secondary);">
                    <strong style="color:var(--info);">📋 Hinweis zur GbR-Steuernummer:</strong><br>
                    Die GbR benötigt eine <strong>eigene Steuernummer</strong> (getrennt von den Gesellschaftern).
                    Beantragen über den <em>Fragebogen zur steuerlichen Erfassung</em> via ELSTER.
                </div>

                <button class="btn btn-primary" id="saveStammdatenBtn" style="align-self:flex-start;min-width:160px;">💾 Stammdaten speichern</button>
            </div>
        </div>`;
    },

    _saveStammdaten() {
        const e = this._getEinst();
        const g = id => document.getElementById(id)?.value ?? null;
        e.gbr_name        = (g('st_name')     ||'').trim() || e.gbr_name;
        e.firmenform      = g('st_form')      || e.firmenform;
        e.steuernummer    = (g('st_stnr')     ||'').trim();
        e.finanzamt       = (g('st_fa')       ||'').trim();
        e.gruendungsdatum = Utils.getDateInputValue('st_gruend') || '';
        e.vertragsdatum   = Utils.getDateInputValue('st_vertrag') || '';
        e.iban            = (g('st_iban')     ||'').trim();
        e.hebesatz        = parseFloat(g('st_hebesatz')) || 400;
        if (g('st_regnr') !== null) e.eGbrRegisternummer  = g('st_regnr').trim();
        if (g('st_regg')  !== null) e.eGbrRegistergericht = g('st_regg').trim();
        this._saveEinst(e);
        Utils.showToast('✅ Stammdaten gespeichert','success');
        this._refresh();
    },

    // ── Nicht verfügbar ───────────────────────────────────────────
    _renderNotAvailable() {
        return `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:55vh;text-align:center;padding:40px;">
            <div style="font-size:52px;margin-bottom:16px;">🤝</div>
            <h2 style="margin-bottom:10px;color:var(--text-primary);">Gesellschafter-Modul nicht aktiv</h2>
            <p style="color:var(--text-secondary);max-width:400px;margin-bottom:24px;line-height:1.6;">
                Dieses Modul ist für <strong>Personengesellschaften</strong> verfügbar (GbR, eGbR, OHG, KG, GmbH & Co. KG).
                Rechtsform in den Einstellungen ändern.
            </p>
            <button class="btn btn-primary" style="min-width:180px;" data-action="navigate" data-args=\'["rechtsform"]\'>Rechtsform wählen</button>
        </div>`;
    },

    // ── Refresh & Init ────────────────────────────────────────────
    _refresh() {
        const el = document.getElementById('content');
        if (!el) return;
        el.innerHTML = this.render();
        this.init();
    },

    init() {
        // Jahr-Selektor
        const ys = document.getElementById('gbrYearSel');
        if (ys) ys.addEventListener('change', () => { this._year = parseInt(ys.value); this._refresh(); });

        // Tab-Wechsel (nur Tab-Buttons im Content, nicht Sidebar-Links)
        const contentEl = document.getElementById('content');
        if (contentEl) contentEl.querySelectorAll('[data-gbr-tab]').forEach(btn => {
            btn.addEventListener('click', () => { this._tab = btn.dataset.gbrTab; this._refresh(); });
        });

        // Verrechnungskonten
        const addVerrBtn = document.getElementById('addVerrBtn');
        if (addVerrBtn) addVerrBtn.addEventListener('click', () => this._openAddVerrModal());

        // GewSt Vorauszahlungen
        const addVzBtn = document.getElementById('addGewStVzBtn');
        if (addVzBtn) addVzBtn.addEventListener('click', () => this._openAddGewStVzModal(this._year));

        // Stammdaten speichern
        const saveStBtn = document.getElementById('saveStammdatenBtn');
        if (saveStBtn) saveStBtn.addEventListener('click', () => this._saveStammdaten());

        // Feststellung exportieren
        const exportBtn = document.getElementById('exportFestBtn');
        if (exportBtn) exportBtn.addEventListener('click', () => this._exportFeststellung(this._year));
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'gm-tab-verrechnung': function () { GbrModul._tab = 'verrechnung'; GbrModul._refresh(); },
    'gm-del-verr':        function (id) { GbrModul._deleteVerr(id); },
    'gm-del-gewstvz':     function (year, id) { GbrModul._deleteGewStVz(year, id); }
});
