# OCR-Belegerkennung im Browser — Spezifikation (2026-08-12)

**Fund:** G4 aus [`funde-audit-03-feature-gap-2026-08-10.md`](funde-audit-03-feature-gap-2026-08-10.md)
**Entscheidung des Betreibers (2026-08-12):** bauen — erst diese Spezifikation, dann der Code.
**Status:** Spezifikation fertig · **Freigabe erteilt** (Abschnitt 7) · Umsetzung offen, auf eigene Session vertagt

---

## 1. Warum überhaupt, und warum im Browser

sevDesk und Lexware lesen hochgeladene Belege automatisch aus und schlagen Datum, Betrag und
Lieferant vor. Stackr lässt den Nutzer alles tippen. Das ist der spürbarste Automatisierungs-
Rückstand des Produkts.

Der übliche Weg — Bild an einen OCR-Dienst schicken — ist hier **ausgeschlossen**: er würde
Belegbilder an einen fremden Server geben und damit das zentrale Versprechen brechen, dass Daten
das Gerät nicht verlassen. Cloud-Sync ist Ende-zu-Ende-verschlüsselt, der Server sieht nie
Klardaten; ein OCR-Endpunkt wäre die einzige Stelle, an der er es täte.

**Browser-OCR ist deshalb nicht die billigere, sondern die einzige mit der Architektur
verträgliche Variante.** Sie ist zugleich eine Aussage, die kein Wettbewerber machen kann:
Belegerkennung, bei der der Beleg das Gerät nie verlässt.

## 2. Bibliothek

| | |
|---|---|
| Paket | `tesseract.js` |
| Version | **7.0.0** (Stand 2026-08-12) |
| WASM-Kern | `tesseract.js-core` **6.1.2** — Major-Versionen müssen zusammenpassen |
| Lizenz | Apache-2.0 |
| Bezug | `https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/` bzw. `tesseract.js-core@6.1.2/` |

Bezogen wird **einmalig zum Vendorieren**, nicht zur Laufzeit. Laufzeit-Nachladen von einem CDN
scheidet aus zwei Gründen aus: es widerspricht der Local-First-Zusage (jeder OCR-Lauf würde dem
CDN verraten, dass gerade ein Beleg verarbeitet wird), und `connect-src` müsste dafür geöffnet
werden.

## 3. Was vendoriert werden muss

`tesseract.js` lädt zur Laufzeit drei getrennte Dinge nach. Alle drei müssen unter `js/vendor/`
liegen und über `workerPath` / `corePath` / `langPath` umgebogen werden.

| Datei | Zweck | Größenordnung |
|---|---|---|
| `worker.min.js` | Worker-Skript | klein |
| `tesseract-core-simd-lstm.wasm.js` | WASM-Kern, SIMD + LSTM | mehrere MB |
| `tesseract-core-lstm.wasm.js` | Fallback ohne SIMD | mehrere MB |
| `deu.traineddata.gz` | deutsches Sprachmodell (`tessdata_fast`) | ~1 MB |
| `eng.traineddata.gz` | englisch, nur falls die EN-Oberfläche es bekommen soll | ~1 MB |

**Bewusst nur zwei der vier Kern-Varianten.** Die Dokumentation nennt vier Dateien
(`…-core.wasm.js`, `…-core-simd.wasm.js`, `…-core-lstm.wasm.js`, `…-core-simd-lstm.wasm.js`).
Die beiden Nicht-LSTM-Varianten sind die alte Tesseract-3-Engine; für Belegerkennung wird nur
LSTM gebraucht. Das halbiert den Vendor-Umfang.

**`tessdata_fast`, nicht `tessdata_best`.** `best` ist rund 10× so groß bei einem Genauigkeits-
gewinn, der bei Kassenbons — Fixed-Pitch-Schrift, wenig Layout — nicht ins Gewicht fällt.

Jede Datei bekommt einen Eintrag in `js/vendor/VERSIONS.md` mit SHA-256, so wie es nach dem
SheetJS-Fund (S2) eingeführt wurde. `.gitattributes` führt `js/vendor/*` bereits mit `-text`,
die Hashes überleben den Checkout also.

## 4. Der Preis: CSP

**Das ist der Punkt, an dem diese Spezifikation eine Entscheidung braucht, keine Umsetzung.**

