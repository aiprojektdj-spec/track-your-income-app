# Stackr – Betriebs- und Wiederanlaufplan

Stand 04.10.2026, gegen `api/`, `vercel.json` und `.github/workflows/` geprüft. Dauerdokument:
Hier steht, **wie Stackr läuft und was im Störfall zu tun ist**. Was noch offen ist, steht in
`plan/`. Die Einzelheiten stehen in den verlinkten Anleitungen; dieses Dokument wiederholt sie nicht.

Eine Zahl oder ein Zustand, der sich nicht am Code nachmessen lässt (Dashboard-Einstellungen,
Konten), ist mit Datum markiert und gilt nur bis zur nächsten Prüfung.

## Systeme und Speicherorte

| Bereich | Ort | Inhalt |
| --- | --- | --- |
| Quellcode lokal | `C:\Users\secon\Desktop\TrackYourIncome\Web 1.7` | Entwicklung, mehrere Sessions parallel im selben Working Tree |
| Quellcode remote | GitHub `aiprojektdj-spec/track-your-income-app`, Branch `master` | Versionsverwaltung, CI |
| Hosting | Vercel-Projekt `track-your-income-app`, `https://track-your-income-app.vercel.app` | Statische Seite ohne Build + Serverless-Funktionen in `api/` |
| Buchhaltungsdaten | **Browser des Kunden** (localStorage/IndexedDB) | Klartext, nur dort, local-first |
| Cloud-Sync | Upstash Redis, eu-central-1 (Frankfurt), über die Vercel-Integration | Nur Chiffrat: `sync:<userId>:<scope>`, dazu Freigaben, Sitzungen und Zähler |
| Große Sync-Pakete, Alarme | Vercel Blob | `stackr/tmp/` (Chunks), `stackr/alerts/` (Betriebsalarme, 30 Tage) |
| Login und Zahlung | Whop (Merchant of Record) | Konto, Abo, Zahlungsdaten |
| Alarm-Zustellung | Make.com, Szenario `stackr-ops-alert` → Mail | Betriebsmeldungen aus `api/_alert.js` |

**Geheimnisse** stehen nur in Vercel (Environment Variables) und lokal höchstens in `.env.local`.
Nie committen, nie in einen Chat kopieren. Welche Variable was tut und was ohne sie ausfällt:
[`plan/vercel-einrichtung.md`](../plan/vercel-einrichtung.md).

## Serverless-Funktionen

| Endpunkt | Zweck | Hängt an |
| --- | --- | --- |
| `api/whop-token.js` | OAuth-Login, Code gegen Token tauschen | `WHOP_CLIENT_SECRET`, Redis (Sitzung) |
| `api/whop-refresh.js` | Access-Token erneuern (läuft nach 1 h ab) | `WHOP_CLIENT_SECRET`, **Redis zwingend** |
| `api/whop-access.js` | Abo-Prüfung, Offline-Grace-Token | `WHOP_API_KEY`, `WHOP_GRACE_PRIVATE_KEY`, `WHOP_OWNER_IDS` |
| `api/sync.js` | Cloud-Sync (Chiffrat), Steuerberater-Freigaben | **Redis zwingend**, `SYNC_OWNER_IDS` |
| `api/blob-upload.js` | Große Sync-Pakete in Chunks | `BLOB_READ_WRITE_TOKEN`, Redis (Budget, fail-open) |
| `api/blob-cleanup.js` | Cron 04:00 UTC: Aufräumen, Fehler-Tagesmeldung, Heartbeat, `?probe=1` | `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN` |
| `api/health.js` | Uptime-Check, `200 {ok:true,redis:"ok"}` / `503` | Redis |
| `api/client-error.js` | Browser-Fehler annehmen (bereinigt, Redis, 30 Tage TTL) | Redis (fail-closed) |

`api/_alert.js`, `api/_log.js` und `api/_client-errors.js` sind Helfer; der Unterstrich verhindert,
dass Vercel sie als Route ausliefert.

## Deployment

1. Änderung lokal bauen, Rechenlogik-Tests laufen lassen:
   ```bash
   for f in test/*.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done
   ```
2. Pfad-gescoped committen (`git commit -F <nachricht> -- <datei>`, siehe `CLAUDE.md`).
3. Push auf `master`. Der Push geht nur mit dem Konto `aiprojektdj-spec`. Hat der Rechner ein
   anderes Credential, endet er mit 403, und der User pusht selbst.
4. Vercel deployt `master` automatisch nach Production. Feature-Branches bekommen
   Preview-Deployments.
5. Die GitHub Action `Tests` (`.github/workflows/tests.yml`) läuft parallel. **Sie hält das
   Deployment bisher nicht auf.** Branch-Schutz oder „Ignored Build Step“ fehlen noch, siehe
   „Offene Betriebspunkte“.
