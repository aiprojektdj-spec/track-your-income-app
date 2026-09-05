// Vercel Serverless Function — Whop Access-Token erneuern
//
// Hintergrund (plan/funde-whop-sitzungsabriss-2026-09-04.md): Whops Access-Token laeuft nach
// einer Stunde ab. Bis 2026-09-05 gab es keinen Erneuerungsweg — api/whop-token.js warf
// refresh_token und expires_in weg, und der 401-Zweig im Client loeschte Token, Nutzer UND
// das Offline-Grace-Token. Jeder zahlende Kunde flog dadurch stuendlich raus.
//
// WO DER REFRESH-TOKEN LIEGT — und warum nicht im Browser:
// Der Refresh-Token ist langlebig und kann jederzeit neue Access-Tokens praegen. Er bleibt
// deshalb serverseitig in Redis; der Client bekommt nur eine undurchsichtige Sitzungs-ID.
// Das haelt die Linie aus js/whop-auth.js ein (Art. 5 Abs. 1 lit. c DSGVO: dort werden
// bewusst nur id und username persistiert), und es macht die Sitzung serverseitig
// widerrufbar — anders als ein Refresh-Token im localStorage.
// Die Entscheidung ist am 2026-09-05 vom User so getroffen worden.
//
// FAIL-CLOSED, anders als die Rate-Limits ringsum:
// Die IP-Deckel in diesem Verzeichnis sind bewusst fail-open (02-ENTSCHEIDUNGEN.md — ein
// zahlender Kunde darf nicht an einem Redis-Ausfall scheitern). Fuer den Token-Speicher geht
// das nicht: ohne Redis gibt es keinen Refresh-Token, also auch keine Erneuerung. Der Fall
// endet mit 401 und der Kunde meldet sich neu an — also genau dem Verhalten von vor diesem
// Endpunkt. Kein Rueckschritt, nur keine Verbesserung.
//
// Env:
//   WHOP_CLIENT_SECRET                        erforderlich
//   UPSTASH_REDIS_REST_URL / _TOKEN           erforderlich (sonst kein Refresh moeglich)
//   ALERT_WEBHOOK_URL                         optional — s. api/_alert.js

var alertOps = require('./_alert.js').alertOps;

var REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL   || process.env.KV_REST_API_URL   || '';
var REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

var CLIENT_ID = 'app_dc3OND8eGv2Iim';
var RATE_MAX  = 30;   // pro Minute pro IP — Refresh laeuft oefter als ein Login (mehrere Tabs)
var LOCK_S    = 10;   // Sperre gegen gleichzeitigen Refresh aus zwei Tabs

function redisCmd(cmd) {
    return fetch(REDIS_URL, {
        method:  'POST',
        headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
        body:    JSON.stringify(cmd),
        signal:  AbortSignal.timeout(8000)
    }).then(function (r) { return r.json(); }).then(function (j) { return j ? j.result : null; });
}

// Session-Eintrag: { rt, at, exp } — Refresh-Token, zuletzt ausgegebener Access-Token und
// dessen Ablauf (ms seit Epoche). Der Access-Token liegt bewusst mit dabei: dann kann ein
// zweiter Tab, der gleichzeitig erneuern will, einfach den noch gueltigen mitbekommen,
// statt ein zweites Mal bei Whop zu rotieren (Whop invalidiert den alten Refresh-Token
// sofort — der zweite Aufruf wuerde sonst mit invalid_grant scheitern und den Kunden
// ausloggen, obwohl gerade erst erneuert wurde).
var SESSION_TTL_S = 30 * 24 * 60 * 60; // 30 Tage

function sessKey(sid) { return 'whoprt:' + sid; }

