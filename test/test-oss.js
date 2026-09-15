// OSS — EU-Fernverkauf an Privatkunden, §3c UStG.
//
// js/oss.js hatte bis zum 2026-09-15 keinen Test (Fund C aus
// plan/funde-vollaudit-2026-09-09.md). Das Modul ist klein, aber es entscheidet eine Frage mit
// Geld dahinter: ob auf eine Rechnung deutsche Umsatzsteuer gehoert oder die des Ziellandes.
//
// Der Kern ist _ueberSchwelleInvoiceIds() — und der wird nicht nur von der OSS-Seite benutzt,
// sondern von js/ustvoranmeldung.js:113, also von der Meldung, die beim Finanzamt landet.
// Genau deshalb steht hier die Schwellenmechanik im Mittelpunkt und nicht die Oberflaeche.
//
// Die scharfe Stelle ist §3c Abs. 4 UStG: Satz 1 wirkt PROSPEKTIV (erst der Umsatz, der die
// 10.000 € uebersteigt, loest das Bestimmungslandprinzip aus — frueher im Jahr liegende
// Rechnungen bleiben deutsch versteuert), Satz 2 dagegen RUECKWIRKEND ab dem ersten Euro, wenn
// schon das Vorjahr ueber der Schwelle lag. Wer das verwechselt, versteuert entweder zu frueh
// im Ausland oder zu spaet — beides faellt erst bei einer Pruefung auf.
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

const ossSrc = fs.readFileSync(__dirname + '/../js/oss.js', 'utf8');

