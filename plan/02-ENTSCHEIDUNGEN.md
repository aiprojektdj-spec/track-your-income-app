# Bewusst so — und warum

**Stand: 2026-08-14.** Einstieg: [`00-STAND.md`](00-STAND.md)

Diese Datei existiert, damit dieselben Dinge nicht bei jedem Audit erneut als Fund gemeldet
werden. Alles hier ist **geprüft und bewusst so entschieden**. Wer einen dieser Punkte trotzdem
ändern will, sollte vorher die Begründung entkräften können.

---

## Architektur

### Das Whop-Gate ist per Browser-Konsole umgehbar — und das bleibt so

`App._continueAfterAuth()` ist eine öffentliche Methode; zwei Zeilen in der Konsole schalten die
Oberfläche frei. Zusätzlich ist die ganze App eine statische Seite, die man herunterladen und
lokal öffnen kann.

**Warum nicht fixen:** Bei einer Local-First-App liegt die gesamte Rechenlogik beim Client. Das
ist prinzipiell nicht dicht zu bekommen, und jede Stunde, die man in Client-Gate-Härtung steckt,
ist verschwendet. Was serverseitig hängt — Cloud-Sync, Blob-Upload, StB-Freigaben — ist korrekt
gegated und bleibt dem Bypasser verschlossen. **Die richtige Antwort ist Wertverlagerung nach
hinten, nicht mehr Gate.**

### Kein Delta-Sync für Cloud-Sync

Der komplette Blob wird bei jeder Änderung übertragen.

**Warum nicht fixen:** CAS (optimistische Nebenläufigkeit über Versionsvergleich) und der
Merge-Algorithmus sind korrekt und getestet. Ein Delta-Verfahren würde beides erheblich
verkomplizieren und genau dort Fehler einführen, wo heute keine sind — bei der Datenintegrität.
**Stattdessen:** Ver-/Entschlüsselung in einen Web Worker (F6 in
[`01-AUFGABEN.md`](01-AUFGABEN.md)), damit die UI nicht einfriert.

### Kein Build-System — vorerst

Kein Bundler, keine Minification, kein Tree-Shaking. `package.json` existiert nur für die
Serverless-Funktionen und sagt es selbst: „Kein Build-Schritt für die statische Seite."

**Warum:** Drei Dinge, die kein Cloud-Wettbewerber bieten kann — der ausgelieferte Code **ist**
der geschriebene (bei einem Produkt, das mit „deine Daten verlassen dein Gerät nicht" wirbt,
kann das jeder nachprüfen); praktisch keine Lieferketten-Fläche (**eine** Produktiv-Abhängigkeit
statt hunderter transitiver Pakete); keine Build-Fäulnis.

**Wechselpunkt, falls doch:** wenn der Anwendungscode deutlich über die jetzigen ~1,8 MB wächst
**oder** die zwei parallel laufenden Chart-Bibliotheken (~800 KB) grundsätzlich angegangen
werden. Vorher bringt F2 mehr und kostet fast nichts.

### Rate-Limits fallen bei Redis-Ausfall offen

Alle vier API-Endpunkte behandeln Redis-Fehler beim Rate-Limit als nicht-blockierend.

**Warum:** Ein zahlender Kunde darf nicht an einem Redis-Ausfall scheitern. Fail-open ist hier
die richtige Entscheidung. ~~**Einzige Empfehlung:** Die `console.error`-Zeilen sollten einen
Alert auslösen statt nur im Log zu versanden.~~ **Erledigt 2026-08-16:** `api/_alert.js` meldet
jeden offenen Deckel an `ALERT_WEBHOOK_URL` (Slack- und Make.com-kompatibel), entprellt auf eine
Meldung je Ereignis und 5 Minuten. Neun Stellen in vier Endpunkten, inklusive des
Blob-Byte-Budgets, das dieselbe Fail-open-Eigenschaft hat. Ist die Variable nicht gesetzt,
verhält sich alles wie vorher. **Noch zu tun: `ALERT_WEBHOOK_URL` in Vercel setzen** — ohne sie
bleibt es beim Log.

### Kein Mehrbenutzer-/Teamzugang

Die Gerätesperre bindet lokale Daten fest an **eine** Whop-User-ID. Der StB-Read-only-Grant ist
die einzige Freigabe.

**Warum:** Passt zur Zielgruppe Solo-Selbstständige. ~~Sollte im Marketing aber nicht
verschwiegen werden.~~ **Erledigt 2026-08-16:** FAQ-Eintrag „Können mehrere Personen mit
demselben Konto arbeiten?" in `index.html` — benennt das Nein, den StB-Lesezugang als Ausnahme
und die GbR-Gewinnverteilung, und sagt ausdrücklich, wann Stackr das falsche Werkzeug ist.
*(`landing-v2.html` hat den Eintrag noch nicht — die Datei wurde von einer parallelen Session
gehalten.)*

---

## Automatisierung, die einen Server mit Klartextzugriff bräuchte

Diese vier Lücken haben **dieselbe Ursache** und sind keine Versäumnisse, sondern die Kehrseite
der Local-First-Entscheidung. Sie gehören so kommuniziert — nicht als Rückstand.

