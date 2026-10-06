# Supabase-Umzug: Upstash Redis + Vercel Blob → Supabase

Stand: 2026-10-06, **gegen den Code geprüft**, nicht gegen den Plan.
Der Gesamtplan liegt außerhalb des Repos (`Desktop/CFC/STACKR_PLAN_2026-10-06.md`, Phase 1).
Diese Datei beschreibt nur den Speicher-Umzug und hält fest, wer was macht.

## Entscheidungen (User, 2026-10-06)

| | Entscheidung |
|---|---|
| E1 | **E2E bleibt.** Supabase speichert nur Chiffrat. Fremddaten (Shopify, Bank) später per Sealed Box mit dem Nutzer-Pubkey |
| E2 | **Whop bleibt** Login und Zahlung. Supabase kennt nur die Whop-`user_id` |
| E3 | **Kein `supabase-js`**, kein `tweetnacl`. Zugriff nur aus `api/` per `fetch` auf PostgREST/Storage, Service-Key nie im Browser |
| E5 | Eigene Projekte `stackr-prod` + `stackr-preview`, Frankfurt (eu-central-1), Pro-Plan |

## Was es schon gibt — Sync (Commit `d5385fd`, nur lokal, **nicht deployt**)

| Datei | Inhalt |
|---|---|
| `supabase/migrations/20261006000001_sync.sql` | 6 Tabellen (`sync_snapshots`, `sync_scopes`, `sync_anchors`, `public_keys`, `grants`, `rate_limits`), RLS an, `anon`/`authenticated` ohne Rechte, je Operation eine Postgres-Funktion (CAS, Scope-/Grant-Deckel atomar), `execute` nur für `service_role` |
| `api/_db.js` | PostgREST-Aufruf per `fetch` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) |
| `api/_sync-store.js` | Adapter Redis \| Supabase. `STORAGE_BACKEND` wählt Lesequelle + CAS, `STORAGE_MIRROR` bekommt jede erfolgreiche Schreibung zusätzlich. Spiegel-Fehler brechen keinen Request ab, sie gehen an `_alert.js` |
| `api/sync.js` | spricht den Speicher nur noch über den Adapter an |
| `scripts/backfill-sync-supabase.js` | Trockenlauf / `--write` / `--check` (Exit 1 bei Abweichung), gibt nie Inhalte aus |
| `test/test-sync-store.js` | rpc-Aufrufe gegen die Migration, Spiegel-Verhalten |

- **Ohne neue Env-Variablen ändert sich nichts**: Default bleibt `STORAGE_BACKEND=redis`, kein Spiegel. Deployen ist also gefahrlos.
- `d5385fd` lässt sich ohne Konflikt auf `origin/master` (Stand `0a46f82`) setzen, geprüft mit `git merge-tree`.
- Das SQL lief bisher nur gegen **PGlite**, noch nie gegen ein echtes Supabase.

## Was es schon gibt — Belege/Storage (Commit `4d96b9b`, nur lokal, **nicht deployt**)

Privater Bucket, signierte URLs. Umschalten per `BLOB_BACKEND=supabase`; ohne die Variable ändert sich nichts.

| Datei | Inhalt |
|---|---|
| `api/_storage.js` | Supabase-Storage-Zugriff per `fetch` |
| `api/blob-upload.js` | Storage-Backend + neue `action=sign` (Steuerberater nur mit Grant) |
| `api/blob-cleanup.js` | Cron auf Storage |
| `js/blob-attachments.js`, `js/cloud-sync.js` | Abruf über signierte URLs, `owner`-Weitergabe für den Steuerberater |
| `supabase/migrations/20261006000002_storage.sql` | Bucket + Rechte |
| `scripts/backfill-blob-supabase.js`, `test/test-blob-storage.js` | Altbestand kopieren, Tests |

**Vor `BLOB_BACKEND=supabase` Pflicht:**
- CSP in `vercel.json`: `connect-src` in **allen** Routen um `https://*.supabase.co` ergänzen. Die Datei ist gerade durch die Barrierefreiheits-Arbeit (neue Route `/barrierefreiheit.html`) uncommittet geändert, erst danach anfassen.
- Supabase: projektweite Upload-Grenze auf mindestens 200 MB stellen (👤).

Byte-Budget, Commit-Sperre und Rate-Limit in `blob-upload` laufen weiter über Redis (Schritt 2 unten).

## Wichtig: Phase 1 zieht nur den Sync um

Upstash und Vercel Blob hängen an viel mehr als `api/sync.js`. **Abschalten lässt sich erst, wenn alle Zeilen unten umgezogen sind.**

### Upstash Redis — wer es heute noch benutzt

| Endpunkt | Wofür | Umzug |
|---|---|---|
| `api/sync.js` | Snapshots, Scopes, Anker, Pubkeys, Grants, Rate-Limit | ✅ Adapter fertig |
| `api/whop-token.js` | Login: IP-Rate-Limit, legt Refresh-Sitzung `whoprt:<sid>` an | offen |
| `api/whop-refresh.js` | Refresh-Sitzungen (TTL), Sperre gegen doppelte Rotation, Rate-Limit | offen — **kritisch**: fällt das aus, fliegen Kunden stündlich raus |
| `api/whop-access.js` | IP-Rate-Limit | offen |
| `api/blob-upload.js` | Byte-Budget je Nutzer, Commit-Sperre, Rate-Limit | offen (mit Storage zusammen) |
| `api/client-error.js` + `api/_client-errors.js` | Browser-Fehler zählen, Tagesmeldung | offen |
| `api/health.js` | prüft **nur** Redis | offen — muss danach Supabase prüfen |

