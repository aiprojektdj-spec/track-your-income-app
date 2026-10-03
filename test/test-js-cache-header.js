// Test: Eigene JS-Dateien dürfen nach einem Deploy nicht veraltet aus dem Cache kommen
//
//   node test/test-js-cache-header.js
//
// WORUM ES GEHT: Die Seiten binden ihre Skripte ohne Version im Namen ein
// (`<script src="js/actions.js">`). Hätte /js/*.js ein `max-age > 0`, lädt der Browser
// nach einem Deploy neues HTML mit teils alten Skripten — ReferenceError, alte
// Merge-Logik in cloud-sync.js gegen den neuen Server, Steuerlogik in zwei Ständen.
// Deshalb: eigene JS-Dateien immer revalidieren (ETag → 304), nur js/vendor/ darf lange
// cachen, weil sich Vendor-Dateien ausschließlich mit neuem Dateinamen ändern.

'use strict';
const fs   = require('fs');
const path = require('path');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
let fehler = 0;
const fail = (msg) => { console.error('FAIL ' + msg); fehler++; };

const maxAge = (wert) => {
  const m = /max-age=(\d+)/.exec(wert || '');
  return m ? Number(m[1]) : null;
};

let jsRegelGefunden = false;
for (const regel of cfg.headers || []) {
  const src = regel.source || '';
  if (!src.startsWith('/js/')) continue;
  const cc = (regel.headers || []).find(h => h.key.toLowerCase() === 'cache-control');
  if (!cc) continue;
  if (src.startsWith('/js/vendor/')) continue;
  jsRegelGefunden = true;
  const age = maxAge(cc.value);
  if (age === null || age > 0) fail(`${src}: Cache-Control "${cc.value}" — eigene JS-Dateien brauchen max-age=0`);
  if (!/must-revalidate|no-cache/.test(cc.value)) fail(`${src}: Cache-Control ohne must-revalidate/no-cache`);
}
if (!jsRegelGefunden) fail('keine Cache-Control-Regel für /js/ gefunden — ohne sie greift der Vercel-Default, Test anpassen');

// Die Vendor-Regel muss NACH der allgemeinen JS-Regel stehen, sonst überschreibt diese
// den langen Vendor-Cache (bei gleichem Header gewinnt die spätere Regel).
const idx = (cfg.headers || []).map(r => r.source);
const iJs = idx.indexOf('/js/(.*).js'), iVendor = idx.indexOf('/js/vendor/(.*)');
if (iJs >= 0 && iVendor >= 0 && iVendor < iJs) fail('/js/vendor/(.*) steht vor /js/(.*).js');

if (fehler) { console.error(`${fehler} Fehler`); process.exit(1); }
console.log('OK js-cache-header');
