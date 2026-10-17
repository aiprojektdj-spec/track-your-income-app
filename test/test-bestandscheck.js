// Bestandscheck (js/bestandscheck.js): Altlasten aus der Zeit vor den Audit-Fixes vom 2026-10-15.
//
// Soll: Jede Fundart wird gefunden, saubere Daten schweigen, pruefe() ändert nichts. Eine
// Korrektur gibt es nur, wo sie eindeutig ist; sie wird über anwenden() einzeln übernommen,
// steht im Änderungsprotokoll, und festgeschriebene Vorgänge werden nicht geändert, sondern
// storniert (oder bleiben, wenn die Änderung nichts bewirkte).
//
// Altdaten werden so angelegt, wie der alte Code sie schrieb: Datensatz mit id direkt in den
// Speicher (kein Audit 'erstellt', kein createdAt, kein Steuerstatus) — genau das tat
// saveSale() im id-Zweig.
//
// Echter Code: js/steuerstatus.js, js/steuer-berechnung.js, js/store.js, js/bestandscheck.js.
// Simuliert: localStorage, Utils.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

// Arrays aus dem vm-Kontext haben einen fremden Prototyp — Inhalt vergleichen
const deq = (a, b, m) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, m);
let fail = 0, pass = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.stack || e)); }
}

function welt(settings) {
    const mem = {};
    const localStorage = { getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
    const Utils = { formatDate: x => x, formatCurrency: n => String(n), escapeHtml: s => String(s == null ? '' : s), showToast() {},
        todayISO: () => '2026-10-16', isInPeriod: (x, s, e) => !!x && x >= s && x <= e };
    const ctx = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/steuer-berechnung.js', 'js/store.js', 'js/bestandscheck.js'],
        { localStorage, Utils });
    ctx.Store.set('settings', settings || { ustMode: 'klein', ustModeHistorie: [{ ab: '0000-01-01', mode: 'klein' }, { ab: '2026-01-01', mode: 'regel' }] });
    // Altbestand ohne Store-Neuanlagepfad
    ctx.alt = (key, rec) => { const l = ctx.Store.get(key) || []; l.push(rec); ctx.Store.set(key, l); return rec; };
    ctx.funde = () => ctx.Bestandscheck.pruefe().funde;
    ctx.fund = art => ctx.funde().find(f => f.art === art);
    ctx.audit = id => ctx.Store.getAuditLog().filter(a => a.entityId === id);
    return ctx;
}
const ALLE = ['bank-dublette', 'teilzahlung-doppelt', 'retoure-alt', 'storno-alt', 'historie-unbelegt',
    'ohne-steuerstatus', 'ohne-steuersatz', 'ust-zahlung', 'verkauf-ohne-protokoll', 'material-verwaist'];

check('Saubere, über den Store angelegte Daten: keine Befunde', () => {
    const ctx = welt();
    const s = ctx.Store.saveSale({ datum: '2026-03-01', marke: 'A', artikeltyp: 'Jacke', verkaufspreis: 119, steuersatz: 19 });
    ctx.Store.savePurchase({ datum: '2026-02-01', marke: 'A', artikeltyp: 'Jacke', einkaufspreis: 20, status: 'verkauft' });
    ctx.Store.saveExpense({ datum: '2026-03-02', betrag: 10, kategorie: 'Versand', beschreibung: 'Porto' });
    ctx.Store.saveExpense({ datum: '2026-04-10', betrag: 300, kategorie: 'Umsatzsteuer an Finanzamt', beschreibung: 'UStVA Q1' });
    ctx.Store.bookMaterialVerbrauch([], '2026-03-01', 'verkauf', s.id, 'A Jacke');
    deq(ctx.funde().map(f => f.art), []);
});

check('pruefe() schreibt nichts', () => {
    const ctx = welt();
    ctx.alt('sales', { id: 'alt1', datum: '2026-03-01', marke: 'A', verkaufspreis: 50 });
    const vorher = JSON.stringify(ctx.Store._cache);
    ctx.Bestandscheck.pruefe();
    assert.strictEqual(JSON.stringify(ctx.Store._cache), vorher);
});

// ── 1. Bankimport-Dubletten ─────────────────────────────────────────────────────────────
function altImport(ctx, id, createdAt, extra) {
    return ctx.alt('expenses', Object.assign({ id, datum: '2026-04-10', betrag: 100, kategorie: 'Sonstiges', beschreibung: 'Bueromiete April',
        belegnummer: 'BANK-20260410', createdAt, _bankImport: true, ustBehandlung: 'regel' }, extra || {}));
}

