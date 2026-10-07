# Rechtstexte für den Supabase-Umzug — ENTWURF

Stand: 2026-10-07, gegen den Code auf `master` (`c41a0a8`) geprüft.
Gehört zu Schritt 9 in [`supabase-umzug-2026-10-06.md`](supabase-umzug-2026-10-06.md).

> **Nur Entwurf.** Keine Live-Datei ist geändert. Eingebaut wird erst nach Freigabe durch den
> User und erst **beim** Umschalten (`STORAGE_MIRROR=supabase` bzw. `STORAGE_BACKEND=supabase`),
> nicht vorher — vorher wäre die DSE falsch.

## 0. Was der Code tatsächlich tut (Grundlage der Texte)

| Datum | Wo bei Supabase | Personenbezug | Dauer laut Code | Quelle |
|---|---|---|---|---|
| Sync-Chiffrat + Metadaten (Version, Zeitstempel, Geräte-Kennung) | `sync_snapshots`, `sync_scopes` | Whop-`user_id` als Schlüssel, Inhalt unlesbar | bis Löschung durch den Nutzer | `20261006000001_sync.sql`, `api/_sync-store.js` |
| Prüfliste („Anker“: Hash, Kennung, Zeitstempel) | `sync_anchors` | Whop-`user_id` | bleibt nach Löschung (DSE 6.1) | dto. |
| Public Key, Freigaben (Steuerberater) | `public_keys`, `grants` | Whop-`user_id` beider Seiten | bis Widerruf/Löschung | dto. |
| Rate-Limit-Zähler | `rate_limits` | **IP-Adresse im Schlüssel** (`whoptoken:rl:<ip>`, `whopaccess:iprl:<ip>`, `clerr:iprl:<ip>`, `sync:iprl:*`) bzw. `user_id` | Fenster 60 s, **Zeile wird aber erst gelöscht, wenn sie > 1 h abgelaufen ist und ein Zufallsaufruf (1 %) aufräumt** | `sync_rate_hit()` |
| Browser-Fehlerzähler | `client_error_counts`, `client_error_types` | keiner (bereinigt, keine IP, keine `user_id`) | 30 Tage, **ebenfalls nur per 1-%-Aufräumlauf** | `20261007000001_client_errors.sql`, `api/_client-errors.js` |
| Belege/Anhänge + übergroße Sync-Chiffrate | Storage-Bucket `attachments`, **privat** | Chiffrat; Pfad enthält Nutzer-Bezug | bis Löschung; signierte URL gilt 300 s | `api/_storage.js`, `20261006000002_storage.sql` |
| Abruf der Belege | Browser → `https://usrhhjwvoefjdgrwovkg.supabase.co` direkt | **IP-Adresse des Nutzers erreicht Supabase** | — | `vercel.json` `connect-src`, `api/_storage.js` `sign()` |

Bleibt vorerst bei **Upstash** (unabhängig vom Sync-Umzug, laut Umzugsplan noch offen):
Whop-Refresh-Sitzungen `whoprt:<sid>` (30 Tage TTL, `api/whop-token.js:101`, `api/whop-refresh.js`),
Rate-Limit/Sperre in `whop-refresh.js` und das Byte-Budget/Commit-Sperre in `blob-upload.js`.
Bleibt bei **Vercel Blob**: das Alarm-Log aus `api/_alert.js`.
→ Upstash und Vercel Blob dürfen erst aus den Texten verschwinden, wenn auch diese Zeilen umgezogen sind.

### Abweichungen vom Auftrag (bitte prüfen)

1. **„IP 60 s“ stimmt bei Supabase nicht.** In Redis verfällt der Schlüssel nach 60 s per `EXPIRE`.
   In Supabase bleibt die Zeile mit der IP stehen, bis `reset_at < now() - 1 h` **und** ein zufälliger
   Aufruf (1 %) aufräumt — bei wenig Verkehr können das Stunden oder Tage sein. Entweder Text
   anpassen („in der Regel innerhalb weniger Stunden“) oder Code ändern (z. B. Aufräumen per Cron
   in `blob-cleanup.js`, oder IP gehasht speichern). → **Frage F6.**
