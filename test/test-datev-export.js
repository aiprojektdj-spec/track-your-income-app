// Was im DATEV-Buchungsstapel ankommt — dem einzigen Export, den ein Dritter weiterverarbeitet.
//
// js/datev.js hatte bis zum 2026-09-13 keinen Test (Kategorie C in
// plan/funde-vollaudit-2026-09-09.md: 20 von 48 Modulen ohne Abdeckung). Das Audit vom
// 2026-08-10 hat das Modul mit 8/10 bewertet — allerdings anhand der Feldliste im Quelltext,
// nicht anhand einer gebauten Datei. Beim ersten echten Bauen fielen drei Fehler heraus, die
// in plan/funde-datev-2026-09-13.md stehen; dieser Harness haelt sie fest.
//
// Ein Fehler hier faellt nicht in der App auf, sondern beim Steuerberater — und dort erst,
// wenn die Zahlen schon gebucht sind.
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

const datevSrc = fs.readFileSync(__dirname + '/../js/datev.js', 'utf8');

// ── Modul laden ────────────────────────────────────────────────────────────
// js/datev.js ist ein IIFE ohne Modulsystem: Store und Utils kommen als Parameter herein,
// damit jeder Testfall seinen eigenen Datenbestand stellen kann.
function ladeMitDaten(o) {
    const d = Object.assign({
        settings: { ustMode: 'regel', ustVersteuerungsart: 'soll' },
        purchases: [], sales: [], expenses: [], invoices: [], customers: [],
    }, o || {});
    const Store = {
        getSettings:        () => d.settings,
        getAllPurchasesRaw: () => d.purchases,
        getAllSalesRaw:     () => d.sales,
        getAllExpensesRaw:  () => d.expenses,
        getRechInvoices:    () => d.invoices,
        getRechCustomers:   () => d.customers,
    };
    // Wird absichtlich mitgegeben, obwohl der Buchungstext es nicht mehr benutzt: faellt
    // jemand zurueck auf escapeHtml, schlaegt Pruefung E1 an statt an einem ReferenceError.
    const Utils = {
        escapeHtml: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
                                          .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
                                          .replace(/'/g, '&#39;'),
    };
    return new Function('Store', 'Utils', datevSrc + '\n; return DatevExport;')(Store, Utils);
}

// Quote-sicherer Feldzaehler (RFC-4180-artig, Trenner ';'). Ein naives split(';') zaehlt
// innerhalb gequoteter Felder mit und haette den eigentlichen Befund verdeckt.
function felder(line) {
    let n = 1, q = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (q && line[i + 1] === '"') i++; else q = !q; }
        else if (c === ';' && !q) n++;
    }
    return n;
}
function spalten(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (c === ';' && !q) { out.push(cur); cur = ''; }
        else cur += c;
    }
    out.push(cur);
    return out;
}
function baue(o, jahr, skr) {
    return ladeMitDaten(o).buildCSV(jahr || '2026', skr || 'SKR03').split('\r\n');
}
// Datenzeilen ohne die beiden Kopfzeilen
function buchungen(o, jahr, skr) {
    return baue(o, jahr, skr).slice(2).map(spalten);
}

const EINKAUF   = { id: 'p1', datum: '2026-02-01', einkaufspreis: 20, ustSatz: 19, marke: 'Acme', artikeltyp: 'Regal' };
const VERKAUF   = { id: 's1', datum: '2026-03-01', verkaufspreis: 100, versandkostenKaeufer: 5, plattform: 'Vinted' };
const AUSGABE   = { id: 'e1', datum: '2026-04-01', betrag: 50, kategorie: 'Porto', bezeichnung: 'Briefmarken' };
const RECHNUNG  = { id: 'i1', typ: 'rechnung', status: 'versendet', datum: '2026-05-01', nummer: 'RE-1',
                    positionen: [{ menge: 2, einzelpreis: 100, mwstSatz: 19 }] };

console.log('\n── A. Dateigeruest ───────────────────────────────────────────');

