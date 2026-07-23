# Prompt für neue Session (copy-paste) — Vollaudit Rechnungen + Eigenbelege: Lücken-Sweep über alle Dimensionen

---

Kontext: Am 2026-07-23 bereits ein reiner **GoBD/Steuerrecht**-Audit über `rechnungen/js/*` und
`eigenbelege/js/app.js` gelaufen (`legal-reviewer` + `general-purpose`, Ergebnis in
`plan/session-prompt-rechnung-eigenbeleg-gobd-2026-07-23.md`) — noch NICHT gefixt. Diese Datei
erweitert den Scope auf **alle** Arten von Lücken (nicht nur Steuerrecht): Rechenfehler, Security,
Feature-Vollständigkeit, UX, Accessibility, Datenschutz, UI-Bugs, Datenintegrität. Reine
Planung — vor Ausführung `git status --short` + `git log --oneline -10` prüfen (parallele
Sessions im selben Ordner üblich, siehe GoBD-Plan-Datei).

Jede Dimension unten nennt das richtige Werkzeug (Skill via `Skill`-Tool oder Agent via
`Agent`-Tool mit `subagent_type`), den Datei-Scope und Leitfragen, damit die Agenten nicht generisch
antworten, sondern konkret auf Rechnungen/Eigenbelege zielen. Dimensionen 2, 3, 6, 7, 8, 9 sind rein
lesend und unabhängig voneinander → können als **ein Agent-Batch parallel** gestartet werden
(mehrere `Agent`-Aufrufe in derselben Response). Dimension 4+5 sind eher strategisch, danach separat.
Dimension 1 ist bereits erledigt und nur verlinkt, nicht erneut laufen lassen.

## 1. GoBD/Steuerrecht — bereits erledigt, nur verlinken

Ergebnis + Fix-Plan: `plan/session-prompt-rechnung-eigenbeleg-gobd-2026-07-23.md`. Nicht erneut
auditieren, aber vor den anderen Dimensionen kurz gegenlesen (Audit-Log-Lücke bei Eigenbelegen
betrifft ggf. auch Dimension 9 Datenintegrität).

## Status (2026-07-23) — alle 8 Dimensionen (2-9) durchgelaufen

Priorisierte Top-Funde über alle Dimensionen (Details je unten unter Dimension):

