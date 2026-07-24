# Prompt für neue Session (copy-paste) — Teilzahlung/Ratenzahlung im Rechnungsmodul

---

Kontext: Vollaudit-Fund 9 aus
`plan/session-prompt-rechnung-eigenbeleg-vollaudit-fixes-2026-07-23.md`. Feature-Lücke ggü.
sevDesk/lexoffice: Kunden mit Projektgeschäft (Anzahlung + Restzahlung, oder echte Ratenzahlung)
können den Zahlungsstatus einer Rechnung aktuell nicht abbilden. Größerer Scope als die übrigen
Vollaudit-Funde, daher eigene Datei.

Vor Ausführung IMMER `git status --short` + `git log --oneline -10` frisch prüfen — parallele
Sessions im selben Ordner sind üblich in diesem Projekt.

## Ist-Zustand

- Status-Enum kennt nur vier Werte: `offen` / `bezahlt` / `ueberfaellig` / `storniert`
  (`rechnungen/js/rechnung.js:81,1012,1486`). Kein Feld für Teilbetrag.
- Zahlungserfassung läuft über `showBezahltModal()` in `rechnungen/js/dokumente.js:444` — setzt
  Status direkt auf `bezahlt`, inkl. optionaler Lager-Verkaufs-Sync (verknüpfte Lagerartikel als
  verkauft markieren).
- `mahnungen.js` prüft nur `status !== 'bezahlt' && faelligkeit < today` für Mahnfähigkeit — eine
  Rechnung mit Teilzahlung wäre nach aktuellem Modell entweder fälschlich "offen" (volle Mahnung
  trotz Teilzahlung) oder man müsste sie manuell auf "bezahlt" setzen (verliert die Restschuld).
- Dashboard/Statistiken (`rech-dashboard.js`) summieren vermutlich über den Status, nicht über
  tatsächlich offene Beträge — mit Teilzahlungen würde die Umsatz-/Offene-Posten-Anzeige falsch.

## Vorschlag Scope (v1, minimal)

1. **Datenmodell**: neues Feld `teilzahlungen: [{datum, betrag, notiz}]` an der Rechnung (Array,
   analog zum bestehenden Audit-Log-Pattern), abgeleiteter Status `teilbezahlt` zusätzlich zum
   bestehenden Enum. `offenerBetrag = brutto - sum(teilzahlungen.betrag)`.
2. **Erfassung**: `showBezahltModal()` um Modus "Teilzahlung erfassen" erweitern (Betrag statt
   Vollbetrag eingeben) — bei `offenerBetrag <= 0` automatisch auf `bezahlt` wechseln, sonst
   `teilbezahlt`.
3. **Mahnwesen**: `mahnungen.js` auf `offenerBetrag` statt Bruttobetrag umstellen, Mahnung zeigt
   nur die tatsächliche Restschuld inkl. Verzugszinsen (§288 BGB, aus Fund 3 bereits gebaut) auf
   dem offenen Rest.
4. **Anzeige**: Dokumente-Liste/Dashboard zeigen `teilbezahlt` als eigenen Status-Chip mit
   Fortschrittsbalken oder "X von Y € bezahlt".
5. **PDF/Zahlungsbeleg**: bestehende Zahlungsbestätigung (falls vorhanden) muss Teilzahlungen
   einzeln ausweisen können (GoBD-Nachvollziehbarkeit — jede Teilzahlung ein eigener,
   nicht-überschreibbarer Eintrag, Audit-Log-Pflicht wie bei anderen Statusänderungen).

## Nicht in v1 (bewusst weglassen, YAGNI)

- Kein automatischer Ratenplan/-zahlungsplan mit Fälligkeitsterminen pro Rate — nur manuelle
  Erfassung einzelner Teilzahlungen bei Zahlungseingang.
- Keine Mahnstufen-Logik speziell für Teilzahlungen (nutzt bestehende Mahnstufen, nur auf
  Restbetrag).

## Akzeptanzkriterien

- Teilzahlung erfassen → `offenerBetrag` korrekt reduziert, Status wechselt zu `teilbezahlt`.
- Letzte Teilzahlung deckt Restbetrag → Status automatisch `bezahlt`.
- Mahnung auf teilbezahlter Rechnung zeigt nur Restbetrag + Zinsen auf Restbetrag, nicht auf
  ursprünglichen Bruttobetrag.
- Dashboard-Summen (Umsatz, offene Posten) bleiben korrekt bei gemischtem Bestand aus
  offen/teilbezahlt/bezahlt.
- Jede Teilzahlung landet als eigener Eintrag im zentralen Audit-Log (`js/store.js` Hash-Chain,
  siehe `[[gobd-edit-delete-rework]]`), keine stille Überschreibung alter Werte.
- Storno einer teilbezahlten Rechnung: bereits erfasste Teilzahlungen bleiben im Audit-Log
  nachvollziehbar (kein Datenverlust bei Storno).

Nach Fertigstellung: Browser-Smoketest (Rechnung anlegen → zwei Teilzahlungen erfassen → prüfen
Status/Restbetrag/Mahnung/Dashboard), danach `legal-reviewer`-Agent gegen GoBD-Anforderungen prüfen
lassen (neue Statusübergänge = neue Audit-Log-Pflicht).
