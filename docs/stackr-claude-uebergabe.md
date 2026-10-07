# Stackr – Übergabe an Claude

Stand: 7. Oktober 2026. Der Nutzer hat den zuletzt gezeigten Designstand mit „Passt das können wir so an claaude übergeben“ freigegeben. Das ist eine Designfreigabe und Übergabe, keine Bestätigung vollständig getesteter Geschäftsabläufe und keine Veröffentlichung.

## Auftrag für die Fortsetzung

Übernimm den bereits umgesetzten und freigegebenen Stackr-Redesignstand. Erhalte die unten festgehaltenen Entscheidungen. Prüfe die Integration gegen den aktuellen Projektstand und schließe die noch offenen Funktionstests ab. Beginne nicht mit einer neuen Gestaltung. Maßgeblich sind der tatsächliche Code, die letzte Vorschau und diese jüngsten Nutzerentscheidungen; ältere Spezifikationen mit einer Seitenleiste sind insoweit überholt.

Die höchste Priorität des Nutzers: **Keine bestehenden Funktionen verlieren.** Verwaltungsfunktionen erhalten einen gemeinsamen Einstieg; ihre bisherigen Fachmodule, Felder, Datenräume und Speicherregeln bleiben bestehen.

## Dateien und Arbeitsverzeichnisse

- Originalprojekt: `C:\Users\secon\Desktop\TrackYourIncome\Web 1.7`
- Isolierter Umsetzungsstand: `C:\Users\secon\.codex\worktrees\stackr-redesign\Web 1.7`
- Übergabedokument: `docs/stackr-claude-uebergabe.md` im isolierten Stand.
- Vollständiger Umsetzungsbericht mit Funktionsmatrix und Grenzen: `docs/stackr-redesign-umsetzung.md` im isolierten Stand.
- Integrationspatch: `output/redesign/stackr-redesign.patch` im isolierten Stand.
- Exakte Liste eigener Änderungen: `output/redesign/own-files.json`.
- SHA-256-Werte des übernommenen Originalstands: `output/redesign/baseline-files.json`.

Der Patch umfasst 24 geänderte und 14 neue Quell-/Test-/Berichtsdateien. Dieses Übergabedokument und die lokalen Prüfwerkzeuge sind separate Übergabeunterlagen und nicht Bestandteil des Produktpatches.

Das Originalprojekt wurde von dieser Umsetzung nicht bearbeitet. Zu Beginn vorhandene Änderungen anderer Sessions wurden in den isolierten Stand kopiert. Deshalb ist dessen gesamtes `git diff` **nicht** der Redesignpatch. Nicht den ganzen Checkout zurückkopieren, pauschal stagen oder resetten. Keine Commits, Pushes oder Deployments wurden durchgeführt.

## Freigegebene Gestaltung

1. **Topbar statt Seitenleiste.** Am Desktop eine kompakte erste Zeile mit Übersicht, Buchungen, Rechnungen, Lager, Steuern und Auswertungen. Wortmarke links; ergänzende Werkzeuge und Firmen-/Kontozugang rechts.
2. **Mittige Navigation.** Hauptbereiche und zugehörige Unterpunkte erscheinen als zentrale Gruppen. Auf breiten Desktopfenstern liegt die Hauptgruppe exakt in der Fenstermitte.
3. **Zweite Zeile nur bei Bedarf.** Sie enthält die Unteransichten des gewählten Bereichs. Übersicht und Einstellungsübersicht benötigen keine zweite Zeile. Auf schmalen Fenstern öffnet sich die Hauptnavigation von oben, nicht seitlich.
4. **Letzte Headerfreigabe:** keine vertikalen Trennlinien an Marke/Konto und keine lange Trennlinie zwischen den beiden Navigationsebenen. Nur ein unterer äußerer Abschluss. Hauptauswahl mit textbreiter 2-px-Markierung, Unterauswahl dezenter mit 1 px. Einheitliche Werkzeugbuttons. „Mehr“ mit Aufklappsymbol statt „Weitere Aufgaben +“.
5. **Zentrale Einstellungen.** Firmen-/Bankdaten, Rechtsform und Steuerprofil, Gesellschafterstammdaten, Rechnungsangaben/Logo, Eigenbelegvorgaben/-kategorien, Warenkategorien/Artikelstatus, Backup/Wiederherstellung, Sync, Webhooks, Sprache, Darstellung und Konto sind dort erreichbar. Die vorhandenen Dialoge und Unteransichten werden weiterverwendet. Lagerorte bleiben direkt am Artikel.
6. **Kunden und Positionsvorlagen bleiben unter Rechnungen.** Der Nutzer hat dies ausdrücklich bestätigt.
7. **Rechnungskopf:** kompaktere Aktionen und gleich hohe Filterfelder; ein Suchsymbol im Feld; Suche, Dokumenttyp und Status in einer Reihe. Zeitraum und Kunde aufklappbar darunter. Aktive Zusatzfilter sind auch eingeklappt erkennbar. Alle Filter und Zurücksetzen bleiben erhalten; Suche reagiert unmittelbar auf Eingaben.
8. Monochrom, lokal gehostetes Inter, Hell/Dunkel über die vorhandene Theme-Quelle, schlichte 6-px-Buttons und Texttabs. Keine neue Bibliothek, kein Build, keine neuen Steuerannahmen.