| Lücke | Warum blockiert |
|---|---|
| **ELSTER-Direktübermittlung** | ERiC ist eine native Bibliothek und muss serverseitig laufen. Dieser Server sähe die Umsatzsteuerdaten im Klartext |
| **PSD2-Bankanbindung** | Braucht einen lizenzierten Kontoinformationsdienst — serverseitig, mit Sicht auf Klartext-Umsätze |
| **Automatischer Mahnungsversand** | Setzt einen Server voraus, der Rechnungsinhalte kennt |
| **Lesende REST-API** | Die Daten liegen im Browser des Nutzers, nicht auf einem Server |

**Empfehlung für ELSTER:** nicht bauen, sondern zur Haltung machen — *„Deine Steuerdaten
verlassen dein Gerät nie, auch nicht für die Übermittlung"* — plus eine Schritt-für-Schritt-
Anleitung nach dem CSV-Export. Kostet fast nichts und macht aus der Lücke ein Argument.
**Die Anleitung ist gebaut** (`js/euer.js:1074`): Modal mit drei Schritten statt eines Toasts,
inklusive Hinweis, dass Z64 eine Sammelzeile ist. Offen bleibt nur der Marketing-Teil.

**Preisrecherche zu den vier Lücken:** [`server-kosten-psd2-2026-08-16.md`](server-kosten-psd2-2026-08-16.md)
— Kernbefund: der Server ist nicht das Kostenproblem (er läuft längst), und die einzige
kostenlose PSD2-Abkürzung (Nordigen/GoCardless) nimmt seit 2025 keine Neukunden mehr auf. Ein
Aggregator kostet 3–4 € je Kunde und Monat, also **24–32 % vom Nettoerlös** — bei Anbietern mit
Sockelbetrag 500–2.000 € im Monat ab Tag 1. Der vorhandene CAMT.053-/MT940-Import
(`js/bank-import.js`) deckt denselben Bedarf zum Preis eines Klicks im Online-Banking.

**Die eine Ausnahme:** **OCR** lässt sich als **Browser-OCR** (Tesseract.js) bauen, ohne die
Zusage zu brechen. Das wäre eine Aussage, die kein Wettbewerber machen kann: *Belegerkennung,
bei der der Beleg dein Gerät nie verlässt.* Spezifikation liegt vor (`9567630`).

---

## Produkt und Preis

### Ein Preis, keine Staffel — entschieden 2026-08-21

15 €/Monat für alle, unabhängig von Nutzungsintensität und Firmenanzahl.

**Warum:** „Keine Tarif-Treppe" ist auf der Landingpage bereits ein Verkaufsargument und die
Spitze gegen Lexware, das die E-Rechnung erst im 32,90-€-Tarif freischaltet. Eine eigene Staffel
würde genau dieses Argument entwerten.

Falls das je aufgemacht wird: **nach Firmenanzahl staffeln, nie nach Features.** Ein Pflichtthema
wie die E-Rechnung hinter einen höheren Tarif zu legen, ist der Fehler, den Stackr dem
Wettbewerb vorhält.

**Offen und davon unberührt:** das Steuerberater-Modell. Der StB-Zugang ist gebaut und
kostenlos, eine Kanzlei mit 40 Mandanten zahlt nichts. Wenn das angegangen wird, dann zusammen
mit dem Grant-Deckel (R4) — erst das Leck schließen, dann Preis verlangen.

### Zielgruppe: die EÜR-Rechtsformen stehen vorn — entschieden 2026-08-21

Beworben werden **Einzelunternehmen, Freiberufler, GbR und eGbR**. Die Bilanz-Formen (OHG, KG,
GmbH, UG, GmbH & Co. KG) sind in `js/rechtsform.js` vollständig hinterlegt und werden auf der
Seite genannt, aber nicht in den Vordergrund gestellt — die Bilanz-Tiefe ist nicht auditiert.

„Reseller" ist **keine Rechtsform**, sondern ein Anwendungsfall; die Stärke dort liegt im
Lager-Modul und trifft quer durch alle Formen. Die drei Personas auf der Landing
(Freelancer/GbR/Reseller) bleiben deshalb bestehen.

**Zeiterfassung wird nicht gebaut** — eigenes Produktfeld mit guten Speziallösungen, die Energie
gehört zu Reseller und GbR.

### Die Zahl ist 29 — und sie heißt „Bereiche", nicht „Module" (2026-08-21)

**Ersetzt die Festlegung auf 28 vom selben Tag.** Beide Zahlen sind am Code belegbar, der
Unterschied ist genau das Dashboard: `App.pages` registriert **29** Einträge, 28 davon ohne das
Dashboard. Der Betreiber hat sich für „alles zählen" entschieden — ein Dashboard ist unstrittig
ein *Bereich*, auch wenn man streiten kann, ob es ein *Modul* ist. Damit entfällt die
Definitionsfrage, und die Zahl ist direkt aus `App.pages` nachzählbar.

