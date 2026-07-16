# Prompt für neue Session (copy-paste) — W3: Make.com-Webhook-API

---

Ziel: Stackr soll Events als Webhooks feuern, die der User selbst in Make.com als
Custom-Webhook (HTTP-Modul) einbindet — KEIN offizieller Make.com-App-Eintrag, nur eine
belastbare Webhook/REST-Schnittstelle.

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im selben Ordner. Vor jedem
Edit die Datei frisch lesen; nur eigene Dateien stagen. Nicht deployen — das macht der User.

## Aufgaben

1. Kläre mit dem User (kurze Rückfrage reicht) die ersten 2-3 konkreten Trigger-Events —
   Vorschlag: neue Einnahme erfasst, neue Rechnung erstellt, neuer Eigenbeleg erfasst. Nicht
   mehr für den ersten Wurf versuchen.

2. Architektur-Realitätscheck ZUERST: Stackr ist local-first (Daten primär im
   Browser/localStorage bzw. IndexedDB, nicht durchgehend serverseitig). Ein Webhook kann nur
   für Daten ausgelöst werden, die durch Cloud-Sync ohnehin am Server (Upstash Redis /
   Vercel Blob, siehe `api/sync.js`) landen. Rein lokale, nie-synchte Nutzer können
   serverseitig nichts triggern — das ist eine bewusste Limitation, kein Bug. Lies
   `api/sync.js` und Memory `cloud-sync-backend.md` / `cloud-sync-blob-architecture.md` bevor
   du baust.

3. Baue einen minimalen Serverless-Endpoint (z. B. `api/webhooks.js`), der bei
   Cloud-Sync-Push-Events (`api/sync.js`) konfigurierte Ziel-URLs (vom User in den
   Einstellungen hinterlegt) mit einem simplen JSON-Payload benachrichtigt. HMAC-Signatur
   für die Payload-Verifikation nicht vergessen (Secret pro User/Firma, damit der Empfänger
   die Authentizität prüfen kann).

4. Einstellungs-UI: Feld für Webhook-URL(s) pro Event-Typ, Test-Button ("Test-Payload
   senden").

5. Rate-Limiting/Fehlerbehandlung: Eine nicht erreichbare Ziel-URL darf den eigentlichen
   Sync-/Speichervorgang nicht blockieren (fire-and-forget mit Timeout, kein Retry-Sturm).

## Akzeptanz

Mindestens 1 Event-Typ End-to-End mit einer echten Make.com-Webhook-URL getestet (User
liefert Test-URL aus einem Make.com-Szenario), committet, nicht deployt.

**Fallback, falls die Zeit nicht reicht:** Architektur-Entscheidung + offene Punkte in
`plan/make-com-webhook-spec.md` festhalten statt halbfertig zu committen. Ein sauberer
Architektur-Doc-Abschluss ist besser als ein halbfertiger Endpoint im Code.
