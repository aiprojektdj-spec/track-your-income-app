// Vercel Cron (vercel.json, täglich 04:00 UTC) — räumt verwaiste Chunk-Temp-Objekte auf.
// api/blob-upload.js löscht Chunks normalerweise direkt nach 'commit'; verwaist nur,
// wenn ein Client mitten im Multi-Chunk-Upload abbricht (Tab-Crash, Netzausfall).
// Betrifft NUR den 'stackr/tmp/'-Präfix — echte Anhänge (stackr/attachments/) bleiben unangetastet.
var { list, del } = require('@vercel/blob');

var MAX_AGE_MS = 24 * 60 * 60 * 1000; // alles älter als 24h unter tmp/ ist mit Sicherheit verwaist

module.exports = async function handler(req, res) {
    // Vercel Cron sendet 'Authorization: Bearer $CRON_SECRET', wenn CRON_SECRET gesetzt ist.
    // Ohne gesetztes Secret bleibt der Endpoint deaktiviert (kein offener Lösch-Endpoint).
    var secret = process.env.CRON_SECRET;
    if (!secret) return res.status(500).json({ error: 'cron_secret_not_configured' });
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
        console.error('[blob-cleanup] error:', e && e.message);
        return res.status(500).json({ error: 'cleanup_failed' });
    }
};
