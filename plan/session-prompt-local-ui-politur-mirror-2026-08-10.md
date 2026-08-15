# Session-Prompt: UI-Politur-Fixes von Web 1.7 nach Local 1.7 spiegeln

**Kontext:** Ein App-weiter UI-Politur-Audit auf `Web 1.7` (Finanzen-Modul + Lager/Steuer/KSK/EÜR)
hat 13 Abweichungen vom Design-System gefunden und in zwei Commits gefixt:
- `71f8376` — Finanzen-Modul (Eigenbelege-Toast, Bank-Import-Tabelle, +Neu-Icons, AfA-Empty-State)
- `253d28f` — Lager, Materiallager, Kassenbuch, Vorsteuer, KSK, EÜR

`Local 1.7` ist eine strukturell (fast) identische Parallel-Codebase mit eigenem Git-Repo
(branch `main`) — siehe Memory `stackr-project-layout`. Da beide Codebasen unabhängig entstehen,
hat Local vermutlich dieselben Abweichungen, aber **garantiert nicht** — Local liegt in einigen
Bereichen bei der Input-Härtung sogar *voraus* (Memory: „Drift läuft in beide Richtungen"). Diese
Session soll die 13 Fixes NICHT blind kopieren, sondern für jede Datei erst verifizieren, ob der
Bug in Local überhaupt existiert (Local kann seit dem letzten Sync 2026-07-07 andere Änderungen an
denselben Dateien bekommen haben), und nur dann den äquivalenten Fix anwenden.

## Schritt 0 — Kollisionscheck (PFLICHT, zuerst)

```bash
cd "C:\Users\secon\Desktop\TrackYourIncome\Local 1.7"
git status --porcelain
```

Stand beim Schreiben dieses Prompts (2026-08-10): `app.html`, `eigenbelege/index.html`,
`js/dashboard.js` waren uncommittet von einer unklaren Session verändert — **diese drei Dateien
NICHT anfassen**, falls der Zustand noch besteht. Prüfe außerdem via `list_sessions`
(`mcp__ccd_session_mgmt__list_sessions`), ob aktuell eine andere Session mit `cwd` in `Local 1.7`
läuft, bevor du Dateien änderst — dieses Repo wird regelmäßig parallel bearbeitet (siehe Memory
`multi-session-coordination-technique`).

Prüfe zusätzlich kurz den offenen Fund aus `plan/rest-offen-2026-08-09.md` / Memory
`local17-userplan-failopen-bug`: ist `js/user-plan.js` in Local vorhanden und Teil des committeten
Stands (`git log -1 -- js/user-plan.js`, `git status --porcelain -- js/user-plan.js`)? Falls die
Datei wieder fehlt oder uncommittet als gelöscht markiert ist, das VOR den UI-Fixes melden bzw.
klären — höhere Priorität (Pro-Gate/Buchungslimit liefen dadurch fail-open auf 3 Seiten).

## Schritt 1 — Für jede der 8 betroffenen Dateien: existiert der Bug in Local?

Die 13 Fixes verteilen sich auf 8 Dateien. Für jede Datei: öffne die Local-Version, suche den
`old_string` unten. Falls exakt (oder sinngemäß, ggf. mit anderen Zeilennummern) vorhanden → Fix
übertragen. Falls nicht (weil Local schon anders/besser gebaut ist, oder die Stelle gar nicht
existiert) → überspringen und kurz notieren warum.

### `eigenbelege/js/app.js` — Toast-Funktion
```diff
 function toast(msg, type='success') {
-    const colors = { success:'#10b981', danger:'#ef4444', warning:'#f59e0b', info:'#3b82f6' };
-    const el = Object.assign(document.createElement('div'), { textContent: msg });
-    Object.assign(el.style, {
-        position:'fixed', bottom:'24px', right:'24px', zIndex:'9999',
-        padding:'11px 18px', borderRadius:'8px', fontSize:'13px', fontWeight:'600',
-        background: colors[type]||colors.info, color:'#fff',
-        boxShadow:'0 4px 14px rgba(0,0,0,0.35)', maxWidth:'320px',
-        transition:'opacity .3s'
-    });
-    document.body.appendChild(el);
-    setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, 2800);
+    // Delegiert an die zentrale Utils.showToast (Notyf, aria-live, Theme-Farben)
+    // statt eigener Hex-Farben/DOM-Bastelei — type 'danger' (Notyf kennt nur 'error') wird gemappt.
+    Utils.showToast(msg, type === 'danger' ? 'error' : type);
 }
```
**Voraussetzung prüfen:** Lädt die Local-Seite `js/utils.js` VOR `eigenbelege/js/app.js` (Script-
Reihenfolge in `eigenbelege/index.html` bzw. `app.html`)? In Web war das der Fall — bei Local via
`git status` als aktuell "in Arbeit" markiert (`eigenbelege/index.html` uncommittet), also besonders
sorgfältig prüfen, nicht blind annehmen.

### `js/afa.js` — zwei Stellen
```diff
         const emptyRow = aktive.length === 0
-            ? `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px;">Noch keine Wirtschaftsgüter erfasst</td></tr>`
+            ? `<tr><td colspan="9" class="table-empty">Noch keine Wirtschaftsgüter erfasst</td></tr>`
             : '';
...
-                <button class="btn btn-primary" data-action="afa-form">+ Anlage erfassen</button>
+                <button class="btn btn-primary" data-action="afa-form"><i class="ti ti-plus"></i> Anlage erfassen</button>
```

### `js/app.js` — `_MODAL_ICON_MAP` um ein Icon ergänzen
```diff
         '📥': 'ti-download', '📍': 'ti-map-pin', '✏️': 'ti-pencil', '✏': 'ti-pencil',
+        '➕': 'ti-plus',
     },
