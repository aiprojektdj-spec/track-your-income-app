// Shopify-Buchung, reiner Kern (js/shopify-buchung.js): per require in Node geladen, OHNE
// Store, Retouren, DOM oder Netz. Belegt, dass die Buchungsregeln vom Speicherort unabhängig
// sind: Payload + Kontext rein, Vorschläge raus. Die Regeln selbst prüft vor allem
// test/test-shopify-import.js über den echten Store; hier stehen Kern-Eigenschaften.
'use strict';
const assert = require('assert');
const B = require('../js/shopify-buchung.js');

let fail = 0, pass = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n   ') : e)); }
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: erwartet ${b}, war ${a}`);
const SHOP = 'beispiel-shop.myshopify.com';
const regel = () => 'regel';
const order = o => Object.assign({
    id: 4711, name: '#1', financial_status: 'paid', currency: 'EUR', processed_at: '2026-06-01T12:00:00+02:00',
    taxes_included: true, shipping_address: { country_code: 'DE' }, payment_gateway_names: ['shopify_payments'],
    line_items: [{ id: 1, sku: 'L-1', title: 'Rock', quantity: 1, price: '80.00', tax_lines: [{ rate: 0.19, price: '12.77' }] },
                 { id: 2, sku: 'L-2', title: 'Tuch', quantity: 1, price: '20.00', tax_lines: [{ rate: 0.19, price: '3.19' }] }],
    shipping_lines: [{ price: '5.00', discounted_price: '5.00', tax_lines: [{ rate: 0.19, price: '0.80' }] }],
    refunds: []
}, o);

check('Kern lädt ohne Store/DOM und verändert seine Eingaben nicht', () => {
    assert.strictEqual(typeof B.plane, 'function');
    const o = order(), lager = [{ id: 'p1', artikelNr: 'L-1', status: 'verfuegbar', differenzbesteuert: true }];
    const vorher = JSON.stringify([o, lager]);
    B.plane(o, { shop: SHOP, ustModus: regel, lager });
    assert.strictEqual(JSON.stringify([o, lager]), vorher);
});
check('Ohne Steuerstatus im Kontext kein Vorschlag (keine stille Annahme)', () => {
    assert.strictEqual(B.plane(order(), { shop: SHOP }).status, 'pruefen');
});
check('Vorschlag: §25a-Teil und Regel-Teil, Summen und Gebühr exakt', () => {
    const p = B.plane(order(), { shop: SHOP, ustModus: regel, gebuehr: 2.5,
        lager: [{ id: 'p1', artikelNr: 'L-1', status: 'verfuegbar', differenzbesteuert: true }, { id: 'p2', artikelNr: 'L-2', status: 'verfuegbar' }] });
    assert.strictEqual(p.status, 'buchbar', p.gruende.join('; '));
    assert.deepStrictEqual(p.verkaeufe.map(v => v.quelle.teil), ['regel', '25a']);
    near(p.verkaeufe.reduce((s, v) => s + v.verkaufspreis + v.versandkostenKaeufer, 0), 105, 'Summe');
    near(p.verkaeufe.find(v => v.quelle.teil === '25a').versandkostenKaeufer, 4, 'Versand 80 %');
    near(p.verkaeufe.reduce((s, v) => s + (v.verkaufspreis + v.versandkostenKaeufer) * v.plattformgebuehrProzent / 100, 0), 2.5, 'Gebühr');
    assert.ok(p.hinweise.some(h => /§25a/.test(h)), 'Steuer auf §25a-Ware gemeldet');
});
check('Erstattungsvorschlag: schon gebuchte IDs übersprungen, Restock je Teil', () => {
    const o = order({ refunds: [
        { id: 'r1', created_at: '2026-06-05T10:00:00+02:00', refund_line_items: [{ line_item_id: 2, restock_type: 'return', subtotal: '20.00' }],
          transactions: [{ kind: 'refund', status: 'success', amount: '20.00' }] },
        { id: 'r0', created_at: '2026-06-04T10:00:00+02:00', transactions: [{ kind: 'refund', status: 'success', amount: '5.00' }] }
    ] });
    const verkaeufe = [
        { id: 's1', verkaufspreis: 20, versandkostenKaeufer: 1, quelle: { zeilen: { '2': 'p2' } } },
        { id: 's2', verkaufspreis: 80, versandkostenKaeufer: 4, quelle: { zeilen: { '1': 'p1' } } }
    ];
    const r = B.planeErstattungen(o, { shop: SHOP, verkaeufe, gebucht: ['r0'] });
    assert.strictEqual(r.erstattungen.length, 1);
    assert.deepStrictEqual(r.erstattungen[0], {
        saleId: 's1', datum: '2026-06-05', betrag: 20, ware: 'zurueck', artikelIds: ['p2'], notizen: 'Shopify-Erstattung #1',
        quelle: { art: 'shopify', shop: SHOP, orderId: '4711', refundId: 'r1' }
    });
});
check('Abgleich nur mit übergebenen Daten, fremder Shop und Stornos zählen nicht', () => {
    const v = { verkaufspreis: 50, versandkostenKaeufer: 0, plattformgebuehrProzent: 2, quelle: { art: 'shopify', shop: SHOP, orderId: '1' } };
    const tx = [{ typ: 'charge', orderId: 1, betrag: '50.00', gebuehr: '1.00', netto: '49.00' }];
    assert.ok(B.abgleichAuszahlung({ betrag: 49, transaktionen: tx }, { shop: SHOP, verkaeufe: [v] }).ok);
    assert.deepStrictEqual(B.abgleichAuszahlung({ betrag: 49, transaktionen: tx }, { shop: 'x.myshopify.com', verkaeufe: [v] }).fehlend, ['1']);
    assert.deepStrictEqual(B.abgleichAuszahlung({ betrag: 49, transaktionen: tx }, { shop: SHOP, verkaeufe: [Object.assign({ storniert: true }, v)] }).fehlend, ['1']);
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
process.exit(fail ? 1 : 0);
