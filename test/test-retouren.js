// js/retouren.js — was beim Speichern einer Retoure im Hintergrund passiert.
//
// Seit dem Audit 2026-10-13 (L4) gilt:
//
//   Der Verkauf bleibt stehen (Zufluss, §11 EStG) — er wird nicht mehr storniert.
//   Die Erstattung ist eine eigene datierte Rückzahlung (auch Teilerstattung).
//   Lager: nur die als zurückgekommen markierten Artikel —
//     'zurueck' → wieder verfügbar, 'defekt' → Status "beschadigt", 'keine' → nichts.
//   Der Einkauf wird nie storniert: er war und bleibt eine Ausgabe.
//
// Vorher stornierte jede verknüpfte Retoure den GANZEN Verkauf (100 € Verkauf, 20 €
// Erstattung → 0 € Einnahme), und "beschädigt" stornierte den Einkauf — der Wareneinsatz
// verschwand aus der EÜR. Die wirtschaftlichen Endergebnisse (EÜR je Jahr) prüft
// test/test-retoure-zahlungsfluss.js mit dem echten Store.
//
// Weiter abgesichert: der Schutz gegen negative Beträge. Über `erstattungBetrag` fließt die
// Retoure in EÜR und §25a-Marge — ein negativer Wert dreht dort das Vorzeichen.
'use strict';
const assert = require('assert');
const fs = require('fs');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}
let blockNr = 0;
function block(fn) {
    blockNr++;
    const nr = blockNr;
    try { fn(); }
    catch (e) {
        total++;
        console.error('✗ FAIL Block ' + nr + ' bricht mit einer Ausnahme ab: ' + e.message);
        process.exitCode = 1;
    }
}
const erst = (liste) => (liste && liste[0]) || {};

const retSrc = fs.readFileSync(__dirname + '/../js/retouren.js', 'utf8');

// Mini-DOM: der submit-Handler wird abgefangen und selbst aufgerufen — echter Modulcode.
function lade(felder, o) {
    const d = Object.assign({ sales: [], retouren: [] }, o || {});
    const protokoll = { storniertSale: [], storniertPurchase: [], gespeichert: [], geloescht: [], toasts: [] };
    const purchases = (d.purchases || [{ id: 'p1', status: 'verkauft' }, { id: 'p2', status: 'verkauft' }, { id: 'p3', status: 'verkauft' }])
        .map(p => Object.assign({}, p));
    protokoll.purchases = purchases;
    let submitHandler = null;
    const elemente = {};
    const el = (id) => {
        if (!elemente[id]) {
            elemente[id] = {
                value: Object.prototype.hasOwnProperty.call(felder, id) ? felder[id] : '',
                style: {}, dataset: {}, innerHTML: '',
                addEventListener: (typ, fn) => { if (id === 'retourenForm' && typ === 'submit') submitHandler = fn; },
            };
        }
        return elemente[id];
    };
    const document = { getElementById: (id) => el(id), querySelectorAll: () => [] };
    const Store = {
        getRetouren: () => d.retouren,
        getSales: () => d.sales,
        getPurchases: () => purchases,
        getAllPurchasesRaw: () => purchases,
        stornoSale: (id, grund) => protokoll.storniertSale.push({ id, grund }),
        stornoPurchase: (id, grund) => protokoll.storniertPurchase.push({ id, grund }),
        saveRetoure: (r) => { if (d.saveFehler) return null; r.id = r.id || 'neu' + protokoll.gespeichert.length; protokoll.gespeichert.push(r); return r; },
        deleteRetoure: (id) => protokoll.geloescht.push(id),
        _stampRecord: (r) => r,
        _addAuditEntry: () => {},
        set: () => { if (d.setFehler) throw new Error('Quota'); },
    };
    const Utils = {
        formatDate: (x) => String(x || ''),
        formatCurrency: (n) => String(n),
        escapeHtml: (s) => String(s == null ? '' : s),
        showToast: (text, art) => protokoll.toasts.push({ text, art }),
        getDateInputValue: (id) => el(id).value || '',
        todayISO: () => '2026-04-01',
    };
    const R = new Function('Store', 'Utils', 'document', retSrc + '\n; return Retouren;')(Store, Utils, document);
    R.init();
    return { R, protokoll, absenden: () => { submitHandler({ preventDefault() {} }); } };
}

