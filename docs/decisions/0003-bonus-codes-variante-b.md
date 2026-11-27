# ADR-0003: Persönliche Bonus-Codes für Academy-Käufer (Variante B, Aufwandsklärung)

- **Status:** proposed (Vorgeschlagen) – Entscheidungsvorlage, nichts gebaut, keine Schlüssel angelegt
- **Date:** 2026-11-26

> Dieses Dokument ist **nur** eine Vorlage zur Entscheidung (Spike, nur gelesen). Es enthält
> keinen Code und ändert weder `THREAT_MODEL.md` noch `SPEC.md`. Die Empfehlung steht am Ende und
> ist als solche markiert. Rechtsfragen sind mit **[ZU PRÜFEN durch Rechtsberatung]** markiert und
> werden hier nicht beantwortet.

## Context

Der Whop-Kurs „Stackr Reseller Academy“ (eigenes Business `biz_7fJ0acmh2RIpdP`) soll Käufern
einmalig **6 Monate Stackr kostenlos** geben. Stackr selbst läuft in einem **anderen** Business
(`biz_2OEWYGlOwb8b0f`, Vorgabewert von `WHOP_COMPANY_ID` in `api/whop-access.js:202` und
`api/_whop-mitglieder.js`).

Bereits entschieden (Auftrag der startenden Session):

- **Jetzt Variante A:** ein fester Code mit Nutzungslimit in einer geschützten Kurslektion, der User
  deaktiviert ihn von Hand.
- **Später Variante B:** persönliche Codes je Käufer über einen serverseitigen Ablauf. Dieser ADR
  klärt nur deren Aufwand.

### Quellenlage

- **Whop-Doku**, abgerufen am **2026-11-26** durch einen Web-Fetch-Agenten. Mehrere Seiten waren
  nur in Teilen lesbar; der Agent hat diese Stellen als „Modell-Zusammenfassung“ gekennzeichnet –
  das ist hier mit **(Zus.)** übernommen und gilt als *schwach belegt*. Drei Seiten lieferten nur
  „Log in“ und konnten nicht gelesen werden: `/api-reference/webhooks`,
  `/api-reference/support-channels`, `/api-reference/memberships/memberships`.
- **Selbstberichte** (ungeprüft, Browser-Subagent im Dashboard):
  `Reseller-Autopilot/quellen/whop-bonus-test.md` (2026-11-24),
  `quellen/whop-dashboard-test.md` (2026-11-17), `quellen/whop.md` (Stand 2026-11-22). Jede
  Aussage daraus ist unten entweder mit Doku-URL belegt oder als **unbelegt (nur Selbstbericht)**
  markiert.

Abkürzungen für Doku-URLs (alle `https://docs.whop.com/…`, Abruf 2026-11-26):

| Kürzel | URL |
| --- | --- |
| [D-PC] | `/api-reference/promo-codes/create-promo-code` |
| [D-PL] | `/api-reference/promo-codes/list-promo-codes` |
| [D-PD] | `/api-reference/promo-codes/delete-promo-code` |
| [D-WH] | `/developer/guides/webhooks` |
| [D-PS] | `/api-reference/payments/payment-succeeded` |
| [D-AS] | `/developer/guides/auth-scoping.md` |
| [D-PM] | `/developer/guides/permissions.md` |
| [D-QS] | `/developer/quickstart` |
| [D-MSG] | `/api-reference/messages/create-message` |
| [D-VAR] | `/api-reference/variants/create-variant` |
| [D-PROMO-UI] | `/manage-your-business/growth-marketing/promo-codes` (laut `quellen/whop.md`, Volltext dort geprüft 2026-11-22) |

### Ist-Stand im Stackr-Code (am 2026-11-26 gegen den Code geprüft)

- **Kein Zahlungs-Webhook.** `SPEC.md`, Abschnitt „Operationen mit Folgen“: „`api/whop-*.js` prüft
  nur Zugang, kein Zahlungs-Webhook im Repo“. Whop ist Merchant of Record.
- **Zugangsprüfung:** `api/_auth.js` und `api/whop-access.js` prüfen per
  `GET https://api.whop.com/api/v2/me/has_access/<id>` mit dem Nutzer-Token gegen
  `WHOP_ACCESS_IDS` (Vorgabe: zwei `prod_…` plus `biz_2OEWYGlOwb8b0f`), ersatzweise mit dem
  Firmen-Schlüssel `WHOP_API_KEY` gegen `/v5/company/memberships`. Daneben v1-Aufrufe
  (`/api/v1/memberships`, `/api/v1/members`) mit demselben Schlüssel. **Folge:** Ein Bonus-Plan muss
  in einem Produkt liegen, das `WHOP_ACCESS_IDS` abdeckt (über die `biz_`-ID vermutlich schon heute
  – [im Test zu bestätigen]).
