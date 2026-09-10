# Stand: Alarm und Vercel-Konfiguration

**Stand: 2026-09-10** (Erstfassung 2026-09-09). Übergabe für den Komplex „stille Ausfälle
sichtbar machen". Sagt, was belegt ist, was offen ist und wer es machen muss. Die beiden
Anleitungen daneben sagen, *wie*:

- [`alert-webhook-anleitung.md`](alert-webhook-anleitung.md) — `ALERT_WEBHOOK_URL` einrichten,
  Make.com-Szenario, alle 17 Alarm-Auslöser
- [`vercel-einrichtung.md`](vercel-einrichtung.md) — alle 20 Umgebungsvariablen, was ohne sie
  passiert, Gegenproben ohne Login

---

## Die Lage in drei Sätzen

Die Rate-Limits und Byte-Deckel sind bewusst **fail-open**: fällt Redis aus, fallen die Deckel weg,
statt zahlende Kunden auszusperren. Der Preis dieser Entscheidung ist, dass man den Ausfall nicht
merkt — genau dafür wurde der Alarm in `api/_alert.js` gebaut. **Seit 2026-09-10 hat der Alarm
ein Ziel, das ohne Einrichtung funktioniert:** jede Meldung landet zusätzlich unter
`stackr/alerts/` im Blob-Speicher. Was weiter fehlt, ist der Weg, der dich *von selbst* erreicht —
`ALERT_WEBHOOK_URL` ist in Vercel nach wie vor nicht gesetzt.

---

## Was belegt ist

| Was | Wie belegt |
|---|---|
| Alarm-Mechanik funktioniert | `node test/test-alert-ops.js` → **23/23** am 2026-09-10: kein Netzverkehr **und kein Blob-`put`**, wenn beide Ziele fehlen; Entprellung je Ereignis für beide Ziele; Nutzlast-Felder; Timeout- und Fehlerfestigkeit; Map-Deckel; Blob-Pfad, -Optionen, -Inhalt; entschärfte Pfadsegmente |
| Blob-Ziel schreibt wirklich | Nicht nur gegen die Attrappe: am 2026-09-10 lokal mit dem produktiven `BLOB_READ_WRITE_TOKEN` ein Alarm geschrieben, unter `stackr/alerts/2026-09-10/` wiedergefunden, Inhalt zurückgelesen, Testobjekt gelöscht |
| 17 Auslöser in sechs Endpunkten | `grep -rn "alertOps('" api/*.js` → **19 Stellen, 17 Paare** am 2026-09-10 nachgezählt — Tabelle vollständig in der Alarm-Anleitung |
| Alle Pflichtvariablen sind gesetzt | Dashboard + Endpunkt-Gegenproben, Tabelle in der Vercel-Anleitung |
| Grace-Schlüssel ist der richtige | Grace-Token aus angemeldetem Browser verifiziert gegen den eingebauten Public Key |
| Cron läuft und räumt auf | am 2026-09-10 nachgeprüft: unter `stackr/tmp/` ein Objekt mit 23,0 h, nichts älter als 24 h |
| Gesamte Suite trägt den Umbau | **52 Node-Harnesses, 0 Fehlschläge** am 2026-09-10 |

## Was offen ist

**1. `ALERT_WEBHOOK_URL` fehlt — die verbliebene Lücke, seit 2026-09-10 aber eine kleinere.**

Der Satz, der hier vorher stand — *stille Ausfälle sind auf keinem Weg sichtbar* — gilt so nicht
mehr. `api/_alert.js` hat jetzt zwei Ziele:

| Ziel | Env | Zustand | Was es leistet |
|---|---|---|---|
| Blob-Objekt unter `stackr/alerts/` | `BLOB_READ_WRITE_TOKEN` | **aktiv**, war ohnehin gesetzt | 30 Tage Historie, nachträglich lesbar — aber nur, wenn jemand nachsieht |
| Webhook | `ALERT_WEBHOOK_URL` | **fehlt** | erreicht dich von selbst, ohne hinzusehen |

Bewusst Blob und **nicht Redis**: Blob ist ein anderes System und überlebt genau den Ausfall, der
gemeldet werden soll. Damit ist auch die Hobby-Log-Grenze entschärft — ein Cron-Fehler um
04:00 UTC ist morgens um neun im Log weg, im Blob-Speicher nicht.

