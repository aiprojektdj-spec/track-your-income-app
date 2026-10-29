# Umbauplan: serverführende Datenhaltung (Stand 2026-10-22)

Grundlage: Entscheidung vom 2026-10-21 (oben in [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md)),
Auftrag aus [`session-prompt-server-umbau-2026-10-22.md`](session-prompt-server-umbau-2026-10-22.md).
**Nur Plan, noch kein Umbau.** Nichts davon ist auf Supabase angewendet. Stand gegen den Code
prüfen, nicht gegen diese Datei (Regel 3).

## 0. Ist-Stand (gegen den Code geprüft am 2026-10-22)

- **Browser:** `js/store.js` (3 759 Zeilen) hält alles in `Store._cache` (Strings, synchron
  gelesen), geschrieben nach IndexedDB `oyi_maindata` (Fallback localStorage). Schlüssel:
  `co_<id>__reselling_<name>`, `co_<id>__rechnungsbuch_<name>`, `co_<id>__audit_log`,
  `co_<id>__eigenbelege_*`; global `oyi_companies`, `oyi_active_company`, `oyi_theme`.
  Die meisten Werte sind **Arrays von Datensätzen mit `id` und `updatedAt`**; ein paar sind
  Einzelobjekte (Einstellungen, Zähler).
- **GoBD heute im Browser:** `Store.isLocked()` (storniert, gegengebucht, `gesperrt`,
  festgeschriebene Periode über `closed_years` + `ust_perioden.eingereichtAm`),
  Audit-Log mit Hash-Kette (`prevHash`/`checksum`), Anker der Kette auf dem Server
  (`sync_anchors`).
- **Server:** `api/` spricht Supabase nur per RPC über `api/_db.js` (Service-Key, E2/E3:
  Browser nie direkt an Supabase, keine supabase-js-Abhängigkeit). Alle Tabellen RLS an,
  **ohne Policy**; Schutz liegt allein in `api/`. Inhalt: nur Chiffrat (`sync_snapshots`,
  Storage-Bucket `attachments`). Whop-Identität wird **bei jedem Request** über
  `https://api.whop.com/oauth/userinfo` geprüft (`api/sync.js`).
- **Cloud-Sync-Scopes:** `__account` (Firmenliste) und `co_<id>` (alle Schlüssel einer Firma).
- **Shopify Stufe 1** ist committet (`6dba391`): `integrations`, `shopify_eingang`,
  8 `sync_shopify_*`-Funktionen, in **keinem** Projekt ausgeführt. `company_id` wird nur
  auf Format geprüft.

## 1. Datenmodell in Postgres

### Grundentscheidung: Datensatz-Tabelle mit jsonb, keine 40 Fachtabellen

Ein Datensatz des Browsers wird eine Zeile, der Inhalt bleibt das heutige JSON-Objekt.
Begründung: Der Browser-Code (Rechenlogik, Formulare, Exporte) arbeitet auf genau diesen
Objekten weiter; ein voll normalisiertes Schema hieße alle Module gleichzeitig umschreiben
(Big Bang). Spalten, die der Server für Regeln braucht (Datum, Sperre, Quelle, Nummer), werden
**von der Schreibfunktion** gesetzt, nicht vom Client geglaubt. Fachtabellen nur dort, wo der
Server rechnen muss (später, je Bedarf, z. B. für ELSTER/DATEV-Abfragen).

