# Prompt für neue Session (copy-paste) — Vollaudit-Rest: Rechnungs-Workflow-Bugs (Versand-Status, Mahnung-Lager-Sync, Fälligkeitsdatum)

---

Kontext: Vollaudit vom 2026-07-23 (`plan/session-prompt-rechnung-eigenbeleg-vollaudit-fixes-2026-07-23.md`,
Fund 12, 13, 14). Drei unabhängige, aber verwandte Korrektheitsbugs im Rechnungs-Workflow, alle
mittlerer Priorität.

Vor Ausführung IMMER `git status --short` + `git log --oneline -10` frisch prüfen — parallele
Sessions im selben Ordner sind üblich in diesem Projekt.

## Fund 12: Versand-Status wird nicht automatisch gesetzt

`dokumente.js:362-398` — separate Checkbox nach PDF/E-Mail-Öffnen nötig, leicht vergessen. Status
bleibt fälschlich "Offen" trotz echtem Versand.

Fix: Versand-Status automatisch setzen, sobald PDF-Export oder E-Mail-Versand tatsächlich
ausgelöst wurde (Event-Hook direkt an den Export-/Versand-Button, nicht als separater manueller
Schritt).

## Fund 13: Mahnungen-„Als bezahlt" umgeht Lager-Sync-Modal

`.mahn-paid` (`mahnungen.js:321-333`) setzt Status direkt, ohne `showBezahltModal`
(Lager-/Verkaufs-Sync), das der reguläre Dokumente-Bezahlt-Pfad nutzt. Aus Mahnungen bezahlte
Rechnungen synchen Lagerartikel nicht.

Fix: `.mahn-paid`-Handler auf denselben `showBezahltModal()`-Pfad umstellen wie in
`dokumente.js`, statt Status direkt zu setzen. Konsistenz zwischen beiden Bezahlt-Einstiegspunkten
herstellen.

## Fund 14: Fälligkeitsdatum wird auch bei Lieferdatum-Modus gesetzt

`rechnung.js` speichert immer ein Default-Fälligkeitsdatum (+14 Tage), auch wenn
`datumsOption='lieferdatum'/'lieferzeitraum'` gewählt wurde. `mahnungen.js:49` prüft
`faelligkeit < today` unabhängig davon → false-positive "überfällig".

Fix: Fälligkeitsdatum nur setzen, wenn `datumsOption` tatsächlich ein Zahlungsziel vorsieht;
`mahnungen.js`-Prüfung entsprechend absichern (kein Fälligkeitsdatum → nicht mahnfähig, statt
implizit auf ein nie gesetztes/falsches Datum zu prüfen).

## Akzeptanzkriterien

- PDF exportieren oder E-Mail versenden → Versand-Status wechselt automatisch, keine manuelle
  Checkbox mehr nötig.
- Rechnung aus Mahnungen als bezahlt markieren → verknüpfte Lagerartikel werden synchronisiert
  (gleiches Verhalten wie über die Dokumente-Liste).
- Rechnung mit `datumsOption='lieferdatum'` → kein falsches Fälligkeitsdatum, taucht nicht
  fälschlich als "überfällig" in Mahnungen auf.

Nach Fertigstellung: Browser-Smoketest — Rechnung mit Lieferdatum-Modus anlegen (nicht überfällig
erwartbar), eine andere per PDF-Export öffnen (Versand-Status prüfen), eine dritte über Mahnungen
als bezahlt markieren (Lager-Sync-Modal muss erscheinen).
