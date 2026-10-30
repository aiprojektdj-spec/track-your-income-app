# Supabase-Umzug: Upstash Redis + Vercel Blob → Supabase

Stand: **2026-10-30**, gegen `origin/master` und das Supabase-Projekt `stackr-prod` geprüft (per Connector, nur lesend), nicht gegen den Plan. Laufende Checkliste zum Spiegel und Backfill: [`supabase-pro-2026-10-15.md`](supabase-pro-2026-10-15.md).
Der Gesamtplan liegt außerhalb des Repos (`Desktop/CFC/STACKR_PLAN_2026-10-06.md`, Phase 1).
Diese Datei beschreibt nur den Speicher-Umzug und hält fest, wer was macht.

## Entscheidungen (User, 2026-10-06)

| | Entscheidung |
|---|---|
| E1 | **E2E bleibt.** Supabase speichert nur Chiffrat. Fremddaten (Shopify, Bank) später per Sealed Box mit dem Nutzer-Pubkey |
| E2 | **Whop bleibt** Login und Zahlung. Supabase kennt nur die Whop-`user_id` |
| E3 | **Kein `supabase-js`**, kein `tweetnacl`. Zugriff nur aus `api/` per `fetch` auf PostgREST/Storage, Service-Key nie im Browser |
| E5 | Eigenes Projekt `stackr-prod`, Frankfurt (eu-central-1), Pro-Plan. Ursprünglich auch `stackr-preview` geplant; Stand 2026-10-16 gibt es **kein** Preview-Projekt mehr (`nvtjzeffngwfsqjzdrdz` gelöscht) |
| E6 | ~~Supabase bleibt bis zum Launch im Free-Plan~~ (User, 2026-10-07) — **überholt**: Organisation auf **Pro** (geprüft 2026-10-16 und 2026-10-30). Nur ein Projekt: `usrhhjwvoefjdgrwovkg` = `stackr-prod` (Prod laut PR #18, steht in der CSP), Preview-Projekt gelöscht |

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
| `api/whop-token.js` | Login: IP-Rate-Limit, legt Refresh-Sitzung `whoprt:<sid>` an | ✅ Rate-Limit folgt `STORAGE_BACKEND`, Sitzung zusätzlich `STORAGE_MIRROR` (`api/_whop-sessions.js`) |
| `api/whop-refresh.js` | Refresh-Sitzungen (TTL), Sperre gegen doppelte Rotation, Rate-Limit | ✅ Code fertig, Migration `20261008000001_whop_sessions.sql`, **mit Spiegel** — vor dem Umschalten Abschnitt „Whop-Refresh-Sitzungen“ unten lesen |
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
| 0 | Supabase-Projekt `stackr-prod` anlegen (Frankfurt, Spend Cap, 2FA), AV-Vertrag abschließen | 👤 | 🟡 Projekt ✅ (`usrhhjwvoefjdgrwovkg` = `stackr-prod`, Frankfurt, Org auf **Pro**, kein Preview-Projekt). DPA ✅ automatisch über die ToS (`077f348`, 28.10.). **Offen für den User, per Connector nicht prüfbar:** Spend Cap, 2FA im Dashboard bestätigen; Supabase auf der DPF-Liste nachsehen (laut Rechtsaudit 24.10. kein DPF, nur SCC) |
| 1 | Migrationen in `stackr-prod` ausführen, in Dateinamen-Reihenfolge (alle aus `supabase/migrations/`) | 👤, 🤖 liefert Anleitung | 🟡 2026-10-30 per Connector: **12 von 16** in Prod (alle bis `20261015000001`, dazu `kuendigungen` und `loeschplan`). **Nicht** in Prod: `20261022000001_shopify`, `20261026000001_shopify_loeschfrist` (sollen laut Kopf in beide Projekte — offen, ohne Tabellen sind die Shopify-Endpunkte fail-closed), `20261022000002_server_datenmodell` und `20261028000001_server_umzug` (laut Kopf **bewusst** erst zum Livegang R9). 15 Tabellen, alle mit RLS |
| 2 | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in Vercel eintragen (Sensitive), getrennt für Production und Preview; dazu `WHOP_SESSION_KEY` (32 Byte Base64, für die Whop-Sitzungen in Supabase) | 👤 | 🟡 2026-10-08 **Production** gesetzt (Type Secret): `SUPABASE_URL` = `usrhhjwvoefjdgrwovkg`, `SUPABASE_SERVICE_ROLE_KEY` = Legacy-`service_role`-JWT (der Code schickt ihn auch als Bearer, deshalb kein `sb_secret_…`), `WHOP_SESSION_KEY` lokal erzeugt, nie angezeigt. Seit 2026-10-14 zusätzlich `STORAGE_MIRROR=supabase` (Schritt 4); `STORAGE_BACKEND` und `BLOB_BACKEND` weiter **nicht** gesetzt. Preview: **keine** Supabase-Werte setzen, solange es kein Preview-Projekt gibt (sonst schreibt Preview in Prod). `WHOP_SESSION_KEY` nicht mehr ändern (sonst einmal Neu-Login für alle) |
| 3 | Code deployen | 🤖 | ✅ `78a711e`/`747dcfd` auf `master` |
| 4 | `STORAGE_MIRROR=supabase` setzen, neu deployen → Dual-Write | 👤 | ✅ seit **2026-10-14** ca. 19:22 UTC (`supabase-pro-2026-10-15.md`). 2026-10-30: Supabase wird live beschrieben (11 Zeilen in `sync_snapshots`, letzte Schreibung 29.10.), Whop-Sitzungen vorhanden, **kein** `mirror-failed` in `ops_alerts`, `rate_limits` leer → primär weiter Upstash |
| 5 | Backfill `--write`, dann `--check` (lokal, mit den Prod-Env-Werten) | 👤 führt aus, 🤖 begleitet | 🟡 laut `supabase-pro-2026-10-15.md` am 15.10. gestartet; ein `--check` mit Exit 0 ist **nirgends belegt** → vom User bestätigen lassen bzw. erneut laufen lassen. Belege (`backfill-blob-supabase.js`) offen: Bucket `attachments` ist leer |
| 6 | Einige Tage beobachten, `--check` erneut | 👤/🤖 | 🟡 läuft; Whop-Sitzungen brauchen **30 Tage** ohne `mirror-failed` ab 14.10. |
| 7 | Umschalten: `STORAGE_BACKEND=supabase`, `STORAGE_MIRROR=redis` | 👤 | offen. **Frühestens in der Nacht 13./14.11.2026** (30 Tage Sitzungs-TTL); jeder `mirror-failed` setzt die Frist neu |
| 8 | 14 Tage beobachten, dann `STORAGE_MIRROR` leeren | 👤 | — |
| 9 | DSE, Verarbeitungsverzeichnis, `CLOUD-SYNC.md`, Landing-Text anpassen | 🤖 Entwurf, 👤 Freigabe | 🟡 Übergangsfassung (Spiegel) ist live seit `f538e85` (24.10.): DSE, Cookies, Opt-in-Dialog, Verfahrensdoku nennen Supabase; Freigabe des Wortlauts durch den Anwalt steht aus. Endfassung (ohne Upstash) erst nach Schritt 8 |

## Risiken und Fallen

- **Preview und Production teilen Redis** (Commit `36be024`). Setzt man in Preview `STORAGE_MIRROR=supabase` mit dem Preview-Projekt, landen **Produktionsdaten** (Chiffrat) im Preview-Projekt. Backfill daher nur Prod-Redis → `stackr-prod`. Für Preview entweder eigenes Redis oder den Spiegel dort nicht setzen.
- **Spiegel-Ausfall = stiller Drift.** Ein fehlgeschlagener Spiegel-Write bricht den Request nicht ab. Schutz: Alarm + `--check` vor dem Umschalten (Schritt 6/7).
- **Rückweg erst nach `--check`** (Befund B2, [`audit-supabase-security-2026-10-07.md`](audit-supabase-security-2026-10-07.md)). Schlug während `STORAGE_BACKEND=supabase` die Spiegelung eines Grant-Entzugs nach Redis fehl, steht der Grant dort noch — nach dem Variablentausch liest der Steuerberater wieder mit. Vor jedem Rückweg daher `scripts/backfill-sync-supabase.js --check`; jede `ABWEICHUNG grant:…` erst in Redis bereinigen (Grant löschen), dann tauschen. Nach jedem `mirror-failed`-Alarm mit `revokeGrant` den Grant im Spiegel sofort von Hand löschen.
- **jsonb ordnet Objektschlüssel um.** Vergleiche immer schlüsselsortiert (der Backfill-Check macht das).
- **Größe:** Inline-Chiffrat bis ~3,5 MB pro Scope als jsonb-String. Ab dem 2026-10-20 schreibt der Client gzip-komprimiert (Commit `b648d34`), das entlastet auch Supabase.
- **Whop-Refresh-Sitzungen** sind der empfindlichste Teil. Erst umziehen, wenn der Sync-Umzug stabil läuft. Details unten.

## Reihenfolge danach (Vorschlag)

1. Sync (oben), komplett bis Schritt 8.
2. ~~Rate-Limits + Fehlerzähler (`whop-token`, `whop-access`, `client-error`)~~ ✅ Code fertig, schaltet mit `STORAGE_BACKEND` um. Beim Umschalten meldet die erste Tagesmail evtl. bekannte Fehler als neu (Supabase kennt sie noch nicht), harmlos.
3. ~~`api/health.js` prüft Supabase~~ ✅ (Redis weiter Pflicht, solange Upstash läuft).
4. ~~Whop-Refresh-Sitzungen (`whop-token`, `whop-refresh`)~~ ✅ Code fertig (2026-10-08), schaltet mit `STORAGE_BACKEND` um, spiegelt mit `STORAGE_MIRROR`, Entscheidungen W1–W6 umgesetzt. Offen: `WHOP_SESSION_KEY` setzen (👤), dann Ablauf im nächsten Abschnitt.
5. Storage: Code fertig (`747dcfd`, Budget/Sperre `ceb8d6a`), CSP fertig (`fb44856`), Fix B1 für `sb:`-Referenzen in `api/sync.js` gemergt (PR #17). Offen: Upload-Grenze, Backfill der Blob-Dateien, Umschalten.
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

1. ~~Welches der beiden Supabase-Projekte ist Prod, welches Preview?~~ Prod = `usrhhjwvoefjdgrwovkg` (`stackr-prod`, PR #18). Das Preview-Projekt ist seit spätestens 2026-10-16 gelöscht.
2. ~~Preview: eigenes Redis oder keinen Spiegel?~~ Ohne Preview-Projekt erledigt: In Preview werden gar keine Supabase-Variablen gesetzt. Kommt wieder ein Preview-Projekt, stellt sich die Frage neu (Preview teilt Redis mit Prod).