Der zweite Teil der Entscheidung ist der wichtigere: **das Wort wechselt von „Module" auf
„Bereiche".** Grund ist eine Verwechslung, die die 28er-Eintragung selbst schon notiert hatte:
die Akademie wirbt auf derselben Seite mit „9 Module, 31+ Lektionen" — das sind *Lernmodule*,
nicht Funktionsbereiche. Zwei verschiedene Dinge hießen gleich und standen zwei Bildschirme
auseinander. Jetzt heißt das eine „Bereiche", das andere bleibt „Module".

Zum Vergleich, alles am 2026-08-21 ausgezählt: 29 Einträge in `App.pages`, davon rund sechs an
die Rechtsform gebunden und für ein Einzelunternehmen unsichtbar (Körperschaftsteuer, Bilanz,
Lohnsteuer, Gewerbesteuer, GbR …) · 17 Sidebar-Menüpunkte · 6 Topnav-Oberbereiche ·
3 eigenständige Sub-Apps.

Die ursprüngliche Angabe „12 Module" war aus nichts ableitbar und hat die App unter Wert
verkauft. Umgesetzt an allen vier Stellen der Landingpage in `7635b2f`; im Browser gegengeprüft,
dass die einzige verbliebene Modulzahl die 9 der Akademie ist.

### OCR wird doch gebaut — Zurückstellung aufgehoben (2026-08-27)

**Der User hat die Zurückstellung vom 2026-08-16 aufgehoben:** „OCR muss fertig werden, eigene
Session." Der Trustpilot-Auslöser gilt nicht mehr als Bedingung — es wird gebaut, ohne auf
Bewertungen zu warten.

**Was das bedeutet:**

- OCR ist wieder **aktiver Auftrag** in [`01-AUFGABEN.md`](01-AUFGABEN.md), Abschnitt 1.
- Umsetzung **in einer eigenen Session**, nicht nebenbei — ausdrückliche Vorgabe. Startpunkt:
  [`session-prompt-ocr-2026-08-27.md`](session-prompt-ocr-2026-08-27.md).
- Die Rahmenbedingungen der Spezifikation bleiben unverändert gültig, insbesondere: **nur
  Browser-OCR**, keine Server-Variante auch nicht als Fallback.

**Die CSP-Freigabe liegt bereits vor** und muss nicht erneut eingeholt werden: `'wasm-unsafe-eval'`
darf auf `/app.html` und `/eigenbelege` gesetzt werden, Landing, Rechtstexte und `/api/*` behalten
die harte CSP (Abschnitt 7 der Spezifikation, beantwortet 2026-08-12).

**OCR wird auf der Landingpage nicht beworben — entschieden 2026-08-27.**

Das Feature wird gebaut und ist in der App ganz normal benutzbar. Es taucht aber **nicht** auf
`index.html` auf: kein Feature-Punkt, kein Bullet in der Preisliste, kein FAQ-Eintrag, keine
Zeile in der Wettbewerbs-Vergleichstabelle, kein Wort im `<title>` oder in der Meta-Description.

Der Grund ist derselbe, aus dem der Lexware-Preis aus M1 herausgeflogen ist: **Auf der Seite
steht nur, was belegbar ist.** Wie zuverlässig Browser-OCR einen zerknitterten Tankbeleg oder
einen Thermobon liest, weiß bis zu echten Kundenbelegen niemand. Eine beworbene Belegerkennung,
die im Alltag danebengreift, ist teurer als gar keine — sie erzeugt Erwartung, Enttäuschung und
im Zweifel eine §5-UWG-Diskussion über eine Eigenschaft, die die Kaufentscheidung getragen hat.

**Wiederaufgreifen:** sobald an echten Belegen eine Trefferquote gemessen ist, die man
hinschreiben kann. Dann gehört die gemessene Zahl in die Aussage, nicht das Wort „automatisch".

*Nicht zu verwechseln mit der Zurückstellung vom 2026-08-16: Der Bau ist ausdrücklich freigegeben.
Zurückgehalten wird nur die Bewerbung.*

*Der Einwand aus der Zurückstellung bleibt der Vollständigkeit halber festgehalten — kein Kunde
hat die Belegerfassung bisher als Schmerz genannt, die Annahme stammt aus dem Wettbewerbsvergleich.
Der User hat das abgewogen und anders entschieden. Kein Grund, die Frage erneut aufzuwerfen.*

<details>
<summary>Überholt: die Zurückstellung vom 2026-08-16</summary>

### OCR wird zurückgestellt — Auslöser sind Trustpilot-Bewertungen (2026-08-16)

**Korrigiert die Eintragung vom 2026-08-23, die OCR als „wird gebaut" nach Abschnitt 1 der
Aufgabenliste gesetzt hat.** OCR ist **kein offener Auftrag**.

**Warum:** Es ist das größte Einzelvorhaben im Backlog (mehrere Sitzungen, neue Abhängigkeit
Tesseract.js, CSP-Freigabe) und dafür das am schlechtesten belegte. Kein Kunde hat die
Belegerfassung bisher als Schmerz genannt — die Annahme stammt aus dem Wettbewerbsvergleich,
nicht aus Kundenkontakt.