6. Nach dem Deploy die Zwei-Minuten-Prüfung unten ausführen.

**Environment-Variablen greifen erst mit dem nächsten Deployment.** Nach jeder Änderung:
Vercel → Deployments → neuestes → ⋯ → Redeploy.

**Rückfall:** Vercel → Deployments → letztes gutes Deployment → *Promote to Production*. Danach den
schlechten Commit auf `master` per `git revert` zurücknehmen. Sonst bringt der nächste Push ihn zurück.

## Prüfung nach jedem Deployment (ohne Login)

```bash
curl -s https://track-your-income-app.vercel.app/api/health
curl -s -X POST -H "Content-Type: application/json" -d '{}' https://track-your-income-app.vercel.app/api/sync
curl -s -X POST -H "Content-Type: application/json" -d '{}' https://track-your-income-app.vercel.app/api/whop-token
curl -s https://track-your-income-app.vercel.app/api/blob-cleanup
```

| Antwort | Gut | Schlecht |
| --- | --- | --- |
| `/api/health` | `{"ok":true,"redis":"ok"}` | `503` → Redis-Env fehlt oder Upstash down |
| `/api/sync` | ein Auth-Fehler | `server_misconfigured` → Redis-Env fehlt, Sync für alle aus |
| `/api/whop-token` | Meckern über fehlenden `code` | `Server misconfigured` → `WHOP_CLIENT_SECRET` fehlt |
| `/api/blob-cleanup` | `unauthorized` | `cron_secret_not_configured` |

Gate, Sync-Roundtrip und Offline-Grace brauchen einen echten Whop-Login. Das geht **nur gegen
Production** (fester `redirect_uri`, lokal fehlen die Funktionen). Claude loggt sich nicht selbst
ein. Ablauf: [`plan/live-tests-checkliste.md`](../plan/live-tests-checkliste.md).

## Monitoring und Alarme

| Was | Wie | Stand |
| --- | --- | --- |
| Stille Ausfälle in `api/*` (offene Rate-Limits, fehlende Env, Cron-Fehler) | `api/_alert.js` → Make-Webhook (Mail) **und** Blob `stackr/alerts/` | Webhook seit 13.09.2026 scharf |
| Seite/API erreichbar | UptimeRobot auf `/`, `/app`, `/api/health` | **Konto fehlt noch** |
| Cron läuft überhaupt | Heartbeat an `HEARTBEAT_URL_BLOB_CLEANUP` (healthchecks.io) nach jedem erfolgreichen Lauf | Code da, **Env fehlt noch** |
| Fehler beim Kunden | `js/error-logger.js` → `api/client-error.js`, Tagesmeldung im Cron | Server live, Client wartet auf Freigabe des Datenschutztexts |
| Server-Logs | strukturierte Codes über `api/_log.js` | Vercel Hobby: Logs nur ~1 h |

**Alarm erhalten, was tun:** `source`/`event` in der Tabelle in
[`plan/alert-webhook-anleitung.md`](../plan/alert-webhook-anleitung.md) nachschlagen. Vier
Meldungen bedeuten einen Ausfall für **alle** Kunden und sind sofort dran:
`sync`/`redis-env-missing`, `whop-refresh`/`redis-fehlt`, `whop-access`/`grace-token-aus`,
`blob-cleanup`/`cron-secret-missing`. Kommt eine davon direkt nach einem Deploy oder einer
Env-Änderung, fehlt fast immer eine Variable im richtigen Environment.

