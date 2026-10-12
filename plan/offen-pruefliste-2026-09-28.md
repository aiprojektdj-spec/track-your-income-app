# Was noch offen ist — Arbeitsliste zum Anforderungsprofil

**Stand: 2026-09-28.** Befund und Herleitung: [`pruefliste-buchhaltung-2026-09-21.md`](pruefliste-buchhaltung-2026-09-21.md)
· Einstieg: [`00-STAND.md`](00-STAND.md) · Regeln: [`../CLAUDE.md`](../CLAUDE.md)

Diese Datei ist die Abarbeitungsliste, nicht die Begründung. Jeder Punkt sagt, **wer** ihn macht
und **was der nächste Griff ist**. Erledigtes wird hier abgehakt, nicht gelöscht.

---

## Wo wir stehen

**10 von 11 Kriterien erfüllt**, bei den 8 Pflichtkriterien 6 von 8.

Bauplan A ist am 2026-09-21 gebaut und committet (`c6cd177`, `d5d9ca1`, `b3080ac`):
OCR im Ausgaben-Formular samt PDF-Textschicht und USt, DATEV-Belegexport, Z3 als ZIP.

> **`master` ist 4 Commits vor `origin/master`.** Die drei oben plus `d055bab`. Solange nicht
> gepusht ist, ist nichts davon beim Kunden — das ist schon einmal vier Tage lang übersehen
> worden (`a2e3fa4`, eigene Artikelnummern; der Kunde meldete das Feature als fehlend).

- [ ] **P0 — pushen.** `git push origin master`

---

## A — Sofort machbar, hängt an nichts

### A1 Browser-Gegencheck der neuen Oberfläche — **du**

Ich kann das nicht: Ausgaben-Formular und DATEV-Karte liegen hinter dem Whop-Gate, und auf
localhost ist der Login strukturell unmöglich (fester `redirect_uri`, fehlende `api/`-Functions).
Also gegen Produktion, mit der Testfirma.

- [ ] Ausgaben → **Beleg auslesen** mit einem **Foto** eines Kassenbons. Erwartung: bis zu vier
      Chips (Datum, Betrag, Lieferant, USt-Satz), keiner davon automatisch eingetragen
- [ ] Dasselbe mit einem **Händler-PDF**. Erwartung: geht sofort, ohne Nachladen der
      Erkennungsdateien
- [ ] Dasselbe mit einem **eingescannten PDF**. Erwartung: „enthält keinen auslesbaren Text …
      bitte als Foto hochladen" — und *kein* geratener Vorschlag
- [ ] Finanzen → **DATEV exportieren** mit angehaktem Belegexport. Erwartung: eine ZIP mit
      Stapel, `belege/<Quelle>/` und `LIESMICH.txt`; die Dateinamen tragen die Belegnummern
- [ ] Protokoll → **Betriebsprüfung (Z3)**. Erwartung: **eine** Datei `GDPdU_Z3_<Jahr>.zip`,
      nicht fünf Einzeldownloads
- [ ] Eigenbelege → **Beleg auslesen** im eingebetteten Tab von `app.html`. Das war bis zum
      2026-09-21 kaputt (fehlendes `js/beleg-ocr.js`) und ist der eigentliche Regressionstest

### A2 Belegnummer bei Wareneinkäufen — **ich**

Einkäufe sind die einzige Belegart ohne Belegnummer-Feld. `js/protokoll.js` führt in
`einkaeufe.csv` trotzdem die Spalte „Belegnummer" — sie ist in **jeder**
Datenträgerüberlassung leer. `js/datev.js` behilft sich mit der Artikelnummer.

- [ ] Feld `belegNr` im Einkaufsformular (`js/buchungen.js`), analog `exp_belegNr`
- [ ] `js/datev.js`: `p.belegNr || p.artikelNr || p.id.slice(0,12)`
- [ ] Tests in `test-datev-export.js`, `test-datev-belege.js`, `test-z3-export.js` nachziehen

*Liegt als Hintergrundaufgabe bereit (`task_a46ff09c`) — ein Klick startet sie in eigenem
Worktree.*

### A3 Scan-PDFs wirklich lesen — **ich, aber Rückfrage nötig**