block(() => {
    const z = baue({ purchases: [EINKAUF] });
    check('A1 Kopfzeile nennt EXTF-Format und Buchungsstapel',
        z[0].startsWith('"EXTF";700;21;"Buchungsstapel";12'));
    check('A2 Wirtschaftsjahr und Zeitraum stammen aus dem Exportjahr',
        z[0].includes(';20260101;') && z[0].includes('"01.01.2026"') && z[0].includes('"31.12.2026"'));

    // Der eigentliche Regressionsschutz: vor dem 2026-09-13 war die Kopfzeile 96 Felder
    // breit und jede Datenzeile 116 — eine CSV, die so nicht importierbar ist. Die Breite
    // wird jetzt aus der Spaltenliste abgeleitet; diese Pruefung haelt das fest.
    const breiten = z.slice(1).map(felder);
    check('A3 Kopfzeile 2 und alle Datenzeilen sind gleich breit',
        breiten.length > 1 && breiten.every(b => b === breiten[0]));
    check('A4 Zeilen sind mit CRLF getrennt (DATEV-Vorgabe)',
        datevSrc.includes("join('\\r\\n')") && !z[0].includes('\n'));
    check('A5 Spaltenbreite steht nirgends mehr als feste Zahl im Code',
        !/new Array\(\s*\d+\s*\)/.test(datevSrc));
});

console.log('\n── B. Betraege, Datum, Waehrung ──────────────────────────────');

block(() => {
    const r = buchungen({ purchases: [EINKAUF] })[0];
    check('B1 Betrag mit Dezimalkomma und zwei Stellen', r[0] === '20,00');
    check('B2 Soll/Haben-Kennzeichen gesetzt', r[1] === 'S');
    check('B3 Waehrungskennzeichen EUR', r[2] === 'EUR');
    check('B4 Belegdatum im Format TTMM (Jahr steht im Kopf)', r[9] === '0102');
    const krumm = buchungen({ expenses: [Object.assign({}, AUSGABE, { betrag: 12.345 })] })[0];
    check('B5 Betrag wird kaufmaennisch auf zwei Stellen gerundet', krumm[0] === '12,35');
});

console.log('\n── C. Einnahmen ──────────────────────────────────────────────');

block(() => {
    const r = buchungen({ invoices: [RECHNUNG], customers: [] })[0];
    check('C1 Rechnung 19 % bucht brutto im Haben auf 8400 (SKR03)',
        r[0] === '238,00' && r[1] === 'H' && r[6] === '8400' && r[7] === '1800');

    const r04 = buchungen({ invoices: [RECHNUNG] }, '2026', 'SKR04')[0];
    check('C2 SKR04 nimmt 4400 statt 8400', r04[6] === '4400');

    const gut = buchungen({ invoices: [Object.assign({}, RECHNUNG, { typ: 'gutschrift', nummer: 'GS-1' })] })[0];
    check('C3 Gutschrift dreht auf Soll, Betrag bleibt positiv (§17 UStG)',
        gut[1] === 'S' && gut[0] === '238,00' && gut[13].startsWith('Gutschrift'));

    const klein = buchungen({
        settings: { ustMode: 'klein', ustVersteuerungsart: 'soll' },
        invoices: [Object.assign({}, RECHNUNG, { isKlein: true })],
    })[0];
    check('C4 Kleinunternehmer bucht auf 8200 ohne Umsatzsteuer',
        klein[6] === '8200' && klein[0] === '200,00' && klein[8] === '');

    const direkt = buchungen({ sales: [VERKAUF] })[0];
    check('C5 Direktverkauf zaehlt den Kaeufer-Versand zur Einnahme (wie UVA und EUER)',
        direkt[0] === '105,00' && direkt[1] === 'H');

    const doppelt = buchungen({
        invoices: [RECHNUNG],
        sales: [Object.assign({}, VERKAUF, { _invoiceId: 'i1' })],
    });
    check('C6 Verkauf zu einer Rechnung wird nicht zweimal gebucht', doppelt.length === 1);

    const beides = buchungen({ invoices: [RECHNUNG], sales: [VERKAUF] });
    check('C7 Direktverkauf faellt nicht weg, nur weil eine Rechnung existiert', beides.length === 2);
});

console.log('\n── D. Soll- und Ist-Versteuerung ─────────────────────────────');

block(() => {
    const offen = Object.assign({}, RECHNUNG, { status: 'versendet' });
    const soll = buchungen({ invoices: [offen] });
    check('D1 Soll-Versteuerung bucht die versendete Rechnung zum Rechnungsdatum',
        soll.length === 1 && soll[0][9] === '0105');

    const ist = buchungen({
        settings: { ustMode: 'regel', ustVersteuerungsart: 'ist' },
        invoices: [offen],
    });
    check('D2 Ist-Versteuerung laesst die unbezahlte Rechnung aussen vor', ist.length === 0);

    const bezahlt = buchungen({
        settings: { ustMode: 'regel', ustVersteuerungsart: 'ist' },
        invoices: [Object.assign({}, RECHNUNG, { status: 'bezahlt', bezahltAm: '2026-07-20' })],
    });
    check('D3 Ist-Versteuerung bucht zum Zahlungsdatum, nicht zum Rechnungsdatum',
        bezahlt.length === 1 && bezahlt[0][9] === '2007');

    const entwurf = buchungen({ invoices: [Object.assign({}, RECHNUNG, { status: 'entwurf' })] });
    check('D4 Entwuerfe und Angebote werden nie gebucht',
        entwurf.length === 0 &&
        buchungen({ invoices: [Object.assign({}, RECHNUNG, { typ: 'angebot' })] }).length === 0);
});

