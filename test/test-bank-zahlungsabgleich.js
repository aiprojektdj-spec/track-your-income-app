// Test: Zahlungsabgleich Kontoumsatz -> offene Rechnung (Fund G3, Feature-Gap-Audit)
//
// Prueft die Zuordnungslogik aus js/bank-import.js isoliert in einem vm-Kontext:
// Node-Harness statt Browser, weil hier nur die Rechenregeln interessieren und der
// Browser-Cache bei localhost regelmaessig alten Code ausliefert (s. plan/OFFEN.md).
//
//   node test/test-bank-zahlungsabgleich.js

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'bank-import.js'), 'utf8');

// ── Fixtures ────────────────────────────────────────────────────────────────
const KUNDEN = [
    { id: 'k1', firma: 'Muster GmbH' },
    { id: 'k2', firma: 'Beispiel AG' },
];

function rechnung(o) {
    return Object.assign({
        typ: 'rechnung', status: 'offen', _storniert: false,
        isKlein: true, teilzahlungen: [], kundeId: 'k1',
    }, o);
}

// 119,00 EUR brutto bei 19% auf 100 netto
const POS_119 = [{ menge: 1, einzelpreis: 100, mwstSatz: 19 }];
const POS_100 = [{ menge: 1, einzelpreis: 100, mwstSatz: 0 }];

const INVOICES = [
    rechnung({ id: 'i1', nummer: 'RE-2026-0007', datum: '2026-03-01', positionen: POS_100 }),
    rechnung({ id: 'i2', nummer: 'RE-2026-0008', datum: '2026-03-02', positionen: POS_100, kundeId: 'k2' }),
    rechnung({ id: 'i3', nummer: 'RE-2026-0009', datum: '2026-03-03', positionen: POS_119, isKlein: false }),
    rechnung({ id: 'i4', nummer: 'RE-2026-0010', datum: '2026-03-04', positionen: POS_100,
               teilzahlungen: [{ datum: '2026-03-10', betrag: 40 }] }),
    rechnung({ id: 'i5', nummer: 'RE-2026-0011', datum: '2026-03-05', positionen: POS_100, status: 'bezahlt' }),
    rechnung({ id: 'i6', nummer: 'RE-2026-0012', datum: '2026-03-06', positionen: POS_100, _storniert: true, status: 'storniert' }),
    rechnung({ id: 'i7', nummer: 'AN-2026-0001', datum: '2026-03-07', positionen: POS_100, typ: 'angebot' }),
];

// ── Minimal-Stubs fuer die Modul-Abhaengigkeiten ────────────────────────────
const sandbox = {
    console,
    Store: {
        getSettings:      () => ({ ustMode: 'klein' }),
        getRechInvoices:  () => INVOICES,
        getRechCustomers: () => KUNDEN,
    },
    Utils: {
        formatCurrency: n => Number(n).toFixed(2).replace('.', ',') + ' €',
        formatDate:     d => d,
        escapeHtml:     s => String(s),
    },
    document: { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null },
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

// Die Helfer liegen in der IIFE — fuer den Test ueber eine Kopie des Quelltexts
// erreichbar machen, ohne die Produktivdatei um Test-Exports aufzublaehen.
const inner = src.replace('var BankImport = (function () {', 'var __probe = (function () {')
                 .replace(/return \{ render: render[^}]*\};/, 'return { matchCandidates: matchCandidates, autoPick: autoPick, invoiceRest: invoiceRest, openInvoices: openInvoices };');
vm.runInContext(inner, sandbox);
const B = sandbox.__probe;

