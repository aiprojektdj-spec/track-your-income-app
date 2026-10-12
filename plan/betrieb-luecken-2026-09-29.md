# Betriebslücken schließen (Stackr)

Stand: 29. September 2026. Anlass war ein Abgleich mit der „Vibe-Coding-Säule“
(16 Schichten eines echten SaaS). Security (strenge CSP), Rate Limiting,
Auth über Whop, verschlüsselte Backups mit getestetem Restore und 74
Rechenlogik-Tests sind stark. Offen ist: **Tests laufen nicht automatisch,
kein Uptime-Monitoring, Fehler beim Kunden bleiben unsichtbar.**

Reihenfolge = Priorität.

---

## 1. CI: Tests bei jedem Push automatisch ausführen

**Problem:** Es gibt keinen `.github/workflows`-Ordner. Die 74 Tests in `test/`
laufen nur, wenn jemand die Schleife aus `CLAUDE.md` von Hand startet. Ein
Deploy mit kaputter Steuerlogik ist dadurch möglich.

**Umsetzung:**

1. Vorab prüfen, dass jeder Test bei einem Fehler mit Exit-Code ≠ 0 endet:
   ```bash
   for f in test/*.js; do node "$f" >/dev/null 2>&1; echo "$? $f"; done
   ```
   Tests, die Fehler nur ausgeben und trotzdem mit 0 enden, auf
   `process.exitCode = 1` umstellen. Tests, die einen Browser oder
   Netzwerkzugriff brauchen, markieren und aus der CI-Schleife ausnehmen.
2. Neue Datei `.github/workflows/tests.yml`:

   ```yaml
   name: Tests
   on:
     push:
       branches: [master]
     pull_request:
   permissions:
     contents: read
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 22
             cache: npm
         - run: npm ci
         - name: Alle Tests
           run: |
             fail=0
             for f in test/*.js; do
               if ! node "$f" > /tmp/out.txt 2>&1; then
                 echo "::error::FAIL $f"; cat /tmp/out.txt; fail=1
               fi
             done
             exit $fail
         - name: Abhängigkeiten prüfen
           run: npm audit --omit=dev --audit-level=high
   ```

   Actions wie bei CFC auf einen Commit-SHA pinnen.
3. Auf GitHub: Branch-Schutz für `master` mit „Tests“ als Pflicht-Check.
   Alternativ in Vercel „Ignored Build Step“ nutzen, damit nur deployt wird,
   wenn der Check grün ist.
4. `CLAUDE.md` ergänzen: Die Tests laufen in der CI, ein neuer Test in
   `test/` wird automatisch mit ausgeführt.

**Fertig, wenn:** Ein absichtlich kaputter Test macht den Push rot, und nach
dem Zurücksetzen ist er wieder grün.

---

## 2. Alarm-Webhook: nur noch der Laufzeit-Beweis

**Stand:** Seit 2026-09-13 ist `ALERT_WEBHOOK_URL` gesetzt (Production und
Preview), das Make-Szenario `stackr-ops-alert` schickt Mails, zwei Testläufe
waren erfolgreich (`plan/02-ENTSCHEIDUNGEN.md`). **Nicht belegt** ist, dass die
Variable zur Laufzeit bei `api/_alert.js` ankommt (`plan/01-AUFGABEN.md` §2.6,
`plan/offen-alert-webhook.md`).

**Umsetzung:** Den Selbsttest aus §2.6 einmal mit `CRON_SECRET` aufrufen (geht
nur durch dich, das Secret steht nicht in `.env.local`) und prüfen, dass die
Mail ankommt.

---

## 3. Uptime-Monitoring und Cron-Heartbeat

**Problem:** Fällt die Seite, `/api/sync` oder der Whop-Login aus, merkt es
niemand, bis ein Kunde kündigt. Der Cron `blob-cleanup` (04:00 UTC) kann still
ausfallen.

**Umsetzung:**

1. Kostenlos bei **UptimeRobot** oder **Better Stack**:
   - `https://<domain>/`: Keyword-Check, alle 5 Min.
   - `https://<domain>/app`: HTTP 200, alle 5 Min.
   - Health-Check für die API: Einen kleinen Endpunkt `api/health.js` anlegen,
     der nur `{ ok: true }` zurückgibt und optional Redis anpingt (dann
     `{ ok: true, redis: "ok" | "down" }`, ohne interne Details).
