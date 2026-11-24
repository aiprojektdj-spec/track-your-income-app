# Import- und Exportformate

Einzige Quelle für Kurs und KI-Automatisierung: welche Datei Stackr wie liest, welche Spalten
Pflicht sind, wie Dubletten erkannt werden und warum Zeilen übersprungen werden.
Stackr selbst bindet keine KI an (Regel 12); die Dateien sind die Schnittstelle.

Gilt für alle Importe: **Zeilennummern in Meldungen = Zeilennummer in der Datei** (Kopfzeile = 1,
leere Zeilen mitgezählt). Code: `js/import-kern.js` (Parser), `js/import-lager.js` (Prüfung).

## Gemeinsame Regeln (js/import-kern.js)

| Thema | Regel |
|---|---|
| Zahlen | `1.234,56`, `1,234.56`, `12,50 €`, `12.5`, `-3,20`. Sind beide Trenner da, ist der letzte der Dezimaltrenner. **Ein einzelner Punkt ist immer Dezimalpunkt:** `1.234` = 1,234, nicht 1234. Tausendertrenner daher nur zusammen mit Dezimalstellen schreiben. Leer/ungültig = 0 bzw. Fehler (je nach Pflichtfeld). |
| Datum | `2026-11-24`, `24.11.2026`, `24/11/2026`, `24.11.26`, Excel-Seriennummer (z. B. `46164`), Zellen mit Datumsformat. Ist ein Teil größer als 12, ist er der Tag (`11/24/2026` = 24.11.). Mehrdeutig (`01.02.2026`) gilt Tag.Monat. Es muss ein echter Kalendertag sein (`31.02.` = ungültig). **Empfohlen für Automatisierung: `JJJJ-MM-TT`.** |
| Dateien | `.xlsx`, `.xls`, `.csv`. Bei mehreren Blättern wählt Stackr das Datenblatt, im Dialog umschaltbar. Spaltenüberschriften werden automatisch zugeordnet (deutsch/englisch) und lassen sich im Dialog ändern. |
| Fehlerdatei | Siehe unten „Übersprungene Zeilen“. |

## Dublettenschutz

Beim Import gleicht Stackr jede Zeile mit dem **vorhandenen Bestand** ab (kein eigenes Register).
Dubletten werden in der Vorschau aufgelistet, sind **vorab abgewählt** und werden nicht importiert.
Wer sie doch will, setzt den Haken in der Liste. Dieselbe Datei zweimal importieren legt
deshalb nichts doppelt an.

Normalisiert wird mit Kleinschreibung und zusammengezogenen Leerzeichen. Gleiche Zeilen innerhalb
einer Datei werden durchgezählt (`#1`, `#2`): ist im Bestand schon eine davon, gilt nur die erste als
Dublette, die zweite ist neu.

## Lager-Import (Einkäufe) — Dialog „Excel-Import“ im Lager

| Spalte (Feld) | Pflicht | Bedeutung |
|---|---|---|
| EK / EK-Preis / Einkaufspreis | **ja** | Einkaufspreis je Stück, ≥ 0 |
| Marke **oder** Beschreibung | **ja** (mindestens eins) | |
| Kaufdatum / Datum | nein | leer oder ungültig = das Datum aus „Gemeinsame Felder“ (keine Fehlermeldung) |
| Artikelnummer | nein | eigene Nummer; leer = automatisch `JJJJ-NNN` |
| Typ, Größe, Einkaufsquelle, Anzahl | nein | Anzahl > 1 legt mehrere Artikel an (`NR-1`, `NR-2`, …) |
| Verkaufspreis, Verkaufsdatum, Verkauft an, Versand Käufer, Versandkosten, Plattformgebühr % | nein | Ist ein Verkaufspreis > 0 da, gilt der Artikel als verkauft und der Verkauf wird mit angelegt |

**Dublette, wenn:** die Artikelnummer schon vergeben ist (auch eine stornierte Nummer; bei Anzahl > 1
auch `NR-1`) — oder, ohne Artikelnummer, Kaufdatum + Marke + Beschreibung + Größe + EK-Preis (in
Cent) mit einem nicht stornierten Artikel übereinstimmen. Hinweis: Ohne Datumsspalte zählt das Datum
aus „Gemeinsame Felder“; für den Dublettenabgleich muss es dasselbe sein wie beim ersten Import.

## Verkäufe-Import — Dialog „Verkäufe-Import (CSV)“

| Spalte (Feld) | Pflicht | Bedeutung |
|---|---|---|
| Datum | **ja** | Verkaufsdatum |
| Preis | **ja** | Verkaufspreis, muss > 0 sein |
| Titel / Artikel / Beschreibung | nein | steht darin eine Artikelnummer aus dem Lager (`2026-042` oder eigene wie `SV-1042`), wird der Verkauf dem Artikel zugeordnet und dieser auf „verkauft“ gesetzt |
| Gebühr (€) | nein | wird in Prozent vom Preis plus Versand Käufer umgerechnet (2 Nachkommastellen) |
| Versand Käufer, Versand Verkäufer, Käufer | nein | |

Die Plattform wählt man im Dialog (Vinted, eBay, Mercari, Etsy, Depop, Sonstige).

**Dublette, wenn:** ein nicht stornierter Verkauf mit gleichem Datum, gleichem Preis (Cent), gleicher
Plattform und gleichem Titel existiert. Bei einer Zuordnung zum Lager zählt statt des Titels die
Artikelnummer des Artikels.

## Festgeschriebene Perioden (GoBD)

Zeilen, deren Datum in einer festgeschriebenen Periode liegt (USt-Voranmeldung eingereicht oder
Jahr abgeschlossen), werden **übersprungen** mit dem Grund „Periode festgeschrieben“. Beim Lager-Import
mit Verkaufsspalten zählt auch das Verkaufsdatum. Beim Verkäufe-Import wird der Status eines
**festgeschriebenen oder stornierten** Lager-Artikels nicht auf „verkauft“ geändert; der Verkauf
selbst wird gebucht und die Vorschau weist darauf hin.

## Übersprungene Zeilen

| Grund | Import |
|---|---|
| EK-Preis fehlt oder ist keine Zahl / ist negativ | Lager |
| Marke und Beschreibung fehlen | Lager |
| Datum fehlt oder ist ungültig / Preis fehlt, ist 0 oder keine Zahl | Verkäufe |
| Periode festgeschrieben (Kaufdatum / Verkaufsdatum …) | beide |
