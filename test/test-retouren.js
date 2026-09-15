// js/retouren.js — was beim Speichern einer Retoure im Hintergrund passiert.
//
// Fund C des Vollaudits (plan/01-AUFGABEN.md 1.8): Das Modul wurde von keinem Harness geladen.
// Seine Rechenlogik ist duenn — die Summe der Erstattungen, mehr nicht. Der Wert steckt in der
// NEBENWIRKUNGSKETTE beim Speichern, und die ist es, die ueber Lagerbestand und Gewinn
// entscheidet:
//
//   Unbeschaedigt  → Verkauf stornieren, Artikel geht ZURUECK ins Lager (wiederverkaeuflich)
//   Beschaedigt    → Verkauf stornieren UND den Einkauf stornieren, denn der Artikel ist weg
//
// Verwechselt man die beiden Zweige, stimmt entweder der Lagerwert nicht (ein zerstoerter
// Artikel steht weiter als Bestand) oder der Wareneinsatz (ein heiler Artikel verschwindet aus
// dem Bestand, ohne dass ihm ein Umsatz gegenuebersteht — derselbe Schaden wie Fund 1.5).
//
// Zusaetzlich abgesichert: der Schutz gegen negative Betraege. Ueber `erstattungBetrag` fliesst
// die Retoure nach §11 EStG in die EUER und ueber margeKorrektur in die §25a-Marge der
// USt-Voranmeldung — ein negativer Wert dreht dort das Vorzeichen.
'use strict';
const assert = require('assert');
const fs = require('fs');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}
// Ein Harness ruft echten Modulcode auf — genau das macht ihn wertvoll, und genau deshalb
// kann der Aufruf selbst werfen. Ohne diese Klammer stirbt der Lauf an der ersten Ausnahme,
// und man erfaehrt nicht, was sonst noch kaputt ist: ein Stacktrace statt einer Fundliste.
// Nachgemessen am 2026-09-15 in einer Spiegelkopie: bei einer gebrochenen Modul-API starben
// alle vier Harnesse dieser Session, statt zu melden.
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

// Erstes Element oder ein leeres Objekt. Ohne das stirbt der Harness bei einem Rueckfall an
// einer TypeError-Exception, statt die fehlgeschlagenen Pruefungen aufzuzaehlen — nachgestellt
// am 2026-09-15 durch Vertauschen der beiden Zustands-Zweige im Modul.
const erst = (liste) => (liste && liste[0]) || {};

const retSrc = fs.readFileSync(__dirname + '/../js/retouren.js', 'utf8');

// ── Mini-DOM ───────────────────────────────────────────────────────────────
// Das Modul haengt seine Logik per addEventListener an ein Formular. Der Harness faengt den
// submit-Handler ab und ruft ihn selbst auf — so laeuft echter Modulcode, nicht eine Kopie.
function lade(felder, o) {
    const d = Object.assign({ sales: [], retouren: [] }, o || {});
    const protokoll = { storniertSale: [], storniertPurchase: [], materialZurueck: [],
                        gespeichert: [], geloescht: [], toasts: [] };
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
    const document = {
        getElementById: (id) => el(id),
        querySelectorAll: () => [],
    };
    const Store = {
        getRetouren: () => d.retouren,
        getSales:    () => d.sales,
        stornoSale:            (id, grund) => protokoll.storniertSale.push({ id, grund }),
        stornoPurchase:        (id, grund) => protokoll.storniertPurchase.push({ id, grund }),
        revertMaterialVerbrauch: (id) => protokoll.materialZurueck.push(id),
        saveRetoure:           (r) => protokoll.gespeichert.push(r),
        deleteRetoure:         (id) => protokoll.geloescht.push(id),
    };
    const Utils = {
        formatDate: (x) => String(x || ''),
        formatCurrency: (n) => String(n),
        escapeHtml: (s) => String(s == null ? '' : s),
        showToast: (text, art) => protokoll.toasts.push({ text, art }),
        getDateInputValue: (id) => el(id).value || '',
        // Fest statt echtem Datum: der Harness soll nicht am Kalender haengen.
        todayISO: () => '2026-04-01',
    };

    const R = new Function('Store', 'Utils', 'document',
        retSrc + '\n; return Retouren;')(Store, Utils, document);
    R.init();
    return { R, protokoll, absenden: () => { submitHandler({ preventDefault() {} }); } };
}