**Auslöser zum Wiederaufgreifen: Es liegen Trustpilot-Bewertungen vor.** Dann gibt es echtes
Kundenfeedback, und die Frage lässt sich beantworten statt raten. Nennen mehrere Bewertungen die
Belegerfassung, wird gebaut — sonst nicht.

Die Spezifikation bleibt liegen ([`ocr-belegerkennung-2026-08-12.md`](ocr-belegerkennung-2026-08-12.md),
`9567630`) und verfällt nicht. Wenn gebaut wird, dann **ausschließlich als Browser-OCR** — der
Beleg verlässt das Gerät nie, keine Server-OCR, auch nicht als Fallback.

### Top-of-Funnel: die Demo wird ausgebaut, die Kartenpflicht bleibt (2026-08-16)

Von vier Wegen — Demo aufwerten, Trial ohne Kartenpflicht, Read-only-Tier, alles lassen —
gewinnt der erste.

**Warum nicht Trial ohne Karte:** Hängt an der §356a-Klausel im AGB, die noch auf die
Anwaltsprüfung wartet. Eine Widerrufsklausel, die nicht trägt, ist bei einem Trial-Modell der
teuerste Fehler — nicht vor der Freigabe anfassen.

**Warum kein Read-only-Tier:** Ein zweiter Berechtigungszustand, den jeder der 29 Bereiche kennen
muss. Bauaufwand in der Breite für eine unbelegte Annahme.

**Warum die Demo:** Sie existiert, ist echt (Dashboard, Buchungen, EÜR, GoBD-Protokoll) und
lässt Gate-Logik wie Rechtstexte unberührt. Ausbau statt Umbau.

> **Nebenbefund, der die Dringlichkeit dämpft:** Bei rund 100 Besuchern die Woche — eigene
> Aufrufe eingerechnet — ist die Engstelle eher der Zulauf als die Umwandlung. Eine perfekte
> Demo vor leerem Saal ändert wenig.

### Steuerberater-Zugang bleibt vorerst kostenlos — erst messen (2026-08-16)

Der Zugang ist gebaut, der Grant-Deckel aus R4 steht (`SYNC_MAX_GRANTS`, Default 10 in
[`api/sync.js:147`](../api/sync.js)). Das Leck ist zu, die Preisfrage bleibt offen.

**Vor jeder Preisentscheidung steht eine Zahl, die niemand hat:** Wie viele Freigaben laufen
überhaupt? Whop weiß das nicht, es steht in Upstash (`grantsby:<userId>`). Solange die Antwort
„eine Handvoll" lauten könnte, ist jedes Kanzlei-Preismodell eine Lösung ohne Problem.

**Nächster Schritt, wenn das angegangen wird:** Grants zählen, nicht Tarife entwerfen.


</details>
---

## Recht und Datenschutz

### Die §25a-Marge wird mit 19 % gerechnet — der ermäßigte Satz gilt dafür nie (2026-09-03)

Die fest verdrahteten 19 in [`js/euer.js:165`](../js/euer.js),
[`js/gbr-modul.js:85`](../js/gbr-modul.js) und an vier Stellen in
[`js/ustvoranmeldung.js`](../js/ustvoranmeldung.js) sind **kein Vereinfachungs-Provisorium,
sondern der Gesetzeswortlaut**:

> **§25a Abs. 5 Satz 1 UStG:** „Die Steuer ist mit dem allgemeinen Steuersatz nach § 12 Abs. 1 zu
> berechnen."

Der ermäßigte Satz von 7 % auf Kunstgegenstände und Sammlungsstücke, der seit dem 1.1.2025 wieder
gilt (§12 Abs. 2 Nr. 13 UStG, Anlage 2 Nr. 53/54), betrifft Lieferung, innergemeinschaftlichen
Erwerb und Einfuhr in der **Regelbesteuerung**. Auf die Differenz greift er nicht.

**Warum das hier steht:** Ein Audit hat den Punkt am 2026-08-16 als Fund gemeldet und dabei Abs. 5
**Satz 2** zitiert — der regelt Steuerbefreiungen, nicht den Steuersatz. Die daraus abgeleitete
Empfehlung, ein Satz-Feld am Artikel zu bauen, hätte 7/107 statt 19/119 abgeführt und damit eine
systematische **Unterzahlung** erzeugt. Der Fund war nicht bloß überflüssig, er war gefährlich.
Deshalb: **nicht erneut aufmachen.** Herleitung in
[`25a-ermaessigter-satz-recherche.md`](25a-ermaessigter-satz-recherche.md).

Ebenfalls entschieden: **kein Guard für §25a Abs. 7 Nr. 1 Buchst. c.** Der Ausschluss gilt nur
„in den Fällen des Absatzes 2" — einem Wahlrecht, das der Wiederverkäufer gegenüber dem Finanzamt
erklären muss und das Stackr nirgends kennt. Beim Ankauf von Privatpersonen nach Abs. 1 greift er
nicht. Wird die Abs.-2-Option je gebaut, gehört der Ausschluss zu ihr.

