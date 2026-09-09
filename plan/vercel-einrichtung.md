# Vercel einrichten — welche Variable was tut

**Stand: 2026-09-09**, jede Zeile gegen `api/` geprüft. Schwesterdatei zu
[`alert-webhook-anleitung.md`](alert-webhook-anleitung.md), die nur `ALERT_WEBHOOK_URL` behandelt.

**Worum es geht:** Stackr ist eine statische Seite ohne Build-Schritt plus **sechs**
Serverless-Funktionen in `api/` und **einen Cron-Job**. Die statische Seite läuft immer. Alles
andere hängt an Umgebungsvariablen — und die hängen an einer Eigenheit, die man einmal
verinnerlichen muss:

> **Umgebungsvariablen greifen erst mit dem nächsten Deployment.** Setzen allein bewirkt nichts.
> Nach jeder Änderung: Vercel → Deployments → neuestes → ⋯ → **Redeploy**.

Das ist die häufigste Ursache für „ich habe es doch eingetragen, es tut trotzdem nicht".

---

## Wo man das einträgt

Projekt `track-your-income-app` → **Settings** → **Environment Variables** → *Add New*.

Je Variable wählst du die Umgebungen aus: **Production**, **Preview**, **Development**. Eine
Variable, die nur für Production gesetzt ist, fehlt in Preview — dort verhält sich die App dann
wie unkonfiguriert. Das ist meistens gewollt, erklärt aber, warum ein Preview-Deployment Dinge
kann oder nicht kann, die Production anders macht.

---

## Die Pflichtvariablen — ohne die ist etwas kaputt

| Variable | Wer liest sie | Ohne sie |
|---|---|---|
| `WHOP_CLIENT_SECRET` | `whop-token`, `whop-refresh` | **Niemand kann sich anmelden.** Beide antworten `500 Server misconfigured`. |
| `UPSTASH_REDIS_REST_URL`<br>`UPSTASH_REDIS_REST_TOKEN` | `sync`, `blob-upload`, `whop-access`, `whop-token`, `whop-refresh` | **Cloud-Sync komplett aus** (`sync` → `500 server_misconfigured`) und **Token-Erneuerung tot** (`whop-refresh` → `503`, jeder Kunde fliegt nach einer Stunde raus). Bei den übrigen fallen nur die Rate-Limits weg. |
| `BLOB_READ_WRITE_TOKEN` | `blob-upload`, `blob-cleanup` | Große Sync-Pakete schlagen fehl (`500 server_misconfigured`). Setzt die Vercel-Blob-Integration normalerweise **selbst**, sobald der Store mit dem Projekt verknüpft ist. |

**Die `||`-Falle bei Redis:** Alle fünf Redis-Endpunkte lesen

```
UPSTASH_REDIS_REST_URL   || KV_REST_API_URL
UPSTASH_REDIS_REST_TOKEN || KV_REST_API_TOKEN
```

Sind beide Paare gesetzt, springt das zweite ein, sobald du nur das erste änderst — dann passiert
scheinbar gar nichts. Wer testet oder umzieht, muss **beide** Paare anfassen. Eine Variable namens
`REDIS_URL` gibt es nicht; wer die setzt, ändert nichts.

`blob-cleanup` ist der einzige Endpunkt, der ohne Redis auskommt.

---

## Die Sicherheits-Variablen — ohne die läuft es, aber schlechter

| Variable | Wer liest sie | Ohne sie |
|---|---|---|
| `WHOP_GRACE_PRIVATE_KEY` | `whop-access` | **Kein Kunde bekommt ein Offline-Grace-Token.** Wer offline geht, fliegt aus dem Gate. Fällt sonst erst im Support auf — deshalb meldet der Alarm `whop-access`/`grace-token-aus`. |
| `WHOP_OWNER_IDS` | `whop-access` | Fällt auf `WHOP_OWNER_USERNAMES` zurück; ist auch die leer, **gibt es keinen Owner** — im Zweifel lieber keiner als ein erratbarer (Fund R3). |
| `SYNC_OWNER_IDS` | `sync`, `blob-upload` | dasselbe für Sync und Upload, Fallback ist `SYNC_OWNER_USERNAMES` |
| `CRON_SECRET` | `blob-cleanup` | Der tägliche Aufräum-Job **läuft ins Leere**, verwaiste Chunks bleiben liegen, Blob-Speicher wächst. Alarm: `blob-cleanup`/`cron-secret-missing`. |

