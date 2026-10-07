// Vercel Serverless Function — Whop Access-Token erneuern
//
// Hintergrund (plan/funde-whop-sitzungsabriss-2026-09-04.md): Whops Access-Token laeuft nach
// einer Stunde ab. Bis 2026-09-05 gab es keinen Erneuerungsweg — api/whop-token.js warf
// refresh_token und expires_in weg, und der 401-Zweig im Client loeschte Token, Nutzer UND
// das Offline-Grace-Token. Jeder zahlende Kunde flog dadurch stuendlich raus.
//
// WO DER REFRESH-TOKEN LIEGT — und warum nicht im Browser:
// Der Refresh-Token ist langlebig und kann jederzeit neue Access-Tokens praegen. Er bleibt
// deshalb serverseitig (Redis bzw. Supabase, api/_whop-sessions.js); der Client bekommt
// nur eine undurchsichtige Sitzungs-ID.
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
//   STORAGE_BACKEND / STORAGE_MIRROR          optional — Sitzungen und IP-Deckel in Supabase
//                                             (plan/supabase-umzug-2026-10-06.md); dann
//                                             SUPABASE_URL / _SERVICE_ROLE_KEY statt Redis
//   ALERT_WEBHOOK_URL                         optional — s. api/_alert.js

var alertOps = require('./_alert.js').alertOps;
var _log     = require('./_log.js');
var sessions = require('./_whop-sessions.js');
var store    = require('./_sync-store.js');   // nur fuer den IP-Deckel (rateHit)

var CLIENT_ID = 'app_dc3OND8eGv2Iim';
var RATE_MAX  = 30;   // pro Minute pro IP — Refresh laeuft oefter als ein Login (mehrere Tabs)
var LOCK_S    = 10;   // Sperre gegen gleichzeitigen Refresh aus zwei Tabs

// Session-Eintrag: { rt, at, exp } — Refresh-Token, zuletzt ausgegebener Access-Token und
// dessen Ablauf (ms seit Epoche). Der Access-Token liegt bewusst mit dabei: dann kann ein
// zweiter Tab, der gleichzeitig erneuern will, einfach den noch gueltigen mitbekommen,
// statt ein zweites Mal bei Whop zu rotieren (Whop invalidiert den alten Refresh-Token
// sofort — der zweite Aufruf wuerde sonst mit invalid_grant scheitern und den Kunden
// ausloggen, obwohl gerade erst erneuert wurde).
// Ablage, TTL (30 Tage) und Sperre: api/_whop-sessions.js.

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

    var problem = sessions.configProblem();
    if (problem) {
        // Fail-closed, s. Kopfkommentar. Gemeldet, weil es sonst als "Kunde loggt sich
        // staendig neu ein" beim Support landet statt als Konfigurationsfehler.
        // Alarmname bleibt 'redis-fehlt', auch mit Supabase — Make-Filter haengen daran.
        await alertOps('whop-refresh', 'redis-fehlt',
            problem + ' — Token-Erneuerung unmoeglich, Kunden fliegen stuendlich raus');
        return res.status(503).json({ error: 'refresh_unavailable' });
    }

    // IP-Deckel — hier fail-open wie ueberall sonst in api/
    try {
        var ip    = req.headers['x-vercel-forwarded-for'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
        var rlKey = 'whoprefresh:rl:' + ip;
        var count = await store.rateHit(rlKey, 60);
        if (count > RATE_MAX) return res.status(429).json({ error: 'rate_limited' });
    } catch (e) {
        await alertOps('whop-refresh', 'rate-limit-open', e && e.message);
    }

    // Abmelden: Sitzung serverseitig loeschen. Genau dafuer liegt der Refresh-Token hier
    // und nicht im Browser — ein Logout beendet ihn wirklich, statt nur lokal zu vergessen.
    if (req.body.revoke === true) {
        try { await sessions.del(sid); } catch (e) {}
        return res.status(200).json({ revoked: true });
    }

    var entry;
    try {
        entry = await sessions.get(sid);
    } catch (e) {
        // Speicher gestoert oder Eintrag nicht entschluesselbar: NIE 401 — sonst loescht der
        // Client die Sitzungs-ID, obwohl die Sitzung nach der Stoerung wieder lesbar waere.
        await alertOps('whop-refresh', 'session-nicht-lesbar', e && e.message);
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
        _log.logError('whop-refresh', 'CLIENT_SECRET_MISSING');
        return res.status(500).json({ error: 'Server misconfigured' });
    }

    // Sperre: verhindert, dass zwei gleichzeitige Anfragen beide bei Whop rotieren und die
    // zweite den gerade erneuerten Refresh-Token entwertet.
    // Laesst sich die Sperre selbst nicht setzen (Speicherfehler), wird OHNE Sperre direkt
    // erneuert (Entscheidung User 2026-10-08): der Kunde bekommt seinen Token, statt auf
    // eine Sperre zu warten, die es gar nicht gibt. Risiko: zwei Tabs rotieren gleichzeitig.
    var gotLock = false, lockFehler = false;
    try {
        gotLock = await sessions.lock(sid, LOCK_S);
    } catch (e) {
        lockFehler = true;
        _log.logWarn('whop-refresh', 'LOCK_FAILED', e && e.message);
    }

    if (!gotLock && !lockFehler) {
        // Ein anderer Aufruf rotiert gerade. Kurz warten und den neuen Stand lesen.
        await new Promise(function (r) { setTimeout(r, 1200); });
        var retry = null;
        try { retry = await sessions.get(sid); } catch (e) { /* unten: refresh_busy */ }
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
            _log.logWarn('whop-refresh', 'REFRESH_REJECTED', data && data.error);
            await sessions.del(sid);
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
        // Ab hier ist der alte Refresh-Token bei Whop schon entwertet. Schlaegt das Speichern
        // fehl, einmal wiederholen; klappt es auch dann nicht, ist die Kette verloren — der
        // Kunde bekommt trotzdem den neuen Access-Token (eine Stunde Arbeit), und es wird
        // laut gemeldet statt still wie bis 2026-10-08.
        try {
            await sessions.put(sid, neu);
        } catch (e1) {
            try {
                await sessions.put(sid, neu);
            } catch (e2) {
                await alertOps('whop-refresh', 'session-nicht-gespeichert',
                    'Rotierter Refresh-Token nicht gespeichert — Kunde fliegt nach einer Stunde raus: ' + (e2 && e2.message));
            }
        }

        return res.status(200).json({ access_token: neu.at, expires_in: expiresIn });
    } catch (err) {
        // Netz-/Zeitfehler gegen Whop: Sitzung NICHT loeschen, der Refresh-Token ist
        // vermutlich noch gut. Der Client faellt fuer diesen Lauf auf das Offline-Grace
        // zurueck und versucht es beim naechsten Mal erneut.
        _log.logError('whop-refresh', 'WHOP_UNREACHABLE', err);
        return res.status(503).json({ error: 'refresh_unavailable' });
    } finally {
        if (gotLock) { try { await sessions.unlock(sid); } catch (e) {} }
    }
};
