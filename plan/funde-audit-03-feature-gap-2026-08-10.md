# Feature-Gap-Audit — Funde (2026-08-10)

**Session-Prompt:** `plan/session-prompt-audit-03-feature-gap-2026-08-10.md`
**Scope:** Web 1.7 gegen sevDesk, Lexware Office (ex lexoffice), FastBill.
**Methode:** IST-Stand aus dem Code verifiziert (nicht angenommen), Konkurrenz-Features per
Web-Recherche belegt. Aufwandsschätzungen sind grobe Hausnummern, keine Planung.

---

## Wichtige Vorbemerkung

Die Skill-Vorlage listet Bank-Import, E-Rechnung, DATEV, Mahnwesen und wiederkehrende Rechnungen
als offene TIER-1-Lücken. **Das ist überholt — alle fünf existieren im Code.** Der IST-Stand unten
ist am Code geprüft. Die echten Lücken liegen woanders und sind zum Teil **architektonisch**, nicht
nur Arbeit.

---

## IST-Stand (am Code verifiziert)

| Feature | Stand in Stackr | Beleg |
|---|---|---|
| E-Rechnung **Ausgang** | ✅ XRechnung 3.0, EN 16931 / UN-CEFACT CII D16B | [xrechnung.js:1-5](../rechnungen/js/xrechnung.js#L1), verdrahtet in [dokumente.js:797](../rechnungen/js/dokumente.js#L797) |
| E-Rechnung **Eingang** | ✅ Validierung + Anzeige, ZUGFeRD-PDF teilweise | [erechnung-import.js](../rechnungen/js/erechnung-import.js) |
| Bank-Import | ✅ CAMT.053 + MT940 + generisches CSV | [bank-import.js:2,88,178](../js/bank-import.js#L2) |
| DATEV-Export | ✅ Buchungsstapel ASCII/CSV, SKR03 **und** SKR04 | [datev.js:1-51](../js/datev.js#L1) |
| Mahnwesen | ✅ Mahnstufen, Fristen je Stufe, Mahngebühren | [mahnungen.js:5,76,181](../rechnungen/js/mahnungen.js#L5) |
| Wiederkehrende Rechnungen | ✅ monatlich/quartal/jährlich, Auto-Erstellung, Monatsende geclampt | [wiederkehrend.js:3,10,192](../rechnungen/js/wiederkehrend.js#L3) |
| Angebote / Gutschriften | ✅ als eigene Dokumenttypen | [dokumente.js:130-132](../rechnungen/js/dokumente.js#L130) |
| Steuerberater-Zugang | ✅ Read-only-Grant, E2E-Envelope-Key | [api/sync.js:356-400](../api/sync.js#L356) |
| Belegfoto am Eigenbeleg | ✅ Foto/PDF anhängbar | [eigenbelege/js/app.js:415,789](../eigenbelege/js/app.js#L415) |
| UStVA-Berechnung | ✅ eigenes Modul | `js/ustvoranmeldung.js` |
| Mobile | ✅ responsiv (44-px-Targets, 13 Media-Queries) — **keine** native App | siehe Audit #10 |
| Modulumfang | **28 registrierte Module** + 3 Sub-Apps | [app.js `pages:`](../js/app.js) |

Dazu Module, die im Wettbewerb schlicht fehlen: **Lager + Materiallager, KSK, GbR-Modul,
Fahrtenbuch, AfA, Kassenbuch, Differenzbesteuerung §25a, Retouren, OSS, Bilanz, Gewerbe-,
Körperschaft- und Lohnsteuer, Akademie.**

> **Nebenbefund fürs Marketing:** Die Landingpage wirbt mit „Alle 12 Module".
> Registriert sind **28**. Das verkauft sich unter Wert — gehört ins Copy-Audit (#15).

---

## Die echten Lücken

| # | Lücke | Konkurrenz | Aufwand | Prio |
|---|---|---|---|---|
| G1 | ELSTER-Direktübermittlung | sevDesk + Lexware, **ohne eigenes Zertifikat** | Hoch (architektonisch) | 🔴 P0 |
| G2 | Bankkonto-Anbindung (PSD2) | sevDesk: 4.000+ Banken | Hoch (architektonisch) | 🟠 P1 |
| G3 | Zahlungsabgleich Rechnung ↔ Kontoumsatz | alle drei | **Niedrig** | 🔴 P0 |
| G4 | OCR / KI-Belegerkennung | sevDesk + Lexware | Mittel | 🟠 P1 |
| G5 | ZUGFeRD-Hybrid-PDF (PDF/A-3) im Ausgang | alle drei | Mittel | 🟠 P1 |
| G6 | Zahlungslink in der Rechnung | alle drei | Niedrig | 🟡 P2 |
| G7 | Team-/Mehrbenutzerzugang | alle drei | Hoch (architektonisch) | 🟡 P2 |
| G8 | Native Mobile-App | alle drei | Sehr hoch | 🟢 P3 |
| G9 | Auftragsbestätigung / Lieferschein | sevDesk, FastBill | Niedrig | 🟢 P3 |
| G10 | Öffentliche REST-API (lesend) | sevDesk, Lexware | Mittel | 🟢 P3 |

---

## 🔴 P0 — G3: Zahlungsabgleich Rechnung ↔ Kontoumsatz

**Das ist der mit Abstand beste Aufwand/Nutzen-Posten des gesamten Audits.**

Der Bank-Import parst bereits CAMT.053, MT940 und CSV — die schwierige Arbeit ist getan. Aber:

```javascript
// js/bank-import.js:410
'Nur Ausgaben werden als Betriebsausgabe importiert.
 Einnahmen müssen über das Rechnungsmodul erfasst werden.'
```

[js/bank-import.js:404](../js/bank-import.js#L404) zeigt Gutschriften mit dem Vermerk
„Einnahme (kein Import)" und lässt sie liegen. Damit fehlt genau der **häufigste Grund**, warum ein
Selbstständiger überhaupt einen Kontoauszug importiert: *„Welche meiner Rechnungen sind bezahlt?"*

Heute muss der Nutzer seine offenen Rechnungen von Hand mit dem Kontoauszug abgleichen und einzeln
auf „bezahlt" setzen. Bei 30 Rechnungen im Monat ist das die lästigste wiederkehrende Aufgabe im
ganzen Produkt — und sie ist bereits zu 80 % gelöst, nur nicht verbunden.

**Umsetzung, rein clientseitig:** Eingehende Beträge gegen offene Rechnungen matchen —
Rechnungsnummer im Verwendungszweck (Regex, trifft die Mehrheit), sonst Betrag + Kundenname +
Datumsfenster. Vorschlagsliste zum Bestätigen, kein Auto-Buchen. Das Mahnwesen
(`rechnungen/js/mahnungen.js`) und der EÜR-Sync-Button hängen ohnehin schon am Bezahlt-Status.

**Warum P0 trotz „nur" Komfort:** Es ist die einzige P0-Lücke, die **ohne** Bruch mit der
Local-First-Architektur schließbar ist, und sie hebt den vorhandenen Bank-Import von „halb
gebaut" auf „der Grund, warum ich das Tool aufmache".

---

## 🔴 P0 — G1: ELSTER-Direktübermittlung

**Belegt:** sevDesk wirbt damit, dass die UStVA „mit einem Klick … direkt aus sevdesk an dein
Finanzamt" geht und man „kein zusätzliches Zertifikat" braucht. Lexware Office ebenso:
„Mit einem Klick auf ‚Übermitteln' … Ganz ohne eigenes ELSTER-Zertifikat."

Stackr hat die UStVA-**Berechnung** (`js/ustvoranmeldung.js`) und einen ELSTER-**CSV-Export**
([js/euer.js:1005-1071](../js/euer.js#L1005)) — aber die Übermittlung muss der Nutzer selbst im
ELSTER-Portal nachtippen. Bei monatlicher Voranmeldung ist das **12× im Jahr Handarbeit** genau an
der Stelle, an der Fehler teuer werden.

**Der Haken — und der ist strategisch, nicht technisch:** ELSTER-Übermittlung geht nur über die
ERiC-Bibliothek, die serverseitig laufen muss. Ein solcher Server sähe die Umsatzsteuerdaten im
**Klartext**. Das kollidiert frontal mit dem, was Stackr verkauft: „100 % lokal · DSGVO" und ein
Cloud-Sync, der ausschließlich Chiffrat speichert.

**Realistische Optionen:**
1. **Nicht bauen, sondern erklären.** Position: „Deine Steuerdaten verlassen dein Gerät nie —
   auch nicht für die Übermittlung." Der Export bekommt eine Schritt-für-Schritt-Anleitung
   (siehe auch U11 im UX-Audit). Kostet fast nichts, macht aus der Lücke eine Haltung.
2. **Eng gekapselter Übermittlungsdienst**, der ausschließlich die UStVA-Kennzahlen sieht und
   nichts speichert — mit ausdrücklicher Einwilligung pro Übermittlung. Teuer, braucht
   AV-Vertrag und DSGVO-Dokumentation, kollidiert weniger als ein Vollzugriff.

**Empfehlung:** Option 1 jetzt, Option 2 erst wenn Kunden es aktiv fordern. Diese Lücke ist P0
für die *Wahrnehmung*, nicht zwingend für den Code.

---

## 🟠 P1 — G2: Bankkonto-Anbindung (PSD2)

sevDesk unterstützt „über 4.000 Banken und Neobanken" per Kontoverknüpfung. Stackr braucht einen
manuellen Datei-Export aus dem Online-Banking.

Gleiches Architekturproblem wie G1: PSD2-Kontozugriff verlangt einen lizenzierten
Kontoinformationsdienst (oder einen Aggregator wie GoCardless/finAPI) — beides serverseitig, beides
mit Sicht auf Klartext-Umsätze.

**Empfehlung:** Nicht angehen, solange G3 nicht steht. Ein funktionierender Zahlungsabgleich auf
Basis eines monatlich hochgeladenen CAMT-Exports liefert **den größten Teil des Nutzens** ohne
Architekturbruch und ohne Lizenzfragen. Erst wenn Kunden die manuelle Datei explizit als
Hauptärgernis nennen, lohnt die Diskussion.

---

## 🟠 P1 — G4: OCR / Belegerkennung

sevDesk und Lexware setzen KI-Texterkennung ein, sevDesk gilt als führend bei automatischer
Kategorisierung. Stackr kann ein Foto **anhängen** ([eigenbelege/js/app.js:789](../eigenbelege/js/app.js#L789)),
liest aber nichts daraus; Kategorien rät heute nur `guessCategory()` über den Verwendungszweck im
Bank-Import.

**Chance statt Lücke:** OCR läuft mit Tesseract.js **vollständig im Browser**. Damit ließe sich
das Feature bauen, **ohne** die Local-First-Zusage zu brechen — und genau das wäre die Aussage,
die kein Wettbewerber machen kann: *„Belegerkennung, bei der der Beleg dein Gerät nie verlässt."*

Zu bedenken: ~2 MB zusätzliche Bibliothek (lazy laden wie ApexCharts heute schon,
[js/dashboard.js:11](../js/dashboard.js#L11)) und spürbar schwächere Trefferquote als eine
Cloud-KI. Für Betrag/Datum/Lieferant bei Kassenbons reicht es meist.

**Empfehlung:** Als Experiment hinter „Beta" — erst Betrag + Datum, nicht der volle Beleg.

---

## 🟠 P1 — G5: ZUGFeRD-Hybrid-PDF im Ausgang

`rechnungen/js/xrechnung.js` heißt im Kopf „XRechnung / **ZUGFeRD** XML Generator", erzeugt aber
nachweislich nur **Standalone-XML**: die Suche nach `PDF/A`, `EmbeddedFile` oder `AFRelationship`
liefert im gesamten Projekt **null Treffer**.

Das ist ein Unterschied, der beim Empfänger ankommt. XRechnung-XML ist für Behörden und
E-Rechnung-fähige Empfänger richtig; ein normaler Geschäftskunde bekommt eine XML-Datei, die er
nicht lesen kann. ZUGFeRD löst genau das: ein normal aussehendes PDF mit eingebettetem XML.
Alle drei Wettbewerber unterstützen beides.

**Empfehlung:** PDF/A-3-Einbettung in die bestehende PDF-Erzeugung nachrüsten. Die XML-Seite ist
bereits fertig — es fehlt nur die Verpackung. Bis dahin: die Bezeichnung „ZUGFeRD" im Code-Kopf
und in etwaiger Außenkommunikation vermeiden, sie ist derzeit nicht zutreffend.

---

## 🟡 P2 / 🟢 P3 — kurz

- **G6 Zahlungslink in der Rechnung** — keine Treffer für Stripe/PayPal/Zahlungslink im
  Rechnungsmodul. Nachweislich verkürzt ein „Jetzt bezahlen"-Button die Zahlungsdauer; für Stackr
  reicht ein konfigurierbarer statischer Link (PayPal.me / Stripe Payment Link) im Rechnungsfuß.
  Kleiner Aufwand, spürbarer Nutzen, kein Backend.
- **G7 Team-Zugang** — die Gerätesperre bindet lokale Daten fest an **eine** Whop-User-ID
  ([js/whop-auth.js:397-407](../js/whop-auth.js#L397)); Mehrbenutzerbetrieb ist bewusst
  ausgeschlossen. Der StB-Read-only-Grant ist die einzige Freigabe. Passt zur Zielgruppe
  Solo-Selbstständige — bewusst offen lassen und im Marketing nicht verschweigen.
- **G8 Native App** — responsive Web ist da, native nicht. Für Solo-Nutzer verzichtbar, solange
  G4 (Beleg per Handyfoto) nicht kommt. Dann würde es zusammen Sinn ergeben.
- **G9 Auftragsbestätigung/Lieferschein** — es gibt `rechnung`, `angebot`, `gutschrift`. Ein
  vierter Typ ist wenig Arbeit; Bedarf bei der Zielgruppe aber fraglich.
- **G10 Öffentliche API** — `js/webhooks.js` sendet **ausgehend** drei Events
  (`einnahme`, `rechnung`, `eigenbeleg`) an eine Make.com-URL, fire-and-forget ohne Retry
  ([js/webhooks.js:9-35](../js/webhooks.js#L9)). Keine lesende API, kein Zapier-Connector.
  Bei einer Local-First-App ohne Server auch schwer nachzurüsten — die Daten liegen nun mal
  im Browser des Nutzers.

---

## Positionierung

```
                 Feature-Vollständigkeit
                          hoch
                           │
              DATEV ●      │
                           │        ● sevDesk
         Lexware Office ●  │
    ───────────────────────┼───────────────────────
      komplex              │              einfach
                           │   ● Stackr
              ● Papierkram │   ● FastBill
                           │
                          gering
```

**Wo Stackr wirklich steht:** nicht „einfacher als sevDesk", sondern **anders zugeschnitten**.
Die Achse „Feature-Vollständigkeit" führt in die Irre — Stackr hat 28 Module, aber eine völlig
andere Auswahl. Es fehlt die *Automatisierung* (Bank, OCR, ELSTER); es gibt dafür *Tiefe in
Nischen*, die keiner der drei anbietet.

**Drei belastbare Alleinstellungsmerkmale:**

1. **E-Rechnung ohne Aufpreis.** Bei Lexware Office ist die E-Rechnungsfunktion erst im
   XL-Tarif zu **32,90 €** enthalten — bei Stackr ist sie für **15 €** drin, für jeden Kunden.
   Das ist die stärkste einzelne Aussage, die aus diesem Audit hervorgeht, und sie steht
   heute nirgends auf der Landingpage.
2. **Lager + Buchhaltung in einem Tool.** Für Reseller/Etsy/Amazon-Verkäufer gibt es das im
   Vergleichsfeld faktisch nicht. Dazu §25a-Differenzbesteuerung und Retouren.
3. **Local-First / echtes E2E.** Kein Wettbewerber kann sagen, dass die Daten das Gerät nicht
   verlassen. Das ist zugleich die Ursache für G1/G2 — die Lücke und der USP sind **dieselbe
   Entscheidung**. Genau so sollte sie auch kommuniziert werden, statt als Rückstand.

**Empfehlung: Option A (Nischen-Fokus).** Nicht gegen sevDesk auf Automatisierung antreten —
dieser Kampf ist mit Local-First nicht zu gewinnen und muss auch nicht geführt werden. Stattdessen:
Reseller/Solo-Selbstständige mit Warenbestand, plus jeder, dem Datenhoheit wichtig ist.

---

## ROI-Reihenfolge

| Rang | Feature | Warum |
|---|---|---|
| 1 | **G3 Zahlungsabgleich** | Größter spürbarer Nutzen pro Arbeitstag, rein clientseitig, Bank-Parser existiert bereits |
| 2 | **G1 als Positionierung** (Option 1) | Export-Anleitung statt ELSTER-Anbindung — Textarbeit, entschärft die auffälligste Lücke |
| 3 | **USP 1 ins Marketing** | E-Rechnung für 15 € statt 32,90 €. Kostet null Entwicklung. |
| 4 | **G5 ZUGFeRD-PDF** | Behebt eine Aussage, die aktuell nicht stimmt, und macht E-Rechnungen für normale Kunden lesbar |
| 5 | **G6 Zahlungslink** | Kleiner Eingriff, wirkt direkt auf die Zahlungsmoral der Kunden des Nutzers |
| 6 | **G4 OCR (Beta, im Browser)** | Einziger Weg, bei der Automatisierung aufzuschließen, ohne Local-First aufzugeben |
| — | G2, G7, G8, G10 | Erst bei belegter Kundennachfrage — alle vier verlangen einen Architekturbruch |

---

## Quellen

- [Buchhaltungssoftware Vergleich 2026 — sevdesk vs. Lexware vs. FastBill](https://erechnung-guide.de/software-vergleich/)
- [SevDesk vs Lexoffice vs FastBill 2026 — 3er-Vergleich](https://buchhaltung-test.com/ratgeber/sevdesk-vs-lexoffice-vs-fastbill-2026-vergleich/)
- [sevdesk — Umsatzsteuervoranmeldung / ELSTER-Schnittstelle](https://sevdesk.de/umsatzsteuervoranmeldung/)
- [Lexware Office — Umsatzsteuer-Voranmeldung übermitteln](https://help.lexware.de/de-form/articles/548954-erklarvideo-ubermittlung-der-umsatzsteuer-voranmeldung)
- [sevdesk — Produktübersicht (Bankanbindung, 4.000+ Banken)](https://sevdesk.de/produktuebersicht/)
- [Buchhaltungssoftware Vergleich 2026 | Kosten.org](https://kosten.org/finanzen/buchhaltung)
