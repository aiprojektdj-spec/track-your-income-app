# Prüfliste Buchhaltungssoftware — Befund und Bauplan

**Stand: 2026-09-21.** Einstieg: [`00-STAND.md`](00-STAND.md) · Regeln: [`../CLAUDE.md`](../CLAUDE.md)

Grundlage ist das vom User beigebrachte *Anforderungsprofil Buchhaltung — Prüfprotokoll für
Einzelunternehmen (EÜR & GoBD-Konformität)*, 11 Kriterien in vier Blöcken, davon **8 mit
Priorität PFLICHT** und 3 mit Priorität KOMFORT.

Vorgabe des Users: **Stackr muss alle diese Punkte erfüllen.**

---

## 1 — Befund am Code, nicht am Plan

Geprüft am 2026-09-21 gegen den Arbeitsbaum auf `master` (sauber, Stand `d055bab`).

| # | Kriterium | Prio | Stand | Beleg im Code |
|---|---|---|---|---|
| 1.1 | E-Rechnung (ZUGFeRD & XRechnung), Empfang & Verarbeitung | PFLICHT | **erfüllt** | [`rechnungen/js/erechnung-import.js`](../rechnungen/js/erechnung-import.js) — UBL + CII, ZUGFeRD/Factur-X als XML und aus dem PDF/A-3 (auch Flate-komprimiert, `inflateStreams`), Profil-Prüfung (MINIMUM und BASIC-WL werden als nicht ausreichend zurückgewiesen), SHA-256-Fingerprint für die GoBD-Ablage |
| 1.2 | GoBD-Konformität | PFLICHT | **erfüllt** | Hash-Kette in [`js/store.js`](../js/store.js) (`prevHash`, `verifyAuditChain`), Festschreibung + Storno statt Löschen (`isLocked`, `canEdit`), Z3/GDPdU-Datenträgerüberlassung in [`js/protokoll.js`](../js/protokoll.js), Nummernkreise ohne Verbrauch bei der Vorschau (`peekRechInvoiceNumber` / `nextRechInvoiceNumber`) |
| 1.3 | Angebots-Umwandlung | KOMFORT | **erfüllt** | `convertAngebotToRechnung` in [`rechnungen/js/dokumente.js`](../rechnungen/js/dokumente.js), ein Klick, Angebot bleibt bestehen und bekommt `_convertedToInvoiceId` |
| 1.4 | Kleinunternehmer-Regelung § 19 | PFLICHT | **erfüllt** | kein Steuerausweis (§ 14c Abs. 1 UStG abgesichert) und Pflichttext „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet" in [`rechnungen/js/rechnung.js`](../rechnungen/js/rechnung.js) |
| 2.1 | Intelligente OCR-Erfassung | PFLICHT | **teilweise** | [`js/beleg-ocr.js`](../js/beleg-ocr.js) + Tesseract lokal in `js/vendor/`. Drei Lücken gegen das Soll: nur **Bilder** (kein PDF), nur im **Eigenbeleg-Modul** (nicht bei Ausgaben/Einkäufen), und **kein USt-Satz / kein USt-Betrag** — `RE_TEILBETRAG` schließt `mwst`/`ust` ausdrücklich aus |
| 2.2 | Live-Bankanbindung | PFLICHT | **nicht erfüllt** | [`js/bank-import.js`](../js/bank-import.js) kann CAMT.053, MT940 und CSV **als Datei**; der automatische Abgleich gegen offene Rechnungen (`matchCandidates`, Score über Rechnungsnummer im Verwendungszweck, Betrag, Datum) ist vorhanden und gut. Was fehlt, ist ausschließlich die **Live**-Verbindung (PSD2) |
| 2.3 | Automatisches Mahnwesen | KOMFORT | **erfüllt** | [`rechnungen/js/mahnungen.js`](../rechnungen/js/mahnungen.js) — automatische Erkennung überfälliger Posten, drei Mahnstufen mit eigenen Fristen, Mahngebühren, Verzugszinsen nach § 288 i.V.m. § 247 BGB. Versand ist manuell (PDF/Druck), das Kriterium verlangt nur Erkennung und Erstellung |
| 3.1 | EÜR | PFLICHT | **erfüllt** | [`js/euer.js`](../js/euer.js), laufend aus dem Datenbestand gerechnet |
| 3.2 | ELSTER-Schnittstelle | PFLICHT | **nicht erfüllt** | Es gibt den CSV-Export mit den ELSTER-Kennzahlen und eine dreischrittige Anleitung ([`js/euer.js`](../js/euer.js), `euerElsterExport`) sowie die Kennzahlen der UVA in [`js/ustvoranmeldung.js`](../js/ustvoranmeldung.js). **Übermittelt wird nichts** |
| 4.1 | DATEV-Export | PFLICHT | **teilweise** | [`js/datev.js`](../js/datev.js) erzeugt den Buchungsstapel nach der offiziellen Formatbeschreibung (EXTF, Version 13, 125 Spalten, SKR03/SKR04, alle Quellen inkl. Eigenbelege und Fahrtkosten). Das Kriterium verlangt „Daten- **und Belegexport**" — die Belegbilder/-PDFs gehen bis heute nicht mit |
| 4.2 | Systemweiter Daten-Export | KOMFORT | **teilweise** | 39 CSV-Ausgabestellen, verschlüsseltes Voll-Backup ([`js/backup-crypto.js`](../js/backup-crypto.js)), GDPdU-Z3. Aber: **kein ZIP** im Projekt — Z3 liefert die Dateien einzeln aus, und ein PDF-Paket gibt es gar nicht |

