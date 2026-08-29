# Mitgelieferte Fremdbibliotheken (`js/vendor/`, `css/vendor/`)

Diese Dateien liegen **absichtlich lokal im Repo** statt per CDN geladen zu werden: die CSP
erlaubt kein fremdes `script-src`, und die App muss offline funktionieren. Der Preis dafür ist,
dass es keinen automatischen Update-Pfad gibt — deshalb diese Datei.

Es gibt hier **keine `integrity=`-Attribute** in den HTML-Dateien: SRI vergleicht einen Hash
gegen eine über das Netz geladene Datei. Bei lokalen Dateien schützt es vor nichts (wer die
Datei ändern kann, ändert das Attribut mit). Die Hashes unten sind der Ersatz dafür: sie
belegen, welches Original eingecheckt wurde.

Beide Ordner (`Web 1.7/js/vendor/` und `Local 1.7/js/vendor/`) sind **byte-identisch** zu
halten. Nach jedem Austausch: `md5sum` beider Dateien vergleichen.

> **Prüfroutine:** ein Mal pro Quartal die Advisory-Seiten unten aufrufen. Keine dieser
> Bibliotheken ist über `npm audit` erfasst — SheetJS ist gar nicht auf npm, der Rest liegt
> hier ohne `package.json`. Es kommt also keine Warnung von allein.

---

## Seit 2026-08-15: die fünf ehemaligen jsDelivr-Bibliotheken

Fund **D1** (Audit 14, Datenschutz): sechs Seiten luden zur Laufzeit von
`cdn.jsdelivr.net`, **darunter eine Schriftart** — genau die Konstellation aus
LG München I, 3 O 17493/20. Jetzt lokal, `cdn.jsdelivr.net` steht in keiner CSP mehr.

Alle fünf wurden beim Herunterladen gegen **die SRI-Hashes geprüft, die vorher in den
HTML-Dateien standen** — es ist nachweislich derselbe Code, den die App bisher geladen hat.

| Datei | Version | SHA-256 | Größe | Lizenz | Advisories |
|---|---|---|---|---|---|
| `js/vendor/gsap.min.js` | 3.12.5 | `28033e449a31ebcc396e5be8b13b63152bf03094288fb5867034321927bce087` | 72.214 B | Standard "No Charge" | <https://github.com/greensock/GSAP/security> |
| `js/vendor/notyf.min.js` | 3.10.0 | `52796990c2dab1a4f1d99aa8bf105751c4398eade829769967569610d3451131` | 7.646 B | MIT | <https://github.com/caroso1222/notyf/security> |
| `js/vendor/flatpickr.min.js` | 4.6.13 | `1eeab1cb779471a0b0aaa93dd91c2eb1aa537d696f01ab05ea9dabc55e8525a1` | 50.679 B | MIT | <https://github.com/flatpickr/flatpickr/security> |
| `js/vendor/flatpickr-de.js` | 4.6.13 | `8bcf8bfb7d68b2c8b99d2082257c5ef523c8c1afc62c94f6aa9aeb6fb77b9338` | 1.812 B | MIT | — (Sprachdatei) |
| `js/vendor/apexcharts.min.js` | 3.54.1 | `56fb1229fe77c8cc66f31ea125bea9ed37a3840c97b66a23e44c851cff717b2b` | 539.664 B | MIT | <https://github.com/apexcharts/apexcharts.js/security> |
| `css/vendor/notyf.min.css` | 3.10.0 | `23092f64d442ff74b6e8ed605b08c120d9ab3d9e3362f3d7e33ffdf0e2961e44` | 5.159 B | MIT | s. o. |
| `css/vendor/flatpickr-dark.css` | 4.6.13 | `47798b76a38ac3a62b1ae658c566e0ed3b4cbcb115173ae620f0db8952f93612` | 19.163 B | MIT | s. o. |
| `css/vendor/tabler-icons.min.css` | 3.44.0 | `0d4f79caa8f50b54af50341ca5946dad10a63fc8baa818bddd1de395e22627f5` | 208.958 B | MIT | <https://github.com/tabler/tabler-icons/security> |
| `css/vendor/fonts/tabler-icons.woff2` | 3.44.0 | `bce5d4c933dcfe8708787a3570ab0995a4a99250d6321ed177c7f2179e93eb68` | 457.384 B | MIT | s. o. |

