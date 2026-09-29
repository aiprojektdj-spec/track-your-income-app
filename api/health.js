// Stackr — Health-Check für das Uptime-Monitoring (plan/betrieb-luecken-2026-09-29.md §3)
// =============================================================================
// GET /api/health  →  200 { ok: true,  redis: "ok" }
//                     503 { ok: false, redis: "down" }
//
// Der Statuscode trägt die Aussage: UptimeRobot/Better Stack alarmieren allein
// an "nicht 200", ohne Keyword-Regel. Redis ist das einzige Backend, an dem der
// Cloud-Sync hängt — deshalb ist es das, was hier geprüft wird. Whop und Blob
// bleiben bewusst draußen: ein Whop-Ausfall ist nicht unserer, und ein
// fremder Dienst in der Health-Antwort erzeugt Alarme, gegen die man nichts tun kann.
//
// Keine internen Details in der Antwort (keine Fehlertexte, keine Hosts), keine Auth:
// der Endpunkt ist öffentlich, damit der Monitor ihn ohne Secret abfragen kann.
//
// Das Redis-Ergebnis wird pro Instanz 30 s gemerkt. Sonst kostet jeder Fremdaufruf
// ein Upstash-Kommando — der Endpunkt hat kein Rate-Limit, weil das selbst Redis bräuchte.
// =============================================================================

var REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '';
var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

var CACHE_MS = 30 * 1000;
var _cache   = null;   // { at, redis }

async function _pingRedis() {
    if (!REDIS_URL || !REDIS_TOKEN) return 'down';
    try {
        var r = await fetch(REDIS_URL, {
            method:  'POST',
            headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
            body:    JSON.stringify(['PING']),
            signal:  AbortSignal.timeout(3000)
        });
        var j = await r.json();
        return (j && j.result === 'PONG') ? 'ok' : 'down';
    } catch (e) {
        return 'down';
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(405).json({ error: 'method_not_allowed' });
    }

    var now = Date.now();
    if (!_cache || (now - _cache.at) > CACHE_MS) {
        _cache = { at: now, redis: await _pingRedis() };
    }
    var ok = _cache.redis === 'ok';
    return res.status(ok ? 200 : 503).json({ ok: ok, redis: _cache.redis });
};
