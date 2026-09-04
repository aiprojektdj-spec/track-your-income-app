// Vercel Cron (vercel.json, täglich 04:00 UTC) — räumt verwaiste Chunk-Temp-Objekte auf.
// api/blob-upload.js löscht Chunks normalerweise direkt nach 'commit'; verwaist nur,
// wenn ein Client mitten im Multi-Chunk-Upload abbricht (Tab-Crash, Netzausfall).
// Betrifft NUR den 'stackr/tmp/'-Präfix — echte Anhänge (stackr/attachments/) bleiben unangetastet.
var { list, del } = require('@vercel/blob');

// Meldet stillschweigende Degradierung an ALERT_WEBHOOK_URL, siehe api/_alert.js.
// Hier besonders wichtig: an diesem Endpunkt haengt kein Mensch. Schlaegt er fehl, beschwert
// sich niemand — die verwaisten Chunks bleiben einfach liegen und der Blob-Speicher waechst
// weiter. Ohne Alarm faellt das erst ueber die Rechnung auf.
var alertOps = require('./_alert.js').alertOps;

var MAX_AGE_MS = 24 * 60 * 60 * 1000; // alles älter als 24h unter tmp/ ist mit Sicherheit verwaist

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

    try {
        var deleted = 0, cursor, now = Date.now();
        do {
            var page = await list({ prefix: 'stackr/tmp/', cursor: cursor, limit: 1000, token: process.env.BLOB_READ_WRITE_TOKEN });
            var stale = (page.blobs || []).filter(function (b) {
                var ts = b && b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
                return ts && (now - ts) > MAX_AGE_MS;
            });
            if (stale.length) { await del(stale.map(function (b) { return b.url; }), { token: process.env.BLOB_READ_WRITE_TOKEN }); deleted += stale.length; }
            cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor);
        return res.status(200).json({ ok: true, deleted: deleted });
    } catch (e) {
        // Nach bestandener Auth — hier ist der Aufrufer wirklich der Cron, ein Fehler also echt.
        await alertOps('blob-cleanup', 'cleanup-failed', e && e.message);
        return res.status(500).json({ error: 'cleanup_failed' });
    }
};
