# Prompt für neue Session (copy-paste) — Differenzbesteuerung (§25a UStG) einführen

**Status: ERLEDIGT (2026-07-21).** Alle 6 Bauphasen gebaut und `node --check` + Handrechnung
verifiziert (Details: `plan/todo-rest-2026-07-21.md`, Abschnitt "Erledigt seit 2026-07-21 (2)").
`legal-reviewer`-Agent bestätigt kein §14c-Risiko. Offen: Browser-E2E durch User (Whop-Gate),
Local 1.7-Spiegelung, optionale 7%-Kunst-Sonderfall-Recherche falls Zielgruppe das braucht.

---

## Kontext

Auslöser: User-Wunsch per Telegram — "Rechnung soll Differenzbesteuerung abbilden, Unterschied
zwischen Wareneinkauf und Verkauf sichtbar, Artikelnummer automatisch hinzufügen." Anschließende
Planungssession (2026-07-21) hat Rechtslage + Codebasis recherchiert. Diese Datei bündelt das
Ergebnis als Bauauftrag. **Vorher `git status`/`git log` frisch prüfen** — mehrere Sessions laufen
teils parallel im selben Ordner.

Verwandte Datei: `plan/session-prompt-euer-umbau.md` (EÜR-Tab-Umbau nach Rechtsform/
Gewinnermittlungsart/Besteuerungsart) — Differenzbesteuerung ist dort die dritte Achse
("Besteuerungsart"), beide Sessions sollten sich beim EÜR-Report-Layout abstimmen bzw. diese
Session sollte zuerst laufen, weil sie das Datenmodell liefert, auf dem der EÜR-Umbau aufbaut.

## Rechtliche Eckpunkte (§25a UStG) — recherchiert 2026-07-21

- Gilt für Handel mit **gebrauchten Waren, Kunstgegenständen, Antiquitäten, Sammlungsstücken**,
  nur wenn die Ware **ohne Vorsteuerabzug** eingekauft wurde (z.B. von Privatpersonen).
- USt wird nur auf die **Marge** (Verkaufspreis − Einkaufspreis) berechnet, nicht auf den vollen
  Verkaufspreis.
- Auf der Rechnung darf die USt **niemals gesondert ausgewiesen** werden — sonst greift §14c UStG
  (Steuerschuld kraft Rechnung) UND der Käufer darf trotzdem keine Vorsteuer ziehen.
- Pflicht-Rechnungshinweis: „Gebrauchtgegenstände/Sonderregelung" (bzw. „Kunstgegenstände/
  Sonderregelung", „Sammlungsstücke und Antiquitäten/Sonderregelung" je nach Warenart).
- **Aufzeichnungspflicht** (§25a Abs. 6 UStG): pro Artikel getrennt Einkaufspreis, Verkaufspreis,
  Bemessungsgrundlage (=Marge) dokumentieren.
- **Einzeldifferenz** (Standard, jeder Artikel einzeln) vs. **Gesamtdifferenz** (Wahlrecht bei
  Einkaufspreis ≤750€, summiert über den Voranmeldungszeitraum). Negative Einzeldifferenz = 0€ USt
  für den Artikel, keine Verrechnung mit Gewinn-Artikeln. Negative Gesamtdifferenz kann innerhalb
  desselben Kalenderjahres mit späteren Voranmeldungszeiträumen verrechnet werden, nicht
  jahresübergreifend.
- **Kleinunternehmer §19 + §25a**: rechtlich möglich, aber wirkungslos nebeneinander — der
  Kleinunternehmer erhebt ohnehin keine USt, die Marge-Regel betrifft nur die
  USt-Bemessungsgrundlage. Kein UI-Zwang nötig, aber ein Hinweis wäre nutzerfreundlich.
- **USt-Voranmeldung**: differenzbesteuerte 19%-Umsätze kommen in **Zeile 27, Kennziffer 81** —
  eingetragen wird die Marge, nicht der Verkaufspreis. **Neu ab Besteuerungszeitraum 2026**:
  Kennziffer 500 (Zeile 55) — wenn aktiviert, nimmt das automatisierte Verfahren die UVA raus und
  ein Sachbearbeiter prüft manuell. Betrifft Fälle mit "abweichender Bemessungsgrundlage" wie
  §25a. Falls Stackr eine UVA-Ausgabe hat/bekommt: Hinweis/Tooltip einbauen.
- Vorsteuer aus dem Wareneinkauf für §25a-Artikel ist **nicht abziehbar** (logisch, da ohne
  Vorsteuerabzug erworben).

