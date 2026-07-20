# Prompt für neue Session (copy-paste) — USt-Audit: letzte 3 Restrisiken schließen

---

Kontext: Tiefen-Audit der Umsatzsteuer-Logik (2026-07-18, 3 parallele fn-checker-Agenten:
UVA-Kern, Rechnung §14, GbR+EÜR/Bilanz-Sync) hat 13 Funde produziert, 11 davon sind in dieser
Vorsession bereits gefixt und verifiziert (`node --check` + Handrechnung), aber **noch nicht
committet**. User will "bulletproof, kein Restrisiko" — 3 der 13 Funde sind bewusst noch offen,
weil sie keine Ein-Zeilen-Fixes sind, sondern Scope-Entscheidungen brauchen. Diese Session soll
sie abarbeiten (oder, wo eine echte Produkt-Entscheidung nötig ist, die Entscheidung einholen und
dann umsetzen).

## Vorbedingung — erst git-Zustand klären

**Update 2026-07-18 (nach Anlage dieser Datei):** Die unten genannten 8 Dateien sind inzwischen
committed (`d6b6b9a "USt-Audit Vorsession: Netto/Brutto-Fix euer.js, Rechnungsnummer-Peek+Sperr-
Guards store.js, §13b igArt pro Position"`, plus vorgelagert `daefd12`/`eae44a0`/`0b5bd46`/
`42e92d2`/`8717ec8` von parallelen Sessions im selben Ordner). Der Abschnitt "Vorbedingung" unten
ist damit erledigt — **trotzdem zuerst `git status --short` + `git log --oneline -10` frisch
prüfen**, dieses Repo hatte am 2026-07-18 mehrere Sessions gleichzeitig aktiv und der Stand kann
sich seither wieder geändert haben. Nicht davon ausgehen, dass die Liste unten noch aktuell ist.

Zusätzlich offen aus derselben Session (Legal-Risk-Assessment auf den §13b-`igArt`-Fix): der Fix
lief ursprünglich auf Rechnungsebene mit Silent-Default `'ware'` (2 YELLOW-Risiken: Misch-
Rechnung Ware+Leistung nicht abbildbar, Default passt schlecht zu Stackrs service-lastiger
Zielgruppe) — beides nachgeschärft auf **pro Position** + **Pflicht-Auswahl ohne Default**, siehe
`plan/offene-punkte-2026-07-15.md` Punkt 2 für den vollen Trail. **Noch nicht browser-
verifiziert** — App ist Whop-Login-gated, keine Zugangsdaten in den bisherigen Sessions
verfügbar. Falls diese neue Session Whop-Zugang hat (User stellt bereit oder loggt selbst ein):

1. Rechnung an EU-B2B-Kunden (Land ≠ DE, EU-Land, USt-IdNr. hinterlegt) anlegen.
2. Zwei Positionen: eine "Ware", eine "Leistung" — im §13b-Hinweisblock erscheint pro Position
   ein Dropdown "Art (EU)"; ohne aktive Auswahl (erste Option ist `disabled`) darf Speichern
   nicht durchgehen (Toast-Fehler erwartet).
3. Beide Positionen explizit zuordnen, speichern — sollte klappen.
4. UVA für den Zeitraum öffnen (`js/ustvoranmeldung.js`): Kz. 41 (Ware) und Kz. 21 (Leistung)
   müssen die jeweiligen Netto-Beträge getrennt zeigen, nicht beide unter Kz. 41.
5. `plan/session-prompt-ust-restliste-2.md` ist mit diesem Fix inhaltlich erledigt (Punkte 2/3/4
   alle committed) — kann archiviert/gelöscht werden, sobald obiger Test bestätigt.

---

**Ursprüngliche Vorbedingung (jetzt historisch, s.o.):**

Im Ordner läuft potenziell weiterhin eine **andere, parallele Session**
(input-Härtung: `max=`-Attribute, `Utils.escapeHtml`, `Utils.sanitizeImageFile` — siehe
`plan/session-prompt-review-input-haertung-batch.md`, falls die Datei noch existiert). Die
USt-Audit-Vorsession hatte folgende 8 Dateien geändert (inzwischen committed, s.o.):

