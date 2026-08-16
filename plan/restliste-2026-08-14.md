# Restliste — Stand 2026-08-14

Was aus dem Vollaudit 2026-08-10 (17 Audits, 70 Funde) **heute noch offen ist**.

**Jede Zeile wurde am 2026-08-14 gegen den Code geprüft**, nicht aus älteren Notizen übernommen.
Die Restliste in [`funde-gesamt-2026-08-10.md`](funde-gesamt-2026-08-10.md) stammt vom 13.08. und
ist inzwischen an mehreren Stellen überholt — **F2 steht dort noch als offen, ist aber gebaut**
(`Utils.ensureXlsx()` in [js/utils.js:60](../js/utils.js), alle sechs Aufrufstellen umgestellt).

Begründungen zu jedem Fund stehen in der jeweiligen Einzeldatei; hier steht nur, **was zu tun ist**.

---

## Bevor du anfängst

An diesem Repo arbeiten **mehrere Sessions im selben Working Tree**. Die Spalte „Datei" sagt, ob
eine Datei gerade von jemand anderem gehalten wird — Stand 2026-08-14, das ändert sich stündlich.

```bash
git status --short && git log --oneline -8
```

- Datei taucht in `git status` auf → **nicht anfassen**, per `send_message` abstimmen.
- Immer pfad-gescoped committen (`git add -- <datei>`), nie `git add -A`.
- Nach Änderungen an Steuer-/GoBD-nahen Dateien den zugehörigen Test laufen lassen —
  die Zuordnung steht in [`naechste-session-2026-08-12.md`](naechste-session-2026-08-12.md), Abschnitt 4.

```bash
for f in test/*.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done
```

---

## 1. Kleine Fixes — ✅ alle sieben erledigt (2026-08-14, Commit `6103208`)

Im Browser gegengeprüft (lokaler Server, `app.html` + `lager/`). Zwei Dinge, die beim Bauen
anders waren als hier notiert:

- **A2:** der oben vorgeschlagene Wert **`#4a5651` reicht nicht** — 2,5:1 gegen `--bg-input`,
  2,13:1 gegen `--bg-elevated`. Gebaut wurde `#636f68` (dunkel) / `#868173` (hell), gegen alle
  fünf Flächen gerechnet, schwächster Fall 3,11:1.
- **N3:** `landing.js` ruft `setBilling()` beim Laden **nicht** auf — der statische HTML-Zustand
  *ist* der Startzustand. Preis, Beschreibung und Checkout-Link mussten deshalb mitgezogen
  werden, ebenso der Satz über dem Umschalter (nannte 15 €).

| # | Aufgabe | Ergebnis |
|---|---|---|
| **V2** | PWA-Manifest verlinken | `<link rel="manifest">` in allen 4 Seiten; `manifest.json` + `icon-stackr.svg` erstmals mit committet |
| **A4** | Skip-Link (WCAG 2.4.1) | in `app.html`; `.skip-link` fehlte auch in `css/style.css`. `<main id="mainContent" tabindex="-1">` als Ziel. Hinter dem Whop-Gate ist der Link per `inert` gesperrt — so gewollt |
| **A5** | `<nav>` ohne `aria-label` | Topnav „Anwendungen", Sidebar „Module". Topnav war ein `<div>`; alle Selektoren darauf sind klassenbasiert |
| **A2** | Feldrand 1,47:1 statt 3:1 | `--border-field`, genutzt in `.form-input`/`.form-select`/`.form-textarea` |
| **L3** | AGB aus der App nicht erreichbar | Footer-Zeile auf allen 4 App-Seiten |
| **N3** | Preisumschalter startet auf „Monatlich" | startet jetzt auf „Jährlich", Umschalten in beide Richtungen geprüft |
| **D4** | `whop_user` speichert die ganze Userinfo-Antwort | nur noch `{ id, username }`; `datenschutz.html` präzisiert |

**Zur Dateilage:** Beim Anfassen lag in denselben Dateien noch eine fertige, nicht committete
CSP-/Cookie-Banner-Arbeit einer Parallel-Session. Sie wurde **getrennt** vorweg committet
(`9f712cf`), damit beide Themen einzeln nachvollziehbar bleiben.

---

## 2. Größere Bauaufgaben

