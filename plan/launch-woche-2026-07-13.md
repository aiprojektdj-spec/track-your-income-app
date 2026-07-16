# Launch-Woche bis Sonntag 2026-07-19 — Web 1.7

Neue Punkte vom User (2026-07-13), zusätzlich zu den offenen P0-Punkten in
`plan/launch-prompts.md`. Reihenfolge unten = empfohlene Bearbeitungsreihenfolge
diese Woche. Jeder Block ist ein self-contained Copy-Paste-Prompt für eine frische Session.

WICHTIG (geteiltes Repo): Evtl. arbeitet eine Parallel-Session im selben Ordner.
Vor jedem Edit die Datei frisch lesen; nur eigene Dateien stagen. Nicht deployen —
das macht der User.

---

## W1 · Onboarding-Fix — "Ich habe schon eine Firma"-Option + Cloud-Sync (kritisch, Bug)

```
Kontext (bereits recherchiert, nicht neu suchen): Das Cloud-Sync-Icon (#cloudSyncDot)
sitzt im globalen Auth-Widget (js/whop-auth.js), nicht im Onboarding-Wizard selbst.
Klick öffnet CloudSync.openPanel() → enableFlow() (js/cloud-sync.js). LS_ENABLED ist
EIN globaler Flag (nicht pro Firma), Sync-Scope = CompanyManager.getActiveId(). Der
Onboarding-Wizard (js/app.js, _renderOnboarding/_finishOnboarding ab Zeile ~1220) hat
aktuell KEINE Option "ich habe schon eine Firma" — er zwingt in jedem Fall durch die
komplette Neuanlage-Strecke (Schritt 1-6), bevor man überhaupt aufs Dashboard kommt.

Gewünschtes Verhalten (User-Vorgabe): Ganz am Anfang des Onboardings soll eine Option
"Ich habe schon eine Firma" stehen. Wählt man sie, kommt man DIREKT aufs Dashboard
(kein Pflicht-Durchlauf der Neuanlage-Schritte) und kann von dort aus Cloud-Sync
aktivieren. Muss von der Logik her tatsächlich funktionieren — nicht nur UI-Attrappe.

Offener Punkt, den du zuerst mit dem User klären/entscheiden musst (war in der
Vorab-Klärung nicht eindeutig): Bedeutet "das Ganze ohne Firma nutzen können" nur,
dass der Onboarding-WIZARD übersprungen wird (eine Firma existiert ja lokal schon,
wird nur nicht neu angelegt) — oder soll das Dashboard auch OHNE jedes Firmenprofil
nutzbar sein (z.B. nur um sich per Wiederherstellungscode mit bestehendem Cloud-Sync
zu verbinden und Daten vom anderen Gerät zu holen, bevor überhaupt eine Firma da ist)?
Frag den User das explizit, bevor du Variante 2 baust — sie hat größere Auswirkungen
auf CompanyManager/Store (die an "es gibt eine aktive Firma" hängen).

Aufgaben:
1. ERST ANALYSIEREN, NICHT SOFORT FIXEN: Lies js/app.js (Onboarding-Rendering/-Flow),
   js/companies.js (CompanyManager, wie eine Firma als "aktiv" markiert wird, was
   passiert wenn keine Firma existiert) und js/cloud-sync.js (enableFlow, _activeScope,
   _isPro-Gate). Kläre die Root-Cause: Warum gibt es aktuell keinen "ich hab schon eine
   Firma"-Ausstieg, und was würde beim Dashboard-Rendering/den anderen Modulen brechen,
   wenn man den Wizard überspringt (z.B. CompanyManager.getActiveId() liefert nichts)?
2. Kläre den offenen Punkt oben mit dem User (kurze Rückfrage reicht, keine Grundsatz-
   diskussion nötig) BEVOR du Variante "ganz ohne Firmenprofil" umsetzt.
3. Baue den Fix:
   a) Neue Option am Anfang des Onboarding-Wizards: "Ich habe schon eine Firma" →
      Wizard wird übersprungen (kein Pflicht-Durchlauf Schritt 1-6), Nutzer landet
      direkt auf dem Dashboard mit der bereits bestehenden, lokal angelegten Firma.
   b) Stelle sicher, dass Cloud-Sync von dort aus (über das bestehende cloudSyncDot-
      Icon/Panel) tatsächlich sauber für diese Firma aktivierbar ist — kein Zwang,
      eine zweite/neue Firma anzulegen, kein Datenverlust.
4. Rand-/Regressionscheck: Der normale "neue Firma anlegen"-Pfad (kompletter Wizard)
   muss unverändert weiter funktionieren. onboardingDone-Flag korrekt gesetzt, damit
   der Wizard beim nächsten Start nicht erneut aufpoppt.

Kein Browser-Verifikation in dieser Session nötig (User testet selbst) — aber Code
so sauber wie möglich hinterlassen (keine halbfertigen Pfade), da nicht live getestet
wird bevor committet ist.

Akzeptanz: "Ich habe schon eine Firma"-Option im Onboarding vorhanden und führt direkt
zum Dashboard; Cloud-Sync von dort aktivierbar; bestehender Neuanlage-Pfad unverändert;
offener Punkt (Firma-Pflicht ja/nein) mit User geklärt und im Commit-Message/Kommentar
festgehalten, committet.
```

