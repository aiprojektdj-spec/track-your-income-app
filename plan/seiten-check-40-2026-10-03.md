# Stackr: Seiten-Check „40 Punkte“ (03.10.2026)

Session-Prompt für eine eigene Session. Anlass: Lead-Magnet von @titusharmann
(„40 Löcher, die keiner sucht“: 25 Live-Prüfungen + 15 Quelltext-Prüfungen). Sein
Skript laden wir **nicht** herunter und führen es nicht aus (fremder Code, Zugriff auf
`.env.local`). Wir prüfen die Themen selbst, nur am eigenen Projekt.

## Vorher lesen (nicht doppelt machen)

- `plan/reels-sicherheit-2026-10-03.md`: die 20 Punkte aus seinem Reel. Offen: **R1**
  (interne Doku `plan/`, `*.md`, `test/`, `scripts/` live erreichbar), R2 (Live-Check
  nach Deploy), R3 (Kostendeckel), C1–C4
- `plan/sicherheit-15-punkte-2026-10-03.md`: läuft ggf. in einer **anderen Session**
- Skills `/security-stackr` und `/red-team` als Prüfraster nutzen

## Regeln für diese Session

- `master` hat ungepushte Commits und uncommittete Änderungen (Rechtsseiten, `js/`).
  Nichts davon verwerfen. Arbeit in eigenem Worktree/Branch `fix/seiten-check-40`.
- Live-Prüfungen nur gegen https://track-your-income-app.vercel.app, nur lesend
  (GET/HEAD, normale Anfragen). Keine Last- oder Massentests, keine fremden Konten.
- `.env.local` nicht ausgeben, keine Secrets in Logs oder Doku.

## Teil A – Live-Prüfungen (von außen)

Schon geprüfte Reel-Punkte nur bestätigen. Neu oder vertieft:

1. **R1 zuerst:** sind `plan/`, `*.md`, `test/`, `scripts/`, `compliance/`, `graphify-out/`,
   `build-deploy.py` live noch erreichbar? Ziel: alles 404
