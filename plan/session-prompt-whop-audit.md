# Prompt für neue Session (copy-paste)

---

Kontext: Stackr nutzt Whop als alleinigen Auth+Payment-Stack (OAuth 2.1 + PKCE, Membership-Gate,
kein Free-Tier mehr, kein Paddle/Supabase). Der Flow hatte in den letzten Wochen mehrfach
Bugs, die zahlende Kunden ausgesperrt haben (siehe Commits `1be6b0f`, `900ccef`, `93f7921` —
falscher has_access-Endpoint, falsche Produkt/Company-IDs). Aufgabe: den GESAMTEN Whop-Flow
noch einmal Ende-zu-Ende durchgehen und jeden Bug finden, der heute noch drinsteckt — nicht nur
die Stellen, die schon mal kaputt waren. Kein bekanntes Symptom, das ist ein genereller Audit.

Zentrale Dateien: `js/whop-auth.js` (Login/PKCE/Membership-Check/Grace/UI), `api/whop-access.js`
(serverseitiger has_access-Check + Company-Fallback), `api/whop-token.js` (Code→Token-Exchange
+ Rate-Limit), `js/user-plan.js` (Plan-Badge, immer 'pro' nach Auth). Eingebunden in `app.html`,
`lager/page.js`, `eigenbelege/js/app.js`, `rechnungen/js/app.js` — JEDE dieser vier Seiten hat
ihren eigenen `AuthUI.boot()`-Aufruf, prüfe ob sie wirklich alle denselben Gate-Stand haben
(waren früher inkonsistent, siehe Memory `whop-gate-standalone-pages.md`).

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im selben Ordner. Vor JEDEM Edit
die Datei frisch lesen; nur eigene Dateien stagen. Nicht deployen — das macht der User.

## Prüfplan (alle Ebenen abarbeiten)

**1. Statischer Konsistenz-Check**
- `grep -rn` nach allen Whop-IDs (Plan-Links `plan_iR6YIKLcychSZ`/`plan_b5IBQ1lecggOT`,
  Access-IDs `prod_wgVmaJg4sBVOD`/`prod_p1WHi5t65rAA6`/`biz_2OEWYGlOwb8b0f`) über alle
  `.js`/`.html` — müssen überall identisch sein, keine veralteten/abweichenden Werte.
- `AuthUI.boot()`-Einbindung auf allen 4 Seiten (app.html, lager, rechnungen, eigenbelege)
  vergleichen — gleiche Reihenfolge, gleiches Script-Set (whop-auth.js, user-plan.js,
  cloud-sync.js, stb-share.js), kein Pfad ohne Gate.

**2. Server-Logik lesen wie ein Angreifer/Edge-Case-Jäger**
- `api/whop-access.js`: `_checkAccess` — was passiert bei `WHOP_API_KEY` NICHT gesetzt UND
  Token-Endpoint liefert `null` (unbestimmt)? Aktuell wirft das einen 502 statt fälschlich
  „kein Zugang" — prüfen ob das wirklich so ankommt und der Client das korrekt als
  Offline-Grace behandelt statt als Logout.
- Owner-Bypass (`OWNER_USERNAMES`/`WHOP_OWNER_USERNAMES`) — Wert in `whop-auth.js` (Client,
  nur kosmetisch) vs. `whop-access.js` (Server, entscheidet wirklich) — beide Listen synchron?
- `_hasAccessViaCompanyKey`: Pagination-Limit `MAX_PAGES = 20` bei 50/Seite = 1000 Memberships —
  reicht das? Was passiert bei mehr (silent cutoff → false negative für Kunden auf Seite 21+)?
- Rate-Limit in `whop-token.js`: greift nur wenn `UPSTASH_REDIS_REST_URL/TOKEN` gesetzt sind —
  wenn nicht gesetzt, kein Rate-Limit UND kein Fehler (silent skip) — ist das gewollt oder eine
  Lücke?

**3. Client-Logik: Fehlerpfade genau nachvollziehen**
- `_validateAndContinue`: alle Fetch-Fehlerpfade durchspielen (401/403 userinfo, non-ok
  userinfo, ok whop-access mit `has_access:false`, 5xx whop-access, Netzwerkfehler/offline) —
  landet jeder Pfad im richtigen UI-Zustand (Logout vs. Grace vs. Kauf-Screen)?
- Offline-Grace (`GRACE_MS = 4h`): Race Condition zwischen `_graceFresh()`-Check in `boot()`
  und einem parallel laufenden `_recheckOnFocus()` — können sich beide widersprechen
  (z. B. Overlay flackert auf und verschwindet wieder)?
- `_recheckOnFocus`: Listener wird nur einmal gebunden (`_focusRecheckBound`), aber nie
  entfernt — wenn der Overlay mehrfach auf/zu geht, läuft `_validateAndContinue` bei jedem
  Fensterfokus erneut, auch nachdem der Nutzer schon lange authorized ist? Prüfen ob das
  echtes Rate-Limit-Risiko gegen `/api/whop-access` erzeugt (z. B. Alt-Tab-Wechsel-Spam).
- `_logout()` löscht Token/User/Grace, aber NICHT den `_bootDone`/`_focusRecheckBound`-Modulzustand
  — bei Re-Login im selben Tab (ohne Reload) evtl. inkonsistenter State?

**4. Live-Checks (read-only, keine echten Käufe/Storno auslösen)**
```bash
curl -i -X POST https://track-your-income-app.vercel.app/api/whop-token \
  -H "Content-Type: application/json" -d '{"code":"invalid","code_verifier":"invalid"}'
curl -i -X POST https://track-your-income-app.vercel.app/api/whop-access \
  -H "Content-Type: application/json" -d '{"token":"garbage"}'
```
Erwartete Antworten mit tatsächlichen vergleichen (400 invalid_grant / 401 invalid_token,
keine Stacktraces/Secrets im Body).

**5. Browser-E2E im Preview (soweit ohne echtes Whop-Konto möglich)**
- Login-Screen, Kein-Abo-Screen (Checkout-Links öffnen korrekte Whop-URLs), Logout-Flow,
  Referral-Menü-Link (`agb.html#empfehlungsprogramm` muss existieren und den richtigen
  Abschnitt treffen — Anchor-Check).
- Mit `localStorage.setItem('whop_access_token', ...)` + gefaktem `whop_user`/`whop_grace_until`
  im Preview verschiedene Zustände (frische Grace, abgelaufene Grace, kein Token) simulieren
  und beobachten, ob `boot()` jeweils korrekt reagiert.

## Abschluss
- Jeden gefundenen Bug mit Datei:Zeile, Repro-Szenario und Fix dokumentieren.
- Kritische Bugs (können zahlenden Kunden aussperren) sofort fixen + committen; kosmetische
  Funde nur notieren, nicht ungefragt anfassen.
- Memory `whop-access-gate-ids.md` und `whop-stack-migration.md` mit dem Ergebnis aktualisieren.
- `node test-*.js` (falls vorhanden für Whop-Pfade) grün halten.
- Nicht deployen — das macht der User.

---

**Modell-Empfehlung: Opus 4.8.** Grund: das ist kein lokalisierter Bugfix, sondern eine
Ende-zu-Ende-Sicherheitsanalyse über mehrere Dateien (Client + 2 Serverless-Functions) mit
mehreren miteinander verzahnten Fehlerpfaden (Grace/Retry/Rate-Limit/Company-Fallback), wo ein
zahlender Kunde als Kollateralschaden schon mehrfach ausgesperrt wurde. Genau die Art Reasoning
über Edge-Cases und Race Conditions, bei der Opus verlässlicher ist als Sonnet.
