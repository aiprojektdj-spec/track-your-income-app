// AGB-Zustimmung mit Versionsstand:  node test/test-agb-zustimmung.js
//
// Fund L2 (Compliance-Audit 2026-08-12): unter `agb_accepted` lag nur ein Zeitstempel, geprüft
// wurde ausschließlich auf Vorhandensein. Eine AGB-Änderung erreichte damit KEINEN
// Bestandsnutzer — das Flag war gesetzt und blieb es (§308 Nr. 5 BGB). §9 der agb.html sieht
// Änderungen ausdrücklich vor, ein Verfahren dafür existierte im Code nicht.
//
// Fund L1 (🔴): dazu gab es zwei widersprüchliche AGB-Fassungen — agb.html mit 11 Paragraphen
// (inkl. Widerruf, Zahlung, Kündigung) und ein In-App-Modal mit 8 Paragraphen aus der Zeit vor
// der Whop-Migration. Das Modal zeigt jetzt eine Kurzfassung mit Link auf die AGB, statt eine
// zweite Fassung zu präsentieren.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const src = read('js/utils.js');

// AGB_STAND + die zwei Funktionen isoliert laden, localStorage stubben.
function load(initial) {
    const store = new Map();
    if (initial !== undefined) store.set('agb_accepted', initial);
    const m = src.match(/const AGB_STAND = '[^']+';/);
    assert.ok(m, 'AGB_STAND nicht gefunden');
    const acc = src.match(/agbAccepted: function \(\) \{[\s\S]*?\n    \},/);
    const set = src.match(/setAgbAccepted: function \(\) \{[\s\S]*?\n    \},/);
    assert.ok(acc && set, 'agbAccepted/setAgbAccepted nicht gefunden');
    // store bleibt AUSSERHALB der new Function — dort wäre er nicht im Scope
    const body = m[0] + '\nconst Utils = { AGB_STAND: AGB_STAND, ' + acc[0] + ' ' + set[0] + ' };\nreturn Utils;';
    const Utils = new Function('localStorage', body)({
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k)
    });
    return { Utils, store };
}

let pass = 0;

// 1) Frischer Nutzer: nicht akzeptiert
let { Utils, store } = load(undefined);
assert.strictEqual(Utils.agbAccepted(), false, 'ohne Eintrag nicht akzeptiert');
pass++; console.log('✓ frischer Nutzer gilt als nicht akzeptiert');

// 2) Zustimmen speichert Stand UND Zeitpunkt
Utils.setAgbAccepted();
const rec = JSON.parse(store.get('agb_accepted'));
assert.strictEqual(rec.stand, Utils.AGB_STAND, 'Stand gespeichert');
assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(rec.at), 'Zeitpunkt gespeichert');
assert.strictEqual(Utils.agbAccepted(), true, 'danach akzeptiert');
pass++; console.log('✓ Zustimmung speichert Stand + Zeitpunkt');

// 3) DER Fund: Alt-Format (reiner Zeitstempel) gilt als NICHT akzeptiert.
//    Diese Nutzer haben die frühere In-App-Fassung bestätigt, die es nicht mehr gibt.
({ Utils, store } = load('2026-07-01T10:00:00.000Z'));
assert.strictEqual(Utils.agbAccepted(), false,
    'Alt-Zeitstempel ohne Version muss erneut vorgelegt werden — das ist der Sinn von L2');
pass++; console.log('✓ Alt-Format (nur Zeitstempel) wird erneut vorgelegt');

// 4) Beim Neu-Zustimmen bleibt die frühere Zustimmung als Nachweis erhalten
Utils.setAgbAccepted();
const rec2 = JSON.parse(store.get('agb_accepted'));
assert.strictEqual(rec2.stand, Utils.AGB_STAND);
assert.ok(rec2.prev, 'frühere Zustimmung als prev mitgeführt');
assert.strictEqual(rec2.prev.at, '2026-07-01T10:00:00.000Z', 'alter Zeitpunkt erhalten');
assert.strictEqual(rec2.prev.stand, 'vor-2026-06', 'alte Fassung als solche gekennzeichnet');
pass++; console.log('✓ frühere Zustimmung wird als Nachweis mitgeführt, nicht überschrieben');

// 5) Ein ANDERER Stand gilt nicht — sonst wäre die Versionierung wirkungslos
({ Utils } = load(JSON.stringify({ stand: '2025-01', at: '2025-01-01T00:00:00.000Z' })));
assert.strictEqual(Utils.agbAccepted(), false, 'alter Stand → erneut vorlegen');
pass++; console.log('✓ abweichender Stand wird erneut vorgelegt');

// 6) Kaputter Wert darf nicht durchrutschen und nicht crashen
for (const bad of ['{kaputt', '{}', 'null', '[]', '']) {
    ({ Utils } = load(bad));
    assert.strictEqual(Utils.agbAccepted(), false, 'kaputter Wert (' + JSON.stringify(bad) + ') → nicht akzeptiert');
}
pass++; console.log('✓ kaputte Werte gelten als nicht akzeptiert, ohne Ausnahme');

// 7) AGB_STAND passt zum "Stand:" in agb.html — sonst ist die Versionierung eine Lüge
const agb = read('agb.html');
const stand = src.match(/const AGB_STAND = '([^']+)';/)[1];
const MONATE = { '01': 'Januar', '02': 'Februar', '03': 'März', '04': 'April', '05': 'Mai',
                 '06': 'Juni', '07': 'Juli', '08': 'August', '09': 'September', '10': 'Oktober',
                 '11': 'November', '12': 'Dezember' };
