# USt-Bulletproof — was nach den 3 Punkten noch offen ist (Stand 2026-07-19)

Anschluss an `plan/session-prompt-ust-bulletproof.md`. Alle 3 Punkte (Vorsteuer-Beleg-Nachweis,
Race-Condition Rechnungsnummern, euer.js/bilanz.js-Dedup) sind umgesetzt und committet:

- `e84e5a0` — Punkt 1: Vorsteuer §14/§33-Beleg-Nachweis (Option C)
- `6165bce` — Punkt 2: Web Locks API gegen Rechnungsnummern-Race-Condition
- `6ced7e2` + `6f2d15a` — Punkt 3: `js/steuer-berechnung.js`-Extraktion (euer.js + bilanz.js)
- `782740e` — Nachfix: Wareneinkauf bei storniertem Verkauf nicht mehr fälschlich ausgebucht
  (löst den Befund aus dem `task_21badc7c`-Background-Task, gilt als erledigt)

## Noch offen

### 1. Echter Browser-Test (Whop-Login nötig)
Alles bisher nur `node --check` + Node-Harness (Referenzwerte vor/nach Refactor) verifiziert —
nie im echten UI angeklickt. App ist Whop-Login-gated, kein Zugang in Agent-Sessions.

- **2-Tab-Race-Test (Punkt 2):** zwei Tabs "Neue Rechnung" öffnen, kurz hintereinander
  speichern, Nummern dürfen nicht kollidieren.
- **Beleg-Nachweis-UI (Punkt 1):** Lieferant/Steuernr.-Felder + Beleg-Foto-Upload in
  Einkauf-Edit-Modal und Ausgabe-Formular, Vollständigkeits-Anzeige in `vorsteuer.js`
  (Übersicht-Card + Beleg-Spalte in den Detail-Tabs).

### 2. Background-Task noch offen
- **`euer.js` nettet Vorsteuer aus sonstigen Ausgaben pauschal mit 19%**, auch wenn eine
  Ausgabe `ustSatz=0` trägt (steuerfrei, z.B. Versicherung/Bankgebühren). `bilanz.js` macht das
  an der gleichen Stelle schon korrekt pro Position — kann als Vorlage dienen. Betrifft
  `js/euer.js` `vstOther`-Berechnung (Vorsteuer-Block innerhalb der EÜR-Berechnung).

### 3. Bewusste Scope-Grenzen aus Punkt 1 (kein Fehler, nur nicht abgedeckt)
- CSV-Bulk-Import und die Marktplatz-Batch-Kauf-Erfassung (`js/buchungen.js`, Session-Items-Flow)
  bekommen keine Lieferant/Steuernr./Beleg-Foto-Felder — nachträglich über das
  Einkauf-Edit-Modal ergänzbar.
- Eigenbelege-Modul hat bereits `betragNetto`/`betragMwst`/`mwstSatz` pro Beleg gespeichert —
  `euer.js` nutzt das für seine Vorsteuer-Pauschale noch nicht (hängt mit Punkt 2 oben zusammen).

### 4. Nicht Teil des Plans, aber Projekt-Muster
- **Local 1.7** ist noch nicht gespiegelt — alle 5 Commits dieser Runde nur in Web 1.7. Falls
  Feature-Parität gewünscht, braucht das eine eigene Sync-Runde (siehe Memory
  "Stackr Project Layout" zu Web vs. Local 1.7).

## Nicht mehr relevant
- `plan/session-prompt-ust-restliste-2.md` — archiviert/gelöscht (war bereits vollständig
  erledigt, Datei markierte sich selbst als obsolet).
