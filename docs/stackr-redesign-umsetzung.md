# Stackr – lokale Redesign-Umsetzung

Stand: 7. Oktober 2026. Gegen den tatsächlich vorhandenen Code und die unten genannten Prüfungen abgeglichen.

## Einstieg und Arbeitsstand

- Landingpage: http://127.0.0.1:4361/
- Nur-Lese-Designprüfung der App: http://127.0.0.1:4361/output/redesign/ansichten.html
- Tatsächlicher App-Einstieg mit unverändertem Whop-Gate: http://127.0.0.1:4361/app.html
- Isolierter Checkout: `C:\Users\secon\.codex\worktrees\stackr-redesign\Web 1.7`
- Start: `node scripts/csp-preview-server.js 4361` aus diesem Checkout. Der Server bindet ausschließlich an 127.0.0.1, verwendet die bestehenden routenspezifischen CSP-Header und sendet `Cache-Control: no-store`.

Das Originalverzeichnis wurde nicht bearbeitet. Sein zu Beginn vorhandener Dateistand einschließlich uncommitteter Grundlagen wurde unverändert in den separaten Checkout übernommen. `output/redesign/baseline-files.json` hält die SHA-256-Prüfsummen dieses Ausgangsstands fest. Die eigenen Änderungen werden zusätzlich getrennt erfasst. Es gab keinen Commit, Push, Merge oder Deploy.

Die Nur-Lese-Designprüfung enthält statische Abzüge der echten Renderer aus frischen, leeren Browserkontexten. Sie zeigt keine erfundenen Buchungen, enthält keine App-, Store- oder Auth-Ausführung und kann keine Daten speichern. Das Whop-Gate wurde bei der Erzeugung vor und nach jedem Render überprüft und nicht entfernt. Die tatsächlichen Änderungen sind zusätzlich in allen vier App-Einstiegen integriert; die Designprüfung ersetzt keinen Funktionstest mit einem echten Konto.

## Umgesetzte Oberfläche und Abläufe

- Monochromes Design-System mit lokalem Inter, 6-px-Buttons, neutralen Statusflächen, sichtbarem Fokus, zugänglichen Eingabegrenzen und Hell/Dunkel über das vorhandene `Theme`.
- Sechs Hauptbereiche in einer gemeinsamen horizontalen Topbar. Auf schmalen Fenstern öffnet sich das Menü von oben über die volle Breite, mit Fokusbindung und Escape. Alle 29 bisherigen App-Routen sowie Rechnungs-, Eigenbeleg- und Lager-Einstiege bleiben erhalten; hinzu kommt die zentrale Seite „Einstellungen“. Selten genutzte Aufgaben stehen unter „Weitere Aufgaben“.
- Browser-Zurück durchläuft die vorhandenen Entwurfs-Guards. Ein abgebrochener Seitenwechsel verwirft keine Eingaben. Aktive seltene Unteransichten erscheinen als sichtbarer Kontexttab.
- Gemeinsame Buchungsliste aus Einkauf, Einnahme, Ausgabe und Privat. Anzeigeadapter ohne neue Speicherung oder Zusammenführung der Ursprungsdaten; Suche, Filter, 25/50/100 Einträge und Originalzugänge. Rechnungen werden nicht zusätzlich als Einnahmen eingelesen. Erfassung delegiert an vorhandene Formulare einschließlich OCR.
- Übersicht mit drei Kennzahlen, datenbasierten nächsten Aufgaben, letzten Vorgängen und aufklappbaren Zusatzinformationen. Unterschiedliche bestehende Berechnungsgrundlagen sind ausdrücklich benannt. Diagramme besitzen tabellarische Alternativen.
- Rechnungen öffnen eingebettet direkt die vorhandene Dokumentenliste; Kennzahlen bleiben aufklappbar. Pflichtfelder, Zahlungs-, Storno- und Lagerverknüpfungen sind weiterhin Eigentum der vorhandenen Module.
- Zwei Einrichtungsetappen mit vollständigen bisherigen Zusatzfeldern. Branche, Rechtsform und Umsatzsteuerstatus werden nicht still vorausgewählt. Ungeklärter Steuerstatus blockiert den Abschluss; Sync-Wiederherstellung bleibt erreichbar.
- Gemeinsamer nativer Dialograhmen mit den bestehenden Close-/Aufräumpfaden, Beschriftungen und Formularfehlern. Einfache Tabellen werden mobil zu beschrifteten Datensätzen; komplexe Tabellen bleiben in fokussierbaren Scrollbereichen.
- „Jahr wieder öffnen“ wurde aus dem Änderungsprotokoll entfernt. Geschlossene Jahre zeigen einen Hinweis auf nachvollziehbare Korrekturen. `Store.reopenYear` und der Rechenkern wurden nicht im Rahmen dieses UI-Auftrags umgeschrieben.
- Neue Fokus-Landingpage, Consent, Footer und sieben Rechtsseiten. Rechtliche Haupttexte wurden auf Gleichheit geprüft. Unbestätigte Preis-/Testbedingungen werden auf der neuen Landingpage nicht als verifiziert beworben; vorhandene Monats-/Jahresangebote führen zu Whop.

