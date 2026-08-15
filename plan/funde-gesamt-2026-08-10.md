# Vollaudit 2026-08-10 — alle Funde am Stück

**Stand:** ✅ **alle 17 Audits abgeschlossen** (14 Datenschutz lief in einer Parallel-Session) · **Audit 04 bereits vollständig abgearbeitet** (Parallel-Session).
**Zweck:** Eine Datei zum Durchlesen und Abarbeiten. Jeder Fund in einer Zeile mit Ort und Fix.
Die ausführliche Begründung steht jeweils in der verlinkten Einzeldatei.
**Master:** [`audit-2026-08-10-masterplan.md`](audit-2026-08-10-masterplan.md) ·
**Statusliste:** [`OFFEN.md`](OFFEN.md)

---

## Auf einen Blick

| Audit | Funde | Schwerste |
|---|---|---|
| [01 Red-Team](funde-audit-01-red-team-2026-08-10.md) | 10 | 🟠 Gate per Konsole umgehbar · unbegrenzte Redis-Belegung |
| [02 UX-Journey](funde-audit-02-ux-journey-2026-08-10.md) | 12 | 🔴 Gate verschweigt den Trial · kein First-Run-Dashboard |
| [03 Feature-Gap](funde-audit-03-feature-gap-2026-08-10.md) | 10 | 🔴 Zahlungsabgleich fehlt · ELSTER |
| [04 Security-Delta](funde-audit-04-security-delta-2026-08-10.md) | 6 | ✅ **alle gefixt** (SheetJS → 0.20.3, Restore-Allowlist) |
| [05 Steuer-Vergleich](funde-audit-05-vergleich-steuer-2026-08-10.md) | 7 | 🔴 KSA-Satz ab 2027 falsch |
| [06 UI-Checker](funde-audit-06-ui-checker-2026-08-10.md) | 4 | 🔴 `.action-btn` nirgends definiert |
| [07 Product-Manager](funde-audit-07-product-manager-2026-08-10.md) | 6 | 🔴 Gratis-Local ist ungegated · 3 Personas, 1 bedient |
| [08 Copy/Marketing](funde-audit-08-copy-marketing-2026-08-10.md) | 6 | 🔴 E-Rechnung nur 1× erwähnt · kein Sozialbeweis |
| [09 Performance](funde-audit-09-performance-2026-08-10.md) | 7 | 🔴 Sub-Apps ohne `defer` · 929 KB xlsx bei jedem Start |
| [10 Steuer-Delta](funde-audit-10-steuern-delta-2026-08-10.md) | 2 | ✅ beide gefixt (7c07104) |
| [11 Compliance/Legal](funde-audit-11-compliance-legal-2026-08-10.md) | 6 | 🔴 Zwei widersprüchliche AGB-Fassungen |
| [12 Accessibility](funde-audit-12-accessibility-2026-08-10.md) | 5 | 🔴 Akademie per Tastatur unbedienbar (Level A) |
| [13 Monetarisierung](funde-audit-13-monetarisierung-2026-08-10.md) | 5 | 🔴 Trial in der App unsichtbar → Rückbuchungsrisiko |
| [14 Datenschutz](funde-audit-14-datenschutz-2026-08-10.md) | 10 | *(Parallel-Session, Commit f77e80e)* |
| [15 UI-Vergleich](funde-audit-15-vergleich-ui-2026-08-10.md) | 3 | 🟠 Theme-Umschalter versteckt · keine App/PWA |
| [16+17 Technik + Buchhaltung](funde-audit-16-17-vergleich-technisch-buchhaltung-2026-08-10.md) | 0 | ✅ **keine neuen Funde** — alles war erfasst |
| **Summe** | **70** | davon **17 erledigt** → 53 offen |

### Was wirklich noch offen ist — am Code verifiziert, 2026-08-13

Die Parallel-Sessions haben fast alles abgearbeitet. **Gegen den Code geprüft, nicht gegen ältere
Notizen** — diese Liste ersetzt alle vorherigen Prioritätslisten in dieser Datei.

**✅ Inzwischen erledigt** (stichprobenartig verifiziert): F1 (`defer` jetzt 31/31, 20/20, 19/19 in
den drei Sub-Apps) · F3 (`chart.min.js` aus eigenbelege raus) · F4 (4× `preload`) · C1 (`.action-btn`
12× in `style.css` definiert) · C2 (`.akademie-tip` definiert) · **A1** (Akademie: `role="button"`,
`tabindex="0"` **und** `_activate()`-Helper mit Enter/Space an allen drei Elementtypen) · U5
(§14-Vorabbanner beim Öffnen des Formulars, mit „Jetzt ergänzen"-Button) · U6 (Dirty-Guard in
`rechnungen/js/app.js`) · U9/U10 (`replaceState` + `document.title`) · N2 (Trial-Status, Commit
56534c6) · P6 (Akademie nach Branche sortiert) · dazu R2–R8, T1–T7, D1/D2, S1–S6, G3, G5, G6, L1/L2.

**Noch offen** — alle in Dateien, die andere Sessions gerade halten:

| # | Fund | Datei (Status) | Fix |
|---|---|---|---|
| **V2** | PWA — **`manifest.json` + `icon-stackr.svg` sind jetzt angelegt** | fehlt nur noch `<link rel="manifest" href="/manifest.json">` in den 4 HTML-Seiten *(belegt)* | 1 Zeile je Seite |
| A2 | `.form-input`-Rand 1,47:1 statt 3:1 (WCAG 1.4.11) | `css/style.css` *(belegt)* | `--border-field: #4a5651` einführen + in `.form-input/.form-select/.form-textarea` nutzen |
| A4 | Kein Skip-Link (WCAG 2.4.1) | `app.html` *(belegt)* | `<a href="#mainContent" class="skip-link">Zum Inhalt springen</a>` direkt nach `<body>` |
| A5 | `<nav>` ohne `aria-label` bei **zwei** Navigationen | `app.html` *(belegt)* | `aria-label="Anwendungen"` an die Topnav, `aria-label="Module"` an die Sidebar |
| V1 | Theme-Umschalter `display:none` | `app.html:65`, `css/style.css:723` *(belegt)*, `js/dashboard.js:454` *(frei)* | 3 Zustände (System/Hell/Dunkel); **`isDark` muss die manuelle Wahl mitlesen** |
| L3 | `agb.html` aus der App nicht verlinkt (§312i I Nr. 4 BGB) | 4 App-Seiten *(belegt)* | Footer-Zeile ergänzen, wo Impressum/Datenschutz stehen |
| N3 | Preisumschalter startet auf „Monatlich" | `index.html` *(belegt)* | `billing-btn-active` auf den Jahres-Button |
| F2 | `xlsx.full.min.js` (929 KB) lädt bei jedem Start | `app.html`, `lager/index.html`, `js/app.js`, `lager/page.js` *(belegt)* | `_ensureXlsx()` nach dem Muster von `_ensureApexCharts()` |
| M1/M2/M4 | E-Rechnungs-FAQ, Sozialbeweis, Wettbewerbs-Preisanker | `index.html` *(belegt)* | Textarbeit |
| U7 | 24 Leerzustände ohne CTA, „gefunden" statt „noch keine" | app-weit | modulweise |

