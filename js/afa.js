// ============================================
// AfA – Anlagenverzeichnis & Abschreibungen
// §7 EStG – Lineare & Degressive Abschreibung
// ============================================
const Afa = {
    _selectedYear: new Date().getFullYear(),

    // Berechnet AfA für eine Anlage in einem bestimmten Jahr
    _calcJahresAfa(asset, year) {
        if (asset.storniert) return 0;
        const ak = parseFloat(asset.anschaffungskosten) || 0;
        const nd = parseInt(asset.nutzungsdauer) || 1;
        const kaufDatum = new Date(asset.anschaffungsdatum);
        const kaufJahr = kaufDatum.getFullYear();
        const kaufMonat = kaufDatum.getMonth(); // 0-indexed

        if (year < kaufJahr) return 0;
        if (year > kaufJahr + nd) return 0; // vollständig abgeschrieben (inkl. anteiliges Abschlussjahr)

        if (asset.methode === 'degressiv') {
            // Degressiver AfA-Satz hängt gesetzlich vom Anschaffungsjahr ab (§7 Abs. 2 EStG):
            //  2020–2022: 2,5×/max 25%  ·  2024: 2,0×/max 20% (Wachstumschancengesetz)
            //  2025–2027: 3,0×/max 30%  ·  sonst degressiv nicht zulässig → konservativ 2,0×/20%
            const linRate = 1 / nd;
            let degFactor = 2.0, degCap = 0.20;
            if (kaufJahr >= 2020 && kaufJahr <= 2022)      { degFactor = 2.5; degCap = 0.25; }
            else if (kaufJahr === 2024)                    { degFactor = 2.0; degCap = 0.20; }
            else if (kaufJahr >= 2025 && kaufJahr <= 2027) { degFactor = 3.0; degCap = 0.30; }
            const degRate = Math.min(linRate * degFactor, degCap);
            let bw = ak;
            for (let y = kaufJahr; y < year; y++) {
                const afa = y === kaufJahr
                    ? bw * degRate * ((12 - kaufMonat) / 12)
                    : bw * degRate;
                bw -= afa;
                if (bw < 0) bw = 0;
            }
            const thisYearAfa = year === kaufJahr
                ? bw * degRate * ((12 - kaufMonat) / 12)
                : bw * degRate;
            // Wechsel zu linear wenn linear höher (Optimierung)
            const verbleibend = (kaufJahr + nd) - year;
            const linearNow = verbleibend > 0 ? bw / verbleibend : 0;
            return Math.max(thisYearAfa, linearNow);
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

    // Buchwert zum 31.12. des Jahres
    _buchwertEnde(asset, year) {
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

            return `<tr>
                <td>${Utils.escapeHtml(a.bezeichnung)}</td>
                <td>${Utils.formatDate(a.anschaffungsdatum)}</td>
                <td style="text-align:right">${Utils.formatCurrency(ak)}</td>
                <td style="text-align:center">${nd} J.</td>
                <td style="text-align:center">${a.methode === 'degressiv' ? 'Degr.' : 'Linear'}</td>
                <td style="text-align:right;color:var(--danger)">${afaJahr > 0 ? '−' + Utils.formatCurrency(afaJahr) : '–'}</td>
                <td style="text-align:right">
                    ${Utils.formatCurrency(bwEnde)}
                    <div style="height:4px;background:var(--border);border-radius:2px;margin-top:3px;">
                        <div style="height:4px;border-radius:2px;background:${bwEnde > 0 ? 'var(--accent)' : 'var(--success)'};width:${100 - abbPct}%"></div>
                    </div>
                </td>
                <td style="text-align:center;font-size:11px;color:var(--text-muted)">${fertigJahr}</td>
                <td>
                    ${Store.isPeriodLocked(a.anschaffungsdatum)
                        ? `<span title="Jahr festgeschrieben — nur Storno möglich" style="font-size:11px;opacity:.7;"><i class="ti ti-lock"></i></span>
                           <button class="btn btn-sm btn-danger" onclick="Afa._stornoAnlage('${a.id}')" title="Stornieren"><i class="ti ti-trash"></i></button>`
                        : `<button class="btn btn-sm" onclick="Afa._editAnlage('${a.id}')" title="Bearbeiten"><i class="ti ti-pencil"></i></button>
                           <button class="btn btn-sm btn-danger" onclick="Afa._stornoAnlage('${a.id}')" title="Stornieren"><i class="ti ti-trash"></i></button>`}
                </td>
            </tr>`;
        }).join('');

        const emptyRow = aktive.length === 0
            ? `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px;">Noch keine Wirtschaftsgüter erfasst</td></tr>`
            : '';

        // Kumulierte AfA aller Jahre für Gesamtübersicht
        const kaufJahre = [...new Set(aktive.map(a => new Date(a.anschaffungsdatum).getFullYear()))].sort();
        const minJahr = kaufJahre.length > 0 ? Math.min(...kaufJahre) : year;

        return `
        <div class="page-header">
            <h2>AfA – Abschreibungen</h2>
            <div class="page-header-actions no-print">
                <select class="form-select" id="afaYear" style="width:100px;">${yearOptions}</select>
                <button class="btn" onclick="Afa._exportCSV()">CSV Export</button>
                <button class="btn btn-primary" onclick="Afa._openForm()">+ Anlage erfassen</button>
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
                <strong>Degressive AfA:</strong> 2,5-facher Linearsatz, max. 25 % p.a.; gilt für Anschaffungen bis 31.12.2007 sowie wieder ab 1.1.2023.<br>
                <strong>Anteilige AfA:</strong> Im Anschaffungsjahr nur für verbleibende volle Monate (Monatsregel).<br>
                <strong>⚠️ Unverbindlich</strong> – Prüfung durch Steuerberater empfohlen.
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

        App.showModal(`
            <h3 style="margin:0 0 16px;">${isEdit ? 'Anlage bearbeiten' : '+ Neue Anlage erfassen'}</h3>
            <div class="form-group">
                <label class="form-label">Bezeichnung *</label>
                <input type="text" class="form-input" id="afa_bez" value="${Utils.escapeHtml(existing.bezeichnung || '')}" placeholder="z.B. Laptop, Kamera, PKW ...">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Anschaffungsdatum *</label>
                    <input type="date" class="form-input" id="afa_datum" value="${existing.anschaffungsdatum || today}">
                </div>
                <div class="form-group">
                    <label class="form-label">Anschaffungskosten (€) *</label>
                    <input type="number" class="form-input" id="afa_ak" step="0.01" min="0" value="${existing.anschaffungskosten || ''}" placeholder="0,00">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Nutzungsdauer (Jahre) *</label>
                    <input type="number" class="form-input" id="afa_nd" min="1" max="50" value="${existing.nutzungsdauer || 3}" placeholder="3">
                    <div class="form-hint">Richtwerte: PC/Laptop 3 J. · PKW 6 J. · Möbel 13 J.</div>
                </div>
                <div class="form-group">
                    <label class="form-label">Abschreibungsmethode</label>
                    <select class="form-select" id="afa_methode">
                        <option value="linear" ${(existing.methode || 'linear') === 'linear' ? 'selected' : ''}>Linear (gleichmäßig)</option>
                        <option value="degressiv" ${existing.methode === 'degressiv' ? 'selected' : ''}>Degressiv (fallend)</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Kategorie / Notiz</label>
                <input type="text" class="form-input" id="afa_notiz" value="${Utils.escapeHtml(existing.notiz || '')}" placeholder="z.B. Büroausstattung, Fahrzeug, IT-Equipment ...">
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                <button class="btn" onclick="App.closeModal()">Abbrechen</button>
                <button class="btn btn-primary" onclick="Afa._saveForm('${existing.id || ''}')">Speichern</button>
            </div>
        `);
    },

    _editAnlage(id) { this._openForm(id); },

    _saveForm(existingId) {
        const bez = document.getElementById('afa_bez')?.value?.trim();
        const datum = document.getElementById('afa_datum')?.value;
        const ak = parseFloat(document.getElementById('afa_ak')?.value) || 0;
        const nd = parseInt(document.getElementById('afa_nd')?.value) || 0;
        const methode = document.getElementById('afa_methode')?.value || 'linear';
        const notiz = document.getElementById('afa_notiz')?.value?.trim();

        if (!bez) { Utils.showToast('Bezeichnung fehlt', 'error'); return; }
        if (!datum) { Utils.showToast('Datum fehlt', 'error'); return; }
        if (ak <= 0) { Utils.showToast('Anschaffungskosten fehlen', 'error'); return; }
        if (nd < 1) { Utils.showToast('Nutzungsdauer muss ≥ 1 sein', 'error'); return; }

        const item = {
            id: existingId || undefined,
            bezeichnung: bez,
            anschaffungsdatum: datum,
            anschaffungskosten: ak,
            nutzungsdauer: nd,
            methode,
            notiz: notiz || ''
        };

        Store.saveAfaAnlage(item);
        App.closeModal();
        Utils.showToast(existingId ? 'Anlage aktualisiert' : 'Anlage erfasst', 'success');
        this._refresh();
    },

    _stornoAnlage(id) {
        const anlage = Store.getAfaAnlagen().find(a => a.id === id);
        if (!anlage) return;
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
