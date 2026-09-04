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

Naheliegende Behebung: in `taxCategoryFor()` vor dem Schluss-`return` auf `pos.differenzbesteuert`
prüfen und denselben Warenart-Text setzen, den `rechnung.js` schon kennt. **Noch nicht gebaut** —
die Datei gehörte am 2026-09-04 zum Arbeitsbereich einer parallelen Session, und XRechnung-Ausgabe
ohne Validator-Gegenprobe zu ändern wäre leichtsinnig.

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

### 3. Pauschalmarge 30 % — bleibt offen

§25a Abs. 3 Satz 2 UStG: Ist der Einkaufspreis eines Kunstgegenstands nicht ermittelbar oder
unbedeutend, sind **30 % des Verkaufspreises** als Bemessungsgrundlage anzusetzen. Kennt Stackr
nicht. Eigener Fall, unabhängig vom Steuersatz, weiterhin ungeprüft — und auch hier gilt dann
Abs. 5 Satz 1: auf die so ermittelte Marge 19 %.

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
