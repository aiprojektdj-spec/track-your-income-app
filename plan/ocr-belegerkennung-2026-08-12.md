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
| Datum | erstes Vorkommen von `TT.MM.JJJJ` oder `TT.MM.JJ`; bei mehreren das früheste, weil Bons oft ein späteres Druckdatum tragen |
| Betrag | Zeile mit `SUMME`, `GESAMT`, `TOTAL`, `ZU ZAHLEN` bevorzugt; sonst der größte gefundene Betrag mit zwei Nachkommastellen. Danach die **Konsens-Gegenprobe**, siehe unten |
| Händler | erste Zeile mit mindestens drei Buchstaben, die keine Zahl und keine Adressfloskel ist |

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
4. Der Kandidat steht mindestens einmal auf einer Zeile mit einem **Bestätigungswort**:
   `BETRAG`, `BRUTTO`, `SUMME`, `GESAMT`, `TOTAL`, `ZU ZAHLEN`, `ENDBETRAG`.

**Warum vier Bedingungen und nicht zwei.** Ohne Bedingung 4 wäre die Regel gefährlich: ein Bon
mit zwei Posten zu `5,90` und einer Summe von `85,90`, die nur einmal dasteht, würde
fälschlich **nach unten** korrigiert — aus einem Erkennungsfehler würde ein Rechenfehler. Das
Bestätigungswort verlangt, dass der Kandidat selbst irgendwo als Endbetrag auftritt, nicht bloß
als Postenpreis. Auf dem Bauhaus-Bon trägt ihn die Zeile `Betrag EUR 85,90`.

`BAR` und `GEGEBEN` stehen bewusst **nicht** in der Liste: auf einem Barbon ist „Gegeben 50,00"
genau der Betrag, der nicht gewinnen soll — er als Bestätigungswort zuzulassen hieße, die
bestehende Regel von hinten aufzuheben.

**Die Korrektur wird nicht verschwiegen.** Greift sie, trägt der Treffer zusätzlich fest, was
ursprünglich dastand; der Chip zeigt beides. Eine stille Korrektur wäre wieder ein Raten, und
der Leitsatz der Funktion bleibt: ein falsch vorbefülltes Feld ist schlimmer als ein leeres.

**Was sie nicht kann.** Steht der wahre Betrag nur ein einziges Mal auf dem Bon, greift nichts —
dann fehlt der Konsens, aus dem die Regel ihren Namen hat. Der Fall bleibt offen und ist der
Grund, warum eine Trefferquote weiterhin mehr als einen Bon braucht.

**Drei weitere Fehler der Betragsregel sind am selben Tag bestätigt und bewusst offen geblieben**
— Summenzeile mit Umbruch, verlorenes Minus bei Retouren, Uhrzeit mit Punkt. Alle drei sitzen im
Rückfallpfad und irren ebenfalls nach oben; die Gegenprobe fängt keinen davon. Reproduktion und
Lösungsrichtungen in [`funde-betragsregel-2026-08-30.md`](funde-betragsregel-2026-08-30.md).
Sie sind nicht behoben, weil die Regel sonst vier Neuerungen auf einem einzigen echten Bon
trüge — erst mehr Bons, dann der Rückfallpfad in einem Stück.

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