**Alarmkette selbst prüfen** (der User, `CRON_SECRET` liegt nur in Vercel):
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://track-your-income-app.vercel.app/api/blob-cleanup?probe=1"
```
`webhook:true` und eine Mail mit Quelle `selbsttest` → Kette in Ordnung.

**Alarm-Historie ohne Dashboard** (30 Tage, Token aus `.env.local`): Einzeiler in
[`plan/alert-webhook-anleitung.md`](../plan/alert-webhook-anleitung.md#nachsehen-was-passiert-ist).
Eine leere Liste heißt, dass nichts gemeldet wurde.

## Backup und Wiederherstellung

Stackr hält **keine Klartext-Buchhaltung auf dem Server**. Daraus folgt:

- **Die Daten des Kunden** liegen in seinem Browser. Gegen Verlust schützen ihn das verschlüsselte
  Backup (`js/backup-crypto.js`, Datei mit Passwort) und der Cloud-Sync. Restore macht der Kunde
  selbst in der App. Der Restore-Weg ist durch `test/test-backup-crypto-restore.js` abgedeckt.
- **Der Cloud-Sync** ist selbst das Backup. Deshalb haben `sync:`-Keys bewusst **kein TTL**
  (`api/sync.js`). Ohne den Schlüssel des Kunden kann ihn niemand lesen, auch Stackr nicht. Verliert
  der Kunde Gerät und Schlüssel, ist der Sync-Stand nicht wiederherstellbar. Das ist gewollt.
- **Redis selbst:** Welche Sicherung der Upstash-Plan bietet, ist **nicht geprüft** (offen, s. u.).
  Fällt die Datenbank ganz aus, verlieren die Kunden den Sync-Stand, nicht aber ihre lokalen Daten.
  Beim nächsten Sync lädt jedes Gerät seinen Stand wieder hoch.
- **Blob** enthält nur Zwischen-Chunks und Alarme, nichts Unersetzliches.
- **Code und Konfiguration:** Git ist die Sicherung des Codes. Die Env-Werte stehen in Vercel. Bei
  den *Sensitive*-Werten ist das die einzige Kopie, sie lassen sich nicht auslesen. Ist ein Wert
  verloren, wird er beim Anbieter neu erzeugt (Tabelle in
  [`plan/incident-response.md`](../plan/incident-response.md)). Ausnahme
  `WHOP_GRACE_PRIVATE_KEY`: neu erzeugen heißt, auch den Public Key in `js/whop-auth.js` mitzutauschen.

## Wiederanlauf nach Ausfall

| Lage | Vorgehen |
| --- | --- |
| Schlechtes Deployment | *Promote to Production* auf das letzte gute, dann `git revert` |
| Upstash down | `/api/health` → 503. Login-Erneuerung und Sync fallen aus, die lokale Arbeit läuft weiter (Offline-Grace). Upstash-Status abwarten, nichts umkonfigurieren |
| Redis-Env verloren/geändert | Beide Paare prüfen: `UPSTASH_REDIS_REST_*` hat Vorrang vor `KV_REST_API_*`. Das Projekt läuft auf `KV_REST_API_*`. Ein neu angelegtes `UPSTASH_…`-Paar überschreibt die laufende Verbindung still |
| Whop down | Gate hält über das Offline-Grace-Token. Nichts tun, das ist kein eigener Ausfall |
| Schlüssel geleakt | [`plan/incident-response.md`](../plan/incident-response.md): rotieren, Beweise sichern, 72-h-Frist (Art. 33 DSGVO) |
| Kunde kommt nicht an seinen Sync („Code falsch“) | zwei Schlüssel pro Account. Der Kunde löst es selbst über Diagnose/Reset in der App |

## Whop-Betrieb

- Zugang gewähren die Produkte in `WHOP_ACCESS_IDS` (Default im Code). Neues Produkt bei Whop →
  ID dort eintragen, sonst kommen Käufer nicht hinein.
- `WHOP_API_KEY` muss ein `apik_…`-Key sein. Ein `sk_live_…` hat am 13.07.2026 zahlende Kunden
  ausgesperrt.
- Owner-Zugang nur über `WHOP_OWNER_IDS` **und** `SYNC_OWNER_IDS` (`user_…`). Das sind zwei
  getrennte Variablen für dieselbe Person.
- Kündigung, Erstattung und Rechnungen laufen über Whop. Stackr selbst hält keine Zahlungsdaten.

## Offene Betriebspunkte (Stand 04.10.2026)

Quelle und Fortschritt: [`plan/betrieb-luecken-2026-09-29.md`](../plan/betrieb-luecken-2026-09-29.md),
[`plan/vercel-pro-2026-10-03.md`](../plan/vercel-pro-2026-10-03.md). Alle Punkte hängen am User.

- [ ] GitHub-Branch-Schutz für `master` mit `Tests` als Pflicht-Check
- [ ] Alarm-Selbsttest `?probe=1` mit echtem `CRON_SECRET`, Mail angekommen
- [ ] UptimeRobot (`/`, `/app`, `/api/health`), healthchecks.io + `HEARTBEAT_URL_BLOB_CLEANUP`, Testalarm
- [ ] Datenschutztext „Fehlerprotokolle“ freigeben, dann Client-Teil von `js/error-logger.js` committen
- [ ] Vercel Pro (Stackr ist kommerziell, Hobby ist es nicht), Spend-Limit, Preview-Schutz, längere Logs
- [ ] Upstash: Plan und Backup-/Persistenz-Optionen nachsehen und hier eintragen

## Nachweise

Prüfungen gegen Production mit Datum und Ergebnis hier eintragen, neueste oben.

| Datum | Was | Ergebnis |
| --- | --- | --- |
| 13.09.2026 | Make-Szenario `stackr-ops-alert`, zwei echte Testaufrufe | Mail angekommen |
| 09.09.2026 | Grace-Token aus angemeldetem Browser gegen eingebauten Public Key | verifiziert |
| 09.09.2026 | `stackr/tmp/` ohne Objekte älter als 24 h | Cron räumt auf |
