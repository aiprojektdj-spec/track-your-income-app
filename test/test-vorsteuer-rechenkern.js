// Vorsteuer-Rechenkern (js/vorsteuer.js) — Testluecke A4 #4.
//
// Bisher getestet: _calcFromExpenses (test-vorsteuer-ustsatz-unklar.js, test-nicht-abziehbare-ba.js)
// und _calcRcAusgaben (test-kfz-1prozent.js). Hier: _calcFromPurchases, _belegCheck,
// _belegSummary, _calcManualEntries, _calcTotal, _periodStart/_periodEnd.
//
// Laedt den echten Code per ladeModule (utils.js + vorsteuer.js), nur Store ist ein Mock.
// Getestet wird Eingabe -> Ergebnis, keine internen Konstantennamen. Die Betraege sind so
// gewaehlt, dass Brutto/(1+Satz) im Gleitkomma exakt aufgeht — darum strikt `===`, kein Epsilon.
'use strict';
const { ladeModule } = require('./_lade-module');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}

const daten = { purchases: [], ausgaben: [], vorsteuer_entries: [], settings: {} };
const Store = {
    get: k => daten[k],
    set: (k, v) => { daten[k] = v; },
    getPurchases: () => daten.purchases,
    getExpenses: () => daten.ausgaben,
    getSettings: () => daten.settings
};
const ctx = ladeModule(['js/utils.js', 'js/vorsteuer.js'], { Store, document: undefined });
const V = ctx.Vorsteuer;
const JAHR = ['2026-01-01', '2026-12-31'];

// ── 1) _calcFromPurchases ──────────────────────────────────────────────────────
daten.purchases = [
    { datum: '2026-02-01', einkaufspreis: 119, anzahl: 1, ustSatz: 19 },      // VSt 19, netto 100
    { datum: '2026-02-02', einkaufspreis: 119, anzahl: 2, ustSatz: '19' },    // Menge 2 -> VSt 38, netto 200
    { datum: '2026-02-03', einkaufspreis: 107, anzahl: 1, ustSatz: 7 },       // VSt 7, netto 100
    { datum: '2026-02-04', einkaufspreis: 500, anzahl: 1, ustSatz: 0 },       // Privatankauf: keine VSt
    { datum: '2026-02-05', einkaufspreis: 119, anzahl: 1, ustSatz: 19, storniert: true }, // storniert
    { datum: '2025-12-31', einkaufspreis: 119, anzahl: 1, ustSatz: 19 },      // ausserhalb
    { datum: '2026-02-06', einkaufspreis: 59.5 }                              // ohne Satz/Menge
];
let p = V._calcFromPurchases(...JAHR);
// Der Einkauf ohne Satz faellt bewusst auf 19 % (anders als bei Ausgaben, s. Bericht) -> 9,5
check('Einkauf: vst19 = 19 + 38 + 9,5 = 66,5 (Menge zaehlt, ohne anzahl = 1)', p.vst19 === 66.5);
check('Einkauf: netto19 = 100 + 200 + 50 = 350', p.netto19 === 350);
check('Einkauf: vst7 = 7', p.vst7 === 7);
check('Einkauf: netto7 = 100', p.netto7 === 100);
check('Einkauf: count = 5 (storniert und Vorjahr raus, 0 %-Ankauf zaehlt mit)', p.count === 5);

// ustSatz 0 als String darf nicht auf 19 fallen
daten.purchases = [{ datum: '2026-03-01', einkaufspreis: 119, anzahl: 1, ustSatz: '0' }];
p = V._calcFromPurchases(...JAHR);
check("Einkauf: ustSatz '0' -> keine Vorsteuer", p.vst19 === 0 && p.vst7 === 0);
// kaputter Satz -> 19
daten.purchases = [{ datum: '2026-03-01', einkaufspreis: 119, anzahl: 1, ustSatz: 'abc' }];
check("Einkauf: ustSatz 'abc' -> 19 % (19)", V._calcFromPurchases(...JAHR).vst19 === 19);

