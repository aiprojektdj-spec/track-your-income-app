# Session-Prompt: Security-Audit (Delta-Check)

**Teil von:** `plan/audit-2026-08-10-masterplan.md` (#1, Kategorie A — Technisch/Security)
**Redundanz:** 🟡 Sanierung 2026-08-09 + IP-Spoofing-Fix am 2026-08-10 (heute) bereits gelaufen —
siehe Memory `security-audit-fixes-2026-08-10`, `technische-sanierung-2026-08-09`.
**Priorität:** Hoch

## Ziel

Kein Vollaudit von Null — Fokus auf Änderungen und offene Punkte seit der letzten Runde.

## Befehl

```
/security-stackr
```

Vor dem eigentlichen Audit kurz `git log` seit `020a0c5` (letzter bekannter Commit der
Sanierungs-Session) prüfen, um zu sehen was seither dazugekommen ist.

## Fokus

- Alles was seit 2026-08-09/10 committet wurde (Fokus-Trap Whop-Gates, anchorKey-Schutz,
  IP-Spoofing-Fix — laut Memory `security-audit-fixes-2026-08-10` sind 7/13 Funde gefixt,
  **6 offen**: Edge-Keyboard-Test + Local-Sync waren noch nicht abgeschlossen — prüfen ob das
  inzwischen erledigt ist)
- Neue Endpunkte/Features seit der Sanierung, die noch nicht sicherheitsprüft wurden
- Kein erneutes Scannen von bereits gefixten Punkten, außer als Stichprobe

## Nach Abschluss

- Funde in `plan/audit-2026-08-10-masterplan.md` unter „Ergebnisse" eintragen, Status ✅ setzen.
- Abgleich mit `memory/security-audit-fixes-2026-08-10.md` — Memory aktualisieren falls die
  6 offenen Punkte jetzt erledigt sind.
