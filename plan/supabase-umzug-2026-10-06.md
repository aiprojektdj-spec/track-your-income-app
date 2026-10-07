# Supabase-Umzug: Upstash Redis + Vercel Blob → Supabase

Stand: 2026-10-07 abends, **gegen Code und Supabase-Konto geprüft** (per Supabase-Connector, nur lesend), nicht gegen den Plan.
Der Gesamtplan liegt außerhalb des Repos (`Desktop/CFC/STACKR_PLAN_2026-10-06.md`, Phase 1).
Diese Datei beschreibt nur den Speicher-Umzug und hält fest, wer was macht.

## Entscheidungen (User, 2026-10-06)

| | Entscheidung |
|---|---|
| E1 | **E2E bleibt.** Supabase speichert nur Chiffrat. Fremddaten (Shopify, Bank) später per Sealed Box mit dem Nutzer-Pubkey |
| E2 | **Whop bleibt** Login und Zahlung. Supabase kennt nur die Whop-`user_id` |
| E3 | **Kein `supabase-js`**, kein `tweetnacl`. Zugriff nur aus `api/` per `fetch` auf PostgREST/Storage, Service-Key nie im Browser |
| E5 | Eigene Projekte `stackr-prod` + `stackr-preview`, Frankfurt (eu-central-1), Pro-Plan |

## Was es schon gibt — Sync (Commit `78a711e`, auf `master`, ohne Env-Variablen wirkungslos)

| Datei | Inhalt |
|---|---|
| `supabase/migrations/20261006000001_sync.sql` | 6 Tabellen (`sync_snapshots`, `sync_scopes`, `sync_anchors`, `public_keys`, `grants`, `rate_limits`), RLS an, `anon`/`authenticated` ohne Rechte, je Operation eine Postgres-Funktion (CAS, Scope-/Grant-Deckel atomar), `execute` nur für `service_role` |
| `api/_db.js` | PostgREST-Aufruf per `fetch` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) |
| `api/_sync-store.js` | Adapter Redis \| Supabase. `STORAGE_BACKEND` wählt Lesequelle + CAS, `STORAGE_MIRROR` bekommt jede erfolgreiche Schreibung zusätzlich. Spiegel-Fehler brechen keinen Request ab, sie gehen an `_alert.js` |
| `api/sync.js` | spricht den Speicher nur noch über den Adapter an |
| `scripts/backfill-sync-supabase.js` | Trockenlauf / `--write` / `--check` (Exit 1 bei Abweichung), gibt nie Inhalte aus |
| `test/test-sync-store.js` | rpc-Aufrufe gegen die Migration, Spiegel-Verhalten |

- **Ohne neue Env-Variablen ändert sich nichts**: Default bleibt `STORAGE_BACKEND=redis`, kein Spiegel. Deployen ist also gefahrlos.
- Das SQL läuft seit 2026-10-07 im echten Supabase-Projekt `usrhhjwvoefjdgrwovkg` (siehe Schritt 1).

## Was es schon gibt — Belege/Storage (Commit `747dcfd`, auf `master`, ohne Env-Variablen wirkungslos)

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
- ~~CSP~~ ✅ `fb44856`: `connect-src` der 5 App-Routen enthält `https://usrhhjwvoefjdgrwovkg.supabase.co`. Bei einem anderen Prod-Projekt dort nachziehen.
- Supabase: projektweite Upload-Grenze auf mindestens 200 MB stellen (👤).

