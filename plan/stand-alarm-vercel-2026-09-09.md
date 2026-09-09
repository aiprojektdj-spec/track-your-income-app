# Stand: Alarm und Vercel-Konfiguration

**Stand: 2026-09-09.** Übergabe für den Komplex „stille Ausfälle sichtbar machen". Sagt, was
belegt ist, was offen ist und wer es machen muss. Die beiden Anleitungen daneben sagen, *wie*:

- [`alert-webhook-anleitung.md`](alert-webhook-anleitung.md) — `ALERT_WEBHOOK_URL` einrichten,
  Make.com-Szenario, alle 17 Alarm-Auslöser
- [`vercel-einrichtung.md`](vercel-einrichtung.md) — alle 20 Umgebungsvariablen, was ohne sie
  passiert, Gegenproben ohne Login

---

## Die Lage in drei Sätzen

Die Rate-Limits und Byte-Deckel sind bewusst **fail-open**: fällt Redis aus, fallen die Deckel weg,
statt zahlende Kunden auszusperren. Der Preis dieser Entscheidung ist, dass man den Ausfall nicht
merkt — genau dafür wurde der Alarm in `api/_alert.js` gebaut. **Der Alarm ist fertig und
getestet, aber er hat kein Ziel:** `ALERT_WEBHOOK_URL` ist in Vercel nicht gesetzt.

---

## Was belegt ist

| Was | Wie belegt |
|---|---|
| Alarm-Mechanik funktioniert | `node test/test-alert-ops.js` → **12/12** am 2026-09-09: kein Netzverkehr ohne `ALERT_WEBHOOK_URL`, Entprellung je Ereignis, Nutzlast-Felder, Timeout- und Fehlerfestigkeit, Map-Deckel |
| 17 Auslöser in sechs Endpunkten | `grep -rn "alertOps('" api/*.js` — Tabelle vollständig in der Alarm-Anleitung |
| Alle Pflichtvariablen sind gesetzt | Dashboard + Endpunkt-Gegenproben, Tabelle in der Vercel-Anleitung |
| Grace-Schlüssel ist der richtige | Grace-Token aus angemeldetem Browser verifiziert gegen den eingebauten Public Key |
| Cron läuft und räumt auf | unter `stackr/tmp/` lag nichts älter als 24 h |

## Was offen ist

**1. `ALERT_WEBHOOK_URL` fehlt — die einzige echte Lücke.** Solange sie fehlt, verlässt **keine**
Meldung das System: kein `grace-token-aus`, kein `cron-secret-missing`, kein offen gelaufenes
Rate-Limit. Verschärfend kommt dazu, dass die Vercel-Logs auf dem Hobby-Plan nur 30 Minuten bzw.
1 Stunde zurückreichen — ein Cron-Lauf um 04:00 UTC ist dort grundsätzlich nicht mehr einsehbar.

> **Beides zusammen heißt: stille Ausfälle sind derzeit auf keinem Weg sichtbar.** Nicht per
> Alarm, nicht im Log. Man erfährt davon durch einen Kunden oder gar nicht.

Das ist **kein Codeproblem** und nichts, was eine weitere Session lösen kann — es sind zwei
Schritte in fremden Oberflächen, beide beim Betreiber:

1. Make.com-Szenario anlegen (~10 Min), Webhook-URL kopieren
2. `ALERT_WEBHOOK_URL` in Vercel eintragen, **neu deployen** (ohne Redeploy greift nichts)

Danach übernimmt die Gegenprobe aus der Alarm-Anleitung — die kann eine Session fahren, sobald die
Preview-URL steht.

**2. Kein Offline-Grace auf Preview.** `WHOP_GRACE_PRIVATE_KEY` ist nur für Production gesetzt.
Für den Alltag richtig; nur beim Testen gegen ein Preview-Deployment sollte man wissen, dass
Offline-Grace dort nicht existiert und ein Ausfall dieses Wegs kein echter Befund ist.

**3. Der Dead-Man-Switch fehlt bewusst.** Der Alarm meldet fehlgeschlagene Cron-Läufe, aber keine
*ausbleibenden*. Ein echter Wächter bräuchte gespeicherten Zustand, und der läge in Redis — also
genau in dem System, dessen Ausfall er melden soll. Ersatz ist die Blob-Gegenprobe in der
Vercel-Anleitung: liegt unter `stackr/tmp/` etwas deutlich älter als 24 h, hat der Job nicht
aufgeräumt.

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

Der erste Commit ist der Grund, warum es die Drift-Liste daneben gibt
([`doku-drift-2026-09-09.md`](doku-drift-2026-09-09.md)): eine Tabelle, die vier Alarme nicht
kannte, war kein Einzelfall.
