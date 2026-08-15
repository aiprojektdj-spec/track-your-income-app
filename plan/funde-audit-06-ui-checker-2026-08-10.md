# UI-Bug-Audit (app-weit) — Funde (2026-08-10)

**Session-Prompt:** `plan/session-prompt-audit-06-ui-checker-2026-08-10.md`
**Scope:** Web 1.7, Schwerpunkt auf den Bereichen, die die UI-Politur-Runden **nicht** abgedeckt
haben (Rechnungen, Eigenbelege, Dashboard, Onboarding, Akademie).
**Methode:** Statische Analyse. Jede Klassen-/Selektor-Behauptung wurde gegen **alle** Quellen
gegengeprüft — externe CSS, Inline-`<style>`-Blöcke in HTML **und** per JS injizierte Stylesheets.

---

## Zusammenfassung

**Drei echte Rendering-Bugs**, alle aus derselben Ursache: CSS-Klassen werden im JS gesetzt,
sind aber nirgends definiert. Der schwerste betrifft **34 Buttons in fünf Modulen**, die dadurch
im Browser-Grau statt im Design-System erscheinen.

Gleichzeitig eine wichtige **Entwarnung**: Die Vermutung aus dem Session-Prompt, die nicht
polierten Module seien vom Design-System abgedriftet, hat sich **nicht bestätigt**.

| # | Fund | Umfang | Severity |
|---|---|---|---|
| C1 | `.action-btn` (+4 Modifier) nirgends definiert — kein `button{}`-Fallback | 34× in 5 Modulen | 🔴 Hoch |
| C2 | `.akademie-tip` nirgends definiert — alle Merkkästen rendern als Fließtext | 43× | 🟠 Mittel |
| C3 | `.data-table` nirgends definiert | 15× in 9 Modulen | 🟡 Niedrig |
| C4 | Versions-Kommentar zeigt auf die falsche Datei | 1× | 🟡 Niedrig |

---

## 🔴 C1 — `.action-btn` ist nirgends definiert (34 Buttons)

**Verifiziert:** Weder `css/style.css`, noch ein Inline-`<style>`-Block, noch ein per JS
injiziertes Stylesheet definiert `.action-btn`. Zusätzlich geprüft: `css/style.css` enthält
**kein globales `button { … }`** — es gibt also auch keinen Auffangschirm.

Betroffen sind fünf Module, davon zwei, die die Politur ausgelassen hat:

