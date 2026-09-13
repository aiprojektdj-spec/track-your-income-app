# Vollaudit 2026-09-09 — fünf Kategorien

**Stand: 2026-09-09.** Gegen den Code geprüft, nicht gegen Plandateien.
Vorher gelesen: [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md) und [`01-AUFGABEN.md`](01-AUFGABEN.md) —
**keiner** der Funde unten steht dort bereits.

## Stand der Abarbeitung — committet am 2026-09-10

In drei pfad-gescopten Commits:

| Commit | Inhalt |
|---|---|
| `2295373` | Gewinn aus einer Quelle (A1, A2, A3) + zwei neue Harnesse |
| `84c8f8e` | `ui-lab.html`-Härtung: CSP, `Disallow`, Skript und Stylesheet ausgelagert (B1, E) |
| `e0d02b6` | `aria-label` an elf Icon-Buttons (D1) |


| Fund | Stand |
|---|---|
| **A1** vier divergierende Gewinnermittlungen | ✅ behoben — alle vier Stellen ziehen aus `Euer._berechne()` |
| **A2** Gewerbesteuer aus falscher Zahl | ✅ behoben |
| **A3** Dashboard: Käufer-Versand fehlte als Einnahme | ✅ behoben (mit A1) |
| **A4** Storno-Filter fehle | ❌ **Fund war falsch, zurückgezogen** — siehe unten |
| **A5** Zeitzonen-Jahreszuordnung Gewerbesteuer | ✅ entfällt — die Stelle ist ersatzlos weg |
| **A6** eine **fünfte** Gewinnermittlung in `gbr-modul.js` | ✅ behoben am 2026-09-12 — Feststellungserklärung und §141-AO-Weiche hingen daran |
| **A7** `bilanz.js` las die AfA aus einem toten Key | ✅ behoben am 2026-09-13 (`b7dea74`) — AfA und Anlagevermögen waren immer 0 |
| **A8** derselbe tote Key in `akademie.js` | ✅ behoben am 2026-09-13 (`bede2ce`) |
| **B1** `ui-lab.html` ohne Gate, CSP, `noindex` | ✅ behoben, im Browser gegen die echte CSP geprüft |
| **B2** `X-XSS-Protection` veraltet | ✅ behoben am 2026-09-12 — Wert jetzt `0` |
| **C** Module ohne Test | teilweise — vier neue Harnesse, 121 Checks; Zählung korrigiert auf **24 von 56** |
| **D1** Icon-Buttons ohne `aria-label` | ✅ behoben, 11 Stellen (2 mehr als gemeldet) |
| **E** `robots.txt`-Drift | ✅ behoben |

Testsuite: **56 Harnesse, alle grün** (vor dem Audit 50; drei davon aus einer Parallel-Session).

---

## Warum dieses Audit anders ansetzt

Das Vollaudit vom August 2026 hat 17 Themen über rund 70 Funde abgearbeitet. Dieselben Themen
erneut zu fahren, hätte wenig gebracht. Der Einstieg war deshalb die Frage, **wo das Repo bisher
gar nicht hingeschaut hat**: rund die Hälfte der Module hat keinerlei Testabdeckung, und genau
dort liegen die schwersten Funde — A1, A6 und A7 kamen alle aus ungetestetem Code.

**Ausgangslage:** 50 von 50 Testharnessen grün. ~39.000 Zeilen JS, 1.659 Zeilen `api/`,
5.067 Zeilen HTML, 4.691 Zeilen CSS.

> Die Zeilen- und Modulzahlen in diesem Bericht sind Momentaufnahmen vom 2026-09-09 und driften.
> Die Abdeckungszahl stand zunächst als „20 von 48" hier und war doppelt falsch — siehe die
> Korrektur in **Kategorie C**. Im Zweifel neu messen, nicht diesen Bericht zitieren.

---

## A. Rechenlogik und Steuer — schwerwiegend

### A1 — Fünf Bildschirme rechnen fünf verschiedene Gewinne

> Die Überschrift hieß bis zum 2026-09-12 „Vier Bildschirme". Die fünfte Stelle
> (`gbr-modul.js`) kam erst beim Abarbeiten der letzten offenen Aufgabe ans Licht — siehe **A6**.

