# Session-Prompt: Accessibility-Audit (Rest-Check)

**Teil von:** `plan/audit-2026-08-10-masterplan.md` (#9, Kategorie C — UX/Design/A11y)
**Redundanz:** 🟡 A11y-Vollaudit 2026-07-24 (siehe Memory `a11y-vollaudit-rest-2026-07-24`),
Fokus-Indikator-Fix Landing-Demo-Input 2026-08-10. Der Dateiname „Vollaudit-**Rest**" deutet an,
dass es nie eine echte 100 %-Abdeckung gab.
**Priorität:** Mittel

## Ziel

WCAG 2.1 — Kontraste, Tastaturnavigation, Screen-Reader, ARIA, Focus-Management, Touch-Targets.

## Befehl

```
/accessibility
```

## Fokus

- Bereiche, die frühere Runden nicht abgedeckt haben (Akademie, Lager-Zonenicons — beide laut
  Memory `ui-politur-app-weit-2026-08-10` bewusst offen gelassen)
- Vollständiger Tastatur-Durchklick über alle Module (nicht nur Stichproben)
- Edge-Browser-spezifischer Keyboard-Test — laut Memory `security-audit-fixes-2026-08-10` war
  das offen, hier mit aufnehmen falls noch nicht erledigt
- `Utils.linkOrphanLabels()` — prüfen ob neue Formulare seit 2026-07-24 diese Runtime-Verlinkung
  auch tatsächlich nutzen (siehe Memory `a11y-label-runtime-linking`)

## Nach Abschluss

- Funde in `plan/audit-2026-08-10-masterplan.md` unter „Ergebnisse" eintragen, Status ✅ setzen.
