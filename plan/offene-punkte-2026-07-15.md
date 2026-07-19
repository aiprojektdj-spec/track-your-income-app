# Was fehlt noch? — Gesamtübersicht Web 1.7 (Stand 2026-07-15)

Konsolidiert aus `plan/launch-prompts.md`, `plan/launch-woche-2026-07-13.md`,
`plan/ust-befunde-restliste.md`, `plan/session-prompt-stb-luecken.md`,
`plan/session-prompt-whop-audit.md`, `plan/session-prompt-blob-sync.md`,
`plan/anwalt-notiz-trial-widerruf.md` + Memory-Stand.

---

## 🔴 P0 — Launch-Blocker

| # | Punkt | Status |
|---|---|---|
| P0-1 | Trial-CTA-Änderungen verifizieren + committen | ✅ erledigt (655f428, 25fcf6b) |
| P0-2 | USt-Regelbesteuerung im Browser verifizieren | ✅ erledigt (6c3220a, ecdfeee) — Restliste unten |
| P0-3 | **Echter 2-Profil-Cloud-Sync-E2E-Test** (mit User zusammen, Edge-Browser) | ✅ laut User 2026-07-16 erledigt |
| P0-4 | Finaler Pre-Launch-QA-Sweep (`/qa`) | 🟡 teilerledigt 2026-07-16 — Restliste unten |
| P0-5 | Security-Finalcheck (`/security-stackr` + `/red-team`) | 🟡 Rest übernimmt User selbst |
| P0-6 | Anwalts-Paket schnüren (Briefing + §11/§356-Fragen + Whop-DPA-Status) | 🟡 läuft bereits (Anwalt beauftragt) |

## Cloud-Sync-Blob-Architektur (Speicherlimit-Umbau, 2026-07-15)

- Code fertig **und committet** (`6d399ae`), statisch nachverifiziert diese Session — sauber.
- `BLOB_READ_WRITE_TOKEN` in Vercel bereits gesetzt.
- ⬜ `CRON_SECRET` env var noch nicht gesetzt (aktiviert `api/blob-cleanup.js`).
- ⬜ **Echter Live-Test** (Upload/Chunking/Content-Hash-Cache/Art.17-Löschung gegen echten
  Vercel-Blob-Store) — braucht echten Whop-Pro-Login, kann kein Agent im Preview simulieren.
  **User testet das selbst.**

## USt-Regelbesteuerung — Restliste (nicht launch-blockierend, vor breiter Nutzung angehen)

Punkte 2–4: echtes UStG-Reasoning, nicht ohne `legal-reviewer`/Anwalt final entscheiden.
Punkte 5/6/7 am 2026-07-17 verifiziert und abgeschlossen (siehe unten).

1. ✅ **Gutschriften mindern jetzt den Umsatz (§17 UStG)** — 2026-07-16 gefixt: Root-Fix in
   `Store.createSaleFromInvoice()` (negiert Betrag bei `typ==='gutschrift'`, wirkt auf alle
   Sync-Konsumenten: Ist-UVA, DATEV, GbR). Zusätzlich Soll-UVA (`ustvoranmeldung.js`), EÜR
   (`euer.js`), Dashboard (`dashboard.js`), Bilanz (`bilanz.js`), Statistiken (`statistiken.js`),
   DATEV-Export (`datev.js`, Soll/Haben-Umkehr) direkt gefixt — alle Stellen, die vorher
   `Store.getRechInvoices()` roh summierten, hatten kein Vorzeichen für Gutschriften. Gleichzeitig
   gehärtet: dieselben Filter ließen bislang auch `typ==='angebot'` durch, falls versehentlich als
   "bezahlt" markiert — jetzt auf `rechnung`/`gutschrift` beschränkt. Nicht angefasst: OSS-
   Schwellenwert-Tracking (`oss.js`) berücksichtigt Gutschrift-Stornos noch nicht — siehe Punkt 4.
