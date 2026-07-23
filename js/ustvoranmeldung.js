// ============================================
// USt-Voranmeldung (UVA)
// §18 UStG – Nur für Regelbesteuerung
// ============================================
const UstVoranmeldung = {
    _year:    new Date().getFullYear(),
    _quartal: Math.floor(new Date().getMonth() / 3), // 0-3, nur im Quartal-Modus genutzt
    _monat:   new Date().getMonth(),                 // 0-11, nur im Monat-Modus genutzt

    _isRegel() {
        return (Store.getSettings().ustMode || 'klein') === 'regel';
    },

    // Soll-Versteuerung (§13 UStG, Regelfall) = Rechnungsdatum zählt, egal ob bezahlt.
    // Ist-Versteuerung (§20 UStG, nur bis 800k€ Vorjahresumsatz/Freiberufler) = Zahlungsdatum zählt.
    _isSoll() {
        return (Store.getSettings().ustVersteuerungsart || 'soll') !== 'ist';
    },

    // monatlich oder vierteljährlich — Pflicht monatlich bei Vorjahres-Zahllast > 7.500€ (§18 Abs. 2 UStG)
    // oder im Gründungsjahr/Folgejahr; das muss der Nutzer selbst in den Einstellungen umstellen.
    _typ() {
        return (Store.getSettings().ustVaPeriodenTyp || 'quartal') === 'monat' ? 'monat' : 'quartal';
    },

    _idx() {
        return this._typ() === 'monat' ? this._monat : this._quartal;
    },

    // Berechnet Kennzahlen für einen Zeitraum
    _calcPeriode(startDate, endDate) {
        const purchases = Store.getPurchases().filter(p => Utils.isInPeriod(p.datum, startDate, endDate));
        const expenses  = Store.getExpenses().filter(e => Utils.isInPeriod(e.datum, startDate, endDate));
        const retouren  = Store.getRetouren().filter(r => Utils.isInPeriod(r.datum, startDate, endDate));

        // §25a UStG Differenzbesteuerung: Lookup für Sales→Purchase-Verknüpfung (Flag lebt am
        // Lager-Purchase, s. js/lager.js). Positionen/Sales mit differenzbesteuert=true werden unten
        // aus den normalen bruttoUmsatz19/7-Summen ausgeschlossen und stattdessen über die Marge
        // (SteuerBerechnung.margeEinzeldifferenz/margeGesamtdifferenz) in Kz. 81 eingerechnet.
        const purchasesById25a = {};
        Store.getPurchases(true).forEach(p => { purchasesById25a[p.id] = p; });
        const _istDiff25aSale = s => {
            const p = purchasesById25a[s.purchaseId] || (s.purchaseIds && s.purchaseIds[0] ? purchasesById25a[s.purchaseIds[0]] : null);
            return !!(p && p.differenzbesteuert);
        };
        const diff25aPositionenRoh = [];

        // Brutto-Umsätze nach Steuersatz aufteilen (Feld: steuersatz, Default: 19 nur wenn nicht gesetzt)
        const _rate = item => {
            const r = parseFloat(item.steuersatz);
            return isNaN(r) ? 19 : r;
        };
        const _brutto = item => (parseFloat(item.verkaufspreis) || 0) + (parseFloat(item.versandkostenKaeufer) || 0);

        let bruttoUmsatz19 = 0, bruttoUmsatz7 = 0;
        let nettoIgLieferung = 0, nettoIgLeistung = 0, nettoAusfuhr = 0;

        if (this._isSoll() && typeof Store.getRechInvoices === 'function') {
            // OSS (§3c UStG): sobald die EU-weite 10.000€-Jahresschwelle überschritten ist, ist für
            // EU-B2C-Fernverkäufe die USt des Ziellandes fällig statt deutscher USt — diese Rechnungen
            // dürfen dann nicht zusätzlich in die deutsche UVA einfließen (sonst Doppelbesteuerung).
            const customers  = (typeof Store.getRechCustomers === 'function') ? Store.getRechCustomers() : [];
            const euLaender  = (typeof Vorsteuer !== 'undefined') ? Vorsteuer.EU_LAENDER : [];
            const periodYear = parseInt(String(startDate).slice(0, 4), 10);
            // §3c Abs. 4 UStG: Schwellen-Überschreitung wirkt prospektiv ab dem Umsatz, der die
            // 10.000€ reißt — NICHT rückwirkend auf bereits getätigte Umsätze desselben Jahres.
            // Nur die Vorjahresschwelle (Satz 2) wirkt rückwirkend ab dem 1. Umsatz. Darum hier
            // pro Rechnung prüfen (chronologische Laufsumme), statt ein Jahres-Flag auf jede Periode
            // anzuwenden — sonst verschwinden früh im Jahr korrekt dt.-versteuerte Rechnungen aus der
            // UVA, sobald die Schwelle später im Jahr überschritten wird.
            const ossUeberInvoiceIds = (typeof OSS !== 'undefined') ? OSS._ueberSchwelleInvoiceIds(periodYear) : null;

            // Soll: alle ausgestellten Rechnungen zum Rechnungsdatum, unabhängig vom Zahlungseingang.
            // Gutschriften (Kreditnoten) laufen mit umgekehrtem Vorzeichen mit — sie mindern die
            // Bemessungsgrundlage zum Gutschriftsdatum (§17 UStG Änderung der Bemessungsgrundlage).
            Store.getRechInvoices()
                .filter(i => (i.typ === 'rechnung' || i.typ === 'gutschrift') && (i.status === 'versendet' || i.status === 'bezahlt') && Utils.isInPeriod(i.datum, startDate, endDate))
                .forEach(i => {
                    const sign = i.typ === 'gutschrift' ? -1 : 1;
                    const kunde = customers.find(c => c.id === i.kundeId);
                    const kundeLand = kunde && kunde.land;
                    // ig. Lieferung/sonstige Leistung (§4 Nr.1b+§6a bzw. §3a Abs.2 UStG): B2B-Kunde
                    // in der EU mit gültiger USt-IdNr — igArt entscheidet Kz. 41 (Ware) vs. Kz. 21 (Dienstleistung).
                    // Pro Position (nicht pro Rechnung), da eine Rechnung Ware+Leistung an denselben
                    // EU-Kunden mischen kann. i.igArt bleibt als Fallback für alte Rechnungen vor diesem Fix.
                    const istIgLieferung = !!(kundeLand && kundeLand !== 'DE' && euLaender.indexOf(kundeLand) !== -1 && kunde.ustIdNr);
                    // Ausfuhrlieferung (§4 Nr.1a + §6 UStG): Kunde außerhalb EU (Drittland)
                    const istAusfuhr = !!(kundeLand && kundeLand !== 'DE' && euLaender.indexOf(kundeLand) === -1);

                    if (ossUeberInvoiceIds && ossUeberInvoiceIds.has(i.id)) {
                        const isEuB2C = kundeLand && kundeLand !== 'DE' && euLaender.indexOf(kundeLand) !== -1 && !kunde.ustIdNr;
                        if (isEuB2C) return; // OSS-pflichtig ab Schwellen-Überschreitung — läuft über das BZSt-Portal, nicht über diese UVA
                    }
                    (i.positionen || []).forEach(pos => {
                        // §25a: kein normaler Steuersatz — Marge wird separat unten in Kz. 81 eingerechnet.
                        if (pos.differenzbesteuert) {
                            const linkedPurch = pos.lagerArtikelId ? purchasesById25a[pos.lagerArtikelId] : null;
                            diff25aPositionenRoh.push({
                                verkaufspreis: sign * (parseFloat(pos.menge) || 0) * parseFloat(pos.einzelpreis || 0),
                                // sign auch hier: Gutschrift muss die Marge spiegeln, nicht nur den Verkaufspreis
                                // (sonst wird bei Gesamtdifferenz der Einkaufspreis doppelt abgezogen → Vortrag zu negativ → Unterzahlung).
                                einkaufspreis: sign * (linkedPurch ? (parseFloat(linkedPurch.einkaufspreis) || 0) : (parseFloat(pos.einkaufspreis) || 0))
                            });
                            return;
                        }
                        // menge wie auf der Rechnung selbst: leer/0 = 0 (kein ||1-Phantomumsatz)
                        const netto = sign * (parseFloat(pos.menge) || 0) * parseFloat(pos.einzelpreis || 0);
                        const rate  = parseInt(pos.mwstSatz);
                        if (rate === 7) bruttoUmsatz7 += netto * 1.07;
                        else if (rate === 19 || isNaN(rate)) bruttoUmsatz19 += netto * 1.19;
                        else if (rate === 0) {
                            // steuerfreie Position — nur ig. Lieferung/Leistung/Ausfuhr sind eigene Kennzahlen,
                            // sonstige steuerfreie Inlandsumsätze (§4 UStG divers) werden hier bewusst nicht erfasst
                            if (istIgLieferung) {
                                if ((pos.igArt || i.igArt || 'ware') === 'leistung') nettoIgLeistung += netto;
                                else nettoIgLieferung += netto;
                            } else if (istAusfuhr) nettoAusfuhr += netto;
                        }
                    });
                });
            // Direktverkäufe ohne zugehörige Rechnung (Marktplatz) weiterhin über Verkaufsdatum
            Store.getSales().filter(s => !s._invoiceId && Utils.isInPeriod(s.datum, startDate, endDate))
                .forEach(s => {
                    if (_istDiff25aSale(s)) {
                        const p = purchasesById25a[s.purchaseId] || purchasesById25a[(s.purchaseIds || [])[0]];
                        diff25aPositionenRoh.push({ verkaufspreis: _brutto(s), einkaufspreis: parseFloat(p.einkaufspreis) || 0 });
                        return;
                    }
                    const rate = _rate(s);
                    if (rate === 7) bruttoUmsatz7 += _brutto(s);
                    else if (rate !== 0) bruttoUmsatz19 += _brutto(s);
                });
        } else {
            // Ist: alle Verkäufe (Direktverkäufe + aus bezahlten Rechnungen synchronisiert) zum
            // Zahlungsdatum in Store.getSales() gebucht — anders als bei Soll gibt es hier keinen
            // separaten Rechnungs-Pfad, der Rechnungs-Umsätze schon zählt, also KEIN _invoiceId-Ausschluss.
            const sales = Store.getSales().filter(s => Utils.isInPeriod(s.datum, startDate, endDate));
            sales.filter(_istDiff25aSale).forEach(s => {
                const p = purchasesById25a[s.purchaseId] || purchasesById25a[(s.purchaseIds || [])[0]];
                diff25aPositionenRoh.push({ verkaufspreis: _brutto(s), einkaufspreis: parseFloat(p.einkaufspreis) || 0 });
            });
            const salesOhneDiff25a = sales.filter(s => !_istDiff25aSale(s));
            bruttoUmsatz7  = salesOhneDiff25a.filter(v => _rate(v) === 7).reduce((s, v) => s + _brutto(v), 0);
            bruttoUmsatz19 = salesOhneDiff25a.filter(v => { const r = _rate(v); return r !== 7 && r !== 0; }).reduce((s, v) => s + _brutto(v), 0);
        }

        // Ist-Versteuerung + EU-Geschäft: ig. Lieferung/Leistung (Kz.41/21) und OSS-Erkennung laufen
        // nur im Soll-Zweig oben — hier NUR informativ (fuer den Warnhinweis in render()) zaehlen, wie
        // viele Rechnungen/wieviel Betrag betroffen waeren, OHNE den Ist-Zahllast-Wert zu veraendern.
        let istEuHinweisAnzahl = 0, istEuHinweisBetrag = 0;
        if (!this._isSoll() && typeof Store.getRechInvoices === 'function') {
            const customers = (typeof Store.getRechCustomers === 'function') ? Store.getRechCustomers() : [];
            const euLaender = (typeof Vorsteuer !== 'undefined') ? Vorsteuer.EU_LAENDER : [];
            Store.getRechInvoices()
                .filter(i => (i.typ === 'rechnung' || i.typ === 'gutschrift') && (i.status === 'versendet' || i.status === 'bezahlt') && Utils.isInPeriod(i.datum, startDate, endDate))
                .forEach(i => {
                    const kunde = customers.find(c => c.id === i.kundeId);
                    const kundeLand = kunde && kunde.land;
                    if (!(kundeLand && kundeLand !== 'DE' && euLaender.indexOf(kundeLand) !== -1)) return;
                    const sign = i.typ === 'gutschrift' ? -1 : 1;
                    let betroffen = false, betrag = 0;
                    (i.positionen || []).forEach(pos => {
                        if (parseInt(pos.mwstSatz) !== 0) return;
                        betroffen = true;
                        betrag += sign * (parseFloat(pos.menge) || 0) * parseFloat(pos.einzelpreis || 0);
                    });
                    if (betroffen) { istEuHinweisAnzahl++; istEuHinweisBetrag += betrag; }
                });
        }

        // 7%-/19%-Retouren abziehen (§17 UStG).
        // Guard wie in der EÜR: Wurde der verknüpfte Verkauf über die Retoure storniert, ist der
        // Umsatz oben schon nicht mehr enthalten — Erstattung nicht nochmal abziehen (Doppelabzug).
        // Satz: Retouren tragen selbst keinen Steuersatz → vom verknüpften Verkauf übernehmen.
        const salesById = {};
        Store.getSales(true).forEach(s => { salesById[s.id] = s; });
        let retour7 = 0, retour19 = 0;
        retouren.forEach(r => {
            const linked = r.saleId ? salesById[r.saleId] : null;
            if (linked && linked.storniert) return;
            if (linked && _istDiff25aSale(linked)) return;
            const rate = _rate(linked || r);
            const betrag = parseFloat(r.erstattungBetrag) || 0;
            if (rate === 7) retour7 += betrag;
            else if (rate !== 0) retour19 += betrag;
        });
        const bruttoUmsatz7adj  = bruttoUmsatz7  - retour7;
        let bruttoUmsatz19adj = bruttoUmsatz19 - retour19;

        // §25a UStG Differenzbesteuerung: Marge statt Verkaufspreis in Kz. 81. Vereinfachung v1:
        // einheitlich Regelsatz 19% (Kunstgegenstände/Sammlerstücke können in Einzelfällen 7%
        // unterliegen — noch nicht recherchiert, s. plan/session-prompt-differenzbesteuerung.md).
        const differenzMethode = (Store.getSettings().differenzMethode || 'einzel') === 'gesamt' ? 'gesamt' : 'einzel';
        let diff25a;
        if (differenzMethode === 'gesamt') {
            const vortrag = Store.getDifferenzVortrag(this._year);
            const ueber750 = diff25aPositionenRoh.filter(p => p.einkaufspreis > 750);
            diff25a = SteuerBerechnung.margeGesamtdifferenz(
                diff25aPositionenRoh.filter(p => p.einkaufspreis <= 750), vortrag, 19
            );
            diff25a.margeBrutto = diff25a.bemessungsgrundlage;
            diff25a.margeNetto = diff25a.netto;
            // §25a Abs. 3+4: Gegenstände >750€ sind von der Gesamtdifferenz ausgeschlossen und
            // müssen zwingend per Einzeldifferenz versteuert werden, sonst fehlt die USt komplett.
            if (ueber750.length) {
                const einzel = SteuerBerechnung.margeEinzeldifferenz(ueber750.map(p => Object.assign({ satz: 19 }, p)));
                diff25a.margeBrutto += einzel.margeBrutto;
                diff25a.margeNetto += einzel.margeNetto;
            }
        } else {
            diff25a = SteuerBerechnung.margeEinzeldifferenz(diff25aPositionenRoh.map(p => Object.assign({ satz: 19 }, p)));
        }
        diff25a.methode = differenzMethode;
        bruttoUmsatz19adj += diff25a.margeBrutto;

        const bruttoUmsatz = bruttoUmsatz19adj + bruttoUmsatz7adj;

        // Kz. 81 + Kz. 83: Netto-Umsätze 19%
        const nettoUmsatz19 = bruttoUmsatz19adj / 1.19;
        const ust19         = nettoUmsatz19 * 0.19;

        // Kz. 86 + Kz. 35: Netto-Umsätze 7%
        const nettoUmsatz7  = bruttoUmsatz7adj / 1.07;
        const ust7          = nettoUmsatz7 * 0.07;

        // Vorsteuer getrennt nach Herkunft — ELSTER verlangt Kz. 66 (Einkäufe/Ausgaben), Kz. 61 (IG-Erwerb)
        // und Kz. 67 (§13b) als EIGENE Kennzahlen, nicht zusammengefasst!
        let vorsteuerEinkaufAusgaben = 0, vorsteuerRc = 0, vorsteuerIgErwerb = 0;
        let rcNettoAbs1 = 0, rcSteuerAbs1 = 0, rcNettoOther = 0, rcSteuerOther = 0;
        let erwerbNetto19 = 0, erwerbSteuer19 = 0, erwerbNetto7 = 0, erwerbSteuer7 = 0;
        if (typeof Vorsteuer !== 'undefined') {
            const vstCalc = Vorsteuer._calcTotal(startDate, endDate);
            // manuelle "Sonstige Vorsteuer"-Einträge gehören ebenfalls in Kz. 66
            vorsteuerEinkaufAusgaben = vstCalc.purch.vst19 + vstCalc.purch.vst7 + vstCalc.exp.vst19 + vstCalc.exp.vst7
                + (vstCalc.manual && vstCalc.manual.sonstige || 0);
            vorsteuerRc = vstCalc.manual.reverseCharge;
            vorsteuerIgErwerb = vstCalc.manual.igErwerb;

            // §13b-Steuerschuld + Erwerbsteuer aus den Einträgen selbst ermitteln (für Kz. 46/89/93 etc.)
            Vorsteuer._getEntries().filter(e => Utils.isInPeriod(e.datum, startDate, endDate)).forEach(e => {
                if (e.typ === 'reverse_charge') {
                    const netto  = parseFloat(e.nettoBetrag) || 0;
                    const steuer = parseFloat(e.vorsteuerBetrag) || 0; // 1:1 zur Vorsteuer bei Reverse Charge
                    if (e.paragraph === 'Abs. 1') { rcNettoAbs1 += netto; rcSteuerAbs1 += steuer; }
                    else { rcNettoOther += netto; rcSteuerOther += steuer; }
                } else if (e.typ === 'ig_erwerb') {
                    const netto  = parseFloat(e.nettoBetrag) || 0;
                    const steuer = parseFloat(e.erwerbsteuer) || 0;
                    if ((parseInt(e.ustSatz) || 19) === 7) { erwerbNetto7 += netto; erwerbSteuer7 += steuer; }
                    else { erwerbNetto19 += netto; erwerbSteuer19 += steuer; }
                }
            });
        } else {
            // Fallback ohne Vorsteuer-Modul: nur Einkäufe + Ausgaben (kein §13b/IG-Erwerb erfassbar)
            purchases.forEach(p => {
                const rateRaw = (p.ustSatz != null && p.ustSatz !== '') ? parseFloat(p.ustSatz) : 19;
                const rate = isNaN(rateRaw) ? 19 : rateRaw;
                if (rate === 0) return;
                const brutto = (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
                vorsteuerEinkaufAusgaben += brutto - (brutto / (1 + rate / 100));
            });
            expenses.forEach(e => {
                const rate = parseFloat(e.ustSatz || e.steuersatz) || 19;
                const brutto = parseFloat(e.betrag) || 0;
                if (rate > 0) vorsteuerEinkaufAusgaben += brutto - (brutto / (1 + rate / 100));
            });
        }
        const rcSteuerGesamt     = rcSteuerAbs1 + rcSteuerOther;
        const erwerbSteuerGesamt = erwerbSteuer19 + erwerbSteuer7;
        const vorsteuer = vorsteuerEinkaufAusgaben + vorsteuerRc + vorsteuerIgErwerb; // Summe nur zur Zahllast-Kontrolle

        // Zahllast / Erstattung — §13b-Steuerschuld + Erwerbsteuer zählen mit (heben sich ggü. dem
        // gleichzeitigen Vorsteuerabzug idR auf, müssen aber als eigene Kennzahlen gemeldet werden, s.u.)
        // ig. Lieferung/Ausfuhr sind steuerfrei (0%) und fließen nicht in die Zahllast ein.
        const zahllast = ust19 + ust7 + rcSteuerGesamt + erwerbSteuerGesamt - vorsteuer;

        return {
            bruttoUmsatz, bruttoUmsatz19, bruttoUmsatz7, nettoUmsatz19, nettoUmsatz7, ust19, ust7, vorsteuer, zahllast,
            vorsteuerEinkaufAusgaben, vorsteuerRc, vorsteuerIgErwerb, rcSteuerGesamt, erwerbSteuerGesamt,
            rcNettoAbs1, rcSteuerAbs1, rcNettoOther, rcSteuerOther,
            erwerbNetto19, erwerbSteuer19, erwerbNetto7, erwerbSteuer7,
            nettoIgLieferung, nettoIgLeistung, nettoAusfuhr,
            istEuHinweisAnzahl, istEuHinweisBetrag,
            diff25a
        };
    },

    // Für bereits eingereichte Perioden: gespeicherten Stand zum Meldezeitpunkt nutzen statt live neu zu berechnen
    // (verhindert abweichende Zahlen, wenn z.B. die Versteuerungsart nachträglich gewechselt wird)
    _calcPeriodeLocked(year, typ, idx, startDate, endDate) {
        const gesperrt = Store.getUstPerioden().find(p => p.year === year &&
            (typ === 'monat' ? p.monat === idx + 1 : (p.quartal === idx && !p.monat)));
        if (gesperrt && gesperrt.snapshot) return { calc: gesperrt.snapshot, gesperrt };
        return { calc: this._calcPeriode(startDate, endDate), gesperrt };
    },

    // Quartals-Grenzen (Legacy-Helfer, weiterhin für Vorjahresvergleich genutzt)
    _qStart(year, q) {
        return `${year}-${String(q * 3 + 1).padStart(2, '0')}-01`;
    },
    _qEnd(year, q) {
        const d = new Date(year, q * 3 + 3, 0);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    // Periodengrenzen generisch für Monat/Quartal
    _pStart(year, typ, idx) {
        if (typ === 'monat') return `${year}-${String(idx + 1).padStart(2, '0')}-01`;
        return this._qStart(year, idx);
    },
    _pEnd(year, typ, idx) {
        if (typ === 'monat') {
            const d = new Date(year, idx + 1, 0);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        return this._qEnd(year, idx);
    },
    _periodeLabel(year, typ, idx) {
        if (typ === 'monat') {
            const namen = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
            return `${namen[idx]} ${year}`;
        }
        return `Q${idx + 1}/${year}`;
    },

    // Abgabefrist: 10. des Folgemonats nach Periodenende, +1 Monat bei Dauerfristverlängerung (§46 UStDV)
    _fristDatum(year, typ, idx) {
        const end = new Date(this._pEnd(year, typ, idx));
        let monate = 1;
        if (Store.getSettings().ustDauerfristverlaengerung) monate = 2;
        return new Date(end.getFullYear(), end.getMonth() + monate, 10);
    },
    _formatFrist(d) {
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    },

    render() {
        if (!this._isRegel()) {
            return `
            <div class="page-header"><h2>USt-Voranmeldung</h2></div>
            <div class="card">
                <div style="padding:32px;text-align:center;">
                    <div style="font-size:48px;margin-bottom:16px;">📋</div>
                    <h3>Nur für Regelbesteuerer</h3>
                    <p style="color:var(--text-muted);margin:8px 0 20px;">
                        Du bist aktuell als <strong>Kleinunternehmer (§19 UStG)</strong> eingestellt.<br>
                        Die USt-Voranmeldung ist nur für Regelbesteuerer relevant.
                    </p>
                    <button class="btn btn-primary" data-action="navigate" data-args=\'["euer"]\'>Zur EÜR → USt-Modus ändern</button>
                </div>
            </div>`;
        }

        const typ  = this._typ();
        const year = this._year;
        const idx  = this._idx();
        const periodsCount = typ === 'monat' ? 12 : 4;
        const start = this._pStart(year, typ, idx);
        const end   = this._pEnd(year, typ, idx);
        const { calc } = this._calcPeriodeLocked(year, typ, idx, start, end);

        // Jahresübersicht über alle Perioden des gewählten Typs
        const jahresUebersicht = Array.from({ length: periodsCount }, (_, i) => i).map(pi => {
            const ps = this._pStart(year, typ, pi);
            const pe = this._pEnd(year, typ, pi);
            const { calc: c, gesperrt } = this._calcPeriodeLocked(year, typ, pi, ps, pe);
            return { pi, c, gesperrt };
        });

        const jahresZahllast = jahresUebersicht.reduce((s, r) => s + r.c.zahllast, 0);

        // Monatlich-Pflicht-Hinweis: Vorjahres-Zahllast > 7.500€ und aktuell nur quartalsweise gemeldet (§18 Abs. 2 UStG)
        let monatspflichtHinweis = '';
        if (typ === 'quartal') {
            const vjZahllast = [0, 1, 2, 3]
                .map(qi => this._calcPeriode(this._qStart(year - 1, qi), this._qEnd(year - 1, qi)))
                .reduce((s, c) => s + c.zahllast, 0);
            if (vjZahllast > 7500) {
                monatspflichtHinweis = `
                <div class="card" style="margin-bottom:16px;border-left:3px solid var(--warning);">
                    <div style="padding:12px 16px;font-size:13px;">
                        ⚠️ <strong>Monatliche Voranmeldung vermutlich Pflicht:</strong> Die Zahllast ${year - 1} lag bei ${Utils.formatCurrency(vjZahllast)} und damit über der 7.500 €-Grenze (§18 Abs. 2 Satz 2 UStG). Bitte in den <strong>Einstellungen</strong> auf "Monatlich" umstellen und mit dem Finanzamt/Steuerberater abstimmen.
                    </div>
                </div>`;
            }
        }

        // Ist-Versteuerung + EU-Geschäft: ig. Lieferung/Leistung (Kz. 41/21) und OSS (§3c UStG) werden
        // nur im Soll-Zweig oben berechnet — im Ist-Modus strukturell nicht erfasst/differenziert.
        const istEuBetragText = (!this._isSoll() && calc.istEuHinweisAnzahl > 0)
            ? ` In diesem Zeitraum sind das <strong>${calc.istEuHinweisAnzahl} Rechnung${calc.istEuHinweisAnzahl === 1 ? '' : 'en'} über insgesamt ${Utils.formatCurrency(calc.istEuHinweisBetrag)}</strong> (Netto), die hier nicht korrekt zugeordnet sind.`
            : '';
        const istEuHinweis = !this._isSoll() ? `
        <div class="card" style="margin-bottom:16px;border-left:3px solid var(--warning);">
            <div style="padding:12px 16px;font-size:13px;">
                ⚠️ <strong>Ist-Versteuerung + EU-Geschäft:</strong> Bei Ist-Versteuerung (§20 UStG, Zahlungsdatum) werden innergemeinschaftliche Lieferungen/sonstige Leistungen (Kz. 41/21) und der OSS-Schwellenwert (§3c UStG) hier <u>nicht gesondert erfasst</u> — dieses Modell ist auf Soll-Versteuerung ausgelegt.${istEuBetragText} Bei EU-Kunden im Ist-Modus die Zuordnung bitte manuell mit deinem Steuerberater klären.
            </div>
        </div>` : '';

        const kz500Hinweis = calc.diff25a.margeBrutto > 0 ? `
        <div class="card" style="margin-bottom:16px;border-left:3px solid var(--warning);">
            <div style="padding:12px 16px;font-size:13px;">
                ℹ️ <strong>Kennziffer 500 (neu ab Besteuerungszeitraum 2026):</strong> Diese Voranmeldung enthält Umsätze mit abweichender Bemessungsgrundlage (§25a UStG Differenzbesteuerung). Ist Kz. 500 in ELSTER aktiv, nimmt das automatisierte Prüfverfahren die UVA aus der Vorabprüfung heraus — ein Sachbearbeiter prüft dann manuell. Das kann die Bearbeitung verzögern, ist aber kein Fehler.
            </div>
        </div>` : '';

        const yearOptions = Array.from({ length: 8 }, (_, i) => 2020 + i)
            .map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('');

        const periodOptions = typ === 'monat'
            ? Array.from({ length: 12 }, (_, mi) => mi)
                .map(mi => `<option value="${mi}" ${mi === idx ? 'selected' : ''}>${this._periodeLabel(year, 'monat', mi)}</option>`).join('')
            : [0, 1, 2, 3].map(qi =>
                `<option value="${qi}" ${qi === idx ? 'selected' : ''}>Q${qi + 1} (${this._qStart(year, qi).slice(0, 7)} – ${this._qEnd(year, qi).slice(0, 7)})</option>`
            ).join('');

        const gesperrt = Store.getUstPerioden().find(p => p.year === year &&
            (typ === 'monat' ? p.monat === idx + 1 : (p.quartal === idx && !p.monat)));

        const fristDatum = this._fristDatum(year, typ, idx);

        return `
        <div class="page-header">
            <h2>USt-Voranmeldung</h2>
            <div class="page-header-actions no-print">
                <select class="form-select" id="uvYear" style="width:90px;">${yearOptions}</select>
                <select class="form-select" id="uvPeriode">${periodOptions}</select>
                <button class="btn btn-primary" data-action="uva-copy">📋 Werte kopieren</button>
                <button class="btn" data-action="uva-export">ELSTER CSV</button>
            </div>
        </div>
        ${monatspflichtHinweis}
        ${istEuHinweis}
        ${kz500Hinweis}

        <div class="stats-grid" style="margin-bottom:20px;">
            <div class="card stat-card">
                <div class="card-label">Brutto-Umsatz ${this._periodeLabel(year, typ, idx)}</div>
                <div class="card-value">${Utils.formatCurrency(calc.bruttoUmsatz)}</div>
                <div class="card-subtitle">Inkl. 19% USt</div>
            </div>
            <div class="card stat-card">
                <div class="card-label">Netto-Umsatz (Kz. 81)</div>
                <div class="card-value">${Utils.formatCurrency(calc.nettoUmsatz19)}</div>
                <div class="card-subtitle">Steuerpflichtige Umsätze 19%</div>
            </div>
            <div class="card stat-card danger">
                <div class="card-label">USt auf Umsätze (19%)</div>
                <div class="card-value">${Utils.formatCurrency(calc.ust19)}</div>
                <div class="card-subtitle">Info – wird von ELSTER automatisch aus Kz. 81 berechnet</div>
            </div>
            <div class="card stat-card success">
                <div class="card-label">Vorsteuer (Kz. 66)</div>
                <div class="card-value">${Utils.formatCurrency(calc.vorsteuerEinkaufAusgaben)}</div>
                <div class="card-subtitle">Aus Einkäufen + Ausgaben (ohne §13b/IG — eigene Kz.)</div>
            </div>
        </div>

        <div class="card" style="margin-bottom:16px;">
            <div class="card-header">
                <div class="card-title">Kennzahlen ${this._periodeLabel(year, typ, idx)} (${Utils.formatDate(start)} – ${Utils.formatDate(end)})</div>
                ${gesperrt ? '<span class="badge badge-success">✅ Eingereicht</span>' : '<span class="badge badge-warning">⏳ Offen</span>'}
            </div>
            <div class="table-container" style="border:none;">
                <table class="euer-table">
                    <thead><tr><th style="width:20%">Kz.</th><th>Bezeichnung</th><th style="text-align:right;width:25%">Betrag</th></tr></thead>
                    <tbody>
                        <tr><td><strong>Kz. 81</strong></td><td>Steuerpflichtige Umsätze (19%) – Netto</td><td style="text-align:right">${Utils.formatCurrency(calc.nettoUmsatz19)}</td></tr>
                        <tr style="opacity:0.75;"><td></td><td style="font-size:12px;">↳ USt darauf (19%) <span style="color:var(--text-muted);">– nur Info, ELSTER berechnet automatisch</span></td><td style="text-align:right;font-size:12px;">${Utils.formatCurrency(calc.ust19)}</td></tr>
                        ${calc.diff25a.margeBrutto > 0 ? `
                        <tr style="opacity:0.75;"><td></td><td style="font-size:12px;">↳ davon Differenzbesteuerung §25a UStG <span style="color:var(--text-muted);">(Marge${calc.diff25a.methode === 'gesamt' ? ', Gesamtdifferenz' : ''} statt Verkaufspreis)</span></td><td style="text-align:right;font-size:12px;">${Utils.formatCurrency(calc.diff25a.margeNetto)}</td></tr>
                        ${calc.diff25a.methode === 'gesamt' && calc.diff25a.neuerVortrag < 0 ? `
                        <tr style="opacity:0.75;"><td></td><td style="font-size:12px;color:var(--warning);">↳ negative Gesamtdifferenz – Vortrag ins nächste Voranmeldungszeitraum</td><td style="text-align:right;font-size:12px;color:var(--warning);">${Utils.formatCurrency(calc.diff25a.neuerVortrag)}</td></tr>
                        ` : ''}` : ''}
                        ${calc.nettoUmsatz7 > 0 ? `
                        <tr><td><strong>Kz. 86</strong></td><td>Steuerpflichtige Umsätze (7%) – Netto</td><td style="text-align:right">${Utils.formatCurrency(calc.nettoUmsatz7)}</td></tr>
                        <tr style="opacity:0.75;"><td></td><td style="font-size:12px;">↳ USt darauf (7%) <span style="color:var(--text-muted);">– nur Info, ELSTER berechnet automatisch</span></td><td style="text-align:right;font-size:12px;">${Utils.formatCurrency(calc.ust7)}</td></tr>
                        ` : ''}
                        ${calc.nettoIgLieferung > 0 ? `<tr><td><strong>Kz. 41</strong></td><td>Innergem. Lieferungen (§4 Nr.1b UStG) – Netto</td><td style="text-align:right">${Utils.formatCurrency(calc.nettoIgLieferung)}</td></tr>` : ''}
                        ${calc.nettoIgLeistung > 0 ? `<tr><td><strong>Kz. 21</strong></td><td>Innergem. sonstige Leistungen (§3a Abs.2 UStG) – Netto</td><td style="text-align:right">${Utils.formatCurrency(calc.nettoIgLeistung)}</td></tr>` : ''}
                        ${calc.nettoAusfuhr > 0 ? `<tr><td><strong>Kz. 43</strong></td><td>Ausfuhrlieferungen Drittland (§4 Nr.1a UStG) – Netto</td><td style="text-align:right">${Utils.formatCurrency(calc.nettoAusfuhr)}</td></tr>` : ''}
                        ${calc.erwerbNetto19 > 0 ? `<tr><td><strong>Kz. 89</strong></td><td>Innergem. Erwerbe (19%) – Bemessungsgrundlage</td><td style="text-align:right">${Utils.formatCurrency(calc.erwerbNetto19)}</td></tr>` : ''}
                        ${calc.erwerbNetto7 > 0 ? `<tr><td><strong>Kz. 93</strong></td><td>Innergem. Erwerbe (7%) – Bemessungsgrundlage</td><td style="text-align:right">${Utils.formatCurrency(calc.erwerbNetto7)}</td></tr>` : ''}
                        ${calc.rcNettoAbs1 > 0 ? `<tr><td><strong>Kz. 46</strong></td><td>§13b Abs.1 EU-Dienstleistungen – Bemessungsgrundlage</td><td style="text-align:right">${Utils.formatCurrency(calc.rcNettoAbs1)}</td></tr>` : ''}
                        ${calc.rcNettoOther > 0 ? `<tr><td><strong>§13b (sonst.)</strong></td><td>Weitere §13b-Fälle (Bau/Gebäudereinigung/Mobilfunk) <span style="color:var(--warning);font-size:11px;">⚠ genaue Zeile im Formular prüfen</span></td><td style="text-align:right">${Utils.formatCurrency(calc.rcNettoOther)}</td></tr>` : ''}
                        <tr><td><strong>Kz. 66</strong></td><td>Vorsteuerbeträge aus Rechnungen (§15 UStG)</td><td style="text-align:right;color:var(--success)">−${Utils.formatCurrency(calc.vorsteuerEinkaufAusgaben)}</td></tr>
                        ${calc.vorsteuerIgErwerb > 0 ? `<tr><td><strong>Kz. 61</strong></td><td>Vorsteuer aus innergem. Erwerben</td><td style="text-align:right;color:var(--success)">−${Utils.formatCurrency(calc.vorsteuerIgErwerb)}</td></tr>` : ''}
                        ${calc.vorsteuerRc > 0 ? `<tr><td><strong>Kz. 67</strong></td><td>Vorsteuer aus §13b-Leistungen</td><td style="text-align:right;color:var(--success)">−${Utils.formatCurrency(calc.vorsteuerRc)}</td></tr>` : ''}
                        <tr class="euer-result">
                            <td></td>
                            <td><strong>${calc.zahllast >= 0 ? '🔴 Zahllast (Verbleibt zu zahlen)' : '🟢 Überschuss (Erstattung)'}</strong></td>
                            <td style="text-align:right;font-size:1.1rem;color:${calc.zahllast >= 0 ? 'var(--danger)' : 'var(--success)'}">
                                <strong>${Utils.formatCurrency(Math.abs(calc.zahllast))}</strong>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style="padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                ${!gesperrt ? `<button class="btn btn-primary" data-action="uva-mark">✅ Als eingereicht markieren</button>` : ''}
                ${gesperrt ? `<div style="color:var(--text-muted);font-size:12px;">Eingereicht am ${Utils.formatDate(gesperrt.eingereichtAm)}</div>` : ''}
                <div style="font-size:12px;color:var(--text-muted);">Abgabefrist: ${this._formatFrist(fristDatum)}${Store.getSettings().ustDauerfristverlaengerung ? ' (inkl. Dauerfristverlängerung)' : ''}</div>
            </div>
        </div>

        <div class="card">
            <div class="card-header"><div class="card-title">Jahresübersicht ${year}</div></div>
            <div class="table-container" style="border:none;">
                <table class="data-table">
                    <thead><tr><th>${typ === 'monat' ? 'Monat' : 'Quartal'}</th><th style="text-align:right">Netto-Umsatz</th><th style="text-align:right">USt</th><th style="text-align:right">Vorsteuer</th><th style="text-align:right">Zahllast</th><th>Status</th></tr></thead>
                    <tbody>
                        ${jahresUebersicht.map(({ pi, c, gesperrt: g }) => `
                        <tr style="cursor:pointer;" data-action="uva-periode" data-args='[${pi}]' >
                            <td><strong>${this._periodeLabel(year, typ, pi)}</strong><br><span style="font-size:11px;color:var(--text-muted)">${this._pStart(year, typ, pi).slice(0,7)} – ${this._pEnd(year, typ, pi).slice(0,7)}</span></td>
                            <td style="text-align:right">${Utils.formatCurrency(c.nettoUmsatz19)}</td>
                            <td style="text-align:right">${Utils.formatCurrency(c.ust19)}</td>
                            <td style="text-align:right;color:var(--success)">−${Utils.formatCurrency(c.vorsteuer)}</td>
                            <td style="text-align:right;color:${c.zahllast >= 0 ? 'var(--danger)' : 'var(--success)'};font-weight:600">${Utils.formatCurrency(c.zahllast)}</td>
                            <td>${g ? '<span class="badge badge-success">✅</span>' : '<span class="badge badge-warning">Offen</span>'}</td>
                        </tr>`).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight:600;background:var(--bg-secondary);">
                            <td>Jahressumme</td>
                            <td style="text-align:right">${Utils.formatCurrency(jahresUebersicht.reduce((s,r)=>s+r.c.nettoUmsatz19,0))}</td>
                            <td style="text-align:right">${Utils.formatCurrency(jahresUebersicht.reduce((s,r)=>s+r.c.ust19,0))}</td>
                            <td style="text-align:right;color:var(--success)">−${Utils.formatCurrency(jahresUebersicht.reduce((s,r)=>s+r.c.vorsteuer,0))}</td>
                            <td style="text-align:right;color:${jahresZahllast >= 0 ? 'var(--danger)' : 'var(--success)'}">${Utils.formatCurrency(jahresZahllast)}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        <div class="card" style="margin-top:16px;">
            <div style="padding:12px 16px;font-size:13px;color:var(--text-muted);line-height:1.7;">
                <strong>Kz. 81:</strong> Netto-Umsätze aus Lieferungen und Leistungen zum Regelsteuersatz 19% – <u>das ist der einzige Wert, den du in ELSTER bei Kz. 81 einträgst</u>. ELSTER berechnet die USt darauf selbst.<br>
                <strong>Kz. 86:</strong> Netto-Umsätze zum ermäßigten Steuersatz 7% (z.B. Bücher, Lebensmittel) – ebenfalls einziger Eintrag bei Kz. 86, USt wird automatisch berechnet.<br>
                ${calc.nettoIgLieferung > 0 ? `<strong>Kz. 41:</strong> Innergemeinschaftliche Lieferungen (Ware) an Unternehmen mit gültiger USt-IdNr in der EU (§4 Nr.1b, §6a UStG) – steuerfrei, keine USt darauf. Voraussetzung: gültige USt-IdNr des Kunden geprüft (BZSt-Bestätigungsverfahren) und Zusammenfassende Meldung (ZM, Spalte „Lieferungen") abgegeben.<br>` : ''}
                ${calc.nettoIgLeistung > 0 ? `<strong>Kz. 21:</strong> Innergemeinschaftliche sonstige Leistungen (Dienstleistungen) an Unternehmen mit gültiger USt-IdNr in der EU (§3a Abs. 2 UStG, Reverse Charge beim Empfänger) – nicht steuerbar in Deutschland. In der ZM in die Spalte „Sonstige Leistungen" eintragen (nicht „Lieferungen"). Zuordnung erfolgt über die Auswahl "Art des Umsatzes" bei der jeweiligen Position (eine Rechnung kann Ware und Leistung an denselben Kunden mischen).<br>` : ''}
                ${calc.nettoAusfuhr > 0 ? `<strong>Kz. 43:</strong> Ausfuhrlieferungen in Drittländer außerhalb der EU (§4 Nr.1a, §6 UStG) – steuerfrei, Ausfuhrnachweis (z.B. Zollbeleg) muss vorliegen.<br>` : ''}
                ${calc.erwerbNetto19 > 0 || calc.erwerbNetto7 > 0 ? `<strong>Kz. 89/93:</strong> Innergemeinschaftliche Erwerbe (§1a UStG) – Bemessungsgrundlage eintragen, gleichzeitig als Vorsteuer bei Kz. 61 abziehbar.<br>` : ''}
                ${calc.rcNettoAbs1 > 0 || calc.rcNettoOther > 0 ? `<strong>Kz. 46 / §13b:</strong> Reverse-Charge-Leistungen (§13b UStG) – du schuldest hier die Steuer als Leistungsempfänger, gleichzeitig als Vorsteuer bei Kz. 67 abziehbar. Bei "Weitere §13b-Fälle" bitte die passende Zeile im ELSTER-Formular je nach Kategorie (Bauleistung/Gebäudereinigung/Mobilfunk) selbst nachsehen – dafür gibt es jeweils eigene Kennzahlen.<br>` : ''}
                <strong>Kz. 66:</strong> Abzugsfähige Vorsteuer aus Eingangsrechnungen (§15 UStG) – <u>nur</u> Einkäufe/Ausgaben, NICHT §13b oder IG-Erwerb (die haben eigene Kennzahlen, s.o.).<br>
                <strong>⚠️ Wichtig:</strong> Die "USt darauf"-Zeilen bei Kz. 81/86 sind reine Kontrollwerte für dich, <u>keine eigenen ELSTER-Kennzahlen</u> – insbesondere Kz. 35/36 im echten Formular meint etwas anderes (Umsätze zu "anderen Steuersätzen", z.B. 16%/5%). Trage dort nichts ein, wenn du normale 19%/7%-Umsätze hast.<br>
                <strong>Voranmeldungszeitraum:</strong> Aktuell <u>${typ === 'monat' ? 'monatlich' : 'vierteljährlich'}</u> eingestellt (Einstellungen → USt-Modus). Monatlich ist Pflicht bei Vorjahres-Zahllast > 7.500€ sowie im Gründungsjahr und Folgejahr.<br>
                <strong>Abgabefrist:</strong> 10. des auf den Voranmeldungszeitraum folgenden Monats (§18 Abs. 1 UStG)${Store.getSettings().ustDauerfristverlaengerung ? ', durch Dauerfristverlängerung um 1 Monat verschoben' : ''} — für die aktuell gewählte Periode: <strong>${this._formatFrist(fristDatum)}</strong>.<br>
                <strong>⚠️ Unverbindlich</strong> – Abgabe über ELSTER (elster.de) oder Steuerberater erforderlich.
            </div>
        </div>
        `;
    },

    init() {
        const ySel = document.getElementById('uvYear');
        const pSel = document.getElementById('uvPeriode');
        if (ySel) ySel.addEventListener('change', () => { this._year = parseInt(ySel.value); this._refresh(); });
        if (pSel) pSel.addEventListener('change', () => {
            const v = parseInt(pSel.value);
            if (this._typ() === 'monat') this._monat = v; else this._quartal = v;
            this._refresh();
        });
    },

    _refresh() {
        // Als Sub-Tab im EÜR-Tab eingebettet: über Euer._refresh() rendern, sonst geht die
        // Tab-Leiste (EÜR-Report | USt-Voranmeldung) beim Refresh verloren.
        if (typeof Euer !== 'undefined' && Euer._view === 'uva') { Euer._refresh(); return; }
        const el = document.getElementById('content');
        if (el) { el.innerHTML = this.render(); this.init(); }
    },

    _selectPeriode(pi) {
        if (this._typ() === 'monat') this._monat = pi; else this._quartal = pi;
        this._refresh();
    },

    _markEingereicht() {
        const typ = this._typ();
        const idx = this._idx();
        const start = this._pStart(this._year, typ, idx);
        const end   = this._pEnd(this._year, typ, idx);
        const snapshot = this._calcPeriode(start, end);
        Store.saveUstPeriode({
            year: this._year,
            quartal: typ === 'quartal' ? idx : null,
            monat: typ === 'monat' ? idx + 1 : null,
            eingereichtAm: Utils.todayISO(),
            versteuerungsartBeiMeldung: Store.getSettings().ustVersteuerungsart || 'soll',
            snapshot
        });
        // §25a Gesamtdifferenz: Vortrag erst beim Einreichen fixieren (nicht bei jedem Live-Render),
        // sonst würde ein bloßes Öffnen der Seite den Vortrag für die nächste Periode verfälschen.
        if (snapshot.diff25a && snapshot.diff25a.methode === 'gesamt') {
            Store.setDifferenzVortrag(this._year, snapshot.diff25a.neuerVortrag);
        }
        Utils.showToast(`${this._periodeLabel(this._year, typ, idx)} als eingereicht markiert`, 'success');
        this._refresh();
    },

    // Baut die vollständige, ELSTER-Reihenfolge-treue Zeilenliste (für CSV + Copy gemeinsam genutzt)
    _buildRows(c) {
        const rows = [
            ['Kz. 81', 'Steuerpflichtige Umsätze 19% (Netto) - in ELSTER eintragen', c.nettoUmsatz19.toFixed(2)],
            ['(Info)', 'USt 19% - NICHT eintragen, ELSTER berechnet automatisch', c.ust19.toFixed(2)],
        ];
        if (c.nettoUmsatz7 > 0) {
            rows.push(['Kz. 86', 'Steuerpflichtige Umsätze 7% (Netto) - in ELSTER eintragen', c.nettoUmsatz7.toFixed(2)]);
            rows.push(['(Info)', 'USt 7% - NICHT eintragen, ELSTER berechnet automatisch', c.ust7.toFixed(2)]);
        }
        if (c.nettoIgLieferung > 0) rows.push(['Kz. 41', 'Innergem. Lieferungen (Netto) - in ELSTER eintragen', c.nettoIgLieferung.toFixed(2)]);
        if (c.nettoIgLeistung  > 0) rows.push(['Kz. 21', 'Innergem. sonstige Leistungen (Netto) - in ELSTER eintragen', c.nettoIgLeistung.toFixed(2)]);
        if (c.nettoAusfuhr     > 0) rows.push(['Kz. 43', 'Ausfuhrlieferungen Drittland (Netto) - in ELSTER eintragen', c.nettoAusfuhr.toFixed(2)]);
        if (c.erwerbNetto19 > 0) rows.push(['Kz. 89', 'Innergem. Erwerbe 19% (Bemessungsgrundlage) - in ELSTER eintragen', c.erwerbNetto19.toFixed(2)]);
        if (c.erwerbNetto7  > 0) rows.push(['Kz. 93', 'Innergem. Erwerbe 7% (Bemessungsgrundlage) - in ELSTER eintragen', c.erwerbNetto7.toFixed(2)]);
        if (c.rcNettoAbs1   > 0) rows.push(['Kz. 46', '§13b Abs.1 EU-Dienstleistungen (Bemessungsgrundlage) - in ELSTER eintragen', c.rcNettoAbs1.toFixed(2)]);
        if (c.rcNettoOther  > 0) rows.push(['§13b (sonst.)', 'Weitere §13b-Fälle - passende Zeile im Formular prüfen (Bau/Gebäudereinigung/Mobilfunk)', c.rcNettoOther.toFixed(2)]);
        rows.push(['Kz. 66', 'Vorsteuer aus Rechnungen (Einkäufe/Ausgaben) - in ELSTER eintragen', c.vorsteuerEinkaufAusgaben.toFixed(2)]);
        if (c.vorsteuerIgErwerb > 0) rows.push(['Kz. 61', 'Vorsteuer aus innergem. Erwerben - in ELSTER eintragen', c.vorsteuerIgErwerb.toFixed(2)]);
        if (c.vorsteuerRc       > 0) rows.push(['Kz. 67', 'Vorsteuer aus §13b-Leistungen - in ELSTER eintragen', c.vorsteuerRc.toFixed(2)]);
        rows.push(['', c.zahllast >= 0 ? 'Verbleibende Zahllast (zur Kontrolle)' : 'Erstattung (zur Kontrolle)', Math.abs(c.zahllast).toFixed(2)]);
        return rows;
    },

    _exportCSV() {
        const typ   = this._typ();
        const year  = this._year;
        const idx   = this._idx();
        const start = this._pStart(year, typ, idx);
        const end   = this._pEnd(year, typ, idx);
        const { calc: c } = this._calcPeriodeLocked(year, typ, idx, start, end);
        const label = this._periodeLabel(year, typ, idx);
        const rows  = [
            ['USt-Voranmeldung ELSTER Export', '', ''],
            [`Zeitraum: ${label}`, start + ' bis ' + end, ''],
            ['', '', ''],
            ['Kennzahl', 'Bezeichnung', 'Betrag EUR'],
            ...this._buildRows(c),
        ];
        const dateiSuffix = typ === 'monat' ? `M${idx + 1}` : `Q${idx + 1}`;
        Utils.downloadCSV(rows, `uvr_${dateiSuffix}_${year}.csv`);
        Utils.showToast('ELSTER CSV exportiert', 'success');
    },

    // Schnelle Zwischenablage-Kopie für die manuelle ELSTER-Eingabe (nur die "eintragen"-Zeilen, in Formular-Reihenfolge)
    _copyForElster() {
        const typ   = this._typ();
        const year  = this._year;
        const idx   = this._idx();
        const start = this._pStart(year, typ, idx);
        const end   = this._pEnd(year, typ, idx);
        const { calc: c } = this._calcPeriodeLocked(year, typ, idx, start, end);
        const label = this._periodeLabel(year, typ, idx);
        const rows  = this._buildRows(c).filter(r => r[0] && r[0] !== '(Info)');
        const text  = `USt-Voranmeldung ${label} (${start} bis ${end})\n` +
            rows.map(r => `${r[0]}: ${r[2]} € — ${r[1]}`).join('\n');

        const done = () => { Utils.showToast('Werte in Zwischenablage kopiert', 'success'); };
        const fail = () => { Utils.showToast('Kopieren fehlgeschlagen — bitte CSV nutzen', 'warning'); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(fail);
        } else {
            fail();
        }
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'uva-export':  function () { UstVoranmeldung._exportCSV(); },
    'uva-copy':    function () { UstVoranmeldung._copyForElster(); },
    'uva-mark':    function () { UstVoranmeldung._markEingereicht(); },
    'uva-periode': function (pi) { UstVoranmeldung._selectPeriode(pi); }
});
