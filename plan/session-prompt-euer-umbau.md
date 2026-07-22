# Prompt für neue Session (copy-paste) — EÜR-Tab nach Rechtsform/Gewinnermittlungsart/Besteuerungsart umbauen

---

## Kontext

Planungssession (2026-07-21): der EÜR-Tab soll künftig nicht mehr pauschal EÜR anzeigen, sondern
sich danach richten, was für die jeweilige Firma fachlich zutrifft. Auslöser war die
Differenzbesteuerungs-Planung (siehe `plan/session-prompt-differenzbesteuerung.md`), die als
dritte Achse in dieses Konzept einfließt. **Diese Session sollte nach oder zusammen mit der
Differenzbesteuerungs-Session laufen**, da §25a-Zeilen Teil des EÜR-Layouts sind.

Vorher `git status`/`git log` frisch prüfen — mehrere Sessions laufen teils parallel.

## Rechtlicher Hintergrund — recherchiert 2026-07-21

Es gibt zwei Gewinnermittlungsarten in Deutschland (Landwirte-Durchschnittssatzrechnung §13a EStG
ausgeklammert, nicht Stackrs Zielgruppe):

| Art | Rechtsgrundlage | Prinzip |
|---|---|---|
| **EÜR** | §4 Abs. 3 EStG | Zufluss-/Abflussprinzip, nur tatsächliche Zahlungen |
| **Bilanzierung** (Betriebsvermögensvergleich) | §4 Abs. 1 / §5 EStG i.V.m. §238ff. HGB | Vermögensvergleich Jahresanfang/-ende, Rückstellungen möglich |

**Wer muss was?**
- **Kapitalgesellschaften** (GmbH/UG): immer bilanzierungspflichtig kraft Rechtsform (§238 HGB),
  unabhängig von Größe.
- **Freiberufler** (§18 EStG): nie buchführungspflichtig, dürfen immer EÜR machen, egal wie groß.
- **Gewerbliche Einzelunternehmer & GbR**: EÜR nur unterhalb der Schwellen aus **§141 AO** —
  **Umsatz ≤ 800.000€ UND Gewinn ≤ 80.000€** (Werte seit 1.1.2024). Wird eine Schwelle gerissen,
  fordert das Finanzamt zur Bilanzierung auf (meist ab dem übernächsten Jahr).