- **Webhook-Eingang mit Signatur existiert schon einmal:** `api/shopify-webhook.js` liest den
  **Rohbody** vor jedem JSON-Parse (`rohBody`, max. 1 MB), prüft HMAC-SHA256 zeitkonstant
  (`pruefeWebhookHmac` / `gleich` in `api/_shopify.js`), speichert keine Payload-Inhalte und
  loggt nur feste Codes. Das ist die Vorlage für einen Whop-Webhook.
- **Rate-Limit, Sperren, Idempotenz-Bausteine:** `api/_sync-store.js` bietet `rateHit`
  (INCR + EXPIRE NX), `lockTry` (`SET NX EX`) und `lockRelease` auf Upstash Redis (EU).
  `api/_alert.js` (`alertOps`) meldet Betriebsfehler an Make/Blob/Supabase.
- **E-Mail-Versand: gibt es nicht.** `api/kontakt.js` verschickt **keine** E-Mail. Es postet das
  Formular per `fetch` an `ALERT_WEBHOOK_URL` (Make-Szenario, Ereignis `kontakt`), Make leitet es an
  das **eigene** Postfach des Betreibers weiter. Es gibt im Repo keinen SMTP-Zugang, keinen
  Mail-Anbieter und keine Absenderdomain-Einrichtung. **Jede Variante, die Stackr selbst E-Mails
  an Käufer schicken lässt, braucht also einen neuen Weg.**
- **Endpunkte:** `api/` enthält heute 14 auslieferbare Funktionen (Dateien ohne `_`); `vercel.json`
  hat keinen `functions`-Block, nur einen Cron (`/api/blob-cleanup`). CSP betrifft nur
  Browser-Seiten; server-seitige Aufrufe an `api.whop.com` brauchen keine CSP-Änderung.
- **Abhängigkeiten:** genau eine produktive (`@vercel/blob`), Regel 6.

### Was die Whop-Doku zu den fünf Fragen sagt

**1. Promo-Codes per API**

| Punkt | Befund | Beleg |
| --- | --- | --- |
| Anlegen | `POST /promo_codes`, Pflicht u. a. `account_id`, `amount_off`, `base_currency`, `code`, `new_users_only`, `promo_duration_months`, `promo_type` | [D-PC] (Zus.) |
| 100 % | `promo_type: percentage`, `amount_off` 0,01–100 → **100 % zulässig** | [D-PC] (Zus.); im Dashboard angelegt laut Selbstbericht |
| 6 Monate | `promo_duration_months`: `0` = jede Zahlung, `1` = nur erste, `N` = erste N Zahlungen → **6** | [D-PC] |
| „repeating“/`duration` | In der Doku **nicht** vorhanden; Selbstbericht nennt `duration: "repeating"` im API-Objekt | **unbelegt (nur Selbstbericht)** |
| stock = 1 | `stock` (Integer/null, Pflicht außer bei `unlimited_stock: true`) | [D-PC] (Zus.) |
| one_per_customer | optionaler Boolean | [D-PC] (Zus.) |
| Zielgruppe | `new_users_only` (Pflicht), `churned_users_only`, `existing_memberships_only` | [D-PC] (Zus.) |
| Bindung Produkt/Plan | `product_id` und `variant_ids` (IDs mit Präfix `plan_`); **kein** `plan_ids` | [D-PC] (Zus.), [D-PL] (Zus.) |
| Ablaufdatum | `expires_at` (ISO-8601/null) | [D-PC] (Zus.) |
| Beenden | `DELETE /promo_codes/{id}` **archiviert** („cannot be used in future checkouts“), Antwort `{id, deleted: true}` | [D-PD] (Zus.) |
| Auflisten | `GET /promo_codes?account_id=…`, Filter `status` = active/inactive/archived/expired | [D-PL] (Zus.) |
| Ändern / Einzelabruf / Pausieren | Update-Endpunkt **nicht gefunden**; Pausieren nur als Tag-Text erwähnt, kein Pfad | [D-PL], [D-MSG] (Tag-Text) |
| Bindung an eine Person (E-Mail/User) | in der Doku **nicht gefunden** | – |
| Scopes | `promo_code:create`, `promo_code:delete`, `promo_code:basic:read` | [D-PC], [D-PD], [D-PL] (Zus.) |

**Zwei Businesses:** Ein **Account-API-Key** „authenticates your server as one account“; ein
**App-API-Key** „authenticates your app across every account that installed it“ [D-AS]. Ein
Account-Key kann also nicht in beiden Businesses handeln. Daraus folgt: entweder **zwei
Account-Keys** (Kurs-Business: Webhook/Lesen/Nachricht; Stackr-Business: Promo-Codes) oder **eine
eigene Whop-App**, die in beiden Businesses installiert wird (eine Berechtigungsliste, bis 100
Permissions, Bestätigung durch den Creator bei Installation [D-PM]). Keys können ein eigenes
Berechtigungsset bekommen; die Doku rät von Admin-Keys ab [D-AS], [D-QS]. Sandbox und Produktion
teilen weder Konten, Keys noch Webhooks [D-QS].

