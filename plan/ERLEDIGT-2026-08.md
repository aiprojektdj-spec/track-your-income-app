# Erledigt — August 2026

**Stand: 2026-08-16, abends.** Gegenstück zu [`01-AUFGABEN.md`](01-AUFGABEN.md), die nur noch Offenes
führt. Hier steht, was abgeschlossen ist — **und wo die Umsetzung von der ursprünglichen
Aufgabenbeschreibung abwich.** Genau diese Abweichungen sind der Grund, warum die Datei
existiert: Sie sind beim reinen Abhaken verlorengegangen und wurden zweimal neu entdeckt.

Kein Archiv im Sinne von „kann man wegwerfen" — mehrere Einträge unten enthalten Fallen, die
beim nächsten Anfassen derselben Stelle wieder greifen.

---

## Die vier Korrekturen, die man kennen muss

Die Aufgabenbeschreibung war in diesen Fällen **sachlich falsch**. Wer sie irgendwo abgeschrieben
findet, greift daneben.

| Fund | Was in der Aufgabe stand | Was tatsächlich gilt |
|---|---|---|
| **A2** | `--border-field: #4a5651`, „≈3,0:1" | Der Wert kam auf **2,5:1** und hätte den WCAG-Verstoß **nicht behoben**. Gebaut wurde `#636f68` ([`css/style.css:76`](../css/style.css)), hell `#868173` (`:142`). **Kontraste nachrechnen, bevor ein Hex-Wert in eine Aufgabe kommt.** |
| **F2** | lokales `_ensureXlsx()` je Aufrufer | Gebaut als **`Utils.ensureXlsx()`** in [`js/utils.js`](../js/utils.js) — eine Stelle für alle vier Aufrufer statt vier Kopien |
| **D4** | auf `sub`, `preferred_username`, `email` reduzieren | Gebaut **strenger**: [`js/whop-auth.js:342`](../js/whop-auth.js) persistiert nur `{ id, username }`. Die E-Mail wird bewusst **gar nicht** gespeichert (Art. 5 Abs. 1 lit. c). Jede Lesestelle von `user.email` hat einen Fallback auf `username` |
| **M1** | inkl. „bei Lexware Office erst im XL-Tarif für 32,90 €" | Der Lexware-Halbsatz ist **nicht** übernommen. Konkreter Wettbewerbspreis ohne Beleg und ohne Stichtag ist §5/§6 UWG. Stattdessen: *„nicht erst in einem höheren Tarif"* |

---

## Barrierefreiheit (`6103208`)

- **A2 — Randkontrast der Eingabefelder** · WCAG 1.4.11 AA. Eigene Variable `--border-field`
  statt `--border-light` anzuheben, damit die dezenten Trennlinien im Rest der Oberfläche ihre
  Wirkung behalten. Siehe Korrektur oben.
- **A4 — Skip-Link** · WCAG 2.4.1 A. [`app.html:46`](../app.html), Styling
  [`css/style.css:1122`](../css/style.css); die Landingpage hat einen eigenen in
  [`css/landing.css:3`](../css/landing.css).
- **A5 — Landmarks benannt** · WCAG 1.3.1. [`app.html:51`](../app.html) `aria-label="Anwendungen"`
  (Topnav) und `:95` `aria-label="Module"` (Sidebar).

**Damit ist kein offener WCAG-AA-Verstoß mehr bekannt.**

---

## PWA (`6103208`)

- **V2 — `manifest.json` verlinkt.** `manifest.json` und `icon-stackr.svg` lagen fertig und
  validiert im Repo und waren in **0 von 4** Seiten eingebunden — Musterfall „gebaut, aber nicht
  angeschlossen" ([`03-ARBEITSREGELN.md`](03-ARBEITSREGELN.md), Abschnitt 8). Jetzt in allen
  fünf Seiten inkl. `index.html`.

---

## Theme

- **V1 — Umschalter System / Hell / Dunkel.** Gebaut als [`js/theme.js`](../js/theme.js).

