# Session-Prompt: Steuer-Feature-Audit (Delta-Check)

**Teil von:** `plan/audit-2026-08-10-masterplan.md` (#5, Kategorie B — Steuer/GoBD/Recht)
**Redundanz:** 🟡 Steuer-Audit 2026-07-23 gründlich abgeschlossen (§25a+KSA+Kassenbuch+GWG+
canEdit+EÜR-Z64, siehe Memory `steuer-audit-2026-07-23`). Seither neue Features ungeprüft.
**Priorität:** Mittel

## Ziel

Kein Vollaudit von Null — Fokus auf Features/Änderungen seit dem letzten Steuer-Audit.

## Befehl

```
/steuern
```

## Fokus

- Teilzahlung/Ratenzahlung (committet `e771cdb`, seither nicht steuerlich auditiert)
- Lager-Feature-Batch (Punkte 3/8/9 fertig laut Memory `lager-feature-batch-2026-07-23`) —
  steuerliche Auswirkungen (Bewertung, Bestandsveränderung in EÜR) prüfen
- §25a Differenzbesteuerung: bekannte offene Lücke (7%-Satz bei Anlage-2-Fällen, bewusst nicht
  angefasst — siehe `plan/OFFEN.md` Abschnitt 2.1) — nicht neu aufrollen, nur bestätigen dass
  sich am Stand nichts geändert hat
- GoBD-Audit-Log auf neue Module (Lager, Teilzahlung) — greift der Audit-Trail überall gleich?

## Nach Abschluss

- Funde in `plan/audit-2026-08-10-masterplan.md` unter „Ergebnisse" eintragen, Status ✅ setzen.
