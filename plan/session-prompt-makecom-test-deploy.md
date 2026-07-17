# Prompt für neue Session (copy-paste) — W3-Abschluss: Make.com-Test + Deploy

## ✅ ERLEDIGT (2026-07-17)

E2E-Test für Event-Typ `einnahme` mit echter Make.com-Webhook-URL
(`https://hook.eu1.make.com/psvjyzl3...`) durchgeführt: `Webhooks.test()` lieferte
HTTP 200, Make.com zeigte „3 values detected and ready to map" (event/ts/data) im
Custom-Webhook-Modul. Test lief per Browser-Konsole direkt gegen `Webhooks.test()`
(gleicher Code-Pfad wie der Settings-Test-Button), da der lokale Python-Static-Server
keinen echten Whop-OAuth-Roundtrip kann (`/api/whop-access` fehlt ohne `vercel dev`).
Code (4cbd40d) war zum Testzeitpunkt bereits auf `origin/master` — kein weiterer Push
nötig.

---

Kontext: `js/webhooks.js` + Settings-UI + 3 Trigger-Punkte (Einnahme/Rechnung/Eigenbeleg)
sind fertig gebaut und committet (4cbd40d, siehe Memory `makecom-webhooks.md`). Noch offen:
echter End-to-End-Test mit einer echten Make.com-Webhook-URL, dann Push/Deploy.

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im selben Ordner. Vor jedem
Edit die Datei frisch lesen; nur eigene Dateien stagen.

## Aufgaben

1. User bittet um eine Make.com-Webhook-URL aus einem echten Szenario (Custom-Webhook /
   HTTP-Modul, "Ziel-URL kopieren"). Falls User die URL noch nicht hat: kurz erklären wie
   man sie in Make.com erzeugt (neues Szenario → Webhooks-App → "Custom webhook" →
   "Add" → URL kopieren), dann warten.

2. Preview starten (`stackr-web-py`, Port 3366, oder je nach Setup), mit Whop einloggen,
   Einstellungen → Make.com-Webhooks öffnen, URL für mind. 1 Event-Typ eintragen,
   speichern, "Test" klicken.

3. Mit dem User im Make.com-Szenario verifizieren, dass die Test-Payload ankommt
   (Szenario-History/Bundle prüfen). Bei Fehlern: Netzwerk-Tab / Konsole prüfen (CSP
   `connect-src` wurde bereits um `https://*.make.com` erweitert — falls trotzdem CSP-Fehler,
   liegt es an einer abweichenden Make.com-Region-Domain, dann dort ergänzen).

4. Optional: einen echten Trigger auslösen (z. B. neue Einnahme anlegen) und prüfen, dass
   der Webhook automatisch feuert, nicht nur der manuelle Test-Button.

5. Nach erfolgreichem Test: `git push`. Vorher `git status`/`git log` zeigen und kurz
   bestätigen lassen, dass gepusht werden soll (Deploy macht Vercel automatisch beim Push
   auf den verbundenen Branch — falls das nicht gewünscht ist, vorher klären).

## Akzeptanz

Mindestens 1 Event-Typ End-to-End mit einer echten Make.com-Webhook-URL bestätigt
(Payload sichtbar im Make.com-Szenario), gepusht.

**Fallback, falls kein Zugriff auf ein Make.com-Konto verfügbar ist:** Bei der
Test-Button-Verifikation bleiben (HTTP-Status 200 vom `Webhooks.test()`-Call reicht als
Teilnachweis), Push zurückstellen, offenen Punkt in dieser Datei stehen lassen.
