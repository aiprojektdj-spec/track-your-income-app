# `ALERT_WEBHOOK_URL` einrichten — Schritt für Schritt

**Stand: 2026-09-03**, Auslöser-Tabelle und Gegenprobe gegen den Code geprüft. Gehört zu
`api/_alert.js`, offener Punkt aus [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md)
(„Rate-Limits fallen bei Redis-Ausfall offen").

**Worum es geht:** Die Rate-Limits und der Blob-Byte-Deckel sind bewusst **fail-open** — bei
einem Redis-Ausfall fallen die Deckel weg, statt zahlende Kunden auszusperren. Das ist die
richtige Entscheidung, hat aber eine Kehrseite: **du merkst es nicht.** Bisher steht der Vorfall
nur als `console.error` im Vercel-Log, das niemand im Alltag liest.

**Eine Ausnahme, die den Namen „fail-open" nicht verdient:** Fehlt die Redis-Env ganz, antwortet
`api/sync.js` mit `500 server_misconfigured` — der Cloud-Sync ist dann für alle Kunden aus, nicht
bloß ungedeckelt. Dieser eine Alarm (`sync` / `redis-env-missing`) meldet also einen echten
Ausfall, kein stilles Risiko. Details in der Tabelle unten.

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

**15 Aufrufstellen in fünf Endpunkten, 13 verschiedene `source:event`-Paare** (entprellt wird
je Paar). Gegen den Code geprüft am 2026-09-04:

| `source` | `event` | Bedeutung |
|---|---|---|
| `sync` | `redis-env-missing` | **Kein offener Deckel, sondern Totalausfall:** `api/sync.js` antwortet dann `500 server_misconfigured`, der Cloud-Sync ist für alle Kunden aus. Dringlichster Alarm der Liste. |
| `sync` | `ip-rate-limit-open` | IP-Zähler vor dem Whop-Call nicht erreichbar — Limit greift nicht |
| `sync` | `rate-limit-open` | Nutzer-Zähler nicht erreichbar — Limit greift nicht |
| `blob-upload` | `redis-env-missing` | Redis-Env fehlt — Byte-Budget **und** Rate-Limit komplett aus, Upload läuft aber weiter |
| `blob-upload` | `byte-budget-open` | Byte-Budget nicht prüfbar — Upload-Kosten ungedeckelt |
| `blob-upload` | `rate-limit-open` | Nutzer-Zähler nicht erreichbar |
| `whop-access` | `ip-rate-limit-open` | Zugangs-Check ohne IP-Deckel (Redis-Fehler) |
| `whop-access` | `rate-limit-inaktiv` | Zugangs-Check ohne IP-Deckel (Redis-Env fehlt) |
| `whop-access` | `grace-token-aus` | `WHOP_GRACE_PRIVATE_KEY` fehlt oder ist ungültig — **kein Kunde** bekommt mehr ein Offline-Grace-Token. Fällt sonst erst auf, wenn jemand offline aus dem Gate fliegt. |
| `whop-token` | `rate-limit-open` | Login-Endpunkt ohne IP-Deckel (Redis-Fehler) |
| `whop-token` | `rate-limit-inaktiv` | Login-Endpunkt ohne IP-Deckel (Redis-Env fehlt) |
| `blob-cleanup` | `cron-secret-missing` | `CRON_SECRET` nicht gesetzt — der tägliche Aufräum-Job läuft ins Leere |
| `blob-cleanup` | `cleanup-failed` | Aufräum-Job abgebrochen — verwaiste Chunks bleiben liegen, Blob-Speicher wächst |

Zwei Muster, die für Make-Filter wichtig sind: `whop-access` sendet **nie** `rate-limit-open`,
sondern `ip-rate-limit-open`. Und `…-inaktiv` heißt „Env fehlt", `…-open` heißt „Redis antwortet
nicht" — ein Filter auf `rate-limit-open` allein verpasst die Hälfte. Willst du nur eine Regel:
filtere gar nicht, es sind ohnehin höchstens ein paar Meldungen pro Ausfall.

**Drei Alarme melden keinen offenen Deckel, sondern fehlende Konfiguration** und treffen alle
Kunden gleichzeitig: `sync`/`redis-env-missing` (Sync komplett aus), `whop-access`/
`grace-token-aus` (kein Offline-Grace) und `blob-cleanup`/`cron-secret-missing`. Kommt einer davon
direkt nach einem Deployment, ist fast immer eine Environment-Variable nicht gesetzt oder nur für
das falsche Environment hinterlegt.

**Was der Alarm bewusst nicht kann:** Er meldet fehlgeschlagene Läufe, aber keine
*ausbleibenden*. Wird der Cron in Vercel abgeschaltet oder läuft er nie an, bleibt es still — ein
Dead-Man-Switch bräuchte gespeicherten Zustand, und der läge in Redis, also genau in dem System,
dessen Ausfall hier gemeldet werden soll. Wenn du Gewissheit willst, schau einmal im Monat in
Vercel → Cron Jobs auf den letzten Lauf.

## Zwei Eigenschaften, die dich vor Ärger bewahren

- **Entprellt: höchstens eine Meldung je Ereignis und 5 Minuten** — pro Instanz, im Speicher, nicht
  in Redis. Absicht: Der Alarm meldet ja gerade, dass Redis weg ist. Ein Ausfall erzeugt also
  keine Mailflut, aber bei mehreren Serverless-Instanzen können ein paar Meldungen parallel kommen.
- **Der Webhook kann keinen Request kippen:** 2 Sekunden Timeout, Fehler werden verschluckt, das
  Log bleibt in jedem Fall erhalten.

## Gegenprobe nach dem Deployment

Der ehrlichste Test wäre ein echter Redis-Ausfall — den willst du nicht herbeiführen.

**Eine Variable namens `REDIS_URL` gibt es nicht** — eine frühere Fassung dieser Anleitung nannte
sie, wer sie verstellt, ändert gar nichts und hält den Alarm fälschlich für kaputt. Alle vier
Endpunkte lesen:

```
UPSTASH_REDIS_REST_URL   || KV_REST_API_URL
UPSTASH_REDIS_REST_TOKEN || KV_REST_API_TOKEN
```

**Das `||` ist die Falle:** Verstellst du nur `UPSTASH_REDIS_REST_URL`, springt still
`KV_REST_API_URL` ein und alles läuft normal weiter. Sind bei dir beide Paare gesetzt, musst du
beide anfassen.

**So testest du es — in Preview, nie in Production:**

1. In Vercel → Settings → Environment Variables, **Environment „Preview"**:
   `UPSTASH_REDIS_REST_URL` (und, falls vorhanden, `KV_REST_API_URL`) auf einen Unsinnswert wie
   `https://example.invalid` setzen. Notiere dir vorher die echten Werte.
2. Preview neu deployen — Env-Variablen greifen erst mit dem nächsten Deployment.
3. Einen POST auf `/api/sync` der **Preview-URL** schicken. Ein Token braucht es nicht: der
   Redis-Check in `api/sync.js` läuft noch vor der Token-Prüfung.

   ```bash
   curl -s -X POST -H "Content-Type: application/json" -d '{}' https://DEINE-PREVIEW.vercel.app/api/sync
   ```

4. Erwartete Antwort: `{"error":"server_misconfigured"}`. Erwartete Meldung:
   `[Stackr] sync — redis-env-missing`, mit `env: preview`.
5. **Werte zurücksetzen und erneut deployen.** Ohne den zweiten Deploy bleibt die Preview kaputt.

Was der Testwert auslöst, hängt davon ab, wie du ihn setzt: **leer/gelöscht** → `redis-env-missing`
(der Code sieht gar keine Env), **falsche URL** → `rate-limit-open` bzw. `byte-budget-open` (der
fetch schlägt fehl). Beides beweist die Kette, `redis-env-missing` ist der schnellere Weg.

Kommt binnen ~1 Minute keine Meldung, prüfe der Reihe nach: Szenario in Make aktiv
(„Scheduling" ON), `ALERT_WEBHOOK_URL` im **Preview**-Environment gesetzt, nach dem Setzen
neu deployt. Achtung Entprellung: derselbe Alarm kommt frühestens nach 5 Minuten erneut — ein
zweiter Testaufruf direkt danach bleibt absichtlich still.

## Was ohne Vercel schon bewiesen ist

`test/test-alert-ops.js` prüft die Mechanik lokal gegen eine fetch-Attrappe: kein Netzverkehr ohne
`ALERT_WEBHOOK_URL`, Entprellung je Ereignis, Nutzlast-Felder, Timeout-/Fehlerfestigkeit,
Map-Deckel. 12/12 grün am 2026-09-02.

```bash
node test/test-alert-ops.js
```

Was dieser Test **nicht** abdeckt und nur die Gegenprobe oben zeigt: dass Make die Nutzlast
annimmt, und dass `ALERT_WEBHOOK_URL` in Vercel tatsächlich ankommt.
