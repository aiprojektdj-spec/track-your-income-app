# Cloud-Sync (E2E) — Setup & Test

Optionaler, Ende-zu-Ende-verschlüsselter Sync zwischen Geräten desselben Whop-Nutzers.
Offline-First bleibt unangetastet: ohne Aktivierung passiert nichts.

## Architektur (kurz)
- **Server:** `api/sync.js` (Vercel Serverless). Validiert das Whop-User-Token server-seitig
  über `/oauth/userinfo` (leitet UserID ab), erzwingt Pro via App-API-Key gegen
  `/v5/app/memberships?user_id=…&valid=true` (`WHOP_API_KEY`).
  Speichert **nur Chiffrat** + Metadaten. CAS per Lua-`EVAL` (Versions-Vergleich) → 409 bei Konflikt.
- **Store:** **Upstash Redis (REST), Region `eu-central-1` / Frankfurt** → EU-Datenresidenz.
  Keys: `sync:<userId>:<scope>` (scope = `__account` | `co_<id>`), Rate-Limit `sync:rl:<userId>`.
- **Client:** `js/cloud-sync.js`. Schlüssel = 256-bit `getRandomValues`, **nur lokal**
  (`oyi_sync_key_<userId>`), nie hochgeladen. AES-GCM. pull → entschlüsseln → mergen (LWW pro Record,
  Audit-Log Union + Re-Chain) → verschlüsseln → push (bei 409: pull-merge-retry).
- **Granularität:** 1 verschlüsselter Snapshot je Scope, Merge pro-Record im Client (siehe Kopf von `cloud-sync.js`).
- **Multi-Firma:** `__account` synct die Firmen-Registry (gleiche IDs auf allen Geräten),
  danach je Firma ein Scope. Frisches Gerät verbindet → Registry adoptieren → Daten ziehen.

## Vercel-ENV
Eingerichtet via **Vercel → Storage → Upstash for Redis** (Marketplace), DB
`upstash-kv-cyan-globe`, Region **fra1 (Frankfurt, EU)**, Plan Free, verbunden mit
Projekt `track-your-income-app` (Production + Preview). Die Integration legt diese
ENV-Vars automatisch an — Token wird nie manuell eingetragen:
```
KV_REST_API_URL          = https://<...>.upstash.io   # von Integration gesetzt
KV_REST_API_TOKEN        = <RW-REST-Token>            # von Integration gesetzt (Sensitive)
WHOP_APP_ID              = app_dc3OND8eGv2Iim          # optional, default gesetzt
SYNC_OWNER_USERNAMES     = secondlifevintage41         # optional, Owner ohne Abo
```
`api/sync.js` liest `KV_REST_API_URL/TOKEN` (Fallback: `UPSTASH_REDIS_REST_URL/TOKEN`,
falls man die DB manuell statt über die Integration anlegt).

CSP unverändert nötig: der Browser spricht nur mit `/api/sync` (`connect-src 'self'`);
die Function spricht server-seitig mit Upstash.

## Deploy (durch dich, nicht automatisch erledigt)
`api/sync.js` ist erst live, wenn der Branch deployt ist. ENV-Vars greifen ab dem
nächsten Deployment. Produktion = `master`: `feature/cloud-sync` → `master` mergen
und pushen (Vercel deployt automatisch). Oder Branch pushen → Preview-URL testen.

## Unit-Test (reine Logik)
```
node test-cloud-sync.js
```
Prüft Base32-Roundtrip, LWW-Record-Merge, Tombstone, Audit-Union + deterministisches Re-Chaining
(verifyAuditChain gültig). Muss `4/4 ✅` zeigen.

## E2E-Test (2 Browserprofile, gleiches Whop-Pro-Konto)
Voraussetzung: `api/sync.js` auf Vercel deployt + ENV gesetzt; beide Profile mit Whop Pro angemeldet.