**Nachtrag 2026-09-04.** Derselbe falsche 7-%-Hinweis stand ein zweites Mal am Warenart-Feld der
Rechnungsposition ([`rechnungen/js/rechnung.js:329`](../rechnungen/js/rechnung.js)) — korrigiert.
Die **Pflichtangabe nach §14a Abs. 6 UStG ist auf der PDF-Rechnung korrekt umgesetzt** und damit
kein offener Punkt mehr.

**Nachtrag 2026-09-05 — E-Rechnung gefixt.** `taxCategoryFor()` in
[`rechnungen/js/xrechnung.js`](../rechnungen/js/xrechnung.js) wies §25a-Positionen als
„Steuerfreier Umsatz" aus und ließ die §14a-Abs.-6-Pflichtangabe in der XML ganz fehlen. Dabei kam
heraus, dass eine differenzbesteuerte Lieferung an einen EU-Kunden mit USt-IdNr als **steuerfreie
ig. Lieferung** (Kategorie `K`) gemeldet wurde — §25a Abs. 5 Satz 2 UStG nimmt genau diese
Befreiung ausdrücklich aus, das war eine **Unterzahlung**. Die Ausfuhr (`G`) bleibt dagegen
korrekt, weil dieselbe Norm sie nicht mit aufzählt. Abgesichert durch
[`test/test-25a-xrechnung.js`](../test/test-25a-xrechnung.js), 23 Checks, gegen den Stand vor dem
Fix gegengeprüft.

**Nicht entschieden, weiterhin offen:** die Pauschalmarge von 30 % nach §25a Abs. 3 Satz 2 UStG.
Und unverändert gilt: der XRechnung-Export läuft **ohne KoSIT-/Schematron-Validierung** — das
sagt der Export-Toast selbst, und die Kategorie-`E`-Zuordnung für §25a gehört vor produktivem
Versand durch den offiziellen Validator.

### Kein Reparaturlauf für „verkauft ohne Umsatz" — gemessen, nicht geschätzt (2026-09-05)

Fund 1.5 war real: die Rechnungsmaske markierte einen Lagerartikel schon beim Verknüpfen als
verkauft, und wer sie ohne Speichern verließ, ließ ihn so stehen — aus Bestand und Lagerwert
verschwunden, ohne dass ihm ein Umsatz gegenübersteht. Behoben in `69461b4` und `39df75a`
(vier Ausgänge: eigene Sub-Nav, `beforeunload`, Top-Nav, eingebettete Sidebar).

**Was bewusst *nicht* gebaut wird: ein Reparaturlauf, der beim Laden der Lager-Seite Artikel
sucht, die als verkauft markiert sind, aber weder von einem Verkauf noch von einer
Rechnungsposition referenziert werden — und sie automatisch zurücksetzt.**

Grund ist eine Zählung, keine Schätzung. Am 2026-09-05 über alle acht Firmen direkt aus der
IndexedDB (`oyi_maindata`, Schlüssel `<firmaId>__reselling_purchases` / `__reselling_sales` /
`__rechnungsbuch_dokumente`), Kriterium `status === 'verkauft'` und nicht storniert und weder
über `purchaseId`/`purchaseIds` noch über `lagerArtikelId` belegt:

| Firma | Artikel | hängend |
|---|---|---|
| Reck & Schwarz GbR | 139 | **0** |
| Demo | 202 | **0** |
| Secondlife Vintage (3×) + secondlife | 1 | **0** |
| ghhfk | 0 | **0** |
| Test | 7 | 3 (unsere eigenen Testartikel) |

**Null in jeder echten Firma**, auch in der GbR mit 139 Artikeln über Monate. Zwei Sessions haben
unabhängig voneinander gezählt und kamen Zahl für Zahl auf dasselbe.

Der Tausch wäre also: stille Selbstheilung in eine **GoBD-Buchhaltung** einbauen — Daten, die
sich beim Seitenaufruf von selbst ändern — gegen ein Problem, das in über hundert echten
Verkäufen nachweislich nie entstanden ist. Auch die mildere Variante, ein Hinweis-Dialog statt
einer Korrektur, wäre eine Warnung vor etwas, das nicht vorkommt.

**Wenn sich das ändern soll,** ist die Zählung die Bedingung, nicht das Bauchgefühl: erst wieder
messen, und nur bei Treffern in einer echten Firma neu entscheiden. Die Abfrage läuft auch bei
aktivem Whop-Gate — die Daten hängen am Origin, nicht an der Anmeldung.

### KoSIT-Validierung der E-Rechnung — offen, weil sie eine neue Abhängigkeit wäre (2026-09-05)

Der XRechnung-Export läuft ohne offizielle Schematron-Prüfung; der Toast beim Export sagt das
selbst. Nach den §25a-Korrekturen in `e265a4b` (Kategorie E mit §14a-Abs.-6-Pflichttext, kein
Kategorie K mehr bei innergemeinschaftlicher Lieferung) ist die Zuordnung die fachlich übliche,
aber sie ist **nicht gegen den amtlichen Validator geprüft**.

