# Performance-Audit — Funde (2026-08-11)

**Session-Prompt:** `plan/session-prompt-audit-09-performance-2026-08-10.md`
**Scope:** Web 1.7 — `app.html` und die drei Sub-Apps, Bundle, Render-Blocking, Store,
DOM, Charts, Memory, CSS, Netzwerk, Cloud-Sync.
**Methode:** Größen **gemessen** (`stat`), nicht geschätzt. Keine Live-Messung im Browser —
Lighthouse-Lauf gegen die Produktions-URL bleibt als Gegenprobe empfohlen.

---

## Zusammenfassung

Der Session-Prompt vermutete, die „63 defer-Scripts in app.html" seien bereits erledigt und
sollten nur nachgemessen werden. **Die Messung zeigt: die Optimierung wurde nur auf `app.html`
angewendet.** Die drei Sub-Apps — Rechnungen, Lager, Eigenbelege — laden ihre Skripte praktisch
vollständig render-blockierend, inklusive 600 KB ApexCharts aus dem CDN, das `app.html` korrekt
erst bei Bedarf nachlädt.

| Seite | Script-Tags | mit `defer` | **blockierend** |
|---|---|---|---|
| `app.html` | 67 | 63 | ~4 ✅ |
| `rechnungen/index.html` | 32 | 1 | **~31** 🔴 |
| `eigenbelege/index.html` | 22 | 1 | **~21** 🔴 |
| `lager/index.html` | 21 | 1 | **~20** 🔴 |

| # | Fund | Wirkung | Aufwand |
|---|---|---|---|
| F1 | Sub-Apps laden alles render-blockierend, ApexCharts eager | ~1,4 MB blockierend | 🟢 winzig |
| F2 | `xlsx.full.min.js` (929 KB) lädt immer, gebraucht wird es selten | −929 KB pro Load | 🟢 klein |
| F3 | `chart.min.js` (200 KB) für **ein** Modul, auf 2 Seiten eager | −200 KB pro Load | 🟢 klein |
| F4 | Kein `<link rel="preload">` für die kritische CSS/JS-Kette | LCP | 🟢 klein |
| F5 | Volles Neu-Rendern ganzer Tabellen per `innerHTML` | INP bei vielen Zeilen | 🟠 mittel |
| F6 | Cloud-Sync überträgt immer den kompletten Blob (kein Delta) | Netz/CPU bei großen Datenmengen | 🔴 groß |
| F7 | `setInterval` für Backup wird nie geräumt | vernachlässigbar | 🟢 winzig |

---

## 🔴 F1 — Die Sub-Apps haben die Defer-Optimierung nie bekommen

