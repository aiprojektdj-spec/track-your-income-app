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

### Die Modulzahl ist 28 — festgelegt 2026-08-21

Am Code belegbar als `App.pages` ohne das Dashboard; deckt sich mit dem Feature-Gap-Audit.
Zum Vergleich: 6 Topnav-Oberbereiche, 17 Sidebar-Menüpunkte, 3 eigenständige Sub-Apps.
Die vorherige Angabe „12 Module" war aus nichts ableitbar und hat die App unter Wert verkauft.

> **Nicht verwechseln:** die Akademie wirbt mit „9 Module, 31+ Lektionen" — das sind
> *Lernmodule*, nicht Funktionsbereiche. Beide Zahlen stehen auf derselben Seite.

---

## Recht und Datenschutz

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

---

## Formulierungen, die nicht verwendet werden sollen

| Nicht schreiben | Stattdessen | Warum |
|---|---|---|
| „GoBD-zertifiziert" | „GoBD-konform umgesetzt" | Kein IDW-PS-880-Testat |
| „ZUGFeRD" für den Ausgang | „XRechnung" | Es wird Standalone-XML erzeugt, kein PDF/A-3-Hybrid (G5) |
| Erfundene Nutzerzahlen oder Testimonials | echte Zahlen (28 Module, 200+ Tests) | §5 UWG, und diese Zielgruppe prüft |
| „Alle Daten werden gelöscht" | die tatsächliche Ausnahme benennen | Die Anker-Liste bleibt bewusst erhalten (GoBD-Tamper-Evidence) |