```text
companies        id text pk ('co_…', Browser-ID wird übernommen), name, rechtsform, land,
                 created_at, deleted_at
company_members  company_id fk, user_id text (Whop-sub), rolle 'owner'|'stb_lesen',
                 created_at, revoked_at        pk (company_id, user_id)
records          company_id fk, art text, id text, data jsonb, version int,
                 datum date, nummer text, quelle text, gesperrt_grund text,
                 geloescht boolean, created_at, updated_at, updated_by text
                 pk (company_id, art, id)
                 unique (company_id, art, quelle) where quelle is not null   ← Doppelimport
                 index (company_id, art, datum)
settings         company_id fk, key text, data jsonb, version int, updated_at, updated_by
                 pk (company_id, key)                         ← Einzelobjekte und Zähler
counters         (vorhanden, 20261008000002) → Nummernkreise NICHT dort, sondern
nummernkreise    company_id, kreis text ('rechnung','eigenbeleg','retoure',…), naechste int
                 pk (company_id, kreis)                       ← lückenlos, mit `for update`
perioden         company_id, jahr int, monat int null, quartal int null,
                 eingereicht_am timestamptz, abgeschlossen boolean   ← führende Festschreibung
audit_log        company_id, seq bigserial, ts, user_id, aktion, art, entity_id,
                 alt jsonb, neu jsonb, details text, prev_hash text, hash text
                 (nur INSERT; Update/Delete per Trigger verboten)
anhaenge         company_id, id, record_art, record_id, storage_pfad, mime, bytes, sha256,
                 created_at                                   ← Belegfotos/PDFs, Logos
user_prefs       user_id pk, data jsonb                       ← oyi_theme, aktive Firma u. ä.
change_seq       pro Firma fortlaufende Änderungsnummer (Spalte `seq` in records/settings
                 + Funktion „Änderungen seit n“) für Mehrgeräte-Abgleich
```

### Welche Store-Schlüssel wohin

| Browser-Schlüssel (ohne `co_<id>__`-Präfix) | Ziel | `art` / `key` |
|---|---|---|
| `oyi_companies` | `companies` + `company_members` (owner) | — |
| `oyi_active_company`, `oyi_theme`, `lager_prefs`, `lager_layout`, `lager_last_*` | `user_prefs` (oder lokal lassen, rein UI) | — |
| `reselling_purchases`, `_sales`, `_expenses`, `_retouren`, `_privatbuchungen`, `_afa_anlagen`, `_vorsteuer_entries`, Fahrten, Kassenbuch, Material-Einkäufe/-Verbrauch, `_recurring_rules`, `_ksk_meldungen`, `_lohnsteuer_employees`, `_gbr_gesellschafter`, `_gbr_verr`, `_dokumente` | `records` | Name ohne Präfix, z. B. `sales` |
| `reselling_brands`, `_platforms`, `_einkaufsquellen`, `_warenkategorien`, `_lager_status`, `_kunden`/`customers`, `_produkte`/`products` | `records` (Stammdaten, nie gesperrt) | dito |
| `rechnungsbuch_invoices`, `_customers`, `_products`, Rechnungs-Serien | `records` | `rech_invoices` usw. |
| `eigenbelege_belege`, `_kategorien`, `_produkte` | `records` | `eb_belege` usw. |
| `reselling_settings`, `_gbr_einstellungen`, `_ksk_config`, `_kst_data`, `_bilanz_data`, `_gbr_gewst`, `_differenz_vortrag`, `rechnungsbuch_settings`/`_unternehmen`, `eigenbelege_einstellungen` | `settings` | Name ohne Präfix |
| `invoice_counter`, `rechnungsbuch_invoice_counter`, `eigenbelege_naechste_nummer`, Retourennummer | `nummernkreise` | Kreisname |
| `reselling_closed_years`, `reselling_ust_perioden` | `perioden` (Festschreibung) **und** `records`/`settings` für Zusatzfelder (UVA-Snapshot) | — |
| `audit_log` | `audit_log` (Server schreibt, Client liest nur) | — |
| `reselling_tombstones` | entfällt (Server löscht/markiert `geloescht`) | — |
| Base64-Felder (Belegfoto, Logo) | Storage-Bucket (neu, Klartext) + `anhaenge`; im JSON nur Referenz | — |
| `whop_*`, `stackr_error_log`, Sync-/Backup-Hilfsschlüssel | bleiben lokal bzw. entfallen | — |

Die vollständige Liste erzeugt Phase 1 per Skript aus einem echten Export (`Store.exportAll()`
einer Testfirma), nicht aus dieser Tabelle — die obige ist aus dem Code abgelesen und kann
Schlüssel übersehen (Module mit eigenen Schlüsseln: `svs_vorauszahlungen`, Fahrtenbuch, Lager).

### RLS je Whop-User und Firma

Whop ist kein Supabase-Auth-Anbieter; es gibt keinen Supabase-JWT des Nutzers.
**Annahme (E-A, nicht vom User entschieden, als technische Empfehlung übernommen):** E2/E3 bleiben — der Browser spricht nur mit `api/`. RLS wird trotzdem
echt wirksam:

1. Eigene Rolle `stackr_app` (NOLOGIN, **ohne** BYPASSRLS), Eigentümer aller Datenfunktionen;
   Funktionen `security definer`, `set search_path`. Tabellen `force row level security`.
2. Jede Datenfunktion bekommt `p_user` und setzt als Erstes
   `set_config('stackr.user', p_user, true)` (transaktionslokal).
3. Policies auf allen Datentabellen: `exists (select 1 from company_members m where
   m.company_id = <tabelle>.company_id and m.user_id = current_setting('stackr.user', true)
   and m.revoked_at is null)`; Schreib-Policies zusätzlich `rolle = 'owner'`.
4. `service_role` behält nur EXECUTE auf die Funktionen, keine Tabellenrechte auf Datentabellen.

Damit schützt RLS auch gegen eine Funktion, die ein `where company_id = …` vergisst. Die
Alternative (E-B: `api/` signiert pro Request einen kurzen Supabase-JWT mit `sub` = Whop-ID,
Policies über `auth.jwt()`) bindet an Supabases JWT-Schlüsselverwaltung und bringt hier nichts
Zusätzliches. **Vor dem Bau in stackr-preview prüfen**, dass `stackr_app` als
Funktionseigentümer RLS tatsächlich unterliegt (Testfall: fremde Firma lesen → 0 Zeilen).

### Identität im Server

Heute ein Whop-Aufruf pro Request — bei einer serverführenden App zu langsam und Whop-abhängig.
Neu `api/_auth.js`: Whop-Token einmal über `oauth/userinfo` prüfen, Ergebnis
(user_id, Pro-Status) für 5 Minuten unter SHA-256(Token) in einer Tabelle `auth_cache` merken.
Kein neues Cookie, keine neue Abhängigkeit. Pro-Gate wie heute über `whop-access`.

### Shopify-Tabellen im Modell (für die pausierte Session „Shopify OAuth Stufe 1“)

**Die Migration `20261022000001_shopify.sql` bleibt unverändert** — Namen, Spalten, Funktionen.
Eingehängt wird sie in der Migration von Phase 1 (spätere Zeitstempel):

1. `integrations.company_id` bekommt einen Fremdschlüssel auf `companies(id)`
   **`on delete cascade`** (Firma weg → Integration und Eingang weg; gebuchte Verkäufe liegen
   in `records` und sind davon unabhängig). Hinzufügen als `not valid`, dann `validate` nach
   dem Backfill der Firmen.
2. `sync_shopify_integration_speichern` prüft zusätzlich: `p_user` ist `owner` von
   `p_company` in `company_members`, sonst Exception. Damit entfällt die Annahme
   „company_id nur auf Format geprüft“. `api/shopify-install.js` prüft dasselbe schon vor
   dem Redirect (Funktion `firma_rolle(p_user, p_company)`).
3. `integrations`, `shopify_eingang` bekommen **keine** Nutzer-Policy: Zugriff weiter nur über
   die `sync_shopify_*`-Funktionen (Webhook kennt keinen Nutzer, nur den Shop). Für die
   Oberfläche (Stufe 3) eine eigene Lese-Funktion `shopify_status(p_user, p_company)`, die
   über `company_members` prüft.
4. `shopify_eingang` bekommt eine Spalte `gebucht jsonb` (IDs der erzeugten Verkäufe/Retouren)
   — nur Verweis für die „Prüfen“-Liste.
5. **Doppelimport-Schutz** wandert vom Browser (`sale.quelle`) in die DB:
   `records.quelle = 'shopify:<shop>:<order_id>[:<teil>]'` mit dem Unique-Index oben;
   Erstattungen `'shopify:<shop>:refund:<refund_id>'`.
6. **Stufe 2 / B2 (Server-Adapter):** Node rechnet mit `js/shopify-buchung.js` den Plan;
   dafür liefert `shopify_kontext(p_company, p_skus text[])` Lagerartikel zu den SKUs,
   Kleinunternehmer-Status und „hat die Firma §25a-Artikel“. Gebucht wird in **einer**
   Postgres-Funktion `shopify_buchen(p_shop, p_order_id, p_plan jsonb)`: Eingangszeile
   `for update`, Verkäufe/Retouren über dieselbe interne Schreibfunktion wie der Browser
   (Audit, Sperre, Nummernkreis), Obergrenze „Erstattung ≤ offener Betrag“ dort, dann
   `status = 'verarbeitet'`. Aufrufer ist der Webhook bzw. ein Cron.
