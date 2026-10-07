# Sicherheits-Review Supabase-Umzug — 2026-10-07

**Geprüft gegen den Code** auf `master` @ `c41a0a8`, nicht gegen Plandateien. Zeilenangaben
driften — im Zweifel nach dem Bezeichner greppen.

Umfang (Commits `78a711e`, `747dcfd`, `fb44856`, `b88dab9`, `9a8ea9f`, `e355f86`):
`api/_db.js`, `api/_sync-store.js`, `api/_storage.js`, `api/blob-upload.js` (inkl. `action=sign`
und Steuerberater-Grants), `api/blob-cleanup.js`, `api/sync.js`, `api/whop-token.js`,
`api/whop-access.js`, `api/client-error.js`, `api/_client-errors.js`, `api/health.js`,
`js/blob-attachments.js`, `js/cloud-sync.js`, `supabase/migrations/*.sql`, `vercel.json`,
`scripts/backfill-*.js`.

Abgeglichen mit [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md): Fail-open der Rate-Limits, das
per Konsole umgehbare Whop-Gate und der kostenlose StB-Zugang sind bewusst so und werden hier
nicht als Befund geführt.

## Ergebnis in einem Satz

**Keine kritische oder hohe Lücke.** Service-Key, RLS/Rechte, Pfad- und Eigentumsprüfung und
die signierten URLs halten. Ein Funktionsfehler mit Folgen für die Datensicherung (B1) ist
behoben, zwei niedrige Befunde sind dokumentiert.

| # | Schwere | Ort | Kurz | Status |
|---|---|---|---|---|
| B1 | Mittel (Verfügbarkeit/Backup) | `api/sync.js:288` | `push` lehnt `sb:`-Referenzen ab → große Ledger synchronisieren mit `BLOB_BACKEND=supabase` nicht | **behoben** in diesem Branch, Test in `test/test-api-sync.js` |
| B2 | Niedrig | `api/_sync-store.js:192`, `:264` | Rückweg (Variablen tauschen) kann einen entzogenen StB-Grant wiederbeleben | dokumentiert, Runbook-Fix |
| B3 | Niedrig (nur Fehlkonfiguration) | `api/_db.js:31`, `api/_storage.js` (5 `fetch`) | Service-Key landet in Log und Alarm-Mail, wenn der Env-Wert ein ungültiges Header-Zeichen enthält | dokumentiert |

---

## B1 — `sb:`-Ledger-Referenz wird von `api/sync.js` abgewiesen (Mittel, behoben)

**Ort:** `api/sync.js:288` (vorher `hasBlob = … indexOf('https://') === 0`).

**Pfad:** `BLOB_BACKEND=supabase` → `api/_storage.js put()` gibt `sb:stackr/attachments/…`
zurück → `js/cloud-sync.js` (`pushBody.blobUrl = await BlobAttachments.put(…)`, sowohl bei
`enc.ct.length > MAX_INLINE_CIPHER` als auch im 413-Rückfall) schickt diese Referenz an
`action=push` → `api/sync.js` erkennt weder `ciphertext` noch eine `https://`-`blobUrl` →
**400 `bad_payload`**. Jeder Nutzer, dessen Ledger über dem Inline-Limit liegt, kann ab dem
Umschalten nicht mehr in die Cloud sichern; der Upload liegt dann verwaist im Bucket, bis der
Nutzer purged. Kein Angreifer nötig — es trifft genau die größten (= wertvollsten) Konten.

**Fix (umgesetzt):** `blobUrl` darf mit `https://` **oder** `sb:` beginnen. Eine
Eigentumsprüfung beim Speichern ist nicht nötig: die Referenz liegt nur im eigenen Snapshot, und
jeder Abruf oder jedes Löschen läuft über `api/blob-upload.js` (`isReadableRef` /
`isOwnedBlobUrl`), das den Namespace des authentifizierten Nutzers bzw. des Grant-Owners prüft.
Eine fremde Referenz im eigenen Snapshot bringt also nichts.

**Beleg:** neuer Fall in `test/test-api-sync.js` (32/32). Gegenprobe: mit dem alten
`api/sync.js` schlägt er mit `sb:-Referenz als blobUrl angenommen` fehl.

## B2 — Rückweg kann einen entzogenen Grant wiederbeleben (Niedrig)

