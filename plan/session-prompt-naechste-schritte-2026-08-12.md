# Session-Prompt: Nächste Schritte nach dem Vollaudit (Stand 2026-08-12)

**Arbeitsplan:** [`plan/naechste-session-2026-08-12.md`](naechste-session-2026-08-12.md)
**Arbeitsregeln + Performance-Posten:** [`plan/uebergabe-2026-08-12.md`](uebergabe-2026-08-12.md)
**Priorität:** `/compliance-legal` zuerst — der Performance-Block ist bis auf zwei Kleinigkeiten durch

---

## Copy-Paste-Prompt für die neue Session

> Lies `plan/naechste-session-2026-08-12.md` und `plan/uebergabe-2026-08-12.md`, in dieser
> Reihenfolge. Danach:
>
> 1. `git status --short` und `git log --oneline -8` ausführen. An diesem Repo arbeiten mehrere
>    Sessions **im selben Working Tree**. Jede Datei, die als geändert auftaucht, hält jemand
>    anders — nicht anfassen, sondern per `send_message` abstimmen.
> 2. Testsuite einmal durchlaufen lassen (`for f in test/*.js; do node "$f" >/dev/null || echo
>    "FAIL $f"; done`). Muss stumm sein: 28 Dateien, 327 Tests. Ist etwas rot, **zuerst das
>    klären** — nicht darauf aufbauen.
> 3. Dann das Compliance-Audit fahren: `/compliance-legal`. Begründung unten.
>
> Arbeite einen Posten vollständig ab, statt mehrere anzufangen: Fix, Test, pfad-gescoped
> committen (`git add -- <datei>`, nie `git add -A`), Fund-Datei auf erledigt setzen. Erst dann
> den nächsten.

---

## Was zuerst zu tun ist — `/compliance-legal`

**Der Performance-Block ist erledigt, während diese Datei entstand.** Beim Gegenprüfen am
2026-08-12 waren F1, F2, F3 und F7 schon gebaut: `Utils.ensureXlsx()` in `js/utils.js` holt die
929-KB-Datei erst beim ersten Excel-Im-/Export, `_ensureChartJs()` macht dasselbe für Chart.js,
`defer` sitzt an den Sub-Apps, und `_startPeriodicBackup()` räumt sein `setInterval` jetzt vorher
auf. Wer hier noch etwas sucht: **erst `git log` lesen, dann glauben.**

Offen im Performance-Block bleiben nur:

| ID | Was | Aufwand |
|---|---|---|
| F4 | `preload` für `css/style.css` und `js/app.js` — die zwei Fonts sind schon drin (`app.html:23-24`) | 2 Zeilen |
| F5 | Tabellen werden komplett per `innerHTML` neu gerendert (INP bei vielen Zeilen) | **erst messen**, dann entscheiden |
| F6 | Cloud-Sync-Krypto in einen Web Worker (`grep "Worker(" js/cloud-sync.js` → 0 Treffer) | groß, **braucht Freigabe**, s. unten |

Deshalb ist der erste substanzielle Posten ein Audit, nicht ein Fix:

```
/compliance-legal
```

Das ist das einzige der sieben nie gelaufenen Audits, dessen Gegenstand **gesetzliche Pflichten**
sind: DDG-Impressumspflicht, DSGVO, GoBD, AGB-Anforderungen, E-Rechnungs-Mandat, UStG. Alles andere
im Backlog ist Optimierung oder Produktentscheidung — das hier kann eine Lücke aufdecken, die
Geld oder Haftung kostet.

**Erwartetes Ergebnis:** eine Fund-Datei `plan/funde-audit-11-compliance-legal-2026-08-12.md` nach
dem Muster der bestehenden zehn — je Fund Datei:Zeile, Schweregrad, § und ein konkreter Fix.
Der Prompt dazu liegt fertig in `plan/session-prompt-audit-11-compliance-legal-2026-08-10.md`;
der Skill selbst ist die Audit-Definition, es braucht keinen zusätzlichen Text.

**Nicht mit dem Audit vermischen:** Anwalts-Freigabe (AGB §11, §356-Trial-Klausel) und der
Whop-DPA/AV-Vertrag sind seit Wochen offen und warten auf Dritte. Ein Compliance-Audit darf sie
benennen, aber nicht als eigene Aufgabe wieder aufmachen.