// Kleinunternehmer-Zeitraum: SteuerStatus.istRegel false -> nicht in der Vorsteuer
daten.purchases = [
    { datum: '2026-03-01', einkaufspreis: 119, anzahl: 1, ustSatz: 19, ku: true },
    { datum: '2026-03-02', einkaufspreis: 238, anzahl: 1, ustSatz: 19 }
];
ctx.SteuerStatus = { istRegel: r => !r.ku };
p = V._calcFromPurchases(...JAHR);
check('Einkauf: KU-Zeitraum zaehlt nicht (vst19 = 38, count = 1)', p.vst19 === 38 && p.count === 1);
delete ctx.SteuerStatus;

// ── 2) _belegCheck: §33 UStDV Kleinbetrag bis einschliesslich 250 € ────────────
let b = V._belegCheck({ lieferant: 'Muster GmbH' }, 250);
check('Beleg: 250,00 € = Kleinbetrag, Name reicht', b.kleinbetrag === true && b.complete === true);
b = V._belegCheck({ lieferant: 'Muster GmbH' }, 250.01);
check('Beleg: 250,01 € kein Kleinbetrag, Steuer-ID fehlt',
    b.kleinbetrag === false && b.complete === false && b.missing.length === 1 && b.missing[0] === 'Steuernr./USt-IdNr.');
b = V._belegCheck({ lieferantName: 'X', lieferantSteuerId: 'DE123456789' }, 1000);
check('Beleg: ueber 250 € mit Name + Steuer-ID vollstaendig', b.complete === true);
b = V._belegCheck({ haendler: 'Flohmarkt Meier' }, 20);
check('Beleg: Lager-Feld haendler zaehlt als Aussteller', b.complete === true);
b = V._belegCheck({ lieferant: '   ', lieferantSteuerId: '  ' }, 300);
check('Beleg: nur Leerzeichen = beide Angaben fehlen', b.complete === false && b.missing.length === 2);

// ── 3) _belegSummary: nur Eintraege mit Satz > 0 ───────────────────────────────
daten.purchases = [
    { datum: '2026-04-01', einkaufspreis: 100, anzahl: 3, ustSatz: 19, lieferant: 'A' },   // 300 € ohne ID -> unvollst.
    { datum: '2026-04-02', einkaufspreis: 100, anzahl: 1, ustSatz: 19, lieferant: 'A' },   // 100 € -> vollst.
    { datum: '2026-04-03', einkaufspreis: 100, anzahl: 1, ustSatz: 0 },                    // 0 % -> zaehlt nicht
    { datum: '2026-04-04', einkaufspreis: 100, anzahl: 1, ustSatz: 19, storniert: true }   // storniert
];
daten.ausgaben = [
    { datum: '2026-04-05', betrag: 50, ustSatz: 7, lieferant: 'B' },     // vollst.
    { datum: '2026-04-06', betrag: 50, ustSatz: 19 },                    // ohne Name
    { datum: '2026-04-07', betrag: 50 },                                 // unklar -> zaehlt nicht
    { datum: '2026-04-08', betrag: 50, ustSatz: 'rc', lieferant: 'C' },  // rc -> zaehlt nicht
    { datum: '2026-04-09', betrag: 50, ustSatz: 0, lieferant: 'D' }      // 0 % -> zaehlt nicht
];
const s = V._belegSummary(...JAHR);
check('Belegsumme: total = 4 (2 Einkaeufe + 2 Ausgaben mit Satz > 0)', s.total === 4);
check('Belegsumme: complete = 2 (Menge 3 hebt den Einkauf ueber 250 €)', s.complete === 2);

