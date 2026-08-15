# Steuer-Feature-Audit (Delta-Check) — Funde (2026-08-11)

**Session-Prompt:** `plan/session-prompt-audit-10-steuern-delta-2026-08-10.md`
**Scope:** Nur Features/Änderungen seit dem Steuer-Audit vom 2026-07-23 — Teilzahlung,
Lager-Feature-Batch, §25a-Stand, Audit-Log-Abdeckung der neuen Module.
**Nicht neu aufgerollt:** EÜR-Grundlogik, §14-Pflichtangaben, §19-Grenzen, AfA, KSK-Beiträge —
alles bereits in [Audit #8 Steuer-Vergleich](funde-audit-05-vergleich-steuer-2026-08-10.md)
und im Juli-Audit geprüft.

---

## Zusammenfassung

Die **Teilzahlung ist steuerlich sauber gebaut** — §11 EStG Zuflussprinzip explizit umgesetzt,
Doppelzählung bei der Schlusszahlung aktiv verhindert, §17 UStG für Gutschriften, satzgenaue
Aufteilung. Das ist besser gemacht, als der Prompt vermuten ließ.

Zwei echte Funde, beide vom selben Typ: **eine Schutzmaßnahme greift an der falschen Stelle
bzw. gar nicht.**

| # | Fund | § | Severity |
|---|---|---|---|
| D1 | Teilzahlung bei gemischten Steuersätzen wird blockiert — obwohl der Store es längst kann | §11 EStG / §13 UStG | 🟠 Mittel |
| D2 | Lager-Massenimporte schreiben Einkäufe **und Verkäufe** am Audit-Log vorbei | §146 IV AO / GoBD Rz. 64 | 🔴 Hoch |

---

## 🔴 D2 — Lager-Massenoperationen umgehen das GoBD-Audit-Log

`js/store.js` protokolliert konsequent: **42 `_addAuditEntry()`-Aufrufe** mit sieben Aktionsarten
(`erstellt`, `bearbeitet`, `loeschung`, `storniert`, `status_geaendert`, `import`,
`teilzahlung_erfasst`), jeweils mit Vorher-/Nachher-Werten und Einbindung in die Hash-Kette.
`savePurchase()` ([js/store.js:1415](../js/store.js#L1415)) und `saveSale()` tun genau das.

**`lager/page.js` umgeht diese Funktionen an fünf Stellen** und schreibt direkt in den Store:

| Stelle | Was |
|---|---|
| [lager/page.js:1627](../lager/page.js#L1627) | `await Store.setAsync('purchases', [...existing, ...newRecords])` — Batch-Import |
| [lager/page.js:2015-2016](../lager/page.js#L2015) | `setAsync('purchases', …)` **und** `setAsync('sales', …)` |
| [lager/page.js:2454](../lager/page.js#L2454) | `setAsync('sales', [...existingSales, ...newSales])` — Verkaufs-Import |
| [lager/page.js:2465](../lager/page.js#L2465) | `setAsync('purchases', allPurchases)` — Massen-Statuswechsel auf „verkauft" |

`Store.setAsync()` ([js/store.js:259-275](../js/store.js#L259)) ist ein reiner Schreibpfad:
Cache setzen, IndexedDB schreiben, Fehler behandeln. **Kein `_addAuditEntry`.**

**Warum das steuerlich zählt:** Geschrieben werden `purchases` (= Wareneinkauf, EÜR-Betriebsausgabe)
und `sales` (= Betriebseinnahmen). Beides ist buchungsrelevant im Sinne des §146 Abs. 4 AO. Ein
Nutzer kann über den Lager-Import mehrere hundert Einkäufe und Verkäufe anlegen und mit dem
Massen-Statuswechsel Bestände auf „verkauft" setzen — **ohne dass davon eine einzige Zeile im
Protokoll erscheint**. In einer Betriebsprüfung ist genau das die Lücke, die auffällt: Das
Protokoll wirkt vollständig (die Hash-Kette ist ja intakt), zeigt aber die umsatzstärksten
Vorgänge nicht.

Fairerweise: `Store._stampRecord()` wird an diesen Stellen aufgerufen
([lager/page.js:2014, 2463](../lager/page.js#L2014)), die Datensätze bekommen also Zeitstempel.
Das ist Datenhygiene, aber **kein Protokolleintrag** — Vorher/Nachher-Werte und die Einbindung
in die Kette fehlen.

**Fix:** Für Massenoperationen einen Sammel-Eintrag schreiben, statt 300 Einzeleinträge zu
erzeugen. Der Bulk-Pfad existiert dafür bereits:

```javascript
// js/store.js:1089 — _addAuditEntriesBatch() schreibt viele Einträge in EINER Operation,
// Hash-Kette bleibt gültig (jeder prevHash = checksum des Vorgängers)
```

Alternativ ein einzelner Eintrag pro Import mit Anzahl und Summe im `details`-Feld
(`'Lager-Import: 312 Einkäufe, 18.450,00 EUR'`) — das reicht für die Nachvollziehbarkeit und
bläht das Protokoll nicht auf. Die Aktionsart `import` ist bereits definiert und wird anderswo
genutzt.

**Priorität:** Höchster Fund dieses Audits. Betriebsprüfungsrisiko, und der Fix ist klein, weil
die Infrastruktur (`_addAuditEntriesBatch`) fertig danebenliegt.

---

## 🟠 D1 — Teilzahlung bei gemischten Steuersätzen wird grundlos blockiert

[rechnungen/js/dokumente.js:28-31](../rechnungen/js/dokumente.js#L28) blockiert Teilzahlungen,
sobald eine Rechnung 7 %- **und** 19 %-Positionen enthält:

```javascript
// v1-Einschränkung: Store.createSaleFromInvoice() kann einer Teilzahlung nur EINEN
// Steuersatz mitgeben (für die Ist-UVA). Bei gemischten Sätzen über die Positionen ist
// der anteilige Satz nicht eindeutig, daher werden Teilzahlungen bei solchen Rechnungen
// abgelehnt statt falsch verbucht.
function hasMixedVatRates(invoice) { … }
```

Meldung an den Nutzer:
> „⛔ Teilzahlungen bei gemischten MwSt-Sätzen (7%/19%) werden aktuell nicht unterstützt —
> bitte Schlusszahlung abwarten oder Rechnung mit einheitlichem Steuersatz stellen."

**Die Begründung stimmt nicht mehr.** `createSaleFromInvoice()` teilt eine Teilzahlung
inzwischen satzgenau auf ([js/store.js](../js/store.js)):

```javascript
const scale = teilAbs / totalAbs;
Object.keys(perRateBrutto).forEach(k => { steuersaetzeGroups[k] = perRateBrutto[k] * scale; });
…
} else if (distinctRates.length > 1) {
    sale.steuersaetze = nonZero;   // { "7": 107.00, "19": 119.00 }
}
```

Der Kommentar direkt darüber sagt es selbst: *„Bei gemischten Sätzen (7 %+19 % auf derselben
Rechnung) bleibt die satzgenaue Aufteilung über `sale.steuersaetze` erhalten, statt auf einen
einzigen Wert zu kollabieren."* Und die UVA wertet das Feld korrekt aus
([js/ustvoranmeldung.js:58, 68-71](../js/ustvoranmeldung.js#L58)).

Die UI-Sperre ist also ein **Relikt**: Der Store-seitige Mangel, auf den sie sich beruft, wurde
später behoben (der Kommentar verweist auf „Fix Ist-UVA gemischte Sätze"), die Sperre selbst
wurde nie entfernt.

**Warum das steuerlich schadet — die Sperre verursacht genau den Fehler, den sie verhindern soll.**
Der Rat „bitte Schlusszahlung abwarten" führt dazu, dass ein im Dezember zugeflossener Teilbetrag
erst mit der Schlusszahlung im Januar erfasst wird. Das ist ein **Verstoß gegen §11 EStG** — und
exakt das Szenario, das der Zufluss-Sale ausweislich des Kommentars in
[js/store.js](../js/store.js) verhindern sollte:

> „Ohne diesen anteiligen Sale-Eintrag verschwindet eine z. B. im Dezember zugeflossene
> Teilzahlung komplett aus EÜR/Ist-UVA des Dezember-Zeitraums, wenn die Rechnung erst im Januar
> vollständig beglichen wird."

Betroffen sind genau die Rechnungen, die in der Reseller-Zielgruppe üblich sind: Bücher/Lebensmittel
mit 7 % plus Zubehör/Versand mit 19 % auf einer Rechnung.

**Fix:** `hasMixedVatRates()` und den zugehörigen Block in
[rechnungen/js/dokumente.js:660-663](../rechnungen/js/dokumente.js#L660) entfernen. Vorher mit
einem Testfall absichern (Rechnung 7 %+19 %, Teilzahlung, dann UVA-Kennzahlen prüfen) — die
Aufteilung erfolgt **proportional zum Anteil jedes Satzes an der Gesamtrechnung**, was mangels
Positionsauswahl im Dialog die richtige Standardannahme ist, aber im Zweifel mit dem
Steuerberater abzustimmen wäre. Ein Hinweistext im Dialog („Die Zahlung wird anteilig auf die
enthaltenen Steuersätze verteilt") wäre ehrlicher als die heutige Blockade.

---

## Teilzahlung — was geprüft wurde und stimmt

✅ **§11 EStG Zuflussprinzip.** `addRechTeilzahlung()` erzeugt für jede Teilzahlung einen
eigenen Sale mit dem **tatsächlichen Zahlungsdatum** (`datum: opts.teilzahlungDatum`), nicht
mit dem Rechnungsdatum. Damit landet der Zufluss im richtigen EÜR- und Ist-UVA-Zeitraum.

✅ **Keine Doppelzählung.** Bei der Schlusszahlung werden bereits per Teilzahlung erfasste
Beträge abgezogen — sowohl in der Summe als auch **pro Steuersatz**:
```javascript
const bereitsErfasstSales = this.getSales(true)
    .filter(s => s._invoiceId === invoice.id && s._teilzahlung && !s.storniert);
brutto -= bereitsErfasst;
```
Der `!s.storniert`-Filter ist wichtig und richtig: eine stornierte Teilzahlung darf die
Schlusszahlung nicht mindern.

✅ **§17 UStG bei Gutschriften.** Gutschriften werden mit negativem Betrag verbucht, und die
Vorzeichenumkehr wird auch auf die Satz-Aufteilung angewendet.

✅ **§14-Sperre korrekt umgangen — mit Begründung.** `addRechTeilzahlung()` nutzt bewusst einen
eigenen Speicherpfad statt `saveRechInvoice()`, weil die §14-Inhaltssperre für
Rechnungs**inhalte** gilt; eine Teilzahlung ändert nur die Zahlungsverfolgung. Ohne das wäre die
Erfassung bei `status: 'versendet'` — dem Normalfall — dauerhaft unmöglich. Sauber gedacht.

✅ **Audit-Log greift.** `_addAuditEntry('teilzahlung_erfasst', …)` mit Vorher/Nachher-Objekt
und Klartext-Detail. Im Gegensatz zu D2 also korrekt protokolliert.

✅ **Kein Status-Pfusch.** Teilzahlungen ändern den Status-Enum bewusst nicht — die Rechnung
bleibt „offen"/„überfällig" und zählt im Mahnwesen und Dashboard weiter korrekt als ausstehend.
Das ist die richtige Entscheidung; ein eigener Status „teilbezahlt" hätte alle
Auswertungspfade angefasst.

✅ **Überzahlung abgefangen.** Deckt der Betrag die Restschuld, leitet der Dialog in den
regulären Bezahlt-Flow über (inkl. Lager-Sync), statt eine zweite Statuslogik zu pflegen.
`restbetrag()` klemmt zusätzlich auf `Math.max(0, …)`.

⚠️ **Eine bekannte Einschränkung, korrekt dokumentiert:** Alt-Teilzahlungen ohne eigene
Satz-Aufteilung fließen beim Abzug nur in den Gesamtbetrag, nicht satzgenau. Im Code als
„bekannte Einschränkung für Altdaten" vermerkt. Betrifft nur Daten aus der Zeit vor dem Fix —
kein Handlungsbedarf, aber beim nächsten Datenmodell-Schnitt mitnehmen.

---

## §25a Differenzbesteuerung — Stand bestätigt, unverändert

Auftragsgemäß nur bestätigt, nicht neu aufgerollt: Die bekannte Lücke — **7 %-Satz bei
Anlage-2-Fällen** (Bücher, Kunstgegenstände) — steht unverändert offen und ist in
`plan/OFFEN.md` Abschnitt 2.1 als bewusst zurückgestellt vermerkt (braucht juristische Recherche,
keine Coding-Aufgabe). Keine Änderung am Modul seit dem Juli-Audit, keine neuen Funde.

---

## Lager-Feature-Batch — steuerliche Auswirkungen

Abgesehen von **D2** (Audit-Log) unauffällig:

✅ **Bestandsbewertung.** Die EÜR nach §4 Abs. 3 EStG kennt keine Bestandsveränderung —
Wareneinkauf ist im Zahlungsjahr Betriebsausgabe, unabhängig davon, ob die Ware noch im Lager
liegt. Das Lager-Modul führt konsequent **keine** Bestandsbewertung in die EÜR ein; der
Lagerwert wird nur informativ angezeigt. Richtig so.

✅ **Verkauf koppelt an den Zahlungszeitpunkt**, nicht an den Lager-Statuswechsel — der
Wareneinkauf wird laut Kommentar in `createSaleFromInvoice()` „unabhängig über den
Einkaufs-Bezahlzeitpunkt abgezogen, nicht über diese Sale-Verknüpfung". Konsistent mit §11 EStG.

⚠️ **Anschlussfrage zu D2:** Der Massen-Statuswechsel auf „verkauft"
([lager/page.js:2465](../lager/page.js#L2465)) ändert den Status von Einkäufen, ohne einen
Protokolleintrag zu schreiben. Für die EÜR ist der Status folgenlos (siehe oben), für die
Nachvollziehbarkeit des Warenflusses in einer Prüfung aber nicht. Mit D2 zusammen erledigen.

---

## Priorisierung nach Risiko

```
🔴 BETRIEBSPRÜFUNGSRISIKO
  D2  Lager-Massenimporte ohne Protokolleintrag (§146 IV AO). Einkäufe UND Verkäufe
      betroffen. Fix klein: _addAuditEntriesBatch() liegt fertig daneben.

🟠 FALSCHE PERIODENZUORDNUNG
  D1  Blockade bei gemischten Steuersätzen zwingt zum Warten auf die Schlusszahlung
      und verursacht damit genau den §11-EStG-Fehler, den die Zufluss-Logik verhindert.
      Fix: veraltete Sperre entfernen, vorher Testfall.

🟢 UNVERÄNDERT / KEIN HANDLUNGSBEDARF
  §25a-7%-Lücke (bewusst zurückgestellt) · Teilzahlungs-Kernlogik · Lager-Bewertung in EÜR
```

**Reihenfolge:** D2 zuerst — es ist der einzige Fund mit Prüfungsrisiko und der Fix ist klein.
D1 danach, mit Testfall (7 %+19 %-Rechnung → Teilzahlung → UVA-Kennzahlen gegenprüfen).