---

## Danach

Sieben der siebzehn geplanten Audits sind nie gelaufen (Abschnitt 1.1 des Arbeitsplans),
**je eine eigene Session** — zwei Audits in einem Lauf machen die Fundliste unlesbar.

```
/accessibility
```
Der letzte A11y-Lauf war am 2026-07-24 und hieß selbst „Vollaudit-Rest" — war also nie vollständig.

Nach jedem Lauf: Fund-Datei `plan/funde-audit-NN-<thema>-<datum>.md` anlegen, Status im
Masterplan auf ✅, Zeile in `funde-gesamt-2026-08-10.md` ergänzen.

---

## Was ausdrücklich NICHT ohne Rückfrage beim User passiert

Diese drei Punkte sehen nach normaler Arbeit aus, sind aber Entscheidungen:

1. **F6 — Cloud-Sync-Krypto in einen Web Worker.** Der Live-Sync-Pfad eines zahlenden Kunden, und
   ohne Whop-Login nicht E2E prüfbar. **Keinen Delta-Sync bauen** — CAS und Merge sind korrekt und
   getestet.
2. **R5 — volle Nicht-Extrahierbarkeit des Sync-Schlüssels.** Ginge nur, wenn „Code erneut
   anzeigen" wegfällt. Das ist der einzige Weg, ein zweites Gerät anzubinden, wenn der Nutzer den
   Code nie notiert hat — Sicherheitsgewinn gegen Aussperr-Risiko. Abschnitt 2 des Arbeitsplans.
3. **P2/P4/P5 und M3** — Positionierung, Preisstufen, und ob die Offline-Version überhaupt noch
   beworben wird (sie wird seit 2026-08-11 nicht mehr gepflegt). **M2 braucht echte
   Kundenstimmen** — nichts erfinden, auch nicht „anonymisiert".

---

## Fallen, die in diesem Repo wiederholt Zeit gekostet haben

- **Mehrere Sessions, ein Working Tree.** `git status` **erneut** prüfen, unmittelbar bevor du
  committest. Pfad-gescoped committen. Am 2026-08-12 sind zweimal fremde Änderungen in Commits
  gelandet, weil das nicht gemacht wurde.
- **Module, die nach Optik aussehen, tragen Steuer- und GoBD-Logik.** `js/steuertermine.js`,
  `js/ausgaben.js`, `lager/page.js`, `rechnungen/js/dokumente.js`. Die Tabelle in Abschnitt 4 des
  Arbeitsplans sagt, welcher Test welche Datei schützt — vor jedem Sweep den passenden laufen
  lassen, das kostet unter einer Sekunde.
- **Verifikation hinter dem Whop-Gate.** Claude loggt sich nicht selbst ein. Für UI-Prüfungen die
  Modul-Renderer direkt aufrufen (`App.showSettingsModal()`, `Retouren.render()` …) und in
  `#mainContent` hängen. Braucht ein Test einen echten Login, macht der User ihn einmal im
  Browser-Pane.
- **Encoding:** UTF-8 ohne BOM. Nie über eine PowerShell-Textpipeline schreiben
  (`Set-Content`/`Out-File`) — das zerschießt Umlaute. Edit/Write oder Python mit
  `encoding='utf-8', newline=''`.
- **`plan/OFFEN.md` und `plan/PLAN.md` nicht als Arbeitsliste nehmen.** Beide führen Erledigtes
  ohne Markierung. Im Zweifel gegen den Code prüfen.

---

## Nach Abschluss

1. Erledigte Funde in der jeweiligen `funde-audit-*.md` markieren — sonst arbeitet die nächste
   Session sie nach. Das ist in diesem Repo schon passiert.
2. `plan/naechste-session-2026-08-12.md` fortschreiben: Abschnitt 3 (Reihenfolge) abhaken,
   Testzahl aktualisieren, wenn neue Harnesses dazukommen.
3. Zwei Termine im Blick behalten: **2026-12-01** läuft der AAD-Fallback in `js/cloud-sync.js` ab
   und ist dann ersatzlos zu entfernen; zum **Jahreswechsel 2027/2028** muss in
   `Ausgaben._getKsaWerte()` der neue KSA-Abgabesatz ergänzt werden.