const [jahr, monat] = stand.split('-');
const erwartet = MONATE[monat] + ' ' + jahr;
assert.ok(new RegExp('Stand:\\s*' + erwartet).test(agb),
    'agb.html muss "Stand: ' + erwartet + '" tragen (AGB_STAND=' + stand + ')');
pass++; console.log('✓ AGB_STAND (' + stand + ') passt zum Stand in agb.html');

// ── L1: das Modal darf keine zweite AGB-Fassung mehr sein ────────────────────────────────────
// WICHTIG: der Ausschnitt muss innerhalb von showAgbModal beginnen. js/app.js enthält ZWEI
// Blöcke mit der Klasse `agb-modal-header` — der erste gehört zu showDsgvoModal (Art. 13 DSGVO).
// Ein global gesuchter erster Treffer prüft also das falsche Modal; beim Bauen dieses Fixes ist
// genau daran der DSGVO-Hinweis versehentlich überschrieben worden.
function agbModal(file, fnAnchor) {
    const t = read(file);
    const s = t.indexOf(fnAnchor);
    assert.ok(s !== -1, file + ': ' + fnAnchor + ' nicht gefunden');
    const i = t.indexOf('agb-modal-header', s);
    const j = t.indexOf('agb-modal-footer', i);
    assert.ok(i !== -1 && j > i, file + ': Modal-Block nicht abgrenzbar');
    return t.slice(i, j);
}

for (const [f, anchor] of [['js/app.js', 'showAgbModal() {'], ['rechnungen/js/app.js', 'function showAgbModal(']]) {
    const t = read(f);
    const modal = agbModal(f, anchor);
    assert.ok(!/§ 1 Geltungsbereich/.test(modal), f + ': Paragraphenwerk entfernt');
    assert.ok(!/§ 8 Schlussbestimmungen/.test(modal), f + ': Paragraphenwerk entfernt');
    assert.ok(/agb\.html/.test(modal), f + ': verlinkt die AGB');
    assert.ok(/datenschutz\.html/.test(modal), f + ': verlinkt die Datenschutzerklärung');
    assert.ok(/Kurzfassung/.test(modal), f + ': als Kurzfassung gekennzeichnet');
    assert.ok(!/Nutzungsbedingungen gelesen und akzeptiere/.test(modal),
        f + ': Checkbox bezieht sich nicht mehr auf eine eigene Fassung');
    // Sub-App liegt eine Ebene tiefer
    if (f.startsWith('rechnungen/')) assert.ok(/\.\.\/agb\.html/.test(modal), f + ': relativer Pfad korrekt');
}
pass++; console.log('✓ beide Modale zeigen die AGB an, statt eine zweite Fassung zu sein');

// Beide Modale müssen inhaltlich IDENTISCH sein — zwei abweichende Fassungen waren der Fund.
// Verglichen wird ohne Whitespace und ohne die Pfad-Ebene (../agb.html in der Sub-App).
{
    const norm = (s) => s.replace(/\.\.\//g, '').replace(/\s+/g, ' ').trim();
    assert.strictEqual(norm(agbModal('js/app.js', 'showAgbModal() {')),
                       norm(agbModal('rechnungen/js/app.js', 'function showAgbModal(')),
                       'Haupt- und Sub-App zeigen denselben Text');
    pass++; console.log('✓ Haupt- und Sub-App zeigen denselben Text');
}

// Regression: der Art.-13-DSGVO-Hinweis ist ein EIGENES Modal und darf nicht mit dem
// AGB-Modal verwechselt oder von ihm überschrieben werden. Beim Bauen dieses Fixes ist genau
// das passiert — der Hinweis wurde zur Sackgasse, weil sein Button dsgvoOkBtn im Markup fehlte.
{
    const t = read('js/app.js');
    const s = t.indexOf('showDsgvoModal(onConfirm) {');
    assert.ok(s !== -1, 'showDsgvoModal existiert');
    const dsgvo = t.slice(s, t.indexOf('\n    },', s));
    assert.ok(/Art\. 13 DSGVO/.test(dsgvo), 'DSGVO-Modal nennt Art. 13 DSGVO');
    assert.ok(/id="dsgvoOkBtn"/.test(dsgvo), 'Bestätigungs-Button ist im Markup');
    assert.ok(/getElementById\('dsgvoOkBtn'\)/.test(dsgvo), 'und wird verdrahtet');
    assert.ok(!/Allgemeinen Geschäftsbedingungen/.test(dsgvo),
        'DSGVO-Modal enthält NICHT den AGB-Text');
    pass++; console.log('✓ DSGVO-Modal (Art. 13) ist eigenständig und funktionsfähig');
}

// Und niemand liest den Schlüssel mehr direkt — sonst wäre die Versionsprüfung umgehbar
for (const f of ['js/app.js', 'rechnungen/js/app.js']) {
    assert.ok(!/localStorage\.(get|set)Item\('agb_accepted'/.test(read(f)),
        f + ': greift nicht mehr direkt auf agb_accepted zu');
    assert.ok(/Utils\.agbAccepted\(\)/.test(read(f)), f + ': nutzt Utils.agbAccepted()');
    assert.ok(/Utils\.setAgbAccepted\(\)/.test(read(f)), f + ': nutzt Utils.setAgbAccepted()');
}
pass++; console.log('✓ beide Einstiegspunkte gehen über Utils, kein Direktzugriff');

console.log('\n' + pass + '/11 Tests bestanden ✅');
