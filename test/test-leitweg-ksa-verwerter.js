// Leitweg-ID (T6) und KSA-Verwerter-Hinweis (T5):  node test/test-leitweg-ksa-verwerter.js
//
// T6 — rechnungen/js/xrechnung.js schrieb <ram:BuyerReference> seit je korrekt, WENN
//      inv.leitwegId gesetzt war. Ein Eingabefeld gab es nirgends, der B2G-Fall (Rechnung an
//      eine Behörde) war damit nicht bedienbar. Die Leitweg-ID ist bei öffentlichen
//      Auftraggebern Pflichtangabe — ohne sie weisen die Rechnungseingangsplattformen des
//      Bundes und der Länder die XRechnung zurück.
// T5 — Die KSA-Bagatellgrenze gilt nach §24 Abs. 1 KSVG NICHT für "typische Verwerter"
//      (Verlage, Werbeagenturen, Theater, Galerien): die sind ab dem ersten Euro abgabepflichtig.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
let pass = 0;

// ── T6: die Kette Formular → Speichern → Rechnungsobjekt → XML muss vollständig sein ───────
const form = read('rechnungen/js/rechnung.js');

assert.ok(/id="invLeitwegId"/.test(form), 'Eingabefeld invLeitwegId existiert');
assert.ok(/for="invLeitwegId"/.test(form), 'Label ist mit dem Feld verknüpft (A11y)');
assert.ok(/var leitwegId = editingInvoice \? \(editingInvoice\.leitwegId \|\| ''\) : '';/.test(form),
    'beim Bearbeiten wird der gespeicherte Wert vorbelegt');
assert.ok(/leitwegIdEl \? leitwegIdEl\.value\.trim\(\) : ''/.test(form),
    'beim Speichern wird der Wert gelesen (defensiv, falls das Feld fehlt)');
assert.ok(/^\s*leitwegId: leitwegId,$/m.test(form), 'Wert landet im Rechnungsobjekt');
pass++; console.log('✓ Leitweg-ID: Feld, Vorbelegung, Auslesen, Speichern');

// Das Feld muss im Formular VOR dem Speichern-Code stehen und im Abschnitt "Zusätzliche Angaben"
// liegen — nicht irgendwo, wo es bei einer Behördenrechnung niemand sucht.
const idxNotizen = form.indexOf('id="invNotizen"');
const idxLeitweg = form.indexOf('id="invLeitwegId"');
assert.ok(idxNotizen !== -1 && idxLeitweg > idxNotizen, 'Feld liegt bei den Zusatzangaben');
pass++; console.log('✓ Feld sitzt im Abschnitt "Zusätzliche Angaben"');

// XML-Seite: unverändert vorhanden, damit die Kette wirklich durchläuft
const xr = read('rechnungen/js/xrechnung.js');
assert.ok(/if \(inv\.leitwegId\) \{/.test(xr), 'XML-Seite prüft inv.leitwegId');
assert.ok(/<ram:BuyerReference>' \+ esc\(inv\.leitwegId\)/.test(xr), 'BuyerReference wird escaped geschrieben');
pass++; console.log('✓ XML schreibt BuyerReference (escaped)');

// Wiederkehrende Rechnungen kopieren Felder EINZELN — ohne diesen Durchzug verliert jede
// Folgerechnung an eine Behörde die Leitweg-ID und wird abgewiesen.
const wk = read('rechnungen/js/wiederkehrend.js');
assert.ok(/leitwegId:\s+inv\.leitwegId \|\| ''/.test(wk), 'Regel übernimmt die Leitweg-ID');
assert.ok(/leitwegId:\s+rule\.leitwegId \|\| ''/.test(wk), 'erzeugte Rechnung erhält sie zurück');
pass++; console.log('✓ Leitweg-ID überlebt wiederkehrende Rechnungen');

// ── T5: Verwerter-Hinweis an beiden Stellen, an denen über die Freigrenze gesprochen wird ──
const aus = read('js/ausgaben.js');
const verwerterStellen = (aus.match(/typische[rn]? Verwerter/g) || []).length;
assert.ok(verwerterStellen >= 2,
    'Hinweis an der Übersichtskachel UND im Formular-Hinweis, gefunden: ' + verwerterStellen);
assert.ok(/§24 Abs\.1 KSVG/.test(aus), 'korrekte Fundstelle für die Verwerter-Regel (Abs. 1)');
assert.ok(/§24 Abs\.2 Satz 2 KSVG/.test(aus), 'Freigrenze weiterhin mit Abs. 2 Satz 2 zitiert');
assert.ok(!/§24 Abs\.3 KSVG/.test(aus), '§24 Abs. 3 ist weggefallen und darf nicht zitiert werden');
pass++; console.log('✓ Verwerter-Hinweis an beiden Stellen, §-Zitate korrekt');

// Der Hinweis darf nur erscheinen, solange die Freigrenze überhaupt greift — steht die Abgabe
// schon fest, ist er überflüssiges Rauschen.
assert.ok(/\$\{ksaPflichtig \? '' : `/.test(aus),
    'Kachel-Hinweis nur wenn die Freigrenze noch nicht überschritten ist');
pass++; console.log('✓ Hinweis erscheint nur, solange die Freigrenze greift');

console.log('\n' + pass + '/6 Tests bestanden ✅');
