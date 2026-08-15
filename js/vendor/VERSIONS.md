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
