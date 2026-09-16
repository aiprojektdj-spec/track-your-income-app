// js/companies.js — Multi-Firmen-Verwaltung.
//
// Fund C des Vollaudits (plan/01-AUFGABEN.md 1.8): groesstes Modul der Geldbezug-Liste ohne
// Harness. Es rechnet nichts, entscheidet aber, WELCHER Firma ein Datensatz gehoert — und
// delete() raeumt alle Daten einer Firma weg. Ein Fehler hier heisst nicht "falsche Zahl",
// sondern "falsche Firma" oder "Daten weg".
//
// Geprueft werden die Registry-Mechanik, der Loeschpfad und die Robustheit gegen ein
// beschaedigtes Verzeichnis. Die Oberflaechenteile (Dropdown, Modals) bleiben aussen vor.
'use strict';
const fs = require('fs');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    let ok = false;
    try { ok = (typeof cond === 'function') ? !!cond() : !!cond; }
    catch (e) { console.error('   (Ausnahme statt Ergebnis: ' + (e && e.message) + ')'); }
    if (ok) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}
// Ein Themenblock: bricht er ab, zaehlt das als EIN Fehlschlag und die uebrigen laufen weiter.
// Grund und Gegenprobe stehen in test/test-gewinn-eine-quelle.js — ein Harness ruft echten
// Modulcode auf, und dieser Aufruf steht ausserhalb jeder Pruefung.
let blockNr = 0;
function block(fn) {
    blockNr++;
    const nr = blockNr;
    try { fn(); }
    catch (e) {
        total++;
        console.error('✗ FAIL Block ' + nr + ' bricht mit einer Ausnahme ab: ' + (e && e.message));
        process.exitCode = 1;
    }
}

// Fuer Bloecke mit einem await darin. Ein setTimeout am Dateiende waere zeitabhaengig: auf
// einer langsamen Maschine zaehlt der Abschluss, bevor die Zusage eingeloest ist — der Harness
// meldete dann zu wenige Pruefungen, und zwar gruen.
async function blockAsync(fn) {
    blockNr++;
    const nr = blockNr;
    try { await fn(); }
    catch (e) {
        total++;
        console.error('✗ FAIL Block ' + nr + ' bricht mit einer Ausnahme ab: ' + (e && e.message));
        process.exitCode = 1;
    }
}

const src = fs.readFileSync(__dirname + '/../js/companies.js', 'utf8');

// Mini-localStorage mit derselben Semantik wie im Browser (key(i), length, Werte als String).
function ladeLS(start) {
    const daten = Object.assign({}, start || {});
    return {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(daten, k) ? daten[k] : null),
        setItem: (k, v) => { daten[k] = String(v); },
        removeItem: (k) => { delete daten[k]; },
        key: (i) => Object.keys(daten)[i],
        get length() { return Object.keys(daten).length; },
        _daten: daten,
    };
}

function lade(o) {
    const d = Object.assign({ ls: {}, cache: {}, geloeschteIdb: [] }, o || {});
    const localStorage = ladeLS(d.ls);
    const Store = {
        _cache: d.cache,
        _idbDelete: (k) => d.geloeschteIdb.push(k),
        _idbPut: () => {},
    };
    const document = { getElementById: () => null, createElement: () => ({ style: {} }),
                       head: { appendChild: () => {} }, addEventListener: () => {} };
    const window = { addEventListener: () => {} };
    const location = { reload: () => { d.reloadAufgerufen = true; } };
    const UserPlan = { isPro: () => true, isTrialActive: () => true, requirePro: () => {} };
    const CompanyManager = new Function(
        'localStorage', 'Store', 'document', 'window', 'location', 'UserPlan',
        src + '\n; return CompanyManager;'
    )(localStorage, Store, document, window, location, UserPlan);
    return { CompanyManager, localStorage, d };
}

