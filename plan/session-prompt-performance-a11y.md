# Prompt für neue Session (copy-paste) — P2-2: Performance + Accessibility Audit

---

Kontext: Stackr ist eine lokal-first Buchhaltungs-App (kein Backend-Rendering, alles
Vanilla-JS + localStorage/IndexedDB). Vor breiterem Nutzerwachstum: Performance- und
A11y-Check auf Landing (`index.html`) UND App (`app.html` + Unterseiten), nicht nur
Landing — die App-Seiten sind deutlich schwerer.

Zentrale Dateien/Fakten aus dieser Recherche (2026-07-16), als Startpunkt, nicht als
vollständiger Befund:
- `js/app.js` (2938 Zeilen) + `js/store.js` (2868 Zeilen) sind die mit Abstand größten
  Bundles, ungebündelt/ungecompressed als einzelne `<script>`-Tags eingebunden.
- `app.html` lädt mehrere CDN-Ressourcen (`cdn.jsdelivr.net`: Tabler-Icons-Webfont,
  Notyf, Flatpickr, GSAP) — mit `preconnect`/`dns-prefetch` und SRI (`integrity=`)
  bereits vorbereitet, ApexCharts wird laut `js/dashboard.js` lazy nachgeladen
  (`_ensureApexCharts()`) statt beim Boot — guter Ansatz, prüfen ob konsequent überall so.
- Landing (`index.html`) hat KEINE `<img>`-Tags (rein CSS/SVG-basiert), self-hosted
  variable Fonts mit `preload` (`fonts/inter-var-latin.woff2`,
  `fonts/fraunces-var-latin.woff2`) — solide Basis, hier eher Feinschliff.
- `:focus-visible` ist in `css/style.css` (~Zeile 996) definiert — kein Skip-Link
  gefunden (`grep -n "skip-link"` liefert nichts in `index.html`/`css/style.css`).
- 14 Treffer für `aria-`/`alt=` auf `index.html` — Umfang nicht geprüft, ob ausreichend.

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im selben Ordner. Vor JEDEM
Edit die Datei frisch lesen; nur eigene Dateien stagen. Nicht deployen — das macht der User.

## 1. Performance — Landing (`index.html`)

- Lighthouse/PageSpeed-Messung im Preview (Performance-Score, LCP, CLS, INP als
  Baseline-Zahlen dokumentieren — P1-3 "Launch-Baseline messen" braucht die evtl. auch).
- Font-Loading gegenchecken: `font-display` korrekt gesetzt? Preload wirklich nur die
  tatsächlich above-the-fold genutzten Gewichte?
- Falls `landing-v2.html`/`deploy/*.html` (siehe `session-prompt-landing-seo.md`) noch
  relevant sind, dort denselben Check.

## 2. Performance — App (`app.html` + Module)

- Bundle-Größe: `js/app.js`/`js/store.js` real ausgeliefertes Gewicht messen (nicht nur
  Zeilenzahl). Prüfen ob Code-Splitting (z. B. GbR/Schweiz-Restmodule, Steuerberater-Modus)
  sinnvoll ohne größeren Umbau möglich ist, oder ob das YAGNI ist für eine App dieser
  Größe — nicht vorschnell ein Bundler-Setup einführen, wenn die App bewusst
  bundlerlos/Vanilla ist (Architekturentscheidung respektieren, siehe `vergleich-technisch`).
- CDN-Skripte in `app.html`: welche sind wirklich beim Boot nötig vs. lazy-ladbar wie
  ApexCharts? `defer`/`async` durchgehend korrekt gesetzt?
- LocalStorage/IndexedDB-Zugriffsmuster bei großen Datenmengen (viele Rechnungen/Belege)
  — gibt es synchrone Vollscans, die bei wachsenden Datenmengen spürbar würden? Stichprobe
  in `js/store.js`, nicht jede Funktion einzeln.
- Chart-Rendering (`js/dashboard.js`, ApexCharts): Re-Render-Häufigkeit prüfen (Memory
  `csp-haertung-fortschritt.md`/aktueller Commit `252c1cd` hat hier schon
  Legend/Jahresvergleich-Rerender gefixt — verifizieren ob noch weitere unnötige
  Re-Renders bestehen, nicht denselben Fix nochmal machen).

## 3. Accessibility — Landing

- Skip-Link zum Hauptinhalt ergänzen (aktuell keiner vorhanden).
- Kontrastprüfung (WCAG AA, 4.5:1 Normaltext / 3:1 Großtext) für das Dark+Emerald-Design
  (`stackr-ui-v2-design-brief` in Memory) — besonders Sekundärtext/Muted-Farben.
- Tastaturnavigation: alle interaktiven Elemente (CTA-Buttons, FAQ-Akkordeon falls
  vorhanden, Trial-Links) ohne Maus erreichbar + sichtbarer Fokus-Indikator.
- Formular-Labels (Login/Signup-Flow falls auf Landing vorhanden) korrekt mit `<label>`
  oder `aria-label` verknüpft.

## 4. Accessibility — App

- Screenreader-Tauglichkeit der Kernflows (Rechnung anlegen, Beleg erfassen) — Fokus auf
  die Formulare, nicht die komplette App auf einmal.
- Farbcodierte Status (bezahlt/offen/überfällig, GoBD festgeschrieben/offen) — zusätzlich
  zur Farbe auch Text/Icon vorhanden (nicht nur Farbe als einziges Signal)?
- Touch-Targets auf Mobile (≥44×44px) für Tabellen-Aktionen (siehe kürzlich gefixtes
  Warenpositionen-Scroll-Problem bei Eigenbelegen, Commit `ca6469f` — ähnliches Muster
  an anderen Tabellen prüfen).

## Abschluss

- Zahlen (Lighthouse-Scores, Bundle-Größen) VOR und ggf. NACH Fixes dokumentieren.
- Nur klar korrekte, risikoarme Fixes selbst umsetzen (Skip-Link, `font-display`,
  fehlende `aria-label`); bei größeren Architekturfragen (Code-Splitting, Bundler)
  nur dokumentieren + Empfehlung geben, nicht ungefragt umbauen.
- Ergebnis in `plan/offene-punkte-2026-07-15.md` unter P2-2 nachtragen.
- Nicht deployen — das macht der User.

---

**Modell-Empfehlung: Sonnet 5.** Grund: Audit + viele kleine, gut abgrenzbare Fixes über
mehrere Dateien, aber ohne tiefe Business-Logik-Verzahnung wie bei den USt-/Whop-Themen —
Opus wäre hier over-provisioned.