**2. Webhooks**

- Ereignisse laut Doku: `payment.succeeded`, `payment.failed`, `payment.created`,
  `payment.pending`, `payment.authorized`, `payment.canceled`, `payment.requires_action`,
  `membership.activated`, `membership.updated`, `membership.trial_ending_soon`,
  `refund.created`, `refund.updated`, `dispute.created`, `dispute.updated`,
  `setup_intent.succeeded`, `invoice.paid` [D-WH].
- `membership.deactivated` und `membership.cancel_at_period_end_changed` stehen nur im
  Selbstbericht (Dashboard-Liste), **nicht** auf [D-WH] → **unbelegt (nur Selbstbericht)**.
  „Keine Promo-Code-Ereignisse“: auch die Doku-Liste enthält keine [D-WH].
- **Payload:** Hülle mit `type`, `account_id` (ab API-Pin `2026-08-14`, davor `company_id`) und
  `data` = „the full payment object“, Beispiel nur `data.id = pay_…` [D-WH]. Die **Feldliste**
  (User-ID, E-Mail, Produkt-/Plan-ID, Membership-ID) war nicht lesbar; [D-PS] nennt als Scopes
  `member:email:read` und `member:basic:read`, was auf Nutzer-/E-Mail-Felder hindeutet →
  **Felder unbelegt, per Sandbox-Event zu prüfen**.
- **Signatur:** Standard Webhooks. Header `webhook-id`, `webhook-timestamp`,
  `webhook-signature` (`v1,<base64>`), HMAC-SHA256 über `{id}.{timestamp}.{rohbody}`, Schlüssel ist
  das `ws_…`-Secret [D-WH]. Die SDK-Helfer erhalten das Secret „unverändert, ohne `ws_` zu
  entfernen“ [D-WH] – **welche Bytes genau der HMAC-Schlüssel sind, wenn man ohne SDK prüft, ist
  nicht eindeutig belegt** und muss gegen ein Sandbox-Event getestet werden.
- **Replay-Schutz:** Ereignis ablehnen, wenn `webhook-timestamp` mehr als **5 Minuten** abweicht
  [D-WH].
- **Zustellung:** 2xx binnen **5 Sekunden**, sonst ca. 12 Wiederholungen über ca. 71 h (30 s,
  2 min, 8 min, 30 min, 1 h, 3 h, 6 h, dann alle 12 h); jede Wiederholung mit **derselben
  `webhook-id`**; Doku verlangt idempotente Handler („Store the `webhook-id` and ignore
  duplicates“); Reihenfolge nicht garantiert; nach 72 h mit ≥ 10 Fehlern wird der Webhook
  **deaktiviert und Ereignisse werden nicht nachgeliefert** [D-WH].
- **Anlage:** `POST /api/v1/webhooks` mit `url`, `events`; `resource_id` = Account oder App;
  Secret wird nur einmal angezeigt [D-WH].

**3. Zustellung**

- `POST /messages` mit `channel_id` und `content` (Markdown), gesendet als Nutzer oder App-Agent;
  ein Scope genügt aus `dms:message:manage`, `chat:message:create`,
  `support_chat:message:create` [D-MSG] (Zus.).
- **E-Mail über Whop:** `POST /messages` kennt ein Feld `email_address`; die Nachricht wird dann
  zusätzlich „emailed to the customer of a support chat“. Nötig: `member:email:read` plus
  `email:read` und `email:send` (oder Besitz der Adresse) [D-MSG] (Zus.). Das ist der
  Doku-Gegenpart zum Dashboard-Scope „Send email“ aus dem Selbstbericht – **teilweise belegt**:
  E-Mail nur als Kopie einer Support-Chat-Nachricht, eine allgemeine „E-Mail an beliebige Nutzer“
  ist **nicht** dokumentiert.
- **Wie man den Support-Chat-Kanal eines Käufers bekommt oder anlegt** (`channel_id`), ist
  **nicht belegt** – die Seite `/api-reference/support-channels` war nicht lesbar.
- „Automatische Nachrichten“ (Trigger nur `User joins`/`User leaves`, Platzhalter nur
  `{recipient_name}`, `{whop_name}`, `{recipient_mention}`, Option „E-Mail an den Nutzer senden“)
  und „Automatisierungen kommen bald“: **unbelegt (nur Selbstbericht)**. Folge, falls richtig: Ohne
  eigenen Server geht nur ein fester Code.

