# Erledigt: `ALERT_WEBHOOK_URL` ist gesetzt

**Stand: 2026-09-13**, nachgetragen am selben Tag nach dem Deployment. Der Punkt, der hier als offen stand, ist eingerichtet. Diese Datei sagt
jetzt nur noch, was belegt ist und welcher eine Beweis noch aussteht. Das *Wie* steht weiter in
[`alert-webhook-anleitung.md`](alert-webhook-anleitung.md).

## Was eingerichtet wurde

| Teil | Stand |
|---|---|
| Make.com-Szenario `stackr-ops-alert` (ID 7387031) | angelegt, **Active** |
| Modul 1 | Webhooks → Custom webhook, Hook `stackr-ops-alert` |
| Modul 2 | Email → *Send an Email to a Team Member* an aiprojektdj@gmail.com |
| Betreff | `Stackr-Alarm: {{3.source}} - {{3.event}}` |
| Inhalt | `text`, `source`, `event`, `detail`, `env`, `ts` — als HTML |
| `ALERT_WEBHOOK_URL` in Vercel | gesetzt für **Production und Preview**, Typ *Secret* |
| Deployment | Redeploy desselben Commits mit den neuen Einstellungen, **Ready** |
| charset-Fix live | ja — `77cc228` deployt, seither `8c9295c` obenauf |

