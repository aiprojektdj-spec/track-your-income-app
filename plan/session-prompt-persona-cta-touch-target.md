# Prompt für neue Session (copy-paste) — Touch-Target-Fix `.persona-cta`

Vor dem Start: `/caveman` und `/ponytail` aktivieren. Ist ein Ein-Zeilen-CSS-Fix,
kein Grund für lange Erklärtexte oder neue Abstraktionen — kleinster Diff der
funktioniert.

---

Kontext: Auf der Stackr-Landing (`index.html`, Sektion "Für wen?") gibt es drei
Buttons mit Klasse `.persona-cta` ("Als Freelancer starten →", "Als GbR starten →",
"Als Reseller starten →"). Live bei 375px Viewport gemessen (`getBoundingClientRect()`):
Klickfläche nur ~278×17.6px (`padding: 0`, `display: block`, reiner Text-Link-Stil).
Das unterschreitet WCAG 2.5.8 AA (min. 24×24 CSS-px), von 44×44px AAA-Touch-Targets
ganz zu schweigen. Gefunden 2026-07-19, noch nicht gefixt (Stand 2026-07-21 verifiziert:
`css/landing.css:673` hat weiterhin `padding: 0`).

WICHTIG (geteiltes Repo): Vor JEDEM Edit `git status`/`git diff -- css/landing.css`
frisch prüfen — evtl. läuft eine Parallel-Session im selben Ordner an derselben
Datei. Nur den `.persona-cta`-Block anfassen, Rest unangetastet lassen.

## Fix

`css/landing.css` Zeile ~673, Regel `.persona-cta`:

```css
.persona-cta {
    background: none; border: none; padding: 0; cursor: pointer;
    color: var(--accent); font-size: 13.5px; font-weight: 600; font-family: var(--font-sans);
    text-align: left; transition: opacity .15s;
}
```

Genug vertikales Padding ergänzen, damit die Klickfläche auf ≥44px Höhe kommt
(z. B. `padding: 12px 0` oder `min-height: 44px` + `display: flex; align-items: center;`),
ohne das Text-Link-Design optisch zu verändern (kein Button-Hintergrund, keine
Border — nur die Hitbox wächst).

## Verifizieren

- Browser-Preview auf 375px Breite resizen (`.claude/launch.json` → `stackr`,
  Port 3333).
- Per `javascript_tool`/Konsole: `document.querySelectorAll('.persona-cta')` →
  `getBoundingClientRect().height` für alle drei Links ≥ 44 (oder mind. ≥ 24, wenn
  44 das Layout sichtbar sprengt — dann kurz begründen warum).
- Sichtprüfung: Text-Link-Optik bleibt wie vorher, nur größere Klickfläche.

## Abschluss

- `plan/todo-rest-2026-07-19.md` Eintrag zu `.persona-cta` als erledigt markieren.
- Kleiner, fokussierter Commit reicht.
- Nicht deployen — macht der User.

---

**Modell-Empfehlung: Haiku 4.5 oder Sonnet 5.** Reiner CSS-Fix, keine Logik, keine
Sicherheitsrelevanz — kein Fall für Opus-Reasoning.