const FIRMA_A = { id: 'co_aaa', name: 'Alpha', farbe: '#10b981', branche: 'Reselling', land: 'DE' };
const FIRMA_B = { id: 'co_bbb', name: 'Beta',  farbe: '#3b82f6', branche: 'Handwerk',  land: 'DE' };
const REG = (arr) => ({ oyi_companies: JSON.stringify(arr) });

(async () => {
console.log('\n── A. Registry lesen ─────────────────────────────────────────');

block(() => {
    const { CompanyManager: CM } = lade({ ls: Object.assign(REG([FIRMA_A, FIRMA_B]),
                                          { oyi_active_company: 'co_bbb' }) });
    check('A1 getAll() liefert beide Firmen', CM.getAll().length === 2);
    check('A2 getActiveId() liest den Aktiv-Key', CM.getActiveId() === 'co_bbb');
    check('A3 getActive() findet die aktive Firma', () => CM.getActive().name === 'Beta');
    check('A4 getActiveLand() liefert das Land', CM.getActiveLand() === 'DE');
});

block(() => {
    // Aktive ID zeigt auf eine Firma, die es nicht (mehr) gibt.
    const { CompanyManager: CM } = lade({ ls: Object.assign(REG([FIRMA_A]),
                                          { oyi_active_company: 'co_weg' }) });
    check('A5 getActive() gibt null, wenn die aktive ID ins Leere zeigt', CM.getActive() === null);
    check('A6 getActiveLand() faellt dann auf DE zurueck statt zu werfen',
        CM.getActiveLand() === 'DE');
});

console.log('\n── B. Beschaedigtes Verzeichnis ──────────────────────────────');
// Der Fund vom 2026-09-15: der catch in getAll() fing nur kaputtes JSON ab. Gueltiges JSON,
// das kein Array ist, lief durch — und jeder Aufrufer arbeitet danach mit .find()/.filter()/
// .push(). Da getActive() beim Start laeuft, waere die App unbenutzbar gewesen, nicht nur
// diese eine Funktion.

block(() => {
    const faelle = [
        ['kaputtes JSON',   'nicht{json'],
        ['ein Objekt',      '{"a":1}'],
        ['null',            'null'],
        ['eine Zahl',       '42'],
        ['eine Zeichenkette', '"text"'],
    ];
    faelle.forEach(([was, roh]) => {
        const { CompanyManager: CM } = lade({ ls: { oyi_companies: roh } });
        check('B: ' + was + ' -> getAll() liefert ein leeres Array',
            () => Array.isArray(CM.getAll()) && CM.getAll().length === 0);
        check('B: ' + was + ' -> getActive() wirft nicht', () => CM.getActive() === null);
    });
});

block(() => {
    // Und die schreibenden Wege duerfen daran ebenfalls nicht sterben.
    const { CompanyManager: CM } = lade({ ls: { oyi_companies: 'null' } });
    check('B: create() legt trotz beschaedigtem Verzeichnis an',
        () => !!CM.create('Neu', '#10b981', 'Reselling', 'DE'));
    check('B: danach steht genau eine Firma im Verzeichnis', CM.getAll().length === 1);
});

console.log('\n── C. Anlegen, umbenennen, faerben ───────────────────────────');

block(() => {
    const { CompanyManager: CM } = lade({ ls: REG([]) });
    const co = CM.create('  Meine Firma  ', '#f97316', 'Handwerk', 'DE');
    check('C1 create() schneidet Leerzeichen am Namen ab', () => co.name === 'Meine Firma');
    check('C2 create() vergibt eine co_-ID', () => /^co_[0-9a-z]+$/.test(co.id));
    check('C3 create() setzt Farbe, Branche und Land', () =>
        co.farbe === '#f97316' && co.branche === 'Handwerk' && co.land === 'DE');
    check('C4 create() setzt erstellt und letzterZugriff', () => !!co.erstellt && !!co.letzterZugriff);
    check('C5 die Firma steht danach im Verzeichnis', CM.getAll().length === 1);

    // Ohne Angaben greifen die Vorgaben.
    const co2 = CM.create('Zweite');
    check('C6 Vorgaben: Emerald, Reselling, DE', () =>
        co2.farbe === '#10b981' && co2.branche === 'Reselling' && co2.land === 'DE');
});

block(() => {
    const { CompanyManager: CM } = lade({ ls: REG([FIRMA_A]) });
    CM.rename('co_aaa', '  Neuer Name  ');
    check('C7 rename() schneidet ab und schreibt', () => CM.getAll()[0].name === 'Neuer Name');
    CM.rename('co_aaa', '   ');
    check('C8 rename() ignoriert einen leeren Namen', () => CM.getAll()[0].name === 'Neuer Name');
    CM.rename('co_gibtsnicht', 'Egal');
    check('C9 rename() auf unbekannte ID aendert nichts', () => CM.getAll().length === 1);
});

block(() => {
    const { CompanyManager: CM } = lade({ ls: REG([FIRMA_A]) });
    CM.updateColor('co_aaa', '#ec4899');
    check('C10 updateColor() nimmt eine gueltige Hex-Farbe', () => CM.getAll()[0].farbe === '#ec4899');
    ['rot', '#fff', '#12345g', 'ec4899', '#1234567'].forEach(bad => CM.updateColor('co_aaa', bad));
    check('C11 updateColor() weist ungueltige Werte ab', () => CM.getAll()[0].farbe === '#ec4899');
});

console.log('\n── D. Loeschen ───────────────────────────────────────────────');

await blockAsync(async () => {
    const { CompanyManager: CM } = lade({ ls: Object.assign(REG([FIRMA_A]),
                                          { oyi_active_company: 'co_aaa' }) });
    let fehler = null;
    try { await CM.delete('co_aaa'); } catch (e) { fehler = e; }
    // Die erste Fassung pruefte hier nur, dass die Firma noch im Verzeichnis steht — und
    // nicht, dass delete() ueberhaupt abgelehnt hat. `fehler` wurde nie ausgewertet. Haette
    // der Guard gefehlt und delete() nur die Registry-Zeile uebersprungen, waere der Check
    // trotzdem gruen gewesen, waehrend die Daten der aktiven Firma schon weg sind.
    check('D1 Die AKTIVE Firma laesst sich nicht loeschen — delete() lehnt ab',
        () => fehler instanceof Error && /aktive/i.test(fehler.message));
    check('D1b …und sie steht danach noch im Verzeichnis', () => CM.getAll().length === 1);
});

await blockAsync(async () => {
    // Der Kern: beim Loeschen von B duerfen nur B-Schluessel fallen, A bleibt unberuehrt.
    const cache = {
        'co_aaa__reselling_sales':    '[1]',
        'co_aaa__reselling_purchases':'[2]',
        'co_bbb__reselling_sales':    '[3]',
        'co_bbb__rechnungsbuch_inv':  '[4]',
        'audit_log':                  '[5]',
    };
    const ls = Object.assign(REG([FIRMA_A, FIRMA_B]), {
        oyi_active_company:         'co_aaa',
        'co_bbb__eigenbelege_belege':'[9]',
        'co_aaa__eigenbelege_belege':'[8]',
    });
    const { CompanyManager: CM, localStorage: LS, d } = lade({ ls, cache });

    await CM.delete('co_bbb');
    {
        check('D2 Die B-Schluessel sind aus dem Cache weg',
            () => !cache['co_bbb__reselling_sales'] && !cache['co_bbb__rechnungsbuch_inv']);
        check('D3 Die A-Schluessel sind unberuehrt',
            () => cache['co_aaa__reselling_sales'] === '[1]' &&
                  cache['co_aaa__reselling_purchases'] === '[2]');
        check('D4 Der globale audit_log-Schluessel bleibt', () => cache['audit_log'] === '[5]');
        check('D5 Auch die rohen localStorage-Reste von B sind weg',
            () => LS.getItem('co_bbb__eigenbelege_belege') === null);
        check('D6 Die von A bleiben liegen',
            () => LS.getItem('co_aaa__eigenbelege_belege') === '[8]');
        check('D7 B ist aus dem Verzeichnis entfernt, A steht noch',
            () => CM.getAll().length === 1 && CM.getAll()[0].id === 'co_aaa');
        check('D8 Die IDB-Loeschung traf nur B-Schluessel',
            () => d.geloeschteIdb.length > 0 && d.geloeschteIdb.every(k => k.startsWith('co_bbb__')));
    }
});

await blockAsync(async () => {
    // Der Trenner `__` in delete() ist die einzige Stelle, die verhindert, dass das Loeschen
    // einer Firma die Daten einer ANDEREN mitnimmt, deren ID mit derselben Zeichenfolge beginnt.
    //
    // Nachgetragen am 2026-09-16 nach einer Mutations-Gegenprobe: `id + '__'` durch `id`
    // ersetzt — und der Harness blieb 41/41 gruen. Die Faelle darueber benutzen co_aaa und
    // co_bbb, zwei IDs, die sich nicht ueberlappen; mit ihnen loescht die kaputte Fassung
    // zufaellig genau dasselbe wie die richtige. Die Fixtures erreichten die Luecke nicht.
    //
    // Deshalb hier bewusst ein Paar, bei dem eine ID das Praefix der anderen ist. Frisch
    // erzeugte IDs sind zwar immer 16 Zeichen lang (s. Block E), aber importierte, migrierte
    // oder gesyncte muessen das nicht sein — und der Trenner soll auch dann halten.
    const KURZ = { id: 'co_ab',  name: 'Kurz' };
    const LANG = { id: 'co_abc', name: 'Lang' };
    const cache = {
        'co_ab__reselling_sales':  '[1]',
        'co_abc__reselling_sales': '[2]',   // gehoert der ANDEREN Firma
    };
    const ls = Object.assign(REG([KURZ, LANG]), {
        oyi_active_company:           'co_abc',
        'co_abc__eigenbelege_belege': '[9]',
    });
    const { CompanyManager: CM, localStorage: LS } = lade({ ls, cache });
    await CM.delete('co_ab');
    check('D9 Loeschen von co_ab laesst die Daten von co_abc im Cache stehen',
        () => cache['co_abc__reselling_sales'] === '[2]');
    check('D10 …und ihre localStorage-Reste ebenso',
        () => LS.getItem('co_abc__eigenbelege_belege') === '[9]');
    check('D11 co_ab selbst ist weg', () => !cache['co_ab__reselling_sales']);
});

console.log('\n── E. Praefix-Trennung der IDs ───────────────────────────────');

block(() => {
    // delete() filtert ueber `id + '__'`. Waere eine ID das Praefix einer anderen, risse das
    // Loeschen fremde Daten mit. Nachgemessen: die IDs sind konstant 16 Zeichen
    // ('co_' + Zeitanteil + 5 Zufallszeichen), und der doppelte Unterstrich trennt zusaetzlich.
    const { CompanyManager: CM } = lade({ ls: REG([]) });
    const ids = [];
    for (let i = 0; i < 200; i++) ids.push(CM.create('F' + i).id);
    const kollision = ids.some((a, i) => ids.some((b, j) => i !== j && (b + '__').startsWith(a + '__')));
    check('E1 Keine ID ist Praefix einer anderen', kollision === false);
    check('E2 Alle IDs sind eindeutig', new Set(ids).size === ids.length);
    check('E3 Keine ID enthaelt den Trenner __', ids.every(x => x.indexOf('__') === -1));
});

console.log('\n' + pass + '/' + total + ' Checks bestanden');
if (pass !== total) process.exit(1);
})();