> **Was bleibt: niemand wird geweckt.** Ein Totalausfall wie `whop-refresh`/`redis-fehlt` wirft
> jeden Kunden nach einer Stunde aus dem Gate. Das steht dann sauber belegt im Blob — aber du
> erfährst es trotzdem durch ein Support-Ticket, wenn du nicht zufällig nachsiehst.

Diesen Rest kann **keine Session lösen** — es sind zwei Schritte in fremden Oberflächen, beide
beim Betreiber:

1. Make.com-Szenario anlegen (~10 Min), Webhook-URL kopieren
2. `ALERT_WEBHOOK_URL` in Vercel eintragen, **neu deployen** (ohne Redeploy greift nichts)

Danach übernimmt die Gegenprobe aus der Alarm-Anleitung — die kann eine Session fahren, sobald die
Preview-URL steht.

**Bis dahin die Ersatzhandlung, ohne Login und aus dem Repo heraus:** der Lese-Einzeiler auf
`prefix=stackr/alerts/` in der
[Alarm-Anleitung](alert-webhook-anleitung.md#ohne-makecom-der-blob-alarmspeicher). Leere Liste
heißt: nichts gemeldet — Normalfall und guter Fall. Anders als beim Log, wo Leere auch
„ist rausgerollt" bedeuten kann.

**2. Kein Offline-Grace auf Preview.** `WHOP_GRACE_PRIVATE_KEY` ist nur für Production gesetzt.
Für den Alltag richtig; nur beim Testen gegen ein Preview-Deployment sollte man wissen, dass
Offline-Grace dort nicht existiert und ein Ausfall dieses Wegs kein echter Befund ist.

**3. Der Dead-Man-Switch fehlt bewusst — die Lücke ist jetzt aber schmaler.** Ein echter Wächter
bräuchte gespeicherten Zustand, und der läge in Redis — also genau in dem System, dessen Ausfall
er melden soll. Das Argument steht unverändert. Was sich geändert hat: ein Cron-Lauf, der
**fehlschlägt**, hinterlässt seit 2026-09-10 30 Tage lang eine Spur unter `stackr/alerts/`, auch
wenn das Hobby-Log längst weg ist. Stumm bleibt allein der Lauf, der **gar nicht erst startet** —
dafür weiter die Gegenprobe aus der Vercel-Anleitung: liegt unter `stackr/tmp/` etwas deutlich
älter als 24 h, hat der Job nicht aufgeräumt.

---

## Zwei Fallen, die schon Zeit gekostet haben

**Dieselbe Ursache hat drei Namen.** „Redis-Env fehlt" heißt je nach Endpunkt
`redis-env-missing` (sync, blob-upload), `rate-limit-inaktiv` (whop-access, whop-token) oder
`redis-fehlt` (whop-refresh). Wer in Make auf einen davon filtert, fängt ein Drittel. Empfehlung
steht in der Anleitung: gar nicht filtern, es sind höchstens ein paar Meldungen pro Ausfall.

**Das Projekt läuft auf `KV_REST_API_*`, nicht auf `UPSTASH_REDIS_REST_*`.** Der Code liest
`UPSTASH_… || KV_…` — die Upstash-Namen haben Vorrang. Wer eines dieser Paare neu anlegt,
überschreibt damit stillschweigend die laufende Verbindung. Eine Variable `REDIS_URL` existiert,
wird aber von keinem Endpunkt gelesen.

---

## Wie es hierher kam

| Commit | Was |
|---|---|
| `5bb6400` | Alarm-Anleitung: `whop-refresh` fehlte komplett in der Auslöser-Tabelle (13 Paare dokumentiert, 17 im Code) |
| `cf49f80` | `vercel-einrichtung.md` angelegt: 20 Variablen gegen `api/` geprüft |
| `e5b2db5` | dieselbe Datei gegen das echte Dashboard geprüft, drei Korrekturen |
| 2026-09-10 | zweites Alarm-Ziel gebaut: `stackr/alerts/` im Blob, Aufräumen im Cron, Tests 12→23 |

Der erste Commit ist der Grund, warum es die Drift-Liste daneben gibt
([`doku-drift-2026-09-09.md`](doku-drift-2026-09-09.md)): eine Tabelle, die vier Alarme nicht
kannte, war kein Einzelfall.