**Zusammenfassung:** 7 von 11 voll erfüllt. Bei den 8 Pflichtkriterien: 4 voll, 2 teilweise
(2.1, 4.1), 2 nicht (2.2, 3.2).

---

## 2 — Die Entscheidung vom 2026-09-21

Die beiden nicht erfüllten Pflichtkriterien waren keine Versäumnisse. Sie standen als bewusster
Ausschluss in [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md), Abschnitt *„Automatisierung, die
einen Server mit Klartextzugriff bräuchte"*, mit der Begründung, dass beide einen Server
voraussetzen, der Buchhaltungs- bzw. Steuerdaten im Klartext sieht — genau das, was die
Local-First-Zusage ausschließt.

**Der User hat am 2026-09-21 anders entschieden: Es wird gebaut, die Local-First-Zusage wird für
diese beiden Funktionen aufgegeben.**

Der Einwand ist damit erledigt und gehört nicht erneut vorgetragen. Was bleibt, ist die
Aufgabe, die Folgen vollständig abzuräumen — sie sind der eigentliche Umfang dieses Vorhabens,
nicht der Code.

### Was mit der Zusage zusammenhängt und mitgezogen werden muss

| Ort | Was dort heute steht | Was passieren muss |
|---|---|---|
| [`index.html`](../index.html), FAQ „Kann Stackr direkt an ELSTER übermitteln?" | „Nein, und das ist Absicht… deine Steuerdaten verlassen dein Gerät nie, auch nicht für die Übermittlung" | Wird mit der Übermittlung **unwahr**. § 5 UWG. Muss vor dem Livegang der Funktion fallen oder umgeschrieben sein |
| [`landing-v2.html`](../landing-v2.html) | derselbe FAQ-Eintrag | dito |
| [`datenschutz.html`](../datenschutz.html) | beschreibt die Verarbeitung als lokal; OCR ausdrücklich als Browser-Verarbeitung | Zwei neue Verarbeitungen mit Rechtsgrundlage, Empfängern, Speicherdauer und Drittlandbezug (Aggregator) |
| [`agb.html`](../agb.html) | kennt weder Übermittlungs- noch Kontoinformationsdienst | Leistungsbeschreibung, Haftung für fehlgeschlagene Übermittlung, Mitwirkungspflichten |
| [`verfahrensdokumentation.html`](../verfahrensdokumentation.html) | beschreibt den heutigen Datenfluss | Neuer Abschnitt je Funktion |
| [`CLOUD-SYNC.md`](../CLOUD-SYNC.md) und die Sync-Architektur | Server sieht ausschließlich Chiffrat | Diese Aussage gilt dann nur noch für den Sync, nicht mehr für die App. Muss präzisiert werden, sonst wird sie zur Falschangabe |
| Art. 30 DSGVO | Verzeichnis der Verarbeitungstätigkeiten | Zwei neue Einträge |
| Art. 28 DSGVO | Auftragsverarbeitung | AV-Vertrag mit dem PSD2-Aggregator; beim ELSTER-Weg hängt es an der Bauform (s.u.) |
| Art. 35 DSGVO | DSFA | Steuerdaten + Kontoumsätze im Klartext auf fremder Infrastruktur ist ein ernsthafter Prüfpunkt, kein Formalakt |

