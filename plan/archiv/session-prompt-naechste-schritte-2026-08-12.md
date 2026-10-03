# Session-Prompt: Nächste Schritte nach dem Vollaudit (Stand 2026-08-12, 15:10)

**Arbeitsplan:** [`plan/naechste-session-2026-08-12.md`](naechste-session-2026-08-12.md)
**Arbeitsregeln + Performance-Posten:** [`plan/uebergabe-2026-08-12.md`](uebergabe-2026-08-12.md)
**Fundliste des ersten Postens:** [`plan/funde-audit-11-compliance-legal-2026-08-10.md`](funde-audit-11-compliance-legal-2026-08-10.md)
**Priorität:** L1 + L3 aus dem Compliance-Lauf — der einzige offene 🔴-Fund mit „vor Launch"

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
> 3. Dann **L1 + L3** aus `plan/funde-audit-11-compliance-legal-2026-08-10.md` umsetzen:
>    die beiden In-App-AGB-Modale auf eine Kurzfassung mit Link auf `agb.html` reduzieren und
>    `agb.html` in die vier App-Footer aufnehmen. Akzeptanzkriterien unten.
>
> Arbeite einen Posten vollständig ab, statt mehrere anzufangen: Fix, Verifikation, pfad-gescoped
> committen (`git add -- <datei>`, nie `git add -A`), Fund-Datei auf erledigt setzen. Erst dann
> den nächsten.

---

## Was zuerst zu tun ist — L1 + L3 (In-App-AGB)

**Zwei Blöcke haben sich erledigt, während diese Datei entstand.** Der Performance-Block ist bis
auf drei Posten durch (F1, F2, F3, F7 gebaut in `94034de`/`27f7cd6`), und **`/compliance-legal`
ist gelaufen** — die Funde L1–L6 liegen fertig vor. Wer hier noch ein Audit starten will: **erst
`git log` und `plan/audit-2026-08-10-masterplan.md` lesen, dann glauben.**

Der erste substanzielle Posten ist deshalb ein Fix, kein Audit.

**Der Befund (L1).** In der App laufen zwei verschiedene AGB-Fassungen nebeneinander:
`agb.html` hat 11 Paragraphen inklusive Widerrufsrecht (§356a BGB), Preisen und Whop als Merchant
of Record — die Modale in [`js/app.js:927`](../js/app.js) und
[`rechnungen/js/app.js:227`](../rechnungen/js/app.js) zeigen eine **8-Paragraphen-Fassung aus der
Zeit vor der Whop-Migration**: kein Widerruf, keine Preise, Whop kommt nicht vor. Das Modal
erscheint **nach** dem Vertragsschluss (der beim Whop-Checkout zustande kommt) und blockiert bei
Ablehnung die Nutzung. Folge: keine wirksame Einbeziehung nach §305 Abs. 2 BGB, und die
Unklarheitenregel §305c Abs. 2 BGB entwertet ausgerechnet den **Haftungsausschluss**, der der
ganze Zweck des Modals ist.

**Der Fix.** Das Modal soll die AGB nicht *ersetzen*, sondern *anzeigen*: Kurzfassung mit den drei
wirklich relevanten Punkten (kein steuerlicher Rat · Nutzung auf eigene Gefahr · Datensicherung
liegt beim Nutzer) plus Link auf `agb.html`. Dazu L3: `agb.html` in die Footer-Zeile der vier
App-Seiten, dieselbe Zeile, in der Impressum und Datenschutz schon stehen (§312i Abs. 1 Nr. 4 BGB
verlangt abrufbare Vertragsbedingungen).

### Akzeptanzkriterien

- [ ] `grep -c "§" js/app.js rechnungen/js/app.js` zeigt keine zweite Vollfassung mehr — der
      Modaltext besteht aus den drei Kurzpunkten und einem Link auf `agb.html`.
- [ ] Beide Modale (`js/app.js` und `rechnungen/js/app.js`) tragen **denselben** Text. Sie teilen
      sich einen Zustimmungs-Flag; abweichende Texte sind genau der Fehler, der zu L1 geführt hat.
- [ ] Der Link auf `agb.html` öffnet in einem neuen Tab und trägt `rel="noopener"` — die
      restlichen externen Links im Projekt tun das auch.
