# Stackr – vollständige Produktdesign-Spezifikation

Stand: 7. Oktober 2026. Grundlage sind die aktuelle Implementierung in `app.html`, die Fachmodule in `js/`, die eingebetteten und eigenständigen Rechnungs-, Lager- und Eigenbelegseiten sowie der freigegebene reduzierte Fokus-Entwurf. Dies ist eine Umsetzungsspezifikation; neue Abläufe sind Zielzustände und noch keine implementierten Funktionen. Der Name bleibt Stackr, die Wortmarke `stackr`, das Rautenlogo bleibt vorläufig.

## 1. Designprinzipien

1. **Orientierung vor Vollständigkeit.** Jeder Screen beantwortet eine Frage und bietet eine dominante Hauptaktion. Drei Kennzahlen und eine priorisierte Aufgabenliste reichen auf der Übersicht.
2. **Ruhe durch Reduktion.** Monochrome Flächen, Inter, großzügige Abstände und flache Buttons mit 6-px-Ecken; keine dekorativen Pfeile, Emojis, Verläufe, Glasflächen, überlagernden Produktfenster oder Kartenraster ohne Aufgabe.
3. **Aufgaben statt Fachmodule.** „Ausgabe erfassen“ und „Jahr vorbereiten“ sind die Einstiege. Fachbegriffe bleiben in Erklärungen, Detailansichten und Exporten erhalten.
4. **Ein Vorgang, eine Eingabe.** Beleg, Buchung, Rechnung, Zahlung und Lagerbewegung werden verknüpft. Ihre unterschiedlichen Zustände bleiben sichtbar; keine doppelte Erlöserfassung.
5. **Vorschläge statt stiller Entscheidungen.** Automatisierung übernimmt belegte Daten, zeigt Herkunft und lässt Unklarheiten offen. Steuerlich relevante Annahmen erfordern Prüfung.
6. **Pflichten bleiben nachvollziehbar.** Keine Entfernung von Pflichtangaben, Originalbelegen, Nummern, Festschreibungen, Storni, Protokollen oder Steuerwerten. Ausblenden entfernt weder Daten noch Hinweise.
7. **Zugänglichkeit gehört zur Gestaltung.** Alle Funktionen funktionieren in Hell/Dunkel, per Tastatur, mit Screenreader und ab 360 px. Das gilt auch für Import, Export, Fehler und Nur-Lese-Zugang.

## 2. Design-System

### Tokens

```css
@font-face {
  font-family: "Inter";
  src: url("../fonts/inter-var-latin.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

:root {
  --font-sans: "Inter", Arial, sans-serif;
  --text-caption: .875rem; /* 14 px bei 16-px-Basis */
  --text-body: 1rem;
  --text-section: 1.25rem;
  --text-title: 2rem;
  --text-kpi: 2.25rem;
  --text-hero: 3rem;
  --weight-regular: 400;
  --weight-heading: 450;
  --weight-medium: 550;
  --line-body: 1.6;
  --line-heading: 1.2;
  --tracking-heading: -.025em;
  --space-1: .25rem;
  --space-2: .5rem;
  --space-3: .75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-24: 6rem;
  --radius-control: 6px;
  --radius-surface: 8px;
  --radius-none: 0;
  --control-height: 48px;
  --target-min: 44px;
  --nav-width: 224px;
  --content-max: 1200px;
  --form-max: 720px;
  --reading-max: 680px;
  --shadow-none: none;
  --duration-fast: 120ms;
  --duration-normal: 160ms;
  --ease: cubic-bezier(.2, 0, .2, 1);
  --focus-width: 2px;
  --focus-offset: 3px;
  --z-header: 20;
  --z-drawer: 40;
  --z-dialog: 60;
  --z-toast: 80;
}

:root[data-theme="light"] {
  color-scheme: light;
  --bg: #FAFAFA;
  --surface: #FFFFFF;
  --surface-muted: #F0F0F0;
  --text: #171717;
  --text-muted: #595959;
  --border-subtle: #DEDEDE; /* nur dekorative Trennung */
  --border-control: #808080;
  --hover: #E8E8E8;
  --primary-bg: #171717;
  --primary-text: #FAFAFA;
  --primary-hover: #303030;
  --focus: #171717;
  --status-bg: #F0F0F0;
  --status-text: #303030;
  --status-border: #808080;
  --overlay: rgb(0 0 0 / 40%);
  --shadow-overlay: 0 8px 24px rgb(0 0 0 / 12%);
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #111111;
  --surface: #171717;
  --surface-muted: #242424;
  --text: #EEEEEE;
  --text-muted: #ADADAD;
  --border-subtle: #333333;
  --border-control: #808080;
  --hover: #303030;
  --primary-bg: #EEEEEE;
  --primary-text: #171717;
  --primary-hover: #FFFFFF;
  --focus: #EEEEEE;
  --status-bg: #242424;
  --status-text: #EEEEEE;
  --status-border: #808080;
  --overlay: rgb(0 0 0 / 65%);
  --shadow-overlay: 0 8px 24px rgb(0 0 0 / 30%);
}

body { font: var(--text-body)/var(--line-body) var(--font-sans); }
.amount { font-variant-numeric: tabular-nums; }
:focus-visible {
  outline: var(--focus-width) solid var(--focus);
  outline-offset: var(--focus-offset);
}
@media (max-width: 767px) {
  :root { --text-title: 1.75rem; --text-kpi: 2rem; --text-hero: 2.25rem; }
}
@media (prefers-reduced-motion: reduce) {
  :root { --duration-fast: 0ms; --duration-normal: 0ms; }
  html { scroll-behavior: auto; }
}
```

`Theme` setzt vor dem ersten Paint wie bereits vorhanden `data-theme="light|dark"`; die gespeicherte Wahl lautet System/Hell/Dunkel. Keine zweite konkurrierende Theme-Logik. Diagramme reagieren auf `themechange`. Keine produktiven Farbliterale außerhalb der Token-Datei. Zustände werden monochrom durch Text und Muster unterschieden; „Fehler“, „Prüfen“, „Erledigt“ besitzen zusätzlich explizite Bezeichnungen.

### Komponenten

| Komponente | Verbindliche Spec |
|---|---|
| Button | 48 px hoch, mindestens 44 × 44 px Zielfläche, 16-px-Text, horizontal 20 px Padding, Radius 6 px, kein Schatten/Pfeil. Primär gefüllt, sekundär Outline, tertiär Text. Hover nur Flächenwechsel. Beim Speichern Text „Wird gespeichert“, `aria-busy`, identische Breite, Schutz gegen Doppel-Submit. |
| Input | Sichtbares 14-px-Label, 8 px Abstand, 48 px hoch, 12 px Innenabstand, 16-px-Schrift, 1-px-Control-Rahmen. Hilfe und Fehler unmittelbar darunter; `aria-describedby`, bei Fehler `aria-invalid`. Pflichtfeld textlich markieren. Beträge akzeptieren deutsches Komma; keine stillen Rundungen oder Änderungen des Vorzeichens. |
| Select | Native Auswahl bis etwa zehn kurze Optionen. Für lange Kunden-/Artikelbestände zugängliche Suchauswahl mit Listbox, Pfeiltasten, Enter/Escape und ausgewiesenem aktivem Eintrag. Keine selbstgebauten Dropdowns ohne vollständige Tastaturbedienung. |
| Tabelle | 14-px-Text, Kopf 48 px, Zeilen mindestens 56 px, horizontal 16 px Padding, keine vertikalen Linien/Zebraflächen. Datum, Beschreibung/Partner, Betrag, Status, Detailaktion. Betrag rechtsbündig. Sortierung mit `aria-sort`; Mehrfachauswahl per Checkbox und separater Auswahlleiste. 25 Zeilen/Seite, wählbar 50/100. |
| Karte/KPI | Kein Schatten. Offene KPI-Zeile mit drei Werten; Flächenkarten nur für Gruppen/Produktbeispiele. Innenabstand 24 px, Radius 8 px. Kennzahl 36 px, Label 14 px, Zeitraum und Berechnungsbasis zugänglich. „Noch keine Daten“ statt suggerierter Null; tatsächliche Null als 0,00 €. |
| Badge/Status | 14-px-Text, 4 × 8 px Padding, Radius 4 px. Text trägt Bedeutung. „Entwurf“, „Ausgestellt“, „Teilbezahlt“, „Bezahlt“, „Überfällig“, „Festgeschrieben“, „Storniert“ nicht zu einem einzigen Status vermischen. Textstatus getrennt nach Dokument, Zahlung und Buchung. |
| Modal | Natives `<dialog>`, maximal 560 px, 24 px Padding; Titel, Inhalt, eine Primäraktion und Abbrechen. Fokus setzen, binden und zurückgeben. Escape schließt; bei ungespeicherten Angaben folgt eine verständliche Rückfrage. Kein Modal im Modal. Lange Formulare als eigene Ansicht. Mobil Dialog mit 16-px-Rand, lange Bearbeitung vollflächig. |
| Toast | Reversible Erfolgsmeldung, maximal zwei Zeilen, etwa sechs Sekunden; zusätzlich in Meldungsverlauf erreichbar, Schließen verfügbar. `role="status"` für Erfolg. Kritische Fehler bleiben inline sichtbar; kein automatisches Verschwinden einer nötigen Entscheidung. Kein Toast-Stapel über Formularaktionen. |
| Tabs | Text plus 2-px-Unterstreichung, mindestens 44 px Höhe. Höchstens drei dauerhaft sichtbare Unteransichten, übrige Aufgaben als Links. `role="tab"` nur für echte Panelwechsel mit Roving-Tabindex; bei Navigation reguläre Links mit `aria-current`. |
| Empty State | Titel „Noch keine …“, ein erklärender Satz, eine Hauptaktion. Ohne Illustration/Emoji, ohne fiktive Beispieldaten in echten Konten. „Keine Treffer“ besitzt stattdessen „Filter zurücksetzen“. |
| Leerzeile | Noch unbearbeitete Rechnungsposition: direkt beschriftete Felder für Beschreibung, Menge und Preis; „Position hinzufügen“ nur einmal am Listenende. Rein leere Zeilen speichern keine fachlichen Datensätze und lösen keine Nummer oder Lagerbewegung aus. Tabellen ohne Daten verwenden den Empty State, keine dekorativen Leerzeilen. |
| Ladezustand | Überschrift und Layout stehen; ruhige Platzhalter ohne Shimmer und ohne fiktive 0-Werte. Nach kurzer Verzögerung „Daten werden geladen“, `aria-busy` am Bereich. Längere Operationen zeigen wirklichen Fortschritt oder Phase, keine erfundene Prozentzahl. |
| Fehlerzustand | Konkrete Ursache, erhaltene Eingaben, Hauptaktion „Erneut versuchen“ oder feldbezogene Korrektur. Nicht gespeichert, lokal gespeichert, nicht synchronisiert unterscheiden. Nicht wiederholbare Aktionen per Vorgangs-ID vor Duplikaten schützen. |
| Nur-Lese-Zustand | Sichtbar „Lesezugang“, Schreiben/Import/Festschreibung nicht anbieten; erlaubte Anzeige und Exporte erhalten. Sperren auch im Daten-/API-Pfad durchsetzen, nicht nur Buttons verstecken. |

