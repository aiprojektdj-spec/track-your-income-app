# R3 schließen: Owner-Bypass an die Whop-User-ID binden

**Aufgabe 2.1 aus [`01-AUFGABEN.md`](01-AUFGABEN.md). Reine Vercel-Konfiguration, kein Code.
Dauer: 10 Minuten plus ein Deployment.**

Diese Datei ist die Langfassung: sie sagt, woher die ID kommt, was genau passiert, wenn sie
falsch ist, und wie der Rückweg aussieht. Wer die Kurzfassung will, nimmt Abschnitt 3.

---

## 1. Worum es geht

Drei Serverless-Endpunkte kennen einen **Owner-Bypass**: eine Identität, die auch ohne
aktives Abo vollen Zugang bekommt. Gedacht ist er für den Company-Owner, der sein eigenes
Produkt nicht bei sich selbst abonniert.

| Endpunkt | Variable für IDs | Variable für Namen (Altweg) | Funktion |
|---|---|---|---|
| [`api/sync.js`](../api/sync.js) (Z. 52–60) | `SYNC_OWNER_IDS` | `SYNC_OWNER_USERNAMES` | `isOwnerIdentity(sub, prefUsername)` |
| [`api/blob-upload.js`](../api/blob-upload.js) (Z. 48–56) | `SYNC_OWNER_IDS` | `SYNC_OWNER_USERNAMES` | `isOwnerIdentity(sub, prefUsername)` |
| [`api/whop-access.js`](../api/whop-access.js) (Z. 51–61) | `WHOP_OWNER_IDS` | `WHOP_OWNER_USERNAMES` | `_isOwner(me)` |

Es sind also **drei Endpunkte, aber nur zwei Variablennamen** — `sync.js` und
`blob-upload.js` teilen sich `SYNC_OWNER_IDS`. Die Entscheidungslogik ist in allen drei
Dateien identisch:

```js
if (OWNER_IDS.length) return !!sub && OWNER_IDS.indexOf(sub) !== -1;   // ID-Modus
return !!prefUsername && OWNERS.indexOf(prefUsername) !== -1;          // Altweg
```

**Der offene Punkt:** Solange die `*_OWNER_IDS` leer sind, greift der Altweg — Vergleich
gegen den bei Whop **frei änderbaren Benutzernamen**, mit dem hart kodierten Default
`'secondlifevintage41'` direkt im Quelltext. Wer sich diesen Benutzernamen bei Whop gibt,
bekommt Owner-Rechte ohne Abo: Pro-Zugang, Cloud-Sync-Push, Blob-Upload.

Entschärft ist der Fund insofern, als der Vergleich nur noch gegen `preferred_username`
läuft (bei Whop eindeutig, muss also erst frei werden) und nicht mehr gegen den beliebig
setzbaren Anzeigenamen `me.name`. Geschlossen ist er damit nicht.

> **Wichtig, weil es in der Kurzfassung missverständlich steht:** Das Löschen von
> `SYNC_OWNER_USERNAMES` / `WHOP_OWNER_USERNAMES` schließt die Lücke **nicht**. Der Default
> `'secondlifevintage41'` steht im Code, nicht in der Variablen — ohne gesetzte Variable
> greift er erst recht. Die Lücke schließt **allein das Setzen der `*_OWNER_IDS`**; das
> Löschen der Namensvariablen ist danach nur noch Aufräumen.

---

## 2. Die eigene Whop-User-ID herausfinden

Gesucht ist der Wert, den Whop unter `https://api.whop.com/oauth/userinfo` im Feld **`sub`**
zurückgibt (`api/whop-access.js:242`, `api/sync.js:245`, `api/blob-upload.js:213`). Er sieht
aus wie `user_XXXXXXXXXXXX`. Der Code prüft das Format **nicht** — verglichen wird per
`indexOf` mit exakt dem String aus der Variablen. Also: **Zeichen für Zeichen übernehmen,
keine Leerzeichen, keine Anführungszeichen, nicht kürzen.**

### Weg A — aus der laufenden App (empfohlen, zwei Klicks)

Die App zeigt diese ID bereits an: sie ist zugleich der Steuerberater-Freigabe-Code.

1. Auf <https://track-your-income-app.vercel.app/app.html> als Owner anmelden.
2. Oben rechts auf das **Konto-Widget** klicken (Name/E-Mail).
3. Im Menü **„🔑 Mein Freigabe-Code"** wählen
   ([`js/whop-auth.js:710`](../js/whop-auth.js) → [`js/stb-share.js:239`](../js/stb-share.js)).
