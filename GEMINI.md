# Stackr — Einführung für Gemini / Antigravity

Diese Datei erklärt dir als Agent, was Stackr ist, wie das Repo aufgebaut ist, wo Daten liegen
und welche Regeln hier gelten. Die verbindlichen Projektregeln stehen in [`CLAUDE.md`](CLAUDE.md)
— sie gelten für dich genauso. Lies sie vor der ersten Änderung.

Antworten, Code-Kommentare und Berichte auf **Deutsch**. Commit-Messages ohne Umlaute
(ae/oe/ue/ss).

---

## 1. Was Stackr ist

Stackr ist eine **Buchhaltungs-Web-App für Selbstständige in Deutschland**, mit Schwerpunkt auf:

- **Reseller mit Warenbestand** (Vinted, eBay, Shopify, Flohmarkt) — Lager, Einkauf/Verkauf,
  Differenzbesteuerung §25a UStG, Plattformgebühren, Retouren
- **Kleinunternehmer** nach §19 UStG (Umsatzgrenzen je Jahr über `App._getUstGrenzen(year)`)
- **GbR** (mehrere Gesellschafter, Gewinnverteilung)
- Regelbesteuerung (USt-Voranmeldung, Soll/Ist, Reverse Charge, OSS)

Funktionsumfang (rund 28 Module plus 3 Sub-Apps): Einnahmen/Ausgaben, **EÜR**,
USt-Voranmeldung, Rechnungen inkl. **E-Rechnung** (XRechnung/ZUGFeRD, geprüft mit KoSIT),
Mahnwesen, **DATEV-Export**, Bank-Import (CSV), Beleg-OCR (lokal mit `tesseract.js`),
AfA, Fahrtenbuch, Materiallager, Kassenbuch, Statistiken, Steuerberater-Zugang (nur lesen),
Eigenbelege, Shopify-Anbindung (OAuth).

**GoBD** ist Kernanforderung: offene Buchungen dürfen gelöscht werden (mit Protokoll),
festgeschriebene nur storniert. Audit-Log und Periodensperre sind Pflicht, nicht optional.

Geschäftsmodell: 15 €/Monat oder 135 €/Jahr, 7-Tage-Trial, Hard-Gate (kein Free-Tier).
Login und Zahlung laufen komplett über **Whop** (Merchant of Record).
Domain: getstackr.de (die alte Domain führt noch, Daten hängen am Origin).

## 2. Technik

| | |
|---|---|
| Frontend | **Vanilla JS, kein Build-Schritt, kein Framework.** HTML-Seiten laden `js/*.js` direkt |
| Hosting | Vercel, statisch + Serverless-Funktionen in `api/` |
| Abhängigkeiten | genau eine produktive: `@vercel/blob`. **Keine neue ohne Rückfrage** |
| Vendor | SheetJS 0.20.3 in `js/vendor/`, SHA-256 in `js/vendor/VERSIONS.md`. **Nie `npm install xlsx`** (CVEs) |
| Tests | Node-Harnesses in `test/` (über 170), laufen in der CI (`.github/workflows/tests.yml`) |
| CSP | in `vercel.json` **pro Route**, nie global |

### Ordner

| Pfad | Inhalt |
|---|---|
| `app.html` | Haupt-App (hinter dem Whop-Gate) |
| `index.html`, `landing-v2.html`, `*.html` im Root | Landing, SEO-Ratgeberseiten, Rechtstexte (AGB, Datenschutz, Impressum) |
| `rechnungen/`, `lager/`, `eigenbelege/` | Sub-Apps |
| `admin/` | Admin-Panel (Login + TOTP) |
| `js/` | Module. `app.js`, `store.js`, `lager.js` sind groß und historisch — **dort keine neue Logik**, sondern Fachmodule wie `js/app-ust.js` |
| `api/` | Serverless-Endpunkte; Dateien mit `_` sind Helfer, keine Endpunkte |
| `supabase/migrations/` | SQL-Migrationen (Tabellen, RLS, Postgres-Funktionen) |
| `test/` | Node-Tests |
| `plan/` | Planungsnotizen. **Veralten schnell — Stand immer gegen den Code prüfen** |
| `SPEC.md`, `THREAT_MODEL.md`, `docs/decisions/` | Invarianten, Sicherheitsmodell, ADRs |
| `plan/02-ENTSCHEIDUNGEN.md` | Was bewusst **nicht** geändert wird — vor jedem Audit lesen |

Wichtige Endpunkte in `api/`: `whop-token.js`/`whop-refresh.js`/`whop-access.js` (Login,
Sitzung, Zugangsprüfung), `sync.js` (verschlüsselter Cloud-Sync), `data.js` (neue
serverführende Datenhaltung), `blob-upload.js` (Anhänge), `blob-cleanup.js` (täglicher Cron,
u. a. Löschung 30 Tage nach Abo-Ende), `shopify-*.js`, `kontakt.js`, `kuendigung.js`,
`client-error.js`, `health.js`.