7. Reihenfolge: Shopify B2 braucht Phase 1–4 für die Arten `sales`, `purchases` (Lager),
   `retouren`. Bis dahin kann die Shopify-Session nur: Migration in stackr-preview prüfen
   lassen (User), Partner-Account-Punkte, Stufe-3-UI-Entwurf ohne Endpunkt.

## 2. Umstellung von `store.js` — Schritt für Schritt

Kern: **Lesen bleibt synchron aus `Store._cache`**, nur dessen Quelle und der Schreibweg ändern
sich. Dadurch müssen die ~40 Module, die `Store.getX()` synchron aufrufen, nicht async werden.

| Phase | Was | Wer führt | Prüfbar durch |
|---|---|---|---|
| **P1 Spiegel** | Neuer Endpunkt `api/data.js` (`pull`, `push`, `changes`). `store.js` zerlegt jede Schreibung (`_idbPut`) in Datensatz-Diffs (alt/neu je `id`) und schickt sie in eine Outbox (IndexedDB) → Server. Lesen weiter lokal. Neues Modul `js/server-store.js` (Regel 11), `store.js` bekommt nur einen Haken in `_idbPut`/`_idbDelete`. | Browser | Prüfsumme je Firma Browser vs. Server, täglich; Test in `test/` |
| **P2 Server liest mit** | Beim Start Cache aus Server laden statt IndexedDB (IndexedDB = Offline-Kopie). Mehrgeräte: `changes since seq` beim Fokus und alle 60 s. Konflikt: Schreiben mit erwarteter `version` → 409 → Server-Stand übernehmen, Hinweis. Kein LWW-Merge mehr. | Server (Daten) | 2-Geräte-Test, je Firma umschaltbar (`companies.server_fuehrt`) |
| **P3 Regeln auf den Server**, je Modul | Nummernkreise (Rechnung, Eigenbeleg, Retoure) → Server vergibt. Festschreibung/`isLocked` → Server lehnt ab. Audit-Log → Server schreibt im selben Statement. Readonly-Firma → Rolle. Reihenfolge: Rechnungen → Eigenbelege → Verkäufe/Einkäufe/Lager → Retouren → Ausgaben/AfA/Privat → Rest. Browser-Prüfungen bleiben als UI-Vorwarnung. | Server (Regeln) | je Modul eigener Test, Browser-Test auf frischem Port |
| **P4 Aufräumen** | Cloud-Sync, Tombstones, `_scopeKeys`, Merge-Code, Auto-Backup in OPFS/FS-Ordner entfernen bzw. auf Export reduzieren. | — | Grep, Testlauf |

**Offline — entschieden (User, 2026-10-22): offline nur lesen.** Die Outbox
überbrückt kurze Aussetzer (Minuten), aber keine Offline-Arbeit über Stunden — sonst
kollidieren server-vergebene Nummern und Festschreibung. Bei Netzverlust Banner „nur lesen“.

**Speicher-Grenzen:** Vercel-Body 4,5 MB → `push` in Stücken; Anhänge gehen nie durch
`api/data.js`, sondern als signierte Upload-URL in den Bucket (Muster `api/blob-upload.js`).

## 3. Migration der Bestandskunden

1. Nach Login prüft die App je Firma: auf dem Server vorhanden? Wenn nein → Dialog
   „Umzug in die Stackr-Cloud“ mit Erklärung (lesbar auf Server, Anbieter, Zweck) und
   **ausdrücklicher Bestätigung**; ohne Bestätigung kein Upload.
2. Datenquelle in dieser Reihenfolge: lokaler Cache → falls leer und Cloud-Sync aktiv: Pull +
   Entschlüsseln im Browser (vorhandener `CloudSync`-Code, Wiederherstellungscode nötig) →
   falls nichts: Import einer Backup-Datei (auch verschlüsselte, `js/backup-crypto.js`, und
   Local-1.7-Bundle).