> **Zwei Fallen, die dort als Kommentar stehen und hier wiederholt werden, weil sie beim nächsten
> Anfassen erneut zuschlagen:**
>
> 1. Das Modul **muss synchron im `<head>`** stehen, vor dem ersten Stylesheet-Paint. Als `defer`
>    oder am Body-Ende blitzt beim Laden die dunkle Palette auf.
> 2. Wer die effektive Palette braucht — **Charts!** — nimmt `Theme.isDark()`, **nie**
>    `window.matchMedia('(prefers-color-scheme: dark)')`. matchMedia kennt nur die
>    Systemeinstellung und liegt falsch, sobald jemand manuell umgeschaltet hat.
>    [`js/dashboard.js:501`](../js/dashboard.js) und `:654` machen es richtig, mit matchMedia nur
>    als Fallback. Bei Wechsel feuert auf `window` das Event `themechange`.
>
> Vertrag mit der CSS: `js/theme.js` setzt **immer** ein explizites `data-theme="light"` oder
> `"dark"` auf `<html>`. Deshalb braucht `css/style.css` nur **einen** hellen Token-Block
> (`:root[data-theme="light"]`) und keine zweite Kopie in einer `@media`-Abfrage.

---

## Performance

- **F2 — `xlsx.full.min.js` lazy.** 929 KB, die größte Datei des Projekts, lud bei jedem
  App-Start und wird nur beim Excel-Import gebraucht. Jetzt `Utils.ensureXlsx()`.
- **F4 — `preload`** für `css/style.css` und `js/app.js` ([`app.html:19`](../app.html)).
- **F7 — `setInterval`-Leck.** Das 10-Minuten-Backup wurde nie geräumt.
  [`js/app.js:3137`](../js/app.js) merkt das Handle in `_periodicBackupTimer` und ruft
  `clearInterval` vor dem Neusetzen.

> **SheetJS-Falle bleibt gültig:** SheetJS ist **nur über `cdn.sheetjs.com`** beziehbar. Ein
> `npm install xlsx` holt gezielt die verwundbare **0.18.5** zurück (CVE-2023-30533 Prototype
> Pollution, CVE-2024-22363 ReDoS) — das npm-Paket ist dort eingefroren und unmaintained.
> Aktuell liegt **0.20.3** in `js/vendor/` mit SHA-256 in `js/vendor/VERSIONS.md`.

Offen aus diesem Block: nur noch **F6** (Krypto-Worker), siehe [`01-AUFGABEN.md`](01-AUFGABEN.md).

---

## Recht

- **L3 — `agb.html` aus der App verlinkt** · §312i Abs. 1 Nr. 4 BGB (`6103208`). Die AGB waren
  aus der eingeloggten App gar nicht erreichbar, nur über den Umweg der Landingpage. Jetzt in
  der Footer-Zeile aller vier App-Seiten.
- **L4 — „Cookies" war die falsche Vokabel.** Der Banner sagt jetzt „technisch notwendige Daten
  lokal in deinem Browser (localStorage/IndexedDB)"
  ([`js/cookie-banner.js:56`](../js/cookie-banner.js)). §25 TDDDG greift für beides gleichermaßen,
  die Rechtsfolge änderte sich nicht — die Aussage war nur ungenau.
  *Der fehlende Ablehnen-Button ist dagegen **korrekt** — siehe [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md).*

---

## Datenschutz — Audit 14 komplett (`bc057a6`, `c41603f`)

- **D0 — Vercel Web Analytics.** Lud tatsächlich auf **sechs** Seiten, davon zwei
  (`lager/index.html`, `landing-v2.html`) ganz **ohne eingebundenen Banner**. Jetzt kein
  statischer Script-Tag mehr; `js/cookie-banner.js` lädt das Skript erst bei Einwilligung `all`.
  Banner mit zwei Buttons (*Nur notwendige* / *Statistik erlauben*), Schlüssel auf
  `oyi_cookie_consent_v2` gehoben, weil die alte Frage nie nach Reichweitenmessung gefragt hatte.
  Widerruf nach Art. 7 Abs. 3 DSGVO über eine Schaltfläche in `cookies.html` — dafür musste dort
  `script-src 'none'` → `'self'` (Meta **und** `vercel.json`). `landing-v2.html` bekommt gar kein
  Analytics mehr (noindex-Variante).
- **D1 — Drittanbieter-Ladungen.** Alle Bibliotheken liegen in `js/vendor/`, Fonts self-hosted,
  kein jsDelivr im Auslieferungspfad. **Merke:** Die jsDelivr-Treffer eines Nachlaufs stammten
  aus `.claude/worktrees/…`, nicht aus dem Produktivstand — bei Greps über das Repo die
  Worktrees ausschließen, sonst entstehen Geisterfunde.
