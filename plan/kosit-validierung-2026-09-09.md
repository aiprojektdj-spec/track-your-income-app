# KoSIT-Validierung: einmalig manuell, vier Proben liegen bereit

**Entschieden am 2026-09-09.** Von den drei Wegen aus
[`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md) — gar nicht validieren, einmalig manuell, dauerhaft
in CI — ist **einmalig manuell** gewählt. Kein Java, keine neue Abhängigkeit, keine CI, die es
bisher nicht gibt. Regel 6 der [`../CLAUDE.md`](../CLAUDE.md) bleibt unberührt.

Damit ist die Frage aus dem Abschnitt „KoSIT-Validierung der E-Rechnung — offen, weil sie eine
neue Abhängigkeit wäre" beantwortet.

---

## Was zu tun ist

Vier Beispielrechnungen liegen fertig erzeugt in [`../kosit-proben/`](../kosit-proben). Sie
stammen aus dem ausgelieferten Generator (`rechnungen/js/xrechnung.js`), nicht aus einer
Sonderfassung für den Test — erzeugt am 2026-09-09 mit dem Stand nach `1d28248`.

| Datei | Was sie belegen soll |
|---|---|
| `01-standard-19-7.xml` | Gegenprobe: 19 % und 7 % nebeneinander, keine Differenzbesteuerung. Läuft die durch, liegt ein Fehler in den anderen an §25a und nicht am Generator |
| `02-25a-gebraucht.xml` | **Der eigentliche Anlass:** Differenzbesteuerung als Kategorie `E` mit dem §14a-Abs.-6-Pflichttext im `ExemptionReason` |
| `03-25a-gemischt.xml` | `S` und `E` in derselben Rechnung — die Steueraufteilung muss beide Gruppen getrennt ausweisen |
| `04-25a-eu-kunde.xml` | EU-Kunde mit USt-IdNr. Muss `E` bleiben und darf **nicht** zu `K` werden (§25a Abs. 5 Satz 2 UStG nimmt die ig. Lieferung von den fortgeltenden Befreiungen aus). Das war bis `e265a4b` eine Unterzahlung |

Alle vier deklarieren `urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0`
im **CII**-Format (nicht UBL) — beim Hochladen ggf. entsprechend auswählen.

Die hauseigene JS-Prüfung (`XRechnung.pruefeRegeln()`) meldet an allen vieren **keine
Beanstandung**. Genau deshalb sind sie der interessante Testfall: Wenn der amtliche Regelsatz
etwas findet, dann etwas, das die eigene Prüfung strukturell nicht sehen kann.

## Wo hochladen

Eine dauerhaft betriebene Online-Instanz **der KoSIT selbst** gibt es nicht; der offizielle
Validator ist eine Java-Anwendung mit Schematron-Regelsatz. Was es gibt, sind Drittanbieter, die
denselben amtlichen Regelsatz im Browser anbieten, u. a.:

- <https://e-rechnung-validator.de/xrechnung-zugferd-validator/>
- <https://www.erechnung-tool.de/erechnung-validieren>
- <https://www.xrechnungs.de/de/xrechnung-validator>

> ⚠ **Nur diese Musterdateien hochladen, nie eine echte Kundenrechnung.** Die Proben enthalten
> ausschließlich erfundene Firmen, Adressen und Beträge. Für echte Rechnungsdaten wäre der
> Anbieter ein Auftragsverarbeiter nach Art. 28 DSGVO — ohne Vertrag geht das nicht, und es
> widerspräche der Zusage, mit der Stackr wirbt.

## Was danach passiert

**Läuft alles durch:** Ergebnis in [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md) eintragen —
mit Datum und Validator-Version — und den Vorbehalt „nicht gegen den amtlichen Validator geprüft"
dort streichen. Der Hinweis im Export-Toast kann bleiben, weil er für *künftige* Änderungen am
Generator weiter stimmt.

**Findet der Validator etwas:** Regelnummer (`BR-…`, `BR-DE-…`, `BR-E-…`) notieren, sie ist der
direkte Einstieg in den Fix. Regeln der Familie `BR-E-*` betreffen genau die Kategorie E und
damit den §25a-Pfad in `taxCategoryFor()`.

**Wiederholen** lohnt nur nach Eingriffen in `rechnungen/js/xrechnung.js`. Die Proben lassen sich
neu erzeugen, das Skript dafür ist bewusst nicht eingecheckt — es steht vollständig in dieser
Datei beschrieben und ist in zehn Zeilen wiederhergestellt: `XRechnung.generate(inv, settings,
kunde)` mit `leitwegId` gesetzt (BT-10 ist seit `1d28248` Pflicht) und `differenzbesteuert: true`
plus `warenart` aus `gebraucht` / `kunst` / `sammlerstueck`.

**Nicht verwechseln:** Ein bestandener Validator-Lauf sagt, dass die Datei *technisch*
angenommen wird. Ob Kategorie `E` die steuerlich richtige Zuordnung für §25a ist, sagt er nicht —
das ist die fachliche Frage, die in [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md) und
[`25a-ermaessigter-satz-recherche.md`](25a-ermaessigter-satz-recherche.md) hergeleitet ist.
