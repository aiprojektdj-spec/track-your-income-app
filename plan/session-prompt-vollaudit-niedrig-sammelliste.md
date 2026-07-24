# Prompt für neue Session (copy-paste) — Vollaudit-Rest: Niedrig-Priorität-Sammelliste (Fund 18-29)

---

Kontext: Vollaudit vom 2026-07-23 (`plan/session-prompt-rechnung-eigenbeleg-vollaudit-fixes-2026-07-23.md`,
Fund 18-29). Zwölf kleine, unabhängige Punkte — "bei Gelegenheit" laut Reihenfolge-Empfehlung der
Quelle, kein Zeitdruck. Bewusst als Sammelliste statt Einzeldateien, da jeder Punkt für sich zu
klein ist (meist 1-2 Zeilen Fix).

Vor Ausführung IMMER `git status --short` + `git log --oneline -10` frisch prüfen — parallele
Sessions im selben Ordner sind üblich in diesem Projekt. Am besten die Punkte abarbeiten, die
gerade zum eigenen Kontext passen (z.B. wenn ohnehin an `rechnung.js` gearbeitet wird, Fund 18/19
mit erledigen), statt die Liste stur von oben nach unten durchzugehen.

## Die 12 Punkte

**18.** Rundungs-Inkonsistenz Positionssumme vs. Gesamtsumme (`rechnung.js:541-548,1203-1219`) —
Positionssumme wird ungerundet akkumuliert, Zeilen einzeln gerundet angezeigt, Cent-Abweichung bei
Bruchteil-Cent-Werten möglich. Fix: konsistent runden (entweder durchgehend erst am Ende runden,
oder durchgehend pro Zeile runden und daraus summieren — eine der beiden Strategien wählen und
überall gleich anwenden).

**19.** `rechnung.js:516` — Position mit leerer Beschreibung + 0€-Preis wird beim Speichern still
verworfen, keine Warnung. Fix: Toast-Hinweis statt stillem Verwerfen.

**20.** Mahnfristen (14/10/7 Tage) sind hartcodierte Textstrings, keine echte
Berechnung/Speicherung. Fix: aus konfigurierbaren Werten berechnen statt Text hartzucodieren.

**21.** Fail-Open beim Whop-Gate: `rechnungen/js/app.js:340-343`, `eigenbelege/js/app.js:1844-1846`
booten ohne Gate, falls `AuthUI` undefiniert ist (Script-Ladefehler). Fix: bei fehlendem `AuthUI`
NICHT durchbooten, sondern Fehlerzustand/Blockbildschirm zeigen (fail-closed statt fail-open).

**22.** Kein Kunden-Such-Autocomplete (`kunden.js:134-140`, reines `<select>`), kein
"Rechnung duplizieren". Fix: Autocomplete auf bestehendem Select nachrüsten (kein neues Vendor-
Package nötig falls Browser-native `<datalist>` reicht); "Duplizieren"-Button analog zu
bestehenden Kopier-Mustern im Modul.

**23.** Tabellen ohne `scope="col"` in `kunden.js`, `dokumente.js`, `mahnungen.js`, `produkte.js`,
`rechnung.js`. Fix: mechanisch, `scope="col"` an alle `<th>` in Tabellenköpfen ergänzen.

**24.** Doppelter Mobile-Menü-Button in Rechnungen (Legacy `#mobileMenuBtn`-Handler läuft parallel
zum globalen Sidebar-Toggle). Fix: Legacy-Handler entfernen, nur globalen Sidebar-Toggle nutzen.

**25.** PDF-Seitenumbruch ungesichert (kein `page-break-inside:avoid`), Kopfbereich wiederholt sich
nicht auf Folgeseiten bei langen Positionslisten. Fix: CSS `page-break-inside:avoid` auf
Positionszeilen, `thead`-Wiederholung für Tabellenkopf bei mehrseitigem Druck.

**26.** Unescapte Mengenangabe im Eigenbeleg-Druck (`app.js:1343,1177`) — UI-seitig durch
`type="number"` entschärft, nicht clientseitig bei Import-Schreibpfaden abgesichert. Fix: `esc()`
ergänzen, konsistent mit anderen Feldern im selben Druck-Template.

**27.** Icon-Button ohne `aria-label` ("Filter zurücksetzen", `eigenbelege/js/app.js:1053`, nur
`title`). Fix: `aria-label` ergänzen (Screenreader lesen `title` auf Buttons nicht zuverlässig).

**28.** Keine Vor-Fälligkeits-Zahlungserinnerung (nur Mahnwesen nach Fälligkeit) — auch bei
Konkurrenz kein Kernstandard, geringe Priorität. Kein Fix nötig, nur zur Kenntnis — echtes
Feature, kein Bug.

**29.** Eigenbeleg-Formularvalidierung inkonsistent (native HTML5-Popups statt App-Toast-Stil).
Fix: `required`-Attribute durch eigene Toast-Validierung ersetzen, konsistent mit dem Rest der App.

## Akzeptanzkriterien

Punktweise abhaken — jeder Punkt ist unabhängig, kein Gesamt-Smoketest nötig. Bei CSS-/Text-
Änderungen (18, 20, 23, 25-27) reicht Sichtprüfung; bei Verhaltensänderungen (19, 21, 22, 24, 29)
kurzer Klick-Test im Browser.