Quellen: [§141 AO Gesetzestext](https://www.gesetze-im-internet.de/ao_1977/__141.html),
[Finom: Buchführungspflicht 2026](https://finom.co/de-de/blog/buchfuehrungspflicht/),
[Lexware: Gewinnermittlung](https://www.lexware.de/wissen/buchhaltung-finanzen/gewinnermittlung/).

## Gefundene Lücke im Code (Explore-Agent, 2026-07-21)

`js/euer.js` Zeile 15 prüft nur `Rechtsform.isKapitalgesellschaft()` für den
"Bilanz-statt-EÜR"-Hinweis. Eine **gewerbliche** GbR oder ein **gewerblicher** Einzelunternehmer,
der über die §141-AO-Schwelle wächst, bekommt aktuell trotzdem klaglos einen EÜR-Report — fachlich
falsch. Vor dem Bauen prüfen:

- Existiert in `js/rechtsform.js` (`FORMEN`-Dict, Zeilen 6-199) bereits ein Flag
  "freiberuflich"/"gewerblich"? Falls nicht, muss das neu erhoben werden (z.B. beim
  Firmen-Onboarding als Zusatzfrage) — das ist eine Produktentscheidung, nicht nur Code.
  `grep -n "freiberuf\|gewerblich" js/rechtsform.js js/companies.js` als erster Schritt.
- Woher kommen Jahresumsatz/-gewinn für den Schwellenwert-Vergleich? Vermutlich aus den
  bestehenden EÜR-Berechnungsfunktionen selbst (Chicken-Egg: EÜR muss erst gerechnet werden, um zu
  wissen, ob EÜR erlaubt ist — praktisch lösbar, da man mit EÜR-Logik rechnet und nur die
  Darstellung/den Hinweis ändert, wenn die Schwelle gerissen wird, nicht die zugrundeliegenden
  Store-Daten).

## Konzept: drei Achsen statt einer Kapitalgesellschaft-Weiche

```
Aufruf EÜR-Tab
 └─ Gewinnermittlungsart bestimmen (NEU, fehlt heute)
     ├─ Kapitalgesellschaft → Bilanz-Hinweis (heute schon so, unverändert)
     ├─ Gewerblich + über §141-AO-Schwelle → NEU: Bilanz-Hinweis
     └─ sonst (Freiberufler, oder unter Schwelle) → EÜR-Report wie bisher
         ├─ Besteuerungsart-Block (Kleinunternehmer §19 / Regelbesteuerung, wie bisher)
         │   └─ bei Regelbesteuerung: §25a-Zeilen (siehe Differenzbesteuerungs-Session)
         └─ GbR-Block (Gewinnverteilung 50/50 etc., unverändert, hängt nur dran)
```

**Wichtig — was NICHT angefasst werden soll:**
- `GbR.renderEuerBlock()` (`js/gbr.js`) bleibt strukturell wie es ist (wird ans Ende gehängt,
  liest den bereits berechneten Gesamtgewinn). Die Gewinnverteilung ist ein nachgelagerter
  Schritt, keine eigene Gewinnermittlungslogik.
- Die eigentliche Zufluss-/Abfluss-Berechnung (Zeilen 143-222 in `euer.js`) ändert sich durch
  diesen Umbau nicht — es geht um die **Weiche davor** (welcher Report-Typ wird überhaupt
  gerendert) und neue **Anzeige-Zeilen** (§25a), nicht um die Kernrechnung.

## Bauplan

1. Klären: gibt es schon ein freiberuflich/gewerblich-Flag? Falls nein, mit User abstimmen, ob/wie
   es erhoben wird (Onboarding-Frage, Nachfrage in Firmeneinstellungen) — **das ist eine
   Scope-Entscheidung, nicht einfach loscoden**.
2. §141-AO-Schwellenwert-Prüfung: Jahresumsatz/-gewinn aus der bestehenden EÜR-Berechnung ziehen,
   gegen 800.000€/80.000€ prüfen, bei Überschreitung denselben Hinweis-Block wie bei
   Kapitalgesellschaften zeigen (ggf. Text anpassen: "Sie sind ab dem Folgejahr voraussichtlich
   bilanzierungspflichtig").
3. §25a-Zeilen aus der Differenzbesteuerungs-Session einbauen (siehe dortige Datei) — falls diese
   Session zuerst läuft, das Datenmodell (`differenzbesteuert`-Flag) muss vorher existieren.
4. `js/gbr-modul.js` (`_calcJahresgewinn`) auf dieselbe Weiche prüfen — dupliziert aktuell Teile
   der euer.js-Logik unabhängig (siehe auch `plan/session-prompt-ust-bulletproof.md` Punkt 3, dort
   ist eine Konsolidierung von euer.js/bilanz.js/gbr-modul.js als eigenes Vorhaben dokumentiert).
5. Browser-Smoke: Testfirma mit Umsatz > 800.000€ anlegen (oder Store-Mock), prüfen dass der
   Bilanz-Hinweis erscheint; Testfirma darunter, prüfen dass EÜR wie gewohnt läuft.

## Entscheidungen (2026-07-21, Rückfrage an User)

- **Freiberuflich/gewerblich-Flag:** neu erheben, NICHT aus Rechtsform/Branche ableiten. UI als
  klickbare Module/Cards (kein Radio-Button-Paar) — analog bestehendem Onboarding-Card-Stil prüfen
  (`onboarding.js`/Wizard-Steps). Muss auch für Bestandsfirmen nachträglich abfragbar sein
  (Firmeneinstellungen), da Pflichtfeld für die §141-AO-Weiche.
- **Bilanz-Hinweistext:** Hinweis + Platzhalter-Formulierung ("Bilanzierung in Stackr in Planung"),
  da Stackr Bilanzierung perspektivisch als Feature bauen will (kein reiner
  Steuerberater-Verweis-Text). Exakten Wortlaut in der Bau-Session mit User abstimmen.

## Akzeptanzkriterien

- Kapitalgesellschaften: Verhalten unverändert (Regressionstest).
- Gewerbliche EU/GbR unter der §141-AO-Schwelle: EÜR-Report wie bisher, keine Verhaltensänderung.
- Gewerbliche EU/GbR über der Schwelle: neuer Bilanz-Hinweis (analog Kapitalgesellschaft).
- Freiberufler: immer EÜR-Report, unabhängig von Umsatz/Gewinn (Regressionstest).
- GbR-Widget (`GbR.renderEuerBlock`) unverändert funktionsfähig in allen Fällen, in denen EÜR
  gerendert wird.

## Nach Abschluss

- `plan/todo-rest-*.md` (aktuellste Version) aktualisieren.
- Prüfen, ob Local 1.7 diese Änderung ebenfalls braucht (siehe
  `plan/session-prompt-local-spiegeln.md`).

## Status: gebaut (2026-07-21)

- `js/rechtsform.js`: neue Helper `istGewerblich()`, `ueberschreitetAO141Schwelle(year)`,
  `brauchtBilanzStattEuer(year)`, Flag-Storage `taetigkeitsart` (Default `'gewerblich'` = kein
  Verhaltenswechsel für Bestandsfirmen).
- `js/gbr.js`: Settings-Modal bekommt Tätigkeitsart-Kartenauswahl (Freiberuflich/Gewerblich),
  sichtbar nur bei Einzelunternehmen/GbR/eGbR.
- `js/euer.js`: Weiche nutzt jetzt `Rechtsform.brauchtBilanzStattEuer()`, zeigt bei
  §141-AO-Überschreitung eigenen Hinweistext (mit "Bilanzierung in Planung"-Formulierung).
- `js/gbr-modul.js`: Übersicht zeigt zusätzlichen Warn-Banner bei überschrittener Schwelle,
  Kernrechnung unangetastet (Non-Goal laut Plan).
- Nicht gebaut: echte Bilanzierungsfunktion (bewusstes Non-Goal), Gewerbesteuer-Neuberechnung für
  freiberufliche GbR (aktuell weiterhin pauschal `gewerbesteuer:true` in `FORMEN`-Dict — Folgelücke,
  siehe unten).
- **Neu gefundene Folgelücke (nicht in dieser Session gefixt):** Eine als "freiberuflich" markierte
  GbR/Einzelunternehmen zahlt laut `Rechtsform.FORMEN`-Dict weiterhin Gewerbesteuer
  (`gewerbesteuer: true` ist rechtsform-fix, nicht taetigkeitsart-abhängig). Fachlich falsch für
  z.B. eine Ärzte-GbR. Braucht eigenen Fix in `gbr.js`/`gbr-modul.js`
  (`berechneGewSt`/`brauchtGewSt`) — außerhalb des Scopes dieser Session.
- Browser-Smoke nicht durchgeführt: App ist Whop-Login-gated, kein Login in dieser Umgebung
  möglich. Nur `node -c` Syntax-Check auf allen 4 geänderten Dateien (OK). Echter Klick-Test
  (Testfirma >800k Umsatz anlegen, Hinweis prüfen) steht beim User aus.

---

**Modell-Empfehlung: Opus 4.8.** Mehrere fachliche Scope-Entscheidungen (Freiberufler-Flag,
Hinweistext), Interaktion mit paralleler Differenzbesteuerungs-Session, Regressionsrisiko in
zentralem Finanzmodul.
