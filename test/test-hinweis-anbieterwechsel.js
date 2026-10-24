// Einmaliger Hinweis zum neuen Speicherort des Cloud-Sync (Upstash → Supabase), 2026-10-24
//
// DSE Ziffer 9 verspricht Information bei wesentlichen Aenderungen; die Einwilligung beim
// Aktivieren nannte nur Upstash (plan/rechtsaudit-2026-10-24.md, A5). Geprueft wird: Hinweis
// nur bei aktivem Sync mit Schluessel, genau einmal, nicht ueber ein offenes Fenster, und wer
// nach der Umstellung aktiviert, bekommt ihn nicht.
'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'cloud-sync.js'), 'utf8');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); }
}

const start = src.indexOf('function _maybeNotifyAnbieterwechsel()');
const ende  = src.indexOf('\n    function ', start + 10);
check('A1 Funktion vorhanden', start !== -1 && ende !== -1);
const fnSrc = src.slice(start, ende);

function lauf(o) {
    const ls = Object.assign({}, o.ls || {});
    const modale = [];
    const localStorage = {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(ls, k) ? ls[k] : null; },
        setItem: function (k, v) { ls[k] = String(v); }
    };
    const document = { getElementById: function () { return { classList: { contains: function () { return !!o.modalOffen; } } }; } };
    const App = { showModal: function (t, b) { modale.push({ t: t, b: b }); } };
    const setTimeout = function (f) { f(); };
    const fn = new Function('_enabled', '_hasKey', 'localStorage', 'document', 'App', 'setTimeout', 'LS_HINWEIS_SUPABASE',
        fnSrc + '\nreturn _maybeNotifyAnbieterwechsel;')(
        function () { return o.enabled; }, function () { return o.hasKey; },
        localStorage, document, App, setTimeout, 'oyi_sync_hinweis_supabase');
    fn();
    return { modale: modale, ls: ls };
}

let r = lauf({ enabled: true, hasKey: true });
check('B1 aktiver Sync ohne Merker → Hinweis erscheint', r.modale.length === 1);
check('B2 Hinweis nennt Supabase und Frankfurt', /Supabase \(Frankfurt, EU\)/.test(r.modale[0] && r.modale[0].b));
check('B3 Merker wird gesetzt', !!r.ls.oyi_sync_hinweis_supabase);
check('B4 zweiter Start mit Merker → kein Hinweis', lauf({ enabled: true, hasKey: true, ls: r.ls }).modale.length === 0);
check('C1 Sync aus → kein Hinweis, kein Merker', (function () { const x = lauf({ enabled: false, hasKey: true }); return x.modale.length === 0 && !x.ls.oyi_sync_hinweis_supabase; })());
check('C2 kein Schluessel → kein Hinweis', lauf({ enabled: true, hasKey: false }).modale.length === 0);
check('C3 anderes Fenster offen → kein Hinweis, Merker bleibt leer (naechster Start)',
      (function () { const x = lauf({ enabled: true, hasKey: true, modalOffen: true }); return x.modale.length === 0 && !x.ls.oyi_sync_hinweis_supabase; })());

// Neu Aktivierende sahen den Dialog mit Supabase schon: Merker direkt nach LS_ENABLED='1' in der Code-Bestaetigung
check('D1 Aktivierung setzt den Merker', /localStorage\.setItem\(LS_ENABLED, '1'\);\s*\n\s*try \{ localStorage\.setItem\(LS_HINWEIS_SUPABASE/.test(src));
const initIdx = src.indexOf('function init()');
check('D2 init() ruft den Hinweis auf', src.indexOf('_maybeNotifyAnbieterwechsel();', initIdx) !== -1);
check('D3 Merker steht in der Cookie-Richtlinie',
      fs.readFileSync(path.join(__dirname, '..', 'cookies.html'), 'utf8').indexOf('oyi_sync_hinweis_supabase') !== -1);

console.log('\n' + pass + '/' + total + ' bestanden');
process.exit(pass === total ? 0 : 1);