check('Bank: derselbe Umsatz aus zwei Importläufen → zweiter ist Dublette mit Löschvorschlag', () => {
    const ctx = welt();
    altImport(ctx, 'e1', '2026-05-01T10:00:00Z');
    altImport(ctx, 'e2', '2026-06-01T10:00:00Z');
    const f = ctx.fund('bank-dublette');
    assert.strictEqual(f.eintraege.length, 1);
    assert.strictEqual(f.eintraege[0].korrektur.zielId, 'e2');
    const r = ctx.Bestandscheck.anwenden(f.eintraege[0].id);
    assert.ok(r.ok, r.fehler);
    deq(ctx.Store.getExpenses().map(e => e.id), ['e1']);
    assert.ok(ctx.audit('e2').some(a => a.action === 'loeschung'), 'Löschung protokolliert');
    assert.ok(!ctx.fund('bank-dublette'), 'nach der Korrektur kein Befund mehr');
});

check('Bank: zwei gleiche Zahlungen aus EINEM Importlauf sind keine Dublette', () => {
    const ctx = welt();
    altImport(ctx, 'e1', '2026-05-01T10:00:00Z');
    altImport(ctx, 'e2', '2026-05-01T10:00:01Z');
    assert.ok(!ctx.fund('bank-dublette'));
});

check('Bank: Lauf mit 2 echten + späterer Lauf mit 2 → genau zwei Dubletten', () => {
    const ctx = welt();
    altImport(ctx, 'e1', '2026-05-01T10:00:00Z'); altImport(ctx, 'e2', '2026-05-01T10:00:01Z');
    altImport(ctx, 'e3', '2026-06-01T10:00:00Z'); altImport(ctx, 'e4', '2026-06-01T10:00:01Z');
    deq(ctx.fund('bank-dublette').eintraege.map(e => e.korrektur.zielId).sort(), ['e3', 'e4']);
});

check('Bank: neue Importe mit Umsatzkennung (_bankTx) werden nicht gemeldet', () => {
    const ctx = welt();
    altImport(ctx, 'e1', '2026-05-01T10:00:00Z', { _bankTx: { key: 'ref:1' } });
    altImport(ctx, 'e2', '2026-06-01T10:00:00Z', { _bankTx: { key: 'ref:2' } });
    assert.ok(!ctx.fund('bank-dublette'));
});

check('Bank: ohne Importzeitpunkt nur Hinweis, kein Vorschlag', () => {
    const ctx = welt();
    altImport(ctx, 'e1', ''); altImport(ctx, 'e2', '');
    const f = ctx.fund('bank-dublette');
    assert.strictEqual(f.eintraege.length, 2);
    assert.ok(f.eintraege.every(e => !e.korrektur));
});

check('Bank: Dublette im festgeschriebenen Jahr wird storniert, nicht gelöscht', () => {
    const ctx = welt();
    altImport(ctx, 'e1', '2026-05-01T10:00:00Z');
    altImport(ctx, 'e2', '2026-06-01T10:00:00Z');
    ctx.Store.closeYear(2026);
    const f = ctx.fund('bank-dublette');
    assert.ok(/stornieren/.test(f.eintraege[0].korrektur.text));
    assert.ok(ctx.Bestandscheck.anwenden(f.eintraege[0].id).ok);
    const e2 = ctx.Store.getAllExpensesRaw().find(e => e.id === 'e2');
    assert.ok(e2 && e2.storniert, 'storniert, noch vorhanden');
    assert.ok(ctx.audit('e2').some(a => a.action === 'storniert'));
});

check('Bank (Einnahmen): gleiche Teilzahlung doppelt an einer Rechnung → Hinweis', () => {
    const ctx = welt();
    ctx.Store._rechSet('dokumente', [{ id: 'r1', typ: 'rechnung', nummer: 'RE-1', status: 'versendet', datum: '2026-03-01',
        teilzahlungen: [{ datum: '2026-03-10', betrag: 50 }, { datum: '2026-03-10', betrag: 50 }, { datum: '2026-03-20', betrag: 50 }] }]);
    const f = ctx.fund('teilzahlung-doppelt');
    assert.strictEqual(f.eintraege.length, 1);
    assert.strictEqual(f.eintraege[0].korrektur, null);
});

