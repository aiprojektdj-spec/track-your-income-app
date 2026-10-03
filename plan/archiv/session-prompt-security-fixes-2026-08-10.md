# Prompt für neue Session: Security-Audit-Funde fixen (2026-08-10)

Kontext: Am 2026-08-10 wurde für Stackr Web 1.7 ein 4-teiliger Security-Audit gefahren
(/security-stackr, /red-team, /security-review, /accessibility). Ergebnis: 13 Funde,
sortiert nach Schweregrad. Arbeite sie in dieser Reihenfolge ab, committe nach jedem
logisch abgeschlossenen Fund einzeln (nicht alles in einen Mega-Commit).

## 🔴 KRITISCH — zuerst

**1. Whop-Paywall-Overlay ohne Fokus-Trap → Tastatur-Bypass der kompletten Paywall**
Dateien: `js/whop-auth.js:475-548` (`_showLoginScreen`, `_showNoMembershipScreen`),
`:340-362` (`_showDeviceLockedScreen`), `:585-609` (`#authUserMenu`)

Problem: Die Gate-Overlays legen sich nur visuell (`position:fixed`) über die App.
`<main class="main-content">` (app.html:209) bleibt tab-erreichbar — kein `aria-hidden`/
`inert`, kein `role="dialog"`, kein Fokus-Trap, kein ESC-Handler. Ein Nutzer ohne Abo kann
per Tab-Taste am sichtbaren Overlay vorbei in die dahinterliegende Buchhaltungs-App
gelangen und dort Elemente per Enter auslösen.

Fix: Referenzimplementierung existiert bereits im selben Repo in `js/app.js:395-424`
(Tab-Trap + ESC + `showModal`/`closeModal`, inkl. Fokus-Rückgabe ans auslösende Element).
Diese Logik 1:1 auf alle Gate-Overlays in `whop-auth.js` übertragen:
- `role="dialog"` + `aria-modal="true"` auf jedes Overlay
- `<main>` (oder `#app`) per `inert` bzw. `aria-hidden="true"` sperren, solange ein Gate aktiv ist
- Tab-Zyklus innerhalb des Overlays einfangen
- ESC schließt (falls das jeweilige Overlay überhaupt schließbar sein soll — bei
  Login-Pflicht-Screens ggf. bewusst kein ESC, aber dann muss Tab trotzdem im Overlay bleiben)

Verifikation: Im Browser (Edge, siehe Projektregel) ohne Maus nur mit Tab durch die Seite
navigieren, während ein Gate-Overlay sichtbar ist — der Fokus darf niemals auf Elemente
hinter dem Overlay springen.

## 🟠 HOCH

**2. Irreversible Gerätesperre-Löschung ohne Fokus-Verschiebung**
Datei: `js/whop-auth.js:375-378` (`_startDeviceReset`)

Fix: Nach dem Einblenden von `#waDeviceResetConfirm` den Fokus explizit setzen:
```js
document.getElementById('waDeviceResetInput')?.focus();
```
Aufwand: 5 Min.

