// Shopify-Import (Kern js/shopify-buchung.js + Adapter js/shopify-import.js) über den ECHTEN Store, Retouren, EÜR und UVA.
// Beispiel-Payloads im Format der Shopify-Webhooks orders/paid / orders/updated, anonymisiert:
// keine echten Shops, Kunden oder Adressen — nur Ländercodes.
//
// Invarianten: jede Shopify-Bestellung und jede Erstattung wird genau einmal gebucht;
// gemischte §25a-Bestellungen werden geteilt, die Teile summieren sich auf den Zahlbetrag;
// unklare Fälle werden nicht gebucht, sondern landen in 'pruefen'.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

let fail = 0, pass = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n   ') : e)); }
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: erwartet ${b}, war ${a}`);
const SHOP = 'beispiel-shop.myshopify.com';

function welt(settings) {
    const mem = {};
    const localStorage = { getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
    const DRITT = ['CH', 'GB', 'US', 'NO'];
    const Utils = {
        todayISO: () => '2026-10-21', isInPeriod: (x, s, e) => !!x && x >= s && x <= e, istDrittland: c => DRITT.indexOf(c) !== -1,
        getMonthName: () => 'M', formatDate: x => x, formatCurrency: n => String(n), escapeHtml: s => String(s == null ? '' : s),
        showToast() {}
    };
    const ctx = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/store.js', 'js/steuer-berechnung.js', 'js/euer.js',
        'js/ustvoranmeldung.js', 'js/retouren.js', 'js/shopify-buchung.js', 'js/shopify-import.js'],
        { localStorage, Utils, document: { getElementById: () => null, querySelectorAll: () => [] }, navigator: {} });
    // Wechsel auf Regelbesteuerung vor alle Testdaten legen (sonst gilt er erst ab heute)
    ctx.Store.saveSettings(settings || { ustMode: 'regel', _ustModeAb: '2020-01-01' });
    return ctx;
}
const euer = (ctx, y) => ctx.Euer._berechne(y, 0, 'jahr');
const sales = ctx => ctx.Store.getSales(true);

// Baukasten für anonymisierte Bestellungen
let nextId = 5000;
function zeile(o) {
    return Object.assign({
        id: nextId++, title: 'Artikel', sku: '', quantity: 1, price: '50.00', total_discount: '0.00',
        discount_allocations: [], gift_card: false, tax_lines: [{ rate: 0.19, price: '7.98' }]
    }, o);
}
function bestellung(o) {
    return Object.assign({
        id: 820000 + nextId++, name: '#' + (1000 + nextId), financial_status: 'paid', currency: 'EUR',
        processed_at: '2026-03-10T14:05:00+01:00', created_at: '2026-03-10T14:04:00+01:00',
        taxes_included: true, total_tip_received: '0.00', payment_gateway_names: ['shopify_payments'],
        shipping_address: { country_code: 'DE' }, billing_address: { country_code: 'DE' },
        line_items: [zeile()], shipping_lines: [{ price: '4.90', discounted_price: '4.90', tax_lines: [{ rate: 0.19, price: '0.78' }] }],
        refunds: []
    }, o);
}
function erstattung(o) {
    return Object.assign({
        id: 990000 + nextId++, processed_at: '2026-03-20T09:00:00+01:00', created_at: '2026-03-20T09:00:00+01:00',
        restock: false, refund_line_items: [], transactions: [{ kind: 'refund', status: 'success', amount: '10.00' }]
    }, o);
}
function artikel(ctx, nr, o) {
    return ctx.Store.savePurchase(Object.assign({
        datum: '2026-01-05', artikelNr: nr, marke: 'Marke', artikeltyp: 'Jacke', einkaufspreis: 20, anzahl: 1,
        status: 'verfuegbar', ustSatz: 0
    }, o));
}

// ── Grundfall ──
check('DE-Bestellung 19 %: ein Verkauf mit Ware, Versand, Land, Satz und Gebühr', () => {
    const ctx = welt();
    const r = ctx.ShopifyImport.importiere(bestellung(), { shop: SHOP, gebuehr: 1.65 });
    assert.strictEqual(r.status, 'gebucht', r.gruende.join('; '));
    const s = sales(ctx)[0];
    assert.strictEqual(sales(ctx).length, 1);
    near(s.verkaufspreis, 50, 'Ware');
    near(s.versandkostenKaeufer, 4.9, 'Versand');
    assert.strictEqual(s.steuersatz, 19);
    assert.strictEqual(s.land, 'DE');
    assert.strictEqual(s.ausfuhrnachweis, false);
    assert.strictEqual(s.verkaufsplattform, 'Shopify');
    assert.strictEqual(s.datum, '2026-03-10');
    near((s.verkaufspreis + s.versandkostenKaeufer) * s.plattformgebuehrProzent / 100, 1.65, 'Gebühr in EUR');
    assert.ok(!s.kaeufer, 'kein Käufername');
});
check('Datum = Shop-lokales Zahlungsdatum, kein UTC-Versatz (31.12. 23:30 +01:00)', () => {
    const ctx = welt();
    ctx.ShopifyImport.importiere(bestellung({ processed_at: '2026-12-31T23:30:00+01:00' }), { shop: SHOP });
    assert.strictEqual(sales(ctx)[0].datum, '2026-12-31');
});
check('Rabatt aus discount_allocations mindert den Warenwert', () => {
    const ctx = welt();
    ctx.ShopifyImport.importiere(bestellung({ line_items: [zeile({ quantity: 2, price: '30.00', discount_allocations: [{ amount: '6.00' }] })] }), { shop: SHOP });
    near(sales(ctx)[0].verkaufspreis, 54, 'Ware nach Rabatt');
});
check('Nettopreise (taxes_included=false): Steuer wird aufgeschlagen', () => {
    const ctx = welt();
    ctx.ShopifyImport.importiere(bestellung({
        taxes_included: false,
        line_items: [zeile({ price: '100.00', tax_lines: [{ rate: 0.19, price: '19.00' }] })],
        shipping_lines: [{ price: '5.00', discounted_price: '5.00', tax_lines: [{ rate: 0.19, price: '0.95' }] }]
    }), { shop: SHOP });
    near(sales(ctx)[0].verkaufspreis, 119, 'Ware brutto');
    near(sales(ctx)[0].versandkostenKaeufer, 5.95, 'Versand brutto');
});
check('EÜR: Zufluss = Zahlbetrag, Gebühr als Ausgabe', () => {
    const ctx = welt();
    ctx.ShopifyImport.importiere(bestellung(), { shop: SHOP, gebuehr: 1.65 });
    near(euer(ctx, 2026).gewinn, 54.9 - 1.65, 'Gewinn');
});

// ── Doppelimport ──
check('Doppelimport: gleicher Webhook zweimal → ein Verkauf, zweiter Lauf schon_importiert', () => {
    const ctx = welt();
    const o = bestellung();
    ctx.ShopifyImport.importiere(o, { shop: SHOP });
    const r2 = ctx.ShopifyImport.importiere(o, { shop: SHOP });
    assert.strictEqual(r2.status, 'schon_importiert');
    assert.strictEqual(sales(ctx).length, 1);
});
check('Stornierter Import entsteht beim nächsten Webhook nicht neu', () => {
    const ctx = welt();
    const o = bestellung();
    const s = ctx.ShopifyImport.importiere(o, { shop: SHOP }).verkaeufe[0];
    ctx.Store.stornoSale(s.id, 'Test');
    assert.strictEqual(ctx.ShopifyImport.importiere(o, { shop: SHOP }).status, 'schon_importiert');
    assert.strictEqual(sales(ctx).length, 1);
});
check('Gleiche Bestell-ID aus anderem Shop ist eine andere Bestellung', () => {
    const ctx = welt();
    const o = bestellung();
    ctx.ShopifyImport.importiere(o, { shop: SHOP });
    ctx.ShopifyImport.importiere(o, { shop: 'zweiter-shop.myshopify.com' });
    assert.strictEqual(sales(ctx).length, 2);
});

// ── Nicht buchen ──
check('Unbezahlt → warten, nichts gebucht', () => {
    const ctx = welt();
    assert.strictEqual(ctx.ShopifyImport.importiere(bestellung({ financial_status: 'pending' }), { shop: SHOP }).status, 'warten');
    assert.strictEqual(sales(ctx).length, 0);
});
check('Geschenkkarte, Trinkgeld, Gutschein-Zahlung, Fremdwährung, fehlende Shop-Domain → pruefen', () => {
    const faelle = [
        [bestellung({ line_items: [zeile({ gift_card: true, tax_lines: [] })] }), { shop: SHOP }],
        [bestellung({ total_tip_received: '2.00' }), { shop: SHOP }],
        [bestellung({ payment_gateway_names: ['gift_card', 'shopify_payments'] }), { shop: SHOP }],
        [bestellung({ currency: 'USD' }), { shop: SHOP }],
        [bestellung(), {}]
    ];
    faelle.forEach(([o, opts], i) => {
        const ctx = welt();
        const r = ctx.ShopifyImport.importiere(o, opts);
        assert.strictEqual(r.status, 'pruefen', 'Fall ' + i);
        assert.ok(r.gruende.length, 'Grund genannt, Fall ' + i);
        assert.strictEqual(sales(ctx).length, 0, 'nichts gebucht, Fall ' + i);
    });
});

// ── Lager ──
check('SKU = Artikelnummer → Lagerabgang, Verkauf verknüpft', () => {
    const ctx = welt();
    const p = artikel(ctx, 'A-100');
    const r = ctx.ShopifyImport.importiere(bestellung({ line_items: [zeile({ sku: 'A-100' })] }), { shop: SHOP });
    assert.strictEqual(r.status, 'gebucht', r.gruende.join('; '));
    assert.strictEqual(sales(ctx)[0].purchaseId, p.id);
    assert.strictEqual(ctx.Store.getPurchases().find(x => x.id === p.id).status, 'verkauft');
});
check('Zwei Lagerartikel in einer Bestellung → purchaseIds, beide verkauft', () => {
    const ctx = welt();
    const a = artikel(ctx, 'A-1'), b = artikel(ctx, 'A-2');
    ctx.ShopifyImport.importiere(bestellung({ line_items: [zeile({ sku: 'A-1' }), zeile({ sku: 'A-2' })] }), { shop: SHOP });
    assert.deepStrictEqual(Array.from(sales(ctx)[0].purchaseIds).sort(), [a.id, b.id].sort());
    assert.ok(ctx.Store.getPurchases().every(x => x.status === 'verkauft'));
});
check('Artikel schon verkauft oder Menge > Bestand → pruefen', () => {
    let ctx = welt();
    artikel(ctx, 'A-7', { status: 'verkauft' });
    assert.strictEqual(ctx.ShopifyImport.importiere(bestellung({ line_items: [zeile({ sku: 'A-7' })] }), { shop: SHOP }).status, 'pruefen');
    ctx = welt();
    artikel(ctx, 'A-8');
    assert.strictEqual(ctx.ShopifyImport.importiere(bestellung({ line_items: [zeile({ sku: 'A-8', quantity: 2 })] }), { shop: SHOP }).status, 'pruefen');
});
check('SKU ohne Treffer: ohne §25a im Lager buchen, mit §25a im Lager pruefen', () => {
    let ctx = welt();
    artikel(ctx, 'N-1');
    assert.strictEqual(ctx.ShopifyImport.importiere(bestellung({ line_items: [zeile({ sku: 'UNBEKANNT' })] }), { shop: SHOP }).status, 'gebucht');
    assert.ok(!sales(ctx)[0].purchaseId);
    ctx = welt();
    artikel(ctx, 'D-1', { differenzbesteuert: true });
    assert.strictEqual(ctx.ShopifyImport.importiere(bestellung({ line_items: [zeile({ sku: 'UNBEKANNT' })] }), { shop: SHOP }).status, 'pruefen');
    assert.strictEqual(sales(ctx).length, 0);
});

// ── §25a ──
check('Gemischte Bestellung §25a + normal → zwei Verkäufe, Versand anteilig, Summe = Zahlbetrag', () => {
    const ctx = welt();
    const d = artikel(ctx, 'D-1', { differenzbesteuert: true });
    const n = artikel(ctx, 'N-1');
    const o = bestellung({
        line_items: [zeile({ sku: 'D-1', price: '75.00', tax_lines: [] }), zeile({ sku: 'N-1', price: '25.00', tax_lines: [{ rate: 0.19, price: '3.99' }] })],
        shipping_lines: [{ price: '6.00', discounted_price: '6.00', tax_lines: [{ rate: 0.19, price: '0.96' }] }]
    });
    const r = ctx.ShopifyImport.importiere(o, { shop: SHOP, gebuehr: 3 });
    assert.strictEqual(r.status, 'gebucht', r.gruende.join('; '));
    const t25 = sales(ctx).find(s => s.quelle.teil === '25a');
    const reg = sales(ctx).find(s => s.quelle.teil === 'regel');
    assert.strictEqual(t25.purchaseId, d.id);
    assert.strictEqual(reg.purchaseId, n.id);
    near(t25.versandkostenKaeufer, 4.5, 'Versand §25a-Teil (75 %)');
    near(reg.versandkostenKaeufer, 1.5, 'Versand Regel-Teil (25 %)');
    near(sales(ctx).reduce((x, s) => x + s.verkaufspreis + s.versandkostenKaeufer, 0), 106, 'Summe');
    near(sales(ctx).reduce((x, s) => x + (s.verkaufspreis + s.versandkostenKaeufer) * s.plattformgebuehrProzent / 100, 0), 3, 'Gebühr gesamt');
    assert.strictEqual(t25.steuersatz, undefined, '§25a-Teil ohne Regelsatz');
    assert.strictEqual(reg.steuersatz, 19);
});
check('Steuer auf §25a-Ware ausgewiesen → Hinweis', () => {
    const ctx = welt();
    artikel(ctx, 'D-2', { differenzbesteuert: true });
    const r = ctx.ShopifyImport.importiere(bestellung({ line_items: [zeile({ sku: 'D-2' })] }), { shop: SHOP });
    assert.strictEqual(r.status, 'gebucht');
    assert.ok(r.hinweise.some(h => /§25a/.test(h)));
});

// ── Steuersätze ──
check('7 % + 19 % in einer Bestellung → steuersaetze, Versand zum Versandsatz', () => {
    const ctx = welt();
    ctx.ShopifyImport.importiere(bestellung({
        line_items: [zeile({ price: '21.40', tax_lines: [{ rate: 0.07, price: '1.40' }] }), zeile({ price: '59.50', tax_lines: [{ rate: 0.19, price: '9.50' }] })]
    }), { shop: SHOP });
    const s = sales(ctx)[0];
    assert.strictEqual(s.steuersatz, undefined);
    near(s.steuersaetze['7'], 21.4, '7 %-Anteil');
    near(s.steuersaetze['19'], 59.5 + 4.9, '19 %-Anteil inkl. Versand');
});
check('Kleinunternehmer: Satz 0, Hinweis wenn Shopify Steuer berechnet hat', () => {
    const ctx = welt({ ustMode: 'klein' });
    const r = ctx.ShopifyImport.importiere(bestellung(), { shop: SHOP });
    assert.strictEqual(sales(ctx)[0].steuersatz, 0);
    assert.ok(r.hinweise.some(h => /Kleinunternehmer/.test(h)));
});
check('Regelbesteuerung und keine Steuer berechnet → pruefen (Annahme)', () => {
    const ctx = welt();
    const r = ctx.ShopifyImport.importiere(bestellung({ line_items: [zeile({ tax_lines: [] })] }), { shop: SHOP });
    assert.strictEqual(r.status, 'pruefen');
});
check('Ziellandsatz 21 % (NL) → 19 % + Hinweis, Land NL', () => {
    const ctx = welt();
    const r = ctx.ShopifyImport.importiere(bestellung({
        shipping_address: { country_code: 'NL' },
        line_items: [zeile({ tax_lines: [{ rate: 0.21, price: '8.68' }] })]
    }), { shop: SHOP });
    assert.strictEqual(r.status, 'gebucht');
    assert.strictEqual(sales(ctx)[0].steuersatz, 19);
    assert.strictEqual(sales(ctx)[0].land, 'NL');
    assert.ok(r.hinweise.some(h => /21 %/.test(h)));
});
check('Drittland CH: land CH, kein Ausfuhrnachweis, Hinweis', () => {
    const ctx = welt();
    const r = ctx.ShopifyImport.importiere(bestellung({ shipping_address: { country_code: 'CH' } }), { shop: SHOP });
    assert.strictEqual(sales(ctx)[0].land, 'CH');
    assert.strictEqual(sales(ctx)[0].ausfuhrnachweis, false);
    assert.ok(r.hinweise.some(h => /Drittland/.test(h)));
});

// ── Erstattungen ──
check('Teil-Erstattung mit Restock → Retoure, Artikel wieder verfügbar, EÜR gemindert', () => {
    const ctx = welt();
    const p = artikel(ctx, 'A-5');
    const o = bestellung({ line_items: [zeile({ sku: 'A-5' })] });
    ctx.ShopifyImport.importiere(o, { shop: SHOP });
    const li = o.line_items[0].id;
    const vorher = euer(ctx, 2026).gewinn;
    o.financial_status = 'partially_refunded';
    o.refunds = [erstattung({ refund_line_items: [{ line_item_id: li, quantity: 1, restock_type: 'return', subtotal: '50.00', total_tax: '0' }],
        transactions: [{ kind: 'refund', status: 'success', amount: '50.00' }] })];
    const r = ctx.ShopifyImport.importiere(o, { shop: SHOP });
    assert.strictEqual(r.status, 'schon_importiert', r.gruende.join('; '));
    assert.strictEqual(r.erstattungen.length, 1);
    assert.strictEqual(r.erstattungen[0].ware, 'zurueck');
    assert.strictEqual(r.erstattungen[0].datum, '2026-03-20');
    assert.strictEqual(ctx.Store.getPurchases().find(x => x.id === p.id).status, 'verfuegbar');
    near(vorher - euer(ctx, 2026).gewinn, 50, 'EÜR um Erstattung gemindert (Zahlungsfluss, brutto)');
    assert.strictEqual(sales(ctx)[0].storniert, undefined, 'Verkauf bleibt Zufluss');
});
check('Erstattung doppelt geliefert (orders/updated) → genau eine Retoure', () => {
    const ctx = welt();
    const o = bestellung({ financial_status: 'partially_refunded', refunds: [erstattung()] });
    ctx.ShopifyImport.importiere(o, { shop: SHOP });
    ctx.ShopifyImport.importiere(o, { shop: SHOP });
    assert.strictEqual(ctx.Store.getRetouren().length, 1);
    near(ctx.Store.getRetouren()[0].erstattungBetrag, 10, 'Betrag');
});
check('Erstattung ohne Geldfluss oder fehlgeschlagen → keine Retoure', () => {
    const ctx = welt();
    ctx.ShopifyImport.importiere(bestellung({ refunds: [
        erstattung({ transactions: [] }),
        erstattung({ transactions: [{ kind: 'refund', status: 'failure', amount: '10.00' }] })
    ] }), { shop: SHOP });
    assert.strictEqual(ctx.Store.getRetouren().length, 0);
});
check('Erstattung auf geteilte Bestellung: nach erstatteten Positionen, Summe stimmt', () => {
    const ctx = welt();
    artikel(ctx, 'D-3', { differenzbesteuert: true });
    artikel(ctx, 'N-3');
    const o = bestellung({
        line_items: [zeile({ sku: 'D-3', price: '60.00', tax_lines: [] }), zeile({ sku: 'N-3', price: '40.00' })],
        shipping_lines: []
    });
    const liN = o.line_items[1].id;
    o.refunds = [erstattung({ refund_line_items: [{ line_item_id: liN, quantity: 1, restock_type: 'no_restock', subtotal: '40.00', total_tax: '0' }],
        transactions: [{ kind: 'refund', status: 'success', amount: '40.00' }] })];
    const r = ctx.ShopifyImport.importiere(o, { shop: SHOP });
    assert.strictEqual(r.status, 'gebucht', r.gruende.join('; '));
    const reg = sales(ctx).find(s => s.quelle.teil === 'regel');
    const ret = ctx.Store.getRetouren();
    assert.strictEqual(ret.length, 1, 'nur der Regel-Teil bekommt die Erstattung');
    assert.strictEqual(ret[0].saleId, reg.id);
    assert.strictEqual(ret[0].ware, 'keine');
    near(ret[0].erstattungBetrag, 40, 'Betrag');
});
check('Erstattung ohne Positionsbezug auf geteilte Bestellung → anteilig, Cent-genau', () => {
    const ctx = welt();
    artikel(ctx, 'D-4', { differenzbesteuert: true });
    artikel(ctx, 'N-4');
    ctx.ShopifyImport.importiere(bestellung({
        line_items: [zeile({ sku: 'D-4', price: '20.00', tax_lines: [] }), zeile({ sku: 'N-4', price: '10.00' })],
        shipping_lines: [],
        refunds: [erstattung({ transactions: [{ kind: 'refund', status: 'success', amount: '10.00' }] })]
    }), { shop: SHOP });
    const ret = ctx.Store.getRetouren();
    assert.strictEqual(ret.length, 2);
    near(ret.reduce((x, r) => x + r.erstattungBetrag, 0), 10, 'Summe');
});

// ── Gebühr nachtragen, Auszahlung ──
check('Gebühr nachtragen setzt den Prozentsatz am importierten Verkauf', () => {
    const ctx = welt();
    const o = bestellung();
    ctx.ShopifyImport.importiere(o, { shop: SHOP });
    assert.ok(ctx.ShopifyImport.gebuehrNachtragen(SHOP, o.id, 2.20).ok);
    const s = sales(ctx)[0];
    near((s.verkaufspreis + s.versandkostenKaeufer) * s.plattformgebuehrProzent / 100, 2.2, 'Gebühr');
    assert.strictEqual(ctx.ShopifyImport.gebuehrNachtragen(SHOP, 'gibtsnicht', 1).ok, false);
});
check('Auszahlungsabgleich: passt / fehlende Bestellung / Betragsabweichung / Sonstiges', () => {
    const ctx = welt();
    const a = bestellung(), b = bestellung({ financial_status: 'partially_refunded', refunds: [erstattung()] });
    ctx.ShopifyImport.importiere(a, { shop: SHOP, gebuehr: 1.65 });
    ctx.ShopifyImport.importiere(b, { shop: SHOP, gebuehr: 1.65 });
    const ok = ctx.ShopifyImport.abgleichAuszahlung(SHOP, { betrag: 106.5, transaktionen: [
        { typ: 'charge', orderId: a.id, betrag: '54.90', gebuehr: '1.65', netto: '53.25' },
        { typ: 'charge', orderId: b.id, betrag: '54.90', gebuehr: '1.65', netto: '53.25' }
    ] });
    assert.strictEqual(ok.ok, true, JSON.stringify(ok));
    const mitErst = ctx.ShopifyImport.abgleichAuszahlung(SHOP, { betrag: -10, transaktionen: [
        { typ: 'refund', orderId: b.id, betrag: '-10.00', gebuehr: '0', netto: '-10.00' }
    ] });
    assert.strictEqual(mitErst.ok, true, JSON.stringify(mitErst));
    const schlecht = ctx.ShopifyImport.abgleichAuszahlung(SHOP, { betrag: 100, transaktionen: [
        { typ: 'charge', orderId: a.id, betrag: '60.00', gebuehr: '1.65', netto: '58.35' },
        { typ: 'charge', orderId: 'fremd', betrag: '10.00', gebuehr: '0.30', netto: '9.70' },
        { typ: 'adjustment', orderId: null, betrag: '-5.00', gebuehr: '0', netto: '-5.00' }
    ] });
    assert.strictEqual(schlecht.ok, false);
    assert.deepStrictEqual(Array.from(schlecht.fehlend), ['fremd']);
    assert.strictEqual(schlecht.abweichungen[0].feld, 'betrag');
    assert.strictEqual(schlecht.sonstige.length, 1);
    near(schlecht.differenz, 100 - 63.05, 'Differenz Auszahlung');
});

// ── Abruf per GraphQL (Weg a) ──
function gqlBestellung(id, o) {
    const geld = a => ({ shopMoney: { amount: a } });
    return Object.assign({
        id: 'gid://shopify/Order/' + id, name: '#2001', processedAt: '2026-05-02T10:00:00+02:00', createdAt: '2026-05-02T09:59:00+02:00',
        displayFinancialStatus: 'PAID', currencyCode: 'EUR', taxesIncluded: true, paymentGatewayNames: ['shopify_payments'],
        totalTipReceivedSet: geld('0.0'), shippingAddress: { countryCodeV2: 'AT' }, billingAddress: { countryCodeV2: 'AT' },
        lineItems: { nodes: [{ id: 'gid://shopify/LineItem/71', sku: 'G-1', title: 'Hemd', quantity: 1, isGiftCard: false,
            originalUnitPriceSet: geld('40.0'), discountAllocations: [{ allocatedAmountSet: geld('5.0') }],
            taxLines: [{ rate: 0.19, priceSet: geld('5.59') }] }] },
        shippingLines: { nodes: [{ originalPriceSet: geld('4.9'), discountedPriceSet: geld('4.9'), taxLines: [{ rate: 0.19, priceSet: geld('0.78') }] }] },
        transactions: [{ kind: 'SALE', status: 'SUCCESS', fees: [{ amount: { amount: '1.20', currencyCode: 'EUR' } }] }],
        refunds: []
    }, o);
}
check('GraphQL → Webhook-Format: IDs ohne gid, Beträge, Status, Land, Gebühr', () => {
    const ctx = welt();
    const { order, gebuehr } = ctx.ShopifyBuchung.ausGraphQL(gqlBestellung(777));
    assert.strictEqual(order.id, '777');
    assert.strictEqual(order.financial_status, 'paid');
    assert.strictEqual(order.line_items[0].id, '71');
    assert.strictEqual(order.shipping_address.country_code, 'AT');
    near(gebuehr, 1.2, 'Gebühr');
    const r = ctx.ShopifyImport.importiere(order, { shop: SHOP, gebuehr });
    assert.strictEqual(r.status, 'gebucht', r.gruende.join('; '));
    near(sales(ctx)[0].verkaufspreis, 35, 'Ware nach Rabatt');
    assert.ok(!/email|firstName|address1/i.test(JSON.stringify(order)), 'keine Personendaten');
});
check('Doppelimport über beide Wege: erst Webhook (Weg b), dann Abruf (Weg a) → ein Verkauf', () => {
    const ctx = welt();
    ctx.ShopifyImport.importiere(bestellung({ id: 778 }), { shop: SHOP });
    const seite = ctx.ShopifyImport.importiereSeite(SHOP, { data: { orders: { nodes: [gqlBestellung(778)], pageInfo: { hasNextPage: false } } } });
    assert.strictEqual(seite.ergebnisse[0].status, 'schon_importiert');
    assert.strictEqual(sales(ctx).length, 1);
    assert.strictEqual(seite.weiter, null);
});
check('Abruf-Seite: Erstattung aus GraphQL gebucht, Cursor weitergereicht, Gebühr nachgetragen', () => {
    const ctx = welt();
    const geld = a => ({ shopMoney: { amount: a } });
    ctx.ShopifyImport.importiereSeite(SHOP, { data: { orders: { nodes: [gqlBestellung(779, { transactions: [] })], pageInfo: { hasNextPage: true, endCursor: 'c1' } } } });
    near(sales(ctx)[0].plattformgebuehrProzent, 0, 'erst ohne Gebühr');
    const n = gqlBestellung(779, { displayFinancialStatus: 'PARTIALLY_REFUNDED', refunds: [{ id: 'gid://shopify/Refund/9', createdAt: '2026-05-09T08:00:00+02:00',
        refundLineItems: { nodes: [] }, transactions: { nodes: [{ kind: 'REFUND', status: 'SUCCESS', amountSet: geld('10.0') }] } }] });
    const seite = ctx.ShopifyImport.importiereSeite(SHOP, { data: { orders: { nodes: [n], pageInfo: { hasNextPage: true, endCursor: 'c2' } } } });
    assert.strictEqual(seite.weiter, 'c2');
    assert.strictEqual(ctx.Store.getRetouren().length, 1);
    assert.strictEqual(ctx.Store.getRetouren()[0].datum, '2026-05-09');
    const s = sales(ctx)[0];
    near((s.verkaufspreis + s.versandkostenKaeufer) * s.plattformgebuehrProzent / 100, 1.2, 'Gebühr nachgetragen');
    assert.strictEqual(ctx.ShopifyImport.importiereSeite(SHOP, { errors: [{}] }).fehler, 'Unerwartete Antwort');
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
