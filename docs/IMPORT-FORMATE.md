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
| Kodierung (CSV) | UTF-8 mit oder ohne BOM (empfohlen) oder ANSI/Windows-1252, wie Excel „CSV (Trennzeichen-getrennt)“ speichert. Stackr erkennt UTF-8 selbst; Umlaute in Spaltennamen werden dann richtig zugeordnet. |
| Meldung | Die Vorschau nennt Neu / Dubletten / übersprungen. Nach dem Import erscheint ein Ergebnisfenster mit jeder nicht importierten Zeile (Zeilennummer + Grund) und dem Knopf „Fehlerdatei (CSV) herunterladen“. |

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
| Lagerort (Bereich), Regal, Fach | nein | werden am Artikel als Lagerort gespeichert |
| Warenkategorie | nein | Freitext; neue Kategorien erscheinen danach in der Auswahlliste. „Kategorie“/„Typ“ bedeutet Artikeltyp, nicht Warenkategorie |
| Tags | nein | Komma-getrennt (`Vintage, Nike`), Doppelte und Leere entfallen |
| Notizen / Bemerkung | nein | Freitext am Artikel |
| Typ, Größe, Einkaufsquelle, Anzahl | nein | Anzahl > 1 legt mehrere Artikel an (`NR-1`, `NR-2`, …) |
| Verkaufspreis, Verkaufsdatum, Plattform, Käufer, Versand Käufer, Versand Verkäufer, Gebühr EUR (oder Plattformgebühr %) | nein | Ist ein Verkaufspreis > 0 da, gilt der Artikel als verkauft und der Verkauf wird in derselben Zeile mit angelegt. Verkaufsdatum leer = Kaufdatum. Plattform leer = „Sonstiges“. Gebühr EUR wird auf Prozent von (Preis + Versand Käufer) umgerechnet, 2 Nachkommastellen; steht auch eine Prozent-Spalte da, gilt diese. Bei Anzahl > 1 gilt Verkaufspreis für die ganze Zeile. |

**Dublette, wenn:** die Artikelnummer schon vergeben ist (auch eine stornierte Nummer; bei Anzahl > 1
auch `NR-1`) — oder, ohne Artikelnummer, Kaufdatum + Marke + Beschreibung + Größe + EK-Preis (in
Cent) mit einem nicht stornierten Artikel übereinstimmen. Hinweis: Ohne Datumsspalte zählt das Datum
aus „Gemeinsame Felder“; für den Dublettenabgleich muss es dasselbe sein wie beim ersten Import.

**Noch nicht im Modell, daher nicht importierbar (Lücke):** *Zustand* (kein Feld am Artikel; steht
im Alltag oft in den Notizen) und *Einkaufsnebenkosten* (nur `versandanteil` bei Bulk-Einkäufen).

### Einzeilen-Format und Vorlage

Ein Artikel je Zeile, Verkauf optional in derselben Zeile. Im Dialog „Excel-Import“ lädt der Link
„CSV-Vorlage herunterladen“ `stackr-lager-vorlage.csv` herunter (zwei erfundene Beispielzeilen, vor dem
Import löschen). Die Spalten, genau in dieser Schreibweise und Reihenfolge (so erkennt Stackr sie
ohne Zuordnung):

`Artikelnummer; Kaufdatum; Marke; Beschreibung; Artikeltyp; Größe; Anzahl; Einkaufspreis; Einkaufsquelle; Lagerbereich; Lagerregal; Lagerfach; Warenkategorie; Tags; Notizen; Verkaufsdatum; Verkaufspreis; Plattform; Gebühr EUR; Versand Käufer; Versand Verkäufer; Käufer`

Format: CSV, UTF-8 (mit oder ohne BOM), Semikolon als Trenner, Dezimalpunkt (`12.50`, ohne
Tausendertrenner), Datum `JJJJ-MM-TT`, Tags kommagetrennt in einer Zelle. Pflicht: `Einkaufspreis` und
`Marke` oder `Beschreibung`. Gleiche Datei erneut importieren = nur Dubletten (Artikelnummer).

### Export im Einzeilen-Format

Lager → Export → „Einzeilen-Format (.csv)“ schreibt die aktuell gefilterten Artikel in genau diese
Spalten (`Lager_Einzeilen_JJJJ-MM-TT.csv`). Die Datei lässt sich unverändert wieder über den
Excel-Import einlesen; im selben Bestand sind dann alle Zeilen Dubletten (0 neue). Regeln:

- Stornierte Artikel und stornierte Verkäufe entfallen (ein Reimport würde sie sonst als aktive Ware anlegen).
- `Anzahl` ist immer 1 (jeder Artikel hat eine eigene Zeile und Artikelnummer).
- `Gebühr EUR` = (Verkaufspreis + Versand Käufer) × Gebühr-%, auf Cent gerundet.
- Sammelverkäufe (ein Verkauf, mehrere Artikel) werden gleichmäßig auf die Artikel verteilt, der Cent-Rest geht an den ersten.
- Textzellen, die mit `=`, `+`, `-` oder `@` beginnen, bekommen ein führendes `'` (Schutz vor Formeln in Excel).
- In einen **leeren** Bestand importiert, legt die Datei alle Artikel und Verkäufe wieder an. Das Gebühr-% kann dabei um
  Rundungsreste abweichen (EUR ist auf Cent gerundet).

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

## Plattformgebühr in EUR statt Prozent

Stackr speichert die Gebühr nur als Prozent (von Verkaufspreis + Versand Käufer). Eine Angabe in EUR wird
umgerechnet und **auf 2 Nachkommastellen gerundet** gespeichert (`1,25 € / 28,90 € = 4,33 %`). Im Rückweg
(Prozent × Basis) kann deshalb **±1 Cent** Abweichung zur eingegebenen EUR-Gebühr entstehen. Ist neben EUR auch
Prozent angegeben, gilt Prozent.

| Wo | Wie |
|---|---|
| Excel-Vorlage (Daten-Import, Blatt „Verkäufe“) | optionale **letzte** Spalte „Plattformgebühr (EUR)“ (Spalte 13). Nur wirksam, wenn „Plattformgebühr (%)“ leer oder 0 ist. Ältere Vorlagen ohne die Spalte bleiben gültig. |
| Lager-Import / Einzeilen-Format | Spalte „Gebühr EUR“ (siehe oben) |
| Verkäufe-Import | Spalte „Gebühr“ ist EUR |
| Verkaufsdialoge (Buchungen, Lager, „Buchen“ im Lager) | Feld „Plattformgebühr“ mit Auswahl **% / €** |

## Einkaufs-CSV — Dialog „CSV Import“ unter Buchungen

Vorlage: Knopf „Einkauf-Template.csv“ im Dialog. Spalten (die Zuordnung im Dialog lässt sich ändern):
`Datum; Marke; Artikeltyp; Größe; Beschreibung; Einkaufspreis; Anzahl; Einkaufsquelle; Notizen`. Alte
Vorlagen bleiben importierbar. Trenner Semikolon oder Komma, auch `.xlsx`/`.xls`.

| Spalte | Pflicht | Bedeutung |
|---|---|---|
| Datum | **ja** | Kaufdatum; fehlt es oder ist es kein echter Kalendertag, wird die Zeile übersprungen (es gibt hier kein Standarddatum) |
| Einkaufspreis | **ja** | ≥ 0, Tausendertrenner erlaubt (`1.234,56`) |
| Marke **oder** Beschreibung | **ja** (mindestens eins) | |
| Artikeltyp, Größe, Einkaufsquelle, Notizen | nein | Freitext |
| Anzahl | nein | wird als Feld am Artikel gespeichert (kein Vervielfacher: eine Zeile = ein Datensatz) |

Ablauf: erster Klick auf „Importieren“ zeigt die Vorschau (neu / Dubletten / übersprungen), zweiter Klick
legt an. Wer ein Artikelnummernschema, Lagerort oder Verkaufsdaten braucht, nimmt stattdessen den
Lager-Import (Einzeilen-Format).

**Dublette, wenn:** ein nicht stornierter Einkauf mit gleichem Datum + Marke + Beschreibung + Größe +
EK-Preis (Cent) existiert (gleicher Schlüssel wie beim Lager-Import ohne Artikelnummer). Einkäufe, die
früher mit einem Rohdatum wie `08.04.2026` gespeichert wurden, erkennt der Abgleich nicht als Dublette.

**Übersprungen:** „Marke und Beschreibung fehlen“, „EK-Preis fehlt oder ist keine Zahl“, „EK-Preis ist
negativ“, „Datum fehlt oder ist ungültig“, „Periode festgeschrieben (Kaufdatum …)“.

## Ausgaben-CSV — Ausgaben → „CSV Import“

