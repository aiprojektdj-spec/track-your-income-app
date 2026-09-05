// ============================================================
// XRechnung-Generator (Standalone-XML)
// Standard: EN 16931 — UN/CEFACT CII D16B (XRechnung 3.0)
// B2B-Empfangspflicht seit 01.01.2025 (§14 UStG i.V.m. WCG)
//
// AUSDRUECKLICH KEIN ZUGFeRD: Der Kopf dieser Datei nannte bis 2026-08-12 auch
// ZUGFeRD, erzeugt wird aber eine reine XML-Datei. ZUGFeRD/Factur-X ist ein
// PDF/A-3-Dokument mit eingebetteter CII-XML — die XML-Syntax ist dieselbe, das
// Ausgabeformat nicht. Stackr hat keine PDF-Bibliothek (PDFs entstehen ueber den
// Druckdialog des Browsers), kann also kein PDF/A-3 schreiben.
// Auf der EMPFANGSSEITE ist ZUGFeRD dagegen vollstaendig unterstuetzt, inklusive
// XML-Extraktion aus dem PDF (rechnungen/js/erechnung-import.js).
// Rahmen fuer eine moegliche Ausgabeseite: plan/erechnung-zugferd-2026-08-12.md
// ============================================================
var XRechnung = (function () {

    function esc(v) {
        if (v == null) return '';
        return String(v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // YYYY-MM-DD → YYYYMMDD
    function isoDate(d) { return d ? String(d).replace(/-/g, '') : ''; }

    // Numeric: always 2 decimal places
    function amt(n) { return parseFloat(n || 0).toFixed(2); }

    // UN/ECE unit code mapping
    function unitCode(einheit) {
        var map = { 'Std.': 'HUR', 'pauschal': 'LS', 'Stück': 'C62', 'Stk': 'C62', 'kg': 'KGM', 'm': 'MTR' };
        return map[einheit] || 'C62';
    }

    function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

    // EU-Mitgliedstaaten (ohne DE) — für ig. Lieferung/Leistung vs. Ausfuhr (Drittland) nötig.
    var EU_LAENDER = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 'HU', 'IE', 'IT',
        'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'ES'];

    // §25a UStG Differenzbesteuerung — Pflichtangabe nach §14a Abs. 6 UStG, je Warenart der
    // gesetzlich vorgeschriebene Wortlaut. Gleiche Texte wie im PDF-Ausdruck
    // (rechnungen/js/rechnung.js); sie sind der ExemptionReason der XML-Zeile, denn BT-120 ist
    // in EN 16931 der einzige Ort, an dem dieser Pflichttext transportiert werden kann.
    var DIFF25A_REASON = {
        gebraucht:     'Gebrauchtgegenstände/Sonderregelung',
        kunst:         'Kunstgegenstände/Sonderregelung',
        sammlerstueck: 'Sammlungsstücke und Antiquitäten/Sonderregelung'
    };
    function diff25aReason(pos) {
        return DIFF25A_REASON[pos && pos.warenart] || DIFF25A_REASON.gebraucht;
    }

    // EN 16931 Steuerkategorie + Befreiungsgrund je Position ermitteln. Unterscheidet Ware
    // (§6a UStG ig. Lieferung, steuerfrei) von Leistung (§13b UStG Reverse Charge) statt beide
    // pauschal auf einen Wert zu kollabieren — die Rechtsfolgen unterscheiden sich (Steuerschuldner!).
    function taxCategoryFor(rate, isKlein, pos, inv, kunde) {
        if (isKlein) return { code: 'E', reasonCode: 'VATEX-EU-O', reason: 'Umsatzsteuerbefreiung nach §19 UStG (Kleinunternehmer)' };
        if (rate > 0) return { code: 'S', reasonCode: null, reason: null };
        var istDiff25a = !!(pos && pos.differenzbesteuert);
        var kundeLand = kunde && kunde.land;
        var istEU = !!(kundeLand && kundeLand !== 'DE' && EU_LAENDER.indexOf(kundeLand) !== -1);
        var hatUstId = !!(kunde && kunde.ustIdNr);
        if (istEU && hatUstId) {
            var art = pos.igArt || inv.igArt || 'ware';
            if (art === 'leistung') {
                return { code: 'AE', reasonCode: 'VATEX-EU-AE', reason: 'Steuerschuldnerschaft des Leistungsempfängers gemäß §13b UStG' };
            }
            // §25a Abs. 5 Satz 2 UStG nimmt die ig. Lieferung von den fortgeltenden Befreiungen
            // AUSDRUECKLICH aus: „Die Steuerbefreiungen, ausgenommen die Steuerbefreiung für
            // innergemeinschaftliche Lieferungen (§ 4 Nr. 1 Buchstabe b, § 6a), bleiben unberührt."
            // Ein differenzbesteuerter Gegenstand an einen EU-Unternehmer ist also NICHT steuerfrei —
            // Kategorie K waere hier eine Unterzahlung. Faellt bewusst auf §25a durch.
            if (!istDiff25a) {
                return { code: 'K', reasonCode: 'VATEX-EU-IC', reason: 'Steuerfreie innergemeinschaftliche Lieferung gemäß §4 Nr. 1b i.V.m. §6a UStG' };
            }
        }
        var istDrittland = !!(kundeLand && kundeLand !== 'DE' && !istEU);
        // Die Ausfuhrbefreiung bleibt nach §25a Abs. 5 Satz 2 UStG unberührt — anders als die
        // ig. Lieferung oben. Ausfuhr geht deshalb auch bei Differenzbesteuerung vor.
        if (istDrittland) return { code: 'G', reasonCode: 'VATEX-EU-G', reason: 'Steuerfreie Ausfuhrlieferung gemäß §4 Nr. 1a i.V.m. §6 UStG' };
        // §25a: kein offener USt-Ausweis, aber der Umsatz ist NICHT steuerfrei — er ist auf die
        // Marge besteuert. Kategorie E ist dafuer die uebliche EN-16931-Zuordnung (BR-E-1..10);
        // als Begruendung darf hier aber nicht „Steuerfreier Umsatz" stehen, sondern der
        // §14a-Abs.-6-Pflichttext, der sonst nur im PDF steht und der XML ganz fehlte.
        if (istDiff25a) return { code: 'E', reasonCode: null, reason: diff25aReason(pos) };
        return { code: 'E', reasonCode: null, reason: 'Steuerfreier Umsatz' };
    }

    /**
     * Build line-item & tax totals from invoice positionen.
     * Returns { lineItems, nettoGesamt, mwstMap, totalMwst, bruttoGesamt, catMap }
     */
    function calcTotals(positionen, isKlein, inv, kunde) {
        var lineItems = [];
        var nettoGesamt = 0;
        var mwstMap = {};   // rate -> gerundete USt-Summe (nur rate>0)
        var catMap  = {};   // Kategorie-Code (K/AE/G/E) -> { basis, reasonCode, reason } (nur rate===0)

        (positionen || []).forEach(function (pos, idx) {
            // Menge explizit auf undefined/null/'' prüfen statt `|| 1` — eine bewusste Menge 0
            // (z.B. Korrekturzeile) darf nicht stillschweigend zu 1 werden (EN 16931 BR-Konsistenz).
            var mengeRaw = (pos.menge !== undefined && pos.menge !== null && pos.menge !== '') ? parseFloat(pos.menge) : 1;
            var menge   = isNaN(mengeRaw) ? 1 : mengeRaw;
            var preis   = parseFloat(pos.einzelpreis || 0);
            // BR-CO-10: Zeilenbeträge werden EINZELN gerundet, dann summiert — nicht die
            // ungerundete Summe separat runden (sonst Differenz zwischen Kopf- und Zeilensumme).
            var line    = round2(menge * preis);
            var rate    = isKlein ? 0 : (parseInt(pos.mwstSatz) || 0);
            var lineMwst = round2(line * rate / 100);
            nettoGesamt += line;
            var cat = taxCategoryFor(rate, isKlein, pos, inv || {}, kunde);
            if (rate > 0) {
                mwstMap[rate] = round2((mwstMap[rate] || 0) + lineMwst);
            } else {
                // Mehrere Gruende koennen auf DIESELBE Kategorie fallen — seit §25a real: zwei
                // Warenarten auf einer Rechnung ergeben beide Kategorie E mit verschiedenem
                // Pflichttext, ebenso §25a neben einem sonstigen steuerfreien Umsatz. Vorher
                // gewann still der erste und der Rest verschwand; bei der §14a-Abs.-6-Angabe waere
                // das der Verlust einer Pflichtangabe. EN 16931 laesst je Kategorie nur EINEN
                // BT-120 zu, deshalb werden die Texte gesammelt und zusammengefasst — die
                // Zeilenebene (BT-128) traegt den positionsgenauen Text ohnehin.
                var cm = catMap[cat.code] || { basis: 0, reasonCode: cat.reasonCode, reasons: [] };
                cm.basis = round2(cm.basis + line);
                if (cat.reason && cm.reasons.indexOf(cat.reason) === -1) cm.reasons.push(cat.reason);
                if (!cm.reasonCode && cat.reasonCode) cm.reasonCode = cat.reasonCode;
                cm.reason = cm.reasons.join('; ');
                catMap[cat.code] = cm;
            }
            lineItems.push({
                pos:         idx + 1,
                beschreibung: pos.beschreibung || '',
                menge:       menge,
                einheit:     pos.einheit || 'Stück',
                einzelpreis: preis,
                lineNetto:   line,
                mwstRate:    rate,
                catCode:     cat.code,
                exemptionReason: cat.reason,
                exemptionReasonCode: cat.reasonCode
            });
        });

        var totalMwst = round2(Object.keys(mwstMap).reduce(function (s, k) { return s + mwstMap[k]; }, 0));
        nettoGesamt = round2(nettoGesamt);
        return {
            lineItems:    lineItems,
            nettoGesamt:  nettoGesamt,
            mwstMap:      mwstMap,
            catMap:       catMap,
            totalMwst:    totalMwst,
            bruttoGesamt: round2(nettoGesamt + totalMwst)
        };
    }

    /**
     * Generate XRechnung 3.0 XML string.
     * @param {Object} inv      – Invoice object from Store
     * @param {Object} settings – Merged company settings
     * @param {Object} kunde    – Customer object (may be null)
     * @returns {string} UTF-8 XML
     */
    function generate(inv, settings, kunde) {
        var isKlein = inv.isKlein !== undefined ? inv.isKlein : (settings.ustMode === 'klein');
        var t = calcTotals(inv.positionen, isKlein, inv, kunde);

        var xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<rsm:CrossIndustryInvoice\n'
             + '  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"\n'
             + '  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"\n'
             + '  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"\n'
             + '  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"\n'
             + '  xmlns:xs="http://www.w3.org/2001/XMLSchema">\n';

        // ── ExchangedDocumentContext ──────────────────────────────────────
        xml += '  <rsm:ExchangedDocumentContext>\n'
             + '    <ram:BusinessProcessSpecifiedDocumentContextParameter>\n'
             + '      <ram:ID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</ram:ID>\n'
             + '    </ram:BusinessProcessSpecifiedDocumentContextParameter>\n'
             + '    <ram:GuidelineSpecifiedDocumentContextParameter>\n'
             + '      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</ram:ID>\n'
             + '    </ram:GuidelineSpecifiedDocumentContextParameter>\n'
             + '  </rsm:ExchangedDocumentContext>\n';

        // ── ExchangedDocument ────────────────────────────────────────────
        var typeCode = inv.typ === 'gutschrift' ? '381' : '380'; // 380 = Invoice, 381 = Credit note
        xml += '  <rsm:ExchangedDocument>\n'
             + '    <ram:ID>' + esc(inv.nummer) + '</ram:ID>\n'
             + '    <ram:TypeCode>' + typeCode + '</ram:TypeCode>\n'
             + '    <ram:IssueDateTime>\n'
             + '      <udt:DateTimeString format="102">' + isoDate(inv.datum) + '</udt:DateTimeString>\n'
             + '    </ram:IssueDateTime>\n';
        if (inv.notizen) {
            xml += '    <ram:IncludedNote>\n'
                 + '      <ram:Content>' + esc(inv.notizen) + '</ram:Content>\n'
                 + '    </ram:IncludedNote>\n';
        }
        xml += '  </rsm:ExchangedDocument>\n';

        // ── SupplyChainTradeTransaction ───────────────────────────────────
        xml += '  <rsm:SupplyChainTradeTransaction>\n';

        // ── Line items ────────────────────────────────────────────────────
        t.lineItems.forEach(function (li) {
            xml += '    <ram:IncludedSupplyChainTradeLineItem>\n'
                 + '      <ram:AssociatedDocumentLineDocument>\n'
                 + '        <ram:LineID>' + li.pos + '</ram:LineID>\n'
                 + '      </ram:AssociatedDocumentLineDocument>\n'
                 + '      <ram:SpecifiedTradeProduct>\n'
                 + '        <ram:Name>' + esc(li.beschreibung) + '</ram:Name>\n'
                 + '      </ram:SpecifiedTradeProduct>\n'
                 + '      <ram:SpecifiedLineTradeAgreement>\n'
                 + '        <ram:NetPriceProductTradePrice>\n'
                 + '          <ram:ChargeAmount>' + amt(li.einzelpreis) + '</ram:ChargeAmount>\n'
                 + '        </ram:NetPriceProductTradePrice>\n'
                 + '      </ram:SpecifiedLineTradeAgreement>\n'
                 + '      <ram:SpecifiedLineTradeDelivery>\n'
                 + '        <ram:BilledQuantity unitCode="' + unitCode(li.einheit) + '">' + li.menge.toFixed(4) + '</ram:BilledQuantity>\n'
                 + '      </ram:SpecifiedLineTradeDelivery>\n'
                 + '      <ram:SpecifiedLineTradeSettlement>\n'
                 + '        <ram:ApplicableTradeTax>\n'
                 + '          <ram:TypeCode>VAT</ram:TypeCode>\n';
            if (li.exemptionReason) {
                xml += '          <ram:ExemptionReason>' + esc(li.exemptionReason) + '</ram:ExemptionReason>\n'
                     + (li.exemptionReasonCode ? '          <ram:ExemptionReasonCode>' + li.exemptionReasonCode + '</ram:ExemptionReasonCode>\n' : '');
            }
            xml += '          <ram:CategoryCode>' + li.catCode + '</ram:CategoryCode>\n'
                 + '          <ram:RateApplicablePercent>' + li.mwstRate.toFixed(2) + '</ram:RateApplicablePercent>\n'
                 + '        </ram:ApplicableTradeTax>\n'
                 + '        <ram:SpecifiedTradeSettlementLineMonetarySummation>\n'
                 + '          <ram:LineTotalAmount>' + amt(li.lineNetto) + '</ram:LineTotalAmount>\n'
                 + '        </ram:SpecifiedTradeSettlementLineMonetarySummation>\n'
                 + '      </ram:SpecifiedLineTradeSettlement>\n'
                 + '    </ram:IncludedSupplyChainTradeLineItem>\n';
        });

        // ── ApplicableHeaderTradeAgreement ────────────────────────────────
        xml += '    <ram:ApplicableHeaderTradeAgreement>\n';

        // Seller
        xml += '      <ram:SellerTradeParty>\n'
             + '        <ram:Name>' + esc(settings.firmenname || settings.name || '') + '</ram:Name>\n';
        if (settings.name && settings.firmenname && settings.name !== settings.firmenname) {
            xml += '        <ram:DefinedTradeContact>\n'
                 + '          <ram:PersonName>' + esc(settings.name) + '</ram:PersonName>\n'
                 + '        </ram:DefinedTradeContact>\n';
        }
        xml += '        <ram:PostalTradeAddress>\n'
             + '          <ram:PostcodeCode>' + esc(settings.plz || '') + '</ram:PostcodeCode>\n'
             + '          <ram:LineOne>' + esc(settings.adresse || '') + '</ram:LineOne>\n'
             + '          <ram:CityName>' + esc(settings.ort || '') + '</ram:CityName>\n'
             + '          <ram:CountryID>' + esc(settings.land || 'DE') + '</ram:CountryID>\n'
             + '        </ram:PostalTradeAddress>\n';
        if (settings.email) {
            xml += '        <ram:URIUniversalCommunication>\n'
                 + '          <ram:URIID schemeID="EM">' + esc(settings.email) + '</ram:URIID>\n'
                 + '        </ram:URIUniversalCommunication>\n';
        }
        if (settings.steuernummer) {
            xml += '        <ram:SpecifiedTaxRegistration>\n'
                 + '          <ram:ID schemeID="FC">' + esc(settings.steuernummer) + '</ram:ID>\n'
                 + '        </ram:SpecifiedTaxRegistration>\n';
        }
        if (settings.ustId) {
            xml += '        <ram:SpecifiedTaxRegistration>\n'
                 + '          <ram:ID schemeID="VA">' + esc(settings.ustId) + '</ram:ID>\n'
                 + '        </ram:SpecifiedTaxRegistration>\n';
        }
        xml += '      </ram:SellerTradeParty>\n';

        // Buyer
        if (kunde) {
            xml += '      <ram:BuyerTradeParty>\n'
                 + '        <ram:Name>' + esc(kunde.firma || kunde.ansprechpartner || '') + '</ram:Name>\n';
            if (kunde.ansprechpartner && kunde.firma) {
                xml += '        <ram:DefinedTradeContact>\n'
                     + '          <ram:PersonName>' + esc(kunde.ansprechpartner) + '</ram:PersonName>\n'
                     + '        </ram:DefinedTradeContact>\n';
            }
            xml += '        <ram:PostalTradeAddress>\n'
                 + '          <ram:PostcodeCode>' + esc(kunde.plz || '') + '</ram:PostcodeCode>\n'
                 + '          <ram:LineOne>' + esc(kunde.strasse || '') + '</ram:LineOne>\n'
                 + '          <ram:CityName>' + esc(kunde.ort || '') + '</ram:CityName>\n'
                 + '          <ram:CountryID>' + esc(kunde.land || 'DE') + '</ram:CountryID>\n'
                 + '        </ram:PostalTradeAddress>\n';
            if (kunde.email) {
                xml += '        <ram:URIUniversalCommunication>\n'
                     + '          <ram:URIID schemeID="EM">' + esc(kunde.email) + '</ram:URIID>\n'
                     + '        </ram:URIUniversalCommunication>\n';
            }
            if (kunde.ustIdNr) {
                xml += '        <ram:SpecifiedTaxRegistration>\n'
                     + '          <ram:ID schemeID="VA">' + esc(kunde.ustIdNr) + '</ram:ID>\n'
                     + '        </ram:SpecifiedTaxRegistration>\n';
            }
            xml += '      </ram:BuyerTradeParty>\n';
        }

        // BuyerReference (Leitweg-ID — optional but recommended for B2G)
        if (inv.leitwegId) {
            xml += '      <ram:BuyerReference>' + esc(inv.leitwegId) + '</ram:BuyerReference>\n';
        }

        xml += '    </ram:ApplicableHeaderTradeAgreement>\n';

        // ── ApplicableHeaderTradeDelivery ────────────────────────────────
        xml += '    <ram:ApplicableHeaderTradeDelivery>\n';
        if (inv.lieferdatum || inv.lieferVon) {
            var delivDate = inv.lieferdatum || inv.lieferVon;
            xml += '      <ram:ActualDeliverySupplyChainEvent>\n'
                 + '        <ram:OccurrenceDateTime>\n'
                 + '          <udt:DateTimeString format="102">' + isoDate(delivDate) + '</udt:DateTimeString>\n'
                 + '        </ram:OccurrenceDateTime>\n'
                 + '      </ram:ActualDeliverySupplyChainEvent>\n';
        }
        xml += '    </ram:ApplicableHeaderTradeDelivery>\n';

        // ── ApplicableHeaderTradeSettlement ──────────────────────────────
        xml += '    <ram:ApplicableHeaderTradeSettlement>\n'
             + '      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>\n';

        // Payment reference
        xml += '      <ram:PaymentReference>' + esc(inv.nummer) + '</ram:PaymentReference>\n';

        // Payment means (SEPA credit transfer)
        if (settings.iban) {
            xml += '      <ram:SpecifiedTradeSettlementPaymentMeans>\n'
                 + '        <ram:TypeCode>58</ram:TypeCode>\n'
                 + '        <ram:PayeePartyCreditorFinancialAccount>\n'
                 + '          <ram:IBANID>' + esc(settings.iban.replace(/\s/g, '')) + '</ram:IBANID>\n'
                 + '        </ram:PayeePartyCreditorFinancialAccount>\n';
            if (settings.bic) {
                xml += '        <ram:PayeeSpecifiedCreditorFinancialInstitution>\n'
                     + '          <ram:BICID>' + esc(settings.bic.replace(/\s/g, '')) + '</ram:BICID>\n'
                     + '        </ram:PayeeSpecifiedCreditorFinancialInstitution>\n';
            }
            xml += '      </ram:SpecifiedTradeSettlementPaymentMeans>\n';
        }

        // Tax breakdown per rate (Regelsatz-Positionen, Kategorie S)
        Object.keys(t.mwstMap).sort(function (a, b) { return a - b; }).forEach(function (rate) {
            var mwstAmt = t.mwstMap[rate];
            var taxBase = t.lineItems
                .filter(function (li) { return li.mwstRate == rate; })
                .reduce(function (s, li) { return s + li.lineNetto; }, 0);
            xml += '      <ram:ApplicableTradeTax>\n'
                 + '        <ram:CalculatedAmount>' + amt(mwstAmt) + '</ram:CalculatedAmount>\n'
                 + '        <ram:TypeCode>VAT</ram:TypeCode>\n'
                 + '        <ram:BasisAmount>' + amt(taxBase) + '</ram:BasisAmount>\n'
                 + '        <ram:CategoryCode>S</ram:CategoryCode>\n'
                 + '        <ram:RateApplicablePercent>' + parseFloat(rate).toFixed(2) + '</ram:RateApplicablePercent>\n'
                 + '      </ram:ApplicableTradeTax>\n';
        });

        // 0%-Kategorien getrennt nach tatsächlichem Steuertatbestand (Kleinunternehmer E, ig.
        // Lieferung K, Reverse Charge AE, Ausfuhr G, sonstige Befreiung E) — NICHT mehr pauschal
        // eine einzige "E"-Zeile für alles, was 0% ist (BR-E-10/BR-AE-10/BR-K-10/BR-G-10 verlangen
        // je Kategorie einen eigenen ExemptionReason).
        Object.keys(t.catMap).sort().forEach(function (code) {
            var cm = t.catMap[code];
            xml += '      <ram:ApplicableTradeTax>\n'
                 + '        <ram:CalculatedAmount>0.00</ram:CalculatedAmount>\n'
                 + '        <ram:TypeCode>VAT</ram:TypeCode>\n';
            if (cm.reason) {
                xml += '        <ram:ExemptionReason>' + esc(cm.reason) + '</ram:ExemptionReason>\n'
                     + (cm.reasonCode ? '        <ram:ExemptionReasonCode>' + cm.reasonCode + '</ram:ExemptionReasonCode>\n' : '');
            }
            xml += '        <ram:BasisAmount>' + amt(cm.basis) + '</ram:BasisAmount>\n'
                 + '        <ram:CategoryCode>' + code + '</ram:CategoryCode>\n'
                 + '        <ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>\n'
                 + '      </ram:ApplicableTradeTax>\n';
        });

        // Billing period
        if (inv.lieferVon && inv.lieferBis) {
            xml += '      <ram:BillingSpecifiedPeriod>\n'
                 + '        <ram:StartDateTime>\n'
                 + '          <udt:DateTimeString format="102">' + isoDate(inv.lieferVon) + '</udt:DateTimeString>\n'
                 + '        </ram:StartDateTime>\n'
                 + '        <ram:EndDateTime>\n'
                 + '          <udt:DateTimeString format="102">' + isoDate(inv.lieferBis) + '</udt:DateTimeString>\n'
                 + '        </ram:EndDateTime>\n'
                 + '      </ram:BillingSpecifiedPeriod>\n';
        }

        // Payment terms
        xml += '      <ram:SpecifiedTradePaymentTerms>\n'
             + '        <ram:Description>' + esc(inv.zahlungsbedingungen || 'Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt.') + '</ram:Description>\n';
        if (inv.faelligkeit) {
            xml += '        <ram:DueDateDateTime>\n'
                 + '          <udt:DateTimeString format="102">' + isoDate(inv.faelligkeit) + '</udt:DateTimeString>\n'
                 + '        </ram:DueDateDateTime>\n';
        }
        xml += '      </ram:SpecifiedTradePaymentTerms>\n';

        // Monetary summation
        xml += '      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>\n'
             + '        <ram:LineTotalAmount>'       + amt(t.nettoGesamt)    + '</ram:LineTotalAmount>\n'
             + '        <ram:TaxBasisTotalAmount>'   + amt(t.nettoGesamt)    + '</ram:TaxBasisTotalAmount>\n'
             + '        <ram:TaxTotalAmount currencyID="EUR">' + amt(t.totalMwst) + '</ram:TaxTotalAmount>\n'
             + '        <ram:GrandTotalAmount>'      + amt(t.bruttoGesamt)   + '</ram:GrandTotalAmount>\n'
             + '        <ram:DuePayableAmount>'      + amt(t.bruttoGesamt)   + '</ram:DuePayableAmount>\n'
             + '      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>\n';

        xml += '    </ram:ApplicableHeaderTradeSettlement>\n';
        xml += '  </rsm:SupplyChainTradeTransaction>\n';
        xml += '</rsm:CrossIndustryInvoice>\n';

        return xml;
    }

    /** Resolve settings (rechnungen-tab overrides global) */
    function mergeSettings() {
        var base = Store.getSettings ? Store.getSettings() : {};
        var ud   = Store.getRechUnternehmen ? Store.getRechUnternehmen() : {};
        var merged = Object.assign({}, base);
        Object.keys(ud).forEach(function (k) {
            if (ud[k] !== '' && ud[k] !== null && ud[k] !== undefined) merged[k] = ud[k];
        });
        if (ud.inhaber) merged.name = ud.inhaber;
        merged.ustMode = base.ustMode;
        return merged;
    }

    // Pflichtfeld-Check vor dem Export (§14 Abs.4/§14a UStG) — der XML-Generator selbst würde
    // fehlende Felder klaglos als leere Tags ausgeben statt zu warnen. Prüft nur, was für die
    // Rechtsgültigkeit zwingend ist; ersetzt keine vollständige KoSIT-/Schematron-Validierung.
    function validatePflichtfelder(inv, settings, kunde) {
        var missing = [];
        if (!inv.nummer) missing.push('Rechnungsnummer');
        if (!inv.datum) missing.push('Rechnungsdatum');
        if (!(settings.firmenname || settings.name)) missing.push('Ausstellername');
        if (!settings.adresse) missing.push('Ausstelleradresse');
        if (!settings.steuernummer && !settings.ustId) missing.push('Steuernummer oder USt-IdNr. des Ausstellers');
        if (!kunde) missing.push('Empfänger (Kunde)');
        else {
            if (!(kunde.firma || kunde.ansprechpartner)) missing.push('Empfängername');
            if (!kunde.strasse && !kunde.plz) missing.push('Empfängeradresse');
        }
        if (!(inv.positionen && inv.positionen.length)) missing.push('mindestens eine Rechnungsposition');
        return missing;
    }

    /** Download XRechnung XML for the given invoice */
    function download(inv) {
        if (!inv) { Utils.showToast('Keine Rechnung ausgewählt', 'warning'); return; }
        var settings = mergeSettings();
        var customers = Store.getRechCustomers ? Store.getRechCustomers() : [];
        var kunde = customers.find(function (c) { return c.id === inv.kundeId; }) || null;

        var missing = validatePflichtfelder(inv, settings, kunde);
        if (missing.length) {
            Utils.showToast('XRechnung unvollständig — es fehlen: ' + missing.join(', '), 'error', 8000);
            return;
        }

        var xml = generate(inv, settings, kunde);
        var safeNr = (inv.nummer || inv.id).replace(/[^a-zA-Z0-9_\-]/g, '_');
        var filename = 'XRechnung_' + safeNr + '.xml';
        Utils.downloadFile(xml, filename, 'application/xml; charset=utf-8');
        Utils.showToast('XRechnung exportiert: ' + filename + ' — Pflichtfelder geprüft, aber KEINE vollständige KoSIT-/Schematron-Validierung. Vor produktivem Versand mit dem offiziellen KoSIT-Validator prüfen.', 'success', 7000);
    }

    return { generate: generate, download: download, validatePflichtfelder: validatePflichtfelder };
})();
