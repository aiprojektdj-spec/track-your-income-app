# API-Keys & Performance – Stackr (03.10.2026)

## Ziel

Kein Secret darf über den Browser, das Repo oder einen ungeschützten Vercel-Zugang
erreichbar sein. Dazu ein kurzer Performance-Check. Gegenstück für CFC:
`Desktop/CFC/wertenetz-mvp/docs/API_KEYS_PERFORMANCE_2026-10-03.md`.

## Inventar (aus `api/*.js`)

| Variable | Zweck | Gelesen in |
|---|---|---|
| `WHOP_API_KEY`, `WHOP_CLIENT_SECRET` | Whop-API / OAuth | `whop-token.js`, `whop-access.js`, `whop-refresh.js` |
| `WHOP_GRACE_PRIVATE_KEY` | Signatur der Gnadenfrist (nur Production) | Whop-Endpunkte |
| `WHOP_ACCESS_IDS`, `WHOP_OWNER_IDS`, `WHOP_OWNER_USERNAMES` | Zugriffs-/Owner-Listen | Whop-Endpunkte |
| `KV_REST_API_URL/_TOKEN`, `UPSTASH_REDIS_REST_URL/_TOKEN` | Cloud-Sync-Speicher | `sync.js` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (Belege) | `blob-upload.js`, `blob-cleanup.js` |
| `CRON_SECRET` | schützt Cron-Endpunkte | `blob-cleanup.js` |
| `ALERT_WEBHOOK_URL`, `HEARTBEAT_URL_BLOB_CLEANUP` | Alarmierung | `_alert.js`, Cron |
| `SYNC_OWNER_*`, `SYNC_MAX_*`, `BLOB_MAX_*` | Konfiguration | `sync.js`, Blob |

Alle werden nur **serverseitig** in `api/` gelesen. Das Frontend (`js/`, `*.html`) ist
statisch. Ein schneller Scan auf typische Key-Präfixe in `js/` und `*.html` war sauber
(nur Treffer wie `ksk_mitglied` in `ksk.js`, keine Keys).

## Checkliste Keys

- [x] **`.gitignore`**: enthält `.env*` und `.vercel` bereits (Ende der Datei, seit
      `4d74de9`). Der frühere Befund „fehlt" war falsch – nur die ersten Zeilen gelesen.
- [x] **Git-Historie** (03.10.): keine `.env`-Datei je getrackt oder hinzugefügt
      (`git ls-files`, `git log --all --diff-filter=A -- '.env*'`). Optional noch `npx gitleaks detect`.
- [ ] **Ausgeliefertes Frontend**: auf der Live-Seite DevTools → Sources → nach `token`,
      `secret`, `apik_`, `vercel_blob_rw` suchen
- [x] **`connect-src` `https://*.make.com`** wird gebraucht: Nutzer tragen in den
      Einstellungen eigene Make-Webhook-URLs ein (`js/app.js:1827`). Kein Betreiber-Key im
      Frontend, bleibt so.
- [ ] Blob-Upload: Client-Token kurzlebig und auf Pfad bzw. Größe beschränkt?
      (`blob-upload.js` prüfen)
- [ ] **Vercel**: alle Variablen auf **Sensitive**, 2FA an, Team-Mitglieder prüfen
- [ ] **Whop / Upstash / GitHub**: 2FA an
- [ ] Rotationsplan: Wann wurde welcher Key zuletzt erneuert? Tabelle in
      `plan/vercel-einrichtung.md` aktualisieren.
- [ ] Optional: Skill `/security-stackr` bzw. `/red-team` auf die Endpunkte laufen lassen

## Performance

- [ ] Skill `/performance-audit` ausführen
- [ ] Lighthouse mobil: Landing (`/`), `/app`
- [ ] Vercel Speed Insights an (mit Pro)
- [ ] `app.html` und `js/`: Bundle-Größe, ungenutzte Module, LocalStorage-Last bei vielen Belegen

## Ergebnis

| Punkt | Status | Maßnahme |
|---|---|---|
| | | |
