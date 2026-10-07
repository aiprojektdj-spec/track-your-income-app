// Steuerberater-Paket: der Gewinn hat eine Quelle.  node test/test-steuerberater.js
//
// Hintergrund (plan/01-AUFGABEN.md 1.8, offenes Modul `steuerberater`): js/steuerberater.js
// rechnete bis 2026-10-07 die EÜR selbst — Verkaeufe − Einkaeufe − Ausgaben. Es fehlten AfA,
// Fahrtkosten, Eigenbelege, Material, Retouren, Plattformgebuehren und das Rechnungsbuch, und
// bei Regelbesteuerung wurde brutto statt netto gerechnet. Der Steuerberater bekam also einen
// anderen Gewinn als die EÜR-Seite zeigt. Selbe Fundklasse wie A1 (test-gewinn-eine-quelle.js).
//
// Geprueft wird:
//   A) die EÜR-Zeilen im Paket sind exakt die Werte aus Euer._berechne(year, 0, 'jahr')
//   B) die Rohdaten (Verkaeufe/Einkaeufe/Ausgaben) aendern den Gewinn NICHT mehr
//   C) ohne Euer wird kein Paket erzeugt (keine geratene Zahl)
//   D) Quelltext-Wache: keine zweite Gewinnformel
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    let ok = false;
    try { ok = typeof cond === 'function' ? !!cond() : !!cond; } catch (e) { ok = false; }
    if (ok) { pass++; console.log('✓ ' + name); }
    else    { console.log('✗ ' + name); }
}

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'steuerberater.js'), 'utf8');

function lauf({ euer, settings }) {
    const out = { html: null, toasts: [], euerCalls: [] };
    let handler = null;   // init() bindet buildAndDownload an den Knopf
    const felder = {
        stbYear: { value: '2026' }, stbPin: { value: '' },
        stb_eur: { checked: true }, stb_invoices: { checked: false }, stb_expenses: { checked: false },
        stb_purchases: { checked: false }, stb_afa: { checked: false }, stb_audit: { checked: false },
        stbExportBtn: { addEventListener: (ev, fn) => { handler = fn; } }
    };
    const ctx = {
        console,
        document: { getElementById: id => felder[id] || null },
        Store: {
            getSettings: () => settings || {},
            // Rohdaten, aus denen die alte Formel 1.000 − 300 − 200 = 500 gerechnet haette
            getAllSalesRaw: () => [{ datum: '2026-03-01', verkaufspreis: 1000 }],
            getAllPurchasesRaw: () => [{ datum: '2026-02-01', einkaufspreis: 300, anzahl: 1 }],
            getAllExpensesRaw: () => [{ datum: '2026-04-01', betrag: 200 }],
            getRechInvoices: () => [], getRechCustomers: () => [], getAfaAnlagen: () => [],
            getAuditLog: () => []
        },
        Utils: {
            escapeHtml: s => String(s),
            downloadFile: html => { out.html = html; },
            showToast: (m, t) => { out.toasts.push([m, t]); }
        }
    };
    if (euer) ctx.Euer = { _berechne: (y, m, p) => { out.euerCalls.push([y, m, p]); return euer; } };
    vm.createContext(ctx);
    vm.runInContext(src + '; this.Steuerberater = Steuerberater;', ctx);
    ctx.Steuerberater.init();
    handler();
    return out;
}

const eur = v => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

// ── A) Werte aus Euer._berechne ──
const euerKlein = { isRegel: false, summeEinnahmen: 1234.56, summeAusgaben: 987.65, gewinn: 246.91 };
const a = lauf({ euer: euerKlein, settings: { ustMode: 'klein' } });
check('A1 Euer._berechne mit (2026, 0, "jahr") aufgerufen',
    () => a.euerCalls.length === 1 && a.euerCalls[0].join('|') === '2026|0|jahr');
check('A2 Einnahmen aus summeEinnahmen', () => a.html.includes(eur(1234.56)));
check('A3 Ausgaben aus summeAusgaben',   () => a.html.includes(eur(987.65)));
check('A4 Gewinn aus gewinn',            () => a.html.includes(eur(246.91)));
check('A5 Kleinunternehmer: kein "(netto)"', () => !a.html.includes('(netto)'));

const r = lauf({ euer: { isRegel: true, summeEinnahmen: 100, summeAusgaben: 40, gewinn: 60 },
                 settings: { ustMode: 'regel' } });
check('A6 Regelbesteuerung: Zeilen als netto beschriftet', () => r.html.includes('Betriebseinnahmen (netto)'));

// ── B) Rohdaten wirken nicht mehr am EÜR vorbei ──
check('B1 alte Formel (1.000 − 300 − 200 = 500) taucht nicht auf', () => !a.html.includes(eur(500)));
check('B2 alte Zeile "Wareneinkauf" in der EÜR-Tabelle ist weg', () => {
    const s = a.html.slice(a.html.indexOf('id="s_eur"'));
    return !s.slice(0, s.indexOf('</section>')).includes('Wareneinkauf');
});

// ── C) Ohne Euer kein Paket ──
const c = lauf({ euer: null, settings: {} });
check('C1 ohne Euer wird nichts heruntergeladen', () => c.html === null);
check('C2 ohne Euer eine Fehlermeldung', () => c.toasts.some(t => t[1] === 'error'));

// ── D) Quelltext-Wache ──
check('D1 keine eigene Summe ueber verkaufspreis mehr',
    () => !/reduce\([^)]*verkaufspreis/.test(src.replace(/\s+/g, ' ')) && !/verkaufspreis\)\s*\|\|\s*0\)\s*\+/.test(src));
check('D2 buildEurSection bekommt das Ergebnis von _berechne', () => /buildEurSection\(year, eur,/.test(src));

console.log(`\n${pass}/${total} bestanden`);
process.exit(pass === total ? 0 : 1);