| Datei | Beispiel |
|---|---|
| [eigenbelege/js/app.js:370-371](../eigenbelege/js/app.js#L370) | Ansehen / Bearbeiten / Löschen in der Belegtabelle |
| [rechnungen/js/dokumente.js](../rechnungen/js/dokumente.js) | Aktionsspalte der Rechnungsliste |
| [rechnungen/js/wiederkehrend.js](../rechnungen/js/wiederkehrend.js) | Wiederkehrende Rechnungen |
| [js/gbr.js](../js/gbr.js) | GbR-Modul |
| [js/lager.js](../js/lager.js) | Lager |

```html
<!-- eigenbelege/js/app.js:370 -->
<button class="action-btn" data-action="eb-view" title="Ansehen"><i class="ti ti-eye"></i></button>
<button class="action-btn action-btn-accent" data-action="eb-edit" …>
```

Ebenfalls undefiniert: `.action-btn-accent`, `.action-btn-danger`, `.action-btn-success`,
`.action-btn-warning`. Die Farbcodierung, die der Code offensichtlich beabsichtigt (Bearbeiten =
Akzent, Löschen = Rot), existiert visuell **gar nicht** — alle Varianten sehen identisch aus.

**Auswirkung:** Diese Buttons erscheinen als graue Browser-Standardknöpfe mit Systemschrift,
mitten in Tabellen, die sonst dem Design-System folgen. Genau in den beiden Modulen, die ein
Nutzer täglich benutzt (Rechnungen, Eigenbelege).

**Fix:** Einen Block in `css/style.css` ergänzen, angelehnt an das vorhandene `.btn`-Muster:

```css
.action-btn {
    background: var(--surface-2); border: 1px solid var(--border);
    color: var(--text-secondary); border-radius: var(--radius-sm);
    padding: 5px 8px; cursor: pointer; line-height: 1;
    min-width: 32px; min-height: 32px;      /* Mobile: 44px, s. bestehende Media-Query */
    transition: background .15s, color .15s, border-color .15s;
}
.action-btn:hover   { background: var(--surface-3); color: var(--text-primary); }
.action-btn-accent  { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
.action-btn-danger  { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 40%, transparent); }
.action-btn-success { color: var(--success); }
.action-btn-warning { color: var(--warning); }
```

**Hinweis zur Barrierefreiheit:** Diese Buttons enthalten nur ein Icon und tragen ihre Bedeutung
im `title`-Attribut. Beim Nachrüsten des CSS gleich `aria-label` mitsetzen und die
44-px-Mobile-Regel prüfen (`css/style.css:2540` deckt heute nur `.btn`/`.btn-sm` ab).

---

## 🟠 C2 — `.akademie-tip` ist nirgends definiert (43 Merkkästen)

**Verifiziert:** `.akademie-tip` kommt **43×** in [js/akademie.js](../js/akademie.js) vor, ist aber
in keiner CSS-Datei, keinem Inline-`<style>` und keinem injizierten Stylesheet definiert.
Die Elemente tragen auch **keine Inline-Styles**:

```html
<!-- js/akademie.js:40 -->
<div class="akademie-tip">💡 <strong>Realität:</strong> Reselling ist <em>kein</em> passives Einkommen. …</div>
<!-- js/akademie.js:69 -->
<div class="akademie-tip">⚠️ <strong>Fauler Trick FAIL:</strong> „Ich verkauf einfach unter falschem Namen" …</div>
```

**Auswirkung:** Was als hervorgehobener Merkkasten gedacht ist — Praxis-Tipps, Steuer-Hinweise,
Warnungen — rendert als ganz normaler Fließtext. Der einzige verbliebene Unterschied ist das
Emoji am Zeilenanfang. In einem Lernmodul ist die visuelle Trennung von Merksatz und Fließtext
aber genau der Punkt; ohne sie liest sich die Lektion als undifferenzierte Textwand.

Da die Kästen zwischen 💡 (Tipp) und ⚠️ (Warnung) unterscheiden, lohnt eine Variante:

```css
.akademie-tip {
    background: var(--surface-2); border-left: 3px solid var(--accent);
    border-radius: var(--radius-sm); padding: 12px 14px; margin: 14px 0;
    font-size: 13.5px; line-height: 1.65; color: var(--text-secondary);
}
```

Ebenfalls geprüft und **kein Problem**: `.akademie-mod-card`, `.akademie-lesson-row`,
`.akademie-lesson-content` tauchen zwar in der Klassenliste auf, werden aber **0×** tatsächlich
gerendert — Altlasten in der Suchliste, keine Bugs.

---

## 🟡 C3 — `.data-table` ist nirgends definiert (15×)

Verwendet in neun Steuer-/Auswertungsmodulen: `js/afa.js`, `js/ksk.js`, `js/lohnsteuer.js`,
`js/oesterreich.js`, `js/oss.js`, `js/privatbuchungen.js`, `js/protokoll.js`,
`js/ustvoranmeldung.js`, `js/vorsteuer.js`.

**Deutlich harmloser als C1**, weil `css/style.css:1150` ein globales `table { … }` definiert —
die Tabellen bekommen also Grundstyling und sehen nicht kaputt aus. Die Klasse ist damit
schlicht wirkungslos: entweder ein Rest aus einem früheren Stand oder eine nie gebaute Variante.

**Fix:** Entweder `.data-table` definieren (falls die Steuermodul-Tabellen eine eigene Optik
bekommen sollen — z. B. kompaktere Zeilen für Zahlenkolonnen), oder die Klasse ersatzlos
entfernen. Nichts zu tun ist auch vertretbar; dann aber bewusst.

---

## 🟡 C4 — Versions-Kommentar zeigt auf die falsche Datei

[js/app.js:6](../js/app.js#L6):

```javascript
APP_VERSION: '1.7',  // ← bei jedem Update hier UND in index.html anpassen
```

Die sichtbare Versionsangabe steht aber in [app.html:188](../app.html#L188)
(`<span class="version-badge">Stackr v1.7</span>`). In `index.html` — inzwischen die Landingpage —
gibt es **keine** Versionsanzeige (die „1.7"-Treffer dort sind `stroke-width="1.75"` in
SVG-Symbolen).

**Auswirkung:** Wer beim nächsten Versionssprung dem Kommentar folgt, editiert die falsche Datei
und lässt das Badge in `app.html` auf dem alten Stand stehen.

**Fix:** Kommentar auf `app.html` korrigieren.

---

## Entwarnung: kein Design-System-Drift

Der Session-Prompt vermutet, die nicht polierten Module seien vom Design-System („Ruhige
Souveränität", dark + emerald) abgedriftet. **Ein erster Zähllauf schien das zu bestätigen** —
`js/dashboard.js` 23 hartkodierte Hex-Werte, `js/statistiken.js` 20,
`rechnungen/js/rechnung.js` 41, `eigenbelege/js/app.js` 49, gegenüber nur 1 bzw. 2 in den
polierten `lager/page.js` und `js/app.js`.

**Die Einzelprüfung entkräftet das vollständig.** Jede Fundstelle ist legitim:

- **`js/dashboard.js`, `js/statistiken.js`** — ApexCharts-Konfiguration. Chart-Bibliotheken
  können keine CSS-Variablen auflösen, sie brauchen Literale. Der Code macht es sogar
  **richtig** und wählt je nach Theme: `const textColor = isDark ? '#94a3b8' : '#64748b'`
  ([js/dashboard.js:396](../js/dashboard.js#L396)), ebenso für `grid.borderColor`.
- **`rechnungen/js/rechnung.js`** — ab [Zeile 1149](../rechnungen/js/rechnung.js#L1149) das
  **Druck-Stylesheet** der Rechnung (`.inv-wrap{background:#fff;color:#1e293b;…}`). Eine Rechnung
  muss unabhängig vom App-Theme auf weißem Papier lesbar sein; hier wären CSS-Variablen sogar
  ein Fehler. `#4f46e5` ist der Vorgabewert für die nutzerkonfigurierbare Akzentfarbe.
- **`eigenbelege/js/app.js`, `js/companies.js`** — **Farbpaletten als Daten**, nicht als Styling:
  Kategorie-Farben ([eigenbelege/js/app.js:159-171](../eigenbelege/js/app.js#L159)) und die
  Firmenfarben-Auswahl ([js/companies.js:10-14](../js/companies.js#L10)). Ein Nutzer wählt hier
  eine konkrete Farbe aus — die muss literal sein.
- **`js/whop-auth.js`** — 40 Hex-Werte, davon der Großteil als `var(--surface,#1e1e2e)`, also
  **Fallbacks**. Richtig so: die Gate-Overlays müssen auch dann korrekt aussehen, wenn sie vor
  dem Laden von `style.css` erscheinen.

**Fazit:** Die Kennzahl „hartkodierte Hex-Werte" ist für dieses Projekt kein brauchbarer
Drift-Indikator. Die Design-System-Disziplin ist app-weit in Ordnung.

---

## Prüfkatalog A–J: Ergebnis

**A — Topnav-Konsistenz ✅** Alle vier App-Seiten (`app.html`, `lager/`, `rechnungen/`,
`eigenbelege/`) haben je genau ein `#companySwitcher`, laden `topnav.js` und `companies.js` und
binden das Whop-Gate ein. Kein Ausreißer. (`#cloudSyncDot` fehlt im HTML **korrekterweise** — es
wird von `_injectWidget()` in [js/whop-auth.js:627-635](../js/whop-auth.js#L627) erzeugt.)
Zunächst als doppelte `topnav.js`-Einbindung verdächtigt — **Fehlalarm**, die Zweittreffer sind
Klassennamen und Kommentare.

**B — Responsive ✅** `sidebar-open` wird durchgängig verwendet
([js/app.js:376-420, 561](../js/app.js#L376)), nirgends die verwechselbare Kurzform `open`.
Der einzige `'open'`-Treffer ([js/landing.js:355](../js/landing.js#L355)) gehört zum
FAQ-Akkordeon der Landingpage — anderer Kontext, korrekt.

**C — Chart-/Countup-Werte ✅** Keine ungeschützten `parseFloat`-Verhältnisrechnungen gefunden.

**D — Stat-Cards / NaN-Guards ✅** `js/akademie.js:2011` schützt die Prozentrechnung sauber
(`totalLessons > 0 ? … : 0`), und der Fallback-Zweig
([js/akademie.js:1948-1952](../js/akademie.js#L1948)) initialisiert `activeStock`,
`activeStockValue` usw. explizit mit `0`.

**E — Auth-Widget ✅** Fallback-Kette vorhanden
(`user.username || (user.email||'').split('@')[0] || 'Whop'`,
[js/whop-auth.js:642](../js/whop-auth.js#L642)).

**F — Version/Meta ⚠️** `APP_VERSION: '1.7'` stimmt mit dem Badge überein — nur der Kommentar
ist falsch (**C4**). Titel: `app.html` heißt nur „Stackr", die Sub-Apps sind beschriftet — das
ist bereits als **U10** im UX-Audit erfasst, hier nicht doppelt gezählt.

**G — Skript-Pfade ✅** Alle Sub-Seiten laden korrekt über `../js/…`, alle CDN-Einbindungen mit
SRI-Hash und `crossorigin`.

**H — CSS-Variablen ✅** Siehe Entwarnung oben.

**I — Modal/Overlay ✅** ESC-Handler in allen vier Bereichen vorhanden (`js/app.js`,
`rechnungen/js/app.js`, `eigenbelege/js/app.js`, `lager/page.js`). Die Gate-Overlays haben
zusätzlich seit `aa1c941` eine Fokus-Falle mit `inert`-Sperre der Hintergrund-Elemente.

**J — Branding ✅** Kein „TrackYourIncome" mehr in ausgelieferten Dateien. Einziger Treffer:
`graphify-out/graph.html` — ein generiertes Analyse-Artefakt, das nicht zum Produkt gehört.

**Folgeschäden von `020a0c5` (tote `.auth-modal`-CSS entfernt) ✅** Suche nach `auth-modal` über
`js/`, `rechnungen/`, `eigenbelege/`, `lager/`, alle HTML und alle CSS: **null Treffer**.
Sauber entfernt, keine verwaisten Referenzen.

---

## Reihenfolge

1. **C1** — `.action-btn`-Block in `css/style.css` ergänzen. Ein CSS-Block behebt 34 falsch
   gerenderte Buttons in fünf Modulen, darunter die beiden meistgenutzten. Klar der erste Schritt.
2. **C2** — `.akademie-tip` definieren. Ein weiterer kleiner Block, macht 43 Merkkästen sichtbar.
3. **C4** — Kommentar in `js/app.js:6` korrigieren (Einzeiler).
4. **C3** — entscheiden: `.data-table` definieren oder entfernen.
