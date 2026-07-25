// ============================================
// Vorsteuer-Modul — Detailliertes VAT-Tracking
// §15 UStG Vorsteuerabzug, §13b Reverse Charge,
// Innergemeinschaftliche Erwerbe §1a UStG
// ============================================
const Vorsteuer = {

    EU_LAENDER: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'],

    _year:  new Date().getFullYear(),
    _month: null,  // null = Jahresübersicht
    _tab:   'uebersicht',

    // ── Daten laden ──
    _getEntries() {
        return Store.get('vorsteuer_entries') || [];
    },
    _saveEntries(data) {
        Store.set('vorsteuer_entries', data);
    },

    // ── Vorsteuer aus Einkäufen berechnen (per-item, nicht flat rate) ──
    _calcFromPurchases(startDate, endDate) {
        const purchases = (Store.getPurchases ? Store.getPurchases() : Store.get('purchases') || [])
            .filter(p => Utils.isInPeriod(p.datum, startDate, endDate) && !p.storniert);

        let vst19 = 0, vst7 = 0, netto19 = 0, netto7 = 0;
        purchases.forEach(p => {
            // Einkäufe tragen den Satz als ustSatz (nicht steuersatz) und 0 ist ein gültiger
            // Wert (Privatankauf ohne VSt-Abzug) — darf nicht per || auf 19 fallen
            const rateRaw = (p.ustSatz != null && p.ustSatz !== '') ? parseFloat(p.ustSatz) : 19;
            const rate = isNaN(rateRaw) ? 19 : rateRaw;
            if (rate === 0) return; // steuerfrei/Privat — keine Vorsteuer
            const brutto = (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
            const netto = brutto / (1 + rate / 100);
            const vst = brutto - netto;
            if (rate === 7) {
                vst7 += vst;
                netto7 += netto;
            } else {
                vst19 += vst;
                netto19 += netto;
            }
        });
        return { vst19, vst7, netto19, netto7, count: purchases.length };
    },

    // ── Vorsteuer aus Betriebsausgaben ──
    _calcFromExpenses(startDate, endDate) {
        const expenses = (Store.getExpenses ? Store.getExpenses() : Store.get('ausgaben') || [])
            .filter(e => Utils.isInPeriod(e.datum, startDate, endDate));

        let vst19 = 0, vst7 = 0, vst0 = 0, netto19 = 0, netto7 = 0;
        expenses.forEach(e => {
            // 0 ist ein gültiger Satz (steuerfreie Ausgaben: Versicherung, Porto, Bankgebühren) —
            // die ||-Kette machte den 0%-Zweig unerreichbar und kreditierte immer 19/119
            const rawVal = (e.ustSatz != null && e.ustSatz !== '') ? e.ustSatz
                         : ((e.steuersatz != null && e.steuersatz !== '') ? e.steuersatz : 19);
            const rateRaw = parseFloat(rawVal);
            const rate = isNaN(rateRaw) ? 19 : rateRaw;
            const brutto = parseFloat(e.betrag) || 0;
            if (rate === 0) {
                vst0 += brutto; // kein Vorsteuerabzug
                return;
            }
            const netto = brutto / (1 + rate / 100);
            const vst = brutto - netto;
            if (rate === 7) {
                vst7 += vst;
                netto7 += netto;
            } else {
                vst19 += vst;
                netto19 += netto;
            }
        });
        return { vst19, vst7, vst0, netto19, netto7, count: expenses.length };
    },

    // ── §14 UStG / §33 UStDV Beleg-Vollständigkeit ──
    // Kleinbetragsrechnung (Brutto ≤250€, §33 UStDV) braucht nur Aussteller-Name; darüber
    // zusätzlich Steuernr./USt-IdNr. des Ausstellers (Rechnungsnummer/Anschrift werden aktuell
    // nicht strukturiert erfasst — reine Namens-/Steuer-ID-Prüfung ist eine Annäherung, kein
    // vollständiger §14-Check, aber deckt den häufigsten Lückenfall ab).
    _belegCheck(record, brutto) {
        // `haendler` ist das Lager-Feld für denselben Sachverhalt (Verkäufer/Aussteller) — mitzählen,
        // sonst meldet der Check bei Lager-Artikeln fälschlich einen fehlenden Aussteller-Namen.
        const name = ((record.lieferantName || record.lieferant || record.haendler || '')).trim();
        const steuerId = (record.lieferantSteuerId || '').trim();
        const kleinbetrag = brutto <= 250;
        const missing = [];
        if (!name) missing.push('Aussteller-Name');
        if (!kleinbetrag && !steuerId) missing.push('Steuernr./USt-IdNr.');
        return { complete: missing.length === 0, kleinbetrag, missing };
    },

    // Nur Vorsteuer-relevante Einträge zählen (Satz >0) — bei 0% besteht zwar Aufbewahrungs-
    // pflicht, aber kein Vorsteuerabzug, den ein fehlender Beleg gefährden könnte.
    _belegSummary(startDate, endDate) {
        const purchases = (Store.getPurchases ? Store.getPurchases() : Store.get('purchases') || [])
            .filter(p => Utils.isInPeriod(p.datum, startDate, endDate) && !p.storniert)
            .filter(p => { const r = (p.ustSatz != null && p.ustSatz !== '') ? parseFloat(p.ustSatz) : 19; return !isNaN(r) && r > 0; });
        const expenses = (Store.getExpenses ? Store.getExpenses() : Store.get('ausgaben') || [])
            .filter(e => Utils.isInPeriod(e.datum, startDate, endDate))
            .filter(e => { const raw = (e.ustSatz != null && e.ustSatz !== '') ? e.ustSatz : ((e.steuersatz != null && e.steuersatz !== '') ? e.steuersatz : 19); const r = parseFloat(raw); return !isNaN(r) && r > 0; });

        let complete = 0;
        purchases.forEach(p => {
            const brutto = (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
            if (this._belegCheck(p, brutto).complete) complete++;
        });
        expenses.forEach(e => {
            if (this._belegCheck(e, parseFloat(e.betrag) || 0).complete) complete++;
        });
        return { total: purchases.length + expenses.length, complete };
    },

    // ── Manuelle Vorsteuer-Einträge (§13b, EU-Erwerbe, etc.) ──
    _calcManualEntries(startDate, endDate) {
        const entries = this._getEntries()
            .filter(e => Utils.isInPeriod(e.datum, startDate, endDate));

        let reverseCharge = 0, igErwerb = 0, sonstige = 0;
        let rcCount = 0, igCount = 0;

        entries.forEach(e => {
            const betrag = parseFloat(e.vorsteuerBetrag) || 0;
            switch (e.typ) {
                case 'reverse_charge':
                    reverseCharge += betrag;
                    rcCount++;
                    break;
                case 'ig_erwerb':
                    igErwerb += betrag;
                    igCount++;
                    break;
                default:
                    sonstige += betrag;
            }
        });
        return { reverseCharge, igErwerb, sonstige, rcCount, igCount, entries };
    },

    // ── Gesamtberechnung ──
    _calcTotal(startDate, endDate) {
        const purch  = this._calcFromPurchases(startDate, endDate);
        const exp    = this._calcFromExpenses(startDate, endDate);
        const manual = this._calcManualEntries(startDate, endDate);

        const totalVorsteuer = purch.vst19 + purch.vst7
            + exp.vst19 + exp.vst7
            + manual.reverseCharge + manual.igErwerb + manual.sonstige;

        return { purch, exp, manual, totalVorsteuer };
    },

    // Zeitraum-Helfer
    _periodStart(year, month) {
        if (month !== null && month !== undefined) {
            return `${year}-${String(month + 1).padStart(2, '0')}-01`;
        }
        return `${year}-01-01`;
    },
    _periodEnd(year, month) {
        if (month !== null && month !== undefined) {
            const d = new Date(year, month + 1, 0);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        return `${year}-12-31`;
    },

    // ── Haupt-Render ──
    render() {
        const settings = Store.getSettings();
        if ((settings.ustMode || 'klein') === 'klein') {
            return `
            <div class="page-header"><h2><i class="ti ti-receipt-tax" style="margin-right:6px;"></i> Vorsteuer</h2></div>
            <div class="card" style="padding:32px;text-align:center;">
                <div style="font-size:48px;margin-bottom:16px;">🧾</div>
                <h3>Nur für Regelbesteuerer</h3>
                <p style="color:var(--text-muted);margin:8px 0 20px;">
                    Als <strong>Kleinunternehmer (§19 UStG)</strong> hast du keinen Vorsteuerabzug.<br>
                    Wechsle in den Einstellungen zur Regelbesteuerung.
                </p>
                <button class="btn btn-primary" data-action="navigate" data-args=\'["euer"]\'>USt-Modus ändern</button>
            </div>`;
        }

        const year  = this._year;
        const month = this._month;
        const start = this._periodStart(year, month);
        const end   = this._periodEnd(year, month);
        const calc  = this._calcTotal(start, end);

        const periodLabel = month !== null
            ? new Date(year, month).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
            : `Gesamtjahr ${year}`;

        const yearOpts = Array.from({ length: 6 }, (_, i) => 2022 + i)
            .map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');

        const monthOpts = `<option value="-1" ${month === null ? 'selected' : ''}>Gesamtjahr</option>` +
            Array.from({ length: 12 }, (_, i) =>
                `<option value="${i}" ${month === i ? 'selected' : ''}>${new Date(2000, i).toLocaleDateString('de-DE', { month: 'long' })}</option>`
            ).join('');

        const tabs = [
            ['uebersicht', 'Übersicht'],
            ['einkauf',     'Wareneinkauf'],
            ['ausgaben',    'Betriebsausgaben'],
            ['s13b',        '§13b Reverse Charge'],
            ['ig',          'EU-Erwerbe'],
            ['eintraege',   'Manuelle Einträge'],
        ];

        return `
        <div class="page-header">
            <h2><i class="ti ti-receipt-tax" style="margin-right:6px;"></i> Vorsteuer</h2>
            <div class="page-header-actions no-print">
                <select class="form-select" id="vstYear" style="width:90px;">${yearOpts}</select>
                <select class="form-select" id="vstMonth" style="width:140px;">${monthOpts}</select>
            </div>
        </div>

        <!-- KPI Cards -->
        <div class="stats-grid" style="margin-bottom:16px;">
            <div class="card stat-card success">
                <div class="card-label">Gesamt-Vorsteuer</div>
                <div class="card-value">${Utils.formatCurrency(calc.totalVorsteuer)}</div>
                <div class="card-subtitle">${periodLabel}</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Vorsteuer Einkauf</div>
                <div class="card-value">${Utils.formatCurrency(calc.purch.vst19 + calc.purch.vst7)}</div>
                <div class="card-subtitle">${calc.purch.count} Einkäufe</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Vorsteuer Ausgaben</div>
                <div class="card-value">${Utils.formatCurrency(calc.exp.vst19 + calc.exp.vst7)}</div>
                <div class="card-subtitle">${calc.exp.count} Ausgaben</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">§13b + EU-Erwerbe</div>
                <div class="card-value">${Utils.formatCurrency(calc.manual.reverseCharge + calc.manual.igErwerb)}</div>
                <div class="card-subtitle">${calc.manual.rcCount + calc.manual.igCount} Einträge</div>
            </div>
        </div>

        <!-- Tab Bar -->
        <div style="display:flex;gap:2px;margin-bottom:16px;background:var(--bg-secondary);border-radius:10px;padding:4px;flex-wrap:wrap;">
            ${tabs.map(([key, label]) => `
                <button class="vst-tab-btn" data-vst-tab="${key}" style="flex:1;min-width:100px;padding:8px 10px;border:none;border-radius:8px;cursor:pointer;font-size:11px;font-weight:600;
                    background:${this._tab === key ? 'var(--bg-card)' : 'transparent'};
                    color:${this._tab === key ? 'var(--accent)' : 'var(--text-secondary)'};
                    box-shadow:${this._tab === key ? '0 1px 4px rgba(0,0,0,.2)' : 'none'};">
                    ${label}
                </button>`).join('')}
        </div>

        <!-- Tab Content -->
        <div id="vstTabContent">
            ${this._renderTab(calc, start, end, periodLabel)}
        </div>`;
    },

    _renderTab(calc, start, end, periodLabel) {
        switch (this._tab) {
            case 'uebersicht': return this._renderUebersicht(calc, periodLabel);
            case 'einkauf':    return this._renderEinkauf(start, end);
            case 'ausgaben':   return this._renderAusgaben(start, end);
            case 's13b':       return this._renderReverseCharge(start, end);
            case 'ig':         return this._renderIGErwerb(start, end);
            case 'eintraege':  return this._renderEintraege(start, end);
            default:           return this._renderUebersicht(calc, periodLabel);
        }
    },

    // ── Tab: Übersicht ──
    _renderUebersicht(calc, periodLabel) {
        const p = calc.purch, e = calc.exp, m = calc.manual;

        // Monatliche Aufschlüsselung für Jahresübersicht
        let monthlyRows = '';
        if (this._month === null) {
            const months = Array.from({ length: 12 }, (_, i) => {
                const s = this._periodStart(this._year, i);
                const en = this._periodEnd(this._year, i);
                const c = this._calcTotal(s, en);
                return { i, c };
            });

            monthlyRows = `
            <div class="card" style="margin-top:16px;">
                <div class="card-header"><div class="card-title">Monatliche Vorsteuer ${this._year}</div></div>
                <div class="table-container" style="border:none;">
                    <table class="data-table">
                        <thead><tr>
                            <th>Monat</th>
                            <th style="text-align:right">Einkauf</th>
                            <th style="text-align:right">Ausgaben</th>
                            <th style="text-align:right">§13b/EU</th>
                            <th style="text-align:right;font-weight:700;">Gesamt</th>
                        </tr></thead>
                        <tbody>
                            ${months.map(({ i, c }) => `
                            <tr style="cursor:pointer;" data-action="vst-month" data-args='[${i}]' >
                                <td>${new Date(2000, i).toLocaleDateString('de-DE', { month: 'long' })}</td>
                                <td style="text-align:right">${Utils.formatCurrency(c.purch.vst19 + c.purch.vst7)}</td>
                                <td style="text-align:right">${Utils.formatCurrency(c.exp.vst19 + c.exp.vst7)}</td>
                                <td style="text-align:right">${Utils.formatCurrency(c.manual.reverseCharge + c.manual.igErwerb + c.manual.sonstige)}</td>
                                <td style="text-align:right;font-weight:700;color:var(--success)">${Utils.formatCurrency(c.totalVorsteuer)}</td>
                            </tr>`).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="font-weight:700;background:var(--bg-secondary);">
                                <td>Jahressumme</td>
                                <td style="text-align:right">${Utils.formatCurrency(p.vst19 + p.vst7)}</td>
                                <td style="text-align:right">${Utils.formatCurrency(e.vst19 + e.vst7)}</td>
                                <td style="text-align:right">${Utils.formatCurrency(m.reverseCharge + m.igErwerb + m.sonstige)}</td>
                                <td style="text-align:right;color:var(--success)">${Utils.formatCurrency(calc.totalVorsteuer)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>`;
        }

        return `
        <div class="card" style="padding:20px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:16px;">Vorsteuer-Aufschlüsselung — ${periodLabel}</div>
            <div class="table-container" style="border:none;">
                <table class="euer-table">
                    <thead><tr><th>Kz.</th><th>Bezeichnung</th><th style="text-align:right">Netto</th><th style="text-align:right">Vorsteuer</th></tr></thead>
                    <tbody>
                        <tr><td colspan="4" style="font-weight:700;padding-top:12px;color:var(--text-muted);">Wareneinkauf</td></tr>
                        <tr><td>Kz. 66</td><td>Vorsteuer 19% (Einkäufe)</td><td style="text-align:right">${Utils.formatCurrency(p.netto19)}</td><td style="text-align:right;color:var(--success)">${Utils.formatCurrency(p.vst19)}</td></tr>
                        <tr><td>Kz. 66</td><td>Vorsteuer 7% (Einkäufe)</td><td style="text-align:right">${Utils.formatCurrency(p.netto7)}</td><td style="text-align:right;color:var(--success)">${Utils.formatCurrency(p.vst7)}</td></tr>

                        <tr><td colspan="4" style="font-weight:700;padding-top:12px;color:var(--text-muted);">Betriebsausgaben</td></tr>
                        <tr><td>Kz. 66</td><td>Vorsteuer 19% (Ausgaben)</td><td style="text-align:right">${Utils.formatCurrency(e.netto19)}</td><td style="text-align:right;color:var(--success)">${Utils.formatCurrency(e.vst19)}</td></tr>
                        <tr><td>Kz. 66</td><td>Vorsteuer 7% (Ausgaben)</td><td style="text-align:right">${Utils.formatCurrency(e.netto7)}</td><td style="text-align:right;color:var(--success)">${Utils.formatCurrency(e.vst7)}</td></tr>

                        ${m.reverseCharge > 0 || m.igErwerb > 0 ? `
                        <tr><td colspan="4" style="font-weight:700;padding-top:12px;color:var(--text-muted);">§13b / EU-Erwerbe</td></tr>
                        ${m.reverseCharge > 0 ? `<tr><td>Kz. 67</td><td>Vorsteuer §13b Reverse Charge</td><td style="text-align:right">—</td><td style="text-align:right;color:var(--success)">${Utils.formatCurrency(m.reverseCharge)}</td></tr>` : ''}
                        ${m.igErwerb > 0 ? `<tr><td>Kz. 61</td><td>Vorsteuer innergemeinschaftliche Erwerbe</td><td style="text-align:right">—</td><td style="text-align:right;color:var(--success)">${Utils.formatCurrency(m.igErwerb)}</td></tr>` : ''}
                        ` : ''}

                        <tr class="euer-result">
                            <td></td>
                            <td><strong>Gesamt abzugsfähige Vorsteuer</strong></td>
                            <td></td>
                            <td style="text-align:right;font-size:1.1rem;color:var(--success);font-weight:800;">${Utils.formatCurrency(calc.totalVorsteuer)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        ${monthlyRows}

        ${(() => {
            const bs = this._belegSummary(this._periodStart(this._year, this._month), this._periodEnd(this._year, this._month));
            if (bs.total === 0) return '';
            const incomplete = bs.total - bs.complete;
            const ok = incomplete === 0;
            return `
        <div class="card" style="margin-top:16px;padding:14px 16px;border:1px solid ${ok ? 'var(--success)' : 'var(--warning)'};">
            <div style="font-weight:700;font-size:13px;color:${ok ? 'var(--success)' : 'var(--warning)'};margin-bottom:4px;">
                ${ok ? '✅' : '⚠️'} Beleg-Nachweis: ${bs.complete} von ${bs.total} Vorsteuer-Buchungen vollständig dokumentiert
            </div>
            <div style="font-size:12px;color:var(--text-muted);">
                ${incomplete > 0 ? `${incomplete} Buchung(en) ohne Aussteller-Name bzw. (bei Rechnungen &gt;250€) ohne Steuernr./USt-IdNr. — Details in „Wareneinkauf"/„Betriebsausgaben".` : 'Aussteller-Name und Steuernr./USt-IdNr. sind bei allen Vorsteuer-relevanten Buchungen hinterlegt.'}
            </div>
        </div>`;
        })()}

        <div class="card" style="margin-top:16px;padding:14px 16px;">
            <div style="font-size:12px;color:var(--text-muted);line-height:1.7;">
                <strong>§15 UStG — Vorsteuerabzug:</strong> Vorsteuer darf nur abgezogen werden wenn eine ordnungsgemäße Rechnung (§14 UStG) vorliegt.<br>
                <strong>§13b UStG — Reverse Charge:</strong> Leistungsempfänger schuldet USt (z.B. Bauleistungen, EU-Dienstleistungen). Vorsteuer gleichzeitig abziehbar.<br>
                <strong>§1a UStG — Innergemeinschaftlicher Erwerb:</strong> Erwerb aus EU → Erwerbsteuer + gleichzeitiger Vorsteuerabzug.<br>
                <strong>⚠️ Unverbindlich</strong> — Beleg-Nachweis oben ist eine Vollständigkeits-Prüfung der in Stackr hinterlegten Angaben, kein Ersatz für die tatsächliche Papier-/PDF-Rechnung. Steuerberater hinzuziehen.
            </div>
        </div>`;
    },

    // ── Tab: Wareneinkauf Detail ──
    _renderEinkauf(startDate, endDate) {
        const purchases = (Store.getPurchases ? Store.getPurchases() : Store.get('purchases') || [])
            .filter(p => Utils.isInPeriod(p.datum, startDate, endDate) && !p.storniert)
            .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

        if (purchases.length === 0) {
            return `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted);">Keine Einkäufe im Zeitraum</div>`;
        }

        return `
        <div class="card" style="padding:0;overflow:hidden;">
            <div style="padding:14px 16px;border-bottom:1px solid var(--border);">
                <div style="font-weight:700;">Wareneinkauf — Vorsteuer-Details</div>
                <div style="font-size:12px;color:var(--text-muted);">${purchases.length} Einkäufe</div>
            </div>
            <div class="table-container" style="border:none;">
                <table class="data-table">
                    <thead><tr>
                        <th>Datum</th><th>Artikel</th><th style="text-align:right">Brutto</th>
                        <th style="text-align:center">USt%</th><th style="text-align:right">Netto</th>
                        <th style="text-align:right">Vorsteuer</th><th style="text-align:center">Beleg</th>
                    </tr></thead>
                    <tbody>
                        ${purchases.map(p => {
                            const rateRaw = (p.ustSatz != null && p.ustSatz !== '') ? parseFloat(p.ustSatz) : 19;
                            const rate = isNaN(rateRaw) ? 19 : rateRaw;
                            const brutto = (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
                            const netto = brutto / (1 + rate / 100);
                            const vst = brutto - netto;
                            const beleg = rate > 0 ? this._belegCheck(p, brutto) : null;
                            return `<tr>
                                <td style="white-space:nowrap;">${p.datum || '—'}</td>
                                <td>${Utils.escapeHtml((p.titel || p.name || '').substring(0, 40))}</td>
                                <td style="text-align:right">${Utils.formatCurrency(brutto)}</td>
                                <td style="text-align:center">${rate}%</td>
                                <td style="text-align:right">${Utils.formatCurrency(netto)}</td>
                                <td style="text-align:right;color:var(--success);font-weight:600;">${Utils.formatCurrency(vst)}</td>
                                <td style="text-align:center;" title="${beleg ? Utils.escapeHtml(beleg.missing.join(', ') || 'vollständig') : 'kein Vorsteuerabzug'}">${beleg ? (beleg.complete ? '✅' : '⚠️') : '—'}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    },

    // ── Tab: Betriebsausgaben Detail ──
    _renderAusgaben(startDate, endDate) {
        const expenses = (Store.getExpenses ? Store.getExpenses() : Store.get('ausgaben') || [])
            .filter(e => Utils.isInPeriod(e.datum, startDate, endDate))
            .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

        if (expenses.length === 0) {
            return `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted);">Keine Ausgaben im Zeitraum</div>`;
        }

        return `
        <div class="card" style="padding:0;overflow:hidden;">
            <div style="padding:14px 16px;border-bottom:1px solid var(--border);">
                <div style="font-weight:700;">Betriebsausgaben — Vorsteuer-Details</div>
                <div style="font-size:12px;color:var(--text-muted);">${expenses.length} Ausgaben</div>
            </div>
            <div class="table-container" style="border:none;">
                <table class="data-table">
                    <thead><tr>
                        <th>Datum</th><th>Beschreibung</th><th>Kategorie</th>
                        <th style="text-align:right">Brutto</th><th style="text-align:center">USt%</th>
                        <th style="text-align:right">Vorsteuer</th><th style="text-align:center">Beleg</th>
                    </tr></thead>
                    <tbody>
                        ${expenses.map(e => {
                            const rate = parseFloat(e.ustSatz || e.steuersatz) || 19;
                            const brutto = parseFloat(e.betrag) || 0;
                            const vst = rate > 0 ? brutto - (brutto / (1 + rate / 100)) : 0;
                            const beleg = rate > 0 ? this._belegCheck(e, brutto) : null;
                            return `<tr>
                                <td style="white-space:nowrap;">${e.datum || '—'}</td>
                                <td>${Utils.escapeHtml((e.beschreibung || e.name || '').substring(0, 40))}</td>
                                <td style="font-size:11px;color:var(--text-muted);">${Utils.escapeHtml(e.kategorie || '—')}</td>
                                <td style="text-align:right">${Utils.formatCurrency(brutto)}</td>
                                <td style="text-align:center">${rate}%</td>
                                <td style="text-align:right;color:var(--success);font-weight:600;">${Utils.formatCurrency(vst)}</td>
                                <td style="text-align:center;" title="${beleg ? Utils.escapeHtml(beleg.missing.join(', ') || 'vollständig') : 'kein Vorsteuerabzug'}">${beleg ? (beleg.complete ? '✅' : '⚠️') : '—'}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    },

    // ── Tab: §13b Reverse Charge ──
    _renderReverseCharge(startDate, endDate) {
        const entries = this._getEntries()
            .filter(e => e.typ === 'reverse_charge' && Utils.isInPeriod(e.datum, startDate, endDate));

        return `
        <div class="card" style="padding:20px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:8px;">§13b UStG — Reverse Charge</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;line-height:1.6;">
                Bei Reverse-Charge-Leistungen schuldet der <strong>Leistungsempfänger</strong> die USt.<br>
                Gleichzeitig kann Vorsteuer in gleicher Höhe abgezogen werden (Kz. 67).<br>
                <strong>Typische Fälle:</strong> Bauleistungen §13b Abs. 2 Nr. 4, EU-Dienstleistungen §13b Abs. 1,
                Gebäudereinigung §13b Abs. 2 Nr. 8, Lieferung von Mobilfunkgeräten/Tablets §13b Abs. 2 Nr. 10.
            </div>
            <button class="btn btn-primary btn-small" id="addRcBtn">+ §13b Eintrag erfassen</button>
        </div>

        ${entries.length === 0
            ? `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted);">Keine §13b-Einträge im Zeitraum</div>`
            : `<div class="card" style="padding:0;overflow:hidden;">
                <div class="table-container" style="border:none;">
                    <table class="data-table">
                        <thead><tr>
                            <th>Datum</th><th>Lieferant</th><th>Beschreibung</th><th>§13b Abs.</th>
                            <th style="text-align:right">Netto</th><th style="text-align:right">USt%</th>
                            <th style="text-align:right">Vorsteuer</th><th style="width:36px;"></th>
                        </tr></thead>
                        <tbody>
                            ${entries.map(e => `<tr>
                                <td style="white-space:nowrap;">${e.datum}</td>
                                <td>${Utils.escapeHtml(e.lieferant || '—')}</td>
                                <td>${Utils.escapeHtml(e.beschreibung || '—')}</td>
                                <td>${Utils.escapeHtml(e.paragraph || '—')}</td>
                                <td style="text-align:right">${Utils.formatCurrency(parseFloat(e.nettoBetrag) || 0)}</td>
                                <td style="text-align:right">${e.ustSatz || 19}%</td>
                                <td style="text-align:right;color:var(--success);font-weight:600;">${Utils.formatCurrency(parseFloat(e.vorsteuerBetrag) || 0)}</td>
                                <td><button style="background:none;border:none;cursor:pointer;color:var(--text-muted);" data-action="vst-del" data-args='["${e.id}"]' >🗑</button></td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`}`;
    },

    // ── Tab: Innergemeinschaftliche Erwerbe ──
    _renderIGErwerb(startDate, endDate) {
        const entries = this._getEntries()
            .filter(e => e.typ === 'ig_erwerb' && Utils.isInPeriod(e.datum, startDate, endDate));

        return `
        <div class="card" style="padding:20px;margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;margin-bottom:8px;">§1a UStG — Innergemeinschaftliche Erwerbe</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;line-height:1.6;">
                Erwerb von Waren aus einem anderen EU-Mitgliedstaat.<br>
                <strong>Pflicht:</strong> USt-IdNr. erforderlich. Erwerbsteuer in UVA melden (Kz. 89).<br>
                Gleichzeitig Vorsteuerabzug (Kz. 61).<br>
                <strong>Beleg:</strong> Rechnung des EU-Lieferanten ohne dessen nationale USt.
            </div>
            <button class="btn btn-primary btn-small" id="addIgBtn">+ EU-Erwerb erfassen</button>
        </div>

        ${entries.length === 0
            ? `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted);">Keine innergemeinschaftlichen Erwerbe im Zeitraum</div>`
            : `<div class="card" style="padding:0;overflow:hidden;">
                <div class="table-container" style="border:none;">
                    <table class="data-table">
                        <thead><tr>
                            <th>Datum</th><th>Lieferant</th><th>EU-Land</th><th>USt-IdNr.</th>
                            <th style="text-align:right">Netto</th><th style="text-align:right">Erwerbsteuer</th>
                            <th style="text-align:right">Vorsteuer</th><th style="width:36px;"></th>
                        </tr></thead>
                        <tbody>
                            ${entries.map(e => `<tr>
                                <td style="white-space:nowrap;">${e.datum}</td>
                                <td>${Utils.escapeHtml(e.lieferant || '—')}</td>
                                <td>${Utils.escapeHtml(e.euLand || '—')}</td>
                                <td style="font-family:monospace;font-size:11px;">${Utils.escapeHtml(e.ustIdNr || '—')}</td>
                                <td style="text-align:right">${Utils.formatCurrency(parseFloat(e.nettoBetrag) || 0)}</td>
                                <td style="text-align:right;color:var(--danger)">${Utils.formatCurrency(parseFloat(e.erwerbsteuer) || 0)}</td>
                                <td style="text-align:right;color:var(--success);font-weight:600;">${Utils.formatCurrency(parseFloat(e.vorsteuerBetrag) || 0)}</td>
                                <td><button style="background:none;border:none;cursor:pointer;color:var(--text-muted);" data-action="vst-del" data-args='["${e.id}"]' >🗑</button></td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`}`;
    },

    // ── Tab: Manuelle Einträge ──
    _renderEintraege(startDate, endDate) {
        const entries = this._getEntries()
            .filter(e => Utils.isInPeriod(e.datum, startDate, endDate))
            .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));

        return `
        <div class="card" style="padding:20px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div>
                    <div style="font-weight:700;font-size:15px;">Manuelle Vorsteuer-Einträge</div>
                    <div style="font-size:12px;color:var(--text-muted);">Für Sonderfälle die nicht automatisch erfasst werden</div>
                </div>
                <button class="btn btn-primary btn-small" id="addManualVstBtn">+ Eintrag</button>
            </div>
        </div>

        ${entries.length === 0
            ? `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted);">Keine manuellen Einträge</div>`
            : `<div class="card" style="padding:0;overflow:hidden;">
                <div class="table-container" style="border:none;">
                    <table class="data-table">
                        <thead><tr>
                            <th>Datum</th><th>Typ</th><th>Beschreibung</th><th>Lieferant</th>
                            <th style="text-align:right">Netto</th><th style="text-align:right">Vorsteuer</th>
                            <th style="width:36px;"></th>
                        </tr></thead>
                        <tbody>
                            ${entries.map(e => {
                                const typLabels = { reverse_charge: '§13b RC', ig_erwerb: 'EU-Erwerb', sonstige: 'Sonstige' };
                                return `<tr>
                                    <td style="white-space:nowrap;">${e.datum}</td>
                                    <td><span class="badge">${typLabels[e.typ] || e.typ}</span></td>
                                    <td>${Utils.escapeHtml(e.beschreibung || '—')}</td>
                                    <td>${Utils.escapeHtml(e.lieferant || '—')}</td>
                                    <td style="text-align:right">${Utils.formatCurrency(parseFloat(e.nettoBetrag) || 0)}</td>
                                    <td style="text-align:right;color:var(--success);font-weight:600;">${Utils.formatCurrency(parseFloat(e.vorsteuerBetrag) || 0)}</td>
                                    <td><button style="background:none;border:none;cursor:pointer;color:var(--text-muted);" data-action="vst-del" data-args='["${e.id}"]' >🗑</button></td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`}`;
    },

    // ── Modals ──
    _openRcModal() {
        const today = new Date().toLocaleDateString('sv-SE');
        App.showModal('§13b Reverse Charge erfassen', `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Datum *</label>
                        <input type="date" class="form-input" id="rc_datum" value="${today}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">§13b Absatz</label>
                        <select class="form-select" id="rc_paragraph">
                            <option value="Abs. 1">Abs. 1 — EU-Dienstleistung</option>
                            <option value="Abs. 2 Nr. 4">Abs. 2 Nr. 4 — Bauleistung</option>
                            <option value="Abs. 2 Nr. 8">Abs. 2 Nr. 8 — Gebäudereinigung</option>
                            <option value="Abs. 2 Nr. 10">Abs. 2 Nr. 10 — Mobilfunkgeräte</option>
                            <option value="Sonstige">Sonstige</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Lieferant / Dienstleister</label>
                        <input type="text" class="form-input" id="rc_lieferant" placeholder="Firma XY">
                    </div>
                    <div class="form-group">
                        <label class="form-label">USt-Satz (%)</label>
                        <select class="form-select" id="rc_ust">
                            <option value="19" selected>19%</option>
                            <option value="7">7%</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Netto-Betrag (€) *</label>
                    <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="rc_netto" placeholder="0,00">
                    <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">Vorsteuer wird automatisch berechnet</div>
                </div>
                <div class="form-group">
                    <label class="form-label">Beschreibung</label>
                    <input type="text" class="form-input" id="rc_beschr" placeholder="z.B. Bauleistung Dachsanierung">
                </div>
            </div>`,
        `<button class="btn" data-action="close-modal">Abbrechen</button>
         <button class="btn btn-primary" id="saveRcBtn">Speichern</button>`);

        document.getElementById('saveRcBtn').addEventListener('click', () => {
            const datum   = Utils.getDateInputValue('rc_datum');
            const netto   = parseFloat(document.getElementById('rc_netto').value);
            const ustSatz = parseInt(document.getElementById('rc_ust').value);
            if (!datum || isNaN(netto) || netto <= 0) { Utils.showToast('Pflichtfelder ausfüllen', 'warning'); return; }

            const vst = netto * (ustSatz / 100);
            const entries = this._getEntries();
            entries.push({
                id: Store.generateId(),
                typ: 'reverse_charge',
                datum,
                lieferant: document.getElementById('rc_lieferant').value.trim(),
                paragraph: document.getElementById('rc_paragraph').value,
                nettoBetrag: netto,
                ustSatz,
                vorsteuerBetrag: vst,
                beschreibung: document.getElementById('rc_beschr').value.trim(),
                createdAt: new Date().toISOString()
            });
            this._saveEntries(entries);
            App.closeModal();
            Utils.showToast('§13b-Eintrag gespeichert', 'success');
            this._refresh();
        });
    },

    _openIgModal() {
        const today = new Date().toLocaleDateString('sv-SE');
        const euLaender = Vorsteuer.EU_LAENDER;

        App.showModal('Innergemeinschaftlichen Erwerb erfassen', `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Datum *</label>
                        <input type="date" class="form-input" id="ig_datum" value="${today}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">EU-Land *</label>
                        <select class="form-select" id="ig_land">
                            ${euLaender.map(l => `<option value="${l}">${l}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Lieferant</label>
                        <input type="text" class="form-input" id="ig_lieferant" placeholder="EU-Unternehmen">
                    </div>
                    <div class="form-group">
                        <label class="form-label">USt-IdNr. Lieferant</label>
                        <input type="text" class="form-input" id="ig_ustid" placeholder="z.B. ATU12345678">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Netto-Betrag (€) *</label>
                        <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="ig_netto" placeholder="0,00">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Steuersatz DE (%)</label>
                        <select class="form-select" id="ig_ust">
                            <option value="19" selected>19%</option>
                            <option value="7">7%</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Beschreibung</label>
                    <input type="text" class="form-input" id="ig_beschr" placeholder="z.B. Ware aus Österreich">
                </div>
            </div>`,
        `<button class="btn" data-action="close-modal">Abbrechen</button>
         <button class="btn btn-primary" id="saveIgBtn">Speichern</button>`);

        document.getElementById('saveIgBtn').addEventListener('click', () => {
            const datum = Utils.getDateInputValue('ig_datum');
            const netto = parseFloat(document.getElementById('ig_netto').value);
            const ustSatz = parseInt(document.getElementById('ig_ust').value);
            if (!datum || isNaN(netto) || netto <= 0) { Utils.showToast('Pflichtfelder ausfüllen', 'warning'); return; }

            const erwerbsteuer = netto * (ustSatz / 100);
            const entries = this._getEntries();
            entries.push({
                id: Store.generateId(),
                typ: 'ig_erwerb',
                datum,
                lieferant: document.getElementById('ig_lieferant').value.trim(),
                euLand: document.getElementById('ig_land').value,
                ustIdNr: document.getElementById('ig_ustid').value.trim(),
                nettoBetrag: netto,
                ustSatz,
                erwerbsteuer,
                vorsteuerBetrag: erwerbsteuer,  // Vorsteuer = Erwerbsteuer (neutral)
                beschreibung: document.getElementById('ig_beschr').value.trim(),
                createdAt: new Date().toISOString()
            });
            this._saveEntries(entries);
            App.closeModal();
            Utils.showToast('EU-Erwerb gespeichert', 'success');
            this._refresh();
        });
    },

    _openManualModal() {
        const today = new Date().toLocaleDateString('sv-SE');
        App.showModal('Vorsteuer-Eintrag manuell erfassen', `
            <div style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Datum *</label>
                        <input type="date" class="form-input" id="mv_datum" value="${today}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Typ</label>
                        <select class="form-select" id="mv_typ">
                            <option value="reverse_charge">§13b Reverse Charge</option>
                            <option value="ig_erwerb">Innergemeinschaftlicher Erwerb</option>
                            <option value="sonstige">Sonstige Vorsteuer</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Netto-Betrag (€) *</label>
                        <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="mv_netto" placeholder="0,00">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Vorsteuer-Betrag (€) *</label>
                        <input type="number" step="0.01" min="0" max="99999999" class="form-input" id="mv_vst" placeholder="0,00">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Lieferant</label>
                    <input type="text" class="form-input" id="mv_lieferant">
                </div>
                <div class="form-group">
                    <label class="form-label">Beschreibung</label>
                    <input type="text" class="form-input" id="mv_beschr">
                </div>
            </div>`,
        `<button class="btn" data-action="close-modal">Abbrechen</button>
         <button class="btn btn-primary" id="saveMvBtn">Speichern</button>`);

        document.getElementById('saveMvBtn').addEventListener('click', () => {
            const datum = Utils.getDateInputValue('mv_datum');
            const netto = parseFloat(document.getElementById('mv_netto').value);
            const vst   = parseFloat(document.getElementById('mv_vst').value);
            if (!datum || isNaN(vst) || vst <= 0) { Utils.showToast('Pflichtfelder ausfüllen', 'warning'); return; }

            const entries = this._getEntries();
            const entry = {
                id: Store.generateId(),
                typ: document.getElementById('mv_typ').value,
                datum,
                nettoBetrag: isNaN(netto) ? 0 : netto,
                vorsteuerBetrag: vst,
                lieferant: document.getElementById('mv_lieferant').value.trim(),
                beschreibung: document.getElementById('mv_beschr').value.trim(),
                createdAt: new Date().toISOString()
            };
            // IG-Erwerb: Erwerbsteuer entsteht 1:1 zur Vorsteuer (§1a UStG) — ohne dieses Feld
            // zöge die UVA nur Kz. 61 ab, ohne die gegenläufige Erwerbsteuer (Kz. 89) anzusetzen
            if (entry.typ === 'ig_erwerb') entry.erwerbsteuer = vst;
            entries.push(entry);
            this._saveEntries(entries);
            App.closeModal();
            Utils.showToast('Eintrag gespeichert', 'success');
            this._refresh();
        });
    },

    _deleteEntry(id) {
        if (!confirm('Eintrag löschen?')) return;
        this._saveEntries(this._getEntries().filter(e => e.id !== id));
        Utils.showToast('Gelöscht', 'success');
        this._refresh();
    },

    _selectMonth(m) {
        this._month = m;
        this._refresh();
    },

    _refresh() {
        const el = document.getElementById('content');
        if (!el) return;
        el.innerHTML = this.render();
        this.init();
    },

    init() {
        // Year/Month selectors
        const ySel = document.getElementById('vstYear');
        const mSel = document.getElementById('vstMonth');
        if (ySel) ySel.addEventListener('change', () => { this._year = parseInt(ySel.value); this._refresh(); });
        if (mSel) mSel.addEventListener('change', () => {
            const v = parseInt(mSel.value);
            this._month = v < 0 ? null : v;
            this._refresh();
        });

        // Tab buttons
        document.querySelectorAll('.vst-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._tab = btn.dataset.vstTab;
                this._refresh();
            });
        });

        // Add buttons
        const rcBtn = document.getElementById('addRcBtn');
        if (rcBtn) rcBtn.addEventListener('click', () => this._openRcModal());
        const igBtn = document.getElementById('addIgBtn');
        if (igBtn) igBtn.addEventListener('click', () => this._openIgModal());
        const mvBtn = document.getElementById('addManualVstBtn');
        if (mvBtn) mvBtn.addEventListener('click', () => this._openManualModal());
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'vst-month': function (i) { Vorsteuer._selectMonth(i); },
    'vst-del':   function (id) { Vorsteuer._deleteEntry(id); }
});
