// ============================================================
// DATEV Export — Buchungsstapel ASCII/CSV
// Format: DATEV Buchungsdatenservice (Buchungsstapel)
// SKR03 & SKR04 Konto-Mapping für EÜR-Daten
// ============================================================
var DatevExport = (function () {

    // ── SKR03 Konto-Mapping ─────────────────────────────────────────────
    // Am 2026-10-08 Konto fuer Konto gegen den DATEV-Kontenrahmen geprueft (Abschrift
    // steuerschroeder.de, Rechtsstand 30.06.2026). Bis dahin stand hier u. a. Bank auf 1800 —
    // in SKR03 ist das "Privatentnahmen allgemein", jede Zahlung landete also als Entnahme beim
    // Steuerberater. Porto stand auf 4230 (Heizung), Provisionen auf 4970 (Geldverkehr), die AfA
    // auf 4840 (ausserplanmaessig). Jede Nummer hier ist eine Behauptung ueber den Kontenrahmen:
    // vor dem Aendern dort nachschlagen, nicht hier abschreiben.
    var SKR03 = {
        // Erlöse
        erloese_19:     '8400',  // Erlöse 19 % USt
        erloese_7:      '8300',  // Erlöse 7 % USt
        erloese_0:      '8200',  // Erlöse (ohne Steuerautomatik) — 0 % ohne eigene Kennzahl
        erloese_klein:  '8195',  // Erlöse als Kleinunternehmer i.S.d. § 19 Abs. 1 UStG
        erloese_igl:    '8125',  // Steuerfreie innergemeinschaftliche Lieferungen § 4 Nr. 1b UStG
        erloese_ausfuhr:'8120',  // Steuerfreie Umsätze § 4 Nr. 1a UStG (Ausfuhr)
        erloese_rc_eu:  '8336',  // Erlöse aus im anderen EG-Land stpfl. sonstigen Leistungen, Empfänger schuldet die USt
        erloese_25a:    '8191',  // Umsatzerlöse nach §§ 25 und 25a UStG 19 % USt (die Marge)
        erloese_25a_0:  '8193',  // Umsatzerlöse nach §§ 25 und 25a UStG ohne USt (der Rest)
        // Wareneinkauf
        waren_19:       '3400',  // Wareneingang 19 % Vorsteuer
        waren_7:        '3300',  // Wareneingang 7 % Vorsteuer
        waren_0:        '3200',  // Wareneingang
        // Betriebsausgaben
        versand:        '4910',  // Porto
        plattform:      '4760',  // Verkaufsprovisionen
        fahrt:          '4673',  // Reisekosten Unternehmer, Fahrtkosten
        buero:          '4930',  // Bürobedarf
        verpackung:     '4710',  // Verpackungsmaterial
        sonstige:       '4900',  // Sonstige betriebliche Aufwendungen
        // AfA — Aufwand je Anlagenart, Gegenkonto ist das Anlagekonto (siehe ANLAGEN unten)
        afa:            '4830',  // Abschreibungen, Anlagevermögen (ohne AfA auf Kfz und Gebäude)
        afa_kfz:        '4832',  // Abschreibungen auf Kfz
        afa_immat:      '4822',  // Abschreibungen auf immaterielle Vermögensgegenstände
        afa_gwg:        '4855',  // Sofortabschreibung geringwertiger Wirtschaftsgüter
        // Bank / Kasse / Privat
        bank:           '1200',  // Bank
        kasse:          '1000',  // Kasse
        // Privateinlagen: Gegenkonto fuer Aufwand OHNE Zahlungsvorgang. Eine
        // Kilometerpauschale und ein Eigenbeleg sind Betriebsausgabe, aber es verlaesst kein
        // Geld das Geschaeftskonto — gegen 1800 gebucht stimmt beim Steuerberater der
        // Bankbestand nicht mehr.
        privat:         '1890',  // Privateinlagen (SKR03)
    };

    // ── SKR04 Konto-Mapping ─────────────────────────────────────────────
    // Gleiche Pruefung wie SKR03. Hier waren Wareneingang 19 % und 0 % vertauscht (5200 ist der
    // Wareneingang OHNE Vorsteuer, 5400 der mit 19 %) und Kasse stand auf 1000 — in SKR04 der
    // Bestand an Roh-, Hilfs- und Betriebsstoffen.
    var SKR04 = {
        erloese_19:     '4400',  // Erlöse 19 % USt
        erloese_7:      '4300',  // Erlöse 7 % USt
        erloese_0:      '4200',  // Erlöse
        erloese_klein:  '4185',  // Erlöse als Kleinunternehmer i.S.d. § 19 Abs. 1 UStG
        erloese_igl:    '4125',  // Steuerfreie innergemeinschaftliche Lieferungen § 4 Nr. 1b UStG
        erloese_ausfuhr:'4120',  // Steuerfreie Umsätze § 4 Nr. 1a UStG
        erloese_rc_eu:  '4336',  // wie 8336
        erloese_25a:    '4136',  // Umsatzerlöse nach §§ 25 und 25a UStG 19 % USt
        erloese_25a_0:  '4138',  // Umsatzerlöse nach §§ 25 und 25a UStG ohne USt
        waren_19:       '5400',  // Wareneingang 19 % Vorsteuer
        waren_7:        '5300',  // Wareneingang 7 % Vorsteuer
        waren_0:        '5200',  // Wareneingang
        versand:        '6800',  // Porto
        plattform:      '6770',  // Verkaufsprovisionen
        fahrt:          '6673',  // Reisekosten Unternehmer, Fahrtkosten
        buero:          '6815',  // Bürobedarf
        verpackung:     '6710',  // Verpackungsmaterial
        sonstige:       '6300',  // Sonstige betriebliche Aufwendungen
        afa:            '6220',  // Abschreibungen, Anlagevermögen (ohne AfA auf Kfz und Gebäude)
        afa_kfz:        '6222',  // Abschreibungen auf Kfz
        afa_immat:      '6200',  // Abschreibungen auf immaterielle Vermögensgegenstände
        afa_gwg:        '6260',  // Sofortabschreibungen geringwertiger Wirtschaftsgüter
        bank:           '1800',  // Bank
        kasse:          '1600',  // Kasse
        privat:         '2180',  // Privateinlagen (SKR04)
    };

    // ── Anlagenart → Anlagekonto und AfA-Aufwandskonto ──────────────────
    // Entscheidung User 2026-10-08: AfA wird je Anlage gegen ihr eigenes Anlagekonto gebucht.
    // Die Art waehlt der Nutzer im Anlagenverzeichnis (js/afa.js, Feld `anlagenart`); eine
    // Anlage ohne Angabe — alles vor diesem Tag — gilt als sonstige Betriebs- und
    // Geschaeftsausstattung. GWG ergibt sich aus der Methode 'sofort', nicht aus der Art.
    var ANLAGEN = {
        SKR03: { software: '0027', pkw: '0320', buero: '0420', bga: '0490', gwg: '0480' },
        SKR04: { software: '0135', pkw: '0520', buero: '0650', bga: '0690', gwg: '0670' },
    };
    function anlageKonten(anlage, skr) {
        var accounts = skr === 'SKR04' ? SKR04 : SKR03;
        var anl = ANLAGEN[skr === 'SKR04' ? 'SKR04' : 'SKR03'];
        if (anlage.methode === 'sofort') return { anlage: anl.gwg, afa: accounts.afa_gwg };
        var art = anl[anlage.anlagenart] ? anlage.anlagenart : 'bga';
        var afa = art === 'pkw' ? accounts.afa_kfz : art === 'software' ? accounts.afa_immat : accounts.afa;
        return { anlage: anl[art], afa: afa };
    }

    // ── Kategorie → SKR-Konto (auch für Finanzen-Modul-Anzeige nutzbar) ──
    // Die Kategorien stehen in js/ausgaben.js (_kategorien). "Verpackung" fiel bis 2026-10-08
    // auf "sonstige", weil nur nach "material" gesucht wurde — diese Kategorie gibt es nicht.
    function kontoForKategorie(kategorie, skr) {
        var accounts = skr === 'SKR04' ? SKR04 : SKR03;
        var cat = (kategorie || '').toLowerCase();
        if (cat.indexOf('versand') > -1 || cat.indexOf('porto') > -1) return accounts.versand;
        if (cat.indexOf('plattform') > -1 || cat.indexOf('provision') > -1) return accounts.plattform;
        if (cat.indexOf('fahrt') > -1 || cat.indexOf('reise') > -1) return accounts.fahrt;
        if (cat.indexOf('verpackung') > -1 || cat.indexOf('material') > -1) return accounts.verpackung;
        if (cat.indexOf('büro') > -1) return accounts.buero;
        if (cat.indexOf('afa') > -1 || cat.indexOf('abschreibung') > -1) return accounts.afa;
        return accounts.sonstige;
    }

    // ── CSV helpers ─────────────────────────────────────────────────────
    // Das Quoting der Textfelder sitzt seit 2026-09-18 in buildCSV (txt/beleg), weil DATEV
    // ALLE Textfelder in Anfuehrungszeichen verlangt, nicht nur die mit Sonderzeichen.
    // Unveraendert gilt: KEIN Utils.escapeHtml auf Buchungstexten. Eine CSV ist kein HTML —
    // escapeHtml machte aus der Firma "Reck & Schwarz" ein "Reck &amp; Schwarz", und genau
    // so stand es dann beim Steuerberater im Stapel.

    // Betrag: DATEV uses comma as decimal separator, no thousands separator
    function amtDe(n) {
        // `|| 0` ausserhalb von parseFloat, sonst steht "NaN" in der Umsatzspalte des Stapels
        return (parseFloat(n) || 0).toFixed(2).replace('.', ',');
    }

    // Date: TT.MM → DATEV date format for Belegdatum
    function datevDate(isoDate) {
        if (!isoDate) return '';
        var parts = isoDate.split('-');
        if (parts.length < 3) return isoDate;
        return parts[2] + parts[1]; // TTMM — no year (year is in header)
    }

    /**
     * Build DATEV Buchungsstapel CSV
     * @param {string} year  – e.g. '2025'
     * @param {string} skr   – 'SKR03' or 'SKR04'
     * @param {string} gkOhneZahlung – Gegenkonto für Aufwand ohne Zahlungsvorgang
     *        ('privat' | 'bank' | 'kasse'). Vorgabe 'privat', siehe renderCard().
     * @returns {string}     DATEV ASCII CSV with ANSI encoding hint
     */
    function buildCSV(year, skr, gkOhneZahlung) {
        var accounts  = skr === 'SKR04' ? SKR04 : SKR03;
        // Unbekannter Wert faellt auf 'privat' zurueck, nicht auf 'bank': Ein falsches
        // Privatkonto ist beim Steuerberater eine Umbuchung, ein falscher Bankbestand eine Suche.
        var gegenkontoOhneZahlung = accounts[gkOhneZahlung] || accounts.privat;
        var settings  = Store.getSettings ? Store.getSettings() : {};
        var isKlein   = settings.ustMode === 'klein';
        var isSoll    = (settings.ustVersteuerungsart || 'soll') !== 'ist';

        var vonDate = year + '-01-01';
        var bisDate = year + '-12-31';

        // ── collect source data ──────────────────────────────────────────
        var purchases = (Store.getAllPurchasesRaw ? Store.getAllPurchasesRaw() : Store.getPurchases ? Store.getPurchases() : [])
            .filter(function (p) { return !p.storniert && p.datum >= vonDate && p.datum <= bisDate; });

        var sales = (Store.getAllSalesRaw ? Store.getAllSalesRaw() : Store.getSales ? Store.getSales() : [])
            .filter(function (s) { return !s.storniert && s.datum >= vonDate && s.datum <= bisDate; });

        var expenses = (Store.getAllExpensesRaw ? Store.getAllExpensesRaw() : Store.getExpenses ? Store.getExpenses() : [])
            .filter(function (e) { return !e.storniert && e.datum >= vonDate && e.datum <= bisDate; });

        // Buchungsdatum: bei Soll-Versteuerung Rechnungsdatum (unabhängig von Zahlung),
        // bei Ist-Versteuerung Zahlungsdatum (nur bezahlte Rechnungen) — muss zu UVA passen
        var invKeyDate = function (i) { return isSoll ? i.datum : (i.bezahltAm || i.datum); };
        var invoices = (Store.getRechInvoices ? Store.getRechInvoices() : [])
            .filter(function (i) {
                if (i.typ !== 'rechnung' && i.typ !== 'gutschrift') return false;
                if (isSoll ? (i.status !== 'versendet' && i.status !== 'bezahlt') : i.status !== 'bezahlt') return false;
                var d = invKeyDate(i);
                return (d || '') >= vonDate && (d || '') <= bisDate;
            });

        // ── Buchungszeilen ───────────────────────────────────────────────
        var rows = [];

        // ── Gemeinsame Zuordnung fuer Rechnungen, Direktverkaeufe und Retouren ───
        // Entscheidung User 2026-10-08: gebucht wird je Position nach Art, nicht mehr je Rechnung
        // auf das Konto des hoechsten Satzes. Bis dahin landete eine Rechnung mit 19 %- und
        // 7 %-Positionen komplett auf 8400, und jeder Direktverkauf — auch §25a — auf dem
        // 19 %-Konto. Die Unterscheidungen sind dieselben wie in js/ustvoranmeldung.js
        // (_calcPeriode); weicht eine ab, nennen Voranmeldung und Stapel verschiedene Zahlen.
        var euLaender = (typeof Vorsteuer !== 'undefined' && Vorsteuer.EU_LAENDER) || [];
        var kontoFuerSatz = function (satz) {
            return satz === 19 ? accounts.erloese_19 : satz === 7 ? accounts.erloese_7 : accounts.erloese_0;
        };
        // §25a: die Marge (USt darin) auf das 19 %-Konto, der Rest ohne USt. Negative Marge = 0
        // (Einzeldifferenz, §25a Abs. 3 UStG). Satz 19 fest wie in der Voranmeldung.
        var pauschalSatz = (typeof SteuerBerechnung !== 'undefined' && SteuerBerechnung.pauschalmargeSatz)
            ? SteuerBerechnung.pauschalmargeSatz(parseInt(year, 10)) : null;
        var teile25a = function (vk, ek, pauschal) {
            var marge = (pauschal && pauschalSatz != null) ? vk * pauschalSatz : vk - ek;
            marge = Math.min(Math.max(0, marge), Math.max(0, vk));
            return [[accounts.erloese_25a, marge], [accounts.erloese_25a_0, vk - marge]];
        };
        var purchById = {};
        (Store.getAllPurchasesRaw ? Store.getAllPurchasesRaw() : Store.getPurchases ? Store.getPurchases(true) : [])
            .forEach(function (p) { purchById[p.id] = p; });
        var verknuepft = function (s) {
            var ids = (s.purchaseIds && s.purchaseIds.length) ? s.purchaseIds : (s.purchaseId ? [s.purchaseId] : []);
            return ids.map(function (id) { return purchById[id]; }).filter(Boolean);
        };
        var ist25aVerkauf = function (s) { return verknuepft(s).some(function (p) { return p.differenzbesteuert; }); };
        var ekSumme = function (s) { return verknuepft(s).reduce(function (a, p) { return a + (parseFloat(p.einkaufspreis) || 0); }, 0); };
        var istPauschal = function (p) { return !!(p && p.pauschalmarge && p.warenart === 'kunst'); };
        var verkaufPauschal = function (s) { var ps = verknuepft(s); return ps.length === 1 && istPauschal(ps[0]); };
        var verkaufBrutto = function (s) { return (parseFloat(s.verkaufspreis) || 0) + (parseFloat(s.versandkostenKaeufer) || 0); };
        // Satz eines Direktverkaufs: wie _rate/_perRateGroups in der Voranmeldung
        var verkaufSaetze = function (s) {
            if (s.steuersaetze && Object.keys(s.steuersaetze).length) {
                return Object.keys(s.steuersaetze).map(function (k) { return [parseFloat(k), s.steuersaetze[k]]; });
            }
            var r = parseFloat(s.steuersatz);
            return [[isNaN(r) ? 19 : r, verkaufBrutto(s)]];
        };
        // Eine Buchungszeile je Konto: Teilbetraege desselben Belegs werden zusammengefasst.
        var sammler = function () {
            var summe = {}, folge = [];
            return {
                add: function (konto, betrag) {
                    if (!(konto in summe)) { summe[konto] = 0; folge.push(konto); }
                    summe[konto] += betrag;
                },
                zeilen: function (basis) {
                    return folge.map(function (k) { return Object.assign({ konto: k, umsatz: summe[k] }, basis); });
                },
            };
        };

        // Verkäufe (Einnahmen) aus Rechnungen
        var customers = Store.getRechCustomers ? Store.getRechCustomers() : [];
        invoices.forEach(function (inv) {
            var invKlein = inv.isKlein !== undefined ? inv.isKlein : isKlein;
            var kunde = customers.find(function (c) { return c.id === inv.kundeId; });
            var kundeName = kunde ? (kunde.firma || kunde.ansprechpartner || '') : '';
            var land = kunde && kunde.land;
            var istIg = !!(land && land !== 'DE' && euLaender.indexOf(land) !== -1 && kunde.ustIdNr);
            // Ohne EU-Liste ist "Drittland" nicht entscheidbar — dann lieber 8200 als eine
            // falsche Ausfuhr.
            var istAusfuhr = !!(land && land !== 'DE' && euLaender.length && euLaender.indexOf(land) === -1);
            var konten = sammler();
            (inv.positionen || []).forEach(function (pos) {
                // menge wie auf der Rechnung selbst: leer/0 = 0 (kein ||1-Phantomumsatz)
                // `|| 0` gehoert AUSSERHALB von parseFloat — sonst wird ein nicht-numerischer
                // Einzelpreis zu NaN und die Buchungszeile unbrauchbar. Dasselbe Muster stand
                // an mehreren Stellen im Projekt; test/test-parsefloat-klammer.js haelt sie
                // alle fest und nennt die Zahl, damit sie hier nicht veraltet.
                var ln = (parseFloat(pos.menge) || 0) * (parseFloat(pos.einzelpreis) || 0);
                if (invKlein) { konten.add(accounts.erloese_klein, ln); return; }
                if (pos.differenzbesteuert) {
                    var lp = pos.lagerArtikelId ? purchById[pos.lagerArtikelId] : null;
                    var ek = lp ? (parseFloat(lp.einkaufspreis) || 0) : (parseFloat(pos.einkaufspreis) || 0);
                    teile25a(ln, ek, istPauschal(lp)).forEach(function (t) { konten.add(t[0], t[1]); });
                    return;
                }
                var rate = parseInt(pos.mwstSatz);
                if (rate === 19 || isNaN(rate)) konten.add(accounts.erloese_19, ln * 1.19);
                else if (rate === 7)            konten.add(accounts.erloese_7, ln * 1.07);
                else if (rate === 0 && istIg)   konten.add((pos.igArt || inv.igArt || 'ware') === 'leistung' ? accounts.erloese_rc_eu : accounts.erloese_igl, ln);
                else if (rate === 0 && istAusfuhr) konten.add(accounts.erloese_ausfuhr, ln);
                // Uebrige Saetze (0 % im Inland, OSS-Saetze anderer Laender): Sammelkonto ohne
                // Steuerautomatik, brutto. Kein BU-Schluessel 40 mehr — der hebt die Automatik
                // eines Kontos auf, und 8200/4200 hat keine.
                else konten.add(accounts.erloese_0, ln * (1 + (rate > 0 ? rate / 100 : 0)));
            });

            // Gutschrift (Kreditnote) mindert den Umsatz (§17 UStG) → Buchung gegenläufig zur
            // normalen Rechnung (Soll statt Haben auf dem Erlöskonto), Betrag bleibt absolut.
            var isGutschrift = inv.typ === 'gutschrift';
            konten.zeilen({
                sh:           isGutschrift ? 'S' : 'H',
                gegenkonto:   accounts.bank,
                datum:        invKeyDate(inv),
                belegfeld1:   inv.nummer || '',
                buchungstext: ((isGutschrift ? 'Gutschrift ' : 'Rechnung ') + (inv.nummer || '') + (kundeName ? ' ' + kundeName : '')).slice(0, 60),
                buSchluessel: '',
            }).forEach(function (z) { rows.push(z); });
        });

        // Direktverkäufe (Marktplatz) — immer exportieren, aber Sales aus bezahlten Rechnungen
        // (_invoiceId) ausschließen: die sind oben schon als Rechnungszeile gebucht. Der frühere
        // Guard `invoices.length === 0` verschluckte sonst ALLE Direktverkäufe, sobald im Jahr
        // eine einzige Rechnung existierte.
        sales.filter(function (s) { return !s._invoiceId; }).forEach(function (s) {
            // Käufer-Versand zählt zur Einnahme (konsistent zu UVA/EÜR)
            var konten = sammler();
            if (isKlein) konten.add(accounts.erloese_klein, verkaufBrutto(s));
            else if (ist25aVerkauf(s)) teile25a(verkaufBrutto(s), ekSumme(s), verkaufPauschal(s)).forEach(function (t) { konten.add(t[0], t[1]); });
            else verkaufSaetze(s).forEach(function (g) { konten.add(kontoFuerSatz(g[0]), g[1]); });
            konten.zeilen({
                sh:           'H',
                gegenkonto:   accounts.bank,
                datum:        s.datum,
                belegfeld1:   s.id ? s.id.slice(0, 12) : '',
                buchungstext: ('Verkauf ' + (s.plattform || '') + ' ' + ((s.marke || '') + ' ' + (s.artikeltyp || ''))).slice(0, 60),
                buSchluessel: '',
            }).forEach(function (z) { rows.push(z); });
        });

        // ── Retouren ────────────────────────────────────────────────────
        // Entscheidung User 2026-10-08: Gegenbuchung auf dem Erloeskonto (Soll), kein eigenes
        // Konto "Erloesschmaelerungen". Das Konto folgt dem verknuepften Verkauf: sein Satz, bei
        // §25a anteilig Marge/Rest wie die Korrektur in js/ustvoranmeldung.js. Ohne Verknuepfung
        // gilt 19 % — derselbe Rueckfall wie in der Voranmeldung.
        // Filter zeichengleich mit js/euer.js: Ist der verknuepfte Verkauf storniert, steht er
        // gar nicht im Stapel, und die Erstattung abzuziehen waere ein Doppelabzug.
        var salesById = {};
        (Store.getAllSalesRaw ? Store.getAllSalesRaw() : Store.getSales ? Store.getSales(true) : [])
            .forEach(function (s) { salesById[s.id] = s; });
        (Store.getRetouren ? Store.getRetouren() : [])
            .filter(function (r) {
                var vk = r.saleId ? salesById[r.saleId] : null;
                return r.datum >= vonDate && r.datum <= bisDate && !(vk && vk.storniert);
            })
            .forEach(function (r) {
                var betrag = parseFloat(r.erstattungBetrag) || 0;
                if (betrag <= 0) return;
                var vk = r.saleId ? salesById[r.saleId] : null;
                var konten = sammler();
                if (isKlein) konten.add(accounts.erloese_klein, betrag);
                else if (vk && ist25aVerkauf(vk)) {
                    var vkPreis = parseFloat(vk.verkaufspreis) || 0;
                    var anteil = vkPreis !== 0 ? Math.min(1, betrag / Math.abs(vkPreis)) : 0;
                    var margeAnteil = teile25a(vkPreis, ekSumme(vk), verkaufPauschal(vk))[0][1] * anteil;
                    konten.add(accounts.erloese_25a, margeAnteil);
                    konten.add(accounts.erloese_25a_0, betrag - margeAnteil);
                } else {
                    // Gemischter Satz: der Satz mit dem groessten Anteil, wie _rate() dort
                    var saetze = vk ? verkaufSaetze(vk) : [[19, betrag]];
                    var dominant = saetze.reduce(function (a, b) { return Math.abs(b[1]) > Math.abs(a[1]) ? b : a; });
                    konten.add(kontoFuerSatz(dominant[0]), betrag);
                }
                konten.zeilen({
                    sh:           'S',              // mindert den Erloes: gegenlaeufig zum Verkauf
                    gegenkonto:   accounts.bank,
                    datum:        r.datum,
                    belegfeld1:   r.nummer || String(r.id || '').slice(0, 12),
                    buchungstext: ('Retoure ' + (r.nummer || '') + ' ' + ((r.marke || '') + ' ' + (r.artikeltyp || ''))).slice(0, 60),
                    buSchluessel: '',
                }).forEach(function (z) { rows.push(z); });
            });

        // Wareneinkäufe
        purchases.forEach(function (p) {
            // Menge mitrechnen — wie ueberall sonst im Haus: js/euer.js:104, js/statistiken.js
            // und js/lager.js bilden durchgehend einkaufspreis * (anzahl || 1). Ohne den Faktor
            // meldet der Stapel bei einem Sammel-Einkauf von 10 Stueck ein Zehntel der Ausgabe,
            // und der Steuerberater bucht zu wenig Betriebsausgabe.
            var ek = (parseFloat(p.einkaufspreis) || 0) * (parseInt(p.anzahl) || 1);
            if (ek <= 0) return;
            var ustSatz = parseInt(p.ustSatz != null ? p.ustSatz : 19);
            var warenKonto;
            if (ustSatz === 19)      warenKonto = accounts.waren_19;
            else if (ustSatz === 7)  warenKonto = accounts.waren_7;
            else                     warenKonto = accounts.waren_0;
            rows.push({
                umsatz:       ek,
                sh:           'S',              // Soll = Ausgabe
                konto:        warenKonto,
                gegenkonto:   accounts.bank,
                datum:        p.datum,
                belegfeld1:   p.artikelNr || p.id.slice(0, 12),
                buchungstext: ('EK ' + ((p.marke || '') + ' ' + (p.artikeltyp || ''))).slice(0, 60),
                // Kein BU-Schluessel 40: 3200/5200 haben keine Steuerautomatik, die er aufheben koennte.
                buSchluessel: '',
            });
        });

        // Sonstige Ausgaben
        expenses.forEach(function (e) {
            var betrag = parseFloat(e.betrag) || 0;
            if (betrag <= 0) return;
            var konto = kontoForKategorie(e.kategorie, skr);
            // Vorsteuer: die Aufwandskonten haben keine Steuerautomatik, ohne BU-Schluessel kam
            // beim Steuerberater bis 2026-10-08 keine einzige Vorsteuer aus Betriebsausgaben an.
            // 9 = Vorsteuer 19 %, 8 = Vorsteuer 7 % (DATEV-Steuerschluessel). Regeln wie
            // Vorsteuer._expenseUstRaw: 'unklar' nie als 19 % raten, 'rc' laeuft ueber die
            // eigenen §13b-Eintraege, Kleinunternehmer haben keinen Vorsteuerabzug.
            var satz = (e.ustSatz != null && e.ustSatz !== '') ? e.ustSatz
                     : (e.steuersatz != null && e.steuersatz !== '') ? e.steuersatz : 'unklar';
            var bu = isKlein ? '' : parseFloat(satz) === 19 ? '9' : parseFloat(satz) === 7 ? '8' : '';
            rows.push({
                umsatz:       betrag,
                sh:           'S',
                konto:        konto,
                gegenkonto:   accounts.bank,
                datum:        e.datum,
                // Feldnamen am 2026-09-21 gegen js/ausgaben.js gemessen: die Ausgabe
                // speichert `belegNr` und `beschreibung`. Hier standen `belegnummer` und
                // `bezeichnung` — beide gibt es am Datensatz nicht. Folge: In Belegfeld 1
                // landete bei JEDER Betriebsausgabe eine abgeschnittene interne ID statt der
                // Belegnummer, die der Nutzer eingetippt hat, und als Buchungstext stand die
                // Kategorie statt der Beschreibung. Beides faellt in der App nicht auf,
                // sondern erst beim Steuerberater — und dort beim Zuordnen der Belege.
                belegfeld1:   e.belegNr || e.id.slice(0, 12),
                buchungstext: String(e.beschreibung || e.kategorie || 'Ausgabe').slice(0, 60),
                buSchluessel: bu,
            });
        });

        // ── Fahrtkosten aus dem Fahrtenbuch ─────────────────────────────
        // Bis 2026-09-17 fehlten die drei folgenden Quellen im Stapel: Der Steuerberater sah
        // weniger Betriebsausgaben, als die EUeR des Nutzers auswies. Die Filter sind bewusst
        // ZEICHENGLEICH mit js/euer.js _berechne — weicht einer davon ab, nennen EUeR und
        // Stapel verschiedene Zahlen, und das faellt erst beim Abstimmen in der Kanzlei auf.
        //
        // `!f.storniert`: Store.getFahrten() filtert Stornos nicht selbst (die Fahrtenliste
        // zeigt sie GoBD-konform durchgestrichen). Genau diese Pruefung fehlte bis 2026-09-16
        // in der EUeR selbst — siehe 19b5606.
        (Store.getFahrten ? Store.getFahrten() : [])
            .filter(function (f) { return !f.storniert && f.datum >= vonDate && f.datum <= bisDate; })
            .forEach(function (f) {
                var betrag = parseFloat(f.kosten) || 0;
                if (betrag <= 0) return;                      // Fahrrad/zu Fuss: 0 EUR, keine Buchung
                rows.push({
                    umsatz:       betrag,
                    sh:           'S',
                    konto:        accounts.fahrt,
                    gegenkonto:   gegenkontoOhneZahlung,
                    datum:        f.datum,
                    belegfeld1:   f.nummer || String(f.id || '').slice(0, 12),
                    buchungstext: ('Fahrt ' + (f.von || '') + ' - ' + (f.nach || '')).slice(0, 60),
                    buSchluessel: '',                         // Pauschale: keine Vorsteuer
                });
            });

        // ── Material-Einkaeufe (Verpackung) ─────────────────────────────
        // `!e.ausgabeId && e.lieferant !== 'Ausgabe'` ist der wichtige Teil: Material, das schon
        // als Ausgabe erfasst wurde, steckt bereits oben in expenses. Ohne diesen Filter stuende
        // es zweimal im Stapel. Dieselbe Bedingung steht in js/euer.js.
        //
        // Der VERBRAUCH gehoert ausdruecklich NICHT hierher — die EUeR zieht den Einkauf ab
        // (§11 Abs. 2 EStG, Abflussprinzip). Beides zu buchen waere ein Doppelabzug.
        (Store.getMaterialEinkauefe ? Store.getMaterialEinkauefe() : [])
            .filter(function (e) {
                return !e.ausgabeId && e.lieferant !== 'Ausgabe' && e.datum >= vonDate && e.datum <= bisDate;
            })
            .forEach(function (e) {
                var betrag = parseFloat(e.gesamtkosten) || 0;
                if (betrag <= 0) return;
                rows.push({
                    umsatz:       betrag,
                    sh:           'S',
                    konto:        accounts.verpackung,
                    gegenkonto:   accounts.bank,              // echte Zahlung, anders als die Pauschale
                    datum:        e.datum,
                    belegfeld1:   String(e.id || '').slice(0, 12),
                    buchungstext: ('Material ' + (e.materialName || '') + ' ' + (e.lieferant || '')).slice(0, 60),
                    buSchluessel: '',
                });
            });

        // ── Eigenbelege ─────────────────────────────────────────────────
        // Company-praefixierter Schluessel, nie ungepraefixt lesen. Gleiche Herleitung wie in
        // js/euer.js; es gibt dafuer keinen Store-Getter.
        var eigenbelege = (function () {
            try {
                var co = localStorage.getItem('oyi_active_company') || '';
                var k  = (co ? co + '__' : '') + 'eigenbelege_belege';
                return (Store._syncReadRaw ? Store._syncReadRaw(k) : JSON.parse(localStorage.getItem(k) || '[]')) || [];
            } catch (e) { return []; }
        })();
        eigenbelege
            .filter(function (b) {
                return !b.storniert && b.belegDatum && b.belegDatum >= vonDate && b.belegDatum <= bisDate;
            })
            .forEach(function (b) {
                // Betragswahl wie in der EUeR: netto, sonst brutto.
                var betrag = parseFloat(b.betragNetto) || parseFloat(b.betragBrutto) || 0;
                if (betrag <= 0) return;
                rows.push({
                    umsatz:       betrag,
                    sh:           'S',
                    konto:        kontoForKategorie(b.kategorie, skr),
                    gegenkonto:   gegenkontoOhneZahlung,
                    datum:        b.belegDatum,
                    belegfeld1:   b.belegNr || String(b.id || '').slice(0, 12),
                    buchungstext: ('Eigenbeleg ' + (b.bezeichnung || b.kategorie || '')).slice(0, 60),
                    // Ein Eigenbeleg begruendet grundsaetzlich KEINEN Vorsteuerabzug
                    // (§15 Abs. 1 UStG verlangt eine Rechnung eines Dritten) — kein BU-Schluessel.
                    buSchluessel: '',
                });
            });

        // ── Anlagen: Zugang im Kaufjahr, AfA in jedem Jahr ─────────────
        // Entscheidung User 2026-10-08: AfA gegen das Anlagekonto der einzelnen Anlage, dazu im
        // Kaufjahr der Zugang (Anlagekonto an Bank) — ohne ihn liefe das Anlagekonto beim
        // Steuerberater ins Minus. Betrag der AfA aus derselben Funktion wie in der EUeR
        // (Afa._calcJahresAfa), Stornos fallen weg wie dort.
        (Store.getAfaAnlagen ? Store.getAfaAnlagen() : [])
            .filter(function (a) { return !a.storniert; })
            .forEach(function (a) {
                var k = anlageKonten(a, skr);
                var bez = String(a.bezeichnung || 'Anlage');
                var beleg = String(a.id || '').slice(0, 12);
                var ak = parseFloat(a.anschaffungskosten) || 0;
                var kauf = a.anschaffungsdatum || '';
                if (ak > 0 && kauf >= vonDate && kauf <= bisDate) {
                    rows.push({
                        umsatz: ak, sh: 'S', konto: k.anlage, gegenkonto: accounts.bank,
                        datum: kauf, belegfeld1: beleg,
                        buchungstext: ('Zugang ' + bez).slice(0, 60), buSchluessel: '',
                    });
                }
                var afa = (typeof Afa !== 'undefined' && Afa._calcJahresAfa) ? Afa._calcJahresAfa(a, parseInt(year, 10)) : 0;
                if (afa > 0) {
                    rows.push({
                        umsatz: afa, sh: 'S', konto: k.afa, gegenkonto: k.anlage,
                        datum: bisDate, belegfeld1: beleg,
                        buchungstext: ('AfA ' + bez).slice(0, 60), buSchluessel: '',
                    });
                }
            });

        // Sort by date
        rows.sort(function (a, b) { return (a.datum || '').localeCompare(b.datum || ''); });

        // ── Aufbau nach der offiziellen DATEV-Formatbeschreibung ──────────
        // Quelle: developer.datev.de, DATEV-Format > Header / Buchungsstapel / Einstieg
        // (Musterdatei), abgerufen 2026-09-18. Bis dahin: Formatversion 12, 96 statt 125
        // Spalten (es fehlten 10 der 20 Zusatzinformations-Paare und die Felder 117-125),
        // ein 26- statt 31-Felder-Header mit Datumsangaben im falschen Format und Textfelder
        // ohne Anfuehrungszeichen. Die befuellten Werte standen an den richtigen Positionen —
        // falsch war die Huelle, und an der scheitert der Import.
        var beraternr   = '00000';   // Platzhalter — die Kanzlei traegt ihre Beraternummer ein
        var mandantennr = '00001';   // Platzhalter
        var wjBeginn    = year + '0101';
        var sachkontenlaenge = '4';

        var now = new Date();
        var pad = function (n, l) { return String(n).padStart(l || 2, '0'); };
        // Feld 6 "Erzeugt am": YYYYMMDDHHMMSSFFF
        var erzeugtAm = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
                        pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds()) +
                        pad(now.getMilliseconds(), 3);
        var ymd = function (iso) { return String(iso || '').replace(/-/g, ''); };  // YYYYMMDD, ohne Quotes

        // Header: genau 31 Felder, Reihenfolge und Quoting wie in der Beschreibung.
        var header1 = [
            '"EXTF"',                                 //  1 Kennzeichen (Export aus Drittanwendung)
            '700',                                    //  2 Versionsnummer des Headers
            '21',                                     //  3 Formatkategorie Buchungsstapel
            '"Buchungsstapel"',                       //  4 Formatname
            '13',                                     //  5 Formatversion (Buchungsstapel)
            erzeugtAm,                                //  6 Erzeugt am
            '',                                       //  7 Importiert (Leerfeld)
            '"RE"',                                   //  8 Herkunft
            '""',                                     //  9 Exportiert von
            '""',                                     // 10 Importiert von
            beraternr,                                // 11 Beraternummer
            mandantennr,                              // 12 Mandantennummer
            wjBeginn,                                 // 13 WJ-Beginn YYYYMMDD
            sachkontenlaenge,                         // 14 Sachkontenlaenge
            ymd(vonDate),                             // 15 Datum von
            ymd(bisDate),                             // 16 Datum bis
            '"Stackr Export ' + year + '"',           // 17 Bezeichnung (max. 30)
            '""',                                     // 18 Diktatkuerzel
            '1',                                      // 19 Buchungstyp: Finanzbuchfuehrung
            '0',                                      // 20 Rechnungslegungszweck: unabhaengig
            // 21 Festschreibung: 0 = keine. Bewusst — der Stapel ist ein Vorschlag an die
            // Kanzlei, nicht die Endfassung. Default waere 1 (festgeschrieben).
            '0',
            '"EUR"',                                  // 22 WKZ
            '',                                       // 23 reserviert
            '""',                                     // 24 Derivatskennzeichen
            '',                                       // 25 reserviert
            '',                                       // 26 reserviert
            '"' + (skr === 'SKR04' ? '04' : '03') + '"', // 27 Sachkontenrahmen
            '',                                       // 28 ID der Branchenloesung
            '',                                       // 29 reserviert
            '""',                                     // 30 reserviert
            '"Stackr"'                                // 31 Anwendungsinformation (max. 16)
        ].join(';');

        // Zeile 2: die 125 Spaltenueberschriften, wortgleich aus der offiziellen Musterdatei
        // (inklusive der dortigen Schreibweise "Zusatzinformation- Inhalt"). Diese Liste ist die
        // EINZIGE Quelle fuer die Spaltenbreite: die Datenzeilen leiten ihre Feldzahl daraus ab.
        // Nie eine Zahl hart hinschreiben — genau so waren Kopf und Zeilen am 2026-09-13 schon
        // einmal 20 Felder auseinander.
        var SPALTEN = [
            'Umsatz (ohne Soll/Haben-Kz)',
            'Soll/Haben-Kennzeichen',
            'WKZ Umsatz',
            'Kurs',
            'Basis-Umsatz',
            'WKZ Basis-Umsatz',
            'Konto',
            'Gegenkonto (ohne BU-Schlüssel)',
            'BU-Schlüssel',
            'Belegdatum',
            'Belegfeld 1',
            'Belegfeld 2',
            'Skonto',
            'Buchungstext',
            'Postensperre',
            'Diverse Adressnummer',
            'Geschäftspartnerbank',
            'Sachverhalt',
            'Zinssperre',
            'Beleglink',
            'Beleginfo - Art 1',
            'Beleginfo - Inhalt 1',
            'Beleginfo - Art 2',
            'Beleginfo - Inhalt 2',
            'Beleginfo - Art 3',
            'Beleginfo - Inhalt 3',
            'Beleginfo - Art 4',
            'Beleginfo - Inhalt 4',
            'Beleginfo - Art 5',
            'Beleginfo - Inhalt 5',
            'Beleginfo - Art 6',
            'Beleginfo - Inhalt 6',
            'Beleginfo - Art 7',
            'Beleginfo - Inhalt 7',
            'Beleginfo - Art 8',
            'Beleginfo - Inhalt 8',
            'KOST1 - Kostenstelle',
            'KOST2 - Kostenstelle',
            'Kost-Menge',
            'EU-Land u. UStID (Bestimmung)',
            'EU-Steuersatz (Bestimmung)',
            'Abw. Versteuerungsart',
            'Sachverhalt L+L',
            'Funktionsergänzung L+L',
            'BU 49 Hauptfunktionstyp',
            'BU 49 Hauptfunktionsnummer',
            'BU 49 Funktionsergänzung',
            'Zusatzinformation - Art 1',
            'Zusatzinformation- Inhalt 1',
            'Zusatzinformation - Art 2',
            'Zusatzinformation- Inhalt 2',
            'Zusatzinformation - Art 3',
            'Zusatzinformation- Inhalt 3',
            'Zusatzinformation - Art 4',
            'Zusatzinformation- Inhalt 4',
            'Zusatzinformation - Art 5',
            'Zusatzinformation- Inhalt 5',
            'Zusatzinformation - Art 6',
            'Zusatzinformation- Inhalt 6',
            'Zusatzinformation - Art 7',
            'Zusatzinformation- Inhalt 7',
            'Zusatzinformation - Art 8',
            'Zusatzinformation- Inhalt 8',
            'Zusatzinformation - Art 9',
            'Zusatzinformation- Inhalt 9',
            'Zusatzinformation - Art 10',
            'Zusatzinformation- Inhalt 10',
            'Zusatzinformation - Art 11',
            'Zusatzinformation- Inhalt 11',
            'Zusatzinformation - Art 12',
            'Zusatzinformation- Inhalt 12',
            'Zusatzinformation - Art 13',
            'Zusatzinformation- Inhalt 13',
            'Zusatzinformation - Art 14',
            'Zusatzinformation- Inhalt 14',
            'Zusatzinformation - Art 15',
            'Zusatzinformation- Inhalt 15',
            'Zusatzinformation - Art 16',
            'Zusatzinformation- Inhalt 16',
            'Zusatzinformation - Art 17',
            'Zusatzinformation- Inhalt 17',
            'Zusatzinformation - Art 18',
            'Zusatzinformation- Inhalt 18',
            'Zusatzinformation - Art 19',
            'Zusatzinformation- Inhalt 19',
            'Zusatzinformation - Art 20',
            'Zusatzinformation- Inhalt 20',
            'Stück',
            'Gewicht',
            'Zahlweise',
            'Forderungsart',
            'Veranlagungsjahr',
            'Zugeordnete Fälligkeit',
            'Skontotyp',
            'Auftragsnummer',
            'Buchungstyp',
            'USt-Schlüssel (Anzahlungen)',
            'EU-Land (Anzahlungen)',
            'Sachverhalt L+L (Anzahlungen)',
            'EU-Steuersatz (Anzahlungen)',
            'Erlöskonto (Anzahlungen)',
            'Herkunft-Kz',
            'Buchungs GUID',
            'KOST-Datum',
            'SEPA-Mandatsreferenz',
            'Skontosperre',
            'Gesellschaftername',
            'Beteiligtennummer',
            'Identifikationsnummer',
            'Zeichnernummer',
            'Postensperre bis',
            'Bezeichnung SoBil-Sachverhalt',
            'Kennzeichen SoBil-Buchung',
            'Festschreibung',
            'Leistungsdatum',
            'Datum Zuord. Steuerperiode',
            'Fälligkeit',
            'Generalumkehr (GU)',
            'Steuersatz',
            'Land',
            'Abrechnungsreferenz',
            'BVV-Position',
            'EU-Land u. UStID (Ursprung)',
            'EU-Steuersatz (Ursprung)',
            'Abw. Skontokonto'
        ];

        // Textfelder (1-basiert) laut Formatbeschreibung — sie stehen IMMER in Anfuehrungszeichen,
        // auch leer (""). Abgeleitet aus einer Zeile der offiziellen Musterdatei und gegen die
        // Feldformate der Beschreibung geprueft; beide ergeben dieselbe Menge.
        var TEXTFELDER = [2, 3, 6, 9, 11, 12, 14, 16, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 40, 42, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 91, 95, 96, 98, 102, 103, 105, 107, 109, 110, 112, 118, 120, 121, 123];
        var istText = {};
        TEXTFELDER.forEach(function (n) { istText[n - 1] = true; });

        // Textfeld: immer quoten, Quotes verdoppeln. Steuerzeichen (Zeilenumbruch u.ae.) sind
        // laut Beschreibung in Textfeldern unzulaessig und werden zu Leerzeichen.
        var txt = function (v) {
            return '"' + String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/"/g, '""') + '"';
        };
        // Belegfeld 1: nur A-Z a-z 0-9 _ $ & % * + - / erlaubt, max. 36 Zeichen. Leerzeichen,
        // Umlaute, Punkt, Komma, Doppelpunkt sind ausdruecklich unzulaessig — sie werden entfernt.
        var beleg = function (v) {
            return String(v == null ? '' : v).replace(/[^A-Za-z0-9_$&%*+\-\/]/g, '').slice(0, 36);
        };

        var header2 = SPALTEN.join(';');

        // ── Datenzeilen ─────────────────────────────────────────────────
        // Umsatz 0,00 ist laut Beschreibung unzulaessig (Feld 1: "darf nicht 0,00 sein") und
        // haette auch keine Wirkung — solche Zeilen fallen weg, statt den Import zu blockieren.
        var dataLines = rows.filter(function (r) { return Math.abs(parseFloat(r.umsatz) || 0) >= 0.005; })
          .map(function (r) {
            var cols = SPALTEN.map(function (_, i) { return istText[i] ? '""' : ''; });
            cols[0]  = amtDe(Math.abs(parseFloat(r.umsatz) || 0));      //  1 Umsatz, immer positiv
            cols[1]  = txt(r.sh);                                        //  2 Soll/Haben
            cols[2]  = txt('EUR');                                       //  3 WKZ Umsatz
            cols[6]  = r.konto;                                          //  7 Konto
            cols[7]  = r.gegenkonto;                                     //  8 Gegenkonto
            cols[8]  = txt(r.buSchluessel || '');                        //  9 BU-Schluessel, als Text
            cols[9]  = datevDate(r.datum);                               // 10 Belegdatum TTMM
            cols[10] = txt(beleg(r.belegfeld1));                         // 11 Belegfeld 1
            cols[13] = txt(String(r.buchungstext || '').slice(0, 60));   // 14 Buchungstext
            return cols.join(';');
        });

        return [header1, header2].concat(dataLines).join('\r\n');

    }

    // ── Belegexport ─────────────────────────────────────────────────────────────
    // Das Anforderungsprofil verlangt "standardisierter Daten- UND Belegexport"
    // (plan/pruefliste-buchhaltung-2026-09-21.md, Kriterium 4.1). Der Stapel allein ist der
    // Datenteil; ohne die Bilder muss der Steuerberater jeden Beleg einzeln nachfordern.
    //
    // Die Verknuepfung zum Stapel ist die Belegnummer: sie steht dort in Belegfeld 1 und
    // gibt hier dem Bild den Namen. Genau so sucht ein Buchhalter — ueber die Belegnummer,
    // nicht ueber eine Datensatz-ID.
    //
    // Nur data:-URLs kommen mit. Die lokale Kopie eines Belegs ist immer inline
    // (js/blob-attachments.js laegert nur die CLOUD-Darstellung aus), ein anderer Fall
    // sollte also nicht auftreten — wenn doch, wird er gezaehlt und gemeldet statt
    // stillschweigend zu fehlen.
    function _belegeSammeln(year) {
        var von = year + '-01-01', bis = year + '-12-31';
        var imJahr = function (d) { return d && d >= von && d <= bis; };
        var raus = [], ohne = 0;

        var nimm = function (quelle, datum, nummer, dataUrl) {
            if (!imJahr(datum) || !dataUrl) return;
            var teil = StackrZip.ausDataUrl(dataUrl);
            if (!teil) { ohne++; return; }
            // Alles, was kein Buchstabe, keine Ziffer, kein Strich und kein Leerzeichen ist,
            // faellt weg. Punkte ausdruecklich MIT: "../.." wuerde sonst als ".._.." im Namen
            // stehen bleiben — harmlos, weil StackrZip ohnehin keine Segmente mit ".." zulaesst,
            // aber ein Dateiname, der nach Pfadausbruch aussieht, gehoert nicht in ein Archiv,
            // das an einen Dritten geht.
            var basis = String(nummer || '').trim().replace(/[^\w\- ]+/g, '_')
                                                   .replace(/_{2,}/g, '_')
                                                   .replace(/^_+|_+$/g, '') || 'ohne-nummer';
            raus.push({
                name: 'belege/' + quelle + '/' + datum + '_' + basis + teil.endung,
                data: teil.bytes,
                datum: new Date(datum)
            });
        };

        try {
            // Derselbe Getter wie im Stapel oben (Zeile ~116): wer dort gebucht wird, soll
            // hier seinen Beleg bekommen.
            ((Store.getAllExpensesRaw ? Store.getAllExpensesRaw() : Store.getExpenses ? Store.getExpenses() : []) || []).forEach(function (e) {
                if (e.storniert) return;
                nimm('ausgaben', e.datum, e.belegNr || e.id, e.belegFoto);
            });
        } catch (e) { /* Modul nicht geladen */ }

        try {
            (Store.getAllPurchasesRaw ? Store.getAllPurchasesRaw() : []).forEach(function (p) {
                if (p.storniert) return;
                nimm('wareneinkauf', p.datum, p.belegNr || p.artikelNr || p.id, p.belegFoto);
            });
        } catch (e) { /* dito */ }

        try {
            // Company-praefixierter Schluessel, nie ungepraefixt lesen — dieselbe Herleitung
            // wie oben im Stapel, damit Belege und Buchungen aus derselben Quelle kommen.
            var co = localStorage.getItem('oyi_active_company') || '';
            var k  = (co ? co + '__' : '') + 'eigenbelege_belege';
            var ebs = (Store._syncReadRaw ? Store._syncReadRaw(k) : JSON.parse(localStorage.getItem(k) || '[]')) || [];
            ebs.forEach(function (b) {
                if (b.storniert) return;
                nimm('eigenbelege', b.belegDatum, b.belegNr || b.id, b.foto);
            });
        } catch (e) { /* dito */ }

        return { dateien: raus, ohne: ohne };
    }

    // Kurze Wegbeschreibung ins Archiv. Ein Ordner mit 200 Bildern und einer CSV daneben
    // erklaert sich nicht von selbst, und der Empfaenger ist nicht der Nutzer, sondern
    // dessen Steuerberater.
    function _liesmich(year, skr, stapelName, anzahlBelege, ohne) {
        return [
            'DATEV-Export aus Stackr',
            '========================',
            '',
            'Jahr:          ' + year,
            'Kontenrahmen:  ' + skr,
            'Erzeugt am:    ' + new Date().toLocaleDateString('de-DE'),
            '',
            'Inhalt',
            '------',
            stapelName + '   Buchungsstapel im DATEV-Format (EXTF, Version 13, 125 Spalten).',
            'belege/                     ' + anzahlBelege + ' Belegbilder, nach Herkunft in Unterordner sortiert.',
            '',
            'Zuordnung',
            '---------',
            'Jede Bilddatei heisst <Belegdatum>_<Belegnummer>. Dieselbe Belegnummer steht im',
            'Stapel in Belegfeld 1 — darueber laesst sich jede Buchung ihrem Beleg zuordnen.',
            '',
            'Bitte beachten',
            '--------------',
            '- Berater-Nummer und Mandanten-Nummer im Stapel sind Platzhalter (00000 / 00001)',
            '  und muessen vor dem Import angepasst werden.',
            '- Anlagen: Zugang im Kaufjahr (Anlagekonto an Bank, Anschaffungskosten netto) und',
            '  AfA zum 31.12. gegen das Anlagekonto. Wurde der Kauf zusaetzlich als Ausgabe',
            '  erfasst, steht er doppelt im Stapel.',
            ohne ? '- ' + ohne + ' Beleg(e) konnten nicht ins Archiv uebernommen werden.' : '',
            ''
        ].filter(function (z) { return z !== ''; }).join('\r\n');
    }

    /** Render the DATEV export UI card */
    function renderCard(containerId) {
        var curYear = new Date().getFullYear();
        var years = [];
        for (var y = curYear; y >= curYear - 4; y--) years.push(y);

        var html = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-top:20px;">';
        html += '<div style="font-weight:700;font-size:15px;margin-bottom:4px;">DATEV-Export (Buchungsstapel)</div>';
        html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">Exportiert Einnahmen, Retouren, Ausgaben, Wareneinkäufe, Fahrtkosten, Verpackungsmaterial, Eigenbelege und Anlagen (Zugang + AfA) im DATEV ASCII-Format für deinen Steuerberater.</div>';
        html += '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">';
        html += '<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Jahr</label>';
        html += '<select class="form-select" id="datevYear" style="min-width:90px;">';
        years.forEach(function (y) { html += '<option value="' + y + '">' + y + '</option>'; });
        html += '</select></div>';
        html += '<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;">Kontenrahmen</label>';
        html += '<select class="form-select" id="datevSkr" style="min-width:100px;">';
        html += '<option value="SKR03">SKR 03</option>';
        html += '<option value="SKR04">SKR 04</option>';
        html += '</select></div>';
        // Gegenkonto fuer Aufwand ohne Zahlungsvorgang. Vorbelegt mit Privateinlage, weil das
        // der fachlich richtige Wert ist — wer nichts davon versteht, laesst es stehen und
        // macht nichts falsch. Betroffen sind nur Kilometerpauschale und Eigenbelege;
        // Material-Einkaeufe sind echte Zahlungen und gehen immer gegen Bank.
        html += '<div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px;" for="datevGegenkonto">Gegenkonto ohne Zahlung</label>';
        html += '<select class="form-select" id="datevGegenkonto" style="min-width:150px;" title="Womit werden Kilometerpauschale und Eigenbelege gegengebucht? Dort ist kein Geld geflossen.">';
        html += '<option value="privat">Privateinlage (empfohlen)</option>';
        html += '<option value="bank">Bank</option>';
        html += '<option value="kasse">Kasse</option>';
        html += '</select></div>';
        html += '<button class="btn btn-primary" id="datevExportBtn" style="align-self:flex-end;"><i class="ti ti-file-spreadsheet"></i> DATEV exportieren</button>';
        html += '</div>';
        html += '<label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;cursor:pointer;" for="datevBelege">';
        html += '<input type="checkbox" id="datevBelege" checked style="width:16px;height:16px;">';
        html += '<span>Belegbilder mitliefern — Ausgabe als <strong>ZIP</strong> statt einzelner CSV</span></label>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;margin-left:24px;">Im Archiv liegt der Stapel neben einem Ordner <code>belege/</code>. Jede Datei traegt die Belegnummer, die im Stapel in Belegfeld 1 steht.</div>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:10px;">⚠ Berater-Nr. und Mandanten-Nr. sind Platzhalter (00000 / 00001). Bitte vor dem Import in DATEV anpassen.</div>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Anlagen werden im Kaufjahr als <strong>Zugang</strong> gebucht und jährlich abgeschrieben. Hast du einen Anlagenkauf zusätzlich als Ausgabe erfasst, steht er doppelt im Stapel.</div>';
        html += '</div>';
        return html;
    }

    function initCard() {
        var btn = document.getElementById('datevExportBtn');
        if (!btn) return;
        btn.addEventListener('click', function () {
            var year = document.getElementById('datevYear').value;
            var skr  = document.getElementById('datevSkr').value;
            var gkEl = document.getElementById('datevGegenkonto');
            var csv  = buildCSV(year, skr, gkEl ? gkEl.value : 'privat');
            // Praefix EXTF_ ist laut Formatbeschreibung fest ("EXTF_....CSV").
            var filename = 'EXTF_Buchungsstapel_' + year + '_' + skr + '.csv';
            // DATEV requires Windows-1252 encoding; we export UTF-8 with BOM as fallback
            var bom = '﻿';

            var belegeEl = document.getElementById('datevBelege');
            if (!belegeEl || !belegeEl.checked || typeof StackrZip === 'undefined') {
                Utils.downloadFile(bom + csv, filename, 'text/csv; charset=utf-8');
                Utils.showToast('DATEV exportiert: ' + filename, 'success');
                return;
            }

            var belege = _belegeSammeln(year);
            var archiv = [{ name: filename, data: bom + csv }].concat(belege.dateien);
            archiv.push({
                name: 'LIESMICH.txt',
                data: _liesmich(year, skr, filename, belege.dateien.length, belege.ohne)
            });
            var zipName = 'DATEV_' + year + '_' + skr + '.zip';
            try {
                Utils.downloadBytes(StackrZip.build(archiv), zipName, 'application/zip');
            } catch (err) {
                // Lieber der Stapel allein als ein Archiv, das sich beim Steuerberater
                // nicht oeffnen laesst.
                console.warn('[DATEV] Belegarchiv fehlgeschlagen, nur Stapel:', err);
                Utils.downloadFile(bom + csv, filename, 'text/csv; charset=utf-8');
                Utils.showToast('Belegarchiv nicht erzeugbar — der Buchungsstapel wurde einzeln exportiert.', 'warning', 9000);
                return;
            }
            Utils.showToast('DATEV exportiert: ' + zipName + ' (Stapel + ' + belege.dateien.length + ' Belege)'
                          + (belege.ohne ? ' — ' + belege.ohne + ' Beleg(e) nicht lesbar und nicht enthalten.' : ''),
                          'success', belege.ohne ? 10000 : 5000);
        });
    }

    return {
        buildCSV: buildCSV, renderCard: renderCard, initCard: initCard,
        kontoForKategorie: kontoForKategorie,
        // Einzeln exportiert, damit test/test-datev-belege.js die Sammlung pruefen kann,
        // ohne einen Klick und einen Download zu simulieren.
        _belegeSammeln: _belegeSammeln, _liesmich: _liesmich
    };
})();
