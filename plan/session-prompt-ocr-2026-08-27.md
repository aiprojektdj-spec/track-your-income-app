# Session-Prompt: OCR-Belegerkennung bauen (2026-08-27)

**Auftrag des Users:** „OCR muss fertig werden, eigene Session."

Diese Datei ist der vollständige Einstieg — du musst keine andere Planungsdatei lesen, um
anzufangen. Die inhaltliche Spezifikation ist
[`ocr-belegerkennung-2026-08-12.md`](ocr-belegerkennung-2026-08-12.md); sie gilt unverändert.

---

## 0. Erste Handgriffe

```bash
git status --short && git log --oneline -8
```

An diesem Repo arbeiten **mehrere Sessions gleichzeitig im selben Working Tree**. Eine Datei, die
in `git status` auftaucht, hält gerade jemand anders — nicht anfassen, per `send_message`
abstimmen.

Diese Aufgabe fasst voraussichtlich an: `eigenbelege/index.html`, `eigenbelege/js/app.js`,
`js/vendor/*`, `js/vendor/VERSIONS.md`, `vercel.json`, `datenschutz.html`, dazu eine neue Datei
für die Extraktionsheuristik und ihren Test. **Vor jedem dieser Zugriffe den Status prüfen.**

Die Testsuite muss vorher und nachher stumm durchlaufen:

```bash
for f in test/*.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done
```

---

## 1. Was schon entschieden ist — nicht erneut aufwerfen

