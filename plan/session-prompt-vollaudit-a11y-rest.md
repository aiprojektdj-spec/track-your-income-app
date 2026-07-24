# Prompt für neue Session (copy-paste) — Vollaudit-Rest: Accessibility (Modals, Labels, Touch-Targets, Kontrast)

---

Kontext: Vollaudit vom 2026-07-23 (`plan/session-prompt-rechnung-eigenbeleg-vollaudit-fixes-2026-07-23.md`,
Fund 10, 11, 16, 17). Alle vier sind Accessibility-Funde in Rechnungen/Eigenbelege, hier gebündelt.

## ⚠️ Vor Start prüfen: möglicherweise schon in Arbeit

Stand 2026-07-24 lagen im Arbeitsverzeichnis 8 uncommittete Dateien (`css/style.css`,
`eigenbelege/js/app.js`, `eigenbelege/index.html`, `rechnungen/js/app.js`,
`rechnungen/js/dokumente.js`, `rechnungen/js/mahnungen.js`, `rechnungen/js/rechnung.js`,
`rechnungen/index.html`) mit Label-`for=`/`id`-Verknüpfungen und `id="modalTitle"` an Modals —
sieht nach Fund 11 (und teilweise 10) aus, vermutlich von einer parallelen Session.
**Zwingend zuerst `git status --short` + `git diff --stat` prüfen** und den aktuellen Stand dieser
Datei gegen die Funde unten abgleichen, bevor doppelt gearbeitet wird.

## Fund 10: Modals ohne Fokus-Trap/ARIA/ESC in beiden Sub-Apps

`eigenbelege/js/app.js:1754` (`openModal`/`closeModal`), `rechnungen/js/app.js:124-150`
(`RechApp.showModal`): kein `role="dialog"`, `aria-modal`, initialer Fokus, Tab-Trap, ESC-Handler.

Haupt-App-Modal (`js/app.js:390-414,739-741`) hat das bereits korrekt — als Vorlage nutzen.

Fix: `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (verweist auf Modal-Titel-Element)
ergänzen, initialen Fokus auf erstes fokussierbares Element setzen, Tab-Taste innerhalb des Modals
einfangen (Fokus-Trap), ESC schließt das Modal — 1:1 nach dem Muster aus `js/app.js`.

## Fund 11: Labels systemweit ohne `for`/`id`-Verknüpfung

33× in `eigenbelege/js/app.js`, 97× in `rechnungen/js/*.js` — `<label>` ohne `for=`. WCAG
1.3.1/3.3.2, Screenreader-Nutzer können Felder nicht per Label-Klick fokussieren.

Fix: mechanisch — jedes `<label>` bekommt `for="<eindeutige-id>"`, zugehöriges Input/Select/
Textarea bekommt passende `id`. Bei generierten Listen (z.B. Positionszeilen) IDs mit Index
eindeutig machen (`pos_${i}_menge` statt `pos_menge`).

## Fund 16: Touch-Targets <44px bei `.btn`/`.btn-sm` mobile

`css/style.css:2540` (`.btn-sm`, kein `min-height`) und Basis-`.btn` (Z. 858-870). `.btn-icon`/
`.btn-small` sind bereits korrekt auf 44px (Referenzmuster, gleiches Pattern wie
`[[persona-cta-touch-target]]`-Fix — als Vorlage nutzen).

Fix: `min-height: 44px` (bzw. äquivalentes Padding) auf `.btn`/`.btn-sm` ergänzen, nur in
Mobile-Breakpoints falls Desktop-Layout dadurch zu klobig würde.

## Fund 17: Kontrast `--text-muted` unter AA

`css/style.css:35,67` — `#71807a` auf `#161a18` ≈4.25:1, unter AA-Minimum 4.5:1. Betrifft
Footer-Links Impressum/Datenschutz, diverse Formular-Hinweistexte.

Fix: Farbwert leicht aufhellen bis ≥4.5:1 Kontrastverhältnis erreicht ist (Kontrast-Checker nutzen),
in beiden Theme-Varianten (falls Light/Dark getrennte Werte existieren) prüfen.

## Akzeptanzkriterien

- Modal in Rechnungen/Eigenbelege: Tab bleibt innerhalb des Modals, ESC schließt, Screenreader
  kündigt Titel beim Öffnen an.
- Stichprobe Screenreader/Tastatur: Label-Klick fokussiert zugehöriges Feld in beiden Sub-Apps.
- Mobile-Ansicht: `.btn`/`.btn-sm` real antippbar (≥44×44px), kein visueller Bruch auf Desktop.
- Kontrast-Checker bestätigt ≥4.5:1 für `--text-muted` auf den betroffenen Hintergründen.

Nach Fertigstellung: `/accessibility`-Skill erneut laufen lassen zur Bestätigung, dass die vier
Funde behoben sind.
