// Stackr — Betriebs-Alarm für stillschweigende Degradierung
// =============================================================================
// Hintergrund: Alle Rate-Limits und der Blob-Byte-Deckel sind bewusst FAIL-OPEN
// (plan/02-ENTSCHEIDUNGEN.md — ein zahlender Kunde darf nicht an einem
// Redis-Ausfall scheitern). Die Kehrseite: bei einem Redis-Ausfall sind
// sämtliche Deckel weg, und bis heute stand das nur als console.error im Log.
// Genau dieser Punkt ist die einzige Empfehlung, die dort offen blieb.
//
// Diese Datei ändert das Fail-open-Verhalten NICHT. Sie legt den Vorfall nur
// zusätzlich irgendwo ab, wo er auffallen kann.
//
// ZWEI ZIELE, unabhängig voneinander:
//
//   1. ALERT_WEBHOOK_URL      (optional) — sofortige Meldung, Slack/Make.com-kompatibel
//   2. BLOB_READ_WRITE_TOKEN  (in Produktion ohnehin gesetzt) — dieselbe Nutzlast
//                              zusätzlich als JSON-Objekt unter 'stackr/alerts/'
//
// Warum ein zweites Ziel: Der Webhook ist der schnelle Weg, braucht aber einen
// eingerichteten Dienst. Solange der fehlt, ist der einzige Beleg das Log — und
// auf dem Hobby-Plan reicht das nur 30–60 Minuten zurück, ein Cron-Lauf um
// 04:00 UTC ist dort nie mehr einsehbar. Der Blob-Speicher schließt genau diese
// Lücke: nachträglich lesbar, mit Historie, ohne fremden Dienst.
//
// Entscheidend ist, dass Blob ein ANDERES System ist als Redis. Genau der
// Ausfall, den hier gemeldet wird, betrifft ihn nicht. In Redis zu schreiben
// wäre sinnlos gewesen (vgl. den fehlenden Dead-Man-Switch, plan/
// stand-alarm-vercel-2026-09-09.md).
//
// Ist KEINES von beiden gesetzt, verhält sich alles exakt wie vorher: nur
// console.error, kein Netzverkehr.
//
// Der Dateiname beginnt mit "_", damit Vercel sie NICHT als Route ausliefert.
//
// Nutzlast passt ohne Umbau auf einen Slack-Incoming-Webhook (`text`) und auf
// Make.com (die strukturierten Felder) — Make.com ist ohnehin schon im Einsatz.
//
// Keine neue Abhängigkeit: natives fetch für Ziel 1, für Ziel 2 das bereits
// produktive '@vercel/blob' — die einzige Produktivabhängigkeit des Projekts.
// =============================================================================

var ALERT_URL  = process.env.ALERT_WEBHOOK_URL    || '';
var BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || '';

// Eigener Präfix. 'stackr/tmp/' und 'stackr/attachments/' bleiben unberührt;
// api/blob-cleanup.js räumt hier nach 30 Tagen auf.
var BLOB_PREFIX = 'stackr/alerts/';

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
// Wirft nie: weder ein kaputter Webhook noch ein streikender Blob-Store darf
// einen Request kippen — beide Ziele schlucken ihre Fehler selbst.
async function alertOps(source, event, detail) {
    var now = Date.now();
    var key = source + ':' + event;
    if (!_shouldSend(key, now)) return;

    var text = '[Stackr] ' + source + ' — ' + event +
               (detail ? ': ' + String(detail).slice(0, 500) : '');
    console.error(text);                       // Log bleibt in jedem Fall erhalten

    var payload = {
        text:   text,                          // Slack-kompatibel
        source: source,
        event:  event,
        detail: detail ? String(detail).slice(0, 500) : '',
        env:    process.env.VERCEL_ENV || 'unknown',
        ts:     new Date(now).toISOString()
    };

    // Beide Ziele parallel: keines darf auf das andere warten, keines darf werfen.
    // Promise.all ist hier gefahrlos, weil beide Helfer ihre Fehler selbst schlucken.
    await Promise.all([_sendWebhook(payload), _writeBlob(payload, now)]);
}

// Ziel 1 — Webhook. Wirft nie.
async function _sendWebhook(payload) {
    if (!ALERT_URL) return;
    try {
        await fetch(ALERT_URL, {
            method:  'POST',
            // charset MUSS mitgeschickt werden. Laut RFC 8259 ist application/json
            // immer UTF-8 und der Parameter ueberfluessig — Make.com haelt sich nicht
            // daran und dekodiert ohne ihn als Latin-1. Am 2026-09-13 gegen das echte
            // Szenario belegt: ohne charset kam '[Stackr] sync — ...' als '[Stackr]
            // sync � ...' an, mit charset sauber. Der Gedankenstrich steckt in JEDEM
            // text-Feld, und 'detail' traegt deutsche Fehlertexte.
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body:    JSON.stringify(payload),
            signal:  AbortSignal.timeout(2000) // kurz: der Fehlerpfad soll nicht hängen
        });
    } catch (e) {
        // Bewusst still: der Text steht oben schon im Log, und ein Webhook-Fehler
        // hier würde den eigentlichen Request beschädigen.
    }
}

// Ziel 2 — Blob-Objekt. Wirft nie.
async function _writeBlob(payload, now) {
    if (!BLOB_TOKEN) return;
    try {
        // Bewusst LAZY geladen: api/_alert.js hängt an sechs Endpunkten, von denen
        // drei (whop-token/-access/-refresh) sonst nichts mit Blob zu tun haben.
        // So kostet das Modul nur dort etwas, wo wirklich ein Alarm ausgelöst wird.
        var put = require('@vercel/blob').put;

        // UTC, absichtlich — anders als bei Datumsanzeigen für Nutzer (dort sv-SE
        // lokal, s. CLAUDE.md). Eine Serverless-Instanz hat keine sinnvolle Ortszeit,
        // und der Tagesordner muss zum 'ts'-Feld derselben Nutzlast passen.
        var iso  = new Date(now).toISOString();
        var name = BLOB_PREFIX + iso.slice(0, 10) + '/' +
                   _safe(payload.source) + '_' + _safe(payload.event) + '_' +
                   iso.slice(11).replace(/[:.]/g, '-');

        await put(name, JSON.stringify(payload, null, 2), {
            access:          'public',         // Blob kennt nichts anderes, s. 02-ENTSCHEIDUNGEN.md
            addRandomSuffix: true,             // → URL nicht erratbar, Kollisionen ausgeschlossen
            contentType:     'application/json',
            token:           BLOB_TOKEN,
            abortSignal:     AbortSignal.timeout(2000)
        });
    } catch (e) {
        // Bewusst still — und ausdrücklich OHNE erneutes alertOps(): das wäre eine
        // Schleife. Der Text steht oben im Log.
    }
}

// Pfadsegment entschärfen. source/event sind heute Code-Literale, aber ein
// Schrägstrich darin würde stillschweigend eine Unterebene aufmachen.
function _safe(s) {
    return String(s || 'unbekannt').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 60);
}

module.exports = { alertOps: alertOps };
