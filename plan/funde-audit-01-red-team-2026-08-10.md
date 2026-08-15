# Red-Team-Audit — Funde (2026-08-10)

**Session-Prompt:** `plan/session-prompt-audit-01-red-team-2026-08-10.md`
**Scope:** Web 1.7, `api/*`, `js/whop-auth.js`, `js/cloud-sync.js`, alle Render-Pfade mit `innerHTML`.
**Methode:** Code-Lesen + konkrete Exploit-Pfad-Konstruktion. Kein Live-Test gegen Produktion.

---

## Zusammenfassung

Die **serverseitige** Angriffsfläche ist gut gehärtet: UserID wird immer aus dem Whop-Token
abgeleitet, Redis-/Blob-Keys sind an diese ID gebunden, Fremdzugriff geht nur über einen
expliziten Grant, E2E-Verschlüsselung ist echt (Schlüssel bleibt lokal, AES-GCM mit AAD).
**Kein Fund erlaubt das Lesen fremder Klardaten.**

Die realen Probleme liegen in zwei anderen Ecken:
1. **Monetarisierung** — die Zahlschranke ist prinzipbedingt client-seitig und mit einer
   Konsolenzeile zu umgehen (R1); dazu ein zweiter, „legitimer" Weg über StB-Grants (R4).
2. **Kosten-DoS** — ein einzelner zahlender Account kann unbegrenzt Redis-/Blob-Speicher
   belegen (R2, R6).

| # | Fund | Ausnutzbar | Severity |
|---|---|---|---|
| R1 | Whop-Gate per Browser-Konsole umgehbar | Trivial | 🟠 P1 |
| R2 | Unbegrenzte Scope-Anlage → Redis-Kosten-DoS | Trivial | 🟠 P1 |
| R3 | Owner-Allowlist prüft änderbaren Username statt `user_`-ID | Mittel | 🟡 P2 |
| R4 | 1 Pro-Abo kann unbegrenzt Gratis-Zugänge erzeugen (StB-Grant) | Trivial | 🟡 P2 |
| R5 | Sync-Key **und** Token in localStorage → 1 XSS = Totalverlust | Komplex | 🟡 P2 |
| R6 | Blob-Upload ohne Speicher-Quota pro Nutzer | Trivial | 🟡 P2 |
| R7 | AAD-Migrations-Fallback hebelt Scope-Bindung für Alt-Chiffrat aus | Komplex | 🟢 P3 |
| R8 | `get_pubkey` als Nutzer-Enumerations-Orakel | Mittel | 🟢 P3 |
| R9 | Grace-Token gegen Systemuhr-Rückstellung ungeschützt | Mittel | 🟢 P3 |
| R10 | Rate-Limits fail-open bei Redis-Ausfall | Mittel | 🟢 P3 |

---

## R1 — Whop-Gate per Browser-Konsole umgehbar

