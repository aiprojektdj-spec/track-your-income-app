# Was ein Server wirklich kostet — und warum das die falsche Frage ist

**Stand: 2026-08-16.** Recherche zur Frage aus
[`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md), Abschnitt *„Automatisierung, die einen Server mit
Klartextzugriff bräuchte"*. Einstieg: [`00-STAND.md`](00-STAND.md)

---

## Die Kurzfassung

**Du hast den Server bereits.** `api/sync.js`, `api/blob-upload.js`, `api/whop-access.js`,
`api/whop-token.js` und `api/blob-cleanup.js` laufen als Vercel-Functions, dazu Upstash Redis in
Frankfurt und ein Vercel-Blob-Store. Die Infrastruktur ist da und bezahlt.

Was ELSTER, PSD2, Mahnungsversand und REST-API blockiert, ist deshalb **nicht die Rechnung fürs
Hosting**, sondern zwei andere Dinge:

1. **Was dieser Server sehen dürfte.** Heute sieht er ausschließlich Chiffrat. Für alle vier
   Funktionen müsste er Buchhaltungsdaten **im Klartext** verarbeiten. Das ist die eine Zusage,
   mit der die Landingpage wirbt.
2. **Bei PSD2 zusätzlich: eine Lizenz.** Kontoinformationsdienst ist ein erlaubnispflichtiges
   Geschäft. Entweder BaFin-Erlaubnis (für ein Ein-Personen-Produkt ausgeschlossen) oder ein
   lizenzierter Aggregator — und der kostet **pro Kunde, jeden Monat, dauerhaft**.

---

## PSD2 — die einzige der vier Lücken, bei der eine Zahl die Entscheidung ändert

### Was der Markt 2026 verlangt

| Anbieter | Einstiegspreis | Freies Kontingent | Für Stackr geeignet? |
|---|---|---|---|
| open-banking.io | **3 €** erstes Konto, **1 €** je weiteres / Monat | nein | preislich ja, Abdeckung DE unklar |
| Plaid | 0,30–1,00 USD je Konto, **Mindestumsatz 500–2.000 USD/Monat** | nur Sandbox | nein — Mindestumsatz |
| Yapily | 200–500 GBP/Monat Einstieg | nur Sandbox | nein |
| TrueLayer | ~150–300 GBP/Monat | nur Sandbox | nein |
| Tink (Visa) | vierstelliger Monats-Mindestumsatz | nur Sandbox | nein |
| Salt Edge | ab ~500 USD/Monat | nur Sandbox | nein |
| finAPI (BaFin-lizenziert, DE) | **kein öffentlicher Preis**, transaktionsbasiert auf Anfrage | 30 Tage Test | Preis nur per Vertrieb |
| GoCardless / Nordigen | war kostenlos | **Neuanmeldungen geschlossen** | **nein — nicht mehr verfügbar** |

**Der wichtigste Einzelbefund:** Die kostenlose Option, auf die man bei so einer Rechnung
zuallererst hoffen würde — Nordigen, später GoCardless Bank Account Data — nimmt **keine neuen
Kunden mehr auf** und wird abgewickelt. Bestandsintegrationen laufen weiter, neue sind nicht
mehr möglich. Wer 2026 mit PSD2 anfängt, zahlt.

*Vorbehalt: die 3-€/1-€-Staffel stammt aus einem Beitrag, der den eigenen Dienst bewirbt, und
sagt nichts über die Abdeckung deutscher Sparkassen und Volksbanken — genau dort wohnt die
Zielgruppe. Vor jeder Entscheidung müsste das geprüft werden.*

### Was das bei 15 € Verkaufspreis bedeutet

15 € brutto sind bei 19 % USt **12,61 € netto**. Ein Solo-Selbstständiger hat typischerweise ein
Geschäfts- und oft noch ein Privatkonto:

| Szenario | Kosten/Kunde/Monat | Anteil am Nettoerlös |
|---|---|---|
| 1 Konto, günstigster Anbieter | 3,00 € | **24 %** |
| 2 Konten, günstigster Anbieter | 4,00 € | **32 %** |
| Anbieter mit 500 €/Monat Sockel | erst ab ~40 Kunden unter 12,61 € | Sockel läuft **ab Tag 1**, auch bei 0 Kunden |

**Ein Viertel bis ein Drittel der Marge**, für eine einzige Funktion, dauerhaft, bei einem
Produkt, dessen ganzes Versprechen „ein Preis, alles drin" ist. Und der Sockelbetrag der
etablierten Anbieter ist die eigentliche Sperre: 500–2.000 € im Monat sind fällig, bevor der
erste Kunde die Funktion einschaltet.

### Der Grund, der auch bei 0 € bliebe

Der API-Schlüssel eines Aggregators **kann nicht im Browser liegen** — wer ihn ausliest, fragt
fremde Konten ab. PSD2-Kontozugriff braucht also zwingend einen Server, der die Bank-Tokens hält
und die Umsätze im Klartext sieht.

**Damit ist PSD2 selbst geschenkt nicht mit „deine Daten verlassen dein Gerät nicht" vereinbar.**
Die Preisrecherche ist am Ende nur die Bestätigung einer Entscheidung, die schon architektonisch
feststand.

---

## Was du stattdessen hast — und was daran fehlt

**`js/bank-import.js` liest bereits CAMT.053-XML und MT940.** Das sind die beiden Formate, die
jede deutsche Bank im Online-Banking zum Download anbietet, Sparkassen und Volksbanken
eingeschlossen. Der Unterschied zu PSD2 ist **ein Klick im Online-Banking pro Monat** — dafür
0 € laufende Kosten, keine Lizenz, kein Server, kein Bruch der Zusage.

Der ehrliche Teil: [`03-ARBEITSREGELN.md`](03-ARBEITSREGELN.md) führt „der Bank-Parser las
Einnahmen und warf sie weg" als Beispiel für *gebaut, aber nicht angeschlossen*. **Bevor man über
PSD2 nachdenkt, gehört der vorhandene Import auf Herz und Nieren geprüft** — echte CAMT- und
MT940-Dateien von mindestens zwei Banken durchlaufen lassen. Das kostet einen Nachmittag statt
24 % der Marge und deckt den größten Teil desselben Bedarfs.

---

## Die anderen drei Lücken — keine Preisfrage

| Lücke | Was ein Server kosten würde | Was ihn wirklich blockiert |
|---|---|---|
| **ELSTER-Direktübermittlung** | Hosting vernachlässigbar, ERiC-Bibliothek kostenlos | Der Server sähe die kompletten Umsatzsteuerdaten im Klartext. [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md) empfiehlt zu Recht: nicht bauen, zur Haltung machen. Der Ersatz ist gebaut — [`js/euer.js:1074`](../js/euer.js) führt nach dem CSV-Export durch die drei Schritte |
| **Automatischer Mahnungsversand** | Mailversand ist der billigste Posten überhaupt | Der Server müsste Rechnungsinhalte kennen. Dieselbe Zusage. Mahnungen sind heute lokal erzeugbar, nur der Versand ist manuell |
| **Lesende REST-API** | — | Es gibt nichts zu bedienen: die Daten liegen im Browser. Eine API müsste erst eine Serverkopie erzeugen — also genau die Architektur aufgeben, für die Kunden zahlen |

---

## Empfehlung

1. **PSD2 nicht bauen.** Nicht wegen der Kosten, sondern weil es die Zusage bricht — die Kosten
   bestätigen es nur. Die kostenlose Abkürzung existiert seit 2025 nicht mehr.
2. **Den vorhandenen CAMT/MT940-Import verifizieren und im Marketing sichtbar machen.** Er ist
   gebaut, kostet nichts und löst 80 % des Problems.
3. **Die Lücke als Haltung formulieren, nicht als Rückstand.** Wettbewerber, die
   PSD2 anbieten, sehen die Umsätze ihrer Kunden. Stackr nicht. Das ist ein Satz, der verkauft.
4. **Falls doch jemals PSD2:** dann als getrennt bepreiste Zusatzfunktion mit eigener,
   ausdrücklicher Einwilligung — niemals im 15-€-Preis, und niemals ohne den Hinweis, dass für
   diese eine Funktion die Local-First-Zusage nicht gilt.

---

## Quellen

- [finAPI — Preise](https://www.finapi.io/en/prices/) · kein öffentlicher Preis, transaktionsbasiert auf Anfrage
- [GoCardless Bank Account Data — Übersicht](https://developer.gocardless.com/bank-account-data/overview)
- [Free & Indie Open Banking APIs 2026](https://www.openbankingtracker.com/guides/free-open-banking-apis)
- [The Cheapest Open Banking APIs for Small Businesses 2026](https://dev.to/johnfrandsen/the-cheapest-open-banking-apis-for-small-businesses-and-indie-builders-in-2026-5cab) · Anbieterbeitrag, Preise mit Vorbehalt
- [GoCardless Bank Account Data Alternatives](https://dev.to/johnfrandsen/gocardless-bank-account-data-alternatives-what-to-use-when-signups-are-disabled-326d)
- [Überblick: Top Open Banking API-Anbieter in Europa](https://www.it-finanzmagazin.de/ueberblick-die-top-open-banking-api-anbieter-in-europa-225553/)