```
js/app.js
js/bilanz.js
js/euer.js
js/gbr-modul.js
js/gbr.js
js/retouren.js
js/store.js
rechnungen/js/rechnung.js
```

Alle anderen dirty Dateien im Ordner gehören NICHT zu dieser Aufgabe — nicht
anfassen, nicht mitcommitten (kein `git add -A`).

### Was die Vorsession bereits gefixt hat (zur Einordnung, falls noch uncommitted)

- `js/euer.js` — USt-Extraktion bei Regelbesteuerung war rechnerisch ein No-Op (Gewinn um
  vereinnahmte USt überhöht); Rechnungspositionen wurden fälschlich doppelt genettet; Retouren
  jetzt am tatsächlichen Steuersatz genettet statt pauschal 19%.
- `js/bilanz.js` — gleiche zwei Fixes (Doppel-Netting Rechnungen, Retouren-Netting) + fehlender
  Storno-Doppelabzug-Guard ergänzt.
- `js/gbr-modul.js` — las Ausgaben aus totem Store-Key (`Store.getExpenses()` statt
  `Store.get('ausgaben')`), kannte USt-Regelbesteuerung gar nicht.
- `js/gbr.js` (`_calcMonthData`) — dito, plus fehlender Mengen-Faktor beim Wareneinkauf. Betraf
  direkt die im Auszahlungen-Tab ausgezahlten Beträge.
- `js/app.js` — §19-Schwellenwert-Warnung nutzte rohes `localStorage` statt company-gescoptem
  `Store` (Warnung einer Firma konnte die einer anderen Firma unterdrücken).
- `js/store.js` — `autoSyncInvoices()` synct jetzt auch Gutschriften (§17 UStG), nicht nur
  Rechnungen; neue `peekRechInvoiceNumber()` (non-mutating Vorschau) gegen Nummern-Lücken;
  `saveRechInvoice()` gibt bei GoBD-Sperre `null` statt `invoice` zurück; neue
  `_warnIfPeriodLocked()` in `savePurchase`/`saveSale`/`saveExpense`/`saveRechInvoice` verdrahtet.
- `js/retouren.js` — Rechnungs-Sales aus dem Verknüpfungs-Dropdown ausgeschlossen (Retoure auf
  Rechnung wirkte in Soll-Versteuerung sonst gar nicht).
- `rechnungen/js/rechnung.js` — Rechnungsnummer wird erst nach allen Validierungen final
  vergeben (Peek-Pattern), §14-Pflichtangaben blockieren jetzt statt nur Toast, Leistungsdatum-
  Vermerk bei "Nur Rechnungsdatum" ergänzt, RC-Save-Guard gegen `mwstSatz > 0`, `mwstSatz` bei
  Kleinunternehmer hart auf 0 erzwungen, Silent-Fail beim Speichern gesperrter Rechnungen behoben.

Vollständige Fund-Liste (auch die 2 als ✅ verifizierten, nicht gefixten) steht im Chat-Verlauf
der Vorsession, nicht in einer Datei — falls Details fehlen, Vorsession-Transkript nicht
verfügbar, dann im Zweifel die Betroffenheit selbst nachvollziehen (Kommentare im Code sind
ausführlich).

---

## Punkt 1 — Vorsteuer-Belegerfassung (§14 UStG Pflichtangaben)

`js/vorsteuer.js` zieht Vorsteuer aus Einkäufen/Ausgaben, ohne zu prüfen, ob überhaupt eine
ordnungsgemäße Eingangsrechnung mit allen §14-Pflichtangaben vorliegt (Rechnungsnummer des
Lieferanten, dessen Steuernummer/USt-IdNr., Leistungsbeschreibung etc.) — diese Felder existieren
im Datenmodell für `purchases`/`expenses` schlicht nicht. Ein echter Compliance-Check kann daher
aktuell nicht mehr sein als eine unverbindliche Checkliste (bereits vorhanden,
`js/vorsteuer.js:~324`).