Bezugsquelle für alle: `https://cdn.jsdelivr.net/npm/<paket>@<version>/…` — dieselben Pfade,
die vorher in den `<link>`/`<script>`-Tags standen.

**Zwei bewusste Abweichungen vom Original:**

1. **`tabler-icons.min.css` ist minimal verändert.** Die `src:`-Zeile im `@font-face` listete
   `woff2`, `woff` und `ttf`; eingecheckt ist nur noch `woff2`. `woff` (786 KB) und `ttf`
   (2,8 MB) lädt kein Browser, der `woff2` beherrscht — das kann jeder seit 2016. Der
   SHA-256 oben gilt für die **veränderte** Datei; das unveränderte Original hat
   SRI `sha384-ccZHbezhtZWmNy0cg8odL0D/jFU5k5HIls9y78Qd6lWor7rpvFIZtK0fTFG4z456`.
   Beim Versionswechsel dieselbe Kürzung wiederholen.
2. **Die Fonts liegen unter `css/vendor/fonts/`**, nicht bei den übrigen Fonts in `fonts/`.
   Grund: die Tabler-CSS referenziert sie relativ als `./fonts/…`. Verschiebt man sie,
   muss man die CSS anfassen — der Pfad ist die günstigere Seite des Tauschs.

**Nicht** von D1 verursacht und getrennt behoben: der CSP-Verstoß „Applying inline style
violates … style-src-elem". Er kam aus `js/whop-auth.js` (`_showLoader`), das die
`@keyframes whop-spin` als `<style>`-Block ins `innerHTML` des Overlays schrieb — der
Spinner auf dem Anmeldescreen stand deshalb still. Die Keyframes liegen jetzt in
`css/style.css`. Der gemeldete Hash `sha256-1zUse+EvsRXKI3xzz1iE+aYOOTEU37OJJ8trvkqVMmc=`
gehört exakt zu diesem Block.

`flatpickr` legt zwar auch ein `<style>`-Element an (dynamische Pfeil-Positionierung), aber
nur als Fallback, wenn es kein beschreibbares Stylesheet findet — seit alle Stylesheets
same-origin sind, greift der Fallback nicht mehr.

---

## `xlsx.full.min.js` — SheetJS

| | |
|---|---|
| **Version** | 0.20.3 |
| **Eingecheckt am** | 2026-08-10 |
| **Bezugsquelle** | `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js` |
| **SHA-256** | `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41` |
| **Größe** | 951.904 Bytes |
| **Lizenz** | Apache-2.0 |
| **Advisories** | <https://cdn.sheetjs.com/advisories/> |

**Wichtig — nicht über npm beziehen.** Das npm-Paket `xlsx` ist bei 0.18.5 stehengeblieben und
wird nicht mehr gepflegt; die Sicherheitsfixes gibt es **ausschließlich** über `cdn.sheetjs.com`.
Ein `npm install xlsx` holt also gezielt die verwundbare Version zurück.

**Warum 0.20.3 (Austausch am 2026-08-10, vorher 0.18.5):**

- **CVE-2023-30533** — Prototype Pollution beim Lesen präparierter Dateien. Behoben ab 0.19.3.
  Für Stackr der ernste Punkt: die Bibliothek sitzt auf dem Excel-**Import**-Pfad, verarbeitet
  also per Definition fremde Dateien.
- **CVE-2024-22363** — ReDoS. Behoben ab 0.20.2.

**Genutzte API** (bei jedem Update gegenprüfen — `test/test-vendor-xlsx-api.js` tut genau das):
`XLSX.read`, `XLSX.write`, `XLSX.writeFile`, `XLSX.utils.sheet_to_json`, `.aoa_to_sheet`,
`.json_to_sheet`, `.book_new`, `.book_append_sheet`.
Benutzte Leseoptionen: `type:'array'`, `cellDates`, `codepage:65001`, `header:1`, `defval`,
`raw:false`, `range`.

**Aufrufstellen:** `app.html` (`<script defer>`), `lager/index.html`, verwendet in `js/app.js`,
`js/buchungen.js`, `js/lager.js`, `lager/page.js`.

---

## `tesseract*` — Belegerkennung (OCR), seit 2026-08-27

Fund **G4**. Texterkennung für Eigenbelege, die **vollständig im Browser** läuft — kein
Belegbild geht an einen Server. Genau deshalb liegen hier ~9 MB: ein OCR-Endpunkt wäre die
einzige Stelle der App, an der der Server Klardaten sähe.

