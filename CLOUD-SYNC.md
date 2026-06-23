# Cloud-Sync (E2E) — Setup & Test

Optionaler, Ende-zu-Ende-verschlüsselter Sync zwischen Geräten desselben Whop-Nutzers.
Offline-First bleibt unangetastet: ohne Aktivierung passiert nichts.

## Architektur (kurz)
- **Server:** `api/sync.js` (Vercel Serverless). Validiert Whop-Bearer-Token server-seitig
  (`/v5/me` + `/v5/me/has-access`), leitet UserID server-seitig ab, erzwingt Pro.
  Speichert **nur Chiffrat** + Metadaten. CAS per Lua-`EVAL` (Versions-Vergleich) → 409 bei Konflikt.
- **Store:** **Upstash Redis (REST), Region `eu-central-1` / Frankfurt** → EU-Datenresidenz.
  Keys: `sync:<userId>:<scope>` (scope = `__account` | `co_<id>`), Rate-Limit `sync:rl:<userId>`.
- **Client:** `js/cloud-sync.js`. Schlüssel = 256-bit `getRandomValues`, **nur lokal**
  (`oyi_sync_key_<userId>`), nie hochgeladen. AES-GCM. pull → entschlüsseln → mergen (LWW pro Record,
  Audit-Log Union + Re-Chain) → verschlüsseln → push (bei 409: pull-merge-retry).
- **Granularität:** 1 verschlüsselter Snapshot je Scope, Merge pro-Record im Client (siehe Kopf von `cloud-sync.js`).
- **Multi-Firma:** `__account` synct die Firmen-Registry (gleiche IDs auf allen Geräten),
  danach je Firma ein Scope. Frisches Gerät verbindet → Registry adoptieren → Daten ziehen.

## Vercel-ENV (EU-Region wählen!)
```
UPSTASH_REDIS_REST_URL   = https://<...>.upstash.io        # Upstash-DB in eu-central-1 anlegen
UPSTASH_REDIS_REST_TOKEN = <REST-Token>
WHOP_APP_ID              = app_dc3OND8eGv2Iim              # optional, default gesetzt
SYNC_OWNER_USERNAMES     = secondlifevintage41             # optional, Owner ohne Abo
```
CSP unverändert nötig: der Browser spricht nur mit `/api/sync` (`connect-src 'self'`);
die Function spricht server-seitig mit Upstash.

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
7. **E2E-Beweis:** in einem dritten Profil **ohne Code** anmelden → „Verbinden" mit falschem/keinem
   Code → kein Klartext-Zugriff (Entschlüsselung schlägt fehl). Optional: `sync:<userId>:<scope>` in
   Upstash ansehen → nur Chiffrat sichtbar.
8. **Deaktiviert = wie heute:** Sync deaktivieren → App verhält sich exakt wie ohne Feature.

## Bekannte v1-Grenzen (ponytail-Ceilings, dokumentiert im Code)
- Snapshot-pro-Scope statt per-Record-Keys → bei sehr großen Datenmengen ggf. auf per-record-keys umstellen.
- Zwei Geräte, die **offline je eigene Firmen** anlegen und erst danach syncen → doppelte Firmen
  (unterschiedliche lokale IDs). Sauberer Pfad: erst „Verbinden", dann arbeiten.
- LWW nach Wanduhr (`updatedAt`): starke Uhr-Drift zwischen Geräten kann den „falschen" Gewinner wählen.
- Aktive Firma wird bei Remote-Änderung beim Start neu geladen (`location.reload`); bei Konflikt-Re-Pull nur Toast.
