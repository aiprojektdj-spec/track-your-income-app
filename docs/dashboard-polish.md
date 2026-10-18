# Dashboard-Überarbeitung

Ausgangspunkt: `redesign-live` (`95d2d25`). Umsetzung im Branch `codex/dashboard-polish`.
Am 8. Oktober 2026 vor der Veröffentlichung auf Produktionsstand `41a91d7` aktualisiert.

- Kennzahlen in einer gemeinsamen ruhigen Fläche; Jahresverlauf direkt sichtbar.
- Einnahmen/Ausgaben und EÜR-Jahresvergleich als gruppierte Balken. Gewinnverlauf als Linie mit dezenter Fläche.
- Gerundete Achsenschritte, feste Zeichenhöhen, ausgedünnte mobile Monatsbeschriftung und vollständig zugängliche Datentabellen.
- Kompakte Buchungstabelle mit Beschreibung, Typ und ausgerichtetem Betrag; mobil Datum/Typ unter der Beschreibung.
- Aufgaben neben den letzten Buchungen auf Desktop, untereinander auf kleinen Displays.
- ApexCharts-Basis- und Legenden-CSS extern eingebunden. Ein dokumentierter Vendor-Guard verhindert die zusätzliche Inline-Injektion bei vorhandenem Stylesheet. Die CSP bleibt unverändert.

## Lokale Prüfung

`node scripts/csp-preview-server.js 4365` startet die Vorschau mit den CSP-Headern aus `vercel.json`.
`/output/playwright/dashboard-preview.html` verwendet echte Dashboard- und Formatierungsmodule mit ausschließlich fiktiven Fixtures, ohne Authentifizierungs- oder Speicherzugriffe.
Query-Parameter: `scenario=sparse|populated|negative|large|empty`, `theme=light|dark`, `readonly`.
Die Vorschau und Screenshots unter `output/` sind über `.vercelignore` vom Deployment ausgeschlossen.

Browserprüfungen: `output/playwright/check-dashboard.cjs` und `check-dashboard-final.cjs` über Playwright CLI `run-code --filename`.
Geprüft wurden 320–1440 px, beide Themes, wenige/viele/keine Buchungen, große Beträge, Verluste, Jahreswechsel, Lesezugang, zwölf Monatszeilen, Tooltips und CSP-Konsole.

Bestehende Tests bestanden: `test-gewinn-eine-quelle.js` (46 Checks), `test-redesign-navigation.js`, `test-redesign-bookings.js`, `test-redesign-settings.js`, `test-redesign-onboarding.js` (10 Checks). JS-Syntax und `git diff --check` geprüft.

Am 8. Oktober 2026 zusätzlich alle 94 Node-Harnesses aus `test/` auf dem aktualisierten Stand bestanden (`npm ci`, anschließend `node test/*.js` einzeln). Der unabhängige Review von CSS-Extraktion, CSP-Guard, Lade-Reihenfolge und Initialisierung fand keine Produktionsblocker.

Die Berechnungsgrundlagen bleiben erhalten: betriebliche Übersicht und steuerliche EÜR sind weiterhin als unterschiedliche Grundlagen beschriftet. Veröffentlichung vom Nutzer am 8. Oktober 2026 beauftragt.