## Rückmeldung umgesetzt: Topbar und zentrale Einstellungen

Die bisherige Seitenleiste ist durch eine kompakte einzeilige Desktop-Topbar ersetzt: Wortmarke, sechs Arbeitsbereiche, Einstellungen/Hilfe sowie Firmenwechsel und Kontozugang. Nur für einen Bereich mit Unteransichten erscheint direkt darunter eine zweite Kontextzeile. Der Hauptinhalt hat keinen seitlichen Navigationsabstand mehr. Die vorhandenen DOM-IDs bleiben als unsichtbare Hooks erhalten. Die Einstellungen und die Übersicht selbst benötigen keine zusätzliche zweite Zeile.

`js/redesign-settings.js` registriert die neue Route `einstellungen`. Die Übersicht öffnet ausschließlich bestehende Dialoge oder vorhandene Unteransichten:

- Firma/Steuern: Firmen- und Bankdaten, Rechtsform, Besteuerung, Gesellschafter, Firmenverwaltung.
- Rechnungen/Belege: Rechnungsangaben, Logo/Farboptionen, Eigenbeleg-Einstellungen und -Kategorien.
- Lager: Kategorien und Artikelstatus über gezielte Links zum bestehenden Standalone-Dialog. Lagerorte bleiben am jeweiligen Artikel.
- Daten: vollständiger Backup-/Wiederherstellungsdialog, Cloud-Sync und Webhooks.
- Darstellung/Konto: bestehende Theme-Quelle, Sprache, Kontomenü einschließlich Mitgliedschaft/Freigaben/Abmeldung, Datenschutz und Rechtstexte.

Rechnungsangaben, Eigenbeleg-Einstellungen/-Kategorien und Gesellschafter-Stammdaten erscheinen unter Einstellungen statt in den operativen Kontextmenüs. Ihre ursprünglichen Routen bleiben gültig. Kunden und Positionsvorlagen bleiben auf ausdrücklichen Nutzerwunsch unter Rechnungen. Firmenwechsel und Kontomenü bleiben zusätzlich als direkte Zugänge im Kopf.

Keine neue Speicherung, Migration, Steuerberechnung oder Netzwerkfunktion. Der Einstellungseinstieg prüft das bestehende Gate; vorhandene Formulare behalten ihre Felder, Validierung und Speicherfunktionen. Die vollständige Funktionsabnahme nach Login ist weiterhin offen. Der zuvor entsprechend der harten Ausgangsvorgabe entfernte UI-Pfad „Jahr wieder öffnen“ bleibt die ausdrücklich dokumentierte Ausnahme; diese Rückmeldungsrunde entfernt keine weiteren Fachfunktionen.

Prüfung dieser Runde: **86/86 Node-Harnesses bestanden**, einschließlich neuer Tests zu Einstellungsdelegation und Gate. Alle 29 alten Routen plus Einstellungen sind dem Router zugeordnet. 240 Renderer-/Theme-/Breitenkombinationen und 300 statische Vorschauprüfungen ohne Überlauf. Die echte Shell wurde zusätzlich isoliert in Chrome bei 360 px auf oberes Menü, Fokusbindung, Escape und Fokusrückgabe geprüft; bei 1024 px volle Inhaltsbreite ohne Seitenleiste oder horizontalen Überlauf. Der frische Server läuft auf Port 4361.