**Das ist keine Entscheidung gegen die Validierung, sondern eine offene Frage an den Betreiber.**
Der KoSIT-Validator ist eine Java-Anwendung mit Schematron-Regelsatz. Damit fällt er unter Regel 6
in [`../CLAUDE.md`](../CLAUDE.md): keine neue Abhängigkeit ohne Rückfrage — es gibt genau eine
produktive (`@vercel/blob`), und der Verzicht auf einen Build-Schritt ist Architektur, nicht
Zufall. Eine Session hat das am 2026-09-05 bewusst **nicht** nebenbei mitgenommen.

Drei Wege stehen offen und sollten gegeneinander entschieden werden: gar nicht validieren und
den Hinweis im Export deutlicher machen; einmalig manuell durch den Online-Validator vor dem
ersten produktiven Versand; oder die Prüfung dauerhaft in CI, was die Java-Abhängigkeit
bedeutet — aber nur dort, nicht im ausgelieferten Produkt.

### Der Banner ist zweistufig — die notwendige Speicherung bleibt ohne Ablehnen-Button

**Geändert am 2026-08-15.** Bis dahin stand hier: „Der Cookie-Banner hat keinen Ablehnen-Button —
das ist korrekt." Für die **technisch notwendige** Speicherung gilt das unverändert: sie ist nach
**§25 Abs. 2 Nr. 2 TDDDG einwilligungsfrei**, ein Ablehnen-Button wäre dort irreführend, weil es
nichts abzulehnen gibt. Sie lässt sich im Banner deshalb bewusst nicht abwählen.

Als Gesamtaussage stimmte der Satz aber nicht mehr, sobald **Vercel Web Analytics** dazukam —
und das war schon vorher der Fall, siehe den nächsten Abschnitt. Der Banner hat seit D0 zwei
Schaltflächen: *Nur notwendige* und *Statistik erlauben*. Nur die zweite lädt das Messskript.
Widerruf nach Art. 7 Abs. 3 DSGVO über eine Schaltfläche in `cookies.html`.