3. Upload über `api/data.js` `action: migrate` je Firma, in Stücken, dann `migrate_commit`:
   Server prüft die Hash-Kette des Audit-Logs, übernimmt sie unverändert (alte Einträge
   behalten ihre Hashes; ab dem ersten Server-Eintrag kettet der Server weiter) und schreibt
   einen Audit-Eintrag „Datenübernahme aus Browser, n Datensätze, SHA-256 des Bundles“.
   Der Abgleich gegen `sync_anchors` (falls vorhanden) wird im Protokoll vermerkt.
4. Nach Erfolg: lokale Daten bleiben als Offline-Kopie; Cloud-Sync-Chiffrat des Nutzers wird
   nach 30 Tagen gelöscht (mit Hinweis).

**Kunden, die sich nie wieder einloggen — entschieden (User, 2026-10-22):** Der Server hat nur
Chiffrat und kann nichts umziehen. Stichtag 6 Monate nach Livegang; bis dahin bleibt der alte
Cloud-Sync **nur lesend** (Pull für den Umzug). Ankündigung per E-Mail (Whop-Kundenliste) bei
Livegang und 4 Wochen vor Stichtag (Vorwarnung). Danach altes Chiffrat löschen; Daten im Browser des Kunden
bleiben, die App bietet für nicht umgezogene Firmen nur noch Export + Umzug an. Kein
dauerhafter Local-only-Modus (doppelte Pflege).

## 4. GoBD auf dem Server

- **Festschreibung:** `perioden` ist führend. Trigger `before update or delete on records`:
  abgelehnt, wenn `gesperrt_grund` gesetzt ist (storniert, gegengebucht, manuell) oder
  `datum` in festgeschriebener Periode liegt. Korrektur nur per Storno/Gegenbuchung
  (neue Zeile). Rückdatierte Neuanlage in gesperrter Periode bleibt erlaubt, mit Hinweis
  (§153 AO, wie heute `_warnIfPeriodLocked`).
- **Protokoll:** jede Schreibfunktion schreibt im selben Statement in `audit_log` (wer =
  Whop-user_id, wann = Serverzeit, alt/neu). Hash-Kette serverseitig mit `sha256()`
  (eingebaut ab PG 11). `audit_log`: kein UPDATE/DELETE-Recht für irgendeine App-Rolle,
  Trigger wirft zusätzlich. Echtes Löschen offener Datensätze bleibt erlaubt, aber nur mit
  Protokolleintrag (wie heute).
- **Unveränderbarkeit nachweisbar:** täglicher Anker (letzter Hash je Firma) in eine
  getrennte, nur anhängbare Tabelle; optional später extern (z. B. Mail an Ops-Alarm).
- **Aufbewahrung:** Belege 8 Jahre (seit BEG IV, ab 2025), Bücher/Abschlüsse 10 Jahre
  (§147 AO, §257 HGB). Pflicht trifft den Kunden; Stackr muss Export in maschinell
  auswertbarer Form liefern (Datenzugriff Z3). **Nach Kündigung — entschieden (User,
  2026-10-22):** 90 Tage Lesen + Export, dann Löschung mit Vorwarnung (E-Mail vor Ablauf).
  In AGB §7 und Verfahrensdokumentation aufnehmen; der Kunde bleibt für die Aufbewahrung
  selbst verantwortlich.
- **Datensicherung — entschieden (User, 2026-10-22): kein PITR**, die täglichen Pro-Backups
  (7 Tage) reichen. Bewusst in Kauf genommen: im Ernstfall bis zu **einem Tag Datenverlust**.
  Das gehört ausdrücklich in die Verfahrensdokumentation (Abschnitt Datensicherung). Löschanfragen (Art. 17) wirken auf Backups erst nach deren Ablauf; dokumentieren.
- **Verfahrensdokumentation:** `compliance/gobd-verfahrensdokumentation.md` umschreiben
  (Speicherort, Rollen, Festschreibung, Protokoll, Datensicherung inkl. „bis zu 1 Tag
  Datenverlust, kein PITR“, 90-Tage-Frist nach Kündigung, Zugriff durch Stackr).

## 5. Recht (Anwalt-Freigabe vor Livegang)