console.log('\n── E. Ausgaben ───────────────────────────────────────────────');

block(() => {
    const r = buchungen({ purchases: [EINKAUF] })[0];
    check('E1 Wareneinkauf 19 % bucht im Soll auf 3400', r[1] === 'S' && r[6] === '3400');

    // Der Fund vom 2026-09-13: die Menge fehlte. js/euer.js:104, js/statistiken.js und
    // js/lager.js bilden durchgehend einkaufspreis * (anzahl || 1) — der Stapel meldete
    // bei zehn Stueck ein Zehntel der Betriebsausgabe.
    const zehn = buchungen({ purchases: [Object.assign({}, EINKAUF, { anzahl: 10 })] })[0];
    check('E2 Sammel-Einkauf rechnet die Menge mit (anzahl × Einkaufspreis)', zehn[0] === '200,00');
    const ohne = buchungen({ purchases: [Object.assign({}, EINKAUF, { anzahl: undefined })] })[0];
    check('E3 Fehlende Menge zaehlt als 1, nicht als 0', ohne[0] === '20,00');

    const sieben = buchungen({ purchases: [Object.assign({}, EINKAUF, { ustSatz: 7 })] })[0];
    const null_ = buchungen({ purchases: [Object.assign({}, EINKAUF, { ustSatz: 0 })] })[0];
    check('E4 7 % bucht auf 3300, steuerfrei auf 3200 mit BU-Schluessel 40',
        sieben[6] === '3300' && null_[6] === '3200' && null_[8] === '40');

    const konten = ladeMitDaten({});
    check('E5 Kategorien treffen ihr SKR03-Konto',
        konten.kontoForKategorie('Porto', 'SKR03') === '4230' &&
        konten.kontoForKategorie('Plattformgebuehr', 'SKR03') === '4970' &&
        konten.kontoForKategorie('Fahrtkosten', 'SKR03') === '4660' &&
        konten.kontoForKategorie('AfA', 'SKR03') === '4840' &&
        konten.kontoForKategorie('Irgendwas', 'SKR03') === '4900');
    check('E6 Dieselben Kategorien treffen in SKR04 andere Konten',
        konten.kontoForKategorie('Porto', 'SKR04') === '6090' &&
        konten.kontoForKategorie('AfA', 'SKR04') === '6200');

    check('E7 Stornierte Belege werden nicht exportiert',
        buchungen({
            purchases: [Object.assign({}, EINKAUF, { storniert: true })],
            sales:     [Object.assign({}, VERKAUF, { storniert: true })],
            expenses:  [Object.assign({}, AUSGABE, { storniert: true })],
        }).length === 0);

    check('E8 Belege ausserhalb des Exportjahres bleiben draussen',
        buchungen({ purchases: [Object.assign({}, EINKAUF, { datum: '2025-12-31' })] }).length === 0 &&
        buchungen({ purchases: [Object.assign({}, EINKAUF, { datum: '2027-01-01' })] }).length === 0);

    check('E9 Betrag 0 erzeugt keine Leerbuchung',
        buchungen({ purchases: [Object.assign({}, EINKAUF, { einkaufspreis: 0 })] }).length === 0 &&
        buchungen({ expenses:  [Object.assign({}, AUSGABE, { betrag: 0 })] }).length === 0);

    const sortiert = buchungen({
        expenses: [Object.assign({}, AUSGABE, { id: 'e2', datum: '2026-11-01' }),
                   Object.assign({}, AUSGABE, { id: 'e3', datum: '2026-01-05' })],
    });
    check('E10 Buchungen stehen nach Belegdatum sortiert',
        sortiert[0][9] === '0501' && sortiert[1][9] === '0111');
});

console.log('\n── F. Buchungstext und CSV-Entschaerfung ─────────────────────');

