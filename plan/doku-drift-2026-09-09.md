# Doku-Drift — wo die Dokumentation dem Code hinterherhinkt

**Stand: 2026-09-09.** Jede Zeile hier ist gegen den Code gemessen, nicht gegen eine andere
Plandatei. Entstanden aus einem Einzelfund: `alert-webhook-anleitung.md` nannte 13 Alarm-Paare in
fünf Endpunkten, der Code sendete 17 aus sechs (korrigiert in `5bb6400`). Die Frage war, ob das
ein Einzelfall war. War es nicht.

## Welche Dateien hier zählen — und welche nicht

Zwei Sorten Doku, und nur bei einer ist Drift ein Problem:

- **Lebende Doku** — `CLAUDE.md`, `plan/00-STAND.md`, `01-AUFGABEN.md`, `02-ENTSCHEIDUNGEN.md`,
  `03-ARBEITSREGELN.md`, `live-tests-checkliste.md`. Die liest man **am Sessionanfang, um zu
  wissen, woran man ist**. Steht da eine falsche Zahl, arbeitet man auf falscher Grundlage weiter.
  Nur diese sind hier geprüft.
- **Datierte Fund- und Audit-Dateien** — die 60+ `funde-*.md`, `audit-*.md` und
  `*-2026-08-*.md`. Das sind **Momentaufnahmen mit Datum im Namen**. Dass deren Zahlen heute nicht
  mehr stimmen, ist kein Fehler, sondern ihr Zweck: sie halten fest, wie es damals aussah.
  Die repariert man nicht.

Diese Trennung ist der eigentliche Punkt. „Die Doku ist veraltet" ist bei 75 Plandateien keine
brauchbare Aussage; bei sechs lebenden Dateien ist sie behebbar.

---

## Befunde

| # | Was dasteht | Was der Code sagt | Wo |
|---|---|---|---|
| 1 | 5 Serverless-Endpunkte | **6** | `CLAUDE.md:4`, `plan/00-STAND.md:43`, `plan/live-tests-checkliste.md:41` |
| 2 | 32 Node-Harnesses | **50** | `CLAUDE.md:52`, `plan/00-STAND.md:44`, `plan/00-STAND.md:121` |
| 3 | `js/app.js:1061` | **`js/app.js:1099`** | `CLAUDE.md:42`, `plan/03-ARBEITSREGELN.md:172` |
| 4 | Neun Alarm-Stellen in vier Endpunkten | **19 in sechs** | `plan/02-ENTSCHEIDUNGEN.md:68` |
| 5 | „die jetzigen ~1,8 MB" Anwendungscode | **2,32 MB** (nur `js/`) bis **2,96 MB** (mit Sub-Apps) | `plan/02-ENTSCHEIDUNGEN.md:56` |

So nachgemessen:

```bash
ls api/*.js | grep -v '/_' | wc -l          # 6 — _alert.js ist Helfer, kein Endpunkt
ls test/*.js | wc -l                        # 50
grep -n "_getUstGrenzen" js/app.js          # 1099
grep -rn "alertOps('" api/*.js | wc -l      # 19
find js -name '*.js' | grep -v vendor | xargs wc -c | tail -1   # 2320171
```

### Befund 5 ist kein Zahlendreher, sondern eine gerissene Entscheidungsschwelle

Die anderen vier sind Kosmetik: man verzählt sich, niemand trifft deswegen eine falsche
Entscheidung. Befund 5 ist anders. Der Satz in `02-ENTSCHEIDUNGEN.md` lautet sinngemäß, dass die
Entscheidung *kein Build-Schritt* dann neu zu prüfen wäre, wenn der Anwendungscode **deutlich über
die jetzigen ~1,8 MB** wächst.

Genau das ist passiert, und zwar unter **jeder** Lesart der Zahl: 2,32 MB, wenn man nur `js/` ohne
Vendor-Bibliotheken zählt (+29 %), 2,96 MB mit den drei Sub-Apps (+65 %). Die Schwelle, an der man
laut eigener Festlegung noch einmal hinschauen wollte, ist also still überschritten worden — der
Auslöser hat niemanden erreicht, weil ihn niemand nachgemessen hat.

Das heißt **nicht**, dass jetzt ein Build-Schritt her muss. Die Begründungen gegen ihn (der
ausgelieferte Code *ist* der geschriebene, keine Lieferketten-Fläche, keine Build-Fäulnis) hängen
nicht an der Dateigröße und tragen unverändert. Es heißt nur: die Frage ist laut eigenem Maßstab
fällig, und die Antwort sollte bewusst fallen statt durch Nichtbeachtung.

---

## Was ich nicht geändert habe, und warum

**Nichts davon ist repariert.** Zwei Gründe:

- `CLAUDE.md` sind die eingecheckten Projektanweisungen. Was dort steht, ist eine Ansage des
  Betreibers an alle Sessions — das ändert man nicht nebenbei im Rahmen einer anderen Aufgabe.
- `plan/02-ENTSCHEIDUNGEN.md` hielt zum Prüfzeitpunkt eine **parallele Session** (uncommitted in
  `git status`). Die Zeilennummern 56 und 68 können sich dadurch verschoben haben; die Textstellen
  findet man über `grep -n "1,8 MB"` bzw. `grep -n "Neun Stellen"`.

Befund 1–3 sind je ein Einzeiler. Befund 4 ebenso, sobald die Datei wieder frei ist. Befund 5
ist keine Textänderung, sondern eine Entscheidung.

## Wie man das künftig billig hält

Die fünf Befehle oben dauern zusammen keine zwei Sekunden. Sie taugen als Sessionanfangs-Griff für
den, der ohnehin schon `git status && git log` tippt — und sie sind der einzige Weg, der nicht
selbst wieder veraltet, weil er nichts behauptet, sondern misst.
