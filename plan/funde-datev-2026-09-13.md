# DATEV-Buchungsstapel: drei Fehler, gefunden beim ersten echten Bauen

**Stand: 2026-09-13.** Entstanden beim Abarbeiten von Fund **C** aus
[`funde-vollaudit-2026-09-09.md`](funde-vollaudit-2026-09-09.md) — `datev` war eines der
Module ohne jede Testabdeckung. Alles unten ist an einer gebauten Datei gemessen, nicht am
Quelltext gelesen.

> **Warum das bisher niemand gesehen hat.** Das Audit vom 2026-08-10
> ([`funde-audit-16-17-…`](funde-audit-16-17-vergleich-technisch-buchhaltung-2026-08-10.md), B1)
> hat den Export mit **8/10** bewertet und ausdrücklich gelobt, dass die Feldliste `BU-Schlüssel`,
> `Festschreibung`, `Beleglink` und `EU-Steuersatz` enthält. Bewertet wurde damit die **Liste der
> Spaltennamen im Quelltext** — niemand hat je eine Datei erzeugt und nachgezählt. Genau das ist
> hier zum ersten Mal passiert.

---

## Fund 1 — Der Sammel-Einkauf wurde nur einfach gebucht

`js/datev.js` las `parseFloat(p.einkaufspreis)` und ließ `anzahl` weg. Überall sonst im Haus wird
`einkaufspreis * (anzahl || 1)` gerechnet — in `js/euer.js`, `js/statistiken.js` (sechs Stellen)
und `js/lager.js`. Nur der Stapel nicht.

**Wirkung:** Ein Sammel-Einkauf von 10 Stück à 20 € stand mit **20,00 €** im Stapel statt mit
200,00 €. Die Betriebsausgabe fehlt zu neun Zehnteln, der Steuerberater bucht zu wenig Aufwand —
das Ergebnis ist eine **zu hohe** Steuer. Nicht auffällig, weil die Zahl für sich plausibel
aussieht: Es ist ja ein echter Einkaufspreis, nur eben der für ein Stück.

Gemessen vorher/nachher an derselben Buchung:

```
vorher :  20,00;S;EUR;;;;3400;1800;;0102;p1;;;EK Acme Regal
nachher: 200,00;S;EUR;;;;3400;1800;;0102;p1;;;EK Acme Regal
```

## Fund 2 — HTML-Escaping in einer CSV-Datei

Drei der vier Buchungstexte liefen durch `Utils.escapeHtml`. Eine CSV ist kein HTML: Aus der
Firma **„Reck & Schwarz"** wurde im Stapel **„Reck &amp;amp; Schwarz"**, aus einem Apostroph
`&amp;#39;`, aus einem Anführungszeichen `&amp;quot;`.

Dieselbe Datei war dabei **in sich widersprüchlich**: die Rechnungszeile reicht den Kundennamen
seit je roh durch. In einem Export standen also „Reck &amp;amp; Schwarz" (Einkauf) und
„Müller & Co" (Rechnung) untereinander.

Nötig war das nie — `csvField()` erledigt die einzige Entschärfung, die eine CSV braucht:
Feld in Anführungszeichen, enthaltene Anführungszeichen verdoppelt. `escapeHtml` hat dem sogar
aktiv geschadet, weil es die Anführungszeichen vorher wegübersetzte, an denen `csvField` das
Quoting festmacht.

## Fund 3 — Kopfzeile und Datenzeilen waren 20 Spalten auseinander

Der schwerste der drei, und der einzige, der die Datei **als Ganzes** unbrauchbar macht.

| | Felder |
|---|---|
| Kopfzeile 1 (`EXTF`-Kopf) | 26 |
| Kopfzeile 2 (Spaltennamen) | **96** |
| jede Datenzeile | **116** |

Die Spaltennamen standen als Liste da, die Datenzeilen als `new Array(116)` — zwei Zahlen, die
nie jemand gegeneinander gehalten hat. Der Kommentar daneben sagte obendrein „115 columns", also
eine dritte Zahl. Eine CSV, deren Kopf schmaler ist als ihre Zeilen, importiert DATEV nicht.

**Gemessen mit einem quote-sicheren Feldzähler**, nicht mit `split(';')` — ein naives Zählen
zählt die Trennzeichen *innerhalb* gequoteter Felder mit und lieferte hier 117 und 120, also
Zahlen, die den eigentlichen Befund verdeckt hätten.

**Geändert:** Die Spaltenliste ist jetzt die einzige Quelle, die Datenzeilen leiten ihre Breite
daraus ab (`new Array(SPALTEN.length)`). Kopf und Zeilen können nicht mehr auseinanderlaufen.

