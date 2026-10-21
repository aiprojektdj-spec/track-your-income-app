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

// B3b — Dienstleistung an US-Unternehmen ist keine Ausfuhrlieferung (Kategorie G)
{
    const c = welt(SELLER);
    const kUS = kunde('kus', { land: 'US', ort: 'New York', plz: '10001' });
    const xml = c.XRechnung.generate(rechnung({ kundeId: 'kus', positionen: [
        { beschreibung: 'Beratung', menge: 1, einzelpreis: 1000, mwstSatz: 0, igArt: 'leistung' },
        { beschreibung: 'Ware', menge: 1, einzelpreis: 300, mwstSatz: 0, igArt: 'ware' }] }), SELLER, kUS);
    assert.ok(/§3a Abs\. 2 UStG/.test(xml), 'Leistung ohne Hinweis auf §3a Abs. 2');
    assert.ok(/<ram:CategoryCode>G<\/ram:CategoryCode>/.test(xml), 'Ware an Drittland bleibt Ausfuhr G');
    console.log('✓ B3b: Drittland-Dienstleistung als nicht steuerbar (§3a Abs. 2), Ware als Ausfuhr');
}

// B3a / B4 / B6 — Befreiungshinweis, Pflichtfelder, XRechnung-Kontakt und Lieferland
{
    const c = welt(SELLER);
    const kUS = kunde('kus', { land: 'US', ort: 'New York', plz: '10001' });
    c.Store.saveRechCustomer(kUS);
    const html = c.Rechnung.generatePreviewHtml(rechnung({ kundeId: 'kus', positionen: [{ beschreibung: 'Ware', menge: 1, einzelpreis: 300, mwstSatz: 0, igArt: 'ware' }] }));
    assert.ok(/Steuerfreie Ausfuhrlieferung/.test(html), 'PDF ohne Ausfuhr-Hinweis');
    c.Store.saveRechCustomer(kunde('k1'));
    const html2 = c.Rechnung.generatePreviewHtml(rechnung({ steuerbefreiung: 'Steuerfrei nach § 4 Nr. 14 UStG', positionen: [{ beschreibung: 'Behandlung', menge: 1, einzelpreis: 80, mwstSatz: 0 }] }));
    assert.ok(/Steuerfrei nach § 4 Nr\. 14 UStG/.test(html2), 'PDF ohne Befreiungsgrund');
    const src = require('fs').readFileSync(require('path').join(__dirname, '../rechnungen/js/rechnung.js'), 'utf8');
    assert.ok(/Grund der Steuerbefreiung angeben/.test(src) && /Deine Anschrift ist unvollst/.test(src) && /braucht eine Beschreibung der Leistung/.test(src), 'Speicher-Prüfungen fehlen');
    console.log('✓ B3a/B4: Befreiungshinweise im PDF, Speichern prüft Grund, Anschrift und Beschreibung');

    const fehlt = c.XRechnung.validatePflichtfelder(rechnung({ positionen: [{ beschreibung: '', menge: 1, einzelpreis: 10, mwstSatz: 19 }] }),
        Object.assign({}, SELLER, { telefon: '', iban: '' }), kunde('k1'));
    ['BT-153', 'BR-DE-6', 'BR-DE-1'].forEach(r => assert.ok(fehlt.some(m => m.indexOf(r) !== -1), r + ' nicht geprüft'));
    const kFR = kunde('kfr', { land: 'FR', ustIdNr: 'FR12345678901', ort: 'Paris', plz: '75001' });
    const xml = c.XRechnung.generate(rechnung({ kundeId: 'kfr', positionen: [{ beschreibung: 'Ware', menge: 1, einzelpreis: 50, mwstSatz: 0, igArt: 'ware' }] }), SELLER, kFR);
    assert.ok(/<ram:DefinedTradeContact>[\s\S]*<ram:CompleteNumber>\+49301234<\/ram:CompleteNumber>[\s\S]*<ram:EmailURIUniversalCommunication>/.test(xml), 'Verkäuferkontakt unvollständig');
    assert.ok(/<ram:ShipToTradeParty>[\s\S]*<ram:CountryID>FR<\/ram:CountryID>/.test(xml), 'Lieferland bei ig. Lieferung fehlt');
    console.log('✓ B6: XRechnung mit Verkäuferkontakt (Telefon/E-Mail), Lieferland bei ig. Lieferung, Pflichtprüfung');
}

// B8 / B9 — Storno mit Leistungsdatum des Originals, kein Storno für Angebote; Einzelpreis mit 4 Stellen
(async () => {
    const c = welt(SELLER);
    c.Store.saveRechCustomer(kunde('k1'));
    c.Store.saveRechInvoice(rechnung({ id: 'o1', status: 'versendet', datumsOption: 'lieferdatum', lieferdatum: '2026-03-05' }));
    const sr = await c.Store.createStornoRechnung('o1', 'Fehler');
    assert.ok(sr && sr.lieferdatum === '2026-03-05', 'Storno ohne Lieferdatum des Originals');
    assert.ok(/Lieferdatum/.test(c.Rechnung.generatePreviewHtml(sr)) && !/entspricht Rechnungsdatum/.test(c.Rechnung.generatePreviewHtml(sr)), 'Storno-PDF zeigt Stornodatum als Leistungsdatum');
    c.Store.saveRechInvoice(rechnung({ id: 'a1', typ: 'angebot', nummer: 'AN-2026-001' }));
    assert.strictEqual(await c.Store.createStornoRechnung('a1', 'x'), null, 'Angebot bekam eine Stornorechnung');
    console.log('✓ B8: Stornorechnung mit Lieferdatum 05.03.2026 des Originals; Angebote ohne Stornorechnung');
    const xml = c.XRechnung.generate(rechnung({ positionen: [{ beschreibung: 'Schraube', menge: 3, einzelpreis: 0.335, mwstSatz: 7 }] }), SELLER, kunde('k1'));
    assert.ok(/<ram:ChargeAmount>0\.335<\/ram:ChargeAmount>/.test(xml), 'BT-146 gerundet');
    assert.ok(/0,335/.test(c.Rechnung.generatePreviewHtml(rechnung({ positionen: [{ beschreibung: 'Schraube', menge: 3, einzelpreis: 0.335, mwstSatz: 7 }] }))), 'PDF-Einzelpreis gerundet');
    console.log('✓ B9: Einzelpreis 0,335 € in PDF und XRechnung (BT-146) ungerundet');
})().catch(e => { console.error(e); process.exit(1); });