2. ✅ **Kz. 41 vs. Kz. 21 bei EU-B2B-Dienstleistungen — 2026-07-18 gefixt, 2026-07-18 nachgeschärft.**
   `legal-reviewer` bestätigt: Kz. 41 ist an §4 Nr.1b/§6a UStG (Lieferungen) gebunden, sonstige
   Leistungen (§3a Abs.2 UStG) gehören in Kz. 21 — kein Geldschaden, aber ZM-Abgleich-Diskrepanz-
   Risiko bei Finanzamt-Prüfung. Ursprungs-Fix (parallel, unstaged): `igArt`-Feld auf
   **Rechnungsebene** mit Silent-Default `'ware'`. Risiko-Assessment (`/legal-risk-assessment`)
   fand 2 offene Lücken (beide YELLOW, Score 6/8): (a) Rechnungsebene kann keine Misch-Rechnung
   (Ware+Leistung an denselben EU-Kunden) korrekt abbilden; (b) Silent-Default `'ware'` ohne
   aktive Wahl passt schlecht zu Stackrs service-/beratungslastiger Zielgruppe (Freelancer/GbR).
   Nachgeschärft: `igArt` jetzt **pro Position** (`rechnungen/js/rechnung.js`
   `renderPositionRow`/`collectPositionen`, Sichtbarkeit über `applyReverseChargeCheck()`
   gekoppelt an den §13b-Hinweis), Dropdown hat **keinen vorbelegten Wert** mehr (erste Option
   `disabled`, erzwingt aktive Wahl) und `buildInvoiceObject()` blockt das Speichern mit Toast,
   wenn bei EU-B2B eine 0%-Position ohne gewählte Art bleibt. `js/ustvoranmeldung.js` liest
   `pos.igArt` (Fallback `i.igArt` für Alt-Daten, dann `'ware'`) und verzweigt
   `nettoIgLieferung`(Kz.41)/`nettoIgLeistung`(Kz.21) weiterhin getrennt in Render, Footer-Text
   und ELSTER-CSV-Export. **Nicht browser-verifiziert** — App Whop-Login-gated, kein Zugang in
   dieser Session (identische Einschränkung wie Punkt 6); nur `node --check` + Code-Review.
3. ✅ **Ist-Modus strukturell lückenhaft bei EU-Geschäft — 2026-07-18 gefixt.** Sichtbarer
   Warnhinweis in `js/ustvoranmeldung.js` `render()` ergänzt (erscheint nur wenn
   `!this._isSoll()`): weist auf fehlende Kz.41/21- und OSS-Erfassung im Ist-Modus hin, empfiehlt
   Rücksprache mit Steuerberater bei EU-Geschäft. Render-Test bestätigt korrektes Ein-/Ausblenden.
4. ✅ **OSS unterjährig: rückwirkendes Kippen — 2026-07-18 gefixt (echter Bug, hoch).**
   `legal-reviewer` + `fn-checker` bestätigt: §3c Abs.4 S.1 UStG wirkt prospektiv ab dem
   Umsatz, der die 10.000€-Schwelle reißt — NICHT rückwirkend auf bereits getätigte Umsätze
   desselben Jahres (nur die Vorjahresschwelle nach S.2 wirkt rückwirkend ab dem 1. Umsatz).
   Der alte Code (`ossActive`-Boolean aus `OSS._jahresumsatz(periodYear)`, dem GESAMTEN
   Jahresumsatz) schloss bei später im Jahr gerissener Schwelle auch früh im Jahr korrekt
   dt.-versteuerte Rechnungen rückwirkend aus der UVA aus — stille USt-Verkürzung, Risiko
   §153 AO Anzeigepflicht + §233a AO Zinsen. Fix: `OSS._ueberSchwelleInvoiceIds(year)` in
   `js/oss.js` — chronologische Laufsumme pro Rechnung statt Jahres-Flag, nur Rechnungen ab
   (inkl.) dem Schwellen-Riss gehen zu OSS. `js/ustvoranmeldung.js` nutzt jetzt Invoice-ID-Set
   statt Boolean. Isolierter Node-Test (2 Fälle: unterjähriger Riss + Vorjahresschwelle-Fall)
   bestätigt korrektes Verhalten.
5. ✅ **`vorsteuer.js` Kz.-66-Label** — 2026-07-17 verifiziert: Zeile ~297-302 zeigt Kz. 66 bereits
   korrekt separiert (nur echte Vorsteuer aus Einkäufen/Ausgaben), §13b läuft unter Kz. 67, IG-Erwerb
   unter Kz. 61, kein Aufsummieren. War beim P0-4/5-Fix bereits miterledigt — Restliste-Eintrag war
   stale, gestrichen.