### `WHOP_GRACE_PRIVATE_KEY` — die eine echte Stolperfalle

**Du kannst hier kein frisches Schlüsselpaar erzeugen.** Der passende Public Key steht fest
eingebaut im Client, in [`js/whop-auth.js:61`](../js/whop-auth.js:61). Ein neu erzeugter privater
Schlüssel produziert Signaturen, die der Browser ablehnt — mit dem Ergebnis, dass Offline-Grace
still nicht mehr funktioniert, **ohne** dass ein Alarm feuert: der Alarm prüft nur, ob überhaupt
signiert werden konnte, nicht ob der Browser die Signatur akzeptiert.

**Prüfen, ob der Schlüssel der richtige ist** — lokal, ohne Vercel-Zugriff, `grace.pem` ist der
private Schlüssel als Datei:

```bash
node -e "var c=require('crypto'),f=require('fs');var j=c.createPublicKey(c.createPrivateKey(f.readFileSync('grace.pem','utf8'))).export({format:'jwk'});console.log(j.x);console.log(j.y)"
```

Die zwei ausgegebenen Werte müssen exakt den `x`/`y` in `js/whop-auth.js:62-63` entsprechen:

```
x: ZZQLtX5IWVyHHZ9hDmnJ1_uxS_oJGGkGTGtLxHRcT9U
y: Ik6rDmTMqm6fdxbXCt_5akptY8i8Ere7VvLTTeZgVkc
```

Stimmen sie nicht überein, ist es das falsche Paar. Willst du bewusst rotieren, gehören **beide
Seiten** geändert: neuer privater Schlüssel in Vercel *und* die daraus abgeleiteten `x`/`y` in
`js/whop-auth.js` committen und deployen. Danach müssen alle Kunden einmal online gehen.

**Format:** PKCS#8-PEM. Vercels Eingabefeld nimmt echte Zeilenumbrüche an — einfach den
kompletten Block von `-----BEGIN PRIVATE KEY-----` bis `-----END PRIVATE KEY-----` einfügen.

### Owner-IDs: `user_…`, nicht der Name

`WHOP_OWNER_IDS` und `SYNC_OWNER_IDS` erwarten Whop-User-IDs der Form `user_…` (kommagetrennt),
die aus `me.sub` stammen. Die Namensvarianten (`*_OWNER_USERNAMES`) sind der **Altweg** und wirken
nur, **solange die ID-Liste leer ist**. Grund: der Name war umgehbar — wer bei Whop keinen
Benutzernamen gesetzt hatte und seinen *Anzeigenamen* auf den Owner-Namen änderte, bekam
Vollzugriff ohne Abo (Fund R3, Red-Team-Audit 2026-08-10).

Sobald du IDs einträgst, zählt **ausschließlich** die ID — die Namensliste ist dann tot. Trag die
ID also ein, bevor du dich auf sie verlässt, und prüf danach einmal, dass du selbst noch reinkommst.

**Achtung, zwei getrennte Variablen für dieselbe Person:** `whop-access` liest `WHOP_OWNER_IDS`,
`sync` und `blob-upload` lesen `SYNC_OWNER_IDS`. Es sind eigenständige Serverless-Funktionen ohne
gemeinsames Modul. Wer nur eine setzt, ist an einer Stelle Owner und an der anderen nicht.

---

## Optional — Stellschrauben mit brauchbaren Defaults

Diese braucht man nur, wenn man am Standardverhalten etwas ändern will:

