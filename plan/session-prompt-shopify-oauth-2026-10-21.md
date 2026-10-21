# Session-Prompt: Shopify-Connector, Weg (b) per OAuth — Stand 2026-10-21

> Copy-Paste-Prompt für eine **neue** Session. Vor dem Greifen gegen den Code prüfen (Regel 3
> der CLAUDE.md) — diese Datei veraltet, sobald der Server-Umbau Tabellen anlegt.

---

## Prompt

Shopify-Connector für Stackr Web 1.7 über eine eigene OAuth-App (Weg b) bauen. Zuerst
`CLAUDE.md` lesen, `git status --short && git log --oneline -8`, dann
`plan/02-ENTSCHEIDUNGEN.md` (oberster Block „LOCAL-FIRST AUFGEGEBEN“, 2026-10-21) und diese Datei.

### Ausgangslage (Stand 2026-10-21)

- **Entscheidung:** Local-First ist aufgegeben, der Server (Supabase) führt mit **lesbaren**
  Daten. Shopify nur per OAuth-App. Weg (a) (Kunde legt selbst Zugangsdaten an) entfällt: Seit
  01.01.2026 gibt es keinen kopierbaren Admin-Token mehr, nur Client-ID/Secret über das Dev
  Dashboard mit 24-h-Token, und Shopify rät Drittanbietern selbst zu OAuth.
- **Der Server-Umbau läuft in einer eigenen Session** (Start 2026-10-22). Ob es dort schon
  serverseitige Tabellen für Verkäufe/Lager/Retouren gibt, im Code prüfen
  (`supabase/migrations/`), nicht annehmen.
- **Schon fertig, nicht gepusht:** `0c87b11`, `43bc636`, `986a594`.
  - `js/shopify-buchung.js`: reiner Rechenkern ohne Store, Netz und DOM, per `require` auch in
    Node ladbar. `plane()` (Verkaufsvorschläge), `planeErstattungen()`, `ausGraphQL()`
    (GraphQL → Webhook-Format), `BESTELL_QUERY`, `abgleichAuszahlung()`, `gebuehrProzent()`.
    Enthält die **9 vom User freigegebenen Buchungsregeln** und die Annahmen im Kopfkommentar.
  - `js/shopify-import.js`: Adapter des Kerns auf den **lokalen** Store (`Store.saveSale`,
    `Retouren.buche`), Doppelimport-Schutz über `sale.quelle` / `retoure.quelle`.
  - `api/_shopify.js`: Helfer ohne Route: `istShopDomain`, `pruefeQueryHmac`,
    `pruefeWebhookHmac`, `erzeugeState`/`pruefeState` (Nonce-Cookie), `installUrl`
    (Code Grant, Offline-Token), `tokenAnfrage`, `scopesPassen`,
    `verschluesseleToken`/`entschluesseleToken` (AES-256-GCM, Shop als AAD), `webhookAktion`
    (inkl. `customers/data_request`, `customers/redact`, `shop/redact`).
  - Tests: `test/test-shopify-buchung.js`, `test/test-shopify-import.js`,
    `test/test-shopify-server.js`.
  - Hintergrund und Doku-Belege: `shopify-steuerfragen-2026-10-21.md` im Notizordner der
    Ursprungs-Session (nicht im Repo; der Inhalt steht hier zusammengefasst).

### Anpassung an den Klartext-Server

- **Entfällt:** Versiegeln mit Nutzer-Pubkey und versiegelte Inbox. In `webhookAktion` wird
  `versiegeln` zu „Bestellung speichern“. `customers/redact` und `shop/redact` löschen echte
  Daten, `customers/data_request` kann echte Auskunft liefern.
- **Bleibt unverändert:** der Rechenkern, die gesamte OAuth-/HMAC-/state-/Token-Logik.
- **Wird ersetzt:** `js/shopify-import.js` durch einen Server-Adapter, sobald der Umbau
  serverseitige Buchungstabellen hat. Die Obergrenze „Erstattung ≤ noch offener Betrag“
  (heute in `Retouren.buche`) muss der Server-Adapter dann selbst prüfen, in einer
  Transaktion (Postgres-Funktion, Entscheidung E3: keine supabase-js-Abhängigkeit, alles per RPC
  über `api/_db.js`).

### Schnitt in Stufen

**Stufe 1 — jetzt baubar, unabhängig vom Ledger-Umbau** (live erst mit Partner-Account):
1. Migration `integrations` (user_id, company_id, shop, token_chiffrat, scopes, status,
   installiert_am, deinstalliert_am; ein Eintrag pro Shop, unique `shop`) und
   `shopify_eingang` (shop, order_id, payload jsonb, empfangen_am, verarbeitet_am, status,
   gruende). RLS an, Zugriff nur über Postgres-Funktionen. Muster: vorhandene Migrationen.
2. Endpunkte: `api/shopify-install.js`, `api/shopify-callback.js`, `api/shopify-webhook.js`
   (ein Endpunkt für alle Themen, Thema aus `X-Shopify-Topic`). **Jeder neue Endpunkt und jede
   CSP-Zeile in `vercel.json` (pro Route, nie global) vorher mit dem User abstimmen.**
