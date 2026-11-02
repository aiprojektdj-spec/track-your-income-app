# ADR-0001: Grundentscheidungen des Stacks

- **Status:** accepted
- **Date:** 2026-11-02 (Bestandsaufnahme; die Entscheidungen selbst sind älter)

## Context

Stackr ist ein Ein-Personen-Projekt mit parallelen Agent-Sessions. Wenig Betriebsaufwand und
nachvollziehbare Steuerlogik sind wichtiger als Framework-Komfort.

## Decision

- Vanilla JS im Browser, **kein Build-Schritt**, statisches Hosting auf Vercel (Region fra1).
- Serverlogik als Vercel-Serverless-Funktionen in `api/`.
- Auth und Zahlung über Whop (Merchant of Record).
- Daten: Richtung **Server führt, lesbar** auf Supabase (entschieden 2026-10-21, ersetzt Local-First);
  Cloud-Sync über Upstash Redis und Vercel Blob bleibt bis zum Umzug bestehen.
- Genau eine Prod-Abhängigkeit (`@vercel/blob`); Vendor-Skripte lokal mit Prüfsumme.
- Beleg-OCR lokal (`tesseract.js`), kein externer KI-Dienst.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Framework mit Build (React/Next) | Betriebs- und Wartungsaufwand ohne Nutzen für das Produkt |
| Local-First mit E2E weiterführen | erfüllt Integrationen, Mehrgerät, Steuerberater-Zugang nicht (siehe `plan/02-ENTSCHEIDUNGEN.md`) |

## Affected components

`js/`, `api/`, `supabase/migrations/`, `vercel.json`

## Consequences

- Good: einfaches Deployment, kleine Angriffsfläche, schnelle Tests als Node-Harnesses.
- Bad / costs: große Dateien (`js/app.js`, `js/store.js`), eigene Modulorganisation.
- Risks: Migration von Local-First auf Server-führt ist noch offen.

## Enforcement

CI `tests.yml` (alle `test/*.js`, `npm audit`); CSP pro Route in `vercel.json` per Test geprüft.
