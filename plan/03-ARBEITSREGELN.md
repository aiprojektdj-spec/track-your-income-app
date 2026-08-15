# Arbeitsregeln in diesem Repo

**Stand: 2026-08-15.** Einstieg: [`00-STAND.md`](00-STAND.md)

Diese Regeln stehen hier, weil ihre Verletzung in diesem Projekt nachweislich Zeit gekostet hat.
Jede hat einen konkreten Vorfall als Ursache.

Die Kurzfassung steht in [`../CLAUDE.md`](../CLAUDE.md) und wird in **jeder** Session automatisch
geladen. Diese Datei ist die Langfassung mit den Vorfällen dahinter — wer eine Regel ändert,
ändert beide.

---

## Checkliste vor jedem Commit

```bash
git status --short                                    # hält jemand anders meine Dateien?
for f in test/*.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done   # bei Rechenlogik
git commit -F <nachricht> -- <datei> [<datei> …]      # Pathspec, nicht nur beim add
```

**Der Pathspec gehört an den `commit`, nicht nur an das `add`.** `git commit` ohne Pathspec
committet den **gesamten Index** — auch das, was eine andere Session zwischen deinem `git add`
und deinem `git commit` hineingelegt hat. Das sind Sekunden, und sie reichen: am 2026-08-15 hat
ein so gebauter Commit 27 statt 4 Dateien erfasst und die fremde D1-Arbeit (`js/vendor/`,
`css/vendor/`, `vercel.json`, `.gitattributes`) mitgenommen.

**Wenn es doch passiert:** solange nicht gepusht, `git reset --soft HEAD~1` und danach mit
Pathspec neu committen — ein Pathspec-Commit lässt den übrigen Index stehen, die fremde Arbeit
bleibt also genau so vorgemerkt, wie die andere Session sie hinterlassen hat.

- [ ] Nur eigene Dateien im Commit — `git diff --cached --stat` gegengelesen
- [ ] Erledigte Aufgabe **im selben Commit** in [`01-AUFGABEN.md`](01-AUFGABEN.md) abgehakt
- [ ] Wenn beim Bauen etwas anders war als in der Aufgabe beschrieben: **Korrektur in die Liste**,
      nicht nur in die Commit-Message
- [ ] Commit-Message deutsch, **ohne Umlaute** (ae/oe/ue/ss)

---

## 1. Parallele Sessions sind der Normalfall

Am 2026-08-11/12 liefen bis zu **fünf Sessions gleichzeitig** im selben Verzeichnis.

**Regeln:**

- **`git status` erneut prüfen, unmittelbar bevor du committest** — nicht nur beim Sessionstart.
- **Immer pfad-gescoped committen:** `git add -- <datei>`, **nie** `git add -A`. Sonst nimmst du
  fremde Arbeit mit. Das ist am 2026-08-12 **zweimal** passiert: Teile einer Härtungsarbeit
  landeten in `365d930` und `7c07104`, weil andere Sessions die Dateien mitcommittet haben.
  **Der Pathspec muss auch an den `commit`** — `git add -- <datei>` allein schützt nicht, siehe
  Checkliste oben.
- **Uncommittete Arbeit bleibt hier nicht lange liegen.** Wer fertig ist, committet sofort.
- **Wenn du eine Datei brauchst, die jemand anders hält:** per `send_message` abstimmen, nicht
  überschreiben.
- **Urheberschaft belegen, nicht raten.** `search_session_transcripts` nach Dateiname plus
  mtime-Abgleich gegen `lastActivityAt`. **Achtung:** `lastActivityAt` ist UTC, mtimes sind
  lokal, CEST = UTC+2. Eine Session hat schon einmal eine fremde Änderung falsch zugeordnet
  und daraus einen falschen Fund gebaut.

**Der häufigste Fehler:** Ein Audit meldet einen Fund, der zwischenzeitlich längst gefixt wurde.
**Immer gegen den Code prüfen, nie gegen ältere Plandateien** — auch nicht gegen diese hier.

---

## 2. Plandateien verhalten sich wie Code

Sie sind die einzige Abstimmung zwischen Sessions, die den Sessionwechsel überlebt. Deshalb
gelten dieselben Regeln.

- **Plandateien mitcommitten, nicht liegen lassen.** Eine uncommittete Datei taucht in
  `git log` nicht auf — die nächste Session weiß nichts von ihr. Am 2026-08-14 lagen die vier
  neuen Übersichtsdateien (`00`–`03`) untracked im Working Tree, während parallel gegen die
  committete Vorgängerliste gearbeitet wurde.
