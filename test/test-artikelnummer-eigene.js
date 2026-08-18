// Regressionstest: eigene Artikelnummern (2026-08-14)
//  A) js/store.js  isArtikelNrTaken() + savePurchase(): eine geaenderte Artikelnummer wird jetzt
//     uebernommen statt still auf den alten Wert zurueckgesetzt; Duplikate werden abgelehnt.
//  B) lager/page.js _makeArtNrMatcher(): der Verkaeufe-Import findet auch frei gewaehlte Nummern
//     (z.B. "SV-1042"), nicht nur das automatische JJJJ-NNN-Muster.
//  C) Suffix-Logik des Excel-Imports: kollidierende Nummern bekommen -2/-3, nichts wird
//     ueberschrieben und nichts geht verloren.
// Testet den ECHTEN Code per Quelltext-Extraktion (gleiches Vorgehen wie die anderen test-*.js
// in diesem Repo, da store.js/page.js wegen DOM-/localStorage-Globals nicht require()-bar sind).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function extractMethod(src, startMarker, endMarkerRe) {
    const startIdx = src.indexOf(startMarker);
    assert.ok(startIdx !== -1, 'Marker nicht gefunden: ' + startMarker);
    const rest = src.slice(startIdx + startMarker.length);
    const m = rest.match(endMarkerRe);
    assert.ok(m, 'Ende-Marker nicht gefunden nach ' + startMarker);
    return rest.slice(0, m.index);
}

const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'store.js'), 'utf8');
const pageSrc  = fs.readFileSync(path.join(__dirname, '..', 'lager', 'page.js'), 'utf8');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); }
}

// ── A) Store: Artikelnummer aendern ───────────────────────────────────────────
const isTakenBody = extractMethod(storeSrc, 'isArtikelNrTaken(nr, exceptId) {', /\n    \},/);
const isArtikelNrTaken = new Function('nr', 'exceptId', isTakenBody);

const savePurchaseBody = extractMethod(storeSrc, 'savePurchase(purchase) {', /\n    \},/);
const savePurchase = new Function('purchase', savePurchaseBody);

function mockStore(initial) {
    return {
        _data: initial.slice(),
        audit: [],
        getAllPurchasesRaw() { return this._data; },
        isLocked() { return false; },
        isArtikelNrTaken,
        _addAuditEntry(a, b, c, alt, neu) { this.audit.push({ alt: alt, neu: neu }); },
        _stampRecord(r) { return r; },
        _warnIfPeriodLocked() {},
        generateId() { return 'id_' + (this._data.length + 1); },
        set(k, v) { if (k === 'purchases') this._data = v; },
        savePurchase
    };
}

const bestand = [
    { id: 'p1', artikelNr: '2026-001', beschreibung: 'Jacke' },
    { id: 'p2', artikelNr: 'SV-1042',  beschreibung: 'Hose'  }
];

// A1: freie neue Nummer wird uebernommen (vorher: still verworfen)
let st = mockStore(bestand);
st.savePurchase({ id: 'p1', artikelNr: 'SV-9000', beschreibung: 'Jacke' });
check('A1 geaenderte Artikelnummer wird gespeichert',
      st._data.find(p => p.id === 'p1').artikelNr === 'SV-9000');

// A2: bereits vergebene Nummer wird abgelehnt, alte bleibt stehen
st = mockStore(bestand);
st.savePurchase({ id: 'p1', artikelNr: 'SV-1042', beschreibung: 'Jacke' });
check('A2 vergebene Nummer wird abgelehnt, alte bleibt',
      st._data.find(p => p.id === 'p1').artikelNr === '2026-001');

// A3: leeres Feld = alte Nummer behalten
st = mockStore(bestand);
st.savePurchase({ id: 'p1', artikelNr: '', beschreibung: 'Jacke' });
check('A3 leeres Feld behaelt die alte Nummer',
      st._data.find(p => p.id === 'p1').artikelNr === '2026-001');

// A4: unveraenderte Nummer kollidiert nicht mit sich selbst
st = mockStore(bestand);
st.savePurchase({ id: 'p1', artikelNr: '2026-001', beschreibung: 'Jacke neu' });
check('A4 unveraenderte Nummer bleibt erhalten',
      st._data.find(p => p.id === 'p1').artikelNr === '2026-001');

