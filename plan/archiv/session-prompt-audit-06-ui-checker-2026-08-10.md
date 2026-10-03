# Session-Prompt: UI-Bug-Audit (app-weit)

**Teil von:** `plan/audit-2026-08-10-masterplan.md` (#4, Kategorie A — Technisch/Security)
**Redundanz:** 🟡 UI-Politur 2026-08-10 deckte nur Lager/Steuer/KSK/EÜR ab — siehe Memory
`ui-politur-app-weit-2026-08-10`, `finanzen-modul`. Restliche App-Bereiche ungeprüft.
**Priorität:** Mittel

## Ziel

Rendering-Bugs, broken Layouts, fehlende Elemente, falsche Klassennamen — app-weit, nicht nur
die bereits polierten Module.

## Befehl

```
/ui-checker
```

## Fokus

- Bereiche, die die letzten UI-Politur-Runden **nicht** abgedeckt haben: Rechnungen, Eigenbelege,
  Dashboard, Onboarding-Wizard, Akademie (laut Memory bewusst offen gelassen), Lager-Zonenicons
  (auch bewusst offen)
- Landing-Page, Auth-Modals (kürzlich CSS-Relikt entfernt — Commit `020a0c5` — auf
  Folgeschäden prüfen)
- Konsistenz Design-System („Ruhige Souveränität", dark+emerald — siehe Memory
  `stackr-ui-v2-design-brief`) über alle Seiten hinweg

## Nach Abschluss

- Funde in `plan/audit-2026-08-10-masterplan.md` unter „Ergebnisse" eintragen, Status ✅ setzen.