6. ✅ **`calcBrutto`/`isKlein` — jetzt vollständig gefixt (2026-07-17).** Root-Ursache gefunden: die
   `invoice.isKlein`-Leseguards aus dem P0-4/5-Fix waren wirkungslos, weil **kein einziger
   Erstellungspfad `isKlein` je auf die Rechnung geschrieben hat** — jede Rechnung hatte
   `isKlein === undefined` und fiel immer auf die aktuelle `Store.getSettings().ustMode` zurück.
   Schreibseite gefixt: `rechnungen/js/rechnung.js` `buildInvoiceObject()` (persistiert jetzt beim
   Speichern, behält bei bestehender Rechnung den historischen Wert), `js/store.js`
   `createStornoRechnung()` (übernimmt `isKlein` von der Originalrechnung), `rechnungen/js/
   wiederkehrend.js` `createInvoiceFromRule()` (stempelt aktuellen Stand bei Generierung).
   Leseseite nachgezogen (bisher übersehene Kopien, zusätzlich zu den 3 aus dem P0-4/5-Fix):
   `rechnung.js` `calcBrutto()` (totes Codepfad, aus Konsistenz mitgefixt), `updateSummen()`
   (Live-Editor, nutzt `editingInvoice.isKlein`), `generatePreviewHtml()` (**das tatsächlich
   gedruckte/exportierte Rechnungsdokument** — wichtigste Stelle), `dokumente.js`
   `showSendModal()`, `xrechnung.js` `generate()` (E-Rechnung-XML, §14-relevant), `kunden.js`
   (2 Stellen, pro-Rechnung statt einmal-außerhalb-der-Schleife korrigiert), `js/store.js`
   `createSaleFromInvoice()`, `js/datev.js` `buildCSV()`-Rechnungszeilen (GoBD-Export). Alle 8
   geänderten Dateien mit `node --check` syntaxgeprüft. **Nicht browser-verifiziert** — App ist
   Whop-Login-gated, keine Zugangsdaten in dieser Session verfügbar; nur statisch (grep/read)
   verifiziert.
7. ✅ **Exotische Steuersätze (CH 8.1/2.6)** — 2026-07-17 verifiziert: für Web 1.7 gegenstandslos.
   `js/schweiz.js` existiert noch, wird aber in keiner HTML-Seite mehr geladen (dormant/dead seit
   CH/AT-Entfernung, siehe W2 unten) — kein Landwechsel zu CH mehr möglich. Aus der Restliste
   gestrichen statt gefixt. Für `Local 1.7` (behält CH aktiv) separat prüfen, nicht in diesem Repo.
8. Kosmetik: Dashboard-Einnahmen-Karte-Diskrepanz — im P0-4-QA-Sweep nachgehen.

## USt-Bulletproof — letzte 3 Restrisiken (`session-prompt-ust-bulletproof.md`, 2026-07-19)

1. ✅ **Vorsteuer §14/§33-Beleg-Nachweis** — Option C umgesetzt (Commit `e84e5a0`): Lieferant/
   Steuernr./Beleg-Foto-Felder in `ausgaben.js`/`buchungen.js`, `Vorsteuer._belegCheck()`
   (§33 UStDV Kleinbetragsrechnung ≤250€ nur Aussteller-Name, darüber zusätzlich Steuernr./
   USt-IdNr.) + Vollständigkeits-Summary in `vorsteuer.js`. Reine Dokumentationshilfe, kein Gate
   auf den Vorsteuerabzug selbst. `node --check` grün, §33-UStDV-Schwelle stichprobenartig
   gegengeprüft (korrekt: 250€ brutto, `<=`). **Anmerkung:** wurde von der Parallel-Session ohne
   die vom eigenen Prompt geforderte Vorab-Rückfrage umgesetzt — Ergebnis inhaltlich sauber,
   aber Scope-Entscheidung im Nachhinein nicht vom User bestätigt.
2. 🟡 **Race Condition Rechnungsnummern (paralleles Tabs)** — EMPFEHLUNG: zurückstellen. Nur
   3 Dateien betroffen (`rechnungen/js/rechnung.js`, `js/store.js`, `rechnungen/js/
   wiederkehrend.js`), nicht 5 wie ursprünglich geschätzt — aber echter `async`-Umbau von
   `nextRechInvoiceNumber()`/`nextStornoNumber()`/`nextInvoiceNumber()` inkl. aller UI-Callbacks
   bleibt ein Architektur-Eingriff mit Regressionspotential. Nutzen bei Stackrs Zielgruppe
   (Solo-Freelancer/kleine GbR) gering — Kollision braucht exakt zeitgleiches Speichern in zwei
   Tabs derselben Firma. Aufwand/Nutzen-Verhältnis aktuell nicht gerechtfertigt. Bei Bedarf
   später mit `navigator.locks.request()` umsetzen (Vorgehen im Prompt bereits ausformuliert).