```
Prüfe danach, ob `➕`-Modal-Titel in Local an mehreren Stellen auftauchen (in Web betraf das
`ksk.js` UND `privatbuchungen.js` gleichzeitig — `grep -rn "showModal('➕" js/`), der Fix wirkt
app-weit sobald die Map ergänzt ist.

### `js/bank-import.js` — CSV-Vorschautabelle (komplette Sektion, ca. 30 Zeilen)
Inline-Styles durch `.table-container`/`.badge`-Klassen ersetzen. Vollen Diff siehe
`git -C "../Web 1.7" show 253d28f -- js/bank-import.js` (oder `git show 71f8376 -- js/bank-import.js`
im Web-Repo) als Referenz — zu lang für hier, aber mechanisch identisch: `<th style="padding:8px
12px;...">` → `<th>`, Badge-Span mit `rgba(...)` → `<span class="badge badge-success|danger">`.

### `js/buchungen.js`
```diff
-                        <button type="button" class="btn btn-primary" id="addItemBtn">+ Hinzufügen</button>
+                        <button type="button" class="btn btn-primary" id="addItemBtn"><i class="ti ti-plus"></i> Hinzufügen</button>
```

### `js/fahrtenbuch.js`
```diff
-                    <button class="btn btn-primary" id="fbNeuBtn">+ Neue Fahrt</button>
+                    <button class="btn btn-primary" id="fbNeuBtn"><i class="ti ti-plus"></i> Neue Fahrt</button>
```

### `js/euer.js` — Ausgaben-Drilldown, 5 Stellen
```diff
-                <td style="${tdStyle}"><span style="padding:2px 8px;border-radius:10px;background:rgba(99,102,241,.12);color:var(--accent);font-size:11px;">${Utils.escapeHtml(e.kategorie||'Sonstiges')}</span></td>
+                <td style="${tdStyle}"><span class="badge badge-info">${Utils.escapeHtml(e.kategorie||'Sonstiges')}</span></td>
...
-                <td style="${tdStyle}"><span style="padding:2px 8px;border-radius:10px;background:rgba(245,158,11,.12);color:var(--warning);font-size:11px;">Eigenbeleg</span></td>
+                <td style="${tdStyle}"><span class="badge badge-warning">Eigenbeleg</span></td>
...
-                <div style="...">🛒 Wareneinkauf (...)</div>
+                <div style="..."><i class="ti ti-shopping-cart"></i> Wareneinkauf (...)</div>
...
-                <div style="...">💼 Betriebsausgaben (...)</div>
+                <div style="..."><i class="ti ti-briefcase"></i> Betriebsausgaben (...)</div>
...
-                <div style="...">🧾 Eigenbelege (...)</div>
+                <div style="..."><i class="ti ti-receipt"></i> Eigenbelege (...)</div>
```

### `js/kassenbuch.js` — Storno-Zeilen
```diff
                 const typBadge = isSt
-                    ? '<span class="badge" style="background:rgba(100,116,139,.2);color:#94a3b8;">Storniert</span>'
+                    ? '<span class="badge badge-neutral">Storniert</span>'
                     : ...
-                const rowStyle = isSt ? 'opacity:.45;text-decoration:line-through;' : '';
                 const balanceCell = isSt ? '—' : Utils.formatCurrency(balance);
-                const balanceColor = isSt ? 'var(--text-muted,#888)' : (...);
+                const balanceColor = isSt ? 'var(--text-muted)' : (...);
                 rowParts.push(`
