# R2-Preview-Test: Migrationen und RLS (2026-10-29)

Auf dem Supabase-Branch `stackr-preview` (ref `uitmdqlspvqottrxsdft`, von stackr-prod, ohne Daten)
getestet. Der Branch ist **danach gelöscht** worden, Kosten unter 1 $.

## Eingespielt (in dieser Reihenfolge)

Der Branch hatte nur 4 der Prod-Migrationen (die Basis-Tabellen von Prod stehen nicht in der
Migrationshistorie). Nachgespielt: `20261006000001_sync`, `…06000002_storage`,
`…07000001_client_errors`, `…07000002_aufraeumen`, `…09000001_search_path` (erneut, nach den
sync-Funktionen), `…10000001_service_role_tabellenrechte`, `…15000001_anker_unverdraengbar`.
Danach neu: `20261022000001_shopify`, `20261022000002_server_datenmodell`,
`20261024000001_kuendigungen`, `20261026000001_shopify_loeschfrist`, `20261026000002_loeschplan`,
`20261028000001_server_umzug`. Alle fehlerfrei.

**Annahme aus dem Plan bestätigt:** Die Rolle `stackr_app` (nologin, nobypassrls) lässt sich in
Supabase anlegen und als Eigentümer der SECURITY-DEFINER-Funktionen einsetzen.

**Hinweis für Prod:** Reihenfolge wie oben. `…000001_shopify` nie nach `…000002` erneut
ausführen, sonst fällt die Owner-Prüfung in `sync_shopify_integration_speichern` weg.

## Zugriff (RLS), aufgerufen als service_role wie `api/`, 14/14 bestanden

1. A legt Firma an → `angelegt`
2. B übernimmt dieselbe Firmen-ID → 42501
3. A schreibt Verkauf → ok
4. B schreibt in Firma A → 42501 „kein Schreibrecht“
5. B liest Datensatz von A → null
6. B holt Änderungen von A → 42501
7. Gleiche `quelle` (Shopify-Doppelimport) → `doppelt`
8. Falsche Version → `konflikt`
9. service_role liest `records` direkt → 42501
10. Shopify-Integration durch Nicht-Owner → 42501
11. Shopify-Integration durch Owner → ok
12. B sieht Shopify-Status von A → 42501
13. anon liest `records` → 42501
14. anon ruft `firmen_lesen` → 42501
15. A sieht eigenen Shopify-Status → 1 Eintrag
16. A ändert offenen Verkauf → Version 2

## GoBD, 8/8 bestanden

1. A schließt 2025 ab (als stackr_app) → ok
2. B schließt Periode von A ab → RLS verweigert
3. `audit_log` ändern → verweigert (Tabellenrecht, Trigger als zweite Linie)
4. `audit_log` löschen → verweigert
5. Verkauf im abgeschlossenen Jahr direkt löschen → SR001
6. Verkauf im abgeschlossenen Jahr ändern über `datensatz_schreiben` → `gesperrt`
7. Neues Jahr buchbar, Nummernkreis zieht 1
8. Hash-Kette im `audit_log` lückenlos (4 Einträge)

## Prüfliste a–k aus test/test-server-datenmodell.js

Zusätzlich geprüft von der Session „DPAs Supabase + Vercel (R1)“ auf demselben Branch vor dem
Löschen (jeweils mit Rollback):

- b) `stackr_app`: `rolbypassrls = f`, `rolcanlogin = f`
- c) `aenderungen_seit`, `audit_uebernehmen`, `datensatz_schreiben`, `firma_anlegen`,
  `shopify_status` gehören `stackr_app` und sind SECURITY DEFINER
- f) nur `gesperrt_grund` setzen → ok
- g) update/delete/truncate auf `audit_log` als postgres → SR002; Kette 0 Brüche bei 9 Einträgen
- i) StB schreibt → 42501; StB `aenderungen_seit` liefert Daten
- k) `audit_uebernehmen` → 2, zweiter Aufruf 0, `details` byte-gleich 2/2
- d, e, h, j durch die Fälle oben abgedeckt

**Offen: a)** Ein zweiter Lauf von `20261022000002` (Wiederholbarkeit) wurde nicht ausgeführt.
Statisch ist die Datei wiederholbar (`if not exists`, `create or replace`, `drop … if exists`).

## Security-Advisor

Nur INFO `rls_enabled_no_policy` auf den 16 Tabellen, auf die nur service_role zugreift.
Gewollt so (Zugriff ausschließlich über `api/`). Keine WARN/ERROR.

## Nicht abgedeckt

- `api/data.js` und `api/_auth.js` gegen die echte Datenbank (R3), nur die SQL-Ebene geprüft.
- Speicher-Bucket `attachments` und die Anhang-Tabellen ohne Datei-Upload.
- Last, Nebenläufigkeit (zwei Schreiber gleichzeitig).
