// Regression Audit 2026-10-13, S8 — freie Fehlertexte verlassen das Gerät nicht.
//
// Synthetischer Name, E-Mail, Betrag und URL-Token in Fehlermeldung, Stack und Quelle: nichts
// davon darf im Beacon an /api/client-error stehen. Übertragen wird ein fester Code.
// Echter Code: js/error-logger.js (regulärer Loggerpfad: onerror, unhandledrejection, log()).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'error-logger.js'), 'utf8');
function client() {
    const beacons = [], lokal = {}, hoerer = {};
    const win = {
        location: { protocol: 'https:', pathname: '/app.html', href: 'https://stackr.example/app.html?token=GEHEIM123' },
        navigator: { userAgent: 'Mozilla/5.0 Test', sendBeacon: (u, b) => { beacons.push(b.text); return true; } },
        localStorage: { getItem: k => lokal[k] || null, setItem: (k, v) => { lokal[k] = v; }, removeItem() {} },
        addEventListener: (t, f) => { hoerer[t] = f; },
        console: { warn() {} },
        Blob: function (parts) { this.text = parts.join(''); },
        URL, JSON, Date, String, Object, Array
    };
    win.window = win;
    vm.runInNewContext(SRC, win);
    return { win, beacons, lokal, hoerer };
}
const VERBOTEN = ['Max Mustermann', 'max.mustermann@example.org', '1.234,56', 'GEHEIM123', 'Musterstraße', 'RE-2026-0042'];
let fail = 0, pass = 0;
function check(n, f) { try { f(); pass++; console.log('✓ ' + n); } catch (e) { fail++; console.log('✗ ' + n + '\n   ' + e.message); } }
const sauber = (b) => VERBOTEN.forEach(v => assert.ok(b.indexOf(v) === -1, 'enthält "' + v + '": ' + b));

check('S8: onerror mit personenbezogenem Text → nur Code', () => {
    const k = client();
    k.win.onerror('Uncaught Error: Rechnung RE-2026-0042 für Max Mustermann (max.mustermann@example.org) über 1.234,56 € fehlgeschlagen',
        'https://stackr.example/js/app.js?token=GEHEIM123', 10, 2, { name: 'Error', stack: 'at Musterstraße 1' });
    assert.strictEqual(k.beacons.length, 1);
    sauber(k.beacons[0]);
    assert.strictEqual(JSON.parse(k.beacons[0]).message, 'Error:sonstig');
    assert.strictEqual(JSON.parse(k.beacons[0]).source, '/js/app.js');
    // lokal bleibt die volle Meldung zur Diagnose
    assert.ok(k.lokal.stackr_error_log.indexOf('Max Mustermann') !== -1, 'lokales Protokoll behält Details');
});
check('S8: technische Merkmale bleiben nützlich (Bezeichner aus dem Quellcode)', () => {
    const k = client();
    k.win.onerror("Uncaught TypeError: Cannot read properties of undefined (reading 'positionen')", 'https://stackr.example/js/x.js', 3, 4, { name: 'TypeError' });
    k.win.onerror('Uncaught ReferenceError: Rechnung is not defined', 'https://stackr.example/js/y.js', 5, 6, { name: 'ReferenceError' });
    assert.strictEqual(JSON.parse(k.beacons[0]).message, 'TypeError:read_undefined:positionen');
    assert.strictEqual(JSON.parse(k.beacons[1]).message, 'ReferenceError:not_defined:Rechnung');
});
check('S8: Bezeichner, der kein JS-Name ist (z. B. Mail-Adresse), wird nicht übertragen', () => {
    const k = client();
    k.win.onerror("TypeError: Cannot read properties of undefined (reading 'max.mustermann@example.org')", 'https://stackr.example/js/x.js', 1, 1, { name: 'TypeError' });
    sauber(k.beacons[0]);
});
check('S8: unhandledrejection und ErrorLogger.log mit freiem Kontext', () => {
    const k = client();
    k.hoerer.unhandledrejection({ reason: { name: 'Error', message: 'Speichern für Max Mustermann fehlgeschlagen', stack: 'GEHEIM123' } });
    k.win.ErrorLogger.log(new Error('Kunde max.mustermann@example.org nicht gefunden'), 'Kunde Max Mustermann');
    k.win.ErrorLogger.log(new Error('1.234,56 € passt nicht'), 'rechnung-speichern');
    assert.strictEqual(k.beacons.length, 3);
    k.beacons.forEach(sauber);
    assert.strictEqual(JSON.parse(k.beacons[2]).message, 'Error:sonstig@rechnung-speichern');
});

check('Promise ohne fileName: Ort aus dem Stack (nur Pfad + Zeile), Text bleibt draußen', () => {
    // Alarm 2026-10-16: "Error:sonstig (?:0)" — ohne Ort nicht auffindbar.
    const k = client();
    k.hoerer.unhandledrejection({ reason: { name: 'Error', message: 'Speichern für Max Mustermann fehlgeschlagen',
        stack: 'Error: Speichern für Max Mustermann fehlgeschlagen\n    at speichere (https://stackr.example/js/cloud-sync.js?token=GEHEIM123:812:17)\n    at https://stackr.example/js/app.js:5:1' } });
    // Firefox-Form: funktion@url:zeile:spalte
    k.hoerer.unhandledrejection({ reason: { name: 'TypeError', message: 'x',
        stack: 'lade@https://stackr.example/js/store.js:44:9\n@https://stackr.example/js/app.js:1:1' } });
    // Ohne verwertbaren Stack bleibt es wie bisher leer
    k.hoerer.unhandledrejection({ reason: 'Max Mustermann' });
    assert.strictEqual(k.beacons.length, 3);
    k.beacons.forEach(sauber);
    const a = JSON.parse(k.beacons[0]), b = JSON.parse(k.beacons[1]), c = JSON.parse(k.beacons[2]);
    assert.deepStrictEqual([a.source, a.line, a.col], ['/js/cloud-sync.js', 812, 17]);
    assert.deepStrictEqual([b.source, b.line, b.col], ['/js/store.js', 44, 9]);
    assert.deepStrictEqual([c.source, c.line], ['', 0]);
});

console.log(`\n${pass} bestanden, ${fail} fehlgeschlagen`);
if (fail) process.exit(1);
