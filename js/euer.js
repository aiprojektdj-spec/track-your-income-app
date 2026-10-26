// ============================================
// EÜR Module - Income-Expense Report
// ============================================
const Euer = {
    _period: 'jahr',
    _view: 'report', // 'report' | 'uva' — orthogonal zu _period, steuert Sub-Tab im EÜR-Tab
    _selectedYear: new Date().getFullYear(),
    _selectedMonth: new Date().getMonth(),
    _customStart: '',
    _customEnd: '',
    _detailView: null,   // 'einnahmen' | 'ausgaben' | 'gewinn' | null
    _lastRenderData: {},
    // Laufende ApexCharts-Instanzen (Monatsbalken, Ausgaben-Donut). Werden vor jedem Neuanlegen
    // zerstört — sonst hingen die alten weiter an Fenster-Ereignissen (Resize), kosteten
    // Speicher und konnten in ApexCharts werfen (Alarm vom 2026-10-09). Muster: js/dashboard.js.
    _charts: [],

    // Reiter oberhalb des Contents (EÜR-Report | USt-Voranmeldung) — optisch getrennt vom
    // Zeitraum-Dropdown darunter, da Report-Typ ≠ Zeitraum (zwei verschiedene Konzepte).
    _renderViewTabs() {
        return `
        <div class="no-print" style="display:flex;gap:2px;margin-bottom:16px;border-bottom:1px solid var(--border);">
            <button class="btn" data-action="euer-set-view" data-args='["report"]' style="border-radius:8px 8px 0 0;border-bottom:none;${this._view !== 'uva' ? 'background:var(--bg-card);font-weight:700;box-shadow:inset 0 2px 0 var(--accent);' : 'opacity:.65;'}">EÜR-Report</button>
            <button class="btn" data-action="euer-set-view" data-args='["uva"]' style="border-radius:8px 8px 0 0;border-bottom:none;${this._view === 'uva' ? 'background:var(--bg-card);font-weight:700;box-shadow:inset 0 2px 0 var(--accent);' : 'opacity:.65;'}">USt-Voranmeldung</button>
        </div>`;
    },

    // Ausgaben-Kategorien für Umsatzsteuer-Zahlungsverkehr mit dem Finanzamt (T01). Werden in
    // js/ausgaben.js angeboten und hier als eigene EÜR-Zeilen statt als Betriebsausgabe gezählt.
    KAT_UST_ZAHLUNG: 'Umsatzsteuer an Finanzamt',

    // Zuordnungsdatum einer Ausgabe für die EÜR: das Zahlungsdatum, außer bei der USt-Voraus-
    // zahlung für Dezember/Q4, die innerhalb der Zehn-Tage-Frist gezahlt wurde (s. _berechne).
    // e.ustZeitraum: 'JJJJ-MM' oder 'JJJJ-Qn' (Ausgabenformular), e.ustDauerfrist: DFV beim Erfassen.
    _euerDatum(e) {
        if (!e || e.kategorie !== 'Umsatzsteuer an Finanzamt' || !e.ustZeitraum || e.ustDauerfrist) return e && e.datum;
        const m = /^(\d{4})-(12|Q4)$/.exec(String(e.ustZeitraum));
        const d = String(e.datum || '');
        if (!m) return d;
        const vj = parseInt(m[1], 10);
        if (d.slice(0, 4) === String(vj + 1) && d.slice(5, 7) === '01' && parseInt(d.slice(8, 10), 10) <= 10) return vj + '-12-31';
        return d;
    },
    KAT_UST_ERSTATTUNG: 'Umsatzsteuer-Erstattung vom Finanzamt',

    // ── Rechenkern der EÜR ───────────────────────────────────────────────────
    // Bewusst getrennt vom Rendern: die Methode fasst kein DOM an, setzt keinen State und
    // gibt nur Zahlen zurück. Damit ist sie von außen aufrufbar — js/gewerbesteuer.js zieht
    // den Gewinn hier heraus, statt ihn ein zweites Mal und mit anderem Ergebnis zu rechnen
    // (Fund A1/A2, plan/funde-vollaudit-2026-09-09.md: vier Module rechneten vier Gewinne).
    //
    // Wer hier etwas ändert, ändert damit auch Gewerbesteuer und jede weitere Stelle, die
    // den Gewinn bezieht — das ist der Zweck. Eine zweite Formel daneben ist keine Option.
    //
    // year/month/period kommen als Parameter statt aus this._selectedYear/_selectedMonth/
    // _period, damit ein Aufrufer ein anderes Jahr auswerten kann, ohne die Ansicht der EÜR
    // umzustellen. period: "jahr" | "monat" | "quartal" | "custom".
    _berechne(year, month, period) {
        const settings = Store.getSettings();
        const ustMode = settings.ustMode || 'klein';


        let startDate, endDate, periodLabel;

        if (period === 'monat') {
            startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const nextM = new Date(year, month + 1, 0);
            endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(nextM.getDate()).padStart(2, '0')}`;
            periodLabel = Utils.getMonthName(month) + ' ' + year;
        } else if (period === 'quartal') {
            const qStart = Math.floor(month / 3) * 3;
            startDate = `${year}-${String(qStart + 1).padStart(2, '0')}-01`;
            const qEnd = new Date(year, qStart + 3, 0);
            endDate = `${qEnd.getFullYear()}-${String(qEnd.getMonth() + 1).padStart(2, '0')}-${String(qEnd.getDate()).padStart(2, '0')}`;
            periodLabel = `Q${Math.floor(month / 3) + 1} ${year}`;
        } else if (period === 'custom') {
            startDate = this._customStart || `${year}-01-01`;
            endDate = this._customEnd || `${year}-12-31`;
            periodLabel = `${Utils.formatDate(startDate)} - ${Utils.formatDate(endDate)}`;
        } else {
            startDate = `${year}-01-01`;
            endDate = `${year}-12-31`;
            periodLabel = 'Jahr ' + year;
        }

        // Steuerstatus je Vorgang (Audit 2026-10-13, T06): nicht der HEUTIGE Firmenmodus
        // entscheidet, sondern der zum Vorgangsdatum geltende bzw. am Vorgang gestempelte.
        // Ohne js/steuerstatus.js (alte Einbindung) bleibt es beim globalen Feld.
        const _hatStatus = typeof SteuerStatus !== 'undefined';
        const _regel = (v, feld) => _hatStatus ? SteuerStatus.istRegel(v, settings, feld) : ustMode === 'regel';
        // isRegel = "im Zeitraum gilt (zumindest teilweise) Regelbesteuerung" — steuert nur, welche
        // Zeilen die Anzeige zeigt. Gerechnet wird je Vorgang.
        const isRegel = _hatStatus
            ? (SteuerStatus.modeAm(startDate, settings) === 'regel' || SteuerStatus.modeAm(endDate, settings) === 'regel'
               || SteuerStatus.historie(settings).some(e => e.mode === 'regel' && e.ab >= startDate && e.ab <= endDate))
            : ustMode === 'regel';

        // Stornierte Rechnungen → zugehörige Verkäufe ausschließen (Orphan-Guard) — NUR für
        // Stornos nach altem Muster. Seit dem Audit 2026-10-13 (L1) bleibt beim Storno einer
        // bezahlten Rechnung der Zufluss stehen (§11 EStG); eine echte Rückzahlung wird als
        // eigene, datierte Erstattung gebucht (inv.stornoModell === 2). Würde der Guard hier
        // auch neue Stornos treffen, wäre die Rückzahlung doppelt abgezogen.
        const storniertInvIds = new Set(
            (Store.getRechInvoices ? Store.getRechInvoices() : [])
                .filter(inv => (inv.status === 'storniert' || inv._storniert) && inv.stornoModell !== 2)
                .map(inv => inv.id)
        );
        const sales = Store.getSales().filter(s =>
            Utils.isInPeriod(s.datum, startDate, endDate) &&
            !(s._invoiceId && storniertInvIds.has(s._invoiceId))
        );
        const periodPurchases = Store.getPurchases().filter(p => Utils.isInPeriod(p.datum, startDate, endDate));
        // §11 Abs. 2 S. 2 EStG (R-TAX-08): eine USt-Vorauszahlung für Dezember/Q4 ist eine
        // regelmäßig wiederkehrende Ausgabe — gezahlt UND fällig (10.01.) innerhalb der ersten
        // zehn Januartage gehört sie ins Vorjahr (BFH 13.12.2022, VIII R 1/20). Fälligkeit nur
        // ohne Dauerfristverlängerung im Fenster; Verschiebung nach §108 Abs. 3 AO ist unbeachtlich.
        const expenses = Store.getExpenses().filter(e => Utils.isInPeriod((typeof Euer !== 'undefined' && Euer._euerDatum) ? Euer._euerDatum(e) : e.datum, startDate, endDate));

        // Bezahlte Rechnungen die noch nicht als Verkauf gesynct sind
        const syncedInvoiceIds = new Set(Store.getSales(true).filter(s => s._invoiceId).map(s => s._invoiceId));
        const unsyncedInvoices = (Store.getRechInvoices ? Store.getRechInvoices() : []).filter(inv => {
            if (inv.status !== 'bezahlt' || inv._storniert) return false;
            if (inv.typ !== 'rechnung' && inv.typ !== 'gutschrift') return false;
            if (syncedInvoiceIds.has(inv.id)) return false;
            const d = inv.bezahltAm || inv.datum;
            return Utils.isInPeriod(d, startDate, endDate);
        });
        const rechnungenNetting = SteuerBerechnung.nettoRechnungen(unsyncedInvoices);
        const rechnungsEinnahmen = rechnungenNetting.netto;

        // Umsatzsteuer-Zahlungen an das bzw. Erstattungen vom Finanzamt (T01). In der EÜR sind
        // sie eigene Ausgabe- bzw. Einnahmezeilen im Jahr der Zahlung (§11 EStG) — getrennt von
        // den Betriebsausgaben, damit sie weder als Kosten des Geschäfts noch doppelt erscheinen.
        const _katFA = (typeof Euer !== 'undefined' && Euer.KAT_UST_ZAHLUNG) ? Euer : {};
        const _istUstZahlung = e => !!_katFA.KAT_UST_ZAHLUNG && e.kategorie === _katFA.KAT_UST_ZAHLUNG;
        const _istUstErstattung = e => !!_katFA.KAT_UST_ERSTATTUNG && e.kategorie === _katFA.KAT_UST_ERSTATTUNG;
        const ustZahlungenFA = expenses.filter(_istUstZahlung).reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0);
        const ustErstattungenFA = expenses.filter(_istUstErstattung).reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0);
        const betriebsExpenses = expenses.filter(e => !_istUstZahlung(e) && !_istUstErstattung(e));

        // Einnahmen: Bruttoerlöse = Verkaufspreis + Versand vom Käufer (§11 EStG Zufluss)
        const salesBrutto = sales.reduce((sum, s) => {
            return sum + (parseFloat(s.verkaufspreis) || 0) + (parseFloat(s.versandkostenKaeufer) || 0);
        }, 0);
        const bruttoEinnahmen = salesBrutto + rechnungsEinnahmen;

        // Ausgaben
        // Wareneinkauf: ALLE Einkäufe im Zeitraum (EÜR Abflussprinzip §4 Abs. 3 EStG – Ausgabe beim Bezahlen, nicht beim Verkaufen)
        // Storno des VERKAUFS gibt den Einkauf laut Store.stornoSale() nur wieder als "verfuegbar" frei
        // (Ware bleibt auf Lager) — der Einkauf selbst bleibt eine reale Ausgabe, solange er nicht
        // separat storniert wurde (bereits durch Store.getPurchases() ausgefiltert). Gleiche Logik wie bilanz.js.
        // ACHTUNG: Eigenbeleg-Einkäufe (eigenbeleg_id gesetzt) werden NICHT hier gezählt, da der
        // Betrag bereits über eigenbelegeAusgaben (s.u.) erfasst wird. Verhindert Doppelzählung.
        const wareneinkauf = periodPurchases.filter(p => !p.eigenbeleg_id).reduce((sum, p) => {
            return sum + (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
        }, 0);

        // ── §25a UStG Differenzbesteuerung: informative Aufschlüsselung ──────────
        // Rein informativ — Gewinn bleibt Verkaufspreis−Einkaufspreis wie bei jedem Artikel (kein
        // Einfluss auf wareneinkauf/bruttoEinnahmen oben, nur ein Subset-Ausweis). Das Flag lebt am
        // Lager-Purchase (js/lager.js); Sales verlinken via purchaseId(s) (Verkauf-Modul), Rechnungs-
        // positionen tragen es direkt (rechnungen/js/rechnung.js). Maßgeblich für die tatsächliche
        // USt-Schuld ist die USt-Voranmeldung (js/ustvoranmeldung.js), nicht dieser EÜR-Ausweis.
        const purchasesByIdEuer = {};
        Store.getPurchases(true).forEach(p => { purchasesByIdEuer[p.id] = p; });
        // §25a-Retouren: Erstattungsbetrag mindert den Verkaufspreis der zurückgegebenen Position vor
        // der Margenbildung — sonst bleibt eine zurückgegebene §25a-Position fälschlich in dieser
        // Vorschau-Kachel stehen (analog zum retour19/retour7-Mechanismus, s. plan/OFFEN.md §2.1b).
        const diff25aRetourenBySaleId = {};
        Store.getRetouren()
            .filter(r => Utils.isInPeriod(r.datum, startDate, endDate) && r.saleId)
            .forEach(r => { diff25aRetourenBySaleId[r.saleId] = (diff25aRetourenBySaleId[r.saleId] || 0) + (parseFloat(r.erstattungBetrag) || 0); });
        const diff25aSalesPositionen = sales
            .map(s => ({ sale: s, purchase: purchasesByIdEuer[s.purchaseId] || (s.purchaseIds && s.purchaseIds[0] ? purchasesByIdEuer[s.purchaseIds[0]] : null) }))
            .filter(x => x.purchase && x.purchase.differenzbesteuert)
            .map(x => ({
                verkaufspreis: Math.max(0, ((parseFloat(x.sale.verkaufspreis) || 0) + (parseFloat(x.sale.versandkostenKaeufer) || 0)) - (diff25aRetourenBySaleId[x.sale.id] || 0)),
                einkaufspreis: parseFloat(x.purchase.einkaufspreis) || 0,
                warenart: x.purchase.warenart || 'gebraucht',
                // §25a Abs. 3 Satz 3 UStG — nur wenn der Artikel selbst so erfasst ist. Die
                // Warenart wird mitgeprueft, damit ein Altbestand-Haken an einem Sammlerstueck
                // keine Pauschale ausloest, fuer die es keine Rechtsgrundlage gibt.
                pauschalmarge: !!(x.purchase.pauschalmarge && x.purchase.warenart === 'kunst')
            }));
        const diff25aInvoicePositionen = [];
        unsyncedInvoices.forEach(inv => {
            const sign = inv.typ === 'gutschrift' ? -1 : 1;
            (inv.positionen || []).forEach(pos => {
                if (!pos.differenzbesteuert) return;
                const linkedPurch = pos.lagerArtikelId ? purchasesByIdEuer[pos.lagerArtikelId] : null;
                diff25aInvoicePositionen.push({
                    verkaufspreis: sign * (pos.menge || 0) * (pos.einzelpreis || 0),
                    einkaufspreis: sign * (linkedPurch ? (parseFloat(linkedPurch.einkaufspreis) || 0) : (parseFloat(pos.einkaufspreis) || 0)),
                    warenart: pos.warenart || (linkedPurch && linkedPurch.warenart) || 'gebraucht',
                    // Die Pauschale haengt am Lagerartikel, nicht an der Rechnungsposition — eine
                    // frei eingetippte Position kennt keinen Einkaufspreis, den man als
                    // "nicht ermittelbar" einstufen koennte. Gutschriften (sign -1) drehen die
                    // Pauschale ueber den negativen Verkaufspreis mit, ohne Sonderbehandlung.
                    pauschalmarge: !!(linkedPurch && linkedPurch.pauschalmarge && linkedPurch.warenart === 'kunst')
                });
            });
        });
        const diff25aPositionen = diff25aSalesPositionen.concat(diff25aInvoicePositionen);
        const diff25aUmsatz = diff25aPositionen.reduce((sum, p) => sum + p.verkaufspreis, 0);
        const diff25aWareneinkauf = diff25aPositionen.reduce((sum, p) => sum + p.einkaufspreis, 0);
        // Vorschau der Bemessungsgrundlage (Einzeldifferenz) — die per Firmeneinstellung gewählte
        // Methode (Einzel-/Gesamtdifferenz inkl. Vortrag) wird in der USt-Voranmeldung ausgewiesen.
        const diff25aMargePreview = SteuerBerechnung.margeEinzeldifferenz(diff25aPositionen.map(p => Object.assign({ satz: 19 }, p)));

        // Versandkosten (seller's shipping costs)
        const versandkosten = sales.reduce((sum, s) => sum + (parseFloat(s.versandkostenVerkaufer) || 0), 0);

        // Plattformgebühren
        const plattformgebuehren = sales.reduce((sum, s) => {
            const vk = parseFloat(s.verkaufspreis) || 0;
            const vkK = parseFloat(s.versandkostenKaeufer) || 0;
            const pct = parseFloat(s.plattformgebuehrProzent) || 0;
            return sum + (vk + vkK) * pct / 100;
        }, 0);

        // Fahrtkosten aus Fahrtenbuch.
        // `!f.storniert` ist Pflicht und nicht redundant: Anders als getSales()/getPurchases()
        // filtert Store.getFahrten() Stornos NICHT heraus — die Fahrtenliste soll sie GoBD-konform
        // durchgestrichen zeigen. Bis 2026-09-16 fehlte die Pruefung hier, und eine stornierte
        // Fahrt zaehlte voll als Betriebsausgabe (Gewinn zu niedrig -> Unterzahlung).
        // Dieselbe Luecke stand in js/gbr.js und in der Drucksumme js/fahrtenbuch.js _print().
        // "Tatsächliche Kosten": die Kosten stehen in den Belegen, die Fahrt bucht 0 € (E-08)
        const fahrtkosten = Store.getFahrten().filter(f => !f.storniert && Utils.isInPeriod(f.datum, startDate, endDate))
            .reduce((sum, f) => sum + (f.berechnungsart === 'tatsaechlich' ? 0 : (parseFloat(f.kosten) || 0)), 0);

        // Verpackungsmaterial (Materiallager) — abgezogen wird der EINKAUF, nicht der Verbrauch.
        //
        // Bis 2026-09-13 stand hier der Verbrauch (grund === 'verkauf'). Das war aus zwei
        // Gruenden falsch:
        //
        // 1. Systematisch: die EUER kennt keine Bestandsbewertung fuer Umlaufvermoegen. Eine
        //    Betriebsausgabe entsteht mit der Zahlung (§11 Abs. 2 EStG), nicht mit dem
        //    Verbrauch — §4 Abs. 3 Satz 4 EStG nimmt davon nur bestimmte Wirtschaftsgueter
        //    aus (Anteile, Grundstuecke u.ae.), Verpackungsmaterial gehoert nicht dazu.
        //    Genau so behandelt diese Datei den Wareneinkauf schon immer, s. Kommentar oben.
        //
        // 2. Praktisch ein DOPPELABZUG: wer Material ueber das Ausgabenformular mit dem Haken
        //    "ins Materiallager buchen" erfasst (js/ausgaben.js), erzeugt eine Ausgabe UND
        //    einen Materialeinkauf. Die Ausgabe steckt bereits in sonstigeAusgaben; kam beim
        //    Verkauf der Verbrauch obendrauf, war derselbe Euro zweimal abgezogen. Der Gewinn
        //    war damit zu niedrig — die gefaehrliche Richtung.
        //
        // Einkaeufe MIT ausgabeId sind genau diese Faelle und werden uebersprungen. `lieferant
        // === 'Ausgabe'` faengt Altdaten ab, die vor der Verknuepfung entstanden sind.
        const materialEinkauf = Store.getMaterialEinkauefe()
            .filter(e => !e.ausgabeId && e.lieferant !== 'Ausgabe' && Utils.isInPeriod(e.datum, startDate, endDate))
            .reduce((sum, e) => sum + (parseFloat(e.gesamtkosten) || 0), 0);

        // Der Verbrauch wird hier bewusst NICHT mehr gelesen. Er bleibt im Materiallager
        // sichtbar (js/materiallager.js) und in den Statistiken als Margenrechnung je Verkauf
        // (js/statistiken.js) — beides sind Bestandssichten, keine EUER-Groessen.

        // AfA / Abschreibungen (§7 EStG) — aus dem Anlagenverzeichnis
        // Bei Jahresauswertung: voller Jahres-AfA-Betrag; bei Teilzeitraum: zeitanteilig
        const afaAnlagen = (typeof Store.getAfaAnlagen === 'function') ? Store.getAfaAnlagen().filter(a => !a.storniert) : [];
        const daysInYear = 365;
        const periodStart = new Date(startDate);
        const periodEnd   = new Date(endDate);
        const daysInPeriod = Math.max(1, Math.round((periodEnd - periodStart) / (1000 * 60 * 60 * 24)) + 1);
        const afaRatio = period === 'jahr' ? 1 : (daysInPeriod / daysInYear);
        const afaKosten = afaAnlagen.reduce((sum, a) => {
            if (typeof Afa !== 'undefined' && Afa._calcJahresAfa) {
                return sum + Afa._calcJahresAfa(a, year) * afaRatio;
            }
            return sum;
        }, 0);
        // Restbuchwert ausgeschiedener Anlagegüter (§4 Abs.3 S.4 EStG) — fällt im Zeitraum des
        // Abgangs voll an, nicht zeitanteilig (Steuer-Audit 2026-10-18, E-01)
        const anlagenRestbuchwert = afaAnlagen.reduce((sum, a) => {
            if (typeof Afa === 'undefined' || !Afa._restbuchwertAbgang) return sum;
            if (!a.abgangsdatum || !Utils.isInPeriod(a.abgangsdatum, startDate, endDate)) return sum;
            return sum + Afa._restbuchwertAbgang(a, year);
        }, 0);

        // Retouren-Erstattungen mindern Einnahmen (§11 EStG – Rückfluss)
        // Altbestand: Wurde ein Verkauf über eine Retoure storniert (Muster bis 2026-10-13), ist
        // die Einnahme schon entfernt → Erstattung NICHT nochmals abziehen (Doppelabzug). Neue
        // Retouren stornieren den Verkauf nicht mehr (L4) und laufen hier regulär durch.
        const stornierteSaleIds = new Set(Store.getSales(true).filter(s => s.storniert).map(s => s.id));
        const allSalesRaw = Store.getSales(true);
        const retourenImZeitraum = Store.getRetouren()
            .filter(r => Utils.isInPeriod(r.datum, startDate, endDate) && !(r.saleId && stornierteSaleIds.has(r.saleId)));
        const retourenErstattungen = retourenImZeitraum
            .reduce((sum, r) => sum + (parseFloat(r.erstattungBetrag) || 0), 0);

        // Netto-Einnahmen nach Retouren (Anzeige: Brutto-Basis, vor USt-Extraktion)
        const nettoEinnahmen = bruttoEinnahmen - retourenErstattungen;

        // ── Umsatzsteuer ────────────────────────────────────────────────────────
        // EÜR (§4 Abs.3 EStG) ist eine Zahlungsrechnung: die vereinnahmte Umsatzsteuer ist im
        // Zuflussjahr Betriebseinnahme, die gezahlte Vorsteuer Betriebsausgabe; Zahlungen an das
        // und Erstattungen vom Finanzamt sind eigene Zeilen im Jahr der Zahlung (BFH VIII B 54/20).
        // Bis 2026-10-13 (T01) wurde die USt hier als "Durchlaufposten" aus dem Gewinn genommen —
        // unabhängig davon, ob sie im Jahr überhaupt abgeführt wurde. Eine im Februar des
        // Folgejahres abgeführte Dezember-USt fehlte so im Zuflussjahr, eine manuell als Ausgabe
        // erfasste Abführung wurde doppelt abgezogen.
        //
        // Netto/USt je Vorgang zum tatsächlichen Satz, und nur für Vorgänge, die zu ihrem Datum
        // regelbesteuert waren (T06). Rechnungspositionen sind bereits netto gespeichert.
        const salesRegel = sales.filter(s => _regel(s));
        const salesKlein = sales.filter(s => !_regel(s));
        const _leer = { netto: 0, ust: 0 };
        const salesRegelNetting = salesRegel.length ? SteuerBerechnung.nettoSales(salesRegel, true) : _leer;
        const salesNettoWeighted = salesRegelNetting.netto;
        const _retourRegel = r => {
            const rel = r.saleId ? allSalesRaw.find(s => s.id === r.saleId) : null;
            return rel ? _regel(rel) : _regel(r);
        };
        const retourenRegel = retourenImZeitraum.filter(_retourRegel);
        const retourenRegelNetting = retourenRegel.length ? SteuerBerechnung.nettoRetouren(retourenRegel, allSalesRaw, true) : _leer;
        const retourenNettoWeighted = retourenRegelNetting.netto;
        const retourenKleinBrutto = retourenImZeitraum.filter(r => !_retourRegel(r))
            .reduce((sum, r) => sum + (parseFloat(r.erstattungBetrag) || 0), 0);
        const salesKleinBrutto = salesKlein.reduce((sum, s) =>
            sum + (parseFloat(s.verkaufspreis) || 0) + (parseFloat(s.versandkostenKaeufer) || 0), 0);
        // Vereinnahmte USt: Marktplatz-Verkäufe minus Rückzahlungen plus Rechnungen (Gutschriften mit §17-Vorzeichen)
        const ustAusRechnungen = rechnungenNetting.ust;
        // Private Kfz-Nutzung nach der 1-%-Regel (js/afa.js nutzungsentnahme): Betriebseinnahme
        // (unentgeltliche Wertabgabe), bei Regelbesteuerung zzgl. USt darauf. Eigene Zeile, kein
        // Umsatz aus Verkäufen — zählt deshalb nicht in einnahmenNetto (Umsatzgrenzen).
        const kfzNE = (typeof Afa !== 'undefined' && Afa.nutzungsentnahme) ? Afa.nutzungsentnahme(startDate, endDate) : { wert: 0, ust: 0 };
        const kfzPrivat = kfzNE.wert;
        const ustKfzPrivat = kfzNE.ust;
        const ustEinnahmen = salesRegelNetting.ust - retourenRegelNetting.ust + ustAusRechnungen + ustKfzPrivat;
        // Betriebseinnahmen ohne USt
        const einnahmenNetto = salesKleinBrutto + salesNettoWeighted - retourenKleinBrutto - retourenNettoWeighted + rechnungsEinnahmen;
        // Steuerliche Summe der Einnahmen = netto + Kfz-Nutzungsentnahme + vereinnahmte USt + Erstattungen vom Finanzamt
        const summeEinnahmen = einnahmenNetto + kfzPrivat + ustEinnahmen + ustErstattungenFA;

        // Regelbesteuerte Verkäufe ohne gespeicherten Steuersatz werden mit 19 % gerechnet — das
        // darf nicht unbemerkt geschehen (T02). Sondersätze (Ausfuhr/OSS) tragen ihren Satz selbst.
        const ohneSteuersatz = salesRegel.filter(s => !s._invoiceId
            && (s.steuersatz == null || s.steuersatz === '' || isNaN(parseFloat(s.steuersatz)))
            && !(s.steuersaetze && Object.keys(s.steuersaetze).length)
            && SteuerBerechnung._sondersatz(s, {}) === null);

        // Sonstige Betriebsausgaben (ohne Umsatzsteuer-Zahlungen/-Erstattungen, s.o.)
        const sonstigeAusgaben = betriebsExpenses.reduce((sum, e) => sum + (parseFloat(e.betrag) || 0), 0);
        // Nicht abziehbarer Teil (Bewirtung 30 %, Geschenke über der Grenze, Gewerbesteuer —
        // Steuer-Audit 2026-10-18, E-07). Abgeflossen ist er trotzdem; er mindert nur den Gewinn
        // nicht. Die Geschenkgrenze gilt je Empfänger und Wirtschaftsjahr, deshalb alle Ausgaben.
        const _ausgabenAlle = Store.getExpenses();
        const _hatAusgabenModul = typeof Ausgaben !== 'undefined' && !!Ausgaben._nichtAbziehbar;
        const nichtAbziehbarJe = { bewirtung: 0, geschenke: 0, gewst: 0 };
        if (_hatAusgabenModul) betriebsExpenses.forEach(e => {
            const n = Ausgaben._nichtAbziehbar(e, _ausgabenAlle);
            if (!n) return;
            const k = e.kategorie === Ausgaben.KAT_BEWIRTUNG ? 'bewirtung' : e.kategorie === Ausgaben.KAT_GEWST ? 'gewst' : 'geschenke';
            nichtAbziehbarJe[k] += n;
        });
        const nichtAbziehbar = nichtAbziehbarJe.bewirtung + nichtAbziehbarJe.geschenke + nichtAbziehbarJe.gewst;
        // Privatanteil (Telefon, Pkw nach Fahrtenbuch …): keine Betriebsausgabe, keine Vorsteuer
        const privatAnteil = _hatAusgabenModul ? betriebsExpenses.reduce((sum, e) => sum + Ausgaben._privatBetrag(e), 0) : 0;

        // Category breakdown for Betriebsausgaben — dynamic (all actual categories)
        const catBreakdown = {};
        betriebsExpenses.forEach(e => {
            const cat = e.kategorie || 'Sonstiges';
            catBreakdown[cat] = (catBreakdown[cat] || 0) + (parseFloat(e.betrag) || 0);
        });
        const kategorien = Object.keys(catBreakdown).sort();

        // Eigenbelege als Ausgaben (aus eigenbelege/index.html localStorage)
        // Felder: belegDatum (nicht datum), betragNetto (nicht betrag)
        const eigenbelegeRaw = (() => { try { const _ebCo = localStorage.getItem('oyi_active_company')||''; const _k = (_ebCo?_ebCo+'__':'')+'eigenbelege_belege'; return (typeof Store !== 'undefined' ? Store._syncReadRaw(_k) : JSON.parse(localStorage.getItem(_k) || '[]')) || []; } catch { return []; } })();
        const eigenbelegeInPeriod = eigenbelegeRaw
            .filter(b => !b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, startDate, endDate));
        // Abgeflossen ist der Bruttobetrag (§11 Abs.2 EStG). Eine abziehbare Vorsteuer steckt darin
        // und wird unten als eigene Zeile ausgewiesen — bis 2026-10-13 stand hier der Nettobetrag,
        // und die Vorsteuer wurde davon noch einmal abgezogen.
        const _ebBrutto = b => {
            const brutto = parseFloat(b.betragBrutto);
            if (!isNaN(brutto)) return brutto;
            return (parseFloat(b.betragNetto) || 0) + (parseFloat(b.betragMwst) || 0);
        };
        const eigenbelegeAusgaben = eigenbelegeInPeriod.reduce((sum, b) => sum + _ebBrutto(b), 0);
        // Vorsteuer aus Eigenbelegen: §15 Abs.1 UStG verlangt grundsätzlich eine Rechnung
        // eines Dritten (§14/14a UStG) — ein Eigenbeleg begründet KEINEN Vorsteuerabzug,
        // außer im engen Ausnahmefall §33 UStDV (verlorener Kleinbetragsbeleg mit offenem
        // USt-Ausweis). Nutzer bestätigt das explizit per Checkbox im Formular; Altbelege
        // ohne das Feld (vstAbzugsfaehig undefined) werden konservativ ausgeschlossen.
        // s. plan/session-prompt-eigenbeleg-vorsteuer-begruendung.md
        const eigenbelegeVorsteuer = eigenbelegeInPeriod.reduce((sum, b) => {
            if (b.vstAbzugsfaehig !== true) return sum;
            if (!_regel(b, 'belegDatum')) return sum;
            const mwst = parseFloat(b.betragMwst);
            if (!isNaN(mwst)) return sum + mwst;
            const satz = parseFloat(b.mwstSatz);
            if (isNaN(satz) || satz === 0) return sum;
            const netto = parseFloat(b.betragNetto);
            if (!isNaN(netto)) return sum + netto * satz / 100;
            const brutto = parseFloat(b.betragBrutto) || 0;
            return sum + brutto / (1 + satz / 100) * (satz / 100);
        }, 0);

        // Ausgaben gesamt
        // Kleinunternehmer: Brutto-Ausgaben (USt ist echter Kostenfaktor, kein Vorsteuerabzug)
        // Regelbesteuerung: Netto-Ausgaben (USt wird als Vorsteuer abgezogen = Durchlaufposten)
        // Manuell erfasste "sonstige" Vorsteuer (z. B. auf eine Anlage, die kein eigenes
        // Vorsteuerfeld hat) ist im Abflussjahr Betriebsausgabe — die UVA zog sie ab, die EÜR
        // nicht (Steuer-Audit 2026-10-18, E-09). Sie steckt in keiner anderen Ausgabe, zählt also
        // als abgeflossener Betrag UND als Vorsteuer. §13b/ig. Erwerb bleiben draußen: Steuer und
        // Vorsteuer heben sich auf, maßgeblich ist die gebuchte Zahlung an das Finanzamt.
        const vorsteuerManuell = (typeof Vorsteuer !== 'undefined' && Vorsteuer._calcManualEntries)
            ? (Vorsteuer._calcManualEntries(startDate, endDate).sonstige || 0) : 0;
        const abzugsfaehig = wareneinkauf + versandkosten + plattformgebuehren + fahrtkosten + materialEinkauf + sonstigeAusgaben + eigenbelegeAusgaben + afaKosten + anlagenRestbuchwert + vorsteuerManuell - nichtAbziehbar - privatAnteil;

        // ── Vorsteuer: tatsächlicher USt-Satz pro Einkauf (Fix: war pauschal /1.19) ──
        // Purchases können jetzt ustSatz = 19 | 7 | 0 tragen.
        // Fallback: 19% wenn kein ustSatz gespeichert (Altdaten-Kompatibilität).
        const vorsteuerTeile = (() => {
            // Einkäufe: nach tatsächlichem Satz gewichtet (gleiches Set wie bisher — periodPurchases
            // ist bereits ohne storniert, der zusätzliche Filter hier ist ein No-Op, aber bewusst
            // beibehalten um exakt das vorherige Verhalten zu spiegeln, s. wareneinkauf-Kommentar oben)
            const vstPurchListe = periodPurchases.filter(p => !p.storniert && !p.eigenbeleg_id && _regel(p));
            const vstPurch = vstPurchListe.length ? SteuerBerechnung.nettoPurchases(vstPurchListe).ust : 0;
            // Sonstige Betriebsausgaben tragen jetzt ein Pflicht-ustSatz-Feld (19|7|0|'rc'|'unklar',
            // s. js/ausgaben.js). Absichtlich NICHT über SteuerBerechnung.nettoExpenses berechnet:
            // dessen genereller Fallback zieht bei nicht-numerischen Sätzen (u.a. 'unklar') noch
            // 19% — das würde exakt den Vorsteuer-Überabzug reproduzieren, den js/vorsteuer.js für
            // 'unklar' gerade ausschließt (§15 UStG: kein Abzug ohne ausgewiesenen Satz). 'rc'
            // (Reverse Charge) wird separat über §13b-Einträge verrechnet, nicht hier.
            const vstExpenses = betriebsExpenses.reduce((sum, ex) => {
                if (!_regel(ex)) return sum;
                // §15 Abs. 1a UStG (Geschenk über der Grenze) und Privatanteil: nur der abziehbare Teil
                const _vstF = _hatAusgabenModul ? Ausgaben._vstFaktor(ex, _ausgabenAlle) : 1;
                if (!_vstF) return sum;
                const raw = (ex.ustSatz != null && ex.ustSatz !== '') ? ex.ustSatz : ex.steuersatz;
                if (raw === undefined || raw === null || raw === '' || raw === 'unklar' || raw === 'rc') return sum;
                const rate = parseFloat(raw);
                if (isNaN(rate) || rate === 0) return sum;
                const brutto = parseFloat(ex.betrag) || 0;
                return sum + (brutto - brutto / (1 + rate / 100)) * _vstF;
            }, 0);
            // Fahrtkosten sind die Kilometerpauschale (§9 EStG, 0,30 €/km je Fahrtenbuch) — eine
            // Pauschale ohne Rechnung, NIE USt-belastet. Gehörte NIE in die Vorsteuer (Fix
            // 2026-07-30: vorher fälschlich pauschal mit 19% verrechnet). Versandkosten/
            // Plattformgebühren/Materialverbrauch tragen (Stand 2026-07-30) kein eigenes ustSatz-
            // Feld — die liegen auf Sale/Materiallager, nicht in js/ausgaben.js (Fix 1). Eine
            // geratene 19%-Pauschale wäre ein unbelegter Vorsteuerabzug (§15 UStG verlangt eine
            // ordnungsgemäße Rechnung mit ausgewiesenem Satz) — deshalb hier bewusst 0€ statt
            // Pauschale, bis diese Module ein eigenes ustSatz-Feld bekommen. Nutzer kann Versand/
            // Plattformgebühren/Verpackungsmaterial alternativ als Betriebsausgabe mit korrektem
            // ustSatz erfassen (dann korrekt oben in vstExpenses berücksichtigt).
            const vstOther = 0;
            // Eigenbelege tragen betragMwst/mwstSatz pro Beleg → echte Vorsteuer statt Pauschale
            // (Fix: liefen vorher im pauschalen 19%-Block, ignorierten mwstSatz=0).
            return { purch: vstPurch, ausgaben: vstExpenses + vstOther + eigenbelegeVorsteuer };
        })();
        const vorsteuer = vorsteuerTeile.purch + vorsteuerTeile.ausgaben + vorsteuerManuell;
        // Betriebsausgaben ohne abziehbare Vorsteuer
        const ausgabenNetto = abzugsfaehig - vorsteuer;
        // Steuerliche Summe der Ausgaben = abgeflossene Beträge (inkl. Vorsteuer) + USt an das Finanzamt
        const summeAusgaben = abzugsfaehig + ustZahlungenFA;

        // Steuerlicher EÜR-Gewinn (Anlage EÜR, Gewerbesteuer, Steuerberaterpaket)
        const gewinn = summeEinnahmen - summeAusgaben;
        // Wirtschaftlicher Nettogewinn: Erlöse und Kosten ohne Umsatzsteuer und ohne Zahlungen mit
        // dem Finanzamt. Für Marge/Kennzahlen — NICHT für die Steuererklärung.
        const nettoGewinn = einnahmenNetto + kfzPrivat - ausgabenNetto;

        // ── Chart-Daten ────────────────────────────────────────────────────────
        // Monatliche Einnahmen/Ausgaben für das gesamte Jahr (unabhängig vom Zeitraum-Filter)
        const monthlyData = Array.from({length: 12}, (_, m) => {
            const mS = `${year}-${String(m+1).padStart(2,'0')}-01`;
            const mE = (() => { const d = new Date(year, m+1, 0); return `${year}-${String(m+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
            const mSales = Store.getSales().filter(s => !s.storniert && Utils.isInPeriod(s.datum, mS, mE));
            const mPurch = Store.getPurchases().filter(p => !p.storniert && Utils.isInPeriod(p.datum, mS, mE));
            const mExp   = Store.getExpenses().filter(e => Utils.isInPeriod(e.datum, mS, mE));
            const ein = Math.round(mSales.reduce((s,x) => s+(parseFloat(x.verkaufspreis)||0)+(parseFloat(x.versandkostenKaeufer)||0), 0)*100)/100;
            const aus = Math.round((mPurch.reduce((s,p) => s+(parseFloat(p.einkaufspreis)||0)*(parseInt(p.anzahl)||1), 0)+mExp.reduce((s,e) => s+(parseFloat(e.betrag)||0),0))*100)/100;
            return { ein, aus };
        });

        // Donut-Daten: Ausgaben nach Kategorie
        const donutLabels = ['Wareneinkauf','Versandkosten','Plattformgebühren'];
        const donutValues = [wareneinkauf, versandkosten, plattformgebuehren];
        if (fahrtkosten     > 0) { donutLabels.push('Fahrtkosten');      donutValues.push(fahrtkosten); }
        if (materialEinkauf  > 0) { donutLabels.push('Verpackung');       donutValues.push(materialEinkauf); }
        if (afaKosten       > 0) { donutLabels.push('AfA');              donutValues.push(afaKosten); }
        if (sonstigeAusgaben> 0) { donutLabels.push('Betriebsausgaben'); donutValues.push(sonstigeAusgaben); }
        if (eigenbelegeAusgaben>0){ donutLabels.push('Eigenbelege');     donutValues.push(eigenbelegeAusgaben); }

        return {
            settings, ustMode, isRegel, year, month, startDate, endDate, periodLabel, storniertInvIds,
            sales, periodPurchases, expenses, syncedInvoiceIds, unsyncedInvoices, rechnungenNetting,
            rechnungsEinnahmen, salesBrutto, bruttoEinnahmen, wareneinkauf, purchasesByIdEuer,
            diff25aRetourenBySaleId, diff25aSalesPositionen, diff25aInvoicePositionen,
            diff25aPositionen, diff25aUmsatz, diff25aWareneinkauf, diff25aMargePreview, versandkosten,
            plattformgebuehren, fahrtkosten, materialEinkauf, afaAnlagen, daysInYear, periodStart,
            periodEnd, daysInPeriod, afaRatio, afaKosten, anlagenRestbuchwert, stornierteSaleIds, retourenErstattungen,
            nettoEinnahmen, salesNettoWeighted, retourenNettoWeighted, ustAusRechnungen, ustEinnahmen,
            einnahmenNetto, ausgabenNetto, nettoGewinn, ustZahlungenFA, ustErstattungenFA, ohneSteuersatz,
            salesKleinBrutto, retourenKleinBrutto, vorsteuerTeile,
            salesRegel, betriebsExpenses, summeEinnahmen, sonstigeAusgaben, catBreakdown, kategorien, eigenbelegeRaw,
            eigenbelegeInPeriod, eigenbelegeAusgaben, eigenbelegeVorsteuer, abzugsfaehig, vorsteuer,
            nichtAbziehbar, nichtAbziehbarJe, privatAnteil, kfzPrivat, ustKfzPrivat, summeAusgaben, gewinn, monthlyData, donutLabels, donutValues
        };
    },

    // Bezeichnungen der Anlage EÜR je Erklärungsjahr (T02). Bewusst ohne Zeilennummern: die
    // ändern sich von Jahr zu Jahr, und eine falsche Zeile ist schlimmer als keine. Für ein Jahr,
    // dessen Formular hier nicht eigens hinterlegt ist, gelten die allgemeinen Bezeichnungen —
    // der Export sagt das dann ausdrücklich.
    _anlageEuerFassung(year) {
        return {
            geprueft: false,
            erloeseKlein:   'Betriebseinnahmen als umsatzsteuerlicher Kleinunternehmer',
            erloese:        'Umsatzsteuerpflichtige Betriebseinnahmen (netto)',
            kfzPrivat:      'Private Kfz-Nutzung (1-%-Regel, Nutzungsentnahme)',
            ust:            'Vereinnahmte Umsatzsteuer',
            ustErstattung:  'Vom Finanzamt erstattete Umsatzsteuer',
            waren:          'Waren, Rohstoffe und Hilfsstoffe (netto)',
            afa:            'AfA auf bewegliche Wirtschaftsgüter',
            restbuchwert:   'Restbuchwert der ausgeschiedenen Anlagegüter',
            fahrt:          'Fahrtkosten (Kilometerpauschale)',
            sonstige:       'Übrige Betriebsausgaben (netto, Sammelposten)',
            nichtAbzBewirtung: 'Bewirtungsaufwendungen – nicht abziehbarer Teil (Angabe, nicht im Gewinn)',
            nichtAbzGeschenke: 'Geschenke – nicht abziehbar (Angabe, nicht im Gewinn)',
            nichtAbzGewSt:     'Gewerbesteuer – nicht abziehbar (Angabe, nicht im Gewinn)',
            vorsteuer:      'Gezahlte Vorsteuerbeträge',
            ustZahlung:     'An das Finanzamt gezahlte Umsatzsteuer',
            gewinn:         'Gewinn / Verlust'
        };
    },

    // Zeilen des Hilfsexports — ausschließlich aus dem Ergebnis von _berechne(), damit Anzeige,
    // Export und Steuerberaterpaket dieselben Zahlen tragen (T02: der Export rechnete vorher mit
    // einer eigenen /1,19-Formel, auch für 7 %-Erlöse, Privatankäufe und Kilometerpauschalen).
    _elsterZeilen(d) {
        const f = this._anlageEuerFassung(d.year);
        const erloeseKlein = (d.salesKleinBrutto || 0) - (d.retourenKleinBrutto || 0);
        const zeilen = [
            { key: 'erloeseKlein',  betrag: erloeseKlein },
            { key: 'erloese',       betrag: d.einnahmenNetto - erloeseKlein },
            { key: 'kfzPrivat',     betrag: d.kfzPrivat || 0 },
            { key: 'ust',           betrag: d.ustEinnahmen },
            { key: 'ustErstattung', betrag: d.ustErstattungenFA },
            { key: 'waren',         betrag: d.wareneinkauf - d.vorsteuerTeile.purch },
            { key: 'afa',           betrag: d.afaKosten },
            { key: 'restbuchwert',  betrag: d.anlagenRestbuchwert || 0 },
            { key: 'fahrt',         betrag: d.fahrtkosten },
            { key: 'sonstige',      betrag: d.versandkosten + d.plattformgebuehren + d.materialEinkauf
                                            + d.sonstigeAusgaben + d.eigenbelegeAusgaben - d.vorsteuerTeile.ausgaben
                                            - (d.nichtAbziehbar || 0) - (d.privatAnteil || 0) },
            // Nur Angaben (info): in der Anlage EÜR stehen die nicht abziehbaren Beträge in eigenen
            // Zeilen bzw. Spalten — sie sind oben schon aus dem Gewinn genommen.
            { key: 'nichtAbzBewirtung', betrag: (d.nichtAbziehbarJe || {}).bewirtung || 0, info: true },
            { key: 'nichtAbzGeschenke', betrag: (d.nichtAbziehbarJe || {}).geschenke || 0, info: true },
            { key: 'nichtAbzGewSt',     betrag: (d.nichtAbziehbarJe || {}).gewst || 0, info: true },
            { key: 'vorsteuer',     betrag: d.vorsteuer },
            { key: 'ustZahlung',    betrag: d.ustZahlungenFA },
            { key: 'gewinn',        betrag: d.gewinn }
        ];
        zeilen.forEach(z => { z.bezeichnung = f[z.key]; });
        return zeilen;
    },

    render() {
        const viewTabs = this._renderViewTabs();

        if (this._view === 'uva') {
            return viewTabs + (typeof UstVoranmeldung !== 'undefined' ? UstVoranmeldung.render() : '');
        }

        // Kapitalgesellschaften (immer) sowie gewerbliche EU/GbR/eGbR über der §141-AO-Schwelle
        // nutzen Bilanz statt EÜR.
        if (typeof Rechtsform !== 'undefined' && Rechtsform.brauchtBilanzStattEuer(this._selectedYear)) {
            const istKapges     = Rechtsform.isKapitalgesellschaft();
            const istHandelsges = !istKapges && Rechtsform.getConfig().bilanzPflicht;
            return `${viewTabs}<div class="page-header"><h2><i class="ti ti-file-analytics" style="margin-right:6px;"></i> EÜR</h2></div>
            <div class="card" style="padding:40px;text-align:center;">
                <div style="font-weight:700;font-size:16px;margin-bottom:8px;">EÜR nicht verfügbar</div>
                <div style="color:var(--text-muted);margin-bottom:16px;">
                    ${istKapges
                        ? `Als ${Rechtsform.get()} bist du bilanzpflichtig.<br>Nutze stattdessen die Bilanz / GuV.`
                        : istHandelsges
                        ? `Als ${Rechtsform.get()} bist du kraft HGB Kaufmann und damit bilanzpflichtig — unabhängig von Umsatz oder Gewinn.<br><span style="font-size:12px;">Bilanzierung ist in Stackr in Planung — sprich in der Zwischenzeit mit deinem Steuerberater.</span>`
                        : `Laut Mitteilung des Finanzamts bist du ab dem Wirtschaftsjahr ${Rechtsform.bilanzPflichtAb()} buchführungspflichtig (§141 AO).<br><span style="font-size:12px;">Bilanzierung ist in Stackr in Planung — sprich in der Zwischenzeit mit deinem Steuerberater. <a href="#" data-action="euer-ao141-mitteilung">Angabe ändern</a></span>`
                    }
                </div>
                <button class="btn btn-primary" data-action="navigate" data-args=\'["bilanz"]\'>→ Bilanz / GuV öffnen</button>
            </div>`;
        }


        // Zahlen kommen aus _berechne() — ab hier ist nur noch Darstellung. Die beiden
        // State-Felder setzt bewusst render() und nicht _berechne(): ein fremder Aufrufer
        // (js/gewerbesteuer.js) darf die zuletzt angezeigte EÜR nicht überschreiben.
        const _d = this._berechne(this._selectedYear, this._selectedMonth, this._period);
        const {
            ustMode, isRegel, year, month, startDate, endDate, periodLabel, sales, periodPurchases,
            expenses, unsyncedInvoices, rechnungsEinnahmen, bruttoEinnahmen, wareneinkauf,
            diff25aUmsatz, diff25aWareneinkauf, diff25aMargePreview, versandkosten, plattformgebuehren,
            fahrtkosten, materialEinkauf, afaAnlagen, afaKosten, anlagenRestbuchwert, retourenErstattungen, nettoEinnahmen,
            ustEinnahmen, summeEinnahmen, sonstigeAusgaben, catBreakdown, kategorien, eigenbelegeRaw,
            eigenbelegeAusgaben, vorsteuer, summeAusgaben, gewinn, monthlyData, donutLabels, donutValues,
            einnahmenNetto, nettoGewinn, ustZahlungenFA, ustErstattungenFA, ohneSteuersatz, nichtAbziehbar, privatAnteil, kfzPrivat
        } = _d;

        this._lastGewinn = gewinn; // für Gewerbesteuer-Live-Update
        this._lastRenderData = { sales, periodPurchases, expenses, eigenbelegeRaw, startDate, endDate, periodLabel, summeEinnahmen, summeAusgaben, gewinn, wareneinkauf, versandkosten, plattformgebuehren, fahrtkosten, materialEinkauf, sonstigeAusgaben, eigenbelegeAusgaben, afaKosten, anlagenRestbuchwert, monthlyData, donutLabels, donutValues, chartYear: year, diff25aUmsatz, diff25aWareneinkauf, diff25aMargePreview };


        // GbR-Gewinnverteilung Block
        const gbrBlock = (typeof GbR !== 'undefined') ? GbR.renderEuerBlock(gewinn, year) : '';

        // §141 AO überschritten: Hinweis, keine Sperre — Pflicht erst nach FA-Mitteilung (E-05a)
        const ao141Banner = (typeof Rechtsform !== 'undefined' && Rechtsform.ao141Hinweis && Rechtsform.ao141Hinweis(year)) ? `
            <div class="card no-print" style="margin-bottom:16px;border-left:3px solid var(--warning);">
                <div style="padding:12px 16px;font-size:13px;line-height:1.6;">
                    <strong>§141-AO-Grenze überschritten</strong> (800.000 € Umsatz oder 80.000 € Gewinn). Buchführungspflichtig wirst du erst ab dem Wirtschaftsjahr, das auf die <strong>Mitteilung des Finanzamts</strong> folgt (§141 Abs. 2 AO) — bis dahin bleibt die EÜR richtig. Sprich frühzeitig mit deinem Steuerberater.
                    <a href="#" data-action="euer-ao141-mitteilung" style="margin-left:6px;">Mitteilung erhalten?</a>
                </div>
            </div>` : '';

        return `${viewTabs}${ao141Banner}
            <div class="page-header">
                <h2>Einnahmen-Überschuss-Rechnung</h2>
                <p class="text-muted no-print" style="margin:-8px 0 16px;font-size:13px;">Deine Steuer-Zusammenfassung — als Übertragungshilfe für die Anlage EÜR herunterladen oder deinem Steuerberater weitergeben.</p>
                <div class="page-header-actions no-print">
                    ${unsyncedInvoices.length > 0 ? `<button class="btn btn-warning" id="euerSync" title="${unsyncedInvoices.length} bezahlte Rechnung(en) noch nicht synchronisiert"><i class="ti ti-refresh"></i> ${unsyncedInvoices.length} synchronisieren</button> ` : ''}
                    <button class="btn" id="euerSteuertermine"><i class="ti ti-calendar-event"></i> Steuertermine</button>
                    <button class="btn" id="euerElsterExport" title="CSV mit den Werten zum Übertragen in die Anlage EÜR — keine Datei, die ELSTER direkt einliest. Übrige Betriebsausgaben sind ein Sammelposten."><i class="ti ti-file-spreadsheet"></i> Übertragungshilfe (CSV)</button>
                    <button class="btn" id="euerPrint"><i class="ti ti-printer"></i> PDF / Drucken</button>
                </div>
            </div>

            <div class="card no-print" style="margin-bottom:20px;">
                <div class="form-row" style="align-items:flex-end;">
                    <div class="form-group">
                        <label class="form-label">Zeitraum</label>
                        <select class="form-select" id="euerPeriod">
                            <option value="monat" ${this._period === 'monat' ? 'selected' : ''}>Monat</option>
                            <option value="quartal" ${this._period === 'quartal' ? 'selected' : ''}>Quartal</option>
                            <option value="jahr" ${this._period === 'jahr' ? 'selected' : ''}>Jahr</option>
                            <option value="custom" ${this._period === 'custom' ? 'selected' : ''}>Benutzerdefiniert</option>
                        </select>
                    </div>
                    <div class="form-group" id="yearGroup" style="${this._period === 'custom' ? 'display:none' : ''}">
                        <label class="form-label">Jahr</label>
                        <select class="form-select" id="euerYear">
                            ${Array.from({length: 16}, (_, i) => 2020 + i).map(y =>
                                `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group" id="monthGroup" style="${this._period === 'monat' ? '' : 'display:none'}">
                        <label class="form-label">Monat</label>
                        <select class="form-select" id="euerMonth">
                            ${Array.from({length: 12}, (_, i) => i).map(m =>
                                `<option value="${m}" ${m === month ? 'selected' : ''}>${Utils.getMonthName(m)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group" id="quarterGroup" style="${this._period === 'quartal' ? '' : 'display:none'}">
                        <label class="form-label">Quartal</label>
                        <select class="form-select" id="euerQuarter">
                            ${[0,1,2,3].map(q =>
                                `<option value="${q}" ${Math.floor(month / 3) === q ? 'selected' : ''}>Q${q + 1}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group" id="customStartGroup" style="${this._period === 'custom' ? '' : 'display:none'}">
                        <label class="form-label">Von</label>
                        <input type="date" class="form-input" id="euerCustomStart" value="${this._customStart || `${year}-01-01`}">
                    </div>
                    <div class="form-group" id="customEndGroup" style="${this._period === 'custom' ? '' : 'display:none'}">
                        <label class="form-label">Bis</label>
                        <input type="date" class="form-input" id="euerCustomEnd" value="${this._customEnd || `${year}-12-31`}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">USt-Modus</label>
                        <select class="form-select" id="euerUstMode">
                            <option value="klein" ${ustMode === 'klein' ? 'selected' : ''}>Kleinunternehmer</option>
                            <option value="regel" ${ustMode === 'regel' ? 'selected' : ''}>Regelbesteuerung</option>
                        </select>
                    </div>
                </div>
                ${ustMode === 'klein' ? '<div class="form-hint">Kleinunternehmerregelung nach &sect;19 UStG - keine Umsatzsteuer wird ausgewiesen.</div>' : ''}
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px;" id="euerKpiGrid">
                <div class="card stat-card success" data-euer-detail="einnahmen" style="padding:14px 16px;border-left:3px solid var(--success,#22c55e);cursor:pointer;transition:transform .15s,box-shadow .15s;${this._detailView==='einnahmen'?'outline:2px solid var(--success);outline-offset:2px;':''}">
                    <div class="card-label" style="display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">
                        <span style="display:flex;align-items:center;gap:5px;"><i class="ti ti-trending-up"></i> Einnahmen</span>
                        <span style="font-size:10px;opacity:.6;">${this._detailView==='einnahmen'?'▲':'▼'}</span>
                    </div>
                    <div class="card-value" style="font-size:28px;font-weight:700;line-height:1;" id="euerKpiEin">${Utils.formatCurrency(summeEinnahmen)}</div>
                    <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:5px;">${periodLabel}</div>
                </div>
                <div class="card stat-card danger" data-euer-detail="ausgaben" style="padding:14px 16px;border-left:3px solid var(--danger,#ef4444);cursor:pointer;transition:transform .15s,box-shadow .15s;${this._detailView==='ausgaben'?'outline:2px solid var(--danger);outline-offset:2px;':''}">
                    <div class="card-label" style="display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">
                        <span style="display:flex;align-items:center;gap:5px;"><i class="ti ti-trending-down"></i> Ausgaben</span>
                        <span style="font-size:10px;opacity:.6;">${this._detailView==='ausgaben'?'▲':'▼'}</span>
                    </div>
                    <div class="card-value" style="font-size:28px;font-weight:700;line-height:1;" id="euerKpiAus">${Utils.formatCurrency(summeAusgaben)}</div>
                    <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:5px;">${periodPurchases.length} Einkäufe · ${expenses.length} BA</div>
                </div>
                <div class="card stat-card ${gewinn >= 0 ? 'success' : 'danger'}" data-euer-detail="gewinn" style="padding:14px 16px;border-left:3px solid ${gewinn >= 0 ? 'var(--success,#22c55e)' : 'var(--danger,#ef4444)'};cursor:pointer;transition:transform .15s,box-shadow .15s;${this._detailView==='gewinn'?'outline:2px solid '+(gewinn>=0?'var(--success)':'var(--danger)')+';outline-offset:2px;':''}">
                    <div class="card-label" style="display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);margin-bottom:6px;">
                        <span style="display:flex;align-items:center;gap:5px;"><i class="ti ti-scale"></i> ${gewinn >= 0 ? 'Gewinn' : 'Verlust'}</span>
                        <span style="font-size:10px;opacity:.6;">${this._detailView==='gewinn'?'▲':'▼'}</span>
                    </div>
                    <div class="card-value" style="font-size:28px;font-weight:700;line-height:1;color:${gewinn >= 0 ? 'var(--success)' : 'var(--danger)'};" id="euerKpiGewinn">${Utils.formatCurrency(gewinn)}</div>
                    <div class="card-subtitle" style="font-size:11px;color:var(--text-muted);margin-top:5px;">${sales.length} Verkäufe</div>
                </div>
            </div>

            <div class="no-print" style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:16px;" id="euerChartsRow">
                <div class="card" style="padding:16px 16px 10px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;">
                        <i class="ti ti-chart-bar" style="color:var(--text-secondary);font-size:14px;"></i>
                        <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);">Monatsübersicht ${year}</span>
                    </div>
                    <div id="euerMonthChart"></div>
                </div>
                <div class="card" style="padding:16px 16px 10px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;">
                        <i class="ti ti-chart-donut" style="color:var(--text-secondary);font-size:14px;"></i>
                        <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-secondary);">Ausgaben-Aufteilung</span>
                    </div>
                    <div id="euerDonutChart"></div>
                </div>
            </div>

            <div id="euerDetailSection" style="margin-bottom:16px;">
                ${this._detailView ? this._renderDetailSection(this._detailView) : ''}
            </div>

            <div class="card">
                <div class="card-header">
                    <div class="card-title">EÜR - ${periodLabel}</div>
                    <div style="font-size:12px;color:var(--text-muted);">Gemäß &sect;4 Abs. 3 EStG</div>
                </div>
                <div class="table-container" style="border:none;">
                    <table class="euer-table">
                        <thead>
                            <tr>
                                <th style="width:60%">Position</th>
                                <th style="text-align:right">Betrag</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="euer-section-header" style="background:rgba(34,197,94,.07);"><td colspan="2" style="color:var(--success);padding:10px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.8px;"><i class="ti ti-trending-up" style="margin-right:5px;vertical-align:middle;font-size:13px;"></i>Einnahmen</td></tr>
                            <tr>
                                <td>Bruttoerlöse aus Verkäufen <span style="font-size:11px;color:var(--text-muted);">(Verkaufspreis + Versand vom Käufer)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(bruttoEinnahmen - rechnungsEinnahmen)}</td>
                            </tr>
                            ${rechnungsEinnahmen > 0 ? `<tr>
                                <td>Einnahmen aus Rechnungen <span style="font-size:11px;color:var(--text-muted);">(${unsyncedInvoices.length} Dok. noch nicht synchronisiert)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(rechnungsEinnahmen)}</td>
                            </tr>` : ''}
                            ${retourenErstattungen > 0 ? `<tr>
                                <td style="color:var(--danger);">Abzgl. Retouren-Erstattungen <span style="font-size:11px;color:var(--text-muted);">(§11 EStG Rückfluss)</span></td>
                                <td style="text-align:right;color:var(--danger);">−${Utils.formatCurrency(retourenErstattungen)}</td>
                            </tr>
                            <tr style="opacity:0.8;">
                                <td style="font-size:12px;padding-left:16px;">Einnahmen nach Retouren</td>
                                <td style="text-align:right;font-size:12px;">${Utils.formatCurrency(nettoEinnahmen)}</td>
                            </tr>` : ''}
                            ${isRegel ? `<tr style="opacity:0.8;">
                                <td style="padding-left:16px;font-size:12px;">↳ davon Erlöse ohne Umsatzsteuer <span style="color:var(--text-muted);">(je Verkauf/Position zum tatsächlichen Steuersatz)</span></td>
                                <td style="text-align:right;font-size:12px;">${Utils.formatCurrency(einnahmenNetto)}</td>
                            </tr>
                            <tr style="opacity:0.8;">
                                <td style="padding-left:16px;font-size:12px;">↳ davon vereinnahmte Umsatzsteuer <span style="color:var(--text-muted);">(Betriebseinnahme im Zuflussjahr)</span></td>
                                <td style="text-align:right;font-size:12px;">${Utils.formatCurrency(ustEinnahmen)}</td>
                            </tr>` : ''}
                            ${kfzPrivat > 0 ? `<tr>
                                <td>Private Kfz-Nutzung <span style="font-size:11px;color:var(--text-muted);">(1-%-Regel, §6 Abs. 1 Nr. 4 EStG)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(kfzPrivat)}</td>
                            </tr>` : ''}
                            ${ustErstattungenFA > 0 ? `<tr>
                                <td>Umsatzsteuer-Erstattung vom Finanzamt</td>
                                <td style="text-align:right">${Utils.formatCurrency(ustErstattungenFA)}</td>
                            </tr>` : ''}
                            ${ohneSteuersatz.length ? `<tr><td colspan="2" style="font-size:12px;color:var(--warning);"><i class="ti ti-alert-triangle"></i> ${ohneSteuersatz.length} regelbesteuerte Verkäufe ohne Steuersatz — mit 19 % gerechnet. Bitte den Satz an den Verkäufen nachtragen.</td></tr>` : ''}
                            ${diff25aUmsatz > 0 ? `<tr style="opacity:0.8;">
                                <td style="padding-left:16px;font-size:12px;">↳ davon differenzbesteuerte Umsätze <span style="color:var(--text-muted);">(§25a UStG)</span></td>
                                <td style="text-align:right;font-size:12px;">${Utils.formatCurrency(diff25aUmsatz)}</td>
                            </tr>` : ''}
                            <tr class="euer-total">
                                <td><strong>Summe Einnahmen</strong>${isRegel ? '' : ' <span style="font-size:11px;font-weight:400;color:var(--text-muted);">§19 UStG – keine Umsatzsteuer</span>'}</td>
                                <td style="text-align:right"><strong>${Utils.formatCurrency(summeEinnahmen)}</strong></td>
                            </tr>

                            <tr class="euer-section-header" style="background:rgba(239,68,68,.07);"><td colspan="2" style="color:var(--danger);padding:10px 14px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.8px;"><i class="ti ti-trending-down" style="margin-right:5px;vertical-align:middle;font-size:13px;"></i>Ausgaben</td></tr>
                            <tr>
                                <td>Wareneinkauf <span style="font-size:11px;color:var(--text-muted);">(${periodPurchases.length} Artikel im Zeitraum eingekauft)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(wareneinkauf)}</td>
                            </tr>
                            ${diff25aWareneinkauf > 0 ? `<tr style="opacity:0.8;">
                                <td style="padding-left:16px;font-size:12px;">↳ davon Wareneinkauf §25a <span style="color:var(--text-muted);">(ohne Vorsteuerabzug erworben)</span></td>
                                <td style="text-align:right;font-size:12px;">${Utils.formatCurrency(diff25aWareneinkauf)}</td>
                            </tr>` : ''}
                            <tr>
                                <td>Versandkosten (Verkäufer)</td>
                                <td style="text-align:right">${Utils.formatCurrency(versandkosten)}</td>
                            </tr>
                            <tr>
                                <td>Plattformgebühren <span style="font-size:11px;color:var(--text-muted);">(aus Verkäufen)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(plattformgebuehren)}</td>
                            </tr>
                            ${fahrtkosten > 0 ? `<tr>
                                <td>Fahrtkosten <span style="font-size:11px;color:var(--text-muted);">(Fahrtenbuch – §9 EStG)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(fahrtkosten)}</td>
                            </tr>` : ''}
                            ${materialEinkauf > 0 ? `<tr>
                                <td>Verpackungsmaterial (eingekauft) <span style="font-size:11px;color:var(--text-muted);">(Materiallager – ohne Einkäufe, die schon als Ausgabe erfasst sind)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(materialEinkauf)}</td>
                            </tr>` : ''}
                            ${afaKosten > 0 ? `<tr>
                                <td>Abschreibungen AfA <span style="font-size:11px;color:var(--text-muted);">(§7 EStG – ${afaAnlagen.length} Anlage(n)${this._period !== 'jahr' ? ', zeitanteilig' : ''})</span>
                                    <a href="#" data-action="navigate" data-args=\'["afa"]\' style="font-size:11px;margin-left:6px;">→ Anlagenverzeichnis</a>
                                </td>
                                <td style="text-align:right">${Utils.formatCurrency(afaKosten)}</td>
                            </tr>` : afaAnlagen.length > 0 ? `<tr style="opacity:0.6;">
                                <td>Abschreibungen AfA <span style="font-size:11px;color:var(--text-muted);">(keine AfA in diesem Zeitraum)</span></td>
                                <td style="text-align:right">–</td>
                            </tr>` : ''}
                            ${anlagenRestbuchwert > 0 ? `<tr>
                                <td>Restbuchwert ausgeschiedener Anlagegüter <span style="font-size:11px;color:var(--text-muted);">(§4 Abs.3 S.4 EStG – Abgang im Anlagenverzeichnis)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(anlagenRestbuchwert)}</td>
                            </tr>` : ''}
                            <tr>
                                <td>
                                    <strong>Betriebsausgaben gesamt</strong>
                                    <span style="font-size:11px;color:var(--text-muted);margin-left:8px;">(${_d.betriebsExpenses.length} Posten)</span>
                                </td>
                                <td style="text-align:right"><strong>${Utils.formatCurrency(sonstigeAusgaben)}</strong></td>
                            </tr>
                            ${kategorien.filter(k => catBreakdown[k] > 0).map(k => `
                            <tr style="opacity:0.75;">
                                <td style="padding-left:24px;font-size:12px;">↳ ${k}</td>
                                <td style="text-align:right;font-size:12px;">${Utils.formatCurrency(catBreakdown[k])}</td>
                            </tr>
                            `).join('')}
                            ${nichtAbziehbar > 0 ? `<tr style="opacity:0.8;">
                                <td style="padding-left:16px;font-size:12px;">↳ davon nicht abziehbar <span style="color:var(--text-muted);">(Bewirtung 30 %, Geschenke über 50 €, Gewerbesteuer – §4 Abs. 5/5b EStG; mindert den Gewinn nicht)</span></td>
                                <td style="text-align:right;font-size:12px;">−${Utils.formatCurrency(nichtAbziehbar)}</td>
                            </tr>` : ''}
                            ${privatAnteil > 0 ? `<tr style="opacity:0.8;">
                                <td style="padding-left:16px;font-size:12px;">↳ davon Privatanteil <span style="color:var(--text-muted);">(keine Betriebsausgabe, keine Vorsteuer)</span></td>
                                <td style="text-align:right;font-size:12px;">−${Utils.formatCurrency(privatAnteil)}</td>
                            </tr>` : ''}
                            ${eigenbelegeAusgaben > 0 ? `<tr>
                                <td>Eigenbelege (Ersatzbelege) <span style="font-size:11px;color:var(--text-muted);">(${eigenbelegeRaw.filter(b => !b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, startDate, endDate)).length} Belege)</span></td>
                                <td style="text-align:right">${Utils.formatCurrency(eigenbelegeAusgaben)}</td>
                            </tr>` : ''}
                            ${isRegel ? `<tr style="opacity:0.8;">
                                <td style="padding-left:16px;font-size:12px;">↳ davon gezahlte Vorsteuer <span style="color:var(--text-muted);">(in den Beträgen oben enthalten, tatsächlicher Satz je Beleg)</span></td>
                                <td style="text-align:right;font-size:12px;">${Utils.formatCurrency(vorsteuer)}</td>
                            </tr>` : ''}
                            ${ustZahlungenFA > 0 ? `<tr>
                                <td>Umsatzsteuer an das Finanzamt gezahlt</td>
                                <td style="text-align:right">${Utils.formatCurrency(ustZahlungenFA)}</td>
                            </tr>` : ''}
                            <tr class="euer-total">
                                <td><strong>Summe Ausgaben</strong></td>
                                <td style="text-align:right"><strong>${Utils.formatCurrency(summeAusgaben)}</strong></td>
                            </tr>

                            <tr class="euer-result">
                                <td><strong><i class="ti ${gewinn >= 0 ? 'ti-trending-up' : 'ti-trending-down'}" style="color:${gewinn >= 0 ? 'var(--success)' : 'var(--danger)'}"></i> ${gewinn >= 0 ? 'Gewinn (Überschuss)' : 'Verlust (Fehlbetrag)'}</strong></td>
                                <td style="text-align:right;font-size:1.15rem;color:${gewinn >= 0 ? 'var(--success)' : 'var(--danger)'}"><strong>${Utils.formatCurrency(gewinn)}</strong></td>
                            </tr>
                            ${isRegel ? `<tr style="opacity:0.8;">
                                <td style="font-size:12px;">Zum Vergleich: wirtschaftlicher Nettogewinn <span style="color:var(--text-muted);">(ohne Umsatzsteuer und ohne Zahlungen mit dem Finanzamt — nicht für die Steuererklärung)</span></td>
                                <td style="text-align:right;font-size:12px;">${Utils.formatCurrency(nettoGewinn)}</td>
                            </tr>` : ''}
                        </tbody>
                    </table>
                </div>
                ${diff25aUmsatz > 0 ? `<div class="card" style="margin-top:12px;padding:14px 16px;font-size:12px;color:var(--text-secondary);">
                    <strong><i class="ti ti-tag" style="margin-right:4px;"></i> Bemessungsgrundlage §25a (Marge)</strong> — nur Anzeige, keine Auswirkung auf den Gewinn oben.<br>
                    Einzeldifferenz-Vorschau: Marge ${Utils.formatCurrency(diff25aMargePreview.margeBrutto)} · davon USt ${Utils.formatCurrency(diff25aMargePreview.ust)}.
                    Maßgeblich für die tatsächliche USt-Schuld (inkl. gewählter Methode Einzel-/Gesamtdifferenz) ist die <a href="#" data-action="navigate" data-args='["ustvoranmeldung"]'>USt-Voranmeldung</a>.
                </div>` : ''}
                <div style="padding:12px 16px;border-top:1px solid var(--border);font-size:11px;color:var(--text-muted);display:flex;gap:16px;flex-wrap:wrap;">
                    <span><i class="ti ti-clipboard-list"></i> Grundlage: §4 Abs. 3 EStG (Ist-Besteuerung / Zufluss-Abfluss)</span>
                    <span><i class="ti ti-box"></i> ${periodPurchases.length} Einkäufe · ${sales.length} Verkäufe · ${expenses.length} Ausgaben</span>
                    ${eigenbelegeRaw.filter(b => !b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, startDate, endDate)).length > 0
                        ? `<span><i class="ti ti-receipt"></i> ${eigenbelegeRaw.filter(b => !b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, startDate, endDate)).length} Eigenbelege</span>`
                        : ''}
                    <span style="color:var(--warning);"><i class="ti ti-alert-triangle"></i> Unverbindlich – Prüfung durch Steuerberater empfohlen</span>
                </div>
            </div>

            ${gbrBlock}

            ${this._period === 'jahr' ? this._renderGewerbesteuerBlock(gewinn) : ''}

            ${typeof DatevExport !== 'undefined' ? DatevExport.renderCard() : ''}
        `;
    },

    // ── Gewerbesteuer-Rechner (nur für Jahresansicht) ──────────────────────
    // Nur für tatsächlich gewerbesteuerpflichtige Rechtsformen anzeigen (Fix 2026-07-30: lief
    // vorher unconditional, suggerierte Freiberuflern fälschlich eine GewSt-Pflicht — Freiberufler
    // haben laut js/rechtsform.js gewerbesteuer:false). Freibetrag nur für natürliche
    // Personen/Personengesellschaften (gewStFreibetrag>0 in rechtsform.js), NICHT für
    // Kapitalgesellschaften (GmbH/UG: gewStFreibetrag=0).
    _renderGewerbesteuerBlock(gewinn) {
        // Rechenweg und Hebesatz aus js/gewerbesteuer.js (Steuer-Audit 2026-10-18, E-04/E-05c):
        // vorher eigene Formel ohne Abrundung, eigener Hebesatz-Speicher, und Freiberufler bekamen
        // hier eine Gewerbesteuer angezeigt.
        if (typeof Gewerbesteuer === 'undefined' || !Gewerbesteuer._isGewStPflichtig()) return '';
        const hatFreibetrag = Gewerbesteuer._hatFreibetrag();
        const k = Gewerbesteuer.berechne(gewinn + Gewerbesteuer._sonderSaldo(this._selectedYear), { freibetrag: hatFreibetrag });
        const freibetrag = k.freibetrag;
        const gewerbeertrag = k.gewerbeertrag;
        const steuermessbetrag = k.messbetrag;
        const hebesatz = k.hebesatz;
        const gewerbesteuer = k.gewSt;
        const istGewPflichtig = gewerbesteuer > 0;
        const rechtsformLabel = typeof Rechtsform !== 'undefined' ? Rechtsform.get() : 'Einzelunternehmen';
        // Nur-Lese-Ansicht des Steuerberaters: das Feld haengt an data-action-input, und der
        // zentrale Chokepoint (js/actions.js) prueft StbShare.blocks() NUR fuer data-action und
        // data-action-submit. Ein Namensfilter erreicht dieses Feld also grundsaetzlich nicht —
        // deshalb hier am Markup. Der Store weist den Schreibvorgang ohnehin ab; ohne readonly
        // rechnete die Anzeige aber live mit einem Hebesatz weiter, der nirgends gespeichert
        // wird. Ein Berater entschiede dann auf einem Stand, den er selbst erzeugt hat.
        // Gefunden am 2026-09-13 (01-AUFGABEN.md 1.7).
        const hebesatzRo = (typeof StbShare !== 'undefined' && StbShare.isReadonly && StbShare.isReadonly())
            ? ' readonly title="Nur-Lese-Ansicht — der Hebesatz des Mandanten kann hier nicht geändert werden."'
            : '';

        return `
        <div class="card" style="margin-top:20px;" id="euerGewStCard">
            <div class="card-header">
                <div class="card-title"><i class="ti ti-building-bank"></i> Gewerbesteuer-Rechner</div>
                <div style="font-size:12px;color:var(--text-muted);">§11 GewStG · ${Utils.escapeHtml(rechtsformLabel)}</div>
            </div>
            <div class="table-container" style="border:none;">
                <table class="euer-table">
                    <thead><tr><th style="width:60%">Position</th><th style="text-align:right">Betrag</th></tr></thead>
                    <tbody>
                        <tr><td>Gewinn aus Gewerbebetrieb (EÜR)</td><td style="text-align:right">${Utils.formatCurrency(gewinn)}</td></tr>
                        ${hatFreibetrag ? `<tr><td>Freibetrag §11 GewStG (natürl. Person/Personenges.)</td><td style="text-align:right;color:var(--success)">−${Utils.formatCurrency(freibetrag)}</td></tr>` : `<tr><td>Freibetrag §11 GewStG</td><td style="text-align:right;color:var(--text-muted)">— (Kapitalgesellschaft)</td></tr>`}
                        <tr><td><strong>Gewerbeertrag (Bemessungsgrundlage)</strong></td><td style="text-align:right"><strong>${Utils.formatCurrency(gewerbeertrag)}</strong></td></tr>
                        <tr><td>Steuermesszahl §11 Abs. 2 GewStG (3,5%)</td><td style="text-align:right">${Utils.formatCurrency(steuermessbetrag)}</td></tr>
                        <tr>
                            <td>
                                Hebesatz der Gemeinde
                                <input type="number" id="gewstHebesatz" value="${hebesatz}" min="200" max="900" step="50"
                                    style="width:70px;margin-left:8px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg-secondary);color:var(--text-primary);"
                                    data-action-input="euer-hebesatz"${hebesatzRo}>
                                %
                                <span style="font-size:11px;color:var(--text-muted);margin-left:4px;">(Ø Deutschland: 400%)</span>
                            </td>
                            <td style="text-align:right">× ${hebesatz}%</td>
                        </tr>
                        <tr class="euer-result">
                            <td><strong><i class="ti ${istGewPflichtig ? 'ti-alert-circle' : 'ti-circle-check'}" style="color:${istGewPflichtig ? 'var(--danger)' : 'var(--success)'}"></i> ${istGewPflichtig ? 'Gewerbesteuer (geschätzt)' : 'Keine Gewerbesteuer'}</strong>
                                ${!istGewPflichtig && hatFreibetrag ? `<span style="font-size:11px;font-weight:400;color:var(--success);">(Gewinn unter Freibetrag ${Utils.formatCurrency(freibetrag)})</span>` : ''}
                            </td>
                            <td style="text-align:right;font-size:1.15rem;color:${istGewPflichtig ? 'var(--danger)' : 'var(--success)'}">
                                <strong id="gewstBetrag">${Utils.formatCurrency(gewerbesteuer)}</strong>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style="padding:10px 16px;font-size:11px;color:var(--text-muted);">
                Schätzung ohne GewSt-Hinzurechnungen/Kürzungen (§§8–9 GewStG) · Freibetrag nur für natürl. Personen/Personenges.
                ${hatFreibetrag ? `· Gewerbesteuer ist nach §35 EStG auf die ESt anrechenbar (max. 4 × Steuermessbetrag, begrenzt auf die tatsächlich anfallende ESt — seit VZ 2020, s. Gewerbesteuer-Modul für Details) ·` : ''}
                Prüfung durch Steuerberater empfohlen.
            </div>
        </div>`;
    },

    _updateHebesatz(val) {
        const hs = parseInt(val) || 400;
        if (typeof Gewerbesteuer === 'undefined') return;
        Gewerbesteuer._setHebesatz(hs);   // ein Speicher für alle Seiten (E-04)
        // Neuberechnung ohne Full-Refresh (nur Betrag aktualisieren)
        const gewinn = this._lastGewinn || 0;
        const k = Gewerbesteuer.berechne(gewinn + Gewerbesteuer._sonderSaldo(this._selectedYear), { freibetrag: Gewerbesteuer._hatFreibetrag(), hebesatz: hs });
        const el = document.getElementById('gewstBetrag');
        if (el) el.textContent = Utils.formatCurrency(k.gewSt);
    },

    _renderDetailSection(type) {
        const d = this._lastRenderData;
        if (!d || !d.sales) return '';

        const thStyle = 'padding:8px 12px;font-size:11px;font-weight:700;color:var(--text-muted);text-align:left;border-bottom:2px solid var(--border);white-space:nowrap;';
        const tdStyle = 'padding:7px 12px;font-size:12px;border-bottom:1px solid var(--border);vertical-align:middle;';
        const tdR     = tdStyle + 'text-align:right;font-weight:600;';

        if (type === 'einnahmen') {
            const rows = d.sales.map(s => {
                const vk   = parseFloat(s.verkaufspreis)||0;
                const vkK  = parseFloat(s.versandkostenKaeufer)||0;
                return `<tr>
                    <td style="${tdStyle}">${Utils.formatDate(s.datum)}</td>
                    <td style="${tdStyle}"><strong>${Utils.escapeHtml(s.marke||'—')}</strong>${s.artikeltyp?' <span style="color:var(--text-muted);">'+Utils.escapeHtml(s.artikeltyp)+'</span>':''}</td>
                    <td style="${tdStyle};color:var(--text-muted);">${Utils.escapeHtml(s.beschreibung||s.groesse||'—')}</td>
                    <td style="${tdStyle}">${Utils.escapeHtml(s.plattform||s.verkaufsplattform||'—')}</td>
                    <td style="${tdR}">${Utils.formatCurrency(vk)}</td>
                    <td style="${tdR};color:var(--text-muted);">${vkK>0?Utils.formatCurrency(vkK):'—'}</td>
                    <td style="${tdR};color:var(--success);">${Utils.formatCurrency(vk+vkK)}</td>
                </tr>`;
            }).join('');
            return `<div class="card" style="padding:0;overflow:hidden;">
                <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-weight:700;font-size:13px;"><i class="ti ti-trending-up" style="color:var(--success);"></i> Einnahmen — ${d.periodLabel} <span style="color:var(--text-muted);font-weight:400;">(${d.sales.length} Verkäufe)</span></div>
                    <div style="font-weight:800;font-size:15px;color:var(--success);">${Utils.formatCurrency(d.summeEinnahmen)}</div>
                </div>
                ${d.sales.length === 0 ? '<div style="padding:24px;text-align:center;color:var(--text-muted);">Keine Einnahmen im Zeitraum</div>' :
                `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
                    <thead><tr>
                        <th style="${thStyle}">Datum</th>
                        <th style="${thStyle}">Artikel</th>
                        <th style="${thStyle}">Beschreibung</th>
                        <th style="${thStyle}">Plattform</th>
                        <th style="${thStyle};text-align:right;">VK-Preis</th>
                        <th style="${thStyle};text-align:right;">Versand</th>
                        <th style="${thStyle};text-align:right;">Gesamt</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table></div>`}
            </div>`;
        }

        if (type === 'ausgaben') {
            const einkaufRows = d.periodPurchases.filter(p => !p.eigenbeleg_id).map(p => `<tr>
                <td style="${tdStyle}">${Utils.formatDate(p.datum)}</td>
                <td style="${tdStyle};color:var(--text-muted);font-size:11px;">${Utils.escapeHtml(p.artikelNr||'—')}</td>
                <td style="${tdStyle}"><strong>${Utils.escapeHtml(p.marke||'—')}</strong>${p.artikeltyp?' <span style="color:var(--text-muted);">'+Utils.escapeHtml(p.artikeltyp)+'</span>':''}</td>
                <td style="${tdStyle};color:var(--text-muted);">${Utils.escapeHtml(p.beschreibung||p.groesse||'—')}</td>
                <td style="${tdStyle}">${Utils.escapeHtml(p.einkaufsquelle||'—')}</td>
                <td style="${tdR};color:var(--danger);">${Utils.formatCurrency((parseFloat(p.einkaufspreis)||0)*(parseInt(p.anzahl)||1))}</td>
            </tr>`).join('');

            const baRows = d.expenses.map(e => `<tr>
                <td style="${tdStyle}">${Utils.formatDate(e.datum)}</td>
                <td style="${tdStyle}"><span class="badge badge-info">${Utils.escapeHtml(e.kategorie||'Sonstiges')}</span></td>
                <td style="${tdStyle};color:var(--text-muted);">${Utils.escapeHtml(e.beschreibung||'—')}</td>
                <td style="${tdR};color:var(--danger);">${Utils.formatCurrency(parseFloat(e.betrag)||0)}</td>
            </tr>`).join('');

            const filteredEB = d.eigenbelegeRaw.filter(b => !b.storniert && b.belegDatum && Utils.isInPeriod(b.belegDatum, d.startDate, d.endDate));
            const ebRows = filteredEB.map(b => `<tr>
                <td style="${tdStyle}">${Utils.formatDate(b.belegDatum)}</td>
                <td style="${tdStyle}"><span class="badge badge-warning">Eigenbeleg</span></td>
                <td style="${tdStyle};color:var(--text-muted);">${Utils.escapeHtml(b.beschreibung||b.belegNr||'—')}</td>
                <td style="${tdR};color:var(--danger);">${Utils.formatCurrency(parseFloat(b.betragNetto)||parseFloat(b.betragBrutto)||0)}</td>
            </tr>`).join('');

            return `<div class="card" style="padding:0;overflow:hidden;">
                <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-weight:700;font-size:13px;"><i class="ti ti-trending-down" style="color:var(--danger);"></i> Ausgaben — ${d.periodLabel}</div>
                    <div style="font-weight:800;font-size:15px;color:var(--danger);">${Utils.formatCurrency(d.summeAusgaben)}</div>
                </div>
                ${d.periodPurchases.filter(p=>!p.eigenbeleg_id).length > 0 ? `
                <div style="padding:10px 16px 6px;font-size:12px;font-weight:700;color:var(--text-secondary);border-bottom:1px solid var(--border);"><i class="ti ti-shopping-cart"></i> Wareneinkauf (${d.periodPurchases.filter(p=>!p.eigenbeleg_id).length} Artikel)</div>
                <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
                    <thead><tr>
                        <th style="${thStyle}">Datum</th><th style="${thStyle}">Art.-Nr.</th>
                        <th style="${thStyle}">Artikel</th><th style="${thStyle}">Beschreibung</th>
                        <th style="${thStyle}">Quelle</th><th style="${thStyle};text-align:right;">Betrag</th>
                    </tr></thead>
                    <tbody>${einkaufRows}</tbody>
                </table></div>` : ''}
                ${d.expenses.length > 0 ? `
                <div style="padding:10px 16px 6px;font-size:12px;font-weight:700;color:var(--text-secondary);border-bottom:1px solid var(--border);"><i class="ti ti-briefcase"></i> Betriebsausgaben (${d.expenses.length})</div>
                <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
                    <thead><tr>
                        <th style="${thStyle}">Datum</th><th style="${thStyle}">Kategorie</th>
                        <th style="${thStyle}">Beschreibung</th><th style="${thStyle};text-align:right;">Betrag</th>
                    </tr></thead>
                    <tbody>${baRows}</tbody>
                </table></div>` : ''}
                ${filteredEB.length > 0 ? `
                <div style="padding:10px 16px 6px;font-size:12px;font-weight:700;color:var(--text-secondary);border-bottom:1px solid var(--border);"><i class="ti ti-receipt"></i> Eigenbelege (${filteredEB.length})</div>
                <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">
                    <thead><tr>
                        <th style="${thStyle}">Datum</th><th style="${thStyle}">Typ</th>
                        <th style="${thStyle}">Beschreibung</th><th style="${thStyle};text-align:right;">Betrag</th>
                    </tr></thead>
                    <tbody>${ebRows}</tbody>
                </table></div>` : ''}
                ${d.periodPurchases.filter(p=>!p.eigenbeleg_id).length===0 && d.expenses.length===0 && filteredEB.length===0 ?
                    '<div style="padding:24px;text-align:center;color:var(--text-muted);">Keine Ausgaben im Zeitraum</div>' : ''}
            </div>`;
        }

        if (type === 'gewinn') {
            const isPos = d.gewinn >= 0;
            const rows = [
                ['Summe Einnahmen', d.summeEinnahmen, 'var(--success)'],
                ['− Wareneinkauf', -d.wareneinkauf, 'var(--danger)'],
                ['− Versandkosten', -d.versandkosten, 'var(--danger)'],
                ['− Plattformgebühren', -d.plattformgebuehren, 'var(--danger)'],
                d.fahrtkosten > 0   ? ['− Fahrtkosten', -d.fahrtkosten, 'var(--danger)'] : null,
                d.materialEinkauf > 0? ['− Verpackungsmaterial', -d.materialEinkauf, 'var(--danger)'] : null,
                d.afaKosten > 0     ? ['− AfA / Abschreibungen', -d.afaKosten, 'var(--danger)'] : null,
                d.anlagenRestbuchwert > 0 ? ['− Restbuchwert ausgeschiedener Anlagen', -d.anlagenRestbuchwert, 'var(--danger)'] : null,
                d.sonstigeAusgaben > 0 ? ['− Betriebsausgaben', -d.sonstigeAusgaben, 'var(--danger)'] : null,
                d.eigenbelegeAusgaben > 0 ? ['− Eigenbelege', -d.eigenbelegeAusgaben, 'var(--danger)'] : null,
            ].filter(Boolean);
            const rowHtml = rows.map(([label, val, color]) => `<tr>
                <td style="${tdStyle}">${label}</td>
                <td style="${tdR};color:${color};">${val < 0 ? Utils.formatCurrency(Math.abs(val)) : Utils.formatCurrency(val)}</td>
            </tr>`).join('');
            return `<div class="card" style="padding:0;overflow:hidden;">
                <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-weight:700;font-size:13px;"><i class="ti ti-scale" style="color:${isPos?'var(--success)':'var(--danger)'};"></i> Gewinnzusammensetzung — ${d.periodLabel}</div>
                    <div style="font-weight:800;font-size:15px;color:${isPos?'var(--success)':'var(--danger)'};">${Utils.formatCurrency(d.gewinn)}</div>
                </div>
                <div style="overflow-x:auto;max-width:480px;"><table style="width:100%;border-collapse:collapse;">
                    <tbody>${rowHtml}
                    <tr style="border-top:2px solid var(--border);">
                        <td style="${tdStyle};font-weight:800;font-size:14px;">= ${isPos?'Gewinn':'Verlust'}</td>
                        <td style="${tdR};font-size:15px;font-weight:800;color:${isPos?'var(--success)':'var(--danger)'};">${Utils.formatCurrency(Math.abs(d.gewinn))}</td>
                    </tr>
                    </tbody>
                </table></div>
            </div>`;
        }
        return '';
    },

    _destroyCharts() {
        this._charts.forEach(c => { try { c.destroy(); } catch (e) { /* Element schon weg */ } });
        this._charts = [];
    },

    // Von App.navigate beim Verlassen der Seite aufgerufen — sonst lebten die Diagramme bis zum
    // nächsten EÜR-Aufruf weiter (siehe js/dashboard.js runLeaveHook).
    runLeaveHook() { this._destroyCharts(); },

    init() {
        this._destroyCharts();
        if (this._view === 'uva') {
            if (typeof UstVoranmeldung !== 'undefined') UstVoranmeldung.init();
            return;
        }

        // ── ApexCharts ───────────────────────────────────────────────────────
        if (typeof ApexCharts !== 'undefined') {
            const d = this._lastRenderData;
            const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
            const textMuted = isDark ? '#71717a' : '#9ca3af';
            const borderColor = isDark ? '#27272a' : '#e4e4e7';

            // Monats-Balken
            const monthEl = document.getElementById('euerMonthChart');
            if (monthEl && d.monthlyData) {
                const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
                const monthChart = new ApexCharts(monthEl, {
                    chart: { type: 'bar', height: 200, toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit', animations: { enabled: true, speed: 500 } },
                    series: [
                        { name: 'Einnahmen', data: d.monthlyData.map(m => m.ein) },
                        { name: 'Ausgaben',  data: d.monthlyData.map(m => m.aus) }
                    ],
                    xaxis: { categories: months, labels: { style: { fontSize: '10px', colors: textMuted } }, axisBorder: { show: false }, axisTicks: { show: false } },
                    yaxis: { labels: { formatter: v => v >= 1000 ? (v/1000).toLocaleString('de-DE',{maximumFractionDigits:1})+'k€' : v+'€', style: { fontSize: '10px', colors: textMuted } } },
                    colors: ['#22c55e', '#ef4444'],
                    plotOptions: { bar: { borderRadius: 3, columnWidth: '65%', borderRadiusApplication: 'end' } },
                    dataLabels: { enabled: false },
                    grid: { borderColor, strokeDashArray: 3, padding: { left: 0, right: 0 } },
                    legend: { labels: { colors: textMuted }, fontSize: '11px', position: 'top', horizontalAlign: 'right', offsetY: -5 },
                    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => v.toLocaleString('de-DE',{style:'currency',currency:'EUR'}) } }
                });
                this._charts.push(monthChart);
                monthChart.render();
            }

            // Donut Ausgaben
            const donutEl = document.getElementById('euerDonutChart');
            if (donutEl && d.donutLabels && d.donutValues) {
                const total = d.donutValues.reduce((a,b) => a+b, 0);
                if (total > 0) {
                    const donutChart = new ApexCharts(donutEl, {
                        chart: { type: 'donut', height: 200, background: 'transparent', fontFamily: 'inherit', animations: { enabled: true, speed: 500 } },
                        series: d.donutValues,
                        labels: d.donutLabels,
                        colors: ['#ef5350','#f5a623','#3b82f6','#8b93f8','#ec4899','#10b981','#6b7280','#f97316'],
                        dataLabels: { enabled: false },
                        plotOptions: { pie: { donut: { size: '68%', labels: { show: true, total: { show: true, label: 'Gesamt', color: textMuted, fontSize: '11px', formatter: () => total.toLocaleString('de-DE',{style:'currency',currency:'EUR'}) } } } } },
                        legend: { position: 'bottom', fontSize: '10px', labels: { colors: textMuted }, itemMargin: { horizontal: 5, vertical: 2 } },
                        tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: v => v.toLocaleString('de-DE',{style:'currency',currency:'EUR'}) } }
                    });
                    this._charts.push(donutChart);
                    donutChart.render();
                } else {
                    donutEl.innerHTML = '<div style="height:180px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:13px;">Keine Ausgaben im Zeitraum</div>';
                }
            }
        }

        // GSAP KPI card animation
        if (typeof gsap !== 'undefined') {
            const cards = document.querySelectorAll('#euerKpiGrid .stat-card');
            if (cards.length) {
                gsap.from(cards, { y: 16, opacity: 0, stagger: 0.08, duration: 0.45, ease: 'power2.out', clearProps: 'all' });
                cards.forEach(card => {
                    const valEl = card.querySelector('.card-value');
                    if (!valEl) return;
                    const raw = valEl.textContent.trim();
                    if (raw.includes('/')) return; // Skip ratio values
                    const num = parseFloat(raw.replace(/\./g,'').replace(',','.').replace(/[^\d.-]/g,''));
                    if (isNaN(num) || num === 0) return;
                    const isNeg = num < 0, hasCurrency = raw.includes('€');
                    const origColor = valEl.style.color;
                    const obj = { val: 0 };
                    gsap.to(obj, { val: Math.abs(num), duration: 1.0, ease: 'power2.out',
                        onUpdate() { valEl.textContent = (hasCurrency ? (isNeg?'−':'')+obj.val.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' €' : Math.round(obj.val).toLocaleString('de-DE')); },
                        onComplete() { valEl.textContent = raw; if(origColor) valEl.style.color = origColor; }
                    });
                });
            }
        }

        // KPI-Karten Detail-Toggle
        document.querySelectorAll('[data-euer-detail]').forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.euerDetail;
                this._detailView = this._detailView === type ? null : type;
                const section = document.getElementById('euerDetailSection');
                if (section) {
                    section.innerHTML = this._detailView ? this._renderDetailSection(this._detailView) : '';
                }
                // Update outline + arrow indicators
                document.querySelectorAll('[data-euer-detail]').forEach(c => {
                    const t = c.dataset.euerDetail;
                    const isActive = t === this._detailView;
                    c.style.outline = isActive ? '2px solid var(--accent)' : '';
                    c.style.outlineOffset = isActive ? '2px' : '';
                    const arrow = c.querySelector('span');
                    if (arrow) arrow.textContent = isActive ? '▲' : '▼';
                });
            });
        });

        // Sicherstellen dass alle bezahlten Rechnungen in Sales gesynct sind
        Store.autoSyncInvoices();

        const periodSelect = document.getElementById('euerPeriod');
        const yearGroup = document.getElementById('yearGroup');
        const monthGroup = document.getElementById('monthGroup');
        const quarterGroup = document.getElementById('quarterGroup');
        const customStartGroup = document.getElementById('customStartGroup');
        const customEndGroup = document.getElementById('customEndGroup');

        const updateVisibility = () => {
            const p = this._period;
            if (yearGroup)        yearGroup.style.display        = p === 'custom' ? 'none' : '';
            if (monthGroup)       monthGroup.style.display       = p === 'monat' ? '' : 'none';
            if (quarterGroup)     quarterGroup.style.display     = p === 'quartal' ? '' : 'none';
            if (customStartGroup) customStartGroup.style.display = p === 'custom' ? '' : 'none';
            if (customEndGroup)   customEndGroup.style.display   = p === 'custom' ? '' : 'none';
        };

        if (periodSelect) periodSelect.addEventListener('change', () => {
            this._period = periodSelect.value;
            updateVisibility();
            this._refresh();
        });

        const yearSelect = document.getElementById('euerYear');
        if (yearSelect) {
            yearSelect.addEventListener('change', () => {
                this._selectedYear = parseInt(yearSelect.value);
                this._refresh();
            });
        }

        const monthSelect = document.getElementById('euerMonth');
        if (monthSelect) {
            monthSelect.addEventListener('change', () => {
                this._selectedMonth = parseInt(monthSelect.value);
                this._refresh();
            });
        }

        const quarterSelect = document.getElementById('euerQuarter');
        if (quarterSelect) {
            quarterSelect.addEventListener('change', () => {
                this._selectedMonth = parseInt(quarterSelect.value) * 3;
                this._refresh();
            });
        }

        const customStart = document.getElementById('euerCustomStart');
        const customEnd = document.getElementById('euerCustomEnd');
        if (customStart) {
            customStart.addEventListener('change', () => {
                this._customStart = customStart.value;
                this._refresh();
            });
        }
        if (customEnd) {
            customEnd.addEventListener('change', () => {
                this._customEnd = customEnd.value;
                this._refresh();
            });
        }

        const ustModeSelect = document.getElementById('euerUstMode');
        if (ustModeSelect) ustModeSelect.addEventListener('change', () => {
            const settings = Store.getSettings();
            settings.ustMode = ustModeSelect.value;
            Store.saveSettings(settings);
            this._refresh();
        });

        const printBtn = document.getElementById('euerPrint');
        if (printBtn) printBtn.addEventListener('click', () => {
            // Achievement-Flag setzen: User hat EÜR exportiert
            try { localStorage.setItem('akademie_flag_eur_exported', '1'); } catch(e) {}
            if (typeof Akademie !== 'undefined' && Akademie.checkNewAchievements) Akademie.checkNewAchievements();
            window.print();
        });

        const steuerBtn = document.getElementById('euerSteuertermine');
        if (steuerBtn) steuerBtn.addEventListener('click', () => {
            App._cameFromEuer = true;
            App.navigate('steuertermine');
        });

        const elsterBtn = document.getElementById('euerElsterExport');
        if (elsterBtn) {
            elsterBtn.addEventListener('click', () => {
                // Werte kommen aus demselben Rechenkern wie die Anzeige (T02) — keine eigene Formel.
                const y = this._selectedYear;
                const d = this._berechne(y, this._selectedMonth, this._period);
                const sDate = d.startDate, eDate = d.endDate;
                if (!d.sales.length && !d.periodPurchases.length && !d.expenses.length && !d.fahrtkosten
                    && !d.unsyncedInvoices.length && !d.afaKosten && !d.eigenbelegeAusgaben) {
                    Utils.showToast(`Keine Daten für ${sDate} bis ${eDate} — nichts zu exportieren`, 'warning');
                    return;
                }
                const fassung = this._anlageEuerFassung(y);
                const zeilen = this._elsterZeilen(d).filter(z => z.key === 'gewinn' || Math.abs(z.betrag) >= 0.005);
                const rows = [
                    ['Übertragungshilfe Anlage EÜR (keine ELSTER-Datei)', '', ''],
                    ['Zeitraum:', sDate + ' bis ' + eDate, ''],
                    ['Hinweis:', 'Bezeichnungen sinngemäß — Zeile im Formular des Erklärungsjahres ' + y + ' selbst zuordnen.' + (fassung.geprueft ? '' : ' Zuordnung für dieses Jahr nicht eigens geprüft.'), ''],
                    ...(d.ohneSteuersatz.length ? [['Achtung:', d.ohneSteuersatz.length + ' regelbesteuerte Verkäufe ohne Steuersatz — mit 19 % gerechnet, bitte prüfen.', '']] : []),
                    ['', '', ''],
                    ['Position', 'Betrag (€)', ''],
                    ...zeilen.map(z => [z.bezeichnung, z.betrag.toFixed(2), z.info ? 'nur Angabe' : ''])
                ];
                Utils.downloadCSV(rows, `anlage_euer_hilfe_${y}.csv`);
                // Ein Toast beantwortete die naechste Frage nicht: ELSTER importiert keine
                // beliebige CSV in die Anlage EUeR, die Werte muessen uebertragen werden. Ein
                // Nicht-Steuerexperte sass hier mit einer Datei da, die er nicht einordnen kann.
                App.showModal("Datei gespeichert — so geht's weiter", `
                    <p style="margin:0 0 14px;line-height:1.7;">Die Datei <strong>anlage_euer_hilfe_${y}.csv</strong> liegt jetzt in deinem Download-Ordner. Stackr übermittelt nichts an ELSTER — die Werte trägst du selbst ein.</p>
                    <ol style="margin:0 0 14px;padding-left:20px;line-height:1.9;">
                        <li>Bei <strong>ELSTER</strong> anmelden und die <strong>Anlage EÜR ${y}</strong> öffnen.</li>
                        <li>Jede Position der CSV der gleichnamigen Zeile des Formulars zuordnen und den Betrag übertragen. Die Zeilennummern ändern sich von Jahr zu Jahr und stehen deshalb nicht in der Datei.</li>
                        <li>Alternativ die Datei deinem Steuerberater schicken.</li>
                    </ol>
                    <p style="margin:0;font-size:12.5px;color:var(--text-muted);line-height:1.7;">„Übrige Betriebsausgaben" ist ein Sammelposten aus allen Ausgabenkategorien außer Wareneinkauf, AfA und Fahrtkosten. Wenn du Personal-, Raum- oder Kfz-Kosten getrennt ausweisen musst, teile sie im Formular auf. Umsatzsteuer-Zahlungen an das Finanzamt erfasst du als Ausgabe der Kategorie „Umsatzsteuer an Finanzamt".</p>
                `, '<button class="btn btn-primary" data-action="close-modal">Verstanden</button>');
            });
        }

        // DATEV Export card
        if (typeof DatevExport !== 'undefined') DatevExport.initCard();

        const syncBtn = document.getElementById('euerSync');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => {
                const toSync = (Store.getRechInvoices ? Store.getRechInvoices() : []).filter(inv => {
                    if (inv.status !== 'bezahlt' || inv._storniert) return false;
                    if (inv.typ !== 'rechnung' && inv.typ !== 'gutschrift') return false;
                    const ids = new Set(Store.getSales(true).filter(s => s._invoiceId).map(s => s._invoiceId));
                    return !ids.has(inv.id);
                });
                toSync.forEach(inv => Store.createSaleFromInvoice(inv, inv.verkaufsplattform || '', null, null));
                if (typeof Utils.showToast === 'function') Utils.showToast(toSync.length + ' Rechnung(en) synchronisiert!', 'success');
                this._refresh();
            });
        }
    },

    _refresh() {
        const contentEl = document.getElementById('content');
        contentEl.innerHTML = this.render();
        this.init();
    }
};

// ── data-action-Registrierung (CSP: keine Inline-Handler) ──
if (window.Actions) Actions.register({
    'euer-hebesatz':  function (e, el) { Euer._updateHebesatz(el.value); },
    'euer-set-view':  function (view) { Euer._view = view; Euer._refresh(); },
    'euer-ao141-mitteilung': function () {
        const alt = Rechtsform.bilanzPflichtAb();
        const v = prompt('Ab welchem Wirtschaftsjahr bist du laut Mitteilung des Finanzamts buchführungspflichtig (§141 AO)?\nLeer lassen, wenn noch keine Mitteilung vorliegt.', alt || '');
        if (v === null) return;
        const y = parseInt(v, 10);
        if (v.trim() && (!y || y < 2000 || y > 2100)) { Utils.showToast('Bitte ein Jahr wie 2028 eingeben', 'warning'); return; }
        Rechtsform.setBilanzPflichtAb(v.trim() ? y : null);
        Euer._refresh();
    }
});