---

## 01 — Red-Team
[Einzeldatei](funde-audit-01-red-team-2026-08-10.md) · Kein Fund erlaubt Zugriff auf fremde
Klardaten. XSS, CSRF, Callback-Replay, Secrets und Supply-Chain sind sauber. Die Probleme sind
**Umsatz und Betriebskosten**.

| # | Sev | Fund | Ort | Fix |
|---|---|---|---|---|
| R1 | 🟠 P1 | Gate per Konsole umgehbar (`App._continueAfterAuth`) | js/app.js:101 | **Nicht fixen** — Local-First-Tradeoff, Wert liegt in den Server-Features |
| R2 | 🟠 P1 | Unbegrenzt viele Scopes → ~200 GB/Tag Redis mit einem 15-€-Abo | api/sync.js:106 | Scope-Zähler + Byte-Budget in Redis |
| R3 | 🟡 P2 | Owner-Allowlist prüft **änderbaren Whop-Usernamen** statt `user_`-ID | whop-access.js:181, sync.js:184, blob-upload.js:142 | Auf `me.sub` umstellen, Env → `*_OWNER_IDS` |
| R4 | 🟡 P2 | 1 Pro-Abo kann unbegrenzt Gratis-Zugänge per StB-Grant erzeugen | api/sync.js:356 · whop-auth.js:372 | Grant-Deckel + Pubkey-Pflicht |
| R5 | 🟡 P2 | Sync-Key **und** Token als Rohwert in localStorage | cloud-sync.js:32,53 | Nicht-extrahierbarer `CryptoKey` in IndexedDB |
| R6 | 🟡 P2 | Blob-Upload ohne Speicher-Quota (28 GB/h möglich) | api/blob-upload.js:94 | `INCRBY blob:bytes:<userId>`, Deckel ~5 GB |
| R7 | 🟢 P3 | AAD-Migrations-Fallback hebelt Scope-Bindung für Alt-Chiffrat aus | cloud-sync.js:139 | Fallback mit Ablaufdatum versehen |
| R8 | 🟢 P3 | `get_pubkey` liefert `username` mit → Nutzer-Enumeration | api/sync.js:340 | `username` aus der Antwort entfernen |
| R9 | 🟢 P3 | Grace-Token gegen Systemuhr-Rückstellung ungeschützt | whop-auth.js:96 | **Nicht fixen** — R1 ist einfacher |
| R10 | 🟢 P3 | Rate-Limits fail-open bei Redis-Ausfall | alle 4 Endpunkte | **Nicht fixen** — bewusst richtig; nur Alerting |

---

## 02 — UX-Journey
[Einzeldatei](funde-audit-02-ux-journey-2026-08-10.md) · Handwerk stark (414 Toasts,
44-px-Targets, §-Begründungen in Fehlermeldungen). Alle Schwächen liegen in **den ersten
10 Minuten**.

| # | Sev | Fund | Ort | Fix |
|---|---|---|---|---|
| U1 | 🔴 | Landing nennt „7 Tage kostenlos" 20×, das Gate **kein einziges Mal** — gleicher Whop-Plan | whop-auth.js:541, 566 | Trial-Text in beide Gate-Screens |
| U2 | 🔴 | Kein First-Run-Dashboard: sechs 0,00-€-Kacheln, null CTAs | dashboard.js:25 | `if (keine Daten)` → 3 Aktionskarten |
| U3 | 🔴 | Wizard-Schritte 2–5 faktisch optional, aber ohne Skip und ohne Hinweis | app.js:1359 | `skipLink` auf Schritte 2–5 + „alles optional" |
| U4 | 🟠 | „Rechnung schreiben" 2 Ebenen tief unter „Finanzen" (7 Bereiche) | topnav.js:48 | Primär-Button „+ Rechnung" in die Topnav |
| U5 | 🟠 | §14-Pflichtangaben erst **beim Speichern** geprüft → Eingaben weg | rechnung.js:971 | Beim **Öffnen** prüfen, Banner statt Blocker |
| U6 | 🟠 | Sub-Apps ohne Ungespeichert-Warnung (Hauptapp hat eine) | rechnungen/, eigenbelege/, lager/ | `_formDirty`-Muster spiegeln |
| U7 | 🟠 | 24 Leerzustände, nur 5 mit CTA; „gefunden" statt „noch keine" | app-weit | CTA je Leerzustand, Text trennen |
| U8 | 🟠 | „Zurück" im Wizard korrigiert den Firmennamen nicht mehr | app.js:1440 | `CompanyManager.rename()` im else-Zweig |
| U9 | 🟡 | URL bleibt beim Navigieren stehen → Zurück-Taste verlässt die App | app.js:1341 | `history.replaceState` in `navigate()` |
| U10 | 🟡 | `app.html` heißt in jedem Tab nur „Stackr" | app.html | `document.title` in `navigate()` |
| U11 | 🟡 | ELSTER-CSV-Export endet ohne „so geht's weiter" | euer.js:1071 | Modal mit 3 Schritten statt Toast |
| U12 | 🟡 | Akademie **startet** mit Reselling (Modul 1+2); Inhalt ist zur Hälfte allgemein — *korrigiert in P6* | akademie.js:13 | Modulreihenfolge nach `d.branche` sortieren |

---

## 03 — Feature-Gap
[Einzeldatei](funde-audit-03-feature-gap-2026-08-10.md) · **Korrektur der Skill-Vorlage:**
Bank-Import, E-Rechnung, DATEV, Mahnwesen und Wiederkehrer **existieren alle**. 28 Module
registriert, nicht 12.

