# Offen nach der Supabase-Runde (Stand 2026-10-08)

Alle PRs der Runde (#13–#18, #22, #24, #25, #29, #30) sind gemergt, CI jeweils grün.
Der Umzug ruht laut **E6** bis zum Launch: Supabase bleibt im Free-Plan, in Vercel wird keine
Supabase-Variable gesetzt. Code ist für alle Speicherstellen fertig und schaltet per Env-Variable um.

Vor dem Abarbeiten gegen Code und Konto prüfen, nicht gegen diese Datei (CLAUDE.md, Regel 3).

---

## 1. Entscheidungen (du)

- [ ] **Prod/Preview bestätigen.** Laut Plandatei (aus PR #18):
  Prod = `usrhhjwvoefjdgrwovkg`, Preview = `nvtjzeffngwfsqjzdrdz` (Anzeigename „Stackr“ → in
  `stackr-preview` umbenennen). Die CSP in `vercel.json` zeigt auf das Prod-Projekt.
- [ ] **Supabase-DPA abschließen** (F1): Dashboard → Organization → Legal Documents → DPA.
  Geht auch im Free-Plan. Danach Datum in der Datenschutzerklärung nachziehen lassen.
- [x] **DATEV-Export** — entschieden und gebaut 2026-10-08 (Branch `claude/datev-alarm-2026-10-08`):
  - 0 %: weder A noch B, sondern **je Position nach Art** — ig. Lieferung 8125, Reverse Charge
    (Leistung) 8336, Ausfuhr 8120, §25a Marge 8191 / Rest 8193, sonst 8200; kein BU `40` mehr.
  - AfA: **(a)** Anlagekonto je Anlage, neues Feld „Anlagenart“ im Anlagenverzeichnis, dazu die
    Zugangsbuchung im Kaufjahr.
  - Retouren: **(a)** Gegenbuchung auf dem Erlöskonto des verknüpften Verkaufs.
  - AfA-Konten: **4830 / 6220** (4840 = außerplanmäßig, 6200 = immateriell) — keine StB-Frage mehr.
  - Beifund: rund die Hälfte der Kontentabelle war falsch (u. a. Bank SKR03 1800 = Privatentnahmen,
    SKR04 Wareneingang 19 %/0 % vertauscht, Kasse SKR04 1000). Korrigiert, je Konto ein Test.
- [x] **Alarm-Log `api/_alert.js`**: Supabase-Tabelle `ops_alerts` — war schon gebaut
  (`_writeSupabase`, Entscheidung 2026-10-07); Blob fällt beim Umzug weg.

## 2. Zum Launch (erst dann, wegen E6)

Reihenfolge einhalten. Rückweg ist jeweils: Variablen tauschen bzw. entfernen.

1. [ ] Supabase-Organisation auf **Pro**, Spend Cap setzen.
2. [ ] Storage → Settings: projektweite Upload-Grenze **≥ 200 MB**.
3. [x] **Migrationen** — am 2026-10-08 per Supabase-MCP geprüft: Prod und Preview haben dieselben
   13 Tabellen (alle mit RLS) und 32 `sync_*`-Funktionen; Prod trägt die frühen Migrationen nicht in
   der Historie (damals über den SQL-Editor), die Objekte sind aber da. Security-Advisor in beiden:
   kein `sync_*` für `anon` ausführbar. `function_search_path_mutable` am 2026-10-09 in beiden
   Projekten behoben (`20261009000001_search_path.sql`). Offen nur: die Supabase-eigene
   `rls_auto_enable()` ist für `anon` ausführbar (nicht von uns, bewusst nicht angefasst).
4. [ ] **Vercel-Variablen** (Sensitive, getrennt für Production und Preview):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (bisheriger JWT-`service_role`-Key, nicht
   `sb_secret_…`, solange nicht getestet), `WHOP_SESSION_KEY` erzeugen mit
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   und zusätzlich im Passwortmanager ablegen (geht er verloren, sind Sitzungen in Supabase unlesbar).
5. [ ] **Spiegel** nur in Production: `STORAGE_MIRROR=supabase`, neu deployen.
   In Preview **keinen** Spiegel setzen (Preview teilt Redis mit Production → sonst
   Produktionsdaten im Preview-Projekt).
6. [ ] **Backfill**: `scripts/backfill-sync-supabase.js --write`, dann `--check` (Exit 0),
   Belege: `scripts/backfill-blob-supabase.js`.
7. [ ] Einige Tage beobachten (keine `mirror-failed`-Alarme, `--check` erneut grün).
   Für Login-Sitzungen laut PR #18 mindestens 30 Tage Spiegel ohne Alarm, nachts umschalten.
8. [ ] **Umschalten**: `STORAGE_BACKEND=supabase`, `STORAGE_MIRROR=redis`, `BLOB_BACKEND=supabase`.
9. [ ] 14 Tage beobachten, dann `STORAGE_MIRROR` leeren.
10. [ ] Rechtstexte final (Entwurf in `plan/rechtstexte-supabase-entwurf.md`), Nutzer ggf. informieren (F10),
    Löschung bei Upstash belegen (F11).
11. [ ] Upstash abschalten, `@vercel/blob` entfernen (setzt Entscheidung zu `_alert.js` voraus).

Details und Risiken: `plan/supabase-umzug-2026-10-06.md`.

## 3. Nicht aus dieser Runde

- [ ] [#34](https://github.com/aiprojektdj-spec/track-your-income-app/pull/34) Plan: Domain-Umzug auf getstackr.de
- [ ] [#35](https://github.com/aiprojektdj-spec/track-your-income-app/pull/35) Redesign: Emojis, Hinweisboxen und Umlaute in den Fachmodulen

Beide stammen aus anderen Sessions und sind noch nicht geprüft.
