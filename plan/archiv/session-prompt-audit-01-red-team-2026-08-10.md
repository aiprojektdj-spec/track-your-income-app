# Session-Prompt: Red-Team-Audit

**Teil von:** `plan/audit-2026-08-10-masterplan.md` (#2, Kategorie A — Technisch/Security)
**Redundanz:** 🟢 nie als eigener Lauf dokumentiert — Neuland.
**Priorität:** Hoch

## Ziel

Adversarial Testing gegen Stackr Web 1.7: wie würde ein Angreifer versuchen, das System zu
brechen?

## Befehl

```
/red-team
```

## Fokus

- Whop-Gate-Bypass (Client-seitige Umgehung des Zahlschranken-Checks)
- Cloud-Sync-Datendiebstahl (fremde Firma/Nutzer-Daten lesen/schreiben)
- Auth-Umgehung (Session-Fälschung, Grace-Token-Manipulation — siehe Memory
  `whop-gate-signed-grace-token`, war bereits einmal per DevTools angreifbar)
- Injection (XSS über Freitextfelder: Artikelbezeichnung, Kundenname, Notizen)
- Serverless-Endpunkt-Abuse (`api/sync.js`, `api/blob-upload.js` — Rate-Limits, IP-Spoofing-Fix
  vom 2026-08-10 als Ausgangspunkt nehmen, nicht als erledigt annehmen)

## Nach Abschluss

- Funde in `plan/audit-2026-08-10-masterplan.md` unter „Ergebnisse" eintragen, Status ✅ setzen.
- Kritische/ausnutzbare Funde zusätzlich in `plan/OFFEN.md` aufnehmen.