// Ein vollstaendig ausgefuelltes Formular; jeder Testfall wandelt gezielt ab.
function formular(over) {
    return Object.assign({
        rt_datum: '2026-04-01',
        rt_marke: 'Acme',
        rt_artikeltyp: 'Regal',
        rt_zustand: 'Unbeschädigt',
        rt_vkPreis: '100',
        rt_erstattung: '100',
        rt_notizen: '',
        rt_saleId: '',
    }, over || {});
}
const VERKAUF = { id: 's1', datum: '2026-03-01', verkaufspreis: 100, marke: 'Acme',
                  artikeltyp: 'Regal', purchaseId: 'p1' };

console.log('\n── A. Schutz gegen unsinnige Betraege ────────────────────────');

block(() => {
    const t = lade(formular({ rt_vkPreis: '-50' }));
    t.absenden();
    check('A1 Negativer Verkaufspreis wird abgewiesen, nichts gespeichert',
        t.protokoll.gespeichert.length === 0 &&
        t.protokoll.toasts.some(x => x.art === 'error'));

    const t2 = lade(formular({ rt_erstattung: '-1' }));
    t2.absenden();
    check('A2 Negative Erstattung wird abgewiesen',
        t2.protokoll.gespeichert.length === 0 &&
        t2.protokoll.toasts.some(x => x.art === 'error'));

    // Eine Retoure ohne Erstattung ist zulaessig — Ware zurueck, Geld behalten kommt vor.
    const t3 = lade(formular({ rt_erstattung: '0' }));
    t3.absenden();
    check('A3 Null Erstattung ist erlaubt', t3.protokoll.gespeichert.length === 1);

    const t4 = lade(formular());
    t4.absenden();
    check('A4 Gueltige Eingabe wird gespeichert', t4.protokoll.gespeichert.length === 1);

    // Ein negativer Betrag wuerde ueber erstattungBetrag in EUER und §25a-Marge einfliessen
    // und dort das Vorzeichen drehen — deshalb greift der Schutz VOR jedem Storno.
    const t5 = lade(formular({ rt_vkPreis: '-50', rt_saleId: 's1' }), { sales: [VERKAUF] });
    t5.absenden();
    check('A5 Bei unsinnigem Betrag wird auch kein Verkauf storniert',
        t5.protokoll.storniertSale.length === 0);
});

console.log('\n── B. Unbeschaedigt: der Artikel geht zurueck ins Lager ──────');

block(() => {
    const t = lade(formular({ rt_zustand: 'Unbeschädigt', rt_saleId: 's1' }), { sales: [VERKAUF] });
    t.absenden();

    check('B1 Der Verkauf wird storniert', t.protokoll.storniertSale.length === 1 &&
        t.protokoll.storniertSale[0].id === 's1');
    // stornoSale() gibt die verknuepften Einkaeufe wieder als 'verfuegbar' frei. Ein zusaetzliches
    // stornoPurchase() wuerde den Artikel aus dem Bestand nehmen, obwohl er heil zurueckkam.
    check('B2 Der Einkauf wird NICHT storniert — der Artikel ist wiederverkaeuflich',
        t.protokoll.storniertPurchase.length === 0);
    check('B3 Der Materialverbrauch wird zurueckgebucht', t.protokoll.materialZurueck[0] === 's1');
    check('B4 Der Stornogrund nennt den Zustand',
        /Unbeschädigt/.test(erst(t.protokoll.storniertSale).grund || ''));
    check('B5 Die Retoure selbst wird gespeichert und traegt den Verkauf',
        t.protokoll.gespeichert.length === 1 && t.protokoll.gespeichert[0].saleId === 's1');
});

console.log('\n── C. Beschaedigt: der Artikel ist abzuschreiben ─────────────');