### Layout und Barrierefreiheit

Desktop ab 1024 px: 224-px-Navigation, 64-px-Kopfbereich, 32-px-Inhaltsrand, maximal 1200 px Arbeitsfläche. Zwischen 768 und 1023 px öffnet „Menü“ einen Drawer; keine unbeschriftete Icon-Leiste. Unter 768 px: 56-px-Header, 16-px-Rand, einspaltiger Inhalt, ebenfalls Menü-Drawer mit allen sechs Punkten. Drawer besitzt Dialogsemantik, Fokusführung und Schließen. Kein zusätzliches Bottom-Nav-System. Interne Seiten haben links ausgerichtete Titel; die Landingpage bleibt zentriert.

Mobile Datensätze zeigen Beschreibung, Datum/Partner, Betrag und ausgeschriebenen Status. Ein Detailzugang öffnet alle weiteren Felder. Keine doppelte, gleichzeitig vom Screenreader gelesene Desktop-/Mobilansicht. Komplexe Vergleichstabellen dürfen in einem beschrifteten, tastaturbedienbaren Bereich horizontal scrollen; Kernaktionen benötigen das nicht. Formulare haben eine Spalte; Action-Leisten verdecken weder Felder noch Browser-Tastatur oder Fokus. 200 % Textzoom und Reflow bei 320 CSS-px gehören zur Abnahme, zusätzlich zur Bedienbarkeit ab 360 px.

Normale Texte mindestens 4,5:1, große Texte mindestens 3:1; erforderliche Kontrollgrenzen, Chartinformationen und Fokus mindestens 3:1. Subtile Rahmen sind nur dekorativ. Skip-Link, semantische Landmarken, Überschriftenhierarchie, native Labels, Formular-Fehlerübersicht mit Feldlinks, Statusansagen und vollständig tastaturbedienbare Aktionen. Charts erhalten eine zugängliche Datentabelle und unterscheiden Reihen über Linientypen/Labels, nicht Farbe. Fachliche Warnungen nutzen SVG plus „Prüfen“; ⚠️ ist hier die Markierung der Spezifikation, kein Emoji-Icon im Produkt.

## 3. Neue Informationsarchitektur

Sechs Hauptpunkte: **Übersicht · Buchungen · Rechnungen · Lager · Steuern · Auswertungen**. Firmenwechsel steht im Kopf, Einstellungen/Hilfe im Navigationsfuß. Ein aktiver Hauptpunkt, eine Unteransicht, eine sichtbare Seitentitelzeile. Zusätzliche Fachbereiche werden nicht als dritte horizontale Navigation aufgebaut.

| Alter Bereich | Neues Ziel | Behandlung und Begründung |
|---|---|---|
| Dashboard | Übersicht | Zusammengelegt: zentrale Zahlen und nächste Aufgaben ersetzen mehrere Modul-Dashboards. |
| Buchungen/Einnahmen/Ausgaben | Buchungen → Alle | Zusammengelegt: gemeinsamer Datensatzfluss, Typfilter statt separater Pflege. |
| Privatbuchungen | Buchungen → Privat | Unteransicht: private Einlagen/Entnahmen bleiben vom Gewinn getrennt. |
| Bank-Import | Buchungen → Importieren | Aufgabenansicht: Import ist ein Erfassungsweg, kein eigener Arbeitsbereich. |
| Belege/OCR | Buchungen → Belege und Erfassen | Zusammengelegt: Beleg und zugehöriger Vorgang bleiben gemeinsam erreichbar. |
| Eigenbelege | Buchungen → Belege → Eigenbeleg | Unterpunkt: ein gezielter Sonderfall statt eigener Mini-App. |
| Statistiken | Auswertungen → Entwicklung | Unterpunkt: Analyse wird von täglichen Aufgaben getrennt. |
| Bilanz/GuV | Auswertungen → Jahresabschluss | Bei Bedarf: bestätigte Gewinnermittlung und vorhandene Daten entscheiden, nicht allein die Rechtsform. |
| Steuer/EÜR | Steuern → Jahresgewinn | Unterpunkt: verständliche Zusammenfassung mit vollständiger Detailauswertung. |
| Anlage EÜR | Jahresgewinn → Formularwerte | Eingeklappte Zuordnung: sämtliche Werte und Kennzahlen bleiben prüfbar. |
| UStVA | Steuern → Umsatzsteuer melden | Unterpunkt: Abgabevorbereitung wird ein geführter Ablauf. |
| Vorsteuer | Umsatzsteuer melden → Steuer aus Ausgaben | Zusammengelegt: keine zweite unabhängige Steuerberechnung. |
| OSS | Steuern → Weitere Pflichten → EU-Verkäufe | Bei Bedarf: Profil, grenzüberschreitende Vorgänge oder vorhandene Daten lösen Sichtbarkeit aus. |
| Gewerbesteuer | Steuern → Weitere Pflichten | Bei Bedarf: Tätigkeit/Profil und vorhandene Vorgänge bestimmen die Relevanz. |
| Körperschaftsteuer | Steuern → Weitere Pflichten | Bei Bedarf: für entsprechende Unternehmen, historische Daten bleiben erreichbar. |
| Lohnsteuer | Steuern → Weitere Pflichten → Beschäftigte | Bei Bedarf: Beschäftigte oder bestehende Lohndaten aktivieren den Zugang. |
| KSK | Steuern → Weitere Pflichten → Kunst und Publizistik | Bei Bedarf: eigene Versicherung und Abgabe als Auftraggeber sind getrennte Aufgaben. |
| Steuertermine | Steuern → Termine | Unterpunkt: Übersicht zeigt zusätzlich nur die nächsten relevanten Aufgaben. |
| Rechtsform-Rechner | Einstellungen → Firma → Rechtsform vergleichen | Verschoben: Simulation verändert nicht automatisch das echte Firmenprofil. |
| GbR-Gesellschafter | Einstellungen → Firma → Gesellschafter | Stammdaten: Beteiligung und Gültigkeitszeitraum werden einmal gepflegt. |
| GbR-Gewinnverteilung/Verrechnung/Auszahlungen | Auswertungen → GbR | Bei Bedarf: diese Werte erklären den Jahresgewinn je Person. |
| GbR-Feststellung | Steuern → Weitere Pflichten → Gemeinsamen Gewinn erklären | Bei Bedarf: Vorbereitung der Erklärung bleibt von der Auszahlung getrennt. |
| GbR-Gewerbesteuer | Steuern → Gewerbesteuer | Zusammengelegt: dieselbe Quelle und derselbe Zeitraum. |
| Steuerberater/DATEV/Read-only | Auswertungen → Steuerberater | Zusammengelegt: eine Stelle für Datenübergabe und Zugriffsverwaltung. |
| Haupt-/Rechnungs-/Lagerprotokolle | Auswertungen → Änderungsprotokoll | Gemeinsame Ansicht: Originalereignisse werden angezeigt, nicht in ein neues Log umgeschrieben. |
| AfA | Buchungen → Weitere Aufgaben → Anschaffungen | Unterpunkt: Anlage aus einem Einkauf anlegen, Abschreibungsplan separat prüfbar. |
| Kassenbuch | Buchungen → Weitere Aufgaben → Bargeld | Bei Bedarf: bei Bargeldnutzung oder vorhandenen Kassenbewegungen. |
| Fahrtenbuch | Buchungen → Weitere Aufgaben → Fahrten | Bei Bedarf: Fahrten/Fahrzeuge oder bewusste Aktivierung. |
| Retouren | Lager → Rückgaben; Rechnungsdetail | Kontextuell: eine Rückgabe verbindet Bestand, Dokumentkorrektur und Erstattung. |
| Materiallager | Lager → Material | Unterpunkt: Verbrauchsmaterial hat dieselbe Navigation, aber eigene Daten und Bewegungen. |
| Lager/Artikelnummern/Einkauf/Verkauf/Status | Lager → Artikel | Zusammengeführt: Liste und Artikeldetail ersetzen parallele Bestandsübersichten. |
| Lagerorte/Import/Plattformverkäufe | Lager → Weitere Aufgaben | Unterpunkte: erweiterte Werkzeuge bleiben erhalten, ohne die Standardliste zu überladen. |
| Rechnungen/Storno/Mahnungen | Rechnungen → Alle und Detail | Zusammengelegt: Mahnen/Stornieren wird vom ausgewählten Dokument aus gestartet. |
| E-Rechnung-Empfang | Buchungen → Belege → Importieren | Zusammengelegt: Eingangsrechnungen gehören zur Ausgabe; strukturierte Originaldatei erhalten. |
| Kunden/Produkte/Angebote/wiederkehrend | Rechnungen → Weitere Aufgaben | Unterpunkte: Kunden/Positionen auch direkt im Editor nutzbar, keine elf gleichrangigen Tabs. |
| Rechnungs-Unternehmensdaten | Einstellungen → Firma → Rechnungsangaben | Stammdaten: Unterschiede zu existierenden Moduldaten vor Übernahme prüfen, nicht still überschreiben. |
| Akademie | Hilfe → Lernen | Verschoben: kontextuelle kurze Hilfe führt zur vollständigen Lernbibliothek. |
| Mehrere Firmen | Kopfbereich; Einstellungen → Firmen | Werkzeug: aktiver Datenraum bleibt permanent erkennbar. |
| Cloud-Sync | Einstellungen → Daten und Sicherheit | Werkzeug: optionaler Sync und sein Zustand werden zentral gepflegt. |
| Verschlüsseltes Backup | Einstellungen → Daten und Sicherheit | Werkzeug: Backup bleibt vom Sync getrennt. |
| Webhooks/Make.com | Einstellungen → Automatisierungen | Expertenoption: explizite Freigabe von ausgehenden Daten. |
| Theme | Einstellungen → Darstellung | Werkzeug: System/Hell/Dunkel bleibt geräteweit konsistent. |
| Login/Abo | Eigenständiger Zugang; Einstellungen → Konto | Zugang und Vertragsverwaltung werden von Buchhaltungsaufgaben getrennt. |
| Onboarding | Eigenständige Einrichtung | Fünf Seiten werden zu zwei erforderlichen Etappen und späteren Ergänzungen. |
| Landingpage | Öffentliche Startseite | Gleiche Marke, freigegebener Fokus-Aufbau, eigene Marketinghierarchie. |
| Rechtsseiten | Öffentliche Dokumentseiten/Footer | Vollständig erreichbar, Gestaltung erneuern ohne Rechtsinhalte eigenmächtig umzuschreiben. |
| Doppelte Dashboards, dekorative Pfeile, Gamification-Prompts | Entfallen | Gestrichen werden Darstellungsduplikate und Ablenkung; gespeicherter Lernfortschritt bleibt erhalten. |