- **Eine Aufgabenliste, nicht zwei.** Genau daraus entstand die Doppelung
  `restliste-2026-08-14.md` ↔ `01-AUFGABEN.md`: dieselben Funde, zwei Stände, einer davon schon
  am Folgetag falsch (A2, A4, A5, V2, L3, N3, D4 waren in `6103208` erledigt, F2 als
  `Utils.ensureXlsx()` gebaut — die zweite Liste führte alle acht weiter als offen).
  Wird eine Liste abgelöst, bekommt sie in Zeile 1 **abgelöst durch `<datei>`** und verschwindet
  aus der Tabelle in [`00-STAND.md`](00-STAND.md).
- **Abhaken gehört in den Commit, der fixt.** Sonst ist die Liste zwischen zwei Commits falsch,
  und genau in dem Fenster liest sie jemand.
- **Ein Datum im Kopf jeder Plandatei**, und darunter, wogegen der Stand geprüft wurde
  („gegen den Code", nicht „aus der Vorgängerdatei übernommen").

---

## 3. Die Browser-Cache-Falle

`python -m http.server` schickt keine No-Cache-Header, und der Cache hängt am **Origin**.

`location.reload()`, eine Cache-Bust-Query **und ein neuer Tab** liefern trotzdem alten Code. Man
verifiziert dann den Vorher-Zustand und hält einen ungefixten Bug für gefixt.

**Einzig zuverlässig: ein neuer Port.** Keine feste Zahl merken — den höchsten Port aus
`.claude/launch.json` nehmen und **+1**:

```bash
grep -o '"port": [0-9]*' .claude/launch.json | grep -o '[0-9]*' | sort -n | tail -1
```

`eval` zum Nachladen scheitert an der CSP. Für reine Rechenlogik ist ein **Node-`vm`-Harness**
schneller und cache-immun — `test/` enthält aktuell 32 davon als Vorlage:

```bash
for f in test/*.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done
```

---

## 4. Verifikation hinter dem Whop-Gate

Das Gate rendert den Seiteninhalt nicht ohne Login. Man kommt trotzdem an die Formulare, indem
man die Modul-Renderer direkt aufruft und das Ergebnis in `#mainContent` hängt:

```javascript
App.showSettingsModal();
Retouren.render();
Fahrtenbuch._renderForm(); Fahrtenbuch._bindForm();
```

**Toasts rendern verzögert** — nicht im DOM danach suchen, sondern `Utils.showToast` kurz
instrumentieren und die Aufrufe mitschneiden.

**Claude loggt sich nicht selbst bei Whop ein.** Wenn ein Test einen echten Login braucht, meldet
sich der User einmal im Browser-Pane an; die Session bleibt danach erhalten. Ein Dev-Bypass im
Code ist ausdrücklich **nicht** gewünscht.

---

## 5. Encoding

Das Repo ist **UTF-8 ohne BOM**.

**Dateien nie über eine PowerShell-Textpipeline schreiben** (`Set-Content`, `Out-File`) — das
zerschießt die Umlaute. Stattdessen die Edit/Write-Werkzeuge oder Python mit
`encoding='utf-8', newline=''`.

**Commit-Messages umgekehrt: ohne Umlaute** — `ae`/`oe`/`ue`/`ss`, so wie das gesamte bisherige
Log. Die Messages laufen durch die Shell, nicht durch die Schreibwerkzeuge.

Verwandt: `.gitattributes` enthält `js/vendor/*.js -text`. Ohne das hätte `core.autocrlf=true`
die in `js/vendor/VERSIONS.md` dokumentierten SHA-256-Hashes beim Checkout zerstört.

---

## 6. Abhängigkeiten

**SheetJS ist nur über `cdn.sheetjs.com` beziehbar.** Ein `npm install xlsx` holt gezielt die
verwundbare **0.18.5** zurück (CVE-2023-30533 Prototype Pollution, CVE-2024-22363 ReDoS) — das
npm-Paket ist dort eingefroren und unmaintained. Aktuell liegt **0.20.3** lokal in `js/vendor/`
mit SHA-256 in `js/vendor/VERSIONS.md`.

Es gibt **genau eine produktive Abhängigkeit** (`@vercel/blob`, für `api/`) und keinen
Build-Schritt. Eine zweite kommt nicht ohne Rückfrage dazu.

Beim Hinzufügen einer CDN-Ressource: **SRI-Hash und `crossorigin` sind Pflicht**, und die
CSP in `vercel.json` muss den Host kennen. Die CSP steht dort **pro Route**, nie global —
Browser schneiden mehrere CSP-Header, ein globaler würde die spezifischen aushebeln.

---

## 7. Gesetzeswerte gehören in eine Jahresfunktion

**Nicht so:**
```javascript
_KSA_SATZ: 0.049,   // 2026
```
Das war ein echter Fund (T1): ab 1.1.2027 hätte Stackr still zu niedrig gerechnet, und
2025er-Daten wurden schon vorher falsch bewertet.