Vorlage: Knopf „Vorlage herunterladen (CSV)“ im Dialog (`stackr-ausgaben-vorlage.csv`, eine erfundene
Beispielzeile, vor dem Import löschen). Der Kopf wird an den Spaltennamen erkannt (keine Zuordnung im Dialog):
`Datum; Kategorie; Beschreibung; Betrag; USt-Satz; Beleg-Nr.; Lieferant; Notizen`. Auch der Ausgaben-CSV-Export
(ohne Lieferant/Notizen) ist importierbar. Nur CSV (Semikolon oder Komma), kein Excel.

| Spalte | Pflicht | Bedeutung |
|---|---|---|
| Datum | **ja** | echter Kalendertag |
| Kategorie | **ja** | exakt eine der Stackr-Kategorien (Groß/Klein egal): Versand, Verpackung, Plattformgebühren, Fahrtkosten, Büro, Equipment, Software/Abos, Honorare an Künstler/Publizisten, Bewirtung, Gewerbesteuer, Sonstiges. **Keine stille Zuordnung zu „Sonstiges“** |
| Betrag | **ja** | **Bruttobetrag** (inkl. USt), > 0 |
| USt-Satz | nein | `19`, `7`, `0` (auch `19%`), `rc` (Reverse Charge) oder `unklar`. Leer = `unklar` (wie im Formular, nie automatisch 19 %). Andere Sätze (`16`, Text) = Zeile übersprungen |
| Beschreibung, Lieferant, Notizen | nein | Freitext |
| Beleg-Nr. | nein | siehe Dublettenschutz |

Nicht per CSV importierbar (Zeile übersprungen, im Formular erfassen): **Geschenke an Geschäftsfreunde**
(Empfänger ist Pflicht, §4 Abs. 7 EStG) und **Umsatzsteuer an Finanzamt / -Erstattung vom Finanzamt**
(Zeitraum, Zehn-Tage-Regel). Bewirtung, Gewerbesteuer und Privatanteil-Regeln wirken wie bei manuell
erfassten Ausgaben in der EÜR; ein Privatanteil lässt sich per CSV nicht setzen.

**Dublette, wenn:** mit Beleg-Nr. — eine nicht stornierte Ausgabe mit derselben Beleg-Nr. existiert (Groß/Klein
egal, Betrag egal); gleiche Beleg-Nr. mehrfach in der Datei wird durchgezählt (ein Beleg mit zwei Zeilen
bleibt beim Reimport erkennbar). Ohne Beleg-Nr. — Datum + Betrag (Cent) + Beschreibung + Lieferant stimmen
überein. Hinweis: Zwei verschiedene Lieferanten mit gleicher Rechnungsnummer gelten als Dublette; in dem Fall
die Beleg-Nr. mit dem Lieferantenkürzel versehen.

**Übersprungen:** „Datum fehlt oder ist ungültig“, „Kategorie fehlt“, „Unbekannte Kategorie …“, „Kategorie … nicht
per CSV importierbar“, „Betrag fehlt oder ist keine Zahl“, „Betrag muss größer 0 sein“, „Unzulässiger USt-Satz …“,
„Periode festgeschrieben (Datum …)“. Fehlt eine Pflichtspalte im Kopf, meldet der Dialog das und importiert nichts.

## Eigenbeleg-CSV — Eigenbelege → Alle Eigenbelege → „CSV importieren“

Vorlage: Knopf „Vorlage herunterladen (CSV)“ im Dialog (`stackr-eigenbelege-vorlage.csv`, eine erfundene
Beispielzeile, vor dem Import löschen). Der Kopf wird an den Spaltennamen erkannt:
`Datum; Zweck; Betrag brutto; MwSt-Satz; Begründung; Verkäufer; Kategorie; Zahlungsweg; Notizen`. Nur CSV
(Semikolon oder Komma).

| Spalte | Pflicht | Bedeutung |
|---|---|---|
| Datum | **ja** | echter Kalendertag |
| Zweck | **ja** | betriebliche Veranlassung |
| Betrag brutto | **ja** | > 0 |
| MwSt-Satz | **ja** | `0`, `7` oder `19` (auch `19%`); andere Werte = Zeile übersprungen |
| Begründung | **ja** | Kennung oder Name: `verloren`, `nicht_ausgehaendigt`, `barzahlung_flohmarkt`, `onlinekauf`, `unleserlich`, `verloren_ust_rekonstruiert`, `sonstiges` |
| Verkäufer | nein | leer = im Beleg noch ausfüllen (das Bearbeiten-Formular verlangt ihn) |
| Kategorie | nein | Kennung oder Name einer Eigenbeleg-Kategorie (z. B. `fahrtkosten`); leer = noch zu wählen; unbekannt = Zeile übersprungen |
| Zahlungsweg | nein | `bar`, `ec`, `kreditkarte`, `paypal`, `ueberweisung`, `klarna`, `sonstiges` (oder der Anzeigename); leer = `sonstiges` |
| Notizen | nein | Freitext |

