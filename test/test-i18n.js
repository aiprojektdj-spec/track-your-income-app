// Self-Test i18n:  node test/test-i18n.js
//
// Fund C des Vollaudits (plan/01-AUFGABEN.md 1.8): Das Modul wurde von keinem Harness geladen.
// Es rechnet nichts, aber jede Oberflaeche haengt daran — und seine Fehler sind LEISE:
// t() faellt bei einem fehlenden englischen Schluessel stumm auf Deutsch zurueck und zeigt im
// schlimmsten Fall den Schluesselnamen selbst. Ein englischer Nutzer sieht dann "form.company"
// statt eines Labels, und niemand bemerkt es, weil nichts bricht.
//
// Was hier wirklich zaehlt, ist die Paritaet der beiden Tabellen und die Platzhalter darin.
// Vorbelastet ist das Modul: Der Firmenname-Bug vom 2026-07-30 (Label sagte "optional", das
// Feld war Pflicht) sass genau hier.
'use strict';
const fs = require('fs');
const path = require('path');

global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {} };
global.document = { documentElement: {}, querySelectorAll: () => [] };

const i18nSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'i18n.js'), 'utf8');
const I18n = new Function(i18nSrc + '; return I18n;')();

// Die Tabellen selbst sind privat — fuer die Paritaetspruefung werden sie aus derselben
// Quelle geholt, indem der Modulrumpf mit einem zusaetzlichen Rueckgabewert gebaut wird.
const TABLES = new Function(
    i18nSrc.replace('return { t, setLang, getLang, isEN, isDE, applyAll, renderToggle };',
                    'return { _t: _t };') + '; return I18n;')();
const de = TABLES._t.de, en = TABLES._t.en;

let pass = 0, total = 0;
function check(name, cond, detail) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name + (detail ? '\n      ' + detail : '')); }
}
const platzhalter = s => (String(s).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort();

// ── A) Beide Tabellen existieren und sind gefuellt ───────────────────────────
(() => {
    check('A1 deutsche Tabelle vorhanden', de && Object.keys(de).length > 100);
    check('A2 englische Tabelle vorhanden', en && Object.keys(en).length > 100);
})();

// ── B) Paritaet: kein Schluessel darf nur auf einer Seite stehen ─────────────
(() => {
    const deKeys = Object.keys(de), enKeys = Object.keys(en);
    const fehltEN = deKeys.filter(k => !(k in en));
    const fehltDE = enKeys.filter(k => !(k in de));

    check('B1 jeder deutsche Schluessel hat eine englische Entsprechung',
        fehltEN.length === 0,
        fehltEN.length ? fehltEN.length + ' fehlen in en: ' + fehltEN.slice(0, 8).join(', ') : '');
    check('B2 jeder englische Schluessel hat eine deutsche Entsprechung',
        fehltDE.length === 0,
        fehltDE.length ? fehltDE.length + ' fehlen in de: ' + fehltDE.slice(0, 8).join(', ') : '');
    check('B3 beide Tabellen sind gleich gross', deKeys.length === enKeys.length,
        deKeys.length + ' de vs. ' + enKeys.length + ' en');
})();

// ── C) Keine leeren Texte ────────────────────────────────────────────────────
// Ein leerer String ist schlimmer als ein fehlender Schluessel: t() liefert ihn aus, der
// Fallback greift NICHT (undefined-Pruefung), und die Oberflaeche zeigt eine leere Stelle.
(() => {
    const leerDE = Object.keys(de).filter(k => String(de[k]).trim() === '');
    const leerEN = Object.keys(en).filter(k => String(en[k]).trim() === '');
    check('C1 kein leerer deutscher Text', leerDE.length === 0, leerDE.slice(0, 5).join(', '));
    check('C2 kein leerer englischer Text', leerEN.length === 0, leerEN.slice(0, 5).join(', '));
})();

// ── D) Platzhalter muessen in beiden Sprachen dieselben sein ─────────────────
// t() ersetzt {name} per RegExp. Fehlt der Platzhalter in einer Sprache, verschwindet der Wert
// still; steht dort ein anderer, bleibt die geschweifte Klammer im Text stehen und der Nutzer
// liest "Willkommen, {name}".
(() => {
    const abweichend = [];
    Object.keys(de).forEach(k => {
        if (!(k in en)) return;
        const a = platzhalter(de[k]), b = platzhalter(en[k]);
        if (a.join(',') !== b.join(',')) abweichend.push(k + ' (de: ' + (a.join(' ') || '–') + ' / en: ' + (b.join(' ') || '–') + ')');
    });
    check('D1 Platzhalter stimmen in beiden Sprachen ueberein',
        abweichend.length === 0,
        abweichend.slice(0, 6).join('\n      '));
})();

// ── E) t() — Auflösung und Rueckfall ─────────────────────────────────────────
(() => {
    check('E1 bekannter Schluessel wird uebersetzt', I18n.t('nav.dashboard') === de['nav.dashboard']);

    // Unbekannter Schluessel gibt den Schluessel selbst zurueck. Das ist Absicht (sichtbar
    // statt leer), heisst aber auch: Ein Tippfehler im Aufruf faellt nur im Browser auf.
    check('E2 unbekannter Schluessel gibt den Schluessel zurueck', I18n.t('gibt.es.nicht') === 'gibt.es.nicht');

    // Platzhalter-Ersetzung, inklusive Mehrfachvorkommen.
    const key = Object.keys(de).find(k => /\{[a-zA-Z0-9_]+\}/.test(de[k]));
    if (key) {
        const name = platzhalter(de[key])[0].replace(/[{}]/g, '');
        const vars = {}; vars[name] = 'XYZ';
        check('E3 Platzhalter werden ersetzt (' + key + ')', I18n.t(key, vars).indexOf('{' + name + '}') === -1);
    } else {
        check('E3 Platzhalter werden ersetzt', true);
    }
    check('E4 ohne vars bleibt der Platzhalter stehen, statt zu verschwinden',
        !key || I18n.t(key).indexOf('{') > -1);

    check('E5 Sprachkennung ist Deutsch als Vorgabe', I18n.getLang() === 'de' && I18n.isDE() && !I18n.isEN());
})();

// ── F) setLang akzeptiert nur die zwei gepflegten Sprachen ───────────────────
(() => {
    check('F1 setLang prueft die Sprache, bevor es speichert',
        /if \(lang !== 'de' && lang !== 'en'\) return;/.test(i18nSrc));
    // Ohne diese Pruefung landet ein Tippfehler in localStorage, _t[lang] ist undefined und
    // die ganze Oberflaeche faellt auf _t.de zurueck — ohne dass jemand die Ursache sieht.
    check('F2 t() faellt bei unbekannter Sprache auf Deutsch zurueck',
        /var strings = _t\[_lang\] \|\| _t\.de;/.test(i18nSrc));
})();

console.log('\n' + pass + '/' + total + ' Checks bestanden');
if (pass !== total) process.exit(1);
