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

## Was dabei auffiel und ausdrücklich **nicht** gefixt ist

**Der Käufer-Versand fehlt in den Statistik-Umsätzen.** `platData[…].umsatz` summiert
`verkaufspreis` allein, und `Utils.calculateNetRevenue()` zieht den Käufer-Versand zwar in die
**Gebührenbasis** ein, zählt ihn aber nicht zur Einnahme. EÜR, USt-Voranmeldung und der
DATEV-Stapel rechnen ihn dagegen zur Einnahme — genau das war Fund **A3** des Vollaudits, dort
für das Dashboard behoben.

Nicht mitgefixt, weil es keine Ein-Datei-Änderung ist: `Utils.calculateNetRevenue()` hat drei
Nutzer (`js/statistiken.js`, `js/dashboard.js`, `js/buchungen.js`), und an `dashboard.js` und
`euer.js` arbeiteten während dieser Session parallele Sessions. Eine gemeinsame Hilfsfunktion
umzudefinieren, während zwei ihrer drei Nutzer in fremder Hand sind, ist der sichere Weg in
einen Konflikt.

> **Zu entscheiden:** ob die Statistiken denselben Umsatzbegriff verwenden sollen wie die EÜR
> (dann steigt jeder ausgewiesene Plattform-Umsatz um den Käufer-Versand), oder ob sie bewusst
> den reinen Artikelerlös zeigen. Beides ist vertretbar — **nicht** vertretbar ist, dass
> „Umsatz" auf zwei Bildschirmen zwei Dinge heißt, ohne dass es irgendwo steht.

**Nebenbei, eine Zeile UI:** Das Feld heißt in der Lager-Maske „Einkaufspreis (Brutto)", direkt
daneben steht „Anzahl" ([`js/lager.js:2555`](../js/lager.js)). Dass der Preis **pro Stück**
gemeint ist, steht nirgends — und genau diese Unklarheit erzeugt die Fehlerklasse, um die es
hier geht. Ein „(pro Stück)" im Label wäre die billigste Vorbeugung. Nicht geändert: die Datei
ist groß und wird häufig von anderen Sessions gehalten.

---

## Was jetzt absichert

`test/test-statistiken.js` ist neu, **28 Prüfungen**. Gegen den Stand vor dem Fix gehalten meldet
er **5 Fehlschläge**, gegen den heutigen 0.

| Block | Inhalt |
|---|---|
| A (11) | Zeitraumfilter, eigener Zeitraum, Umsatz aus bezahlten Rechnungen, Gutschrift nach §17, keine Doppelzählung gesyncter Rechnungen, Storno, Angebote, Zahlungs- statt Rechnungsdatum |
| B (4) | **PStTG-Meldeschwelle** an beiden Grenzen einzeln: 29 vs. 30 Verkäufe, 1.999 € vs. 2.000 € |
| C (7) | Gewinn je Plattform inkl. Menge, Mehrfachverknüpfung, fehlende Menge = 1, Verkauf ohne Lagerbezug, Gebührenbasis |
| D (3) | Marken- und Typen-Tabelle mit Menge, Standzeit aus dem Einkaufsdatum |
| E (3) | Regressionswächter |

**Block B ist der, der am meisten wert ist.** § 4 Abs. 5 PStTG stellt frei, wer **unter** 30
Verkäufen **und unter** 2.000 € bleibt — gemeldet wird also ab 30 **oder** 2.000 €. Ein Dreher
von `||` zu `&&` würde dem Nutzer „✓ OK" anzeigen, während die Plattform ihn längst meldet.
Die Prüfungen fassen beide Grenzen einzeln an, dazu prüft E3 den Operator im Quelltext.

**Block E ist Bauart statt Wert:** E1 zählt die Einkaufssummen des Moduls aus und verlangt, dass
**jede** die Menge trägt; E2 hält ihre Zahl fest, damit beim nächsten Umbau keine verschwindet.
Genau die Konstellation „10 rechnen so, 4 anders" kann damit nicht wiederkommen.
