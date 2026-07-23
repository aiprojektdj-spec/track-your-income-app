# Prompt für neue Session (copy-paste) — USt-Voranmeldung als Sub-Tab in den EÜR-Tab holen

---

## Kontext

Planungssession (2026-07-23). User will UStVA nicht mehr als eigene Sidebar-Seite unter
"Steuer & Soziales", sondern als Reiter innerhalb des EÜR-Tabs — Idee: EÜR und UStVA gehören
fachlich zusammen (beide sind periodische Auswertungen), User will sie an einem Ort sehen.

**Nicht zu verwechseln mit** `plan/session-prompt-euer-umbau.md` (erledigt 2026-07-21/22) — das war
die Bilanz-vs-EÜR-Weiche nach Rechtsform, ein anderes Thema. Hier geht es um Navigation/Layout,
nicht um die Gewinnermittlungslogik.

## Ist-Zustand (verifiziert 2026-07-23)

- `js/euer.js` (1043 Zeilen): eigene Sidebar-Sektion `#euerSidebarSection` ("EÜR – Auswertung"),
  Nav-Items mit `data-euer-period="jahr|monat|quartal"` (app.html:108-116). Klick setzt
  `Euer._period` + `Euer._refresh()` (app.js:327-336).
  - **Wichtig:** `Euer._period` ist bereits doppelt belegt — steuert sowohl den Sidebar-Quick-Nav
    als auch den internen Zeitraum-Dropdown im Report selbst (`jahr|monat|quartal|custom`,
    euer.js:317-320) und geht in die Datumsberechnung ein (euer.js:44-55, AfA-Ratio Zeile 170).
    **Für den neuen Tab NICHT denselben State-Namen wiederverwenden** — sonst kollidiert
    "UVA-Ansicht" mit "EÜR-Zeitraum".
- `js/ustvoranmeldung.js` (664 Zeilen): eigene Sidebar-Sektion `#steuerSidebarSection`
  ("Steuer & Soziales"), eigener State `_year`/`_quartal`/`_monat` (Zeilen 6-8), unabhängig von
  `Euer`. Eigene Soll/Ist- und Kleinunternehmer/Regelbesteuerung-Logik (`_isRegel()`, `_isSoll()`),
  §25a-Zeilen, RC-Auto-Erkennung — **inhaltlich unangetastet lassen**, nur Einbettung ändert sich.
- Beide Module folgen demselben Pattern: `render()` gibt HTML-String zurück, `init()` bindet
  Event-Listener nach dem Einfügen ins DOM (`app.js` ruft `contentEl.innerHTML = ...render(); ...init()`
  auf, siehe euer.js:1035-1036 / ustvoranmeldung.js:559-560).

## Entscheidung (User, 2026-07-23)

Merge-Tiefe: **Sub-Tab im EÜR-Report** (nicht nur Nav-Umzug, nicht volle Verschmelzung). D.h.
`ustvoranmeldung.js` bleibt als eigenständiges Modul mit eigener Logik bestehen — wird nur an
einer neuen Stelle in `euer.js` eingehängt und bekommt einen Reiter statt eine eigene Seite.

## Bauplan (Vorschlag, in Bau-Session verifizieren)

1. **Neuer State in `Euer`:** `_view: 'report'` (Default) | `'uva'` — orthogonal zu `_period`,
   nicht damit vermischen (siehe Ist-Zustand oben).
2. **`Euer.render()`:** am Anfang verzweigen — wenn `_view === 'uva'`, `UstVoranmeldung.render()`
   zurückgeben (in einen Wrapper mit Tab-Leiste), sonst bisherigen EÜR-Report wie gewohnt.
   Tab-Leiste (EÜR-Report | USt-Voranmeldung) oberhalb einfügen, ähnlich existierendem
   Periode-Dropdown-Stil, nicht neu erfinden.
3. **`Euer.init()`:** nach `render()` zusätzlich `UstVoranmeldung.init()` aufrufen, wenn
   `_view === 'uva'` — sonst bleiben deren Event-Listener (Formular, Buttons) tot.
4. **Sidebar (`app.html`):** `data-page="ustvoranmeldung"`-Link aus `#steuerSidebarItems`
   (Zeile 132-134) entfernen, stattdessen neues Datenattribut `data-euer-view="uva"` in
   `#euerSidebarItems` (nach Zeile 116) einfügen. Zweiten `ustvoranmeldung`-Link im
   mobilen/Hauptmenü-Block (app.html:182-184, "Steuer & Soziales") **ersatzlos entfernen**
   (Entscheidung s.u.) — kein Umbiegen, einfach raus.
5. **`app.js` Klick-Handler (Zeile 327-336):** analog zu `data-euer-period` einen Zweig für
   `data-euer-view` ergänzen, der `Euer._view` setzt + `Euer._refresh()`.
6. **Direkt-Navigation `navigate('ustvoranmeldung')`:** prüfen, ob andere Stellen im Code
   `App.navigate('ustvoranmeldung')` aufrufen (z.B. Onboarding-Hinweise, Dashboard-Kacheln,
   Deep-Links) — `grep -rn "navigate('ustvoranmeldung'\|navigate(\"ustvoranmeldung\"" js/ *.html`.
   Diese müssten auf `navigate('euer')` + `Euer._view='uva'` umgestellt werden, sonst brechen
   bestehende Links.
