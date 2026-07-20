# Session-Prompt — P2-1: Local 1.7 spiegeln + Git reparieren

---

Kontext: Stackr = 2 Varianten, selber Eltern-Ordner. `Web 1.7/` (dies Repo,
live Vercel, kein CH/AT seit 2026-07-16). `Local 1.7/` (Desktop-Variante,
behält CH/AT, siehe Memory `schweiz-modul.md`). `Local 1.7/` Git verwaist:
letzter Commit `6975e9b` (Local-1.6-Ära). Seitdem nur Working-Copy-Arbeit.
Stand 2026-07-16: 70 uncommittete Änderungen (22 neu, 10 gelöscht, 38
modifiziert) gg. altem HEAD.

Kein normaler Feature-Task — Repo-Hygiene, echtes Datenverlust-Risiko.
Vorsicht.

## 1. Erst verstehen, nichts anfassen

- `cd "../Local 1.7"`, `git log --oneline -20`, `git status --short` ganz
  durchgehen (nicht nur Anfang).
- 10 gelöschte Dateien prüfen: Absicht oder Versehen? `ANLEITUNG.html`,
  `datenschutz.html`, `impressum.html` erscheinen gelöscht — letzte zwei
  extra scharf checken (Pflichttexte, dürfen nicht versehentlich fehlen).
- Große Diffs überfliegen (`css/style.css`, `js/app.js`, `index.html`):
  UI-Redesign ("Linear Midnight Command Deck", Emoji→Tabler-Icons) oder
  Feature-Arbeit?
- `git fsck` — verwaist könnte auch `.git`-Zustand selbst kaputt heißen,
  nicht nur alte Historie.

## 2. Mit User klären VOR Commit

Rückfrage-Pflicht, kein Alleingang:
- 70 Änderungen: 1 Commit oder mehrere sinnvoll aufgeteilt (UI-Redesign
  getrennt von Bugfixes)?
- 10 Löschungen: Bestätigung vor `git add -A` (sonst endgültig).
- Remote vorhanden (`git remote -v`)? Falls nicht: Dateisystem-Backup
  vorschlagen vor jeder history-verändernden Git-Operation.

## 3. Nach Klärung: Web → Local Abgleich

Ziel (`plan/offene-punkte-2026-07-15.md`): Web-Fixes nachziehen, die auch
für Local gelten sollen — NICHT CH/AT-Entfernung (Web-only, Memory
`ch-at-removal-web.md`; Local behält `js/schweiz.js`/`js/oesterreich.js`,
aktiv per `<script defer>` in `Local 1.7/app.html`).

Gegen AKTUELLEN Local-Stand prüfen, nicht blind kopieren (eigene, teils
ältere Codepfade):
- USt-Regelbesteuerung-Fixes (§17-Gutschriften, `calcBrutto`-Historisierung,
  Vorsteuer-Doppelabzug-Label) — Memory `ust-regelbesteuerung-fixes.md`:
  "Local-Spiegelung aussteht".
- GoBD Edit/Delete-Rework — laut Memory `gobd-edit-delete-rework.md` schon
  2026-07-12 in Local verifiziert, nur gegenchecken ob Web seitdem was
  draufkam.
- Whop-Gate Signed Grace-Token (ECDSA statt Timestamp) — falls Local
  eigenen Whop-Auth-Pfad hat, DevTools-Bypass dort prüfen.
- Datum-Handling (`toLocaleDateString('sv-SE')` statt `toISOString`) — laut
  Memory `datum-lokal-sv-se.md` schon 2026-07-09 gespiegelt, nur
  verifizieren dass 70 uncommittete Änderungen es nicht wieder gekippt
  haben.

## Abschluss

- Erst nach Rückfrage + Bestätigung committen.
- Klarer `git log`, sinnvolle Messages — kein Sammel-Commit ohne
  Beschreibung.
- Memory `csp-haertung-fortschritt.md` + `datum-lokal-sv-se.md` danach
  aktualisieren.
- Ergebnis in `plan/offene-punkte-2026-07-15.md` unter P2-1 nachtragen.
- Nicht deployen — `Local 1.7/` ist Desktop-lokal, keine Vercel-Variante.

---

**Modell: Opus 4.8.** Grund: hohes Stille-Datenverlust-Risiko
(uncommittete Löschungen, unklarer Git-Zustand, 2 parallele Repos mit
bewusst unterschiedlichem Feature-Set) — braucht sorgfältiges Abwägen vor
jeder Git-Operation, nicht nur Pattern-Matching gg. Web 1.7.
