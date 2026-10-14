// Regression Audit 2026-10-13, L1/L2/L4 — Rückzahlung, Storno und Zahlungsdatum über den
// ECHTEN Store bis in EÜR und UVA.
//
// Invarianten: ein Geldfluss zählt genau einmal; Rückzahlung verändert keinen historischen
// Zufluss; Dokumentdatum, Leistungsdatum und Zahlungsdatum sind keine Ersatzwerte füreinander.
//
// Geladen: js/steuerstatus.js, js/store.js, js/steuer-berechnung.js, js/euer.js,
// js/ustvoranmeldung.js, js/retouren.js, js/storno-vorgang.js, rechnungen/js/dokumente.js.
// Simuliert: localStorage, DOM der Dialoge, Utils-Formatierung.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

let fail = 0, pass = 0;
const laeufe = [];
function check(name, fn) {
    laeufe.push((async () => {
        try { await fn(); pass++; console.log('✓ ' + name); }
        catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n   ') : e)); }
    }));
}
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: erwartet ${b}, war ${a}`);
const HEUTE = '2026-10-13';

// Fake-DOM für die Rechnungsdialoge: Body-HTML wird nach id/value gelesen, Klick-Handler gefangen.
function fakeDom() {
    const els = {};
    let html = '';
    const el = id => {
        if (!els[id]) {
            const m = html.match(new RegExp('id="' + id + '"[^>]*?value="([^"]*)"')) || html.match(new RegExp('value="([^"]*)"[^>]*id="' + id + '"'));
            els[id] = { id, value: m ? m[1] : '', checked: new RegExp('id="' + id + '"[^>]*checked').test(html), disabled: false, style: {},
                handlers: {}, addEventListener(t, f) { this.handlers[t] = f; },
                klick() { return this.handlers.click.call(this); } };
        }
        return els[id];
    };
    return {
        document: { getElementById: id => (html.indexOf('id="' + id + '"') !== -1 ? el(id) : null), querySelectorAll: () => [] },
        zeige(body, footer) { html = body + (footer || ''); Object.keys(els).forEach(k => delete els[k]); },
        el
    };
}

function welt(settings) {
    const mem = {};
    const localStorage = { getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
    const dom = fakeDom();
    const toasts = [];
    const Utils = {
        todayISO: () => HEUTE, isInPeriod: (x, s, e) => !!x && x >= s && x <= e, istDrittland: () => false,
        getMonthName: () => 'M', formatDate: x => x, formatCurrency: n => String(n), escapeHtml: s => String(s == null ? '' : s),
        showToast: (t, a) => toasts.push({ t, a }), getDateInputValue: id => (dom.el(id) || {}).value
    };
    const RechApp = { showModal: (t, b, f) => dom.zeige(b, f), closeModal() {}, navigate() {} };
    const ctx = ladeModule(['js/steuerstatus.js', 'js/store.js', 'js/steuer-berechnung.js', 'js/euer.js',
        'js/ustvoranmeldung.js', 'js/retouren.js', 'js/storno-vorgang.js', 'rechnungen/js/dokumente.js'],
        { localStorage, Utils, RechApp, document: dom.document, navigator: {} });
    ctx.Store.saveSettings(settings || { ustMode: 'klein' });
    ctx.toasts = toasts; ctx.dom = dom;
    return ctx;
}
const euer = (ctx, y) => ctx.Euer._berechne(y, 0, 'jahr');
const uva = (ctx, von, bis) => ctx.UstVoranmeldung._calcPeriode(von, bis);

// ── L4 ──
check('L4: 100 € Verkauf, 20 € echte Erstattung → EÜR 80 €, Verkauf bleibt aktiv', () => {
    const ctx = welt();
    const s = ctx.Store.saveSale({ datum: '2026-03-01', verkaufspreis: 100 });
    const r = ctx.Retouren.buche({ datum: '2026-04-01', saleId: s.id, erstattungBetrag: 20, ware: 'keine' });
    assert.ok(r.ok, r.fehler);
    near(euer(ctx, 2026).gewinn, 80, 'EÜR 2026');
    assert.strictEqual(ctx.Store.getSales().length, 1, 'Verkauf aktiv');
});
check('L4: Zufluss 20.12.2025, volle Rückzahlung 15.01.2026 → 2025 +100, 2026 −100', () => {
    const ctx = welt();
    const s = ctx.Store.saveSale({ datum: '2025-12-20', verkaufspreis: 100 });
    assert.ok(ctx.Retouren.buche({ datum: '2026-01-15', saleId: s.id, erstattungBetrag: 100, ware: 'keine' }).ok);
    near(euer(ctx, 2025).gewinn, 100, 'EÜR 2025');
    near(euer(ctx, 2026).gewinn, -100, 'EÜR 2026');
});
check('L4: unbeschädigte Rückgabe bringt den Artikel zurück, der Einkauf bleibt Ausgabe', () => {
    const ctx = welt();
    const p = ctx.Store.savePurchase({ datum: '2026-02-01', einkaufspreis: 40, anzahl: 1, status: 'verfuegbar' });
    const s = ctx.Store.saveSale({ datum: '2026-03-01', verkaufspreis: 100, purchaseId: p.id });
    assert.ok(ctx.Retouren.buche({ datum: '2026-04-01', saleId: s.id, erstattungBetrag: 100, ware: 'zurueck' }).ok);
    assert.strictEqual(ctx.Store.getPurchases().find(x => x.id === p.id).status, 'verfuegbar');
    near(euer(ctx, 2026).gewinn, -40, 'EÜR: 100 − 100 Erstattung − 40 Einkauf');
});

// ── L2 ──
check('L2: Schlusszahlung mit Datum 31.12.2025 → bezahltAm und Verkauf am 31.12.2025 (Erfassung am 13.10.2026)', async () => {
    const ctx = welt();
    const inv = ctx.Store.saveRechInvoice({ id: 'r1', typ: 'rechnung', nummer: 'RE-1', status: 'versendet', datum: '2025-12-20', isKlein: true,
        positionen: [{ menge: 1, einzelpreis: 100, mwstSatz: 0 }] });
    ctx.Dokumente.showTeilzahlungModal(inv.id);
    ctx.dom.el('teilzBetrag').value = '100';
    ctx.dom.el('teilzDatum').value = '2025-12-31';
    ctx.dom.el('confirmTeilzahlung').klick();
    // jetzt steht der Bezahlt-Dialog — mit dem übernommenen Datum
    assert.strictEqual(ctx.dom.el('bezahltDatum').value, '2025-12-31', 'Datum im Bestätigungsdialog sichtbar');
    ctx.dom.el('confirmBezahlt').klick();
    const gespeichert = ctx.Store.getRechInvoices().find(i => i.id === 'r1');
    assert.strictEqual(gespeichert.bezahltAm, '2025-12-31', 'bezahltAm');
    const sale = ctx.Store.getSales().find(x => x._invoiceId === 'r1');
    assert.strictEqual(sale.datum, '2025-12-31', 'Verkaufsdatum');
    near(euer(ctx, 2025).gewinn, 100, 'EÜR 2025');
    near(euer(ctx, 2026).gewinn, 0, 'EÜR 2026');
});
check('L2: direkte "Bezahlt"-Erfassung zeigt ein editierbares Datum, Doppelklick erzeugt keinen zweiten Verkauf', () => {
    const ctx = welt();
    const inv = ctx.Store.saveRechInvoice({ id: 'r2', typ: 'rechnung', nummer: 'RE-2', status: 'versendet', datum: '2026-09-01', isKlein: true,
        positionen: [{ menge: 1, einzelpreis: 50, mwstSatz: 0 }] });
    ctx.Dokumente.showBezahltModal(inv);
    assert.strictEqual(ctx.dom.el('bezahltDatum').value, HEUTE, 'Vorgabe heute');
    ctx.dom.el('bezahltDatum').value = '2026-09-30';
    const btn = ctx.dom.el('confirmBezahlt');
    btn.klick(); btn.klick();
    const sales = ctx.Store.getSales().filter(x => x._invoiceId === 'r2');
    assert.strictEqual(sales.length, 1, 'genau ein Verkauf');
    assert.strictEqual(sales[0].datum, '2026-09-30');
});

// ── L1 ──
async function bezahlteRechnung(ctx) {
    const p = ctx.Store.savePurchase({ datum: '2025-11-01', einkaufspreis: 40, anzahl: 1, status: 'verkauft' });
    const inv = ctx.Store.saveRechInvoice({ id: 'r9', typ: 'rechnung', nummer: 'RE-9', status: 'bezahlt', datum: '2025-12-10',
        bezahltAm: '2025-12-20', isKlein: false, positionen: [{ menge: 1, einzelpreis: 100, mwstSatz: 19, lagerArtikelId: p.id }] });
    ctx.Store.createSaleFromInvoice(inv, '', p.id, null);
    return { inv, p };
}
check('L1: Storno einer bezahlten Rechnung mit Rückzahlung im Januar — Zufluss 2025 bleibt, Rückzahlung 2026, Lager frei', async () => {
    const ctx = welt({ ustMode: 'regel', ustVersteuerungsart: 'soll' });
    const { inv, p } = await bezahlteRechnung(ctx);
    const res = await ctx.StornoVorgang.ausfuehren({ invoiceId: inv.id, grund: 'ware_zurueck',
        erstattung: { betrag: 119, datum: '2026-01-15' }, wareZurueck: true });
    assert.ok(res.ok, res.fehler);
    assert.strictEqual(ctx.Store.getRechInvoices().find(i => i.id === inv.id).status, 'storniert');
    assert.strictEqual(ctx.Store.getSales().filter(s => s._invoiceId === inv.id).length, 1, 'Verkauf bleibt (Zufluss)');
    assert.strictEqual(ctx.Store.getPurchases().find(x => x.id === p.id).status, 'verfuegbar', 'Artikel frei');
    near(euer(ctx, 2025).einnahmenNetto + euer(ctx, 2025).ustEinnahmen, 119, 'EÜR 2025 Einnahmen');
    near(euer(ctx, 2026).summeEinnahmen, -119, 'EÜR 2026 Rückzahlung');
    // Soll-UVA: Original Q4/2025, Stornorechnung (Datum heute) in Q4/2026
    near(uva(ctx, '2025-10-01', '2025-12-31').ust19, 19, 'UVA Q4/2025');
    near(uva(ctx, '2026-10-01', '2026-12-31').ust19, -19, 'UVA Q4/2026 Stornorechnung');
});
check('L1: Ist-UVA — Zufluss Q4/2025 +19, Rückzahlung Q1/2026 −19', async () => {
    const ctx = welt({ ustMode: 'regel', ustVersteuerungsart: 'ist' });
    const { inv } = await bezahlteRechnung(ctx);
    assert.ok((await ctx.StornoVorgang.ausfuehren({ invoiceId: inv.id, grund: 'ware_zurueck',
        erstattung: { betrag: 119, datum: '2026-01-15' }, wareZurueck: false })).ok);
    near(uva(ctx, '2025-10-01', '2025-12-31').ust19, 19, 'Q4/2025');
    near(uva(ctx, '2026-01-01', '2026-03-31').ust19, -19, 'Q1/2026');
});
check('L1: Storno ohne Rückzahlung erzeugt keinen fiktiven Geldabfluss', async () => {
    const ctx = welt({ ustMode: 'regel' });
    const { inv } = await bezahlteRechnung(ctx);
    assert.ok((await ctx.StornoVorgang.ausfuehren({ invoiceId: inv.id, grund: 'fehler', erstattung: null, wareZurueck: false })).ok);
    assert.strictEqual(ctx.Store.getRetouren().length, 0);
    near(euer(ctx, 2026).summeEinnahmen, 0, 'EÜR 2026');
    near(euer(ctx, 2025).summeEinnahmen, 119, 'EÜR 2025 unverändert');
});
check('L1: Rückzahlung über dem gezahlten Betrag wird vor jedem Schreiben abgewiesen; zweiter Storno abgewiesen', async () => {
    const ctx = welt({ ustMode: 'regel' });
    const { inv } = await bezahlteRechnung(ctx);
    const r1 = await ctx.StornoVorgang.ausfuehren({ invoiceId: inv.id, grund: 'fehler', erstattung: { betrag: 200, datum: '2026-01-15' } });
    assert.ok(!r1.ok);
    assert.strictEqual(ctx.Store.getRechInvoices().find(i => i.id === inv.id).status, 'bezahlt', 'nichts geschrieben');
    assert.ok((await ctx.StornoVorgang.ausfuehren({ invoiceId: inv.id, grund: 'fehler' })).ok);
    const r3 = await ctx.StornoVorgang.ausfuehren({ invoiceId: inv.id, grund: 'fehler' });
    assert.ok(!r3.ok, 'kein zweites Stornodokument');
    assert.strictEqual(ctx.Store.getRechInvoices().filter(i => i.typ === 'stornorechnung').length, 1);
});

(async () => {
    for (const l of laeufe) await l();
    console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
    if (fail) process.exit(1);
})();