// ── Testrahmen ──────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
function check(name, cond, detail) {
    if (cond) { pass++; console.log('  OK   ' + name); }
    else      { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
}
const tx = (amount, description, date) => ({ amount, description, date: date || '2026-03-20', isCredit: true });

console.log('\nZahlungsabgleich Bank -> Rechnung\n');

// 1) Grundmenge
const offen = B.openInvoices();
check('nur offene Rechnungen sind Kandidaten (bezahlt/storniert/Angebot raus)',
    offen.length === 4 && offen.every(i => ['i1', 'i2', 'i3', 'i4'].includes(i.id)),
    offen.map(i => i.id).join(','));

// 2) Restbetrag beruecksichtigt Teilzahlungen und USt
check('Restbetrag Kleinunternehmer ohne Teilzahlung = 100', B.invoiceRest(INVOICES[0]) === 100);
check('Restbetrag mit 19% USt = 119', Math.abs(B.invoiceRest(INVOICES[2]) - 119) < 0.005, B.invoiceRest(INVOICES[2]));
check('Restbetrag nach 40 EUR Teilzahlung = 60', Math.abs(B.invoiceRest(INVOICES[3]) - 60) < 0.005, B.invoiceRest(INVOICES[3]));

// 3) Rechnungsnummer im Verwendungszweck schlaegt alles
let c = B.matchCandidates(tx(100, 'Zahlung RE-2026-0008 Danke'), offen);
check('Nummer im Verwendungszweck gewinnt gegen gleichen Betrag', c[0].inv.id === 'i2', c[0].inv.id);
check('Nummerntreffer wird vorausgewaehlt', B.autoPick(c) && B.autoPick(c).inv.id === 'i2');

// 4) Schreibweisen-Toleranz
c = B.matchCandidates(tx(100, 'RE 2026 0008 Rechnungsausgleich'), offen);
check('Nummer mit Leerzeichen wird erkannt', c[0].inv.id === 'i2', c[0].inv.id);
c = B.matchCandidates(tx(100, 'ueberweisung re20260008'), offen);
check('Nummer klein und ohne Trenner wird erkannt', c[0].inv.id === 'i2', c[0].inv.id);

// 5) Gleichstand darf NICHT vorausgewaehlt werden — i1 und i2 sind beide 100,00 offen
c = B.matchCandidates(tx(100, 'Ueberweisung ohne Verwendungszweck'), offen);
check('zwei gleich gute Treffer werden nicht vorausgewaehlt', B.autoPick(c) === null,
    c.map(x => x.inv.id + ':' + x.score).join(','));

// 6) Kundenname als Zuenglein an der Waage
c = B.matchCandidates(tx(100, 'Gutschrift Beispiel AG'), offen);
check('Kundenname entscheidet bei sonst gleichem Betrag', c[0].inv.id === 'i2', c[0].inv.id);

// 7) Teilbetrag
c = B.matchCandidates(tx(30, 'Abschlag RE-2026-0010'), offen);
check('Teilbetrag findet die Rechnung ueber die Nummer', c[0].inv.id === 'i4', c[0].inv.id);
check('Teilbetrag wird als solcher begruendet',
    c[0].gruende.some(g => g.startsWith('Teilbetrag')), JSON.stringify(c[0].gruende));

// 8) Zahlung vor Rechnungsdatum ist ein Negativsignal
const nachher = B.matchCandidates(tx(119, 'RE-2026-0009', '2026-04-01'), offen)[0];
const vorherScore = B.matchCandidates(tx(119, 'RE-2026-0009', '2026-02-01'), offen)[0].score;
check('Vorkasse senkt den Score, schliesst aber nicht aus',
    vorherScore < nachher.score && vorherScore > 0, vorherScore + ' vs ' + nachher.score);

// 9) Kein Treffer bleibt kein Treffer
c = B.matchCandidates(tx(4711, 'Voellig fremder Betrag'), offen);
check('unpassender Betrag ergibt keinen Kandidaten', c.length === 0, JSON.stringify(c.map(x => x.inv.id)));

// 10) Vollstaendig bezahlte Rechnung taucht nie auf — auch dann nicht, wenn ihre Nummer
//     im Verwendungszweck steht. Andere Rechnungen duerfen hier sehr wohl ueber den Betrag
//     auftauchen; entscheidend ist, dass keine davon vorausgewaehlt wird (Gleichstand).
c = B.matchCandidates(tx(100, 'RE-2026-0011'), offen);
check('bereits bezahlte Rechnung ist kein Kandidat',
    !c.some(x => x.inv.id === 'i5'), JSON.stringify(c.map(x => x.inv.id)));
check('fremde Nummer fuehrt zu keiner Vorauswahl', B.autoPick(c) === null,
    c.map(x => x.inv.id + ':' + x.score).join(','));

// 11) Schwacher Treffer wird nicht vorausgewaehlt
c = B.matchCandidates(tx(59.5, 'irgendwas'), offen);
check('nur "Betrag weicht ab" reicht nicht fuer die Vorauswahl', B.autoPick(c) === null,
    c.length ? c[0].score : 'keine Kandidaten');

console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen\n');
process.exit(fail ? 1 : 0);
