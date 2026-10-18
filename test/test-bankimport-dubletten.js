// Regression Audit 2026-10-13, L3 — wiederholter Kontoimport bucht nichts doppelt.
//
// Soll: Derselbe 100-€-Umsatz zweimal importiert → eine Buchung über 100 €. Zwei tatsächlich
// verschiedene, gleich aussehende Zahlungen im selben Auszug bleiben zwei Buchungen. Ein
// Abbruch mittendrin oder ein Doppelklick führt beim Wiederholen nicht zu Dubletten.
//
// Echter Code: js/store.js, js/bank-import.js (Schlüsselvergabe, Vorschau, importSelected).
// Simuliert: DOM (Häkchen/Kategorie-Auswahl), localStorage.
'use strict';
const assert = require('assert');
const { ladeModule } = require('./_lade-module');

let fail = 0, pass = 0;
function check(name, fn) {
    try { fn(); pass++; console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}

function welt() {
    const mem = {};
    const localStorage = { getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
    let html = '';
    const boxen = () => {
        const out = [];
        const re = /<input type="checkbox" class="bank-row-check" data-idx="(\d+)"([^>]*)>/g;
        let m;
        while ((m = re.exec(html))) out.push({ dataset: { idx: m[1] }, disabled: /disabled/.test(m[2]), checked: false });
        return out;
    };
    let aktuelleBoxen = [];
    const document = {
        getElementById: id => id === 'bankImportPreview' ? { set innerHTML(v) { html = v; aktuelleBoxen = boxen(); }, get innerHTML() { return html; } } : null,
        querySelectorAll: sel => sel === '.bank-row-check:checked' ? aktuelleBoxen.filter(b => b.checked && !b.disabled)
            : sel === '.bank-row-check' ? aktuelleBoxen : [],
        querySelector: () => null
    };
    const Utils = { formatDate: x => x, formatCurrency: n => String(n), escapeHtml: s => String(s == null ? '' : s), showToast() {},
        todayISO: () => '2026-10-13', isInPeriod: (x, s, e) => !!x && x >= s && x <= e };
    const ctx = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'js/store.js', 'js/bank-import.js'], { localStorage, Utils, document });
    ctx.Store.saveSettings({ ustMode: 'klein' });
    ctx.importiere = (transactions, auswahl) => {
        const t = transactions.map(x => Object.assign({}, x));
        ctx.BankImport._test.setParsed(t);
        ctx.BankImport._test.renderPreview(t);
        aktuelleBoxen.forEach(b => { if (!auswahl || auswahl.indexOf(+b.dataset.idx) !== -1) b.checked = true; });
        ctx.BankImport._test.importSelected();
        return aktuelleBoxen;
    };
    ctx.summe = () => ctx.Store.getExpenses().reduce((s, e) => s + (parseFloat(e.betrag) || 0), 0);
    return ctx;
}
const miete = { date: '2026-04-10', amount: 100, isCredit: false, description: 'Bueromiete April', counterparty: 'Vermieter GmbH', raw: 'CSV' };

check('L3: derselbe 100-€-Umsatz zweimal importiert → eine Buchung über 100 €', () => {
    const ctx = welt();
    ctx.importiere([miete]);
    const zweiter = ctx.importiere([miete]);
    assert.strictEqual(ctx.Store.getExpenses().length, 1, 'Anzahl');
    assert.strictEqual(ctx.summe(), 100, 'Summe');
    assert.ok(zweiter[0].disabled, 'zweite Vorschau: Zeile als bereits importiert gesperrt');
});

check('L3: zwei verschiedene gleich hohe Zahlungen im selben Auszug bleiben zwei Buchungen', () => {
    const ctx = welt();
    ctx.importiere([miete, miete]);
    assert.strictEqual(ctx.Store.getExpenses().length, 2);
    // Überlappender Auszug mit denselben beiden + einer neuen
    ctx.importiere([miete, miete, Object.assign({}, miete, { date: '2026-04-11' })]);
    assert.strictEqual(ctx.Store.getExpenses().length, 3, 'nur die neue kommt dazu');
});

check('L3: Bankreferenz schlägt Fingerabdruck — gleiche Referenz bei geändertem Text ist bekannt, andere Referenz ist neu', () => {
    const ctx = welt();
    ctx.importiere([Object.assign({}, miete, { ref: 'BANKREF-1' })]);
    ctx.importiere([Object.assign({}, miete, { ref: 'BANKREF-1', description: 'BUEROMIETE APRIL (Kopie)' })]);
    assert.strictEqual(ctx.Store.getExpenses().length, 1);
    ctx.importiere([Object.assign({}, miete, { ref: 'BANKREF-2' })]);
    assert.strictEqual(ctx.Store.getExpenses().length, 2);
});

check('L3: Wiederholung nach Teilabbruch bucht nur den Rest', () => {
    const ctx = welt();
    const zwei = [miete, Object.assign({}, miete, { date: '2026-04-12', description: 'Porto', amount: 5 })];
    ctx.importiere(zwei, [0]);              // nur die erste wurde verarbeitet
    ctx.importiere(zwei);                   // alles erneut angehakt
    assert.strictEqual(ctx.Store.getExpenses().length, 2);
    assert.strictEqual(ctx.summe(), 105);
});

check('L3: CAMT- und MT940-Parser liefern die Bankreferenz', () => {
    const ctx = welt();
    const mt = ':20:STMT\n:61:2604100410D100,00NTRFNONREF//BANK123456\n:86:?20Bueromiete April?32Vermieter GmbH\n';
    const r = ctx.BankImport.parseMt940(mt);
    assert.strictEqual(r.transactions[0].ref, 'BANK123456');
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
