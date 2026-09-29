// Strukturierte Server-Logs:  node test/test-server-log.js
//
// plan/betrieb-luecken-2026-09-29.md §5. Geprüft wird:
//   1) api/_log.js schreibt genau eine JSON-Zeile mit level/route/code(/msg)
//   2) aus einem Fehlerobjekt landet nur die message im Log, keine weiteren Felder
//   3) msg wird auf 200 Zeichen gekürzt
//   4) kein Endpunkt in api/ ruft console.error/warn/log noch direkt auf
//      (Ausnahme: _log.js selbst) — sonst kehrt der Freitext zurück
'use strict';
const fs   = require('fs');
const path = require('path');

let pass = 0, total = 0;
function check(name, cond) {
    total++;
    if (cond) { pass++; console.log('✓ ' + name); }
    else      { console.log('✗ ' + name); }
}

const _log = require(path.join(__dirname, '..', 'api', '_log.js'));

let zeilen = [];
const realError = console.error, realWarn = console.warn;
console.error = function () { zeilen.push({ lvl: 'error', args: [].slice.call(arguments) }); };
console.warn  = function () { zeilen.push({ lvl: 'warn',  args: [].slice.call(arguments) }); };

_log.logError('sync', 'STORAGE_ERROR', new Error('Redis: timeout'));
const e = new Error('kaputt');
e.config = { headers: { Authorization: 'Bearer geheim-123' } };
e.response = { data: { email: 'kunde@example.com' } };
_log.logError('whop-token', 'WHOP_UNREACHABLE', e);
_log.logWarn('blob-upload', 'CHUNK_CLEANUP_FAILED', 'x'.repeat(500));
_log.logError('whop-refresh', 'CLIENT_SECRET_MISSING');

console.error = realError; console.warn = realWarn;

check('1) vier Aufrufe, je genau ein Argument', zeilen.length === 4 && zeilen.every(function (z) { return z.args.length === 1; }));
let o0 = null;
try { o0 = JSON.parse(zeilen[0].args[0]); } catch (x) {}
check('1) gültiges JSON mit festem Aufbau', o0 && o0.level === 'error' && o0.route === 'sync' &&
      o0.code === 'STORAGE_ERROR' && o0.msg === 'Redis: timeout');
check('2) Token und E-Mail aus dem Fehlerobjekt nicht im Log',
      zeilen[1].args[0].indexOf('geheim') === -1 && zeilen[1].args[0].indexOf('@') === -1);
check('2) nur level/route/code/msg', Object.keys(JSON.parse(zeilen[1].args[0])).join(',') === 'level,route,code,msg');
check('3) msg auf 200 Zeichen gekürzt', JSON.parse(zeilen[2].args[0]).msg.length === 200 && zeilen[2].lvl === 'warn');
check('   ohne Fehler kein msg-Feld', !('msg' in JSON.parse(zeilen[3].args[0])));

const apiDir = path.join(__dirname, '..', 'api');
const roh = fs.readdirSync(apiDir).filter(function (f) { return /\.js$/.test(f) && f !== '_log.js'; })
    .filter(function (f) {
        return fs.readFileSync(path.join(apiDir, f), 'utf8').split('\n').some(function (l) {
            return /console\.(error|warn|log)\s*\(/.test(l) && !/^\s*\/\//.test(l);
        });
    });
check('4) kein direkter console-Aufruf in api/' + (roh.length ? ' (' + roh.join(', ') + ')' : ''), roh.length === 0);

console.log('\n' + pass + '/' + total + ' bestanden');
process.exit(pass === total ? 0 : 1);