## 3. Wo die Daten liegen

### Im Browser des Nutzers (heute führend)
- **IndexedDB** — Hauptspeicher aller Buchhaltungsdaten (`js/store.js`, Key-Value je Firma).
- **localStorage** — Firmenliste und aktive Firma (`oyi_companies`, `oyi_active_company`),
  Geräte-ID, Spiegel-/Sentinel-Schlüssel, Schalter wie `stackr_server_spiegel`.
- Achtung: Daten hängen am **Origin** (alte Domain ≠ getstackr.de) und Safari kann sie nach
  7 Tagen ohne Besuch löschen.

### Auf dem Server
| System | Was | Wo im Code |
|---|---|---|
| **Supabase** (Postgres, EU) | Sync-Snapshots, Whop-Sitzungen, Blob-Budget, Fehlerprotokolle, Shopify-Tokens, Kündigungen, Löschplan, Admin-Tabellen, und das neue lesbare Datenmodell (`companies`, `records`, `settings`, …) | `api/_db.js` (PostgREST per fetch, Service-Key nur serverseitig), `supabase/migrations/` |
| **Upstash Redis** (Frankfurt) | bisheriger Speicher für Sync und Whop-Sitzungen; Umzug nach Supabase per `STORAGE_BACKEND`/`STORAGE_MIRROR` | `api/_sync-store.js`, `api/_whop-sessions.js` |
| **Vercel Blob** | Anhänge/Belege (privat, signierte URLs); Alternative Supabase Storage per `BLOB_BACKEND` | `api/_storage.js`, `api/blob-upload.js` |
| **Whop** | Konten, Abos, Zahlungen, E-Mail-Adressen | `api/_whop-mitglieder.js`, `api/_auth.js` |

Cloud-Sync (`js/cloud-sync.js`, `api/sync.js`) speichert **nur Chiffrat**; der Schlüssel
verlässt das Gerät nie. Der neue Weg `js/server-store.js` → `api/data.js` speichert
**lesbare** Daten in Supabase (RLS je Whop-User und Firma) und ist je Firma umschaltbar
(`companies.server_fuehrt`). Plan: `plan/server-umbau-2026-10-22.md` — gegen den Code prüfen.

Secrets liegen ausschließlich als Vercel-Umgebungsvariablen (`SUPABASE_SERVICE_ROLE_KEY`,
`WHOP_*`, `KV_REST_API_*`, `BLOB_READ_WRITE_TOKEN`, `SHOPIFY_*`, …), nie im Repo.

## 4. Regeln für dich (Kurzfassung von CLAUDE.md)

1. **Mehrere Agenten arbeiten gleichzeitig in diesem Ordner.** Vor jeder Arbeit
   `git status --short`. Dateien, die dort als geändert auftauchen, gehören gerade jemand
   anderem — nicht anfassen.
2. **Nie** `git add -A`, `git add .`, `git commit -a` oder `git commit` ohne Pfad.
   Immer `git commit -F <datei> -- <pfad>`. **Committe und pushe nur, wenn der User es sagt.**
3. Dateien als **UTF-8 ohne BOM** schreiben. Nie über PowerShell `Set-Content`/`Out-File`
   (zerstört Umlaute).
4. **Kein Bypass des Whop-Logins**, kein Selbst-Login. Tests hinter dem Login macht der User.
5. **Gesetzeswerte** (Grenzen, Sätze, Pauschalen) nur in Jahresfunktionen, nie als feste
   Konstante. Muster: `App._getUstGrenzen(year)`.
6. **Keine stillen Annahmen** bei Steuerlogik, Rundung, Datenformat: nachfragen. Nötige
   Annahmen im Bericht unter „Annahme:“ nennen.
7. **Kleinste Lösung.** Keine neue Abstraktion, die der Auftrag nicht braucht. Vorher per
   Suche prüfen, ob es den Helfer schon gibt.
8. **Kein externer KI-Dienst** im Produkt ohne Rückfrage. Keine echten Kundendaten,
   Backups (`backup_*.json/zip`), `.env*` oder `compliance/` lesen oder irgendwohin senden.
9. Rechenlogik über `test/` absichern. Vor Abschluss alle Tests laufen lassen:
   `for f in test/*.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done`
   Wo Rundung geprüft wird, **strikt** vergleichen (kein Epsilon).
10. Browser-Tests lokal: `python -m http.server <neuer Port>` — jeder Test auf einem frischen
    Port, weil der Browser sonst alten Code aus dem Cache liefert.

## 5. Deine Aufgaben

Stehen in [`plan/antigravity-aufgaben.md`](plan/antigravity-aufgaben.md). Ergebnisse als
Bericht unter `plan/antigravity/` ablegen; Code-Änderungen nur auf einem eigenen Branch und
ohne Commit, solange der User nichts anderes sagt.