// ── 4) _calcManualEntries ──────────────────────────────────────────────────────
daten.vorsteuer_entries = [
    { datum: '2026-05-01', typ: 'reverse_charge', vorsteuerBetrag: '19' },
    { datum: '2026-05-02', typ: 'reverse_charge', vorsteuerBetrag: 38 },
    { datum: '2026-05-03', typ: 'ig_erwerb', vorsteuerBetrag: 9.5 },
    { datum: '2026-05-04', typ: 'sonstiges', vorsteuerBetrag: 4 },
    { datum: '2026-05-05', vorsteuerBetrag: 'kaputt' },                  // ohne Typ, NaN -> 0
    { datum: '2027-01-01', typ: 'reverse_charge', vorsteuerBetrag: 100 } // ausserhalb
];
let m = V._calcManualEntries(...JAHR);
check('Manuell: reverseCharge = 57, rcCount = 2', m.reverseCharge === 57 && m.rcCount === 2);
check('Manuell: igErwerb = 9,5, igCount = 1', m.igErwerb === 9.5 && m.igCount === 1);
check('Manuell: sonstige = 4 (kaputter Betrag = 0)', m.sonstige === 4);
check('Manuell: entries = 5 im Zeitraum', m.entries.length === 5);
// Kleinunternehmer: Eintrag zaehlt mit, aber ohne Vorsteuerabzug (§19 Abs. 1 UStG)
ctx.SteuerStatus = { istRegel: () => false };
m = V._calcManualEntries(...JAHR);
check('Manuell: KU -> Betraege 0, Zaehler bleiben', m.reverseCharge === 0 && m.igErwerb === 0 && m.sonstige === 0 && m.rcCount === 2);
delete ctx.SteuerStatus;

// ── 5) _calcTotal: Summe aller Quellen, 0 %/unklar/rc-Ausgaben ohne VSt ────────
daten.purchases = [
    { datum: '2026-06-01', einkaufspreis: 119, anzahl: 1, ustSatz: 19 },  // 19
    { datum: '2026-06-02', einkaufspreis: 107, anzahl: 1, ustSatz: 7 }    // 7
];
daten.ausgaben = [
    { datum: '2026-06-03', betrag: 238, ustSatz: 19 },   // 38
    { datum: '2026-06-04', betrag: 107, ustSatz: 7 },    // 7
    { datum: '2026-06-05', betrag: 500 },                // unklar -> 0
    { datum: '2026-06-06', betrag: 80, ustSatz: 0 },     // 0
    { datum: '2026-06-07', betrag: 100, ustSatz: 'rc' }  // §13b: 19 Steuer, 19 VSt
];
daten.vorsteuer_entries = [{ datum: '2026-06-08', typ: 'ig_erwerb', vorsteuerBetrag: 10 }];
const t = V._calcTotal(...JAHR);
check('Gesamt: 19 + 7 + 38 + 7 + 10 + 19 = 100', t.totalVorsteuer === 100);
check('Gesamt: §13b-Ausgabe einmal als Vorsteuer (rcAus.vorsteuer = 19)', t.rcAus.vorsteuer === 19);
check('Gesamt: unklare Ausgabe ausgewiesen, nicht abgezogen', t.exp.unklarCount === 1 && t.exp.unklarBetrag === 500);

// ── 6) _periodStart / _periodEnd ───────────────────────────────────────────────
check('Zeitraum: Jahr 2026 -> 2026-01-01', V._periodStart(2026, null) === '2026-01-01');
check('Zeitraum: Jahr 2026 -> 2026-12-31', V._periodEnd(2026, undefined) === '2026-12-31');
check('Zeitraum: Januar (Monat 0) beginnt 2026-01-01', V._periodStart(2026, 0) === '2026-01-01');
check('Zeitraum: Dezember (Monat 11) beginnt 2026-12-01', V._periodStart(2026, 11) === '2026-12-01');
check('Zeitraum: Februar 2026 endet am 28.', V._periodEnd(2026, 1) === '2026-02-28');
check('Zeitraum: Februar 2028 (Schaltjahr) endet am 29.', V._periodEnd(2028, 1) === '2028-02-29');
check('Zeitraum: April endet am 30.', V._periodEnd(2026, 3) === '2026-04-30');
check('Zeitraum: Dezember endet am 31.', V._periodEnd(2026, 11) === '2026-12-31');
check('Zeitraum: Monat 0 ist nicht "kein Monat" (endet 2026-01-31)', V._periodEnd(2026, 0) === '2026-01-31');

console.log('\n' + pass + '/' + total + ' Tests bestanden ' + (pass === total ? '✅' : '❌'));
