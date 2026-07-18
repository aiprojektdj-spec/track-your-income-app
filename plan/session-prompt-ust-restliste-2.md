# Prompt für neue Session (copy-paste) — USt-Regelbesteuerung: Restliste Teil 2

---

Kontext: Anschluss an `plan/session-prompt-ust-restliste.md` (Punkte 2–7 der USt-Restliste).
In der Vorsession (2026-07-17/18) wurden Punkt 5 (`vorsteuer.js` Kz.-66-Label), Punkt 6
(`calcBrutto`/`isKlein`-Snapshot) und Punkt 7 (CH-Steuersätze) verifiziert/gefixt und nach
`plan/offene-punkte-2026-07-15.md` (Abschnitt "USt-Regelbesteuerung — Restliste") committet
und deployed (Commits `1bc6b32`, `693d0de`, `83b6296` — live auf
`track-your-income-app.vercel.app`). **Offen bleiben die Punkte 2, 3, 4 (echtes UStG-Reasoning)
+ zwei Verifikations-/Cosmetic-Lücken.** Aufgabe: diese abarbeiten.

WICHTIG (geteiltes Repo): Beim Start dieser Session lief bereits **parallel eine andere Session**
im selben Ordner (Änderungen an `afa.js`, `ausgaben.js`, `buchungen.js`, `cloud-sync.js`,
`companies.js`, `i18n.js`, `kassenbuch.js`, `utils.js`, `vercel.json`, sowie neue
Validierungslogik in `rechnung.js` — negative Menge/Preis-Guard + Duplikat-Rechnungsnummer-Check
waren zum Zeitpunkt 2026-07-18 unstaged, unreviewt, nicht von dieser Restliste-Arbeit). **Zuerst
`git status` + `git log --oneline -10` frisch prüfen** — nicht davon ausgehen, dass diese Dateien
noch im selben Zustand sind oder dass sie zu dieser Aufgabe gehören. Nur eigene Dateien stagen,
nichts Fremdes committen ohne es verstanden zu haben. Vor JEDEM Edit die Datei frisch lesen.

## Punkt 2 — Kz. 41 vs. Kz. 21 bei EU-B2B-Dienstleistungen

ZM-Abgleich-Diskrepanz: Alle 0%-EU-B2B-Umsätze laufen aktuell als „ig. Lieferung" (Kz. 41,
Ware). Dienstleistungen gehören in Kz. 21 + ZM „Sonstige Leistungen". Einstieg:
`js/ustvoranmeldung.js` (Kz.-Zuordnung), ZM-Meldungs-Logik falls vorhanden. Braucht vermutlich
ein Ware/Leistung-Feld an Position oder Rechnung — erst Scope klären (reicht ein globales Flag
pro Rechnung, oder muss es pro Position sein, weil eine Rechnung beides mischen kann?), dann
Umsetzung planen. **Steuerlich heikel — `legal-reviewer`-Agent für die §-Zuordnung konsultieren,
bevor Code geändert wird.**

## Punkt 3 — Ist-Modus strukturell lückenhaft bei EU-Geschäft

Verifiziert (Vorsession, 2026-07-17): Kz. 41/43 bleiben im Ist-Zweig leer (Sales kennen kein
Kundenland), kein OSS-Ausschluss, Misch-Rechnung (19+7 %) landet komplett im 19%-Topf. Es gibt
**keinen In-App-Hinweis** — nur ein Code-Kommentar in `js/ustvoranmeldung.js` (`_isSoll()`-Pfad),
für Nutzer unsichtbar. Aufgabe: sichtbaren Hinweis im Ist-Versteuerung-UI ergänzen, der Nutzer
mit EU-Geschäft im Ist-Modus warnt, bevor sie von der Lücke überrascht werden. Reine
UX-Textfrage — kein Rechenlogik-Fix nötig, aber Formulierung (Steuerbegriffe) am besten kurz mit
`legal-reviewer` gegenchecken.

## Punkt 4 — OSS unterjährig: rückwirkendes Kippen bei Schwellen-Überschreitung

`js/oss.js` (`SCHWELLE: 10000`, `_jahresumsatz()`). Szenario: Q1/Q2 unter 10.000 €-Schwelle
abgerechnet (deutsche USt), Q3 überschreitet die Schwelle kumuliert — muss dann rückwirkend auf
OSS für Q1/Q2 umgestellt werden? Erst §3c UStG Schwellenübergang klären (**`legal-reviewer`
einbinden, steuerlich nicht trivial**), dann prüfen ob `js/ustvoranmeldung.js`s
`ossActive`-Berechnung das bereits korrekt pro Periode oder nur pro aktuellem Zeitpunkt
behandelt.

## Punkt 5 — Browser-Verifikation des isKlein-Fixes (Punkt 6 aus Teil 1)

Die Vorsession konnte den isKlein-Snapshot-Fix nur **statisch** verifizieren (grep + `node
--check`) — die App ist Whop-Login-gated, keine Zugangsdaten waren in der Session verfügbar.
Mit echtem Login (User stellt bereit oder führt es selbst durch) end-to-end verifizieren:
1. Rechnung unter Regelbesteuerung erstellen, brutto-Betrag notieren.
2. USt-Modus in Einstellungen auf Kleinunternehmer wechseln.
3. Alte Rechnung erneut öffnen/anzeigen/drucken (`generatePreviewHtml`) — Betrag muss
   unverändert (mit MwSt) bleiben, nicht auf netto springen.
4. Neue Rechnung erstellen — muss jetzt korrekt ohne MwSt sein.
5. Storno der alten Rechnung erstellen — Storno muss den isKlein-Stand der Originalrechnung
   übernehmen, nicht den aktuellen.
6. XRechnung-Export der alten Rechnung prüfen — muss historisch korrekt sein.

## Punkt 6 — Kosmetik: Dashboard-Einnahmen-Karte-Diskrepanz

Aus dem P0-4-QA-Sweep übrig: Dashboard-Einnahmen-Karte zeigte im Test 1.313,99 € bei 3.785 €
brutto Sales. Ursache noch nicht untersucht — erst reproduzieren (Testfirma mit ähnlichen
Testdaten aufbauen oder Rechenweg der Karte nachvollziehen), dann Root Cause finden.

## Abschluss

- Punkte 2/3/4 nicht ohne Rücksprache/`legal-reviewer` final entscheiden — dokumentierter
  Befund + Empfehlung reicht, wenn keine Zeit für vollständige Umsetzung.
- Nach Abschluss `plan/offene-punkte-2026-07-15.md` (USt-Restliste-Abschnitt) aktualisieren.
- Nicht deployen ohne expliziten Wunsch des Users — bei dieser Session ist unklar, ob die
  parallel laufenden Änderungen (siehe Hinweis oben) schon fertig/reviewt sind. Im Zweifel nur
  die eigenen Dateien committen und pushen, nicht `git add -A`.

---

**Modell-Empfehlung: Opus 4.8.** Grund: Punkte 2 und 4 sind echtes UStG-Reasoning
(ZM-Kz.-Zuordnung, OSS-Schwellenübergang) mit steuerlicher Tragweite — kein reiner
Pattern-Fix. Punkt 5 (Browser-Verifikation) und 6 (Kosmetik-Bug) sind dagegen mechanisch und
eignen sich auch für ein schnelleres Modell, falls die Session gesplittet wird.