Preview ist absichtlich mit dabei: ohne sie wäre die
[Gegenprobe](alert-webhook-anleitung.md#gegenprobe-nach-dem-deployment) nicht fahrbar. Development
bewusst **nicht** — lokale Läufe sollen den Webhook nicht bespielen.

**Kein API-Key am Hook.** `api/_alert.js` schickt keinen `x-make-apikey`-Header; ein Key in Make
würde jeden Alarm still abweisen.

## Was belegt ist

Zwei echte Testaufrufe am 2026-09-13, beide in der Make-Historie als **Success** mit
**2 operations** (Webhook *und* Mail-Modul gelaufen):

- 14:44:30 — Betreff `Stackr-Alarm: sync - rate-limit-open`, alle Felder aufgelöst.
- 14:46:33 — Umlaut-Probe, siehe Fund unten.

Bemerkenswert: **die Feldverweise lösen auf, obwohl Make die Datenstruktur nie „erkannt" hat.**
Der Hinweis *„No data detected"* im Webhook-Modul betrifft nur die Auswahlliste beim Klicken;
von Hand getippte `{{3.feld}}`-Verweise funktionieren unabhängig davon. Der Testaufruf aus
Schritt 3 der Anleitung ist damit Komfort, keine Voraussetzung.

## Der Fund dabei: fehlender `charset`

Der erste Testaufruf kam als `[Stackr] sync � rate-limit-open` an — der Gedankenstrich zerstört.
Der zweite, identisch bis auf `Content-Type: application/json; charset=utf-8`, kam sauber an,
samt `ä ö ü ß`.

Laut RFC 8259 ist `application/json` immer UTF-8 und der Parameter überflüssig — Make hält sich
nicht daran und dekodiert ohne ihn als Latin-1. Da `' — '` in **jedem** `text`-Feld steckt und
`detail` deutsche Fehlertexte trägt, hätte das jede Alarm-Mail getroffen. Gefixt in
`api/_alert.js`, abgesichert durch `test/test-alert-ops.js` B6.

## Was noch aussteht

**Ein Beweis fehlt: dass Vercels Variable zur Laufzeit wirklich bei `api/_alert.js` ankommt.**
Belegt ist bisher die Kette *Webhook → Make → Mail* und dass die Variable gesetzt und deployt
ist — nicht aber ein Alarm, der den ganzen Weg aus dem laufenden Code genommen hat.

Dazu muss etwas echt fehlschlagen, und kein Alarm lässt sich gefahrlos auslösen:
`grace-token-aus` feuert erst **nach** gültigem Whop-Token ([`api/whop-access.js:258`](../api/whop-access.js)),
und `redis-env-missing` setzt voraus, dass man die Redis-Env kaputtmacht. Die dokumentierte
[Gegenprobe](alert-webhook-anleitung.md#gegenprobe-nach-dem-deployment) bräuchte zusätzlich ein
**frisches Preview-Deployment**.

>
> **Korrektur 2026-09-14:** Hier stand, es gebe überhaupt keins. Falsch — die Deployments-Liste in
> Vercel ist standardmäßig auf `Environment Production` gefiltert, und der aktive Filter sieht aus
> wie ein Vorschlag (`…/deployments?environment=preview` zählt richtig). Der Irrtum stand kurz auch
> in der Anleitung, Commit `0c5c4b0`, dort inzwischen korrigiert.

Vorhanden sind Previews also, aber alle **älter als die Variable** (2026-09-13): der jüngste vom
2026-08-30 steht auf **Error**, die übrigen aus Juni und Juli liegen vor `api/_alert.js`. Ein
Branch muss also geschoben werden. Und `KV_REST_API_*` ist für **Production und Preview** gesetzt — ein Preview
feuert `redis-env-missing` nicht von selbst.

### Der Selbsttest ist gebaut — ein `curl` statt eines Branches

**Committet am 2026-09-13 als `482166f`**, am 2026-09-14 gegen den Code nachgeprüft (nicht gegen
die Ankündigung). `api/blob-cleanup.js` kennt jetzt `?probe=1`:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://DEINE-DOMAIN/api/blob-cleanup?probe=1"
```

Antwort: `{ok, probe:true, env, webhook, blob, gemeldet}`. `webhook` und `blob` sagen, ob
`ALERT_WEBHOOK_URL` bzw. `BLOB_READ_WRITE_TOKEN` **im laufenden Prozess** ankommen — als
Ja/Nein, die URL selbst wird nie ausgeliefert. `gemeldet: false` heißt nur „binnen fünf Minuten
schon geschickt" (Entprellung), nicht „fehlgeschlagen".

Am Code gegengelesen, weil ein Selbsttest hinter einem Secret genau die Stelle ist, an der man
sich nicht auf eine Zusage verlässt:

| Geprüft | Befund |
|---|---|
| Reihenfolge | `?probe=1` wird **nach** der Bearer-Prüfung ausgewertet ([`api/blob-cleanup.js:68`](../api/blob-cleanup.js), Prüfung in Zeile 54) — kein neuer Zugangsweg |
| Aufräumlauf | Der Zweig kehrt **vor** `try {` zurück: in diesem Modus kein `list`, kein `del` |
| Geheimnisse | Die Antwort trägt nur Booleans, nirgends die URL |
| Alarmflut | Die Entprellung gilt für `selbsttest`/`webhook-probe` wie für jedes Paar |
| Tests | `test/test-alert-selbsttest.js` 26/26, `test/test-alert-ops.js` 30/30 — selbst nachgefahren |

> ⚠️ **Noch nicht belegt: der Lauf gegen Produktion.** Der Selbsttest lief bisher nur lokal gegen
> Attrappen. Es fehlen zwei Dinge, die keine Session hat: das **Deployment dieses Commits** und
> `CRON_SECRET` — das liegt weder in `.env.local` noch hat eine Session Vercel-Zugang. Der
> `curl` oben ist also die Anleitung, nicht das Protokoll.

**Bis dahin gilt weiter: nicht erzwingen.** Was unbelegt bleibt, ist ausgerechnet das mechanisch
Unverdächtigste — ein `process.env.ALERT_WEBHOOK_URL`, dieselbe Mechanik, über die ein Dutzend
anderer Variablen nachweislich ankommt. Der alte Weg (Branch anlegen, Preview-Redis zerstören,
zurücksetzen, zweimal deployen) steht dazu in keinem Verhältnis — und ist jetzt ohnehin durch
den `curl` ersetzt.

## Die beiden Ziele prüfen sich jetzt gegenseitig

Das ist der eigentliche Ersatz für den fehlenden Beweis, und er kostet nichts:

| Beobachtung | Was sie bedeutet |
|---|---|
| Mail **und** Eintrag unter `stackr/alerts/` | alles heil |
| Eintrag im Blob, **aber keine Mail** | genau der ungeprüfte Link ist kaputt — Variable kommt nicht an, oder Make/Szenario steht |
| Mail, **aber kein Blob-Eintrag** | `BLOB_READ_WRITE_TOKEN` ist das Problem |
| beides leer | nichts passiert (Normalfall) |

Der erste echte Vorfall beantwortet die offene Frage also nebenbei — und bis dahin läuft nichts
ins Leere, weil der Blob-Speicher unabhängig mitschreibt (30 Tage, ohne Einrichtung).

## Kontrolljournal

Solange der Webhook der einzige Weg ist, der von selbst meldet, bleibt der Blick in den
Blob-Speicher die Routine — er läuft aus dem Repo, ohne Vercel-Zugriff. Befehle stehen unter
[Nachsehen, was passiert ist](alert-webhook-anleitung.md#nachsehen-was-passiert-ist) und in der
[Cron-Gegenprobe](vercel-einrichtung.md).

| Datum | `stackr/alerts/` | `stackr/tmp/` |
|---|---|---|
| 2026-09-12 | 0 Alarme | — |
| **2026-09-15** | **0 Alarme** | 1 Objekt, 21,7 h → Cron räumt auf |

**Leere Liste ist der gute Fall** — anders als beim Vercel-Log, wo Leere auch „ist längst
rausgerollt" bedeuten kann (Hobby-Plan: 30–60 Minuten).

**Und sie sagt noch etwas:** Der Selbsttest schreibt selbst einen Eintrag — `selbsttest`/
`webhook-probe` ist eine reguläre Zeile der Auslöser-Tabelle. **0 Alarme heißt also auch: der
`?probe=1`-Aufruf ist noch nicht gelaufen.** Umgekehrt ist das die Abnahme: taucht nach dem Aufruf
hier ein `selbsttest`-Eintrag auf, ist damit zugleich das Blob-Ziel unabhängig bestätigt.

## Nebenbefund: `BLOB_READ_WRITE_TOKEN` — rotiert am 2026-09-17

Vercel hatte die Variable mit **„Needs Attention"** markiert:

> `BLOB_READ_WRITE_TOKEN` looks like a secret, but its value is visible to anyone with access.
> Consider rotating at the source and saving as *Secret*.

**Erledigt:** am 2026-09-17 abends vom Betreiber über „Rotate Blob Credentials" rotiert und
anschließend neu deployt. Am 2026-09-18 gegengeprüft: der alte Token aus `.env.local` bekommt
von der Blob-API **HTTP 403**, er ist also wirklich entwertet.

**Korrektur zur alten Warnung:** Hier stand, Rotieren entwerte den laufenden Token *sofort*. Das
stimmt nicht. Der Dialog bietet „Delay expiration of old secrets" an, Vorgabe **3 Stunden**. Der
alte Token bleibt so lange gültig, ein Redeploy innerhalb dieser Frist verhindert jeden Ausfall.
Nachgemessen: kurz nach der Rotation lieferte der alte Token noch HTTP 200, am Folgetag 403.

**Noch offen, nur der Betreiber:**

- **`.env.local` nachziehen.** Die Datei trägt noch den alten Token (unverändert seit
  2026-07-15). Bis dahin geht der Lese-Einzeiler für `stackr/alerts/` lokal nicht, das
  Kontrolljournal oben pausiert. Den neuen Wert kann keine Session holen, weil keine
  Vercel-Zugang hat.
- **Typ *Secret* prüfen.** Rotieren ändert den Typ der Variable nicht. Verschwindet das
  „Needs Attention" nicht, muss der Wert einmal als *Secret* neu angelegt werden.

Ob die Produktion den neuen Token hat, zeigt der nächste Cron-Lauf um 04:00 UTC: fehlt er,
kommt eine Mail `blob-cleanup - cleanup-failed`.