4. Der Dialog zeigt die ID in Monospace, darunter **„📋 Code kopieren"**.

Der angezeigte Wert ist `whop_user.id`, und der wird beim Login als `me.sub` gesetzt
([`js/whop-auth.js:334`](../js/whop-auth.js): `me.id = me.sub;`) — also exakt der Wert, den
die Endpunkte vergleichen. Der Fingerabdruck darunter gehört zum StB-Schlüssel und ist hier
irrelevant.

### Weg B — aus dem Browser-Speicher (funktioniert auch ohne App-Zugang)

1. Auf der angemeldeten Stackr-Seite **F12** → Reiter **Konsole**.
2. Eingeben:
   ```js
   JSON.parse(localStorage.getItem('whop_user')).id
   ```
3. Ausgabe ist die ID in Anführungszeichen — die Anführungszeichen gehören **nicht** in die
   Vercel-Variable.

Unter `whop_user` liegen bewusst nur zwei Felder (`id`, `username`), siehe den Kommentar in
[`js/whop-auth.js:336-342`](../js/whop-auth.js). Der Schlüssel heißt genau `whop_user`, der
Token separat unter `whop_access_token` — der wird hier nicht gebraucht und sollte auch
nirgends hineinkopiert werden.

### Weg C — aus dem Whop-Dashboard

<https://whop.com> → eingeloggt → **Settings → Account**. Dort steht die User-ID; sie
beginnt mit `user_`. **Nicht** den Benutzernamen (`@name`) nehmen — genau dessen
Änderbarkeit ist ja das Problem.

*Vorbehalt:* Dieser Klickpfad steht so in der Aufgabenliste, ist aber Whops Oberfläche und
kann sich ändern. Wege A und B sind gegen den Code verifiziert und liefern garantiert
denselben Wert, den die Endpunkte vergleichen. Bei Abweichung gilt A/B.

### Gegenprobe

Weg A und Weg B müssen denselben String liefern. Tun sie das, ist die ID sicher richtig
abgeschrieben — dann kann beim Setzen nur noch ein Tippfehler passieren, und den fängt
Abschnitt 5 ab.

---

## 3. In Vercel setzen

Projekt **`track-your-income-app`** → **Settings → Environment Variables** → zweimal
*Add New*:

| Name | Wert |
|---|---|
| `SYNC_OWNER_IDS` | `user_…` |
| `WHOP_OWNER_IDS` | `user_…` |

Mehrere Owner: **kommagetrennt**. Leerzeichen um die Kommas sind erlaubt (der Code macht
`.split(',').map(trim)`), aber lass sie trotzdem weg.

**Beide Variablen mit demselben Wert setzen.** Wird nur eine gesetzt, entsteht ein
halboffener Zustand: mit nur `WHOP_OWNER_IDS` kommt der Owner ins Gate, aber Cloud-Sync und
Blob-Upload antworten `403 pro_required`; mit nur `SYNC_OWNER_IDS` ist es umgekehrt — und
die Lücke bleibt auf dem jeweils anderen Endpunkt offen.

### Welche Environments?

| Environment | Nötig? | Warum |
|---|---|---|
| **Production** | **Ja, zwingend** | Das ist die Live-App unter `track-your-income-app.vercel.app`. Nur hier ist die Lücke real ausnutzbar. |
| **Preview** | **Ja, empfohlen** | Preview-Deployments laufen mit demselben Code und denselben Whop-Produkt-IDs gegen dieselbe Whop-API. Ohne die Variablen gilt dort weiter der Namensweg — die Lücke bliebe auf jeder Preview-URL offen. Kostet nichts, gleicher Wert. |
| **Development** | Nein | Greift nur bei lokalem `vercel dev`. Wird in diesem Projekt nicht benutzt (Browser-Tests laufen über `python -m http.server` auf statischen Dateien, ohne Serverless-Runtime). Wer es doch mal braucht, setzt es dann. |

Vercel erlaubt beim Anlegen das Ankreuzen mehrerer Environments auf einmal — Production und
Preview zusammen anhaken, fertig.

---

## 4. Redeploy — ohne den passiert nichts

Alle drei Dateien lesen `process.env` **beim Laden des Moduls**, nicht pro Request:

```js
var OWNER_IDS = (process.env.SYNC_OWNER_IDS || '').split(',')…   // Top-Level, außerhalb des Handlers
```

Vercel bindet Environment-Variablen an ein Deployment. Ein bereits laufendes Deployment
sieht die neuen Werte **nie**, egal wie lange man wartet. Deshalb:

**Vercel → Deployments → oberster Eintrag (Production) → „⋯" → Redeploy → bestätigen.**