-                <tr style="${rowStyle}">
+                <tr class="${isSt ? 'row-storniert' : ''}">
```
(alle `var(--text-muted,#888)` in dieser Funktion auf `var(--text-muted)` vereinheitlichen — prüfen
ob `--text-muted` in Local's `css/style.css` existiert, sollte da sein.)

### `js/vorsteuer.js` — 3× identischer Löschbutton
```diff
-<td><button style="background:none;border:none;cursor:pointer;color:var(--text-muted);" data-action="vst-del" data-args='["${e.id}"]' >🗑</button></td>
+<td><button class="btn btn-small btn-danger" title="Löschen" data-action="vst-del" data-args='["${e.id}"]'><i class="ti ti-trash"></i></button></td>
```

### `js/ksk.js` — 4 Buttons
```diff
-<button class="btn btn-primary" data-action="ksk-config">⚙️ KSK-Konfiguration</button>
+<button class="btn btn-primary" data-action="ksk-config"><i class="ti ti-settings"></i> KSK-Konfiguration</button>
-<button class="btn btn-primary" data-action="ksk-save-gemeldet">💾 Als gemeldetes EK speichern</button>
+<button class="btn btn-primary" data-action="ksk-save-gemeldet"><i class="ti ti-device-floppy"></i> Als gemeldetes EK speichern</button>
-<button class="btn btn-primary" data-action="ksk-save-config">💾 Speichern</button>
+<button class="btn btn-primary" data-action="ksk-save-config"><i class="ti ti-device-floppy"></i> Speichern</button>
-<button class="btn btn-primary" data-action="ksk-save-meldung">💾 Speichern</button>
+<button class="btn btn-primary" data-action="ksk-save-meldung"><i class="ti ti-device-floppy"></i> Speichern</button>
```

### `js/lager.js` — redundante Toast-Emoji-Präfixe, 6 Stellen
Entferne `✅ `/`⚠️ ` am Anfang der `Utils.showToast(...)`-Strings (der `type`-Parameter liefert das
Icon bereits, `Utils.showToast` strippt Emoji-Präfixe ohnehin automatisch — reines Aufräumen, keine
Verhaltensänderung):
- `` `✅ Verkauf gespeichert...` `` → `` `Verkauf gespeichert...` ``
- `'⚠️ ' + err` → `err`
- `isEdit ? '✅ Zone gespeichert' : '✅ Zone hinzugefügt'` → ohne Präfix
- `` `✅ ${selected.length} Artikel → ...` `` → ohne Präfix
- `zoneName ? \`✅ → ${zoneName}\` : ...` → ohne Präfix
- `` `✅ EK → ${Utils.formatCurrency(newVal)}` `` → ohne Präfix

**NICHT anfassen:** die `ZICONS`/`ICONS`-Emoji-Maps (`{regal:'🗄️', box:'📦', ...}`) im selben File —
das war im Web-Audit bewusst ausgeklammert (füttert einen 3D-Floorplan-Renderer, zu riskant ohne
visuelle Verifikation, siehe Memory `ui-politur-app-weit-2026-08-10`). Falls Local dieselbe Struktur
hat, hier ebenfalls nichts ändern.

### `js/materiallager.js`
```diff
-                        style="...border-bottom:${this._tab === t.id ? '2px solid var(--primary)' : 'none'};"
+                        style="...border-bottom:${this._tab === t.id ? '2px solid var(--accent)' : 'none'};"
...
-                return `<tr${warn ? ' style="background:rgba(239,68,68,0.04);"' : ''}>
+                return `<tr${warn ? ' style="background:var(--danger-bg);"' : ''}>
```
(`--primary` existiert im Web-Token-Set gar nicht, prüfen ob das in Local genauso ist.)

### `lager/index.html` — Schnellfilter-Statuspunkte
```diff
-<span class="icon" style="color:#22c55e;">   →  style="color:var(--success);"
-<span class="icon" style="color:#3b82f6;">   →  style="color:var(--info);"
-<span class="icon" style="color:#6b7280;">   →  style="color:var(--text-muted);"  (Verkauft)
-<span class="icon" style="color:#ef4444;">   →  style="color:var(--danger);"
-<span class="icon" style="color:#9ca3af;">   →  style="color:var(--text-muted);"  (Ausgelistet)
```

## Schritt 2 — Verifikation

- `node --check` auf jeder geänderten Datei.
- Keine visuellen Screenshots nötig für reine Klassen-/Token-Swaps, aber falls ein Preview-Server
  läuft: kurz durchklicken (Local hängt nicht am Whop-Gate, dort sollte das ohne Login gehen — siehe
  Memory `stackr-project-layout` zur Local-Auth-Differenz, ggf. `js/license.js`/Demo-Key prüfen).
- `git diff --stat` gegenrechnen: sollte ~8 Dateien zeigen, ähnliche Zeilenzahl wie im Web-Diff
  (31+31 insertions/deletions über beide Web-Commits) — deutlich mehr oder weniger deutet auf
  ungewollte Kollateralschäden hin.

## Schritt 3 — Commit

Getrennt committen wie im Web (zwei thematische Commits oder ein zusammengefasster — deine Wahl,
aber NICHT zusammen mit den aktuell uncommitteten `app.html`/`eigenbelege/index.html`/
`js/dashboard.js`-Änderungen vermischen, falls die noch offen sind). Commit-Message-Stil siehe
`git -C "../Web 1.7" log --oneline -5` als Referenz (kurzer Titel, Fließtext-Body, kein
Co-Authored-By nötig sofern hier nicht anders vorgegeben).

## Referenz

Volle Diffs zum Gegenlesen: `git -C "C:\Users\secon\Desktop\TrackYourIncome\Web 1.7" show 71f8376`
und `git -C "C:\Users\secon\Desktop\TrackYourIncome\Web 1.7" show 253d28f`. Memory:
`ui-politur-app-weit-2026-08-10`, `finanzen-modul`, `stackr-project-layout`,
`multi-session-coordination-technique`, `local17-userplan-failopen-bug`.