2. **Fehlerzähler „30 Tage“** gilt bei Supabase ebenso nur über den 1-%-Aufräumlauf. Kein
   Personenbezug, daher weniger kritisch, aber der Text sollte nicht „nach genau 30 Tagen“ sagen.
3. **Kein Client sendet heute an `/api/client-error`** (grep über `js/` und `*.html`: kein Treffer).
   DSE Ziffer 3 sagt richtig, dass das Fehlerprotokoll das Gerät nicht automatisch verlässt.
   Ein DSE-Absatz zum Fehlerzähler ist erst nötig, wenn ein Sender eingebaut wird. → **Frage F7.**

### Bereits heute bestehende Lücken (nicht durch den Umzug entstanden)

- **Vercel Blob wird in keiner Rechtstext-Datei genannt**, obwohl Belege/Anhänge seit Monaten dort
  liegen — und zwar unter **öffentlichen** (wenn auch unratbaren) URLs (`access: 'public'`,
  `api/_storage.js:79`). Der Entwurf unten nennt den Beleg-Speicher deshalb ausdrücklich.
- **Login-Rate-Limit mit IP** (`whop-token`, `whop-access`, `whop-refresh`) steht in der DSE nur
  im Abschnitt 4.3 (Steuerberater), gilt aber für jeden Login, auch ohne Cloud-Sync.
- **Whop-Refresh-Sitzung bei Upstash** (Refresh-Token, 30 Tage) steht in keiner DSE-Ziffer.

Diese drei Punkte sind im Entwurf mit „(Lücke)“ markiert; ob sie mit diesem Umzug gleich
mit geschlossen werden, entscheidet der User (→ **F8**).

---

## 1. Fundstellen, alter Text, neuer Text

Zeilen beziehen sich auf `c41a0a8`. Bei Drift über den zitierten Text suchen, nicht über die Zahl.
Je Fundstelle: **Ü** = Übergangsphase (Upstash und Supabase parallel, Spiegel), **E** = Endstand
(Upstash abgeschaltet).

### 1.1 `datenschutz.html:208-213` — Ziffer 4.1, „Wo gespeichert wird“

**Alt:**
> **Wo gespeichert wird:** Die verschlüsselten Daten werden bei **Upstash** (Upstash, Inc.) in der
> Region **Frankfurt am Main (EU, eu-central-1)** abgelegt. Der Transport erfolgt ausschließlich über
> eine von uns betriebene, abgesicherte Serverless-Funktion (Vercel) auf track-your-income-app.vercel.app.

**Neu (Ü):**
> **Wo gespeichert wird:** Die verschlüsselten Daten werden in der Region **Frankfurt am Main
> (EU, eu-central-1)** gespeichert. Wir ziehen den Speicher derzeit von **Upstash** (Upstash, Inc.)
> zu **Supabase** (Supabase, Inc.) um; während des Umzugs liegt dasselbe Chiffrat bei beiden
> Anbietern, jeweils in Frankfurt. Nach Abschluss des Umzugs werden die Daten bei Upstash gelöscht.
> Verschlüsselte Belege und Anhänge, die du mit einer Buchung verknüpfst, liegen [bis zum Umzug bei
> **Vercel Blob** (Vercel Inc.) / ab dem Umzug in einem nicht öffentlichen Speicherbereich bei
> Supabase in Frankfurt]; dein Browser ruft sie über kurzlebige, signierte Links (gültig 5 Minuten)
> direkt dort ab, wobei deine IP-Adresse an Supabase übermittelt wird. Der übrige Transport erfolgt
> ausschließlich über eine von uns betriebene, abgesicherte Serverless-Funktion (Vercel) auf
> track-your-income-app.vercel.app.

**Neu (E):**
> **Wo gespeichert wird:** Die verschlüsselten Daten werden bei **Supabase** (Supabase, Inc.) in
> der Region **Frankfurt am Main (EU, eu-central-1)** gespeichert. Verschlüsselte Belege und
> Anhänge liegen dort in einem nicht öffentlichen Speicherbereich; dein Browser ruft sie über
> kurzlebige, signierte Links (gültig 5 Minuten) direkt bei Supabase ab, wobei deine IP-Adresse an
> Supabase übermittelt wird. Supabase kennt von dir nur deine Whop-Nutzerkennung, nicht deinen
> Namen oder deine E-Mail-Adresse. Der übrige Transport erfolgt ausschließlich über eine von uns
> betriebene, abgesicherte Serverless-Funktion (Vercel) auf track-your-income-app.vercel.app.

