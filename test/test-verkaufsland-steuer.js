// Land des Käufers (sale.land) mit Steuerfolge — Marktplatz-Verkäufe ohne Rechnung.
//
// Drei Regeln, alle an echtem Modulcode geprüft (utils.js, steuer-berechnung.js, oss.js,
// ustvoranmeldung.js im selben Kontext):
// 1. EU-Privatkäufer zählen zur §3c-Schwelle (10.000 €, EU-weit, zusammen mit Rechnungen).
//    Ab dem Verkauf, der sie überschreitet, raus aus der UStVA, Ziellandsatz in EÜR/OSS.
// 2. §25a-Verkäufe zählen nie (§25a Abs. 7 Nr. 3 UStG) und bleiben deutsch versteuert.
// 3. Drittland nur MIT Ausfuhrnachweis steuerfrei (Kz. 43), sonst deutsche USt.
'use strict';
const fs = require('fs');
const vm = require('vm');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}
function block(name, fn) {
    try { fn(); }
    catch (e) { total++; console.error('✗ FAIL ' + name + ' bricht ab: ' + e.message); process.exitCode = 1; }
}
const rund = n => Math.round(n * 100) / 100;

function lade(d) {
    d = Object.assign({ sales: [], purchases: [], retouren: [], invoices: [], customers: [], ustMode: 'regel', art: 'soll' }, d);
    const kv = {};
    const Store = {
        getSettings: () => ({ ustMode: d.ustMode, ustVersteuerungsart: d.art }),
        getSales: (inkl) => inkl ? d.sales : d.sales.filter(s => !s.storniert),
        getPurchases: () => d.purchases, getExpenses: () => [], getRetouren: () => d.retouren,
        getRechInvoices: () => d.invoices, getRechCustomers: () => d.customers,
        getDifferenzVortrag: () => 0, setDifferenzVortrag() {}, getUstPerioden: () => [],
        get: k => kv[k], set: (k, v) => { kv[k] = v; }
    };
    const toasts = [];
    const ctx = {
        console, Intl, Store, window: {},
        localStorage: { getItem: () => null, setItem() {} },
        document: {
            getElementById: () => null, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), body: { appendChild() {} }
        },
        MutationObserver: function () { this.observe = () => {}; }
    };
    vm.createContext(ctx);
    for (const f of ['utils.js', 'steuer-berechnung.js', 'oss.js', 'ustvoranmeldung.js']) {
        const name = { 'utils.js': 'Utils', 'steuer-berechnung.js': 'SteuerBerechnung', 'oss.js': 'OSS', 'ustvoranmeldung.js': 'UstVoranmeldung' }[f];
        vm.runInContext(fs.readFileSync(__dirname + '/../js/' + f, 'utf8') + `\nthis.${name} = ${name};`, ctx);
    }
    ctx.Utils.showToast = m => toasts.push(m);
    ctx.toasts = toasts;
    return ctx;
}

let n = 0;
const vk = (land, preis, datum, over) => Object.assign({ id: 's' + (++n), datum, verkaufspreis: preis, versandkostenKaeufer: 0, land }, over || {});

block('Schwelle', () => {
    // 3 × 4.165 € brutto nach FR = 3 × 3.500 € netto (19 %) → der dritte reißt die 10.000 €
    const a = vk('FR', 4165, '2026-02-01'), b = vk('FR', 4165, '2026-03-01'), c = vk('FR', 4165, '2026-04-01');
    const de = vk('DE', 1190, '2026-04-02'), ohne = vk('', 1190, '2026-04-03');
    const C = lade({ sales: [a, b, c, de, ohne] });
    check('Schwellensumme = netto mit deutschem Satz (10.500)', rund(C.OSS._jahresumsatz(2026)) === 10500);
    const ids = C.OSS._ueberSchwelleIds(2026);
    check('prospektiv: erst der dritte Verkauf ist OSS', !ids.has(a.id) && !ids.has(b.id) && ids.has(c.id));
    check('DE und ohne Land zählen nicht', !ids.has(de.id) && !ids.has(ohne.id));
    check('OSS-Teil FR mit Ziellandsatz 20 %: 4165/1,2', rund(C.OSS._calcLaenderOSS(2026).FR) === rund(4165 / 1.2));
    check('Hinweis: 1 Verkauf ohne Land', C.OSS._ohneLand(2026) === 1);

    // UStVA Q2 (Soll): c ist OSS → nicht drin; de + ohne bleiben drin (2 × 1.000 netto)
    const q2 = C.UstVoranmeldung._calcPeriode('2026-04-01', '2026-06-30');
    check('UStVA Q2: OSS-Verkauf nicht in Kz. 81', rund(q2.nettoUmsatz19) === 2000);
    const q1 = C.UstVoranmeldung._calcPeriode('2026-01-01', '2026-03-31');
    check('UStVA Q1: Verkäufe vor der Schwelle deutsch versteuert', rund(q1.nettoUmsatz19) === 7000);

    // Ist-Versteuerung: gleiche Abgrenzung
    const I = lade({ sales: [a, b, c, de, ohne], art: 'ist' });
    check('Ist-UStVA Q2: OSS-Verkauf ebenfalls draußen', rund(I.UstVoranmeldung._calcPeriode('2026-04-01', '2026-06-30').nettoUmsatz19) === 2000);

    // EÜR-Netting: c mit 20 %, Rest mit 19 %
    const net = C.SteuerBerechnung.nettoSales([a, c], true).netto;
    check('EÜR: OSS-Verkauf am Ziellandsatz genettet', rund(net) === rund(3500 + 4165 / 1.2));

    // Retoure auf den OSS-Verkauf mindert die deutsche UStVA nicht
    const R = lade({ sales: [a, b, c], retouren: [{ datum: '2026-05-01', saleId: c.id, erstattungBetrag: 1190 }] });
    check('Retoure eines OSS-Verkaufs nicht in der UStVA', rund(R.UstVoranmeldung._calcPeriode('2026-04-01', '2026-06-30').nettoUmsatz19) === 0);
});

