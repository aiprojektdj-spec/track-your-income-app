// Stackr — Betriebs-Alarm für stillschweigende Degradierung
// =============================================================================
// Hintergrund: Alle Rate-Limits und der Blob-Byte-Deckel sind bewusst FAIL-OPEN
// (plan/02-ENTSCHEIDUNGEN.md — ein zahlender Kunde darf nicht an einem
// Redis-Ausfall scheitern). Die Kehrseite: bei einem Redis-Ausfall sind
// sämtliche Deckel weg, und bis heute stand das nur als console.error im Log.
// Genau dieser Punkt ist die einzige Empfehlung, die dort offen blieb.
//
// Diese Datei ändert das Fail-open-Verhalten NICHT. Sie schickt zusätzlich eine
// Meldung an einen Webhook, damit ein offener Deckel nicht unbemerkt bleibt.
//
// Env: ALERT_WEBHOOK_URL   (optional — ist sie leer, verhält sich alles exakt
//                           wie vorher: nur console.error, kein Netzverkehr)
//
// Der Dateiname beginnt mit "_", damit Vercel sie NICHT als Route ausliefert.
//
// Nutzlast passt ohne Umbau auf einen Slack-Incoming-Webhook (`text`) und auf
// Make.com (die strukturierten Felder) — Make.com ist ohnehin schon im Einsatz.
//
// Keine neue Abhängigkeit: natives fetch, wie überall sonst in api/.
// =============================================================================

var ALERT_URL = process.env.ALERT_WEBHOOK_URL || '';

// Entprellung im Modul-Scope, NICHT in Redis — der Alarm meldet ja gerade, dass
// Redis nicht erreichbar ist. Pro Instanz und Schlüssel höchstens alle 5 Minuten
// eine Meldung: ein Redis-Ausfall erzeugt sonst eine Meldung pro Request.
var DEDUPE_MS  = 5 * 60 * 1000;
var MAX_KEYS   = 50;               // Deckel gegen unbegrenztes Wachstum der Map
var _lastSent  = new Map();

function _shouldSend(key, now) {
    var prev = _lastSent.get(key);
    if (prev && (now - prev) < DEDUPE_MS) return false;
    if (_lastSent.size >= MAX_KEYS && !_lastSent.has(key)) {
        // Ältesten Eintrag verdrängen (Map hält Einfügereihenfolge)
        _lastSent.delete(_lastSent.keys().next().value);
    }
    _lastSent.set(key, now);
    return true;
}

// source  z. B. 'sync'          — welcher Endpunkt
// event   z. B. 'rate-limit-open' — stabiler Schlüssel, danach wird entprellt
// detail  Fehlertext oder Zusatzinfo
//
// Wird bewusst awaited: die aufrufenden Stellen sind Fehlerpfade, die danach
// ohnehin weiterlaufen. Ein nicht-awaitetes Promise würde in Serverless
// eingefroren, sobald die Antwort raus ist — die Meldung käme nie an.
// Wirft nie: ein kaputter Webhook darf keinen Request kippen.
async function alertOps(source, event, detail) {
    var now = Date.now();
    var key = source + ':' + event;
    if (!_shouldSend(key, now)) return;

    var text = '[Stackr] ' + source + ' — ' + event +
               (detail ? ': ' + String(detail).slice(0, 500) : '');
    console.error(text);                       // Log bleibt in jedem Fall erhalten

    if (!ALERT_URL) return;
    try {
        await fetch(ALERT_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                text:   text,                  // Slack-kompatibel
                source: source,
                event:  event,
                detail: detail ? String(detail).slice(0, 500) : '',
                env:    process.env.VERCEL_ENV || 'unknown',
                ts:     new Date(now).toISOString()
            }),
            signal: AbortSignal.timeout(2000)  // kurz: der Fehlerpfad soll nicht hängen
        });
    } catch (e) {
        // Bewusst still: der Text steht oben schon im Log, und ein Webhook-Fehler
        // hier würde den eigentlichen Request beschädigen.
    }
}

module.exports = { alertOps: alertOps };
