Prompt für neue Session (copy-paste):

---

Kontext: Feature "Steuerberater Read-Only" (Envelope-Key, ECDH P-256) ist auf **master**
bereits vollständig gebaut: Krypto-Kern + Client-Flows (`js/stb-share.js`), Server-Endpoints
`register_pubkey/get_pubkey/grant/revoke/list_grants` (`api/sync.js`), Read-Only-UI-Sperre
(`.stb-readonly`-Klasse, `StbShare.blocks()`), Backend-Tests (`test-api-sync.js`,
`test-stb-share.js`). Kein Free-Tier-Risiko: `js/user-plan.js` `isPro()` ist hart auf `true`
gesetzt, es gibt also keine zweite Paywall, die dazwischenfunkt.

Es gibt einen älteren Branch `feature/csp-phase-c` mit Commit `7c1573d`, der genau diese
zwei Lücken schon mal angegangen ist — **der Branch ist aber 8 Tage hinter master
zurückgefallen** (fehlt: signiertes Whop-Grace-Token, Blob-Sync-Umbau, CH/AT-Entfernung,
etc.) und lässt sich nicht mergen. Nur als Referenz lesen (`git show 7c1573d`), NICHT
mergen/cherry-picken. Baue direkt gegen den aktuellen `master`-Stand der drei Dateien unten.

Es fehlen zwei Client-Lücken, siehe unten. Bau beide, verifizier, committe auf `master`.

WICHTIG (geteiltes Repo): evtl. läuft eine Parallel-Session. Vor JEDEM Edit die Datei frisch
lesen; nur eigene Dateien stagen. Nicht deployen — macht der User.

## Lücke 1 (kritisch) — Steuerberater ohne eigenes Abo durchs Login-Gate lassen

Problem: `js/whop-auth.js` → `_validateAndContinue`, Block ab Zeile ~265: bei
`hasAccess === false` (Antwort von `/api/whop-access`) geht es direkt in
`_showNoMembershipScreen(me)` (Zeile ~288). Ein Steuerberater ohne eigenes Pro-Abo kommt so
nie in die App, kann seinen Public-Key nie registrieren und seinen Freigabe-Code nie sehen
→ Henne-Ei. Der Server erlaubt Grantee-Reads bereits ohne Pro (`register_pubkey`,
`list_grants`, `pull` mit `owner`-Param sind laut `api/sync.js:197` explizit Pro-frei).

Vor `_showNoMembershipScreen(me)` einfügen:
- `StbShare.registerPubkey()` aufrufen (Token ist vorhanden) — Mandant kann ihn danach
  einladen.
- Neue dünne Funktion in `js/stb-share.js` exportieren, z. B. `checkGrants()` — Wrapper um
  `_api({ action: 'list_grants' })`, gibt reines `grants`-Array zurück (kein UI, im
  Unterschied zu `clientsFlow()`, das direkt ein Modal öffnet).
- `grants.length > 0` → in Read-Only-Grantee-Modus einlassen: `_stampGrace(graceToken)` +
  `_onAuthorized(me)` (App startet normal; StB öffnet danach per Menü "📂 Mandanten" die
  Mandantenansicht).
- `grants.length === 0` → weiterhin `_showNoMembershipScreen(me)`, aber um eine StB-Sektion
  erweitern: eigenen Freigabe-Code (`me.sub` bzw. `me.id`) + Kopier-Button anzeigen (Inhalt
  kann sich an `StbShare.showCode()` orientieren), statt nur "Pro kaufen".

Verifizieren: echtes Whop-Login geht im Preview nicht (App ist Login-gated) — Browser-Smoke
mit gemocktem `fetch`/gemocktem `whop_user`-localStorage-Eintrag, analog zum Vorgehen in
`7c1573d` (siehe `git show 7c1573d -- js/whop-auth.js` als Referenz für den Test-Aufbau, Code
selbst nicht übernehmen).

## Lücke 2 (klein) — "Zugriff entziehen" beim Mandanten

Server-`revoke` existiert bereits und ist getestet (`test-api-sync.js`), aber der Owner kann
seine erteilten Freigaben weder sehen noch entziehen (nur per DevTools-Fetch möglich).

- `api/sync.js`: im `grant`-Branch (Zeile ~316) zusätzlich
  `SADD grantsby:<ownerId> <granteeId>`; im `revoke`-Branch (Zeile ~329) zusätzlich
  `SREM grantsby:<ownerId> <granteeId>` (Naming bewusst symmetrisch zum bestehenden
  `grantsfor:<granteeId>`-Set). Neue Action `list_my_grantees`: `SMEMBERS grantsby:<userId>`
  + je Eintrag `createdAt` aus dem zugehörigen `grant:<userId>:<granteeId>`-Objekt lesen und
  zurückgeben (Grantee-Klarname ist server-seitig nicht bekannt → Code + Datum reicht).
- `js/stb-share.js`: `manageFlow()` — Dialog listet erteilte Freigaben (Code + Datum) mit
  "Zugriff entziehen"-Button pro Zeile → ruft `revoke`, danach Liste neu laden + Toast.
  `_doRevoke(granteeId)` als Actions-Handler registrieren (`stb-do-revoke`).
- Einstiegspunkt: `js/whop-auth.js` ~Zeile 484-486, im selben User-Menü-Block wie
  `stb-invite`/`stb-clients`/`stb-my-code` — neuer Eintrag "🔒 Freigaben verwalten"
  (`data-action="stb-manage"`).
- `test-api-sync.js` erweitern: nach `grant` erscheint der Grantee in `list_my_grantees`
  (mit `createdAt`); nach `revoke` ist er aus der Liste verschwunden + `pull` mit `owner`
  liefert weiterhin 403 (bereits getestet, nur zur Vollständigkeit gegenprüfen).

## Bewusst NICHT bauen

Re-Key beim Entzug: `revoke` sperrt künftigen Zugriff, ein StB, der den alten Datenschlüssel
noch hat, könnte alte (bereits gepullte) Snapshots weiter entschlüsseln, bis der Owner neu
verschlüsselt. Nur im Revoke-Dialog als Hinweistext erwähnen, nicht implementieren — nur
bauen, wenn der User es ausdrücklich verlangt.

## Abschluss

- `node test-api-sync.js` + `node test-stb-share.js` grün.
- `node --check` auf allen geänderten Dateien.
- Browser-Smoke der neuen Pfade (gemockt, siehe oben) dokumentieren, echter
  2-Whop-Account-E2E bleibt beim User.
- Memory aktualisieren (`offline-grace-stb-readonly-spec.md` fortschreiben oder neue Memory
  anlegen): beide Lücken erledigt, einzig offen = echter 2-Account-E2E-Test + optionaler
  Re-Key.
- Auf `master` committen (kleiner, fokussierter Commit reicht — kein neuer Branch nötig, da
  `feature/csp-phase-c` nicht weitergeführt wird).

---

**Modell-Empfehlung: Opus 4.8.** Lücke 1 ändert das Auth-Gate — sicherheitsrelevant, mehrere
Dateien (`whop-auth.js`, `stb-share.js`, `api/sync.js`) müssen konsistent bleiben, und ein
Fehler hier kann entweder zahlende Kunden aussperren oder das Pro-Gate umgehbar machen.
Lücke 2 allein wäre Sonnet-tauglich, hängt aber am selben Kontext — fürs Bündel Opus 4.8.
