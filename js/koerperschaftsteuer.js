// ============================================
// Körperschaftsteuer (KSt) — GmbH / UG
// §23 KStG: Satz je Veranlagungszeitraum (_kstSatz), + 5,5% SolZ
// ============================================
const Koerperschaftsteuer = {

    _year: new Date().getFullYear(),

    SOLZ_SATZ: 0.055,

    // §23 Abs.1 KStG i.d.F. des Gesetzes für ein steuerliches Investitionssofortprogramm (2025):
    // 15 % bis VZ 2027, dann jährlich ein Prozentpunkt weniger bis 10 % ab VZ 2032 (T12).
    _kstSatz(year) {
        if (year <= 2027) return 0.15;
        if (year >= 2032) return 0.10;
        return (15 - (year - 2027)) / 100;
    },
    _gesamtSatz(year) { const k = this._kstSatz(year); return k + k * this.SOLZ_SATZ; },

    // Mindestbesteuerung beim Verlustvortrag (T10). Bis zum Sockelbetrag voll abziehbar, darüber
    // nur zu einer Quote — für KSt (§10d Abs.2 EStG i.V.m. §8 Abs.1 KStG) 70 % in den VZ
    // 2024–2027 (Wachstumschancengesetz), sonst 60 %; für die GewSt (§10a GewStG) 60 %.
    _mindestbesteuerung(year) {
        return { sockel: 1000000, kstQuote: (year >= 2024 && year <= 2027) ? 0.70 : 0.60, gewstQuote: 0.60 };
    },

    // Verlustabzug mit Mindestbesteuerung. basis = Einkommen bzw. Gewerbeertrag vor Verlustabzug.
    _verlustabzug(basis, vortrag, sockel, quote) {
        vortrag = Math.max(0, parseFloat(vortrag) || 0);
        if (basis <= 0) return { abzug: 0, nachAbzug: Math.max(0, basis), restVortrag: vortrag + Math.abs(Math.min(0, basis)) };
        const max = basis <= sockel ? basis : sockel + quote * (basis - sockel);
        const abzug = Math.min(vortrag, max);
        return { abzug, nachAbzug: basis - abzug, restVortrag: vortrag - abzug };
    },

    _getData()   { return Store.get('kst_data') || {}; },
    _saveData(d) { Store.set('kst_data', d); },

    // ── Gewinn berechnen (vereinfacht aus Buchungen) ──
    // ⚠️ WICHTIG: Dies ist eine reine Cash-EÜR-Näherung (Einnahmen − Wareneinkauf − Ausgaben),
    // KEINE bilanzielle Gewinnermittlung. GmbH/UG sind gem. §8 Abs. 1 KStG i.V.m. §5 Abs. 1 EStG
    // bilanzierungspflichtig (Betriebsvermögensvergleich mit Rückstellungen, Abgrenzungen,
    // Forderungen/Verbindlichkeiten zum Bilanzstichtag statt reiner Zahlungsströme). Eine
    // vollständige Bilanzierung ist in Stackr nicht abgebildet — die Zahlen hier dienen nur der
    // Orientierung. Siehe UI-Hinweis in render() und §141-AO-Hinweis-Vorlage in js/gbr-modul.js.
    _calcGewinn(year) {
        const y = String(year);
        const sales     = (Store.getSales ? Store.getSales() : Store.get('sales') || []).filter(s => (s.datum || '').startsWith(y));
        const purchases = (Store.getPurchases ? Store.getPurchases() : Store.get('purchases') || []).filter(p => (p.datum || '').startsWith(y) && !p.storniert);
        const ausgaben  = (Store.getExpenses ? Store.getExpenses() : Store.get('ausgaben') || []).filter(a => (a.datum || '').startsWith(y));

        const einnahmen = sales.reduce((s, v) => s + (parseFloat(v.verkaufspreis) || 0) + (parseFloat(v.versandkostenKaeufer) || 0), 0);
        const wareneinkauf = purchases.reduce((s, p) => s + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1), 0);
        const betriebsausgaben = ausgaben.reduce((s, a) => s + (parseFloat(a.betrag) || 0), 0);
        const gewinn = einnahmen - wareneinkauf - betriebsausgaben;

        return { einnahmen, wareneinkauf, betriebsausgaben, gewinn };
    },

    // ── KSt berechnen ──
    // KSt- und GewSt-Verlustvortrag sind getrennt festgestellte Größen (§10d EStG / §10a GewStG)
    // und werden getrennt abgezogen — bis zum Audit 2026-10-13 (T10) zog die App einen Betrag
    // unbegrenzt ab und nahm das Ergebnis zugleich als Gewerbeertrag. yd.verlustvortragGewSt
    // fehlt bei Altdaten; dann gilt derselbe Wert wie für die KSt (Anzeige weist das aus).
    // opts.gewerbeertrag: Gewerbeertrag vor Verlustabzug, wenn er vom Gewinn abweicht
    // (Hinzurechnungen/Kürzungen bildet Stackr nicht ab — Standard ist der Gewinn).
    _calcKSt(gewinn, year, opts) {
        opts = opts || {};
        const data = this._getData();
        const yd   = data[year] || {};
        const mb   = this._mindestbesteuerung(year);

        const verlustvortrag = parseFloat(yd.verlustvortrag) || 0;
        const gewstVortragGesetzt = yd.verlustvortragGewSt !== undefined && yd.verlustvortragGewSt !== '';
        const verlustvortragGewSt = gewstVortragGesetzt ? (parseFloat(yd.verlustvortragGewSt) || 0) : verlustvortrag;

        const k = this._verlustabzug(gewinn, verlustvortrag, mb.sockel, mb.kstQuote);
        const zvE = k.nachAbzug;
        const neuerVerlust = k.restVortrag;

        const kstSatz = this._kstSatz(year);
        const kst  = zvE * kstSatz;
        const solz = kst * this.SOLZ_SATZ;
        const gesamt = kst + solz;

        // GewSt (GmbH/UG: kein Freibetrag!)
        const einst    = Store.get('gbr_einstellungen') || {};
        const hebesatz = parseFloat(einst.hebesatz) || 400;
        const gewerbeertragVor = opts.gewerbeertrag !== undefined ? opts.gewerbeertrag : gewinn;
        const g = this._verlustabzug(gewerbeertragVor, verlustvortragGewSt, mb.sockel, mb.gewstQuote);
        // §11 GewStG: Gewerbeertrag auf volle 100 € abrunden, dann Steuermesszahl 3,5%
        const gewerbeertrag = Math.floor(Math.max(0, g.nachAbzug) / 100) * 100;
        const messbetrag = gewerbeertrag * 0.035;
        const gewSt      = messbetrag * (hebesatz / 100);

        // Gesamtsteuerbelastung
        const steuerGesamt = gesamt + gewSt;

        return {
            gewinn, verlustvortrag, verlustabzug: k.abzug, zvE, neuerVerlust, kstSatz,
            verlustvortragGewSt, gewstVortragGesetzt, verlustabzugGewSt: g.abzug, gewerbeertrag, neuerVerlustGewSt: g.restVortrag,
            kst, solz, gesamt,
            hebesatz, messbetrag, gewSt,
            steuerGesamt,
            effektiverSatz: gewinn > 0 ? (steuerGesamt / gewinn * 100) : 0
        };
    },

    // ── Render ──
    render() {
        const rf = typeof Rechtsform !== 'undefined' ? Rechtsform.get() : 'Einzelunternehmen';
        if (rf !== 'GmbH' && rf !== 'UG') {
            return `
            <div class="page-header"><h2><i class="ti ti-building-bank" style="margin-right:6px;"></i> Körperschaftsteuer</h2></div>
            <div class="card" style="padding:32px;text-align:center;">
                <h3>Nur für Kapitalgesellschaften</h3>
                <p style="color:var(--text-muted);margin:8px 0 20px;">
                    KSt betrifft nur <strong>GmbH</strong> und <strong>UG (haftungsbeschränkt)</strong>.<br>
                    Aktuelle Rechtsform: <strong>${rf}</strong>
                </p>
                <button class="btn btn-primary" data-action="navigate" data-args=\'["rechtsform"]\'>Rechtsform ändern</button>
            </div>`;
        }

        const year = this._year;
        const fin  = this._calcGewinn(year);
        const calc = this._calcKSt(fin.gewinn, year);
        const data = this._getData();
        const yd   = data[year] || {};

        // Jahresauswahl dynamisch bis zwei Jahre über das laufende Jahr hinaus (T12)
        const yearOpts = Array.from({ length: Math.max(year, new Date().getFullYear()) + 2 - 2022 + 1 }, (_, i) => 2022 + i)
            .map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');

        // Vorauszahlungen
        const vz = yd.vorauszahlungen || [];
        const vzSum = vz.reduce((s, v) => s + (parseFloat(v.betrag) || 0), 0);

        // Jahresüberschuss NACH Steuern (KSt + SolZ + GewSt) — maßgeblich für die UG-Rücklage
        const jahresueberschussNachSteuern = fin.gewinn - calc.steuerGesamt;

        // Thesaurierungspflicht UG (§5a Abs. 3 GmbHG): 25% des JAHRESÜBERSCHUSSES NACH STEUERN,
        // nicht des zu versteuernden Einkommens vor Steuern. Bei negativem Jahresüberschuss gibt
        // es nichts zu thesaurieren.
        const isUG = rf === 'UG';
        const thesaurierung = isUG ? Math.max(0, jahresueberschussNachSteuern) * 0.25 : 0;

        return `
        <div class="page-header">
            <h2><i class="ti ti-building-bank" style="margin-right:6px;"></i> Körperschaftsteuer</h2>
            <div class="page-header-actions no-print">
                <select class="form-select" id="kstYear" style="width:90px;">${yearOpts}</select>
                <button class="btn" data-action="kst-export">CSV Export</button>
            </div>
        </div>

        <!-- Pflichthinweis: Cash-EÜR-Näherung, keine bilanzielle Gewinnermittlung -->
        <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:13px;">
            <strong>Vereinfachte Berechnung — keine bilanzielle Gewinnermittlung.</strong>
            ${rf} ist gem. §8 Abs. 1 KStG i.V.m. §5 Abs. 1 EStG bilanzierungspflichtig. Die Zahlen auf dieser Seite basieren auf einer
            reinen <strong>Cash-EÜR-Näherung</strong> (Einnahmen − Wareneinkauf − Ausgaben) und berücksichtigen <strong>keine</strong> Rückstellungen,
            Abgrenzungen, Forderungen/Verbindlichkeiten oder sonstigen bilanziellen Anpassungen zum Stichtag. Der tatsächliche steuerliche Gewinn
            kann erheblich abweichen. Für die verbindliche Bilanz/GuV bitte Steuerberater hinzuziehen.
        </div>

        <!-- KPI Cards -->
        <div class="stats-grid" style="margin-bottom:16px;">
            <div class="card stat-card">
                <div class="card-label">Jahresgewinn ${year}</div>
                <div class="card-value">${Utils.formatCurrency(fin.gewinn)}</div>
                <div class="card-subtitle">Vor Steuern</div>
            </div>
            <div class="card stat-card danger">
                <div class="card-label">KSt + SolZ</div>
                <div class="card-value">${Utils.formatCurrency(calc.gesamt)}</div>
                <div class="card-subtitle">${(calc.kstSatz * 100).toLocaleString('de-DE')}% + 5,5% SolZ = ${(this._gesamtSatz(year) * 100).toLocaleString('de-DE', { maximumFractionDigits: 3 })}%</div>
            </div>
            <div class="card stat-card danger">
                <div class="card-label">Gewerbesteuer</div>
                <div class="card-value">${Utils.formatCurrency(calc.gewSt)}</div>
                <div class="card-subtitle">Hebesatz ${calc.hebesatz}% · kein Freibetrag</div>
            </div>
            <div class="card stat-card ${calc.effektiverSatz > 30 ? 'danger' : ''}">
                <div class="card-label">Effektiver Steuersatz</div>
                <div class="card-value">${calc.effektiverSatz.toFixed(1)}%</div>
                <div class="card-subtitle">Gesamtbelastung</div>
            </div>
        </div>

        <!-- Detailberechnung -->
        <div class="card" style="margin-bottom:16px;padding:20px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:16px;">Steuerberechnung ${rf} — ${year}</div>
            <div class="table-container" style="border:none;">
                <table class="euer-table">
                    <thead><tr><th>Position</th><th>Grundlage</th><th style="text-align:right">Betrag</th></tr></thead>
                    <tbody>
                        <tr><td>Jahresgewinn (vorläufig)</td><td>EÜR / GuV</td><td style="text-align:right">${Utils.formatCurrency(fin.gewinn)}</td></tr>
                        ${calc.verlustabzug > 0 ? `
                        <tr><td>− Verlustabzug §10d EStG</td><td>${calc.verlustabzug < calc.verlustvortrag ? 'Mindestbesteuerung' : 'Aus Vorjahr'}</td><td style="text-align:right;color:var(--success)">− ${Utils.formatCurrency(calc.verlustabzug)}</td></tr>
                        ` : ''}
                        <tr style="font-weight:600;"><td>= Zu versteuerndes Einkommen</td><td></td><td style="text-align:right">${Utils.formatCurrency(calc.zvE)}</td></tr>

                        <tr><td colspan="3" style="padding-top:14px;font-weight:700;color:var(--text-muted);font-size:12px;">KÖRPERSCHAFTSTEUER</td></tr>
                        <tr><td>KSt (${(calc.kstSatz * 100).toLocaleString('de-DE')}%)</td><td>§23 Abs. 1 KStG</td><td style="text-align:right;color:var(--danger)">${Utils.formatCurrency(calc.kst)}</td></tr>
                        <tr><td>+ SolZ (5,5% auf KSt)</td><td>§4 SolZG</td><td style="text-align:right;color:var(--danger)">${Utils.formatCurrency(calc.solz)}</td></tr>
                        <tr style="font-weight:600;"><td>= KSt + SolZ gesamt</td><td>${(this._gesamtSatz(year) * 100).toLocaleString('de-DE', { maximumFractionDigits: 3 })}%</td><td style="text-align:right;color:var(--danger)">${Utils.formatCurrency(calc.gesamt)}</td></tr>

                        <tr><td colspan="3" style="padding-top:14px;font-weight:700;color:var(--text-muted);font-size:12px;">GEWERBESTEUER</td></tr>
                        ${calc.verlustabzugGewSt > 0 ? `<tr><td>Gewerbeertrag nach Verlustabzug §10a GewStG</td><td>${calc.gewstVortragGesetzt ? '' : 'Vortrag wie KSt angenommen'}</td><td style="text-align:right">${Utils.formatCurrency(calc.gewerbeertrag)}</td></tr>` : ''}
                        <tr><td>Steuermessbetrag (3,5%)</td><td>§11 GewStG</td><td style="text-align:right">${Utils.formatCurrency(calc.messbetrag)}</td></tr>
                        <tr><td>× Hebesatz (${calc.hebesatz}%)</td><td>Gemeinde</td><td style="text-align:right;color:var(--danger)">${Utils.formatCurrency(calc.gewSt)}</td></tr>
                        <tr><td style="font-size:11px;color:var(--text-muted);">Kein Freibetrag für Kapitalgesellschaften</td><td></td><td></td></tr>

                        <tr class="euer-result">
                            <td><strong>Gesamtsteuerbelastung</strong></td>
                            <td></td>
                            <td style="text-align:right;font-size:1.1rem;color:var(--danger);font-weight:800;">${Utils.formatCurrency(calc.steuerGesamt)}</td>
                        </tr>
                        <tr><td><strong>Gewinn nach Steuern</strong></td><td></td>
                            <td style="text-align:right;font-size:1.1rem;color:var(--success);font-weight:800;">${Utils.formatCurrency(jahresueberschussNachSteuern)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        ${isUG ? `
        <!-- UG Thesaurierung -->
        <div class="card" style="margin-bottom:16px;padding:16px;background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.3);">
            <div style="font-weight:700;font-size:14px;color:var(--warning);margin-bottom:6px;">UG-Thesaurierungspflicht (§5a GmbHG)</div>
            <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">
                <strong>25% des Jahresüberschusses nach Steuern</strong> müssen als Rücklage einbehalten werden,
                bis Stammkapital von <strong>25.000 €</strong> erreicht ist.<br>
                Jahresüberschuss nach Steuern ${year}: <strong>${Utils.formatCurrency(jahresueberschussNachSteuern)}</strong><br>
                Pflicht-Rücklage ${year} (25% davon): <strong>${Utils.formatCurrency(thesaurierung)}</strong><br>
                Maximal ausschüttbar: <strong>${Utils.formatCurrency(Math.max(0, jahresueberschussNachSteuern - thesaurierung))}</strong>
            </div>
        </div>` : ''}

        <!-- Verlustvortrag -->
        <div class="card" style="margin-bottom:16px;padding:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <div style="font-weight:700;font-size:14px;">Verlustvortrag §10d EStG</div>
            </div>
            <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;">
                <div class="form-group" style="flex:1;min-width:200px;">
                    <label class="form-label" for="kstVerlust">KSt-Verlustvortrag aus Vorjahr (€)</label>
                    <input type="number" step="0.01" min="0" max="999999999" class="form-input" id="kstVerlust" value="${calc.verlustvortrag || ''}" placeholder="0,00">
                </div>
                <div class="form-group" style="flex:1;min-width:200px;">
                    <label class="form-label" for="kstVerlustGewSt">Gewerbesteuer-Verlustvortrag (€)</label>
                    <input type="number" step="0.01" min="0" max="999999999" class="form-input" id="kstVerlustGewSt" value="${calc.gewstVortragGesetzt ? calc.verlustvortragGewSt : ''}" placeholder="wie KSt">
                </div>
                <button class="btn btn-primary" id="saveVerlustBtn" style="height:38px;">Speichern</button>
            </div>
            <div class="form-hint">Beide Vorträge stellt das Finanzamt getrennt fest. Über 1 Mio. € ist der Abzug begrenzt (Mindestbesteuerung: KSt ${Math.round(this._mindestbesteuerung(year).kstQuote * 100)} %, GewSt ${Math.round(this._mindestbesteuerung(year).gewstQuote * 100)} % des übersteigenden Betrags).</div>
            ${(calc.neuerVerlust > 0 || calc.neuerVerlustGewSt > 0) ? `<div style="margin-top:10px;font-size:12px;color:var(--warning);">
                Verbleibender Verlustvortrag für ${year + 1}: KSt <strong>${Utils.formatCurrency(calc.neuerVerlust)}</strong> · GewSt <strong>${Utils.formatCurrency(calc.neuerVerlustGewSt)}</strong>
            </div>` : ''}
        </div>

        <!-- Vorauszahlungen -->
        <div class="card" style="padding:20px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                <div>
                    <div style="font-weight:700;font-size:14px;">KSt-Vorauszahlungen ${year}</div>
                    <div style="font-size:12px;color:var(--text-muted);">Fällig: 10.03. / 10.06. / 10.09. / 10.12.</div>
                </div>
                <button class="btn btn-primary btn-small" id="addKstVzBtn">+ Vorauszahlung</button>
            </div>
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="border-bottom:1px solid var(--border);">
                    <th style="padding:6px 8px;font-size:11px;text-align:left;color:var(--text-muted);">Datum</th>
                    <th style="padding:6px 8px;font-size:11px;text-align:left;color:var(--text-muted);">Quartal</th>
                    <th style="padding:6px 8px;font-size:11px;text-align:left;color:var(--text-muted);">Notiz</th>
                    <th style="padding:6px 8px;font-size:11px;text-align:right;color:var(--text-muted);">Betrag</th>
                    <th style="width:36px;"></th>
                </tr></thead>
                <tbody>
                ${vz.length === 0
                    ? `<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text-muted);">Keine Vorauszahlungen</td></tr>`
                    : vz.map(v => `<tr style="border-bottom:1px solid var(--border);">
                        <td style="padding:7px 8px;font-size:12px;">${Utils.escapeHtml(v.datum)}</td>
                        <td style="padding:7px 8px;font-size:12px;">Q${v.quartal}</td>
                        <td style="padding:7px 8px;font-size:12px;color:var(--text-secondary);">${Utils.escapeHtml(v.notiz || '')}</td>
                        <td style="padding:7px 8px;font-size:12px;font-weight:700;text-align:right;">${Utils.formatCurrency(v.betrag)}</td>
                        <td><button style="background:none;border:none;cursor:pointer;color:var(--text-muted);" data-action="kst-del-vz" data-args='["${v.id}"]' aria-label="Löschen"><i class="ti ti-trash" aria-hidden="true"></i></button></td>
                    </tr>`).join('')}
                </tbody>
                ${vz.length > 0 ? `<tfoot><tr style="font-weight:700;">
                    <td colspan="3" style="padding:8px;">Summe Vorauszahlungen</td>
                    <td style="padding:8px;text-align:right;color:var(--success);">${Utils.formatCurrency(vzSum)}</td>
                    <td></td>
                </tr><tr><td colspan="3" style="padding:4px 8px;font-size:12px;color:var(--text-muted);">Noch offen</td>
                    <td style="padding:4px 8px;text-align:right;font-weight:700;color:${calc.gesamt - vzSum > 0.01 ? 'var(--danger)' : 'var(--success)'};">${Utils.formatCurrency(Math.max(0, calc.gesamt - vzSum))}</td>
                    <td></td></tr></tfoot>` : ''}
            </table>
        </div>

        <div class="card" style="margin-top:16px;padding:14px 16px;">
            <div style="font-size:12px;color:var(--text-muted);line-height:1.7;">
                <strong>§1 KStG:</strong> Körperschaftsteuerpflicht für Kapitalgesellschaften.<br>
                <strong>§23 KStG:</strong> Steuersatz ${(this._kstSatz(year) * 100).toLocaleString('de-DE')}% für ${year} (15% bis 2027, danach jährlich −1 Punkt bis 10% ab 2032).<br>
                <strong>§4 SolZG:</strong> Solidaritätszuschlag 5,5% auf KSt.<br>
                <strong>GewSt:</strong> Kapitalgesellschaften haben <strong>keinen Freibetrag</strong> (§11 Abs. 1 GewStG gilt nur für Personengesellschaften).<br>
                <strong>§5a GmbHG (UG):</strong> 25% Thesaurierungspflicht bis 25.000 € Stammkapital.<br>
                Unverbindliche Berechnung — Steuerberater hinzuziehen.
            </div>
        </div>`;
    },

    // ── Modals ──
    _openVzModal() {
        const today = new Date().toLocaleDateString('sv-SE');
        const defQ = Math.floor(new Date().getMonth() / 3) + 1;
        App.showModal('KSt-Vorauszahlung erfassen', `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Datum *</label>
                        <input type="date" class="form-input" id="kvz_datum" value="${today}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Quartal</label>
                        <select class="form-select" id="kvz_q">
                            ${[1,2,3,4].map(q => `<option value="${q}" ${q === defQ ? 'selected' : ''}>Q${q}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Betrag (€) *</label>
                    <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="kvz_betrag" placeholder="0,00">
                </div>
                <div class="form-group">
                    <label class="form-label">Notiz</label>
                    <input type="text" class="form-input" id="kvz_notiz" maxlength="300">
                </div>
            </div>`,
        `<button class="btn" data-action="close-modal">Abbrechen</button>
         <button class="btn btn-primary" id="saveKvzBtn">Speichern</button>`);

        document.getElementById('saveKvzBtn').addEventListener('click', () => {
            const datum  = Utils.getDateInputValue('kvz_datum');
            const betrag = parseFloat(document.getElementById('kvz_betrag').value);
            if (!datum || !Number.isFinite(betrag) || betrag <= 0) { Utils.showToast('Pflichtfelder', 'warning'); return; }

            const data = this._getData();
            const y = this._year;
            if (!data[y]) data[y] = {};
            if (!data[y].vorauszahlungen) data[y].vorauszahlungen = [];
            data[y].vorauszahlungen.push({
                id: Store.generateId(),
                datum,
                quartal: parseInt(document.getElementById('kvz_q').value),
                betrag,
                notiz: document.getElementById('kvz_notiz').value.trim(),
                createdAt: new Date().toISOString()
            });
            this._saveData(data);
            App.closeModal();
            Utils.showToast('Vorauszahlung gespeichert', 'success');
            this._refresh();
        });
    },

    _deleteVz(id) {
        if (!confirm('Vorauszahlung löschen?')) return;
        const data = this._getData();
        const y = this._year;
        if (data[y] && data[y].vorauszahlungen) {
            data[y].vorauszahlungen = data[y].vorauszahlungen.filter(v => v.id !== id);
            this._saveData(data);
        }
        Utils.showToast('Gelöscht', 'success');
        this._refresh();
    },

    _saveVerlustvortrag() {
        const val = parseFloat(document.getElementById('kstVerlust').value) || 0;
        if (val < 0) { Utils.showToast('Verlustvortrag darf nicht negativ sein', 'warning'); return; }
        const data = this._getData();
        const y = this._year;
        if (!data[y]) data[y] = {};
        data[y].verlustvortrag = val;
        const gewStRoh = (document.getElementById('kstVerlustGewSt') || {}).value;
        if (gewStRoh === undefined || gewStRoh === '') delete data[y].verlustvortragGewSt;
        else {
            const g = parseFloat(gewStRoh) || 0;
            if (g < 0) { Utils.showToast('Verlustvortrag darf nicht negativ sein', 'warning'); return; }
            data[y].verlustvortragGewSt = g;
        }
        this._saveData(data);
        Utils.showToast('Verlustvortrag gespeichert', 'success');
        this._refresh();
    },

    _exportCSV() {
        const year = this._year;
        const fin  = this._calcGewinn(year);
        const calc = this._calcKSt(fin.gewinn, year);
        const rf   = typeof Rechtsform !== 'undefined' ? Rechtsform.get() : '?';

        const rows = [
            ['Körperschaftsteuer Export', rf, year],
            [''],
            ['Position', 'Betrag EUR'],
            ['Jahresgewinn', fin.gewinn.toFixed(2)],
            ['Verlustabzug KSt', (calc.verlustabzug || 0).toFixed(2)],
            ['Verlustabzug GewSt', (calc.verlustabzugGewSt || 0).toFixed(2)],
            ['Zu versteuerndes Einkommen', calc.zvE.toFixed(2)],
            ['KSt (' + (calc.kstSatz * 100).toLocaleString('de-DE') + '%)', calc.kst.toFixed(2)],
            ['SolZ (5,5%)', calc.solz.toFixed(2)],
            ['KSt + SolZ', calc.gesamt.toFixed(2)],
            ['GewSt (Hebesatz ' + calc.hebesatz + '%)', calc.gewSt.toFixed(2)],
            ['Gesamtsteuerbelastung', calc.steuerGesamt.toFixed(2)],
            ['Effektiver Steuersatz', calc.effektiverSatz.toFixed(1) + '%'],
        ];
        Utils.downloadCSV(rows, `kst_${rf}_${year}.csv`);
        Utils.showToast('CSV exportiert', 'success');
    },

    _refresh() {
        const el = document.getElementById('content');
        if (!el) return;
        el.innerHTML = this.render();
        this.init();
    },

    init() {
        const ySel = document.getElementById('kstYear');
        if (ySel) ySel.addEventListener('change', () => { this._year = parseInt(ySel.value); this._refresh(); });

        const vzBtn = document.getElementById('addKstVzBtn');
        if (vzBtn) vzBtn.addEventListener('click', () => this._openVzModal());

        const verlBtn = document.getElementById('saveVerlustBtn');
        if (verlBtn) verlBtn.addEventListener('click', () => this._saveVerlustvortrag());
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'kst-export': function () { Koerperschaftsteuer._exportCSV(); },
    'kst-del-vz': function (id) { Koerperschaftsteuer._deleteVz(id); }
});