**4. Widerruf/Refund**

- Ungenutzten Code entziehen: `DELETE /promo_codes/{id}` (archiviert) [D-PD]. Ob ein Code schon
  eingelöst ist, ließe sich über `GET /promo_codes` (Bestand/Status) erkennen – welche Felder die
  Nutzung zeigen, ist **unbelegt**.
- Ist der Code schon eingelöst, nimmt das Archivieren die bereits entstandene Stackr-Mitgliedschaft
  **nicht** zurück (Archiv wirkt nur auf „future checkouts“ [D-PD]). Dann bleibt Handarbeit im
  Stackr-Business.
- „Keine native Verknüpfung Kurs-Refund ↔ Code“: **unbelegt (nur Selbstbericht)**, aber
  plausibel, weil die Doku keine Promo-Ereignisse und keine Bindung an Personen kennt.

**5. Abbuchung ab Monat 7 (Nebenfrage)**

- Ein 100-%-Code mit `promo_duration_months: 6` rabattiert laut [D-PC] die **ersten 6 Zahlungen**;
  ab der 7. Zahlung gilt der Normalpreis. Dass das Abo dann **automatisch abbucht**, folgt aus
  dem Abo-Modell, ist aber in der Doku nicht ausdrücklich beschrieben und im Selbstbericht nicht
  mit einem echten Checkout getestet → **unbelegt (nur Selbstbericht, plausibel)**.
- Plan-Felder: `billing_type` = `renewal` | `one_time`, `expiration_days` („Sets how long access
  lasts before the membership expires“), `trial_period_days`, `initial_price` (0 = kostenlos)
  [D-VAR] (Zus.). Ein `one_time`-Plan mit `expiration_days` gibt laut Feldbeschreibung Zugang auf
  Zeit ohne Folgeabbuchung. Das Dashboard-Feld „Zugang automatisch ablaufen lassen → Nach sechs
  Monaten“ (nur bei „Einmalig“) ist **unbelegt (nur Selbstbericht)**, passt aber zu
  `expiration_days`.
- Laut Selbstbericht werden Einmalkäufe von einem Promo-Code „einmalig rabattiert“; [D-PROMO-UI]
  nennt die Laufzeitstufen One-time/Forever/Multiple months (über `quellen/whop.md`).

## Decision

Noch keine. Vorgeschlagen ist die Empfehlung am Ende. Bis zur Annahme gilt Variante A wie
beschlossen.

## Alternatives considered

### Vergleich

| Variante | Kurz | Aufwand | Neue Secrets | Neuer offener Endpunkt | E-Mail-Dienst | Abbuchung ab Monat 7 |
| --- | --- | --- | --- | --- | --- | --- |
| A | fester Code in Kurslektion | **klein** (kein Code) | – | – | nein | ja, wenn Code auf Abo-Plan |
| C | Einmal-Plan mit 6-Monats-Ablauf | **klein** (kein Code) | – | – | nein | **nein** |
| A + C | fester Code, gebunden an den Einmal-Plan | **klein** (kein Code) | – | – | nein | **nein** |
| B1 | Webhook + API + Whop-Zustellung | **mittel** | 2–3 | ja (Webhook) | nein (Whop schickt) | je nach Plan; mit C: nein |
| B2 | Webhook + API + eigener E-Mail-Dienst | **groß** | 3–4 | ja (Webhook) | **ja** | je nach Plan; mit C: nein |
| B3 | Abholseite mit Whop-Login (Zusatzvorschlag) | **mittel bis klein** | 1 | ja (eingeloggt) | nein | je nach Plan; mit C: nein |

### (A) Fester Code mit Nutzungslimit (beschlossen für jetzt)

- **Bau:** keiner. Im **Stackr**-Business einen Code anlegen: 100 %, `stock` = erwartete
  Käuferzahl, `one_per_customer`, `new_users_only`, Bindung an den Bonus-Plan, `expires_at`;
  Code in eine Lektion des Kurs-Businesses. Deaktivieren von Hand über „Beenden“ bzw. Archiv.
- **Aufwand klein:** keine Dateien, keine Endpunkte, keine Secrets, keine Tests.
- **Risiken:** Code-Leak (Screenshot, Forum) → jedes neue Whop-Konto kann ihn bis `stock`
  einlösen; `new_users_only` + `one_per_customer` begrenzen nur je Konto. Kein Bezug zum
  Kurskauf, Refund-Käufer behalten den Code. Ohne C: automatische Abbuchung ab Monat 7.
- **Bedrohungsmodell:** kein neues Secret, kein Endpunkt. Schutzwert „Umsatz“ (Missbrauch
  bis `stock`).
- **Datenschutz:** Stackr speichert nichts Neues; Einlösung liegt bei Whop.
- **Regel 6 / 12:** unberührt.