- **Rollenwechsel:** Stackr wird für die Buchhaltungsdaten **Auftragsverarbeiter** der
  Kunden (darin: Namen/Anschriften ihrer Kunden auf Rechnungen). → **AVV Stackr ↔ Kunde**
  (Art. 28) als Anlage zu den AGB, mit Subprozessorliste.
- **Subprozessoren:** Supabase (DPA im Dashboard abschließen; Supabase Inc., USA, Daten in
  Frankfurt, SCC/DPF), Vercel (verarbeitet jetzt **Klartext** in den Functions — DPA prüfen),
  Whop (unverändert), Shopify (nur bei Nutzung, Datenquelle). Transfer-Impact-Assessment
  analog `compliance/transfer-impact-assessment-whop.md` für Supabase und Vercel.
- **Datenschutzerklärung** (`datenschutz.html` Z. 82, 110–119, 187, 225–234, 430): E2E- und
  „verlassen dein Gerät nicht“-Aussagen ersetzen; neuer Abschnitt Speicherung beim Anbieter,
  Speicherdauer, Empfänger, Umzug.
- **AGB** (`agb.html` §2 Z. 222, §7 Z. 216–230): Leistungsbeschreibung (serverseitige
  Speicherung, Verfügbarkeit), §7 Daten nach Kündigung, Export, Aufbewahrung; Änderung der
  AGB nach §9 mit Ankündigung an Bestandskunden.
- **Art. 30:** `compliance/verzeichnis-verarbeitungstaetigkeiten.md` — eigene Tätigkeiten
  neu + Verzeichnis als Auftragsverarbeiter (Art. 30 Abs. 2).
- **Art. 32 TOMs:** Verschlüsselung at rest (Supabase), TLS, RLS-Konzept, Zugriff durch
  Stackr-Admins (wer, wie protokolliert), Backups, Schlüssel (Shopify-Token,
  Whop-Sitzung bleiben zusätzlich verschlüsselt).
- **Art. 35:** Schwellwertprüfung dokumentieren; Empfehlung: kurze DSFA trotzdem
  (Finanzdaten vieler Betroffener, Steuerberater-Zugriff, US-Anbieter).
- **Landing:** `index.html` Z. 79, 113, 173 (JSON-LD-FAQ), `landing-v2.html` — „lokal in
  deinem Browser“/„Ende-zu-Ende“ ersetzen. **Erst am Tag des Livegangs** umstellen, vorher
  wäre es falsch.
- **Umzug selbst:** Info + Bestätigung im Dialog (Abschnitt 3) — Rechtsgrundlage ist der
  Vertrag (Art. 6 Abs. 1 b), die Bestätigung dient der Transparenz und dem technischen
  Upload, ist keine Einwilligung im Sinne von Art. 6 Abs. 1 a. (Anwalt bestätigen lassen.)

## 6. Was aus den bestehenden Bausteinen wird

| Baustein | Während Umzug | Danach |
|---|---|---|
| Cloud-Sync (`js/cloud-sync.js`, `api/sync.js`, `sync_*`) | nur Pull + Entschlüsseln für den Umzug; Push gesperrt sobald Firma umgezogen | entfernen nach Stichtag; Tabellen leeren, Migration zum Droppen |
| Backup-Krypto (`js/backup-crypto.js`) | Import alter verschlüsselter Backups | bleibt **nur zum Einlesen** alter Dateien; neue Exporte unverschlüsselt (JSON/CSV/DATEV) vom Server |
| Auto-Backup OPFS/FS-Ordner in `store.js` | weiter | entfernen; Server-Backups + Export ersetzen es |
| Offline-Grace (signiertes Grace-Token) | weiter | nur noch für die Offline-Lesekopie; Gate liegt jetzt wirklich auf dem Server (Daten gibt es nur mit gültiger Sitzung). Eintrag „Whop-Gate umgehbar“ in 02-ENTSCHEIDUNGEN umschreiben |
| StB-Read-only (`js/stb-share.js`, ECDH-Grants) | alte Grants lesbar | ersetzt durch `company_members.rolle = 'stb_lesen'`; Einladung per Code, Widerruf = `revoked_at`. Pubkeys/Grants-Tabellen droppen |
| Blob/Storage `attachments` (Chiffrat) | weiter | neuer Bucket für Klartext-Anhänge; alter nach Stichtag leeren |
| `sync_anchors` | als Beweis beim Umzug | danach Server-Hash-Kette |

