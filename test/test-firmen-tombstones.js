// Regressionstest: Grabsteine für gelöschte FIRMEN (2026-08-24)
//
// Befund am Live-Konto: `oyi_companies` ist ein Array von Objekten mit `id` und lief damit über
// `_mergeRecords` — Union über IDs. `_merge` setzte `entityType` aber nur für purchases/sales/
// expenses, für die Registry blieb er `null`. Damit wurde der Grabstein-Zweig übersprungen und
// jede Remote-ID, die lokal fehlte, kam zurück: eine gelöschte Firma erschien beim nächsten Sync
// wieder im Umschalter — ohne Daten, weil `deleteRemote()` nur ihren eigenen Scope räumt, nicht
// ihren Eintrag im `__account`-Scope. Ergebnis war ein leerer Zombie, und Löschen war praktisch
// wirkungslos.
//
// Zweiter Teil: das Stück-Limit `MAX_COMPANIES` band ohnehin nur `create()`. Gesyncte Firmen
// liefen daran vorbei (im Live-Konto standen 8 bei angeblichem Maximum 5). Es ist entfallen.
//
// Testet den ECHTEN Code per Quelltext-Extraktion — cloud-sync.js ist wegen localStorage/
// IndexedDB-Globals nicht direkt require()-bar (gleiches Vorgehen wie die anderen test-*.js).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const csSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'cloud-sync.js'), 'utf8');
const coSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'companies.js'), 'utf8');

function extract(src, marker) {
    const i = src.indexOf(marker);
    assert.ok(i !== -1, 'Marker nicht gefunden: ' + marker);
    const rest = src.slice(i + marker.length);
    const end = rest.match(/\n    \}/);
    assert.ok(end, 'Ende-Marker nicht gefunden nach ' + marker);
    return rest.slice(0, end.index);
}

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else console.error('✗ FAIL ' + name);
}

// ── localStorage-Schein für die Grabstein-Ablage ─────────────────────────────
const LS = {};
global.localStorage = {
    getItem: k => (k in LS ? LS[k] : null),
    setItem: (k, v) => { LS[k] = String(v); },
    removeItem: k => { delete LS[k]; }
};
global.Store = { isTombstoned: () => false };   // Belege: hier bewusst nie getombstoned

const LS_CO_TOMBS = 'oyi_company_tombstones';
const CO_TOMB_RETENTION_MS = 180 * 86400000;

const _coTombs        = new Function(extract(csSrc, 'function _coTombs() {')
                                     .replace(/LS_CO_TOMBS/g, "'" + LS_CO_TOMBS + "'"));
const _isTombstoned   = new Function('entityType', 'id',
                          extract(csSrc, 'function _isTombstoned(entityType, id) {')
                          .replace(/_coTombs\(\)/g, 'JSON.parse(localStorage.getItem("' + LS_CO_TOMBS + '") || "[]")'));
const tombstoneCompany = new Function('id',
                          extract(csSrc, 'function tombstoneCompany(id) {')
                          .replace(/LS_CO_TOMBS/g, "'" + LS_CO_TOMBS + "'")
                          .replace(/CO_TOMB_RETENTION_MS/g, String(CO_TOMB_RETENTION_MS))
                          .replace(/_coTombs\(\)/g, 'JSON.parse(localStorage.getItem("' + LS_CO_TOMBS + '") || "[]")'));
