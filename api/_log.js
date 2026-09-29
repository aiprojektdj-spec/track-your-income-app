// Stackr — strukturierte Server-Logs (plan/betrieb-luecken-2026-09-29.md §5)
// =============================================================================
// Jede Zeile ist ein JSON-Objekt mit festem Aufbau:
//
//   {"level":"error","route":"sync","code":"SYNC_STORAGE","msg":"Redis: timeout"}
//
// Dadurch lässt sich im Vercel-Log gezielt nach "code":"SYNC_STORAGE" filtern,
// statt nach wechselnden Freitexten zu suchen.
//
// Bewusst schmal: 'msg' ist nur err.message (gekürzt), nie das ganze Fehlerobjekt,
// nie ein Response-Body, nie ein Header. Ein Fehlerobjekt von fetch/Whop kann
// Tokens, E-Mail-Adressen oder die komplette Anfrage tragen — das gehört nicht ins
// Log. Wer mehr Kontext braucht, gibt ihn als festen Code mit, nicht als Daten.
//
// Der Dateiname beginnt mit "_", damit Vercel sie NICHT als Route ausliefert.
// =============================================================================

var MSG_MAX = 200;

function _msg(err) {
    if (err == null) return '';
    var m = (typeof err === 'object' && err.message) ? err.message : String(err);
    return m.slice(0, MSG_MAX);
}

function _line(level, route, code, err) {
    var o = { level: level, route: route, code: code };
    var m = _msg(err);
    if (m) o.msg = m;
    return JSON.stringify(o);
}

function logError(route, code, err) { console.error(_line('error', route, code, err)); }
function logWarn(route, code, err)  { console.warn(_line('warn',  route, code, err)); }

module.exports = { logError: logError, logWarn: logWarn, _line: _line };