**Begründung:** Anbieterwechsel; Belege-Speicher war bisher gar nicht genannt (Lücke); der direkte
Abruf aus dem Browser (`connect-src` auf `*.supabase.co`) ist eine eigene Übermittlung der IP an
Supabase und muss genannt werden. Die eckige Klammer in Ü hängt davon ab, ob `BLOB_BACKEND` gleichzeitig
mit `STORAGE_BACKEND` umgeschaltet wird (→ **F5**).

### 1.2 `datenschutz.html:241-249` — Ziffer 4.3, IP-Rate-Limit

**Alt (Ausschnitt):**
> … deine IP-Adresse kurzzeitig (Rate-Limit-Zähler, 60 Sekunden) serverseitig bei Upstash verarbeitet.

**Neu (Ü):**
> … deine IP-Adresse kurzzeitig (Rate-Limit-Zähler, Zählfenster 60 Sekunden) serverseitig bei
> Upstash bzw. — nach dem Umzug — bei Supabase (jeweils Frankfurt) verarbeitet.

**Neu (E):**
> … deine IP-Adresse kurzzeitig (Rate-Limit-Zähler, Zählfenster 60 Sekunden; der Eintrag wird
> danach automatisch gelöscht, in der Regel innerhalb weniger Stunden) serverseitig bei Supabase
> (Frankfurt) verarbeitet.

**Begründung:** Anbieterwechsel. Die Löschfrist ist bewusst nicht mehr „60 Sekunden“, weil der
Supabase-Code die Zeile nicht nach 60 s löscht (Abschnitt 0, Abweichung 1). Formulierung hängt an **F6**.

**(Lücke) Zusatzabsatz, neu, z. B. als Ziffer 5 nach dem ersten Absatz oder als eigene Ziffer 4.5:**
> **Schutz vor Missbrauch beim Login.** Bei jeder Anmeldung und jeder Zugangsprüfung verarbeiten
> wir deine IP-Adresse in einem Zähler, der Anfragen pro Minute begrenzt (Login höchstens 8, Zugangs-
> und Sitzungsprüfung höchstens 30 pro Minute). Der Zähler liegt bei [Upstash / Supabase] in
> Frankfurt und wird nach Ablauf automatisch gelöscht. Damit du nicht stündlich neu anmelden musst,
> legen wir außerdem eine Sitzungskennung mit dem Whop-Erneuerungstoken für höchstens 30 Tage bei
> Upstash (Frankfurt) ab. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Missbrauchsschutz) bzw.
> lit. b (Bereitstellung des Logins).

Werte aus `api/whop-token.js:14` (8/min), `api/whop-access.js:96` (30/min), `api/whop-refresh.js:35`
(30/min), TTL 30 Tage `api/whop-token.js:105`.

### 1.3 `datenschutz.html:166-169` — Ziffer 3, lokales Fehlerprotokoll

**Keine Änderung**, solange kein Client an `/api/client-error` sendet (Abschnitt 0, Abweichung 3).

**Vorbereitet, falls ein Sender kommt (→ F7):**
> Daneben meldet die App technische Fehler automatisch in bereinigter Form an unseren Server:
> Fehlerart, Meldung (E-Mail-Adressen und Ziffernfolgen ab 4 Stellen werden vorher entfernt),
> Quelldatei, Zeile, App-Version und Zeitpunkt — ohne IP-Adresse, ohne Nutzerkennung, ohne
> Buchhaltungsdaten. Gespeichert wird nur ein Zähler je Tag und Fehlerart bei Supabase in
> Frankfurt; die Einträge werden nach etwa 30 Tagen automatisch gelöscht. Deine IP-Adresse dient
> dabei nur einem kurzlebigen Zähler gegen Missbrauch (wie in Ziffer 4.3). Rechtsgrundlage:
> Art. 6 Abs. 1 lit. f DSGVO (Fehlerbehebung, Betriebssicherheit).

