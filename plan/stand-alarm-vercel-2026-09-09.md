# Stand: Alarm und Vercel-Konfiguration

**Stand: 2026-09-15** (Erstfassung 2026-09-09). Übergabe für den Komplex „stille Ausfälle
sichtbar machen". Sagt, was belegt ist, was offen ist und wer es machen muss. Die Anleitungen
daneben sagen, *wie*:

- [`alert-webhook-anleitung.md`](alert-webhook-anleitung.md) — `ALERT_WEBHOOK_URL` einrichten,
  Make.com-Szenario, alle 18 Alarm-Auslöser, Selbsttest
- [`vercel-einrichtung.md`](vercel-einrichtung.md) — alle 20 Umgebungsvariablen, was ohne sie
  passiert, Gegenproben ohne Login
- [`offen-alert-webhook.md`](offen-alert-webhook.md) — das Protokoll der Einrichtung vom
  2026-09-13 mit den Belegen im Einzelnen

> **Diese Datei war vom 2026-09-13 bis 2026-09-15 die falscheste im Ordner.** Sie führte die
> Einrichtung weiter als offen, obwohl sie längst erledigt war — wer sie gelesen hätte, hätte ein
> zweites Make-Szenario gebaut. Das ist kein Schönheitsfehler: eine Übergabedatei, die den
> erledigten Teil als offen führt, richtet mehr Schaden an als gar keine. Nachgezogen am
> 2026-09-15, Zahlen dabei allesamt neu gemessen statt übernommen.

---

## Die Lage in drei Sätzen

Die Rate-Limits und Byte-Deckel sind bewusst **fail-open**: fällt Redis aus, fallen die Deckel weg,
statt zahlende Kunden auszusperren. Der Preis dieser Entscheidung ist, dass man den Ausfall nicht
merkt — genau dafür wurde der Alarm in `api/_alert.js` gebaut. **Er hat seit 2026-09-13 beide
Ziele:** jede Meldung geht an den Webhook (Make.com → Mail) *und* landet unter `stackr/alerts/`
im Blob-Speicher. Der Webhook erreicht dich von selbst, der Blob-Speicher hält 30 Tage vor — und
weil beide unabhängig voneinander laufen, prüft jeder Vorfall sie gegenseitig.

---

## Was belegt ist

| Was | Wie belegt |
|---|---|
| Alarm-Mechanik funktioniert | `node test/test-alert-ops.js` → **30/30** am 2026-09-15: kein Netzverkehr **und kein Blob-`put`**, wenn beide Ziele fehlen; Entprellung je Ereignis für beide Ziele; Nutzlast-Felder; Timeout- und Fehlerfestigkeit; Map-Deckel; Blob-Pfad, -Optionen, -Inhalt; entschärfte Pfadsegmente; Rückgabewert von `alertOps` und `alertZiele` |
| Blob-Ziel schreibt wirklich | Nicht nur gegen die Attrappe: am 2026-09-10 lokal mit dem produktiven `BLOB_READ_WRITE_TOKEN` ein Alarm geschrieben, unter `stackr/alerts/2026-09-10/` wiedergefunden, Inhalt zurückgelesen, Testobjekt gelöscht |
| **Webhook-Kette Make → Mail** | Zwei echte Testaufrufe am 2026-09-13, beide in der Make-Historie als *Success* mit je 2 Operationen. Szenario `stackr-ops-alert` (ID 7387031) ist **Active**. Protokoll in [`offen-alert-webhook.md`](offen-alert-webhook.md) |
| 18 Auslöser in sechs Endpunkten | `grep -rn "alertOps('" api/*.js` → **20 Stellen, 18 Paare** am 2026-09-15 nachgezählt — Tabelle vollständig in der Alarm-Anleitung |
| Selbsttest der Kette existiert | `?probe=1` in `api/blob-cleanup.js` (`482166f`), `test/test-alert-selbsttest.js` **26/26** am 2026-09-15 |
| Alle Pflichtvariablen sind gesetzt | Dashboard + Endpunkt-Gegenproben, Tabelle in der Vercel-Anleitung |
| Grace-Schlüssel ist der richtige | Grace-Token aus angemeldetem Browser verifiziert gegen den eingebauten Public Key |
| Cron läuft und räumt auf | am 2026-09-10 nachgeprüft: unter `stackr/tmp/` ein Objekt mit 23,0 h, nichts älter als 24 h |
| Gesamte Suite trägt den Umbau | **61 Node-Harnesses, 0 Fehlschläge** am 2026-09-15 — Zahl über `ls test/*.js \| wc -l`, sie wandert wöchentlich |