const _mergeRecords   = new Function('localArr', 'remoteArr', 'base', 'entityType',
                          extract(csSrc, 'function _mergeRecords(localArr, remoteArr, base, entityType) {')
                          .replace(/_isTombstoned\(/g, 'globalThis.__isTomb('));
globalThis.__isTomb = _isTombstoned;

// ── 1) Grabstein setzen und lesen ────────────────────────────────────────────
tombstoneCompany('co_dublette');
check('1a Grabstein wird abgelegt', _coTombs().length === 1 && _coTombs()[0].id === 'co_dublette');
check('1b deletedAt ist gesetzt',   typeof _coTombs()[0].deletedAt === 'number' && _coTombs()[0].deletedAt > 0);
check('1c isTombstoned erkennt ihn', _isTombstoned('firma', 'co_dublette') === true);
check('1d fremde ID bleibt frei',    _isTombstoned('firma', 'co_echt') === false);

tombstoneCompany('co_dublette');
check('1e doppeltes Loeschen erzeugt keinen zweiten Eintrag', _coTombs().length === 1);

// Abgelaufene Grabsteine werden beim Schreiben weggeraeumt
LS[LS_CO_TOMBS] = JSON.stringify([
    { id: 'co_uralt', deletedAt: Date.now() - CO_TOMB_RETENTION_MS - 86400000 },
    { id: 'co_frisch', deletedAt: Date.now() }
]);
tombstoneCompany('co_neu');
check('1f abgelaufene Grabsteine fallen beim Schreiben raus',
      _coTombs().map(t => t.id).sort().join(',') === 'co_frisch,co_neu');

// ── 2) Der eigentliche Fund: Merge der Firmenregistry ────────────────────────
const remote = [
    { id: 'co_echt',     name: 'Secondlife Vintage', updatedAt: 100 },
    { id: 'co_dublette', name: 'Secondlife Vintage', updatedAt: 100 }
];
const lokalNachLoeschen = [{ id: 'co_echt', name: 'Secondlife Vintage', updatedAt: 100 }];

LS[LS_CO_TOMBS] = JSON.stringify([{ id: 'co_dublette', deletedAt: Date.now() }]);
const alsFirma = _mergeRecords(lokalNachLoeschen, remote, {}, 'firma');
check('2a geloeschte Firma kommt NICHT zurueck',
      !alsFirma.val.some(c => c.id === 'co_dublette'));
check('2b die echte Firma bleibt',
      alsFirma.val.length === 1 && alsFirma.val[0].id === 'co_echt');
check('2c remoteDirty gesetzt — der naechste Push raeumt die Remote-Kopie',
      alsFirma.remoteDirty === true);

// Gegenprobe: ohne Grabstein muss eine neue Remote-Firma sehr wohl ankommen,
// sonst waere Multi-Geraet kaputt.
LS[LS_CO_TOMBS] = JSON.stringify([]);
const ohneGrab = _mergeRecords(lokalNachLoeschen, remote, {}, 'firma');
check('2d ohne Grabstein kommt eine neue Firma normal an',
      ohneGrab.val.length === 2 && ohneGrab.localDirty === true);

// Und der alte, kaputte Zustand darf nicht zurueckkehren:
LS[LS_CO_TOMBS] = JSON.stringify([{ id: 'co_dublette', deletedAt: Date.now() }]);
const ohneTyp = _mergeRecords(lokalNachLoeschen, remote, {}, null);
check('2e ohne entityType greift der Grabstein NICHT (der alte Fehler)',
      ohneTyp.val.some(c => c.id === 'co_dublette'));

// ── 3) Verdrahtung im Quelltext ──────────────────────────────────────────────
check('3a _merge setzt entityType "firma" fuer oyi_companies',
      /\(k === 'oyi_companies'\) \? 'firma' : null/.test(csSrc));
check('3b Grabsteine wandern im __account-Scope mit',
      /if \(scope === '__account'\) return \['oyi_companies', LS_CO_TOMBS\];/.test(csSrc));
check('3c Grabsteine liegen NICHT in Store (waeren sonst firmen-praefixiert)',
      /var LS_CO_TOMBS = 'oyi_company_tombstones';/.test(csSrc));
check('3d tombstoneCompany ist exportiert',
      /tombstoneCompany: tombstoneCompany,/.test(csSrc));
check('3e delete() setzt den Grabstein VOR dem Entfernen aus der Registry',
      csSrc.length > 0 &&
      coSrc.indexOf('CloudSync.tombstoneCompany(id)') !== -1 &&
      coSrc.indexOf('CloudSync.tombstoneCompany(id)') < coSrc.indexOf('const companies = this.getAll().filter(c => c.id !== id);'));

// ── 4) Stueck-Limit ist entfallen ────────────────────────────────────────────
check('4a MAX_COMPANIES existiert nicht mehr', !/MAX_COMPANIES:/.test(coSrc));
check('4b create() wirft keine Limit-Ausnahme mehr', !/Maximal \$\{this\.MAX_COMPANIES\} Firmen erlaubt/.test(coSrc));
check('4c Dropdown behauptet kein "von 5" mehr', !/von \$\{this\.MAX_COMPANIES\} angelegt/.test(coSrc));
check('4d "Maximum erreicht"-Fussnote ist weg', !/Maximum von .* Unternehmen erreicht/.test(coSrc));
check('4e Anlege-Button ist immer da', /data-action="co-create"/.test(coSrc));

console.log('\n' + pass + '/' + total + ' Checks bestanden');
process.exit(pass === total ? 0 : 1);
