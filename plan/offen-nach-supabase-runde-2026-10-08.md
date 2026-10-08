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
- [ ] **DATEV-Export** (Fragen aus PR #16):
  - 0-%-Rechnungen (Reverse Charge, §25a, steuerfrei): **A** = nur ungewöhnliche Sätze wie 19 %,
    0 % bleibt steuerfrei (empfohlen) · **B** = alles außer 7 % als 19 % (würde bei Reverse Charge
    nicht geschuldete USt erzeugen). Dazu: bleibt BU-Schlüssel `40` für 0 %?
  - AfA im Buchungsstapel: (a) Anlagekonto je Anlage · (b) ein Sammelkonto · (c) bleibt draußen.
  - Retouren: (a) Gegenbuchung auf dem Erlöskonto · (b) eigenes Konto „Erlösschmälerungen“.
  - Steuerberater fragen: Sind die Abschreibungskonten 4840/6200 richtig, oder 4830/6220?
- [ ] **Alarm-Log `api/_alert.js`**: Es schreibt heute nach Vercel Blob (zweites Ziel neben Make).
  Supabase-Tabelle als Ersatz, oder reicht Make allein? Blockiert das spätere Entfernen von
  `@vercel/blob`.

## 2. Zum Launch (erst dann, wegen E6)

Reihenfolge einhalten. Rückweg ist jeweils: Variablen tauschen bzw. entfernen.

1. [ ] Supabase-Organisation auf **Pro**, Spend Cap setzen.
2. [ ] Storage → Settings: projektweite Upload-Grenze **≥ 200 MB**.
3. [ ] **Migrationen ausführen** (SQL-Editor, Dateinamen-Reihenfolge, alle aus `supabase/migrations/`):
   - Prod `usrhhjwvoefjdgrwovkg`: fehlt nur `20261008000001_whop_sessions.sql`
     (die anderen fünf sind drin, Stand 2026-10-07 geprüft).
   - Preview `nvtjzeffngwfsqjzdrdz`: alle sechs.
   - Prüfen: `anon` darf keine `sync_*`-Funktion ausführen, alle Tabellen haben RLS.
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
