# Stand technische Sanierung — 2026-08-09

**Kontext:** Session "Stackr technische Sanierung" hat in Web 1.7 umfangreich gearbeitet, dabei
sichtbar `plan/OFFEN.md` als Arbeitsliste benutzt (Code-Kommentare referenzieren sie wörtlich,
z.B. „s. plan/OFFEN.md §2.1b"). Die Session ist **gestoppt, ohne zu committen**. Diese Datei
hält fest, was im aktuell uncommitteten Arbeitsverzeichnis steckt, damit das nicht verloren geht
oder doppelt gemacht wird.

**Snapshot-Charakter:** Stand des `git diff` zum Zeitpunkt des Schreibens (2026-08-09,
39 geänderte Dateien, +1438/-347 Zeilen). Sobald committet oder weitergearbeitet wird, ist diese
Datei überholt — vor erneutem Zugriff `git status`/`git diff` neu prüfen.

---

## ⚠️ Nichts davon ist committet

39 Dateien im Arbeitsverzeichnis geändert, dazu 5 neue Test-Harnesses in `test/`. Bevor
irgendjemand — egal welche Session — hier weiterarbeitet, sollte das gesichert werden. Bis dahin
wächst das Kollisionsrisiko mit jeder weiteren Session, die in diesem Ordner startet.

---

## 1. Bereits erledigt (uncommittet)

### 1.1 Aus plan/OFFEN.md abgearbeitet

- **§2.1b — §25a-Retouren nicht aus der Marge gerechnet**: komplett gefixt in
  `js/ustvoranmeldung.js`, `js/euer.js`, `js/gbr-modul.js`. Retouren auf §25a-Positionen mindern
  jetzt die Marge anteilig (§17 UStG), auch bei Sammelverkäufen mit mehreren `purchaseIds` und bei
  vollständiger Stornierung. Analog zum bestehenden `retour19`/`retour7`-Mechanismus.
- **§2.3 — EU-ODR-Verweis in `impressum.html`**: entfernt (Plattform wurde zum 20.07.2025
  eingestellt). War in OFFEN.md schon als „✅ erledigt 2026-08-09" markiert — passt zum
  heutigen Datum, diese Session war das offenbar.

### 1.2 Zusätzlich gefixt (stand nicht in OFFEN.md)

- **Vorsteuer bei `ustSatz: 'unklar'`**: `js/euer.js` zog vorher pauschal 19% ab, auch wenn der
  Steuersatz einer Ausgabe unklar war — jetzt 0€ Vorsteuerabzug bei `'unklar'`/`'rc'` (§15 UStG:
  kein Abzug ohne ausgewiesenen Satz). Reverse-Charge-Fälle (`'rc'`) laufen separat über
  §13b-Einträge.
- **Fahrtkosten fälschlich mit Vorsteuer verrechnet**: Kilometerpauschale (§9 EStG, 0,30 €/km) ist
  eine Pauschale ohne Rechnung, nie USt-belastet — lief vorher pauschal mit 19% in die Vorsteuer.
  Jetzt 0€. Versandkosten/Plattformgebühren/Materialverbrauch bekommen aus demselben Grund
  vorerst ebenfalls 0€ statt geratener 19%-Pauschale (kein `ustSatz`-Feld auf Sale/Materiallager
  vorhanden — Nutzer kann das alternativ als Betriebsausgabe mit korrektem Satz erfassen).
- **Gewerbesteuer-Rechner in `js/euer.js`**: lief vorher unconditional und suggerierte auch
  Freiberuflern eine GewSt-Pflicht. Jetzt an `Rechtsform.getConfig().gewerbesteuer` gekoppelt;
  Freibetrag (§11 GewStG, 24.500€) nur noch für natürliche Personen/Personengesellschaften, nicht
  für Kapitalgesellschaften (GmbH/UG). §35-EStG-Anrechnungshinweis korrigiert (4× statt 3,8×
  Steuermessbetrag, seit VZ 2020).
- **GbR-Sonderbetriebseinnahmen/-ausgaben (§15 Abs. 1 Nr. 2 EStG)**: neuer Block in
  `js/gbr-modul.js` (Feststellungserklärung) + `js/gbr.js` (`getSbeSba`,
  `berechneVerteilungMitSonder`). Tätigkeitsvergütungen, Miete für überlassene Wirtschaftsgüter,
  Gesellschafterdarlehen-Zinsen fließen jetzt additiv in den Gesamtgewinn je Gesellschafter ein,
  statt nur den anteiligen Gesamthandsgewinn zu zeigen.
- **Ist-UVA bei gemischten Steuersätzen**: `js/ustvoranmeldung.js` nahm pro Sale nur einen Satz
  an (`_rate()`), jetzt satzgenau über `_perRateGroups()` — relevant bei Rechnungen mit
  gemischten 7%/19%-Positionen (`sale.steuersaetze`), sonst fiel der komplette Betrag auf den
  19%-Default.
- **§25a-Sammelverkäufe**: bei mehreren verknüpften Einkäufen (`purchaseIds`) wurde vorher nur
  der erste Einkaufspreis berücksichtigt — jetzt werden alle verknüpften Einkäufe summiert
  (`_sumEk25a`).
- **Cookie-Kategorisierung überarbeitet** (`cookies.html`, `css/legal.css`): neue Kategorie
  „Funktional" (Bedienkomfort, App läuft auch ohne) getrennt von „Notwendig" (§25 Abs. 2 Nr. 2
  TDDDG). `lager_layout`/`lager_prefs`/etc. von „Notwendig" auf „Funktional" umgestuft.
- **Datenschutzerklärung ergänzt** (`datenschutz.html`): neue Abschnitte 4.2 (Make.com-Webhooks —
  Klartext-Übertragung, Drittlandtransfer-Verantwortung liegt beim Nutzer) und 4.3
  (StB-Freigabe — Public Key, Grant-Status, IP-Rate-Limiting bei Upstash). AVV-Formulierung bei
  Upstash/Vercel präzisiert („vorgesehen bzw. über Standard-AVV abgedeckt" statt fester
  Behauptung). Aufbewahrungsfristen nach §147 AO präzisiert (Rechnungen/Belege 8 Jahre, Bücher/
  Jahresabschlüsse 10 Jahre).
- Weitere Änderungen ohne tiefere Prüfung (Umfang zu groß für vollständige Durchsicht in dieser
  Session): `js/whop-auth.js`, `js/cloud-sync.js`, `js/blob-attachments.js`, `api/blob-upload.js`,
  `js/store.js`, `js/kassenbuch.js`, `js/vorsteuer.js`, `js/stb-share.js`, `js/afa.js`,
  `js/ksk.js`, `js/lohnsteuer.js`, `js/koerperschaftsteuer.js`, `js/ausgaben.js`,
  `js/fahrtenbuch.js`, `js/akademie.js`, `rechnungen/js/xrechnung.js`,
  `rechnungen/js/rechnung.js`, `rechnungen/js/wiederkehrend.js`,
  `rechnungen/js/erechnung-import.js`, `eigenbelege/js/app.js`, `js/app.js`, `js/backup-crypto.js`,
  `index.html`, `landing-v2.html`, `stackr-broschuere.html`, `vercel.json`.
  Dazu 5 neue Test-Harnesses in `test/`: `test-gewerbesteuer-freibetrag-anrechnung.js`,
  `test-kassenbuch-fixes.js`, `test-store-gobd-fixes.js`, `test-vorsteuer-ustsatz-unklar.js`,
  `test-xrechnung-fixes.js`.
- **`plan/PLAN.md`**: mehrere Abschnitte als „erledigt" durchgestrichen (blob-sync, ch-at-entfernen,
  lager-feature-batch, landing-seo, local-sync-fortsetzung, local-sync-punkte-16-22,
  makecom-webhook, offline-grace-stb, onboarding-rebuild, performance-a11y,
  persona-cta-touch-target, rechnung-eigenbeleg-vollaudit, stb-gate-revoke, stb-luecken,
  teilzahlung-ratenzahlung, vercel-blob-empfaenger) — deckt sich mit Abschnitt 6 aus
  `plan/OFFEN.md`, war also die dort unter 5.2 vorgeschlagene Aufräumarbeit.