## Zuständigkeiten im Code

| Datei | Aufgabe |
|---|---|
| `css/redesign.css` | Gemeinsame Appdarstellung, Header, Tabellen, Formulare, Dialoge und responsive Regeln |
| `js/redesign-shell.js` | Sechs Hauptbereiche, Zuordnung aller alten Routen plus Einstellungen, Unteransichten, History und mobiles Menü |
| `js/redesign-settings.js` | Gemeinsamer Einstellungseinstieg; delegiert an bestehende Funktionen |
| `js/redesign-ui.js` | Bestehende Komponenten zugänglich und einheitlich darstellen |
| `js/redesign-bookings.js` | Gemeinsame Buchungsliste als Anzeigeadapter ohne neue Speicherung |
| `js/redesign-onboarding.js` | Zweistufige Einrichtung über vorhandene Speicherpfade |
| `js/redesign-charts.js` | Neutrale Chartdarstellung und tabellarische Alternativen |
| `rechnungen/js/dokumente.js` | Überarbeiteter Rechnungskopf und Dokumentfilter |
| `js/dashboard.js`, `rechnungen/js/rech-dashboard.js` | Überarbeitete Einstiege, bestehende Berechnungen erhalten |

Alle vier App-Einstiege laden die gemeinsamen Dateien: `app.html`, `rechnungen/index.html`, `lager/index.html`, `eigenbelege/index.html`. Landingpage und Rechtsseiten sind ebenfalls im Patch enthalten; ihre Abdeckung steht im Umsetzungsbericht.

Wichtig: `overflow: visible` am neuen Header erhalten. Die alte Regel schnitt das Aufgabenmenü ab, nachdem die Unterpunkte in den Header verlegt wurden. Versteckte alte DOM-IDs sind weiterhin Hooks vorhandener Module; nicht ohne Prüfung entfernen.

## Vorschau und Prüfungen

- Freigegebener Header: <http://127.0.0.1:4361/output/redesign/ansichten.html#buchungen>
- Rechnungen: <http://127.0.0.1:4361/output/redesign/ansichten.html#rechnungen>
- Einstellungen: <http://127.0.0.1:4361/output/redesign/ansichten.html#einstellungen>
- Geschützte tatsächliche App: <http://127.0.0.1:4361/app.html>
- Server: `node scripts/csp-preview-server.js 4361` im isolierten Checkout. Bestehenden Prozess/Port prüfen; für neue Browserprüfungen gemäß `CLAUDE.md` einen frischen Port in `.claude/launch.json` verwenden.

Die Designprüfung enthält **statische, leere Abzüge echter Renderer**. Sie lädt keine App-/Store-/Authlogik und kann keine Buchungen speichern. Die Fachaktionen sind absichtlich deaktiviert. Ein deaktivierter Button dort ist kein Nachweis einer fehlenden Funktion in der eigentlichen App. Navigation, Themes und native Aufklappbereiche können beurteilt werden.

Prüfbelege in `output/redesign/`:

- `regression-topbar.json`: vollständiger Node-Harnesslauf, 86/86 bestanden; vor Übergabe erneut ausgeführt.
- `review-check.json`: 300 Kombinationen aus 30 Ansichten, fünf Breiten und zwei Themes; keine Überläufe oder Konsolenfehler.
- `app-check.json`: 240 Prüfungen echter Renderer hinter dem unveränderten Whop-Gate aus der Integrationsrunde; spätere Header-/Filteränderungen zusätzlich gezielt geprüft.
- `check-document-filters.js`: kombinierte Suche/Status/Datum, Zusatzfilteranzeige, Zurücksetzen und eindeutige Kontroll-IDs geprüft.
- Vier neue Regressionstests unter `test/test-redesign-*.js`; Navigation prüft die echte `App.navigate`-Funktion samt Dirty-/Leave-/History-Verhalten.
- In Chrome zusätzlich geprüft: zentrierter Header, vollständig aufklappendes Aufgabenmenü, schmale Ansichten, mobile Fokusbindung/Escape/Fokusrückgabe und einzeiliger Desktopheader mit langem Test-Firmennamen.

Für die lokalen Node-Tests wurde die bereits vorhandene Abhängigkeit aus `C:\Users\secon\Desktop\TrackYourIncome\Web 1.7\node_modules` über `NODE_PATH` verwendet. Keine neue Installation. Reproduktionsskript: `python output/redesign/verify-revision.py` im isolierten Checkout.

## Übernahme und verbleibende Abnahme

1. `CLAUDE.md` und gegebenenfalls `AGENTS.md` im aktuellen Zielprojekt lesen, Status und konkurrierende Änderungen prüfen. Den Integrationspatch und die Dateiliste gegen den tatsächlichen Zielcode vergleichen.
2. Zunächst im Originalprojekt ausschließlich prüfen:

   ```powershell
   git apply --check "C:/Users/secon/.codex/worktrees/stackr-redesign/Web 1.7/output/redesign/stackr-redesign.patch"
   ```

   Dieser Check war bei Übergabe erfolgreich. Erst nach dem Abgleich den geprüften Patch gezielt übernehmen. Bei inzwischen geändertem Zielcode Konflikte dateiweise auflösen; keine fremden Änderungen überschreiben.
3. Erneut die vorhandenen Harnesses und relevante Browserabläufe prüfen. Die Nutzerfreigabe betrifft die Gestaltung, nicht den Nachweis vollständiger Geschäftsabläufe.
4. Vollständige Abläufe mit autorisierter Anmeldung und entbehrlichen Testdaten abnehmen: OCR/Beleg, Rechnung einschließlich Teilzahlung/Storno, Einkauf/Verkauf/Retoure und Abbruch, Steuerabschluss/Export, Steuerberaterfreigabe, Firmenwechsel, Offline-/Sync-Konflikt und Backup/Wiederherstellung. Kein Whop-Bypass und keine echten Produktionsvorgänge zu Testzwecken.

Bekannte offene Punkte aus dem Umsetzungsbericht:

- Der lokale statische Server führt die Whop-API nicht aus; der vorhandene OAuth-Redirect führt nach Produktion. Authentifizierte End-to-End-Abnahme ist lokal deshalb noch nicht abgeschlossen.
- „Weiß ich noch nicht“ beim Steuerstatus beendet das Onboarding derzeit nicht, weil der vorhandene Kern fehlenden Status teilweise als Kleinunternehmerstatus behandelt. Kein stiller Default und keine neue fachliche Entscheidung.
- Dashboard und EÜR haben teilweise unterschiedliche bestehende Berechnungsgrundlagen. Diese wurden benannt und nicht durch das Design vereinheitlicht.
- Der alte UI-Weg **„Jahr wieder öffnen“** wurde entsprechend der harten Ausgangsvorgabe entfernt. Das ist die dokumentierte Ausnahme zum bloßen Verschieben von Funktionen. `Store.reopenYear` bleibt intern vorhanden; eine fachlich geprüfte Korrekturarchitektur ist keine erledigte Designleistung. Nicht unbemerkt wieder freischalten.
- Whop-Preise/Testbedingungen und bestehende Angebotskommunikation vor Veröffentlichung gegen das reale Angebot prüfen. Die neue Landingpage enthält keine als verifiziert ausgegebenen unbestätigten Preisversprechen.

Keine Speicher-/Firmenmigration, keine geänderte Verschlüsselung, keine neue Abhängigkeit und keine Veröffentlichung als Teil dieser Übergabe. `output/` und `.playwright-cli/` bleiben vom Deployment ausgeschlossen. Weitere bekannte Grenzen und die vollständige Funktionsmatrix stehen im Umsetzungsbericht.
