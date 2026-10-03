# Stackr: Abgleich mit 15 weiteren Sicherheitsthemen (03.10.2026)

Anlass ist ein Instagram-Kommentar unter einem Reel über Sicherheitslücken in vibe-gecodeten Apps.
Er nennt diese Themen: Dependency-/Supply-Chain-Sicherheit, CSRF/CORS, XSS, SSRF,
Prompt-Injection/KI-Datenabfluss, Malware/File-Uploads, Backup-Verschlüsselung, Restore,
Audit-Logs, PII in Logs, Datenlöschung/Export, Dependency-Pinning, Dev/Prod-Trennung,
Incident Response und KI-Anbieter-Datenflüsse.

Geprüft wurde gegen den Code auf `master` (`6494b23`). Das CFC-Gegenstück steht in
`Desktop/CFC/wertenetz-mvp/docs/SICHERHEIT_15_PUNKTE_2026-10-03.md`.

## Ergebnis

| # | Thema | Status | Beleg im Code | Was fehlt |
|---|-------|--------|---------------|-----------|
| 1 | Dependency-/Supply-Chain | 🟡 | Genau eine Abhängigkeit (`@vercel/blob`); Bibliotheken liegen in `js/vendor/` mit SHA-256 in `VERSIONS.md`; CI: `npm audit --omit=dev --audit-level=high` | Kein Dependabot, keine Prüfung der npm-Signaturen. **Wird umgesetzt** |
| 2 | CSRF / CORS | ✅ | API-Aufrufe tragen das Whop-Token im `Authorization`-Header, nicht als Cookie, also kein CSRF-Hebel. CORS fest auf `https://track-your-income-app.vercel.app`; `/api/client-error` nur gleiche Origin | – |
| 3 | XSS | 🟡 | Strenge CSP pro Seite in `vercel.json`; letzte unescapte `innerHTML`-Stellen in `e85fda6` behoben | `e85fda6` ist **nicht gepusht**, also nicht live |
| 4 | SSRF | ✅ | Einziger Abruf einer Client-URL: `commit` in `api/blob-upload.js`. Davor Host-Whitelist (`*.public.blob.vercel-storage.com`) und Pfadprüfung auf den eigenen Namespace | Weiterleitungen werden noch gefolgt. **Wird umgesetzt:** `redirect: 'error'` |
| 5 | Prompt-Injection / KI-Datenabfluss | ➖ nicht relevant | Kein Sprachmodell. Belegerkennung ist Tesseract im Browser (`js/beleg-ocr.js`), nichts verlässt das Gerät | – |
| 6 | Malware / File-Uploads | ✅ | Server speichert nur Chiffrat als `application/octet-stream`; 4 MB je Request, 200 MB je Datei, 10 GB je 30 Tage | – |
| 7 | Backup-Verschlüsselung | ✅ | `js/backup-crypto.js`: Backups Ende-zu-Ende verschlüsselt; Cloud-Sync nur Chiffrat | – |
| 8 | Restore | ✅ | `test/test-backup-crypto-restore.js` läuft in jeder CI | – |
| 9 | Audit-Logs | ✅ | GoBD-Protokoll im Client (`js/protokoll.js`). Der Server sieht nur Chiffrat; ein Server-Protokoll über Nutzerinhalte gäbe es nicht her | – |
| 10 | PII in Logs | ✅ | `api/_log.js` loggt nur festen Code + gekürzte `err.message`; `api/_client-errors.js` ersetzt E-Mails und Ziffernfolgen, speichert keine IP, keinen Stack, keine URL | – |
| 11 | Datenlöschung / Export | ✅ | `sync.js` `reset_all`, `blob-upload.js` `purge`; Export als Backup, CSV und DATEV | – |
| 12 | Dependency-Pinning | ✅ | `package-lock.json` + `npm ci`; Actions auf Commit-SHA; Vendor-Dateien mit Prüfsumme | – |
| 13 | Dev/Prod-Trennung | 🔴 prüfen | Lokale `.env.local` (Ziel `preview`) enthält `BLOB_READ_WRITE_TOKEN`, `KV_REST_API_TOKEN`, `WHOP_API_KEY`, `WHOP_CLIENT_SECRET` | Lokal braucht die statische Seite keinen davon. Ob Preview denselben Redis-/Blob-Speicher wie Production nutzt, ist offen (unten) |
| 14 | Incident Response | 🔴 | Alarmweg vorhanden (`api/_alert.js`), aber kein Ablaufplan | **Wird umgesetzt:** `plan/incident-response.md` |
| 15 | KI-Anbieter-Datenflüsse | ✅ | Produkt: keine. Entwicklung: dieselbe Regel wie in CFC, steht im Ablaufplan | – |

## Was ich umsetze

1. `.github/dependabot.yml` für npm und GitHub Actions (wöchentlich, montags).
2. CI-Schritt `npm audit signatures` in `.github/workflows/tests.yml`.
3. `api/blob-upload.js`: `fetch(u, { redirect: 'error' })` beim Zusammensetzen der Chunks.
4. `plan/incident-response.md`: Ablauf, Schlüsselliste, 72-Stunden-Frist.

Commits nur pfad-gescoped auf `master`, **kein Push**: ein Push löst ein Production-Deploy aus.

## Was du entscheiden musst

### Push der wartenden Commits (Punkt 3 und mehr)

`master` ist 11 Commits vor `origin/master`, darunter die XSS-Härtung `e85fda6` und
`67fc5c5` (`plan/` nicht mehr öffentlich). Mit diesem Paket kommen vier weitere dazu.
Ein Push geht direkt live. Siehe auch `plan/reels-sicherheit-2026-10-03.md`.

### Dev/Prod-Trennung (Punkt 13)

1. In Vercel → **Storage**: Bei Upstash-Redis und Blob-Store nachsehen, für welche Umgebungen sie
   verbunden sind. Hängen Preview und Production am selben Speicher, schreiben Preview-Deploys in
   echte Kundendaten (Chiffrat, Rate-Limits, Whop-Tokens).
   **Empfehlung:** für Preview einen eigenen Redis und Blob-Store anlegen oder die Verbindung für
   Preview lösen.
2. Lokal die Production-Schlüssel aus `.env.local` entfernen. Die Seite läuft lokal über
   `python -m http.server` und braucht sie nicht.
