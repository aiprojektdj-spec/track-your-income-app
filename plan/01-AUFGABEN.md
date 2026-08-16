# Was noch zu tun ist

**Stand: 2026-08-15**, jeder Punkt gegen den Code verifiziert.

Einstieg: [`00-STAND.md`](00-STAND.md) · Nicht-zu-Ändern: [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md)

> **Korrektur 2026-08-15:** **A2, A4, A5, V2, L3, N3, D4** waren bereits in `6103208` erledigt,
> **F2** als `Utils.ensureXlsx()` gebaut. Diese Liste führte alle acht weiter als offen — sie war
> aus `restliste-2026-08-14.md` übernommen statt gegen den Code geprüft. **M1** ist am selben Tag
> gebaut worden. Alle neun sind unten abgehakt.

Getrennt nach **wer es machen kann**. Das ist die wichtigste Unterscheidung: Abschnitt 1 kann
jede Session sofort greifen, Abschnitt 2 braucht dich, Abschnitt 3 wartet auf Dritte.

> ⚠️ **Vor dem Anfassen `git status` prüfen.** Mehrere der genannten Dateien werden regelmäßig
> von parallelen Sessions gehalten. Details in [`03-ARBEITSREGELN.md`](03-ARBEITSREGELN.md).

---

## 1. Code — kann jede Session machen

### 1.1 Barrierefreiheit — ✅ erledigt (`6103208`)

**✅ A2 — Eingabefelder haben keinen erkennbaren Rand** · WCAG 1.4.11 (Level AA) · `css/style.css`

> Erledigt. **Korrektur zur Aufgabe:** der unten vorgeschlagene Wert `#4a5651` kam nur auf
> **2,5:1** und hätte den Verstoß nicht behoben. Gebaut wurde `--border-field: #636f68`
> ([`css/style.css:76`](../css/style.css)), im Light-Mode `#868173`
> ([`css/style.css:142`](../css/style.css)).

Berechnet: `.form-input` hat **1,47:1** Randkontrast, WCAG verlangt 3:1. Der übliche Ausweg
greift nicht — die Feldfüllung hebt sich mit **1,09:1** gegen die Karte praktisch nicht ab.
Weder Rand noch Füllung zeigen also, wo ein Feld ist, bis man hineinfokussiert.
*Der Fokus-Zustand ist unproblematisch (7,54:1) — nur der Ruhezustand.*

```css
:root { --border-field: #4a5651; }   /* ≈3,0:1 gegen --bg-input */
.form-input, .form-select, .form-textarea { border: 1px solid var(--border-field); }
```
**Eigene Variable statt `--border-light` anheben** — sonst verlieren die dezenten Trennlinien im
Rest der Oberfläche ihre Wirkung. Aufwand: ~10 Min.

**✅ A4 — Kein Skip-Link** · WCAG 2.4.1 (Level A) · `app.html` + 3 Sub-Apps

> Erledigt: [`app.html:46`](../app.html), Styling in [`css/style.css:1122`](../css/style.css),
> Landing separat in [`css/landing.css:3`](../css/landing.css).

Tastaturnutzer tabben bei jedem Seitenwechsel durch die komplette Sidebar.
```html
<!-- direkt nach <body>, per CSS bis :focus versteckt -->
<a href="#mainContent" class="skip-link">Zum Inhalt springen</a>
```
Aufwand: ~10 Min.

**✅ A5 — Landmarks nicht benannt** · WCAG 1.3.1 · `app.html`

> Erledigt: [`app.html:51`](../app.html) und [`app.html:95`](../app.html).

Es gibt **zwei** `<nav>` (Topnav mit den App-Tabs, Sidebar mit den Modulen), beide ohne
`aria-label`. Für Screenreader-Nutzer ist die Unterscheidung relevant.
```html
<nav class="topnav" aria-label="Anwendungen">
<nav class="sidebar-nav" aria-label="Module">
```
Aufwand: ~5 Min.

### 1.2 PWA — ✅ erledigt (`6103208`)

**✅ V2** · `app.html`, `lager/index.html`, `rechnungen/index.html`, `eigenbelege/index.html`

> Erledigt, zusätzlich auch in `index.html`. Alle fünf Seiten tragen den Link.