Nutzerrückfragen beantwortet und umgesetzt: einzeilige Desktop-Topbar mit bedarfsabhängiger zweiter Zeile; Kunden und Positionsvorlagen verbleiben unter Rechnungen. Die kompakte Kopfzeile wurde bei 1024 px mit langem Test-Firmennamen und Kontowidget auf eine Gesamthöhe von 64 px und ohne Überlauf geprüft. In Chrome ist Rechnungen mit der zugehörigen zweiten Navigationszeile geöffnet.

## Abdeckungsmatrix

„Gestaltet/angeschlossen“ bedeutet gemeinsame Tokens, neue Navigation und bestehender Renderer/Aktionspfad. „Renderer geprüft“ ist eine Prüfung mit leerem Datenraum hinter dem unveränderten Gate, kein vollständiger Geschäftsablauf. Fachharnesses laufen zusätzlich mit ihren eigenen Testfällen.

| Bereich | Bestehende Dateien | Neues Ziel | Umsetzungsstatus | Prüfung / konkrete Grenze |
|---|---|---|---|---|
| Dashboard | `js/dashboard.js` | Übersicht | Renderer neu strukturiert; 3 KPIs, Aufgaben, Details | Renderer 4 Breiten/2 Themes; vier VM-Datenszenarien mit unveränderten Zahlen/Chartserien |
| Einkauf / Einnahme / Ausgaben / Privat | `js/buchungen.js`, `ausgaben.js`, `privatbuchungen.js` | Buchungen | Neue gemeinsame Anzeige, Originaldaten getrennt; vorhandene Erfassung | Neuer Adapter-Harness: vier Quellen, Vorzeichen, Status, Filter, XSS, keine Rechnungsdopplung, readonly |
| Belege / lokale OCR | `js/beleg-ocr.js`, `beleg-ocr-ui.js`, `ausgaben.js` | Buchungen → Ausgaben und Belege | Bestehender OCR-Workflow neu gestaltet und erreichbar | OCR-, PDF-Text-, USt- und CSP-Harnesses; echter Dateiupload/OCR-Gesamtfluss offen |
| Bankimport / Zahlungsabgleich | `js/bank-import.js` | Buchungen → Weitere Aufgaben | Bestehender Import angeschlossen | Zahlungsabgleich-Harness; Browserimport großer echter Dateien offen |
| Eigenbelege | `eigenbelege/index.html`, `eigenbelege/js/app.js` | Buchungen → Eigenbelege | Eingebettet und eigenständig gemeinsame Shell | Renderer, Unterrouten; vollständiger Beleg-/Backupablauf offen |
| Rechnungen / Angebote / Dokumente | `rechnungen/js/rechnung.js`, `dokumente.js`, `app.js`, `rech-dashboard.js` | Rechnungen | Dokumentenliste als Einstieg, Pflichtfelder/Nummern erhalten | Renderer; Nettoerlös-, Rechnung-/Lager-Leave-Hook-Harnesses |
| E-Rechnung senden / empfangen | `rechnungen/js/xrechnung.js`, `erechnung-import.js` | Rechnungen → Weitere Aufgaben | Vorhandene Erzeugung/Import angeschlossen | XRechnung-/§25a-Harnesses; externer Empfang/Versand nicht ausgelöst |
| Kunden / Positionsvorlagen | `rechnungen/js/kunden.js`, `produkte.js` | Rechnungen → Kunden / Positionsvorlagen | Gemeinsame Kontextnavigation und Komponenten | Modulzugänge erhalten; vollständige CRUD-Abnahme mit Login offen |
| Wiederkehrendes / Mahnungen / Teilzahlungen / Storno | `wiederkehrend.js`, `mahnungen.js`, `rechnung.js`, `js/store.js` | Rechnungen → Weitere Aufgaben / Detail | Bestehende Fachpfade erhalten | Teilzahlungs-/Ist-USt-/Leave-Hook-Harnesses; kompletter Browserzyklus offen |
| Lagerartikel / eigene Nummern / Einkauf / Verkauf | `js/lager.js`, `lager/page.js` | Lager → Artikel | Gemeinsame Shell und Darstellung, Originalaktionen | Artikelnummer-, Dubletten-, Audit-, Lager-Rechnungs-Harnesses |
| Lagerorte / Status / Import / Plattformverkauf | `lager/page.js` | Lager → Importe und Mehrfacherfassung | Zusätzlicher eigenständiger Einstieg erhalten | Renderer/Standalone-Links; Dateiimport + Abbruch im Browser offen |
| Retouren | `js/retouren.js` | Lager → Retouren | Bestehender Ablauf gestaltet/angeschlossen | Retouren-/§25a-Retouren-Harnesses |
| Materiallager | `js/materiallager.js` | Lager → Material | Gestaltet/angeschlossen | Renderer, Materiallager-Harness |
| EÜR / Anlage EÜR | `js/euer.js`, `steuer-berechnung.js` | Steuern → Jahresgewinn | Vorhandene Werte, Zeiträume und Export erhalten | Renderer, Gewinn-eine-Quelle-/EÜR-Nebenmodule-/Steuerberater-EÜR-Harnesses; kein neuer Abgabe-Assistent |
| UStVA / Vorsteuer | `js/ustvoranmeldung.js`, `vorsteuer.js` | Steuern → Umsatzsteuer melden / Weitere Aufgaben | Gestaltet/angeschlossen; Export bleibt Vorbereitung | Ist-UVA-/gemischte-Sätze-/unklare-Vorsteuer-Harnesses |
| OSS / Gewerbe- / Körperschaftsteuer | `js/oss.js`, `gewerbesteuer.js`, `koerperschaftsteuer.js` | Steuern → Weitere Aufgaben | Zugänge auch als Profil-Prüfhinweis erhalten | Renderer und entsprechende Fachharnesses; keine neuen Steuerentscheidungen |
| Lohnsteuer / KSK | `js/lohnsteuer.js`, `ksk.js` | Steuern → Weitere Aufgaben | Gestaltet/angeschlossen | Lohnsteuer-/KSK-/KSA-Jahres-Harnesses |
| Steuertermine | `js/steuertermine.js` | Steuern → Termine | Gestaltet/angeschlossen | Renderer und Termin-Harness |
| Statistiken | `js/statistiken.js` | Auswertungen → Entwicklung | Neutraler Chartadapter + Datentabellen | Renderer, Statistik-Harness; Datensätze der Charts unverändert |
| Bilanz / GuV | `js/bilanz.js` | Auswertungen → Jahresabschluss | Gestaltet/angeschlossen, Profil-Guard erhalten | Renderer, Bilanz-Harness |
| GbR: Gesellschafter, Verrechnung, Gewinn, Auszahlung, Feststellung | `js/gbr.js`, `gbr-modul.js` | Auswertungen → Gesellschaft / Weitere Aufgaben | Alle fünf vorhandenen Unteransichten erreichbar | Renderer, KSt-/GbR- und Rechtsform-Harnesses; kein 50/50-Default ergänzt |
| Steuerberater / DATEV / Exportpaket / Lesezugang | `js/steuerberater.js`, `datev.js`, `stb-share.js` | Auswertungen → Steuerberater | Bestehende Exporte und Freigaben erhalten | DATEV-/Belege-/EÜR-/Readonly-/Store-Guard-Harnesses; reale Freigabe nicht ausgelöst |
| Änderungsprotokolle / Festschreibung | `js/protokoll.js`, Rechnungs-/Lagerprotokolle | Auswertungen → Änderungsprotokoll; Fachprotokolle | Alle Protokolle erhalten; UI-Wiederöffnung entfernt | GoBD-/Audit-/Readonly-Harnesses; neue fachliche Periodenkorrektur nicht implementiert |
| AfA / Kassenbuch / Fahrtenbuch | `js/afa.js`, `kassenbuch.js`, `fahrtenbuch.js` | Buchungen → Weitere Aufgaben | Gestaltet/angeschlossen | Alle Renderer, AfA-/Kassen-/Fahrten-/EÜR-Harnesses |
| Firmen / Profile / Rechnungsangaben | `js/companies.js`, `rechtsform.js`, `rechnungen/js/unternehmensdaten.js` | Firmenwechsel im Kopf; Einstellungen | Vorhandene Speicherbereiche bleiben getrennt | Companies-/Tombstone-/Rechtsform-Harnesses; Live-Firmenwechsel offen |
| Sync / Backup / Wiederherstellung / Webhooks | `js/cloud-sync.js`, `backup-crypto.js`, `webhooks.js`, `app.js` | Einstellungen / Backup und Daten | Bestehende Werkzeuge neu gestaltet | Crypto-/Sync-/Restore-/Key-Harnesses; echter Offlinekonflikt und externer Webhook nicht ausgelöst |
| Darstellung / Konto / Abo / Login | `js/theme.js`, `whop-auth.js`, `user-plan.js` | Kopf / Einstellungen / Zugang | Theme-Quelle und Gate erhalten, Gates neu gestaltet | Whop-/Refresh-/Trial-Harnesses, sichtbarer Login; echter lokaler Login technisch nicht verfügbar |
| Onboarding | `js/app.js` + `js/redesign-onboarding.js` | Zweistufige Einrichtung | Implementiert mit ausdrücklicher Steuerbestätigung | 10 neue Tests + echte isolierte Browser-Komponente 360 hell/1440 dunkel |
| Akademie / Hilfe | `js/akademie.js` | Topbar → Hilfe | Erreichbar, Lernstände nicht gelöscht | Renderer und Navigationsabdeckung |
| Landingpage / Consent | `index.html`, `landing-v2.html`, `js/cookie-banner.js` | Öffentliche Startseite | Neu aufgebaut | 320/360/768/1440; Menü/Focus/Escape/FAQ/Consent/Links/CSP |
| Rechtliche Seiten | Impressum, Datenschutz, AGB, Cookies, Widerruf, Barrierefreiheit, Verfahrensdokumentation | Öffentliche Dokumentseiten | Neue gemeinsame Gestaltung / Inhaltsverzeichnisse | Alle 7 Haupttexte unverändert; Links, H1, Overflow und CSP geprüft |

