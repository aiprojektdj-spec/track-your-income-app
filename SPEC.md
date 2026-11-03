# Spec

> Kurz und aktuell halten. Wird zu Sessionbeginn gelesen. Alles mit `TODO(confirm)` ist aus dem
> Code abgeleitet und noch nicht vom User bestätigt. Offene Arbeit steht in `plan/01-AUFGABEN.md`.

## Ziel

Stackr ist Buchhaltung für Selbstständige, Kleinunternehmer und GbR (DE): Belege, Rechnungen
(inkl. XRechnung), EÜR, USt-Voranmeldung, DATEV-Export, Lager und Shopify-Import. Auth und
Zahlung über Whop. Richtung seit 2026-10-21: Server führt, Daten lesbar (Supabase).

## Invarianten – was nie passieren darf

Jede Invariante soll im Code erzwungen UND durch einen Test in `test/` abgedeckt sein.
Spalte „Test“ nennt vorhandene Harnesses; `TODO(confirm)` = Zuordnung ungeprüft.

| ID | Invariante | Erzwungen durch | Test |
| --- | --- | --- | --- |
| INV-1 | Festgeschriebene Buchungen werden nie geändert oder gelöscht, nur storniert (GoBD) | Client: `canEdit`/Periodensperre in `js/store.js` (geprüft 2026-11-02); Server-Seite `TODO(confirm)` | `test-store-gobd-fixes.js`, `test-sync-gobd-merge.js` |
| INV-2 | Ein Nutzer sieht nie Daten eines anderen Nutzers (Mandantentrennung) | RLS an, **ohne Policy** (Sync-Tabellen): Zugriff nur über `api/` mit Service-Key und Nutzer-ID aus dem Token (geprüft 2026-11-02); neuere Server-Tabellen `TODO(confirm)` | `test-migration-rechte.js`, `test-server-store.js` |
| INV-3 | Cloud-Sync speichert nur Chiffrat, solange Local-First gilt; Klartext erst nach dem Umzug `TODO(confirm)` | Client-Verschlüsselung, `api/sync.js` | `test-cloud-sync.js`, `test-api-sync.js` |
| INV-4 | Ohne gültigen Whop-Zugang kein Zugriff auf `api/*`-Daten; Steuerberater-Zugang ist read-only `TODO(confirm)` | `api/_auth.js`, `api/whop-access.js` | `test-whop-access.js`, `test-stb-readonly-sperre.js` |
| INV-5 | Steuer-Gesetzeswerte kommen aus Jahresfunktionen, nie aus jahresfesten Konstanten | Konvention (CLAUDE.md Regel 7) | `test-steuerregeln-jahr.js`, `test-ksa-jahresabhaengig.js` |
| INV-6 | Rechnungen enthalten alle Pflichtangaben nach §14 UStG; Kleinunternehmer-Konten/-Hinweise korrekt `TODO(confirm)` | Rechnungs-Validierung | `test-rechnung-pflichtangaben-audit.js`, `test-xrechnung-regeln.js` |
| INV-7 | Nach Vertragsende werden Serverdaten nach 30 Tagen gelöscht (entschieden 2026-10-26, **noch nicht gebaut**, bestätigt vom User 2026-11-02) | offen | `test-loeschung.js` deckt nur Teile ab |

## Verträge

- Datenbank: `supabase/migrations/` (Schema und RLS)
- Endpunkte: `api/*.js` (kein OpenAPI; `none yet`)
- Sicherheits-Header und CSP pro Route: `vercel.json`
- Bewusste Nicht-Änderungen: `plan/02-ENTSCHEIDUNGEN.md`

## Operationen mit Folgen

| Operation | Wo | Idempotenz / Absicherung `TODO(confirm)` |
| --- | --- | --- |
| Zahlung / Abo (Whop) | Whop (Merchant of Record), `api/whop-*.js` | Whop-Event-ID; Nachweis offen |
| Kündigung | `api/kuendigung.js` | offen |
| Kontaktformular → E-Mail | `api/kontakt.js` | Rate-Limit; Idempotenz offen |
| Shopify-Import / Webhooks | `api/shopify-*.js` | `test-shopify-*.js` |
| Löschen von Nutzerdaten / Blobs | `api/_loeschung.js`, `api/blob-cleanup.js` (Cron 04:00 UTC) | `test-loeschung.js` |
| Alarm-Webhook (Make) | `api/_alert.js` | – |

Betrieb (Deploy, Backup, Alarmkette): `docs/OPERATIONS.md` (derzeit noch ungetrackt).

## Status der Aussagen

| Aussage | Status | Beleg |
| --- | --- | --- |
| Logik-Tests laufen bei jedem Push auf `master` und jedem PR | gemessen | `.github/workflows/tests.yml` |
| Rechtstexte freigegeben | geplant | Anwalt-Freigabe offen |
| Upstash-Redis-Backup | ungeprüft | `docs/OPERATIONS.md`, Abschnitt Backup |
| Supabase-Backup (Pro) | täglich, vom User bestätigt 2026-11-03; PITR und Restore-Test ungeprüft | Supabase-Dashboard |
