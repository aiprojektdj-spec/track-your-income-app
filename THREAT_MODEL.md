# Bedrohungsmodell

> Eine Seite. Bei jeder Architektur- oder Datenänderung neu prüfen. Aus dem Code abgeleitet;
> Zeilen mit `TODO(confirm)` hat der User noch nicht bestätigt.

## Was wir schützen

| Wert | Warum | Schutzbedarf |
| --- | --- | --- |
| Buchhaltungsdaten (Belege, Rechnungen, Kundendaten) | Personenbezug, steuerrelevant, GoBD-Aufbewahrung | hoch |
| Whop-Tokens und Sitzungen | Zugang und Abo-Status | hoch |
| Server-Secrets (`CRON_SECRET`, Service-Key, Blob-Token, Shopify-Secret) | voller Datenzugriff | hoch |
| Cloud-Sync-Chiffrat und Blob-Anhänge | Verfügbarkeit, Budget (20 GB) | mittel |
| Quellcode und Vercel-Deployment | Auslieferung an alle Nutzer | hoch |

## Wer könnte angreifen

- Externe (Scans, Credential-Stuffing, Missbrauch offener Endpunkte)
- Ein Nutzer, der auf fremde Daten zugreifen will (IDOR, Mandantentrennung)
- Kompromittierte Abhängigkeit oder CDN-Skript (SheetJS, tesseract.js)
- Ein Coding-Agent mit zu weiten Rechten (mehrere Sessions im selben Working Tree)

## Angriffspfade und Kontrollen

| Pfad | Kontrolle | Getestet durch |
| --- | --- | --- |
| Nutzer A liest Daten von Nutzer B | Server-Tabellen: RLS über `company_members` und `stackr.user` (Rolle `stackr_app`, NOBYPASSRLS); Sync-Tabellen: RLS ohne Policy, nur `api/` mit Service-Key | `test-migration-rechte.js`, `test-server-store.js` |
| Zugriff ohne Abo / mit widerrufenem Token | Whop-Prüfung, signiertes Grace-Token | `test-whop-access.js`, `test-whop-refresh-widerruf.js` |
| Rate-Limit-Umgehung auf `api/*` | Redis-Rate-Limit; Fehlen alarmiert | `test-rate-limit-backend.js`, `test-api-grenzen.js` |
| XSS / Script-Injection | CSP pro Route in `vercel.json`, `script-src 'self'` | `test-csp-*.js` |
| Verwundbare Abhängigkeit | genau eine Prod-Abhängigkeit, `npm audit` + Signaturprüfung in CI | `tests.yml` |
| Manipuliertes Vendor-Skript (xlsx) | lokal in `js/vendor/`, SHA-256 in `VERSIONS.md` | `test-vendor-xlsx-api.js` |
| Geleaktes Secret im Repo | Secret-Scan in `tests.yml` (nur bekannte Token-Formate, kein gitleaks) | CI |
| Falsche Cron-/Alarmkonfiguration bleibt unbemerkt | `api/_alert.js`, Heartbeat (Env fehlt noch) | `test-alert-*.js` |
| Agent committet fremde Hunks | CLAUDE.md Regeln 1–2, deny-Regeln für `git add -A` | manuell |
| Agent führt Zerstörendes aus (Löschen mit Force, Force-Push, harter Reset) | Hook `.claude/hooks/block-dangerous.sh` plus Deny-Regeln in `.claude/settings.json` (nur lokal, `.claude/` ist nicht im Repo) | manuell geprüft 2026-11-02 |

## Sensible Daten

- Rechtsgrundlage / Verträge: Whop-DPA und AV-Verträge offen; Anwalt-Freigabe offen
- Aufbewahrung und Löschung: 30 Tage nach Vertragsende, Löschlauf gebaut (`api/_loeschung.js`), Standard ist Probelauf, scharf nur mit `SYNC_LOESCHUNG=aktiv`
- Backup Supabase (Pro): tägliche Backups (vom User bestätigt 2026-11-03); PITR und Restore-Test ungeprüft
- Verschlüsselung: in Transit TLS (HSTS); Sync-Daten als Chiffrat; Supabase-Daten at rest nach Herstellerangabe verschlüsselt (nicht selbst geprüft)
- Zugriffsprotokoll: `audit_log` je Firma, insert-only mit Hash-Kette (Datenbank-Trigger); Server-Zugriffe nur in den Vercel-Logs (Aufbewahrung je Plan)
- Meldeweg bei Datenpanne: der Inhaber meldet selbst an die zuständige Aufsichtsbehörde (Art. 33 DSGVO, binnen 72 h); zuständig ist der LfDI Baden-Württemberg (Sitz des Betreibers: Fronreute). Online-Meldung unter https://www.baden-wuerttemberg.datenschutz.de/datenpanne-melden/ , Heilbronner Straße 35, 70191 Stuttgart, Tel. 0711/61 55 41-0, poststelle@lfdi.bwl.de (Stand 2026-11-03, von der Behörden-Website)

## Notschalter

- Agent-Zugriff entziehen: Tokens/Connectoren widerrufen
- Deployments stoppen: Vercel-Projekt pausieren bzw. Git-Integration trennen
- Secrets rotieren: Vercel-Env, Supabase-Keys, Whop-Keys (nur der User)

Zuletzt geprüft: 2026-11-05
