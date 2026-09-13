# Erledigt: `ALERT_WEBHOOK_URL` ist gesetzt

**Stand: 2026-09-13.** Der Punkt, der hier als offen stand, ist eingerichtet. Diese Datei sagt
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

Dazu muss etwas echt fehlschlagen. Die beiden Wege:

1. **Die dokumentierte Gegenprobe** — auf **Preview** `KV_REST_API_URL` auf Unsinn setzen, Preview
   deployen, `POST /api/sync` (braucht kein Token, der Redis-Check läuft vor der Tokenprüfung),
   danach **zurücksetzen und erneut deployen**. Kostet einen kaputten Preview-Zustand auf Zeit.
2. **Beim nächsten echten Vorfall** — kostet nichts, sagt aber erst dann Bescheid.

Bis dahin bleibt der Blob-Speicher der zweite, unabhängige Weg: `api/_alert.js` schreibt jede
Meldung zusätzlich unter `stackr/alerts/`, 30 Tage lang, ohne Einrichtung.
