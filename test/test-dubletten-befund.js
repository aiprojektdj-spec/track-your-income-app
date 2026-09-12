// Harness fuer App._dublettenBefund() — die Fernsupport-Pruefung im Diagnose-Export.
//
// Warum ein eigener Harness: die Funktion ist das einzige Instrument, mit dem ein
// gemeldetes "alles doppelt" beim Kunden ueberhaupt eingeordnet werden kann. Zaehlt sie
// falsch, schickt sie die Fehlersuche in die falsche Richtung — teurer als gar keine
// Zahl. Geprueft wird deshalb jeder der drei Befunde einzeln UND die Gegenprobe, dass
// saubere Daten schweigen.
//
// Die Funktion wird aus js/app.js herausgeschnitten und gegen ein Mock-Store ausgefuehrt
// (gleiches Muster wie test/test-store-gobd-fixes.js) — app.js laesst sich in Node nicht
// laden, es haengt am DOM.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

// endeMuster muss mitgegeben werden: die Liste schliesst mit "    ]," , die Funktion mit
// "    }," — ein gemeinsames Muster schnitte die Liste bis ins naechste Member hinein.
function schneide(name, startMuster, endeMuster) {
    const start = src.indexOf(startMuster);
    if (start < 0) throw new Error('Nicht gefunden in app.js: ' + name);
    const ende = src.indexOf(endeMuster, start);
    if (ende < 0) throw new Error('Ende nicht gefunden: ' + name);
    return src.slice(start, ende + endeMuster.length - 1);   // ohne das Komma
}

const quellenSrc = schneide('_DUBLETTEN_QUELLEN', '_DUBLETTEN_QUELLEN: [', '\n    ],');
const befundSrc  = schneide('_dublettenBefund', '_dublettenBefund() {', '\n    },');

// Mock-App mit echtem Funktionskoerper
const App = {};
global.Store = { _cache: {} };
eval('App.' + quellenSrc.replace('_DUBLETTEN_QUELLEN: [', '_DUBLETTEN_QUELLEN = [').replace(/\]$/, '];'));
eval('App.' + befundSrc.replace('_dublettenBefund() {', '_dublettenBefund = function () {') + ';');

let fehler = 0;
function pruefe(name, ist, soll) {
    const ok = ist === soll;
    if (!ok) fehler++;
    console.log((ok ? 'OK  ' : 'FAIL') + '  ' + name + '  (ist=' + ist + ', soll=' + soll + ')');
}

function befundFuer(records, key) {
    Store._cache = {};
    Store._cache[key || 'co_test__reselling_expenses'] = JSON.stringify(records);
    const zeilen = App._dublettenBefund();
    if (zeilen.length !== 1) throw new Error('Erwartet genau 1 Zeile, bekommen: ' + zeilen.length);
    const z = zeilen[0];
    const zahl = (label) => {
        const m = z.match(new RegExp(label + ': (\\d+)'));
        return m ? parseInt(m[1], 10) : -1;
    };
    return { zeile: z, n: zahl('n='.replace('=', '')) , gleicheId: zahl('gleiche ID'), gleicherInhalt: zahl('gleicher Inhalt'), ohneId: zahl('ohne ID') };
}

console.log('\n== 1. Saubere Daten schweigen ==');
{
    const b = befundFuer([
        { id: 'a', datum: '2026-01-01', beschreibung: 'Porto',   betrag: 5 },
        { id: 'b', datum: '2026-01-02', beschreibung: 'Karton',  betrag: 9 }
    ]);
    pruefe('gleiche ID',      b.gleicheId, 0);
    pruefe('gleicher Inhalt', b.gleicherInhalt, 0);
    pruefe('ohne ID',         b.ohneId, 0);
}

console.log('\n== 2. Derselbe Datensatz zweimal im Array (Merge-/Migrationsfehler) ==');
{
    const rec = { id: 'a', datum: '2026-01-01', beschreibung: 'Porto', betrag: 5 };
    const b = befundFuer([rec, Object.assign({}, rec), { id: 'b', datum: '2026-01-02', beschreibung: 'Karton', betrag: 9 }]);
    pruefe('gleiche ID',      b.gleicheId, 1);
    pruefe('gleicher Inhalt', b.gleicherInhalt, 1);   // faellt zwangslaeufig auch hier auf
    pruefe('ohne ID',         b.ohneId, 0);
}

