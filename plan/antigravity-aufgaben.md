# Aufgaben für Antigravity (Stand 2026-11-26)

Vorher [`GEMINI.md`](../GEMINI.md) und [`CLAUDE.md`](../CLAUDE.md) lesen. Alle Aufgaben sind
so geschnitten, dass sie nichts Produktives kaputt machen können: die meisten sind **reine
Berichte**. Ergebnis jeweils als `plan/antigravity/<nr>-<thema>.md`. Nichts committen, nichts
löschen, `js/app.js`, `js/store.js`, `js/lager.js` nicht ändern.

---

### A1 · Kaputte interne Links finden (Bericht)
Alle `*.html` im Root und in `rechnungen/`, `lager/`, `eigenbelege/`, `admin/` durchgehen:
`href`/`src` auf lokale Dateien, die nicht existieren, und Anker (`#id`), die es auf der
Zielseite nicht gibt. Ergebnis: Tabelle Datei · Zeile · Ziel · Problem.

### A2 · SEO-Grundcheck der öffentlichen Seiten (Bericht)
Für jede öffentliche Seite (Landing, Ratgeber wie `euer-software.html`,
`kleinunternehmergrenze-2026-2027.html`, Rechtstexte): `<title>`, Meta-Description (Länge),
Canonical, `og:*`, genau eine `<h1>`, Eintrag in `sitemap.xml`, `robots.txt`-Regel.
Konzeptseiten `stackr-entwurf-*`, `stackr-fokus-*`, `ui-lab.html` gesondert auflisten mit der
Frage, ob sie `noindex` haben.

### A3 · Jahresfeste Gesetzeswerte aufspüren (Bericht)
Regel 7 aus CLAUDE.md: Gesetzeswerte gehören in Jahresfunktionen. In `js/` nach festen Zahlen
suchen, die nach Steuerwert aussehen (Grenzen, Pauschalen, km-Sätze, AfA-Grenzen, Prozent-
sätze außerhalb von 19/7). Je Fund: Datei:Zeile, Wert, vermutete Rechtsgrundlage, ob es schon
eine `_get…(year)`-Funktion gibt. **Keine Werte ändern** — Steuerlogik entscheidet der User.

### A4 · Testlücken-Liste (Bericht)
Welche Dateien in `js/` enthalten Rechenlogik (Summen, Rundung, Steuer, Datum) und haben
keinen Harness in `test/`? Je Modul: wichtigste ungetestete Funktion und ob sie überhaupt
von außen erreichbar ist (oder in einem Event-Handler „wohnt“).

### A5 · Barrierefreiheit-Stichprobe (Bericht)
`app.html`, `index.html`, `rechnungen/`, `lager/`: Bilder ohne `alt`, Buttons/Links ohne
zugänglichen Namen, Formularfelder ohne Label (Hinweis: Labels werden teils zur Laufzeit per
`Utils.linkOrphanLabels()` verknüpft — das berücksichtigen), Fokus-Reihenfolge in Modals.

### A6 · Vendor-Integrität prüfen (Bericht)
SHA-256 aller Dateien in `js/vendor/` berechnen und mit `js/vendor/VERSIONS.md` vergleichen.
Zusätzlich: Wird irgendwo ein Script von einem CDN ohne `integrity`-Attribut geladen?

### A7 · Aufräum-Vorschlag Root-Ordner (Bericht, nichts löschen)
Im Root liegen viele Design-Entwürfe (`stackr-*.html`, `css/stackr-*.css`, `js/stackr-*.js`,
`assets/stackr-concepts/`). Liste: welche sind von produktiven Seiten verlinkt, welche nicht,
welche sind nur lokal (`git status` = untracked). Vorschlag, was nach `docs/entwuerfe/`
könnte. Entscheidung trifft der User.

### A8 · Doku-Drift CLAUDE.md (Bericht)
CLAUDE.md sagt „7 Serverless-Endpunkte“. Tatsächliche Zahl der Endpunkte in `api/` (ohne
`_`-Helfer) zählen und alle Stellen in `CLAUDE.md`, `GEMINI.md`, `plan/00-STAND.md`,
`SPEC.md` auflisten, die eine veraltete Zahl nennen. Nicht selbst ändern — `CLAUDE.md` wird
gerade von einer anderen Session bearbeitet.
