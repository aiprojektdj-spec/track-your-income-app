# Prompt für neue Session (copy-paste)

---

Kontext: Feature „Steuerberater Read-Only" (Envelope-Key) ist zu ~80 % gebaut und committet
auf Branch `feature/csp-phase-c` (Commits 0e9e73c → aa0089b). Lies zuerst
`plan/spec-offline-grace-stb-readonly.md` (Abschnitt „Feature 2") und
`plan/e2e-steuerberater-walkthrough.md`. Krypto (test-stb-share.js 3/3), Server-Grants
(api/sync.js, test-api-sync.js 9/9) und die In-App-UI (js/stb-share.js, Read-Only-Guard,
Banner) sind fertig + verifiziert. Es fehlen ZWEI Client-Lücken. Bau beide, verifizier,
committe auf denselben Branch.

WICHTIG (geteiltes Repo): In diesem Ordner arbeitet evtl. eine Parallel-Session. Vor JEDEM
Edit die Datei frisch lesen; nur die eigenen Dateien stagen (nie fremde uncommittete
Änderungen mitcommitten). Nicht deployen — das macht der User.

## Lücke 1 (kritisch) — Steuerberater ohne eigenes Abo durchs Login-Gate lassen

Problem: `js/whop-auth.js` → `_validateAndContinue` zeigt bei `has_access = false` den
Kauf-Screen (`_showNoMembershipScreen`). Ein StB ohne eigenes Pro-Abo kommt so nie in die
App, kann seinen Public-Key nie registrieren und seinen Freigabe-Code nie sehen →
Henne-Ei, das „kein Zweit-Abo"-Versprechen greift nicht. Der Server erlaubt Grantee-Reads
bereits ohne Pro (register_pubkey/list_grants/pull-mit-Grant sind Pro-frei).

ZUERST prüfen (der riskante Teil): Gibt es über das Login-Gate hinaus ein Hard-Gate/Paywall,
das Nicht-Pro-Accounts die App sperrt? `grep` nach UserPlan-Gating, App-Boot-Paywall,
`isPro`, Trial-Logik. Wenn ja, muss der Grantee-Read-Modus dort eine saubere Ausnahme
bekommen (z. B. Flag, das als „read-only erlaubt" gilt), sonst landet der StB im nächsten Gate.

Dann in `_validateAndContinue`, wenn `has_access = false`, VOR dem Kauf-Screen:
- `StbShare.registerPubkey()` aufrufen (Token ist da) — damit der Mandant ihn einladen kann.
- Neue exportierte Funktion `StbShare.listGrants()` (dünner Wrapper um `_api({action:'list_grants'})`,
  gibt das grants-Array zurück) abfragen.
- grants.length > 0 → in Read-Only-Grantee-Modus einlassen: `_stampGrace()` + `_onAuthorized(me)`
  (App lädt; er öffnet dann per Menü „📂 Mandanten" die Mandantenansicht).
- grants.length === 0 → einen „Steuerberater-Einstieg"-Screen zeigen mit seinem Freigabe-Code
  (= `me.sub`) + Kopier-Button, statt nur „Pro kaufen". (Kann `_showNoMembershipScreen` um eine
  StB-Sektion erweitern.)
Verifizieren, dass ein Nicht-Pro-Grantee die App wirklich bedienbar bis zur Mandantenansicht
erreicht (Browser-Smoke mit geseedetem localStorage, da echtes Whop-Login im Preview nicht geht).

## Lücke 2 (klein) — „Zugriff entziehen"-Button beim Mandanten

Server-`revoke` existiert (getestet), aber der Owner kann seine vergebenen Freigaben weder
sehen noch entziehen (nur per DevTools).
- `api/sync.js`: im `grant` zusätzlich `SADD grantedby:<ownerId> <granteeId>`; im `revoke`
  `SREM grantedby:<ownerId> <granteeId>`. Neue Action `list_my_grantees` → `SMEMBERS
  grantedby:<ownerId>` + je Eintrag das Grant-Objekt (Code + createdAt) zurück. (Grantee-Name
  ist server-seitig nicht bekannt → Code + Datum anzeigen reicht.)
- `js/stb-share.js`: `manageFlow()` — Dialog listet freigegebene StBs (Code + Datum) mit
  „Zugriff entziehen" pro Eintrag → ruft `revoke`. Menü-Eintrag in `js/whop-auth.js`
  (`openUserMenu`) „Steuerberater verwalten" oder in den Einladen-Dialog integrieren.
- `test-api-sync.js` um Test erweitern: nach `grant` erscheint der Grantee in `list_my_grantees`;
  nach `revoke` ist er weg + Pull → 403.

## Abschluss
- Verifizieren: `node test-*.js` alle grün, Browser-Smoke der neuen Pfade.
- `plan/spec-offline-grace-stb-readonly.md` + Memory `offline-grace-stb-readonly-spec.md`
  aktualisieren (Lücken erledigt; als NUR-NOCH-OFFEN bleibt der 2-Whop-Account-E2E laut
  `plan/e2e-steuerberater-walkthrough.md` + optional der Krypto-Re-Key beim Entzug).
- Auf `feature/csp-phase-c` committen. Nicht deployen.

Hinweis Re-Key (bewusst NICHT bauen, nur erwähnen): `revoke` entzieht künftigen Zugriff, aber
ein StB, der den Schlüssel behält, könnte alte Snapshots weiter entschlüsseln, bis der Owner
neu verschlüsselt. Re-Key nur bauen, wenn der User es ausdrücklich verlangt.

---

**Modell-Empfehlung: Opus 4.8.** Grund: Lücke 1 ist eine sicherheitsrelevante Änderung am
Auth-Gate mit einer unsicheren Wechselwirkung zum Hard-Gate/Paywall, die erst untersucht und
dann sauber ausgeschnitten werden muss — genau die Art Reasoning, wo Opus den Unterschied
macht. Lücke 2 allein wäre Sonnet-tauglich, hängt aber am selben Multi-Datei-Kontext
(whop-auth.js, stb-share.js, api/sync.js). Fürs Bündel: Opus 4.8.