**Ort:** `api/_sync-store.js:192` (`mirror` schluckt Fehler) und `:264` (`revokeGrant`).

**Pfad:** Schritt 7 des Umzugs ist aktiv (`STORAGE_BACKEND=supabase`, `STORAGE_MIRROR=redis`).
Ein Owner entzieht seinem Steuerberater den Zugang; Supabase löscht den Grant, der
Redis-Spiegel-Write scheitert (Timeout, Kontingent) — der Request meldet trotzdem Erfolg, es
kommt nur ein `mirror-failed`-Alarm. Später wird per Variablentausch auf Redis zurückgeschaltet
(der dokumentierte Rückweg). In Redis steht der Grant noch: `pull` mit `owner` und `action=sign`
mit `owner` laufen für den Steuerberater wieder durch. Hat der Owner nach dem Entzug nicht neu
verschlüsselt (der Code empfiehlt es nur), liest der Steuerberater wieder mit.

Dasselbe Muster gilt für gelöschte Snapshots und, seltener, für zwei fast gleichzeitige
erfolgreiche CAS-Pushes von zwei Geräten: der Spiegel bekommt `put` ohne Versionsprüfung, die
spätere Spiegelung kann die neuere überschreiben.

**Warum nur niedrig:** braucht einen Spiegel-Ausfall **und** einen Rückweg, und der Alarm
feuert. `scripts/backfill-sync-supabase.js --check` erkennt genau diese Abweichungen (Grant in
Redis, aber nicht in Supabase → `ABWEICHUNG grant:…`; Zeilenzahlen).

**Fix-Vorschlag (Runbook, kein Code):** in `plan/supabase-umzug-2026-10-06.md` beim Rückweg
ergänzen: „Vor dem Variablentausch `--check` laufen lassen; jede Abweichung erst bereinigen.“
Und nach jedem `mirror-failed` mit `revokeGrant` im Text den Grant im Spiegel von Hand löschen.

## B3 — Service-Key in Fehlermeldungen bei kaputtem Env-Wert (Niedrig, nur Fehlkonfiguration)

**Ort:** `api/_db.js:31` (`fetch` mit `apikey`/`Authorization` aus
`SUPABASE_SERVICE_ROLE_KEY`), gleiches Muster in `api/_storage.js` (`put`, `read`, `sbDelete`,
`sign`) und `scripts/backfill-*.js`.

**Pfad:** Enthält der in Vercel eingetragene Wert ein Zeichen, das in einem HTTP-Header
ungültig ist — typisch ein **Zeilenumbruch mitten im Wert** beim Kopieren aus einem
umgebrochenen Feld, oder ein NUL —, wirft Node 22 (undici) vor dem Senden:

```
Headers.append: "sb_secret_ABC\nX" is an invalid header value.
```

Die Meldung trägt den **vollen Schlüsselwert**. Sie wandert über `_log.logError(…, e)` (200
Zeichen) ins Vercel-Log und über `alertOps(…, e && e.message)` (500 Zeichen,
z. B. `sync rate-limit-open`) an den Make-Webhook → Mail, und als JSON nach `stackr/alerts/` im
Blob-Store. Nachgestellt mit `node -e "fetch(url,{headers:{apikey:'sb_secret_ABC\nX'}})"`.
Ein **abschließender** Zeilenumbruch (der häufigste Kopierfehler) wird von `Headers`
abgeschnitten und ist **nicht** betroffen; Zeichen > 255 erzeugen eine Meldung ohne Wert.

**Warum nur niedrig:** kein Angreifer kann das auslösen; es braucht einen Bedienfehler, und der
Schlüssel landet in Kanälen, die nur der Betreiber liest. Dann aber ist es ein Leck des
Schlüssels, der RLS umgeht, in eine Mail.

**Fix-Vorschlag:** in `api/_db.js` `isConfigured()` den Wert auf `/^[\x21-\x7e]+$/` prüfen
(sonst gilt Supabase als nicht konfiguriert → `configProblem` meldet „fehlen“, ohne Wert), und
`api/_storage.js` nutzt bereits `db.isConfigured()` in `supabaseActive()`/`configProblem()`.
Alternativ `fetch` in `rpc()` mit `try/catch` umschließen und mit festem Text
(`'Supabase rpc ' + name + ' fetch failed'`) neu werfen. Wenige Zeilen, aber nicht Teil dieses
Branches, weil `api/_storage.js` dafür an fünf Stellen angefasst würde.

