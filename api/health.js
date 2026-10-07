// Stackr — Health-Check für das Uptime-Monitoring (plan/betrieb-luecken-2026-09-29.md §3)
// =============================================================================
// GET /api/health  →  200 { ok: true,  redis: "ok" [, supabase: "ok"] }
//                     503 { ok: false, redis: "down" | supabase: "down" }
//
// Der Statuscode trägt die Aussage: UptimeRobot/Better Stack alarmieren allein
// an "nicht 200", ohne Keyword-Regel. Redis ist das einzige Backend, an dem der
// Cloud-Sync hängt — deshalb ist es das, was hier geprüft wird. Whop und Blob
// bleiben bewusst draußen: ein Whop-Ausfall ist nicht unserer, und ein
// fremder Dienst in der Health-Antwort erzeugt Alarme, gegen die man nichts tun kann.
//
// Supabase-Umzug (plan/supabase-umzug-2026-10-06.md): Supabase wird nur geprüft, wenn
// es benutzt wird — als STORAGE_BACKEND, STORAGE_MIRROR oder BLOB_BACKEND. Sonst fehlt
// das Feld in der Antwort ganz. Redis bleibt Pflicht, solange Login-Refresh und
// Fehlerzähler daran hängen. Der Ping ist ein lesender rpc-Aufruf auf eine Kennung,
// die nie einem Whop-Nutzer gehört (die beginnen mit "user_").
//
// Keine internen Details in der Antwort (keine Fehlertexte, keine Hosts), keine Auth:
// der Endpunkt ist öffentlich, damit der Monitor ihn ohne Secret abfragen kann.
//
// Das Ergebnis wird pro Instanz 30 s gemerkt. Sonst kostet jeder Fremdaufruf ein
// Upstash-Kommando — der Endpunkt hat kein Rate-Limit, weil das selbst Redis bräuchte.
// =============================================================================

var REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '';
var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
var db          = require('./_db.js');
var USES_SUPABASE = process.env.STORAGE_BACKEND === 'supabase' || process.env.STORAGE_MIRROR === 'supabase' ||
                    process.env.BLOB_BACKEND === 'supabase';

var CACHE_MS = 30 * 1000;
var _cache   = null;   // { at, body }

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

async function _pingSupabase() {
    if (!db.isConfigured()) return 'down';
    try {
        await db.rpc('sync_get_pubkey', { p_user: '__health' });
        return 'ok';
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
        var r = await Promise.all([_pingRedis(), USES_SUPABASE ? _pingSupabase() : null]);
        var body = { ok: r[0] === 'ok' && (r[1] === null || r[1] === 'ok'), redis: r[0] };
        if (r[1] !== null) body.supabase = r[1];
        _cache = { at: now, body: body };
    }
    return res.status(_cache.body.ok ? 200 : 503).json(_cache.body);
};