// ── 2. Alte Retouren / Rechnungsstornos ─────────────────────────────────────────────────
check('Retoure im alten Muster (Verkauf storniert) → Hinweis mit fehlendem Betrag, kein Vorschlag', () => {
    const ctx = welt();
    ctx.alt('sales', { id: 's1', datum: '2025-12-20', marke: 'B', artikeltyp: 'Hose', verkaufspreis: 100, storniert: true, createdAt: 'x', ustBehandlung: 'klein' });
    ctx.Store.saveRetoure({ datum: '2026-01-05', saleId: 's1', erstattungBetrag: 20, zustand: 'Unbeschädigt' });
    // neues Muster: Verkauf bleibt — kein Befund
    ctx.alt('sales', { id: 's2', datum: '2026-02-01', verkaufspreis: 80, createdAt: 'x', ustBehandlung: 'regel', steuersatz: 19 });
    ctx.Store.saveRetoure({ datum: '2026-02-05', saleId: 's2', erstattungBetrag: 80, modell: 2 });
    const f = ctx.fund('retoure-alt');
    assert.strictEqual(f.eintraege.length, 1);
    assert.ok(/80,00 € fehlen/.test(f.eintraege[0].hinweis), f.eintraege[0].hinweis);
    assert.ok(/2025-12/.test(f.eintraege[0].hinweis), 'Periodenverschiebung genannt');
    assert.strictEqual(f.eintraege[0].korrektur, null);
});

check('Rechnungsstorno im alten Muster → Hinweis; neues Muster (stornoModell 2) schweigt', () => {
    const ctx = welt();
    ctx.Store._rechSet('dokumente', [
        { id: 'r1', typ: 'rechnung', nummer: 'RE-1', status: 'storniert', _storniert: true, datum: '2026-02-01', storniertAm: '2026-03-01T00:00:00Z' },
        { id: 'r2', typ: 'rechnung', nummer: 'RE-2', status: 'storniert', _storniert: true, stornoModell: 2, datum: '2026-02-01' },
        { id: 'r3', typ: 'stornorechnung', nummer: 'ST-1', status: 'storniert', datum: '2026-03-01' }
    ]);
    ctx.alt('sales', { id: 's1', datum: '2026-02-10', verkaufspreis: 119, _invoiceId: 'r1', storniert: true, createdAt: 'x', ustBehandlung: 'regel', steuersatz: 19 });
    const f = ctx.fund('storno-alt');
    deq(f.eintraege.map(e => e.id), ['storno-alt:r1']);
    assert.ok(/119,00 €/.test(f.eintraege[0].hinweis));
    assert.strictEqual(f.eintraege[0].korrektur, null);
});

// ── 3. Steuerstatus ─────────────────────────────────────────────────────────────────────
check('Ohne Steuerstatus: Verkauf/Einkauf/Ausgabe gefunden, Vorschlag laut Historie, Übernahme protokolliert', () => {
    const ctx = welt();
    ctx.alt('sales', { id: 's1', datum: '2025-06-01', marke: 'C', verkaufspreis: 30, createdAt: 'x' });
    ctx.alt('purchases', { id: 'p1', datum: '2026-02-01', marke: 'C', einkaufspreis: 10, status: 'verfuegbar' });
    ctx.alt('expenses', { id: 'x1', datum: '2026-02-02', betrag: 5, kategorie: 'Versand' });
    const f = ctx.fund('ohne-steuerstatus');
    assert.strictEqual(f.eintraege.length, 3);
    const s1 = f.eintraege.find(e => e.korrektur.zielId === 's1');
    assert.strictEqual(s1.korrektur.modus, 'klein', '2025 lag vor dem Wechsel');
    assert.strictEqual(f.eintraege.find(e => e.korrektur.zielId === 'p1').korrektur.modus, 'regel');
    f.eintraege.forEach(e => assert.ok(ctx.Bestandscheck.anwenden(e.id).ok));
    assert.strictEqual(ctx.Store.getAllSalesRaw()[0].ustBehandlung, 'klein');
    assert.strictEqual(ctx.Store.getAllPurchasesRaw()[0].ustBehandlung, 'regel');
    assert.strictEqual(ctx.Store.getAllExpensesRaw()[0].ustBehandlung, 'regel');
    ['s1', 'p1', 'x1'].forEach(id => assert.ok(ctx.audit(id).some(a => a.action === 'bearbeitet' && /Bestandscheck/.test(a.details)), id));
    assert.ok(!ctx.fund('ohne-steuerstatus'));
});

