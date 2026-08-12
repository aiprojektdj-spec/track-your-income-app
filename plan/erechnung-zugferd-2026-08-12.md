# ZUGFeRD-Ausgabe (PDF/A-3) — Bewertung und Rahmen (2026-08-12)

**Fund:** G5 aus [`funde-audit-03-feature-gap-2026-08-10.md`](funde-audit-03-feature-gap-2026-08-10.md)
**Sofort erledigt:** die falsche Bezeichnung (s. Abschnitt 3)
**Nicht gebaut:** die PDF/A-3-Ausgabe — Begründung unten

---

## 1. Was der Fund richtig gesehen hat

`rechnungen/js/xrechnung.js` trug im Kopf „XRechnung / ZUGFeRD XML Generator", erzeugt aber eine
reine XML-Datei. Dasselbe stand in der `verfahrensdokumentation.html` — also in dem Dokument, das
bei einer Betriebsprüfung vorgelegt wird. Eine Aussage über den eigenen Funktionsumfang, die dort
zu weit geht, ist unangenehmer als eine fehlende Funktion.

Der Unterschied ist real, auch wenn er technisch klein klingt:

| | XRechnung (was Stackr exportiert) | ZUGFeRD / Factur-X |
|---|---|---|
| Ausgabe | `.xml` | PDF/A-3 mit eingebetteter XML |
| XML-Syntax | UN/CEFACT CII | dieselbe CII |
| Für Menschen lesbar | nein | ja, die PDF-Seite |
| Rechtlich E-Rechnung | ja | ja |

Beide erfüllen §14 UStG. ZUGFeRD ist bequemer, weil ein Empfänger ohne E-Rechnungs-Software das
PDF einfach ansehen kann.

**Auf der Empfangsseite kann Stackr ZUGFeRD vollständig** — `rechnungen/js/erechnung-import.js`
liest Factur-X/ZUGFeRD, extrahiert die XML aus dem PDF und weist sogar die Profile MINIMUM und
BASIC-WL als rechtlich unzureichend zurück. Die Lücke besteht ausschließlich beim Erzeugen.

## 2. Warum die Ausgabe kein Nebenbei-Fix ist

Stackr hat **keine PDF-Bibliothek**. Rechnungs-PDFs entstehen über den Druckdialog des Browsers
auf ein Druck-Stylesheet (`rechnungen/js/rechnung.js` ab dem `.inv-wrap`-Block). Der Browser
liefert dabei ein PDF, in das sich von außen nichts einbetten lässt.

Eine ZUGFeRD-Ausgabe verlangt daher der Reihe nach:

1. **PDF-Erzeugung im Code** — neue vendorierte Bibliothek (pdf-lib oder jsPDF), mehrere hundert KB.
2. **Das Rechnungslayout ein zweites Mal bauen**, diesmal in Zeichenbefehlen statt HTML/CSS.
   Damit existieren zwei Layouts, die auseinanderlaufen können — und das für dasselbe Dokument,
   das nach §14 UStG inhaltlich korrekt sein muss.
3. **PDF/A-3-Konformität**: eingebettetes ICC-Farbprofil, vollständig eingebettete Schriften,
   XMP-Metadaten mit der ZUGFeRD-Kennung, `AFRelationship /Alternative` am Anhang. Weder pdf-lib
   noch jsPDF liefern das fertig; es ist Handarbeit an der PDF-Struktur.
4. **Validierung** gegen einen PDF/A-3- und einen ZUGFeRD-Prüfer, sonst bleibt offen, ob das
   Ergebnis beim Empfänger überhaupt angenommen wird.

Schritt 3 ist der eigentliche Aufwand. Ein PDF, das sich ZUGFeRD nennt und die Prüfung nicht
besteht, ist **schlechter als gar kein ZUGFeRD**: der Empfänger verlässt sich darauf und bekommt
eine Datei, die seine Buchhaltung nicht einlesen kann.

## 3. Was stattdessen sofort passiert ist

- `rechnungen/js/xrechnung.js`: Kopf heißt jetzt „XRechnung-Generator (Standalone-XML)", mit
  ausdrücklichem Hinweis, dass ZUGFeRD auf der Empfangsseite unterstützt wird und warum die
  Ausgabeseite fehlt.
- `verfahrensdokumentation.html`: Export ist als XRechnung 3.0 benannt, Import nennt ZUGFeRD/
  Factur-X einschließlich der PDF-Extraktion, und der Satz „Eine eigene ZUGFeRD-*Ausgabe* als
  PDF/A-3 erzeugt Stackr nicht" steht ausdrücklich da.

Die übrigen Fundstellen (`rech-dashboard.js`, `rechnung.js`, `erechnung-import.js`) bleiben
unverändert richtig — sie sprechen von der Empfangspflicht oder vom Import.

## 4. Wann es sich lohnt

Der praktische Druck ist heute gering: die Empfangspflicht gilt seit 01.01.2025, die
**Versandpflicht** greift gestaffelt ab 2027, und für sie genügt XRechnung. Ein Empfänger, der
zwingend ZUGFeRD will, ist die Ausnahme.

Auslöser, die die Bewertung kippen würden:
- Häufung von Kundenanfragen nach einem menschenlesbaren PDF mit eingebetteter XML.
- Eine PDF-Bibliothek kommt ohnehin ins Projekt (z. B. für serverlose PDF-Erzeugung).
- Ein Großkunde oder eine Behörde macht ZUGFeRD zur Bedingung — dann zusammen mit der
  Leitweg-ID-Unterstützung (T6, bereits gebaut) als B2G-Paket.

Bis dahin gilt: XRechnung erfüllt dieselbe gesetzliche Pflicht, und die Bezeichnung im Produkt
sagt jetzt die Wahrheit.