Neben [`js/euer.js:283`](../js/euer.js:283) gibt es **vier weitere, voneinander unabhängige
Gewinnermittlungen**. Keine davon fragt die EÜR; jede baut die Formel neu — und jede lässt etwas
anderes weg.

| Stelle | Plattform­gebühren | Versand Verkäufer | AfA | Fahrt­kosten | Eigen­belege | Material | Retouren | USt-Extraktion |
|---|---|---|---|---|---|---|---|---|
| [`euer.js:283`](../js/euer.js:283) **(Referenz)** | ja | ja | ja | ja | ja | ja | ja | ja |
| [`dashboard.js:451`](../js/dashboard.js:451) | ja | ja | **nein** | **nein** | **nein** | **nein** | **nein** | **nein** |
| [`privatbuchungen.js:27`](../js/privatbuchungen.js:27) | **nein** | ja | **nein** | **nein** | **nein** | **nein** | **nein** | **nein** |
| [`gewerbesteuer.js:30`](../js/gewerbesteuer.js:30) | **nein** | **nein** | **nein** | **nein** | **nein** | **nein** | **nein** | **nein** |
| [`gbr-modul.js:23`](../js/gbr-modul.js:23) *(A6)* | **nein** | **nein** | **nein** | **nein** | **nein** | **nein** | ja | ja |

**Beleg.** Ein Minimaldatensatz — ein Verkauf (1.000 € + 50 € Käufer-Versand, 40 €
Verkäufer-Versand, 10 % Gebühr), ein Einkauf (2 × 300 €), eine Ausgabe (200 €), dazu 800 € AfA,
150 € Fahrtkosten, 120 € Eigenbelege, 90 € Material, 100 € Retoure:

```
euer.js (Referenz)        -1155.00 EUR
dashboard.js                 55.00 EUR   Delta  1210.00
privatbuchungen.js          210.00 EUR   Delta  1365.00
gewerbesteuer.js            250.00 EUR   Delta  1405.00
```

Die EÜR weist einen **Verlust** aus, alle drei anderen Seiten einen **Gewinn**. Die Spreizung
beträgt 1.405 € — auf einem Datensatz mit vier Belegen. Sie wächst mit jedem Anlagegut, jeder
Fahrt und jeder Retoure, die der Nutzer erfasst.

Die Differenz zur Gewerbesteuer-Formel lässt sich vollständig aufschlüsseln und ist genau die
Summe der ausgelassenen Posten: 800 AfA + 150 Fahrt + 90 Material + 120 Eigenbeleg + 105 Gebühr
+ 40 Verkäufer-Versand + 100 Retoure = 1.405 €. `test/test-gewinn-eine-quelle.js` prüft das.

### A2 — Die Gewerbesteuer wird aus der falschen Zahl berechnet — ✅ GEFIXT 2026-09-09

> **Erledigt und committet (`2295373`).** `_calcGewinn()` rechnet nicht mehr selbst, sondern zieht
> den Gewinn aus `Euer._berechne(year, 0, 'jahr')`. Dafür wurde der Rechenkern der EÜR
> (299 Zeilen) aus `render()` in die eigene Methode `_berechne(year, month, period)` gelöst:
> DOM-frei, ohne State-Nebenwirkung, von außen aufrufbar. `render()` bezieht seine Werte
> seitdem per Destrukturierung daraus und setzt `_lastGewinn`/`_lastRenderData` selbst — ein
> fremder Aufrufer darf die angezeigte EÜR nicht überschreiben.
>
> Nachgewiesen: die Rechenlogik ist **zeilenweise identisch** verschoben (270 gegen 270
> normalisierte Zeilen, keine Abweichung), `render()` läuft in einem echten Aufruf ohne
> `ReferenceError` durch, und `test/test-gewinn-eine-quelle.js` hält mit 22 Checks fest, dass
> beide Wege denselben Wert liefern. Inzwischen 53 von 53 Harnessen grün.
>
> **Korrektur an meiner eigenen Schätzung unten:** „ein Löschen plus ein Aufruf" war zu
> optimistisch — `euer.js` hatte keine aufrufbare Berechnungsfunktion, die musste erst
> entstehen.