---

## 3 — Bauplan A: die vier Lücken, die ohne alles Weitere zugehen

Diese hängen an keiner Lizenz, keinem Vertrag und keiner Architekturfrage. Sie gehören
unabhängig vom Rest gebaut, weil sie unter jedem Pfad gebraucht werden.

### A1 — OCR auf Ausgaben und Einkäufe ausweiten (Kriterium 2.1)

Heute hängt die Erkennung ausschließlich im Eigenbeleg-Formular
([`eigenbelege/js/app.js`](../eigenbelege/js/app.js), `ocrStarten`). Die Belegfoto-Felder in
[`js/ausgaben.js`](../js/ausgaben.js) (zwei Stück) und [`js/buchungen.js`](../js/buchungen.js)
haben denselben `accept="image/*"`-Input, aber keinen Auslese-Knopf.

Zu tun: den Chip-Mechanismus aus dem Eigenbeleg-Modul herauslösen, damit er von drei Stellen aus
benutzbar ist, ohne dreimal zu existieren. `BelegOCR.extract()` selbst bleibt unangetastet.

### A2 — PDF-Belege erkennen (Kriterium 2.1)

Das Soll nennt ausdrücklich „Kassenbons/PDFs". Tesseract nimmt kein PDF entgegen.

Zwei Wege, in dieser Reihenfolge zu prüfen:
1. **Text-PDF ohne OCR.** Ein von einem Händler erzeugtes Rechnungs-PDF trägt den Text bereits.
   Der Weg über `inflateStreams` aus [`rechnungen/js/erechnung-import.js`](../rechnungen/js/erechnung-import.js)
   existiert im Repo schon und lässt sich für Textextraktion weiterverwenden — dann geht der
   Rohtext direkt in `BelegOCR.extract()`, ganz ohne Texterkennung.
2. **Scan-PDF.** Braucht Rasterung der Seite vor Tesseract. Ohne PDF-Bibliothek nicht zu machen —
   **Regel 6, Rückfrage beim User**, bevor hier etwas geholt wird.

Der erste Weg deckt den häufigeren Fall und kostet keine Abhängigkeit.

### A3 — USt-Satz und USt-Betrag erkennen (Kriterium 2.1)

`RE_TEILBETRAG` in [`js/beleg-ocr.js`](../js/beleg-ocr.js) schließt `mwst` und `ust` heute
bewusst aus — das ist richtig, **solange es um den Gesamtbetrag geht**: eine MwSt-Zeile darf nie
als Bruttobetrag durchgehen. Das Soll verlangt aber den USt-Wert **zusätzlich**, als eigenes
Feld.

Also: eine eigene Regel, die die Steuerzeile gezielt sucht, statt die bestehende aufzuweichen.
Der Kommentarblock ab Zeile 123 beschreibt die Unterscheidung Satz (`19,00 %`) vs. Betrag bereits
— die Vorarbeit ist da. Die Ausschlussregel für den Gesamtbetrag bleibt, wie sie ist.

Die Spezifikation in [`ocr-belegerkennung-2026-08-12.md`](ocr-belegerkennung-2026-08-12.md),
Abschnitt 5, wird mitgezogen — sie ist die benannte Quelle der Regeln.

### A4 — ZIP-Ausgabe, und damit DATEV-Belegexport und PDF-Paket (Kriterien 4.1, 4.2)

Ein ZIP im **Store-Modus** (ohne Komprimierung) ist ein Local-File-Header, die Daten, ein
Central-Directory-Eintrag und ein End-of-Central-Directory pro Datei; CRC-32 ist die einzige
Rechnung darin. Das sind rund 60 Zeilen und **keine neue Abhängigkeit** im Sinne von Regel 6.

Damit gehen auf einen Schlag zu:
- **4.1**: Belegbilder und Rechnungs-PDFs wandern als Ordner neben den Buchungsstapel. Die
  Verknüpfung existiert bereits über `belegfeld1` in [`js/datev.js`](../js/datev.js)
- **4.2**: Der Z3-Export in [`js/protokoll.js`](../js/protokoll.js) liefert heute Einzeldateien
  mit der Anweisung, sie in einen Ordner zu legen — der Kommentar dort nennt das fehlende ZIP
  ausdrücklich als Grund. Das fällt weg
- Zusätzlich das im Soll genannte PDF-ZIP für Prüfung und Softwarewechsel