7. **`App.PAGES`/Routing (`js/app.js` Zeile ~29):** klären, ob `ustvoranmeldung` als eigene Route
   komplett entfernt wird (Redirect auf `euer`) oder als Alias bestehen bleibt (robuster gegen
   vergessene Links aus Punkt 6) — Ponytail-Empfehlung: Alias behalten, der auf `euer` + `_view='uva'`
   umleitet, statt jede Referenz einzeln zu jagen.
8. **`onSteuer`-Array (`app.js` Zeile 590):** `ustvoranmeldung` rausnehmen (Seite existiert als
   eigene Route ggf. nicht mehr / zeigt keine eigene Sidebar-Sektion mehr).

## Was NICHT angefasst wird

- Rechenlogik in `ustvoranmeldung.js` (Soll/Ist, §25a, RC, OSS-Verweis) — 0 Änderungen.
- `js/vorsteuer.js`, `js/oss.js` — bleiben eigene Seiten unter "Steuer & Soziales", nicht Teil
  dieses Merges (nur UStVA selbst wandert).

## Zusatz (2026-07-23): Tab-Umbenennung "EÜR" → "Steuer & EÜR"

User-Entscheidung: der Tab soll künftig "Steuer & EÜR" heißen (nicht mehr nur "EÜR"), da er
zukünftig auch UVA (und ggf. mehr) abdeckt. Interne Route/ID (`key:'euer'`, `data-page="euer"`,
`App.PAGES.euer`, Objekt `Euer`) bleibt unverändert — nur Anzeige-Text ändert sich (Ponytail:
Rename der internen ID würde jeden `navigate('euer')`-Call anfassen, unnötiges Risiko für reinen
Label-Wechsel).

**Zu ändernde Stellen:**
- `js/topnav.js:51` — `label:'EÜR'` → `'Steuer & EÜR'`, `title:'EÜR / P&L'` → `'Steuer & EÜR / P&L'`
- `app.html:106` — `"EÜR – Auswertung"` → `"Steuer & EÜR – Auswertung"` (Sidebar-Breite prüfen, ggf. kürzen)
- `js/i18n.js:31` (DE `nav.euer`) → `'Steuer & EÜR'`; Zeile 462 (EN `nav.euer`) → z.B. `'Tax & P&L'`
- `js/i18n.js:47` (`sidebar.euer`) — vorher prüfen ob referenziert (aktuell Verdacht: totes Konstrukt,
  Sidebar-Text ist hartcodiert in app.html, nicht i18n-gebunden), ggf. mit aufräumen
- `js/euer.js:19,22,416` (interne Report-Überschriften "EÜR") — **bewusst NICHT automatisch mit
  umbenennen** — der Report selbst heißt fachlich weiter EÜR, nur der Tab drumherum heißt anders.
  Mit User im Zweifel gegenprüfen.

**Reihenfolge:** in derselben Bau-Session wie der UVA-Sub-Tab-Merge (oben) erledigen, sonst heißt
der Tab zwischenzeitlich "Steuer & EÜR" ohne dass UVA schon drin ist — inhaltlich verwirrend.

## Entscheidungen (User, 2026-07-23, Runde 2)

- **Tab-Leiste UI:** eigene Reiter-Leiste oberhalb des Contents ("EÜR-Report" | "USt-Voranmeldung"),
  optisch getrennt vom Zeitraum-Dropdown darunter. Nicht in den Dropdown mischen (Report-Typ ≠
  Zeitraum, zwei verschiedene Konzepte).
- **Zweiter Sidebar-Link** im Hauptmenü-Block (app.html:182-184, mobiles/kompaktes Menü) — wird
  **ersatzlos entfernt**, kein Umbiegen auf `euer`+`uva`-View nötig. Bauplan-Punkt 4 entsprechend
  anpassen: dieser Link fliegt komplett raus, nicht umgebogen.
- **State merken:** `Euer._view` wird **pro Session gemerkt**, nicht bei jedem Tab-Wechsel auf
  `'report'` zurückgesetzt. D.h. `_view` verhält sich wie `_period` bereits heute (bleibt gesetzt,
  bis User aktiv wechselt) — kein Reset-Code nötig, nur beim allerersten Laden Default `'report'`.
  Kein zusätzlicher localStorage-Persistenz nötig (nur In-Memory-State reicht, wie bei `_period`
  auch schon der Fall — Verhalten 1:1 spiegeln, nicht neu erfinden).

## Nach Abschluss

- `plan/todo-rest-*.md` (aktuellste Version) aktualisieren.
- Prüfen, ob Local 1.7 diese Änderung ebenfalls braucht (`plan/session-prompt-local-spiegeln.md`).

---

**Modell-Empfehlung: Sonnet 5 reicht.** Reines Nav-/Layout-Refactoring, keine neue Fachlogik, keine
Rechenlogik-Änderung — Hauptrisiko ist vergessene Links auf die alte Route (Punkt 6+7 oben).
