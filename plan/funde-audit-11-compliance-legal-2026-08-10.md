# Compliance- und Legal-Audit — Funde (2026-08-12)

**Session-Prompt:** `plan/session-prompt-audit-11-compliance-legal-2026-08-10.md`
**Scope:** DDG, DSGVO, GoBD, AGB, E-Rechnung, StBerG, Vertragsrecht, Linkhaftung.
**Kein Anwaltsersatz** — technische Compliance-Prüfung gegen den Code, keine Rechtsberatung.
**Abgrenzung:** GoBD-Mechanik und §14-Pflichtangaben stehen bereits in
[#8 Steuer-Vergleich](funde-audit-05-vergleich-steuer-2026-08-10.md) und
[#5 Steuer-Delta](funde-audit-10-steuern-delta-2026-08-10.md); hier nur die rechtliche Einordnung.

---

## Zusammenfassung

Die Rechtstexte sind **auffällig gründlich** — Impressum mit EuGH-Begründung für die reine
E-Mail-Erreichbarkeit, Datenschutzerklärung mit allen vier Auftragsverarbeitern und Art.-46-Bezug,
AGB mit elf Paragraphen inklusive §312j-Buttonlösung und §356a. Das ist deutlich mehr, als man
bei einem Ein-Personen-Produkt erwartet.

**Ein Fund sticht heraus:** In der App laufen **zwei völlig verschiedene AGB-Fassungen**
nebeneinander, die sich einen einzigen Zustimmungs-Flag teilen — und die in der App angezeigte
Fassung stammt aus der Zeit **vor** der Whop-Migration.

| # | Fund | Rechtsgrundlage | Priorität |
|---|---|---|---|
| L1 | Zwei widersprüchliche AGB-Fassungen, In-App-Version veraltet (vor-Whop) | §305 II, §305c II, §307 I 2 BGB | 🔴 VOR LAUNCH |
| L2 | `agb_accepted` ohne Versionsstand → Änderungen erreichen Bestandsnutzer nie | §308 Nr. 5 BGB | 🟠 BALD |
| L3 | AGB aus der App heraus nicht verlinkt (nur Impressum + Datenschutz) | §312i I Nr. 4 BGB | 🟠 BALD |
| L4 | Cookie-Hinweis spricht von „Cookies", tatsächlich ist es localStorage | §25 TDDDG | 🟢 NICE |
| L5 | Whop-DPA / AV-Vertrag weiterhin offen | Art. 28 DSGVO | 🟠 BALD (Dritte) |
| L6 | Anwalts-Freigabe AGB §11 + §356a offen, im Text selbst vermerkt | — | 🟠 BALD (Dritte) |

---

## 🔴 L1 — Zwei AGB-Fassungen, die einander widersprechen

**Befund.** Es gibt drei Stellen mit „AGB", aber nur zwei Texte:

| Ort | Inhalt |
|---|---|
| [`agb.html`](../agb.html) | **11 Paragraphen**: Geltungsbereich · Leistungsbeschreibung · Vertragsschluss & Nutzerkonto (inkl. §312j Abs. 3 BGB Buttonlösung) · Pro-Plan · Zahlung · **Widerrufsrecht** (§356a BGB) · Datenspeicherung & Kündigung · Haftungsausschluss · Änderungen · Recht & Gerichtsstand · Empfehlungsprogramm |
| [`js/app.js` `showAgbModal()`](../js/app.js#L927) | **8 Paragraphen**: Geltungsbereich · Haftungsausschluss · Kein steuerlicher Rat · Datenspeicherung · GoBD-Konformität · Nutzung auf eigene Gefahr · Änderungen · Schlussbestimmungen |
| [`rechnungen/js/app.js` `showAgbModal()`](../rechnungen/js/app.js#L227) | **identisch** mit dem Modal aus `js/app.js` |

Die In-App-Fassung enthält **kein Widerrufsrecht, keine Preise, keine Zahlungsbedingungen und
Whop kommt nicht vor**. Sie stammt erkennbar aus der Zeit vor der Whop-Migration und beschreibt
ein reines „as-is"-Werkzeug.

**Warum das rechtlich zählt:**

1. **Einbeziehung nach Vertragsschluss (§305 Abs. 2 BGB).** Der Vertrag kommt beim
   Whop-Checkout zustande. Das Modal erscheint erst **danach**, beim ersten App-Start, und
   blockiert die Nutzung bei Ablehnung („Nutzung nicht möglich",
   [rechnungen/js/app.js:261](../rechnungen/js/app.js#L261)). Bedingungen, die erst nach
   Vertragsschluss gestellt und mit Leistungsverweigerung durchgesetzt werden, sind so nicht
   wirksam einbezogen.
2. **Unklarheitenregel (§305c Abs. 2 BGB).** Widersprechen sich zwei Klauselwerke desselben
   Verwenders, geht das zulasten des Verwenders — es gilt die für den Kunden günstigere Fassung.
   Praktisch heißt das: Der Haftungsausschluss der In-App-Fassung dürfte im Streitfall gerade
   **nicht** greifen, obwohl er dafür gedacht ist.
3. **Transparenzgebot (§307 Abs. 1 Satz 2 BGB).** Ein Nutzer kann nicht erkennen, welche Fassung
   gilt. Die In-App-Fassung nennt sich „Nutzungsbedingungen", `agb.html` nennt sich „AGB" — für
   den Laien dasselbe.

**Zusätzlich inhaltlich überholt:** Die In-App-Fassung verschweigt, dass der Kaufvertrag mit
**Whop als Merchant of Record** zustande kommt — genau die Trennung, die `agb.html` sauber
herausarbeitet.

**→ Fix:** Die In-App-Modale sollten die AGB nicht *ersetzen*, sondern *anzeigen*. Konkret:
den Modaltext durch eine Kurzfassung mit den drei wirklich relevanten Punkten ersetzen
(kein steuerlicher Rat · Nutzung auf eigene Gefahr · Datensicherung liegt beim Nutzer) und
darunter auf `agb.html` verlinken — statt eine zweite, konkurrierende Fassung zu präsentieren.
Der Zustimmungsschritt selbst gehört zum Checkout, nicht in die App.

**Priorität: VOR LAUNCH.** Der Fix ist Textarbeit, aber die Konstellation entwertet den
Haftungsausschluss, der das eigentliche Schutzziel ist.

---

## 🟠 L2 — Zustimmung ohne Versionsstand

[js/app.js:152](../js/app.js#L152) und [rechnungen/js/app.js:303](../rechnungen/js/app.js#L303)
prüfen beide denselben Schlüssel:

```javascript
if (!localStorage.getItem('agb_accepted')) { showAgbModal(…); }
…
localStorage.setItem('agb_accepted', new Date().toISOString());
```

Gespeichert wird ein **Zeitstempel, keine Version**. Folgen:

- Wird der AGB-Text geändert, sieht **kein Bestandsnutzer** die neue Fassung je wieder — der Flag
  ist gesetzt und bleibt es. §9 der `agb.html` sieht ausdrücklich Änderungen vor; ein Verfahren
  dafür existiert im Code nicht.
- §308 Nr. 5 BGB verlangt für Zustimmungsfiktionen eine ausdrückliche Benachrichtigung mit
  Hinweis auf die Bedeutung des Schweigens. Ohne Versionsstand ist das nicht abbildbar.
- Beide Module teilen sich den Flag: Wer zuerst startet, setzt ihn; das jeweils andere Modal
  erscheint nie. Solange beide Texte identisch sind, ist das folgenlos — mit L1 zusammen aber
  der Grund, warum der Widerspruch bisher niemandem auffiel.

**→ Fix:** Schlüssel auf `agb_accepted_v2` o. ä. umstellen und die Version im Wert mitführen
(`{"version":2,"ts":"…"}`). Bei einer Textänderung wird die Version erhöht, der Nutzer sieht
die Änderung einmalig. Kleiner Eingriff, der §9 der AGB überhaupt erst umsetzbar macht.

---

## 🟠 L3 — Die AGB sind aus der App heraus nicht erreichbar

Geprüft, welche Rechtsseiten von wo verlinkt sind:

| Seite | verlinkt |
|---|---|
| `index.html` (Landing) | `impressum` · `datenschutz` · **`agb`** · `cookies` · `refund` |
| `app.html` | `impressum` · `datenschutz` |
| `lager/index.html` | `impressum` · `datenschutz` |
| `rechnungen/index.html` | `impressum` · `datenschutz` |
| `eigenbelege/index.html` | `impressum` · `datenschutz` |

Impressum und Datenschutz sind vorbildlich überall eingebunden — **die AGB fehlen in der
gesamten App**. §312i Abs. 1 Nr. 4 BGB verlangt, dass Vertragsbedingungen abrufbar und
speicherbar bereitstehen. Ein eingeloggter Nutzer, der nachlesen will, wozu er zugestimmt hat,
findet den Text nur über den Umweg der öffentlichen Landingpage.

**→ Fix:** `agb.html` in die Footer-Zeile der vier App-Seiten aufnehmen — dieselbe Zeile, in der
Impressum und Datenschutz bereits stehen. Vier Einzeiler. Sinnvoll gebündelt mit L1.

---

## ✅ Was geprüft wurde und stimmt

**DDG §5 — Impressum.** Vollständig: Name (Jonathan Reck), Firma
(Secondlife Vintage — Einzelunternehmen), ladungsfähige Anschrift mit Straße und Hausnummer
(kein Postfach), E-Mail. Dazu §18 Abs. 2 MStV inhaltlich Verantwortlicher, §7/§8-10 DDG
Haftungsklauseln, Linkhaftung, Urheberrecht.
Besonders sauber: Die reine E-Mail-Erreichbarkeit wird **mit EuGH C-298/07 begründet**, samt
Zusage einer Antwort binnen 48 Stunden werktags — genau die Voraussetzung, unter der der EuGH
den Verzicht auf eine Telefonnummer akzeptiert. Der Verzicht auf die
Verbraucherschlichtung ist nach §36 VSBG korrekt erklärt.
*Anmerkung:* Eine USt-IdNr. ist nicht angegeben. Nach §5 Abs. 1 Nr. 6 DDG ist sie nur
anzugeben, **wenn vorhanden** — bei Kleinunternehmerschaft nach §19 UStG besteht in der Regel
keine. Sollte künftig eine USt-IdNr. beantragt werden, muss sie ergänzt werden.

**DSGVO — Datenschutzerklärung.** Alle vier Auftragsverarbeiter sind namentlich genannt:
**Whop** (19 Nennungen), **Upstash** (4), **Vercel** (2), **Cloudflare**, dazu **jsDelivr** als
CDN und **Make.com** für die optionalen Webhooks. Art.-Verweise auf 4, 6, 15, 16, 17, 18, 20, 21,
28 und **46** vorhanden — Art. 46 ist der richtige für die Drittlandübermittlung an Whop (USA);
Standardvertragsklauseln/Drittland werden achtmal thematisiert. Aufbewahrungsfristen sind
adressiert. Das erfüllt Art. 13 der Sache nach.

**§25 TDDDG / Cookie-Einwilligung.** Der Banner bietet **nur** „Verstanden ✓" und keine
Ablehnen-Option — das ist hier **korrekt**, nicht fehlerhaft: Stackr setzt ausschließlich
technisch notwendige Speicherung ein (kein Tracking, keine Werbung), die nach §25 Abs. 2 Nr. 2
TDDDG einwilligungsfrei ist. Ein Ablehnen-Button wäre irreführend, weil es nichts abzulehnen gibt.
Siehe aber **L4**.

**§5 StBerG — Steuerberatungsvorbehalt.** Disclaimer an drei Stellen: `agb.html`, das
In-App-Modal („§ 3 Kein steuerlicher oder rechtlicher Rat") und die Landingpage. Zusätzlich
argumentiert die Landingpage aktiv *für* den Steuerberater („sorgt dafür, dass dein
Steuerberater weniger Stunden braucht") statt ihn zu ersetzen — genau die richtige Positionierung.

**E-Rechnung §14 UStG.** Nicht nur erfüllt, sondern im UI präsent: 8 Erwähnungen in
`rechnungen/js/rechnung.js`, 5 in `rechnungen/js/dokumente.js`. XRechnung-Ausgang und
Eingangsprüfung sind gebaut. Der Hinweis auf die **§14b-Aufbewahrungspflicht (8 Jahre im
Originalformat)** steht direkt im Import-Ergebnis
([rechnungen/js/erechnung-import.js:262-265](../rechnungen/js/erechnung-import.js#L262)) —
das ist die Stelle, an der ein Nutzer den Hinweis wirklich braucht.
*Nur im Marketing fehlt das Thema* — siehe **M1** im
[Copy-Audit](funde-audit-08-copy-marketing-2026-08-10.md).

**AGB-Vollständigkeit (`agb.html`).** Alle vom Prüfkatalog verlangten Punkte vorhanden,
darunter die schwierigen: **§312j Abs. 3 BGB** (Buttonlösung, mit dem korrekten Hinweis, dass die
Button-Beschriftung von Whop gestellt wird), **§356a BGB** Widerrufsrecht mit 14-Tage-Frist ab
Trial-Start, Whop als Merchant of Record, Haftungsausschluss, Datensicherungspflicht des Nutzers,
Gerichtsstand, sowie ein eigener §11 zum Empfehlungsprogramm mit **§7-UWG-Hinweis** gegen
Spam-Werbung.

**GoBD.** Aufbewahrungspflicht in `datenschutz.html` (2×) und
`verfahrensdokumentation.html` adressiert. Eine **mitgelieferte Verfahrensdokumentation** ist der
Punkt, an dem Stackr den Wettbewerb schlägt (bei Lexware nur über den Steuerberater-Zugang).
Mechanik siehe Steuer-Audits.

**Linkhaftung.** Klausel im Impressum vorhanden; externe Links (Whop-Checkout, WhatsApp,
jsDelivr) tragen `rel="noopener"`.

---

## Bekannte offene Punkte — nicht durch Coden lösbar

Auftragsgemäß ausdrücklich geführt:

- 🟠 **L5 — Whop-DPA / AV-Vertrag nach Art. 28 DSGVO.** Weiterhin offen, wartet auf Whop.
  Blockiert die formale DSGVO-Vollständigkeit. Die Datenschutzerklärung beschreibt die
  Verarbeitung bereits korrekt — es fehlt das Vertragsdokument, nicht die Information.
  **Gleiches gilt für Upstash und Vercel**, die als Auftragsverarbeiter benannt sind; ob dort
  DPAs vorliegen, ist aus dem Code nicht feststellbar und sollte geprüft werden.
- 🟠 **L6 — Anwalts-Freigabe.** AGB §11 (Empfehlungsprogramm) und die §356a-Trial-Klausel.
  Bemerkenswert und richtig: Der AGB-Text **weist selbst darauf hin**, dass §356a noch nicht
  anwaltlich gegengeprüft ist. Diese Ehrlichkeit sollte vor dem Launch aber durch die echte
  Prüfung ersetzt werden — eine Widerrufsklausel, die nicht trägt, ist bei einem Trial-Modell
  der teuerste Fehler.

---

## 🟢 L4 — Kleinigkeit: „Cookies" ist die falsche Vokabel

[js/cookie-banner.js:34](../js/cookie-banner.js#L34):

> „Diese App verwendet ausschließlich technisch notwendige **Cookies** für Anmeldung und
> Session-Verwaltung."

Stackr setzt praktisch keine Cookies — die Daten liegen in **localStorage und IndexedDB**.
§25 TDDDG erfasst beides gleichermaßen („Speicherung von Informationen in der Endeinrichtung"),
die Rechtsfolge ändert sich also nicht. Die Aussage ist aber schlicht ungenau, und
`datenschutz.html` beschreibt die Speicherung korrekt — die beiden Texte weichen voneinander ab.

**→ Fix:** „Cookies" durch „lokale Speicherung (localStorage)" ersetzen. Ein Satz.

---

## Priorisierung

```
🔴 VOR LAUNCH
  L1  Zwei widersprüchliche AGB-Fassungen; die In-App-Version ist vor-Whop und entwertet
      durch den Widerspruch (§305c II BGB) genau den Haftungsausschluss, der sie trägt.
      Fix: Modal auf Kurzfassung + Link auf agb.html umstellen.

🟠 BALD
  L3  agb.html in den Footer der vier App-Seiten (§312i I Nr. 4 BGB) — vier Einzeiler.
  L2  agb_accepted mit Versionsstand, sonst ist §9 der AGB nicht umsetzbar.
  L5  DPAs: Whop (offen), zusätzlich Upstash und Vercel prüfen.
  L6  Anwalts-Freigabe §11 + §356a — vor Launch, nicht danach.

🟢 NICE
  L4  „Cookies" → „lokale Speicherung" im Banner-Text.
```

**Reihenfolge:** L1 und L3 gehören zusammen und sind an einem Nachmittag erledigt — beides
Textarbeit ohne Logikänderung. L2 danach. L5/L6 laufen parallel bei Dritten.