Und der Satz „Diese Einträge verlassen dein Gerät nicht automatisch …“ müsste dann auf das
**vollständige** lokale Protokoll (mit Browser-Kennung, Stack) eingeschränkt werden.

### 1.4 `datenschutz.html:366-375` — Ziffer 7, Auftragsverarbeitung

**Alt:**
> **Bei aktiviertem Cloud-Sync (Ziffer 4)** tritt **Upstash, Inc.** hinsichtlich der Speicherung der
> verschlüsselten Daten als **Auftragsverarbeiter** nach Art. 28 DSGVO auf; Gleiches gilt für
> **Vercel Inc.** bezüglich des Betriebs der Transport-Funktion. Die Speicherung erfolgt in der EU
> (Frankfurt). Mit beiden Anbietern ist der Abschluss eines Auftragsverarbeitungsvertrags (Data
> Processing Agreement) vorgesehen bzw. wird über die jeweiligen Standard-AVV der Anbieter abgedeckt.
> Da beide Anbieter US-Gesellschaften sind, kann ein Drittlandbezug bestehen; als Transfermechanismus
> dienen die EU-Standardvertragsklauseln (Art. 46 DSGVO) bzw. das EU-US Data Privacy Framework. Da
> ausschließlich Ende-zu-Ende-verschlüsseltes, für die Anbieter unlesbares Chiffrat übertragen wird,
> ist das Risiko entsprechend minimiert.

**Neu (Ü):**
> **Bei aktiviertem Cloud-Sync (Ziffer 4)** sind folgende Anbieter als **Auftragsverarbeiter** nach
> Art. 28 DSGVO für uns tätig:
> - **Supabase, Inc.** — Speicherung der verschlüsselten Daten, Belege und Anhänge, Prüfliste,
>   Freigaben sowie der Missbrauchszähler; Region Frankfurt (EU).
> - **Upstash, Inc.** — bisheriger Speicher; während des Umzugs parallel mit demselben Chiffrat
>   befüllt, Region Frankfurt (EU). [Nach Abschluss des Umzugs werden die Daten dort gelöscht.]
> - **Vercel Inc.** — Betrieb der Website und der Transport-Funktion[, bis zum Umzug außerdem
>   Speicherung der verschlüsselten Belege (Vercel Blob)].
>
> Mit allen Anbietern besteht ein Auftragsverarbeitungsvertrag (Data Processing Agreement)
> [**F1/F2: Formulierung erst nach Bestätigung, dass die DPAs abgeschlossen sind**]. Da alle drei
> US-Gesellschaften sind, ist ein Zugriff aus einem Drittland nicht ausgeschlossen, auch wenn die
> Daten in Frankfurt liegen; als Transfermechanismus dienen [**F3**: EU-US Data Privacy Framework
> und/oder EU-Standardvertragsklauseln nach Art. 46 DSGVO]. Da ausschließlich
> Ende-zu-Ende-verschlüsseltes, für die Anbieter unlesbares Chiffrat gespeichert wird, ist das
> Risiko entsprechend minimiert.

**Neu (E):** wie Ü ohne den Upstash-Punkt und ohne den Vercel-Blob-Zusatz — **aber erst, wenn auch
die Whop-Refresh-Sitzungen umgezogen sind** (Abschnitt 0). Bis dahin bleibt Upstash mit dem Zweck
„Login-Sitzungen und Missbrauchszähler“ stehen.

**Begründung:** Anbieterwechsel; „vorgesehen bzw. wird abgedeckt“ ist für eine DSE zu vage, sollte
eine Tatsachenaussage werden — aber nur, wenn sie stimmt (F1). Liste statt Fließtext, weil drei
Anbieter mit unterschiedlichem Zweck.

### 1.5 `cookies.html:188-190` — IndexedDB-Absatz

**Alt:**
> … In diesem Fall wird ausschließlich unlesbares Chiffrat bei Upstash (Frankfurt, EU) abgelegt; …

**Neu (Ü):** … bei Upstash bzw. Supabase (jeweils Frankfurt, EU) abgelegt; …
**Neu (E):** … bei Supabase (Frankfurt, EU) abgelegt; …

**Begründung:** Anbieterwechsel.

### 1.6 `cookies.html:265-266` — „keine Verbindung zu Dritt-Servern“

