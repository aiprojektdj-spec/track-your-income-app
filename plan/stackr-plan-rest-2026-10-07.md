# Stackr-Plan: was noch offen ist

Stand 2026-10-07, geprüft gegen `origin/master` (`a175ac3`) und die offenen PRs.
Gesamtplan: `Desktop/CFC/STACKR_PLAN_2026-10-06.md` (außerhalb des Repos).
Detailstand des Speicher-Umzugs: [`supabase-umzug-2026-10-06.md`](supabase-umzug-2026-10-06.md).

👤 = du (Konten, Schlüssel, Zahlungen, Freigaben) · 🤖 = Claude (Code, Tests, Prüfung)

## Entschieden (2026-10-06)

| | Entscheidung |
|---|---|
| E1 | E2E bleibt. Supabase speichert nur Chiffrat, Fremddaten später per Sealed Box |
| E2 | Whop bleibt Login und Zahlung |
| E3 | Kein `supabase-js`, kein `tweetnacl`, Supabase nur aus `api/` per `fetch` |
| Belege | Privater Bucket, Abruf nur über signierte URLs |

## Noch zu entscheiden

| # | Frage | Wer |
|---|---|---|
| D1 | **Supabase auf Pro** — entschieden 2026-10-07: ja, aber erst wenn die ganze Infrastruktur gebaut ist. Bis dahin Free, keine Env-Variablen, nichts umschalten (Free: 50-MB-Upload-Grenze, Pause nach 7 Tagen, keine Backups) | 👤 später |
| D2 | Eigenes Preview-Projekt (`stackr-preview`) anlegen oder Preview ganz ohne Supabase lassen? Preview und Production teilen sich heute Redis | 👤 |
| D3 | E4: Shopify als Custom/Unlisted App (Empfehlung) oder öffentliche App-Store-App? | 👤 |
| D4 | UI-Entwurf für Phase 3 wählen: `stackr-entwurf-1..3`, `stackr-fokus-*`, `stackr-lyra` | 👤 |

## Phase 0 – Konten

| | Punkt | Stand | Wer |
|---|---|---|---|
| 0.1 | Vercel Pro | erledigt (`275dfa7`) | – |
| 0.2 | Supabase-Projekt `usrhhjwvoefjdgrwovkg`, Frankfurt | angelegt, aber Free (→ D1) | 👤 |
| 0.3 | AV-Vertrag mit Supabase | offen | 👤 |
| 0.4 | Shopify Partner-Account + Development Store | offen | 👤 |
| 0.5 | 3 UptimeRobot-Monitore (`/`, `/app`, `/api/health`), healthchecks.io `Stackr blob-cleanup` + `HEARTBEAT_URL_BLOB_CLEANUP` | offen seit 04.10. | 👤 |

## Phase 1 – Speicher-Umzug auf Supabase

### Code (Struktur fertig bauen, ohne umzuschalten)

| | Punkt | Stand |
|---|---|---|
| 1.1 | Sync-Adapter, Belege nach Storage, Fehlerzähler, Health, Rate-Limits in `whop-token`/`whop-access` | ✅ live |
| 1.2 | Migrationen 0001–0004 im Supabase-Projekt | ✅ ausgeführt, Rechte geprüft |
| 1.3 | **`api/sync.js` lehnt `sb:`-Ledger-Referenzen ab** (prüft auf `https://`). Ein übergroßes Ledger-Chiffrat ginge im Supabase-Modus nicht mehr durch | PR #17 offen → mergen vor `BLOB_BACKEND=supabase` |
| 1.4 | Whop-Refresh-Sitzungen (`whop-token`, `whop-refresh`) | PR #18 offen. Empfindlichster Teil: fällt er aus, fliegen Kunden stündlich raus |
| 1.5 | Byte-Budget, Commit-Sperre, Rate-Limit in `api/blob-upload.js` | PR #21 offen (Migration `20261008000002_blob_budget.sql`, SQL gegen PGlite geprüft) |
| 1.6 | `api/_alert.js` legt Alarme in Vercel Blob ab. Neues zweites Alarmziel wählen (z. B. Supabase-Tabelle), sonst fällt es mit Blob weg | offen, niemand dran |
| 1.7 | Neue Migrationen aus PR #18 und 1.5 im Supabase-Projekt ausführen | nach dem Merge, 🤖 per Edge |

### Umschalten (erst nach D1)

