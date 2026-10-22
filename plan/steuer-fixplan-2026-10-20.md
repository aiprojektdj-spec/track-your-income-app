# Steuer-Fixplan 2026-10-20

Quelle: [`output/steuer-audit-2026-10-18/STEUER-AUDIT-2026-10-18.md`](../output/steuer-audit-2026-10-18/STEUER-AUDIT-2026-10-18.md)
(Details je Befund in den Teilberichten `ust/`, `rechnungen/`, `gobd-export/`, `euer-rechner/`).
Repro je Befund: `node output/steuer-audit-2026-10-18/alle-repros.js`.

**Regel für jeden Fix:** Repro-Fall als Regressionstest nach `test/` übernehmen (Exit ≠ 0 bei Abweichung),
erst dann Code ändern. Neue Logik in Fachmodule, nicht in `app.js`/`store.js`/`lager.js` (CLAUDE.md Regel 11),
außer der Fix ändert dort ohnehin einen bestehenden Block. Vor jedem Commit `git status` und `git diff <datei>`.
Stand gegen den Code prüfen, nicht gegen diese Datei.

Legende: ☐ offen · ☑ erledigt (Commit) · ⏸ wartet auf Entscheidung

## Batch 1 — P1

| ☐ | ID | Fix | Dateien |
|---|---|---|---|
| ☑ `23fdcf2` | U04/U05 | Manuelle Vorsteuer nur bei Regelstatus zum Belegdatum; RC-Ausgabe bei KU = §13b-Steuer ohne Abzug; KU sieht §18-Abs.4a-Ansicht statt Sperre | vorsteuer.js, ustvoranmeldung.js |
| ☑ `71c2ecf` | B1 | Datumsoption „Fälligkeit“ druckt zusätzlich „Leistungsdatum entspricht Rechnungsdatum“; XRechnung Lieferdatum = Rechnungsdatum als Fallback | rechnungen/js/rechnung.js, xrechnung.js |
| ☑ `71c2ecf` | B2 | RC/ig. Lieferung: eigene USt-IdNr. Pflicht beim Speichern und Export | rechnungen/js/rechnung.js, xrechnung.js |
| ☑ `623e0df` | E-01 | Anlagenabgang (Datum, Erlös): AfA bis Abgangsmonat, Restbuchwert als BA, Erlös als BE; Storno nur offenes Jahr | afa.js, euer.js, (store.js) |
| ☑ `623e0df` | E-05a | §141-AO-Überschreitung sperrt EÜR nicht mehr; Hinweis + Feld „Bilanzpflicht ab WJ“ | rechtsform.js, euer.js |
| ☑ `74f3ed7` | F1 | Import: Protokoll anhängen, `closed_years` vereinigen, Zähler = max, festgeschriebene Datensätze behalten | store.js |
| ☑ `74f3ed7` | F2 | Retouren/Materialeinkauf: `_audit` + Periodensperre wie bei Verkäufen | store.js |
| ☑ `74f3ed7` | F3 | Z3-Export auf echte Store-Feldnamen; fehlende Tabellen; Test auf echte Objekte | protokoll.js, test/test-z3-export.js |

## Batch 2 — P2

