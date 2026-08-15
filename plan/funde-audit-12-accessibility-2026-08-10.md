# Accessibility-Audit (Rest-Check) — Funde (2026-08-12)

**Session-Prompt:** `plan/session-prompt-audit-12-accessibility-2026-08-10.md`
**Scope:** WCAG 2.1 Level AA, Schwerpunkt auf den Bereichen, die frühere Runden ausgelassen
haben (Akademie, Lager), plus Kontrastprüfung des gesamten Farbsystems.
**Methode:** Kontrastwerte **berechnet** (WCAG-Luminanzformel), nicht geschätzt.
**Hinweis:** `css/style.css`, `js/whop-auth.js`, `js/cookie-banner.js`, `js/topnav.js` und die
HTML-Seiten waren zum Prüfzeitpunkt **uncommittet in Arbeit** (L1/L3/L4-Fixes einer anderen
Session). Geprüft wurde der Arbeitsstand vom 2026-08-12; bei diesen Dateien vor dem Fixen
gegenprüfen.

---

## Zusammenfassung

Das Farbsystem ist **durchgehend AA-konform** — alle zehn Vordergrundfarben bestehen gegen alle
fünf Hintergründe, der schwächste Wert liegt bei 4,64:1. Für ein Dark-Theme mit dem Anspruch
„Ruhige Souveränität" ist das bemerkenswert: gedämpft **und** lesbar schließen sich hier nicht aus.

Zwei echte Verstöße, beide dort, wo die früheren Runden nicht hingeschaut haben:

| # | Fund | WCAG | Level | Schwere |
|---|---|---|---|---|
| A1 | Akademie: Module und Lektionen sind **per Tastatur nicht bedienbar** | 2.1.1, 4.1.2 | **A** | 🔴 Hoch |
| A2 | Eingabefelder haben keinen erkennbaren Rand (1,47:1 statt 3:1) | 1.4.11 | **AA** | 🟠 Mittel |
| A3 | Lager: 11 klickbare `<div>`/`<tr>` ohne Tastaturpfad | 2.1.1 | **A** | 🟠 Mittel |
| A4 | Kein Skip-Link zum Hauptinhalt | 2.4.1 | **A** | 🟡 Niedrig |
| A5 | `<nav>`/`<main>` vorhanden, aber ohne `aria-label`, kein `<header>`/`<footer>` | 1.3.1 | A | 🟡 Niedrig |

---

## 🔴 A1 — Die Akademie ist per Tastatur komplett unbedienbar

**WCAG 2.1.1 Keyboard (Level A)** und **4.1.2 Name, Role, Value (Level A)**.

`js/akademie.js` enthält **null** Treffer für `aria-`, `role=` oder `tabindex` — im gesamten
Modul. Die drei zentralen Bedienelemente sind reine `<div>`s mit `cursor:pointer`:

| Element | Zeile | Markup |
|---|---|---|
| Weiterlesen-Banner | [2061](../js/akademie.js#L2061) | `<div id="akademieContinueBanner" … cursor:pointer>` |
| Modulkarte | [2127](../js/akademie.js#L2127) | `<div class="card akademie-mod-card" data-mod-id="…" … cursor:pointer>` |
| Lektionszeile | [2250](../js/akademie.js#L2250) | `<div class="card akademie-lesson-row" data-lesson-id="…" … cursor:pointer>` |

Gebunden wird ausschließlich `click`
([2337-2343](../js/akademie.js#L2337), [2366-2372](../js/akademie.js#L2366)):

```javascript
document.querySelectorAll('.akademie-lesson-row').forEach(row => {
    row.addEventListener('click', () => { … App.navigate('akademie'); });
});
```

Suche nach `keydown` oder `key ===` in der Datei: **0 Treffer.**

**Konsequenz:** Ein `<div>` ohne `tabindex` ist nicht fokussierbar. Ein Nutzer, der nur die
Tastatur bedient — motorische Einschränkung, Screenreader, oder schlicht ein defektes Trackpad —
kann **kein einziges Modul und keine einzige Lektion öffnen**. Die Akademie ist für ihn
vollständig unerreichbar. Für einen Screenreader sind die Karten außerdem namenlose Container
ohne Rolle: es wird nicht angesagt, dass sie überhaupt bedienbar sind.

**Fix — drei Attribute plus ein Handler pro Elementtyp:**

```javascript
// im Template:
<div class="card akademie-mod-card" data-mod-id="${m.id}"
     role="button" tabindex="0"
     aria-label="Modul öffnen: ${esc(m.title)}" …>

// bei der Bindung:
function activate(el, fn) {
    el.addEventListener('click', fn);
    el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    });
}
```

Sauberer wäre, die Karten als `<button type="button">` zu rendern und per CSS zu entstylen —
dann kommen Fokussierbarkeit, Rolle und Tastaturaktivierung gratis vom Browser. Das ist bei
einer Kartenoptik allerdings mehr CSS-Arbeit; die `role`/`tabindex`-Variante ist der schnellere
gleichwertige Weg.

**Aufwand:** ~30 Minuten für alle drei Elementtypen.
**Priorität: höchster Fund dieses Audits** — Level A, und ein ganzes Modul fällt aus.

---

## 🟠 A2 — Eingabefelder sind visuell nicht abgegrenzt

**WCAG 1.4.11 Non-text Contrast (Level AA)** verlangt 3:1 für die visuelle Information, die
eine Bedienkomponente erkennbar macht.

`.form-input` verwendet `border: 1px solid var(--border-light)` auf `background: var(--bg-input)`.
Berechnet:

| Paarung | Kontrast | Ziel |
|---|---|---|
| `--border-light` (#2a332e) auf `--bg-input` (#0d100f) | **1,47:1** | 3:1 ❌ |
| `--border` (#1d2421) auf `--bg-secondary` | **1,18:1** | 3:1 ❌ |
| `--border-strong` (#3a453f) auf `--bg-input` | **1,92:1** | 3:1 ❌ |

Der übliche Ausweg — das Feld hebt sich durch seine **Füllfarbe** ab, dann ist der Rand
entbehrlich — greift hier ebenfalls nicht:

| Paarung | Kontrast |
|---|---|
| `--bg-input` gegen `--bg-card` | **1,09:1** |
| `--bg-input` gegen `--bg-secondary` | **1,02:1** |

**Weder Rand noch Füllung** grenzen ein Eingabefeld erkennbar von seiner Umgebung ab. Für Nutzer
mit eingeschränktem Sehvermögen oder auf einem Bildschirm mit schwachem Kontrast ist schlicht
nicht sichtbar, wo man klicken kann — bis man zufällig hineinfokussiert.

**Entwarnung zum Fokus-Zustand:** Sobald ein Feld fokussiert ist, wechselt der Rand auf
`--accent` — **7,54:1** gegen die Feldfüllung. Der Fokus-Indikator ist also klar über dem
Grenzwert und erfüllt 2.4.7 problemlos. Das Problem betrifft ausschließlich den **Ruhezustand**.

**Fix:** `--border-light` für Formularränder auf einen Wert anheben, der 3:1 gegen `--bg-input`
erreicht — das ist etwa `#4a5651` (≈3,0:1). Alternativ nur eine eigene Variable für Feldränder
einführen (`--border-field`), damit die dekorativen Trennlinien im Rest der Oberfläche ihre
dezente Wirkung behalten. Letzteres ist der Weg, der das Designsystem nicht beschädigt:

```css
:root { --border-field: #4a5651; }   /* 3.0:1 gegen --bg-input */
.form-input, .form-select, .form-textarea { border: 1px solid var(--border-field); }
```

**Aufwand:** zwei Zeilen plus ein visueller Gegencheck.

---

## 🟠 A3 — Lager: klickbare Zeilen und Kacheln ohne Tastaturpfad

11 Elemente in `lager/page.js` tragen `cursor:pointer`, darunter:

- [lager/page.js:129](../lager/page.js#L129) — `<tr class="buch-artikel-row" data-buch-id="…"
  style="cursor:pointer;">`: die ganze Zeile ist klickbar.
- [lager/page.js:623](../lager/page.js#L623) — eine 52×52-Kachel (Foto-Upload) als `<div>`.

**Abgeschwächt** gegenüber A1: Die Tabellenzeile enthält zusätzlich eine echte
`<input type="checkbox">` ([Zeile 132](../lager/page.js#L132)), die per Tastatur erreichbar ist —
für das Auswählen gibt es also einen Ersatzweg. Die Zeilen-Klickfläche ist Komfort, nicht die
einzige Bedienung. Die Foto-Kachel dagegen hat keinen erkennbaren Ersatz.

**Fix:** Wie A1 — `role="button"`, `tabindex="0"` und ein Enter/Space-Handler; bei der Foto-Kachel
besser ein echtes `<label for="…">` auf ein verstecktes `<input type="file">`, dann ist die
Tastaturbedienung nativ korrekt.

---

## Kontrastprüfung — vollständige Matrix (berechnet)

Alle Werte nach WCAG-Luminanzformel gegen die fünf definierten Hintergründe:

| Farbe | bg-primary | bg-secondary | bg-card | bg-input | bg-elevated |
|---|---|---|---|---|---|
| `--text-primary` #eef2f0 | 17,37 | 16,54 | 15,56 | 16,93 | 14,45 |
| `--text-secondary` #9ba8a1 | 7,95 | 7,57 | 7,12 | 7,75 | 6,61 |
| `--text-muted` #7d8c86 | 5,58 | 5,31 | 4,99 | 5,43 | **4,64** |
| `--accent` #10b981 | 7,73 | 7,37 | 6,93 | 7,54 | 6,43 |
| `--accent-text` #34d399 | 10,21 | 9,72 | 9,14 | 9,95 | 8,49 |
| `--success` #22c55e | 8,61 | 8,20 | 7,71 | 8,39 | 7,16 |
| `--warning` #f5a623 | 9,68 | 9,22 | 8,67 | 9,44 | 8,05 |
| `--danger` #ef5350 | 5,63 | 5,36 | 5,04 | 5,49 | **4,68** |
| `--info` #8b93f8 | 7,13 | 6,79 | 6,38 | 6,95 | 5,93 |

**Ergebnis: 45 von 45 Paarungen bestehen AA (≥ 4,5:1).** Der niedrigste Wert ist
`--text-muted` auf `--bg-elevated` mit 4,64 — knapp, aber konform. Auch die AAA-Schwelle (7:1)
wird von `--text-primary`, `--text-secondary`, `--accent-text`, `--success` und `--warning`
durchgehend erreicht.

Das ist ein Ergebnis, das man bei Dark-Themes selten sieht — üblicherweise scheitert genau das
gedämpfte Grau. Hier wurde offensichtlich gerechnet, nicht nach Gefühl gewählt.

---

## Geprüft und korrekt

**Sprachattribut (3.1.1, Level A).** `js/i18n.js:914` setzt `document.documentElement.lang = _lang`
beim Sprachwechsel, mit ausdrücklichem WCAG-Verweis im Kommentar. Genau richtig — das wird oft
vergessen und lässt Screenreader sonst deutsche Texte englisch vorlesen.

**Live-Region für Toasts (4.1.3, Level AA).** `js/utils.js:336-342` erzeugt eine dedizierte
`#toast-aria-live`-Region mit `aria-live="polite"`, ebenfalls mit WCAG-Verweis kommentiert.
Bei 414 Toast-Aufrufen in der App ist das der Unterschied zwischen „Screenreader-Nutzer bekommt
jede Rückmeldung mit" und „er merkt nie, ob etwas gespeichert wurde".

**Automatische Label-Verknüpfung.** Die Frage des Session-Prompts, ob neue Formulare seit
2026-07-24 `Utils.linkOrphanLabels()` nutzen, beantwortet sich selbst: `startLabelObserver()`
([js/utils.js:515-523](../js/utils.js#L515)) hängt einen `MutationObserver` auf `document.body`
mit `subtree: true` und zieht jedes neu gerenderte Formular nach 60 ms automatisch nach. Neue
Formulare brauchen **nichts** zu tun. Die Implementierung ist zudem defensiv: sie überspringt
Felder, die bereits `aria-label`, `aria-labelledby`, ein umschließendes `<label>` oder eine
bestehende Verknüpfung haben, und vergibt nur bei Bedarf eine ID.

**Fokus-Indikator (2.4.7, Level AA).** Drei `outline: none` in `css/style.css` (Zeilen 1103,
1582, 2646) — alle drei **mit** Ersatz: `border-color: var(--accent)` plus
`box-shadow: 0 0 0 3px var(--accent-glow)`. Der Glow allein wäre zu schwach (10 % Deckkraft),
aber der Randwechsel auf `--accent` trägt den Indikator mit **7,54:1**. Konform.

**Fokus-Falle in den Gate-Overlays.** `js/whop-auth.js` sperrt beim Öffnen alle Body-Geschwister
per `inert` + `aria-hidden` und fängt Tab im Overlay (aus dem Security-Fix `aa1c941`). Sauber
gelöst.

**Touch-Targets (2.5.5).** `min-height/width: 44px` im Mobile-Breakpoint, mit ausdrücklichem
WCAG-Verweis (`css/style.css:933-950, 2540-2541`) und bewusst nur mobil gesetzt, damit Desktop
kompakt bleibt.

**Tabellen-Semantik.** `<th scope="col">` wird verwendet (z. B.
[rechnungen/js/mahnungen.js:117](../rechnungen/js/mahnungen.js#L117)).

**ESC-Handler** in allen vier Bereichen vorhanden (siehe UI-Checker-Audit).

---

## 🟡 A4 / A5 — Navigation und Landmarks

**A4 — Kein Skip-Link (2.4.1 Bypass Blocks, Level A).** `app.html` enthält keinen
„Zum Inhalt springen"-Link. Ein Tastaturnutzer muss sich bei jedem Seitenwechsel durch die
komplette Sidebar-Navigation tabben, bevor er den Inhalt erreicht.

```html
<!-- direkt nach <body>, per CSS bis :focus versteckt -->
<a href="#mainContent" class="skip-link">Zum Inhalt springen</a>
```

**A5 — Landmarks unvollständig (1.3.1).** Vorhanden sind `<nav class="sidebar-nav">` und
`<main class="main-content">` — beides ohne `aria-label`, und es gibt weder `<header>` noch
`<footer>`. Bei **zwei** Navigationsbereichen (Topnav mit den App-Tabs und Sidebar mit den
Modulen) ist die Unterscheidung für Screenreader-Nutzer relevant:

```html
<nav class="topnav" aria-label="Anwendungen">
<nav class="sidebar-nav" aria-label="Module">
```

Beide Punkte sind Level-A-nah, aber mit geringem Leidensdruck — die App ist auch ohne sie
bedienbar, nur umständlicher.

---

## Nicht abschließend prüfbar

**Edge-Tastaturtest.** Bleibt offen und ist auch in diesem Lauf nicht zu erledigen: Die
Browser-Automatisierung hat kein echtes `document.hasFocus()`, die native Tab-Traversierung und
der sichtbare Fokus-Ring lassen sich nur manuell verifizieren. Die **Logik** ist geprüft
(Fokus-Falle, ESC, Fokus-Ring-Kontrast berechnet) — die **Wahrnehmung** nicht.
→ Bleibt beim Nutzer, gebündelt mit den anderen Live-Tests.

**Farbblindheit (Charts).** Einnahmen grün (`#10b981`), Ausgaben rot (`#ef5350`) — bei
Rot-Grün-Schwäche (rund 8 % der Männer) schwer unterscheidbar. In den **Tabellen** ist das
entschärft, weil zusätzlich ein Vorzeichen steht (`+`/`−`, siehe
[js/bank-import.js:398](../js/bank-import.js#L398)) und Badges Text tragen („Einnahme"/„Ausgabe").
In den **ApexCharts** trägt allein die Farbe. Ob das in der Praxis stört, hängt an der
Chart-Legende und ist ohne Sichtprüfung nicht seriös zu beurteilen — deshalb hier nur als
Beobachtung, nicht als Fund. Falls angefasst: unterschiedliche Strichmuster oder Marker-Formen
statt einer zweiten Farbdimension.

---

## Priorisierung

```
🔴 LEVEL A — Muss
  A1  Akademie per Tastatur unbedienbar (2.1.1, 4.1.2). Ein komplettes Modul fällt für
      Tastatur- und Screenreader-Nutzer aus. ~30 Minuten.
  A3  Lager: klickbare Zeilen/Kacheln ohne Tastaturpfad (2.1.1). Abgeschwächt durch die
      Checkbox als Ersatzweg; die Foto-Kachel hat keinen.

🟠 LEVEL AA — Soll
  A2  Eingabefelder ohne erkennbare Abgrenzung (1.4.11): 1,47:1 statt 3:1, und die
      Füllung hilft mit 1,09:1 auch nicht. Zwei Zeilen CSS.

🟡 LEVEL A, geringer Leidensdruck
  A4  Skip-Link ergänzen (2.4.1).
  A5  aria-label an die beiden <nav>, <header>/<footer> ergänzen (1.3.1).

✅ ERFÜLLT
  1.4.3 Kontrast (45/45 Paarungen AA, viele AAA) · 2.4.7 Fokus sichtbar (7,54:1) ·
  2.5.5 Touch-Targets · 3.1.1 Sprachattribut mit i18n-Umschaltung · 4.1.3 Live-Region
  für Toasts · Label-Verknüpfung automatisch per MutationObserver · Fokus-Falle in den
  Gate-Overlays · <th scope> · ESC-Handler überall
```

## Quick-Win-Liste

| # | Fix | Wirkung | Aufwand |
|---|---|---|---|
| 1 | `role="button"` + `tabindex="0"` + Enter/Space an die drei Akademie-Elemente | Level-A-Verstoß weg, Modul wird nutzbar | ~30 Min |
| 2 | `--border-field` mit 3:1 einführen und in `.form-input` verwenden | Level-AA-Verstoß weg | ~10 Min |
| 3 | Skip-Link in die vier App-Seiten | 2.4.1 erfüllt | ~10 Min |
| 4 | `aria-label` an Topnav und Sidebar | Orientierung im Screenreader | ~5 Min |
| 5 | Foto-Kachel im Lager auf `<label>` + `<input type="file">` umbauen | nativ tastaturbedienbar | ~15 Min |

Alle fünf zusammen liegen unter anderthalb Stunden.