---

## Geprüft, ohne Befund

**Service-Key nie im Browser, nie in Antworten.** `SUPABASE_SERVICE_ROLE_KEY` wird nur in
`api/_db.js`, `api/_storage.js` und den Backfill-Skripten gelesen; kein Treffer in `js/`,
HTML oder `vercel.json`. Fehlermeldungen tragen Funktionsname und HTTP-Status, nie den
Antwort-Body. Alle Endpunkte antworten bei Speicherfehlern mit festen Codes
(`storage_error`, `server_misconfigured`). `configProblem()` nennt nur Variablennamen.
Die signierte URL enthält das Storage-Token des Objekts, nicht den Service-Key.

**RLS und Rechte.** Alle acht Tabellen haben RLS an und keine Policy; zusätzlich
`revoke all … from public, anon, authenticated` auf jede Tabelle, auf die einzige Sequenz
(`sync_anchors_seq_seq`) und auf jede der 21 Funktionen (Schleife über `sync\_%` in
`20261006000001_sync.sql`, ausdrücklich in den beiden späteren Migrationen). Supabases
Default-Privileges für `anon`/`authenticated` sind damit für alle **heute** vorhandenen Objekte
zurückgenommen. Es gibt keine Funktion ohne `sync_`-Präfix. Der Bucket `attachments` ist privat
(`public = false`, auch beim erneuten Ausführen erzwungen), `storage.objects` hat keine Policy.

**SECURITY DEFINER / search_path.** Keine Funktion ist `SECURITY DEFINER`; alle laufen als
Aufrufer, und aufrufen darf nur `service_role`, der RLS ohnehin umgeht. Ein veränderbarer
`search_path` ist damit keine Rechteausweitung. Der Supabase-Advisor wird trotzdem
„Function Search Path Mutable“ für alle 21 Funktionen melden — siehe Härtung H1.

**SQL-Injection.** Alle Werte gehen als JSON-Parameter an `/rest/v1/rpc/<name>`; `<name>` ist
immer ein Literal im Code. Kein dynamisches SQL außer dem `format('%s', regprocedure)` der
Rechte-Schleife (Systemkatalog, keine Nutzereingabe). `sync_storage_list` nutzt `left()`
statt `like`, `_` in IDs wirkt also nicht als Platzhalter.

**Storage-Pfade.** Der Objektschlüssel entsteht serverseitig aus der Whop-`sub` (nie aus dem
Body), dem per `SCOPE_RE` geprüften Scope und einem auf `[A-Za-z0-9_.-]` reduzierten Namen plus
Zufallssuffix (`x-upsert: false`, kein Überschreiben). `keyOf()` verwirft leere, `.`- und
`..`-Segmente — auch nach `decodeURIComponent` bei Vercel-URLs (`%2e%2e`, `%2F`); `sb:`-Schlüssel
werden nicht dekodiert und segmentweise kodiert. Eigentumsprüfung per Präfix mit
abschließendem `/` (`user_a` trifft nicht `user_ab`), User-ID per `escapeRegex`. Purge und Cron
löschen nur `stackr/attachments/<eigene ID>/` bzw. `stackr/tmp/`; der Storage-`DELETE` mit
`prefixes` löscht exakte Namen.

**Signierte URLs.** Laufzeit 300 s (`SIGN_TTL_SEC`), höchstens 200 Referenzen je Request,
Rate-Limit 120/min/Nutzer. Ohne `owner`: nur eigene Anhänge, Pro-Pflicht. Mit `owner`: Format
per `GRANTEE_ID_RE`, dann `store.getGrant(owner, userId)` — ohne Grant 403, und auch mit Grant
nur Schlüssel unter `stackr/attachments/<owner>/<gültiger Scope>/`, nie `tmp/`. `owner` gleich
eigener ID fällt auf den Pro-Weg zurück. Kein IDOR gefunden; die Fälle sind in
`test/test-blob-storage.js` abgedeckt. Nach einem Entzug bleiben bereits ausgegebene URLs bis
zu 300 s gültig — bewusst kurz, Inhalt ist Chiffrat.