## Verifikation

- Ausgangsstand: 82/82 bestehende Node-Harnesses grün.
- Nach Redesign: dieselben 82/82 grün. Sechs API-Harnesses benötigten das bereits installierte `@vercel/blob` aus dem Original über `NODE_PATH`; keine neue Installation. Der erste Lauf ohne dieses Paket wurde als Laufzeitproblem erkannt, danach gezielt wiederholt.
- Drei neue Harnesses: `test-redesign-navigation.js`, `test-redesign-bookings.js`, `test-redesign-onboarding.js` grün. Zusammen **85/85 Harnesses bestanden**.
- 29 echte App-Renderer × 320/360/768/1440 px × Hell/Dunkel = 232 Kombinationen ohne Seitenüberlauf im zweiten vollständigen Durchlauf. Ausgangsfehler in acht Bereichen wurden korrigiert. Leere Datenräume, Gate unverändert.
- Öffentliche Startseiten und sieben Rechtsseiten: vier Breiten, keine ungültigen Sprungziele/duplizierten IDs, keine JS-/CSP-Fehler, Menü/FAQ/Consent per Tastatur geprüft.
- Native Dialogkomponente separat geprüft: Öffnen, Fokus, Escape über vorhandenen Close-Pfad, Fokus-Rückgabe. Kalenderfarben, Tabzustände und 16-px-Mobileingaben ebenfalls unabhängig überprüft.
- Navigation: echte `App.navigate`-Funktion im VM-Harness, vollständige Routen, History, abgebrochenes Zurück, Entwurfs-Guards und Standalone-Verweise.
- Dashboard: Vergleich von vier Datenszenarien mit identischen bisherigen Jahres-KPIs und Chartserien; verbleibende Basisdifferenzen explizit benannt.
- Reine Anzeigeadapter schreiben keine Store-Daten. Keine Kundendaten, Produktionse-Mails, Webhooks oder Freigaben wurden zu Testzwecken geändert.
- Nur-Lese-Designprüfung: zusätzlich 174 Kombinationen (29 Ansichten × 360/768/1440 × Hell/Dunkel), ohne Seitenüberlauf, aktive Fachaktionen oder Konsolenfehler. Alle vier echten App-Einstiege laden bei 360 px mit sechs Navigationspunkten, intaktem Whop-Gate und ohne fehlende Ressourcen/JS-Fehler.