check('Ohne Steuerstatus, festgeschrieben: kein Vorschlag, Datensatz bleibt', () => {
    const ctx = welt();
    ctx.alt('sales', { id: 's1', datum: '2025-06-01', verkaufspreis: 30, createdAt: 'x' });
    ctx.Store.closeYear(2025);
    const e = ctx.fund('ohne-steuerstatus').eintraege[0];
    assert.strictEqual(e.korrektur, null);
    assert.ok(/Festgeschrieben/.test(e.hinweis));
    assert.ok(!ctx.Bestandscheck.anwenden(e.id).ok);
});

check('Unbelegte Historie: Klärungsfall, und kein Stempel-Vorschlag', () => {
    const ctx = welt({ ustMode: 'regel' });
    ctx.alt('sales', { id: 's1', datum: '2024-06-01', verkaufspreis: 30, steuersatz: 19, createdAt: 'x' });
    assert.ok(ctx.fund('historie-unbelegt'));
    assert.ok(ctx.fund('ohne-steuerstatus').eintraege.every(e => !e.korrektur));
});

check('Regelbesteuerter Verkauf ohne Steuersatz → Hinweis; KU-Verkauf und Rechnungsverkauf nicht', () => {
    const ctx = welt();
    ctx.alt('sales', { id: 's1', datum: '2026-03-01', verkaufspreis: 119, ustBehandlung: 'regel', createdAt: 'x' });
    ctx.alt('sales', { id: 's2', datum: '2025-03-01', verkaufspreis: 119, ustBehandlung: 'klein', createdAt: 'x' });
    ctx.alt('sales', { id: 's3', datum: '2026-03-01', verkaufspreis: 119, ustBehandlung: 'regel', _invoiceId: 'r9', createdAt: 'x' });
    ctx.alt('sales', { id: 's4', datum: '2026-03-01', verkaufspreis: 107, ustBehandlung: 'regel', steuersatz: 7, createdAt: 'x' });
    const f = ctx.fund('ohne-steuersatz');
    deq(f.eintraege.map(e => e.id), ['ohne-steuersatz:s1']);
    assert.strictEqual(f.eintraege[0].korrektur, null);
});

// ── 5. USt-Zahlung als normale Ausgabe ──────────────────────────────────────────────────
check('USt-Zahlung in normaler Kategorie → Vorschlag; "inkl. USt" und Einkommensteuer nicht', () => {
    const ctx = welt();
    ctx.alt('expenses', { id: 'x1', datum: '2026-05-10', betrag: 300, kategorie: 'Sonstiges', beschreibung: 'Finanzamt Umsatzsteuer Q1', ustBehandlung: 'regel' });
    ctx.alt('expenses', { id: 'x2', datum: '2026-05-10', betrag: 120, kategorie: 'Sonstiges', beschreibung: 'UStVA April', ustBehandlung: 'regel' });
    ctx.alt('expenses', { id: 'x3', datum: '2026-05-10', betrag: 20, kategorie: 'Büro', beschreibung: 'Papier inkl. 19% USt', ustBehandlung: 'regel' });
    ctx.alt('expenses', { id: 'x4', datum: '2026-05-10', betrag: 900, kategorie: 'Sonstiges', beschreibung: 'Finanzamt Einkommensteuer-Vorauszahlung', ustBehandlung: 'regel' });
    ctx.alt('expenses', { id: 'x5', datum: '2026-05-10', betrag: 50, kategorie: 'Sonstiges', beschreibung: 'Finanzamt USt Erstattung', ustBehandlung: 'regel' });
    const f = ctx.fund('ust-zahlung');
    deq(f.eintraege.map(e => e.korrektur.zielId), ['x1', 'x2']);
    assert.ok(ctx.Bestandscheck.anwenden(f.eintraege[0].id).ok);
    const x1 = ctx.Store.getAllExpensesRaw().find(e => e.id === 'x1');
    assert.strictEqual(x1.kategorie, 'Umsatzsteuer an Finanzamt');
    assert.ok(ctx.audit('x1').some(a => a.action === 'bearbeitet' && a.oldValues.kategorie === 'Sonstiges'));
});