**Sichtbarkeitsvertrag:** Sichtbar bei bestätigter Relevanz, vorhandenen Daten oder offenen Prüfhinweisen. Auch im ausgeblendeten Zustand über „Weitere Pflichten/Aufgaben“ erreichbar. Unbekannt ist kein Nein. Die App zeigt „Steuerprofil prüfen“, wenn Angaben fehlen; sie bestimmt keine Rechtsform oder Steuerpflicht anhand eines Umsatzwerts allein. Profiländerungen haben einen Gültigkeitsbeginn und ändern keine abgeschlossenen Zeiträume rückwirkend. ⚠️ Kleinunternehmerstatus blendet gewöhnliche Umsatzsteueraufgaben zurück, darf aber besondere Pflichten etwa bei bestimmten Auslandsvorgängen nicht pauschal beseitigen.

Bestehende `?page=`-Links sowie eigene Seiten bleiben als Einstiege erhalten und werden auf die neue Navigation abgebildet. Firma, Filter, Zeitraum, Entwurfszustand und Browser-Zurück bleiben erhalten. Zusammenführung von Ansichten bedeutet keine Zusammenführung von Daten verschiedener Firmen.

## 4. Screen-Specs pro Bereich

Für alle Screens gilt Abschnitt 2. **S** = standardmäßig sichtbar, **D** = aufklappbare Details. Ein angezeigter Fehler/Prüfbedarf bleibt außerhalb eingeklappter Bereiche sichtbar. Bei Modal-Unteraufgaben wechselt die Hauptaktion auf die Aufgabe; es konkurrieren keine zwei gefüllten Buttons. Alle nachfolgenden Layoutfolgen sind von oben nach unten.

### Übersicht

- Zweck: den Geschäftsstand und die nächste nötige Aufgabe in zwei Minuten verstehen. Hauptaktion: **Buchung erfassen**.
- Layout/S: Titel und Zeitraum; offene KPI-Zeile Einnahmen/Ausgaben/Gewinn; maximal drei priorisierte Aufgaben; letzte fünf Vorgänge. Aufgabenreihenfolge: blockierende Fehler, fällige Pflichten, fehlende Belege.
- D: Gewinnentwicklung, Berechnungsbasis, weitere Aufgaben. Gewinn ist weder Kontostand noch verfügbares Geld; Zahlungs-/Gewinnbasis ausdrücklich benennen.
- Empty: „Dein Überblick beginnt mit der ersten Buchung.“ Mobile: KPIs gestapelt, Aufgaben vor Verlauf. Vereinfachung: kein KPI-Dashboard je Modul und kein Steuerformularkatalog.

### Buchungen – Alle

- Zweck: sämtliche betrieblichen Vorgänge finden und bearbeiten. Hauptaktion: **Buchung erfassen**.
- Layout/S: Titel; Suche, Zeitraum und Filter „Alle/Einnahmen/Ausgaben“; Liste Datum, Partner/Beschreibung, Betrag, Beleg-/Prüfstatus; Pagination.
- D: weitere Filter, Kategorie, Steuerdetails, Export, verknüpfte Zahlung/Artikel und Ereignisverlauf im Detail. Festgeschriebenes besitzt „Stornieren“, keine Bearbeiten-/Löschen-Aktion.
- Empty: „Noch keine Buchungen.“ Mobile: beschriftete Datensätze, Filterdialog. Vereinfachung: Ausgaben und Einnahmen verwenden denselben Editor, nicht getrennte Erfassungsmasken.

### Ausgabe/Einnahme erfassen, Belege und OCR

- Zweck: einen belegten Vorgang einmal vollständig erfassen. Hauptaktion: **Buchung speichern**, solange ungeprüft **Entwurf speichern**.
- Layout/S: Beleg hinzufügen oder „Ohne Beleg fortfahren“; Betrag, Partner, Belegdatum, Zahlungsstatus/-datum, Kategorie; kompakte Belegvorschau; Speichern. Pflichtangaben hängen vom Vorgang ab.
- D: Netto-/Steueraufteilung, gemischte Sätze, Teilzahlung, Privatanteil, Lager-/Anlagenbezug und Notiz. Erkannte Unsicherheiten öffnen den betroffenen Bereich sofort.
- Empty: leeres Formular mit Dateiauswahl/Kamera, kein Zwang zum Upload. Mobile: Dokument und Felder nacheinander, nur eine aktive Speichern-Leiste. Vereinfachung: lokale OCR füllt Vorschläge im selben Formular; kein OCR-Fertig-Übernehmen-Weiter-Dialogzyklus. Originaldatei und Quelle erhalten; ⚠️ OCR entscheidet keine Vorsteuerberechtigung.

### Belegübersicht

- Zweck: Originaldateien und fehlende Zuordnungen nachvollziehen. Hauptaktion: **Beleg hinzufügen**.
- Layout/S: „Alle/Zu prüfen/Ohne Zuordnung“; Dateiliste mit Partner, Datum, Betrag, verknüpftem Vorgang; Detailvorschau. D: Dateimetadaten, Originaldownload, OCR-Daten, Eigenbelege.
- Empty: „Noch keine Belege gespeichert.“ Mobile: Dateiliste, Vollansicht nach Öffnen. Vereinfachung: Beleg und Buchung teilen denselben Detailzugang, nicht zwei unabhängige Pflegeprozesse.

### Bank-Import

- Zweck: Zahlungsbewegungen vorhandenen Vorgängen zuordnen oder neu erfassen. Hauptaktion: **Auswahl übernehmen**.
- Layout/S: Datei wählen; erkanntes Konto/Zeitraum; Vorschau mit „Zuordnen/Neu/Privat/Ignorieren“; Anzahl und Betrag der Auswahl; Übernahme. CSV bleibt unterstützt, bestehende CAMT/MT940-Wege bleiben erhalten.
- D: Spaltenzuordnung nur bei unklarer Erkennung; Duplikatbegründung, Gebühren-/Teilzahlungsaufteilung. Empty: „Kontoauszug auswählen.“ Mobile: einzelne Importzeilen mit Aktion und Prüfstatus.
- Vereinfachung: bekannte Bankformate und firmenbezogene Zuordnungsregeln wiederverwenden. ⚠️ Zahlung an bestehender Rechnung erzeugt keine zweite Einnahme; Sammelauszahlungen von Plattformen nicht pauschal als Umsatz buchen.

### Privatbuchungen

- Zweck: private Einlagen, Entnahmen und entsprechende Gesellschafterbewegungen getrennt führen. Hauptaktion: **Privatbuchung erfassen**.
- Layout/S: Zeitraum; Einlagen/Entnahmen als zwei Textsummen; Liste; Editor für Typ, Datum, Betrag und gegebenenfalls Person. D: Konten, Beleg, Notiz.
- Empty: „Noch keine privaten Bewegungen.“ Mobile: eine Spalte. Vereinfachung: derselbe Vorgangseditor mit passender Feldgruppe; ⚠️ Privatbewegungen nicht allein anhand eines Empfängernamens erkennen oder als Gewinnbestandteil darstellen.

### Eigenbeleg