Das ist die steuerlich scharfe Kante von A1. [`js/gewerbesteuer.js:44`](../js/gewerbesteuer.js:44)
speist `_calcGewinn(year)` in `_calc()` und damit direkt in Messbetrag und Steuerschuld.
Gleichzeitig zeigt [`js/euer.js:613`](../js/euer.js:613) `_renderGewerbesteuerBlock(gewinn)` **denselben
Sachverhalt mit dem korrekten EÜR-Gewinn**.

Ergebnis: Die App nennt an zwei Stellen zwei verschiedene Gewerbesteuerbeträge für dasselbe Jahr.
Auf denselben Betrieb hochskaliert (Faktor 200), sodass der Freibetrag von 24.500 € greift:

```
EUER-Gewinn  -231000.00  ->  GewSt      0.00 EUR
_calcGewinn    50000.00  ->  GewSt   3570.00 EUR
```

Weil `_calcGewinn` **jede** Ausgabenart außer Wareneinkauf und Ausgaben ignoriert, liegt der Fehler
strukturell zulasten des Nutzers: Die Gewerbesteuer-Seite weist systematisch zu viel aus.

**Fix:** `_calcGewinn` streichen und den Gewinn aus der EÜR beziehen — dort liegt er bereits
aufbereitet (`euer.js` hält ihn in `_lastGewinn`). Eine zweite Formel ist nicht zu retten, nur zu
entfernen.

### A3 — Dashboard: Käufer-Versand fehlt als Einnahme, zählt aber in der Gebührenbasis

[`js/dashboard.js:441`](../js/dashboard.js:441) summiert die Einnahmen nur aus `verkaufspreis`.
Sieben Zeilen darunter ([`:445-449`](../js/dashboard.js:445)) berechnet dieselbe Funktion die
Plattformgebühr aus `(verkaufspreis + versandkostenKaeufer)`.

Der vom Käufer gezahlte Versand wird also **als Kostenbasis anerkannt, aber nicht als Einnahme
gebucht**. `euer.js` und `privatbuchungen.js` zählen ihn beide zu den Einnahmen. Der
Dashboard-Gewinn ist dadurch für sich genommen zu niedrig — unabhängig von allem in A1.

### A4 — ~~Storno wirkt in drei von vier Gewinnformeln nicht~~ — **zurückgezogen**

> **Dieser Fund war falsch.** Er unterstellte, `dashboard.js`, `gewerbesteuer.js` und
> `privatbuchungen.js` filterten stornierte Verkäufe nicht, weil sie kein `storniert` im
> Quelltext stehen haben. Tatsächlich filtern `Store.getSales()`, `getPurchases()` und
> `getExpenses()` das **selbst** — nur `getSales(true)` liefert stornierte mit
> ([`store.js:1563`](../js/store.js:1563), `:1435`, `:1738`). Alle vier Module sehen also
> dieselben aktiven Datensätze.
>
> Aufgefallen beim Umsetzen von Rang 2, nicht beim Schreiben des Berichts. Lehre fürs nächste
> Audit: Ein fehlendes Schlüsselwort im Modul heißt nicht, dass die Prüfung fehlt — sie kann
> eine Ebene tiefer liegen. Die korrigierten Zahlen in A1/A2 oben tragen dem Rechnung.

**Was von dem Fund übrig bleibt** (kleiner, aber real): `euer.js` schließt zusätzlich Verkäufe
aus, deren **Rechnung** storniert wurde (`storniertInvIds`, Orphan-Guard). Diesen Schritt macht
keines der drei anderen Module. Ein Verkauf, dessen Rechnung storniert ist, zählt dort weiter
mit. Mit der Umstellung auf `Euer._berechne()` löst sich das mit auf.

### A6 — Es war eine **fünfte** Gewinnermittlung — ✅ GEFIXT 2026-09-12

> **Nachtrag vom 2026-09-12.** Aufgefallen beim Schreiben des Tests für `js/rechtsform.js` —
> also erst, als die zuletzt genannte offene Aufgabe angefasst wurde. A1 sprach von vier
> Gewinnermittlungen; es waren fünf.

[`js/gbr-modul.js::_calcJahresgewinn`](../js/gbr-modul.js:23) rechnete den Jahresgewinn der GbR
selbst. Der Kommentar darüber behauptete „dieselbe Rechenbasis wie euer.js/bilanz.js" — und für
USt-Netting, Retouren, Rechnungen und §25a stimmte das sogar. Auf der Ausgabenseite nicht:
**AfA, Fahrtkosten, Eigenbelege, Materialverbrauch, Plattformgebühren und der
Verkäufer-Versand kamen in der gesamten Datei an keiner Stelle vor.**