check('USt-Zahlung im festgeschriebenen Zeitraum → Storno + Neubuchung, Original unverändert', () => {
    const ctx = welt();
    ctx.alt('expenses', { id: 'x1', datum: '2026-05-10', betrag: 300, kategorie: 'Sonstiges', beschreibung: 'UStVA Q1', ustBehandlung: 'regel' });
    ctx.Store.closeYear(2026);
    const e = ctx.fund('ust-zahlung').eintraege[0];
    assert.ok(/Stornieren/.test(e.korrektur.text));
    assert.ok(ctx.Bestandscheck.anwenden(e.id).ok);
    const alle = ctx.Store.getAllExpensesRaw();
    const orig = alle.find(x => x.id === 'x1');
    assert.ok(orig.storniert && orig.kategorie === 'Sonstiges', 'Original storniert, Inhalt unverändert');
    const neu = alle.filter(x => !x.storniert);
    assert.strictEqual(neu.length, 1);
    assert.strictEqual(neu[0].kategorie, 'Umsatzsteuer an Finanzamt');
    assert.strictEqual(neu[0].betrag, 300);
    assert.strictEqual(neu[0].datum, '2026-05-10');
    assert.ok(ctx.audit(neu[0].id).some(a => a.action === 'erstellt'));
    assert.ok(!ctx.fund('ust-zahlung'));
});

// ── 6. ID-Fehler im Verkaufsformular ────────────────────────────────────────────────────
check('Verkauf ohne Audit "erstellt" (alter ID-Fehler) → Nachtrag ins Protokoll', () => {
    const ctx = welt();
    ctx.alt('sales', { id: 's1', datum: '2026-03-01', marke: 'D', verkaufspreis: 40, ustBehandlung: 'regel', steuersatz: 19 });
    ctx.Store.saveSale({ datum: '2026-03-02', marke: 'E', verkaufspreis: 40, steuersatz: 19 }); // sauber
    const f = ctx.fund('verkauf-ohne-protokoll');
    deq(f.eintraege.map(e => e.korrektur.zielId), ['s1']);
    ctx.Store.closeYear(2026); // Protokoll ist anfügend — Nachtrag auch im festgeschriebenen Jahr
    assert.ok(ctx.Bestandscheck.anwenden(f.eintraege[0].id).ok);
    const a = ctx.audit('s1');
    assert.strictEqual(a.length, 1);
    assert.strictEqual(a[0].action, 'nachgetragen');
    assert.strictEqual(ctx.Store.verifyAuditChain().valid, true, 'Hash-Kette intakt');
    assert.ok(!ctx.fund('verkauf-ohne-protokoll'));
});

check('Verwaister Materialverbrauch → eindeutig neu verknüpfbar; mehrdeutig nur Hinweis', () => {
    const ctx = welt();
    const mat = ctx.Store.saveMaterialBestandItem({ name: 'Karton S', einheit: 'Stück', bestand: 10, kostenProEinheit: 0.5 });
    // Paketverkauf aus dem ID-Fehler: saveSaleMulti vergab eine eigene id, Verbrauch zeigt auf 'weg1'
    const s = ctx.alt('sales', { id: 'paket1', datum: '2026-03-01', marke: 'Paket', artikeltyp: '2 Artikel', verkaufspreis: 60, ustBehandlung: 'regel', steuersatz: 19 });
    ctx.Store.bookMaterialVerbrauch([{ materialId: mat.id, menge: 2 }], '2026-03-01', 'verkauf', 'weg1', 'Paket 2 Artikel');
    // Zweiter Fall: zwei gleiche Kandidaten
    ctx.alt('sales', { id: 'k1', datum: '2026-04-01', marke: 'X', artikeltyp: 'Y', verkaufspreis: 10, ustBehandlung: 'regel', steuersatz: 19 });
    ctx.alt('sales', { id: 'k2', datum: '2026-04-01', marke: 'X', artikeltyp: 'Y', verkaufspreis: 10, ustBehandlung: 'regel', steuersatz: 19 });
    ctx.Store.bookMaterialVerbrauch([{ materialId: mat.id, menge: 1 }], '2026-04-01', 'verkauf', 'weg2', 'X Y');
    const f = ctx.fund('material-verwaist');
    assert.strictEqual(f.eintraege.length, 2);
    const eindeutig = f.eintraege.find(e => e.id === 'material-verwaist:weg1');
    assert.strictEqual(eindeutig.korrektur.zielId, s.id);
    assert.strictEqual(f.eintraege.find(e => e.id === 'material-verwaist:weg2').korrektur, null);
    assert.ok(ctx.Bestandscheck.anwenden(eindeutig.id).ok);
    assert.strictEqual(ctx.Store.getMaterialVerbrauch().filter(v => v.referenzId === 'paket1').length, 1);
    // revertMaterialVerbrauch findet ihn jetzt
    ctx.Store.revertMaterialVerbrauch('paket1');
    assert.strictEqual(ctx.Store.getMaterialBestand()[0].bestand, 10 - 2 - 1 + 2);
    deq(ctx.fund('material-verwaist').eintraege.map(e => e.id), ['material-verwaist:weg2']);
});