- **D3 — Kennung überlebt den Logout.** `oyi_device_owner_uid` bleibt **bewusst** liegen: ohne
  diesen Marker sähe nach einem Logout jeder andere Whop-Account im selben Browserprofil sofort
  die vollen Geschäftsdaten des vorherigen Nutzers. Steht jetzt in `datenschutz.html` und in der
  Schlüsseltabelle von `cookies.html`, inkl. Ausweg (*Gerät zurücksetzen* / Websitedaten löschen).
  Eine Logout-Rückfrage wäre die Alternative gewesen — bewusst nicht gebaut, sie würde den Schutz
  aufweichbar machen.
- **D4 — `whop_user` gefiltert.** Siehe Korrektur oben.

---

## Marketing / Monetarisierung

- **M1 — E-Rechnung sichtbar gemacht** · 2026-08-15. Zwei Ergänzungen in `index.html`: die Zeile
  unter „Ein Preis. Alles drin." als zweite `.section-sub`, und der FAQ-Eintrag *„Erfüllt Stackr
  die E-Rechnungspflicht ab 2025?"* als tatsächlich **Nr. 13** am Ende der `.faq-list`.
  Beide Behauptungen sind im Code belegt: Erzeugung in
  [`rechnungen/js/xrechnung.js`](../rechnungen/js/xrechnung.js), Prüfung eingehender Rechnungen in
  [`rechnungen/js/erechnung-import.js`](../rechnungen/js/erechnung-import.js).
  **Zum Lexware-Preis siehe Korrektur oben.**
  ✅ Committet — steht in `HEAD:index.html`.
- **M2 — Sozialbeweis** · 2026-08-16 (`0159d4d`). Block „Nachprüfbar statt behauptet" mit vier
  Punkten, die der Interessent **vor** dem Zahlen selbst prüfen kann: 200+ automatisierte
  Prüfungen, Ende-zu-Ende-Verschlüsselung, beiliegende Verfahrensdokumentation. Keine erfundenen
  Kundenstimmen, keine Siegel.

  > **Falle, die dort als Kommentar steht:** „über 200" ist bewusst gerundet, damit der Satz
  > nicht veraltet — die Zahl wächst nur. Bei Änderungen **neu auszählen, nicht schätzen**
  > (Stand 2026-08-16: 215 `ok(`-Aufrufe in 33 Harnesses). Die **Modulzahl ist absichtlich nicht**
  > als Beleg verwendet, weil sie ungeklärt ist — siehe [`01-AUFGABEN.md`](01-AUFGABEN.md), 2.4.

