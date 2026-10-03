# Session-Prompt: Datenschutz-Audit (DSGVO-Scan)

**Teil von:** `plan/audit-2026-08-10-masterplan.md` (#7, Kategorie B — Steuer/GoBD/Recht)
**Redundanz:** 🟡 mehrfach behandelt (Whop-Migration, GoBD/Legal-Check 2026-07-03). Anwalts-
Freigabe bleibt so oder so offen, unabhängig vom Code-Audit.
**Priorität:** Niedrig

## Ziel

Code/HTML/Config nach Privacy-Verstößen scannen: fehlende Einwilligung, unrechtmäßige
Verarbeitung, fehlende Datenschutz-Links, unsichere Speicherung, Third-Party-Tracker.

## Befehl

```
/datenschutz
```

## Fokus

- CDN-Skripte (GSAP, Notyf, Flatpickr, QR, ApexCharts, Paddle/Whop-JS) — laden sie beim
  bloßen Aufruf schon Daten nach außen, ohne Consent?
- Cloud-Sync (Upstash Redis) — Art. 17-Löschung, Verschlüsselung im Transit/at-rest
- Cookie-Banner-Korrektheit (Local hatte hier laut Memory `web17-offene-todos-2026-07-21`
  Textfehler — prüfen ob Web dasselbe Problem hat oder nie hatte)

## Nach Abschluss

- Funde in `plan/audit-2026-08-10-masterplan.md` unter „Ergebnisse" eintragen, Status ✅ setzen.
