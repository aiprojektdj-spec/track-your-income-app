# Session-Prompt: Performance-Audit

**Teil von:** `plan/audit-2026-08-10-masterplan.md` (#3, Kategorie A — Technisch/Security)
**Redundanz:** 🟢 nie gemacht — Neuland.
**Priorität:** Mittel

## Ziel

Bundle-Größen, Render-Blocking, Core Web Vitals, LocalStorage-Performance, Chart-Rendering,
Memory-Leaks — mit konkreten Optimierungsmaßnahmen inkl. Aufwandsschätzung.

## Befehl

```
/performance-audit
```

## Fokus

- 63 `defer`-Scripts in `app.html` (laut Memory bereits als „performance-a11y" erledigt
  vermerkt — als Ausgangsbasis nehmen, nicht als abgeschlossen werten ohne Nachmessung)
- LocalStorage-Last bei wachsender Firmen-/Belegzahl (viele Module speichern company-präfixiert)
- Chart-Rendering (ApexCharts) bei großen Datensätzen
- CDN-Abhängigkeiten (GSAP, Notyf, Flatpickr, QR, ApexCharts) — Ladezeitpunkt und -größe

## Nach Abschluss

- Funde in `plan/audit-2026-08-10-masterplan.md` unter „Ergebnisse" eintragen, Status ✅ setzen.