| Datei | Version | SHA-256 | Größe | Lizenz |
|---|---|---|---|---|
| `js/vendor/tesseract.min.js` | tesseract.js 7.0.0 | `000c27d9cd0def655f77b36c72a389c0ab13793aa31cb4d7aab56d09c0afbc7e` | 62.961 B | Apache-2.0 |
| `js/vendor/tesseract-worker.min.js` | tesseract.js 7.0.0 | `576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d` | 111.307 B | Apache-2.0 |
| `js/vendor/tesseract-core-simd-lstm.wasm.js` | tesseract.js-core 7.0.0 | `c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38` | 3.899.472 B | Apache-2.0 |
| `js/vendor/tesseract-core-lstm.wasm.js` | tesseract.js-core 7.0.0 | `eef5f8b2f8e20e150680b20adaec4a60babafee3adbe8a94583c81fee46e8680` | 3.896.484 B | Apache-2.0 |
| `js/vendor/tessdata/deu.traineddata.gz` | @tesseract.js-data/deu 1.0.0 | `306c4280d0cbed46fbff727486bd43b92730181bae80f56941a091f363bdf28b` | 1.333.102 B | Apache-2.0 |

**Bezugsquellen** (einmalig am 2026-08-27 geholt, Größen gegen das jsDelivr-Manifest geprüft):

```
https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js
https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js          → tesseract-worker.min.js
https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-simd-lstm.wasm.js
https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-lstm.wasm.js
https://cdn.jsdelivr.net/npm/@tesseract.js-data/deu@1.0.0/4.0.0_best_int/deu.traineddata.gz
```

**Advisories:** <https://github.com/naptha/tesseract.js/security> ·
<https://github.com/naptha/tesseract.js-core/security>

> **`npm install tesseract.js` ist verboten**, aus demselben Grund wie bei `xlsx`: es gibt genau
> eine produktive Abhängigkeit (`@vercel/blob`), und dabei bleibt es. Die Bibliothek zieht über
> npm neun eigene Abhängigkeiten nach — hier liegen stattdessen fünf fertige Dateien.

**Vier Punkte, die beim nächsten Versionswechsel zu beachten sind:**

1. **Der Kern muss zur Bibliothek passen — und `latest` hilft dabei nicht.** `tesseract.js@7.0.0`
   verlangt laut eigener `package.json` `tesseract.js-core@^7.0.0`. Der `latest`-Tag von
   `tesseract.js-core` zeigt aber (Stand 2026-08-27) noch auf **6.1.2**. Wer `latest` nimmt, baut
   ein Major-Gespann falsch zusammen. Maßgeblich ist `dependencies` der Bibliothek, nicht der Tag.
2. **Nur die beiden LSTM-Kerne liegen hier.** `tesseract.js-core` liefert sechs Varianten; die
   Nicht-LSTM-Kerne sind die alte Tesseract-3-Engine und für Bons unnötig. Die dritte
   LSTM-Variante (`relaxedsimd`) ist ebenfalls bewusst nicht vendoriert: 3,9 MB mehr für einen
   kaum messbaren Gewinn.
   **Folge:** `corePath` darf **kein Verzeichnis** sein. Bei einem Verzeichnis fragt
   `tesseract.js` zuerst `tesseract-core-relaxedsimd-lstm.wasm.js` an und läuft in einen 404.
   `eigenbelege/js/app.js` prüft deshalb SIMD selbst (`_ocrHatSimd()`) und übergibt eine konkrete
   Datei.
3. **Das Sprachmodell ist die `best_int`-Variante** — das ist das, was `tessdata_fast` meint, und
   die Datei, die `tesseract.js` selbst per Default zieht. `4.0.0/deu.traineddata.gz` (7,1 MB)
   enthält zusätzlich das Legacy-Modell und wird nicht gebraucht. Der Ordner heißt `tessdata/`,
   weil `langPath` ein Verzeichnis sein muss und die Datei exakt `deu.traineddata.gz` heißen muss.
4. **Die eingebauten CDN-Pfade bleiben in den Dateien stehen** (`cdn.jsdelivr.net/...` als
   Default für `workerPath`/`corePath`/`langPath`). Sie werden zur Laufzeit alle drei überschrieben;
   zusätzlich würde `connect-src 'self'` einen Zugriff ohnehin blockieren. Beim Update prüfen, dass
   alle drei Optionen weiterhin gesetzt sind — sonst telefoniert die Belegerkennung nach außen.

