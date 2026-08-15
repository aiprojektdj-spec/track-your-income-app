# Session-Prompt: Technischer Stack-Vergleich

**Teil von:** `plan/audit-2026-08-10-masterplan.md` (#16, Kategorie D — Business/Markt)
**Redundanz:** 🟢 nie gemacht — Neuland.
**Priorität:** Niedrig

## Ziel

Architektur, Performance, Offline-Fähigkeit, API, Skalierbarkeit, Tech-Debt im Vergleich zu
sevDesk, lexoffice, FastBill, Papierkram, DATEV.

## Befehl

```
/vergleich-technisch
```

## Fokus

- Stackrs "lokal-first" Architektur (localStorage/IndexedDB + optionaler Cloud-Sync) als
  Differenzierungsmerkmal — wie schlägt sich das gegen reine Cloud-Lösungen?
- Skalierungsgrenzen von localStorage bei wachsenden Datenmengen (Überschneidung mit
  `plan/session-prompt-audit-09-performance-2026-08-10.md` — Ergebnisse dort mit einbeziehen)
- Fehlende API für Drittanbieter-Integration

## Nach Abschluss

- Funde in `plan/audit-2026-08-10-masterplan.md` unter „Ergebnisse" eintragen, Status ✅ setzen.
