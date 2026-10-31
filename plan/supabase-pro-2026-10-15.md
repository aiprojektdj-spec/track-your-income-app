# Supabase Pro: was jetzt zu tun ist

Stand: 2026-10-15. Live im Konto geprüft (Supabase-Connector, nur lesend), nicht gegen Plandateien.
Hintergrund und Risiken: [`supabase-umzug-2026-10-06.md`](supabase-umzug-2026-10-06.md),
Restliste: [`offen-nach-supabase-runde-2026-10-08.md`](offen-nach-supabase-runde-2026-10-08.md).

Rollen: 👤 = du (Dashboard, Schlüssel, Vercel), 🤖 = Claude (Code, Prüfungen, Texte).

## Was das Pro-Upgrade freischaltet

E6 („bis zum Launch Free-Plan, kein Spiegel, kein Umschalten“) ist damit erfüllt. Der Umzug
Upstash Redis + Vercel Blob → Supabase kann weiterlaufen. Der Code ist fertig und schaltet nur
über Env-Variablen um; ohne Variablen ändert ein Deploy nichts.

## Live-Stand (2026-10-15)

| Punkt | Stand |
|---|---|
| Organisation | **Pro** ✅ |
| Prod `usrhhjwvoefjdgrwovkg` („stackr-prod“) | Frankfurt, aktiv, 13 Tabellen, 32 `sync_*`-Funktionen ✅ |
| Bucket `attachments` | privat, Objektgrenze 200 MB ✅, 0 Objekte |
| Daten in Prod | **3 Zeilen `sync_snapshots`, 3 Zeilen `whop_sessions`** — klären, woher (Test? Spiegel schon aktiv?) |
| Preview `nvtjzeffngwfsqjzdrdz` | existiert laut User noch, wurde aber in eine **andere Organisation** verschoben (der Supabase-Connector sieht nur die Pro-Organisation). Bleibt in der CSP (`vercel.json`) |

## 1. Konto einrichten (👤, einmalig)

- [ ] **Spend Cap** prüfen: Organization → Billing → „Spend Cap“ an lassen, solange keine
      Kosten über Pro hinaus gewollt sind.
- [x] **Upload-Grenze:** Supabase erlaubt mit Spend Cap global nur 50 MB. Entscheidung
      2026-10-15: Spend Cap bleibt an, dafür `MAX_TOTAL_BYTES` in `api/blob-upload.js` von
      200 auf 50 MB gesenkt. Bucket-Grenze (200 MB) bleibt, die globale greift zuerst.
- [x] **Backups**: täglich, laufen (zuletzt 15.10. 01:40 UTC). Achtung: **Storage-Dateien sind
      nicht in den Backups**, nur die Datenbank.
- [ ] **Compute-Größe** lassen (Micro reicht für den Start, im Pro-Guthaben enthalten).
- [ ] **2FA** fürs Supabase-Konto an.
- [x] **Preview-Projekt** `nvtjzeffngwfsqjzdrdz` liegt in der Organisation **„Stackr Preview“
      (Free Plan)** — so gewollt, soll nicht dauerhaft laufen. Pausiert nach 7 Tagen ohne
      Nutzung; vor einem Preview-Test im Dashboard wieder starten. CSP-Eintrag bleibt.
- [x] **Die 3 Snapshots/3 Sitzungen in Prod** zuordnen: Spiegeldaten, keine Testdaten. Am
      2026-10-30 per Connector geprüft: der älteste Snapshot (2026-10-14 19:24 UTC) und der älteste
      Anker (19:24) liegen zwei Minuten nach der ersten gespiegelten Whop-Sitzung (19:22).

## 2. Vercel-Variablen (👤)

Production, Typ Sensitive. **In Preview keinen Spiegel setzen** — Preview teilt Redis mit
Production, sonst landen Chiffrate und Refresh-Tokens echter Kunden im Preview-Projekt.

- [ ] Prüfen, dass `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHOP_SESSION_KEY` in
      **Production** stehen (laut Notiz seit 2026-10-08).
- [ ] `WHOP_SESSION_KEY` zusätzlich im **Passwortmanager** sichern. Geht er verloren, sind alle
      Sitzungen in Supabase unlesbar. Nie tauschen.

## 3. Spiegel einschalten (👤 setzt, 🤖 begleitet)

- [x] `STORAGE_MIRROR=supabase` in **Production**, neu deployen. (Belegt durch die gespiegelten
      Daten seit 2026-10-14; die Variable selbst ist von hier aus nicht lesbar.)
      Ab jetzt schreibt jeder Sync, jede Freigabe und jede Whop-Sitzung zusätzlich nach Supabase;
      gelesen wird weiter aus Redis.
