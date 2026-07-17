# Prompt für neue Session (copy-paste) — USt-Regelbesteuerung: Restliste

---

Kontext: Nach den großen USt-Regelbesteuerung-Fixes (Commits `6c3220a`/`ecdfeee`,
browserverifiziert 2026-07-13) und dem §17-Gutschriften-Fix (2026-07-16, siehe Memory
`ust-regelbesteuerung-fixes.md`) bleiben laut `plan/offene-punkte-2026-07-15.md`
mehrere kleinere, nicht launch-blockierende Punkte offen. Aufgabe: diese Restliste
systematisch abarbeiten.

**WICHTIG — die Restliste in `plan/offene-punkte-2026-07-15.md` ist teilweise veraltet
oder überschneidet sich mit dem P0-4/5-QA-Sweep-Abschnitt derselben Datei.** Für JEDEN
Punkt unten zuerst den AKTUELLEN Code-Stand verifizieren, bevor etwas geändert wird —
nicht blind auf die Beschreibung verlassen. Konkretes Beispiel (siehe Punkt 6 unten):
die Restliste behauptet, `calcBrutto` sei ungefixt in "4 Kopien", der P0-4/5-Abschnitt
derselben Datei behauptet, genau das sei bereits gefixt — die Wahrheit (verifiziert in
dieser Recherche, 2026-07-16) liegt dazwischen: 3 von 6 tatsächlichen Kopien sind gefixt,
3 nicht.

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im selben Ordner. Vor JEDEM
Edit die Datei frisch lesen; nur eigene Dateien stagen. Nicht deployen — das macht der User.

## Punkt 6 — `calcBrutto` §19-Historisierung: TEILWEISE gefixt, 3 Kopien fehlen noch

Verifizierter Stand (`grep -rn "function calcBrutto\|isKlein.*ustMode" rechnungen/js/`):

**Bereits korrekt** (nutzen `invoice.isKlein !== undefined ? invoice.isKlein : (Store.getSettings().ustMode === 'klein')`):
- `rechnungen/js/rech-dashboard.js:4`
- `rechnungen/js/mahnungen.js:6`
- `rechnungen/js/dokumente.js:4`

**Noch ungefixt** (lesen `Store.getSettings().ustMode` direkt, ignorieren
`invoice.isKlein`):
- `rechnungen/js/rechnung.js:41` (die `calcBrutto`-Funktion in der Datei, in der
  Rechnungen selbst erstellt/bearbeitet werden — sollte eigentlich die einfachste sein)
- `rechnungen/js/rechnung.js:408, 485, 810` (weitere `isKlein`-Berechnungen in derselben
  Datei, außerhalb von `calcBrutto` — prüfen ob die auch historisch sein sollten oder
  bewusst den aktuellen Stand nutzen, z. B. beim NEU-Anlegen einer Rechnung ist "aktuell"
  richtig, beim ANZEIGEN einer alten Rechnung falsch — pro Vorkommen einzeln entscheiden)
- `rechnungen/js/xrechnung.js:78` (XRechnung-Export — für rechtsverbindliche
  E-Rechnungs-Exporte historisch korrekt besonders wichtig, siehe §14 UStG)
- `rechnungen/js/kunden.js:10, 113` (Kontext prüfen, ob dort überhaupt eine bestehende
  Rechnung oder ein neuer Kunde berechnet wird)

Fix-Muster (aus den 3 bereits gefixten Kopien übernehmen):
```js
var isKlein = invoice.isKlein !== undefined ? invoice.isKlein : (Store.getSettings().ustMode === 'klein');
```
Nur anwenden wo `invoice`/`inv` im Scope eine BESTEHENDE, bereits gespeicherte Rechnung
ist. Beim Neu-Erstellen (vor dem ersten Speichern) ist der aktuelle `Store.getSettings()`-
Stand weiterhin korrekt — nicht überall stumpf ersetzen.

## Punkt 2 — Kz. 41 vs. Kz. 21 bei EU-B2B-Dienstleistungen

ZM-Abgleich-Diskrepanz laut Restliste. Einstieg: `js/ustvoranmeldung.js` (Kz.-Zuordnung),
`js/vorsteuer.js`/ZM-Meldungs-Logik falls vorhanden. Erst verstehen welche Kz. für
sonstige Leistungen an EU-B2B-Kunden aktuell bespielt wird und ob das mit der
Zusammenfassenden Meldung (ZM) übereinstimmt, bevor etwas geändert wird — steuerlich
heikel, im Zweifel `legal-reviewer`-Agent für die §-Zuordnung konsultieren.

## Punkt 3 — Ist-Modus strukturell lückenhaft bei EU-Geschäft

