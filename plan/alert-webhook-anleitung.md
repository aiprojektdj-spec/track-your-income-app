# `ALERT_WEBHOOK_URL` einrichten — Schritt für Schritt

**Stand: 2026-08-27.** Gehört zu `api/_alert.js`, offener Punkt aus
[`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md) („Rate-Limits fallen bei Redis-Ausfall offen").

**Worum es geht:** Alle Rate-Limits und der Blob-Byte-Deckel sind bewusst **fail-open** — bei
einem Redis-Ausfall fallen sämtliche Deckel weg, statt zahlende Kunden auszusperren. Das ist die
richtige Entscheidung, hat aber eine Kehrseite: **du merkst es nicht.** Bisher steht der Vorfall
nur als `console.error` im Vercel-Log, das niemand im Alltag liest.

Ist `ALERT_WEBHOOK_URL` nicht gesetzt, verhält sich alles exakt wie heute — kein Netzverkehr, nur
das Log. Es geht also nichts kaputt, wenn du das hier nie machst; du bleibst nur blind.

---

## 1. Make.com-Szenario anlegen (~10 Min)

1. Make.com → **Create a new scenario**.
2. Als erstes Modul **Webhooks → Custom webhook** wählen, dann **Add**.
3. Name vergeben, z. B. `stackr-ops-alert`. **Save.**
4. Make zeigt eine URL der Form `https://hook.eu2.make.com/…` — **kopieren.**
   Diese URL ist ein Zugangsweg in dein Szenario: nicht öffentlich teilen, nicht in den Chat.
5. Make wartet jetzt auf „Determine data structure". Lass das Fenster offen — Schritt 3 füllt es.

## 2. Zweites Modul: wie die Meldung dich erreicht

Häng an den Webhook an, was zu dir passt — **Email → Send me an email** ist der kürzeste Weg,
Telegram oder Slack gehen genauso.

Sinnvolle Felder aus der Nutzlast (siehe unten):

| Feld | Beispiel | Wofür |
|---|---|---|
| `text` | `[Stackr] sync — rate-limit-open: connect ETIMEDOUT` | fertige Betreffzeile |
| `source` | `sync` | welcher Endpunkt |
| `event` | `rate-limit-open` | was passiert ist |
| `env` | `production` | Produktion oder Preview |
| `ts` | `2026-08-27T14:02:11.402Z` | wann |

Betreff-Vorschlag: `Stackr-Alarm: {{source}} — {{event}}`.
**Aktiviere das Szenario** („Scheduling" auf ON), sonst wartet der Webhook nur auf Testdaten.

## 3. Struktur beibringen — mit einem echten Testaufruf

Make lernt die Feldnamen aus dem ersten Aufruf. Solange „Determine data structure" läuft, einmal
das hier senden (deine URL einsetzen):

```bash
curl -X POST -H "Content-Type: application/json" -d '{"text":"[Stackr] sync — rate-limit-open: Test","source":"sync","event":"rate-limit-open","detail":"Test","env":"production","ts":"2026-08-27T12:00:00.000Z"}' DEINE_WEBHOOK_URL
```

Danach kennt Make alle Felder und du kannst sie im Mail-Modul auswählen.

## 4. In Vercel eintragen

Projekt `track-your-income-app` → Settings → Environment Variables → **Add New**:

| Name | Wert | Environment |
|---|---|---|
| `ALERT_WEBHOOK_URL` | die Make-URL aus Schritt 1 | Production (Preview optional) |

**Danach neu deployen** — Umgebungsvariablen greifen erst mit dem nächsten Deployment.

---

## Was tatsächlich gesendet wird

`api/_alert.js` schickt ein flaches JSON. Der Aufbau passt ohne Umbau auch auf einen
Slack-Incoming-Webhook, weil `text` das Feld ist, das Slack erwartet:

```json
{
  "text":   "[Stackr] sync — rate-limit-open: connect ETIMEDOUT",
  "source": "sync",
  "event":  "rate-limit-open",
  "detail": "connect ETIMEDOUT 10.0.0.1:6379",
  "env":    "production",
  "ts":     "2026-08-27T14:02:11.402Z"
}
```

**Elf Auslöser in vier Endpunkten:**

| `source` | `event` | Bedeutung |
|---|---|---|
| `sync` | `redis-env-missing` | Redis-Zugangsdaten fehlen — **alle** Deckel sind weg |
| `sync` | `ip-rate-limit-open` / `rate-limit-open` | Zähler nicht erreichbar, Limit greift nicht |
| `blob-upload` | `byte-budget-open` | Byte-Budget nicht prüfbar — Upload-Kosten ungedeckelt |
| `blob-upload` | `rate-limit-open` / `redis-env-missing` | wie oben |
| `whop-access`, `whop-token` | `rate-limit-open` / `rate-limit-inaktiv` | Gate-Endpunkte ohne Limit |

## Zwei Eigenschaften, die dich vor Ärger bewahren

- **Entprellt: höchstens eine Meldung je Ereignis und 5 Minuten** — pro Instanz, im Speicher, nicht
  in Redis. Absicht: Der Alarm meldet ja gerade, dass Redis weg ist. Ein Ausfall erzeugt also
  keine Mailflut, aber bei mehreren Serverless-Instanzen können ein paar Meldungen parallel kommen.
- **Der Webhook kann keinen Request kippen:** 2 Sekunden Timeout, Fehler werden verschluckt, das
  Log bleibt in jedem Fall erhalten.

## Gegenprobe nach dem Deployment

Der ehrlichste Test wäre ein echter Redis-Ausfall — den willst du nicht herbeiführen. Praktikabel:
`REDIS_URL` **in Preview** (nicht Production) vorübergehend auf einen falschen Wert setzen, eine
Preview-Seite aufrufen, Meldung abwarten, Wert zurücksetzen. Kommt sie an, funktioniert die Kette.
