# Umsetzungsprompt: endgültige Stackr-Landingpage

Du arbeitest als erfahrener Product Designer und Frontend-Entwickler im bestehenden Stackr-Projekt. Setze die endgültige Landingpage auf Grundlage der bereits erarbeiteten reduzierten Fokus-Version um und integriere sie als öffentliche Hauptseite. Liefere eine vollständig funktionierende, lokal überprüfbare Umsetzung. Antworte auf Deutsch.

## Projekt und Grundlage

Arbeitsverzeichnis: `C:\Users\secon\Desktop\TrackYourIncome\Web 1.7`

Lies zuerst vorhandene `AGENTS.md`-Anweisungen und `CLAUDE.md`. Prüfe `git status --short` und `git log --oneline -8`. Lies anschließend:

- `stackr-fokus.html` und `css/stackr-minimal.css`: maßgebliche visuelle Grundlage.
- `js/stackr-concepts.js`: Interaktionen des Entwurfs.
- `docs/stackr-design-prompt.md`: bisherige gestalterische Entscheidungen, insbesondere die Abschnitte zur Landingpage.
- `index.html`, `css/landing.css`, `js/landing.js`: bisherige öffentliche Landingpage und ihre Funktionen.
- Die tatsächlich eingebundenen Dateien für Anmeldung, Cookie-Einwilligung und Analytics sowie relevante Regeln in `vercel.json` und `build-deploy.py`.

Prüfe den tatsächlichen Code. Entwürfe und Plandateien belegen keine verfügbaren Funktionen oder aktuellen Vertragsbedingungen. Der Auftrag betrifft die Landingpage und ihre notwendige Integration; ein vollständiges App-Redesign gehört nicht dazu.

## Ziel und Marke

Stackr hilft Selbstständigen, Freelancern, Kleinunternehmern, Resellern und GbRs, Buchhaltung, Rechnungen und Belege zu organisieren. Besucher sollen schnell verstehen, was das Produkt leistet, wie es aussieht und was es kostet.

Die Wortmarke bleibt **stackr**, das vorhandene Rautenlogo bleibt erhalten. Entwickle den Fokus-Entwurf zur fertigen Seite weiter. Die Entwurfsphase ist abgeschlossen: Liefere eine konsistente Endfassung, keine neue Auswahl aus mehreren Designrichtungen.

## Verbindliche Gestaltung

- Durchgehend dunkler Hintergrund ungefähr `#111111`, Haupttext `#EEEEEE`, Produktflächen ungefähr `#161616`, dezente Trenner ungefähr `#292929`.
- Ausschließlich Schwarz, Weiß und neutrale Graustufen. Keine großen Wechsel zwischen hellen und dunklen Abschnitten.
- Selbst gehostetes Inter, Regular- bis Medium-Überschriften, großzügiger Leerraum und klare Ausrichtung.
- Hero ungefähr 48 px auf Desktop und 32–39 px mobil; Abschnittsüberschriften ungefähr 26–30 px. Fließtexte und Bedienelemente gut lesbar gestalten. Die teilweise winzigen Schriften des Prototyps korrigieren, besonders Preise, Bedingungen und mobile Texte.
- Inhalt ungefähr 1.000 px breit, zentrale Produktvorschau ungefähr 790 px. Mobil mindestens 16–20 px Seitenabstand.
- Flache Buttons mit 6 px Radius und mindestens 44 px Bedienhöhe. Heller Primärbutton mit dunklem Text. Keine Pfeile in CTAs.
- Keine Verläufe, Glows, Glassmorphism, Schatten auf normalen Komponenten, Hintergrundmuster, schwebenden Fenster, 3D-Perspektiven, Emoji-Icons oder dekorativen Kartenraster.
- Animationen nur für dezente Zustandswechsel; kein Parallax, Springen oder verzögertes Einblenden wesentlicher Inhalte. `prefers-reduced-motion` beachten.

Die Seite soll ihre Qualität durch Typografie, Abstände, verständliche Texte und eine präzise Produktdarstellung erhalten.

## Endgültiger Seitenaufbau

### 1. Header

Links Wortmarke und vorhandene Raute. Rechts „Funktionen“, „Preise“ und „Anmelden“. Anmeldung führt zum bestehenden App-Einstieg. Mobil ein einfaches, vollständig bedienbares Menü. Kein zusätzlicher auffälliger Verkaufsbutton im Header.

### 2. Hero

Zentrierte Überschrift:

**Deine Buchhaltung.**  
**Ein klarer Überblick.**

Unterzeile: **Rechnungen, Belege und Zahlen. An einem Ort.**

Eine Hauptaktion: **7 Tage kostenlos testen**, sofern das aktuelle Angebot diese Testphase bestätigt. Im Hero führt sie zum Preisbereich, damit Abrechnung und Bedingungen vor dem Checkout sichtbar werden.