- [x] 🤖 `api/health.js` aufrufen: Supabase muss grün sein. Am 2026-10-30:
      `{"ok":true,"redis":"ok","supabase":"ok"}`, bis dahin kein `mirror-failed` in `ops_alerts`.
- [x] **Spiegel läuft seit 2026-10-14 ca. 21:22 Uhr** (erste Whop-Sitzung in Supabase,
      19:22 UTC; per Connector abgelesen). Bis 2026-10-15 kein `mirror-failed` in `ops_alerts`.
- **Frühester Umschalttermin: Nacht vom 13. auf den 14.11.2026** — 30 Tage Sitzungs-TTL (W1).
  `STORAGE_BACKEND` schaltet Sync und Whop-Sitzungen gemeinsam, deshalb gilt die Frist für alles.
  Jeder `mirror-failed` dazwischen setzt die Frist neu.

## 4. Altbestand kopieren (👤 führt lokal mit Prod-Werten aus, 🤖 begleitet)

```bash
node scripts/backfill-sync-supabase.js
```

```bash
node scripts/backfill-sync-supabase.js --write
```

```bash
node scripts/backfill-sync-supabase.js --check
```

- [ ] `--check` endet mit Exit 0, keine `ABWEICHUNG`.
      **Stand 2026-10-30: der Backfill ist noch nicht gelaufen** — der älteste Anker in Supabase
      ist vom Spiegelstart (2026-10-14 19:24), im Bucket `attachments` liegen 0 Belege.
- [ ] Belege: `node scripts/backfill-blob-supabase.js` (erst trocken, dann schreiben).
- Alles in einem Lauf: `output/backfill-supabase.sh` (fragt die Schlüssel verdeckt ab, gestartet
  2026-10-15). Neue Belege landen bis zum Umschalten weiter nur in Vercel Blob → in der
  Umschaltnacht `backfill-blob-supabase.js --write` und `--check` **noch einmal**.

## 5. Beobachten

- [ ] Einige Tage keine Alarme `sync`/`mirror-failed` oder `whop-session`/`mirror-failed`.
- [ ] `--check` erneut grün.
- [ ] Für die Whop-Sitzungen **mindestens 30 Tage** ab Schritt 3 ohne `mirror-failed`.
      Gab es einen, zählt die Frist neu.

## 6. Umschalten (👤, nachts — W6)

- [ ] Vorher `--check` grün.
- [ ] `STORAGE_BACKEND=supabase`, `STORAGE_MIRROR=redis`, `BLOB_BACKEND=supabase`, deployen.
- [ ] 🤖 im selben Zug: Datenschutzerklärung, Verarbeitungsverzeichnis, `CLOUD-SYNC.md`,
      Landing-Text nach [`rechtstexte-supabase-entwurf.md`](rechtstexte-supabase-entwurf.md)
      (Entwurf liegt, braucht deine Freigabe; erst **beim** Umschalten einbauen, nicht vorher).
- [ ] Ggf. Nutzer informieren (F10).

**Rückweg** = Variablen zurücktauschen — **aber erst nach `--check`**. Jede `ABWEICHUNG grant:…`
vorher in Redis löschen, sonst kann ein entzogener Steuerberater-Zugang zurückkommen (Befund B2).

## 7. Nach 14 Tagen stabil

- [ ] `STORAGE_MIRROR` leeren, deployen.
- [ ] Löschung bei Upstash belegen (F11), dann **Upstash abschalten**.
- [ ] 🤖 Alarmname `redis-fehlt` → z. B. `speicher-fehlt` umbenennen, 👤 Make-Filter gleichzeitig
      anpassen (W3).
- [ ] 🤖 Redis-Prüfung aus `api/health.js` entfernen.
- [ ] 🤖 Vercel-Blob-Ziel aus `api/_alert.js` entfernen (Ersatz `ops_alerts` läuft schon),
      dann `@vercel/blob` aus `package.json` und `*.public.blob.vercel-storage.com` aus der CSP.
- [ ] 👤 Vercel-Blob-Store und Upstash-Integration in Vercel löschen, `KV_REST_API_*` und
      `BLOB_READ_WRITE_TOKEN` entfernen.
- [ ] Rechtstexte: Upstash und Vercel Blob erst jetzt aus der DSE nehmen.

## Was du nicht tun musst

- Keine Migration erneut ausführen — alle neun sind in Prod.
  (Falls doch: danach `20261009000001_search_path.sql` noch einmal, sonst ist die search_path weg.)
- AV-Vertrag Supabase: gilt über die Terms, nichts zu unterschreiben.
- Kein `supabase-js`, kein Code-Umbau — E3 bleibt.