- Zweck: einen Vorgang dokumentieren, wenn kein Originalbeleg erhältlich ist. Hauptaktion: **Eigenbeleg erstellen**.
- Layout/S: Anlass/Begründung, Datum, Verkäufer/Empfänger, Zweck, Betrag; zugehöriger Einkauf/Buchung; Vorschau und Erstellung. D: Warenpositionen, Nachweise, Notiz und vorhandene begründete Sonderfälle.
- Empty: „Wähle zuerst den Vorgang oder erfasse seine Angaben.“ Mobile: einspaltiger Editor und anschließende Vorschau. Vereinfachung: vorhandene Buchungs-/Artikeldaten übernehmen. ⚠️ Kein automatischer Vorsteuerabzug und keine pauschale Anerkennungszusage; vorhandene Ausnahmebehandlung fachlich prüfen.

### Rechnungen – Alle

- Zweck: Ausgangsdokumente und Zahlungseingänge überblicken. Hauptaktion: **Rechnung erstellen**.
- Layout/S: Suche/Zeitraum; Filter „Offen/Alle/Entwürfe“; Zeilen Nummer, Kunde, Datum/Fälligkeit, Betrag, Dokument- und Zahlungsstatus. D: Angebote, Storni, Kunden, Vorlagen, wiederkehrend, Export.
- Empty: „Deine erste Rechnung ist der nächste Schritt.“ Mobile: Datensatz mit Nummer/Kunde/Betrag/Fälligkeit. Vereinfachung: keine zusätzliche Rechnung-Dashboard-Seite; überfällige Dokumente stehen in „Offen“.

### Rechnungseditor

- Zweck: aus wenigen Eingaben eine vollständige Rechnung erstellen. Hauptaktion: **Rechnung prüfen**; im Prüfzustand **Verbindlich erstellen**.
- Layout/S: Kunde; Positionen aus Lager/Vorlage oder frei; Leistungsdatum/-zeitraum; Zahlungsziel; Summen; Prüfschritt mit vollständiger Vorschau und Formatwahl. Firmenpflichtangaben erscheinen aus Stammdaten, fehlende Angaben direkt hier ergänzen.
- D: individuelle Texte, Rabatte, abweichende Adresse und fachliche Sonderfälle. Tatsächlich erforderliche Zusatzfelder werden automatisch sichtbar. Nummer zunächst Vorschau, endgültige Vergabe beim Erstellen.
- Empty: eine leere Positionszeile. Mobile: Positionen als Feldgruppen, Vorschau separat erreichbar. Vereinfachung: kein Wechsel zu Kunden-/Produktmodul nötig. ⚠️ Format, Steuersatz und Pflichttexte richten sich nach bestätigtem Fall; ein PDF ist keine strukturierte E-Rechnung.

### Rechnungsdetail, Zahlungen, Mahnwesen und Storno

- Zweck: den nächsten Schritt für genau eine Rechnung erledigen. Hauptaktion: offen **Zahlung erfassen**, überfällig **Mahnung vorbereiten**, bezahlt **Dokument herunterladen**.
- Layout/S: Dokumentnummer, Kunde, Betrag; Dokument-/Zahlungsstatus; Vorschau; Zahlungen mit Datum/Betrag; nächste Aktion. D: Versand, Mahnverlauf, Teilzahlungen, Zahlungskorrektur, Storno und Protokoll.
- Empty: „Noch keine Zahlungen erfasst“, wenn eine Rechnung existiert. Mobile: Übersicht vor Dokumentvorschau. Vereinfachung: eine Zahlung aktualisiert Rechnung und verknüpften Buchungsfall gemeinsam. Keine Mahnung ohne bewusste Freigabe; kein E-Mail-Versand als verdeckte Nebenwirkung. ⚠️ Ausgestellte Dokumente nicht überschreiben; Korrektur/Storno verknüpfen.

### Kunden, Vorlagen, Angebote und Wiederkehrendes

| Screen | Zweck, Hauptaktion, Layout/S und D | Empty, mobil, Vereinfachung |
|---|---|---|
| Kunden | Wiederverwendbare Empfänger verwalten; **Kunden anlegen**; Suche, Liste, Detail; D: Ansprechpartner/abweichende Anschrift. | „Noch keine Kunden“; mobile Liste; direkt im Rechnungseditor anlegen, Pflichtangaben beim Erstellen prüfen. |
| Positionsvorlagen | Wiederkehrende Leistungen/Produkte vorbereiten; **Vorlage anlegen**; Liste mit Beschreibung/Preis/Steuerfall; D: Einheiten/Notiz. | „Noch keine Vorlagen“; mobile Datensätze; vorhandenen Lagerartikel referenzieren, keinen zweiten Bestand erzeugen. |
| Angebote | Leistungen anbieten; **Angebot erstellen**; Liste und derselbe Editor, deutlich „Angebot“; D: Versionen/Gültigkeit. | „Noch keine Angebote“; mobile Formulargruppen; freigegebenes Angebot in Rechnung übernehmen, ohne vorzeitig zu buchen. |
| Wiederkehrend | Wiederholungen planen; **Wiederholung anlegen**; Empfänger, Positionen, Rhythmus, nächster Termin, aktiv/pausiert; D: Ende und Ausnahmen. | „Noch keine Wiederholungen“; mobile Liste; sichere Voreinstellung erzeugt prüfbare Entwürfe. ⚠️ Bestehende Automatikregeln bei Migration nicht still ändern; automatische Ausstellung separat aktivieren. |

### E-Rechnung empfangen

- Zweck: strukturierte Eingangsrechnungen prüfen und einer Ausgabe zuordnen. Hauptaktion: **Als Ausgabe übernehmen**.
- Layout/S: Datei auswählen; lesbare Darstellung, Format-/Pflichtprüfung, Dublettenprüfung; bestehende Ausgabe verknüpfen oder neuen Entwurf anlegen. D: XML-Felder und technische Prüfergebnisse.
- Empty: „E-Rechnungsdatei auswählen.“ Mobile: Zusammenfassung vor Einzelpositionen. Vereinfachung: gemeinsamer Belegimport. Original-XML erhalten; fehlerhafte Dateien als unprüfbar kennzeichnen, nicht als gültige Rechnung behaupten.

### Lager – Artikel, Einkauf und Verkauf

- Zweck: Bestand und einzelne Warenbewegungen nachvollziehen. Hauptaktion: **Einkauf erfassen**.
- Layout/S: Suche/Statusfilter; Liste Artikelnummer, Bezeichnung, Einkaufspreis, Ort, Bestandsstatus; Artikeldetail mit Bewegungsverlauf. Einkaufseditor: Bezeichnung, Quelle, Preis, Datum, Stückzahl/Einzelartikel und Beleg. Detailaktion **Verkauf erfassen**.
- D: Marke/Größe, Lagerlayout, Plattform, Bilder, Import/Sammelerfassung, Margen- und Steuerdetails. Eigene Artikelnummer sichtbar und editierbar vor erster Verwendung; interne stabile ID unveränderlich.
- Empty: „Erfasse deinen ersten Einkauf.“ Mobile: Artikelkarte und Vollbildeditor. Vereinfachung: Einkauf verknüpft Buchung und Artikel einmalig, Verkauf verbindet Dokument/Zahlung/Bestandsbewegung. Entwurf ändert keinen endgültigen Bestand; Reservierung, Verkauf, Versand und Zahlung bleiben unterscheidbar. ⚠️ Resellerstatus ist keine automatische Berechtigung zur Differenzbesteuerung (§25a).

### Retouren

- Zweck: Rückgabe, Erstattung und Warenzustand zusammen bearbeiten. Hauptaktion: **Rückgabe erfassen**.
- Layout/S: Originalverkauf suchen; Menge, Rückgabedatum, Zustand, Erstattungsbetrag/-status; Vorschau aller Auswirkungen. D: Teilretoure, Gebühren, Notiz und Dokumentkorrektur.
- Empty: „Keine Rückgaben“; mobil einspaltig. Vereinfachung: ein geführter Vorgang, der die verbundenen Veränderungen zusammen bestätigt. ⚠️ Bestand nur bei tatsächlich zurückerhaltener, bewerteter Ware erhöhen; erstattetes Geld und Warenrücklauf sind getrennte Ereignisse.

### Materiallager

- Zweck: Verbrauchsmaterial und dessen Bewegungen verwalten. Hauptaktion: **Materialbewegung erfassen**.
- Layout/S: Suche, Bestand mit Einheit; Zugang/Verbrauch/Korrektur im Editor; Bewegungsverlauf. D: Mindestbestand, Lieferant, Lagerort und Bewertung.
- Empty: „Noch kein Material angelegt“ mit geführtem Einstieg. Mobile: Bestand und Verbrauchsaktion pro Datensatz. Vereinfachung: gleiche Tabellen-/Dialogkomponenten wie Lager, eigener Bestandstyp. ⚠️ Verbrauch darf einen bereits gebuchten Einkauf nicht nochmals als volle Ausgabe erfassen.

### Anschaffungen/Abschreibung (AfA)

- Zweck: länger genutzte Anschaffungen und ihre jährliche Verteilung verwalten. Hauptaktion: **Anschaffung hinzufügen**.
- Layout/S: aktive Anlagen, Anschaffungswert, diesjährige Abschreibung, Restwert; Editor aus vorhandener Ausgabe; Beginn und Nutzungsdauer. D: Methode, Sonderfälle, Privatanteil und vollständiger Plan.
- Empty: „Noch keine Anschaffungen angelegt.“ Mobile: Anlage mit Plan im Detail. Vereinfachung: Kaufdaten übernehmen, EÜR-Zuordnung gemeinsam berechnen. ⚠️ Keine automatische Wahl von Sofortabzug, Nutzungsdauer oder Methode nur anhand des Preises; Bestätigung und jahresabhängige Regeln nötig.