### Vercel Blob — wer es heute noch benutzt

| Endpunkt | Wofür | Umzug |
|---|---|---|
| `api/blob-upload.js` | Belege/Anhänge + übergroße Sync-Chiffrate (put/del/list, Chunk-Upload) | ✅ `4d96b9b` |
| `api/blob-cleanup.js` | Cron: verwaiste Chunks löschen, Heartbeat | ✅ `4d96b9b` |
| `api/_alert.js` | schreibt Alarm-Log nach Blob (zweites Ziel neben Make) | offen — fällt sonst mit Blob weg |
| `js/blob-attachments.js` (Client) | lädt Chiffrat über öffentliche Blob-URLs | ✅ `4d96b9b`, signierte URLs |

`@vercel/blob` (einzige Produktiv-Abhängigkeit) kann erst raus, wenn alle drei Server-Dateien umgestellt sind.

## Ablauf Sync-Umzug (Schritt für Schritt)

Rollen: 👤 = User (Konten, Schlüssel, Vercel-Dashboard), 🤖 = Claude (Code, Tests, Prüfungen).

| # | Schritt | Wer | Erledigt wenn |
|---|---|---|---|
| 0 | Supabase-Projekte `stackr-prod` + `stackr-preview` anlegen (Frankfurt, Spend Cap, 2FA), AV-Vertrag abschließen | 👤 | Projekte da |
| 1 | Migration in **beiden** Projekten ausführen (SQL-Editor oder CLI) | 👤, 🤖 liefert Anleitung | Tabellen + Funktionen sichtbar, `anon` sieht nichts |
| 2 | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in Vercel eintragen (Sensitive), getrennt für Production und Preview | 👤 | Claude liest die Werte nie aus |
| 3 | `d5385fd` deployen (cherry-pick auf `origin/master`, wie heute bei den Token-Fixes) | 🤖 | live, Verhalten unverändert |
| 4 | `STORAGE_MIRROR=supabase` setzen, neu deployen → Dual-Write | 👤 | keine `mirror-failed`-Alarme |
| 5 | Backfill `--write`, dann `--check` (lokal, mit den Prod-Env-Werten) | 👤 führt aus, 🤖 begleitet | `--check` Exit 0 |
| 6 | Einige Tage beobachten, `--check` erneut | 👤/🤖 | stabil, keine Abweichung |
| 7 | Umschalten: `STORAGE_BACKEND=supabase`, `STORAGE_MIRROR=redis` | 👤 | Sync läuft, Rückweg = Variablen tauschen |
| 8 | 14 Tage beobachten, dann `STORAGE_MIRROR` leeren | 👤 | — |
| 9 | DSE, Verarbeitungsverzeichnis, `CLOUD-SYNC.md`, Landing-Text anpassen | 🤖 Entwurf, 👤 Freigabe | erst **beim** Umschalten, nicht vorher |

## Risiken und Fallen

- **Preview und Production teilen Redis** (Commit `36be024`). Setzt man in Preview `STORAGE_MIRROR=supabase` mit dem Preview-Projekt, landen **Produktionsdaten** (Chiffrat) im Preview-Projekt. Backfill daher nur Prod-Redis → `stackr-prod`. Für Preview entweder eigenes Redis oder den Spiegel dort nicht setzen.
- **Spiegel-Ausfall = stiller Drift.** Ein fehlgeschlagener Spiegel-Write bricht den Request nicht ab. Schutz: Alarm + `--check` vor dem Umschalten (Schritt 6/7).
- **jsonb ordnet Objektschlüssel um.** Vergleiche immer schlüsselsortiert (der Backfill-Check macht das).
- **Größe:** Inline-Chiffrat bis ~3,5 MB pro Scope als jsonb-String. Ab dem 2026-10-20 schreibt der Client gzip-komprimiert (Commit `b648d34`), das entlastet auch Supabase.
- **Whop-Refresh-Sitzungen** sind der empfindlichste Teil. Erst umziehen, wenn der Sync-Umzug stabil läuft.

## Reihenfolge danach (Vorschlag)

1. Sync (oben), komplett bis Schritt 8.
2. Rate-Limits + Fehlerzähler (`whop-token`, `whop-access`, `client-error`) auf `sync_rate_hit` bzw. eine kleine Tabelle. Geringes Risiko.
3. `api/health.js` prüft Supabase (und so lange beides läuft, auch Redis).
4. Whop-Refresh-Sitzungen (`whop-token`, `whop-refresh`): Tabelle mit Ablaufzeit + Sperre per Postgres-Funktion.
5. Storage: Code fertig (`4d96b9b`). Offen: CSP, Upload-Grenze, Backfill der Blob-Dateien, Umschalten.
6. `_alert.js`: zweites Alarmziel neu wählen (Supabase-Tabelle?).
7. Upstash abschalten, `@vercel/blob` entfernen, Rechtstexte final.

## Offene Fragen an den User

1. Sind die Supabase-Projekte schon angelegt? (Blockiert Schritt 1–2.)
2. Preview: eigenes Redis anlegen oder in Preview einfach **keinen** Spiegel setzen? (Empfehlung: keinen Spiegel, Preview testet gegen `stackr-preview` mit eigenen Testdaten.)
3. Dürfen `d5385fd` und `4d96b9b` jetzt deployt werden? Ohne Env-Variablen ändern sie nichts. Die Session „STACKR_PLAN_2026-10-06“ hat sie gebaut.