Die aktuelle CSP (`vercel.json`, 14 Routen, plus Meta-Tag je HTML) ist das Ergebnis von drei
Härtungsphasen und enthält heute:

```
script-src 'self' https://cdn.jsdelivr.net; script-src-attr 'none'
```

Kein `unsafe-eval`, kein `unsafe-inline` im Skript-Kontext. Genau das ist der Grund, warum der
Red-Team-Lauf keinen ausnutzbaren XSS-Pfad gefunden hat.

WebAssembly kompiliert in Chromium-Browsern nur, wenn `script-src` **`'wasm-unsafe-eval'`**
enthält. Zusätzlich braucht der Worker `worker-src 'self'` (bzw. `blob:`, je nachdem wie
`tesseract.js` den Worker startet — vor der Umsetzung am echten Build zu prüfen, nicht zu raten).

`'wasm-unsafe-eval'` ist deutlich enger als `'unsafe-eval'`: es erlaubt **nur** das Kompilieren
von WebAssembly, nicht `eval()` oder `new Function()` auf JavaScript. Ein Angreifer mit einer
XSS-Lücke gewinnt dadurch keine neue Fähigkeit, die er nicht ohnehin hätte. Trotzdem ist es eine
Aufweichung einer bewusst harten Einstellung, und sie gilt dann für die ganze Route.

**Minimierung:** Die Direktive nur auf den Routen setzen, die OCR wirklich anbieten — nach
heutigem Stand `/eigenbelege` und `/app.html`. Landing, Rechtstexte und `/api/*` bleiben
unverändert.

## 5. Funktionsumfang v1

Bewusst klein, weil OCR-Ergebnisse bei Kassenbons schwanken und ein falsch vorbefülltes Feld
schlimmer ist als ein leeres.

**Was es tut**
- Im Eigenbeleg-Formular ein zusätzlicher Weg neben dem Foto-Upload: „Beleg auslesen".
- Läuft ausschließlich auf einem Bild, das der Nutzer selbst ausgewählt hat.
- Erkennt und **schlägt vor**: Datum, Bruttobetrag, Händlername.
- Jeder Vorschlag erscheint als anklickbarer Chip über dem jeweiligen Feld, mit dem erkannten
  Rohtext daneben. Nichts wird automatisch eingetragen.
- Fortschrittsanzeige, weil ein Durchlauf auf einem Mittelklasse-Gerät mehrere Sekunden dauert.

**Was es nicht tut**
- Keine automatische Kategorisierung (das ist eine Bewertungsfrage, keine Erkennungsfrage).
- Keine Positionserkennung (Einzelposten eines Bons) — dafür reicht die Genauigkeit nicht.
- Keine Verarbeitung ohne ausdrückliche Nutzeraktion, insbesondere kein Lauf beim bloßen Upload.
- **Keine Rolle im Pflichtpfad.** Ein Eigenbeleg lässt sich unverändert vollständig von Hand
  erfassen; fällt OCR aus, ändert sich für den Nutzer nichts.

**Extraktionsregeln** (deutschsprachige Belege)