**Alt:**
> … außer den an anderer Stelle genannten (Whop für Anmeldung und Zahlung, Vercel als Hoster und
> für die Reichweitenmessung).

**Neu (Ü und E):**
> … außer den an anderer Stelle genannten (Whop für Anmeldung und Zahlung, Vercel als Hoster und
> für die Reichweitenmessung, bei aktiviertem Cloud-Sync Supabase für den Abruf verschlüsselter
> Belege).

**Begründung:** Seit `fb44856` darf der Browser `usrhhjwvoefjdgrwovkg.supabase.co` direkt ansprechen
(signierte Beleg-URLs). Heute fehlt hier auch Vercel Blob (`*.public.blob.vercel-storage.com`) —
(Lücke); in Ü ggf. „Vercel Blob bzw. Supabase“.

### 1.7 `agb.html:219-221` — Cloud-Sync-Absatz

**Alt:** „… bei einem Auftragsverarbeiter in der EU (Frankfurt) gespeichert; …“

**Neu:** **keine Änderung nötig.** Der Text nennt keinen Anbieter und bleibt in Ü und E wahr.
Optional „Auftragsverarbeiter“ → „Auftragsverarbeitern“, weil in Ü zwei Anbieter parallel speichern.

### 1.8 `index.html:725` und `index.html:901` — FAQ „Wo werden meine Daten gespeichert?“ (sichtbar + JSON-LD)

**Alt:** „… bei einem EU-Anbieter (Frankfurt) abgelegt …“ bzw. „(EU, Frankfurt)“

**Neu:** **keine Änderung nötig** — anbieterneutral, in Ü und E wahr. Aber: „EU-Anbieter“ ist
streng genommen ungenau — Upstash und Supabase sind US-Gesellschaften mit Speicher in der EU.
Vorschlag für beide Stellen (sichtbarer Text und JSON-LD identisch halten):
> … bei einem Speicheranbieter in der EU (Frankfurt) abgelegt …

### 1.9 `landing-v2.html:116`, `:282`, `:348` — „Server in der EU“ / „EU-Server“

**Keine Änderung nötig**, anbieterneutral und in Ü/E wahr. Die Seite wird ausgeliefert
(eigene Route in `vercel.json:69`).

### 1.10 `verfahrensdokumentation.html:42-43`

**Alt:**
> … der Server (Vercel Serverless + Upstash Redis, EU/Frankfurt) kann die Buchungsdaten zu keinem
> Zeitpunkt einsehen.

**Neu (Ü):** … der Server (Vercel Serverless; Speicher bei Upstash Redis und Supabase, beide
EU/Frankfurt, während eines Anbieterwechsels parallel) …
**Neu (E):** … der Server (Vercel Serverless + Supabase Postgres/Storage, EU/Frankfurt) …

Dazu `Stand: Juli 2026` (Zeile 25) auf den Umschaltmonat setzen.

**Begründung:** Die Verfahrensdokumentation (GoBD) muss das eingesetzte System benennen; ein
Speicherwechsel ist eine dokumentationspflichtige Änderung. → **F9** (Änderungshistorie?).

### 1.11 `js/cloud-sync.js:1038` — Aktivierungsdialog (Nutzer sieht das vor dem Opt-in!)

**Alt:** `'Aufbewahrung beim Auftragsverarbeiter <strong>Upstash (Frankfurt, EU)</strong>.'`

**Neu (Ü):** `'Aufbewahrung bei unseren Auftragsverarbeitern <strong>Upstash und Supabase (Frankfurt, EU)</strong>.'`
**Neu (E):** `'Aufbewahrung beim Auftragsverarbeiter <strong>Supabase (Frankfurt, EU)</strong>.'`

**Begründung:** Das ist der Text, auf den sich die Einwilligung (Art. 6 Abs. 1 lit. a, DSE 4.1)
stützt — er muss zur DSE passen. Code-Änderung, daher mit Commit im JS, nicht nur in HTML.

### 1.12 `CLOUD-SYNC.md` — technische Doku (kein Rechtstext, aber vom Auftrag genannt)

