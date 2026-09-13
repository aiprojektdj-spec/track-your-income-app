# Statistiken: vier von vierzehn Einkaufssummen ohne Menge

**Stand: 2026-09-13.** Zweiter Teil der Abarbeitung von Fund **C** aus
[`funde-vollaudit-2026-09-09.md`](funde-vollaudit-2026-09-09.md) — nach
[`funde-datev-2026-09-13.md`](funde-datev-2026-09-13.md). `js/statistiken.js` ist mit 705 Zeilen
das größte Modul ohne jede Testabdeckung gewesen.

---

## Der Fund

`einkaufspreis` ist der **Stückpreis**; die Stückzahl steht in `anzahl`. Das ist die Konvention
des ganzen Hauses: `js/euer.js`, `js/lager.js` (Lagerwert, Zonenwert, verfügbarer Wert) und zehn
Stellen in `js/statistiken.js` selbst bilden durchgehend `einkaufspreis * (anzahl || 1)`.

**Vier Stellen taten das nicht:**

| Wo | Kennzahl | Wirkung |
|---|---|---|
| `_renderPlatformAnalyse` (2×) | Gewinn je Plattform | Wareneinsatz zu niedrig → **Gewinn zu hoch** |
| `_renderProfitabilitaet` (2×) | Gewinn je Marke und je Typ | dasselbe |

Ein Verkauf nimmt dabei den **ganzen** Einkaufssatz mit — `Store.saveSale()` setzt den
verknüpften Satz komplett auf `verkauft`, eine Teilmenge gibt es nicht ([`js/store.js:1601`](../js/store.js)).
Der Wareneinsatz eines Verkaufs ist also Stückpreis × Stückzahl, und die vier Stellen lagen
falsch, nicht die zehn.