Heute sagt Stackr bei einem Scan-PDF ehrlich „geht nicht, bitte als Foto". Das ist besser als
raten, aber es bleibt ein Nein. Um die Seite zu rastern und dann Tesseract draufzulassen,
bräuchte es eine PDF-Bibliothek.

- [ ] **Deine Entscheidung:** neue Abhängigkeit (Regel 6) für diesen Fall — ja oder nein?
      Wenn ja, welche und woher

### A4 Der Feldnamen-Wächter auf die übrigen Module — **ich**

Der DATEV-Fehler (`belegnummer` statt `belegNr`) kam durch, weil der Test dieselben falschen
Namen benutzte. Block J in `test-datev-export.js` schließt das für DATEV. Dieselbe Bauart
haben aber auch `js/euer.js`, `js/protokoll.js` (Z3) und `js/statistiken.js`.

- [ ] Je Modul eine Prüfung, die die Feldnamen aus der **schreibenden** Datei liest und gegen
      die **lesende** hält

---

## B — ELSTER-Übermittlung (Kriterium 3.2, PFLICHT)

Herleitung und die drei Bauformen: [`pruefliste-buchhaltung-2026-09-21.md`](pruefliste-buchhaltung-2026-09-21.md), Abschnitt 4.

**Die entscheidende Frage ist nicht ERiC, sondern das Zertifikat.** Übermittelt wird mit dem
ELSTER-Zertifikat des Nutzers (`.pfx` + PIN). Das ist Vollzugriff auf sein Steuerkonto:
Erklärungen, Bescheide, Änderung der Bankverbindung. Wer serverseitig übermittelt, hat das auf
dem Server liegen.

### B1 Beschaffung — **du**