### (C) Einmal-Plan mit automatischem Ablauf (Nebenfrage, auch kombinierbar)

- **Bau:** im Stackr-Business einen versteckten Plan `billing_type: one_time`,
  `expiration_days` ≈ 6 Monate (Dashboard: „Nach sechs Monaten“), Preis 0 € oder Normalpreis mit
  100-%-Code. Kein laufendes Abo → nach Ablauf **keine** Folgeabbuchung; wer weiter will, kauft
  aktiv ein reguläres Abo.
- **Aufwand klein:** kein Code. Zu prüfen: liegt der Plan in einem Produkt, das
  `WHOP_ACCESS_IDS` abdeckt; zeigt `api/whop-access.js` nach Ablauf sauber den Kaufbildschirm.
- **Risiken:** Ein 0-€-Plan per geheimem Link leakt wie ein fester Code (Bestand/`stock` des Plans
  begrenzt). Kein automatischer Übergang ins Bezahlabo → evtl. weniger Umwandlung (Produktfrage,
  nicht Technik). Ob `has_access` nach `expiration_days` sofort „kein Zugang“ liefert: im Test
  bestätigen.
- **Rechtsfolge:** ob und wie bei Variante A (Abo nach Gratismonaten) über die spätere Abbuchung
  im Checkout zu informieren ist und ob C diese Pflichten entfallen lässt, **[ZU PRÜFEN durch
  Rechtsberatung]**. Ebenso, ob der Bonus bei Widerruf/Erstattung des Kurses entfällt **[ZU PRÜFEN
  durch Rechtsberatung]**.
- **Bedrohungsmodell / Datenschutz / Regel 6, 12:** wie A, nichts Neues.

### (B1) Webhook + API + Zustellung über Whop

Ablauf: Kurs-Business feuert `payment.succeeded` → neuer Endpunkt prüft Signatur → legt im
Stackr-Business per `POST /promo_codes` einen Zufallscode an (100 %, `stock: 1`,
`one_per_customer: true`, `variant_ids: [Bonus-Plan]`, `expires_at` z. B. +60 Tage) → schickt ihn
per `POST /messages` in den Support-Chat des Käufers im Kurs-Business, optional mit E-Mail-Kopie
über `email_address` [D-MSG]. `refund.created` → zugehörigen Code archivieren, falls ungenutzt.

- **Dateien (Schätzung):** `api/whop-bonus-webhook.js` (Endpunkt, Rohbody, Signatur, Antwort
  < 5 s), `api/_whop-bonus.js` (Fachmodul: Code erzeugen, Whop-Aufrufe, Zuordnung; Regel 11),
  gemeinsamer Standard-Webhooks-Prüfer (ggf. aus `api/_shopify.js` `gleich` wiederverwenden),
  `test/test-whop-bonus-signatur.js`, `test/test-whop-bonus-ablauf.js` (Idempotenz, Replay,
  Refund, Whop-Fehler gemockt wie in den bestehenden Node-Harnesses). Kein Eintrag in
  `vercel.json` nötig.
- **Endpunkte:** +1 öffentlich erreichbar (POST, nur mit gültiger Signatur).
- **Secrets (Vercel-Env, legt nur der User an):** `WHOP_BONUS_WEBHOOK_SECRET` (`ws_…`,
  Kurs-Business), `WHOP_BONUS_PROMO_KEY` (Stackr-Business, nur `promo_code:create`,
  `promo_code:delete`, `promo_code:basic:read`), `WHOP_KURS_API_KEY` (Kurs-Business, nur
  `support_chat:message:create`, ggf. `member:email:read`, `email:read`, `email:send`, Lesen von
  Payments/Members). **Nicht** den bestehenden `WHOP_API_KEY` erweitern: der liest heute
  Mitgliedschaften und E-Mails, ein Promo-Recht darauf vergrößert den Schaden bei Leak. Alternative:
  eine Whop-App in beiden Businesses (ein Schlüssel, eine Permission-Liste [D-AS], [D-PM]).
- **Idempotenz:** zweistufig. (1) `webhook-id` per `lockTry('bonus:wh:<id>', 72 h)` – deckt die
  Retries über 71 h [D-WH]. (2) fachlich je **Payment-ID**: Zuordnung `pay_… → promo_…` in Redis
  vor dem Anlegen sperren, damit zwei verschiedene Ereignisse (z. B. erneut gesendet) keinen
  zweiten Code erzeugen. Code-Erzeugung muss in die 5-s-Grenze passen; sonst 2xx sofort und
  Nachholen per Cron.
- **Ausfallpfad:** wird der Webhook nach 72 h deaktiviert, gehen Ereignisse verloren [D-WH] →
  `alertOps` bei jedem Fehler, dazu ein Abgleich (Payments des Kurs-Businesses gegen vergebene
  Codes) per Cron oder von Hand.
