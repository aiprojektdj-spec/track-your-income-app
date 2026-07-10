# Spec: Offline-Grace-Modus + Steuerberater-Read-Only-Zugriff

Status: **Geplant, Umsetzung in neuer Session.** Erstellt 2026-07-09, aus Rückfrage-Runde mit User.

---

## 1. Offline-Grace-Modus (ICE-Fahrt-Szenario)

**Kontext:** Nutzer arbeitet primär am Handy, fährt öfter ICE mit wiederholten, kurzen Netzunterbrechungen (kein einzelner langer Offline-Block). Whop-Auth braucht aktuell Serverkontakt.

**Entscheidung:**
- **Grace-Period: 4 Stunden.** Einmal online eingeloggt → Whop-Token/Access-Flag lokal cachen (localStorage), gültig 4h ohne erneuten Server-Check. Netzflackern während der Fahrt betrifft die App nicht.
- Nach 4h ohne Reconnect: **offen** — harter Re-Login-Zwang oder degradierter Read-Only-Modus? → nächste Session entscheiden.
- Datenhaltung: bereits lokal-first (localStorage/IndexedDB), keine Änderung nötig.
- Reconnect-Sync: Cloud-Sync (Pro, E2E, opt-in) pusht offene lokale Änderungen sobald wieder online.

**Wichtig — Konfliktfall (vom User bestätigt, kein Nice-to-have):**
- Parallele Nutzung auf 2. Gerät (Laptop/PC) während Handy offline ist **real möglich** ("Ja, faktisch zeitgleich möglich").
- Also **kein** einfaches "last write wins". Braucht echte Konflikterkennung beim Reconnect — z. B. Zeitstempel-Vergleich pro Datensatz (Store-Stamping existiert laut [[cloud-sync-backend]] teilweise schon), bei Kollision Warnung/Merge-Dialog statt stillem Überschreiben.
- Zu prüfen: was tut `js/cloud-sync.js` heute bei Konflikt? (Aktueller Stand unverifiziert, nicht annehmen.)

**Offene Punkte für nächste Session:**
1. Wo genau greift der Whop-Check heute (nur App-Start? jeder Page-Load? jede Aktion?) → `js/whop-auth.js` lesen.
2. Wie wird der 4h-Grace-Token gespeichert/geprüft (Ablauf-Timestamp, sauberes Verfallen)?
3. UX bei abgelaufener Grace-Periode + weiterhin offline: klare Meldung statt Absturz/Blockade.
4. Bestehende Konfliktlogik in `js/cloud-sync.js` sichten, ggf. Merge-Strategie nachrüsten.

---

## 2. Steuerberater Read-Only-Zugriff

**Entscheidung (vorläufig, User klärt mit Kunde ab):**
- Tendenz: **eigener Whop-Account für StB**, aber mit Read-Only-Rolle (kein Zeit-Link, kein Extra-Login-System).
- Umfang: **voller Datenbestand** sichtbar (nicht nur EÜR/USt/Belege).
- StB darf nichts bearbeiten — alle Schreib-Aktionen/Buttons müssen für diese Rolle ausgeblendet/deaktiviert sein.

**Wichtiger Architektur-Konflikt (vor Umsetzung unbedingt klären):**
- Cloud-Sync ist laut [[cloud-sync-backend]] E2E, Backup nutzt PBKDF2-User-Key (`js/backup-crypto.js`). Falls Cloud-Sync-Daten client-seitig mit dem Passwort/Schlüssel des Haupt-Nutzers verschlüsselt sind, kann ein zweiter Whop-Account (StB) sie **nicht lesen**, ohne diesen Schlüssel zu kennen.
- Klären: ist `js/cloud-sync.js` echtes E2E mit Nutzer-Key, oder nur Transport-verschlüsselt (TLS) mit Server-seitigem Klartext-Zugriff? Entscheidet, ob ein zweiter Account technisch überhaupt lesen kann oder ob ein Schlüssel-Sharing-Mechanismus (StB bekommt Envelope-Key bei Einladung) gebaut werden muss.
- Falls echtes E2E: braucht Einladungsfluss, der den Schlüssel sicher an den StB-Account weitergibt — eigene Sicherheitsüberlegung, nicht trivial.

