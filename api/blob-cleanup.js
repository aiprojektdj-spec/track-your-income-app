// Vercel Cron (vercel.json, täglich 04:00 UTC) — räumt zwei Präfixe auf.
//
//   stackr/tmp/     → verwaiste Chunk-Temp-Objekte, älter als 24 h.
//                     api/blob-upload.js löscht Chunks normalerweise direkt nach 'commit';
//                     verwaist nur, wenn ein Client mitten im Multi-Chunk-Upload abbricht
//                     (Tab-Crash, Netzausfall).
//   stackr/alerts/  → abgelegte Betriebsalarme (api/_alert.js), älter als 30 Tage.
//                     Ohne diesen Durchgang wüchse der Alarmspeicher unbegrenzt — dasselbe
//                     Argument, das es für tmp/ schon gab.
//
// Echte Anhänge (stackr/attachments/) bleiben in beiden Fällen unangetastet.
// tmp/ liegt je nach BLOB_BACKEND in Vercel Blob und/oder Supabase Storage und läuft
// deshalb über api/_storage.js; die Alarme liegen weiter nur in Vercel Blob (_alert.js).
var { list, del } = require('@vercel/blob');
var storage = require('./_storage.js');

// Meldet stillschweigende Degradierung an ALERT_WEBHOOK_URL, siehe api/_alert.js.
// Hier besonders wichtig: an diesem Endpunkt haengt kein Mensch. Schlaegt er fehl, beschwert
// sich niemand — die verwaisten Chunks bleiben einfach liegen und der Blob-Speicher waechst
// weiter. Ohne Alarm faellt das erst ueber die Rechnung auf.
var _alert     = require('./_alert.js');
var alertOps   = _alert.alertOps;
var alertZiele = _alert.alertZiele;
var clientErr  = require('./_client-errors.js');
var db         = require('./_db.js');
var speicher   = require('./_sync-store.js');

var TMP_MAX_AGE_MS   = 24 * 60 * 60 * 1000;      // alles älter als 24 h unter tmp/ ist mit Sicherheit verwaist
var ALERT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage Alarm-Historie — lang genug, um einen
                                                 // Ausfall nachträglich zu belegen, kurz genug,
                                                 // dass der Speicher nicht zuläuft

