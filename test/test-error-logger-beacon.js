// Browser-Fehler, Client-Seite:  node test/test-error-logger-beacon.js
//
// plan/betrieb-luecken-2026-09-29.md §4, js/error-logger.js. Geprüft wird:
//   11) https: sendBeacon an /api/client-error, ohne Stack/URL/UA, Quelle nur Pfad
//   12) gleicher Fehler nur 1x, höchstens 10 pro Seitenaufruf; file: und http: senden nie
//   13) nichts im sessionStorage (F7, § 25 TDDDG)
// Die Server-Seite prüft test/test-client-error.js.
'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name); }
}

(function () {
    const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'error-logger.js'), 'utf8');
    function client(protocol) {
        const beacons = [], ss = {};
        const win = {
            location: { protocol: protocol, pathname: '/app.html', href: protocol + '//stackr.example/app.html?kunde=x' },
            navigator: { userAgent: 'Mozilla/5.0 Test', sendBeacon: function (u, b) { beacons.push({ u: u, b: b }); return true; } },
            localStorage:   { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} },
            sessionStorage: { getItem: function (k) { return ss[k] || null; }, setItem: function (k, v) { ss[k] = v; } },
            addEventListener: function () {},
            console: { warn: function () {} },
            Blob: function (parts, o) { this.text = parts.join(''); this.type = o && o.type; },
            URL: URL, JSON: JSON, Date: Date, String: String, Object: Object
        };
        win.window = win;
        vm.runInNewContext(SRC, win);
        return { win: win, beacons: beacons, ss: ss };
    }
    let k = client('https:');
    k.win.onerror('Boom', 'https://stackr.example/js/app.js?v=9', 10, 2, { stack: 'at geheim' });
    k.win.onerror('Boom', 'https://stackr.example/js/app.js?v=9', 10, 2, { stack: 'at geheim' });
    const b0 = k.beacons[0] ? JSON.parse(k.beacons[0].b.text) : {};
    check('11) sendBeacon an /api/client-error', k.beacons.length >= 1 && k.beacons[0].u === '/api/client-error');
    check('11) nur type/message/source/line/col/v', Object.keys(b0).sort().join(',') === 'col,line,message,source,type,v');
    check('11) Quelle nur Pfad', b0.source === '/js/app.js');
    check('12) gleicher Fehler nur einmal', k.beacons.length === 1);
    for (let i = 0; i < 20; i++) k.win.ErrorLogger.log(new Error('e' + i));
    check('12) höchstens 10 pro Seitenaufruf', k.beacons.length === 10);
    check('   manuelle Meldung ohne Quelle -> leere Quelle', JSON.parse(k.beacons[1].b.text).source === '');
    check('13) nichts im sessionStorage', Object.keys(k.ss).length === 0);
    k = client('file:'); k.win.onerror('Boom', 'file:///C:/x/js/app.js', 1, 1);
    const f = k.beacons.length;
    k = client('http:'); k.win.onerror('Boom', 'http://localhost:8080/js/app.js', 1, 1);
    check('12) file: und http: senden nie', f === 0 && k.beacons.length === 0);

    console.log('\n' + pass + '/' + total + ' bestanden');
    process.exit(pass === total ? 0 : 1);
})();