## Offene Abnahme und fachliche Grenzen

1. **Whop und lokale API:** OAuth-Redirect ist im bestehenden Code fest auf Produktion gesetzt. Der statische lokale Server führt `/api/whop-*` nicht aus. Deshalb sind echter Login, Abozustände und gesamte Geschäftsabläufe nach Anmeldung nicht lokal abgenommen. Kein Gate-Bypass wurde eingebaut.
2. **Unbekanntes Steuerprofil:** Der vorhandene Kern behandelt fehlenden Umsatzsteuerstatus teilweise wie Kleinunternehmerstatus. Der neue Wizard bietet „Weiß ich noch nicht“, beendet die Einrichtung damit jedoch nicht. Ein fachlich sicherer Entwurfsbetrieb ohne Steuerprofil benötigt eine separate Änderung im Kern. Eingaben bleiben im geöffneten Formular, nicht garantiert über Reload.
3. **Kennzahlenbasis:** Die bisherigen Dashboard-Hauptwerte und der Monatsverlauf unterscheiden sich von EÜR/Jahresvergleich, unter anderem bei Nebenmodulen/AfA. Der Auftrag verändert diese Werte nicht versteckt. Die neue Oberfläche erläutert die Basis; eine vollständige fachliche Vereinheitlichung ist nicht als erledigt markiert.
4. **Abschluss/Korrektur:** Der alte UI-Wiederöffnungsweg ist entfernt. Der Store besitzt intern weiterhin `reopenYear`; eine fachlich geprüfte Korrekturarchitektur und die vorhandene pauschale Formulierung zur nächsten offenen USt-Periode wurden nicht als Designänderung umgeschrieben.
5. **Noch echte End-to-End-Abnahme:** Ausgabe mit Originalbeleg/OCR, Rechnung mit Teil-/Schlusszahlung und Storno, Einkauf/Verkauf/Retoure mit Abbruch, UStVA/EÜR-Abschluss, Steuerberaterpaket/Freigabe, Live-Firmenwechsel, lokaler Speichermangel, Offline-Synckonflikt, Backup-/Restore-Zyklus. Einzelne Regeln sind durch Harnesses abgedeckt; das ersetzt diese Browserabläufe nicht.
6. **Barrierefreiheit:** Fokus, Semantik, Reflow, Kalenderfarben und konkrete Komponenten geprüft. Eine pauschale WCAG-2.1-AA-Zertifizierung oder vollständige Screenreader-Abnahme wird nicht behauptet. Große Datenmengen und alle Spezialdialoge benötigen die verbleibende Abnahme.
7. **Landingangebot:** Whop-Checkoutbedingungen waren live nicht auslesbar. Deshalb sind die neue Landingkommunikation und die bestehende Gatekommunikation vor Veröffentlichung gegen das reale Monats-/Jahresangebot abzugleichen.