## Was offen ist

**1. Erledigt seit 2026-09-13 — `ALERT_WEBHOOK_URL` ist gesetzt.** `api/_alert.js` hat beide Ziele:

| Ziel | Env | Zustand | Was es leistet |
|---|---|---|---|
| Webhook → Make → Mail | `ALERT_WEBHOOK_URL` | **aktiv** seit 2026-09-13, Production + Preview | erreicht dich von selbst, ohne hinzusehen |
| Blob-Objekt unter `stackr/alerts/` | `BLOB_READ_WRITE_TOKEN` | **aktiv**, war ohnehin gesetzt | 30 Tage Historie, nachträglich lesbar |

Bewusst Blob und **nicht Redis** als zweites Ziel: Blob ist ein anderes System und überlebt genau
den Ausfall, der gemeldet werden soll. Damit ist auch die Hobby-Log-Grenze entschärft — ein
Cron-Fehler um 04:00 UTC ist morgens um neun im Log weg, im Blob-Speicher nicht.

**Der Einrichtung verdanken wir einen Fund, den kein lokaler Test hätte liefern können:** der
erste echte Testaufruf kam mit zerstörtem Gedankenstrich an. **Make dekodiert `application/json`
ohne `charset=utf-8` als Latin-1** — laut RFC 8259 ist der Parameter überflüssig, Make hält sich
nicht daran. Da `' — '` in *jedem* `text`-Feld steckt und `detail` deutsche Fehlertexte trägt,
hätte das jede Alarmmail getroffen. Der Parameter steht seit `77cc228` in `api/_alert.js` und ist
durch `test-alert-ops.js` B6 festgenagelt. Merksatz: **eine Kette, die man nur gegen Attrappen
prüft, ist genau bis zur ersten fremden Gegenstelle bewiesen.**

**Was als Einziges noch fehlt:** der Nachweis, dass die Variable *zur Laufzeit* bei
`api/_alert.js` ankommt. Belegt sind die Kette ab `alertOps` und dass die Variable gesetzt und
deployt ist — nicht ein Alarm, der den ganzen Weg aus dem laufenden Code genommen hat. Dafür gibt
es seit `482166f` den kurzen Weg, einen `curl` statt eines Branches:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://DEINE-DOMAIN/api/blob-cleanup?probe=1"
```

`webhook:false` wäre der Befund, `webhook:true` plus ankommende Mail schließt die Frage. **Das
kann keine Session** — es braucht das `CRON_SECRET`, das weder in `.env.local` liegt noch einer
Session zugänglich ist. Einzelheiten unter
[Selbsttest der Alarmkette](alert-webhook-anleitung.md#selbsttest-der-alarmkette-probe1).

**Die Ersatzhandlung bleibt nützlich, auch jetzt:** der Lese-Einzeiler auf
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
| `77cc228` | **Webhook eingerichtet** — und dabei der `charset`-Fund, der jede Alarmmail betroffen hätte |
| `482166f` | Selbsttest `?probe=1`: ein `curl` statt eines Branches mit zerstörter Preview |
| `84e0e15` | Anleitung nachgezogen: Selbsttest-Abschnitt, 18. Auslöser, Testzahlen |
| `b274db1` / `40f23fc` | zwei Korrekturen einer Parallel-Session an der eigenen Angabe — Previews **gibt** es, und sie sind älter als gedacht |

Der erste Commit ist der Grund, warum es die Drift-Liste daneben gibt
([`doku-drift-2026-09-09.md`](doku-drift-2026-09-09.md)): eine Tabelle, die vier Alarme nicht
kannte, war kein Einzelfall.

**Und diese Datei ist der Beleg dafür, dass die Drift auch die Drift-Bekämpfer trifft.** Sie
stammt aus demselben Komplex, hält sich für eine Übergabe — und stand zwei Tage lang auf einem
Stand, den drei andere Dateien längst überholt hatten. Was dagegen hilft, steht in der
Drift-Liste: **Messbefehl statt Messwert.** Jede Zahl in dieser Datei, die nicht datiert neben
ihrem Befehl steht, ist beim nächsten Lesen vermutlich falsch.