- **Offen/Risiko:** `channel_id` des Käufer-Support-Chats ist nicht belegt (Seite nicht
  lesbar). Payload-Felder (`user_id`, Plan-/Produkt-ID) unbelegt → evtl. Zusatzaufruf
  `GET /payments/{id}`. Ohne SDK (Regel 6) muss die Standard-Webhooks-Prüfung selbst gebaut und
  gegen Sandbox-Events getestet werden (Schlüssel-Bytes des `ws_`-Secrets).
- **Aufwand mittel:** 2 neue Dateien + 2 Tests, 2–3 Secrets, 1 Endpunkt, Sandbox-Durchlauf
  Pflicht. Schätzung **2–3 Arbeitstage** inkl. Sandbox-Test, ohne Rechtsprüfung.

### (B2) Webhook + API + eigener E-Mail-Dienst

Wie B1, aber Zustellung per eigener E-Mail an die Käuferadresse.

- **Zusätzlich zu B1:** E-Mail-Anbieter (REST per `fetch` geht ohne npm-Paket, dann formal keine
  neue *Code*-Abhängigkeit nach Regel 6, aber eine neue **Dienst**-Abhängigkeit, die Regel 6 sinngemäß
  trifft → Rückfrage nötig), **AVV** mit dem Anbieter, Eintrag in Datenschutzerklärung,
  Absenderdomain mit **SPF, DKIM, DMARC** für `getstackr.de`, Bounce-/Beschwerdebehandlung,
  Abmelde-/Pflichtangaben je nach Mailart **[ZU PRÜFEN durch Rechtsberatung]**, laufende Kosten.
  Die Adresse muss Stackr kurz selbst verarbeiten (Payload oder `GET /members`).
- **Make als Umweg:** Das vorhandene Make-Szenario (`api/kontakt.js`, `ALERT_WEBHOOK_URL`) leitet
  heute nur an das **eigene** Postfach. Käufer-Mails darüber (z. B. Gmail-Modul) wären ein neuer
  Verarbeitungszweck über Make und das private Postfach – AVV/Zweckbindung **[ZU PRÜFEN durch
  Rechtsberatung]**, technisch unsauber (Zustellbarkeit, Absender).
- **Aufwand groß:** alles aus B1 plus Mail-Modul, Vorlage, 1 weiteres Secret, DNS-Einrichtung durch
  den User, Datenschutz-/AVV-Arbeit. Schätzung **4–6 Arbeitstage** plus DNS/AVV-Vorlauf. **Größter
  Kostentreiber dieses ADR.**

### (B3) Abholseite mit Whop-Login (Zusatzvorschlag dieses Spikes)

Statt Push (Webhook) ein Pull: Käufer öffnet in Stackr eine Seite „Academy-Bonus abholen“, meldet
sich mit dem **vorhandenen** Whop-Login an; der Server prüft mit dem Nutzer-Token per
`/api/v2/me/has_access/<Kurs-Produkt-ID>` (Muster aus `api/_auth.js`), ob der Kurs gekauft ist,
und erzeugt dann **einmal je Whop-User-ID** einen Code (oder zeigt den schon erzeugten).

- **Vorteile:** kein Webhook-Secret, kein Retry-/Deaktivierungsproblem, keine Zustellung (Code
  steht nur auf der Seite des eingeloggten Käufers), Refund vor Abholung wirkt automatisch (kein
  Zugang mehr), keine E-Mail.
- **Dateien:** `api/whop-bonus.js` + `api/_whop-bonus.js`, eine kleine Seite oder ein Dialog,
  1–2 Tests. **Secret:** nur `WHOP_BONUS_PROMO_KEY`.
- **Offen:** Ob `has_access` mit dem Token der Stackr-OAuth-App für ein Produkt **eines anderen
  Businesses** antwortet, ist **unbelegt** – erster Sandbox-Test. Refund **nach** Abholung bleibt
  Handarbeit (oder zusätzlich `refund.created` wie B1). Rate-Limit über `rateHit`.
- **Aufwand mittel bis klein:** ca. **1–2 Arbeitstage**, falls `has_access` übergreifend geht.

### Verworfen

| Option | Warum nicht |
| --- | --- |
| Kurs-Produkt-ID in `WHOP_ACCESS_IDS` aufnehmen | Stackr-Zugang hinge an der (ggf. unbefristeten) Kurslaufzeit statt an 6 Monaten; eigene Ablauflogik im Gate nötig, berührt INV-4. |
| Stackr gewährt den Zugang selbst (eigener 6-Monats-Zähler) | Zugang an Whop vorbei, sicherheitskritischer Eingriff in `api/_auth.js`/`api/whop-access.js` und INV-4. |
| Whop-SDK (`@whop/sdk`, `unwrapWebhook`) | Neue Abhängigkeit (Regel 6); die Prüfung ist mit `crypto` aus Node in wenigen Zeilen machbar. |
| Mitgliedschaft per API direkt vergeben („free variant“-Einladung) | Nur als Tag-Text erwähnt, Seite nicht lesbar, unbelegt; als spätere Option im Test prüfen. |

