// ============================================
// Shopify-Import — Buchungslogik im Browser (Phase 2, plan/stackr-plan-rest-2026-10-07.md)
// ============================================
// Der Server sieht Bestellungen nur versiegelt; gebucht wird hier, im Browser des Nutzers.
// Eingang ist eine Bestellung im Format der Shopify-Webhooks orders/paid / orders/updated
// (JSON, Beträge als Strings in Shop-Währung, Steuersätze als Dezimalbruch 0.19).
//
// Buchungsregeln, vom User freigegeben am 2026-10-21 (Fragen 1–9):
//  1. Zufluss = Zahlungsdatum bei Shopify (processed_at), nicht die Auszahlung aufs Bankkonto.
//     Die Auszahlung wird nur abgeglichen (abgleichAuszahlung), nie gebucht.
//  2. Shopify-Payments-Gebühr je Bestellung als plattformgebuehrProzent am Verkauf (ohne
//     Vorsteuer, Zahlungsdienst). Abo-/App-Rechnungen von Shopify bleiben manuelle Ausgaben.
//  3. Erstattung = Retoure (Retouren.buche): Verkauf bleibt Zufluss, Erstattung zum eigenen Datum.
//     Ware 'zurueck' bei Shopify-Restock, sonst 'keine'.
//  4. Geschenkkarten und Trinkgeld werden nicht automatisch gebucht → Status 'pruefen'.
//  5. SKU ohne Lagertreffer: Verkauf ohne Lagerverknüpfung. Hat die Firma §25a-Artikel im
//     Lager → 'pruefen' statt buchen (sonst würde §25a-Ware regelbesteuert).
//  6. Gemischte Bestellung (§25a + normal): zwei Verkäufe; Versand des Käufers anteilig nach
//     Warenwert. Grund: die Auswertungen werten einen Verkauf als §25a, sobald EIN verknüpfter
//     Artikel §25a ist (js/datev.js, js/ustvoranmeldung.js, js/oss.js).
//  7. Steuersatz aus den tax_lines je Position, wenn er ein deutscher Satz ist; sonst 19 % +
//     Hinweis. OSS rechnet Stackr selbst aus land + Schwelle (js/oss.js). Kleinunternehmer: 0 %.
//  8. Drittland: land setzen, ausfuhrnachweis = false (Shopify liefert keinen Nachweis).
//  9. Nur bezahlte Bestellungen; andere Zahlarten → Gebühr 0 (nicht in den Shopify-Daten).
//
// Annahmen (nicht Teil der Freigabe, stehen auch im Commit):
//  - Regelbesteuerung und Shopify hat 0 % berechnet (keine tax_lines): 'pruefen'. Ein 0-%-Satz
//    am Verkauf hieße "keine deutsche USt" — falsch bei Drittland ohne Ausfuhrnachweis (Regel 8),
//    und ob 7 oder 19 % gälte, steht nicht in den Daten.
//  - Bestellung mit Geschenkkarte als ZAHLUNGSmittel: 'pruefen' (der Zufluss lag beim
//    Gutscheinverkauf, voller Betrag wäre in der EÜR doppelt).
//  - Andere Währung als EUR: 'pruefen'.
//  - SKU-Treffer, aber Artikel schon verkauft oder Menge > Lagerbestand des Artikels: 'pruefen'.
//  - Erstattung auf zwei Teilverkäufe: nach Zwischensumme der erstatteten Positionen, ohne
//    Positionsbezug nach Bruttobetrag der Teilverkäufe; Rundungscent auf den letzten Teil.
//  - Ein Käufername wird nicht übernommen (Datensparsamkeit), nur das Land.
//
// Doppelimport-Schutz: sale.quelle = { art:'shopify', shop, orderId, teil } und
// retoure.quelle = { art:'shopify', shop, orderId, refundId }. Stornierte Verkäufe zählen mit —
// ein bewusst stornierter Import darf beim nächsten Webhook nicht wieder entstehen.
// ============================================
const ShopifyImport = {
    PLATTFORM: 'Shopify',
    _BEZAHLT: ['paid', 'partially_refunded', 'refunded'],

    // Deutsche USt-Sätze (§12 UStG) — Jahresfunktion nach Regel 7 der CLAUDE.md
    _deSaetze(year) {
        return [0, 7, 19];
    },

    _num(x) { const n = parseFloat(x); return Number.isFinite(n) ? n : 0; },
    _r2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; },

    // Datum in Shop-Zeitzone: Shopify liefert "2026-10-01T23:30:00+02:00" — die Datumsstelle IST
    // das Shop-lokale Datum. Kein new Date()/toISOString (würde nach UTC verschieben).
    _datum(ts) {
        const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(ts || ''));
        return m ? m[1] : '';
    },

    _istKlein(datum) {
        const settings = Store.getSettings() || {};
        if (typeof SteuerStatus !== 'undefined' && SteuerStatus.modeAm) return SteuerStatus.modeAm(datum, settings) === 'klein';
        return (settings.ustMode || 'klein') === 'klein';
    },

    // Satz in Prozent aus tax_lines (Summe, falls mehrere), auf 2 Stellen
    _satz(taxLines) {
        const r = (taxLines || []).reduce((s, t) => s + this._num(t.rate), 0);
        return Math.round(r * 10000) / 100;
    },
    _steuer(taxLines) {
        return (taxLines || []).reduce((s, t) => s + this._num(t.price), 0);
    },

    _zeileBrutto(li, taxesIncluded) {
        const menge = this._num(li.quantity);
        const rabatt = Array.isArray(li.discount_allocations) && li.discount_allocations.length
            ? li.discount_allocations.reduce((s, d) => s + this._num(d.amount), 0)
            : this._num(li.total_discount);
        const brutto = this._num(li.price) * menge - rabatt;
        return taxesIncluded ? brutto : brutto + this._steuer(li.tax_lines);
    },
    _versandBrutto(sl, taxesIncluded) {
        const preis = sl.discounted_price != null ? this._num(sl.discounted_price) : this._num(sl.price);
        return taxesIncluded ? preis : preis + this._steuer(sl.tax_lines);
    },

    _vorhandeneVerkaeufe(shop, orderId) {
        return Store.getSales(true).filter(s => s.quelle && s.quelle.art === 'shopify'
            && s.quelle.shop === shop && s.quelle.orderId === String(orderId));
    },
    _erstattungGebucht(shop, refundId) {
        return Store.getRetouren().some(r => r.quelle && r.quelle.art === 'shopify'
            && r.quelle.shop === shop && r.quelle.refundId === String(refundId));
    },

    // Plan ohne Schreiben: was würde gebucht, und warum ggf. nicht.
    // opts: { shop (myshopify-Domain, Pflicht), gebuehr (EUR, optional) }
    // Rückgabe: { status: 'buchbar'|'warten'|'pruefen', gruende[], hinweise[], verkaeufe[] }
    plane(order, opts) {
        opts = opts || {};
        const gruende = [], hinweise = [];
        const ergebnis = status => ({ status, gruende, hinweise, verkaeufe: status === 'buchbar' ? verkaeufe : [] });
        let verkaeufe = [];

        if (!opts.shop) { gruende.push('Shop-Domain fehlt'); return ergebnis('pruefen'); }
        if (!order || order.id == null) { gruende.push('Bestellung ohne ID'); return ergebnis('pruefen'); }
        if (this._BEZAHLT.indexOf(order.financial_status) === -1) {
            gruende.push('Noch nicht bezahlt (' + (order.financial_status || 'unbekannt') + ')');
            return ergebnis('warten');
        }
        const datum = this._datum(order.processed_at || order.created_at);
        if (!datum) { gruende.push('Zahlungsdatum fehlt'); return ergebnis('pruefen'); }
        if ((order.currency || '') !== 'EUR') gruende.push('Währung ' + (order.currency || 'unbekannt') + ' statt EUR');

        const items = order.line_items || [];
        if (!items.length) gruende.push('Bestellung ohne Positionen');
        if (items.some(li => li.gift_card)) gruende.push('Enthält eine Geschenkkarte (Gutschein, USt erst bei Einlösung)');
        if (this._num(order.total_tip_received) > 0) gruende.push('Enthält Trinkgeld');
        if ((order.payment_gateway_names || []).some(g => /gift.?card/i.test(g))) {
            gruende.push('Mit Geschenkkarte bezahlt (Zufluss lag beim Gutscheinverkauf)');
        }

        const klein = this._istKlein(datum);
        const taxIncl = order.taxes_included !== false;
        const deSaetze = this._deSaetze(parseInt(datum.slice(0, 4), 10));
        const purchases = Store.getPurchases();
        const hat25a = purchases.some(p => p.differenzbesteuert);
        const benutzt = {};

        // Positionen → Gruppe 'regel' oder '25a'
        const gruppen = { regel: [], '25a': [] };
        items.forEach(li => {
            const sku = String(li.sku || '').trim();
            const p = sku ? purchases.find(x => String(x.artikelNr || '').trim() === sku) : null;
            const titel = li.title || sku || 'Position';
            if (p) {
                if (p.status === 'verkauft') gruende.push('Artikel ' + sku + ' ist im Lager schon verkauft');
                if (this._num(li.quantity) > (parseInt(p.anzahl, 10) || 1)) gruende.push('Menge von ' + sku + ' größer als im Lager');
                if (benutzt[p.id]) gruende.push('Artikel ' + sku + ' steht doppelt in der Bestellung');
                benutzt[p.id] = true;
            } else if (hat25a) {
                gruende.push('SKU ' + (sku || '(leer)') + ' nicht im Lager — bei §25a-Ware manuell zuordnen');
            }
            const satz = this._satz(li.tax_lines);
            gruppen[p && p.differenzbesteuert ? '25a' : 'regel'].push({
                lineId: String(li.id), titel, purchase: p, satz, steuer: this._steuer(li.tax_lines),
                brutto: this._zeileBrutto(li, taxIncl)
            });
        });

        const versandZeilen = order.shipping_lines || [];
        const versand = versandZeilen.reduce((s, sl) => s + this._versandBrutto(sl, taxIncl), 0);
        const versandSatz = versandZeilen.length ? this._satz(versandZeilen[0].tax_lines) : 0;
        const versandSteuer = versandZeilen.reduce((s, sl) => s + this._steuer(sl.tax_lines), 0);
        const warenGesamt = gruppen.regel.concat(gruppen['25a']).reduce((s, z) => s + z.brutto, 0);

        const land = String((order.shipping_address && order.shipping_address.country_code)
            || (order.billing_address && order.billing_address.country_code) || '').toUpperCase();
        if (!land) hinweise.push('Kein Lieferland in der Bestellung');
        if (land && typeof Utils !== 'undefined' && Utils.istDrittland && Utils.istDrittland(land)) {
            hinweise.push('Drittland ' + land + ': ohne Ausfuhrnachweis deutsch versteuert — Nachweis am Verkauf setzen');
        }
        if (klein && (gruppen.regel.concat(gruppen['25a']).some(z => z.steuer > 0) || versandSteuer > 0)) {
            hinweise.push('Kleinunternehmer, aber Shopify hat Umsatzsteuer berechnet — Steuereinstellung im Shop prüfen');
        }
        if (gruppen['25a'].some(z => z.steuer > 0)) {
            hinweise.push('Auf §25a-Ware hat Shopify Steuer ausgewiesen — bei Differenzbesteuerung unzulässig (§25a Abs. 6 UStG)');
        }

        // Regelsatz je Position prüfen
        const satzFuer = (z, ist25a) => {
            if (klein || ist25a) return null;
            if (z.satz === 0) { gruende.push('Keine Steuer berechnet bei ' + z.titel + ' — Satz manuell festlegen'); return null; }
            if (deSaetze.indexOf(z.satz) === -1) {
                hinweise.push(z.titel + ': ' + z.satz + ' % ist kein deutscher Satz, 19 % angenommen (OSS rechnet Stackr selbst)');
                return 19;
            }
            return z.satz;
        };
        const versandSatzDE = (klein || !versandZeilen.length || versand === 0) ? null
            : (deSaetze.indexOf(versandSatz) !== -1 && versandSatz !== 0 ? versandSatz : null);

        const teile = Object.keys(gruppen).filter(k => gruppen[k].length);
        let versandRest = this._r2(versand);
        teile.forEach((teil, i) => {
            const zeilen = gruppen[teil];
            const ist25a = teil === '25a';
            const ware = this._r2(zeilen.reduce((s, z) => s + z.brutto, 0));
            const vAnteil = i === teile.length - 1 ? versandRest
                : this._r2(warenGesamt ? versand * ware / warenGesamt : 0);
            versandRest = this._r2(versandRest - vAnteil);

            const sale = {
                datum, verkaufsplattform: this.PLATTFORM, land, ausfuhrnachweis: false,
                verkaufspreis: ware, versandkostenKaeufer: vAnteil,
                plattformgebuehrProzent: 0, versandkostenVerkaufer: 0,
                notizen: 'Shopify ' + (order.name || order.id),
                quelle: {
                    art: 'shopify', shop: opts.shop, orderId: String(order.id), orderName: order.name || '', teil,
                    zeilen: zeilen.reduce((o, z) => { o[z.lineId] = z.purchase ? z.purchase.id : null; return o; }, {})
                }
            };
            const pids = zeilen.filter(z => z.purchase).map(z => z.purchase.id);
            if (pids.length === 1) sale.purchaseId = pids[0];
            else if (pids.length > 1) sale.purchaseIds = pids;
            const einzel = zeilen.length === 1 && zeilen[0].purchase;
            sale.marke = einzel ? (einzel.marke || '') : this.PLATTFORM;
            sale.artikeltyp = einzel ? (einzel.artikeltyp || '') : (zeilen.length + ' Artikel');
            sale.beschreibung = 'Shopify ' + (order.name || order.id) + ': ' + zeilen.map(z => z.titel).join(', ');

            if (klein) {
                sale.steuersatz = 0;
            } else if (!ist25a) {
                const jeSatz = {};
                zeilen.forEach(z => { const s = satzFuer(z, false); if (s !== null) jeSatz[s] = (jeSatz[s] || 0) + z.brutto; });
                if (vAnteil) {
                    // Versand ohne eigenen deutschen Satz folgt dem Hauptsatz der Ware (Nebenleistung)
                    const haupt = Object.keys(jeSatz).sort((a, b) => jeSatz[b] - jeSatz[a])[0];
                    const vs = versandSatzDE !== null ? versandSatzDE : (haupt !== undefined ? parseFloat(haupt) : null);
                    if (vs !== null) jeSatz[vs] = (jeSatz[vs] || 0) + vAnteil;
                }
                const saetze = Object.keys(jeSatz);
                if (saetze.length === 1) sale.steuersatz = parseFloat(saetze[0]);
                else if (saetze.length > 1) {
                    sale.steuersaetze = saetze.reduce((o, k) => { o[k] = this._r2(jeSatz[k]); return o; }, {});
                }
            }
            verkaeufe.push(sale);
        });

        // Gebühr (Regel 2): ein Prozentsatz für alle Teile, damit die Summe der Gebühr entspricht
        const gebuehr = this._num(opts.gebuehr);
        const gesamt = verkaeufe.reduce((s, v) => s + v.verkaufspreis + v.versandkostenKaeufer, 0);
        if (gebuehr > 0 && gesamt > 0) {
            const pct = Math.round(gebuehr / gesamt * 100 * 1e6) / 1e6;
            verkaeufe.forEach(v => { v.plattformgebuehrProzent = pct; });
        }

        return ergebnis(gruende.length ? 'pruefen' : 'buchbar');
    },

    // Bucht eine Bestellung samt neuer Erstattungen. Mehrfach aufrufbar (Webhook-Wiederholung,
    // orders/updated): Verkäufe und Erstattungen entstehen je Shopify-ID genau einmal.
    // Rückgabe: { status: 'gebucht'|'schon_importiert'|'warten'|'pruefen', gruende[], hinweise[],
    //            verkaeufe[], erstattungen[] }
    importiere(order, opts) {
        opts = opts || {};
        const vorhanden = (opts.shop && order && order.id != null) ? this._vorhandeneVerkaeufe(opts.shop, order.id) : [];
        let status, gruende = [], hinweise = [], verkaeufe = vorhanden;

        if (vorhanden.length) {
            status = 'schon_importiert';
        } else {
            const plan = this.plane(order, opts);
            gruende = plan.gruende; hinweise = plan.hinweise;
            if (plan.status !== 'buchbar') return { status: plan.status, gruende, hinweise, verkaeufe: [], erstattungen: [] };
            verkaeufe = [];
            for (const v of plan.verkaeufe) {
                const gespeichert = (v.purchaseIds ? Store.saveSaleMulti(v) : Store.saveSale(v));
                if (!gespeichert || !gespeichert.id) {
                    // Kein halber Import: schon angelegte Teilverkäufe zurücknehmen (offene Periode)
                    verkaeufe.forEach(s => Store.deleteSale(s.id));
                    gruende.push('Verkauf nicht gespeichert (Buchungslimit oder Sperre)');
                    return { status: 'pruefen', gruende, hinweise, verkaeufe: [], erstattungen: [] };
                }
                verkaeufe.push(gespeichert);
            }
            status = 'gebucht';
        }

        const erst = this._bucheErstattungen(order, opts.shop, verkaeufe.filter(s => !s.storniert));
        gruende = gruende.concat(erst.gruende);
        if (erst.gruende.length && status === 'schon_importiert') status = 'pruefen';
        return { status, gruende, hinweise, verkaeufe, erstattungen: erst.gebucht };
    },

    _bucheErstattungen(order, shop, verkaeufe) {
        const gebucht = [], gruende = [];
        if (!verkaeufe.length) return { gebucht, gruende };
        (order.refunds || []).forEach(rf => {
            if (this._erstattungGebucht(shop, rf.id)) return;
            const betrag = this._r2((rf.transactions || [])
                .filter(t => t.kind === 'refund' && t.status === 'success')
                .reduce((s, t) => s + this._num(t.amount), 0));
            if (betrag <= 0) return; // Restock ohne Geldfluss: nichts zu buchen
            const datum = this._datum(rf.processed_at || rf.created_at);
            if (!datum) { gruende.push('Erstattung ' + rf.id + ' ohne Datum'); return; }

            // Gewicht je Teilverkauf: erstattete Positionen, sonst Bruttobetrag
            const zeilen = rf.refund_line_items || [];
            const gewicht = verkaeufe.map(s => zeilen
                .filter(z => s.quelle && s.quelle.zeilen && (String(z.line_item_id) in s.quelle.zeilen))
                .reduce((x, z) => x + this._num(z.subtotal) + this._num(z.total_tax), 0));
            const summe = gewicht.reduce((a, b) => a + b, 0);
            const basis = summe > 0 ? gewicht
                : verkaeufe.map(s => this._num(s.verkaufspreis) + this._num(s.versandkostenKaeufer));
            const basisSumme = basis.reduce((a, b) => a + b, 0) || 1;

            let rest = betrag;
            verkaeufe.forEach((s, i) => {
                const anteil = i === verkaeufe.length - 1 ? this._r2(rest) : this._r2(betrag * basis[i] / basisSumme);
                rest = this._r2(rest - anteil);
                if (anteil <= 0) return;
                const zurueck = zeilen.filter(z => s.quelle.zeilen && s.quelle.zeilen[String(z.line_item_id)]
                    && (z.restock_type === 'return' || z.restock_type === 'cancel' || (z.restock_type == null && rf.restock)))
                    .map(z => s.quelle.zeilen[String(z.line_item_id)]);
                const r = Retouren.buche({
                    datum, saleId: s.id, erstattungBetrag: anteil,
                    ware: zurueck.length ? 'zurueck' : 'keine', artikelIds: zurueck,
                    notizen: 'Shopify-Erstattung ' + (order.name || order.id),
                    quelle: { art: 'shopify', shop, orderId: String(order.id), refundId: String(rf.id) }
                });
                if (r.ok) gebucht.push(r.retoure);
                else gruende.push('Erstattung ' + rf.id + ': ' + r.fehler);
            });
        });
        return { gebucht, gruende };
    },

    // Gebühr nachträglich setzen (Shopify meldet sie über die Saldo-Transaktionen, oft nach dem
    // Bestell-Webhook). Festgeschriebene Verkäufe bleiben unverändert und werden gemeldet.
    gebuehrNachtragen(shop, orderId, gebuehr) {
        const verkaeufe = this._vorhandeneVerkaeufe(shop, orderId).filter(s => !s.storniert);
        const gesamt = verkaeufe.reduce((x, s) => x + this._num(s.verkaufspreis) + this._num(s.versandkostenKaeufer), 0);
        if (!verkaeufe.length || gesamt <= 0) return { ok: false, fehler: 'Bestellung nicht importiert' };
        const pct = Math.round(this._num(gebuehr) / gesamt * 100 * 1e6) / 1e6;
        const gesperrt = [];
        verkaeufe.forEach(s => {
            if (Math.abs(this._num(s.plattformgebuehrProzent) - pct) < 1e-9) return;
            if (Store.isLocked(s)) { gesperrt.push(s.id); return; }
            Store.saveSale(Object.assign({}, s, { plattformgebuehrProzent: pct }));
        });
        return gesperrt.length ? { ok: false, fehler: 'Verkauf festgeschrieben', gesperrt } : { ok: true };
    },

    // ── Abruf per GraphQL Admin API (Pull-Weg a; Weg b liefert dasselbe Format per Webhook) ──
    // Die Abfrage holt nur, was die Buchung braucht: keine Namen, E-Mails oder Anschriften,
    // vom Lieferland abgesehen. Gebühr je Bestellung aus OrderTransaction.fees.
    // Versionsstand vor dem ersten Live-Test gegen einen Dev-Store prüfen.
    API_VERSION: '2026-10',
    BESTELL_QUERY: `query Bestellungen($first: Int!, $after: String, $query: String) {
  orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id name processedAt createdAt displayFinancialStatus currencyCode taxesIncluded
      paymentGatewayNames
      totalTipReceivedSet { shopMoney { amount } }
      shippingAddress { countryCodeV2 }
      billingAddress { countryCodeV2 }
      lineItems(first: 100) { nodes {
        id sku title quantity isGiftCard
        originalUnitPriceSet { shopMoney { amount } }
        discountAllocations { allocatedAmountSet { shopMoney { amount } } }
        taxLines { rate priceSet { shopMoney { amount } } }
      } }
      shippingLines(first: 10) { nodes {
        originalPriceSet { shopMoney { amount } }
        discountedPriceSet { shopMoney { amount } }
        taxLines { rate priceSet { shopMoney { amount } } }
      } }
      transactions(first: 20) { kind status fees { amount { amount currencyCode } } }
      refunds(first: 20) {
        id createdAt
        refundLineItems(first: 100) { nodes {
          lineItem { id } quantity restockType
          subtotalSet { shopMoney { amount } }
          totalTaxSet { shopMoney { amount } }
        } }
        transactions(first: 10) { nodes { kind status amountSet { shopMoney { amount } } } }
      }
    }
  }
}`,

    // gid://shopify/Order/123 → "123" (dieselbe ID wie im Webhook, damit der Doppelimport-
    // Schutz über beide Wege greift)
    _gid(g) { const m = /\/(\d+)$/.exec(String(g || '')); return m ? m[1] : String(g || ''); },
    _geld(set) { return set && set.shopMoney ? set.shopMoney.amount : '0'; },
    _nodes(c) { return Array.isArray(c) ? c : (c && Array.isArray(c.nodes) ? c.nodes : []); },

    // GraphQL-Bestellung → Webhook-Format (das, was plane()/importiere() lesen).
    // Rückgabe: { order, gebuehr } — gebuehr = Summe der Shopify-Payments-Gebühren in EUR
    // (andere Währung der Gebühr: nicht addiert, plane() meldet die Bestellwährung ohnehin).
    ausGraphQL(n) {
        const steuer = tl => (tl || []).map(t => ({ rate: t.rate, price: this._geld(t.priceSet) }));
        const lower = s => String(s || '').toLowerCase();
        const order = {
            id: this._gid(n.id), name: n.name, processed_at: n.processedAt, created_at: n.createdAt,
            financial_status: lower(n.displayFinancialStatus), currency: n.currencyCode,
            taxes_included: n.taxesIncluded !== false,
            total_tip_received: this._geld(n.totalTipReceivedSet),
            payment_gateway_names: n.paymentGatewayNames || [],
            shipping_address: n.shippingAddress ? { country_code: n.shippingAddress.countryCodeV2 } : null,
            billing_address: n.billingAddress ? { country_code: n.billingAddress.countryCodeV2 } : null,
            line_items: this._nodes(n.lineItems).map(li => ({
                id: this._gid(li.id), sku: li.sku || '', title: li.title, quantity: li.quantity,
                gift_card: !!li.isGiftCard, price: this._geld(li.originalUnitPriceSet),
                discount_allocations: (li.discountAllocations || []).map(d => ({ amount: this._geld(d.allocatedAmountSet) })),
                tax_lines: steuer(li.taxLines)
            })),
            shipping_lines: this._nodes(n.shippingLines).map(sl => ({
                price: this._geld(sl.originalPriceSet), discounted_price: this._geld(sl.discountedPriceSet),
                tax_lines: steuer(sl.taxLines)
            })),
            refunds: (n.refunds || []).map(rf => ({
                id: this._gid(rf.id), created_at: rf.createdAt, processed_at: rf.createdAt,
                refund_line_items: this._nodes(rf.refundLineItems).map(z => ({
                    line_item_id: this._gid(z.lineItem && z.lineItem.id), quantity: z.quantity,
                    restock_type: lower(z.restockType), subtotal: this._geld(z.subtotalSet), total_tax: this._geld(z.totalTaxSet)
                })),
                transactions: this._nodes(rf.transactions).map(t => ({ kind: lower(t.kind), status: lower(t.status), amount: this._geld(t.amountSet) }))
            }))
        };
        const gebuehr = this._r2((n.transactions || [])
            .filter(t => lower(t.kind) === 'sale' || lower(t.kind) === 'capture')
            .reduce((s, t) => s + (t.fees || []).reduce((x, f) => x + (f.amount && f.amount.currencyCode === 'EUR' ? this._num(f.amount.amount) : 0), 0), 0));
        return { order, gebuehr };
    },

    // Seite einer GraphQL-Antwort importieren. Gibt je Bestellung das Ergebnis von importiere()
    // zurück, plus den Cursor für die nächste Seite.
    importiereSeite(shop, antwort) {
        const conn = antwort && antwort.data && antwort.data.orders;
        if (!conn) return { ergebnisse: [], weiter: null, fehler: 'Unerwartete Antwort' };
        const ergebnisse = this._nodes(conn).map(n => {
            const { order, gebuehr } = this.ausGraphQL(n);
            const r = this.importiere(order, { shop, gebuehr });
            // Gebühr kann bei früherem Abruf noch gefehlt haben
            if (r.status === 'schon_importiert' && gebuehr > 0) this.gebuehrNachtragen(shop, order.id, gebuehr);
            return Object.assign({ orderId: order.id, name: order.name }, r);
        });
        const pi = conn.pageInfo || {};
        return { ergebnisse, weiter: pi.hasNextPage ? pi.endCursor : null };
    },

    // Auszahlungsabgleich (Regel 1: nur Abgleich, keine Buchung).
    // auszahlung: { betrag, transaktionen: [{ typ: 'charge'|'refund'|…, orderId, betrag, gebuehr, netto }] }
    // Beträge wie von Shopify: Erstattungen negativ.
    abgleichAuszahlung(shop, auszahlung) {
        const tx = (auszahlung && auszahlung.transaktionen) || [];
        const fehlend = [], abweichungen = [], sonstige = [];
        const nettoSumme = this._r2(tx.reduce((s, t) => s + this._num(t.netto), 0));
        tx.forEach(t => {
            if (t.typ === 'charge') {
                const v = this._vorhandeneVerkaeufe(shop, t.orderId).filter(s => !s.storniert);
                if (!v.length) { fehlend.push(String(t.orderId)); return; }
                const brutto = this._r2(v.reduce((s, x) => s + this._num(x.verkaufspreis) + this._num(x.versandkostenKaeufer), 0));
                const geb = this._r2(v.reduce((s, x) => s + (this._num(x.verkaufspreis) + this._num(x.versandkostenKaeufer)) * this._num(x.plattformgebuehrProzent) / 100, 0));
                if (Math.abs(brutto - this._r2(this._num(t.betrag))) > 0.005) abweichungen.push({ orderId: String(t.orderId), feld: 'betrag', stackr: brutto, shopify: this._r2(this._num(t.betrag)) });
                if (Math.abs(geb - this._r2(this._num(t.gebuehr))) > 0.005) abweichungen.push({ orderId: String(t.orderId), feld: 'gebuehr', stackr: geb, shopify: this._r2(this._num(t.gebuehr)) });
            } else if (t.typ === 'refund') {
                const erstattet = this._r2(Store.getRetouren()
                    .filter(r => r.quelle && r.quelle.art === 'shopify' && r.quelle.shop === shop && r.quelle.orderId === String(t.orderId))
                    .reduce((s, r) => s + this._num(r.erstattungBetrag), 0));
                if (!erstattet) fehlend.push(String(t.orderId));
                else if (erstattet + 0.005 < Math.abs(this._num(t.betrag))) abweichungen.push({ orderId: String(t.orderId), feld: 'erstattung', stackr: erstattet, shopify: Math.abs(this._r2(this._num(t.betrag))) });
            } else {
                sonstige.push(t); // Rückbuchung, Reserve, Korrektur: manuell prüfen
            }
        });
        const differenz = this._r2(this._num(auszahlung && auszahlung.betrag) - nettoSumme);
        return {
            ok: !fehlend.length && !abweichungen.length && !sonstige.length && Math.abs(differenz) < 0.005,
            differenz, fehlend, abweichungen, sonstige
        };
    }
};
