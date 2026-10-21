// ============================================
// Shopify-Import — Adapter des Rechenkerns js/shopify-buchung.js auf den lokalen Store
// ============================================
// Die Buchungsregeln (freigegeben 2026-10-21) und alle Annahmen stehen im Kern. Hier steht nur,
// was den heutigen Speicherort betrifft: Kontext aus dem Store lesen, Vorschläge über
// Store.saveSale/saveSaleMulti und Retouren.buche buchen, Doppelimport über sale.quelle /
// retoure.quelle erkennen. Ein künftiger Server-Weg ersetzt diese Datei, nicht den Kern.
//
// Stornierte Verkäufe zählen beim Doppelimport-Schutz mit — ein bewusst stornierter Import
// darf beim nächsten Abruf nicht wieder entstehen.
// ============================================
const ShopifyImport = {
    _kontext(shop, gebuehr) {
        const settings = Store.getSettings() || {};
        return {
            shop, gebuehr,
            ustModus: d => (typeof SteuerStatus !== 'undefined' && SteuerStatus.modeAm)
                ? SteuerStatus.modeAm(d, settings) : ((settings.ustMode || 'klein') === 'klein' ? 'klein' : 'regel'),
            lager: Store.getPurchases(),
            istDrittland: (typeof Utils !== 'undefined' && Utils.istDrittland) ? c => Utils.istDrittland(c) : null
        };
    },

    _verkaeufe(shop, orderId) {
        return Store.getSales(true).filter(s => s.quelle && s.quelle.art === 'shopify'
            && s.quelle.shop === shop && s.quelle.orderId === String(orderId));
    },
    _erstattungsIds(shop, orderId) {
        return Store.getRetouren().filter(r => r.quelle && r.quelle.art === 'shopify'
            && r.quelle.shop === shop && r.quelle.orderId === String(orderId)).map(r => r.quelle.refundId);
    },

    // Plan ohne Schreiben (Vorschau)
    plane(order, opts) {
        opts = opts || {};
        return ShopifyBuchung.plane(order, this._kontext(opts.shop, opts.gebuehr));
    },

    // Bucht eine Bestellung samt neuer Erstattungen. Mehrfach aufrufbar: Verkäufe und
    // Erstattungen entstehen je Shopify-ID genau einmal.
    // Rückgabe: { status: 'gebucht'|'schon_importiert'|'warten'|'pruefen', gruende[], hinweise[],
    //            verkaeufe[], erstattungen[] }
    importiere(order, opts) {
        opts = opts || {};
        const vorhanden = (opts.shop && order && order.id != null) ? this._verkaeufe(opts.shop, order.id) : [];
        let status, gruende = [], hinweise = [], verkaeufe = vorhanden;

        if (vorhanden.length) {
            status = 'schon_importiert';
        } else {
            const plan = this.plane(order, opts);
            gruende = plan.gruende; hinweise = plan.hinweise;
            if (plan.status !== 'buchbar') return { status: plan.status, gruende, hinweise, verkaeufe: [], erstattungen: [] };
            verkaeufe = [];
            for (const v of plan.verkaeufe) {
                const gespeichert = v.purchaseIds ? Store.saveSaleMulti(v) : Store.saveSale(v);
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

        const plan = ShopifyBuchung.planeErstattungen(order, {
            shop: opts.shop, verkaeufe: verkaeufe.filter(s => !s.storniert), gebucht: this._erstattungsIds(opts.shop, order.id)
        });
        const erstattungen = [];
        const fehler = plan.gruende.slice();
        plan.erstattungen.forEach(e => {
            const r = Retouren.buche({
                datum: e.datum, saleId: e.saleId, erstattungBetrag: e.betrag, ware: e.ware,
                artikelIds: e.artikelIds, notizen: e.notizen, quelle: e.quelle
            });
            if (r.ok) erstattungen.push(r.retoure);
            else fehler.push('Erstattung ' + e.quelle.refundId + ': ' + r.fehler);
        });
        gruende = gruende.concat(fehler);
        if (fehler.length && status === 'schon_importiert') status = 'pruefen';
        return { status, gruende, hinweise, verkaeufe, erstattungen };
    },

    // Gebühr nachträglich setzen (Shopify meldet sie oft nach der Bestellung).
    // Festgeschriebene Verkäufe bleiben unverändert und werden gemeldet.
    gebuehrNachtragen(shop, orderId, gebuehr) {
        const verkaeufe = this._verkaeufe(shop, orderId).filter(s => !s.storniert);
        const pct = ShopifyBuchung.gebuehrProzent(gebuehr, verkaeufe);
        if (!verkaeufe.length || !pct) return { ok: false, fehler: 'Bestellung nicht importiert' };
        const gesperrt = [];
        verkaeufe.forEach(s => {
            if (Math.abs((parseFloat(s.plattformgebuehrProzent) || 0) - pct) < 1e-9) return;
            if (Store.isLocked(s)) { gesperrt.push(s.id); return; }
            Store.saveSale(Object.assign({}, s, { plattformgebuehrProzent: pct }));
        });
        return gesperrt.length ? { ok: false, fehler: 'Verkauf festgeschrieben', gesperrt } : { ok: true };
    },

    // Eine Seite einer GraphQL-Antwort (orders-Connection) importieren — unabhängig davon,
    // wer sie geholt hat. Rückgabe: { ergebnisse[], weiter: Cursor|null }
    importiereSeite(shop, antwort) {
        const conn = antwort && antwort.data && antwort.data.orders;
        if (!conn) return { ergebnisse: [], weiter: null, fehler: 'Unerwartete Antwort' };
        const ergebnisse = ShopifyBuchung._nodes(conn).map(n => {
            const { order, gebuehr } = ShopifyBuchung.ausGraphQL(n);
            const r = this.importiere(order, { shop, gebuehr });
            if (r.status === 'schon_importiert' && gebuehr > 0) this.gebuehrNachtragen(shop, order.id, gebuehr);
            return Object.assign({ orderId: order.id, name: order.name }, r);
        });
        const pi = conn.pageInfo || {};
        return { ergebnisse, weiter: pi.hasNextPage ? pi.endCursor : null };
    },

    abgleichAuszahlung(shop, auszahlung) {
        return ShopifyBuchung.abgleichAuszahlung(auszahlung, {
            shop, verkaeufe: Store.getSales(true), erstattungen: Store.getRetouren()
        });
    }
};
