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
**Preview-Deployment — und davon gibt es keins**: alles geht von `master` direkt nach Production.
Man müsste also erst einen Branch schieben.

> **Wird gerade gelöst, besser als hier beschrieben.** Eine Parallel-Session baut am 2026-09-13
> einen Selbsttest `?probe=1` in `api/blob-cleanup.js`: er meldet, ob `ALERT_WEBHOOK_URL` im
> laufenden Prozess ankommt — ohne die URL auszuliefern — und `alertOps` gibt dazu neu
> zurück, ob gesendet oder entprellt wurde. Das beantwortet die Frage unten ohne Branch, ohne
> kaputte Preview und ohne echten Ausfall. Sobald das committet ist, ersetzt es den Absatz hier.

**Empfehlung bis dahin: nicht erzwingen.** Was noch unbelegt ist, ist ausgerechnet das mechanisch
Unverdächtigste — ein `process.env.ALERT_WEBHOOK_URL`, dieselbe Mechanik, über die ein Dutzend
anderer Variablen nachweislich ankommt. Der Aufwand (Branch anlegen, Preview-Redis zerstören,
zurücksetzen, zweimal deployen) steht dazu in keinem Verhältnis.

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

## Nebenbefund: `BLOB_READ_WRITE_TOKEN` liegt offen

Vercel markiert die Variable mit **„Needs Attention"**:

> `BLOB_READ_WRITE_TOKEN` looks like a secret, but its value is visible to anyone with access.
> Consider rotating at the source and saving as *Secret*.

**Kein Ausfall, reine Hygiene** — der Token funktioniert, er liegt nur als lesbare
Config-Variable statt als *Secret*. Zwei Dinge, die man vor dem Knopf „Rotate Blob Credentials"
wissen sollte:

- Rotieren entwertet den laufenden Token **sofort**, während das aktive Deployment noch den alten
  hält. Bis zum Redeploy wären Blob-Uploads von **Kundenanhängen** und der Alarmspeicher tot.
- Derselbe Token steht in `.env.local`. Nach dem Rotieren geht der wöchentliche Lese-Einzeiler
  nicht mehr, bis die Datei nachgezogen ist.

Also bewusst liegengelassen. Wer es angeht: erst rotieren **und** als *Secret* neu anlegen, dann
deployen, dann `.env.local` nachziehen — in dieser Reihenfolge.
