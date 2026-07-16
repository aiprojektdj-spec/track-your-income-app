// Webhooks — feuert Events direkt aus dem Browser an vom User hinterlegte
// Make.com-Custom-Webhook-URLs. KEIN Server-Endpoint: Stackr ist local-first
// und Cloud-Sync speichert nur Chiffrat (api/sync.js) — der Server kann die
// Event-Art serverseitig nicht kennen. Die URL selbst ist das Secret
// (Make.com generiert lange Zufalls-URLs), zusätzliches HMAC ist für v1
// nicht nötig, da der Client den Klartext ohnehin nur an die vom User selbst
// eingetragene URL sendet.
const Webhooks = {
    EVENTS: {
        einnahme:  'Neue Einnahme erfasst',
        rechnung:  'Neue Rechnung erstellt',
        eigenbeleg: 'Neuer Eigenbeleg erfasst'
    },

    _urls() {
        const s = Store.getSettings();
        return s.webhookUrls || {};
    },

    // fire-and-forget: darf den eigentlichen Speichervorgang nie blockieren
    // oder durch einen Fehler unterbrechen (Timeout, kein Retry).
    fire(eventType, payload) {
        try {
            const url = this._urls()[eventType];
            if (!url) return;
            const body = JSON.stringify({ event: eventType, ts: new Date().toISOString(), data: payload });
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                signal: AbortSignal.timeout(8000)
            }).catch(() => {}); // Ziel nicht erreichbar → ignorieren, kein Retry-Sturm
        } catch (e) {
            // nie den Aufrufer stören
        }
    },

    async test(eventType, urlOverride) {
        const url = urlOverride || this._urls()[eventType];
        if (!url) return { ok: false, error: 'no_url' };
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: eventType, ts: new Date().toISOString(), data: { test: true } }),
                signal: AbortSignal.timeout(8000)
            });
            return { ok: res.ok, status: res.status };
        } catch (e) {
            return { ok: false, error: e.message || 'network_error' };
        }
    }
};