### Kassenbuch

- Zweck: Bargeldbewegungen und Kassenstand nachvollziehen. Hauptaktion: **Barbewegung erfassen**.
- Layout/S: Kasse/Datum, Anfangs-/Endbestand, Tagesbewegungen; Datum, Art, Betrag, Beleg, Beschreibung. D: weitere Kassen, Abstimmung und Export.
- Empty: „Lege zuerst deine Kasse und den Anfangsbestand an.“ Mobile: chronologische Tagesliste. Vereinfachung: „Bar bezahlt“ führt im Vorgang zur verknüpften Kassenbewegung. ⚠️ Tagesführung, negative Bestände und nachträgliche Korrekturen prüfen; keine automatische Rekonstruktion aus Bankdaten.

### Fahrtenbuch

- Zweck: Fahrten mit nötigen Angaben zeitnah dokumentieren. Hauptaktion: **Fahrt erfassen**.
- Layout/S: Fahrzeug, Datum, letzte Fahrt/letzter Kilometerstand, Verlauf; Editor mit Start-/Endkilometer, Ziel und betrieblichem Anlass. D: Kontakte, Streckenvorlagen, Export und Kostenansatz.
- Empty: „Fahrzeug anlegen und erste Fahrt erfassen.“ Mobile: große numerische Felder, gespeicherte Ziele. Vereinfachung: letzter bestätigter Endstand als Vorschlag. ⚠️ Fahrtenprotokoll und steuerlich anerkanntes Fahrtenbuch nicht gleichsetzen; keine fehlenden Fahrten/Anlässe automatisch erfinden.

### Auswertungen/Statistiken

- Zweck: Entwicklung und Ursachen verstehen. Hauptaktion: **Auswertung exportieren**.
- Layout/S: Zeitraum; Gewinnentwicklung als einfacher Linienchart; Kategorieübersicht und zugängliche Datentabelle. D: Vergleiche, Plattformen, Margen, zusätzliche Reihen.
- Empty: „Für diesen Zeitraum fehlen Buchungen.“ Mobile: Diagramm und Tabelle nacheinander. Vereinfachung: eine Standardauswertung statt eines Katalogs von Diagrammtypen, dieselbe fachliche Gewinnquelle wie Dashboard/EÜR.

### Bilanz/Jahresabschluss

- Zweck: vorhandene Jahresabschlusswerte prüfen. Hauptaktion: **Abschluss prüfen**.
- Layout/S: Jahr/Gewinnermittlungsart, Herkunft/Vollständigkeit, Prüfbedarf; Vermögen/Schulden/Eigenkapital und Ergebnis als strukturierte Tabellen. D: Konten, manuelle Ergänzungen und Überleitungen.
- Empty: „Die Abschlussdaten sind noch unvollständig“ mit den fehlenden Voraussetzungen. Mobile: Positionen und Salden einspaltig. Vereinfachung: geführte Prüfungen statt sofort offener Ergänzungsformulare. ⚠️ Aus EÜR-Daten nicht ohne Voraussetzungen eine vollständige steuerliche Bilanz/E-Bilanz versprechen; nicht „abgabefertig“ nennen.

### Steuern – Übersicht

- Zweck: relevante Pflichten und ihren Bearbeitungsstand erkennen. Hauptaktion: **Nächste Aufgabe bearbeiten**; ohne Aufgabe **Steuerprofil prüfen**.
- Layout/S: Jahr/Profilzusammenfassung, nächste Frist, offene Prüfungen, Aufgabenliste Jahresgewinn/Umsatzsteuer/Weitere Pflichten. D: alle verfügbaren Bereiche und bestätigte Profileinstellungen.
- Empty: „Prüfe dein Steuerprofil, damit wir passende Aufgaben zeigen.“ Mobile: vertikale Aufgabenliste. Vereinfachung: keine Formularwand; fehlendes Wissen wird ausdrücklich als unbekannt gespeichert.

### Jahresgewinn und Anlage EÜR

- Zweck: den Jahresgewinn aus vollständigen Daten vorbereiten. Hauptaktion: **Jahr prüfen**.
- Layout/S: Jahr; Einnahmen/Ausgaben/Gewinn; fehlende Belege/Kategorien/Zahlungsdaten; kurze Prüfcheckliste; vorhandene Jahresauswertung. D: alle Formularwerte inklusive Zuordnung, AfA, Privatanteile, Sonderfälle, Exportformate.
- Empty: „Noch keine Daten für dieses Jahr.“ Mobile: Prüfschritte und Summen nacheinander. Vereinfachung: EÜR und Anlage EÜR teilen Berechnung/Prüfung. Export, tatsächlich erklärte Abgabe und Festschreibung sind getrennte Schritte; Festschreibung bleibt bewusst bestätigt. ⚠️ Manuelle Steuerkorrekturen brauchen Grund und nachvollziehbare Herkunft.

### Umsatzsteuer melden (UStVA)

- Zweck: einen Zeitraum prüfen und Meldungswerte vorbereiten. Hauptaktion: **Zeitraum prüfen**.
- Layout/S: bestätigter Zeitraum, Status und Frist; Umsatzsteuer/Vorsteuer/Ergebnis; blockierende Prüfungen; Prüfen → Werte bereitstellen → Abgabe dokumentieren. D: sämtliche Kennzahlen, Herkunft, Sonderfälle und Korrekturhistorie.
- Empty: „Noch keine Vorgänge für diesen Zeitraum“; eine gegebenenfalls erforderliche Nullmeldung bleibt möglich. Mobile: Werte als beschriftete Zeilen. Vereinfachung: Kopierliste trennt echte Formularwerte von Kontrollwerten. ⚠️ Export ist keine Abgabe; keine automatische Erledigung und kein pauschales Verschieben rückwirkender Korrekturen in den nächsten Zeitraum.

### Steuer aus Ausgaben (Vorsteuer)

- Zweck: die Herkunft der abzugsfähigen Steuer nachvollziehen. Hauptaktion: **Offene Fälle prüfen**.
- Layout/S: Gesamtsumme, ungeklärte Fälle, Liste mit Originalrechnung, Steueranteil und Berechtigungsstatus. D: Aufteilung, Ausschlüsse und Sondertatbestände.
- Empty: „Keine offenen Vorsteuerfälle“ oder „Noch keine steuerrelevanten Ausgaben“, je nach Daten. Mobile: Fall und Dokument zusammen. Vereinfachung: Korrektur direkt am verknüpften Vorgang, nicht an einer zweiten Summenliste. ⚠️ OCR-Steuerbetrag ist kein Nachweis einer Abzugsberechtigung.

### Weitere Steuer- und Sozialbereiche

| Bereich | Zweck und eine Hauptaktion | Layout/S; D | Empty; mobil; konkrete Vereinfachung |
|---|---|---|---|
| EU-Verkäufe/OSS | EU-Meldung vorbereiten; **Quartal prüfen**. | Registrierung/Quartal/Status; Länderwerte, ungeklärte Verkäufe; D: Sätze, Einzelfälle, Korrekturen. | „Noch keine relevanten Verkäufe“; Länder als Abschnitte; Herkunft aus Verkäufen übernehmen. ⚠️ OSS nicht aus dem Versandland allein aktivieren und nicht mit UStVA-Abgabe verwechseln. |
| Gewerbesteuer | Gewerblichen Gewinn für weitere Bearbeitung vorbereiten; **Berechnung prüfen**. | Jahr/Tätigkeit, abgeleitete Basis und Herkunft, Hebesatz soweit erforderlich; D: Hinzurechnungen/Kürzungen und Anrechnung. | „Gewinndaten fehlen“; mobile Ergebnis vor Details; Gewinn aus gleicher Quelle übernehmen. ⚠️ Relevanz und Anrechnung nicht pauschal auf jede Rechtsform anwenden. |
| Körperschaftsteuer | Berechnungsgrundlagen entsprechender Firmen prüfen; **Grundlagen prüfen**. | Jahr/Firmenprofil, Gewinnüberleitung und Ergänzungen; D: steuerliche Korrekturen. | „Profil oder Grundlagen fehlen“; mobile Gruppen; dieselben Jahresdaten verwenden. ⚠️ Berechnung ist keine vollständige Erklärung. |
| Lohnsteuer | Vorhandene Beschäftigten-/Personalkostenwerte bearbeiten; **Personaldaten prüfen**. | Zeitraum, vorhandene Beschäftigte, fehlende Angaben, Ergebnis; D: je Person Berechnungsdetails. | „Noch keine Beschäftigten erfasst“; mobile Personenliste; Firmenprofil einmal übernehmen. ⚠️ Schätzung nicht als vollständige Lohnabrechnung oder Anmeldung ausgeben. |
| KSK | Eigene Versicherung und Auftraggeber-Abgabe vorbereiten; **Angaben prüfen**. | Erste Wahl: „Eigene Versicherung“ oder „Aufträge an Kreative“; Jahr, Daten, Ergebnis; D: Beitrags-/Abgabegrundlagen. | „Wähle zunächst deinen Anwendungsfall“; mobile Aufgaben nacheinander; zwei Rollen ausdrücklich trennen. ⚠️ Aus „kreativ tätig“ folgt nicht automatisch Versicherung/Abgabepflicht. |
| Steuertermine | Relevante Fristen mit Abgabe-/Zahlungsstatus verfolgen; **Nächste Frist bearbeiten**. | Chronologische Liste: Pflicht, Termin, Quelle, Status; D: Kalender, eigene Termine und Sonderfristen. | „Keine offenen Termine“; mobile Agenda; Frist führt direkt zum betreffenden Ablauf. ⚠️ Keine Erledigung aufgrund eines Downloads und keine Zusage zur Frist ohne geprüfte Jahres-/Profilregeln. |