---

## W2 · Schweiz/Österreich-Modul komplett aus Web 1.7 entfernen (nicht Local!)

```
Web 1.7 soll vorerst NUR deutsches Steuersystem anbieten. Die CH/AT-Module
(js/schweiz.js, js/oesterreich.js, js/svs.js — falls AT-spezifisch) bleiben im
Code erhalten (nicht löschen, nur deaktivieren/ausblenden), damit "Local 1.7"
(die parallele Variante, siehe Memory stackr-project-layout.md) sie behalten kann.
NUR in Web 1.7 (diesem Repo/Branch) entfernen — Local 1.7 NICHT anfassen.

Aufgaben:
1. Finde alle CH/AT-Einstiegspunkte: Länder-Auswahl bei Firma-Anlage (js/companies.js),
   Menüpunkte/Nav-Einträge (js/topnav.js, js/page-shell.js), Badges/Hinweise in
   js/dashboard.js, js/euer.js, js/ustvoranmeldung.js, js/vorsteuer.js, js/oss.js,
   Referenzen in app.html.
2. Entferne/versteckt (Feature-Flag oder simple Bedingung, kein Löschen der Dateien):
   - Land-Auswahl bei neuer Firma → nur noch Deutschland wählbar (kein CH/AT-Radio/Dropdown).
   - Alle CH/AT-spezifischen Menüpunkte, Badges, Info-Kästen im UI ausblenden.
   - Rechenlogik-Pfade, die CH/AT-Land prüfen (grep 'schweiz', 'oesterreich', 'österreich',
     "'CH'", "'AT'"), so absichern, dass sie in Web 1.7 nie erreicht werden (da eh keine
     CH/AT-Firma mehr anlegbar ist) — nicht die Funktionen selbst löschen.
3. Bestandsschutz prüfen: Falls in Produktion bereits echte CH/AT-Kunden existieren
   (mit mir/User klären, bevor du hart sperrst!) — deren bestehende Firma darf nicht
   plötzlich kaputtgehen, auch wenn Neuanlage gesperrt ist.
4. Browser-Smoke: Neue Firma anlegen → nur Deutschland wählbar, alle DE-Flows
   (EÜR, UVA, Rechnungen) unverändert funktionsfähig.

Akzeptanz: CH/AT in Web 1.7 UI nicht mehr erreichbar, Local 1.7 unangetastet,
DE-Flow verifiziert, committet mit klarer Message ("Web 1.7: CH/AT vorerst deaktiviert,
Local 1.7 unberührt").
```

---

## W3 · Make.com Webhook-API (Automationen)

