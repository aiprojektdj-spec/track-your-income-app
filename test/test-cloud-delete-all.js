// Self-Test der konto-weiten Cloud-Loeschung:  node test/test-cloud-delete-all.js
//
// CloudSync.deleteAllRemote() ist der zweite Loeschweg (Entscheidung 2026-09-13,
// plan/01-AUFGABEN.md §2.5): Er loescht den gesamten Cloud-Bestand eines Kontos und ist
// der EINZIGE Weg, der das auch ohne Wiederherstellungscode kann — deleteRemote(scope)
// muss die Anhang-URLs aus dem Chiffrat lesen und laesst sie ohne Schluessel liegen.
//
// Die scharfe Kante ist die Reihenfolge. Wird lokal aufgeraeumt, BEVOR der Server
// bestaetigt hat, steht der Nutzer in der Sackgasse: Schluessel weg, Cloud-Daten noch da,
// und ohne Schluessel kommt er an sie nicht mehr heran. Genau diese Falle ist in diesem
// Projekt schon einmal aufgetreten (Memory "Cloud-Sync Schluessel-Sackgasse"), deshalb
// pruefen die Faelle 2 und 3 vor allem, was bei einem FEHLSCHLAG *nicht* passiert.
'use strict';
const assert = require('assert');

// ── Minimal-Shims, damit js/cloud-sync.js unter Node laedt (wie test-cloud-sync.js) ──
const _ls = new Map();
global.localStorage = {
    getItem: k => (_ls.has(k) ? _ls.get(k) : null),
    setItem: (k, v) => _ls.set(k, String(v)),
    removeItem: k => _ls.delete(k),
    get length() { return _ls.size; },
    key: i => Array.from(_ls.keys())[i]
};
global.document = { readyState: 'complete', getElementById: () => null, addEventListener: () => {} };
global.window = {};
global.indexedDB = undefined;                       // _wipeKeyStore steigt dann sofort aus
global.Store = { _calcChecksum: s => String(s.length) };

const UID = 'user_test123';
let purgeCalls = 0, purgeResult = true;
global.BlobAttachments = { purgeAll: async () => { purgeCalls++; return purgeResult; } };

// fetch-Attrappe: nur action=reset_all ist hier interessant.
let resetStatus = 200, resetCalls = 0;
global.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body || '{}');
    if (body.action === 'reset_all') { resetCalls++; return { status: resetStatus, json: async () => ({ ok: resetStatus === 200 }) }; }
    return { status: 404, json: async () => ({}) };
};

const CloudSync = require('../js/cloud-sync.js');
let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); }
}

// Ausgangslage: angemeldet, Sync an, Schluessel und Metadaten mehrerer Firmen liegen lokal.
function seed() {
    _ls.clear();
    purgeCalls = 0; resetCalls = 0; purgeResult = true;
    localStorage.setItem('whop_access_token', 'tok_abc');
    localStorage.setItem('whop_user', JSON.stringify({ id: UID }));
    localStorage.setItem('oyi_sync_enabled', '1');
    localStorage.setItem('oyi_sync_keymeta_firma1', '{"a":1}');
    localStorage.setItem('oyi_sync_base_firma1', '{"b":1}');
    localStorage.setItem('oyi_sync_keymeta_firma2', '{"a":2}');
    localStorage.setItem('oyi_sync_key_' + UID, 'SCHLUESSEL');
    localStorage.setItem('oyi_firma_aktiv', 'firma1');      // fremder Key: muss ueberleben
}

// ── 1) Erfolgsfall: Server bestaetigt, dann wird lokal aufgeraeumt ────────────
(async () => {
    seed();
    resetStatus = 200;
    const r = await CloudSync.deleteAllRemote();

    check('1a meldet Erfolg', r && r.ok === true);
    check('1b Server genau einmal gerufen', resetCalls === 1);
    check('1c Anhaenge mit weggeraeumt (purgeAll)', purgeCalls === 1);
    check('1d blobsOk durchgereicht', r.blobsOk === true);
    check('1e Sync ausgeschaltet', localStorage.getItem('oyi_sync_enabled') === null);
    check('1f Schluessel entfernt', localStorage.getItem('oyi_sync_key_' + UID) === null);
    check('1g Metadaten ALLER Firmen weg, nicht nur der aktiven',
        localStorage.getItem('oyi_sync_keymeta_firma1') === null &&
        localStorage.getItem('oyi_sync_base_firma1') === null &&
        localStorage.getItem('oyi_sync_keymeta_firma2') === null);
    check('1h fremde Keys bleiben unberuehrt', localStorage.getItem('oyi_firma_aktiv') === 'firma1');

    // ── 2) Serverfehler: NICHTS darf lokal verschwinden ──────────────────────
    // Das ist der Kern. Wer hier aufraeumt, nimmt dem Nutzer den Schluessel fuer den
    // zweiten Versuch — und die Cloud-Daten liegen weiter da.
    seed();
    resetStatus = 500;
    const r2 = await CloudSync.deleteAllRemote();

    check('2a meldet Misserfolg mit Grund', r2 && r2.ok === false && r2.grund === 'server');
    check('2b Schluessel bleibt fuer den zweiten Versuch liegen',
        localStorage.getItem('oyi_sync_key_' + UID) === 'SCHLUESSEL');
    check('2c Sync bleibt eingeschaltet', localStorage.getItem('oyi_sync_enabled') === '1');
    check('2d Firmen-Metadaten bleiben', localStorage.getItem('oyi_sync_keymeta_firma1') !== null);
    check('2e keine Anhang-Loeschung nach Serverfehler', purgeCalls === 0);

    // ── 3) Nicht angemeldet: gar kein Server-Aufruf ──────────────────────────
    seed();
    localStorage.removeItem('whop_access_token');
    resetStatus = 200;
    const r3 = await CloudSync.deleteAllRemote();

    check('3a meldet fehlendes Token', r3 && r3.ok === false && r3.grund === 'kein_token');
    check('3b Server gar nicht erst gerufen', resetCalls === 0);
    check('3c Schluessel unberuehrt', localStorage.getItem('oyi_sync_key_' + UID) === 'SCHLUESSEL');

    // ── 4) Anhang-Aufraeumung scheitert, Snapshots sind aber weg ─────────────
    // Teil-Erfolg: ehrlich melden statt so zu tun, als sei alles sauber. Der lokale
    // Aufraeumteil laeuft trotzdem, denn die Snapshots SIND geloescht.
    seed();
    resetStatus = 200; purgeResult = false;
    const r4 = await CloudSync.deleteAllRemote();

    check('4a ok, aber blobsOk false', r4 && r4.ok === true && r4.blobsOk === false);
    check('4b lokal trotzdem aufgeraeumt', localStorage.getItem('oyi_sync_key_' + UID) === null);

    console.log('\n' + pass + '/' + total + ' Checks bestanden');
    if (pass !== total) process.exit(1);
})();
