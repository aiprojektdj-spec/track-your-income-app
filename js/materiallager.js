// ============================================
// Materiallager Module – Verpackungskosten
// ============================================
const Materiallager = {
    _tab: 'bestand',

    // Sortierung je Tab getrennt: die drei Tabellen haben unterschiedliche Spalten,
    // ein gemeinsamer Zustand wuerde beim Tabwechsel auf eine Spalte zeigen, die es
    // dort nicht gibt. Leeres col = Voreinstellung des Tabs (s. _sortiere).
    _headSort: {
        bestand:   { col: '', dir: 'asc' },
        einkauf:   { col: '', dir: 'asc' },
        verbrauch: { col: '', dir: 'asc' }
    },

    // Sortierschluessel je Tab — ROHWERTE, nicht das, was in der Zelle steht.
    // formatCurrency/formatDate wuerden als String verglichen: "10,00 €" landete
    // vor "9,00 €", der 02.01. vor dem 10.12.
    _SORT_WERT: {
        bestand: (m, col) => ({
            name:             (m.name || '').toLowerCase(),
            kategorie:        (m.kategorie || '').toLowerCase(),
            bestand:          parseInt(m.bestand) || 0,
            mindestbestand:   parseInt(m.mindestbestand) || 0,
            kostenProEinheit: parseFloat(m.kostenProEinheit) || 0,
            restwert:         (parseFloat(m.kostenProEinheit) || 0) * (parseInt(m.bestand) || 0)
        }[col]),
        einkauf: (e, col) => ({
            datum:            e.datum || '',
            materialName:     (e.materialName || '').toLowerCase(),
            menge:            parseFloat(e.menge) || 0,
            kostenProEinheit: parseFloat(e.kostenProEinheit) || 0,
            gesamtkosten:     parseFloat(e.gesamtkosten) || 0,
            lieferant:        (e.lieferant || '').toLowerCase()
        }[col]),
        verbrauch: (v, col) => ({
            datum:            v.datum || '',
            materialName:     (v.materialName || '').toLowerCase(),
            menge:            parseFloat(v.menge) || 0,
            kostenProEinheit: parseFloat(v.kostenProEinheit) || 0,
            kosten:           parseFloat(v.kosten) || 0,
            grund:            (v.grund || '').toLowerCase()
        }[col])
    },

    /** Sortiert nach dem Zustand des Tabs. Ohne gewaehlte Spalte bleibt es bei der
     *  bisherigen Voreinstellung, die der Aufrufer mitgibt. */
    _sortiere(liste, tab) {
        const st = this._headSort[tab];
        if (!st || !st.col) return liste;
        return liste.slice().sort(Utils.sortComparator(st, this._SORT_WERT[tab]));
    },

    // Suchtext je Tab, getrennt wie die Sortierung. Gesucht wird in den Textspalten,
    // die auch in der Tabelle stehen — Betraege und Mengen sind ueber die Sortierung
    // schneller gefunden als ueber eine Texteingabe.
    _suche: { bestand: '', einkauf: '', verbrauch: '' },

    _SUCH_FELDER: {
        bestand:   m => [m.name, m.kategorie, m.einheit],
        einkauf:   e => [e.materialName, e.lieferant, e.datum, Utils.formatDate(e.datum)],
        verbrauch: v => [v.materialName, v.grund, v.referenzBez, v.datum, Utils.formatDate(v.datum)]
    },

    /** Filtert nach dem Suchtext des Tabs. Mehrere Woerter muessen alle vorkommen,
     *  egal in welcher Spalte ("karton amazon" findet Karton-Einkaeufe bei Amazon). */
    _filtere(liste, tab) {
        const woerter = (this._suche[tab] || '').toLowerCase().split(/\s+/).filter(Boolean);
        if (!woerter.length) return liste;
        const felder = this._SUCH_FELDER[tab];
        return liste.filter(x => {
            const text = felder(x).filter(Boolean).join(' ').toLowerCase();
            return woerter.every(w => text.includes(w));
        });
    },

    /** Suchfeld ueber der Tabelle. Enter sucht, Escape leert (wie im Lager-Modul):
     *  ein Live-Filter je Tastendruck wuerde die Seite neu rendern und den Fokus verlieren. */
    _suchfeld(tab, platzhalter, treffer, gesamt) {
        const aktiv = !!this._suche[tab];
        return `
            <div class="no-print" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                <input type="search" class="form-input" id="mlSuche" data-ml-suche="${tab}"
                    value="${Utils.escapeHtml(this._suche[tab])}" placeholder="${platzhalter} – Enter zum Suchen"
                    aria-label="Tabelle durchsuchen" maxlength="200" style="max-width:340px;">
                ${aktiv ? `<button type="button" class="btn btn-small btn-secondary" id="mlSucheReset" title="Suche zurücksetzen">✕</button>
                <span style="font-size:12px;color:var(--text-muted);" role="status">${treffer} von ${gesamt}</span>` : ''}
            </div>`;
    },

    /** Leerzustand, wenn die Suche alles wegfiltert — sonst stuende dort der
     *  Erstbenutzer-Text ("Noch kein Material erfasst"), obwohl es Daten gibt. */
    _keineTreffer(tab) {
        return '<tr><td colspan="7" class="table-empty">Keine Treffer für „'
            + Utils.escapeHtml(this._suche[tab]) + '“.</td></tr>';
    },

    /** Sortierbarer Tabellenkopf. `stil` traegt die Ausrichtung der Zahlenspalten. */
    _th(tab, col, label, stil) {
        return '<th class="' + Utils.sortIcon(this._headSort[tab], col) + '" data-sort="' + col + '"'
             + (stil ? ' style="' + stil + '"' : '')
             + ' title="Nach ' + label.replace(/"/g, '') + ' sortieren">' + label + '</th>';
    },

    STD_MATERIAL: [
        { id: 'karton_xs',       name: 'Karton XS',            einheit: 'Stück',  kategorie: 'Karton' },
        { id: 'karton_s',        name: 'Karton S',             einheit: 'Stück',  kategorie: 'Karton' },
        { id: 'karton_m',        name: 'Karton M',             einheit: 'Stück',  kategorie: 'Karton' },
        { id: 'karton_l',        name: 'Karton L',             einheit: 'Stück',  kategorie: 'Karton' },
        { id: 'karton_xl',       name: 'Karton XL',            einheit: 'Stück',  kategorie: 'Karton' },
        { id: 'versandbeutel_s', name: 'Versandbeutel S',      einheit: 'Stück',  kategorie: 'Beutel' },
        { id: 'versandbeutel_m', name: 'Versandbeutel M',      einheit: 'Stück',  kategorie: 'Beutel' },
        { id: 'versandbeutel_l', name: 'Versandbeutel L',      einheit: 'Stück',  kategorie: 'Beutel' },
        { id: 'luftpolster_s',   name: 'Luftpolstertasche S',  einheit: 'Stück',  kategorie: 'Polstertasche' },
        { id: 'luftpolster_m',   name: 'Luftpolstertasche M',  einheit: 'Stück',  kategorie: 'Polstertasche' },
        { id: 'luftpolster_l',   name: 'Luftpolstertasche L',  einheit: 'Stück',  kategorie: 'Polstertasche' },
        { id: 'klebeband',       name: 'Klebeband',            einheit: 'Rolle',  kategorie: 'Zubehör' },
        { id: 'fuellmaterial',   name: 'Füllmaterial',         einheit: 'Beutel', kategorie: 'Zubehör' },
        { id: 'seidenpapier',    name: 'Seidenpapier',         einheit: 'Blatt',  kategorie: 'Zubehör' },
    ],

    render() {
        const bestand = Store.getMaterialBestand();
        const totalRestwert = bestand.reduce((s, m) =>
            s + (parseFloat(m.kostenProEinheit) || 0) * (parseInt(m.bestand) || 0), 0);
        const totalArten = bestand.length;
        const niedrig = bestand.filter(m => (parseInt(m.bestand) || 0) <= (parseInt(m.mindestbestand) || 0) && (parseInt(m.bestand) || 0) >= 0).length;

        const tabs = [
            { id: 'bestand',  label: '📦 Bestand' },
            { id: 'einkauf',  label: '🛒 Einkauf' },
            { id: 'verbrauch',label: '📊 Verbrauch' },
        ];

        return `
            <div class="page-header">
                <h2>Materiallager</h2>
                <div class="page-header-actions no-print">
                    <button class="btn" id="mlExportCSV">📥 CSV Export</button>
                </div>
            </div>

            <div class="stats-grid">
                <div class="card stat-card info">
                    <div class="card-label">Materialarten</div>
                    <div class="card-value">${totalArten}</div>
                    <div class="card-subtitle">im Lager</div>
                </div>
                <div class="card stat-card warning">
                    <div class="card-label">Restwert Lager</div>
                    <div class="card-value">${Utils.formatCurrency(totalRestwert)}</div>
                    <div class="card-subtitle">Umlaufvermögen</div>
                </div>
                ${niedrig > 0 ? `<div class="card stat-card danger">
                    <div class="card-label">Nachbestellen</div>
                    <div class="card-value">${niedrig}</div>
                    <div class="card-subtitle">unter Mindestbestand</div>
                </div>` : `<div class="card stat-card success">
                    <div class="card-label">Bestand</div>
                    <div class="card-value">✓</div>
                    <div class="card-subtitle">Alle gut bestückt</div>
                </div>`}
            </div>

            <div class="info-box" style="margin-bottom:12px;padding:10px 14px;background:var(--info-bg);border:1px solid var(--info);border-radius:var(--radius);font-size:13px;color:var(--text-secondary);">
                <strong style="color:var(--info);">💡 Materiallager:</strong>
                Erfasse Verpackungsmaterial (Kartons, Beutel etc.) mit Bestand und Kosten.
                Beim Speichern eines Verkaufs kannst du verwendetes Material abbuchen.
                Die Kosten fließen in die EÜR als Betriebsausgabe ein.
            </div>

            <div style="display:flex;gap:8px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:0;">
                ${tabs.map(t => `
                    <button class="btn${this._tab === t.id ? ' btn-primary' : ' btn-secondary'}"
                        style="border-radius:var(--radius) var(--radius) 0 0;margin-bottom:-1px;border-bottom:${this._tab === t.id ? '2px solid var(--accent)' : 'none'};"
                        data-ml-tab="${t.id}">${t.label}</button>
                `).join('')}
            </div>

            <div id="mlTabContent">
                ${this._tab === 'bestand'   ? this._renderBestand(bestand)  : ''}
                ${this._tab === 'einkauf'   ? this._renderEinkauf()          : ''}
                ${this._tab === 'verbrauch' ? this._renderVerbrauch()        : ''}
            </div>
        `;
    },

    _renderBestand(bestand) {
        const usedIds = new Set(bestand.map(m => m.stdId || m.id));
        // Voreinstellung ist die Reihenfolge aus dem Store (Anlagereihenfolge) —
        // _sortiere laesst sie unangetastet, solange keine Spalte gewaehlt ist.
        const gesamt = bestand.length;
        bestand = this._sortiere(this._filtere(bestand, 'bestand'), 'bestand');

        const rows = gesamt === 0
            ? '<tr><td colspan="7" class="table-empty">Noch kein Material erfasst. Materialart unten hinzufügen.</td></tr>'
            : bestand.length === 0 ? this._keineTreffer('bestand')
            : bestand.map(m => {
                const bestandVal = parseInt(m.bestand) || 0;
                const mindest = parseInt(m.mindestbestand) || 0;
                const warn = bestandVal <= mindest && mindest > 0;
                const restwert = (parseFloat(m.kostenProEinheit) || 0) * bestandVal;
                return `<tr${warn ? ' style="background:var(--danger-bg);"' : ''}>
                    <td>${Utils.escapeHtml(m.name)}</td>
                    <td style="color:var(--text-muted);font-size:12px;">${Utils.escapeHtml(m.kategorie || '')}</td>
                    <td style="text-align:right;font-weight:600;color:${warn ? 'var(--danger)' : 'var(--success)'};">
                        ${bestandVal} ${Utils.escapeHtml(m.einheit || 'Stück')}
                        ${warn ? ' ⚠️' : ''}
                    </td>
                    <td style="text-align:right;color:var(--text-muted);">${mindest > 0 ? mindest + ' ' + (m.einheit || 'Stück') : '–'}</td>
                    <td style="text-align:right">${Utils.formatCurrency(m.kostenProEinheit)}</td>
                    <td style="text-align:right;font-weight:600;">${Utils.formatCurrency(restwert)}</td>
                    <td class="table-actions">
                        <button class="btn btn-small" data-ml-edit="${m.id}" title="Bearbeiten">✏️</button>
                        <button class="btn btn-small" data-ml-einkauf="${m.id}" title="Bestand erhöhen (Einkauf)">+</button>
                        <button class="btn btn-small btn-danger" data-ml-delete="${m.id}" title="Löschen">🗑️</button>
                    </td>
                </tr>`;
            }).join('');

        const stdOpts = this.STD_MATERIAL
            .filter(s => !usedIds.has(s.id))
            .map(s => `<option value="${s.id}">${s.name} (${s.einheit})</option>`)
            .join('');

        return `
            <div class="card" style="margin-bottom:16px;">
                <div class="card-header"><div class="card-title">Neues Material hinzufügen</div></div>
                <form id="mlBestandForm">
                    <div class="form-row">
                        <div class="form-group" style="flex:2">
                            <label class="form-label">Standardmaterial wählen</label>
                            <select class="form-select" id="ml_std_select">
                                <option value="">– Manuelle Eingabe –</option>
                                ${stdOpts}
                            </select>
                        </div>
                        <div class="form-group" style="flex:0.5;align-self:flex-end;">
                            <button type="button" class="btn btn-secondary" id="mlStdFill">Ausfüllen</button>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="flex:2">
                            <label class="form-label">Bezeichnung *</label>
                            <input type="text" class="form-input" id="ml_name" maxlength="300" placeholder="z.B. Karton M" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Einheit</label>
                            <input type="text" class="form-input" id="ml_einheit" maxlength="300" placeholder="Stück" value="Stück">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Kategorie</label>
                            <input type="text" class="form-input" id="ml_kategorie" maxlength="300" placeholder="Karton / Beutel …">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Anfangsbestand</label>
                            <input type="number" step="1" min="0" max="9999999" class="form-input" id="ml_bestand" placeholder="0" value="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Mindestbestand (Warnung)</label>
                            <input type="number" step="1" min="0" max="9999999" class="form-input" id="ml_mindest" placeholder="0" value="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Kosten pro Einheit (€)</label>
                            <input type="number" step="0.001" min="0" max="99999999" class="form-input" id="ml_kosten" placeholder="0,00">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">+ Materialart hinzufügen</button>
                    </div>
                </form>
            </div>

            ${gesamt > 0 ? this._suchfeld('bestand', 'Bezeichnung, Kategorie, Einheit', bestand.length, gesamt) : ''}
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            ${this._th('bestand', 'name', 'Bezeichnung')}
                            ${this._th('bestand', 'kategorie', 'Kategorie')}
                            ${this._th('bestand', 'bestand', 'Bestand', 'text-align:right')}
                            ${this._th('bestand', 'mindestbestand', 'Mindestbestand', 'text-align:right')}
                            ${this._th('bestand', 'kostenProEinheit', '€/Einheit', 'text-align:right')}
                            ${this._th('bestand', 'restwert', 'Restwert', 'text-align:right')}
                            <th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    _renderEinkauf() {
        const bestand = Store.getMaterialBestand();
        // Voreinstellung bleibt: neueste zuerst. Erst ein Klick auf einen Kopf
        // uebersteuert das (_sortiere gibt die Liste sonst unveraendert zurueck).
        const alleEinkauefe = Store.getMaterialEinkauefe();
        const einkauefe = this._sortiere(
            this._filtere(alleEinkauefe, 'einkauf').sort((a, b) => (b.datum || '').localeCompare(a.datum || '')),
            'einkauf');

        const matOpts = bestand.length > 0
            ? bestand.map(m => `<option value="${m.id}">${Utils.escapeHtml(m.name)} (Bestand: ${parseInt(m.bestand) || 0} ${Utils.escapeHtml(m.einheit || 'Stück')})</option>`).join('')
            : '<option value="">Erst Materialarten unter "Bestand" anlegen</option>';

        const rows = alleEinkauefe.length === 0
            ? '<tr><td colspan="7" class="table-empty">Noch keine Einkäufe erfasst — trag den ersten oben im Formular ein. Materialarten dafür legst du im Tab „Bestand" an.</td></tr>'
            : einkauefe.length === 0 ? this._keineTreffer('einkauf')
            : einkauefe.map(e => `<tr>
                <td>${Utils.formatDate(e.datum)}</td>
                <td>${Utils.escapeHtml(e.materialName || '')}</td>
                <td style="text-align:right">${e.menge || 0} ${Utils.escapeHtml(e.einheit || 'Stück')}</td>
                <td style="text-align:right">${Utils.formatCurrency(e.kostenProEinheit)}</td>
                <td style="text-align:right;font-weight:600;">${Utils.formatCurrency(e.gesamtkosten)}</td>
                <td>${Utils.escapeHtml(e.lieferant || '–')}</td>
                <td class="table-actions">
                    <button class="btn btn-small btn-danger" data-ml-del-einkauf="${e.id}">🗑️</button>
                </td>
            </tr>`).join('');

        return `
            <div class="card" style="margin-bottom:16px;">
                <div class="card-header"><div class="card-title">Materialeinkauf erfassen</div></div>
                ${bestand.length === 0 ? '<div style="padding:12px 16px;color:var(--text-muted);">Erst Materialarten unter "Bestand" anlegen.</div>' : `
                <form id="mlEinkaufForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <input type="date" class="form-input" id="mle_datum" value="${Utils.todayISO()}">
                        </div>
                        <div class="form-group" style="flex:2">
                            <label class="form-label">Material *</label>
                            <select class="form-select" id="mle_material" required>
                                <option value="">Bitte wählen…</option>
                                ${matOpts}
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Menge *</label>
                            <input type="number" step="1" min="1" class="form-input" id="mle_menge" placeholder="50" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Gesamtkosten (€)</label>
                            <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="mle_gesamt" placeholder="0,00">
                        </div>
                        <div class="form-group">
                            <label class="form-label">€/Einheit (berechnet)</label>
                            <input type="text" class="form-input" id="mle_einzeln_display" readonly value="0,000 €"
                                style="background:var(--bg-card);font-weight:600;color:var(--info);">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Lieferant (optional)</label>
                            <input type="text" class="form-input" id="mle_lieferant" maxlength="300" placeholder="z.B. Amazon, Baumarkt">
                        </div>
                    </div>
                    <div class="form-hint" style="font-size:12px;color:var(--text-muted);margin-top:-4px;margin-bottom:8px;">
                        Der €/Einheit-Wert wird automatisch berechnet und aktualisiert den gleitenden Durchschnitt im Bestand.
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">+ Einkauf buchen</button>
                    </div>
                </form>`}
            </div>

            ${alleEinkauefe.length > 0 ? this._suchfeld('einkauf', 'Material, Lieferant, Datum', einkauefe.length, alleEinkauefe.length) : ''}
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            ${this._th('einkauf', 'datum', 'Datum')}${this._th('einkauf', 'materialName', 'Material')}${this._th('einkauf', 'menge', 'Menge', 'text-align:right')}
                            ${this._th('einkauf', 'kostenProEinheit', '€/Einheit', 'text-align:right')}${this._th('einkauf', 'gesamtkosten', 'Gesamt', 'text-align:right')}
                            ${this._th('einkauf', 'lieferant', 'Lieferant')}<th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    },

    _renderVerbrauch() {
        // Voreinstellung bleibt: neueste zuerst, s. _renderEinkauf.
        const aktiv = Store.getMaterialVerbrauch().filter(v => !v.storniert);
        const log = this._sortiere(this._filtere(aktiv, 'verbrauch')
            .sort((a, b) => (b.datum || '').localeCompare(a.datum || '')), 'verbrauch');

        const rows = aktiv.length === 0
            ? '<tr><td colspan="7" class="table-empty">Noch kein Verbrauch gebucht. Verbrauch wird automatisch beim Speichern eines Verkaufs mit Materialbuchung gebucht.</td></tr>'
            : log.length === 0 ? this._keineTreffer('verbrauch')
            : log.map(v => `<tr>
                <td>${Utils.formatDate(v.datum)}</td>
                <td>${Utils.escapeHtml(v.materialName || '')}</td>
                <td style="text-align:right">${v.menge || 0} ${Utils.escapeHtml(v.einheit || 'Stück')}</td>
                <td style="text-align:right">${Utils.formatCurrency(v.kostenProEinheit)}</td>
                <td style="text-align:right;font-weight:600;">${Utils.formatCurrency(v.kosten)}</td>
                <td style="font-size:12px;color:var(--text-muted);">${Utils.escapeHtml(v.grund || '')}${v.referenzBez ? ': ' + Utils.escapeHtml(v.referenzBez) : ''}</td>
                <td class="table-actions">
                    <button class="btn btn-small btn-danger" data-ml-del-verbrauch="${v.id}" title="Stornieren">↩️</button>
                </td>
            </tr>`).join('');

        // Bei aktiver Suche die Summe der Treffer: wer nach "Karton M" sucht, will wissen,
        // was Karton M gekostet hat. Das Label sagt dazu, welche Summe gerade steht.
        const totalKosten = log.reduce((s, v) => s + (parseFloat(v.kosten) || 0), 0);
        const gefiltert = !!this._suche.verbrauch;

        return `
            <div style="margin-bottom:12px;padding:10px 16px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);font-size:13px;display:flex;justify-content:space-between;">
                <span>${gefiltert ? 'Verbrauchskosten der Treffer:' : 'Verbrauchskosten gesamt (aktiv):'}</span>
                <strong style="color:var(--danger);">${Utils.formatCurrency(totalKosten)}</strong>
            </div>
            ${aktiv.length > 0 ? this._suchfeld('verbrauch', 'Material, Grund, Datum', log.length, aktiv.length) : ''}
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            ${this._th('verbrauch', 'datum', 'Datum')}${this._th('verbrauch', 'materialName', 'Material')}${this._th('verbrauch', 'menge', 'Menge', 'text-align:right')}
                            ${this._th('verbrauch', 'kostenProEinheit', '€/Einheit', 'text-align:right')}${this._th('verbrauch', 'kosten', 'Kosten', 'text-align:right')}
                            ${this._th('verbrauch', 'grund', 'Grund / Referenz')}<th>Aktionen</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>

            <div class="card" style="margin-top:16px;">
                <div class="card-header"><div class="card-title">Manueller Verbrauch buchen</div></div>
                <form id="mlVerbrauchForm">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Datum</label>
                            <input type="date" class="form-input" id="mlv_datum" value="${Utils.todayISO()}">
                        </div>
                        <div class="form-group" style="flex:2">
                            <label class="form-label">Material *</label>
                            <select class="form-select" id="mlv_material" required>
                                <option value="">Bitte wählen…</option>
                                ${Store.getMaterialBestand().map(m =>
                                    `<option value="${m.id}">${Utils.escapeHtml(m.name)} (${parseInt(m.bestand) || 0} ${Utils.escapeHtml(m.einheit || 'Stück')})</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Menge *</label>
                            <input type="number" step="1" min="1" class="form-input" id="mlv_menge" placeholder="1" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Grund</label>
                            <input type="text" class="form-input" id="mlv_grund" maxlength="300" placeholder="z.B. Verlust, Test …">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-warning">Verbrauch buchen</button>
                    </div>
                </form>
            </div>
        `;
    },

    init() {
        // Sortierbare Koepfe des gerade sichtbaren Tabs. _refresh() rendert neu und
        // ruft init() erneut auf, die Listener haengen also immer am aktuellen DOM.
        Utils.bindSortableHeaders(
            document.getElementById('content'),
            this._headSort[this._tab],
            () => this._refresh());

        const sucheEl = document.getElementById('mlSuche');
        if (sucheEl) {
            const tab = sucheEl.dataset.mlSuche;
            sucheEl.addEventListener('keydown', e => {
                if (e.key !== 'Enter' && e.key !== 'Escape') return;
                e.preventDefault();
                this._suche[tab] = e.key === 'Enter' ? sucheEl.value.trim() : '';
                this._refresh();
                // Nach dem Neuaufbau zurueck ins Feld, damit man weitertippen kann.
                const neu = document.getElementById('mlSuche');
                if (neu) { neu.focus(); neu.setSelectionRange(neu.value.length, neu.value.length); }
            });
            // Das ✕ im Suchfeld (type=search) leert nur den Text; erst das Ereignis
            // 'search' mit leerem Wert setzt den Filter auch zurueck.
            sucheEl.addEventListener('search', () => {
                if (sucheEl.value === '' && this._suche[tab]) { this._suche[tab] = ''; this._refresh(); }
            });
        }
        document.getElementById('mlSucheReset')?.addEventListener('click', () => {
            this._suche[this._tab] = '';
            this._refresh();
        });

        document.querySelectorAll('[data-ml-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._tab = btn.dataset.mlTab;
                this._refresh();
            });
        });

        document.getElementById('mlExportCSV')?.addEventListener('click', () => {
            const bestand = Store.getMaterialBestand();
            const rows = [['Bezeichnung', 'Kategorie', 'Einheit', 'Bestand', 'Mindestbestand', '€/Einheit', 'Restwert €']];
            bestand.forEach(m => rows.push([
                m.name, m.kategorie || '', m.einheit || 'Stück',
                m.bestand || 0, m.mindestbestand || 0,
                (parseFloat(m.kostenProEinheit) || 0).toFixed(3),
                ((parseFloat(m.kostenProEinheit) || 0) * (parseInt(m.bestand) || 0)).toFixed(2)
            ]));
            Utils.downloadCSV(rows, 'materiallager_export.csv');
            Utils.showToast('CSV exportiert', 'success');
        });

        if (this._tab === 'bestand') this._bindBestand();
        if (this._tab === 'einkauf') this._bindEinkauf();
        if (this._tab === 'verbrauch') this._bindVerbrauch();
    },

    _bindBestand() {
        document.getElementById('mlStdFill')?.addEventListener('click', () => {
            const sel = document.getElementById('ml_std_select')?.value;
            if (!sel) return;
            const std = this.STD_MATERIAL.find(s => s.id === sel);
            if (!std) return;
            const n = document.getElementById('ml_name');
            const e = document.getElementById('ml_einheit');
            const k = document.getElementById('ml_kategorie');
            if (n) n.value = std.name;
            if (e) e.value = std.einheit;
            if (k) k.value = std.kategorie;
        });

        document.getElementById('mlBestandForm')?.addEventListener('submit', e => {
            e.preventDefault();
            const name = document.getElementById('ml_name').value.trim();
            if (!name) return;
            const std = this.STD_MATERIAL.find(s => s.name === name);
            Store.saveMaterialBestandItem({
                stdId: std?.id || null,
                name,
                einheit: document.getElementById('ml_einheit').value.trim() || 'Stück',
                kategorie: document.getElementById('ml_kategorie').value.trim(),
                bestand: parseInt(document.getElementById('ml_bestand').value) || 0,
                mindestbestand: parseInt(document.getElementById('ml_mindest').value) || 0,
                kostenProEinheit: parseFloat(document.getElementById('ml_kosten').value) || 0,
            });
            Utils.showToast(Utils.escapeHtml(name) + ' hinzugefügt', 'success');
            this._refresh();
        });

        document.querySelectorAll('[data-ml-edit]').forEach(btn => {
            btn.addEventListener('click', () => {
                const m = Store.getMaterialBestand().find(x => x.id === btn.dataset.mlEdit);
                if (!m) return;
                const body = `
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Bestand</label>
                            <input type="number" step="1" min="0" max="9999999" class="form-input" id="me_bestand" value="${m.bestand || 0}"></div>
                        <div class="form-group"><label class="form-label">Mindestbestand</label>
                            <input type="number" step="1" min="0" max="9999999" class="form-input" id="me_mindest" value="${m.mindestbestand || 0}"></div>
                        <div class="form-group"><label class="form-label">€/Einheit</label>
                            <input type="number" step="0.001" min="0" max="99999999" class="form-input" id="me_kosten" value="${m.kostenProEinheit || 0}"></div>
                    </div>`;
                App.showModal('✏️ ' + m.name + ' bearbeiten', body,
                    `<button class="btn btn-primary" data-action="ml-save-edit" data-args='["${m.id}"]' >Speichern</button>
                    <button class="btn btn-secondary" data-action="close-modal">Abbrechen</button>`
                );
            });
        });

        document.querySelectorAll('[data-ml-einkauf]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._tab = 'einkauf';
                this._refresh();
                setTimeout(() => {
                    const sel = document.getElementById('mle_material');
                    if (sel) sel.value = btn.dataset.mlEinkauf;
                }, 50);
            });
        });

        document.querySelectorAll('[data-ml-delete]').forEach(btn => {
            btn.addEventListener('click', () => {
                const m = Store.getMaterialBestand().find(x => x.id === btn.dataset.mlDelete);
                if (!m) return;
                if (!confirm(`"${m.name}" aus dem Lager löschen?`)) return;
                Store.deleteMaterialBestandItem(btn.dataset.mlDelete);
                Utils.showToast('Materialart gelöscht', 'success');
                this._refresh();
            });
        });
    },

    /** Gleitender Durchschnittspreis beim Materialeinkauf.
     *
     *  Steht als eigene Funktion da, weil sie die einzige Rechenlogik dieses Moduls ist und
     *  im submit-Handler darunter von keinem Harness erreichbar war (Fund C des Vollaudits,
     *  plan/01-AUFGABEN.md 1.8). Reine Funktion: liest nichts, schreibt nichts, gibt den neuen
     *  Stueckpreis zurueck.
     *
     *  Gerundet wird auf DREI Nachkommastellen, nicht auf zwei — bei Verpackungsmaterial liegen
     *  Stueckpreise regelmaessig im Cent-Bruchteil (Polybeutel ~0,038 EUR). Auf zwei Stellen
     *  gerundet waeren das 0,04 EUR, also 5 % Abweichung, die sich ueber den Bestand aufsummiert.
     */
    _mischpreis(altBestand, altKosten, menge, neuPreis) {
        const ab = parseInt(altBestand) || 0;
        const ak = parseFloat(altKosten) || 0;
        const m  = parseInt(menge) || 0;
        const np = parseFloat(neuPreis) || 0;
        const neuerBestand = ab + m;
        // Ohne Bestand gibt es nichts zu mitteln — dann gilt der neue Preis unveraendert.
        // Das greift auch bei der ersten Lieferung einer Materialart (altBestand 0).
        if (neuerBestand <= 0) return np;
        return Math.round(((ab * ak + m * np) / neuerBestand) * 1000) / 1000;
    },

    _bindEinkauf() {
        const mengeEl = document.getElementById('mle_menge');
        const gesamtEl = document.getElementById('mle_gesamt');
        const einzelnEl = document.getElementById('mle_einzeln_display');

        const calcEinzeln = () => {
            const menge = parseFloat(mengeEl?.value) || 0;
            const gesamt = parseFloat(gesamtEl?.value) || 0;
            if (einzelnEl) {
                einzelnEl.value = menge > 0
                    ? (gesamt / menge).toFixed(3).replace('.', ',') + ' €'
                    : '0,000 €';
            }
        };
        mengeEl?.addEventListener('input', calcEinzeln);
        gesamtEl?.addEventListener('input', calcEinzeln);

        document.getElementById('mlEinkaufForm')?.addEventListener('submit', e => {
            e.preventDefault();
            const matId = document.getElementById('mle_material').value;
            const menge = parseInt(document.getElementById('mle_menge').value) || 0;
            const gesamt = parseFloat(document.getElementById('mle_gesamt').value) || 0;
            if (!matId || menge <= 0) { Utils.showToast('Bitte Material und Menge angeben', 'warning'); return; }
            const mat = Store.getMaterialBestand().find(m => m.id === matId);
            if (!mat) return;
            const kostenProEinheit = menge > 0 ? Math.round(gesamt / menge * 1000) / 1000 : 0;

            // Gleitender Durchschnitt — Rechnung in _mischpreis(), damit sie testbar ist
            const altBestand = parseInt(mat.bestand) || 0;
            mat.kostenProEinheit = this._mischpreis(altBestand, mat.kostenProEinheit, menge, kostenProEinheit);
            mat.bestand = altBestand + menge;
            Store.saveMaterialBestandItem(mat);

            Store.saveMaterialEinkauf({
                datum: document.getElementById('mle_datum').value,
                materialId: matId, materialName: mat.name, einheit: mat.einheit || 'Stück',
                menge, gesamtkosten: gesamt, kostenProEinheit,
                lieferant: document.getElementById('mle_lieferant').value.trim()
            });

            // Log as consumption entry with negative menge (positive stock addition)
            Utils.showToast(`${menge} × ${Utils.escapeHtml(mat.name)} eingebucht (+${Utils.formatCurrency(gesamt)})`, 'success');
            this._refresh();
        });

        document.querySelectorAll('[data-ml-del-einkauf]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!confirm('Einkauf-Eintrag löschen? Der Bestand wird NICHT rückgängig gemacht.')) return;
                Store.deleteMaterialEinkauf(btn.dataset.mlDelEinkauf);
                Utils.showToast('Einkauf gelöscht', 'success');
                this._refresh();
            });
        });
    },

    _bindVerbrauch() {
        document.getElementById('mlVerbrauchForm')?.addEventListener('submit', e => {
            e.preventDefault();
            const matId = document.getElementById('mlv_material').value;
            const menge = parseInt(document.getElementById('mlv_menge').value) || 0;
            const grund = document.getElementById('mlv_grund').value.trim() || 'manuell';
            if (!matId || menge <= 0) { Utils.showToast('Bitte Material und Menge angeben', 'warning'); return; }
            const mat = Store.getMaterialBestand().find(m => m.id === matId);
            if (!mat) return;
            if (menge > (parseInt(mat.bestand) || 0)) {
                if (!confirm(`Bestand (${mat.bestand}) reicht nicht. Trotzdem buchen (Minusbestand)?`)) return;
            }
            Store.bookMaterialVerbrauch(
                [{ materialId: matId, menge }],
                document.getElementById('mlv_datum').value,
                grund, null, ''
            );
            Utils.showToast(`${menge} × ${Utils.escapeHtml(mat.name)} verbraucht`, 'success');
            this._refresh();
        });

        document.querySelectorAll('[data-ml-del-verbrauch]').forEach(btn => {
            btn.addEventListener('click', () => {
                const v = Store.getMaterialVerbrauch().find(x => x.id === btn.dataset.mlDelVerbrauch);
                if (!v) return;
                if (!confirm('Verbrauchsbuchung stornieren? Bestand wird wiederhergestellt.')) return;
                const mat = Store.getMaterialBestand().find(m => m.id === v.materialId);
                if (mat) {
                    mat.bestand = (parseInt(mat.bestand) || 0) + (parseInt(v.menge) || 0);
                    Store.saveMaterialBestandItem(mat);
                }
                v.storniert = true;
                Store.saveMaterialVerbrauchEintrag(v);
                Utils.showToast('Verbrauch storniert', 'success');
                this._refresh();
            });
        });
    },

    _refresh() {
        document.getElementById('content').innerHTML = this.render();
        this.init();
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'ml-save-edit': function (id) {
        const m = Store.getMaterialBestand().find(x => x.id === id);
        if (!m) return;
        m.bestand = parseInt(document.getElementById('me_bestand').value) || 0;
        m.mindestbestand = parseInt(document.getElementById('me_mindest').value) || 0;
        m.kostenProEinheit = parseFloat(document.getElementById('me_kosten').value) || 0;
        Store.saveMaterialBestandItem(m);
        App.closeModal();
        Materiallager._refresh();
        Utils.showToast(Utils.escapeHtml(m.name) + ' aktualisiert', 'success');
    }
});
