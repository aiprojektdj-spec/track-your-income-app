# Prompt für neue Session (copy-paste) — Lager: Status frei editierbar

---

**Status 2026-07-25: fertig, inkl. Browser-Smoke.** Siehe `plan/todo-rest-2026-07-24.md` Abschnitt
"Lager-Feature-Batch" für Details (Store-CRUD, dynamischer `STATUS_CONFIG`-Getter, Status-Modal,
isolierter Logik-Check + echter Browser-Test via Claude in Chrome, alles grün). Diese Datei kann
archiviert/gelöscht werden — der Rest unten ist nur noch als Kontext/Nachschlagewerk relevant,
nicht mehr als offene Aufgabe.

---

Kontext: Lager-Feature-Batch vom 2026-07-23 (`plan/session-prompt-lager-feature-batch.md`),
Punkt 2. Alle anderen Punkte (1, 3-10) sind bereits gebaut+gepusht — dies ist der letzte offene,
laut Reihenfolge-Empfehlung bewusst zurückgestellt ("größter Umbau, eigene Session"). Vorher
`git status`/`git log` frisch prüfen — Modul wird oft parallel bearbeitet.

Betroffene Dateien: `js/lager.js` (`STATUS_CONFIG` Zeile 37-45, ~12 weitere Referenzstellen:
Filter, Badges, Bulk-Status, Export, Sortierung), `js/store.js` (`stornoSale()`, `deleteSale()`
— `status === 'verfuegbar'`/`'verkauft'` als String-Literale, u.a. Zeile 1516/1568/1834 in
`js/lager.js`).

## Ist-Zustand

`Lager.STATUS_CONFIG` ist ein hart codiertes Objekt mit 7 Werten (verfuegbar, reserviert,
verkauft, beschadigt, reinigung, reparatur, ausgelistet), inkl. Farbe/Icon/Badge-Klasse. Wird an
~12 Stellen im Code referenziert.

## Soll (User-Entscheidung: "Voll frei + Vorschläge")

Nutzer kann eigene Status anlegen, umbenennen, löschen. Die 7 aktuellen Werte sind Vorbelegung
(Vorschlag), keine Pflicht — analog zum bereits gebauten Kategorien-Editor (Punkt 1, s.
`Store._getScopedList()`/`_addScopedListItem()`-Pattern in `js/store.js`).

## Wichtig beim Bauen

- Company-scoped Custom-Status-Store nötig (gleiches Pattern wie Kategorien/Händler, s.
  `getWarenkategorien()/addWarenkategorie()/renameWarenkategorie()/deleteWarenkategorie()` als
  Vorlage).
- Migration: bestehende Artikel mit `status: 'verkauft'` etc. müssen nach Umbau weiter
  funktionieren, auch wenn der Nutzer den Vorschlag später umbenennt/löscht — Fallback-Label für
  verwaiste Status-Keys einbauen, sonst brechen alte Datensätze in der Anzeige.
- **`verfuegbar`/`verkauft` bleiben intern stabile System-Keys, NICHT umbenennbar/löschbar** —
  diese beiden sind an mehreren Stellen als Business-Logik-String-Literal fest verdrahtet
  (Storno-/Verkaufslogik in `js/store.js`, Statusprüfungen in `js/lager.js`). Nur die übrigen 5
  (reserviert, beschadigt, reinigung, reparatur, ausgelistet) plus neu angelegte eigene Status
  sind frei editierbar/löschbar.
- UI: neuer "Status verwalten"-Button analog zum bereits gebauten "🏷️ Kategorien"-Button im
  Lager-Header (anlegen/umbenennen/löschen-Modal).

## Akzeptanzkriterien

- Migration ist lazy/rückwärtskompatibel — bestehende Kundendaten (Web + ggf. Local 1.7) brechen
  nicht.
- `verfuegbar`/`verkauft` bleiben intern stabile System-Keys, unabhängig vom neuen Status-Editor.
- Umbenennen eines Status migriert bestehende Artikel automatisch (wie beim Kategorien-Rename).
- Löschen eines Status, der noch an Artikeln hängt, verhindern oder mit Fallback-Label abfangen.
- Alle ~12 Referenzstellen (Filter, Badges, Bulk-Status, Export, Sortierung) funktionieren mit
  dynamischer statt hart codierter Liste.
- Browser-Smoke: Status anlegen/umbenennen/löschen, Artikel mit migriertem Status korrekt
  angezeigt, Bulk-Status-Aktion funktioniert weiter.

## Nach Fertigstellung

- `plan/todo-rest-*.md` aktualisieren (Lager-Feature-Batch dann komplett abgeschlossen).
- Local-1.7-Spiegelung einplanen (`plan/session-prompt-local-spiegeln.md`) — dort sind auch die
  bereits gebauten Punkte 1/4/5/6/7 noch nicht übertragen.

**Modell-Empfehlung:** Sonnet 5 reicht — fachliche Klärung ist mit dieser Datei + der
System-Key-Ausnahme (verfuegbar/verkauft) bereits abgeschlossen, kein Opus nötig.