`eigenbelege/index.html` lädt im **`<head>`, ohne `defer`**
([eigenbelege/index.html:19-22](../eigenbelege/index.html#L19)):

```html
<script src="../js/vendor/chart.min.js"></script>                        <!-- 200 KB -->
<script src="https://cdn.jsdelivr.net/npm/apexcharts@3.54.1/…"></script>  <!-- ~600 KB -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/…"></script>        <!-- ~70 KB -->
<script src="https://cdn.jsdelivr.net/npm/notyf@3.10.0/…"></script>       <!-- ~15 KB -->
```

Jedes dieser Tags hält den HTML-Parser an, bis die Datei geladen **und ausgeführt** ist. Vor dem
ersten Pixel stehen damit rund 900 KB — auf einer Seite, die nur Eigenbelege listet.

`rechnungen/index.html` ist mit **31 blockierenden Tags** noch schwerer: **678 KB lokale
Skripte** plus rund 735 KB CDN.

Besonders ärgerlich ist ApexCharts: `js/dashboard.js` lädt es vorbildlich **erst beim Öffnen des
Dashboards** nach ([js/dashboard.js:11-23](../js/dashboard.js#L11), `_ensureApexCharts()`) — die
drei Sub-Apps ziehen dieselben ~600 KB dagegen bei jedem Seitenaufruf eager, teilweise sogar im
`<head>`.

**Fix — drei Stufen, aufsteigend nach Aufwand:**

1. **`defer` an alle Script-Tags der drei Sub-Seiten.** Reine Attribut-Ergänzung, kein
   Verhaltensrisiko, solange die Reihenfolge erhalten bleibt (`defer` garantiert
   Ausführungsreihenfolge). Das allein verschiebt ~1,4 MB aus dem kritischen Pfad.
2. **ApexCharts in den Sub-Apps lazy laden** — `_ensureApexCharts()` aus `dashboard.js` ist
   fertig und kann übernommen werden. −600 KB pro Seitenaufruf.
3. **`chart.min.js` und `xlsx` nur laden, wo gebraucht** (siehe F2/F3).

Schon Stufe 1 dürfte auf den drei Sub-Seiten den größten Einzelgewinn dieses Audits bringen.

---

## 🔴 F2 — 929 KB Excel-Bibliothek bei jedem Aufruf

`js/vendor/xlsx.full.min.js` ist mit **929 KB die größte Datei des Projekts** — größer als der
gesamte übrige Anwendungscode einzelner Module. Geladen wird sie:

- [app.html:239](../app.html#L239) — `defer`, aber **eager** (lädt immer)
- [lager/index.html:209](../lager/index.html#L209) — **ohne `defer`**

Gebraucht wird sie ausschließlich beim Excel-Import/-Export (`js/app.js`, `js/buchungen.js`,
`js/lager.js`, `lager/page.js`) — eine Aktion, die die meisten Nutzer in einer Sitzung **nie**
auslösen.

**Fix:** Dasselbe Muster wie ApexCharts. Beim Klick auf „Excel importieren" laden:

```javascript
function _ensureXlsx() {
    if (typeof XLSX !== 'undefined') return Promise.resolve();
    return new Promise((resolve, reject) => {
        var s = document.createElement('script');
        s.src = 'js/vendor/xlsx.full.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
    });
}
```

**Geschätzter Gewinn:** −929 KB Transfer und Parse-Zeit auf **jedem** App-Start. Bei
Brotli-Kompression über die Leitung weniger (~250 KB), die Parse-/Compile-Kosten fallen aber auf
der **unkomprimierten** Größe an — das ist auf schwachen Geräten der spürbarere Teil.

---

## 🟠 F3 — 200 KB Chart.js für ein einziges Modul

`js/vendor/chart.min.js` (200 KB) wird von **genau einer** Datei benutzt: `js/statistiken.js`.
Geladen wird es auf `app.html` (defer, eager) und auf `eigenbelege/index.html`
(**ohne defer, im `<head>`**) — wobei Eigenbelege Chart.js gar nicht braucht.

Damit existieren im Projekt **zwei** Chart-Bibliotheken nebeneinander: ApexCharts fürs Dashboard,
Chart.js für die Statistiken. Zusammen rund 800 KB für dieselbe Aufgabe.

**Fix, kurzfristig:** `chart.min.js` aus `eigenbelege/index.html` entfernen (dort ungenutzt) und
in `app.html` lazy laden, sobald das Statistiken-Modul geöffnet wird.
**Fix, mittelfristig:** Prüfen, ob `js/statistiken.js` auf ApexCharts umgestellt werden kann.
Dann fällt eine der beiden Bibliotheken komplett weg. Das ist echte Arbeit, aber es räumt
dauerhaft 200 KB und eine Abhängigkeit ab.

---

## 🟠 F5 — Ganze Tabellen werden per `innerHTML` neu gebaut

Muster durchgängig, z. B. [eigenbelege/js/app.js:1115](../eigenbelege/js/app.js#L1115),
[js/buchungen.js:974](../js/buchungen.js#L974):

```javascript
tbl.innerHTML = `<table>…alle Zeilen…</table>`;
```

Bei jeder Filter-, Sortier- oder Datenänderung wird die komplette Tabelle verworfen und neu
geparst. Bei den typischen Datenmengen der Zielgruppe (einige Hundert Zeilen) ist das
unproblematisch — bei einem Reseller mit mehreren tausend Artikeln oder Buchungen wird es
spürbar, und genau diese Nutzer sind die wertvollsten.

**Entwarnung zum Teil:** Der befürchtete Listener-Leak existiert **nicht**. Die App nutzt
konsequent Event-Delegation über `js/actions.js` — **ein** globaler Click-Handler
([js/actions.js:40](../js/actions.js#L40)) bedient **350** `data-action`-Vorkommen. Die Suche
nach `forEach(... addEventListener)` in Render-Schleifen liefert **null Treffer**. Das ist die
saubere Lösung und der Grund, warum das ständige Neu-Rendern bisher folgenlos bleibt.

**Empfehlung:** Nichts überstürzen. Erst messen (siehe unten), und erst ab spürbarer Verzögerung
über Virtual Scrolling oder gezieltes Zeilen-Update nachdenken. Als Zwischenschritt reicht meist
eine Obergrenze mit Nachlade-Button („zeige 200 von 3.400").

---

## 🔴 F6 — Cloud-Sync überträgt immer alles

`js/cloud-sync.js` verschlüsselt und überträgt pro Scope den **kompletten** Datenblob; ein
Delta-Verfahren gibt es nicht. Die Architektur ist darauf ausgelegt: `api/sync.js` speichert
`{ciphertext, iv, version}` als **einen** Wert mit optimistischer Nebenläufigkeit (CAS über
Versionsvergleich).

Konsequenzen bei wachsender Datenmenge:
- Jede geänderte Buchung löst Ver- und Entschlüsselung des **gesamten** Bestands aus.
- Ab 3,5 MB Chiffrat greift der Auslagerungspfad über Vercel Blob
  ([api/sync.js:105](../api/sync.js#L105)) — dann kommt pro Sync ein zusätzlicher
  Upload/Download dazu.
- AES-GCM läuft im Main-Thread; bei mehreren MB ist das ein merklicher Hänger.

**Abgemildert wird das bereits durch** die 6-Sekunden-Entprellung des Push (im Rate-Limit-Kommentar
von `api/sync.js:96` dokumentiert) — es wird also nicht bei jedem Tastendruck synchronisiert.

**Empfehlung:** Kein Delta-Sync bauen — das würde die CAS-Logik und das Merge-Verfahren erheblich
verkomplizieren, und beides ist heute korrekt und getestet. Stattdessen zwei kleinere Schritte:
1. **Ver-/Entschlüsselung in einen Web Worker** verlagern, damit die UI nicht einfriert.
2. **Sichtbare Rückmeldung** bei großen Blobs (der Sync-Punkt in der Topnav existiert bereits) —
   ein wahrgenommener Hänger ohne Erklärung ist schlimmer als ein angezeigter Vorgang.

Als Fund hier notiert, weil es die **einzige** Stelle ist, die mit der Datenmenge nicht linear,
sondern quadratisch mitwächst (jede Änderung × gesamter Bestand).

---

## 🟢 F4, F7 — Kleinkram

**F4 — Kein Resource-Hint für die eigene Kette.** `app.html` hat `preconnect` und `dns-prefetch`
für `cdn.jsdelivr.net` ([app.html:11-13](../app.html#L11)) — vorbildlich für Fremdhosts. Für die
**eigenen** kritischen Ressourcen fehlt der Hinweis:

```html
<link rel="preload" as="style"  href="css/style.css">
<link rel="preload" as="script" href="js/app.js">
<link rel="preload" as="font" type="font/woff2" href="fonts/inter-var-latin.woff2" crossorigin>
```

Der Font-Preload ist der wirksamste der drei: die Schrift wird sonst erst entdeckt, wenn die CSS
geparst ist.

**F7 — `setInterval` ohne `clearInterval`.** [js/app.js:3013](../js/app.js#L3013) startet ein
10-Minuten-Backup-Intervall, das nie geräumt wird. Kein echter Leak (eine Instanz über die
Lebensdauer der Seite), aber wenn `_startPeriodicBackup()` je zweimal aufgerufen wird, laufen
zwei Timer. Handle merken und vor dem Neustart räumen — Einzeiler.

---

## Geprüft und gut

**In-Memory-Store.** `js/store.js:22` hält einen `_cache` und liest **nicht** bei jedem Render aus
localStorage — genau das Muster, das der Prüfkatalog als „BESSER" beschreibt. Beim Start wird der
Cache aus IndexedDB bzw. localStorage befüllt ([js/store.js:78-111](../js/store.js#L78)).

**Chart-Aufräumen.** `js/dashboard.js` ruft an **sechs** Stellen `destroy()` vor dem Neu-Rendern
und setzt die Referenz auf `null` ([Zeilen 379-381, 451, 494, 596](../js/dashboard.js#L379)).
Kein Chart-Memory-Leak.

**Event-Delegation.** Ein globaler Handler für 350 `data-action`-Vorkommen. Keine Listener in
Render-Schleifen. Vorbildlich — und Voraussetzung dafür, dass F5 folgenlos bleibt.

**Fonts / CLS.** Self-hosted Variable Fonts (`fonts/inter-var-latin.woff2`,
`fonts/fraunces-var-latin.woff2`) mit `font-display: swap`
([css/style.css:14-26](../css/style.css#L14)). Kein externer Font-Request, kein FOIT.

**CSS-Größe.** `css/style.css` ist mit 72 KB für eine App dieses Umfangs schlank. Die
Landing-Styles (`landing.css` 38 KB, `landing-v2.css` 19 KB) werden von `app.html` **nicht**
geladen — richtig getrennt.

**CDN-Hygiene.** Alle externen Skripte mit SRI-Hash und `crossorigin`, `preconnect` gesetzt.

**Lazy-Loading als etabliertes Muster.** `_ensureApexCharts()` in `js/dashboard.js` zeigt, dass
das Muster bekannt und sauber umgesetzt ist — es wurde nur nicht überall angewendet. Das macht
F1–F3 zu Fleißarbeit statt zu Neuentwicklung.

---

## Kennzahlen (gemessen)

| Größe | Wert |
|---|---|
| Lokales JS, das `app.html` referenziert | **2.897 KB** (unkomprimiert) |
| davon Vendor | 1.129 KB (xlsx 929 + chart 200) |
| davon Anwendungscode | ~1.768 KB |
| Größte Einzeldateien | xlsx 929 · chart 200 · app.js 180 · akademie.js 169 · lager.js 163 · store.js 152 |
| CSS beim App-Start | 72 KB (+ Tabler-Icons vom CDN) |
| Script-Tags `app.html` | 67 (63 defer) |
| Blockierende Skripte Sub-Apps | 20–31 pro Seite |

**Einordnung:** Die 2,9 MB sind unkomprimiert; über die Leitung liefert Vercel Brotli, real also
grob ein Viertel. Die **Parse- und Compile-Kosten** fallen aber auf der unkomprimierten Größe an —
auf einem älteren Android-Gerät ist das der bestimmende Faktor. Nach F1–F3 blieben rund
1,7 MB übrig, und davon läge der Großteil nicht mehr im kritischen Pfad.

---

## Quick-Win Top 5

| # | Maßnahme | Wirkung | Aufwand |
|---|---|---|---|
| 1 | **`defer` an alle Script-Tags** der drei Sub-Apps (F1) | ~1,4 MB raus aus dem kritischen Pfad | Attribut-Ergänzung |
| 2 | **`xlsx` lazy laden** bei Klick auf Import/Export (F2) | −929 KB pro App-Start | ~15 Zeilen, Muster existiert |
| 3 | **ApexCharts in den Sub-Apps lazy laden** (F1, Stufe 2) | −600 KB pro Sub-Seite | `_ensureApexCharts()` übernehmen |
| 4 | **`chart.min.js` aus `eigenbelege/` entfernen** (F3) | −200 KB, wird dort nicht genutzt | 1 Zeile löschen |
| 5 | **`preload` für Font + `style.css` + `app.js`** (F4) | LCP-Verbesserung | 3 Zeilen |

Punkte 1, 4 und 5 sind zusammen unter einer Stunde und betreffen ausschließlich Markup.

---

## Empfohlene Gegenprobe

Dieses Audit ist statisch. Vor und nach den Maßnahmen messen:

```javascript
performance.mark('render-start');
Dashboard.render();
performance.mark('render-end');
performance.measure('dashboard-render', 'render-start', 'render-end');
console.table(performance.getEntriesByType('measure'));
```

Dazu ein **Lighthouse-Lauf gegen die Produktions-URL**, jeweils für `app.html` **und**
`rechnungen/index.html` — die Differenz zwischen beiden Seiten ist genau der Effekt aus F1 und
belegt den Fund unabhängig von meiner Schätzung.

---

## Langfristig

**Build-System (Vite o. ä.):** Lohnt sich, sobald der Anwendungscode über die jetzigen ~1,8 MB
hinauswächst oder die Vendor-Frage (F3) grundsätzlich angegangen wird — Minification allein dürfte
30–40 % bringen, Tree-Shaking mehr. Gegen die heutige Architektur spricht: keine Build-Stufe zu
haben ist bei einer Local-First-App ein echter Vorteil (Dateien sind direkt les- und prüfbar, was
zur Datenschutz-Erzählung passt). **Nicht vor F1–F4 anfassen** — die bringen mehr und kosten fast
nichts.

**Virtual Scrolling:** Erst wenn F5 messbar stört. Vorher reicht eine Zeilen-Obergrenze.

**Service Worker:** Für eine App, deren Daten ohnehin lokal liegen, wäre Offline-Fähigkeit der
**Anwendung** die logische Ergänzung — heute braucht der erste Aufruf zwingend Netz. Das ist
allerdings ein eigenes Vorhaben mit eigenen Fallstricken (Cache-Invalidierung bei Updates,
Zusammenspiel mit dem Whop-Gate) und gehört erst diskutiert, wenn die Ladezeit-Basics sitzen.