block(() => {
    // Der zweite Fund vom 2026-09-13: Utils.escapeHtml lief ueber die Buchungstexte. Aus
    // "Reck & Schwarz" wurde "Reck &amp; Schwarz" — im Stapel des Steuerberaters. Die
    // Rechnungszeile hat den Kundennamen immer schon roh durchgereicht, dieselbe Datei war
    // also in sich widerspruechlich.
    const amp = buchungen({ purchases: [Object.assign({}, EINKAUF, { marke: 'Reck & Schwarz' })] })[0];
    check('F1 Kaufmaennisches Und bleibt stehen, keine HTML-Entitaet',
        amp[13].includes('Reck & Schwarz') && !amp[13].includes('&amp;'));

    const apo = buchungen({ sales: [Object.assign({}, VERKAUF, { plattform: "L'Atelier" })] })[0];
    check('F2 Apostroph bleibt ein Apostroph', apo[13].includes("L'Atelier") && !apo[13].includes('&#39;'));

    const semi = baue({ expenses: [Object.assign({}, AUSGABE, { bezeichnung: 'Porto; Nachnahme' })] });
    check('F3 Semikolon im Text sprengt die Spaltenzahl nicht',
        felder(semi[2]) === felder(semi[1]) && spalten(semi[2])[13] === 'Porto; Nachnahme');

    const quot = baue({ expenses: [Object.assign({}, AUSGABE, { bezeichnung: 'Ware "B" geliefert' })] });
    check('F4 Anfuehrungszeichen werden verdoppelt statt escaped',
        felder(quot[2]) === felder(quot[1]) && spalten(quot[2])[13] === 'Ware "B" geliefert');

    const lang = buchungen({ expenses: [Object.assign({}, AUSGABE, { bezeichnung: 'x'.repeat(200) })] })[0];
    check('F5 Buchungstext ist auf 60 Zeichen gedeckelt', lang[13].length === 60);

    const kunde = buchungen({ invoices: [Object.assign({}, RECHNUNG, { kundeId: 'k1' })],
                              customers: [{ id: 'k1', firma: 'Müller & Co' }] })[0];
    check('F6 Rechnungstext nennt Nummer und Kunden', kunde[13] === 'Rechnung RE-1 Müller & Co');

    check('F7 Belegfeld 1 traegt Rechnungsnummer bzw. Artikelnummer',
        buchungen({ invoices: [RECHNUNG] })[0][10] === 'RE-1' &&
        buchungen({ purchases: [Object.assign({}, EINKAUF, { artikelNr: 'SV-1042' })] })[0][10] === 'SV-1042');
});

console.log('\n── G. Welche Quellen der Stapel ueberhaupt liest ─────────────');

block(() => {
    // Diese Pruefung ist der Waechter ueber den dritten Fund vom 2026-09-13: der Stapel
    // liest vier Quellen, die EUER acht. Fahrtkosten, AfA, Materialverbrauch, Retouren,
    // Eigenbelege sowie Versandkosten und Plattformgebuehren des Verkaeufers fehlen also
    // im Export — die Einnahmen stehen vollstaendig drin, die Kosten nur zum Teil.
    //
    // Der Harness kann das nicht heilen (das ist eine Produktentscheidung, siehe
    // plan/funde-datev-2026-09-13.md), aber er haelt den Stand fest: kommt eine Quelle
    // dazu oder faellt eine weg, faellt diese Pruefung auf und zwingt zum Nachziehen.
    const gelesen = (datevSrc.match(/Store\.get[A-Za-z]+/g) || [])
        .map(s => s.replace('Store.', ''))
        .filter((v, i, a) => a.indexOf(v) === i).sort();
    const erwartet = ['getAllExpensesRaw', 'getAllPurchasesRaw', 'getAllSalesRaw',
                      'getExpenses', 'getPurchases', 'getRechCustomers',
                      'getRechInvoices', 'getSales', 'getSettings'].sort();
    check('G1 Der Stapel liest genau die bekannten Quellen — keine neue, keine verlorene',
        JSON.stringify(gelesen) === JSON.stringify(erwartet));

    // Bewusst NICHT gegen js/euer.js gemessen: an dieser Datei arbeiten regelmaessig
    // parallele Sessions, und ihre Quellenliste aendert sich (am 2026-09-13 ist der
    // Materialverbrauch dort gerade durch den Materialeinkauf ersetzt worden). Ein Harness,
    // der an einer fremden Baustelle haengt, schlaegt aus fremden Gruenden fehl. Die Liste
    // steht deshalb hier, mit Datum.
    const fehlendeQuellen = ['getFahrten', 'getAfaAnlagen', 'getRetouren'];
    check('G2 Die bekannte Luecke zu den EUER-Quellen ist unveraendert',
        fehlendeQuellen.every(q => !datevSrc.includes('Store.' + q)));
});

console.log('\n' + pass + '/' + total + ' Checks bestanden');
assert.strictEqual(pass, total, 'DATEV-Export: ' + (total - pass) + ' Pruefung(en) fehlgeschlagen');