// ── Übergreifend ───────────────────────────────────────────────────────────────────────
check('Alle Fundarten in einem Altbestand gleichzeitig gefunden', () => {
    const ctx = welt();
    altImport(ctx, 'e1', '2026-05-01T10:00:00Z'); altImport(ctx, 'e2', '2026-06-01T10:00:00Z');
    ctx.Store._rechSet('dokumente', [
        { id: 'r1', typ: 'rechnung', nummer: 'RE-1', status: 'storniert', _storniert: true, datum: '2026-02-01' },
        { id: 'r2', typ: 'rechnung', nummer: 'RE-2', status: 'versendet', datum: '2026-02-01', teilzahlungen: [{ datum: '2026-03-10', betrag: 5 }, { datum: '2026-03-10', betrag: 5 }] }]);
    ctx.alt('sales', { id: 's1', datum: '2026-03-01', marke: 'B', verkaufspreis: 100, storniert: true });
    ctx.Store.saveRetoure({ datum: '2026-03-05', saleId: 's1', erstattungBetrag: 100 });
    ctx.alt('sales', { id: 's2', datum: '2026-03-01', marke: 'P', artikeltyp: 'Q', verkaufspreis: 50 });
    ctx.alt('expenses', { id: 'x1', datum: '2026-05-10', betrag: 300, kategorie: 'Sonstiges', beschreibung: 'UStVA Q1', ustBehandlung: 'regel' });
    ctx.alt('materiallager_verbrauch', { id: 'v1', datum: '2026-03-01', grund: 'verkauf', referenzId: 'weg', referenzBez: 'P Q', menge: 1, kosten: 0.5 });
    const arten = ctx.funde().map(f => f.art);
    ALLE.filter(a => a !== 'historie-unbelegt').forEach(a => assert.ok(arten.indexOf(a) !== -1, 'fehlt: ' + a));
    const ctx2 = welt({ ustMode: 'klein' });
    ctx2.alt('sales', { id: 's1', datum: '2026-03-01', verkaufspreis: 10 });
    assert.ok(ctx2.fund('historie-unbelegt'), 'fehlt: historie-unbelegt');
});

check('Veraltete Vorschau: anwenden() auf einen erledigten Befund ändert nichts', () => {
    const ctx = welt();
    altImport(ctx, 'e1', '2026-05-01T10:00:00Z'); altImport(ctx, 'e2', '2026-06-01T10:00:00Z');
    const id = ctx.fund('bank-dublette').eintraege[0].id;
    assert.ok(ctx.Bestandscheck.anwenden(id).ok);
    const r = ctx.Bestandscheck.anwenden(id);
    assert.ok(!r.ok);
    assert.strictEqual(ctx.Store.getExpenses().length, 1);
});

check('Hinweis ohne Vorschlag lässt sich nicht "anwenden"', () => {
    const ctx = welt();
    ctx.alt('sales', { id: 's1', datum: '2026-03-01', verkaufspreis: 119, ustBehandlung: 'regel', createdAt: 'x' });
    const id = ctx.fund('ohne-steuersatz').eintraege[0].id;
    assert.ok(!ctx.Bestandscheck.anwenden(id).ok);
});

check('Seite rendert alle Befunde mit Übernehmen-Knopf nur bei Vorschlag', () => {
    const ctx = welt();
    altImport(ctx, 'e1', '2026-05-01T10:00:00Z'); altImport(ctx, 'e2', '2026-06-01T10:00:00Z');
    ctx.alt('sales', { id: 's1', datum: '2026-03-01', verkaufspreis: 119, ustBehandlung: 'regel', createdAt: 'x' });
    const html = ctx.Bestandscheck.render();
    assert.ok(/Doppelte Ausgaben aus dem Bankimport/.test(html));
    assert.ok(/Regelbesteuerte Verkäufe ohne Steuersatz/.test(html));
    assert.strictEqual((html.match(/data-bestandscheck-korrektur=/g) || []).length, 1);
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
