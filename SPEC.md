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
| INV-1 | Festgeschriebene Buchungen werden nie geändert oder gelöscht, nur storniert (GoBD) | Client: `canEdit`/Periodensperre in `js/store.js`; Server: Trigger `records_gobd_sperre` (SQLSTATE SR001) und insert-only `audit_log` mit Hash-Kette (`supabase/migrations/20261022000002_server_datenmodell.sql`, geprüft 2026-11-05). Neuanlage in gesperrter Periode bleibt bewusst erlaubt (§153 AO) | `test-store-gobd-fixes.js`, `test-sync-gobd-merge.js` |
| INV-2 | Ein Nutzer sieht nie Daten eines anderen Nutzers (Mandantentrennung) | Server-Tabellen: RLS-Policies für Rolle `stackr_app` (NOBYPASSRLS) über `company_members` und `stackr.user`; Sync-Tabellen: RLS ohne Policy, Zugriff nur über `api/` mit Service-Key (geprüft 2026-11-05). Die jüngsten `admin_*`-Tabellen haben RLS an, ihre Policies sind nicht einzeln geprüft | `test-migration-rechte.js`, `test-server-store.js` |
| INV-3 | Cloud-Sync (Redis/Blob) speichert nur Chiffrat. Die Server-Tabellen in Supabase halten bewusst lesbare Daten (Entscheidung 2026-10-21, `plan/02-ENTSCHEIDUNGEN.md`) | Client-Verschlüsselung, `api/sync.js` | `test-cloud-sync.js`, `test-api-sync.js` |
| INV-4 | Ohne gültigen Whop-Zugang kein Zugriff auf `api/*`-Daten; Schreiben in Firmendaten nur für Rolle `owner`, Steuerberater lesen nur (geprüft 2026-11-05) | `api/_auth.js`, `api/whop-access.js`; RLS-Policies `*_schreiben` mit `rolle = 'owner'` | `test-whop-access.js`, `test-stb-readonly-sperre.js` |
| INV-5 | Steuer-Gesetzeswerte kommen aus Jahresfunktionen, nie aus jahresfesten Konstanten | Konvention (CLAUDE.md Regel 7) | `test-steuerregeln-jahr.js`, `test-ksa-jahresabhaengig.js` |
| INV-6 | Rechnungen enthalten alle Pflichtangaben nach §14 UStG; Kleinunternehmer-Konten/-Hinweise korrekt `TODO(confirm)` | Rechnungs-Validierung | `test-rechnung-pflichtangaben-audit.js`, `test-xrechnung-regeln.js` |
| INV-7 | Nach Vertragsende werden Serverdaten nach 30 Tagen gelöscht | Gebaut: `api/_loeschung.js` (Vormerken, Mail ab Tag 23, Löschung Tag 30), Aufruf aus `api/blob-cleanup.js`. **Probelauf ist Standard**, scharf nur mit `SYNC_LOESCHUNG=aktiv`. **Nicht scharf:** `SYNC_LOESCHUNG` ist in Vercel nicht gesetzt (geprüft 2026-11-09), es läuft nur der Probelauf | `test-loeschung.js` |

## Verträge

- Datenbank: `supabase/migrations/` (Schema und RLS)
- Endpunkte: `api/*.js` (kein OpenAPI; `none yet`)
- Sicherheits-Header und CSP pro Route: `vercel.json`
- Bewusste Nicht-Änderungen: `plan/02-ENTSCHEIDUNGEN.md`

## Operationen mit Folgen

| Operation | Wo | Idempotenz / Absicherung (geprüft 2026-11-05) |
| --- | --- | --- |
| Zahlung / Abo (Whop) | Whop (Merchant of Record); `api/whop-*.js` prüft nur Zugang, kein Zahlungs-Webhook im Repo | nicht nötig: Buchung liegt bei Whop |
| Kündigung | `api/kuendigung.js`, Tabelle `kuendigungen` (bigserial, kein Unique-Schlüssel) | Rate-Limit je IP und Tag, fail-open; keine Idempotenz, Doppelte möglich |
| Kontaktformular → E-Mail | `api/kontakt.js` | Rate-Limit (5 je 10 min je IP, Tagesgrenze), fail-open; keine Idempotenz |
| Shopify-Import / Webhooks | `api/shopify-*.js` | HMAC-Prüfung des Rohbodys, Eingang je Bestellung über `sync_shopify_eingang_*`; `test-shopify-*.js` |
| Löschen von Nutzerdaten / Blobs | `api/_loeschung.js`, `api/blob-cleanup.js` (Cron 04:00 UTC) | `test-loeschung.js` |
| Alarm-Webhook (Make) | `api/_alert.js` | – |

Betrieb (Deploy, Backup, Alarmkette): `docs/OPERATIONS.md` (Stand 04.10.2026, teils überholt).

## Status der Aussagen

| Aussage | Status | Beleg |
| --- | --- | --- |
| Logik-Tests laufen bei jedem Push auf `master` und jedem PR | gemessen | `.github/workflows/tests.yml` |
| Rechtstexte freigegeben | geplant | Anwalt-Freigabe offen |
| Upstash-Redis-Backup | ungeprüft | `docs/OPERATIONS.md`, Abschnitt Backup |
| Supabase-Backup (Pro) | täglich, vom User bestätigt 2026-11-03; PITR und Restore-Test ungeprüft | Supabase-Dashboard |