| ☐ | ID | Fix | Dateien |
|---|---|---|---|
| ☑ `23fdcf2` | U01 | Kz 47 (+ Kz 84/85 für §13b Abs.2) in Anzeige, CSV, Kopieren | ustvoranmeldung.js |
| ☑ `5bf8220` | U02/B3b | B2B-Dienstleistung Drittland → nicht steuerbar (Kz 45 / Kategorie O) | ustvoranmeldung.js, xrechnung.js |
| ☑ `19dd9f8` | U06 | KU-Gesamtumsatz netto, Rückzahlungen abziehen, Anlagenverkäufe außer Ansatz | app.js (Block in kleinunternehmer.js ziehen) |
| ☑ `c7f1188` | U09 | OSS-Sätze EE 24 %, RO 21 % (RO vorher amtlich bestätigen) | oss.js |
| ☑ `c53dad0` | B3a | 0 %-Position Inland: Befreiungshinweis Pflicht | rechnungen/js/rechnung.js |
| ☑ `c53dad0` | B4 | Positionsbeschreibung + eigene Anschrift beim Speichern prüfen | rechnungen/js/rechnung.js |
| ☑ `71c2ecf` | B5 | CII-Elementreihenfolge (BuyerReference, ExemptionReasonCode); kosit-proben neu erzeugen | xrechnung.js, kosit-proben/ |
| ☑ `c53dad0` | B6 | Verkäuferkontakt, Zahlungsanweisung, Lieferland ig. Lieferung im XML | xrechnung.js |
| ☑ `74f3ed7` `ba6c858` | B7 | Storno-Nummer gegen vorhandene prüfen; Merge: Zähler = max | store.js, cloud-sync.js |
| ☑ `c7f1188` | B10 | E-Rechnungs-Hinweis jahres-/umsatzabhängig, KU/Kleinbetrag ausgenommen | rechnungen/js/rech-dashboard.js |
| ☑ `5665799` | F4/F9 | DATEV: Eigenbeleg brutto, keine Doppelbuchung (Eigenbeleg→Lager über `savePurchase`), Teilzahlung nach Zufluss, Storno+Rückzahlung | datev.js, eigenbelege/ |
| ☑ `4965e20` | F5 | Kassenbuch: Tagesbestand ≥ 0 prüfen, Jahressperre, Anfangsbestand protokolliert | kassenbuch.js |
| ☑ `ddd83c8` | F6 | Storno im abgeschlossenen Jahr als Gegenbuchung im laufenden Jahr | store.js |
| ☑ `ba6c858` | F7 | Merge: `closed_years` vereinigen, Kette nach Merge neu prüfen, festgeschriebene Datensätze → Konflikt | cloud-sync.js, backup-crypto.js |
| ☑ `e932d57` | F8 | Löschen mit Warnung, Nummernkreis bleibt | store.js, companies.js |
| ☑ `c7f1188` | E-02 | GWG-Grenze netto auch bei KU | afa.js |
| ☑ `c7f1188` | E-03 | KSA auf Entgelt ohne USt | ausgaben.js |
| ☑ `9554745` | E-04 | Ein GewSt-Rechenkern (Abrundung 100 €, ein Hebesatz, SBE) für alle vier Wege | gewerbesteuer.js, euer.js, gbr.js, gbr-modul.js |
| ☑ `c7f1188` | E-05b | §141-Umsatz netto | gbr-modul.js |
| ☑ `9554745` | E-05c | GewSt-Anzeige nur bei `brauchtGewSt()` | app.js, gewerbesteuer.js, euer.js |
| ☑ `9554745` | E-06 | GewSt-VZ-Termine 15.02./05./08./11. | gbr-modul.js |
| ☑ (E-07/08-Commit) | E-07 | Kategorien Bewirtung 70 %, Geschenke (50-€-Grenze), GewSt nicht abziehbar | ausgaben.js, euer.js |
| ☑ (E-07/08-Commit) | E-08 | Fahrtenbuch „tatsächliche Kosten“: Doppelabzug verhindern / Hinweis korrigieren | fahrtenbuch.js |
| ☑ `5ad92e0` | E-09 | Manuelle Vorsteuer in EÜR als BA | euer.js |
| ☑ `5ad92e0` | E-10/R-TAX-05 | KSt-Gewinn aus dem gemeinsamen Rechenkern | koerperschaftsteuer.js |

## Batch 3 — Bekannt seit 14.10. (R-TAX)

