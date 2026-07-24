# Prompt für neue Session (copy-paste) — Angebot→Rechnung 1-Klick-Konvertierung

---

Kontext: Vollaudit vom 2026-07-23 (`plan/session-prompt-rechnung-eigenbeleg-vollaudit-fixes-2026-07-23.md`,
Fund 15). Feature-Lücke, kein Bug — eigenständiges Angebots-Modul existiert bereits, aber keine
Brücke zur Rechnung.

Vor Ausführung IMMER `git status --short` + `git log --oneline -10` frisch prüfen — parallele
Sessions im selben Ordner sind üblich in diesem Projekt.

## Ist-Zustand

Eigenständiges Angebots-Modul vorhanden, aber keine Funktion, ein Angebot in eine Rechnung zu
überführen. Nutzer muss die Rechnung komplett neu anlegen (alle Positionen, Kunde, Texte erneut
eingeben) — Doppelarbeit und Fehlerquelle (Übertragungsfehler).

## Vorschlag Scope (v1, minimal)

1. Button "In Rechnung umwandeln" auf der Angebots-Detailansicht/-Liste.
2. Übernimmt: Kunde, Positionen (Menge/Preis/Beschreibung/Steuersatz), Freitexte/Notizen aus dem
   Angebot 1:1 in eine neue Rechnung (neue Rechnungsnummer nach normalem Nummernkreis, neues
   Rechnungsdatum = heute).
3. Angebot bekommt einen Verweis auf die erzeugte Rechnung (z.B. `konvertiertZuRechnungId`) und
   wird optional als "umgewandelt" markiert (nicht löschen — Angebot bleibt für die Historie).
4. Rechnung bekommt einen Rückverweis auf das Ursprungsangebot (für Nachvollziehbarkeit).

## Nicht in v1 (bewusst weglassen, YAGNI)

- Keine automatische Anpassung bei nachträglicher Änderung des Angebots nach Konvertierung
  (Rechnung ist ab Erzeugung eigenständig, wie bei jeder anderen Rechnung auch).
- Keine Teil-Konvertierung (nur ausgewählte Positionen) — immer das komplette Angebot.

## Akzeptanzkriterien

- Angebot mit mehreren Positionen → "In Rechnung umwandeln" → neue Rechnung enthält alle
  Positionen/Kunde/Beträge identisch zum Angebot.
- Angebot bleibt nach Konvertierung einsehbar, zeigt Verweis auf die erzeugte Rechnung.
- Neue Rechnung nutzt den regulären, lückenlosen Rechnungsnummernkreis (keine Sonderbehandlung).
- Erneutes Konvertieren desselben Angebots: entweder verhindert (schon konvertiert) oder erzeugt
  bewusst eine zweite Rechnung mit Warnhinweis — Entscheidung vor Bau kurz mit User klären.

Nach Fertigstellung: Browser-Smoketest — Angebot mit 2-3 Positionen anlegen, konvertieren, neue
Rechnung auf Vollständigkeit prüfen (Positionen, Kunde, Beträge, Steuersätze).