*(L4 — „Cookies" statt localStorage/IndexedDB — ist mit dem neuen Bannertext erledigt.)*

### Kein GoBD-Testat

Lexware Office hat ein Testat nach IDW PS 880. Stackr nicht — das kostet Geld und bindet an einen
Versionsstand, was für ein Ein-Personen-Produkt kaum zu rechtfertigen ist.

**Wichtig ist nur die sprachliche Sauberkeit:** **nie „GoBD-zertifiziert" schreiben**, sondern
„GoBD-konform umgesetzt" mit Verweis auf die mitgelieferte Verfahrensdokumentation. Aktuell steht
der falsche Begriff **nirgends** — bitte so lassen.

### Kein Churn-Tracking im Produkt — mit einer Ausnahme, über die noch entschieden wird

**Korrektur vom 2026-08-15.** Hier stand: „Es gibt keine Nutzungsmessung, und das soll so
bleiben." Der erste Halbsatz war **falsch**: `/_vercel/insights/script.js` lag statisch in sechs
Seiten und maß Seitenaufrufe, Referrer, Browser/Gerät und Herkunftsland — ungefragt, auf zwei
Seiten sogar ohne eingebundenen Consent-Banner.

**Der Grundsatz bleibt richtig:** Ein Local-First-Produkt mit E2E, das „deine Daten verlassen dein
Gerät nicht" verspricht, darf kein Nutzungsverhalten messen, ohne genau dieses Versprechen zu
beschädigen. **Die Geschäftskennzahlen liefert Whop ohnehin:** aktive Mitgliedschaften,
Kündigungsquote, Trial-Konversion, Plan-Verteilung.

**Entschieden am 2026-08-16: Messung nur auf den öffentlichen Seiten, und dort nur nach
Einwilligung.** In `app.html`, `lager/`, `rechnungen/` und `eigenbelege/` wird weder gemessen noch
ein Banner gezeigt (`IS_APP_PAGE` in [`js/cookie-banner.js`](../js/cookie-banner.js)).

Grundlage waren die echten Zahlen aus dem Vercel-Dashboard (7 Tage: 100 Besucher, 417 Aufrufe,
61 % Absprung) und zwei Überlegungen:

- **In der App käme kaum etwas heraus.** Modulwechsel laufen über `history.replaceState`
  ([`js/app.js:542`](../js/app.js)) — gemessen würde im Wesentlichen „App geöffnet". Wie viele
  Leute die App öffnen, sagt Whop genauer, inklusive Abo-Status.
- **Auf der Landing ist es die einzige Quelle** für Herkunft und Absprung, und ein Besucher dort
  ist noch kein Kunde, dem die Zusage „deine Daten bleiben auf deinem Gerät" gilt.

**Beim Lesen der Zahlen beachten:** Eigene Aufrufe zählen mit, Vercel Hobby hat keinen IP-Filter.
Bei ~100 Besuchern die Woche ist der Anteil eigener Besuche erheblich — auf den eigenen Geräten
im Banner *Nur notwendige* wählen, dann fällt er weg. Die 4,2 Aufrufe je Besucher vom August 2026
sind aus diesem Grund vermutlich zu hoch.

Fällt die Messung später ganz weg, gehen zurück: der zweite Banner-Button, die
Widerrufs-Schaltfläche in `cookies.html`, deren gelockerte CSP (`script-src 'self'` → `'none'`,
Meta **und** `vercel.json`) und die entsprechenden Absätze in `datenschutz.html` und `cookies.html`.

### Der Audit-Log-Zeitstempel ist Client-Zeit

Wer die Systemuhr zurückstellt, kann rückdatieren; die Hash-Kette bleibt gültig, weil sie
Inhalte verkettet, nicht Zeiten.

**Warum nicht vollständig lösbar:** Bei einer App ohne Serverzwang geht es nicht. Der externe
Cloud-Anker (serverseitiges `ts` in `api/sync.js`) ist die richtige Antwort — er ist nur opt-in.
~~**Empfehlung:** den Anker im Protokoll-Modul bewerben statt still anbieten.~~ **Erledigt:**
`js/protokoll.js:328` zeigt eine eigene Karte, die den Zustand offen benennt — grün mit
„Externer Zeitnachweis aktiv", sonst gelb mit dem Hinweis, dass die Kette ohne Anker nur
geräteintern beweiskräftig ist, plus dem Weg dorthin. Die Schwelle ist `CloudSync.isHealthy()`,
nicht ein bloßes Eingeschaltet-Flag. Inzwischen erkennt das Log zusätzlich Uhr-Rücksprünge
(`41b21b6`), und `js/cloud-sync.js:1645` prüft die Anker täglich von selbst.

---

## Sicherheit — geprüft und bewusst offen gelassen

| Punkt | Begründung |
|---|---|
| **Access-Token in localStorage** | SPA-Standard-Tradeoff. Der Sync-Schlüssel liegt inzwischen als nicht-extrahierbarer CryptoKey in IndexedDB (`eafc902`) |
| **Blob-Objekte `access: 'public'`** | Dokumentierte Restgrenze. Der Inhalt ist E2E-verschlüsselt; die URLs tragen einen Zufallssuffix |
| **CSP `style-src 'unsafe-inline'`** | Eigenes Refactoring-Projekt — die App baut Styles inline auf. Kein Quick-Fix |
| **Grace-Token gegen Systemuhr** | Wer die Uhr stellen kann, kann auch die Konsole öffnen. Irrelevant neben dem Gate-Bypass |
| **Kein SRI an `js/vendor/*.js`** | SRI schützt bei **lokal ausgelieferten** Dateien vor nichts. Ersatz: SHA-256 in `js/vendor/VERSIONS.md` **plus** `.gitattributes` mit `js/vendor/*.js -text` — ohne das hätte `core.autocrlf=true` die dokumentierten Hashes beim Checkout zerstört |

---

## Design und UI

### Hardkodierte Hex-Farben in JS sind überwiegend korrekt

Rund 270 Vorkommen. Ein Zähllauf legt Design-System-Drift nahe — die Einzelprüfung entkräftet
das vollständig:

- **ApexCharts- und Chart.js-Literale** — Chart-Bibliotheken können keine CSS-Variablen auflösen.
  Der Code verzweigt sogar korrekt über `isDark`.
- **Das Druck-Stylesheet der Rechnung** (`rechnungen/js/rechnung.js` ab Zeile 1149) — eine
  Rechnung muss unabhängig vom App-Theme auf weißem Papier lesbar sein. CSS-Variablen wären
  dort ein **Fehler**.
- **Farbpaletten als Daten** — Kategorie- und Firmenfarben. Der Hex-Wert *ist* die Nutzdatenangabe.
- **`var(--token, #fallback)`** in den Gate-Overlays — richtig, weil sie erscheinen können,
  bevor `style.css` geladen ist.
- **`js/steuerberater.js`** baut ein eigenständiges Download-HTML mit eigenem `<style>`.

**Echte Funde wären nur:** `var(--primary)` (das Token existiert nicht) und
`var(--token,#hex)`-Fallbacks mit veralteten Werten — beide aktuell auf null.
**Die Kennzahl „hartkodierte Hex-Werte" taugt für dieses Projekt nicht als Drift-Indikator.**

### Local 1.7 wird nicht mehr gepflegt

Entscheidung vom 2026-08-11. Ordner bleibt liegen, wird **nicht** gespiegelt, **nicht** gefixt,
**nicht** gelöscht.

**Was bleibt:** der Local-**Import** in Web (`js/backup-crypto.js`, Firmen-Auswahl) als
Migrationspfad für Bestandskunden. Der muss funktionsfähig bleiben.

**Ein Rest, der dadurch offen blieb:** Local war bei der Input-Härtung (`maxlength`, `min`/`max`,
`Number.isFinite`) an einigen Stellen *voraus*. Das war bisher als Spiegelungsaufgabe geführt und
ist jetzt ein **eigenständiger Web-Fund** — teilweise nachgezogen (`641840b`), ~~systematisch
erhoben wurde es nie~~ **systematisch erhoben am 2026-08-16:**
[`funde-input-haertung-2026-08-16.md`](funde-input-haertung-2026-08-16.md).

474 `<input>`-Tags geprüft. Nach Triage bleiben 11 Zahlenfelder ohne Untergrenze, 63 persistierte
Textfelder ohne `maxlength` — und **ein echter Bug**, der bereits gefixt ist: `js/steuerberater.js`
setzte `maxlength` auf ein `type="number"`-Feld, wo es **keine Wirkung hat** — die
Steuerberater-PIN war unbegrenzt lang und verlor führende Nullen.

**Der eigentliche Befund ist ein anderer als erwartet:** `Number.isFinite` fehlt kaum irgendwo
sinnvoll (469 von 660 `parseFloat`-Aufrufen sind abgesichert). Das Muster ist überall
`parseFloat(…) || 0` — und das fängt `NaN` ab, aber **nicht `-500`**. Negative Verkaufspreise und
negative Plattformgebühren landen ungeprüft in der EÜR. **Wie bei den Hex-Farben taugt die
Rohzahl nicht als Kennzahl** — die Triage in der Funddatei ist der Punkt.

### Top-of-Funnel: die Demo wird ausgebaut, die Kartenpflicht bleibt — entschieden 2026-08-23

Seit der Local-Einstellung führt der einzige Weg über Landing → Checkout **mit Kartenpflicht**.
Drei Wege standen zur Wahl; gewählt ist der **Ausbau der bestehenden interaktiven Demo**
(`index.html`, Abschnitt `#demo` — Dashboard, Buchungen, EÜR, GoBD-Protokoll).

**Nicht gewählt und warum:**

- **Trial ohne Kartenpflicht** hätte die größte Conversion-Wirkung, verlangt aber eine
  Whop-Umkonfiguration und eine erneute Prüfung der **§356a-Widerrufsklausel** — die wartet
  ohnehin auf den Anwalt. Ein Widerrufsrecht, das nicht trägt, ist bei einem Trial-Modell der
  teuerste Fehler.
- **Read-only-Tier** wäre ein echter Free-Tier gegen den Wettbewerb, aber der größte Bauaufwand
  (Gate-Logik, Feature-Flags, Rechtstexte) — und kannibalisiert womöglich das Abo.

Die Demo ist der billigste Hebel: kein Eingriff ins Gate, keine Rechtstext-Änderung, kein
Missbrauchsrisiko. Sie existiert bereits und ist echt („kein Video und keine Animation").

### Steuerberater-Zugang bleibt kostenlos — entschieden 2026-08-23

Der StB-Zugang wird **nicht bepreist**. Begründung: Steuerberater, die Stackr im Mandat sehen,
empfehlen es weiter — der Zugang ist ein Vertriebskanal, kein entgangener Umsatz.

**Wichtig, weil in älteren Notizen anders vermerkt:** Der Grant-Deckel aus **R4 ist bereits
gebaut**. `MAX_GRANTS` steht per Default auf 10 aktive Freigaben je Owner und wird in
[`api/sync.js:499`](../api/sync.js) mit einem `409 grant_limit` durchgesetzt, anhebbar über
`SYNC_MAX_GRANTS` ohne Codeänderung. Ein Pro-Abo kann also **nicht** unbegrenzt Gratiszugänge
erzeugen. Die Kanzlei mit 40 Mandanten ist davon unberührt: der Deckel zählt Freigaben **pro
Owner**, nicht pro Kanzlei — 40 Mandanten sind 40 Owner mit je einer Freigabe.

Damit ist an dieser Stelle **nichts zu bauen**.

### OCR wird gebaut — als Browser-OCR — entschieden 2026-08-23

Die letzte Feature-Lücke gegen sevDesk und lexoffice, die weder gesetzlich erzwungen noch
architekturbedingt blockiert ist. Umsetzung ausschließlich als **Browser-OCR (Tesseract.js)**:
der Beleg verlässt das Gerät nie.

Das ist der Punkt, an dem Local-First vom Zugeständnis zum Verkaufsargument wird — *Belegerkennung,
bei der der Beleg dein Gerät nie verlässt* kann kein Wettbewerber mit Server-OCR behaupten.
Spezifikation inklusive der nötigen CSP-Freigabe liegt in
[`ocr-belegerkennung-2026-08-12.md`](ocr-belegerkennung-2026-08-12.md) (`9567630`).

**Keine Server-OCR, auch nicht als Fallback** — das bräche dieselbe Zusage, an der PSD2 und
ELSTER-Direktübermittlung gescheitert sind.

---

## Formulierungen, die nicht verwendet werden sollen

| Nicht schreiben | Stattdessen | Warum |
|---|---|---|
| „GoBD-zertifiziert" | „GoBD-konform umgesetzt" | Kein IDW-PS-880-Testat |
| „ZUGFeRD" für den Ausgang | „XRechnung" | Es wird Standalone-XML erzeugt, kein PDF/A-3-Hybrid (G5) |
| Erfundene Nutzerzahlen oder Testimonials | echte Zahlen (29 Bereiche, 200+ Tests) | §5 UWG, und diese Zielgruppe prüft |
| „Alle Daten werden gelöscht" | die tatsächliche Ausnahme benennen | Die Anker-Liste bleibt bewusst erhalten (GoBD-Tamper-Evidence) |
