# Prompt für neue Session (copy-paste) — Vollaudit-Funde Rechnungen+Eigenbelege fixen

---

Kontext: Am 2026-07-23 Vollaudit über 8 Dimensionen gelaufen (Rechenfehler/Security/Feature/UX/
A11y/UI/Datenschutz/QA), Ergebnisse in `plan/session-prompt-rechnung-eigenbeleg-vollaudit-2026-07-23.md`.
Diese Datei bündelt daraus **alle konkreten Fixes**, priorisiert, zum Abarbeiten. Separat existiert
`plan/session-prompt-rechnung-eigenbeleg-gobd-2026-07-23.md` (reiner GoBD/Steuerrecht-Fund,
ebenfalls noch offen, teilweise überlappend mit Fund 5 unten) — beide Dateien vor Start prüfen,
nicht doppelt fixen.

Vor Ausführung IMMER `git status --short` + `git log --oneline -10` frisch prüfen — parallele
Sessions im selben Ordner sind üblich in diesem Projekt.

## 🔴 Kritisch

**1. `rechnungen/js/wiederkehrend.js:50/55` — Company-Scoping-Leck bei wiederkehrenden Rechnungen**

`getRules()`/`saveRules()` nutzen den globalen (nicht firmen-präfixierten) Key
`rech_recurring_rules`. Folgen:
- Mandanten-Datenleck: aktive Firma B sieht in der Regel-Liste (`render()`, Z. 171-235) auch
  Beträge/Intervalle/Positionsdaten von Firma A.
- `processDueRules()` (aufgerufen bei jedem App-Boot, `app.js:63/264`) iteriert über ALLE Regeln
  unabhängig von der aktiven Firma und schreibt neue Rechnungen in den Kontext der gerade aktiven
  Firma → falscher Nummernkreis/USt-Zuordnung bei Multi-Firmen-Nutzern (Einzelunternehmen+GbR-Setup
  ist genau der reale Fall beim Nutzer, siehe `[[steueragent-setup]]`).

Fix: Key-Schema wie bei Eigenbelegen umstellen (`_ebPrefix()`-Äquivalent, siehe
`eigenbeleg-company-scoping`-Fix von 2024), Migration für bestehende `rech_recurring_rules`-Daten
in die aktuell aktive Firma. `processDueRules()` danach nur noch über firmen-gescopte Regeln der
jeweils aktiven Firma laufen lassen.

**2. `rechnungen/js/wiederkehrend.js:9-21` `addInterval()` — Monatsend-Rollover-Bug**

`d.setMonth(d.getMonth()+n)`/`setFullYear` ohne Clamping. Beispiel: `nextDate="2026-01-31"`
monatlich → `setMonth(1)` überläuft (Februar hat 28 Tage) → Ergebnis 3. März statt 28. Februar,
danach bleibt das Datum dauerhaft auf "3." fixiert. Gleicher Bug jährlich bei Schaltjahr
(29.2. → 1.3., danach dauerhaft 1. März). Betrifft real Miet-/Abo-Regeln, die am Monatsende starten.

Fix: Nach `setMonth`/`setFullYear` auf Monatsend-Overflow prüfen (Ziel-Tag > Tage im Zielmonat) und
auf letzten Tag des Zielmonats clampen, nicht auf den Folgemonat überlaufen lassen.

**3. `rechnungen/js/mahnungen.js` — Verzugszinsen §288 BGB fehlen komplett**

Keine Zinsberechnung vorhanden, nur manuelle Fixgebühren (0/5/10 €, Z. 117). Gesamtbetrag in der
Mahnvorschau (Z. 229) enthält keine Zinsen.

Fix: Zinsformel ergänzen (Basiszinssatz + 9 Prozentpunkte B2B / + 5 Prozentpunkte B2C, tagesgenau
ab Verzugsbeginn), als eigene Zeile in Mahnvorschau/PDF ausweisen, aktuellen Basiszinssatz
konfigurierbar halten (ändert sich halbjährlich).

## 🟠 Hoch

**4. `eigenbelege/js/app.js:1735-1742` `alleLoeschen()` — GoBD-Sperre wird bei Bulk-Löschen umgangen**

Kein `isBelegGesperrt()`-Check vor `EB.saveBelege([])`, im Gegensatz zur korrekten Einzel-Löschung
(`deleteBeleg`, Z. 1261-1271). Vernichtet auch GoBD-gesperrte Belege (§147 AO, laufende
10-Jahres-Frist) unwiderruflich. Überschneidet sich mit GoBD-Plan-Fund 1+2 (dort: Audit-Log fehlt
komplett) — beide zusammen fixen, gleicher Funktionsbereich.

Fix: Vor `EB.saveBelege([])` alle Belege gegen `isBelegGesperrt()` filtern, gesperrte Belege
behalten, nur ungesperrte löschen/stornieren, Toast mit Anzahl zurückgehaltener Belege.

**5. `eigenbelege/js/app.js:1209,1477` — ungeschütztes `zahlungswegSonstig` (XSS)**

