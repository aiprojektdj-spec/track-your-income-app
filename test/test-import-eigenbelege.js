// js/import-eigenbelege.js: Eigenbeleg-CSV (Pflichtfelder, Dubletten, Periodensperre, unbestaetigte Anlage).
// Erfundene Beispieldaten. Echter Code: js/import-kern.js + js/import-lager.js + js/eigenbeleg-status.js + js/import-eigenbelege.js.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ladeModule } = require('./_lade-module');
const ctx = ladeModule(['js/import-kern.js', 'js/import-lager.js', 'js/eigenbeleg-status.js', 'js/import-eigenbelege.js']);
const E = ctx.EigenbelegImport, S = ctx.EigenbelegStatus;

let fail = 0;
function check(name, fn) {
    try { fn(); console.log('✓ ' + name); }
    catch (e) { fail++; console.log('✗ ' + name + '\n   ' + (e && e.message)); }
}
const lies = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

// Auszug aus eigenbelege/js/app.js (BEGRUENDUNGEN, STD_KAT): ids, gegen den Quelltext gehalten (letzter Test)
const BEGR = [{ id: 'verloren', name: 'Beleg verloren / nicht auffindbar' }, { id: 'barzahlung_flohmarkt', name: 'Barzahlung ohne Quittung (z.B. Flohmarkt)' }, { id: 'sonstiges', name: 'Sonstiges' }];
const KAT = [{ id: 'fahrtkosten', name: 'Fahrtkosten' }, { id: 'sonstiges', name: 'Sonstiges' }];
const KOPF = ['Datum', 'Zweck', 'Betrag brutto', 'MwSt-Satz', 'Begründung', 'Verkäufer', 'Kategorie', 'Zahlungsweg', 'Notizen'];
const OPT = (x) => Object.assign({ kategorien: KAT, begruendungen: BEGR, bestand: [], gesperrt: () => false }, x);
const z = (o) => { const r = ['2026-03-05', 'Parkgebuehr Kundentermin', '3,50', '0', 'barzahlung_flohmarkt', 'Parkhaus Beispiel', 'fahrtkosten', 'bar', '']; Object.keys(o).forEach(k => { r[KOPF.indexOf(k)] = o[k]; }); return r; };

check('Normalfall: Felder, Begruendung per id oder Name, Kategorie, Zahlungsweg', () => {
    const e = E.zeilen([KOPF, z({}), z({ 'Begründung': 'Beleg verloren / nicht auffindbar', Kategorie: 'Fahrtkosten', Zahlungsweg: 'PayPal', Zweck: 'Zwei' })], OPT());
    assert.strictEqual(e.fehler.length, 0);
    const r = e.zeilen[0].row;
    assert.strictEqual(r.belegDatum, '2026-03-05');
    assert.strictEqual(r.betragBrutto, 3.5);
    assert.strictEqual(r.mwstSatz, 0);
    assert.strictEqual(r.begruendung, 'barzahlung_flohmarkt');
    assert.strictEqual(r.kategorie, 'fahrtkosten');
    assert.strictEqual(e.zeilen[1].row.begruendung, 'verloren');
    assert.strictEqual(e.zeilen[1].row.zahlungsweg, 'paypal');
});

check('Vorlage ist selbst importierbar', () => {
    const e = E.zeilen(E.vorlageZeilen(), OPT());
    assert.strictEqual(e.fehler.length, 0);
    assert.strictEqual(e.zeilen.length, 1);
});

check('Pflichtspalten fehlen: kopfFehler, nichts importiert', () => {
    const e = E.zeilen([['Datum', 'Zweck'], ['2026-03-05', 'x']], OPT());
    assert.strictEqual(e.zeilen.length, 0);
    assert.strictEqual(e.kopfFehler.length, 3);
});

check('Fehlerfaelle mit Zeilennummer und Grund', () => {
    const rows = [KOPF, z({ Datum: '31.02.2026' }), z({ Zweck: '' }), z({ 'Betrag brutto': 'abc' }), z({ 'Betrag brutto': '0' }), z({ 'MwSt-Satz': '' }),
        z({ 'MwSt-Satz': '16' }), z({ 'Begründung': '' }), z({ 'Begründung': 'weil ich will' }), z({ Kategorie: 'Kaffeekasse' }), z({ Zahlungsweg: 'Bitcoin' }), z({})];
    const e = E.zeilen(rows, OPT({ nummern: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 15] }));
    assert.deepStrictEqual(Array.from(e.fehler.map(f => f.zeile)), [2, 3, 4, 5, 7, 8, 9, 10, 11, 12]);
    const g = Array.from(e.fehler.map(f => f.grund)).join(' | ');
    ['Datum fehlt', 'Zweck fehlt', 'Betrag brutto fehlt', 'größer 0', 'MwSt-Satz fehlt', 'Unzulässiger MwSt-Satz „16“', 'Begründung fehlt', 'Unbekannte Begründung', 'Unbekannte Kategorie', 'Unbekannter Zahlungsweg']
        .forEach(t => assert.ok(g.indexOf(t) > -1, t));
    assert.strictEqual(e.zeilen.length, 1);
    assert.strictEqual(e.zeilen[0].zeile, 15);
});

check('Periodensperre: uebersprungen', () => {
    const e = E.zeilen([KOPF, z({})], OPT({ gesperrt: d => d.startsWith('2026-03') }));
    assert.strictEqual(e.zeilen.length, 0);
    assert.ok(/Periode festgeschrieben/.test(e.fehler[0].grund));
});