| # | Schritt | Wer |
|---|---|---|
| U1 | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in Vercel eintragen (Sensitive) | 👤 |
| U2 | Upload-Grenze im Supabase-Dashboard auf ≥ 200 MB | 👤 |
| U3 | `STORAGE_MIRROR=supabase` → Dual-Write, Alarme beobachten | 👤 |
| U4 | `scripts/backfill-sync-supabase.js --write`, dann `--check` (Exit 0) | 👤 führt aus, 🤖 begleitet |
| U5 | Ein paar Tage beobachten, `--check` erneut | 👤/🤖 |
| U6 | `STORAGE_BACKEND=supabase`, `STORAGE_MIRROR=redis`. Rückweg = Variablen tauschen | 👤 |
| U7 | `BLOB_BACKEND=supabase`, dann `scripts/backfill-blob-supabase.js --write` und `--check` | 👤 |
| U8 | 14 Tage beobachten, `STORAGE_MIRROR` leeren | 👤 |
| U9 | Upstash abschalten, `@vercel/blob` entfernen (erst wenn 1.4–1.6 erledigt) | 🤖 Code, 👤 Konten |

### Recht und Doku zum Umzug

| | Punkt | Stand |
|---|---|---|
| R1 | Datenschutzerklärung, Verarbeitungsverzeichnis, `CLOUD-SYNC.md`, Landing-Text: Supabase rein, Upstash/Vercel Blob raus | Entwurf liegt (`53afb39`, `aa8ca74`), live erst **beim** Umschalten |
| R2 | Offene Rechtsfragen F1–F13 | Session-Prompt liegt (`62d82a7`) |

## Phase 2 – Shopify-Connector (nach Phase 1)

Nichts begonnen. Voraussetzung: 0.4 und D3.

- [ ] Shopify-App, OAuth (`install`/`callback`), HMAC-Prüfung, `state` gegen CSRF
- [ ] Scopes klein halten; `read_all_orders` bei Shopify beantragen (ältere Bestellungen als 60 Tage)
- [ ] Access-Token verschlüsselt in `integrations`
- [ ] Webhooks `orders/paid`, `orders/updated`, `refunds/create`, `app/uninstalled`
- [ ] Pflicht-Webhooks Datenschutz: `customers/data_request`, `customers/redact`, `shop/redact`
- [ ] Jeder Webhook: HMAC prüfen → mit Nutzer-Pubkey versiegeln → `inbox` → 200
- [ ] Erstimport per GraphQL Admin API
- [ ] Buchungslogik im Browser (`js/shopify-import.js`): Bestellung, Erstattung, Gebühren, Auszahlungsabgleich, OSS, §25a, Lagerabgang, Doppelimport-Schutz
- [ ] `test/test-shopify-import.js` mit anonymisierten Payloads

## Phase 3 – UI-Umbau (parallel möglich)

Voraussetzung: D4.

- [ ] Design-Tokens, beide Themes WCAG AA (hell heute nur 20/45 Paarungen ≥ 4,5:1)
- [ ] Navigation in 5 Gruppen statt flacher Liste, Module nach Rechtsform ausblenden
- [ ] Dashboard „Was ist zu tun“ (Belege, Fristen, offene Rechnungen, Shopify-Inbox)
- [ ] Mobil: Beleg fotografieren → OCR → buchen in drei Taps
- [ ] Onboarding: Rechtsform, Kleinunternehmer, Shop verbinden, Bank-Datei

## Phase 4 – Funktionen für eine vollwertige Buchhaltung

| # | Funktion | Aufwand |
|---|---|---|
| 4.1 | E-Rechnung empfangen und erzeugen (XRechnung/ZUGFeRD) | M |
| 4.2 | Bank-Anbindung per API (finAPI, Tink, Enable Banking vergleichen) | L |
| 4.3 | Weitere Marktplätze: eBay, Etsy, Vinted, PayPal, Stripe | je M |
| 4.4 | Mahnwesen, wiederkehrende Rechnungen, Angebote | M |
| 4.5 | ELSTER-Übermittlung UStVA | XL |
| 4.6 | Steuerberater-Zugang ausbauen (PR #16 offen: Paket rechnet EÜR aus einer Quelle) | S |
| 4.7 | Belegeingang per Mail-Adresse | M |
| 4.8 | Mehrere Nutzer pro Firma (GbR-Partner) | L |
| 4.9 | Öffentliche API / Zapier | L |

## Phase 5 – Betrieb und Recht (laufend)

- [ ] AGB: Shopify-Connector, Haftung für Importe
- [ ] Verfahrensdokumentation um Server-Speicherung und Importe ergänzen
- [ ] Backup-Restore-Test Supabase, einmal pro Quartal (braucht Pro, → D1)
- [ ] Incident-Runbook um Supabase und Shopify erweitern
- [ ] Security-Audit nach Phase 1 und nach Phase 2
- [ ] Preis prüfen: 15 €/Monat ist mit Shopify und Bank-API eher niedrig

## Als Nächstes

1. 👤 D1 entscheiden (Supabase Pro), danach U1 und U2.
2. 🤖 PR #17, #18 und den `blob-upload`-PR prüfen und mergen lassen, neue Migrationen ausführen.
3. 🤖 1.6 `_alert.js` übernehmen (niemand dran).
4. 👤 D3/D4 entscheiden, damit Phase 2 und 3 starten können.