**Das Unangenehme daran ist nicht die Abweichung, sondern ihre Verdopplung:** „Gewinn pro Marke"
steht in diesem Modul **zweimal** — einmal als Diagramm (mit Menge gerechnet) und einmal als
Tabelle darunter (ohne). Zwei verschiedene Zahlen, ein Name, ein Bildschirm. Das ist dieselbe
Klasse wie Fund A1 aus dem Vollaudit („fünf Bildschirme rechnen fünf Gewinne"), diesmal
innerhalb **einer Datei**.

Gemessen an einem Sammel-Einkauf von 10 Stück à 20 €, Verkauf für 300 €:

```
vorher : Gewinn 280,00 €   (Wareneinsatz 20 €)
nachher: Gewinn 100,00 €   (Wareneinsatz 200 €)
```

**Geändert:** alle vier Stellen tragen jetzt die Menge; im Modul sind es 14 von 14.

---

## Der Käufer-Versand — gemeldet, von anderer Seite gefixt, Rest offen

Beim Messen fiel auf, dass `Utils.calculateNetRevenue()` den Käufer-Versand in die
**Gebührenbasis** zog, ihn aber nicht zur Einnahme zählte — während EÜR, USt-Voranmeldung und
DATEV-Stapel ihn zur Einnahme rechnen. Das war Fund **A3** des Vollaudits, am 2026-09-09 nur im
Dashboard behoben, nicht an der gemeinsamen Funktion.

Nicht selbst angefasst, weil die Funktion drei Nutzer hat (`statistiken`, `dashboard`,
`buchungen`) und zwei davon in fremder Hand lagen — stattdessen gemeldet.

> ✅ **Behoben am 2026-09-13 an der Wurzel** (`90d6719`, andere Session): `calculateNetRevenue`
> gibt jetzt `vk + vkKäufer − Gebühr − eigenes Porto` zurück. Sieben Aufrufstellen auf einmal.
> Die Lehre dort war ausdrücklich die allgemeinere: **ein Fix an der Stelle, an der ein Fehler
> auffällt, schließt ihn nicht unbedingt** — zu jedem Fund gehört die Frage, ob dieselbe
> Rechnung anderswo noch einmal steht.

### Was davon offen bleibt: die Bemessungsgrundlage der PStTG-Schwelle

Der Wurzelfix hat den **Gewinn** korrigiert, nicht den **Umsatz**. `platData[…].umsatz` summiert
weiterhin `verkaufspreis` allein. In derselben Tabelle steht damit heute:

| Spalte | Käufer-Versand enthalten? |
|---|---|
| Gewinn (über `calculateNetRevenue`) | ✅ seit `90d6719` |
| **Umsatz** | ❌ |
| **Meldepflicht-Abzeichen** (hängt am Umsatz) | ❌ |

Das ist nicht nur eine Anzeigefrage. Die Plattform meldet nach PStTG die **Vergütung**, die dem
Anbieter gutgeschrieben wird — bei einem Marktplatz, der den Käufer-Versand an den Verkäufer
durchreicht, gehört der dazu. Stackrs eigene Akademie sagt es den Nutzern genauso
(„Bruttoumsatz", `js/akademie.js`), und die EÜR zählt ihn seit je zur Einnahme.

**Die Folge ist eine falsche Beruhigung in die gefährliche Richtung:** Wer 1.950 € Artikelerlös
und 80 € Käufer-Versand hat, bekommt von Stackr ein grünes „✓ OK" — die Plattform meldet ihn
mit 2.030 € trotzdem. Das Abzeichen sagt dann das Gegenteil von dem, was passiert.

> **Zu entscheiden, und zwar bewusst:** ob `umsatz` (Anzeige **und** Schwellenbasis) auf denselben
> Begriff gezogen wird, den EÜR, UVA und DATEV verwenden. Dafür spricht die Konsistenz und die
> Richtung des Irrtums — zu früh gewarnt schadet niemandem, zu spät gewarnt schon. Ich habe es
> **nicht** eigenmächtig geändert: Es verschiebt eine Schwelle mit rechtlicher Wirkung, und die
> exakte Definition der „Vergütung" nach § 2 Abs. 7 PStTG (brutto oder abzüglich einbehaltener
> Plattformgebühren) gehört vom Betreiber oder einem Steuerberater bestätigt, nicht von mir
> geschätzt.

**Nebenbei, eine Zeile UI:** Das Feld heißt in der Lager-Maske „Einkaufspreis (Brutto)", direkt
daneben steht „Anzahl" ([`js/lager.js:2555`](../js/lager.js)). Dass der Preis **pro Stück**
gemeint ist, steht nirgends — und genau diese Unklarheit erzeugt die Fehlerklasse, um die es
hier geht. Ein „(pro Stück)" im Label wäre die billigste Vorbeugung. Nicht geändert: die Datei
ist groß und wird häufig von anderen Sessions gehalten.

## Nachtrag: die Gesetzeszahlen standen im Vergleich

`const pflicht = v.count >= 30 || v.umsatz >= 2000;` — zwei Gesetzeswerte als Literale mitten in
einer Render-Funktion. Regel 7 der [`../CLAUDE.md`](../CLAUDE.md) verlangt für so etwas eine
Jahresfunktion, „auch wenn heute nur ein Wert existiert".

Nachgezogen als `_getPstTgSchwellen(year)` nach dem Muster von `App._getUstGrenzen(year)`. Die
Funktion kennt zusätzlich den Stand **vor** dem PStTG: für Jahre vor 2023 gibt es keine
Meldepflicht, vorher hätte eine Auswertung von 2022 fälschlich eine ausgewiesen. Das Jahr kommt
aus dem gewählten Zeitraum, nicht aus der Systemuhr.

**Nebenbei, eine Zeile UI:** Das Feld heißt in der Lager-Maske „Einkaufspreis (Brutto)", direkt
daneben steht „Anzahl" ([`js/lager.js:2555`](../js/lager.js)). Dass der Preis **pro Stück**
gemeint ist, steht nirgends — und genau diese Unklarheit erzeugt die Fehlerklasse, um die es
hier geht. Ein „(pro Stück)" im Label wäre die billigste Vorbeugung. Nicht geändert: die Datei
ist groß und wird häufig von anderen Sessions gehalten.

---

## Was jetzt absichert

`test/test-statistiken.js` ist neu, **33 Prüfungen**. Gegen den Stand vor dem Fix gehalten meldet
er **5 Fehlschläge**, gegen den heutigen 0.

| Block | Inhalt |
|---|---|
| A (11) | Zeitraumfilter, eigener Zeitraum, Umsatz aus bezahlten Rechnungen, Gutschrift nach §17, keine Doppelzählung gesyncter Rechnungen, Storno, Angebote, Zahlungs- statt Rechnungsdatum |
| B (6) | **PStTG-Meldeschwelle** an beiden Grenzen einzeln: 29 vs. 30 Verkäufe, 1.999 € vs. 2.000 €, dazu 2022 vs. 2023 |
| C (7) | Gewinn je Plattform inkl. Menge, Mehrfachverknüpfung, fehlende Menge = 1, Verkauf ohne Lagerbezug, Gebührenbasis |
| D (3) | Marken- und Typen-Tabelle mit Menge, Standzeit aus dem Einkaufsdatum |
| E (6) | Regressionswächter, Jahresfunktion |

> **Eine Lehre aus dem ersten Tag dieses Harness:** Er hatte `Utils.calculateNetRevenue` als
> **Mock nachgebaut**. Einen Tag später wurde die echte Funktion an der Wurzel korrigiert
> (`90d6719`) — der Harness blieb grün und prüfte trotzdem die alte Welt. Er lädt die Formel
> jetzt aus `js/utils.js`, statt sie nachzubilden; ein Rückbau der Funktion lässt ihn
> nachweislich fehlschlagen (nachgestellt und zurückgesetzt). **Ein nachgebauter Rechenkern ist
> kein Test, sondern eine zweite Quelle für dieselbe Zahl** — genau der Fehler, den dieses
> Modul selbst hatte.

**Block B ist der, der am meisten wert ist.** § 4 Abs. 5 PStTG stellt frei, wer **unter** 30
Verkäufen **und unter** 2.000 € bleibt — gemeldet wird also ab 30 **oder** 2.000 €. Ein Dreher
von `||` zu `&&` würde dem Nutzer „✓ OK" anzeigen, während die Plattform ihn längst meldet.
Die Prüfungen fassen beide Grenzen einzeln an, dazu prüft E3 den Operator im Quelltext.

**Block E ist Bauart statt Wert:** E1 zählt die Einkaufssummen des Moduls aus und verlangt, dass
**jede** die Menge trägt; E2 hält ihre Zahl fest, damit beim nächsten Umbau keine verschwindet.
Genau die Konstellation „10 rechnen so, 4 anders" kann damit nicht wiederkommen.