check('Dubletten: Datum|Betrag-Cent|Zweck gegen Bestand; storniert zaehlt nicht; #n in der Datei', () => {
    const best = [{ belegDatum: '2026-03-05', betragBrutto: 3.5, zweck: 'parkgebuehr kundentermin' }];
    let e = E.zeilen([KOPF, z({})], OPT({ bestand: best }));
    assert.strictEqual(e.zeilen[0].dublette, true);
    assert.strictEqual(e.zeilen[0].importieren, false);
    e = E.zeilen([KOPF, z({})], OPT({ bestand: [Object.assign({ storniert: true }, best[0])] }));
    assert.strictEqual(e.zeilen[0].dublette, false);
    e = E.zeilen([KOPF, z({}), z({})], OPT({ bestand: best }));
    assert.deepStrictEqual(Array.from(e.zeilen.map(x => x.dublette)), [true, false]);
});

function deps(belege) {
    const log = { ids: 0, audit: [], saved: null };
    return {
        log, einstellungen: { inhaberName: 'Max Muster', standardErlaeuterung: 'Erl.' },
        genId: () => 'EB-2026-' + String(++log.ids).padStart(3, '0'),
        calcMwst: (b, s) => s ? { netto: Math.round(b / (1 + s / 100) * 100) / 100, mwst: Math.round((b - b / (1 + s / 100)) * 100) / 100 } : { netto: b, mwst: 0 },
        heute: () => '2026-11-24', getBelege: () => belege, saveBelege: v => { log.saved = v; },
        audit: (id, b) => log.audit.push([id, b.bestaetigt])
    };
}

check('anlegen: unbestaetigt, Nummern nur fuer importierte Zeilen, Audit je Beleg, kein Vorsteuerabzug, zaehlt nicht in Summen', () => {
    const e = E.zeilen([KOPF, z({ 'MwSt-Satz': '19', 'Betrag brutto': '119' }), z({ Zweck: 'Zwei' }), z({ Zweck: 'Drei' })], OPT());
    e.zeilen[2].importieren = false;
    const d = deps([{ id: 'EB-ALT' }]);
    assert.strictEqual(E.anlegen(e, d), 2);
    assert.strictEqual(d.log.ids, 2);
    assert.strictEqual(d.log.saved.length, 3);
    const b = d.log.saved[1];
    assert.strictEqual(b.id, 'EB-2026-001');
    assert.strictEqual(b.bestaetigt, false);
    assert.strictEqual(b.vstAbzugsfaehig, false);
    assert.strictEqual(b.betragNetto, 100);
    assert.strictEqual(b.betragMwst, 19);
    assert.strictEqual(b['verkäufer'].name, 'Parkhaus Beispiel');
    assert.strictEqual(b.aussteller, 'Max Muster');
    assert.ok(Array.isArray(b.warenPositionen) && b.warenPositionen.length === 0);
    assert.strictEqual(S.zaehlt(b), false);
    assert.strictEqual(S.zaehlt(d.log.saved[0]), true);                     // Altbestand bleibt bestaetigt
    assert.deepStrictEqual(JSON.parse(JSON.stringify(d.log.audit)), [['EB-2026-001', false], ['EB-2026-002', false]]);
});

check('Reimport derselben Datei in den neuen Bestand: alles Dubletten, keine Nummer verbraucht', () => {
    const rows = [KOPF, z({}), z({ Zweck: 'Zwei' })];
    const d = deps([]);
    E.anlegen(E.zeilen(rows, OPT()), d);
    assert.strictEqual(d.log.ids, 2);
    const d2 = deps(d.log.saved);
    const e2 = E.zeilen(rows, OPT({ bestand: d.log.saved }));
    assert.deepStrictEqual(Array.from(e2.zeilen.map(x => x.dublette)), [true, true]);
    assert.strictEqual(E.anlegen(e2, d2), 0);
    assert.strictEqual(d2.log.ids, 0);
});

check('Wiring: ids passen zum Quelltext der Eigenbeleg-Seite; Knopf, Firmen-Pruefung, Skripte vorhanden', () => {
    const app = lies('eigenbelege/js/app.js');
    BEGR.concat(KAT).forEach(x => assert.ok(app.indexOf("id:'" + x.id + "'") > -1, x.id));
    ['bar', 'ec', 'kreditkarte', 'paypal', 'ueberweisung', 'klarna', 'sonstiges'].forEach(id => assert.ok(app.indexOf("{ id:'" + id + "',") > -1, id));
    assert.ok(/data-action="eb-import-csv"/.test(app) && /case 'eb-import-csv':\s+csvImportOeffnen\(\)/.test(app));
    assert.ok(app.indexOf("(Store._companyId || '') === (localStorage.getItem('oyi_active_company') || '')") > -1);
    assert.ok(app.indexOf('genId: () => EB.genId()') > -1);
    const loader = lies('js/app-loader.js');
    assert.ok(loader.indexOf("'js/import-eigenbelege.js'") > loader.indexOf("'js/import-lager.js'"));
    const html = lies('eigenbelege/index.html');
    ['import-kern.js', 'import-lager.js', 'import-eigenbelege.js'].forEach(f => assert.ok(html.indexOf(f) > -1, f));
    assert.ok(/(^|-)(import)(-|$)/i.test('eb-import-csv'));      // WRITE_RE in js/stb-share.js: im Lesemodus gesperrt
});

if (fail) { console.log('\n' + fail + ' Test(s) fehlgeschlagen'); process.exit(1); }
console.log('\nalle Tests gruen');
