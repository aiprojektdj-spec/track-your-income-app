# §25a und der ermäßigte Satz — erledigt, weil es die Frage nicht gibt

**Recherchiert am 2026-08-16, am Gesetzestext widerlegt am 2026-09-03.**

Die erste Fassung dieser Datei empfahl, am Artikel einen Umsatzsteuersatz zu erfassen und die
Marge von Kunst- und Sammlerware mit 7 % statt 19 % zu besteuern. **Das war falsch.** Sie stützte
sich auf §25a Abs. 5 **Satz 2** UStG — dort steht etwas ganz anderes. Maßgeblich ist Satz 1:

> **§25a Abs. 5 Satz 1 UStG:** „Die Steuer ist mit dem allgemeinen Steuersatz nach § 12 Abs. 1 zu
> berechnen."
>
> §25a Abs. 5 Satz 2 UStG regelt Steuer**befreiungen**, nicht den Steuersatz: „Die
> Steuerbefreiungen, ausgenommen die Steuerbefreiung für innergemeinschaftliche Lieferungen
> (§ 4 Nr. 1 Buchstabe b, § 6a), bleiben unberührt."

Die Marge ist damit **immer** mit 19 % zu besteuern — auch bei Kunstgegenständen und
Sammlungsstücken, auch nach dem JStG 2024. Der ermäßigte Satz von 7 % (§12 Abs. 2 Nr. 13 UStG,
Anlage 2 Nr. 53/54) gilt seit dem 1.1.2025 für **Lieferung, innergemeinschaftlichen Erwerb und
Einfuhr** solcher Ware in der **Regelbesteuerung**. Auf die Differenz greift er nie.

**Konsequenz für den Code: Die fest verdrahteten 19 sind richtig und bleiben.** Betroffen wären
[`js/euer.js:165`](../js/euer.js), [`js/gbr-modul.js:85`](../js/gbr-modul.js) und vier Stellen in
[`js/ustvoranmeldung.js`](../js/ustvoranmeldung.js) gewesen.

## Die Fehlerrichtung war zusätzlich verkehrt herum

Die alte Fassung argumentierte, pauschale 19 % führten zur **Über**zahlung und seien deshalb
ungefährlich. Beides trifft nicht zu: 19 % sind schlicht korrekt. Hätte man Punkt 1 umgesetzt,
wäre statt 19/119 nur 7/107 auf die Marge abgeführt worden — eine **Unter**zahlung, und zwar
systematisch bei jedem betroffenen Verkauf. Der Fund hätte den Schaden erzeugt, den er zu
verhindern vorgab.

---

## Was von der Recherche übrig bleibt

### 1. Das Artikelfeld existiert längst — und misst etwas anderes

`warenart` ist in [`js/lager.js:2571`](../js/lager.js) gebaut, wird gespeichert und in
[`js/euer.js:145`](../js/euer.js) sowie `:156` in die §25a-Positionen übernommen. Nichts liest es
danach aus. Das ist **kein Mangel**: Das Feld darf den Steuersatz gerade nicht steuern.

Seine echte Aufgabe ist §14a Abs. 6 UStG. Der verlangt auf der Rechnung genau eine von drei
Formulierungen, und die drei Optionen des Dropdowns entsprechen ihnen eins zu eins:

| `warenart` | Pflichtangabe nach §14a Abs. 6 UStG |
|---|---|
| `gebraucht` | „Gebrauchtgegenstände/Sonderregelung" |
| `kunst` | „Kunstgegenstände/Sonderregelung" |
| `sammlerstueck` | „Sammlungsstücke und Antiquitäten/Sonderregelung" |