| Variable | Default im Code | Wofür |
|---|---|---|
| `ALERT_WEBHOOK_URL` | — (aus) | Alarm bei stillen Ausfällen. Siehe [`alert-webhook-anleitung.md`](alert-webhook-anleitung.md). |
| `WHOP_API_KEY` | — (aus) | Aktiviert den Company-Membership-Scan als **Fallback**, wenn der Nutzer-Token beim Zugangs-Check abgelehnt wird. Ohne ihn ist der Zugang in dem Fall schlicht nicht feststellbar. Muss ein `apik_…`-Key sein — ein `sk_live_…` hat am 2026-07-13 zahlende Kunden ausgesperrt. |
| `WHOP_ACCESS_IDS` | `prod_wgVmaJg4sBVOD,prod_p1WHi5t65rAA6,biz_2OEWYGlOwb8b0f` | Welche Whop-Produkte als Zugang gelten. Der Default steht im Code — nur setzen, wenn sich die Produkte ändern. |
| `BLOB_MAX_BYTES` | `10737418240` (10 GB) | Byte-Budget je Nutzer und Fenster |
| `BLOB_BUDGET_WINDOW_SEC` | `2592000` (30 Tage) | Länge dieses Fensters |
| `SYNC_MAX_SCOPES` | `25` | Scopes je Nutzer |
| `SYNC_MAX_GRANTS` | `10` | aktive Steuerberater-Freigaben je Owner |

`VERCEL_ENV` setzt **Vercel selbst** (`production` / `preview` / `development`). Nicht anfassen —
`api/_alert.js` schreibt den Wert in jede Alarm-Meldung, damit man Preview von Produktion
unterscheiden kann.

---

## Der Cron-Job

`vercel.json` enthält bereits:

```json
"crons": [ { "path": "/api/blob-cleanup", "schedule": "0 4 * * *" } ]
```

Täglich 4:00 UTC, räumt verwaiste Chunks unter `stackr/tmp/` weg. Braucht `CRON_SECRET` **und**
`BLOB_READ_WRITE_TOKEN`. Vercel schickt den Secret automatisch als
`Authorization: Bearer $CRON_SECRET`, sobald die Variable gesetzt ist — du musst dafür nichts
weiter konfigurieren als die Variable selbst.

**Was niemand meldet:** ein Cron, der gar nicht erst läuft. Der Alarm meldet fehlgeschlagene, nicht
ausbleibende Läufe. Einmal im Monat in **Vercel → Cron Jobs** auf den letzten Lauf schauen ist der
ganze Aufwand.

---

## Nach dem Deployment: was man in zwei Minuten prüfen kann

Ohne Login und ohne Kundendaten — die öffentlichen Fehlerantworten reichen als Beweis, weil der
Konfigurations-Check in beiden Endpunkten **vor** der Token-Prüfung läuft:

```bash
curl -s -X POST -H "Content-Type: application/json" -d '{}' https://DEINE-DOMAIN/api/sync
```

| Antwort | Bedeutung |
|---|---|
| `{"error":"server_misconfigured"}` | **Redis-Env fehlt** — Cloud-Sync ist für alle aus |
| irgendein Auth-Fehler (`unauthorized`, `missing_token` …) | Redis ist da, der Endpunkt läuft — er will jetzt nur einen Token. **Das ist das gute Ergebnis.** |

Dasselbe für den Login-Weg:

```bash
curl -s -X POST -H "Content-Type: application/json" -d '{}' https://DEINE-DOMAIN/api/whop-token
```

`{"error":"Server misconfigured"}` heißt: `WHOP_CLIENT_SECRET` fehlt. Eine Meckerei über einen
fehlenden `code` heißt: alles gut, der Endpunkt arbeitet.

Alles, was darüber hinausgeht — Gate, Sync-Roundtrip, Offline-Grace — braucht einen echten
Whop-Login und geht nur gegen Produktion, nicht gegen localhost: der `redirect_uri` ist fest, und
lokal fehlen die `api/`-Funktionen ganz.
