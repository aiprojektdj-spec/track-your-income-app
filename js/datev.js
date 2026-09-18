// ============================================================
// DATEV Export — Buchungsstapel ASCII/CSV
// Format: DATEV Buchungsdatenservice (Buchungsstapel)
// SKR03 & SKR04 Konto-Mapping für EÜR-Daten
// ============================================================
var DatevExport = (function () {

    // ── SKR03 Konto-Mapping ─────────────────────────────────────────────
    var SKR03 = {
        // Erlöse
        erloese_19:     '8400',  // Erlöse 19% USt
        erloese_7:      '8300',  // Erlöse 7% USt
        erloese_0:      '8200',  // Steuerfreie Erlöse
        erloese_klein:  '8200',  // Kleinunternehmer §19 UStG
        // Wareneinkauf
        waren_19:       '3400',  // Wareneinkauf 19% Vorsteuer
        waren_7:        '3300',  // Wareneinkauf 7% Vorsteuer
        waren_0:        '3200',  // Wareneinkauf steuerfrei
        // Betriebsausgaben
        versand:        '4230',  // Porto & Versand
        plattform:      '4970',  // Provisionen (Plattformgebühren)
        fahrt:          '4660',  // Reisekosten
        material:       '4980',  // Büro-/Betriebsbedarf
        afa:            '4840',  // Abschreibungen (AfA)
        sonstige:       '4900',  // Sonstige Betriebsausgaben
        // Bank / Kasse / Privat
        bank:           '1800',  // Bank
        kasse:          '1000',  // Kasse
        // Privateinlagen: Gegenkonto fuer Aufwand OHNE Zahlungsvorgang. Eine
        // Kilometerpauschale und ein Eigenbeleg sind Betriebsausgabe, aber es verlaesst kein
        // Geld das Geschaeftskonto — gegen 1800 gebucht stimmt beim Steuerberater der
        // Bankbestand nicht mehr.
        privat:         '1890',  // Privateinlagen (SKR03)
    };

    // ── SKR04 Konto-Mapping ─────────────────────────────────────────────
    var SKR04 = {
        erloese_19:     '4400',
        erloese_7:      '4300',
        erloese_0:      '4200',
        erloese_klein:  '4200',
        waren_19:       '5200',
        waren_7:        '5300',
        waren_0:        '5400',
        versand:        '6090',
        plattform:      '6300',
        fahrt:          '6320',
        material:       '6810',
        afa:            '6200',
        sonstige:       '6850',
        bank:           '1800',
        kasse:          '1000',
        privat:         '2180',  // Privateinlagen (SKR04)
    };

    // ── Kategorie → SKR-Konto (auch für Finanzen-Modul-Anzeige nutzbar) ──
    function kontoForKategorie(kategorie, skr) {
        var accounts = skr === 'SKR04' ? SKR04 : SKR03;
        var cat = (kategorie || '').toLowerCase();
        if (cat.indexOf('versand') > -1 || cat.indexOf('porto') > -1) return accounts.versand;
        if (cat.indexOf('plattform') > -1 || cat.indexOf('provision') > -1) return accounts.plattform;
        if (cat.indexOf('fahrt') > -1 || cat.indexOf('reise') > -1) return accounts.fahrt;
        if (cat.indexOf('material') > -1 || cat.indexOf('büro') > -1) return accounts.material;
        if (cat.indexOf('afa') > -1 || cat.indexOf('abschreibung') > -1) return accounts.afa;
        return accounts.sonstige;
    }

    // ── CSV helpers ─────────────────────────────────────────────────────
    // DATEV uses semicolons, fields with special chars in double-quotes
    //
    // Das hier ist die einzige noetige Entschaerfung — KEIN Utils.escapeHtml auf den
    // Buchungstexten. Eine CSV ist kein HTML: escapeHtml machte aus der Firma
    // "Reck & Schwarz" ein "Reck &amp; Schwarz", und genau so stand es dann beim
    // Steuerberater im Stapel. Die Rechnungszeile hat den Kundennamen immer schon roh
    // durchgereicht — dieselbe Datei war also in sich widerspruechlich.
    function csvField(v) {
        if (v == null) return '';
        var s = String(v);
        if (s.indexOf('"') > -1 || s.indexOf(';') > -1 || s.indexOf('\n') > -1) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

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

    // Full date TT.MM.JJJJ for header fields
    function fullDate(isoDate) {
        if (!isoDate) return '';
        var parts = isoDate.split('-');
        if (parts.length < 3) return isoDate;
        return parts[2] + '.' + parts[1] + '.' + parts[0];
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

        // Verkäufe (Einnahmen) aus Rechnungen
        invoices.forEach(function (inv) {
            var isKlein = inv.isKlein !== undefined ? inv.isKlein : (settings.ustMode === 'klein');
            var netto = 0;
            var mwstMap = {};
            (inv.positionen || []).forEach(function (pos) {
                // menge wie auf der Rechnung selbst: leer/0 = 0 (kein ||1-Phantomumsatz)
                // `|| 0` gehoert AUSSERHALB von parseFloat — sonst wird ein nicht-numerischer
                // Einzelpreis zu NaN und die Buchungszeile unbrauchbar. Dasselbe Muster stand
                // an mehreren Stellen im Projekt; test/test-parsefloat-klammer.js haelt sie
                // alle fest und nennt die Zahl, damit sie hier nicht veraltet.
                var ln = (parseFloat(pos.menge) || 0) * (parseFloat(pos.einzelpreis) || 0);
                netto += ln;
                var rate = isKlein ? 0 : (parseInt(pos.mwstSatz) || 0);
                if (rate > 0) mwstMap[rate] = (mwstMap[rate] || 0) + ln * rate / 100;
            });
            var mwstTotal = Object.keys(mwstMap).reduce(function (s, r) { return s + mwstMap[r]; }, 0);
            var brutto = netto + mwstTotal;

            // Hauptkonto: je nach USt-Satz (vereinfacht: nimm ersten Satz)
            var rates = Object.keys(mwstMap).map(Number);
            var primaryRate = rates.length ? Math.max.apply(null, rates) : 0;
            var erloesKonto;
            if (isKlein) erloesKonto = accounts.erloese_klein;
            else if (primaryRate === 19) erloesKonto = accounts.erloese_19;
            else if (primaryRate === 7)  erloesKonto = accounts.erloese_7;
            else                         erloesKonto = accounts.erloese_0;

            var customers = Store.getRechCustomers ? Store.getRechCustomers() : [];
            var kunde = customers.find(function (c) { return c.id === inv.kundeId; });
            var kundeName = kunde ? (kunde.firma || kunde.ansprechpartner || '') : '';

            // Gutschrift (Kreditnote) mindert den Umsatz (§17 UStG) → Buchung gegenläufig zur
            // normalen Rechnung (Soll statt Haben auf dem Erlöskonto), Betrag bleibt absolut.
            var isGutschrift = inv.typ === 'gutschrift';

            rows.push({
                umsatz:       brutto,
                sh:           isGutschrift ? 'S' : 'H',
                konto:        erloesKonto,
                gegenkonto:   accounts.bank,
                datum:        invKeyDate(inv),
                belegfeld1:   inv.nummer || '',
                buchungstext: ((isGutschrift ? 'Gutschrift ' : 'Rechnung ') + (inv.nummer || '') + (kundeName ? ' ' + kundeName : '')).slice(0, 60),
                buSchluessel: isKlein ? '' : (primaryRate === 19 ? '' : primaryRate === 7 ? '2' : '40'),
            });
        });

        // Direktverkäufe (Marktplatz) — immer exportieren, aber Sales aus bezahlten Rechnungen
        // (_invoiceId) ausschließen: die sind oben schon als Rechnungszeile gebucht. Der frühere
        // Guard `invoices.length === 0` verschluckte sonst ALLE Direktverkäufe, sobald im Jahr
        // eine einzige Rechnung existierte.
        {
            sales.filter(function (s) { return !s._invoiceId; }).forEach(function (s) {
                // Käufer-Versand zählt zur Einnahme (konsistent zu UVA/EÜR)
                var vkp = (parseFloat(s.verkaufspreis) || 0) + (parseFloat(s.versandkostenKaeufer) || 0);
                var erloesKonto = isKlein ? accounts.erloese_klein : accounts.erloese_19;
                rows.push({
                    umsatz:       vkp,
                    sh:           'H',
                    konto:        erloesKonto,
                    gegenkonto:   accounts.bank,
                    datum:        s.datum,
                    belegfeld1:   s.id ? s.id.slice(0, 12) : '',
                    buchungstext: ('Verkauf ' + (s.plattform || '') + ' ' + ((s.marke || '') + ' ' + (s.artikeltyp || ''))).slice(0, 60),
                    buSchluessel: '',
                });
            });
        }

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
                buSchluessel: ustSatz > 0 ? '' : '40',
            });
        });

        // Sonstige Ausgaben
        expenses.forEach(function (e) {
            var betrag = parseFloat(e.betrag) || 0;
            if (betrag <= 0) return;
            var konto = kontoForKategorie(e.kategorie, skr);
            rows.push({
                umsatz:       betrag,
                sh:           'S',
                konto:        konto,
                gegenkonto:   accounts.bank,
                datum:        e.datum,
                belegfeld1:   e.belegnummer || e.id.slice(0, 12),
                buchungstext: String(e.bezeichnung || e.kategorie || 'Ausgabe').slice(0, 60),
                buSchluessel: '',
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
                    konto:        accounts.material,
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

        // Sort by date
        rows.sort(function (a, b) { return (a.datum || '').localeCompare(b.datum || ''); });

        // ── DATEV Header (Zeile 1) ──────────────────────────────────────
        // Format: "EXTF";Versionsnummer;Datenkategorie;Formatname;Formatversion;...
        var beraternr   = '00000';   // placeholder — user must fill in DATEV advisor number
        var mandantennr = '00001';   // placeholder
        var wjBeginn    = year + '0101';
        var sachkontenlaenge = '4';

        var header1 = [
            '"EXTF"', '700', '21', '"Buchungsstapel"', '12', '', '', '', '', '',
            beraternr, mandantennr, wjBeginn, sachkontenlaenge,
            '"' + fullDate(vonDate) + '"',
            '"' + fullDate(bisDate) + '"',
            '"Stackr Export ' + year + '"',
            '', '1', '0', '', '', '', '""', '""', '""'
        ].join(';');

        // ── Column headers (Zeile 2) ────────────────────────────────────
        // Diese Liste ist die EINZIGE Quelle fuer die Spaltenbreite: die Datenzeilen unten
        // leiten ihre Feldzahl daraus ab. Vorher stand dort die feste Zahl 116, waehrend die
        // Liste 96 Namen hat — Kopfzeile und Datenzeilen waren also 20 Felder auseinander,
        // und eine CSV, deren Kopf schmaler ist als ihre Zeilen, laesst sich nicht importieren.
        // Gemessen am 2026-09-13, siehe plan/funde-datev-2026-09-13.md.
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
            'EU-Land u. UStID',
            'EU-Steuersatz',
            'Abw. Versteuerungsart',
            'Sachverhalt L+L',
            'Funktionsergänzung L+L',
            'BU 49 Hauptfunktionstyp',
            'BU 49 Hauptfunktionsnummer',
            'BU 49 Funktionsergänzung',
            'Zusatzinformation- Art 1',
            'Zusatzinformation- Inhalt 1',
            'Zusatzinformation- Art 2',
            'Zusatzinformation- Inhalt 2',
            'Zusatzinformation- Art 3',
            'Zusatzinformation- Inhalt 3',
            'Zusatzinformation- Art 4',
            'Zusatzinformation- Inhalt 4',
            'Zusatzinformation- Art 5',
            'Zusatzinformation- Inhalt 5',
            'Zusatzinformation- Art 6',
            'Zusatzinformation- Inhalt 6',
            'Zusatzinformation- Art 7',
            'Zusatzinformation- Inhalt 7',
            'Zusatzinformation- Art 8',
            'Zusatzinformation- Inhalt 8',
            'Zusatzinformation- Art 9',
            'Zusatzinformation- Inhalt 9',
            'Zusatzinformation- Art 10',
            'Zusatzinformation- Inhalt 10',
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
            'Datum Zuord. Steuerperiode'
        ];
        var header2 = SPALTEN.map(function (h) { return '"' + h + '"'; }).join(';');

        // ── Data rows ───────────────────────────────────────────────────
        var dataLines = rows.map(function (r) {
            // Genau so breit wie die Kopfzeile — die Schluesselfelder werden gefuellt, der Rest
            // bleibt leer. Breite NIE hart hinschreiben, sonst driftet sie wieder auseinander.
            var cols = new Array(SPALTEN.length).fill('');
            cols[0]  = amtDe(r.umsatz);
            cols[1]  = r.sh;
            cols[2]  = 'EUR';
            cols[3]  = '';   // Kurs
            cols[4]  = '';   // Basis-Umsatz
            cols[5]  = '';   // WKZ Basis
            cols[6]  = r.konto;
            cols[7]  = r.gegenkonto;
            cols[8]  = r.buSchluessel || '';
            cols[9]  = datevDate(r.datum);
            cols[10] = csvField(r.belegfeld1);
            cols[11] = '';   // Belegfeld2
            cols[12] = '';   // Skonto
            cols[13] = csvField(r.buchungstext);
            return cols.join(';');
        });

        return [header1, header2].concat(dataLines).join('\r\n');
    }

    /** Render the DATEV export UI card */
    function renderCard(containerId) {
        var curYear = new Date().getFullYear();
        var years = [];
        for (var y = curYear; y >= curYear - 4; y--) years.push(y);

        var html = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-top:20px;">';
        html += '<div style="font-weight:700;font-size:15px;margin-bottom:4px;">DATEV-Export (Buchungsstapel)</div>';
        html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">Exportiert Einnahmen, Ausgaben, Wareneinkäufe, Fahrtkosten, Verpackungsmaterial und Eigenbelege im DATEV ASCII-Format für deinen Steuerberater.</div>';
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
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:10px;">⚠ Berater-Nr. und Mandanten-Nr. sind Platzhalter (00000 / 00001). Bitte vor dem Import in DATEV anpassen.</div>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">Nicht enthalten: <strong>Abschreibungen (AfA)</strong> und <strong>Retouren</strong> — beide brauchen eine Kontenzuordnung, die Stackr nicht kennt. Stehen in deiner EÜR, müssen im Stapel nachgetragen werden.</div>';
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
            var filename = 'DATEV_Buchungsstapel_' + year + '_' + skr + '.csv';
            // DATEV requires Windows-1252 encoding; we export UTF-8 with BOM as fallback
            var bom = '﻿';
            Utils.downloadFile(bom + csv, filename, 'text/csv; charset=utf-8');
            Utils.showToast('DATEV exportiert: ' + filename, 'success');
        });
    }

    return { buildCSV: buildCSV, renderCard: renderCard, initCard: initCard, kontoForKategorie: kontoForKategorie };
})();