Byte-Budget, Commit-Sperre und Rate-Limit in `blob-upload` folgen seit `ceb8d6a` (PR #21) `STORAGE_BACKEND`, Migration `20261008000002_blob_budget.sql`.

## Wichtig: Phase 1 zieht nur den Sync um

Upstash und Vercel Blob hängen an viel mehr als `api/sync.js`. **Abschalten lässt sich erst, wenn alle Zeilen unten umgezogen sind.**

### Upstash Redis — wer es heute noch benutzt

| Endpunkt | Wofür | Umzug |
|---|---|---|
| `api/sync.js` | Snapshots, Scopes, Anker, Pubkeys, Grants, Rate-Limit | ✅ Adapter fertig |
| `api/whop-token.js` | Login: IP-Rate-Limit, legt Refresh-Sitzung `whoprt:<sid>` an | Rate-Limit ✅ (folgt `STORAGE_BACKEND`), Refresh-Sitzung 🟡 PR #18 |
| `api/whop-refresh.js` | Refresh-Sitzungen (TTL), Sperre gegen doppelte Rotation, Rate-Limit | 🟡 PR #18 offen (verschlüsselt, braucht `WHOP_SESSION_KEY`) — **kritisch**: fällt das aus, fliegen Kunden stündlich raus |
| `api/whop-access.js` | IP-Rate-Limit | ✅ folgt `STORAGE_BACKEND` |
| `api/blob-upload.js` | Byte-Budget je Nutzer, Commit-Sperre, Rate-Limit | ✅ `ceb8d6a` folgt `STORAGE_BACKEND` |
| `api/client-error.js` + `api/_client-errors.js` | Browser-Fehler zählen, Tagesmeldung | ✅ folgt `STORAGE_BACKEND`, Migration `20261007000001_client_errors.sql`, kein Spiegel |
| `api/health.js` | prüft Redis, dazu Supabase sobald `STORAGE_BACKEND`/`STORAGE_MIRROR`/`BLOB_BACKEND` es nutzen | ✅ Supabase-Prüfung; Redis-Prüfung fällt erst mit Upstash |

### Vercel Blob — wer es heute noch benutzt

| Endpunkt | Wofür | Umzug |
|---|---|---|
| `api/blob-upload.js` | Belege/Anhänge + übergroße Sync-Chiffrate (put/del/list, Chunk-Upload) | ✅ `747dcfd` |
| `api/blob-cleanup.js` | Cron: verwaiste Chunks löschen, Heartbeat | ✅ `747dcfd` |
| `api/_alert.js` | schreibt Alarm-Log nach Blob (zweites Ziel neben Make) | offen — fällt sonst mit Blob weg |
| `js/blob-attachments.js` (Client) | lädt Chiffrat über öffentliche Blob-URLs | ✅ `747dcfd`, signierte URLs |

`@vercel/blob` (einzige Produktiv-Abhängigkeit) kann erst raus, wenn alle drei Server-Dateien umgestellt sind.

## Ablauf Sync-Umzug (Schritt für Schritt)

Rollen: 👤 = User (Konten, Schlüssel, Vercel-Dashboard), 🤖 = Claude (Code, Tests, Prüfungen).

| # | Schritt | Wer | Erledigt wenn |
|---|---|---|---|
| 0 | Supabase-Projekte `stackr-prod` + `stackr-preview` anlegen (Frankfurt, Spend Cap, 2FA), AV-Vertrag abschließen | 👤 | 🟡 Stand 2026-10-07 abends, gegen das Konto geprüft: Organisation auf **Free-Plan** → vor jeder Env-Variable auf Pro (50-MB-Grenze, Pause nach 7 Tagen, keine Backups). **Zwei** Projekte, beide Frankfurt: `usrhhjwvoefjdgrwovkg` (mit Tabellen, steht in der CSP) und `nvtjzeffngwfsqjzdrdz` „Stackr“ (12:42 angelegt, **leer**). Offen: welches ist Prod, welches Preview? Ist `nvtjz…` Prod, CSP in `vercel.json` nachziehen und alle Migrationen dort ausführen. Spend Cap, AV-Vertrag offen |
| 1 | Migrationen in **beiden** Projekten ausführen, in Dateinamen-Reihenfolge (alle aus `supabase/migrations/`, Stand 2026-10-07: fünf, mit PR #18 sechs) | 👤, 🤖 liefert Anleitung | ✅ `usrhhjwvoefjdgrwovkg`: alle fünf (sync, storage, client_errors, aufraeumen, blob_budget); 25 `sync_*`-Funktionen, keine für `anon` ausführbar, alle Tabellen mit RLS. ❌ `nvtjzeffngwfsqjzdrdz`: nichts. Migration aus PR #18 nach dessen Merge überall nachziehen |
| 2 | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in Vercel eintragen (Sensitive), getrennt für Production und Preview | 👤 | Claude liest die Werte nie aus |
| 3 | Code deployen | 🤖 | ✅ `78a711e`/`747dcfd` auf `master` |
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
2. ~~Rate-Limits + Fehlerzähler (`whop-token`, `whop-access`, `client-error`)~~ ✅ Code fertig, schaltet mit `STORAGE_BACKEND` um. Beim Umschalten meldet die erste Tagesmail evtl. bekannte Fehler als neu (Supabase kennt sie noch nicht), harmlos.
3. ~~`api/health.js` prüft Supabase~~ ✅ (Redis weiter Pflicht, solange Upstash läuft).
4. Whop-Refresh-Sitzungen (`whop-token`, `whop-refresh`): Tabelle mit Ablaufzeit + Sperre per Postgres-Funktion.
5. Storage: Code fertig (`747dcfd`), CSP fertig (`fb44856`). Offen: Upload-Grenze, Backfill der Blob-Dateien, Umschalten.
6. `_alert.js`: zweites Alarmziel neu wählen (Supabase-Tabelle?).
7. Upstash abschalten, `@vercel/blob` entfernen, Rechtstexte final.

## Offene Fragen an den User

1. Welches der beiden Supabase-Projekte ist Prod, welches Preview? (Blockiert Schritt 2.)
2. Preview: eigenes Redis anlegen oder in Preview einfach **keinen** Spiegel setzen? (Empfehlung: keinen Spiegel, Preview testet gegen `stackr-preview` mit eigenen Testdaten.)