Kein neuer Commit nötig; das Projekt hat ohnehin keinen Build-Schritt. Der Haken „Use
existing Build Cache" darf gesetzt bleiben — die Variablen werden unabhängig davon neu
eingespielt. Warten, bis der Status *Ready* ist (üblicherweise unter einer Minute).

Wer stattdessen ohnehin gerade pusht: auch dann greift es erst mit dem Deployment, das
**nach** dem Setzen der Variablen startet.

---

## 5. Verifikation: hat es gewirkt?

Nach dem *Ready*-Status:

1. **App neu laden** (`track-your-income-app.vercel.app/app.html`), notfalls hartes Reload.
2. **Kommt das Dashboard?** Dann hat der Owner-Check gegriffen — oder das eigene Abo. Um
   beides zu trennen, siehe Punkt 3.
3. **Cloud-Sync einmal auslösen** (Sync-Punkt im Kopfbereich / Einstellungen → Cloud-Sync →
   „Jetzt synchronisieren"). Läuft der Push durch, hat `SYNC_OWNER_IDS` gegriffen oder ein
   gültiges Abo — `api/sync.js` lässt sonst nichts schreiben.
4. **Sauberster Nachweis** (F12 → Reiter **Netzwerk**, dann Seite neu laden): den Request
   auf `/api/whop-access` anklicken, Antwort ansehen. Steht dort

   ```json
   { "has_access": true, "user_id": "user_…", "owner": true, … }
   ```

   dann kam der Zugang **über den Owner-Bypass** — das Feld `owner: true` setzt
   [`api/whop-access.js:249`](../api/whop-access.js) ausschließlich im Owner-Zweig. Fehlt
   `owner`, kam der Zugang über das Abo; dann ist entweder die ID falsch, oder der Redeploy
   fehlt.

5. **Optional, lokal und ohne Login** — die Entscheidungslogik selbst ist getestet:
   ```bash
   node test/test-owner-identity.js
   ```
   Der Test schneidet die drei Funktionen aus den Dateien und prüft beide Modi (5/5). Er
   sagt nichts über die in Vercel gesetzten Werte, aber er belegt: sobald IDs gesetzt sind,
   verliert der Owner-Name jede Wirkung.

### Wenn die ID falsch ist

Dann ist der Owner ab sofort ein ganz normaler Nutzer:

- `api/whop-access.js` überspringt den Owner-Zweig und prüft regulär
  `/api/v2/me/has_access` plus ggf. Company-Scan (`_checkAccess`, Z. 184–197).
- `api/sync.js:272` und `api/blob-upload.js:221`: `isOwner === false` → normaler
  Pro-Check → ohne Abo **`403 pro_required`**.

**Praktisch heißt das:**

| Situation | Folge |
|---|---|
| Owner hat ein **eigenes aktives Abo** (auch Trial) | Nichts passiert. Der Zugang kommt über die Membership, die falsche ID fällt nicht einmal auf. Nur `owner: true` fehlt in der Antwort. |
| Owner hat **kein eigenes Abo** | **Aussperrung.** Die App zeigt den „Stackr Pro aktivieren"-Bildschirm ([`js/whop-auth.js:581`](../js/whop-auth.js)), Cloud-Sync und Blob-Upload antworten 403. |

Genau das ist die Stelle, an der so eine Umstellung schiefgeht: Wenn der Owner **kein
eigenes Abo hat** — und das ist bei einem Company-Owner der Normalfall, deshalb existiert
der Bypass überhaupt —, dann ist ein Tippfehler in der ID gleichbedeutend mit einer
Aussperrung aus der eigenen App. Vor dem Setzen also klären: *Habe ich eine aktive
Membership auf meinen eigenen Account?*

**Was dabei NICHT passiert** — das ist die Entwarnung:

- **Keine Daten gehen verloren.** Die Buchhaltung liegt local-first im Browser
  (`localStorage`/IndexedDB). Der Sperrbildschirm ist ein Overlay, kein Löschvorgang.
- **Das in der Cloud liegende Chiffrat bleibt liegen.** 403 heißt „nicht schreiben/lesen",
  nicht „löschen".
- **Der Login bleibt bestehen.** Token und `whop_user` werden nur bei echtem 401/403 von
  Whop selbst verworfen, nicht bei fehlendem Abo.
- **Bis zu vier Stunden Puffer:** Wer vorher mit gültigem Zugang drin war, hat ein
  signiertes Grace-Token (`GRACE_MS = 4h`, `api/whop-access.js:69`). Das greift allerdings
  nur bei *Server-/Netzfehlern* (502/429), nicht bei einem sauberen `has_access: false`.
  Verlass dich nicht darauf.

---

## 6. Rückweg, falls doch ausgesperrt

Es gibt keinen Zustand, aus dem man nicht in zwei Minuten wieder herauskommt — die
Zugangsdaten sind unberührt, nur eine Textvariable ist falsch.

1. **Die richtige ID nachschlagen.** Auch der Sperrbildschirm zeigt sie: unten steht
   „Bist du Steuerberater? Gib deinem Mandanten diesen Freigabe-Code…" — der dort angezeigte
   Wert **ist** die eigene `user_…`-ID ([`js/whop-auth.js:634`](../js/whop-auth.js)), mit
   Kopier-Button. Man kommt also selbst im ausgesperrten Zustand an den korrekten Wert.
   Alternativ Weg B aus Abschnitt 2.
2. **Variable korrigieren** (Vercel → Settings → Environment Variables → Edit) und
   **erneut redeployen**. Das ist der normale Fix.
3. **Notbremse**, wenn es schnell gehen muss: `SYNC_OWNER_IDS` und `WHOP_OWNER_IDS`
   **löschen** (oder auf leer setzen) und redeployen. Damit fällt der Code auf den Altweg
   zurück, und der greift auch ohne gesetzte Namensvariable, weil `'secondlifevintage41'`
   als Default im Quelltext steht. Zugang ist sofort wieder da — **aber die Lücke ist damit
   wieder offen.** Nur als Zwischenschritt benutzen, nicht als Endzustand.
4. **Nicht nötig und nicht empfohlen:** die alten `*_OWNER_USERNAMES` neu anlegen. Sie
   ändern nichts, was der hart kodierte Default nicht ohnehin tut.

---

## 7. Aufräumen: die Namensvariablen löschen

**Erst nachdem Abschnitt 5 bestanden ist** — also nachdem `owner: true` in der Antwort steht
oder der Sync nachweislich läuft:

Vercel → Settings → Environment Variables → `SYNC_OWNER_USERNAMES` und
`WHOP_OWNER_USERNAMES` löschen, **falls überhaupt angelegt**. Danach erneut redeployen (oder
mit dem nächsten ohnehin anstehenden Deployment mitnehmen).

**Reihenfolge und ihr wahrer Grund.** Die verbreitete Begründung „erst IDs, dann Namen
löschen, sonst sperrst du dich aus" trifft hier nicht zu: Weil `'secondlifevintage41'` als
Default im Code steht, ändert das Löschen der Variablen für sich genommen gar nichts — weder
in die eine noch in die andere Richtung. Die Reihenfolge **IDs setzen → verifizieren →
Namen löschen** ist trotzdem richtig, aber aus einem anderen Grund: sie hält die Zahl der
gleichzeitig veränderten Dinge klein. Geht nach dem ersten Schritt etwas schief, weiß man
sicher, dass es die ID war.

Der reale Nutzen des Löschens ist Hygiene: keine irreführende Variable, die aussieht, als
würde sie noch etwas steuern, obwohl die IDs Vorrang haben.

---

## 8. Was danach noch offen bleibt

Kein Handlungsbedarf jetzt, aber festhalten — beides ist Code, nicht Konfiguration, und
wurde bewusst nicht angefasst:

1. **Der hart kodierte Default lebt weiter.** `'secondlifevintage41'` steht in allen drei
   Dateien (`api/sync.js:54`, `api/blob-upload.js:50`, `api/whop-access.js:53`). Wer
   irgendwann die `*_OWNER_IDS` löscht — beim Aufräumen, bei einem Projektumzug, beim
   Anlegen eines neuen Vercel-Projekts —, reaktiviert damit **still** den Namensweg. Die
   Lücke wäre zurück, ohne dass jemand etwas „kaputt gemacht" hätte. Sauber wäre: Default
   auf leer, und ohne gesetzte Owner-Variable schlicht keinen Bypass.
2. **[`CLOUD-SYNC.md:29`](../CLOUD-SYNC.md) dokumentiert nur `SYNC_OWNER_USERNAMES`**, nicht
   `SYNC_OWNER_IDS`. Wer nach dieser Datei ein neues Deployment aufsetzt, landet
   zwangsläufig wieder im Altweg.

---

*Erstellt 2026-08-24. Grundlage: Code-Stand `cb95d40`, Prüfung direkt gegen `api/sync.js`,
`api/blob-upload.js`, `api/whop-access.js`, `js/whop-auth.js`, `js/stb-share.js` und
`test/test-owner-identity.js`.*