```
Ziel: Stackr soll Events als Webhooks feuern bzw. Endpunkte bereitstellen, die der
User selbst in Make.com als Custom-Webhook (HTTP-Modul) einbindet — KEIN offizieller
Make.com-App-Eintrag, nur eine belastbare Webhook/REST-Schnittstelle.

Aufgaben:
1. Kläre mit dem User die ersten 2-3 konkreten Trigger-Events (Vorschlag: neue Einnahme
   erfasst, neue Rechnung erstellt, neuer Eigenbeleg erfasst) — nicht mehr für diese Woche.
2. Architektur: Da Stackr lokal-first ist (Daten primär im Browser/localStorage, nicht
   durchgehend serverseitig), prüfe wie ein Webhook überhaupt ausgelöst werden kann —
   vermutlich nur für Daten, die durch Cloud-Sync ohnehin am Server (Upstash) landen
   (api/sync.js). Rein lokale, nie-synchte Nutzer können serverseitig nichts triggern.
3. Baue einen minimalen Serverless-Endpoint (z.B. api/webhooks.js) der bei Cloud-Sync-
   Push-Events (api/sync.js) konfigurierte Ziel-URLs (vom User in den Einstellungen
   hinterlegt) mit einem simplen JSON-Payload benachrichtigt. Secret/Signatur (HMAC)
   für die Payload-Verifikation nicht vergessen.
4. Einstellungs-UI: Feld für Webhook-URL(s) pro Event-Typ, Test-Button ("Test-Payload senden").
5. Rate-Limiting/Fehlerbehandlung: Ziel-URL nicht erreichbar darf den eigentlichen
   Sync/Speichervorgang nicht blockieren (fire-and-forget mit Timeout).

Akzeptanz: Mindestens 1 Event-Typ End-to-End mit einer echten Make.com-Webhook-URL
getestet (User liefert Test-URL aus einem Make.com-Szenario), committet, nicht deployt.
Falls die Woche nicht reicht: Architektur-Entscheidung + offene Punkte in
plan/make-com-webhook-spec.md festhalten statt halbfertig zu committen.
```

---

## W4 · UI-Politur (separate Session, interaktiv)

```
Der User will die UI an mehreren Stellen "hübscher" machen, weiß aber selbst noch
nicht abschließend wo — das soll in einer eigenen, interaktiven Session passieren
(nicht blind draufloseditieren). Alle App-Bereiche sind grundsätzlich Kandidaten
(Onboarding, Dashboard, Rechnungen/Lager/Eigenbelege, Landing).

Vorgehen für diese Session:
1. Starte den Preview-Server, geh mit dem User gemeinsam Screen für Screen durch
   (oder lass ihn Screenshots/Beschreibungen liefern) und sammle konkrete Punkte,
   BEVOR irgendwas editiert wird.
2. Halte dich an das bestehende Design-System (Memory stackr-ui-v2-design-brief.md,
   "Ruhige Souveränität", dark+emerald, styleguide.html) — keine neue Design-Sprache
   einführen, nur bestehende Patterns konsequenter anwenden.
3. Änderungen klein und einzeln verifizierbar halten (Edge-Browser, nie Chrome/Firefox/Opera —
   siehe Memory feedback-browser-edge.md), nach jedem Punkt Screenshot zum Abgleich.
4. Am Ende: kurze Vorher/Nachher-Liste, committet.
```

---

## Nicht-Prompt-Punkt (macht der User selbst)

- **Weitere Test-Kunden:** User akquiriert zusätzliche Test-Kunden diese Woche —
  kein Code-Task. Sobald Feedback da ist, kann eine QA/Bugfix-Session daraus entstehen.

---

## Bezug zu bestehenden P0-Punkten

Die oben genannten Punkte kommen ZUSÄTZLICH zu den offenen P0s in
`plan/launch-prompts.md` (P0-2 USt-Verifikation, P0-3 Cloud-Sync-2-Profil-Test,
P0-4 QA-Sweep, P0-5 Security-Finalcheck, P0-6 Anwalts-Paket). Empfohlene Reihenfolge
diese Woche, falls Kapazität knapp ist:
1. W1 (Onboarding-Bug, kritisch — betrifft jeden Neukunden mit Cloud-Sync-Wunsch)
2. W2 (CH/AT raus — reduziert Scope/Verwirrung vor Launch)
3. P0-2, P0-3, P0-4, P0-5 (bestehende Launch-Blocker, unverändert)
4. W3 (Make.com) und W4 (UI-Politur) — beide eher P1, nach den kritischen Punkten,
   W3 notfalls nur als Architektur-Doc abschließen statt zu erzwingen.
5. P0-6 (Anwalts-Paket) läuft parallel, hängt eh am externen Anwalt-Feedback.