### GbR

- Zweck: Gewinnanteile, Verrechnung und tatsächliche Auszahlungen unterscheiden. Hauptaktion: **Gewinnverteilung prüfen**.
- Layout/S: Jahr; Gesamtgewinn; Gesellschafter mit bestätigtem Anteil, zugeordnetem Ergebnis und tatsächlicher Auszahlung; Prüfbedarf. D: Sonderbetriebsvorgänge, Verrechnungskonten, Gültigkeitszeiträume und Feststellungswerte.
- Empty: „Gesellschafter und Beteiligungen ergänzen.“ Mobile: Person als Abschnitt. Vereinfachung: Beteiligungen aus Firmenstammdaten, Einlagen/Entnahmen aus verknüpften Privatbuchungen. Gemeinsame Gewinn-Erklärung als Steueraufgabe mit eigener Prüfung. ⚠️ Kein automatisches 50/50, keine Auszahlung aus bloßem Gewinnanteil und keine still rückwirkende Änderung des Schlüssels.

### Steuerberater

- Zweck: geprüfte Daten gezielt übergeben oder lesend freigeben. Hauptaktion: **Datenübergabe vorbereiten**.
- Layout/S: Firma/Zeitraum; Prüfergebnis; Wahl „Exportpaket“ oder „Lesezugang“; Umfangsvorschau; Erstellung/Freigabe. D: DATEV-Konfiguration, Belegoptionen, Verschlüsselung und aktive Freigaben.
- Empty: „Noch keine Datenübergabe erstellt.“ Mobile: ein geführter Ablauf. Vereinfachung: gemeinsame Stelle für DATEV, vorhandenes verschlüsseltes HTML-Paket und Cloud-Lesezugang. Kein automatischer Versand. Lesezugang prüft Empfänger-/Schlüsselfingerabdruck; Widerruf beendet künftige Abrufe, löscht keine bereits heruntergeladenen Daten.

### Änderungsprotokoll (GoBD)

- Zweck: jede fachliche Änderung mit ursprünglichem Inhalt nachvollziehen. Hauptaktion: **Protokoll exportieren**.
- Layout/S: Suche, Zeitraum/Objektfilter, Ereignisliste mit Zeitpunkt/Objekt/Aktion; D: vorher/nachher, Grund und Storno-/Originalreferenz.
- Empty: „Noch keine protokollierten Änderungen.“ Mobile: Ereignisse mit aufklappbaren Feldern. Vereinfachung: Protokolle gemeinsam durchsuchen, Originalereignisse unverändert erhalten. Keine Bearbeiten-/Löschen-Aktion. ⚠️ Kein „Wieder öffnen“-Weg, der festgeschriebene Originalbuchungen anschließend frei editierbar macht.

### Rechtsform vergleichen

- Zweck: Auswirkungen verschiedener Firmenprofile als Simulation verstehen. Hauptaktion: **Vergleich berechnen**.
- Layout/S: klare Kennzeichnung Simulation; wenige notwendige Annahmen; Ergebnisse nebeneinander, Herkunft/Stand; D: Rechenweg und weitere Annahmen.
- Empty: „Ergänze die benötigten Annahmen.“ Mobile: Ergebnisse untereinander. Vereinfachung: keine Kachelwand für jede Rechtsform. ⚠️ Vergleich verändert keine aktive Rechtsform, keine Steuerprofile und keine historischen Daten; reale Änderung separat mit Gültigkeitsdatum bestätigen.

### Akademie/Hilfe

- Zweck: unmittelbar bei einer Aufgabe helfen. Hauptaktion: **Passende Anleitung öffnen**.
- Layout/S: Suche, Aufgaben wie „Erste Rechnung“, kurze Lernliste und gespeicherter Fortschritt; D: vollständige Bibliothek/Vertiefung.
- Empty: „Keine passende Anleitung gefunden“ mit Suchkorrektur. Mobile: ruhige Leseseite. Vereinfachung: kontextuelle Hilfe am Feld statt ständig sichtbarer Lernkarten, Abzeichen oder Erfolgs-Pop-ups.

### Einstellungen

| Screen | Zweck und eine Hauptaktion | Layout/S; D | Empty; mobil; Vereinfachung |
|---|---|---|---|
| Firmen | Datenräume verwalten; **Firma hinzufügen**. | Aktive Firma und Liste; D: archivierte Firmen/Entfernung. | „Noch keine Firma“ führt in Einrichtung; mobile Liste; Wechsel im Kopf, Kontext überall sichtbar. |
| Firmenprofil | Geschäftliche/steuerliche Stammdaten pflegen; **Änderungen speichern**. | Name/Rechtsform/Tätigkeit, bestätigter Steuerstatus mit Gültigkeit; D: Steuerkennungen, Rechnungsangaben, Bankverbindung/Gesellschafter. | „Angaben ergänzen“; mobile Feldgruppen; Bestand aus Modulen vergleichen, Konflikte ausdrücklich auflösen. |
| Cloud-Sync | Optionalen verschlüsselten Geräteabgleich verwalten; **Sync einrichten**, danach bei Fehler **Synchronisieren**. | Lokal-/Syncstatus, letzter erfolgreicher Abgleich, Geräteverbindung; D: Schlüssel-/Konfliktdetails und Deaktivierung. | „Nur auf diesem Gerät gespeichert“; mobile gleiche Schritte; kein Pflicht-Cloud-Onboarding und keine Verwechslung mit Backup. |
| Backup | Unabhängige Wiederherstellung sichern; **Backup erstellen**. | Letztes externes Backup, Inhalt/Umfang, Verschlüsselung; D: Backupordner, Wiederherstellung und Prüfung. | „Noch kein externes Backup“; mobile Dateidialog; Wiederherstellung erst nach Inhalt/Firma/Schema-Prüfung bestätigen, vorhandene Daten nicht still ersetzen. |
| Webhooks | Daten bewusst an Make.com/andere Empfänger übertragen; **Automatisierung hinzufügen**. | Ereignis, Empfänger, freigegebene Felder, aktiv/inaktiv; D: Test, Fehler/Versandhistorie, Geheimnisverwaltung. | „Keine Automatisierungen aktiv“; mobile Formular; standardmäßig aus. Externe Klartextübertragung und deren Umfang vor Aktivierung erklären. |
| Darstellung | Persönliche Lesbarkeit wählen; **Darstellung wählen**. | System/Hell/Dunkel als native Auswahl, direkte Vorschau/Speicherung; D: keine Farb-/Radius-Konfiguration. | Systemmodus bei fehlender Wahl; mobile identisch; eine Theme-Quelle auf allen Seiten. |
| Konto/Abo | Zugang und Vertragsstatus prüfen; **Abo verwalten**. | Tatsächlicher Tarif/Preis/Verlängerung, Status, Anbieterlink; D: Vertragsdetails und Abmelden. | „Status konnte nicht geladen werden“ statt „kein Abo“; mobile identisch; vorhandene Whop-Verwaltung verlinken, keine zweite Vertragslogik. |

### Onboarding

- Zweck: mit einem sicheren Mindestprofil beginnen. Hauptaktion: **Einrichtung abschließen**, bis zur letzten Etappe **Weiter**.
- Layout/S: Einstieg „Neu beginnen / Aus Backup wiederherstellen / Sync verbinden“; bei Neu zwei Etappen: (1) Firma/Name, Rechtsform und Tätigkeit; (2) bestätigter Steuerstatus oder „Weiß ich noch nicht“ plus kurze Erklärung zur lokalen Speicherung. Zusammenfassung und Start.
- D: Anschrift, Bank, Telefon, Steuerkennungen; zeitnah vor ihrer ersten erforderlichen Verwendung ergänzen. Bei vorhandenen Daten zuerst Wiederherstellungsweg anbieten, nicht neue leere Firma anlegen.
- Empty: erstmalige Einrichtung. Mobile: volle Ansicht, keine fünfseitige Modalfolge. Vereinfachung: keine Pflicht zur Cloud, keine versteckte Vorauswahl „Kleinunternehmer“. ⚠️ Unbekanntes Profil erlaubt Entwürfe; endgültige Rechnung/Steuerauswertung braucht die fallbezogen notwendigen bestätigten Angaben.

### Login-/Abo-Gate

- Zweck: Zugang verständlich herstellen. Hauptaktion: **Mit Whop anmelden**; bei festgestelltem fehlendem Abo **Pro starten**.
- Layout/S: Wortmarke, Zugangssituation, eine Aktion, echte Tarif-/Testbedingungen. D: Hilfe und rechtliche Links. Zustände getrennt: Anmeldung fehlt, Prüfung läuft, Zugriff besteht, Zugriff fehlt, Prüfung fehlgeschlagen.
- Empty: nicht angemeldet. Mobile: lesbare Karte ohne Marketingwand. Vereinfachung: keine wiederholten Upsells innerhalb der Aufgaben. Netzwerkfehler nicht als abgelaufenes Abo behandeln; kein Dev-Bypass. Verfügbarkeit von Datenexport bei Aboende muss ausdrücklich als Produkt-/Zugriffsvertrag festgelegt werden und darf keine Umgehung des vorhandenen Gates sein.

### Landingpage

- Zweck: Produkt verstehen und Test bewusst starten. Hauptaktion: **7 Tage kostenlos testen**, sofern aktuell angeboten.
- Layout/S: ruhiger Header; „Deine Buchhaltung. Ein klarer Überblick.“; ein CTA; fokussierte Produktvorschau; drei Beispiele Überblick/Rechnungen/Steuerberater; Datenschutz; ein Plan; FAQ; Footer. D: FAQ, Jahresabrechnung als einfache Textwahl.
- Empty: eine fehlende Produktgrafik erhält eine textliche Beschreibung, keine erfundenen Kundendaten. Mobile: einspaltig, große Produktvorschau, kurze Texte. Vereinfachung: keine Kartenwand, Pfeile, Logo-Ticker, Fake-Bewertungen, schwebenden Fenster oder wiederholten Schluss-CTA. Dunkelmodus entspricht dem freigegebenen Entwurf; Hellmodus hat dieselbe Hierarchie. Preise, Kartenerfordernis und tatsächlicher Checkoutvertrag stimmen überein.

