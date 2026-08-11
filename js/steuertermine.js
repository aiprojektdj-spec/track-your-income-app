// ============================================
// Steuertermine Module - Tax Deadline Calendar
// ============================================
const Steuertermine = {

    // ── Feiertage und Werktagsverschiebung (§108 Abs. 3 AO) ──────────────────
    // Fällt das Ende einer Frist auf Samstag, Sonntag oder gesetzlichen Feiertag, endet sie erst
    // am nächsten Werktag. Vorher zeigte das Modul stur den 10., obwohl z.B. der 10.01.2026 ein
    // Samstag ist — gesetzliche Frist war der 12.01. (Fund T3, Steuer-Vergleich 2026-08-10).
    //
    // Bewusst NUR bundesweite Feiertage. §108 Abs. 3 AO stellt auf den Feiertag am Ort des
    // Finanzamts ab, und die Länderfeiertage (Fronleichnam, Reformationstag, Allerheiligen,
    // Heilige Drei Könige …) gelten regional unterschiedlich. Ein nicht berücksichtigter
    // Länderfeiertag lässt die Anzeige zu FRÜH sein — harmlos. Ein zu Unrecht verschobener
    // Termin würde den Nutzer zu spät abgeben lassen. Die Richtung ist also Absicht.
    _osterSonntag(year) {
        // Gauß'sche Osterformel (gregorianisch)
        const a = year % 19, b = Math.floor(year / 100), c = year % 100;
        const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4), k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const monat = Math.floor((h + l - 7 * m + 114) / 31);   // 3 = März, 4 = April
        const tag   = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(Date.UTC(year, monat - 1, tag));
    },
    _feiertage(year) {
        const iso = (d) => d.toISOString().slice(0, 10);
        const plus = (d, n) => new Date(d.getTime() + n * 86400000);
        const o = this._osterSonntag(year);
        return new Set([
            `${year}-01-01`,          // Neujahr
            iso(plus(o, -2)),         // Karfreitag
            iso(plus(o, 1)),          // Ostermontag
            `${year}-05-01`,          // Tag der Arbeit
            iso(plus(o, 39)),         // Christi Himmelfahrt
            iso(plus(o, 50)),         // Pfingstmontag
            `${year}-10-03`,          // Tag der Deutschen Einheit
            `${year}-12-25`, `${year}-12-26`
        ]);
    },
    _naechsterWerktag(isoDatum) {
        let d = new Date(isoDatum + 'T00:00:00Z');
        let feiertage = this._feiertage(d.getUTCFullYear());
        for (let guard = 0; guard < 10; guard++) {
            const wd = d.getUTCDay();                       // 0 = So, 6 = Sa
            const iso = d.toISOString().slice(0, 10);
            if (wd !== 0 && wd !== 6 && !feiertage.has(iso)) return iso;
            d = new Date(d.getTime() + 86400000);
            // Jahreswechsel: Feiertagsliste nachziehen (10.01. kann nie so weit laufen, aber
            // 26.12. + Wochenende landet im Januar)
            if (d.getUTCFullYear() !== (new Date(iso + 'T00:00:00Z')).getUTCFullYear()) {
                feiertage = this._feiertage(d.getUTCFullYear());
            }
        }
        return isoDatum;   // Notausgang, sollte nie greifen
    },

    // ── UStVA-Termine aus dem eingestellten Rhythmus erzeugen ────────────────
    // Vorher waren vier Quartalstermine hart gelistet. Wer monatlich voranmelden muss (Vorjahres-
    // Zahllast über 7.500 €, §18 Abs. 2 UStG, oder Gründungsjahr/Folgejahr), bekam damit acht
    // fehlende Fristen im Jahr — und das trifft genau die wachsenden Nutzer. Quelle für Rhythmus
    // und Dauerfristverlängerung sind dieselben Einstellungen, die js/ustvoranmeldung.js benutzt.
    _ustTermine(year) {
        const s = (typeof Store !== 'undefined' && Store.getSettings) ? Store.getSettings() : {};
        // Kleinunternehmer nach §19 UStG geben keine Voranmeldung ab — Termine wären falsch.
        if ((s.ustMode || 'klein') !== 'regel') return [];

        const monatlich = (s.ustVaPeriodenTyp || 'quartal') === 'monat';
        const dauerfrist = !!s.ustDauerfristverlaengerung;
        const versatz = dauerfrist ? 2 : 1;               // Monate nach Periodenende (§46 UStDV)
        const zusatz = dauerfrist ? ' (inkl. Dauerfristverlängerung)' : '';
        const out = [];

        // Abgabetermin = 10. des Monats (Periodenende + versatz). Läuft über den Jahreswechsel
        // korrekt, weil Date die Monatsüberläufe selbst auflöst.
        const termin = (endJahr, endMonatIdx, label, id) => {
            const d = new Date(Date.UTC(endJahr, endMonatIdx + versatz, 10));
            const roh = d.toISOString().slice(0, 10);
            out.push({
                id: id, datum: this._naechsterWerktag(roh), typ: 'ust', fix: true,
                beschreibung: 'USt-Voranmeldung ' + label + zusatz
            });
        };

        if (monatlich) {
            // Dezember des Vorjahres fällt in den Januar dieses Jahres (bzw. Februar mit Dauerfrist)
            termin(year - 1, 11, 'Dezember ' + (year - 1), 'fix_ustm12v_' + year);
            const namen = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                           'Juli', 'August', 'September', 'Oktober', 'November'];
            for (let m = 0; m < 11; m++) termin(year, m, namen[m] + ' ' + year, 'fix_ustm' + (m + 1) + '_' + year);
        } else {
            termin(year - 1, 11, 'Q4 ' + (year - 1), 'fix_ust4y_' + year);
            for (let q = 0; q < 3; q++) termin(year, q * 3 + 2, 'Q' + (q + 1) + ' ' + year, 'fix_ust' + (q + 1) + '_' + year);
        }

        // 1/11-Sondervorauszahlung: Voraussetzung der Dauerfristverlängerung bei MONATLICHER
        // Voranmeldung (§47 UStDV). Bei Quartalsanmeldern gibt es sie nicht — dort ist die
        // Verlängerung ohne Sondervorauszahlung zu haben.
        if (dauerfrist && monatlich) {
            out.push({
                id: 'fix_ustsvz_' + year, datum: this._naechsterWerktag(`${year}-02-10`),
                typ: 'ust', fix: true,
                beschreibung: '1/11-Sondervorauszahlung anmelden und zahlen (§47 UStDV)'
            });
        }
        return out;
    },

    // Lohnsteuer-Anmeldung: nur wenn tatsächlich Mitarbeiter erfasst sind (js/lohnsteuer.js).
    // Der Rhythmus hängt an der Vorjahres-Lohnsteuer (§41a Abs. 2 EStG): über 5.000 € monatlich,
    // über 1.080 € vierteljährlich, darunter jährlich. Diese Summe kennt Stackr nicht — deshalb
    // wird der monatliche, also strengste Fall gezeigt und der Vorbehalt dazugeschrieben, statt
    // eine Annahme als Gewissheit auszugeben.
    _lohnsteuerTermine(year) {
        let hatMitarbeiter = false;
        try {
            const emp = (typeof Store !== 'undefined' && Store.get) ? Store.get('lohnsteuer_employees') : null;
            hatMitarbeiter = Array.isArray(emp) && emp.length > 0;
        } catch (e) { /* Modul/Key nicht vorhanden → keine Termine */ }
        if (!hatMitarbeiter) return [];
        const out = [];
        for (let m = 0; m < 12; m++) {
            const d = new Date(Date.UTC(year, m, 10));
            out.push({
                id: 'fix_lst' + (m + 1) + '_' + year,
                datum: this._naechsterWerktag(d.toISOString().slice(0, 10)),
                typ: 'lohn', fix: true,
                beschreibung: 'Lohnsteuer-Anmeldung ' + ['Dez ' + (year - 1), 'Januar', 'Februar', 'März', 'April', 'Mai',
                              'Juni', 'Juli', 'August', 'September', 'Oktober', 'November'][m] +
                              ' (monatlich unterstellt, §41a EStG)'
            });
        }
        return out;
    },

    _getFixedTermine(year) {
        const w = (iso) => this._naechsterWerktag(iso);
        return [
            { id: 'fix_eur_' + year,   datum: w(`${year}-07-31`), beschreibung: 'Steuererklärung / EÜR Vorjahr abgeben', typ: 'steuer', fix: true },
            { id: 'fix_pstg_' + year,  datum: w(`${year}-03-31`), beschreibung: 'PStTG: Jahresbericht Plattformdaten',    typ: 'pstg',   fix: true },
            { id: 'fix_gewa_' + year,  datum: w(`${year}-02-15`), beschreibung: 'Gewerbesteuer-Vorauszahlung Q1',         typ: 'gewerbe', fix: true },
            { id: 'fix_gewb_' + year,  datum: w(`${year}-05-15`), beschreibung: 'Gewerbesteuer-Vorauszahlung Q2',         typ: 'gewerbe', fix: true },
            { id: 'fix_gewc_' + year,  datum: w(`${year}-08-15`), beschreibung: 'Gewerbesteuer-Vorauszahlung Q3',         typ: 'gewerbe', fix: true },
            { id: 'fix_gewd_' + year,  datum: w(`${year}-11-15`), beschreibung: 'Gewerbesteuer-Vorauszahlung Q4',         typ: 'gewerbe', fix: true }
        ].concat(this._ustTermine(year)).concat(this._lohnsteuerTermine(year));
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
        const typColors = { steuer: 'badge-info', ust: 'badge-warning', gewerbe: 'badge-neutral', pstg: 'badge-danger', svs: 'badge-warning', lohn: 'badge-info', custom: 'badge-success' };

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

        const landBadge = `<span style="font-size:12px;padding:3px 10px;border-radius:12px;background:rgba(99,102,241,.1);color:var(--accent);font-weight:600;border:1px solid rgba(99,102,241,.2);">🇩🇪 Deutschland · §19 UStG</span>`;

        return `
            <div class="page-header" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
                ${fromEuer ? `<button class="btn btn-small" id="steuerBackToEuer" style="opacity:.8;">← Zurück zur EÜR</button>` : ''}
                <h2 style="margin:0;">Steuertermin-Kalender</h2>
                ${landBadge}
            </div>

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