| ☐ | ID | Fix |
|---|---|---|
| ☑ `ffaa13b` | R-TAX-01 | Automatischer KU-Stempel vs. bewusste Ausnahme trennen; Wechsel korrigiert ab Grenzumsatz |
| ☑ `d0ea4c2` | R-TAX-02 | Soll-UVA: KU-Rechnung vor §25a-Zweig ausschließen |
| ☑ `d0ea4c2` | R-TAX-03 | §25a-Preisnachlass über Margenrekonstruktion |
| ☑ `a0ccb94` | R-TAX-04 | `nettoSales` mit §25a-Marge |
| ☑ `adeefeb` | R-TAX-06 | Gutschrift: Berichtigungszeitpunkt statt Lieferdatum |
| ☑ `adeefeb` | R-TAX-07 | Alle Vorauszahlungen (nicht nur `_teilzahlung`) |
| ☑ `5d7cf4e` | R-TAX-08 | Zehn-Tage-Regel für USt-Vorauszahlungen (Zeitraumfeld) |
| ☑ `adeefeb` | R-TAX-09 | Soll-UVA aus `rechnung-summen.js` |

## Batch 4 — P3

~~U03~~ (☑ `5bf8220`) · ~~U07~~ (☑ `23fdcf2`) · ~~U08~~ (☑ dieser Commit) · ~~U10/U11/U12~~ (☑ `066bd19`; Kz 70 ☑ Kz70/R-L1a-Commit) · ~~B8/B9/B11~~ (☑ `f7a99b8`; datenschutz.html offen) · ~~E-11/E-13/F9-Rest~~ (☑ `aad6dc9`) · ~~E-12~~ (☑ `c7f1188`) — Details im Auditbericht §3 „P3“.

## Folgepunkte aus den Fixes

- ~~DATEV bucht den Restbuchwert eines Anlagenabgangs (E-01) noch nicht~~ — erledigt in `5665799`
  (Konto 2310 SKR03 / 6895 SKR04; Kontonummern noch gegen den amtlichen DATEV-Kontenrahmen prüfen).
- **E-07/E-08 entschieden (User, 2026-10-22):** eigene Kategorien Bewirtung/Geschenke/Gewerbesteuer;
  Fahrt mit „tatsächlichen Kosten“ bucht 0 €. Offen dazu: DATEV-Konten für Bewirtung/Geschenke/GewSt
  (fallen auf „sonstige“; Sollwerte nur aus dem DATEV-Kontenrahmen), Nutzungsentnahme Kfz/Telefon,
  eigene Zeilen „nicht abziehbar“ im Anlage-EÜR-Export.
- **Offen:** `kosit-proben/` mit dem neuen Code neu
  erzeugen und beim KoSIT-Validator hochladen (User); `datenschutz.html:454` Fristbeginn
  Jahresende statt „letzte Eintragung“ (Rechtstext → User/Anwalt).
- ~~Logikreview R-L1a „doppelte Soll-USt-Korrektur durch Stornodokument + Rückzahlung“~~ — bestätigt
  (Soll Q1/2026 −38 statt −19 €) und behoben im Kz70/R-L1a-Commit.
- U06: Umsätze mit Anlagevermögen (§19 Abs. 2 S. 2 UStG) lassen sich noch nicht kennzeichnen und zählen mit.
- Restore (F1) setzt Datensätze weiter auf den Backup-Stand zurück; nachvollziehbar über das Protokoll.

## Entscheidungen (User, 2026-10-20)

- **Fremdänderungen** (Fehlertexte, 13 Dateien seit 16.10.): vorab separat committet → `39befa0`.
- **F6:** Storno eines Vorgangs aus einem abgeschlossenen Jahr lässt dieses Jahr unverändert und wirkt
  als Gegenbuchung in der Periode des Stornodatums.
- **F8:** „Alle Daten löschen“/„Firma löschen“ bleibt möglich, aber mit Warnung (8/10 Jahre Aufbewahrung,
  Export-Angebot vorher); der Rechnungsnummern-Zähler wird nie zurückgesetzt.
- **U04:** Kleinunternehmer bekommen eine reduzierte UVA-Ansicht (nur §13b-Kennzahlen und Zahllast),
  sobald im Zeitraum §13b-Fälle existieren; sonst bleibt der bisherige Hinweis.
