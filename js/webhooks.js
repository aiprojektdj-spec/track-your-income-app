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

    // Nur Make.com. Die CSP von app.html (vercel.json, connect-src) laesst als
    // fremdes Ziel ausschliesslich https://*.make.com zu — jede andere URL blockt
    // der Browser, fire() schluckt den Fehler, und der Nutzer merkt nie, dass seine
    // Automatisierung nicht laeuft. Wer die CSP erweitert, erweitert auch hier.
    erlaubt(url) {
        try {
            const u = new URL(url);
            return u.protocol === 'https:' && u.hostname.endsWith('.make.com')
                && !u.username && !u.password;
        } catch (e) {
            return false;
        }
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
            if (!url || !this.erlaubt(url)) return;
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
        if (!this.erlaubt(url)) return { ok: false, error: 'not_allowed' };
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
