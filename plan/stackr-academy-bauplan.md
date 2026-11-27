# Stackr Reseller Academy – Bauplan Phase 0 und 1

Einzige Wahrheit für die Academy-Arbeit im Stackr-Repo. Stand immer gegen den Code prüfen.
Koordination: Hauptsession „Stackr Reseller Academy Phase 0/1“ (2026-11-26). Teil-Sessions auf Sonnet,
je eigener Worktree/Branch, **nichts pushen** (Push auf master veröffentlicht).

Stand: 2026-11-27, gegen Code geprüft (master 030ad3c; drei Branches je 172–173 Tests grün, untereinander konfliktfrei).

## Pakete

| WP | Inhalt | Status | Besitzer | Dateien | Commit |
|---|---|---|---|---|---|
| WP0 | Kursseite `reseller-academy.html` + `css/reseller-academy.css`, CSP-Route, Alt-Domain-Weiterleitung | **fertig, geprüft** (Branch `claude/gifted-dubinsky-00c0c2`, gemergt 2026-11-27) | academy-seiten | `reseller-academy.html`, `css/reseller-academy.css`, `vercel.json`, Tests Weiterleitung | dde20ee |
| WP1 | Dubletten, Zeilennummer+Grund, Fehlerdatei, Periodensperre | **erledigt** für 5 CSV-Importe (Pakete 0–2, 6, 7, 9) | – | `js/import-*.js` | 8c95efe, 7d05106, 701b7b1, 9a26369, c411497, 39eca76 |
| WP1-Rest | Excel-Vorlage-Import: Periodensperre + Bericht (Fachmodul); Schalter „alle Dubletten“ | **fertig, geprüft** (Branch `claude/focused-mcnulty-0e7990`, gemergt 2026-11-27) | import-rest | `js/import-excel-vorlage.js` (neu), `js/app.js` (nur Block), `js/import-lager.js`, Tests | 52aef6e |
| WP2 | Format-Doku | Doku **erledigt** (`docs/IMPORT-FORMATE.md`); Seite + statische Vorlage **fertig, geprüft** (Branch `claude/gifted-dubinsky-00c0c2`) | academy-seiten | `import-formate.html`, `vorlagen/stackr-lager-vorlage.csv`, `test/test-vorlage-statisch.js` | d0f49dd |
| WP3 | Lagerort, Kategorie, Tags, Notizen, Gebühr EUR | **erledigt** (Pakete 3, 4) | – | – | a052512, 0baa454 |
| WP3-Rest | Zustand, Einkaufsnebenkosten | **zurückgestellt** (Datenmodell-Änderung; Steuerwirkung Nebenkosten auf EÜR/Wareneinsatz klären) | – | – | – |
| WP4 | Einkaufs-CSV, Ausgaben-CSV, Lager-Export Rundlauf, Eigenbeleg-CSV | **erledigt** (Pakete 5–9) | – | – | bc67ab2, 54fae25, 9a26369, c411497, 39eca76 |
| WP5 | Spike Bonus Variante B → ADR-0003 (proposed) | **Entwurf fertig** (Branch `claude/objective-euler-d79816`), 18 Aussagen unbelegt | bonus-spike | `docs/decisions/0003-bonus-codes-variante-b.md`, `docs/decisions/README.md` | cb71bc5 |
| WP6 | Bonus-Seite `stackr-bonus.html` (noindex, ohne Code, Bedingungen als Platzhalter) | **fertig, geprüft**, Bedingungen als Platzhalter | academy-seiten | `stackr-bonus.html`, `vercel.json` | fefbffa |
| WP7 | Verifikation, Gesamtbericht | offen | Koordination | dieser Bauplan | – |
| ADR KI | Schnittstelle für KI-Automatisierung | **erledigt** als ADR-0002 (proposed) | – | `docs/decisions/0002-*.md` | e8d15c9 |

Dateibesitz: `vercel.json` nur academy-seiten. Importcode (`js/import-*.js`, `js/app.js`-Importblock) nur import-rest.