### Rechtsseiten

- Zweck: Vertrags-/Datenschutzinformationen vollständig lesbar machen. Hauptaktion: **Inhaltsabschnitt öffnen** über das Inhaltsverzeichnis.
- Layout/S: Titel, Stand, Inhaltsverzeichnis, vollständiger Text, Kontakt, Footer. D: nur ergänzende Erklärungen, niemals wesentliche Vertragstexte.
- Empty/Fehler: Dokument nicht geladen mit „Erneut versuchen“ und direktem Dokumentlink; kein erfundener Ersatztext. Mobile: 16-px-Lesetext, max. 680 px Breite, umbrechende Links. Vereinfachung: gleiche Typografie/Navigation für AGB, Datenschutz, Impressum, Cookies, Widerruf, Barrierefreiheit und Verfahrensdokumentation; Rechtsinhalt unverändert übernehmen und Änderungen separat prüfen.

## 5. Vereinfachungen über alle Funktionen

| Daten/Aufgabe | Automatik/Standard | Bewusste Grenze |
|---|---|---|
| Firma, Währung, Sprache | Aktive Firma; EUR und Deutsch; `Intl` für Datum/Beträge. | Firmenwechsel vor Speichern auffangen, keine firmenübergreifende Übernahme. |
| Kategorie | Bestätigte firmenbezogene Partner-/Textregel vorschlagen. | Neue/mehrdeutige Fälle „Zu prüfen“; Zuordnungsgrund anzeigen. |
| OCR/strukturierte Rechnung | Datum, Partner, Betrag/Positionen aus Original übernehmen. | Unsicherheit sichtbar, lokal verarbeiten; keine fachliche Richtigkeit aus Erkennung ableiten. |
| Steuersatz/Steuerfall | Aus bestätigter Position/Firmenprofil und gültigem Zeitraum vorschlagen. | ⚠️ Nicht pauschal 19 %, 0 % oder §25a; gemischte Sätze, §13b, EU und Privatanteile prüfen. |
| Nummern | Eindeutige firmenbezogene Nummernkreise; finale Vergabe bei verbindlichem Erstellen, stabile interne IDs. | Nummern nicht durch Filter/Suche/Abbruch ändern; keine Wiederverwendung nach Storno. Mehrere Tabs/Sync auf Kollision prüfen. |
| Datum/Zahlung | Heute als sichtbarer Vorschlag für neue manuelle Vorgänge; aus Import/Original bekannte Daten übernehmen. | ⚠️ Belegdatum, Leistungsdatum und Zahlungsdatum bleiben unterschiedliche Werte; keine angenommene Bezahlung. |
| Bankimport | Formate, Zuordnungen und exakte Dubletten erkennen; vorhandene Rechnungen zum Abgleich anbieten. | Teil-/Sammelzahlungen, Gebühren, Erstattungen und mehrdeutige Matches zur Prüfung. |
| Einkauf/Lager | Artikel und verknüpften Vorgang gemeinsam anlegen, Bestand aus bestätigten Bewegungen ableiten. | ⚠️ Kaufdatum ist kein automatisch identisches Zahlungsdatum; Lagerbewegung ist kein zusätzlicher Aufwand. |
| Verkauf/Rechnung/Zahlung | Ein gemeinsamer Vorgangsbezug synchronisiert bestätigte Wirkungen. | ⚠️ Rechnung, Erlös, Zahlung und Ware nicht gleichsetzen; Abbruch/Fehler hinterlassen keine halbe Buchung. |
| EÜR/UStVA/Statistik | Gemeinsame Fachberechnung und nachvollziehbare Zuordnung. | ⚠️ Perioden, Ist/Soll und Gewinnermittlung nicht als bloße Anzeigepräferenz ändern. |
| Profile/Module | Relevanzbasierte Navigation und sinnvolle Grundfilter. | Vorhandene Daten und offene Hinweise halten den Fachzugang sichtbar. |
| Abschreibung | Plan aus bestätigter Anlage jährlich fortführen. | ⚠️ Wahlrechte/Nutzungsdauer nicht automatisch entscheiden; Gesetzeswerte in Jahresfunktionen. |
| Formulare | Unkritische Entwürfe lokal sichern; optionale Felder später ergänzen. | „Entwurf gesichert“ ist keine Buchung/Festschreibung; Speichern erst nach echtem Erfolg melden. |
| Daten/Sicherheit | Lokal zuerst, Sync aus, Systemtheme, letzte passende Ansicht pro Firma. | Kein automatisch aktivierter Webhook oder unverschlüsseltes Backup. |
| Hilfe | Kurze Feldhilfe mit Zugriff auf ausführliche Anleitung. | Pflichtinformation, Gebühren/Abrechnung und Risiken nicht als Tooltip verstecken. |

**Ein Schritt statt drei:** Kunde im Rechnungseditor anlegen; Beleg und Ausgabe im selben Editor; bestehende Zahlung direkt an Rechnung zuordnen; aus Einkauf eine Anlage übernehmen; Eigenbeleg am fehlenden Beleg starten; Rückgabe mit gemeinsamen Auswirkungen prüfen; DATEV/Paket und Lesezugang am selben Übergabeeinstieg wählen. Bestehende fachliche Prüfungen, irreversible Bestätigungen und Empfängerprüfung bleiben eigene bewusste Entscheidungen.

**Zustandsvertrag:** Dokumentstatus, Prüfstatus, Zahlungsstatus, Festschreibungsstatus, Lagerstatus und Syncstatus sind getrennte Felder. Dieselbe Aktion darf nicht „Bezahlt“ setzen, wenn nur eine Rechnung erstellt wurde. Originaldaten und abgeschlossene Snapshots ändern sich nicht nachträglich durch eine neue Ansicht. Fachliche Teiloperationen müssen entweder vollständig erfolgreich sein oder als noch unvollständiger Vorgang nachvollziehbar bleiben; Wiederholung erzeugt kein Duplikat.

⚠️ **Vor Umsetzung fachlich prüfen:** Ist-/Sollbesteuerung und EÜR-Zahlungszeitpunkte; §19-Sonderfälle; §25a-Einzel-/Gesamtdifferenz; Vorsteuer/Eigenbelege; AfA-Wahlrechte; GbR-Schlüssel/Sonderbetriebsbereiche; Jahresabschlussvollständigkeit; Rückdatierungen und berichtigte Meldungen. Der aktuell im Store enthaltene Wiederöffnungsweg und pauschale Warntext zu Korrekturen dürfen nicht ungeprüft als neuer UI-Vertrag übernommen werden. Der Redesignauftrag hebt keine gesetzlichen Sperren auf.

## 6. Kernabläufe – alt gegen neu

„Alt“ bezeichnet die derzeit sichtbaren getrennten Wege; dort, wo die Fachmodule bereits verknüpfen, wird diese Logik weiterverwendet. Keine neue Datenberechnung allein aufgrund einer anderen Bedienreihenfolge.

### Erste Einrichtung

**Alt:** 1. Firma/Name/Branche/Rechtsform. 2. Adresse. 3. Telefon/E-Mail. 4. Steuerdaten und vorausgewählte Steuerart. 5. Bankdaten. Die vorhandenen späteren Schritte sind bereits überspringbar.

**Neu:** 1. Neu/Backup/Sync wählen. 2. Firma, Rechtsform und Tätigkeit erfassen. 3. Steuerstatus bestätigen oder „Weiß ich noch nicht“ wählen und lokale Speicherung verstehen. 4. Zur Übersicht; weitere Pflichtdaten genau vor Rechnung/Steueraufgabe ergänzen. Keine automatische Steuerrechtsberatung durch Vorauswahl.

### Ausgabe mit Beleg erfassen

**Alt:** 1. Passendes Finanz-/Ausgabenmodul öffnen. 2. Formular und Beleg/OCR-Werkzeug bedienen. 3. Erkannte Werte übernehmen. 4. Kategorie/Steuer-/Zahlungsdaten prüfen. 5. Speichern.

**Neu:** 1. „Buchung erfassen“, Beleg wählen. 2. Vorschläge direkt im gemeinsamen Editor prüfen; unklare Kategorie/Steuer/Zahlung ergänzen. 3. Einmal speichern; Beleg und Vorgang verknüpfen. Unsicherer Fall bleibt Entwurf/Prüfaufgabe, keine still endgültige Buchung.

### Rechnung schreiben und bezahlt markieren

**Alt:** 1. Rechnungsbereich öffnen. 2. Kunde/Firmendaten bei Bedarf separat pflegen. 3. Rechnung mit Positionen erstellen. 4. Rechnung später wiederfinden. 5. Zahlung erfassen; vorhandene Synchronisation übernimmt entsprechende Buchungswirkung.

**Neu:** 1. „Rechnung erstellen“, Kunde und Positionen direkt wählen/anlegen. 2. Vollständige Vorschau prüfen und verbindlich erstellen; Nummer/Original sichern. 3. Im selben Detail Zahlung per Bankmatch oder Datum/Betrag erfassen; Teilzahlung möglich. 4. Ein gemeinsamer Zahlungsabgleich aktualisiert den verknüpften Vorgang, ohne zweiten Umsatz. Erstellen und Bezahlen bleiben zeitlich getrennt möglich.