**Das ist eine Scope-Entscheidung, kein Bugfix — zuerst mit dem User klären, nicht einfach
loscoden:**

- **Option A (klein):** Pflicht-Checkbox "Ich habe eine ordnungsgemäße Rechnung mit allen
  §14-Pflichtangaben" pro Vorsteuer-relevantem Einkauf/Ausgabe, die vor dem Zählen bestätigt
  werden muss. Kein neues Datenmodell, aber auch keine echte Prüfung — nur eine bewusste
  Nutzer-Bestätigung (Beweislast-Dokumentation, kein technischer Schutz).
- **Option B (mittel):** `lieferant`-Feld (existiert schon bei manuellen RC/IG-Einträgen,
  `js/vorsteuer.js` Zeile ~578/649) als Pflichtfeld erzwingen + auf normale Einkäufe/Ausgaben
  ausweiten.
- **Option C (groß):** Strukturierte Belegerfassung für Eingangsrechnungen analog zum
  bestehenden Eigenbelege-Modul (`eigenbelege/`, hat schon Beleg-Upload +
  `Utils.sanitizeImageFile()`) — neues Datenmodell, größter Aufwand, aber einzige Variante mit
  echtem Compliance-Wert.

Empfehlung: mit `AskUserQuestion` oder direkt im Chat klären, bevor Code geschrieben wird. Bei
Unsicherheit über die rechtliche Tragweite `legal-reviewer`-Agent konsultieren.

## Punkt 2 — Race Condition bei Rechnungsnummern in parallelen Tabs

`Store._cache` wird nur beim Laden befüllt, es gibt **keinen** `storage`-Event-Listener oder
BroadcastChannel, der `_cache` cross-tab aktuell hält (verifiziert: `grep -n "addEventListener('storage'"
js/store.js` liefert nichts). Zwei Tabs können daher denselben "nächsten" Nummern-Kandidaten
ziehen. Die Vorsession hat das Zeitfenster bereits deutlich verkleinert (Nummer wird erst beim
tatsächlichen Speichern konsumiert, nicht mehr beim Öffnen des Formulars — Peek-Pattern), aber
das strukturelle Problem bleibt.

Echte Lösung: `navigator.locks.request()` (Web Locks API, nativ, kein neues Dependency) um die
Read-Modify-Write-Sequenz in `Store.nextRechInvoiceNumber()`, `Store.nextStornoNumber()` und
`Store.nextInvoiceNumber()` (js/store.js, drei fast identische Funktionen) legen. Das macht diese
Funktionen zwangsläufig **async** — Web Locks ist Promise-basiert, es gibt keinen synchronen Weg.

Vorgehen:
1. `grep -rn "nextRechInvoiceNumber\|nextStornoNumber\|nextInvoiceNumber" --include=*.js` über
   das ganze Repo — alle Aufrufer identifizieren (mindestens `rechnungen/js/rechnung.js`
   (`buildInvoiceObject`, `autoGenerateNumber`), `rechnungen/js/wiederkehrend.js`, `js/store.js`
   selbst (`createStornoRechnung`), ggf. weitere in `app.js`/`dokumente.js`).
2. Jeden Aufrufer auf `async`/`await` umstellen — inkl. der UI-Callbacks, die dadurch selbst
   async werden (Button-Handler etc. vertragen das i.d.R. problemlos, aber Reihenfolge/UI-State
   während des Awaits prüfen, z.B. Doppelklick-Schutz auf dem Speichern-Button).
3. Feature-Detect-Fallback für Umgebungen ohne `navigator.locks` (aktuell praktisch nur sehr alte
   Browser) — synchrones Verhalten wie bisher, kein Hard-Fail.
4. Manuell mit zwei echten Browser-Tabs testen: beide auf "Neue Rechnung" öffnen, in beiden kurz
   hintereinander speichern, prüfen dass die Nummern nicht kollidieren.

Realistisches Risiko bei Solo-Nutzung ist klein — falls der Aufwand (5 Dateien async umstellen)
in keinem Verhältnis zum Nutzen steht, das mit dem User rückkoppeln, bevor der ganze Umbau
gemacht wird.

