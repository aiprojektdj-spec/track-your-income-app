# Cleanup & Refactor: Stackr effizienter, gleich sicher (03.10.2026)

## Quelle

[coltonholland.ai, 07.09.2026](https://www.instagram.com/reel/DdAWf5QNt5l/). Caption:
„Always review and refactor your work“ (#vibecoding #claudecode). Ohne Login war nur die
Caption lesbar, der gesprochene Teil nicht.

**Kernaussage:** KI-Code wächst schnell und bleibt dann liegen. Nach jedem Feature gehört ein
Review- und Refactor-Durchgang dazu.

**Abgrenzung:** Der Abgleich mit dem Reel „Vibe Coding ist eine Falle“ liegt in
`Desktop/CFC/REEL-VIBECODING_STACKR.md`. Dessen Punkte 2–5 (Plan-Ordner, Typcheck,
Riesendateien, toter Code) werden hier zu einem ausführbaren Plan mit konkreten Funden.
Sicherheit steht in [reels-sicherheit-2026-10-03.md](reels-sicherheit-2026-10-03.md).

## Ausgangslage (gemessen am 03.10., `master`, 11 Commits ahead)

| Kennzahl | Wert |
|---|---|
| JS-Module in `js/` | 58, zusammen **40.901 Zeilen** (ohne `vendor/`) |
| Größte Dateien | `app.js` 3.520 · `store.js` 3.438 · `css/style.css` 3.096 · `lager.js` 2.810 · `akademie.js` 2.419 |
| Unterseiten mit eigenem Code | `lager/page.js` 2.772 · `eigenbelege/js/app.js` 2.222 · `rechnungen/js/app.js` 457 |
| `js/vendor/` | 11 MB, davon 7,6 MB zwei Tesseract-Kerne (`lstm` und `simd-lstm`) |
| Diagramm-Bibliotheken | **zwei**: ApexCharts (Dashboard, EÜR, App) und Chart.js (nur `statistiken.js`) |
| Tests | 78 Node-Harnesses in `test/`, CI bei jedem Push |
| `plan/` | 93 Dateien, darunter 17 `session-prompt-audit-*` und 17 `funde-audit-*` |

## Leitplanken: „gleich sicher“

Der Cleanup ändert **kein Verhalten**. Zusätzlich zu den Regeln in `CLAUDE.md`:

1. **Nicht angefasst werden:** `api/` (Whop-Gate, `sync.js`, Webhooks), `js/whop-auth.js`,
   `js/cloud-sync.js` (Verschlüsselung), CSP in `vercel.json`, die Escape-Helfer aus
   `e85fda6`, `js/vendor/VERSIONS.md` samt SHA-256. Ein Fund dort wird notiert und separat
   behandelt.
2. **Ein Schritt = ein Commit**, pfad-gescoped (`git commit -F … -- <datei>`). Vor jedem
   Commit `git status`: Dateien, die eine andere Session hält, bleiben liegen. Zurzeit sind
   21 Dateien modifiziert (u. a. `index.html`, `buchungen.js`, `datev.js`). Diese erst nach
   deren Commit anfassen.
3. **Vor und nach jedem Schritt** die Test-Schleife aus `CLAUDE.md`, plus Browser-Test auf
   frischem Port für jede Seite, deren Code bewegt wurde.
4. **Nur löschen, was nachweislich unbenutzt ist.** Viele Store-Methoden werden aus
   HTML-Templates (`onclick="…"`) oder über zusammengesetzte Namen aufgerufen. Vor dem Löschen
   nach Teilstrings suchen (z. B. `Customer'`, `'save' +`), nicht nur nach dem vollen Namen.
5. **Keine neue Dependency** (Regel 6). Prüfwerkzeuge laufen per `npx` ohne Eintrag in
   `package.json`.

## Schritte

### 1. `plan/` ausmisten · 1–2 h · Priorität hoch · Risiko keins

Wie im Reel-Abgleich beschrieben: erledigte `session-prompt-*`, `funde-audit-*`,
`rest-offen-*`, `restliste-*`, `sessionbericht-*`, `uebergabe-*` nach `plan/archiv/`.
Im Hauptordner bleiben `00-STAND` bis `03-ARBEITSREGELN`, `OFFEN.md` und aktive Tagesdateien.
In `CLAUDE.md`: „`plan/archiv/` nie als Arbeitsgrundlage lesen.“

Das ist der Schritt mit dem größten Effekt pro Minute. Jede veraltete Plandatei ist eine
stille Annahme, die ein Agent übernimmt.

### 2. Toter Code · 2 h · Priorität hoch · Risiko niedrig

Funktionen, deren Name in allen getrackten `.js`/`.html` (ohne `vendor/`) **nur einmal**
vorkommt, also nur bei der Definition. **Kandidaten, jede einzeln prüfen (Leitplanke 4):**

| Datei | Kandidaten |
|---|---|
| `store.js` | `canDelete`, `deleteCustomer`, `deleteInvoice`, `deleteProduct`, `deleteRechCustomer`, `deleteRechProduct`, `saveCustomer`, `saveProduct`, `nextInvoiceNumber`, `getSessions`, `getPurchasesBySession`, `getGbrEinstellungen`, `saveGbrEinstellungen`, `getGbrGesellschafter`, `saveGbrGesellschafter` |
| `gbr.js` | `addGesellschafter`, `updateGesellschafter`, `removeGesellschafter`, `getKommanditisten`, `getKomplementaere`, `saveAuszahlungen` |
| `utils.js` | `getCurrencySymbol`, `isCurrentMonth`, `startDateObserver` |
| sonstige | `app.js: markDirty` · `companies.js: openSwitcher` · `rechtsform.js: kannKleinunternehmer` · `schweiz.js: renderConverter` · `svs.js: renderDashboardKachel` |

Auffällig: Der ganze GbR-Gesellschafter-Block in `gbr.js` und `store.js` scheint durch
`gbr-modul.js` abgelöst worden zu sein. Das prüfen und dann als Ganzes entfernen, nicht
Funktion für Funktion.

⚠️ `nextInvoiceNumber` und `canDelete` berühren GoBD (lückenlose Nummern, Löschsperre). Erst
nachweisen, dass der aktive Pfad eine andere Funktion nutzt (`peekRechInvoiceNumber` o. ä.)
und dass ein Test diesen Pfad abdeckt. Sonst bleiben sie.

### 3. Eine Diagramm-Bibliothek · 2 h · Priorität mittel · Risiko niedrig

Chart.js wird nur in `statistiken.js` genutzt, alles andere läuft über ApexCharts.
Chart.js wird schon nur bei Bedarf geladen (Kommentar in `app.html`), der Gewinn liegt also
nicht beim Start, sondern in der Wartung: eine Bibliothek, ein Diagramm-Stil, ein Satz
Updates. `statistiken.js` auf ApexCharts umstellen, dann `chart.min.js` (204 KB) aus
`js/vendor/` und `VERSIONS.md` entfernen.

### 4. Doppelpflege `lager/` vs. `js/lager.js` klären · 30 min Analyse · Priorität mittel

`lager/page.js` (2.772 Zeilen) ist laut Kopfkommentar das frühere Inline-Script der
Lager-Seite mit einem „Minimal-App-Shim“, `js/lager.js` (2.810) das Modul in der App. Zwei
fast gleich große Implementierungen desselben Fachbereichs heißen: Jeder Fix muss zweimal
gemacht werden, und einer wird vergessen.

- Klären, ob `/lager/` noch verlinkt und genutzt wird (`vercel.json` hat eine Route).
- Wenn nein: Ordner entfernen, Route weg, Redirect auf `app.html#lager`.
- Wenn ja: eine Datei als Quelle, die andere bindet sie ein.
- Gleiche Frage für `eigenbelege/` und `rechnungen/`.

### 5. Einmal-Seiten im Root · 15 min · Priorität niedrig

`ui-lab.html`, `landing-v2.html`, `stackr-onepager.html`, `stackr-broschuere.html` sind in
`vercel.json` ausgeliefert. `ui-lab` ist eine Testseite und gehört nicht in Produktion
(`.vercelignore` oder löschen). Bei `landing-v2` entscheiden: Wird sie durch das
Landing-Redesign von heute ersetzt? Dann danach löschen.

### 6. Statische Prüfung · 2–3 h · Priorität mittel

Aus dem Reel-Abgleich, Punkt 3: `// @ts-check` + `jsconfig.json` mit `checkJs`, ausgeführt per
`npx -p typescript tsc --noEmit` in der CI. Kein Eintrag in `package.json`, also keine
Dependency im Sinne von Regel 6. Findet künftig toten Code und Tippfehler automatisch, sodass
Schritt 2 nicht wieder von Hand nötig ist. **Deine Freigabe nötig.**

### 7. Riesendateien beim Anfassen teilen · laufend

Kein Big-Bang. Regel in `CLAUDE.md`: „Neue Logik nicht in `app.js`, `store.js`, `lager.js`,
sondern in ein Fachmodul. Wer einen Block dort ändert, zieht ihn dabei heraus.“ Kandidaten
für die ersten Schnitte: USt-Grenzen und Steuerjahr-Funktionen aus `app.js` (`app-ust.js`),
Rechnungs-CRUD aus `store.js` (`store-rechnungen.js`).

### 8. Refactor-Pass als feste Gewohnheit · 5 min pro Feature

Der eigentliche Punkt des Reels. Als Regel in `CLAUDE.md`:

```markdown
9. **Nach jedem Feature aufräumen.** Vor dem Commit ein eigener Durchgang über den Diff:
   Gibt es den Helfer schon (grep vor dem Neuschreiben)? Ist etwas doppelt? Blieb toter Code
   zurück? Aufräumen gehört in dieselbe Arbeit, nicht in „später“.
```

Werkzeug: `/simplify` auf den Diff, danach `/code-review`.

## Reihenfolge

| # | Schritt | Aufwand | Wartet auf |
|---|---|---|---|
| 1 | `plan/` ausmisten + Regel 9 | 1–2 h | nichts |
| 2 | Toter Code | 2 h | Commits der anderen Sessions in `buchungen.js`/`datev.js` |
| 3 | Chart.js raus | 2 h | nichts |
| 4 | `lager/`-Doppelpflege | 30 min Analyse | deine Entscheidung |
| 5 | Einmal-Seiten | 15 min | Landing-Redesign |
| 6 | `@ts-check` in CI | 2–3 h | deine Freigabe |
| 7 | Riesendateien | laufend | – |

## Bewusst nicht

- **Framework oder Build-Schritt einführen:** Das Fehlen ist eine Entscheidung
  (`02-ENTSCHEIDUNGEN.md`) und hält die Komplexität klein.
- **Einen der Tesseract-Kerne löschen:** `simd` ist schneller, `lstm` der Fallback für
  Browser ohne SIMD. Beide werden erst bei OCR geladen.
- **Großes Umsortieren von `store.js`:** zu viele Aufrufer, zu viele parallele Sessions.
  Nur beim Anfassen.