block('Paragraph 25a', () => {
    const p = { id: 'p1', differenzbesteuert: true, einkaufspreis: 100 };
    const big = vk('FR', 20000, '2026-01-10', { purchaseId: 'p1' });
    const C = lade({ sales: [big], purchases: [p] });
    check('§25a-Verkauf zählt nicht zur Schwelle', C.OSS._jahresumsatz(2026) === 0);
    check('§25a-Verkauf nie OSS', C.OSS._ueberSchwelleIds(2026).size === 0);
});

block('Vorjahr', () => {
    const vj = vk('AT', 13000, '2025-06-01');
    const neu = vk('AT', 119, '2026-01-05');
    const C = lade({ sales: [vj, neu] });
    check('Vorjahr über Schwelle → ab dem ersten Euro OSS', C.OSS._ueberSchwelleIds(2026).has(neu.id));
});

block('Rechnung und Verkauf gemeinsam', () => {
    const inv = { id: 'i1', typ: 'rechnung', status: 'versendet', datum: '2026-01-15', kundeId: 'k1', positionen: [{ menge: 1, einzelpreis: 9000 }] };
    const s = vk('IT', 1785, '2026-02-01');   // 1.500 netto → zusammen 10.500
    const C = lade({ sales: [s], invoices: [inv], customers: [{ id: 'k1', land: 'IT' }] });
    check('Rechnungen und Marktplatz-Verkäufe teilen eine Schwelle', C.OSS._ueberSchwelleIds(2026).has(s.id));
});

block('Ausfuhr', () => {
    const mit = vk('CH', 238, '2026-05-01', { ausfuhrnachweis: true });
    const ohne = vk('US', 119, '2026-05-02');
    const C = lade({ sales: [mit, ohne] });
    const q = C.UstVoranmeldung._calcPeriode('2026-04-01', '2026-06-30');
    check('Drittland mit Nachweis: Kz. 43 = voller Preis', rund(q.nettoAusfuhr) === 238);
    check('Drittland ohne Nachweis: deutsche USt', rund(q.nettoUmsatz19) === 100);
    check('EÜR: Ausfuhr ohne USt genettet', rund(C.SteuerBerechnung.nettoSales([mit], true).netto) === 238);
    const eu = vk('FR', 119, '2026-05-03', { ausfuhrnachweis: true });
    check('Ausfuhrnachweis bei EU-Land wirkungslos', C.SteuerBerechnung._sondersatz(eu, {}) === null);
});

block('Kleinunternehmer', () => {
    const a = vk('NL', 6000, '2026-03-01'), b = vk('NL', 6000, '2026-04-01');
    const C = lade({ sales: [a, b], ustMode: 'klein' });
    check('KU: Preis = Entgelt (12.000 > Schwelle)', C.OSS._jahresumsatz(2026) === 12000 && C.OSS._schwelleUeberschritten(2026));
    C.OSS.checkSchwelle();
    // Jahr der Prüfung = aktuelles Jahr; nur auswerten, wenn es 2026 ist
    if (new Date().getFullYear() === 2026) {
        check('KU: einmaliger Hinweis zur §19-Befreiung', C.toasts.length === 1 && /Kleinunternehmer/.test(C.toasts[0]));
        C.OSS.checkSchwelle();
        check('Hinweis kommt nur einmal pro Jahr', C.toasts.length === 1);
    }
});

console.log(`\n${pass}/${total} bestanden`);
