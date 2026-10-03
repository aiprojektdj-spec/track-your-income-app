# Technischer + buchhalterischer Vergleich — Funde (2026-08-13)

**Session-Prompts:** `session-prompt-audit-16-vergleich-technisch-*` und
`session-prompt-audit-17-vergleich-buchhaltung-*` — auf Wunsch **in einem Lauf** bearbeitet.
**Scope:** Stackr gegen sevDesk, Lexware Office, FastBill, Papierkram, DATEV.

**Warum eine gemeinsame Datei:** Beide Audits haben Prio „Niedrig" und überschneiden sich stark
mit bereits gelaufenen Läufen. Die Feature-Matrix steht in
[#13 Feature-Gap](funde-audit-03-feature-gap-2026-08-10.md), die steuerliche Compliance-Matrix in
[#8 Steuer-Vergleich](funde-audit-05-vergleich-steuer-2026-08-10.md), Bundle-Größen und
Ladeverhalten in [#3 Performance](funde-audit-09-performance-2026-08-10.md). **Nichts davon wird
hier wiederholt.** Neu sind die Architektur-Bewertung und die buchhalterische Tiefe.

---

## Teil A — Technischer Stack-Vergleich

### IST-Stand (gemessen)

| | Wert |
|---|---|
| Architektur | Vanilla JS, kein Framework, **kein Build-Schritt** für die statische Seite |
| `package.json` | existiert, aber **nur für die Serverless-Funktionen** — eine einzige Abhängigkeit (`@vercel/blob`) |
| Anwendungscode | 52 Dateien in `js/` + 14 in den Sub-Apps |
| Fremdcode | **2 vendored** (SheetJS, Chart.js) + 4 CDN (ApexCharts, GSAP, Notyf, Flatpickr) |
| Serverless | 5 Endpunkte (`api/`) |
| Tests | **32 Node-Harnesses** in `test/` |
| Datenhaltung | localStorage + IndexedDB, Cloud-Sync nur als E2E-Chiffrat |

### A1 — Die Architektur ist eine Entscheidung, kein Versäumnis

`package.json` beschreibt sich selbst: *„Serverless-Function-Abhängigkeiten (api/*).
**Kein Build-Schritt für die statische Seite.**"* Das ist bewusst so, und es zahlt auf drei Dinge
ein, die keine der Vergleichslösungen bieten kann:

1. **Prüfbarkeit.** Der ausgelieferte Code ist der geschriebene Code. Bei einem Produkt, das mit
   „deine Daten verlassen dein Gerät nicht" wirbt, ist das kein Nebeneffekt — ein Nutzer oder
   Prüfer kann im Browser nachsehen, ob es stimmt. Nach einem Bundler ist das praktisch vorbei.
2. **Keine Lieferketten-Fläche.** Eine einzige npm-Abhängigkeit im gesamten Produktivpfad. Die
   typische SaaS-Anwendung zieht hunderte transitive Pakete. Das ist der Grund, warum der
   Supply-Chain-Teil des Red-Team-Audits so kurz ausfiel.
3. **Keine Build-Fäulnis.** Ein Projekt ohne Toolchain veraltet nicht dadurch, dass die Toolchain
   veraltet.

**Der Preis** steht in [#3 Performance](funde-audit-09-performance-2026-08-10.md): 2.897 KB
unkomprimiertes JS, keine Minification, kein Tree-Shaking. Über die Leitung liefert Vercel Brotli,
die Parse-Kosten fallen aber auf der vollen Größe an.

**Bewertung: die Entscheidung ist richtig — der Wechselpunkt ist definierbar.** Ein Build lohnt,
sobald entweder der Anwendungscode deutlich über die jetzigen ~1,8 MB wächst oder die
Vendor-Frage grundsätzlich angegangen wird (zwei Chart-Bibliotheken parallel, ~800 KB). Vorher
bringen die Maßnahmen aus dem Performance-Audit mehr und kosten fast nichts. **Nicht vor F2.**

### A2 — Offline-Fähigkeit: der eigene Anspruch ist noch nicht eingelöst

Stackr nennt sich local-first, und die **Daten** sind es auch. Die **Anwendung** ist es nicht:
Es gibt keinen Service Worker und kein Cache-Konzept, der erste Aufruf braucht zwingend Netz.

Abgemildert ist das durch den **Offline-Grace**: ein server-signiertes ECDSA-Token hält den
Zugang vier Stunden ohne Serverkontakt aufrecht ([js/whop-auth.js](../js/whop-auth.js)) — eine
saubere Lösung für Netzflackern, aber kein Ersatz für echtes Offline.

Gegen den Markt ist das trotzdem eine Stärke: sevDesk, Lexware Office und FastBill sind reine
Cloud-Produkte. Fällt deren Server aus, steht die Buchhaltung. Bei Stackr liegen die Daten
lokal und bleiben lesbar.

→ Service Worker als logische Ergänzung, aber **nicht vor** den Performance-Basics. Eigenes
Vorhaben mit eigenen Fallstricken (Cache-Invalidierung bei Updates, Zusammenspiel mit dem
Whop-Gate).

### A3 — Skalierbarkeit: die Grenze liegt beim Client, nicht am Server

Die Serverless-Endpunkte sind zustandslos und skalieren mit Vercel. Die echte Grenze ist der
Browser: localStorage liegt je nach Browser bei 5–10 MB, IndexedDB fängt das für die großen
Datensätze ab, und Anhänge werden nach Vercel Blob ausgelagert.

Der Engpass, den ich sehen kann, ist **F6 aus dem Performance-Audit**: Cloud-Sync überträgt
immer den kompletten Blob, und AES-GCM läuft im Main-Thread. Das ist die einzige Stelle, die
nicht linear, sondern mit dem Produkt aus Änderungshäufigkeit × Gesamtbestand wächst.

**Empfehlung unverändert: keinen Delta-Sync bauen** — CAS und Merge sind korrekt und getestet.
Stattdessen Web Worker.

### A4 — Tech-Debt: gering, aber die Dateigrößen sind ein Frühwarnzeichen

| Datei | Größe |
|---|---|
| `js/app.js` | 187 KB |
| `js/lager.js` | 174 KB |
| `js/akademie.js` | 170 KB |
| `js/store.js` | 154 KB |
| `lager/page.js` | 147 KB |

Fünf Dateien über 140 KB in einem Projekt ohne Modulsystem. Das ist noch beherrschbar —
`js/akademie.js` besteht zum großen Teil aus Lerninhalten, ist also eher Datei als Code —, aber
`js/app.js` und `js/store.js` sind echte Sammelstellen. Wenn dort ein Schnitt gemacht wird, dann
entlang der Zuständigkeiten (Store: Persistenz / Migration / Audit-Log), nicht nach Zeilenzahl.

**Dem gegenüber steht ein starkes Gegengewicht: 32 Node-Test-Harnesses.** Cache-immun,
ohne Browser lauffähig, gut als Vorlage. Für ein Ein-Personen-Produkt ist das weit über dem, was
man üblicherweise antrifft — und der Grund, warum die vielen Steuer-Fixes dieser Audit-Runde
ohne Regressionen durchgingen.

### Technik-Score

| Kriterium | Stackr | Cloud-Wettbewerber |
|---|---|---|
| Datenhoheit / Offline-Daten | **9** | 3 |
| Lieferketten-Risiko | **9** | 4 |
| Prüfbarkeit des Auslieferungsstands | **9** | 2 |
| Ladezeit / Bundle | 5 | 7 |
| Offline-Fähigkeit der **App** | 4 | 3 |
| Skalierbarkeit bei sehr großen Datenmengen | 6 | 8 |
| API / Integrationen | 3 | 8 |
| Testabdeckung | **8** | ? |

---

## Teil B — Buchhalterischer Vergleich

### IST-Stand (gemessen)

| Bereich | Stand |
|---|---|
| Dokumenttypen | Rechnung · Angebot · Gutschrift (+ Storno als Zustand) |
| Eigenbeleg-Kategorien | **30** vordefiniert, von Wareneinkauf-Unterarten bis Plattformgebühren |
| Ausgaben-Kategorien | Fahrtkosten, Büro, Equipment, Wareneinkauf, Versandkosten, Plattformgebühren, Sonstiges |
| Mahnwesen | Mahnstufen mit **eigener Zahlungsfrist je Stufe** + Mahngebühren |
| DATEV | Buchungsstapel mit **BU-Schlüssel, Belegdatum, Beleglink, Festschreibung, EU-Steuersatz, Beteiligtennummer** |
| Bank | CAMT.053 + MT940 + generisches CSV, seit G3 mit Zahlungsabgleich |
| Belegerfassung | Foto/PDF anhängbar, **keine** OCR |

### B1 — Der DATEV-Export ist ernster gemeint als erwartet

Die Feldliste in `js/datev.js` enthält nicht nur die Pflichtspalten, sondern auch
**`BU-Schlüssel`, `Festschreibung`, `Beleglink`, `EU-Steuersatz` und `Beteiligtennummer`**.
Das sind genau die Felder, an denen ein Steuerberater merkt, ob ein Export für ihn brauchbar ist
oder ob er nachbearbeiten muss. Zusammen mit **SKR03 und SKR04** (die meisten kleinen Tools
liefern nur einen Kontenrahmen) ist das ein ernsthafter Export, kein Häkchen auf der Featureliste.

Es bleibt der Unterschied aus [#8](funde-audit-05-vergleich-steuer-2026-08-10.md): DATEV-Stapel
ist **nicht** dasselbe wie der Z3-/IDEA-Export für die Betriebsprüfung. Der ist inzwischen
gebaut (Commit `caedf9f`) — damit ist auch diese Lücke geschlossen.

### B2 — Die Kategorien sind auf die Zielgruppe zugeschnitten, nicht generisch

30 Eigenbeleg-Kategorien mit einer Auflösung, die man sonst nicht sieht: Wareneinkauf ist in
**Privatkauf/Kleinanzeigen, Flohmarkt/Second-Hand, Großhändler/B2B und Online-Marktplatz**
unterteilt. Das ist keine Kosmetik — für die §25a-Differenzbesteuerung ist genau diese
Unterscheidung entscheidend, weil sie bestimmt, ob Vorsteuer gezogen werden kann.

Die generischen Tools bieten „Wareneingang" und überlassen den Rest dem Nutzer. Für einen
Reseller ist Stackrs Auflösung ein echter Zeitgewinn und eine Fehlerquelle weniger.

**Gegenprobe:** Für einen Freelancer ohne Ware ist dieselbe Liste zu lang. Das ist die
Segment-Spannung aus [#14 P2/P3](funde-audit-07-product-manager-2026-08-10.md) — hier in der
Kategorienliste sichtbar.

### B3 — Mahnwesen: die Fristen sind Daten, nicht Fließtext

`rechnungen/js/mahnungen.js:5` trägt den Kommentar *„Zahlungsfrist je Mahnstufe — echte Werte
statt in Fließtext hartcodierter Zahlen"*. Das klingt banal, ist aber der Unterschied zwischen
einem Mahnwesen, das man anpassen kann, und einem, bei dem die Frist im Mahntext steht und
nirgends sonst. Mahngebühren pro Stufe sind ebenfalls hinterlegt.

Was fehlt: **automatischer Versand**. Mahnungen werden erzeugt, nicht verschickt — der Nutzer
lädt das PDF und mailt es selbst. sevDesk und Lexware verschicken auf Wunsch automatisch. Das ist
dieselbe Architekturgrenze wie bei G1/G2: ohne Server, der Klartext sieht, kein Versand.

### B4 — Die verbleibende buchhalterische Lücke ist OCR

Nach den Fixes dieser Audit-Runde ist die Liste der echten Lücken kurz:

| Lücke | Status |
|---|---|
| Zahlungsabgleich Bank ↔ Rechnung | ✅ gebaut (G3, Commit `f1bf917`) |
| Z3-/IDEA-Export | ✅ gebaut (T2, Commit `caedf9f`) |
| Zahlungslink auf der Rechnung | ✅ gebaut (G6, Commit `365d930`) |
| Leitweg-ID für B2G | ✅ gebaut (T5/T6, Commit `631bcd7`) |
| **OCR / Belegerkennung** | ❌ offen — die letzte relevante Lücke |
| Automatischer Mahnungsversand | ❌ architekturbedingt |
| PSD2-Kontoanbindung | ❌ architekturbedingt |

**OCR ist der einzige verbliebene Posten, der weder gesetzlich erzwungen noch
architekturbedingt blockiert ist** — und für den es aus
[#13 G4](funde-audit-03-feature-gap-2026-08-10.md) bereits den richtigen Ansatz gibt:
Tesseract.js im Browser, damit der Beleg das Gerät nicht verlässt. Laut Commit `9567630` liegt
dafür schon eine Spezifikation inklusive CSP-Freigabe vor.

### Buchhaltungs-Score

| Kriterium | Stackr | sevDesk | Lexware | FastBill | Papierkram |
|---|---|---|---|---|---|
| Rechnungen (§14, E-Rechnung) | **9** | 8 | 8 | 8 | 7 |
| EÜR | **8** | 8 | 8 | 6 | 7 |
| Mahnwesen | 7 | 8 | 8 | 7 | 6 |
| Kategorien / Kontierung | **8** | 7 | 7 | 6 | 6 |
| Bank-Import | 6 | **9** | 8 | 7 | 7 |
| Belegerfassung (OCR) | 3 | **9** | 8 | 7 | 6 |
| DATEV / StB-Übergabe | **8** | 8 | 8 | 6 | 6 |
| Branchentiefe (Lager, §25a, GbR) | **9** | 4 | 3 | 2 | 3 |

---

## Gemeinsames Fazit

Beide Vergleiche kommen unabhängig auf denselben Befund, und er deckt sich mit dem
[PM-Audit](funde-audit-07-product-manager-2026-08-10.md):

**Stackr verliert dort, wo Automatisierung einen Server mit Klartextzugriff braucht** — OCR,
PSD2, ELSTER-Übermittlung, automatischer Mahnungsversand. Das ist kein Rückstand, sondern die
Kehrseite der Architekturentscheidung.

**Stackr gewinnt dort, wo Tiefe statt Breite zählt** — Lager mit §25a-Differenzbesteuerung,
GbR-Gewinnverteilung, 30 zielgruppengenaue Kategorien, DATEV mit BU-Schlüssel und Festschreibung,
zwei Kontenrahmen. In diesen Feldern haben die Vergleichsprodukte nichts Gleichwertiges.

**Neue Funde: keine.** Alles, was diese beiden Audits an Lücken zutage fördern, war bereits
erfasst — OCR (G4), Mahnungsversand und PSD2 (architekturbedingt, G2), Bundle-Größe (F2),
Service Worker (Performance-Ausblick). Das ist ein gutes Zeichen: Die vorherigen Audits waren
vollständig genug, dass zwei zusätzliche Vergleichsläufe nichts Neues finden.

**Empfehlung:** Beide Themen brauchen keine eigene Nacharbeit. Der einzige Posten, der aus
buchhalterischer Sicht noch lohnt, ist **OCR als Browser-Lösung** — und der steht bereits als
G4 mit fertiger Spezifikation bereit.
