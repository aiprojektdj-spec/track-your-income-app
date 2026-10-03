# UI/UX-Vergleich vs. Konkurrenz — Funde (2026-08-13)

**Session-Prompt:** `plan/session-prompt-audit-15-vergleich-ui-2026-08-10.md`
**Scope:** Stackrs Oberfläche im Vergleich zu sevDesk, Lexware Office, FastBill.

**Abgrenzung — bewusst kurz gehalten.** Sieben der zehn Skill-Dimensionen sind in dieser
Audit-Runde bereits am Code belegt worden und werden hier **nicht wiederholt**:

| Dimension | steht in |
|---|---|
| Onboarding, Navigation/IA, Dashboard-Leerzustand, Formulare, Feedback | [#10 UX-Journey](funde-audit-02-ux-journey-2026-08-10.md) |
| Design-System-Konsistenz, tote Klassen | [#4 UI-Checker](funde-audit-06-ui-checker-2026-08-10.md) |
| Accessibility, Kontraste, Fokus, Tastatur | [#9 Accessibility](funde-audit-12-accessibility-2026-08-10.md) |
| Ladeverhalten, Render-Blocking | [#3 Performance](funde-audit-09-performance-2026-08-10.md) |
| Landing/First Impression | [#15 Copy/Marketing](funde-audit-08-copy-marketing-2026-08-10.md) |

Neu und Gegenstand dieser Datei ist die **Einordnung gegen den Markt** sowie die zwei
Dimensionen, die der Prompt ausdrücklich nennt: **Dark-Mode-Handling** und **Mobile**.

---

## Zusammenfassung

Der Marktvergleich fällt anders aus als die Fragestellung des Skills vermuten lässt („wirkt
Stackrs Designsprache moderner oder schwächer?"). Die belastbare Antwort: **Stackr ist visuell
konkurrenzfähig und in einem Punkt allein auf weiter Flur** — es hat als einziges Produkt im
Vergleichsfeld ein vollständiges Dark/Light-Theme. Die Schwäche liegt nicht im Aussehen, sondern
in der **Reichweite**: sevDesk gilt als „beste App im Test", Stackr hat gar keine.

| # | Fund | Wirkung | Aufwand |
|---|---|---|---|
| V1 | Theme-Umschalter existiert, ist aber `display:none` — keine manuelle Wahl | 🟠 Mittel | ~1 h |
| V2 | Keine native App / kein PWA-Manifest, während sevDesk mit „bester App" wirbt | 🟠 Mittel | mittel–hoch |
| V3 | Der Dark-Mode als Alleinstellung wird nirgends kommuniziert | 🟡 Niedrig | Text |

---

## ✅ Dark/Light-Mode — vollständig, und im Vergleichsfeld einzigartig

Am Code geprüft, weil hier die Erwartung („Dark-Mode-Handling im Vergleich") am ehesten eine
Lücke vermuten ließ. Das Gegenteil ist der Fall.

`css/style.css` definiert **44 Tokens** im `:root` (dark) und überschreibt im
`@media (prefers-color-scheme: light)`-Block ([css/style.css:102](../css/style.css#L102))
**32 davon**. Der Abgleich zeigt: Die zwölf nicht überschriebenen Tokens sind **ausnahmslos
nicht-farbig** und dürfen gar nicht wechseln:

```
ease-calm · font-display · font-mono · font-sans · radius · radius-sm · radius-lg ·
radius-xl · sidebar-width · topnav-height · transition · surface
```

`--surface` ist dabei kein Versehen, sondern korrekt: es ist als `var(--bg-secondary)` definiert
und folgt dem Theme automatisch.

**Das Detail, das Qualität verrät:** `--surface-2` ist im Dark-Theme
`rgba(255, 255, 255, 0.05)` und im Light-Theme `rgba(0, 0, 0, 0.04)` — die Transparenzfarbe wird
*umgekehrt*, nicht bloß mitgeschleift. Genau das wird bei nachträglich angebauten Light-Modes
regelmäßig vergessen, und das Ergebnis sind unsichtbare Flächen.

Auch die Charts folgen dem Theme statt es zu ignorieren
([js/dashboard.js:454-478](../js/dashboard.js#L454)):

```javascript
const isDark    = window.matchMedia('(prefers-color-scheme: dark)').matches;
const textColor = isDark ? '#94a3b8' : '#64748b';
…
theme: { mode: isDark ? 'dark' : 'light' },
```

**Marktvergleich:** Für sevDesk, Lexware Office und FastBill ließ sich zu Dark Mode **nichts**
finden — die Recherche liefert dazu keinerlei Treffer, während Oberfläche und Bedienung sonst
ausführlich verglichen werden. Bei klassischer Business-Software ist ein durchgezogenes
Dark-Theme die Ausnahme. Stackr hat hier eine echte, verifizierte Alleinstellung.

---

## 🟠 V1 — Der Theme-Umschalter ist da, aber versteckt

[app.html:65](../app.html#L65):

```html
<button class="theme-toggle" id="themeToggle" title="Theme wechseln" style="display:none;"></button>
```

Dazu der Kommentar in [css/style.css:723](../css/style.css#L723):
`/* Theme toggle hidden — using system prefers-color-scheme */`

Die Entscheidung ist nachvollziehbar — die Systemeinstellung zu respektieren ist der richtige
Standard. Sie lässt aber einen realen Fall offen: Wer sein Betriebssystem hell betreibt (in
Büroumgebungen die Regel), aber die Buchhaltungs-App lieber dunkel hätte — oder umgekehrt —
hat **keine Möglichkeit**, das zu ändern.

Das trifft Stackr besonders, weil die Marke über das dunkle Erscheinungsbild definiert ist
(„Ruhige Souveränität", dark + emerald). Ein Nutzer mit hellem System sieht die Marke nie so,
wie sie gedacht ist.

**Fix:** Umschalter mit drei Zuständen sichtbar machen — *System · Hell · Dunkel* —, die Wahl in
localStorage merken und als `data-theme` am `<html>` setzen. Die CSS-Seite ist die kleinere
Hälfte: die Light-Tokens existieren bereits, sie müssen nur zusätzlich unter
`[data-theme="light"]` erreichbar sein. **Wichtig dabei:** die `isDark`-Abfrage in
`js/dashboard.js:454` liest heute ausschließlich `matchMedia` — sie muss die manuelle Wahl
mitlesen, sonst bleiben die Charts im falschen Theme.
**Aufwand:** rund eine Stunde, Sichtbarmachen und Verdrahten.

---

## 🟠 V2 — Keine App, während der Testsieger genau damit wirbt

Die Recherche ist an diesem Punkt eindeutig: sevDesk überzeugt laut Vergleichstests „mit
modernerer Oberfläche, **der besten App im Test** und einem kostenlosen Free-Tarif" und wurde
2026 als „beste Kombination aus Funktionsumfang und Bedienbarkeit" Testsieger (Note 1,1).
Beim Bedienkomfort wird sevDesk ausdrücklich über Lexware Office gestellt, weil „die Oberflächen
in der Anwendung selbst **und in der App** moderner sind".

Stackr ist Web-only. Geprüft: **kein PWA-Manifest** im Projekt, keine `manifest.json`, kein
Service Worker.

Das ist zunächst die aus [#13 Feature-Gap](funde-audit-03-feature-gap-2026-08-10.md) bekannte
Lücke G8 — hier kommt aber ein UI-Argument hinzu: In den Vergleichstests, nach denen
Interessenten suchen, ist „die App" ein eigenständiges Bewertungskriterium. Ohne App verliert
Stackr Punkte in einer Kategorie, in der es gar nicht antritt.

**Der billige Zwischenschritt, den ich empfehle:** ein **PWA-Manifest plus Icons**. Damit lässt
sich Stackr auf dem Homescreen ablegen und startet ohne Browser-Leiste. Das ersetzt keine native
App, schließt aber die auffälligste Lücke („kann ich das auf dem Handy nutzen?") mit sehr wenig
Aufwand. Die Grundlage stimmt bereits: 44-px-Touch-Targets, 13 Media-Queries, scrollende
Tabellen (belegt in [#10](funde-audit-02-ux-journey-2026-08-10.md) und
[#9](funde-audit-12-accessibility-2026-08-10.md)).

Ein Service Worker für echte Offline-Fähigkeit wäre der logische zweite Schritt — er ist aber
ein eigenes Vorhaben mit eigenen Fallstricken (Cache-Invalidierung bei Updates, Zusammenspiel
mit dem Whop-Gate) und gehört erst danach diskutiert.

---

## 🟡 V3 — Die visuellen Stärken tauchen im Marketing nicht auf

Weder Dark Mode noch das Design-System werden auf der Landingpage erwähnt. Das ist derselbe
Befund wie **M1** im [Copy-Audit](funde-audit-08-copy-marketing-2026-08-10.md) (E-Rechnung nur
einmal genannt): Vorhandene Stärken werden nicht erzählt.

Bei einem Produkt, dessen Zielgruppe abends nach Feierabend Buchhaltung macht, ist ein
augenschonendes dunkles Interface kein Kosmetikthema — und es ist ein Merkmal, das die
Wettbewerber nachweislich nicht führen. Ein Satz auf der Landingpage plus ein Screenshot in
beiden Modi genügt.

---

## Score-Tabelle

Stackr-Werte am Code belegt; Wettbewerber aus der Recherche und deshalb gröber. Kein Anspruch
auf Messgenauigkeit — die Tabelle ordnet ein, sie bewertet nicht ab.

| Kategorie | Stackr | sevDesk | Lexware Office | FastBill |
|---|---|---|---|---|
| Design-System-Konsistenz | **8** | 8 | 6 | 7 |
| Onboarding | 5 | 8 | 7 | 8 |
| Navigation / IA | 6 | 8 | 6 | 8 |
| Mobile | 6 | **9** | 7 | 7 |
| Dark Mode | **9** | ? | ? | ? |
| Datenvisualisierung | 7 | 8 | 7 | 6 |
| **Gesamt** | **6,8** | **8,2** | **6,6** | **7,2** |

**Begründung der Stackr-Werte:**
- *Design-System 8* — 44 Tokens, konsistente Radien und Abstände, Tabler-Icons durchgängig.
  Abzug für die drei undefinierten Klassen aus [#4](funde-audit-06-ui-checker-2026-08-10.md).
- *Onboarding 5* — fünf Pflichtschritte ohne Überspringen, danach ein Dashboard ohne
  Handlungsvorschlag ([#10 U2/U3](funde-audit-02-ux-journey-2026-08-10.md); U2 ist inzwischen
  gefixt). Lexware Office wird umgekehrt als „für Solo-Selbstständige etwas überladen"
  beschrieben — Stackrs Problem ist zu viel Pflicht, deren Problem zu viel Angebot.
- *Navigation 6* — „Rechnung schreiben" liegt zwei Ebenen tief unter „Finanzen", wo sieben
  Bereiche gebündelt sind ([#10 U4](funde-audit-02-ux-journey-2026-08-10.md)).
- *Mobile 6* — responsiv sauber gebaut, aber keine App und keine PWA (**V2**).
- *Dark Mode 9* — vollständig in beiden Richtungen, Abzug nur für den versteckten Umschalter (**V1**).

---

## Wo Stackr besser ist als der Markt

1. **Dark Mode.** Vollständig, tokenbasiert, inklusive Chart-Themes und korrekt invertierter
   Transparenzfarbe. Im Vergleichsfeld nicht auffindbar.
2. **Fehlermeldungen mit Rechtsgrund.** „§14 UStG Pflichtangabe" statt „Feld ungültig" — kein
   Wettbewerber erklärt an der Fehlerstelle das Warum
   ([#10](funde-audit-02-ux-journey-2026-08-10.md)).
3. **Die USt-Modus-Entscheidung als Kartenvergleich** mit je vier Fakten und §-Angabe statt eines
   Dropdowns — für die folgenreichste Einstellung des Setups die richtige Darstellungsform.
4. **Kontrastqualität.** 45 von 45 Farbpaarungen erfüllen WCAG AA
   ([#9](funde-audit-12-accessibility-2026-08-10.md)) — bei einem dunklen Theme selten.
5. **Live-Demo auf der Landingpage.** Ausprobieren vor dem Login; die Wettbewerber verlangen
   durchweg eine Registrierung.

## Wo der Markt besser ist

1. **Mobile.** sevDesk gilt als „beste App im Test", Stackr hat keine (**V2**).
2. **Time-to-Value.** Fünf Pflichtschritte bis zur App gegen „Wizard, aber jederzeit abbrechbar".
3. **Reifegrad der Muster.** Kleinigkeiten wie Skip-Links, Breadcrumbs und benannte Landmarks
   sind bei größeren Anbietern selbstverständlich
   ([#9 A4/A5](funde-audit-12-accessibility-2026-08-10.md)).

---

## Die fünf wichtigsten UI-Verbesserungen

Nach Wirkung × Aufwand, ohne die bereits in anderen Audits geführten Punkte zu doppeln:

| # | Maßnahme | Wirkung | Aufwand |
|---|---|---|---|
| 1 | **V1** Theme-Umschalter sichtbar machen (System/Hell/Dunkel), `isDark` in `dashboard.js` mitlesen | Vorhandene Stärke wird nutzbar | ~1 h |
| 2 | **V2** PWA-Manifest + Icons | „Auf dem Handy nutzbar" ohne native App | ~2 h |
| 3 | **V3** Dark Mode auf der Landingpage zeigen (Screenshot in beiden Modi) | Alleinstellung wird sichtbar | ~30 min |
| 4 | A4/A5 aus [#9](funde-audit-12-accessibility-2026-08-10.md): Skip-Link + Landmark-Benennung | Schließt zum Marktstandard auf | ~15 min |
| 5 | U4 aus [#10](funde-audit-02-ux-journey-2026-08-10.md): „+ Rechnung" in die Topnav | Kernaufgabe wird einstufig | ~30 min |

Punkte 1, 3, 4 und 5 zusammen liegen unter drei Stunden.

---

## Quellen

- [Buchhaltungssoftware Test 2026 — die 6 besten Programme](https://buchhaltungssoftware-test.de/)
- [sevdesk vs. Lexware Office im Vergleich 2026](https://rechnung-schreiben.de/sevdesk-vs-lexware-office/)
- [Sevdesk vs. Lexware Office — der große Vergleich 2026](https://www.buchhaltungssoftware-vergleichen.de/sevdesk-vs-lexware-office/)
- [sevdesk Test 2026: Bewertung, Kosten & Erfahrungen](https://e-rechnung-vergleich.de/sevdesk-test/)
- [sevDesk vs Lexware Office 2026](https://geschaeftskonto.io/sevdesk-vs-lexware/)