- [ ] `agb.html` ist im Footer von `app.html`, `lager/index.html`, `rechnungen/index.html` und
      `eigenbelege/index.html` verlinkt, mit korrekt relativem Pfad (`agb.html` bzw. `../agb.html`).
- [ ] Der Ablehnen-Pfad funktioniert unverändert weiter, aber die Kurzfassung behauptet nicht
      mehr, ein vollständiges Klauselwerk zu sein.
- [ ] Verifikation im Browser-Pane, **nicht** per Testsuite — für `js/app.js` und
      `rechnungen/js/app.js` gibt es keinen Harness. Modal direkt aufrufen
      (`localStorage.removeItem('agb_accepted')`, dann Reload) und beide Sub-Apps ansehen.
- [ ] Testsuite trotzdem einmal komplett: 28 Dateien stumm.
- [ ] L1 und L3 in `plan/funde-audit-11-compliance-legal-2026-08-10.md` **und** in
      `plan/OFFEN.md` §2.10 auf erledigt gesetzt.
- [ ] Pfad-gescoped committet.

### Eine Kollision, die du vorher prüfen musst

L3 fasst `app.html`, `rechnungen/index.html`, `eigenbelege/index.html` an — **alle drei hielt am
2026-08-12 um 15:10 eine andere Session** (Cookie-Banner-CSS-Auslagerung nach
`css/cookie-banner.css`). Dasselbe gilt für `js/cookie-banner.js`, das L4 bräuchte. Wenn
`git status` diese Dateien noch als geändert zeigt: **mit L1 und L2 anfangen** (`js/app.js`,
`rechnungen/js/app.js` sind frei), L3/L4 nachziehen, sobald der Tree sauber ist.

**Nicht mit dem Fix vermischen:** L5 (Whop-DPA, zusätzlich Upstash und Vercel) und L6
(Anwalts-Freigabe AGB §11 + §356a) warten seit Wochen auf Dritte. Benennen ja, als eigene Aufgabe
wieder aufmachen nein.

---

## Danach

L2 (`agb_accepted` mit Versionsstand — sonst erreicht eine AGB-Änderung **keinen** Bestandsnutzer,
§308 Nr. 5 BGB) und L4 („Cookies" → „lokale Speicherung", ein Satz). Dann das nächste Audit:

```
/accessibility
```

Sechs der siebzehn geplanten Audits sind nie gelaufen (Abschnitt 1.1 des Arbeitsplans), **je eine
eigene Session** — zwei Audits in einem Lauf machen die Fundliste unlesbar. `/accessibility` ist
das ranghöchste davon; der letzte A11y-Lauf war am 2026-07-24 und hieß selbst „Vollaudit-Rest".

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
- **Zwischen Planen und Arbeiten vergeht Zeit.** Diese Datei war in ihrer ersten Fassung nach
  vier Minuten überholt, weil parallel `/compliance-legal` lief. Vor jedem Posten prüfen, ob er
  noch offen ist — `git log`, Masterplan-Status, Fund-Datei. Nicht der Plan-Datei glauben.
- **Module, die nach Optik aussehen, tragen Steuer- und GoBD-Logik.** `js/steuertermine.js`,
  `js/ausgaben.js`, `lager/page.js`, `rechnungen/js/dokumente.js`. Die Tabelle in Abschnitt 4 des
  Arbeitsplans sagt, welcher Test welche Datei schützt — vor jedem Sweep den passenden laufen
  lassen, das kostet unter einer Sekunde.
- **Verifikation hinter dem Whop-Gate.** Claude loggt sich nicht selbst ein. Für UI-Prüfungen die
  Modul-Renderer direkt aufrufen (`App.showSettingsModal()`, `Retouren.render()` …) und in
  `#mainContent` hängen. Braucht ein Test einen echten Login, macht der User ihn einmal im
  Browser-Pane.
- **Browser-Cache.** `python -m http.server` schickt keine No-Cache-Header, und der Cache hängt am
  Origin. Reload, Cache-Bust-Query und neuer Tab liefern trotzdem alten Code. Einzig zuverlässig:
  **neuer Port** in `.claude/launch.json`. Für reine Rechenlogik ist ein Node-Harness schneller.
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
