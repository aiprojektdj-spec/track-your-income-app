# IDOR/BOLA-Reel: Bewertung für Stackr — 2026-10-03

Quelle: Instagram-Reel „Hacking Vibe Coders Part 3" (@kema_the_engineer, 01.08.2026).

## Was das Reel zeigt

1. Im eigenen Dashboard einloggen, F12 öffnen und den Network-Tab beobachten.
2. Ein Request lädt `…/report/742`. Die ID wird einfach in der URL mitgeschickt.
3. Die ID auf `/743` ändern. Man sieht die Daten eines fremden Nutzers.
4. Das Hochzählen übernimmt ein KI-Bot. So kommen 200–300 Nutzer zusammen: Namen, Firmendaten,
   Dokumente, API-Keys.
5. Seine Abhilfe: Autorisierung serverseitig prüfen, rollenbasierte Zugriffe (RBAC) und
   Sicherheitsregeln in der Datenbank (bei Supabase: RLS).

Fachbegriff: **IDOR** (Insecure Direct Object Reference) bzw. **BOLA** (Broken Object Level
Authorization, Platz 1 der OWASP API Top 10). Das „Framework" hinter „Comment SECURITY" ist ein
Lead-Magnet. Neues Wissen steckt darin nicht.

## Ist Stackr dafür anfällig?

**Im Kern kaum.** Die Architektur verhindert das Muster grundsätzlich:

| Angriffsfläche | Stand im Code | Bewertung |
|---|---|---|
| `api/sync.js` pull/push | `userId` kommt aus dem Whop-Token (`/oauth/userinfo`) und nie aus dem Request. Der Key lautet `sync:<userId>:<scope>`. | Eine fremde ID lässt sich nicht einschleusen ✅ |
| `scope` (`co_<id>`) | Wird gegen `SCOPE_RE` geprüft und liegt immer unter dem eigenen `userId`-Präfix | Fremde Firmen-IDs laufen ins Leere ✅ |
| Steuerberater-Zugriff (`body.owner`) | Erfordert `grant:<owner>:<userId>` und ist schreibgeschützt (`push` mit owner → 403) | Das ist der einzige Ort, an dem eine fremde ID angenommen wird. Er ist abgesichert ✅ |
| `api/blob-upload.js` | Der Pfad `stackr/<kind>/<userId>/<scope>/…` wird serverseitig gebaut. `isOwnedBlobUrl` prüft fremde URLs auf den Namespace. | ✅ |
| Gespeicherte Daten | Ende-zu-Ende verschlüsselt (AES-GCM), der Schlüssel bleibt lokal. Blobs liegen nur als Chiffrat vor. | Selbst ein Leck brächte nur Chiffrat ✅ |
| Lokale App-Daten | Offline-first, keine Server-Datenbank pro Datensatz | Keine Angriffsfläche über hochzählbare IDs |

Dazu kommen der Red-Team-Audit (2026-08-10), der Security-Fix vom 2026-09-29 und `test/test-api-sync.js`.

## Restrisiken, die sich zu prüfen lohnen (klein)

1. **Grant-Granularität:** Ein Grant gilt für *alle* Scopes des Owners. Gewollt ist vermutlich,
   dass ein Steuerberater nur eine bestimmte Firma sieht. Das sollte fachlich bestätigt werden.
   Sonst bekommt der Grant ein Feld mit den freigegebenen Scopes.
2. **Public-Blob-URLs:** Sie sind öffentlich abrufbar, durch den Random-Suffix aber nicht
   erratbar und dazu verschlüsselt. Das ist in Ordnung. Wichtig ist nur, dass Blob-URLs nie in
   Logs oder Fehlerberichten (`client-error.js`) landen.
3. **Regressionsschutz:** Bisher gibt es keinen expliziten Test für den Fall „A versucht, Bs
   Daten zu lesen". Nach künftigen Änderungen an `sync.js` sollte das automatisch geprüft werden.

## Empfehlung

**Kein Umbau nötig.** Sinnvoll ist ein kleiner, gezielter Schritt, Aufwand etwa 1–2 h:

- [ ] `test/test-idor-cross-user.js`: Zwei gemockte Whop-User A und B prüfen
  - B macht `pull` mit A-Scope ohne Grant → 403 `no_grant`
  - B macht `push` mit `owner: A` → 403 `readonly`
  - B macht `commit` mit A-Blob-URLs → 403 `not_owner`
  - B macht `delete`/`wipe` → betrifft nur B-Keys
- [ ] Fachlich entscheiden: Grant pro Firma (Scope) oder pro Account?
- [ ] Die IDOR-Checkliste in den Skill `/red-team` aufnehmen, damit jede neue API-Route sie durchläuft.

**Marketing-Winkel (optional):** „Deine Buchhaltung ist Ende-zu-Ende verschlüsselt. Selbst
wir können sie nicht lesen." Das ist genau die Antwort auf die Angst, die das Reel weckt. Ein
möglicher Hook für `stackr-social`: *„Was passiert, wenn jemand bei deiner Buchhaltungs-App
die ID in der URL ändert? Bei uns: nichts."*