**Weitere offene Punkte:**
- Wie wird StB-Account mit genau einem Mandanten-Datenbestand verknüpft? (Einladung per E-Mail? Whop-seitig oder App-seitig verwaltet?)
- Rollenmodell: wo steht "read-only" — Whop-Membership-Metadaten oder App-eigene Rolle?
- Multi-Mandant: falls ein StB mehrere Stackr-Kunden betreut, braucht er später ggf. einen Account-Switcher — aktuell nicht im Scope, aber früh mitdenken.
- **Voraussetzung vor Umsetzungsstart:** User klärt mit dem tatsächlichen Kunden die genaue Zugriffsform ab.

---

## Priorität

Nur Planung diese Session, **keine Code-Änderung**. Umsetzung in neuer Session, sobald:
- (1) offen ist, ob `js/cloud-sync.js` echtes E2E oder Server-lesbar ist (kurzer Code-Check, kein Rätselraten), und
- (2) User Rücksprache mit Kunde zur StB-Zugriffsform abgeschlossen hat.

---

## UMSETZUNG 2026-07-09 (Session „offline-grace")

### Vorfrage 1 — GEKLÄRT: Cloud-Sync ist **echtes E2E**
`js/cloud-sync.js`: 256-bit-Schlüssel via `crypto.getRandomValues` (Z. 399), **nur lokal** in
localStorage, **nie** hochgeladen; AES-GCM client-seitig, Server (Upstash EU) sieht nur Chiffrat.
Schlüssel ist **unabhängig von der Whop-Identität** — Geräte-Sharing nur über den Base32-
Wiederherstellungscode. **Folge für Feature 2:** ein zweiter Whop-Account bekommt aus Cloud-Sync
technisch **nichts**; ohne Schlüssel keine Entschlüsselung. Read-only-StB ist **nicht trivial** (s. u.).

### Feature 1 — GEBAUT + im Browser verifiziert ✅
- **Offline-Grace 4 h** in `js/whop-auth.js`: `whop_grace_until` (ms-Epoch), gestempelt bei jeder
  erfolgreichen Autorisierung (Owner-Bypass + hasAccess). `boot()` short-circuit: frische Grace →
  `_onAuthorized(cachedUser)` **ohne** Server-Roundtrip (ICE-Flacker-Szenario).
- **Netzfehler ≠ Logout:** `_validateAndContinue` unterscheidet jetzt **401/403** (echter Auth-Fehler
  → Token+Grace löschen) von **Netz-/5xx-Fehler** (→ `_graceFallback`, Token bleibt). Vorher wurde
  bei jedem `catch` der Token genuked → offline = rausgeworfen. Behoben.
- **Nach Ablauf (Entscheidung + Begründung):** harter Re-Login (kein degradierter Read-Only-Modus).
  Grund: local-first → keine Datenverluste; ein zweiter Offline-Modus wäre Extra-Code/State ohne
  Mehrwert (YAGNI). Klare, offline-spezifische Meldung statt Absturz/Blockade.
- **Konflikt-Erkennung in `js/cloud-sync.js`:** vorher per-Record-LWW ohne Warnung. Neu: pro Scope
  `oyi_sync_base_<scope>` (updatedAt je Record beim letzten Sync). Bei Merge → echte Kollision nur,
  wenn **beide** Seiten seit Base bewegt (kein Falsch-Positiv bei sequentiellen Syncs). LWW bleibt
  (neuere Version gewinnt, nie Datenverlust der neuesten Fassung), **aber** Warn-Toast + Konsolen-Log
  mit Anzahl → Nutzer weiß Bescheid.
  - **Bewusster Tradeoff:** Warnung statt blockierendem Merge-/Keep-Both-Dialog (mobile/ICE-tauglich).
    Falls „beide Fassungen behalten + manuell mergen" gewünscht → Folge-Session.