3. Install: nur mit eingeloggtem Whop-Nutzer; `state` trägt Nutzer und Firma (signiert),
   Nonce-Cookie `HttpOnly; Secure; SameSite=Lax`. Callback: HMAC → state → Shop-Domain →
   Token holen → `scopesPassen` → Token verschlüsselt in `integrations` → Webhooks per GraphQL
   registrieren (`webhookSubscriptionCreate`) → Redirect in die App.
4. Webhook: Rohbody lesen (vor jedem JSON-Parse; prüfen, dass Vercel den Body nicht schon
   parst), HMAC prüfen, `webhookAktion`, Bestellung idempotent in `shopify_eingang`
   (upsert über shop + order_id), sofort 200. Keine Payloads loggen (`api/_log.js` nur mit
   Status/IDs).
5. Pflicht-Webhooks wirklich ausführen: `shop/redact` → Integration + Eingang des Shops löschen;
   `customers/redact` → Eingangs-Einträge der genannten Bestellungen löschen;
   `customers/data_request` → Vorgang protokollieren, Auskunft gibt der Händler.
   `app/uninstalled` → Token löschen, Status `deinstalliert`.
6. Erstimport per GraphQL (`BESTELL_QUERY`, seitenweise, `API_VERSION` gegen Dev-Store prüfen)
   in denselben Eingang.

**Stufe 2 — Buchen.** Zwei Möglichkeiten, **User fragen, bevor gebaut wird:**
- **B1 Brücke:** Browser holt offene Einträge aus `shopify_eingang` (neuer GET-Endpunkt, nur
  eigene Shops), bucht mit dem vorhandenen `js/shopify-import.js` lokal, meldet „verarbeitet“
  zurück. Geht sofort, wird nach dem Umbau ersetzt.
- **B2 Server-Adapter:** wartet auf die serverseitigen Buchungstabellen des Umbaus; bucht im
  Webhook bzw. per Job mit dem Kern in Node.

**Stufe 3 — Oberfläche:** Einstellungen „Shopify verbinden“ (Shop-Domain eingeben → Install),
Status, Trennen; Liste „Prüfen“ für Bestellungen mit `status: 'pruefen'` samt Gründen;
Auszahlungsabgleich-Ansicht.

### Offene Entscheidungen (User)

- **Vertriebsart der App** — nach Wahl nicht mehr änderbar. Custom-Distribution = nur EIN Shop
  (oder eine Plus-Organisation); für mehrere Kunden-Shops ist Public nötig (mit Shopify-Review,
  auch ohne Listing). Ob „unlisted“ ohne Shopify-Billing geht, steht nicht in der offiziellen
  Doku. Empfehlung: Dev-Store mit Custom-App zum Testen, Produktiv-App als Public.
- **Abrechnung:** Im App Store ist Shopify-Billing Pflicht (Req. 1.2/1.2.1), kollidiert mit
  Whop. Ohne Listing klären, ob Shopify das verlangt.
- **Stufe 2:** B1 oder B2.

### Braucht Partner-Account / Development Store (legt der User an, Punkt 0.4)

- Client-ID/Secret, Redirect-URL eintragen, Env `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`,
  `SHOPIFY_TOKEN_KEY` (32 Byte base64) — trägt der User in Vercel ein (Sensitive).
- Scopes `read_orders`, `read_shopify_payments_payouts` live prüfen; `read_all_orders`
  (älter als 60 Tage) und Protected Customer Data (Lieferland) bei Shopify beantragen.
- Pflicht-Webhooks in der App-Konfiguration hinterlegen; echter HMAC-Rundweg.
- Feldnamen der GraphQL-Abfrage (`OrderTransaction.fees`, `refunds`, `API_VERSION`) gegen
  echte Antworten prüfen; Testbestellungen inkl. Erstattung, §25a-Artikel, EU-Ausland.

### Recht (vor Livegang)

Datenschutzerklärung + Verarbeitungsverzeichnis: Shopify als Datenquelle, welche Felder
(Bestell-/Positionsdaten, Lieferland; keine Namen/E-Mails), Löschfristen des Eingangs.
AGB: Haftung für Importe. Das hängt am Rechtsteil des Server-Umbaus — dort abstimmen.

### Regeln für diese Session

- Buchungsregeln nicht ändern; neue Steuer-/Buchungsfragen vorher fragen.
- Keine neue Abhängigkeit (nur `node:crypto`, `fetch`).
- Pfad-gescoped committen (`git commit -F <msg> -- <dateien>`), `git status` direkt davor,
  nicht pushen ohne Auftrag. Parallel-Sessions im selben Working Tree.
- Neue Logik in Fachmodule, nicht in `js/app.js`, `js/store.js`, `js/lager.js`.
- Tests in `test/`, Exit-Code ≠ 0 bei Fehler; vor dem Commit die ganze Schleife laufen lassen.
- Kein Login durch Claude, kein Dev-Bypass fürs Whop-Gate.

### Fertig heißt

Stufe 1 komplett mit Tests (Endpunkte mit gemocktem `fetch` und gemockter DB, Muster:
`test/test-api-sync.js`, `test/_mini-redis.js`), committet; Entscheidung zu Stufe 2 eingeholt;
Liste der Punkte, die nur mit Partner-Account prüfbar sind, aktualisiert.