**Ziel:** Volle App-Nutzung ohne Abo.
**Methode:**
```javascript
// 1. app.html öffnen (Gate-Overlay erscheint) — Login mit einem GRATIS-Whop-Account genügt,
//    oder ganz ohne Login. Dann in der Konsole:
App._continueAfterAuth({ id: 'x', email: 'a@b.c', username: 'x' });
document.querySelectorAll('#whopLoginOverlay,#whopNoMemberOverlay,#authLoadingOverlay')
        .forEach(function (e) { e.remove(); });
```
`App._continueAfterAuth` ist eine öffentliche Methode am globalen `App`-Objekt
([js/app.js:101](../js/app.js#L101)), aufgerufen aus [js/whop-auth.js:513](../js/whop-auth.js#L513).
Ein zweites Gate existiert nicht: `UserPlan.isPro()` gibt hart `true` zurück
([js/user-plan.js:29](../js/user-plan.js#L29)), da es kein Free-Tier gibt.

Zweiter, noch einfacherer Weg: die App ist eine rein statische Seite. `wget -r` auf
`/app.html` + `/js/` und lokal per `file://` öffnen — das Gate ist dann nur noch ein Overlay
über einer voll funktionsfähigen App.

**Ausnutzbar:** Trivial.
**Severity:** 🟠 P1 (Umsatz, kein Datenschaden).
**Bewertung:** Bei einer Local-First-App ist das **architekturbedingt nicht dicht zu bekommen** —
die gesamte Rechenlogik liegt beim Client. Was serverseitig hängt (Cloud-Sync, Blob-Upload,
StB-Freigaben), ist korrekt gegated und bleibt dem Bypasser verschlossen.
**Fix (realistisch):** Nicht „dichtmachen", sondern Wert nach hinten verlagern — Cloud-Sync,
Multi-Device und StB-Freigabe sind bereits serverseitig Pro-only. Das ist die richtige Antwort;
mehr Aufwand in den Client-Gate zu stecken ist verschwendet.

---

## R2 — Unbegrenzte Scope-Anlage → Redis-Kosten-DoS

**Ziel:** Upstash-Kosten des Betreibers in die Höhe treiben / Speicher fluten.
**Methode:** `SCOPE_RE = /^(__account|co_[a-z0-9_]+)$/`
([api/sync.js:106](../api/sync.js#L106)) validiert nur die **Form** des Scopes, nicht dessen
Existenz oder Anzahl. Es gibt keine Obergrenze für die Zahl der Scopes pro Nutzer und kein TTL
auf `sync:`-Keys.

```javascript
// Mit EINEM gültigen 15-€-Abo, ~40 Requests/Minute (RATE_MAX):
for (let i = 0; ; i++) {
  await fetch('/api/sync', { method:'POST',
    headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+tok },
    body: JSON.stringify({ action:'push', scope:'co_flood'+i, version:0,
                           iv:'AAAA', ciphertext:'A'.repeat(3.5*1024*1024) }) });
}
// 40 × 3,5 MB = 140 MB/Minute → ~200 GB/Tag, dauerhaft belegt.
```
Dasselbe gilt für `anchor`: pro Scope bis zu 20.000 Einträge (`ANCHOR_MAX`), aber die Zahl der
Scopes ist unbegrenzt — der LTRIM-Deckel greift also nur pro Key, nicht pro Nutzer.
Analog `grant`/`grantsby`: `granteeId` ist frei wählbar (`[A-Za-z0-9_-]{1,128}`), jeder Grant
legt bis zu 8 KB ab, das Set `grantsby:<userId>` wächst unbegrenzt
([api/sync.js:356-367](../api/sync.js#L356)).

**Ausnutzbar:** Trivial (kostet den Angreifer 15 €).
**Severity:** 🟠 P1 (Betriebskosten, kein Datenschaden).
**Fix:** Pro Nutzer ein Scope-Zähler in Redis (`SCARD sync:scopes:<userId>`, Deckel z. B. 25 —
mehr als 25 Firmen hat kein Einzelunternehmer) und ein Gesamt-Byte-Budget. Analog Deckel auf
`grantsby:<userId>` (z. B. 10 Steuerberater).

---

## R3 — Owner-Allowlist prüft änderbaren Username statt `user_`-ID

**Ziel:** Dauerhafter Gratis-Zugang inkl. Cloud-Sync durch Übernahme des Owner-Bypasses.
**Methode:** Drei Endpunkte vergleichen den Whop-**Anzeige-/Benutzernamen** gegen eine Allowlist:

- [api/whop-access.js:181,186](../api/whop-access.js#L181) — `me.preferred_username || me.name || me.sub`
- [api/sync.js:184,209](../api/sync.js#L184) — `me.preferred_username || me.name || me.username`
- [api/blob-upload.js:142,149](../api/blob-upload.js#L142) — identisch

Beide Werte sind vom Nutzer bei Whop frei setzbar. Zwei Pfade:
1. Der Owner ändert seinen Whop-Usernamen → `secondlifevintage41` wird frei → ein Angreifer
   registriert ihn und erbt den Bypass.
2. Liefert `/oauth/userinfo` für einen Account kein `preferred_username`, greift der Fallback auf
   `me.name` — den frei wählbaren **Anzeigenamen**. Ein Angreifer setzt seinen Anzeigenamen auf
   `secondlifevintage41`.

Gewinn: `has_access`-Prüfung wird komplett übersprungen → volles Pro inkl. Cloud-Sync und
Blob-Upload, dauerhaft, kostenlos. **Keine Fremddaten** — die UserID bleibt korrekt abgeleitet.

**Ausnutzbar:** Mittel (Pfad 2 hängt an Whops userinfo-Verhalten, Pfad 1 an einer Owner-Aktion).
**Severity:** 🟡 P2.
**Fix:** Allowlist auf die unveränderliche `me.sub` (`user_…`) umstellen, Env-Variablen
`SYNC_OWNER_USERNAMES` / `WHOP_OWNER_USERNAMES` → `*_OWNER_IDS`. Einzeiler pro Datei, kein
Verhaltensrisiko.

---

## R4 — 1 Pro-Abo erzeugt unbegrenzt Gratis-Zugänge (StB-Grant)

**Ziel:** Lizenz-Sharing — viele Nutzer, ein Abo.
**Methode:** Der Steuerberater-Pfad ist bewusst Pro-frei
([api/sync.js:199-201](../api/sync.js#L199)): `register_pubkey`, `list_grants` und
`pull` mit `owner` überspringen das Pro-Gate. Client-seitig genügt **ein einziger** Grant, um
den vollen App-Zugang freizuschalten:

```javascript
// js/whop-auth.js:372-381
var grants = await StbShare.checkGrants();
if (grants.length > 0) { _stampGrace(graceToken); await _onAuthorized(me); return true; }
```
Ein Angreifer mit einem Abo ruft `action:'grant'` für beliebig viele fremde Whop-User-IDs auf
(`granteeId` ist ungeprüfte Freitext-ID). Jeder Beschenkte ist danach ohne eigenes Abo
autorisiert — und weil „read-only" nur client-seitig durchgesetzt wird
(`StbShare.initReadonlyBanner()`), nutzt er die App faktisch voll.

**Ausnutzbar:** Trivial.
**Severity:** 🟡 P2 (Umsatz).
**Fix:** Deckel auf aktive Grants pro Owner (siehe R2) — das ist der eigentliche Hebel.
Ein echter Steuerberater braucht keine 50 Mandanten *pro Owner*; ein Owner braucht selten mehr
als 1-2 Berater. Zusätzlich: Grant nur wirksam, wenn der Grantee vorher einen Public-Key
registriert hat (heute wird der Grant blind auf eine beliebige ID gesetzt).

---

## R5 — Sync-Schlüssel und Token liegen beide in localStorage

**Ziel:** Bei einem XSS alle Cloud-Daten im Klartext abziehen.
**Methode:** [js/cloud-sync.js:32](../js/cloud-sync.js#L32) legt den **rohen AES-Schlüssel**
unter `oyi_sync_key_<uid>` ab, [js/cloud-sync.js:53](../js/cloud-sync.js#L53) liest den
Whop-Token aus `whop_access_token`. Beides ist über `document` erreichbar. Ein einziger
XSS-Treffer liefert damit nicht nur die lokale Sitzung, sondern erlaubt es, das Chiffrat
serverseitig zu ziehen **und offline zu entschlüsseln** — die E2E-Verschlüsselung fällt
vollständig.

**Ausnutzbar:** Komplex — **es wurde kein XSS gefunden** (siehe „Nicht ausnutzbar" unten), und
die CSP setzt `script-src-attr 'none'`, was `onerror=`-Payloads blockiert.
**Severity:** 🟡 P2 — nicht wegen Eintrittswahrscheinlichkeit, sondern wegen Schadensradius.
**Fix (optional, Aufwand mittel):** Schlüssel als nicht-extrahierbaren `CryptoKey`
(`extractable: false`) in IndexedDB statt als Rohbytes in localStorage. Ein XSS könnte dann
zwar noch ver-/entschlüsseln, aber den Schlüssel nicht exfiltrieren. Der Wiederherstellungscode
bleibt der Backup-Weg.

---

## R6 — Blob-Upload ohne Speicher-Quota pro Nutzer

**Ziel:** Vercel-Blob-Kosten treiben.
**Methode:** [api/blob-upload.js:94](../api/blob-upload.js#L94) erlaubt `RATE_MAX = 120`
Requests/Minute à `MAX_CHUNK = 4 MB` — 480 MB/Minute ≈ 28 GB/Stunde pro zahlendem Account.
`MAX_TOTAL_BYTES` deckelt nur eine einzelne zusammengesetzte Datei (200 MB), nicht die Summe.
Der Cron `api/blob-cleanup.js` räumt ausschließlich `stackr/tmp/` — mit `action=put` (Kind
`attachments`) hochgeladene Objekte werden nie automatisch gelöscht.

**Ausnutzbar:** Trivial (15 €).
**Severity:** 🟡 P2.
**Fix:** Laufendes Byte-Budget pro Nutzer in Redis mitzählen (`INCRBY blob:bytes:<userId>`),
Deckel z. B. 5 GB. Gleicher Codeblock wie das bestehende Rate-Limit.

---

## R7 — AAD-Migrations-Fallback hebelt Scope-Bindung für Alt-Chiffrat aus

**Methode:** [js/cloud-sync.js:139-144](../js/cloud-sync.js#L139) fängt einen fehlgeschlagenen
`decrypt` mit AAD ab und versucht es ohne `additionalData`. Für Chiffrat aus der Zeit vor der
AAD-Einführung entfällt damit die Bindung an `(ownerId, scope)`. Da **derselbe Schlüssel für
alle Scopes eines Nutzers** verwendet wird, könnte ein Angreifer mit Redis-Schreibzugriff
(= Betreiber oder kompromittierter Upstash-Zugang) den Alt-Blob von Firma A in den Slot von
Firma B schieben; der Client akzeptiert ihn still.

**Ausnutzbar:** Komplex (setzt Redis-Zugriff voraus).
**Severity:** 🟢 P3 — selbstheilend, der nächste Push schreibt wieder mit AAD.
**Fix:** Fallback mit Ablaufdatum versehen (z. B. „ab 2026-12-01 entfernen") und dann löschen.

---

## R8 — `get_pubkey` als Nutzer-Enumerations-Orakel

**Methode:** [api/sync.js:347-353](../api/sync.js#L347) antwortet mit `404 no_pubkey` bzw.
`200` + Public-Key **inklusive `username`**
([api/sync.js:340](../api/sync.js#L340)). Ein zahlender Angreifer kann so für beliebige
Whop-User-IDs feststellen, ob sie Stackr nutzen, und den zugehörigen Whop-Usernamen abgreifen.
**Ausnutzbar:** Mittel (Pro-Abo nötig, 40 Abfragen/Minute).
**Severity:** 🟢 P3 (Metadaten, keine Geschäftsdaten).
**Fix:** `username` aus der `get_pubkey`-Antwort entfernen — für das Wrappen des Schlüssels
wird nur `pub` gebraucht.

---

## R9 — Grace-Token gegen Systemuhr-Rückstellung ungeschützt

**Methode:** [js/whop-auth.js:96](../js/whop-auth.js#L96) prüft `payload.exp > Date.now()`.
Ein ehemaliger Kunde mit einem einmal echt signierten Token stellt die Systemuhr zurück und
behält den Zugang über die 4 Stunden hinaus.
**Ausnutzbar:** Mittel — aber **irrelevant**, weil R1 denselben Effekt in einer Zeile liefert.
**Severity:** 🟢 P3.
**Fix:** Keiner nötig. Wer die Uhr stellen kann, kann auch die Konsole öffnen.

---

## R10 — Rate-Limits fail-open bei Redis-Ausfall

**Methode:** Alle vier Endpunkte behandeln Redis-Fehler beim Rate-Limit als nicht-blockierend
([api/sync.js:167](../api/sync.js#L167), [api/whop-access.js:161](../api/whop-access.js#L161),
[api/whop-token.js:42](../api/whop-token.js#L42), [api/blob-upload.js:166](../api/blob-upload.js#L166)).
Fällt Upstash aus, entfällt jede Drosselung — inklusive der Bremse, die Whop-API-Quota schützt.
**Ausnutzbar:** Mittel (setzt einen Redis-Ausfall voraus, der nicht erzwingbar ist).
**Severity:** 🟢 P3.
**Bewertung:** Fail-open ist hier die **bewusst richtige** Entscheidung — ein zahlender Kunde
darf nicht an einem Redis-Ausfall scheitern. Kein Fix empfohlen, nur Monitoring: die
`console.error`-Zeilen sollten einen Alert auslösen, nicht nur im Log versanden.

---

## Nicht ausnutzbar (mit Begründung)

**Szenario 2 — Fremde Cloud-Daten lesen/schreiben:** Der Redis-Key wird immer aus der
serverseitig aus dem Token abgeleiteten `userId` gebaut
([api/sync.js:241](../api/sync.js#L241)); eine client-gesendete ID wird nirgends verwendet.
Fremdzugriff geht ausschließlich über `pull` + `owner` und erfordert einen existierenden Grant
([api/sync.js:250-255](../api/sync.js#L250)). Schreiben in fremde Scopes wird zweifach geblockt
(Zeile 205 und 262). Blob-URLs werden über `isOwnedBlobUrl()` gegen den eigenen Namespace
geprüft, mit korrekt escaptem Regex
([api/blob-upload.js:108-114](../api/blob-upload.js#L108)) — keine SSRF, kein Path-Traversal.
Selbst bei Zugriff bringt das Chiffrat nichts: AES-GCM mit rein lokalem Schlüssel.

**Szenario 3 + 7 — XSS via Freitextfelder / localStorage-Poisoning:** Alle geprüften
Render-Pfade escapen. `Utils.escapeHtml()` escapt auch Quotes (attributsicher,
[js/utils.js:157](../js/utils.js#L157)) und wird 359× in 33 Dateien verwendet; die Module ohne
diesen Helfer (`eigenbelege/js/app.js`, `rechnungen/js/erechnung-import.js`) haben ein eigenes,
korrektes `esc()`. Stichproben an den heikelsten Stellen — Firmenname
([js/companies.js:590](../js/companies.js#L590) → `App.showModal` escapt `<`/`>`), extern
gelieferte XRechnungs-XML ([rechnungen/js/erechnung-import.js:309-328](../rechnungen/js/erechnung-import.js#L309)),
Bank-CSV-Verwendungszwecke ([js/bank-import.js:400](../js/bank-import.js#L400)) — alle sauber.
`RechApp.showModal` setzt den Titel zwar roh
([rechnungen/js/app.js:129](../rechnungen/js/app.js#L129)), aber alle 11 Aufrufer übergeben
statische Strings. Zusätzliche Absicherung: CSP mit `script-src-attr 'none'` blockt
`onerror=`-Payloads, `object-src 'none'`, `frame-src 'none'`.

**Szenario 4 — CSRF:** Alle state-changing Endpunkte verlangen einen `Authorization:
Bearer`-Header, den ein Browser bei Cross-Site-Requests nicht automatisch mitschickt.
CORS ist auf genau eine Origin gesetzt. Der OAuth-Flow hat `state` **und** PKCE-S256
([js/whop-auth.js:253-268, 282](../js/whop-auth.js#L253)).

**Szenario 5 + 6 — Callback-Manipulation / Replay:** Der Code wird serverseitig mit
`client_secret` + `code_verifier` gegen Whop eingelöst
([api/whop-token.js:64-75](../api/whop-token.js#L64)); ein Client-Wert wird nie geglaubt.
Der Abo-Status wird bei jedem `boot()` ohne gültiges Grace-Token frisch von Whop geholt.
State-Check verhindert Login-CSRF, PKCE verhindert Code-Diebstahl-Replay.
*Anmerkung ohne Sicherheitsrelevanz:* Der `nonce` wird erzeugt und mitgesendet, aber nie
geprüft — belanglos, da kein ID-Token ausgewertet wird. Könnte man entfernen.

**Szenario 9 — Info Disclosure:** Keine `console.log`-Ausgabe mit Token, E-Mail oder Secret
gefunden. Fehlermeldungen an den Client sind generische Codes (`storage_error`,
`whop_unreachable`); Details bleiben in `console.error` auf dem Server.

**Szenario 10 — Secret-Exposure:** Kein Secret-Muster (`sk_live`, `apik_`, `whsec_`,
`BLOB_READ_WRITE_TOKEN`, `PRIVATE KEY`) im Frontend-Bundle. Git-History über `-S` auf
`WHOP_CLIENT_SECRET=`, `sk_live`, `apik_` durchsucht: **keine Treffer**. Keine `.env`-Datei
getrackt. Alle jsDelivr-Einbindungen haben SRI-Hashes + `crossorigin`
([app.html:28-30, 240-243](../app.html#L28)). `api/blob-cleanup.js` ist ohne `CRON_SECRET`
deaktiviert statt offen.

---

## Empfohlene Reihenfolge zum Abarbeiten

1. **R3** (Owner-Allowlist auf `user_`-ID) — 3 Einzeiler, kein Risiko, schließt einen echten Bypass.
2. **R2 + R6** (Scope- und Byte-Deckel) — ein gemeinsamer Redis-Zähler-Block, schützt die Rechnung.
3. **R4** (Grant-Deckel + Pubkey-Pflicht) — kleiner Eingriff, stoppt Lizenz-Sharing.
4. **R8** (`username` aus `get_pubkey` raus) — Einzeiler.
5. **R5** (nicht-extrahierbarer CryptoKey) — nur wenn Zeit; Nutzen ist Schadensbegrenzung, kein akutes Loch.
6. **R1, R7, R9, R10** — bewusst nicht fixen (siehe jeweilige Bewertung).