// A5: isArtikelNrTaken klammert den eigenen Datensatz aus
st = mockStore(bestand);
check('A5 isArtikelNrTaken: eigener Datensatz zaehlt nicht',
      isArtikelNrTaken.call(st, '2026-001', 'p1') === false &&
      isArtikelNrTaken.call(st, '2026-001', 'p2') === true &&
      isArtikelNrTaken.call(st, '   ', 'p9') === false);

// A6: Neuanlage vergibt weiterhin automatisch JJJJ-NNN
st = mockStore([{ id: 'p1', artikelNr: String(new Date().getFullYear()) + '-007' }]);
const neu = st.savePurchase({ beschreibung: 'Neu', einkaufspreis: 5 });
check('A6 Neuanlage zaehlt die Jahresnummer hoch',
      neu.artikelNr === String(new Date().getFullYear()) + '-008');

// ── B) Verkaeufe-Import: Matcher ──────────────────────────────────────────────
const matcherBody = extractMethod(pageSrc, '_makeArtNrMatcher(artNrMap) {', /\n    \},/);
const makeArtNrMatcher = new Function('artNrMap', matcherBody);

const map = { '2026-042': 1, '2026-0421': 1, 'SV-1042': 1, 'AB': 1 };
const find = makeArtNrMatcher(map);

check('B1 automatische Nummer wird gefunden',      find('Nike Jacke 2026-042 Gr. M') === '2026-042');
check('B2 eigene Nummer wird gefunden',            find('Vintage Hose SV-1042') === 'SV-1042');
check('B3 eigene Nummer klein geschrieben',        find('vintage hose sv-1042') === 'SV-1042');
check('B4 laengere Nummer gewinnt',                find('Artikel 2026-0421 blau') === '2026-0421');
check('B5 kein Treffer ohne Nummer',               find('Nike Jacke Gr. M') === null);
check('B6 unbekannte Nummer ergibt keinen Treffer', find('Artikel 2099-999') === null);
check('B7 Teiltreffer mitten im Wort zaehlt nicht', find('XSV-1042X') === null);
check('B8 zu kurze Nummern werden ignoriert',      find('Ware AB rot') === null);

// ── C) Suffix-Logik des Excel-Imports ─────────────────────────────────────────
// uniqueNr steht als lokale Closure in _import(); die Logik wird hier nachgebildet und gegen
// den Quelltext gegengeprueft, damit ein Umbau nicht unbemerkt am Test vorbeilaeuft.
check('C0 uniqueNr existiert im Import-Pfad',
      /const uniqueNr = wunsch => \{[\s\S]*?while \(usedNrs\.has\(nr\)\)/.test(pageSrc));
check('C0b eigene Nummer hat Vorrang vor der Generierung',
      /if \(row\.artikelNr\) \{[\s\S]*?uniqueNr\(row\.anzahl > 1/.test(pageSrc));
check('C0c artikelNr wird aus der Tabelle uebernommen',
      /artikelNr:\s+String\(get\('artikelNr'\) \|\| ''\)\.trim\(\)/.test(pageSrc));
check('C0d artikelNr steht im Mapping-Dialog',
      /\{ key: 'artikelNr',\s+label: 'Artikelnummer'/.test(pageSrc));
check('C0e Auto-Erkennung kennt sku/artikelnummer',
      /artikelNr:\s+find\('artikelnummer'/.test(pageSrc));

const usedNrs = new Set(['2026-001', 'SV-1042']);
function uniqueNr(wunsch) {
    let nr = wunsch, i = 2;
    while (usedNrs.has(nr)) { nr = wunsch + '-' + i; i++; }
    usedNrs.add(nr);
    return nr;
}
check('C1 freie Nummer bleibt unveraendert', uniqueNr('SV-2000') === 'SV-2000');
check('C2 vergebene Nummer bekommt -2',      uniqueNr('SV-1042') === 'SV-1042-2');
check('C3 zweite Kollision bekommt -3',      uniqueNr('SV-1042') === 'SV-1042-3');
check('C4 nichts geht verloren',             usedNrs.size === 5);

console.log('\n' + pass + '/' + total + ' Checks bestanden');
process.exit(pass === total ? 0 : 1);