3. 🟡 **`euer.js`/`bilanz.js`-Dedup** — Annahme im Original-Prompt war zu grob: beide Module
   sind KEINE reine Code-Duplikation, sondern folgen unterschiedlichen, jeweils korrekten
   Rechtsgrundlagen (`euer.js` = EÜR nach §4 Abs.3 EStG, Zufluss-/Abflussprinzip, USt explizit
   als Durchlaufposten separiert; `bilanz.js` = GuV nach §238 HGB, Periodenabgrenzung, direkte
   Netto-Verbuchung ohne Durchlaufposten-Zeile) — die höherwertige Struktur darf NICHT
   vereinheitlicht werden, sonst vermischen sich zwei Steuerregime in gemeinsamem Code. Die
   Parallel-Session hat unabhängig dieselbe engere Grenze gezogen: neue `js/steuer-berechnung.js`
   extrahiert NUR die reine Satz-Arithmetik (`nettoAusBrutto`/`nettoSales`/`nettoRetouren`/
   `nettoRechnungen`/`nettoPurchases`/`nettoExpenses`, nimmt bereits gefilterte Datensätze
   entgegen) als Single Source of Truth für die Brutto→Netto-Formel — genau der schmale, sichere
   Ausschnitt, der auch hier als einzig echte Dopplung identifiziert wurde. `euer.js` ist bereits
   umgestellt (verifiziert: `node --check` grün, Formel-für-Formel gegen Alt-Code gelesen,
   verhaltensidentisch). `bilanz.js` **noch nicht** auf `SteuerBerechnung` umgestellt — bewusst
   offen gelassen, kein Zeitdruck, gleiches Muster kann bei Bedarf nachgezogen werden.

## P0-4/P0-5 QA+Security-Sweep (2026-07-16) — gefixt

- ✅ `vorsteuer.js` Doppelabzug-Label-Bug (Kz. 66 fälschlich auf Gesamtsumme inkl. §13b/IG)
- 🟡 `calcBrutto` nutzte aktuelle §19-Einstellung statt Rechnungs-Stand (Lese-Guard `invoice.isKlein`
  in 3 von 6 Kopien ergänzt: mahnungen.js, rech-dashboard.js, dokumente.js:4) — **Achtung, dieser
  Eintrag war unvollständig:** die Schreibseite (`isKlein` beim Speichern persistieren) fehlte
  komplett, siehe Punkt 6 der Restliste unten — dort am 2026-07-17 vollständig nachgezogen
  (Schreibseite + 8 weitere Lesestellen).
- ✅ `api/whop-access.js` hatte kein Rate-Limit (🔴 KRITISCH, Kosten-/Quota-DoS gegen den
  gemeinsamen Whop-Key) — IP-Rate-Limit nach Vorbild `api/sync.js` ergänzt
- ✅ showToast-HTML-Injection an 6 Stellen (materiallager.js, ausgaben.js, lager.js,
  companies.js) — `Utils.escapeHtml()` nachgerüstet
- ✅ Lagerwert in Zonenansicht ignorierte `anzahl` (lager.js:1169/1519) — Formel korrigiert
- ✅ "Firma löschen" ließ rohe `co_<id>__eigenbelege_*`-localStorage-Keys stehen (kamen beim
  nächsten Start über `_migrateEigenbelegeToIDB()` zurück) + löschte keinen Cloud-Sync-Snapshot
  (Art. 17 DSGVO) — beides in `CompanyManager.delete()` nachgerüstet

## P0-4/P0-5 — Restliste (nicht gefixt, braucht eigene Session)

1. ✅ **Bilanz (GuV) + Statistiken zeigen jetzt bezahlte, ungesyncte Rechnungen** — 2026-07-16
   gefixt: gleiches `unsyncedRevenue`-Pattern wie `euer.js`/`dashboard.js` in `bilanz.js`
   (Umsatzerlöse) und `statistiken.js` (Material-%-Denominator) nachgezogen. Plattform-/Marken-
   /Typ-Aufschlüsselungen in `statistiken.js` bleiben bewusst Sales-only (Rechnungen haben keine
   Plattform/Marke/EK) — dokumentierte Limitation, kein Fix nötig.