## Punkt 3 — `euer.js`/`bilanz.js`: zwei getrennte Implementierungen derselben Rechnung

Nach den Fixes der Vorsession sind beide Module einzeln korrekt, aber sie duplizieren
strukturell identische Logik (Netto-Umsatz aus Sales/Rechnungen, Wareneinsatz, Betriebsausgaben —
jeweils nach USt-Satz genettet). `euer.js` ist für EÜR-pflichtige Rechtsformen (Einzelunternehmen,
GbR/eGbR), `bilanz.js` für bilanzierungspflichtige (GmbH, UG, OHG, KG, GmbH & Co. KG) — beide
lesen dieselben Store-Quellen (`Store.getSales()`, `Store.getPurchases()`, `Store.getExpenses()`,
`Store.getRetouren()`, `Store.getRechInvoices()`), nur mit leicht unterschiedlichem
Periodenfilter (EÜR: Zufluss/Abfluss-Prinzip + wählbarer Zeitraum; Bilanz: reines Kalenderjahr).

Ziel: eine gemeinsame, reine Rechenfunktion extrahieren (z.B. neue Datei
`js/steuer-berechnung.js` oder Methoden direkt an `Store` hängen), die Sales/Purchases/
Expenses/Retouren/Rechnungen nach USt-Satz nettet und von beiden Modulen mit ihren jeweiligen
Filtern aufgerufen wird — Single Source of Truth für die USt-Netting-Logik selbst, auch wenn die
Periodenauswahl/Aggregation drumherum unterschiedlich bleibt.

**Vorgehen wegen Regressionsrisiko:**
1. Vor dem Refactor: 2-3 Testdatensätze (Sales/Purchases/Expenses mit gemischten Steuersätzen,
   Retouren, unsynced Invoices/Gutschriften) durch die AKTUELLEN `euer.js`/`bilanz.js`-Funktionen
   laufen lassen (Node-Skript mit Store-Mock, wie in der Vorsession für die Handrechnung
   gemacht) und die Ergebnisse als Referenzwerte festhalten.
2. Gemeinsame Funktion extrahieren.
3. Dieselben Testdatensätze erneut durchlaufen lassen, Ergebnisse müssen exakt den
   Referenzwerten aus Schritt 1 entsprechen (bis auf ggf. bekannte, in der Vorsession bewusst
   gefixte Abweichungen — dann sind die NEUEN Werte die korrekten, nicht die alten).
4. Erst danach `euer.js`/`bilanz.js` auf die gemeinsame Funktion umstellen.

Kein Zeitdruck — das ist reine Wartbarkeit, keine akute Falschberechnung mehr (beide Module
liefern nach den Vorsession-Fixes für sich genommen korrekte Zahlen).

---

## Abschluss

- Punkt 1 nicht ohne Rückfrage/Scope-Entscheidung umsetzen — sonst baut man am Bedarf vorbei.
- Punkt 2 nur umsetzen, wenn der Aufwand (async-Umbau über 5 Dateien) im Verhältnis zum
  Nutzen steht — im Zweifel Empfehlung geben statt blind umzusetzen.
- Punkt 3 ist der risikoärmste der drei (reine Wartbarkeit) — bei Zeitdruck zuerst.
- Nach Abschluss `plan/offene-punkte-2026-07-15.md` aktualisieren.
- Wie immer: kein `git add -A`, nur gegengelesene Dateien stagen, nicht deployen ohne
  expliziten Wunsch des Users.

---

**Modell-Empfehlung: Opus 4.8.** Grund: Punkt 1 ist eine Produkt-/Scope-Entscheidung mit
steuerlicher Tragweite, Punkt 2 ein async-Architektur-Umbau mit Fehlerpotential über mehrere
Dateien, Punkt 3 ein Refactor mit Regressionsrisiko in zwei zentralen Finanzmodulen — alle drei
brauchen eher Sorgfalt und Urteilsvermögen als reines Pattern-Matching.