- **M4 — Wettbewerbs-Preisanker** · 2026-08-16 (`a3b9b6b`). Vergleichstabelle mit Preisen, Belege
  in [`belege-wettbewerbspreise-2026-08-16.md`](belege-wettbewerbspreise-2026-08-16.md).

  > **Zwei Dinge, die den §5/§6-UWG-Fallstrick entschärfen und beim Aktualisieren mitmüssen:**
  > der **Stichtag** („Stand Juni 2026, ohne Gewähr") und der **Netto/Brutto-Hinweis** — die
  > Wettbewerber zeichnen durchgehend netto aus, Stackrs 15,00 € sind brutto (netto 12,61 €).
  > Ohne diesen Zusatz läse sich die Zeile günstiger für uns, als sie ist.

- **M5 — Zielgruppen-Kicker.** [`index.html:75`](../index.html) `.hero-badge`
  „✦ Für Freelancer, GbR-Teams & Reseller" steht über der Headline. Die Headline selbst
  („Steuern stressen. Stackr beruhigt.") blieb unverändert.
- **N3 — Jahresabo als Standardauswahl** (`6103208`). [`index.html:562`](../index.html) trägt
  `billing-btn-active` und `aria-pressed="true"` auf `#billingYearly`.

> **Falle bei N3, steht als Kommentar an der Stelle:** `landing.js` ruft `setBilling()` beim Laden
> **nicht** auf. Der statische Zustand im HTML *ist* der Startzustand — Preis, Beschreibung und
> CTA-Link müssen von Hand dazu passen. Wer den Umschalter anfasst, prüft alle vier.

---

## Oberfläche / Kleinkram

- **U8 — Wizard-„Zurück" benannte die Firma nicht um** (2026-08-11). `settings.firmenname` und
  der CompanyManager-Name liefen dauerhaft auseinander: der Firmenumschalter zeigte den
  Tippfehler, die Rechnung den korrigierten Namen. [`js/app.js:1602`](../js/app.js) ruft jetzt
  `CompanyManager.rename()` und zeichnet den Umschalter neu.
- **U11 — ELSTER-Export.** Nach dem CSV-Export beantwortete ein Toast die nächste Frage nicht.
  [`js/euer.js:1077`](../js/euer.js) zeigt jetzt die dreischrittige Anleitung: bei ELSTER
  anmelden → Anlage EÜR öffnen → Zeilennummern entsprechen dem Formular.
- **C3 — `.data-table`** (`9f712cf`). Die Klasse wurde 15× gesetzt und war nirgends definiert;
  das globale `table{}` fing sie ab. Jetzt definiert in [`css/style.css:2988`](../css/style.css)
  — sie nimmt `th{cursor:pointer}` zurück, weil diese Tabellen nicht sortierbar sind.

- **U7 — Leerzustände** · 2026-08-16 (`20c5d48`, `976a366`), abgeschlossen 2026-08-21 (`947f547`).
  24 Leerzustände, nur einer mit Handlungsaufforderung.

  > **Der eigentliche Fund war nicht „überall einen Button hinsetzen":** Ein **leerer Bestand**
  > ist etwas anderes als ein **leeres Suchergebnis**. Der Erstnutzer liest „Keine … vorhanden"
  > als fehlgeschlagene Suche und sucht den Fehler bei sich. Beide Fälle werden jetzt getrennt
  > angesprochen — u. a. in `js/protokoll.js` und `rechnungen/js/protokoll.js`.
  > [`js/bank-import.js:443`](../js/bank-import.js) sagt weiterhin „Keine Buchungen **gefunden**",
  > und das ist dort **richtig**: es beschreibt tatsächlich ein leeres Filterergebnis.

  > **Nachtrag 2026-08-21 (`947f547`):** Der Block galt seit dem 16.08. als zu, war es aber
  > nicht — im Rechnungsmodul standen `kunden.js`, `produkte.js` und `mahnungen.js` noch auf
  > einem nackten Satz. Gefunden durch Nachzählen im Code (`grep empty-state`), nicht durch
  > die Liste. Bei den Kunden war es sogar der Fehler, den der Fund selbst beschreibt: wer
  > alle Kunden archiviert hatte, bekam „Noch keine Kunden angelegt" zu sehen. Bei den
  > Mahnungen wäre ein CTA falsch gewesen — nichts Überfälliges ist der Wunschzustand, keine
  > offene Aufgabe; unterschieden wird dort nur, ob überhaupt Rechnungen existieren.

**Dieser Block ist jetzt vollständig zu.**

---

## Was diese Runde methodisch gekostet hat

Am 2026-08-15 führte `01-AUFGABEN.md` **acht** Punkte als offen, die längst erledigt waren
(A2, A4, A5, V2, L3, N3, D4, F2). Ursache: Die Liste war aus `restliste-2026-08-14.md`
übernommen worden, **statt gegen den Code geprüft**. Eine Session hat den halben Tag darauf
verwendet, das gegenzuprüfen statt zu bauen.

Am selben Tag wurde eine frisch geschriebene Rang-Tabelle mit sechs „offenen" Punkten binnen
zwei Stunden zu **4/5 falsch** — parallele Sessions hatten L4, F7, F4 und U8 in der Zwischenzeit
gebaut.

Am 2026-08-16 zum dritten Mal: M1, M2, M4 und U7 wurden als offen in `01-AUFGABEN.md`
eingetragen und waren zwei Stunden später alle vier gebaut. **Nach dieser Runde ist Abschnitt 1
bis auf F6 leer** — die Liste hat also nie zu viel Arbeit ausgewiesen, sondern zu alte.

**Konsequenz, jetzt in [`03-ARBEITSREGELN.md`](03-ARBEITSREGELN.md) verankert:** eine
Aufgabenliste, nicht zwei. Abhaken gehört in denselben Commit, der fixt. Und der Stand kommt
**immer** aus dem Code, nie aus einer Plandatei — auch nicht aus dieser.