| # | Prio | Lücke | Bewertung |
|---|---|---|---|
| G3 | 🔴 P0 | **Zahlungsabgleich Rechnung ↔ Kontoumsatz** — Parser da, Einnahmen werden weggeworfen (`bank-import.js:404`) | Bester Aufwand/Nutzen des Audits, rein clientseitig |
| G1 | 🔴 P0 | ELSTER-Direktübermittlung (Konkurrenz: per Klick ohne Zertifikat) | **Nicht bauen** — ERiC braucht Klartext-Server. Zur Haltung machen + Anleitung |
| G2 | 🟠 P1 | PSD2-Bankanbindung (sevDesk: 4.000+ Banken) | Erst nach G3; gleicher Architekturkonflikt |
| G4 | 🟠 P1 | OCR/Belegerkennung | Als **Browser-OCR (Tesseract.js)** — einzige Chance ohne Local-First-Bruch |
| G5 | 🟠 P1 | ZUGFeRD-Hybrid-PDF — `xrechnung.js` heißt so, erzeugt aber nur Standalone-XML | PDF/A-3-Einbettung; bis dahin Bezeichnung vermeiden |
| G6 | 🟡 P2 | Zahlungslink in der Rechnung | Statischer PayPal-/Stripe-Link, kein Backend |
| G7 | 🟡 P2 | Team-/Mehrbenutzerzugang | Bewusst offen (Gerätesperre bindet auf eine ID) |
| G8 | 🟢 P3 | Native Mobile-App | Erst sinnvoll zusammen mit G4 |
| G9 | 🟢 P3 | Auftragsbestätigung / Lieferschein | Bedarf fraglich |
| G10 | 🟢 P3 | Lesende REST-API (heute nur Make.com-Webhooks raus) | Bei Local-First schwer nachrüstbar |

**Marketing-Fund ohne Entwicklungsaufwand:** E-Rechnung kostet bei Lexware Office den
**XL-Tarif (32,90 €)** — bei Stackr für **15 €** enthalten. Steht nirgends auf der Landingpage.

---

## 04 — Security-Delta ✅ KOMPLETT ERLEDIGT
[Einzeldatei](funde-audit-04-security-delta-2026-08-10.md) · Zum Auditzeitpunkt kein Code-Delta
(HEAD = `020a0c5`); der damalige Review lief nur gegen den Diff, geprüft wurden daher die nie
auditierten Flächen: Import, Backup-Krypto, StB-Krypto, vendorierte Libs.

**Eine Parallel-Session hat alle 6 Funde noch am selben Tag gefixt** (Commits `623ec23`,
`5b62268`, `9c395ad`, `5388954`, `35c0cd6`, `cf152e9`). Am Code nachverifiziert:

| # | Sev | Fund | Status |
|---|---|---|---|
| S2 | 🟠 P1 | SheetJS 0.18.5, CVE-2023-30533 + CVE-2024-22363 | ✅ jetzt `0.20.3` + `js/vendor/VERSIONS.md` |
| S1 | 🟠 P1 | Backup-Restore schrieb ungefilterte localStorage-Keys | ✅ `_isAllowedKey(scope, fullKey)` für **beide** Richtungen |
| S3 | 🟡 P2 | `kdf.iterations` beim Entschlüsseln ignoriert | ✅ `_deriveKey(pass, salt, iterations, hash)` liest aus dem Header, `ITER_LEGACY = 210000` für Alt-Dateien |
| S4 | 🟡 P2 | StB-Public-Key ungeprüft vom Server | ✅ Fingerabdruck-Abgleich, **64 Bit** statt der vorgeschlagenen 32 |
| S5 | 🟢 P3 | ECDH-Shared-Secret ohne HKDF | ✅ HKDF-SHA-256, `info = 'stackr-stb-envelope\|v2'` |
| S6 | 🟢 P3 | PBKDF2 210k mit SHA-256 | ✅ `ITER = 600000` — korrekt **erst nach S3** |

**Drei Abweichungen von meinen Vorschlägen, alle besser als das Vorgeschlagene:** kein
`integrity=` an lokalen Vendor-Dateien (SRI schützt dort vor nichts) — stattdessen SHA-256 in
`VERSIONS.md` **plus** `.gitattributes` mit `js/vendor/*.js -text`, ohne das hätte
`core.autocrlf=true` die dokumentierten Hashes beim Checkout zerstört · 64-Bit-Fingerabdruck, weil
der Angreifer hier per Annahme der Betreiber ist und offline grinden kann · HKDF mit Versionsfeld
(`v:2`) statt Formatbruch, damit bestehende StB-Freigaben gültig bleiben.

**Nebenbefund der Fix-Session:** `js/backup-crypto.js` in **Local 1.7** hing auf dem Stand vom
25.07. und hatte den AAD-Fix vom 30.07. nie bekommen — Local konnte in Web erzeugte Backups gar
nicht entschlüsseln, mit der irreführenden Meldung „Falsche Passphrase". Genau die S3-Falle, nur
über den Umweg der fehlenden Spiegelung. Datei ist wieder byte-identisch.

**Geklärt:** Local 1.7 braucht **keine** Spiegelung der Whop-/API-Fixes (kein `whop-auth.js`, kein
`api/`, nutzt `license.js`). Rest: toter `AuthUI`-Aufruf in `Local 1.7/js/app.js:95`.
**Offen bei dir:** Edge-Tastaturtest der Gate-Overlays · Excel-Import-Klickdurch mit echter Datei ·
2-Account-Test des Fingerabdruck-Abgleichs (alle drei brauchen einen Whop-Login).

---

## 05 — Steuer-Vergleich
[Einzeldatei](funde-audit-05-vergleich-steuer-2026-08-10.md) · Steuerlich an mehreren Stellen
**genauer als der Markt**. Rechtsstände per Recherche fürs Prüfjahr verifiziert.