function formular(over) {
    return Object.assign({
        rt_datum: '2026-04-01', rt_marke: 'Acme', rt_artikeltyp: 'Regal', rt_ware: 'zurueck',
        rt_vkPreis: '100', rt_erstattung: '100', rt_notizen: '', rt_saleId: '',
    }, over || {});
}
const VERKAUF = { id: 's1', datum: '2026-03-01', verkaufspreis: 100, marke: 'Acme', artikeltyp: 'Regal', purchaseId: 'p1' };

console.log('\n── A. Schutz gegen unsinnige Beträge ────────────────────────');
block(() => {
    const t = lade(formular({ rt_vkPreis: '-50' }));
    t.absenden();
    check('A1 Negativer Verkaufspreis wird abgewiesen, nichts gespeichert',
        t.protokoll.gespeichert.length === 0 && t.protokoll.toasts.some(x => x.art === 'error'));
    const t2 = lade(formular({ rt_erstattung: '-1' }));
    t2.absenden();
    check('A2 Negative Erstattung wird abgewiesen',
        t2.protokoll.gespeichert.length === 0 && t2.protokoll.toasts.some(x => x.art === 'error'));
    const t3 = lade(formular({ rt_erstattung: '0' }));
    t3.absenden();
    check('A3 Null Erstattung ist erlaubt (Ware zurück, Geld behalten)', t3.protokoll.gespeichert.length === 1);
    const t5 = lade(formular({ rt_vkPreis: '-50', rt_saleId: 's1' }), { sales: [VERKAUF] });
    t5.absenden();
    check('A4 Bei unsinnigem Betrag wird auch kein Lager bewegt',
        t5.protokoll.purchases.every(p => p.status === 'verkauft'));
});

console.log('\n── B. Ware zurück, unbeschädigt ─────────────────────────────');
block(() => {
    const t = lade(formular({ rt_ware: 'zurueck', rt_saleId: 's1' }), { sales: [VERKAUF] });
    t.absenden();
    check('B1 Der Verkauf wird NICHT storniert (Zufluss bleibt)', t.protokoll.storniertSale.length === 0);
    check('B2 Der Einkauf wird NICHT storniert', t.protokoll.storniertPurchase.length === 0);
    check('B3 Der Artikel ist wieder verfügbar', t.protokoll.purchases.find(p => p.id === 'p1').status === 'verfuegbar');
    const r = erst(t.protokoll.gespeichert);
    check('B4 Die Retoure trägt Verkauf, Artikel und Modell 2',
        r.saleId === 's1' && (r.artikelIds || []).join() === 'p1' && r.modell === 2);
});

console.log('\n── C. Beschädigt / keine Ware / Teilretoure ─────────────────');
block(() => {
    const t = lade(formular({ rt_ware: 'defekt', rt_saleId: 's1' }), { sales: [VERKAUF] });
    t.absenden();
    check('C1 Beschädigt: Verkauf bleibt, Einkauf bleibt Ausgabe',
        t.protokoll.storniertSale.length === 0 && t.protokoll.storniertPurchase.length === 0);
    check('C2 Beschädigt: Artikel bekommt Status "beschadigt"',
        t.protokoll.purchases.find(p => p.id === 'p1').status === 'beschadigt');

    const t2 = lade(formular({ rt_ware: 'keine', rt_saleId: 's1', rt_erstattung: '20' }), { sales: [VERKAUF] });
    t2.absenden();
    check('C3 Nur Erstattung: kein Lagerstatus geändert, Betrag 20',
        t2.protokoll.purchases.find(p => p.id === 'p1').status === 'verkauft' && erst(t2.protokoll.gespeichert).erstattungBetrag === 20);

    const mehrere = Object.assign({}, VERKAUF, { purchaseId: undefined, purchaseIds: ['p1', 'p2', 'p3'] });
    const t3 = lade(formular(), { sales: [mehrere] });
    const r3 = t3.R.buche({ datum: '2026-04-01', saleId: 's1', erstattungBetrag: 30, ware: 'zurueck', artikelIds: ['p2'] });
    check('C4 Teilretoure: nur der zurückgekommene Artikel geht ins Lager',
        r3.ok && t3.protokoll.purchases.map(p => p.status).join() === 'verkauft,verfuegbar,verkauft');

    const t4 = lade(formular({ rt_saleId: 's1', rt_erstattung: '100.01' }), { sales: [VERKAUF] });
    t4.absenden();
    check('C5 Erstattung über dem Verkaufsbetrag wird abgewiesen',
        t4.protokoll.gespeichert.length === 0 && t4.protokoll.toasts.some(x => x.art === 'error'));
    const t5 = lade(formular({ rt_saleId: 's1', rt_erstattung: '50' }), { sales: [VERKAUF],
        retouren: [{ id: 'alt', saleId: 's1', erstattungBetrag: 60 }] });
    t5.absenden();
    check('C6 Zweite Erstattung berücksichtigt die erste (60 + 50 > 100)', t5.protokoll.gespeichert.length === 0);
});

