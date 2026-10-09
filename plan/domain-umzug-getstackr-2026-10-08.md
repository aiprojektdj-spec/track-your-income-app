# Domain-Umzug track-your-income-app.vercel.app -> getstackr.de

Stand: 2026-10-08. Gegen den Code pruefen, nicht gegen diese Datei.

## Ausgangslage

- getstackr.de ist gekauft (INWX), mit Vercel verbunden (Production), www -> 308 auf getstackr.de.
- Whop-Login funktioniert auf beiden Domains (PR #28, beide Redirect-URLs in der Whop-App).
  Vom User am 2026-10-08 auf getstackr.de erfolgreich getestet.
- **Kernproblem:** Buchhaltungsdaten liegen local-first im Browser (localStorage, IndexedDB,
  OPFS) und haengen am Origin. Auf getstackr.de ist die App zunaechst leer.
  Heute gibt es zwei Wege: Cloud-Sync (Wiederherstellungscode eingeben) oder Backup-Datei
  exportieren/importieren. Belegfotos/-PDFs liegen inline in den Datensaetzen und reisen
  mit beiden Wegen mit.

## Entscheidungen (User, 2026-10-08)

| Frage | Entscheidung |
|---|---|
| Sync-Schluessel automatisch mitnehmen? | **Nein.** Nur Daten wandern, Sync-Nutzer geben ihren Code einmal neu ein. |
| Uebergangszeit | **4 Wochen** ab Start Phase 3 |
| Kundeninfo | **Hinweis in der App + Nachricht.** Claude formuliert, User verschickt. |
| Alte App-Adresse abschalten? | **Nie.** Nach der Uebergangszeit nur noch "Umziehen / Exportieren" (GoBD: 10 Jahre). |

## Phase 1 - Oeffentliche Seiten auf die neue Domain (keine Kundendaten)

- [ ] canonical, og:url, og:image, JSON-LD in `index.html` und `landing-v2.html` -> getstackr.de
- [ ] `sitemap.xml`, `robots.txt` -> getstackr.de
- [ ] `datenschutz.html`: Domain nennen (beide, solange die alte laeuft). Rechtstext -> Anwalt-Liste.
- [ ] `vercel.json`: Redirect **nur** fuer Landing/Rechtsseiten auf der alten Domain -> getstackr.de
      (host-basiert). **Nie** fuer app.html, rechnungen/, lager/, eigenbelege/, api/.
- [ ] `api/*.js`: Access-Control-Allow-Origin ist fest auf die alte Domain. Same-Origin-Aufrufe
      brauchen keinen CORS-Header, also kein Fehler; trotzdem auf Host-Liste umstellen, damit es
      nicht spaeter als Bug auffaellt.
- [ ] `scripts/check-live-exposure.js`: auch getstackr.de pruefen.
- [ ] **User:** In Whop pruefen, ob Produkt-/Checkout-Seiten auf die alte Domain verlinken
      (Weiterleitung nach Kauf, Produktbeschreibung) -> auf getstackr.de/app.html umstellen.

Abnahme: alte Landing leitet auf getstackr.de, alte app.html laedt weiterhin ohne Redirect.

## Phase 2 - Umzugs-Assistent (Tab zu Tab, kein Server)

Neues Fachmodul `js/domain-umzug.js` (nicht in app.js/store.js), plus `umzug.html` auf getstackr.de.

1. Alte App: Banner "Stackr zieht nach getstackr.de" mit Button "Jetzt umziehen".
2. Klick oeffnet `https://getstackr.de/umzug.html` per `window.open`.
3. Neue Seite meldet per `postMessage` "bereit" (nur an Origin der alten Domain).
4. Alte Seite schickt `BackupCrypto.buildBundle()` per `postMessage` mit
   `targetOrigin = 'https://getstackr.de'`.
5. Neue Seite akzeptiert nur `event.origin === 'https://track-your-income-app.vercel.app'`,
   prueft jeden Schluessel mit der vorhandenen Allowlist (`_isAllowedKey`) und merged ueber die
   vorhandenen Bausteine (`mergeRecords`, `mergeAudit`, `mergeKey` - lokaler Wert gewinnt).
6. Danach leitet die neue Seite zu app.html. Alte Seite merkt sich "umgezogen am ..." und zeigt
   einen Link statt des Banners.

Sicherheit / Annahmen:
- Kein Sync-Schluessel, kein Whop-Token, keine Geraete-ID im Bundle (Allowlist erzwingt das).
- Login auf getstackr.de ist Voraussetzung (Gate laeuft normal), Daten werden erst nach Login
  angenommen.
- Bestehende Daten auf getstackr.de werden gemerged, nie ueberschrieben.
- CSP: `umzug.html` braucht eine eigene Route in `vercel.json` (pro Route, nie global).
- Tests in `test/`: Origin-Pruefung, Allowlist, Merge ohne Datenverlust, doppelter Umzug idempotent.

Abnahme: Testfirma auf alter Domain anlegen (Buchung, Rechnung, Eigenbeleg mit Foto),
umziehen, auf getstackr.de identisch. Der Login-Teil macht der User.

## Phase 3 - Uebergangszeit (4 Wochen)

- [ ] Phase 2 live, Banner aktiv. Startdatum hier eintragen: ____
- [ ] Kundennachricht (Text von Claude, Versand User). Inhalt: neue Adresse, ein Klick
      "Jetzt umziehen", Sync-Nutzer brauchen ihren Wiederherstellungscode, alte Adresse bleibt
      erreichbar, nichts geht verloren.
- [ ] Nach 2 Wochen: Erinnerung an alle, die noch nicht umgezogen sind (nur ueber App-Banner
      messbar; Server sieht nichts davon).

## Phase 4 - Abschluss

- [ ] Alte Domain: app.html, rechnungen/, lager/, eigenbelege/ zeigen nur noch Umzug + Export
      (Backup-Datei). Keine Bearbeitung mehr, damit keine Datenstaende auseinanderlaufen.
- [ ] Whop: alte Redirect-URL bleibt eingetragen (Export braucht Login).
- [ ] Canonical/Links ueberall nur noch getstackr.de.
- [ ] Alte Domain wird **nicht** abgeschaltet.

## Offen / Risiken

- Kunden, die die alte App in mehreren Browsern nutzen, muessen je Browser umziehen.
- Wer in der Uebergangszeit auf beiden Domains bucht, erzeugt zwei Staende. Der Assistent merged
  nur einmal alt -> neu; danach weist das Banner auf "bereits umgezogen" hin.
- Rechtstexte (Datenschutz, ggf. AGB/Impressum mit Domainnennung) -> Anwalt-Freigabe.