2. ✅ **Whop-Gate DevTools-Bypass gefixt** — 2026-07-16: `whop_grace_until` (roher, im DevTools
   frei setzbarer Timestamp) ersetzt durch signiertes Grace-Token (ECDSA P-256). Server
   (`api/whop-access.js`) signiert `{uid, exp}` mit `WHOP_GRACE_PRIVATE_KEY` (Private Key, nur
   Server kennt ihn), Client (`js/whop-auth.js`) verifiziert offline per `crypto.subtle.verify`
   mit eingebettetem Public Key — ohne Private Key keine fälschbare Signatur, per Test-Skript
   verifiziert (echtes Token gültig, manipuliertes abgelehnt). Client-seitiger Owner-Bypass
   (ebenfalls ungeprüft) entfernt, läuft jetzt über denselben serverseitig geprüften Pfad.
   **Offen (User/Infra):** `WHOP_GRACE_PRIVATE_KEY` env var in Vercel setzen (PEM liegt im
   Session-Log dieser Änderung) — ohne die Env liefert der Server kein Grace-Token, Client fällt
   dann auf Re-Login bei jedem Offline-Start zurück (fail-closed, kein Sicherheitsloch, nur UX).
3. MITTEL — `api/whop-token.js` fällt bei fehlender Redis-Env komplett offen (kein Rate-Limit-
   Fallback), nur ein `console.warn`. Klein, aber nicht launch-kritisch.
4. INFO — Vercel-Blob-Attachments `access:'public'` (durch Verschlüsselung + Random-Suffix
   entschärft, kein akuter Handlungsdruck).
5. INFO — Whop-Gate ist für App-Kernfunktionen rein clientseitig (bewusste Local-First-Folge,
   kein Fix ohne Architekturwechsel).
6. INFO — `ui-lab.html` lädt Tabler-Icons ohne SRI (Prototyp, kein Kundendatenzugriff).
7. INFO — `node_modules/` fehlt in `.gitignore`.

---

## 🟡 Launch-Woche bis So 2026-07-19 (zusätzlich zu P0)

| # | Punkt | Status |
|---|---|---|
| W1 | Onboarding "Ich habe schon eine Firma" + Cloud-Sync | ✅ erledigt (6527bcc, 00bc921) |
| W2 | Schweiz/Österreich-Modul aus Web 1.7 entfernen (Local 1.7 unangetastet) | ✅ erledigt 2026-07-16 — 14 Dateien CH/AT-frei, schweiz/oesterreich/svs.js dormant behalten, Rechtstexte (agb/datenschutz) offen für Anwalt |
| W3 | Make.com-Webhook-API (Trigger-Events, HMAC-Signatur) | ✅ erledigt (4cbd40d, E2E-Test 53b0ec4 2026-07-17) |
| W4 | UI-Politur (separate interaktive Session mit User) | ⬜ offen — Prompt: `plan/session-prompt-ui-politur.md` |
| — | Weitere Test-Kunden akquirieren | ⬜ macht User selbst |

---

## 🟢 P1 — launch-nah

| # | Punkt | Status |
|---|---|---|
| P1-1 | Steuerberater-Read-Only fertigbauen (2 Client-Lücken, Branch `feature/csp-phase-c`) | ⬜ offen — wartet auf Kunden-Go |
| P1-2 | Landing-Copy + technisches SEO-Minimum | ⬜ offen — Prompt: `plan/session-prompt-landing-seo.md` |
| P1-3 | Launch-Baseline messen (Wachstumsplan Juli Woche 1) | ⬜ offen |

**P1-1 Details (`session-prompt-stb-luecken.md`):**
- Lücke 1 (kritisch): Steuerberater ohne eigenes Abo muss durchs Login-Gate kommen können.
- Lücke 2 (klein): "Zugriff entziehen"-Button beim Mandanten fehlt (nur per DevTools möglich).

---

## 🔵 P2 — kann nach Launch

