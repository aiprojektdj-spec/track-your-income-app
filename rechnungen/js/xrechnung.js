// ============================================================
// XRechnung / ZUGFeRD XML Generator
// Standard: EN 16931 — UN/CEFACT CII D16B (XRechnung 3.0)
// B2B-Empfangspflicht seit 01.01.2025 (§14 UStG i.V.m. WCG)
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

    /**
     * Build line-item & tax totals from invoice positionen.
     * Returns { lineItems, nettoGesamt, mwstMap, totalMwst, bruttoGesamt }
     */
    function calcTotals(positionen, isKlein) {
        var lineItems = [];
        var nettoGesamt = 0;
        var mwstMap = {};

        (positionen || []).forEach(function (pos, idx) {
            var menge   = parseFloat(pos.menge  || 1);
            var preis   = parseFloat(pos.einzelpreis || 0);
            var line    = menge * preis;
            var rate    = isKlein ? 0 : (parseInt(pos.mwstSatz) || 0);
            var lineMwst = line * rate / 100;
            nettoGesamt += line;
            if (rate > 0) {
                mwstMap[rate] = (mwstMap[rate] || 0) + lineMwst;
            }
            lineItems.push({
                pos:         idx + 1,
                beschreibung: pos.beschreibung || '',
                menge:       menge,
                einheit:     pos.einheit || 'Stück',
                einzelpreis: preis,
                lineNetto:   line,
                mwstRate:    rate
            });
        });

        var totalMwst = Object.keys(mwstMap).reduce(function (s, k) { return s + mwstMap[k]; }, 0);
        return {
            lineItems:    lineItems,
            nettoGesamt:  nettoGesamt,
            mwstMap:      mwstMap,
            totalMwst:    totalMwst,
            bruttoGesamt: nettoGesamt + totalMwst
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
        var isKlein = settings.ustMode === 'klein';
        var t = calcTotals(inv.positionen, isKlein);

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
            var catCode = (isKlein || li.mwstRate === 0) ? 'E' : 'S';
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
            if (isKlein) {
                xml += '          <ram:ExemptionReason>Umsatzsteuerbefreiung nach §19 UStG (Kleinunternehmer)</ram:ExemptionReason>\n'
                     + '          <ram:ExemptionReasonCode>VATEX-EU-O</ram:ExemptionReasonCode>\n';
            }
            xml += '          <ram:CategoryCode>' + catCode + '</ram:CategoryCode>\n'
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
            if (kunde.ustId) {
                xml += '        <ram:SpecifiedTaxRegistration>\n'
                     + '          <ram:ID schemeID="VA">' + esc(kunde.ustId) + '</ram:ID>\n'
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

        // Tax breakdown per rate
        var hasTax = false;
        Object.keys(t.mwstMap).sort(function (a, b) { return a - b; }).forEach(function (rate) {
            hasTax = true;
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

        // Exempt / Kleinunternehmer tax entry (always needed)
        if (isKlein || !hasTax) {
            xml += '      <ram:ApplicableTradeTax>\n'
                 + '        <ram:CalculatedAmount>0.00</ram:CalculatedAmount>\n'
                 + '        <ram:TypeCode>VAT</ram:TypeCode>\n';
            if (isKlein) {
                xml += '        <ram:ExemptionReason>Umsatzsteuerbefreiung nach §19 UStG (Kleinunternehmer)</ram:ExemptionReason>\n'
                     + '        <ram:ExemptionReasonCode>VATEX-EU-O</ram:ExemptionReasonCode>\n';
            }
            xml += '        <ram:BasisAmount>' + amt(t.nettoGesamt) + '</ram:BasisAmount>\n'
                 + '        <ram:CategoryCode>E</ram:CategoryCode>\n'
                 + '        <ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>\n'
                 + '      </ram:ApplicableTradeTax>\n';
        }

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

    /** Download XRechnung XML for the given invoice */
    function download(inv) {
        if (!inv) { Utils.showToast('Keine Rechnung ausgewählt', 'warning'); return; }
        var settings = mergeSettings();
        var customers = Store.getRechCustomers ? Store.getRechCustomers() : [];
        var kunde = customers.find(function (c) { return c.id === inv.kundeId; }) || null;

        var xml = generate(inv, settings, kunde);
        var safeNr = (inv.nummer || inv.id).replace(/[^a-zA-Z0-9_\-]/g, '_');
        var filename = 'XRechnung_' + safeNr + '.xml';
        Utils.downloadFile(xml, filename, 'application/xml; charset=utf-8');
        Utils.showToast('XRechnung exportiert: ' + filename, 'success');
    }

    return { generate: generate, download: download };
})();