`manifest.json` und `icon-stackr.svg` **sind bereits angelegt und validiert** (Pflichtfelder
vollständig, `standalone`, drei Shortcuts, Icon in der maskable-Safe-Zone). Es fehlt nur:
```html
<link rel="manifest" href="/manifest.json">
```
Damit lässt sich Stackr auf dem Homescreen ablegen und startet ohne Browser-Leiste. Das ersetzt
keine native App, schließt aber die auffälligste Lücke gegen sevDesk („beste App im Test").
Aufwand: ~5 Min.

### 1.3 Theme-Umschalter sichtbar machen

**V1** · `app.html:65`, `css/style.css:723`, **`js/dashboard.js:454`**

Der Umschalter existiert, ist aber `display:none` — Kommentar: „using system
prefers-color-scheme". Wer sein System hell fährt (im Büro die Regel), sieht die dunkle Marke
nie. Vorschlag: drei Zustände *System · Hell · Dunkel*, Wahl in localStorage, als `data-theme`
am `<html>`.

> **Falle:** `js/dashboard.js:454` liest heute ausschließlich
> `window.matchMedia('(prefers-color-scheme: dark)')`. Wird der Umschalter sichtbar, **muss diese
> Stelle die manuelle Wahl mitlesen** — sonst bleiben die Charts im falschen Theme.

Die Light-Tokens existieren bereits vollständig; sie müssen nur zusätzlich unter
`[data-theme="light"]` erreichbar sein. Aufwand: ~1 h.

### 1.4 Performance — der letzte große Posten

**✅ F2 — `xlsx.full.min.js` lazy laden** · `app.html`, `lager/index.html`, Aufrufstellen in
`js/app.js`, `js/buchungen.js`, `js/lager.js`, `lager/page.js`

> Erledigt, gebaut als **`Utils.ensureXlsx()`** in [`js/utils.js`](../js/utils.js) (nicht als
> lokales `_ensureXlsx()` wie unten skizziert — eine gemeinsame Stelle für alle vier
> Aufrufer). Der SheetJS-Hinweis darunter bleibt gültig.

**929 KB — die größte Datei des Projekts** — lädt bei jedem App-Start, gebraucht wird sie nur
beim Excel-Import. `defer` ist inzwischen gesetzt (blockiert also nicht mehr das Rendering),
**geladen wird sie aber weiterhin immer**. Muster steht mit `_ensureApexCharts()` in
`js/dashboard.js:11` bereit:

```javascript
function _ensureXlsx() {
    if (typeof XLSX !== 'undefined') return Promise.resolve();
    return new Promise((resolve, reject) => {
        var s = document.createElement('script');
        s.src = 'js/vendor/xlsx.full.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
    });
}
```

> **Achtung beim Anfassen:** SheetJS ist **nur über `cdn.sheetjs.com`** beziehbar. Ein
> `npm install xlsx` holt gezielt die verwundbare 0.18.5 zurück (CVE-2023-30533,
> CVE-2024-22363). Aktuell liegt 0.20.3 lokal mit SHA-256 in `js/vendor/VERSIONS.md`.

Aufwand: ~1 h. Gewinn: −929 KB Parse- und Transferkosten bei jedem Start.

**F6 — Cloud-Sync-Krypto in einen Web Worker** · `js/cloud-sync.js`

Der komplette Blob wird immer übertragen, AES-GCM läuft im Main-Thread. Das ist die einzige
Stelle, die mit dem Produkt aus Änderungshäufigkeit × Gesamtbestand wächst.
**Keinen Delta-Sync bauen** — Begründung in [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md).
Stattdessen Ver-/Entschlüsselung auslagern und sichtbare Rückmeldung geben.

### 1.5 Recht — eine Textaufgabe offen

**✅ L3 — `agb.html` aus der App verlinken** · §312i Abs. 1 Nr. 4 BGB · 4 App-Seiten

> Erledigt (`6103208`): alle vier App-Seiten verlinken die AGB in der Footer-Zeile.

Alle vier App-Seiten verlinken nur Impressum und Datenschutz. Die AGB sind aus der eingeloggten
App **gar nicht erreichbar** — nur über den Umweg der öffentlichen Landingpage. Ergänzen in
derselben Footer-Zeile. Aufwand: ~10 Min.

**L4 — „Cookies" ist die falsche Vokabel** · `js/cookie-banner.js:34`

Der Banner sagt „technisch notwendige **Cookies**", tatsächlich ist es localStorage/IndexedDB.
§25 TDDDG greift für beides gleichermaßen, die Rechtsfolge ändert sich nicht — die Aussage ist
nur ungenau, und `datenschutz.html` beschreibt es korrekt. Ein Satz.
*Der fehlende Ablehnen-Button ist dagegen **korrekt** — siehe Entscheidungen.*

### 1.6 Datenschutz — ✅ alle vier erledigt (Reste aus Audit 14)

**D0 — Vercel Web Analytics** ✅ **erledigt 2026-08-15.** Lud tatsächlich auf **sechs** Seiten,
davon zwei (`lager/index.html`, `landing-v2.html`) ganz **ohne eingebundenen Banner**. Jetzt:
kein statischer Script-Tag mehr, `js/cookie-banner.js` lädt das Skript erst bei Einwilligung
`all`. Banner hat zwei Buttons (*Nur notwendige* / *Statistik erlauben*), Schlüssel auf
`oyi_cookie_consent_v2` gehoben (die alte Frage hat nie nach Reichweitenmessung gefragt).
Widerruf nach Art. 7 Abs. 3 DSGVO über eine Schaltfläche in `cookies.html` — dafür musste dort
`script-src 'none'` → `'self'` (Meta **und** `vercel.json`). `landing-v2.html` bekommt gar kein
Analytics mehr (noindex-Variante). Rechtstexte nachgezogen.

**D1 — Drittanbieter-Ladungen beim App-Start** ✅ **war bereits erledigt.** Alle Bibliotheken
liegen in `js/vendor/`, Fonts self-hosted, kein jsDelivr im Live-HTML. Die jsDelivr-Treffer eines
Nachlaufs stammten aus `.claude/worktrees/…`, nicht aus dem Produktivstand. `datenschutz.html`
nannte jsDelivr aber weiterhin als Empfänger — korrigiert 2026-08-15.

**D3 — Kennung überlebt den Logout** ✅ **dokumentiert 2026-08-15.** `oyi_device_owner_uid` bleibt
bewusst liegen (Gerätesperre). Steht jetzt in `datenschutz.html` und in der Schlüsseltabelle von
`cookies.html`, inkl. Ausweg (*Gerät zurücksetzen* / Websitedaten löschen). Eine Logout-Rückfrage
wäre die Alternative gewesen — bewusst nicht gebaut, sie würde den Schutz aufweichbar machen.

**D4 — `whop_user` speichert die komplette Userinfo-Antwort** ✅ **war bereits erledigt** (`6103208`).
[`js/whop-auth.js:342`](../js/whop-auth.js) persistiert nur noch `{ id, username }` — **strenger als
oben gefordert**, die E-Mail wird bewusst gar nicht mehr gespeichert (Art. 5 Abs. 1 lit. c). Jede
Lesestelle von `user.email` hat einen Fallback auf `username`.

### 1.7 Marketing-Texte

**✅ M1 — E-Rechnung sichtbar machen** · `index.html` · **erledigt 2026-08-15**

Beide Ergänzungen sind drin: die Zeile unter „Ein Preis. Alles drin." als zweite `.section-sub`,
und der FAQ-Eintrag als **tatsächlich Nr. 13** am Ende der `.faq-list`. Das Accordion ist
delegiert an `document` gebunden ([`js/landing.js:403`](../js/landing.js)) — neue Items greifen
ohne Neubindung.

> **Korrektur zur Aufgabe:** Der Lexware-Halbsatz („erst im XL-Tarif für 32,90 €") ist **nicht**
> übernommen worden. Ein konkreter Wettbewerbspreis ohne Beleg und ohne Datum ist §5/§6 UWG —
> und genau das, was M4 unten mit „mit Datum versehen" absichern will. Stattdessen: *„nicht erst
> in einem höheren Tarif"*. Wer den Preis belegen kann, ergänzt ihn zusammen mit M4.

Beide Behauptungen des FAQ-Textes sind im Code belegt: Erzeugung in
[`rechnungen/js/xrechnung.js`](../rechnungen/js/xrechnung.js), Prüfung eingehender Rechnungen in
[`rechnungen/js/erechnung-import.js`](../rechnungen/js/erechnung-import.js).

**M4 — Wettbewerbs-Preisanker** · `index.html`

Der vorhandene Anker („eine Steuerberater-Stunde kostet 150–250 €") ist gut, aber indirekt.
Ergänzen: *sevDesk 9,90 € nur für Rechnungen, 17,90 € für die Buchhaltung · Lexware Office:
E-Rechnung erst ab 32,90 € · **Stackr: 15 €. Alles.*** — mit Datum versehen, Wettbewerbspreise
ändern sich.

**M5 — Zielgruppen-Kicker über der Headline** · `index.html`

Die Headline („Steuern stressen. Stackr beruhigt.") ist stark und bleibt unverändert. Darüber
ein Kicker: *Für Freelancer, GbR und Reseller* — der `<title>` macht es bereits vorbildlich,
die Seite selbst erst weit unten.

**✅ N3 — Jahresabo als Standardauswahl** · `index.html`

Erledigt (`6103208`): [`index.html:562`](../index.html) trägt `billing-btn-active` und
`aria-pressed="true"` auf `#billingYearly`. **Merke:** `landing.js` ruft `setBilling()` beim Laden
nicht auf — der statische Zustand im HTML *ist* der Startzustand, Preis/Beschreibung/CTA-Link
müssen von Hand dazu passen (steht als Kommentar an der Stelle).

**M2 — Sozialbeweis** · `index.html`

Es gibt **keinen**: keine Stimmen, keine Zahlen, keine Siegel. Bei einem unbekannten Anbieter,
dem man die Buchhaltung anvertrauen soll, ist das die stillste Kaufbremse.
Realistisch ohne Kundenzitate: echte Zahlen („28 Module", „über 200 automatisierte Tests").
**Nichts erfinden** — diese Zielgruppe prüft, und §5 UWG.

### 1.8 Kleinkram

| Fund | Ort | Fix |
|---|---|---|
| U7 | app-weit | 24 Leerzustände, nur einer mit CTA. Zusätzlich: „Keine Buchungen **gefunden**" liest sich für Erstnutzer wie eine fehlgeschlagene Suche — bei leerem Bestand „Noch keine Buchungen — [Erste anlegen]" |
| U11 | `js/euer.js:1071` | Nach dem ELSTER-CSV-Export nur ein Toast. Besser ein Modal mit drei Schritten: bei ELSTER anmelden → Anlage EÜR öffnen → Zeilennummern entsprechen dem Formular |
| U8 | `js/app.js:1440` | „Zurück" im Wizard korrigiert den Firmennamen nicht mehr — der `else`-Zweig braucht `CompanyManager.rename()` |
| ~~C3~~ | `css/style.css:2988` | ✅ erledigt in `9f712cf`: `.data-table` ist definiert (nimmt `th{cursor:pointer}` zurück, weil diese Tabellen nicht sortierbar sind) |
| F4 | `app.html` | `preload` ist teilweise da (Fonts); `style.css` und `app.js` fehlen noch |
| F7 | `js/app.js:3013` | `setInterval` (10-Min-Backup) wird nie geräumt. Handle merken |

---

## 2. Braucht dich — keine Session kann das allein

### 2.1 Eine ENV-Variable, die eine Sicherheitslücke offen lässt 🟠

Der Code-Fix zu **R3** ist drin: `api/sync.js`, `api/blob-upload.js` und `api/whop-access.js`
bevorzugen jetzt `SYNC_OWNER_IDS` / `WHOP_OWNER_IDS` (unveränderliche Whop-User-IDs, `user_…`).

**Aber:** Solange diese Variablen in Vercel leer sind, greift der Altweg — der Vergleich gegen
den bei Whop **frei änderbaren Benutzernamen**, mit dem hart kodierten Default
`'secondlifevintage41'`. Wer sich diesen Namen bei Whop gibt, bekommt Owner-Rechte ohne Abo.

→ In Vercel `SYNC_OWNER_IDS` und `WHOP_OWNER_IDS` auf die echte Whop-User-ID setzen, danach die
alten `*_OWNER_USERNAMES` löschen. Reine Konfiguration, kein Code.

### 2.2 Zwei Whop-Mails konfigurieren (N4)

Reine Backend-Konfiguration, kein Code, ~1 h:
- **3 Tage vor der Jahresverlängerung** — 135 € ohne Vorwarnung ist die Buchung, die zu
  Rückfragen führt.
- **7 Tage nach der Kündigung** mit dem Hinweis, dass die Daten erhalten bleiben. Der
  Winback-Screen in der App ist gut gemacht, erreicht aber nur Rückkehrer.

### 2.3 Live-Tests — brauchen echte Logins

Gebaut und committet, aber nie unter echten Bedingungen gelaufen:

- **Cloud-Sync mit zwei echten Profilen** (Mock-Test bestanden, echter E2E-Test offen)
- **StB-Zugang mit zwei Accounts** inkl. Fingerabdruck-Abgleich
- **Make.com-Webhook** — client-seitig gebaut, echter Durchlauf offen
- **Excel-Import mit einer echten Datei** (Buchungen + Lager)
- **Edge-Tastaturtest der Gate-Overlays** — die Logik ist geprüft, die Wahrnehmung nicht
- **Lager-Feature-Batch Punkt 10** — Live-Durchklick

> **Wichtig:** Claude loggt sich **nicht** selbst bei Whop ein. Wenn ein Test einen Login
> braucht, meldest du dich einmal im Browser-Pane an; die Session bleibt danach erhalten. Ein
> Dev-Bypass im Code ist ausdrücklich nicht gewünscht.

### 2.4 Produktentscheidungen, die anstehen

| Frage | Hintergrund |
|---|---|
| **Top-of-Funnel** | Seit Local eingestellt ist, gibt es nur Landing → Checkout **mit Kartenpflicht** — die höchste Hürde im Vergleichsfeld. Empfehlung: **Demo aufwerten** statt Free-Tier bauen. Alternativen: Trial ohne Kartenpflicht, oder Read-only-Tier |
| **Zielgruppen-Schärfung** | Reseller und GbR haben eigene Module, Freelancer nur den Standard. Empfehlung: Reseller + GbR nach vorn, Freelancer ehrlich als drittes Segment |
| **Zeiterfassung für Freelancer?** | Null Treffer im Code. Empfehlung: **nicht bauen** — eigenes Produktfeld, gute Speziallösungen vorhanden; Energie in Reseller/GbR |
| **Preisstaffel?** | Ein Preis für sehr unterschiedliche Intensität. Falls gestaffelt: **nach Firmenanzahl**, nie nach Features (E-Rechnung hinter einen Tarif zu legen ist genau der Lexware-Fehler) |
| **Steuerberater-Modell** | Der StB-Zugang ist gebaut und kostenlos. Eine Kanzlei mit 40 Mandanten wäre ein eigenes Preismodell wert — zusammen mit dem Grant-Deckel (R4) angehen: erst Leck schließen, dann Preis verlangen |
| **OCR** | Die einzige verbliebene Lücke, die weder gesetzlich erzwungen noch architekturbedingt blockiert ist. Spezifikation inkl. CSP-Freigabe liegt vor (`9567630`). Als **Browser-OCR** (Tesseract.js) wäre es eine Aussage, die kein Wettbewerber machen kann |

---

## 3. Wartet auf Dritte

- **Anwalts-Freigabe** — AGB §11 (Empfehlungsprogramm) und die §356a-Trial-Klausel. Der
  AGB-Text weist auf Letzteres **selbst** hin; das ist ehrlich, sollte vor dem Launch aber durch
  die echte Prüfung ersetzt werden. Eine Widerrufsklausel, die nicht trägt, ist bei einem
  Trial-Modell der teuerste Fehler.
- **AV-Verträge nach Art. 28 DSGVO** — Whop ist bekannt offen. **Zusätzlich prüfen: Upstash und
  Vercel**, beide sind in `datenschutz.html` als Auftragsverarbeiter benannt.
- **§25a, ermäßigter Satz von 7 %** — die Marge wird pauschal mit 19 % gerechnet. Bei Kunst,
  Sammlerstücken und Antiquitäten kann nach §25a Abs. 3 UStG i. V. m. Anlage 2 Nr. 49–53 der
  ermäßigte Satz gelten. Der Fehler geht Richtung **Überzahlung**, ist also steuerstrafrechtlich
  ungefährlich. Braucht eine Rechtsrecherche, welche Warenart im Einzelfall wirklich 7 % ist —
  **nicht blind implementieren.**

---

## Reihenfolge, wenn du wenig Zeit hast

| Rang | Aufgabe | Warum | Aufwand |
|---|---|---|---|
| 1 | **2.1 ENV-Variablen in Vercel** | Einzige offene Sicherheitslücke, reine Konfiguration | 10 Min |
| 2 | **L4 „Cookies" → „lokale Speicherung"** | Ein Satz, letzter Rest im Rechtsblock | 5 Min |
| 3 | **F7 `setInterval`-Handle merken** | Echtes Leck, drei Zeilen | 10 Min |
| 4 | **F4 `preload` für `style.css` + `app.js`** | Zwei Zeilen, messbarer LCP-Gewinn | 10 Min |
| 5 | **U8 Wizard-„Zurück" benennt Firma nicht um** | Datenfehler, den der Nutzer sieht | 20 Min |
| 6 | **M5 Zielgruppen-Kicker** | Eine Zeile Copy, `<title>` macht es schon vor | 10 Min |

Rang 2–6 zusammen liegen unter einer Stunde.

**Erledigt und aus dieser Tabelle entfernt (Stand 2026-08-15):** M1, V2, A2, A4, A5, N3, F2, L3,
D0, D1, D3, D4, C3. Der ganze A11y- und PWA-Block ist zu, der Performance-Block bis auf F4/F6/F7.
