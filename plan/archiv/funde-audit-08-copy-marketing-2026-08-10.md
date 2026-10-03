# Copy- und Marketing-Audit — Funde (2026-08-11)

**Session-Prompt:** `plan/session-prompt-audit-08-copy-marketing-2026-08-10.md`
**Scope:** `index.html` (Landingpage), Gate-Screens in `js/whop-auth.js`, Meta/SEO.
**Hinweis zum Skill-Brief:** Der Skill nennt `landing.html` als Datei — die Landingpage ist
inzwischen `index.html`. Preisangaben im Bericht gegen den Code geprüft: 15 €/Monat,
135 €/Jahr, kein Web-Free-Tier, 7-Tage-Trial über Whop.

---

## Zusammenfassung

**Die Copy ist überdurchschnittlich gut.** Headline, Tonfall und FAQ sind auf einem Niveau, das
man bei einem Ein-Personen-Produkt selten sieht — die Landingpage argumentiert konkret
(„20 Minuten im Monat", „150–250 € pro Steuerberater-Stunde") statt mit Buzzwords, und die
Trial-Kommunikation ist rechtlich sauber und ohne Dark Pattern.

Die Schwächen sind **Auslassungen, keine Fehler**: Das gesetzlich erzwungene Feature mit dem
größten Wettbewerbsvorsprung wird in einem Aufzählungspunkt versteckt, es gibt keinerlei
Sozialbeweis, und die kostenlose Offline-Version wird auf der Seite nicht nur verschwiegen,
sondern aktiv verneint.

| # | Fund | Bereich | Impact |
|---|---|---|---|
| M1 | E-Rechnung kommt **1× auf der ganzen Seite** vor — als Bullet | Value-Prop | 🔴 Hoch |
| M2 | Kein Sozialbeweis: keine Stimmen, keine Zahlen, keine Siegel | Trust | 🔴 Hoch |
| M3 | Die Gratis-Offline-Version wird nicht erwähnt — die FAQ **verneint** sie | Funnel | 🟠 Mittel |
| M4 | Kein direkter Preisanker gegen den Wettbewerb | Pricing | 🟠 Mittel |
| M5 | Hero verspricht „20 Minuten", nennt aber nicht die Zielgruppe | Hero | 🟡 Niedrig |
| M6 | 8 CTAs, aber alle mit demselben Ziel — die Persona-CTAs verschenken ihre Chance | CTA | 🟡 Niedrig |

**Bereits erledigt während des Audits:** Mein Fund U1 (Gate erwähnt den Trial nicht) ist gefixt —
`js/whop-auth.js` nennt den Trial jetzt 8×. Damit ist die Messaging-Lücke zwischen Landingpage
und Produkt geschlossen.

---

## 🔴 M1 — E-Rechnung ist der stärkste Verkaufspunkt und steht in einem Bullet