// Ein Durchgang über einen Präfix. Gibt die Zahl der gelöschten Objekte zurück.
// Wirft weiter — der Aufrufer meldet den Fehler als 'cleanup-failed'.
async function sweep(prefix, maxAgeMs, now) {
    var token = process.env.BLOB_READ_WRITE_TOKEN, deleted = 0, cursor;
    do {
        var page = await list({ prefix: prefix, cursor: cursor, limit: 1000, token: token });
        var stale = (page.blobs || []).filter(function (b) {
            var ts = b && b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
            return ts && (now - ts) > maxAgeMs;
        });
        if (stale.length) { await del(stale.map(function (b) { return b.url; }), { token: token }); deleted += stale.length; }
        cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return deleted;
}

// Dead-Man-Switch (plan/betrieb-luecken-2026-09-29.md §3): healthchecks.io erwartet
// einen Ping pro erfolgreichem Lauf und alarmiert, wenn er ausbleibt. Das deckt genau
// den Fall ab, den alertOps() nicht melden kann: der Cron läuft gar nicht erst.
// Nur nach Erfolg, nie im Selbsttest. Ohne gesetzte URL kein Netzverkehr. Wirft nie,
// und wird awaited — ein offenes Promise friert Serverless nach der Antwort ein.
async function heartbeat() {
    var url = process.env.HEARTBEAT_URL_BLOB_CLEANUP;
    if (!url) return;
    try { await fetch(url, { method: 'POST', signal: AbortSignal.timeout(2000) }); } catch (e) {}
}

// Tagesmeldung zu Browser-Fehlern (plan/betrieb-luecken-2026-09-29.md §4): gibt es von
// gestern einen NEUEN Fehlertyp, geht eine Zeile über den bestehenden Alarmweg. Hängt
// hier, weil das der einzige tägliche Lauf ist. Wirft nie — ein Redis-Problem darf
// weder den Aufräumlauf noch den Heartbeat kippen (Redis-Ausfälle meldet sync.js).
async function clientErrorSummary(now) {
    try {
        var text = await clientErr.summary(now);
        if (text) await alertOps('client-error', 'daily-summary', text);
    } catch (e) {}
}

// Speicherfristen in Supabase (Migration 20261007000002_aufraeumen.sql): IP-Zähler aus
// rate_limits spätestens nach 24 h, Fehlerzähler nach 30 Tagen. Nur wenn Supabase das
// primäre System ist — nur dann landen dort Zähler. Redis braucht das nicht (EXPIRE).
// Wirft nie: ein Fehler wird gemeldet, Aufräumlauf und Heartbeat laufen weiter.
async function supabaseAufraeumen() {
    if (speicher.backendName() !== 'supabase' || speicher.configProblem()) return null;
    try { return await db.rpc('sync_aufraeumen', {}); }
    catch (e) { await alertOps('blob-cleanup', 'aufraeumen-failed', e && e.message); return null; }
}

module.exports = async function handler(req, res) {
    // Vercel Cron sendet 'Authorization: Bearer $CRON_SECRET', wenn CRON_SECRET gesetzt ist.
    // Ohne gesetztes Secret bleibt der Endpoint deaktiviert (kein offener Lösch-Endpoint).
    var secret = process.env.CRON_SECRET;
    if (!secret) {
        await alertOps('blob-cleanup', 'cron-secret-missing',
            'CRON_SECRET nicht gesetzt — Aufraeum-Job laeuft taeglich ins Leere');
        return res.status(500).json({ error: 'cron_secret_not_configured' });
    }
    // Bewusst OHNE Alarm: ein falsches Bearer-Token kommt von aussen, nicht vom Cron. Sonst
    // koennte jeder Fremdaufruf Meldungen ausloesen.
    if (req.headers['authorization'] !== 'Bearer ' + secret) return res.status(401).json({ error: 'unauthorized' });

    // ?probe=1 — Selbsttest der Alarmkette, VOR dem Aufräumlauf und ohne ihn.
    //
    // Beantwortet die eine Frage, die test/test-alert-ops.js nicht beantworten kann,
    // weil es gegen Attrappen läuft: kommt ALERT_WEBHOOK_URL aus Vercels Einstellungen
    // zur Laufzeit wirklich bei api/_alert.js an? Der dokumentierte Weg dafür war bis
    // 2026-09-13, auf Preview die Redis-Env zu verbiegen und zweimal zu deployen —
    // das hier kostet einen curl und hinterlässt keinen kaputten Zustand.
    //
    // Kein neuer Zugangsweg: die Bearer-Prüfung oben ist schon durch, und wer
    // CRON_SECRET hat, kann ohnehin den weit mächtigeren Löschlauf auslösen. Eine
    // Alarmflut ist ausgeschlossen, weil die Entprellung in _alert.js für dieses
    // source:event-Paar genauso gilt wie für jedes andere.
    if ((req.query && req.query.probe === '1') || /[?&]probe=1(&|$)/.test(req.url || '')) {
        var ziele = alertZiele();
        var gemeldet = await alertOps('selbsttest', 'webhook-probe',
            'Selbsttest von Hand ausgeloest — kein Ausfall');
        return res.status(200).json({
            ok:       true,
            probe:    true,
            env:      process.env.VERCEL_ENV || 'unknown',
            webhook:  ziele.webhook,   // ALERT_WEBHOOK_URL im laufenden Code sichtbar?
            blob:     ziele.blob,      // BLOB_READ_WRITE_TOKEN desgleichen
            gemeldet: gemeldet         // false = Entprellung, binnen 5 Min schon geschickt
        });
    }

    try {
        var now = Date.now();
        var deleted      = await storage.sweep('stackr/tmp/', TMP_MAX_AGE_MS, now);
        var alertsDeleted = await sweep('stackr/alerts/', ALERT_MAX_AGE_MS, now);
        // 'deleted' behält seine alte Bedeutung (nur tmp/), damit die Gegenprobe in
        // plan/vercel-einrichtung.md weiter stimmt. Der zweite Wert kommt additiv dazu.
        await clientErrorSummary(now);
        await supabaseAufraeumen();
        await heartbeat();
        return res.status(200).json({ ok: true, deleted: deleted, alertsDeleted: alertsDeleted });
    } catch (e) {
        // Nach bestandener Auth — hier ist der Aufrufer wirklich der Cron, ein Fehler also echt.
        await alertOps('blob-cleanup', 'cleanup-failed', e && e.message);
        return res.status(500).json({ error: 'cleanup_failed' });
    }
};
