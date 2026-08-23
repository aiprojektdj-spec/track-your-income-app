# §25a und der ermäßigte Satz — Entscheidungsgrundlage

**Recherchiert am 2026-08-16.** Dies ist **keine Umsetzungsanweisung.** Der Punkt stand in
[`01-AUFGABEN.md`](01-AUFGABEN.md) Abschnitt 3 mit dem ausdrücklichen Vermerk „nicht blind
implementieren" — daran ändert diese Datei nichts. Sie sagt nur, was rechtlich gilt und welche
Frage dein Steuerberater beantworten muss.

---

## Was Stackr heute rechnet

Der Rechenkern kann längst mehrere Sätze: `margeEinzeldifferenz()` in
[`js/steuer-berechnung.js:107`](../js/steuer-berechnung.js) nimmt **pro Position** einen `satz`.

Fest auf 19 stehen nur die zwei **Vorschau-Aufrufe**:

- [`js/euer.js:165`](../js/euer.js) — `Object.assign({ satz: 19 }, p)`
- [`js/gbr-modul.js:85`](../js/gbr-modul.js) — dieselbe Zeile

Es fehlt also nicht die Rechenlogik, sondern die **Angabe am Artikel**, welcher Satz gilt.

## Was seit dem 1.1.2025 gilt (JStG 2024)

Der Fund im Audit war unter dem alten Rechtsstand formuliert. Seit dem Jahressteuergesetz 2024
haben sich **zwei** Dinge geändert, und das zweite ist das wichtigere:

**1. Der ermäßigte Satz auf Kunst ist zurück.** Kunstgegenstände und Sammlungsstücke sind wieder
mit **7 %** belegt (§12 Abs. 2 Nr. 13 UStG). Maßgeblich ist Anlage 2:

| Anlage 2 | Ware |
|---|---|
| Nr. 53 | Kunstgegenstände |
| Nr. 54 | Sammlungsstücke |
| Nr. 49 Buchst. f | zugehörige Druckerzeugnisse |

Bei Differenzbesteuerung wird die **Marge mit dem Satz der Ware** besteuert
(§25a Abs. 5 Satz 2 UStG) — für Anlage-2-Ware also `USt = Marge × 7/107` statt `× 19/119`.

**2. Neuer Ausschlussgrund — §25a Abs. 7 Nr. 1 Buchst. c UStG.** Die Differenzbesteuerung ist
**ausgeschlossen**, wenn auf den vorangegangenen Umsatz bereits ein ermäßigter Satz angewendet
wurde. Das betrifft die Fälle des §25a Abs. 2 (selbst eingeführte oder mit ausgewiesener Steuer
erworbene Kunst) — beim **Ankauf von Privatpersonen bleibt die Differenzbesteuerung anwendbar**.

**Nebenbefund:** Ist der Einkaufspreis eines Kunstgegenstands (Nr. 53) nicht ermittelbar oder
unbedeutend, sind pauschal **30 % des Verkaufspreises** als Bemessungsgrundlage anzusetzen
(§25a Abs. 3 Satz 2). Auch das kennt Stackr heute nicht.

---

## Was das für die Fehlerrichtung bedeutet

Der Audit-Fund sagte: pauschal 19 % führe zur **Überzahlung**, sei also steuerstrafrechtlich
ungefährlich. Das stimmt für Punkt 1 weiterhin — wer 19 % statt 7 % auf die Marge abführt, zahlt
zu viel.

**Punkt 2 dreht die Richtung um.** Wer Kunst mit 7 % eingekauft hat und trotzdem
differenzbesteuert verkauft, wendet ein Verfahren an, das ihm nicht mehr zusteht, und versteuert
nur die Marge statt des vollen Entgelts. Das ist eine **Unterzahlung**. Stackr fragt heute
nirgends, ob der Einkauf ermäßigt besteuert war — es kann diesen Fall also weder erkennen noch
warnen.

---

## Empfehlung

**Nicht automatisieren, sondern erfragen.** Kein Automatismus kann aus „Vintage-Jacke" oder
„Sammlerstück" ableiten, ob Anlage 2 Nr. 53/54 greift — das ist im Einzelfall eine Zollrechts-
und Sachverständigenfrage.

1. **Artikelfeld „Umsatzsteuersatz" mit Default 19 %.** 7 % nur aktiv wählbar, mit einem
   Hinweis, der die Anlage-2-Nummer nennt und zur Rückfrage beim Steuerberater auffordert. Die
   zwei Vorschau-Aufrufe lesen dann das Feld statt der festen 19.
2. **Guard vor dem gefährlichen Fall zuerst.** Eine Ja/Nein-Angabe am Einkauf: *„War auf diesen
   Einkauf ein ermäßigter Steuersatz ausgewiesen?"* Bei Ja die Differenzbesteuerung für diese
   Position sperren, mit Verweis auf §25a Abs. 7 Nr. 1 Buchst. c. **Das ist der Teil, der Geld
   kostet, wenn er fehlt** — und er ist billiger als Punkt 1.
3. **Pauschalmarge 30 % separat betrachten.** Eigener Fall, eigene Entscheidung, nicht in
   denselben Aufwasch.
4. **Jahresfunktion, keine Konstante** — Regel 7 der Arbeitsregeln. Der Satz gilt ab 2025;
   Verkäufe aus 2024 bleiben bei 19 %.

## Was der Steuerberater beantworten muss

- Fällt die Ware, die du tatsächlich handelst, unter Anlage 2 Nr. 53/54 — oder ist es
  Gebrauchtware, für die weiterhin 19 % gilt? **Wenn Letzteres, ist der ganze Punkt für dich
  gegenstandslos** und gehört zu den Entscheidungen, nicht zu den Aufgaben.
- Gab es in der Vergangenheit Einkäufe mit ausgewiesenem ermäßigtem Satz, die
  differenzbesteuert weiterverkauft wurden? Das wäre rückwirkend zu korrigieren.
- Gilt für deine Fälle die Pauschalmarge nach §25a Abs. 3 Satz 2 überhaupt?

## Quellen

- [§ 25a UStG (gesetze-im-internet.de)](https://www.gesetze-im-internet.de/ustg_1980/__25a.html)
- [KMLZ Newsletter 52/2024 — JStG 2024 für Münz-, Kunsthändler und Galeristen](https://www.kmlz.de/de/Umsatzsteuer/Newsletter_52_2024)
- [DATEV magazin — Wiedereinführung des ermäßigten Steuersatzes zum 1.1.2025](https://www.datev-magazin.de/nachrichten-steuern-recht/steuern/wieder-einfuehrung-des-ermaessigten-steuersatzes-auf-kunstgegenstaende-und-sammlungsstuecke-zum-1-januar-2025-143695)
- [Haufe — Ermäßigter Steuersatz auf Kunstgegenstände und Sammlungsstücke](https://www.haufe.de/steuern/finanzverwaltung/ermaessigter-steuersatz-auf-kunstgegenstaende-und-sammlungsstuecke_164_670038.html)