> ⚠️ **Was damit ausdrücklich *nicht* beantwortet ist: ob 96 die richtige Zahl ist.**
> Der Kopf deklariert Formatversion **12**. Wie viele Felder diese Version verlangt, steht in der
> offiziellen DATEV-Formatbeschreibung, die hier nicht vorliegt — und Raten wäre bei einem
> Importformat die falsche Sparsamkeit. Belegt ist nur: vorher widersprachen sich die beiden
> Zahlen **in derselben Datei**, jetzt nicht mehr. Ob der Stapel bei DATEV durchläuft, zeigt
> erst ein echter Import — am billigsten beim Steuerberater, der ihn ohnehin einliest.
> **Das ist der einzige offene Punkt aus dieser Runde.**

---

## Fund 4 — Der Stapel kennt die halben Betriebsausgaben nicht

Kein Fehler im engeren Sinn, sondern eine Lücke, die eine Entscheidung braucht — deshalb hier
**nicht** mitgefixt.

Die EÜR zieht acht Ausgabenquellen, der Buchungsstapel vier:

| Quelle | EÜR | DATEV-Stapel |
|---|---|---|
| Wareneinkauf | ✅ | ✅ |
| Sonstige Ausgaben | ✅ | ✅ |
| Versandkosten (Verkäufer) | ✅ | ❌ |
| Plattformgebühren | ✅ | ❌ |
| Fahrtkosten (Fahrtenbuch) | ✅ | ❌ |
| Materialverbrauch | ✅ | ❌ |
| AfA (Anlagenverzeichnis) | ✅ | ❌ |
| Eigenbelege | ✅ | ❌ |
| Retouren (Einnahmenminderung) | ✅ | ❌ |

Die **Einnahmen** stehen vollständig drin, die **Kosten** nur zum Teil. Wer den Stapel einliest,
sieht einen Gewinn, der über dem der EÜR liegt — bei einem Reseller mit Plattformgebühren
deutlich. Es ist dieselbe Klasse wie A1 aus dem Vollaudit („fünf Bildschirme, fünf Gewinne"),
nur eine Ebene weiter außen: hier weicht nicht ein Bildschirm ab, sondern das, was das Haus
verlässt.

Bemerkenswert: Das Kontenmapping **kennt die fehlenden Posten bereits** — `versand` (4230),
`plattform` (4970), `fahrt` (4660), `material` (4980) und `afa` (4840) sind definiert. Benutzt
werden sie bisher nur, wenn eine frei erfasste Ausgabe zufällig so heißt.

**Zu entscheiden, bevor jemand das baut:** Der Stapel ist eine Buchführung mit Gegenkonto, keine
Summenliste. AfA hat keinen Zahlungsvorgang, Plattformgebühren werden vom Verkaufserlös
einbehalten (also nicht gegen Bank gebucht), und Retouren sind eine Erlösminderung, keine
Ausgabe. Jede dieser drei braucht eine Buchungsregel, die ein Steuerberater mitträgt — das ist
keine Fleißaufgabe, sondern eine fachliche Festlegung. Der Zwischenstand ist dokumentiert und
durch Prüfung G2 gegen stilles Wachsen gesichert.

---

## Was jetzt absichert

`test/test-datev-export.js` ist neu: **40 Prüfungen** über Dateigerüst, Beträge, Belegdatum,
Soll-/Ist-Versteuerung, beide Kontenrahmen, Gutschriften, Stornos, Jahresgrenzen, Sortierung,
CSV-Entschärfung und die gelesenen Quellen.

**Gegen den Stand vor dem Fix gehalten meldet er 7 Fehlschläge, gegen den heutigen 0** — er hat
also Zähne und ist keine Bestätigungsmaschine. Zwei Prüfungen sind bewusst Struktur- statt
Wertprüfungen:

- **A5** verbietet eine feste Spaltenzahl im Quelltext (`new Array(<zahl>)`) — genau die
  Konstruktion, die zu Fund 3 geführt hat.
- **G1/G2** zählen die gelesenen `Store`-Quellen aus und schlagen an, sobald eine dazukommt
  oder wegfällt. Damit kann Fund 4 nicht still wachsen.

> **Warum G2 die Gegenliste selbst führt und nicht `js/euer.js` liest:** An der EÜR arbeiten
> regelmäßig parallele Sessions — während dieser Session wurde dort gerade der Materialverbrauch
> durch den Materialeinkauf ersetzt. Ein Harness, der an einer fremden Baustelle hängt, schlägt
> aus fremden Gründen fehl.
