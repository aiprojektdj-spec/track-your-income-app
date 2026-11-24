// js/eigenbeleg-status.js: unbestaetigte Eigenbelege (bestaetigt === false) zaehlen nicht in EUER/DATEV.
// Altbestand (Feld fehlt) und bestaetigt:true aendern sich nicht. Erfundene Beispieldaten.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ladeModule } = require('./_lade-module');
const S = ladeModule(['js/eigenbeleg-status.js']).EigenbelegStatus;

let fail = 0;
function check(name, fn) {
    try { fn(); console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}
const lies = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

check('zaehlt: Feld fehlt / true = bestaetigt, nur false zaehlt nicht', () => {
    assert.strictEqual(S.zaehlt({}), true);
    assert.strictEqual(S.zaehlt({ bestaetigt: true }), true);
    assert.strictEqual(S.zaehlt({ bestaetigt: undefined }), true);
    assert.strictEqual(S.zaehlt({ bestaetigt: false }), false);
    assert.strictEqual(S.zaehlt(null), false);
});

check('kannBestaetigen: nur unbestaetigt, nicht storniert, nicht in gesperrter Periode', () => {
    const offen = { id: 'EB-1', belegDatum: '2026-03-01', bestaetigt: false };
    assert.strictEqual(S.kannBestaetigen(offen, { gesperrt: () => false }).ok, true);
    assert.strictEqual(S.kannBestaetigen(offen, { gesperrt: d => d === '2026-03-01' }).grund, 'Periode festgeschrieben');
    assert.strictEqual(S.kannBestaetigen(Object.assign({ storniert: true }, offen), {}).ok, false);
    assert.strictEqual(S.kannBestaetigen({ id: 'EB-2' }, {}).ok, false);          // Altbestand: schon bestaetigt
    assert.strictEqual(S.kannBestaetigen({ bestaetigt: true }, {}).ok, false);
    assert.strictEqual(S.kannBestaetigen(undefined, {}).ok, false);
});

check('bestaetigt: neuer Datensatz, Original unveraendert', () => {
    const offen = { id: 'EB-1', bestaetigt: false };
    const neu = S.bestaetigt(offen, '2026-11-24T10:00:00.000Z');
    assert.strictEqual(neu.bestaetigt, true);
    assert.strictEqual(neu.bestaetigtAm, '2026-11-24T10:00:00.000Z');
    assert.strictEqual(offen.bestaetigt, false);
    assert.strictEqual(S.zaehlt(neu), true);
});

check('EUER: unbestaetigter Beleg aendert den Gewinn nicht, Altbestand und bestaetigte zaehlen wie vorher', () => {
    const gewinn = (belege) => {
        const o = { settings: { ustMode: 'klein' }, eigenbelege: belege };
        const Store = {
            getSettings: () => o.settings, getSales: () => [], getPurchases: () => [], getExpenses: () => [],
            getAllPurchasesRaw: () => [], getAllExpensesRaw: () => [], getRechInvoices: () => [], getRechCustomers: () => [],
            getRetouren: () => [], getFahrten: () => [], getMaterialEinkauefe: () => [], getAfaAnlagen: () => [],
            getAuditLog: () => [], _syncReadRaw: () => o.eigenbelege, salePerRate: () => []
        };
        const Utils = { isInPeriod: (d, s, e) => !!d && d >= s && d <= e, getMonthName: () => 'M', formatDate: d => d, istDrittland: () => false, escapeHtml: s => String(s) };
        const ctx = ladeModule(['js/eigenbeleg-status.js', 'js/steuerstatus.js', 'js/steuer-berechnung.js', 'js/euer.js'],
            { Store, Utils, Afa: { _calcJahresAfa: () => 0 }, document: { getElementById: () => ({ checked: false }) } });
        return ctx.Euer._berechne(2026, 0, 'jahr').gewinn;
    };
    const alt = { belegDatum: '2026-08-01', betragBrutto: 70, betragNetto: 70 };
    const bestaetigt = { belegDatum: '2026-08-02', betragBrutto: 30, betragNetto: 30, bestaetigt: true };
    const unbestaetigt = { belegDatum: '2026-08-03', betragBrutto: 1000, betragNetto: 1000, bestaetigt: false };
    assert.strictEqual(gewinn([alt]), -70);
    assert.strictEqual(gewinn([alt, bestaetigt]), -100);
    assert.strictEqual(gewinn([alt, bestaetigt, unbestaetigt]), -100);
    assert.strictEqual(gewinn([alt, bestaetigt, Object.assign({}, unbestaetigt, { bestaetigt: true })]), -1100);
});

check('Verdrahtung: alle Leser filtern, Modul wird vor ihnen geladen', () => {
    assert.ok(/\)\(\)\.filter\(b => EigenbelegStatus\.zaehlt\(b\)\)/.test(lies('js/euer.js')));
    assert.ok(/\)\(\)\.filter\(b => EigenbelegStatus\.zaehlt\(b\)\)/.test(lies('js/schweiz.js')));
    const datev = lies('js/datev.js');
    assert.strictEqual((datev.match(/EigenbelegStatus\.zaehlt/g) || []).length, 2);     // Stapel + Belegarchiv
    const loader = lies('js/app-loader.js');
    const pos = (m) => loader.indexOf("'" + m + "'");
    assert.ok(pos('js/eigenbeleg-status.js') > -1 && pos('js/eigenbeleg-status.js') < pos('js/euer.js') && pos('js/eigenbeleg-status.js') < pos('js/datev.js'));
    assert.ok(/eigenbeleg-status\.js/.test(lies('eigenbelege/index.html')));
});

check('Eigenbeleg-Seite: Bestaetigen-Knopf nur bei Unbestaetigten, Aktion ist als Schreibaktion gesperrt (confirm)', () => {
    const app = lies('eigenbelege/js/app.js');
    assert.ok(/!storniert && !EigenbelegStatus\.zaehlt\(x\) \? `<button[^`]*eb-confirm-beleg/.test(app));
    assert.ok(/case 'eb-confirm-beleg':\s+bestaetigeBeleg/.test(app));
    assert.ok(/Store\._addAuditEntry\('bearbeitet', 'eigenbeleg', id, old, belege\[idx\], 'Eigenbeleg bestätigt'\)/.test(app));
    assert.ok(/(^|-)(confirm)(-|$)/i.test('eb-confirm-beleg'));   // WRITE_RE in js/stb-share.js
});

if (fail) { console.log('\n' + fail + ' Test(s) fehlgeschlagen'); process.exit(1); }
console.log('\nalle Tests gruen');