## Entscheidungen (2026-11-26, Plan-Freigabe mit Voreinstellungen)

- WP3-Rest (Zustand, Nebenkosten) zurückgestellt.
- Excel-Vorlage-Import wird an die CSV-Importe angeglichen (gesperrte Periode → Zeile übersprungen, Bericht).
- Arbeit in eigenen Worktrees statt Branch-Wechsel im geteilten Working Tree; Merge nach master nur mit User-Freigabe.
- Roter Test `test-csp-meta-header.js` stammt von fremder, ungetrackter `stackr-zahlen-im-blick.html`; in Worktrees nicht vorhanden.
- Kein `Disallow` in robots.txt für die noindex-Seiten (sonst sieht Google das noindex nicht).

## Fragen an den User (offen)

0. ~~Branches mergen~~ erledigt 2026-11-27 lokal (474fa0b, eb022d9, 38c347e), **nicht gepusht**; 177 Tests grün.

1. Bonus-Mechanik: Promo-Code 100 % für 6 Monate (bucht ab Monat 7 automatisch ab, Hinweispflicht [ZU PRÜFEN]) oder Einmal-Plan mit „Zugang automatisch ablaufen lassen“? Bestimmt Text der Bonus-Seite. ADR-0003 empfiehlt: fester Code an Einmal-Plan mit 6-Monats-Ablauf binden (A + C); für Variante B zuerst Sandbox-Probe `has_access` (B3, 1–2 Tage), sonst B1 Webhook+Support-Chat (2–3 Tage), E-Mail-Dienst (B2, 4–6 Tage + AVV) nur wenn nötig.
2. Test-Promo-Code `TEST_BONUS_PRUEFUNG` im Kurs-Business laut Selbstbericht noch aktiv → von Hand beenden.
3. Preise, Zugangsdauer, Widerruf, Bonus-Bedingungen, Rechtstexte: offen (Platzhalter).

## Für den Live-Gang vormerken (nicht jetzt)

- `noindex` entfernen, Eintrag in `sitemap.xml`, Link in Navigation/Footer, ggf. `Allow` in `robots.txt`.
- Whop-Checkout-Links in der Kursseite (`<a rel="noopener">`).

## Phase 2 und 3 (nicht bauen)

- Rechtsseiten (Kurs-AGB, Widerruf, Bonus-Bedingungen)
- Checkout-Weg Kurs → Stackr
- Partner-/Affiliate-Seite
- Webhook-Umsetzung Variante B (nach ADR-0003)
- Hinweis in der App vor Bonusende

## Auswirkung auf den Kurs (Kursprojekt nicht ändern, nur melden)

`kurs/stackr-integration.md` und `prompts/99-stackr-bruecke.md` stehen auf Stackr-Commit a193591. Seitdem neu und dort nachzuziehen:
- Einzeilen-Format Artikel+Verkauf, CSV-Vorlage `stackr-lager-vorlage.csv`, Lager-Export im Importformat (Rundlauf)
- Dublettenvorschau mit Auswahl; Bericht mit Zeilennummer/Grund; Fehlerdatei `import-fehler.csv`
- Gesperrte Perioden: Zeilen werden übersprungen
- Neue Felder im Lager-Import: Lagerort, Warenkategorie, Tags, Notizen; Gebühr wahlweise in EUR
- Neu: Ausgaben-CSV, Eigenbeleg-CSV (als unbestätigte Belege), Einkaufs-CSV im Buchungen-Dialog mit Tausendertrennern
- Formatquelle für Kurs und KI-Prompts: `docs/IMPORT-FORMATE.md` (öffentlich bald als `import-formate.html`)
- Nicht vorhanden: Zustand, Einkaufsnebenkosten (Kurs darf sie nicht versprechen)

- Excel-Vorlage-Import (Backup & Daten): jetzt mit Vorschau, Dubletten, Periodensperre, Bericht und Fehlerdatei; leeres Datum = heute, ungültiges Datum = Fehler; Dublettenschalter „Alle an/aus“.