Laut Restliste eine "dokumentierte Limitation" — erst prüfen, WO das dokumentiert ist
(In-App-Hinweis? Nur im Code kommentiert?). Falls nur im Code: einen sichtbaren Hinweis
im Ist-Versteuerung-UI ergänzen (`js/ustvoranmeldung.js`, `_isSoll()`-Pfad), damit
Nutzer im Ist-Modus mit EU-Geschäft nicht von einer stillen Lücke überrascht werden.
Falls schon in der App dokumentiert: nur verifizieren, kein Change nötig.

## Punkt 4 — OSS unterjährig: rückwirkendes Kippen bei Schwellen-Überschreitung

`js/oss.js` (`SCHWELLE: 10000`, `_jahresumsatz()`, Zeile ~8/46/65-70). Szenario: Q1/Q2
unter 10.000 €-Schwelle abgerechnet (deutsche USt), Q3 überschreitet die Schwelle
kumuliert — muss dann rückwirkend auf OSS für Q1/Q2 umgestellt werden? Erst die
tatsächliche Rechtslage klären (§3c UStG, Schwellenübergang), dann prüfen ob
`js/ustvoranmeldung.js`s `ossActive`-Berechnung das bereits korrekt pro Periode oder nur
pro aktuellem Zeitpunkt behandelt. Steuerlich nicht trivial — `legal-reviewer` einbinden.

## Punkt 5 — `vorsteuer.js` Doppelabzug-Label — Status unklar, erst prüfen

Die Restliste beschreibt dies als "gleiche Falle wie gefixte UVA-Stat-Karte" (impliziert:
noch offen, analog zu einem bereits gefixten Fall). Der P0-4/5-Abschnitt derselben Datei
behauptet dagegen, GENAU DAS sei in `vorsteuer.js` (Kz. 66 auf Gesamtsumme inkl.
§13b/IG) bereits gefixt. In dieser Recherche (`js/vorsteuer.js:297-302`) sieht die
Kz.-66-Zeile bereits korrekt separiert aus (nur echte Vorsteuer aus Einkäufen/Ausgaben,
kein sichtbares Aufsummieren mit §13b/Kz.67 oder IG/Kz.61). **Erst mit einer echten
Testrechnung im Browser verifizieren, ob der Bug wirklich noch existiert, bevor Zeit in
die Suche nach einer zweiten Instanz investiert wird** — möglich, dass Punkt 5 in der
Restliste schlicht stale ist und beim P0-4/5-Fix bereits miterledigt wurde.

## Punkt 7 — Exotische Steuersätze (CH 8.1/2.6) nach Landwechsel fallen aus UVA-Töpfen

Nach der CH/AT-Entfernung aus Web 1.7 (2026-07-16, Memory `ch-at-removal-web.md`) prüfen,
ob dieser Punkt für Web 1.7 überhaupt noch relevant ist — ein Landwechsel zu CH ist in
der Web-Variante jetzt gar nicht mehr möglich (kein CH-Onboarding-Pfad mehr). Falls
irrelevant geworden: aus der Restliste streichen statt fixen. Falls für `Local 1.7`
relevant (die behält CH aktiv): dort separat prüfen, nicht in diesem Repo.

## Abschluss

- Für jeden Punkt zuerst den Ist-Zustand im Code verifizieren (siehe oben, die Doku ist
  stellenweise widersprüchlich) und das Ergebnis kurz festhalten, BEVOR gefixt wird.
- Steuerlich unklare Punkte (2, 3, 4) nicht ohne Rücksprache/`legal-reviewer` final
  entscheiden — hier reicht ein sauber dokumentierter Befund + Empfehlung.
- Punkt 6 (calcBrutto) ist der einzige hier mit einem klaren, mechanischen Fix-Muster —
  am besten zuerst erledigen.
- Nach Abschluss `plan/offene-punkte-2026-07-15.md` (USt-Restliste-Abschnitt) UND Memory
  `ust-regelbesteuerung-fixes.md` aktualisieren — und die Widersprüche zwischen den
  beiden Abschnitten in der Plan-Datei bereinigen, damit die nächste Session nicht
  wieder rätseln muss.
- Nicht deployen — das macht der User.

---

**Modell-Empfehlung: Opus 4.8.** Grund: mehrere Punkte sind echtes UStG-Reasoning
(OSS-Schwellenübergang, Kz.-Zuordnung, Ist/Soll-EU-Lücke) mit steuerlicher Tragweite,
kein reiner Pattern-Fix — und die widersprüchliche Doku-Lage erfordert sorgfältige
Verifikation statt schnellem Copy-Paste-Fixing.