| # | Sev | Fund | Ort | Fix |
|---|---|---|---|---|
| T1 | 🔴 | **KSA-Satz als Konstante.** 2026 korrekt (4,9 % / 1.000 €), aber **ab 1.1.2027 → 5,0 %** ⇒ still zu niedrig; 2025-Daten schon heute falsch | ausgaben.js:16-17 | `_getKsaWerte(year)` analog `_getUstGrenzen(year)` (app.js:1039), 2027 gleich eintragen |
| T2 | 🟠 | Kein GoBD-/IDEA-**Z3-Export** (§147 VI AO) | — | ZIP mit CSV + `index.xml`; erst bei StB-Nachfrage |
| T3 | 🟠 | Fristen: **kein Monatsrhythmus**, keine Dauerfristverlängerung, keine §108-AO-Verschiebung | steuertermine.js:5-18 | Termine aus `ustRhythmus` generieren + `_naechsterWerktag()` |
| T4 | 🟠 | Audit-Log-Zeitstempel ist Client-Zeit → Rückdatierung ohne Cloud-Anker unerkannt | store.js:1067 | Anker im Protokoll bewerben statt still anbieten |
| T5 | 🟡 | KSA-Bagatellgrenze gilt pauschal, greift für „typische Verwerter" aber nicht | ausgaben.js:102 | Hinweistext |
| T6 | 🟡 | **Leitweg-ID nur im XML, kein Eingabefeld** → B2G unbenutzbar | xrechnung.js:256 | Feld im Rechnungsformular |
| T7 | 🟡 | Kein IDW-PS-880-Testat wie Lexware | — | Nie „GoBD-zertifiziert" schreiben, nur „GoBD-konform" |

**Besser als der Markt** (steht nirgends im Marketing): §19-Prüfung mit historischen Fassungen +
strikter „übersteigt"-Auslegung + 90-%-Vorwarnung · **§14c-Sperre** gegen Steuerausweis auf
Kleinunternehmer-Rechnungen · §13b/§6a-Trennung (Kz. 41 vs. 21) · AfA linear/degressiv/GWG ·
Audit-Log als Hash-Kette mit externem Anker · **mitgelieferte Verfahrensdokumentation** ·
KSA **und** KSK.

---

## 06 — UI-Checker
[Einzeldatei](funde-audit-06-ui-checker-2026-08-10.md) · Drei echte Rendering-Bugs, alle aus
derselben Ursache: Klasse im JS gesetzt, nirgends definiert.

| # | Sev | Fund | Ort | Fix |
|---|---|---|---|---|
| C1 | 🔴 | `.action-btn` + 4 Modifier **nirgends definiert**, kein globales `button{}` → 34 graue Browser-Standardknöpfe in 5 Modulen | eigenbelege, dokumente, wiederkehrend, gbr, lager | CSS-Block in `style.css` (Vorlage in der Einzeldatei) |
| C2 | 🟠 | `.akademie-tip` nirgends definiert → **43 Merkkästen** rendern als Fließtext | akademie.js (43×) | CSS-Block mit Akzent-Rand |
| C3 | 🟡 | `.data-table` nirgends definiert (globales `table{}` fängt es ab) | 9 Steuermodule | Definieren oder entfernen |
| C4 | 🟡 | Versions-Kommentar zeigt auf `index.html`, Badge steht in `app.html:188` | app.js:6 | Kommentar korrigieren |

**Entwarnung:** Der Verdacht auf Design-System-Drift in den nicht polierten Modulen hat sich
**nicht bestätigt**. Die hartkodierten Hex-Werte sind durchweg legitim — ApexCharts-Literale mit
korrekter `isDark`-Verzweigung, das Druck-Stylesheet der Rechnung (muss weiß bleiben),
Farbpaletten als Daten und `var(--x,#fallback)`-Fallbacks in den Gate-Overlays.

**Ebenfalls geprüft und sauber:** Topnav-Konsistenz über alle 4 Seiten · `sidebar-open` einheitlich ·
NaN-Guards in Akademie/Dashboard · Skript-Pfade + SRI · ESC-Handler in allen 4 Bereichen ·
kein „TrackYourIncome" mehr · keine Folgeschäden von `020a0c5`.

---

## 07 — Product-Manager
[Einzeldatei](funde-audit-07-product-manager-2026-08-10.md) · Feature-Matrix bewusst **nicht**
wiederholt (steht in 03). Hier: Positionierung, Funnel, Preis, Segment-Reihenfolge.
**Stackr hat ein Positionierungsproblem, kein Produktproblem.**

| # | Sev | Fund | Beleg | Empfehlung |
|---|---|---|---|---|
| P1 | 🔴 | **Gratis-Local ist ungegated** — `PUBLIC_KEY_JWK: null` ⇒ Dev-Modus, kein Check. Local und Web trennen nur 8 Dateien, davon 3 reine Web-Infrastruktur | Local 1.7/js/license.js:17,47 | Lizenz scharf schalten **oder** Local beschneiden **oder** Web-Wert ehrlich auf Cloud/StB/Multi-Device legen |
| P2 | 🔴 | Drei gleichrangige Personas, aber nur **Reseller** und **GbR** haben eigene Module — Freelancer bekommt nur den Standard | index.html:410-450 vs. Modulbestand | Reseller + GbR nach vorn, Freelancer ehrlich als drittes Segment |
| P3 | 🟠 | Stundensatz / Zeiterfassung / Projekt: **null Treffer** im gesamten Code | js/, rechnungen/js/ | **Bewusst nicht bauen** — eigenes Produktfeld; Energie in Reseller/GbR |
| P4 | 🟠 | Ein Preis (15 €) gegen 3-Stufen-Wettbewerb (6,90–32,90 €) | Marktdaten aus 03 | Einfachheit behalten, aber mit „E-Rechnung 15 € statt 32,90 €" bewerben; falls gestuft, dann nach **Firmenanzahl** |
| P5 | 🟠 | GbR ist die beste unbesetzte Nische, wird aber als eine von drei Karten geführt | index.html (GbR 18× genannt) | Eigene GbR-Landingseite mit Rechenbeispiel |
| P6 | 🟡 | Akademie startet mit „Was ist Reselling überhaupt?" — **korrigiert U12** | js/akademie.js:13 | Nach `d.branche` sortieren |

**Empfohlene Zielkunden-Reihenfolge:** 1. Reseller mit Warenbestand (Lager + §25a + Retouren —
konkurrenzlos) · 2. GbR/Personengesellschaften (belegbare Marktlücke, mehrere Köpfe pro Abo) ·
3. Solo-Selbstständige mit Datenschutz-Anspruch. **Nicht** gegen sevDesk auf Automatisierung
antreten.

