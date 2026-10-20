// Rechnungs-Pflichtangaben und XRechnung-Schemareihenfolge (Steuer-Audit 2026-10-18, B1/B2/B5).
//   node test/test-rechnung-pflichtangaben-audit.js
// Sollwerte: §14 Abs.4 S.1 Nr.6 UStG (Leistungszeitpunkt), §14a Abs.1/3 UStG (USt-IdNr. beider
// Seiten bei RC/ig. Lieferung), UN/CEFACT CII D16B (BuyerReference erstes Kind von
// HeaderTradeAgreement; ExemptionReasonCode nach CategoryCode).
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

const SELLER = { firmenname: 'Muster Handel', name: 'Muster Handel', adresse: 'Weg 1', plz: '10115', ort: 'Berlin',
    land: 'DE', steuernummer: '27/123/45678', ustId: 'DE123456789', iban: 'DE02120300000000202051',
    email: 'info@muster.de', telefon: '+49301234', ustMode: 'regel' };
function welt(settings) {
    const mem = {};
    const localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
    const Utils = { todayISO: () => '2026-10-19', formatDate: x => x || '', escapeHtml: s => String(s == null ? '' : s),
        formatNumber: n => String(n), formatCurrency: n => (parseFloat(n) || 0).toFixed(2) + ' €',
        showToast() {}, isInPeriod: (x, s, e) => !!x && x >= s && x <= e };
    const c = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/store.js',
        'rechnungen/js/xrechnung.js', 'rechnungen/js/rechnung.js'],
        { localStorage, Utils, document: { getElementById: () => null } });
    c.Store.saveSettings(Object.assign({}, settings));
    c.Store.saveRechUnternehmen(Object.assign({}, settings));
    return c;
}
const kunde = (id, extra) => Object.assign({ id, firma: 'Kunde ' + id, strasse: 'Str 2', plz: '20095', ort: 'Hamburg', land: 'DE' }, extra || {});
const rechnung = extra => Object.assign({ id: 'r1', typ: 'rechnung', nummer: 'RE-2026-001', datum: '2026-10-19',
    status: 'offen', isKlein: false, kundeId: 'k1', leitwegId: 'KDNR-4711', datumsOption: 'faelligkeit',
    faelligkeit: '2026-11-02', positionen: [{ beschreibung: 'Beratung', menge: 1, einheit: 'Std.', einzelpreis: 100, mwstSatz: 19 }] }, extra || {});
let n = 0; const ok = t => { n++; console.log('✓ ' + t); };

// B1 — Standard-Datumsoption: PDF und XML mit Leistungszeitpunkt
{
    const c = welt(SELLER);
    const inv = rechnung();
    assert.ok(/Leistungsdatum.*entspricht Rechnungsdatum/.test(c.Rechnung.generatePreviewHtml(inv)), 'PDF ohne Leistungszeitpunkt');
    const xml = c.XRechnung.generate(inv, SELLER, kunde('k1'));
    assert.ok(/<ram:ActualDeliverySupplyChainEvent>[\s\S]*20261019/.test(xml), 'XML ohne BT-72');
    ok('B1: Option „Fälligkeit“ druckt Leistungsdatum, XML trägt BT-72 = Rechnungsdatum');
    const ang = c.XRechnung.generate(rechnung({ typ: 'angebot' }), SELLER, kunde('k1'));
    assert.ok(!/ActualDeliverySupplyChainEvent/.test(ang), 'Angebot ohne Lieferdatum');
    ok('B1: Angebot bekommt kein künstliches Lieferdatum');
}

// B2 — EU-Unternehmenskunde ohne eigene USt-IdNr.
{
    const nurStNr = Object.assign({}, SELLER, { ustId: '' });
    const kFR = kunde('kfr', { land: 'FR', ustIdNr: 'FR12345678901', ort: 'Paris', plz: '75001' });
    const inv = rechnung({ kundeId: 'kfr', positionen: [{ beschreibung: 'Montage', menge: 1, einzelpreis: 80, mwstSatz: 0, igArt: 'leistung' }] });
    const c = welt(nurStNr);
    assert.ok(c.XRechnung.validatePflichtfelder(inv, nurStNr, kFR).some(m => /USt-IdNr\. des Ausstellers/.test(m)), 'Export nicht blockiert');
    assert.ok(!c.XRechnung.validatePflichtfelder(inv, SELLER, kFR).some(m => /USt-IdNr\. des Ausstellers/.test(m)), 'mit USt-IdNr. darf nichts fehlen');
    assert.ok(!c.XRechnung.validatePflichtfelder(rechnung(), nurStNr, kunde('k1')).some(m => /USt-IdNr\. des Ausstellers/.test(m)), 'Inlandskunde: Steuernummer genügt');
    ok('B2: XRechnung an EU-Unternehmer verlangt die eigene USt-IdNr.');
    const src = require('fs').readFileSync(require('path').join(__dirname, '../rechnungen/js/rechnung.js'), 'utf8');
    assert.ok(/isEuB2B13b && \(typ === 'rechnung' \|\| typ === 'gutschrift'\) && !settings13b\.ustId/.test(src), 'Speicher-Sperre fehlt');
    ok('B2: Speichern blockiert ohne eigene USt-IdNr.');
}

// B5 — Schemareihenfolge
{
    const c = welt(SELLER);
    const kFR = kunde('kfr', { land: 'FR', ustIdNr: 'FR12345678901', ort: 'Paris', plz: '75001' });
    const xml = c.XRechnung.generate(rechnung({ kundeId: 'kfr', positionen: [{ beschreibung: 'Montage', menge: 1, einzelpreis: 80, mwstSatz: 0, igArt: 'leistung' }] }), SELLER, kFR);
    const agr = xml.slice(xml.indexOf('<ram:ApplicableHeaderTradeAgreement>'));
    assert.ok(agr.indexOf('<ram:BuyerReference>') < agr.indexOf('<ram:SellerTradeParty>'), 'BuyerReference muss vor SellerTradeParty stehen');
    const taxes = xml.match(/<ram:ApplicableTradeTax>[\s\S]*?<\/ram:ApplicableTradeTax>/g) || [];
    assert.ok(taxes.length >= 2, 'Steuerblöcke fehlen');
    taxes.filter(t => /ExemptionReasonCode/.test(t)).forEach(t => {
        assert.ok(t.indexOf('<ram:CategoryCode>') < t.indexOf('<ram:ExemptionReasonCode>'), 'ExemptionReasonCode vor CategoryCode');
        assert.ok(t.indexOf('<ram:ExemptionReasonCode>') < t.indexOf('<ram:RateApplicablePercent>'), 'ExemptionReasonCode nach RateApplicablePercent');
    });
    assert.ok(taxes.some(t => /ExemptionReasonCode/.test(t)), 'Kein Befreiungscode erzeugt');
    ok('B5: BuyerReference und ExemptionReasonCode in Schemareihenfolge');
}

console.log('\n' + n + '/5 Pflichtangaben-Tests bestanden');