**Importierte Belege sind unbestätigt** (`bestaetigt: false`): Liste zeigt das Etikett „Unbestätigt“, sie zählen
**nicht** in EÜR, DATEV-Stapel, DATEV-Belegarchiv und in den Summen der Eigenbeleg-Seite, bis jemand in der
Liste auf „Bestätigen“ klickt (Audit-Eintrag, nicht in festgeschriebenen Perioden; das Z3-Protokoll
`eigenbelege.csv` listet sie weiter). Ein Vorsteuerabzug wird per CSV nie gesetzt, Warenpositionen entstehen
nicht (kein Lager-Eintrag). Bestehende Belege ohne das Feld gelten wie bisher als bestätigt.

Nummer: `<Präfix>-<JJJJ>-<NNN>` wie im Formular (nächste freie Nummer), vergeben erst beim Import, nicht in der
Vorschau; abgewählte Dubletten und übersprungene Zeilen verbrauchen keine Nummer. Gespeichert wird in die
**aktive Firma**; stimmen die beiden Firmenquellen der App nicht überein, bricht der Dialog ab.

**Dublette, wenn:** ein nicht stornierter Beleg mit gleichem Datum + Betrag brutto (Cent) + Zweck existiert;
gleiche Zeilen in einer Datei werden durchgezählt (`#1`, `#2`).

**Übersprungen:** „Datum fehlt oder ist ungültig“, „Zweck fehlt“, „Betrag brutto fehlt oder ist keine Zahl“,
„Betrag brutto muss größer 0 sein“, „MwSt-Satz fehlt oder ist keine Zahl“, „Unzulässiger MwSt-Satz …“,
„Begründung fehlt“, „Unbekannte Begründung …“, „Unbekannte Kategorie …“, „Unbekannter Zahlungsweg …“,
„Periode festgeschrieben (Belegdatum …)“. Fehlt eine Pflichtspalte im Kopf, importiert der Dialog nichts.

## Festgeschriebene Perioden (GoBD)

Zeilen, deren Datum in einer festgeschriebenen Periode liegt (USt-Voranmeldung eingereicht oder
Jahr abgeschlossen), werden **übersprungen** mit dem Grund „Periode festgeschrieben“. Beim Lager-Import
mit Verkaufsspalten zählt auch das Verkaufsdatum. Beim Verkäufe-Import gilt
(Entscheidung des Users, 2026-11-25): Liegt der **Einkauf** in einer festgeschriebenen Periode, der Verkauf aber
in einer offenen, setzt der Import den Lagerstatus des Artikels trotzdem auf „verkauft“. Nur der Status ändert
sich (Betrag, Datum und alle anderen Felder des Einkaufs bleiben), und das Änderungsprotokoll vermerkt den
Statuswechsel mit dem Hinweis auf die festgeschriebene Periode. Bei **stornierten, gegengebuchten oder manuell
gesperrten** Einkäufen bleibt der Status unverändert; der Verkauf selbst wird gebucht und die Vorschau weist darauf
hin. Liegt der Verkauf selbst in einer festgeschriebenen Periode, wird die Zeile übersprungen.

## Übersprungene Zeilen

| Grund | Import |
|---|---|
| EK-Preis fehlt oder ist keine Zahl / ist negativ | Lager |
| Marke und Beschreibung fehlen | Lager |
| Datum fehlt oder ist ungültig / Preis fehlt, ist 0 oder keine Zahl | Verkäufe |
| Periode festgeschrieben (Kaufdatum / Verkaufsdatum …) | beide |
| Datum fehlt oder ist ungültig | Einkaufs-CSV (Buchungen), Ausgaben-CSV |
| Unbekannte Kategorie / Unzulässiger USt-Satz / Betrag muss größer 0 sein | Ausgaben-CSV |
| Zweck/Begründung/MwSt-Satz fehlen oder unzulässig, Unbekannte Begründung/Kategorie/Zahlungsweg | Eigenbeleg-CSV |

**Fehlerdatei** (`import-fehler.csv`): UTF-8 mit BOM, Semikolon, Kopfzeile `Zeile;Grund`, eine Zeile je
nicht importierter Zeile. Enthält auch abgewählte Dubletten (Grund beginnt mit „Dublette:“). Die
korrigierte Datei kann direkt erneut importiert werden; bereits angelegte Zeilen erkennt der
Dublettenschutz.