| Feld | Regel |
|---|---|
| Datum | erstes Vorkommen von `TT.MM.JJJJ` oder `TT.MM.JJ`; bei mehreren das früheste, weil Bons oft ein späteres Druckdatum tragen. Findet sich keins, `JJJJ-MM-TT` aus dem Fiskalblock, siehe 5d |
| Betrag | Zeile mit `SUMME`, `GESAMT`, `TOTAL`, `ZU ZAHLEN` bevorzugt — **außer Zwischenständen** (`ZWISCHENSUMME`, `SUBTOTAL`, `ÜBERTRAG`), siehe 5b; sonst der größte gefundene Betrag mit zwei Nachkommastellen. Danach die **Konsens-Gegenprobe**, siehe 5a |
| Händler | erste Zeile mit mindestens drei Buchstaben, die keine Adressfloskel ist. Eine einzelne Zahl darf sie tragen („Cafe 1900"), unter drei Grenzen — siehe 5d |

Alle drei Regeln sind Heuristiken und gehören in eine eigene, testbare Funktion — dieselbe
Trennung wie beim Zahlungsabgleich (G3), wo die Zuordnungslogik ohne Browser prüfbar ist.

### 5a. Konsens-Gegenprobe beim Betrag — nachgetragen 2026-08-30

**Der Anlass ist gemessen, nicht ausgedacht.** Beim ersten Lauf an einem echten Bon
(Bauhaus, 06.07.2026, 85,90 €; Protokoll in [`live-tests-checkliste.md`](live-tests-checkliste.md),
Punkt 7) las die Erkennung die Summenzeile so:

```
SUMME [2 EUR 785,90        ← richtig wäre: SUMME [2]  EUR  85,90
```

Die schließende Klammer wurde als `7` gelesen und klebte am Betrag. **Beide bisherigen Regeln
liefern hier denselben falschen Wert:** die Schlüsselwortzeile, weil `785,90` der einzige Betrag
darin ist — und der Rückfall „größter Betrag" ebenfalls, weil die verunglückte Zeile stehen
bleibt und `785,90` damit der größte Betrag des ganzen Bons ist. Am Code gegengeprüft: zerstört
man das Schlüsselwort künstlich (`SUMME`→`SUHME`), kommt weiterhin `785,90` heraus. Es gab also
kein Sicherheitsnetz unter der Schlüsselwortregel.

Dass der Fehler **nach oben** geht, macht ihn teuer: übernommen wären das 700 € zu viel
Betriebsausgabe und 111,72 € zu viel Vorsteuer.

**Die Regel.** Der Gewinner wird verworfen zugunsten eines Kandidaten, wenn **alle vier**
Bedingungen zutreffen:

1. Der Gewinner kommt im ganzen Bon **genau einmal** vor.
2. Der Kandidat kommt **mindestens zweimal** vor.
3. Der Kandidat ist ein Ziffern-Suffix des Gewinners, und der weggefallene Präfix ist
   **genau eine Ziffer** (`85,90` in `785,90`). Verglichen wird auf der Ziffernform, also ohne
   Tausendertrenner und mit vereinheitlichtem Dezimalzeichen.
4. Der Kandidat steht mindestens einmal auf einer Zeile mit einem **Bestätigungswort**
   (`BETRAG`, `BRUTTO`, `SUMME`, `GESAMT`, `TOTAL`, `ZU ZAHLEN`, `ENDBETRAG`,
   `RECHNUNGSBETRAG`, `ZAHLBETRAG`) — und **nicht** auf einer Zeile, die einen
   **Teilbetrag** ausweist (`RABATT`, `NETTO`, `MWST`, `UST`, `STEUER`, `TRINKGELD`,
   `PFAND`, `ZWISCHENSUMME`, `ANZAHLUNG`, `GUTSCHEIN`).

**Warum vier Bedingungen und nicht zwei.** Ohne Bedingung 4 wäre die Regel gefährlich: ein Bon
mit zwei Posten zu `5,90` und einer Summe von `85,90`, die nur einmal dasteht, würde
fälschlich **nach unten** korrigiert — aus einem Erkennungsfehler würde ein Rechenfehler. Das
Bestätigungswort verlangt, dass der Kandidat selbst irgendwo als Endbetrag auftritt, nicht bloß
als Postenpreis. Auf dem Bauhaus-Bon trägt ihn die Zeile `Betrag EUR 85,90`.

`BAR` und `GEGEBEN` stehen bewusst **nicht** in der Liste: auf einem Barbon ist „Gegeben 50,00"
genau der Betrag, der nicht gewinnen soll — er als Bestätigungswort zuzulassen hieße, die
bestehende Regel von hinten aufzuheben.

**Warum Bedingung 4 zweiteilig ist — nachgetragen am selben Tag.** Die erste Fassung prüfte
bloß `/betrag|brutto|…/`. Eine Parallel-Session fand die Lücke: das trifft auch
**`Rabattbetrag`** und **`Nettobetrag`**. Dann bestätigt ausgerechnet eine Teilbetragszeile
einen Kandidaten als Endbetrag — und die Sicherung, die diese ganze Regel ungefährlich macht,
fällt aus. Reproduziert: neben `Rabattbetrag 5,90` wurde eine **korrekt gelesene**
`SUMME 85,90` auf `5,90` heruntergezogen. Die Fehlerrichtung ist diesmal nach unten, und
schlimmer noch: die Korrektur überschreibt einen Wert, der nie falsch war.

Eine Wortgrenze (`\b`) vorn ist die halbe Antwort — sie wirft `Rabattbetrag`, `Nettobetrag`
und `Steuerbetrag` hinaus, **aber nicht `MwSt-Betrag`**: ein Bindestrich *ist* eine Wortgrenze.
Und sie nimmt `Rechnungsbetrag` und `Zahlbetrag` mit, die echte Endbeträge sind. Deshalb beides:
Wortgrenze plus die beiden Komposita einzeln in der Liste, plus ein eigener Ausschluss für
Teilbetragszeilen, der unabhängig von der Wortzusammensetzung greift. An sechzehn Zeilen
gemessen, alle sechzehn richtig eingeordnet.

**Die Korrektur wird nicht verschwiegen.** Greift sie, trägt der Treffer zusätzlich fest, was
ursprünglich dastand; der Chip zeigt beides. Eine stille Korrektur wäre wieder ein Raten, und
der Leitsatz der Funktion bleibt: ein falsch vorbefülltes Feld ist schlimmer als ein leeres.

**Was sie nicht kann.** Steht der wahre Betrag nur ein einziges Mal auf dem Bon, greift nichts —
dann fehlt der Konsens, aus dem die Regel ihren Namen hat. Der Fall bleibt offen und ist der
Grund, warum eine Trefferquote weiterhin mehr als einen Bon braucht.

### 5b. Zwischenstände gehören nicht in den Summenpool — nachgetragen 2026-08-31

Eine Parallel-Session meldete es und korrigierte damit ihre eigene frühere Entwarnung.
`RE_SUMMENZEILE` verlangt keine Wortgrenze, `/summe/` trifft also auch **`Zwischensumme`** —
sie landete im selben Pool wie die echte Summe. **Solange nichts abgezogen wird, fällt das
nicht auf:** beide Beträge sind dann gleich groß, und genau so steht es im Bestandstest
(Tankstelle, `Zwischensumme 77,38` / `GESAMT 77,38`). Sobald ein Rabatt, Gutschein oder
Pfandabzug dazwischensteht, ist der Zwischenstand **größer** als der Endbetrag — und aus dem
Pool gewinnt der größte:

```
Zwischensumme 100,00 / Rabatt -14,10 / SUMME 85,90   ->  100,00
```

Reproduziert. Wieder die teure Fehlerrichtung nach oben, wie beim gemessenen Bon.

Ausgeschlossen wird über eine **eigene, enge Liste** (`ZWISCHENSUMME`, `ZWISCHEN SUMME`,
`SUBTOTAL`, `ÜBERTRAG`) und ausdrücklich **nicht** über den Teilbetrags-Ausschluss aus 5a:
dort stehen auch `NETTO` und `MWST`, und **`Summe inkl. MwSt` ist eine völlig normale
Endbetragszeile**, die im Pool bleiben muss. Am Code gegengeprüft — mit dem breiten Ausschluss
wären `SUMME inkl. MwSt`, `GESAMT inkl. 19% MwSt` und `Summe einschl. USt` allesamt
herausgefallen.

Der Zwischenstand verschwindet nicht aus der Betrachtung, er verliert nur seinen Vorrang:
bleibt keine echte Summenzeile übrig, greift wie bisher der Rückfall.

**Drei weitere Fehler der Betragsregel sind am 2026-08-30 bestätigt** — Summenzeile mit Umbruch,
verlorenes Minus bei Retouren, Uhrzeit mit Punkt. Alle drei sitzen im Rückfallpfad und irren
ebenfalls nach oben; die Gegenprobe fängt keinen davon. Reproduktion und Lösungsrichtungen in
[`funde-betragsregel-2026-08-30.md`](funde-betragsregel-2026-08-30.md). **Alle drei sind
inzwischen geschlossen: Fund 2 und 3 am 2026-09-03 (5c), Fund 1 am 2026-09-04 (5e).**

### 5c. Was kein Betrag ist: Vorzeichen und Uhrzeit — nachgetragen 2026-09-03

Zwei der drei offenen Funde ließen sich schließen, **ohne eine ratende Regel hinzuzufügen** — und
das war die Bedingung, unter der sie überhaupt angefasst wurden. Beide Eingriffe sagen nur, was
*kein* Betrag ist; keiner von beiden wählt zwischen Kandidaten aus. Genau darin unterscheiden sie
sich von Fund 1.

**Vorzeichen (Fund 2).** `RE_BETRAG` verlangt vor der Zahl ein Nicht-Ziffer-Zeichen und
verschluckte das Minus dabei: aus `-49,99` wurde `49,99`, aus einer Erstattung eine Ausgabe.
Erkannt wird jetzt ein **direkt anliegendes** Minus, vorn oder hinten — `49,99-` ist im deutschen
Kassendruck üblich. Ein Bindestrich mit Leerzeichen drumherum (`Posten A - 12,50`) bleibt ein
Trennstrich; dafür steht eine Gegenprobe im Test.

Negative Beträge kommen anschließend **gar nicht erst in die Auswahl**, weil der Bruttobetrag
eines Eigenbelegs nie negativ ist. Das schließt zwei Fälle mit einem Griff:

| Fall | vorher | jetzt |
|---|---|---|
| `Posten 9,99` / `Rabatt -14,10`, keine Summenzeile | `14,10` — der Abzug gewinnt den Rückfall | `9,99` |
| Retoure, deren Summenzeile nur `-49,99` trägt | `49,99` als Ausgabe | **kein Vorschlag** |

Der zweite Fall ist Absicht und kein Notbehelf: bei einer Retoure ist die richtige Antwort kein
Vorschlag. Ein Vorzeichenfehler ist beim Klicken eines Chips nicht zu bemerken — die Zahl stimmt
ja, nur ihre Richtung nicht. Der Eigenbeleg lässt sich von Hand erfassen wie eh und je.

> Die Rabattzeile im Rückfall war in der Fundliste nicht aufgeführt; sie fiel am 2026-09-03 bei
> einem systematischen Durchgang durch realistische Bonformen auf. Dieselbe Familie, dieselbe
> Richtung — und sie trifft jeden Bon mit Rabatt, auf dem die Summenzeile nicht erkannt wird.

**Uhrzeit (Fund 3).** `07.45` hat zwei Nachkommastellen und nichts dahinter, ist also formal ein
Betrag; die Datumsabwehr greift nicht, weil eine Uhrzeit keinen dritten Teil hat. Im Rückfall
schlug sie jeden Bon unter 24 Euro. Verworfen wird sie nur, wenn **die Zeile sie ankündigt**
(`Uhrzeit`, `Uhr`, `Zeit`) und die beiden Teile als Zeit durchgehen. `Kaffee 7.45` bleibt damit
ein Betrag, `Zeit 99.99` ebenfalls — beides steht als Gegenprobe im Test.

**Fund 1 bleibt offen, und das ist kein Versehen.** Eine `SUMME`-Zeile ohne eigenen Betrag müsste
man mit der oder den nächsten Zeilen zusammenlesen — das ist eine Regel, die *rät*, welcher Betrag
gemeint war. Sie gehört an einen Rückfallpfad, der in einem Stück umgebaut wird, und dafür braucht
es mehr als einen gemessenen Bon.

### 5d. Datum aus dem Fiskalblock, Händlername mit Ziffer — nachgetragen 2026-09-03

Beide Lücken stammen aus demselben systematischen Durchgang wie 5c. Sie betreffen nicht den
Betrag, sondern die beiden anderen Felder, und in beiden Fällen lieferte die Regel bisher
**gar nichts** — der Fehler war eine Lücke, kein falscher Wert.

**Datum: `JJJJ-MM-TT` als Rückfall.** Seit der Kassensicherungsverordnung trägt jeder deutsche
Bon einen Fiskalblock, und der druckt seine Zeitstempel in ISO 8601. Auf dem gemessenen Bon war
das neben der Fußleiste die **einzige unversehrte Datumsangabe**: die eigentliche Datumszeile kam
als `Datuenı Aa 0 o607.2026` aus der Erkennung, der Punkt zwischen Tag und Monat war weg. Ein
Format, das auf jedem Bon steht und das die Erkennung selten zerlegt, ist der natürliche letzte
Anker.

**Nur als Rückfall, nicht gleichberechtigt** — und das ist die eigentliche Entscheidung: der
Fiskalstempel steht in **UTC**. Ein Kauf um 00:30 Ortszeit trägt dort noch den Vortag, und die
Früheste-Regel würde diesen Vortag dem richtigen Datum vorziehen. Solange eine Punktangabe
existiert, ist sie die lokale und damit die richtige. Es gibt dafür eine eigene Prüfung.

`06/07/2026` und `06-07-2026` bleiben **bewusst unerkannt**: in dieser Schreibweise ist nicht
entscheidbar, ob Tag oder Monat vorn steht — dieselbe Zeichenfolge heißt in Deutschland der
6. Juli und in den USA der 7. Juni. Ein stillschweigend falsches Datum ist schlimmer als keins.
Bei ISO stellt sich die Frage nicht, das Format definiert die Reihenfolge.

**Händler: eine Ziffer ist erlaubt.** Die Regel verwarf jede Zeile mit einer Zahl — und damit
`Cafe 1900`, `Shell 4711`, `Kiosk 24`. Ein Fehlgriff ist beim Verkäufer außerdem billiger als
beim Betrag: er fällt beim Hinsehen auf, während eine falsche Zahl plausibel aussieht. Drei
Grenzen verhindern, dass stattdessen die Adresse gewinnt:

| Grenze | schließt aus |
|---|---|
| Zeile beginnt mit einer Ziffer | `587 RAVENSBURG`, `88212 Ravensburg` |
| mehr als eine Zifferngruppe | `Kontakt Center: 0621 3905-1000`, `SF OFENSCMERST 85,90 C` |
| Ziffernfolge ab fünf Stellen | `Art/EAN 4024506316768` |

Dazu kamen Kassen- und Fiskalwörter in die Floskelliste (`Kasse`, `Bed.`, `Terminal`, `Trace`,
`EAN`, `Art.-Nr`, `TSE`, `Datum`, `Uhrzeit`, `Signatur`) — die hatte vorher die Ziffer selbst
ausgeschlossen.

**Gegengeprüft am echten Bon:** von seinen 53 Rohtextzeilen akzeptiert die gelockerte Regel 17,
und die erste davon ist weiterhin die richtige Namenszeile. Keine Adress-, Telefon-, PLZ-, EAN-
oder Betragszeile ist darunter; neu hinzugekommen sind nur zwei Rauschzeilen tief im Bon
(`Bankarbeitstag. 5`), die den Kopf nie überholen können.

**Nicht geändert: `1 234,56` mit Leerzeichen** wird weiterhin als `234,56` gelesen. Der Fix wäre
einfach und trotzdem falsch: `3 250,00` — Menge und Preis in zwei Spalten, auf Bons alltäglich —
würde dann zu `3250,00`. Die heutige Lesart irrt **nach unten**, die Reparatur würde **nach oben**
irren, und das ist die teure Richtung. Ohne einen Weg, beide Fälle zu unterscheiden, bleibt es
wie es ist.

### 5e. Zahlungszeilen gehören nicht in den Rückfall — nachgetragen 2026-09-04

Fund 1, der letzte der drei und laut Fundliste „der teuerste": auf schmalen Thermobons bricht
die Summenzeile um.

```
2 x Kaffee      7,98
SUMME
        12,47          ← der Betrag steht eine Zeile tiefer
Geg. BAR  20,00
Rueck      7,53
```

`ausSummenzeilen` bleibt leer, weil die `SUMME`-Zeile selbst keinen Betrag trägt; es fällt auf
„größter Betrag" zurück, und **das hingelegte Bargeld ist fast immer größer als die Summe**.
Ergebnis `20,00` statt `12,47` — und ausgerechnet der Fall, für den die Summenregel gebaut wurde,
war damit ausgehebelt.

**Gelöst, ohne die Folgezeile zu raten.** Die Fundliste schlug vor, eine Summenzeile ohne eigenen
Betrag mit den nächsten ein bis zwei Zeilen zusammenzulesen — das wäre eine Regel, die *rät*,
welcher Betrag gemeint war, und sie wartete deshalb auf mehr gemessene Bons. Der Ausweg ist
derselbe wie bei Rabatt und Zwischensumme: **sagen, was ohnehin nie der Rechnungsbetrag ist.**
Gegebenes Bargeld und Rückgeld fliegen aus dem Rückfallpool, und der größte verbleibende Betrag
ist dann von selbst der richtige. Kein Zusammenlesen, keine Positionsannahme, keine neue Frage an
die Daten.

**Nur Bargeld-Wörter, und das ist der heikle Teil.** `EC`, `Karte` und `Betrag` gehören
ausdrücklich **nicht** dazu: auf einem Kartenbon steht dort der richtige Endbetrag — auf dem
gemessenen Bauhaus-Bon als `Betrag EUR 85,90`, und die Konsens-Gegenprobe stützt sich genau
darauf. Ein pauschaler Ausschluss aller Zahlungszeilen hätte dort geschadet; die Fundliste hatte
davor gewarnt.

Ausgeschlossen wird: `Geg.`, `Gegeben`, `BAR`, `Barzahlung`, `Bargeld`, `Rückgeld`,
`Wechselgeld`, `Rück`, `Zurück`. Vier Gegenproben stehen im Test, weil die Wortgrenzen hier eng
sein müssen:

| Zeile | bleibt im Pool, weil |
|---|---|
| `Zahlung bargeldlos 89,50` | `bargeld` mit ausdrücklichem Nein zu `bargeldlos` — das steht auf **Karten**bons |
| `Rucksack 49,99` | `Ruck` ist nicht `Rück` |
| `Rueckenlehne 199,00` | keine Wortgrenze hinter `Rueck` |
| `Cocktail Bar Nachtschwalbe` / `Longdrink 12,50` | ein Lokal darf „Bar" heißen |

**Wenn nichts übrig bleibt, gilt wieder die volle Liste.** Steht der einzige Betrag eines Bons
auf einer Bar-Zeile, ist ein womöglich unscharfer Vorschlag besser als keiner — anders als beim
Vorzeichen (5c) droht hier kein Richtungsfehler, nur ein ungenauer Wert. Die Konsens-Gegenprobe
bekommt weiterhin **alle** Beträge, denn sie zählt Zeugen: gerade die Zahlungszeile wiederholt
den Endbetrag oft.

## 6. Ladeverhalten

Die WASM-Dateien dürfen **nicht** beim Seitenstart geladen werden — sie sind um ein Vielfaches
größer als die gesamte übrige App. Nachladen erst beim ersten Klick auf „Beleg auslesen", nach
dem Muster von `Dashboard._ensureApexCharts()`. Danach bleibt der Worker für weitere Belege
derselben Sitzung stehen.

## 7. Offene Freigabe

**Beantwortet am 2026-08-12 durch den Betreiber: ja, aber nur auf den App-Routen.**

`script-src` wird um `'wasm-unsafe-eval'` erweitert — ausschließlich auf `/app.html` und
`/eigenbelege`. Landing, Rechtstexte und `/api/*` behalten die harte CSP unverändert.

**Wichtig für die Umsetzung:** Die Direktive wird *zusammen mit* dem OCR-Code gesetzt, nicht
vorher. Eine Aufweichung ohne das Feature, das sie rechtfertigt, wäre reiner Verlust. Zu setzen
ist sie an beiden Stellen, an denen die CSP steht: im `<meta>`-Tag der jeweiligen HTML-Datei
**und** im HTTP-Header in `vercel.json` — Browser werten mehrere CSPs als Schnittmenge, eine
vergessene Stelle blockiert also weiterhin.

Ursprüngliche Fragestellung:

Vor der Umsetzung ist genau eine Frage zu beantworten:

> **Darf `script-src` auf den App-Routen um `'wasm-unsafe-eval'` erweitert werden?**

- **Ja** → Umsetzung nach dieser Spezifikation.
- **Nein** → OCR ist im Browser nicht umsetzbar. Dann bleibt nur die Server-Variante, die aus
  Abschnitt 1 ausscheidet — der Fund wäre damit dauerhaft als „bewusst nicht gebaut" zu
  schließen, und das gehört so auch ins Marketing (Datenschutz als Grund, nicht als Ausrede).

## 8. Danach

- `js/vendor/VERSIONS.md` erweitern (Version, SHA-256, Bezugsquelle, Prüfdatum).
- Eine Erinnerung, die Version zu prüfen: genau dieser Schritt fehlte bei SheetJS, das dadurch
  zwei Jahre lang mit zwei bekannten CVEs im Excel-Import lag.
- `datenschutz.html` ergänzen: OCR läuft lokal, es verlässt kein Bild das Gerät. Das ist keine
  Pflichtangabe, aber es ist das Verkaufsargument — und ein Nutzer, der „Belegerkennung" liest,
  nimmt zunächst das Gegenteil an.