- [ ] Als **Hersteller bei ELSTER registrieren**, Hersteller-ID beantragen
      ([elster.de/eportal/infoseite/entwickler](https://www.elster.de/eportal/infoseite/entwickler))
- [ ] **ERiC-Nutzungsbedingungen lesen**, bevor jemand sie annimmt — sie sind restriktiv
      ([Lizenzvertrag BayLfSt](https://rechtlogisch.de/wp-content/uploads/2018/04/Lizenzvertrag-Stand-20180419.pdf))

### B2 Bauform entscheiden — **du, ich liefere die Bewertung**

| | Zertifikat liegt | Preis dafür |
|---|---|---|
| **B-1** eigener Server mit ERiC | bei uns | volle Kontrolle, volles Risiko; braucht vermutlich eine **zweite Betriebsumgebung neben Vercel** (Binary-Größe, Laufzeit) |
| **B-2** Cloud-Proxy eines Drittanbieters | beim Anbieter | kein ERiC-Betrieb, kein erzwungener Wartungstakt bei uns; dafür ein Auftragsverarbeiter, der Steuerdaten **und** Zertifikate sieht |

- [ ] B-1 oder B-2
- [ ] Bei B-2: Anbieter auswählen, **AV-Vertrag** (Art. 28 DSGVO)
- [ ] Bei B-1: Betriebsumgebung klären

### B3 Bauen — **ich**, sobald B1 und B2 stehen

- [ ] **UStVA zuerst.** Monatlich/quartalsweise fällig, betrifft jeden Regelbesteuerer, und die
      Kennzahlen stehen in [`js/ustvoranmeldung.js`](../js/ustvoranmeldung.js) fertig ausgerechnet
- [ ] Anlage EÜR danach — einmal im Jahr, und der CSV-Weg funktioniert bis dahin weiter
- [ ] **Wartungstakt einplanen.** ERiC ist versionsgebunden (ab Februar 2026 war 43.3.2.0
      Pflicht). Wird der Takt gerissen, fällt die Funktion aus — ohne Vorwarnung

---

## C — Live-Bankanbindung / PSD2 (Kriterium 2.2, PFLICHT)

Herleitung: [`pruefliste-buchhaltung-2026-09-21.md`](pruefliste-buchhaltung-2026-09-21.md), Abschnitt 5.
Preisrecherche: [`server-kosten-psd2-2026-08-16.md`](server-kosten-psd2-2026-08-16.md)

Kontoinformationsdienst ist erlaubnispflichtig. Eigene BaFin-Erlaubnis ist für ein
Ein-Personen-Produkt praktisch ausgeschlossen, also läuft es unter der Erlaubnis eines
**lizenzierten Aggregators**.

### C1 Preisfrage — **du**

- [ ] **Preisrecherche auffrischen.** Die vom 2026-08-16 ist sechs Wochen alt und war schon
      damals bei zwei Anbietern auf „Preis nur per Vertrieb" angewiesen
- [ ] **Entscheidung:** 3–4 € je Kunde und Monat sind bei 15 € Abo **24–32 % vom Nettoerlös**,
      dauerhaft. Aufpreis-Modul oder im Preis enthalten? Berührt „Ein Preis, keine Staffel"
      vom 2026-08-21 in [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md)
- [ ] Anbieter wählen, Vertrag, **AV-Vertrag**

### C2 Bauen — **ich**, sobald C1 steht

Der schwierige Teil existiert bereits: `matchCandidates` in
[`js/bank-import.js`](../js/bank-import.js) ordnet Zahlungen offenen Rechnungen zu, mit Score und
Begründung, und bucht nie ungefragt. Ein PSD2-Abruf ersetzt nur die Dateiauswahl als Quelle.

- [ ] Serverseitiger Abruf: Consent-Flow, Token-Haltung, **90-Tage-Reconsent**
- [ ] Umsätze in dasselbe `tx`-Format überführen, das `parseCamt` erzeugt — dann greift die
      ganze bestehende Abgleich- und Buchungsstrecke unverändert
- [ ] **Datei-Import bleibt.** Er kostet nichts, funktioniert ohne Aggregator und ist der
      Rückfall, wenn eine Bank im Aggregator fehlt

---

## D — Recht und Kommunikation

**Das ist der lange Weg, nicht der Code.** Parallel zu B und C anstoßen, nicht danach.

### D1 Die Zusage, die unwahr wird — **du (Anwalt), ich liefere Entwürfe**

- [ ] FAQ „Kann Stackr direkt an ELSTER übermitteln?" in [`../index.html`](../index.html) **und**
      [`../landing-v2.html`](../landing-v2.html). Der Eintrag beginnt heute mit „Nein, und das ist
      Absicht" und endet auf „deine Steuerdaten verlassen dein Gerät nie, auch nicht für die
      Übermittlung". **Mit der Übermittlung ist das falsch — § 5 UWG.** Muss fallen oder
      umgeschrieben sein, **bevor** die Funktion live geht
- [ ] Prüfen, wo sonst noch mit „local-first" geworben wird, das dann nicht mehr uneingeschränkt gilt

### D2 Rechtstexte — **Anwalt**

- [ ] [`../datenschutz.html`](../datenschutz.html): zwei neue Verarbeitungen mit Rechtsgrundlage,
      Empfängern, Speicherdauer, Drittlandbezug
- [ ] [`../agb.html`](../agb.html): Leistungsbeschreibung, Haftung bei fehlgeschlagener
      Übermittlung, Mitwirkungspflichten
- [ ] [`../verfahrensdokumentation.html`](../verfahrensdokumentation.html): je ein Abschnitt
- [ ] [`../CLOUD-SYNC.md`](../CLOUD-SYNC.md) und die Sync-Doku: „Server sieht ausschließlich
      Chiffrat" gilt dann nur noch für den Sync, nicht mehr für die App. **Unpräzisiert wird
      dieser Satz zur Falschangabe**

### D3 DSGVO-Formalien — **du**

- [ ] Art. 30: zwei neue Einträge im Verarbeitungsverzeichnis
- [ ] Art. 28: AV-Verträge (PSD2-Aggregator, ggf. ELSTER-Proxy)
- [ ] **Art. 35: DSFA.** Steuerdaten *und* Kontoumsätze im Klartext auf fremder Infrastruktur,
      dazu ELSTER-Zertifikate — das ist ein ernsthafter Prüfpunkt, kein Formalakt

---

## Reihenfolge

1. **P0 pushen**, dann **A1** (Gegencheck) — was gebaut ist, muss beim Kunden ankommen und stimmen
2. **A2** und **A4** nebenher, hängen an nichts
3. **D1 und D2 sofort anstoßen** — Anwalt ist der lange Weg
4. **B1/B2** und **C1**: beschaffen und entscheiden. Ohne die beiden Blöcke kann ich nichts bauen
5. **B3** und **C2**: bauen

Nach Schritt 5 sind alle 11 Kriterien erfüllt.