## 7. Reihenfolge und Abhängigkeiten

```text
R0  Fragen geklärt (F2–F5 User, F1/F6 Annahme) — erledigt 2026-10-22   ─┐
R1  Recht anstoßen: Supabase-DPA, Vercel-DPA prüfen, Anwalt-Termin      │ parallel
    (DPAs geprüft 2026-10-28: beide automatisch wirksam, nichts zu unterschreiben —
    Supabase v1 01.08.2026 über ToS, Dashboard Org-Settings → Legal Documents;
    Vercel vercel.com/legal/dpa Stand 17.03./wirksam 31.03.2026, gilt für Pro, Team
    aiprojektdj-spec ist Pro. Offen: Anwalt-Termin, Subprozessor-Benachrichtigungen)
R2  Migration Phase 1 — gebaut, Preview offen (companies, members, records, settings, ─┘
    nummernkreise, perioden, audit_log, anhaenge, auth_cache, RLS,
    Shopify-FK) → stackr-preview (User führt aus), RLS-Testfälle
R3  api/_auth.js + api/data.js (pull/push/changes/migrate) + Tests      ← R2  — gebaut 2026-10-29
R4  P1 Spiegel in js/server-store.js, nur für Testfirma                 ← R3
R5  Umzugsdialog + migrate (Abschnitt 3), Prüfsummen-Vergleich          ← R4
R6  P2 Server liest mit, je Firma umschaltbar; 2-Geräte-Test            ← R5
R7  P3 Regeln je Modul (Rechnungen → Eigenbelege → Verkauf/Lager →     ← R6
    Retouren → Rest); StB-Rolle
R8  Rechtstexte + Landing final, Anwalt-Freigabe                        ← R1, vor R9
R9  Livegang: prod-Migration, Ankündigung, Stichtag setzen              ← R7 (mind. Verkauf/
                                                                          Lager/Retoure/Rechnung), R8
R10 Shopify B2 (shopify_kontext, shopify_buchen) + Stufe 3 UI           ← R7 für sales/
                                                                          purchases/retouren
R11 P4 Aufräumen nach Stichtag                                          ← R9 + 6 Monate
```

Jeder neue Endpunkt (`api/data.js`) und jede CSP-Zeile in `vercel.json` (pro Route) vorher
mit dem User abstimmen. Prod-Migrationen führt der User aus, nie eine Session.

## 8. Entscheidungen (Stand 2026-10-22)

| Nr. | Thema | Stand |
|---|---|---|
| F1 | RLS-Weg | **Annahme E-A** (eigene Rolle + `set_config`, Browser nur über `api/`) — nicht vom User gefragt, technische Empfehlung übernommen |
| F2 | Offline | **User:** nur lesen |
| F3 | Nicht umgezogene Kunden | **User:** Stichtag 6 Monate, danach altes Chiffrat löschen, mit Vorwarnung |
| F4 | Nach Kündigung | **User:** 90 Tage Lesen + Export, dann Löschung mit Vorwarnung |
| F5 | PITR | **User:** nein; tägliche Pro-Backups, bis zu 1 Tag Datenverlust bewusst akzeptiert (→ Verfahrensdokumentation) |
| F6 | Datenmodell | **Annahme:** jsonb-Datensatztabelle `records` statt Fachtabellen — nicht vom User gefragt, technische Empfehlung übernommen |

## Annahmen

- F1 (RLS-Weg E-A) und F6 (jsonb-Datensatztabelle) — siehe Abschnitt 8.

- Die Browser-Firmen-ID (`co_…`) wird Primärschlüssel in `companies` (kein Umschlüsseln,
  Shopify-`integrations.company_id` passt dadurch ohne Änderung).
- `stackr_app` ohne BYPASSRLS ist in Supabase anlegbar und als Funktionseigentümer
  RLS-gebunden — erst in stackr-preview bestätigen.
- Aufbewahrungsfristen 8/10 Jahre nach Stand BEG IV; Anwalt/StB bestätigen.
