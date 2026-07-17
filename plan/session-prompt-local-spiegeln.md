# Prompt für neue Session (copy-paste) — P2-1: Local 1.7 spiegeln + Git reparieren

---

Kontext: Stackr existiert in zwei Varianten im selben Eltern-Ordner: `Web 1.7/`
(dieses Repo, das live über Vercel deployte Produkt, kein CH/AT mehr seit 2026-07-16)
und `Local 1.7/` (parallele Desktop-Variante, behält CH/AT bewusst, siehe Memory
`schweiz-modul.md`). `Local 1.7/` hat ein **verwaistes Git**: der letzte echte Commit
(`6975e9b "Fix: GbR von Lager-Seite erreichbar + Sidebar Emoji-Cleanup (Local 1.6)"`)
ist aus der "Local 1.6"-Ära, seitdem wurde nur noch direkt auf der Working Copy
gearbeitet. Aktueller Stand (diese Recherche, 2026-07-16): **70 uncommittete Änderungen**
(22 neue Dateien, 10 gelöschte, 38 modifizierte) gegenüber diesem alten HEAD.

WICHTIG — das hier ist KEIN normaler Feature-Task, sondern Repo-Hygiene mit echtem
Datenverlust-Risiko. Sehr vorsichtig vorgehen:

## 1. Erstmal NUR verstehen, nichts anfassen

- `cd "../Local 1.7"` (relativ zu `Web 1.7/`), `git log --oneline -20`,
  `git status --short` vollständig durchgehen (nicht nur die ersten Zeilen).
- Die 10 gelöschten Dateien (`D` im Status) genau prüfen: sind das absichtliche
  Aufräum-Löschungen aus einer früheren Session, oder könnten das versehentliche
  Verluste sein? Beispiel aus dieser Recherche: `ANLEITUNG.html`, `datenschutz.html`,
  `impressum.html` erscheinen als gelöscht — bei `datenschutz.html`/`impressum.html`
  besonders genau hinschauen (rechtlich pflichtig, darf nicht versehentlich fehlen).
- Diff der großen Brocken (`css/style.css`, `js/app.js`, `index.html` erscheinen laut
  `git status` verändert) grob überfliegen: sind das UI-Redesign-Änderungen (siehe
  Commit-Historie: "Linear Midnight Command Deck", "Entferne Emojis — Tabler Icons")
  oder Feature-Arbeit?
- Prüfen ob `Local 1.7/.git` überhaupt noch ein sauberes Repo ist (`git fsck`) — bei
  "verwaist" könnte auch was am `.git`-Zustand selbst kaputt sein, nicht nur die
  Historie veraltet.

## 2. Mit dem User klären, BEVOR committet wird

Das ist ein Fall für Rückfrage, kein Alleingang:
- Sollen die 70 uncommitteten Änderungen als EIN Commit auf den alten HEAD drauf, oder
  in mehrere sinnvolle Commits aufgeteilt werden (z. B. UI-Redesign getrennt von
  Bugfixes)?
- Die 10 gelöschten Dateien — wirklich löschen bestätigen, bevor `git add -A` das
  endgültig macht.
- Gibt es einen Remote für `Local 1.7/` (`git remote -v` prüfen) oder ist das ein reines
  lokales Repo ohne Backup? Falls kein Remote: vor größeren Operationen ein
  Dateisystem-Backup des ganzen Ordners vorschlagen, bevor irgendwas mit `git`
  angefasst wird, das Verlauf umschreiben könnte.

## 3. Nach Klärung: Spiegel-Abgleich Web → Local

Ziel laut `plan/offene-punkte-2026-07-15.md`: die in `Web 1.7/` gefixten/geänderten
Dinge, die auch in `Local 1.7/` gelten sollen, nachziehen — NICHT die CH/AT-Entfernung
(die bleibt Web-only, siehe Memory `ch-at-removal-web.md` — Local behält
`js/schweiz.js`/`js/oesterreich.js` aktiv, verifiziert: beide sind in `Local 1.7/app.html`
per `<script defer>` eingebunden).

Was laut Memory in den letzten Wochen in `Web 1.7/` gefixt wurde und geprüft werden
sollte, ob es in `Local 1.7/` fehlt (jeweils gegen den AKTUELLEN Local-Stand prüfen,
nicht blind kopieren — Local hat eigene, teils ältere/andere Codepfade):
- USt-Regelbesteuerung-Fixes (§17-Gutschriften, `calcBrutto`-Historisierung,
  Vorsteuer-Doppelabzug-Label) — Memory `ust-regelbesteuerung-fixes.md` sagt explizit
  "Local-Spiegelung aussteht".
- GoBD Edit/Delete-Rework — laut Memory `gobd-edit-delete-rework.md` bereits
  2026-07-12 in Local verifiziert, hier nur gegenchecken ob seitdem in Web nochmal was
  dazukam.
- Whop-Gate Signed Grace-Token (ECDSA statt Plain-Timestamp) — falls Local 1.7 einen
  eigenen Whop-Auth-Pfad hat, prüfen ob der DevTools-Bypass dort auch besteht.
- Datum-Handling (`toLocaleDateString('sv-SE')` statt `toISOString`) — laut Memory
  `datum-lokal-sv-se.md` schon 2026-07-09 gespiegelt, nur verifizieren dass es nicht
  durch die 70 uncommitteten Änderungen wieder verloren ging.

## Abschluss

- Erst nach Rückfrage + Bestätigung committen.
- Danach klaren `git log` mit sinnvollen Commit-Messages hinterlassen — kein
  Sammel-Commit ohne Beschreibung, damit das Repo beim nächsten Mal nicht wieder
  "verwaist" wirkt.
- Memory `csp-haertung-fortschritt.md` (nennt "Local-Git verwaist, Parallel-Session-
  Risiko im Ordner") und `datum-lokal-sv-se.md` nach Abschluss aktualisieren.
- Ergebnis in `plan/offene-punkte-2026-07-15.md` unter P2-1 nachtragen.
- Nicht deployen — `Local 1.7/` ist ohnehin keine Vercel-Deploy-Variante (Desktop-lokal).

---

**Modell-Empfehlung: Opus 4.8.** Grund: hohes Risiko für stillen Datenverlust
(uncommittete Löschungen, unklarer Git-Zustand, zwei parallele Repos mit bewusst
unterschiedlichem Feature-Set) — braucht sorgfältiges Abwägen vor jeder git-Operation,
nicht nur Pattern-Matching gegen Web 1.7.