### 3. Produktvorschau

Eine große, ruhige Vorschau unter dem Hero. Zeige Einnahmen, Ausgaben, Gewinn und einen schlichten grauen Linienchart. Verwende konsistente, ausdrücklich als Beispieldaten gekennzeichnete Werte.

Orientiere die Darstellung an der tatsächlichen aktuellen App. Eine vereinfachte Vorschau darf keine nicht vorhandenen Funktionen vortäuschen. Keine volle Sidebar, überlagerten Rechnungen, Fensterstapel oder komplette Buchungstabelle. Demo-Inhalte bleiben von echten Nutzerdaten und App-Speichern getrennt. Die Vorschau benötigt eine sinnvolle zugängliche Beschreibung.

### 4. Drei Funktionsabschnitte

Je Abschnitt eine kurze Überschrift, ein konkreter erklärender Text und ein fokussiertes Produktbeispiel. Desktop zweispaltig, mobil untereinander.

1. **Deine Zahlen im Blick.** Einnahmen und Ausgaben erfassen, Belege zuordnen und das Ergebnis verstehen.
2. **Rechnungen. Einfach klar.** Rechnungen erstellen sowie Kunden und Zahlungen verwalten. PDF und XRechnung nur nennen, soweit tatsächlich verfügbar.
3. **Gut vorbereitet.** EÜR und Datenübergabe an den Steuerberater erklären. DATEV und Lesezugang nur im tatsächlich unterstützten Umfang nennen. Klarstellen: Die Übermittlung an ELSTER erfolgt separat.

### 5. Daten und Datenschutz

Überschrift: **Deine Daten bleiben deine Daten.**

Kurz und anhand des tatsächlichen Speicherverhaltens erklären: lokale Buchhaltungsdaten, optionaler Ende-zu-Ende-verschlüsselter Sync und selbst erstellte Backups. Besonderheiten von Belegspeicherung, Anmeldung und Zahlungsabwicklung berücksichtigen. Keine pauschale Aussage wie „Keine Daten verlassen dein Gerät“. Auf die bestehende Datenschutzerklärung verlinken.

### 6. Preise

Überschrift: **Ein Plan. Alles drin.**

Ein Plan mit monatlicher und jährlicher Abrechnung als schlichte Textauswahl. Keine künstlich unterschiedlichen Tarife oder zusätzlichen Angebotskarten.

Im vorhandenen Code stehen 15 € monatlich beziehungsweise 135 € jährlich, entsprechend 11,25 € pro Monat beim Jahresabo. Diese Angaben sind zu prüfende Bestandswerte. Gleiche Preis, Umsatzsteuerhinweis, Testdauer, Kartenerfordernis, Verlängerung und Kündigungsbedingungen mit dem tatsächlichen Angebot ab. Keine Bedingungen erfinden; nicht verifizierbare Angaben in der Übergabe ausdrücklich nennen.

Beim Jahresabo muss **135 € jährlich abgerechnet** klar sichtbar sein. Der rechnerische Monatspreis darf keine monatliche Abbuchung suggerieren. Testphase und anschließender kostenpflichtiger Übergang müssen unmittelbar beim Angebot verständlich sein.

Eine Checkout-Aktion im Preisbereich. Verwende die bestehenden tatsächlichen Whop-Ziele; beim Umschalten müssen Anzeige und Checkout zum gleichen Zeitraum gehören. Eine bereits vorhandene angemeldete Sitzung und deren „Zur App“-Verhalten erhalten. Die Abrechnungswahl darf einen solchen App-Link nicht versehentlich durch einen Checkout-Link ersetzen.

### 7. FAQ

Etwa fünf kurze, native und tastaturbedienbare Aufklappbereiche:

- Für wen ist stackr gemacht?
- Wie funktionieren Testphase und Abrechnung?
- Wo liegen meine Daten und wie sichere ich sie?
- Wie arbeitet mein Steuerberater damit?
- Übermittelt stackr direkt an ELSTER?

Antworten müssen mit Preisbereich, aktuellem Produkt und bestehenden Rechtstexten übereinstimmen.

### 8. Footer

Wortmarke, kurze Produktbeschreibung und bestehende Links zu Impressum, Datenschutz, AGB, Cookies, Widerruf und Barrierefreiheit. Bestehenden Zugang zur Verwaltung der Cookie-Einwilligung erhalten. Kein zusätzlicher großer Schluss-CTA.

## Technische Integration

Die fertige Landingpage soll über `index.html` unter `/` erreichbar sein. Übernimm den Entwurf gezielt in die vorhandene öffentliche Seite. Ein weiterer separat abgelegter Prototyp erfüllt den Auftrag nicht.