- Test: `node test-cloud-sync.js` → 5/5 (inkl. neuer Konflikt-Test). Browser: Grace-Boot ohne
  Roundtrip, 401-Cleanup, beide Module fehlerfrei geladen — verifiziert.

### Feature 2 — IN ARBEIT: Envelope-Key gewählt (User-Go 2026-07-09)
User-Entscheidung: **Option 2 (Envelope-Key, sauber)** — echter Entzug/Revocation gefordert,
nicht die UI-only-Krücke. Backend-Realität (aus `api/sync.js`): Daten liegen unter
`sync:<ownerId>:<scope>`, StB hat andere userId → kann ohne Grant **nicht mal pullen**. Read-only
ist daher server-seitig erzwingbar (StB-Token schreibt nie in fremde Owner-Keys) — die UI-Sperre
ist nur noch UX, keine Sicherheitsgrenze.

**Phasen:**
- **Phase 1 — GEBAUT + node-getestet ✅** (`js/stb-share.js`, `test-stb-share.js`, 3/3):
  ECDH-P-256-Envelope. `genKeyPair` / `wrapKey(dataKey, granteePub)` / `unwrapKey(env, granteePriv)`.
  Ephemerales ECDH je Envelope (forward secrecy); fremder Key kann kryptografisch nicht entpacken.
- **Phase 2 — Server (`api/sync.js`) GEBAUT + handler-getestet ✅** (`test-api-sync.js`, 9/9,
  gemocktes Upstash+Whop). Neue Actions (userId immer server-seitig aus Token):
  - `register_pubkey {pub}` → `pubkey:<userId>` (idempotent; **kein Pro nötig** — Grantee-Read).
  - `get_pubkey {granteeId}` → pub-JWK des StB (Owner, Pro).
  - `grant {granteeId, envelope}` → `grant:<ownerId>:<granteeId>` = {role:'readonly', envelope,
    ownerName, createdAt}; `SADD grantsfor:<granteeId> <ownerId>` (Owner, Pro).
  - `list_grants` → für den auth. StB alle {ownerId, ownerName, envelope} (kein Pro).
  - `revoke {granteeId}` → Grant löschen + SREM (echter Entzug; Owner sollte danach re-keyen).
  - `pull {scope, owner}` → mit `owner`: nur bei `grant:<owner>:<authUserId>` (kein Pro, Grant
    autorisiert). `push`/`delete` mit `owner` → **immer 403 readonly** (vor dem Pro-Gate).
  - **Zero-Cost bestätigt:** kein Zweit-Abo für den StB (Grant autorisiert), nur winzige Redis-Keys,
    keine neue Function/Fremdleistung. Eigener Scope ohne Pro bleibt `pro_required` (Gate intakt).
