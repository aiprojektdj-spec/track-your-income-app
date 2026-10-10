// CORS nach dem Domain-Umzug (api/_cors.js, plan/domain-umzug-getstackr-2026-10-08.md Phase 1).
// Beide eigenen Domains bekommen ihre Origin zurueck, jede fremde nur die alte Adresse —
// nie die eigene, nie '*'. Und kein Endpunkt setzt den Header mehr selbst.
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else { console.error('✗ FAIL ' + name); process.exitCode = 1; }
}

const setze = require('../api/_cors.js');
function antwort(origin) {
    const h = {};
    setze({ headers: origin ? { origin } : {} }, { setHeader: (k, v) => { h[k] = v; } });
    return h;
}

check('C1 getstackr.de bekommt getstackr.de', antwort('https://getstackr.de')['Access-Control-Allow-Origin'] === 'https://getstackr.de');
check('C2 alte Adresse bekommt die alte Adresse',
    antwort('https://track-your-income-app.vercel.app')['Access-Control-Allow-Origin'] === 'https://track-your-income-app.vercel.app');
const fremd = antwort('https://example.com')['Access-Control-Allow-Origin'];
check('C3 fremde Origin bekommt weder sich selbst noch *', fremd !== 'https://example.com' && fremd !== '*');
check('C4 ohne Origin-Header: alte Adresse wie bisher',
    antwort('')['Access-Control-Allow-Origin'] === 'https://track-your-income-app.vercel.app');
check('C5 Vary: Origin, weil die Antwort vom Origin abhaengt', antwort('https://getstackr.de').Vary === 'Origin');
check('C6 www-Variante ist nicht freigegeben (leitet ohnehin per 308 um)',
    antwort('https://www.getstackr.de')['Access-Control-Allow-Origin'] !== 'https://www.getstackr.de');

// Kein Endpunkt setzt Access-Control-Allow-Origin mehr fest — sonst laeuft die Liste wieder
// auseinander, sobald eine dritte Domain dazukommt.
const apiDir = path.join(__dirname, '..', 'api');
const fest = fs.readdirSync(apiDir).filter(f => f.endsWith('.js') && f !== '_cors.js')
    .filter(f => /setHeader\(\s*'Access-Control-Allow-Origin'/.test(fs.readFileSync(path.join(apiDir, f), 'utf8')));
check('C7 kein Endpunkt setzt die Origin fest' + (fest.length ? ' (' + fest.join(', ') + ')' : ''), fest.length === 0);

console.log('\n' + pass + '/' + total + ' Checks bestanden');