2. Security-Header pro Seite (`index`, `app`, Rechtsseiten, `api/*`): HSTS, CSP,
   `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
3. Ausgelieferte JS-Dateien: keine Secrets, keine internen Endpunkte, keine `.map`
4. `robots.txt`, `sitemap.xml`: nichts Internes
5. API ohne gültiges Whop-Token: jede Route in `api/` → 401/403, keine Daten
6. CORS: nur die eigene Origin
7. Fehlerantworten ohne Stack/Interna
8. Rate-Limits greifen sichtbar (wenige Anfragen)
9. Blob-Storage: nur Chiffrat, URLs nicht erratbar/listbar
10. TLS, Weiterleitungen, alte Preview-URLs

## Teil B – Quelltext-Prüfungen

1. Jede Datei in `api/`: Auth, Rate-Limit, Input-Validierung, Body-Limit (Tabelle)
2. IDOR: Redis-/Blob-Keys nur aus Token-User-ID, nie aus Request-Parametern
3. Fail-open bei Redis-Ausfall (R3): bewusst lassen oder fail-closed? → Entscheidung
4. Whop-Token in `localStorage` (Punkt 11): Restrisiko dokumentieren
5. Verbleibende `innerHTML`-Stellen in `js/` (außer `js/vendor/`)
6. `vercel.json`: CSP pro Seite konsistent, keine Wildcards
7. `npm audit --omit=dev`, Vendor-Prüfsummen in `js/vendor/VERSIONS.md`
8. Kostenfallen: Blob-Budget-Default (10 GB je Nutzer) senken?

## Ergebnis

- Tabelle (✅ / ⚠️ / 🔴 / ➖ / 🟡) unten in **dieser** Datei ergänzen
- Kleine Fixes direkt, je Thema ein Commit, Tests grün
- R2 umsetzen: Live-Check-Skript mit den Punkten aus Teil A nach jedem Deploy
- Entscheidungen → Abschnitt „Was du entscheiden musst“
- Push/Deploy erst nach meinem OK

## Ergebnis-Tabelle

| # | Prüfung | Status | Befund | Maßnahme |
|---|---|---|---|---|
| A1 | Interne Doku live (R1) | 🔴 | Live 200: `/CLAUDE.md`, `/plan/00-STAND.md`, `/test/*.js`, `/scripts/*.js`, `/build-deploy.py`, `/ui-lab.html`, `/CLOUD-SYNC.md`, `/js/vendor/VERSIONS.md`. Fix `.vercelignore` (67fc5c5) liegt nur lokal | **Push nötig** (dein OK) |
| A2 | Security-Header | ⚠️→✅ | HSTS/XFO/nosniff/Referrer/Permissions überall. CSP-Header fehlte auf `/lager/`, `/rechnungen/`, `/eigenbelege/` (Vercel matcht strikt, `:path*` greift nicht bei Schrägstrich). Meta-CSP war da | Fix `b912703` auf `fix/seiten-check-40` |
| A3 | JS: Secrets / `.map` | ✅ | Keine Secrets in `js/`, Unterseiten, `*.html`. Nur Verweise auf `.map` in Vendor-Dateien, ohne Datei | – |
| A4 | robots/sitemap | ✅ | nichts Internes | – |
| A5 | API ohne Token | ✅ | sync/blob-upload/whop-access → 401, cleanup → 401, refresh/token → 400 | – |
| A6 | CORS | ✅/🟡 | API nur eigene Origin, auch bei fremder Origin im Preflight. Statische Dateien `*` (Vercel-Default, nur öffentliche Inhalte) | – |
| A7 | Fehlerantworten | ✅ | nur Fehlercodes, kein Stack | – |
| A8 | Rate-Limits | ➖ | nicht live ausgereizt (keine Last), im Code vorhanden | – |
| A9 | Blob | ✅ | Pfade an Token-User-ID, Besitzprüfung `isOwnedBlobUrl` | – |
| A10 | TLS/alte Previews | ⚠️ | TLS ok. Alte `*-hash.vercel.app` von außen nicht prüfbar | Deployment Protection in Vercel (du) |
| B1/B2 | api/: Auth, Limit, Validierung, IDOR | ✅ | Keys überall aus Token-User-ID; Längen-/Format-Checks; Body-Limits sync 3,5 MB, blob 4 MB/Chunk, client-error 4 KB | – |
| B3 | Fail-open Redis | 🟡 | bewusst, mit Alert | Entscheidung unten |
| B4 | Token in localStorage | 🟡 | Restrisiko XSS, abgefedert durch `script-src 'self'` | – |
| B5 | innerHTML | ✅ | Sweep e85fda6 (29.09.), CSP als zweite Linie; kein Vollreview aller ~200 Stellen | – |
| B6 | vercel.json CSP | ✅ | pro Route, keine Script-Wildcards (connect-src `*.public.blob…`, `*.make.com` nötig) | – |
| B7 | npm audit / Vendor | ✅ | 0 Schwachstellen; Prüfsummen in VERSIONS.md, Test dafür fehlt noch | offen |
| B8 | Blob-Budget 10 GB | ⚠️ | Default zu hoch | Entscheidung unten |

### Stand 04.10.2026

- A1: erledigt, interne Dateien live 404 (`master` gepusht).
- Branch `fix/seiten-check-40` als PR #10 gemergt und live (04.10., Live-Check 106/106 grün,
  die Action lief nach dem Deploy erfolgreich):
  - `a2a46b1` CSP-Header für `/lager/`, `/rechnungen/`, `/eigenbelege/`
  - `0b4b80b` B8: Blob-Budget-Default 1 GB. Wirkt nur, wenn `BLOB_MAX_BYTES` in Vercel nicht
    gesetzt ist bzw. auf `1073741824` steht. Mit Vercel Pro neu bewerten.
  - `2dd2704` R2: `scripts/check-live-exposure.js` + `.github/workflows/live-check.yml`
    (nach jedem Production-Deploy, täglich 05:17 UTC, manuell). Lokal gegen Production:
    103 ok, 3 rot = genau die CSP-Lücke aus `a2a46b1`, die erst mit dem Merge live geht.
- B3 Fail-open: bleibt so (steht in `02-ENTSCHEIDUNGEN.md`), Neubewertung später.

### Was du noch tun musst
1. Vercel: PR-Previews scheitern sofort (auch Dependabot #9), Production läuft. Log ansehen.
2. In Vercel prüfen, ob `BLOB_MAX_BYTES` gesetzt ist; wenn ja, auf `1073741824` oder löschen.
3. Deployment Protection für Preview-URLs (A10).

### Noch offen
- Test Vendor-Prüfsummen, Test gegen Secrets im Client (C3; teilweise durch den Live-Check
  abgedeckt)

