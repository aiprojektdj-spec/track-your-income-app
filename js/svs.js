// ============================================
// SVS — Sozialversicherung der Selbständigen (Österreich)
// Quartalsvorauszahlungen tracken + berechnen
// ============================================
const SVS = {
    // ── Beitragssätze 2024/2025 ─────────────────────────────────────────────
    // Quelle: SVS.at — Beitragssätze für Gewerbetreibende
    BEITRAGSSAETZE: {
        KV:    0.0765,  // Krankenversicherung
        PV:    0.185,   // Pensionsversicherung
        UV:    0.0153,  // Unfallversicherung (Pauschal)
        SVS:   0.0153,  // Selbständigenvorsorge (Optional, ~1,53%)
    },
    GESAMT_SATZ: 0.2782,  // ~27,82% Gesamt (KV+PV+UV ohne SVS-Vorsorge)

    // Mindestbeitragsgrundlage 2024: 518,44 €/Monat → 2.073,76 €/Quartal
    MINDEST_QUARTAL_2024: 576.98,   // Mindestbeitrag pro Quartal 2024
    MINDEST_QUARTAL_2025: 597.20,   // Mindestbeitrag pro Quartal 2025 (geschätzt)

    // KU-Freigrenze Österreich (§6 Abs. 1 Z 27 UStG)
    KU_GRENZE: 42000,

    // ── Store-Keys (company-namespaced über Store.get/set) ──────────────────
    STORE_KEY: 'svs_vorauszahlungen',

    getAll() {
        return Store.get(this.STORE_KEY) || [];
    },

    save(all) {
        Store.set(this.STORE_KEY, all);
    },

    // ── Berechnung ───────────────────────────────────────────────────────────

    // Berechnet den voraussichtlichen Quartalsbeitrag basierend auf Jahresgewinn
    berechneQuartal(jahresGewinn) {
        const basisGewinn = Math.max(jahresGewinn, 0);
        const beitrag = basisGewinn * this.GESAMT_SATZ / 4;
        const currentYear = new Date().getFullYear();
        const mindest = currentYear >= 2025 ? this.MINDEST_QUARTAL_2025 : this.MINDEST_QUARTAL_2024;
        return Math.max(beitrag, mindest);
    },

    // Aktueller Gewinn aus Store (aus Verkäufen - Einkäufe - Ausgaben)
    getAktuellerJahresGewinn(year) {
        try {
            const y = year || new Date().getFullYear();
            const sales    = Store.getSales().filter(s => s.datum && s.datum.startsWith(String(y)));
            const einkauf  = Store.getPurchases().filter(p => p.status === 'verkauft' && p.datum && p.datum.startsWith(String(y)));
            const ausgaben = (Store.getExpenses ? Store.getExpenses() : []).filter(e => e.datum && e.datum.startsWith(String(y)));
            const umsatz   = sales.reduce((s, v) => s + (parseFloat(v.verkaufspreis) || 0), 0);
            const ek       = einkauf.reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0), 0);
            const kosten   = ausgaben.reduce((s, e) => s + (parseFloat(e.betrag) || 0), 0);
            return umsatz - ek - kosten;
        } catch(e) { return 0; }
    },

    // Gibt Fälligkeitsdatum für jedes Quartal zurück
    getFaelligkeitsdatum(year, quartal) {
        const daten = { 1: `${year}-02-28`, 2: `${year}-05-31`, 3: `${year}-08-31`, 4: `${year}-11-30` };
        return daten[quartal] || '';
    },

    // Alle 4 Quartale für ein Jahr (mit Status aus gespeicherten Daten)
    getQuartale(year) {
        const stored = this.getAll().filter(v => v.jahr === year);
        const currentYear = new Date().getFullYear();
        const mindest = currentYear >= 2025 ? this.MINDEST_QUARTAL_2025 : this.MINDEST_QUARTAL_2024;
        const jahresGewinn = this.getAktuellerJahresGewinn(year);

        return [1, 2, 3, 4].map(q => {
            const existing = stored.find(v => v.quartal === q && v.typ !== 'nachbemessung');
            const faellig  = this.getFaelligkeitsdatum(year, q);
            const today    = new Date().toISOString().split('T')[0];
            const istUeberfaellig = faellig < today && !existing?.bezahltAm;

            return {
                quartal:       q,
                faelligAm:     faellig,
                vorschreibung: existing?.vorschreibung ?? null,   // von SVS-Brief
                kalkuliert:    Math.max(this.berechneQuartal(jahresGewinn), mindest),
                bezahltAm:     existing?.bezahltAm  || null,
                bezahlt:       !!(existing?.bezahltAm),
                ueberfaellig:  istUeberfaellig,
                id:            existing?.id || null,
                notizen:       existing?.notizen || ''
            };
        });
    },

    // Quartal als bezahlt markieren / aktualisieren
    saveQuartal(year, quartal, data) {
        const all  = this.getAll();
        const idx  = all.findIndex(v => v.jahr === year && v.quartal === quartal && v.typ !== 'nachbemessung');
        const entry = {
            id:            idx >= 0 ? all[idx].id : Store.generateId(),
            jahr:          year,
            quartal:       quartal,
            typ:           'vorauszahlung',
            faelligAm:     this.getFaelligkeitsdatum(year, quartal),
            vorschreibung: data.vorschreibung !== undefined ? parseFloat(data.vorschreibung) || null : (idx >= 0 ? all[idx].vorschreibung : null),
            bezahltAm:     data.bezahltAm || null,
            notizen:       data.notizen || '',
            updatedAt:     new Date().toISOString()
        };
        if (idx >= 0) all[idx] = entry; else all.push(entry);
        this.save(all);
        return entry;
    },

    // Nachbemessung speichern (Jahresausgleich nach ESt-Bescheid)
    saveNachbemessung(year, betrag, datum, notizen) {
        const all = this.getAll();
        const existing = all.find(v => v.jahr === year && v.typ === 'nachbemessung');
        const entry = {
            id:       existing?.id || Store.generateId(),
            jahr:     year,
            quartal:  0,
            typ:      'nachbemessung',
            betrag:   parseFloat(betrag) || 0,
            bezahltAm: datum || null,
            notizen:  notizen || '',
            updatedAt: new Date().toISOString()
        };
        if (existing) {
            const idx = all.indexOf(existing);
            all[idx] = entry;
        } else all.push(entry);
        this.save(all);
    },

    getNachbemessung(year) {
        return this.getAll().find(v => v.jahr === year && v.typ === 'nachbemessung') || null;
    },

    // ── Widget für Steuertermine-Seite ──────────────────────────────────────
    renderWidget() {
        const year     = new Date().getFullYear();
        const quartale = this.getQuartale(year);
        const gewinn   = this.getAktuellerJahresGewinn(year);
        const umsatz   = Store.getSales().filter(s => s.datum && s.datum.startsWith(String(year)))
            .reduce((s, v) => s + (parseFloat(v.verkaufspreis) || 0), 0);
        const kuWarn   = umsatz > this.KU_GRENZE * 0.8;
        const currentYear = new Date().getFullYear();
        const mindest  = currentYear >= 2025 ? this.MINDEST_QUARTAL_2025 : this.MINDEST_QUARTAL_2024;

        const qCards = quartale.map(q => {
            const status = q.bezahlt ? 'success'
                         : q.ueberfaellig ? 'danger'
                         : 'neutral';
            const statusText = q.bezahlt ? '✓ Bezahlt'
                             : q.ueberfaellig ? '⚠ Überfällig'
                             : 'Offen';
            const betragAnzeige = q.vorschreibung != null
                ? Utils.formatCurrency(q.vorschreibung) + ' <span style="font-size:10px;color:var(--text-muted);">(Vorschreibung)</span>'
                : Utils.formatCurrency(q.kalkuliert) + ' <span style="font-size:10px;color:var(--text-muted);">(kalkuliert)</span>';

            return `
            <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:10px;padding:14px;position:relative;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                    <div>
                        <div style="font-weight:700;font-size:14px;">Q${q.quartal} · ${year}</div>
                        <div style="font-size:11px;color:var(--text-muted);">Fällig: ${Utils.formatDate(q.faelligAm)}</div>
                    </div>
                    <span class="badge badge-${status}">${statusText}</span>
                </div>
                <div style="font-size:16px;font-weight:700;margin-bottom:10px;">${betragAnzeige}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn btn-small btn-outline" onclick="SVS.openEditModal(${year}, ${q.quartal})" style="font-size:11px;">
                        ${q.bezahlt ? '✏ Bearbeiten' : '💳 Als bezahlt markieren'}
                    </button>
                </div>
            </div>`;
        }).join('');

        const nb = this.getNachbemessung(year);

        return `
        <div class="card" style="margin-bottom:16px;border:1px solid rgba(228,50,62,.3);">
            <div class="card-header" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <div class="card-title">🇦🇹 SVS-Vorauszahlungen ${year}</div>
                <span style="font-size:12px;color:var(--text-muted);">Beitragssatz: ~${(this.GESAMT_SATZ*100).toFixed(1)}% · Mindestbeitrag: ${Utils.formatCurrency(mindest)}/Quartal</span>
                <button class="btn btn-small btn-outline" onclick="SVS.openNachbemessungModal(${year})" style="margin-left:auto;font-size:11px;">
                    📄 Nachbemessung ${year - 1}
                </button>
            </div>

            ${kuWarn ? `
            <div style="margin:0 0 12px;padding:10px 14px;background:rgba(245,158,11,.1);border:1px solid var(--warning);border-radius:8px;font-size:13px;">
                ⚠️ Dein Umsatz (${Utils.formatCurrency(umsatz)}) nähert sich der KU-Grenze von ${Utils.formatCurrency(this.KU_GRENZE)}.
                Ab Überschreitung bist du USt-pflichtig!
            </div>` : ''}

            ${gewinn > 0 ? `
            <div style="margin-bottom:12px;padding:10px 14px;background:var(--bg-secondary);border-radius:8px;font-size:13px;color:var(--text-secondary);">
                Akt. Jahresgewinn: <strong style="color:var(--text-primary);">${Utils.formatCurrency(gewinn)}</strong>
                → Geschätzter Jahresbeitrag: <strong style="color:var(--text-primary);">${Utils.formatCurrency(Math.max(gewinn * this.GESAMT_SATZ, mindest * 4))}</strong>
            </div>` : ''}

            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:12px;">
                ${qCards}
            </div>

            ${nb ? `
            <div style="padding:10px 14px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);border-radius:8px;font-size:13px;">
                📄 Nachbemessung ${year-1}: <strong>${Utils.formatCurrency(nb.betrag)}</strong>
                ${nb.bezahltAm ? ` · bezahlt am ${Utils.formatDate(nb.bezahltAm)}` : ' · <span style="color:var(--warning);">noch offen</span>'}
                ${nb.notizen ? ` · ${Utils.escapeHtml(nb.notizen)}` : ''}
                <button class="btn btn-small" onclick="SVS.openNachbemessungModal(${year-1})" style="margin-left:8px;font-size:11px;">✏</button>
            </div>` : ''}
        </div>`;
    },

    // ── Modals ───────────────────────────────────────────────────────────────

    openEditModal(year, quartal) {
        const q      = this.getQuartale(year).find(x => x.quartal === quartal);
        const labels = { 1: 'Februar', 2: 'Mai', 3: 'August', 4: 'November' };

        const body = `
        <div style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">
            <div style="background:var(--bg-secondary);border-radius:8px;padding:12px;font-size:13px;">
                <strong>Q${quartal}/${year}</strong> · Fälligkeit: ${labels[quartal]} ${year}<br>
                <span style="color:var(--text-muted);">Kalkuliert: ${Utils.formatCurrency(q.kalkuliert)}</span>
            </div>

            <div class="form-group">
                <label class="form-label">Vorschreibungsbetrag (laut SVS-Brief)</label>
                <div style="display:flex;align-items:center;gap:8px;">
                    <input type="number" class="form-input" id="svs_vorschreibung" step="0.01" min="0"
                           value="${q.vorschreibung ?? ''}"
                           placeholder="Leer lassen = kalkulierter Betrag">
                    <span style="color:var(--text-muted);font-size:13px;">€</span>
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
                    Den genauen Betrag vom SVS-Brief eintragen. Falls kein Brief vorhanden, wird ${Utils.formatCurrency(q.kalkuliert)} verwendet.
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Bezahlt am</label>
                <input type="date" class="form-input" id="svs_bezahlt_am"
                       value="${q.bezahltAm || ''}" max="${new Date().toISOString().split('T')[0]}">
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Leer lassen = noch nicht bezahlt</div>
            </div>

            <div class="form-group">
                <label class="form-label">Notizen</label>
                <input type="text" class="form-input" id="svs_notizen"
                       value="${Utils.escapeHtml(q.notizen)}" placeholder="Optional">
            </div>

            <div style="display:flex;gap:10px;">
                <button class="btn btn-outline" onclick="App.closeModal()" style="flex:1;">Abbrechen</button>
                <button class="btn btn-primary" onclick="SVS._saveEditModal(${year}, ${quartal})" style="flex:1;">
                    💾 Speichern
                </button>
            </div>
        </div>`;

        App.openModal(`SVS Q${quartal}/${year}`, body, []);
    },

    _saveEditModal(year, quartal) {
        const vorschreibung = document.getElementById('svs_vorschreibung')?.value;
        const bezahltAm     = Utils.getDateInputValue('svs_bezahlt_am') || null;
        const notizen       = document.getElementById('svs_notizen')?.value || '';

        this.saveQuartal(year, quartal, {
            vorschreibung: vorschreibung ? parseFloat(vorschreibung) : null,
            bezahltAm,
            notizen
        });

        App.closeModal();
        Utils.showToast(`✅ SVS Q${quartal}/${year} gespeichert`, 'success');

        // Widget neu rendern
        const widget = document.getElementById('svsTrackerWidget');
        if (widget) widget.innerHTML = this.renderWidget();
    },

    openNachbemessungModal(year) {
        const nb = this.getNachbemessung(year);
        const body = `
        <div style="display:flex;flex-direction:column;gap:16px;padding:4px 0;">
            <div style="font-size:13px;color:var(--text-secondary);">
                Die Nachbemessung erhältst du vom SVS nach Vorliegen deines Einkommensteuerbescheids für ${year}.
                Sie enthält den Differenzbetrag zwischen Vorauszahlungen und tatsächlichem Beitrag.
            </div>
            <div class="form-group">
                <label class="form-label">Nachbemessungsbetrag (laut SVS-Bescheid)</label>
                <div style="display:flex;align-items:center;gap:8px;">
                    <input type="number" class="form-input" id="nb_betrag" step="0.01"
                           value="${nb?.betrag ?? ''}" placeholder="0,00">
                    <span style="color:var(--text-muted);font-size:13px;">€</span>
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
                    Positiv = Nachzahlung, Negativ = Rückerstattung
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Bezahlt / Rückgebucht am</label>
                <input type="date" class="form-input" id="nb_datum" value="${nb?.bezahltAm || ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Notizen</label>
                <input type="text" class="form-input" id="nb_notizen"
                       value="${Utils.escapeHtml(nb?.notizen || '')}" placeholder="z.B. Referenznummer">
            </div>
            <div style="display:flex;gap:10px;">
                <button class="btn btn-outline" onclick="App.closeModal()" style="flex:1;">Abbrechen</button>
                <button class="btn btn-primary" onclick="SVS._saveNachbemessungModal(${year})" style="flex:1;">
                    💾 Speichern
                </button>
            </div>
        </div>`;
        App.openModal(`SVS Nachbemessung ${year}`, body, []);
    },

    _saveNachbemessungModal(year) {
        const betrag  = parseFloat(document.getElementById('nb_betrag')?.value)  || 0;
        const datum   = Utils.getDateInputValue('nb_datum') || null;
        const notizen = document.getElementById('nb_notizen')?.value || '';
        this.saveNachbemessung(year, betrag, datum, notizen);
        App.closeModal();
        Utils.showToast(`✅ Nachbemessung ${year} gespeichert`, 'success');
        const widget = document.getElementById('svsTrackerWidget');
        if (widget) widget.innerHTML = this.renderWidget();
    },

    // ── Dashboard-Kachel (kompakt, nur AT) ──────────────────────────────────
    renderDashboardKachel() {
        const year     = new Date().getFullYear();
        const quartale = this.getQuartale(year);
        const offen    = quartale.filter(q => !q.bezahlt);
        const ueberfaellig = quartale.filter(q => q.ueberfaellig);
        const naechstes = offen[0] || null;

        const status = ueberfaellig.length > 0 ? 'danger'
                     : offen.length > 0        ? 'warning'
                     : 'success';

        const statusText = ueberfaellig.length > 0
            ? `⚠️ ${ueberfaellig.length} überfällig`
            : offen.length > 0
            ? `${offen.length} Quartal(e) offen`
            : '✓ Alle bezahlt';

        return `
        <div class="card stat-card" style="cursor:pointer;border-left:4px solid var(--${status});"
             onclick="App.navigate('steuertermine')">
            <div class="card-label">🇦🇹 SVS Vorauszahlungen ${year}</div>
            <div class="card-value" style="font-size:16px;color:var(--${status});">${statusText}</div>
            ${naechstes ? `<div class="card-subtitle">Nächste: Q${naechstes.quartal} · ${Utils.formatDate(naechstes.faelligAm)}</div>` : ''}
        </div>`;
    }
};
window.SVS = SVS;