## Dateien, Daten und Veröffentlichung

Neue produktive Dateien: `css/redesign.css`, `css/redesign-public.css`, `js/redesign-shell.js`, `js/redesign-ui.js`, `js/redesign-bookings.js`, `js/redesign-onboarding.js`, `js/redesign-charts.js`, `js/redesign-public.js`, `js/redesign-settings.js`.

Bestehende eigene Änderungen: die vier App-HTML-Einstiege, `js/app.js` (drei Shell-Hooks), `js/buchungen.js` (Tabs/Entwurfs-Guard), `js/dashboard.js`, `js/protokoll.js`, `js/topnav.js`, `js/page-shell.js`, `rechnungen/js/rech-dashboard.js`, `index.html`, `landing-v2.html`, sieben Rechtsseiten, `css/legal.css`, `.vercelignore`, `scripts/csp-preview-server.js`. Hinzu kommen die vier Regressionstests und dieser Bericht. Die genaue Liste steht in `output/redesign/own-files.json`.

`output/redesign/stackr-redesign.patch` enthält ausschließlich die 24 eigenen Änderungen an bestehenden Dateien und 14 neuen Quelldateien/Tests/Bericht, verglichen mit dem unveränderten Sitzungs-Ausgangsstand. `git apply --check` gegen das Originalverzeichnis bestanden; der Patch wurde dort nicht angewendet. Lokale Prüfabzüge und kopierte fremde Ausgangsänderungen sind nicht Bestandteil dieses Patches.

