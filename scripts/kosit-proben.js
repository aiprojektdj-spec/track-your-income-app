// Erzeugt die KoSIT-Proben in kosit-proben/ mit dem echten rechnungen/js/xrechnung.js neu.
//   node scripts/kosit-proben.js
// Bis 2026-10-23 lagen die Proben als Handstand vor und veralteten mit jedem Fix am Generator
// (zuletzt B5/B6/B9 aus dem Steuer-Audit 2026-10-18). Nur Musterdaten — nichts davon ist eine
// echte Firma oder ein echter Kunde (Art. 28 DSGVO, s. Entscheidung KoSIT-Validierung manuell).
// Hochladen beim KoSIT-Validator und Ergebnis eintragen macht der User.
'use strict';
const fs = require('fs');
const path = require('path');
const { ladeModule } = require('../test/_lade-module');

const Utils = {
    todayISO: () => '2026-10-23', formatDate: x => x, escapeHtml: s => String(s == null ? '' : s),
    formatNumber: n => String(n), showToast() {}, isInPeriod: (x, s, e) => !!x && x >= s && x <= e,
    formatCurrency: n => (parseFloat(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }),
    istDrittland: c => ['CH', 'GB', 'NO', 'US'].indexOf(c) !== -1
};
const ctx = ladeModule(['js/steuerstatus.js', 'js/rechnung-summen.js', 'rechnungen/js/xrechnung.js'],
    { Utils, document: { getElementById: () => null }, Store: { getSettings: () => ({}) } });

const FIRMA_A = { firmenname: 'Musterbetrieb Stackr', adresse: 'Musterweg 1', plz: '10115', ort: 'Berlin', land: 'DE',
    steuernummer: '11/222/33333', ustId: 'DE123456789', telefon: '+49 30 1234567', email: 'rechnung@example.org',
    iban: 'DE02120300000000202051', ustMode: 'regel' };
const FIRMA_B = Object.assign({}, FIRMA_A, { firmenname: 'Muster Handel GmbH' });
const KUNDE_DE = { firma: 'Beispiel Kunde GmbH', strasse: 'Kundenstrasse 2', plz: '20095', ort: 'Hamburg', land: 'DE', email: 'einkauf@example.org' };
const KUNDE_AT = { firma: 'Beispiel Kunde Wien', strasse: 'Gasse 3', plz: '1010', ort: 'Wien', land: 'AT', ustIdNr: 'ATU12345678', email: 'einkauf@example.org' };

const pos = (beschreibung, menge, einzelpreis, mwstSatz, extra) => Object.assign({ beschreibung, menge, einzelpreis, mwstSatz, einheit: 'Stk' }, extra || {});
const rechnung = (nummer, positionen, extra) => Object.assign({
    id: nummer, typ: 'rechnung', nummer, datum: '2026-10-14', lieferdatum: '2026-10-10', datumsOption: 'lieferdatum',
    leitwegId: '04011000-1234512345-06', zahlungsbedingungen: 'Zahlbar innerhalb von 14 Tagen nach Rechnungserhalt.',
    faelligkeit: '2026-10-28', positionen, isKlein: false
}, extra || {});
const diff = warenart => ({ mwstSatz: 0, differenzbesteuert: true, warenart });

const PROBEN = [
    ['01-standard-19-7.xml', rechnung('RE-2026-001', [pos('Beratungsleistung', 2, 95, 19), pos('Fachbuch', 1, 39.9, 7)]), FIRMA_A, KUNDE_DE],
    ['02-25a-gebraucht.xml', rechnung('RE-2026-002', [pos('Gebrauchtartikel', 1, 250, 0, diff('gebraucht'))]), FIRMA_A, KUNDE_DE],
    ['03-25a-gemischt.xml', rechnung('RE-2026-003', [pos('Beratungsleistung', 2, 95, 19), pos('Gemälde', 1, 800, 0, diff('kunst'))]), FIRMA_A, KUNDE_DE],
    ['04-25a-eu-kunde.xml', rechnung('RE-2026-004', [pos('Sammlerstück', 1, 400, 0, diff('sammlerstueck'))]), FIRMA_A, KUNDE_AT],
    ['05-rundung-10x003.xml', rechnung('RE-2026-9005', Array.from({ length: 10 }, (_, i) => pos('Kleinteil ' + (i + 1), 1, 0.03, 19))), FIRMA_B, KUNDE_DE],
    // B9: Einzelpreis mit drei Nachkommastellen bleibt im XML erhalten (BT-146)
    ['06-gemischt-rundungsgrenze.xml', rechnung('RE-2026-9006', [pos('Buch', 3, 0.335, 7), pos('Ware', 1, 10.05, 19)]), FIRMA_B, KUNDE_DE],
];

const ziel = path.join(__dirname, '..', 'kosit-proben');
let fehler = 0;
PROBEN.forEach(([datei, inv, settings, kunde]) => {
    const pflicht = ctx.XRechnung.validatePflichtfelder ? ctx.XRechnung.validatePflichtfelder(inv, settings, kunde) : [];
    const xml = ctx.XRechnung.generate(inv, settings, kunde);
    const regeln = ctx.XRechnung.pruefeRegeln ? ctx.XRechnung.pruefeRegeln(xml) : [];
    const offen = [].concat(pflicht || [], regeln || []);
    if (offen.length) { fehler++; console.error('✗ ' + datei + ': ' + JSON.stringify(offen)); return; }
    fs.writeFileSync(path.join(ziel, datei), xml, 'utf8');
    console.log('✓ ' + datei);
});
if (fehler) process.exit(1);