// ── Modul laden ────────────────────────────────────────────────────────────
function lade(o) {
    const d = Object.assign({ invoices: [], customers: [], ustMode: 'regel' }, o || {});
    const Store = {
        getSettings:      () => ({ ustMode: d.ustMode }),
        getRechInvoices:  () => d.invoices,
        getRechCustomers: () => d.customers,
    };
    const Utils = { formatCurrency: (n) => String(n), formatDate: (x) => String(x), showToast: () => {}, downloadCSV: () => {} };
    const Vorsteuer = { EU_LAENDER: ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'] };
    const window = {};            // `if (window.Actions)` am Dateiende
    const document = { getElementById: () => null };
    return new Function('Store', 'Utils', 'Vorsteuer', 'window', 'document',
        ossSrc + '\n; return OSS;')(Store, Utils, Vorsteuer, window, document);
}

// Rechnung an einen EU-Privatkunden. Betrag = eine Position mit menge 1.
let lfd = 0;
function re(land, betrag, datum, over) {
    lfd++;
    return Object.assign({
        id: 'i' + lfd, typ: 'rechnung', status: 'versendet', datum: datum,
        kundeId: 'k-' + land,
        positionen: [{ menge: 1, einzelpreis: betrag }],
    }, over || {});
}
function kunde(land, over) {
    return Object.assign({ id: 'k-' + land, land: land }, over || {});
}
const KUNDEN = ['AT','FR','IT','PL','US','DE'].map(l => kunde(l));

console.log('\n── A. Wer ueberhaupt als EU-Fernverkauf zaehlt ───────────────');

block(() => {
    const umsatz = (inv, kd) => lade({ invoices: inv, customers: kd || KUNDEN })._jahresumsatz(2026);

    check('A1 EU-Privatkunde zaehlt', umsatz([re('AT', 500, '2026-03-01')]) === 500);
    check('A2 Deutscher Kunde zaehlt nicht (kein Fernverkauf)',
        umsatz([re('DE', 500, '2026-03-01')]) === 0);
    check('A3 Drittland zaehlt nicht (Ausfuhr, §4 Nr. 1a UStG)',
        umsatz([re('US', 500, '2026-03-01')]) === 0);
    check('A4 EU-Kunde MIT USt-IdNr zaehlt nicht (B2B, Reverse Charge)',
        umsatz([re('AT', 500, '2026-03-01')], [kunde('AT', { ustIdNr: 'ATU12345678' })]) === 0);
    check('A5 Kunde ohne Landangabe zaehlt nicht',
        umsatz([re('AT', 500, '2026-03-01')], [kunde('AT', { land: '' })]) === 0);
    check('A6 Entwurf und Angebot zaehlen nicht',
        umsatz([re('AT', 500, '2026-03-01', { status: 'entwurf' })]) === 0 &&
        umsatz([re('AT', 500, '2026-03-01', { typ: 'angebot' })]) === 0);

    // Store.stornoRechInvoice() setzt status='storniert' UND _storniert=true. Hier greift der
    // Status-Filter; die Pruefung haelt fest, dass ein Storno nicht in die Schwelle einfliesst.
    check('A7 Stornierte Rechnung zaehlt nicht mit',
        umsatz([re('AT', 5000, '2026-03-01', { status: 'storniert', _storniert: true })]) === 0);

    check('A8 Bezahlte Rechnung zaehlt wie eine versendete',
        umsatz([re('AT', 500, '2026-03-01', { status: 'bezahlt' })]) === 500);

    // §17 UStG: die Gutschrift mindert den Umsatz — sonst sinkt die kumulierte Schwelle nie,
    // wenn ein EU-Fernverkauf rueckabgewickelt wird.
    check('A9 Gutschrift rechnet gegen',
        umsatz([re('AT', 500, '2026-03-01'), re('AT', 200, '2026-04-01', { typ: 'gutschrift' })]) === 300);

    check('A10 Rechnung eines anderen Jahres zaehlt nicht',
        umsatz([re('AT', 500, '2025-03-01')]) === 0);

    const proLand = lade({
        invoices: [re('AT', 300, '2026-03-01'), re('FR', 200, '2026-04-01'), re('AT', 100, '2026-05-01')],
        customers: KUNDEN,
    })._calcLaender(2026);
    check('A11 Aufteilung nach Bestimmungsland summiert je Land',
        proLand.AT === 400 && proLand.FR === 200);
});

console.log('\n── B. §3c Abs. 4 Satz 1 — prospektiv, nicht rueckwirkend ─────');

block(() => {
    // Vier Rechnungen, die zusammen genau ueber die Schwelle laufen:
    // 4.000 + 4.000 = 8.000, dann 3.000 -> 11.000 reisst sie, dann noch eine.
    const inv = [
        re('AT', 4000, '2026-02-01'),
        re('FR', 4000, '2026-04-01'),
        re('IT', 3000, '2026-06-01'),   // dieser Umsatz uebersteigt die Schwelle
        re('PL', 1000, '2026-08-01'),
    ];
    const ids = lade({ invoices: inv, customers: KUNDEN })._ueberSchwelleInvoiceIds(2026);

    check('B1 Die beiden Rechnungen vor dem Ueberschreiten bleiben deutsch versteuert',
        !ids.has(inv[0].id) && !ids.has(inv[1].id));
    check('B2 Der Umsatz, der die Schwelle uebersteigt, ist selbst schon OSS-pflichtig',
        ids.has(inv[2].id));
    check('B3 Alles danach ebenfalls', ids.has(inv[3].id));
    check('B4 Genau zwei von vier Rechnungen sind betroffen', ids.size === 2);
});

block(() => {
    // §3c Abs. 4 UStG sagt "nicht ueberschritten" — bei exakt 10.000,00 € gilt die Ausnahme noch.
    // Ein '>=' statt '>' wuerde hier faelschlich das Bestimmungslandprinzip ausloesen.
    const exakt = [re('AT', 6000, '2026-02-01'), re('FR', 4000, '2026-04-01')];
    check('B5 Exakt 10.000,00 € reissen die Schwelle NICHT (striktes groesser-als)',
        lade({ invoices: exakt, customers: KUNDEN })._ueberSchwelleInvoiceIds(2026).size === 0);

    const einCent = [re('AT', 6000, '2026-02-01'), re('FR', 4000.01, '2026-04-01')];
    const idsCent = lade({ invoices: einCent, customers: KUNDEN })._ueberSchwelleInvoiceIds(2026);
    check('B6 Ein Cent darueber reisst sie — und trifft genau die zweite Rechnung',
        idsCent.size === 1 && idsCent.has(einCent[1].id));
});

block(() => {
    // Die Laufsumme muss chronologisch sein, nicht in Eingabereihenfolge: sonst haengt das
    // Ergebnis davon ab, in welcher Reihenfolge Rechnungen erfasst wurden.
    const unsortiert = [
        re('PL', 1000, '2026-11-01'),
        re('AT', 9500, '2026-01-01'),
        re('FR', 400,  '2026-06-01'),
    ];
    const ids = lade({ invoices: unsortiert, customers: KUNDEN })._ueberSchwelleInvoiceIds(2026);
    check('B7 Die Laufsumme laeuft nach Datum, nicht nach Eingabereihenfolge',
        !ids.has(unsortiert[1].id) && !ids.has(unsortiert[2].id) && ids.has(unsortiert[0].id));

    // Gutschrift senkt die Laufsumme wieder unter die Schwelle.
    const mitGutschrift = [
        re('AT', 9000, '2026-01-01'),
        re('FR', 2000, '2026-02-01', { typ: 'gutschrift' }),
        re('IT', 2000, '2026-03-01'),
    ];
    check('B8 Eine Gutschrift senkt die Laufsumme, die Schwelle bleibt ungerissen',
        lade({ invoices: mitGutschrift, customers: KUNDEN })._ueberSchwelleInvoiceIds(2026).size === 0);
});

console.log('\n── C. §3c Abs. 4 Satz 2 — Vorjahr wirkt rueckwirkend ─────────');

block(() => {
    const vorjahrDrueber = [
        re('AT', 11000, '2025-05-01'),   // Vorjahr ueber der Schwelle
        re('FR', 100,   '2026-02-01'),   // laufendes Jahr: winzig
        re('IT', 50,    '2026-03-01'),
    ];
    const ids = lade({ invoices: vorjahrDrueber, customers: KUNDEN })._ueberSchwelleInvoiceIds(2026);
    check('C1 Vorjahr ueber der Schwelle: schon der erste Euro des Jahres ist OSS-pflichtig',
        ids.size === 2 && ids.has(vorjahrDrueber[1].id) && ids.has(vorjahrDrueber[2].id));

    const vorjahrExakt = [re('AT', 10000, '2025-05-01'), re('FR', 100, '2026-02-01')];
    check('C2 Vorjahr exakt auf der Schwelle wirkt NICHT rueckwirkend',
        lade({ invoices: vorjahrExakt, customers: KUNDEN })._ueberSchwelleInvoiceIds(2026).size === 0);

    const vorjahrDrunter = [re('AT', 9999, '2025-05-01'), re('FR', 100, '2026-02-01')];
    check('C3 Vorjahr knapp darunter: das laufende Jahr faengt wieder bei null an',
        lade({ invoices: vorjahrDrunter, customers: KUNDEN })._ueberSchwelleInvoiceIds(2026).size === 0);
});

console.log('\n── D. Steuersaetze und Kleinunternehmer ──────────────────────');

block(() => {
    const O = lade({});
    check('D1 Alle 26 uebrigen EU-Laender haben einen Regelsatz hinterlegt',
        Object.keys(O.EU_VAT_RATES).length === 26 && !O.EU_VAT_RATES.DE);
    check('D2 Kein Satz ist unplausibel (15–28 %)',
        Object.values(O.EU_VAT_RATES).every(r => r >= 15 && r <= 28));
    check('D3 Der Stand der Satztabelle ist datiert',
        /^\d{4}-\d{2}-\d{2}$/.test(O.RATES_STAND));

    const klein = lade({ ustMode: 'klein' });
    check('D4 Kleinunternehmer bekommen die Seite gar nicht erst',
        klein.render().includes('Nur für Regelbesteuerer'));
});

console.log('\n── E. Was die Seite zeigt vs. was die UVA meldet ─────────────');

block(() => {
    // Dokumentierter Stand, kein Wunschverhalten: _calcLaender() summiert ALLE B2C-Rechnungen
    // des Jahres, auch die vor dem Ueberschreiten der Schwelle. Die Laendertabelle und der
    // CSV-Export der Seite legen darauf den Ziellandsatz — waehrend js/ustvoranmeldung.js die
    // prospektive Auswahl aus _ueberSchwelleInvoiceIds() benutzt.
    //
    // In einem Ueberschreitungsjahr weichen beide also auseinander. Siehe
    // plan/funde-oss-2026-09-15.md; diese Pruefung haelt die Luecke fest, damit sie nicht
    // still waechst oder unbemerkt verschwindet.
    const inv = [re('AT', 8000, '2026-02-01'), re('AT', 4000, '2026-09-01')];
    const O = lade({ invoices: inv, customers: KUNDEN });

    const seite = O._calcLaender(2026).AT;
    const ids = O._ueberSchwelleInvoiceIds(2026);
    const uva = inv.filter(i => ids.has(i.id)).reduce((s, i) => s + i.positionen[0].einzelpreis, 0);

    check('E1 Die Seite weist den vollen Jahresumsatz je Land aus', seite === 12000);
    check('E2 Die UVA meldet nur den Teil ab dem Ueberschreiten', uva === 4000);
    check('E3 Die Differenz ist genau der vorschwellige Umsatz (8.000 €)', seite - uva === 8000);

    check('E4 Die Laendertabelle zieht ihre Zahlen unveraendert aus _calcLaender',
        /_calcLaender\(year\)/.test(ossSrc) &&
        !/ueberSchwelleInvoiceIds\(year\)[\s\S]{0,400}_exportCSV/.test(ossSrc));
});

console.log('\n' + pass + '/' + total + ' Checks bestanden');
assert.strictEqual(pass, total, 'OSS: ' + (total - pass) + ' Pruefung(en) fehlgeschlagen');