**Sondern so** — das Muster steht als `App._getUstGrenzen(year)` in
[`js/app.js:1061`](../js/app.js), gefixt in [`js/ausgaben.js:37`](../js/ausgaben.js):
```javascript
_getKsaWerte(year) {
    if (year >= 2027) return { satz: 0.050, bagatelle: 1000 };
    if (year >= 2026) return { satz: 0.049, bagatelle: 1000 };
    return              { satz: 0.050, bagatelle: 700  };
}
```

**Regel:** Überall dort, wo ein Steuersatz, eine Grenze oder eine Frist steht, muss das Jahr ein
Parameter sein — auch wenn heute nur ein Wert existiert. Und der **künftig bekannte Wert wird
gleich mit eingetragen**, statt zum Jahreswechsel zu kippen.

---

## 8. Vier Muster, die in diesem Projekt wiederholt auftraten

Aus dem Vollaudit 2026-08 destilliert. Wer neu prüft, findet damit schneller etwas:

**1. Fehlende Obergrenzen, nicht fehlende Prüfungen.**
Die Berechtigung wird korrekt geprüft, aber niemand zählt mit — unbegrenzte Scopes, unbegrenzte
Blob-Uploads, unbegrenzte StB-Grants. Alles derselbe Typ, ein gemeinsamer Redis-Zähler löst es.

**2. Jahresfeste Konstanten für Werte, die sich ändern.** Siehe Abschnitt 7.

**3. Import ist großzügiger als Export.**
Beim Erzeugen wird streng validiert, beim Einlesen nicht — oder zu spät. Fälle: Backup-Restore
schrieb ungefilterte localStorage-Keys; die §14-Prüfung lief erst beim Speichern statt beim
Öffnen des Formulars.

**4. Gebaut, aber nicht angeschlossen.**
Die schwierige Hälfte ist fertig, die einfache fehlt — und das sind jedes Mal die billigsten
Fixes. Beispiele: die Leitweg-ID wurde korrekt ins XML geschrieben, hatte aber kein
Eingabefeld · der Bank-Parser las Einnahmen und warf sie weg · `.action-btn` wurde 34× gesetzt
und nie gestylt · der Server erkannte `status === 'trialing'` und verwarf es · `manifest.json`
lag fertig im Repo, war aber in 0 von 4 Seiten verlinkt.

**Beim Prüfen lohnt gezielt die Frage:** *Wo ist etwas zu 90 % fertig und scheitert am letzten
Handgriff?*

---

## 9. Wenn ein Audit läuft

- **Skill-Vorlagen sind teilweise veraltet.** Mehrere Skills beschreiben einen Stand von vor der
  Whop-Migration oder vor der Local-Einstellung. Der IST-Stand kommt **aus dem Code**, nicht aus
  der Vorlage. Im Bericht die Korrektur ausdrücklich benennen.
- **Gesetzesstände recherchieren, nicht aus dem Gedächtnis schreiben.** Sätze, Grenzen und
  Fristen ändern sich jährlich.
- **Kontraste berechnen, nicht schätzen.** Die WCAG-Luminanzformel ist ein Dreizeiler. Und den
  vorgeschlagenen Wert **nachrechnen, bevor er in die Aufgabenliste kommt** — der A2-Vorschlag
  `#4a5651` kam auf 2,5:1 und hätte den Verstoß nicht behoben.
- **Vor dem Melden gegenprüfen, ob es ein Fehlalarm ist.** In dieser Runde wären sonst mehrere
  falsche Funde entstanden: hartkodierte Hex-Farben (überwiegend legitim), `outline: none`
  (alle drei hatten Ersatz), undefinierte CSS-Klassen (die meisten waren JS-Hooks oder in
  injiziertem CSS definiert).
- **Ergebnisse gehören in [`01-AUFGABEN.md`](01-AUFGABEN.md)**, bewusste Nicht-Fixes in
  [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md).

---

## 10. Wie diese Datei gepflegt wird

**Hier rein gehört nur, was einen Vorfall hat.** Eine Regel ohne konkreten Schaden ist eine
Meinung und macht die Datei länger, ohne sie nützlicher zu machen.

**Was hier nicht reingehört:** offene Aufgaben (→ `01-AUFGABEN.md`), Begründungen für
Nicht-Fixes (→ `02-ENTSCHEIDUNGEN.md`), Projektstand (→ `00-STAND.md`).

**Regeln so formulieren, dass sie nicht veralten.** Keine Portnummern, keine Dateizeilen ohne
Symbolnamen, keine Zählstände ohne „aktuell". Was sich ändert, wird als Kommando notiert, das den
aktuellen Wert ermittelt.

**Was der Harness erzwingen kann, gehört nicht in Prosa.** `git add -A` ist über eine
Deny-Regel in `.claude/settings.json` gesperrt — die Regel in Abschnitt 1 bleibt trotzdem stehen,
weil sie erklärt, *warum* der Block da ist.