Quellen (Stand der Recherche, bei Bedarf erneut prüfen — Steuerrecht ändert sich):
[§25a UStG Gesetzestext](https://www.gesetze-im-internet.de/ustg_1980/__25a.html),
[JuraForum §25a](https://www.juraforum.de/gesetze/ustg/25a-differenzbesteuerung),
[Deubner: Aufzeichnungspflichten](https://www.deubner-steuern.de/themen/umsatzsteuer/differenzbesteuerung/differenzbesteuerung-nachweis-der-voraussetzungen-und-aufzeichnungspflichten.html),
[WHK Controlling: Rechnung Differenzbesteuerung](https://www.whk-controlling.de/wissen/rechnung-differenzbesteuerung-muster),
[Haufe: Gesamtdifferenz](https://www.haufe.de/finance/haufe-finance-office-premium/differenzbesteuerung-8-vereinfachungsregelung-bildung-einer-gesamtdifferenz_idesk_PI20354_HI844787.html),
[easybill: Differenzbesteuerung](https://www.easybill.de/ratgeber/differenzbesteuerung/),
[Winheller: Kennziffer 500](https://winheller.com/blog/neue-kennziffer-500-umsatzsteuer-voranmeldung/).
**Vor dem Bauen: legal-reviewer-Agent gegenlesen lassen**, da steuerlich scharf (§14c-Risiko bei
Fehlern).

## Kern-Entscheidung: §25a ist ein Artikel-/Positions-Flag, kein globaler Modus

`Store.getSettings().ustMode` bleibt zweiwertig (`klein` | `regel`). Differenzbesteuerung ist
rechtlich ein **Wahlrecht pro Artikel innerhalb der Regelbesteuerung** (man kann Artikel A regulär
und Artikel B per §25a versteuern) — deshalb NICHT als drittes globales `ustMode`, sondern als
`differenzbesteuert: boolean` auf Artikel-/Positionsebene.

## Ist-Zustand (Explore-Agent, 2026-07-21)

- **`js/lager.js`** (`Lager`-Objekt ab Zeile 4): Artikel-Datenmodell hat schon `artikelNr`,
  `einkaufspreis`, `ustSatz` (Zeilen ~208, ~2124/2344), `einkaufspreis_netto`/`versandanteil`/
  `mwst_satz`-Varianten (~Zeile 2257), `status` (`verfuegbar`/`verkauft`). **Kein**
  Differenzbesteuerungs-Flag bisher — `ustSatz`-Feld ist das Vorbild für die Erweiterung.
- **`rechnungen/js/rechnung.js`**: „📦 Artikel aus Lager"-Button (Zeile 197), `showLagerPicker()`
  (Zeile 339+), `addPositionFromLagerArt()` (Zeile 448+) — erstellt Rechnungsposition
  `{ beschreibung, menge, einheit, einzelpreis, mwstSatz, lagerArtikelId }`. Hier muss das Flag
  durchgereicht werden UND die USt-Anzeige komplett unterdrückt werden (nicht nur ein anderer
  Satz).
- **`js/euer.js`**: `isRegel`-Flag (Zeile 25-27) steuert Vorsteuer-Abzug/Brutto-Netto-Logik
  (Zeilen 143-222). Kein §25a-Konzept vorhanden — Wareneinkauf/Vorsteuer-Berechnung muss
  §25a-Artikel rausrechnen können.
- **`js/gbr-modul.js`** (`_calcJahresgewinn`) dupliziert Teile der euer.js-Logik unabhängig — wird
  von §25a ebenfalls betroffen sein, siehe auch `plan/session-prompt-ust-bulletproof.md` Punkt 3
  (dort ist die Konsolidierung euer.js/bilanz.js/gbr-modul.js bereits als eigenes Vorhaben
  dokumentiert — beim Bauen dieser Session abstimmen, ob Differenzbesteuerung vor oder nach dieser
  Konsolidierung eingebaut wird; vor der Konsolidierung bedeutet: Logik an 2-3 Stellen einbauen).

## Baupläne (in Reihenfolge)

1. **Lager-Datenmodell**: Feld `differenzbesteuert: boolean` am Artikel, UI-Checkbox beim
   Einkaufs-Formular ("ohne Vorsteuerabzug erworben, z.B. von Privatperson — Differenzbesteuerung
   §25a möglich"). Default `false`.
2. **Rechnung**: `addPositionFromLagerArt()` übernimmt das Flag von der Lager-Position; auch
   manuell setzbar für Positionen ohne Lager-Bezug. Bei `differenzbesteuert === true`:
   - USt-Spalte/-Betrag auf der Rechnungsposition ausblenden (nicht nur 0% anzeigen — komplett
     unterdrücken, sonst §14c-Risiko).
   - Rechnungs-Footer/PDF: Pflichttext „Gebrauchtgegenstände/Sonderregelung" einfügen, sobald
     mindestens eine Position das Flag hat (Text abhängig von Warenart — ggf. Dropdown
     Gebrauchtgegenstände/Kunstgegenstände/Sammlungsstücke, falls Stackrs Zielgruppe mehr als nur
     Gebrauchtwaren braucht — Rückfrage an User, ob v1 nur "Gebrauchtgegenstände" abdeckt).
   - Artikelnummer aus Lager automatisch auf die Rechnungsposition übernehmen (das ist der
     ursprüngliche Telegram-Wunsch, technisch unabhängig vom §25a-Flag — sollte ohnehin passieren,
     wenn eine Position aus Lager stammt).
3. **`js/store.js`**: zentrale Marge-Berechnungsfunktion (Einzeldifferenz für v1, siehe
   Scope-Entscheidung unten), damit `euer.js` und ein späteres UVA-Modul sie teilen.
4. **`js/euer.js`** (und ggf. `js/gbr-modul.js`, siehe Ist-Zustand oben): neue Ausweis-Zeilen
   - Einnahmen: „differenzbesteuerte Umsätze" (Summe Verkaufspreise §25a-Artikel) getrennt von
     regulär besteuerten Umsätzen.
   - Ausgaben: „Wareneinkauf §25a" (ohne Vorsteuer) getrennt vom regulären Wareneinkauf (mit
     Vorsteuer).
   - Info-Block „Marge/Bemessungsgrundlage §25a" (nur Anzeige — die eigentliche USt-Schuld gehört
     ins UVA-Modul, falls vorhanden, nicht in den EÜR-Report selbst). Gewinnermittlung selbst
     ändert sich NICHT (Gewinn = Verkaufspreis − Einkaufspreis wie bei jedem Artikel) — das
     reduziert das Regressionsrisiko für den Kernwert "Gewinn".
5. **UVA-Modul** (falls `js/ustvoranmeldung.js` oder ähnliches existiert — prüfen): Marge in
   Zeile 27/Kz 81 eintragen, Hinweis auf Kz 500 (manuelle Prüfung durch Finanzamt möglich).

## Scope-Entscheidung — geklärt 2026-07-21

- **Einzeldifferenz UND Gesamtdifferenz-Wahlrecht (beides ab v1).** Mehr Aufwand als
  Plan-Empfehlung: Perioden-Summierung (Einkaufspreis ≤750€, je Voranmeldungszeitraum) +
  Jahres-übergreifende Verlustverrechnung (negative Gesamtdifferenz verrechenbar nur innerhalb
  desselben Kalenderjahres) nötig. Braucht eigenes Datenmodell für "Periode" (Monat/Quartal je
  nach USt-Voranmeldungsrhythmus der Firma) und Umschalt-Logik pro Artikel/Charge, welche Methode
  gilt.
- **Warenarten v1: auch Kunstgegenstände/Sammlungsstücke/Antiquitäten**, nicht nur
  Gebrauchtgegenstände. Braucht Warenart-Dropdown (Gebrauchtgegenstände/Kunstgegenstände/
  Sammlungsstücke und Antiquitäten) mit warenartabhängigem Pflichttext auf der Rechnung, und
  Prüfung der 7%-Sonderfälle (ermäßigter Steuersatz bei bestimmten Kunstgegenständen/Einfuhren —
  vor dem Bauen erneut recherchieren, im Plan bisher nicht tief behandelt).
- **Rechnungstext-Variante: wählbar** (folgt aus Warenart-Dropdown oben).

## Reihenfolge — geklärt 2026-07-21

**Erst `ust-bulletproof`-Konsolidierung (euer.js/bilanz.js/gbr-modul.js zusammenführen), dann
Differenzbesteuerung.** Diese Session ist blockiert, bis die Konsolidierungssession
(`plan/session-prompt-ust-bulletproof.md` bzw. Nachfolgedatei) abgeschlossen ist — sonst müsste
§25a-Logik doppelt/dreifach eingebaut und später nochmal angefasst werden.

## Akzeptanzkriterien

- Lager-Artikel mit `differenzbesteuert=true` erscheinen auf der Rechnung ohne ausgewiesene USt,
  mit Pflichttext im Footer/PDF.
- EÜR-Report zeigt differenzbesteuerte Umsätze/Wareneinkauf getrennt aus, Gesamtgewinn bleibt
  rechnerisch identisch zur Vorher-Situation (Verkaufspreis − Einkaufspreis), nur der USt-Ausweis
  ändert sich.
- Kleinunternehmer-Firmen können das Flag setzen, ohne dass sich an der Rechnung etwas ändert
  (weiterhin keine USt ausgewiesen, wie schon vorher) — ggf. mit Hinweis, dass die Regel für sie
  wirkungslos ist.
- `node --check` auf allen geänderten Dateien, Handrechnung mit 2-3 Testartikeln (positive und
  negative Marge) gegen die neuen euer.js-Zeilen.
- Browser-Smoke: Artikel im Lager als §25a markieren → Rechnung daraus erstellen → PDF prüfen
  (kein USt-Ausweis, Pflichttext vorhanden) → EÜR-Tab öffnen (neue Zeilen sichtbar, Gewinn stimmt).

## Nach Abschluss

- `plan/todo-rest-*.md` (aktuellste Version) aktualisieren.
- Prüfen, ob Local 1.7 diese Änderung ebenfalls braucht (siehe
  `plan/session-prompt-local-spiegeln.md` für den Spiegelungs-Workflow).

---

**Modell-Empfehlung: Opus 4.8.** Steuerlich scharfes Thema (§14c-Risiko bei fehlerhaftem
USt-Ausweis), mehrere Module betroffen, Scope-Entscheidungen mit dem User nötig bevor Code
geschrieben wird.