### Lagerartikel einkaufen und verkaufen

**Alt:** 1. Lager öffnen und Einkauf erfassen. 2. Beleg/Artikelnummer/Status verwalten. 3. Verkauf oder Rechnung aus Artikel starten. 4. Zahlung und Verknüpfungen prüfen.

**Neu:** 1. Einkauf mit Artikel, Preis, Datum, Quelle und Beleg einmal erfassen; Bezahltstatus ausdrücklich setzen. 2. Im Artikeldetail „Verkauf erfassen“; Plattformverkauf oder Rechnung wählen. 3. Erlös, Warenbewegung und gegebenenfalls Rechnung gemeinsam prüfen/bestätigen; Steuerfall aus bestätigten Grundlagen. 4. Zahlung erst bei tatsächlichem Eingang zuordnen. Artikel kann verkauft und gleichzeitig unbezahlt sein; ein Rechnungsentwurf macht ihn nicht endgültig verkauft.

### UStVA/EÜR abschließen

**Alt:** 1. Steuerbereich/Zeitraum öffnen. 2. Summen und Sondermodule prüfen. 3. CSV/Kopierwerte exportieren. 4. In ELSTER/mit Steuerberater abgeben. 5. Abgabe markieren beziehungsweise Jahr schließen.

**Neu:** 1. Zeitraum/Jahr und Profil prüfen. 2. Geführte Datenprüfung erledigen, vollständige Formularwerte zugänglich halten. 3. Werte/Unterlagen bereitstellen; ausdrücklich „Noch nicht abgegeben“. 4. Tatsächliche Übermittlung außerhalb Stackr durchführen und Abgabe mit Datum/Nachweis dokumentieren. 5. Mit klarer Wirkungserklärung festschreiben; Korrekturen referenzieren Originale und erzeugen gegebenenfalls berichtigte Vorbereitung. ⚠️ Keine frei editierbare Wiederöffnung und keine pauschale Korrektur in einer anderen Periode.

### Daten an den Steuerberater geben

**Alt:** 1. EÜR-/DATEV-Werkzeug oder Steuerberaterbereich finden. 2. Zeitraum/Umfang wählen. 3. Exportpaket oder separate Freigabe vorbereiten. 4. Übergabe beziehungsweise Zugriff bestätigen.

**Neu:** 1. „Steuerberater → Datenübergabe vorbereiten“. 2. Firma/Zeitraum/Umfang wählen und Prüfbedarf sehen. 3. Entweder Exportpaket erzeugen/herunterladen oder Lesezugang einrichten. 4. Für Lesezugang Empfänger-/Schlüsselfingerabdruck prüfen und bewusst freigeben; für Datei den tatsächlichen Versand selbst durchführen. 5. Übergabe-/Freigabestatus und Widerruf verwalten. Ein Dateidownload ist kein erfolgreicher Versand.

## 7. Umsetzungsreihenfolge

Die Produktion erhält keinen halb fertiggestellten Navigations-/Funktionsumbau. Eine gemeinsame visuelle Grundlage kann früher erscheinen, eine neue Informationsarchitektur erst nach vollständiger Abdeckung. Vorbereitung erfolgt in einer getrennten Preview, ohne Änderung produktiver Datenschemata.

| Phase | Inhalt und Reihenfolge | Freigabebedingung |
|---|---|---|
| 1. Bestand und Verträge | Routen, Module, Datenbeziehungen, Sperren, Nummernkreise, Exporte, Gate und Theme erfassen; repräsentative Testdatensätze je Profil. | Kein Bereich fehlt; fachlich riskante Änderungen sind getrennt markiert. |
| 2. Visuelle Grundlage | Tokens, Schrift, Komponenten, Hell/Dunkel, Focus/Errors, mobile Listen; Adapter für bestehende Klassen/Inline-Stile. | Gleiche Gestaltung für App, Lager, Rechnungen, Eigenbelege, Gate, Onboarding und öffentliche Seiten. |
| 3. Einheitliche Oberfläche | Gemeinsame Shell und Komponenten in Preview über alle vorhandenen Screens legen; Funktions-/Datenverträge beibehalten. | Gesamter visueller Durchstich besteht. Erst dann komplette visuelle Version gemeinsam veröffentlichen; alle Bereiche sehen konsistent aus. |
| 4. Neue Erfassung | Buchungen, Belege/OCR, Privat, Bank-Import und Eigenbelege fertigstellen. | Duplikat-/Teilzahlungs-/OCR-/Sperrtests und Tastatur/Mobil funktionieren. |
| 5. Verkauf und Bestand | Rechnungen, Kunden/Vorlagen/Angebote, Zahlungen/Mahnungen/Storno, Lager/Import, Retouren, Material, AfA/Kasse/Fahrten. | Kein Abbruch verändert Bestand oder erzeugt halbe/mehrfache Buchungen; Originale und Nummern bleiben erhalten. |
| 6. Steuer und Auswertungen | Einheitliche Quellen für Übersicht/Statistik/EÜR/UStVA; Sondersteuern, Termine, GbR, Bilanz, Steuerberater und Protokoll. | Vergleichswerte/Exporte stimmen exakt mit bestätigten Fachregeln; kein Pflichtbereich verloren. |
| 7. Einrichtung und Werkzeuge | Firmenprofil/-wechsel, Sync/Backup/Webhooks, Hilfe, neues Onboarding, Gate, Landingpage und Rechtsseiten. | Wiederherstellung, Konflikte, falsche Firma, Offline und Abo-Fehler erhalten Daten und zeigen korrekte Zustände. |
| 8. Gesamte neue IA veröffentlichen | Alle sechs Hauptpunkte und alten Deep Links gemeinsam aktivieren; CSS/JS-Versionen, CSP und Cachevertrag prüfen. | Kein Screen verweist auf alte Navigation oder unfertigen Ablauf; vollständige Kernabläufe bestanden, Rollback vorbereitet. |

**Technische Umsetzung:** Gemeinsame Token-/Komponenten-/Layoutdateien ohne Framework oder Build. Bestehende Render-/Store-/Theme-Funktionen wiederverwenden; neue UI-Logik in Fachmodule, nicht weiter in `js/app.js`, `js/store.js` oder `js/lager.js` aufhäufen. Externe Schriften/Icons/Scripts bleiben ausgeschlossen. DOM-Hooks/Delegation und routenspezifische CSP erhalten. Keine gleichzeitige Umstellung von Design und fachlichem Rechenkern ohne eigene Prüfschritte.

**Datenmigration:** UI-/Routenänderungen benötigen zunächst keine Migration. Falls Stammdaten vereinheitlicht werden müssen: Schema-Version, Vorschau, Konfliktauflösung, verifiziertes verschlüsseltes Backup, wiederholbar sichere Migration pro Firma; keine stillen Überschreibungen. Alte Version muss migrierte Daten entweder sicher lesen können oder einen definierten Wiederherstellungsweg besitzen. Ein Rollback restauriert niemals unbemerkt einen alten Stand über neuere Buchungen.

**Abnahme:** Hell/Dunkel; 360/768/1440 px, Reflow/Zoom; Tastatur/Screenreader; leere und große Datenbestände; Einzelunternehmen/Freelancer/Kleinunternehmer/Regelbesteuerung/GbR; relevante Sonderfälle; festgeschriebene/stornierte Datensätze; Teilzahlung/Retoure/Importduplikat; abgebrochene Formulare; Firmawechsel; lokaler Speicherfehler; Offline/Synckonflikt; verschlüsseltes Backup/Wiederherstellung; Nur-Lese-Zugang; echte Abozustände. Fachtests aus `test/` bleiben Grundlage. Browserprüfung auf frischem Preview-Port.

**Messbare Produktziele:** neuer Nutzer findet die nächste Aufgabe innerhalb von 30 Sekunden; bestehender Nutzer erkennt den Geschäftsstand innerhalb von zwei Minuten; keine manuelle Doppelerfassung im Rechnung-/Zahlung-/Lagerablauf. Zeiten im Nutzertest messen, nicht als bereits nachgewiesene Ergebnisse behaupten.

### Fachliche und gestalterische Quellen

Die Specs sind Produktentscheidungen. Die folgenden Primärquellen unterstützen ihre rechtlichen und barrierefreien Grenzen; sie ersetzen keine Einzelfallprüfung:

- [§146 AO – ursprüngliche Inhalte und zeitgerechte Aufzeichnung](https://www.gesetze-im-internet.de/ao_1977/__146.html)
- [§14 UStG – Rechnung und Pflichtangaben](https://www.gesetze-im-internet.de/ustg_1980/__14.html)
- [§34a UStDV – Kleinunternehmerrechnungen](https://www.gesetze-im-internet.de/ustdv_1980/__34a.html)
- [§15 UStG – Voraussetzungen des Vorsteuerabzugs](https://www.gesetze-im-internet.de/ustg_1980/__15.html)
- [§25a UStG – Differenzbesteuerung](https://www.gesetze-im-internet.de/ustg_1980/__25a.html)
- [BMF: E-Rechnung, Stand März 2026](https://www.bundesfinanzministerium.de/Content/DE/FAQ/e-rechnung.html)
- [ELSTER: Anlage EÜR](https://www.elster.de/eportal/formulare-leistungen/alleformulare/euer)
- [ELSTER: Umsatzsteuer-Voranmeldung](https://www.elster.de/eportal/formulare-leistungen/alleformulare/ustvaeru)
- [BZSt: One-Stop-Shop, EU-Regelung](https://www.bzst.de/DE/Unternehmen/Umsatzsteuer/One-Stop-Shop_EU/one_stop_shop_eu.html)
- [W3C: WCAG-Referenz, Version 2.1](https://www.w3.org/WAI/WCAG22/quickref/?versions=2.1)