| # | Aufgabe | Aufwand | Warum es zählt |
|---|---|---|---|
| ~~**D1**~~ | ~~jsDelivr self-hosten~~ | — | ✅ **erledigt 2026-08-15** (`c41603f`). Fünf Bibliotheken + Symbolschrift liegen in `js/vendor/` und `css/vendor/`, jede beim Herunterladen gegen den bisherigen SRI-Hash geprüft. `cdn.jsdelivr.net` steht in keiner CSP mehr — auch nicht in `vercel.json`. Mit erledigt: der CSP-Verstoß „inline style", der **nicht** von einer CDN-Library kam, sondern aus `js/whop-auth.js` (Spinner-Keyframes) — der Login-Spinner stand still |
| **U2** | First-Run-Dashboard | mittel | Nach dem Onboarding sechs 0,00-€-Kacheln und null CTAs. Der Trial ist 7 Tage lang — das ist das ganze Aktivierungsfenster |
| **U7** | 24 Leerzustände ohne CTA | modulweise | dazu „gefunden" statt „noch keine" in leeren Listen. Am besten je Modul beim Vorbeikommen |
| ~~**V1**~~ | ~~Theme-Umschalter ist `display:none`~~ | — | ✅ **erledigt 2026-08-15** (`4c77a1d`). Neu `js/theme.js`, drei Zustände auf allen vier App-Seiten. Der Hinweis zu `isDark` traf genau zu — `dashboard.js` (2×) und `statistiken.js` lasen `matchMedia` und hätten bei manueller Wahl die falsche Chart-Palette gerechnet. Die helle Palette hängt jetzt an `data-theme` statt an `@media`, sonst bräuchte es zwei Kopien von 39 Token-Zeilen |
| **M1/M2/M4** | Landing-Copy | Textarbeit | E-Rechnungs-FAQ prominenter (kostet bei Lexware den 32,90-€-Tarif, bei Stackr in 15 € enthalten), Sozialbeweis, Preisanker. **M2 braucht echte Kundenstimmen — nichts erfinden** |
| **D3** | `oyi_device_owner_uid` überlebt den Logout | klein | Whop-User-ID bleibt nach dem Abmelden im Browser. **Nicht blind löschen** — hängt am Geräte-Reset-Schutz. Entweder serverseitig ableiten oder in `datenschutz.html` dokumentieren |

---

## 3. Deine Entscheidungen — nicht durch Coden lösbar

Diese Punkte blockieren Folgearbeit. Solange sie offen sind, sollte niemand daran bauen.

| # | Frage | Kontext |
|---|---|---|
| **N1** | **Woher kommen neue Nutzer?** | Seit der Local-Einstellung ist die Landingpage der einzige Eingang. Vorher gab es eine kostenlose Offline-Basis |
| **N5 / P4** | Ein Preis oder eine Staffel? | 15 € liegt über jedem Einstiegstarif der Konkurrenz (lexoffice 7,90 · FastBill 9 · Papierkram 9,90 · sevDesk 12), und ein Free-Tier gibt es nicht mehr. Zusatzfrage: eigener Tarif für Mehr-Firmen-Nutzer und Steuerberater |
| **P2 / P5** | Positionierung | drei Personas werden beworben, eine wird gewonnen. GbR ist der stärkste unbesetzte Markt |
| **R5** | Sync-Schlüssel nicht-extrahierbar machen? | Kostet „Code erneut anzeigen" — der einzige Weg, ein zweites Gerät anzubinden, wenn der Code verloren ging. Sicherheit gegen XSS **gegen** Aussperr-Risiko |
| **G2 / G4** | PSD2-Bankanbindung · OCR | beide brechen potenziell Local-First. OCR nur als Browser-OCR (Tesseract.js) sinnvoll |
| **D0-Rest** | Läuft Vercel Analytics überhaupt? | Im Vercel-Dashboard nachsehen. Ist es **aus**, können die sechs `<script>`-Tags weg und der neue Absatz in `datenschutz.html` wieder raus. Ist es **an**, ist alles korrekt offengelegt |

---

## 4. Wartet auf Dritte

Nichts davon ist durch Arbeit im Repo lösbar — nur nachhalten.

- **Anwalts-Freigabe:** AGB §11 (Empfehlungsprogramm) und die §356a-Trial-Klausel. Beide Texte sind geschrieben und im Text selbst als „Freigabe offen" vermerkt.
- **Whop-DPA / AV-Vertrag** nach Art. 28 DSGVO *(Audit 11, L5)*.
- **Upstash-DPA** — analog. Upstash ist als Verarbeiter benannt, ein abgeschlossener AV-Vertrag ist im Repo nirgends belegt. Sonst bleibt Art. 28 für zwei von vier Verarbeitern ungedeckt.
- **Echter 2-Profil-Cloud-Sync-Test** — braucht zwei echte Whop-Logins, machst du selbst.
- **Make.com-Webhook-Livetest.**
- **§25a, 7-%-Satz** — juristische Recherche zu Anlage-2-Fällen.