*(Finding "Gate-Bypass via manipulierter /api/whop-access-Response" aus dem Red-Team-Audit
ist ein architektonischer Local-First-Tradeoff, siehe Notiz unten unter "Bewusst nicht
fixen" — hier NICHT versuchen zu patchen, nur zur Kenntnis nehmen.)*

## 🟡 MITTEL

**3. `delete`-Aktion in Cloud-Sync löscht die eigene GoBD-Beweiskette mit**
Datei: `api/sync.js:293-298`

Problem: `action === 'delete'` löscht sowohl `key` als auch `anchorKey` (die
Append-only-Hash-Kette, gedacht als externer Manipulationsnachweis für GoBD Rz. 64).
Ein Nutzer, der Buchungen nachträglich manipuliert hat, kann so seine eigene
Tamper-Evidence mit entfernen.

Fix: Bei `delete` den `anchorKey` NICHT löschen (enthält nur Hash+ID+Timestamp, keine
personenbezogenen Klardaten — DSGVO Art. 17 betrifft ihn nicht direkt). Alternativ: den
Löschzeitpunkt selbst als unlöschbaren "deletion-event"-Eintrag protokollieren.

**4. IP-Rate-Limiting potenziell per `X-Forwarded-For` spoofbar**
Dateien: `api/whop-token.js:33`, `api/sync.js:159`, `api/whop-access.js:153`

Problem: Alle drei Endpunkte nehmen ungeprüft den ersten Eintrag aus dem
`X-Forwarded-For`-Header als Client-IP für das Rate-Limiting.

Fix: Auf Vercels eigenen, vom Client nicht überschreibbaren Header umstellen
(`x-vercel-forwarded-for` statt des ersten `x-forwarded-for`-Segments). Prüfen, welcher
Header in der aktuellen Vercel-Runtime tatsächlich clientfest ist, und in allen drei
Dateien konsistent verwenden.

**5. User-Dropdown-Menü ohne ARIA-Semantik/ESC**
Datei: `js/whop-auth.js:585-619` (`#authUserMenu`)

Problem: Enthält sicherheitsrelevante Aktionen ("Abmelden", "Abo verwalten/kündigen",
Freigabe-Code kopieren), aber kein `role="menu"`/`role="menuitem"`, kein `aria-expanded`
am Trigger, kein Escape-Handler (Schließen nur via document-click-Listener).

Fix: `aria-expanded` am Trigger-Button togglen, `keydown`-Listener mit
`Escape → menu.remove() + Fokus zurück auf Trigger` ergänzen (Muster aus
`js/app.js:411-414` übernehmen). Aufwand ~20 Min.

**6. Landing-Page-Demo-Input ohne sichtbaren Fokus-Indikator**
Datei: `css/landing.css:544-557` (`.demo-inp`), genutzt in `index.html:277-278`

Problem: `outline:none` (Zeile 554) ohne Ersatz — nur `border-color`-Wechsel bei Fokus,
das ist bei 1px Border kaum wahrnehmbar (WCAG 2.4.7 verletzt).

Fix: Analog `css/style.css:1006` ergänzen:
```css
.demo-inp:focus { box-shadow: 0 0 0 3px var(--accent-glow); }
```
Aufwand: 5 Min.

## 🟢 NIEDRIG (nur falls Zeit übrig)

**7. Dead CSS `.auth-modal`-Klassen**
Datei: `css/landing.css:956-975` — Relikt aus Vor-Whop-Auth (Supabase/Paddle-Ära), wird
von keinem HTML mehr referenziert. Entfernen oder mit Kommentar "DEPRECATED — pre-Whop"
markieren. Aufwand 5 Min.

**8. Kein CSP `report-uri` konfiguriert**
Reine Monitoring-Lücke, kein Exploit-Pfad. Optional: `/api/csp-report`-Endpunkt +
`report-uri`/`report-to`-Direktive in `vercel.json` ergänzen. Nur angehen, wenn ohnehin
Kapazität für CSP-Arbeiten da ist (siehe Fund 9 unten).

## ⚠️ Bewusst NICHT in dieser Session fixen (architektonische Tradeoffs, dokumentiert)

- **Gate-Bypass via DevTools-Manipulation von `/api/whop-access`** (`js/whop-auth.js:241-319`,
  `js/user-plan.js:29,37`): Strukturelle Grenze des Local-First-Ansatzes — Cloud-Sync bleibt
  serverseitig geschützt, nur die rein lokale Nutzung ist clientseitig gated. Vollständige
  Lösung würde Kernarchitektur ändern (Server-Pflicht für jede Feature-Nutzung). Nicht in
  dieser Session anfassen, nur falls der Nutzer das explizit priorisiert.
- **9. CSP `style-src`/`style-src-attr 'unsafe-inline'`** (`vercel.json`, alle HTML-Meta-Tags):
  App-weite Inline-Styles machen einen Umbau auf nonce-basiert sehr aufwändig (viele Dateien).
  Kein akuter Exploit-Pfad, da `script-src` bereits sauber ist. Nur als eigenes,
  abgegrenztes Refactoring-Projekt angehen, nicht hier reinmischen.
- **Whop-Access-Token in `localStorage` statt httpOnly-Cookie** (`js/whop-auth.js:47`):
  Standard-SPA-Tradeoff, aktuell durch saubere CSP+SRI gut abgefedert. Nur relevant bei
  künftigen Drittanbieter-Embeds.
- **Blob-Attachments mit `access:'public'`** (`api/blob-upload.js:185-188,229-232`):
  Dokumentierte Restgrenze (nur Chiffrat ohne Schlüssel bei URL-Leak), bereits im Code
  kommentiert (`stb-share.js:304`). Kein Fix nötig.
- **`.env.local` mit echten Secrets lokal**: Korrekt von `.gitignore` erfasst, nie
  committet. Reine Hygiene-Erinnerung, kein Code-Fix.

## Nach Abschluss

1. `/security-review` erneut laufen lassen um die eigenen Fixes gegenzuchecken.
2. Im Browser (Edge) verifizieren: Fokus-Trap-Test (Fund 1) mit reiner Tastaturnavigation,
   Gerätesperre-Reset-Fokus (Fund 2), Dropdown-ESC (Fund 5), Demo-Input-Fokusring (Fund 6).
3. Prüfen ob Local 1.7 (`C:\Users\secon\Desktop\TrackYourIncome\Local 1.7`) dieselben
   Dateien (whop-auth.js, sync.js) enthält und ob eine Spiegelung nötig ist — historisch
   läuft das oft als eigene Session, hier nur vermerken, nicht automatisch mit anfassen.
