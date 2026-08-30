# Session-Prompt: Live-Test 5 — Lager-Feature-Batch, Punkt 10

**Aufgabe:** Den zuletzt gebauten Lager-Stapel einmal von Hand durchklicken.
**Dauer:** ~20 Min. **Quelle:** [`live-tests-checkliste.md`](live-tests-checkliste.md), Test 5.

---

## Erstes: die Regeln dieses Repos

```bash
git status --short && git log --oneline -8
```

An diesem Repo arbeiten mehrere Sessions **im selben Working Tree**. Eine Datei, die in
`git status` auftaucht, hält gerade jemand anders — nicht anfassen, per `send_message` abstimmen.

- **Browser-Test nur auf einem frischen Port.** `python -m http.server` schickt keine
  No-Cache-Header, und der Cache hängt am Origin: Reload, Cache-Bust-Query und neuer Tab liefern
  trotzdem alten Code. Neuen Eintrag in `.claude/launch.json`, Port = höchster vorhandener + 1.
- **Kein Dev-Bypass fürs Whop-Gate.** Der Nutzer meldet sich **einmal** im Browser-Pane an, die
  Session bleibt danach erhalten. Claude loggt sich nicht selbst ein.

---

## Was zu prüfen ist

Drei Punkte. Alle drei sind unten am Code vorgeklärt — **das ersetzt den Durchklick nicht**, es
sagt nur, was zu erwarten ist und wo man nachsieht, wenn es abweicht.

- [ ] **Artikel anlegen, eigene Artikelnummer vergeben, Duplikat versuchen** → wird es abgewiesen?
- [ ] **„Artikel aus Lager" in einer Rechnung** → wird er sofort als verkauft markiert?
- [ ] **Retoure auf diesen Verkauf** → stimmt die §25a-Marge danach noch?

---

## Vorab am Code geklärt (2026-08-30)

### Punkt 1 — die Abweisung funktioniert, ist aber **stumm**

[`js/store.js:1424`](../js/store.js) prüft beim Speichern gegen `isArtikelNrTaken()`. Ist die
gewünschte Nummer vergeben, passiert das hier:

```js
if (!gewuenschteNr || (gewuenschteNr !== old.artikelNr && this.isArtikelNrTaken(gewuenschteNr, purchase.id))) {
    purchase.artikelNr = old.artikelNr;      // stillschweigend zurückgesetzt
```

**Die Datenintegrität ist also sicher** — ein Duplikat entsteht nicht, und
`test/test-artikelnummer-eigene.js` (Fall A2) nagelt das fest.

> ⚠️ **Aber es gibt keinen Toast und keine Fehlermeldung.** Der Nutzer tippt eine vergebene
> Nummer, speichert, und das Feld zeigt danach wieder die alte — ohne dass ihm jemand sagt,
> warum. **Genau das ist beim Durchklicken zu beobachten:** Merkt man als Nutzer, dass die
> Eingabe verworfen wurde? Wenn nein, ist das ein Fund (Kategorie U7/„stille Ablehnung"), kein
> Fehler der Prüfung.

Zweiter Pfad, anderes Verhalten: Beim **Excel-Import** wird ein Duplikat **nicht** abgewiesen,
sondern bekommt ein Suffix (`SV-1042-2`), siehe [`lager/page.js:2038`](../lager/page.js). Das ist
Absicht — der Verkäufe-Import ordnet Artikel über die Nummer zu, eine doppelte wäre dort
schlimmer als eine umbenannte. Wer beide Wege testet, sollte diesen Unterschied nicht für einen
Bug halten.

### Punkt 2 — Markierung passiert beim Verknüpfen, nicht bei der Zahlung

[`rechnungen/js/rechnung.js:369-376`](../rechnungen/js/rechnung.js):

```js
// Ein Lagerartikel gilt ab dem Verknüpfen mit einer Rechnungsposition als verkauft
Store.savePurchase(Object.assign({}, art, { status: 'verkauft', verkaufsdatum: art.verkaufsdatum || Utils.todayISO() }));
```

Erwartung also: **sofort** nach „📦 Artikel aus Lager", nicht erst wenn die Rechnung bezahlt ist.
Es gibt einen Gegenweg (`:497`): wird die Verknüpfung geändert, wird der alte Artikel wieder
freigegeben und der neue als verkauft markiert. **Auch das mit durchklicken** — Position wieder
entfernen und prüfen, ob der Artikel im Lager zurück auf „verfügbar" steht.

### Punkt 3 — wo die Marge korrigiert wird

Die Retoure erzeugt keine eigene vk/ek-Position, sondern eine `margeKorrektur`:
[`js/ustvoranmeldung.js:127`](../js/ustvoranmeldung.js) und `:223`, verrechnet in
[`js/steuer-berechnung.js:127`](../js/steuer-berechnung.js).

Erwartung: nach einer **vollen** Retoure ist die Bemessungsgrundlage der betroffenen Position
**0**, nicht der ursprüngliche Rohertrag. Genau hier lag der Bug vom 2026-08-09 (die Korrektur
wurde gepusht, aber von niemandem gelesen — Bemessungsgrundlage blieb bei 50 statt 0).

> **Bekannte, bewusste Grenze — kein Fund:** Bei der **Einzeldifferenz** (Standardmethode)
> verhindert der Floor bei 0 pro Position eine rückwirkende Korrektur über Positionsgrenzen
> hinweg. Das ist Gesetzeslogik (§25a Abs. 3 erlaubt keine Verrechnung zwischen Positionen),
> nicht ein Programmfehler. Steht so in [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md).

---

## Danach

- Alle drei Haken in [`live-tests-checkliste.md`](live-tests-checkliste.md) setzen, Test 5 auf
  ✅ mit Datum. **Die Datei hält evtl. eine andere Session** — vorher `git status`.
- Jeder Fund kommt in [`01-AUFGABEN.md`](01-AUFGABEN.md), nicht in eine neue Liste. Konkurrierende
  Listen haben am 2026-08-15 eine ganze Session gekostet.
- Wird etwas gefixt: `for f in test/*.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done`
  muss stumm bleiben, und **nach dem Commit gegen HEAD prüfen, nicht gegen den Working Tree** —
  `git archive HEAD | tar -x -C <tmp>` und dort die Suite laufen lassen. An genau dieser Lücke
  ist `c982264` gescheitert: im Working Tree war alles grün, die Pathspec war zu eng, und die
  Lager-Seite war live tot.
- Pfad-gescoped committen (`git commit -F <datei> -- <pfade>`), **nicht pushen ohne Freigabe**.