Keine Datenmigration, keine geänderten Firmen-Schlüsselräume, keine neue Abhängigkeit, kein Build-Schritt. Bestehende CSP-/Verschlüsselungs-/Zugriffsverträge bleiben erhalten. `output/` und `.playwright-cli/` sind vom Deployment ausgeschlossen.

Sicherer nächster Schritt: eigene Änderungen aus dem isolierten Checkout gegen den dann aktuellen Zielstand übernehmen, die offenen Abläufe in einer autorisierten Umgebung mit echter API/Whop-Anmeldung und entbehrlichen Testdaten abnehmen, Angebot und Korrekturpfade fachlich klären. Erst danach die gemeinsame neue Oberfläche zur Veröffentlichung freigeben. Ein Rollback betrifft zunächst nur die Oberflächendateien; es darf keine älteren Buchungsdaten über neuere schreiben.


## Feinschliff: Zentrierung und Dokumentfilter

Beide Navigationszeilen sind als zusammengehörige Gruppen mittig ausgerichtet. Auf breiten Desktopfenstern steht die Hauptnavigation exakt in der Fenstermitte; Marken- und Kontobereich bleiben seitlich. Die Unterzeile bündelt Tabs und „Weitere Aufgaben“ ebenfalls mittig. Ihr Menü öffnet unter dem zugehörigen Auslöser. Auf kleineren Fenstern bleibt das vorhandene responsive Verhalten erhalten.

Der Rechnungskopf verwendet kompaktere, gleich hohe Aktionen. Die Filter bestehen aus einer ausgerichteten Reihe für Suche, Dokumenttyp und Status sowie Zurücksetzen. Das Suchsymbol erscheint genau einmal im Feld. Datum von/bis und Kunde sind unter „Zeitraum und Kunde“ aufklappbar; aktive Zusatzfilter werden auch eingeklappt gezählt. Alle bisherigen IDs und Filterbedingungen bleiben erhalten. Die Suche reagiert zusätzlich direkt auf Eingaben und auf das Leeren des Suchfelds.

Geprüft: 300 Vorschau-/Theme-/Breitenkombinationen ohne Überlauf oder Konsolenfehler; Zusatzfilter bei 360 px geöffnet und erreichbar; beide Navigationsgruppen am Desktop mit weniger als einem Pixel Abweichung von der Fenstermitte. Isolierter Funktionstest der echten Dokumentfilter: kombinierte Suche/Status/Datum, aktive Zusatzfilter und vollständiges Zurücksetzen bestanden. Bestehender Rechnungs-/Teilzahlungs-Harness weiterhin 7/7 grün. Kein Eingriff in Rechnungsberechnung, Speicherung oder Zugriffskontrolle.


## Header: reduzierte Trennlinien und klare Navigationsebenen

Die vertikalen Trennlinien an Wortmarke und Kontobereich sowie die durchgehende Linie zwischen Hauptnavigation und Unterpunkten entfallen. Ein äußerer unterer Abschluss bleibt bestehen. Die aktive Hauptseite erhält eine auf die Textbreite begrenzte 2-px-Markierung; die Unteransicht eine dezente 1-px-Markierung. Die Navigation bleibt mittig, die Werkzeugbuttons sind gleich groß und besitzen eigene Hover-/Aktivzustände. „Weitere Aufgaben +“ wird als „Mehr“ mit funktionalem Aufklappsymbol dargestellt, der zugängliche Name lautet „Mehr Aufgaben“.

Zusätzlich korrigiert: Die Kopfzeile übernimmt nicht mehr `overflow: hidden` aus dem alten Stylesheet. Das Aufgabenmenü kann damit vollständig über den Hauptinhalt aufklappen und wird nicht am Header abgeschnitten. Die vorhandenen Zugänge und Navigations-Guards bleiben unverändert.

Prüfung: Navigations-Harness grün; 300 bestehende Vorschauprüfungen ohne Überlauf oder Konsolenfehler. Menü in Chrome geöffnet und vollständig sichtbar, anschließend geschlossen; 360-px-Ansicht ohne Seitenüberlauf. Lokale Vorschau auf frischem Port 4361.
