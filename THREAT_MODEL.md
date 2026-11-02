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
| Nutzer A liest Daten von Nutzer B | RLS an ohne Policy (kein Direktzugriff), Zugriff nur über `api/` mit Nutzer-ID aus dem Token | `test-migration-rechte.js`, `test-server-store.js` |
| Zugriff ohne Abo / mit widerrufenem Token | Whop-Prüfung, signiertes Grace-Token | `test-whop-access.js`, `test-whop-refresh-widerruf.js` |
| Rate-Limit-Umgehung auf `api/*` | Redis-Rate-Limit; Fehlen alarmiert | `test-rate-limit-backend.js`, `test-api-grenzen.js` |
| XSS / Script-Injection | CSP pro Route in `vercel.json`, `script-src 'self'` | `test-csp-*.js` |
| Verwundbare Abhängigkeit | genau eine Prod-Abhängigkeit, `npm audit` + Signaturprüfung in CI | `tests.yml` |
| Manipuliertes Vendor-Skript (xlsx) | lokal in `js/vendor/`, SHA-256 in `VERSIONS.md` | `test-vendor-xlsx-api.js` |
| Geleaktes Secret im Repo | Secret-Scan in `tests.yml` (nur bekannte Token-Formate, kein gitleaks) | CI |
| Falsche Cron-/Alarmkonfiguration bleibt unbemerkt | `api/_alert.js`, Heartbeat (Env fehlt noch) | `test-alert-*.js` |
| Agent committet fremde Hunks | CLAUDE.md Regeln 1–2, deny-Regeln für `git add -A` | manuell |
| Agent führt Zerstörendes aus (`rm -rf`, Force-Push, `reset --hard`) | Hook `block-dangerous.sh`: **noch nicht aktiv** | – |

## Sensible Daten

- Rechtsgrundlage / Verträge: Whop-DPA und AV-Verträge offen; Anwalt-Freigabe offen
- Aufbewahrung und Löschung: 30 Tage nach Vertragsende entschieden, nicht gebaut (bestätigt 2026-11-02)
- Backup Supabase (Pro): ungeprüft, im Dashboard nachsehen
- Verschlüsselung: in Transit TLS (HSTS); at rest Chiffrat (Sync) bzw. Supabase-Standard `TODO(confirm)`
- Zugriffsprotokoll: Audit-Log je Firma im Store (GoBD); Server-Zugriffslog `TODO(confirm)`
- Meldeweg bei Datenpanne: der Inhaber meldet selbst an die zuständige Aufsichtsbehörde (Art. 33 DSGVO, binnen 72 h); Kontaktdaten der Behörde `TODO(confirm)`

## Notschalter

- Agent-Zugriff entziehen: Tokens/Connectoren widerrufen
- Deployments stoppen: Vercel-Projekt pausieren bzw. Git-Integration trennen
- Secrets rotieren: Vercel-Env, Supabase-Keys, Whop-Keys (nur der User)

Zuletzt geprüft: 2026-11-02