Das wiegt schwerer als A2, weil der Wert an drei Stellen landet:

1. **`_exportFeststellung()`** — der Gewinn geht in die **Feststellungserklärung ans Finanzamt**
   und über `GbR.berechneVerteilungMitSonder()` in die Gewinnanteile der einzelnen
   Gesellschafter.
2. **`Rechtsform.ueberschreitetAO141Schwelle()`** — reißt der überhöhte Gewinn die
   80.000-€-Grenze des §141 AO, **sperrt [`js/euer.js:356`](../js/euer.js:356) die EÜR-Seite
   vollständig ab** („EÜR nicht verfügbar") und verweist auf eine Bilanzpflicht, die gar nicht
   besteht. Ein Rechenfehler nimmt dem Nutzer damit seine Gewinnermittlung weg.
3. Die KPI-Kacheln der GbR-Übersicht.

**Fix:** wie A2 — `Euer._berechne(year, 0, 'jahr')` als Quelle. Die Identität
`gewinn = einnahmen − wareneinkauf − betriebsausgaben` bleibt exakt erhalten, die §25a-Werte
kommen jetzt aus derselben Stelle statt aus einer Teilkopie.

**Zu beachten:** Es entsteht die Kette `euer.render() → Rechtsform.brauchtBilanzStattEuer() →
GbrModul._calcJahresgewinn() → Euer._berechne()`. Die ist zirkelfrei, **weil `_berechne()` keine
Rechtsform-Weiche kennt** — die steht in `render()` vor dem Aufruf. Wer sie nach `_berechne()`
hineinzieht, baut eine Endlosschleife. Der Hinweis steht als Warnung im Code.

Nebenbefund derselben Runde: `test-25a-pauschalmarge.js` prüfte per Quelltext, ob `gbr-modul.js`
die §25a-Warenart mitprüft. Diese zweite Kopie ist mit dem Fix verschwunden; der Check prüft
jetzt den Bezug zur EÜR statt der Kopie.

### A7 — Die Bilanz las die Abschreibung aus einem Key, den niemand schreibt — ✅ GEFIXT 2026-09-13

> **Nachtrag vom 2026-09-13**, gefunden beim Prüfen von `js/bilanz.js` — dem Modul, das im
> letzten Bericht als „nächster sinnvoller Schritt" benannt war.

[`js/bilanz.js`](../js/bilanz.js) holte das Anlagenverzeichnis über `Store.get('afa_items')`.
**Diesen Schlüssel schreibt nirgends jemand.** Die Anlagen liegen unter `afa_anlagen` und werden
über `Store.getAfaAnlagen()` gelesen — so wie `afa.js`, `euer.js` und `steuerberater.js` es tun.
Der Aufruf lieferte also immer eine leere Liste.

Folge an drei Stellen:

1. **GuV:** Die AfA war immer 0, der Jahresüberschuss entsprechend zu hoch — und damit die
   Bemessungsgrundlage für Körperschaft- und Gewerbesteuer.
2. **Aktivseite:** Das Anlagevermögen war immer 0. Der Bilanz fehlte nicht nur ein Posten, ihr
   fehlte **Bilanzsumme**.
3. Die Einzelaufstellung der Anlagen darunter blieb leer.

Getroffen hat das GmbH, UG, OHG, KG und GmbH & Co. KG — die Rechtsformen, die **keine EÜR
aufstellen dürfen** und deshalb keine zweite Ansicht haben, in der die Abschreibung korrekt
erschienen wäre.

Zwei weitere Fehler steckten in derselben Stelle: Gefiltert wurde auf `item.aktiv` — ein Feld,
das es an einer Anlage nicht gibt (maßgeblich ist `storniert`); mit dem richtigen Key hätte
also *trotzdem* alles herausgefallen. Und `ak / nd` ist stur linear: ohne Monatsregel im
Anschaffungsjahr (§7 Abs. 1 S. 4 EStG), ohne GWG-Sofortabschreibung (§6 Abs. 2), ohne degressive
AfA (§7 Abs. 2). Die Aktivseite rechnete ihren Restwert zudem gegen `new Date().getFullYear()`
statt gegen das Bilanzjahr — eine Bilanz für 2024 zeigte den Buchwert von heute.

`js/afa.js` konnte all das längst: `_totalAfaFuerJahr(year)` und `_buchwertEnde(asset, year)`.

**Anders als A1/A6 ist eine eigene Rechnung hier fachlich richtig:** Eine GuV nach §4 Abs. 1
EStG/HGB folgt der Periodenabgrenzung, die EÜR dem Zufluss-/Abflussprinzip (§4 Abs. 3). Der
EÜR-Gewinn darf hier gerade **nicht** übernommen werden. Geändert wurde nur die AfA-Quelle.

**Beim Fixen selbst fast ein Folgefehler:** Eine dritte Stelle sprach weiter die gelöschte
Variable `afaItems` an. `node --check` sieht so etwas nicht (die Syntax ist gültig), ein Regex
auch nicht — erst der Aufruf wirft den `ReferenceError`. `test/test-bilanz.js` führt
`_renderAktiva()` deshalb wirklich aus. Commit `b7dea74`.

### A8 — Derselbe tote Key in der Akademie — ✅ GEFIXT 2026-09-13

Ein Sweep über **alle** `Store.get('<literal>')`-Aufrufe nach dem A7-Fund brachte einen zweiten
Fall: [`js/akademie.js`](../js/akademie.js) zählte die Protokolleinträge über
`Store.get('audits')` statt `Store.getAuditLog()`. Die Zahl war immer 0, das Achievement
„Audit-Saubermann" (100+ dokumentierte Änderungen) damit unerreichbar. Commit `bede2ce`.

**Ausdrücklich kein Fund** sind die übrigen Sweep-Treffer — `Store.get('ausgaben')` und
`Store.get('retouren')` in `bilanz.js`, `koerperschaftsteuer.js`, `vorsteuer.js` und
`oesterreich.js`. Sie stehen samt und sonders hinter `Store.getExpenses ? … : …`, also in einem
Fallback-Zweig, der nie läuft. Hier notiert, damit der nächste Sweep nicht dieselbe Runde dreht.

### A5 — Zeitzonenabhängige Jahreszuordnung (klein, aber inkonsistent)

[`js/gewerbesteuer.js:31-33`](../js/gewerbesteuer.js:31) grenzt das Jahr mit
`new Date(s.datum).getFullYear()` ab. `"2026-01-01"` parst als UTC-Mitternacht, `getFullYear()`
liest lokal — westlich von UTC fällt der Beleg ins Vorjahr. Für DE-Nutzer (UTC+1/+2) folgenlos,
aber der Rest des Repos nutzt konsequent `Utils.isInPeriod` mit String-Vergleich.

---

## B. Sicherheit

Die Serverless-Endpunkte sind **solide**. Stichprobe an `api/whop-access.js`, `api/sync.js`,
`api/blob-upload.js`: Identität wird durchgehend server­seitig aus dem Whop-Token abgeleitet,
einer client-gesendeten ID wird nie vertraut; `isOwnedBlobUrl` prüft den Namespace gegen den
aufrufenden Nutzer; Owner-Bypass hängt an der unveränderlichen `me.sub` statt am Anzeigenamen;
das Fail-open der Deckel ist bewusst entschieden und seit `api/_alert.js` gemeldet. Hier ist
nichts offen.

Ein Fund außerhalb der Endpunkte:

### B1 — `ui-lab.html` ist öffentlich, ungeschützt und indexierbar

Der Design-Prototyp (454 Zeilen) hat:

- **kein Whop-Gate** — kein `AuthUI.boot()` in der Datei
- **keine CSP** — `vercel.json` vergibt CSP pro Route; `ui-lab.html` hat keine, und die globale
  `/(.*)`-Route setzt bewusst keine (Regel 8 der `CLAUDE.md`)
- **kein `noindex`, kein `Disallow`** — `robots.txt` sperrt `app.html`, `lager/`, `rechnungen/`,
  `eigenbelege/` und `landing-v2.html`, aber nicht `ui-lab.html`

Damit ist ein internes Terminologie- und Design-Labor öffentlich abrufbar und für Suchmaschinen
freigegeben. Kein Datenabfluss (die Seite ist Demo-first, ohne Kundendaten), aber es ist die
einzige ausgelieferte Seite ohne CSP.

**Fix:** `Disallow: /ui-lab.html` in `robots.txt`, plus CSP-Route in `vercel.json` — oder die
Datei aus dem Deployment nehmen.

### B2 — `X-XSS-Protection: 1; mode=block` (Randnotiz)

[`vercel.json:19`](../vercel.json:19). Der Header ist überholt; moderne Browser haben den
XSS-Auditor entfernt, und in den Browsern, die ihn noch kennen, konnte er selbst Lücken
öffnen. Empfohlener Wert ist heute `0`. Bei der hier gesetzten CSP ohne `unsafe-inline` im
`script-src` praktisch folgenlos.

---

## C. Testabdeckung

Die Harnesse laufen grün — das ist belastbar. Die Lücke ist nicht die Qualität der Tests,
sondern ihre **Verteilung**.

> **Korrektur vom 2026-09-13:** Hier stand „20 von 48 Modulen". Beide Zahlen waren falsch.
> `js/` enthält **56** Module, und die Abdeckung war zu optimistisch gemessen: Die Heuristik
> zählte jede *Erwähnung* eines Modulnamens in `test/` als Abdeckung — auch eine, die bloß im
> Kommentar stand. Schärfer gezählt (lädt ein Test die Datei per `js/<name>.js` wirklich?) sind
> es **24 von 56**. `bilanz.js` galt nach der alten Zählung als abgedeckt und war es nicht —
> genau dort lag dann Fund A7.

Rechenrelevant und ungetestet:

| Zeilen | Modul | Warum es zählt |
|---|---|---|
| 705 | `statistiken` | Auswertungen über alle Jahre |
| 650 | `fahrtenbuch` | speist Z50 der EÜR (`euer.js:1075`) |
| 635 | `materiallager` | speist die Materialkosten der EÜR |
| 422 | `datev` | Exportformat für den Steuerberater |
| 449 | `rechtsform` | steuert Freibetrag und Gewerbesteuerpflicht |
| 285 | `retouren` | mindert Einnahmen nach §11 EStG |
| 212 | `privatbuchungen` | siehe A1 |

Dass A1 bis A4 durch alle 50 Tests gerutscht sind, ist kein Zufall: Für keine der drei
abweichenden Gewinnformeln existiert ein Harness. Ein Test, der die vier Formeln auf denselben
Datensatz wirft und Gleichheit fordert, hätte alle vier Funde am Tag ihrer Entstehung gemeldet.

Positiv geprüft: `fahrtenbuch` ist korrekt an die EÜR angebunden (`euer.js:187`), und
[`js/ausgaben.js:209`](../js/ausgaben.js:209) warnt sogar ausdrücklich vor der Doppelerfassung.
Die Kilometersätze (0,30 € PKW, 0,20 € Motorrad) stimmen.

---

## D. Barrierefreiheit

### D1 — Icon-Buttons ohne `aria-label`

Betroffen: [`js/afa.js:131-133`](../js/afa.js:131), [`js/fahrtenbuch.js:311-313`](../js/fahrtenbuch.js:311),
[`js/vorsteuer.js:566`](../js/vorsteuer.js:566), `:610`, `:655`.

Die Buttons tragen ein `title`, das Screenreader als Notnagel vorlesen — aber `title` ist kein
verlässlicher Accessible Name. Es sind ausgerechnet die **Storno- und Löschknöpfe**.

`Utils.linkOrphanLabels()` greift hier nicht, das ist für Formularlabel zuständig. Der Fix ist
ein `aria-label` je Button.

---

## E. Doku-Drift

- `robots.txt` sperrt `/styleguide.html` — **die Datei existiert nicht mehr**.
- `robots.txt` sperrt `ui-lab.html` nicht — **die Datei existiert** (siehe B1).

Beide Richtungen desselben Fehlers, in derselben Datei.

---

## Was ich empfehle, in dieser Reihenfolge

1. ~~**A2** — `gewerbesteuer.js::_calcGewinn` entfernen, Gewinn aus der EÜR ziehen.~~
   **✅ erledigt am 2026-09-09**, siehe A2 oben. Der Weg dorthin war größer als geschätzt: Der
   Rechenkern musste erst aus `render()` gelöst werden.
2. ~~**A1/A3** — `dashboard.js` und `privatbuchungen.js` auf dieselbe Quelle umstellen.~~
   **✅ erledigt am 2026-09-09.** Beide ziehen jetzt aus `Euer._berechne()`. Der Betreiber hat
   entschieden, dass das Dashboard den **EÜR-Gewinn** übernimmt statt eine eigene gröbere
   Kennzahl zu behalten — eine Spalte namens „Gewinn" soll dem Gewinn entsprechen, den das
   Finanzamt sieht. **Sichtbare Folge:** Bei Regelbesteuerung zeigt das Dashboard jetzt
   Netto statt Brutto, und AfA/Fahrtkosten/Eigenbelege/Material/Retouren drücken die Zahl.
   `anzahl` und `avgVK` bleiben Vertriebskennzahlen und werden weiter aus den Verkäufen
   gebildet. Kosten: ~3,7 ms pro `_berechne()`-Aufruf bei 2.000 Belegen gemessen, das
   Dashboard ruft bis zu 6× auf — 22 ms, keine Optimierung nötig.
3. ~~**B1** — `Disallow` und CSP-Route.~~ **✅ erledigt am 2026-09-09**, aber anders als
   geplant: Die Seite hatte einen inline `<script>`- **und** einen inline `<style>`-Block.
   Statt die CSP mit `'unsafe-inline'` aufzuweichen, sind beide ausgelagert
   (`js/ui-lab.js`, `css/ui-lab.css`). Den `<style>`-Block hätte man ohne den lokalen
   CSP-Preview-Server (`scripts/csp-preview-server.js`, Port 4321) übersehen — die Seite wäre
   ungestylt live gegangen. Dabei fiel ein Font-Pfad auf, der beim Auslagern brach
   (`url('fonts/…')` → `url('../fonts/…')`, wie in allen anderen Stylesheets).
4. ~~**D1** — `aria-label` an die Buttongruppen.~~ **✅ erledigt am 2026-09-09**, 11 statt der
   gemeldeten 9 Stellen: Ein breiterer Sweep über die Sub-Apps fand zwei weitere, darunter
   `rechnungen/js/rech-dashboard.js:210` **ganz ohne** `title` — der einzige Button ohne jeden
   Namen. Die Labels tragen jetzt den Bezug zum Datensatz („Fahrt F-12 vom 01.02.2026
   stornieren") statt 20× „Stornieren".
5. **C** — Harnesse für die ungetesteten Rechenmodule. **Angefangen:**
   `test/test-euer-nebenmodule.js` deckt Retouren, Materialverbrauch, Fahrtenbuch und AfA
   über ihre Wirkung auf die EÜR ab (15 Checks, inkl. Doppelabzug-Schutz bei Retouren zu
   stornierten Verkäufen und zeitanteiliger AfA im Quartal). **Weiter offen:** `statistiken`,
   `datev`, `rechtsform`, `i18n` und die übrigen 16 Module ohne Abdeckung.

## Reichweite dieses Audits

Geprüft wurden: alle vier Gewinnermittlungen im Volltext, `api/whop-access.js`, `api/_alert.js`
und Stichproben aus `api/sync.js` / `api/blob-upload.js`, `vercel.json` vollständig,
`steuertermine.js` vollständig, `robots.txt`, sowie musterbasierte Sweeps über alle 48 JS-Module
(XSS-Oberfläche, `localStorage`-Scoping, Datumsbehandlung, leere `catch`-Blöcke, Storno-Filter).

**Nicht** im Detail geprüft: `akademie.js` (2.415 Zeilen), `lager.js` (2.810), `gbr.js` (1.513),
`i18n.js` (952), sowie die Sub-Apps unter `rechnungen/`, `lager/`, `eigenbelege/`. Das
Rechnungs-/Eigenbeleg-Modul gilt seit dem 2026-07-23 als vollständig auditiert.

Zwei Regelbrüche, die ich ausdrücklich **nicht** gefunden habe, obwohl ich gezielt danach gesucht
habe: `steuertermine.js` nutzt `toISOString` durchgehend auf UTC-konstruierten Daten
(`Date.UTC` + `getUTC*`) — das ist korrekt und kein Verstoß gegen die `sv-SE`-Regel. Und die
bundesweite Feiertagsliste in `_feiertage()` ist vollständig.