## Querschnitt für B1/B2/B3

### Bedrohungsmodell (nur benennen)

| Bedrohung | Wirkung | Gegenmaßnahme |
| --- | --- | --- |
| Neues Secret mit Promo-Recht leakt | Angreifer erzeugt beliebig 100-%-Codes im Stackr-Business | eigener Key nur mit `promo_code:*`, nie Admin [D-AS]; Rotation durch den User; Notschalter-Liste in `THREAT_MODEL.md` ergänzen |
| Gefälschter Webhook (B1/B2) | Codes für Nicht-Käufer | Standard-Webhooks-Signatur über Rohbody, zeitkonstanter Vergleich |
| Replay eines echten Webhooks | doppelter Code | 5-min-Zeitfenster [D-WH] + `webhook-id`-Sperre + Sperre je Payment-ID |
| Flut auf offenen Endpunkt | Kosten, Whop-Rate-Limit | Signatur zuerst, Körpergröße begrenzen (wie `MAX_BODY`), `rateHit` |
| Code-Leak durch Käufer | ein Fremder löst ein | `stock: 1` begrenzt auf einen Missbrauch je Kauf; Bindung an Person nicht belegt |
| Refund nach Einlösung | Bonus bleibt | Handarbeit im Stackr-Business; Rechtsfolge [ZU PRÜFEN durch Rechtsberatung] |
| Selbstkauf + Refund-Schleife | Bonus ohne Bezahlung | Refund archiviert ungenutzten Code; Mehrfachkäufe je User zählen |

### Datenschutz

- **B1:** Stackr speichert in Redis `webhook-id` (TTL 72 h) und die Zuordnung
  `payment_id → promo_id (+ whop user_id)` bis Code-Ablauf + Refund-Fenster, danach löschen
  (Vorschlag: `expires_at` + 30 Tage als TTL; endgültige Frist **[ZU PRÜFEN durch
  Rechtsberatung]**). Payload-Inhalte (Name, E-Mail) **nicht** speichern, Logs nur mit festen Codes
  (Muster `api/shopify-webhook.js`). Neu ist die Verarbeitung von **Kurs-Käuferdaten aus einem
  zweiten Business** in Stackr → Datenschutzerklärung ergänzen.
- **B2:** zusätzlich E-Mail-Adresse beim Versand und beim Mail-Anbieter (dessen Speicherfrist),
  neuer Auftragsverarbeiter in Datenschutzerklärung und AVV.
- **B3:** nur `whop user_id → promo_id` bis Ablauf; keine E-Mail.
- **A/C:** nichts Neues bei Stackr.

### Regel 6 und Regel 12

- **Regel 6:** A, C, B1, B3 ohne neue Abhängigkeit (Node-`crypto`, `fetch`, vorhandenes Redis).
  B2 bringt einen neuen externen Dienst → **Rückfrage zwingend**. Das Whop-SDK wird nicht genutzt.
- **Regel 12:** in keiner Variante ein KI-Dienst. Unberührt.

### Folgen für SPEC.md und THREAT_MODEL.md (nur benennen, hier nicht geändert)

- `SPEC.md` „Operationen mit Folgen“: Zeile „Zahlung / Abo (Whop) … kein Zahlungs-Webhook im Repo“
  wäre bei B1/B2 falsch; neue Zeile „Academy-Bonus-Code“ mit Idempotenz je Payment-ID und Test.
  Ggf. neue Invariante „je Kurskauf höchstens ein Bonus-Code“ mit Test.
- `THREAT_MODEL.md`: neues Secret (Promo-Key, Webhook-Secret) unter „Server-Secrets“, neuer
  Angriffspfad „gefälschter/wiederholter Whop-Webhook“, Notschalter „Promo-Key rotieren,
  Webhook deaktivieren“.

## Empfehlung (Vorschlag dieses Spikes, nicht beschlossen)

1. **Sofort, ohne Code:** Variante A wie beschlossen, aber den festen Code an einen
   **Einmal-Plan mit 6-Monats-Ablauf** binden (A + C). Das verhindert die automatische Abbuchung ab
   Monat 7, kostet nichts und ändert keine Datei. Rechtsfolge beider Wege **[ZU PRÜFEN durch
   Rechtsberatung]**.