---

## 2. Noch offen

### 2.1 §25a mit 7% statt pauschal 19% (OFFEN.md §2.1a)

Nicht angefasst. `js/steuer-berechnung.js` (`margeEinzeldifferenz`/`margeGesamtdifferenz`) wird
weiterhin überall fest mit `satz: 19` aufgerufen (`js/ustvoranmeldung.js:253/258`,
`js/euer.js:165`, `js/gbr-modul.js:85`). Der UI-Hinweistext in `js/lager.js:2427` weist auf die
Lücke hin, ohne sie zu schließen. Dringlichkeit weiterhin gering (betrifft Kunst-/
Antiquitätenhändler, nicht die aktuelle Zielgruppe).

### 2.2 Local-1.7-Rechtstext (OFFEN.md §2.2) — Einschätzung korrigiert

Die alte Memory-Behauptung „`Local 1.7/datenschutz.html` beschreibt weiterhin Supabase +
LemonSqueezy" stimmt nicht mehr — der Text beschreibt aktuell korrekt **Paddle** als
Zahlungsabwickler. Supabase/LemonSqueezy tauchen nur noch in `js/app.js`-Kommentaren und alter
Git-Historie auf (`7a8cc67 Add Supabase SQL schema, LemonSqueezy webhook Edge Function`).
Punkt 2.2 muss neu bewertet werden, sobald Local 1.7 in Ruhe geprüft werden kann.

### 2.3 Neuer Fund: kaputte Script-Referenz in Local 1.7

`Local 1.7` hat selbst uncommittete Änderungen (`git log`: 1 Commit vor `origin/main`, dazu
unstaged): `app.html`, `eigenbelege/index.html`, `impressum.html`, `js/dashboard.js` modifiziert,
**`js/user-plan.js` als gelöscht markiert** — aber `rechnungen/index.html`, `lager/index.html`
und `eigenbelege/index.html` binden die Datei weiterhin per `<script src="../js/user-plan.js">`
ein. Falls das kein Zwischenstand eines laufenden Umbaus ist, laden diese 3 Seiten aktuell eine
404-Datei (Trial/Paddle-Gate wäre kaputt). Noch nicht geprüft, ob Absicht oder Versehen.

### 2.4 Wartet auf Dritte / nur User kann testen

Unverändert gegenüber `plan/OFFEN.md` Abschnitt 3 und 4: Anwalts-Freigabe (AGB §11,
§356-Trial-Klausel, Local-Rechtstext), Whop-DPA/AV-Vertrag, echter 2-Profil-Cloud-Sync-Test,
Make.com-Webhook-Livelauf, StB-Zugang-2-Account-Test, Lager-Feature-Batch-Live-Test.

---

## 3. Empfehlung

1. Diesen Stand committen (oder von der ursprünglichen Session committen lassen), bevor weitere
   Sessions in `Web 1.7` oder `Local 1.7` starten.
2. Danach `plan/OFFEN.md` gegen den committeten Stand neu abgleichen — diese Datei hier ist nur
   eine Momentaufnahme des Zwischenstands, kein Ersatz für OFFEN.md.
3. Punkt 2.3 (Local-1.7-Script-Referenz) klären, bevor die 3 betroffenen Seiten in Local
   angefasst werden.