Auf der gesamten Landingpage kommt „E-Rechnung" **genau einmal** vor
([index.html:571](../index.html#L571)):

```html
<li><span class="check">✓</span> <strong>DATEV- &amp; E-Rechnung-Export (XRechnung)</strong></li>
```

Kein Hero-Bezug, keine eigene Sektion, **kein FAQ-Eintrag** — obwohl es zwölf FAQ-Einträge gibt,
die weniger dringende Fragen beantworten.

Warum das die teuerste Auslassung der Seite ist:

1. **Es ist eine gesetzliche Pflicht.** B2B-Empfangspflicht seit 1.1.2025. Das ist gerade die
   konkreteste Sorge in der Zielgruppe — Leute suchen aktiv danach.
2. **Es ist Stackrs stärkstes Preisargument.** Bei Lexware Office steckt die E-Rechnung erst im
   **XL-Tarif zu 32,90 €** (belegt in [Audit #13](funde-audit-03-feature-gap-2026-08-10.md));
   bei Stackr ist sie im 15-€-Preis enthalten. Das ist ein direkter, nachprüfbarer Vergleich.
3. **Es ist gebaut.** XRechnung 3.0 nach EN 16931, Ausgang und Eingangsprüfung.

**Vorschlag — neuer FAQ-Eintrag (der 13.):**

> **Erfüllt Stackr die E-Rechnungspflicht ab 2025?**
> Ja. Stackr erzeugt E-Rechnungen im XRechnung-Format (EN 16931) und prüft eingehende
> E-Rechnungen deiner Lieferanten. Beides ist im Preis enthalten — bei Lexware Office bekommst
> du die E-Rechnung erst im XL-Tarif für 32,90 € im Monat.

**Vorschlag — Zeile in die Preis-Sektion**, direkt unter „Ein Preis. Alles drin.":

> E-Rechnung ist seit 2025 Pflicht im B2B. Bei uns ist sie drin — nicht im teuersten Tarif.

**Begründung:** Verwandelt eine Pflicht-Angst in einen Kaufgrund und macht die Ein-Preis-Struktur
vom Nachteil („15 € ist teurer als sevDesks 9,90 €") zum Vorteil.

---

## 🔴 M2 — Kein einziger Sozialbeweis

Suche nach Testimonials, Nutzerzahlen, Bewertungen, Sternen: **keine Treffer.** Die vier
Treffer auf „Nutzer" sind allesamt Funktionsbeschreibungen („Als Pro-Nutzer kannst du …").

Was die Seite an Vertrauen aufbaut, ist rein sachlich: DSGVO, lokale Datenhaltung,
Ende-zu-Ende-Verschlüsselung, „jederzeit kündbar", Datenexport. Das ist gut und für diese
Zielgruppe relevant — aber es beantwortet nicht die Frage *„benutzt das außer mir noch jemand?"*.
Bei einem unbekannten Anbieter, dem man seine Buchhaltung anvertrauen soll, ist das die stillste
und wirksamste Kaufbremse.

**Realistische Optionen ohne Kunden-Zitate** (die es vermutlich noch nicht in Zahl gibt):

- **Zahlen, die es gibt:** „28 Module", „über 200 automatisierte Tests", „seit 2026 im Einsatz".
  Nicht spektakulär, aber konkret und überprüfbar.
- **Ein einziges echtes Zitat** ist mehr wert als zehn erfundene. Falls es zahlende Kunden gibt:
  fragen. Vorname + Branche reicht („Marco, Vintage-Reselling").
- **Fachliche Autorität als Ersatz:** ein Verweis auf die mitgelieferte Verfahrensdokumentation
  und die §-genaue Umsetzung ist eine Form von Beweis, die Wettbewerber nicht führen können.

**Wichtig:** Keine erfundenen Testimonials, keine geschätzten Nutzerzahlen. In dieser Zielgruppe
(Leute, die Rechnungen prüfen) fällt das auf und kostet mehr als es bringt — abgesehen davon,
dass erfundene Bewertungen wettbewerbsrechtlich angreifbar sind (§5 UWG).

---

## 🟠 M3 — Die kostenlose Version existiert auf der Seite nicht

Der Skill-Brief und die Projektunterlagen führen die kostenlose Offline-Version (Local 1.7) als
den **Gratis-Einstieg in den Funnel**. Auf der Landingpage kommt sie nicht vor. Die einzige
Fundstelle für „Download" ist eine FAQ-Antwort, die das Gegenteil sagt
([index.html:642](../index.html#L642)):

> **Gibt es eine Desktop-App?**
> Stackr ist eine moderne Web-App, die in jedem aktuellen Browser läuft — **kein Download, keine
> Installation.**

Zusammen mit **P1 aus dem [PM-Audit](funde-audit-07-product-manager-2026-08-10.md)** — die
Local-Version ist wegen `PUBLIC_KEY_JWK: null` **komplett ungegated** — ergibt das ein klares
Bild: Die Gratisversion ist voll funktionsfähig, unbegrenzt, **und unsichtbar**. Sie funktioniert
damit weder als Funnel (niemand findet sie) noch als Produkt (niemand zahlt dafür).

**Das ist zuerst eine Produktentscheidung, dann eine Copy-Aufgabe.** Drei saubere Auflösungen:

1. **Local ist tot** → FAQ-Antwort so lassen, Local aus allen Unterlagen streichen. Ehrlich und
   billig.
2. **Local ist der Funnel** → FAQ-Antwort umschreiben und eine Zeile in die Preis-Sektion:
   > **Lieber ganz ohne Cloud?** Die Offline-Version läuft komplett auf deinem Rechner —
   > kostenlos. Das Web-Abo ergänzt Cloud-Sync, Steuerberater-Freigabe und mehrere Geräte.

   Dann muss aber die Lizenz scharf oder der Umfang beschnitten werden (siehe P1).
3. **Local ist ein bezahltes Zweitprodukt** → eigener Abschnitt mit eigenem Preis.

Solange das nicht entschieden ist, widerspricht die Seite der Strategie.

---

## 🟠 M4 — Der Preisanker zeigt in die richtige Richtung, aber nicht auf den Wettbewerb

Vorhanden und **gut gemacht** ([index.html:583-587](../index.html#L583)):

> Zum Vergleich: Eine einzige Steuerberater-Stunde kostet **150–250 €**. Stackr kostet **15 € im
> Monat** — und sorgt dafür, dass dein Steuerberater weniger Stunden braucht.

Das ist ein starker Anker, weil er den Nutzen und nicht das Produkt vergleicht. Was fehlt, ist
der **direkte** Anker: Suche nach „lexoffice", „lexware", „sevdesk", „fastbill" oder „statt … €"
auf der Seite → **keine Treffer**.

Jeder Interessent macht diesen Vergleich ohnehin, nur eben in einem anderen Tab und ohne die
Information, dass Stackr für 15 € den vollen Umfang liefert, während sevDesks 9,90-€-Tarif nur
Rechnungen kann und die volle Buchhaltung dort 17,90 € kostet.

**Vorschlag — kleine Vergleichszeile unter der Preiskarte:**

> sevDesk: 9,90 € nur für Rechnungen, 17,90 € für die Buchhaltung.
> Lexware Office: E-Rechnung erst ab 32,90 €.
> Stackr: **15 €. Alles.**

**Begründung:** Nimmt den Vergleich vorweg, statt ihn dem Interessenten zu überlassen, und macht
die fehlende Tarif-Treppe zum Argument statt zur Lücke. (Preise datieren und Stand angeben —
Wettbewerbspreise ändern sich, und eine veraltete Vergleichstabelle ist wettbewerbsrechtlich
heikler als gar keine.)

---

## 🟡 M5 — Die Hero-Headline ist stark, adressiert aber niemanden

Aktuell ([index.html:75-81](../index.html#L75)):

> # Steuern stressen. Stackr beruhigt.
> Buchungen, Rechnungen, EÜR und GoBD-Protokoll in **einer App** — statt an einem verlorenen
> Sonntag erledigst du deine Buchhaltung in **20 Minuten im Monat**. Dein Steuerberater bekommt
> am Ende einfach die fertige XLSX.

**Das ist gute Copy.** Die Headline nennt Schmerz und Versprechen in vier Wörtern, passt exakt
zum Markenversprechen „Ruhige Souveränität", und die Subheadline ist konkret statt vage
(„20 Minuten im Monat", „fertige XLSX") — genau richtig. Nichts davon würde ich anfassen.

Der einzige Einwand: Weder Headline noch Subheadline sagen, **für wen** das ist. Der `<title>`
macht es vorbildlich („Buchhaltung für Freelancer, GbR & Reseller"), die Seite selbst erst weit
unten bei den Persona-Karten. Wer über eine Anzeige oder einen geteilten Link kommt, muss raten.

**Vorschlag — ein Zusatz über der Headline (Kicker), Headline unverändert:**

> *Für Freelancer, GbR und Reseller*
> # Steuern stressen. Stackr beruhigt.

**Begründung:** Kostet keine Wirkung der Headline, disqualifiziert die Falschen früh und bestätigt
die Richtigen sofort. Vor allem für die GbR-Zielgruppe wichtig, die laut PM-Audit die beste
unbesetzte Nische ist — und die es gewohnt ist, in solchen Tools *nicht* vorzukommen.

---

## 🟡 M6 — Acht CTAs, ein Ziel, drei verschenkte Chancen

Alle CTAs führen auf denselben Whop-Checkout, textlich sauber und verbstark:
„7 Tage kostenlos testen →", „Jetzt 7 Tage kostenlos testen →", „Eigenes Konto starten →".
Die Hero-Sektion hat korrekt einen Primär- und einen Sekundär-CTA
(„Live-Demo ausprobieren ↓") — genau der Zweitweg für Skeptiker, den man haben will.
**Handwerklich alles richtig.**

Verschenkt sind die drei Persona-CTAs: „Als Freelancer starten →", „Als GbR starten →",
„Als Reseller starten →" führen alle auf dasselbe Ziel. Der Nutzer erwartet nach so einem Klick
etwas Segmentspezifisches und bekommt den generischen Checkout.

**Vorschlag:** Entweder den Anspruch einlösen — der Onboarding-Wizard kennt in Schritt 1 bereits
eine Branchenauswahl, die sich per Parameter vorbelegen ließe (`?branche=gbr`) — oder die CTAs
neutral formulieren („Jetzt starten →"), damit kein Versprechen entsteht, das nicht eingelöst wird.
Die erste Variante ist die bessere: sie zahlt direkt auf **P6** ein (Akademie nach Branche
sortieren) und auf **U3** (Wizard-Schritte).

---

## Geprüft und gut — keine Änderung nötig

**Tonfall.** Durchgehend direkt, informell-professionell, ohne Buzzwords. Die
Sektionsüberschriften tragen die Erzählung allein: „Der Sonntagabend vor der Steuer." →
„Probier es aus. Hier. Jetzt." → „Drei Schritte. Mehr ist es nicht." → „Selbstbewusst günstiger."
→ „Ein Preis. Alles drin." Das ist eine echte dramaturgische Linie, kein Feature-Stapel.

**Trial-Kommunikation.** Rechtlich sauber und ohne Dark Pattern, an **jeder** Stelle mit demselben
Zusatz: „Karte hinterlegen, in den ersten 7 Tagen keine Abbuchung". Die FAQ-Antwort erklärt den
Widerruf und die formlose Kündigung über Whop. Das ist mehr Transparenz als bei den meisten
Wettbewerbern und sollte genau so bleiben.

**Preisdarstellung.** 15 €/Monat und 135 €/Jahr stimmen mit dem Code überein. Ersparnis wird
gerechnet statt behauptet (45 € / „25 % günstiger" / 11,25 €/Monat), „jederzeit kündbar" und
„inkl. MwSt." stehen direkt an der Karte, Monats-/Jahres-Umschalter vorhanden.

**FAQ.** Zwölf Einträge, die die Kaufhindernisse aus dem Prüfkatalog nahezu vollständig
abdecken: kostenlos testen · kündigen · Datenspeicherung · Mehrgeräte · lokale Daten beim Anmelden
· GoBD · Steuerberater · GbR · Daten nach Kündigung · Kleinunternehmer §19 · Excel-Import.
Fehlt nur E-Rechnung (**M1**).

**Live-Demo.** „Probier es aus. Hier. Jetzt." mit echter Demo auf der Seite — der beste
Vertrauensbeweis, den ein Buchhaltungstool ohne Testimonials führen kann, und er ersetzt teilweise
den fehlenden Sozialbeweis.

**SEO.** `<title>` mit Zielgruppe und Keywords, `meta description` mit Nutzen + Preis + Trial,
Open-Graph-Tags vollständig inkl. `og:image` und `og:locale`. `<h1>` ist markenorientiert statt
keyword-orientiert — für eine Marke die richtige Wahl, die Keywords stehen im `<title>`.

---

## Top-3 Quick Wins

| # | Änderung | Impact | Aufwand |
|---|---|---|---|
| 1 | **E-Rechnungs-FAQ + Preiszeile** (M1) — Pflicht-Thema, das Lexware erst für 32,90 € liefert | Hoch | ~20 Min Text |
| 2 | **Wettbewerbs-Preisanker** unter der Preiskarte (M4) | Hoch | ~15 Min Text |
| 3 | **Zielgruppen-Kicker über der Headline** (M5) | Mittel | 1 Zeile |

Danach, in dieser Reihenfolge: **M3** (erst Produktentscheidung zu Local treffen, dann texten),
**M2** (Sozialbeweis aufbauen — braucht echte Kunden, also Vorlauf), **M6** (Persona-CTAs
einlösen, sinnvoll gebündelt mit U3 und P6).

---

## Marketing-Winkel für die Zielgruppe

Abgeleitet aus der Segment-Reihenfolge des [PM-Audits](funde-audit-07-product-manager-2026-08-10.md)
(Reseller → GbR → datenschutzbewusste Solo-Selbstständige):

**Inhalte, die ranken können** — jeweils Themen, zu denen es wenig Gutes auf Deutsch gibt und zu
denen Stackr echte Substanz im Produkt hat:

- „Differenzbesteuerung §25a für Reseller — wann sie sich lohnt und wann nicht"
  (Stackr hat das Modul, der Wettbewerb nicht)
- „GbR-Gewinnverteilung richtig buchen — inklusive Sonderbetriebseinnahmen"
  (belegbare Marktlücke, siehe P5)
- „E-Rechnungspflicht 2025: was Kleinunternehmer wirklich tun müssen"
  (höchstes Suchvolumen, direkte Brücke zu M1)
- „Kleinunternehmer §19: die neuen 25.000-€-Grenzen ab 2025"
  (Stackr rechnet die Grenzen jahresabhängig — das kann man zeigen)

**Kanäle:** Reseller-Communities (Vinted-/eBay-Gruppen, r/Finanzen) sind für Segment 1 näher als
klassische Freelancer-Kanäle. Für GbR ist Suche der wichtigste Kanal — dort wird gezielt gesucht,
weil kein Tool die Frage beantwortet.

**Affiliate:** Das Whop-Empfehlungsprogramm ist bereits im Produkt verdrahtet
(`js/whop-auth.js`, `?a=<username>`). Es fehlt der **Teilnahmebedingungen-Text** — der Link zeigt
laut Code-Kommentar noch auf einen Platzhalter. Bevor das Programm beworben wird, muss der Text
stehen (steuerliche und AGB-Implikationen von „Kunden werben Kunden" in DE).