block(() => {
    const t = lade(formular({ rt_zustand: 'Beschädigt', rt_saleId: 's1' }), { sales: [VERKAUF] });
    t.absenden();

    check('C1 Der Verkauf wird storniert', t.protokoll.storniertSale.length === 1);
    // Der Unterschied zum Unbeschaedigt-Zweig: stornoSale hat den Einkauf freigegeben, er muss
    // danach WIEDER storniert werden — sonst stuende ein zerstoerter Artikel als Bestand da.
    check('C2 Der Einkauf wird zusaetzlich storniert', t.protokoll.storniertPurchase.length === 1 &&
        t.protokoll.storniertPurchase[0].id === 'p1');
    check('C3 Der Grund sagt, warum er nicht zurueckkommt',
        /nicht wiederverk/.test(erst(t.protokoll.storniertPurchase).grund || ''));
    check('C4 Der Materialverbrauch wird auch hier zurueckgebucht',
        t.protokoll.materialZurueck[0] === 's1');

    const mehrere = Object.assign({}, VERKAUF, { purchaseId: undefined, purchaseIds: ['p1', 'p2', 'p3'] });
    const t2 = lade(formular({ rt_zustand: 'Beschädigt', rt_saleId: 's1' }), { sales: [mehrere] });
    t2.absenden();
    check('C5 Bei mehreren verknuepften Einkaeufen werden ALLE storniert',
        t2.protokoll.storniertPurchase.map(x => x.id).join() === 'p1,p2,p3');

    const t3 = lade(formular({ rt_zustand: 'Fehlt/Verlust', rt_saleId: 's1' }), { sales: [VERKAUF] });
    t3.absenden();
    check('C6 "Fehlt/Verlust" wird wie "Beschädigt" behandelt',
        t3.protokoll.storniertPurchase.length === 1);

    const ohneEinkauf = Object.assign({}, VERKAUF, { purchaseId: undefined });
    const t4 = lade(formular({ rt_zustand: 'Beschädigt', rt_saleId: 's1' }), { sales: [ohneEinkauf] });
    t4.absenden();
    check('C7 Ein Verkauf ohne Lagerbezug erzeugt kein Storno ins Leere',
        t4.protokoll.storniertPurchase.length === 0 && t4.protokoll.gespeichert.length === 1);
});

console.log('\n── D. Retoure ohne verknuepften Verkauf ──────────────────────');

block(() => {
    const t = lade(formular({ rt_saleId: '' }));
    t.absenden();
    check('D1 Ohne Verknuepfung wird nichts storniert',
        t.protokoll.storniertSale.length === 0 && t.protokoll.storniertPurchase.length === 0 &&
        t.protokoll.materialZurueck.length === 0);
    check('D2 Die Retoure wird trotzdem erfasst, mit saleId null',
        t.protokoll.gespeichert.length === 1 && t.protokoll.gespeichert[0].saleId === null);

    // Zeigt der Verweis auf einen Verkauf, den es nicht (mehr) gibt, darf nichts passieren —
    // aber die Retoure muss erhalten bleiben, sonst verliert der Nutzer die Erfassung.
    const t2 = lade(formular({ rt_saleId: 'gibtsnicht' }), { sales: [VERKAUF] });
    t2.absenden();
    check('D3 Ein ins Leere zeigender Verkauf bricht das Speichern nicht ab',
        t2.protokoll.storniertSale.length === 0 && t2.protokoll.gespeichert.length === 1);
});

console.log('\n── E. Uebernommene Werte und Jahressumme ─────────────────────');

block(() => {
    const t = lade(formular({ rt_vkPreis: '120.50', rt_erstattung: '99.99', rt_notizen: '  Karton nass  ' }));
    t.absenden();
    const r = erst(t.protokoll.gespeichert);
    check('E1 Betraege kommen als Zahl in den Datensatz, nicht als Text',
        r.vkPreis === 120.5 && r.erstattungBetrag === 99.99);
    check('E2 Freitext wird getrimmt', r.notizen === 'Karton nass');
    check('E3 Datum und Zustand stehen im Datensatz',
        r.datum === '2026-04-01' && r.zustand === 'Unbeschädigt');

    // Die einzige Rechnung des Moduls: die Jahressumme der Erstattungen.
    const { R } = lade(formular(), {
        retouren: [
            { id: 'r1', datum: '2026-02-01', erstattungBetrag: 100 },
            { id: 'r2', datum: '2026-05-01', erstattungBetrag: 50.5 },
            { id: 'r3', datum: '2025-05-01', erstattungBetrag: 999 },
        ],
    });
    R._filterYear = '2026';
    const html2026 = R.render();
    R._filterYear = 'all';
    const htmlAlle = R.render();
    check('E4 Die Jahressumme zaehlt nur das gefilterte Jahr',
        html2026.includes('150.5') && !html2026.includes('1149.5'));
    check('E5 Ohne Filter zaehlt sie alles', htmlAlle.includes('1149.5'));
});

console.log('\n' + pass + '/' + total + ' Checks bestanden');
assert.strictEqual(pass, total, 'Retouren: ' + (total - pass) + ' Pruefung(en) fehlgeschlagen');
