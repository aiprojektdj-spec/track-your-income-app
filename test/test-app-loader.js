// app.html: Login zuerst, Module danach (js/app-loader.js).
// Sichert ab, dass die nachgeladene Liste vollstaendig ist, nicht doppelt laedt und mit
// whop-auth.js uebereinstimmt.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fails = 0;
function check(name, ok) {
    console.log((ok ? 'OK   ' : 'FAIL ') + name);
    if (!ok) fails++;
}

global.window = {};
global.document = { readyState: 'loading', addEventListener() {} };
require(path.join(ROOT, 'js', 'app-loader.js'));
const MODULES = window.AppLoader.MODULES;

const html = read('app.html');
const auth = read('js/whop-auth.js');
const loader = read('js/app-loader.js');
const appJs = read('js/app.js');

check('A1 jede nachgeladene Datei existiert',
      MODULES.every((src) => fs.existsSync(path.join(ROOT, src.split('?')[0]))));
check('A2 keine Datei doppelt in der Liste', new Set(MODULES).size === MODULES.length);
const appIdx = MODULES.findIndex((src) => /^js\/app\.js(\?|$)/.test(src));
check('A3 nach js/app.js nur noch Redesign-Skripte',
      appIdx !== -1 && MODULES.slice(appIdx + 1).every((src) => /^js\/redesign-[a-z]+\.js$/.test(src)));
check('A4 js/app.js startet erst, wenn der Loader fertig ist',
      /window\.AppLoader\.ready\.then\(_startApp\)/.test(appJs) && /markReady\(\)/.test(loader));

const staticSrcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
check('B1 app.html laedt kein Modul zusaetzlich statisch',
      MODULES.every((src) => !staticSrcs.includes(src)));
check('B2 app.html bindet den Loader nach whop-auth.js ein',
      staticSrcs.indexOf('js/app-loader.js') > staticSrcs.indexOf('js/whop-auth.js') &&
      staticSrcs.indexOf('js/whop-auth.js') !== -1);
check('B3 kein Preload mehr fuer js/app.js', !/rel="preload"[^>]*href="js\/app\.js/.test(html));

const tokenKey = (auth.match(/var LS_TOKEN\s*=\s*'([^']+)'/) || [])[1];
check('C1 Loader prueft denselben Token-Schluessel wie whop-auth.js',
      !!tokenKey && loader.includes("localStorage.getItem('" + tokenKey + "')"));

check('D1 js/app.js startet auch, wenn DOMContentLoaded schon vorbei ist',
      /document\.readyState === 'loading'\) document\.addEventListener\('DOMContentLoaded', _startApp\);\s*else _startApp\(\);/.test(appJs));

if (fails) { console.log(`\n${fails} Fehler`); process.exit(1); }
console.log('\nAlle Checks gruen');