2. Heartbeat für `blob-cleanup` über **healthchecks.io**: Env `HEARTBEAT_URL_BLOB_CLEANUP`.
   Am Ende eines **erfolgreichen** Laufs
   `fetch(url, { method: 'POST' }).catch(() => {})` aufrufen. Das Intervall ist
   24 Std. plus 1 Std. Kulanz. Einen Test in `test/` ergänzen: ohne URL kein
   Netzverkehr (wie bei `_alert.js`).
3. Alarm per Push-App. Ein Testalarm muss angekommen sein.

---

## 4. Browser-Fehler sichtbar machen

**Problem:** `js/error-logger.js` sammelt JS-Fehler nur im `localStorage`
(max. 50). Der Kommentar dort sagt selbst „extend `_send()` to POST“. Bei
Kunden auftretende Fehler sieht niemand.

**Umsetzung (datenschutzfreundlich, ohne Drittanbieter, passt zur strengen
CSP mit `connect-src 'self'`):**

1. Neuer Endpunkt `api/client-error.js`:
   - Nur `POST`, Body max. 4 KB, Rate-Limit pro IP über den vorhandenen
     Upstash-Mechanismus.
   - Nur erlaubte Felder speichern: `message` (gekürzt auf 300 Zeichen),
     `source`-Datei, Zeile, `APP_VERSION`, Zeitstempel. **Keine** Nutzerdaten,
     keine Beträge, keine Kundennamen, keine vollständige URL mit Query.
   - Ablage wie bei den Alerts als Blob unter `stackr/client-errors/JJJJ-MM-TT/`
     oder als Zähler pro Fehler-Hash in Redis.
   - Aufbewahrung: `blob-cleanup` löscht Einträge nach 30 Tagen.
2. `_send()` in `js/error-logger.js`: `navigator.sendBeacon('/api/client-error', …)`,
   dedupliziert (gleicher Fehler max. 1× pro Sitzung) und nur im
   Web-Build, nicht in der Local-Version.
3. Täglich eine Zusammenfassung über den bestehenden Alert-Weg: „N neue
   Fehlertypen gestern“.
4. `datenschutz.html` um den Abschnitt „Fehlerprotokolle“ ergänzen
   (berechtigtes Interesse, Inhalt, 30 Tage). Mit `/datenschutz` prüfen.
5. Tests: Die Feld-Whitelist entfernt unbekannte Felder, ein zu großer Body ergibt 413,
   und das Rate-Limit greift.

---

## 5. Server-Logs strukturieren (klein)

`console.error` in `api/*` auf ein festes Format umstellen, z. B.
`console.error(JSON.stringify({ code: "SYNC_REDIS_DOWN", route: "sync" }))`.
Dann lassen sich die Fehler im Vercel-Log gezielt filtern. Keine Tokens und
keine Nutzerdaten ins Log schreiben (mit `/security-stackr` gegenprüfen).

---

## Checkliste

- [x] 1a CI-Workflow + CLAUDE.md (7df6ac9) — grün/rot erst nach Push belegbar
- [ ] 1b Branch-Schutz auf GitHub (User)
- [x] 2a `ALERT_WEBHOOK_URL` gesetzt (2026-09-13)
- [ ] 2b Selbsttest mit `CRON_SECRET` ausgelöst, Mail angekommen (User)
- [x] 3a `api/health.js` + Heartbeat im Cron (40a78d8)
- [ ] 3b Konten: UptimeRobot (`/`, `/app`, `/api/health`), healthchecks.io + Env `HEARTBEAT_URL_BLOB_CLEANUP`, Testalarm (User)
- [x] 4a Serverteil: `api/client-error.js`, Redis-Zähler mit 30 Tagen TTL, Tagesmeldung im Cron
- [ ] 4b Client `_send()` + Datenschutz: liegt fertig im Working Tree (`js/error-logger.js`,
      `test/test-error-logger-beacon.js`), Text in `plan/datenschutz-fehlerprotokolle-entwurf-2026-09-29.md`
      — wartet auf Freigabe und auf den Commit der Barrierefreiheit-Session an `datenschutz.html`
- [x] 5 Strukturierte Fehlercodes in `api/*` (c9e631e, `api/_log.js`)
- [ ] `plan/OFFEN.md` und `plan/00-STAND.md` nachgezogen