console.log('\n── D. Ohne Verkauf, Fehler, Kompensation, Doppelklick ───────');
block(() => {
    const t = lade(formular({ rt_saleId: '' }));
    t.absenden();
    check('D1 Ohne Verknüpfung: nichts storniert, kein Lager bewegt',
        t.protokoll.storniertSale.length === 0 && t.protokoll.purchases.every(p => p.status === 'verkauft'));
    check('D2 Die Retoure wird erfasst, mit saleId null',
        t.protokoll.gespeichert.length === 1 && t.protokoll.gespeichert[0].saleId === null);
    const t2 = lade(formular({ rt_saleId: 'gibtsnicht' }), { sales: [VERKAUF] });
    t2.absenden();
    check('D3 Ein ins Leere zeigender Verkauf wird gemeldet statt still verknüpft',
        t2.protokoll.gespeichert.length === 0 && t2.protokoll.toasts.some(x => x.art === 'error'));
    const t3 = lade(formular({ rt_saleId: 's1' }), { sales: [VERKAUF], setFehler: true });
    t3.absenden();
    check('D4 Scheitert die Lagerbuchung, wird die Retoure entfernt, keine Erfolgsmeldung',
        t3.protokoll.geloescht.length === 1 && !t3.protokoll.toasts.some(x => x.art === 'success'));
    const t4 = lade(formular({ rt_saleId: 's1' }), { sales: [VERKAUF], saveFehler: true });
    t4.absenden();
    check('D5 Scheitert das Speichern: keine Lagerbewegung, keine Erfolgsmeldung',
        t4.protokoll.purchases.every(p => p.status === 'verkauft') && !t4.protokoll.toasts.some(x => x.art === 'success'));
    const t5 = lade(formular({ rt_saleId: 's1' }), { sales: [VERKAUF] });
    t5.R._busy = true; // ein erster Klick läuft noch
    t5.absenden();
    check('D6 Doppelklick während eines laufenden Vorgangs erzeugt keine zweite Retoure', t5.protokoll.gespeichert.length === 0);
});

console.log('\n── E. Übernommene Werte und Jahressumme ─────────────────────');
block(() => {
    const t = lade(formular({ rt_vkPreis: '120.50', rt_erstattung: '99.99', rt_notizen: '  Karton nass  ' }));
    t.absenden();
    const r = erst(t.protokoll.gespeichert);
    check('E1 Beträge kommen als Zahl in den Datensatz', r.vkPreis === 120.5 && r.erstattungBetrag === 99.99);
    check('E2 Freitext wird getrimmt', r.notizen === 'Karton nass');
    check('E3 Datum und Ware stehen im Datensatz', r.datum === '2026-04-01' && r.ware === 'zurueck');
    const { R } = lade(formular(), { retouren: [
        { id: 'r1', datum: '2026-02-01', erstattungBetrag: 100 },
        { id: 'r2', datum: '2026-05-01', erstattungBetrag: 50.5 },
        { id: 'r3', datum: '2025-05-01', erstattungBetrag: 999 } ] });
    R._filterYear = '2026';
    const html2026 = R.render();
    R._filterYear = 'all';
    const htmlAlle = R.render();
    check('E4 Die Jahressumme zählt nur das gefilterte Jahr', html2026.includes('150.5') && !html2026.includes('1149.5'));
    check('E5 Ohne Filter zählt sie alles', htmlAlle.includes('1149.5'));
});

console.log('\n' + pass + '/' + total + ' Checks bestanden');
assert.strictEqual(pass, total, 'Retouren: ' + (total - pass) + ' Prüfung(en) fehlgeschlagen');
