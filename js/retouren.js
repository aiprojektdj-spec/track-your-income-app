// ============================================
// Retouren Module - Return Management
// ============================================
const Retouren = {
    _filterYear: String(new Date().getFullYear()),
    _busy: false,

    // ── Fachvorgang Retoure (Audit 2026-10-13, L4) ──────────────────────────────────────
    // Bis dahin stornierte JEDE verknüpfte Retoure den ganzen Verkauf. 100 € Verkauf und 20 €
    // Erstattung ergaben 0 € Einnahme statt 80 €, und eine Rückzahlung im Januar löschte den
    // Dezember-Zufluss des Vorjahres. Jetzt drei getrennte Sachverhalte:
    //   1. Der Verkauf bleibt als Zufluss stehen (§11 EStG) — er wird NICHT storniert.
    //   2. Die Erstattung ist eine eigene, datierte Rückzahlung (r.erstattungBetrag zu r.datum);
    //      EÜR, UVA und §25a lesen sie dort (bei §25a als §17-Berichtigung mit Vorzeichen).
    //   3. Die Lagerbewegung betrifft nur die tatsächlich zurückgekommenen Artikel:
    //      'zurueck' → wieder verfügbar, 'defekt' → Status "Beschädigt", 'keine' → nichts.
    //      Der Einkauf bleibt eine Ausgabe; er wird nicht storniert.
    // Vorhandene Retouren nach altem Muster (Verkauf storniert) bleiben, wie sie sind; die
    // Auswertungen erkennen sie am stornierten Verkauf.
    _WARE: { zurueck: 'Unbeschädigt', defekt: 'Beschädigt', keine: 'Keine Ware zurück' },

    _saleBrutto(sale) {
        return (parseFloat(sale.verkaufspreis) || 0) + (parseFloat(sale.versandkostenKaeufer) || 0);
    },
    _bisherErstattet(saleId) {
        return Store.getRetouren().filter(r => r.saleId === saleId)
            .reduce((s, r) => s + (parseFloat(r.erstattungBetrag) || 0), 0);
    },
    _setzeArtikelStatus(pids, status, grund) {
        const purchases = Store.getAllPurchasesRaw();
        const vorher = [];
        pids.forEach(pid => {
            const p = purchases.find(x => x.id === pid);
            if (!p || p.storniert) return;
            const alt = Object.assign({}, p);
            vorher.push({ id: pid, status: p.status });
            p.status = status;
            Store._stampRecord(p);
            Store._addAuditEntry('lager-status', 'einkauf', pid, alt, p, grund);
        });
        if (vorher.length) Store.set('purchases', purchases);
        return vorher;
    },

    // eingabe: { datum, saleId, erstattungBetrag, ware: 'zurueck'|'defekt'|'keine', artikelIds,
    //            vkPreis, marke, artikeltyp, notizen }
    // Rückgabe: { ok, retoure } oder { ok:false, fehler }. Schreibt erst, wenn alles geprüft ist,
    // und nimmt die Retoure zurück, falls die Lagerbuchung danach scheitert.
    buche(e) {
        const erstattung = parseFloat(e.erstattungBetrag);
        if (!e.datum) return { ok: false, fehler: 'Datum fehlt' };
        if (!Number.isFinite(erstattung) || erstattung < 0) return { ok: false, fehler: 'Ungültige Erstattung' };
        const ware = this._WARE[e.ware] ? e.ware : 'keine';
        let sale = null, artikelIds = [];
        if (e.saleId) {
            sale = Store.getSales(true).find(s => s.id === e.saleId);
            if (!sale) return { ok: false, fehler: 'Verkauf nicht gefunden' };
            if (sale.storniert) return { ok: false, fehler: 'Der Verkauf ist storniert' };
            const offen = this._saleBrutto(sale) - this._bisherErstattet(sale.id);
            if (erstattung > offen + 0.005) {
                return { ok: false, fehler: 'Erstattung über dem noch nicht erstatteten Verkaufsbetrag (' + offen.toFixed(2).replace('.', ',') + ' €)' };
            }
            const verknuepft = sale.purchaseIds ? sale.purchaseIds : (sale.purchaseId ? [sale.purchaseId] : []);
            artikelIds = ware === 'keine' ? []
                : (Array.isArray(e.artikelIds) ? e.artikelIds.filter(id => verknuepft.indexOf(id) !== -1) : verknuepft);
            if (ware !== 'keine' && verknuepft.length && !artikelIds.length) return { ok: false, fehler: 'Bitte die zurückgekommenen Artikel auswählen' };
        }
        const r = {
            datum: e.datum, marke: e.marke || (sale && sale.marke) || '', artikeltyp: e.artikeltyp || (sale && sale.artikeltyp) || '',
            zustand: this._WARE[ware], ware, artikelIds,
            vkPreis: parseFloat(e.vkPreis) || (sale ? this._saleBrutto(sale) : 0),
            erstattungBetrag: Math.round(erstattung * 100) / 100,
            notizen: e.notizen || '', saleId: sale ? sale.id : null, modell: 2
        };
        const gespeichert = Store.saveRetoure(r);
        if (!gespeichert) return { ok: false, fehler: 'Retoure nicht gespeichert' };
        try {
            if (artikelIds.length) {
                const grund = 'Retoure ' + (gespeichert.nummer || '') + ': ' + r.zustand;
                this._setzeArtikelStatus(artikelIds, ware === 'zurueck' ? 'verfuegbar' : 'beschadigt', grund);
            }
        } catch (err) {
            // Kompensation: kein halbfertiger Vorgang — Retoure wieder entfernen
            Store.deleteRetoure(gespeichert.id);
            return { ok: false, fehler: 'Lagerbuchung fehlgeschlagen — Retoure nicht gespeichert' };
        }
        return { ok: true, retoure: gespeichert };
    },

    // Löschen nimmt die Lagerbewegung zurück, soweit der Artikel seitdem nicht weiterverkauft wurde.
    loesche(id) {
        const r = Store.getRetouren().find(x => x.id === id);
        if (!r) return;
        if (r.modell === 2 && (r.artikelIds || []).length) {
            const erwartet = r.ware === 'zurueck' ? 'verfuegbar' : 'beschadigt';
            const purchases = Store.getAllPurchasesRaw();
            const zurueck = r.artikelIds.filter(pid => { const p = purchases.find(x => x.id === pid); return p && p.status === erwartet; });
            if (zurueck.length) this._setzeArtikelStatus(zurueck, 'verkauft', 'Retoure ' + (r.nummer || '') + ' gelöscht');
        }
        Store.deleteRetoure(id);
    },

    render() {
        const retouren = Store.getRetouren();
        const year = this._filterYear;
        const filtered = year === 'all' ? retouren : retouren.filter(r => (r.datum || '').startsWith(year));
        filtered.sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

        const totalErstattet = filtered.reduce((s, r) => s + (parseFloat(r.erstattungBetrag) || 0), 0);
        const years = Array.from(new Set(retouren.map(r => (r.datum || '').substring(0, 4)).filter(Boolean))).sort().reverse();
        const yearOpts = ['all', ...years].map(y =>
            `<option value="${y}" ${this._filterYear === y ? 'selected' : ''}>${y === 'all' ? 'Alle Jahre' : y}</option>`
        ).join('');

        // Sales dropdown: recent non-storniert sales for linking
        // Fix: Sales aus Rechnungen (_invoiceId) ausgeschlossen — eine Retoure storniert den Sale-Eintrag,
        // aber in Soll-Versteuerung liest die UVA Rechnungsumsätze direkt aus den Rechnungen (nicht aus
        // Sales), das Stornieren des Sale-Spiegels hätte also KEINE Wirkung auf die gemeldete USt.
        // Für Rechnungen ist eine Gutschrift (§17 UStG) der korrekte Weg, nicht eine Retoure.
        const recentSales = Store.getSales()
            .filter(s => !s._invoiceId)
            .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''))
            .slice(0, 100);
        const salesOptions = recentSales.map(s => {
            const label = `${Utils.formatDate(s.datum)} – ${Utils.escapeHtml(s.marke || s.artikeltyp || 'Verkauf')} – ${Utils.formatCurrency(s.verkaufspreis)}`;
            return `<option value="${s.id}">${label}</option>`;
        }).join('');

        let rows = '';
        if (filtered.length === 0) {
            rows = '<tr><td colspan="8" class="table-empty">Noch keine Retouren erfasst — eine Retoure entsteht über „Verkauf bearbeiten“ im Lager.</td></tr>';
        } else {
            rows = filtered.map(r => {
                const zustandBadge = r.zustand === 'Unbeschädigt'
                    ? '<span class="badge badge-success">Unbeschädigt</span>'
                    : r.zustand === 'Beschädigt'
                        ? '<span class="badge badge-warning">Beschädigt</span>'
                        : r.zustand === 'Keine Ware zurück'
                            ? '<span class="badge badge-neutral">Keine Ware zurück</span>'
                            : '<span class="badge badge-danger">Fehlt/Verlust</span>';
                const lagerBadge = (r.modell === 2 ? r.ware === 'zurueck' : r.zustand === 'Unbeschädigt')
                    ? '<span class="badge badge-success" style="font-size:10px;">↩ Lager</span>'
                    : r.ware === 'keine'
                        ? '<span class="badge badge-neutral" style="font-size:10px;">nur Erstattung</span>'
                        : '<span class="badge badge-neutral" style="font-size:10px;">Ausgebucht</span>';
                const saleLink = r.saleId
                    ? `<span class="badge badge-info" style="font-size:10px;" title="Verkauf ID: ${r.saleId}">Verknüpft</span>`
                    : '<span style="color:var(--text-muted);font-size:11px;">–</span>';
                return `
                <tr>
                    <td>${Utils.formatDate(r.datum)}</td>
                    <td><span class="badge badge-info">${Utils.escapeHtml(r.nummer || '')}</span></td>
                    <td>${Utils.escapeHtml(r.marke || '')} ${Utils.escapeHtml(r.artikeltyp || '')}</td>
                    <td>${zustandBadge}</td>
                    <td>${lagerBadge}</td>
                    <td style="text-align:right">${Utils.formatCurrency(r.erstattungBetrag)}</td>
                    <td>${saleLink}</td>
                    <td class="table-actions">
                        <button class="btn btn-small btn-danger" data-delete-retoure="${r.id}">Löschen</button>
                    </td>
                </tr>`;
            }).join('');
        }

        return `
            <div class="page-header">
                <h2>Retourenmanagement</h2>
            </div>

            <div class="stats-grid">
                <div class="card stat-card danger">
                    <div class="card-label">Retouren ${year === 'all' ? 'Gesamt' : year}</div>
                    <div class="card-value">${filtered.length}</div>
                    <div class="card-subtitle">Rücksendungen</div>
                </div>
                <div class="card stat-card warning">
                    <div class="card-label">Erstattet ${year === 'all' ? 'Gesamt' : year}</div>
                    <div class="card-value">${Utils.formatCurrency(totalErstattet)}</div>
                    <div class="card-subtitle">Rückerstattungen</div>
                </div>
                <div class="card stat-card info">
                    <div class="card-label">Zurück ins Lager</div>
                    <div class="card-value">${filtered.filter(r => r.zustand === 'Unbeschädigt').length}</div>
                    <div class="card-subtitle">Unbeschädigt zurück</div>
                </div>
                <div class="card stat-card">
                    <div class="card-label">Mit Verkauf verknüpft</div>
                    <div class="card-value">${filtered.filter(r => r.saleId).length}</div>
                    <div class="card-subtitle">Bestand aktualisiert</div>
                </div>
            </div>

            <div class="info-box" style="margin-bottom:16px;padding:12px 16px;background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);font-size:13px;color:var(--text-secondary);">
                <strong style="color:var(--info);">Verknüpfung mit Verkauf</strong><br>
                Wähle den originalen Verkauf aus der Liste. Der Verkauf bleibt als Einnahme stehen; die <strong>Erstattung</strong> wird zum gewählten Datum als Rückzahlung gebucht — auch eine Teilerstattung.
                Ins Lager zurück kommen nur die Artikel, die du als zurückgekommen markierst.
            </div>

            <div class="card" style="margin-bottom:16px;">
                <div class="card-header"><div class="card-title">Neue Retoure erfassen</div></div>
                <form id="retourenForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <input type="date" class="form-input" id="rt_datum" value="${Utils.todayISO()}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Marke</label>
                            <input type="text" class="form-input" id="rt_marke" maxlength="300" placeholder="z.B. Nike">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Artikeltyp</label>
                            <input type="text" class="form-input" id="rt_artikeltyp" maxlength="300" placeholder="z.B. Schuhe">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="rt_ware">Ware</label>
                            <select class="form-select" id="rt_ware">
                                <option value="zurueck">Zurück, unbeschädigt – wieder ins Lager</option>
                                <option value="defekt">Zurück, beschädigt – nicht weiterverkaufbar</option>
                                <option value="keine">Keine Ware zurück – nur Erstattung</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Originaler Verkaufspreis (€)</label>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="rt_vkPreis" placeholder="0,00">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Erstattung an Käufer (€)</label>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="rt_erstattung" placeholder="0,00">
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom:12px;">
                        <label class="form-label">Originalen Verkauf verknüpfen <span style="color:var(--text-muted);font-weight:400;">(empfohlen – stellt Lager & Kosten automatisch zurück)</span></label>
                        <select class="form-select" id="rt_saleId">
                            <option value="">– Kein Verkauf verknüpfen –</option>
                            ${salesOptions}
                        </select>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Für eine Rechnung gibt es hier keine Auswahl — bitte stattdessen eine <strong>Gutschrift</strong> zur Rechnung erstellen (§17 UStG), sonst wirkt sich die Retoure nicht auf die USt-Voranmeldung aus.</div>
                    </div>
                    <div id="rt_saleHint" style="display:none;padding:8px 12px;background:var(--success-bg);border:1px solid var(--success);border-radius:var(--radius-sm);font-size:12px;color:var(--success);margin-bottom:12px;">
                        Verkauf bleibt als Einnahme stehen · Erstattung wird zum Datum als Rückzahlung gebucht
                    </div>
                    <fieldset id="rt_artikel" style="display:none;margin:0 0 12px;border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 12px;">
                        <legend style="font-size:12px;padding:0 4px;">Zurückgekommene Artikel</legend>
                        <div id="rt_artikelListe"></div>
                    </fieldset>

                    <div class="form-group">
                        <label class="form-label">Notizen / Grund</label>
                        <input type="text" class="form-input" id="rt_notizen" maxlength="1000" placeholder="Grund der Retoure...">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Retoure speichern</button>
                    </div>
                </form>
            </div>

            <div class="filter-bar no-print">
                <div class="filter-group">
                    <label>Jahr</label>
                    <select class="form-select" id="rtFilterYear">${yearOpts}</select>
                </div>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Datum</th>
                            <th>Nummer</th>
                            <th>Artikel</th>
                            <th>Zustand</th>
                            <th>Lager</th>
                            <th style="text-align:right">Erstattung</th>
                            <th>Verkauf</th>
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    init() {
        // Sale selector hint
        const saleSelect = document.getElementById('rt_saleId');
        const saleHint = document.getElementById('rt_saleHint');
        if (saleSelect && saleHint) {
            saleSelect.addEventListener('change', () => {
                saleHint.style.display = saleSelect.value ? '' : 'none';
                // Auto-fill VK-Preis from selected sale
                if (saleSelect.value) {
                    const sale = Store.getSales().find(s => s.id === saleSelect.value);
                    if (sale) {
                        const vkEl = document.getElementById('rt_vkPreis');
                        const erstEl = document.getElementById('rt_erstattung');
                        if (vkEl && !vkEl.value) vkEl.value = sale.verkaufspreis || '';
                        if (erstEl && !erstEl.value) erstEl.value = Math.max(0, this._saleBrutto(sale) - this._bisherErstattet(sale.id)).toFixed(2);
                        const markeEl = document.getElementById('rt_marke');
                        const typEl = document.getElementById('rt_artikeltyp');
                        if (markeEl && !markeEl.value) markeEl.value = sale.marke || '';
                        if (typEl && !typEl.value) typEl.value = sale.artikeltyp || '';
                    }
                }
            });
        }

        // Artikel des gewählten Verkaufs zum Abhaken (Teilretoure bei Mehrartikelverkauf)
        const zeigeArtikel = () => {
            const box = document.getElementById('rt_artikel');
            const liste = document.getElementById('rt_artikelListe');
            const wareSel = document.getElementById('rt_ware');
            if (!box || !liste) return;
            const sale = saleSelect && saleSelect.value ? Store.getSales().find(s => s.id === saleSelect.value) : null;
            const ids = sale ? (sale.purchaseIds ? sale.purchaseIds : (sale.purchaseId ? [sale.purchaseId] : [])) : [];
            if (!ids.length || (wareSel && wareSel.value === 'keine')) { box.style.display = 'none'; liste.innerHTML = ''; return; }
            const purchases = Store.getPurchases(true);
            liste.innerHTML = ids.map(pid => {
                const p = purchases.find(x => x.id === pid) || {};
                const name = [p.artikelNr, p.marke, p.artikeltyp].filter(Boolean).join(' · ') || pid;
                return `<label style="display:flex;gap:8px;align-items:center;font-size:13px;"><input type="checkbox" class="rt-artikel" value="${Utils.escapeHtml(pid)}" checked> ${Utils.escapeHtml(name)}</label>`;
            }).join('');
            box.style.display = '';
        };
        if (saleSelect) saleSelect.addEventListener('change', zeigeArtikel);
        const wareSel = document.getElementById('rt_ware');
        if (wareSel) wareSel.addEventListener('change', zeigeArtikel);

        document.getElementById('retourenForm').addEventListener('submit', e => {
            e.preventDefault();
            if (this._busy) return; // Doppelklick: kein zweiter Vorgang
            const saleId = (document.getElementById('rt_saleId') || {}).value || '';
            // Negative Beträge liefen früher ungeprüft durch und drehten in EÜR und UVA das Vorzeichen.
            const vkPreisRaw = parseFloat(document.getElementById('rt_vkPreis').value) || 0;
            if (!Number.isFinite(vkPreisRaw) || vkPreisRaw < 0) { Utils.showToast('Ungültiger Verkaufspreis', 'error'); return; }
            const artikelBoxen = document.querySelectorAll ? Array.from(document.querySelectorAll('.rt-artikel')) : [];
            this._busy = true;
            let res;
            try {
                res = this.buche({
                    datum: Utils.getDateInputValue('rt_datum'),
                    saleId,
                    erstattungBetrag: parseFloat(document.getElementById('rt_erstattung').value) || 0,
                    ware: (document.getElementById('rt_ware') || {}).value || 'keine',
                    artikelIds: artikelBoxen.length ? artikelBoxen.filter(b => b.checked).map(b => b.value) : undefined,
                    vkPreis: vkPreisRaw,
                    marke: document.getElementById('rt_marke').value.trim(),
                    artikeltyp: document.getElementById('rt_artikeltyp').value.trim(),
                    notizen: document.getElementById('rt_notizen').value.trim()
                });
            } finally { this._busy = false; }
            if (!res.ok) { Utils.showToast(res.fehler, 'error'); return; }
            Utils.showToast('Retoure gespeichert' + (saleId ? ' · Erstattung gebucht' + (res.retoure.artikelIds.length ? ', Lager aktualisiert' : '') : ''), 'success');
            this._refresh();
        });

        const yearFilter = document.getElementById('rtFilterYear');
        if (yearFilter) yearFilter.addEventListener('change', () => {
            this._filterYear = yearFilter.value;
            this._refresh();
        });

        document.querySelectorAll('[data-delete-retoure]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!confirm('Retoure wirklich löschen?')) return;
                this.loesche(btn.dataset.deleteRetoure);
                Utils.showToast('Retoure gelöscht', 'success');
                this._refresh();
            });
        });
    },

    _refresh() {
        document.getElementById('content').innerHTML = this.render();
        this.init();
    }
};