| Zeile | Alt | Neu (E) |
|---|---|---|
| 11 | **Store:** Upstash Redis (REST), Region eu-central-1 / Frankfurt | **Store:** Supabase Postgres (`stackr-prod`, eu-central-1 / Frankfurt) über PostgREST, Funktionen aus `supabase/migrations/`; Adapter `api/_sync-store.js` |
| 9 | CAS per Lua-`EVAL` | CAS per Postgres-Funktion (`sync_*`, nur `service_role`) |
| 12 | Keys `sync:<userId>:<scope>`, Rate-Limit `sync:rl:<userId>` | Tabellen `sync_snapshots`/`sync_scopes`/…, Rate-Limit `rate_limits` |
| 20-45 | Abschnitt „Vercel-ENV“ (Upstash-Integration, `KV_REST_API_*`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Sensitive, getrennt Prod/Preview), `STORAGE_BACKEND`, `STORAGE_MIRROR`, `BLOB_BACKEND`; Upstash-Teil als „Altweg, bis Refresh-Sitzungen umgezogen sind“ |
| 77, 83, 101 | „in Upstash ansehen“ | „im Supabase-Table-Editor `sync_snapshots` ansehen“ |

Für Ü: einen Absatz oben ergänzen statt umschreiben:
> **Umzug läuft (seit <Datum>):** Primär `STORAGE_BACKEND=<…>`, Spiegel `STORAGE_MIRROR=<…>`.
> Ablauf und Rückweg: `plan/supabase-umzug-2026-10-06.md`.

### 1.13 Code-Kommentare (nicht nutzer-sichtbar, nur Hinweis)

`js/cloud-sync.js:8`, `:19`, `:439-440` nennen Upstash. Kein Rechtstext; beim Endstand mitziehen.

### 1.14 Stand-Datum

`datenschutz.html:25` und `cookies.html:29` stehen auf „Juni 2026“. Bei jeder der obigen Änderungen
auf den Monat des Einbaus setzen.

---

## 2. Verarbeitungsverzeichnis (Art. 30 DSGVO)

**Im Repo gibt es keins** (grep nach „Verarbeitungsverzeichnis“/„VVT“: nur der Umzugsplan). Falls
es außerhalb des Repos liegt, bitte zuschicken. Sonst hier der Entwurf der betroffenen Einträge
zum Übernehmen:

| Tätigkeit | Zweck | Betroffene / Daten | Empfänger (AV) | Drittland | Löschfrist | TOM (Kurz) |
|---|---|---|---|---|---|---|
| Cloud-Sync | Geräteübergreifender Sync | Pro-Nutzer: Whop-`user_id`, Chiffrat, Version, Zeitstempel, Geräte-Kennung | Supabase (Ü: + Upstash), Vercel | USA möglich (Mutterges.), → F3 | auf Löschung durch Nutzer; Anker bleiben (GoBD) | E2E AES-GCM, Schlüssel nur beim Nutzer; RLS, nur `service_role`; Region Frankfurt |
| Belege/Anhänge | Ablage verknüpfter Belege | Pro-Nutzer: Chiffrat, Pfad mit Nutzerbezug; IP beim Abruf | Supabase (Ü: Vercel Blob) | dto. | auf Löschung; verwaiste Chunks per Cron | privater Bucket, signierte URL 300 s |
| Steuerberater-Freigabe | Lesezugriff Dritter | Public Keys, Grants | Supabase (Ü: + Upstash) | dto. | bis Widerruf | Grant-Deckel atomar in Postgres |
| Missbrauchsschutz | Rate-Limit | IP-Adresse, `user_id` | Supabase bzw. Upstash | dto. | Fenster 60 s, Löschung → F6 | kein Inhalt, nur Zähler |
| Login-Sitzung | Token-Erneuerung | Sitzungs-ID, Whop-Refresh-Token | Upstash | dto. | 30 Tage | serverseitig, nie im Browser |
| Fehlerzähler (→ F7) | Fehlerbehebung | keine personenbezogenen Daten (bereinigt) | Supabase bzw. Upstash | — | ca. 30 Tage | Bereinigung vor Speicherung |

---

## 3. Fragen an den User (nicht geraten — vor dem Einbau beantworten)