**CSP.** `connect-src` der fünf App-Routen nennt genau das eine Projekt
(`https://usrhhjwvoefjdgrwovkg.supabase.co`), keine Wildcard auf `*.supabase.co`; Landing und
Rechtstexte bleiben bei `'self'`/`'none'`. Pro Route, nicht global (Regel 8). `img-src` braucht
Supabase nicht, Anhänge kommen per `fetch` und werden als `blob:` angezeigt.

**Rate-Limits.** `sync_rate_hit` ist atomar (Upsert mit Fensterwechsel). Schlüssel-Präfixe
überschneiden sich nicht (`sync:rl:`, `sync:iprl:`, `whoptoken:rl:`, `whopaccess:iprl:`,
`clerr:iprl:`, `clerr:total:`). `sync`, `whop-token`, `whop-access` fallen bei Speicherausfall
offen (Entscheidung, mit Alarm); `client-error` fällt **zu** — wirft `rateHit`, wird nichts
gespeichert. IP kommt aus `x-vercel-forwarded-for`.

**Health.** `GET /api/health` antwortet nur `ok`/`redis`/`supabase` mit `ok`/`down`, ohne
Fehlertexte oder Hosts. Der Supabase-Ping ist ein lesender rpc auf `__health` (kein Whop-Nutzer).
Das Vorhandensein des Felds `supabase` verrät nur, dass Supabase genutzt wird. Ergebnis 30 s je
Instanz gemerkt.

**Fehlerzähler.** In Supabase landet nur der Eintrag aus `sanitize()` (Feld-Whitelist, E-Mails
und Ziffernfolgen ersetzt, Quelle nur als Pfad), keine IP, keine Nutzer-ID.

**Backfill-Skripte.** Beide geben nur Zähler und Schlüsselnamen aus (`FEHLT <pfad>`,
`ABWEICHUNG <key>`), nie Inhalte; Fehlertexte tragen Pfad und HTTP-Status. Die Schlüsselnamen
enthalten Whop-User-IDs — das ist für ein lokal vom Betreiber ausgeführtes Skript in Ordnung.
`backfill-blob` lädt mit `redirect: 'error'` und prüft je Datei SHA-256. `backfill-sync`
übernimmt keine Rate-Limit-Keys.

---

## Härtung (kein Befund, Entscheidung beim User)

- **H1 `search_path` festnageln.** `set search_path = ''` an jeder Funktion und alle Tabellen
  schema-qualifiziert (`public.sync_snapshots`). Räumt die Advisor-Warnung ab und schützt, falls
  je eine Funktion `SECURITY DEFINER` wird. Änderung an allen drei Migrationen → nicht hier.
- **H2 Rechte für künftige Objekte.** Die Rücknahme gilt nur für heute vorhandene Objekte. Jede
  neue Migration muss `revoke … from public, anon, authenticated` wiederholen, sonst greifen
  Supabases Default-Privileges (bei Tabellen hält dann nur noch RLS; eine neue Funktion wäre für
  `anon` per `/rpc/` aufrufbar und nur noch durch die Rechte auf die Tabellen gebremst, die sie
  anfasst — bei `SECURITY DEFINER` gar nicht).
  Optionen: projektweit `alter default privileges in schema public revoke all on tables,
  functions, sequences from anon, authenticated` (betrifft das ganze Projekt — der Browser spricht
  laut E3 nie direkt mit Supabase, sollte also passen), oder ein Test, der jede
  `create table`/`create function` in `supabase/migrations/` einer `revoke`-Zeile zuordnet.
- **H3 Preview-Projekt und CSP.** Die CSP kennt nur das eine Projekt. Läuft Preview gegen
  `stackr-preview`, blockiert der Browser dort die signierten URLs (funktional, nicht
  sicherheitsrelevant). Entweder Preview-Ref ergänzen oder Preview bewusst ohne
  `BLOB_BACKEND=supabase` betreiben.
- **H4 Erinnerung, steht schon im Umzugsplan:** Byte-Budget, Commit-Sperre und Rate-Limit in
  `api/blob-upload.js` hängen weiter an Redis. Wird Upstash abgeschaltet, bevor sie umziehen,
  sind alle drei still offen (nur `redis-env-missing`-Alarm) — Fund R6 wäre zurück.