Detail-Modal (`viewBeleg`, Z. 1209) und PDF-Druck (`printBeleg`, Z. 1477) interpolieren
`b.zahlungswegSonstig` ohne `esc()`, während dieselbe Variable in der Listenansicht (Z. 1112)
korrekt escaped ist. Aktuell kein UI-Eingabepfad dafür, aber bei Backup-Import/Cloud-Sync-Import
fremder/manipulierter JSON-Daten ausnutzbar (Payload läuft im App-Kontext, Zugriff auf
localStorage/Whop-Token).

Fix: `esc()` an beiden Stellen ergänzen (Copy-Paste-Fix, 5 Minuten).

**6. `js/store.js:2450-2461` `importAll` — Eigenbeleg-Import ohne Alt-Daten-Löschung**

Hauptdaten-Import löscht vor dem Restore explizit alle Keys der aktiven Firma ("Verhindert
Datenmix", Z. 2411-2420). Eigenbeleg-Keys (`eigenbelege_belege`, `eigenbelege_produkte`, …) werden
beim Import nur überschrieben, alte Werte bleiben falls im Backup nicht enthalten (zusätzlich lässt
`exportAll` leere Eigenbeleg-Keys weg, Z. 2336-2341). Import von Firma-B-Backup in Firma A kann
inkonsistenten Mischzustand erzeugen (Belege referenzieren nicht-existente Produkte).

Fix: Eigenbeleg-Keys der aktiven Firma vor dem Restore genauso löschen wie die Hauptdaten;
`exportAll` auch leere Eigenbeleg-Keys mit exportieren, damit ein Restore den Zielzustand
vollständig abbildet.

**7. `rechnungen/js/app.js:184` — veralteter Marken-Text im AGB-Modal-Duplikat**

Separater AGB-Modal-Text (unabhängig von `js/app.js:824`) nennt noch "Reselling Tool/
Rechnungsbuch" statt "Stackr", fehlt §7/§8 gegenüber der aktuellen Version. Zwei divergierende
AGB-Versionen im selben Produkt = Compliance-Risiko, tritt auf bei Direktaufruf `/rechnungen/` vor
erstem Hauptapp-Besuch.

Fix: Duplikat entfernen, zentrale AGB-Logik aus `js/app.js` referenzieren statt eigenem Text.

**8. `eigenbelege/index.html` — Cookie-Banner fehlt bei Direktaufruf**

Lädt `../js/cookie-banner.js` nicht (im Gegensatz zu `rechnungen/index.html`). Consent-Banner
fehlt komplett bei Direktaufruf von `/eigenbelege/` ohne vorherigen Hauptapp-Besuch.

Fix: Script-Tag ergänzen wie in `rechnungen/index.html`.

## 🟡 Mittel

**9. Teilzahlung/Ratenzahlung fehlt komplett im Rechnungsmodul**

Status-Enum kennt nur offen/bezahlt/ueberfaellig/storniert, kein Teilbetrag-Feld. Feature-Lücke
ggü. sevDesk (Anzahlung + Rest bei Projektgeschäft). Größerer Scope — Status-Enum, Zahlungs-Erfassung
(`showBezahltModal`), Anzeige in Dokumente/Dashboard betroffen.

**10. Modals ohne Fokus-Trap/ARIA/ESC in beiden Sub-Apps**

`eigenbelege/js/app.js:1754` (`openModal`/`closeModal`), `rechnungen/js/app.js:124-150`
(`RechApp.showModal`): kein `role="dialog"`, `aria-modal`, initialer Fokus, Tab-Trap, ESC-Handler.
Haupt-App-Modal (`js/app.js:390-414,739-741`) hat das bereits korrekt — als Vorlage nutzen.

**11. Labels systemweit ohne `for`/`id`-Verknüpfung**

33× in `eigenbelege/js/app.js`, 97× in `rechnungen/js/*.js` — `<label>` ohne `for=`. WCAG
1.3.1/3.3.2, Screenreader-Nutzer können Felder nicht per Label-Klick fokussieren.

**12. Versand-Status wird nicht automatisch gesetzt**

`dokumente.js:362-398` — separate Checkbox nach PDF/E-Mail-Öffnen nötig, leicht vergessen. Status
bleibt fälschlich "Offen" trotz echtem Versand.

**13. Mahnungen-„Als bezahlt" umgeht Lager-Sync-Modal**

`.mahn-paid` (`mahnungen.js:321-333`) setzt Status direkt, ohne `showBezahltModal`
(Lager-/Verkaufs-Sync), das der reguläre Dokumente-Bezahlt-Pfad nutzt. Aus Mahnungen bezahlte
Rechnungen synchen Lagerartikel nicht.

**14. Fälligkeitsdatum wird auch bei Lieferdatum-Modus gesetzt**

`rechnung.js` speichert immer ein Default-Fälligkeitsdatum (+14 Tage), auch wenn
`datumsOption='lieferdatum'/'lieferzeitraum'` gewählt wurde. `mahnungen.js:49` prüft
`faelligkeit < today` unabhängig davon → false-positive "überfällig".

**15. Angebot→Rechnung keine 1-Klick-Konvertierung**

Eigenständiges Angebots-Modul vorhanden, aber keine Funktion, ein Angebot in eine Rechnung zu
überführen. Nutzer muss komplett neu anlegen.

**16. Touch-Targets <44px bei `.btn`/`.btn-sm` mobile**

`css/style.css:2540` (`.btn-sm`, kein `min-height`) und Basis-`.btn` (Z. 858-870). `.btn-icon`/
`.btn-small` sind bereits korrekt auf 44px (Referenzmuster, gleiches Pattern wie persona-cta-Fix).

**17. Kontrast `--text-muted` unter AA**

`css/style.css:35,67` — `#71807a` auf `#161a18` ≈4.25:1, unter AA-Minimum 4.5:1. Betrifft
Footer-Links Impressum/Datenschutz, diverse Formular-Hinweistexte.

## 🟢 Niedrig

**18.** Rundungs-Inkonsistenz Positionssumme vs. Gesamtsumme (`rechnung.js:541-548,1203-1219`) —
Positionssumme wird ungerundet akkumuliert, Zeilen einzeln gerundet angezeigt, Cent-Abweichung bei
Bruchteil-Cent-Werten möglich.

**19.** `rechnung.js:516` — Position mit leerer Beschreibung + 0€-Preis wird beim Speichern still
verworfen, keine Warnung.

**20.** Mahnfristen (14/10/7 Tage) sind hartcodierte Textstrings, keine echte Berechnung/Speicherung.

**21.** Fail-Open beim Whop-Gate: `rechnungen/js/app.js:340-343`, `eigenbelege/js/app.js:1844-1846`
booten ohne Gate, falls `AuthUI` undefiniert ist (Script-Ladefehler).

**22.** Kein Kunden-Such-Autocomplete (`kunden.js:134-140`, reines `<select>`), kein
"Rechnung duplizieren".

**23.** Tabellen ohne `scope="col"` in `kunden.js`, `dokumente.js`, `mahnungen.js`, `produkte.js`,
`rechnung.js`.

**24.** Doppelter Mobile-Menü-Button in Rechnungen (Legacy `#mobileMenuBtn`-Handler läuft parallel
zum globalen Sidebar-Toggle).

**25.** PDF-Seitenumbruch ungesichert (kein `page-break-inside:avoid`), Kopfbereich wiederholt sich
nicht auf Folgeseiten bei langen Positionslisten.

**26.** Unescapte Mengenangabe im Eigenbeleg-Druck (`app.js:1343,1177`) — UI-seitig durch
`type="number"` entschärft, nicht clientseitig bei Import-Schreibpfaden abgesichert.

**27.** Icon-Button ohne `aria-label` ("Filter zurücksetzen", `eigenbelege/js/app.js:1053`, nur `title`).

**28.** Keine Vor-Fälligkeits-Zahlungserinnerung (nur Mahnwesen nach Fälligkeit) — auch bei
Konkurrenz kein Kernstandard, geringe Priorität.

**29.** Eigenbeleg-Formularvalidierung inkonsistent (native HTML5-Popups statt App-Toast-Stil).

## Bereits sauber (keine Änderung nötig)

- Whop-Gate-Wiring in beiden Standalone-Seiten intakt (`AuthUI.boot()`).
- Rechnungs-Branding (Logo/Farben) bereits vorhanden (`unternehmensdaten.js:178-231`).
- XSS-Escaping sonst durchgängig sauber (Rechnung, Eigenbeleg-Liste, E-Rechnung-Import).
- Cloud-Sync E2E-verschlüsselt, Kundendaten-Löschung respektiert Aufbewahrungspflicht korrekt.
- Sonderzeichen in Kundennamen bei PDF-Export: unkritisch, durchgängig escaped.

## Reihenfolge-Empfehlung

1. **Fund 1+2** (wiederkehrend.js: Company-Scoping + Monatsend-Bug) — gleiche Datei, größtes
   Datenintegritäts-/Mandantentrennungs-Risiko.
2. **Fund 4** zusammen mit GoBD-Plan-Fund 1+2 (`eigenbelege/js/app.js` Audit-Log + Storno-Pattern +
   `alleLoeschen()`-Sperre) — überschneidender Scope, in einem Rutsch fixen.
3. **Fund 3, 5, 6, 7, 8** (Verzugszinsen, XSS-Fix, Import-Datenmix, AGB-Duplikat, Cookie-Banner) —
   je klein und unabhängig, opportunistisch abarbeiten.
4. **Fund 9-17** (Mittel: Teilzahlung, A11y, UX-Inkonsistenzen) — nach Kapazität, kein Zeitdruck.
5. **Fund 18-29** (Niedrig) — bei Gelegenheit.

Nach Fund 1+2: Browser-Smoketest — wiederkehrende Regel am 31. eines Monats anlegen, mehrere
Intervall-Durchläufe simulieren, prüfen ob Datum korrekt auf Monatsende bleibt statt zu wandern.
Firmenwechsel testen, prüfen ob Regel-Liste nur noch firmen-eigene Regeln zeigt.