**Deckt sich mit Audit 03:** beide kommen unabhängig auf Nischen-Fokus statt Feature-Parität;
G3 (Zahlungsabgleich) ist auch aus PM-Sicht die Nummer 1, weil es als einziges Feature **alle
drei Segmente** gleichzeitig trifft.

---

## 08 — Copy/Marketing
[Einzeldatei](funde-audit-08-copy-marketing-2026-08-10.md) · **Die Copy ist überdurchschnittlich
gut** — Headline, Tonfall, FAQ und Trial-Transparenz sind stark. Die Schwächen sind
**Auslassungen, keine Fehler**.

| # | Sev | Fund | Ort | Empfehlung |
|---|---|---|---|---|
| M1 | 🔴 | **E-Rechnung kommt 1× auf der ganzen Seite vor** — als Bullet. Kein Hero, keine Sektion, **kein FAQ-Eintrag** (von 12). Dabei gesetzliche B2B-Pflicht seit 2025 **und** stärkstes Preisargument (Lexware: erst ab 32,90 €) | index.html:571 | FAQ-Eintrag Nr. 13 + Zeile in der Preis-Sektion (Textvorschlag in der Einzeldatei) |
| M2 | 🔴 | **Kein Sozialbeweis** — keine Stimmen, keine Nutzerzahlen, keine Siegel. Die 4 „Nutzer"-Treffer sind Funktionsbeschreibungen | index.html | Echte Zahlen (28 Module, 200+ Tests) oder **ein** echtes Zitat. Nichts erfinden (§5 UWG) |
| M3 | 🟠 | Gratis-Offline-Version wird nicht erwähnt — die FAQ **verneint** sie („kein Download, keine Installation"). Zusammen mit P1 (ungegated) = weder Funnel noch Produkt | index.html:642 | Erst Produktentscheidung (P1), dann texten |
| M4 | 🟠 | Kein direkter Wettbewerbs-Preisanker. Der vorhandene Anker (Steuerberater-Stunde 150–250 €) ist gut, aber indirekt | index.html:583 | Vergleichszeile: sevDesk 9,90/17,90 · Lexware E-Rechnung ab 32,90 · **Stackr 15 €, alles** |
| M5 | 🟡 | Hero-Headline ist stark, nennt aber die Zielgruppe nicht (der `<title>` macht es vorbildlich) | index.html:75 | Kicker über der Headline, Headline **unverändert** lassen |
| M6 | 🟡 | 3 Persona-CTAs („Als GbR starten") führen alle auf denselben generischen Checkout | index.html:420–450 | Anspruch einlösen (`?branche=gbr` in den Wizard) oder neutral formulieren |

**Erledigt während des Audits:** U1 (Gate ohne Trial-Text) ist gefixt — `js/whop-auth.js` nennt
den Trial jetzt 8×.

**Ausdrücklich gut, nicht anfassen:** Tonfall und dramaturgische Linie der Sektionsüberschriften ·
Trial-Kommunikation ohne Dark Pattern („Karte hinterlegen, in den ersten 7 Tagen keine Abbuchung"
an *jeder* Stelle) · gerechnete statt behauptete Ersparnis · 12 FAQ-Einträge, die fast alle
Kaufhindernisse abdecken · Live-Demo auf der Seite · vollständige Meta-/OG-Tags.

---

## 09 — Performance
[Einzeldatei](funde-audit-09-performance-2026-08-10.md) · Größen **gemessen**, nicht geschätzt.
**Kernbefund:** Die Defer-Optimierung wurde nur auf `app.html` angewendet — die drei Sub-Apps
laden praktisch alles render-blockierend.

| Seite | Scripts | defer | **blockierend** |
|---|---|---|---|
| `app.html` | 67 | 63 | ~4 ✅ |
| `rechnungen/` | 32 | 1 | **~31** |
| `eigenbelege/` | 22 | 1 | **~21** |
| `lager/` | 21 | 1 | **~20** |

| # | Sev | Fund | Ort | Fix |
|---|---|---|---|---|
| F1 | 🔴 | Sub-Apps ohne `defer`; ApexCharts (~600 KB) dort **eager im `<head>`**, obwohl `dashboard.js` es vorbildlich lazy lädt | eigenbelege:19-22, rechnungen, lager | `defer` an alle Tags (~1,4 MB raus aus dem kritischen Pfad), dann `_ensureApexCharts()` übernehmen |
| F2 | 🔴 | **`xlsx.full.min.js` = 929 KB**, größte Datei des Projekts, lädt bei **jedem** Start — gebraucht nur beim Excel-Import | app.html:239, lager:209 (dort ohne defer) | Lazy laden beim Klick, Muster aus `dashboard.js` |
| F3 | 🟠 | `chart.min.js` (200 KB) für **ein** Modul (`statistiken.js`); auf `eigenbelege/` geladen, aber dort **ungenutzt**. Zwei Chart-Libs parallel (~800 KB) | app.html:238, eigenbelege:19 | Aus eigenbelege löschen (1 Zeile); mittelfristig auf ApexCharts vereinheitlichen |
| F4 | 🟢 | Kein `preload` für eigene kritische Kette (Font/CSS/app.js) — `preconnect` für CDN ist da | app.html:11-13 | 3 Zeilen, Font-Preload wirkt am stärksten |
| F5 | 🟠 | Ganze Tabellen per `innerHTML` neu gebaut | app-weit | **Nicht überstürzen** — Event-Delegation fängt es ab; erst messen, dann Zeilen-Obergrenze |
| F6 | 🔴 | Cloud-Sync überträgt immer den **kompletten** Blob; AES-GCM im Main-Thread | cloud-sync.js | **Kein Delta-Sync bauen** (CAS/Merge sind korrekt) — stattdessen Web Worker + sichtbare Rückmeldung |
| F7 | 🟢 | `setInterval` (10-Min-Backup) nie geräumt | app.js:3013 | Handle merken, Einzeiler |

**Gemessen:** 2.897 KB lokales JS in `app.html` (davon 1.129 KB Vendor) · CSS 72 KB · größte
Dateien xlsx 929 / chart 200 / app.js 180 / akademie 169 / lager 163 / store 152.

**Geprüft und gut:** In-Memory-Store statt localStorage-Reads pro Render · `destroy()` an 6 Stellen
vor jedem Chart-Neu-Render · **Event-Delegation** (ein Handler für 350 `data-action`, null Listener
in Render-Schleifen) · self-hosted Variable Fonts mit `font-display: swap` · Landing-CSS sauber
von der App getrennt · SRI + preconnect für alle CDN.

**Top-5 Quick Wins:** `defer` an Sub-Apps · xlsx lazy · ApexCharts lazy in Sub-Apps · chart.min.js
aus eigenbelege löschen · preload für Font/CSS/app.js. Punkte 1, 4 und 5 sind zusammen unter
einer Stunde und betreffen nur Markup.

---

## 10 — Steuer-Delta
[Einzeldatei](funde-audit-10-steuern-delta-2026-08-10.md) · Nur Neues seit dem Juli-Audit.
Die **Teilzahlung ist steuerlich sauber gebaut** — besser, als der Prompt vermuten ließ.
Zwei Funde, beide vom selben Typ: eine Schutzmaßnahme greift an der falschen Stelle oder gar nicht.

| # | Sev | Fund | Ort | Fix |
|---|---|---|---|---|
| D2 | 🔴 | **Lager-Massenoperationen umgehen das Audit-Log.** `Store.setAsync()` schreibt `purchases` **und** `sales` direkt — kein `_addAuditEntry`. Betrifft Batch-Import und Massen-Statuswechsel. §146 IV AO / GoBD Rz. 64 | lager/page.js:1627, 2015-2016, 2454, 2465 | Sammel-Eintrag via **`_addAuditEntriesBatch()`** — liegt fertig daneben (store.js:1089) |
| D1 | 🟠 | Teilzahlung bei **gemischten Steuersätzen blockiert**, obwohl der Store es längst kann (`sale.steuersaetze`, proportional skaliert; UVA liest es korrekt). Die Sperre ist ein Relikt — und ihr Rat „Schlusszahlung abwarten" verursacht genau den **§11-EStG-Fehler**, den die Zufluss-Logik verhindern soll | rechnungen/js/dokumente.js:28-31, 660-663 | `hasMixedVatRates()` entfernen, vorher Testfall (7 %+19 % → Teilzahlung → UVA) |

**Teilzahlung geprüft und korrekt:** §11 EStG Zuflussprinzip (eigener Sale mit tatsächlichem
Zahlungsdatum) · **keine Doppelzählung** bei der Schlusszahlung, satzgenau und mit
`!s.storniert`-Filter · §17 UStG bei Gutschriften inkl. Vorzeichen in der Satz-Aufteilung ·
§14-Sperre bewusst und begründet umgangen (Teilzahlung ändert keine Rechnungsinhalte) ·
Audit-Log greift hier · kein Status-Pfusch (bleibt „offen"/„überfällig") · Überzahlung leitet in
den regulären Bezahlt-Flow.

**§25a:** 7 %-Lücke bei Anlage-2-Fällen unverändert offen, bewusst zurückgestellt (OFFEN.md 2.1).
**Lager/EÜR:** korrekt **keine** Bestandsbewertung in der EÜR (§4 III EStG kennt sie nicht).

---

## 11 — Compliance/Legal
[Einzeldatei](funde-audit-11-compliance-legal-2026-08-10.md) · Die Rechtstexte sind **auffällig
gründlich** — Impressum mit EuGH-Begründung, Datenschutz mit allen vier Auftragsverarbeitern und
Art. 46, AGB mit §312j-Buttonlösung und §356a. Ein Fund sticht heraus.

| # | Sev | Fund | Ort | Fix |
|---|---|---|---|---|
| L1 | 🔴 | **Zwei völlig verschiedene AGB-Fassungen.** `agb.html` (11 §§, Whop, Widerruf, Preise) vs. ein In-App-Modal (8 §§, **kein Widerruf, keine Preise, Whop kommt nicht vor** — vor-Whop-Stand). Das Modal erscheint **nach** Vertragsschluss und blockiert bei Ablehnung die Nutzung → §305 II BGB nicht wirksam einbezogen; §305c II entwertet ausgerechnet den Haftungsausschluss | js/app.js:927 · rechnungen/js/app.js:227 | Modal auf Kurzfassung + Link auf `agb.html` umstellen |
| L2 | 🟠 | `agb_accepted` speichert **Zeitstempel statt Version** → AGB-Änderungen erreichen Bestandsnutzer nie; §9 der AGB ist so nicht umsetzbar (§308 Nr. 5 BGB) | js/app.js:152 · rechnungen/js/app.js:303 | Version im Wert mitführen |
| L3 | 🟠 | **AGB aus der App nicht verlinkt** — alle vier App-Seiten haben nur Impressum + Datenschutz (§312i I Nr. 4 BGB) | app.html, lager/, rechnungen/, eigenbelege/ | 4 Einzeiler im Footer |
| L4 | 🟢 | Banner sagt „Cookies", tatsächlich ist es localStorage (§25 TDDDG greift trotzdem) | js/cookie-banner.js:34 | Ein Satz |
| L5 | 🟠 | **Whop-DPA offen** (Art. 28) — zusätzlich Upstash und Vercel prüfen | — | wartet auf Dritte |
| L6 | 🟠 | Anwalts-Freigabe §11 + §356a — der AGB-Text **weist selbst darauf hin** | agb.html | wartet auf Dritte |

**Geprüft und korrekt:** DDG §5 vollständig (inkl. EuGH C-298/07-Begründung für reine
E-Mail-Erreichbarkeit + §36 VSBG) · Art. 13 DSGVO mit Whop/Upstash/Vercel/Cloudflare/jsDelivr/Make.com
und Art. 46 für die USA-Übermittlung · **Cookie-Banner ohne Ablehnen-Button ist hier richtig**
(nur technisch notwendige Speicherung, §25 II Nr. 2 TDDDG) · §5 StBerG-Disclaimer an drei Stellen ·
E-Rechnung inkl. **§14b-Aufbewahrungshinweis genau im Import-Ergebnis** · §312j-Buttonlösung ·
§7-UWG-Hinweis im Empfehlungsprogramm · Linkhaftung + `rel="noopener"`.

---

## 12 — Accessibility
[Einzeldatei](funde-audit-12-accessibility-2026-08-10.md) · Kontraste **berechnet**.
**Das Farbsystem besteht 45 von 45 Paarungen mit AA**, viele sogar AAA — bei einem Dark-Theme
selten. Zwei echte Verstöße, beide dort, wo frühere Runden nicht hingeschaut haben.

| # | WCAG | Level | Fund | Ort | Fix |
|---|---|---|---|---|---|
| A1 | 2.1.1 · 4.1.2 | **A** | 🔴 **Akademie komplett tastatur-unbedienbar.** Null `aria-`/`role=`/`tabindex` im ganzen Modul; Module, Lektionen und Weiterlesen-Banner sind `<div>` mit `cursor:pointer` und nur `click`-Handler (0 Treffer für `keydown`) → kein Tastaturnutzer kann eine einzige Lektion öffnen | akademie.js:2061, 2127, 2250, 2337, 2366 | `role="button"` + `tabindex="0"` + Enter/Space-Handler, ~30 Min |
| A2 | 1.4.11 | **AA** | 🟠 Eingabefelder ohne erkennbare Abgrenzung: Rand **1,47:1** (Ziel 3:1), und die Füllung hilft nicht (`bg-input` vs. `bg-card` = **1,09:1**) — weder Rand noch Füllung zeigen, wo ein Feld ist | style.css `.form-input` | eigene `--border-field` mit 3:1, 2 Zeilen |
| A3 | 2.1.1 | **A** | 🟠 Lager: 11 klickbare `<div>`/`<tr>` ohne Tastaturpfad. Abgeschwächt — die Tabellenzeile hat eine echte Checkbox als Ersatzweg, die Foto-Kachel nicht | lager/page.js:129, 623 | wie A1; Foto-Kachel besser als `<label>` + `<input type="file">` |
| A4 | 2.4.1 | A | 🟡 Kein Skip-Link — Tastaturnutzer tabben bei jedem Seitenwechsel durch die ganze Sidebar | app.html | 4 Zeilen |
| A5 | 1.3.1 | A | 🟡 `<nav>`/`<main>` ohne `aria-label`, kein `<header>`/`<footer>`; bei **zwei** Navigationen relevant | app.html | `aria-label="Anwendungen"` / `"Module"` |

**Geprüft und korrekt:** 1.4.3 Kontrast (45/45 AA, schwächster Wert 4,64:1) · 2.4.7 Fokus sichtbar
— die drei `outline:none` haben alle Ersatz, der Randwechsel auf `--accent` trägt mit **7,54:1**
(der Glow allein wäre mit 10 % Deckkraft zu schwach) · **3.1.1 Sprachattribut** wird bei
i18n-Umschaltung gesetzt (`i18n.js:914`) · **4.1.3 Live-Region** für die 414 Toasts
(`utils.js:336-342`) · **Label-Verknüpfung läuft automatisch** per MutationObserver auf
`document.body` — neue Formulare brauchen nichts zu tun (`utils.js:515-523`) · Fokus-Falle in den
Gate-Overlays · 2.5.5 Touch-Targets · `<th scope>` · ESC überall.

**Offen, nicht automatisierbar:** Edge-Tastaturtest (Logik geprüft, Wahrnehmung nicht) ·
Farbblindheit in den ApexCharts — in Tabellen durch `+`/`−`-Vorzeichen und Text-Badges entschärft,
in den Charts trägt allein die Farbe.

---

## 13 — Monetarisierung
[Einzeldatei](funde-audit-13-monetarisierung-2026-08-10.md) · **Skill-Prämisse überholt:** Der Skill
baut auf „Local als Top-of-Funnel" — Local ist seit 2026-08-11 eingestellt. Damit fallen zwei
Skill-Abschnitte weg, und die eigentliche Frage ist eine andere (N1).

| # | Sev | Fund | Ort | Fix |
|---|---|---|---|---|
| N2 | 🔴 | **Der Trial ist in der App unsichtbar.** Der Server prüft `status === 'trialing'` (whop-access.js:100), wirft es aber weg (Z. 216); `isTrialActive()` und `getTrialDaysLeft()` sind Stummel (`false`/`null`). Kein Countdown, keine Vorwarnung vor der Abbuchung am Tag 8 — das Kontomenü zeigt „Pro aktiv". **Rückbuchungsrisiko** + der beste Conversion-Moment (Tag 5–6) bleibt ungenutzt | whop-access.js:100,216 · user-plan.js:29-32 | Status durchreichen, 2 Stummel füllen, UI-Streifen — ~1 Tag |
| N3 | 🟠 | Preisumschalter startet auf **„Monatlich"**, obwohl das Jahresabo 25 % günstiger ist und den Cashflow vorzieht. Das **Gate macht es bereits richtig** (Jahreskarte hervorgehoben, „SPAR 45 €") — nur die Landing nicht | index.html:556 | `billing-btn-active` umhängen, ~1 h |
| N4 | 🟠 | Keine Erinnerung vor der Jahresverlängerung; der Winback-Screen ist gut, erreicht aber **nur Rückkehrer** | whop-auth.js:574 | 2 Mails im Whop-Backend konfigurieren, kein Code |
| N1 | 🟡 | **Kein Top-of-Funnel mehr** seit der Local-Einstellung: nur noch Landing → Checkout **mit Kartenpflicht** — die höchste Hürde im Vergleichsfeld | — | **Demo aufwerten** statt Free-Tier bauen |
| N5 | 🟡 | Ein Preis für sehr unterschiedliche Intensität; StB-Zugang und Empfehlungsprogramm sind **fertig gebaut und ungenutzt** | — | Staffel nach **Firmenanzahl**, nie nach Features |

**Korrektur einer älteren Notiz:** Der Referral-Rechtstext ist **nicht** mehr offen — `agb.html` §11
mit Anker `#empfehlungsprogramm` existiert, regelt Freiwilligkeit, Pro-Voraussetzung und Whop als
Auszahlungsstelle, und ist aus dem Dialog korrekt verlinkt (whop-auth.js:780). Auch die
Whop-Plan-Links sind echt, keine Platzhalter.

**Bewusst kein Fund:** Es gibt **kein Churn-Tracking im Produkt** — und das ist richtig so. Ein
Local-First-Produkt mit E2E, das „deine Daten verlassen dein Gerät nicht" verspricht, darf kein
Nutzungsverhalten messen. Die nötigen Kennzahlen liefert Whop ohnehin.

---

## 15 — UI-Vergleich vs. Konkurrenz
[Einzeldatei](funde-audit-15-vergleich-ui-2026-08-10.md) · **Bewusst kurz** — sieben der zehn
Skill-Dimensionen sind in #10, #4, #9, #3 und #15 schon am Code belegt und werden nicht wiederholt.
Neu ist die Markteinordnung.

| # | Sev | Fund | Ort | Fix |
|---|---|---|---|---|
| V1 | 🟠 | **Theme-Umschalter existiert, ist aber `display:none`** — keine manuelle Wahl möglich. Trifft Stackr besonders, weil die Marke über das dunkle Erscheinungsbild definiert ist: Wer ein helles System fährt, sieht sie nie so, wie sie gedacht ist | app.html:65 · style.css:723 | 3-Zustands-Umschalter (System/Hell/Dunkel); **`isDark` in dashboard.js:454 muss die Wahl mitlesen**, sonst bleiben die Charts falsch |
| V2 | 🟠 | Keine native App **und kein PWA-Manifest**, während sevDesk laut Vergleichstests mit „der besten App im Test" Testsieger wurde — „die App" ist dort ein eigenes Bewertungskriterium | — | Billiger Zwischenschritt: **PWA-Manifest + Icons** (~2 h), Grundlage stimmt bereits |
| V3 | 🟡 | Dark Mode und Design-System werden auf der Landingpage **nicht erwähnt** — gleiches Muster wie M1 | index.html | Screenshot in beiden Modi, ~30 min |

**✅ Dark/Light-Mode ist vollständig — und im Vergleichsfeld einzigartig.** 44 Tokens im `:root`,
**32 davon** im Light-Block überschrieben; die zwölf übrigen sind ausnahmslos nicht-farbig
(Radien, Fonts, Easing, Maße) und dürfen gar nicht wechseln. Das Qualitätsdetail: **`--surface-2`
wird von `rgba(255,255,255,.05)` auf `rgba(0,0,0,.04)` umgekehrt** statt nur mitgeschleift — genau
das wird bei nachgerüsteten Light-Modes vergessen. Auch die Charts folgen dem Theme
(`dashboard.js:454-478`). Zu **Dark Mode bei sevDesk/Lexware/FastBill ließ sich nichts finden**,
obwohl Oberfläche und Bedienung sonst ausführlich verglichen werden.

**Score (Stackr am Code belegt, Wettbewerber aus Recherche):** Stackr **6,8** · sevDesk 8,2 ·
FastBill 7,2 · Lexware Office 6,6. Stärken: Dark Mode 9, Design-System 8. Schwächen: Onboarding 5
(fünf Pflichtschritte — Lexware wird umgekehrt als „überladen" kritisiert), Mobile 6.

---

## 16 + 17 — Technischer und buchhalterischer Vergleich
[Einzeldatei](funde-audit-16-17-vergleich-technisch-buchhaltung-2026-08-10.md) · In einem Lauf bearbeitet. **Neue Funde: keine** — und das ist das Ergebnis:
zwei zusätzliche Vergleichsläufe fördern nichts zutage, was die vorherigen Audits nicht schon
erfasst hätten.

**Technik.** Kein Build-Schritt ist eine **dokumentierte Entscheidung** — `package.json` sagt es
selbst, und es gibt **eine einzige** Produktiv-Abhängigkeit (`@vercel/blob`). Dafür bekommt Stackr
drei Dinge, die kein Cloud-Wettbewerber bieten kann: der ausgelieferte Code **ist** der geschriebene
(prüfbar für jeden, der das Datenschutzversprechen nachrechnen will), fast keine
Lieferketten-Fläche, keine Build-Fäulnis. Preis: 2.897 KB unkomprimiert, kein Tree-Shaking.
**Wechselpunkt definiert:** Build lohnt erst, wenn der Code deutlich wächst oder die zwei
parallelen Chart-Bibliotheken (~800 KB) angegangen werden — vorher bringt F2 mehr.
Gegengewicht zum Tech-Debt (5 Dateien über 140 KB): **32 Node-Test-Harnesses**.

**Buchhaltung.** Der DATEV-Export enthält **BU-Schlüssel, Festschreibung, Beleglink,
EU-Steuersatz, Beteiligtennummer** und beide Kontenrahmen (SKR03 **und** SKR04) — das sind die
Felder, an denen ein Steuerberater merkt, ob er nacharbeiten muss. Die 30 Eigenbeleg-Kategorien
unterteilen Wareneinkauf in Privatkauf/Flohmarkt/Großhändler/Online-Marktplatz, was für §25a
entscheidend ist. Mahnfristen sind Daten je Stufe, nicht Fließtext.

**Gemeinsames Fazit, unabhängig erreicht:** Stackr verliert dort, wo Automatisierung einen Server
mit Klartextzugriff braucht (OCR, PSD2, ELSTER, automatischer Mahnungsversand) — kein Rückstand,
sondern die Kehrseite der Architekturentscheidung. Und gewinnt dort, wo Tiefe statt Breite zählt.
**Die einzige verbliebene Lücke, die weder gesetzlich erzwungen noch architekturbedingt blockiert
ist, ist OCR** — Spezifikation inkl. CSP-Freigabe liegt als G4 bereits vor (9567630).

---

## Wiederkehrende Muster

Vier Beobachtungen, die in mehreren Audits unabhängig auftauchten:

1. **Fehlende Obergrenzen, nicht fehlende Prüfungen.** R2, R4, R6 sind alle derselbe Typ: die
   Berechtigung wird korrekt geprüft, aber niemand zählt mit. Ein gemeinsamer Redis-Zähler-Block
   erledigt alle drei.
2. **Jahresfeste Konstanten für Werte, die sich ändern.** T1 (KSA) ist der akute Fall; das
   Gegenbeispiel `_getUstGrenzen(year)` steht in derselben Codebasis und ist vorbildlich. Diese
   Bauform sollte überall dort gelten, wo ein Gesetzeswert steht.
3. **Import ist großzügiger als Export.** S1 (Backup) und U5 (Rechnungsprüfung) haben dieselbe
   Form: beim Erzeugen wird streng validiert, beim Einlesen bzw. Speichern nicht — oder zu spät.
4. **Gebaut, aber nicht angeschlossen.** T6 (Leitweg-ID im XML ohne Eingabefeld), G3
   (Bank-Parser ohne Einnahmen-Verwertung), C1/C2 (Klassen gesetzt, nie gestylt). Jeweils ist die
   schwierige Hälfte fertig und die einfache fehlt — die billigsten Fixes im ganzen Audit.
