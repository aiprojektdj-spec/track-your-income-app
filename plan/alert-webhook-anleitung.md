# `ALERT_WEBHOOK_URL` einrichten — Schritt für Schritt

**Stand: 2026-09-07**, Auslöser-Tabelle und Gegenprobe gegen den Code geprüft. Gehört zu
`api/_alert.js`, offener Punkt aus [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md)
(„Rate-Limits fallen bei Redis-Ausfall offen").

**Worum es geht:** Die Rate-Limits und der Blob-Byte-Deckel sind bewusst **fail-open** — bei
einem Redis-Ausfall fallen die Deckel weg, statt zahlende Kunden auszusperren. Das ist die
richtige Entscheidung, hat aber eine Kehrseite: **du merkst es nicht.** Bisher steht der Vorfall
nur als `console.error` im Vercel-Log, das niemand im Alltag liest.

**Zwei Ausnahmen, die den Namen „fail-open" nicht verdienen:** Fehlt die Redis-Env ganz, antwortet
`api/sync.js` mit `500 server_misconfigured` — der Cloud-Sync ist dann für alle Kunden aus, nicht
bloß ungedeckelt. Genauso `api/whop-refresh.js`: ohne Redis `503 refresh_unavailable`, womit die
Token-Erneuerung tot ist und jeder Kunde nach einer Stunde aus dem Gate fällt. Diese beiden
Alarme (`sync`/`redis-env-missing`, `whop-refresh`/`redis-fehlt`) melden einen echten Ausfall,
kein stilles Risiko. Details in der Tabelle unten.

**Seit 2026-09-10 bist du ohne Webhook nicht mehr blind, nur langsamer:** derselbe Alarm landet
zusätzlich als JSON-Objekt im Blob-Speicher, den du ohnehin hast — siehe
[Ohne Make.com: der Blob-Alarmspeicher](#ohne-makecom-der-blob-alarmspeicher) weiter unten.
Der Webhook bleibt trotzdem der Weg, der dich *sofort* erreicht; der Blob-Speicher sagt dir erst,
wenn du hinschaust.

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

**19 Aufrufstellen in sechs Endpunkten, 17 verschiedene `source:event`-Paare** (entprellt wird
je Paar). Gegen den Code geprüft am 2026-09-07:

| `source` | `event` | Bedeutung |
|---|---|---|
| `sync` | `redis-env-missing` | **Kein offener Deckel, sondern Totalausfall:** `api/sync.js` antwortet dann `500 server_misconfigured`, der Cloud-Sync ist für alle Kunden aus. Einer der zwei Totalausfälle in dieser Liste. |
| `sync` | `ip-rate-limit-open` | IP-Zähler vor dem Whop-Call nicht erreichbar — Limit greift nicht |
| `sync` | `rate-limit-open` | Nutzer-Zähler nicht erreichbar — Limit greift nicht |
| `blob-upload` | `redis-env-missing` | Redis-Env fehlt — Byte-Budget **und** Rate-Limit komplett aus, Upload läuft aber weiter |
| `blob-upload` | `byte-budget-open` | Byte-Budget nicht prüfbar — Upload-Kosten ungedeckelt |
| `blob-upload` | `rate-limit-open` | Nutzer-Zähler nicht erreichbar |
| `whop-access` | `ip-rate-limit-open` | Zugangs-Check ohne IP-Deckel (Redis-Fehler) |
| `whop-access` | `rate-limit-inaktiv` | Zugangs-Check ohne IP-Deckel (Redis-Env fehlt) |
| `whop-access` | `grace-token-aus` | `WHOP_GRACE_PRIVATE_KEY` fehlt oder ist ungültig — **kein Kunde** bekommt mehr ein Offline-Grace-Token. Fällt sonst erst auf, wenn jemand offline aus dem Gate fliegt. |
| `whop-refresh` | `redis-fehlt` | **Kein offener Deckel, sondern Totalausfall:** `api/whop-refresh.js` antwortet `503 refresh_unavailable`, die Token-Erneuerung ist aus — **jeder** Kunde fliegt nach einer Stunde raus. Landet im Support sonst als „ich muss mich ständig neu anmelden". |
| `whop-refresh` | `rate-limit-open` | Erneuerungs-Endpunkt ohne IP-Deckel (Redis-Fehler) |
| `whop-token` | `rate-limit-open` | Login-Endpunkt ohne IP-Deckel (Redis-Fehler) |
| `whop-token` | `rate-limit-inaktiv` | Login-Endpunkt ohne IP-Deckel (Redis-Env fehlt) |
| `whop-token` | `session-nicht-gespeichert` | Login gelang, aber der Refresh-Token ließ sich nicht ablegen — **dieser eine Kunde** fliegt nach einer Stunde raus |
| `whop-token` | `kein-refresh-token` | Whop lieferte keinen `refresh_token` — Erneuerung für diese Sitzung unmöglich |
| `blob-cleanup` | `cron-secret-missing` | `CRON_SECRET` nicht gesetzt — der tägliche Aufräum-Job läuft ins Leere |
| `blob-cleanup` | `cleanup-failed` | Aufräum-Job abgebrochen — verwaiste Chunks bleiben liegen, Blob-Speicher wächst |

Drei Muster, die für Make-Filter wichtig sind: `whop-access` sendet **nie** `rate-limit-open`,
sondern `ip-rate-limit-open`. `…-inaktiv` heißt „Env fehlt", `…-open` heißt „Redis antwortet
nicht" — ein Filter auf `rate-limit-open` allein verpasst die Hälfte. Und dieselbe Ursache hat
drei Namen: `redis-env-missing` (sync, blob-upload), `rate-limit-inaktiv` (whop-access,
whop-token) und `redis-fehlt` (whop-refresh). Willst du nur eine Regel:
filtere gar nicht, es sind ohnehin höchstens ein paar Meldungen pro Ausfall.

**Vier Alarme melden keinen offenen Deckel, sondern fehlende Konfiguration** und treffen alle
Kunden gleichzeitig: `sync`/`redis-env-missing` (Sync komplett aus), `whop-refresh`/`redis-fehlt`
(Token-Erneuerung aus), `whop-access`/`grace-token-aus` (kein Offline-Grace) und `blob-cleanup`/
`cron-secret-missing`. Kommt einer davon direkt nach einem Deployment, ist fast immer eine
Environment-Variable nicht gesetzt oder nur für das falsche Environment hinterlegt.

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
sie, wer sie verstellt, ändert gar nichts und hält den Alarm fälschlich für kaputt. Alle fünf
Redis-Endpunkte lesen (`blob-cleanup` kommt ohne Redis aus):

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

## Ohne Make.com: der Blob-Alarmspeicher

**Stand 2026-09-10.** `api/_alert.js` hat zwei Ziele, unabhängig voneinander:

| Ziel | Env | Wann es greift | Was du davon hast |
|---|---|---|---|
| Webhook | `ALERT_WEBHOOK_URL` | sofort | Mail/Slack/Telegram, du erfährst es ohne hinzusehen |
| Blob-Objekt | `BLOB_READ_WRITE_TOKEN` | sofort | nachträglich lesbar, 30 Tage Historie — aber nur, wenn du nachsiehst |

Der Token ist in Produktion durch die Blob-Integration **ohnehin gesetzt**. Das Ziel ist also
aktiv, ohne dass du etwas tust. Nur wenn *beide* fehlen, bleibt es wie früher beim reinen
`console.error`.

**Warum ausgerechnet Blob:** Es ist ein anderes System als Redis. Genau der Ausfall, der hier
gemeldet wird, betrifft es nicht. In Redis zu schreiben wäre zirkulär gewesen — dasselbe
Argument, an dem der Dead-Man-Switch scheitert.

**Was es rettet:** Auf dem Hobby-Plan reichen die Vercel-Logs 30–60 Minuten zurück. Ein
Cron-Fehler um 04:00 UTC ist dort morgens um neun nicht mehr auffindbar. Im Blob-Speicher schon.

### Nachsehen, was passiert ist

Ein Einzeiler, kein Login nötig — liest den Token aus `.env.local`:

```bash
node -e "const t=require('fs').readFileSync('.env.local','utf8').match(/^BLOB_READ_WRITE_TOKEN=\"?([^\"\r\n]+)/m)[1];fetch('https://blob.vercel-storage.com/?prefix=stackr/alerts/&limit=1000',{headers:{authorization:'Bearer '+t}}).then(r=>r.json()).then(async j=>{const b=(j.blobs||[]).sort((x,y)=>new Date(y.uploadedAt)-new Date(x.uploadedAt));console.log(b.length+' Alarme');for(const x of b.slice(0,20)){const p=await(await fetch(x.url)).json();console.log(p.ts+'  '+p.env+'  '+p.source+' — '+p.event+(p.detail?': '+p.detail:''))}})"
```

**Leere Liste heißt: nichts gemeldet.** Das ist der Normalfall und der gute Fall — anders als
beim Log, wo Leere auch „ist rausgerollt“ bedeuten kann.

### Aufbau und Grenzen

- **Pfad:** `stackr/alerts/JJJJ-MM-TT/<source>_<event>_HH-MM-SS-mmmZ<zufallssuffix>`, UTC.
  Der Tagesordner passt zum `ts`-Feld derselben Nutzlast.
- **Inhalt:** exakt dieselbe Nutzlast wie beim Webhook, als eingerücktes JSON.
- **Aufräumen:** `api/blob-cleanup.js` löscht täglich um 04:00 UTC alles unter `stackr/alerts/`,
  das älter als **30 Tage** ist — zweiter Durchgang neben `stackr/tmp/`. Die Antwort des
  Cron-Jobs nennt beide Zahlen: `{"ok":true,"deleted":<tmp>,"alertsDeleted":<alarme>}`.
- **Entprellung gilt genauso:** höchstens ein Objekt je `source:event` und 5 Minuten und Instanz.
  Ein Redis-Ausfall erzeugt also keine Objektflut.
- **Kein Request kippt daran:** 2 Sekunden Timeout, Fehler werden geschluckt, und ein
  fehlgeschlagenes `put` löst ausdrücklich **keinen** neuen Alarm aus — das wäre eine Schleife.
- **Restgrenze:** Blob kennt nur `access: 'public'`. Die URL trägt einen Zufallssuffix und ist
  ohne Token nicht auffindbar — dieselbe dokumentierte Restgrenze wie bei den Anhängen
  ([`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md)). Kundendaten stehen nicht drin, nur
  Betriebsmeldungen; `detail` ist auf 500 Zeichen gekürzt.

**Der Job, den dieses Ziel NICHT erledigt:** Es weckt dich nicht. Ein Totalausfall wie
`whop-refresh`/`redis-fehlt` wirft jeden Kunden nach einer Stunde aus dem Gate — das willst du
per Mail erfahren, nicht beim nächsten Nachsehen. Der Webhook oben bleibt also fällig.

## Was ohne Vercel schon bewiesen ist

`test/test-alert-ops.js` prüft die Mechanik lokal gegen Attrappen für `fetch` und für
`@vercel/blob`: kein Netzverkehr und kein `put`, wenn beide Ziele fehlen; Entprellung je
Ereignis für beide Ziele; Nutzlast-Felder; Timeout-/Fehlerfestigkeit; Map-Deckel; Blob-Pfad,
-Optionen und -Inhalt; entschärfte Pfadsegmente. **23/23 grün am 2026-09-10.**

```bash
node test/test-alert-ops.js
```

Was dieser Test **nicht** abdeckt und nur die Gegenprobe oben zeigt: dass Make die Nutzlast
annimmt, und dass `ALERT_WEBHOOK_URL` in Vercel tatsächlich ankommt.

Der **Blob-Weg dagegen ist echt durchgestochen**, nicht nur gegen eine Attrappe: am
2026-09-10 lokal mit dem produktiven `BLOB_READ_WRITE_TOKEN` ein Alarm geschrieben, das
Objekt unter `stackr/alerts/2026-09-10/` wiedergefunden, den Inhalt zurückgelesen und das
Testobjekt wieder gelöscht. Vercel nimmt die `put`-Optionen also an.
