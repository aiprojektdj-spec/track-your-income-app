# USt-Bulletproof — was nach den 3 Punkten noch offen ist (Stand 2026-07-19)

Anschluss an `plan/session-prompt-ust-bulletproof.md`. Alle 3 Punkte (Vorsteuer-Beleg-Nachweis,
Race-Condition Rechnungsnummern, euer.js/bilanz.js-Dedup) sind umgesetzt und committet:

- `e84e5a0` — Punkt 1: Vorsteuer §14/§33-Beleg-Nachweis (Option C)
- `6165bce` — Punkt 2: Web Locks API gegen Rechnungsnummern-Race-Condition
- `6ced7e2` + `6f2d15a` — Punkt 3: `js/steuer-berechnung.js`-Extraktion (euer.js + bilanz.js)
- `782740e` — Nachfix: Wareneinkauf bei storniertem Verkauf nicht mehr fälschlich ausgebucht
  (löst den Befund aus dem `task_21badc7c`-Background-Task, gilt als erledigt)
- `cd0ea7e` — Punkt 2 (Background-Task): Vorsteuer aus sonstigen Betriebsausgaben per Eintrag
  statt pauschal 19% netten (respektiert `ustSatz=0`)
- `17b311c` — Rest aus Abschnitt 3: Eigenbeleg-Vorsteuer pro Beleg aus `betragMwst` statt
  im pauschalen 19%-Block (respektiert `mwstSatz=0`, Fallback für Altbelege)

## Noch offen

### 1. Echter Browser-Test (Whop-Login nötig)
Alles bisher nur `node --check` + Node-Harness (Referenzwerte vor/nach Refactor) verifiziert —
nie im echten UI angeklickt. App ist Whop-Login-gated, kein Zugang in Agent-Sessions.

- **2-Tab-Race-Test (Punkt 2):** zwei Tabs "Neue Rechnung" öffnen, kurz hintereinander
  speichern, Nummern dürfen nicht kollidieren.
- **Beleg-Nachweis-UI (Punkt 1):** Lieferant/Steuernr.-Felder + Beleg-Foto-Upload in
  Einkauf-Edit-Modal und Ausgabe-Formular, Vollständigkeits-Anzeige in `vorsteuer.js`
  (Übersicht-Card + Beleg-Spalte in den Detail-Tabs).

### 2. Background-Task ~~noch offen~~ ERLEDIGT (`cd0ea7e`)
- ~~`euer.js` nettet Vorsteuer aus sonstigen Ausgaben pauschal mit 19%~~ — gefixt: sonstige
  Ausgaben laufen jetzt per Eintrag über `SteuerBerechnung.nettoExpenses()` (respektiert
  `ustSatz=0`), pauschal 19% nur noch für Kategorien ohne Satz-Info (Versand, Plattform,
  Fahrt, Material).

### 3. Bewusste Scope-Grenzen aus Punkt 1 (kein Fehler, nur nicht abgedeckt)
- CSV-Bulk-Import und die Marktplatz-Batch-Kauf-Erfassung (`js/buchungen.js`, Session-Items-Flow)
  bekommen keine Lieferant/Steuernr./Beleg-Foto-Felder — nachträglich über das
  Einkauf-Edit-Modal ergänzbar. *(bleibt bewusst offen)*
- ~~Eigenbelege-Modul hat bereits `betragNetto`/`betragMwst`/`mwstSatz` pro Beleg gespeichert —
  `euer.js` nutzt das für seine Vorsteuer-Pauschale noch nicht~~ — ERLEDIGT (`17b311c`):
  Eigenbeleg-Vorsteuer wird jetzt pro Beleg aus `betragMwst` gezogen (mwstSatz=0 respektiert).

### 4. Nicht Teil des Plans, aber Projekt-Muster
- **Local 1.7 — Vorsteuer-Korrektheit gespiegelt (2026-07-21):** `Local 1.7/js/euer.js` hatte
  denselben Pauschal-Block, sogar zwei Fehler mehr — `sonstigeAusgaben` UND `afaKosten` liefen
  ebenfalls pauschal durch 19% (AfA-Vorsteuer = Doppelabzug). Inline gefixt ohne
  `SteuerBerechnung`-Abhängigkeit (Local hat die Extraktion nicht): per-Eintrag-Netting der
  sonstigen Ausgaben, Eigenbeleg-Vorsteuer aus `betragMwst`, AfA raus. `node --check` grün.
  Local-Git ist verwaist (viele vorbestehende uncommittete Dateien) → nur auf Dateiebene
  gespiegelt, nicht committet.
- **Rest der USt-Runde NICHT in Local:** die architektonische Extraktion
  (`js/steuer-berechnung.js`), Web Locks (Rechnungsnummern-Race) und die Beleg-Nachweis-UI
  (§14/§33) fehlen in Local weiterhin. Das ist bewusst eine eigene, größere Sync-Runde
  (Local ist Pre-Whop + divergent, kein Blind-Copy — siehe Memory "Stackr Project Layout").

## Nicht mehr relevant
- `plan/session-prompt-ust-restliste-2.md` — archiviert/gelöscht (war bereits vollständig
  erledigt, Datei markierte sich selbst als obsolet).
