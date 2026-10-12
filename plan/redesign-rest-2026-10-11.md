# Redesign – Rest und Übergabe (Stand 2026-10-11)

Übergabe an eine neue Session. **Vor dem Greifen gegen den Code prüfen** (CLAUDE.md, Regel 3).

## Erledigt und live (master, getstackr.de)

| PR | Inhalt |
|---|---|
| #26 | App-Oberfläche (Topbar, Shell, zentrale Einstellungen) – andere Session |
| #27 | Startseite, Landing, Rechtsseiten, `barrierefreiheit.html`; hell/dunkel nach Gerät; Preis + 7-Tage-Test + JSON-LD (SoftwareApplication) |
| #32 | Alte Kennzahl-Karten (Jahresgewinn, Lager), Eigenbelege „Belegübersicht“, `/rechnungen/` mit neuer Liste, Firmenwechsler auf Einzelseiten, doppelter Lager-Titel, PRO-Badge neutral, Einzahl „1 Rechnung ist …“ |
| #33 | Lager-Einzelseite: Speicheranzeige neben Firmenwechsler ausgeblendet |
| #35 | ~240 Deko-Emojis in Fachmodulen entfernt, `.info-box` neutral, Umlaute im Protokoll |
| #45 | Akademie-Redesign (Codex, Commits `1d37903` + `1dcb2b7`) – live geprüft 2026-10-11 |
| #52 | Mobil: Filter untereinander, Unternavigation einzeilig wischbar, Rechnungen-Titel links, Lager-Kachelkanten |

## Offen

1. **Signalfarben – Entscheidung des Users nötig.** `css/redesign.css` setzt `--success/--warning/--danger/--info` alle auf `var(--text)`. Überfällige Rechnungen, Fristen, negative Beträge sind nicht farblich unterscheidbar. Ja/Nein vom User einholen, nicht raten.
2. **Restliche Emojis.** Bewusst nicht angefasst:
   - Status-Emojis, die allein Bedeutung tragen (✅/❌, ⚠️ bei PStTG-Meldepflicht – `test/test-statistiken.js` prüft `'⚠️ Meldepflicht'`).
   - Dateien `js/store.js`, `js/i18n.js`, `js/backup-crypto.js`, `js/datev.js`, `js/cloud-sync.js`, `js/whop-auth.js`, `js/stb-share.js`, `js/akademie.js` (Risiko: Schlüssel, Exporte, Byte-Gleichheit). Nur einzeln und mit Test angehen.
   - Tab-Arrays mit Emoji als eigenem Feld, z. B. `js/gbr-modul.js` (`['uebersicht', '📊', 'Übersicht']`).
3. **Mobil nicht geprüft:** Kassenbuch, Fahrtenbuch, AfA, GbR, Retouren, Materiallager, Steuertermine, Protokoll, Akademie-Lektion.
4. **Hell auf dem Handy** nie angesehen (nur dunkel).
5. **429-Fehler** in der Konsole auf getstackr.de (3× beim Laden der Akademie am 2026-10-11, nach vielen Reloads). Prüfen, welcher Endpunkt limitiert und ob normale Nutzer das erreichen können.
6. **Hauptordner** `Desktop\TrackYourIncome\Web 1.7`: lokaler `master` hängt hinterher, viele fremde uncommittete Änderungen (u. a. `agb.html`, `index.html`, `landing-v2.html`, Rechtsseiten), die nach #27 nicht mehr zum Stand passen. Nicht anfassen; wer dort weiterarbeitet, muss auf `origin/master` aufsetzen.

## Arbeitsweise, die sich bewährt hat

- **Eigener Worktree pro Aufgabe** auf `origin/master` (z. B. `..\wt-redesign-reste`), `node_modules` aus dem Hauptordner kopieren, sonst fallen 7 API-Tests mit `Cannot find module '@vercel/blob'`.
- **Testen hinter dem Login nur auf Produktion** (getstackr.de). Der User meldet sich im Browser-Pane an (Claude loggt nie selbst ein). Im Pane geht Handy-Emulation (`resize_window` preset mobile); Chrome-Fenster der Extension lassen sich nicht verkleinern.
- **Fallen beim Prüfen:**
  - Liegt Tab/Pane im Hintergrund, pausieren GSAP-Animationen: Zahlen bleiben auf Zwischenwerten stehen, Kacheln blass. Kein App-Fehler. `document.visibilityState` prüfen.
  - CSP blockt eingeschleuste `<style>`-Tags. CSS-Änderungen vorab simulieren mit `new CSSStyleSheet()` + `document.adoptedStyleSheets`.
  - Spätere Regeln in `css/redesign.css` überschreiben frühere Media-Query-Regeln (z. B. `.sr-document-header` Zeile ~399) – mobile Overrides hinter die Basisregel setzen.
  - Viele Dateien haben CRLF: Python-Ersetzungen mit `newline=''` und erkanntem Zeilenende.
- **Merge:** Der Auto-Mode-Klassifikator lehnt `gh pr merge` ab, wenn der User den Merge nicht ausdrücklich freigegeben hat. Vorher Review als PR-Kommentar, dann mit Freigabe mergen.
- **Commit-Autor:** git-Config steht auf `TrackYourIncome <aiprojectdj@gmail.com>` (ohne „k“). Direkt-Deploys dieses Autors blockt Vercel; über PR + Merge (Merge-Commit von `aiprojektdj-spec`) läuft der Deploy. Autorenschaft nicht ändern, ohne den User zu fragen.

## Nächste Schritte (Vorschlag)

1. Punkt 1 klären (Signalfarben).
2. Punkte 3 und 4: mobiler Durchlauf hell + dunkel über die restlichen Seiten, Fixes als ein PR.
3. Punkt 5 untersuchen.

## Nachtrag 2026-10-11 (PR #53, Branch `redesign-rest-3`)

- **Punkt 1 erledigt:** User-Entscheidung „nur Rot“. `--danger` rot (dunkel `#f87171`, hell `#c62828`), Rest neutral; Überfällig-Badge per `.is-overdue`.
- **Punkte 3 + 4 erledigt:** Mobil hell + dunkel auf Produktion per DOM-Messung geprüft – keine Überbreite, kein Kontrast < 4,5:1, kein Fix nötig.
- **Punkt 5 erledigt:** 429 kam von `/api/sync` (40/min/Nutzer). Jeder volle Seitenaufruf zog `__account` + jede Firma (8 Firmen → 9+ Aufrufe). Start-Sync wird jetzt übersprungen, wenn der letzte Lauf < 60 s her ist und lokal nichts geändert wurde.
- **Offen bleibt:** Punkt 2 (Rest-Emojis, bewusst nur einzeln mit Test) und Punkt 6 (Hinweis). PR #53 wartet auf Merge-Freigabe des Users.