2. **Für Variante B zuerst B3 prüfen:** eine Sandbox-Probe, ob `has_access` mit dem Stackr-Token
   das Kurs-Produkt erkennt. Wenn ja: B3 bauen (ca. **1–2 Arbeitstage**, ein Secret, kein
   E-Mail-Dienst).
3. **Sonst B1** (ca. **2–3 Arbeitstage**), mit eigenem Promo-Key, Standard-Webhooks-Prüfung ohne
   SDK und zweistufiger Idempotenz; Zustellung über Whop-Support-Chat mit E-Mail-Kopie, sobald die
   `channel_id`-Frage geklärt ist.
4. **B2 nur, wenn Whop-Zustellung nachweislich nicht reicht** – größter Aufwand (4–6 Tage plus
   AVV/DNS) und neue Dienstabhängigkeit mit Rückfrage nach Regel 6.
5. In jeder B-Variante den Code an den Einmal-Plan aus C binden (`variant_ids`).

## Unbelegt / vom User im Dashboard oder in der Sandbox zu prüfen

1. `duration: "repeating"` im Promo-Objekt (Doku kennt nur `promo_duration_months`).
2. Dashboard-Feld „Monate“ mit `min=2` und die Vorschau „100 % auf die ersten 6 Zahlungen“.
3. Automatische Abbuchung ab Monat 7 bei 100-%-Code auf Abo-Plan (nie mit echtem Checkout getestet).
4. „Zugang automatisch ablaufen lassen → Nach sechs Monaten“ nur bei „Einmalig“; Gleichsetzung mit `expiration_days`.
5. Free Trial bis 180+ Tage einstellbar.
6. Webhook-Ereignisse `membership.deactivated`, `membership.cancel_at_period_end_changed` (nicht auf [D-WH]).
7. Payload-Felder von `payment.succeeded` und `refund.created` (User-ID, E-Mail, Plan-/Produkt-ID, Payment-Bezug im Refund).
8. Exakte Schlüssel-Bytes des `ws_…`-Secrets bei Prüfung ohne SDK.
9. Dashboard-Scope „Send email“ als allgemeiner Mailversand (Doku: nur E-Mail-Kopie einer Support-Chat-Nachricht).
10. Wie man per API den Support-Chat-Kanal (`channel_id`) eines Käufers bekommt oder anlegt.
11. „Automatische Nachrichten“ (Trigger, drei Platzhalter, E-Mail-Option) und „Automatisierungen kommen bald“.
12. Update-/Pausieren-/Einzelabruf-Endpunkt für Promo-Codes; Feld, das die Einlösung eines Codes anzeigt.
13. Bindung eines Promo-Codes an eine bestimmte Person (Doku: nicht gefunden).
14. Ob `has_access` mit dem Stackr-OAuth-Token für ein Produkt des Kurs-Businesses antwortet (Voraussetzung B3).
15. Ob der Bonus-Plan über `biz_2OEWYGlOwb8b0f` in `WHOP_ACCESS_IDS` schon abgedeckt ist und ob nach Ablauf sofort der Kaufbildschirm kommt.
16. Mitgliedschaft per API über eine kostenlose Variante vergeben (nur Tag-Text).
17. Alle mit (Zus.) markierten Doku-Angaben: wörtlich gegen die Seite oder `https://api.whop.com/api/v1/openapi.json` nachlesen.
18. Test-Objekt `TEST_BONUS_PRUEFUNG` (`promo_CzsrDWjyjQVw`) im Academy-Business ist laut Selbstbericht noch aktiv – aufräumen.

## Affected components

- Heute: keine (nur dieses Dokument).
- Bei B1/B2: neu `api/whop-bonus-webhook.js`, `api/_whop-bonus.js`, Tests in `test/`; Vercel-Env.
- Bei B3: neu `api/whop-bonus.js`, `api/_whop-bonus.js`, eine Abholseite, Tests.
- Später nachzuziehen: `SPEC.md`, `THREAT_MODEL.md`, `datenschutz.html`.

## Consequences

- Good: Aufwand und Lücken für Variante B sind vor dem Bau bekannt; A + C beseitigt das
  Abbuchungsrisiko ohne Code.
- Bad / costs: jede B-Variante bringt mindestens ein neues Secret mit Schreibrecht im
  Stackr-Business; B2 zusätzlich einen Mail-Dienst mit AVV und DNS-Arbeit.
- Risks: viele Doku-Angaben nur zusammengefasst gelesen; Whop ändert Dashboard und API laufend.
  Vor dem Bau Sandbox-Durchlauf Pflicht.

## Enforcement

Manual review only (Entscheidungsvorlage). Bei Umsetzung: Node-Tests in `test/` für Signatur,
Replay-Fenster, Idempotenz je `webhook-id` und Payment-ID sowie Refund-Archivierung (laufen in
`.github/workflows/tests.yml`).
