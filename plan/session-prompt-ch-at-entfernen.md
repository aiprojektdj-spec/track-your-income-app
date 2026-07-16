# Prompt für neue Session (copy-paste) — W2: Schweiz/Österreich aus Web 1.7 entfernen

---

Kontext: Web 1.7 soll vorerst NUR das deutsche Steuersystem anbieten (Scope-Reduktion vor
Launch). Die CH/AT-Module (`js/schweiz.js`, `js/oesterreich.js`, `js/svs.js` — falls
AT-spezifisch) bleiben im Code erhalten (NICHT löschen, nur deaktivieren/ausblenden), damit
"Local 1.7" (die parallele Variante, siehe Memory `stackr-project-layout.md`) sie behalten
kann. Nur in Web 1.7 (diesem Repo) entfernen — Local 1.7 NICHT anfassen, das ist ein anderer
Ordner/Repo.

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im selben Ordner. Vor jedem
Edit die Datei frisch lesen; nur eigene Dateien stagen, nie fremde uncommittete Änderungen
mitcommitten. Nicht deployen — das macht der User.

## Aufgaben

1. Finde alle CH/AT-Einstiegspunkte:
   - Länder-Auswahl bei Firma-Anlage (`js/companies.js`)
   - Menüpunkte/Nav-Einträge (`js/topnav.js`, `js/page-shell.js` — falls vorhanden, sonst grep
     nach Navigation-Rendering)
   - Badges/Hinweise in `js/dashboard.js`, `js/euer.js`, `js/ustvoranmeldung.js`,
     `js/vorsteuer.js`, `js/oss.js`
   - Referenzen in `index.html` / `app.html`
   - `grep -rniE "schweiz|oesterreich|österreich|'CH'|'AT'"` über `js/` und `*.html`, um nichts
     zu übersehen.

2. Entferne/verstecke (Feature-Flag oder simple Bedingung, KEIN Löschen der Dateien):
   - Land-Auswahl bei neuer Firma → nur noch Deutschland wählbar (kein CH/AT-Radio/Dropdown
     im Onboarding-Wizard, `js/app.js`).
   - Alle CH/AT-spezifischen Menüpunkte, Badges, Info-Kästen im UI ausblenden.
   - Rechenlogik-Pfade, die CH/AT-Land prüfen, so absichern, dass sie in Web 1.7 nie erreicht
     werden (da eh keine CH/AT-Firma mehr anlegbar ist) — die Funktionen selbst NICHT löschen,
     nur den Zugang kappen.

3. Bestandsschutz prüfen: Falls in Produktion bereits echte CH/AT-Kunden existieren, darf
   deren bestehende Firma nicht kaputtgehen, nur weil Neuanlage gesperrt ist. Vor hartem
   Sperren kurz mit dem User klären, ob es aktuell schon CH/AT-Bestandskunden gibt (Stand
   2026-07-16: unklar, im Zweifel nachfragen statt raten).

4. Browser-Smoke (Edge-Browser, siehe Memory `feedback-browser-edge.md`): Neue Firma anlegen
   → nur Deutschland wählbar; alle DE-Flows (EÜR, UVA, Rechnungen) unverändert
   funktionsfähig.

## Akzeptanz

CH/AT in Web 1.7 UI nicht mehr erreichbar, Local 1.7 unangetastet, DE-Flow verifiziert,
committet mit klarer Message ("Web 1.7: CH/AT vorerst deaktiviert, Local 1.7 unberührt").
