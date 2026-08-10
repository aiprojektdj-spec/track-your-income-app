# Mitgelieferte Fremdbibliotheken (`js/vendor/`)

Diese Dateien liegen **absichtlich lokal im Repo** statt per CDN geladen zu werden: die CSP
erlaubt kein fremdes `script-src`, und die App muss offline funktionieren. Der Preis dafür ist,
dass es keinen automatischen Update-Pfad gibt — deshalb diese Datei.

Es gibt hier **keine `integrity=`-Attribute** in den HTML-Dateien: SRI vergleicht einen Hash
gegen eine über das Netz geladene Datei. Bei lokalen Dateien schützt es vor nichts (wer die
Datei ändern kann, ändert das Attribut mit). Die Hashes unten sind der Ersatz dafür: sie
belegen, welches Original eingecheckt wurde.

Beide Ordner (`Web 1.7/js/vendor/` und `Local 1.7/js/vendor/`) sind **byte-identisch** zu
halten. Nach jedem Austausch: `md5sum` beider Dateien vergleichen.

> **Prüfroutine:** ein Mal pro Quartal die Advisory-Seiten unten aufrufen. Beide Bibliotheken
> sind nicht über npm-Audit erfasst (SheetJS ist gar nicht auf npm, Chart.js liegt hier ohne
> `package.json`), es gibt also keine Warnung, die von allein kommt.

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