- **Phase 3 — UI GEBAUT (Live-App read-only, User-Wahl) — Browser-E2E ausstehend.**
  - `js/stb-share.js` (erweitert): Client-Flows — eigenes ECDH-Keypair lokal (`oyi_stb_privkey/pubkey`),
    `registerPubkey()` beim Login, `showCode()` (Freigabe-Code = Whop-userId), `inviteFlow/_doInvite`
    (Owner: get_pubkey→wrapKey(CloudSync.keyBytes)→grant), `clientsFlow/enterClient/exitClient`,
    `isReadonly()`/`blocks()`, `initReadonlyBanner()`.
  - `js/cloud-sync.js`: `keyBytes()`, `foreignLoad(ownerId, kb)` (Mandanten-Firmen pullen+entschlüsseln,
    lokal als `_readonly`-Client-Firmen ablegen), `foreignUnload()`. Sync überspringt `_readonly`-Firmen,
    `onLocalChange` gesperrt im Read-Only → Mandantendaten werden NIE hochgeladen.
  - `js/actions.js`: zentraler Read-Only-Guard am Dispatch (blockt Schreib-Verben via Regex; nur
    click/submit) — EIN Chokepoint statt 155 Buttons.
  - `css/style.css`: `.stb-readonly`-Regeln blenden Schreib-Buttons per Attribut-Suffix aus
    (extern statt inline, da CSP injizierte `<style>` blockt) — deckt so auch die eb-*/rech-*-
    Router-Buttons ab. Banner-Platz via `padding-top`.
  - `js/whop-auth.js`: Menü-Einträge (einladen / Mandanten / Mein Code) + registerPubkey + Banner-Init.
  - `app.html` **+ rechnungen/lager/eigenbelege/index.html**: laden `js/stb-share.js`.
  - **Architektur:** Mandanten erscheinen als zusätzliche READ-ONLY-Firmen in der bestehenden
    Multi-Company-Registry → volle App zeigt sie via CompanyManager, kein separater Renderpfad.
  - **co_id-Kollisionsschutz:** `foreignLoad` lässt Mandanten-Firmen mit ID-Kollision zu einer
    eigenen Firma aus (nie überschreiben) + Warn-Toast.
  - **Standalone-Seiten:** stb-share.js dort geladen → Banner + CSS-Ausblendung greifen. UI-Dispatch-
    Guard deckt nur js/actions.js-Aktionen; eb-*/rech-* haben eigene Router → dort schützen CSS-
    Ausblendung + Server-Hard-Block (StB kann nie in fremde Owner-Keys schreiben).
  - **NOCH OFFEN (nur das):** Browser-E2E mit 2 echten Whop-Accounts (Einladung→Grant→Live-
    Mandantenansicht→Entzug) — Whop-Gate, nicht automatisierbar, muss der User mit 2 Accounts fahren.

**Rest-Risiko/Hinweis:** StB hat lesenden Vollzugriff (gewollt). „Read-only" schützt Owner-Daten vor
Schreibzugriff (server-seitig), nicht vor Lesen/Export durch den StB — das ist der Zweck.

### (Historischer Architektur-Vergleich, vor Go)
Wegen echtem E2E gibt es **keinen** server-seitigen Read-only-Schalter (Server kann Klartext nicht
sehen). Optionen, schlankster zuerst:
1. **Schlüssel-Weitergabe + UI-Read-only (pragmatisch, empfohlen als MVP):** Haupt-Nutzer lädt StB per
   bestehendem „Mit bestehendem Sync verbinden"-Flow ein (Wiederherstellungscode). StB-Whop-Account
   bekommt App-eigene Rolle `readonly` (localStorage-Flag, gesetzt bei Einladung/Whop-Metadaten) →
   alle Schreib-Buttons/-Aktionen ausgeblendet. **Schwäche:** UI-Read-only ist client-seitig
   umgehbar; StB hat kryptografisch Vollzugriff; keine Schlüssel-Rotation/Entzug ohne Re-Key.
2. **Envelope-Key (sauber, teuer):** Datenschlüssel wird für den StB-Account mit dessen Public-Key
   verpackt (Einladung erzeugt Envelope). Entzug = Envelope löschen + Re-Key. Deutlich mehr Krypto-/
   Server-Arbeit; nur wenn echter Entzug/Revocation gefordert.
3. **Read-only nur crypto-erzwingbar wäre:** separater „View"-Schlüssel für einen unverschlüsselt-
   signierten Export-Snapshot — eigenes Teilprojekt, aktuell Overkill.
Offen bleibt (User↔Kunde): genaue Zugriffsform, Rollen-Ablage (Whop-Membership-Metadaten vs. App),
Multi-Mandant-Switcher (bewusst out-of-scope).
