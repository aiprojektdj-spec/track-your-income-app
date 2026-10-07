// Stackr — Annahme von Browser-Fehlern (plan/betrieb-luecken-2026-09-29.md §4)
// =============================================================================
// POST /api/client-error   Body: { type, message, source, line, col, v }  (max. 4 KB)
//   → 204 immer, wenn die Anfrage formal in Ordnung ist — auch wenn gedrosselt oder
//     Redis nicht erreichbar. Der Absender ist navigator.sendBeacon, der die Antwort
//     ohnehin nicht liest; ein Fehler hier darf beim Kunden nichts auslösen.
//   → 405 kein POST · 403 fremder Origin · 413 Body zu groß · 429 Rate-Limit
//
// Was gespeichert wird und was nicht, steht in api/_client-errors.js.
//
// Schutz gegen Missbrauch (der Endpunkt ist ohne Login erreichbar, wie jeder
// Fehler-Collector — ein Fehler tritt ja oft genau VOR dem Login auf):
//   - nur gleicher Origin: sendBeacon schickt den Origin-Header immer mit
//   - 10 Meldungen pro Minute pro IP
//   - 5000 Meldungen pro Tag insgesamt; darüber wird still verworfen, damit ein
//     verteilter Flood weder das Upstash-Kontingent noch die Tagesmail füllt
// Anders als bei sync.js ist das Rate-Limit hier FAIL-CLOSED: ohne Speicher wird die
// Meldung verworfen. Ein verlorener Fehlerbericht kostet nichts, ein zahlender Kunde
// ist davon nicht betroffen.
// =============================================================================

var ce    = require('./_client-errors.js');
var _log  = require('./_log.js');
// Deckel über den Speicher-Adapter: STORAGE_BACKEND entscheidet Redis | Supabase
var store = require('./_sync-store.js');

var BODY_MAX    = 4096;
var IP_RATE_MAX = 10;
var DAY_MAX     = 5000;

function _bodyText(body) {
    if (body == null) return '';
    if (typeof body === 'string') return body;
    if (Buffer.isBuffer(body)) return body.toString('utf8');
    try { return JSON.stringify(body); } catch (e) { return ''; }
}

function _sameOrigin(req) {
    var origin = req.headers['origin'] || '';
    var host   = req.headers['x-forwarded-host'] || req.headers['host'] || '';
    if (!origin || !host) return false;
    try { return new URL(origin).host === host; } catch (e) { return false; }
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    if (!_sameOrigin(req))     return res.status(403).json({ error: 'forbidden' });

    if (parseInt(req.headers['content-length'], 10) > BODY_MAX) return res.status(413).json({ error: 'too_large' });
    var text = _bodyText(req.body);
    if (Buffer.byteLength(text, 'utf8') > BODY_MAX) return res.status(413).json({ error: 'too_large' });

    var raw;
    try { raw = typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(text); }
    catch (e) { return res.status(400).json({ error: 'bad_json' }); }

    if (store.configProblem()) return res.status(204).end();

    var now = Date.now();
    try {
        var ip  = req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
        var key = 'clerr:iprl:' + ip;
        var n   = await store.rateHit(key, 60);
        if (n > IP_RATE_MAX) return res.status(429).json({ error: 'rate_limited' });

        var tKey = 'clerr:total:' + ce.tag(now);
        var t    = await store.rateHit(tKey, 2 * 24 * 60 * 60);
        if (t > DAY_MAX) return res.status(204).end();

        await ce.store(ce.sanitize(raw, now), now);
    } catch (e) {
        _log.logWarn('client-error', 'STORE_FAILED', e);
    }
    return res.status(204).end();
};