**F1 — AV-Vertrag Supabase.** Ist der Supabase-DPA für die Organisation abgeschlossen (Dashboard →
Organization → Legal Documents → DPA, per PandaDoc unterschrieben)? Gilt er für **beide** Projekte?
Datum? Erst dann darf die DSE „besteht“ sagen statt „vorgesehen“.

**F2 — AV-Verträge Upstash und Vercel.** Die heutige DSE sagt „vorgesehen bzw. über Standard-AVV
abgedeckt“. Sind diese DPAs tatsächlich abgeschlossen/akzeptiert? (Betrifft den heutigen Text,
nicht erst den Umzug.)

**F3 — Drittlandtransfer.** Supabase, Inc., Upstash, Inc. und Vercel Inc. sitzen in den USA; die
Daten liegen in Frankfurt, ein Zugriff aus den USA (Support, Behörden, CLOUD Act) ist aber nicht
ausgeschlossen. Welcher Mechanismus gilt laut den jeweiligen DPAs: EU-US Data Privacy Framework
(ist Supabase dort zertifiziert? — bitte auf dataprivacyframework.gov nachsehen) und/oder SCC
Modul 2/3? Die DSE soll nur nennen, was der Vertrag tatsächlich vorsieht. Soll eine
Transfer-Folgenabschätzung (TIA) dokumentiert werden?

**F4 — Unterauftragsverarbeiter.** Supabase betreibt auf AWS (eu-central-1). Sollen die
Unter-Auftragsverarbeiter (AWS u. a., laut Supabase-Subprocessor-Liste) in der DSE genannt werden
oder genügt der Verweis auf die Liste des Anbieters? Wurde der Liste/Änderungsmitteilung im DPA
zugestimmt?

**F5 — Umschaltreihenfolge.** Werden `STORAGE_BACKEND` (Sync) und `BLOB_BACKEND` (Belege)
gleichzeitig umgeschaltet? Davon hängen die eckigen Klammern in 1.1 und 1.4 ab. Wenn nicht, braucht
es eine zweite Übergangsvariante.

**F6 — IP-Löschfrist bei Supabase.** Der Code löscht IP-Zähler nicht nach 60 s (Abschnitt 0,
Abweichung 1). Lieber (a) den Text auf „in der Regel innerhalb weniger Stunden“ ändern, (b) den
Code ändern (deterministisches Aufräumen per Cron, oder IP vor dem Speichern hashen), oder beides?
Empfehlung: (b) mit Hash — dann bleibt „kurzzeitig“ richtig und die Frage stellt sich kaum noch.
Wäre ein eigener Auftrag.

**F7 — Fehlerzähler.** Soll der Browser künftig automatisch an `/api/client-error` melden? Dann
gehört 1.3 in die DSE (Rechtsgrundlage lit. f, ggf. Einwilligung nötig? — nach § 25 TDDDG greift
das Auslesen aus dem Endgerät; bitte entscheiden, ob „technisch notwendig“ hier trägt).

**F8 — Bestehende Lücken mitschließen?** Vercel Blob (mit öffentlichen URLs) und das Login-Rate-
Limit/die Refresh-Sitzung bei Upstash stehen heute nicht in der DSE. Mit diesem Umzug gleich
mitkorrigieren (empfohlen) oder getrennt?

**F9 — Verfahrensdokumentation.** Gibt es eine Änderungshistorie, in die der Speicherwechsel mit
Datum eingetragen werden soll, oder genügt das neue Stand-Datum?

**F10 — Informationspflicht beim Wechsel.** Sollen bestehende Sync-Nutzer über den
Anbieterwechsel aktiv informiert werden (In-App-Hinweis/Mail über Whop), oder genügt die
aktualisierte DSE? Die Einwilligung in 4.1 wurde mit dem Text „Upstash“ erteilt.

**F11 — Löschung bei Upstash nach dem Umzug.** Wie wird die Löschung des Altbestands nachgewiesen
(Datenbank löschen, Bestätigung von Upstash)? Der Ü-Text verspricht sie.

**F12 — Preview-Projekt.** Laut Umzugsplan darf in Preview kein Spiegel gesetzt werden, sonst
landen Produktionsdaten in `stackr-preview`. Bitte bestätigen, dass das so bleibt — sonst wäre
`stackr-preview` ebenfalls in die DSE/das VVT aufzunehmen.