console.log('\n== 3. Zwei echte Speichervorgaenge (Schreibpfad/Import) ==');
{
    const b = befundFuer([
        { id: 'a', datum: '2026-01-01', beschreibung: 'Porto', betrag: 5 },
        { id: 'b', datum: '2026-01-01', beschreibung: 'Porto', betrag: 5 }
    ]);
    pruefe('gleiche ID',      b.gleicheId, 0);        // IDs eindeutig -> KEIN Merge-Fehler
    pruefe('gleicher Inhalt', b.gleicherInhalt, 1);
    pruefe('ohne ID',         b.ohneId, 0);
}

console.log('\n== 4. Datensaetze ohne ID ==');
{
    const b = befundFuer([
        { datum: '2026-01-01', beschreibung: 'Porto',  betrag: 5 },
        { id: '',  datum: '2026-01-02', beschreibung: 'Karton', betrag: 9 },
        { id: 'c', datum: '2026-01-03', beschreibung: 'Folie',  betrag: 3 }
    ]);
    pruefe('ohne ID',    b.ohneId, 2);
    pruefe('gleiche ID', b.gleicheId, 0);   // die beiden ID-losen duerfen NICHT als ID-Dublette zaehlen
}

console.log('\n== 5. Keine Verklebung zweier Felder zur falschen Signatur ==');
{
    // join('|') haette hier ["2026-01-01","Nik","e5"] und ["2026-01-01","Nike","5"]
    // gleichgemacht. JSON.stringify quotet die Felder und trennt sie damit sauber.
    const b = befundFuer([
        { id: 'a', datum: '2026-01-01', beschreibung: 'Nik',  betrag: 'e5' },
        { id: 'b', datum: '2026-01-01', beschreibung: 'Nike', betrag: '5' }
    ]);
    pruefe('gleicher Inhalt', b.gleicherInhalt, 0);
}

console.log('\n== 6. Alle Firmen und alle vier Datenarten werden erfasst ==');
{
    Store._cache = {
        'co_eins__reselling_expenses':  JSON.stringify([{ id: 'a', datum: '2026-01-01', betrag: 1 }]),
        'co_zwei__reselling_expenses':  JSON.stringify([{ id: 'b', datum: '2026-01-01', betrag: 1 }]),
        'co_eins__reselling_purchases': JSON.stringify([{ id: 'c', datum: '2026-01-01', einkaufspreis: 1 }]),
        'co_eins__reselling_sales':     JSON.stringify([{ id: 'd', datum: '2026-01-01', verkaufspreis: 1 }]),
        'co_eins__rechnungsbuch_dokumente': JSON.stringify([{ id: 'e', datum: '2026-01-01', nummer: 'RE-1' }]),
        'co_eins__reselling_settings':  JSON.stringify({ ustMode: 'klein' })   // kein Datensatz-Array
    };
    const zeilen = App._dublettenBefund();
    pruefe('Zeilenzahl', zeilen.length, 5);
    pruefe('beide Firmen getrennt', zeilen.filter(z => z.indexOf('co_eins') >= 0).length, 4);
}

console.log('\n== 7. Robustheit: kaputte und leere Werte legen die Pruefung nicht lahm ==');
{
    Store._cache = {
        'co_a__reselling_expenses': '{kein json',
        'co_b__reselling_expenses': JSON.stringify([]),
        'co_c__reselling_expenses': JSON.stringify([null, { id: 'x', datum: '2026-01-01', betrag: 1 }])
    };
    let zeilen;
    try { zeilen = App._dublettenBefund(); } catch (e) { zeilen = ['WURF: ' + e.message]; }
    pruefe('nur die brauchbare Firma gemeldet', zeilen.length, 1);
    pruefe('null-Eintrag stuerzt nicht ab', zeilen[0].indexOf('co_c') >= 0, true);
}

console.log('\n' + (fehler === 0 ? 'Alle Pruefungen gruen.' : fehler + ' PRUEFUNG(EN) FEHLGESCHLAGEN'));
process.exit(fehler === 0 ? 0 : 1);