| Frage | Antwort | Wann |
|---|---|---|
| Wird OCR gebaut? | **Ja.** Die Zurückstellung („erst bei Trustpilot-Bewertungen") ist aufgehoben | 2026-08-27 |
| Browser oder Server? | **Ausschließlich Browser.** Keine Server-Variante, auch nicht als Fallback | 2026-08-12 |
| Darf `script-src` um `wasm-unsafe-eval` erweitert werden? | **Ja, aber nur auf `/app.html` und `/eigenbelege`** | 2026-08-12 |
| Neue Abhängigkeit erlaubt? | **Ja**, für `tesseract.js` — aber **nur vendoriert**, nie zur Laufzeit vom CDN, nie über `npm install` | 2026-08-12 |

Das steht so in [`02-ENTSCHEIDUNGEN.md`](02-ENTSCHEIDUNGEN.md). **Der User muss zu diesen vier
Punkten nicht erneut gefragt werden.**

---

## 2. Reihenfolge

### Schritt 1 — Vendorieren

`tesseract.js` **7.0.0** und `tesseract.js-core` **6.1.2** — die Major-Versionen müssen
zusammenpassen. Einmalig beziehen von `https://cdn.jsdelivr.net/npm/…`, dann nach `js/vendor/`:

- `worker.min.js`
- `tesseract-core-simd-lstm.wasm.js`
- `tesseract-core-lstm.wasm.js` (Fallback ohne SIMD)
- `deu.traineddata.gz` — **`tessdata_fast`, nicht `tessdata_best`**

Die beiden Nicht-LSTM-Kerne werden **nicht** vendoriert (alte Tesseract-3-Engine; das halbiert den
Umfang). Englisch nur, falls die EN-Oberfläche es wirklich bekommen soll.

Jede Datei bekommt einen **SHA-256-Eintrag in `js/vendor/VERSIONS.md`**, samt Bezugsquelle und
Prüfdatum — genau der Schritt, der bei SheetJS fehlte und dazu führte, dass zwei CVEs zwei Jahre
lang im Excel-Import mitliefen.

> **`npm install tesseract.js` ist verboten**, wie bei `xlsx`. Es gibt genau eine produktive
> Abhängigkeit im Projekt (`@vercel/blob`), und dabei bleibt es.

### Schritt 2 — CSP

`wasm-unsafe-eval` in `script-src` ergänzen, **nur** auf `/app.html` und `/eigenbelege`.
Zusätzlich `worker-src` prüfen: ob `self` reicht oder `blob:` nötig ist, hängt davon ab, wie
`tesseract.js` den Worker startet. **Am echten Build prüfen, nicht raten.**

> ⚠️ **An zwei Stellen setzen:** im `<meta>`-Tag der jeweiligen HTML-Datei **und** im HTTP-Header
> in `vercel.json`. Browser bilden aus mehreren CSPs die **Schnittmenge** — eine vergessene Stelle
> blockiert weiterhin alles. Die CSP steht in `vercel.json` pro Route, **nie global**.

Landing, Rechtstexte und `/api/*` bleiben unangetastet.

### Schritt 3 — Extraktionsheuristik und ihr Test

**Zuerst die Logik, dann die UI.** Die drei Regeln gehören in eine eigene, ohne Browser prüfbare
Funktion — dieselbe Trennung wie beim Zahlungsabgleich (G3):

| Feld | Regel |
|---|---|
| Datum | erstes `TT.MM.JJJJ` / `TT.MM.JJ`; bei mehreren das **früheste** (Bons tragen oft ein späteres Druckdatum) |
| Betrag | Zeile mit `SUMME`, `GESAMT`, `TOTAL`, `ZU ZAHLEN` bevorzugt; sonst der größte Betrag mit zwei Nachkommastellen |
| Händler | erste Zeile mit mindestens drei Buchstaben, die keine Zahl und keine Adressfloskel ist |

Dazu ein Harness in `test/` nach dem Muster der über 30 vorhandenen, mit echten Bon-Textbeispielen
als Fixtures. Der Test muss ohne Browser und ohne WASM laufen.

### Schritt 4 — UI im Eigenbeleg-Formular

- Zusätzlicher Weg neben dem Foto-Upload: **„Beleg auslesen"**.
- Läuft nur auf einem Bild, das der Nutzer selbst gewählt hat, und **nur auf Klick** — kein Lauf
  beim bloßen Upload.
- Ergebnisse als **anklickbare Chips** über dem jeweiligen Feld, mit dem erkannten Rohtext daneben.
  **Nichts wird automatisch eingetragen** — ein falsch vorbefülltes Feld ist schlimmer als ein
  leeres.
- Fortschrittsanzeige; ein Durchlauf dauert auf Mittelklasse-Geräten mehrere Sekunden.
- **Kein Pflichtpfad:** fällt OCR aus, muss sich der Eigenbeleg unverändert von Hand erfassen
  lassen.

**Nicht bauen:** automatische Kategorisierung (das ist eine Bewertungs-, keine Erkennungsfrage) und
Positionserkennung einzelner Bon-Posten (dafür reicht die Genauigkeit nicht).

### Schritt 5 — Ladeverhalten

WASM **nicht** beim Seitenstart laden — die Dateien sind ein Vielfaches der übrigen App. Nachladen
erst beim ersten Klick auf „Beleg auslesen", nach dem Muster von `Dashboard._ensureApexCharts()`
bzw. `Utils.ensureXlsx()`. Danach bleibt der Worker für weitere Belege derselben Sitzung stehen.

### Schritt 6 — Datenschutztext

`datenschutz.html` ergänzen: **OCR läuft lokal, es verlässt kein Bild das Gerät.** Keine
Pflichtangabe, aber das Verkaufsargument — und wer „Belegerkennung" liest, nimmt zunächst das
Gegenteil an.

---

## 3. Verifikation

- **Testsuite** stumm, inklusive des neuen Heuristik-Tests.
- **Browser-Test nur auf einem frischen Port.** `python -m http.server` schickt keine
  No-Cache-Header, und der Cache hängt am Origin: Reload, Cache-Bust-Query und neuer Tab liefern
  trotzdem alten Code. Neuen Eintrag in `.claude/launch.json` anlegen, Port = höchster vorhandener + 1.
- **CSP wirklich prüfen:** Konsole auf `Refused to compile WebAssembly` ansehen. Sitzt der
  Meta-Tag, der `vercel.json`-Header aber nicht (oder umgekehrt), fällt das lokal womöglich nicht
  auf und erst in Produktion.
- **Ein echter Bon als Bild**, nicht nur ein synthetisches Testbild.

---

## 4. Arbeitsregeln, die hier schon Geld gekostet haben

1. **Pfad-gescoped committen — beim `add` UND beim `commit`:**
   `git commit -F <nachricht> -- <datei>`. Ein sauberes `git add -- <datei>` reicht **nicht**:
   liegt fremde Arbeit schon im Index (Status `MM`), nimmt ein `commit` ohne Pathspec sie mit. Am
   2026-08-21 genau so passiert.
2. **`git status` unmittelbar vor dem Commit erneut prüfen**, nicht nur beim Sessionstart.
3. **Vor dem Sessionende den Push-Stand prüfen.** `c982264` hat `js/lager.js` gepusht und die
   zugehörigen Helfer in `js/utils.js` uncommittet liegen lassen — die Lager-Seite war für alle
   Kunden tot, bis es jemandem auffiel.
4. **Nie über eine PowerShell-Textpipeline schreiben** (`Set-Content`, `Out-File`) — das zerschießt
   die Umlaute. Repo ist UTF-8 ohne BOM: Edit/Write oder Python mit `encoding='utf-8', newline=''`.
   Commit-Messages dagegen **ohne** Umlaute (ae/oe/ue/ss).
5. **Stand immer gegen den Code prüfen, nie gegen Plandateien** — auch nicht gegen diese hier.

---

## 5. Wenn du fertig bist

- `js/vendor/VERSIONS.md` erweitert, inklusive einer Erinnerung, die Version quartalsweise zu
  prüfen. Weder SheetJS noch Chart.js noch Tesseract werden von einem `npm audit` erfasst — es
  kommt **keine** Warnung von allein.
- In [`01-AUFGABEN.md`](01-AUFGABEN.md) Abschnitt 1.0 abhaken; Abschnitt 1 ist danach wieder leer.
- Ergebnis in [`ERLEDIGT-2026-08.md`](ERLEDIGT-2026-08.md) eintragen — **mit den Stellen, an denen
  die Umsetzung von dieser Beschreibung abwich.** Genau das war beim Krypto-Worker (F6) der
  nützlichste Teil: die Prognose lag dort um mehr als die Hälfte daneben.
