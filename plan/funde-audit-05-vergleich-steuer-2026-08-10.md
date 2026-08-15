# Steuerlicher Vergleich vs. Konkurrenz — Funde (2026-08-10)

**Session-Prompt:** `plan/session-prompt-audit-05-vergleich-steuer-2026-08-10.md`
**Scope:** Web 1.7 vs. sevDesk, Lexware Office (ex lexoffice), FastBill, DATEV.
**Methode:** Stackr-Spalte durchgehend am Code belegt; Rechtsstände (§19-Grenzen, KSA-Satz,
GWG-Grenze, Bagatellgrenze) per Web-Recherche für das Prüfjahr verifiziert statt aus dem
Gedächtnis übernommen.

---

## Zusammenfassung

Steuerlich ist Stackr **kein Leichtgewicht** — an mehreren Stellen ist es genauer als der Markt.
Die §19-Grenzprüfung kennt die historischen Fassungen und die strikte „übersteigt"-Auslegung, das
Audit-Log ist eine echte Hash-Kette mit Vorher/Nachher-Werten und externem Anker, die
Rechnungsprüfung blockt §14c-Fehler aktiv ab. Das findet man so bei den Wettbewerbern nicht.

Die Lücken sind dafür klar benennbar und liegen in drei Gruppen:

1. **Formales** — kein GoBD-/IDEA-Z3-Export, kein GoBD-Testat.
2. **Übermittlung** — kein ELSTER (bekannt, architektonisch, siehe Feature-Gap-Audit #13).
3. **Wartung** — mehrere gesetzliche Werte sind als **jahresfeste Konstante** hinterlegt statt
   jahresabhängig. Einer davon wird am **1.1.2027 stillschweigend falsch**.

| # | Fund | Art | Severity |
|---|---|---|---|
| T1 | KSA-Satz als Konstante → ab 2027 falsch, für 2025-Daten schon heute falsch | Rechenfehler (künftig) | 🔴 Hoch |
| T2 | Kein GoBD-/IDEA-Z3-Export für die Betriebsprüfung | Gesetzliche Pflicht §147 VI AO | 🟠 Mittel |
| T3 | Steuertermine: kein Monats-Rhythmus, keine Dauerfristverlängerung, keine §108-AO-Verschiebung | Unvollständig | 🟠 Mittel |
| T4 | Audit-Log-Zeitstempel ist Client-Zeit (Rückdatierung ohne Cloud-Sync unerkannt) | GoBD-Schwäche | 🟠 Mittel |
| T5 | KSA-Bagatellgrenze gilt pauschal, obwohl sie für „typische Verwerter" nicht greift | Rechtliche Feinheit | 🟡 Niedrig |
| T6 | Leitweg-ID im XML unterstützt, aber kein Eingabefeld im UI → B2G unbrauchbar | Lücke | 🟡 Niedrig |
| T7 | Kein GoBD-Testat (IDW PS 880) wie Lexware | Marktstandard | 🟡 Niedrig |

---

## Compliance-Matrix

| Anforderung | Stackr | sevDesk | Lexware Office | FastBill | DATEV |
|---|---|---|---|---|---|
| GoBD-Audit-Log mit Vorher/Nachher | ✅ **+ Hash-Kette + Cloud-Anker** | ✅ | ✅ | ✅ | ✅ |
| GoBD-Testat (IDW PS 880) | ❌ | ⚠️ „nach Herstellerangabe geprüft" | ✅ **testiert** | ? | ✅ |
| GoBD-/IDEA-Z3-Prüfer-Export | ❌ **(T2)** | ✅ GoBD-ZIP | ✅ IDEA/Z3/XML | ? | ✅ |
| DATEV-Export | ✅ SKR03 **+ SKR04** | ✅ DATEV-ASCII | ✅ | ✅ | ✅ |
| Verfahrensdokumentation | ✅ **mitgeliefert** | ⚠️ | ✅ (StB-Zugang) | ? | ✅ |
| §14 UStG Pflichtangaben | ✅ **inkl. §14c-Sperre** | ✅ | ✅ | ✅ | ✅ |
| E-Rechnung XRechnung (Ausgang) | ✅ EN 16931 / CII | ✅ | ✅ (erst XL-Tarif) | ✅ | ✅ |
| ZUGFeRD-Hybrid-PDF | ❌ nur Standalone-XML | ✅ | ✅ | ✅ | ✅ |
| E-Rechnung-Eingang prüfen | ✅ | ✅ | ✅ | ✅ | ✅ |
| Leitweg-ID (B2G) | ⚠️ **nur im XML (T6)** | ✅ | ✅ | ? | ✅ |
| ELSTER-Direktübermittlung | ❌ nur CSV | ✅ ohne Zertifikat | ✅ ohne Zertifikat | ⚠️ | ✅ |
| §19 Schwellen-Überwachung | ✅ **jahresabhängig + Vorwarnung** | ⚠️ | ⚠️ | ⚠️ | — |
| AfA linear / degressiv / GWG | ✅ **alle drei** | ⚠️ | ⚠️ | ❌ | ✅ |
| KSA (Auftraggeber-Abgabe) | ✅ **(T1: Satz jahresfest)** | ❌ | ❌ | ❌ | ✅ |
| KSK-Beiträge (Künstlersicht) | ✅ | ❌ | ❌ | ❌ | ⚠️ |
| Fristenkalender | ⚠️ **10 feste Termine (T3)** | ✅ | ✅ | ✅ | ✅ |
| §25a Differenzbesteuerung | ✅ | ⚠️ | ❌ | ❌ | ✅ |
| Kassenbuch, Fahrtenbuch, OSS | ✅ | ⚠️ teilw. | ⚠️ teilw. | ❌ | ✅ |

---

## 🔴 T1 — KSA-Satz ist eine Konstante und wird 2027 falsch

`js/ausgaben.js:16-17`:

```javascript
_KSA_SATZ: 0.049,          // 2026, gesunken von 5,0% (2025)
_KSA_BAGATELLGRENZE: 1000, // 2026, gestiegen von 700€ (2025)
```

**Für 2026 stimmen beide Werte** — per Recherche bestätigt: Der Abgabesatz sinkt 2026 von 5,0 %
auf **4,9 %**, die Bagatellgrenze steigt auf **1.000 €**. Insoweit sauber gepflegt.

**Das Problem ist die Bauform.** `_ksaJahressumme(year)` rechnet für ein **beliebiges Jahr**, der
Satz ist aber jahresfest verdrahtet. Daraus folgen zwei Fehler:

1. **Rückwärts, schon heute:** Wer 2025er-Honorare auswertet, bekommt sie mit 4,9 % statt der
   damals geltenden 5,0 % gerechnet — und mit einer Bagatellgrenze von 1.000 € statt 700 €.
   Ein Nutzer mit 850 € Honoraren in 2025 wird als **nicht abgabepflichtig** ausgewiesen,
   obwohl er es war.
2. **Vorwärts, ab 1.1.2027:** Der Abgabesatz **steigt 2027 wieder auf 5,0 %**. Ohne Codeänderung
   rechnet Stackr ab dann dauerhaft zu niedrig — **still, ohne Warnung, ohne Hinweis**.

Bemerkenswert: Dieselbe Codebasis macht es beim §19 **vorbildlich richtig**
([js/app.js:1039-1043](../js/app.js#L1039)) — `_getUstGrenzen(year)` liefert die im jeweiligen Jahr
geltende Fassung inklusive Historie. Genau dieses Muster fehlt bei der KSA.

**Fix:** `_KSA_SATZ` und `_KSA_BAGATELLGRENZE` durch ein `_getKsaWerte(year)` nach dem Vorbild von
`_getUstGrenzen` ersetzen:

```javascript
_getKsaWerte(year) {
    if (year >= 2027) return { satz: 0.050, bagatelle: 1000 };  // KSA-VO 2027
    if (year >= 2026) return { satz: 0.049, bagatelle: 1000 };  // KSA-VO 2026
    return              { satz: 0.050, bagatelle: 700  };       // bis 2025
},
```

Rund zehn Zeilen — und danach ist der Wert für 2027 bereits korrekt hinterlegt, statt zum
Jahreswechsel unbemerkt zu kippen.

---

## 🟠 T2 — Kein GoBD-/IDEA-Z3-Export für die Betriebsprüfung

Suche nach `gdpdu`, `index.xml`, `Z1`/`Z2`/`Z3`, `Datenträgerüberlassung` im gesamten Projekt:
**null Treffer**.

§147 Abs. 6 AO gibt dem Prüfer das Recht auf **Datenträgerüberlassung (Z3)** in einem
strukturierten, maschinell auswertbaren Format — in der Praxis der IDEA-/GDPdU-Export mit
`index.xml` plus Beschreibungsdatei. Beide Vergleichsprodukte liefern das: Lexware Office
unterstützt den strukturierten Export (dort „IDEA-Export, Z3-Export, GDPdU-Export oder
XML-Export" genannt), sevDesk bietet einen „GoBD-konformen ZIP-Export für Prüfungszwecke".

Stackr hat als Ersatz den **DATEV-Buchungsstapel** ([js/datev.js](../js/datev.js), SKR03 und
SKR04) — den viele Prüfer in der Praxis akzeptieren, weil er über die Steuerberater-Schiene
einlesbar ist. Formal ist es aber nicht dasselbe, und im Zweifel entscheidet der Prüfer.

**Einordnung:** Kein akutes Risiko für die typische Solo-Zielgruppe (Betriebsprüfungen sind dort
selten), aber die eine Stelle, an der ein Steuerberater beim Vergleich sagen wird „das kann
Lexware". Aufwand: mittel — die Daten liegen alle vor, es fehlt die Verpackung (CSV-Dateien +
`index.xml` + DTD in einem ZIP).

**Pluspunkt, der das teilweise auffängt:** Stackr liefert eine
[`verfahrensdokumentation.html`](../verfahrensdokumentation.html) **mit**. Bei Lexware bekommt man
die nur über den Steuerberater-Zugang, bei sevDesk muss man sie sich selbst schreiben. Für einen
Solo-Selbstständigen ist das der Teil der GoBD, an dem er real scheitert — und Stackr löst ihn.

---

## 🟠 T3 — Fristenkalender ist zu dünn

`js/steuertermine.js:5-18` definiert genau **10 feste Termine**: EÜR/Steuererklärung (31.07.),
PStTG-Jahresbericht (31.03.), 4× Gewerbesteuer-Vorauszahlung, 4× UStVA quartalsweise.

Drei Lücken:

1. **Kein Monatsrhythmus.** Wer im Vorjahr über 7.500 € Umsatzsteuer hatte, muss **monatlich**
   voranmelden. Genau diese Nutzer — die wachsenden — bekommen von Stackr nur vier Quartalstermine
   und damit acht fehlende Fristen im Jahr.
2. **Keine Dauerfristverlängerung.** Weder die Verschiebung um einen Monat noch die
   1/11-Sondervorauszahlung (Frist 10.02.) sind abgebildet. Wer sie beantragt hat, sieht dauerhaft
   die falschen Daten.
3. **Keine §108-Abs.-3-AO-Verschiebung.** Fällt eine Frist auf Samstag, Sonntag oder Feiertag,
   verschiebt sie sich auf den nächsten Werktag. Der 10.01.2026 ist ein **Samstag** → gesetzliche
   Frist wäre der 12.01. Stackr zeigt den 10.01.

Punkt 3 ist harmlos (die Anzeige ist zu früh, nicht zu spät). Punkt 1 und 2 sind es nicht: dort
fehlen Termine ganz bzw. sind falsch.

**Fix:** UStVA-Termine aus `settings.ustRhythmus` (monatlich/quartalsweise) generieren statt hart
zu listen, ein Flag für Dauerfristverlängerung, und eine kleine `_naechsterWerktag()`-Hilfe für
§108 AO. Zusätzlich fehlt die Lohnsteuer-Anmeldung, obwohl `js/lohnsteuer.js` existiert.

---

## 🟠 T4 — Audit-Log-Zeitstempel ist Client-Zeit

Das Audit-Log ist handwerklich stark ([js/store.js:1061-1085](../js/store.js#L1061)):
`oldValues`/`newValues`, `prevHash`-Kette ab `GENESIS`, `checksum` je Eintrag, Geräte-ID als
Merge-Tiebreak. Manipuliert jemand einen Eintrag nachträglich, brechen **alle folgenden**
`prevHash`-Prüfungen. Das erfüllt GoBD Rz. 64 sauber.

Die verbleibende Schwäche ist der Zeitstempel:

```javascript
timestamp: new Date().toISOString(),   // Client-Uhr
```

Wer die Systemuhr zurückstellt, kann einen **rückdatierten** Eintrag erzeugen — die Hash-Kette
bleibt gültig, weil sie Inhalte verkettet, nicht Zeiten. Der externe Cloud-Anker
([api/sync.js:322](../api/sync.js#L322), serverseitiges `ts: Date.now()`) fängt genau das ab —
**aber nur für Nutzer mit aktiviertem Cloud-Sync**, und der ist opt-in.

**Ehrliche Einordnung:** Bei einer Local-First-App ohne Serverzwang ist das nicht vollständig
lösbar, und die Wettbewerber haben es nur deshalb besser, weil sie ohnehin serverseitig speichern.
Der Anker ist die richtige Antwort — er sollte nur **beworben und empfohlen** werden, statt als
stille Option zu existieren. Vorschlag: im Protokoll-Modul einen Hinweis „Ohne Cloud-Anker ist die
Kette nur geräteintern beweiskräftig" plus Aktivierungs-Link.

---

## 🟡 T5, T6, T7 — kurz

**T5 — KSA-Bagatellgrenze zu pauschal.** `js/ausgaben.js:102` prüft
`ksaSumme > _KSA_BAGATELLGRENZE` für alle. Die Bagatellgrenze gilt laut KSVG aber **nicht für
„typische Verwerter"** (Verlage, Werbeagenturen, Theater u. ä. nach §24 Abs. 1 KSVG) — die sind
ab dem ersten Euro abgabepflichtig. Für Stackrs Zielgruppe (Reseller, Freelancer) ist der
Regelfall der richtige, aber ein Hinweistext an der Kachel wäre ehrlich.

**T6 — Leitweg-ID nur im XML.** `rechnungen/js/xrechnung.js:256-258` schreibt
`<ram:BuyerReference>` korrekt, **wenn** `inv.leitwegId` gesetzt ist. Ein Eingabefeld dafür gibt
es nirgends (Suche über `rechnungen/` außerhalb von `xrechnung.js`: null Treffer). Damit ist der
B2G-Fall (Rechnung an Behörden) praktisch nicht bedienbar, obwohl die halbe Arbeit getan ist.
Fix: ein Textfeld im Rechnungsformular, sichtbar wenn der Kunde als Behörde markiert ist.

**T7 — Kein GoBD-Testat.** Lexware Office hat ein Testat nach **IDW PS 880**, sevDesk wirbt mit
„GoBD-geprüft nach Herstellerangabe". Stackr hat keins. Ein Testat kostet Geld und bindet an
einen Versionsstand — für ein Ein-Personen-Produkt kaum zu rechtfertigen. Wichtiger ist die
sprachliche Sauberkeit: **niemals „GoBD-zertifiziert" schreiben**, sondern „GoBD-konform
umgesetzt" mit Verweis auf die mitgelieferte Verfahrensdokumentation. (Für das Copy-Audit #15
vormerken.)

---

## Was Stackr besser macht als der Markt

Diese Punkte sind am Code belegt und sollten im Marketing auftauchen — sie tun es heute nicht:

**§19-Grenzprüfung mit historischen Fassungen.** `_getUstGrenzen(year)`
([js/app.js:1039](../js/app.js#L1039)) kennt 25.000/100.000 € ab 2025, 22.000/50.000 € für
2020–2024 und 17.500/50.000 € davor. Dazu die **strikte `>`-Auslegung** („übersteigt", also bei
exakt 100.000,00 € bleibt der Status bestehen), eine 90-%-Vorwarnung ab 22.500 € und
company-gescopte Dismiss-Flags, damit die Warnung einer Firma nicht die der anderen unterdrückt.
Der Gesamtumsatz schließt erstattete Versandkosten ein — richtig nach §19 Abs. 3 UStG und die Art
Detail, an der Konkurrenzprodukte scheitern.

**§14c-Sperre für Kleinunternehmer.** [rechnungen/js/rechnung.js:1033](../rechnungen/js/rechnung.js#L1033)
verhindert aktiv, dass eine Kleinunternehmer-Rechnung je einen Steuerbetrag ausweist — genau der
Fehler, der nach §14c Abs. 1 UStG dazu führt, dass man die unberechtigt ausgewiesene Steuer
schuldet. Andere Tools warnen hier nicht, sie lassen es zu.

**Reverse-Charge mit Kz.-41/21-Unterscheidung.** `taxCategoryFor()` in
[xrechnung.js:36-39](../rechnungen/js/xrechnung.js#L36) trennt Ware (§6a UStG, steuerfreie ig.
Lieferung) von Leistung (§13b UStG, Reverse Charge), statt beides pauschal zu kollabieren — die
Rechtsfolgen unterscheiden sich beim Steuerschuldner. Eine Rechnung darf beides mischen, und
Stackr bildet das ab.

**AfA vollständig.** Linear, degressiv **mit korrekter zeitanteiliger Vergleichsrechnung beim
Wechsel auf linear** ([js/afa.js:47-57](../js/afa.js#L47)) und GWG-Sofortabschreibung mit
korrekten 800 € netto nach §6 Abs. 2 EStG, ausdrücklich **ohne** Monatsregel. FastBill hat gar
keine AfA.

**KSA + KSK gleichzeitig.** Stackr rechnet sowohl die Künstlersozialabgabe des Auftraggebers
(`js/ausgaben.js`) als auch die KSK-Beiträge aus Künstlersicht (`js/ksk.js`, mit
Sozialversicherungsrechengrößen 2025 **und** 2026). Keiner der drei Wettbewerber hat das.

---

## Risiken getrennt nach Pflicht vs. Marktstandard

```
🔴 GESETZLICH RELEVANT — falsche Zahlen
  T1  KSA-Satz jahresfest → ab 1.1.2027 dauerhaft zu niedrig, für 2025-Daten schon
      heute falsch. Fix ~10 Zeilen, Muster existiert bereits (_getUstGrenzen).

🟠 GESETZLICHE PFLICHT — Formalie fehlt
  T2  Kein Z3-/IDEA-Export (§147 VI AO). DATEV-Stapel als praktischer Ersatz vorhanden,
      formal aber nicht gleichwertig.
  T3  UStVA-Monatsrhythmus + Dauerfristverlängerung fehlen → betrifft die wachsenden Nutzer.

🟠 MARKTSTANDARD — kein Rechtsverstoß, aber Vergleichsnachteil
  T4  Client-Zeitstempel (Cloud-Anker löst es, ist aber opt-in)
  T6  Leitweg-ID ohne UI → B2G nicht bedienbar
  T7  Kein IDW-PS-880-Testat → Wortwahl im Marketing entsprechend vorsichtig

🟢 ERFÜLLT UND TEILWEISE BESSER ALS DER MARKT
  §19 (jahresabhängig, strikte Auslegung, Vorwarnung) · §14 inkl. §14c-Sperre ·
  §13b/§6a-Trennung · AfA linear/degressiv/GWG · §25a · Audit-Log mit Hash-Kette und
  externem Anker · Verfahrensdokumentation mitgeliefert · DATEV SKR03+SKR04 ·
  KSA + KSK · Kassenbuch, Fahrtenbuch, OSS
```

---

## Steuerliche Roadmap

1. **T1 — KSA jahresabhängig machen.** ~10 Zeilen, Vorbild `_getUstGrenzen` steht daneben.
   Der 2027er-Wert (5,0 %) ist bereits bekannt und kann gleich mit eingetragen werden. **Das ist
   der einzige Punkt, der zu falschen Zahlen führt — zuerst.**
2. **T3 — Steuertermine aus dem USt-Rhythmus generieren**, plus Dauerfristverlängerung und
   `_naechsterWerktag()` für §108 AO.
3. **T6 — Leitweg-ID-Feld ins Rechnungsformular.** Kleines Feld, öffnet den B2G-Fall.
4. **T4 — Cloud-Anker im Protokoll-Modul bewerben** statt still anbieten.
5. **T2 — Z3-/GDPdU-Export.** Größter Posten; erst sinnvoll, wenn Steuerberater ihn nachfragen.
6. **T5, T7** — Hinweistexte, keine Codeänderung.

---

## Quellen

- [Künstlersozialversicherung 2026: Abgabesatz sinkt auf 4,9 %](https://www.steuergo.de/blog/kuenstlersozialversicherung-2026-abgabesatz-sinkt-auf-49-prozent/)
- [Künstlersozialabgabe steigt 2027 auf 5,0 % (Haufe)](https://www.haufe.de/personal/entgelt/kuenstlersozialabgabe-neuer-abgabensatz-liegt-vor_78_421266.html)
- [Künstlersozialabgabe ab 2026: Absenkung + höhere Bagatellgrenze (LOHN + GEHALT)](https://www.lohnundgehalt-magazin.de/artikel/kuenstlersozialabgabe-ab-2026-absenkung-des-abgabesatzes-und-hoehere-bagatellgrenze/)
- [Lexware Office — Export für die Betriebsprüfung (IDEA/Z3/GDPdU)](https://help.lexware.de/de-form/articles/548270-export-fur-die-betriebsprufung)
- [Lexware Office — GoBD-Zertifikat (IDW PS 880)](https://www.lexware.de/gobd-zertifikat/)
- [sevdesk Test 2026 — GoBD-Export im Check](https://toolspick.de/buchhaltung/sevdesk-test/)
- [sevdesk Lexikon — GDPdU](https://sevdesk.de/lexikon/gdpdu/)