- Vanilla HTML/CSS/JavaScript, kein Framework, Tailwind, neuer Build-Schritt oder zusätzliche Abhängigkeit. Schriften und Assets lokal einbinden.
- Landingpage-Stile und Skripte so begrenzen, dass App und Rechtsseiten unbeeinflusst bleiben. Gemeinsam verwendete Dateien vor Änderungen auf ihre anderen Verbraucher prüfen.
- Vorhandene Login-, Session-, Checkout- und Cookie-Funktionen erhalten. Analytics weiterhin nur nach der dafür vorgesehenen Einwilligung laden.
- Bestehende CSP beibehalten; notwendige Änderungen eng auf die betroffene Route begrenzen. Keine inline Event-Handler oder pauschale Lockerung von Sicherheitsregeln.
- Titel, Beschreibung, Canonical, Open-Graph-Daten und vorhandene strukturierte Daten an die neue Seite angleichen. Veraltete FAQs und Preisangaben auch dort entfernen. Tatsächliche Produktionsdomain verwenden, keine neue Domain erfinden.
- Das `noindex` des Prototyps nicht versehentlich auf die öffentliche Produktionsseite übernehmen. Bestehende Schutzregeln für Vorschauen erhalten.
- Dateien und Referenzen im bestehenden Deployment berücksichtigen. Achtung: `build-deploy.py` erzeugt derzeit `deploy/index.html` aus `stackr-broschuere.html`. Prüfe, welcher Deploymentweg tatsächlich genutzt wird, und passe dessen Quelle gezielt an, damit später die neue Landingpage ausgeliefert wird. Es soll eine maßgebliche Landingpage-Quelle geben. Alte Entwürfe als Referenzen erhalten; nicht ungefragt löschen.
- Deutsche Texte, UTF-8 ohne BOM. Keine echten Nutzerdaten für Vorschauen verwenden.

Keine erfundenen Bewertungen, Kundenzahlen, Partnerlogos, Zertifizierungen, garantierten Steuerersparnisse oder unbelegten Aussagen über Wettbewerber übernehmen. Rechtstexte nur verlinken; ihre inhaltliche Überarbeitung ist kein Teil dieses Auftrags.

## Arbeit im gemeinsamen Repository

Es existieren Änderungen anderer Sessions, unter anderem möglicherweise an `index.html` und `vercel.json`. Fremde Änderungen sichern und erhalten. Keine Dateien zurücksetzen und keine fremden Änderungen mitcommitten.

Wenn eine direkte Integration wegen paralleler Bearbeitung nicht sicher möglich ist, arbeite in einem isolierten Checkout mit den benötigten aktuellen Referenzdateien und liefere einen überprüfbaren Integrationspatch. Nachrichten an andere Chats benötigen eine direkte Nutzerautorisierung. Kein pauschales Staging, Push, Merge oder Deployment im Rahmen dieses Auftrags.

## Prüfung und Übergabe

Prüfe die echte fertige Seite im Browser auf einem frischen Preview-Port nach den Repository-Regeln. Nutze nach Möglichkeit den vorhandenen CSP-Preview-Server.

- Desktop, Tablet und Mobil: mindestens 1440, 768 und 360 px. Kein horizontaler Seitenüberlauf; gut lesbare Texte und Preise.
- Tastatur, sichtbarer Fokus, Skip-Link, Menüzustände, FAQ und sinnvolle Überschriftenhierarchie. Textkontrast mindestens 4,5:1, notwendige Bedienmerkmale mindestens 3:1; 200-%-Zoom prüfen.
- Beide Abrechnungsvarianten einschließlich Initialzustand, sichtbarer Bedingungen und passendem Checkout-Ziel. Keine Testkäufe auslösen.
- Anmeldung und bestehendes Session-Verhalten soweit ohne echte Zugangsdaten prüfbar. Einen erforderlichen echten Login führt der Nutzer selbst durch.
- Cookie-Auswahl einschließlich Ablehnung, funktionierende Rechtslinks, keine vorzeitigen Analytics-Aufrufe.
- Keine neuen Konsolenfehler, fehlenden Assets oder CSP-Verstöße. Kerninhalt und ein korrekt beschrifteter Standard-Checkout funktionieren auch ohne JavaScript.
- Vorhandene relevante Tests für geänderte Logik ausführen. Neue Tests nur für tatsächlich geändertes Verhalten, keine Tests für bloße Dekoration.

Liefere am Ende die lokale Vorschau-URL, die geänderten Dateien, eine kurze Beschreibung des Ergebnisses sowie bestandene und noch offene Prüfungen. Benenne fehlende Angebotsbestätigungen konkret. Eine Veröffentlichung wird separat entschieden.

**Beginne mit der Bestandsprüfung und setze anschließend die endgültige Landingpage vollständig um.**
