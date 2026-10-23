# Shopify-Livetest — Checkliste für 2026-10-24

Stand 2026-10-23, gegen Code und Supabase geprüft. Vor dem Abarbeiten `git log --oneline -5` und
`git status --short` ansehen: Daran arbeiten parallel andere Sessions.

## Was schon steht

- Shopify: Partner-Org, Dev-Store `stackr-test` (Basic, Testdaten), App **Stackr**
  (Vertrieb Public, nicht eingereicht). Config `stackr-1`: App-URL `https://getstackr.de/app.html`,
  nicht eingebettet, älterer Installationsablauf, Redirects
  `https://getstackr.de/api/shopify-callback` und
  `https://track-your-income-app.vercel.app/api/shopify-callback`,
  Scopes `read_orders,read_shopify_payments_payouts`.
- Code: `6dba391` (Install, Callback, Webhook, Migration) ist **schon live** (mitgepusht mit
  `1bed665`). Ohne Konfiguration lehnen die Endpunkte ab: Webhook 503, Install 503
  (`shopify_not_configured`), GET 405. Gemessen am 2026-10-23.
- **CSP: keine Änderung nötig.** Die drei Routen liefern JSON bzw. Weiterleitungen, der
  Browser ruft `/api/shopify-install` same-origin (`connect-src 'self'`), der Sprung zu
  `*.myshopify.com` ist eine Top-Level-Navigation.

## 1. Vercel-Variablen (User)

Projekt `track-your-income-app` → Settings → Environment Variables → **nur Production**:

| Name | Woher |
|---|---|
| `SHOPIFY_CLIENT_ID` | dev.shopify.com → Apps → Stackr → Übersicht → Anmeldedaten |
| `SHOPIFY_CLIENT_SECRET` | ebenda |
| `SHOPIFY_TOKEN_KEY` | Ausgabe von `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

Danach **Redeploy** der aktuellen Production (Deployments → letzte Production → Redeploy).
Ohne Redeploy sieht die laufende Fassung die neuen Variablen nicht.

## 2. Migration (User, Supabase SQL-Editor, Projekt `usrhhjwvoefjdgrwovkg`)

Stand 2026-10-23: In Prod ist als letzte `20261015000001_anker_unverdraengbar` eingespielt.

- Ausführen: **nur** `supabase/migrations/20261022000001_shopify.sql`.
- **Nicht** `20261022000002_server_datenmodell.sql`. Das ist R2 vom Server-Umbau und wird gerade
  noch bearbeitet. Achtung für später: Läuft `…000001` **nach** `…000002` erneut, fällt die
  Owner-Prüfung in `sync_shopify_integration_speichern` wieder weg (steht im Kopf von `…000002`).

## 3. Install-Test (User eingeloggt, Claude schaut zu)

Einen „Shopify verbinden“-Knopf gibt es noch nicht (UI ist Stufe 3 im Umbauplan). Für den Test
reicht die Browser-Konsole auf `https://getstackr.de/app.html`, eingeloggt, **Testfirma aktiv**:

```js
const t = await AuthUI.validToken();
const r = await fetch('/api/shopify-install', { method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
  body: JSON.stringify({ shop: 'stackr-test.myshopify.com', companyId: CompanyManager.getActiveId() }) });
const j = await r.json(); j.url ? (location.href = j.url) : console.log(r.status, j);
```

Erwartet: Shopify zeigt „App installieren“ mit den zwei Rechten → Installieren → Rücksprung auf
`/app?shopify=…`. Danach in Supabase prüfen: `integrations` hat eine Zeile für
`stackr-test.myshopify.com`, `token_chiffrat` gesetzt.

## 4. Bestellung durchspielen

Im Dev-Store eine Testbestellung mit dem Bogus Gateway anlegen (Testdaten sind eingeschaltet).
Erwartet: Zeile in `shopify_eingang`. Im Dev Dashboard → Stackr → Logs die Webhook-Zustellung
ansehen (200). In Stackr gebucht wird erst mit Stufe B2 und der UI. Heute geht es nur darum,
dass die Daten ankommen.

## Vor einem Review bei Shopify (nicht morgen)

- Compliance-Webhooks (`customers/data_request`, `customers/redact`, `shop/redact`) in der
  App-Konfiguration eintragen.
- Antrag „Protected customer data“ (Bestellungen enthalten Käuferdaten).
- `read_all_orders` beantragen, wenn mehr als 60 Tage importiert werden sollen.