async function readSession(sid) {
    var raw = await redisCmd(['GET', sessKey(sid)]);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

async function writeSession(sid, entry) {
    await redisCmd(['SET', sessKey(sid), JSON.stringify(entry), 'EX', String(SESSION_TTL_S)]);
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://track-your-income-app.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

    var sid = req.body && req.body.session_id;
    // Laenge grosszuegig, aber gedeckelt: die ID ist 64 Hex-Zeichen (32 Byte).
    if (!sid || typeof sid !== 'string' || !/^[a-f0-9]{32,128}$/.test(sid)) {
        return res.status(400).json({ error: 'Missing or invalid session_id' });
    }

    if (!REDIS_URL || !REDIS_TOKEN) {
        // Fail-closed, s. Kopfkommentar. Gemeldet, weil es sonst als "Kunde loggt sich
        // staendig neu ein" beim Support landet statt als Konfigurationsfehler.
        await alertOps('whop-refresh', 'redis-fehlt',
            'UPSTASH_REDIS_REST_URL/TOKEN nicht gesetzt — Token-Erneuerung unmoeglich, Kunden fliegen stuendlich raus');
        return res.status(503).json({ error: 'refresh_unavailable' });
    }

    // IP-Deckel — hier fail-open wie ueberall sonst in api/
    try {
        var ip    = req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
        var rlKey = 'whoprefresh:rl:' + ip;
        var count = await redisCmd(['INCR', rlKey]);
        await redisCmd(['EXPIRE', rlKey, '60', 'NX']);
        if (count > RATE_MAX) return res.status(429).json({ error: 'rate_limited' });
    } catch (e) {
        await alertOps('whop-refresh', 'rate-limit-open', e && e.message);
    }

    // Abmelden: Sitzung serverseitig loeschen. Genau dafuer liegt der Refresh-Token hier
    // und nicht im Browser — ein Logout beendet ihn wirklich, statt nur lokal zu vergessen.
    if (req.body.revoke === true) {
        try { await redisCmd(['DEL', sessKey(sid)]); } catch (e) {}
        return res.status(200).json({ revoked: true });
    }

    var entry;
    try {
        entry = await readSession(sid);
    } catch (e) {
        return res.status(503).json({ error: 'refresh_unavailable' });
    }
    if (!entry || !entry.rt) return res.status(401).json({ error: 'session_expired' });

    // Noch ein gueltiger Access-Token da? Dann den ausgeben, statt bei Whop zu rotieren.
    // Deckt den Fall "zwei Tabs erneuern gleichzeitig" ohne Sperre ab. 60 s Sicherheitsrand,
    // damit der Aufrufer den Token nicht Sekunden vor dem Ablauf bekommt.
    if (entry.at && entry.exp && entry.exp - Date.now() > 60 * 1000) {
        return res.status(200).json({
            access_token: entry.at,
            expires_in:   Math.floor((entry.exp - Date.now()) / 1000)
        });
    }

    var clientSecret = process.env.WHOP_CLIENT_SECRET;
    if (!clientSecret) {
        console.error('[whop-refresh] WHOP_CLIENT_SECRET not set');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    // Sperre: verhindert, dass zwei gleichzeitige Anfragen beide bei Whop rotieren und die
    // zweite den gerade erneuerten Refresh-Token entwertet.
    var lockKey = 'whoprt:lock:' + sid;
    var gotLock = false;
    try {
        gotLock = (await redisCmd(['SET', lockKey, '1', 'NX', 'EX', String(LOCK_S)])) !== null;
    } catch (e) { /* ohne Sperre weiter — schlimmstenfalls ein ueberfluessiger Rotationsversuch */ }

    if (!gotLock) {
        // Ein anderer Aufruf rotiert gerade. Kurz warten und den neuen Stand lesen.
        await new Promise(function (r) { setTimeout(r, 1200); });
        var retry = await readSession(sid);
        if (retry && retry.at && retry.exp && retry.exp > Date.now()) {
            return res.status(200).json({
                access_token: retry.at,
                expires_in:   Math.floor((retry.exp - Date.now()) / 1000)
            });
        }
        return res.status(503).json({ error: 'refresh_busy' });
    }

    try {
        var tokenRes = await fetch('https://api.whop.com/oauth/token', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                grant_type:    'refresh_token',
                refresh_token: entry.rt,
                client_id:     CLIENT_ID,
                client_secret: clientSecret
            }),
            signal: AbortSignal.timeout(10000)
        });
        var data = await tokenRes.json();

        if (!tokenRes.ok || !data.access_token) {
            // Whop lehnt den Refresh-Token ab (abgelaufen, widerrufen, schon rotiert).
            // Sitzung ist tot — aufraeumen, damit der Client nicht in einer Schleife haengt.
            console.error('[whop-refresh] Refresh abgelehnt:', JSON.stringify(data));
            await redisCmd(['DEL', sessKey(sid)]);
            return res.status(401).json({ error: 'session_expired' });
        }

        // Rotation: Whop gibt bei jedem Refresh einen NEUEN Refresh-Token zurueck und
        // entwertet den alten sofort. Faellt das Speichern hier aus, ist die Kette tot —
        // deshalb schreiben wir VOR dem Antworten und melden einen Fehlschlag.
        var expiresIn = parseInt(data.expires_in, 10);
        if (!expiresIn || expiresIn < 0) expiresIn = 3600; // Whop-Default laut Doku
        var neu = {
            rt:  data.refresh_token || entry.rt,   // fehlt er wider Erwarten, alten behalten
            at:  data.access_token,
            exp: Date.now() + expiresIn * 1000
        };
        await writeSession(sid, neu);

        return res.status(200).json({ access_token: neu.at, expires_in: expiresIn });
    } catch (err) {
        // Netz-/Zeitfehler gegen Whop: Sitzung NICHT loeschen, der Refresh-Token ist
        // vermutlich noch gut. Der Client faellt fuer diesen Lauf auf das Offline-Grace
        // zurueck und versucht es beim naechsten Mal erneut.
        console.error('[whop-refresh] Fetch-Fehler:', err);
        return res.status(503).json({ error: 'refresh_unavailable' });
    } finally {
        try { await redisCmd(['DEL', lockKey]); } catch (e) {}
    }
};
