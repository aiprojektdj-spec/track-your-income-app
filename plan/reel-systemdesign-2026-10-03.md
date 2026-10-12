# Reel „Who's gonna tell vibe coders about…“: Abgleich Stackr (03.10.2026)

## Quelle

[techwithprateek, 06.06.2026](https://www.instagram.com/reel/DZP6Pi9S1Gu/), 14 Sekunden.
Caption: „AI writes code. Developers build systems.“ Im Video blenden 33 Begriffe nacheinander ein,
am Ende steht: „do you still think AI can replace developers?“

**Kernaussage:** Den Code kann die KI schreiben. Ob das System hält, entscheiden Architektur,
Datenkonsistenz, Ausfallverhalten und Betrieb.

**Abgrenzung:** Das Reel von jaygohel (15 Schichten) ist schon in
[reels-sicherheit-2026-10-03.md](reels-sicherheit-2026-10-03.md) ausgewertet. Die offenen Punkte
von dort (11 Commits ungepusht, Vercel Pro, Branch-Schutz, UptimeRobot, Datenschutz-Abschnitt
Fehlerprotokolle) gelten weiter und werden hier nicht doppelt geführt.

## Abgleich Begriff für Begriff

| Begriff | Status Stackr | Fundstelle / Begründung |
|---|---|---|
| consistency / eventual consistency | ✅ stark | `js/cloud-sync.js`: Pull → 3-Wege-Merge gegen Base → Push. Echte Kollisionen behalten beide Fassungen (`oyi_sync_conflicts`). Löschungen werden über `_mergeRecords` an alle Geräte weitergegeben |
| ACID | ✅ | `api/sync.js`: Compare-and-Swap per Lua-Skript (`version` muss passen, sonst 409 `version_conflict`). Der Client wiederholt dann |
| encryption | ✅ stark | Ende-zu-Ende: Server speichert nur `{ ciphertext, iv, version }`, Schlüssel bleibt im Browser |
| circuit breaker | ✅ | Alle externen Aufrufe in `api/*` haben `AbortSignal.timeout` (2 bis 15 s). Kommentar in `sync.js:185`: „timeout = lazy circuit breaker“ |
| rate limiting | ✅ | in `sync.js`, `blob-upload.js`, `whop-*.js`, `client-error.js` |
| database design / indexing | ✅ passt | Upstash Redis, ein Schlüssel pro Nutzer und Scope, Scope- und Grant-Limits (409 `scope_limit` / `grant_limit`). Indexe braucht ein Key-Value-Store nicht |
| observability | 🟡 | `api/_log.js` (JSON + Fehlercode), `api/client-error.js`, Tagesmeldung im Cron. Nicht live → reels-sicherheit |
| availability | 🟡 | `api/health.js` vorhanden, Uptime-Monitor fehlt → reels-sicherheit. Local-first: Fällt Upstash aus, arbeitet die App lokal weiter |
| **caching / CDN / deployment** | 🔴 **Lücke** | `/js/*.js` wird 1 h gecacht (`vercel.json`), die Dateien haben aber **keine Version im Namen** (`src="js/actions.js"`) → Fix F1 |
| CI/CD / git / cherry-picking | 🔴 | `master` ist 11 Commits voraus, der Working Tree ist schmutzig → reels-sicherheit (Push freigeben) |
| serverless compute | ✅ | Vercel Functions in `api/` |
| REST | ✅ | `api/*.js` |
| throughput | ✅ | Paginierte Whop-Abfragen (`per=50`), Blob-Cleanup per Cron |
| load balancer, kubernetes, micro services, sharding, partitioning, forward proxy | ⚪ bewusst nicht | Übernehmen Vercel und Upstash. **Nicht bauen** |
| DynamoDB, elasticsearch, RabbitMQ, SQS, message queues, GraphQL, websockets, SFTP, tensorflow | ⚪ nicht relevant | Kein Bedarf bei einer Local-first-App mit verschlüsseltem Sync. Die OCR läuft lokal |

**Ergebnis:** Bei Konsistenz und Verschlüsselung ist Stackr weiter, als das Reel unterstellt.
Neu ist ein Fix (F1). Der Rest ist erledigt oder steht schon in reels-sicherheit.

## Fixes

### F1: JS-Cache nach Deploy (gemischte Versionen) 🔴

**Problem:** `vercel.json` setzt für `/js/(.*).js` den Header `Cache-Control: public, max-age=3600`.
Die Skripte werden ohne Versionsangabe eingebunden (`<script src="js/actions.js">`). Nach einem
Deploy lädt der Browser bis zu eine Stunde lang **neues HTML mit teils alten JS-Dateien**.
Mögliche Folgen:
- `ReferenceError`, weil eine neue Funktion in einer noch alten Datei fehlt
- veraltete Merge-Logik in `cloud-sync.js` gegen den neuen Server
- Rechnungs- und Steuerlogik in unterschiedlichen Ständen

`js/vendor/*` (eine Woche Cache) ist unkritisch, solange sich Vendor-Dateien nur mit neuem
Dateinamen ändern.

**Fix (einfachste Variante):** In `vercel.json` den Block für `/js/(.*).js` ändern auf

```json
{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
```

Vercel liefert ETags. Der Browser fragt kurz nach und bekommt `304`, solange sich nichts geändert hat.
Der Aufwand ist minimal, das Risiko gering.

**Alternative (besser bei vielen Dateien):** `build-deploy.py` hängt an jedes
`src="js/…"` in den HTML-Seiten ein `?v=<git-short-hash>` an. Dann kann `max-age` bleiben.
Nur machen, wenn Lighthouse wegen der Revalidierung messbar schlechter wird.

**Prüfen:**
- [ ] `test/` hat einen Test auf `vercel.json`? Wenn ja, Erwartung anpassen. Wenn nein,
      einen kleinen Test ergänzen: Kein Pfad unter `/js/` außer `/js/vendor/` hat `max-age > 0`.
- [ ] Gilt das auch für `/css/`? Gleiche Regel prüfen, sobald dort ein Cache-Header gesetzt wird.
- [ ] Nach dem Deploy in den DevTools → Network prüfen: `js/actions.js` liefert `304` mit `must-revalidate`.

**Fertig, wenn:** Tests grün, zusammen mit den 11 offenen Commits gepusht (Freigabe durch dich),
Header live geprüft.

### Optional (nur prüfen)

- [ ] Upstash-Konsole: Sind Backups oder Persistenz aktiv? Durch Local-first ist ein Datenverlust
      unwahrscheinlich, weil die Geräte die Daten neu hochladen. Ein Nutzer mit nur einem
      gelöschten Gerät wäre aber betroffen. Eine Zeile dazu in `CLOUD-SYNC.md`.

## Fertig, wenn

- [ ] F1 live
- [ ] Offene Punkte aus reels-sicherheit (Push, Pro, Branch-Schutz, Monitoring) laufen dort weiter