---

## 4 — Bauplan B: ELSTER-Übermittlung (Kriterium 3.2)

### Was ERiC ist und was das für Stackr bedeutet

ERiC ist eine **native C-Bibliothek**, die die Daten plausibilisiert, verschlüsselt und an das
Rechenzentrum der Steuerverwaltung überträgt. Sie ist unentgeltlich, aber nur an **registrierte
Hersteller** mit eigener Hersteller-ID; die Lizenzbedingungen sind restriktiv (für freie Software
regelmäßig unvereinbar). Sie ist **versionsgebunden**: zum Februar 2026 war Version 43.3.2.0
verbindlich vorgeschrieben. Das heißt für uns: **ein erzwungener Wartungstakt**, der nicht
verhandelbar ist und an dem die Funktion still ausfällt, wenn er gerissen wird.

Quellen: [ELSTER — Entwickler](https://www.elster.de/eportal/infoseite/entwickler),
[ERiC-Entwicklerhandbuch](https://instantview.org/data/CyberEnterprise/ERiC/ERiC-Entwicklerhandbuch.pdf),
[Lizenzvertrag (BayLfSt)](https://rechtlogisch.de/wp-content/uploads/2018/04/Lizenzvertrag-Stand-20180419.pdf),
[ELSTER-Schnittstelle · Recht logisch](https://rechtlogisch.de/elster-schnittstelle/),
[SIGMA — UStVA 2026 und ERiC 43.3.2.0](https://www.business-one-consulting.de/magazin/details/elster-sap-business-one)

### Der Punkt, der die Bauform entscheidet: das Zertifikat

Eine authentifizierungsfreie Übermittlung der UStVA gibt es nicht. Übermittelt wird mit dem
**ELSTER-Zertifikat des Nutzers** (`.pfx` + PIN). Wer serverseitig übermittelt, braucht dieses
Zertifikat und diese PIN auf dem Server.

**Das ist die eigentliche Eskalation — nicht die Steuerdaten.** Ein ELSTER-Zertifikat mit PIN ist
der Vollzugriff auf das Steuerkonto des Nutzers: Steuererklärungen, Bescheide, Änderungen der
Bankverbindung. Ein Datenabfluss dort ist nicht mit „unangenehm" beschrieben.

### Drei Bauformen, absteigend nach Risiko für uns

| Form | Wie | Zertifikat liegt | Bewertung |
|---|---|---|---|
| **B-1 Server mit ERiC** | Eigene Function/Container mit ERiC-Binary, Hersteller-ID auf Stackr | auf unserem Server (mindestens für die Dauer der Übermittlung) | Volle Kontrolle, volles Risiko. Auf Vercel-Functions wegen Binary-Größe und Laufzeit fraglich — braucht vermutlich einen eigenen Container, also eine **zweite Betriebsumgebung neben Vercel** |
| **B-2 Cloud-Proxy eines Drittanbieters** | Gehostete ERiC-Schnittstelle, wir rufen HTTP | beim Drittanbieter | Kein ERiC-Betrieb, kein Wartungstakt bei uns. Dafür ein Auftragsverarbeiter, der Steuerdaten **und** Zertifikate sieht. AV-Vertrag + DSFA zwingend |
| **B-3 Zertifikat bleibt beim Nutzer** | Übermittlung aus einer lokalen Komponente heraus, Server sieht nur die Metadaten | beim Nutzer | Hält die Zusage — kostet aber eine installierbare Komponente und ist damit **kein Web-Produkt mehr**. Widerspricht der Entscheidung vom 2026-09-21, hier nur der Vollständigkeit halber |

**Empfehlung für den nächsten Schritt:** B-1 und B-2 gegeneinander bewerten, bevor Code
entsteht. Der Unterschied ist keine technische Geschmacksfrage, sondern die Frage, wer für einen
Zertifikatsabfluss geradesteht.

### Was der User beschaffen muss, bevor gebaut werden kann

1. **Registrierung als Hersteller bei ELSTER** und Zuteilung einer Hersteller-ID
2. **Annahme der ERiC-Nutzungsbedingungen** — jemand muss sie vorher gelesen haben, sie sind
   restriktiv
3. Bei B-2: **Anbieterauswahl + AV-Vertrag**
4. **Entscheidung über die Betriebsumgebung**, falls B-1 (Vercel allein reicht vermutlich nicht)

### Reihenfolge der Formulare

UStVA zuerst. Sie ist monatlich oder quartalsweise fällig, betrifft jeden Regelbesteuerer und die
Kennzahlen stehen in [`js/ustvoranmeldung.js`](../js/ustvoranmeldung.js) bereits fertig. Anlage
EÜR danach — einmal im Jahr, und der Weg über den CSV-Export funktioniert bis dahin weiter.

---

## 5 — Bauplan C: Live-Bankanbindung (Kriterium 2.2)

### Der Rechtsrahmen

Kontoinformationsdienst ist ein **erlaubnispflichtiges Geschäft**. Zwei Wege: eigene
BaFin-Erlaubnis — für ein Ein-Personen-Produkt praktisch ausgeschlossen — oder ein **lizenzierter
Aggregator**, unter dessen Erlaubnis wir mitlaufen.

### Was das kostet

Die Preisrecherche liegt in [`server-kosten-psd2-2026-08-16.md`](server-kosten-psd2-2026-08-16.md)
und ist am 2026-09-21 nicht neu erhoben worden. Kernbefund von damals:

- **3–4 € je Kunde und Monat** bei den preislich erreichbaren Anbietern — bei 15 € Abopreis sind
  das **24–32 % vom Nettoerlös**, dauerhaft, je zahlendem Kunden
- Die meisten großen Anbieter (Plaid, Yapily, TrueLayer, Tink, Salt Edge) haben **Mindestumsätze
  von 150 bis 2.000 € im Monat ab Tag 1**
- Die einzige kostenlose Abkürzung (Nordigen/GoCardless) nimmt seit 2025 **keine Neukunden** mehr

**Vor der Anbieterwahl muss diese Recherche aufgefrischt werden** — sie ist gut fünf Wochen alt
und war schon damals bei zwei Anbietern auf „Preis nur per Vertrieb" angewiesen.

### Was gebaut werden muss

Der schwierige Teil ist nicht die Anbindung, sondern der Rest — und der **existiert bereits**:
`matchCandidates` in [`js/bank-import.js`](../js/bank-import.js) ordnet Zahlungen offenen
Rechnungen zu, mit Score, Begründung und der Regel, dass nie ungefragt gebucht wird. Ein
PSD2-Abruf ersetzt lediglich die Dateiauswahl als Quelle.

Zu tun:
1. Serverseitiger Abruf beim Aggregator (Consent-Flow, Token-Haltung, 90-Tage-Reconsent)
2. Umsätze in dasselbe `tx`-Format überführen, das `parseCamt` heute erzeugt — dann greift die
   ganze bestehende Abgleich- und Buchungsstrecke unverändert
3. Der Datei-Import **bleibt**. Er kostet nichts, funktioniert ohne Aggregator und ist der
   Rückfall, wenn eine Bank im Aggregator fehlt

### Die Folgefrage, die der User beantworten muss

Bei 3–4 € Aggregatorkosten je Kunde und Monat bei 15 € Abopreis: **Aufpreis-Modul oder im Preis
enthalten?** Das berührt die Entscheidung *„Ein Preis, keine Staffel"* vom 2026-08-21 in
[`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md) und ist keine technische Frage.

---

## 6 — Reihenfolge

1. **Bauplan A** (A1, A3, A4 sofort; A2 Weg 1 sofort, Weg 2 nach Rückfrage). Hängt an nichts,
   schließt 2.1 und 4.1/4.2 und wird unter jedem Pfad gebraucht
2. **Rechtstexte und Verfahrensdokumentation vorbereiten** — parallel, denn sie sind der lange
   Weg (Anwalt) und nicht der kurze
3. **ELSTER**: Herstellerregistrierung anstoßen, B-1 gegen B-2 entscheiden, dann UStVA bauen
4. **PSD2**: Preisrecherche auffrischen, Preisfrage entscheiden, Aggregator wählen, dann bauen

Nach Schritt 1 stehen **10 von 11 Kriterien** (alle bis auf 2.2 und 3.2), und bei den
Pflichtkriterien 6 von 8 voll statt 4.

---

## 7 — Was diese Datei nicht ist

Kein Ersatz für den Blick in den Code (Regel 3). Die Zeilenverweise sind bewusst weggelassen und
durch Bezeichnernamen ersetzt, weil sie erfahrungsgemäß binnen Tagen driften. Der Befund in
Abschnitt 1 ist am 2026-09-21 am Code erhoben und veraltet mit dem nächsten Eingriff.