1. **Aktivieren (Profil A):** ☁-Punkt (oben rechts) → „Cloud-Sync aktivieren" →
   Wiederherstellungscode notieren → Checkbox + letzte zwei Gruppen eingeben → Aktivieren.
   Erwartung: Punkt wird grün („aktiv"), erster Push erfolgt.
2. **Verbinden (Profil B):** ☁ → „Mit bestehendem Sync verbinden" → Code aus A eingeben →
   Test-Entschlüsselung ok → Pull+Merge. Erwartung: nach kurzer Zeit **gleicher Datenstand** wie A.
3. **Paralleles Anlegen:** in A einen Verkauf, in B einen anderen Einkauf anlegen. Kurz warten
   (Auto-Push ~6 s) bzw. ☁ → „Jetzt synchronisieren". Erwartung: **beide Records auf beiden Geräten**.
4. **Konflikt:** denselben Record auf A und B unterschiedlich bearbeiten, beide syncen.
   Erwartung: der **neuere `updatedAt` gewinnt**, kein Crash, kurzer Hinweis-Toast.
5. **Soft-Delete:** Record in A stornieren, syncen. Erwartung: in B ebenfalls storniert (Tombstone gewinnt).
6. **Audit-Kette:** in der App `Store.verifyAuditChain()` in der Konsole → `{ valid: true }`
   auf **beiden** Geräten nach Merge.
7. **E2E-Beweis (Netzwerk):** DevTools → Network → Request an `/api/sync` mit `action:"push"`
   öffnen → Body enthält nur `ciphertext` (Base64) + `iv` + `version` + `deviceId`.
   Suchtest: einen markanten Buchungstext (z.B. Kundennamen) im Request-Body suchen →
   **darf nicht vorkommen**. Optional: `sync:<userId>:<scope>` in Upstash ansehen → nur Chiffrat.
8. **E2E-Beweis (fremder Client):** in einem dritten Profil **ohne Code** anmelden → „Verbinden"
   mit falschem/keinem Code → kein Klartext-Zugriff (Entschlüsselung schlägt fehl).
9. **Art. 17 (Löschung):** In Profil A „Geschäftsdaten löschen" für eine Firma ausführen
   (ruft `CloudSync.deleteRemote(scope)`). Erwartung: Network zeigt `action:"delete"` für den
   Scope; in Profil B holt der nächste Sync die gelöschten Daten **nicht** zurück
   (kein LWW-Resurrect). Optional in Upstash: Key `sync:<userId>:<scope>` ist weg.
10. **Deaktiviert = wie heute:** Sync deaktivieren → App verhält sich exakt wie ohne Feature.
11. **Recovery:** Profil A: Browserdaten löschen → neu anmelden → „Verbinden" mit
    Wiederherstellungscode → voller Datenstand zurück.

## Automatisiert verifiziert (Mock, 2026-07-07)
Ohne Backend/Whop-Konto per Browser-Konsole nachgestellt (fetch-Mock für `/api/sync`,
Fake-User + lokal generierter Key). Ergebnisse gegen `js/cloud-sync.js` (Stand Phase-C-Branch):

- **Sync-Roundtrip:** `syncNow()` → `pull` je Scope, danach `push` mit `{action, scope, version,
  ciphertext, iv, deviceId}` und `Authorization: Bearer <token>`. ✅
- **Verschlüsselung:** Push-Payload ist reines Base64-AES-GCM-Chiffrat, kein Klartext-Leak
  (JSON-Marker `keys`/`meta` nicht im Chiffrat). Unabhängige Entschlüsselung mit dem lokalen
  Key (WebCrypto, ohne CloudSync-Code) ergibt `{v:1, keys, meta}`. ✅
- **Art. 17:** `CloudSync.deleteRemote(scope)` sendet `action:"delete"`, entfernt den Server-Blob
  und die lokalen Sync-Metadaten (`oyi_sync_keymeta_<scope>`); Folge-Sync legt sauber neu an. ✅
- **Nicht automatisiert abgedeckt:** 409-Konflikt-Retry (braucht echte parallele Datenänderung
  auf 2 Geräten → Schritt 4 oben), echte Whop-Token-Validierung + Pro-Gate (Server-seitig,
  Smoke-Test siehe unten), Upstash-Persistenz.

Mock-Testscript zum Nachfahren (DevTools-Konsole auf app.html, VOR dem Test: Profil ohne
echte Daten verwenden; danach Seite neu laden):
```js
// 1) Fake-Identität + Key
const uid='user_TEST'; localStorage.setItem('whop_user', JSON.stringify({id:uid}));
localStorage.setItem('whop_access_token','FAKE'); localStorage.setItem('oyi_sync_enabled','1');
localStorage.setItem('oyi_sync_key_'+uid, btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
UserPlan.isPro = () => true;
// 2) Fake-Server
const store={}, log=[]; const orig=window.fetch;
window.fetch=(u,o)=>{ if(String(u).indexOf('/api/sync')<0) return orig(u,o);
  const b=JSON.parse(o.body); log.push(b.action+':'+b.scope);
  let r={ok:true},s=200;
  if(b.action==='pull') r={blob:store[b.scope]||null};
  else if(b.action==='push'){ const c=store[b.scope];
    if(c&&c.version!==b.version){s=409;r={error:'conflict'};}
    else store[b.scope]={ciphertext:b.ciphertext,iv:b.iv,version:(b.version||0)+1}; }
  else if(b.action==='delete') delete store[b.scope];
  return Promise.resolve(new Response(JSON.stringify(r),{status:s})); };
// 3) Roundtrip + Inspektion
CloudSync.syncNow(); setTimeout(()=>console.log(log, store), 4000);
// 4) Art. 17
CloudSync.deleteRemote('__account').then(ok=>console.log('delete ok:',ok,'blob weg:',!store['__account']));
```

## Server-Smoke-Test (Production, ohne Login)
```
GET  https://track-your-income-app.vercel.app/api/sync      → 405
POST … ohne Authorization                                   → 401 no_token
POST … mit Fake-Bearer                                      → 401 invalid_token
OPTIONS …                                                   → 200 (CORS)
```
(Bestanden 2026-06-25; erneut bestanden 2026-07-07: 405/401/401/200.)

## Bekannte v1-Grenzen (ponytail-Ceilings, dokumentiert im Code)
- Snapshot-pro-Scope statt per-Record-Keys → bei sehr großen Datenmengen ggf. auf per-record-keys umstellen.
- Zwei Geräte, die **offline je eigene Firmen** anlegen und erst danach syncen → doppelte Firmen
  (unterschiedliche lokale IDs). Sauberer Pfad: erst „Verbinden", dann arbeiten.
- LWW nach Wanduhr (`updatedAt`): starke Uhr-Drift zwischen Geräten kann den „falschen" Gewinner wählen.
- Aktive Firma wird bei Remote-Änderung beim Start neu geladen (`location.reload`); bei Konflikt-Re-Pull nur Toast.