**Zur CSP: es wurde keine gelockert — das ist eine bewusste Abweichung von der Spezifikation.**
`plan/ocr-belegerkennung-2026-08-12.md` ging davon aus, dass `script-src` um `'wasm-unsafe-eval'`
erweitert werden muss, und der Betreiber hatte das für `/app.html` und `/eigenbelege` freigegeben.
Am echten Build gemessen (2026-08-27, Chromium, `scripts/csp-preview-server.js` mit den echten
`vercel.json`-Headern) ist es **nicht nötig**: der WASM-Kern wird im Worker kompiliert, und die
Antwort des Worker-Skripts (`/js/vendor/…`) trägt keine CSP, also gilt dort die des Dokuments
nicht. Die Konsole blieb leer, 3 von 3 Feldern wurden erkannt.

> **Der Einwand kam zweimal, deshalb hier die Gegenprobe** (2026-08-28, dieselbe Seite, ein
> Durchlauf). Der naheliegende Verdacht ist ja, dass lokal einfach keine CSP greift — das wurde
> mitgeprüft:
>
> | | |
> |---|---|
> | `WebAssembly.compile()` im **Main Thread** | **blockiert** — `CompileError: Compiling or instantiating WebAssembly module violates the following Content Security Policy directive…` |
> | echter OCR-Lauf über die UI, unmittelbar danach | **3 von 3 Feldern**, 1837 ms, Konsole leer |
>
> Die CSP ist also nachweislich scharf und blockt WASM — im Dokument. Dass OCR trotzdem läuft,
> ist der Beweis, dass dort gar nicht kompiliert wird. Ein `grep` nach `WebAssembly.instantiate`
> in den Vendor-Dateien belegt deshalb nichts: entscheidend ist nicht, *dass* kompiliert wird,
> sondern *in welchem Kontext*.

Das hängt an **einer** Einstellung: `workerBlobURL: false` in `eigenbelege/js/app.js`. Ein aus
einer `blob:`-URL gestarteter Worker **erbt** die CSP des Dokuments — dann bräuchte es
`'wasm-unsafe-eval'` und `worker-src blob:`. Wer diese Option ändert, muss die CSP mitändern.

Sollte ein Browser die Kompilierung doch verweigern (Konsole: `Refused to compile WebAssembly`),
ist die Freigabe erteilt und der Eingriff klein: `'wasm-unsafe-eval'` in `script-src` — an **beiden**
Stellen, im `<meta>`-Tag von `eigenbelege/index.html` **und** im Header für `/eigenbelege/:path*`
in `vercel.json`, weil Browser mehrere CSPs schneiden. Bis dahin gilt: eine Aufweichung ohne
Notwendigkeit wäre reiner Verlust. Fällt die Erkennung aus, bleibt der Eigenbeleg unverändert von
Hand erfassbar — sie ist kein Pflichtpfad.

**Aufrufstellen:** `eigenbelege/index.html` lädt nur `js/beleg-ocr.js` (~5 KB Heuristik).
Bibliothek, Kern und Sprachmodell holt `eigenbelege/js/app.js` erst beim Klick auf
„Beleg auslesen“ nach. Die Extraktionsregeln sind ohne Browser prüfbar:
`node test/test-beleg-ocr.js`.

---

## `chart.min.js` — Chart.js

| | |
|---|---|
| **Version** | 4.4.1 |
| **Eingecheckt am** | 2026-04-30 (Version stammt aus jsDelivr-Build) |
| **Bezugsquelle** | `https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js` |
| **SHA-256** | `d2af8974e95271638772e9e9524db5b9a6f58d6ec2d5d781400447b4a31c681e` |
| **Größe** | 205.399 Bytes |
| **Lizenz** | MIT |
| **Advisories** | <https://github.com/chartjs/Chart.js/security/advisories> |

Stand 2026-08-10 **keine bekannten Schwachstellen** in 4.4.1. Hier nur mitdokumentiert, weil
dasselbe Grundproblem bestand wie bei SheetJS: eine eingecheckte Bibliothek ohne notierte
Herkunft fällt bei einem Update-Bedarf niemandem auf.

**Aufrufstellen:** `app.html`, `eigenbelege/index.html`.
