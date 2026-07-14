# USt-Regelbesteuerung — fn-checker-Befunde + Restliste (P0-2, 2026-07-13)

Browser-Erstverifikation aller 5 Feature-Flächen (Soll/Ist, §14-Sperre, Reverse Charge,
SKR-Badges, OSS) + fn-checker-Deep-Review der Rechenlogik.
**Gefixt + browserverifiziert: Commits `6c3220a` + `ecdfeee`.**

## Gefixt (18 Befunde → 14 erledigt)

| Schwere | Befund | Fix |
|---|---|---|
| Kritisch | RC-Automatik auf Standalone-Rechnungsseite komplett tot (Vorsteuer.EU_LAENDER nicht geladen) | EU_LAENDER_FALLBACK in rechnung.js (6c3220a) |
| Kritisch | Phantom-Vorsteuer: `p.steuersatz` statt `p.ustSatz` + `\|\|19` machte 0 % unmöglich (vorsteuer/bilanz/ustvoranmeldung) | Feld + null-Guard überall (ecdfeee) |
| Kritisch | UVA zog verknüpfte Retouren doppelt ab (Storno + erstattungBetrag) → Steuerverkürzung | Storno-Guard wie EÜR; Satz vom verknüpften Verkauf (ecdfeee) |
| Kritisch | DATEV-Export verschluckte alle Direktverkäufe, sobald eine Rechnung existierte | Sales ohne `_invoiceId` immer exportieren, inkl. Käufer-Versand (ecdfeee) |
| Hoch | OSS-Schwelle prüfte nur laufendes Jahr (§3c Abs. 4: Vorjahr UND lfd. Jahr) | Beide Jahre in UVA-Gate + OSS-Badge „(Vorjahr)" (ecdfeee) |
| Hoch | Manuelle „Sonstige Vorsteuer" fehlte komplett in der UVA | fließt in Kz. 66 (ecdfeee) |
| Hoch | Manueller ig_erwerb ohne erwerbsteuer → einseitiger Kz.-61-Abzug | erwerbsteuer = vorsteuer beim Speichern (ecdfeee) |
| Hoch | Retouren ohne steuersatz-Feld → alle im 19%-Topf | Satz vom verknüpften Verkauf; unverknüpft weiterhin 19 % (ecdfeee) |
| Mittel | RC-Rechnung: nachträglich hinzugefügte Position startete mit 19 % | applyReverseChargeCheck im addPosition (6c3220a) |
| Mittel | Ist-UVA: Sale übernahm Steuersatz der Rechnung nicht (0 %/7 % → 19 %) | sale.steuersatz bei einheitlichem Satz (6c3220a) |
| Mittel | UVA-Stat-Karte „Kz. 66" zeigte Gesamt inkl. §13b/IG (Doppelabzug-Falle) | zeigt vorsteuerEinkaufAusgaben (ecdfeee) |
| Mittel | 0%-Zweig bei Ausgaben unerreichbar → 19/119 auf steuerfreie Ausgaben | null-Guard statt \|\|-Kette (ecdfeee) |
| Mittel | menge leer→0, Auswerter rechneten \|\|1 → Phantomumsatz (UVA/OSS/DATEV) | überall \|\|0 wie die Rechnung selbst (ecdfeee) |
| Edge | isInPeriod: ungültiges Datum zählte in JEDER Periode | isNaN-Guard (ecdfeee) |

## OFFEN — bekannt, priorisiert (nicht launch-blockierend, aber vor breiter Nutzung angehen)

1. **Gutschriften mindern nirgends den Umsatz (§17 UStG)** — KRITISCH, größter offener Punkt.
   `typ==='gutschrift'` ist reines Anzeige-Dokument; UVA/DATEV/EÜR ignorieren sie. Wer eine
   Gutschrift stellt, zahlt USt auf stornierten Umsatz. Braucht Design: Gutschrift als negative
   Umsatzzeile in UVA + DATEV + Sales-Sync. → eigene Session.
2. **Kz. 41 vs. Kz. 21**: Alle 0%-EU-B2B-Umsätze laufen als „ig. Lieferung" (Kz. 41, Ware).
   Dienstleistungen gehören in Kz. 21 + ZM „Sonstige Leistungen" → ZM-Abgleich-Diskrepanz beim
   FA für reine Dienstleister. Warnhinweis eingebaut (ecdfeee); echte Lösung braucht ein
   Ware/Leistung-Feld an Position oder Rechnung.
3. **Ist-Modus strukturell**: Kz. 41/43 bleiben leer (Sales kennen kein Kundenland), kein
   OSS-Ausschluss im Ist-Zweig, Misch-Rechnung (19+7 %) landet komplett im 19%-Topf.
   Betrifft nur Ist-Versteuerer mit EU-Geschäft — dokumentierte Limitation.
4. **OSS unterjährig**: Wird die Schwelle im Q3 gerissen, kippen bei Neuberechnung auch Q1/Q2
   rückwirkend aus der UVA (korrekt: nur ab Überschreiten). Perioden-Snapshots mildern das für
   eingereichte Quartale.
5. **vorsteuer.js-Labels** :182/:303 nennen Gesamtsummen (inkl. RC/IG/Sonstige) „Kz. 66" —
   gleiche Doppelabzug-Falle wie die gefixte UVA-Stat-Karte, nur auf der Vorsteuer-Seite.
6. **calcBrutto nutzt aktuelle §19-Einstellung für historische Rechnungen** — nach Wechsel
   Kleinunternehmer→Regel springen Anzeigebeträge alter Rechnungen. isKlein-Flag auf der
   Rechnung persistieren.
7. **Exotische Steuersätze** (8.1/2.6 CH nach Landwechsel) fallen stillschweigend aus allen
   UVA-Töpfen.
8. **Kosmetik**: createSaleFromInvoice defaultet verkaufsplattform auf „Vinted" bei
   Rechnungszahlungen; Dashboard-Einnahmen-Karte zeigte im Test 1.313,99 € bei 3.785 € brutto
   Sales — im /qa-Sweep (P0-4) nachgehen.

## Testdaten-Hinweis
Preview-Testfirma „USt-Testfirma GmbH" (127.0.0.1:3398, localStorage) enthält Testkunden/-
rechnungen/-käufe aus dieser Session — bei Bedarf localStorage clearen.
