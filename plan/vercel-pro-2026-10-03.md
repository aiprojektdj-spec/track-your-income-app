# Vercel Pro anlegen – Stackr (03.10.2026)

> Pro wird **pro Team** gebucht. Liegen Stackr (`track-your-income-app`) und CFC im selben
> Team, reicht **ein** Upgrade. Gegenstück: `Desktop/CFC/wertenetz-mvp/docs/VERCEL_PRO_2026-10-03.md`.
> Den Kauf machst du selbst im Dashboard.

## Warum Pro
- Stackr ist ein bezahltes Produkt. Hobby ist laut Vercel nur für nicht-kommerzielle Nutzung.
- Cron `blob-cleanup` und weitere Crons ohne Hobby-Limits
- Spend Management, längere Logs, Speed Insights, Schutz der Preview-Deployments

## Steuerlich
Stackr läuft als Kleinunternehmer (§ 19). Vercel-Rechnung: Reverse Charge (§ 13b UStG).
Als Kleinunternehmer schuldest du die USt trotzdem und musst sie anmelden, ohne
Vorsteuerabzug. → Rechnung auf deinen Namen, mit dem Steuerberater kurz abstimmen.
Später nicht über die CFC-GbR abrechnen, damit die Kosten sauber getrennt bleiben.

## Schritte
- [ ] Prüfen: In welchem Team liegt `track-your-income-app`? Dasselbe wie CFC?
- [ ] Upgrade auf Pro (bzw. Projekt ins Pro-Team übertragen; Domains und Env-Vars wandern mit,
      danach prüfen)
- [ ] **Spend Management**: harte Obergrenze plus Mail
- [ ] **Deployment Protection** für Previews an
- [ ] Alle Env-Vars auf **Sensitive** (siehe `api-keys-performance-2026-10-03.md`)
- [ ] Speed Insights an
- [ ] Redeploy, `/api/health` → 200, Cron-Heartbeat kommt an
- [ ] `plan/vercel-einrichtung.md` um „Pro seit 03.10.2026" ergänzen

## Erledigt-Kriterium
Pro aktiv, Limit gesetzt, Previews geschützt, Production und Cron laufen.