- 🔴 **KRITISCH** Dim3: `rechnungen/js/wiederkehrend.js:50/55` — Key `rech_recurring_rules` nicht company-präfixiert → Mandanten-Datenleck + falsche Rechnungserstellung/Nummernkreis bei Multi-Firmen-Nutzern.
- 🔴 **HOCH** Dim2: `wiederkehrend.js:9-21` `addInterval()` — Monatsend-Rollover-Bug (31.1. → 3.3. statt 28.2., bleibt dauerhaft verschoben).
- 🔴 **HOCH** Dim2: `mahnungen.js` — Verzugszinsen §288 BGB fehlen komplett (nur Fixgebühren).
- 🟠 **HOCH** Dim3: `eigenbelege/js/app.js:1209,1477` — `zahlungswegSonstig` ungeschützt (XSS), Copy-Paste-Fehler ggü. sonst konsequentem Escaping.
- 🟠 Dim8: `eigenbelege/js/app.js:1735` `alleLoeschen()` — kein `isBelegGesperrt()`-Check, Bulk-Löschen killt GoBD-gesperrte Belege (§147 AO).
- 🟠 Dim9: Eigenbeleg-Import (`js/store.js:2450-2461`) löscht Keys vor Restore nicht → Datenmix zwischen Firmen möglich.
- 🟡 Dim4: Teilzahlung/Ratenzahlung fehlt komplett im Rechnungsmodul.
- 🟡 Dim6: Modals in beiden Sub-Apps ohne Fokus-Trap/ARIA/ESC (Haupt-App hat's, Sub-Apps nicht nachgezogen); Labels systemweit ohne `for`/`id`.
- 🟡 Dim7: `eigenbelege/index.html` lädt `cookie-banner.js` nicht → Consent-Banner fehlt bei Direktaufruf; alter Marken-Text "Reselling Tool" in AGB-Modal-Duplikat.
- 🟡 Dim5: Versand-Status manuell statt automatisch; Mahnungen-„bezahlt" umgeht Lager-Sync-Modal.
- 🟡 Dim2: Fälligkeitsdatum wird auch bei Lieferdatum-Modus gesetzt → false-positive „überfällig".
- 🟢 Dim2: Rundungs-Inkonsistenz Positionssumme vs. Gesamtsumme (Cent-Ebene, GoBD-Belegkonsistenz).
- 🟢 Dim4: Angebot→Rechnung keine 1-Klick-Konvertierung; keine Vor-Fälligkeits-Erinnerung.
- Sonstige Einzelfunde (niedrig): Touch-Targets <44px bei `.btn`/`.btn-sm`, Kontrast `--text-muted` 4.25:1, Tabellen ohne `scope`, doppelter Mobile-Menü-Button in Rechnungen, PDF-Seitenumbruch ungesichert, unescapte Menge im Eigenbeleg-Druck, Fail-Open Whop-Gate bei AuthUI-Ladefehler.

Noch nicht gefixt — nächster Schritt: Fix-Reihenfolge nach Schweregrad (kritisch/hoch zuerst), dann Fix-Plan-Datei analog GoBD-Plan anlegen falls gewünscht.

## 2. Korrektheit/Rechenfehler

**Werkzeug:** `Agent` mit `subagent_type: fn-checker`.

**Scope:** `rechnungen/js/rechnung.js` (Rechnungssumme/Steuerberechnung/Rundung), `rechnungen/js/mahnungen.js`
(Fristenberechnung), `rechnungen/js/wiederkehrend.js` (Intervall-/Datumslogik), `eigenbelege/js/app.js`
(MwSt-Berechnung, Nummernvergabe).

**Leitfragen:** Rundungsfehler bei Netto→Brutto-Umrechnung pro Position vs. Summenbildung
(Cent-Abweichung durch Rundung je Zeile statt am Ende)? Verzugszinsen-Formel in `mahnungen.js`
korrekt (Basiszinssatz + 9 Prozentpunkte B2B / 5 Prozentpunkte B2C, §288 BGB)? Mahnfristen-
Berechnung inkl. Wochenenden/Feiertage oder nur Kalendertage? Wiederkehrende Rechnung an
Monatsenden (29./30./31., Schaltjahr-Februar) — überspringt/verschiebt sie korrekt? Storno-
Rechnung: negative Positionen korrekt gegen Original gerechnet, keine Rundungsdifferenz zwischen
Original und Storno?

**Ergebnis (2026-07-23, fn-checker):**
1. 🟢 Rundungsfehler bestätigt: `rechnung.js:541-548`/`1203-1219` — Positionssumme wird ungerundet akkumuliert, Zeilen aber einzeln gerundet angezeigt → Cent-Abweichung möglich bei Bruchteil-Cent-Werten.
2. 🔴 HOCH: Verzugszinsen §288 BGB fehlen komplett in `mahnungen.js` — nur manuelle Fixgebühren (0/5/10€), kein Zinssatz. Entgangener gesetzlicher Anspruch.
3. 🟡 Mahnfristen (14/10/7 Tage) sind hartcodierte Textstrings, keine echte Berechnung. Zusatzfund: `#invFaelligkeit` wird auch bei `datumsOption='lieferdatum'/'lieferzeitraum'` gespeichert/geprüft → false-positive „überfällig" in `mahnungen.js:49`.
4. 🔴 HOCH: `wiederkehrend.js:9-21` `addInterval()` — `setMonth`/`setFullYear` ohne Clamping. 31.1. monatlich → springt auf 3.3. statt 28.2., bleibt danach dauerhaft verschoben. Gleicher Bug bei jährlich + Schaltjahr (29.2. → 1.3., fixiert). Betrifft Miet-/Abo-Regeln.
5. 🟢 Storno: reine Vorzeichen-Negation, keine Rundungsdifferenz. Risiko (nicht verifiziert): bei §25a-Positionen bleibt `einkaufspreis` positiv während `einzelpreis` negativ wird → mögliche falsche Marge in nachgelagerter Berechnung.

## 3. Security

**Werkzeug:** `Skill` mit `skill: security-stackr`.

**Scope:** `rechnungen/index.html`, `eigenbelege/index.html` (Whop-Gate-Wiring — Regressionscheck
seit Fix `[[whop-gate-standalone-pages]]` 2026-07-04), alle `innerHTML`-Stellen in
`rechnungen/js/*` und `eigenbelege/js/app.js` mit Kunden-/Belegtext-Interpolation (XSS via
Kundenname, Notizfeld, Rechnungsposition-Freitext), PDF-Generierung (Injection über Freitext in
generierte PDF-Inhalte?), localStorage-Company-Scoping erneut (Regression seit
`[[eigenbeleg-company-scoping]]`-Fix, v.a. wenn seither neue Felder/Keys hinzugekommen sind).

**Ergebnis (2026-07-23, security-stackr):**
1. 🟡 Whop-Gate intakt (`AuthUI.boot()` in beiden Standalone-Seiten), aber Fail-Open falls `AuthUI` undefiniert (Script-Ladefehler) → Gate entfällt komplett. Fix ~15 Min.
2. 🟠 HOCH XSS: `eigenbelege/js/app.js:1209` (Detail-Modal) + `:1477` (PDF-Druck) — `zahlungswegSonstig` ungeschützt interpoliert, während dieselbe Variable in der Liste (`:1112`) korrekt escaped ist. Aktuell kein UI-Eingabepfad, aber bei Backup-Import/Cloud-Sync-Import fremder JSON-Daten ausnutzbar (Payload läuft im App-Kontext, Zugriff auf localStorage/Whop-Token). Fix ~5 Min.
3. 🟢 PDF-Generierung sonst durchgängig escaped (Rechnung, Eigenbeleg, E-Rechnung-Import).
4. 🔴 KRITISCH: `rechnungen/js/wiederkehrend.js:50/55` — Key `rech_recurring_rules` NICHT company-präfixiert (im Gegensatz zu allen Eigenbeleg-Keys). Folgen: (a) Mandanten-Datenleck — Firma B sieht Regeln/Beträge/Positionen von Firma A; (b) `processDueRules()` läuft bei jedem Boot über ALLE Regeln unabhängig von aktiver Firma → wiederkehrende Rechnung kann unter falscher Firma mit falschem Nummernkreis/USt-Zuordnung erzeugt werden. Gleicher Bugtyp wie der 2024 gefixte `oyi_eb_migrated_v1`-Fall, hier nie behoben. Fix ~1-2h inkl. Migration.

## 4. Feature-Vollständigkeit vs. Konkurrenz

**Werkzeug:** `Skill` mit `skill: vergleich-buchhaltung`, ergänzend `Skill` mit `skill: feature-gap`.

**Scope:** Rechnungsmodul komplett (Mahnwesen, wiederkehrende Rechnungen, E-Rechnung sind schon
da). Leitfragen: Teilzahlungen/Ratenzahlung auf eine Rechnung abbildbar? Rechnungs-Layout/Branding
anpassbar (Logo, Farbe)? Angebot→Rechnung-Konvertierung vorhanden? Automatisierte
Zahlungserinnerung vor Fälligkeit (nicht nur Mahnung danach)?

**Ergebnis (2026-07-23, vergleich-buchhaltung + feature-gap):**
1. 🔴 KRITISCH: Teilzahlung/Ratenzahlung fehlt komplett — Status-Enum kennt nur offen/bezahlt/ueberfaellig/storniert, kein `teilbezahlt`, kein Teilbetrag-Feld. sevDesk bildet das explizit ab.
2. 🟢 Branding (Logo+Farben) bereits vorhanden (`unternehmensdaten.js:178-231`) — kein Handlungsbedarf, ursprüngliche Annahme falsch.
3. 🟠 Angebot→Rechnung: kein 1-Klick-Konvertierung, Nutzer muss Rechnung komplett neu anlegen trotz eigenständigem Angebots-Modul.
4. 🟡 Keine Vor-Fälligkeits-Erinnerung (nur Mahnwesen nach Fälligkeit) — aber auch bei Konkurrenz kein Kernstandard, geringerer Druck.
Priorisierung: Teilzahlung → Angebot-Konvertierung → Vor-Fälligkeits-Erinnerung → Branding (erledigt).

## 5. UX/Journey

**Werkzeug:** `Skill` mit `skill: ux-journey`.

**Scope:** Flow „Rechnung erstellen" (Kunde anlegen → Position hinzufügen → Versand/Status),
Flow „Eigenbeleg erfassen", Mahnwesen-Flow. Leitfragen: fehlende Empty-States, unklare
Fehlermeldungen, zu viele Klicks für Standardfall (Rechnung an Bestandskunde).

**Ergebnis (2026-07-23, ux-journey):**
1. Versand-Status wird nicht automatisch gesetzt — separate Checkbox nach PDF/E-Mail-Öffnen, leicht vergessen (`dokumente.js:362-398`).
2. Mahnungen-„Als bezahlt" (`.mahn-paid`, `mahnungen.js:321-333`) umgeht das Lager-/Verkaufs-Sync-Modal (`showBezahltModal`), das der reguläre Dokumente-Bezahlt-Pfad nutzt — Inkonsistenz, Lagerartikel-Sync fehlt bei aus Mahnungen bezahlten Rechnungen.
3. Kunden-Dropdown reines `<select>` ohne Suche (`kunden.js:134-140`) — mühsam bei vielen Bestandskunden.
4. Kein "Rechnung duplizieren"/"letzte Rechnung an Kunden kopieren".
5. Eigenbeleg-Empty-State vorbildlich (Icon+Button); Rechnungen/Kunden-Empty-States nur Text ohne CTA.
6. Eigenbeleg-Formularvalidierung inkonsistent: nativer HTML5-Popup-Stil bricht optisches Muster (nur ein Fehler nutzt App-Toast).

## 6. Accessibility

**Werkzeug:** `Skill` mit `skill: accessibility`.

**Scope:** `rechnungen/index.html`, `eigenbelege/index.html` — Formulare, Tabellen, Modal-
Fokus-Trap, Farbkontraste, Touch-Targets (siehe `[[feedback-browser-edge]]`/frühere
Touch-Target-Fixes als Referenzmuster).

**Ergebnis (2026-07-23, accessibility):**
1. 🟠 HOCH: Labels systemweit ohne `for`/`id`-Verknüpfung (33× eigenbelege, 97× rechnungen) — WCAG 1.3.1/3.3.2, Screenreader-Fokus kaputt.
2. 🟠 HOCH: Modals ohne `role="dialog"`/`aria-modal`/Fokus-Trap/ESC in beiden Sub-Apps (`eigenbelege/js/app.js:1754`, `rechnungen/js/app.js:124-150`) — Haupt-App-Modal hat's bereits korrekt, Sub-Apps nicht nachgezogen. WCAG 2.4.3/4.1.2.
3. 🟡 Icon-Button ohne `aria-label` (nur `title`) — "Filter zurücksetzen" (`eigenbelege/js/app.js:1053`).
4. 🟡 Touch-Targets <44px bei `.btn`/`.btn-sm` mobile (`css/style.css:2540`, 858-870) — `.btn-icon`/`.btn-small` sind bereits korrekt, Basis-Buttons nicht.
5. 🟡 Tabellen ohne `scope="col"` (`kunden.js`, `dokumente.js`, `mahnungen.js`, `produkte.js`, `rechnung.js`).
6. 🟡 Kontrast `--text-muted` (#71807a) auf `--bg-card` ≈4.25:1, unter AA-Minimum 4.5:1 — betrifft Footer-Links Impressum/Datenschutz.

## 7. UI-Bugs

**Werkzeug:** `Skill` mit `skill: ui-checker`.

**Scope:** Beide Module inkl. aller Sub-Tabs (Dashboard, Kunden, Produkte, Mahnungen,
Wiederkehrend, Protokoll, Unternehmensdaten).

**Ergebnis (2026-07-23, ui-checker):**
1. 🟠 Recht/Branding: `rechnungen/js/app.js:184` — separater AGB-Modal-Text nennt noch alte Marke "Reselling Tool/Rechnungsbuch", schwächer als aktuelles AGB (`js/app.js:824`, fehlt §7/§8). 2 divergierende AGB-Versionen im Produkt = Compliance-Risiko.
2. 🟠 DSGVO: `eigenbelege/index.html` lädt `cookie-banner.js` gar nicht (rechnungen/index.html schon) → Consent-Banner fehlt bei Direktaufruf von /eigenbelege/.
3. 🟡 Doppelter Mobile-Menü-Button in Rechnungen (`#mobileMenuBtn` Legacy-Handler läuft parallel zum globalen Sidebar-Toggle) — eigenbelege hat nur den globalen Toggle.
4. 🟢 Stat-Card-Animation inkonsistent (Eigenbelege GSAP-Countup, Rechnungen statisch) — kosmetisch.
5. 🟢 Script-Ladereihenfolge page-shell.js vs. app.js zwischen Modulen vertauscht — aktuell unschädlich, Risiko bei künftigen Änderungen.
6. ✅ Whop-Gate + CSP korrekt in beiden Modulen; Kunden/Produkte sauber.

## 8. Datenschutz

**Werkzeug:** `Skill` mit `skill: datenschutz`.

**Scope:** Kundendaten in Rechnungen (Name/Adresse/E-Mail), Aufbewahrungspflicht (10 Jahre, §147
AO) vs. DSGVO-Löschpflicht-Konflikt (Aufbewahrungspflicht hat Vorrang — wird das im Code/den
Texten sauber dargestellt?), Übertragung von Rechnungs-/Eigenbelegdaten über Cloud-Sync
(`[[cloud-sync-backend]]`).

**Ergebnis (2026-07-23, datenschutz):**
1. ❌ Verstoß §147 AO/GoBD: `eigenbelege/js/app.js:1735-1742` `alleLoeschen()` prüft `isBelegGesperrt()` NICHT (Einzel-Löschung `deleteBeleg:1261-1271` macht's korrekt) → Bulk-Löschen vernichtet auch GoBD-gesperrte Belege innerhalb der 10-Jahres-Frist unwiderruflich.
2. ✅ Rechnungen unveränderbar (kein Lösch-Button, nur Storno), Kundenlöschung respektiert Aufbewahrungspflicht (Soft-Delete bei bestehenden Rechnungen), Kundendaten-Ausgabe konsequent escaped, Cloud-Sync E2E-verschlüsselt (Server sieht nur Chiffrat).
3. ⚠️ Nebenbefund (nicht Kernscope): CDN-Laden von ApexCharts/Notyf/Flatpickr/Tabler-Icons → IP-Übertragung an Drittanbieter, SRI vorhanden aber kein Self-Hosting.

## 9. QA/Datenintegrität

**Werkzeug:** `Skill` mit `skill: qa`.

**Scope:** Export/Import Rechnungen+Eigenbelege (Vorarbeit siehe GoBD-Plan Fund 1+2 zu
fehlendem Audit-Log), Edge Cases: 0€-Rechnung, negative/Null-Menge, Sonderzeichen in
Kundennamen bei PDF-Export, sehr lange Positionslisten (Seitenumbruch im PDF).

**Ergebnis (2026-07-23, qa):**
1. 🟡 `js/store.js:2450-2461` `importAll` — Eigenbeleg-Keys werden beim Restore nur überschrieben, NICHT vorher gelöscht (im Gegensatz zu Hauptdaten, die bewusst "Datenmix" verhindern). Zusätzlich lässt `exportAll` leere Eigenbeleg-Keys weg. Import von Firma-B-Backup in Firma A kann inkonsistenten Mischzustand erzeugen (Belege referenzieren nicht-existente Produkte).
2. 🟡 `rechnungen/js/rechnung.js:516` — Position mit leerer Beschreibung UND 0€-Preis wird beim Speichern still verworfen, keine Warnung (Guard greift nur wenn ALLE Positionen leer sind).
3. 🟢 PDF-Seitenumbruch ungesichert (kein `page-break-inside:avoid`), Kopfbereich wiederholt sich nicht auf Folgeseiten.
4. 🟢 Unescapte Mengenangabe im Eigenbeleg-Druck (`app.js:1343,1177`) — UI-seitig durch `type="number"` entschärft, aber nicht clientseitig abgesichert bei Import-Schreibpfaden.
5. ✅ Sonderzeichen in Kundennamen: unkritisch, durchgängig escaped.

## Ausführungshinweis

Nicht automatisch alle 8 Werkzeuge gleichzeitig ohne Rücksprache starten — das ist ein großer
Kontext-/Kosten-Block. Reihenfolge-Vorschlag beim Start dieser Session: zuerst 2+3 (Korrektheit +
Security, größtes Risiko), dann 6+7+8+9 als zweiter Parallel-Batch, 4+5 (strategisch) zuletzt und
nur falls gewünscht. Ergebnisse pro Dimension in dieser Datei unter der jeweiligen Überschrift
mit Datum ergänzen, damit der Fortschritt sichtbar bleibt (wie bei den anderen
`session-prompt-*`-Dateien mit Status-Abschnitt).
