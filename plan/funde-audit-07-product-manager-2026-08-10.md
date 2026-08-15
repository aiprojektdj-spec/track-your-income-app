# Product-Manager-Audit — Funde (2026-08-10)

**Session-Prompt:** `plan/session-prompt-audit-07-product-manager-2026-08-10.md`
**Scope:** Positionierung, Zielgruppenschärfe, Funnel, Preisstruktur, Roadmap-Reihenfolge.
**Abgrenzung:** Die Feature-Matrix gegen sevDesk/Lexware/FastBill steht bereits in
[Audit #13 Feature-Gap](funde-audit-03-feature-gap-2026-08-10.md) und wird hier **nicht wiederholt**.
Diese Datei beantwortet die Fragen, die dort offen blieben: *Für wen ist das Produkt eigentlich,
und in welcher Reihenfolge lohnt sich was?*

---

## Zusammenfassung

Stackr hat ein **Positionierungsproblem, kein Produktproblem**. 28 Module, steuerlich an mehreren
Stellen genauer als der Marktführer — aber drei beworbene Zielgruppen, die das Produkt sehr
unterschiedlich gut bedient. Und ein Funnel, der aktuell keiner ist.

| # | Fund | Art | Severity |
|---|---|---|---|
| P1 | Die kostenlose Local-Version ist **ungegated** (`PUBLIC_KEY_JWK: null`) | Monetarisierung | 🔴 Hoch |
| P2 | Drei Personas, aber nur eine wird wirklich gewonnen | Positionierung | 🔴 Hoch |
| P3 | Freelancer fehlen Stundensatz / Zeiterfassung / Projekt-Zuordnung — **null Treffer im Code** | Feature/Segment | 🟠 Mittel |
| P4 | Ein einziger Preis (15 €) gegen 3-Stufen-Wettbewerb | Pricing | 🟠 Mittel |
| P5 | GbR ist der stärkste unbesetzte Markt, wird aber nicht als Spitze geführt | Positionierung | 🟠 Mittel |
| P6 | Akademie startet mit „Was ist Reselling überhaupt?" für alle | Onboarding | 🟡 Niedrig |

**Korrektur eines eigenen früheren Funds:** siehe P6 — mein U12 aus dem UX-Audit war zu scharf.

---

## 🔴 P1 — Die kostenlose Version ist gar nicht begrenzt

`Local 1.7/js/license.js` implementiert eine ECDSA-P-256-Lizenzprüfung. Aktiv ist sie nicht:

```javascript
PUBLIC_KEY_JWK: null,        // Zeile 17
// Solange PUBLIC_KEY_JWK = null → Entwicklermodus (kein Check)
isDevMode() { return this.PUBLIC_KEY_JWK === null; }   // Zeile 47
```

Der Modulvergleich zeigt, was das bedeutet. Local und Web unterscheiden sich in **genau acht
Dateien**:

| | Dateien |
|---|---|
| **Nur in Web** | `whop-auth`, `cloud-sync`, `blob-attachments`, `stb-share`, `webhooks`, `landing`, `landing-v2`, `page-shell` |
| **Nur in Local** | `license` |

Davon sind `landing`, `landing-v2` und `page-shell` reine Web-Infrastruktur. Der **fachliche**
Mehrwert von Web gegenüber Local besteht also aus vier Dingen: Cloud-Sync, große Anhänge,
Steuerberater-Freigabe, Make.com-Webhooks.

Alles andere — EÜR, UStVA, Rechnungen, Lager, GbR, AfA, KSK, §25a, Kassenbuch, Fahrtenbuch,
Akademie, alle 28 Module — läuft in der kostenlosen Version **unbegrenzt und dauerhaft**.
Local hat sogar *mehr*: `schweiz.js`, `oesterreich.js` und `svs.js` sind dort noch aktiv, in Web
wurden CH/AT entfernt.

**Produktsicht:** Das ist kein Funnel, das ist ein kostenloser Wettbewerber im eigenen Haus.
Wer keine Cloud braucht — und ein Solo-Selbstständiger mit einem Rechner braucht sie oft nicht —
hat null Grund, 15 € im Monat zu zahlen.

**Einschränkung:** Ich sehe nur den Repo-Stand. Ob die ausgelieferte Local-Version einen
gesetzten `PUBLIC_KEY_JWK` hat, lässt sich hier nicht feststellen. Falls doch: Punkt erledigt.
Falls nicht, sind es drei Optionen:

1. **Lizenz scharf schalten** — Schlüssel setzen, Local als bezahlte Einmallizenz führen
   (Setup dafür ist gebaut: `tools/setup-keypair.js`).
2. **Local bewusst beschneiden** — z. B. auf eine Firma und ohne die Steuer-Spezialmodule.
   Das ist der klassische Weg, hat aber den Nachteil, dass die abgespeckte Version schlechter
   wirbt.
3. **Local als Marketing akzeptieren** und den Web-Wert klar auf Cloud/Multi-Device/StB legen —
   dann muss die Landingpage das aber auch **so** sagen, statt Web als „das Produkt" zu verkaufen.

Option 3 ist die ehrlichste zur Local-First-Haltung und passt zur Empfehlung aus dem
Feature-Gap-Audit (Wert nach hinten verlagern statt Client-Gate härten). Sie verlangt aber eine
andere Landingpage.

---

## 🔴 P2 — Drei Personas, eine wirklich bediente

Die Landingpage führt drei gleichrangige Persona-Karten
([index.html:410-450](../index.html#L410)): **Freelancer**, **GbR-Teams**, **Reseller**.
Die Nennungen im Text sind ebenfalls verteilt: GbR 18×, Reseller 11×, Kleinunternehmer 8×,
Freelancer 8×.

Der Code erzählt eine andere Gewichtung:

| Segment | Spezifische Module im Code | Bewertung |
|---|---|---|
| **Reseller** | `lager.js`, `materiallager.js`, `retouren.js`, §25a-Differenzbesteuerung (in 8 Dateien), 6 von 13 Akademie-Modulen | **Sehr stark** — im Vergleichsfeld einzigartig |
| **GbR** | `gbr.js`, `gbr-modul.js`, Gewinnverteilung im EÜR-Block, Sonderbetriebseinnahmen, eGbR-Register | **Stark** — echte Marktlücke |
| **Freelancer** | keine segment-spezifischen Module | **Schwach** — bekommt nur das, was alle bekommen |

Das ist keine Kritik am Gebauten: Reseller und GbR sind **beide gut getroffen**, und beide sind
Nischen, in denen sevDesk und Lexware nichts Vergleichbares haben. Das Problem ist, dass die
Kommunikation eine Gleichrangigkeit behauptet, die es nicht gibt — und damit die eigene Stärke
verwässert.

**Empfehlung:** Reseller und GbR nach vorn, Freelancer als *drittes* Segment mit ehrlichem
Anspruch („Rechnungen, EÜR, KSK, USt — der Standard, sauber gemacht"), nicht als gleichwertige
Spezialisierung. Ein Tool, das für zwei Nischen unschlagbar ist, verkauft sich besser als eines,
das für drei Gruppen „auch gut" ist.

**Fairnesshinweis zur Freelancer-Karte:** Die vier dort gemachten Versprechen werden **alle
eingelöst** — Rechnung mit Logo ✓, KSK-Berechnung ✓ (`js/ksk.js`), EÜR und UStVA ✓, Akademie mit
Krankenversicherungs- und Steuermodul ✓. Die Karte lügt nicht. Sie beschreibt nur einen
Basisumfang, den jeder Wettbewerber auch hat — im Gegensatz zu den beiden anderen Karten.

---

## 🟠 P3 — Freelancern fehlt die Abrechnungsgrundlage

Suche über `js/` und `rechnungen/js/` nach `stundensatz`, `zeiterfassung`, `projektnummer`:
**null Treffer.**

Für einen Reseller ist das egal — er rechnet Artikel ab, und dafür gibt es das Lager. Für einen
Freelancer ist es die Kernmechanik: Stunden erfassen → Stundensatz → Position auf der Rechnung →
Projekt-Rentabilität. sevDesk bietet Projektverwaltung und optionale Zeiterfassung; für Stackr
ist das die einzige echte Feature-Lücke, die **segmentspezifisch** ist (die anderen aus Audit #13
— Bank, OCR, ELSTER — treffen alle Segmente gleich).

**Entscheidung, die ansteht:** Entweder Freelancer als Zielgruppe ernsthaft bedienen (dann ist
Zeiterfassung + Projekt der Einstieg, geschätzt eine überschaubare Erweiterung des vorhandenen
Positionsmodells), oder die Zielgruppe bewusst als „Freelancer mit einfacher Abrechnung" führen
und die Energie in Reseller/GbR stecken.

**Meine Empfehlung: das Zweite.** Zeiterfassung ist ein eigenes Produktfeld mit eigener
UX-Erwartung (Timer, Wochenansicht, Nacherfassung), und es gibt dort viele gute, billige
Speziallösungen. Reseller-Lager und GbR-Gewinnverteilung sind dagegen Alleinstellungen, die
niemand sonst liefert — dort ist jeder investierte Tag mehr wert.

---

## 🟠 P4 — Ein Preis gegen einen gestuften Markt

| Anbieter | Einstieg | Mitte | Oben |
|---|---|---|---|
| Lexware Office | 6,90 € | 11,90 € (M) | **32,90 € (XL, erst hier E-Rechnung)** |
| sevDesk | 9,90 € (nur Rechnungen) | 17,90 € (volle Buchhaltung) | — |
| FastBill | 9,99 € | — | — |
| **Stackr** | — | **15 € (alles)** | — |

Zwei Effekte:

**Nach unten fehlt der Einstieg.** Wer nur Rechnungen schreiben will, zahlt bei sevDesk 9,90 €
und bei Stackr 15 €. Der Vergleich findet auf der Preisseite statt, bevor jemand merkt, dass
Stackr für 15 € den vollen Umfang liefert.

**Nach oben bleibt Geld liegen.** Eine GbR mit drei Gesellschaftern und zwei Firmen zahlt
denselben Preis wie ein Einzelunternehmer mit fünf Rechnungen im Monat — obwohl der Nutzen um ein
Vielfaches höher ist und die Zahlungsbereitschaft ebenfalls.

**Aber:** Ein Preis ist ein echtes Verkaufsargument („Ein Preis. Alles drin." steht schon so auf
der Landingpage) und erspart die Tarif-Vergleichstabelle, an der Wettbewerber Kunden verlieren.
Ich würde die Einfachheit **nicht** aufgeben, sondern sie **schärfer bewerben** — mit genau der
Zahl aus dem Feature-Gap-Audit:

> E-Rechnung gibt es bei Lexware Office erst im XL-Tarif für 32,90 €.
> Bei Stackr ist sie im 15-€-Preis enthalten.

Das ist ein direkter, belegbarer Vergleich, der die Ein-Preis-Struktur zum Vorteil macht statt
zum Nachteil. Kostet null Entwicklung und steht heute nirgends.

Falls doch gestuft werden soll, wäre der natürliche Schnitt **nicht** nach Features, sondern nach
**Firmenanzahl** — eine Firma zum Einstiegspreis, mehrere Firmen und GbR-Gewinnverteilung im
höheren Tarif. Das trennt entlang der tatsächlichen Zahlungsbereitschaft, ohne jemandem
gesetzlich nötige Funktionen vorzuenthalten (was bei E-Rechnung ohnehin heikel ist — siehe
Lexware).

---

## 🟠 P5 — GbR ist der beste unbesetzte Markt und wird zu leise geführt

Die GbR-Karte formuliert es selbst am treffendsten:

> „Die meisten Tools tun so, als gäbe es euch nicht."

Das stimmt, und Stackr hat dafür echte Substanz: eigenes GbR-Modul, Gewinnverteilung im
EÜR-Block, Sonderbetriebseinnahmen, eGbR-Registerfelder. GbR wird auf der Landingpage auch am
häufigsten genannt (18×) — aber als eine von drei gleich großen Karten, nicht als das, was es ist.

Warum das Segment attraktiv ist: eine GbR hat **zwei bis drei zahlende Köpfe hinter einem
Abo**, einen höheren Leidensdruck (Gewinnverteilung von Hand in Excel ist fehleranfällig und
streitanfällig) und eine geringere Wechselneigung, wenn das Tool einmal die Aufteilung sauber
abbildet. Und der Wettbewerb ignoriert sie belegbar.

**Empfehlung:** GbR als *eigene Landing-Unterseite* mit konkretem Rechenbeispiel (zwei
Gesellschafter, 50/50, Sonderbetriebseinnahmen, wer zahlt was) — das ist die Art Inhalt, die in
diesem Segment über Suche gefunden wird und für die es sonst nichts gibt.

---

## 🟡 P6 — Akademie startet für alle mit Reselling

**Das korrigiert meinen eigenen Fund U12 aus dem UX-Audit.** Dort schrieb ich, die Akademie sei
eine „reine Reselling-Schulung". Nachgezählt stimmt das nicht — von 13 Modulen sind gut die
Hälfte allgemein:

| Reselling-geprägt | Allgemein |
|---|---|
| `grundlagen`, `einkauf`, `listing`, `skalierung`, `kundenservice`, `social` | `steuer`, `steuerprofi`, `krankenversicherung`, `afa_recht`, `international`, `psychologie`, `mindset` |

Der tatsächliche Fund ist enger und dadurch besser lösbar: **Modul 1 und 2 sind Reselling**
(„Grundlagen Reselling" → „Was ist Reselling überhaupt?", dann „Einkauf & Kalkulation" mit der
3x-Regel). Ein Freelancer, der auf die Akademie klickt, landet also zuerst dort — und schließt
daraus, dass das Tool nicht für ihn ist, obwohl „Buchhaltung & Steuer (DE)", „Krankenversicherung"
und „AfA & Recht" genau seine Themen sind.

**Fix ist klein:** Die Modulreihenfolge nach `d.branche` sortieren — die steht seit
Wizard-Schritt 1 zur Verfügung. Keine Umbenennung, kein neuer Inhalt.

---

## Positionierung — Empfehlung

**Zielkunde, in dieser Reihenfolge:**

1. **Reseller mit Warenbestand** (eBay, Vinted, Kleinanzeigen, Flohmarkt). Stackr ist das einzige
   Buchhaltungstool mit echtem Lager **und** §25a-Differenzbesteuerung **und** Retouren.
   Kein Wettbewerber kommt hier auch nur in die Nähe.
2. **GbR und kleine Personengesellschaften.** Belegbare Marktlücke, mehrere Köpfe pro Abo,
   hoher Leidensdruck.
3. **Solo-Selbstständige mit Datenschutz-Anspruch.** Local-First und echtes E2E kann kein
   Cloud-Anbieter versprechen. Das ist zugleich der Grund für die fehlende ELSTER-Übermittlung —
   Lücke und Alleinstellung sind dieselbe Entscheidung und sollten auch so erzählt werden.

**Nicht antreten gegen:** sevDesk auf Automatisierung (Bank-Anbindung, OCR, ELSTER). Dieser Kampf
ist mit Local-First nicht zu gewinnen und muss nicht geführt werden.

**Ein Satz, der alles drei trägt:**
> Buchhaltung für Leute mit Ware und Partnern — inklusive Lager, GbR-Gewinnverteilung und
> E-Rechnung, für 15 € statt 32,90 €. Deine Daten bleiben auf deinem Gerät.

---

## Roadmap — Top 5 aus Produktsicht

Diese Reihenfolge unterscheidet sich bewusst von der Aufwand/Nutzen-Liste in
[Audit #13](funde-audit-03-feature-gap-2026-08-10.md): dort ging es um den größten Nutzen pro
Arbeitstag, hier um **Segment-Gewinn**.

| # | Item | Grund | Aufwand |
|---|---|---|---|
| 1 | **Positionierung schärfen** (P2/P5) + E-Rechnungs-Preisvergleich (P4) | Kostet keine Entwicklung, wirkt sofort auf jede Besucherin der Landingpage | S |
| 2 | **Local-Funnel entscheiden** (P1) | Solange die Gratisversion alles kann, ist jede andere Maßnahme wirkungslos | S (Entscheidung) / M (Umsetzung) |
| 3 | **Zahlungsabgleich Bank ↔ Rechnung** (G3 aus Audit #13) | Größter Alltagsnutzen, trifft **alle drei** Segmente, rein clientseitig | M |
| 4 | **GbR-Landingseite mit Rechenbeispiel** (P5) | Erschließt das Segment mit dem besten Verhältnis aus Bedarf und Wettbewerb | S |
| 5 | **Akademie nach Branche sortieren** (P6) | Ein Sortierkriterium, entschärft den falschen ersten Eindruck | S |

**Bewusst nicht auf der Liste:** Zeiterfassung/Projekte (P3) — siehe Begründung dort. Native App,
PSD2-Bankanbindung, Team-Zugang: alle drei verlangen einen Architekturbruch und sollten erst bei
belegter Kundennachfrage diskutiert werden.

---

## Abgleich mit Audit #13 (Feature-Gap)

Beide Audits kommen unabhängig auf dieselbe Grundaussage — **Nischen-Fokus statt Feature-Parität**
— und widersprechen sich in keinem Punkt. Ergänzend:

- Audit #13 hat **G3 (Zahlungsabgleich)** als besten Aufwand/Nutzen-Posten identifiziert; aus
  PM-Sicht bestätigt, weil es als einziges Feature alle drei Segmente gleichzeitig trifft.
- Audit #13 empfiehlt, **G1 (ELSTER) nicht zu bauen**, sondern zur Haltung zu machen. Aus
  PM-Sicht ist das nicht nur vertretbar, sondern der Kern von Segment 3.
- Der dort gefundene Marketing-Hebel (E-Rechnung 15 € vs. 32,90 €) wird hier zum Träger der
  Ein-Preis-Strategie (P4).
