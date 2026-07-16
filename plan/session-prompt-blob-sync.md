# Prompt für neue Session (copy-paste)

---

Kontext: Am 2026-07-15 wurde das Cloud-Sync-Speicherlimit umgebaut, weil Vercel Serverless
Functions ein hartes 4,5-MB-Body-Limit haben (Plattform, nicht konfigurierbar) — das alte
`MAX_CIPHER=8MB` in `api/sync.js` war dadurch nie real erreichbar. Neue Architektur: große
Anhänge (Rechnungslogo, Eigenbeleg-Foto/-PDF, übergroßes Ledger-Chiffrat) werden aus dem
Sync-JSON ausgelagert und einzeln über Vercel Blob transportiert (`api/blob-upload.js`,
`js/blob-attachments.js`), inkl. Transport-Chunking für Payloads >4MB. Gleichzeitig wurden
Eigenbelege von localStorage auf IndexedDB migriert (waren vorher ungecacht, 5-10MB-Deckel).

Der Umbau ist **im Code fertig, aber komplett uncommittet** und **nur gegen einen gemockten
`fetch` verifiziert** — kein einziger echter Request ist bisher gegen einen echten Vercel-Blob-
Store gelaufen. Das ist der aktuell größte offene Launch-Blocker.

Zentrale Dateien: `api/blob-upload.js` (neu, Whop-authentifiziert, Aktionen `put`/`chunk`+`commit`/
`delete`), `api/blob-cleanup.js` (neu, täglicher Cron räumt verwaiste Chunk-Temp-Objekte
`stackr/tmp/` >24h auf, nur aktiv wenn `CRON_SECRET` gesetzt), `js/blob-attachments.js` (neu,
Client-Transport-Layer + generisches Auslagern von `data:...`-Strings >20.000 Zeichen,
Content-Hash-Cache `oyi_sync_blobcache_<scope>` gegen Doppel-Uploads), `js/cloud-sync.js`
(`_syncScope` hydriert/lagert aus, `deleteRemote(scope)` räumt referenzierte Blobs bei
Art.-17-Löschung mit auf), `api/sync.js` (`MAX_CIPHER` jetzt 3,5MB, akzeptiert `{blobUrl, iv}`
als Alternative zu `{ciphertext, iv}`), `app.html` (CSP `connect-src` um
`https://*.public.blob.vercel-storage.com` erweitert), `package.json`/`package-lock.json`
(neue Abhängigkeit `@vercel/blob` 2.6.1).

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im selben Ordner. Vor JEDEM Edit
die Datei frisch lesen; nur eigene Dateien stagen.

## Aufgaben

**1. Diff-Review vor dem Commit**
- Gehe `git status`/`git diff` komplett durch (12 geänderte + 5 neue Dateien). Prüfe, dass
  keine Debug-Reste, Konsolen-Logs mit sensiblen Daten oder halbfertige Codepfade drin sind.
- Verifiziere die bekannte Lehre aus dem letzten Fund: `Store._syncReadRaw()` gibt trotz des
  Namens bereits GEPARSTE Werte zurück — grep nach jeder `_syncReadRaw`-Nutzung und stelle
  sicher, dass niemand das Ergebnis nochmal durch `JSON.parse()` jagt.
- Grep zusätzlich nach `eigenbelege_belege` über den ganzen Repo (nicht nur `eigenbelege/js/app.js`)
  — `js/euer.js`, `rechnungen/js/rechnung.js`, `js/lager.js`, `js/schweiz.js` wurden schon auf
  `Store._syncReadRaw(key) || fallback` umgestellt; verifiziere, dass es keine fünfte/sechste
  Stelle gibt, die noch roh `localStorage.getItem('eigenbelege_belege')` liest.

**2. Lokales Setup + Infra (so weit wie ohne User-Zugangsdaten möglich)**
- `npm install` lokal ausführen (package-lock.json existiert, node_modules fehlt).
- Prüfe, ob `BLOB_READ_WRITE_TOKEN` und `CRON_SECRET` als Env-Var lokal/im Preview verfügbar
  gemacht werden können, oder ob das zwingend echtes Vercel-Dashboard braucht (dann als
  Nicht-Prompt-Punkt für den User dokumentieren: Blob-Store im Storage-Tab anlegen → setzt
  `BLOB_READ_WRITE_TOKEN` automatisch; `CRON_SECRET` manuell setzen).

**3. Echter Live-Test (kein Mock mehr)**
- Preview-Server starten, mit echtem oder geseedetem Whop-Pro-Zugang (siehe
  `plan/session-prompt-stb-luecken.md` für die Whop-Gate-Umgehungstechnik im Preview).
- Roundtrip real durchspielen: großes Rechnungslogo (>20.000 Zeichen Base64) hochladen →
  im Netzwerk-Tab prüfen, dass es als `blobUrl` ausgelagert wird, nicht inline im Sync-Body.
- Chunking real testen: einen Anhang >4MB erzeugen (z. B. großes Eigenbeleg-Foto), prüfen dass
  `chunk`+`commit` korrekt durchläuft und die zusammengesetzte Datei nach Hydrate identisch
  zum Original ist (Hash-Vergleich).
- Content-Hash-Cache verifizieren: denselben Anhang zweimal syncen, im Netzwerk-Tab prüfen
  dass der zweite Sync KEINEN erneuten Blob-Upload auslöst.
- Art.-17-Löschung (`deleteRemote`) real auslösen und im Vercel-Blob-Dashboard (oder per
  `list()`-Aufruf) verifizieren, dass die referenzierten Blob-Objekte wirklich weg sind,
  nicht nur der Sync-Eintrag.
- CSP prüfen: Kein `connect-src`-Fehler in der Konsole beim Blob-Request.

**4. Bekannte, akzeptierte Lücken NICHT nachbauen (sind bewusst offen)**
- Superseded Blob-Anhänge (Feld geändert → alter Blob bleibt bis zur nächsten Art.-17-Löschung)
  werden nicht per Referenzzählung aufgeräumt — das ist ein akzeptiertes kleines Kosten-Leck,
  keinen Fix dafür bauen ohne expliziten User-Wunsch.
- `js/companies.js`'s `migrateEigenbelegeToCompanies()` schreibt weiter direkt in localStorage —
  für migrierte Bestandsnutzer irrelevant, nicht anfassen.

## Abschluss
- Wenn der Live-Test sauber durchläuft: alle 17 Dateien (12 geändert + 5 neu) mit sauberer
  Commit-Message committen. Nicht deployen — macht der User.
- Wenn etwas bricht: Ursache diagnostizieren, fixen, Test wiederholen, danach erst committen.
- Memory `cloud-sync-blob-architecture.md` von "Client-Logik verifiziert, Server nur syntaktisch
  geprüft" auf "echter Live-Test bestanden" aktualisieren (oder auf gefundene Bugs korrigieren).
- Offene Infra-Punkte, die nur der User im Vercel-Dashboard machen kann, in einer kurzen Liste
  am Ende der Session nennen.

---

**Modell-Empfehlung: Opus 4.8.** Grund: das ist eine Serverless-Transport-Architektur mit
mehreren verzahnten Fehlerpfaden (Chunking, Hydrate/Offload-Reihenfolge, Content-Hash-Cache,
Art.-17-Löschung über zwei Systeme hinweg) und ein bereits einmal gefundener, nicht-offensichtlicher
Bug in derselben Änderung (`_syncReadRaw` Doppel-Parse) — genau die Art Cross-Modul-Blast-Radius,
bei der ein zu flaches Review reale Datenverluste für Kunden riskiert.