| # | Punkt | Status |
|---|---|---|
| P2-1 | Local 1.7 spiegeln + verwaistes Git reparieren | 🟡 teilweise (2026-07-17): Git repariert (fsck sauber, war nur 3 Commits hinter `origin/main`, nicht wirklich verwaist), 70 uncommittete Änderungen in 4 thematische Commits aufgeteilt + gepusht (`e800115`..`fba3222`). Dabei 2 echte Bugs gefixt: `impressum.html`/`datenschutz.html` waren gelöscht aber noch von `app.html` verlinkt (rechtlich pflichtig, wiederhergestellt aus altem HEAD); `lager/index.html` + `rechnungen/index.html` luden noch 4 gelöschte Cloud-Sync/Auth-Dateien (tote `<script>`-Tags + veraltete Supabase-CSP-Regel entfernt). Schritt 3 (eigentlicher Spiegel-Abgleich Web→Local laut Prompt: USt-Regelbesteuerung, GoBD Edit/Delete, Whop-Grace-Token, Datum-Handling) noch **offen** — dafür braucht es eine eigene Session. CH/AT (`js/schweiz.js`/`js/oesterreich.js`) bestätigt weiterhin aktiv in Local. |
| P2-2 | Performance + Accessibility Audit (Landing/Onboarding) | ⬜ offen — Prompt: `plan/session-prompt-performance-a11y.md` |

---

## Whop-Auth Vollaudit (`session-prompt-whop-audit.md`)

Noch nicht als eigene Session gefahren — genereller Ende-zu-Ende-Audit über Client (`whop-auth.js`)
+ Server (`whop-access.js`, `whop-token.js`), inkl. Race-Conditions bei Offline-Grace,
Rate-Limit-Lücken, Pagination-Limit bei >1000 Memberships. ⬜ offen.

---

## Rechtliches

- **Anwalt-Freigabe §11 AGB-Haftung** — beauftragt, Antwort offen. ⬜ Briefing-Erstellung
  (noch nicht das Freigabe-Ergebnis selbst): Prompt `plan/session-prompt-anwalt-briefing.md`.
- **Trial-Klausel § 356 Abs. 5 BGB** (vorzeitiges Erlöschen Widerrufsrecht bei Abo) — geht in
  dieselbe Anwalt-Prüfrunde wie §11 (`P0-6`), abgedeckt vom selben Briefing-Prompt oben. ⬜
- **Whop-DPA/AV-Vertrag** — noch nicht angefordert. ⬜ Prompt:
  `plan/session-prompt-whop-dpa-anfrage.md` (Recherche + Anfrage-Entwurf, Versand macht User).

---

## Infra/Deploy (nur User)

- ✅ `CRON_SECRET` env var in Vercel (Production) gesetzt — 2026-07-16, per Vercel-CLI, Wert
  nie im Klartext ausgegeben.
- ✅ `WHOP_GRACE_PRIVATE_KEY` env var in Vercel (Production) gesetzt — 2026-07-16, neues
  ECDSA-P256-Schlüsselpaar generiert (alter Key aus Vorsession war nirgends gespeichert),
  zugehöriger Public Key in `js/whop-auth.js` (`GRACE_PUBKEY_JWK`) nachgezogen. Grace-Token-
  Umbau + Public-Key-Fix mit Commit `4d74de9` committet + gepusht — kein uncommitted Rest mehr.
- ✅ Deploy + Prod-Smoke-Test — 2026-07-16: Commit `4d74de9` live auf
  `track-your-income-app.vercel.app`, verifiziert (Browser, 8 Seiten: `/`, `agb.html`,
  `datenschutz.html`, `app.html`, `rechnungen/index.html`, `lager/index.html`,
  `eigenbelege/index.html`, `impressum.html`). Keine Console-Errors. CH/AT-Reste in
  agb/datenschutz/app.html live bestätigt entfernt (Fehltreffer "CHF" war nur "na**chf**olgend"
  in beiden Fällen). E-Rechnung-Hinweis im Rechnungsformular live bestätigt.
- Blob-Sync + Cloud-Sync-E2E: echter Test mit echtem Whop-Login (User selbst) — laut User
  2026-07-16 bereits erledigt bzw. läuft sobald live.

---

## Bekannte, bewusst akzeptierte Lücken (nicht anfassen ohne expliziten Wunsch)

- Superseded Blob-Anhänge werden nicht per Referenzzählung aufgeräumt (kleines Kosten-Leck).
- `js/companies.js` `migrateEigenbelegeToCompanies()` schreibt weiter direkt in localStorage
  (nur für theoretischen Alt-Install ohne Migration relevant, selbstheilend).
- StB-Re-Key beim Zugriffsentzug (Alt-Snapshots bleiben mit altem Schlüssel entschlüsselbar).