---

## 5. Termine, die sonst niemand bemerkt

- **2026-12-01** — der AAD-Migrations-Fallback in `js/cloud-sync.js` läuft ab (`AAD_FALLBACK_UNTIL`). Danach den `catch`-Zweig in `_decryptCt` und die Konstante **ersatzlos entfernen**; `test-aad-fallback-ablauf.js` prüft, dass die Datumssperre wirkt.
- **Jahreswechsel 2027/28** — in `Ausgaben._getKsaWerte()` den dann veröffentlichten KSA-Abgabesatz ergänzen. Ohne Eintrag rechnet Stackr mit 5,0 % weiter — bewusst so, ein zu hoher Schätzwert ist besser als eine stille Unterzahlung.
- **Quartalsweise** — `js/vendor/VERSIONS.md`: Advisories prüfen. Seit D1 (2026-08-15) sind es **neun** Dateien statt zwei — zu SheetJS und Chart.js kamen gsap, notyf, flatpickr (+ de-Locale), apexcharts und die Tabler-Symbolschrift. Keine davon ist von `npm audit` erfasst, es kommt **keine Warnung von allein**; die Advisory-URLs stehen je Zeile in der Tabelle. **Nie `npm install xlsx`** — das Paket steht bei 0.18.5 und holt die CVEs zurück.

---

## 6. Bewusst nicht zu fixen

Damit das nicht bei jedem Audit neu aufschlägt:

| # | Fund | Warum nicht |
|---|---|---|
| R1 | Gate per Konsole umgehbar (`App._continueAfterAuth`) | Local-First-Tradeoff. Der Wert liegt in den Server-Features, nicht im Client-Gate |
| R9 | Grace-Token gegen Uhr-Rückstellung ungeschützt | R1 ist der einfachere Weg — den zu schließen lohnt zuerst |
| R10 | Rate-Limits fail-open bei Redis-Ausfall | bewusst richtig. Nur Alerting ergänzen |
| G1 | ELSTER-Direktübermittlung | ERiC bräuchte einen Klartext-Server. Zur Haltung machen und stattdessen anleiten |
| G7 | Team-/Mehrbenutzerzugang | die Gerätesperre bindet auf eine ID |
| M3 | „kostenlose Version" auf der Landing | seit der Local-Einstellung wäre das irreführend. **Erledigt durch Weglassen** |
| P1 | Local ist ungegated | gegenstandslos, Local wird nicht mehr gepflegt |
| Hex-Farben in `steuerberater.js`, `companies.js`, `statistiken.js`, ICON-Maps | — | eigenständiges HTML-Dokument · Farbwähler-Nutzdaten · Canvas ohne CSS-Variablen · Icon-Maps |

---

## Was seit dem 12.08. erledigt wurde

Nur zur Abgrenzung, damit nichts doppelt angefasst wird:

`F1`–`F4`, `F7` (Performance, kritischer Pfad) · **`F2`** (xlsx lazy, entgegen der Liste vom 13.08.) ·
`C1`/`C2` (fehlende CSS-Klassen) · `A1`/`A3` (Akademie per Tastatur, Foto-Zelle) ·
`U5`, `U6`, `U9`, `U10` · `L1`/`L2` (eine AGB-Fassung, Zustimmung mit Versionsstand) ·
`N2` (Trial-Status wird durchgereicht und im Dashboard angezeigt) · `P6` (Akademie nach Branche) ·
`D2` (Anker-Liste offengelegt, Begründung auf Art. 17 Abs. 3 lit. b umgestellt) ·
`D0` (Reichweitenmessung offengelegt statt bestritten) · `R2`–`R8`, `T1`–`T7`, `S1`–`S6`, `G5`, `G6`.

**2026-08-14:** der komplette Abschnitt 1 — `V2`, `A4`, `A5`, `A2`, `L3`, `N3`, `D4` (`6103208`).

**2026-08-15:** aus Abschnitt 2 `D1` (`c41603f`) und `V1` (`4c77a1d`).

**`G3` ist ebenfalls gebaut** — entgegen älteren Notizen. Der Zahlungsabgleich Einnahme ↔ offene
Rechnung existiert seit dem 2026-08-12 ([js/bank-import.js:307](../js/bank-import.js)), inklusive
Teilzahlung, Erstattungs-Sonderfall und der richtigen Vorsichtsregel: „Vorschläge werden nie
ungefragt gebucht — nur angehakte Zeilen."
