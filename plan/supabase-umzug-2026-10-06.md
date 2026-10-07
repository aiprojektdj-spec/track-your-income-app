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
- Das SQL lief bisher nur gegen **PGlite**, noch nie gegen ein echtes Supabase.

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

Byte-Budget, Commit-Sperre und Rate-Limit in `blob-upload` laufen weiter über Redis (Schritt 2 unten).

## Wichtig: Phase 1 zieht nur den Sync um

Upstash und Vercel Blob hängen an viel mehr als `api/sync.js`. **Abschalten lässt sich erst, wenn alle Zeilen unten umgezogen sind.**

### Upstash Redis — wer es heute noch benutzt

| Endpunkt | Wofür | Umzug |
|---|---|---|
| `api/sync.js` | Snapshots, Scopes, Anker, Pubkeys, Grants, Rate-Limit | ✅ Adapter fertig |
| `api/whop-token.js` | Login: IP-Rate-Limit, legt Refresh-Sitzung `whoprt:<sid>` an | ✅ Rate-Limit folgt `STORAGE_BACKEND`, Sitzung zusätzlich `STORAGE_MIRROR` (`api/_whop-sessions.js`) |
| `api/whop-refresh.js` | Refresh-Sitzungen (TTL), Sperre gegen doppelte Rotation, Rate-Limit | ✅ Code fertig, Migration `20261008000001_whop_sessions.sql`, **mit Spiegel** — vor dem Umschalten Abschnitt „Whop-Refresh-Sitzungen“ unten lesen |
| `api/whop-access.js` | IP-Rate-Limit | ✅ folgt `STORAGE_BACKEND` |
| `api/blob-upload.js` | Byte-Budget je Nutzer, Commit-Sperre, Rate-Limit | offen (mit Storage zusammen) |
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
| 0 | Supabase-Projekte `stackr-prod` + `stackr-preview` anlegen (Frankfurt, Spend Cap, 2FA), AV-Vertrag abschließen | 👤 | 🟡 2026-10-07: Prod = `usrhhjwvoefjdgrwovkg`, Preview = `nvtjzeffngwfsqjzdrdz` (Anzeigename noch „Stackr“, umbenennen in `stackr-preview`), beide Frankfurt, **Free-Plan** → vor jeder Env-Variable in Prod auf Pro (50-MB-Grenze, Pause nach 7 Tagen, keine Backups). Spend Cap, AV-Vertrag offen |
| 1 | Migrationen in **beiden** Projekten ausführen, in Dateinamen-Reihenfolge (alle aus `supabase/migrations/`, Stand 2026-10-08: sechs) | 👤, 🤖 liefert Anleitung | 🟡 2026-10-07 für `usrhhjwvoefjdgrwovkg`: die ersten vier, SQL per SHA-256 gegen origin/master geprüft; 8 Tabellen mit RLS ohne Policy, `anon`/`authenticated` ohne Rechte, Bucket privat. Offen dort: `20261008000001_whop_sessions` (erst nach Merge von PR #18), `20261008000002_blob_budget`. Preview-Projekt: noch leer |
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
- **Whop-Refresh-Sitzungen** sind der empfindlichste Teil. Erst umziehen, wenn der Sync-Umzug stabil läuft. Details unten.

## Reihenfolge danach (Vorschlag)

1. Sync (oben), komplett bis Schritt 8.
2. ~~Rate-Limits + Fehlerzähler (`whop-token`, `whop-access`, `client-error`)~~ ✅ Code fertig, schaltet mit `STORAGE_BACKEND` um. Beim Umschalten meldet die erste Tagesmail evtl. bekannte Fehler als neu (Supabase kennt sie noch nicht), harmlos.
3. ~~`api/health.js` prüft Supabase~~ ✅ (Redis weiter Pflicht, solange Upstash läuft).
4. ~~Whop-Refresh-Sitzungen (`whop-token`, `whop-refresh`)~~ ✅ Code fertig (2026-10-08), schaltet mit `STORAGE_BACKEND` um, spiegelt mit `STORAGE_MIRROR`, Entscheidungen W1–W6 umgesetzt. Offen: `WHOP_SESSION_KEY` setzen (👤), dann Ablauf im nächsten Abschnitt.
5. Storage: Code fertig (`747dcfd`), CSP fertig (`fb44856`). Offen: Upload-Grenze, Backfill der Blob-Dateien, Umschalten.
6. `_alert.js`: zweites Alarmziel neu wählen (Supabase-Tabelle?).
7. Upstash abschalten, `@vercel/blob` entfernen, Rechtstexte final. Dabei Alarm `whop-refresh`/`redis-fehlt` umbenennen + Make-Filter anpassen (W3).

## Whop-Refresh-Sitzungen (Stand 2026-10-08, gegen den Code geprüft)

| Datei | Inhalt |
|---|---|
| `supabase/migrations/20261008000001_whop_sessions.sql` | `whop_sessions` (sid, data, expires_at) + `whop_session_locks` (sid, until), RLS an, keine Policy, `execute` nur `service_role`. Funktionen `sync_whop_session_get/put/delete`, `sync_whop_lock/unlock`. Sperre atomar per `insert … on conflict do update … where until <= now()`. Abgelaufene Zeilen: für `get` sofort unsichtbar, physisch räumt jeder hundertste `put` |
| `api/_whop-sessions.js` | Adapter Redis \| Supabase. Redis-Weg mit genau den alten Befehlen/Keys/TTLs. Beide Wege werfen bei Speicherfehlern, auch bei Upstash-`{ error }`. In Supabase nur Chiffrat (AES-256-GCM, `WHOP_SESSION_KEY`, Sitzungs-ID als AAD), Redis bleibt Klartext. Spiegel bekommt `put`/`del`, nicht die Sperre. Spiegel-Fehler → `whop-session`/`mirror-failed` |
| `api/whop-token.js`, `api/whop-refresh.js` | sprechen die Sitzung nur noch über den Adapter an; IP-Deckel von `whop-refresh` jetzt über `store.rateHit` (Key `whoprefresh:rl:<ip>` unverändert) |
| `test/test-whop-sessions.js` | 62 Checks: Redis-Default befehlsgenau, Supabase-Weg, Sperre (2 parallele Refreshs → 1 Whop-Aufruf), Ablauf, Ausfall (nie 401), Spiegel + Umschalten, Verschlüsselung, Speicherfehler |

**Entscheidungen User 2026-10-08:**

| | Entscheidung | Umsetzung |
|---|---|---|
| W1 | Kein Backfill, 30 Tage Spiegel abwarten | Ablauf unten, kein Skript |
| W2 | Refresh-Tokens in Supabase **verschlüsselt** (E1 gilt auch hier) | `WHOP_SESSION_KEY` (👤 in Vercel als Sensitive, Production und Preview getrennt). Erzeugen: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Schlüssel nie verlieren oder tauschen:** ohne ihn sind alle Supabase-Sitzungen unlesbar (503 + Alarm `session-nicht-lesbar`, kein Logout — mit dem richtigen Schlüssel wieder lesbar). Schlüsselwechsel ist nicht vorgesehen. Fehlt er, gilt Supabase als nicht konfiguriert (`redis-fehlt` mit Hinweis bzw. `mirror-failed`) |
| W3 | Alarmname `redis-fehlt` bleibt vorerst | **Merken:** beim Abschalten von Upstash (Reihenfolge Punkt 7) umbenennen, z. B. `speicher-fehlt`, und den Make-Filter gleichzeitig anpassen |
| W4 | Sperre nicht setzbar (Speicherfehler) → **direkt erneuern**, wie der Code-Kommentar es immer sagte | `whop-refresh.js`: ohne Sperre rotieren, fremde Sperre nicht löschen. Vorher: Warten und evtl. `503 refresh_busy` |
| W5 | Speicherfehler absichern, kein Datenverlust | Lesefehler → 503 + `session-nicht-lesbar` statt 401 (vorher hat eine Upstash-`{ error }`-Antwort den Kunden abgemeldet). Speichern nach Rotation scheitert → einmal wiederholen, sonst Token trotzdem ausgeben + `session-nicht-gespeichert`. Login mit Speicherfehler → ohne Sitzung + Alarm statt toter Sitzungs-ID |
| W6 | Umschalten **nachts** | Restrisiko Sperren in zwei Systemen akzeptiert |
| W7 | Abgelaufene Sitzungen **garantiert** löschen (Datenschutzerklärung: „verfällt 30 Tage nach der letzten Erneuerung“, wie F6) | `sync_whop_aufraeumen()` im täglichen Lauf von `api/blob-cleanup.js`, sobald Supabase primär **oder Spiegel** ist. Spätestens +1 Tag. Fehler → `blob-cleanup`/`aufraeumen-failed` |

SQL am 2026-10-08 gegen Postgres 16 gefahren (alle vier Migrationen in Reihenfolge, `service_role` mit BYPASSRLS wie in Supabase): Ablauf, Überschreiben, Sperre unter 40 parallelen Verbindungen genau einmal vergeben, überlappende Transaktion, Aufräumen, `anon`/`authenticated` überall `permission denied`, Migration zweimal ausführbar.

**Warum ein Spiegel nötig ist:** Antwortet `whop-refresh` 401, löscht der Client seine Sitzungs-ID (`js/whop-auth.js`, `_refreshAccessToken`). Kennt Supabase eine Sitzung beim Umschalten nicht, ist der Kunde nach spätestens einer Stunde abgemeldet. 503 dagegen ist harmlos (Client versucht es später erneut).

**Ablauf:**
1. Migration `20261008000001` in beiden Projekten.
2. `WHOP_SESSION_KEY` setzen (W2), dann `STORAGE_MIRROR=supabase` (ist es für den Sync schon gesetzt, gilt es automatisch auch hier) → jede neue oder rotierte Sitzung landet in beiden.
3. **Mindestens 30 Tage** (= Sitzungs-TTL) ohne `whop-session`/`mirror-failed` warten. Danach existiert jede noch lebende Redis-Sitzung auch in Supabase, weil sie in diesem Zeitraum angelegt oder rotiert worden sein muss — ein Backfill ist dann unnötig (s. offene Frage 3).
4. Umschalten zusammen mit dem Sync, **nachts** (W6): `STORAGE_BACKEND=supabase`, `STORAGE_MIRROR=redis`. Rückweg = Variablen tauschen, Redis bleibt aktuell.

**Fallen:**
- Preview teilt Redis mit Production (s. oben): Ein Spiegel in Preview kopiert **Refresh-Tokens echter Kunden** ins Preview-Projekt. In Preview keinen Spiegel setzen.
- Im Moment des Umschaltens laufen alte und neue Instanzen kurz parallel; ihre Sperren liegen in verschiedenen Systemen. Schlimmstenfalls rotieren zwei Tabs eines Kunden gleichzeitig → einer bekommt `invalid_grant` → 401. Sekundenfenster, einzelne Kunden.
- Ein fehlgeschlagener Spiegel-Write nach einer Rotation lässt im Spiegel einen **entwerteten** Refresh-Token zurück. Nach dem Umschalten → 401 für genau diese Sitzung. Deshalb Schritt 3 nur ohne `mirror-failed`-Alarme abschließen.
- Abweichungen vom Altverhalten nur im Fehlerfall: W4, W5, und liefert Upstash beim IP-Deckel von `whop-refresh` `{ error }`, kommt jetzt der Alarm `rate-limit-open` (vorher still). Im Normalbetrieb dieselben Redis-Befehle wie vorher.
- `WHOP_SESSION_KEY` muss **vor** `STORAGE_MIRROR=supabase` gesetzt sein, sonst gehen alle Sitzungs-Spiegelungen als `mirror-failed` ins Leere und die 30 Tage zählen nicht.

## Offene Fragen an den User

1. Sind die Supabase-Projekte schon angelegt? (Blockiert Schritt 1–2.)
2. Preview: eigenes Redis anlegen oder in Preview einfach **keinen** Spiegel setzen? (Empfehlung: keinen Spiegel, Preview testet gegen `stackr-preview` mit eigenen Testdaten.)
