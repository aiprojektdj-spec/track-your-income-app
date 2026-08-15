# UX-Journey-Audit — Funde (2026-08-10)

**Session-Prompt:** `plan/session-prompt-audit-02-ux-journey-2026-08-10.md`
**Scope:** Web 1.7 — Landing, Whop-Gate, Onboarding-Wizard, Dashboard, Rechnungen, EÜR-Export, Mobile.
**Methode:** Code-Lesen der Render- und Navigationspfade. Kein Live-Klickpfad (App hinter Whop-Login).

---

## Zusammenfassung

Handwerklich ist die App überdurchschnittlich: **414 Toast-Rückmeldungen**, WCAG-konforme
44-px-Touch-Targets, 13 Media-Queries, horizontal scrollende Tabellen, und Fehlermeldungen, die
den **Rechtsgrund mitliefern** („§14 UStG Pflichtangabe") statt nur „ungültig" zu sagen. Das ist
besser als sevDesk an derselben Stelle.

Die Schwächen liegen alle an einer Stelle: **den ersten 10 Minuten**. Der Nutzer wird durch einen
5-Schritte-Wizard geschleust, landet dann auf einem leeren Dashboard ohne jeden Handlungsvorschlag,
und die wichtigste Aufgabe (Rechnung schreiben) liegt versteckt unter einem Tab namens „Finanzen".
Dazu ein Messaging-Bruch: die Landingpage verkauft 20× „7 Tage kostenlos", das Gate in der App
erwähnt den Trial mit **keinem einzigen Wort**.

| # | Fund | Journey | Schwere |
|---|---|---|---|
| U1 | Gate erwähnt den 7-Tage-Trial nicht — Bruch zur Landingpage | 4 | 🔴 Hoch |
| U2 | Dashboard hat keinen First-Run-Zustand (leer, ohne CTA) | 1 | 🔴 Hoch |
| U3 | Wizard: Schritte 2–5 ohne Überspringen, obwohl alle Felder optional | 1 | 🔴 Hoch |
| U4 | „Rechnung schreiben" liegt zwei Ebenen tief unter „Finanzen" | — | 🟠 Mittel |
| U5 | §14-Pflichtangaben werden erst beim Speichern geprüft, Entwurf ist weg | 2 | 🟠 Mittel |
| U6 | Sub-Apps ohne Ungespeichert-Warnung (Hauptapp hat eine) | 2 | 🟠 Mittel |
| U7 | 24 Leerzustände als nackter Tabellentext, davon 5 mit `empty-state` | alle | 🟠 Mittel |
| U8 | Firmenname-Korrektur über „Zurück" greift nicht mehr | 1 | 🟠 Mittel |
| U9 | URL bleibt beim Navigieren stehen — Zurück-Taste verlässt die App | — | 🟡 Niedrig |
| U10 | `app.html` heißt in jedem Tab nur „Stackr" | — | 🟡 Niedrig |
| U11 | ELSTER-CSV-Export endet ohne „so geht's weiter" | 3 | 🟡 Niedrig |
| U12 | Akademie ist reine Reselling-Schulung, Landing verkauft Freelancer | 1 | 🟡 Niedrig |

---

## Journey 1: Erster App-Start

### Friction Points

⚠️ **U3 — Der Wizard lässt einen nicht durch.**
[js/app.js:1359-1368](../js/app.js#L1359): Ein Überspringen-Link existiert **nur in Schritt 1**
und **nur**, wenn schon eine Firma existiert (`CompanyManager.getActiveId()`) — also ausgerechnet
für den Nutzer, der ihn am wenigsten braucht. Der Erstnutzer muss durch alle 5 Schritte:
Firma → Adresse → Telefon/E-Mail → **Steuernummer/USt-ID/USt-Modus** → **Bank/IBAN/BIC**.

Faktisch sind Schritte 2–5 komplett optional (keine Validierung, [js/app.js:1437-1465](../js/app.js#L1437)),
aber **nichts sagt das dem Nutzer**. Wer abends um 22 Uhr seine Steuernummer nicht griffbereit hat,
bricht hier ab oder trägt Unsinn ein. Zum Vergleich: FastBill fragt beim Start nach drei Feldern.

→ **Empfehlung:** In `_renderOnboarding()` den `skipLink` auf Schritte 2–5 ausweiten, Text
„Später ausfüllen — geht jederzeit in den Einstellungen". Zusätzlich in die `subtitle` der
Schritte 2–5 ein „Alles optional" aufnehmen (i18n-Keys `ob.step2.subtitle` ff.).

⚠️ **U8 — „Zurück" in den ersten Schritt korrigiert den Firmennamen nicht mehr.**
[js/app.js:1440-1449](../js/app.js#L1440) legt die Firma **sofort in Schritt 1** an. Geht der
Nutzer aus Schritt 2 zurück und korrigiert einen Tippfehler im Firmennamen, greift der Zweig
`if (!CompanyManager.getActiveId())` nicht mehr — die Firma behält den alten Namen. Da
`_finishOnboarding()` nur `Store.saveSettings(d)` schreibt
([js/app.js:1469-1476](../js/app.js#L1469)), laufen `settings.firmenname` und der
CompanyManager-Name danach dauerhaft auseinander: der Firmenumschalter zeigt den Tippfehler,
die Rechnung den korrigierten Namen.

→ **Empfehlung:** Im `else`-Zweig von Schritt 1 `CompanyManager.rename(activeId, d.firmenname)`
aufrufen, wenn sich der Name geändert hat.

⚠️ **Nebenbefund:** `_finishOnboarding` schreibt `Store.saveSettings(d)` **ohne Merge**, während
`_skipOnboarding` korrekt `Object.assign({}, s, {...})` verwendet
([js/app.js:1418](../js/app.js#L1418) vs. [js/app.js:1471](../js/app.js#L1471)).
`saveSettings` ersetzt das Objekt vollständig ([js/store.js:1317](../js/store.js#L1317)).
Heute schadet das nicht (beim Erstlauf sind die Settings leer), aber sobald der Wizard je
erneut aufgerufen wird, sind alle zwischenzeitlich gesetzten Einstellungen weg. Angleichen,
solange es billig ist.

### Missing UX Elements

❌ **U2 — Es gibt keinen First-Run-Dashboard.** `Dashboard.render()`
([js/dashboard.js:25](../js/dashboard.js#L25)) rechnet bedingungslos KPIs und Charts. Der einzige
Leerhinweis ist `Keine Buchungen in 2026` in einer Tabellenzeile
([js/dashboard.js:132](../js/dashboard.js#L132)). Es gibt **keine einzige** Quick-Action.
Direkt nach 5 Wizard-Schritten sieht der Nutzer also: sechs Kacheln mit 0,00 €, zwei leere
Diagramme, eine leere Tabelle — und muss selbst herausfinden, was er jetzt tun soll.

Das ist der teuerste Fund des Audits: genau hier entscheidet sich, ob der Trial konvertiert.

→ **Empfehlung:** In `render()` ein `if (!purchases.length && !sales.length && !expenses.length &&
!allRechnungen.length)` voranstellen, das statt der Kacheln drei große Karten zeigt:
**„Erste Rechnung schreiben"** → `rechnungen/index.html`, **„Ausgabe erfassen"** →
`app.html?page=ausgaben`, **„Bank-CSV importieren"** → `app.html?page=bank`. Darunter ein
Einzeiler „Sobald die ersten Buchungen da sind, erscheint hier deine Auswertung."

❌ **Kein Produkt-Rundgang.** Weder Tooltip-Tour noch Welcome-Modal. Die „Akademie" ist keine
Tour, sondern eine Lernplattform (siehe U12).

⚠️ **U12 — Akademie startet für alle mit Reselling.**
[js/akademie.js:13-19](../js/akademie.js#L13): Modul 1 heißt „Grundlagen Reselling", Lektion 1
„Was ist Reselling überhaupt?", Modul 2 „Einkauf & Kalkulation". Die Landingpage verkauft aber an
„Freelancer, GbR & Reseller". Ein Grafikdesigner, der auf die Akademie klickt, landet zuerst dort
und schließt daraus, dass die App nicht für ihn ist. → Modulreihenfolge nach `d.branche` sortieren
(steht seit Wizard-Schritt 1 zur Verfügung).

> **Korrektur (nachgetragen im PM-Audit #14, Fund P6):** Ursprünglich stand hier, die Akademie sei
> eine „reine Reselling-Schulung". Das ist **falsch** — nachgezählt sind von 13 Modulen gut die
> Hälfte allgemein (`steuer`, `steuerprofi`, `krankenversicherung`, `afa_recht`, `international`,
> `psychologie`, `mindset`). Der Fund ist enger als beschrieben und betrifft nur die
> **Einstiegsreihenfolge** — dadurch aber auch billiger zu lösen: sortieren statt umbenennen.

### Gut gemacht

✅ Der Sprachwähler vor Schritt 1 ([js/app.js:1188](../js/app.js#L1188)) ist die richtige
Reihenfolge — erst Sprache, dann Inhalte.
✅ Die USt-Modus-Auswahl in Schritt 4 ist als **Kartenvergleich mit je vier Fakten und
§-Angabe** gebaut ([js/app.js:1310-1338](../js/app.js#L1310)), nicht als Dropdown. Für die
folgenreichste Entscheidung des ganzen Setups genau richtig — das macht kein Wettbewerber besser.
✅ `_skipOnboarding` setzt bewusst `ustMode: 'klein'` als sicheren Default und erklärt im
Kommentar, warum ([js/app.js:1414-1417](../js/app.js#L1414)).

---

## Journey 2: Rechnung erstellen & versenden

### Friction Points

⚠️ **U5 — Die §14-Prüfung kommt zu spät und kostet die Eingaben.**
[rechnungen/js/rechnung.js:971-976](../rechnungen/js/rechnung.js#L971) prüft **beim Speichern**:

> „⚠️ Keine Steuernummer / USt-IdNr. hinterlegt — §14 UStG Pflichtangabe.
> Bitte in den Unternehmensdaten ergänzen."

Inhaltlich vorbildlich, im Ablauf schmerzhaft: Der Nutzer hat da bereits Kunde, Datum und alle
Positionen eingegeben. Er muss zu „Unternehmensdaten" wechseln — und es gibt **keine
Entwurfssicherung** (weder `beforeunload` noch Draft-Speicherung, in
`rechnungen/js/rechnung.js` nicht vorhanden). Die Rechnung ist weg.

Verschärfend: Genau dieses Feld war im Wizard Schritt 4 optional und unmarkiert (U3).
Der wahrscheinlichste Erstnutzer läuft also garantiert hinein.

→ **Empfehlung:** Zwei Zeilen, großer Effekt — beim **Öffnen** des Rechnungsformulars prüfen und
ein Banner über dem Formular zeigen („Vor der ersten Rechnung fehlt noch deine Steuernummer →
[Jetzt ergänzen]"), statt erst beim Speichern zu blocken. Die Prüflogik aus Zeile 975 lässt sich
unverändert wiederverwenden.

⚠️ **U6 — Ungespeichert-Warnung nur in der Hauptapp.**
[js/app.js:1364-1367](../js/app.js#L1364) fragt bei `_formDirty` vor dem Wechsel nach. In den drei
Sub-Apps (`rechnungen/`, `eigenbelege/`, `lager/`) gibt es **keinerlei** Entsprechung — Suche nach
`_formDirty`/`beforeunload` liefert dort null Treffer. Ausgerechnet dort liegt das längste Formular
der ganzen App (Rechnung mit n Positionen). Ein Fehlklick auf die Sub-Nav löscht alles.

→ **Empfehlung:** `_formDirty`-Muster aus `js/app.js` in `rechnungen/js/app.js` spiegeln, mindestens
für das Rechnungsformular.

### Gut gemacht

✅ Kundensuche mit Live-Filter ([rechnungen/js/rechnung.js:134](../rechnungen/js/rechnung.js#L134))
statt endlosem Dropdown.
✅ Die Validierung erklärt den **Grund**, nicht nur den Fehler — Reverse-Charge, 0 %-Positionen
(Kz. 41 vs. Kz. 21), unvollständige Kundenadresse
([rechnungen/js/rechnung.js:1006-1014](../rechnungen/js/rechnung.js#L1006)). Ein Nutzer lernt
hier Steuerrecht nebenbei. Das ist ein echtes Alleinstellungsmerkmal gegenüber lexoffice.
✅ Rechnungen sind der einzige Bereich mit einer echten `empty-state`-CSS-Klasse (4 von 5 Vorkommen).

---

## Journey 3: Steuererklärung vorbereiten (EÜR)

### Gut gemacht

✅ Die Überschrift erklärt die EÜR in einem Satz für Nicht-Buchhalter:
„Deine Steuer-Zusammenfassung für das Finanzamt — als CSV für ELSTER exportieren oder deinem
Steuerberater weitergeben." ([js/euer.js:349](../js/euer.js#L349)) Genau der richtige Ton.
✅ Der ELSTER-Button trägt einen ehrlichen `title`, der die Z64-Sammelzeile erklärt **und** zur
Rücksprache mit dem Steuerberater rät ([js/euer.js:353](../js/euer.js#L353)).
✅ Der Warnbutton „*n* bezahlte Rechnung(en) noch nicht synchronisiert"
([js/euer.js:352](../js/euer.js#L352)) fängt den häufigsten Datenfehler ab, **bevor** exportiert wird.
✅ Leerer Zeitraum wird abgefangen statt eine leere Datei zu erzeugen
([js/euer.js:1021](../js/euer.js#L1021)).

### Friction Points

⚠️ **U11 — Nach dem Export ist Schluss.** Der Toast sagt „ELSTER CSV exportiert"
([js/euer.js:1071](../js/euer.js#L1071)) — und dann? ELSTER importiert keine beliebige CSV in die
Anlage EÜR; der Nutzer muss die Werte übertragen. Ein Nicht-Steuerexperte sitzt hier mit einer
Datei da, die er nicht einordnen kann.

→ **Empfehlung:** Statt des Toasts ein kleines Modal „Datei gespeichert — so geht's weiter":
1. Bei ELSTER anmelden → Anlage EÜR öffnen. 2. Die Zeilennummern der CSV entsprechen den
Zeilennummern des Formulars. 3. Alternativ die Datei dem Steuerberater schicken. Drei Sätze,
und der Export fühlt sich fertig an.

---

## Journey 4: Zugang / Abo (Whop-Gate)

### Friction Points

🔴 **U1 — Das Gate verschweigt den Trial. Wichtigster Fund dieses Audits.**

Die Landingpage nennt „7 Tage kostenlos" **über 20×**, inklusive Badge, CTA-Text
(„Jetzt 7 Tage kostenlos testen →") und Garantie-Leiste
([index.html:552, 564, 579, 589](../index.html#L552)).

In `js/whop-auth.js` kommt der Trial **kein einziges Mal** vor:
- `_showLoginScreen` ([js/whop-auth.js:541-563](../js/whop-auth.js#L541)) zeigt nur
  „Mit Whop anmelden" plus den Kleingedruckt-Link „Stackr Pro kaufen". **Kein Preis, kein
  Nutzenversprechen, kein Trial.**
- `_showNoMembershipScreen` ([js/whop-auth.js:566-624](../js/whop-auth.js#L566)) zeigt zwei
  Preiskarten (135 €/Jahr hervorgehoben, 15 €/Monat) — die Überschrift lautet
  „du hast aktuell kein aktives Abo". Für einen Interessenten, der noch nie gezahlt hat, liest
  sich das wie eine Rechnung, nicht wie ein Angebot.

Dabei ist es **derselbe Whop-Plan**: `plan_iR6YIKLcychSZ` — auf der Landingpage als
„7 Tage kostenlos", im Gate als „15 €/Monat" beschriftet. Es fehlt nur der Text.

Wen das trifft: jeden, der die App direkt öffnet — Lesezeichen, geteilter Link, Wiederkehrer nach
Trial-Ende, jeder Nutzer der kostenlosen Local-Version, der zum Web wechselt.

→ **Empfehlung (klein, hoher Hebel):**
1. Im `_showNoMembershipScreen` beide Preiskarten mit „Erste 7 Tage kostenlos · danach …"
   beschriften und den Badge von „SPAR 45 €" auf „7 Tage gratis · dann spar 45 €" ändern.
2. Die Überschrift von „du hast aktuell kein aktives Abo" auf einen Trial-Einstieg umstellen
   für Nutzer, die nie eine Membership hatten.
3. Im `_showLoginScreen` unter den Login-Button drei Stichpunkte („Alle 12 Module · EÜR &
   DATEV-Export · 7 Tage kostenlos") setzen. Aktuell ist das der **einzige Bildschirm ohne jede
   Verkaufsaussage** — und der, den jeder Wiederkehrer sieht.

### Gut gemacht

✅ Kein manuelles Neuladen nach dem Kauf: `_recheckOnFocus`
([js/whop-auth.js:522-529](../js/whop-auth.js#L522)) erkennt die Zahlung beim Zurückwechseln
zum Tab. Der Hinweistext sagt das dem Nutzer auch vorher
([js/whop-auth.js:584](../js/whop-auth.js#L584)) — nimmt genau die Sorge weg, die an dieser Stelle
entsteht.
✅ Ersparnis wird nicht behauptet, sondern gerechnet (45 € / „3 Monate gratis" / 11,25 €/Monat,
[js/whop-auth.js:570-572](../js/whop-auth.js#L570)).
✅ Kündigung ist ein sichtbarer Menüpunkt „🧾 Abo verwalten / kündigen" und führt direkt zu Whops
Self-Service ([js/whop-auth.js:33, 689](../js/whop-auth.js#L33)) — §312k BGB sauber und ohne
Dark Pattern.
✅ Die Datenangst wird direkt adressiert: „Deine Daten bleiben lokal gespeichert."

---

## Journey 5: Mobile-Nutzung

### Gut gemacht

✅ Sidebar-Toggle vorhanden, mit `aria-expanded` und `aria-controls`
([app.html:202](../app.html#L202)).
✅ Touch-Targets: `min-height/width: 44px` mit ausdrücklichem WCAG-2.5.5-Verweis, gezielt nur im
Mobile-Breakpoint gesetzt, damit Desktop kompakt bleibt
([css/style.css:933-950, 2540-2541](../css/style.css#L933)).
✅ Tabellen scrollen horizontal statt zu brechen (`.table-container { overflow-x: auto }`,
[css/style.css:1142](../css/style.css#L1142)).
✅ 13 Media-Queries — Mobile ist nicht nachträglich drangeklebt.

### Friction Points

⚠️ Keine sichtbare Scroll-Andeutung an breiten Tabellen. Die Rechnungsliste hat 8 Spalten
([rechnungen/js/dokumente.js:114](../rechnungen/js/dokumente.js#L114)); auf dem Handy sieht man
vier und ahnt nicht, dass rechts mehr kommt.
→ Schatten-Gradient am rechten Rand des `.table-container`, sobald `scrollWidth > clientWidth`.
Reines CSS, kein JS nötig.

---

## Querschnitt: Leerzustände, Orientierung, Feedback

### ❌ U7 — 24 Leerzustände, davon 19 als nackter Tabellentext

Gezählt: 24 Stellen mit „Keine … vorhanden/gefunden/erfasst", aber nur **5** verwenden die
`empty-state`-Klasse — und alle fünf liegen im Rechnungsmodul. Der Rest sieht so aus:

```javascript
rows = '<tr><td colspan="6" class="table-empty">Keine Ausgaben vorhanden</td></tr>';   // js/ausgaben.js:117
rows = '<tr><td colspan="8" class="table-empty">Keine Buchungen gefunden</td></tr>';   // js/buchungen.js:974
tbl.innerHTML = '… Keine Eigenbelege gefunden.';                                       // eigenbelege/js/app.js:1110
```

Zwei getrennte Probleme:

1. **Kein Weg nach vorn.** Eine leere Liste ist der Moment, in dem der Nutzer am ehesten eine
   Anleitung braucht — er bekommt eine Sackgasse. Jede dieser Stellen sollte den passenden
   Anlegen-Button enthalten.
2. **„gefunden" ist bei leerem Datenbestand die falsche Vokabel.** `Keine Buchungen gefunden`
   erscheint sowohl beim Erstnutzer mit null Daten als auch bei einem Filter ohne Treffer. Der
   Erstnutzer liest daraus, dass eine Suche fehlgeschlagen ist, und sucht den Fehler bei sich.
   → Bei `allItems.length === 0 && keinFilterAktiv` einen anderen Text ausgeben:
   „Noch keine Buchungen — [Erste Buchung anlegen]".

### 🟠 U4 — Die Kernaufgabe liegt zwei Ebenen tief

Die Topnav hat fünf sichtbare Tabs ([js/topnav.js:48-53](../js/topnav.js#L48)):
Dashboard · **Finanzen** · Lager · Steuer & EÜR · Akademie.

„Rechnungen" ist kein Tab, sondern eine Sub-Nav-Position unter „Finanzen" — der `title` des Tabs
verrät die Überfrachtung: *„Finanzen — Rechnungen, Eigenbelege, Buchungen, Ausgaben, Bank,
Fahrten, AfA"*. Sieben Bereiche hinter einem Label, das keinen davon benennt.

Für die Zielgruppe ist **Rechnung schreiben die Aufgabe Nummer eins** und für viele Freelancer der
einzige Grund, das Tool überhaupt zu öffnen. Bei lexoffice und sevDesk ist „Rechnung schreiben"
die primäre Aktion auf der Startseite; hier sind es zwei Klicks über ein Wort, das eher nach
Auswertung als nach Tagesgeschäft klingt.

→ **Empfehlung (klein):** Einen dauerhaften Primär-Button „+ Rechnung" in die Topnav-Controls
neben den Firmenumschalter — direkter Sprung auf `rechnungen/index.html`. Kostet keinen
Tab-Platz und macht den Weg einstufig.
→ **Empfehlung (größer, zu diskutieren):** „Rechnungen" als eigenen Top-Tab herausziehen und
„Finanzen" auf Buchungen/Ausgaben/Bank/Fahrten/AfA reduzieren. Das ist ein
Informationsarchitektur-Eingriff — nicht nebenbei, aber die Überfrachtung ist real.

### 🟡 U9 — Die URL bleibt beim Navigieren stehen

`App.navigate()` ([js/app.js:1341](../js/app.js#L1341)) setzt `this.currentPage`, rührt die URL
aber nicht an. Eintritts-Deeplinks funktionieren (`?page=` wird beim Start gelesen,
[js/app.js:167,180](../js/app.js#L167)) — die Topnav nutzt das auch
([js/topnav.js:49-52](../js/topnav.js#L49)). Aber sobald man **innerhalb** der App klickt,
läuft die Adressleiste aus dem Takt:

- Die Zurück-Taste verlässt die App, statt eine Ansicht zurückzugehen.
- F5 landet auf der Einstiegsseite, nicht auf der aktuellen.
- „Diese Ansicht teilen/merken" geht nicht.

→ **Empfehlung:** Eine Zeile am Ende von `navigate()`:
`history.replaceState({page}, '', 'app.html?page=' + page);` — damit sind Reload und Teilen
sofort korrekt. `pushState` + `popstate`-Handler wäre die Vollversion (echte Zurück-Taste), ist
aber wegen der Rechtsform-Weiterleitungen in `navigate()` aufwendiger. Der `replaceState`-Einzeiler
holt 80 % des Nutzens.

### 🟡 U10 — Jeder Tab heißt „Stackr"

`app.html` hat `<title>Stackr</title>` und aktualisiert ihn nie — Dashboard, Buchungen, EÜR,
Steuer, Akademie, GbR sehen im Browser-Tab identisch aus. Die drei Sub-Apps machen es richtig
(„Stackr — Lager", „Stackr — Rechnungsbuch", „Stackr — Eigenbelege"). Buchhaltung ist
Mehr-Tab-Arbeit; das fällt täglich auf.
→ In `navigate()` `document.title = 'Stackr — ' + seitenTitel;` setzen. Passt in dieselbe Zeile
wie U9.

### ✅ Feedback-Disziplin

**414 `showToast`-Aufrufe** über alle Module. Es gibt praktisch keine stille Aktion. Dazu
Lade-Overlays im Auth-Flow mit fortschreitendem Text („Verbinde mit Stackr…" →
„Authentifiziere mit Whop…" → „Überprüfe Mitgliedschaft…" → „Lade Stackr…",
[js/whop-auth.js:211, 276, 315, 484](../js/whop-auth.js#L211)) und Lazy-Loading von ApexCharts erst
beim Öffnen des Dashboards ([js/dashboard.js:11](../js/dashboard.js#L11)).

---

## Wettbewerbs-Einordnung

| | Stackr | Marktstandard |
|---|---|---|
| Onboarding | 5 Pflicht-Schritte, kein Skip | lexoffice: geführt, aber jederzeit abbrechbar |
| Leeres Dashboard | keine Handlungsvorschläge | sevDesk: Quick-Action-Kacheln |
| Fehlermeldungen | **§-Begründung inline** | lexoffice/FastBill: generisch |
| USt-Modus-Entscheidung | **Kartenvergleich mit 4 Fakten** | meist ein Dropdown |
| Preis-Transparenz | 1 Preis, kein Tarif-Labyrinth | 3–4 Stufen mit Feature-Gating |
| Deep-Links / Zurück-Taste | nur beim Einstieg | überall Standard |
| Trial-Kommunikation | nur auf der Landingpage | durchgängig bis ins Produkt |

**Fazit:** Stackr ist inhaltlich stärker (Steuerrecht wird erklärt statt versteckt), aber im
Ablauf rauer. Die Substanz ist da — sie wird in den ersten 10 Minuten nur nicht gezeigt.

---

## Empfohlene Reihenfolge

1. **U1** — Trial-Text im Gate. Reine Textänderung in `js/whop-auth.js`, größter Umsatzhebel.
2. **U2** — First-Run-Dashboard mit drei CTAs. Ein `if`-Block in `js/dashboard.js`.
3. **U3** — Überspringen-Link auf Wizard-Schritte 2–5 + „alles optional" in den Untertiteln.
4. **U5 + U6** — §14-Prüfung beim Öffnen statt beim Speichern, plus Dirty-Guard in den Sub-Apps.
   Zusammen erledigen sie den schmerzhaftesten Datenverlust der App.
5. **U9 + U10** — zwei Zeilen in `navigate()` (URL + `document.title`).
6. **U7** — Leerzustände modulweise mit CTA nachrüsten; „gefunden" vs. „noch keine" trennen.
7. **U8** — Firmenname-Rename beim Zurückgehen im Wizard.
8. **U4, U11, U12** — Navigationsstruktur, Export-Nachbereitung, Akademie-Positionierung.
   Größere Diskussionen, nicht nebenbei zu erledigen.