Der Hinweistext unter dem Feld behauptete bis zum 2026-09-03 dasselbe Falsche wie diese Datei
(„kann nach §25a Abs. 3 UStG i.V.m. Anlage 2 UStG auch 7 % gelten") und forderte den Nutzer aktiv
auf, beim Steuerberater nach dem ermäßigten Satz zu fragen. Korrigiert — er nennt jetzt Abs. 5
Satz 1 und die Pflichtangaben.

**Am 2026-09-04 geprüft: die Pflichtangabe steht korrekt auf der PDF-Rechnung.**
[`rechnungen/js/rechnung.js:1387`](../rechnungen/js/rechnung.js) sammelt die Warenarten aller
differenzbesteuerten Positionen und gibt je Warenart den exakten Wortlaut aus; mehrere Warenarten
auf einer Rechnung ergeben mehrere Zeilen, eine unbekannte Warenart fällt auf `gebraucht` zurück.
Nichts zu tun.

> **Korrektur an meiner eigenen Notiz vom 2026-09-03.** Dort stand, `differenzbesteuert` tauche
> „im Rechnungsweg nirgends auf". Das war ein Fehler im Suchlauf, nicht im Code: der Grep lief nur
> über `js/`, und das Rechnungsmodul liegt in `rechnungen/js/`. Es ist dort vollständig verdrahtet
> — Checkbox und Warenart-Auswahl pro Position, Übernahme aus dem Lagerartikel, Pflichtangabe im
> Ausdruck.

**Dabei ein zweiter Fundort desselben Fehlers:** Der falsche 7-%-Tooltip stand ein zweites Mal am
Warenart-Auswahlfeld der Rechnungsposition
([`rechnungen/js/rechnung.js:329`](../rechnungen/js/rechnung.js)), wortgleich mit dem in
`lager.js`. Ebenfalls korrigiert. Zusätzlich zitierte der Kommentar über der Pflichtangabe
„§25a Abs. 2/3 UStG" als deren Grundlage — richtig ist §14a Abs. 6 UStG.

### 1a. E-Rechnung: §25a wird als „Steuerfreier Umsatz" ausgewiesen — offen

[`rechnungen/js/xrechnung.js:48`](../rechnungen/js/xrechnung.js) `taxCategoryFor()` kennt
`pos.differenzbesteuert` nicht. Eine §25a-Position trägt `mwstSatz: null`, wird über
`parseInt(null) || 0` zu `rate = 0` und fällt bei einem Inlandskunden durch alle Zweige bis zum
Schluss-`return`:

```js
return { code: 'E', reasonCode: null, reason: 'Steuerfreier Umsatz' };
```

Die **Kategorie `E`** ist für die Differenzbesteuerung vertretbar — sie ist die übliche Zuordnung
in EN 16931, unter den Regeln BR-E-1 bis BR-E-10. Falsch ist der **Begründungstext**: Ein
differenzbesteuerter Umsatz ist nicht steuerfrei, er ist auf die Marge besteuert. Und die
§14a-Abs.-6-Pflichtangabe, die die PDF-Rechnung korrekt trägt, fehlt der XML damit vollständig —
obwohl BT-120 (`ExemptionReason`) genau der Ort dafür wäre.

**Gebaut am 2026-09-05.** `taxCategoryFor()` kennt jetzt `pos.differenzbesteuert` und setzt
denselben Warenart-Text, den `rechnung.js` schon für den Ausdruck verwendet. Kategorie `E` bleibt.

**Beim Bauen kamen drei weitere Fehler heraus, die derselbe blinde Fleck erzeugt hat:**

1. **Die ig. Lieferung schlug §25a — eine Unterzahlung.** Eine differenzbesteuerte Position an
   einen EU-Kunden mit USt-IdNr fiel in den `K`-Zweig und wurde als *steuerfreie*
   innergemeinschaftliche Lieferung ausgewiesen. §25a Abs. 5 Satz 2 UStG nimmt genau diese
   Befreiung ausdrücklich aus: „Die Steuerbefreiungen, **ausgenommen die Steuerbefreiung für
   innergemeinschaftliche Lieferungen** (§ 4 Nr. 1 Buchstabe b, § 6a), bleiben unberührt." Der
   Umsatz ist also steuerpflichtig, und die XML meldete ihn steuerfrei. Der `K`-Zweig wird für
   differenzbesteuerte Positionen jetzt übersprungen.
2. **Die Ausfuhr musste dagegen bleiben.** Dieselbe Norm zählt §4 Nr. 1a / §6 nicht mit auf — beim
   Drittlandskunden gilt weiter Kategorie `G`. Das ist der Grund, warum die §25a-Prüfung *nach*
   dem Drittland-Zweig steht und nicht davor.
3. **Gleiche Kategorie, verschiedener Grund — der zweite verschwand still.** `catMap` war nur nach
   Kategorie-Code verschlüsselt, der erste Grund gewann. Bisher fiel das nicht auf, weil alle
   `E`-Fälle denselben Text trugen. Mit §25a wird der Fall real: zwei Warenarten auf einer
   Rechnung, oder §25a neben einem sonstigen steuerfreien Umsatz. Beides hätte eine Pflichtangabe
   verloren. Die Gründe werden jetzt gesammelt und zusammengefasst; die Zeilenebene (BT-128) trägt
   den positionsgenauen Text ohnehin.

**Abgesichert durch [`test/test-25a-xrechnung.js`](../test/test-25a-xrechnung.js)** — 23 Checks,
der erste Harness für `xrechnung.js` überhaupt. Gegen die Fassung aus HEAD **vor** dem Fix
gegengeprüft: dort fallen A1, A2, C1 und E1 durch, der Test greift also wirklich.

> **Weiterhin keine Schematron-Validierung.** Der Export sagt das selbst im Toast: geprüft werden
> Pflichtfelder, nicht die KoSIT-Regeln. Die Kategorie-`E`-Zuordnung für §25a ist die übliche, aber
> vor produktivem Versand gehört die XML durch den offiziellen Validator.

### 2. §25a Abs. 7 Nr. 1 Buchst. c — real, aber für Stackr gegenstandslos

> Die Differenzbesteuerung findet keine Anwendung „in den Fällen des **Absatzes 2**, wenn auf den
> der Lieferung des Wiederverkäufers vorangegangenen Umsatz ein ermäßigter Steuersatz angewandt
> worden ist".

Die alte Fassung nannte das „den Teil, der Geld kostet, wenn er fehlt". Der Ausschluss ist aber
auf **die Fälle des Absatzes 2** begrenzt, und Absatz 2 ist kein Normalfall, sondern ein
Wahlrecht: Der Wiederverkäufer muss es spätestens mit der ersten Voranmeldung des Kalenderjahres
**gegenüber dem Finanzamt erklären**, und die Erklärung bindet ihn für mindestens zwei Jahre.

Wer nach Abs. 1 von Privatpersonen einkauft — der Fall, für den Stackr gebaut ist — ist davon
nicht berührt. Und Stackr kennt die Abs.-2-Option nirgends. Ein Guard hätte also nichts zu
bewachen. **Wird nicht gebaut**, solange es keine Abs.-2-Unterstützung gibt; käme sie, gehört der
Ausschluss zu ihr.

### 3. Pauschalmarge 30 % — gebaut am 2026-09-05

> **Zitierkorrektur:** Diese Datei nannte bisher „Abs. 3 **Satz 2**". Der Normtext, an der
> Primärquelle geholt, weist die Pauschale **Satz 3** zu — Satz 2 regelt die Fälle des §3 Abs. 1b
> und §10 Abs. 5. Satz 4 ist der Satz, der die USt aus der Bemessungsgrundlage heraushält.

Wortlaut Satz 3: *„Lässt sich der Einkaufspreis eines Kunstgegenstandes (Nummer 53 der Anlage 2)
nicht ermitteln oder ist der Einkaufspreis unbedeutend, wird der Betrag, nach dem sich der Umsatz
bemisst, mit 30 Prozent des Verkaufspreises angesetzt."*

Daraus folgen drei Dinge, die den Bau bestimmt haben:

1. **Nur Kunstgegenstände (Anlage 2 Nr. 53).** Sammlungsstücke und Antiquitäten (Nr. 54) sind
   ausdrücklich **nicht** erfasst. Die Warenart wird deshalb an *jeder* Stelle mitgeprüft, nicht
   nur beim Setzen des Hakens — ein Altbestand-Haken an einem Sammlerstück darf keine Pauschale
   auslösen.
2. **Die 30 % sind ein Bruttobetrag.** Satz 4: *„Die Umsatzsteuer gehört nicht zur
   Bemessungsgrundlage."* Die USt wird also aus den 30 % **heraus**gerechnet, nicht aufgeschlagen.
   Der Test sichert genau das ab (300 € → 252,10 netto / 47,90 USt, nicht 357,00).
3. **Die Pauschale ersetzt vk−ek vollständig.** Ein trotzdem erfasster Einkaufspreis wird
   ignoriert — der Tatbestand setzt ja gerade voraus, dass es keinen brauchbaren gibt.

**Umgesetzt** in `SteuerBerechnung._margeRoh()`, gespeist aus Lager (Erfassung), EÜR, GbR-Modul und
UVA. `pauschalmargeSatz(year)` ist eine **Jahresfunktion** nach Arbeitsregel 7, obwohl es bis heute
nur einen Wert gibt. Beide §17-Korrekturwege (Gutschrift, Retoure) nehmen die **Pauschale** zurück
und nicht vk−ek — sonst zöge eine Retoure einen Betrag ab, der nie versteuert wurde.

**Zwei Entscheidungen, die der Normtext nicht ausdrücklich hergibt:**

- **Sammelverkauf:** Hängen an einem Verkauf mehrere Lagerartikel, lässt sich der Erlös nicht
  verlässlich auf sie aufteilen. Die Pauschale greift dann **nicht** — es bleibt bei vk−ek für den
  ganzen Verkauf, statt 30 % auf einen Erlös anzusetzen, der zum größeren Teil zu anderer Ware
  gehört.
- **Gesamtdifferenz:** Pauschalpositionen sind davon **ausgenommen**. §25a Abs. 4 lässt sie nur für
  Gegenstände zu, deren Einkaufspreis 750 € *„nicht übersteigt"* — bei einem Gegenstand, dessen
  Einkaufspreis gerade nicht ermittelbar ist, lässt sich das nicht bejahen. Bewusst die vorsichtige
  Lesart: in der Einzeldifferenz wird die Marge auf jeden Fall versteuert, in der Gesamtdifferenz
  könnte sie gegen Verluste anderer Gegenstände aufgerechnet werden — das wäre die Richtung, die
  Geld kostet. Ohne diese Regel wären sie **still** in den falschen Topf gerutscht, weil
  `undefined > 750` false ergibt.

Abgesichert durch [`test/test-25a-pauschalmarge.js`](../test/test-25a-pauschalmarge.js) — 29 Checks,
davon 8 Quelltextprüfungen gegen ein stilles Abhängen der Verdrahtung.

**Nicht browser-verifiziert:** Die Erfassungsmaske im Lager liegt hinter dem Whop-Gate, das auf
localhost strukturell nicht durchlaufen werden kann. Der Haken gehört beim nächsten Live-Test auf
Produktion gegengeprüft — sichtbar nur bei Warenart „Kunstgegenstände".

---

## Was der Steuerberater beantworten muss

Nichts mehr zum Steuersatz — das ist eine Gesetzesfrage und beantwortet. Es bleibt nur:

- Wurde in der Vergangenheit ein Abs.-2-Wahlrecht gegenüber dem Finanzamt erklärt? Falls nein
  (wahrscheinlich), ist Punkt 2 dauerhaft erledigt.
- Kommen Kunstgegenstände ohne ermittelbaren Einkaufspreis vor (Punkt 3)?

## Quellen

- [§ 25a UStG (gesetze-im-internet.de)](https://www.gesetze-im-internet.de/ustg_1980/__25a.html)
  — Abs. 2, Abs. 3 Satz 2, **Abs. 5 Satz 1**, Abs. 7 Nr. 1 Buchst. c
- [§ 14a UStG (gesetze-im-internet.de)](https://www.gesetze-im-internet.de/ustg_1980/__14a.html)
  — Abs. 6, die drei Pflichtformulierungen
- [Umsatzsteuer-Anwendungserlass zu § 25a UStG (Haufe)](https://www.haufe.de/id/norm/umsatzsteuer-anwendungserlass-zu-25a-ustg-HI7554751.html)
- [BVDG — „7statt19" gilt ab 1. Januar 2025](https://www.bvdg.de/aktuell_GESCHAFFT_7statt19_20241122)
  — betrifft die Regelbesteuerung, nicht die Marge
